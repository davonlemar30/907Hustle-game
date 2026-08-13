# Street Read — Progression Design

## Implemented in Alpha v0.9

All six attributes carry hidden `player.attributeProgress`. Gym progress is 3/2/1/1 across same-day sessions costing $25/$45/$75/$120. Attribute increases require 10 progress, then 18 additional, then 28 additional, and cap at 5.

`stats.streetRead = { xp, level, awards }` resets with each fresh run. Levels use 40/110/210/340 XP and deduplicated first-accomplishment awards. Street Read is displayed only under More; it does not enter the HUD, Street Identity, or Operation Score. Legal work contributes Earner behavior; property contributes Mover; family, employer, Mara, and gambling contacts contribute Connector. Gym attendance alone does not define identity, and ordinary shoplifting alone does not create Stickup.

The sections below preserve the original design rationale. Where they differ from the implementation summary above, the implemented v0.9 behavior is authoritative.

---

## Three concepts, kept separate

| Concept | What it is | Status |
|---|---|---|
| **Feature Unlocks** | What the interface reveals: Travel, People, Operations, Recovery. | Shipped — `selectors.featureAvailability`. Unchanged by this document. |
| **Street Read** | Run-scoped progress earned from meaningful action. Resets every run. | Proposed here. |
| **Operation Score** | End-of-run rating: what you built and who you kept. | Shipped — `selectors.operationScore`. |

**Street Read must never be added into Operation Score**, and the two must never
share a display surface. Street Read measures what you *did* during the week;
Operation Score measures what *survived* it. Mixing them makes both unreadable.

---

## Decision: run-scoped, not persistent

Street Read resets with every run. Persistent meta-progression is deferred, for
two reasons:

1. "One Good Run" is the premise. Carrying power between weeks contradicts it.
2. Persistent power makes Operation Score non-comparable across runs, which
   destroys it as a leaderboard measure — the thing it exists for.

If persistence ever ships, it should unlock **information, starting edges, and
cosmetics**. Never stats, never cash, never carried inventory.

---

## XP sources

First-time-only unless a cap is stated.

| Source | XP | Limit |
|---|---|---|
| First sale clearing $50 profit | 15 | once |
| First sale in each district | 12 | ×3 districts |
| First travel into each district | 10 | ×2 |
| Survive an encounter | 18 | max 3 per run |
| Complete a contact job (Eli's test route) | 25 | max 2 per run |
| Recruit a crew member | 20 | ×2 |
| Any payment to Dre | 12 | once per day, cap 3 |
| Clear Dre's note completely | 40 | once |
| Take a territory | 35 | each |
| Resolve a story-chain stage | 15 | cap 6 |
| First Rob success | 20 | once |
| First dealer robbery success | 20 | once |
| Unlock a new product access tier | 20 | each |
| Prepare the Day 7 plan | 25 | once |
| Discover a new system (first Safehouse visit, first gear purchase, first territory scout) | 8 | cap 3 |

## Anti-grind rules

- Buying awards nothing. Only **realized profit** does.
- Sales below the $50 profit floor award nothing.
- Repeat robberies of the same dealer award nothing after the first.
- Per-day caps on every repeatable source.
- No source triggers more than once per part of day.

The structure is deliberately front-loaded on *first* occurrences, so the
efficient play is to do varied things once rather than one thing repeatedly.

---

## Levels and unlocks

| Level | XP | Unlock | Kind |
|---|---|---|---|
| 1 — Oriented | 40 | Price signals show recent direction for districts you have sold in but are not standing in | **Convenience** |
| 2 — Known | 110 | "Ask around": a free action, once per day at any market, yielding one reliable rumor | **Strategic** |
| 3 — Connected | 210 | One-tap Recommended debt payment; recovery treatment costs −10% | **Convenience** |
| 4 — Established | 340 | Crew capacity 2 → 3 | **Strategic** |

The 2/2 split is deliberate. Two unlocks remove friction from things the player
already does; two change what plans are available. A ladder of pure convenience
feels like an apology for the interface, and a ladder of pure power makes the
first two days feel deliberately crippled.

---

## Open questions for the implementing pass

1. **Surfacing.** Street Read needs a home that is not the HUD (already at
   capacity) and not the end-of-run modal (owned by Operation Score). The People
   screen or the Status drawer are the candidates.
2. **Notification.** Level-ups should reuse the existing
   `announceFeatureUnlocks` log pattern rather than introducing a new modal.
3. **Save schema.** An `xp` block on `state.stats` is additive and hydrates free
   through `mergeDefaults`. No version bump required.
4. **Interaction with the story registry.** "Resolve a story-chain stage" can
   read `STORY_BY_ID[id].stage` directly; no new bookkeeping needed.

---

## Alternative worth considering first

Before building an XP bar, consider replacing it with **three competing
reputations** — Street (Rook, dealers), Straight (Mara, civilians, legitimate
work), and Paper (Dre, suppliers, buyers). Actions move one or two, often at
another's expense.

Advantages over a single ladder:

- **Grind is impossible by construction.** You cannot max all three, so there is
  nothing to farm and the anti-grind table above becomes unnecessary.
- The Hustle and Stickup tracks become *emergent* rather than declared — a
  consequence of the week's choices instead of a label on the character-select
  screen.
- It composes with what already ships: `lender.trust`, `rival.respect`, and
  `people.mara.trust` are most of the way there.

Cost: Operation Score would need rebalancing so it does not simply reward
whichever standing was pushed highest. This is a decision worth making **before**
an XP pass is built, not after.
