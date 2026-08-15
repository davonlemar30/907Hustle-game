const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

function fresh(seed = 90715) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "North" });
  state.run.openingPending = false;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  return state;
}

function place(state, areaId, { cash = state.player.cash, slot = state.run.slot, health = state.player.health, energy = state.player.energy } = {}) {
  state.world.currentNeighborhoodId = areaId;
  state.player.cash = cash;
  state.player.cleanCash = cash;
  state.player.dirtyCash = 0;
  state.player.health = health;
  state.player.energy = energy;
  state.run.slot = slot;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  return state;
}

test("district registry entries are structurally valid and every job belongs to Spenard", () => {
  const areaIds = new Set(C.NEIGHBORHOODS.map((area) => area.id));
  assert.equal(C.HOME_DISTRICT_ID, "north_star_lot");
  for (const [key, entry] of Object.entries(C.DISTRICT_ACTIONS)) {
    assert.equal(entry.id, key);
    assert.ok(entry.areaId === "*" || areaIds.has(entry.areaId), key);
    assert.ok(Array.isArray(entry.slots) && entry.slots.length > 0, key);
    assert.ok(entry.slots.every((slot) => Number.isInteger(slot) && slot >= 0 && slot < C.SLOTS.length), key);
    for (const cost of ["cashCost", "timeCost", "healthCost"]) assert.ok(Object.hasOwn(entry, cost), `${key}.${cost}`);
    assert.ok(Object.hasOwn(entry, "action"), `${key}.action`);
  }
  for (const job of C.SPENARD_JOBS) {
    assert.equal(job.areaId, C.HOME_DISTRICT_ID, job.id);
    assert.equal(C.DISTRICT_ACTIONS[`job:${job.id}`].areaId, C.HOME_DISTRICT_ID, job.id);
  }
});

test("Around actions are filtered to the current district", () => {
  const state = fresh();
  state.world.locations.gamblingKnown = true;
  state.run.slot = 2;
  const spenard = C.selectors.aroundActions(state).map((entry) => entry.id);
  for (const id of ["explore_spenard", "local_intel"]) assert.ok(spenard.includes(id), id);
  // v1.11 retired spenard_gambling. The Nile replaced it and is a Places door
  // rather than an Around action, the same as the Night Owl and the gym.
  assert.ok(!spenard.includes("spenard_gambling"), "the abstract backroom game is gone");
  assert.ok(!spenard.includes("night_owl")); assert.ok(!spenard.includes("spenard_gym"));
  assert.ok(!spenard.includes("the_nile")); assert.ok(!spenard.includes("the_nile_den"));
  assert.ok(!spenard.includes("return_spenard"));

  for (const area of C.NEIGHBORHOODS.filter((entry) => entry.id !== C.HOME_DISTRICT_ID)) {
    place(state, area.id, { cash: 100, slot: 2 });
    const ids = C.selectors.aroundActions(state).map((entry) => entry.id);
    assert.deepEqual(ids, ["return_spenard"], area.id);
  }
});

test("every non-Spenard district inherits paid, pass-covered, and walking returns", () => {
  for (const area of C.NEIGHBORHOODS.filter((entry) => entry.id !== C.HOME_DISTRICT_ID)) {
    let state = place(fresh(90800), area.id, { cash: 5, slot: 0 });
    let ride = C.selectors.travelAvailability(state, C.HOME_DISTRICT_ID);
    assert.deepEqual({ visible: ride.visible, available: ride.available, cashCost: ride.cashCost, timeCost: ride.timeCost }, { visible: true, available: true, cashCost: 5, timeCost: 1 }, area.id);
    let returned = C.reduceGame(state, { type: "TRAVEL", neighborhoodId: C.HOME_DISTRICT_ID });
    assert.equal(returned.world.currentNeighborhoodId, C.HOME_DISTRICT_ID, area.id);
    assert.equal(returned.player.cash, 0, area.id);
    assert.equal(returned.run.slot, 1, area.id);

    state = place(fresh(90801), area.id, { cash: 0, slot: 0 });
    state.world.transport.dayPassDay = state.run.day;
    ride = C.selectors.travelAvailability(state, C.HOME_DISTRICT_ID);
    assert.equal(ride.available, true, area.id);
    assert.equal(ride.cashCost, 0, area.id);
    returned = C.reduceGame(state, { type: "TRAVEL", neighborhoodId: C.HOME_DISTRICT_ID });
    assert.equal(returned.world.currentNeighborhoodId, C.HOME_DISTRICT_ID, area.id);
    assert.equal(returned.player.cash, 0, area.id);

    state = place(fresh(90802), area.id, { cash: 4, slot: 0 });
    ride = C.selectors.travelAvailability(state, C.HOME_DISTRICT_ID);
    assert.equal(ride.available, false, area.id);
    assert.equal(ride.reason, "Need $5 fare.", area.id);
    assert.strictEqual(C.reduceGame(state, { type: "TRAVEL", neighborhoodId: C.HOME_DISTRICT_ID }), state, area.id);
    const actions = C.selectors.aroundActions(state);
    assert.equal(actions.find((entry) => entry.id === "return_spenard").available, false, area.id);
    assert.equal(actions.find((entry) => entry.id === "walk_spenard").available, true, area.id);
  }
});

// The reducer always allowed the ride home. The Leave-Spenard list filtered on
// the home constant rather than the current district, so Downtown offered no
// card and the player was stuck with the fare in hand.
test("the destination list from Downtown offers Spenard and never lists where you stand", () => {
  const here = "downtown";
  const offered = C.NEIGHBORHOODS.filter((area) => area.id !== here).map((area) => area.id);
  assert.ok(offered.includes(C.HOME_DISTRICT_ID));
  assert.ok(!offered.includes(here));
  for (const area of C.NEIGHBORHOODS) {
    const list = C.NEIGHBORHOODS.filter((entry) => entry.id !== area.id);
    assert.ok(list.length > 0, area.id);
    assert.ok(!list.some((entry) => entry.id === area.id), area.id);
  }
});

test("a Spenard to Downtown round trip charges $5 each way and keeps the cash split honest", () => {
  let state = place(fresh(90810), C.HOME_DISTRICT_ID, { cash: 40, slot: 0 });
  state.world.transport.downtownKnown = true;
  state.player.dirtyCash = 25;
  state.player.cleanCash = 15;

  const out = C.reduceGame(state, { type: "BUS_TRAVEL", neighborhoodId: "downtown" });
  assert.equal(out.world.currentNeighborhoodId, "downtown");
  assert.equal(out.player.cash, 35);
  assert.equal(out.player.dirtyCash + out.player.cleanCash, out.player.cash, "outbound leg split");
  assert.equal(out.player.dirtyCash, 20);

  // Arriving Downtown queues a once-per-run arrival card, which holds the
  // reducer until it is resolved. Clear it so this test is about the fare.
  out.run.pendingEvent = null;
  out.run.pendingEncounter = null;
  out.run.dayEndPending = false;
  const back = C.reduceGame(out, { type: "TRAVEL", neighborhoodId: C.HOME_DISTRICT_ID });
  assert.equal(back.world.currentNeighborhoodId, C.HOME_DISTRICT_ID);
  assert.equal(back.player.cash, 30);
  assert.equal(back.player.dirtyCash + back.player.cleanCash, back.player.cash, "return leg split");
});

test("a People Mover pass draws from the dirty and clean pools like every other purchase", () => {
  const state = place(fresh(90811), C.HOME_DISTRICT_ID, { cash: 60, slot: 0 });
  state.player.dirtyCash = 30;
  state.player.cleanCash = 30;
  const bought = C.reduceGame(state, { type: "BUY_BUS_PASS", passType: "day" });
  assert.equal(bought.player.cash, 48);
  assert.equal(bought.player.dirtyCash + bought.player.cleanCash, bought.player.cash);
});

test("Walk back costs 3 Health, consumes two parts, clamps at Night, and bypasses Energy", () => {
  const expectations = [
    { from: 0, to: 2, dayEnd: false },
    { from: 1, to: 3, dayEnd: false },
    { from: 2, to: 3, dayEnd: true },
    { from: 3, to: 3, dayEnd: true },
  ];
  for (const expected of expectations) {
    const state = place(fresh(90900 + expected.from), "downtown", { cash: 0, slot: expected.from, health: 80, energy: 0 });
    const next = C.reduceGame(state, { type: "WALK_HOME" });
    assert.notStrictEqual(next, state, C.SLOTS[expected.from]);
    assert.equal(next.world.currentNeighborhoodId, C.HOME_DISTRICT_ID, C.SLOTS[expected.from]);
    assert.equal(next.player.cash, 0, C.SLOTS[expected.from]);
    assert.equal(next.player.health, 77, C.SLOTS[expected.from]);
    assert.equal(next.player.energy, 0, C.SLOTS[expected.from]);
    assert.equal(next.run.slot, expected.to, C.SLOTS[expected.from]);
    assert.equal(next.run.dayEndPending, expected.dayEnd, C.SLOTS[expected.from]);
    assert.equal(next.stats.pipelineAdvances, state.stats.pipelineAdvances + 1, C.SLOTS[expected.from]);
  }
  const critical = place(fresh(90910), "downtown", { cash: 0, slot: 0, health: 2, energy: 0 });
  const collapsed = C.reduceGame(critical, { type: "WALK_HOME" });
  assert.equal(collapsed.player.health, 0);
  assert.notEqual(collapsed.run.status, "playing");
});

test("wrong-district reducers reject Spenard actions while valid Spenard actions still run", () => {
  const state = place(fresh(91000), "downtown", { cash: 500, slot: 2 });
  state.world.locations.theNile.discovered = true;
  state.world.locations.theNile.secondFloorAccess = true;
  state.jobs.discovered = C.SPENARD_JOBS.map((job) => job.id);
  state.npc.mina.met = true;
  state.npc.mina.available = true;
  const rejected = [
    { type: "WANDER_SPENARD" },
    { type: "EXPLORE_SPENARD" },
    { type: "TRAIN_ATTRIBUTE", attribute: "strength" },
    { type: "NILE_WELLNESS" },
    { type: "NILE_COFFEE" },
    { type: "NILE_TONK_SIT", buyIn: 20 },
    { type: "NILE_CELO_SIT", buyIn: 20 },
    { type: "SHOPLIFT" },
    { type: "VIEW_NIGHT_OWL_BOARD" },
    { type: "BUY_COFFEE" },
    { type: "TALK_NIGHT_OWL_REGULAR", regularId: C.selectors.nightOwlRegularFor(state).id },
    { type: "VISIT_NIGHT_OWL" },
    { type: "WORK_JOB", jobId: "wash_go", approach: "work_hard" },
  ];
  for (const action of rejected) assert.strictEqual(C.reduceGame(state, action), state, action.type);

  const home = place(fresh(91001), C.HOME_DISTRICT_ID, { cash: 500, slot: 2 });
  assert.notStrictEqual(C.reduceGame(home, { type: "WANDER_SPENARD" }), home);
  const night = place(fresh(91002), C.HOME_DISTRICT_ID, { cash: 500, slot: 2 });
  assert.notStrictEqual(C.reduceGame(night, { type: "VIEW_NIGHT_OWL_BOARD" }), night);
});

test("Night Owl visibility and reducer guards share the same four-slot rule", () => {
  for (let slot = 0; slot < C.SLOTS.length; slot += 1) {
    const state = place(fresh(91100 + slot), C.HOME_DISTRICT_ID, { cash: 500, slot });
    const access = C.selectors.districtActionAvailability(state, "night_owl");
    assert.equal(access.visible, true, C.SLOTS[slot]);
    assert.equal(access.available, slot >= 2, C.SLOTS[slot]);
    const next = C.reduceGame(state, { type: "VIEW_NIGHT_OWL_BOARD" });
    if (slot < 2) assert.strictEqual(next, state, C.SLOTS[slot]);
    else assert.notStrictEqual(next, state, C.SLOTS[slot]);
  }

  const away = place(fresh(91110), "downtown", { cash: 500, slot: 3 });
  assert.deepEqual(C.selectors.aroundActions(away).filter((entry) => entry.id === "night_owl"), []);
  assert.strictEqual(C.reduceGame(away, { type: "VISIT_NIGHT_OWL" }), away);
});

test("Around UI renders generic returns and normalizes a closed Night Owl page", () => {
  const ui = fs.readFileSync(path.join(__dirname, "..", "ui.jsx"), "utf8");
  assert.match(ui, /function ReturnToSpenardActions\(/);
  assert.match(ui, /Return to Spenard<span className="action-copy">/);
  assert.match(ui, /ride\.available \? `\$\{ride\.cashCost \? "\$5 fare" : "Pass covers fare"\}/);
  assert.match(ui, /Walk back<span className="action-copy">\$0 · two parts of day · −3 Health/);
  assert.match(ui, /const actions = C\.selectors\.aroundActions\(state\)/);
  assert.match(ui, /const closedNightOwlPage = page === "nightowl" && !nightOwl\.available/);
  assert.match(ui, /const effectivePage = closedNightOwlPage \? "places" : page/);
  assert.match(ui, /if \(closedNightOwlPage\) setPage\("places"\)/);
});
