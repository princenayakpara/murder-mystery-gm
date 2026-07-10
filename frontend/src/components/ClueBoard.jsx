import React from 'react';

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ClueBoard({ clues }) {
  return (
    <div className="clue-board">
      <h2>Clue Board</h2>
      {clues.length === 0 ? (
        <p className="muted">No evidence has surfaced yet. Keep talking — or ask the Game Master to inspect something.</p>
      ) : (
        <ul className="clue-list">
          {clues.map((c) => (
            <li key={c.id} className="clue-card">
              <div className="clue-meta">
                <span className="tag">{c.characterName}</span>
                <span className="clue-time">{timeLabel(c.ts)}</span>
              </div>
              <div className="clue-text">{c.text}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
