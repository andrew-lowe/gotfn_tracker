import React, { useState, useEffect, useCallback } from 'react';
import { useCalendar } from '../CalendarContext';
import * as api from '../api';

export default function SessionManager() {
  const { formatDate } = useCalendar();
  const [sessions, setSessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.getSessions());
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleNewSession = async () => {
    if (!window.confirm('End the current session and start a new one?')) return;
    try {
      await api.createSession();
      await loadSessions();
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  };

  const handleDelete = async (session) => {
    if (!window.confirm(`Delete Session ${session.session_number}${session.name ? ` (${session.name})` : ''}? This will permanently remove all its logs and notes.`)) return;
    try {
      await api.deleteSession(session.id);
      await loadSessions();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleExport = (session) => {
    window.open(`/api/sessions/${session.id}/export`);
  };

  const startRename = (session) => {
    setEditingId(session.id);
    setEditName(session.name || '');
  };

  const handleRename = async (session) => {
    try {
      await api.renameSession(session.id, editName.trim());
      setEditingId(null);
      setEditName('');
      await loadSessions();
    } catch (e) {
      console.error('Failed to rename session:', e);
    }
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Sessions</h2>
          <button className="btn btn-primary" onClick={handleNewSession}>New Session</button>
        </div>

        {sessions.length === 0 && <p className="text-muted">No sessions yet.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              className="card"
              style={{
                marginBottom: 0,
                borderColor: s.is_active ? 'var(--accent)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  {editingId === s.id ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <input
                        className="form-control"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(s);
                          if (e.key === 'Escape') cancelRename();
                        }}
                        placeholder={`Session ${s.session_number}`}
                        autoFocus
                        style={{ maxWidth: '300px' }}
                      />
                      <button className="btn btn-sm btn-primary" onClick={() => handleRename(s)}>Save</button>
                      <button className="btn btn-sm btn-secondary" onClick={cancelRename}>Cancel</button>
                    </div>
                  ) : (
                    <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem' }}>
                      {s.name || `Session ${s.session_number}`}
                      {!s.name && <span className="text-muted" style={{ fontWeight: 400, fontSize: '0.85rem' }}></span>}
                      {s.is_active && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>Active</span>}
                    </h3>
                  )}
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                    Session #{s.session_number}
                    {s.first_log_day != null && (
                      <>
                        {' — '}
                        {formatDate(s.first_log_day, s.first_log_month, s.first_log_year)}
                        {s.last_log_day != null && (s.first_log_day !== s.last_log_day || s.first_log_month !== s.last_log_month || s.first_log_year !== s.last_log_year) &&
                          ` to ${formatDate(s.last_log_day, s.last_log_month, s.last_log_year)}`}
                        {s.is_active && ' (ongoing)'}
                      </>
                    )}
                  </div>
                </div>
                <div className="btn-row" style={{ flexShrink: 0 }}>
                  {editingId !== s.id && (
                    <button className="btn btn-sm btn-secondary" onClick={() => startRename(s)}>Rename</button>
                  )}
                  <button className="btn btn-sm btn-secondary" onClick={() => handleExport(s)}>Export</button>
                  {!s.is_active && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s)}>Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
