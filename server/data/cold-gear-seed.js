import db from '../db.js';

const DEFAULT_COLD_GEAR = [
  { name: 'No cold gear',    temp_shift: 0,  negates_gear: 0 },
  { name: 'Light cold gear', temp_shift: 1,  negates_gear: 0 },
  { name: 'Heavy cold gear', temp_shift: 2,  negates_gear: 0 },
  { name: 'Wet',             temp_shift: -1, negates_gear: 1 },
];

export function seedColdGear() {
  const count = db.prepare('SELECT COUNT(*) as count FROM cold_gear_items').get();
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO cold_gear_items (name, temp_shift, negates_gear) VALUES (?, ?, ?)');
    const seedAll = db.transaction(() => {
      for (const item of DEFAULT_COLD_GEAR) {
        insert.run(item.name, item.temp_shift, item.negates_gear);
      }
    });
    seedAll();
  }
}
