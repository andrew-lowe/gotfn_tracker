import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db.js';
import { seedTerrains } from './data/terrain-seed.js';
import { seedCalendar } from './data/calendar-seed.js';
import terrainsRouter from './routes/terrains.js';
import travelRouter from './routes/travel.js';
import encounterEntriesRouter from './routes/encounter-entries.js';
import sessionsRouter from './routes/sessions.js';
import calendarRouter from './routes/calendar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize database and seed data
initializeDatabase();
seedTerrains();
seedCalendar();

// Routes
app.use('/api/terrains', terrainsRouter);
app.use('/api/travel', travelRouter);
app.use('/api/encounter-entries', encounterEntriesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/calendar', calendarRouter);

// Serve built frontend in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Forbidden North Tracker server running on port ${PORT}`);
});
