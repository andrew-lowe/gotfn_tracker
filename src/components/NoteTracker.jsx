import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { useCalendar } from '../CalendarContext';
import { computeQuickDueDate, formatQuickOffset } from '../noteDateUtils';

export default function NoteTracker() {
  const { formatDate, months: HADEAN_MONTHS, monthCount, getDaysForMonth } = useCalendar();
  const [notes, setNotes] = useState([]);
  const [gameDate, setGameDate] = useState(null);
  const [text, setText] = useState('');
  const [hasDue, setHasDue] = useState(false);
  const [dueMode, setDueMode] = useState('quick'); // 'quick' | 'relative' | 'absolute'
  const [quickDays, setQuickDays] = useState(0);
  const [quickWeeks, setQuickWeeks] = useState(0);
  const [quickMonths, setQuickMonths] = useState(0);
  const [duration, setDuration] = useState('');
  const [unit, setUnit] = useState('days');
  const [dueYear, setDueYear] = useState('');
  const [dueMonth, setDueMonth] = useState('');
  const [dueDay, setDueDay] = useState('');

  const resetDueInputs = () => {
    setQuickDays(0);
    setQuickWeeks(0);
    setQuickMonths(0);
    setDuration('');
    setDueYear('');
    setDueMonth('');
    setDueDay('');
  };

  const bumpQuick = (kind) => {
    setDueMode('quick');
    if (kind === 'day') setQuickDays((q) => q + 1);
    else if (kind === 'week') setQuickWeeks((q) => q + 1);
    else setQuickMonths((q) => q + 1);
  };

  const switchMode = (mode) => {
    if (mode === dueMode) return;
    setDueMode(mode);
    resetDueInputs();
  };

  const quickPreview = gameDate ? computeQuickDueDate(
    { year: gameDate.current_year, month: gameDate.current_month, day: gameDate.current_day_of_month },
    quickDays, quickWeeks, quickMonths, monthCount, getDaysForMonth
  ) : null;

  const loadNotes = useCallback(async () => {
    try {
      setNotes(await api.getNotes());
    } catch (e) {
      console.error('Failed to load notes:', e);
    }
  }, []);

  const loadGameDate = useCallback(async () => {
    try {
      const res = await api.getTravelState();
      setGameDate(res.state);
    } catch (e) {
      console.error('Failed to load game date:', e);
    }
  }, []);

  useEffect(() => {
    loadNotes();
    loadGameDate();
  }, [loadNotes, loadGameDate]);

  const dateVal = (y, m, d) => y * 10000 + m * 100 + d;

  const isOverdue = (note) => {
    if (!note.due_year || !gameDate) return false;
    return dateVal(note.due_year, note.due_month, note.due_day) < dateVal(gameDate.current_year, gameDate.current_month, gameDate.current_day_of_month);
  };

  const handleAdd = async () => {
    if (!text.trim()) return;
    const body = { text: text.trim() };
    if (hasDue) {
      if (dueMode === 'quick') {
        if (!quickPreview) return;
        body.due_year = quickPreview.year;
        body.due_month = quickPreview.month;
        body.due_day = quickPreview.day;
      } else if (dueMode === 'relative') {
        const dur = parseInt(duration, 10);
        if (!dur || dur < 1) return;
        body.duration = dur;
        body.unit = unit;
      } else {
        const y = parseInt(dueYear, 10);
        const m = parseInt(dueMonth, 10);
        const d = parseInt(dueDay, 10);
        if (isNaN(y) || isNaN(m) || isNaN(d)) return;
        body.due_year = y;
        body.due_month = m;
        body.due_day = d;
      }
    }
    try {
      await api.createNote(body);
      setText('');
      setHasDue(false);
      setDueMode('quick');
      resetDueInputs();
      await loadNotes();
    } catch (e) {
      console.error('Failed to create note:', e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteNote(id);
      await loadNotes();
    } catch (e) {
      console.error('Failed to delete note:', e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div>
      {gameDate && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-value">{formatDate(gameDate.current_day_of_month, gameDate.current_month, gameDate.current_year)}</div>
              <div className="stat-label">Current Game Date</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '0.75rem' }}>Add Note</h3>
        <div className="note-input-row">
          <input
            className="form-control"
            placeholder="e.g. Character training, Cyrus executed..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="btn btn-primary" onClick={handleAdd}>Add</button>
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={hasDue}
              onChange={(e) => setHasDue(e.target.checked)}
              style={{ marginRight: '0.4rem' }}
            />
            Set a due date
          </label>
        </div>

        {hasDue && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-input)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
              <button
                className={`btn btn-sm ${dueMode === 'quick' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setDueMode('quick'); bumpQuick('day'); }}
              >
                +1 day
              </button>
              <button
                className={`btn btn-sm ${dueMode === 'quick' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setDueMode('quick'); bumpQuick('week'); }}
              >
                +1 week
              </button>
              <button
                className={`btn btn-sm ${dueMode === 'quick' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setDueMode('quick'); bumpQuick('month'); }}
              >
                +1 month
              </button>
              <button
                className={`btn btn-sm ${dueMode === 'relative' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => switchMode('relative')}
              >
                In...
              </button>
              <button
                className={`btn btn-sm ${dueMode === 'absolute' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => switchMode('absolute')}
              >
                On date...
              </button>
              {dueMode === 'quick' && (quickDays > 0 || quickWeeks > 0 || quickMonths > 0) && (
                <button className="btn btn-sm btn-secondary" onClick={resetDueInputs}>Clear</button>
              )}
            </div>

            {dueMode === 'quick' ? (
              <div style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                {quickPreview
                  ? <>Due: {formatDate(quickPreview.day, quickPreview.month, quickPreview.year)} <span style={{ fontSize: '0.8rem' }}>({formatQuickOffset(quickDays, quickWeeks, quickMonths)})</span></>
                  : 'Click +1 day, +1 week, or +1 month to set a due date.'}
              </div>
            ) : dueMode === 'relative' ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '80px' }}
                  min="1"
                  placeholder="#"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <select
                  className="form-control"
                  style={{ width: 'auto' }}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Year</label>
                  <input
                    type="number"
                    className="form-control"
                    style={{ width: '70px' }}
                    value={dueYear}
                    onChange={(e) => setDueYear(e.target.value)}
                    placeholder={gameDate ? String(gameDate.current_year) : ''}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Month</label>
                  <select
                    className="form-control"
                    style={{ width: 'auto' }}
                    value={dueMonth}
                    onChange={(e) => setDueMonth(e.target.value)}
                  >
                    <option value="">--</option>
                    {HADEAN_MONTHS.slice(1).map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Day</label>
                  <input
                    type="number"
                    className="form-control"
                    style={{ width: '70px' }}
                    min="1"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '0.75rem' }}>Notes</h3>
        {notes.length === 0 ? (
          <p className="text-muted">No notes yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Note</th>
                <th>Created</th>
                <th>Due</th>
                <th style={{ width: '30px' }}></th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id} className={isOverdue(note) ? 'note-overdue' : ''}>
                  <td>{note.text}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {formatDate(note.created_day, note.created_month, note.created_year)}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    {note.due_year
                      ? formatDate(note.due_day, note.due_month, note.due_year)
                      : <span className="text-muted">--</span>}
                  </td>
                  <td>
                    <button
                      className="note-delete-btn"
                      title="Delete note"
                      onClick={() => handleDelete(note.id)}
                    >
                      &#x2715;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
