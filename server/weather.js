import { rollDice } from './dice.js';

// d12 weather tables per season
// Index 0–11 corresponds to rolls 1–12
const WEATHER_TABLES = {
  summer: [
    { weather: 'Clear',   air: 'Calm',   dayTemp: 'Mild', nightTemp: 'Mild' },  // 1
    { weather: 'Clear',   air: 'Calm',   dayTemp: 'Mild', nightTemp: 'Mild' },  // 2
    { weather: 'Clear',   air: 'Calm',   dayTemp: 'Mild', nightTemp: 'Mild' },  // 3
    { weather: 'Clear',   air: 'Breeze', dayTemp: 'Mild', nightTemp: 'Mild' },  // 4
    { weather: 'Clear',   air: 'Breeze', dayTemp: 'Mild', nightTemp: 'Mild' },  // 5
    { weather: 'Clouds',  air: 'Calm',   dayTemp: 'Mild', nightTemp: 'Mild' },  // 6
    { weather: 'Clouds',  air: 'Breeze', dayTemp: 'Mild', nightTemp: 'Mild' },  // 7
    { weather: 'Clouds',  air: 'Breeze', dayTemp: 'Mild', nightTemp: 'Mild' },  // 8
    { weather: 'Fog',     air: 'Calm',   dayTemp: 'Mild', nightTemp: 'Mild' },  // 9
    { weather: 'Rain',    air: 'Calm',   dayTemp: 'Mild', nightTemp: 'Mild' },  // 10
    { weather: 'Rain',    air: 'Breeze', dayTemp: 'Mild', nightTemp: 'Mild' },  // 11
    { weather: 'Storm',   air: 'Gale',   dayTemp: 'Mild', nightTemp: 'Cold' },  // 12
  ],
  fall: [
    { weather: 'Clear',   air: 'Calm',   dayTemp: 'Mild',  nightTemp: 'Mild' },    // 1
    { weather: 'Clear',   air: 'Calm',   dayTemp: 'Mild',  nightTemp: 'Mild' },    // 2
    { weather: 'Clear',   air: 'Calm',   dayTemp: 'Mild',  nightTemp: 'Mild' },    // 3
    { weather: 'Clear',   air: 'Breeze', dayTemp: 'Mild',  nightTemp: 'Mild' },    // 4
    { weather: 'Clear',   air: 'Wind',   dayTemp: 'Mild',  nightTemp: 'Cold' },    // 5
    { weather: 'Clouds',  air: 'Calm',   dayTemp: 'Mild',  nightTemp: 'Cold' },    // 6
    { weather: 'Clouds',  air: 'Breeze', dayTemp: 'Mild',  nightTemp: 'Cold' },    // 7
    { weather: 'Clouds',  air: 'Wind',   dayTemp: 'Mild',  nightTemp: 'Cold' },    // 8
    { weather: 'Rain',    air: 'Calm',   dayTemp: 'Cold',  nightTemp: 'Cold' },    // 9
    { weather: 'Rain',    air: 'Breeze', dayTemp: 'Cold',  nightTemp: 'Cold' },    // 10
    { weather: 'Rain',    air: 'Wind',   dayTemp: 'Cold',  nightTemp: 'Cold' },    // 11
    { weather: 'Storm',   air: 'Gale',   dayTemp: 'Cold',  nightTemp: 'Severe' },  // 12
  ],
  winter: [
    { weather: 'Clear',    air: 'Calm',   dayTemp: 'Very Cold', nightTemp: 'Severe' },  // 1
    { weather: 'Clear',    air: 'Calm',   dayTemp: 'Very Cold', nightTemp: 'Severe' },  // 2
    { weather: 'Clear',    air: 'Breeze', dayTemp: 'Very Cold', nightTemp: 'Severe' },  // 3
    { weather: 'Clear',    air: 'Breeze', dayTemp: 'Very Cold', nightTemp: 'Severe' },  // 4
    { weather: 'Clouds',   air: 'Calm',   dayTemp: 'Very Cold', nightTemp: 'Severe' },  // 5
    { weather: 'Clouds',   air: 'Calm',   dayTemp: 'Very Cold', nightTemp: 'Severe' },  // 6
    { weather: 'Clouds',   air: 'Breeze', dayTemp: 'Very Cold', nightTemp: 'Severe' },  // 7
    { weather: 'Clouds',   air: 'Wind',   dayTemp: 'Very Cold', nightTemp: 'Severe' },  // 8
    { weather: 'Snow',     air: 'Calm',   dayTemp: 'Cold',      nightTemp: 'Very Cold' },  // 9
    { weather: 'Snow',     air: 'Breeze', dayTemp: 'Cold',      nightTemp: 'Very Cold' },  // 10
    { weather: 'Blizzard', air: 'Calm',   dayTemp: 'Severe',    nightTemp: 'Extreme' },    // 11
    { weather: 'Blizzard', air: 'Gale',   dayTemp: 'Severe',    nightTemp: 'Extreme' },    // 12
  ],
  spring: [
    { weather: 'Clear',   air: 'Calm',   dayTemp: 'Cold', nightTemp: 'Very Cold' },  // 1
    { weather: 'Clear',   air: 'Calm',   dayTemp: 'Cold', nightTemp: 'Cold' },       // 2
    { weather: 'Clear',   air: 'Calm',   dayTemp: 'Cold', nightTemp: 'Cold' },       // 3
    { weather: 'Clear',   air: 'Breeze', dayTemp: 'Cold', nightTemp: 'Cold' },       // 4
    { weather: 'Clear',   air: 'Breeze', dayTemp: 'Mild', nightTemp: 'Cold' },       // 5
    { weather: 'Clear',   air: 'Wind',   dayTemp: 'Mild', nightTemp: 'Cold' },       // 6
    { weather: 'Fog',     air: 'Calm',   dayTemp: 'Mild', nightTemp: 'Cold' },       // 7
    { weather: 'Clouds',  air: 'Calm',   dayTemp: 'Mild', nightTemp: 'Cold' },       // 8
    { weather: 'Clouds',  air: 'Breeze', dayTemp: 'Mild', nightTemp: 'Mild' },       // 9
    { weather: 'Rain',    air: 'Calm',   dayTemp: 'Mild', nightTemp: 'Mild' },       // 10
    { weather: 'Rain',    air: 'Wind',   dayTemp: 'Mild', nightTemp: 'Mild' },       // 11
    { weather: 'Storm',   air: 'Gale',   dayTemp: 'Mild', nightTemp: 'Mild' },       // 12
  ],
};

/**
 * Roll weather for a given season.
 * @param {string} season - 'winter' | 'spring' | 'summer' | 'fall'
 * @returns {{ roll: number, weather: string, air: string, dayTemp: string, nightTemp: string, season: string }}
 */
export function rollWeather(season) {
  const table = WEATHER_TABLES[season];
  if (!table) return null;

  const result = rollDice('1d12');
  const index = result.total - 1; // 1-12 → 0-11
  const entry = table[index];

  return {
    roll: result.total,
    ...entry,
    season,
  };
}
