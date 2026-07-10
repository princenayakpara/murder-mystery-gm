import React, { useEffect, useRef } from 'react';
import { useGame } from './state/GameContext.jsx';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Briefing from './pages/Briefing.jsx';
import Investigation from './pages/Investigation.jsx';
import Reveal from './pages/Reveal.jsx';
import PastGames from './pages/PastGames.jsx';
import AudioControl from './components/AudioControl.jsx';
import { audioEngine } from './audio/audioEngine.js';

export default function App() {
  const { state, setView } = useGame();
  const revealStingPlayed = useRef(false);

  // Browsers block audio until a real user gesture happens anywhere on the page —
  // unlock on the first click/keypress rather than requiring the user to specifically
  // touch the volume control first.
  useEffect(() => {
    const unlock = () => {
      audioEngine.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Ambient bed plays only during active investigation; stops on any other screen.
  useEffect(() => {
    if (state.status === 'investigating') {
      audioEngine.startAmbient();
    } else {
      audioEngine.stopAmbient();
    }
  }, [state.status]);

  // One-shot reveal sting, fired once per game when the solution lands.
  useEffect(() => {
    if (state.status === 'revealed' && !revealStingPlayed.current) {
      revealStingPlayed.current = true;
      audioEngine.play('reveal');
    }
    if (state.status !== 'revealed') revealStingPlayed.current = false;
  }, [state.status]);

  // Event-injection / accusation stings, driven off new transcript entries.
  const lastSeenLength = useRef(0);
  useEffect(() => {
    const newMessages = state.transcript.slice(lastSeenLength.current);
    lastSeenLength.current = state.transcript.length;
    newMessages.forEach((m) => {
      if (m.type === 'event') audioEngine.play('event');
      if (m.type === 'accusation') audioEngine.play('accusation');
    });
  }, [state.transcript]);

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
        <div className="header-controls">
          {!state.connected && <span className="conn-badge conn-bad">reconnecting…</span>}
          <AudioControl />
        </div>
      </header>
      <main className="app-main">{body}</main>
    </div>
  );
}
