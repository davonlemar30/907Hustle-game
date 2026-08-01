# 907Hustle: One Good Run

A mobile-first, seven-day Anchorage street-market strategy game.

## Run the game

Serve this directory with any static HTTP server, then open `index.html`:

```sh
python3 -m http.server 4173
```

The active runtime is `index.html` plus the pure domain module in `game-core.js`. React and Babel are currently loaded from CDNs, so the browser needs network access on first load.

## Test the core

```sh
node --test tests/game-core.test.js tests/ui-contract.test.js
node tests/simulate-runs.js 200
```

See `PROJECT_STATUS.md` for the technical re-entry status and `PLAYTEST_REVISION_AUDIT.md` for the approved progression, store, stats, and encounter plan.
