// Underworld / Malgorgia survival rules (hyperthermia, armor penalties, etc.)
// All functions are pure and testable.

// Thresholds in feet below surface for each temperature level.
// The PDF gives both 100' (start of Mild) and 4,000' (Warm) etc.
export const TEMP_THRESHOLDS = [
  { level: 1, name: 'Mild',          min_feet:   100, range: '33\u201365\u00b0F',   save_freq: null     },
  { level: 2, name: 'Warm',          min_feet:  4000, range: '66\u201390\u00b0F',   save_freq: '1/day'  },
  { level: 3, name: 'Hot',           min_feet:  7000, range: '91\u2013110\u00b0F',  save_freq: '1/hour' },
  { level: 4, name: 'Very Hot',      min_feet:  9000, range: '111\u2013139\u00b0F', save_freq: '1/turn' },
  { level: 5, name: 'Unearthly Hot', min_feet: 12000, range: '140\u00b0F or hotter', save_freq: '1/minute' },
];

// depth_feet → {level, name, range, save_freq} (null-ish at depths < 100').
export function depthToTemperature(depth_feet) {
  const d = Number(depth_feet) || 0;
  if (d < TEMP_THRESHOLDS[0].min_feet) {
    return { level: 0, name: 'Surface', range: 'Surface temperature', save_freq: null };
  }
  let current = TEMP_THRESHOLDS[0];
  for (const t of TEMP_THRESHOLDS) {
    if (d >= t.min_feet) current = t;
  }
  return current;
}

// Apply a level offset (for Blackrock Tube and Magma Lake, +1) and cap at 5.
export function applyTerrainOffset(temp, offsetLevels) {
  const off = Number(offsetLevels) || 0;
  if (!off) return temp;
  const targetLevel = Math.max(0, Math.min(5, temp.level + off));
  if (targetLevel === 0) return { level: 0, name: 'Surface', range: '', save_freq: null };
  return TEMP_THRESHOLDS.find((t) => t.level === targetLevel) || temp;
}

// "Getting wet" in levels hotter than Mild treats the temperature as one level cooler.
export function applyWetModifier(temp, isWet) {
  if (!isWet || temp.level <= 1) return temp;
  const targetLevel = temp.level - 1;
  return TEMP_THRESHOLDS.find((t) => t.level === targetLevel) || temp;
}

// Armor / clothing save penalty: heavy clothes or light armor = -1, chain = -2, plate = -3.
export const ARMOR_OPTIONS = [
  { key: 'none',       label: 'None / light clothes', penalty: 0  },
  { key: 'heavy_cloth', label: 'Heavy clothes or light armor', penalty: -1 },
  { key: 'chain',      label: 'Chainmail',            penalty: -2 },
  { key: 'plate',      label: 'Plate mail',           penalty: -3 },
];

export function armorPenalty(armorKey) {
  const opt = ARMOR_OPTIONS.find((a) => a.key === armorKey);
  return opt?.penalty ?? 0;
}

// Quick helper for the depth input: common descent steps.
export const DEPTH_STEPS = [100, 500, 1000, 2000];
