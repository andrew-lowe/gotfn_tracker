import React, { useEffect, useState } from 'react';
import { TEMP_THRESHOLDS, ARMOR_OPTIONS } from '../underworldLogic';
import * as api from '../api';

const WIND_TABLE = [
  { roll: '1',   name: 'Unnerving Silence', wind: '0 mph',    sound: "600'", effects: 'Loud noises attract predators. Wander checks +1.' },
  { roll: '2',   name: 'Calm',              wind: '1\u20133 mph',  sound: "300'", effects: '\u2014' },
  { roll: '3\u20134', name: 'Breeze',       wind: '4\u201312 mph', sound: "150'", effects: 'Missiles \u22121.' },
  { roll: '5',   name: 'Wind',              wind: '13\u201331 mph',sound: "50'",  effects: 'Missiles \u22122. Torches may blow out (2:6 per turn).' },
  { roll: '6',   name: 'Gale',              wind: '32+ mph',  sound: '\u2014', effects: 'Missiles \u22123, no long range. Gale-deafened. Torches blow out dramatically.' },
];

export default function UnderworldReference() {
  const [hazards, setHazards] = useState([]);
  const [terrains, setTerrains] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const t = await api.getTerrains('underworld');
        setTerrains(t);
        if (t.length) {
          const hazardTerrain = t.find((x) => false); // sentinel is hidden by route
          // Fetch hazard table separately via any underworld terrain's tables search.
          // Simpler: fetch the first terrain's tables to discover how tables work, then
          // hit a known endpoint. We don't have a direct hazards route, so skip for now.
        }
        // Pull hazards table via hidden backdoor: we exposed Subterranean Hazards
        // as an encounter table under a sentinel terrain (hidden by terrain list filter).
        // Use a dedicated fetch: ask the server for all underworld tables and their entries.
        const res = await fetch('/api/terrains?mode=underworld');
        const list = await res.json();
        // Hazards aren't in `list` (sentinel hidden). Fetch by walking a known shape:
        // try each terrain's tables endpoint and search for "Subterranean Hazards".
        // But those tables are scoped by terrain_id. So instead pull via a direct
        // window fetch to a temporary /api helper if needed. For now display the
        // hazard table from static data extracted alongside the seed.
      } catch (e) {
        console.error('Failed to load underworld reference:', e);
      }
    })();
  }, []);

  // Static hazard list (same data the seed uses).
  const HAZARDS = [
    ['01\u201304', 'Blinding vapors'],
    ['05\u201308', 'Cave-in'],
    ['09\u201312', 'Crack of doom'],
    ['13\u201316', 'Defilement zone'],
    ['17\u201320', 'Diabolical infestation'],
    ['21\u201324', 'Flash flood'],
    ['25\u201328', 'Gravity zone'],
    ['29\u201332', 'Greater utter dark zone'],
    ['33\u201336', 'Hallucinogenic spores'],
    ['37\u201340', 'Idol tainted with void lunacy'],
    ['41\u201344', 'Immense bat swarm'],
    ['45\u201348', 'Invisible portal'],
    ['49\u201352', 'Lesser utter dark zone'],
    ['53\u201356', 'Lethal gas'],
    ['57\u201360', 'Noxious fumes'],
    ['61\u201364', 'Poisonous fumes'],
    ['65\u201368', 'Sleep gas'],
    ['69\u201372', 'Spell node'],
    ['73\u201376', 'Sulfurous fumes'],
    ['77\u201380', 'Time zone'],
    ['81\u201384', 'Tremors'],
    ['85\u201388', 'Underground magma eruption'],
    ['89\u201392', 'Vacuum zone'],
    ['93\u201396', 'White mold trap'],
    ['97\u201300', 'Roll twice on the table and combine results'],
  ];

  const underworldTerrains = terrains.filter((t) => t.hex_type !== '_sentinel');

  return (
    <div className="grid-2">
      <div>
        {/* Hyperthermia */}
        <div className="card ref-chart-card">
          <h4 className="ref-chart-title">Hyperthermia (Depth-driven Heat)</h4>
          <p className="ref-intro">
            The underworld is damp and hot. Temperature rises <strong>1&deg;F per 100'</strong> of depth.
          </p>
          <table className="ref-table">
            <thead>
              <tr><th>Level</th><th>Name</th><th>Range</th><th>Depth</th><th>Save Frequency</th></tr>
            </thead>
            <tbody>
              {TEMP_THRESHOLDS.map((t) => (
                <tr key={t.level}>
                  <td className="ref-label">{t.level}</td>
                  <td className="ref-label">{t.name}</td>
                  <td>{t.range}</td>
                  <td>{t.min_feet.toLocaleString()}'</td>
                  <td>{t.save_freq || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ref-intro" style={{ marginTop: '0.5rem' }}>
            <strong>Wet characters:</strong> treated as one level cooler until dry.{' '}
            <strong>Blackrock Tubes / Magma Lakes:</strong> +1 temperature level.{' '}
            <strong>Hiemal Byways:</strong> extreme cold; hypothermia applies.
          </p>
        </div>

        {/* Armor penalties */}
        <div className="card ref-chart-card">
          <h4 className="ref-chart-title">Hyperthermia Save Penalties (Armor)</h4>
          <table className="ref-table">
            <thead>
              <tr><th>Worn</th><th>Save Penalty</th></tr>
            </thead>
            <tbody>
              {ARMOR_OPTIONS.map((a) => (
                <tr key={a.key}>
                  <td className="ref-label">{a.label}</td>
                  <td>{a.penalty === 0 ? '\u2014' : a.penalty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Wind & Sound */}
        <div className="card ref-chart-card">
          <h4 className="ref-chart-title">Wind &amp; Sound (1d6 per hour)</h4>
          <table className="ref-table">
            <thead>
              <tr><th>Roll</th><th>Condition</th><th>Wind</th><th>Sound Travels</th><th>Effects</th></tr>
            </thead>
            <tbody>
              {WIND_TABLE.map((w) => (
                <tr key={w.roll}>
                  <td className="ref-label">{w.roll}</td>
                  <td className="ref-label">{w.name}</td>
                  <td>{w.wind}</td>
                  <td>{w.sound}</td>
                  <td>{w.effects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Light levels */}
        <div className="card ref-chart-card">
          <h4 className="ref-chart-title">Light in the Darkness</h4>
          <table className="ref-table">
            <tbody>
              <tr><td className="ref-label">Ambient</td><td>Soft light from flora/funga. Reading impossible; fine details missed.</td></tr>
              <tr><td className="ref-label">Tenebrous</td><td>Total darkness. Without a torch you are blind even to objects within reach.</td></tr>
              <tr><td className="ref-label">Artificial light</td><td>Torches/lanterns visible up to 1.5 mi. <strong>+2 to wander checks.</strong></td></tr>
              <tr><td className="ref-label">Bioluminescence</td><td>Ambient glow. Does not attract predators.</td></tr>
              <tr><td className="ref-label">Radiant crystal</td><td>Torch-equivalent that does not attract attention.</td></tr>
              <tr><td className="ref-label"><code>blacklight</code></td><td>The illusionist&rsquo;s ambient-light spell. Does not attract predators.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        {/* Subterranean hazards */}
        <div className="card ref-chart-card">
          <h4 className="ref-chart-title">Subterranean Hazards (1d100)</h4>
          <p className="ref-intro">
            Rolled when an encounter result references this table. Mechanics for each
            hazard live in the source book&rsquo;s glossary.
          </p>
          <table className="ref-table">
            <thead>
              <tr><th>Roll</th><th>Hazard</th></tr>
            </thead>
            <tbody>
              {HAZARDS.map(([r, n]) => (
                <tr key={r}><td className="ref-label">{r}</td><td>{n}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Underworld terrains summary */}
        <div className="card ref-chart-card">
          <h4 className="ref-chart-title">Underworld Terrains</h4>
          {underworldTerrains.length === 0 ? (
            <p className="text-muted">Loading...</p>
          ) : (
            <table className="ref-table">
              <thead>
                <tr><th>Terrain</th><th>Travel</th><th>Wander</th><th>Temp</th></tr>
              </thead>
              <tbody>
                {underworldTerrains.map((t) => (
                  <tr key={t.id}>
                    <td className="ref-label">{t.name}</td>
                    <td>{t.travel_speed_modifier === 0 ? 'special' : `${Math.round(t.travel_speed_modifier * 100)}%`}</td>
                    <td>{t.wandering_monster_chance || '\u2014'}</td>
                    <td>
                      {t.special_rules?.includes('one level higher') ? '+1 level' :
                       t.special_rules?.toLowerCase().includes('extreme cold') ? 'Hypothermia' :
                       'Depth-based'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
