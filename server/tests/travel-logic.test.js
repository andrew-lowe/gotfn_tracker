import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTravelSpeed, advanceTime, isForcedMarch,
  parseDirectionChance, isLost,
  DEFAULT_MOVEMENT_RATE, HEX_SIZE_MILES, MAX_TRAVEL_HOURS,
} from '../travel-logic.js';

describe('constants', () => {
  it('default movement rate is 120 feet (24 miles/day)', () => {
    assert.equal(DEFAULT_MOVEMENT_RATE, 120);
  });

  it('hex size is 6 miles', () => {
    assert.equal(HEX_SIZE_MILES, 6);
  });

  it('max travel hours is 8', () => {
    assert.equal(MAX_TRAVEL_HOURS, 8);
  });
});

describe('calculateTravelSpeed', () => {
  describe('road terrain (+50%)', () => {
    it('calculates Osterion Road speeds correctly', () => {
      const result = calculateTravelSpeed({ travel_speed_modifier: 0.5 });
      assert.equal(result.milesPerDay, 36);
      assert.equal(result.hexesPerDay, 6);
      assert.equal(result.hoursPerHex, 1.33);
    });
  });

  describe('clear terrain (0%)', () => {
    it('calculates base speeds correctly', () => {
      const result = calculateTravelSpeed({ travel_speed_modifier: 0 });
      assert.equal(result.milesPerDay, 24);
      assert.equal(result.hexesPerDay, 4);
      assert.equal(result.hoursPerHex, 2);
    });
  });

  describe('forest terrain (-33%)', () => {
    it('calculates forest speeds correctly', () => {
      const result = calculateTravelSpeed({ travel_speed_modifier: -0.33 });
      assert.equal(result.milesPerDay, 16.08);
      assert.equal(result.hexesPerDay, 2.68);
      assert.equal(result.hoursPerHex, 2.99);
    });
  });

  describe('mountain terrain (-50%)', () => {
    it('calculates mountain speeds correctly', () => {
      const result = calculateTravelSpeed({ travel_speed_modifier: -0.5 });
      assert.equal(result.milesPerDay, 12);
      assert.equal(result.hexesPerDay, 2);
      assert.equal(result.hoursPerHex, 4);
    });
  });

  describe('tundra terrain (-25%)', () => {
    it('calculates tundra speeds correctly', () => {
      const result = calculateTravelSpeed({ travel_speed_modifier: -0.25 });
      assert.equal(result.milesPerDay, 18);
      assert.equal(result.hexesPerDay, 3);
      assert.equal(result.hoursPerHex, 2.67);
    });
  });

  describe('edge cases', () => {
    it('treats undefined modifier as 0', () => {
      const result = calculateTravelSpeed({});
      assert.equal(result.milesPerDay, 24);
      assert.equal(result.hexesPerDay, 4);
      assert.equal(result.hoursPerHex, 2);
    });

    it('treats null modifier as 0', () => {
      const result = calculateTravelSpeed({ travel_speed_modifier: null });
      assert.equal(result.milesPerDay, 24);
    });

    it('handles extreme positive modifier (+100%)', () => {
      const result = calculateTravelSpeed({ travel_speed_modifier: 1.0 });
      assert.equal(result.milesPerDay, 48);
      assert.equal(result.hexesPerDay, 8);
      assert.equal(result.hoursPerHex, 1);
    });

    it('handles -100% modifier (no movement)', () => {
      const result = calculateTravelSpeed({ travel_speed_modifier: -1.0 });
      assert.equal(result.milesPerDay, 0);
      assert.equal(result.hexesPerDay, 0);
      assert.equal(result.hoursPerHex, Infinity);
    });

    it('all return values are numbers', () => {
      const result = calculateTravelSpeed({ travel_speed_modifier: 0.3 });
      assert.equal(typeof result.milesPerDay, 'number');
      assert.equal(typeof result.hexesPerDay, 'number');
      assert.equal(typeof result.hoursPerHex, 'number');
    });
  });
});

describe('advanceTime', () => {
  const baseState = {
    current_hour: 6,
    current_year: 22,
    current_month: 8,
    current_day_of_month: 22,
    hours_traveled_today: 0,
    hexes_traveled_today: 0,
  };

  describe('normal advancement', () => {
    it('advances time within the same day', () => {
      const result = advanceTime(baseState, 2);
      assert.equal(result.current_hour, 8);
      assert.equal(result.current_year, 22);
      assert.equal(result.current_month, 8);
      assert.equal(result.current_day_of_month, 22);
      assert.equal(result.hours_traveled_today, 2);
      assert.equal(result.hexes_traveled_today, 1);
    });

    it('accumulates hours and hexes across calls', () => {
      const after1 = advanceTime(baseState, 2);
      const after2 = advanceTime(after1, 2);
      assert.equal(after2.current_hour, 10);
      assert.equal(after2.current_day_of_month, 22);
      assert.equal(after2.hours_traveled_today, 4);
      assert.equal(after2.hexes_traveled_today, 2);
    });

    it('handles Osterion Road time (1.33 hrs/hex)', () => {
      const result = advanceTime(baseState, 1.33);
      assert.equal(result.current_hour, 7.33);
      assert.equal(result.current_day_of_month, 22);
      assert.equal(result.hours_traveled_today, 1.33);
      assert.equal(result.hexes_traveled_today, 1);
    });

    it('handles mountain time (4 hrs/hex)', () => {
      const result = advanceTime(baseState, 4);
      assert.equal(result.current_hour, 10);
      assert.equal(result.hours_traveled_today, 4);
    });
  });

  describe('day rollover', () => {
    it('rolls over to next day at 24 hours', () => {
      const lateState = { ...baseState, current_hour: 23 };
      const result = advanceTime(lateState, 2);
      assert.equal(result.current_day_of_month, 23);
      assert.equal(result.current_hour, 1);
      assert.equal(result.hours_traveled_today, 2);
      assert.equal(result.hexes_traveled_today, 1);
    });

    it('rolls over exactly at midnight', () => {
      const state = { ...baseState, current_hour: 22 };
      const result = advanceTime(state, 2);
      assert.equal(result.current_day_of_month, 23);
      assert.equal(result.current_hour, 0);
    });

    it('handles multiple day rollovers', () => {
      const state = { ...baseState, current_hour: 23 };
      const result = advanceTime(state, 26);
      // 23 + 26 = 49 => -24 = 25 => -24 = 1, +2 days = day 24
      assert.equal(result.current_day_of_month, 24);
      assert.equal(result.current_hour, 1);
    });

    it('resets travel counters on day rollover', () => {
      const state = { ...baseState, current_hour: 23, hours_traveled_today: 7, hexes_traveled_today: 3 };
      const result = advanceTime(state, 2);
      assert.equal(result.hours_traveled_today, 2);
      assert.equal(result.hexes_traveled_today, 1);
    });
  });

  describe('month rollover', () => {
    it('rolls over to next month at last day', () => {
      // Month 8 (Panagion) has 31 days
      const state = { ...baseState, current_day_of_month: 31, current_hour: 23 };
      const result = advanceTime(state, 2);
      assert.equal(result.current_month, 9); // Panagion → Ouranion
      assert.equal(result.current_day_of_month, 1);
      assert.equal(result.current_hour, 1);
    });
  });

  describe('year rollover', () => {
    it('rolls over to next year at month 12 last day', () => {
      // Month 12 (Hesperion) has 31 days
      const state = { ...baseState, current_month: 12, current_day_of_month: 31, current_hour: 23 };
      const result = advanceTime(state, 2);
      assert.equal(result.current_year, 23);
      assert.equal(result.current_month, 1);
      assert.equal(result.current_day_of_month, 1);
      assert.equal(result.current_hour, 1);
    });
  });

  describe('rounding', () => {
    it('rounds hours to 2 decimal places', () => {
      const result = advanceTime(baseState, 1.333333);
      assert.equal(result.current_hour, 7.33);
    });

    it('rounds traveled hours to 2 decimal places', () => {
      const result = advanceTime(baseState, 2.666666);
      assert.equal(result.hours_traveled_today, 2.67);
    });
  });

  describe('edge cases', () => {
    it('handles 0 hours to traverse', () => {
      const result = advanceTime(baseState, 0);
      assert.equal(result.current_hour, 6);
      assert.equal(result.current_day_of_month, 22);
      assert.equal(result.hours_traveled_today, 0);
      assert.equal(result.hexes_traveled_today, 1);
    });

    it('handles fractional starting hour', () => {
      const state = { ...baseState, current_hour: 6.5 };
      const result = advanceTime(state, 1.5);
      assert.equal(result.current_hour, 8);
    });
  });
});

describe('isForcedMarch', () => {
  it('returns false at exactly 8 hours', () => {
    assert.equal(isForcedMarch(8), false);
  });

  it('returns false under 8 hours', () => {
    assert.equal(isForcedMarch(7.99), false);
  });

  it('returns true over 8 hours', () => {
    assert.equal(isForcedMarch(8.01), true);
  });

  it('returns false at 0 hours', () => {
    assert.equal(isForcedMarch(0), false);
  });

  it('returns true at 12 hours', () => {
    assert.equal(isForcedMarch(12), true);
  });
});

describe('parseDirectionChance', () => {
  describe('valid input', () => {
    it('parses "2:6" with no weather modifier', () => {
      const result = parseDirectionChance('2:6');
      assert.deepEqual(result, { baseTarget: 2, adjustedTarget: 2, sides: 6 });
    });

    it('parses "3:6" with weather +1', () => {
      const result = parseDirectionChance('3:6', 1);
      assert.deepEqual(result, { baseTarget: 3, adjustedTarget: 4, sides: 6 });
    });

    it('parses "1:6" with weather +2 (fog + storm)', () => {
      const result = parseDirectionChance('1:6', 2);
      assert.deepEqual(result, { baseTarget: 1, adjustedTarget: 3, sides: 6 });
    });

    it('weather modifier can push target above sides', () => {
      const result = parseDirectionChance('5:6', 3);
      assert.equal(result.adjustedTarget, 8);
    });

    it('defaults weather modifier to 0', () => {
      const result = parseDirectionChance('2:6');
      assert.equal(result.adjustedTarget, 2);
    });
  });

  describe('invalid input', () => {
    it('returns null for null', () => {
      assert.equal(parseDirectionChance(null), null);
    });

    it('returns null for undefined', () => {
      assert.equal(parseDirectionChance(undefined), null);
    });

    it('returns null for empty string', () => {
      assert.equal(parseDirectionChance(''), null);
    });

    it('returns null for invalid format', () => {
      assert.equal(parseDirectionChance('abc'), null);
    });

    it('returns null for "3/6" (wrong separator)', () => {
      assert.equal(parseDirectionChance('3/6'), null);
    });
  });
});

describe('isLost', () => {
  it('returns true when roll <= adjustedTarget', () => {
    assert.equal(isLost(2, { adjustedTarget: 3 }), true);
  });

  it('returns true when roll equals adjustedTarget', () => {
    assert.equal(isLost(3, { adjustedTarget: 3 }), true);
  });

  it('returns false when roll > adjustedTarget', () => {
    assert.equal(isLost(4, { adjustedTarget: 3 }), false);
  });

  it('returns true on roll of 1 with target of 1', () => {
    assert.equal(isLost(1, { adjustedTarget: 1 }), true);
  });

  it('returns false on roll of 6 with target of 5', () => {
    assert.equal(isLost(6, { adjustedTarget: 5 }), false);
  });

  it('weather-boosted target makes getting lost easier', () => {
    assert.equal(isLost(4, { adjustedTarget: 4 }), true);
    assert.equal(isLost(5, { adjustedTarget: 4 }), false);
  });
});
