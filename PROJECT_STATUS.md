# 907Hustle: One Good Run — Project Status

Last updated: 2026-08-02 (America/Anchorage)

## Current baseline

- Alpha v0.6 onboarding and continuity pass is implemented on `agent/alpha-v0-6-onboarding-continuity`, based on merged `main` commit `7084504f` (PR #45).
- Pre-existing `.DS_Store` modifications remain untouched and outside the project diff.
- Active runtime: `index.html`, `v05.css`, `game-core.js`, and `ui.jsx`.
- Save schema/key remain version 3 / `907ogr_v3`; older save keys remain untouched.
- Fifth-playtest decisions and verification are recorded in `FIFTH_PLAYTEST_AUDIT.md`.

## Alpha v0.6 implementation

1. A dedicated title screen uses the supplied local artwork and exposes Load Game, New Game, How to Play, valid-save preview, corrupt-save handling, overwrite confirmation, and exact autosave resume.
2. New players choose Silver-Tongued Hustler or Steady-Hand Shooter. Strategist remains an internal legacy edge and old Strategist saves hydrate normally.
3. Centralized feature availability opens Travel/Operations after the first market period, People after a recurring introduction, and Recovery when Health, Heat, story, or returning progress makes it relevant.
4. Primary navigation is Market, Travel, People, and More. The HUD shows Day/Time, Cash, and Heat; a one-tap Status drawer reveals district, debt, Health, cargo, and crew Power.
5. People is a nested hub for Key People, Crew, and Recent History. Operations is a nested hub for Quick Score, Territory, Gear, and Safehouse.
6. Mara now receives a clear Night Owl introduction with flirt/friendly/distant history before her parking-lot threat can occur. Runs without that context receive a Mara-free early threat.
7. Eli now progresses through introduction, contact/test availability, a $35 time-consuming test route, recruitable status, and active crew. Rejection can receive a later callback.
8. Trade projections remain shared between UI and reducer; empty Recent Local Context is omitted until a prior observation exists.
9. Player-facing time copy uses parts of day. Internal `run.slot` and equipment-slot identifiers remain unchanged.
10. Quick Score replaces Emergency Robbery as a sub-$150 comeback action available at most once per in-game day. Repeated weekly attempts become less likely and more dangerous; failures do not permanently remove the option.
11. Finance includes +$25/+50/+100, Safe Maximum, and Pay Full controls with clamped payment/cash/debt previews and the $150 reserve warning.
12. Safehouse surfaces protected cash, stored inventory, upgrades, and crew assignments. Recovery reveals treatment progressively and previews Lay Low accurately.
13. Player-facing locations are Spenard, Downtown, and Industrial Service Roads, with North Star Garage and Night Owl Mini-Mart as named Spenard stops. Internal location IDs remain compatible.

## Architecture

`Title/save inspection → createRun or hydrateRun → React useReducer → reduceGame → single advanceRun pipeline → v3 autosave`

`game-core.js` remains a UMD domain module exposed as `window.GameCore` and `module.exports`. Seeded randomness, save normalization, feature availability, markets, events, contacts, Quick Score, takeovers, clock/world pressure, endings, and selectors live in the core. React presentation and screen-local nested navigation remain in `ui.jsx`.

All time-consuming game actions still route through `advanceRun` exactly once. Trades remain non-advancing within a locked market visit; event/encounter/result acknowledgement does not add a second tick.

## Save compatibility

- No version bump was required.
- `hydrateRun` validates v3 structure and fills additive defaults without rewriting the old key.
- Legacy Strategist, Mara, Eli, and robbery states are covered.
- Legacy robbery fields normalize into attempts, successes, failures, total payout, and last attempted day while retained summary aliases prevent old surfaces from breaking.

## Verification

### Automated regression suite

Command: `node --test tests/*.test.js`

- 40 passed, 0 failed.
- Covers existing clock, market, trade, debt, territory, encounters, summaries, and endings plus title/save states, legacy hydration, two selectable edges, feature availability, Mara/Eli continuity, Quick Score daily gating, Finance clamping, nested UI contracts, local-context reveal, and time terminology.

### Deterministic simulation

Command: `node tests/simulate-runs.js 200`

- 600/600 runs terminated; 0 dead ends.
- Cautious: average cash $100, net worth −$392, debt $782, peak Heat 6, 52 Quick Score attempts / 25 successes.
- Balanced: average cash $82, net worth −$385, debt $781, peak Heat 11, 72 attempts / 26 successes.
- Aggressive: average cash $127, net worth −$432, debt $667, peak Heat 14, 207 attempts / 80 successes.
- Territory attempts were 0 because the simple agents still do not accumulate takeover readiness.

### Browser and mobile QA

- Verified title/no-save, artwork, edge selection, first-market gating, trade projections, Mara introduction, nested People/Operations, Finance preview, title return, saved-run preview, and exact resume.
- 320×568, 375×667, 390×844, 430×932, and 375×560 all had 0px horizontal overflow.
- Smallest visible primary control: 44px; navigation controls: 48px.
- Load/New Game and bottom actions remained reachable at every size.
- Browser console errors: 0.

## Known limitations

- React, ReactDOM, Babel, and fonts remain CDN-loaded; runtime Babel is not a production/offline build.
- The packaged title image is 1.9 MB and should be optimized when an asset pipeline is introduced.
- Deterministic strategies are deliberately simple, report negative average net worth/high remaining debt, and do not exercise territory attacks. Human playtesting is still required for economy and takeover timing.
- Full cross-district price memory, information age, rumor reliability, scouting, and purchasable market intelligence remain deferred.
- Mara invitation/Date Night, manual progression, hierarchical statewide travel, banking/laundering, and multiple robbery types remain deferred.
- Relationship/operation records remain concise rather than exhaustive ledgers.

## Next recommended single task

Run a focused human onboarding/balance playtest of Alpha v0.6 on mobile and desktop. Measure title-to-first-trade comprehension, feature-unlock timing, Mara/Eli continuity, Quick Score discoverability and retry behavior, Finance reserve comprehension, and whether a human can reach territory readiness within seven days before adding cross-district market intelligence.
