import React, { useState } from 'react';

export default function PlayerList({ roster, mySlot, onAccuse }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="player-roster">
      <h2>Suspects</h2>
      <ul className="roster-list">
        {roster.map((c) => (
          <li key={c.slot} className={c.slot === mySlot ? 'roster-card roster-mine' : 'roster-card'}>
            <div className="roster-header" onClick={() => setExpanded(expanded === c.slot ? null : c.slot)}>
              <div>
                <strong>{c.name}</strong>
                {c.controlledBy && <span className="muted small"> — played by {c.controlledBy}</span>}
                {!c.controlledBy && <span className="tag tag-muted">NPC</span>}
              </div>
              <span className="chevron">{expanded === c.slot ? '▾' : '▸'}</span>
            </div>
            {expanded === c.slot && (
              <div className="roster-body">
                <p>{c.publicBio}</p>
                {c.slot !== mySlot && (
                  <button className="accuse-btn" onClick={() => onAccuse(c.slot)}>
                    Accuse {c.name}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
