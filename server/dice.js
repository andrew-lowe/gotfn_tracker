/**
 * Parse and roll dice expressions like "2d6", "4d6", "1d100", "2d4+1"
 */
export function rollDice(expression) {
  if (!expression) return null;

  // Handle expressions like "4d6 × 10" — roll the dice part and multiply
  const multiplyMatch = expression.match(/^(.+?)\s*[×x\*]\s*(\d+)$/i);
  if (multiplyMatch) {
    const result = rollDice(multiplyMatch[1]);
    const multiplier = parseInt(multiplyMatch[2], 10);
    return {
      expression,
      rolls: result.rolls,
      modifier: result.modifier,
      subtotal: result.total,
      multiplier,
      total: result.total * multiplier,
    };
  }

  // Parse "NdS+M" or "NdS-M" or just "NdS"
  const match = expression.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    // Try parsing as a plain number
    const num = parseInt(expression, 10);
    if (!isNaN(num)) return { expression, rolls: [], modifier: 0, total: num };
    return null;
  }

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }

  const total = rolls.reduce((a, b) => a + b, 0) + modifier;

  return { expression, rolls, modifier, total };
}

/**
 * Parse "X:6" chance notation and roll.
 * Returns { success: boolean, roll: number, target: number }
 */
export function rollChance(chanceStr, bonus = 0) {
  if (!chanceStr) return null;

  const match = chanceStr.match(/^(\d+):(\d+)$/);
  if (!match) return null;

  const baseTarget = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  // Clamp adjusted target to [0, sides] so bonuses can't exceed the die.
  const target = Math.max(0, Math.min(sides, baseTarget + (bonus || 0)));
  const roll = Math.floor(Math.random() * sides) + 1;

  return {
    success: roll <= target,
    roll,
    target,
    baseTarget,
    bonus: bonus || 0,
    sides,
    expression: chanceStr,
  };
}

/**
 * Roll a d6 surprise check. Surprised on a 1 only.
 * Returns { surprised: boolean, roll: number }
 */
export function rollSurprise() {
  const roll = Math.floor(Math.random() * 6) + 1;
  return { surprised: roll === 1, roll };
}

/**
 * Roll a 2d6 reaction roll.
 * Returns { total: number, rolls: number[], description: string }
 */
export function rollReaction() {
  const rolls = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
  const total = rolls[0] + rolls[1];

  let description;
  if (total <= 2) description = 'Immediate attack';
  else if (total <= 5) description = 'Hostile, possible attack';
  else if (total <= 8) description = 'Uncertain, confused';
  else if (total <= 11) description = 'No attack, may negotiate';
  else description = 'Enthusiastic, friendly';

  return { total, rolls, description };
}
