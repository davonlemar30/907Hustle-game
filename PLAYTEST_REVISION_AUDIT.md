# One Good Run — Human Playtest Revision Audit

Date: 2026-08-01 (America/Anchorage)
Baseline: local `main` at `df8fad8835931095b74216afa80d97653c415a20`

## Executive recommendation

Keep the seven-day market core and add role-playing depth in layers. The first contained pass is information cleanup only. The next pass should create a small store and stronger debt/post-debt economy. Stats should follow before deterministic fight/run encounters. The preserved combat code is reference material, not an import candidate.

## 1. Cash + Debt review

Before this pass, the screen led with net worth and two general money cards. Dre's balance appeared in a small card beside a due-day badge, raw relationship state, and a generic payment input. It did not distinguish principal from penalties, count payments, preserve a readable ledger, or give a meaningful paid-off state. The action's time cost was explained as page-wide tutorial prose.

The contained pass makes `You owe Dre: $480` the primary hierarchy, shows `Due Day 4 · Night`, adds a MAX payment, labels the Pay action as costing one slot, and moves principal, fees, total repaid, payment count, and recent ledger entries into a native expandable disclosure. Once paid, the form is replaced with closure copy, remaining-run goals, and the same historical disclosure.

## 2. Persistent HUD inventory

| Element | Before | Recommendation / result |
|---|---|---|
| Day + slot | Visible | Keep; it frames every decision. |
| Location | Visible | Keep; market and encounter context depend on it. |
| Cash | Visible | Keep; primary action resource. |
| Debt | Visible but hidden at 320px | Keep while active and never hide at the smallest target width; show `Clear` afterward. |
| Health | Visible | Keep; required for upcoming encounter risk. |
| Heat | Visible with band | Keep numeric value and atmospheric band; do not expose event thresholds. |
| Cargo | Visible | Keep; directly constrains trading and future escape outcomes. |
| Banked | Visible | Secondary; keep where space permits and always expose on Cash + Debt. It may collapse from the 320px HUD. |
| Dre adjective | Persistent | Remove. Communicate through messages, terms, access, and behavior. |
| Curtis adjective | Persistent | Remove. Communicate through interference, dialogue, access, and behavior. |
| Visit/trade counter | Persistent | Remove from player UI; retain `currentVisit` and `stats.visits` for analytics. |

## 3. Relationship presentation trace

The core stores `lender.trust`, `lender.relationship`, `rival.pressure`, `rival.respect`, and `rival.relationship`. Lender and rival adjectives are recalculated after pressure changes, event effects, and payments. Before this pass, the UI exposed those adjectives in the HUD, People cards, and final recap; People also exposed raw trust, pressure, respect, and the exact lender escalation day.

The revised UI leaves the numeric/state-machine fields internal. It translates current state into short behavioral reads: Dre notices payments or shortens his messages; Curtis ignores, watches, accommodates, or applies pressure. The final recap uses the same behavior language. Later phases should express state through loan terms, store access, encounter choices, assistance, retaliation, and Day 7 options.

## 4. Debt calculation and payoff trace

- Fresh run: $350 cash and a $480 obligation due after Day 4 Night.
- `PAY_DEBT` validates a positive amount up to both cash and balance, subtracts it from both, may increase trust, logs the result, then advances exactly one slot.
- On each overdue day rollover, one fee equal to the greater of $20 or 8% of the current balance is added; heat and missed-day pressure also rise.
- Net worth subtracts the current balance.
- Before this pass, `payments` stored only the aggregate amount and payoff merely changed the balance and relationship state.
- This pass adds additive, backward-safe ledger fields: original principal, cumulative fees, payment count/history, penalty history, and payoff time. Existing `907ogr_v1` saves without those fields hydrate on the next reduced action and remain readable through the selector.

Debt difficulty remains intentionally unchanged in Phase 1. Phase 2 should simulate a starting obligation around $600–$700 or an equivalent installment structure and target a meaningful, possible early payoff rather than select a number from one anecdotal run.

## 5. Legacy combat, weapon, stat, and store review

`combat.js` contains ten enemy profiles and four actions: fight, flee, bribe, and draw burner. It supports enemy health, attack ranges, cash loss, heat, inventory seizure, loot, Curtis/Dre consequences, and a compact two-column modal. `events.js` contains many encounter hooks but mixes authored choices with immediate global mutations. `script.js` and the prototypes contain a four-item upgrade shop (beater, hidden stash, burner pack, crew muscle), asset-gated effects, and reusable shop-card styling.

There is no coherent player-stat model. Combat bonuses are asset checks, firearm and phone concepts are conflated in `burner_pack`, randomness mixes a custom RNG with `Math.random()`, combat sits outside the unified clock, and death resets the whole game inside resolution. Legacy prices, products, contacts, unlocks, and 30-day assumptions also conflict with One Good Run.

## 6. Safe reuse recommendation

Reuse as design input:

- Enemy difficulty tiers and concise encounter copy.
- The fight/flee/pay/draw choice vocabulary.
- Cash, health, heat, inventory-loss, loot, and relationship consequence types.
- The compact combat action layout and shop-card visual language.
- The idea that gear changes both risk and market access.

Rewrite inside `game-core.js`:

- All random rolls using the run's seeded RNG.
- Encounter state and one-to-three-decision resolution.
- Weapon/gear data with distinct IDs and explicit modifiers.
- Every consequence and time transition through `reduceGame` / `advanceRun`.
- Terminal-state handling, save shape, analytics, and tests.

Do not import the legacy global state, DOM rendering, `Math.random()`, implicit reset, 30-day data, or robbery entry points.

## 7. Proposed three-stat model

Use 1–5 Aim, Grit, and Instinct. Start each run by choosing one of three backgrounds; there is no XP grind.

| Background | Stats | Run tradeoff |
|---|---|---|
| Runner | Aim 1, Grit 2, Instinct 3 | Better escape and danger reads; weaker firearm start. |
| Enforcer | Aim 2, Grit 3, Instinct 1 | Better close outcomes and damage resistance; starts with extra heat. |
| Shooter | Aim 3, Grit 1, Instinct 2 | Strong firearm ceiling; starts with less cash and needs a weapon. |

Equipment may add at most one situational stat point. One authored scene may grant one permanent point per run. Primary UI describes effects in words; exact probabilities remain in documentation and tests.

## 8. Proposed fight/run model

All rolls use the seeded core RNG and clamp outcome probability to 10%–90%.

- Firearm hit: `0.28 + Aim×0.09 + weapon accuracy + health modifier + context − enemy evasion`.
- Close hit: `0.30 + Grit×0.09 + weapon close bonus + health modifier − enemy guard`.
- Escape: `0.24 + Instinct×0.09 + gear bonus + 0.18×free-cargo ratio + health modifier − enemy pursuit − area penalty`.
- Health modifier: +0.05 above 75 health, 0 from 40–75, −0.12 below 40.
- On a hit, damage is the weapon range plus a small Grit bonus for close weapons. Armor subtracts flat damage but never below 1.
- Failed fight draws one enemy response. Failed escape draws reduced damage and then offers one last decision. Encounters hard-stop after three player decisions.
- Firearm use adds weapon-specific heat. Escape can cost cash, a weighted cargo slice, or a consumable, with heavier cargo increasing that risk.

Tests must pin RNG boundaries, clamping, stat/gear deltas, health bands, full-versus-empty cargo, and maximum decision count.

## 9. Initial weapon and equipment catalog

| Item | Target cost | Purpose and tradeoff |
|---|---:|---|
| Utility knife | $90 | Close bonus and intimidation; low stopping power, concealable. |
| Cheap handgun | $230 | Makes firearm choices available; weak accuracy, +2 heat when fired. |
| Reliable handgun | $430 | Better accuracy and damage; meaningful capital sacrifice, +2 heat. |
| Short shotgun | $720 | High late-run stopping power and intimidation; poor concealment, +4 heat. |
| Heavy jacket | $120 | Reduces the first small hit; modest escape penalty when cargo is heavy. |
| Protective vest | $300 | Flat incoming-damage reduction; expensive and visible. |
| Running shoes | $160 | Escape bonus; no fight protection. |
| Medical kit | $95 | One-use injury recovery or prevention; consumes cargo or an item slot. |
| Larger bag | $260 | +5 cargo; a fuller load still makes escape harder. |
| Burner phone | $180 | Adds call-for-help/rumor options; it is not a firearm. |

The first store implementation should ship no more than these ten entries and may initially defer shotgun availability to a relationship or paid-off-debt opportunity.

## 10. Encounter templates

1. **Curtis's Roadblock:** pay, turn back, draw, call Curtis, or find another route with Instinct.
2. **Mini-Mart Watch:** leave, ditch cargo, hide and spend time, use a burner, or stay for the rumor.
3. **Industrial Ambush:** fight, run, surrender a selected product, or call in a relationship favor.
4. **Injured Courier:** spend time helping, use a medical kit, search them, walk away, or call Dre/Curtis; the courier can return later.
5. **Bad Buyer:** talk down, draw, run with the money, or cancel; can affect later market supply.
6. **Dre's Collection Visit:** make a partial payment, request terms, surrender gear, run, or fight as a costly last resort.
7. **Curtis's Test:** carry a package, refuse, negotiate, or expose a setup; alters later interference and Day 7 access.
8. **Checkpoint Spill:** turn around, hide cargo, use a lockbox/burner option, abandon product, or risk an escape.

## 11. Persistent consequence connections

Encounters should apply typed effects to cash, selected inventory, health, heat, equipment uses, lender trust, rival respect/pressure, and market modifiers. They may also set compact flags such as `helpedCourier`, `rookPackage`, or `usedFirearmDowntown`. Eligibility and choice lists read those flags later. Market consequences use expiring area/product modifiers; relationship consequences change authored behavior and available choices; health and heat feed future difficulty; Day 7 reads significant flags to offer a protected exit, ambitious score, relationship assist, or retaliation. Resolution itself never adds a second time tick after the triggering action.

## 12. Phased implementation and tests

1. **UI cleanup (implemented in this pass):** debt hierarchy/disclosure/ledger, contextual People copy, remove HUD labels and visit analytics, fast quantity/MAX, rewrite mechanic hints, paid-off state. Add core ledger and static UI contract tests; smoke-test all target viewports.
2. **Economy and store:** simulate debt structures, implement a small catalog, purchases, equipment slots/uses, and one paid-off opportunity. Test affordability, invalid purchases, save compatibility, and action timing.
3. **Stats/backgrounds:** add run-start selection and pure combat selectors. Test every modifier and probability boundary.
4. **Fight/run encounters:** add deterministic encounter state, two initial handcrafted encounters, mobile modal, and one-to-three decisions. Test timing, terminal outcomes, and seeded replay.
5. **Persistent consequences:** add flags, later-event callbacks, relationship/store/market/Day 7 branches. Test cause-and-effect chains.
6. **Balance:** deterministic profiles, randomized batches, full browser runs, and human mobile sessions. Track payoff day, purchases, encounter frequency, choice split, health, heat, endings, unspent cash, repetition, and unavoidable losses.

## 13. ClickUp documentation plan

Keep changes together in the existing One Good Run / current alpha document:

- Update **Current Build Snapshot** with the human playtest findings, approved Phase 1 changes, and verified test results.
- Update **Known Issues / Limitations** with CDN dependency, additive-save limits, unimplemented store/stats/combat, and remaining balance uncertainty.
- Update **Roadmap / Next Build** with the six phases, the three-stat/fight-run design, initial catalog, encounters, consequence rules, balance metrics, deferred ideas, and the single next contained task.
- Do not alter legacy reference pages or create scattered standalone documents unless the existing page size prevents a coherent update.

## 14. First contained code task

The first contained task is the Phase 1 UI cleanup described above. It is implemented in `index.html` plus additive loan-ledger support and selectors in `game-core.js`. Full combat, stats, store inventory, new debt balance, and post-debt lending remain deferred until this pass is tested and documented.
