import React from 'react';

export default function TerrainCard({ terrain, travelSpeed }) {
  if (!terrain) {
    return (
      <div className="card">
        <p className="text-muted">No terrain selected. Enter a hex to begin tracking.</p>
      </div>
    );
  }

  const visibilityDisplay = terrain.visibility || (terrain.visibility_miles != null ? `${terrain.visibility_miles} mi` : null);

  return (
    <div className="card" style={{ borderLeft: `4px solid ${terrain.color}` }}>
      <div className="card-header">
        <h2>
          <span className="terrain-swatch" style={{ background: terrain.color }} />
          {terrain.name}
          {terrain.hex_type && (
            <span className="terrain-hex-type">{terrain.hex_type}</span>
          )}
        </h2>
        {terrain.losing_direction_chance && (
          <span className="badge badge-warning">Lost direction risk: {terrain.losing_direction_chance}</span>
        )}
      </div>

      {terrain.description && (
        <div className="terrain-section terrain-description">
          <div className="terrain-section-label">Description</div>
          <p>{terrain.description}</p>
        </div>
      )}

      {terrain.special_rules && (
        <div className="terrain-section terrain-special-rules">
          <div className="terrain-section-label">Special Rules</div>
          <p>{terrain.special_rules}</p>
        </div>
      )}

      {travelSpeed && (
        <div className="stat-grid mb-1">
          <div className="stat-item">
            <div className="stat-value">{travelSpeed.milesPerDay}</div>
            <div className="stat-label">Miles / Day</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{travelSpeed.hexesPerDay}</div>
            <div className="stat-label">Hexes / Day</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{travelSpeed.hoursPerHex}</div>
            <div className="stat-label">Hours / Hex</div>
          </div>
        </div>
      )}
      {terrain.travel_speed_notes && (
        <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>{terrain.travel_speed_notes}</p>
      )}

      <div className="terrain-props">
        {visibilityDisplay && (
          <div className="terrain-prop">
            <span className="prop-label">Visibility</span>
            <span className="prop-value">{visibilityDisplay}</span>
          </div>
        )}
        <div className="terrain-prop">
          <span className="prop-label">Speed Modifier</span>
          <span className="prop-value">
            {terrain.travel_speed_modifier != null
              ? `${terrain.travel_speed_modifier > 0 ? '+' : ''}${Math.round(terrain.travel_speed_modifier * 100)}%`
              : 'N/A'}
          </span>
        </div>
        {terrain.foraging_chance && (
          <div className="terrain-prop">
            <span className="prop-label">Foraging</span>
            <span className="prop-value">{terrain.foraging_chance}{terrain.foraging_yield ? ` (${terrain.foraging_yield})` : ''}</span>
          </div>
        )}
        {terrain.foraging_notes && (
          <div className="terrain-prop terrain-prop-wide">
            <span className="prop-label">Forage Notes</span>
            <span className="prop-value">{terrain.foraging_notes}</span>
          </div>
        )}
        {terrain.hunting_chance && (
          <div className="terrain-prop">
            <span className="prop-label">Hunting</span>
            <span className="prop-value">{terrain.hunting_chance}{terrain.hunting_yield ? ` (${terrain.hunting_yield})` : ''}</span>
          </div>
        )}
        {terrain.fishing_chance && (
          <div className="terrain-prop">
            <span className="prop-label">Fishing</span>
            <span className="prop-value">{terrain.fishing_chance}{terrain.fishing_yield ? ` (${terrain.fishing_yield})` : ''}</span>
          </div>
        )}
        {terrain.wandering_monster_chance && (
          <div className="terrain-prop">
            <span className="prop-label">Monster Chance</span>
            <span className="prop-value">{terrain.wandering_monster_chance}{terrain.wandering_monster_frequency ? ` (${terrain.wandering_monster_frequency})` : ''}</span>
          </div>
        )}
        {terrain.encounter_distance && (
          <div className="terrain-prop">
            <span className="prop-label">Encounter Dist</span>
            <span className="prop-value">{terrain.encounter_distance} yd</span>
          </div>
        )}
        {terrain.evasion_modifier && (
          <div className="terrain-prop">
            <span className="prop-label">Evasion Mod</span>
            <span className="prop-value">{terrain.evasion_modifier}</span>
          </div>
        )}
        {terrain.losing_direction_chance && (
          <div className="terrain-prop">
            <span className="prop-label">Lost Direction</span>
            <span className="prop-value">{terrain.losing_direction_chance}{terrain.losing_direction_frequency ? ` (${terrain.losing_direction_frequency})` : ''}</span>
          </div>
        )}
        {terrain.losing_direction_notes && (
          <div className="terrain-prop terrain-prop-wide">
            <span className="prop-label">Lost Dir. Notes</span>
            <span className="prop-value">{terrain.losing_direction_notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
