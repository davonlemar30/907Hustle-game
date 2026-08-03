# 907Hustle: One Good Run

A mobile-first, seven-day Anchorage street-market strategy game.

## Run the game

Serve this directory with any static HTTP server, then open `index.html`:

```sh
python3 -m http.server 4173
```

The active runtime is `index.html`, the pure domain module in `game-core.js`, and the React presentation in `ui.jsx`. React and Babel are currently loaded from CDNs, so the browser needs network access on first load.

## Test the core

```sh
node --test tests/*.test.js
node tests/simulate-runs.js 200
```

## Legacy files (not loaded)

`index.html` loads only `v05.css`, `game-core.js`, and `ui.jsx`. The following
are retained history and are **not** part of the running game — the 42 events in
`events.js` in particular are not live content:

- `events.js`, `script.js`, `style.css`, `combat.js`
- `907hustle/` (early HTML prototypes and uploads)
- `assets/cousins-apt-placeholder.svg`

The live event set is the registry in `game-core.js` (`STORY_REGISTRY`).

## Documentation

- `PROJECT_STATUS.md` — current baseline, architecture, verification, next task
- `STORY_BIBLE.md` — writing standard, voice guide, chains, event copy
- `PROGRESSION_DESIGN.md` — Street Read XP spec (design only, not implemented)
- `SIXTH_PLAYTEST_AUDIT.md` — Alpha v0.7 audit and decisions
