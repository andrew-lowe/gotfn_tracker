import React, { useState, useEffect } from 'react';
import * as api from '../api';

const emptyTerrain = {
  name: '',
  hex_type: '',
  description: '',
  travel_speed_modifier: 0,
  travel_speed_notes: '',
  visibility: '',
  visibility_miles: 3,
  losing_direction_frequency: '',
  losing_direction_chance: '',
  losing_direction_notes: '',
  foraging_chance: '',
  foraging_yield: '',
  foraging_notes: '',
  hunting_chance: '',
  hunting_yield: '',
  fishing_chance: '',
  fishing_yield: '',
  wandering_monster_frequency: '1/day',
  wandering_monster_chance: '1:6',
  encounter_distance: '2d6 × 10',
  evasion_modifier: '',
  special_rules: '',
  color: '#808080',
};

export default function TerrainManager() {
  const [terrains, setTerrains] = useState([]);
  const [editing, setEditing] = useState(null); // null = list view, object = editing
  const [form, setForm] = useState({ ...emptyTerrain });

  const loadTerrains = async () => {
    try {
      setTerrains(await api.getTerrains());
    } catch (e) {
      console.error('Failed to load terrains:', e);
    }
  };

  useEffect(() => { loadTerrains(); }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNew = () => {
    setEditing('new');
    setForm({ ...emptyTerrain });
  };

  const handleEdit = (terrain) => {
    setEditing(terrain.id);
    setForm({
      ...emptyTerrain,
      ...terrain,
      hex_type: terrain.hex_type || '',
      description: terrain.description || '',
      travel_speed_notes: terrain.travel_speed_notes || '',
      visibility: terrain.visibility || '',
      losing_direction_frequency: terrain.losing_direction_frequency || '',
      losing_direction_chance: terrain.losing_direction_chance || '',
      losing_direction_notes: terrain.losing_direction_notes || '',
      foraging_chance: terrain.foraging_chance || '',
      foraging_yield: terrain.foraging_yield || '',
      foraging_notes: terrain.foraging_notes || '',
      hunting_chance: terrain.hunting_chance || '',
      hunting_yield: terrain.hunting_yield || '',
      fishing_chance: terrain.fishing_chance || '',
      fishing_yield: terrain.fishing_yield || '',
      evasion_modifier: terrain.evasion_modifier || '',
      special_rules: terrain.special_rules || '',
    });
  };

  const handleSave = async () => {
    const data = {
      ...form,
      travel_speed_modifier: parseFloat(form.travel_speed_modifier) || 0,
      visibility_miles: parseFloat(form.visibility_miles) || null,
      hex_type: form.hex_type || null,
      travel_speed_notes: form.travel_speed_notes || null,
      visibility: form.visibility || null,
      losing_direction_frequency: form.losing_direction_frequency || null,
      losing_direction_chance: form.losing_direction_chance || null,
      losing_direction_notes: form.losing_direction_notes || null,
      foraging_chance: form.foraging_chance || null,
      foraging_yield: form.foraging_yield || null,
      foraging_notes: form.foraging_notes || null,
      hunting_chance: form.hunting_chance || null,
      hunting_yield: form.hunting_yield || null,
      fishing_chance: form.fishing_chance || null,
      fishing_yield: form.fishing_yield || null,
      evasion_modifier: form.evasion_modifier || null,
      special_rules: form.special_rules || null,
      wandering_monster_frequency: form.wandering_monster_frequency || null,
      wandering_monster_chance: form.wandering_monster_chance || null,
      encounter_distance: form.encounter_distance || null,
    };

    try {
      if (editing === 'new') {
        await api.createTerrain(data);
      } else {
        await api.updateTerrain(editing, data);
      }
      setEditing(null);
      await loadTerrains();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this terrain type?')) return;
    try {
      await api.deleteTerrain(id);
      await loadTerrains();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(terrains, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terrains.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Expected array');
      for (const t of data) {
        await api.createTerrain(t);
      }
      await loadTerrains();
    } catch (err) {
      alert('Import error: ' + err.message);
    }
    e.target.value = '';
  };

  if (editing !== null) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>{editing === 'new' ? 'New Terrain Type' : `Edit: ${form.name}`}</h2>
          <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Name</label>
            <input className="form-control" value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Hex Type (e.g. forest, tundra, road)</label>
            <input className="form-control" value={form.hex_type} onChange={(e) => handleChange('hex_type', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Color</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="color" value={form.color} onChange={(e) => handleChange('color', e.target.value)} style={{ width: 40, height: 32, border: 'none', cursor: 'pointer' }} />
              <input className="form-control" value={form.color} onChange={(e) => handleChange('color', e.target.value)} style={{ width: 100 }} />
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Speed Modifier (decimal, e.g. 0.5 or -0.33)</label>
            <input className="form-control" type="number" step="0.01" value={form.travel_speed_modifier} onChange={(e) => handleChange('travel_speed_modifier', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Speed Notes</label>
            <input className="form-control" value={form.travel_speed_notes} onChange={(e) => handleChange('travel_speed_notes', e.target.value)} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label>Visibility (text, e.g. "3 miles" or "120 yards")</label>
            <input className="form-control" value={form.visibility} onChange={(e) => handleChange('visibility', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Visibility (miles, numeric)</label>
            <input className="form-control" type="number" step="0.5" value={form.visibility_miles ?? ''} onChange={(e) => handleChange('visibility_miles', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Losing Direction Frequency (e.g. 1/day)</label>
            <input className="form-control" value={form.losing_direction_frequency} onChange={(e) => handleChange('losing_direction_frequency', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Losing Direction Chance (e.g. 2:6)</label>
            <input className="form-control" value={form.losing_direction_chance} onChange={(e) => handleChange('losing_direction_chance', e.target.value)} placeholder="null = no chance" />
          </div>
          <div className="form-group">
            <label>Lost Direction Notes</label>
            <input className="form-control" value={form.losing_direction_notes} onChange={(e) => handleChange('losing_direction_notes', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Foraging Chance (e.g. 2:6 or "auto")</label>
            <input className="form-control" value={form.foraging_chance} onChange={(e) => handleChange('foraging_chance', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Foraging Yield (e.g. 2d4)</label>
            <input className="form-control" value={form.foraging_yield} onChange={(e) => handleChange('foraging_yield', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Foraging Notes</label>
            <input className="form-control" value={form.foraging_notes} onChange={(e) => handleChange('foraging_notes', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Hunting Chance (e.g. 2:6)</label>
            <input className="form-control" value={form.hunting_chance} onChange={(e) => handleChange('hunting_chance', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Hunting Yield (e.g. 4d6)</label>
            <input className="form-control" value={form.hunting_yield} onChange={(e) => handleChange('hunting_yield', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Evasion Modifier (e.g. +1)</label>
            <input className="form-control" value={form.evasion_modifier} onChange={(e) => handleChange('evasion_modifier', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Fishing Chance (e.g. 2:6)</label>
            <input className="form-control" value={form.fishing_chance} onChange={(e) => handleChange('fishing_chance', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Fishing Yield (e.g. 4d6)</label>
            <input className="form-control" value={form.fishing_yield} onChange={(e) => handleChange('fishing_yield', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Monster Check Frequency (e.g. 1/day, 2/day)</label>
            <input className="form-control" value={form.wandering_monster_frequency} onChange={(e) => handleChange('wandering_monster_frequency', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Monster Chance (e.g. 3:6)</label>
            <input className="form-control" value={form.wandering_monster_chance} onChange={(e) => handleChange('wandering_monster_chance', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Encounter Distance (e.g. 4d6 × 10)</label>
            <input className="form-control" value={form.encounter_distance} onChange={(e) => handleChange('encounter_distance', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea className="form-control" value={form.description} onChange={(e) => handleChange('description', e.target.value)} rows={3} />
        </div>

        <div className="form-group">
          <label>Special Rules</label>
          <textarea className="form-control" value={form.special_rules} onChange={(e) => handleChange('special_rules', e.target.value)} rows={4} />
        </div>

        <button className="btn btn-primary" onClick={handleSave}>Save</button>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Terrain Types</h2>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={handleNew}>Add Terrain</button>
            <button className="btn btn-secondary" onClick={handleExport}>Export JSON</button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              Import JSON
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Terrain</th>
              <th>Type</th>
              <th>Speed</th>
              <th>Visibility</th>
              <th>Forage</th>
              <th>Hunt</th>
              <th>Monsters</th>
              <th>Lost Dir</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {terrains.map((t) => (
              <tr key={t.id}>
                <td>
                  <span className="terrain-swatch" style={{ background: t.color }} />
                  {t.name}
                </td>
                <td>{t.hex_type || '—'}</td>
                <td>{t.travel_speed_modifier != null ? `${t.travel_speed_modifier > 0 ? '+' : ''}${Math.round(t.travel_speed_modifier * 100)}%` : '—'}</td>
                <td>{t.visibility || (t.visibility_miles != null ? `${t.visibility_miles} mi` : '—')}</td>
                <td>{t.foraging_chance || '—'}</td>
                <td>{t.hunting_chance || '—'}</td>
                <td>{t.wandering_monster_chance ? `${t.wandering_monster_chance} (${t.wandering_monster_frequency || '—'})` : '—'}</td>
                <td>{t.losing_direction_chance || '—'}</td>
                <td>
                  <div className="btn-row">
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(t)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {terrains.length === 0 && (
              <tr><td colSpan={9} className="text-center text-muted">No terrain types defined.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
