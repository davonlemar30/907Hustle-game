# design-sync notes — 907Hustle

Repo-specific gotchas for future syncs. Read this before re-running.

## What this repo actually is

907Hustle is a **game**, not a component library. There is no published package
and no `dist/` of exported components — `ui.jsx` holds ~90 screen components,
most of them wired to `window.GameCore` state, and `npm run build` produces an
IIFE **app** bundle (`ui.built.js`) that mounts itself to `#root`.

The design system is a deliberate, narrow extraction on top of that:

- `src/ds/primitives.jsx` — the 9 presentational primitives, props-only, no
  GameCore. **This is the single source**: `ui.jsx` imports them, so the game
  and the design system can never drift.
- `src/ds/index.jsx` — the DS barrel (what gets bundled).
- `npm run build:ds` → `ds-dist/index.js` (ESM), which is what the converter
  takes as `--entry`. `ds-dist/` is gitignored; re-run `build:ds` before syncing.
- `src/ds/index.d.ts` — **hand-written**, and the only source of prop
  contracts. The repo is plain JavaScript, so nothing generates this. It lives
  in `src/` (committed) rather than `ds-dist/` (gitignored) for exactly that
  reason; `build:ds` copies it to `ds-dist/index.d.ts`, which is where the
  converter reads it from. When a primitive's props change in `primitives.jsx`,
  change this file too or the design agent codes against a stale API.

**React is a global, never an import.** `ui.jsx` and `primitives.jsx` both rely
on esbuild's default JSX factory emitting `React.createElement` against the UMD
global from `index.html`. Adding `import React from "react"` to
`primitives.jsx` would break the game build (react is not a dependency).

## Adding a component to the DS

1. Move it from `ui.jsx` into `src/ds/primitives.jsx` with `export`, and add it
   to the import list at the top of `ui.jsx`. Keep the body byte-identical.
2. Add its props to `src/ds/index.d.ts` — real unions, not `string`. Check the
   class vocabulary in `v05.css` for what the tones actually are.
3. Add `docs/ds/<Name>.md` with `category:` frontmatter (that sets its group).
4. Add it to `componentSrcMap` in `config.json`.
5. Author `.design-sync/previews/<Name>.tsx`.

Only move components that take no `state`/`dispatch`. 59 of the 90 in `ui.jsx`
are game screens and do not belong here.

## Tests read the UI source as text

Ten test files `readFileSync` `ui.jsx` and assert on its markup. Moving a
component out of `ui.jsx` breaks any test that greps for its definition.
`tests/ui-contract.test.js` now reads **both** `ui.jsx` and
`src/ds/primitives.jsx` and concatenates them (ui.jsx first — some checks
`slice()` into it by function name). If you move more components and a contract
test fails, that concatenation is the fix, not weakening the assertion.

Baseline: `npm test` = 493 passing, before and after the extraction.

## Fonts

`index.html` loads Anton / Barlow Condensed / Share Tech Mono from Google Fonts
via `<link>`, so `v05.css` has no `@font-face` and the DS shipped unstyled type
until this was fixed. The five latin-subset woff2 files are now **self-hosted**
in `assets/fonts/` (62KB total, all SIL OFL) with `assets/fonts/fonts.css`
wired via `cfg.extraFonts`. The game itself still uses the Google `<link>` —
the local copies exist so designs never depend on a network fetch.

To regenerate: fetch
`https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@400;600;700&family=Share+Tech+Mono&display=swap`
with a desktop-browser User-Agent (woff2 is only served to modern UAs), keep the
`/* latin */` blocks, download those five urls, and rewrite them to relative
paths.

## Known render warns (triaged — these are expected, not new)

- `[FONT_MISSING] "Impact"` — `--head` is `"Anton",Impact,sans-serif`. Impact is
  a system fallback behind Anton, not a brand face. Nothing to ship.
- `[TOKENS_MISSING] --text, --good, --warn, --bad` — see the real bug below.
  Not caused by the sync.
- `[GRID_OVERFLOW] escape` on **Modal** — a **false positive**, verified by
  measurement. The detector sees `position:fixed` in the subtree and assumes it
  escapes the cell. `Modal.tsx` wraps each story in a `stage()` div carrying its
  own `transform`, which makes that div the containing block, so the backdrop is
  measurably inside its cell (checked with playwright: all three cells
  `contained: true`). Do **not** "fix" this by switching to
  `cardMode: "single"` — that would drop two of the three stories from the pane
  for no gain.

## A real bug in the game, found during this sync (not sync-related)

`v05.css:183-186` — `.consequence-card` uses `var(--text)`, and its `.good`,
`.warn`, `.bad` modifiers use `var(--good)`, `var(--warn)`, `var(--bad)`. **None
of those four custom properties are defined anywhere.** `:root` defines
`--white`, `--green`, `--amber`, `--red` instead. The result is that the
good/warn/bad accent stripes on consequence cards silently do not render in the
shipped game. Likely fix: point them at the tokens that exist. Left alone here
because it is outside the design-sync scope and `ConsequencePopup` is not one of
the 9 synced components.

## Preview conventions that took a while to work out

- **Every story restates the app ground.** Preview cards hardcode
  `body{background:#fff}` in their own `<style>`, after the stylesheet links, so
  `v05.css`'s `body` rule loses. Dark components on a white card misrepresent
  them, so each story wraps in a `shell` object reproducing the real `body`
  background (scanline wash + red bloom + `#070707`). If you add a preview,
  copy that block.
- **Overlays need a stage.** See the Modal note above — the cell's own
  `transform` breaks `position:fixed`, and the fix is a transformed wrapper with
  an explicit height.
- **No flash stories.** `flash` on Hud/Chip is a 400ms animation; a still frame
  captures nothing and the cell grades as an identical variant. Documented in
  the component docs instead.

## Re-sync risks — what can go stale

- **`src/ds/index.d.ts` is hand-maintained.** Nothing checks it against
  `primitives.jsx`. A prop added to a primitive and not mirrored here ships a
  wrong contract to the design agent, silently. Diff the two when re-syncing.
- **Docs enumerate real class names.** `docs/ds/*.md` name `.stat-row`,
  `.scroll`, `.outcome-grid`, `.hud`, `.primary-hud`, `.chip-row`, `.top`. All
  verified against `v05.css` at sync time. A CSS refactor that renames any of
  them makes the docs teach vocabulary that no longer resolves — re-verify with
  a grep before uploading. (Three invented names — `.tile-grid`, `.menu-list`,
  `.card-list` — were caught and removed this run; that failure mode is real.)
- **The preview `shell` colour is a literal.** `#070707` is `--black` copied by
  hand, because the shell is an inline style outside the stylesheet. If the
  palette changes, the previews keep the old ground.
- **Playwright/chromium was installed into `.ds-sync/node_modules`** this run
  (chromium-headless-shell 151.0.7922.34). `.ds-sync/` is gitignored, so a fresh
  clone reinstalls it.
- **`assets/fonts/` is committed**, so the fonts survive a clone — but they are
  pinned copies. Google may ship new versions; nothing here notices.
