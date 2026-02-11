import { Router } from 'express';
import db from '../db.js';

const router = Router();

const TERRAIN_FIELDS = [
  'name', 'hex_type', 'description', 'travel_speed_modifier', 'travel_speed_notes',
  'visibility', 'visibility_miles', 'losing_direction_frequency', 'losing_direction_chance',
  'losing_direction_notes', 'foraging_chance', 'foraging_yield', 'foraging_notes',
  'hunting_chance', 'hunting_yield', 'fishing_chance', 'fishing_yield',
  'wandering_monster_frequency', 'wandering_monster_chance', 'encounter_distance',
  'evasion_modifier', 'special_rules', 'color',
];

// GET /api/terrains — List all terrain types
router.get('/', (req, res) => {
  const terrains = db.prepare('SELECT * FROM terrain_types ORDER BY name').all();
  res.json(terrains);
});

// GET /api/terrains/:id — Get single terrain type
router.get('/:id', (req, res) => {
  const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(req.params.id);
  if (!terrain) return res.status(404).json({ error: 'Terrain not found' });
  res.json(terrain);
});

// POST /api/terrains — Add terrain type
router.post('/', (req, res) => {
  const {
    name, hex_type, description = '', travel_speed_modifier = 0, travel_speed_notes,
    visibility, visibility_miles = 3,
    losing_direction_frequency, losing_direction_chance, losing_direction_notes,
    foraging_chance, foraging_yield, foraging_notes,
    hunting_chance, hunting_yield, fishing_chance, fishing_yield,
    wandering_monster_frequency = '1/day', wandering_monster_chance = '1:6',
    encounter_distance = '2d6 × 10', evasion_modifier,
    special_rules, color = '#808080',
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO terrain_types (
      name, hex_type, description, travel_speed_modifier, travel_speed_notes,
      visibility, visibility_miles,
      losing_direction_frequency, losing_direction_chance, losing_direction_notes,
      foraging_chance, foraging_yield, foraging_notes,
      hunting_chance, hunting_yield, fishing_chance, fishing_yield,
      wandering_monster_frequency, wandering_monster_chance, encounter_distance,
      evasion_modifier, special_rules, color
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, hex_type || null, description, travel_speed_modifier, travel_speed_notes || null,
    visibility || null, visibility_miles,
    losing_direction_frequency || null, losing_direction_chance || null, losing_direction_notes || null,
    foraging_chance || null, foraging_yield || null, foraging_notes || null,
    hunting_chance || null, hunting_yield || null, fishing_chance || null, fishing_yield || null,
    wandering_monster_frequency || null, wandering_monster_chance || null, encounter_distance || null,
    evasion_modifier || null, special_rules || null, color
  );

  const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(terrain);
});

// PATCH /api/terrains/:id — Update terrain type
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Terrain not found' });

  const updates = [];
  const values = [];
  for (const field of TERRAIN_FIELDS) {
    if (field in req.body) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE terrain_types SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const terrain = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(req.params.id);
  res.json(terrain);
});

// DELETE /api/terrains/:id — Delete terrain type
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM terrain_types WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Terrain not found' });

  db.prepare('DELETE FROM terrain_types WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- Encounter Tables ---

// GET /api/terrains/:id/tables — Get encounter tables for terrain
router.get('/:id/tables', (req, res) => {
  const tables = db.prepare('SELECT * FROM encounter_tables WHERE terrain_id = ? ORDER BY name').all(req.params.id);

  // Include entries for each table
  const getEntries = db.prepare('SELECT * FROM encounter_table_entries WHERE table_id = ? ORDER BY roll_min');
  const result = tables.map((t) => ({
    ...t,
    entries: getEntries.all(t.id),
  }));

  res.json(result);
});

// POST /api/terrains/:id/tables — Add encounter table
router.post('/:id/tables', (req, res) => {
  const terrain = db.prepare('SELECT id FROM terrain_types WHERE id = ?').get(req.params.id);
  if (!terrain) return res.status(404).json({ error: 'Terrain not found' });

  const { name, dice_expression = '2d6' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(
    'INSERT INTO encounter_tables (terrain_id, name, dice_expression) VALUES (?, ?, ?)'
  ).run(req.params.id, name, dice_expression);

  const table = db.prepare('SELECT * FROM encounter_tables WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...table, entries: [] });
});

// PATCH /api/terrains/:terrainId/tables/:tableId — Update encounter table
router.patch('/:terrainId/tables/:tableId', (req, res) => {
  const table = db.prepare('SELECT * FROM encounter_tables WHERE id = ? AND terrain_id = ?')
    .get(req.params.tableId, req.params.terrainId);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const { name, dice_expression } = req.body;
  if (name !== undefined) {
    db.prepare('UPDATE encounter_tables SET name = ? WHERE id = ?').run(name, table.id);
  }
  if (dice_expression !== undefined) {
    db.prepare('UPDATE encounter_tables SET dice_expression = ? WHERE id = ?').run(dice_expression, table.id);
  }

  const updated = db.prepare('SELECT * FROM encounter_tables WHERE id = ?').get(table.id);
  const entries = db.prepare('SELECT * FROM encounter_table_entries WHERE table_id = ? ORDER BY roll_min').all(table.id);
  res.json({ ...updated, entries });
});

// DELETE /api/terrains/:terrainId/tables/:tableId — Delete encounter table
router.delete('/:terrainId/tables/:tableId', (req, res) => {
  const table = db.prepare('SELECT * FROM encounter_tables WHERE id = ? AND terrain_id = ?')
    .get(req.params.tableId, req.params.terrainId);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  db.prepare('DELETE FROM encounter_tables WHERE id = ?').run(table.id);
  res.json({ success: true });
});

// POST /api/terrains/:id/tables/:tableId/entries — Add entry to table
router.post('/:terrainId/tables/:tableId/entries', (req, res) => {
  const table = db.prepare('SELECT * FROM encounter_tables WHERE id = ? AND terrain_id = ?')
    .get(req.params.tableId, req.params.terrainId);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const { roll_min, roll_max, description, number_appearing, notes } = req.body;
  if (roll_min === undefined || roll_max === undefined || !description) {
    return res.status(400).json({ error: 'roll_min, roll_max, and description are required' });
  }

  const result = db.prepare(
    'INSERT INTO encounter_table_entries (table_id, roll_min, roll_max, description, number_appearing, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(table.id, roll_min, roll_max, description, number_appearing || null, notes || null);

  const entry = db.prepare('SELECT * FROM encounter_table_entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

export default router;
