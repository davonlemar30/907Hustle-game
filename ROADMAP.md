# 907Hustle — Build Roadmap

Design target: `VISION.md`. What actually exists today: `PROJECT_STATUS.md`.

---

## Shipped — v1.24 First-Claim Ceremony — **Phase 4.1, and the Phase 1 asterisk is closed**

Built on `claude/v1-24-first-claim-uc4fdx`, on top of the v1.23 merge (PR #85,
`59b8865`). Save schema stays at v11 (nothing persisted — the check is a derived
read over the board); **both sim hashes byte-identical to v1.20, v1.21 and
v1.23**; zero dead ends across 2,000 runs; 798 tests passing.

The first corner the player claims stops reading like the sixth. One branch in
`CLAIM_BLOCK`, read before the ownership write, gates four things that fire once
per run: a titled consequence card ("Your Corner"), a same-day text from Deshawn
— "Word Around Town" when he is not on the roster — its own feed line, and a
`growth / first_territory` observation on the neighborhood channel so the people
who live there register it. Claims 2-6 are untouched.

**This ran six builds late, and the sequencing cost was visible in the copy.**
v1.21 wrote the lines for losing a corner and v1.23 wrote seven voices warning
about one, so the game could say a corner was threatened or gone and had nothing
to say about winning the first.

- **`pushConsequence` takes an optional fourth argument, `title`.** Additive:
  three-argument callers and cards queued in older saves are unchanged. Reserve
  it for ceremony — 4.2 and 4.3 are the same shape of moment.
- **A neighborhood broadcast cannot be located at a block id.** The channel
  checks presence and `NPC_PRESENCE_AREAS` holds district ids only, so a block id
  filters out every listener and lands in zero ledgers. The spec asked for one;
  it ships at `HOME_DISTRICT_ID` with the corner named in the copy instead.
  v1.23 hit the same wall from the other side — **this has now cost two builds**,
  and the suite asserts against it so it does not cost a third.
- **The simulator's territory blindness is worse and more specific than
  recorded.** All **thirteen** strategies claim zero blocks across 2,000 runs,
  not only `operator`. And `operator` does not fail at the claim gate: over 200
  runs it never buys the garage and never recruits anybody, so it dies at the
  *first* prerequisite. **Getting a strategy to buy North Star Garage is the
  blocker**, and it is upstream of everything the 2.2 balance pass needs to see.

## Shipped — v1.23 Attack Telegraphing Through Gossip Channels — **Phase 2.3**

Friendly NPCs warn the player through the gossip system before Curtis's nightly
moves resolve. `curtisNightPlan` (the Phase 2.2 planner, built here because v1.22
never shipped) names the corners and how hard; a `territory / curtis_move_planned`
observation carries it on the neighborhood channel; the closest NPC at **Warm** or
above texts on the morning of. Below Warm is silence, and the silence is the
mechanic. Deshawn widens the scope, adds the pressure read, and pulls delivery to
the evening before. Police raids get reactive morning-after gossip from the same
surface. `curtisBlockTargets` and `curtisMoveChance` are reconciled onto the one
list, closing the v1.21 note that at ambient Pherris could warn about a corner
Curtis cannot take.

**Still open from Phase 2.2:** the balance pass on Curtis's pressure budget. The
allocation (`ambient [1]`, `watching [2, 1]`, `approaching [2, 2, 1]`) is a first
authored position, not a measured one.

## Shipped — v1.21 Police Raids and Curtis Moves Split — **Phase 2.1**

Built on `claude/v1-21-raid-split-w86iuj`, on top of the v1.20 merge (PR #83,
`43652c3`). This is task **2.1** of the Godfather adaptation phase list. Save
schema stays at v11 (the split changes nightly resolution, not state shape);
**both sim hashes are byte-identical to v1.20**; zero dead ends across 2,000
runs; 733 tests passing.

- **One blended roll became two independent passes.** Police read Heat and
  `patrolFrequency`, cost people and Heat, and never take a corner. Curtis reads
  `curtisVisibility` and his awareness phase, takes the corner, and costs no
  Heat. Both live in the same `resolveSoldierOperations` — no parallel nightly
  function.
- **`curtisVisibility` gained its first offense-side reader.** Before this build
  it only weighted Eli's defensive placement; the stat that describes exposure to
  Curtis's network did nothing about Curtis.
- **Phase-gated targeting** (`CURTIS_PHASE_VISIBILITY_GATE`): nothing below
  `ambient`, visibility 2+ at `ambient`, 1+ at `watching`, everything at
  `approaching`. **Spenard Rec Center Lot (visibility 0) is never his** — a
  stated design position, written into ARCHITECTURE rather than left emergent.
- **Claiming without defending stopped being free.** Curtis takes empty corners
  at twice the defended rate; a second posted soldier still halves the risk.
- **Territory now feeds his awareness.** A lost corner is a `defiance` row on
  `network`, so it raises `curtisAwareness` by 1 — bounded at +6 across the map,
  still decaying on quiet days. This is the escalation fuel 2.2 burns.
- **Measured off-sim, per phase.** The A/B harness reports the two adversaries
  separately and sweeps all four phases. Police rate is **flat across phases**
  (0.171 / 0.171 / 0.170 / 0.169) while Curtis climbs (0 / 0.018 / 0.047 /
  0.069) — the decoupling, visible in one table. Per corner at `watching`, Motel
  Row tops Curtis targeting (0.097) and the Service Road Chokepoint tops police
  raids (0.198): two adversaries, two different corners.
- **The 15% parity criterion was not met at a single phase, and the build says
  so.** Against v1.20's 0.435 baseline on identical corners: −100% / −20% / +37%
  / +64% by phase. Parity is nearest `ambient`, not `watching` as projected,
  because corners sit empty most nights and undefended corners cost double.

### Next

- **Phase 2.2, the Curtis planner.** It now has a targeting system to plug into
  rather than one to invent: `curtisMoveChance` already decides which corners are
  on his map at a given phase, so the planner's job is choosing among them and
  spending pressure, not deciding whether pressure exists.
- **The whole loss curve may want to shift one phase cooler.** A one-constant
  change (`CURTIS_BASE_CHANCE` 0.12 → ~0.09) would put parity at `watching`
  where the build prompt expected it. Deliberately not taken here — it is a
  balance decision, not a bug fix, and it should be made with 2.2's pressure
  costs on the table.
- **The `operator` strategy still never reaches territory.** Unchanged from
  v1.20 and now more load-bearing: the block layer has twice the balance surface
  and the 2,000-run instrument still cannot see any of it.

---

## Shipped — v1.20 Lieutenant Typed Modifiers on Soldiers — **Phase 1 closed**

Merged as PR #82 (`1a9a099`). Branch:
`claude/v1-20-lieutenant-modifiers-3lwvkk`, on top of the v1.19 merge (PR #81).
This is task **1.4** of the Godfather adaptation phase list, and the last of
Phase 1: 1.1 Tone (v1.18), 1.2 Pherris and 1.3 Deshawn (v1.19), 1.4 the
modifiers (v1.20). **4.1 First-claim moment** — the ceremony item the phase list
wanted shipped alongside Phase 1 — was the honest asterisk on "Phase 1 done"
until it shipped in v1.24, six builds later. Save schema stays at v11 (nothing new persisted — every modifier is
derived); both sim hashes moved for telemetry only and hash byte-identical to
v1.19 with the new keys stripped; zero dead ends across 2,000 runs; 699 tests
passing.

- **Each Made Man owns one number on the guard layer.** Tone multiplies the
  defense strength of posted soldiers (1.15 / 1.30 / 1.50), Pherris raises the
  block-intel ladder (levels 1-3), Deshawn cuts the territory heat trickle
  (0.80 / 0.60 / 0.40). Combat, Intelligence, Charisma — the attribute mapping
  is thematic for now.
- **A lieutenant is a typed modifier on the guard layer, never a parallel
  roster.** The reconciliation note in `src/data/crew.js` predicted this shape
  and now describes what shipped.
- **Soldier headcount finally matters to block retention.** Block loss is
  `0.35 / defenseStrength`, so the second soldier on a corner halves it. Before
  this build a second soldier only gave the raid another name to take.
- **Territory ownership costs ambient Heat for the first time**, in one place,
  and a player holding nothing never rolls it.
- **Measured off-sim.** No sim strategy reaches the block layer — `operator`
  claims zero blocks in 2,000 runs — so `tests/measure-lieutenant-modifiers.js`
  is the instrument. Tone: block-loss **0.449 → 0.288**. Deshawn: average peak
  Heat **11.36 → 9.96**.

### Next

- ~~Splitting police raids from Curtis moves (Phase 2.1)~~ — **shipped in
  v1.21**, above. The Curtis planner (Phase 2.2) landed inside **v1.23** and references both
  Tone's multiplier and the new `curtisMoveChance` targeting as the things to
  work against.
- **The `operator` strategy never reaches territory.** Until a sim strategy
  actually claims a corner, the block layer's balance is invisible to the 2,000-
  run instrument and only the A/B harness can see it. That is the highest-value
  simulator work outstanding.
- A Made Man at tier 2+ becoming a block's `managerId`, with per-block flavor on
  the manager on top of these operation-wide modifiers.
- Intel *sources* beyond Pherris (disclosure tables, NPC one-shots) on the same
  ladder — Phase 3.

---

## Shipped — v1.19 Observation-Gated Recruitment — Pherris + Deshawn Retro-Gate

Branch: `claude/v1-19-pherris-deshawn-gates-hrl444`, on top of the v1.18 merge
(PR #80). Save schema stays at v11 (additive); both sim hashes moved on purpose;
zero dead ends across 2,000 runs; 676 tests passing.

- **Pherris is earned through the market.** A lens that counts money moving
  quietly, the channels of someone who *is* a network, and a `pherris_recruit`
  card with no area restriction, because she is the one person on the roster who
  works both districts. The `pherris_offer` booth scene about who owns her list
  survives as a separate beat.
- **907List profit now travels on `network` as well as `household`.** Until this
  build the only financial channel in the game was the one the player lives on,
  so the people who trade in money for a living could never hear about the
  money. Curtis's existing $200 filter keeps it honest — small flips stay a
  household fact, and a day big enough for Pherris to notice is a day his people
  notice too.
- **`intel_advantage` is the market half of Tone's `combat_advantage`**, capped
  and applied the same way: one effective level of Intelligence on the 907List
  meetup roll and on the sale swing.
- **Deshawn's tiers read his own ledger.** Tier 2 was an unconditional pass and
  tier 3 waited on a Curtis pipeline that was never built. Trusted and Bonded
  now, on the lens he already had. **After this build no crew advancement in the
  game runs on a flat counter.**
- **The de-escalation migration ROADMAP flagged at v1.18 is done**, and it was
  measured on its own commit first: both hashes byte-identical. It is not
  behavior-identical in principle — an arrested Deshawn no longer de-escalates —
  and that case is pinned by a unit test the simulation cannot reach.
- **Her `minScore` was measured, not designed.** Numbers in README.md and
  ARCHITECTURE.md.

### Next

- Lieutenant typed modifiers on soldiers (Phase 1.4): a Made Man at tier 2+
  becoming a block's `managerId`, with domain flavor on the manager rather than
  on the guard. **The modifier half shipped at v1.20**; the `managerId` half is
  still open.
- `curtisAwareness` still averages 0.33 of 15 across 2,000 runs. The new network
  broadcast feeds it for the first time from clean money, but the `watching`
  phase and everything behind it stay effectively unreachable.
- `crew.trucesBrokered` is still incremented by `BROKER_CURTIS_TRUCE` and no
  longer gates anything. Left in place as save state for a future gate.

---

## Shipped — v1.18 Observation-Gated Recruitment — Tone

Branch: `codex/v1-18-tone-recruitment`, on top of the v1.17 docs merge (PR #79).
Save schema stays at v11 (additive); both sim hashes moved on purpose with
eleven of thirteen strategies byte-identical; zero dead ends.

- **Tone is recruited by proof, not by a flat gate.** A lens that scores nerve
  and nothing else, channels that decide what reaches him, and a `tone_recruit`
  card that fires when his ledger reads far enough past Warm. The garage-door
  `tone_offer` introduction survives as a separate beat.
- **The eligibility-predicate pattern** (`RECRUITMENT_PROOF` +
  `recruitmentEligible`) is the reusable piece. Pherris recruitment (v1.2) and
  Deshawn tier retro-gating (v1.3) are data edits on top of it.
- **The presence-effect framework is wired for the first time.** It had been
  declared and never called; Tone's combat advantage runs through it as one
  effective attribute level, excluded from Curtis-crew encounters.
- **The awareness gate the build prompt specified was measured and dropped** —
  it fired the card zero times in 2,000 runs. Numbers in ARCHITECTURE.md.

### Next

- Feed `curtisAwareness` well enough that it can gate content. Today it averages
  0.32 of 15 across 2,000 runs, so anything behind the `watching` phase is
  effectively unreachable — that includes the watcher encounters it already owns.
  *(v1.19 gave it a first clean-money source; the average moved to 0.33.)*
- Migrate Deshawn's three hardcoded de-escalate sites onto `presenceEffectsFor`
  now that the framework has a live caller. Deliberately out of scope for v1.18.
  *(Done in v1.19.)*

---

## Shipped — v1.17 Voice & Copy Polish + Market Button Fix + CSS Fix

Branch: `claude/clickup-2kyd583p-15874-hxww66` (PR #78, `main` HEAD). Save
schema stays at v11; **both sim hashes byte-identical to v1.16** because the
reducer was never touched; zero dead ends.

- **Voice pass on the system feed**: arrest banks, crew events, market feed,
  and hybrid popups stop reporting mechanics and start reporting behavior.
  Event-card previews keep numbers only for HUD-visible cash, Health, and Heat.
- **The Leave Market button is gone.** The shell fires the same `END_MARKET` on
  nav-away, gated on the visit having traded, so window shopping is free.
- **CSS tone aliases restored** (`--text/--good/--warn/--bad`), bringing back
  consequence-card severity stripes broken since v1.11.
- **Mina Vale gets a conversation tree** (`src/data/mina.js`): a pool per
  disposition band, split by shift, with state-reactive pools and a three-visit
  no-repeat window. Her trust, exposure, and story cards are untouched.
- **The criminal economy speaks Anchorage**: boost and stick targets carry
  one-line identity reads, plug intros name their corners. Numbers untouched.

### Next

- Mina's romance-arc mechanics (only her dialogue voice ships here).
- The new plugs (Nell, Yuri).
- Numeric labels on the crew roster and Status screens go numeric-on-demand,
  per the mechanical-labels design-debt task.

## Shipped — v1.16 Arrest & Jail + Boost Caught-State

Branch: `claude/clickup-task-implementation-nneqd1` (PR #77). Save schema stays
at v11 (all fields additive); both sim hashes moved on purpose; zero dead ends.

- **Arrest resolves heat and replaces it with a record.** `arrestPlayer` is the
  one funnel: bail, a processing cost in parts of day, a severity-scaled heat
  relief, a permanent charge on `state.record`, and a network broadcast that
  feeds Curtis's awareness. Numbers live in `src/data/arrest.js`.
- **Priced against farming**: relief runs −2 to −5, priors raise bail to 3.5×
  and lengthen processing, and a broke player converts the shortfall to time
  rather than soft-locking.
- **All three Stick tiers route through it**, retiring v1.13's flat $200 stub.
- **Crew go to jail** with severity-scaled sentences, and `releaseServedCrew`
  repairs the v1.15 bug where an arrested member had no way back.
- **A blown boost is a fight / run / give-it-up scene** through the consequence
  engine, at every tier, instead of an auto-resolved log line.

### Next

- Multi-day player sentences wait on a skip-N-days UX that does not exist.
- Lawyers as a service, police as a named faction, and arrest-to-job-loss
  beyond `applyHeatEmployment` are all still unbuilt.

## Shipped — v1.14 UI Architecture

Branch: `claude/clickup-2kyd583p-15794-voye0b` (PR #75). A presentation build —
`game-core.js` untouched, so the save schema and **both sim hashes are
byte-identical to v1.13's**.

- **Three primitives extracted** into `src/ds/primitives.jsx`
  (`AccordionSection`, `ActionCard`, `BadgeHeader`) with prop contracts,
  replacing the private implementations they were pulled from.
- **Travel collapses to three destinations** — Spenard, Home, Leave Spenard —
  with fares and blocking reasons stated on the row.
- **Local Intel becomes content** on the neighbourhood hub; the Listings page,
  two-thirds placeholder and unreachable after the Travel change, is deleted.
- **Tonk plays fullscreen**, and a hand that ends always prints its receipt.

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
- Pherris as scene-recruited crew with her own presence effects (86bbe2b20).
  Tone shipped at v1.18 and is the pattern she reuses.
  Note the soldier layer this entry expected to "wake"
  already existed under Eli (`world.soldiers`, `world.territoryBlocks`) — the
  reconciliation, not a second schema, is what `src/data/crew.js` now describes.
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

- ~~The Tier 3 arrest stub wants the full arrest/jail system (86bbamm18).~~
  **Shipped in v1.16** — all three tiers route through `arrestPlayer`.
- ~~Boost's caught-state still resolves by chance roll (86bbe3k0b).~~
  **Shipped in v1.16** as a fight / run / give-it-up encounter.
- Weapons still come only from the garage gear shop; the Gun Counter listing
  is browse-only. An acquisition path would open Stick Tier 2 earlier.
- Fairview and Mountain View exist in district data but not on the map —
  the district-content builds (86bbe2bkf, 86bbe2bmg) can now plug straight
  into the modifier table.
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

The near arc is **the Godfather adaptation**: the run stops being a week of
hustling and becomes an organization with a rival who plans back. One line each,
in rough order — the specs come when the build does.

- **Territory expansion** — blocks beyond Spenard, so Downtown and Industrial
  get the layer Spenard already has.
- **Curtis planner** — Curtis acts on a plan of his own instead of reacting to
  awareness thresholds, and the `approaching` phase finally cashes in.
- **Intel economy** — information becomes a thing you buy, trade, and get fed
  badly on, rather than a passive Street Read tier.
- **Combat system** — the encounter engine grows into something a territory war
  can actually resolve through.

Still queued behind those, unchanged: expanded transportation · car ownership
and upkeep · multiple lenders with anti-arbitrage rules · regular employment ·
additional romantic interests · new Anchorage districts · Mat-Su and regional
travel · open-ended continuation past Day 7 ("Keep Moving").

### Sequencing notes

- **"Keep Moving" has one clean hook**: the `finalSlot` branch in `advanceRun`
  that currently calls `endRun`. The `RUN_DAYS` gates in `robAvailability`
  and `eliTestRouteAvailability` become "checkpoint reached" checks instead of
  "is it day 7" checks.
- **Obligations should reuse the crew-wage pattern** — `wageDue` accruing on the
  daily tick, with loyalty cost when unpaid — rather than a parallel system.
- **Multiple lenders should not ship before the anti-arbitrage rules do**, or
  borrowing from one to repay another becomes free money.
- **Territory expansion should reuse the block layer, not fork it.** Block ids
  are already globally unique and `districtHasBlockLayer` is the only gate — a
  second district is data plus flipping that predicate, and anything more means
  the abstraction was wrong.
- **The Curtis planner wants the awareness tracker as its input**, not a new
  number. `curtisAwareness` already knows how visible the player is; a planner
  reads it and decides, rather than measuring visibility a second way.
