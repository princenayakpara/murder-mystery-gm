import React from 'react';
import { useAudio } from '../audio/useAudio.js';

export default function AudioControl() {
  const { muted, volume, toggleMuted, setVolume } = useAudio();

  return (
    <div className="audio-control" role="group" aria-label="Sound controls">
      <button
        type="button"
        className="audio-mute-btn"
        onClick={toggleMuted}
        aria-pressed={muted}
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
      </button>
      <input
        type="range"
        className="audio-volume-slider"
        min="0"
        max="1"
        step="0.05"
        value={muted ? 0 : volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        disabled={muted}
      />
    </div>
  );
}
