// Hadean Calendar — DB-backed configuration
import db from './db.js';

export const DEFAULT_YEAR = 22;
export const DEFAULT_MONTH = 8;
export const DEFAULT_DAY = 22;

export function getCalendarConfig() {
  return db.prepare('SELECT * FROM calendar_config WHERE id = 1').get();
}

export function getCalendarMonths() {
  return db.prepare('SELECT * FROM calendar_months ORDER BY month_number').all();
}

export function getMonthName(month) {
  const row = db.prepare('SELECT name FROM calendar_months WHERE month_number = ?').get(month);
  return row?.name || '???';
}

/**
 * Get the number of days in a specific month.
 * @param {number} month - 1-based month number
 * @returns {number}
 */
export function getDaysForMonth(month) {
  const row = db.prepare('SELECT days FROM calendar_months WHERE month_number = ?').get(month);
  return row?.days ?? 30;
}

export function getMonthsPerYear() {
  const count = db.prepare('SELECT COUNT(*) as count FROM calendar_months').get();
  return count?.count || 12;
}

export function getEraName() {
  const config = getCalendarConfig();
  return config?.era_name ?? 'P.I.';
}

export function formatHadeanDate(day, month, year) {
  return `${day} ${getMonthName(month)}, ${year} ${getEraName()}`;
}

/**
 * Advance a Hadean date by a number of days, handling month/year rollover.
 * Each month can have a different number of days.
 * @returns {{ current_year, current_month, current_day_of_month }}
 */
export function advanceDate(year, month, day, days) {
  const monthsPerYear = getMonthsPerYear();

  let d = day + days;
  let m = month;
  let y = year;

  let daysInMonth = getDaysForMonth(m);
  while (d > daysInMonth) {
    d -= daysInMonth;
    m += 1;
    if (m > monthsPerYear) {
      m = 1;
      y += 1;
    }
    daysInMonth = getDaysForMonth(m);
  }

  return { current_year: y, current_month: m, current_day_of_month: d };
}

/**
 * Determine the season from a 1-based month number using DB mapping.
 */
export function getSeason(month) {
  const row = db.prepare('SELECT season FROM calendar_months WHERE month_number = ?').get(month);
  return row?.season || 'summer';
}
