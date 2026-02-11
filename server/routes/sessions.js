import { Router } from 'express';
import db, { getActiveSessionId } from '../db.js';
import { formatHadeanDate } from '../calendar.js';

const router = Router();

function getSessionDateRange(sessionId) {
  const first = db.prepare(`
    SELECT log_year, log_month, log_day, hour FROM (
      SELECT log_year, log_month, log_day, hour FROM session_log WHERE session_id = ?
      UNION ALL
      SELECT log_year, log_month, log_day, hour FROM session_notes WHERE session_id = ?
    ) ORDER BY log_year, log_month, log_day, hour LIMIT 1
  `).get(sessionId, sessionId);

  const last = db.prepare(`
    SELECT log_year, log_month, log_day, hour FROM (
      SELECT log_year, log_month, log_day, hour FROM session_log WHERE session_id = ?
      UNION ALL
      SELECT log_year, log_month, log_day, hour FROM session_notes WHERE session_id = ?
    ) ORDER BY log_year DESC, log_month DESC, log_day DESC, hour DESC LIMIT 1
  `).get(sessionId, sessionId);

  return {
    first_log_year: first?.log_year ?? null,
    first_log_month: first?.log_month ?? null,
    first_log_day: first?.log_day ?? null,
    last_log_year: last?.log_year ?? null,
    last_log_month: last?.log_month ?? null,
    last_log_day: last?.log_day ?? null,
  };
}

function attachDateRanges(sessions) {
  return sessions.map(s => ({ ...s, ...getSessionDateRange(s.id) }));
}

function formatTime(hour) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// GET /api/sessions — List all sessions
router.get('/', (req, res) => {
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY session_number DESC').all();
  res.json(attachDateRanges(sessions));
});

// GET /api/sessions/active — Get the active session
router.get('/active', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE is_active = 1').get();
  if (!session) return res.status(404).json({ error: 'No active session' });
  res.json({ ...session, ...getSessionDateRange(session.id) });
});

// POST /api/sessions — Start new session
router.post('/', (req, res) => {
  const state = db.prepare('SELECT * FROM campaign_state WHERE id = 1').get();
  const active = db.prepare('SELECT * FROM sessions WHERE is_active = 1').get();

  if (active) {
    db.prepare('UPDATE sessions SET is_active = 0, end_year = ?, end_month = ?, end_day = ?, end_hour = ? WHERE id = ?')
      .run(state.current_year, state.current_month, state.current_day_of_month, state.current_hour, active.id);
  }

  const nextNumber = (active?.session_number ?? 0) + 1;
  const result = db.prepare(
    'INSERT INTO sessions (session_number, is_active, start_year, start_month, start_day, start_hour) VALUES (?, 1, ?, ?, ?, ?)'
  ).run(nextNumber, state.current_year, state.current_month, state.current_day_of_month, state.current_hour);

  const newSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newSession);
});

// PATCH /api/sessions/:id — Rename a session
router.patch('/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { name } = req.body;
  if (name === undefined) return res.status(400).json({ error: 'No fields to update' });

  db.prepare('UPDATE sessions SET name = ? WHERE id = ?').run(name || null, req.params.id);
  res.json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id));
});

// DELETE /api/sessions/:id — Delete a session and its logs/notes
router.delete('/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.is_active) return res.status(400).json({ error: 'Cannot delete the active session' });

  db.prepare('DELETE FROM session_notes WHERE session_id = ?').run(session.id);
  db.prepare('DELETE FROM session_log WHERE session_id = ?').run(session.id);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
  res.json({ success: true });
});

// GET /api/sessions/:id/notes — Get notes for a session
router.get('/:id/notes', (req, res) => {
  const notes = db.prepare('SELECT * FROM session_notes WHERE session_id = ? ORDER BY id').all(req.params.id);
  res.json(notes);
});

// POST /api/sessions/:id/notes — Add note
router.post('/:id/notes', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

  const state = db.prepare('SELECT * FROM campaign_state WHERE id = 1').get();
  const result = db.prepare(
    'INSERT INTO session_notes (session_id, log_year, log_month, log_day, hour, hex_id, message) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, state.current_year, state.current_month, state.current_day_of_month, state.current_hour, state.current_hex_id, message.trim());

  const note = db.prepare('SELECT * FROM session_notes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(note);
});

// DELETE /api/sessions/:id/notes/:noteId — Delete a note
router.delete('/:id/notes/:noteId', (req, res) => {
  const note = db.prepare('SELECT * FROM session_notes WHERE id = ? AND session_id = ?').get(req.params.noteId, req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  db.prepare('DELETE FROM session_notes WHERE id = ?').run(req.params.noteId);
  res.json({ success: true });
});

// GET /api/sessions/:id/export — Export session as Markdown
router.get('/:id/export', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const logs = db.prepare('SELECT * FROM session_log WHERE session_id = ? ORDER BY id').all(session.id);
  const notes = db.prepare('SELECT * FROM session_notes WHERE session_id = ? ORDER BY id').all(session.id);

  // Merge logs and notes into one sorted list
  const entries = [];
  for (const log of logs) {
    entries.push({
      type: 'log',
      year: log.log_year, month: log.log_month, day: log.log_day, hour: log.hour,
      category: log.category, message: log.message, id: log.id,
    });
  }
  for (const note of notes) {
    entries.push({
      type: 'note',
      year: note.log_year, month: note.log_month, day: note.log_day, hour: note.hour,
      category: 'note', message: note.message, id: note.id + 1000000,
    });
  }

  // Sort by date then by id for same-time entries
  entries.sort((a, b) => {
    const dateA = a.year * 10000 + a.month * 100 + a.day;
    const dateB = b.year * 10000 + b.month * 100 + b.day;
    if (dateA !== dateB) return dateA - dateB;
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.id - b.id;
  });

  // Build date range from actual log entries
  const first = entries[0];
  const last = entries[entries.length - 1];
  const startDate = first
    ? formatHadeanDate(first.day, first.month, first.year)
    : formatHadeanDate(session.start_day, session.start_month, session.start_year);
  const endDate = last
    ? formatHadeanDate(last.day, last.month, last.year)
    : startDate;

  const title = session.name || `Session ${session.session_number}`;
  let md = `# ${title} — Forbidden North\n\n`;
  md += `**Date range:** ${startDate} — ${endDate}\n\n---\n`;

  // Group by day
  let currentDayKey = '';
  for (const entry of entries) {
    const dayKey = `${entry.day}-${entry.month}-${entry.year}`;
    if (dayKey !== currentDayKey) {
      currentDayKey = dayKey;
      md += `\n### ${formatHadeanDate(entry.day, entry.month, entry.year)}\n\n`;
    }
    md += `- **${formatTime(entry.hour)}** [${entry.category}] ${entry.message}\n`;
  }

  if (entries.length === 0) {
    md += '\n*No log entries or notes for this session.*\n';
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="session-${session.session_number}.md"`);
  res.send(md);
});

export default router;
