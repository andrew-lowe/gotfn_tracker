import { Router } from 'express';
import db from '../db.js';

const router = Router();

// PATCH /api/encounter-entries/:entryId — Update entry
router.patch('/:entryId', (req, res) => {
  const entry = db.prepare('SELECT * FROM encounter_table_entries WHERE id = ?').get(req.params.entryId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const fields = ['roll_min', 'roll_max', 'description', 'number_appearing', 'notes'];
  const updates = [];
  const values = [];

  for (const field of fields) {
    if (field in req.body) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.params.entryId);
  db.prepare(`UPDATE encounter_table_entries SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM encounter_table_entries WHERE id = ?').get(req.params.entryId);
  res.json(updated);
});

// DELETE /api/encounter-entries/:entryId — Delete entry
router.delete('/:entryId', (req, res) => {
  const entry = db.prepare('SELECT * FROM encounter_table_entries WHERE id = ?').get(req.params.entryId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  db.prepare('DELETE FROM encounter_table_entries WHERE id = ?').run(req.params.entryId);
  res.json({ success: true });
});

export default router;
