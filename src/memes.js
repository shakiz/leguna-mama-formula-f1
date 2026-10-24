import Phaser from 'phaser';
import { play, isMuted } from './audio/sfx.js';

let triggers = {};
const bags = {};

export function setMemes(json) {
  triggers = json?.triggers ?? {};
}

// Shuffle-bag: every variant plays once before any repeats
export function pickMeme(trigger) {
  const list = triggers[trigger];
  if (!list?.length) return null;
  if (!bags[trigger]?.length) bags[trigger] = Phaser.Utils.Array.Shuffle([...list.keys()]);
  return list[bags[trigger].pop()];
}

// Recorded clip if the meme has one, otherwise the synth placeholder
export function playMemeSound(meme) {
  if (!meme || isMuted()) return;
  if (meme.audio) {
    const a = new Audio(meme.audio);
    a.play().catch(() => play(meme.sfx));
  } else {
    play(meme.sfx);
  }
}
