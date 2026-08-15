const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../game-core.js");
const E = require("../encounters.js");

function run(seed = 907) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "CHOOSE_BACKGROUND", backgroundId: "shooter" });
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.daySummary = null;
  return state;
}

function fixedRng(value = 0) {
  return { next: () => value, int: (min) => min, pick: (items) => items[0], get state() { return 1; } };
}

test("encounter module exports authored data, random templates, and disabled mid/late stubs", () => {
  assert.equal(E.RANDOM_NPC_TEMPLATES.length, 4);
  assert.equal(E.AUTHORED_ENCOUNTERS.mini_mart_parking_lot.enabled, true);
  for (const id of ["mid_run_confrontation_stub", "late_confrontation_stub"]) {
    assert.equal(E.AUTHORED_ENCOUNTERS[id].enabled, false);
    assert.deepEqual(E.AUTHORED_ENCOUNTERS[id].choices, []);
    assert.deepEqual(E.AUTHORED_ENCOUNTERS[id].outcomes, []);
  }
});

test("Day 2 Night guarantees the Mini-Mart encounter and resolution consumes no second slot", () => {
  let state = run(22);
  state.run.day = 2; state.run.slot = 3; state.player.cash = 200;
  const before = state.stats.pipelineAdvances;
  state = C.reduceGame(state, { type: "END_MARKET" });
  assert.equal(state.run.pendingEncounter.id, "mini_mart_parking_lot");
  assert.equal(state.run.pendingEncounter.type, "authored");
  assert.equal(state.stats.pipelineAdvances, before + 1);
  const day = state.run.day, slot = state.run.slot;
  state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: "pay" });
  assert.equal(state.run.pendingEncounter.resolved, true);
  assert.equal(state.flags.paidCurtisPassage, true);
  assert.equal(state.stats.pipelineAdvances, before + 1);
  assert.deepEqual([state.run.day, state.run.slot], [day, slot]);
  state = C.reduceGame(state, { type: "ACKNOWLEDGE_ENCOUNTER" });
  assert.equal(state.run.pendingEncounter, null);
  assert.equal(state.stats.pipelineAdvances, before + 1);
});

test("preparation changes Mini-Mart choice eligibility without exposing odds", () => {
  const state = run();
  state.player.attributes = { combat: 1, charisma: 1, intelligence: 1 };
  state.player.gear.owned = []; state.player.gear.equipped.weapon = null;
  state.people.crew.tone.recruited = false;
  const encounter = E.buildAuthoredEncounter("mini_mart_parking_lot", state);
  let choices = E.getEligibleChoices(encounter, state);
  assert.equal(choices.some((item) => item.id === "fight"), false);
  assert.equal(choices.some((item) => /%|chance|probability/i.test(item.description)), false);
  state.player.attributes.combat = 3;
  choices = E.getEligibleChoices(encounter, state);
  assert.equal(choices.some((item) => item.id === "fight"), true);
  state.player.inventory.weed.qty = 2;
  assert.equal(E.getEligibleChoices(encounter, state).some((item) => item.id === "surrender:weed"), true);
});

test("robbery always creates a random encounter and a won fight gives concrete loot", () => {
  const state = run();
  state.player.attributes.combat = 3;
  const encounter = E.checkEncounterTrigger(state, 1, 0, { activity: "robbery", areaId: "north_star_lot", rng: fixedRng(0) });
  assert.equal(encounter.type, "random");
  state.run.pendingEncounter = encounter;
  const result = E.resolveEncounterChoice(encounter, "fight", state, fixedRng(0));
  assert.equal(result.run.pendingEncounter.resolved, true);
  assert.ok(result.run.pendingEncounter.loot.cash > 0 || result.run.pendingEncounter.loot.products.length > 0 || result.run.pendingEncounter.loot.gear);
  assert.equal(result.encounterLog.randomFights, 1);
  assert.equal(result.encounterLog.randomKills, 1);
  assert.ok(result.player.heat > state.player.heat);
  assert.equal(result.flags.seriousViolence, undefined, "a random kill must not set authored story violence");
});

test("running always preserves life while charging a visible cost", () => {
  const state = run();
  state.player.health = 2; state.player.cash = 50; state.player.inventory.weed.qty = 2;
  const encounter = E.checkEncounterTrigger(state, 1, 3, { activity: "robbery", areaId: "airport_industrial", rng: fixedRng(0.99) });
  state.run.pendingEncounter = encounter;
  const result = E.resolveEncounterChoice(encounter, "run", state, fixedRng(0.99));
  assert.equal(result.run.pendingEncounter.resolved, true);
  assert.ok(result.player.health >= 1);
  assert.ok(result.player.inventory.weed.qty < 2 || result.player.cash < 50);
});

test("same seed and choices reproduce the same Day 2 encounter outcome and RNG state", () => {
  function play() {
    let state = run(4411); state.run.day = 2; state.run.slot = 3; state.player.attributes.combat = 3;
    state = C.reduceGame(state, { type: "END_MARKET" });
    state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: "fight" });
    return state;
  }
  const a = play(), b = play();
  assert.deepEqual(a.run.pendingEncounter.result, b.run.pendingEncounter.result);
  assert.deepEqual(a.run.pendingEncounter.loot, b.run.pendingEncounter.loot);
  assert.deepEqual(a.encounterLog, b.encounterLog);
  assert.equal(a.run.rngState, b.run.rngState);
});

test("active and resolved encounter state hydrates additively under the v3 save key", () => {
  const state = run();
  state.run.pendingEncounter = E.buildAuthoredEncounter("mini_mart_parking_lot", state);
  const hydrated = C.inspectSave(C.serializeRun(state));
  assert.equal(hydrated.valid, true);
  assert.equal(hydrated.state.run.pendingEncounter.id, "mini_mart_parking_lot");
  assert.deepEqual(hydrated.state.encounterLog, { resolved: [], activeFlags: {}, randomKills: 0, randomFights: 0 });
  assert.equal(C.SAVE_KEY, "907ogr_v11");
});

test("authored serious violence closes the intact Mina escape ending", () => {
  function ending(serious) {
    let state = run();
    state.run.day = 7; state.run.slot = 3; state.run.finalPlan = "escape";
    // Bonded is what the old trust 3+ intact-ending gate maps to.
    state.npc.mina.ledger.push({ type: "honesty", event: "test_history", location: null, value: null, day: 1, count: 20, source: "witnessed" });
    state.npc.mina.available = true; state.npc.mina.usedWithoutConsent = false;
    state.flags.seriousViolence = serious;
    state = C.reduceGame(state, { type: "END_MARKET" });
    state.run.pendingEvent = null; state.run.pendingEncounter = null;
    state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
    return state.run.ending;
  }
  assert.equal(ending(false), "mina_escape");
  assert.equal(ending(true), "clean_exit");
});
