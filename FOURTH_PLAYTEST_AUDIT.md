# Alpha v0.5 Fourth Playtest Audit

Audit date: 2026-08-01 (America/Anchorage)

Scope decision: implement only Phase 1 transaction projections in this pass. Market intelligence, relationship progression, recruitment rewrites, and progressive disclosure remain reviewed follow-up phases.

## 1. Desktop and mobile trade-information comparison

Desktop and mobile use the same `TradeModal` in `ui.jsx`; there is no separate desktop trade implementation. Both currently display:

- Buy/Sell mode.
- Unit price.
- Maximum quantity.
- Quantity controls.
- Cancel and confirmation actions.

Neither currently displays total purchase cost, sale revenue, cost basis, profit/loss, cash after, cargo after, or recent local price context.

The only responsive difference is CSS: below 520px the modal hides the −5 shortcut and compresses the quantity grid. The reported mobile information gap is therefore a shared transaction-context gap that is most noticeable on mobile.

Recommendation: keep one shared modal and one shared projection selector so desktop and mobile cannot diverge again.

## 2. Current inventory purchase-cost trace

The active state stores each carried and garage inventory entry as:

`{ qty, avgCost }`

The current accounting method is already weighted average:

`new average = ((old average × old quantity) + new purchase cost) ÷ new total quantity`

Behavior trace:

- `BUY`: combines the held cost pool with the exact transaction cost.
- `SELL`: calculates realized profit as sale revenue minus `avgCost × sold quantity`; the remaining units retain the same average, and average resets to zero only when quantity reaches zero.
- `STORE_PRODUCT` and `RETRIEVE_PRODUCT`: merge carried and stored pools using weighted averages.
- No individual purchase batches exist.

Recommendation: preserve weighted-average accounting. It is deterministic, already reliable across storage, and fits the four-product scope. Add a pure selector for projections so the modal and reducer use the same price and cost-basis rules.

## 3. Profit-and-loss calculation recommendation

For a selected sell quantity:

- Revenue = sell unit price × quantity.
- Cost basis = held weighted-average cost × quantity.
- Estimated profit/loss = revenue − cost basis.
- Cash after = current street cash + revenue.

For a selected buy quantity:

- Purchase cost = buy unit price × quantity.
- Cash after = current street cash − purchase cost.
- Cargo after = current cargo + quantity, shown against capacity.
- Local context = current signal plus comparison with the previous recorded local price when history exists.

Currency values shown to the player should round to whole dollars while calculations retain the existing numeric average. Profit/loss must always include a text label and explicit sign; color remains secondary.

## 4. Current Travel-screen information

Each neighborhood currently shows:

- Neighborhood name.
- Current location, player-controlled, or Rook-controlled status.
- Broad neighborhood blurb.
- Adjusted risk rating.
- Police rating.
- Influence value.
- Travel action.

The page header says travel advances one slot. There is no cash travel cost.

It does not show:

- Product-specific tendencies.
- Last-observed prices.
- Observation age.
- Unknown/unvisited status.
- Active rumors.
- Supply memory.
- Crew, relationship, gear, or intelligence modifiers.

Although `effects.rumors` exists in state and Miri can create one, v0.5 does not render rumors on Travel or People.

## 5. Market-intelligence proposal

This should be a later schema-bearing phase, not part of the Phase 1 UI patch.

### Free tendencies

Add authored product/area identities that never promise the current best route:

- North Star: dependable Weed supply and relatively stable prices.
- Downtown: stronger party-product demand, higher surveillance.
- Airport / Industrial: rarer supply, larger swings, higher physical risk.

### Price memory

Add `world.intel[areaId]` with `visited`, `observedAt`, and per-product observed price/availability. Update only when the player is physically in that neighborhood after market evolution. Travel displays “Last seen,” never “Current,” for other areas.

Freshness bands:

- 0–1 slots: Fresh.
- 2–3 slots: Aging.
- 4+ slots: Stale.
- Never visited: Unknown.

### Rumors

Use source, product/area target, direction/supply claim, confidence language, observed/expiry slot, and a hidden truth model. Mara and Miri are usually more credible; Rook-linked or anonymous information can be self-serving. The UI must distinguish rumor from observed price.

### Purchasable intelligence

- Burner phone: one current direction clue.
- Market board: better freshness language and supply memory.
- Informant payment: current clue for one selected product/area.
- Crew scout: one area observation after a slot.

Avoid a permanent “best price” answer. Intelligence should narrow uncertainty, not solve routing.

## 6. Active Mara interactions and eligibility

| Interaction | Current eligibility | Current issue |
|---|---|---|
| `mara_intro` / The Night Clerk | Forced after the first consumed slot until resolved | Establishes her job and surveillance concern, but not clearly the prior connection or relationship intent. |
| `mara_truth` | Mara met, Day 3+, unresolved, 45% story roll | Properly gated behind introduction, but skips a deliberate invitation/meeting step. |
| `VISIT_MARA` | Mara met, $40 available | People action says “Meet after close,” but no pending invitation or scene category explains why tonight matters. |
| Early encounter `call_mara` | Early threat, Mara met, trust ≥2 | Useful callback; costs trust and adds Heat. |
| `buyer_hurry` | Generic event pool | Mara witnesses the scene, but this is not explicitly classified as a relationship consequence. |
| Mara escape ending | Escape plan, trust ≥3, consent not violated | Strong final callback, though the path to it is not clearly presented during the week. |

Current `mara_truth` does respect introduction. The problem is progression clarity, not an entirely ungated deep event.

## 7. Proposed Mara introduction and Date Night progression

1. **Introduction — “Mara on the Night Shift”**
   - Establish that she knew the player before this week.
   - Explain her nursing-school/night-shift situation, boundaries, and concern about the garage.
   - Classify as `relationship:introduction`.

2. **Invitation**
   - After introduction, set a pending People-card request rather than immediately selecting a deep random scene.
   - Actions: meet tonight, postpone, ask for Downtown information, ignore.
   - Meeting consumes one slot; the other responses do not.

3. **Date Night / Personal scene**
   - Trigger only from the accepted invitation.
   - Surface context, relationship category, risk/opportunity, and callbacks to prior choices.

4. **Callbacks**
   - Ignored/postponed invitation changes later copy.
   - Help can unlock information, basic care, or an exit.
   - Using her name or space without consent can remove those options.
   - Surveillance, injury, and final-exit events read the relationship history.

## 8. Active crew/contact recruitment events

| Event | Character | Current result |
|---|---|---|
| `eli_offer` | Eli “Shortcut” Ward, Runner | Introduces Eli; invite/decline changes loyalty. Actual recruitment later costs $120 base, $45 wage, one slot, and one of two crew slots. |
| `miri_offer` | Samira “Miri” Cole, Connector | Introduces Miri; ownership/list framing changes loyalty. Recruitment later costs $180 base, $60 wage, one slot, and one crew slot. |
| `tone_offer` | Anton “Tone” Bell, Enforcer/Lookout | Introduces Anton; offer/decline changes loyalty. Recruitment later costs $250 base, $85 wage, one slot, and one crew slot. |
| `dre_after_payoff` | Dre Holloway, lender/supplier | Not crew recruitment; offers another note, Cocaine access, or independence after payoff. |

The introduction events do not charge or recruit immediately; their copy does not make that two-step structure sufficiently explicit. The later People cards show role, base cost, Power, and wage due after recruitment, but the event itself does not state recurring cost, slot occupancy, time cost, primary benefit, or liability.

## 9. Recurring-character purpose audit

### Mara Velez

- Gives: trust-based information, encounter alarm, possible care, escape ending.
- Wants: truth, consent, and protection from operation spillover.
- Maintenance cost: time, $40 meetings, honest choices.
- Failure: trust loss, compromised/gone state, lost support/ending.
- Later effect: early threat, boundary scene, final escape.
- Gap: invitation/category/history are not explicit.

### Dre Holloway

- Gives: starting capital relationship, post-payoff loan/supplier/independence branch.
- Wants: payment and credible dates.
- Maintenance cost: $620 note, fees, time-consuming payments.
- Failure: fees, Heat, demanding/threatening relationship.
- Later effect: warning events and expansion ending.
- Gap: Finance details/history need progressive disclosure.

### Rook Mercer

- Gives: antagonist pressure, respect path, partnership possibility.
- Wants: control, payment, or proof that the player is costly to oppose.
- Maintenance cost: cuts, restraint, or confrontation risk.
- Failure: pressure, injury, ambushes, territory defense.
- Later effect: encounters, territory, partnership/takeover endings.
- Gap: compact People status should explain the most recent concrete signal.

### Eli Ward

- Gives: route income/intelligence and North/outer influence.
- Wants: paid work and protection.
- Maintenance cost: $120 recruit, $45 wages, assignment risk.
- Failure: loyalty loss, missed check-in, outer-route exposure.
- Later effect: assignment result and crew crisis.
- Gap: no unique authored callback beyond shared crisis; role benefit is absent from introduction summary.

### Miri Cole

- Gives: Cocaine/Meth access and reliable rumors.
- Wants: ownership, honesty, and inclusion.
- Maintenance cost: $180 recruit, $60 wages.
- Failure: loyalty loss and potential information conflict implied but not authored.
- Later effect: supplier assignment and rumor.
- Gap: needs a later choice that tests ownership/list treatment.

### Anton Bell

- Gives: highest crew Power, garage defense, confrontation support, intimidation.
- Wants: wages, limits on reckless harm, and a way back after Rook displaced him.
- Maintenance cost: $250 recruit, $85 wages; one crew slot.
- Failure: Heat escalation, loyalty test, possible permanent takeover loss.
- Later effect: Call Tone, base defense, territory attack, final defense.
- Gap: introduction does not summarize these mechanics; no dedicated betrayal/sacrifice callback exists.

## 10. Revised Anton Bell event

**Category:** Crew Introduction

**Worldbuilding**

Anton Bell stands beneath the broken garage light and points toward a sedan parked beyond the camera's view. Rook's people cost him his security job. He says he can watch the garage, stand with a crew, and spot trouble before it reaches the door.

**Decision summary — Bring Anton into the operation**

- Role: Enforcer / Lookout.
- Recruitment later: $250 at North Star Garage.
- Recurring wage: $85 after each day.
- Primary benefit: Power 5; base defense and confrontation support.
- Liability: his methods can raise Heat and provoke Rook.
- Capacity: occupies one of two crew slots.
- Time: this introduction is free; hiring later consumes one slot.

**Choices**

1. **Ask Anton to meet at the garage** — Introduces him for later recruitment; starts with +1 loyalty.
2. **Question him about Rook** — Introduces him and provides a Rook/surveillance clue; loyalty unchanged.
3. **Ask for one night of warning** — Creates a temporary base warning without recruiting; he expects a later answer.
4. **Decline** — Introduces him as refused; starts with −1 loyalty and enables a later Rook-side callback.

## 11. Finance and People wireframes

### Finances

**Level 1 — summary**

Street cash | Garage cash | Dre balance | Due Day/slot | one warning/opportunity.

**Level 2 — action**

Payment amount, SAFE shortcut, Pay button, reserve warning.

**Level 3 — one open disclosure at a time**

- Loan details: principal, fees, trust/terms, extension.
- Run finances: net worth, trade results, gear/base/crew/healing spend.
- Protected cash: capacity, stored amount, safety effect.

**Level 4 — records**

Payment and penalty history.

### People

**Level 1 — compact cards**

Name | Role | availability | one contextual status line | View/Manage.

**Level 2 — primary action**

Accept request, meet, recruit, pay wages, or respond to risk.

**Level 3 — details**

Current effect, costs, benefit, liability, equipment/assignment, pending request.

**Level 4 — history**

Prior choices and callbacks. Only one character card expands at a time on mobile.

## 12. ClickUp pages to update

- Playtesting Log → Alpha build v0.5 → Fourth Playthrough.
- Alpha build v0.5 overview.
- v0.5 Implementation Log.
- v0.5 Verification, Balance Notes, and Next Playtest.
- One Good Run — Current Build Snapshot.
- One Good Run — Known Issues + Limitations.
- One Good Run — Revision Roadmap + Tracking.
- UI / HUD Spec.
- Characters & NPCs.
- Events & Choice Branching.
- New Market Intelligence Design page under Alpha v0.5 or Events/Choice Branching.

## 13. Contained implementation plan and tests

### This pass — Phase 1 only

1. Add a pure `tradeProjection` selector using existing weighted-average inventory cost.
2. Render buy total, cash after, cargo after, and recent local price context.
3. Render sell revenue, cost basis, signed Profit/Loss, and cash after.
4. Preserve shared desktop/mobile component, tap targets, quantity controls, and confirmation visibility.
5. Add table-driven projection and weighted-average tests.
6. Add UI contract coverage for signed, text-labeled Profit/Loss.
7. Verify unchanged v3 autosave hydration.
8. Run all tests and target mobile viewports, including a reduced-height 375×560 Safari-chrome stress check.

### Later reviewed phases

- Phase 2: market intelligence state, tendencies, memory/freshness, rumors, purchasable intel, Travel disclosure.
- Phase 3: Mara invitation and Date Night category/progression.
- Phase 4: recruitment summaries and character-specific callbacks.
- Phase 5: progressive disclosure for Finance and People.

No later-phase schema or event changes will be included in this commit.
