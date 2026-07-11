import React from 'react';
import { useGame } from '../state/GameContext.jsx';
import SceneLayer from '../components/vn/SceneLayer.jsx';
import PortraitDock from '../components/vn/PortraitDock.jsx';
import DialogueBox from '../components/vn/DialogueBox.jsx';

export default function Reveal() {
  const { state, startNewGame, setView } = useGame();
  const payload = state.reveal;

  if (!payload) {
    return (
      <div className="page-centered">
        <p>The Game Master is finalizing the reveal…</p>
      </div>
    );
  }

  const { reveal, roster, votes } = payload;
  const nameBySlot = Object.fromEntries(roster.map((r) => [r.slot, r.name]));
  const tally = {};
  Object.values(votes || {}).forEach((targetSlot) => {
    const name = nameBySlot[targetSlot] || 'Unknown';
    tally[name] = (tally[name] || 0) + 1;
  });

  const correctVoters = Object.entries(votes || {}).filter(([, target]) => target === reveal.murdererSlot).length;
  const totalVoters = Object.keys(votes || {}).length;
  const murdererAvatar = roster.find((r) => r.slot === reveal.murdererSlot)?.avatarUrl;

  return (
    <div className="page-narrow">
      <div className="hero">
        <p className="eyebrow">Case Closed</p>
        <h1>The murderer was {reveal.murdererName}</h1>
        {totalVoters > 0 && (
          <p className="subtitle">
            {correctVoters}/{totalVoters} investigators voted correctly.
          </p>
        )}
      </div>

      {state.scenes?.reveal && (
        <div className="vn-stage">
          <SceneLayer sceneUrl={state.scenes.reveal}>
            <div className="vn-portrait-row">
              <PortraitDock name={reveal.murdererName} avatarUrl={murdererAvatar} side="right" />
            </div>
            <DialogueBox
              speakerName="Game Master"
              kind="reveal"
              text={`${reveal.murdererName} is the murderer. Read the full case-file reveal below.`}
            />
          </SceneLayer>
        </div>
      )}

      {Object.keys(tally).length > 0 && (
        <div className="card">
          <h2>Final Votes</h2>
          <ul>
            {Object.entries(tally).map(([name, count]) => (
              <li key={name}>
                {name}: {count} vote{count === 1 ? '' : 's'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card reveal-card">
        <pre className="reveal-text">{reveal.text}</pre>
      </div>

      <div className="reveal-actions">
        <button className="primary-btn" onClick={startNewGame}>
          Start a New Game
        </button>
        <button className="link-btn" onClick={() => setView('past-games')}>
          View past games
        </button>
      </div>
    </div>
  );
}
