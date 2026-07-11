import React from 'react';
import { SERVER_URL } from '../../socket.js';

/**
 * Full-bleed scene background. Crossfades between scene keys via a simple opacity
 * transition on the currently-active <img> (respects prefers-reduced-motion via the
 * .vn-scene-bg CSS transition being disabled globally under that media query).
 */
export default function SceneLayer({ sceneUrl, children }) {
  const full = sceneUrl ? `${SERVER_URL}${sceneUrl}` : null;

  return (
    <div className="vn-scene-layer">
      {full && <img key={sceneUrl} src={full} alt="" className="vn-scene-bg" aria-hidden="true" />}
      <div className="vn-scene-overlay" />
      <div className="vn-scene-content">{children}</div>
    </div>
  );
}
