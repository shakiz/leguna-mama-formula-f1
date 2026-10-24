import { COLORS as C, FONT } from './config.js';
import { flower } from './art/textures.js';
import { play } from './audio/sfx.js';

// Bangla vowel signs and chandrabindu sit above the headline; measure with them so nothing gets clipped
const TEST_STRING = '|MÉqsঁৌকিঅ্যি';

export function text(scene, x, y, str, size, color, extra = {}) {
  return scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: '800',
    color,
    testString: TEST_STRING,
    padding: { top: Math.round(size * 0.2), bottom: Math.round(size * 0.12) },
    ...extra,
  });
}

// Cream plate with a magenta border, yellow inner line and flowers on the corners
export function artFrame(g, x, y, w, h, fill = C.cream) {
  g.fillStyle(0x000000, 0.3).fillRoundedRect(x + 6, y + 10, w, h, 24);
  g.fillStyle(fill).fillRoundedRect(x, y, w, h, 24);
  g.lineStyle(8, C.magenta).strokeRoundedRect(x, y, w, h, 24);
  g.lineStyle(3, C.yellow).strokeRoundedRect(x + 9, y + 9, w - 18, h - 18, 16);
  for (const [fx, fy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) flower(g, fx, fy, 14, C.teal, C.yellow);
}

export function button(scene, x, y, w, h, label, fill, onClick, size = 40) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 4, -h / 2 + 8, w, h, h / 2);
  g.fillStyle(fill).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.lineStyle(5, C.yellow).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const label_ = text(scene, 0, 0, label, size, '#fff3d6', { stroke: '#1a1a2e', strokeThickness: 6 }).setOrigin(0.5);
  c.add([g, label_]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', (_p, _x, _y, e) => {
    e?.stopPropagation();
    play('tap');
    scene.tweens.add({ targets: c, scale: 0.93, duration: 70, yoyo: true, onComplete: onClick });
  });
  c.label = label_;
  return c;
}
