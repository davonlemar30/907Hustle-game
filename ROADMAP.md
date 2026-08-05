# 907Hustle — Build Roadmap

Design target: `VISION.md`. What actually exists today: `PROJECT_STATUS.md`.

---

## Shipped — Alpha v0.7 (Story Engine and Identity)

Data-driven event registry with a three-tier weighted selector · Mara's six-stage
arc with three Day 7 outcomes · nine one-off street events · optional Street Name
· copy audit and rewrite of all 14 inherited events · terminology pass · title
screen responsive fix.

68 tests, 600 simulated runs, 0 dead ends. **26 of 30 distinct opening sequences**
across seeds, against exactly one under the v0.6 ladder.

**Open:** browser and mobile QA (checklist in `SIXTH_PLAYTEST_AUDIT.md`) and two
human playtests — one Spenard-resident, one travel-heavy — to settle Mara's real
frequency, which simulated bots only bracket between 0% and 64%.

---

## Shipped — Alpha v0.7.1 (Playstyle Foundation)

Completes the story and playstyle foundation. **Starting edges are preserved**
for compatibility; the classless migration is v0.8.

- **Kip Sallis** — the dealer prototype. Buy, Rob, and Ask actions on one
  persistent named NPC, so the Hustle and Stickup tracks are legible against the
  same person.
- **Dealer robbery consequences** — cash and product against injury, Heat,
  retaliation, damaged standing, and choked Spenard supply. Two-success cap,
  then he is off the board.
- **Eli's chain** to five stages, ending with whether the operation has a place
  for him after the week.
- **Dre's chain** to five stages, including a reactive beat that fires on the
  first payment.
- **Rook's chain** to six stages escalating from attention to confrontation.
- **Stickup simulation profile** — the fourth agent, dropped from v0.7 because
  Kip did not exist.
- **Branch stages** in the registry, so a chain can carry alternative beats at
  the same point.

Why Kip first: without a dealer to rob or trade with, the Stickup Track is a stat
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
  that currently calls `endRun`. The `RUN_DAYS` gates in `robberyAvailability`
  and `eliTestRouteAvailability` become "checkpoint reached" checks instead of
  "is it day 7" checks.
- **Obligations should reuse the crew-wage pattern** — `wageDue` accruing on the
  daily tick, with loyalty cost when unpaid — rather than a parallel system.
- **Multiple lenders should not ship before the anti-arbitrage rules do**, or
  borrowing from one to repay another becomes free money.
- **Jail should not ship before obligations do.** A setback is only meaningful
  once missing time actually costs something scheduled.
