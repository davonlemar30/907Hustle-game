# 907Hustle — Build Roadmap

Design target: `VISION.md`. What actually exists today: `PROJECT_STATUS.md`.

---

## Shipped — v1.15 Crew System + Curtis Ambient + Deshawn Tier 1

Branch: `claude/crew-system-improvements-z33xv6`. Built from the "v1.15 Build
Prompt" doc, reconciled onto the crew system that already existed instead of
building the spec's parallel one. Save schema v11; both sim hashes moved on
purpose; zero dead ends.

- **Crew foundations**: 0–10 loyalty (start 5, departure at 0), uniform tier
  gates (7/5d, 9/12d) in `src/data/crew.js`, tier wage curve, presence-effect
  framework, and the soldier-system schema planted as comments for the
  territory build.
- **Wages auto-deduct** at day end, dirty first, loyal first; arrears after a
  2-day grace bleed loyalty; departures free capacity on their own.
- **Curtis ambient pressure**: `curtisAwareness` 0–15 with phase floors at
  3/7/11, fed by network-channel reach, Spenard dealing volume, and robbery;
  watcher flavor text and per-phase Word Around Town texts. The Nile stays
  dark.
- **Deshawn Tier 1**: Exposure lens off the network, Night Owl offer scene
  with clean and redemption paths, de-escalation in both encounter engines,
  weekly introductions, re-arming rent grace.

### Next

- Deshawn Tier 2/3 abilities (truce with Curtis's people, autonomous
  negotiation) wait on the Curtis confrontation pipeline.
- Tone and Pherris as scene-recruited crew with their own presence effects
  (86bbe2b23, 86bbe2b20); the soldier/territory layer wakes the schema
  comments in `src/data/crew.js`.
- Curtis `approaching` phase currently sets atmosphere only — the
  confrontation build cashes it in.

## Shipped — v1.13 Criminal Economy Cluster

Branch: `claude/clickup-2kyd583p-15714-klwirj` (stacked on v1.9c). The
criminal-economy build from the queued prompt doc, renumbered from "v1.12"
because v1.12a already shipped. Save schema v10; both sim hashes moved on
purpose; zero dead ends.

- **Geography charges for crime**: per-district difficulty and heat modifiers
  for market/boost/stick, plus cross-district awareness bleed — work one
  district hard and it hardens under you.
- **The Stick track**: street robbery, weapon-gated registers, and organized
  Tier 3 jobs with casing, retaliation cards, a two-a-day ceiling, and an
  arrest stub. Goodie and the service-road envelope feed the same rep ladder.
- **Plug suspicion**: rob where a plug works and their prices rise at 3,
  supply cuts at 5; clean purchases and quiet days rebuild.
- **Slide Okafor** named as the fence; seeded boost-unlock variants; Curtis
  off fresh Hustle screens; trade-modal clamps.

### Next

- The Tier 3 arrest stub wants the full arrest/jail system (86bbamm18).
- Weapons still come only from the garage gear shop; the Gun Counter listing
  is browse-only. An acquisition path would open Stick Tier 2 earlier.
- Fairview and Mountain View exist in district data but not on the map —
  the district-content builds (86bbe2bkf, 86bbe2bmg) can now plug straight
  into the modifier table.
- Boost's caught-state still resolves by chance roll; the combat-integration
  ticket (86bbe3k0b) remains open.
- No simulation strategy works the Stick ladder yet (the spec said document,
  don't add profiles) — worth a profile once balance settles, like the Nile
  note before it.

## Shipped — v1.9c UX Polish Pass

Branch: `claude/clickup-2kyd583p-15714-klwirj`. The UX pass deferred from the
1.9 series, shipping after v1.12a. UI-only: `game-core.js` untouched, both
simulation hashes byte-identical, save schema v9 unchanged.

- **Quiet time receipts.** The action receipt renders only when it has delta
  lines; pure time passage updates the HUD pill and feed silently. The day-end
  confirmation gate stays the run's one natural pause.
- **The Phone becomes an accordion hub** — Texts, Contacts, Bills, Today's Log,
  Word Around Town — opening with only Texts expanded. Contacts reuses
  `SocialContacts` wholesale (same tier gating and `CONTACT_*` dispatches);
  Bills is a display-only obligations list (phone, rent, crew wages, debt)
  whose header badges what needs attention within two days.
- **The active job lives on Home**: employer, schedule, and a one-tap WORK
  SHIFT button on the same `WORK_JOB` dispatch as Street → Jobs, with real
  disable reasons including the previously silent energy and day-end gates.
- **Travel row renamed** so Street → Travel → Around Spenard never repeats a
  label between parent and child.

### Next

- Mark texts read: the inbox stores `read: false` but nothing flips it, so the
  Texts badge is a message count, not an unread count. A `MARK_TEXTS_READ`
  reducer case (schema-safe) would make the badge honest.
- Bills rows could deep-link to their pay surfaces once `navigate()` grows a
  Phone-section target (the shell already deep-links Home → Finances → Debt).
- The standalone Contacts screens are now redundant with the Phone section —
  removing them is a Place Shell decision, deliberately out of v1.9c scope.

## Shipped — v1.12a Home Screen Visual Overhaul

Branch: `claude/home-screen-visual-overhaul-akig08`, merged as PR #72.
Recorded here after the fact — it shipped without a ROADMAP entry.

- Home rebuilt as an atmospheric game surface: HUD bar, segmented pressure
  chips, the Spenard Road hero, three Needs Attention rows, the dominant
  Wander button, Yalonda's apartment card, and Home centred and glowing in the
  bottom bar.
- One reducer-side change (`homePriorities()` cap two → three); the 200-run
  simulation hash stayed byte-identical to v1.11's.

## Shipped — v1.11 Attribute Growth Triangle + The Nile

Branch: `codex/v1-11-attribute-growth`.

- The attribute triangle closes. Charisma and Intelligence gain three growth
  sources each, on the same `log2` curve the gym uses. v1.10's own stated gap —
  two thirds of the attribute system had no way up — is closed.
- **The Nile** opens in Spenard: Blue Nile Wellness downstairs (cheapest health
  recovery in the run, and a Charisma source), Biniam's room upstairs behind a
  vouch-only door (Tonk for Charisma, Cee-lo for Intelligence).
- **Tonk and Cee-lo are real games.** A true 52-card deck with spreads, runs, and
  drop scoring; three dice with the real combination table and odds computed off
  all 216 outcomes. The attribute buys information — tells, then hand estimates;
  a phrase for the odds, then the exact number and the press — and never touches
  a card, a die, or a payout.
- **The Nile is off Curtis's network by construction**, which makes it the one
  place a player under rival pressure can build social capital for free. Asserted
  end to end rather than trusted to the channel table.
- Selam and Biniam Tesfaye join the Exposure System with two new lens hooks:
  location-scaled weights (Selam reads violence at her own address double) and a
  zeroed source multiplier (Biniam ignores street gossip entirely).
- The abstract `spenard_gambling` stat check retired; Cal's discovery scene now
  points at the real tables.
- Save schema v9; v3 through v8 migrate.

### Next

- Charisma and Intelligence now grow but no simulation strategy works the
  wellness floor or the Night Owl social source hard enough to measure them in
  the 2,000-run report. Worth a Nile-specific profile once balance settles.
- Biniam at Trusted is a hook with no content: private high-stakes games, and
  past that the East African import network that is his actual ambition.
- Selam at Bonded (the Tudor Road expansion) is written and unbuilt.
- Rotating regulars at The Den — the trucker, the quiet one, the loud one — are
  play styles today and could carry relationship tracks.

---

## Shipped — v1.10 Unified Stat Architecture

Branch: `codex/v1-10-stat-architecture`.

- Six attributes became three (Combat, Charisma, Intelligence) and stopped being
  decorative. `resolveWithAttribute` is the only entry point for an
  attribute-modified roll: single roll at 0-2, roll twice and take the better at
  3-5, catastrophic tier removed from the pool at 6+. No percentage bonuses.
- Outcome quality now decides the observation footprint, which closes the
  pipeline the Exposure System was missing: act → attribute shapes the outcome →
  the outcome decides what is seen → observations propagate → NPCs react.
- The Spenard gym grows Combat on a `log2` curve through bag work, cardio, and
  sparring (gated at Combat 3, 15% injury). Three consecutive days banks a
  discipline bonus worth a level on the next check.
- Street Identity is derived on read from a 4×4 matrix instead of assigned
  nightly and stored. Sixteen labels, cosmetic only, gates nothing.
- Heat grew teeth in employment: warning at 8, final warning at 10, fired at 12,
  matching Yalonda's housing ladder. Day labor exempt; the Night Owl restricts
  hours rather than firing so Mina's arc survives.
- Reputation settled as a design decision rather than a feature: there is no
  global reputation stat and there will not be one.
- Intelligence narrows the 907List sell swing and surfaces an extra listing;
  standing gains brake as they climb; the zero-unit buy guard now says so.
- Save schema v8; v3 through v7 migrate, folding the six attributes into three by
  taking the highest of each merged group.

Balance moved on purpose and is reported rather than tuned around: the economy is
down 15.5% against v1.9b across 2,000 seeded runs, concentrated in `trainer`
(-49%), `mixed_freedom`/`operator` (-29%), and `thief` (-26%), against `stickup`
at +24%. Story pacing is unmoved (9.5 beats a run against 9.7) and the 907List
tier ladder holds its band. 437 tests pass, 2,000 seeded runs finish with zero
dead ends. New baselines: `--total 200` `77b09d7b…`, `--total 2000` `8f68db01…`.

**Next:** growth sources for Charisma and Intelligence — the gym only trains
Combat, so two thirds of the attribute system currently has no way up.

## Shipped — v1.9b 907List Tiered Broker System

Branch: `codex/v1-9b-907list-broker`.

- 907List went from a risk-free money printer to a three-tier legal hustle:
  Scrapper (2 blind listings, Spenard only, post and pray), Flipper (the laptop:
  4 listings with condition and seller reliability, Downtown at +30% margin,
  quick sell), Broker (named buyers who text, bulk lots, verified same-day
  listings).
- Asking price and true value are separate fields and the board carries junk, so
  appraisal is a real read. A flip delivered at a loss is a dispute, and two
  disputes close Broker standing for the run.
- Time slot economy: a buy costs a part of the day, posting is free, delivery
  costs another the next morning, a quick sell trades 20% for the same slot.
- Contextual robbery risk, shown on the page before the player commits:
  `0.03 × (carried/100) × district × time of day × (1 + heat × 0.1)`.
- Every market roll hashes the seed instead of drawing from `run.rngState`, so
  outcomes are stable across replays of the same day.
- Exposure integration: clean flips to the household, robberies to the
  neighborhood, held stock noticed weekly, Broker standing to reputation.
- Save schema v7; v3 through v6 migrate.

Measured over 2,000 seeded runs: Tier 1 **$37.9/day** (target $30–50) and Tier 2
**$71.3/day** (target $60–100) both land in band. Tier 3 lands at **$34.2/day**
against a $100–150 target — half of 907List runs reach Broker, but the ten-flip
gate opens around day 11 of a 14-day run, so there is not enough run left to earn
at that rate. Reported rather than tuned around; see README for the reasoning.

401 tests pass, 2,000 seeded runs finish with zero dead ends, and the eleven
pre-existing strategies stay within 3.5% of their v1.9a averages. New baselines:
`--total 200` `d4474787…`, `--total 2000` `ddd76695…`.

**Next:** the stat architecture and attribute pass, which the robbery formula's
escape-chance hook is already waiting on.

## Shipped — v1.9a Exposure System and Bug Fixes

Flat relationship integers replaced by per-NPC observation ledgers read through
personality lenses · eleven observation categories, four archetypes, five gossip
channels, six disposition bands · clamped logarithmic diminishing returns · heat
above 8/10/12 propagates to household/neighborhood/network · save schema v6 ·
Start-control disabled state and one-way Downtown both fixed · dev-only ledger
inspector. 377 tests; 2,000-run baseline
`3e0b84f6d2856ddf292eed0aadeb5a5e8d46540ef215d8ac3d8efb30590453f1`.

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
