import { useEffect, useState, useCallback } from 'react';
import { audioEngine } from './audioEngine.js';

/** React binding over the singleton audioEngine — keeps prefs (mute/volume) in sync with UI. */
export function useAudio() {
  const [prefs, setPrefs] = useState(audioEngine.getPrefs());

  useEffect(() => {
    return audioEngine.subscribe(setPrefs);
  }, []);

  const toggleMuted = useCallback(() => {
    audioEngine.unlock();
    audioEngine.toggleMuted();
  }, []);

  const setVolume = useCallback((v) => {
    audioEngine.unlock();
    audioEngine.setVolume(v);
  }, []);

  const play = useCallback((type) => {
    audioEngine.play(type);
  }, []);

  return { ...prefs, toggleMuted, setVolume, play };
}
