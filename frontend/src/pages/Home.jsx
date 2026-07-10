import React, { useState } from 'react';
import { useGame } from '../state/GameContext.jsx';

export default function Home() {
  const { state, createRoom, joinRoom, clearError, setView } = useGame();
  const [hostName, setHostName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  return (
    <div className="page-centered">
      <div className="hero">
        <h1>Khoon Ki Baraat</h1>
        <p className="subtitle">
          A live-narrated murder mystery for 4+ players. Gather your friends on a voice call, join the same room here,
          and let the AI Game Master run the investigation.
        </p>
      </div>

      {state.error && (
        <div className="banner banner-error">
          {state.error}
          <button className="link-btn" onClick={clearError}>
            dismiss
          </button>
        </div>
      )}

      <div className="card-row">
        <div className="card">
          <h2>Host a game</h2>
          <label>Your display name</label>
          <input value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="e.g. Priya" maxLength={40} />
          <button
            className="primary-btn"
            disabled={!hostName.trim()}
            onClick={() => createRoom(hostName.trim())}
          >
            Create Room
          </button>
        </div>

        <div className="card">
          <h2>Join a game</h2>
          <label>Room code</label>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="A7B2C"
            maxLength={6}
            className="mono-input"
          />
          <label>Your display name</label>
          <input value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="e.g. Arjun" maxLength={40} />
          <button
            className="primary-btn"
            disabled={!joinName.trim() || !roomCode.trim()}
            onClick={() => joinRoom(roomCode.trim(), joinName.trim())}
          >
            Join Room
          </button>
        </div>
      </div>

      <button className="link-btn" onClick={() => setView('past-games')}>
        View past games / replays →
      </button>
    </div>
  );
}
