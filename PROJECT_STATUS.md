# 907Hustle: One Good Run — Project Status

Last updated: 2026-08-01 (America/Anchorage)

## Current baseline

- Rebuild based on GitHub/local `main` commit `df8fad8835931095b74216afa80d97653c415a20`.
- Local and remote `main` matched before implementation.
- The pre-existing modified `.DS_Store` files remain untouched.
- The active build is now `index.html` backed by the pure `game-core.js` domain module.
- `script.js`, `events.js`, `combat.js`, `style.css`, and `907hustle/project/` remain unchanged legacy/reference material and are not imported.
- The old `907g4` browser save is untouched. One Good Run uses the versioned `907ogr_v1` key.

## Current player experience

- Seven days with Morning, Afternoon, Evening, and Night slots.
- A market visit allows multiple buys and sells at locked prices. Travel, End Market, Lay Low, healing, banking, debt payments, and the social location close the visit and advance exactly one slot.
- Three active neighborhoods: North Star Lot, Downtown, and Airport / Industrial.
- Four active products: Weed, Shrooms, Cocaine, and Meth.
- Persistent markets evolve independently after every slot, including availability, short history, and readable high/low/rising/falling signals.
- Always-visible mobile HUD: day/slot, neighborhood, cash, active debt, health, heat, and cargo. Banked money remains visible except at the narrowest breakpoint and is always available on Cash + Debt.
- Dre has debt, deadline, trust, an expandable payment/penalty ledger, and relationship state. Rook has pressure, respect, interference risk, and relationship state. Raw relationship adjectives and thresholds remain internal; the UI communicates them through behavior.
- The Late-Night Mini-Mart & Overlook produces imperfect rumors and occasional Rook relationship changes.
- Player-initiated robbery and tactical combat are disabled. Rare events directly change cash, inventory, health, heat, reputation, or relationships.
- Day summaries, a distinct Day 7 final choice, eight ending categories, detailed run recap, instant restart, and autosave are active.

## Architecture and data flow

`GameCore.createRun/reduceGame → React useReducer → localStorage autosave → mobile UI`

`game-core.js` is a UMD-style module available as both `window.GameCore` and `module.exports`. It owns:

- Seeded deterministic randomness.
- Versioned state creation.
- Action validation and reduction.
- The single `advanceRun` clock/world pipeline.
- Persistent three-neighborhood markets.
- Debt, heat, health, rival pressure, events, summaries, terminal evaluation, and selectors.

`index.html` owns presentation, navigation, forms, modals, the street feed, and local save loading.

## Important decisions

- Starting state: $350 cash, $480 Dre debt due Day 4, 10 cargo, full health, Heat 1.
- Net worth is cash + banked money + local liquidation value − debt.
- Banked cash is protected but earns no automatic interest.
- Selling uses a small spread below the displayed market price, preventing same-visit guaranteed arbitrage.
- “One Good Run” currently requires debt cleared, at least $700 net worth, Heat 7 or below, and Health 40 or above.
- Consuming Day 7 Night ends the run without exposing Day 8.
- The human-playtest revision audit, proposed three-stat model, fight/run formulas, initial catalog, encounter templates, and staged implementation plan live in `PLAYTEST_REVISION_AUDIT.md`.

## Human playtest revision — Phase 1 complete

- Cash + Debt leads with the total owed, Day 4 Night deadline, payment MAX, and compact one-slot action label.
- Loan details disclose original principal, cumulative fees, total repaid, payment count, and recent payment/penalty history without cluttering the primary view.
- Paying the note replaces the payment form with closure, historical details, and remaining-run goals.
- Dre/Rook adjectives, raw trust/respect/pressure values, exact escalation hints, and market-visit analytics were removed from player-facing HUD/People surfaces.
- Trade quantity controls support desktop `−5 / − / exact / + / +5 / MAX` and mobile `− / exact / + / +5 / MAX`, with live total, cash-after, and cargo-after feedback.
- Navigation and quantity layouts were tightened so every required mobile width remains unclipped.
- Store, player stats, fight/run encounters, debt rebalancing, and persistent consequence chains were deliberately deferred.

## Verification completed

### Automated core tests

Command: `node --test tests/game-core.test.js tests/ui-contract.test.js`

- 21 tests passed; 0 failed.
- Covers seeded reproducibility, visit-based trading, every consuming action, invalid actions, all-market updates, day rollover, Day 7 termination, debt-aware net worth, bank accounting, debt penalties, modifier expiration, event timing, early failure, One Good Run classification, price bounds, neighborhood identity, additive loan-ledger compatibility, payment/payoff history, HUD cleanup, debt disclosure, and fast quantity controls.

### Deterministic simulations

Command: `node tests/simulate-runs.js 500`

- 500 cautious, 500 balanced, and 500 aggressive runs completed without hangs.
- Cautious: average net worth $73, average debt $496, average peak Heat 7; 29 One Good Run, 60 Clean Exit, 407 Still Owing, and 4 Taken Down outcomes.
- Balanced: average net worth $43, average debt $563, average peak Heat 11; meaningful Still Owing and Taken Down distribution.
- Aggressive: average net worth −$28, average peak Heat 14; unchecked high-risk routing overwhelmingly ended Caught or Taken Down.
- The original proposed $1,500 success threshold was unreachable in ordinary seven-day play; the initial threshold was adjusted to $700 for real playtesting.

### Browser smoke tests

- New run and versioned save initialization.
- Buy within a visit without advancing time.
- End Market updates prices and advances once.
- Event choice resolves without another time advance.
- Travel changes neighborhood and advances once.
- Partial Dre payment changes cash/debt and advances once.
- Night rollover creates the correct day summary.
- A complete browser-driven run ended at Day 7 Night with a recap and no Day 8.
- New Run returns immediately to Day 1 Morning.
- Reload restored an autosaved Day 1 Afternoon state.
- Phase 1 debt disclosure opened correctly and quantity MAX selected the true purchasable amount.
- Only the expected in-browser Babel development warning appeared; no application errors were logged.

### Mobile viewport checks

- 320×568, 375×667, 390×844, and 430×932.
- No horizontal document overflow at any tested size.
- No visible controls were clipped, including navigation and the compact 320px quantity grid.
- All visible controls measured at least 44px high; the smallest compact quantity control was also 44px wide.
- HUD, navigation, content scrolling, feed, and action bar remained visible and usable.

## Known limitations

- React, ReactDOM, Babel, and web fonts are still CDN-loaded. The game is not offline-ready and Babel warns that runtime transpilation is a development setup.
- The event pool and relationship state machines are intentionally compact; more authored variation should follow balancing, not precede it.
- Simulated strategies are deterministic heuristics, not substitutes for human playtesting.
- The initial balance still favors cautious play and severely punishes repeated aggressive outer-neighborhood travel.
- World intel is rumor-based; there is not yet a historical run-to-run notebook or telemetry export.
- The current $480 debt can clear too quickly in successful human play and must be evaluated alongside store affordability rather than changed in isolation.
- The proposed store, Aim/Grit/Instinct backgrounds, deterministic fight/run encounters, and persistent choice callbacks are documented but not implemented.
- The lender ledger is an additive compatibility update to `907ogr_v1`; there is not yet a general schema-migration framework.
- ClickUp's Current Build Snapshot, Known Issues, and Roadmap pages were aligned with this status on 2026-08-01.

## Next recommended single task

Implement the contained **Phase 2 economy and spending-purpose pass**: simulate candidate debt structures, add the small store data/state/purchase actions, ship a limited weapon/gear catalog, and add one concrete post-debt opportunity. Validate affordability, invalid purchases, save hydration, and one-tick timing before beginning stats or combat.
