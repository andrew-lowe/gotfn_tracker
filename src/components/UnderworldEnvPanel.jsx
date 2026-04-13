import React, { useState } from 'react';
import { useMode } from '../ModeContext';
import {
  depthToTemperature, applyTerrainOffset, applyWetModifier,
  ARMOR_OPTIONS, armorPenalty, DEPTH_STEPS,
} from '../underworldLogic';
import * as api from '../api';

// Replaces the Weather card when mode === 'underworld'.
export default function UnderworldEnvPanel({ terrain, onLog }) {
  const { depthFeet, setDepth, usingLight, setLight } = useMode();
  const [armor, setArmor] = useState('none');
  const [isWet, setIsWet] = useState(false);
  const [windSound, setWindSound] = useState(null);
  const [depthInput, setDepthInput] = useState(String(depthFeet || 0));

  // Compute effective temperature level.
  const baseTemp = depthToTemperature(depthFeet);
  const terrainOffset = terrain?.special_rules?.includes('one level higher') ? 1 : 0;
  const terrainOverrideCold = terrain?.special_rules?.toLowerCase().includes('extreme cold');

  const tempAfterTerrain = terrainOverrideCold
    ? { level: 0, name: 'Extreme Cold', range: 'Hypothermia applies', save_freq: '1/minute' }
    : applyTerrainOffset(baseTemp, terrainOffset);
  const effectiveTemp = applyWetModifier(tempAfterTerrain, isWet);
  const penalty = armorPenalty(armor);

  const handleRollWind = async () => {
    try {
      const result = await api.rollWindSound();
      setWindSound(result.windSound);
      onLog?.();
    } catch (e) {
      console.error('Failed to roll wind/sound:', e);
    }
  };

  const handleCommitDepth = async () => {
    const d = parseInt(depthInput, 10);
    if (!isNaN(d) && d >= 0 && d !== depthFeet) await setDepth(d);
  };

  const bumpDepth = async (feet) => {
    const next = Math.max(0, depthFeet + feet);
    setDepthInput(String(next));
    await setDepth(next);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Underworld Environment</h3>
        <button className="btn btn-sm btn-primary" onClick={handleRollWind}>Roll Wind &amp; Sound</button>
      </div>

      {/* Depth + hyperthermia */}
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat-item">
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', justifyContent: 'center' }}>
            <input
              type="number"
              className="form-control"
              value={depthInput}
              onChange={(e) => setDepthInput(e.target.value)}
              onBlur={handleCommitDepth}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCommitDepth(); }}
              min="0"
              step="100"
              style={{ width: '90px', textAlign: 'center', fontSize: '1.15rem', fontWeight: 600 }}
            />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ft</span>
          </div>
          <div className="stat-label">Depth below surface</div>
          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {DEPTH_STEPS.map((step) => (
              <React.Fragment key={step}>
                <button className="btn btn-secondary btn-sm" onClick={() => bumpDepth(step)}>+{step >= 1000 ? `${step/1000}k` : step}</button>
              </React.Fragment>
            ))}
            {DEPTH_STEPS.map((step) => (
              <button key={`-${step}`} className="btn btn-secondary btn-sm" onClick={() => bumpDepth(-step)}>−{step >= 1000 ? `${step/1000}k` : step}</button>
            ))}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{effectiveTemp.name}</div>
          <div className="stat-label">
            {effectiveTemp.range || '—'}
            {terrainOffset > 0 && <div style={{ fontSize: '0.7rem', color: 'var(--warning)' }}>terrain +{terrainOffset}</div>}
            {terrainOverrideCold && <div style={{ fontSize: '0.7rem', color: 'var(--info)' }}>hiemal: extreme cold</div>}
            {isWet && effectiveTemp.level !== tempAfterTerrain.level && <div style={{ fontSize: '0.7rem', color: 'var(--info)' }}>wet: -1 level</div>}
          </div>
        </div>
      </div>

      {/* Hyperthermia save preview */}
      {effectiveTemp.save_freq && (
        <div className="weather-effects" style={{ marginTop: '0.5rem' }}>
          <div className="weather-fx-line hypo">
            <span className="weather-fx-tag hypo">
              {terrainOverrideCold ? 'Hypothermia' : 'Hyperthermia'}
            </span>
            {' '}Save vs. paralysis {effectiveTemp.save_freq}
            {penalty !== 0 ? ` (${penalty} from armor)` : ''}. Failure advances one stage.
          </div>
        </div>
      )}

      {/* Armor + wet + light toggles */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.75rem' }}>Armor</label>
          <select className="form-control" value={armor} onChange={(e) => setArmor(e.target.value)}>
            {ARMOR_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label} ({opt.penalty === 0 ? '\u00b10' : opt.penalty})
              </option>
            ))}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={isWet} onChange={(e) => setIsWet(e.target.checked)} />
          Wet (−1 temp level)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={usingLight} onChange={(e) => setLight(e.target.checked)} />
          Artificial light (+2 to wander checks, visible 1.5 mi)
        </label>
      </div>

      {/* Wind & sound result */}
      {windSound && (
        <div className="weather-effects" style={{ marginTop: '0.75rem' }}>
          <div className="weather-fx-line">
            <span className="weather-fx-tag air">{windSound.name}</span>
            {' '}{windSound.wind_mph} mph · sound travels {windSound.sound_feet}' · {windSound.effects}
            {' '}<span className="text-muted">(rolled {windSound.roll}/d6)</span>
          </div>
        </div>
      )}

      {!windSound && (
        <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Wind and sound change rapidly in Malgorgia. Roll once per hour.
        </p>
      )}
    </div>
  );
}
