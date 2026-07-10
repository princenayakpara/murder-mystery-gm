// Lightweight synthesized audio engine using the Web Audio API.
//
// No bundled audio assets are used here — there's no royalty-free sample library
// available in this project, and shipping real music/SFX files would mean either
// pulling in copyrighted content or a third-party asset pipeline neither requested
// nor available. Instead, every sound (the ambient bed and all three stings) is
// synthesized in code from oscillators/noise/filters, which is legally clean by
// construction (nothing is "used", everything is generated) and needs no asset
// hosting. If real recorded audio is ever wanted, only this file needs to change —
// callers just invoke play('event') / play('accusation') / play('reveal') and
// startAmbient()/stopAmbient(), regardless of what's behind them.

const STORAGE_KEY = 'mm_audio_prefs';

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { muted: false, volume: 0.5 };
    const parsed = JSON.parse(raw);
    return {
      muted: Boolean(parsed.muted),
      volume: typeof parsed.volume === 'number' ? parsed.volume : 0.5,
    };
  } catch {
    return { muted: false, volume: 0.5 };
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable (private mode etc.) — audio prefs just won't persist.
  }
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.ambientNodes = [];
    this.prefs = loadPrefs();
    this.listeners = new Set();
    this.ambientRunning = false;
  }

  _ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.prefs.muted ? 0 : this.prefs.volume;
    this.masterGain.connect(this.ctx.destination);
    return this.ctx;
  }

  /** Must be called from a user-gesture handler (click/tap) — browsers block autoplay otherwise. */
  unlock() {
    const ctx = this._ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  getPrefs() {
    return { ...this.prefs };
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _notify() {
    this.listeners.forEach((fn) => fn(this.getPrefs()));
  }

  _applyGain() {
    if (!this.masterGain) return;
    const target = this.prefs.muted ? 0 : this.prefs.volume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  setMuted(muted) {
    this.prefs.muted = muted;
    savePrefs(this.prefs);
    this._applyGain();
    this._notify();
  }

  toggleMuted() {
    this.setMuted(!this.prefs.muted);
  }

  setVolume(volume) {
    this.prefs.volume = Math.max(0, Math.min(1, volume));
    savePrefs(this.prefs);
    this._applyGain();
    this._notify();
  }

  /** Starts a low, looping ambient drone (two detuned sines + slow filtered noise). Idempotent. */
  startAmbient() {
    const ctx = this._ensureContext();
    if (!ctx || this.ambientRunning) return;
    this.ambientRunning = true;

    const bed = ctx.createGain();
    bed.gain.value = 0.35;
    bed.connect(this.masterGain);
    this.ambientGain = bed;

    // Two slightly detuned low drones for a slow "beating" unease.
    [55, 55.6].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g);
      g.connect(bed);
      osc.start();
      this.ambientNodes.push(osc, g);
    });

    // Slow filtered noise bed for "rain/room tone" texture.
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.06;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(bed);
    noise.start();
    this.ambientNodes.push(noise, filter, noiseGain);

    // Gentle slow LFO breathing on the whole bed so it doesn't feel static.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain);
    lfoGain.connect(bed.gain);
    lfo.start();
    this.ambientNodes.push(lfo, lfoGain);
  }

  stopAmbient() {
    if (!this.ambientRunning) return;
    this.ambientNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch {
        // already stopped/disconnected — fine
      }
    });
    this.ambientNodes = [];
    this.ambientRunning = false;
  }

  /** One-shot synthesized stings for key moments. type: 'event' | 'accusation' | 'reveal'. */
  play(type) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'event') {
      // A short rising two-note chime — "new clue" feel.
      [440, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now + i * 0.12);
        g.gain.linearRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.55);
      });
    } else if (type === 'accusation') {
      // A sharp dissonant stab.
      [220, 233.08].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        osc.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.45);
      });
    } else if (type === 'reveal') {
      // A slow dramatic descending chord.
      [523.25, 415.3, 349.23].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now + i * 0.25);
        g.gain.linearRampToValueAtTime(0.28, now + i * 0.25 + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 2.2);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now + i * 0.25);
        osc.stop(now + i * 0.25 + 2.3);
      });
    }
  }
}

export const audioEngine = new AudioEngine();
