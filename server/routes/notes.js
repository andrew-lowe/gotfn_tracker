import { Router } from 'express';
import db from '../db.js';
import { advanceDate, getDaysForMonth, getMonthsPerYear } from '../calendar.js';

const router = Router();

// GET /api/notes — all notes, overdue first, then by due date, then by created_at
router.get('/', (req, res) => {
  const notes = db.prepare(`
    SELECT * FROM campaign_notes
    ORDER BY
      CASE WHEN due_year IS NULL THEN 1 ELSE 0 END,
      due_year, due_month, due_day,
      created_at
  `).all();
  res.json(notes);
});

// POST /api/notes — create a note
// Body: { text } (no deadline)
//   or  { text, duration, unit } where unit is 'days' | 'weeks' | 'months'
//   or  { text, due_year, due_month, due_day }
router.post('/', (req, res) => {
  const { text, duration, unit, due_year, due_month, due_day } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const state = db.prepare('SELECT * FROM campaign_state WHERE id = 1').get();
  const cy = state.current_year;
  const cm = state.current_month;
  const cd = state.current_day_of_month;

  let dy = null, dm = null, dd = null;

  if (due_year != null && due_month != null && due_day != null) {
    // Absolute date provided
    dy = parseInt(due_year, 10);
    dm = parseInt(due_month, 10);
    dd = parseInt(due_day, 10);
    if (isNaN(dy) || isNaN(dm) || isNaN(dd)) {
      return res.status(400).json({ error: 'Invalid date values' });
    }
  } else if (duration != null && unit) {
    // Relative duration
    const dur = parseInt(duration, 10);
    if (isNaN(dur) || dur < 1) {
      return res.status(400).json({ error: 'Duration must be a positive integer' });
    }
    let daysToAdd = 0;
    if (unit === 'days') {
      daysToAdd = dur;
    } else if (unit === 'weeks') {
      daysToAdd = dur * 7;
    } else if (unit === 'months') {
      // Advance month by month
      let m = cm;
      let y = cy;
      for (let i = 0; i < dur; i++) {
        m += 1;
        if (m > getMonthsPerYear()) {
          m = 1;
          y += 1;
        }
      }
      dy = y;
      dm = m;
      dd = cd;
      // Clamp day if target month has fewer days
      const maxDays = getDaysForMonth(dm);
      if (dd > maxDays) dd = maxDays;
    } else {
      return res.status(400).json({ error: 'Unit must be days, weeks, or months' });
    }

    if (unit !== 'months') {
      const advanced = advanceDate(cy, cm, cd, daysToAdd);
      dy = advanced.current_year;
      dm = advanced.current_month;
      dd = advanced.current_day_of_month;
    }
  }
  // else: no deadline

  const result = db.prepare(
    'INSERT INTO campaign_notes (text, created_year, created_month, created_day, due_year, due_month, due_day) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(text.trim(), cy, cm, cd, dy, dm, dd);

  const note = db.prepare('SELECT * FROM campaign_notes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(note);
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM campaign_notes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Note not found' });
  db.prepare('DELETE FROM campaign_notes WHERE id = ?').run(id);
  res.json({ deleted: true });
});

export default router;
