import React, { useState } from 'react';
import Avatar from '../Avatar.jsx';

/**
 * Small portrait thumbnail strip along the top of the VN scene. Clicking a suspect
 * shows their public bio / who's playing them in a small popover — additive polish,
 * it never replaces the chat log or any socket-driven state.
 */
export default function RosterStrip({ roster, mySlot, activeSlot }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="vn-roster-strip">
      {roster.map((c) => (
        <div key={c.slot} className="vn-roster-item-wrap">
          <button
            type="button"
            className={
              'vn-roster-thumb' +
              (c.slot === activeSlot ? ' vn-roster-thumb-active' : '') +
              (c.slot === mySlot ? ' vn-roster-thumb-mine' : '')
            }
            onClick={() => setExpanded(expanded === c.slot ? null : c.slot)}
            title={c.name}
          >
            <Avatar src={c.avatarUrl} name={c.name} size={44} />
          </button>
          {expanded === c.slot && (
            <div className="vn-roster-popover">
              <strong>{c.name}</strong>
              <span className="muted small">{c.controlledBy ? `played by ${c.controlledBy}` : 'NPC'}</span>
              <p>{c.publicBio}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
