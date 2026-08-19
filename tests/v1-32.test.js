const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

// v1.32 - Make the obligations real.
//
// v1.31 removed the day-count terminator and let runs reach 40 days. The first
// honest economic reading that produced turned up something that invalidated
// most of it: while Deshawn was on the crew, rent was never missed. His grace
// re-armed once per rent period and rent fell due once per rent period, so the
// two cancelled exactly and eviction - the game's primary lose condition - was
// unreachable in 100% of runs where he was active.
//
// The mechanic never changed. The run length did. Inside a ten-day run Deshawn
// ate at most one miss, which is a bounded perk that fits his character; v1.31
// removed the boundary and a bounded perk became an infinite subsidy. That is a
// hazard class rather than a one-off, and the inventory of other run-length
// bounded assumptions is in PROJECT_STATUS rather than in code.
//
// The fix is the one the log line already described: the grace DEFERS the miss
// by a day instead of cancelling the week.

const root = path.join(__dirname, "..");
const core = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
const sim = fs.readFileSync(path.join(root, "tests", "simulate-runs.js"), "utf8");

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Rentish" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  state = structuredClone(state);
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  return state;
}

function broke(state) {
  state.player.cash = 0; state.player.cleanCash = 0; state.player.dirtyCash = 0;
  return state;
}

// One night, resolved. Rent settlement runs in the crossed-day pass.
function night(state, day) {
  state.run.day = day; state.run.slot = 3;
  state.run.pendingEvent = null; state.run.pendingEncounter = null;
  state.run.dayEndPending = true;
  return C.reduceGame(state, { type: "CONFIRM_END_DAY" });
}

// --- Task 1: the grace defers, it does not cancel ---------------------------

test("with Deshawn active the rent ladder still advances, one day behind", () => {
  let state = fresh(3201);
  Object.assign(state.people.crew.deshawn, { recruited: true, status: "active" });
  state.flags.extraRentGraceAvailable = true;
  state.obligations.rentDueDay = 5;

  state = night(broke(state), 5);
  assert.equal(state.npc.yalonda.rentMissed, 0, "the due night is deferred");
  state = night(broke(state), 6);
  assert.equal(state.npc.yalonda.rentMissed, 1, "and lands the next night");
  state = night(broke(state), 12);
  assert.equal(state.npc.yalonda.rentMissed, 1, "next period deferred again");
  state = night(broke(state), 13);
  assert.equal(state.npc.yalonda.rentMissed, 2, "and lands again");
  assert.ok(state.people.household.warnings >= 1, "the eviction ladder is reachable with Deshawn on the crew");
});

test("an unpaid run with Deshawn active still reaches eviction", () => {
  // The headline regression test. Before v1.32 this run played forever.
  let state = fresh(3202);
  Object.assign(state.people.crew.deshawn, { recruited: true, status: "active" });
  state.flags.extraRentGraceAvailable = true;
  for (let day = 2; day <= 45 && !state.people.household.evicted; day += 1) state = night(broke(state), day);
  assert.equal(state.people.household.evicted, true, "eviction is reachable");
  assert.ok(state.npc.yalonda.rentMissed >= 3, `misses accrued (${state.npc.yalonda.rentMissed})`);
});

test("Deshawn is still worth having, which is the other way this could go wrong", () => {
  // A grace that defers could easily have been reduced to dead weight. This is
  // the "passing tests, dead mechanic" shape the project keeps finding, so it
  // gets an explicit assertion: on the same seed, he must change the outcome.
  // Measured on the first rent period on purpose. A permanently broke run stops
  // paying Deshawn's wage too, so he departs around day 8 and the two arms
  // converge - which is correct behaviour and worth knowing, but it means a
  // whole-run comparison measures his departure rather than his grace.
  const firstMissDay = (withHim) => {
    let state = fresh(3203);
    if (withHim) {
      Object.assign(state.people.crew.deshawn, { recruited: true, status: "active" });
      state.flags.extraRentGraceAvailable = true;
    }
    state.obligations.rentDueDay = 5;
    for (let day = 2; day <= 12; day += 1) {
      state = night(broke(state), day);
      if (state.npc.yalonda.rentMissed > 0) return day;
    }
    return null;
  };
  const withHim = firstMissDay(true);
  const without = firstMissDay(false);
  assert.equal(without, 5, "without him the miss lands on the due day");
  assert.equal(withHim, 6, "with him it lands a day later - the day he bought");
  assert.ok(withHim > without, "Deshawn still changes a measurable outcome");
});

test("an unpaid run stops paying Deshawn too, and he leaves", () => {
  // The interaction that makes the whole-run comparison above misleading, and a
  // real piece of design: the rent shield is itself paid for. Stop paying wages
  // and the man who talks to your landlord is gone.
  let state = fresh(3205);
  Object.assign(state.people.crew.deshawn, { recruited: true, status: "active", loyalty: 3 });
  for (let day = 2; day <= 30 && state.people.crew.deshawn.status === "active"; day += 1) state = night(broke(state), day);
  assert.equal(state.people.crew.deshawn.status, "departed", "unpaid wages cost you the grace as well");
});

test("paying inside the day he bought means the miss never lands", () => {
  let state = fresh(3204);
  Object.assign(state.people.crew.deshawn, { recruited: true, status: "active" });
  state.flags.extraRentGraceAvailable = true;
  state.obligations.rentDueDay = 5;
  state = night(broke(state), 5);
  assert.equal(state.npc.yalonda.rentMissed, 0);
  state.player.cash = 400; state.player.cleanCash = 400;
  state = C.reduceGame(state, { type: "PAY_RENT" });
  state = night(state, 6);
  assert.equal(state.npc.yalonda.rentMissed, 0, "that is what the grace is for");
});

test("the grace needs no new state, so the schema holds at v11", () => {
  assert.equal(C.VERSION, 11);
  assert.equal(C.SAVE_KEY, "907ogr_v11");
  // The deferral is derived from the ABSENCE of the period stamp rather than
  // from a stored deadline. If a future build adds a field here, this fails.
  assert.match(core, /state\.obligations\.lastMissedDueDay = null;/, "the grace clears the stamp instead of storing a deferral");
});

// --- Task 2: the strategies pay what they owe -------------------------------

test("every strategy pays its obligations except the documented control", () => {
  const { strategies } = require("./simulate-runs.js");
  const skipping = Object.entries(strategies).filter(([, p]) => p.skipBills).map(([name]) => name);
  assert.deepEqual(skipping, ["trainer"], "exactly one deliberate non-payer, and it is named");
  assert.match(sim, /if\(!p\.skipBills\)\{const next=workerTurn/, "the bills turn is on by default");
  // Until v1.32 exactly one strategy of fifteen had ever dispatched PAY_RENT.
  assert.doesNotMatch(sim, /p\.payBills\|\|p\.employment/, "the old payBills gate is gone");
});

test("the control is chosen for lifespan, because a strategy that dies early cannot exercise the ladder", () => {
  const { play } = require("./simulate-runs.js");
  // stickup is arrested around day 7 and never reaches a rent period at all,
  // which is why it reads 0% evictions while paying nothing. It would be a
  // useless control and the table should not be read as though it were solvent.
  const stickup = play(1000, "stickup");
  assert.ok(stickup.endDay < 15, `stickup is right-censored by arrest (day ${stickup.endDay})`);
  const trainer = play(1000, "trainer");
  assert.ok(trainer.endDay > 20, `the control survives long enough to reach the ladder (day ${trainer.endDay})`);
});

// --- Guard conditions: did the fix go too far? ------------------------------

test("guard: a strategy that pays its obligations is not evicted", () => {
  const { summarize } = require("./simulate-runs.js");
  const worker = summarize("worker", 6);
  assert.equal(worker.evictions, 0, "the control for solvency stays solvent");
});

test("guard: the block layer stays measurable", () => {
  // v1.31 unblocked this and an over-harsh rent fix would re-break it, which is
  // exactly what happens if the grace is fixed without Task 2 - territory
  // evicts in 100% of runs.
  const { summarize } = require("./simulate-runs.js");
  const territory = summarize("territory", 6);
  assert.equal(territory.deadEnds, 0);
  assert.ok(territory.territory.claimed > 0, `corners are still claimed (${territory.territory.claimed})`);
  assert.ok(territory.territory.raids > 0, `and still raided (${territory.territory.raids})`);
});

test("guard: eviction is reachable but not universal", () => {
  const { summarize, strategies } = require("./simulate-runs.js");
  let evicted = 0, runs = 0;
  for (const name of Object.keys(strategies)) {
    const result = summarize(name, 4);
    evicted += result.evictions; runs += result.runs;
  }
  const rate = evicted / runs;
  assert.ok(rate > 0.02, `the obligation bites somewhere (${(rate * 100).toFixed(0)}%)`);
  assert.ok(rate < 0.5, `but the game is still playable (${(rate * 100).toFixed(0)}%)`);
});

// --- Task 4: health is measured, not fixed ----------------------------------

test("the harness reports where health goes and whether anything puts it back", () => {
  const { play } = require("./simulate-runs.js");
  const run = play(1000, "worker");
  for (const key of ["healthLost", "healthHealed", "healDispatches", "healthLostBy", "endDay", "endHealth"]) {
    assert.ok(key in run, `${key} is reported`);
  }
  assert.ok(run.healthLost > 0, "a 40-day run loses health");
  assert.match(run.healthLostBy, /WORK_JOB/, "and the source is attributed to the action that caused it");
});

test("v1.33 answered this measurement: the harness now rests, and stops dying", () => {
  // This test asserted the opposite and was right at the time - the harness
  // dispatched a heal twice in ninety runs. v1.33 found the reason and it was
  // not the engine: SLEEP_HOME heals 12 for one slot and the simulator had
  // never dispatched it once. The engine still has no PASSIVE regeneration,
  // which remains true and deliberate; what changed is that the instrument now
  // takes the recovery the game already offered.
  const { play, strategies } = require("./simulate-runs.js");
  let heals = 0, killed = 0, runs = 0;
  for (const name of Object.keys(strategies)) for (const seed of [1000, 1001, 1002]) {
    const run = play(seed, name);
    heals += run.healDispatches; runs += 1;
    if (run.endCause && run.endCause.id === "killed") killed += 1;
  }
  assert.ok(heals > runs, `resting is now normal behaviour (${heals} heals across ${runs} runs)`);
  // Not zero - bleeding out is a real lose condition and should stay reachable.
  // What changed is that it stopped being how most runs end.
  assert.ok(killed / runs < 0.1, `death is rare rather than dominant (${killed}/${runs})`);
  assert.doesNotMatch(core, /passiveHealthRegen|regenHealth/, "recovery is still elective, not automatic");
});
