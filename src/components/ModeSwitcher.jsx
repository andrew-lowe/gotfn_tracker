import React from 'react';
import { useMode } from '../ModeContext';

export default function ModeSwitcher() {
  const { mode, setMode, loaded } = useMode();
  if (!loaded) return null;

  const isUnder = mode === 'underworld';
  return (
    <button
      type="button"
      className={`mode-switcher ${isUnder ? 'mode-underworld' : 'mode-surface'}`}
      onClick={() => setMode(isUnder ? 'surface' : 'underworld')}
      title={isUnder ? 'Switch to surface (Forbidden North)' : 'Descend into the underworld (Malgorgia)'}
    >
      <span className="mode-chip">{isUnder ? 'UNDERWORLD' : 'SURFACE'}</span>
      <span className="mode-switch-hint">click to {isUnder ? 'ascend' : 'descend'}</span>
    </button>
  );
}
