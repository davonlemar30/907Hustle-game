const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

// v1.31 - The run has no fixed length, and now the code agrees.
//
// Every build prompt since v1.24 has carried the same standing correction:
// THIS GAME HAS NO FIXED RUN LENGTH. The lose condition is failing to pay what
// you owe. ARCHITECTURE.md said it, PROJECT_STATUS.md said it, and the code did
// not do it. `confirmDayEnd` ended the run outright when the pressure phase had
// been running for PRESSURE_DAYS - no obligation check, no health check, no
// Heat check, just a day count - and EXECUTE_FINAL_PLAN, the one ending the
// player chooses, was locked to that single day.
//
// A run now ends four ways and four only:
//
//   1. an obligation you cannot pay   (rent -> eviction, the phone, Dre's note)
//   2. health at zero
//   3. Heat at the terminal 15
//   4. the player calling the final score, on whatever day they like
//
// The tests below are the ones that would have caught the contradiction: the
// first asserts a solvent run keeps going long past where it used to stop, and
// the rest prove nothing was lost by removing the cap.

const root = path.join(__dirname, "..");
const core = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const sim = fs.readFileSync(path.join(root, "tests", "simulate-runs.js"), "utf8");

// Drive a run forward, settling whatever the game puts in the way. `each` runs
// once per free tick and is where a test states the pressure it is applying.
function drive(seed, each, cap = 1500) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Openish" });
  let guard = 0;
  while (state.run.status === "playing" && guard++ < cap) {
    if (state.run.openingPending) { state = C.reduceGame(state, { type: "DISMISS_OPENING" }); continue; }
    if (state.run.daySummary) { state = C.reduceGame(state, { type: "DISMISS_DAY_SUMMARY" }); continue; }
    if (state.run.pendingOperationResult) { state = C.reduceGame(state, { type: "ACKNOWLEDGE_OPERATION_RESULT" }); continue; }
    if (state.run.pendingEncounter) {
      const choices = C.selectors.encounterChoices(state);
      state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: choices[0].id });
      continue;
    }
    if (state.run.pendingEvent) { state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 }); continue; }
    if (state.run.dayEndPending) { state = C.reduceGame(state, { type: "CONFIRM_END_DAY" }); continue; }
    each(state);
    const before = state;
    state = C.reduceGame(state, { type: "END_MARKET" });
    if (state === before) state = C.reduceGame(state, { type: "WALK_HOME" });
    if (state === before) break;
  }
  return state;
}

// Solvent, healthy, cool, and paying everything the moment it comes due.
function keepSolvent(state) {
  state.player.cash = 100000;
  state.player.cleanCash = 100000;
  state.player.health = 100;
  state.player.heat = 0;
  if (state.run.day >= state.obligations.rentDueDay && !state.people.household.evicted) {
    Object.assign(state, C.reduceGame(state, { type: "PAY_RENT" }));
  }
  if (state.run.day >= state.phone.billDueDay || state.phone.daysPastDue > 0) {
    Object.assign(state, C.reduceGame(state, { type: "PAY_PHONE_BILL", surface: "store" }));
  }
  if (state.lender.balance > 0) Object.assign(state, C.reduceGame(state, { type: "PAY_DEBT", amount: state.lender.balance }));
}

// --- The cap is gone --------------------------------------------------------

test("a solvent run does not stop, and goes far past where the cap used to be", () => {
  const state = drive(777, keepSolvent);
  assert.equal(state.run.status, "playing", "still going");
  // The old terminator fired around Day 10. Anything comfortably past that
  // proves the day count no longer decides.
  assert.ok(state.run.day > 60, `reached Day ${state.run.day}, well past the old checkpoint`);
  assert.equal(state.run.ending, null, "and nothing has chosen an ending for the player");
});

test("crossing the old checkpoint day is a day like any other", () => {
  let state = C.reduceGame(C.createRun({ seed: 31 }), { type: "START_RUN", streetName: "Past It" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  state = structuredClone(state);
  state.run.pendingEvent = null; state.run.pendingEncounter = null;
  state.run.phase = "pressure";
  state.run.checkpointDay = 5;
  state.run.day = 5;
  state.run.slot = 3;
  state.player.energy = 4;
  state = C.reduceGame(state, { type: "SLEEP_HOME" });
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.run.status, "playing");
  assert.equal(state.run.day, 6, "Day 6 is exposed where the run used to be taken away");
});

test("no day-count endRun survives in the reducer", () => {
  // A source assertion because this is a rule about what is absent. The old
  // line was `phase === "pressure" && oldDay >= checkpointDay(state)` guarding
  // an endRun; nothing may reintroduce a day comparison that ends a run.
  assert.doesNotMatch(core, /oldDay >= checkpointDay/, "the terminator is gone");
  const endRunGuards = core.split("\n").filter((line) => /endRun\(/.test(line) && !/function endRun/.test(line));
  for (const line of endRunGuards) {
    assert.doesNotMatch(line, /run\.day\s*[<>=]/, `no endRun is gated on a day count: ${line.trim().slice(0, 90)}`);
  }
});

// --- The four ways a run actually ends --------------------------------------

test("an obligation nobody pays is still what loses the run", () => {
  const state = drive(501, (s) => { s.player.cash = 0; s.player.cleanCash = 0; s.player.dirtyCash = 0; });
  assert.equal(state.run.status, "ended");
  assert.equal(state.run.ending, "nowhere_to_go", "eviction, not a clock");
  assert.ok(state.run.day > 10, `and it took until Day ${state.run.day} to get there`);
});

test("health at zero and Heat at the terminal 15 still end a run", () => {
  const dead = drive(502, (s) => { s.player.cash = 100000; s.player.health = 0; });
  assert.equal(dead.run.status, "ended");
  assert.ok(["killed", "base_lost"].includes(dead.run.ending), `health zero ends it (${dead.run.ending})`);

  const busted = drive(503, (s) => { s.player.cash = 100000; s.player.heat = 15; });
  assert.equal(busted.run.status, "ended");
  assert.equal(busted.run.ending, "arrested");
});

test("the player can call the final score on any day, which is the only ending they control", () => {
  for (const day of [3, 12, 40]) {
    let state = C.reduceGame(C.createRun({ seed: 9001 }), { type: "START_RUN", streetName: "Cash Out" });
    if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
    state = structuredClone(state);
    state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.dayEndPending = false;
    state.run.day = day; state.run.slot = 1; state.player.energy = 4; state.player.health = 100;

    state = C.reduceGame(state, { type: "PREPARE_FINAL_PLAN", planId: "escape" });
    assert.ok(state.run.finalPlanPrepared, `a plan can be prepared on Day ${day}`);
    // Preparing costs a part of the day, which can surface a beat; settle it
    // the way both the UI and the harness do before calling the score.
    let guard = 0;
    while (guard++ < 10 && state.run.status === "playing") {
      if (state.run.pendingEvent) { state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 }); continue; }
      if (state.run.pendingEncounter) {
        const choices = C.selectors.encounterChoices(state);
        state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: choices[0].id });
        continue;
      }
      if (state.run.daySummary) { state = C.reduceGame(state, { type: "DISMISS_DAY_SUMMARY" }); continue; }
      if (state.run.dayEndPending) { state = C.reduceGame(state, { type: "CONFIRM_END_DAY" }); continue; }
      break;
    }
    if (state.run.status !== "playing") continue;
    state = C.reduceGame(state, { type: "EXECUTE_FINAL_PLAN" });
    assert.ok(state.run.pendingEncounter, `the final encounter starts on Day ${day}`);
    guard = 0;
    while (state.run.status === "playing" && state.run.pendingEncounter && guard++ < 10) {
      const choices = C.selectors.encounterChoices(state);
      state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: choices[0].id });
    }
    assert.equal(state.run.status, "ended", `calling the score on Day ${day} ends the run`);
    assert.ok(state.run.ending, "and it produces an ending");
  }
});

// --- Dre's note is a loan, not an inherited deadline -------------------------

test("the note runs seven days from the day it is taken, not from a run length", () => {
  let state = C.reduceGame(C.createRun({ seed: 44 }), { type: "START_RUN", streetName: "Note" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  state = structuredClone(state);
  state.run.day = 12;
  // Deliberately behind the old checkpoint: under the previous code the note
  // inherited `run.checkpointDay`, so a loan taken on Day 12 with a checkpoint
  // of 10 came out already overdue. It is a seven-day term now, from today.
  state.run.phase = "pressure";
  state.run.checkpointDay = 10;
  state.lender.status = "unoffered";
  state.run.pendingEvent = C.buildEventForTest("dre_terms", state);
  const accepted = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(accepted.lender.status, "active");
  assert.equal(accepted.lender.balance, 1200);
  assert.equal(accepted.lender.dueDay, 19, "taken on Day 12, due Day 19");
  assert.ok(accepted.lender.dueDay > accepted.run.day, "a new note is never already overdue");
});

test("the note is a lose condition on its own clock", () => {
  // The collector used to fire off the checkpoint because a fresh-arrival run
  // set dueDay to the run length, so `day > dueDay` could never come true. It
  // can now, and this is the assertion that the escalation still has a trigger.
  assert.match(core, /state\.run\.day >= state\.lender\.dueDay && state\.lender\.collectorTier < 1/,
    "the collector escalates off the note's own due day");
  assert.doesNotMatch(core, /lender\.dueDay = state\.run\.checkpointDay/, "and the note no longer inherits a checkpoint");
});

// --- What the checkpoint field is allowed to do now --------------------------

test("checkpointDay survives only as story pacing, and only lateRunDay reads it", () => {
  // Three authored beats were paced against the old checkpoint and should fire
  // exactly when they did. Keeping the arithmetic under an honest name costs
  // nothing; keeping the ending power cost the design its central claim.
  assert.match(core, /function lateRunDay\(state\)/, "the pacing marker exists");
  const body = core.slice(core.indexOf("function lateRunDay"), core.indexOf("function startPressurePhase"));
  assert.match(body, /state\.run\.checkpointDay \|\| Infinity/);
  // Dre's beat moved off it entirely, onto the note it is actually about.
  assert.match(core, /s\.flags\.dreTermsResolved && s\.run\.day >= s\.lender\.dueDay/);
});

test("the interface stops advertising a deadline that does not exist", () => {
  assert.doesNotMatch(ui, /hud-day">Day \{state\.run\.day\}\{state\.run\.checkpointDay/, "no Day X/Y denominator");
  assert.doesNotMatch(ui, /return "the checkpoint"/, "Night no longer names a checkpoint");
  assert.doesNotMatch(ui, /reached the Day \{state\.run\.checkpointDay/, "the end screen does not congratulate a checkpoint");
});

// --- The instrument owns its own boundary -----------------------------------

test("the harness caps itself, generously, and cashes out the way a player would", () => {
  assert.match(sim, /const maxDays=p\.maxDays\?\?40;/, "a per-strategy horizon with a generous default");
  assert.match(sim, /if\(s\.run\.day>=maxDays&&!s\.run\.finalPlanPrepared\)/, "it prepares at its own horizon");
  assert.match(sim, /if\(s\.run\.day>=maxDays&&s\.run\.finalPlan/, "and exits through the voluntary ending");
  assert.doesNotMatch(sim, /s\.run\.checkpointDay/, "the harness no longer reads the checkpoint at all");
});

test("the longer horizon finally reaches the block layer", () => {
  // This is the whole point of the change. Three consecutive handoffs recorded
  // that no strategy had ever claimed a block, so every territory constant
  // tuned since v1.20 was unverifiable. The garage landed around Day 7.3 and
  // the run was taken away at Day 10, which left no time for the four rungs
  // above it. It was never an economy problem.
  const { summarize } = require("./simulate-runs.js");
  const result = summarize("territory", 6);
  assert.equal(result.deadEnds, 0, "no dead ends at the longer horizon");
  assert.ok(result.territory.claimed > 0, `blocks are claimed (${result.territory.claimed})`);
  assert.ok(result.territory.raids > 0, `and raided (${result.territory.raids}), so the nightly pass is exercised`);
});
