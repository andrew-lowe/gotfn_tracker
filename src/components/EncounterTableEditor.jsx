import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../api';

export default function EncounterTableEditor() {
  const [terrains, setTerrains] = useState([]);
  const [selectedTerrainId, setSelectedTerrainId] = useState('');
  const [tables, setTables] = useState([]);
  const [rollResult, setRollResult] = useState(null); // { tableId, diceResult, entry }

  // New table form
  const [newTableName, setNewTableName] = useState('');
  const [newTableDice, setNewTableDice] = useState('2d6');

  // New entry form per table
  const [entryForms, setEntryForms] = useState({});

  const loadTerrains = useCallback(async () => {
    try {
      setTerrains(await api.getTerrains());
    } catch (e) {
      console.error('Failed to load terrains:', e);
    }
  }, []);

  const loadTables = useCallback(async () => {
    if (!selectedTerrainId) { setTables([]); return; }
    try {
      setTables(await api.getEncounterTables(selectedTerrainId));
    } catch (e) {
      console.error('Failed to load tables:', e);
    }
  }, [selectedTerrainId]);

  useEffect(() => { loadTerrains(); }, [loadTerrains]);
  useEffect(() => { loadTables(); setRollResult(null); }, [loadTables]);

  const handleCreateTable = async () => {
    if (!newTableName || !selectedTerrainId) return;
    try {
      await api.createEncounterTable(selectedTerrainId, { name: newTableName, dice_expression: newTableDice });
      setNewTableName('');
      setNewTableDice('2d6');
      await loadTables();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!confirm('Delete this encounter table and all entries?')) return;
    try {
      await api.deleteEncounterTable(selectedTerrainId, tableId);
      await loadTables();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleAddEntry = async (tableId) => {
    const form = entryForms[tableId];
    if (!form || !form.description) return;
    try {
      await api.createEncounterEntry(selectedTerrainId, tableId, {
        roll_min: parseInt(form.roll_min, 10),
        roll_max: parseInt(form.roll_max, 10),
        description: form.description,
        number_appearing: form.number_appearing || null,
        notes: form.notes || null,
      });
      setEntryForms((prev) => ({ ...prev, [tableId]: { roll_min: '', roll_max: '', description: '', number_appearing: '', notes: '' } }));
      await loadTables();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      await api.deleteEncounterEntry(entryId);
      await loadTables();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleRoll = (table) => {
    const result = rollDiceLocal(table.dice_expression);
    if (!result) return;

    const matchedEntry = table.entries.find(
      (e) => result.total >= e.roll_min && result.total <= e.roll_max
    );

    setRollResult({
      tableId: table.id,
      diceResult: result,
      entry: matchedEntry || null,
    });
  };

  const getEntryForm = (tableId) => {
    return entryForms[tableId] || { roll_min: '', roll_max: '', description: '', number_appearing: '', notes: '' };
  };

  const updateEntryForm = (tableId, field, value) => {
    setEntryForms((prev) => ({
      ...prev,
      [tableId]: { ...getEntryForm(tableId), [field]: value },
    }));
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Encounter Tables</h2>
        </div>

        <div className="form-group">
          <label>Select Terrain</label>
          <select
            className="form-control"
            value={selectedTerrainId}
            onChange={(e) => setSelectedTerrainId(e.target.value)}
          >
            <option value="">Choose terrain...</option>
            {terrains.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTerrainId && (
        <>
          {/* Add new table */}
          <div className="card">
            <h3 className="mb-1">Add Encounter Table</h3>
            <div className="inline-form">
              <div className="form-group">
                <label>Table Name</label>
                <input
                  className="form-control"
                  placeholder="e.g. Day Encounters"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Dice</label>
                <select className="form-control" value={newTableDice} onChange={(e) => setNewTableDice(e.target.value)}>
                  <option value="1d6">1d6</option>
                  <option value="2d6">2d6</option>
                  <option value="1d8">1d8</option>
                  <option value="1d10">1d10</option>
                  <option value="1d12">1d12</option>
                  <option value="1d20">1d20</option>
                  <option value="1d100">1d100</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleCreateTable}>Add Table</button>
            </div>
          </div>

          {/* Existing tables */}
          {tables.map((table) => (
            <div key={table.id} className="card">
              <div className="card-header">
                <h3>{table.name} ({table.dice_expression})</h3>
                <div className="btn-row">
                  <button className="btn btn-sm btn-warning" onClick={() => handleRoll(table)}>
                    Roll on Table
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteTable(table.id)}>
                    Delete Table
                  </button>
                </div>
              </div>

              {/* Roll result */}
              {rollResult && rollResult.tableId === table.id && (
                <div className={`result-panel ${rollResult.entry ? 'warning' : 'danger'}`} style={{ marginBottom: '0.75rem' }}>
                  <p>
                    Rolled <strong>{rollResult.diceResult.total}</strong> ({rollResult.diceResult.expression}: [{rollResult.diceResult.rolls.join(', ')}])
                  </p>
                  {rollResult.entry ? (
                    <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      {rollResult.entry.description}
                      {rollResult.entry.number_appearing && ` — Number: ${rollResult.entry.number_appearing}`}
                    </p>
                  ) : (
                    <p className="text-muted">No matching entry for this roll.</p>
                  )}
                  {rollResult.entry?.notes && <p className="text-muted mt-1">{rollResult.entry.notes}</p>}
                </div>
              )}

              {/* Entries table */}
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Roll</th>
                    <th>Description</th>
                    <th style={{ width: '100px' }}>Number</th>
                    <th>Notes</th>
                    <th style={{ width: '60px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {table.entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={
                        rollResult?.tableId === table.id &&
                        rollResult?.diceResult?.total >= entry.roll_min &&
                        rollResult?.diceResult?.total <= entry.roll_max
                          ? 'highlighted'
                          : ''
                      }
                    >
                      <td>{entry.roll_min === entry.roll_max ? entry.roll_min : `${entry.roll_min}-${entry.roll_max}`}</td>
                      <td>{entry.description}</td>
                      <td>{entry.number_appearing || '—'}</td>
                      <td className="text-muted">{entry.notes || '—'}</td>
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteEntry(entry.id)}>×</button>
                      </td>
                    </tr>
                  ))}

                  {/* Inline add entry row */}
                  <tr>
                    <td>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <input
                          className="form-control"
                          type="number"
                          placeholder="Min"
                          style={{ width: '40px', padding: '0.25rem' }}
                          value={getEntryForm(table.id).roll_min}
                          onChange={(e) => updateEntryForm(table.id, 'roll_min', e.target.value)}
                        />
                        <input
                          className="form-control"
                          type="number"
                          placeholder="Max"
                          style={{ width: '40px', padding: '0.25rem' }}
                          value={getEntryForm(table.id).roll_max}
                          onChange={(e) => updateEntryForm(table.id, 'roll_max', e.target.value)}
                        />
                      </div>
                    </td>
                    <td>
                      <input
                        className="form-control"
                        placeholder="What is encountered?"
                        style={{ padding: '0.25rem' }}
                        value={getEntryForm(table.id).description}
                        onChange={(e) => updateEntryForm(table.id, 'description', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control"
                        placeholder="e.g. 2d4"
                        style={{ padding: '0.25rem' }}
                        value={getEntryForm(table.id).number_appearing}
                        onChange={(e) => updateEntryForm(table.id, 'number_appearing', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control"
                        placeholder="Notes..."
                        style={{ padding: '0.25rem' }}
                        value={getEntryForm(table.id).notes}
                        onChange={(e) => updateEntryForm(table.id, 'notes', e.target.value)}
                      />
                    </td>
                    <td>
                      <button className="btn btn-sm btn-success" onClick={() => handleAddEntry(table.id)}>+</button>
                    </td>
                  </tr>
                </tbody>
              </table>

              {table.entries.length === 0 && (
                <p className="text-muted text-center mt-1" style={{ fontSize: '0.85rem' }}>
                  No entries yet. Add entries using the row above.
                </p>
              )}
            </div>
          ))}

          {tables.length === 0 && (
            <div className="card">
              <p className="text-muted text-center">No encounter tables for this terrain. Create one above.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Client-side dice roller for the encounter table "Roll" button
 */
function rollDiceLocal(expression) {
  if (!expression) return null;
  const match = expression.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }

  return {
    expression,
    rolls,
    modifier,
    total: rolls.reduce((a, b) => a + b, 0) + modifier,
  };
}
