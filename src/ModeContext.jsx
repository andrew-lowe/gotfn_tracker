import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from './api';

const ModeContext = createContext(null);

export function ModeProvider({ children }) {
  const [mode, setModeState] = useState('surface');
  const [depthFeet, setDepthFeet] = useState(0);
  const [usingLight, setUsingLight] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getMode();
      setModeState(data.mode || 'surface');
      setDepthFeet(data.depth_feet || 0);
      setUsingLight(Boolean(data.using_light));
      setLoaded(true);
    } catch (e) {
      console.error('Failed to load mode:', e);
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reflect the current mode on <body> so CSS can theme the whole tree.
  useEffect(() => {
    document.body.dataset.mode = mode;
  }, [mode]);

  const setMode = useCallback(async (next) => {
    const result = await api.setMode(next);
    setModeState(result.mode);
    setDepthFeet(result.depth_feet || 0);
    setUsingLight(Boolean(result.using_light));
  }, []);

  const setDepth = useCallback(async (feet) => {
    const result = await api.setDepth(feet);
    setDepthFeet(result.depth_feet || 0);
  }, []);

  const setLight = useCallback(async (on) => {
    const result = await api.setUsingLight(Boolean(on));
    setUsingLight(Boolean(result.using_light));
  }, []);

  return (
    <ModeContext.Provider value={{
      mode, setMode,
      depthFeet, setDepth,
      usingLight, setLight,
      loaded,
      reloadMode: load,
    }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}
