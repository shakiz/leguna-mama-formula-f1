import Phaser from 'phaser';
import { makeTextures } from '../art/textures.js';
import { setMemes } from '../memes.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.json('memes', 'memes.json');
  }

  create() {
    setMemes(this.cache.json.get('memes'));
    makeTextures(this);
    this.scene.start('Menu');
  }
}
