// All sound is generated in code with WebAudio: no audio files, no network.
// Engine hum, sirens, gunshots, footsteps, waves and three procedural radio
// stations (a chill synth, an upbeat dance loop and a talk station whose DJ
// lines appear as text). Everything is guarded: if the browser has no audio,
// the game still runs.
import { RADIO_STATIONS, TALK_LINES } from './config.js';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(semitone) { return 440 * Math.pow(2, (semitone - 69) / 12); }

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let station = 0;
  let radioTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let waveGain = null;
  let talkIndex = 0;
  let talkLine = '';
  let stepCount = 0;
  let nextNoteTime = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
      const engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'sawtooth';
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      engineOsc.connect(lp); engineOsc2.connect(lp);
      lp.connect(engineGain); engineGain.connect(master);
      engineOsc.frequency.value = 60; engineOsc2.frequency.value = 63;
      engineOsc.start(); engineOsc2.start();
      // Siren: a triangle that wails between two pitches.
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.frequency.value = 700; sirenOsc.start();
      // Ocean: filtered noise, slow swell.
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.6;
      waveGain = ctx.createGain(); waveGain.gain.value = 0.03;
      noise.connect(bp); bp.connect(waveGain); waveGain.connect(master);
      noise.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(f0, f1, dur, type, vol) {
    if (!ctx) return;
    try {
      const o = ctx.createOscillator(); o.type = type;
      const g = ctx.createGain();
      o.frequency.setValueAtTime(f0, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* audio is best-effort */ }
  }

  function noiseBurst(dur, vol, freqHz) {
    if (!ctx) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freqHz;
      const g = ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch { /* best-effort */ }
  }

  // Radio: a tiny step sequencer. Chill = slow minor pads, dance = four-on-the-
  // floor with a bassline, talk = no music, just DJ text lines.
  const CHILL = [57, 60, 64, 67, 69, 72, 76];
  const DANCE_BASS = [36, 36, 39, 41, 36, 36, 43, 41];
  const DANCE_LEAD = [69, 72, 76, 79, 76, 72, 69, 67];
  function playNote(semi, dur, type, vol) {
    if (!ctx) return;
    try {
      const o = ctx.createOscillator(); o.type = type;
      const g = ctx.createGain();
      o.frequency.value = freq(semi);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* best-effort */ }
  }
  function radioStep() {
    if (!ctx || muted) { stepCount += 1; return; }
    const st = RADIO_STATIONS[station];
    if (st.mood === 'chill') {
      const n = CHILL[stepCount % CHILL.length];
      playNote(n, 1.6, 'sine', 0.10);
      if (stepCount % 4 === 0) playNote(n - 12, 2.0, 'triangle', 0.06);
    } else if (st.mood === 'dance') {
      if (stepCount % 2 === 0) noiseBurst(0.08, 0.16, 3000); // kick-ish tick
      playNote(DANCE_BASS[stepCount % DANCE_BASS.length], 0.22, 'square', 0.07);
      if (stepCount % 2 === 1) playNote(DANCE_LEAD[stepCount % DANCE_LEAD.length], 0.3, 'sawtooth', 0.045);
    } else if (st.mood === 'talk') {
      if (stepCount % 16 === 0) {
        talkLine = TALK_LINES[talkIndex % TALK_LINES.length];
        talkIndex += 1;
        blip(220, 330, 0.15, 'sine', 0.05);
      }
    }
    stepCount += 1;
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    station() { return RADIO_STATIONS[station]; },
    stationIndex() { return station; },
    setStation(i) {
      station = ((i % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
      stepCount = 0; talkLine = '';
      if (ctx && !radioTimer) radioTimer = setInterval(radioStep, 240);
      return RADIO_STATIONS[station];
    },
    nextStation() { return this.setStation(station + 1); },
    talkLine() { return talkLine; },
    startRadio() { ensure(); if (ctx && !radioTimer) radioTimer = setInterval(radioStep, 240); },
    engine(speed01, on) {
      if (!ctx || !engineGain) return;
      try {
        engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.1);
      } catch { /* best-effort */ }
    },
    siren(on) {
      if (!ctx || !sirenGain) return;
      try {
        sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
        if (on) sirenOsc.frequency.setTargetAtTime(650 + Math.sin(performance.now() / 350) * 250, ctx.currentTime, 0.05);
      } catch { /* best-effort */ }
    },
    gunshot(kind) {
      ensure();
      if (kind === 'shotgun') noiseBurst(0.28, 0.5, 900);
      else if (kind === 'smg') noiseBurst(0.09, 0.3, 2200);
      else noiseBurst(0.14, 0.38, 1600);
    },
    punch() { ensure(); noiseBurst(0.07, 0.25, 500); },
    skid() { ensure(); noiseBurst(0.18, 0.12, 1200); },
    pickup() { ensure(); blip(660, 990, 0.18, 'sine', 0.12); },
    cash() { ensure(); blip(880, 1320, 0.12, 'sine', 0.12); setTimeout(() => blip(1320, 1760, 0.12, 'sine', 0.1), 90); },
    missionDone() {
      ensure();
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, f, 0.22, 'triangle', 0.14), i * 110));
    },
    busted() { ensure(); blip(440, 110, 0.8, 'sawtooth', 0.15); },
    click() { ensure(); blip(1200, 900, 0.05, 'square', 0.06); },
    waveLevel(near) { if (waveGain) waveGain.gain.setTargetAtTime(near ? 0.05 : 0.015, ctx.currentTime, 0.5); },
  };
}
