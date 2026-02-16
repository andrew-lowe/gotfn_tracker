import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/cold-gear — list all items
router.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM cold_gear_items ORDER BY temp_shift DESC, id').all();
  res.json(items);
});

// POST /api/cold-gear — create item
router.post('/', (req, res) => {
  const { name, temp_shift, negates_gear } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const shift = parseInt(temp_shift, 10);
  if (isNaN(shift)) return res.status(400).json({ error: 'temp_shift must be an integer' });
  const negates = negates_gear ? 1 : 0;
  const result = db.prepare('INSERT INTO cold_gear_items (name, temp_shift, negates_gear) VALUES (?, ?, ?)').run(name.trim(), shift, negates);
  const item = db.prepare('SELECT * FROM cold_gear_items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

// DELETE /api/cold-gear/:id — delete item
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM cold_gear_items WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });
  db.prepare('DELETE FROM cold_gear_items WHERE id = ?').run(id);
  res.json({ deleted: true });
});

export default router;
