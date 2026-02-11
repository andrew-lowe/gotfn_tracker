import React, { useState, useEffect } from 'react';
import { useCalendar } from '../CalendarContext';
import * as api from '../api';

const SEASONS = ['winter', 'spring', 'summer', 'fall'];

export default function CalendarSettings() {
  const { calendar, reloadCalendar } = useCalendar();
  const [eraName, setEraName] = useState('');
  const [months, setMonths] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (calendar) {
      setEraName(calendar.config?.era_name ?? '');
      setMonths(
        [...(calendar.months || [])].sort((a, b) => a.month_number - b.month_number)
          .map(m => ({ ...m }))
      );
      setDirty(false);
    }
  }, [calendar]);

  const markDirty = () => setDirty(true);

  const handleMonthChange = (idx, field, value) => {
    setMonths(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    markDirty();
  };

  const handleAddMonth = () => {
    const nextNumber = months.length + 1;
    setMonths(prev => [...prev, {
      month_number: nextNumber,
      name: `Month ${nextNumber}`,
      season: 'summer',
      days: 30,
    }]);
    markDirty();
  };

  const handleRemoveMonth = (idx) => {
    if (months.length <= 1) return;
    setMonths(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      // Renumber
      return updated.map((m, i) => ({ ...m, month_number: i + 1 }));
    });
    markDirty();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveCalendar({
        config: { era_name: eraName },
        months: months.map((m, i) => ({
          name: m.name,
          season: m.season,
          days: parseInt(m.days, 10) || 30,
        })),
      });
      await reloadCalendar();
      setDirty(false);
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  if (!calendar) return <p className="text-muted">Loading calendar...</p>;

  const totalDays = months.reduce((sum, m) => sum + (parseInt(m.days, 10) || 0), 0);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Calendar Configuration</h2>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Era Name</label>
            <input
              className="form-control"
              type="text"
              value={eraName}
              onChange={(e) => { setEraName(e.target.value); markDirty(); }}
              style={{ width: '120px' }}
            />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
            {months.length} months, {totalDays} days/year
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>#</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>Days</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>Season</th>
              <th style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}></th>
            </tr>
          </thead>
          <tbody>
            {months.map((m, idx) => (
              <tr key={idx}>
                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  {idx + 1}
                </td>
                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <input
                    className="form-control"
                    type="text"
                    value={m.name}
                    onChange={(e) => handleMonthChange(idx, 'name', e.target.value)}
                    style={{ width: '160px' }}
                  />
                </td>
                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    value={m.days}
                    onChange={(e) => handleMonthChange(idx, 'days', e.target.value)}
                    style={{ width: '70px' }}
                  />
                </td>
                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <select
                    className="form-control"
                    value={m.season}
                    onChange={(e) => handleMonthChange(idx, 'season', e.target.value)}
                    style={{ width: '110px' }}
                  >
                    {SEASONS.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleRemoveMonth(idx)}
                    disabled={months.length <= 1}
                    title="Remove month"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '0.75rem' }}>
          <button className="btn btn-sm btn-secondary" onClick={handleAddMonth}>
            + Add Month
          </button>
        </div>
      </div>
    </div>
  );
}
