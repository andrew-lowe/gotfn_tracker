import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { initializeDatabase } from '../db.js';
import { seedCalendar } from '../data/calendar-seed.js';
import {
  getMonthName, formatHadeanDate, advanceDate, getSeason,
  getCalendarConfig, getCalendarMonths, getDaysForMonth, getMonthsPerYear, getEraName,
  DEFAULT_YEAR, DEFAULT_MONTH, DEFAULT_DAY,
} from '../calendar.js';

before(() => {
  initializeDatabase();
  seedCalendar();
});

describe('calendar config', () => {
  it('has era name P.I.', () => {
    assert.equal(getEraName(), 'P.I.');
  });

  it('has 12 months', () => {
    assert.equal(getMonthsPerYear(), 12);
  });

  it('getCalendarConfig returns config object', () => {
    const config = getCalendarConfig();
    assert.equal(config.era_name, 'P.I.');
  });

  it('getCalendarMonths returns 12 months with days', () => {
    const months = getCalendarMonths();
    assert.equal(months.length, 12);
    assert.equal(months[0].name, 'Nikarion');
    assert.equal(months[0].days, 31);
    assert.equal(months[11].name, 'Hesperion');
    assert.equal(months[11].days, 31);
  });

  it('getDaysForMonth returns per-month days', () => {
    assert.equal(getDaysForMonth(1), 31);
    assert.equal(getDaysForMonth(2), 28);
    assert.equal(getDaysForMonth(4), 30);
    assert.equal(getDaysForMonth(8), 31);
    assert.equal(getDaysForMonth(12), 31);
  });

  it('getDaysForMonth returns 30 for unknown month', () => {
    assert.equal(getDaysForMonth(99), 30);
  });

  it('defaults to 22 Panagion, 22 P.I.', () => {
    assert.equal(DEFAULT_YEAR, 22);
    assert.equal(DEFAULT_MONTH, 8);
    assert.equal(DEFAULT_DAY, 22);
  });
});

describe('getMonthName', () => {
  it('returns Nikarion for month 1', () => {
    assert.equal(getMonthName(1), 'Nikarion');
  });

  it('returns Panagion for month 8', () => {
    assert.equal(getMonthName(8), 'Panagion');
  });

  it('returns Hesperion for month 12', () => {
    assert.equal(getMonthName(12), 'Hesperion');
  });

  it('returns ??? for month 0', () => {
    assert.equal(getMonthName(0), '???');
  });

  it('returns ??? for out-of-range month', () => {
    assert.equal(getMonthName(13), '???');
  });
});

describe('formatHadeanDate', () => {
  it('formats default start date', () => {
    assert.equal(formatHadeanDate(22, 8, 22), '22 Panagion, 22 P.I.');
  });

  it('formats first day of year', () => {
    assert.equal(formatHadeanDate(1, 1, 23), '1 Nikarion, 23 P.I.');
  });

  it('formats last day of year', () => {
    assert.equal(formatHadeanDate(31, 12, 22), '31 Hesperion, 22 P.I.');
  });
});

describe('advanceDate', () => {
  it('advances by 1 day within a month', () => {
    const result = advanceDate(22, 8, 22, 1);
    assert.deepEqual(result, { current_year: 22, current_month: 8, current_day_of_month: 23 });
  });

  it('advances by multiple days within a month', () => {
    const result = advanceDate(22, 8, 22, 5);
    assert.deepEqual(result, { current_year: 22, current_month: 8, current_day_of_month: 27 });
  });

  it('rolls over to next month', () => {
    // Month 8 (Panagion) has 31 days
    const result = advanceDate(22, 8, 31, 1);
    assert.deepEqual(result, { current_year: 22, current_month: 9, current_day_of_month: 1 });
  });

  it('rolls over across multiple months', () => {
    // Month 8=31d, month 9=30d, month 10: 22+9(left in 8)+30(month 9)=39 used, day 2 of month 10
    const result = advanceDate(22, 8, 22, 40);
    assert.deepEqual(result, { current_year: 22, current_month: 10, current_day_of_month: 1 });
  });

  it('rolls over to next year', () => {
    // Month 12 (Hesperion) has 31 days
    const result = advanceDate(22, 12, 31, 1);
    assert.deepEqual(result, { current_year: 23, current_month: 1, current_day_of_month: 1 });
  });

  it('handles 0 days advancement', () => {
    const result = advanceDate(22, 8, 22, 0);
    assert.deepEqual(result, { current_year: 22, current_month: 8, current_day_of_month: 22 });
  });

  it('advances exactly one full year (365 days with Gregorian day counts)', () => {
    const result = advanceDate(22, 1, 1, 365);
    assert.deepEqual(result, { current_year: 23, current_month: 1, current_day_of_month: 1 });
  });
});

describe('getSeason', () => {
  it('returns winter for month 12 (Hesperion)', () => {
    assert.equal(getSeason(12), 'winter');
  });

  it('returns winter for month 1 (Nikarion)', () => {
    assert.equal(getSeason(1), 'winter');
  });

  it('returns winter for month 2 (Katharion)', () => {
    assert.equal(getSeason(2), 'winter');
  });

  it('returns spring for month 3 (Photarion)', () => {
    assert.equal(getSeason(3), 'spring');
  });

  it('returns spring for month 5 (Antheion)', () => {
    assert.equal(getSeason(5), 'spring');
  });

  it('returns summer for month 6 (Melission)', () => {
    assert.equal(getSeason(6), 'summer');
  });

  it('returns summer for month 8 (Panagion)', () => {
    assert.equal(getSeason(8), 'summer');
  });

  it('returns fall for month 9 (Ouranion)', () => {
    assert.equal(getSeason(9), 'fall');
  });

  it('returns fall for month 11 (Koimarion)', () => {
    assert.equal(getSeason(11), 'fall');
  });
});
