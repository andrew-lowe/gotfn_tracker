import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Database from 'better-sqlite3';

// We need an isolated test DB, so we patch the db module before importing routes.
// Strategy: create an in-memory DB, initialize schema, then run the app against it.

let app, db, server;
const PORT = 0; // Let OS assign a free port
let baseUrl;

async function setupTestApp() {
  // Create in-memory DB
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE terrain_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      travel_speed_modifier REAL NOT NULL DEFAULT 0,
      visibility_miles REAL NOT NULL DEFAULT 3,
      losing_direction_chance TEXT,
      foraging_chance TEXT,
      foraging_yield TEXT,
      hunting_chance TEXT,
      hunting_yield TEXT,
      wandering_monster_frequency TEXT NOT NULL DEFAULT '1/day',
      wandering_monster_chance TEXT NOT NULL DEFAULT '1:6',
      encounter_distance TEXT NOT NULL DEFAULT '2d6 × 10',
      evasion_modifier TEXT,
      description TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#808080'
    );

    CREATE TABLE encounter_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terrain_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dice_expression TEXT NOT NULL DEFAULT '2d6',
      FOREIGN KEY (terrain_id) REFERENCES terrain_types(id) ON DELETE CASCADE
    );

    CREATE TABLE encounter_table_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER NOT NULL,
      roll_min INTEGER NOT NULL,
      roll_max INTEGER NOT NULL,
      description TEXT NOT NULL,
      number_appearing TEXT,
      notes TEXT,
      FOREIGN KEY (table_id) REFERENCES encounter_tables(id) ON DELETE CASCADE
    );

    CREATE TABLE campaign_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_hex_id TEXT,
      current_terrain_id INTEGER,
      hours_traveled_today REAL NOT NULL DEFAULT 0,
      hexes_traveled_today INTEGER NOT NULL DEFAULT 0,
      current_year INTEGER NOT NULL DEFAULT 22,
      current_month INTEGER NOT NULL DEFAULT 8,
      current_day_of_month INTEGER NOT NULL DEFAULT 22,
      current_hour REAL NOT NULL DEFAULT 6,
      FOREIGN KEY (current_terrain_id) REFERENCES terrain_types(id) ON DELETE SET NULL
    );

    CREATE TABLE session_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      log_year INTEGER NOT NULL,
      log_month INTEGER NOT NULL,
      log_day INTEGER NOT NULL,
      hour REAL NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      session_id INTEGER REFERENCES sessions(id)
    );

    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_number INTEGER NOT NULL,
      name TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      start_year INTEGER, start_month INTEGER, start_day INTEGER, start_hour REAL,
      end_year INTEGER, end_month INTEGER, end_day INTEGER, end_hour REAL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE session_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      log_year INTEGER NOT NULL, log_month INTEGER NOT NULL, log_day INTEGER NOT NULL,
      hour REAL NOT NULL, hex_id TEXT, message TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    INSERT INTO campaign_state (id) VALUES (1);
    INSERT INTO sessions (id, session_number, is_active, start_year, start_month, start_day, start_hour) VALUES (1, 1, 1, 22, 8, 22, 6);
  `);

  // Build Express app with routes, injecting our test DB.
  // We need to dynamically patch the db import used by routes.
  // Simplest approach: build routes inline using our db instance.
  app = express();
  app.use(express.json());

  // ---- Terrain routes (inline, using test db) ----
  const terrainsRouter = express.Router();

  terrainsRouter.get('/', (req, res) => {
    res.json(db.prepare('SELECT * FROM terrain_types ORDER BY name').all());
  });

  terrainsRouter.get('/:id', (req, res) => {
    const t = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Terrain not found' });
    res.json(t);
  });

  terrainsRouter.post('/', (req, res) => {
    const {
      name, travel_speed_modifier = 0, visibility_miles = 3,
      losing_direction_chance, foraging_chance, foraging_yield,
      hunting_chance, hunting_yield,
      wandering_monster_frequency = '1/day', wandering_monster_chance = '1:6',
      encounter_distance = '2d6 × 10', evasion_modifier,
      description = '', color = '#808080',
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare(`INSERT INTO terrain_types (name, travel_speed_modifier, visibility_miles, losing_direction_chance, foraging_chance, foraging_yield, hunting_chance, hunting_yield, wandering_monster_frequency, wandering_monster_chance, encounter_distance, evasion_modifier, description, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, travel_speed_modifier, visibility_miles, losing_direction_chance, foraging_chance, foraging_yield, hunting_chance, hunting_yield, wandering_monster_frequency, wandering_monster_chance, encounter_distance, evasion_modifier, description, color);
    res.status(201).json(db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(result.lastInsertRowid));
  });

  terrainsRouter.patch('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Terrain not found' });
    const fields = ['name', 'travel_speed_modifier', 'visibility_miles', 'losing_direction_chance', 'foraging_chance', 'foraging_yield', 'hunting_chance', 'hunting_yield', 'wandering_monster_frequency', 'wandering_monster_chance', 'encounter_distance', 'evasion_modifier', 'description', 'color'];
    const updates = [], values = [];
    for (const f of fields) { if (f in req.body) { updates.push(`${f} = ?`); values.push(req.body[f]); } }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    db.prepare(`UPDATE terrain_types SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json(db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(req.params.id));
  });

  terrainsRouter.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Terrain not found' });
    db.prepare('DELETE FROM terrain_types WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Encounter tables
  terrainsRouter.get('/:id/tables', (req, res) => {
    const tables = db.prepare('SELECT * FROM encounter_tables WHERE terrain_id = ? ORDER BY name').all(req.params.id);
    const getEntries = db.prepare('SELECT * FROM encounter_table_entries WHERE table_id = ? ORDER BY roll_min');
    res.json(tables.map(t => ({ ...t, entries: getEntries.all(t.id) })));
  });

  terrainsRouter.post('/:id/tables', (req, res) => {
    const terrain = db.prepare('SELECT id FROM terrain_types WHERE id = ?').get(req.params.id);
    if (!terrain) return res.status(404).json({ error: 'Terrain not found' });
    const { name, dice_expression = '2d6' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare('INSERT INTO encounter_tables (terrain_id, name, dice_expression) VALUES (?, ?, ?)').run(req.params.id, name, dice_expression);
    const table = db.prepare('SELECT * FROM encounter_tables WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...table, entries: [] });
  });

  terrainsRouter.delete('/:terrainId/tables/:tableId', (req, res) => {
    const table = db.prepare('SELECT * FROM encounter_tables WHERE id = ? AND terrain_id = ?').get(req.params.tableId, req.params.terrainId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    db.prepare('DELETE FROM encounter_tables WHERE id = ?').run(table.id);
    res.json({ success: true });
  });

  terrainsRouter.post('/:terrainId/tables/:tableId/entries', (req, res) => {
    const table = db.prepare('SELECT * FROM encounter_tables WHERE id = ? AND terrain_id = ?').get(req.params.tableId, req.params.terrainId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const { roll_min, roll_max, description, number_appearing, notes } = req.body;
    if (roll_min === undefined || roll_max === undefined || !description) return res.status(400).json({ error: 'roll_min, roll_max, and description are required' });
    const result = db.prepare('INSERT INTO encounter_table_entries (table_id, roll_min, roll_max, description, number_appearing, notes) VALUES (?, ?, ?, ?, ?, ?)').run(table.id, roll_min, roll_max, description, number_appearing || null, notes || null);
    res.status(201).json(db.prepare('SELECT * FROM encounter_table_entries WHERE id = ?').get(result.lastInsertRowid));
  });

  app.use('/api/terrains', terrainsRouter);

  // ---- Travel routes (inline, using test db + imported logic) ----
  const { rollDice, rollChance } = await import('../dice.js');
  const { calculateTravelSpeed, advanceTime, isForcedMarch, parseDirectionChance, isLost } = await import('../travel-logic.js');
  const { formatHadeanDate, getSeason, advanceDate } = await import('../calendar.js');
  const { rollWeather } = await import('../weather.js');

  const travelRouter = express.Router();

  const undoStack = [];

  function getState() { return db.prepare('SELECT * FROM campaign_state WHERE id = 1').get(); }
  function saveSnapshot() {
    const state = getState();
    const maxLog = db.prepare('SELECT MAX(id) as maxId FROM session_log').get();
    undoStack.push({ state, maxLogId: maxLog.maxId || 0 });
  }
  function updateState(fields) {
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) { updates.push(`${k} = ?`); values.push(v); }
    values.push(1);
    db.prepare(`UPDATE campaign_state SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  function getActiveSessionId() {
    return db.prepare('SELECT id FROM sessions WHERE is_active = 1').get()?.id ?? null;
  }
  function addLog(year, month, day, hour, category, message) {
    const sessionId = getActiveSessionId();
    db.prepare('INSERT INTO session_log (log_year, log_month, log_day, hour, category, message, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(year, month, day, hour, category, message, sessionId);
  }

  travelRouter.get('/state', (req, res) => {
    const state = getState();
    let terrain = null, travelSpeed = null;
    if (state.current_terrain_id) {
      terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(state.current_terrain_id);
      if (terrain) travelSpeed = calculateTravelSpeed(terrain);
    }
    res.json({ state, terrain, travelSpeed });
  });

  travelRouter.get('/can-undo', (req, res) => {
    res.json({ canUndo: undoStack.length > 0 });
  });

  travelRouter.post('/undo', (req, res) => {
    if (undoStack.length === 0) return res.status(400).json({ error: 'Nothing to undo' });
    const { state: savedState, maxLogId } = undoStack.pop();
    const fields = ['current_hex_id', 'current_terrain_id', 'hours_traveled_today', 'hexes_traveled_today', 'current_year', 'current_month', 'current_day_of_month', 'current_hour'];
    const updates = {};
    for (const f of fields) { updates[f] = savedState[f]; }
    updateState(updates);
    db.prepare('DELETE FROM session_log WHERE id > ?').run(maxLogId);
    res.json({ success: true, canUndo: undoStack.length > 0, state: getState() });
  });

  travelRouter.post('/enter-hex', (req, res) => {
    saveSnapshot();
    const { terrain_id, hex_id } = req.body;
    if (!terrain_id) return res.status(400).json({ error: 'terrain_id is required' });
    const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(terrain_id);
    if (!terrain) return res.status(404).json({ error: 'Terrain not found' });
    const state = getState();
    const travelSpeed = calculateTravelSpeed(terrain);
    const hoursToTraverse = travelSpeed.hoursPerHex;
    const timeResult = advanceTime(state, hoursToTraverse);
    updateState({ current_terrain_id: terrain_id, current_hex_id: hex_id || state.current_hex_id, ...timeResult });
    const dateStr = formatHadeanDate(timeResult.current_day_of_month, timeResult.current_month, timeResult.current_year);
    addLog(timeResult.current_year, timeResult.current_month, timeResult.current_day_of_month, timeResult.current_hour, 'travel', `Entered hex ${hex_id || '???'} (${terrain.name}). Travel time: ${hoursToTraverse.toFixed(1)} hours.`);
    const forcedMarch = isForcedMarch(timeResult.hours_traveled_today);
    res.json({
      terrain, travelSpeed, hoursToTraverse,
      timeAdvanced: {
        year: timeResult.current_year,
        month: timeResult.current_month,
        day: timeResult.current_day_of_month,
        hour: timeResult.current_hour,
        formatted: dateStr,
      },
      forcedMarch, state: getState(),
    });
  });

  travelRouter.post('/forage', (req, res) => {
    saveSnapshot();
    const state = getState();
    if (!state.current_terrain_id) return res.status(400).json({ error: 'No current terrain set' });
    const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(state.current_terrain_id);
    if (!terrain) return res.status(404).json({ error: 'Current terrain not found' });
    if (!terrain.foraging_chance) return res.json({ success: false, message: 'Foraging is not possible in this terrain.' });
    const check = rollChance(terrain.foraging_chance);
    let yield_result = null;
    if (check?.success && terrain.foraging_yield) { yield_result = rollDice(terrain.foraging_yield); }
    res.json({ check, yield: yield_result, terrain: terrain.name });
  });

  travelRouter.post('/hunt', (req, res) => {
    saveSnapshot();
    const state = getState();
    if (!state.current_terrain_id) return res.status(400).json({ error: 'No current terrain set' });
    const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(state.current_terrain_id);
    if (!terrain) return res.status(404).json({ error: 'Current terrain not found' });
    if (!terrain.hunting_chance) return res.json({ success: false, message: 'Hunting is not possible in this terrain.' });
    const check = rollChance(terrain.hunting_chance);
    let yield_result = null;
    if (check?.success && terrain.hunting_yield) { yield_result = rollDice(terrain.hunting_yield); }
    res.json({ check, yield: yield_result, terrain: terrain.name });
  });

  travelRouter.post('/direction-check', (req, res) => {
    saveSnapshot();
    const { weather_modifier = 0 } = req.body;
    const state = getState();
    if (!state.current_terrain_id) return res.status(400).json({ error: 'No current terrain set' });
    const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(state.current_terrain_id);
    if (!terrain) return res.status(404).json({ error: 'Current terrain not found' });
    if (!terrain.losing_direction_chance) return res.json({ lost: false, message: 'No chance of losing direction in this terrain.' });
    const chance = parseDirectionChance(terrain.losing_direction_chance, weather_modifier);
    if (!chance) return res.status(500).json({ error: 'Invalid chance format' });
    const roll = Math.floor(Math.random() * chance.sides) + 1;
    const lost = isLost(roll, chance);
    res.json({ lost, roll, baseTarget: chance.baseTarget, adjustedTarget: chance.adjustedTarget, sides: chance.sides, weatherModifier: weather_modifier, terrain: terrain.name });
  });

  travelRouter.post('/reset-day', (req, res) => {
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

  travelRouter.get('/log', (req, res) => {
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

  travelRouter.post('/set-state', (req, res) => {
    const allowed = ['current_hex_id', 'current_terrain_id', 'hours_traveled_today', 'hexes_traveled_today', 'current_year', 'current_month', 'current_day_of_month', 'current_hour'];
    const updates = {};
    for (const k of allowed) { if (k in req.body) updates[k] = req.body[k]; }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' });
    updateState(updates);
    res.json({ state: getState() });
  });

  travelRouter.post('/roll-weather', (req, res) => {
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

  // Encounter entries
  const entriesRouter = express.Router();
  entriesRouter.patch('/:entryId', (req, res) => {
    const entry = db.prepare('SELECT * FROM encounter_table_entries WHERE id = ?').get(req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const fields = ['roll_min', 'roll_max', 'description', 'number_appearing', 'notes'];
    const updates = [], values = [];
    for (const f of fields) { if (f in req.body) { updates.push(`${f} = ?`); values.push(req.body[f]); } }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.entryId);
    db.prepare(`UPDATE encounter_table_entries SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json(db.prepare('SELECT * FROM encounter_table_entries WHERE id = ?').get(req.params.entryId));
  });
  entriesRouter.delete('/:entryId', (req, res) => {
    const entry = db.prepare('SELECT * FROM encounter_table_entries WHERE id = ?').get(req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    db.prepare('DELETE FROM encounter_table_entries WHERE id = ?').run(req.params.entryId);
    res.json({ success: true });
  });

  // ---- Sessions routes (inline, using test db) ----
  const MONTHS = ['', 'Nikarion', 'Katharion', 'Photarion', 'Thalassion', 'Antheion', 'Melission', 'Heliarion', 'Panagion', 'Ouranion', 'Hieratarion', 'Koimarion', 'Hesperion'];
  const sessionsRouter = express.Router();

  sessionsRouter.get('/', (req, res) => {
    res.json(db.prepare('SELECT * FROM sessions ORDER BY session_number DESC').all());
  });

  sessionsRouter.get('/active', (req, res) => {
    const session = db.prepare('SELECT * FROM sessions WHERE is_active = 1').get();
    if (!session) return res.status(404).json({ error: 'No active session' });
    res.json(session);
  });

  sessionsRouter.post('/', (req, res) => {
    const state = db.prepare('SELECT * FROM campaign_state WHERE id = 1').get();
    const active = db.prepare('SELECT * FROM sessions WHERE is_active = 1').get();
    if (active) {
      db.prepare('UPDATE sessions SET is_active = 0, end_year = ?, end_month = ?, end_day = ?, end_hour = ? WHERE id = ?')
        .run(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, active.id);
    }
    const nextNumber = (active?.session_number ?? 0) + 1;
    const result = db.prepare('INSERT INTO sessions (session_number, is_active, start_year, start_month, start_day, start_hour) VALUES (?, 1, ?, ?, ?, ?)')
      .run(nextNumber, state.current_year, state.current_month, state.current_day_of_month, state.current_hour);
    res.status(201).json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid));
  });

  sessionsRouter.patch('/:id', (req, res) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const { name } = req.body;
    if (name === undefined) return res.status(400).json({ error: 'No fields to update' });
    db.prepare('UPDATE sessions SET name = ? WHERE id = ?').run(name || null, req.params.id);
    res.json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id));
  });

  sessionsRouter.delete('/:id', (req, res) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.is_active) return res.status(400).json({ error: 'Cannot delete the active session' });
    db.prepare('DELETE FROM session_notes WHERE session_id = ?').run(session.id);
    db.prepare('DELETE FROM session_log WHERE session_id = ?').run(session.id);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    res.json({ success: true });
  });

  sessionsRouter.get('/:id/notes', (req, res) => {
    res.json(db.prepare('SELECT * FROM session_notes WHERE session_id = ? ORDER BY id').all(req.params.id));
  });

  sessionsRouter.post('/:id/notes', (req, res) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });
    const state = db.prepare('SELECT * FROM campaign_state WHERE id = 1').get();
    const result = db.prepare('INSERT INTO session_notes (session_id, log_year, log_month, log_day, hour, hex_id, message) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(req.params.id, state.current_year, state.current_month, state.current_day_of_month, state.current_hour, state.current_hex_id, message.trim());
    res.status(201).json(db.prepare('SELECT * FROM session_notes WHERE id = ?').get(result.lastInsertRowid));
  });

  sessionsRouter.delete('/:id/notes/:noteId', (req, res) => {
    const note = db.prepare('SELECT * FROM session_notes WHERE id = ? AND session_id = ?').get(req.params.noteId, req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    db.prepare('DELETE FROM session_notes WHERE id = ?').run(req.params.noteId);
    res.json({ success: true });
  });

  sessionsRouter.get('/:id/export', (req, res) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const logs = db.prepare('SELECT * FROM session_log WHERE session_id = ? ORDER BY id').all(session.id);
    const notes = db.prepare('SELECT * FROM session_notes WHERE session_id = ? ORDER BY id').all(session.id);
    function fmtTime(hour) { const h = Math.floor(hour); const m = Math.round((hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
    function fmtDate(day, month, year) { return `${day} ${MONTHS[month] || '???'}, ${year} P.I.`; }
    const entries = [];
    for (const l of logs) entries.push({ type: 'log', year: l.log_year, month: l.log_month, day: l.log_day, hour: l.hour, category: l.category, message: l.message, id: l.id });
    for (const n of notes) entries.push({ type: 'note', year: n.log_year, month: n.log_month, day: n.log_day, hour: n.hour, category: 'note', message: n.message, id: n.id + 1000000 });
    entries.sort((a, b) => { const dA = a.year * 10000 + a.month * 100 + a.day; const dB = b.year * 10000 + b.month * 100 + b.day; if (dA !== dB) return dA - dB; if (a.hour !== b.hour) return a.hour - b.hour; return a.id - b.id; });
    const startDate = fmtDate(session.start_day, session.start_month, session.start_year);
    let endDate; if (session.end_year != null) { endDate = fmtDate(session.end_day, session.end_month, session.end_year); } else { const last = entries[entries.length - 1]; endDate = last ? fmtDate(last.day, last.month, last.year) : startDate; }
    const title = session.name || `Session ${session.session_number}`;
    let md = `# ${title} — Forbidden North\n\n**Date range:** ${startDate} — ${endDate}\n\n---\n`;
    let currentDayKey = '';
    for (const e of entries) { const dk = `${e.day}-${e.month}-${e.year}`; if (dk !== currentDayKey) { currentDayKey = dk; md += `\n### ${fmtDate(e.day, e.month, e.year)}\n\n`; } md += `- **${fmtTime(e.hour)}** [${e.category}] ${e.message}\n`; }
    if (entries.length === 0) md += '\n*No log entries or notes for this session.*\n';
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="session-${session.session_number}.md"`);
    res.send(md);
  });

  app.use('/api/sessions', sessionsRouter);
  app.use('/api/travel', travelRouter);
  app.use('/api/encounter-entries', entriesRouter);

  return new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
}

async function apiCall(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function apiCallText(path) {
  const res = await fetch(`${baseUrl}${path}`);
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

function resetDb() {
  db.exec('DELETE FROM session_notes');
  db.exec('DELETE FROM session_log');
  db.exec('DELETE FROM encounter_table_entries');
  db.exec('DELETE FROM encounter_tables');
  db.exec('DELETE FROM terrain_types');
  db.exec('DELETE FROM sessions');
  db.exec('UPDATE campaign_state SET current_hex_id = NULL, current_terrain_id = NULL, hours_traveled_today = 0, hexes_traveled_today = 0, current_year = 22, current_month = 8, current_day_of_month = 22, current_hour = 6');
  db.exec("INSERT INTO sessions (id, session_number, is_active, start_year, start_month, start_day, start_hour) VALUES (1, 1, 1, 22, 8, 22, 6)");
}

function seedTestTerrain() {
  db.prepare(`INSERT INTO terrain_types (id, name, travel_speed_modifier, visibility_miles, losing_direction_chance, foraging_chance, foraging_yield, hunting_chance, hunting_yield, wandering_monster_frequency, wandering_monster_chance, encounter_distance, description, color) VALUES (1, 'Road', 0.5, 3, NULL, '2:6', '2d4', '2:6', '4d6', '1/day', '3:6', '4d6 × 10', 'A road.', '#8B7355')`).run();
  db.prepare(`INSERT INTO terrain_types (id, name, travel_speed_modifier, visibility_miles, losing_direction_chance, foraging_chance, foraging_yield, hunting_chance, hunting_yield, wandering_monster_frequency, wandering_monster_chance, encounter_distance, description, color) VALUES (2, 'Forest', -0.33, 1, '2:6', '2:6', '2d4', '2:6', '3d6', '2/day', '2:6', '2d6 × 10', 'A forest.', '#4A7C59')`).run();
}

before(async () => {
  await setupTestApp();
});

after(() => {
  server?.close();
  db?.close();
});

// ============================================================
// TERRAIN CRUD
// ============================================================
describe('Terrain CRUD API', () => {
  beforeEach(() => { resetDb(); });

  it('GET /api/terrains returns empty array initially', async () => {
    const { status, data } = await apiCall('/api/terrains');
    assert.equal(status, 200);
    assert.deepEqual(data, []);
  });

  it('POST /api/terrains creates a terrain', async () => {
    const { status, data } = await apiCall('/api/terrains', {
      method: 'POST',
      body: { name: 'Plains', travel_speed_modifier: 0, color: '#90B860' },
    });
    assert.equal(status, 201);
    assert.equal(data.name, 'Plains');
    assert.equal(data.travel_speed_modifier, 0);
    assert.equal(data.color, '#90B860');
    assert.ok(data.id);
  });

  it('POST /api/terrains rejects missing name', async () => {
    const { status, data } = await apiCall('/api/terrains', {
      method: 'POST',
      body: { travel_speed_modifier: 0 },
    });
    assert.equal(status, 400);
    assert.equal(data.error, 'Name is required');
  });

  it('POST /api/terrains applies defaults', async () => {
    const { data } = await apiCall('/api/terrains', { method: 'POST', body: { name: 'Test' } });
    assert.equal(data.travel_speed_modifier, 0);
    assert.equal(data.visibility_miles, 3);
    assert.equal(data.wandering_monster_frequency, '1/day');
    assert.equal(data.wandering_monster_chance, '1:6');
    assert.equal(data.color, '#808080');
  });

  it('GET /api/terrains/:id returns a terrain', async () => {
    const { data: created } = await apiCall('/api/terrains', { method: 'POST', body: { name: 'Test' } });
    const { status, data } = await apiCall(`/api/terrains/${created.id}`);
    assert.equal(status, 200);
    assert.equal(data.name, 'Test');
  });

  it('GET /api/terrains/:id returns 404 for nonexistent', async () => {
    const { status } = await apiCall('/api/terrains/999');
    assert.equal(status, 404);
  });

  it('PATCH /api/terrains/:id updates fields', async () => {
    const { data: created } = await apiCall('/api/terrains', { method: 'POST', body: { name: 'Old' } });
    const { status, data } = await apiCall(`/api/terrains/${created.id}`, {
      method: 'PATCH',
      body: { name: 'New', travel_speed_modifier: -0.5 },
    });
    assert.equal(status, 200);
    assert.equal(data.name, 'New');
    assert.equal(data.travel_speed_modifier, -0.5);
  });

  it('PATCH /api/terrains/:id returns 404 for nonexistent', async () => {
    const { status } = await apiCall('/api/terrains/999', { method: 'PATCH', body: { name: 'X' } });
    assert.equal(status, 404);
  });

  it('PATCH /api/terrains/:id rejects empty body', async () => {
    const { data: created } = await apiCall('/api/terrains', { method: 'POST', body: { name: 'T' } });
    const { status } = await apiCall(`/api/terrains/${created.id}`, { method: 'PATCH', body: {} });
    assert.equal(status, 400);
  });

  it('DELETE /api/terrains/:id deletes', async () => {
    const { data: created } = await apiCall('/api/terrains', { method: 'POST', body: { name: 'T' } });
    const { status } = await apiCall(`/api/terrains/${created.id}`, { method: 'DELETE' });
    assert.equal(status, 200);
    const { status: getStatus } = await apiCall(`/api/terrains/${created.id}`);
    assert.equal(getStatus, 404);
  });

  it('DELETE /api/terrains/:id returns 404 for nonexistent', async () => {
    const { status } = await apiCall('/api/terrains/999', { method: 'DELETE' });
    assert.equal(status, 404);
  });

  it('GET /api/terrains returns sorted by name', async () => {
    await apiCall('/api/terrains', { method: 'POST', body: { name: 'Zebra' } });
    await apiCall('/api/terrains', { method: 'POST', body: { name: 'Alpha' } });
    await apiCall('/api/terrains', { method: 'POST', body: { name: 'Middle' } });
    const { data } = await apiCall('/api/terrains');
    assert.deepEqual(data.map(t => t.name), ['Alpha', 'Middle', 'Zebra']);
  });
});

// ============================================================
// ENCOUNTER TABLE CRUD
// ============================================================
describe('Encounter Table CRUD API', () => {
  beforeEach(() => { resetDb(); seedTestTerrain(); });

  it('GET /api/terrains/1/tables returns empty initially', async () => {
    const { data } = await apiCall('/api/terrains/1/tables');
    assert.deepEqual(data, []);
  });

  it('POST /api/terrains/1/tables creates a table', async () => {
    const { status, data } = await apiCall('/api/terrains/1/tables', {
      method: 'POST', body: { name: 'Day Encounters', dice_expression: '2d6' },
    });
    assert.equal(status, 201);
    assert.equal(data.name, 'Day Encounters');
    assert.equal(data.dice_expression, '2d6');
    assert.equal(data.terrain_id, 1);
    assert.deepEqual(data.entries, []);
  });

  it('POST rejects missing name', async () => {
    const { status } = await apiCall('/api/terrains/1/tables', { method: 'POST', body: {} });
    assert.equal(status, 400);
  });

  it('POST returns 404 for nonexistent terrain', async () => {
    const { status } = await apiCall('/api/terrains/999/tables', { method: 'POST', body: { name: 'X' } });
    assert.equal(status, 404);
  });

  it('DELETE removes table', async () => {
    const { data: table } = await apiCall('/api/terrains/1/tables', { method: 'POST', body: { name: 'T' } });
    const { status } = await apiCall(`/api/terrains/1/tables/${table.id}`, { method: 'DELETE' });
    assert.equal(status, 200);
    const { data: tables } = await apiCall('/api/terrains/1/tables');
    assert.equal(tables.length, 0);
  });

  it('entries are returned nested within tables', async () => {
    const { data: table } = await apiCall('/api/terrains/1/tables', { method: 'POST', body: { name: 'T', dice_expression: '1d6' } });
    await apiCall(`/api/terrains/1/tables/${table.id}/entries`, {
      method: 'POST', body: { roll_min: 1, roll_max: 3, description: 'Wolves' },
    });
    await apiCall(`/api/terrains/1/tables/${table.id}/entries`, {
      method: 'POST', body: { roll_min: 4, roll_max: 6, description: 'Bears' },
    });
    const { data: tables } = await apiCall('/api/terrains/1/tables');
    assert.equal(tables[0].entries.length, 2);
    assert.equal(tables[0].entries[0].description, 'Wolves');
    assert.equal(tables[0].entries[1].description, 'Bears');
  });

  it('cascade delete removes entries when table is deleted', async () => {
    const { data: table } = await apiCall('/api/terrains/1/tables', { method: 'POST', body: { name: 'T' } });
    await apiCall(`/api/terrains/1/tables/${table.id}/entries`, {
      method: 'POST', body: { roll_min: 1, roll_max: 6, description: 'Goblins' },
    });
    await apiCall(`/api/terrains/1/tables/${table.id}`, { method: 'DELETE' });
    const count = db.prepare('SELECT COUNT(*) as count FROM encounter_table_entries').get();
    assert.equal(count.count, 0);
  });
});

// ============================================================
// ENCOUNTER ENTRY CRUD
// ============================================================
describe('Encounter Entry CRUD API', () => {
  let tableId;

  beforeEach(async () => {
    resetDb();
    seedTestTerrain();
    const { data } = await apiCall('/api/terrains/1/tables', { method: 'POST', body: { name: 'T', dice_expression: '1d6' } });
    tableId = data.id;
  });

  it('POST creates entry with all fields', async () => {
    const { status, data } = await apiCall(`/api/terrains/1/tables/${tableId}/entries`, {
      method: 'POST', body: { roll_min: 1, roll_max: 2, description: 'Wolves', number_appearing: '2d4', notes: 'Hostile' },
    });
    assert.equal(status, 201);
    assert.equal(data.roll_min, 1);
    assert.equal(data.roll_max, 2);
    assert.equal(data.description, 'Wolves');
    assert.equal(data.number_appearing, '2d4');
    assert.equal(data.notes, 'Hostile');
  });

  it('POST rejects missing required fields', async () => {
    const { status } = await apiCall(`/api/terrains/1/tables/${tableId}/entries`, {
      method: 'POST', body: { roll_min: 1 },
    });
    assert.equal(status, 400);
  });

  it('PATCH updates entry fields', async () => {
    const { data: entry } = await apiCall(`/api/terrains/1/tables/${tableId}/entries`, {
      method: 'POST', body: { roll_min: 1, roll_max: 1, description: 'Old' },
    });
    const { status, data } = await apiCall(`/api/encounter-entries/${entry.id}`, {
      method: 'PATCH', body: { description: 'New', notes: 'Updated' },
    });
    assert.equal(status, 200);
    assert.equal(data.description, 'New');
    assert.equal(data.notes, 'Updated');
  });

  it('PATCH returns 404 for nonexistent entry', async () => {
    const { status } = await apiCall('/api/encounter-entries/999', { method: 'PATCH', body: { description: 'X' } });
    assert.equal(status, 404);
  });

  it('DELETE removes entry', async () => {
    const { data: entry } = await apiCall(`/api/terrains/1/tables/${tableId}/entries`, {
      method: 'POST', body: { roll_min: 1, roll_max: 1, description: 'X' },
    });
    const { status } = await apiCall(`/api/encounter-entries/${entry.id}`, { method: 'DELETE' });
    assert.equal(status, 200);
    const { data: tables } = await apiCall('/api/terrains/1/tables');
    assert.equal(tables[0].entries.length, 0);
  });
});

// ============================================================
// TRAVEL STATE & ENTER HEX
// ============================================================
describe('Travel API', () => {
  beforeEach(() => { resetDb(); seedTestTerrain(); });

  it('GET /api/travel/state returns initial state', async () => {
    const { data } = await apiCall('/api/travel/state');
    assert.equal(data.state.current_year, 22);
    assert.equal(data.state.current_month, 8);
    assert.equal(data.state.current_day_of_month, 22);
    assert.equal(data.state.current_hour, 6);
    assert.equal(data.state.hours_traveled_today, 0);
    assert.equal(data.state.hexes_traveled_today, 0);
    assert.equal(data.terrain, null);
    assert.equal(data.travelSpeed, null);
  });

  it('POST /api/travel/enter-hex advances time correctly for road', async () => {
    const { data } = await apiCall('/api/travel/enter-hex', {
      method: 'POST', body: { terrain_id: 1, hex_id: '0101' },
    });
    // Road: 36 mi/day, 6 hex/day, 1.33 hrs/hex
    assert.equal(data.travelSpeed.milesPerDay, 36);
    assert.equal(data.hoursToTraverse, 1.33);
    assert.equal(data.timeAdvanced.day, 22);
    assert.equal(data.timeAdvanced.hour, 7.33);
    assert.equal(data.state.current_hex_id, '0101');
    assert.equal(data.state.current_terrain_id, 1);
    assert.equal(data.state.hexes_traveled_today, 1);
  });

  it('POST /api/travel/enter-hex advances time for forest', async () => {
    const { data } = await apiCall('/api/travel/enter-hex', {
      method: 'POST', body: { terrain_id: 2, hex_id: '0202' },
    });
    // Forest: 16.08 mi/day, 2.68 hex/day, 2.99 hrs/hex
    assert.equal(data.travelSpeed.milesPerDay, 16.08);
    assert.equal(data.hoursToTraverse, 2.99);
    assert.equal(data.timeAdvanced.hour, 8.99);
  });

  it('POST /api/travel/enter-hex accumulates hexes', async () => {
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1, hex_id: '0101' } });
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1, hex_id: '0102' } });
    const { data } = await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1, hex_id: '0103' } });
    assert.equal(data.state.hexes_traveled_today, 3);
    assert.equal(data.state.hours_traveled_today, 3.99);
  });

  it('POST /api/travel/enter-hex detects forced march', async () => {
    // Travel 7 road hexes = 7 * 1.33 = 9.31 hours > 8
    for (let i = 1; i <= 6; i++) {
      await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    }
    const { data } = await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    assert.equal(data.forcedMarch, true);
  });

  it('POST /api/travel/enter-hex not forced march within 8 hrs', async () => {
    // 6 road hexes = 6 * 1.33 = 7.98 hours <= 8
    for (let i = 1; i <= 5; i++) {
      await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    }
    const { data } = await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    assert.equal(data.forcedMarch, false);
  });

  it('POST /api/travel/enter-hex requires terrain_id', async () => {
    const { status } = await apiCall('/api/travel/enter-hex', { method: 'POST', body: {} });
    assert.equal(status, 400);
  });

  it('POST /api/travel/enter-hex returns 404 for bad terrain', async () => {
    const { status } = await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 999 } });
    assert.equal(status, 404);
  });

  it('POST /api/travel/enter-hex does not include wandering monster check', async () => {
    const { data } = await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    assert.equal(data.wanderingMonsterCheck, undefined);
    assert.equal(data.wanderingMonsterResult, undefined);
  });

  it('POST /api/travel/enter-hex includes formatted date', async () => {
    const { data } = await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    assert.ok(data.timeAdvanced.formatted.includes('Panagion'));
    assert.ok(data.timeAdvanced.formatted.includes('22 P.I.'));
  });
});

// ============================================================
// FORAGE & HUNT
// ============================================================
describe('Forage & Hunt API', () => {
  beforeEach(async () => {
    resetDb();
    seedTestTerrain();
    // Set terrain to Road (has foraging and hunting)
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
  });

  it('POST /api/travel/forage returns check result', async () => {
    const { data } = await apiCall('/api/travel/forage', { method: 'POST', body: {} });
    assert.ok(data.check);
    assert.equal(data.check.expression, '2:6');
    assert.equal(data.terrain, 'Road');
  });

  it('POST /api/travel/hunt returns check result', async () => {
    const { data } = await apiCall('/api/travel/hunt', { method: 'POST', body: {} });
    assert.ok(data.check);
    assert.equal(data.check.expression, '2:6');
    assert.equal(data.terrain, 'Road');
  });

  it('forage fails when no terrain is set', async () => {
    resetDb();
    const { status } = await apiCall('/api/travel/forage', { method: 'POST', body: {} });
    assert.equal(status, 400);
  });

  it('hunt fails when no terrain is set', async () => {
    resetDb();
    const { status } = await apiCall('/api/travel/hunt', { method: 'POST', body: {} });
    assert.equal(status, 400);
  });

  it('forage yield is returned on success', async () => {
    // Run many times, at least one should succeed (2:6 = 33% chance)
    let gotYield = false;
    for (let i = 0; i < 30; i++) {
      const { data } = await apiCall('/api/travel/forage', { method: 'POST', body: {} });
      if (data.check.success) {
        assert.ok(data.yield, 'yield should be present on success');
        assert.ok(data.yield.total > 0, 'yield total should be positive');
        gotYield = true;
        break;
      }
    }
    assert.ok(gotYield, 'Should have gotten at least one successful forage in 30 tries');
  });
});

// ============================================================
// DIRECTION CHECK
// ============================================================
describe('Direction Check API', () => {
  beforeEach(async () => {
    resetDb();
    seedTestTerrain();
  });

  it('returns no-chance message for terrain without losing_direction_chance', async () => {
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } }); // Road = null
    const { data } = await apiCall('/api/travel/direction-check', { method: 'POST', body: {} });
    assert.equal(data.lost, false);
    assert.ok(data.message.includes('No chance'));
  });

  it('returns roll result for terrain with losing_direction_chance', async () => {
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 2 } }); // Forest = 2:6
    const { data } = await apiCall('/api/travel/direction-check', { method: 'POST', body: {} });
    assert.ok('lost' in data);
    assert.ok('roll' in data);
    assert.equal(data.baseTarget, 2);
    assert.equal(data.adjustedTarget, 2);
    assert.equal(data.sides, 6);
    assert.equal(data.weatherModifier, 0);
  });

  it('applies weather modifier', async () => {
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 2 } });
    const { data } = await apiCall('/api/travel/direction-check', { method: 'POST', body: { weather_modifier: 2 } });
    assert.equal(data.baseTarget, 2);
    assert.equal(data.adjustedTarget, 4);
    assert.equal(data.weatherModifier, 2);
  });
});

// ============================================================
// TRAVEL STATE MANAGEMENT
// ============================================================
describe('Travel State Management API', () => {
  beforeEach(() => { resetDb(); seedTestTerrain(); });

  it('POST /api/travel/reset-day advances day and resets counters', async () => {
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    const { data } = await apiCall('/api/travel/reset-day', { method: 'POST', body: {} });
    assert.equal(data.state.hours_traveled_today, 0);
    assert.equal(data.state.hexes_traveled_today, 0);
    assert.equal(data.state.current_day_of_month, 23);
    assert.equal(data.state.current_month, 8);
    assert.equal(data.state.current_year, 22);
    assert.equal(data.state.current_hour, 6);
  });

  it('POST /api/travel/reset-day creates a log entry', async () => {
    await apiCall('/api/travel/reset-day', { method: 'POST', body: {} });
    const { data: logs } = await apiCall('/api/travel/log');
    assert.ok(logs.some(l => l.message.includes('New day begins')));
  });

  it('POST /api/travel/set-state updates allowed fields', async () => {
    const { data } = await apiCall('/api/travel/set-state', {
      method: 'POST', body: { current_year: 23, current_month: 1, current_day_of_month: 5, current_hour: 12, current_hex_id: '0505' },
    });
    assert.equal(data.state.current_year, 23);
    assert.equal(data.state.current_month, 1);
    assert.equal(data.state.current_day_of_month, 5);
    assert.equal(data.state.current_hour, 12);
    assert.equal(data.state.current_hex_id, '0505');
  });

  it('POST /api/travel/set-state rejects empty body', async () => {
    const { status } = await apiCall('/api/travel/set-state', { method: 'POST', body: {} });
    assert.equal(status, 400);
  });
});

// ============================================================
// WEATHER
// ============================================================
describe('Weather API', () => {
  beforeEach(() => { resetDb(); seedTestTerrain(); });

  it('POST /api/travel/roll-weather returns weather data', async () => {
    const { data } = await apiCall('/api/travel/roll-weather', { method: 'POST', body: {} });
    assert.ok(data.weather);
    assert.ok(data.weather.weather);
    assert.ok(data.weather.air);
    assert.ok(data.weather.dayTemp);
    assert.ok(data.weather.nightTemp);
    assert.equal(data.weather.season, 'summer'); // month 8 = summer
    assert.ok(data.weather.roll >= 1 && data.weather.roll <= 12);
  });

  it('POST /api/travel/roll-weather creates log entry', async () => {
    await apiCall('/api/travel/roll-weather', { method: 'POST', body: {} });
    const { data: logs } = await apiCall('/api/travel/log');
    assert.ok(logs.some(l => l.category === 'weather'));
  });
});

// ============================================================
// SESSION LOG
// ============================================================
describe('Session Log API', () => {
  beforeEach(async () => {
    resetDb();
    seedTestTerrain();
  });

  it('GET /api/travel/log returns empty initially', async () => {
    const { data } = await apiCall('/api/travel/log');
    assert.deepEqual(data, []);
  });

  it('entering a hex creates log entries', async () => {
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1, hex_id: '0101' } });
    const { data } = await apiCall('/api/travel/log');
    assert.ok(data.length >= 1);
    assert.ok(data.some(l => l.category === 'travel'));
    assert.ok(data.some(l => l.message.includes('0101')));
  });

  it('log respects limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    }
    const { data } = await apiCall('/api/travel/log?limit=3');
    assert.ok(data.length <= 3);
  });

  it('log entries are ordered chronologically', async () => {
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    const { data } = await apiCall('/api/travel/log');
    for (let i = 1; i < data.length; i++) {
      assert.ok(data[i].id > data[i - 1].id, 'Log entries should be in chronological order');
    }
  });

  it('log entries have Hadean date fields', async () => {
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1 } });
    const { data } = await apiCall('/api/travel/log');
    assert.ok(data.length > 0);
    assert.equal(data[0].log_year, 22);
    assert.equal(data[0].log_month, 8);
    assert.equal(data[0].log_day, 22);
  });
});

// ============================================================
// SESSIONS API
// ============================================================
describe('Sessions API', () => {
  beforeEach(() => { resetDb(); seedTestTerrain(); });

  it('initial state has session 1 active', async () => {
    const { status, data } = await apiCall('/api/sessions/active');
    assert.equal(status, 200);
    assert.equal(data.session_number, 1);
    assert.equal(data.is_active, 1);
  });

  it('GET /api/sessions lists all sessions', async () => {
    const { data } = await apiCall('/api/sessions');
    assert.equal(data.length, 1);
    assert.equal(data[0].session_number, 1);
  });

  it('creating new session deactivates old and increments number', async () => {
    const { status, data: newSession } = await apiCall('/api/sessions', { method: 'POST', body: {} });
    assert.equal(status, 201);
    assert.equal(newSession.session_number, 2);
    assert.equal(newSession.is_active, 1);

    // Old session is deactivated
    const { data: allSessions } = await apiCall('/api/sessions');
    assert.equal(allSessions.length, 2);
    const old = allSessions.find(s => s.session_number === 1);
    assert.equal(old.is_active, 0);
    assert.ok(old.end_year != null);
  });

  it('notes are created with correct date fields', async () => {
    const { data: active } = await apiCall('/api/sessions/active');
    const { status, data: note } = await apiCall(`/api/sessions/${active.id}/notes`, {
      method: 'POST', body: { message: 'Party rests at camp.' },
    });
    assert.equal(status, 201);
    assert.equal(note.message, 'Party rests at camp.');
    assert.equal(note.log_year, 22);
    assert.equal(note.log_month, 8);
    assert.equal(note.log_day, 22);
    assert.equal(note.hour, 6);
    assert.equal(note.session_id, active.id);
  });

  it('notes can be deleted', async () => {
    const { data: active } = await apiCall('/api/sessions/active');
    const { data: note } = await apiCall(`/api/sessions/${active.id}/notes`, {
      method: 'POST', body: { message: 'Delete me.' },
    });
    const { status } = await apiCall(`/api/sessions/${active.id}/notes/${note.id}`, { method: 'DELETE' });
    assert.equal(status, 200);
    const { data: notes } = await apiCall(`/api/sessions/${active.id}/notes`);
    assert.equal(notes.length, 0);
  });

  it('notes reject empty message', async () => {
    const { data: active } = await apiCall('/api/sessions/active');
    const { status } = await apiCall(`/api/sessions/${active.id}/notes`, {
      method: 'POST', body: { message: '' },
    });
    assert.equal(status, 400);
  });

  it('logs filter by session_id', async () => {
    // Create log in session 1
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1, hex_id: '0101' } });

    // Create session 2
    const { data: s2 } = await apiCall('/api/sessions', { method: 'POST', body: {} });

    // Create log in session 2
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1, hex_id: '0202' } });

    // Session 1 logs should only have hex 0101
    const { data: s1Logs } = await apiCall('/api/travel/log?session_id=1');
    assert.ok(s1Logs.some(l => l.message.includes('0101')));
    assert.ok(!s1Logs.some(l => l.message.includes('0202')));

    // Session 2 logs should only have hex 0202
    const { data: s2Logs } = await apiCall(`/api/travel/log?session_id=${s2.id}`);
    assert.ok(s2Logs.some(l => l.message.includes('0202')));
    assert.ok(!s2Logs.some(l => l.message.includes('0101')));
  });

  it('export returns markdown', async () => {
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1, hex_id: '0101' } });
    const { data: active } = await apiCall('/api/sessions/active');
    const { status, text, headers } = await apiCallText(`/api/sessions/${active.id}/export`);
    assert.equal(status, 200);
    assert.ok(headers.get('content-type').includes('text/markdown'));
    assert.ok(text.includes('# Session 1'));
    assert.ok(text.includes('Forbidden North'));
    assert.ok(text.includes('0101'));
    assert.ok(text.includes('Panagion'));
  });

  it('export includes notes', async () => {
    const { data: active } = await apiCall('/api/sessions/active');
    await apiCall(`/api/sessions/${active.id}/notes`, {
      method: 'POST', body: { message: 'Important note here.' },
    });
    const { text } = await apiCallText(`/api/sessions/${active.id}/export`);
    assert.ok(text.includes('Important note here.'));
    assert.ok(text.includes('[note]'));
  });

  it('PATCH renames a session', async () => {
    const { data: active } = await apiCall('/api/sessions/active');
    const { status, data } = await apiCall(`/api/sessions/${active.id}`, {
      method: 'PATCH', body: { name: 'The Frozen March' },
    });
    assert.equal(status, 200);
    assert.equal(data.name, 'The Frozen March');
  });

  it('PATCH clears name when set to empty', async () => {
    const { data: active } = await apiCall('/api/sessions/active');
    await apiCall(`/api/sessions/${active.id}`, { method: 'PATCH', body: { name: 'Temp' } });
    const { data } = await apiCall(`/api/sessions/${active.id}`, { method: 'PATCH', body: { name: '' } });
    assert.equal(data.name, null);
  });

  it('export uses session name in title when set', async () => {
    const { data: active } = await apiCall('/api/sessions/active');
    await apiCall(`/api/sessions/${active.id}`, { method: 'PATCH', body: { name: 'Journey North' } });
    const { text } = await apiCallText(`/api/sessions/${active.id}/export`);
    assert.ok(text.includes('# Journey North'));
  });

  it('DELETE removes an inactive session and its data', async () => {
    // Create a log in session 1
    await apiCall('/api/travel/enter-hex', { method: 'POST', body: { terrain_id: 1, hex_id: '0101' } });
    const { data: active } = await apiCall('/api/sessions/active');
    await apiCall(`/api/sessions/${active.id}/notes`, { method: 'POST', body: { message: 'Test note' } });

    // Create session 2 (deactivates session 1)
    await apiCall('/api/sessions', { method: 'POST', body: {} });

    // Delete session 1
    const { status } = await apiCall(`/api/sessions/${active.id}`, { method: 'DELETE' });
    assert.equal(status, 200);

    // Verify it's gone
    const { data: allSessions } = await apiCall('/api/sessions');
    assert.ok(!allSessions.some(s => s.id === active.id));

    // Verify logs for session 1 are gone
    const { data: s1Logs } = await apiCall(`/api/travel/log?session_id=${active.id}`);
    assert.equal(s1Logs.length, 0);
  });

  it('DELETE rejects deleting the active session', async () => {
    const { data: active } = await apiCall('/api/sessions/active');
    const { status, data } = await apiCall(`/api/sessions/${active.id}`, { method: 'DELETE' });
    assert.equal(status, 400);
    assert.ok(data.error.includes('active'));
  });
});
