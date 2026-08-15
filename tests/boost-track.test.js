const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

function fresh(seed = 907) {
  return C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Rookie" });
}

function openTier(tier = 1) {
  const state = fresh(910 + tier);
  state.boost.visible = true;
  state.boost.tier = tier;
  state.boost.technique = tier === 1 ? 1 : tier === 2 ? 5 : 13;
  state.run.openingPending = false;
  state.run.pendingEvent = null;
  return state;
}

function addCrew(state, id = "eli") {
  state.people.crew[id] = { ...state.people.crew[id], introduced: true, recruited: true, status: "active", loyalty: 1 };
  return state;
}

test("Boost is absent before unlock and the first store exploration is transactional", () => {
  let state = fresh(1001);
  assert.equal(state.boost.visible, false);
  assert.deepEqual(C.selectors.visibleBoostTargets(state), []);
  const ui = fs.readFileSync(path.join(__dirname, "..", "ui.jsx"), "utf8");
  assert.match(ui, /state\.boost\.visible/);
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.run.pendingEvent?.id, "boost_first_opportunity");
  assert.ok(state.run.pendingEvent.description.trim().split(/\s+/).length < 40);
  assert.deepEqual(state.run.pendingEvent.choices.map((choice) => choice.label), ["Pocket it", "Keep walking"]);
});

test("first successful shoplifting action reveals Boost", () => {
  const state = C.reduceGame(fresh(1002), { type: "SHOPLIFT", roll: 0 });
  assert.equal(state.boost.visible, true);
  assert.equal(state.boost.tier, 1);
  assert.equal(state.boost.technique, 1);
});

test("only unlocked tiers in the current district are visible", () => {
  const state = openTier(1);
  assert.ok(C.selectors.visibleBoostTargets(state).every((target) => target.tier === 1 && target.areaId === "north_star_lot"));
  state.boost.tier = 2;
  assert.ok(C.selectors.visibleBoostTargets(state).some((target) => target.tier === 2));
  assert.ok(C.selectors.visibleBoostTargets(state).every((target) => target.tier <= 2));
});

test("Tier 2 unlocks at technique 5 and Tier 3 needs technique 13 plus crew", () => {
  let state = openTier(1);
  state.boost.technique = 4;
  state = C.reduceGame(state, { type: "BOOST", targetId: "night_owl", roll: 0 });
  assert.equal(state.boost.technique, 5);
  assert.equal(state.boost.tier, 2);

  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.boost.technique = 12;
  state.boost.dailyHits = {};
  addCrew(state);
  state = C.reduceGame(state, { type: "BOOST", targetId: "northern_value", roll: 0 });
  assert.equal(state.boost.technique, 13);
  assert.equal(state.boost.tier, 3);

  const noCrew = openTier(2);
  noCrew.boost.technique = 13;
  assert.equal(C.selectors.boostTier(noCrew), 2);
});

test("failed boosts persist store bans and technique increments only on success", () => {
  let state = openTier(1);
  state = C.reduceGame(state, { type: "BOOST", targetId: "night_owl", roll: 1 });
  assert.ok(state.boost.storeBans.includes("night_owl"));
  assert.equal(state.boost.technique, 1);
  state.run.pendingEvent = null;
  state.boost.dailyHits = {};
  state = C.reduceGame(state, { type: "BOOST", targetId: "spenard_fuel", roll: 0 });
  assert.equal(state.boost.technique, 2);
});

test("one hit per store per day is enforced", () => {
  let state = openTier(1);
  state = C.reduceGame(state, { type: "BOOST", targetId: "night_owl", roll: 0 });
  const technique = state.boost.technique;
  state.run.pendingEvent = null;
  const blocked = C.reduceGame(state, { type: "BOOST", targetId: "night_owl", roll: 0 });
  assert.equal(blocked, state);
  assert.equal(blocked.boost.technique, technique);
});

// v1.13: base tier heat (0.5 / 1 / 2) now passes through the district heat
// multiplier — Spenard's boost heatMod is 0.9, so home-turf lifts run a
// little quieter than the raw tier number.
test("successful tier Heat is the tier base times Spenard's 0.9 boost multiplier", () => {
  let tier1 = openTier(1);
  tier1 = C.reduceGame(tier1, { type: "BOOST", targetId: "night_owl", roll: 0 });
  assert.ok(Math.abs(tier1.player.heat - 0.5 * 0.9) < 1e-9);

  let tier2 = openTier(2);
  tier2 = C.reduceGame(tier2, { type: "BOOST", targetId: "northern_value", roll: 0 });
  assert.ok(Math.abs(tier2.player.heat - 1 * 0.9) < 1e-9);

  let tier3 = addCrew(openTier(3));
  tier3.boost.crewAssigned = "eli";
  tier3 = C.reduceGame(tier3, { type: "BOOST", targetId: "warehouse_club", roll: 0 });
  assert.ok(Math.abs(tier3.player.heat - 2 * 0.9) < 1e-9);
  assert.ok(tier3.boost.merchandise >= 200);
});

test("Tier 2 best window adds exactly twenty percentage points", () => {
  const state = openTier(2);
  const target = C.BOOST_TARGETS.find((item) => item.id === "northern_value");
  state.run.slot = 0;
  const outside = C.selectors.boostChance(state, target);
  state.run.slot = target.windowSlot;
  assert.ok(Math.abs((C.selectors.boostChance(state, target) - outside) - 0.20) < Number.EPSILON);
});

test("fence conversion rate scales with standing", () => {
  assert.equal(C.selectors.boostFenceRate(0), 0.40);
  assert.equal(C.selectors.boostFenceRate(3), 0.55);
  assert.equal(C.selectors.boostFenceRate(5), 0.60);
  const state = addCrew(openTier(3));
  state.boost.merchandise = 400;
  state.boost.fenceStanding = 3;
  const before = state.player.cash;
  const sold = C.reduceGame(state, { type: "FENCE_BOOST_GOODS" });
  assert.equal(sold.player.cash - before, 220);
  assert.equal(sold.boost.merchandise, 0);
});
