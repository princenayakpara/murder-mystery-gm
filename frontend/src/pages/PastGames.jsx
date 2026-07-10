import React, { useEffect, useState } from 'react';
import { useGame } from '../state/GameContext.jsx';
import { SERVER_URL } from '../socket.js';

export default function PastGames() {
  const { setView } = useGame();
  const [games, setGames] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/games`)
      .then((r) => r.json())
      .then(setGames)
      .catch(() => setGames([]))
      .finally(() => setLoading(false));
  }, []);

  const openGame = (id) => {
    fetch(`${SERVER_URL}/api/games/${id}`)
      .then((r) => r.json())
      .then(setSelected);
  };

  if (selected) {
    return (
      <div className="page-narrow">
        <button className="link-btn" onClick={() => setSelected(null)}>
          ← back to past games
        </button>
        <div className="hero">
          <h1>{selected.caseTitle}</h1>
          <p className="subtitle">Room {selected.roomCode} — {new Date(selected.finishedAt).toLocaleString()}</p>
        </div>
        <div className="card reveal-card">
          <pre className="reveal-text">{selected.reveal?.text}</pre>
        </div>
        <div className="card">
          <h2>Full Transcript</h2>
          <div className="replay-transcript">
            {selected.transcript.map((m) => (
              <div key={m.id} className="replay-line">
                <strong>{m.authorName || 'System'}:</strong> {m.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-narrow">
      <button className="link-btn" onClick={() => setView('home')}>
        ← back home
      </button>
      <div className="hero">
        <h1>Past Games</h1>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : games.length === 0 ? (
        <p className="muted">No finished games yet. Play one to see it here.</p>
      ) : (
        <ul className="past-games-list">
          {games.map((g) => (
            <li key={g.id} className="card past-game-card" onClick={() => openGame(g.id)}>
              <strong>{g.caseTitle}</strong>
              <span className="muted small">
                Room {g.roomCode} · {g.playerCount} players · {new Date(g.finishedAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
