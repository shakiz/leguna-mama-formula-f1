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

Controls: tap or swipe left/right on mobile, `←` `→` or `A` `D` on desktop. `Enter` starts a run.

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick the repo.
3. Build command: `npm run build` · Build output directory: `dist`.

Every push to `main` then deploys automatically, and other branches get preview URLs. `public/_headers` sets long caching for hashed assets and no caching for `memes.json` and the service worker.

## Editing memes

`public/memes.json` holds every meme caption, grouped by trigger (`start`, `crash`, `cow`, `nearmiss`, `pickup`, `puddle`, `stretch_<id>`, `finish`, `newbest`). Variants rotate without repeats. Edit and push; no code changes needed.

To use a recorded clip instead of the synth placeholder, put the file in `public/audio/memes/` and add `"audio": "audio/memes/your-clip.mp3"` to the meme. Re-record lines yourself rather than ripping original clips.

## Where things live

| Path | What |
|---|---|
| `src/config.js` | Design resolution, speeds, route stretches, obstacle types |
| `src/scenes/GameScene.js` | The race: spawning, steering, collisions, meme popups, HUD |
| `src/art/textures.js` | Placeholder rickshaw-art sprites drawn in code; replace with real images later |
| `src/audio/sfx.js` | Synthesised sound effects and the dhol loop |
| `src/i18n.js` | Bangla / English strings |
| `src/share.js` | Score-card image for Facebook / Messenger sharing |
