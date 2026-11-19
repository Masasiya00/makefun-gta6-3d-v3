// Procedural WebAudio sound for Solmar Bay 3D: engine, sirens, gunshots,
// footsteps, waves, and three radio stations. No audio files anywhere.
export function createAudio() {
  const audio = { ctx: null, master: null, musicGain: null, engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null, muted: false, radioStep: 0, radioTimer: 0, started: false };
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.16;
    audio.musicGain.connect(audio.master);
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 60;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenOsc.frequency.value = 700;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    audio.started = true;
  } catch (e) { audio.started = false; }
  return audio;
}

export function resumeAudio(audio) {
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
}

function blip(audio, freq, dur, type, vol, slideTo) {
  if (!audio.ctx || audio.muted) return;
  try {
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(audio.master);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}

function noiseBurst(audio, dur, vol, low) {
  if (!audio.ctx || audio.muted) return;
  try {
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const f = audio.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = low || 1200;
    const g = audio.ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(audio.master);
    src.start(t);
  } catch (e) {}
}

export function playGunshot(audio) { noiseBurst(audio, 0.14, 0.4, 1800); blip(audio, 180, 0.08, 'square', 0.25, 60); }
export function playPunch(audio) { noiseBurst(audio, 0.08, 0.25, 500); }
export function playPickup(audio) { blip(audio, 660, 0.12, 'sine', 0.2, 990); }
export function playCash(audio) { blip(audio, 880, 0.1, 'sine', 0.2, 1320); setTimeout(() => blip(audio, 1320, 0.14, 'sine', 0.18, 1760), 90); }
export function playSirenBlip(audio) { blip(audio, 900, 0.2, 'sine', 0.12, 1400); }
export function playCrash(audio) { noiseBurst(audio, 0.3, 0.5, 700); }
export function playClick(audio) { blip(audio, 1200, 0.05, 'sine', 0.12); }
export function playMissionDone(audio) {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(audio, f, 0.22, 'triangle', 0.22), i * 110));
}
export function playBusted(audio) { blip(audio, 220, 0.6, 'sawtooth', 0.25, 110); }

const CHILL = [262, 330, 392, 494, 392, 330, 262, 196];
const DANCE = [220, 262, 330, 262, 294, 392, 330, 262];
const TALK = [196, 196, 247, 196, 165, 196, 220, 196];

export function updateAudio(audio, state, dt) {
  if (!audio.ctx || audio.muted) return;
  const speed = Math.abs(state.speedKmh || 0);
  if (audio.engineGain) audio.engineGain.gain.value = state.player.onFoot ? 0 : 0.02 + speed * 0.0009;
  if (audio.engineOsc) audio.engineOsc.frequency.value = 55 + speed * 1.6;
  if (audio.sirenGain) {
    const target = state.wanted > 0 ? 0.045 : 0;
    audio.sirenGain.gain.value += (target - audio.sirenGain.gain.value) * dt * 2;
    if (audio.sirenOsc) audio.sirenOsc.frequency.value = 650 + Math.sin(state.time * 3) * 220;
  }
  // Radio: a gentle looping melody, different per station.
  audio.radioTimer -= dt;
  if (audio.radioTimer <= 0) {
    audio.radioTimer = state.radio === 1 ? 0.22 : 0.42;
    const scale = state.radio === 0 ? CHILL : state.radio === 1 ? DANCE : TALK;
    const note = scale[audio.radioStep % scale.length];
    audio.radioStep++;
    if (state.radio !== 2) blip(audio, note, 0.3, state.radio === 1 ? 'square' : 'triangle', 0.07);
    else if (audio.radioStep % 8 === 0) blip(audio, note, 0.15, 'sine', 0.05);
  }
}
