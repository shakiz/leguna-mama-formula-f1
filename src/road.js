// Draws the road every frame as horizontal strips, each slid sideways by the bend at that row, so
// asphalt, kerbs and lane dashes all curve together. Works on both WebGL and Canvas renderers.
import { W, H, ROAD_X, ROAD_W, LANES, LANE_W, laneX, JUNCTION, COLORS as C } from './config.js';
import { features } from './track.js';

const ROW = 20; // strip height in px
const KERB = 14;
const GROUND = 0x4a4a52; // concrete behind the buildings, seen in the gaps between them
const SIDEWALK = 0xd9c9a3;
const SIDEWALK_JOINT = 0xbfae86;
const TYRE_TRACKS = 0x2c2c34;
const MEDIAN = 0x5f9e45;
const HEDGE = 0x3f7a2e;
const LAWN = 0x7cb342;
const LOT = 0x55555f;
const WATER = 0x3d7fb8;
const FAR = 600; // how far past the screen edge cross roads and lawns are drawn, so bends never show their end

export default class RoadRenderer {
  // view: { distance, yOf(d) → screen y, offAt(y) → sideways shift of that row }
  constructor(scene, view) {
    this.g = scene.add.graphics().setDepth(0);
    this.view = view;
    this.rows = [];
    for (let y = -ROW; y <= H + ROW; y += ROW) this.rows.push({ y, off: 0 });
    // Reused point objects, so drawing doesn't allocate every frame
    this.pool = Array.from({ length: this.rows.length * 2 + 8 }, () => ({ x: 0, y: 0 }));
    this.poly = [];
    this.ys = [];
    this.showCentre = false;
  }

  point(i, x, y) {
    const p = this.pool[i];
    p.x = x;
    p.y = y;
    this.poly.push(p);
  }

  // A strip between two sideways positions that follows the bend, optionally only between route
  // distances d0 and d1 (a zone); without them it runs down the whole screen
  band(rx0, rx1, color, alpha = 1, d0 = -Infinity, d1 = Infinity) {
    const { rows, view, ys } = this;
    const top = Math.max(rows[0].y, view.yOf(d1));
    const bottom = Math.min(rows[rows.length - 1].y, view.yOf(d0));
    if (top >= bottom) return;
    ys.length = 0;
    ys.push(top);
    for (const r of rows) if (r.y > top && r.y < bottom) ys.push(r.y);
    ys.push(bottom);
    this.poly.length = 0;
    let i = 0;
    for (const y of ys) this.point(i++, rx0 + view.offAt(y), y);
    for (let k = ys.length - 1; k >= 0; k--) this.point(i++, rx1 + view.offAt(ys[k]), ys[k]);
    this.g.fillStyle(color, alpha).fillPoints(this.poly, true);
  }

  // A short patch of road between two route distances (kerb stripe, lane dash)
  quad(rx0, rx1, d0, d1) {
    const { view } = this;
    const y0 = view.yOf(d0);
    const y1 = view.yOf(d1);
    const o0 = view.offAt(y0);
    const o1 = view.offAt(y1);
    this.poly.length = 0;
    this.point(0, rx0 + o0, y0);
    this.point(1, rx1 + o0, y0);
    this.point(2, rx1 + o1, y1);
    this.point(3, rx0 + o1, y1);
    this.g.fillPoints(this.poly, true);
  }

  // Route distances of every `step` mark currently on screen (optionally limited to [from, to])
  *marks(step, from = -Infinity, to = Infinity) {
    const { view } = this;
    const lo = Math.floor(Math.max(from, view.distAt(H + ROW)) / step) * step;
    const hi = Math.min(to, view.distAt(-ROW));
    for (let d = lo; d <= hi; d += step) yield d;
  }

  // Features overlapping the screen right now
  *visible(type, margin = 0) {
    const lo = this.view.distAt(H + ROW) - margin;
    const hi = this.view.distAt(-ROW) + margin;
    for (const f of features) if (f.type === type && (f.d1 ?? f.d) >= lo && f.d <= hi) yield f;
  }

  // White zebra bars across the road, centred on route distance d
  zebra(d, half = 35) {
    this.g.fillStyle(C.white, 0.85);
    for (let x = ROAD_X + 12; x < ROAD_X + ROAD_W - 20; x += 48) this.quad(x, x + 28, d - half, d + half);
  }

  draw() {
    const { g, view, rows } = this;
    g.clear();
    for (const r of rows) r.off = view.offAt(r.y);

    g.fillStyle(GROUND).fillRect(0, 0, W, H);
    this.band(0, ROAD_X, SIDEWALK);
    this.band(ROAD_X + ROAD_W, W, SIDEWALK);
    // Manik Mia Avenue: planted median on the left, open lawns beyond it
    for (const z of this.visible('avenue')) {
      this.band(-FAR, 0, LAWN, 1, z.d, z.d1);
      this.band(0, ROAD_X - KERB, MEDIAN, 1, z.d, z.d1);
      g.fillStyle(HEDGE);
      for (const d of this.marks(96, z.d, z.d1 - 48)) this.quad(24, ROAD_X - 38, d, d + 48);
    }
    // Mohammadpur bus stand: an open lot beyond the right pavement with painted bays
    for (const z of this.visible('busstand')) {
      this.band(W, W + FAR, LOT, 1, z.d, z.d1);
      g.fillStyle(C.white, 0.6);
      for (const d of this.marks(170, z.d, z.d1)) this.quad(W + 4, W + 300, d, d + 5);
    }
    g.lineStyle(2, SIDEWALK_JOINT);
    for (const d of this.marks(64)) {
      const y = view.yOf(d);
      const o = view.offAt(y);
      g.lineBetween(o, y, ROAD_X - KERB + o, y);
      g.lineBetween(ROAD_X + ROAD_W + KERB + o, y, W + o, y);
    }
    for (const rx of [ROAD_X / 2, W - ROAD_X / 2]) this.band(rx - 1, rx + 1, SIDEWALK_JOINT);

    this.band(ROAD_X - KERB, ROAD_X, C.ink);
    this.band(ROAD_X + ROAD_W, ROAD_X + ROAD_W + KERB, C.ink);
    g.fillStyle(C.yellow);
    for (const d of this.marks(64)) {
      this.quad(ROAD_X - KERB, ROAD_X, d, d + 32);
      this.quad(ROAD_X + ROAD_W, ROAD_X + ROAD_W + KERB, d, d + 32);
    }

    this.band(ROAD_X, ROAD_X + ROAD_W, C.asphalt);
    // Worn, darker strips where wheels run in each lane
    for (let l = 0; l < LANES; l++) {
      for (const s of [-36, 36]) this.band(laneX(l) + s - 11, laneX(l) + s + 11, TYRE_TRACKS, 0.35);
    }
    g.fillStyle(C.white, 0.8);
    const junctions = [...this.visible('junction', JUNCTION.clear)];
    const inJunction = (d) => junctions.some((j) => Math.abs(d - j.d) < JUNCTION.stopLine + 20);
    for (let l = 1; l < LANES; l++) {
      const x = ROAD_X + LANE_W * l;
      for (const d of this.marks(256)) {
        if (!inJunction(d + 64) && !inJunction(d + 192)) this.quad(x - 4, x + 4, d + 64, d + 192);
      }
    }

    for (const f of this.visible('zebra', 40)) this.zebra(f.d);

    // Asad Gate: the cross road cuts through everything, with zebras and a stop line on our approach
    const J = JUNCTION;
    for (const j of this.visible('junction', J.clear)) {
      this.band(-FAR, W + FAR, C.asphalt, 1, j.d - J.halfWidth, j.d + J.halfWidth);
      g.fillStyle(C.white, 0.8);
      for (let x = -FAR; x < W + FAR; x += 90) this.quad(x, x + 46, j.d - 3, j.d + 3);
      const zebraMid = (J.zebra[0] + J.zebra[1]) / 2;
      const zebraHalf = (J.zebra[1] - J.zebra[0]) / 2;
      this.zebra(j.d - zebraMid, zebraHalf);
      this.zebra(j.d + zebraMid, zebraHalf);
      g.fillStyle(C.white);
      this.quad(ROAD_X, ROAD_X + ROAD_W, j.d - J.stopLine - 6, j.d - J.stopLine + 6);
    }

    // Asad Avenue waterlogging: murky water over road and pavements, with ripples
    for (const z of this.visible('flood')) {
      this.band(-20, W + 20, WATER, 0.5, z.d, z.d1);
      g.fillStyle(0xcfe8ff, 0.45);
      for (const d of this.marks(70, z.d, z.d1)) {
        const x = 40 + ((d * 7919) % 600);
        this.quad(x, x + 46, d, d + 3);
      }
    }

    if (this.showCentre) this.band(W / 2 - 2, W / 2 + 2, C.magenta);
  }
}
