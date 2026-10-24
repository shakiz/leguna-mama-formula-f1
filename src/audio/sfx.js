// Placeholder sounds synthesised with Web Audio: zero download. Swap in recorded clips via memes.json `audio`.
import { load, save } from '../storage.js';

let ctx = null;
let master = null;
let muted = load('muted', false);
let noiseBuf = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  save('muted', m);
  if (master) master.gain.value = m ? 0 : 0.7;
}

function tone(type, f0, f1, dur, vol = 0.3, when = 0, out = master) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, vol, filterType, f0, f1, when = 0, out = master) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const SFX = {
  // Two-tone bus horn: "pyaa-pou pyaa-pou"
  horn: () => {
    for (const w of [0, 0.24]) {
      tone('square', 415, 415, 0.2, 0.12, w);
      tone('square', 523, 523, 0.2, 0.1, w);
    }
  },
  bell: () => {
    for (let i = 0; i < 3; i++) {
      tone('sine', 2100, 2100, 0.12, 0.18, i * 0.12);
      tone('sine', 3150, 3150, 0.1, 0.07, i * 0.12);
    }
  },
  crash: () => {
    noise(0.55, 0.7, 'lowpass', 3500, 150);
    tone('sine', 150, 40, 0.45, 0.6);
  },
  splash: () => noise(0.7, 0.45, 'bandpass', 2600, 350),
  coin: () => {
    tone('square', 988, 988, 0.08, 0.1);
    tone('square', 1319, 1319, 0.25, 0.1, 0.08);
  },
  // Helper slapping the side of the leguna: "thap thap!"
  slap: () => {
    for (const w of [0, 0.14]) {
      noise(0.07, 0.7, 'highpass', 900, 700, w);
      tone('sine', 190, 80, 0.1, 0.45, w);
    }
  },
  whoosh: () => noise(0.35, 0.4, 'bandpass', 350, 3200),
  moo: () => {
    tone('sawtooth', 170, 105, 1.0, 0.14);
    tone('sine', 85, 60, 1.0, 0.2);
  },
  whistle: () => {
    tone('sine', 2800, 2900, 0.15, 0.15);
    tone('sine', 2800, 3000, 0.35, 0.15, 0.2);
  },
  // Cartoon "boing" for the dramatic meme moments
  boing: () => tone('sine', 180, 720, 0.3, 0.3),
  sad: () => [392, 370, 349, 262].forEach((f, i) => tone('triangle', f, f * (i === 3 ? 0.9 : 1), i === 3 ? 0.7 : 0.28, 0.2, i * 0.3)),
  sting: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, i === 3 ? 0.6 : 0.25, 0.2, i * 0.12)),
  tap: () => tone('sine', 660, 880, 0.08, 0.15),
};

export function play(name) {
  if (!ctx || muted || !SFX[name]) return;
  SFX[name]();
}

// Simple dhol-style loop: "dhum" bass hits and "ta" slaps on a 16-step grid
const PATTERN = { dhum: [0, 6, 10], ta: [4, 12, 14] };
let musicTimer = null;
let musicBus = null;

export function startMusic(bpm = 112) {
  if (!ctx || musicTimer) return;
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.35;
  musicBus.connect(master);
  const stepDur = 60 / bpm / 4;
  let step = 0;
  let next = ctx.currentTime + 0.05;
  musicTimer = setInterval(() => {
    while (next < ctx.currentTime + 0.12) {
      const when = next - ctx.currentTime;
      if (PATTERN.dhum.includes(step)) tone('sine', 110, 48, 0.32, 0.7, when, musicBus);
      if (PATTERN.ta.includes(step)) noise(0.09, 0.45, 'bandpass', 1800, 1200, when, musicBus);
      if (step % 2 === 1) noise(0.03, 0.12, 'highpass', 7000, 6000, when, musicBus);
      step = (step + 1) % 16;
      next += stepDur;
    }
  }, 25);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
  if (musicBus) {
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    const bus = musicBus;
    setTimeout(() => bus.disconnect(), 600);
    musicBus = null;
  }
}
