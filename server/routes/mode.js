import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/mode — Returns current mode + underworld-specific state
router.get('/', (req, res) => {
  const state = db.prepare(
    'SELECT mode, depth_feet, using_light FROM campaign_state WHERE id = 1'
  ).get();
  res.json(state || { mode: 'surface', depth_feet: 0, using_light: 0 });
});

// PUT /api/mode — Set campaign mode
router.put('/', (req, res) => {
  const { mode } = req.body;
  if (mode !== 'surface' && mode !== 'underworld') {
    return res.status(400).json({ error: "mode must be 'surface' or 'underworld'" });
  }
  db.prepare('UPDATE campaign_state SET mode = ? WHERE id = 1').run(mode);
  // Clear the current terrain — previous terrain was from the other mode.
  db.prepare('UPDATE campaign_state SET current_terrain_id = NULL WHERE id = 1').run();

  // Log the switch
  const state = db.prepare('SELECT * FROM campaign_state WHERE id = 1').get();
  const activeSession = db.prepare('SELECT id FROM sessions WHERE is_active = 1').get();
  const label = mode === 'underworld' ? 'Descended into the underworld.' : 'Returned to the surface.';
  db.prepare(
    'INSERT INTO session_log (log_year, log_month, log_day, hour, category, message, session_id, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    state.current_year, state.current_month, state.current_day_of_month, state.current_hour,
    'mode', label, activeSession?.id ?? null, mode
  );

  res.json({ mode, depth_feet: state.depth_feet, using_light: state.using_light });
});

// PUT /api/mode/depth — Set current depth in feet
router.put('/depth', (req, res) => {
  const { depth_feet } = req.body;
  const d = Number(depth_feet);
  if (!Number.isFinite(d) || d < 0) {
    return res.status(400).json({ error: 'depth_feet must be a non-negative number' });
  }
  db.prepare('UPDATE campaign_state SET depth_feet = ? WHERE id = 1').run(Math.round(d));
  const state = db.prepare(
    'SELECT mode, depth_feet, using_light FROM campaign_state WHERE id = 1'
  ).get();
  res.json(state);
});

// PUT /api/mode/light — Toggle artificial light use
router.put('/light', (req, res) => {
  const { using_light } = req.body;
  const flag = using_light ? 1 : 0;
  db.prepare('UPDATE campaign_state SET using_light = ? WHERE id = 1').run(flag);
  const state = db.prepare(
    'SELECT mode, depth_feet, using_light FROM campaign_state WHERE id = 1'
  ).get();
  res.json(state);
});

export default router;
