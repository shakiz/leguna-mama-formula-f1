// Placeholder art drawn at runtime in a rickshaw-art palette: no image downloads.
// Replace any key with a real sprite later via this.load.image(key, ...) in BootScene.
import Phaser from 'phaser';
import { W, ROAD_X, ROAD_W, LANE_W, LANES, COLORS as C } from '../config.js';

export function flower(g, cx, cy, r, petal = C.magenta, center = C.yellow) {
  g.fillStyle(petal);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    g.fillCircle(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, r * 0.45);
  }
  g.fillStyle(center);
  g.fillCircle(cx, cy, r * 0.42);
}

function stripeDots(g, x, y, w, color) {
  g.fillStyle(color);
  for (let i = x + 6; i < x + w - 4; i += 12) g.fillCircle(i, y, 3);
}

const DRAW = {
  leguna(g) {
    g.fillStyle(0x000000, 0.25).fillRoundedRect(6, 8, 116, 186, 24);
    g.fillStyle(C.green).fillRoundedRect(0, 0, 120, 190, 22);
    g.fillStyle(C.yellow).fillRoundedRect(8, 2, 104, 10, 5);
    g.fillStyle(0xfff7b0).fillCircle(20, 8, 7).fillCircle(100, 8, 7);
    g.fillStyle(C.ink).fillRoundedRect(14, 18, 92, 40, 10);
    g.fillStyle(0x5c7ea8, 0.6).fillRoundedRect(20, 22, 40, 14, 6);
    // roof with rickshaw-art panel
    g.fillStyle(C.teal).fillRoundedRect(10, 64, 100, 102, 12);
    g.lineStyle(5, C.magenta).strokeRoundedRect(14, 68, 92, 94, 10);
    flower(g, 60, 115, 22, C.magenta, C.yellow);
    flower(g, 30, 86, 9, C.yellow, C.red);
    flower(g, 90, 144, 9, C.yellow, C.red);
    stripeDots(g, 10, 172, 100, C.yellow);
    // open rear with grab rail
    g.fillStyle(C.yellow).fillRoundedRect(10, 178, 100, 8, 4);
    g.fillStyle(C.red).fillRect(0, 70, 5, 90).fillRect(115, 70, 5, 90);
  },

  rickshaw(g) {
    g.fillStyle(0x000000, 0.2).fillEllipse(52, 110, 92, 90);
    g.fillStyle(C.ink).fillRoundedRect(42, 0, 12, 32, 4);
    g.lineStyle(5, C.magenta).lineBetween(48, 24, 48, 80);
    g.lineStyle(4, 0x9a9a9a).lineBetween(26, 30, 70, 30);
    // puller
    g.fillStyle(C.blue).fillEllipse(48, 62, 46, 24);
    g.fillStyle(0x6b3e26).fillCircle(48, 54, 11);
    // hood: the canvas of a rickshaw-art painting
    g.fillStyle(C.ink).fillRect(0, 108, 10, 38).fillRect(86, 108, 10, 38);
    g.fillStyle(C.magenta).fillRoundedRect(8, 80, 80, 78, 32);
    g.lineStyle(4, C.yellow).strokeRoundedRect(12, 84, 72, 70, 28);
    flower(g, 48, 118, 16, C.teal, C.yellow);
    g.fillStyle(C.cream).fillCircle(26, 98, 4).fillCircle(70, 98, 4).fillCircle(26, 140, 4).fillCircle(70, 140, 4);
  },

  cng(g) {
    g.fillStyle(0x000000, 0.25).fillRoundedRect(8, 8, 96, 156, 30);
    g.fillStyle(C.green).fillRoundedRect(4, 0, 96, 160, 30);
    g.fillStyle(C.ink).fillRoundedRect(18, 18, 68, 26, 8);
    g.fillStyle(0x146b33).fillRoundedRect(10, 52, 84, 98, 14);
    g.lineStyle(3, 0xb0b0b0);
    for (let x = 22; x < 92; x += 14) g.lineBetween(x, 58, x, 144);
    g.fillStyle(C.yellow).fillRect(32, 148, 40, 10);
  },

  bus(g) {
    g.fillStyle(0x000000, 0.25).fillRoundedRect(8, 10, 136, 320, 18);
    g.fillStyle(C.red).fillRoundedRect(0, 0, 136, 320, 16);
    g.fillStyle(C.ink).fillRoundedRect(10, 8, 116, 30, 8);
    g.fillStyle(C.cream).fillRoundedRect(12, 46, 112, 262, 10);
    g.fillStyle(C.blue).fillRect(12, 120, 112, 22).fillRect(12, 220, 112, 22);
    g.fillStyle(0x9a9a9a).fillRect(40, 70, 56, 26).fillRect(40, 260, 56, 26);
    // dents and scratches, as tradition demands
    g.lineStyle(3, 0x7a1d14);
    g.lineBetween(4, 60, 30, 72).lineBetween(110, 180, 132, 196).lineBetween(6, 250, 20, 280);
    g.fillStyle(0x7a1d14).fillCircle(130, 90, 6).fillCircle(6, 160, 5);
    stripeDots(g, 12, 314, 112, C.yellow);
  },

  car(g) {
    g.fillStyle(0x000000, 0.25).fillRoundedRect(8, 8, 100, 172, 24);
    g.fillStyle(0xe8e8ee).fillRoundedRect(2, 0, 100, 172, 24);
    g.fillStyle(C.ink).fillRoundedRect(14, 30, 76, 34, 10).fillRoundedRect(16, 128, 72, 26, 8);
    g.fillStyle(0xc8c8d2).fillRoundedRect(14, 66, 76, 58, 8);
    g.fillStyle(0xfff7b0).fillCircle(16, 8, 6).fillCircle(88, 8, 6);
  },

  // Traffic-police umbrella stand, seen from above
  police(g) {
    g.fillStyle(0x000000, 0.25).fillCircle(60, 62, 52);
    for (let i = 0; i < 8; i++) {
      g.fillStyle(i % 2 ? C.white : C.red);
      g.beginPath();
      g.slice(56, 56, 52, (Math.PI / 4) * i, (Math.PI / 4) * (i + 1));
      g.fillPath();
    }
    g.fillStyle(C.yellow).fillCircle(56, 56, 10);
  },

  cow(g) {
    g.fillStyle(0x000000, 0.2).fillEllipse(50, 104, 84, 124);
    g.lineStyle(6, 0x8a6a3c).lineBetween(26, 12, 38, 22).lineBetween(66, 12, 54, 22);
    g.fillStyle(C.white).fillEllipse(46, 32, 38, 44);
    g.fillStyle(0xf4b6b6).fillEllipse(46, 14, 26, 16);
    g.fillStyle(C.white).fillEllipse(46, 100, 80, 120);
    g.fillStyle(0x6b3e26).fillEllipse(30, 84, 26, 34).fillEllipse(62, 118, 30, 26).fillEllipse(40, 136, 16, 14);
    g.lineStyle(4, 0x6b3e26).lineBetween(46, 158, 52, 168);
    // garland: it's Eid-ready
    stripeDots(g, 24, 54, 46, C.magenta);
  },

  hawker(g) {
    g.fillStyle(0x000000, 0.2).fillCircle(46, 48, 40);
    g.fillStyle(0xf28c28).fillEllipse(44, 50, 76, 34);
    g.fillStyle(0xb5803a).fillCircle(44, 42, 30);
    g.lineStyle(3, 0x7a5426).strokeCircle(44, 42, 30);
    g.fillStyle(C.yellow).fillCircle(34, 36, 8).fillCircle(52, 34, 8);
    g.fillStyle(C.red).fillCircle(44, 52, 8).fillCircle(58, 48, 6);
  },

  puddle(g) {
    g.fillStyle(0x2a5b8f, 0.85).fillEllipse(84, 55, 168, 106);
    g.fillStyle(0x5d9ad1, 0.8).fillEllipse(80, 50, 120, 70);
    g.lineStyle(3, 0xcfe8ff, 0.8).strokeEllipse(72, 46, 50, 22).strokeEllipse(104, 64, 34, 14);
  },

  passenger(g) {
    g.lineStyle(5, C.yellow, 0.9).strokeCircle(42, 52, 38);
    g.fillStyle(C.yellow, 0.18).fillCircle(42, 52, 38);
    g.fillStyle(C.teal).fillEllipse(42, 58, 50, 26);
    g.lineStyle(7, 0x6b3e26).lineBetween(60, 54, 74, 22);
    g.fillStyle(0x6b3e26).fillCircle(74, 20, 6);
    g.fillStyle(C.ink).fillCircle(42, 50, 13);
  },

  tree(g) {
    g.fillStyle(0x000000, 0.2).fillCircle(54, 56, 44);
    g.fillStyle(0x2e7d32).fillCircle(50, 50, 44);
    g.fillStyle(0x43a047).fillCircle(36, 38, 22).fillCircle(64, 44, 20).fillCircle(48, 66, 20);
    g.fillStyle(C.yellow).fillCircle(30, 60, 4).fillCircle(70, 30, 4);
  },

  // Tea stall: striped awning, kettle and a bench
  stall(g) {
    g.fillStyle(0x000000, 0.2).fillRect(10, 12, 92, 110);
    for (let i = 0; i < 6; i++) g.fillStyle(i % 2 ? C.cream : C.red).fillRect(4 + i * 15, 4, 15, 72);
    g.fillStyle(0x8a5a2b).fillRect(10, 84, 80, 14);
    g.fillStyle(0x9a9a9a).fillCircle(30, 108, 9);
    g.fillStyle(C.cream).fillCircle(56, 108, 6).fillCircle(72, 108, 6);
  },
};

const SIZES = {
  leguna: [124, 196], rickshaw: [96, 160], cng: [104, 164], bus: [146, 332], car: [110, 182],
  police: [116, 116], cow: [92, 170], hawker: [90, 90], puddle: [170, 110], passenger: [84, 96],
  tree: [100, 100], stall: [104, 124],
};

function makeRoad(g) {
  const h = 256;
  g.fillStyle(C.asphalt).fillRect(0, 0, W, h);
  const rnd = new Phaser.Math.RandomDataGenerator(['dhaka']);
  for (let i = 0; i < 70; i++) {
    g.fillStyle(rnd.pick([0x33333d, 0x44444f, 0x2c2c35]));
    g.fillCircle(rnd.between(ROAD_X + 8, ROAD_X + ROAD_W - 8), rnd.between(8, h - 8), rnd.between(2, 5));
  }
  for (const x0 of [0, ROAD_X + ROAD_W]) {
    g.fillStyle(0xd9c9a3).fillRect(x0, 0, ROAD_X, h);
    g.lineStyle(2, 0xbfae86);
    for (let y = 0; y < h; y += 64) g.lineBetween(x0, y, x0 + ROAD_X, y);
    g.lineBetween(x0 + ROAD_X / 2, 0, x0 + ROAD_X / 2, h);
  }
  for (let y = 0; y < h; y += 32) {
    g.fillStyle((y / 32) % 2 ? C.ink : C.yellow);
    g.fillRect(ROAD_X - 14, y, 14, 32);
    g.fillRect(ROAD_X + ROAD_W, y, 14, 32);
  }
  g.fillStyle(C.white, 0.8);
  for (let l = 1; l < LANES; l++) g.fillRect(ROAD_X + LANE_W * l - 4, 64, 8, 128);
  g.generateTexture('road', W, h);
}

export function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const [key, draw] of Object.entries(DRAW)) {
    g.clear();
    draw(g);
    g.generateTexture(key, ...SIZES[key]);
  }
  g.clear();
  makeRoad(g);
  g.destroy();
}
