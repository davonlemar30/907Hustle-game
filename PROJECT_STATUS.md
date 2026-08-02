# 907Hustle: One Good Run — Project Status

Last updated: 2026-08-01 (America/Anchorage)

## Current baseline

- Alpha v0.5 is implemented on `agent/alpha-v0-5-third-playtest-pass`, based on merged `main` commit `42f451f`.
- Pre-existing `.DS_Store` modifications remain untouched and must stay outside the project commit.
- Active runtime: `index.html`, `v05.css`, `game-core.js`, and `ui.jsx`.
- The dead text/plain v0.3 inline UI has been removed from `index.html`. Legacy standalone files and prototypes remain unimported references.
- Domain/save schema is version 3 with key `907ogr_v3`. Existing `907ogr_v2`, `907ogr_v1`, and `907g4` saves remain untouched.

## Alpha v0.5 implementation

The approved third-playtest pass is complete:

1. Backgrounds are Shooter, Hustler, and Strategist. All start with $375, 10 cargo, 1 Heat, and the same $620 Dre note; their Combat, Charisma, and Intelligence lines are 3/1/2, 1/3/2, and 2/1/3.
2. The active UI labels are Market, Travel, Operations, People, Finances, and Recovery.
3. Every active event now exposes who is involved, where it occurs, the stakes, action-specific previews, and direct results. Confrontation text uses the new stats and the Strategist has an Intelligence-based intimidation option.
4. Dre remains due Day 4. Finances offers a safe payment that preserves $150 in working cash and requires confirmation before a payment crosses that reserve.
5. Emergency robbery appears only below $150 working capital, can be attempted once, consumes one slot, and deterministically resolves to a comeback payout or injury/Heat/Rook consequences.
6. All three neighborhoods begin under Rook. Territory takeover uses shared gear and active crew Power, optional player participation, visible Intelligence-scaled estimates, and automatic best-of-three seeded rounds with ties favoring the defender.
7. Territory defeat permanently removes a lowest-loyalty participating crew member, adds Heat and Rook pressure, injures a participating player, and can destroy an equipped weapon or vest after a shutout. Retrying remains possible while the territory is uncontrolled.
8. Territory victory sets influence to Controlled, improves local buy/sell prices by 4%, lowers travel risk by one, pays daily income, and unlocks the approved neighborhood special.

## Fourth playtest contained pass — Phase 1

The fourth mobile playthrough audit is recorded in `FOURTH_PLAYTEST_AUDIT.md`. To avoid combining several unreviewed systems, this code pass implements only transaction clarity:

- Desktop and mobile continue to share one trade modal; the audit confirmed both previously lacked projections.
- Existing weighted-average inventory accounting is preserved. Purchases merge cost pools; partial sales retain the same average; storage/retrieval also merge by weighted average.
- A pure `tradeProjection` selector now supplies both the confirmation UI and reducer with the same unit price, total, cost basis, profit/loss, cash-after, cargo-after, and local-history comparison.
- Buy mode shows total cost, cash after, cargo after, and recent local price context when a prior observation exists.
- Sell mode shows revenue, weighted-average cost basis, signed and text-labeled Profit or Loss, and cash after. Color is supplemental rather than the only result signal.
- The confirmation row remains visible with a sticky mobile treatment on short screens.
- Save version/key remain v3 / `907ogr_v3`; this selector/UI addition requires no migration.

The audit also grounds later proposals for imperfect market intelligence, Mara introduction/invitation/Date Night progression, recruitment summaries, character callbacks, and progressive disclosure. Those systems are not included in this commit.

## Approved territory values

| Neighborhood | Rook Power | Attack cost | Daily income | Special |
|---|---:|---:|---:|---|
| North Star Lot | 12 | $100 | $45 | Recruitment costs 10% less |
| Downtown | 18 | $150 | $75 | Cocaine access opens |
| Airport / Industrial | 24 | $200 | $110 | Meth access opens |

## Architecture

`GameCore.createRun/reduceGame → single advanceRun pipeline → React useReducer → localStorage autosave → mobile UI`

`game-core.js` is a UMD module exposed as `window.GameCore` and `module.exports`. Seeded randomness, validation, market evolution, robbery, takeovers, event effects, clock/world pressure, endings, and selectors remain in the domain module. React presentation remains in `ui.jsx`.

Every consuming action still follows the single advance pipeline. Buy and sell remain non-advancing within a locked visit. Event/encounter/result acknowledgement does not add a second tick.

## Verification

### Automated regression suite

Command: `node --test tests/*.test.js`

- 29 passed, 0 failed.
- Adds weighted-average accounting, projected buy/sell settlement parity, signed profit/loss, unavailable/directional local price context, v3 JSON hydration, and shared trade-modal contract coverage to the existing clock, market, event, relationship, territory, summary, shell, and touch-target tests.

### Deterministic simulation

Command: `node tests/simulate-runs.js 200`

- 200 cautious, 200 balanced, and 200 aggressive runs all terminated without hangs.
- Cautious: average net worth -$364, operation score 49, debt $782, peak Heat 6, 26 decisions, 3 encounters, one active crew member.
- Balanced: average net worth -$373, operation score 111, debt $781, peak Heat 10, 26 decisions, 3 encounters, one active crew member.
- Aggressive: average net worth -$419, operation score -7, debt $682, peak Heat 14, 17 decisions, 2 encounters.
- These agents verify termination and system reachability; they do not model strong human route planning or territory preparation. The note remains the dominant economy pressure and warrants direct human tuning.

### Browser and mobile QA

- Chrome hydrated the existing v3 autosave and rendered the new shared modal without migration.
- Buy quantity changed total cost, cash after, and cargo after immediately; recent local context correctly reported a $3 decline from the prior local price.
- Sell mode displayed revenue, cost basis, `Loss −$3`, and cash after for the hydrated inventory.
- No application console errors.
- 320×568, 375×667, 390×844, and 430×932: zero horizontal overflow, zero visible buttons below 44px, and the confirmation row visible without preliminary scrolling.
- 375×560 reduced-height Safari-chrome stress check also passed. The 320×568 modal becomes internally scrollable, but its sticky confirmation remains visible.

## Known limitations

- React, ReactDOM, Babel, and fonts remain CDN-loaded; runtime Babel is still a development setup and the game is not offline-ready.
- Deterministic strategy agents are intentionally simple and currently underuse territory attacks. Human playtesting is required before declaring the $620 note, recruitment/gear timing, and Power targets balanced.
- Robbery and territory operations are intentionally single prototypes, not broad crime or faction systems.
- Ordinary street confrontations still use the compact three-step encounter model.
- Crew assignments and the four garage upgrade tracks remain available, but the simplified v0.5 Operations UI prioritizes recovery and territory over exposing every assignment/upgrade control.
- Travel still lacks last-seen prices, observation age, rendered rumors, and purchasable intelligence; this remains the approved next phase.
- Mara's introduction gates her deeper scene, but there is no explicit invitation/Date Night state or relationship history surface yet.
- Crew introduction events still do not expose recruitment cost, recurring wage, crew-slot use, time cost, primary benefit, and liability together.
- Finance and People do not yet use the proposed one-open-section progressive-disclosure pattern.
- No telemetry export, screen-reader audit, production bundling, or offline asset packaging has been completed.

## Next recommended single task

Implement Phase 2 market intelligence as an isolated schema/test pass: authored neighborhood/product tendencies, last-seen prices, explicit observation age, unknown/unvisited states, and source-labeled expiring rumors. Do not add a guaranteed “best route” answer.
