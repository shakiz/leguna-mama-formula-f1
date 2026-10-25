# লেগুনা মামা — Formula F1

A free, just-for-fun web game: drive a leguna from **Farmgate to Mohammadpur Bus Stand**, dodge rickshaws, buses, cows and waterlogging, pick up passengers, and share your time. Works the same on phones and desktop (fixed 9:16 layout, scaled to fit).

Built with [Phaser 3.90](https://phaser.io) and Vite. All art and sounds are placeholders generated in code, so the whole game is ~330 KB gzipped.

## Run locally

```sh
npm install
npm run dev        # http://localhost:5173, also reachable from your phone on the same Wi-Fi
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Controls: tap or swipe left/right on mobile, `←` `→` or `A` `D` on desktop. Swipe down (hold) or hold `↓` / `S` to brake. `Enter` starts a run.

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick the repo.
3. Build command: `npm run build` · Build output directory: `dist`.

Every push to `main` then deploys automatically, and other branches get preview URLs. `public/_headers` sets long caching for hashed assets and no caching for `memes.json` and the service worker.

## Sounds and memes

Everything lives in `public/memes.json`; edit and push, no code changes needed.

**`events`**: what each game event sounds like.

```json
"crash_car": { "sfx": "crunch", "audio": ["audio/events/crunch-1.mp3"], "chain": [{ "event": "bump_honk", "delay": 450 }] }
```

| Field | Meaning |
|---|---|
| `audio` | Recorded clip(s) in `public/audio/...`. With several, one is picked at random |
| `sfx` | Built-in placeholder sound(s), used while no clip has loaded. See `SFX` in `src/audio/sfx.js` |
| `volume` | Clip volume, 0–1 (default 1) |
| `cooldown` | Minimum ms between two plays of this event |
| `chance` | Play only this fraction of the time (used for ambient spawn sounds) |
| `memeChance` | Show a meme popup only this fraction of the time |
| `caption` | Helper callout shown near the leguna, e.g. `{ "bn": "বামে প্লাস্টিক!", "en": "..." }` |
| `chain` | Follow-up events fired after a delay |

**`triggers`**: meme popups per event, rotating without repeats. A meme can carry its own voice line in `audio` and an extra `sfx` stinger.

**Event names** follow `<event>_<vehicle>`. If a specific entry is missing, the general one is used: `close_cng` falls back to `close`, and `crash_bus` to `crash`.

| Event | When |
|---|---|
| `start`, `finish`, `newbest`, `stretch_<id>` | Run start, finish, new record, entering a route stretch |
| `pickup`, `puddle` | Passenger picked up, drove through water |
| `crash_<vehicle>` | Collision. `crash_car` (bumper) chains to `bump_honk` |
| `close_<vehicle>` | Passed within `CLOSE_MARGIN` px without touching: +৳2 bonus |
| `closeturn_<vehicle>` | Swerved out of a lane just before impact: +৳2 bonus |
| `helper_left`, `helper_right`, `helper_ahead` | Helper's warning on every close call ("বামে / ডানে / সামনে প্লাস্টিক!") |
| `spawn_<vehicle>` | Vehicle appears (ambient horn, bell, moo) |

**Recording clips:** mono MP3 at 48–64 kbps, 1–3 seconds, ideally under 40 KB. Put them in `public/audio/` (for example `public/audio/helper/bame-plastic.mp3`) and list them in the event's `audio`. Re-record lines yourself rather than ripping original clips.

**Testing in dev** (`npm run dev` only): keys `1`–`9` spawn rickshaw, CNG, bus, car, police, cow, hawker, puddle or passenger in your lane; `Shift` + number spawns in the next lane.

## Road bends

Each stretch in `src/config.js` has a `bends` list of `[share of the stretch, road position at its end]`. Positions are in `BEND_SHIFT` (200 px) units: `-1` is left, `1` is right. The road eases between them with a smooth S, so repeating the same position makes a straight. Shares in a stretch must add up to 1.

Gameplay lives in straight-road coordinates (`rx`, `ry` on every object) and `place()` in `GameScene.js` bends them onto the screen, so lanes, collisions and close calls work the same on curves. In dev, press `C` to show the road's centre line; the console warns if a bend is too sharp to keep lanes on screen.

## Set pieces

Each stretch can list `features` in `src/config.js`, placed by share of the stretch (`at`, plus `to` for zones):

| Type | What it is |
|---|---|
| `footbridge`, `bunting` | Overhead foot over-bridge / festoon line (overhead things scroll slightly faster, so they read as higher up) |
| `zebra` | Zebra crossing with pedestrians walking across |
| `speedbreaker` | Full-width bump; take it fast and the leguna takes off |
| `junction` | Cross road with a signal: it turns red as you approach, waiting at the stop line turns it green, crossing on red costs a fine |
| `avenue` (zone) | Planted median and lawns on the left |
| `flood` (zone) | Waterlogged road: 70% speed and splashes |
| `busstand` (zone) | Parked buses and a bus lot on the right |

Potholes and open manholes come from the random spawn mix (`spawn` weights per stretch); the helper warns you when one is coming up in your lane.

## Where things live

| Path | What |
|---|---|
| `src/config.js` | Design resolution, speeds, route stretches with their bends, obstacle types |
| `src/track.js` | Turns each stretch's `bends` into the road's sideways offset along the route |
| `src/road.js` | Draws the bending road every frame (asphalt, kerbs, lane dashes, pavements) |
| `src/scenes/GameScene.js` | The race: spawning, steering, collisions, meme popups, HUD |
| `src/art/textures.js` | Placeholder rickshaw-art sprites drawn in code; replace with real images later |
| `src/audio/sfx.js` | Synthesised sound effects and the dhol loop |
| `src/i18n.js` | Bangla / English strings |
| `src/share.js` | Score-card image for Facebook / Messenger sharing |
