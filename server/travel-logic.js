import { advanceDate } from './calendar.js';

export const DEFAULT_MOVEMENT_RATE = 120; // feet
export const HEX_SIZE_MILES = 6;
export const MAX_TRAVEL_HOURS = 8;

/**
 * Calculate effective travel speed for a terrain type.
 * @param {object} terrain - Must have `travel_speed_modifier` (float).
 * @param {number} [movementRate=120] - Party movement rate in feet (30-120).
 * @returns {{ milesPerDay: number, hexesPerDay: number, hoursPerHex: number }}
 */
export function calculateTravelSpeed(terrain, movementRate = DEFAULT_MOVEMENT_RATE) {
  const baseMilesPerDay = movementRate / 5;
  const modifier = terrain.travel_speed_modifier || 0;
  const effectiveSpeed = baseMilesPerDay * (1 + modifier);

  const hexesPerDay = effectiveSpeed / HEX_SIZE_MILES;
  const hoursPerHex = MAX_TRAVEL_HOURS / hexesPerDay;

  return {
    milesPerDay: Math.round(effectiveSpeed * 100) / 100,
    hexesPerDay: Math.round(hexesPerDay * 100) / 100,
    hoursPerHex: Math.round(hoursPerHex * 100) / 100,
  };
}

/**
 * Advance campaign time by a number of hours, handling day/month/year rollover.
 * @param {object} state - Current campaign state with current_hour, current_year,
 *                         current_month, current_day_of_month, hours_traveled_today, hexes_traveled_today.
 * @param {number} hoursToTraverse - Hours needed to cross the hex.
 * @returns {{ current_hour, current_year, current_month, current_day_of_month, hours_traveled_today, hexes_traveled_today }}
 */
export function advanceTime(state, hoursToTraverse) {
  let newHour = state.current_hour + hoursToTraverse;
  let year = state.current_year;
  let month = state.current_month;
  let dayOfMonth = state.current_day_of_month;
  let newHoursTraveled = state.hours_traveled_today + hoursToTraverse;
  let newHexesTraveled = state.hexes_traveled_today + 1;

  let daysToAdvance = 0;
  while (newHour >= 24) {
    newHour -= 24;
    daysToAdvance += 1;
    newHoursTraveled = hoursToTraverse;
    newHexesTraveled = 1;
  }

  if (daysToAdvance > 0) {
    const advanced = advanceDate(year, month, dayOfMonth, daysToAdvance);
    year = advanced.current_year;
    month = advanced.current_month;
    dayOfMonth = advanced.current_day_of_month;
  }

  return {
    current_hour: Math.round(newHour * 100) / 100,
    current_year: year,
    current_month: month,
    current_day_of_month: dayOfMonth,
    hours_traveled_today: Math.round(newHoursTraveled * 100) / 100,
    hexes_traveled_today: newHexesTraveled,
  };
}

/**
 * Determine if the party is on a forced march.
 * @param {number} hoursTraveled - Total hours traveled today.
 * @returns {boolean}
 */
export function isForcedMarch(hoursTraveled) {
  return hoursTraveled > MAX_TRAVEL_HOURS;
}

/**
 * Parse a "X:Y" chance string and compute the adjusted target with weather modifier.
 * @param {string} chanceStr - e.g. "2:6"
 * @param {number} weatherModifier - Added to the target (fog +1, storm +1).
 * @returns {{ baseTarget, adjustedTarget, sides } | null}
 */
export function parseDirectionChance(chanceStr, weatherModifier = 0) {
  if (!chanceStr) return null;

  const match = chanceStr.match(/^(\d+):(\d+)$/);
  if (!match) return null;

  const baseTarget = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const adjustedTarget = baseTarget + weatherModifier;

  return { baseTarget, adjustedTarget, sides };
}

/**
 * Evaluate a direction check given a roll and parsed chance.
 * @param {number} roll - The d6 (or dN) roll result.
 * @param {{ adjustedTarget: number }} chance - From parseDirectionChance.
 * @returns {boolean} true if lost.
 */
export function isLost(roll, chance) {
  return roll <= chance.adjustedTarget;
}
