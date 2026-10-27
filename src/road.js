// Draws the road every frame as horizontal strips, each slid sideways by the bend at that row, so
// asphalt, kerbs and lane dashes all curve together. Works on both WebGL and Canvas renderers.
// Only the rows the camera can see are drawn: the scene passes the view's bounding box in world
// coordinates (`view.viewBox`), which grows when the camera zooms out or rotates through a turn.
import { W, ROAD_X, ROAD_W, LANES, LANE_W, laneX, JUNCTION, COLORS as C } from './config.js';
import { features } from './track.js';
import { drawLandmarks } from './landmarks.js';

const ROW = 20; // strip height in px
const KERB = 14;
const GROUND = 0x4a4a52; // concrete behind the buildings, seen in the gaps between them
const SIDEWALK = 0xd9c9a3;
const SIDEWALK_JOINT = 0xbfae86;
const TYRE_TRACKS = 0x2c2c34;
const LOT = 0x55555f;
const WATER = 0x3d7fb8;
const LOT_FAR = 600; // how far the bus stand's lot reaches beyond the right pavement
const CROSS_FAR = 2200; // how far each arm of a junction's cross road is drawn from its centre
const BLEED = 60; // ground drawn past the view's edges, so the leaning camera never shows a bare corner
// Speed streaks: sideways positions on the pavements and just inside the kerbs (mirrored on the right),
// spacing along the route, and how much faster than the road they rush past
const STREAK_X = [16, 46, 80, ROAD_X + 10];
const STREAK_GAP = 110;
const STREAK_RUSH = 0.6;
// Junction cross-section, in px from the centre line of the road (ours runs from -HALF to HALF)
const HALF = ROAD_W / 2;
const PAVE = HALF + ROAD_X; // outer edge of the pavement
const KERB_IN = HALF + KERB; // the kerb is the pavement's inner KERB px
const CX = W / 2;
// Zebra bars across a road, symmetric about its centre line so they match from every arm
const ZEBRA_BARS = [24, 72, 120, 168, 216].flatMap((u) => [-u, u]);
const ZEBRA_BAR = 28;

export default class RoadRenderer {
  // view: { distance, yOf(d) → screen y, distAt(y), offAt(y) → sideways shift of that row,
  //         viewBox: { x0, x1, y0, y1 } the world area the camera shows }
  constructor(scene, view) {
    this.g = scene.add.graphics().setDepth(0);
    this.view = view;
    this.rows = [];
    this.pool = [];
    this.poly = [];
    this.ys = [];
    this.top = 0;
    this.bottom = 0;
    this.showCentre = false;
    this.streaks = 0; // 0–1, set by the scene from the leguna's speed
  }

  // Strips covering the view's rows, plus a reused point pool so drawing doesn't allocate every frame
  layoutRows() {
    const { y0, y1 } = this.view.viewBox;
    this.top = Math.floor(y0 / ROW) * ROW - ROW;
    this.bottom = Math.ceil(y1 / ROW) * ROW + ROW;
    const n = (this.bottom - this.top) / ROW + 1;
    while (this.rows.length < n) this.rows.push({ y: 0, off: 0 });
    this.rows.length = n;
    for (let i = 0; i < n; i++) {
      const r = this.rows[i];
      r.y = this.top + i * ROW;
      r.off = this.view.offAt(r.y);
    }
    while (this.pool.length < n * 2 + 8) this.pool.push({ x: 0, y: 0 });
  }

  point(i, x, y) {
    const p = this.pool[i];
    p.x = x;
    p.y = y;
    this.poly.push(p);
  }

  // A strip between two sideways positions that follows the bend, optionally only between route
  // distances d0 and d1 (a zone); without them it runs down the whole view
  band(rx0, rx1, color, alpha = 1, d0 = -Infinity, d1 = Infinity) {
    const { rows, view, ys } = this;
    const top = Math.max(this.top, view.yOf(d1));
    const bottom = Math.min(this.bottom, view.yOf(d0));
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

  // Route distances of every `step` mark currently in view (optionally limited to [from, to])
  *marks(step, from = -Infinity, to = Infinity) {
    const { view } = this;
    const lo = Math.floor(Math.max(from, view.distAt(this.bottom)) / step) * step;
    const hi = Math.min(to, view.distAt(this.top));
    for (let d = lo; d <= hi; d += step) yield d;
  }

  // Features overlapping the view right now
  *visible(type, margin = 0) {
    const lo = this.view.distAt(this.bottom) - margin;
    const hi = this.view.distAt(this.top) + margin;
    for (const f of features) if (f.type === type && (f.d1 ?? f.d) >= lo && f.d <= hi) yield f;
  }

  // White zebra bars across the road, centred on route distance d
  zebra(d, half = 35) {
    this.g.fillStyle(C.white, 0.85);
    for (const u of ZEBRA_BARS) this.quad(CX + u - ZEBRA_BAR / 2, CX + u + ZEBRA_BAR / 2, d - half, d + half);
  }

  // --- junctions ------------------------------------------------------------
  // Drawn in the junction's own frame: u along the cross road (sideways on screen), v along ours (down
  // the screen), both from its centre. Everything here is the same seen from each of the four arms.

  // Fill the rectangle u0..u1 × v0..v1 of junction j
  jrect(j, u0, u1, v0, v1) {
    this.g.fillRect(CX + j.off + u0, j.y + v0, u1 - u0, v1 - v0);
  }

  // The same rectangle on both cross arms (u → -u) and on both sides of the cross road (v → -v)
  jmirror(j, u0, u1, v0, v1) {
    this.jrect(j, u0, u1, v0, v1);
    this.jrect(j, -u1, -u0, v0, v1);
    this.jrect(j, u0, u1, -v1, -v0);
    this.jrect(j, -u1, -u0, -v1, -v0);
  }

  // Positions k·step (k ≥ 0) from `from` out to the end of the drawn cross road
  *armSteps(from, step) {
    for (let u = Math.ceil(from / step) * step; u <= CROSS_FAR; u += step) yield u;
  }

  junctionPavement(j) {
    this.g.fillStyle(SIDEWALK);
    this.jmirror(j, HALF, CROSS_FAR, HALF, PAVE);
  }

  junctionJoints(j) {
    this.g.fillStyle(SIDEWALK_JOINT);
    // Across the pavement every 64 px, and a line along its middle, like ours
    for (const u of this.armSteps(KERB_IN, 64)) this.jmirror(j, u - 1, u + 1, KERB_IN, PAVE);
    this.jmirror(j, HALF, CROSS_FAR, PAVE - ROAD_X / 2 - 1, PAVE - ROAD_X / 2 + 1);
  }

  junctionKerbs(j) {
    this.g.fillStyle(C.ink);
    this.jmirror(j, HALF, CROSS_FAR, HALF, KERB_IN);
  }

  junctionKerbStripes(j) {
    this.g.fillStyle(C.yellow);
    for (const u of this.armSteps(HALF + 16, 64)) this.jmirror(j, u - 16, u + 16, HALF, KERB_IN);
  }

  // Cross road asphalt (over our road's pavements and kerbs), its worn tyre tracks, lane dashes,
  // then zebras and stop lines on all four arms
  junctionRoad(j) {
    const J = JUNCTION;
    const g = this.g;
    g.fillStyle(C.asphalt);
    this.jrect(j, -CROSS_FAR, CROSS_FAR, -HALF, HALF);
    g.fillStyle(TYRE_TRACKS, 0.35);
    for (let l = 0; l < LANES; l++) {
      for (const s of [-36, 36]) {
        const v = laneX(l) - CX + s;
        this.jrect(j, HALF, CROSS_FAR, v - 11, v + 11);
        this.jrect(j, -CROSS_FAR, -HALF, v - 11, v + 11);
      }
    }
    g.fillStyle(C.white, 0.8);
    for (let l = 1; l < LANES; l++) {
      const v = ROAD_X + LANE_W * l - CX;
      for (const u of this.armSteps(J.stopLine + 8 + 64, 256)) {
        this.jrect(j, u - 64, u + 64, v - 4, v + 4);
        this.jrect(j, -u - 64, -u + 64, v - 4, v + 4);
      }
    }
    const zebraMid = (J.zebra[0] + J.zebra[1]) / 2;
    const zebraHalf = (J.zebra[1] - J.zebra[0]) / 2;
    g.fillStyle(C.white, 0.85);
    for (const w of ZEBRA_BARS) {
      for (const s of [-1, 1]) {
        // Across our arms, then across the cross road's
        this.jrect(j, w - ZEBRA_BAR / 2, w + ZEBRA_BAR / 2, s * zebraMid - zebraHalf, s * zebraMid + zebraHalf);
        this.jrect(j, s * zebraMid - zebraHalf, s * zebraMid + zebraHalf, w - ZEBRA_BAR / 2, w + ZEBRA_BAR / 2);
      }
    }
    g.fillStyle(C.white);
    for (const s of [-1, 1]) {
      this.jrect(j, -HALF, HALF, s * J.stopLine - 6, s * J.stopLine + 6);
      this.jrect(j, s * J.stopLine - 6, s * J.stopLine + 6, -HALF, HALF);
    }
  }

  // Faint motion lines along the pavements and road edges. They sit at fixed spots in a space that
  // slides STREAK_RUSH faster than the road, so they whip past, and grow longer and brighter with amount.
  drawStreaks(amount) {
    const { view } = this;
    const phase = view.distance * STREAK_RUSH;
    const len = 50 + 150 * amount;
    const lo = view.distAt(this.bottom) + phase - len;
    const hi = view.distAt(this.top) + phase;
    const n = STREAK_X.length;
    this.g.fillStyle(C.white, 0.3 * amount);
    for (let s = Math.floor(lo / STREAK_GAP) * STREAK_GAP; s <= hi; s += STREAK_GAP) {
      // Cheap hash of the slot picks a lane for each streak, so they don't line up
      const k = Math.floor(s / STREAK_GAP);
      const left = STREAK_X[(((k * 7) % n) + n) % n];
      const right = W - STREAK_X[(((k * 5 + 2) % n) + n) % n];
      const d = s - phase;
      this.quad(left - 1.5, left + 1.5, d, d + len);
      this.quad(right - 1.5, right + 1.5, d + STREAK_GAP / 2, d + STREAK_GAP / 2 + len);
    }
  }

  draw() {
    const { g, view } = this;
    g.clear();
    this.layoutRows();
    const box = view.viewBox;

    g.fillStyle(GROUND).fillRect(box.x0 - BLEED, this.top - BLEED, box.x1 - box.x0 + 2 * BLEED, this.bottom - this.top + 2 * BLEED);
    // Junctions in view, with their centre row and sideways shift
    const J = JUNCTION;
    const junctions = [...this.visible('junction', CROSS_FAR)];
    for (const j of junctions) {
      j.y = view.yOf(j.d);
      j.off = view.offAt(j.y);
    }

    this.band(0, ROAD_X, SIDEWALK);
    this.band(ROAD_X + ROAD_W, W, SIDEWALK);
    for (const j of junctions) this.junctionPavement(j);
    drawLandmarks(this);
    // Mohammadpur bus stand: an open lot beyond the right pavement with painted bays
    for (const z of this.visible('busstand')) {
      this.band(W, W + LOT_FAR, LOT, 1, z.d, z.d1);
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
    for (const j of junctions) this.junctionJoints(j);

    this.band(ROAD_X - KERB, ROAD_X, C.ink);
    this.band(ROAD_X + ROAD_W, ROAD_X + ROAD_W + KERB, C.ink);
    for (const j of junctions) this.junctionKerbs(j);
    // Kerb stripes centred on every 64 px of route, so they're symmetric about a junction's centre
    g.fillStyle(C.yellow);
    for (const d of this.marks(64)) {
      this.quad(ROAD_X - KERB, ROAD_X, d - 16, d + 16);
      this.quad(ROAD_X + ROAD_W, ROAD_X + ROAD_W + KERB, d - 16, d + 16);
    }
    for (const j of junctions) this.junctionKerbStripes(j);

    this.band(ROAD_X, ROAD_X + ROAD_W, C.asphalt);
    // Worn, darker strips where wheels run in each lane
    for (let l = 0; l < LANES; l++) {
      for (const s of [-36, 36]) this.band(laneX(l) + s - 11, laneX(l) + s + 11, TYRE_TRACKS, 0.35);
    }
    g.fillStyle(C.white, 0.8);
    // No lane dashes between the stop lines
    const inJunction = (d0, d1) => junctions.some((j) => d1 > j.d - J.stopLine - 8 && d0 < j.d + J.stopLine + 8);
    for (let l = 1; l < LANES; l++) {
      const x = ROAD_X + LANE_W * l;
      for (const d of this.marks(256)) {
        if (!inJunction(d + 64, d + 192)) this.quad(x - 4, x + 4, d + 64, d + 192);
      }
    }

    for (const f of this.visible('zebra', 40)) this.zebra(f.d);
    for (const j of junctions) this.junctionRoad(j);

    // Asad Avenue waterlogging: murky water over road and pavements, with ripples
    for (const z of this.visible('flood')) {
      this.band(-20, W + 20, WATER, 0.5, z.d, z.d1);
      g.fillStyle(0xcfe8ff, 0.45);
      for (const d of this.marks(70, z.d, z.d1)) {
        const x = 40 + ((d * 7919) % 600);
        this.quad(x, x + 46, d, d + 3);
      }
    }

    if (this.streaks > 0) this.drawStreaks(this.streaks);
    if (this.showCentre) this.band(W / 2 - 2, W / 2 + 2, C.magenta);
  }
}
