const BASE = '/api';

async function request(path, options = {}) {
  const { body, ...fetchOpts } = options;
  const hasBody = body !== undefined;

  const res = await fetch(`${BASE}${path}`, {
    ...fetchOpts,
    ...(hasBody
      ? { headers: { 'Content-Type': 'application/json', ...options.headers }, body: JSON.stringify(body) }
      : { headers: { ...options.headers } }
    ),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Terrains
export const getTerrains = () => request('/terrains');
export const getTerrain = (id) => request(`/terrains/${id}`);
export const createTerrain = (data) => request('/terrains', { method: 'POST', body: data });
export const updateTerrain = (id, data) => request(`/terrains/${id}`, { method: 'PATCH', body: data });
export const deleteTerrain = (id) => request(`/terrains/${id}`, { method: 'DELETE' });

// Encounter tables
export const getEncounterTables = (terrainId) => request(`/terrains/${terrainId}/tables`);
export const createEncounterTable = (terrainId, data) => request(`/terrains/${terrainId}/tables`, { method: 'POST', body: data });
export const updateEncounterTable = (terrainId, tableId, data) => request(`/terrains/${terrainId}/tables/${tableId}`, { method: 'PATCH', body: data });
export const deleteEncounterTable = (terrainId, tableId) => request(`/terrains/${terrainId}/tables/${tableId}`, { method: 'DELETE' });

// Encounter entries
export const createEncounterEntry = (terrainId, tableId, data) => request(`/terrains/${terrainId}/tables/${tableId}/entries`, { method: 'POST', body: data });
export const updateEncounterEntry = (entryId, data) => request(`/encounter-entries/${entryId}`, { method: 'PATCH', body: data });
export const deleteEncounterEntry = (entryId) => request(`/encounter-entries/${entryId}`, { method: 'DELETE' });

// Travel
export const getTravelState = () => request('/travel/state');
export const enterHex = (data) => request('/travel/enter-hex', { method: 'POST', body: data });
export const wanderCheck = (terrainId) => request('/travel/wander-check', { method: 'POST', body: { terrain_id: terrainId } });
export const forage = (terrainId) => request('/travel/forage', { method: 'POST', body: { terrain_id: terrainId } });
export const hunt = (terrainId) => request('/travel/hunt', { method: 'POST', body: { terrain_id: terrainId } });
export const directionCheck = (terrainId, weatherModifier = 0) => request('/travel/direction-check', { method: 'POST', body: { terrain_id: terrainId, weather_modifier: weatherModifier } });
export const resetDay = () => request('/travel/reset-day', { method: 'POST', body: {} });
export const getTravelLog = (limit = 50) => request(`/travel/log?limit=${limit}`);
export const setTravelState = (data) => request('/travel/set-state', { method: 'POST', body: data });
export const rollWeather = () => request('/travel/roll-weather', { method: 'POST', body: {} });
export const canUndo = () => request('/travel/can-undo');
export const undo = () => request('/travel/undo', { method: 'POST', body: {} });

// Sessions
export const getSessions = () => request('/sessions');
export const getActiveSession = () => request('/sessions/active');
export const createSession = () => request('/sessions', { method: 'POST', body: {} });
export const addSessionNote = (sessionId, message) => request(`/sessions/${sessionId}/notes`, { method: 'POST', body: { message } });
export const deleteSessionNote = (sessionId, noteId) => request(`/sessions/${sessionId}/notes/${noteId}`, { method: 'DELETE' });
export const getSessionLogs = (sessionId) => request(`/travel/log?limit=500&session_id=${sessionId}`);
export const getSessionNotes = (sessionId) => request(`/sessions/${sessionId}/notes`);
export const renameSession = (sessionId, name) => request(`/sessions/${sessionId}`, { method: 'PATCH', body: { name } });
export const deleteSession = (sessionId) => request(`/sessions/${sessionId}`, { method: 'DELETE' });

// Calendar
export const getCalendar = () => request('/calendar');
export const saveCalendar = (data) => request('/calendar', { method: 'PUT', body: data });
export const updateCalendarConfig = (data) => request('/calendar/config', { method: 'PATCH', body: data });
export const updateCalendarMonth = (monthNumber, data) => request(`/calendar/months/${monthNumber}`, { method: 'PATCH', body: data });
