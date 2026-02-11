import { Router } from 'express';
import db from '../db.js';
import { getCalendarConfig, getCalendarMonths } from '../calendar.js';

const router = Router();

// GET /api/calendar — Get full calendar config + months
router.get('/', (req, res) => {
  const config = getCalendarConfig();
  const months = getCalendarMonths();
  res.json({ config, months });
});

// PUT /api/calendar — Save entire calendar (config + all months) at once
router.put('/', (req, res) => {
  const { config, months } = req.body;

  if (!config) return res.status(400).json({ error: 'config is required' });
  if (!Array.isArray(months) || months.length === 0) return res.status(400).json({ error: 'months array is required and must not be empty' });

  // Validate config
  if (config.era_name !== undefined && typeof config.era_name !== 'string') {
    return res.status(400).json({ error: 'era_name must be a string' });
  }

  // Validate months
  const validSeasons = ['winter', 'spring', 'summer', 'fall'];
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    if (!m.name || !m.name.trim()) return res.status(400).json({ error: `Month ${i + 1} name cannot be empty` });
    if (!validSeasons.includes(m.season)) return res.status(400).json({ error: `Month ${i + 1} season must be winter, spring, summer, or fall` });
    const days = parseInt(m.days, 10);
    if (isNaN(days) || days < 1) return res.status(400).json({ error: `Month ${i + 1} days must be a positive integer` });
  }

  const saveAll = db.transaction(() => {
    // Update config
    if (config.era_name !== undefined) {
      db.prepare('UPDATE calendar_config SET era_name = ? WHERE id = 1').run(config.era_name);
    }

    // Replace all months: delete existing, insert new with sequential month_numbers
    db.prepare('DELETE FROM calendar_months').run();
    const insert = db.prepare('INSERT INTO calendar_months (month_number, name, season, days) VALUES (?, ?, ?, ?)');
    for (let i = 0; i < months.length; i++) {
      const m = months[i];
      insert.run(i + 1, m.name.trim(), m.season, parseInt(m.days, 10));
    }
  });

  saveAll();

  res.json({ config: getCalendarConfig(), months: getCalendarMonths() });
});

// PATCH /api/calendar/config — Update era_name
router.patch('/config', (req, res) => {
  const { era_name } = req.body;
  const updates = [];
  const values = [];

  if (era_name !== undefined) {
    updates.push('era_name = ?');
    values.push(era_name);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(1);
  db.prepare(`UPDATE calendar_config SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(getCalendarConfig());
});

// PATCH /api/calendar/months/:monthNumber — Update a month's name, season, or days
router.patch('/months/:monthNumber', (req, res) => {
  const monthNumber = parseInt(req.params.monthNumber, 10);
  const existing = db.prepare('SELECT * FROM calendar_months WHERE month_number = ?').get(monthNumber);
  if (!existing) return res.status(404).json({ error: 'Month not found' });

  const { name, season, days } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    updates.push('name = ?');
    values.push(name.trim());
  }
  if (season !== undefined) {
    if (!['winter', 'spring', 'summer', 'fall'].includes(season)) {
      return res.status(400).json({ error: 'Season must be winter, spring, summer, or fall' });
    }
    updates.push('season = ?');
    values.push(season);
  }
  if (days !== undefined) {
    const d = parseInt(days, 10);
    if (isNaN(d) || d < 1) return res.status(400).json({ error: 'Days must be a positive integer' });
    updates.push('days = ?');
    values.push(d);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(monthNumber);
  db.prepare(`UPDATE calendar_months SET ${updates.join(', ')} WHERE month_number = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM calendar_months WHERE month_number = ?').get(monthNumber);
  res.json(updated);
});

export default router;
