import { Router } from 'express';
import db, { getActiveSessionId } from '../db.js';
import { rollDice, rollChance } from '../dice.js';
import {
  calculateTravelSpeed, advanceTime, isForcedMarch,
  parseDirectionChance, isLost, MAX_TRAVEL_HOURS,
} from '../travel-logic.js';
import { formatHadeanDate, getSeason, advanceDate } from '../calendar.js';
import { rollWeather } from '../weather.js';

const router = Router();

const undoStack = [];

function getState() {
  return db.prepare('SELECT * FROM campaign_state WHERE id = 1').get();
}

function saveSnapshot() {
  const state = getState();
  const maxLog = db.prepare('SELECT MAX(id) as maxId FROM session_log').get();
  undoStack.push({ state, maxLogId: maxLog.maxId || 0 });
}

function updateState(fields) {
  const updates = [];
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    updates.push(`${key} = ?`);
    values.push(value);
  }
  values.push(1);
  db.prepare(`UPDATE campaign_state SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

function addLog(year, month, day, hour, category, message) {
  const sessionId = getActiveSessionId();
  db.prepare('INSERT INTO session_log (log_year, log_month, log_day, hour, category, message, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(year, month, day, hour, category, message, sessionId);
}

function rollOnEncounterTable(terrainId) {
  const tables = db.prepare('SELECT * FROM encounter_tables WHERE terrain_id = ?').all(terrainId);
  if (tables.length === 0) return null;

  const table = tables[0];
  const diceResult = rollDice(table.dice_expression);
  if (!diceResult) return null;

  const entry = db.prepare(
    'SELECT * FROM encounter_table_entries WHERE table_id = ? AND roll_min <= ? AND roll_max >= ?'
  ).get(table.id, diceResult.total, diceResult.total);

  let numberAppearing = null;
  if (entry?.number_appearing) {
    numberAppearing = rollDice(entry.number_appearing);
  }

  return {
    table: { id: table.id, name: table.name, dice_expression: table.dice_expression },
    diceResult,
    entry: entry || { description: 'No encounter (roll not on table)' },
    numberAppearing,
  };
}

// GET /api/travel/state — Get current travel state + terrain info
router.get('/state', (req, res) => {
  const state = getState();
  let terrain = null;
  let travelSpeed = null;

  if (state.current_terrain_id) {
    terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(state.current_terrain_id);
    if (terrain) {
      travelSpeed = calculateTravelSpeed(terrain, state.movement_rate);
    }
  }

  res.json({ state, terrain, travelSpeed });
});

// GET /api/travel/can-undo — Check if undo is available
router.get('/can-undo', (req, res) => {
  res.json({ canUndo: undoStack.length > 0 });
});

// POST /api/travel/undo — Undo last mutating action
router.post('/undo', (req, res) => {
  if (undoStack.length === 0) return res.status(400).json({ error: 'Nothing to undo' });

  const { state: savedState, maxLogId } = undoStack.pop();

  // Restore campaign_state fields
  const fields = [
    'current_hex_id', 'current_terrain_id', 'hours_traveled_today',
    'hexes_traveled_today', 'current_year', 'current_month',
    'current_day_of_month', 'current_hour', 'movement_rate',
  ];
  const updates = {};
  for (const f of fields) {
    updates[f] = savedState[f];
  }
  updateState(updates);

  // Delete log entries created after the snapshot
  db.prepare('DELETE FROM session_log WHERE id > ?').run(maxLogId);

  res.json({ success: true, canUndo: undoStack.length > 0, state: getState() });
});

// POST /api/travel/enter-hex — Traverse a hex
router.post('/enter-hex', (req, res) => {
  saveSnapshot();
  const { terrain_id, hex_id } = req.body;
  if (!terrain_id) return res.status(400).json({ error: 'terrain_id is required' });

  const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(terrain_id);
  if (!terrain) return res.status(404).json({ error: 'Terrain not found' });

  const state = getState();
  const travelSpeed = calculateTravelSpeed(terrain, state.movement_rate);
  const hoursToTraverse = travelSpeed.hoursPerHex;

  const timeResult = advanceTime(state, hoursToTraverse);

  const updates = {
    current_terrain_id: terrain_id,
    current_hex_id: hex_id || state.current_hex_id,
    ...timeResult,
  };

  updateState(updates);

  const dateStr = formatHadeanDate(timeResult.current_day_of_month, timeResult.current_month, timeResult.current_year);
  addLog(timeResult.current_year, timeResult.current_month, timeResult.current_day_of_month, timeResult.current_hour, 'travel',
    `Traversed hex ${hex_id || '???'} (${terrain.name}). Travel time: ${hoursToTraverse.toFixed(1)} hours.`
  );

  // Forced march warning
  const forcedMarch = isForcedMarch(timeResult.hours_traveled_today);

  res.json({
    terrain,
    travelSpeed,
    hoursToTraverse,
    timeAdvanced: {
      year: timeResult.current_year,
      month: timeResult.current_month,
      day: timeResult.current_day_of_month,
      hour: timeResult.current_hour,
      formatted: dateStr,
    },
    forcedMarch,
    state: getState(),
  });
});

// POST /api/travel/wander-check — Manual wandering monster check
router.post('/wander-check', (req, res) => {
  saveSnapshot();
  const state = getState();
  const terrainId = req.body.terrain_id || state.current_terrain_id;
  if (!terrainId) return res.status(400).json({ error: 'No terrain specified' });

  const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(terrainId);
  if (!terrain) return res.status(404).json({ error: 'Current terrain not found' });

  const check = rollChance(terrain.wandering_monster_chance);
  let encounterResult = null;

  if (check?.success) {
    encounterResult = rollOnEncounterTable(terrain.id);
    const distResult = rollDice(terrain.encounter_distance);

    if (encounterResult?.entry) {
      addLog(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, 'encounter',
        `Wandering monster! ${encounterResult.entry.description}` +
        (encounterResult.numberAppearing ? ` (${encounterResult.numberAppearing.total} appearing)` : '') +
        (distResult ? ` at ${distResult.total} yards` : '')
      );
      encounterResult.distance = distResult;
    }
  } else {
    addLog(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, 'travel', `Manual wandering monster check: safe (rolled ${check?.roll}).`);
  }

  res.json({ check, encounterResult });
});

// POST /api/travel/forage — Attempt foraging
router.post('/forage', (req, res) => {
  saveSnapshot();
  const state = getState();
  const terrainId = req.body.terrain_id || state.current_terrain_id;
  if (!terrainId) return res.status(400).json({ error: 'No terrain specified' });

  const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(terrainId);
  if (!terrain) return res.status(404).json({ error: 'Current terrain not found' });

  if (!terrain.foraging_chance) {
    return res.json({ success: false, message: 'Foraging is not possible in this terrain.' });
  }

  // Handle "auto" foraging (always succeeds, e.g. Farmlands)
  if (terrain.foraging_chance === 'auto') {
    const yield_result = terrain.foraging_yield ? rollDice(terrain.foraging_yield) : null;
    addLog(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, 'foraging',
      `Foraging automatic success! Found ${yield_result?.total ?? 0} rations (${terrain.foraging_yield}: [${yield_result?.rolls?.join(', ') ?? ''}]).`
      + (terrain.foraging_notes ? ` Note: ${terrain.foraging_notes}` : '')
    );
    return res.json({ check: { success: true, auto: true }, yield: yield_result, terrain: terrain.name });
  }

  const check = rollChance(terrain.foraging_chance);
  let yield_result = null;

  if (check?.success && terrain.foraging_yield) {
    yield_result = rollDice(terrain.foraging_yield);
    addLog(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, 'foraging',
      `Foraging successful! Found ${yield_result.total} rations (${terrain.foraging_yield}: [${yield_result.rolls.join(', ')}]).`
    );
  } else {
    addLog(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, 'foraging',
      `Foraging failed (rolled ${check?.roll}, needed ${check?.target} or less on d${check?.sides}).`
    );
  }

  res.json({ check, yield: yield_result, terrain: terrain.name });
});

// POST /api/travel/hunt — Attempt hunting
router.post('/hunt', (req, res) => {
  saveSnapshot();
  const state = getState();
  const terrainId = req.body.terrain_id || state.current_terrain_id;
  if (!terrainId) return res.status(400).json({ error: 'No terrain specified' });

  const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(terrainId);
  if (!terrain) return res.status(404).json({ error: 'Current terrain not found' });

  if (!terrain.hunting_chance) {
    return res.json({ success: false, message: 'Hunting is not possible in this terrain.' });
  }

  const check = rollChance(terrain.hunting_chance);
  let yield_result = null;

  if (check?.success && terrain.hunting_yield) {
    yield_result = rollDice(terrain.hunting_yield);
    addLog(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, 'hunting',
      `Hunting successful! Caught ${yield_result.total} rations (${terrain.hunting_yield}: [${yield_result.rolls.join(', ')}]).`
    );
  } else {
    addLog(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, 'hunting',
      `Hunting failed (rolled ${check?.roll}, needed ${check?.target} or less on d${check?.sides}).`
    );
  }

  res.json({ check, yield: yield_result, terrain: terrain.name });
});

// POST /api/travel/direction-check — Check for losing direction
router.post('/direction-check', (req, res) => {
  saveSnapshot();
  const { terrain_id, weather_modifier = 0 } = req.body;
  const state = getState();
  const terrainId = terrain_id || state.current_terrain_id;
  if (!terrainId) return res.status(400).json({ error: 'No terrain specified' });

  const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(terrainId);
  if (!terrain) return res.status(404).json({ error: 'Current terrain not found' });

  if (!terrain.losing_direction_chance) {
    return res.json({ lost: false, message: 'No chance of losing direction in this terrain.' });
  }

  const chance = parseDirectionChance(terrain.losing_direction_chance, weather_modifier);
  if (!chance) return res.status(500).json({ error: 'Invalid chance format' });

  const roll = Math.floor(Math.random() * chance.sides) + 1;
  const lost = isLost(roll, chance);

  addLog(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, 'navigation',
    lost
      ? `Lost direction! (rolled ${roll}, needed ${chance.adjustedTarget} or less on d${chance.sides}${weather_modifier > 0 ? `, weather +${weather_modifier}` : ''}).`
      : `Direction check passed (rolled ${roll}, needed ${chance.adjustedTarget} or less on d${chance.sides}${weather_modifier > 0 ? `, weather +${weather_modifier}` : ''}).`
  );

  res.json({
    lost,
    roll,
    baseTarget: chance.baseTarget,
    adjustedTarget: chance.adjustedTarget,
    sides: chance.sides,
    weatherModifier: weather_modifier,
    terrain: terrain.name,
  });
});

// POST /api/travel/reset-day — Advance to next day and reset travel counters
router.post('/reset-day', (req, res) => {
  saveSnapshot();
  const state = getState();
  const morningHour = 6;

  const newDate = advanceDate(state.current_year, state.current_month, state.current_day_of_month, 1);
  const dateStr = formatHadeanDate(newDate.current_day_of_month, newDate.current_month, newDate.current_year);

  updateState({
    current_year: newDate.current_year,
    current_month: newDate.current_month,
    current_day_of_month: newDate.current_day_of_month,
    current_hour: morningHour,
    hours_traveled_today: 0,
    hexes_traveled_today: 0,
  });

  addLog(newDate.current_year, newDate.current_month, newDate.current_day_of_month, morningHour, 'travel', `New day begins — ${dateStr}.`);

  res.json({ success: true, state: getState() });
});

// GET /api/travel/log — Get session log
router.get('/log', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const sessionId = req.query.session_id ? parseInt(req.query.session_id) : getActiveSessionId();
  let logs;
  if (sessionId) {
    logs = db.prepare('SELECT * FROM session_log WHERE session_id = ? ORDER BY id DESC LIMIT ?').all(sessionId, limit);
  } else {
    logs = db.prepare('SELECT * FROM session_log ORDER BY id DESC LIMIT ?').all(limit);
  }
  res.json(logs.reverse());
});

// POST /api/travel/set-state — Manually set campaign state
router.post('/set-state', (req, res) => {
  const allowed = ['current_hex_id', 'current_terrain_id', 'hours_traveled_today', 'hexes_traveled_today', 'current_year', 'current_month', 'current_day_of_month', 'current_hour', 'movement_rate'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' });
  updateState(updates);
  const newState = getState();
  if (req.body.log_message) {
    addLog(newState.current_year, newState.current_month, newState.current_day_of_month, newState.current_hour, 'time', req.body.log_message);
  }
  res.json({ state: newState });
});

// POST /api/travel/roll-weather — Roll weather for current season
router.post('/roll-weather', (req, res) => {
  saveSnapshot();
  const state = getState();
  const season = getSeason(state.current_month);
  const weather = rollWeather(season);

  if (!weather) return res.status(500).json({ error: 'Failed to roll weather' });

  addLog(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, 'weather',
    `Weather: ${weather.weather}, ${weather.air}, Day: ${weather.dayTemp}, Night: ${weather.nightTemp} (${season}, rolled ${weather.roll}).`
  );

  res.json({ weather, state: getState() });
});

export default router;
