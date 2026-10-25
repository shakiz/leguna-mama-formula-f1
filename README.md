# লেগুনা মামা — Formula F1

A free, just-for-fun web game: drive a leguna from **Farmgate to Mohammadpur Bus Stand**, dodge rickshaws, weaving motorbikes, swerving battery rickshaws, buses, BRTC double-deckers, cows and waterlogging, pick up passengers, and share your time. Works the same on phones and desktop (fixed 9:16 layout, scaled to fit).

Built with [Phaser 3.90](https://phaser.io) and Vite. Nearly all art and sounds are placeholders generated in code (the exceptions are the leguna's side-view art, its recorded engine and a few voice clips), so the whole game is ~470 KB gzipped.

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
| `vibrate` | Phone vibration: ms, or an on/off pattern like `[90, 50, 160]`. Off when muted; not supported on iPhone |

**`triggers`**: meme popups per event, rotating without repeats. A meme can carry its own voice line in `audio` and an extra `sfx` stinger.

**Event names** follow `<event>_<vehicle>`. If a specific entry is missing, the general one is used: `close_cng` falls back to `close`, and `crash_bus` to `crash`.

The BRTC double-decker (`brtc`, Manik Mia Avenue and Asad Gate only) has the full set: `spawn_brtc` sounds its deep `airhorn` now and then, `close_brtc` / `closeturn_brtc` add the horn and a diesel `rumble`, and `crash_brtc` is a heavier `bigcrash`; the closeturn and crash chain to `brtc_honk` (the air horn again).

The motorbike (`bike`) and the battery rickshaw Dhaka calls a "Tesla" (`tesla`) change lanes (see [Lane changers](#lane-changers)). `spawn_bike` revs and pips (`rev`), `spawn_tesla` gives its tinny electric whine and horn (`ewhine`); both have their own `close_` / `closeturn_` memes. Two recorded voice clips live in `public/audio/clips/`:

- `assalamualaikum-boro-bhai.mp3`: `pass_tesla`, when the leguna overtakes a Tesla (it goes from fully ahead to fully behind without a crash, in any lane). 10 s cooldown, no bonus.
- `dhur-beta.mp3` ("Dhur beta, aita hoilo beta?"): `crash_tesla` and `crash_rickshaw` keep their crash sound and chain after 250 ms to `rickshaw_dhur`, which holds the clip. It is a separate event because an event whose clip plays skips its own `sfx`.

An event on cooldown skips its meme popup as well as its sound, so a voice line and its popup stay together.

| Event | When |
|---|---|
| `start`, `finish`, `newbest`, `stretch_<id>` | Run start, finish, new record, entering a route stretch. `finish` and `newbest` keep their `sting` and chain to `finish_voice` 250 ms later |
| `finish_voice` | The finish voice line, "আজ চলে যাচ্ছি, কিন্তু যাচ্ছি না" (`audio/clips/aj-chole-jacchi.mp3`). A separate event because a clip on `finish` itself would replace the sting |
| `speedup` | "খেলা হবে!" (`audio/clips/khela-hobe.mp3`, with a popup). Fires when the leguna is back above 90% of its target speed after a real slowdown (under 40% of cruising after a crash, braking or a red light, or a crawl through the flood), and 1.5 s into Manik Mia Avenue's speed bonus. Never off the start line or after the finish; 25 s `cooldown`, also applied to the popup. Thresholds: `SLOWED`, `CRUISING`, `SPEEDUP_DELAY` in `GameScene.js` |
| `pickup`, `puddle` | Passenger picked up, drove through water |
| `crash_<vehicle>` | Collision. `crash_car` (bumper) chains to `bump_honk`, `crash_brtc` to `brtc_honk`, `crash_tesla` and `crash_rickshaw` to `rickshaw_dhur` |
| `close_<vehicle>` | Passed within `CLOSE_MARGIN` px without touching: +৳2 bonus. Just driving in the lane next to a wide bus or BRTC doesn't count |
| `closeturn_<vehicle>` | Swerved out of a lane just before impact: +৳2 bonus |
| `helper_left`, `helper_right`, `helper_ahead` | Helper's warning on every close call ("বামে / ডানে / সামনে প্লাস্টিক!") |
| `spawn_<vehicle>` | Vehicle appears (ambient horn, bell, moo) |
| `pass_<vehicle>` | Overtook a vehicle whose kind has `pass: true` in `KINDS` (the Tesla) |
| `pothole`, `speedbreaker`, `speedbreaker_fast` | Hit a pothole, went over a speed breaker (`_fast`: took it fast and flew) |
| `red_light` | Crossed the stop line on red: fined |

**Engine sound** is a recording of a real leguna, `public/audio/engine/leguna-engine.mp3` (3.5 s seamless loop, mono 64 kbps, 30 KB), looped in `src/audio/sfx.js`. Its pitch and volume follow the speed: idling at 0.8× pitch when stopped, 1× at cruising and 1.25× at Manik Mia Avenue's top speed, a little quieter on the brake, and always under the dhol and voice clips. Until it has decoded (or if it fails to load) a synthesised rumble stands in. To use a new recording, run `tools/enhance_engine.py` on it (usage at the top of the script): it cleans it up (high-pass, low-mid body, hiss cut, light compression, normalising), picks the steadiest stretch and makes the loop. If you change `--length`, update `ENGINE_LOOP_LENGTH` in `sfx.js`, and bump `CACHE` in `public/sw.js` so installed copies fetch the new file.

**Street sounds** are synthesised continuously in `src/audio/sfx.js`: each stretch in `src/config.js` has an `ambience` bed. `hum`, `wind` and `rain` are steady layers (0–1 loudness); `horns`, `bells`, `chatter`, `birds` and `drips` are one-off sounds (average number per second):

```js
ambience: { hum: 0.4, rain: 0.8, drips: 0.8, bells: 0.2 }, // Asad Avenue
```

**Voice clips** (`public/audio/clips/`): every recorded clip played from an `audio` field is treated as a voice, automatically, with no per-clip code (`playClip` in `src/audio/sfx.js`):

- **One voice at a time**: a new clip fades out (60 ms) whatever clip is still talking, so two lines never overlap. The newest wins.
- **Ducking**: while a voice plays, the dhol music and street ambience drop to 35% and the engine to 70% (over ~120 ms), and come back over ~300 ms once the last voice ends. Tune `DUCK` in `sfx.js`.
- **Repeats**: give clip events a `cooldown` so the same line can't come back too soon (`speedup` 25 s, `finish_voice` 5 s). Meme lines rotate through a shuffle-bag, and non-forced popups have their own shared cooldown.
- Mute silences clips like everything else (and skips new ones); a hidden tab suspends all audio.

**Recording clips:** mono MP3 at 48–64 kbps, 1–3 seconds, ideally under 40 KB. Put them in `public/audio/` (for example `public/audio/helper/bame-plastic.mp3`) and list them in the event's `audio`. Re-record lines yourself rather than ripping original clips.

**Recording voices:** [`docs/recording-script.md`](docs/recording-script.md) is the script for friends recording real lines and sounds: every meme line, helper callout and placeholder sound effect, with a suggested file name (in `public/audio/voice/` or `public/audio/sfx/`), a delivery note and what's already recorded. It's generated from `memes.json`, so after changing memes.json regenerate it with `python3 tools/recording_script.py` (Python 3, no packages needed).

**Testing in dev** (`npm run dev` only): keys `1`–`9` spawn rickshaw, CNG, bus, car, police, cow, hawker, puddle or passenger in your lane, `0` a BRTC double-decker, `B` a motorbike and `T` a Tesla; with `Shift`, they spawn in the next lane. In the console, `window.__game.scene.getScene('Game')` is the running race.

## Road bends

Each stretch in `src/config.js` has a `bends` list of `[share of the stretch, road position at its end]`. Positions are in `BEND_SHIFT` (200 px) units: `-1` is left, `1` is right. The road eases between them with a smooth S, so repeating the same position makes a straight. Shares in a stretch must add up to 1.

Gameplay lives in straight-road coordinates (`rx`, `ry` on every object) and `place()` in `GameScene.js` bends them onto the screen, so lanes, collisions and close calls work the same on curves. In dev, press `C` to show the road's centre line; the console warns if a bend is too sharp to keep lanes on screen.

## Road feel

- **Camera lean**: the main camera turns up to 2° with the road's heading under the leguna (`LEAN`, `MAX_LEAN` in `GameScene.js`). The HUD, meme popups, callouts and floating `+৳` texts are drawn by a second, level camera. Anything added to the scene is world by default; pass new HUD or popup objects through `this.toHud()`.
- **Speed streaks**: faint lines whip past along the pavements and kerbs from just under cruising speed, strongest with Manik Mia Avenue's speed bonus (drawn by `src/road.js`).
- **Vibration**: crashes, potholes, fast speed breakers and the red-light fine buzz the phone (`vibrate` in `memes.json`).

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

**Fair spawns:** `spawn()` never fills the last free lane near the top of the screen, and it also predicts when each solid will pass the leguna at the stretch's cruising speed, so slow, long vehicles (the 384 px BRTC) can't drift into a three-lane wall further down.

## Lane changers

Kinds with a `weave` entry in `KINDS` hop to an adjacent lane on a random timer (`weave()` in `GameScene.js`):

| Kind | Speed (`vy`) | Where | Lane changes |
|---|---|---|---|
| `bike`: motorbike, rider with a helmet, pillion without | 450, fast | Every stretch, a little | Every 1–2.2 s, a smooth 320 ms slide with a slight lean |
| `tesla`: battery rickshaw / easybike, painted canopy over an open cabin | 200, slow | Mostly Asad Avenue and Mohammadpur, a little at Farmgate | Every 0.6–1.4 s, a sudden 200 ms lurch that overshoots, with a bigger lean |

A lane change only starts when it's fair (`canChangeLane()`):

- the vehicle is on screen and its tail stays at least `SWERVE_SAFE` (250 px) ahead of the leguna's nose for the whole move, in any lane, since the player may be steering into it;
- nothing solid in the target lane is within `SWERVE_GAP` (40 px) of it, now or (given their speeds) in the next `SWERVE_LOOKAHEAD` (3) seconds;
- it wouldn't close the last free lane at the player's row: the same prediction `spawn()` uses.

While moving, the vehicle's `lane` follows its centre (for collisions, close calls and `checkNearMiss`), and it counts as blocking both lanes for spawns and the fairness check (`inLane()`). If it catches up with something slower in its lane it tucks in behind at that speed and looks for a gap sooner.

## Where things live

| Path | What |
|---|---|
| `src/config.js` | Design resolution, speeds, route stretches with their bends, obstacle types |
| `src/track.js` | Turns each stretch's `bends` into the road's sideways offset along the route |
| `src/road.js` | Draws the bending road every frame (asphalt, kerbs, lane dashes, pavements, speed streaks) |
| `src/scenes/GameScene.js` | The race: spawning, steering, collisions, meme popups, HUD |
| `src/art/textures.js` | Placeholder rickshaw-art sprites drawn in code; replace with real images later |
| `src/audio/sfx.js` | Synthesised sound effects, recorded clips (one voice at a time, ducking), the dhol loop, the engine (recorded loop, synth fallback), street ambience and vibration |
| `public/audio/clips/` | Recorded voice lines for events and memes (listed in `memes.json`) |
| `public/audio/engine/leguna-engine.mp3` | The leguna's engine loop, made by `tools/enhance_engine.py` from a phone recording |
| `tools/` | Asset scripts: `cutout.py` (vehicle art cut-outs), `enhance_engine.py` (engine recording to game loop), `recording_script.py` (memes.json to the recording script) |
| `docs/recording-script.md` | What to record for voices and sound effects, generated by `tools/recording_script.py` |
| `public/audio/voice/`, `public/audio/sfx/` | Where recorded voice lines / callouts and sound effects go |
| `src/i18n.js` | Bangla / English strings |
| `src/share.js` | Score-card image for Facebook / Messenger sharing |
