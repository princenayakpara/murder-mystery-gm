import React from 'react';
import { SERVER_URL } from '../socket.js';

/**
 * Renders a character portrait from the backend's avatarUrl (relative path,
 * e.g. /api/avatars/<case>/<character>.svg), or a generic silhouette placeholder
 * if no avatarUrl is available yet (e.g. before mystery generation completes) —
 * the UI should never show a broken <img>.
 */
export default function Avatar({ src, name, size = 44, className = '' }) {
  const full = src ? (src.startsWith('http') ? src : `${SERVER_URL}${src}`) : null;

  if (!full) {
    return (
      <div
        className={`avatar avatar-fallback ${className}`}
        style={{ width: size, height: size }}
        aria-label={name || 'Unknown character'}
      >
        {(name || '?').slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={full}
      alt={name ? `Portrait of ${name}` : 'Character portrait'}
      className={`avatar ${className}`}
      style={{ width: size, height: size }}
      width={size}
      height={size}
      loading="lazy"
    />
  );
}
