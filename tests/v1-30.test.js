const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Crew = require("../src/data/crew.js");
const Disclosures = require("../src/data/disclosures.js");
const { NPC_CHANNELS } = require("../src/data/propagation.js");

// v1.30 - Crew wages off the garage, Tone's own product, and a strategy that
// holds a job.
//
// Three independent items. What ties the first two together is that both were
// gates standing in the wrong place: PAY_CREW required a garage the crew it
// paid had never needed, and the disclosure table had no way to express a
// source who is on the payroll rather than in the phone book.
//
// The wage bug is the one worth reading the tests for. v1-15 has covered
// PAY_CREW since the crew system shipped, and it stayed green through the
// entire life of the bug, because its fixture SATISFIES the garage gate
// (`base.controlled = true; base.visiting = true`) rather than asserting it.
// A test that sets up the world the buggy path requires cannot see the bug.
// Everything below is written from the other side: no garage anywhere.

const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const disclosureSource = fs.readFileSync(path.join(root, "src", "data", "disclosures.js"), "utf8");
const simSource = fs.readFileSync(path.join(root, "tests", "simulate-runs.js"), "utf8");

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Wages" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  state.phone.active = true;
  return structuredClone(state);
}

// A player with Tone on the crew and no garage at all - which is a reachable
// state, because Tone recruits through an Exposure scene rather than through
// the base. `base.controlled` is left false on purpose everywhere below.
function crewNoGarage(seed, { crewId = "tone", arrears = 0, cash = 500, loyalty = 5 } = {}) {
  const state = fresh(seed);
  assert.equal(state.base.controlled, false, "the fixture is a player who does not own the garage");
  Object.assign(state.people.crew[crewId], { recruited: true, status: "active", loyalty, wageDue: arrears, recruitedDay: 1 });
  state.player.cash = cash;
  state.player.cleanCash = cash;
  state.player.dirtyCash = 0;
  return state;
}

// --- Task 1: the wage gate --------------------------------------------------

test("a player with crew and no garage can pay their arrears", () => {
  const state = crewNoGarage(3001, { arrears: 85, cash: 200 });
  const after = C.reduceGame(state, { type: "PAY_CREW", crewId: "tone" });
  assert.notEqual(after, state, "the dispatch is not a no-op");
  assert.equal(after.base.controlled, false, "and it did not require a garage to land");
  assert.equal(after.people.crew.tone.wageDue, 0, "the arrears are cleared");
  assert.equal(after.people.crew.tone.wageMissedSince, null, "and the missed-wage clock resets");
  assert.equal(after.player.cash, 115, "the money actually left the pocket");
  // Loyalty is not the point of this action and standingGain returns nothing at
  // the open stage - what PAY_CREW buys is the Power penalty coming off and the
  // departure clock stopping. Asserted as "does not fall" so a future standing
  // change cannot quietly turn settling up into a cost.
  assert.ok(after.people.crew.tone.loyalty >= state.people.crew.tone.loyalty, "settling up never costs standing");
});

test("the guards that are not about the garage still hold without one", () => {
  const base = crewNoGarage(3002, { arrears: 85, cash: 200 });
  const noSuchPerson = C.reduceGame(base, { type: "PAY_CREW", crewId: "nobody" });
  assert.equal(noSuchPerson, base, "an unknown crew id is a genuine no-op");

  const broke = crewNoGarage(3002, { arrears: 85, cash: 10 });
  assert.equal(C.reduceGame(broke, { type: "PAY_CREW", crewId: "tone" }), broke, "cash short of the arrears cannot pay them");

  const nothingOwed = crewNoGarage(3002, { arrears: 0, cash: 200 });
  assert.equal(C.reduceGame(nothingOwed, { type: "PAY_CREW", crewId: "tone" }), nothingOwed, "there is nothing to pay when nothing is owed");

  const notHired = fresh(3002);
  notHired.player.cash = 200;
  notHired.people.crew.tone.wageDue = 85;
  assert.equal(C.reduceGame(notHired, { type: "PAY_CREW", crewId: "tone" }), notHired, "somebody who was never recruited has no wage to settle");
});

test("the obligation ladder runs the same without a garage: grace, then loyalty, then departure", () => {
  // The whole point of the fix. Before it, this ladder ran to its end on a
  // player who had no reachable way to interrupt it.
  const state = crewNoGarage(3003, { cash: 0, loyalty: 3 });
  const crew = state.people.crew.tone;
  crew.wageDue = 85;
  crew.wageMissedSince = state.run.day;
  const graceDay = { ...state, run: { ...state.run, day: state.run.day + Crew.CREW_WAGE_GRACE_DAYS - 1 } };
  assert.ok(graceDay.run.day - crew.wageMissedSince < Crew.CREW_WAGE_GRACE_DAYS, "inside the grace window nothing bleeds yet");

  // And the interruption itself now works from a state with no base.
  const paid = C.reduceGame({ ...state, player: { ...state.player, cash: 200 } }, { type: "PAY_CREW", crewId: "tone" });
  assert.equal(paid.people.crew.tone.wageDue, 0);
  assert.equal(paid.people.crew.tone.wageMissedSince, null, "the clock the ladder counts from is reset");
});

test("a garage-owning player is unaffected: the gate was removed, not inverted", () => {
  const state = crewNoGarage(3004, { arrears: 85, cash: 200 });
  state.base.controlled = true;
  state.base.visiting = true;
  const after = C.reduceGame(state, { type: "PAY_CREW", crewId: "tone" });
  assert.equal(after.people.crew.tone.wageDue, 0, "paying from inside the garage still works exactly as it did");
});

test("the Pay arrears button no longer waits on the garage, and the Bills row stops pointing at it", () => {
  const detail = ui.slice(ui.indexOf("function CrewDetail("), ui.indexOf("function DealerDetail("));
  const payButton = detail.slice(detail.indexOf("Pay arrears"));
  assert.doesNotMatch(payButton.slice(0, 400), /base\.visiting/, "the button is not gated on standing in the base");
  assert.match(detail, /disabled=\{state\.player\.cash < crew\.wageDue\}/, "only the cash check is left");

  const bills = ui.slice(ui.indexOf("function phoneBills("), ui.indexOf("function phoneBills(") + 3000);
  assert.doesNotMatch(bills, /Pay at the garage/, "the Bills row no longer sends the player to a door that will not open");
  assert.match(bills, /Pay in People . Crew/, "it names the screen that actually pays");
  // v1.26 decided crew wages are not a one-tap amount and left the row without
  // a pay descriptor. Removing the gate does not change that reasoning.
  assert.doesNotMatch(bills, /type: "PAY_CREW"/, "and the row is still display-only");
});

// --- Task 2: Tone's product -------------------------------------------------

test("territory_status is a real intel type Tone sells at Warm", () => {
  const type = Disclosures.INTEL_TYPE_BY_ID.territory_status;
  assert.ok(type, "the type exists");
  assert.equal(type.price, 40, "cheapest on the table, because it organises what the player was already told");
  assert.equal(type.staleness, "day", "good for the day it describes and no longer");
  assert.equal(typeof C.selectors[type.reads], "function", `it reads ${type.reads}, which is a real selector`);

  const row = Disclosures.disclosureFor("tone", "territory_status");
  assert.ok(row, "Tone is in the table");
  assert.equal(row.minBand, C.BANDS.WARM);
  assert.equal(row.requiresCrew, true, "and he has to actually be on the crew");
  assert.equal(Disclosures.senderFor("tone"), "Tone", "the text is signed the way the player saved the number");
});

test("he could only have heard it by walking the corners himself", () => {
  // Every other row is justified by a propagation channel. His is `direct`,
  // and the reason is that this is the one product that is not about Curtis:
  // it is the player's own corners, counted in person.
  assert.ok((NPC_CHANNELS.tone || []).includes("direct"), "Tone is reachable directly");
});

test("the briefing is exact at his gate, because there is nothing to be approximately right about", () => {
  assert.ok(Disclosures.hasVoice("tone", "territory_status", "exact"), "the exact voice is authored");
  assert.ok(!Disclosures.hasVoice("tone", "territory_status", "jittered"), "and the jittered one deliberately is not");
  assert.equal(Disclosures.resolvedAccuracy("tone", "territory_status", C.BANDS.WARM, C.BANDS.WARM), "exact",
    "so the gate band still returns the truth");
  assert.equal(Disclosures.resolvedAccuracy("tone", "territory_status", C.BANDS.NEUTRAL, C.BANDS.WARM), "unavailable",
    "below the gate it is still not for sale");
  // The five v1.27 rows are untouched by that rule.
  assert.equal(Disclosures.resolvedAccuracy("dre", "curtis_targets", C.BANDS.WARM, C.BANDS.WARM), "jittered",
    "Dre still hedges at his own gate");
});

test("a lieutenant who was never hired, or who walked, does not answer the phone", () => {
  const held = holdingWithTone(3010);
  assert.ok(C.selectors.disclosureOffers(held, "tone").some((o) => o.intelType === "territory_status"),
    "an active Tone at Warm sells the briefing");

  for (const status of ["outside", "departed", "arrested"]) {
    const gone = holdingWithTone(3010);
    gone.people.crew.tone.status = status;
    assert.deepEqual(C.selectors.disclosureOffers(gone, "tone"), [], `a ${status} Tone is off the menu entirely`);
    assert.equal(C.reduceGame(gone, { type: "BUY_DISCLOSURE", npcId: "tone", intelType: "territory_status" }), gone,
      "and the reducer refuses the dispatch too, not just the button");
  }

  const neverHired = holdingWithTone(3010);
  neverHired.people.crew.tone.recruited = false;
  assert.deepEqual(C.selectors.disclosureOffers(neverHired, "tone"), [], "so does somebody who was never on the payroll");
});

test("the briefing names what each corner did last night, and a lost man is a lost man", () => {
  const state = holdingWithTone(3011);
  const [held, lost] = C.selectors.heldBlockIdsForTest
    ? C.selectors.heldBlockIdsForTest(state)
    : Object.keys(state.world.territoryBlocks).filter((id) => state.world.territoryBlocks[id].owner === "player");
  const lastNight = state.run.day - 1;
  state.world.territoryBlocks[lost].lastCasualtyDay = lastNight;
  state.world.territoryBlocks[lost].lastRaidDay = lastNight;

  const payload = C.selectors.disclosurePayload(state, "tone", "territory_status", "exact");
  assert.ok(Array.isArray(payload.corners) && payload.corners.length >= 2, "one row per corner the player holds");
  const lostRow = payload.corners.find((c) => c.name === C.SPENARD_BLOCKS.find((b) => b.id === lost).name);
  const heldRow = payload.corners.find((c) => c.name === C.SPENARD_BLOCKS.find((b) => b.id === held).name);
  assert.match(lostRow.text, /lost a man/, "the corner that took a casualty says so");
  assert.match(heldRow.text, /quiet night/, "and the one that did not had a quiet night");
});

test("a raid everybody walked away from is not the same sentence as a casualty", () => {
  const state = holdingWithTone(3012);
  const ids = Object.keys(state.world.territoryBlocks).filter((id) => state.world.territoryBlocks[id].owner === "player");
  state.world.territoryBlocks[ids[0]].lastRaidDay = state.run.day - 1;
  const payload = C.selectors.disclosurePayload(state, "tone", "territory_status", "exact");
  const raided = payload.corners.find((c) => c.name === C.SPENARD_BLOCKS.find((b) => b.id === ids[0]).name);
  assert.match(raided.text, /cops came through/, "a raid with no loss reads as a raid with no loss");
  assert.doesNotMatch(raided.text, /lost a man/);
});

test("holding no corners is a real answer rather than an error", () => {
  const state = crewNoGarage(3013, { cash: 500 });
  setToneWarm(state);
  const payload = C.selectors.disclosurePayload(state, "tone", "territory_status", "exact");
  assert.equal(payload.empty, true, "nothing to walk");
  const text = Disclosures.disclosureText("tone", "territory_status", "exact", payload, 0);
  assert.ok(text && text.length > 0, "and he still says something");
});

test("buying it costs $40, no time, and lands as a text in his own voice", () => {
  const state = holdingWithTone(3014);
  const before = state.player.cash;
  const day = state.run.day;
  const slot = state.run.slot;
  const after = C.reduceGame(state, { type: "BUY_DISCLOSURE", npcId: "tone", intelType: "territory_status" });
  assert.notEqual(after, state);
  assert.equal(after.player.cash, before - 40, "debited once, at the list price");
  assert.equal(after.run.day, day, "no day passed");
  assert.equal(after.run.slot, slot, "and no part of one either - it is a phone call");
  const message = [...after.phone.inbox, ...after.phone.heldInbox].find((m) => m.from === "Tone");
  assert.ok(message, "a text arrives from Tone");
  assert.doesNotMatch(message.text, /\bmaybe\b|\bsounded\b|\bfeels like\b/, "he does not hedge - that is somebody else's register");
  assert.match(message.text, /up|nobody on it/, "and he leads with the count");
});

test("the same day gives the same sentence, and a reload cannot reroll it", () => {
  const first = C.reduceGame(holdingWithTone(3015), { type: "BUY_DISCLOSURE", npcId: "tone", intelType: "territory_status" });
  const second = C.reduceGame(holdingWithTone(3015), { type: "BUY_DISCLOSURE", npcId: "tone", intelType: "territory_status" });
  const textOf = (s) => [...s.phone.inbox, ...s.phone.heldInbox].find((m) => m.from === "Tone").text;
  assert.equal(textOf(first), textOf(second), "no RNG draw anywhere in the purchase");
});

test("Selam, Pherris and Deshawn are absent, and the file says why", () => {
  for (const npcId of ["selam", "pherris", "deshawn"]) {
    assert.ok(!Disclosures.DISCLOSURE_NPC_IDS.includes(npcId), `no table row names ${npcId}`);
    assert.ok(!Disclosures.VOICES[npcId], `no authored disclosure voice exists for ${npcId}`);
  }
  const table = disclosureSource.slice(0, disclosureSource.indexOf("const DISCLOSURE_NPC_IDS"));
  assert.match(table, /Selam is not a disclosure source/, "her exclusion is written down rather than implied by absence");
  assert.match(table, /Authored register first, table row second/, "and the reason is a character reason");
  assert.match(table, /subscription/, "Pherris's is that her tier already sells it");
  assert.match(table, /not on the wire/, "Deshawn's is that he is off the network");
});

// --- Task 3: the harness finally sees employment -----------------------------

test("there are fifteen strategies and the fifteenth holds a job", () => {
  const { strategies } = require("./simulate-runs.js");
  const names = Object.keys(strategies);
  assert.equal(names.length, 15, "fourteen plus worker");
  assert.ok(names.includes("worker"));
  const worker = strategies.worker;
  assert.equal(worker.employment, true, "it applies, accepts, and works");
  assert.equal(worker.payBills, true, "and it pays what it owes");
  assert.deepEqual(worker.products, [], "no crime: it carries no product");
  assert.ok(!worker.operator && !worker.property && !worker.dealer, "and no territory, garage, or corner work");
  assert.ok(worker.plan, "it carries a final plan, which is the only way a run in this harness ends");
});

test("the worker actually holds an employer, works it, and never trips the attendance ladder", () => {
  const { play } = require("./simulate-runs.js");
  const runs = [1000, 1001, 1002, 1003, 1004].map((seed) => play(seed, "worker"));
  for (const run of runs) {
    assert.equal(run.completed, true, "the run terminates rather than burning the guard");
    assert.equal(run.jobHeld, 1, "it is holding a real employer at the end, not day labor");
    assert.ok(run.shiftsWorked > 0, "and it worked shifts");
    assert.ok(run.wagesEarned > 0, "which paid something");
    // The v1.29 ladder counts consecutive days that ended without a shift. A
    // strategy that takes every shift it is offered never reaches rung one, and
    // this is the assertion that will move if a future change breaks that.
    assert.equal(run.missedShiftPeak, 0, "the missed-shift counter never leaves zero");
    assert.equal(run.householdWarnings, 0, "no household warning");
    assert.equal(run.rentMissed, 0, "rent paid on time");
    assert.equal(run.phonePastDue, 0, "phone paid on time");
    assert.notEqual(run.ending, "nowhere_to_go", "and it is never evicted");
  }
});

test("the employment telemetry only exists on the strategy that earns it", () => {
  const { play } = require("./simulate-runs.js");
  const worker = play(1000, "worker");
  const trader = play(1000, "trader");
  for (const key of ["jobHeld", "shiftsWorked", "wagesEarned", "missedShiftPeak"]) {
    assert.ok(key in worker, `worker reports ${key}`);
    assert.ok(!(key in trader), `and ${key} is absent from every other summary, so the fourteen are byte-comparable`);
  }
});

test("strategy-specific behaviour and telemetry stay opt-in", () => {
  // v1.30 gated every new branch on a profile flag so the fourteen original
  // strategies stayed byte-identical, and that is what made the equivalence
  // proof possible. v1.32 deliberately broke half of it for the bills turn:
  // paying rent became universal, because leaving it opt-in meant fourteen of
  // fifteen strategies had never once dispatched PAY_RENT and the entire table
  // was measuring "what happens if nobody pays". The job ladder inside the same
  // turn, and all of its telemetry, are still opt-in.
  assert.match(simSource, /if\(!p\.skipBills\)\{const next=workerTurn/, "bills are universal, with one named exception");
  assert.match(simSource, /if\(!p\.employment\)return null;/, "the job ladder inside it is employment-only");
  assert.match(simSource, /if\(p\.employment\)\{Object\.assign\(summary,employmentMetrics/, "so is its telemetry");
  assert.match(simSource, /strategies\[name\]\.employment\?\{employment:\{/, "and its roll-up");
});

// --- helpers used above -----------------------------------------------------

const BAND_LEDGER_CANDIDATES = [];
for (const type of ["loyalty", "presence", "discretion", "growth", "financial", "heat_exposure", "violence", "betrayal"]) {
  for (const count of [1, 2, 3, 5, 7, 11, 15, 20, 30]) BAND_LEDGER_CANDIDATES.push([{ type, count }]);
}

function setToneWarm(state) {
  for (const rows of BAND_LEDGER_CANDIDATES) {
    state.npc.tone.ledger = rows.map((row) => ({
      type: row.type, event: null, location: null, value: null, day: 1, count: row.count, source: "witnessed",
    }));
    if (C.selectors.dispositionBand(state, "tone") === C.BANDS.WARM) return state;
  }
  throw new Error("no ledger puts Tone at Warm");
}

// Tone on the crew, at Warm, with corners to walk - and still no garage, so
// every disclosure assertion above doubles as a second check on Task 1's fix.
function holdingWithTone(seed) {
  const state = crewNoGarage(seed, { cash: 500 });
  setToneWarm(state);
  let next = 1;
  for (const block of C.SPENARD_BLOCKS.slice(0, 2)) {
    const record = state.world.territoryBlocks[block.id];
    record.owner = "player";
    for (let i = 0; i < 2; i += 1) {
      const id = `soldier_${next++}`;
      state.world.soldiers[id] = { id, status: "active", blockId: block.id };
      record.soldiersAssigned.push(id);
    }
  }
  return state;
}
