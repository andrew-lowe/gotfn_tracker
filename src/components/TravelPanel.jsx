import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TerrainCard from './TerrainCard';
import { useCalendar } from '../CalendarContext';
import * as api from '../api';

function formatTime(hour) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calculateTravelSpeed(modifier, movementRate = 120) {
  const baseMilesPerDay = movementRate / 5;
  const effectiveSpeed = baseMilesPerDay * (1 + (modifier || 0));
  const hexesPerDay = effectiveSpeed / 6;
  const hoursPerHex = 8 / hexesPerDay;
  return {
    milesPerDay: Math.round(effectiveSpeed * 100) / 100,
    hexesPerDay: Math.round(hexesPerDay * 100) / 100,
    hoursPerHex: Math.round(hoursPerHex * 100) / 100,
  };
}

const WEATHER_EFFECTS = {
  Clear: null,
  Clouds: null,
  Fog: 'Visibility reduced to encounter distance. Missiles \u20131. Losing direction +1 on d6.',
  Rain: 'Visibility reduced to encounter distance. Travellers get wet.',
  Snow: 'Visibility reduced to encounter distance.',
  Storm: 'Visibility \u00bd encounter distance. Losing direction +1 on d6. Travellers get wet.',
  Blizzard: 'Visibility \u00bd encounter distance. Losing direction +1 on d6.',
};

const AIR_EFFECTS = {
  Calm: null,
  Breeze: 'Missiles \u20131 penalty.',
  Wind: 'Missiles \u20132 penalty.',
  Gale: 'Missiles \u20133 penalty. Cannot fire at long range.',
};

const TEMP_SCALE = ['Mild', 'Cold', 'Very Cold', 'Severe', 'Extreme'];

const TEMP_INFO = {
  Mild:      { range: '33\u201365\u00b0F', hypoFreq: null },
  Cold:      { range: '15\u201332\u00b0F', hypoFreq: '1/day' },
  'Very Cold': { range: '0\u201314\u00b0F', hypoFreq: '1/hour' },
  Severe:    { range: '\u201315 to \u20131\u00b0F', hypoFreq: '1/turn' },
  Extreme:   { range: '\u201316\u00b0F or colder', hypoFreq: '1/minute' },
};

const CLIMATE_ZONES = {
  boreal:  { label: 'Boreal',  tempShift: 0, hypoMod: 0 },
  tundra:  { label: 'Tundra',  tempShift: 1, hypoMod: -2 },
  polar:   { label: 'Polar',   tempShift: 2, hypoMod: -4 },
};

function adjustTemp(temp, shift) {
  const idx = TEMP_SCALE.indexOf(temp);
  if (idx === -1) return temp;
  const adjusted = Math.min(idx + shift, TEMP_SCALE.length - 1);
  return TEMP_SCALE[adjusted];
}

export default function TravelPanel() {
  const { months: HADEAN_MONTHS, formatDate, getDaysForMonth, monthCount } = useCalendar();
  const [state, setState] = useState(null);
  const [terrain, setTerrain] = useState(null);
  const [travelSpeed, setTravelSpeed] = useState(null);
  const [terrains, setTerrains] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedTerrainId, setSelectedTerrainId] = useState('');
  const [hexId, setHexId] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [editingState, setEditingState] = useState(false);
  const [editYear, setEditYear] = useState('');
  const [editMonth, setEditMonth] = useState('');
  const [editDayOfMonth, setEditDayOfMonth] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMinute, setEditMinute] = useState('');
  const [weatherResult, setWeatherResult] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [viewingSessionId, setViewingSessionId] = useState(null);
  const [sessionNotes, setSessionNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [climateZone, setClimateZone] = useState('boreal');
  const [clothingMod, setClothingMod] = useState('');
  const [coldGearItems, setColdGearItems] = useState([]);
  const [showAddGear, setShowAddGear] = useState(false);
  const [newGearName, setNewGearName] = useState('');
  const [newGearShift, setNewGearShift] = useState(0);
  const [newGearNegates, setNewGearNegates] = useState(false);

  const loadState = useCallback(async () => {
    try {
      const data = await api.getTravelState();
      setState(data.state);
      setTerrain(data.terrain);
      setTravelSpeed(data.travelSpeed);
      if (data.state?.current_terrain_id) {
        setSelectedTerrainId(String(data.state.current_terrain_id));
      }
      if (data.state?.current_hex_id) {
        setHexId(data.state.current_hex_id);
      }
    } catch (e) {
      console.error('Failed to load travel state:', e);
    }
  }, []);

  const loadTerrains = useCallback(async () => {
    try {
      setTerrains(await api.getTerrains());
    } catch (e) {
      console.error('Failed to load terrains:', e);
    }
  }, []);

  const loadLogs = useCallback(async (sessionId) => {
    try {
      const sid = sessionId || viewingSessionId;
      if (sid) {
        setLogs(await api.getSessionLogs(sid));
      } else {
        setLogs(await api.getTravelLog(100));
      }
    } catch (e) {
      console.error('Failed to load logs:', e);
    }
  }, [viewingSessionId]);

  const loadSessions = useCallback(async () => {
    try {
      const [allSessions, active] = await Promise.all([
        api.getSessions(),
        api.getActiveSession(),
      ]);
      setSessions(allSessions);
      setActiveSession(active);
      if (!viewingSessionId) {
        setViewingSessionId(active.id);
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }, [viewingSessionId]);

  const loadNotes = useCallback(async (sessionId) => {
    try {
      const sid = sessionId || viewingSessionId;
      if (sid) {
        setSessionNotes(await api.getSessionNotes(sid));
      }
    } catch (e) {
      console.error('Failed to load notes:', e);
    }
  }, [viewingSessionId]);

  const loadColdGear = useCallback(async () => {
    try {
      const items = await api.getColdGear();
      setColdGearItems(items);
      if (items.length > 0 && !clothingMod) {
        setClothingMod(String(items[0].id));
      }
    } catch (e) {
      console.error('Failed to load cold gear:', e);
    }
  }, []);

  useEffect(() => {
    loadState();
    loadTerrains();
    loadSessions();
    loadColdGear();
  }, [loadState, loadTerrains, loadSessions, loadColdGear]);

  useEffect(() => {
    if (viewingSessionId) {
      loadLogs(viewingSessionId);
      loadNotes(viewingSessionId);
    }
  }, [viewingSessionId, loadLogs, loadNotes]);

  const handleUndo = async () => {
    try {
      const result = await api.undo();
      setCanUndo(result.canUndo);
      setLastResult(null);
      setWeatherResult(null);
      await loadState();
      await loadLogs();
    } catch (e) {
      setLastResult({ type: 'error', data: { message: e.message } });
    }
  };

  const handleEnterHex = async () => {
    if (!selectedTerrainId) return;
    try {
      const result = await api.enterHex({
        terrain_id: parseInt(selectedTerrainId, 10),
        hex_id: hexId || undefined,
      });
      setLastResult({ type: 'enter-hex', data: result });
      setCanUndo(true);
      await loadState();
      await loadLogs();
    } catch (e) {
      setLastResult({ type: 'error', data: { message: e.message } });
    }
  };

  const selectedTerrain = useMemo(() => {
    if (!selectedTerrainId) return null;
    return terrains.find(t => String(t.id) === selectedTerrainId) || null;
  }, [selectedTerrainId, terrains]);

  const handleWanderCheck = async () => {
    if (!selectedTerrainId) return;
    try {
      const result = await api.wanderCheck(parseInt(selectedTerrainId, 10));
      setLastResult({ type: 'wander-check', data: result });
      setCanUndo(true);
      await loadLogs();
    } catch (e) {
      setLastResult({ type: 'error', data: { message: e.message } });
    }
  };

  const handleForage = async () => {
    if (!selectedTerrainId) return;
    try {
      const result = await api.forage(parseInt(selectedTerrainId, 10));
      setLastResult({ type: 'forage', data: result });
      setCanUndo(true);
      await loadLogs();
    } catch (e) {
      setLastResult({ type: 'error', data: { message: e.message } });
    }
  };

  const handleHunt = async () => {
    if (!selectedTerrainId) return;
    try {
      const result = await api.hunt(parseInt(selectedTerrainId, 10));
      setLastResult({ type: 'hunt', data: result });
      setCanUndo(true);
      await loadLogs();
    } catch (e) {
      setLastResult({ type: 'error', data: { message: e.message } });
    }
  };

  const handleDirectionCheck = async () => {
    if (!selectedTerrainId) return;
    try {
      const w = weatherResult?.weather;
      const modifier = (w === 'Fog' || w === 'Storm' || w === 'Blizzard') ? 1 : 0;
      const result = await api.directionCheck(parseInt(selectedTerrainId, 10), modifier);
      setLastResult({ type: 'direction', data: result });
      setCanUndo(true);
      await loadLogs();
    } catch (e) {
      setLastResult({ type: 'error', data: { message: e.message } });
    }
  };

  const handleResetDay = async () => {
    try {
      await api.resetDay();
      setLastResult(null);
      setWeatherResult(null);
      setCanUndo(true);
      await loadState();
      await loadLogs();
    } catch (e) {
      setLastResult({ type: 'error', data: { message: e.message } });
    }
  };

  const handleRollWeather = async () => {
    try {
      const result = await api.rollWeather();
      setWeatherResult(result.weather);
      setCanUndo(true);
      await loadLogs();
    } catch (e) {
      setLastResult({ type: 'error', data: { message: e.message } });
    }
  };

  const startEditing = () => {
    if (!state) return;
    const h = Math.floor(state.current_hour);
    const m = Math.round((state.current_hour - h) * 60);
    setEditYear(String(state.current_year));
    setEditMonth(String(state.current_month));
    setEditDayOfMonth(String(state.current_day_of_month));
    setEditHour(String(h).padStart(2, '0'));
    setEditMinute(String(m).padStart(2, '0'));
    setEditingState(true);
  };

  const handleAdvanceTime = async (hours) => {
    if (!state) return;
    let newHour = state.current_hour + hours;
    let year = state.current_year;
    let month = state.current_month;
    let dayOfMonth = state.current_day_of_month;

    while (newHour >= 24) {
      newHour -= 24;
      dayOfMonth += 1;
      if (dayOfMonth > getDaysForMonth(month)) {
        dayOfMonth = 1;
        month += 1;
        if (month > monthCount) {
          month = 1;
          year += 1;
        }
      }
    }

    try {
      await api.setTravelState({
        current_year: year,
        current_month: month,
        current_day_of_month: dayOfMonth,
        current_hour: Math.round(newHour * 100) / 100,
      });
      await loadState();
    } catch (e) {
      setLastResult({ type: 'error', data: { message: e.message } });
    }
  };

  const isViewingActive = viewingSessionId && activeSession && viewingSessionId === activeSession.id;

  const handleAddNote = async () => {
    if (!noteText.trim() || !activeSession) return;
    try {
      await api.addSessionNote(activeSession.id, noteText.trim());
      setNoteText('');
      await loadNotes();
    } catch (e) {
      console.error('Failed to add note:', e);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!viewingSessionId) return;
    try {
      await api.deleteSessionNote(viewingSessionId, noteId);
      await loadNotes();
    } catch (e) {
      console.error('Failed to delete note:', e);
    }
  };

  const handleViewSession = (sessionId) => {
    setViewingSessionId(sessionId);
  };

  const combinedEntries = useMemo(() => {
    const entries = [];
    for (const log of logs) {
      entries.push({ ...log, _type: 'log', _sortId: log.id });
    }
    for (const note of sessionNotes) {
      entries.push({
        id: `note-${note.id}`,
        _noteId: note.id,
        _type: 'note',
        log_year: note.log_year,
        log_month: note.log_month,
        log_day: note.log_day,
        hour: note.hour,
        category: 'note',
        message: note.message,
        _sortId: note.id + 1000000,
      });
    }
    entries.sort((a, b) => {
      const dateA = a.log_year * 10000 + a.log_month * 100 + a.log_day;
      const dateB = b.log_year * 10000 + b.log_month * 100 + b.log_day;
      if (dateA !== dateB) return dateA - dateB;
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a._sortId - b._sortId;
    });
    return entries;
  }, [logs, sessionNotes]);

  const viewedDateRange = useMemo(() => {
    if (combinedEntries.length === 0) return null;
    const first = combinedEntries[0];
    const last = combinedEntries[combinedEntries.length - 1];
    return {
      first_log_day: first.log_day,
      first_log_month: first.log_month,
      last_log_day: last.log_day,
      last_log_month: last.log_month,
    };
  }, [combinedEntries]);

  const handleSaveState = async () => {
    const year = parseInt(editYear, 10);
    const month = parseInt(editMonth, 10);
    const dayOfMonth = parseInt(editDayOfMonth, 10);
    const hour = parseInt(editHour, 10) + parseInt(editMinute, 10) / 60;
    if (isNaN(year) || year < 1) return;
    if (isNaN(month) || month < 1 || month > monthCount) return;
    if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > getDaysForMonth(month)) return;
    if (isNaN(hour) || hour < 0 || hour >= 24) return;
    try {
      await api.setTravelState({
        current_year: year,
        current_month: month,
        current_day_of_month: dayOfMonth,
        current_hour: Math.round(hour * 100) / 100,
      });
      setEditingState(false);
      await loadState();
    } catch (e) {
      setLastResult({ type: 'error', data: { message: e.message } });
    }
  };

  return (
    <div>
      {/* Campaign State Bar */}
      {state && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          {editingState ? (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Year</label>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  style={{ width: '70px' }}
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Month</label>
                <select
                  className="form-control"
                  style={{ width: '140px' }}
                  value={editMonth}
                  onChange={(e) => setEditMonth(e.target.value)}
                >
                  {HADEAN_MONTHS.slice(1).map((name, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1} — {name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Day</label>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  max={getDaysForMonth(parseInt(editMonth, 10) || 1)}
                  style={{ width: '70px' }}
                  value={editDayOfMonth}
                  onChange={(e) => setEditDayOfMonth(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Hour</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="23"
                  style={{ width: '70px' }}
                  value={editHour}
                  onChange={(e) => setEditHour(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Minute</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="59"
                  style={{ width: '70px' }}
                  value={editMinute}
                  onChange={(e) => setEditMinute(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleSaveState}>Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingState(false)}>Cancel</button>
            </div>
          ) : (
            <>
              <div className="stat-grid">
                <div className="stat-item" onClick={startEditing} style={{ cursor: 'pointer' }} title="Click to edit">
                  <div className="stat-value">{formatDate(state.current_day_of_month, state.current_month, state.current_year)}</div>
                  <div className="stat-label">Hadean Date</div>
                </div>
                <div className="stat-item" style={{ cursor: 'pointer' }} title="Click to edit">
                  <div className="stat-value" onClick={startEditing}>{formatTime(state.current_hour)}</div>
                  <div className="stat-label">Current Time</div>
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleAdvanceTime(1/60)}>+1m</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleAdvanceTime(5/60)}>+5m</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleAdvanceTime(10/60)}>+10m</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleAdvanceTime(0.5)}>+30m</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleAdvanceTime(1)}>+1h</button>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{state.current_hex_id || '—'}</div>
                  <div className="stat-label">Current Hex</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{state.hexes_traveled_today}</div>
                  <div className="stat-label">Hexes Today</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{state.hours_traveled_today?.toFixed(1)}h</div>
                  <div className="stat-label">Hours Traveled</div>
                </div>
                <div className="stat-item">
                  <select
                    className="form-control"
                    style={{ width: 'auto', minWidth: '80px', fontSize: '1.1rem', fontWeight: 600, textAlign: 'center', padding: '0.15rem 0.25rem' }}
                    value={state.movement_rate || 120}
                    onChange={async (e) => {
                      const rate = parseInt(e.target.value, 10);
                      await api.setTravelState({ movement_rate: rate });
                      await loadState();
                    }}
                  >
                    <option value="120">120'</option>
                    <option value="90">90'</option>
                    <option value="60">60'</option>
                    <option value="30">30'</option>
                  </select>
                  <div className="stat-label">Movement ({(state.movement_rate || 120) / 5} mi/day)</div>
                </div>
              </div>
              {state.hours_traveled_today >= 8 && (
                <div className="mt-1">
                  <span className="badge badge-danger">Forced March! Party has traveled 8+ hours.</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo last action"
                  style={{ fontSize: '1.1rem', lineHeight: 1, padding: '0.25rem 0.5rem' }}
                >
                  &#8630; Undo
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Viewing historical session banner */}
      {viewingSessionId && activeSession && viewingSessionId !== activeSession.id && (
        <div className="session-viewing-banner">
          <span>Viewing {(() => { const s = sessions.find(s => s.id === viewingSessionId); return s?.name || `Session ${s?.session_number ?? '?'}`; })()} (historical)</span>
          <button className="btn btn-sm btn-warning" onClick={() => setViewingSessionId(activeSession.id)}>
            Return to Current
          </button>
        </div>
      )}

      <div className="grid-2">
        {/* Left column: Actions above Traverse Hex */}
        <div>
          {/* Travel Actions */}
          <div className="card">
            <h3 className="mb-1">Actions</h3>
            {!selectedTerrainId && (
              <div className="weather-fx-line hypo" style={{ marginBottom: '0.75rem' }}>
                <span className="weather-fx-tag hypo">No Terrain</span>
                Select a terrain type below to enable actions.
              </div>
            )}
            <div className="travel-actions">
              <button className="btn btn-warning" onClick={handleWanderCheck} disabled={!selectedTerrain || !isViewingActive}>
                Check Wandering Monsters
              </button>
              <button className="btn btn-success" onClick={handleForage} disabled={!selectedTerrain?.foraging_chance || !isViewingActive}>
                Attempt Foraging
              </button>
              <button className="btn btn-success" onClick={handleHunt} disabled={!selectedTerrain?.hunting_chance || !isViewingActive}>
                Attempt Hunting
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleDirectionCheck}
                disabled={!selectedTerrain?.losing_direction_chance || !isViewingActive}
              >
                Check Direction
              </button>
              <button className="btn btn-secondary" onClick={handleResetDay} disabled={!isViewingActive}>
                New Day (Reset)
              </button>
            </div>
          </div>

          {/* Traverse Hex */}
          <div className="card">
            <h3 className="mb-1">Traverse Hex</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Terrain Type</label>
                <select
                  className="form-control"
                  value={selectedTerrainId}
                  onChange={(e) => setSelectedTerrainId(e.target.value)}
                  disabled={!isViewingActive}
                >
                  <option value="">Select terrain...</option>
                  {terrains.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.travel_speed_modifier > 0 ? '+' : ''}{Math.round(t.travel_speed_modifier * 100)}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Hex ID (optional)</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. 0712"
                  value={hexId}
                  onChange={(e) => setHexId(e.target.value)}
                  disabled={!isViewingActive}
                />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleEnterHex} disabled={!selectedTerrainId || !isViewingActive}>
              Traverse Hex
            </button>
            {selectedTerrainId && (() => {
              const selectedTerrain = terrains.find(t => String(t.id) === selectedTerrainId);
              if (!selectedTerrain) return null;
              const selectedSpeed = calculateTravelSpeed(selectedTerrain.travel_speed_modifier, state?.movement_rate);
              return <TerrainCard terrain={selectedTerrain} travelSpeed={selectedSpeed} />;
            })()}
          </div>

          {/* Result Panel */}
          {lastResult && <ResultPanel result={lastResult} />}
        </div>

        {/* Right column: Weather + Session Log */}
        <div>
          {/* Weather Card */}
          <div className="card">
            <div className="card-header">
              <h3>Weather</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  className="form-control"
                  style={{ width: 'auto', minWidth: '100px' }}
                  value={climateZone}
                  onChange={(e) => setClimateZone(e.target.value)}
                >
                  <option value="boreal">Boreal</option>
                  <option value="tundra">Tundra</option>
                  <option value="polar">Polar</option>
                </select>
                <select
                  className="form-control"
                  style={{ width: 'auto', minWidth: '120px' }}
                  value={clothingMod}
                  onChange={(e) => setClothingMod(e.target.value)}
                >
                  {coldGearItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.temp_shift >= 0 ? '+' : ''}{item.temp_shift}{item.negates_gear ? ', negates gear' : ''})
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowAddGear(!showAddGear)}
                  title="Manage cold gear items"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '1rem', lineHeight: 1 }}
                >
                  {showAddGear ? '×' : '+'}
                </button>
                <button className="btn btn-sm btn-primary" onClick={handleRollWeather} disabled={!isViewingActive}>Roll Weather</button>
              </div>
            </div>
            {showAddGear && (
              <div style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Name"
                    value={newGearName}
                    onChange={(e) => setNewGearName(e.target.value)}
                    style={{ width: '120px' }}
                  />
                  <label style={{ fontSize: '0.85rem', margin: 0 }}>Shift:</label>
                  <input
                    className="form-control"
                    type="number"
                    value={newGearShift}
                    onChange={(e) => setNewGearShift(parseInt(e.target.value, 10) || 0)}
                    style={{ width: '60px' }}
                  />
                  <label style={{ fontSize: '0.85rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      type="checkbox"
                      checked={newGearNegates}
                      onChange={(e) => setNewGearNegates(e.target.checked)}
                    />
                    Negates gear
                  </label>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={!newGearName.trim()}
                    onClick={async () => {
                      const created = await api.createColdGear({ name: newGearName.trim(), temp_shift: newGearShift, negates_gear: newGearNegates });
                      setNewGearName('');
                      setNewGearShift(0);
                      setNewGearNegates(false);
                      const items = await api.getColdGear();
                      setColdGearItems(items);
                      setClothingMod(String(created.id));
                      setShowAddGear(false);
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {coldGearItems.map((item) => (
                    <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-secondary, #2a2a2a)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                      {item.name} ({item.temp_shift >= 0 ? '+' : ''}{item.temp_shift}{item.negates_gear ? ', negates gear' : ''})
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0 0.15rem', fontSize: '1rem', lineHeight: 1 }}
                        title={`Delete ${item.name}`}
                        onClick={async () => {
                          await api.deleteColdGear(item.id);
                          if (clothingMod === String(item.id)) setClothingMod('');
                          await loadColdGear();
                        }}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {weatherResult ? (() => {
              const zone = CLIMATE_ZONES[climateZone];
              // Actual temps (climate zone only) for display
              const actualDay = adjustTemp(weatherResult.dayTemp, zone.tempShift);
              const actualNight = adjustTemp(weatherResult.nightTemp, zone.tempShift);
              const actualDayInfo = TEMP_INFO[actualDay];
              const actualNightInfo = TEMP_INFO[actualNight];
              // Effective temps (climate + clothing/wet) for hypothermia only
              const selectedGear = coldGearItems.find(g => String(g.id) === clothingMod);
              const isWet = selectedGear?.negates_gear === 1;
              const clothShift = -(selectedGear?.temp_shift || 0);
              const effDay = adjustTemp(actualDay, clothShift);
              const effNight = adjustTemp(actualNight, clothShift);
              const effDayInfo = TEMP_INFO[effDay];
              const effNightInfo = TEMP_INFO[effNight];
              const dayHasHypo = !!effDayInfo?.hypoFreq;
              const nightHasHypo = !!effNightInfo?.hypoFreq;
              const worstIdx = Math.max(TEMP_SCALE.indexOf(effDay), TEMP_SCALE.indexOf(effNight));
              const worstInfo = TEMP_INFO[TEMP_SCALE[worstIdx]];
              const weatherFx = WEATHER_EFFECTS[weatherResult.weather];
              const airFx = AIR_EFFECTS[weatherResult.air];
              return (
                <div className="weather-result">
                  <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="stat-item">
                      <div className="stat-value">{weatherResult.weather}</div>
                      <div className="stat-label">Conditions</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{weatherResult.air}</div>
                      <div className="stat-label">Wind</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{actualDay}</div>
                      <div className="stat-label">
                        Day {actualDayInfo?.range || ''}{actualDay !== weatherResult.dayTemp ? ` (base: ${weatherResult.dayTemp})` : ''}
                      </div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{actualNight}</div>
                      <div className="stat-label">
                        Night {actualNightInfo?.range || ''}{actualNight !== weatherResult.nightTemp ? ` (base: ${weatherResult.nightTemp})` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Current effects summary */}
                  <div className="weather-effects">
                    {weatherFx && <div className="weather-fx-line"><span className="weather-fx-tag">Weather</span> {weatherFx}</div>}
                    {airFx && <div className="weather-fx-line"><span className="weather-fx-tag air">Air</span> {airFx}</div>}
                    {(dayHasHypo || nightHasHypo) && (
                      <div className="weather-fx-line hypo">
                        <span className="weather-fx-tag hypo">Hypothermia</span>
                        {' '}Effective temp: {effDay === effNight ? effDay : `${effDay} (day) / ${effNight} (night)`}
                        {isWet ? ` \u2014 ${selectedGear?.name || 'wet'}, cold gear negated` : clothShift !== 0 ? ` \u2014 ${selectedGear?.name || 'cold gear'}` : ''}.
                        {' '}Save vs. paralysis {dayHasHypo && nightHasHypo && effDay !== effNight
                          ? `${effDayInfo.hypoFreq} (day) / ${effNightInfo.hypoFreq} (night)`
                          : worstInfo?.hypoFreq
                        }{zone.hypoMod ? ` (${zone.hypoMod} to save, ${zone.label})` : ''}.
                        {' '}Failure advances one stage.
                      </div>
                    )}
                    {!weatherFx && !airFx && !dayHasHypo && !nightHasHypo && (
                      <div className="weather-fx-line clear">No adverse conditions.</div>
                    )}
                  </div>

                  <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    Season: {weatherResult.season} | {zone.label} | rolled {weatherResult.roll} on d12
                  </p>
                </div>
              );
            })() : (
              <p className="text-muted">No weather rolled yet. Click "Roll Weather" to determine today's conditions.</p>
            )}
          </div>

          {/* Session Log */}
          <div className="card">
            <div className="card-header">
              <h3>Session Log</h3>
            </div>
            {isViewingActive && (
              <div className="note-input-row">
                <input
                  className="form-control"
                  type="text"
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                />
                <button className="btn btn-sm btn-primary" onClick={handleAddNote} disabled={!noteText.trim()}>Add</button>
              </div>
            )}
            <div className="scroll-section">
              {combinedEntries.length === 0 && <p className="text-muted">No log entries yet.</p>}
              {combinedEntries.map((entry) => (
                <div key={entry.id} className="log-entry">
                  <span className="log-time">{entry.log_day} {HADEAN_MONTHS[entry.log_month]} {formatTime(entry.hour)}</span>
                  <span className={`log-category ${entry.category}`}>{entry.category}</span>
                  <span className="log-message">{entry.message}</span>
                  {entry._type === 'note' && (
                    <button className="note-delete-btn" onClick={() => handleDeleteNote(entry._noteId)} title="Delete note">&times;</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Session Selector */}
          {activeSession && sessions.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', margin: 0 }}>Viewing:</label>
                <select
                  className="form-control"
                  style={{ width: 'auto', minWidth: '180px', flex: 1 }}
                  value={viewingSessionId || ''}
                  onChange={(e) => handleViewSession(parseInt(e.target.value))}
                >
                  {sessions.map((s) => {
                    const label = s.name || `Session ${s.session_number}`;
                    const isViewed = s.id === viewingSessionId;
                    const range = isViewed && viewedDateRange ? viewedDateRange : s;
                    const startDay = range.first_log_day;
                    const startMonth = range.first_log_month;
                    const endDay = range.last_log_day;
                    const endMonth = range.last_log_month;
                    let dateRange = '';
                    if (startDay != null && startMonth != null) {
                      const start = `${startDay} ${HADEAN_MONTHS[startMonth] || '?'}`;
                      const end = `${endDay} ${HADEAN_MONTHS[endMonth] || '?'}`;
                      dateRange = start === end ? ` — ${start}` : ` — ${start} to ${end}`;
                    }
                    return (
                      <option key={s.id} value={s.id}>
                        {label}{dateRange}{s.is_active ? ' (current)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultPanel({ result }) {
  const { type, data } = result;

  if (type === 'error') {
    return (
      <div className="result-panel danger">
        <h4 className="text-danger">Error</h4>
        <p>{data.message}</p>
      </div>
    );
  }

  if (type === 'enter-hex') {
    return (
      <div className="result-panel success">
        <h4>Traversed {data.terrain?.name} hex</h4>
        <p>Travel time: {data.hoursToTraverse?.toFixed(1)} hours. Now {data.timeAdvanced?.formatted}, {formatTime(data.timeAdvanced?.hour)}.</p>
        {data.forcedMarch && <p className="text-danger" style={{ fontWeight: 600 }}>Forced march! Party risks exhaustion.</p>}
      </div>
    );
  }

  if (type === 'wander-check') {
    const hasEncounter = data.check?.success;
    return (
      <div className={`result-panel ${hasEncounter ? 'danger' : 'success'}`}>
        <h4>Wandering Monster Check</h4>
        <p>
          Rolled {data.check?.roll} (need {data.check?.target} or less) —{' '}
          {hasEncounter ? <span className="text-danger">ENCOUNTER!</span> : <span className="text-success">Safe</span>}
        </p>
        {hasEncounter && data.encounterResult?.entry && (
          <div className="mt-1">
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {data.encounterResult.entry.description}
              {data.encounterResult.numberAppearing && ` (${data.encounterResult.numberAppearing.total} appearing)`}
            </p>
            {data.encounterResult.distance && <p>Distance: {data.encounterResult.distance.total} yards</p>}
          </div>
        )}
      </div>
    );
  }

  if (type === 'forage') {
    return (
      <div className={`result-panel ${data.check?.success ? 'success' : 'warning'}`}>
        <h4>Foraging ({data.terrain})</h4>
        <p>
          Rolled {data.check?.roll} (need {data.check?.target} or less on d{data.check?.sides}) —{' '}
          {data.check?.success ? (
            <span className="text-success">
              Found {data.yield?.total} rations! ({data.yield?.expression}: [{data.yield?.rolls?.join(', ')}])
            </span>
          ) : (
            <span className="text-warning">No food found.</span>
          )}
        </p>
      </div>
    );
  }

  if (type === 'hunt') {
    return (
      <div className={`result-panel ${data.check?.success ? 'success' : 'warning'}`}>
        <h4>Hunting ({data.terrain})</h4>
        <p>
          Rolled {data.check?.roll} (need {data.check?.target} or less on d{data.check?.sides}) —{' '}
          {data.check?.success ? (
            <span className="text-success">
              Caught {data.yield?.total} rations! ({data.yield?.expression}: [{data.yield?.rolls?.join(', ')}])
            </span>
          ) : (
            <span className="text-warning">Hunt unsuccessful.</span>
          )}
        </p>
      </div>
    );
  }

  if (type === 'direction') {
    return (
      <div className={`result-panel ${data.lost ? 'danger' : 'success'}`}>
        <h4>Direction Check ({data.terrain})</h4>
        <p>
          Rolled {data.roll} (need {data.adjustedTarget} or less on d{data.sides}
          {data.weatherModifier > 0 ? `, weather +${data.weatherModifier}` : ''}) —{' '}
          {data.lost ? (
            <span className="text-danger" style={{ fontWeight: 700, fontSize: '1.1rem' }}>LOST!</span>
          ) : (
            <span className="text-success">On course.</span>
          )}
        </p>
      </div>
    );
  }

  return null;
}
