import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from './api';

const CalendarContext = createContext(null);

export function CalendarProvider({ children }) {
  const [calendar, setCalendar] = useState(null);

  const loadCalendar = useCallback(async () => {
    try {
      const data = await api.getCalendar();
      setCalendar(data);
    } catch (e) {
      console.error('Failed to load calendar:', e);
    }
  }, []);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  return (
    <CalendarContext.Provider value={{ calendar, reloadCalendar: loadCalendar }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider');

  const { calendar, reloadCalendar } = ctx;

  // Build a 1-indexed months array: ['', 'Nikarion', 'Katharion', ...]
  const months = [];
  if (calendar?.months) {
    months.push(''); // index 0 unused
    const sorted = [...calendar.months].sort((a, b) => a.month_number - b.month_number);
    for (const m of sorted) {
      months.push(m.name);
    }
  }

  const monthCount = calendar?.months?.length || 12;
  const eraName = calendar?.config?.era_name ?? 'P.I.';

  const getMonthName = (month) => months[month] || '???';

  /**
   * Get the number of days in a specific month (1-based).
   */
  const getDaysForMonth = (month) => {
    if (!calendar?.months) return 30;
    const m = calendar.months.find(m => m.month_number === month);
    return m?.days ?? 30;
  };

  const formatDate = (day, month, year) => {
    return `${day} ${getMonthName(month)}, ${year} ${eraName}`;
  };

  const getMonthSeason = (month) => {
    if (!calendar?.months) return 'summer';
    const m = calendar.months.find(m => m.month_number === month);
    return m?.season || 'summer';
  };

  return {
    calendar,
    reloadCalendar,
    months,
    monthCount,
    eraName,
    getMonthName,
    getDaysForMonth,
    formatDate,
    getMonthSeason,
  };
}
