import Phaser from 'phaser';
import { W, H, COLORS, CSS } from '../config.js';
import { t, fmtTime, toggleLang } from '../i18n.js';
import { unlockAudio, isMuted, setMuted, play } from '../audio/sfx.js';
import { load } from '../storage.js';
import { text, artFrame, button } from '../ui.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.road = this.add.tileSprite(W / 2, H / 2, W, H, 'road');
    this.add.rectangle(W / 2, H / 2, W, H, COLORS.ink, 0.35);

    const g = this.add.graphics();
    artFrame(g, 60, 130, 600, 360);
    text(this, W / 2, 230, t('title'), 96, CSS.magenta, { stroke: CSS.ink, strokeThickness: 10 }).setOrigin(0.5);
    text(this, W / 2, 335, t('subtitle'), 60, CSS.teal, { stroke: CSS.ink, strokeThickness: 8 }).setOrigin(0.5);
    text(this, W / 2, 420, t('route'), 30, CSS.ink).setOrigin(0.5);

    const leguna = this.add.image(W / 2, 660, 'leguna').setScale(1.4);
    this.tweens.add({ targets: leguna, y: 652, duration: 140, yoyo: true, repeat: -1 });
    const pax = this.add.image(W / 2 + 160, 640, 'passenger');
    this.tweens.add({ targets: pax, angle: 8, duration: 300, yoyo: true, repeat: -1 });

    button(this, W / 2, 900, 460, 120, t('play'), COLORS.magenta, () => this.start(), 52);

    text(this, W / 2, 1030, t('controls'), 28, CSS.cream, { align: 'center', stroke: CSS.ink, strokeThickness: 6 }).setOrigin(0.5);
    text(this, W / 2, 1120, t('tip'), 28, CSS.yellow, { stroke: CSS.ink, strokeThickness: 6 }).setOrigin(0.5);

    const best = load('best', null);
    if (best !== null) {
      text(this, W / 2, 1200, `🏆 ${t('best')}: ${fmtTime(best)} ${t('sec')}`, 32, CSS.cream, { stroke: CSS.ink, strokeThickness: 6 }).setOrigin(0.5);
    }

    button(this, W - 120, 60, 200, 72, t('langToggle'), COLORS.teal, () => {
      toggleLang();
      this.scene.restart();
    }, 30);
    const mute = button(this, 70, 60, 96, 72, isMuted() ? '🔇' : '🔊', COLORS.ink, () => {
      unlockAudio();
      setMuted(!isMuted());
      mute.label.setText(isMuted() ? '🔇' : '🔊');
    }, 32);

    // Browsers only allow sound after a user gesture
    this.input.once('pointerdown', unlockAudio);
    this.input.keyboard.once('keydown', unlockAudio);
    this.input.keyboard.on('keydown-ENTER', () => this.start());
    this.input.keyboard.on('keydown-SPACE', () => this.start());
  }

  start() {
    unlockAudio();
    play('slap');
    this.scene.start('Game');
  }

  update(_, delta) {
    this.road.tilePositionY -= delta * 0.12;
  }
}
