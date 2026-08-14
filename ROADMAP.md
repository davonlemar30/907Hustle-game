# 907Hustle — Build Roadmap

Design target: `VISION.md`. What actually exists today: `PROJECT_STATUS.md`.

---

## In progress — v1.9a Exposure System and Bug Fixes

Branch: `codex/v1-9a-exposure-system`. Under review, not yet merged.

- Flat relationship integers replaced by per-NPC observation ledgers read through
  personality lenses; disposition is derived, never stored.
- Eleven observation categories, four archetypes with per-character overrides,
  five gossip channels, six shared disposition bands.
- Clamped logarithmic diminishing returns, with betrayal exempt and missed
  obligations escalating.
- Heat above 8 / 10 / 12 propagates to household / neighborhood / network,
  closing the connection the v1.8.1 audit filed as absent.
- Save schema v6; v3, v4, and v5 migrate, converting old relationships into
  ledger entries.
- Two blockers fixed: the Start control now shows its disabled state and says
  why, and the destination list is relative to where the player stands so
  Downtown is no longer one-way.
- Dev-only ledger inspector behind `localStorage 907_exposure_debug`.

Gameplay changed on purpose, so the simulation hash moved. New 2,000-run
baseline `3e0b84f6d2856ddf292eed0aadeb5a5e8d46540ef215d8ac3d8efb30590453f1`;
377 tests pass; 2,000 seeded runs finish with zero dead ends; overall economy
within 3.3% of v1.8.1.

**Next:** v1.9b, the 907List tiered broker system, which depends on the
Exposure integration points this build ships.

## Shipped — v1.8.1 (Refactor, Code Hygiene, and Architecture Prep)

Runtime Babel removed for an esbuild bundle · title art down 96.5% on phones ·
`game-core.js` split into `src/data/` and `src/events/` · one event eligibility
gate · ~11MB of dead files deleted · `ARCHITECTURE.md` added. No gameplay
change: the 2,000-run hash was identical to v1.8.

## Shipped — v1.8 (Character, Relationship, and Hustle Rework)

Final character identities across all copy · Mina's six-scene Night Owl arc ·
Curtis's exposure/tax/friendship/betrayal paths · Dre's loans, missions, and
Shark track · Goodie reduced to dealer-only · Simone added · one-active-employer
job model · Market/Boost/Stickup/Shark consolidated under Hustle · save v5.

## Shipped — v1.7 (Character Rework, Obligation Layer, and Social Gating)

Yalonda and Juan replace the John/spouse placeholders · Places and Activities
split · shared Contacts surface · phone bill as the first obligation · weekly
rent · 907List gated behind social discovery · save v4.

## Shipped — v1.4 through v1.6

Week Zero and the classless opening (v1.4) · job variety, Contacts, and Downtown
scaffolding (v1.5) · the `playSound` crash fix and the UX/presentation pass
(v1.6).

## Shipped — Alpha v0.9 (Fresh Start and Daily Life)

Fresh Anchorage arrival at the family home · fixed $1,200 Day 7 note · household trust, storage, discovery, warnings, and eviction · Day 1 work, exploration, training, gambling, shoplifting, transit, and listings · optional $650 garage · hidden attribute progress · run-scoped Street Read · fresh Mina/Goodie/Curtis continuity · additive legacy hydration.

97 tests and 2,000 simulated runs pass with zero dead ends. Ten responsive viewports pass automated rendered checks. **Open:** three complete human-style seven-day runs and a rendered save/title/load traversal.

## Shipped — Alpha v0.7 (Story Engine and Identity)

Data-driven event registry with a three-tier weighted selector · Mina's six-stage
arc with three Day 7 outcomes · nine one-off street events · optional Street Name
· copy audit and rewrite of all 14 inherited events · terminology pass · title
screen responsive fix.

68 tests, 600 simulated runs, 0 dead ends. **26 of 30 distinct opening sequences**
across seeds, against exactly one under the v0.6 ladder.

**Open:** browser and mobile QA (checklist in `SIXTH_PLAYTEST_AUDIT.md`) and two
human playtests — one Spenard-resident, one travel-heavy — to settle Mina's real
frequency, which simulated bots only bracket between 0% and 64%.

---

## Shipped — Alpha v0.7.1 (Playstyle Foundation)

Completes the story and playstyle foundation. **Starting edges are preserved**
for compatibility; the classless migration is v0.8.

- **Goodie** — the dealer prototype. Buy, Rob, and Ask actions on one
  persistent named NPC, so the Hustle and Stickup tracks are legible against the
  same person.
- **Dealer robbery consequences** — cash and product against injury, Heat,
  retaliation, damaged standing, and choked Spenard supply. Two-success cap,
  then he is off the board.
- **Eli's chain** to five stages, ending with whether the operation has a place
  for him after the week.
- **Dre's chain** to five stages, including a reactive beat that fires on the
  first payment.
- **Curtis's chain** to six stages escalating from attention to confrontation.
- **Stickup simulation profile** — the fourth agent, dropped from v0.7 because
  Goodie did not exist.
- **Branch stages** in the registry, so a chain can carry alternative beats at
  the same point.

Why Goodie first: without a dealer to rob or trade with, the Stickup Track is a stat
spread on a character-select screen rather than a way to play.

---

## Shipped — Alpha v0.8 (Classless Foundation)

- Remove edge selection for new saves; keep Street Name.
- Six attributes at 2 each, with Combat, Charisma, and Intelligence becoming
  **derived selectors** rather than stored values.
- Behavior ledger and earned Street Identity across the five categories.
- Nightly identity evaluation with the 25% lead, minimum margin, and
  two-consecutive-nights rules.
- Identity-aware dialogue and event eligibility.
- Old edge-based saves keep loading.

**Migration note:** only 18 sites read the three current ratings, so this changes
one derivation function rather than every call site.

88 tests and 800 simulated runs pass with zero dead ends. Manual browser QA remains open and is recorded honestly in `SEVENTH_PLAYTEST_AUDIT.md`.

---

## Alpha v0.9 — Street Read and Daily Life

- Street Read implementation, per `PROGRESSION_DESIGN.md`.
- One job: Ship Creek Day Labor.
- One gym or training location.
- The Spenard dice game.
- One shoplifting location.
- Bus-pass access.

Each prototype stays small and interconnected. **Density before size** — Spenard
should be worth walking around before a second district gets built out.

---

## Later builds

Expanded transportation · car ownership and upkeep · arrest and jail · multiple
lenders with anti-arbitrage rules · regular employment · additional romantic
interests · new Anchorage districts · Mat-Su and regional travel · open-ended
continuation past Day 7 ("Keep Moving") · larger gang and territory management.

### Sequencing notes

- **"Keep Moving" has one clean hook**: the `finalSlot` branch in `advanceRun`
  that currently calls `endRun`. The `RUN_DAYS` gates in `robAvailability`
  and `eliTestRouteAvailability` become "checkpoint reached" checks instead of
  "is it day 7" checks.
- **Obligations should reuse the crew-wage pattern** — `wageDue` accruing on the
  daily tick, with loyalty cost when unpaid — rather than a parallel system.
- **Multiple lenders should not ship before the anti-arbitrage rules do**, or
  borrowing from one to repay another becomes free money.
- **Jail should not ship before obligations do.** A setback is only meaningful
  once missing time actually costs something scheduled.
