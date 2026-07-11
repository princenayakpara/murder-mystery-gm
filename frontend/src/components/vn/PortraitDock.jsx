import React from 'react';
import Avatar from '../Avatar.jsx';

/**
 * Large docked portrait of whoever is "speaking" right now (a player's chat message,
 * an accusation, or the Game Master itself). Docks right for players, left for the
 * Game Master/narrator, so the two voices stay visually distinct without extra UI.
 */
export default function PortraitDock({ name, avatarUrl, side = 'right', isGM = false, pressured = false }) {
  return (
    <div className={`vn-portrait-dock vn-portrait-${side} ${pressured ? 'vn-portrait-pressured' : ''}`}>
      <Avatar
        src={avatarUrl}
        name={name}
        size={120}
        className={isGM ? 'vn-portrait-img vn-portrait-gm' : 'vn-portrait-img'}
      />
    </div>
  );
}
