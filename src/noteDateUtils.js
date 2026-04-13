// Helpers for computing due dates from quick-pick accumulators.
// Applies months first (same-day next month, clamped to month length),
// then adds weeks * 7 days rolling over month/year as needed.

export function computeQuickDueDate({ year, month, day }, quickDays, quickWeeks, quickMonths, monthCount, getDaysForMonth) {
  if (!quickDays && !quickWeeks && !quickMonths) return null;
  if (quickDays < 0 || quickWeeks < 0 || quickMonths < 0) return null;

  let y = year;
  let m = month;
  let d = day;

  // Add months: bump month counter, keep day, clamp if target month has fewer days.
  for (let i = 0; i < quickMonths; i++) {
    m += 1;
    if (m > monthCount) {
      m = 1;
      y += 1;
    }
  }
  const maxD = getDaysForMonth(m);
  if (d > maxD) d = maxD;

  // Add weeks and days as day offsets, rolling over months/years.
  let remaining = quickWeeks * 7 + quickDays;
  while (remaining > 0) {
    const daysInMonth = getDaysForMonth(m);
    const daysToEnd = daysInMonth - d;
    if (remaining <= daysToEnd) {
      d += remaining;
      remaining = 0;
    } else {
      remaining -= (daysToEnd + 1);
      d = 1;
      m += 1;
      if (m > monthCount) {
        m = 1;
        y += 1;
      }
    }
  }

  return { year: y, month: m, day: d };
}

export function formatQuickOffset(quickDays, quickWeeks, quickMonths) {
  const parts = [];
  if (quickMonths > 0) parts.push(`+${quickMonths} month${quickMonths > 1 ? 's' : ''}`);
  if (quickWeeks > 0) parts.push(`+${quickWeeks} week${quickWeeks > 1 ? 's' : ''}`);
  if (quickDays > 0) parts.push(`+${quickDays} day${quickDays > 1 ? 's' : ''}`);
  return parts.join(' ');
}
