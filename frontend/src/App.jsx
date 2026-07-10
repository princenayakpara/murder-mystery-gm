import React from 'react';
import { useGame } from './state/GameContext.jsx';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Briefing from './pages/Briefing.jsx';
import Investigation from './pages/Investigation.jsx';
import Reveal from './pages/Reveal.jsx';
import PastGames from './pages/PastGames.jsx';

export default function App() {
  const { state, setView } = useGame();

  let body;
  if (state.view === 'past-games') {
    body = <PastGames />;
  } else if (state.view === 'home' || !state.roomCode) {
    body = <Home />;
  } else if (state.status === 'lobby') {
    body = <Lobby />;
  } else if (state.status === 'briefing') {
    body = <Briefing />;
  } else if (state.status === 'investigating') {
    body = <Investigation />;
  } else if (state.status === 'revealed') {
    body = <Reveal />;
  } else {
    body = <Home />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand" onClick={() => !state.roomCode && setView('home')}>
          <span className="brand-icon">🗡️</span>
          <span>AI Murder Mystery — Game Master</span>
        </div>
        {!state.connected && <span className="conn-badge conn-bad">reconnecting…</span>}
      </header>
      <main className="app-main">{body}</main>
    </div>
  );
}
