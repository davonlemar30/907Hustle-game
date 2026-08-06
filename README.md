# 907Hustle: One Good Run

907Hustle: One Good Run is a mobile-first, single-player crime, trading, resource-management, and light RPG web game set in an Anchorage-inspired version of Spenard.

The current playable build is **Alpha v0.9: Fresh Start, Daily Life, and Player Freedom**. The player arrives at Yalonda and John's home without local assets, chooses freely among legal work, exploration, training, gambling, shoplifting, transit, relationships, trade, and optional property, then earns a flexible Street Identity through behavior.

The long-term design goal is a classless street-life RPG where progress comes through access, reputation, transportation, relationships, skills, jobs, suppliers, territory, and obligations. The current build remains a focused seven-day vertical slice.

## Current Alpha: v0.9

Alpha v0.9 is documented in `ALPHA_V0.9.md`, with verification in `EIGHTH_PLAYTEST_AUDIT.md` and changed narrative copy in `COPY_REVIEW.md`.

Alpha v0.8 starts every new player with six equal attributes, no selected edge, and an earned Street Identity that never blocks an activity.

### Core gameplay

- Seven-day run with Morning, Afternoon, Evening, and Night
- Three active districts: Spenard, Downtown, and Industrial Service Roads
- Four product market with seeded price movement and weighted-average cost basis
- Buy and sell previews with revenue, cost basis, projected profit or loss, cash after, and cargo after
- Dre's debt, payment history, reserve-aware payment controls, and consequences for missed terms
- Heat, Health, Recovery, Lay Low, gear, protected storage, safehouse upgrades, crew, and territory
- Autosave, title screen, New Game, Load Game, save preview, and mobile-first navigation

### Story engine

- 43 active story beats across five connected chains
- Data-driven `STORY_REGISTRY` with seeded, deterministic selection
- Reactive, character-chain, and ambient event tiers
- Location preference so district-specific stories appear when the player stays in that area
- Anti-monopoly rules that keep one storyline from consuming the entire week
- Nine repeatable one-off street events

### Character stories

- **Mara Velez:** six-stage relationship arc with friendship, romance, distance, boundaries, danger, and three Day 7 outcomes
- **Eli "Shortcut" Ward:** five-stage contact and crew arc built around routes, judgment, loyalty, and whether the operation has a place for him
- **Dre Holloway:** debt storyline that reacts to first payment, payment reliability, due-day behavior, payoff choices, and the final reckoning
- **Rook Mercer:** six-stage escalation from surveillance and pressure to interference, confrontation, terms, or open rivalry
- **Kip Sallis:** persistent Spenard dealer who supports both fair business and the first deliberate stickup playstyle

### Kip Sallis dealer prototype

Once Kip is introduced, he appears under **People → Street Contacts**.

- **Buy off Kip:** purchase weed or shrooms below the current Spenard price and build standing
- **Ask what's moving:** receive a reliable product lead after building enough standing
- **Rob Kip:** attempt a dealer robbery regardless of working capital

Robbing Kip can produce cash and product, while also causing injury, Heat, retaliation, damaged standing, lower Spenard supply, Rook pressure, and relationship fallout with Mara. Two successful robberies remove Kip from the block for the rest of the run.

Quick Score remains a separate emergency comeback action and is unchanged.

## Verification

Current automated verification:

```sh
node --test tests/*.test.js
node tests/simulate-runs.js 200
```

Latest recorded results:

- 97 tests passed
- 0 tests failed
- 2,000 of 2,000 simulated runs terminated
- 0 dead ends
- Ten simulation profiles, including legal worker, trader, thief, gambler, trainer, and mixed freedom
- 23 distinct opening story sequences across 30 seeds

Responsive browser QA passed the ten required viewports for overflow, 44px controls, fresh creation, four-tab navigation, and console errors. Three full human-style seven-day runs and a rendered save/title/load traversal remain open.

## Run the game locally

Serve the repository with any static HTTP server, then open `index.html`:

```sh
python3 -m http.server 4173
```

Then visit:

```text
http://localhost:4173
```

The active runtime is:

- `index.html`
- `v05.css`
- `game-core.js`
- `ui.jsx`

`game-core.js` is a UMD domain module exposed through `window.GameCore` and `module.exports`. `ui.jsx` contains the React presentation layer.

## Save compatibility

- Save version: `3`
- Save key: `907ogr_v3`
- Alpha v0.8 state additions hydrate through additive defaults
- Older v3 saves remain playable
- Legacy Strategist saves remain supported

## Project direction

The classless foundation now includes:

- Equal starting attributes
- Earned Street Identity
- Behavior tracking
- Six core attributes
- Identity-aware dialogue and event eligibility

Legacy edges remain migration data only and appear as save history, not as a current class.

Future phases are planned around Street Read progression, legitimate work, training, gambling, shoplifting, transportation, jail, multiple lenders, expanded territory, regional travel, and optional continuation after the Day 7 score checkpoint.

## Documentation

- [`ALPHA_V0.8.md`](ALPHA_V0.8.md) — current playable build description
- [`ALPHA_V0.7.1.md`](ALPHA_V0.7.1.md) — prior playable build description
- `VISION.md` — long-term design target
- `ROADMAP.md` — build sequence
- `PROJECT_STATUS.md` — active baseline, architecture, verification, and known limitations
- `STORY_BIBLE.md` — writing standards, character voices, event chains, and event copy
- `PROGRESSION_DESIGN.md` — Street Read design proposal, currently unimplemented
- `SIXTH_PLAYTEST_AUDIT.md` — Alpha v0.7 audit, decisions, and manual QA checklist
- `SEVENTH_PLAYTEST_AUDIT.md` — Alpha v0.8 implementation and verification audit

## Legacy files

`index.html` loads only `v05.css`, `game-core.js`, and `ui.jsx`. The following are retained for historical reference and are not part of the running game:

- `events.js`
- `script.js`
- `style.css`
- `combat.js`
- `907hustle/`
- `assets/cousins-apt-placeholder.svg`

The live event set is `STORY_REGISTRY` inside `game-core.js`.
