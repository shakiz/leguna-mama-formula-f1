// Draws the road every frame as horizontal strips, each slid sideways by the bend at that row, so
// asphalt, kerbs and lane dashes all curve together. Works on both WebGL and Canvas renderers.
import { W, H, ROAD_X, ROAD_W, LANES, LANE_W, laneX, COLORS as C } from './config.js';

const ROW = 20; // strip height in px
const KERB = 14;
const GROUND = 0x4a4a52; // concrete behind the buildings, seen in the gaps between them
const SIDEWALK = 0xd9c9a3;
const SIDEWALK_JOINT = 0xbfae86;
const TYRE_TRACKS = 0x2c2c34;

export default class RoadRenderer {
  // view: { distance, yOf(d) → screen y, offAt(y) → sideways shift of that row }
  constructor(scene, view) {
    this.g = scene.add.graphics().setDepth(0);
    this.view = view;
    this.rows = [];
    for (let y = -ROW; y <= H + ROW; y += ROW) this.rows.push({ y, off: 0 });
    // Reused point objects, so drawing doesn't allocate every frame
    this.pool = Array.from({ length: this.rows.length * 2 + 4 }, () => ({ x: 0, y: 0 }));
    this.poly = [];
    this.showCentre = false;
  }

  point(i, x, y) {
    const p = this.pool[i];
    p.x = x;
    p.y = y;
    this.poly.push(p);
  }

  // A strip of road between two sideways positions, following the bend down the whole screen
  band(rx0, rx1, color, alpha = 1) {
    const { rows } = this;
    this.poly.length = 0;
    let i = 0;
    for (const r of rows) this.point(i++, rx0 + r.off, r.y);
    for (let k = rows.length - 1; k >= 0; k--) this.point(i++, rx1 + rows[k].off, rows[k].y);
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

  // Route distances of every `step` mark currently on screen
  *marks(step) {
    const { view } = this;
    const lo = Math.floor(view.distAt(H + ROW) / step) * step;
    const hi = view.distAt(-ROW);
    for (let d = lo; d <= hi; d += step) yield d;
  }

  draw() {
    const { g, view, rows } = this;
    g.clear();
    for (const r of rows) r.off = view.offAt(r.y);

    g.fillStyle(GROUND).fillRect(0, 0, W, H);
    this.band(0, ROAD_X, SIDEWALK);
    this.band(ROAD_X + ROAD_W, W, SIDEWALK);
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
    for (let l = 1; l < LANES; l++) {
      const x = ROAD_X + LANE_W * l;
      for (const d of this.marks(256)) this.quad(x - 4, x + 4, d + 64, d + 192);
    }

    if (this.showCentre) this.band(W / 2 - 2, W / 2 + 2, C.magenta);
  }
}
