# 907Hustle: One Good Run — Project Status

Last updated: 2026-08-17 (America/Anchorage)

**v1.21 is built on `claude/v1-21-raid-split-w86iuj`, on top of the v1.20 merge
(PR #83, `43652c3`).** Verified on the branch: `npm test` 733 passing,
`npm run build` clean, 2,000-run simulation with zero dead ends, `--total 200`
`c8b3bf0745871555c326f4861b0a8d576ce149c9fa7bd871e9215b51236092d8`,
`--total 2000` `d9d0fbf1d24c1c7cca8db9db7897f044811a46c4d41ff6a23ca678a0dc3dfb39`
— both **byte-identical to v1.20**, which is the check that matters for a change
this deep in nightly resolution.

**Phase 1 of the Godfather adaptation is closed** — 1.1 Tone recruitment
(v1.18), 1.2 Pherris recruitment and 1.3 Deshawn tier retro-gate (v1.19), 1.4
lieutenant typed modifiers (v1.20). The one Phase 1 companion item still open is
**4.1 First-claim moment**, the ceremony pass the phase list wanted alongside the
mechanic. **Phase 2.1 (splitting police raids from Curtis moves) ships in
v1.21.** Next is 2.2, the Curtis planner, which now has a targeting system to
plug into: `curtisMoveChance` already decides which corners are on his map, so
the planner's job is choosing among them rather than inventing the notion.

## v1.21 Police Raids and Curtis Moves Split — built (branch `claude/v1-21-raid-split-w86iuj`)

- Built from the "v1.21 Build Prompt: Split Police Raids from Curtis Moves"
  spec, on top of the v1.20 merge (PR #83, `43652c3`). **Save schema stays v11**
  — the split changes nightly resolution, not state shape, so there is nothing
  new to persist and nothing to migrate.
- **The problem.** One blended roll decided both "the police busted your corner"
  and "Curtis took your corner". Heat therefore governed how much territory the
  player kept, a player who went quiet still lost corners at the same rate, and
  `curtisVisibility` — the stat describing exposure to Curtis's network — had no
  offense-side reader at all. The player could not reason about either threat
  separately because they were not separate.
- **Two passes, one function.** `resolveSoldierOperations` is still the single
  integration point. Per block, in order: income, then a **police** roll on
  staffed corners, then a **Curtis** roll on every corner the player holds.
  - **Police** read Heat and `patrolFrequency`, discounted by Eli. They cost a
    soldier and +1 Heat, write `heat_exposure / police_raid` on the
    `neighborhood` channel, and **never change who owns the corner**.
  - **Curtis** reads `curtisVisibility` and his awareness phase, divided by the
    garrison. He takes the corner, costs **no Heat**, and writes
    `defiance / block_lost_to_curtis` on `network`.
- **Constants** live in the new `src/data/territory.js`, a leaf that requires
  nothing. Two deviations from the spec, both measured before being taken:
  `POLICE_ELI_DISCOUNT` is **0.015**, not the old 0.05 — against a 0.04 base and
  0.03 patrol weight, 0.05 per point clamps a quiet patrol-1 corner to exactly
  zero, so Eli would make a block literally un-raidable; and
  `CURTIS_BASE_CHANCE` is **0.12**, not 0.06, because the divisor includes
  headcount. At two posted soldiers the two cancel and the block sits where a
  single 0.06 roll put it, which keeps v1.20's promise that a second soldier
  halves the risk — and makes an *undefended* corner the one that costs double.
- **Phase-gated visibility.** `CURTIS_PHASE_VISIBILITY_GATE` is a floor on
  `curtisVisibility`, not a scale: `invisible` 99, `ambient` 2, `watching` 1,
  `approaching` 0. Spenard Rec Center Lot (visibility 0) is **never his at any
  phase** — the multiplier zeroes it even where the gate lets it through. The
  police still raid it. Stated as a design position, not left emergent: the
  quiet lot is the safe, low-earning corner.
- **Both gates are hashed, not drawn**:
  `stringHash(seed:raid:blockId:day:police|curtis)`. Different salts, so a
  corner can take a raid and lose the block the same night. Hashing is what lets
  a second pass exist without shifting the tick's RNG stream, and what makes a
  reloaded save replay the night instead of rerolling it.
- **Curtis now escalates off territory.** A lost corner is a `defiance` row on
  `network`, which clears his filter, so it routes through `broadcastTracked` and
  raises `curtisAwareness` by 1. Losing corners makes him hunt harder — bounded
  at +6 (the map is six corners) and still bleeding back down on quiet days.
  This is the fuel the 2.2 planner burns.
- **Modifier mapping.** Tone divides both passes (police through the shared
  `takeRaidCasualty`, Curtis as a divisor on whether he comes). Eli discounts
  the police roll only. Deshawn touches neither directly — his heat reduction
  lowers Heat, which lowers the police chance, emergent and correct.
- **UI**: the report card's `severe` check was dead code — it read
  `state.log[0]`, which is whatever `applyPressure` logged after this pass, so
  `.report-card.severe` had never rendered. It now reads the report line itself.
  One phone text per adversary per night and one consequence card, so a
  six-corner disaster is 2 texts and 1 card, not 12 and 6.
- **Both simulation hashes are byte-identical to v1.20**, which is a stronger
  claim than v1.20 could make. No sim strategy reaches the block layer, so this
  pass draws nothing from the tick's RNG before or after. The behavior is
  measured by `tests/measure-lieutenant-modifiers.js` instead, which now reports
  police and Curtis rates separately and sweeps all four phases.
- **Measured, 200 runs x 10 nights, same three corners as v1.20's A/B**
  (v1.20 baseline block-loss rate: **0.435**):

  | Phase | Block loss | Police raids/block-night | Curtis flips/block-night | Peak Heat | vs v1.20 |
  |---|---|---|---|---|---|
  | `invisible` | 0.000 | 0.136 | 0.000 | 11.32 | −100% |
  | `ambient` | 0.348 | 0.145 | 0.042 | 10.23 | −20% |
  | `watching` | 0.598 | 0.154 | 0.085 | 9.45 | +37% |
  | `approaching` | 0.715 | 0.157 | 0.116 | 8.71 | +64% |

  **The 15% parity criterion is not met at a single phase, and that is the
  honest result.** Parity lands nearest `ambient` (−20%), not `watching` as the
  build prompt projected. The projection assumed corners stay staffed; they do
  not — 5.4 of 6 soldiers are lost per run, and an empty corner is twice as easy
  for Curtis to take, so the undefended rate dominates the average. The gradient
  itself is clean and monotonic and is what the build exists to create: quiet
  players keep corners, watched players lose them. Whether the whole curve should
  shift one phase cooler is a one-constant tuning call
  (`CURTIS_BASE_CHANCE` 0.12 → ~0.09) deliberately left for a balance pass.
- **Per corner at `watching`, six blocks held** — the split doing its job is
  that the two columns name *different* corners:

  | Block | vis | patrol | Police/bn | Curtis/bn |
  |---|---|---|---|---|
  | Wash & Go Lot | 1 | 1 | 0.155 | 0.020 |
  | Fourth Avenue Strip | 2 | 2 | 0.188 | 0.069 |
  | Minnesota Off-Ramp | 1 | 1 | 0.148 | 0.037 |
  | Spenard Rec Center Lot | 0 | 1 | 0.153 | **0.000** |
  | Northern Lights Motel Row | 3 | 2 | 0.174 | **0.097** |
  | Service Road Chokepoint | 2 | 3 | **0.202** | 0.089 |

- **Tests**: `tests/v1-21.test.js`, 34 new tests — the two chance formulas
  across every input, both gates' independence, phase gating at all four phases,
  outcome separation (police adds Heat and keeps the corner, Curtis takes it and
  adds none), the escalation bound, message volume, and the v11 round trip.
  Total **733 passing**. Four v1.20 tests moved onto `curtisPhase: "watching"`
  (below it every Curtis number is structurally zero, so the tier comparisons
  would have passed on nothing), and `game-core.test.js`'s block-loss invariant
  now forces the loss with awareness rather than Heat, because Heat no longer
  causes one.

## v1.20 Lieutenant Typed Modifiers on Soldiers — merged (PR #82, `1a9a099`)

- Branch: `claude/v1-20-lieutenant-modifiers-3lwvkk`, on top of the v1.19 merge
  (PR #81, `11ec2ef`). Built from the "v1.20 Build Prompt: Lieutenant Typed
  Modifiers on Soldiers" spec. **Save schema stays v11** — every modifier is
  derived from the crew record the save already carries, so there is nothing new
  to persist and nothing to migrate.
- **The Made Men modifier triangle** lands in `src/data/crew.js`:
  `TONE_DEFENSE_MULTIPLIER` (1.15 / 1.30 / 1.50), `DESHAWN_HEAT_REDUCTION`
  (0.80 / 0.60 / 0.40), and `modifierTier()`, which draws the same
  active/loyalty line `presenceEffectsFor` does. Pherris's rung of the triangle
  is `blockIntelLevel()` in `src/selectors.js`.
- **Tone → raid defense.** `resolveSoldierOperations` now computes
  `defenseStrength = assigned.length * RAID_DEFENSE_PER_SOLDIER * tone`. Raid
  arrival is untouched; the casualty roll is `assigned.length / defenseStrength`
  (headcount cancels, so it is Tone's number alone) and the block-loss roll is
  `0.35 / defenseStrength` (headcount counts). A one-soldier block with no Tone
  is the old math exactly. A repelled raid skips the loss roll — a corner that
  was held does not change hands.
- **Pherris → intel ladder.** `flags.spenardBlocksRevealed` still reads as level
  1 on its own; with her active it is her tier. Level 2 adds soldier counts and
  a ±1 defense estimate on Curtis corners, level 3 makes it exact and adds his
  last move plus `curtisBlockTargets()` (ranked by Curtis visibility, depth
  gated by his awareness phase). Estimates are hashed from
  `seed:block-intel:blockId:day` — no `Math.random`, stable across a reload.
- **Deshawn → territory heat.** There was no ambient block-heat path before this
  build; v1.20 adds exactly one, in the same nightly pass:
  `sum(heatExposure of held blocks) * 0.06 * deshawnReduction`, one roll for +1
  Heat, capped at 0.9. Ownership costs attention, not staffing. A player holding
  nothing never rolls it, so the reduction can never leak onto criminal-action
  heat.
- **UI**: one read-only line per lieutenant on the crew detail card, shown only
  while active and holding a corner; the Spenard block card reads
  `blockIntelView` instead of the old boolean.
- **`stringHash` moved to `src/hash.js`** (a leaf that requires nothing) so the
  selectors can hash without closing a cycle through `src/events/random.js`,
  which requires the selectors for `slotNumber`. `random.js` re-exports it.
- **Both simulation hashes moved for bookkeeping only.** The simulator gained a
  `territory` telemetry block; strip it and the output is byte-identical to
  v1.19's. The finding underneath: **no sim strategy reaches the block layer** —
  `operator` claims zero blocks in 2,000 runs — so the modifiers are measured by
  `tests/measure-lieutenant-modifiers.js` instead. Tone cuts the block-loss rate
  **0.449 → 0.288** and raises territory income 28%; Deshawn cuts average peak
  Heat **11.36 → 9.96**; both strictly tier-ordered. Tone *raises* peak Heat
  (11.36 → 13.26) because saved corners keep drawing raids, which is the pairing
  the triangle is built around.

## v1.19 Observation-Gated Recruitment — Pherris + Deshawn Retro-Gate — built (branch `claude/v1-19-pherris-deshawn-gates-hrl444`)

- Branch: `claude/v1-19-pherris-deshawn-gates-hrl444`, on top of the v1.18 merge
  (PR #80, `1d51b0a`). Built from the "v1.19 Build Prompt: Observation-Gated
  Recruitment: Pherris + Deshawn Retro-Gate" spec. Save schema stays **v11** —
  `state.npc.pherris` is additive and `mergeDefaults` supplies it for any v11
  save written before this build.
- **Pherris joins the Exposure System.** Lens (`financial 4, growth 3,
  discretion 2, violence -2, defiance -1`, with a `job_lost` override so getting
  fired is not read as a credit), channels `direct/neighborhood/network`,
  presence in both districts she works, and the `state.npc.pherris` record
  without which the ledger loop would have skipped her silently.
- **907List profit broadcasts on `network` as well as `household`**, which is
  what makes her reachable at all and gives `curtisAwareness` its first
  clean-money source.
- **`pherris_recruit`** — reactive, no area, three-day rain check on decline.
  Her `minScore` of 8 was chosen against 2,000 seeded runs; the sweep is in
  README.md and ARCHITECTURE.md.
- **`intel_advantage`** — one effective level of Intelligence on the 907List
  meetup roll and the sale swing, capped at one like Tone's combat edge.
- **Tier gates**: hers read flips-or-profit then territory-plus-Broker, both
  free; Deshawn's read Trusted then Bonded on his own ledger. **No crew
  advancement in the game runs on a flat counter any more.**
- **De-escalation migrated onto `presenceEffectsFor`** (the v1.18 ROADMAP item),
  measured on its own commit as hash-neutral. One behavior moved: an arrested
  Deshawn no longer de-escalates.
- **UI**: the roster Recruit button now shows the gate reason for Tone and
  Pherris, not only Deshawn. Before this a proof-gated hire rendered an enabled
  button the reducer silently refused.
- Naming: the retired "Pherris Cole" surname is gone from player-facing copy.

## v1.18 Observation-Gated Recruitment — Tone — built (branch `codex/v1-18-tone-recruitment`)

- Branch: `codex/v1-18-tone-recruitment`, on top of the v1.17 docs merge
  (PR #79, `f4ad786`). Built from the "v1.18 Build Prompt: Observation-Gated
  Recruitment — Tone" doc.
- **Save schema stays v11** (`907ogr_v11`), additive only: `npc.tone`,
  `people.crew.*.combatWins`, and the `toneOfferDeclined` /
  `toneNextOfferDay` flags. `mergeDefaults` supplies all of them to v3–v11 saves.
- **Tone is a full Exposure citizen.** Lens (`STREET`, `violence: 3`,
  `defiance: 2`, `growth: 1`, `discretion: -2`, `submission: -3`), channels
  `direct`/`neighborhood`/`network`, evening and night hours, Spenard only. He is
  the only lens in the game that reads violence as a credit and discretion as a
  debt.
- **The eligibility-predicate pattern** ships in `src/data/crew.js`:
  `RECRUITMENT_PROOF` plus `recruitmentEligible(crewId, band, score)`. Takes the
  resolved band rather than state, so `src/data` still never reaches into
  `src/exposure`; game-core's `crewRecruitmentEligible()` does the ledger read.
  No proof entry means no gate, so Pherris (v1.2) and Deshawn tier retro-gating
  (v1.3) are data edits.
- **`tone_recruit` is a new card, not a rewrite.** `tone_offer` already existed
  as the garage-door introduction and survives untouched; the observation-gated
  scene is a second beat. Recruiting charges his number, starts him at
  `CREW_LOYALTY_START`, texts, and broadcasts `growth`/`crew_recruited` on the
  neighborhood — not the network, so hiring a guard hands Curtis nothing.
  Declining is a three-day rain check, the same shape as Deshawn's.
- **The awareness clause was measured and dropped.** The build prompt gated the
  card on `curtisAwareness >= 7`. Across 2,000 seeded runs the average awareness
  is 0.32 of 15, two runs reach the watching phase, and the card fired zero
  times — it would have shipped as content nobody sees. Gated on proof alone,
  Tone recruits in 75 of 2,000 runs across seven strategies. Details and the
  numbers are in ARCHITECTURE.md.
- **Presence effects are wired for the first time.** `presenceEffectsFor` was
  dead code; Tone's combat path now runs through it (plus a loyalty-0 guard).
  His edge is one effective attribute level via a new `bonus` argument on
  `resolveAction`, excluded from Curtis-crew encounters. Deshawn's three
  hardcoded de-escalate sites were deliberately left alone. The existing
  assignment-gated `toneNearby` +0.10 chance term is unchanged and stacks: one
  acts on the chance, the other on the outcome tier.
- **Wage curve $85 / $150 / $250.** Tier 2 needs three encounter wins his backup
  applied to (`crew.combatWins`); tier 3 still needs two controlled blocks.
- **Verification**: 637 node tests passing (36 new in `tests/v1-18.test.js`);
  `npm run build` clean; 2,000-run simulation with **zero dead ends**. Both
  hashes moved on purpose — new telemetry keys plus real gameplay in the two
  strategies that reach the gate. **Eleven of thirteen strategies are
  byte-identical**, which is the proof that the new `bonus` argument defaults to
  zero everywhere it was not passed.

## v1.17 Voice & Copy Polish + Market Button Fix + CSS Fix — shipped (PR #78)

- Branch: `claude/clickup-2kyd583p-15874-hxww66`, on top of the v1.16 merge
  (PR #77), merged to `main` as `cf20d5a`. Built from the "v1.17 Build Prompt —
  Voice & Copy Polish + Market Button Fix + CSS Fix" doc.
- **Save schema v11** (`907ogr_v11`), additive only: `nightOwl.recentMinaLines`
  (the Mina no-repeat window). `mergeDefaults` supplies it to v3–v11 saves.
- **Leave Market button removed.** The shell fires `END_MARKET` on nav-away
  from the Market, gated on `run.currentVisit.trades > 0` (the counter that
  already existed; the spec's proposed `marketVisitActions` would have
  duplicated it). Browsing without trading costs nothing. No reducer guard,
  deliberately: the sim harness and the older suites use bare `END_MARKET` as
  "stay put and advance time."
- **CSS tone aliases defined** (`--text/--good/--warn/--bad`, a v1.17 `:root`
  layer of base-palette aliases), restoring consequence-card severity stripes
  broken since v1.11.
- **Voice pass**: arrest banks, crew events, market feed, hybrid popups.
  Event-card previews keep numbers for HUD-visible cash/Health/Heat and speak
  in-world for hidden relationship state. Prose em dashes removed.
- **Mina conversation tree** in `src/data/mina.js`: pools per disposition band
  (Cold/Hostile clamp to the Neutral register), Evening vs Night shift
  registers (the Night Owl keeps Evening/Night hours), state-reactive pools
  (arrested/injured/flush), three-visit no-repeat rotation via stringHash.
  Trust, exposure, story cards, and the once-per-day gate untouched.
- **Anchorage names**: boost targets (Spenard Chevron, Rebel Convenience on
  4th, Holiday on C Street, Denali Express, Northern Lights Pharmacy, Arctic
  Cash & Carry, Ship Creek Yards, Minnesota Drive Route) and stick targets
  carry `desc` identity lines rendered in the Boost and Stickup screens; plug
  intros name their corners. Ids and balance numbers untouched.
- **Verification**: 601 node tests passing (13 new in `tests/v1-17.test.js`);
  simulation hashes byte-identical to the v1.16 baselines (`c828c00e…` /
  `5fefb813…`), zero dead ends — the reducer was not touched, so the build
  prompt's predicted hash change correctly did not happen.

## v1.16 Arrest & Jail + Boost Caught-State — shipped (PR #77)

- Branch: `claude/clickup-task-implementation-nneqd1`, on top of the v1.15 merge
  (PR #76), merged as `b3078ac`. Built from the "v1.16 Build Prompt — Caught &
  Consequences" doc.
- **Save schema stays at v11** (`907ogr_v11`). Every field is additive —
  `state.record` (`arrests`, `lastArrestDay`, `charges[]`),
  `run.pendingArrestSlots`, `boost.pendingCaught`, and the crew
  `jailedUntilDay` / `jailedSeverity` pair — so `mergeDefaults` supplies them to
  v3–v11 saves with no migration pass.
- **`arrestPlayer` is the single funnel** for every arrest: charges bail (dirty
  cash first), returns a processing cost the caller feeds to its one
  `advanceRun`, drops heat by a severity-scaled relief, writes the charge to
  `state.record`, and broadcasts `heat_exposure` on the network channel — which
  through v1.15's `broadcastTracked` is exactly what raises Curtis's awareness.
  All numbers live in the new `src/data/arrest.js`.
- **The release valve is priced to resist farming**: relief runs −2 (boost tier
  1) to −5 (organized stick), priors multiply bail up to 3.5× and lengthen
  processing one slot per two priors, and a player who cannot pay converts the
  shortfall to time at $150 per part of day, capped at one whole day. No bail
  can soft-lock a broke run.
- **All three Stick tiers route through it**, replacing v1.13's flat $200 tier-3
  stub, gated on a catastrophic outcome or heat above 10 / 8 / 6 by tier.
- **Crew go to jail.** `jailCrewMember` sets `status: "arrested"` with a
  severity-scaled `jailedUntilDay`; bail restores them at −1 loyalty, serving the
  stretch at loyalty 1. `releaseServedCrew` also repairs a live v1.15 bug where
  an arrested member silently stopped counting toward capacity and power with no
  way back.
- **A blown boost is a scene.** All three tiers open a fight / run / give-it-up
  encounter through the consequence engine, reusing `EncounterModal` (no new UI
  shell). Fight broadcasts a `violence` row win or lose. The first-boost
  opportunity card routes through the same door.
- **UI**: a Record card on Character (priors, last booking, current bail
  multiplier); an arrested crew member's page swaps Pay-arrears for
  **Bail out · $N**.

### Verification

- 588 tests passing (565 baseline + 23 in `tests/v1-16.test.js`).
- **New baselines, both moved on purpose** (two failure paths rewritten):
  `--total 200` `b233d725c18d3cd51872b4ed09a5031ccb549f8d7566318e3dd845de597e976c`,
  `--total 2000` `9ae8cd3cf01537977fae1e98218292eb6d866bad6166f0e1a6d2623ebabdd49d`,
  replacing v1.15's `01c618d5…` / `9f471dec…`. Zero dead ends.
- Economy across 2,000 runs **−1.11%** overall, concentrated where expected:
  `stickup` −4.5%, `aggressive` −4.1%, `thief` −1.8%; clean-money profiles
  inside ±1%. 70 arrests across 2,000 runs, all in the criminal profiles.

### Known limitations

- Multi-day player sentences are out (they need a skip-N-days UX that does not
  exist). Lawyers, police as a named faction, and arrest-to-job-loss beyond what
  `applyHeatEmployment` already does are all unbuilt.

## v1.15 Crew System + Curtis Ambient + Deshawn Tier 1 — shipped (PR #76)

- Branch: `claude/crew-system-improvements-z33xv6`, on top of the v1.14 merge
  (PR #75). Built from the "v1.15 Build Prompt — Crew System + Curtis Ambient +
  Deshawn" doc, reconciled onto the crew system that already shipped in earlier
  builds rather than the spec's greenfield `state.crew` schema.
- **Save schema v11** (`907ogr_v11`). v10 saves skip the lossy legacy flat pass
  (which rebuilds jobs and deletes `attributeProgress`) and take only the
  loyalty rescale; v3–v9 keep the flat pass and get the rescale appended.
- **Crew loyalty 0–10** (start 5, departure at 0): every read site shifted +5,
  writes clamped, tier gates uniform in `Crew.TIER_REQUIREMENTS` (T2 loyalty 7
  + 5 days, T3 loyalty 9 + 12 days, plus per-NPC extras). New
  `src/data/crew.js` owns the constants, the tier wage curve
  (Deshawn $50/$100/$200), the presence-effect framework, and the FUTURE
  soldier schema as comments.
- **Wage auto-deduction** in `settleCrewWages` at day end: dirty cash first,
  highest loyalty first; arrears + 2-day grace, then −1 loyalty per unpaid
  night; departure clears assignments and block managers.
  `crewMeta.totalWagesPaid` tracks lifetime spend. `PAY_CREW` clears arrears.
- **`state.curtisAwareness`** (0–15, phases invisible/ambient/watching/
  approaching at 3/7/11 with sticky floors): +1 per network-channel
  observation that actually reaches Curtis (`broadcastTracked` reads the
  reach list), +1 for 3+ Spenard market transactions a day, +2 per robbery
  success, nothing from The Nile or the gym. Quiet-day decay from the second
  consecutive quiet day. Watcher flavor via `logEntry`/`pushConsequence`
  during Spenard movement — stringHash-rolled, one per day, no repeats within
  three — plus one Word Around Town text per phase reached.
- **Deshawn**: Exposure lens (STREET; violence −3, discretion +3, loyalty +4,
  betrayal −5, presence +2), channels direct/neighborhood/household — never
  network. `deshawn_offer` ambient card at the Night Owl (Day 5+, gate:
  business-severed block; 2 active contacts or 2 Warm Spenard ledgers; or the
  Goodie restitution redemption path), decline = 3-day rain check.
  De-escalation in both encounter engines and the stick retaliation card with
  the violence-override loyalty penalty; weekly introductions
  (Nile → gym → regulars → market tip); rent grace re-arms once per rent
  period while active.

### Verification

- 565 tests passing (531 baseline + 34 in `tests/v1-15.test.js`).
- Deterministic simulation: 200 and 2,000 runs, all complete, zero dead ends.
- New baselines (both moved on purpose — new NPC, new nightly resolution):
  `--total 200` `01c618d5df19baefb786e34c876be9d7f64d7e43f068fba3f77169edcc22df88`,
  `--total 2000` `9f471dec665356be332054827ee46df62aaf10b8f5dc0fccd3749f7d9de87f49`.
- `npm run build` clean; `ui.built.js` committed.

### Known limitations

- Tier 3's twelve-days-recruited gate is near-unreachable inside a 7-day
  pressure window; it ships per spec and is centralized for tuning.
- Word Around Town phase texts arrive in the Phone's Texts section (that is
  what `pushPhoneMessage` feeds); the static intel accordion of the same name
  is unchanged.
- Deshawn's introduced-contact betrayal penalty (−3) has a narrow surface
  today — most introduced contacts have no betrayal mechanic yet.

## v1.14 UI Architecture — shipped (PR #75)

- Branch: `claude/clickup-2kyd583p-15794-voye0b`, on top of the v1.13 merge
  (PR #74), merged as `88f1c6a`. A presentation build: **`game-core.js` is
  untouched**, so the reducer, save schema (**v10** at the time), and both
  simulation hashes are byte-identical to v1.13's.
- **Three primitives extracted** into `src/ds/primitives.jsx` —
  `AccordionSection`, `ActionCard`, `BadgeHeader` — with prop contracts in
  `src/ds/index.d.ts`, replacing the private implementations behind the Phone's
  five sections and Home's active-job card. Same markup, same 44px headers, same
  `0fr → 1fr` animation and `prefers-reduced-motion` opt-out, zero visual change.
- **Travel collapsed to three destinations**: Spenard, Home, Leave Spenard. Fares
  are stated on the row and the blocking reason printed on any ride the player
  cannot afford. Everything the old six-row menu carried is still reachable one
  level down.
- **Local Intel became content**, not a menu row: walks and discoveries fold into
  a "What you've learned" accordion on the neighbourhood hub. The **Listings page
  was deleted** — two of three cards were placeholders and the live one (the
  garage lease) is already offered by 907List.
- **Tonk plays fullscreen**, with a fixed 44px overlay carrying Quit (a real
  drop, so it confirms) and Back (presentation only). Opponent plays animate off
  the discard the reducer already publishes. A hand that ends always prints its
  receipt, closing a v1.9c quiet-receipt gap where a loss moved no money and so
  said nothing.
- **"Finish Trading" relabelled "Leave Market · advance to {slot}"** — same
  dispatch, same reducer, naming the price instead of a bookkeeping step. (v1.17
  removes the button entirely.)

### Verification

- 531 tests passing (513 baseline + 18 in `tests/v1-14.test.js`).
- **Both hashes unchanged from v1.13**, as intended for a UI-only build:
  `--total 200` `bd77a59cb23c35c185f44a3fd0791349aede3ef65ddf06c2946b647c3424f922`,
  `--total 2000` `5d6f9b0f67b63a176cb0a601c246b4a4a816c701cdc8ee957871dfdbf23da245`.
  Zero dead ends.

## v1.13 Criminal Economy Cluster — shipped (PR #74)

- Branch: `claude/clickup-2kyd583p-15714-klwirj`, stacked on the v1.9c commit.
  Built from the "v1.12 Build Prompt — Criminal Economy Cluster" doc, shipped
  as v1.13 because v1.12a's name was already taken by the home screen build.
- **District modifiers** (`src/data/districts.js`): per-district difficulty
  (0.08 chance / 4% market price per step) and heat multipliers for market,
  boost, and stick; adjacency graph for awareness bleed; fairview and
  mountain_view scaffolded.
- **Stick track** (`state.stick`): street/register/organized tiers behind
  rep 4/10 + weapon gates, casing (+0.06 per pass, max 2), a two-a-day cap
  across every robbery surface, seeded retaliation cards two mornings later,
  and an arrest stub (bail + rest of day) on a botched Tier 3 at Heat > 8.
  The ROB envelope and ROB_DEALER feed the same rep ladder.
- **Plug suspicion** (`plugs.records[*].suspicion`): +1 for any robbery on the
  plug's home block (+2 and −3 standing to all plugs when the plug is robbed
  directly), 10% price premium at 3, cutoff at 5, −1 per clean purchase or
  quiet day. Dealer robbery now pays cash even when the plug holds no product
  for you — the pre-existing silent no-op there became reachable once
  suspicion could empty the product list mid-run (caught by the simulator:
  5 stickup-strategy dead ends before the fix, 0 after).
- **Awareness bleed** (`state.criminalProfile`): +1 per action in-district,
  half strength to adjacent districts a day later, one difficulty step per
  three points.
- **Fold-ins**: seeded boost-unlock variants (86bbejvu9), Curtis off fresh
  Hustle screens (86bbejvtn), trade-modal clamps (86bbe3k2b), Slide Okafor
  named as the fence. Quick Score (86bbaqb8f) verified nonexistent.
- **Save schema v10** under `907ogr_v10`; purely additive migration, v3–v9
  all load (asserted in `tests/v1-8-1.test.js`).

### Verification

- **513/513 tests passing**, up from 501. 12 new in `tests/v1-13.test.js`;
  version pins across nine suites moved 9 → 10.
- **200-run hash `bd77a59cb23c35c185f44a3fd0791349aede3ef65ddf06c2946b647c3424f922`,
  2,000-run `5d6f9b0f67b63a176cb0a601c246b4a4a816c701cdc8ee957871dfdbf23da245`.
  Moved on purpose** — district heat multipliers, market price factors, and
  the dealer-robbery fix all touch existing behavior. **Zero dead ends.**
- **Economy delta −2.45%** across the thirteen strategies; worst mover is
  `aggressive` (−44%), thin-margin trading in the districts that now charge
  for repeat traffic; `legal_worker`/`thief`/`gambler`/`trainer` untouched.
- **Browser pass** (Chromium, seeded v10 save): Hustle root shows
  Market/Boost/Stickup rows with Curtis hidden while unaware; Stickup page
  renders three targets with case/run buttons and the envelope card; Slide's
  fence card sells $350 of merchandise; zero overflow at 375px; zero console
  errors.

## v1.9c UX Polish Pass — shipped (PR #73)

- Branch: `claude/clickup-2kyd583p-15714-klwirj`, based on `main` commit
  `460a094` containing merged PR #72 (v1.12a). The build ships the UX pass
  deferred from the 1.9 series: quiet time receipts, the Phone accordion hub,
  and the Home shift shortcut.
- **`game-core.js` untouched.** The receipt gate lives in `GameShell`'s diff
  effect: a receipt with no delta lines is pure time passage and never renders.
  Receipts with lines keep their amber time band; the day-end gate is
  unchanged.
- **Phone accordion** (`PhoneSection`): Texts / Contacts / Bills / Today's Log /
  Word Around Town, only Texts expanded on open, fold state React-only,
  `grid-template-rows 0fr→1fr` at 200ms with a reduced-motion opt-out. The
  Contacts panel renders the same `SocialContacts` component as the standalone
  screens; the Bills panel (`phoneBills`) is display-only over existing state
  (phone, rent, crew wages, Dre's debt — memberships carry no recurring cost in
  code, so no membership rows).
- **Home Active Job card** (`HomeJobCard`): employer, schedule, rank, and a
  WORK SHIFT button dispatching the canonical `WORK_JOB` with the standard
  approach; availability via `jobAvailability` plus explicit reasons for the
  two silent reducer gates (energy, armed day-end). Jobless state is a prompt,
  not a dead button.
- **Street's travel row renamed "Travel"** so no screen repeats its parent's
  label (the "Around Spenard → Around Spenard" playtest complaint).
- **Save schema v9** under `907ogr_v9`, unchanged; the accordion fold state is
  never persisted.

### Verification

- **501/501 tests passing**, up from 493. 8 new in `tests/v1-9c.test.js`
  (source contracts over `ui.jsx` + `v05.css`).
- **Simulation hashes byte-identical to v1.11/v1.12a** — the build never touches
  the reducer: 200-run `febd42d1d7d9349106f03f68a06e109e1c79f538fcc10d7696d71bff0c02ccab`,
  2,000-run `86e726cc241a071a5edc8170cd50e571fb5944bc49988759f809d71ad4932eb9`.
  Zero dead ends.
- **Browser pass** (Chromium, seeded saves): only Texts expanded at 375×667;
  Bills badge and tones track due dates (Day 6 shows two "Due soon" ambers);
  full-health sleep advances the clock silently while a delta-bearing sleep
  shows its receipt and time band; employed and jobless Home cards render with
  live reasons; zero horizontal overflow at 320/375/1440; zero console errors.

## v1.12a Home Screen Visual Overhaul — shipped (PR #72)

- A presentation build recorded here after the fact (it shipped without a
  PROJECT_STATUS entry). Home rebuilt as an atmospheric surface: HUD bar,
  segmented pressure chips, Spenard Road hero photo, three-row Needs Attention,
  the dominant Wander button, Yalonda's apartment card, and Home centred in the
  bottom bar with the glow treatment.
- One `game-core.js` change: `homePriorities()` cap raised from two to three.
  The 200-run simulation hash stayed byte-identical to v1.11's.
- Save schema v9, unchanged. Full notes in `README.md` §"What changed in
  v1.12a".

## v1.11 Attribute Growth Triangle + The Nile — shipped (PR #70)

- Branch: `codex/v1-11-attribute-growth`, based on `main` commit `b5bd304`
  containing merged PR #69 (v1.10).
- **The triangle closes.** Charisma and Intelligence gain three growth sources
  each, wired through the existing `attributeGrowth()` log2 curve. v1.10 shipped
  with only Combat having a path up and named that as its first-priority gap.
- **The Nile**, a two-floor location in Spenard. Ground floor: Selam Tesfaye's
  wellness practice, $30 and one slot for 15 health plus Charisma growth. Second
  floor: Biniam Tesfaye's room, Evening and Night only, behind a code-locked door
  that only a vouch opens.
- **Tonk and Cee-lo** as real playable games — a genuine 52-card deck with
  spreads, runs, drop and Tonk-out scoring; three dice with 4-5-6, trips,
  pair-and-point, and true odds computed off the full 216-outcome space.
- **Attributes buy information, not outcomes.** The read is itself a roll, so the
  middle band can be wrong and a catastrophic read inverts the tell. Reaching 6
  removes the catastrophic tier, which means the high band buys certainty rather
  than a bigger edge.
- **Curtis isolation.** No Nile observation ever touches the `network` or
  `reputation` channel, and neither Tesfaye subscribes to either. Asserted end to
  end in `tests/v1-11.test.js`.
- **The abstract `GAMBLE` action retired.** Cal's Night Owl discovery scene
  survives and now opens The Nile's second floor. The simulator's `gambler`
  strategy was rewired to the real tables rather than a twelfth profile being
  added, keeping the strategy count and `averageGamblingNet` comparable.
- **Save schema v9** under `907ogr_v9`. v3 through v8 all load.

### Verification

- **493/493 tests passing**, up from 437. 56 new in `tests/v1-11.test.js`.
- **2,000-run seeded simulation: `86e726cc241a071a5edc8170cd50e571fb5944bc49988759f809d71ad4932eb9`**,
  replacing v1.10's `8f68db014f0fe466f38edad05454f632fb90ca2eef0c9c8af4707bb30714990b`.
  200-run baseline: `febd42d1d7d9349106f03f68a06e109e1c79f538fcc10d7696d71bff0c02ccab`.
  Zero dead ends. The hash moved on purpose: a new location, two new NPCs, a
  retired action, and a rewired simulation strategy.
- **Economy delta.** The eleven non-gambling strategies move **+0.19%** overall,
  worst single swing 4.6% (`aggressive`). The `gambler` profile is **+34%** and
  reaches Charisma 3 / Intelligence 2, which is the point: real decisions at a
  real table beat the EV-negative single roll they replaced. Story beats unmoved
  at 9.79/run.
- **Growth balance** (`tests/attribute-balance.js`): two sessions a day reaches
  attribute 3 on Day 6 (Charisma) and Day 7 (Intelligence), against a design
  target of ~Day 7. No track reaches 6 from The Nile alone at any rate.
- **Browser QA.** 320 / 375 / 430 / 768 / 1440: zero horizontal overflow, zero
  sub-44px controls on any Nile surface, zero console errors. A full hand of Tonk
  and three Cee-lo rounds driven live; cash split invariant held; Curtis's ledger
  verified empty in a real session.

### Two bugs the playtest caught that the test suite could not

- **Selam spoke her brother's disposition.** One shared `band` in
  `nileAvailability` served both siblings, so Selam delivered her Warm line
  whenever Biniam liked the player. Split into `band` and `selamBand`.
- **The dice were biased.** Deriving three throws from keys differing only in
  their final character reads correlated bits out of FNV-1a. Measured: 1-2-3 at
  14% against a true 2.8%, a real point at 0.8% against a true 41.7%. Every rules
  test passed throughout, because they all used hand-built dice. Fixed by hashing
  the key once and seeding the existing xorshift generator; now pinned by a
  60,000-throw distribution test.

### Known limitations

- No simulation strategy exercises the wellness floor or the Night Owl social
  source heavily, so their contribution is measured in
  `tests/attribute-balance.js` and unit tests rather than in the 2,000-run
  report. New Nile-specific strategies were out of scope by agreement.
- Biniam's Trusted tier (private high-stakes games) is a hook with no content.
- The `.entity-chip` inline name link remains at 23px. It is byte-identical to
  `main` and predates this build.

## v1.10 Unified Stat Architecture — shipped (PR #69)

- Branch: `codex/v1-10-stat-architecture`, based on `origin/main` commit `b7cf392`
  containing merged PR #68 (v1.9b).
- **Three attributes, stored.** `strength/endurance/reflexes/presence/insight/
  discipline` collapsed into `combat/charisma/intelligence`. The three already
  existed as *derived* ratings computed from the six; v1.10 deleted the middle
  layer and made the ratings the stored values. A fresh run starts 1/1/1 and the
  player only ever sees a label (Green, Capable, Solid, Dangerous, Elite).
- **Advantage instead of bonuses.** `resolveWithAttribute` in
  `src/systems/attributes.js` is the one entry point. Pools are *built* from each
  action's existing context-sensitive chance rather than authored flat, so heat,
  gear, health, disposition, and district all still count.
- **Quality decides the footprint.** `OUTCOME_OBSERVATIONS` maps each tier to what
  the neighborhood ends up knowing. A clean robbery writes one row on `direct`; a
  catastrophe writes two and one of them reaches the network. Measured over 200
  seeded robberies, a Dangerous player's catastrophic rate is 0% against Green's
  10.5%, and the average observation reach falls from 1.42 to 1.15.
- **Gym growth** on `log2` diminishing returns with three activities. Committing
  every available slot reaches Combat 3 around Day 7; thirty sessions of bag work
  alone cannot reach Combat 6, which is the intended ceiling on training as a
  substitute for experience.
- **Heat → employment ladder** at 8/10/12, day labor exempt, Night Owl restricted
  rather than fired. **Street Identity derived** from a 4×4 matrix, pure read.
  **Reputation** settled as a non-feature and documented in `ARCHITECTURE.md`.
- Save schema v8 (`907ogr_v8`); v3 through v7 migrate. The six attributes fold in
  by highest-of-group; the stored identity is dropped and kept as
  `player.historicalIdentity` for display.
- New files: `src/data/attributes.js`, `src/systems/attributes.js`,
  `tests/v1-10.test.js`, `tests/attribute-balance.js`.
- Verification: 437 tests passed (up from 401); 2,000/2,000 seeded runs completed
  with zero dead ends; success curves monotonic across all nine attribute levels
  for all nine tiered actions; zero console errors. New baselines `77b09d7b…`
  (`--total 200`) and `8f68db01…` (`--total 2000`).
- **Balance, measured rather than asserted.** The economy is down **15.5%**
  against v1.9b. Three intended changes account for it: standing gains brake as
  they climb (`trader` -21%), gambling pays the full pot only on a clean read
  (`gambler` -21%), and a gym session buys less than the old flat progress did
  (`trainer` -49%). `stickup` is **+24%** because a clean robbery draws a third of
  the heat a messy one does, so violent runs survive longer. Story pacing is
  unmoved at 9.5 beats a run against 9.7, and the 907List tier ladder is where
  v1.9b left it: tier 1 $38.3/day and tier 2 $73.2/day in band, tier 3 $30.5/day
  still short for the run-length reason already documented.
- **Two anchoring bugs the simulator caught and that are worth remembering.**
  Formulas written before v1.10 were tuned against attributes that ran 1-5 and
  *started at 2*; the new ones run 0-8 and start at 1. Reading them directly, and
  separately re-anchoring the stripped chance constants at attribute 1 rather than
  at the old starting value of 2, each cost roughly a third of the run economy.
  `compatibilityRating` exists to hold that line.
- **Known gap carried forward:** the gym only trains Combat, so Charisma and
  Intelligence have no growth source in this build. That was explicitly out of
  scope and is the first thing the next build should close.

## v1.9b 907List Tiered Broker System — shipped (PR #68)

- Branch: `codex/v1-9b-907list-broker`, based on `origin/main` commit `b63241f`
  containing merged PR #67 (v1.9a).
- 907List is no longer a free action. A buy costs one part of the day, posting a
  listing is free, delivering it costs another part of the day the next morning,
  and a quick sell trades 20% of the margin for the same slot and certainty.
- Three tiers, two of them earned. Scrapper is the default: two listings a day,
  a title and an asking price and nothing else, Spenard meetups only. Flipper
  arrives with the $250 laptop: four listings with condition and seller
  reliability, Downtown meetups at a 30% better margin, quick sells, and the
  specialist tag at three flips in one category. Broker is ten clean flips with
  fewer than two disputes: named buyers who text what they want, three-item lots
  from distressed sellers, and verified status that closes a sale the same day.
- Appraisal is the skill. `buy` (what the seller wants) and `trueValue` (what it
  fetches) are separate fields, and the board carries listings priced above what
  they are worth. A Scrapper gets no condition readout, so the title carries the
  tell. Delivering at a loss is a dispute; two disputes close Broker standing.
- Robbery risk is contextual and *shown*:
  `0.03 × (carried/100) × district × time of day × (1 + heat × 0.1)`, capped at
  85%, with carried value contributing up to $500. $200 of stock Downtown at
  Night on heat 4 reads 38%; the same bag in Spenard on a Morning reads 3%.
- Every market probability hashes `run.seed` rather than drawing from
  `run.rngState`, so an unrelated encounter earlier in the day cannot change
  whether a flip is sniped, flakes, or gets robbed.
- Exposure integration: clean flips broadcast `financial / 907list_profit` on the
  household channel with the payout as `value` (so a big day clears Curtis's $200
  volume filter), robberies broadcast `violence / robbery_victim` to the
  neighborhood, held stock over $250 is noticed weekly as
  `growth / inventory_accumulation`, and Broker standing goes out as
  `growth / market_reputation` on the reputation channel.
- New files: `src/data/market.js` (catalogue, tiers, risk constants) and
  `src/events/market-events.js` (the rolls). Reducer cases stayed in
  `reduceGame` with the other actions rather than pioneering `src/actions/`.
- Save schema v7 (`907ogr_v7`); v3 through v6 migrate. The v6 string tier is
  dropped and re-derived rather than trusted.
- Verification: 401 tests passed (up from 377); 2,000/2,000 seeded runs completed
  with zero dead ends; all ten viewports 320–1440px show zero horizontal overflow
  and no tap target under 44px; zero console errors. New baselines `d4474787…`
  (`--total 200`) and `ddd76695…` (`--total 2000`).
- **Balance, measured rather than asserted.** Tier 1 lands at $37.9/day against a
  $30–50 target and Tier 2 at $71.3/day against $60–100, both in band. Tier 3
  lands at $34.2/day against a $100–150 target and **misses**. Half of
  907List-focused runs reach Broker (76 of 153), so the content is reachable; the
  ten-flip gate simply opens around day 11 of a 14-day run, leaving two or three
  days to earn with most of the bankroll locked in stock when the run ends. The
  gate was left at ten as specified — the agreed trigger for lowering it was a
  reach rate under 15%, and it is at 50%. Closing the income gap would need
  either a longer run or margins that make 907List the strongest earner in the
  game (`legal_worker`, the current best, averages about $79/day).
- The eleven pre-v1.9b simulation strategies stay within 3.5% of their v1.9a
  averages and the economy overall within 0.34%.

## v1.9a Exposure System and Bug Fixes — shipped (PR #67)

- Branch: `codex/v1-9a-exposure-system`, based on `origin/main` commit `dc6aff4`
  containing merged PR #66 (v1.8.1).
- NPC relationships are no longer integers. Each of the six core NPCs
  (Yalonda, Juan, Mina, Curtis, Dre, Simone) carries a ledger of typed
  observations and a channel subscription; disposition is computed from the
  ledger through a personality lens on every read and is never stored.
- Eleven observation categories; four archetypes (CIVILIAN, STREET, ROMANTIC,
  THREAT) with three to five per-character overrides. THREAT is inverted, so a
  high score with Curtis means being no problem to him rather than being liked.
- Five gossip channels (direct, household, neighborhood, network, reputation)
  with presence and time-of-day checks. Curtis's network filters out
  corner-level activity. Heat above 8/10/12 propagates on its own.
- Repeated behavior follows `min(4, log2(count + 1))`. Betrayal is exempt and
  missed obligations escalate. The clamp is what actually prevents grinding:
  `log2` alone has no ceiling.
- Six shared bands (Hostile, Cold, Neutral, Warm, Trusted, Bonded) replace every
  per-character threshold. Roughly 55 read sites migrated. The sixty relationship
  effects declared across the event cards were left declared and are translated
  into observations in one place, `applyRelationshipEffects`.
- Save schema/key advanced to version 6 / `907ogr_v6`. v3, v4, and v5 all load;
  pre-Exposure relationships, Curtis's attention milestones, rent history, and
  the Mina flags convert into ledger entries rather than being discarded.
- Two blockers fixed. Neither matched its report: the name gate already existed
  at both layers and was missing only its disabled styling and reason, and the
  Downtown return already worked in the reducer and was hidden by a destination
  list that filtered on the home district instead of the current one. The
  outbound bus leg also bypassed `spendCash`, leaving cash and the dirty/clean
  split disagreeing after a round trip.
- Dev-only ledger inspector behind `localStorage 907_exposure_debug`.
- Verification: 377 tests passed (up from 345); 2,000/2,000 seeded runs completed
  with zero dead ends; overall economy within 3.3% of v1.8.1 on cash and net
  worth. New simulation baselines are
  `c2f0e24d5e9355bf3a0372a978c2f226c1442342bf0c9c27bcecfe74332f1bc2` (200-run)
  and `3e0b84f6d2856ddf292eed0aadeb5a5e8d46540ef215d8ac3d8efb30590453f1`
  (2,000-run); the hash moved because gameplay changed on purpose. Browser QA at
  320x568 through 1440x900: zero horizontal overflow, zero console errors, and
  real v3, v4, and v5 saves migrated to v6 and stayed playable. One pre-existing
  sub-44px control remains, the inline `.entity-chip` name link, unchanged from
  v1.8.1. This build is ready for draft review and is not shipped.

## v1.4 Week Zero and Early Game Rework — shipped (PR #60)

- Branch: `codex/v1-4-week-zero-early-game`, based on `origin/main` commit
  `87bf395` containing merged PR #59.
- Fresh runs require a Street Name and begin with $100 clean cash, no debt, no
  Dre relationship, four hidden Energy, and no fixed checkpoint.
- Week Zero tracks deduplicated shifts, physically visited locations, and
  eligible workplace or Night Owl contacts. Pressure systems stay suppressed
  until Dre approaches after the qualifying follow-up shift.
- Dre acceptance creates $1,000 dirty cash and $1,200 due seven calendar days
  later. Refusal is final, creates no debt, and still begins the pressure phase.
- Nightly processing is deferred behind an explicit end-day confirmation with a
  structured recap and one Energy-gated One More Thing action.
- Travel now has three root entries. Night Owl is a full sub-hub, gambling is
  discovery-gated, and 907List supplies a deterministic three-item resale loop.
- Save schema/key remain version 3 / `907ogr_v3`; older saves hydrate into the
  pressure phase with their existing balance and Day 7 checkpoint.
- Verification: 280 tests passed; 2,640/2,640 seeded runs completed across 11
  strategies with zero dead ends; ten required responsive viewports passed with
  no horizontal overflow, sub-44px controls, or console errors. This build is
  ready for draft review and is not shipped.

## Alpha v0.9 implemented baseline

- Branch: `codex/alpha-v0-9-fresh-start-daily-life`, based on remote `main` commit `199ca219`.
- Fresh runs start at Yalonda and John's home with $1,000, zero Heat, no assets or standing, and Dre's fixed $1,200 Day 7 note.
- Places combines daily life and travel. Work, exploration, gym, gambling, shoplifting, buses, home storage, and garage listing are playable.
- North Star Garage is optional at a $650 deposit; all garage-dependent systems and beats are ownership-gated.
- Street Read and hidden attribute progress are implemented separately from Street Identity and Operation Score.
- Mina starts as a stranger; Curtis starts unaware; Goodie is discovered through play. The 43-beat registry is audited in `EIGHTH_PLAYTEST_AUDIT.md`.
- Save schema/key remain version 3 / `907ogr_v3`; legacy v3 saves retain established state.
- Verification: 97 tests passed; 2,000/2,000 simulations completed with zero dead ends; ten responsive viewports passed. Three full human-style runs remain open.

## Alpha v0.8 baseline

- Branch: `codex/alpha-v0-8-classless-foundation`, based on merged `main` commit `98c726a` containing PRs #48 and #49.
- New runs are classless: optional Street Name, six attributes at 2, `background: null`, and `streetIdentity: "unproven"`.
- Combat, Charisma, and Intelligence are centralized derived selectors. The 18 former active stat reads now use them.
- A hidden, deduplicated behavior ledger feeds nightly Street Identity evaluation; More → Character displays only qualitative results.
- Legacy Shooter, Hustler, and Strategist saves migrate additively to equivalent attributes while preserving story, dealer, inventory, debt, and relationship state.
- Save schema/key remain version 3 / `907ogr_v3`. Operation Score is unchanged and Street Read remains unimplemented.
- Verification: 88 tests passed; 800/800 simulations completed with zero dead ends. Full results are in `SEVENTH_PLAYTEST_AUDIT.md`.

## Current baseline

- Alpha v0.7.1 playstyle pass is implemented on `claude/907hustle-story-playstyles-d5huyw`, based on merged `main` commit `0e07a00` (PR #46).
- Design target is `VISION.md`; build order is `ROADMAP.md`.
- Active runtime: `index.html`, `v05.css`, `game-core.js`, and `ui.jsx`.
- Save schema/key remain version 3 / `907ogr_v3`. All Alpha v0.7 and v0.7.1 state is additive.
- Decisions and verification are recorded in `SIXTH_PLAYTEST_AUDIT.md`; writing reference in `STORY_BIBLE.md`.
- `events.js`, `script.js`, `style.css`, `combat.js`, and `907hustle/` are legacy and not loaded. See `README.md`.

## Alpha v0.7.1 implementation

1. Goodie is the dealer prototype: one persistent named NPC supporting Buy, Ask, and Rob, so the Hustle and Stickup tracks are legible against the same person. Robbing him pays cash and free product but chokes Spenard supply for two days; two successes put him off the block permanently.
2. `executeDealerRobbery` mirrors `executeRob`, including the `suppressStory` tail. The stickup is deliberately not gated by the Rob working-capital threshold.
3. Eli, Dre, and Curtis chains completed — ten new authored beats. The registry now carries 43 beats across five chains.
4. The registry supports branch stages, so a chain can offer alternative beats at the same point.
5. Place-rooted beats outrank anywhere-beats when the player is standing in that place. This fixed Mina collapsing to 9% once three area-agnostic chains were added.
6. Reactive beats no longer count toward the anti-monopoly streak.

## Alpha v0.7 implementation

1. The linear `scheduleStory` ladder is replaced by `STORY_REGISTRY`: 30 declarative descriptors carrying chain, stage, classification, trigger tier, gating, cooldown, weight, and an exit condition.
2. Selection runs in three tiers. `reactive` beats fire on their cause; `chain` beats roll at 0.30 with a +0.16 pity bonus; `ambient` beats use the existing risk formula plus a +0.16 quiet-week bonus. Opening variance measures 26 of 30 distinct sequences across seeds, against exactly one under v0.6.
3. An anti-monopoly filter drops a chain from the pool after two consecutive beats whenever anything else is eligible, and `STORY_BEATS_PER_DAY` caps the week at two story beats per day.
4. Mina has a six-stage arc with a want independent of the player (a Ship Creek dispatch job that public association with the operation would cost her), an optional evening, a boundary scene gated on trust, a threat, and an aftermath that branches on treatment.
5. The Day 2 threat is now always the Mina-free `early_street`. Her sedan encounter moved to stage 5, Day 5 onward, so the run no longer endangers her before the player has context.
6. Three Day 7 Mina outcomes: `mara_escape`, the new `mara_clear` (she takes the Monday interview and you go your own way — a separation, not a failure), and the new `mara_gone`.
7. Nine repeatable one-off street events were added, five of which involve no criminal transaction.
8. A copy audit scored all 20 active beats against the Task 7A standard; all 14 inherited v0.6 events failed on description and result length and were rewritten. Effects, flags, and gating are unchanged.
9. An optional Street Name is offered before edge selection: 16 characters, sanitized to `[A-Za-z0-9 '-.]`, with an edge-derived default when skipped and exactly six approved usage sites.
10. `End Market` became `Finish Trading` with a sub-label naming the part of day it advances to. Nine further player-facing strings were rewritten; `Lay Low` is unchanged.
11. The title screen gained three aspect-ratio tiers. The portrait tier is byte-identical to v0.6; wide viewports switch to `contain` over a blurred self-backdrop instead of discarding ~65% of the artwork.

## Architecture

`Title/save inspection → createRun or hydrateRun → React useReducer → reduceGame → single advanceRun pipeline → scheduleStory → v3 autosave`

`game-core.js` remains a UMD domain module exposed as `window.GameCore` and `module.exports`. The story registry, chain definitions, and three-tier selector live in the core alongside markets, contacts, encounters, and endings. `ui.jsx` remains presentation only and renders no registry metadata.

All time-consuming actions still route through `advanceRun` exactly once. Story beats are delivered at the end of an advance that has already ticked, so resolving an event never adds a second tick.

## Save compatibility

- No version bump. `people.dealers`, `run.eventHistory`, `run.lastChainFired`, `run.chainStreak`, `run.lastChainSlot`, `run.lastBeatSlot`, `run.chainBeatsToday`, `run.chainBeatsDay`, `player.streetName`, `player.streetNameChosen`, `people.mara.chainStage`, and `people.mara.jobAtRisk` are additive and fill through `mergeDefaults`.
- Pre-v0.7 and pre-v0.7.1 saves are both constructed and hydrated in `tests/game-core.test.js`. The older one reports `Unnamed run`; the newer one gains an unmet dealer record and a supply factor of 1.
- Existing Mina flag names (`toldMaraTruth`, `usedMaraWithoutConsent`, `maraIntroChoice`) are preserved so v0.6 saves keep their history.

## Verification

### Automated regression suite

Command: `node --test tests/*.test.js`

- **83 passed, 0 failed** (40 at v0.6, 68 at v0.7).
- New `tests/story-chains.test.js` validates registry shape, chain stage continuity, out-of-order unreachability, copy length against the writing standard, preview leakage, determinism, opening variance, the anti-monopoly rule, reactive firing, and cooldowns.

### Deterministic simulation

Command: `node tests/simulate-runs.js 200`

- 800/800 runs terminated across four profiles; 0 dead ends.
- cautious: 8.5 story / 5.0 ambient beats, Mina stage 4+ in 48%, quiet runs 7/200.
- balanced: 8.8 story / 5.9 ambient beats, Mina stage 4+ in 17%, quiet runs 2/200.
- aggressive: 5.6 story / 3.6 ambient beats, Mina stage 4+ in 0%, quiet runs 145/200.
- stickup: 7.7 story / 4.3 ambient beats, Mina stage 4+ in 54% and 6 in 37%, 332 dealer robberies across 200 runs.

The aggressive profile never returns to Spenard, so Mina is structurally unreachable for it — the district gate working as intended. Its quiet count is largely an artifact of the bot spamming Rob, which passes `suppressStory: true` and therefore rolls no beat. See `SIXTH_PLAYTEST_AUDIT.md` for the full reading and for two measurement errors corrected during the pass.

## Known limitations

- **Browser and mobile QA has not been run.** The three title tiers are asserted by contract test, not by rendering. A ready-to-run checklist covering ten viewports from 320×568 to 2560×1080, the Tier C fix, and the 390×844 parity check is in `SIXTH_PLAYTEST_AUDIT.md`. It has to be run somewhere with normal internet access: `index.html` loads React, ReactDOM, and Babel from `unpkg.com`, which is blocked in the build environment, so the app cannot boot there at all.
- Mina's true completion rate is unsettled. Simulated bots bracket it between 0% and 64% depending on travel behavior; only human play will settle it.
- React, ReactDOM, Babel, and fonts remain CDN-loaded; runtime Babel is not a production build.
- The packaged title image is still 1.9 MB and should become WebP when an asset pipeline exists.
- Mina is reachable only from Spenard by design. Profiles that never return there reach her 0% of the time; that is the district gate working, but human play should confirm it reads as a choice rather than missing content.

## Next recommended single task

Run the ten-viewport manual browser checklist and the two deliberate v0.8 human flows in `SEVENTH_PLAYTEST_AUDIT.md`, recording identity timing, Character-screen readability, exact save/resume, and identity-aware copy before beginning v0.9.
