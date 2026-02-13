import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.NODE_ENV === 'production'
  ? 'forbidden_north.db'
  : 'forbidden_north_dev.db';
const dbPath = path.join(process.env.DB_DIR || __dirname, dbFile);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const NEW_COLUMNS = [
  'hex_type TEXT',
  'visibility TEXT',
  'losing_direction_frequency TEXT',
  'losing_direction_notes TEXT',
  'foraging_notes TEXT',
  'fishing_chance TEXT',
  'fishing_yield TEXT',
  'special_rules TEXT',
  'travel_speed_notes TEXT',
];

function migrateTerrainColumns() {
  for (const col of NEW_COLUMNS) {
    try {
      db.exec(`ALTER TABLE terrain_types ADD COLUMN ${col}`);
    } catch {
      // Column already exists
    }
  }
}

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS terrain_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      hex_type TEXT,
      description TEXT NOT NULL DEFAULT '',
      travel_speed_modifier REAL DEFAULT 0,
      travel_speed_notes TEXT,
      visibility TEXT,
      visibility_miles REAL DEFAULT 3,
      losing_direction_frequency TEXT,
      losing_direction_chance TEXT,
      losing_direction_notes TEXT,
      foraging_chance TEXT,
      foraging_yield TEXT,
      foraging_notes TEXT,
      hunting_chance TEXT,
      hunting_yield TEXT,
      fishing_chance TEXT,
      fishing_yield TEXT,
      wandering_monster_frequency TEXT,
      wandering_monster_chance TEXT,
      encounter_distance TEXT,
      evasion_modifier TEXT,
      special_rules TEXT,
      color TEXT NOT NULL DEFAULT '#808080'
    );

    CREATE TABLE IF NOT EXISTS encounter_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terrain_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dice_expression TEXT NOT NULL DEFAULT '2d6',
      FOREIGN KEY (terrain_id) REFERENCES terrain_types(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS encounter_table_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER NOT NULL,
      roll_min INTEGER NOT NULL,
      roll_max INTEGER NOT NULL,
      description TEXT NOT NULL,
      number_appearing TEXT,
      notes TEXT,
      FOREIGN KEY (table_id) REFERENCES encounter_tables(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS campaign_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_hex_id TEXT,
      current_terrain_id INTEGER,
      hours_traveled_today REAL NOT NULL DEFAULT 0,
      hexes_traveled_today INTEGER NOT NULL DEFAULT 0,
      current_year INTEGER NOT NULL DEFAULT 22,
      current_month INTEGER NOT NULL DEFAULT 8,
      current_day_of_month INTEGER NOT NULL DEFAULT 22,
      current_hour REAL NOT NULL DEFAULT 6,
      FOREIGN KEY (current_terrain_id) REFERENCES terrain_types(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS session_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      log_year INTEGER NOT NULL,
      log_month INTEGER NOT NULL,
      log_day INTEGER NOT NULL,
      hour REAL NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_number INTEGER NOT NULL,
      name TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      start_year INTEGER, start_month INTEGER, start_day INTEGER, start_hour REAL,
      end_year INTEGER, end_month INTEGER, end_day INTEGER, end_hour REAL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS session_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      log_year INTEGER NOT NULL, log_month INTEGER NOT NULL, log_day INTEGER NOT NULL,
      hour REAL NOT NULL, hex_id TEXT, message TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calendar_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      days_per_month INTEGER NOT NULL DEFAULT 30,
      era_name TEXT NOT NULL DEFAULT 'P.I.'
    );

    CREATE TABLE IF NOT EXISTS calendar_months (
      month_number INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      season TEXT NOT NULL CHECK (season IN ('winter', 'spring', 'summer', 'fall')),
      days INTEGER NOT NULL DEFAULT 30
    );
  `);

  // Migrate existing DBs that may lack new columns
  migrateTerrainColumns();
  migrateCampaignStateColumns();
  migrateSessionColumns();
  migrateCalendarColumns();

  // Ensure campaign_state row exists
  const state = db.prepare('SELECT id FROM campaign_state WHERE id = 1').get();
  if (!state) {
    db.prepare('INSERT INTO campaign_state (id) VALUES (1)').run();
  }

  ensureInitialSession();
}

function migrateCampaignStateColumns() {
  try {
    db.exec('ALTER TABLE campaign_state ADD COLUMN movement_rate INTEGER NOT NULL DEFAULT 120');
  } catch {
    // Column already exists
  }
}

function migrateSessionColumns() {
  try {
    db.exec('ALTER TABLE session_log ADD COLUMN session_id INTEGER REFERENCES sessions(id)');
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN name TEXT");
  } catch {
    // Column already exists
  }
}

function migrateCalendarColumns() {
  try {
    db.exec('ALTER TABLE calendar_months ADD COLUMN days INTEGER NOT NULL DEFAULT 30');
  } catch {
    // Column already exists
  }
}

function ensureInitialSession() {
  const existing = db.prepare('SELECT id FROM sessions LIMIT 1').get();
  if (!existing) {
    const state = db.prepare('SELECT * FROM campaign_state WHERE id = 1').get();
    db.prepare('INSERT INTO sessions (id, session_number, is_active, start_year, start_month, start_day, start_hour) VALUES (1, 1, 1, ?, ?, ?, ?)')
      .run(state?.current_year ?? 22, state?.current_month ?? 8, state?.current_day_of_month ?? 22, state?.current_hour ?? 6);
    db.prepare('UPDATE session_log SET session_id = 1 WHERE session_id IS NULL').run();
  }
}

export function getActiveSessionId() {
  return db.prepare('SELECT id FROM sessions WHERE is_active = 1').get()?.id ?? null;
}

export default db;
