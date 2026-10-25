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

// The leguna's painted decal: three red/orange petals on an orange stem with green leaves
function motif(g, cx, cy, k = 1) {
  g.fillStyle(C.green).fillEllipse(cx - 7 * k, cy + 6 * k, 10 * k, 5 * k).fillEllipse(cx + 7 * k, cy + 6 * k, 10 * k, 5 * k);
  g.lineStyle(2 * k, 0xf28c28).lineBetween(cx, cy - 2 * k, cx, cy + 10 * k);
  g.fillStyle(C.red).fillEllipse(cx, cy - 7 * k, 5 * k, 11 * k);
  g.fillStyle(0xf28c28).fillEllipse(cx - 5 * k, cy - 3 * k, 5 * k, 9 * k).fillEllipse(cx + 5 * k, cy - 3 * k, 5 * k, 9 * k);
}

function stripeDots(g, x, y, w, color) {
  g.fillStyle(color);
  for (let i = x + 6; i < x + w - 4; i += 12) g.fillCircle(i, y, 3);
}

const DRAW = {
  // Top-down version of src/art/leguna-side.webp: yellow roof with rolled canvas sides,
  // cream body with red/orange stripes, green skirt and the floral decal
  leguna(g) {
    g.fillStyle(0x000000, 0.25).fillRoundedRect(14, 10, 120, 186, 20);
    g.fillStyle(0xf3e6cc).fillRoundedRect(8, 4, 120, 186, 18);
    g.fillStyle(C.red).fillRect(8, 64, 5, 112).fillRect(123, 64, 5, 112);
    g.fillStyle(0xf28c28).fillRect(8, 64, 5, 40).fillRect(123, 64, 5, 40);
    g.fillStyle(C.green).fillRoundedRect(10, 0, 116, 14, 6);
    g.fillStyle(0xff9a1f).fillRect(13, 3, 10, 7).fillRect(113, 3, 10, 7);
    g.fillStyle(0x23466e).fillRoundedRect(16, 16, 104, 26, 8);
    g.fillStyle(0x7fa8d6, 0.6).fillRoundedRect(22, 19, 36, 8, 4);
    g.fillStyle(C.ink).fillRoundedRect(0, 30, 10, 14, 3).fillRoundedRect(126, 30, 10, 14, 3);
    g.fillStyle(0xf0b000).fillRoundedRect(13, 40, 110, 140, 10);
    g.fillStyle(0xffcf2e).fillRoundedRect(19, 44, 98, 132, 8);
    g.lineStyle(2, 0xe0a200);
    for (const y of [82, 122, 152]) g.lineBetween(30, y, 106, y);
    g.fillStyle(0xd9c7a6).fillRoundedRect(13, 50, 14, 124, 7).fillRoundedRect(109, 50, 14, 124, 7);
    g.fillStyle(0x3a3a3a);
    for (const y of [66, 100, 134, 160]) g.fillRect(13, y, 14, 4).fillRect(109, y, 14, 4);
    motif(g, 68, 104, 1.6);
    g.fillStyle(C.green).fillRect(14, 178, 108, 6);
    g.fillStyle(0x2b2b2b).fillRoundedRect(20, 182, 96, 10, 3);
  },

  // Same leguna with its brake lights on
  legunaBrake(g) {
    DRAW.leguna(g);
    g.fillStyle(0xff2a2a, 0.35).fillCircle(26, 188, 12).fillCircle(110, 188, 12);
    g.fillStyle(0xff2a2a).fillRect(18, 183, 16, 9).fillRect(102, 183, 16, 9);
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

  // BRTC double-decker seen from above: red roof, the upper deck's window strips along both sides,
  // a cream band with blocky "BRTC" lettering (no text in Graphics), roof hatches and many dents
  brtc(g) {
    g.fillStyle(0x000000, 0.25).fillRoundedRect(8, 10, 140, 372, 20);
    g.fillStyle(0xc8261b).fillRoundedRect(0, 0, 140, 372, 18);
    g.fillStyle(C.red).fillRoundedRect(16, 6, 108, 360, 12);
    // upper-deck front windows and the destination board above the driver
    g.fillStyle(C.ink).fillRoundedRect(10, 8, 120, 28, 9);
    g.fillStyle(0x7fa8d6, 0.5).fillRoundedRect(18, 12, 40, 7, 3);
    g.fillStyle(0xffb000).fillRect(40, 38, 60, 6);
    // window strips with pillars, seen over the roof edge
    g.fillStyle(0x23466e).fillRect(4, 52, 10, 290).fillRect(126, 52, 10, 290);
    g.fillStyle(0xc8261b);
    for (let y = 84; y < 340; y += 36) g.fillRect(4, y, 10, 5).fillRect(126, y, 10, 5);
    // cream band down both sides of the roof, like the livery stripe under the windows
    g.fillStyle(C.cream).fillRect(16, 48, 5, 300).fillRect(119, 48, 5, 300);
    // "BRTC" panel: four blocky letter shapes on cream
    g.fillStyle(C.cream).fillRoundedRect(30, 160, 80, 34, 6);
    g.fillStyle(0xc8261b);
    g.fillRect(36, 166, 5, 22).fillRect(41, 166, 7, 5).fillRect(41, 175, 7, 4).fillRect(41, 183, 7, 5).fillRect(47, 169, 4, 7).fillRect(47, 178, 4, 7); // B
    g.fillRect(54, 166, 5, 22).fillRect(59, 166, 9, 5).fillRect(64, 171, 4, 6).fillRect(59, 175, 6, 4).fillRect(63, 179, 5, 9); // R
    g.fillRect(72, 166, 16, 5).fillRect(78, 171, 5, 17); // T
    g.fillRect(91, 166, 13, 5).fillRect(91, 171, 5, 12).fillRect(91, 183, 13, 5); // C
    // roof hatches and a row of vents
    for (const y of [76, 262]) {
      g.fillStyle(0x8f8f96).fillRoundedRect(42, y, 56, 40, 5);
      g.lineStyle(3, 0x5c5c64).strokeRoundedRect(42, y, 56, 40, 5);
      g.lineStyle(2, 0x6e6e76).lineBetween(48, y + 13, 92, y + 13).lineBetween(48, y + 27, 92, y + 27);
    }
    g.fillStyle(0x9a9a9a);
    for (const y of [136, 218, 236, 322]) g.fillCircle(52, y, 5).fillCircle(88, y, 5);
    // rear engine grille
    g.fillStyle(0x2b2b2b).fillRoundedRect(22, 346, 96, 16, 4);
    g.lineStyle(2, 0x555555);
    for (let x = 30; x < 114; x += 10) g.lineBetween(x, 349, x, 359);
    // dents and scratches: decades of Dhaka traffic
    g.lineStyle(3, 0x7a1d14);
    g.lineBetween(26, 112, 52, 126).lineBetween(100, 214, 116, 236).lineBetween(28, 300, 40, 330).lineBetween(70, 40, 96, 46);
    g.fillStyle(0x7a1d14).fillCircle(112, 140, 6).fillCircle(30, 240, 7).fillCircle(106, 318, 5);
    stripeDots(g, 14, 367, 112, C.yellow);
  },

  car(g) {
    g.fillStyle(0x000000, 0.25).fillRoundedRect(8, 8, 100, 172, 24);
    g.fillStyle(0xe8e8ee).fillRoundedRect(2, 0, 100, 172, 24);
    g.fillStyle(C.ink).fillRoundedRect(14, 30, 76, 34, 10).fillRoundedRect(16, 128, 72, 26, 8);
    g.fillStyle(0xc8c8d2).fillRoundedRect(14, 66, 76, 58, 8);
    g.fillStyle(0xfff7b0).fillCircle(16, 8, 6).fillCircle(88, 8, 6);
  },

  // VIP SUV: glossy black, tinted glass, a small generic pennant on the bonnet and a light bar on the
  // roof. Two frames (vip, vipFlash) swap which side of the light bar is lit, so the lights flash.
  vip: (g) => vipCar(g, 0),
  vipFlash: (g) => vipCar(g, 1),

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

  // --- road surface -----------------------------------------------------

  speedbreaker(g) {
    g.fillStyle(0x000000, 0.3).fillRoundedRect(0, 8, 480, 22, 10);
    g.fillStyle(C.ink).fillRoundedRect(0, 0, 480, 24, 10);
    g.fillStyle(C.yellow);
    for (let x = 6; x < 470; x += 40) g.fillRect(x, 2, 20, 20);
  },

  pothole(g) {
    g.fillStyle(0x55555e).fillEllipse(48, 36, 96, 70);
    g.fillStyle(0x1c1c22).fillEllipse(46, 36, 78, 54).fillEllipse(62, 30, 36, 30);
    g.fillStyle(0x2c4a66, 0.7).fillEllipse(42, 42, 40, 18);
    g.fillStyle(0x77777f);
    for (const [x, y] of [[10, 30], [86, 44], [30, 64], [70, 8], [90, 20]]) g.fillCircle(x, y, 3);
  },

  // Open manhole with the cover shoved aside (or stolen)
  manhole(g) {
    g.fillStyle(0x6a6a72).fillCircle(42, 42, 34);
    g.fillStyle(0x0c0c10).fillCircle(42, 42, 27);
    g.fillStyle(0x24242a).fillCircle(46, 46, 16);
    g.fillStyle(0x8a8a92).fillEllipse(70, 16, 26, 22);
    g.lineStyle(2, 0x5a5a62).strokeEllipse(70, 16, 26, 22);
  },

  patch(g) {
    g.fillStyle(0x42424c, 0.7).fillRect(0, 0, 140, 90);
    g.lineStyle(2, 0x2e2e36, 0.6).strokeRect(2, 2, 136, 86);
  },

  crack(g) {
    g.lineStyle(3, 0x24242b);
    const pts = [[10, 110], [40, 80], [52, 84], [70, 50], [96, 40], [110, 8]];
    for (let i = 1; i < pts.length; i++) g.lineBetween(...pts[i - 1], ...pts[i]);
    g.lineBetween(52, 84, 84, 96).lineBetween(70, 50, 50, 30);
  },

  // Kept faint on purpose so it never reads as a pothole
  oil(g) {
    g.fillStyle(0x15151b, 0.3).fillEllipse(45, 30, 90, 56);
    g.fillStyle(0x7b4fa8, 0.22).fillEllipse(38, 26, 40, 18);
    g.fillStyle(0x00a6a6, 0.2).fillEllipse(56, 36, 30, 12);
    g.fillStyle(0xffd400, 0.12).fillEllipse(46, 22, 24, 8);
  },

  // --- overhead (drawn above traffic) -------------------------------------

  // Concrete foot over-bridge spanning the road, with stair landings on both pavements
  footbridge(g) {
    g.fillStyle(0x8f8f96).fillRect(20, 0, 100, 120).fillRect(640, 0, 100, 120);
    g.fillStyle(0xa8a8ae).fillRect(0, 32, 760, 58);
    g.lineStyle(4, 0x5c5c64).lineBetween(0, 34, 760, 34).lineBetween(0, 88, 760, 88);
    g.lineStyle(2, 0x7a7a82);
    for (let y = 8; y < 120; y += 14) g.lineBetween(24, y, 116, y).lineBetween(644, y, 736, y);
    const rnd = new Phaser.Math.RandomDataGenerator(['bridge']);
    for (let i = 0; i < 14; i++) {
      g.fillStyle(rnd.pick([C.red, C.teal, C.blue, C.magenta, 0xf28c28])).fillCircle(rnd.between(140, 620), rnd.between(46, 76), 7);
      g.fillStyle(0x1a1a1a).fillCircle(rnd.between(140, 620), rnd.between(46, 76), 5);
    }
  },

  // Dhaka's famous tangle of electric and cable lines, sagging across the street
  wires(g) {
    const sag = (x, y0, depth) => y0 + depth * (1 - ((2 * x) / 900 - 1) ** 2);
    for (const [y0, depth, width] of [[6, 30, 3], [14, 22, 2], [4, 40, 2], [20, 18, 3]]) {
      g.lineStyle(width, 0x1c1c1c, 0.85);
      for (let x = 0; x < 900; x += 30) g.lineBetween(x, sag(x, y0, depth), x + 30, sag(x + 30, y0, depth));
    }
    g.lineStyle(2, 0x1c1c1c, 0.85).strokeCircle(320, 40, 9).strokeCircle(560, 44, 7).strokeCircle(574, 40, 6);
  },

  bunting(g) {
    const sag = (x) => 6 + 26 * (1 - ((2 * x) / 900 - 1) ** 2);
    g.lineStyle(2, 0x333333);
    for (let x = 0; x < 900; x += 30) g.lineBetween(x, sag(x), x + 30, sag(x + 30));
    const colors = [C.magenta, C.yellow, C.teal, C.red, C.green];
    for (let x = 10, i = 0; x < 890; x += 34, i++) {
      const y = sag(x + 10);
      g.fillStyle(colors[i % colors.length]).fillTriangle(x, y, x + 22, y, x + 11, y + 22);
    }
  },

  // Traffic signal head on its pole, seen from above; the lit lamp is a separate circle on top
  signal(g) {
    g.fillStyle(0x000000, 0.25).fillCircle(16, 38, 10);
    g.fillStyle(0x55555c).fillCircle(14, 34, 9).fillRect(14, 28, 40, 10);
    g.fillStyle(0x1a1a1e).fillRoundedRect(44, 8, 24, 62, 6);
    g.fillStyle(0x3a1414).fillCircle(56, 20, 7);
    g.fillStyle(0x3a3214).fillCircle(56, 39, 7);
    g.fillStyle(0x143a1c).fillCircle(56, 58, 7);
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

function vipCar(g, phase) {
  g.fillStyle(0x000000, 0.3).fillRoundedRect(8, 8, 108, 188, 18);
  g.fillStyle(0x121218).fillRoundedRect(2, 0, 108, 188, 18);
  // body sheen along both sides, chrome grille and headlights at the front
  g.fillStyle(0x2c2c36).fillRect(6, 24, 4, 140).fillRect(102, 24, 4, 140);
  g.fillStyle(0x9a9aa6).fillRoundedRect(30, 2, 52, 6, 2);
  g.fillStyle(0xf4f4ff).fillRoundedRect(8, 4, 18, 8, 3).fillRoundedRect(86, 4, 18, 8, 3);
  // pennant on a short staff on the front left wing: plain gold with a cream stripe, no real flag
  g.lineStyle(3, 0xd0d0d8).lineBetween(16, 34, 16, 6);
  g.fillStyle(0xe0b020).fillTriangle(17, 6, 42, 13, 17, 21);
  g.fillStyle(C.cream).fillRect(17, 12, 13, 3);
  // tinted windscreen, roof with rails, rear glass
  g.fillStyle(0x050508).fillRoundedRect(12, 42, 88, 30, 9);
  g.fillStyle(0x5a6a80, 0.35).fillRoundedRect(18, 45, 30, 6, 3);
  g.fillStyle(0x1b1b23).fillRoundedRect(12, 74, 88, 82, 8);
  g.fillStyle(0x3a3a44).fillRect(16, 78, 4, 74).fillRect(92, 78, 4, 74);
  g.fillStyle(0x050508).fillRoundedRect(16, 158, 80, 20, 6);
  g.fillStyle(0xb01818).fillRect(6, 180, 18, 6).fillRect(88, 180, 18, 6);
  // light bar: the lit half glows
  const [lit, hi, cx] = phase ? [0x2f6bff, 0xa8c4ff, 74] : [0xff2020, 0xffa0a0, 38];
  g.fillStyle(0x2a2a30).fillRoundedRect(16, 88, 80, 22, 7);
  g.fillStyle(phase ? 0x4a0d0d : 0xff2020).fillRoundedRect(19, 91, 36, 16, 5);
  g.fillStyle(phase ? 0x2f6bff : 0x10204a).fillRoundedRect(57, 91, 36, 16, 5);
  g.fillStyle(lit, 0.3).fillCircle(cx, 99, 34);
  g.fillStyle(hi).fillRoundedRect(cx - 10, 95, 20, 7, 3);
}

// Pedestrians in a couple of outfits
function person(g, shirt, hair) {
  g.fillStyle(0x000000, 0.2).fillEllipse(30, 34, 50, 30);
  g.fillStyle(shirt).fillEllipse(28, 30, 48, 24);
  g.lineStyle(6, 0x6b3e26).lineBetween(8, 30, 2, 46).lineBetween(48, 30, 54, 14);
  g.fillStyle(hair).fillCircle(28, 26, 12);
}
DRAW.ped0 = (g) => person(g, C.blue, C.ink);
DRAW.ped1 = (g) => person(g, C.magenta, 0x3a2a1a);

const SIZES = {
  leguna: [136, 198], rickshaw: [96, 160], cng: [104, 164], bus: [146, 332], brtc: [150, 384], car: [110, 182], vip: [116, 196], vipFlash: [116, 196],
  police: [116, 116], cow: [92, 170], hawker: [90, 90], puddle: [170, 110], passenger: [84, 96],
  tree: [100, 100], stall: [104, 124], legunaBrake: [136, 198],
  speedbreaker: [480, 30], pothole: [96, 72], manhole: [84, 84], patch: [140, 90], crack: [120, 120], oil: [90, 60],
  footbridge: [760, 120], wires: [900, 70], bunting: [900, 60], signal: [72, 72], ped0: [60, 56], ped1: [60, 56],
};

// Top-down Dhaka rooftops for the strip beyond the pavement: parapet, stair room, the black water
// tanks every building has, AC units and a washing line
const ROOF_COLORS = [0xe8d8c4, 0xc9d6df, 0xf0c9a8, 0xd6e2c0];

function roof(g, color, seed) {
  const rnd = new Phaser.Math.RandomDataGenerator([`roof${seed}`]);
  const darker = Phaser.Display.Color.ValueToColor(color).darken(18).color;
  g.fillStyle(0x000000, 0.25).fillRect(8, 8, 192, 212);
  g.fillStyle(color).fillRect(0, 0, 192, 212);
  g.lineStyle(8, darker).strokeRect(4, 4, 184, 204);
  g.fillStyle(darker).fillRect(rnd.between(20, 110), rnd.between(20, 130), 62, 52);
  for (let i = 0; i < rnd.between(1, 2); i++) {
    const x = rnd.between(36, 156);
    const y = rnd.between(36, 176);
    g.fillStyle(0x1e1e1e).fillCircle(x, y, 18);
    g.fillStyle(0x4a4a4a).fillCircle(x - 5, y - 5, 6);
  }
  g.fillStyle(0xbdbdbd);
  for (let i = 0; i < 2; i++) g.fillRect(rnd.between(16, 150), rnd.between(150, 186), 26, 16);
  const ly = rnd.between(60, 150);
  g.lineStyle(2, 0x777777).lineBetween(20, ly, 172, ly);
  for (let x = 30; x < 160; x += 22) g.fillStyle(rnd.pick([C.red, C.teal, C.yellow, C.magenta, C.blue])).fillRect(x, ly, 12, 16);
}

ROOF_COLORS.forEach((color, i) => {
  DRAW[`roof${i}`] = (g) => roof(g, color, i);
  SIZES[`roof${i}`] = [200, 220];
});
export const ROOFS = ROOF_COLORS.map((_, i) => `roof${i}`);

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
