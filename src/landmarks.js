// Real places along the route: the Jatiya Sangsad Bhaban beside Manik Mia Avenue, the residential
// blocks, the Asad Gate memorial, Mohammadpur Town Hall Market and the big name boards. track.js puts
// the features on the route; this file decides what they look like.
//
// Contract with GameScene / RoadRenderer:
//   spawnLandmark(scene, f, ry)  point features (and zone starts) as they come into view
//   drawLandmarks(road)          zone ground (lawns, lake, market floor), after the pavements, before the kerbs
//   sideTaken(d)                 roadsides a landmark occupies, so the usual rooftops and decor stay away
//   landmarkTick(scene, dy)      every frame: keeps zones filled at the top edge as the leguna drives
//
// Everything is in road coordinates (rx sideways on a straight road, d route distance), so bends and the
// turning camera move it like any other prop. Art is drawn once into textures, the first time it's needed.
import Phaser from 'phaser';
import { W, H, ROAD_X, ROAD_W, COLORS as C, CSS } from './config.js';
import { features } from './track.js';
import { text } from './ui.js';
import { flower } from './art/textures.js';

const FAR = 900; // how far past the pavements zone ground is drawn, for zoomed-out and turning views
const SPAWN_ROW = -420; // zone props are created at this screen row, above the zoomed-out view's top edge
const BELOW = H + 300; // rows below this are behind the leguna and not worth filling
const OVERHEAD = 1.07; // overhead things scroll a touch faster than the road, like the footbridge
const PAVE_L = ROAD_X / 2; // middle of the left pavement (the right one is mirrored)

// --- art ---------------------------------------------------------------------------------------

const rng = (key) => new Phaser.Math.RandomDataGenerator([key]);
const shade = (color, pct) => Phaser.Display.Color.ValueToColor(color).darken(pct).color;
const tint = (color, pct) => Phaser.Display.Color.ValueToColor(color).lighten(pct).color;

// Shoppers and passers-by seen from above: shoulders, head, sometimes a bag
function person(g, x, y, shirt, rnd, k = 1) {
  g.fillStyle(0x000000, 0.18).fillEllipse(x + 3, y + 4, 26 * k, 16 * k);
  g.fillStyle(shirt).fillEllipse(x, y, 24 * k, 14 * k);
  g.fillStyle(rnd.pick([0x1a1a1a, 0x2b2118, 0x3a2a1a, 0xf2f2f2])).fillCircle(x, y, 6 * k);
  if (rnd.frac() < 0.4) g.fillStyle(rnd.pick([0xf5f5f5, 0x2a7d3a, 0xc23b22])).fillRect(x + 11 * k, y - 2, 6 * k, 8 * k);
}
const SHIRTS = [C.blue, C.magenta, C.red, C.teal, 0xf28c28, 0xf5f0e0, 0x6a4c93, 0x2a7d3a, C.yellow];

// --- Jatiya Sangsad Bhaban -----------------------------------------------------------------------
// Grey concrete with white marble bands. The central octagonal assembly hall is ringed by blocks with
// huge circular and triangular openings and narrow light courts between them. The blocks facing the
// avenue have their façades folded flat into view (a strip on the road side), so the round and
// triangular openings read from the top-down camera. x 0 of the texture sits at rx PARL_X.
const CONCRETE = 0x8f8e92;
const CONCRETE_LIT = 0xb4b1ac;
const COURT = 0x5d5c62;
const MARBLE = 0xe9e5dc;
const VOID = 0x24242b;
const PARL_W = 640;
const PARL_H = 760; // route distance the building covers
const PARL_X = 790; // its road-side edge (rx): the façades sit in the zoomed-out view's right band
const PARL_SLICE = 95; // drawn as strips so each follows the road and none pops out at the screen edge
const FACE = 62; // width of the folded façade strip
const LAKE = 270; // water before and after the building along the route
const LAKE_X = 758; // the lake's edge (rx): lawn and railing in front of it
const PLAZA = 120; // half length of the South Plaza's brick causeway to the entrance

const BLOCKS = [
  // facing the avenue: folded façades
  { x: FACE, y: 30, w: 128, h: 200, face: 'circle' },
  { x: FACE, y: 242, w: 128, h: 276, face: 'triangle' },
  { x: FACE, y: 530, w: 128, h: 200, face: 'circle' },
  // far, near and back blocks
  { x: 214, y: 30, w: 272, h: 182, wells: 'circle' },
  { x: 214, y: 548, w: 272, h: 182, towers: true }, // the prayer hall, with its round corner towers
  { x: 510, y: 30, w: 126, h: 200, wells: 'triangle' },
  { x: 510, y: 242, w: 126, h: 276, wells: 'circle' },
  { x: 510, y: 530, w: 126, h: 200, wells: 'triangle' },
];

function octagon(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (Math.PI / 4) * i;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function hole(g, kind, x, y, s) {
  // A deep opening: dark void, a lit inner wall on one side
  if (kind === 'circle') {
    g.fillStyle(VOID).fillCircle(x, y, s);
    g.fillStyle(0x4b4a52).fillCircle(x - s * 0.25, y - s * 0.2, s * 0.62);
    g.fillStyle(VOID).fillCircle(x - s * 0.1, y - s * 0.05, s * 0.55);
    g.lineStyle(3, MARBLE, 0.8).strokeCircle(x, y, s + 2);
  } else {
    g.fillStyle(VOID).fillTriangle(x - s, y + s * 0.9, x + s, y + s * 0.9, x, y - s * 0.9);
    g.fillStyle(0x4b4a52).fillTriangle(x - s * 0.55, y + s * 0.6, x - s * 0.1, y + s * 0.6, x - s * 0.33, y + s * 0.05);
    g.lineStyle(3, MARBLE, 0.8).strokeTriangle(x - s - 2, y + s * 0.9 + 2, x + s + 2, y + s * 0.9 + 2, x, y - s * 0.9 - 3);
  }
}

function parliament(g) {
  // Light courts between the blocks, under everything
  g.fillStyle(0x000000, 0.28).fillRect(FACE + 12, 42, PARL_W - FACE - 6, PARL_H - 38);
  g.fillStyle(COURT).fillRect(FACE, 30, PARL_W - FACE - 4, PARL_H - 60);
  // Central octagonal assembly hall: the parasol roof, marble rings, a lantern in the middle
  const cx = 350;
  const cy = PARL_H / 2;
  g.fillStyle(0x000000, 0.3).fillPoints(octagon(cx + 10, cy + 12, 156), true);
  g.fillStyle(CONCRETE).fillPoints(octagon(cx, cy, 156), true);
  const outer = octagon(cx, cy, 156);
  for (let i = 0; i < 8; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % 8];
    g.fillStyle(i % 2 ? 0x9d9ca0 : 0x85848a).fillTriangle(cx, cy, a.x, a.y, b.x, b.y);
  }
  for (const r of [126, 96, 66]) g.lineStyle(3, MARBLE, 0.85).strokePoints(octagon(cx, cy, r), true);
  g.lineStyle(2, MARBLE, 0.6);
  for (const p of outer) g.lineBetween(cx, cy, p.x, p.y);
  g.fillStyle(CONCRETE_LIT).fillPoints(octagon(cx, cy, 40), true);
  g.lineStyle(3, MARBLE).strokePoints(octagon(cx, cy, 40), true);
  g.fillStyle(VOID).fillCircle(cx, cy, 14);

  for (const b of BLOCKS) {
    g.fillStyle(0x000000, 0.28).fillRect(b.x + 10, b.y + 12, b.w, b.h);
    g.fillStyle(CONCRETE).fillRect(b.x, b.y, b.w, b.h);
    // marble bands at every floor
    g.lineStyle(2, MARBLE, 0.7);
    for (let y = b.y + 22; y < b.y + b.h; y += 26) g.lineBetween(b.x, y, b.x + b.w, y);
    g.lineStyle(4, shade(CONCRETE, 18)).strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    if (b.wells) {
      const n = b.h > 220 ? 2 : 1;
      for (let i = 0; i < n; i++) hole(g, b.wells, b.x + b.w / 2, b.y + (b.h * (i + 0.5)) / n, Math.min(b.w, b.h / n) * 0.3);
    }
    if (b.towers) {
      for (const [tx, ty] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
        g.fillStyle(0x000000, 0.25).fillCircle(tx + 8, ty + 10, 30);
        g.fillStyle(CONCRETE_LIT).fillCircle(tx, ty, 30);
        g.lineStyle(3, MARBLE).strokeCircle(tx, ty, 22);
        g.fillStyle(VOID).fillCircle(tx, ty, 9);
      }
      hole(g, 'circle', b.x + b.w / 2, b.y + b.h / 2, 46);
    }
    if (b.face) {
      // Folded façade: ground line at x 0 (the lake), roofline at x FACE. Storey bands run along it.
      const fx = 0;
      g.fillStyle(CONCRETE_LIT).fillRect(fx, b.y, FACE, b.h);
      g.lineStyle(2, MARBLE);
      for (let x = fx + 10; x < FACE; x += 13) g.lineBetween(x, b.y, x, b.y + b.h);
      g.lineStyle(3, shade(CONCRETE, 25)).lineBetween(FACE, b.y, FACE, b.y + b.h);
      if (b.face === 'circle') {
        hole(g, 'circle', FACE / 2 + 2, b.y + b.h / 2, 25);
        hole(g, 'circle', FACE / 2 + 2, b.y + 26, 11);
        hole(g, 'circle', FACE / 2 + 2, b.y + b.h - 26, 11);
      } else {
        // The entrance block: a great circle between two triangular openings. The triangles are
        // drawn upright on screen, as people know them from photos, rather than folded with the wall.
        hole(g, 'circle', FACE / 2 + 2, b.y + b.h / 2, 24);
        for (const ty of [b.y + 52, b.y + b.h - 52]) hole(g, 'triangle', FACE / 2 + 2, ty, 22);
      }
    }
  }
  // The entrance on the avenue side, where the South Plaza's causeway meets the building
  g.fillStyle(0xb5523b).fillRect(0, PARL_H / 2 - 26, 6, 52);
}

// Paper kite over the lawns: the Sangsad lawns are Dhaka's favourite kite field
function kite(g) {
  g.lineStyle(1, 0x333333, 0.6).lineBetween(17, 44, 6, 70);
  g.fillStyle(C.magenta).fillTriangle(17, 0, 34, 22, 17, 44).fillTriangle(17, 0, 0, 22, 17, 44);
  g.fillStyle(C.yellow).fillTriangle(17, 0, 34, 22, 17, 22);
  g.fillStyle(C.teal).fillTriangle(17, 44, 0, 22, 17, 22);
  g.fillStyle(C.red).fillTriangle(8, 54, 14, 52, 11, 60);
}

// --- residential apartment blocks ----------------------------------------------------------------
// 6–10 storey blocks with flat roofs seen from above, drawn for the left roadside (road at +x) and
// flipped for the right. x 0–RES_FRONT: roof with parapet, stair room, black water tanks, plants,
// clothesline, dish, solar panels, ACs; then the façade folded into view (one band per storey with
// balconies), the front yard, and the boundary wall with its steel gate at the pavement edge.
const RES_W = 236;
const RES_FRONT = 200; // roof + façade end here; the yard runs to the wall
const RES_WALL = 8;
const WALL = 0xd8cfc0;
const RES = [
  { color: 0xf1e3c8, h: 196, storeys: 6 },
  { color: 0xf3c9c0, h: 228, storeys: 8 },
  { color: 0xc8dbe6, h: 206, storeys: 7 },
  { color: 0xd4e6c9, h: 252, storeys: 10 },
  { color: 0xf5d3a6, h: 186, storeys: 6 },
  { color: 0xe2e0dc, h: 240, storeys: 9 },
];

function residential(g, i) {
  const { color, h, storeys } = RES[i];
  const rnd = rng(`res${i}`);
  const face = storeys * 4;
  const roofW = RES_FRONT - face;
  const bh = h - 12; // the block; the last 12 px are its shadow on the alley
  const dark = shade(color, 20);
  g.fillStyle(0x000000, 0.12 + storeys * 0.02).fillRect(4, bh, RES_FRONT, 12);
  // Roof
  g.fillStyle(color).fillRect(0, 0, roofW, bh);
  g.lineStyle(7, dark).strokeRect(3, 3, roofW - 6, bh - 6);
  // Stair room ("chilekotha") with its shadow and door
  const sx = rnd.between(18, roofW - 78);
  const sy = rnd.between(18, bh - 70);
  g.fillStyle(0x000000, 0.25).fillRect(sx + 6, sy + 8, 58, 50);
  g.fillStyle(shade(color, 12)).fillRect(sx, sy, 58, 50);
  g.lineStyle(3, shade(color, 30)).strokeRect(sx, sy, 58, 50);
  g.fillStyle(0x5a3a22).fillRect(sx + 58, sy + 16, 5, 18);
  // Black water tanks: on the stair room and on the roof
  const tanks = [[sx + 29, sy + 25]];
  for (let k = rnd.between(1, 2); k > 0; k--) tanks.push([rnd.between(28, roofW - 28), rnd.pick([24, bh - 30])]);
  for (const [x, y] of tanks) {
    g.fillStyle(0x000000, 0.3).fillCircle(x + 4, y + 5, 16);
    g.fillStyle(0x1b1b1b).fillCircle(x, y, 15);
    g.lineStyle(2, 0x3a3a3a).strokeCircle(x, y, 10);
    g.fillStyle(0x4a4a4a).fillCircle(x - 5, y - 5, 4);
  }
  // Rooftop garden: terracotta pots and a planter along the parapet
  if (rnd.frac() < 0.75) {
    const gy = rnd.between(14, bh - 40);
    for (let x = 16; x < Math.min(roofW - 14, 16 + rnd.between(3, 6) * 18); x += 18) {
      g.fillStyle(0xb5652b).fillCircle(x, gy, 7);
      g.fillStyle(rnd.pick([0x2e7d32, 0x43a047, 0x558b2f])).fillCircle(x, gy, 5);
      if (rnd.frac() < 0.3) g.fillStyle(rnd.pick([C.red, C.yellow, C.magenta])).fillCircle(x + 2, gy - 2, 2);
    }
    g.fillStyle(0x8d5a32).fillRect(10, bh - 22, roofW * 0.45, 10);
    g.fillStyle(0x43a047);
    for (let x = 14; x < 10 + roofW * 0.45; x += 9) g.fillCircle(x, bh - 17, 5);
  }
  // Clothesline across the roof
  if (rnd.frac() < 0.8) {
    const ly = rnd.between(30, bh - 50);
    g.lineStyle(2, 0x6a6a6a).lineBetween(10, ly, roofW - 10, ly);
    for (let x = 18; x < roofW - 20; x += rnd.between(14, 22)) {
      g.fillStyle(rnd.pick([C.red, C.teal, C.yellow, C.magenta, C.blue, 0xf5f0e0, 0x2a7d3a])).fillRect(x, ly, 10, rnd.between(12, 20));
    }
  }
  // Satellite dish and solar panels
  if (rnd.frac() < 0.7) {
    const x = rnd.between(20, roofW - 20);
    const y = rnd.between(20, bh - 20);
    g.fillStyle(0x000000, 0.25).fillCircle(x + 3, y + 4, 10);
    g.fillStyle(0xe8e8e8).fillCircle(x, y, 10);
    g.lineStyle(2, 0x9a9a9a).strokeCircle(x, y, 10).lineBetween(x, y, x + 7, y - 7);
    g.fillStyle(0x555555).fillCircle(x + 7, y - 7, 2);
  }
  if (rnd.frac() < 0.45) {
    const x = rnd.between(14, roofW - 70);
    const y = rnd.between(14, bh - 40);
    g.fillStyle(0x1f3a6e).fillRect(x, y, 56, 28);
    g.lineStyle(1, 0x7fa8d6, 0.7).strokeRect(x, y, 56, 28).lineBetween(x + 28, y, x + 28, y + 28).lineBetween(x, y + 14, x + 56, y + 14);
  }
  // AC units along the parapet
  g.fillStyle(0xbdbdbd);
  for (let k = rnd.between(2, 4); k > 0; k--) g.fillRect(roofW - 22, rnd.between(10, bh - 24), 14, 12);
  // Façade folded into view: one band per storey, balconies with plants and washing
  g.fillStyle(tint(color, 6)).fillRect(roofW, 0, face, bh);
  g.lineStyle(1, dark, 0.6);
  for (let x = roofW + 4; x < RES_FRONT; x += 4) g.lineBetween(x, 0, x, bh);
  for (let y = 10; y < bh - 26; y += 34) {
    g.fillStyle(shade(color, 32)).fillRect(roofW + 3, y, face - 6, 22);
    g.fillStyle(0x39424a).fillRect(roofW + 6, y + 4, face - 12, 6);
    if (rnd.frac() < 0.6) g.fillStyle(rnd.pick([0x43a047, C.red, C.blue, C.yellow])).fillRect(roofW + rnd.between(4, face - 10), y + 12, 6, 7);
  }
  g.lineStyle(3, dark).lineBetween(roofW, 0, roofW, bh);
  // Front yard, a parked car or bike, and the boundary wall with its gate
  g.fillStyle(0xb9b3a6).fillRect(RES_FRONT, 0, RES_W - RES_FRONT - RES_WALL, bh);
  if (rnd.frac() < 0.6) {
    const y = rnd.between(10, bh - 70);
    g.fillStyle(rnd.pick([0xf5f5f5, 0x9a1b1b, 0x2c3e66, 0x777777])).fillRoundedRect(RES_FRONT + 4, y, 20, 46, 6);
    g.fillStyle(0x1e2a36).fillRect(RES_FRONT + 7, y + 8, 14, 9);
  }
  g.fillStyle(WALL).fillRect(RES_W - RES_WALL, 0, RES_WALL, bh);
  g.fillStyle(shade(WALL, 25)).fillRect(RES_W - RES_WALL, 0, 2, bh);
  const gate = rnd.pick([0x2e6b4a, 0x274f8c, 0x2a2a2a, 0x8c2a2a]);
  const gy = rnd.between(30, bh - 70);
  g.fillStyle(gate).fillRect(RES_W - RES_WALL - 2, gy, RES_WALL + 2, 44);
  g.lineStyle(1, tint(gate, 30));
  for (let y = gy + 4; y < gy + 44; y += 5) g.lineBetween(RES_W - RES_WALL - 2, y, RES_W, y);
  g.fillStyle(C.yellow).fillRect(RES_W - RES_WALL - 1, gy + 20, 3, 4);
}

// --- Mohammadpur Town Hall Market ------------------------------------------------------------------
// Long corrugated tin roofs (rust, galvanised, blue) over the market halls, a concrete market block,
// open-air vegetable and fish stalls under plastic tarps, shoppers and vendors spilling onto the pavement.
const SHED_W = 240;
const TIN = [0xa65a3a, 0x9aa3a8, 0x4f7fa8];

function shed(g, i) {
  const h = 286;
  const rnd = rng(`shed${i}`);
  const tin = TIN[i];
  g.fillStyle(0x000000, 0.28).fillRect(10, 12, SHED_W - 10, h - 12);
  g.fillStyle(tin).fillRect(0, 0, SHED_W - 6, h - 12);
  // the ridge runs along the road; corrugations run down each slope
  g.fillStyle(shade(tin, 14)).fillRect((SHED_W - 6) / 2, 0, (SHED_W - 6) / 2, h - 12);
  g.lineStyle(2, shade(tin, 28), 0.5);
  for (let y = 4; y < h - 12; y += 7) g.lineBetween(0, y, SHED_W - 6, y);
  g.fillStyle(0x6b6b6b).fillRect((SHED_W - 6) / 2 - 4, 0, 8, h - 12);
  // patched sheets, rust and the bricks that hold them down
  for (let k = 0; k < 5; k++) g.fillStyle(rnd.pick(TIN), 0.85).fillRect(rnd.between(6, 180), rnd.between(6, h - 60), rnd.between(30, 50), rnd.between(24, 44));
  for (let k = 0; k < 7; k++) g.fillStyle(0x7a3b1c, 0.45).fillEllipse(rnd.between(10, 220), rnd.between(10, h - 20), rnd.between(14, 40), rnd.between(8, 20));
  g.fillStyle(0x8a3a28);
  for (let k = 0; k < 6; k++) g.fillRect(rnd.between(10, 220), rnd.between(10, h - 30), 10, 6);
  g.lineStyle(3, shade(tin, 35)).strokeRect(1, 1, SHED_W - 8, h - 14);
}

// The market's concrete block: flat roof, tanks, a stair room and a hoarding frame
function marketBlock(g) {
  const h = 300;
  g.fillStyle(0x000000, 0.28).fillRect(10, 12, SHED_W - 10, h - 12);
  g.fillStyle(0xc9c2b4).fillRect(0, 0, SHED_W - 6, h - 12);
  g.lineStyle(8, 0xa49c8c).strokeRect(4, 4, SHED_W - 14, h - 20);
  g.fillStyle(0xa49c8c).fillRect(30, 40, 70, 60);
  for (const [x, y] of [[150, 50], [185, 50], [150, 210]]) {
    g.fillStyle(0x1b1b1b).fillCircle(x, y, 15);
    g.fillStyle(0x4a4a4a).fillCircle(x - 5, y - 5, 4);
  }
  g.lineStyle(3, 0x555555).strokeRect(40, 150, 80, 100).lineBetween(40, 150, 120, 250).lineBetween(120, 150, 40, 250);
  g.fillStyle(0xbdbdbd);
  for (let y = 20; y < h - 30; y += 34) g.fillRect(SHED_W - 28, y, 14, 12);
}

function produce(g, rnd, x, y) {
  const kind = rnd.between(0, 5);
  if (kind === 5) {
    // fish on a round basket
    g.fillStyle(0x8a6a3a).fillCircle(x, y, 15);
    g.fillStyle(0x6b4f2a).fillCircle(x, y, 11);
    g.fillStyle(0xcfd8dc);
    for (let a = 0; a < 5; a++) g.fillEllipse(x + Math.cos(a * 1.3) * 6, y + Math.sin(a * 1.3) * 6, 14, 5);
    return;
  }
  const [c1, c2, r] = [[C.red, 0xb71c1c, 4], [0x43a047, 0x2e7d32, 3], [0xf28c28, 0xe65100, 6], [0x6a1b9a, 0x4a148c, 4], [0xf5f0e0, 0x8bc34a, 5]][kind];
  g.fillStyle(0x7a5a32).fillRect(x - 16, y - 12, 32, 24);
  for (let k = 0; k < 9; k++) g.fillStyle(k % 3 ? c1 : c2).fillCircle(x - 10 + (k % 3) * 10, y - 7 + Math.floor(k / 3) * 7, r);
}

function stalls(g, i) {
  const h = 200;
  const rnd = rng(`stalls${i}`);
  // tarps on bamboo poles: blue, orange, striped
  const tarps = [0x2b67b8, 0xf28c28, 0x2a8c4a, 0xd83a2e];
  for (let y = 4; y < h - 40; y += rnd.between(56, 70)) {
    const color = rnd.pick(tarps);
    const w = rnd.between(120, 160);
    const x = rnd.between(4, 30);
    g.fillStyle(0x000000, 0.25).fillRect(x + 8, y + 10, w, 54);
    g.fillStyle(color).fillRect(x, y, w, 54);
    if (rnd.frac() < 0.4) {
      g.fillStyle(C.cream);
      for (let sx = x + 10; sx < x + w; sx += 24) g.fillRect(sx, y, 10, 54);
    }
    g.lineStyle(2, shade(color, 30)).lineBetween(x, y + 27, x + w, y + 27).strokeRect(x, y, w, 54);
    g.fillStyle(0x8a6a3a).fillCircle(x + 2, y + 2, 3).fillCircle(x + w - 2, y + 52, 3);
  }
  // produce and fish towards the road, sellers and shoppers between
  for (let y = 18; y < h - 14; y += 36) produce(g, rnd, rnd.between(180, 214), y);
  for (let k = 0; k < 5; k++) person(g, rnd.between(150, 228), rnd.between(10, h - 14), rnd.pick(SHIRTS), rnd);
}

function crowd(g, i) {
  const rnd = rng(`crowd${i}`);
  const n = 4 + i;
  for (let k = 0; k < n; k++) person(g, rnd.between(16, 94), rnd.between(12, 116), rnd.pick(SHIRTS), rnd);
}

// Vegetable seller on a sheet on the pavement, with baskets and a customer
function vendor(g, i) {
  const rnd = rng(`vendor${i}`);
  g.fillStyle(0xc9a76a).fillRect(6, 10, 86, 70);
  g.lineStyle(2, 0x9a7a44).strokeRect(6, 10, 86, 70);
  for (let k = 0; k < 4; k++) produce(g, rnd, 26 + (k % 2) * 44, 30 + Math.floor(k / 2) * 34);
  person(g, 100, 46, rnd.pick(SHIRTS), rnd);
}

// Pavement stall under a plastic tarp on bamboo poles, produce laid out in front (towards +x, the road)
function tarpStall(g, i) {
  const rnd = rng(`tarp${i}`);
  const color = [0x2b67b8, 0xf28c28, 0xd83a2e][i];
  g.fillStyle(0x000000, 0.25).fillRect(10, 12, 70, 104);
  g.fillStyle(color).fillRect(2, 2, 70, 104);
  if (i === 2) {
    g.fillStyle(C.cream);
    for (let y = 2; y < 106; y += 26) g.fillRect(2, y, 70, 12);
  }
  g.lineStyle(2, shade(color, 30)).lineBetween(37, 2, 37, 106).strokeRect(2, 2, 70, 104);
  g.fillStyle(0x8a6a3a).fillCircle(4, 4, 3).fillCircle(70, 4, 3).fillCircle(4, 104, 3).fillCircle(70, 104, 3);
  for (let y = 18; y < 106; y += 30) produce(g, rnd, 92, y);
}

// --- Asad Gate memorial ------------------------------------------------------------------------------
// A white gateway of pillars under a deep lintel on a stepped plinth, in a small garden on the
// junction's corner. The gate itself is drawn upright (like a sign), so it reads as a gate.
const GATE_W = 230;
const GATE_H = 210;

function asadGate(g) {
  g.fillStyle(0x000000, 0.2).fillRoundedRect(8, 10, GATE_W - 8, GATE_H - 10, 26);
  g.fillStyle(0x6aa84f).fillRoundedRect(0, 0, GATE_W - 8, GATE_H - 10, 26);
  g.lineStyle(8, 0x3f7a2e).strokeRoundedRect(4, 4, GATE_W - 16, GATE_H - 18, 22);
  for (const [x, y] of [[26, 30], [196, 30], [26, 176], [196, 176], [60, 186], [162, 186]]) flower(g, x, y, 9, C.magenta, C.yellow);
  // stepped plinth
  g.fillStyle(0xbdb6a6).fillRect(20, 150, GATE_W - 48, 26);
  g.fillStyle(0xd8d2c4).fillRect(28, 140, GATE_W - 64, 14);
  g.lineStyle(2, 0x9a9384).lineBetween(20, 162, GATE_W - 28, 162).lineBetween(28, 152, GATE_W - 36, 152);
  // pillars and their shadow side
  const left = 38;
  const span = GATE_W - 84;
  for (let k = 0; k < 5; k++) {
    const x = left + (span / 4) * k - 7;
    g.fillStyle(0xf4f1ea).fillRect(x, 48, 14, 94);
    g.fillStyle(0xcfc9bc).fillRect(x + 9, 48, 5, 94);
  }
  // the lintel with the name plaque (lettering added on top)
  g.fillStyle(0x000000, 0.2).fillRect(26, 34, GATE_W - 48, 22);
  g.fillStyle(0xf4f1ea).fillRect(22, 20, GATE_W - 52, 32);
  g.lineStyle(3, 0xcfc9bc).strokeRect(22, 20, GATE_W - 52, 32);
  g.fillStyle(0x1f5a3a).fillRect(48, 24, GATE_W - 104, 24);
  // the flame on top
  g.fillStyle(C.red).fillTriangle(GATE_W / 2 - 14, 22, GATE_W / 2 + 6, 22, GATE_W / 2 - 4, 2);
  g.fillStyle(C.yellow).fillTriangle(GATE_W / 2 - 9, 22, GATE_W / 2 + 1, 22, GATE_W / 2 - 4, 10);
}

// --- texture generation -------------------------------------------------------------------------

const DRAWN = {
  lm_parl: [PARL_W, PARL_H, parliament],
  lm_kite: [36, 72, kite],
  lm_mkt: [SHED_W, 300, marketBlock],
  lm_gate: [GATE_W, GATE_H, asadGate],
};
RES.forEach((r, i) => (DRAWN[`lm_res${i}`] = [RES_W, r.h, (g) => residential(g, i)]));
TIN.forEach((_, i) => (DRAWN[`lm_shed${i}`] = [SHED_W, 286, (g) => shed(g, i)]));
for (let i = 0; i < 3; i++) DRAWN[`lm_stalls${i}`] = [SHED_W, 200, (g) => stalls(g, i)];
for (let i = 0; i < 4; i++) DRAWN[`lm_crowd${i}`] = [110, 128, (g) => crowd(g, i)];
for (let i = 0; i < 2; i++) DRAWN[`lm_vendor${i}`] = [116, 90, (g) => vendor(g, i)];
for (let i = 0; i < 3; i++) DRAWN[`lm_tarp${i}`] = [112, 120, (g) => tarpStall(g, i)];
const RES_KEYS = RES.map((_, i) => `lm_res${i}`);
const MARKET_KEYS = ['lm_shed0', 'lm_stalls0', 'lm_shed1', 'lm_stalls1', 'lm_mkt', 'lm_stalls2', 'lm_shed2'];

function makeTextures(scene) {
  if (scene.textures.exists('lm_parl')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const [key, [w, h, draw]] of Object.entries(DRAWN)) {
    g.clear();
    draw(g);
    g.generateTexture(key, w, h);
  }
  g.destroy();
  // The building as strips, nearest first: frame `s0` is the bottom slice of the texture
  const tex = scene.textures.get('lm_parl');
  for (let i = 0; i * PARL_SLICE < PARL_H; i++) {
    const y1 = PARL_H - i * PARL_SLICE;
    const y0 = Math.max(0, y1 - PARL_SLICE);
    tex.add(`s${i}`, 0, 0, y0, PARL_W, y1 - y0);
  }
  // The monument's plaque gets its name in Bangla
  stamp(scene, 'lm_gate', 'lm_gate_named', GATE_W, GATE_H, [['আসাদ গেট', GATE_W / 2 - 4, 36, 17, CSS.cream]]);
}

// Copy texture `base` into a new texture with text drawn on it (Bangla needs a real text object)
function stamp(scene, base, key, w, h, lines) {
  const dt = scene.textures.addDynamicTexture(key, w, h);
  if (!dt) return;
  dt.draw(base, 0, 0);
  for (const [str, x, y, size, color, extra] of lines) {
    const t = text(scene, 0, 0, str, size, color, extra).setOrigin(0.5);
    dt.draw(t, x, y);
    t.destroy();
  }
}

// Big name board on two posts, in the game's colours: Bangla large, English below
const SIGN_W = 300;
const SIGN_H = 132;

function signTexture(scene, label) {
  const key = `lm_sign_${label.en ?? label.bn}`;
  if (scene.textures.exists(key)) return key;
  if (!scene.textures.exists('lm_board')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x55555c).fillRect(52, 92, 14, 40).fillRect(SIGN_W - 66, 92, 14, 40);
    g.fillStyle(0x000000, 0.3).fillRoundedRect(8, 10, SIGN_W - 10, 100, 14);
    g.fillStyle(C.green).fillRoundedRect(2, 2, SIGN_W - 10, 100, 14);
    g.lineStyle(5, C.yellow).strokeRoundedRect(2, 2, SIGN_W - 10, 100, 14);
    g.lineStyle(2, C.cream).strokeRoundedRect(10, 10, SIGN_W - 26, 84, 10);
    for (const [x, y] of [[2, 2], [SIGN_W - 8, 2], [2, 102], [SIGN_W - 8, 102]]) flower(g, x, y, 9, C.magenta, C.yellow);
    g.generateTexture('lm_board', SIGN_W, SIGN_H);
    g.destroy();
  }
  const fit = (str, size, max) => {
    const t = text(scene, 0, 0, str, size, CSS.cream);
    const s = Math.min(size, Math.floor((size * max) / Math.max(1, t.width)));
    t.destroy();
    return s;
  };
  const bn = label.bn ?? '';
  const en = label.en ?? '';
  stamp(scene, 'lm_board', key, SIGN_W, SIGN_H, [
    [bn, SIGN_W / 2 - 4, en ? 42 : 52, fit(bn, 40, SIGN_W - 50), CSS.cream, { stroke: CSS.ink, strokeThickness: 5 }],
    ...(en ? [[en, SIGN_W / 2 - 4, 80, fit(en, 19, SIGN_W - 60), CSS.yellow]] : []),
  ]);
  return key;
}

// --- zones -------------------------------------------------------------------------------------------

// Which roadsides a zone covers: residential defaults to the left, the Parliament to the right,
// the market to both. f.side may be 'left', 'right' or 'both'.
const DEFAULT_SIDE = { residential: 'left', parliament: 'right', townhall: 'both', asadgate_monument: 'right' };
const sidesOf = (f) => {
  const s = f.side ?? DEFAULT_SIDE[f.type];
  return s === 'both' ? ['left', 'right'] : [s];
};
// Mirror a right-side rx to the left roadside
const mx = (side, rx) => (side === 'left' ? W - rx : rx);

// Where the Parliament building sits in its zone: the middle, kept clear of the zone's ends
function parlSpan(z) {
  const len = z.d1 - z.d;
  const mid = (z.d + z.d1) / 2;
  const d0 = len > PARL_H + 2 * LAKE + 400 ? Phaser.Math.Clamp(mid - PARL_H / 2, z.d + LAKE + 200, z.d1 - LAKE - 200 - PARL_H) : mid - PARL_H / 2;
  return [d0, d0 + PARL_H];
}

// Fillers: each keeps a cursor along the zone and, when the cursor comes into view, spawns what's at
// that route distance and returns how far on the next one goes.
const FILL = {
  residential: [
    // the blocks, with narrow alleys between them
    (scene, z, d, side) => {
      const i = Phaser.Math.Between(0, RES.length - 1);
      const h = RES[i].h;
      const rx = side === 'left' ? -RES_W / 2 : W + RES_W / 2;
      scene.makeProp(RES_KEYS[i], rx, scene.yOf(d + h / 2), 3, { flipX: side === 'right', flipY: Math.random() < 0.5 });
      return h + Phaser.Math.Between(8, 26);
    },
    // now and then a tree, a tea stall or a parked rickshaw on the pavement
    (scene, z, d, side) => {
      const r = Math.random();
      const rx = side === 'left' ? PAVE_L - 6 : W - PAVE_L + 6;
      if (r < 0.45) scene.makeProp('tree', rx, scene.yOf(d), 4, { scale: 0.85 });
      else if (r < 0.65) scene.makeProp('stall', rx, scene.yOf(d), 4, { flipX: side === 'right' });
      else if (r < 0.8) scene.makeProp('rickshaw', side === 'left' ? 84 : W - 84, scene.yOf(d), 4, { scale: 0.7, tilt: Math.random() < 0.5 ? 0 : 180 });
      return Phaser.Math.Between(260, 520);
    },
  ],
  townhall: [
    (scene, z, d, side) => {
      const key = MARKET_KEYS[Phaser.Math.Between(0, MARKET_KEYS.length - 1)];
      const h = scene.textures.getFrame(key).height;
      scene.makeProp(key, side === 'left' ? -SHED_W / 2 : W + SHED_W / 2, scene.yOf(d + h / 2), 3, { flipX: side === 'right' });
      return h + Phaser.Math.Between(4, 14);
    },
    // the busy pavement: shoppers, vegetable sellers, parked rickshaws
    (scene, z, d, side) => {
      const r = Math.random();
      const ry = scene.yOf(d);
      if (r < 0.45) {
        scene.makeProp(`lm_crowd${Phaser.Math.Between(0, 3)}`, mx(side, W - PAVE_L + Phaser.Math.Between(-6, 6)), ry, 4, { flipX: Math.random() < 0.5 });
      } else if (r < 0.65) {
        scene.makeProp(`lm_tarp${Phaser.Math.Between(0, 2)}`, mx(side, W - PAVE_L), ry, 4, { flipX: side === 'right' });
      } else if (r < 0.85) {
        scene.makeProp(`lm_vendor${Phaser.Math.Between(0, 1)}`, mx(side, W - PAVE_L + 2), ry, 4, { flipX: side === 'left' });
      } else {
        scene.makeProp('rickshaw', mx(side, W - 86), ry, 4, { scale: 0.72, tilt: Math.random() < 0.5 ? 0 : 180 });
      }
      return Phaser.Math.Between(80, 140);
    },
  ],
  parliament: [
    // the building, one strip at a time, starting at its near end
    {
      start: (z) => parlSpan(z)[0],
      fill: (scene, z, d, side) => {
        const [d0] = parlSpan(z);
        const i = Math.round((d - d0) / PARL_SLICE);
        const h = Math.min(PARL_SLICE, PARL_H - i * PARL_SLICE);
        if (h <= 0) return Infinity;
        const img = scene.makeProp('lm_parl', mx(side, PARL_X + PARL_W / 2), scene.yOf(d + h / 2), 3, { flipX: side === 'left' });
        img.setFrame(`s${i}`);
        return PARL_SLICE;
      },
    },
    // trees along the avenue edge (not in front of the South Plaza) and big shade trees on the lawns
    (scene, z, d, side) => {
      const [d0, d1] = parlSpan(z);
      const mid = (d0 + d1) / 2;
      if (Math.abs(d - mid) > PLAZA + 50) scene.makeProp('tree', mx(side, 742), scene.yOf(d), 4, { scale: Phaser.Math.FloatBetween(0.6, 0.75) });
      if ((d < d0 - LAKE - 60 || d > d1 + LAKE + 60) && Math.random() < 0.5) {
        scene.makeProp('tree', mx(side, Phaser.Math.Between(860, 1080)), scene.yOf(d + 60), 3, { scale: Phaser.Math.FloatBetween(0.9, 1.3) });
      }
      return Phaser.Math.Between(120, 170);
    },
    // kites over the lawns
    (scene, z, d, side) => {
      if (Math.random() < 0.6) scene.makeProp('lm_kite', mx(side, Phaser.Math.Between(700, 860)), scene.yOf(d), 41, { par: OVERHEAD, tilt: Phaser.Math.Between(-25, 25) });
      return Phaser.Math.Between(700, 1300);
    },
  ],
};

// Per-run state, keyed by the scene's object list (a fresh one every run)
const runs = new WeakMap();

function cursorsFor(scene, z) {
  const st = runs.get(scene.things);
  let cs = st.get(z);
  if (!cs) {
    cs = [];
    for (const g of FILL[z.type]) {
      const fill = g.fill ?? g;
      for (const side of sidesOf(z)) cs.push({ fill, side, d: g.start?.(z) ?? z.d });
    }
    st.set(z, cs);
  }
  return cs;
}

// --- contract -----------------------------------------------------------------------------------------

export function spawnLandmark(scene, f, ry) {
  if (FILL[f.type]) return true; // zones are filled by landmarkTick as they scroll into view
  if (f.type === 'asadgate_monument') {
    makeTextures(scene);
    const side = sidesOf(f)[0];
    // On the corner before the junction, clear of the cross road and off the carriageway
    scene.makeProp(scene.textures.exists('lm_gate_named') ? 'lm_gate_named' : 'lm_gate', mx(side, ROAD_X + ROAD_W + 165), scene.yOf(f.d - 380), 4, { scale: 1.2 });
    return true;
  }
  if (f.type === 'signboard') {
    makeTextures(scene);
    const key = signTexture(scene, f.text ?? { bn: '', en: '' });
    const side = f.side ?? 'right';
    // On posts on the pavement, the board reaching over the kerb lane like Dhaka's gantry boards
    const rx = mx(side, W - 110);
    scene.makeProp(key, rx + 12, ry + 44, 6, { tint: 0x000000, alpha: 0.22 });
    scene.makeProp(key, rx, ry, 41, { par: OVERHEAD });
    return true;
  }
  return false;
}

export function landmarkTick(scene, dy) {
  if (!runs.has(scene.things)) runs.set(scene.things, new Map());
  makeTextures(scene);
  const top = scene.distAt(SPAWN_ROW);
  const bottom = scene.distAt(BELOW);
  for (const z of features) {
    if (z.d > top) break; // features are sorted by d
    if (!FILL[z.type] || z.d1 === undefined || z.d1 < bottom) continue;
    for (const c of cursorsFor(scene, z)) {
      // skip what's already behind the leguna (a run starting inside a zone), then fill up to the top
      while (c.d < bottom - 400 && c.d < z.d1) c.d += 2 * PARL_SLICE; // keeps the building's strips aligned
      while (c.d <= top && c.d < z.d1) c.d += c.fill(scene, z, c.d, c.side);
    }
  }
}

export function sideTaken(d) {
  let left = false;
  let right = false;
  for (const f of features) {
    let hit = false;
    if (FILL[f.type]) hit = d >= f.d && d <= (f.d1 ?? f.d);
    else if (f.type === 'asadgate_monument') hit = d >= f.d - 520 && d <= f.d - 240;
    if (!hit) continue;
    for (const s of sidesOf(f)) {
      if (s === 'left') left = true;
      else right = true;
    }
  }
  return { left, right };
}

const LAWN = 0x6fae3e;
const LAWN_STRIPE = 0x82bf4c;
const WATER = 0x3f7fae;
const BRICK = 0xb5523b;
const RAIL = 0x2f3b33;
const YARD = 0x5a564f; // the narrow alleys and yards between apartment blocks
const MARKET_FLOOR = 0x6e675c;
const LITTER = [0x43a047, 0xf28c28, 0xc23b22, 0xd9cfa0];

// mirrored band / quad for the left roadside
const band = (road, side, a, b, color, alpha, d0, d1) => road.band(mx(side, a), mx(side, b), color, alpha, d0, d1);
const quad = (road, side, a, b, d0, d1) => road.quad(mx(side, a), mx(side, b), d0, d1);

export function drawLandmarks(road) {
  const { g } = road;
  for (const z of road.visible('parliament')) {
    const [b0, b1] = parlSpan(z);
    const mid = (b0 + b1) / 2;
    for (const side of sidesOf(z)) {
      band(road, side, W, W + FAR, LAWN, 1, z.d, z.d1);
      g.fillStyle(LAWN_STRIPE, 0.5);
      for (const d of road.marks(180, z.d, z.d1 - 90)) quad(road, side, W + 8, W + FAR, d, d + 90);
      // the lake around three sides of the building, with a stone edge
      const l0 = Math.max(z.d, b0 - LAKE);
      const l1 = Math.min(z.d1, b1 + LAKE);
      band(road, side, LAKE_X - 6, W + FAR, 0xcfc7b4, 1, l0 - 6, l1 + 6);
      band(road, side, LAKE_X, W + FAR, WATER, 1, l0, l1);
      g.fillStyle(0xcfe8ff, 0.4);
      for (const d of road.marks(46, l0, l1 - 4)) {
        const x = LAKE_X + 8 + ((d * 7919) % 90);
        quad(road, side, x, x + 26, d, d + 3);
      }
      // the South Plaza: a red-brick causeway from the lawn to the entrance
      band(road, side, W + 6, PARL_X + 12, BRICK, 1, mid - PLAZA, mid + PLAZA);
      g.fillStyle(0x8e3b28, 0.6);
      for (const d of road.marks(16, mid - PLAZA, mid + PLAZA - 2)) quad(road, side, W + 6, PARL_X + 12, d, d + 2);
      // boundary railing along the pavement
      band(road, side, W + 1, W + 6, RAIL, 1, z.d, z.d1);
      g.fillStyle(0x1b231e);
      for (const d of road.marks(28, z.d, z.d1)) quad(road, side, W - 1, W + 8, d, d + 5);
    }
  }
  for (const z of road.visible('residential')) {
    for (const side of sidesOf(z)) {
      band(road, side, W, W + FAR, YARD, 1, z.d, z.d1);
      band(road, side, W, W + RES_WALL, WALL, 1, z.d, z.d1);
    }
  }
  for (const z of road.visible('townhall')) {
    for (const side of sidesOf(z)) {
      band(road, side, W, W + FAR, MARKET_FLOOR, 1, z.d, z.d1);
      // trampled, muddy pavement
      band(road, side, ROAD_X + ROAD_W + 14, W, 0x6b5a3a, 0.22, z.d, z.d1);
    }
    // vegetable leaves, marigolds and peels underfoot
    for (const d of road.marks(34, z.d, z.d1)) {
      const k = Math.abs(Math.round(d * 7919)) % 997;
      g.fillStyle(LITTER[k % LITTER.length], 0.8);
      for (const side of sidesOf(z)) {
        const x = ROAD_X + ROAD_W + 18 + (k % 180);
        quad(road, side, x, x + 7, d, d + 5);
      }
    }
  }
}
