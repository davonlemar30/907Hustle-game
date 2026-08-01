# 907Hustle: One Good Run — Project Status

Last updated: 2026-08-01 (America/Anchorage)

## Current baseline

- Rebuild originally grounded against `main` commit `df8fad8835931095b74216afa80d97653c415a20`.
- Active work is on `agent/one-good-run-playtest-revision`; no commit or push is included in this implementation task.
- Pre-existing `.DS_Store` modifications remain untouched and excluded from project work.
- Active runtime: `index.html`, `game-core.js`, and `ui.jsx`. Legacy `script.js`, `events.js`, `combat.js`, `style.css`, and `907hustle/project/` remain unimported reference material.
- Domain/save schema is version 2 with key `907ogr_v2`. Existing `907ogr_v1` and `907g4` saves remain untouched.

## Alpha v0.4 implementation

All eight approved world-depth decisions are implemented:

1. North Star Garage is the single player base.
2. Security, storage, operations, and recovery each have two ordered upgrades (eight total).
3. Eli, Miri, and Tone form the recruitable crew pool; the active roster is capped at two.
4. Mara Velez is a boundary-aware relationship with trust, consent, callbacks, and ending influence.
5. Neighborhood influence replaces generic reputation.
6. Confrontations use an early teaching encounter, a mid-run consequence, and a seventh-night resolution.
7. The v2 save is isolated instead of migrating the reduced v1 roster unsafely.
8. Scope remains at three neighborhoods, four products, one base, eight upgrades, eight gear items, three stats, compact persistent chains, three major encounters, and focused endings.

## Current player experience

- Seven days, four slots per day; Day 7 Night is terminal and Day 8 is never playable.
- Buy/sell transactions do not advance time. Travel, End Market, Lay Low, garage visits, healing, debt payments, upgrades, gear purchases, recruiting, assignments, Mara visits, influence investments, and final-plan preparation advance exactly one slot.
- Three persistent markets and four products. Weed and Shrooms begin open; Cocaine and Meth require persistent access.
- Background selection: Runner, Enforcer, or Shooter, with Aim/Grit/Instinct affecting fight, firearm, talk, and escape outcomes.
- North Star Garage supports protected cash/product storage, upgrades, gear, crew, recovery, defense, and final planning.
- Eight gear items include close/firearm options, armor, escape utility, medical supply, cargo, and communications.
- Dre begins with a $620 note due Day 4 and offers a second note, supplier access, or independence after payoff.
- Rook tracks pressure/respect; Mara tracks trust/status; crew track introduction, recruitment, loyalty, wages, assignment, and outcomes.
- Grounded event chains retain consequences and exclude the last four generic events from immediate reselection.
- Visible confrontation choices are generated from current stats, health, cargo, gear, crew, Mara, influence, cash, and garage security.
- Five final plans and relationship/operation overrides produce expanded endings and summaries.

## Architecture

`GameCore.createRun/reduceGame → single advanceRun pipeline → React useReducer → localStorage autosave → mobile UI`

`game-core.js` is a UMD module exposed as `window.GameCore` and `module.exports`. It owns seeded randomness, state creation, validation, market evolution, clock/world pressure, events, encounters, endings, and selectors. `ui.jsx` owns the React presentation loaded by `index.html` through the existing Babel CDN path.

## Verification

### Automated regression suite

Command: `node --test`

- 30 passed, 0 failed.
- Covers v2 isolation, backgrounds, visit trading, product access, exact pipeline timing, invalid-action timing, all-market evolution, rollover summaries, Day 7 termination, debt-aware net worth, price bounds, market identity, storage, upgrades, gear, crew cap/assignments, Mara, influence, event timing/cooldown, early encounter cadence, seeded encounter results, post-payoff choices, final plans, HUD/navigation contracts, touch targets, and modal priority.

### Deterministic simulation

Command: `node tests/simulate-runs.js 500`

- 500 cautious, 500 balanced, and 500 aggressive runs all terminated without hangs.
- Cautious averages: net worth -$433, operation score -9, debt $782, peak Heat 6, 26 decisions, 3 encounters, base value $120, crew 1.
- Balanced averages: net worth -$462, operation score -1, debt $782, peak Heat 10, 26 decisions, 2 encounters, base value $140.
- Aggressive averages: net worth -$487, operation score -138, debt $702, peak Heat 14, 18 decisions, 2 encounters, base value $168.
- The batch proves system reachability and termination, not final balance. It shows that garage/gear/crew spending competes sharply with the current note and aggressive routing remains highly punitive.

### Browser smoke and mobile checks

- Passed new run, background selection, garage visit, persistent event choice, Day 1 rollover, Day 2 confrontation, confrontation resolution without a second tick, and v2 autosave reload.
- No application console errors; only the expected Babel development warning.
- Fixed a discovered modal-stack issue so a day summary renders before a confrontation scheduled on the same rollover.
- 320×568, 375×667, 390×844, and 430×932: zero horizontal overflow and zero visible buttons under 44px high.

## Documentation record

ClickUp document `2kyd583p-4054` now uses `Alpha build v0.4` (`2kyd583p-13934`) as the parent page. Child pages record approval/build plan, phases 1–4, phase 5, and phases 6–7. The hierarchy was verified after creation.

## Known limitations

- React, ReactDOM, Babel, and fonts remain CDN-loaded; the game is not offline-ready and runtime Babel is still a development setup.
- `ui.jsx` is runtime-transpiled and has no production bundle/minification step.
- Deterministic strategy agents are simple heuristics, not human-equivalent players; they underuse some relationship and crew opportunities.
- Initial balance is intentionally not declared final. The $620 Day 4 note plus optional operation spending produces mostly negative simulated net worth.
- Cautious escape paths can receive a Mara relationship override while still owing Dre; human testing should decide whether that narrative override is desirable.
- The event chain is compact enough for one week but needs human repetition feedback before more authored content is added.
- No telemetry export, accessibility screen-reader pass, or offline asset packaging has been completed.

## Next recommended single task

Run focused human Alpha v0.4 playtests across Runner, Enforcer, and Shooter, then tune debt/earnings and operation prices together without changing the unified pipeline.
