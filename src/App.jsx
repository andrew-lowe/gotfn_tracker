import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import TravelPanel from './components/TravelPanel';
import TerrainManager from './components/TerrainManager';
import EncounterTableEditor from './components/EncounterTableEditor';
import SessionManager from './components/SessionManager';
import ReferenceCharts from './components/ReferenceCharts';
import CalendarSettings from './components/CalendarSettings';

export default function App() {
  return (
    <>
      <header className="app-header">
        <h1>Forbidden North Tracker</h1>
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            Travel
          </NavLink>
          <NavLink to="/encounters" className={({ isActive }) => isActive ? 'active' : ''}>
            Encounters
          </NavLink>
          <NavLink to="/sessions" className={({ isActive }) => isActive ? 'active' : ''}>
            Sessions
          </NavLink>
          <NavLink to="/reference" className={({ isActive }) => isActive ? 'active' : ''}>
            Reference
          </NavLink>
          <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}>
            Calendar
          </NavLink>
          <NavLink to="/terrains" className={({ isActive }) => isActive ? 'active' : ''}>
            Terrain Settings
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<TravelPanel />} />
          <Route path="/encounters" element={<EncounterTableEditor />} />
          <Route path="/sessions" element={<SessionManager />} />
          <Route path="/reference" element={<ReferenceCharts />} />
          <Route path="/calendar" element={<CalendarSettings />} />
          <Route path="/terrains" element={<TerrainManager />} />
        </Routes>
      </main>
    </>
  );
}
