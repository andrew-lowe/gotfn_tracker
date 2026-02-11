import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rollDice, rollChance } from '../dice.js';

// Helper to mock Math.random with a sequence of values
function mockRandom(values) {
  const original = Math.random;
  let i = 0;
  Math.random = () => {
    if (i >= values.length) throw new Error(`Math.random called more times than expected (${values.length} values provided)`);
    return values[i++];
  };
  return () => { Math.random = original; };
}

describe('rollDice', () => {
  describe('null / invalid input', () => {
    it('returns null for null input', () => {
      assert.equal(rollDice(null), null);
    });

    it('returns null for undefined input', () => {
      assert.equal(rollDice(undefined), null);
    });

    it('returns null for empty string', () => {
      assert.equal(rollDice(''), null);
    });

    it('returns null for garbage string', () => {
      assert.equal(rollDice('not-a-dice'), null);
    });
  });

  describe('plain number', () => {
    it('parses a plain integer', () => {
      const r = rollDice('5');
      assert.deepEqual(r, { expression: '5', rolls: [], modifier: 0, total: 5 });
    });

    it('parses zero', () => {
      const r = rollDice('0');
      assert.deepEqual(r, { expression: '0', rolls: [], modifier: 0, total: 0 });
    });
  });

  describe('basic NdS expressions', () => {
    it('rolls 1d6 correctly', () => {
      // Math.random returning 0.5 => floor(0.5 * 6) + 1 = 4
      const restore = mockRandom([0.5]);
      try {
        const r = rollDice('1d6');
        assert.equal(r.expression, '1d6');
        assert.deepEqual(r.rolls, [4]);
        assert.equal(r.modifier, 0);
        assert.equal(r.total, 4);
      } finally { restore(); }
    });

    it('rolls 2d6 correctly', () => {
      // 0.0 => floor(0*6)+1 = 1, 0.999 => floor(0.999*6)+1 = 6+1=7? No: floor(5.994)=5, +1=6
      const restore = mockRandom([0.0, 0.999]);
      try {
        const r = rollDice('2d6');
        assert.equal(r.expression, '2d6');
        assert.deepEqual(r.rolls, [1, 6]);
        assert.equal(r.modifier, 0);
        assert.equal(r.total, 7);
      } finally { restore(); }
    });

    it('rolls 3d8 correctly', () => {
      // 0.0 => 1, 0.5 => floor(4)+1=5, 0.875 => floor(7)+1=8
      const restore = mockRandom([0.0, 0.5, 0.875]);
      try {
        const r = rollDice('3d8');
        assert.deepEqual(r.rolls, [1, 5, 8]);
        assert.equal(r.total, 14);
      } finally { restore(); }
    });

    it('rolls 1d100', () => {
      // 0.49 => floor(49)+1 = 50
      const restore = mockRandom([0.49]);
      try {
        const r = rollDice('1d100');
        assert.deepEqual(r.rolls, [50]);
        assert.equal(r.total, 50);
      } finally { restore(); }
    });

    it('handles minimum rolls (all 1s)', () => {
      const restore = mockRandom([0.0, 0.0, 0.0, 0.0]);
      try {
        const r = rollDice('4d6');
        assert.deepEqual(r.rolls, [1, 1, 1, 1]);
        assert.equal(r.total, 4);
      } finally { restore(); }
    });

    it('is case-insensitive for d', () => {
      const restore = mockRandom([0.5]);
      try {
        const r = rollDice('1D6');
        assert.equal(r.total, 4);
      } finally { restore(); }
    });
  });

  describe('NdS with modifier', () => {
    it('handles positive modifier', () => {
      const restore = mockRandom([0.5]);
      try {
        const r = rollDice('1d6+3');
        assert.deepEqual(r.rolls, [4]);
        assert.equal(r.modifier, 3);
        assert.equal(r.total, 7);
      } finally { restore(); }
    });

    it('handles negative modifier', () => {
      const restore = mockRandom([0.5]);
      try {
        const r = rollDice('1d6-2');
        assert.deepEqual(r.rolls, [4]);
        assert.equal(r.modifier, -2);
        assert.equal(r.total, 2);
      } finally { restore(); }
    });

    it('modifier can make total negative', () => {
      const restore = mockRandom([0.0]);
      try {
        const r = rollDice('1d6-5');
        assert.deepEqual(r.rolls, [1]);
        assert.equal(r.total, -4);
      } finally { restore(); }
    });

    it('handles 2d4+1', () => {
      const restore = mockRandom([0.0, 0.75]); // 1, 4
      try {
        const r = rollDice('2d4+1');
        assert.deepEqual(r.rolls, [1, 4]);
        assert.equal(r.modifier, 1);
        assert.equal(r.total, 6);
      } finally { restore(); }
    });
  });

  describe('multiplier expressions (NdS × M)', () => {
    it('handles "4d6 × 10"', () => {
      // floor(v*6)+1: 0.0=>1, 0.5=>4, 0.4=>3, 0.2=>2 => subtotal 10 => *10 = 100
      const restore = mockRandom([0.0, 0.5, 0.4, 0.2]);
      try {
        const r = rollDice('4d6 × 10');
        assert.equal(r.expression, '4d6 × 10');
        assert.deepEqual(r.rolls, [1, 4, 3, 2]);
        assert.equal(r.subtotal, 10);
        assert.equal(r.multiplier, 10);
        assert.equal(r.total, 100);
      } finally { restore(); }
    });

    it('handles "2d6 × 10" with lowercase x', () => {
      const restore = mockRandom([0.0, 0.0]); // 1, 1 => 2 * 10 = 20
      try {
        const r = rollDice('2d6 x 10');
        assert.equal(r.subtotal, 2);
        assert.equal(r.multiplier, 10);
        assert.equal(r.total, 20);
      } finally { restore(); }
    });

    it('handles "2d6*10" with asterisk', () => {
      const restore = mockRandom([0.5, 0.5]); // 4, 4 => 8 * 10 = 80
      try {
        const r = rollDice('2d6*10');
        assert.equal(r.subtotal, 8);
        assert.equal(r.total, 80);
      } finally { restore(); }
    });
  });

  describe('roll ranges', () => {
    it('1d6 always produces values 1-6', () => {
      for (let i = 0; i < 100; i++) {
        const r = rollDice('1d6');
        assert.ok(r.total >= 1 && r.total <= 6, `1d6 produced ${r.total}`);
      }
    });

    it('2d6 always produces values 2-12', () => {
      for (let i = 0; i < 200; i++) {
        const r = rollDice('2d6');
        assert.ok(r.total >= 2 && r.total <= 12, `2d6 produced ${r.total}`);
      }
    });

    it('1d20 always produces values 1-20', () => {
      for (let i = 0; i < 100; i++) {
        const r = rollDice('1d20');
        assert.ok(r.total >= 1 && r.total <= 20, `1d20 produced ${r.total}`);
      }
    });

    it('rolls array length matches dice count', () => {
      const r = rollDice('5d8');
      assert.equal(r.rolls.length, 5);
    });
  });
});

describe('rollChance', () => {
  describe('null / invalid input', () => {
    it('returns null for null', () => {
      assert.equal(rollChance(null), null);
    });

    it('returns null for undefined', () => {
      assert.equal(rollChance(undefined), null);
    });

    it('returns null for empty string', () => {
      assert.equal(rollChance(''), null);
    });

    it('returns null for invalid format', () => {
      assert.equal(rollChance('abc'), null);
    });

    it('returns null for "3/6" (wrong separator)', () => {
      assert.equal(rollChance('3/6'), null);
    });
  });

  describe('successful rolls', () => {
    it('"2:6" succeeds when roll <= 2', () => {
      // 0.0 => floor(0*6)+1 = 1, which is <= 2 => success
      const restore = mockRandom([0.0]);
      try {
        const r = rollChance('2:6');
        assert.equal(r.success, true);
        assert.equal(r.roll, 1);
        assert.equal(r.target, 2);
        assert.equal(r.sides, 6);
        assert.equal(r.expression, '2:6');
      } finally { restore(); }
    });

    it('"3:6" succeeds on exact target', () => {
      // 0.4 => floor(0.4*6)+1 = floor(2.4)+1 = 3, which is <= 3 => success
      const restore = mockRandom([0.4]);
      try {
        const r = rollChance('3:6');
        assert.equal(r.success, true);
        assert.equal(r.roll, 3);
      } finally { restore(); }
    });
  });

  describe('failed rolls', () => {
    it('"2:6" fails when roll > 2', () => {
      // 0.5 => floor(3)+1 = 4, which is > 2 => fail
      const restore = mockRandom([0.5]);
      try {
        const r = rollChance('2:6');
        assert.equal(r.success, false);
        assert.equal(r.roll, 4);
      } finally { restore(); }
    });

    it('"1:6" fails on roll of 6', () => {
      // 0.834 => floor(0.834*6)+1 = floor(5.004)+1 = 6
      const restore = mockRandom([0.834]);
      try {
        const r = rollChance('1:6');
        assert.equal(r.success, false);
        assert.equal(r.roll, 6);
      } finally { restore(); }
    });
  });

  describe('always-succeed / always-fail', () => {
    it('"6:6" always succeeds', () => {
      for (let i = 0; i < 50; i++) {
        const r = rollChance('6:6');
        assert.equal(r.success, true, `6:6 should always succeed, got roll ${r.roll}`);
      }
    });
  });

  describe('return shape', () => {
    it('returns all expected fields', () => {
      const restore = mockRandom([0.0]);
      try {
        const r = rollChance('3:6');
        assert.ok('success' in r);
        assert.ok('roll' in r);
        assert.ok('target' in r);
        assert.ok('sides' in r);
        assert.ok('expression' in r);
      } finally { restore(); }
    });

    it('roll is always an integer in range [1, sides]', () => {
      for (let i = 0; i < 100; i++) {
        const r = rollChance('3:6');
        assert.ok(Number.isInteger(r.roll), `roll should be integer, got ${r.roll}`);
        assert.ok(r.roll >= 1 && r.roll <= 6, `roll should be 1-6, got ${r.roll}`);
      }
    });
  });
});
