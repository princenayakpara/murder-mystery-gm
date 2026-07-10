import React, { useState } from 'react';
import { useGame } from '../state/GameContext.jsx';

const THEMES = [
  { value: '', label: 'Indian Wedding (classic)' },
  { value: 'Haunted House', label: 'Haunted House' },
  { value: 'Space Station', label: 'Space Station' },
  { value: 'Cyber Crime', label: 'Cyber Crime' },
  { value: 'Ancient Kingdom', label: 'Ancient Kingdom' },
];

export default function Lobby() {
  const { state, startGame, clearError } = useGame();
  const [theme, setTheme] = useState('');
  const [starting, setStarting] = useState(false);

  const handleStart = () => {
    setStarting(true);
    startGame(theme);
  };

  return (
    <div className="page-centered">
      <div className="hero">
        <h1>Room {state.roomCode}</h1>
        <p className="subtitle">Share this code with your friends. You need at least 4 players to start.</p>
      </div>

      {state.error && (
        <div className="banner banner-error">
          {state.error}
          <button
            className="link-btn"
            onClick={() => {
              clearError();
              setStarting(false);
            }}
          >
            dismiss
          </button>
        </div>
      )}

      <div className="card">
        <h2>Players ({state.players.length})</h2>
        <ul className="player-list">
          {state.players.map((p) => (
            <li key={p.playerId} className={p.connected ? '' : 'disconnected'}>
              <span className="dot" style={{ background: p.connected ? '#57d38c' : '#666' }} />
              {p.name} {p.isHost && <span className="tag">host</span>}
              {!p.connected && <span className="tag tag-muted">offline</span>}
            </li>
          ))}
        </ul>
      </div>

      {state.isHost ? (
        <div className="card">
          <h2>Start the investigation</h2>
          <label>Case theme</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button className="primary-btn" disabled={!state.canStart || starting} onClick={handleStart}>
            {starting ? 'Generating mystery…' : state.canStart ? 'Start Game' : 'Waiting for 4+ players…'}
          </button>
        </div>
      ) : (
        <div className="card">
          <p>Waiting for the host to start the game…</p>
        </div>
      )}
    </div>
  );
}
