// Placeholder sounds synthesised with Web Audio: zero download. Swap in recorded clips via memes.json `audio`.
// The engine is the exception: a recorded loop, with a synth stand-in (see the engine section).
// Recorded clips (playClip) are voices: one plays at a time and the music, ambience and engine duck under it.
import { load, save } from '../storage.js';

let ctx = null;
let master = null;
let muted = load('muted', false);
let noiseBuf = null;
// Recorded clips: url -> { data: Promise<ArrayBuffer|null>, buffer: AudioBuffer|null }
const clips = new Map();
// Voice clips playing right now (every playClip), each { src, g }
const voices = new Set();
// Ducking stages between the beds and master: music, ambience and engine buses plug into these, so
// ducking never fights the buses' own fades and speed ramps
let duck = null;
const DUCK = { music: 0.35, ambience: 0.35, engine: 0.7 }; // bed levels while a voice talks

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
    duck = {};
    for (const k of Object.keys(DUCK)) duck[k] = gainNode(1, master);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });
    clips.forEach(decodeClip);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

// Clips download in the background; decoding needs an AudioContext, so it waits for the first tap
export function preloadClips(urls) {
  for (const url of urls) {
    if (clips.has(url)) continue;
    const entry = { buffer: null, decoding: null };
    entry.data = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    clips.set(url, entry);
    if (ctx) decodeClip(entry);
  }
}

function decodeClip(entry) {
  if (entry.decoding) return;
  entry.decoding = entry.data
    .then((d) => d && ctx.decodeAudioData(d))
    .then((b) => {
      entry.buffer = b || null;
    })
    .catch(() => {});
}

// Every clip played here is a voice: one at a time (a new one cuts off the last with a quick fade),
// and the music, ambience and engine duck under it. Returns false when the clip is missing or not
// decoded yet, so the caller can fall back to a synth sound.
export function playClip(url, volume = 1) {
  const entry = clips.get(url);
  if (!ctx || muted || !entry?.buffer) return false;
  const t = ctx.currentTime;
  for (const v of voices) {
    v.g.gain.setValueAtTime(v.g.gain.value, t);
    v.g.gain.linearRampToValueAtTime(0, t + 0.06);
    v.src.stop(t + 0.07);
    voices.delete(v); // fading out: stop() it only once
  }
  const src = ctx.createBufferSource();
  src.buffer = entry.buffer;
  const g = gainNode(volume, master);
  src.connect(g);
  const v = { src, g };
  voices.add(v);
  // Also fires when a newer voice stops this one; the beds come back only once nobody is talking
  src.onended = () => {
    voices.delete(v);
    g.disconnect();
    if (!voices.size) setDuck(false);
  };
  setDuck(true);
  src.start(t);
  return true;
}

// Down over ~120 ms when a voice starts, back up over ~300 ms after the last one ends
function setDuck(on) {
  const t = ctx.currentTime;
  for (const [k, level] of Object.entries(DUCK)) duck[k].gain.setTargetAtTime(on ? level : 1, t, on ? 0.04 : 0.1);
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

// A held note (unlike tone(), which decays): quick attack, sustain, short release, softened by a lowpass
function blare(freq, dur, vol, when = 0) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1100;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
  g.gain.setValueAtTime(vol, t + dur - 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// One second of white noise, shared by every noise sound and looped for the continuous beds
function noiseBuffer() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noise(dur, vol, filterType, f0, f1, when = 0, out = master) {
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
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
  // Private car's polite "pip-pip"
  beep: () => {
    tone('square', 880, 880, 0.09, 0.1);
    tone('square', 880, 880, 0.12, 0.1, 0.13);
  },
  // Bumped car driver leaning on the horn: one long blast, then three angry jabs
  angryhonk: () => {
    tone('square', 370, 370, 0.55, 0.13);
    tone('square', 466, 466, 0.55, 0.1);
    for (const w of [0.65, 0.85, 1.05]) {
      tone('square', 370, 370, 0.13, 0.13, w);
      tone('square', 466, 466, 0.13, 0.1, w);
    }
  },
  // Bumper-on-bumper: metal crunch with a clank on top
  crunch: () => {
    noise(0.3, 0.8, 'bandpass', 1800, 500);
    tone('triangle', 1250, 900, 0.18, 0.15);
    tone('triangle', 1720, 1300, 0.22, 0.1, 0.03);
    tone('sine', 120, 45, 0.3, 0.6);
  },
  // Stand-in for the helper's shout until a voice clip is recorded: "ba-me plas-tic" rhythm
  helper: () => [520, 470, 600, 540].forEach((f, i) => tone('sawtooth', f, f * 0.92, 0.1, 0.07, i * 0.11)),
  // Front wheels, then back wheels, over a speed breaker
  thud: () => {
    for (const w of [0, 0.16]) {
      tone('sine', 110, 45, 0.18, 0.7, w);
      noise(0.08, 0.35, 'lowpass', 900, 300, w);
    }
  },
  // Wheel dropping into a pothole: a heavy clunk and a rattle
  clunk: () => {
    tone('sine', 90, 35, 0.3, 0.8);
    noise(0.25, 0.5, 'bandpass', 1400, 300, 0.02);
    tone('triangle', 900, 700, 0.08, 0.1, 0.05);
  },
  ding: () => {
    tone('sine', 1175, 1175, 0.35, 0.18);
    tone('sine', 1760, 1760, 0.25, 0.06);
  },
  // BRTC double-decker's diesel air horn: two long, low blasts, the second a step lower ("bhoooo-bhaaa")
  airhorn: () => {
    for (const [w, k, dur] of [[0, 1, 0.55], [0.62, 0.84, 0.75]]) {
      blare(155 * k, dur, 0.16, w);
      blare(196 * k, dur, 0.12, w);
      tone('sine', 78 * k, 78 * k, dur, 0.25, w);
    }
  },
  // Big diesel engine rolling past: a deep growl that swells and fades
  rumble: () => {
    noise(0.9, 0.6, 'lowpass', 260, 70);
    tone('sawtooth', 52, 44, 0.9, 0.12);
  },
  // Leguna into a double-decker: a longer, deeper crash with a sheet-metal clang
  bigcrash: () => {
    noise(0.9, 0.8, 'lowpass', 2800, 80);
    tone('sine', 95, 30, 0.8, 0.75);
    tone('triangle', 620, 430, 0.5, 0.14, 0.05);
    tone('triangle', 910, 650, 0.35, 0.08, 0.08);
  },
  bonus: () => {
    tone('square', 1319, 1319, 0.06, 0.08);
    tone('square', 1760, 1760, 0.14, 0.08, 0.06);
  },
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
  musicBus.connect(duck.music);
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

// Haptic feedback for hard knocks. Part of the feedback the mute button turns off; a no-op where
// vibration isn't supported (iPhone Safari, desktops)
export function vibrate(pattern) {
  if (muted || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw instead of ignoring a vibration they won't allow
  }
}

function loopNoise() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  src.start();
  return src;
}

function filter(type, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function gainNode(value, out) {
  const g = ctx.createGain();
  g.gain.value = value;
  if (out) g.connect(out);
  return g;
}

// Fades a bus out, then stops its sources and unplugs it
function fadeOut(bus, sources) {
  bus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  setTimeout(() => {
    for (const s of sources) s.stop();
    bus.disconnect();
  }, 500);
}

// --- engine -------------------------------------------------------------------
// The recorded leguna engine (made by tools/enhance_engine.py) loops under the race; its pitch and
// volume follow the speed and it idles quietly at a standstill. Until the file has decoded, or if it
// fails to load, a synthesised putter (a sawtooth through a lowpass) plus tyre roar (filtered noise)
// stands in.
const ENGINE_URL = 'audio/engine/leguna-engine.mp3';
// The file wraps 0.1 s of audio around a 3.5 s loop, so this region loops cleanly whether or not the
// browser trims the MP3's encoder padding. Keep in sync with --length in the script.
const ENGINE_LOOP_START = 0.1;
const ENGINE_LOOP_LENGTH = 3.5;
let engine = null;

// Fetches now; decodes with the other clips after the first tap
export function preloadEngine() {
  preloadClips([ENGINE_URL]);
}

export function startEngine() {
  if (!ctx || engine) return;
  engine = { bus: gainNode(0, duck.engine), synth: null, rec: null, ratio: -1, braking: false };
  if (!startRecordedEngine()) startSynthEngine();
}

function startSynthEngine() {
  const out = gainNode(1, engine.bus);
  const body = filter('lowpass', 300, 2);
  body.connect(out);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 40;
  osc.connect(body);
  osc.start();
  const roarGain = gainNode(0, out);
  const src = loopNoise();
  src.connect(filter('bandpass', 420, 0.7)).connect(roarGain);
  engine.synth = { out, osc, body, roarGain, src };
}

// Returns false while the recording isn't decoded (or never will be)
function startRecordedEngine() {
  const buffer = clips.get(ENGINE_URL)?.buffer;
  if (!buffer) return false;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.loopStart = ENGINE_LOOP_START;
  src.loopEnd = ENGINE_LOOP_START + ENGINE_LOOP_LENGTH;
  src.playbackRate.value = 0.8;
  src.connect(engine.bus);
  src.start(0, ENGINE_LOOP_START);
  engine.rec = src;
  // The recording took over mid-race: fade the synth out instead of playing both
  if (engine.synth) {
    fadeOut(engine.synth.out, [engine.synth.osc, engine.synth.src]);
    engine.synth = null;
  }
  engine.ratio = -1; // apply the current speed on the next setEngine
  return true;
}

// ratio: speed / BASE_SPEED (1 at cruising, 1.25 with the avenue's speed bonus, 0 when stopped)
export function setEngine(ratio, braking = false) {
  if (!engine) return;
  if (!engine.rec && clips.get(ENGINE_URL)?.buffer) startRecordedEngine();
  const r = Math.min(1.5, Math.max(0, ratio));
  // Called every frame: only reschedule the ramps when the speed or brake has really changed
  if (Math.abs(r - engine.ratio) < 0.01 && braking === engine.braking) return;
  engine.ratio = r;
  engine.braking = braking;
  const t = ctx.currentTime;
  if (engine.rec) {
    // Idle 0.8x, cruising 1x, avenue top speed 1.25x. Quiet idle, fuller at speed and a touch softer
    // on the brake; kept under the dhol, voice clips and event sounds.
    const rate = r <= 1 ? 0.8 + 0.2 * r : Math.min(1.3, r);
    const gain = (r < 0.02 ? 0.08 : 0.12 + 0.08 * Math.min(r, 1.25)) * (braking ? 0.8 : 1);
    engine.rec.playbackRate.setTargetAtTime(rate, t, 0.15);
    engine.bus.gain.setTargetAtTime(gain, t, 0.12);
    return;
  }
  // Synth stand-in: falls silent at a standstill so the street can be heard
  const s = engine.synth;
  engine.bus.gain.setTargetAtTime(r < 0.02 ? 0 : 0.09 + 0.07 * r, t, 0.12);
  s.osc.frequency.setTargetAtTime(38 + 46 * r, t, 0.12);
  s.body.frequency.setTargetAtTime(260 + 420 * r, t, 0.12);
  s.roarGain.gain.setTargetAtTime(0.5 * r * r, t, 0.12);
}

export function stopEngine() {
  if (!engine) return;
  const sources = engine.rec ? [engine.rec] : [];
  if (engine.synth) sources.push(engine.synth.osc, engine.synth.src);
  fadeOut(engine.bus, sources);
  engine = null;
}

// --- ambience -----------------------------------------------------------------
// A quiet street bed per route stretch (`ambience` in config.js): continuous noise layers with a
// loudness of 0–1, and one-off sounds whose number is how many play per second on average.
const LAYERS = {
  hum: { type: 'lowpass', freq: 260, q: 0.7, vol: 0.5 }, // distant traffic
  wind: { type: 'bandpass', freq: 650, q: 0.5, vol: 0.25 }, // open air, gusting
  rain: { type: 'highpass', freq: 3800, q: 0.5, vol: 0.12 }, // rain hiss
};
const SPOTS = {
  horns: () => {
    const f = 300 + Math.random() * 180;
    tone('square', f, f, 0.18 + Math.random() * 0.25, 0.05, 0, ambience.bus);
  },
  bells: () => {
    for (let i = 0; i < 2; i++) tone('sine', 2100, 2100, 0.1, 0.06, i * 0.11, ambience.bus);
  },
  // Murmur of a crowd: a few vowel-ish noise blips
  chatter: () => {
    for (let i = 0; i < 3; i++) {
      const f = 500 + Math.random() * 700;
      noise(0.12, 0.12, 'bandpass', f, f * 0.8, i * 0.14 + Math.random() * 0.05, ambience.bus);
    }
  },
  birds: () => {
    for (let i = 0; i < 2; i++) tone('sine', 3200, 4200, 0.07, 0.04, i * 0.12, ambience.bus);
  },
  drips: () => tone('sine', 1400, 500, 0.06, 0.08, Math.random() * 0.1, ambience.bus),
};
const AMBIENCE_TICK = 0.2; // s between rolls for the one-off sounds
let ambience = null;

export function setAmbience(cfg = {}) {
  if (!ctx) return;
  if (!ambience) {
    const bus = gainNode(0.6, duck.ambience);
    const src = loopNoise();
    const layers = {};
    for (const [name, l] of Object.entries(LAYERS)) {
      layers[name] = gainNode(0, bus);
      src.connect(filter(l.type, l.freq, l.q)).connect(layers[name]);
    }
    // Slow wobble on the wind so it gusts instead of hissing
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.15;
    lfo.connect(gainNode(0.08)).connect(layers.wind.gain);
    lfo.start();
    ambience = { bus, src, lfo, layers, spots: [] };
    ambience.timer = setInterval(() => {
      // A suspended context (hidden tab) would queue these up and play them all at once on return
      if (muted || ctx.state !== 'running') return;
      for (const [fn, rate] of ambience.spots) if (Math.random() < rate * AMBIENCE_TICK) fn();
    }, AMBIENCE_TICK * 1000);
  }
  // Crossfade the layers over a couple of seconds as the stretch changes
  const t = ctx.currentTime;
  for (const [name, l] of Object.entries(LAYERS)) ambience.layers[name].gain.setTargetAtTime((cfg[name] ?? 0) * l.vol, t, 0.8);
  ambience.spots = Object.keys(SPOTS).filter((k) => cfg[k] > 0).map((k) => [SPOTS[k], cfg[k]]);
}

export function stopAmbience() {
  if (!ambience) return;
  clearInterval(ambience.timer);
  fadeOut(ambience.bus, [ambience.src, ambience.lfo]);
  ambience = null;
}
