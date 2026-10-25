import Phaser from 'phaser';
import { makeTextures } from '../art/textures.js';
import { setMemes } from '../memes.js';
import { preloadEngine } from '../audio/sfx.js';
import legunaSideUrl from '../art/leguna-side.webp';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.json('memes', 'memes.json');
    this.load.image('leguna-side', legunaSideUrl);
  }

  create() {
    setMemes(this.cache.json.get('memes'));
    preloadEngine();
    makeTextures(this);
    this.scene.start('Menu');
  }
}
