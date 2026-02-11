import React from 'react';

export default function ReferenceCharts() {
  return (
    <div>
      <div className="grid-2">
        <div>
          {/* Weather Conditions */}
          <div className="card ref-chart-card">
            <h4 className="ref-chart-title">Weather Conditions</h4>
            <table className="ref-table">
              <thead>
                <tr><th>Condition</th><th>Effects</th></tr>
              </thead>
              <tbody>
                <tr><td className="ref-label">Clear</td><td>Sunny and clear or lightly clouded. No penalties.</td></tr>
                <tr><td className="ref-label">Clouds</td><td>Totally overcast. No penalties.</td></tr>
                <tr><td className="ref-label">Fog</td><td>Visibility reduced to encounter distance. Missile attacks {'\u2013'}1. Cannot fire beyond fog visibility range. Losing direction +1 on d6.</td></tr>
                <tr><td className="ref-label">Rain</td><td>Visibility reduced to encounter distance. Travellers get wet (see Getting Wet rule).</td></tr>
                <tr><td className="ref-label">Snow</td><td>Visibility reduced to encounter distance.</td></tr>
                <tr><td className="ref-label">Storm</td><td>Visibility reduced to half encounter distance. Losing direction +1 on d6. Travellers get wet.</td></tr>
                <tr><td className="ref-label">Blizzard</td><td>Visibility reduced to half encounter distance. Losing direction +1 on d6.</td></tr>
              </tbody>
            </table>
          </div>

          {/* Air Conditions */}
          <div className="card ref-chart-card">
            <h4 className="ref-chart-title">Air Conditions</h4>
            <table className="ref-table">
              <thead>
                <tr><th>Condition</th><th>Wind Speed</th><th>Effects</th></tr>
              </thead>
              <tbody>
                <tr><td className="ref-label">Calm</td><td className="ref-label">0{'\u2013'}3 mph</td><td>No penalties.</td></tr>
                <tr><td className="ref-label">Breeze</td><td className="ref-label">4{'\u2013'}12 mph</td><td>Missiles {'\u2013'}1 penalty.</td></tr>
                <tr><td className="ref-label">Wind</td><td className="ref-label">13{'\u2013'}31 mph</td><td>Missiles {'\u2013'}2 penalty.</td></tr>
                <tr><td className="ref-label">Gale</td><td className="ref-label">32+ mph</td><td>Missiles {'\u2013'}3 penalty. Cannot fire at long range.</td></tr>
              </tbody>
            </table>
          </div>

          {/* Climate Zones */}
          <div className="card ref-chart-card">
            <h4 className="ref-chart-title">Climate Zones</h4>
            <table className="ref-table">
              <thead>
                <tr><th>Zone</th><th>Temp Modifier</th><th>Hypothermia Save Mod</th></tr>
              </thead>
              <tbody>
                <tr><td className="ref-label">Boreal</td><td>None</td><td>None</td></tr>
                <tr><td className="ref-label">Tundra</td><td>Temp level {'\u2013'}1</td><td>Saves at {'\u2013'}2</td></tr>
                <tr><td className="ref-label">Polar</td><td>Temp level {'\u2013'}2</td><td>Saves at {'\u2013'}4</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {/* Hypothermia Condition */}
          <div className="card ref-chart-card">
            <h4 className="ref-chart-title">Hypothermia Condition</h4>
            <p className="ref-intro">
              If weather conditions cause the referee to call for a hypothermia save, all must save vs. paralysis; anyone failing moves one stage down the hypothermia condition table.
            </p>
            <table className="ref-table">
              <thead>
                <tr><th>Stage</th><th>Condition</th><th>Effects</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td className="ref-label">1</td>
                  <td className="ref-label">Mild</td>
                  <td>Sluggish, drowsy, disoriented. Shivers constantly, numb extremities. <strong>{'\u2013'}1</strong> to hits and saves.</td>
                </tr>
                <tr>
                  <td className="ref-label">2</td>
                  <td className="ref-label">Moderate</td>
                  <td>Stops shivering, loses bladder control. Symptoms increase. <strong>{'\u2013'}2</strong> to hits and saves.</td>
                </tr>
                <tr>
                  <td className="ref-label">3</td>
                  <td className="ref-label">Severe</td>
                  <td>Eyes unresponsive to light. Muscles rigid, breathing slows. <strong>{'\u2013'}3</strong> to hits and saves, plus confusion (roll 1d6 every hour).</td>
                </tr>
                <tr>
                  <td className="ref-label">4</td>
                  <td className="ref-label">Apparent Death</td>
                  <td>Unresponsive, comatose. Without warming, death in <strong>6 {'\u2013'} temp level</strong> turns.</td>
                </tr>
              </tbody>
            </table>
            <p className="ref-intro" style={{ marginTop: '0.5rem' }}>
              Apparent Death example: In cold regions (level 2), death occurs in 4 turns (6 {'\u2013'} 2). In severe cold (level 4), death occurs in 2 turns (6 {'\u2013'} 4).
            </p>
          </div>

          {/* Confusion Table */}
          <div className="card ref-chart-card">
            <h4 className="ref-chart-title">Severe Hypothermia Confusion (1d6)</h4>
            <table className="ref-table">
              <thead>
                <tr><th>Roll</th><th>Effect</th></tr>
              </thead>
              <tbody>
                <tr><td className="ref-label">1</td><td>Begins burrowing behind objects or into the ground to get warm.</td></tr>
                <tr><td className="ref-label">2</td><td>Begins undressing, taking off armor and clothing.</td></tr>
                <tr><td className="ref-label">3</td><td>Speech becomes incoherent babble; can't communicate, cast spells, or use language-dependent abilities.</td></tr>
                <tr><td className="ref-label">4{'\u2013'}6</td><td>Act normally.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
