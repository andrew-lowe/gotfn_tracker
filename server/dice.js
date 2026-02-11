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
export function rollChance(chanceStr) {
  if (!chanceStr) return null;

  const match = chanceStr.match(/^(\d+):(\d+)$/);
  if (!match) return null;

  const target = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const roll = Math.floor(Math.random() * sides) + 1;

  return {
    success: roll <= target,
    roll,
    target,
    sides,
    expression: chanceStr,
  };
}
