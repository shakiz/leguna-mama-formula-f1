import Phaser from 'phaser';
import { W, H, COLORS, CSS } from '../config.js';
import { t, fmtTime, num } from '../i18n.js';
import { load } from '../storage.js';
import { text, artFrame, button } from '../ui.js';
import { shareResult } from '../share.js';

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  init(result) {
    this.result = result;
  }

  create() {
    const { time, fare, crashes, closeCalls, isBest } = this.result;
    this.add.tileSprite(W / 2, H / 2, W, H, 'road');
    this.add.rectangle(W / 2, H / 2, W, H, COLORS.ink, 0.5);

    const g = this.add.graphics();
    artFrame(g, 60, 110, 600, 790);
    text(this, W / 2, 200, t('finished'), 76, CSS.magenta, { stroke: CSS.ink, strokeThickness: 10 }).setOrigin(0.5);
    if (isBest) {
      const badge = text(this, W / 2, 290, `⭐ ${t('newBest')} ⭐`, 40, CSS.ink, { backgroundColor: CSS.yellow }).setOrigin(0.5);
      this.tweens.add({ targets: badge, scale: 1.08, duration: 400, yoyo: true, repeat: -1 });
    }

    const timeLabel = text(this, W / 2, 400, `${fmtTime(time)} ${t('sec')}`, 96, CSS.ink).setOrigin(0.5);
    if (timeLabel.width > 500) timeLabel.setScale(500 / timeLabel.width);
    this.add.image(W / 2, 568, 'leguna-side').setScale(0.6);

    const rows = [
      [`🪙 ${t('fare')}`, `৳ ${num(fare)}`],
      [`😮‍💨 ${t('closeCalls')}`, num(closeCalls)],
      [`💥 ${t('crashes')}`, num(crashes)],
      [`🏆 ${t('best')}`, `${fmtTime(load('best', time))} ${t('sec')}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 700 + i * 52;
      text(this, 120, y, k, 34, CSS.ink).setOrigin(0, 0.5);
      text(this, W - 120, y, v, 34, CSS.magenta).setOrigin(1, 0.5);
    });

    button(this, W / 2, 990, 500, 110, t('again'), COLORS.magenta, () => this.scene.start('Game'), 46);
    const share = button(this, W / 2, 1110, 500, 96, `📤 ${t('share')}`, COLORS.teal, async () => {
      const outcome = await shareResult(this, this.result);
      if (outcome === 'saved') share.label.setText(`✅ ${t('saved')}`);
    }, 40);
    button(this, W / 2, 1210, 260, 72, t('menu'), COLORS.ink, () => this.scene.start('Menu'), 30);

    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('Game'));
    this.input.keyboard.on('keydown-SPACE', () => this.scene.start('Game'));
  }
}
