// Fixed design resolution: every device sees the same 9:16 composition, scaled to fit
export const W = 720;
export const H = 1280;

export const ROAD_X = 120;
export const ROAD_W = 480;
export const LANES = 3;
export const LANE_W = ROAD_W / LANES;
export const laneX = (lane) => ROAD_X + LANE_W * lane + LANE_W / 2;

export const PLAYER_Y = H - 240;
export const HUD_H = 150;

export const BASE_SPEED = 560; // px/s
export const ACCEL = 420; // px/s²
export const ROUTE_LENGTH = 48000; // px, about 90 s of clean driving

export const FONT = '"Noto Sans Bengali", "Hind Siliguri", system-ui, sans-serif';

export const COLORS = {
  magenta: 0xe6007e,
  teal: 0x00a6a6,
  yellow: 0xffd400,
  red: 0xe63022,
  green: 0x1f9e4a,
  blue: 0x1f5fbf,
  cream: 0xfff3d6,
  ink: 0x1a1a2e,
  asphalt: 0x3b3b46,
  white: 0xffffff,
};
export const CSS = {
  magenta: '#e6007e',
  yellow: '#ffd400',
  cream: '#fff3d6',
  ink: '#1a1a2e',
  teal: '#00a6a6',
};

// vy: the object's own forward speed. It drifts towards the player at (playerSpeed - vy).
// Sounds and memes per kind live in public/memes.json (spawn_<kind>, close_<kind>, crash_<kind>, ...).
export const KINDS = {
  rickshaw: { tex: 'rickshaw', vy: 160, solid: true },
  cng: { tex: 'cng', vy: 300, solid: true },
  bus: { tex: 'bus', vy: 340, solid: true },
  car: { tex: 'car', vy: 420, solid: true },
  police: { tex: 'police', vy: 0, solid: true },
  cow: { tex: 'cow', vy: 0, solid: true },
  hawker: { tex: 'hawker', vy: 40, solid: true },
  puddle: { tex: 'puddle', vy: 0, effect: 'slow' },
  passenger: { tex: 'passenger', vy: 0, effect: 'fare' },
  // Road hazards. `warn` is the helper's shout when one is coming up in your lane.
  pothole: { tex: 'pothole', vy: 0, effect: 'jolt', warn: 'helper_pothole', depth: 2 },
  manhole: { tex: 'manhole', vy: 0, solid: true, warn: 'helper_manhole', depth: 2 },
  // Set-piece kinds, placed by `features` rather than random spawns
  speedbreaker: { tex: 'speedbreaker', vy: 0, effect: 'bump', span: true, depth: 2 },
  pedestrian: { tex: 'ped0', vy: 0, solid: true },
};

// Bends: each stretch lists [share of the stretch, road position at its end]. The position is in
// BEND_SHIFT units sideways (-1 = left, 1 = right); the road eases there with a smooth S, and a run of
// equal positions is a straight. Only differences matter, since the view keeps the player's row centred.
export const BEND_SHIFT = 200; // px

// Farmgate → Mohammadpur Bus Stand. `at` is the fraction of the route where the stretch begins.
// `ambience` is the quiet street sound under each stretch (see setAmbience in audio/sfx.js):
// hum, wind and rain are steady layers (0–1 loudness); horns, bells, chatter, birds and drips are
// one-off sounds (average number per second).
export const STRETCHES = [
  {
    id: 'farmgate', at: 0,
    name: { bn: 'ফার্মগেট', en: 'Farmgate' },
    spawn: { rickshaw: 3, cng: 2, bus: 1, passenger: 3, hawker: 2, pothole: 1 },
    gap: [520, 820],
    ambience: { hum: 0.9, horns: 0.6, bells: 0.4, chatter: 0.3 },
    // Busy wiggles, then Khamarbari's long left sweep onto Manik Mia Avenue
    bends: [[0.3, 0], [0.25, 0.3], [0.2, 0], [0.25, -0.8]],
    features: [
      { type: 'footbridge', at: 0.2 },
      { type: 'bunting', at: 0.3 },
      { type: 'zebra', at: 0.38 },
      { type: 'speedbreaker', at: 0.55 },
      { type: 'bunting', at: 0.72 },
    ],
  },
  {
    id: 'manikmia', at: 0.18,
    name: { bn: 'মানিক মিয়া এভিনিউ', en: 'Manik Mia Avenue' },
    spawn: { car: 4, bus: 1, police: 1, passenger: 1 },
    gap: [600, 900],
    speedBonus: 1.25,
    ambience: { hum: 0.3, wind: 0.8, birds: 0.3, horns: 0.1 },
    bends: [[1, -0.8]], // dead straight, wide avenue
    // Planted median on the left and open lawns beyond it
    features: [{ type: 'avenue', at: 0, to: 1 }, { type: 'speedbreaker', at: 0.6 }],
  },
  {
    id: 'asadgate', at: 0.4,
    name: { bn: 'আসাদ গেট', en: 'Asad Gate' },
    spawn: { bus: 3, rickshaw: 3, cng: 2, passenger: 1, manhole: 1 },
    gap: [420, 680],
    ambience: { hum: 1, horns: 0.8, bells: 0.3, chatter: 0.2 },
    // Straight run-up to the junction, then the right sweep onto Asad Avenue
    bends: [[0.5, -0.8], [0.3, 0.4], [0.2, 0.4]],
    features: [{ type: 'junction', at: 0.42 }],
  },
  {
    id: 'asadave', at: 0.62,
    name: { bn: 'আসাদ এভিনিউ', en: 'Asad Avenue' },
    spawn: { puddle: 3, cow: 2, rickshaw: 2, cng: 1, passenger: 2, pothole: 2, manhole: 1 },
    gap: [480, 760],
    ambience: { hum: 0.4, rain: 0.8, drips: 0.8, bells: 0.2 },
    bends: [[0.25, 1.1], [0.25, 0.2], [0.25, 1], [0.25, 0.6]], // S-bends
    features: [{ type: 'flood', at: 0.3, to: 0.6 }, { type: 'speedbreaker', at: 0.8 }],
  },
  {
    id: 'mohammadpur', at: 0.84,
    name: { bn: 'মোহাম্মদপুর বাসস্ট্যান্ড', en: 'Mohammadpur Bus Stand' },
    spawn: { passenger: 3, bus: 2, rickshaw: 2, cng: 1, hawker: 1, pothole: 1 },
    gap: [460, 720],
    ambience: { hum: 0.6, chatter: 0.9, horns: 0.5, bells: 0.3 },
    bends: [[0.35, 0.3], [0.65, 0.3]], // eases straight into the bus stand
    features: [{ type: 'zebra', at: 0.3 }, { type: 'bunting', at: 0.45 }, { type: 'busstand', at: 0.6, to: 1 }],
  },
];

export const FARE_PER_PASSENGER = 10;

// A close call: passing within this many px of a vehicle without touching it earns a bonus
export const CLOSE_MARGIN = 28;
export const CLOSE_BONUS = 2;

export const BRAKE_DECEL = ACCEL * 3;
export const RED_LIGHT_FINE = 20;
// Junction geometry, in px of route distance from the junction's centre line
export const JUNCTION = { halfWidth: 110, zebra: [120, 190], stopLine: 205, clear: 300 };
