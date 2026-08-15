# 907Hustle: One Good Run — Project Status

Last updated: 2026-08-15 (America/Anchorage)

## v1.9c UX Polish Pass — branch in progress

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

## v1.11 Attribute Growth Triangle + The Nile — branch in progress

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

## v1.10 Unified Stat Architecture — branch in progress

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

## v1.4 Week Zero and Early Game Rework — branch in progress

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
