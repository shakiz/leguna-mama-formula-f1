# লেগুনা মামা — Formula F1

A free, just-for-fun web game: drive a leguna from **Farmgate to Mohammadpur Bus Stand**, dodge rickshaws, weaving motorbikes, swerving battery rickshaws, buses, BRTC double-deckers, VIP motorcades, cows and waterlogging, pick up passengers, and share your time. Works the same on phones and desktop (fixed 9:16 layout, scaled to fit).

Built with [Phaser 3.90](https://phaser.io) and Vite. Nearly all art and sounds are placeholders generated in code (the exceptions are the leguna's side-view art, its recorded engine and five voice clips), so the game itself is ~380 KB to download (gzipped code, art and `memes.json`), plus ~215 KB of audio fetched in the background (the 30 KB engine loop and 190 KB of voice clips). A careful run takes about 90–95 s.

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

An event on cooldown skips its meme popup as well as its sound, even a forced one, so a voice line and its popup stay together.

**Vehicles with their own sounds:**

- **BRTC double-decker** (`brtc`, Manik Mia Avenue and Asad Gate): `spawn_brtc` sounds its deep `airhorn` now and then, `close_brtc` / `closeturn_brtc` add the horn and a diesel `rumble`, and `crash_brtc` is a heavier `bigcrash`; the closeturn and crash chain to `brtc_honk` (the air horn again).
- **Motorbike** (`bike`) and the battery rickshaw Dhaka calls a **"Tesla"** (`tesla`) change lanes (see [Lane changers](#lane-changers)). `spawn_bike` revs and pips (`rev`), `spawn_tesla` gives its tinny electric whine and horn (`ewhine`); both have their own `close_` / `closeturn_` / `crash_` memes. Overtaking a Tesla plays `pass_tesla`; crashing into a Tesla or a rickshaw chains to `rickshaw_dhur`.
- **VIP car** (`vip`, see [The VIP](#the-vip)): `vip_spotted` when its warning starts (a voice clip plus the helper's "পেছনে সাইরেন! সাইড দেন!" callout) chains straight to `vip_siren` (the synth `siren`, a separate event so the clip and the siren both play); `close_vip` / `closeturn_vip`, `crash_vip` (`bigcrash`) and `vip_gaveway` (+৳5). Keep its memes about VIP protocol in traffic in general: no parties, flags, names or real people.

| Event | When |
|---|---|
| `start`, `stretch_<id>` | Run start, entering a route stretch |
| `finish`, `newbest` | Reached the bus stand / with a new record. Both keep their `sting` and chain to `finish_voice` 250 ms later |
| `finish_voice` | The finish voice line (a separate event because a clip on `finish` itself would replace the sting) |
| `speedup` | "খেলা হবে!": back above 90% of the target speed after a real slowdown (under 40% of cruising after a crash, braking or a red light, or a crawl through the flood), and 1.5 s into Manik Mia Avenue's speed bonus. Never off the start line or after the finish; 25 s `cooldown`. Thresholds: `SLOWED`, `CRUISING`, `SPEEDUP_DELAY` in `GameScene.js` |
| `pickup`, `puddle` | Passenger picked up, drove through water |
| `crash_<vehicle>` | Collision. `crash_car` chains to `bump_honk`, `crash_brtc` to `brtc_honk`, `crash_vip` to `bump_honk`, `crash_tesla` and `crash_rickshaw` to `rickshaw_dhur` |
| `rickshaw_dhur` | The rickshaw-wala swearing after a Tesla or rickshaw crash (separate because an event whose clip plays skips its own `sfx`, and the crash keeps its crunch) |
| `close_<vehicle>` | Passed within `CLOSE_MARGIN` px without touching: +৳2 bonus. Just driving in the lane next to a wide bus or BRTC doesn't count |
| `closeturn_<vehicle>` | Swerved out of a lane just before impact (or just before the VIP rear-ends you): +৳2 bonus |
| `helper_left`, `helper_right`, `helper_ahead`, `helper_behind` | Helper's warning on every close call ("বামে / ডানে / সামনে / পেছনে প্লাস্টিক!"; behind is the VIP) |
| `helper_pothole`, `helper_manhole` | Helper's warning when a pothole or open manhole is coming up in your lane |
| `spawn_<vehicle>` | Vehicle appears (ambient horn, bell, moo, rev...) |
| `pass_<vehicle>` | Overtook a vehicle whose kind has `pass: true` in `KINDS` (the Tesla): fully ahead to fully behind without a crash, in any lane. 10 s cooldown, no bonus |
| `pothole`, `speedbreaker`, `speedbreaker_fast` | Hit a pothole, went over a speed breaker (`_fast`: took it fast and flew) |
| `zone_flood` | Drove into the waterlogged stretch |
| `signal_yellow`, `signal_red` | The Asad Gate signal turning as you approach; on red the helper shouts "লাল বাতি! থামেন মামা!", and the first red light of a run also shows the brake control on screen |
| `stopped_at_red`, `signal_green` | Waited at the line and the light turned green / the light turned green by itself |
| `red_light` | Crossed the stop line on red: fined |
| `vip_spotted`, `vip_siren`, `vip_gaveway` | A VIP's warning starts (clip, then siren); you were in its lane and gave way in time |

**Engine sound** is a recording of a real leguna, `public/audio/engine/leguna-engine.mp3` (3.5 s seamless loop, mono 64 kbps, 30 KB), looped in `src/audio/sfx.js`. Its pitch and volume follow the speed: idling at 0.8× pitch when stopped, 1× at cruising and 1.25× at Manik Mia Avenue's top speed, a little quieter on the brake, and always under the dhol and voice clips. Until it has decoded (or if it fails to load) a synthesised rumble stands in. To use a new recording, run `tools/enhance_engine.py` on it (usage at the top of the script): it cleans it up (high-pass, low-mid body, hiss cut, light compression, normalising), picks the steadiest stretch and makes the loop. If you change `--length`, update `ENGINE_LOOP_LENGTH` in `sfx.js`.

**Street sounds** are synthesised continuously in `src/audio/sfx.js`: each stretch in `src/config.js` has an `ambience` bed. `hum`, `wind` and `rain` are steady layers (0–1 loudness); `horns`, `bells`, `chatter`, `birds` and `drips` are one-off sounds (average number per second):

```js
ambience: { hum: 0.4, rain: 0.8, drips: 0.8, bells: 0.2 }, // Asad Avenue
```

**Voice clips** in `public/audio/clips/`:

| File | Event | Line |
|---|---|---|
| `are-era-kara.mp3` | `vip_spotted` | "আরে এরা কারা?" |
| `assalamualaikum-boro-bhai.mp3` | `pass_tesla` | "আসসালামু আলাইকুম বড় ভাই" |
| `dhur-beta.mp3` | `rickshaw_dhur` | "ধুর বেটা, এইটা হইল বেটা?" |
| `khela-hobe.mp3` | `speedup` | "খেলা হবে!" |
| `aj-chole-jacchi.mp3` | `finish_voice` | "আজ চলে যাচ্ছি, কিন্তু যাচ্ছি না" |

Every recorded clip played from an `audio` field is treated as a voice, automatically, with no per-clip code (`playClip` in `src/audio/sfx.js`):

- **One voice at a time**: a new clip fades out (60 ms) whatever clip is still talking, so two lines never overlap. The newest wins.
- **Ducking**: while a voice plays, the dhol music and street ambience drop to 35% and the engine to 70% (over ~120 ms), and come back over ~300 ms once the last voice ends. Tune `DUCK` in `sfx.js`.
- **Repeats**: give clip events a `cooldown` so the same line can't come back too soon (`speedup` 25 s, `pass_tesla` 10 s, `finish_voice` 5 s, `vip_spotted` 4 s, `rickshaw_dhur` 3 s). Meme lines rotate through a shuffle-bag, and non-forced popups have their own shared cooldown.
- Mute silences clips like everything else (and skips new ones); a hidden tab suspends all audio.

After adding or replacing any file in `public/` (clips, the engine loop), bump `CACHE` in `public/sw.js`: the service worker serves those cache-first, so installed copies would otherwise keep the old ones.

**Recording clips:** mono MP3 at 48–64 kbps, 1–3 seconds, ideally under 40 KB. Put them in `public/audio/` (voice lines and callouts in `public/audio/voice/`, sound effects in `public/audio/sfx/`) and list them in the event's `audio`. Re-record lines yourself rather than ripping original clips.

**Recording voices:** [`docs/recording-script.md`](docs/recording-script.md) is the script for friends recording real lines and sounds: every meme line, helper callout and placeholder sound effect, with a suggested file name (in `public/audio/voice/` or `public/audio/sfx/`), a delivery note and what's already recorded. It's generated from `memes.json`, so after changing memes.json regenerate it with `python3 tools/recording_script.py` (Python 3, no packages needed). New events need a "when it plays" line and a delivery note in its `EVENTS` table, new placeholder sounds a line in `SFX`, and new event clips their transcript in `CLIPS`.

## Dev keys

In `npm run dev` only (all held keys act once per press):

| Key | What |
|---|---|
| `1`–`9` | Spawn a rickshaw, CNG, bus, car, police, cow, hawker, puddle or passenger in your lane |
| `0` | Spawn a BRTC double-decker in your lane |
| `B`, `T` | Spawn a motorbike / a "Tesla" in your lane |
| `V` | Send a VIP up your lane, skipping the fairness checks (ignored while one is already on its way) |
| `Shift` + any of the above | The same in the next lane over |
| `C` | Show the road's centre line, for tuning bends |

In the console, `window.__game.scene.getScene('Game')` is the running race.

## Road bends

Each stretch in `src/config.js` has a `bends` list of `[share of the stretch, road position at its end]`. Positions are in `BEND_SHIFT` (200 px) units: `-1` is left, `1` is right. The road eases between them with a smooth S, so repeating the same position makes a straight. Shares in a stretch must add up to 1.

Gameplay lives in straight-road coordinates (`rx`, `ry` on every object) and `place()` in `GameScene.js` bends them onto the screen, so lanes, collisions and close calls work the same on curves. In dev, press `C` to show the road's centre line; the console warns if a bend is too sharp to keep lanes on screen.

New world objects go through `makeThing()` (traffic and hazards with a `kind`) or `makeProp()` (scenery), which set their road coordinates and add them to the update list.

## Road feel

- **Camera lean**: the main camera turns up to 2° with the road's heading under the leguna (`LEAN`, `MAX_LEAN` in `GameScene.js`). The HUD, meme popups, callouts, the VIP warning, the brake hint and floating `+৳` texts are drawn by a second, level camera. Anything added to the scene is world by default; pass new HUD or popup objects through `this.toHud()`.
- **Speed streaks**: faint lines whip past along the pavements and kerbs from just under cruising speed, strongest with Manik Mia Avenue's speed bonus (drawn by `src/road.js`).
- **Vibration**: crashes, potholes, fast speed breakers and the red-light fine buzz the phone (`vibrate` in `memes.json`).

## Set pieces

Each stretch can list `features` in `src/config.js`, placed by share of the stretch (`at`, plus `to` for zones):

| Type | What it is |
|---|---|
| `footbridge`, `bunting` | Overhead foot over-bridge / festoon line (overhead things scroll slightly faster, so they read as higher up) |
| `zebra` | Zebra crossing with pedestrians walking across |
| `speedbreaker` | Full-width bump; take it fast and the leguna takes off |
| `junction` | Cross road with a signal: it turns red as you approach, waiting at the stop line turns it green, crossing on red costs a fine. Random spawns pause on the approach, and traffic you've overtaken slows down behind you instead of running into you while you wait |
| `avenue` (zone) | Planted median and lawns on the left |
| `flood` (zone) | Waterlogged road: 70% speed and splashes |
| `busstand` (zone) | Parked buses and a bus lot on the right |

Potholes and open manholes come from the random spawn mix (`spawn` weights per stretch); the helper warns you when one is coming up in your lane.

**Fair spawns:** `spawn()` never fills the last free lane near the top of the screen, and it also predicts when each solid will pass the leguna at the stretch's cruising speed (`closesRoad()`), so slow, long vehicles (the 384 px BRTC) can't drift into a three-lane wall further down. Lane changers use the same prediction before every move, and a VIP's lane stays free of new traffic. Traffic behind the leguna never drives into it (`yieldBehind()`): it slows to the leguna's speed when it gets close.

## Landmarks

The real places along the route live in `src/landmarks.js`. `track.js` places them as `features` (`{ type, d, d1?, side?, text? }`); the landmark module decides what they look like. All the art is drawn in code into textures the first time a landmark is needed (one-off, at the start of a run), and everything sits in road coordinates, so bends and the turning camera move it like any other prop.

| Type | Kind | What you see |
|---|---|---|
| `parliament` | zone, `side` default `right` | The Jatiya Sangsad Bhaban complex: lawns with mowing stripes, a dark boundary railing along the pavement, a row of trees on the avenue edge, kites over the lawn, the lake on three sides of the building, the red-brick South Plaza causeway to the entrance, and the grey concrete building with white marble bands: the central octagonal assembly hall (parasol roof, marble rings) ringed by blocks with big circular and triangular openings, and the prayer hall's round corner towers. The blocks facing the avenue have their façades folded flat into view so their round and triangular openings read from above. The building sits in the middle of the zone. |
| `residential` | zone, `side` default `left` | 6–10 storey apartment blocks, six variants: parapets, stair rooms, black water tanks, pot plants and planters, clotheslines, satellite dishes, solar panels, AC units, a folded façade strip with one band per storey and balconies, a front yard with a parked car, and the boundary wall with a steel gate at the pavement edge. Narrow alleys between blocks. A tree, tea stall or parked rickshaw on the pavement now and then |
| `townhall` | zone, `side` default `both` | Mohammadpur Town Hall Market: long corrugated tin roofs (rust, galvanised, blue) and a concrete market block beyond the pavements, open-air vegetable and fish stalls under tarps, and a busy pavement of shoppers, tarp stalls, vegetable sellers and parked rickshaws over muddy ground with vegetable litter |
| `asadgate_monument` | point, at the junction's `d`, `side` default `right` | The Asad Gate memorial: a white gateway of pillars under a lintel with its name plaque (আসাদ গেট), on a stepped plinth in a small garden, on the corner before the junction (centre 380 px of route before `d`, rx 765 or its mirror), clear of the cross road |
| `signboard` | point, `side`, `text: { bn, en }` | A big green name board on two posts on the pavement, reaching over the kerb lane like Dhaka's gantry boards: the Bangla name large, the English one below, with a shadow on the road. Drawn overhead (depth 41) |

How it plugs in (four functions; GameScene and `RoadRenderer` call them):

- `spawnLandmark(scene, f, ry)`: called with each feature as it comes into view; spawns point landmarks (`asadgate_monument`, `signboard`) and returns `true` for every landmark type, `false` for anything else.
- `landmarkTick(scene, dy)`: every frame. Each zone keeps a cursor per filler (blocks, pavement extras, trees, kites, the building's strips) and spawns whatever comes into view at the top (`SPAWN_ROW`, above the zoomed-out view).
- `drawLandmarks(road)`: called by `RoadRenderer.draw()` after the pavements and before the kerbs; draws zone ground (lawn, lake, plaza, railing, yards and boundary wall, market floor, litter).
- `sideTaken(d)`: `{ left, right }`, so the usual rooftops and pavement decor stay out of a landmark's roadside.

Tuning: sizes, colours and positions are constants at the top of each section in `src/landmarks.js` (`PARL_X` and `LAKE_X` put the façades and lake edge in the zoomed-out view's right band, rx 720–880; `RES` lists the apartment variants with height and storeys; the fillers in `FILL` set spacing and mix per zone). Depths: ground in the road graphics, rooftops and the building 3, pavement things and the monument 4, the sign's shadow 6, kites and sign boards 41. Big art is cut into strips (`PARL_SLICE`) so it follows bends and never pops at the screen edge.

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

While moving, the vehicle's `lane` follows its centre (for collisions, close calls and `checkNearMiss`), and it counts as blocking both lanes for spawns and the fairness check (`inLane()`). If it catches up with something slower in its lane it tucks in behind at that speed and looks for a gap sooner, and speeds up again once the way is clear (`keepGap()`). People crossing at a zebra don't count (they're out of the lane in a moment), and no lane change starts while they're crossing nearby or into a VIP's lane.

## The VIP

A black SUV with a small gold pennant and a flashing red/blue light bar that comes from *behind* (`vip` in `KINDS`, `VIP` in `src/config.js`). A flashing `▲ 🚨 ▲` badge appears at the bottom of the screen in the lane it will use, together with its clip and siren; `VIP.lead` (1.2 s) later it appears below the screen and drives up `VIP.boost` (250 px/s) faster than cruising, reaching the leguna's row about 2.2 s after the warning. Stay in that lane and it rear-ends you; move out in time for `vip_gaveway` (+৳5).

- **When:** every `VIP.roll` px of route a stretch's `vip` value is the chance of one (0.3 on Manik Mia Avenue, 0.03 on Farmgate, Asad Gate and Mohammadpur, none on flooded Asad Avenue); never near the signal or the finish, nor while the leguna is crawling, with a breather after each.
- **Which lane:** one where it can drive up to 500 px past the leguna without braking for anything (`vipBlocked()` predicts each car in the lane at their own speeds; the VIP is faster than everything, so a slow car in its lane would make it queue), the other two lanes are never both blocked while it passes, and if it's coming up the leguna's lane, a lane next to it stays clear until it has passed. Half the time it comes for the leguna's lane when that's fair.
- **Waiting for a lane:** when one is due but no lane is clear yet, it picks its lane and keeps it free of new traffic and lane changers for up to 8 s (`VIP_WAIT`); the warning starts once the lane has cleared, otherwise it's quietly dropped.
- **On its way:** `spawn()` refuses any new solid that would reach the leguna's row while it passes. For slower traffic ahead it changes lane when that's fair (on screen, never into the leguna's lane before it's well past); if it can't while still behind the leguna, it gives up, drops back off the bottom and is gone without a bonus. Past the leguna it queues and keeps looking for a gap. It brakes for a leguna that has nearly stopped in its lane instead of rear-ending it.

## Where things live

| Path | What |
|---|---|
| `src/config.js` | Design resolution, speeds, route stretches with their bends, obstacle types |
| `src/track.js` | Turns each stretch's `bends` into the road's sideways offset along the route |
| `src/road.js` | Draws the bending road every frame (asphalt, kerbs, lane dashes, pavements, speed streaks) |
| `src/landmarks.js` | The Parliament, residential blocks, Asad Gate memorial, Town Hall Market and name boards: their art, zone ground and spawning |
| `src/scenes/GameScene.js` | The race: spawning and fairness, lane changers, the VIP, steering, collisions, the signal, meme popups, HUD |
| `src/art/textures.js` | Placeholder rickshaw-art sprites drawn in code; replace with real images later |
| `src/audio/sfx.js` | Synthesised sound effects, recorded clips (one voice at a time, ducking), the dhol loop, the engine (recorded loop, synth fallback), street ambience and vibration |
| `public/memes.json` | Sounds, callouts and meme popups for every event |
| `public/audio/clips/` | Recorded voice clips for events (listed in `memes.json`) |
| `public/audio/engine/leguna-engine.mp3` | The leguna's engine loop, made by `tools/enhance_engine.py` from a phone recording |
| `tools/` | Asset scripts: `cutout.py` (vehicle art cut-outs), `enhance_engine.py` (engine recording to game loop), `recording_script.py` (memes.json to the recording script) |
| `docs/recording-script.md` | What to record for voices and sound effects, generated by `tools/recording_script.py` |
| `public/audio/voice/`, `public/audio/sfx/` | Where recorded voice lines / callouts and sound effects go |
| `public/sw.js` | Offline cache (bump `CACHE` when files in `public/` change) |
| `src/i18n.js` | Bangla / English strings |
| `src/share.js` | Score-card image for Facebook / Messenger sharing |
