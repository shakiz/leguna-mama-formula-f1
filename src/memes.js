import Phaser from 'phaser';
import { play, playClip, preloadClips } from './audio/sfx.js';

let triggers = {};
let events = {};
const bags = {};

export function setMemes(json) {
  triggers = json?.triggers ?? {};
  events = json?.events ?? {};
  const urls = [];
  for (const list of Object.values(triggers)) for (const m of list) urls.push(...[].concat(m.audio ?? []));
  for (const ev of Object.values(events)) urls.push(...[].concat(ev?.audio ?? []));
  preloadClips(urls);
}

// 'closeturn_bike' falls back to 'closeturn', so per-vehicle content is optional
function fallbacks(name) {
  const i = name.indexOf('_');
  return i > 0 ? [name, name.slice(0, i)] : [name];
}

// Shuffle-bag: every variant plays once before any repeats
export function pickMeme(trigger) {
  for (const key of fallbacks(trigger)) {
    const list = triggers[key];
    if (!list?.length) continue;
    if (!bags[key]?.length) bags[key] = Phaser.Utils.Array.Shuffle([...list.keys()]);
    return list[bags[key].pop()];
  }
  return null;
}

export function getEvent(name) {
  for (const key of fallbacks(name)) if (events[key]) return events[key];
  return {};
}

// A recorded clip (random variant) if one has loaded, otherwise the synth placeholder(s)
export function playSound({ audio, sfx, volume = 1 } = {}) {
  const variants = [].concat(audio ?? []);
  if (variants.length && playClip(Phaser.Utils.Array.GetRandom(variants), volume)) return;
  for (const name of [].concat(sfx ?? [])) play(name);
}
