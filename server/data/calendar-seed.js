import db from '../db.js';

const DEFAULT_MONTHS = [
  { month_number: 1,  name: 'Nikarion',    season: 'winter', days: 31 },
  { month_number: 2,  name: 'Katharion',   season: 'winter', days: 28 },
  { month_number: 3,  name: 'Photarion',   season: 'spring', days: 31 },
  { month_number: 4,  name: 'Thalassion',  season: 'spring', days: 30 },
  { month_number: 5,  name: 'Antheion',    season: 'spring', days: 31 },
  { month_number: 6,  name: 'Melission',   season: 'summer', days: 30 },
  { month_number: 7,  name: 'Heliarion',   season: 'summer', days: 31 },
  { month_number: 8,  name: 'Panagion',    season: 'summer', days: 31 },
  { month_number: 9,  name: 'Ouranion',    season: 'fall',   days: 30 },
  { month_number: 10, name: 'Hieratarion', season: 'fall',   days: 31 },
  { month_number: 11, name: 'Koimarion',   season: 'fall',   days: 30 },
  { month_number: 12, name: 'Hesperion',   season: 'winter', days: 31 },
];

export function seedCalendar() {
  // Seed config if empty
  const configRow = db.prepare('SELECT id FROM calendar_config WHERE id = 1').get();
  if (!configRow) {
    db.prepare('INSERT INTO calendar_config (id, days_per_month, era_name) VALUES (1, 30, ?)').run('P.I.');
  }

  // Seed months if empty
  const monthCount = db.prepare('SELECT COUNT(*) as count FROM calendar_months').get();
  if (monthCount.count === 0) {
    const insert = db.prepare('INSERT INTO calendar_months (month_number, name, season, days) VALUES (?, ?, ?, ?)');
    const seedAll = db.transaction(() => {
      for (const m of DEFAULT_MONTHS) {
        insert.run(m.month_number, m.name, m.season, m.days);
      }
    });
    seedAll();
  }
}
