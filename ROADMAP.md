# 907Hustle — Build Roadmap

Design target: `VISION.md`. What actually exists today: `PROJECT_STATUS.md`.

## Standing correction — do not plan against a day count

**The run has no fixed length**, and since **v1.31** that is true of the code as
well. A run ends on a lose condition — an obligation you cannot pay, health at
zero, Heat at 15 — or when the player chooses to call the final score, on any
day. An unpaid run still reaches day 29 before eviction; a solvent one does not
stop at all.

**This correction used to be aspirational.** Until v1.31 `confirmDayEnd` ended
every run on a day count around day 10, while this section said it did not.
Nothing on this roadmap should be scoped, deferred, or judged unreachable on the
strength of a day count — and the v1.25 note below that territory "is not
reachable inside a run's length" turned out to be the cap talking, not the
economy: at the 40-day harness horizon the block layer is reached in volume.
Territory is intentionally mid-to-late-game
content, funded by early economy systems (weed, booze, robbery tiers) that are
still being built out.

---

## Shipped — v1.29 Playtest QoL Pass

Seven friction items off the Aug 17 playtest. No new systems; everything here
makes an existing one readable or honest.

- The feed shows three wrapped lines instead of one clipped one, reversing the
  v1.26 space-saving decision on the strength of a playtest that measured its
  cost. Verified across 320-1440px: no clipping, no ellipsis, no overflow.
- Phone texts are dismissible individually and in bulk, and a job offer can be
  accepted or declined from the phone through the `ACCEPT_JOB` / `DECLINE_JOB`
  cases that already existed. Answering an offer retires its text.
- 907List moved onto Hustle beside Jobs, out of the More menu and the Phone. The
  Home laptop keeps its row and deep-links into the tab.
- A lost run names the obligation that ended it, with days survived and net gain
  on the end screen. The consequence stack no longer covers that screen.
- Missed shifts fire you after three **consecutive** days away, with a feed
  warning and an employer text on the way. Working any shift resets the count.
  Day labor exempt, Night Owl de-scheduled rather than fired, grace on hire day,
  no RNG.
- Identity reads as Rank everywhere a player can see it. Internals unchanged.
- The regular-customer-price card states both trades in plain language.

889 tests, both simulation hashes unchanged, zero dead ends across fourteen
strategies, save schema v11. **The unchanged hashes are a coverage statement:**
the simulator never holds a job, so the attendance ladder is invisible to it.
`tests/v1-29.test.js` is what verifies that system.

Deferred: crew wages before the garage (a real bug, filed High, out of this
build's scope) and the gym pricing rebalance.

## Shipped — v1.28 Curtis Pressure Balance Pass (Phase 2.2)

**Phase 2.2 closes.** Curtis stops being a first-authored guess and becomes a
measured adversary. His base chance was swept 0.04–0.15 at every phase (twice —
once against the old code as a control, once with this build's new terms live)
and shipped at **0.05**; two phase multipliers moved because the measurement said
which and why. He reads the player's Heat above 8 and gets luckier, an empty
corner is finally worth less than a corner with one person on it, and he holds a
grudge about corners he has already taken back once. Save schema stays **v11**.
**Both sim hashes unchanged** (`25afb74e…` / `f10432b1…`) — which was *not* the
expected result and is a finding in its own right. 868 tests.

- **The blocker was never real.** 2.2 sat open on the simulator's 10-day cap.
  That cap is an instrument boundary for hash comparability;
  `tests/measure-lieutenant-modifiers.js` starts from a corner-holding state and
  resolves nights through the real reducer, and has since v1.20.
- **The gradient, at 300 runs × 10 nights × six corners:** `invisible` 0.000,
  `ambient` 0.093, `watching` 0.181, `approaching` 0.341. Strictly monotonic;
  ambient is 0.51 of watching and approaching is 1.88×. All three sit 3–10% under
  target, which is the closest the spec's mandated 0.01 sweep increment reaches —
  0.06 overshoots watching by 18% where 0.05 undershoots by 10%.
- **Police pressure was already flat across phases** (0.171–0.174) and needed no
  work. The v1.21 split had delivered it; v1.28 verified and left it alone.
- **The unchanged hashes mean the simulator does not cover this layer.** The
  `territory` strategy claims zero blocks in 200 runs, so no strategy ever owns a
  corner and nothing the build changed is reachable from that harness. It does
  prove the thirteen original strategies behavior-identical for free — but an
  unchanged hash must never be read as coverage of the block layer.
- **Two spec items were deliberately not built as written**, both documented in
  PROJECT_STATUS.md: "probe the weakest" stayed out of `curtisNightPlan` (a
  garrison-reading planner would make every warning falsify itself), and the
  recapture key is "a corner he has taken back once" rather than "a corner taken
  from Curtis" (every corner starts his, so the spec's condition ranks nothing).
- **One target was missed and filed rather than faked.** An acted-on warning
  saves the corner 0.406 of the time at watching against a 0.60 target. The
  ceiling is arithmetic — risk is linear in headcount, the block cap is 3, and
  Eli's balanced placement converges corners toward equal staffing, so a player
  at two soldiers a corner tops out at a 33% reduction. The levers are the block
  cap, a non-linear defense curve, or Eli's placement policy; all three are
  outside 2.2.

### Next

**3.2 shipped in v1.30 — see the section above; this paragraph predates it.**
The Godfather critical
path is now done through 3.1, and 2.2's closure removes the last open item behind
it. Two things this build surfaced and deliberately left:

- **The escalation loop has no counter-pressure.** Losing a corner raises his
  awareness, and `awareness.floor` ratchets and never falls, so a player who slips
  once is pushed toward slipping again. Retaking a corner lowering awareness is a
  design change rather than a balance pass.
- **The warning's tactical ceiling is a defense-model question**, not a Curtis
  question. Whoever picks it up should start at `SOLDIERS_PER_BLOCK_CAP` and Eli's
  `operationPolicy`, not at `src/data/territory.js`.

---

## Shipped — v1.35 The Risk Term, and What It Cannot Do Alone

v1.34's one open item was the risk-free trading path. The premise held on re-run,
and the fix is a mechanic rather than a number — so this build shipped the
mechanic and let the measurement rule on it.

- **Both legs now carry a Heat term.** `BUY += floor(qty/8)`, `SELL += floor(qty/4)`,
  tiny and ambient; the carry (`BUS_TRAVEL`) stays free by design. Six new unit
  tests pin the boundaries.
- **The finding: a Heat term alone cannot move this balance, at any rate.** Swept
  `8/4` down to per-unit `1/1`, `hustler` wanders 96–116% with no relationship to
  Heat, and traders are arrested zero times at peak Heat 12. `arrestPlayer` fires
  only from `boost`/`stick` — there is no bust path for trading — and Heat 15 is
  electively shed via `LAY_LOW`. The consequence surface Heat is meant to feed is
  the deferred event-card content.
- **Decision: ship the substrate, defer the teeth.** `hustler` stays ~110% this
  build on purpose; the 65–90% target moves to v1.36. Fifth build running where
  "broken" meant "never exercised" — here, a Heat mechanic with nothing wired to
  the act it prices.
- **Task 2 (cross-market intel) cut.** The player learns the spread by traveling,
  *Drug Lord*-style; the price-selling NPC is a future character with their own
  arc, not a table row now.
- **Task 3 (capital curve) measured, not fixed.** `arbitrage`'s 17% floor is
  cash: **+$2,000 → 67%**, while cargo and free fare do nothing. v1.36 floor work
  is capital (bank interest, lenders, plug credit), then the plug per-buy cap.
- 961 tests. Both hashes moved. Zero dead ends. `arbitrage` margin **+38%**.
  Engine change is two Heat lines; save schema held at **v11**.

### Next — v1.36 authors the teeth (and can then chase the floor)

The substrate is live; the risk premium needs a consequence wired to Heat.
**Author the event-card / Exposure pass**: at higher Heat, more dangerous
encounters fire during movement, day-end and location visits — a stop while
holding, a nosy passenger, Curtis's people on the bus — each a moment with
choices, converting Heat into real expected-value loss. Only once those exist
does the 65–90% target become measurable, and only then may the **capital floor**
move (bank interest [`86bbe0m8g`], lenders [`86bbamm10`], plug credit), because
raising the ceiling before the teeth land simply turns 110% into 150%.

**5.2 Downtown still stays behind both.** It is currently the sell side of the
only profitable trade in the game, so under the scaling rule it must raise ambient
heat, wage load and loss exposure in step with the volume it unlocks. Adding it
before the trading path's risk term has teeth would ship the thesis broken at
twice the size.

Still on the inventory, unfixed: un-clamped `missed_obligation` observations, and
story pacing that exhausts a seven-day registry by ~day 20 of a forty-day run.

---

## Shipped — v1.34 Crime, Played Competently

The economy pass v1.33 called for, run under a design position stated up front:
**the legal path is the highest expected-value outcome; crime is faster, riskier,
and worse in expectation; smart crime approaches the job's net return without
beating it.** And under one instruction — **do not tune anything until the
instrument has played the game competently.** Nothing was tuned.

- **Eighteen of eighteen strategies had never traded cross-market.** The harness
  bought the cheapest product *in the market it was standing in*. In-market
  spreads are non-positive by design — widest observed **+1.9%**, and that is
  integer rounding — so all trading profit is arbitrage, at **+45% to +76%**. The
  −6% to −22% margins were the route run backwards.
- **Two profiles that take it:** `arbitrage` (route alone) and `hustler` (route
  plus job). Both price *both* districts before moving, because standing still is
  a legal move; both buy the week pass, $45 against ~$470 a run in singles.
  Margin **−13% → +17-22%**, bus rides **105 → 27.6** a run.
- **The answer: pure crime lands at 17% of the job, the hybrid at 110%.** Both of
  the position's out-of-band conditions at once. The margin is fine; the
  constraint on the first is the **capital curve**, and the cause of the second
  is that **the trading path pays no risk premium**.
- 955 tests. Both hashes moved. Zero dead ends. No game-core changes.

**The design position is now written into `ARCHITECTURE.md` under Economy
philosophy**, including the scaling rule: every district or tier added from here
widens the criminal distribution in both directions while the legal path stays
flat.

**Four systems in four builds where "the engine is broken" was really "the
instrument never exercised it."** Rent, rest, the note, and now the route.


## Shipped — v1.33 Pressure and Attrition

v1.32 left a four-item work list. **Measuring it first cut the list to one.**

- **Heat is not a ratchet.** The strategies shed roughly what they gain through
  `LAY_LOW`; the elective decay is real and used. No change.
- **Health was not a one-way slide.** `SLEEP_HOME` heals 12 for one slot and the
  harness had **never dispatched it once**. Runs ending `killed` went from ~50
  in 90 to **1 in 96** on that one rule. The threshold was picked off a
  sensitivity curve, not taste.
- **Dre's note had never been borrowed** — `settle()` declined it on every seed
  since the harness was written. Exercised for the first time by a sixteenth
  strategy, it turned a $1,000 principal into a mean $12,700 by day 40. Capped
  at twice the principal; the collector ladder deliberately untouched.
- 945 tests. Both hashes moved.

**Three systems in three builds where "the engine is broken" was really "the
instrument never exercised it."** That is now the first thing to check.

### Next

**Evictions rose 20% -> 28%, concentrated entirely in the thin-margin trading
profiles**, whose lose condition moved from death to eviction once they started
resting. Whether a thin trading margin should survive rent plus recovery is the
open balance question, and it is the natural v1.34: the first economy pass with
an instrument that reaches employment, territory, obligations, attrition and
debt. Everything it would tune is now measured.

**5.2 Downtown stays behind it.** It raises wage and heat load, and wants an
economy whose costs are known.

Still on the inventory, unfixed: un-clamped `missed_obligation` observations,
and story pacing that exhausts a seven-day registry by ~day 20 of a forty-day
run.

---

## Shipped — v1.32 Make the Obligations Real

v1.31 let runs reach forty days. The first honest economic reading that produced
showed that **rent was free**: Deshawn's grace re-armed once per rent period
against a rent that fell due once per rent period, so eviction — the primary
lose condition — was unreachable in 100% of runs where he was active.

Not a v1.15 bug. That design was correct for a ten-day run where he ate at most
one miss; **v1.31 removed the boundary and a bounded perk became an infinite
subsidy.** The grace now defers a miss by a day instead of cancelling the week,
which is what its own log line has always said. Schema stays v11 — the deferral
is derived from the absence of the period stamp.

- **Fourteen of fifteen strategies had never dispatched `PAY_RENT`.** Fixing the
  grace alone would have evicted the `territory` strategy in 100% of runs and
  re-broken the block layer v1.31 unlocked, so bills became universal with
  `trainer` as the documented non-paying control. Result: 18% evictions,
  territory still claiming, `worker` at 0.
- **Health telemetry corrected the review's diagnosis.** The harness dispatches a
  heal twice in 90 runs; the drain is broad (encounters 44%, events 19%,
  `WORK_JOB` 16%) and nothing restores it. Measured, not fixed.
- 934 tests. Both hashes moved.

### Next

**v1.33 is the pressure-and-attrition pass**, and it has a named work list
rather than a hypothesis. Everything below was tuned against a ten-day run and
is unbounded at forty: Dre's note compounding daily with no ceiling, Heat having
no passive decay, health being strictly monotonic downward, and encounter volume
scaling linearly with run length. They are one cluster and want the same
measure-first treatment rent just got. **5.2 Downtown stays after that** — it
raises wage and heat load, and should be tuned against an economy whose costs
are bounded.

---

## Shipped — v1.31 The Run Has No Fixed Length

**The standing correction at the top of this file was aspirational until now.**
`confirmDayEnd` ended every run on a day count around day 10 — no obligation,
health or Heat check in the condition — and ARCHITECTURE.md said `RUN_DAYS` "has
never terminated a run," which was false when it was written. Six builds of
balance work were measured against a boundary the documents denied existed.

- **A run ends four ways now**: an obligation you cannot pay, health at zero,
  Heat at 15, or the player calling the final score on any day they like.
  `EXECUTE_FINAL_PLAN` was previously locked to one specific day.
- **Dre's note got its own clock.** It used to inherit `run.checkpointDay`, so
  removing the checkpoint naively would have deleted a lose condition. Seven-day
  term from the day it is taken.
- **The block layer is reachable for the first time.** Not an economy problem —
  the garage landed on day 7.3 and the run was taken away at day 10. At the
  40-day harness horizon `territory` goes from **79 net worth (last) to 1,452
  (second)** and claims corners in volume, so every Curtis constant since v1.20
  is finally verifiable.
- Save schema stays **v11**. 920 tests.

### Next

**The instrument is honest now, so balance can be read off it.** Three things
this build surfaced and deliberately did not act on:

- **Criminal strategies get worse over 40 days** (`cautious` 165 → 88, `thief`
  273 → 87) while legal work and brokerage compound. The ten-day window was
  flattering the crime economy. This is the first honest look, and it wants a
  balance pass of its own rather than a tuning tweak inside the build that
  changed the ruler.
- **`legal_worker` tops the table without ever paying rent** and is not evicted
  inside 40 days. Either the eviction ladder is too slow or the strategy is
  exploiting a gap; worth knowing which before reading its number as skill.
- **Territory income now measurable at scale** ($75k across 13 runs). Nobody has
  ever balanced against that figure because nobody could see it.

---

## Shipped — v1.30 Crew Wages, Phase 3.2 Sources, Sim Employment

**3.2 is shipped, and Phase 3 is closed.** Four of its six named NPCs shipped in
3.1; Tone shipped here with a product of his own; Selam, Pherris and Deshawn are
excluded in the file with the reasoning written down rather than left to the next
build to re-derive. Save schema stays **v11**. 908 tests. **Both hashes moved**
(`fb6725fc5bb27fe0c68118d94fa66388b7706c584b451e020bf798ce458e9252` /
`8a70844536f937141b787fef8b919a39fc95c6b86bf33f7ab2dcb55c6d0a4f45`) — the
fifteenth strategy re-partitions the run budget, and the fourteen originals were
proved byte-identical at fixed run counts.

- **The crew wage gate is gone.** `PAY_CREW` required owning *and* standing in
  the garage, which crew recruited through Exposure scenes never needed. The trap
  had no exit: arrears accrued, grace ran out, loyalty bled a point a night, and
  the member walked with the Pay button disabled throughout. Filed `86bbfz17r`,
  deferred out of v1.29, fixed here.
- **Tone's `territory_status` needed a field the game did not have.** 3.2
  described his product as information the player already has. The player had it;
  the engine did not — per-corner casualties went into the feed as text and were
  discarded. One additive `lastCasualtyDay` stamp, v11 intact.
- **The simulator sees employment.** v1.29's attendance ladder had never run in a
  simulated day-end. `worker` holds a job in every run, works 10 shifts, and
  reads 0 on missed shifts, firings, missed rent, lapsed phone and warnings
  across 2,000 runs.

### Next

**Phase 3 is done; the open threads are 5.1 combat and the escalation-loop
counter-pressure question v1.28 left.** Two things this build surfaced:

- **A responsible-citizen strategy makes less cash with 907List than without it**
  ($226 against $505 at the same reserve). Inventory value is not cash so the
  comparison is not like-for-like, but a supplemental income stream that lowers
  the cash line is worth measuring properly.
- **Selam has no authored register for anything operational.** She was named in
  3.2 as an obvious intel candidate and is the wrong character for it. If she is
  wanted as a source, that is a writing build first.

---

## Shipped — v1.27 Disclosure Tables (Phase 3.1)

The intel economy opens. NPCs sell what the engine already knows — which corners
Curtis is working tonight, how hard, and what the police will roll against on
each one — and how accurate the answer is depends on how well they know you.
Save schema stays **v11**; the day-scoped purchase cache is session state on
`run`, same pattern as v1.23's `gossipVoices`. **Both sim hashes unchanged**
(`25afb74e…` / `f10432b1…`) — no strategy dispatches `BUY_DISCLOSURE` and no
strategy builds a relationship to Warm on a source. 844 tests.

- **Five intel types, seven table rows, five sources.** Dre climbs the whole
  ladder alone (targets at Warm, pressure at Trusted, the one corner they keep
  naming at Bonded); Mina sells the target list a band dearer; Yalonda and Juan
  read police patterns off their own street; Biniam repeats what the table said
  upstairs. Prices $30–$100, per ask.
- **Accuracy is the band.** At the gate the read is jittered — ±15% on numbers,
  one corner added or dropped on lists, a pressure weight off by one. Above the
  gate it is exact. Bonded is exact because it is the ceiling, the same rule
  `blockIntelView` has followed since v1.20.
- **Deshawn is structurally absent, and a test enforces it.** He is off Curtis's
  network by design and cannot sell what is on it. Pherris is absent too: her
  intel is a subscription she already sells.
- **One call per person per day**, and the cooldown is on the person, not the
  product — which is also what makes buying the same intel twice a no-op rather
  than a second debit.
- **All jitter is `stringHash`, no RNG draw.** A reload cannot reroll what
  somebody already told you, and buying intel cannot become a cause of the night
  it describes.

### Next

- **3.2, wiring additional sources.** Tone and Selam are the obvious candidates
  and neither has a written register for this yet. Tone hears the wire and would
  sell something Dre already sells; Selam has never been written speaking about
  the corners, and giving her a line to fill a table would be the wrong Selam.
  Both need authored voice before a row, not after.
- **Nothing yet sells intel about the player.** The table runs one way. Curtis
  buying a read on the player's corners is the symmetric build, and it is a
  different system: he would act on it rather than display it.
- ~~The 2.2 balance pass on Curtis's pressure constants is still outstanding and
  still gated on the simulator reaching the block layer.~~ **Shipped in v1.28,
  and the gate was never real** — the territory harness had been the right
  instrument since v1.20.

---

## Shipped — v1.26 Hustle Menu Jobs + Bill Payment

UI plus one guard predicate. Save schema stays **v11** — the rent obligation
already tracks paid-through in `rentDueDay`, so there was nothing to add and
nothing to migrate. **Both sim hashes unchanged** (`25afb74e…` / `f10432b1…`),
which is structural: the simulator never reads `ui.jsx`, and no strategy
dispatches either pay action. 813 tests.

- **Jobs moved to the Hustle tab**, legal work first: Jobs → Market → Boost →
  Stickup → Shark. It had been five levels down under Street. The tab is no
  longer hidden until dirty income lands — legal work exists on Day 1, so a
  conditional tab would have stranded it. `hustle.visible` now gates only the
  illegal sections inside the screen.
- **Rent and the phone bill are payable from the Phone's Bills list**, through
  the pay actions that already existed. No new reducer case, no second money
  path, no slot cost. The lose condition now fires on an empty wallet rather
  than on failing to find the right room.
- **The Spenard Explore duplicates are gone** — Jobs, Contacts, and the
  Activities page that was left holding one row.

### Next

- Crew wages and Dre's note are the two Bills rows still without a Pay button.
  Wages are the better candidate: `wageDue` is already a single accrued number,
  and `PAY_CREW` is the one obligation handler that still subtracts from
  `player.cash` directly instead of going through `spendCash`, which means it is
  also the one that charges dirty-spend financial heat by side effect. Worth
  reconciling before it gains a second surface.
- The phone row's `Pay at the Phone Store` state is correct but terse. A dead
  phone is the one bill you cannot settle from the couch, and that could read as
  a consequence rather than a disabled reason.

---

## Shipped — v1.25 A Simulator Strategy That Reaches Territory

Harness only — `game-core.js` is untouched, so the save schema stays at **v11**
and nothing player-visible moved. **Both sim hashes moved, deliberately and for
the first time since v1.20**: `--total 200`
`25afb74e10487dee6fc62641d944d3cea093873f28c740ba43e10bb0828d6dc1`, `--total 2000`
`f10432b1f61624cbc8df35e299a2d36ca369e1e822ca0d6578a337562e524665`. Zero dead
ends across fourteen strategies; 799 tests passing.

Since v1.20 the roadmap has carried "no sim strategy reaches the block layer" as
the highest-value simulator work outstanding, without knowing **which rung** they
fell off — `territoryMetrics` reported only `blocksClaimed`, a flat zero for
everyone. It now reports the rungs beneath a claim, and a fourteenth strategy,
`territory`, is built to climb them: it banks rather than restocking while the
ladder is unfunded, leases at the reducer's real $650 gate instead of the
self-imposed $850, and drops the day-5 recruitment cap because Eli's
introduction is a story beat no strategy can force.

| rung, over 200 runs | `operator` | `territory` |
|---|---|---|
| leases the garage | 1 | **178** (median day 8) |
| recruits Eli | — | **109** |
| promotes him to lieutenant | 0 | **81** |
| hires a soldier | 0 | **24** |
| **claims a block** | 0 | **0** |

**The answer is still no, and now there is a reason.** The ladder costs
**$1,125** — $650 garage, $35 test route, $120 Eli, $140 soldier, $180 for the
cheapest corner — and the first $650 arrives at **median day 8 of a run that ends
on day 10**. Four rungs and ~$475 remain with two days left. **Territory is not
reachable inside a run's length by any play pattern the simulator can express.**
That reframes the 2.2 balance pass blocker from a harness problem into an
**economy-and-pacing** question, which is a design call rather than a tuning one.

- **Banking beats trading, and the opposite was tried.** A $140 trading float so
  the strategy could restock while saving measures *worse* — garage 178 → 116,
  lieutenant 81 → 9. The losing variant is recorded in the source so it is not
  re-tried.
- **The thirteen existing strategies are behaviorally identical**, verified at a
  fixed 15 runs each with the new telemetry keys stripped. A raw before/after
  diff would have been meaningless: `--total N` splits a fixed budget, so a
  fourteenth strategy re-partitions it. That check caught a real bug — the first
  cut read the buy budget before the SELL loop instead of after, changing
  behavior for all seven product-carrying strategies.

## Shipped — v1.24 First-Claim Ceremony — **Phase 4.1, and the Phase 1 asterisk is closed**

Built on `claude/v1-24-first-claim-uc4fdx`, on top of the v1.23 merge (PR #85,
`59b8865`). Save schema stays at v11 (nothing persisted — the check is a derived
read over the board); **both sim hashes byte-identical to v1.20, v1.21 and
v1.23**; zero dead ends across 2,000 runs; 799 tests passing.

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
- **The simulator's territory blindness is broader than recorded.** All
  **thirteen** strategies claim zero blocks across 2,000 runs, not only
  `operator`, which is why neither hash moved.
- **A correction, and a trap.** This section first claimed `operator` never buys
  the garage and never recruits anybody. That probe was invalid — `normalizeSeed`
  falls back to one constant for any non-numeric seed, so the 200 string-seeded
  "runs" were one run repeated. With numeric seeds `operator` leases the garage
  in **1/200** runs (day ~9) and recruits somebody in **76/200** — but **0/200
  ever have both at once**, and `stickup` is the mirror image at 18/200 and
  1/200. Territory needs garage → Eli → promotion → soldier, and the trade loop
  spends 58% of cash on inventory every iteration, so the lease and the
  recruitment never clear together. **The blocker is holding both at once, not
  reaching either** — a narrower and more tractable target than before.

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
  ladder — Phase 3. **Disclosure tables shipped in v1.27**, beside her ladder
  rather than on it: her feed is standing and tier-gated, disclosures are
  on-demand and band-gated, and `blockIntelLevel()` did not have to change.
  NPC one-shots are still open.

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
- ~~Bills rows could deep-link to their pay surfaces once `navigate()` grows a
  Phone-section target~~ — **delivered in v1.26, and better than proposed.** The
  rent and phone rows do not deep-link anywhere; they dispatch `PAY_RENT` and
  `PAY_PHONE_BILL` in place. A bill you can settle from cash on hand did not
  need a trip to another screen, only a button. Crew wages and Dre's note still
  name their surfaces, which is the right answer for those two.
- ~~The standalone Contacts screens are now redundant with the Phone section~~ —
  **half delivered in v1.26.** The Spenard Explore duplicate is gone. Street →
  People keeps its Contacts route: Street navigation legitimately owns people,
  and that was never the redundant one.

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
