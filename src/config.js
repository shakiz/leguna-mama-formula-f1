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
};

// Farmgate → Mohammadpur Bus Stand. `at` is the fraction of the route where the stretch begins.
export const STRETCHES = [
  {
    id: 'farmgate', at: 0,
    name: { bn: 'ফার্মগেট', en: 'Farmgate' },
    spawn: { rickshaw: 3, cng: 2, bus: 1, passenger: 3, hawker: 2 },
    gap: [520, 820],
  },
  {
    id: 'manikmia', at: 0.18,
    name: { bn: 'মানিক মিয়া এভিনিউ', en: 'Manik Mia Avenue' },
    spawn: { car: 4, bus: 1, police: 1, passenger: 1 },
    gap: [600, 900],
    speedBonus: 1.25,
  },
  {
    id: 'asadgate', at: 0.4,
    name: { bn: 'আসাদ গেট', en: 'Asad Gate' },
    spawn: { bus: 3, rickshaw: 3, cng: 2, passenger: 1 },
    gap: [420, 680],
  },
  {
    id: 'asadave', at: 0.62,
    name: { bn: 'আসাদ এভিনিউ', en: 'Asad Avenue' },
    spawn: { puddle: 3, cow: 2, rickshaw: 2, cng: 1, passenger: 2 },
    gap: [480, 760],
  },
  {
    id: 'mohammadpur', at: 0.84,
    name: { bn: 'মোহাম্মদপুর বাসস্ট্যান্ড', en: 'Mohammadpur Bus Stand' },
    spawn: { passenger: 3, bus: 2, rickshaw: 2, cng: 1, hawker: 1 },
    gap: [460, 720],
  },
];

export const FARE_PER_PASSENGER = 10;

// A close call: passing within this many px of a vehicle without touching it earns a bonus
export const CLOSE_MARGIN = 28;
export const CLOSE_BONUS = 2;
