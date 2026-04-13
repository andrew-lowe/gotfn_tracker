// Underworld wind & sound conditions. Roll 1d6 once per hour.
// (Malgorgian chaos cavities drive wind that normally wouldn't exist underground.)

const TABLE = {
  1: {
    name: 'Unnerving Silence',
    wind_mph: '0',
    sound_feet: 600,
    wander_mod: 1,
    effects: 'Loud noises attract predators. Wandering checks +1.',
  },
  2: {
    name: 'Calm',
    wind_mph: '1–3',
    sound_feet: 300,
    wander_mod: 0,
    effects: '—',
  },
  3: {
    name: 'Breeze',
    wind_mph: '4–12',
    sound_feet: 150,
    wander_mod: 0,
    effects: 'Missiles −1.',
  },
  4: {
    name: 'Breeze',
    wind_mph: '4–12',
    sound_feet: 150,
    wander_mod: 0,
    effects: 'Missiles −1.',
  },
  5: {
    name: 'Wind',
    wind_mph: '13–31',
    sound_feet: 50,
    wander_mod: 0,
    effects: 'Missiles −2. Torches may blow out (2:6 per turn).',
  },
  6: {
    name: 'Gale',
    wind_mph: '32+',
    sound_feet: 0,
    wander_mod: 0,
    effects: 'Missiles −3, no long-range fire. Creatures gale-deafened. Torches blow out dramatically.',
  },
};

export function rollWindSound() {
  const roll = Math.floor(Math.random() * 6) + 1;
  return { roll, ...TABLE[roll] };
}
