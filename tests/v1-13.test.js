const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Districts = require("../src/data/districts.js");
const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");

// v1.13 — Criminal Economy Cluster: district modifiers, the Stick track,
// plug suspicion, cross-district awareness bleed, and the seeded boost-unlock
// variants. Reducer behavior is exercised through reduceGame like every other
// suite; UI wiring is asserted as source text in the ui-contract style.

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Thirteen" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  return structuredClone(state);
}

// A run mid-week with the Stick ladder unlocked at the requested rung.
function stickReady(seed, { rep = 0, weapon = null, day = 3, slot = 3 } = {}) {
  const state = fresh(seed);
  state.rob.visible = true;
  state.stick.rep = rep;
  if (weapon) {
    state.player.gear.owned.push(weapon);
    state.player.gear.equipped.weapon = weapon;
  }
  state.run.day = day;
  state.run.slot = slot;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.dayEndPending = false;
  return state;
}

test("district modifiers cover every track in every district, real and scaffolded", () => {
  for (const id of ["north_star_lot", "downtown", "airport_industrial", "fairview", "mountain_view"]) {
    for (const track of ["market", "boost", "stick"]) {
      const mods = Districts.DISTRICT_MODS[id][track];
      assert.equal(typeof mods.diffMod, "number", `${id}.${track}.diffMod`);
      assert.ok(mods.heatMod > 0, `${id}.${track}.heatMod`);
    }
    assert.ok(Array.isArray(Districts.DISTRICT_ADJACENCY[id]), `${id} adjacency`);
  }
  // Spenard's identity: easy quiet market, hard loud stickups.
  assert.ok(Districts.DISTRICT_MODS.north_star_lot.market.diffMod < 0);
  assert.ok(Districts.DISTRICT_MODS.north_star_lot.stick.heatMod > 1);
});

test("the Stick ladder gates on visibility, rep, and a weapon", () => {
  const locked = fresh(300);
  assert.equal(C.selectors.stickTier(locked), 0);
  assert.equal(C.selectors.visibleStickTargets(locked).length, 0);

  const tier1 = stickReady(301);
  assert.equal(C.selectors.stickTier(tier1), 1);
  assert.ok(C.selectors.visibleStickTargets(tier1).every((target) => target.tier === 1));

  const repNoWeapon = stickReady(302, { rep: 6 });
  assert.equal(C.selectors.stickTier(repNoWeapon), 1, "rep without a weapon stays street-level");

  const tier2 = stickReady(303, { rep: 4, weapon: "utility_knife" });
  assert.equal(C.selectors.stickTier(tier2), 2);
  const register = C.selectors.stickTargetAvailability(tier2, "spenard_fuel_till");
  assert.ok(register.available, register.reason);

  const tier3 = stickReady(304, { rep: 10, weapon: "cheap_handgun" });
  assert.equal(C.selectors.stickTier(tier3), 3);
  // Tier 3 still demands planning: cased twice or crew on deck.
  const bigJob = C.selectors.stickTargetAvailability(tier3, "rec_center_dice");
  assert.equal(bigJob.available, false);
  assert.match(bigJob.reason, /Case it twice or bring crew/);
});

test("a stickup pays, raises rep, and lands Spenard's multiplied heat", () => {
  const state = stickReady(305, { rep: 4, weapon: "utility_knife" });
  const heatBefore = state.player.heat;
  const after = C.reduceGame(state, { type: "STICKUP", targetId: "spenard_fuel_till" });
  assert.notEqual(after, state, "the stickup must resolve");
  assert.equal(after.stick.dailyCount, 1);
  assert.equal(after.stats.robbery.attempts, state.stats.robbery.attempts + 1);
  const addedHeat = after.player.heat - heatBefore;
  // Success or failure, the heat that lands carries the 1.3 Spenard stick
  // multiplier: base 3 becomes 3.9 (success, or 2.6 clean) / failure 3.9+.
  assert.ok(addedHeat >= 2 * 1.3 - 1e-9, `heat moved by ${addedHeat}`);
  assert.ok(after.run.pendingOperationResult, "stickups report through the operation result surface");
  // District word spreads: Spenard hears it now, neighbors are queued for tomorrow.
  assert.equal(after.criminalProfile.districtAwareness.north_star_lot.stick, 1);
  assert.ok(after.criminalProfile.bleedPending.length >= 1);
  // Goodie works this district; he gets wary.
  assert.equal(after.plugs.records.goodie.suspicion, 1);
});

test("two robberies is the day's ceiling across every robbery surface", () => {
  let state = stickReady(306, { rep: 4, weapon: "utility_knife", slot: 0 });
  state.stick.dailyCount = 2;
  const street = C.selectors.stickTargetAvailability(state, "washgo_regular");
  assert.equal(street.available, false);
  assert.match(street.reason, /Two in a day/);
  assert.match(C.selectors.robAvailability(state).reason || "", /Two robberies in a day|already tried|no part of the run|Resolve the current/);
  // Dealer robbery respects the same ceiling.
  state.people.dealers.goodie.known = true;
  const dealer = C.selectors.dealerActions(state, "goodie");
  assert.equal(dealer.rob.available, false);
});

test("casing prices the take and sharpens the job by exactly 0.06 per pass", () => {
  let state = stickReady(307, { rep: 4, weapon: "utility_knife", slot: 1 });
  const before = C.selectors.stickChance(state, C.STICK_TARGETS.find((target) => target.id === "downtown_fuel_till"));
  // Case the Spenard register (in-district requirement).
  const chanceBefore = C.selectors.stickChance(state, C.STICK_TARGETS.find((target) => target.id === "spenard_fuel_till"));
  state = C.reduceGame(state, { type: "CASE_TARGET", targetId: "spenard_fuel_till" });
  assert.equal(state.stick.casedTargets[0].timesObserved, 1);
  const chanceAfter = C.selectors.stickChance(state, C.STICK_TARGETS.find((target) => target.id === "spenard_fuel_till"));
  assert.ok(Math.abs(chanceAfter - chanceBefore - 0.06) < 1e-9);
  state.run.dayEndPending = false;
  state = C.reduceGame(state, { type: "CASE_TARGET", targetId: "spenard_fuel_till" });
  assert.equal(state.stick.casedTargets[0].timesObserved, 2);
  state.run.dayEndPending = false;
  const third = C.reduceGame(state, { type: "CASE_TARGET", targetId: "spenard_fuel_till" });
  assert.equal(third, state, "a third casing pass is wasted motion and refused");
  assert.ok(before >= 0.15, "sanity: chance floor holds");
});

test("a queued retaliation arrives as a two-choice card after the day rolls", () => {
  let state = stickReady(308, { rep: 4, weapon: "utility_knife", slot: 3 });
  state.stick.retaliationQueue.push({ targetId: "spenard_fuel_till", areaId: "north_star_lot", triggerDay: state.run.day + 1 });
  state.run.dayEndPending = true;
  const next = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(next.run.pendingEvent?.id, "stick_retaliation");
  assert.equal(next.run.pendingEvent.choices.length, 2);
  assert.equal(next.stick.retaliationQueue.length, 0);
  // Both choices resolve through the normal event pipeline.
  const resolved = C.reduceGame(next, { type: "RESOLVE_EVENT", choiceIndex: 1 });
  assert.equal(resolved.run.pendingEvent, null);
});

test("plug suspicion prices at three, cuts off at five, and a clean buy rebuilds", () => {
  const state = fresh(309);
  state.plugs.unlocked = ["goodie"];
  state.market.visible = true;
  state.world.currentNeighborhoodId = "north_star_lot";
  const calm = C.selectors.tradeUnitPrices(state, "weed").buy;
  const wary = structuredClone(state);
  wary.plugs.records.goodie.suspicion = 3;
  const priced = C.selectors.tradeUnitPrices(wary, "weed").buy;
  assert.ok(priced > calm, "suspicion 3 must raise the buy price");
  assert.ok(Math.abs(priced / calm - 1.1) < 0.03, `expected ~10% premium, got ${(priced / calm - 1).toFixed(3)}`);

  const burned = structuredClone(state);
  burned.plugs.records.goodie.suspicion = 5;
  assert.equal(C.selectors.unlockedPlugForProduct(burned, "weed"), null, "suspicion 5 cuts supply");

  // A clean purchase — no robbery on his block today — works it back down.
  const rebuilding = structuredClone(state);
  rebuilding.plugs.records.goodie.suspicion = 2;
  rebuilding.player.cash = 500;
  const bought = C.reduceGame(rebuilding, { type: "BUY", productId: "weed", qty: 1 });
  assert.equal(bought.plugs.records.goodie.suspicion, 1);
});

test("robbing the plug directly burns standing with every plug at once", () => {
  const state = stickReady(310, { rep: 1, slot: 1 });
  state.people.dealers.goodie.known = true;
  state.plugs.unlocked = ["goodie", "tasha"];
  state.plugs.records.tasha.standing = 2;
  const after = C.reduceGame(state, { type: "ROB_DEALER", dealerId: "goodie" });
  assert.notEqual(after, state);
  assert.equal(after.plugs.records.tasha.standing, -1, "tasha hears about it and drops three standing");
  assert.ok(after.plugs.records.goodie.suspicion >= 2, "the robbed plug is the most suspicious of all");
});

test("district awareness bleeds to neighbors at half strength a day later", () => {
  let state = stickReady(311, { rep: 0, slot: 3 });
  state = C.reduceGame(state, { type: "STICKUP", targetId: "chilkoots_stumbler" });
  assert.equal(state.criminalProfile.districtAwareness.north_star_lot.stick, 1);
  assert.equal(state.criminalProfile.districtAwareness.downtown.stick, 0, "the bleed waits a day");
  let rolled = structuredClone(state);
  rolled.run.pendingEvent = null;
  rolled.run.pendingOperationResult = null;
  rolled.run.dayEndPending = true;
  rolled = C.reduceGame(rolled, { type: "CONFIRM_END_DAY" });
  assert.equal(rolled.criminalProfile.districtAwareness.downtown.stick, 0.5);
  assert.equal(rolled.criminalProfile.districtAwareness.airport_industrial.stick, 0.5);
  assert.equal(rolled.criminalProfile.bleedPending.length, 0);
});

test("the boost unlock varies by seed: three framings, no variant dominating", () => {
  const seen = new Map();
  for (let seed = 5000; seed < 5050; seed++) {
    let state = fresh(seed);
    state.run.day = 2;
    state.run.slot = 0;
    state.run.pendingEvent = null;
    state.run.dayEndPending = false;
    state.flags.goodieEncounterSeen = true; // force the boost branch of the wander unlock
    state.player.energy = 4;
    const after = C.reduceGame(state, { type: "WANDER_SPENARD" });
    const eventCard = after.run.pendingEvent;
    assert.equal(eventCard?.id, "boost_first_opportunity", `seed ${seed} must offer the lift`);
    assert.ok(eventCard.description.split(/\s+/).length < 40, "encounter copy stays under forty words");
    assert.equal(eventCard.choices[0].label, "Pocket it");
    assert.equal(eventCard.choices[1].label, "Keep walking");
    const key = `${eventCard.title}:${eventCard.where}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  assert.ok(seen.size >= 2, `expected at least two variants, saw ${seen.size}`);
  const heaviest = Math.max(...seen.values());
  assert.ok(heaviest <= 30, `no variant may dominate: heaviest fired ${heaviest}/50`);
});

test("the Hustle rail hosts the full Stick track and keeps Curtis off fresh screens", () => {
  assert.ok(ui.includes('type: "STICKUP", targetId: target.id'));
  assert.ok(ui.includes('type: "CASE_TARGET", targetId: target.id'));
  assert.ok(ui.includes("Slide Okafor"));
  // The rival card renders only once Curtis actually knows the operation.
  assert.ok(ui.includes('state.npc.curtis.relationship !== "unaware"'));
  assert.match(ui, /Rival pressure/);
  // The trade modal clamps to the plug's per-visit cap and floors at zero.
  assert.ok(ui.includes("C.selectors.plugMaxUnits(state, productId)"));
});

test("v10 sits on top of the ladder: new slices default in, nothing is retired", () => {
  assert.equal(C.VERSION, 10);
  assert.equal(C.SAVE_KEY, "907ogr_v10");
  assert.ok(C.LEGACY_SAVE_KEYS.includes("907ogr_v9"));
  const state = fresh(312);
  assert.equal(state.version, 10, "a fresh run is born at the current schema");
  const revived = C.hydrateRun(JSON.parse(C.serializeRun(state)));
  assert.equal(revived.stick.rep, 0);
  assert.ok(revived.criminalProfile.bleedPending.length === 0);
});
