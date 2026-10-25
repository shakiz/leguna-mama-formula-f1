// The route's shape: how far the road sits sideways at any distance along it, precomputed from the
// `bends` of each stretch into a lookup table so per-frame queries are just an array read.
import { STRETCHES, ROUTE_LENGTH, BEND_SHIFT } from './config.js';

const STEP = 8; // px of route distance per table entry
const PAD = 2000; // straight road before the start and after the finish, so the view never runs off the table
const MAX_SLOPE = 0.2; // steeper than ~11° and lanes at the top of the screen slide off the edge

let table = new Float32Array(2);

export function buildTrack() {
  const segs = [];
  let d = 0;
  let pos = 0;
  STRETCHES.forEach((st, i) => {
    const len = ((STRETCHES[i + 1]?.at ?? 1) - st.at) * ROUTE_LENGTH;
    for (const [share, to] of st.bends) {
      segs.push([d, d + share * len, pos, to * BEND_SHIFT]);
      d += share * len;
      pos = to * BEND_SHIFT;
    }
    if (import.meta.env.DEV) {
      const total = st.bends.reduce((s, [share]) => s + share, 0);
      if (Math.abs(total - 1) > 1e-6) console.warn(`Stretch ${st.id}: bend shares add up to ${total}, not 1`);
    }
  });

  table = new Float32Array(Math.ceil((ROUTE_LENGTH + 2 * PAD) / STEP) + 1);
  let si = 0;
  for (let i = 0; i < table.length; i++) {
    const dd = i * STEP - PAD;
    while (si < segs.length - 1 && dd > segs[si][1]) si++;
    const [a, b, from, to] = segs[si];
    const u = Math.min(1, Math.max(0, (dd - a) / (b - a)));
    table[i] = from + (to - from) * u * u * (3 - 2 * u); // smoothstep: no kinks where bends meet
  }

  if (import.meta.env.DEV) {
    let steepest = 0;
    for (let i = 1; i < table.length; i++) steepest = Math.max(steepest, Math.abs(table[i] - table[i - 1]) / STEP);
    if (steepest > MAX_SLOPE) console.warn(`Track slope ${steepest.toFixed(3)} exceeds ${MAX_SLOPE}: lengthen that bend`);
  }
}

// Sideways road position (px) at route distance d
export function offsetAt(d) {
  const f = (d + PAD) / STEP;
  const i = Math.min(table.length - 2, Math.max(0, Math.floor(f)));
  const u = Math.min(1, Math.max(0, f - i));
  return table[i] + (table[i + 1] - table[i]) * u;
}

// Road heading at route distance d, in radians clockwise from straight up
export function angleAt(d) {
  return Math.atan((offsetAt(d + STEP) - offsetAt(d - STEP)) / (2 * STEP));
}
