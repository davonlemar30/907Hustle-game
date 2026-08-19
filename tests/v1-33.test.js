const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

// v1.33 - The pressure and attrition pass.
//
// v1.32 handed this build a named work list: Dre's note compounding with no
// ceiling, Heat with no passive decay, health strictly monotonic downward, and
// encounter volume scaling with the calendar. One cluster, all of it supposedly
// "tuned against a ten-day run and unbounded at forty".
//
// Measuring it first changed the list. Two of the four were not engine problems
// at all - they were the same coverage hole that hid the rent bug, twice more:
//
//   Heat        NOT a ratchet. Relief roughly equals gain across the table
//               (11 shed against 11 gained on cautious, 15 against 19 on
//               territory) because the strategies manage it with LAY_LOW. The
//               elective decay is real and it is used. No change made.
//   Health      SLEEP_HOME heals 12 for one slot, and the harness had NEVER
//               dispatched it - not once, in its whole history. v1.32 read the
//               resulting slide as an engine with no way back and said so in
//               ARCHITECTURE. The way back was a free action nobody took.
//   The note    Never exercised either: settle() answered `dre_terms` with the
//               last choice - "Leave it with him" - for every strategy on every
//               seed, so the loan, the fee schedule, the collector ladder and
//               the dre_collector encounter were all unreachable.
//
// Only the note turned out to be genuinely broken, and it needed exercising
// before anyone could know: borrow $1,000 and by day 40 you owe a mean of
// $12,700, worst case $22,629. That is the one engine change here.

const root = path.join(__dirname, "..");
const core = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
const sim = fs.readFileSync(path.join(root, "tests", "simulate-runs.js"), "utf8");

// --- The one engine fix: the note has a ceiling ------------------------------

test("the note stops at twice what was borrowed", () => {
  const { play } = require("./simulate-runs.js");
  for (const seed of [1000, 1001, 1002, 1003]) {
    const debt = play(seed, "debtor").debt;
    assert.equal(debt.status, "active", "the debtor actually borrows");
    assert.ok(debt.principal > 0);
    assert.ok(debt.balance <= debt.principal * 2,
      `balance ${debt.balance} stays inside twice the ${debt.principal} principal`);
  }
});

test("the ceiling caps the arithmetic without disarming the collector", () => {
  // The pressure is supposed to come from the ladder - tier escalation, the
  // encounter, the heat - not from a number that outruns every income in the
  // game. Capping the balance must not quietly cap the consequences.
  const { play } = require("./simulate-runs.js");
  const debt = play(1000, "debtor").debt;
  assert.ok(debt.missedDays > 10, `missed days still accrue (${debt.missedDays})`);
  assert.equal(debt.collectorTier, 3, "and the collector still reaches the top tier");
  assert.match(core, /LOAN_MAX_BALANCE_MULTIPLIER = 2/, "the ceiling is a named constant");
});

test("a note inside its ceiling still charges the fee it always did", () => {
  // The cap is a ceiling, not a rate change. Below it the arithmetic is
  // untouched, so an early miss costs exactly what it used to.
  let state = C.reduceGame(C.createRun({ seed: 3301 }), { type: "START_RUN", streetName: "Note" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  state = structuredClone(state);
  state.run.phase = "pressure";
  Object.assign(state.lender, { status: "active", principal: 1000, balance: 1200, dueDay: 5, interestMultiplier: 1, missedDays: 0, lastPenaltyDay: 0, feesAdded: 0, penaltyHistory: [] });
  state.run.day = 6; state.run.slot = 3;
  state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.dayEndPending = true;
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  // 8% of 1200 = 96, tier 0 multiplier, well under the 2000 ceiling.
  assert.equal(state.lender.balance, 1296, "the ordinary fee is unchanged");
});

// --- Heat: measured, and left alone ------------------------------------------

test("Heat is not the one-way ratchet the work list assumed", () => {
  // Filed as a Tier 1 hazard on the reading that all four decay sites are
  // elective. They are - and the strategies elect them. Relief tracks gain
  // closely enough that Heat is self-regulating for anyone who manages it,
  // which is the design working rather than failing.
  const { play } = require("./simulate-runs.js");
  for (const name of ["cautious", "legal_worker", "worker", "territory"]) {
    const run = play(1000, name);
    assert.ok(run.heatReliefDispatches > 0, `${name} sheds heat deliberately`);
    assert.ok(run.heatShed >= run.heatGained * 0.5,
      `${name} sheds most of what it gains (${run.heatShed} of ${run.heatGained})`);
    assert.ok(run.endHeat < 12, `${name} does not end at the terminal band (${run.endHeat})`);
  }
});

test("crime still ends hot, so the measurement is not just a flat line", () => {
  const { play } = require("./simulate-runs.js");
  const hot = ["aggressive", "stickup", "thief"].map((name) => play(1000, name).endHeat);
  assert.ok(hot.some((heat) => heat >= 12), `the crime profiles reach the terminal band (${hot.join(", ")})`);
});

// --- Health: the harness now takes the recovery the game already offered -----

test("the harness rests, which is the thing it had never once done", () => {
  assert.match(sim, /type:'SLEEP_HOME'/, "SLEEP_HOME is dispatched at all");
  assert.match(core, /base\.player\.health = clamp\(base\.player\.health \+ 12, 0, 100\)/,
    "and the engine has always paid 12 for it");
  const { play } = require("./simulate-runs.js");
  const worker = play(1000, "worker");
  assert.ok(worker.healDispatches > 0, "the worker sleeps when it is hurt");
  assert.ok(worker.healthHealed > 0);
});

test("resting does not cost the worker its job", () => {
  // Sleeping spends the slots the worker used to spend earning, so this is the
  // interaction worth pinning: it may miss a rent period and catch up, but it
  // must never miss a shift or lose the room.
  const { summarize } = require("./simulate-runs.js");
  const worker = summarize("worker", 6);
  assert.equal(worker.employment.missedShiftRuns, 0, "the attendance ladder never fires");
  assert.equal(worker.employment.firedRuns, 0);
  assert.equal(worker.evictions, 0, "and it keeps the room");
});

test("rest is subordinate to the horizon", () => {
  // Left unguarded the rest rule outranked the cash-out and runs overshot
  // maxDays by eight days, because a hurt strategy went to bed forever instead
  // of ending. A horizon other business can outrank is not a horizon.
  const { play, strategies } = require("./simulate-runs.js");
  for (const name of Object.keys(strategies)) {
    const run = play(1000, name);
    assert.ok(run.endDay <= 44, `${name} respects the 40-day horizon (ended day ${run.endDay})`);
  }
});

// --- What the cluster looks like now ----------------------------------------

test("runs end for varied reasons, and death is no longer the default", () => {
  const { play, strategies } = require("./simulate-runs.js");
  const causes = {};
  let runs = 0;
  for (const name of Object.keys(strategies)) for (const seed of [1000, 1001, 1002]) {
    const run = play(seed, name);
    const cause = run.endCause ? run.endCause.id : "chosen";
    causes[cause] = (causes[cause] || 0) + 1;
    runs += 1;
  }
  // Before v1.33 `killed` was most of the table. The spread that replaced it is
  // the point of the build: people mostly stop when they choose to, a quarter
  // lose the room, a fifth get arrested, and dying is rare.
  assert.ok((causes.killed || 0) / runs < 0.1, `death is rare (${causes.killed || 0}/${runs})`);
  assert.ok((causes.chosen || 0) > 0, "some runs end because the player called it");
  assert.ok((causes.nowhere_to_go || 0) > 0, "eviction stays reachable");
  assert.ok((causes.arrested || 0) > 0, "so does arrest");
});

test("the guards v1.32 set still hold", () => {
  const { summarize, strategies } = require("./simulate-runs.js");
  const territory = summarize("territory", 6);
  assert.equal(territory.deadEnds, 0);
  assert.ok(territory.territory.claimed > 0, "the block layer is still measurable");
  assert.equal(summarize("worker", 6).evictions, 0, "a strategy that pays is not evicted");
  let evicted = 0, runs = 0;
  for (const name of Object.keys(strategies)) { const r = summarize(name, 3); evicted += r.evictions; runs += r.runs; }
  const rate = evicted / runs;
  assert.ok(rate > 0.02 && rate < 0.5, `eviction reachable but not universal (${(rate * 100).toFixed(0)}%)`);
});

test("the pressure ledger reports Heat and the note, not just health", () => {
  const { play } = require("./simulate-runs.js");
  const run = play(1000, "debtor");
  for (const key of ["heatGained", "heatShed", "heatReliefDispatches", "heatGainedBy", "endHeat", "debt"]) {
    assert.ok(key in run, `${key} is reported`);
  }
  assert.ok(run.debt.fees > 0, "the note's fees are attributed");
});
