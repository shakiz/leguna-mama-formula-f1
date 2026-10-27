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
  // BRTC double-decker: the slowest, longest thing with an engine, so overtaking it is a commitment
  brtc: { tex: 'brtc', vy: 300, solid: true },
  // Lane changers (see weave() in GameScene). `weave`: seconds between attempts, how long the move
  // takes, its easing and lean. The bike slips across smoothly; the "Tesla" lurches over without warning.
  // `pass`: overtaking one fires pass_<kind>.
  bike: { tex: 'bike', vy: 450, solid: true, weave: { every: [1, 2.2], dur: 320, ease: 'Sine.easeInOut', tilt: 9 } },
  tesla: { tex: 'tesla', vy: 200, solid: true, pass: true, weave: { every: [0.6, 1.4], dur: 200, ease: 'Back.easeOut', tilt: 16 } },
  // Road hazards. `warn` is the helper's shout when one is coming up in your lane.
  pothole: { tex: 'pothole', vy: 0, effect: 'jolt', warn: 'helper_pothole', depth: 2 },
  manhole: { tex: 'manhole', vy: 0, solid: true, warn: 'helper_manhole', depth: 2 },
  // Set-piece kinds, placed by `features` rather than random spawns
  speedbreaker: { tex: 'speedbreaker', vy: 0, effect: 'bump', span: true, depth: 2 },
  pedestrian: { tex: 'ped0', vy: 0, solid: true },
  // VIP motorcade car: comes from behind with its siren on and overtakes. Spawned by its own timer
  // (`vip` per stretch), never by `spawn` weights; its vy is set from the cruising speed when it appears.
  vip: { tex: 'vip', vy: 0, solid: true },
};

// The VIP: `vip` in a stretch is the chance of one per roll, rolled every VIP.roll px of route.
// It drives `boost` px/s faster than the stretch's cruising speed; the warning shows `lead` s before it
// is spawned `spawnBelow` px under the screen, so it reaches the leguna about 2.2 s after the warning
// (enough to react on a phone). Moving out of its lane in time pays `bonus`.
export const VIP = { roll: 1400, boost: 250, lead: 1.2, spawnBelow: 200, bonus: 5 };

// Bends: each stretch lists [share of the stretch, road position at its end]. The position is in
// BEND_SHIFT units sideways (-1 = left, 1 = right); the road eases there with a smooth S, and a run of
// equal positions is a straight. Only differences matter, since the view keeps the player's row centred.
export const BEND_SHIFT = 200; // px

// Farmgate → Mohammadpur Bus Stand, the real way: dead straight down Manik Mia Avenue past the Parliament,
// LEFT at the signal at its end, a short run up Mirpur Road, RIGHT at Asad Gate, then straight along Asad
// Avenue past Town Hall Market to the bus stand. `at` is the fraction of the route where the stretch begins.
// `ambience` is the quiet street sound under each stretch (see setAmbience in audio/sfx.js):
// hum, wind and rain are steady layers (0–1 loudness); horns, bells, chatter, birds and drips are
// one-off sounds (average number per second).
// `view` (optional): camera framing on that stretch, tweened in on entering it. `zoom` < 1 shows more,
// `panX` slides the view that many px of road to the right (the leguna stays on its row).
// Features may carry extra fields (`side`, `text`, `turn`, `signal`); track.js passes them through.
// Landmark types (`residential`, `parliament`, `townhall`, `asadgate_monument`, `signboard`) are drawn by
// src/landmarks.js. Keep zone landmarks and props that are drawn by the road renderer at least
// TURN_REACH (2000) px clear of a turning junction (see GameScene.js): the view rotates 90° there.
export const STRETCHES = [
  {
    id: 'farmgate', at: 0,
    name: { bn: 'ফার্মগেট', en: 'Farmgate' },
    spawn: { rickshaw: 3, cng: 2, bus: 1, passenger: 3, hawker: 2, pothole: 1, bike: 1, tesla: 0.5 },
    gap: [520, 820],
    vip: 0.03,
    ambience: { hum: 0.9, horns: 0.6, bells: 0.4, chatter: 0.3 },
    bends: [[1, 0]], // straight
    features: [
      { type: 'residential', at: 0, to: 1, side: 'left' },
      { type: 'footbridge', at: 0.2 },
      { type: 'bunting', at: 0.3 },
      { type: 'zebra', at: 0.38 },
      { type: 'speedbreaker', at: 0.6 },
      { type: 'bunting', at: 0.8 },
    ],
  },
  {
    id: 'manikmia', at: 0.16,
    name: { bn: 'মানিক মিয়া এভিনিউ', en: 'Manik Mia Avenue' },
    spawn: { car: 5, bus: 1, brtc: 1.5, police: 0.5, passenger: 1, bike: 1 },
    gap: [600, 900],
    speedBonus: 1.25,
    vip: 0.3, // the wide avenue is where the motorcades fly
    ambience: { hum: 0.3, wind: 0.8, birds: 0.3, horns: 0.1 },
    // Wide avenue: zoomed out and slid right so the Parliament side is in view
    view: { zoom: 0.8, panX: 70 },
    bends: [[1, 0]], // dead straight
    features: [
      { type: 'residential', at: 0, to: 0.72, side: 'left' },
      { type: 'parliament', at: 0.1, to: 0.72, side: 'right' },
      { type: 'signboard', at: 0.12, side: 'right', text: { bn: 'জাতীয় সংসদ ভবন', en: 'National Parliament House' } },
      { type: 'speedbreaker', at: 0.78 },
      // The signal at the end of the avenue: red light, cross traffic, and the LEFT turn towards Asad Gate
      { type: 'junction', at: 0.93, turn: 'left', signal: true },
    ],
  },
  {
    id: 'asadgate', at: 0.4,
    name: { bn: 'আসাদ গেট', en: 'Asad Gate' },
    spawn: { bus: 3, brtc: 2, rickshaw: 1, cng: 2, car: 1, passenger: 1, manhole: 1, bike: 1 },
    gap: [420, 680],
    vip: 0.03,
    ambience: { hum: 1, horns: 0.8, bells: 0.3, chatter: 0.2 },
    bends: [[1, 0]],
    features: [
      { type: 'signboard', at: 0.45, side: 'left', text: { bn: 'আসাদ গেট', en: 'Asad Gate' } },
      // Asad Gate itself: police-directed (no red light), turn RIGHT onto Asad Avenue
      { type: 'junction', at: 0.72, turn: 'right', signal: false },
      { type: 'asadgate_monument', at: 0.72 },
    ],
  },
  {
    id: 'asadave', at: 0.5,
    name: { bn: 'আসাদ এভিনিউ', en: 'Asad Avenue' },
    spawn: { puddle: 3, cow: 1, rickshaw: 3, cng: 2, passenger: 2, pothole: 2, manhole: 1, bike: 1, tesla: 3, hawker: 0.5 },
    gap: [480, 760],
    ambience: { hum: 0.4, rain: 0.8, drips: 0.8, bells: 0.3 },
    bends: [[1, 0]],
    features: [
      { type: 'speedbreaker', at: 0.25 },
      { type: 'flood', at: 0.4, to: 0.75 },
      { type: 'zebra', at: 0.88 },
    ],
  },
  {
    id: 'townhall', at: 0.7,
    name: { bn: 'টাউন হল মার্কেট', en: 'Town Hall Market' },
    spawn: { rickshaw: 4, hawker: 3, passenger: 3, tesla: 2, cng: 1, pothole: 1, bike: 0.5 },
    gap: [460, 700],
    vip: 0.03,
    ambience: { hum: 0.7, chatter: 1.2, bells: 0.8, horns: 0.4 },
    bends: [[1, 0]],
    features: [
      { type: 'townhall', at: 0, to: 1 },
      { type: 'signboard', at: 0.08, side: 'left', text: { bn: 'টাউন হল মার্কেট', en: 'Town Hall Market' } },
      { type: 'zebra', at: 0.3 },
      { type: 'bunting', at: 0.45 },
      { type: 'zebra', at: 0.65 },
      { type: 'speedbreaker', at: 0.85 },
    ],
  },
  {
    id: 'mohammadpur', at: 0.8,
    name: { bn: 'মোহাম্মদপুর বাসস্ট্যান্ড', en: 'Mohammadpur Bus Stand' },
    spawn: { passenger: 3, bus: 2, rickshaw: 2, cng: 2, hawker: 1, pothole: 1, bike: 1, tesla: 2 },
    gap: [460, 720],
    vip: 0.03,
    ambience: { hum: 0.6, chatter: 0.9, horns: 0.5, bells: 0.3 },
    bends: [[1, 0]],
    features: [
      { type: 'zebra', at: 0.25 },
      { type: 'bunting', at: 0.4 },
      { type: 'signboard', at: 0.55, side: 'right', text: { bn: 'মোহাম্মদপুর বাসস্ট্যান্ড', en: 'Mohammadpur Bus Stand' } },
      { type: 'busstand', at: 0.6, to: 1 },
    ],
  },
];

export const FARE_PER_PASSENGER = 10;

// A close call: passing within this many px of a vehicle without touching it earns a bonus
export const CLOSE_MARGIN = 28;
export const CLOSE_BONUS = 2;

export const BRAKE_DECEL = ACCEL * 3;
export const RED_LIGHT_FINE = 20;
// Junction geometry, in px from the junction's centre. Junctions are square and look the same from all
// four arms (the cross road is as wide as ours, with kerbs, lane dashes, zebras and stop lines on every
// arm), so the view can rotate 90° there and carry on along the cross road without a visible jump.
// `clear`: no rooftops, decor, decals or overhead things within this distance of the centre.
export const JUNCTION = { halfWidth: ROAD_W / 2, zebra: [262, 330], stopLine: 352, clear: 520 };
// Turning: the leguna slows to TURN.speed px/s over the last TURN.slowFrom px before the centre, the
// steering locks for the last TURN.lockFrom px, and at the centre the view pivots 90° in TURN.pivot s
export const TURN = { speed: 200, slowFrom: 450, lockFrom: 110, pivot: 0.7 };
