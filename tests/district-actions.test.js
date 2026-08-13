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
  for (const id of ["explore_spenard", "local_intel", "night_owl", "spenard_gym", "spenard_gambling"]) assert.ok(spenard.includes(id), id);
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
  state.world.locations.gamblingKnown = true;
  state.jobs.discovered = C.SPENARD_JOBS.map((job) => job.id);
  state.people.mara.met = true;
  state.people.mara.available = true;
  const rejected = [
    { type: "WANDER_SPENARD" },
    { type: "EXPLORE_SPENARD" },
    { type: "TRAIN_ATTRIBUTE", attribute: "strength" },
    { type: "GAMBLE", stake: 20, approach: "read" },
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
    const entry = C.selectors.aroundActions(state).find((action) => action.id === "night_owl");
    assert.equal(access.visible, true, C.SLOTS[slot]);
    assert.equal(access.available, slot >= 2, C.SLOTS[slot]);
    assert.equal(entry.available, slot >= 2, C.SLOTS[slot]);
    if (slot < 2) assert.equal(entry.reason, "Opens at dusk.", C.SLOTS[slot]);
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
  assert.match(ui, /const closedNightOwlPage = page === "nightowl" && !nightOwl\?\.available/);
  assert.match(ui, /const effectivePage = staleLocalPage \|\| closedNightOwlPage \? "root" : page/);
  assert.match(ui, /useEffect\(\(\) => \{ if \(effectivePage !== page\) setPage\("root"\); \}/);
});
