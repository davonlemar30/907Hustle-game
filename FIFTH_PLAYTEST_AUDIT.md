# Alpha v0.6 Fifth Playtest Audit

Audit date: 2026-08-01 (America/Anchorage)

Baseline: merged `main` commit `7084504f` (PR #45), save schema/key v3 / `907ogr_v3`.

## First-five-minute UX audit

- The app currently skips a title screen, automatically hydrates a parseable save, creates a new run otherwise, and immediately writes that state back to local storage.
- Starting identity is a three-choice modal. Shooter, Hustler, and Strategist are all selectable even though this pass calls for two clearer starting edges.
- Six primary tabs and eight HUD values are visible at once. People and Operations are long management pages without nested navigation.
- Mara's introduction and the gray-sedan threat are combined. The first Day 2 encounter can use Mara before the run has established a meaningful relationship callback.
- Eli becomes recruitable immediately after his introduction. No contact, test-route, or follow-up stage exists.
- Emergency robbery is permanently consumed after one attempt. Finance uses an ambiguous `SAFE` control, Recovery exposes every treatment tier, and the trade modal renders empty local-context copy.
- The stable internal location IDs can support player-facing names such as Spenard and Industrial Service Roads without a save-key change.

## Current navigation and HUD inventory

Primary navigation: Market, Travel, Operations, People, Finances, Recovery.

Always-visible HUD: Day/part, area, cash, debt, health, Heat, cargo, and crew Power.

Bottom actions: Travel, End Market, and Lay Low.

## Title artwork decision

The supplied `907chatgptimage.png` is a 941×1672 RGB PNG (approximately 1.9 MB). Its portrait composition is suited to the mobile title screen. The implementation will package a local copy, retain semantic title/tagline text for accessibility, use responsive cover/contain behavior, and keep Load/New Game reachable at reduced viewport heights.

## Contained implementation decisions

- Preserve save version 3 and normalize additive fields during hydration.
- Keep Strategist internally for old saves while exposing only Silver-Tongued Hustler and Steady-Hand Shooter to new runs.
- Centralize feature availability and unlock notices in the domain layer.
- Introduce Mara before a relationship-dependent threat and stage Eli through a test route before recruitment.
- Replace the run-level robbery flag with a once-per-day Rob and cumulative statistics.
- Reorganize People and Operations into nested full-screen views; simplify the HUD and primary navigation.
- Preserve the economy, transaction projections, territory rules, and single time-advance pipeline unless this phase explicitly changes presentation or gating.

## Deferred proposals

- Full cross-district imperfect market intelligence.
- Mara invitation and Date Night scenes.
- Generic XP, Street Knowledge, or manual skill allocation.
- Hierarchical city/state travel.
- Banking, laundering, and additional robbery types.

Verification, event-gating diagrams, simulation results, mobile results, save-compatibility results, and remaining risks will be added after implementation.

## Implemented decisions

1. Added a full-screen title using the supplied portrait artwork, explicit Load/New Game/How to Play actions, valid-save preview, corrupt-save error handling, and overwrite confirmation.
2. New runs expose Silver-Tongued Hustler and Steady-Hand Shooter. The legacy Strategist definition remains hydratable.
3. Centralized feature availability in `selectors.featureAvailability`; Travel and Operations open after the first period, People opens after an introduction (or returning-run progress), and Recovery opens when injury, Heat, story, or returning progress makes it relevant.
4. Reduced primary navigation to Market, Travel, People, and More. The primary HUD now shows Day/Time, Cash, and Heat; Status reveals district, debt, Health, cargo, and crew Power.
5. Converted People and Operations into nested full-screen category views with explicit Back controls.
6. Rewrote Mara's introduction, stored the chosen tone, gated the Night Owl threat behind that introduction, and added a Mara-free service-road threat fallback.
7. Rewrote Eli's introduction and added contact stages, a $35 test route that uses one part of day, deterministic risk/reward, a rejection callback, and recruitment gating.
8. Hid Recent Local Context until a prior local price exists.
9. Replaced player-facing time “slot” copy with part-of-day language while preserving internal `run.slot` and equipment-slot identifiers.
10. Reworked Emergency Robbery into Rob: visible in Operations, available below the $150 comeback threshold at most once per day, repeatable on later days, and increasingly risky across the week.
11. Added cumulative Rob attempts, successes, failures, total payout, and last-attempted day while retaining legacy summary fields.
12. Reorganized Operations into Rob, Territory, Gear, and Safehouse. Safehouse now surfaces protected cash, stored inventory, upgrades, and assignments.
13. Added +$25/+50/+100, Safe Maximum, and Pay Full debt controls with clamped cash/debt previews and the existing reserve warning.
14. Simplified Recovery through progressive treatment reveal and an accurate Lay Low preview.
15. Updated display copy to Spenard, Night Owl Mini-Mart, North Star Garage, Downtown, and Industrial Service Roads without changing stable location IDs.

## Feature-unlock rules

| Feature | Fresh-run rule | Returning-run safety |
|---|---|---|
| Market, Finances, Help, menu | Immediate | Immediate |
| Travel, Operations | First market period has ended | Any existing time progress |
| People | Mara or crew contact introduced | Day 2+ / established pipeline progress |
| Recovery | Health below 100, Heat above 1, or story flag | Day 2+ / established pipeline progress |

Each first unlock writes one concise Street Feed notice. Locked More cards retain a concrete hint without revealing story probability thresholds.

## Event-gating diagrams

### Mara

`Unmet → Mara on the Night Shift → flirt | friendly | distant → People card unlocked → eligible Night Owl threat callback → later truth/visit/ending logic`

If Mara is not introduced, unavailable, or lacks interaction history, the early confrontation becomes `A Tail on the Service Road` and does not mention her.

### Eli

`Unknown → The Impound Notice → test available | road-contact follow-up | rejected`

`Test available/follow-up → Give Eli a Test Route ($35, one part of day) → recruitable → active crew`

`Rejected → Day 4 callback → reopen test route | final rejection`

## Rob balance model

- Requires working capital below $150, no unresolved event/encounter/operation, and time remaining.
- May be attempted once on each in-game day.
- Success considers Combat, Intelligence, an equipped weapon, active crew, Heat, and prior attempts.
- Payout is $115–$210. Repeated attempts reduce success chance and increase Heat, Rook pressure, and injury range.
- Failure never creates a permanent weekly lockout; a later day can reopen the action if the player still needs recovery capital.

The deterministic agents attempted Rob in 331 of 600 runs/attempt opportunities total (52 cautious, 72 balanced, 207 aggressive). Successful payout totaled $20,816, but aggressive use produced 127 failures and a peak-Heat average of 14. The action therefore functions as emergency recovery rather than a low-risk replacement for market trading.

## Save compatibility decision

Save schema and key remain version 3 / `907ogr_v3`.

`hydrateRun` deep-fills additive defaults, preserves old market/player state, retains Strategist, restores missing Mara/crew fields, and converts legacy robbery `{ attempted, success, payout }` data into cumulative statistics. Automated fixtures cover a fresh run, Strategist, Mara met, Eli introduced, and an old attempted robbery. No destructive migration or old-key rewrite occurs.

## Verification

### Automated tests

Command: `node --test tests/*.test.js`

- 40 passed, 0 failed.
- Covers save inspection, corrupt saves, legacy hydration, two new-run edges, feature unlocks, Mara gating/callback, Eli test-route progression, Rob daily gating/stat normalization, Finance clamping, trade-projection parity, local-context reveal, nested navigation contracts, player-facing time terminology, and existing clock/economy/territory/endings.

### Deterministic simulations

Command: `node tests/simulate-runs.js 200`

- 600/600 runs terminated; 0 dead ends.
- Cautious: average cash $100, net worth −$392, debt $782, peak Heat 6, 52 Rob attempts / 25 successes.
- Balanced: average cash $82, net worth −$385, debt $781, peak Heat 11, 72 attempts / 26 successes.
- Aggressive: average cash $127, net worth −$432, debt $667, peak Heat 14, 207 attempts / 80 successes.
- Territory attempts remained 0 because the existing deterministic profiles do not accumulate the required crew/gear/cash readiness. This is an agent limitation and a continuing balance-observation gap, not a disabled mechanic.

### Browser and mobile verification

Live browser flow covered title/no-save, artwork load, new game, edge selection, first market, live trade totals, hidden empty context, feature notices, Mara introduction, People nesting, Operations nesting, Finance preview, Return to Title, save preview, and exact autosave resume.

| Viewport | Horizontal overflow | Smallest visible control | Title/New Game | Bottom actions |
|---|---:|---:|---|---|
| 320×568 | 0px | 44px | Reachable | Visible |
| 375×667 | 0px | 44px | Reachable | Visible |
| 390×844 | 0px | 44px | Reachable | Visible |
| 430×932 | 0px | 44px | Reachable | Visible |
| 375×560 | 0px | 44px | Reachable | Visible |

The four navigation targets measured 48px high at every viewport. The reduced-height title did not require horizontal scrolling, and browser console errors were 0.

## Future location model

The current run stays compact: Alaska → Anchorage → district → named stop. Current stops include North Star Garage and Night Owl Mini-Mart inside Spenard. A later travel phase can add additional Anchorage districts, Mat-Su, Fairbanks, Juneau, and other Alaska hubs without changing the current seven-day map now.

## Remaining risks and deferred work

- The 1.9 MB title PNG is locally packaged and visually appropriate but could be optimized to WebP/AVIF in a production asset pipeline.
- React, ReactDOM, Babel, and fonts still load from CDNs; offline play and production bundling remain unresolved.
- The deterministic agents are intentionally weak traders and still finish with negative average net worth and high debt. Human balance testing remains necessary.
- Full imperfect cross-district market intelligence, Mara invitation/Date Night, generic progression/manual skill allocation, hierarchical statewide travel, banking/laundering, and additional robbery types remain deferred.
- People history is concise rather than a full relationship ledger; Operations/Safehouse management remains intentionally lightweight.
