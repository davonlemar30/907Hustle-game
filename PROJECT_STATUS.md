# 907Hustle: One Good Run — Project Status

Last updated: 2026-08-18 (America/Anchorage)

**v1.29 is built on `claude/playtest-qol-pass-qutbfs`, on top of the v1.28 merge
(PR #90, `54f1034`).** Verified on the branch: `npm test` **889 passing**
(868 + 21 new), `npm run build` clean, `npm run check-docs` clean, 2,000-run
simulation with zero dead ends across **fourteen** strategies. **Both hashes are
unchanged** — `--total 200`
`25afb74e10487dee6fc62641d944d3cea093873f28c740ba43e10bb0828d6dc1`,
`--total 2000`
`f10432b1f61624cbc8df35e299a2d36ca369e1e822ca0d6578a337562e524665`. Save schema
stays **v11**.

**Six of the seven tasks in this build are display work, and the seventh is
unreachable from the simulator. Read the unchanged hashes accordingly.** Tasks
1, 2, 3 and 6 touch `ui.jsx` and `v05.css` only, and the harness reads
`game-core.js` and never `ui.jsx`, so those could not have moved a hash. Task 7
is copy inside an existing effect block. Task 4 adds a field and a card at an
already-existing terminal and draws no RNG.

Task 5 — the missed-shift ladder — was the one expected to move the hash, and it
did not. **This was measured, not assumed.** `tests/simulate-runs.js` dispatches
`WORK_JOB` but never `APPLY_JOB` or `ACCEPT_JOB`, and `jobAvailability` requires
`activeJobId === jobId` for every non-day-labor employer, so **no strategy in the
simulator has ever held a job.** The only work any of the fourteen can do is
`day_labor`, which the ladder exempts by design. The attendance system is
therefore invisible to the harness in exactly the way v1.28's Curtis changes
were: **an unchanged hash here is a statement about coverage, not about
behaviour, and must never be read as though the ladder is verified.** What
verifies it is `tests/v1-29.test.js`, which walks the rungs through real
`CONFIRM_END_DAY` passes.

**The standing gap this makes concrete:** the simulator covers neither the block
layer (v1.28) nor employment (v1.29). Two of the last two builds have shipped
systems the harness cannot see. That is now the most valuable thing to fix in the
instrument, ahead of any further balance work measured against it.

## Standing design correction — the run has no fixed length

**This applies to every future build, not just this one.** There is no day cap,
no "day 7 fork," no timed ending. The player hustles indefinitely, and the only
way a run ends is a lose condition. `RUN_DAYS = 7` is a debt-deadline and
checkpoint constant; it has never terminated a run. A v1.26 test walks an unpaid
run to **day 29** before eviction ends it.

The 10-day cap inside `tests/simulate-runs.js` is an **instrument boundary** that
keeps hashes comparable. It is not a design position. Do not evaluate balance,
pacing, or reachability against a day count — including the v1.25 finding that
territory is unreachable "inside a run's length," which should be read as *the
simulator's ten days do not fund the ladder*, not as a claim about the game.
Territory is deliberately mid-to-late-game content funded by early economy
systems (weed, booze, robbery tiers) that are still being fleshed out. The full
statement is in ARCHITECTURE.md under "The run has no fixed length."

## v1.29 Playtest QoL Pass — built (branch `claude/playtest-qol-pass-qutbfs`)

Seven items off the Aug 17 playtest (ClickUp `2kyd583p-21294`, filed alongside
the Drug Lord 2 comparison notes). No new systems. Everything here makes systems
that already existed readable, honest, and less frustrating.

- **The feed shows three wrapped lines, and this reverses a v1.26 decision on
  purpose.** v1.26 cut the log to one ellipsised line to stop spending 88px of
  every screen on history the player had already read. The playtest measured the
  cost of that trade: the log was too small to want to read, and the one line it
  did show was cut off mid-sentence, because `text-overflow: ellipsis` was doing
  exactly what it had been asked to. Feed lines are narrative content, not a
  status bar. Verified in Chromium at 320/375/414/768/1440: three lines rendered,
  all three wrapping at 375px, zero clipped, zero ellipsis, no internal scroll,
  44px expand control, no horizontal overflow, zero console errors.

- **Phone texts can be dismissed and answered.** The inbox stacked up with no way
  to empty it and the badge counted messages already read, which is what the
  playtest meant by dead taps everywhere. `pushPhoneMessage` grew an optional
  `action` descriptor; the only kind today is `job_offer`, which renders Accept
  and Turn-it-down wired to the `ACCEPT_JOB` / `DECLINE_JOB` cases that already
  existed. **No new job flow was written.** The buttons are gated on the offer
  still being live so a stale card degrades to dismiss-only, and answering an
  offer anywhere retires the text that carried it. Verified in-browser: badge
  3 → 2 on dismiss, and accepting from the phone sets `activeJobId` without
  leaving the screen.

- **907List followed Jobs onto Hustle**, the v1.26 pattern. It was not in Spenard
  navigation, which the build spec assumed; it was in three places — the More
  root, the Phone, and the Home laptop. The More and Phone rows are gone. The
  **laptop row stays and now deep-links into Hustle**, because opening listings
  on the laptop you own is where that belongs in the world. Access selectors are
  untouched, so no pricing, capacity, or district rule moved.

- **A lost run says what lost it.** The end screen opened with the same
  checkpoint sentence for every outcome, so a player evicted on Day 9 was told
  they "reached the checkpoint" and never learned which obligation ended it.
  `endRun` now records `run.endCause` and pushes it as a titled `bad` consequence
  card; eviction passes the specific line `householdWarning` was already writing.
  Final stats gained **Days survived** and **Net gain**, the latter derived from
  the long-standing `stats.startingNetWorth` rather than a new tracked field.
  `ConsequencePopup` is now gated on a live run, because it was stacking on top
  of the end screen it was repeating.

- **Missed shifts have consequences, and the build spec's premise here was
  wrong.** The spec said "the shift system knows when you're supposed to work."
  It does not. `job.scheduled` is a once-per-day flag and `lastScheduledShiftDay`
  records the day worked; **there is no employer roster in state.** Rather than
  invent one inside a QoL pass, the ladder counts **consecutive** days that ended
  without a shift, and any worked shift resets it to zero. Rung 1 feed line,
  rung 2 text from the employer, rung 3 fired with `job_lost` on both channels.
  Day labor is exempt at every rung; the Night Owl is de-scheduled rather than
  fired, the same exemption the Heat ladder gives it; grace applies on the hire
  day. No RNG. **A player who works every other day is never fired — the system
  punishes ghosting, not an irregular schedule.**

- **Identity is Rank everywhere the player can see it.** Display-only: every
  internal key, selector, and CSS class name is unchanged.

- **The regular-customer-price card states its trade.** The old previews named a
  mood ("Build standing and keep the corner dependable") rather than a
  consequence. Both options now say what you get and what it costs, in 17 and 14
  words.

**One playtest item filed High is deliberately not here:** *"Let the player pay
crew wages before owning the garage"* (`86bbfz17r`). It is a real bug and it was
not in this build's task list, so it stays for the next pass.

**One pre-existing issue surfaced by the viewport sweep and left alone:**
`.entity-chip` renders at 23px tall. It is an inline text link inside a sentence
rather than a layout control, it is unchanged from `main`, and nothing in this
build touches it.

## v1.28 Curtis Pressure Balance Pass (Phase 2.2) — built (branch `claude/curtis-balance-pass-s3bacr`)

- **The blocker was never real, and that is the first finding.** 2.2 sat open for
  months on the simulator's 10-day cap. The cap is an instrument boundary for
  hash comparability and has nothing to do with the block layer;
  `tests/measure-lieutenant-modifiers.js` starts from a corner-holding state and
  resolves nights through the real reducer, and has done since v1.20. Every
  number below came out of it in an afternoon.

- **`CURTIS_BASE_CHANCE` went 0.12 → 0.05, and it was swept twice on purpose.**
  0.04–0.15 in 0.01 steps, all four phases, 200 runs × 10 nights × six corners —
  once against the v1.27 code for an honest control, and again with this build's
  heat probe and unstaffed term live, because a base tuned against a control that
  excludes them is wrong the moment they land. Every value in both sweeps
  produced a clean monotonic gradient across the phases, which is the finding
  that says **the base was wrong and the phase gate was not.**

- **Two phase multipliers moved, and the measurement said which.** The targets
  are ambient at roughly half of watching and approaching at roughly double it.
  At `{0, 0.5, 1.0, 1.5}` the measured ratios were 0.43 and 1.46. Ambient sat
  *under* half because its visibility gate of 2 puts three corners on his board
  where watching's gate of 1 puts five — the gate, not the multiplier, was
  suppressing it — so ambient is lifted to **0.6** to compensate for its own
  gate. Approaching is **2.0** because 1.5 is not double.

- **Where it landed, at 300 runs × 10 nights × six corners, two soldiers each:**

  | phase | blockLossRate | target | flips/block-night | police/block-night | soldiers lost/run |
  |---|---|---|---|---|---|
  | `invisible` | 0.000 | 0 | 0.000 | 0.171 | 8.76 |
  | `ambient` | 0.093 | 0.10–0.12 | 0.014 | 0.172 | 8.97 |
  | `watching` | 0.181 | 0.20 | 0.028 | 0.174 | 9.16 |
  | `approaching` | 0.341 | 0.35–0.40 | 0.055 | 0.173 | 9.52 |

  Strictly monotonic, ambient/watching = 0.51, approaching/watching = 1.88. **All
  three land slightly under target — between 3% and 10% low — and that is a
  deliberate choice rather than a miss.** The spec mandated 0.01 sweep
  increments; 0.06 overshoots watching to 0.237 (+18%) where 0.05 undershoots it
  to 0.181 (−10%), so 0.05 is the closer of the two available values. If Davon
  wants the targets hit dead on, the lever is a 0.005 step, not a redesign.

- **Police pressure is flat across every phase (0.171–0.174) and was already
  flat.** The "constant background noise, independent of Curtis's aggression"
  target needed no work — the v1.21 split had already delivered it. Verified and
  left alone. They still cost soldiers and Heat and still never take a corner.

- **He reads Heat above 8 now, and it is a read rather than a plan.**
  `curtisHeatFactor` is `1 + max(0, heat − 8) × 0.05`: exactly 1.0 at or below 8,
  1.20 at 12, 1.35 at 15. It multiplies a threshold that is already compared
  against a hashed gate, so **no new draw and no new hash**. Read exactly off the
  gate at `watching` on Northern Lights Motel Row:

  | Heat | factor | 0 soldiers | 1 | 2 |
  |---|---|---|---|---|
  | 0 / 5 / 8 | 1.00 | 0.1200 | 0.0600 | 0.0300 |
  | 9 | 1.05 | 0.1260 | 0.0630 | 0.0315 |
  | 10 | 1.10 | 0.1320 | 0.0660 | 0.0330 |
  | 12 | 1.20 | 0.1440 | 0.0720 | 0.0360 |
  | 15 | 1.35 | 0.1620 | 0.0810 | 0.0405 |

  Invisible below the floor, and at 15 a defended corner goes from 3.0% to 4.05%
  a night — meaningful, not catastrophic. As a share of the loss rate, measured
  as a paired control with the probe zeroed: **10.8% at ambient, 11.6% at
  watching, 8.8% at approaching.**

- **The Heat sweep had to stop being a run measurement, and the reason is worth
  keeping.** Sampled across full runs it reported the loss rate *falling* from
  Heat 12 to Heat 15. That is not safety, it is survivorship: Heat climbs on its
  own, a hot player gets arrested, an arrested run stops early, and a run that
  stops on night two only ever sampled nights where the garrisons were still
  full. `curtisMoveChance` is a pure function of state, so the harness now reads
  the multiplier exactly at fixed staffing instead. **The first instrument was
  measuring how long the run survived and calling it danger.**

- **An empty corner is finally worth less than a corner with one person on it.**
  The divisor floored at `max(1, soldiers)`, which made an unstaffed corner and a
  one-soldier corner arithmetically identical — posting your *first* soldier
  bought nothing, and territory.js's own claim that an undefended corner "costs
  double" was only ever true against the two-soldier case.
  `CURTIS_UNSTAFFED_DEFENSE = 0.5` makes the first body worth exactly what the
  second is. **This is where "probe the weakest" went**, rather than into the
  planner — see the next bullet.

  | soldiers per corner | blockLossRate | flips/block-night | income/run |
  |---|---|---|---|
  | 0 | 0.395 | 0.050 | 0 |
  | 1 | 0.353 | 0.043 | 1,620 |
  | 2 | 0.181 | 0.028 | 3,487 |

- **It couples the two adversaries, and Davon took that call knowingly.** The
  police empty a corner; an emptied corner is the cheap one to walk onto. At
  `watching` the most-flipped corner is now **Service Road Chokepoint** (patrol 3)
  rather than **Northern Lights Motel Row** (visibility 3) — 0.317 against 0.323
  on total loss rate, and ahead on flips per block-night. He still does not read
  patrol routes; the coupling runs entirely through who is standing there. v1.21
  asserted the split by proxy — "the most-hunted and the most-raided corner are
  different ones" — and that proxy is gone, so the test now asserts the split
  where it was always actually defined: **the police never change ownership, and
  Curtis never touches Heat.** The alternatives were measured: 0.75 still flips
  the ordering (0.052 vs 0.050) and only 1.0 preserves it, at the cost of
  shipping "probe the weakest" as nothing at all.

- **"Probe the weakest" is deliberately NOT in `curtisNightPlan`, and this is the
  build's most important structural call.** The spec asked for it there. A
  planner that read soldier counts would change the instant a warned player moved
  somebody onto the warned corner — so the warning would falsify itself, and
  v1.23's contract (warn tonight, re-derive the identical plan tomorrow) would go
  with it. `tests/v1-23.test.js` pins that contract and it still passes untouched.
  He probes the weakest in the odds, where the odds already live.

- **The grudge, and why the spec's version of it would have ranked nothing.** The
  spec keyed recapture on "a corner the player claimed from `owner: "curtis"`".
  Every corner on the map *starts* his, so that condition is true of all six and
  orders nothing. `record.curtisTookBack` is stamped by the resolver the first
  time he takes a corner back off the player instead — a corner with a history —
  and it outranks even a two-point visibility advantage.

- **The bank exists, is capped at +2, drops on a phase change, and cannot move a
  loss rate.** That last part was measured, not assumed. The budget feeds the
  pressure *weight*; the weight is not an input to `curtisMoveChance`; and the
  resolver never consults the plan at all, rolling every held corner
  independently. So the grudge and the bank move what the gossip surface,
  Pherris's level-3 read and the paid disclosures **say**, and nothing else. Loss
  rate at `watching` with them and without them is **identical** — the spec's
  "no more than 15% above the base-tuned rate" ceiling is met at 0%.

- **The bank is settled before the warnings are raised, and the order is the
  correctness argument.** A warning raised tonight must name the plan the player
  re-derives tomorrow, so nothing feeding the plan may move between the two.
  Writing the carry afterwards would telegraph one plan and resolve another.

- **The warning targets are the one thing this build could not hit, and the
  reason is structural.** The spec wants an acted-on warning to save the corner
  >60% at watching and ~40% at approaching. Measured on the operation the targets
  describe — three corners, one soldier each, three in reserve:

  | phase | loss | warned corner-nights | under threat | save rate | top-target save | coverage |
  |---|---|---|---|---|---|---|
  | `ambient` | 0.269 | 2,956 | 106 | 0.264 | 0.264 | 0.73 |
  | `watching` | 0.424 | 5,609 | 279 | 0.262 | 0.406 | 0.44 |
  | `approaching` | 0.660 | 6,369 | 582 | 0.247 | 0.376 | 0.32 |

  Approaching lands on its 40% target; watching reaches 0.406 against 0.60. **The
  ceiling is arithmetic, not tuning.** A corner's chance is linear in headcount,
  so moving from *n* soldiers to *m* reduces risk by exactly `1 − n/m`. The block
  cap is 3, and Eli's balanced auto-assignment converges corners toward equal
  staffing — so a player at two soldiers a corner can reach at best `1 − 2/3` =
  **33%**, and >60% requires the warned corner to start at 1 or 0 and be tripled
  before Eli spreads them again. No value of any Curtis constant changes this;
  the levers are `SOLDIERS_PER_BLOCK_CAP`, a non-linear defense curve, or Eli's
  placement policy, and all three are outside 2.2. **Filed rather than faked.**

- **`warningCoverage` is the column that shows the budget working**: 0.73 → 0.44
  → 0.32 as the phase deepens. That is the plan naming more corners than the
  player has people for, which is exactly the triage decision the budget table
  exists to force. The save rate is capped by the defense curve; the *coverage*
  gradient is the pressure budget doing its job, and it is the honest regression
  surface for future budget changes.

- **The Made Men ladder is unchanged and still pays.** At `watching`, three
  corners: Tone takes the loss rate 0.424 → 0.358 → 0.300 → 0.246 across his
  tiers, and Deshawn moves it barely at all (0.424 → 0.409) while taking peak
  Heat 10.31 → 8.10. That is the modifier triangle behaving exactly as v1.20
  designed it — Tone is defense, Deshawn is temperature — and neither was touched.

- **The escalation loop was measured and deliberately left alone.** Losing a
  corner broadcasts `defiance` on the network channel, which raises his awareness
  by one, and `awareness.floor` ratchets and never falls — so a player who slips
  once is pushed structurally toward slipping again. Adding counter-pressure
  (retaking a corner lowering awareness) is a design change, not a balance pass,
  and is out of scope for 2.2. It is recorded here so the next person does not
  rediscover it.

- **Save schema stays v11.** One additive boolean on the block record
  (`curtisTookBack`) and one object-shaped session field on `run`
  (`curtisPressureBank`), both hydrated free by `mergeDefaults`. A test strips
  both, rehydrates, and asserts the same plan comes back.

- **Test count 844 → 868.** Twenty-four in `tests/v1-28.test.js`. Six existing
  assertions in `tests/v1-21.test.js` were updated: five pinned constants that
  this build measured and moved, and one — the most-hunted-corner proxy — that is
  a genuine reversal, rewritten with the reason in the test body rather than
  quietly relaxed.

## v1.27 Disclosure Tables (Phase 3.1) — built (branch `claude/disclosure-tables-phase-3-1-46zp26`)

- **Save schema stays v11, and the argument is the one v1.23 already made.** A
  disclosure persists nothing that outlives a run. What it needs is a day-scoped
  record of who has been called, and that is session state on `run` —
  `run.disclosures = { day, entries }`, reset lazily on read rather than in the
  day-end pass, so a save loaded mid-run cannot arrive carrying yesterday's
  calls. Object-shaped, so `mergeDefaults` hydrates an old save for free; a test
  strips the field, rehydrates, and asserts the player can still make a call.
- **The module boundary is the interesting constraint, and it shaped the API.**
  `src/data/disclosures.js` may not require `game-core.js`, but two of the five
  intel types read `policeRaidChance` and `curtisMoveChance`, which are closures
  *inside* game-core. So the file is pure the way `gossip.js` is pure: the caller
  gathers the truth, and this module shapes it and speaks it. Each intel type
  carries a `reads` field naming its selector — documentation a test executes, so
  a type cannot claim to read something the game does not compute.
- **Exact at Bonded, which is a deliberate departure from the spec.** The spec
  said "at the required minBand: jittered", full stop. Applied literally that
  makes `curtis_next_move` — gate Bonded, price $100, the ceiling product — the
  only disclosure in the game that is *never* accurate, because there is no band
  above Bonded to buy. `accuracyFor` therefore returns exact above the gate **or
  at Bonded**, which is the rule `blockIntelView` has followed since v1.20:
  jittered below the top level, exact at it. Every other row is unaffected, and
  the test walks all seven.
- **Both hashes unchanged, and the reason is structural rather than lucky.**
  `selectRunSummary` picks explicit keys and never serializes `run`, so the new
  field cannot reach the harness output; no strategy dispatches
  `BUY_DISCLOSURE`; and no strategy builds a relationship to Warm on a source,
  so none of them would reach the gate even if one tried to spend. The spec
  allowed either outcome — this is the "existing strategies don't reach the
  disclosure gate" case it named, and it is the honest one.
- **The chance reads name three corners, not all of them, and that is a voice
  constraint.** `DISCLOSURE_CHANCE_DEPTH = 3`, worst first. Yalonda reciting six
  percentages off the top of her head is not Yalonda, and it does not fit a
  320px screen either. The cap is presentation only — the numbers that survive
  it are as accurate as the band makes them — and it is commented as such at the
  one place it applies.
- **Biniam needed a door, and that is the only content added beyond text.** He
  sells the block-vulnerability read and there was nowhere on the phone to ask
  him: `STORY_CONTACTS` had Yalonda, Juan, Mina, Dre, Curtis, and Simone. He is
  a personal contact now, gated on `npc.biniam.met` so The Nile still introduces
  him, with `actions: []` — no new verbs, no new Biniam content, just somewhere
  to stand.
- **A quiet night is a product, not an empty response.** Curtis at `invisible`
  has no plan at all. The player still paid, and each source has an authored
  line for it, because "nobody is coming tonight" is worth $50 to someone who
  was about to spend the night defending a corner.
- **One call per person per day, and the cooldown is on the person.** That is
  what makes "buying the same intel twice returns the same text" true without a
  second mechanism: the first answer is already sitting in the inbox and the
  second ask never reaches a debit. A test asserts the refusal is
  identity-equal to the prior state, which also covers the different-product
  case — asking Dre for pressure after buying targets is the same refusal.
- **The browser pass caught two things the unit tests could not, which is the
  argument for running it.** First, `.contact-actions .btn{min-width:0}` beat
  `.disclosure-buy{min-width:72px}` on specificity, so every price button
  rendered 42px wide — under the tap floor at four of five viewports, and
  invisible to a CSS regex asserting the rule exists. The rule is scoped through
  `.contact-actions` now. Second, the row printed the price twice: once on the
  button and again in the `action-copy` sub-label. The sub-label reads
  `No time passes` instead, which is the thing the price does not say.
- **Verified in Chromium at 320 / 375 / 414 / 768 / 1440px**: panel renders, no
  horizontal overflow, no tap target under 44px, zero console errors. The walk —
  buy from Dre, $1000 → $950, his text in the inbox, `Already talked today` on
  the second ask, the feed line — passes at 375px. Phone off disables the entry
  point with `Phone service is off`; below the gate it does not render at all.
- **Test count 813 → 844.** Thirty-one tests in `tests/v1-27.test.js`. The one
  worth flagging is the gossip-complementarity test, which pins its voices at
  Bonded rather than Warm: `setBand` installs a single ledger row, and a night
  of raids appends enough negative rows to walk a Warm fixture under the v1.23
  delivery gate before morning. Left at Warm it failed for a v1.23 reason with
  nothing to say about v1.27.

### Open / deliberately not done

- **Phase 3.2 sources.** Tone and Selam are the obvious next candidates and
  neither is written for it. Tone would sell what Dre already sells; Selam has
  never been written speaking about the corners. Both need an authored register
  before a table row, not after.
- **Nothing sells intel about the player.** The table runs one way. Curtis
  buying a read on the player is the symmetric build and a different system —
  he would act on it, not display it.
- **The 2.2 balance pass on Curtis's pressure constants** is untouched, and
  still gated on the simulator reaching the block layer.

## v1.26 Hustle Menu Jobs + Bill Payment — built (branch `claude/v1-26-hustle-qol-ym7le8`)

- **Save schema stays v11**, and this one is worth being precise about: the spec
  allowed a bump to v12 if the rent obligation needed a "paid this period" field.
  It does not have one and does not need one. `obligations.rentDueDay > run.day`
  **is** the paid-through signal — `PAY_RENT` walks it forward in 7-day steps —
  and `obligations.lastMissedDueDay` is the negative latch that stops one unpaid
  period from accruing a miss every night. Nothing to persist, nothing to
  migrate. A test round-trips a paid save through `inspectSave` to pin it.
- **Two reducer cases already existed, and that is the headline.** The spec was
  written expecting to add `PAY_BILL`. `PAY_RENT` (`game-core.js:7274`) and
  `PAY_PHONE_BILL` (`:7287`) have been there for versions: both spend through
  `spendCash` (dirty pool first, then clean), both reset their obligation, both
  write a feed line, and neither is in `TIME_ACTIONS` or calls `advanceRun`, so
  neither costs a slot or energy. **The missing piece was never the money path.
  It was a button.** No new reducer case shipped, and no second money path.
- **The premise "there is no interactive way to pay rent" was not quite right,
  and the real bug was worse than the stated one.** Rent already had Pay buttons
  in two places — the Household screen and Home's obligations block. What it did
  not have was a button anywhere a player looks when they are told rent is due.
  The Bills accordion, which is the screen that *names* the obligation, was
  display-only by explicit v1.9c design: each row printed the prose "Pay at
  Home" instead of acting. So the game was losable-by-navigation for anyone who
  read the bill and never found the room. v1.26 reverses that decision for the
  two bills the player can settle from cash on hand, and the old comment saying
  rows are deliberately display-only is rewritten rather than deleted.
- **The disabled state mirrors each reducer's guard rather than inventing a
  second rule.** This is the part that keeps a button from lying: `PAY_RENT`
  no-ops before the due day, so the row reads `Due Day 7` rather than offering a
  pre-payment the reducer would drop; short on cash reads `Need $150`. The phone
  row reads `Pay at the Phone Store` while service is off, which preserves the
  existing rule that a dead phone is settled in person and points at the walk-in
  card already on the same screen.
- **The phone bill is $75, not $55.** The spec's example copy said `"Phone bill
  paid. $55."`. `PHONE_BILL` is 75 (`game-core.js:36`) and `WEEKLY_RENT` is 150.
  Both amounts render from the constants and are never hardcoded in the UI, and
  the existing reducer feed lines — `Weekly rent paid in cash: $150.` and
  `Phone bill paid: $75.` — were kept as authored rather than rewritten to the
  spec's phrasing, since changing shipped log copy buys nothing and moves text
  three test files assert on.
- **One `game-core.js` line, and why it was unavoidable.** `PAY_PHONE_BILL` with
  `surface: "store"` is mapped to the `spenard_phone_store` district action, so
  it passes through `districtActionPreflight` and silently no-ops off-district.
  A Pay button on a *phone* that works only in Spenard is a button that lies, so
  the existing exemption — which already excused `surface: "online"` — now also
  excuses a new `surface: "phone"`. It is a guard predicate, not a new case: no
  RNG, no slot, no new state, same `spendCash` path. A test pins that `store`
  still refuses from Downtown while `phone` succeeds.
- **Jobs moved to Hustle, and the tab gate had to go with it.** Jobs was five
  levels deep — Street → Travel → Around Here → Explore Spenard → Activities →
  Jobs. The move itself is presentational, but the Hustle tab was *hidden from
  the nav bar entirely* until `hustle.visible` flipped on the first dirty
  income. Moving Jobs there without touching that would have made legal work
  unreachable on Day 1 — a worse regression than the one being fixed, and the
  one genuine trap in this build. The rail is now fixed at five tabs;
  `hustle.visible` still gates the illegal sections inside `HustleScreen`, where
  the existing locked card explains itself. The market/boost/rob unlock overlays
  name sections rather than the tab, so nothing else moved.
- **Active job status without navigating.** The Jobs row carries the active
  employer, rank, and whether tonight's shift is open (`Shift available`, or the
  selector's own blocked reason), from the same `jobAvailability` selector
  `HomeJobCard` uses. No new selector, and the Home Work Shift shortcut is
  untouched — it dispatches `WORK_JOB` directly and never routes.
- **One dead deep link, caught and repointed.** Travel's quick-shift button
  navigated to `around:job:<id>`, a route that ceased to exist with the move. It
  now crosses tabs through the shell's one `navigate()` funnel
  (`navigate("hustle", "root", null, job:<id>)`), and a contract test asserts
  the string `around:job:` appears nowhere in `ui.jsx`.
- **Contacts and the Activities page.** The duplicate Contacts list under
  Spenard Explore is gone; contacts live in the Phone and under Street → People,
  and did not need a third door. That left Activities holding Wander alone, so
  Wander was promoted to the Explore Spenard root and the one-row submenu was
  deleted rather than left as an extra tap.
- **Both sim hashes are unchanged, and the reason is structural rather than
  lucky.** `tests/simulate-runs.js` requires `game-core.js` and nothing else —
  it never reads `ui.jsx` — so the entire UI half of this build is invisible to
  it by construction. The one core change is reachable only through a
  `surface: "phone"` dispatch, and no strategy dispatches `PAY_RENT` or
  `PAY_PHONE_BILL` at all. 2,000 runs, 0 dead ends, both hashes byte-identical
  to v1.25. This is now written into ARCHITECTURE.md as the general rule: a
  UI-only build that *does* move a hash has touched core by accident.
- **Test count 799 → 813.** Thirteen new tests in `tests/v1-26.test.js` plus the
  contract updates. The new ones pin the pay path (pool order, determinism, no
  slot, no energy, refusals as true no-ops, cross-district rent), the surfaces,
  the 44px bill row, and both halves of the lose condition.
- **The lose condition still fires, and is now measured.** Paying at the last
  moment before the night tick settles the period and accrues no miss. Never
  paying still evicts: misses land on days **8, 15, 22, 29** — one per weekly
  period, not one per night — and the third household warning ends the run with
  `nowhere_to_go`. Adding the button did not make the ending unreachable, which
  was the risk worth testing rather than asserting.
- **Five test files needed contract updates**, all of them pinning the old
  navigation as source text: `plug-market` (the `hustleVisible` prop and the
  Explore Spenard copy), `v1-8` (the conditional-tab rule, now inverted to
  assert *no* tab is conditional), and `ui-contract` (the Spenard page shape,
  the quick-shift target, and a new test for the Hustle income surface).
- **Verified at 320 / 375 / 414 / 768 / 1440px.** The bill row was never a tap
  target — it had no `min-height` at all — so it gains the 44px floor, and the
  Pay button is the one child that never shrinks. Below 360px the row wraps the
  name onto its own line rather than overflowing. Zero horizontal overflow, zero
  console errors.
- **Open / deliberately not done.** Crew wages and Dre's note keep naming their
  own screens instead of gaining Pay buttons — both have real screens, and
  neither is a single fixed amount. Spenard navigation flattening, the
  simulated-web-app bill UI, and any balance change stayed out of scope. The
  Street → People Contacts route is untouched: the spec targeted the Spenard
  Explore duplicate, and People is where Street navigation legitimately keeps
  contacts.

## v1.25 A Simulator Strategy That Reaches Territory — built (branch `claude/v1-24-first-claim-uc4fdx`)

- **The instrument problem, finally diagnosed.** Since v1.20 the phase list has
  said "no sim strategy reaches the block layer" without knowing where they fell
  off. `territoryMetrics` reported only `blocksClaimed`, which was a flat zero
  for every strategy and every rung. It now reports the rungs **below** a claim —
  Eli introduced, recruitable, recruited, his loyalty, the lieutenant stage, and
  soldiers hired — which turns "the sim never claims" into a diagnosis.
- **A fourteenth strategy, `territory`,** rather than retuning `operator`. It
  banks instead of restocking while the ladder is unfunded (`bankForTerritory`),
  leases at the reducer's real gate — `LEASE_GARAGE` needs only
  `!controlled && cash >= 650`, and the sim had imposed `850` on itself — from
  day 2 rather than day 3, and lifts the day-5 recruitment cap, because Eli's
  introduction is a story beat a strategy cannot force.
- **What it unblocked, over 200 runs, against `operator`'s 1 / 76 / 0:**

  | rung | `operator` | `territory` |
  |---|---|---|
  | leases the garage | 1 | **178** (median day 8) |
  | recruits Eli | — | **109** |
  | promotes him to lieutenant | 0 | **81** |
  | hires a soldier | 0 | **24** |
  | **claims a block** | 0 | **0** |

- **And the answer to the original question is no, with a reason.** The ladder
  costs **$1,125** — $650 garage, $35 test route, $120 Eli, $140 soldier, $180
  for the cheapest corner — and this profile reaches the first $650 at **median
  day 8 of a run that ends on day 10**. Four rungs and roughly $475 remain with
  two days left. **Territory is not reachable inside a run's length by any play
  pattern the simulator can express**, which makes it an economy-and-pacing
  question rather than a strategy-tuning one. That is a design finding for
  whoever owns the 2.2 balance pass, and it is the first time the blocker has
  been stated as a number instead of a shrug.
- **Banking beats trading here, and the opposite was tried first.** Keeping a
  $140 trading float so the strategy could still restock while saving sounds
  obviously right and measures worse: garage drops 178 → 116 and lieutenant
  81 → 9, because this profile's trade loop returns less than it ties up on a
  bankroll that thin. The losing variant is recorded in the source comment so it
  is not re-tried.
- **The thirteen pre-existing strategies are behaviorally untouched**, verified
  rather than asserted. `--total N` splits a fixed run budget across strategies,
  so a fourteenth entry re-partitions it (16/15 runs each → 15/14) and makes a
  raw before/after diff meaningless. The check therefore calls
  `summarize(name, 15)` per strategy at a **fixed** count on both sides and
  compares with the new telemetry keys stripped — the same technique v1.20 used.
  All thirteen are byte-identical.
- **One real bug caught by that check.** The first cut computed the buy budget
  *before* the SELL loop; the original read `s.player.cash` *after* it. That
  silently changed the buy budget for all seven strategies that carry product.
  The invariance check found it, which is the argument for running it.
- **Nothing in `game-core.js` changed** — this is entirely a harness build, so
  the save schema is untouched at **v11** and no player-visible behavior moved.
  The hashes moved because the output now contains a fourteenth strategy and six
  new telemetry keys.

**v1.24 was built on `claude/v1-24-first-claim-uc4fdx`, on top of the v1.23 merge
(PR #85, `59b8865`), and merged as PR #86 (`45dbe72`).** Verified: `npm test` **799 passing** (767
through v1.23, 32 new in `tests/v1-24.test.js`), `npm run build` clean,
`npm run check-docs` clean, 2,000-run simulation with zero dead ends,
`--total 200`
`c8b3bf0745871555c326f4861b0a8d576ce149c9fa7bd871e9215b51236092d8`,
`--total 2000` `d9d0fbf1d24c1c7cca8db9db7897f044811a46c4d41ff6a23ca678a0dc3dfb39`
— byte-identical to v1.20, v1.21 and v1.23 at the time. **These are the last
build to hold those hashes**; v1.25 moves both by adding a fourteenth sim
strategy. See the v1.24 section for why they were expected to hold here.

**v1.23 was built on `claude/v1-23-gossip-warnings-dd18a0`, on top of the v1.21
merge (PR #84, `8d27ec3`).** Verified on the branch: `npm test` **767 passing**
(733 through v1.21, 34 new in `tests/v1-23.test.js`), `npm run build` clean,
2,000-run simulation with zero dead ends, same two hashes — **byte-identical to
v1.20 and v1.21**, which is the proof that a build adding a whole new delivery
surface changed nothing in nightly resolution.

**Note on numbering: v1.22 was never built.** The v1.23 spec was written against
a Curtis planner "shipped in v1.22", and no such branch or merge exists — `main`
was at the v1.21 merge when this started. Rather than block, v1.23 builds the
planner it needs (`curtisNightPlan`, the pressure budget, the
`curtisBlockTargets` / `curtisMoveChance` reconciliation the v1.23 spec asked for
under task 6) and telegraphs it. Phase 2.2's remaining scope — a *balance* pass
on Curtis's pressure budget, which v1.23 explicitly held out of scope — is still
open and should be picked up as its own tuning task. See the v1.23 section for
what was assumed.

## v1.24 First-Claim Ceremony — built (branch `claude/v1-24-first-claim-uc4fdx`)

- Built from the "v1.24: First-Claim Ceremony (Phase 4.1)" spec, on top of the
  v1.23 merge. **Save schema stays v11** — `controlledBlockCount(state) === 0` is
  a derived read over the board, so there is nothing to persist and nothing to
  migrate.
- **The idea, and why it was overdue.** Until now the first corner the player
  ever put their name on read exactly like the sixth. Phase 2 got to both of the
  other outcomes first: v1.21 wrote the copy for *losing* a corner and v1.23
  wrote seven voices *warning* about one. So the game could tell you a corner was
  threatened and tell you it was gone, and had nothing to say about winning the
  first one. Claims 2-6 are untouched by design — the generic line is correct for
  an increment, and only the first claim is a beginning.
- **Four surfaces, one branch.** `isFirstClaim` is read in the `CLAIM_BLOCK`
  case **before** the ownership write, and gates: a titled consequence card
  ("Your Corner"), a same-day phone text, its own feed line, and one
  neighborhood-channel observation. Everything the case already did — cash,
  `capturedDay`, the soldier posting, Curtis's `submission / claimed_block` row,
  `networkEscalation`, the table-driven `defiance / territory_claim` broadcast in
  `advanceRun` — is untouched on every claim including the first.
- **`pushConsequence` gains an optional fourth argument, `title`.** The first
  titled card in the game. Purely additive: every existing three-argument caller
  gets `title: ""`, and an old save's queued card has no field at all, which the
  renderer reads as falsy and draws exactly as before. This is deliberate
  groundwork for 4.2 and 4.3, which are the same shape of moment.
- **The spec's observation could not ship as written, and this is the finding
  worth carrying forward.** It asked for `location: blockId` on the
  `neighborhood` channel. That combination reaches **nobody**:
  `CHANNELS.neighborhood` sets `presence: true`, so `couldObserve` compares
  `location` against `NPC_PRESENCE_AREAS`, which holds **district** ids only. A
  block id matches no NPC's area list and the row lands in zero ledgers. This is
  the identical trap v1.23 hit from the other direction and filed as its finding
  #4 — **it has now cost two builds, and it is a property of the channel, not of
  either build.** Shipped as `location: HOME_DISTRICT_ID`, which is what both
  neighbouring territory observations already do (`heat_exposure / police_raid`,
  `defiance / block_lost_to_curtis`). Nothing in the lens math reads `location`;
  the block is named in the card, the text and the feed, where a player can
  actually read it. The suite asserts no NPC has a block-level presence area, so
  the next author to reach for a block id fails loudly instead of silently.
- **The spec's `source: "direct"` was also dropped**, for the same structural
  reason: `broadcastObservation` derives `source` from the channel, so a
  neighborhood carry is `source: "neighborhood"` and a caller-supplied `source`
  alongside a `channel` is ignored by design. The rows are neighborhood gossip,
  which is what they are.
- **Curtis cannot hear it, by construction.** He is not on the `neighborhood`
  channel at all (`NPC_CHANNELS`), so the new row is structurally unreachable to
  him; his copy of this event is the `submission / claimed_block` row that has
  always fired and still fires on every claim, first or sixth. Asserted both
  structurally and across four seeds. `broadcastTracked` only raises awareness on
  the `network` channel, so the ceremony adds no second awareness bump — measured
  as a delta against the second claim.
- **Deshawn or nobody.** `recruited && status === "active"` sends the text under
  his name; departed, arrested and never-recruited all fall back to "Word Around
  Town" with no sender. The text is same-day by construction —
  `pushPhoneMessage` stamps the current day and slot — and a player whose phone
  is off gets it in `heldInbox` rather than losing it, which is the existing
  behavior for every message in the game.
- **Both sim hashes are unchanged, and the reason was measured.** The Phase List
  has recorded since v1.20 that the `operator` strategy claims zero blocks across
  2,000 runs. Confirmed and widened here: **it is not just `operator`** — all
  **thirteen** strategies report `claimed: 0` over 2,000 runs, so no strategy
  exercises the ceremony and neither hash could move.
- **Correction to this section's first draft, and a trap worth knowing about.**
  It originally claimed `operator` "never buys the garage and never recruits
  anybody — `garage: 0, anyCrew: 0` over 200 runs." **That measurement was
  invalid.** `normalizeSeed` (`src/events/random.js:10`) falls back to a single
  constant for any seed where `Number(seed)` is not finite, so **every
  non-numeric string seed produces the identical run**. The probe used
  `play("sim-" + i, …)`, which is 200 copies of one run, not 200 runs. Re-measured
  with numeric seeds — the form `summarize` itself uses, `play(1000 + i, name)`:

  | strategy | leases the garage | recruits anyone | **both in one run** |
  |---|---|---|---|
  | `operator` | **1/200** | 76/200 | **0/200** |
  | `stickup` | 18/200 | 1/200 | **0/200** |

  The garage is **reachable but rare**, landing around day 9. The real blocker is
  the last column: **no strategy has ever held the garage and a crew member in
  the same run.** Territory needs garage → Eli → promotion → soldier, and the
  trade loop spends 58% of cash on inventory every iteration, so the $650 lease
  and the recruitment cost never clear together. That is resource competition,
  not a missing code path — and it is a more tractable target than "reach the
  block layer" implied. `claimed: 0` is unaffected: that figure came from real
  CLI output, which already uses numeric seeds.
- **Viewports verified in a real browser**, not by inspection: 320 / 375 / 414 /
  768 / 1440px, zero horizontal overflow at every width, the untitled card
  measuring exactly 44px so the tap-target minimum holds, and zero console
  errors. The titled card grows to fit its heading and nothing else moves.
- **`scripts/check-docs-version.js` hardened.** It read ARCHITECTURE.md's version
  with a non-global `String.match`, so it took the *first* "current as of"
  anywhere in the file — a historical note further down would silently become the
  version under test. It now takes the highest match.
- **Open / deliberately not done.** No tier-transition scenes (4.2), no capstone
  sit-down (4.3), no balance pass on Curtis's pressure constants (2.2), no
  changes to the copy for claims 2-6, no new `STORY_REGISTRY` card — this is a
  consequence of an action, not a drawn beat — and no changes to the Territory
  page.

## v1.23 Attack Telegraphing Through Gossip Channels — built (branch `claude/v1-23-gossip-warnings-dd18a0`)

- Built from the "v1.23: Attack Telegraphing Through Gossip Channels" spec, on
  top of the v1.21 merge. **Save schema stays v11** — the warnings are transient
  phone texts derived from existing planner output and existing disposition
  state, so there is nothing to persist and nothing to migrate.
- **The idea.** Before Curtis's people move, the block knows. Whether that
  reaches the player is a relationship question: at Warm and above somebody texts
  naming the corner, below Warm nobody does, and a player with no warm
  neighborhood relationships meets him cold. It is the first place in the game
  where the social layer pays a **tactical** dividend rather than a content one.
- **The silence is the mechanic.** There is no negative branch anywhere in the
  delivery path — an NPC below Warm is simply not in the candidate set. The one
  extra gate is that an **empty ledger can never speak**, asserted explicitly so
  no future default can hand a voice to someone nobody has ever observed.
- **The nightly plan.** `curtisNightPlan(state)` in `src/selectors.js`: which of
  the player's corners his people are working and how hard, as
  `[{ blockId, name, weight }]`. Ranked by `curtisVisibility` then
  `earningPotential` then id, cut to the phase's depth, then the phase's pressure
  budget spent greedily and capped at 2 a corner — `ambient [1]`,
  `watching [2, 1]`, `approaching [2, 2, 1]`. Weight 2 is "coming hard", 1 is
  "just looking", and the distinction is the player deciding between two soldiers
  and one. A pure read: nothing stored, no draw off the RNG stream, so the plan
  raised the night before re-derives identically when the day arrives.
- **Task 6 resolved here, because v1.22 did not.** `curtisBlockTargets` is now
  the plan flattened. The old list only *ranked* — no phase visibility gate, no
  exclusion of visibility-0 corners — so at `ambient` Pherris named the Minnesota
  Off-Ramp as next while `curtisMoveChance` returned a flat zero for it, and at
  `approaching` she named the Spenard Rec Center Lot, a corner he never comes for
  at any phase. One list, gated by exactly what the night is gated by.
- **Timing: the warning is raised for TOMORROW night, not tonight.** The spec
  said to emit during the day-end pass before `resolveSoldierOperations`, and
  also that the warning must arrive the morning of the attack. Those cannot both
  hold — a neighborhood carry on tonight's plan lands the morning *after* the
  corner changed hands. The pass therefore runs after
  `resolveSoldierOperations` (ownership settled), `settleCurtisNight` (phase
  settled) and `resolveCrewTracks` (payroll settled), which is the first point
  where every input to the next night's plan is final, and the standard one-day
  carry puts it in the player's hand on the morning of the night it describes.
- **`Exposure.queueObservation`.** `broadcastObservation` is right when the
  question is "who could have picked this up" and wrong when the caller already
  knows. The neighborhood channel's one-to-two-day jitter would deliver a third
  of these after the corner was gone, so the emitter picks the audience and the
  slot. Rows whose slot has already passed are still **queued** rather than
  written inline — that is what makes Deshawn's tier-3 "evening before" a slot
  number instead of a special case, since everything leaves the queue through the
  same door and that door is where the phone text is made.
- **`resolveObservationQueue(state, onDeliver)`.** One optional hook, called per
  row that lands. `drainObservations` in game-core is now the single call site
  for the drain, so a gossip row cannot land without the text that is the point
  of it — and the engine still knows nothing about phones, which is the
  dependency rule that module opens with.
- **A twelfth observation category, `territory`, weighted 0 in all four
  archetypes.** Every other category is evidence *about the player*; this is
  evidence about **Curtis**. It routes and it lands in ledgers, and it must never
  move a number — otherwise a bad week for the player's corners would quietly
  make Mina like them. Deliberate, authored, and asserted in the suite.
- **Deshawn is reach and timing, never the plan.** Read through
  `Crew.modifierTier` rather than a bare `getActiveCrew` check, so departed,
  arrested, never-recruited and loyalty-0 all revert the player to the
  no-Deshawn behavior with no extra branch. No Deshawn: the plan's **top target
  only**. Tier 1: **every** targeted corner. Tier 2: + the pressure weight in the
  text. Tier 3: + it arrives the **evening before**. He does not deliver it
  himself unless he happens to be the closest person — his network hears earlier
  and wider, and whoever the player is closest to says it.
- **Seven authored voices, not a template.** Mina, Juan, Yalonda, Deshawn, Tone,
  Biniam and Pherris, in `src/data/gossip.js`, each with a warning line and a
  morning-after raid line. Selam is deliberately absent: she has never been
  written speaking about the corners. Membership in that table is only the
  authored half of eligibility — the routing half (on the `neighborhood` channel,
  reachable in the corner's district) is checked against `propagation.js` at
  emission, so nobody can be given a line they had no way to have heard.
- **Curtis never sees it, by two independent rules**: he is not on the
  `neighborhood` channel, and `territory` does not clear his network filter.
- **Police raids get the reactive half only.** A raid raises a second,
  corner-scoped `territory / police_swept_corner` observation beside v1.21's
  district-scoped `heat_exposure / police_raid`, which is untouched and still
  carries the disposition consequence. It cannot be one row: `location` has to be
  a **district** for `couldObserve` to route it and a **block** for the text to
  name a corner. No predictive police warning exists or should — they answer
  Heat, which can move at any time.
- **One voice, one text a day** (`run.gossipVoices`, session-only, hydrated
  additively). When more corners are warned than there are people willing to
  call, the corner that gets said out loud is the one he wants most — the
  planner's comparator is exported and shared rather than restated, so the two
  orderings cannot drift.
- **Two surfaces, not one.** Pherris's level-3 block card keeps the standing
  strategic read on the Territory page; the gossip text is the event-driven
  complement on the Phone. They can overlap without conflict, and the suite
  asserts the Territory page renders no gossip copy.
- **Open / deliberately not done.** No balance pass on the pressure budget (the
  numbers are a first authored position, not a measured one); no predictive
  police warning; no new NPC; no UI changes; Downtown blocks still unauthored —
  when they arrive the gossip pass iterates the same block list the planner does.

**v1.21 merged as PR #84 (`8d27ec3`)**, on top of the v1.20 merge (PR #83,
`43652c3`): `npm test` 733 passing, 2,000-run simulation with zero dead ends,
both hashes byte-identical to v1.20.

**Phase 1 of the Godfather adaptation is closed, and its asterisk is now closed
too** — 1.1 Tone recruitment (v1.18), 1.2 Pherris recruitment and 1.3 Deshawn
tier retro-gate (v1.19), 1.4 lieutenant typed modifiers (v1.20), and **4.1
First-claim moment in v1.24**, the ceremony pass the phase list wanted alongside
the mechanic and which ran six builds late. **Phase 2.1 (splitting police raids
from Curtis moves) shipped in v1.21**, and **Phase 2.3 (attack telegraphing)
shipped in v1.23**, which also built the Phase 2.2 planner it depends on. What is
left of 2.2 is the balance pass on Curtis's pressure budget — still gated on the
simulator reaching the block layer, which v1.24 measured and localized to the
garage purchase.

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
