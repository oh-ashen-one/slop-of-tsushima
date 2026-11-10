# Slop of Tsushima (kimi build)

A Ghost of Tsushima style golden-hour open field that runs in the browser. You start on foot in a golden grassland, walk to a horse, mount it and ride. This is the build made by the AI model kimi, working autonomously in the AI Game Arena: the same brief was given to four models and the results were judged blind. Per the repo's original notes, this build placed 1st and was the director's pick. It is a conversion of the open-source RED SANDS engine (three.js and WebGL2, MIT, by gillworks) and, per the repo's original notes, adds a Meshy white stallion, samurai animation clips, an H3 title-menu video and a Suno music track.

A sibling repo, `slop-of-tsushima-codex`, holds the codex build of the same brief. The repo `slop-of-tsushima-kimi-k3` holds the same files as this one, apart from its README.

## Give this to your agent

```text
Clone https://github.com/Ashen-Skool/slop-of-tsushima.git (private repo, I already have access, use my existing git or gh login). The repo is about 1 GB, so a shallow clone (git clone --depth 1) is fine.

Read README.md, package.json, BRIEF.md and INTEGRATION.md. Then run the game locally so I can play it:
1. Check that Node is 20.19 or newer, or 22.12 or newer. If not, stop and tell me.
2. Run `npm install`, then `npm run dev`.
3. Tell me the local URL that Vite prints and the controls listed in the README.

Do not run the capture, scout, motion or metrics scripts unless I ask. Do not edit any files. If you need anything from me, stop and ask.
```

## What is in here

- `index.html`: the page. It holds the boot screen and the full-screen title menu video ("Press any key").
- `src/`: the game source, in folders `core`, `render`, `world`, `player`, `sim`, `audio`, `materials` and `ui`. `src/main.js` is the entry point.
- `public/assets/`: the models, video and music, about 95 MB in total.
  - `ronin_v5.glb`: the character model the code loads (`src/player/rig/RoninRig.js`).
  - `ronin.glb` and `ronin_4k_backup.glb`: other versions of the character model.
  - `horse_v2.glb`: the horse model (`src/player/Horse.js`).
  - `menu.mp4`: the title menu video.
  - `audio/golden_plain_journey.mp3`: the music track.
- `BRIEF.md`: the challenge brief the model was given.
- `INTEGRATION.md`: the staging notes that came with the brief: where to swap the character, the palette rules and the biggest gaps from the stock engine.
- `progress.html`: the progress page the model kept updating while it built. It links to images in `shots/` and `references/`, which are not in this repo, so those pictures will not show.
- `tools/`: capture, playtest and scoring scripts used during the build. `tools/menu_test.mjs` reads the project folder from the `GAME_ROOT` environment variable and uses the current folder if it is not set.
- `docs/PROCESS.md`, `docs/CRITIC.md`, `docs/CONTRACTS.md`: process and evaluation notes inherited from the engine project this build started from. They describe a different art target, and some statements (for example that there are no external asset files) do not match this build.
- `docs/media/`: five screenshots (hero, night, rider, storm, town).
- `server.mjs`, `railway.json`, `vercel.json`: deployment files for serving the built game.
- `LICENSE`: MIT, copyright gillworks.

## What you need

- Node.js 20.19 or newer, or 22.12 or newer (Vite 8 requires this), and npm.
- A browser with WebGL2.
- Nothing else to play. No API keys or accounts.
- Only for the optional tools:
  - Playwright (installed by `npm install`) and a Chromium browser it can launch. The capture scripts pass flags for Metal graphics, so they are written for macOS.
  - `python3` with `numpy` and `Pillow` for `npm run metrics` and `npm run motion`.

## How to run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (the dev server listens on 127.0.0.1; `.claude/launch.json` uses port 5173). Wait for the boot screen to finish, then press any key at the title video.

Controls (from the in-game pause menu):

- `W A S D`: move and ride
- `Shift`: run, and spur the horse on
- Mouse: look (click to capture the pointer)
- `E`: mount and dismount
- `Space`: hop
- `Ctrl`: crouch
- `H`: hide the interface
- `M`: mute
- `Esc`: pause menu

To serve a production build:

```bash
npm run build
npm start
```

`npm start` runs `server.mjs`, which serves the `dist` folder on port 3000 (or the `PORT` environment variable) and listens on all network interfaces. `npm run preview` is Vite's own preview server.

Other scripts in `package.json`:

- `npm run capture:fast`: render the canonical shots headless at lower cost, into `shots/latest`.
- `npm run capture`: the same at 1920 by 1080.
- `npm run smoke`: boot check that reports console errors.
- `npm run motion`: capture short motion sequences and analyze them.
- `npm run metrics`: score the captured shots.
- `npm run scout`: random-camera search for the ugliest frames.

## Good to know

- Graphics quality is chosen automatically from your memory and CPU cores. Force it with the URL parameter `?quality=low`, `medium`, `high` or `ultra`. The pause menu also has a Quality control that reloads the page.
- The title menu is skipped when the URL has `?capture=1`.
- If the ronin model fails to load, `src/player/Player.js` logs a warning and falls back to the procedural cowboy from the original engine.
- The Ghost of Tsushima reference frames named in `BRIEF.md` are copyrighted and are not in this repo (`references/` is in `.gitignore`). The side-by-side comparison workflow from the brief needs frames you supply yourself.
- `package.json` still carries the original name `red-sands` and its original description of a western. The game itself is the golden field build.
- The scripts in `tools/` and the notes in `docs/` come from an automated build run. Read them as process records, not as setup instructions.
