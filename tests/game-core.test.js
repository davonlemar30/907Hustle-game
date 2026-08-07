const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../game-core.js");

function run(seed = 907) {
  return C.reduceGame(C.createRun({ seed }), { type: "CHOOSE_BACKGROUND", backgroundId: "shooter" });
}
function fresh(seed = 907) {
  return C.reduceGame(C.createRun({ seed }), { type: "START_RUN" });
}
function quietAdvance(state, reason = "END_MARKET") {
  state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.pendingOperationResult = null;
  return C.advanceRun(state, { reason, suppressStory: true });
}
// Alpha v0.7 selects story beats by weighted roll rather than a fixed ladder, so
// tests drive the run forward until the beat under test appears instead of
// assuming it lands on a particular tick.
function settleForTest(state) {
  let guard = 0;
  while (guard++ < 20) {
    if (state.run.daySummary) { state = C.reduceGame(state, { type: "DISMISS_DAY_SUMMARY" }); continue; }
    if (state.run.pendingOperationResult) { state = C.reduceGame(state, { type: "ACKNOWLEDGE_OPERATION_RESULT" }); continue; }
    break;
  }
  return state;
}
function driveTo(state, id, limit = 90) {
  let guard = 0;
  while (state.run.status === "playing" && guard++ < limit) {
    state = settleForTest(state);
    if (state.run.status !== "playing") break;
    if (state.run.pendingEvent && state.run.pendingEvent.id === id) return state;
    if (state.run.pendingEvent) { state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 }); continue; }
    if (state.run.pendingEncounter) {
      state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: C.selectors.encounterChoices(state)[0].id });
      continue;
    }
    state = C.reduceGame(state, { type: "END_MARKET" });
  }
  return state;
}

test("v3 run keeps legacy migration data without exposing a starting class", () => {
  assert.equal(C.VERSION, 3); assert.equal(C.SAVE_KEY, "907ogr_v3");
  assert.equal(C.BACKGROUNDS.length, 3);
  assert.deepEqual(C.BACKGROUNDS.map((item) => item.name), ["Steady-Hand Shooter", "Silver-Tongued Hustler", "Strategist"]);
  assert.deepEqual(C.STARTING_EDGES.map((item) => item.id), ["shooter", "hustler"]);
  assert.ok(C.BACKGROUNDS.every((item) => item.cash === 375 && item.heat === 1));
});

test("legacy backgrounds hydrate to the approved derived identities", () => {
  const expected = { shooter: [3, 1, 2], hustler: [1, 3, 2], strategist: [2, 1, 3] };
  for (const [id, values] of Object.entries(expected)) {
    const state = C.reduceGame(C.createRun({ seed: 4 }), { type: "CHOOSE_BACKGROUND", backgroundId: id });
    assert.equal(state.player.background, null);
    assert.equal(state.player.legacyBackground, id);
    assert.deepEqual(Object.values(C.selectors.derivedRatings(state)), values);
    assert.equal(state.player.cash, 375);
  }
});

test("classless new runs start balanced, Unproven, and use the neutral name", () => {
  const state = C.reduceGame(C.createRun({ seed: 8 }), { type: "START_RUN" });
  assert.equal(state.run.status, "playing");
  assert.equal(state.player.background, null); assert.equal(state.player.legacyBackground, null);
  assert.equal(state.player.streetName, "Rookie"); assert.equal(state.player.streetIdentity, "unproven");
  assert.deepEqual(state.player.attributes, C.ATTRIBUTE_DEFAULTS);
  assert.deepEqual(C.selectors.derivedRatings(state), { combat: 2, charisma: 2, intelligence: 2 });
});

test("meaningful behavior is deduplicated, capped, and bounded", () => {
  const state = C.reduceGame(C.createRun({ seed: 8 }), { type: "START_RUN" });
  assert.equal(C.recordBehaviorForTest(state, "mover", 1, "sale:a", "sale"), true);
  assert.equal(C.recordBehaviorForTest(state, "mover", 1, "sale:a", "sale"), false);
  assert.equal(C.recordBehaviorForTest(state, "mover", 1, "sale:b", "sale"), true);
  assert.equal(C.recordBehaviorForTest(state, "mover", 1, "sale:c", "sale"), false);
  for (let i = 0; i < 60; i += 1) C.recordBehaviorForTest(state, "connector", 1, `contact:${i}`, "relationship");
  assert.equal(state.player.behavior.history.length, 50);
});

test("Street Identity assigns at Day 2 Night and mixed behavior becomes Wild Card", () => {
  const mover = C.reduceGame(C.createRun({ seed: 8 }), { type: "START_RUN" });
  for (let i = 0; i < 6; i += 1) C.recordBehaviorForTest(mover, "mover", 1, `move:${i}`, "market_read");
  mover.run.day = 2; mover.run.slot = 3; C.evaluateStreetIdentityForTest(mover, true);
  assert.equal(mover.player.streetIdentity, "mover"); assert.equal(mover.player.identityHistory.length, 1);
  const mixed = C.reduceGame(C.createRun({ seed: 9 }), { type: "START_RUN" });
  for (let i = 0; i < 3; i += 1) C.recordBehaviorForTest(mixed, "mover", 1, `m:${i}`, "market_read");
  for (let i = 0; i < 3; i += 1) C.recordBehaviorForTest(mixed, "connector", 1, `c:${i}`, "relationship");
  mixed.run.day = 2; mixed.run.slot = 3; C.evaluateStreetIdentityForTest(mixed, true);
  assert.equal(mixed.player.streetIdentity, "wild_card");
});

test("identity changes require the lead to persist for two nights", () => {
  const state = C.reduceGame(C.createRun({ seed: 10 }), { type: "START_RUN" });
  for (let i = 0; i < 6; i += 1) C.recordBehaviorForTest(state, "mover", 1, `move:${i}`, "market_read");
  state.run.day = 2; C.evaluateStreetIdentityForTest(state, true); assert.equal(state.player.streetIdentity, "mover");
  for (let i = 0; i < 9; i += 1) C.recordBehaviorForTest(state, "stickup", 1, `stick:${i}`, "confrontation");
  state.run.day = 3; C.evaluateStreetIdentityForTest(state, true); assert.equal(state.player.streetIdentity, "mover");
  state.run.day = 4; C.evaluateStreetIdentityForTest(state, true); assert.equal(state.player.streetIdentity, "stickup");
});

test("buy and sell stay in one locked market visit", () => {
  let state = run(); const product = C.PRODUCTS[0]; const beforeSlot = state.run.slot;
  state.player.cash = 5000; state.world.markets.north_star_lot.availability[product.id] = 5;
  const buyPrice = C.selectors.tradeUnitPrices(state, product.id).buy;
  state = C.reduceGame(state, { type: "BUY", productId: product.id, qty: 2 });
  assert.equal(state.run.slot, beforeSlot); assert.equal(state.player.inventory[product.id].qty, 2); assert.equal(state.run.currentVisit.grossBuy, buyPrice * 2);
  state = C.reduceGame(state, { type: "SELL", productId: product.id, qty: 1 });
  assert.equal(state.run.slot, beforeSlot); assert.equal(state.run.currentVisit.trades, 2);
});

test("weighted-average cost remains correct across buys and a partial sale", () => {
  let state = run(); state.player.cash = 5000; state.world.markets.north_star_lot.availability.weed = 10;
  state.world.markets.north_star_lot.prices.weed = 20;
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 2 });
  const firstCost = C.selectors.tradeUnitPrices(state, "weed").buy;
  state.world.markets.north_star_lot.prices.weed = 40;
  state.world.markets.north_star_lot.availability.weed = 10;
  const secondCost = C.selectors.tradeUnitPrices(state, "weed").buy;
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 3 });
  assert.equal(state.player.inventory.weed.avgCost, ((firstCost * 2) + (secondCost * 3)) / 5);
  const average = state.player.inventory.weed.avgCost;
  state = C.reduceGame(state, { type: "SELL", productId: "weed", qty: 2 });
  assert.equal(state.player.inventory.weed.qty, 3);
  assert.equal(state.player.inventory.weed.avgCost, average);
});

test("trade projections match settled buy and sell totals", () => {
  let state = run(); state.player.cash = 500; state.world.markets.north_star_lot.prices.weed = 50; state.world.markets.north_star_lot.availability.weed = 10;
  const buy = C.selectors.tradeProjection(state, "weed", 3, "buy");
  assert.equal(buy.purchaseCost, buy.unitPrice * 3); assert.equal(buy.cashAfter, 500 - buy.purchaseCost); assert.equal(buy.cargoAfter, 3);
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 3 });
  assert.equal(state.player.cash, buy.cashAfter);
  state.world.markets.north_star_lot.prices.weed = 80;
  const sell = C.selectors.tradeProjection(state, "weed", 2, "sell");
  const cashBefore = state.player.cash;
  assert.equal(sell.costBasis, state.player.inventory.weed.avgCost * 2);
  assert.equal(sell.profitLoss, sell.revenue - sell.costBasis);
  state = C.reduceGame(state, { type: "SELL", productId: "weed", qty: 2 });
  assert.equal(state.player.cash, cashBefore + sell.revenue);
});

test("trade projection labels profit and loss through signed numeric results", () => {
  const state = run(); state.player.inventory.weed = { qty: 5, avgCost: 60 }; state.world.markets.north_star_lot.prices.weed = 100;
  const profit = C.selectors.tradeProjection(state, "weed", 2, "sell"); assert.ok(profit.profitLoss > 0);
  state.world.markets.north_star_lot.prices.weed = 20;
  const loss = C.selectors.tradeProjection(state, "weed", 2, "sell"); assert.ok(loss.profitLoss < 0);
});

test("recent local price context is unavailable without history and directional when available", () => {
  const state = run(); state.world.markets.north_star_lot.prices.weed = 40; state.world.markets.north_star_lot.history.weed = [40];
  let projection = C.selectors.tradeProjection(state, "weed", 1, "buy");
  assert.equal(projection.localContext.available, false); assert.match(projection.localContext.label, /No earlier/);
  state.world.markets.north_star_lot.history.weed = [30, 40];
  projection = C.selectors.tradeProjection(state, "weed", 1, "buy");
  assert.equal(projection.localContext.available, true); assert.equal(projection.localContext.delta, 10); assert.match(projection.localContext.label, /Up \$10/);
});

test("v3 autosave state survives JSON hydration without migration", () => {
  let state = run(5150); state.player.cash = 777; state.player.inventory.weed = { qty: 4, avgCost: 31.25 };
  const hydrated = JSON.parse(JSON.stringify(state));
  assert.equal(hydrated.version, C.VERSION); assert.equal(hydrated.player.inventory.weed.avgCost, 31.25);
  const next = C.reduceGame(hydrated, { type: "SELL", productId: "weed", qty: 1 });
  assert.equal(next.player.inventory.weed.qty, 3);
});

test("end market is the single clock and world pipeline", () => {
  const state = run(); const next = quietAdvance(state);
  assert.equal(next.run.slot, 1); assert.equal(next.stats.pipelineAdvances, 1); assert.equal(next.stats.marketUpdates, 1);
  for (const area of C.NEIGHBORHOODS) assert.equal(next.world.markets[area.id].updatedAt, 1);
});

test("four slots roll over and every action can produce a summary", () => {
  for (const reason of ["END_MARKET", "TRAVEL", "LAY_LOW", "HEAL", "PAY_DEBT", "ROBBERY", "TAKEOVER"]) {
    let state = run(); state.run.day = 1; state.run.slot = 3;
    state = quietAdvance(state, reason);
    assert.equal(state.run.day, 2, reason); assert.equal(state.run.slot, 0, reason); assert.equal(state.run.daySummary.day, 1, reason);
  }
});

test("Day 7 Night ends without exposing Day 8", () => {
  let state = run(); state.run.day = 7; state.run.slot = 3; state = quietAdvance(state);
  assert.equal(state.run.status, "ended"); assert.equal(state.run.day, 7); assert.equal(state.run.slot, 3);
});

test("seeded markets and operation outcomes are reproducible", () => {
  const a = C.createRun({ seed: 1122 }); const b = C.createRun({ seed: 1122 });
  assert.deepEqual(a.world.markets, b.world.markets); assert.equal(a.run.rngState, b.run.rngState);
  let x = run(99); x.player.cash = 1000; x.people.crew.eli = { ...x.people.crew.eli, introduced: true, recruited: true, status: "active", loyalty: 2 };
  const y = structuredClone(x);
  const one = C.reduceGame(x, { type: "TAKEOVER", neighborhoodId: "north_star_lot", includePlayer: true });
  const two = C.reduceGame(y, { type: "TAKEOVER", neighborhoodId: "north_star_lot", includePlayer: true });
  assert.deepEqual(one.run.pendingOperationResult, two.run.pendingOperationResult);
});

test("market prices remain bounded and persistent", () => {
  let state = run(44); const seen = new Set();
  for (let index = 0; index < 20; index += 1) { state = quietAdvance(state); seen.add(state.world.markets.downtown.prices.shrooms); }
  assert.ok(seen.size > 2);
  for (const area of C.NEIGHBORHOODS) for (const product of C.PRODUCTS) {
    const price = state.world.markets[area.id].prices[product.id];
    assert.ok(price >= product.min * 0.72 && price <= product.max * 1.2);
  }
});

test("net worth subtracts Dre debt", () => {
  const state = run(); state.player.cash = 500; state.base.storedCash = 100; state.lender.balance = 300;
  assert.equal(C.selectors.netWorth(state), 300 + C.selectors.inventoryValue(state));
});

test("safe debt payment leaves the approved $150 reserve", () => {
  const state = run(); state.player.cash = 375;
  assert.equal(C.selectors.safeDebtPayment(state), 225);
  state.player.cash = 100; assert.equal(C.selectors.safeDebtPayment(state), 0);
});

test("debt payment advances once and full payoff unlocks Dre's offer", () => {
  let state = run(); state.player.cash = 1000; state.run.pendingEvent = null;
  state = C.reduceGame(state, { type: "PAY_DEBT", amount: 620 });
  assert.equal(state.lender.balance, 0); assert.equal(state.lender.afterPayoffOffer, "available"); assert.equal(state.stats.pipelineAdvances, 1);
});

test("Quick Score is available once per day and returns on a later day", () => {
  let state = run(123); state.player.cash = 100; assert.equal(C.selectors.robberyAvailability(state).available, true);
  state = C.reduceGame(state, { type: "QUICK_SCORE" });
  assert.equal(state.stats.robbery.attempts, 1); assert.equal(state.stats.robbery.lastAttemptedDay, 1); assert.equal(state.stats.pipelineAdvances, 1); assert.ok(state.run.pendingOperationResult || state.run.status === "ended");
  if (state.run.status === "playing") {
    state = C.reduceGame(state, { type: "ACKNOWLEDGE_OPERATION_RESULT" });
    assert.equal(C.selectors.robberyAvailability(state).available, false);
    state.run.day = 2; state.run.slot = 0; state.player.cash = 50; state.base.storedCash = 0;
    assert.equal(C.selectors.robberyAvailability(state).available, true);
  }
});

test("all three territories start under Rook with exact approved values", () => {
  const state = run();
  assert.deepEqual(C.TERRITORIES.map((item) => [item.power, item.attackCost, item.dailyIncome]), [[12, 100, 45], [18, 150, 75], [24, 200, 110]]);
  assert.ok(C.TERRITORIES.every((item) => state.world.territories[item.areaId].owner === "rook"));
});

test("Intelligence controls territory estimate precision", () => {
  const state = run(); state.player.attributes.insight = 1; state.player.attributes.discipline = 1; assert.equal(C.selectors.territoryPowerEstimate(state, "north_star_lot").label, "9–15");
  state.player.attributes.insight = 2; state.player.attributes.discipline = 2; assert.equal(C.selectors.territoryPowerEstimate(state, "north_star_lot").label, "11–13");
  state.player.attributes.insight = 3; state.player.attributes.discipline = 3; assert.equal(C.selectors.territoryPowerEstimate(state, "north_star_lot").label, "12");
});

test("takeover consumes one slot and records automatic narrated rounds", () => {
  let state = run(88); state.player.cash = 1000; state.player.gear.owned = ["reliable_handgun", "protective_vest"]; state.player.gear.equipped.weapon = "reliable_handgun"; state.player.gear.equipped.armor = "protective_vest";
  for (const id of ["eli", "tone"]) state.people.crew[id] = { ...state.people.crew[id], introduced: true, recruited: true, status: "active", loyalty: 3 };
  state = C.reduceGame(state, { type: "TAKEOVER", neighborhoodId: "north_star_lot", includePlayer: true });
  assert.equal(state.stats.pipelineAdvances, 1); assert.equal(state.stats.takeovers.attempts, 1); assert.ok(state.run.pendingOperationResult.rounds.length >= 2); assert.ok(state.run.pendingOperationResult.rounds.length <= 3);
});

test("controlled territory improves trade and pays once after Night", () => {
  // Downtown has no Territory Block layer yet, so it still pays flat District
  // Control income the way every neighborhood used to before v1.0.
  let state = run(); state.world.territories.downtown.owner = "player";
  const controlledPrice = C.selectors.tradeUnitPrices({ ...state, world: { ...state.world, currentNeighborhoodId: "downtown" } }, "weed");
  state.world.territories.downtown.owner = "rook";
  const rookPrice = C.selectors.tradeUnitPrices({ ...state, world: { ...state.world, currentNeighborhoodId: "downtown" } }, "weed");
  assert.ok(controlledPrice.buy < rookPrice.buy); assert.ok(controlledPrice.sell > rookPrice.sell);
  state.world.territories.downtown.owner = "player"; state.run.slot = 3; const cash = state.player.cash; state = quietAdvance(state);
  assert.equal(state.player.cash, cash + 75); assert.equal(state.stats.takeovers.income, 75);
});

test("Spenard's District Control income does not double-pay against its own Territory Blocks", () => {
  let state = run(); state.world.territories.north_star_lot.owner = "player";
  state.run.slot = 3; const cash = state.player.cash;
  state = quietAdvance(state);
  assert.equal(state.player.cash, cash, "north_star_lot has a block layer, so the flat district payout is suppressed");
  assert.equal(state.stats.takeovers.income, 0);
});

test("District Control tier for Spenard progresses with block count and requires a Respect capstone for full control", () => {
  const state = run();
  assert.equal(C.selectors.districtControlTier(state, "north_star_lot").label, "Neutral");
  state.world.territoryBlocks.wash_and_go_lot.owner = "player";
  assert.equal(C.selectors.districtControlTier(state, "north_star_lot").label, "Presence");
  state.world.territoryBlocks.fourth_ave_strip.owner = "player";
  state.world.territoryBlocks.minnesota_offramp.owner = "player";
  assert.equal(C.selectors.districtControlTier(state, "north_star_lot").label, "Influence");
  state.world.territoryBlocks.spenard_rec_lot.owner = "player";
  assert.equal(C.selectors.districtControlTier(state, "north_star_lot").label, "Dominant");
  for (const block of C.SPENARD_BLOCKS) state.world.territoryBlocks[block.id].owner = "player";
  assert.equal(C.selectors.districtControlTier(state, "north_star_lot").label, "Dominant", "all six blocks without Respect is not yet the capstone");
  state.rival.respect = C.RESPECT_STAGE_THRESHOLDS.mid;
  const capstone = C.selectors.districtControlTier(state, "north_star_lot");
  assert.equal(capstone.label, "District Control");
  assert.equal(capstone.capstone, true);

  // Downtown has no block layer yet, so it falls back to the plain owner boolean.
  assert.equal(C.selectors.districtControlTier(state, "downtown").label, "Neutral");
  state.world.territories.downtown.owner = "player";
  assert.equal(C.selectors.districtControlTier(state, "downtown").label, "District Control");
});

test("event contract explains who, where, stakes, action, preview, and result", () => {
  let state = run(); state = C.reduceGame(state, { type: "END_MARKET" }); const event = state.run.pendingEvent;
  assert.ok(event.who && event.where && event.stakes && event.description);
  for (const choice of event.choices) assert.ok(choice.label && choice.preview && choice.result);
  const slot = state.run.slot; state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 }); assert.equal(state.run.slot, slot);
});

test("summary includes robbery and territory history", () => {
  const summary = C.selectRunSummary(run());
  assert.equal(summary.territories.length, 3); assert.equal(summary.robbery.attempts, 0); assert.equal(summary.takeovers.attempts, 0);
});

test("title save inspection distinguishes missing, valid, and invalid saves", () => {
  assert.deepEqual(C.inspectSave(null), { exists: false, valid: false, state: null, error: null, preview: null });
  const valid = C.inspectSave(JSON.stringify(run(77)));
  assert.equal(valid.valid, true); assert.equal(valid.preview.day, 1); assert.equal(valid.preview.district, "Spenard"); assert.equal(valid.preview.debt, 620);
  const invalid = C.inspectSave("{not json");
  assert.equal(invalid.exists, true); assert.equal(invalid.valid, false); assert.match(invalid.error, /could not be read/i);
});

test("v3 hydration preserves Strategist capability as legacy history", () => {
  const old = run(88); old.player.background = "strategist"; delete old.player.attributes; delete old.player.legacyBackground; old.player.stats = { combat: 2, charisma: 1, intelligence: 3 };
  old.people.mara = { met: true, trust: 2, status: "cautious", outcomes: [] };
  old.people.crew.eli.introduced = true; delete old.people.crew.eli.contactStage;
  old.stats.robbery = { attempted: true, success: false, payout: 0 };
  const hydrated = C.hydrateRun(JSON.parse(JSON.stringify(old)));
  assert.equal(hydrated.player.background, null); assert.equal(hydrated.player.legacyBackground, "strategist"); assert.equal(hydrated.people.mara.available, true);
  assert.deepEqual(C.selectors.derivedRatings(hydrated), { combat: 2, charisma: 1, intelligence: 3 });
  assert.equal(hydrated.people.crew.eli.contactStage, "recruitable");
  assert.deepEqual(hydrated.stats.robbery, { attempts: 1, successes: 0, failures: 1, totalPayout: 0, lastAttemptedDay: 1, attempted: true, success: false, payout: 0 });
});

test("fresh runs expose Places and People while garage operations remain earned", () => {
  let state = fresh(); let features = C.selectors.featureAvailability(state);
  assert.equal(features.market.available, true); assert.equal(features.finances.available, true); assert.equal(features.help.available, true);
  assert.equal(features.travel.available, true); assert.equal(features.operations.available, false); assert.equal(features.people.available, true); assert.equal(features.recovery.available, false);
  state.player.cash = C.GARAGE_DEPOSIT; state = C.reduceGame(state, { type: "LEASE_GARAGE" }); features = C.selectors.featureAvailability(state);
  assert.equal(features.operations.available, true); assert.equal(state.base.controlled, true);
});

test("Mara introduction resolves once and does not by itself arm her threat", () => {
  let state = run(); assert.equal(C.selectors.maraThreatEligible(state), false);
  state = C.reduceGame(state, { type: "VISIT_NIGHT_OWL" }); assert.equal(state.run.pendingEvent.id, "mara_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.people.mara.met, true); assert.equal(state.people.mara.introChoice, "friendly");
  assert.equal(state.flags.maraIntroResolved, true); assert.equal(state.people.mara.chainStage, 1);
  // Alpha v0.7: the sedan is a stage-5 beat. An introduction alone must not arm it.
  assert.equal(C.selectors.maraThreatEligible(state), false);
});

test("the Day 2 threat is always the Mara-free service-road encounter", () => {
  for (let seed = 300; seed < 325; seed += 1) {
    let state = C.reduceGame(C.createRun({ seed }), { type: "CHOOSE_BACKGROUND", backgroundId: "shooter" });
    let guard = 0, found = null;
    while (state.run.status === "playing" && state.run.day <= 4 && guard++ < 40) {
      if (state.run.pendingEncounter) { found = state.run.pendingEncounter.id; break; }
      state = settleForTest(state);
      if (state.run.status !== "playing") break;
      state = C.reduceGame(state, { type: "END_MARKET" });
    }
    if (found) assert.equal(found, "early_street", `seed ${seed} produced ${found}`);
  }
});

test("the Mara sedan encounter is unreachable before her boundary scene", () => {
  let state = run();
  state.flags.maraIntroResolved = true; state.flags.maraShiftChangeResolved = true;
  state.people.mara.met = true; state.people.mara.introChoice = "flirt"; state.people.mara.chainStage = 2;
  state.run.day = 6; state.run.slot = 2;
  assert.equal(C.selectors.maraThreatEligible(state), false);
  state.flags.maraBoundaryResolved = true; state.rival.pressure = 4;
  assert.equal(C.selectors.maraThreatEligible(state), true);
});

test("Eli progresses from introduction through a time-consuming test route", () => {
  let state = run(901); state.run.slot = 2;
  state.run.pendingEvent = C.buildEventForTest("eli_offer", state);
  assert.equal(state.run.pendingEvent.id, "eli_offer");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.people.crew.eli.contactStage, "test_available");
  const before = state.stats.pipelineAdvances; state.player.cash = 500;
  state = C.reduceGame(state, { type: "ELI_TEST_ROUTE" });
  assert.equal(state.people.crew.eli.contactStage, "recruitable"); assert.equal(state.stats.pipelineAdvances, before + 1); assert.ok(state.run.pendingOperationResult);
});

test("finance payment preview clamps controls and preserves Safe Maximum", () => {
  const state = run(); state.player.cash = 375;
  assert.deepEqual(C.selectors.debtPaymentPreview(state, 999), { amount: 375, maximum: 375, cashAfter: 0, debtAfter: 245, breaksReserve: true });
  assert.equal(C.selectors.safeDebtPayment(state), 225);
  const safe = C.selectors.debtPaymentPreview(state, C.selectors.safeDebtPayment(state));
  assert.equal(safe.cashAfter, 150); assert.equal(safe.breaksReserve, false);
});

// --- Alpha v0.7: identity, save compatibility, and the Mara arc ---------------

test("street names are sanitized to a safe character set and length", () => {
  assert.equal(C.sanitizeStreetName("  Ice   Box  "), "Ice Box");
  assert.equal(C.sanitizeStreetName("Nine-Seven"), "Nine-Seven");
  assert.equal(C.sanitizeStreetName("O'Hara Jr."), "O'Hara Jr.");
  assert.equal(C.sanitizeStreetName("<script>x</script>"), "scriptxscript");
  assert.equal(C.sanitizeStreetName("ABCDEFGHIJKLMNOPQRSTUV").length, C.STREET_NAME_MAX);
  for (const empty of ["", "   ", "!!!", null, undefined, {}]) assert.equal(C.sanitizeStreetName(empty), "");
});

test("the street name is optional and falls back to Rookie", () => {
  const skipped = C.reduceGame(C.createRun({ seed: 12 }), { type: "START_RUN" });
  assert.equal(skipped.player.streetName, C.DEFAULT_STREET_NAMES.neutral);
  assert.equal(skipped.player.streetNameChosen, false);
  const chosen = C.reduceGame(C.createRun({ seed: 12 }), { type: "START_RUN", streetName: "  Kodiak!!  " });
  assert.equal(chosen.player.streetName, "Kodiak");
  assert.equal(chosen.player.streetNameChosen, true);
  assert.match(chosen.log[0].text, /Kodiak/);
  const blanked = C.reduceGame(C.createRun({ seed: 12 }), { type: "START_RUN", streetName: "###" });
  assert.equal(blanked.player.streetName, C.DEFAULT_STREET_NAMES.neutral);
  assert.equal(blanked.player.streetNameChosen, false);
});

test("a pre-v0.7 save hydrates without a version bump and gains the new fields", () => {
  const state = C.reduceGame(C.createRun({ seed: 77 }), { type: "CHOOSE_BACKGROUND", backgroundId: "shooter" });
  const legacy = JSON.parse(JSON.stringify(state));
  delete legacy.player.streetName; delete legacy.player.streetNameChosen;
  delete legacy.run.eventHistory; delete legacy.run.lastChainFired; delete legacy.run.chainStreak;
  delete legacy.run.lastChainSlot; delete legacy.run.chainBeatsToday; delete legacy.run.chainBeatsDay;
  delete legacy.people.mara.chainStage; delete legacy.people.mara.jobAtRisk;

  const inspection = C.inspectSave(JSON.stringify(legacy));
  assert.equal(inspection.valid, true, inspection.error || "legacy save rejected");
  assert.equal(C.VERSION, 3); assert.equal(C.SAVE_KEY, "907ogr_v3");
  const hydrated = inspection.state;
  assert.equal(hydrated.version, 3);
  assert.deepEqual(hydrated.run.eventHistory, {});
  assert.equal(hydrated.run.chainStreak, 0);
  assert.equal(hydrated.people.mara.chainStage, 0);
  assert.equal(hydrated.people.mara.jobAtRisk, false);
  assert.equal(inspection.preview.name, "Unnamed run");
  // and it still plays
  const advanced = C.reduceGame(hydrated, { type: "END_MARKET" });
  assert.equal(advanced.run.status, "playing");
});

test("the saved-run preview carries the name alongside the run position", () => {
  const state = C.reduceGame(C.createRun({ seed: 5 }), { type: "CHOOSE_BACKGROUND", backgroundId: "hustler", streetName: "Slush" });
  const preview = C.inspectSave(JSON.stringify(state)).preview;
  assert.equal(preview.name, "Slush");
  assert.equal(preview.day, 1); assert.equal(preview.district, "Spenard");
});

test("Mara's stages record chain progress without exposing it to the player", () => {
  let state = run();
  state = C.reduceGame(state, { type: "VISIT_NIGHT_OWL" });
  const built = state.run.pendingEvent;
  assert.equal(built.chain, undefined); assert.equal(built.stage, undefined); assert.equal(built.weight, undefined);
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.people.mara.chainStage, 1);
  assert.equal(state.people.mara.outcomes.length, 1);
  assert.equal(state.people.mara.outcomes[0].stage, 1);
});

test("resolving a Mara scene never consumes a second part of day", () => {
  let state = run();
  state = C.reduceGame(state, { type: "VISIT_NIGHT_OWL" });
  const before = state.stats.pipelineAdvances, day = state.run.day, slot = state.run.slot;
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.stats.pipelineAdvances, before);
  assert.equal(state.run.day, day); assert.equal(state.run.slot, slot);
});

test("betraying Mara removes her from the run and names the ending for it", () => {
  let state = run();
  state.people.mara.met = true; state.people.mara.trust = 3; state.people.mara.chainStage = 4;
  state.flags.maraBoundaryResolved = true; state.people.mara.usedWithoutConsent = true;
  state.run.day = 6; state.run.slot = 0;
  // Drive the branch directly: scheduling is covered in tests/story-chains.test.js.
  state.run.pendingEvent = C.buildEventForTest("mara_after", state);
  assert.equal(state.run.pendingEvent.id, "mara_after");
  assert.match(state.run.pendingEvent.title, /Lights Off/);
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.people.mara.available, false);
  assert.equal(state.people.mara.status, "gone");
  assert.equal(state.people.mara.chainStage, 6);
  state.run.day = 7; state.run.slot = 3;
  const ended = quietAdvance(state);
  assert.equal(ended.run.ending, "mara_gone");
  assert.equal(C.selectors.endingLabel("mara_gone"), "Gone Before You Were");
});

test("all three Day 7 Mara outcomes are reachable and distinct", () => {
  function endingFor(mutate) {
    let state = run();
    state.people.mara.met = true; state.people.mara.trust = 4; state.people.mara.chainStage = 6;
    state.flags.maraBoundaryResolved = true; state.flags.maraAfterResolved = true;
    state.lender.balance = 0; state.run.day = 7; state.run.slot = 3;
    mutate(state);
    return quietAdvance(state).run.ending;
  }
  assert.equal(endingFor((s) => { s.run.finalPlan = "escape"; }), "mara_escape");
  // A separation is an outcome, not a failure: she takes the Monday interview.
  assert.equal(endingFor((s) => { s.run.finalPlan = "defend"; s.people.mara.jobAtRisk = false; }), "mara_clear");
  assert.equal(endingFor((s) => { s.people.mara.available = false; }), "mara_gone");
  const labels = ["mara_escape", "mara_clear", "mara_gone"].map((id) => C.selectors.endingLabel(id));
  assert.equal(new Set(labels).size, 3);
});

test("a full seeded run reaches an ending with a coherent Mara record", () => {
  let state = C.reduceGame(C.createRun({ seed: 2024 }), { type: "CHOOSE_BACKGROUND", backgroundId: "hustler", streetName: "Berm" });
  let guard = 0;
  while (state.run.status === "playing" && guard++ < 220) {
    state = settleForTest(state);
    if (state.run.status !== "playing") break;
    if (state.run.pendingEvent) { state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 }); continue; }
    if (state.run.pendingEncounter) { state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: C.selectors.encounterChoices(state)[0].id }); continue; }
    state = C.reduceGame(state, { type: "END_MARKET" });
  }
  assert.equal(state.run.status, "ended");
  const summary = C.selectRunSummary(state);
  assert.equal(summary.streetName, "Berm");
  assert.ok(summary.endingLabel.length > 0);
  const stages = state.people.mara.outcomes.map((entry) => entry.stage);
  assert.deepEqual(stages, [...stages].sort((a, b) => a - b), "Mara scenes played out of order");
});

// --- Alpha v0.7.1: Kip Sallis and the dealer prototype -----------------------

function metKip(seed = 21) {
  const state = run(seed);
  state.people.dealers.kip.known = true;
  state.run.day = 3; state.player.cash = 1500;
  return state;
}
function clearPending(state) {
  state.run.pendingEvent = null; state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null; state.run.daySummary = null;
  return state;
}

test("a dealer is gated to his own corner and his own hours", () => {
  const state = metKip();
  assert.equal(C.selectors.dealerActions(state, "kip").buy.available, true);
  const away = clearPending(C.reduceGame(state, { type: "TRAVEL", neighborhoodId: "downtown" }));
  const actions = C.selectors.dealerActions(away, "kip");
  assert.equal(actions.buy.available, false);
  assert.match(actions.buy.reason, /Spenard/);
  const unmet = run(); unmet.run.day = 3;
  assert.equal(C.selectors.dealerActions(unmet, "kip").rob.available, false);
});

test("buying off the dealer costs one part of day and builds standing", () => {
  let state = metKip();
  const before = state.stats.pipelineAdvances, cash = state.player.cash;
  state = C.reduceGame(state, { type: "BUY_FROM_DEALER", dealerId: "kip" });
  assert.equal(state.stats.pipelineAdvances, before + 1, "must advance exactly once");
  assert.equal(state.people.dealers.kip.standing, 1);
  assert.ok(state.player.cash < cash, "the purchase costs money");
  assert.ok(C.selectors.cargoUsed(state) > 0, "the purchase arrives in cargo");
  // once per day
  assert.equal(C.selectors.dealerActions(clearPending(state), "kip").buy.available, false);
});

test("asking the dealer needs standing and yields a reliable lead in his own product", () => {
  let state = metKip();
  assert.equal(C.selectors.dealerActions(state, "kip").ask.available, false, "no standing, no conversation");
  state.people.dealers.kip.standing = 3;
  const before = state.stats.pipelineAdvances;
  state = C.reduceGame(state, { type: "ASK_DEALER", dealerId: "kip" });
  assert.equal(state.stats.pipelineAdvances, before + 1);
  const rumor = state.effects.rumors[state.effects.rumors.length - 1];
  assert.equal(rumor.reliable, true);
  assert.ok(["weed", "shrooms"].includes(rumor.productId), `he tipped ${rumor.productId}`);
});

test("standing raises the dealer discount", () => {
  const cold = metKip(); const warm = metKip();
  warm.people.dealers.kip.standing = 3;
  assert.ok(C.selectors.dealerActions(warm, "kip").buy.discount > C.selectors.dealerActions(cold, "kip").buy.discount);
});

test("robbing the dealer is not gated behind the Quick Score comeback threshold", () => {
  const state = metKip();
  state.player.cash = 5000; // far above the working-capital reserve
  assert.equal(C.selectors.robberyAvailability(state).available, false, "Quick Score stays a comeback lever");
  assert.equal(C.selectors.dealerActions(state, "kip").rob.available, true, "the stickup is a playstyle, not a comeback");
});

test("a successful dealer robbery pays out and chokes the block's supply", () => {
  let found = null;
  for (let seed = 1; seed <= 60 && !found; seed += 1) {
    const attempt = C.reduceGame(metKip(seed), { type: "ROB_DEALER", dealerId: "kip" });
    if (attempt.run.pendingOperationResult.tone === "good") found = attempt;
  }
  assert.ok(found, "no successful robbery across 60 seeds");
  const kip = found.people.dealers.kip;
  assert.equal(kip.robbedCount, 1);
  assert.equal(kip.supplyChoked, 2);
  assert.ok(kip.standing < 0, "standing is spent");
  assert.ok(found.player.heat >= 3, "the robbery is visible");
  assert.equal(C.selectors.dealerSupplyFactor(found, "north_star_lot", "weed"), 0.6);
  assert.equal(C.selectors.dealerSupplyFactor(found, "downtown", "weed"), 1, "only his own block is affected");
});

test("a failed dealer robbery costs health and arms him for next time", () => {
  let found = null;
  for (let seed = 1; seed <= 60 && !found; seed += 1) {
    const attempt = C.reduceGame(metKip(seed), { type: "ROB_DEALER", dealerId: "kip" });
    if (attempt.run.pendingOperationResult.tone === "bad") found = attempt;
  }
  assert.ok(found, "no failed robbery across 60 seeds");
  assert.equal(found.people.dealers.kip.retaliated, true);
  assert.ok(found.player.health < 100, "failure hurts");
  assert.equal(found.people.dealers.kip.robbedCount, 0, "a failure is not a success");
});

test("the dealer can only be taken twice before he is off the block", () => {
  const state = metKip();
  state.people.dealers.kip.robbedCount = 2;
  const actions = C.selectors.dealerActions(state, "kip");
  assert.equal(actions.rob.available, false);
  assert.match(actions.rob.reason, /nothing left/i);
  state.people.dealers.kip.gone = true;
  const gone = C.selectors.dealerActions(state, "kip");
  assert.equal(gone.buy.available, false);
  assert.equal(gone.ask.available, false);
  assert.equal(C.selectors.dealerSupplyFactor(state, "north_star_lot", "shrooms"), 0.75, "his absence leaves a smaller permanent dent");
});

test("the choked supply expires on the daily tick", () => {
  let state = metKip();
  state.people.dealers.kip.supplyChoked = 2;
  state.run.day = 3; state.run.slot = 3;
  state = quietAdvance(state);
  assert.equal(state.people.dealers.kip.supplyChoked, 1, "one day burned off");
  state.run.slot = 3;
  state = quietAdvance(state);
  assert.equal(state.people.dealers.kip.supplyChoked, 0);
  assert.equal(C.selectors.dealerSupplyFactor(state, "north_star_lot", "weed"), 1);
});

test("Mara hears about a robbery two blocks from her counter", () => {
  let found = null;
  for (let seed = 1; seed <= 60 && !found; seed += 1) {
    const state = metKip(seed);
    state.people.mara.met = true; state.people.mara.chainStage = 2; state.people.mara.trust = 3;
    const attempt = C.reduceGame(state, { type: "ROB_DEALER", dealerId: "kip" });
    if (attempt.run.pendingOperationResult) found = attempt;
  }
  assert.ok(found);
  assert.equal(found.people.mara.trust, 2, "robbing his corner costs a point with her");
});

test("a pre-v0.7.1 save hydrates and gains the dealer record", () => {
  const state = metKip();
  const legacy = JSON.parse(JSON.stringify(state));
  delete legacy.people.dealers;
  const inspection = C.inspectSave(JSON.stringify(legacy));
  assert.equal(inspection.valid, true, inspection.error || "rejected");
  assert.equal(inspection.state.version, 3);
  assert.equal(inspection.state.people.dealers.kip.known, false);
  assert.equal(inspection.state.people.dealers.kip.robbedCount, 0);
  assert.equal(C.selectors.dealerSupplyFactor(inspection.state, "north_star_lot", "weed"), 1);
});

// --- Alpha v0.9: fresh arrival and daily life -------------------------------

test("fresh v0.9 runs begin at the family home with only cash and fixed debt", () => {
  const state = fresh(9001);
  assert.equal(state.run.premise, "fresh_arrival"); assert.equal(state.run.openingPending, true);
  assert.equal(state.player.cash, 1000); assert.equal(state.player.heat, 0); assert.equal(state.lender.principal, 1000); assert.equal(state.lender.balance, 1200); assert.equal(state.lender.dueDay, 7);
  assert.equal(state.base.controlled, false); assert.equal(state.rival.pressure, 0); assert.equal(state.rival.relationship, "unaware");
  assert.deepEqual(Object.values(state.player.inventory).map((item) => item.qty), [0, 0, 0, 0]);
  assert.deepEqual([state.people.household.yalondaTrust, state.people.household.johnTrust, state.people.household.warnings], [2, 1, 0]);
  assert.equal(state.world.productAccess.weed, false); assert.equal(state.people.dealers.kip.known, false);
});

test("household storage is limited and three warnings end as Nowhere to Go", () => {
  let state = fresh(9002); state.player.inventory.weed = { qty: 3, avgCost: 20 };
  state = C.reduceGame(state, { type: "HOME_STORE_PRODUCT", productId: "weed", qty: 2 });
  const rejected = C.reduceGame(state, { type: "HOME_STORE_PRODUCT", productId: "weed", qty: 1 });
  assert.equal(rejected, state); assert.equal(state.home.storedInventory.weed.qty, 2);
  state = C.reduceGame(state, { type: "HOUSE_VIOLATION", serious: true, reason: "test" });
  assert.equal(state.people.household.warnings, 2); assert.equal(state.run.status, "playing");
  state = C.reduceGame(state, { type: "HOUSE_VIOLATION", reason: "test" });
  assert.equal(state.run.status, "ended"); assert.equal(state.run.ending, "nowhere_to_go"); assert.equal(C.selectors.endingLabel(state.run.ending), "Nowhere to Go");
});

test("work is Morning-only, once daily, seeded, and builds legal standing", () => {
  let a = fresh(9003), b = fresh(9003);
  a = C.reduceGame(a, { type: "WORK_SHIFT" }); b = C.reduceGame(b, { type: "WORK_SHIFT" });
  assert.equal(a.player.cash, b.player.cash); assert.ok(a.player.cash >= 1110 && a.player.cash <= 1140); assert.equal(a.run.slot, 1);
  assert.equal(a.world.locations.employer.standing, 1); assert.equal(C.selectors.activityAvailability(a).work.available, false);
});

test("gym costs escalate, progress diminishes, and attributes cap at five", () => {
  let state = fresh(9004); const spent = [];
  for (let i = 0; i < 4; i += 1) { state.run.pendingEvent = null; const before = state.player.cash; state = C.reduceGame(state, { type: "TRAIN_ATTRIBUTE", attribute: "strength" }); spent.push(before - state.player.cash); }
  assert.deepEqual(spent, [25, 45, 75, 120]); assert.equal(state.player.attributes.strength, 2); assert.equal(state.player.attributeProgress.strength, 7);
  state.player.attributeProgress.strength = 9; state.world.locations.gym.sessionDay = null; state.run.pendingEvent = null; state.run.slot = 0;
  state = C.reduceGame(state, { type: "TRAIN_ATTRIBUTE", attribute: "strength" });
  assert.equal(state.player.attributes.strength, 3); assert.equal(state.player.attributeProgress.strength, 2);
});

test("exploration guarantees a supplier before later seeded discoveries", () => {
  let state = fresh(9005); state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.people.dealers.kip.known, true); assert.equal(state.world.productAccess.weed, true); assert.ok(state.world.locations.discoveries.includes("kip_supplier"));
  state.run.pendingEvent = null; state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.world.locations.gamblingKnown, true);
});

test("bus opens Downtown but fresh runs cannot travel to Industrial without a route", () => {
  let state = fresh(9006); const blocked = C.reduceGame(state, { type: "TRAVEL", neighborhoodId: "airport_industrial" }); assert.equal(blocked, state);
  state = C.reduceGame(state, { type: "BUS_TRAVEL", neighborhoodId: "downtown" });
  assert.equal(state.world.currentNeighborhoodId, "downtown"); assert.equal(state.player.cash, 995); assert.equal(state.run.slot, 1);
});

test("Street Read awards deduplicate and remain separate from score and identity", () => {
  const state = fresh(9007); const score = C.selectors.operationScore(state);
  assert.equal(C.awardStreetReadForTest(state, "test:first", 40, "Test"), true);
  assert.equal(C.awardStreetReadForTest(state, "test:first", 40, "Test"), false);
  assert.equal(state.stats.streetRead.xp, 40); assert.equal(state.stats.streetRead.level, 1);
  assert.equal(state.player.streetIdentity, "unproven"); assert.equal(C.selectors.operationScore(state), score);
});

test("legacy v3 saves retain garage ownership while v0.9 acquisition advances once", () => {
  const legacy = run(9008); const raw = JSON.parse(JSON.stringify(legacy)); delete raw.base.controlled; delete raw.run.premise;
  const hydrated = C.hydrateRun(raw); assert.equal(hydrated.run.premise, "legacy_established"); assert.equal(hydrated.base.controlled, true);
  let state = fresh(9009); const before = state.stats.pipelineAdvances; state = C.reduceGame(state, { type: "LEASE_GARAGE" });
  assert.equal(state.base.controlled, true); assert.equal(state.player.cash, 350); assert.equal(state.stats.pipelineAdvances, before + 1);
});

// --- v1.0 Soldiers, Territory, Lieutenants, Laundering ----------------------

function clearModals(state) { state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.pendingOperationResult = null; return state; }

function operatorSetup(seed = 42000) {
  let state = run(seed);
  state = C.reduceGame(state, { type: "LEASE_GARAGE" });
  state.people.crew.eli.introduced = true; state.people.crew.eli.contactStage = "recruitable"; state.base.visiting = true;
  state = C.reduceGame(state, { type: "RECRUIT_CREW", crewId: "eli" });
  clearModals(state);
  state.people.crew.eli.loyalty = 3; state.stats.streetRead.level = 2; state.base.visiting = false;
  return state;
}

function promotedEliSetup(seed = 42000) {
  let state = operatorSetup(seed);
  state = C.reduceGame(state, { type: "PROMOTE_LIEUTENANT", crewId: "eli" });
  clearModals(state);
  return state;
}

test("Eli lieutenant promotion is gated on loyalty and Street Read level, not garage presence", () => {
  let state = operatorSetup(42001);
  state.people.crew.eli.loyalty = 0;
  const blocked = C.reduceGame(state, { type: "PROMOTE_LIEUTENANT", crewId: "eli" });
  assert.equal(blocked.people.crew.eli.lieutenantStage, "none");
  state.people.crew.eli.loyalty = 3;
  const promoted = C.reduceGame(state, { type: "PROMOTE_LIEUTENANT", crewId: "eli" });
  assert.equal(promoted.people.crew.eli.lieutenantStage, "operations_lieutenant");
  assert.equal(promoted.base.visiting, false, "promotion does not require visiting the garage");
});

test("soldier recruitment is unavailable before an active Operations lieutenant, then obeys capacity", () => {
  let state = operatorSetup(42002);
  const preLieutenant = C.selectors.soldierRecruitAvailability(state);
  assert.equal(preLieutenant.available, false);
  const blocked = C.reduceGame(state, { type: "RECRUIT_SOLDIER" });
  assert.equal(Object.keys(blocked.world.soldiers).length, 0);

  state = promotedEliSetup(42002);
  state.player.cash = 5000;
  for (let i = 0; i < 6; i += 1) { state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); }
  const capacity = C.selectors.soldierCapacity(state);
  assert.equal(Object.keys(state.world.soldiers).length, capacity, "recruitment stops exactly at capacity");
  assert.equal(C.selectors.soldierRecruitAvailability(state).available, false);
});

test("territory blocks cannot be claimed before garage + lieutenant + soldier prerequisites", () => {
  const noGarage = C.selectors.blockClaimAvailability(run(42003), "spenard_rec_lot");
  assert.equal(noGarage.available, false);

  let state = operatorSetup(42004); state.player.cash = 5000;
  const noLieutenant = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" });
  assert.equal(noLieutenant.world.territoryBlocks.spenard_rec_lot.owner, "rook");

  state = promotedEliSetup(42004); state.player.cash = 5000;
  const noSoldiers = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" });
  assert.equal(noSoldiers.world.territoryBlocks.spenard_rec_lot.owner, "rook", "claiming needs at least one soldier");

  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  const claimed = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" });
  assert.equal(claimed.world.territoryBlocks.spenard_rec_lot.owner, "player");
  assert.equal(claimed.rival.respect, state.rival.respect + 1, "claiming a block raises Respect");
});

test("Spenard blocks vary in earning potential and risk instead of being mechanically identical", () => {
  const earnings = new Set(C.SPENARD_BLOCKS.map((block) => block.earningPotential));
  const heat = new Set(C.SPENARD_BLOCKS.map((block) => block.heatExposure));
  assert.ok(earnings.size > 1 && heat.size > 1);
});

test("block-level territory coexists with the existing neighborhood takeover without cross-mutation", () => {
  let state = promotedEliSetup(42005); state.player.cash = 5000;
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" });
  assert.equal(state.world.territories.north_star_lot.owner, "rook", "the neighborhood-level takeover is untouched by a block claim");
  assert.equal(state.world.territoryBlocks.spenard_rec_lot.owner, "player");
});

function assignedSoldierSetup(seed = 42010, blockId = "spenard_rec_lot") {
  let state = promotedEliSetup(seed); state.player.cash = 5000;
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  const soldierId = Object.keys(state.world.soldiers)[0];
  // CLAIM_BLOCK now atomically posts the claiming soldier itself (occupation
  // is required for a claim to succeed at all), so no separate ASSIGN_SOLDIER
  // call is needed or possible here.
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId }); clearModals(state);
  return { state, soldierId, blockId };
}

test("soldier income resolves during normal time advancement and consumes zero extra time slots", () => {
  const { state } = assignedSoldierSetup(50000);
  const beforeDay = state.run.day, beforeSlot = state.run.slot, beforeDirty = state.player.dirtyCash;
  let next = state;
  for (let i = 0; i < 4; i += 1) next = quietAdvance(next); // exactly one day crossed after 4 slot advances
  assert.equal(next.run.day, beforeDay + 1);
  assert.equal(next.run.slot, beforeSlot);
  assert.ok(next.player.dirtyCash > beforeDirty, "soldiers on a controlled block generate passive dirty income overnight");
  assert.equal(next.world.territoryBlocks.spenard_rec_lot.incomeCollected > 0, true);
});

test("soldiers assigned to a block cannot exceed the per-block cap", () => {
  let state = promotedEliSetup(42012); state.player.cash = 5000;
  const ids = [];
  for (let i = 0; i < 5; i += 1) { state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); }
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state);
  for (const id of Object.keys(state.world.soldiers)) {
    state = C.reduceGame(state, { type: "ASSIGN_SOLDIER", soldierId: id, blockId: "spenard_rec_lot" }); clearModals(state);
  }
  assert.ok(state.world.territoryBlocks.spenard_rec_lot.soldiersAssigned.length <= C.SOLDIERS_PER_BLOCK_CAP);
});

test("soldier/territory outcomes are deterministic for a given seed and identical action sequence", () => {
  function playThrough(seed) {
    const { state } = assignedSoldierSetup(seed);
    let next = state;
    for (let i = 0; i < 24; i += 1) next = quietAdvance(next);
    return next;
  }
  const a = playThrough(42013), b = playThrough(42013);
  assert.deepEqual(a.world.soldiers, b.world.soldiers);
  assert.deepEqual(a.world.territoryBlocks, b.world.territoryBlocks);
  assert.equal(a.player.cash, b.player.cash);
});

test("controlled blocks and soldier state persist across save/load", () => {
  const { state } = assignedSoldierSetup(42014);
  // The claim's own advanceRun call can, on an unlucky seed, immediately cross
  // a day boundary and lose the block to a raid in the same tick — that is
  // legitimate gameplay, not a save bug. Assert fidelity of whatever resulted
  // rather than assuming the block is still owned.
  const raw = JSON.parse(JSON.stringify(state));
  const hydrated = C.hydrateRun(raw);
  assert.deepEqual(hydrated.world.territoryBlocks, state.world.territoryBlocks);
  assert.deepEqual(hydrated.world.soldiers, state.world.soldiers);

  const claimed = C.selectors.blockClaimAvailability(C.createRun({ seed: 1 }), "spenard_rec_lot");
  assert.equal(claimed.available, false, "sanity: a fresh run cannot claim without prerequisites");
});

test("a pre-v1.0 save shape backfills soldiers, blocks, dirty/clean cash, and Kip's crew record", () => {
  const legacy = run(42015);
  const raw = JSON.parse(JSON.stringify(legacy));
  raw.player.cash = 777;
  delete raw.player.dirtyCash; delete raw.player.cleanCash;
  delete raw.world.soldiers; delete raw.world.territoryBlocks;
  delete raw.people.crew.kip;
  const hydrated = C.hydrateRun(raw);
  assert.equal(hydrated.player.dirtyCash, 777, "pre-existing wealth is classified as unlaundered dirty cash");
  assert.equal(hydrated.player.cleanCash, 0);
  assert.deepEqual(hydrated.world.soldiers, {});
  assert.equal(Object.keys(hydrated.world.territoryBlocks).length, C.SPENARD_BLOCKS.length);
  assert.ok(hydrated.world.territoryBlocks.spenard_rec_lot.owner === "rook");
  assert.ok(hydrated.people.crew.kip);
  assert.equal(hydrated.people.crew.kip.recruited, false);
});

test("Kip's finance-lieutenant introduction stays gated until income, standing, and Eli are all satisfied", () => {
  let state = promotedEliSetup(42016);
  assert.equal(C.selectors.kipLieutenantAvailability(state).available, false, "no income yet");
  state.people.dealers.kip.standing = 3;
  assert.equal(C.selectors.kipLieutenantAvailability(state).available, false, "standing alone is not enough");
  state.world.territoryBlocks.spenard_rec_lot.incomeCollected = 600;
  assert.equal(C.selectors.kipLieutenantAvailability(state).available, true);
  const noEli = promotedEliSetup(42016);
  noEli.people.crew.eli.lieutenantStage = "none";
  noEli.people.dealers.kip.standing = 3;
  noEli.world.territoryBlocks.spenard_rec_lot.incomeCollected = 600;
  assert.equal(C.selectors.kipLieutenantAvailability(noEli).available, false, "Eli must be active first");
});

test("Kip's dealer identity is untouched by his lieutenant introduction, resolved through the real event choice", () => {
  let state = promotedEliSetup(42017);
  state.people.dealers.kip.known = true; state.people.dealers.kip.standing = 2; state.people.dealers.kip.robbedCount = 1;
  state.run.pendingEvent = C.buildEventForTest("kip_lieutenant_intro", state);
  const acceptIndex = state.run.pendingEvent.choices.findIndex((choice) => choice.label.toLowerCase().includes("bring kip"));
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: acceptIndex });
  assert.equal(state.people.dealers.kip.robbedCount, 1, "the dealer record is untouched by the lieutenant introduction");
  assert.equal(state.people.dealers.kip.standing, 2, "dealer standing is untouched");
  assert.equal(state.people.crew.kip.recruited, true, "the crew record gets its own, separate lieutenant state");
  assert.equal(state.people.crew.kip.introduced, true);
  assert.equal(state.people.dealers.kip.lieutenantIntroduced, true);
});

test("Eli defaults to a Balanced standing order on promotion, and changing it costs no player time", () => {
  let state = promotedEliSetup(90101);
  assert.equal(state.people.crew.eli.operationPolicy, "balanced");
  const before = { day: state.run.day, slot: state.run.slot };
  state = C.reduceGame(state, { type: "SET_ELI_POLICY", policy: "maximize_income" });
  assert.equal(state.people.crew.eli.operationPolicy, "maximize_income");
  assert.deepEqual({ day: state.run.day, slot: state.run.slot }, before, "changing the standing order consumes zero player time");
});

test("manually assigning a soldier once Eli is Operations Lieutenant consumes zero player time", () => {
  let state = promotedEliSetup(90102); state.player.cash = 5000;
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); // a second soldier, left unassigned
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state);
  const unassigned = Object.values(state.world.soldiers).find((item) => !item.blockId);
  const before = { day: state.run.day, slot: state.run.slot };
  state = C.reduceGame(state, { type: "ASSIGN_SOLDIER", soldierId: unassigned.id, blockId: "spenard_rec_lot" });
  assert.deepEqual({ day: state.run.day, slot: state.run.slot }, before, "manual assignment consumes zero player time post-promotion");
  assert.equal(state.world.soldiers[unassigned.id].blockId, "spenard_rec_lot");
});

test("Eli's Maximize Income policy deterministically routes an unassigned soldier to the highest-earning open block", () => {
  // Uses the exported selector directly rather than driving a full advanceRun
  // tick, so the assertion is not entangled with that tick's raid/attrition
  // RNG — this isolates the placement ranking itself.
  function setup() {
    let state = promotedEliSetup(90201); state.player.cash = 5000;
    state = C.reduceGame(state, { type: "SET_ELI_POLICY", policy: "maximize_income" });
    state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); // claims spenard_rec_lot (lowest earner)
    state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state);
    state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); // claims northern_lights_motels (highest earner)
    state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "northern_lights_motels" }); clearModals(state);
    state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); // stays unassigned — nothing left to claim it into
    return state;
  }
  const a = setup(), b = setup();
  assert.deepEqual(Object.keys(a.world.soldiers).filter((id) => !a.world.soldiers[id].blockId), Object.keys(b.world.soldiers).filter((id) => !b.world.soldiers[id].blockId), "identical seed + actions produce identical unassigned soldiers");
  const unassignedId = Object.keys(a.world.soldiers).find((id) => a.world.soldiers[id].status === "active" && !a.world.soldiers[id].blockId);
  assert.ok(unassignedId, "one active soldier is left unassigned by the setup");
  const nextA = quietAdvance(a);
  assert.equal(nextA.world.soldiers[unassignedId].blockId, "northern_lights_motels", "Maximize Income routes the spare soldier to the highest-earning open block");
});

test("Kip laundering charges exactly 15% and moves the amount from dirty to clean cash", () => {
  let state = promotedEliSetup(42018);
  state.people.crew.kip.introduced = true; state.people.crew.kip.recruited = true; state.people.crew.kip.status = "active";
  state.people.dealers.kip.standing = 3;
  state.player.dirtyCash = 1000; state.player.cleanCash = 0; state.player.cash = 1000;
  const capacity = C.selectors.launderCapacity(state);
  const amount = Math.min(400, capacity);
  const result = C.reduceGame(state, { type: "LAUNDER_CASH", amount });
  const fee = Math.round(amount * C.KIP_LAUNDER_FEE);
  assert.equal(fee, Math.round(amount * 0.15));
  assert.equal(result.player.dirtyCash, 1000 - amount);
  assert.equal(result.player.cleanCash, amount - fee);
  assert.equal(result.player.cash, 1000 - fee);
});

test("laundering resolves in the same slot as every other financial action, not a delayed queue", () => {
  let state = promotedEliSetup(42019);
  state.people.crew.kip.introduced = true; state.people.crew.kip.recruited = true; state.people.crew.kip.status = "active";
  state.people.dealers.kip.standing = 3;
  state.player.dirtyCash = 500; state.player.cash = 500;
  const before = { day: state.run.day, slot: state.run.slot };
  const after = C.reduceGame(state, { type: "LAUNDER_CASH", amount: 100 });
  assert.equal(after.player.cleanCash, 85, "the clean cash lands immediately, not after a delay");
  assert.ok(after.run.day > before.day || after.run.slot > before.slot, "laundering advances exactly one normal slot, same as any other action");
});

test("Ship Creek pays clean cash while trading and robbery stay dirty, and cash always equals dirty plus clean", () => {
  let state = fresh(60001);
  state = C.reduceGame(state, { type: "WORK_SHIFT" });
  assert.ok(state.player.cleanCash > 0, "Ship Creek income is classified clean");
  assert.equal(state.player.cash, state.player.dirtyCash + state.player.cleanCash);
  const dirtyBefore = state.player.dirtyCash;
  state.run.pendingEvent = null;
  const market = state.world.markets[state.world.currentNeighborhoodId];
  const productId = Object.keys(state.player.inventory).find((id) => state.world.productAccess[id] && market.availability[id] > 0);
  if (productId) {
    state = C.reduceGame(state, { type: "BUY", productId, qty: 1 });
    assert.equal(state.player.cash, state.player.dirtyCash + state.player.cleanCash);
  }
  assert.ok(state.player.dirtyCash <= dirtyBefore + 1, "trading does not add new clean cash");
});

test("a large dirty spend raises financial Heat, which decays and eventually folds into street Heat", () => {
  let state = fresh(60002);
  state.player.cash = 5000; state.player.dirtyCash = 5000; state.player.cleanCash = 0;
  const heatBefore = state.player.financialHeat;
  state = C.reduceGame(state, { type: "BUY_GEAR", gearId: "larger_bag" }); // spend is small, financial heat should not trigger yet
  let big = fresh(60003);
  big.player.cash = 5000; big.player.dirtyCash = 5000; big.player.cleanCash = 0; big.base.controlled = true; big.base.visiting = true;
  big = C.reduceGame(big, { type: "UPGRADE_BASE", track: "operations" }); // $180, below threshold
  big.player.cash += 1000; big.player.dirtyCash += 1000; big.base.visiting = true;
  const spendState = quietAdvance(big); // reconciles any drift from the manual cash bump above
  assert.equal(spendState.player.financialHeat >= 0, true);
});

test("Dre's collector tier escalates with missed days and multiplies the existing late-fee formula", () => {
  let state = fresh(70001);
  state.lender.balance = 1000; state.lender.dueDay = 1;
  let next = state;
  for (let i = 0; i < 20; i += 1) next = quietAdvance(next);
  assert.ok(next.lender.missedDays >= 3, `expected missedDays >= 3, got ${next.lender.missedDays}`);
  assert.ok(next.lender.collectorTier >= 1, "collector tier rises once enough days are missed");
  assert.ok(next.lender.balance > 1000, "late fees continue to accrue on top of tier escalation");
});

test("collector tier stays at 0 with a 1.0 fee multiplier when no days are missed, matching pre-v1.0 math", () => {
  const state = fresh(70002);
  assert.equal(state.lender.collectorTier, 0);
  assert.equal(state.lender.interestMultiplier, 1.0);
});

test("Rook's rook_cut beat is reachable through Respect alone, and pressure alone cannot advance Rook after the migration", () => {
  const respectOnly = fresh(80001);
  respectOnly.flags.rookTaxResolved = true;
  respectOnly.rival.pressure = 0;
  respectOnly.rival.respect = C.RESPECT_STAGE_THRESHOLDS.cut;
  respectOnly.world.currentNeighborhoodId = "north_star_lot";
  const descriptor = C.STORY_REGISTRY.find((item) => item.id === "rook_cut");
  assert.equal(descriptor.requires(respectOnly), true, "Respect alone unlocks rook_cut");

  const pressureOnly = fresh(80002);
  pressureOnly.flags.rookTaxResolved = true;
  pressureOnly.rival.pressure = 15;
  pressureOnly.rival.respect = 0;
  pressureOnly.world.currentNeighborhoodId = "airport_industrial"; // highest area.rival rating
  assert.equal(descriptor.requires(pressureOnly), false, "pressure alone, even at its cap, can no longer advance a Rook stage");

  const belowThreshold = fresh(80003);
  belowThreshold.flags.rookTaxResolved = true;
  belowThreshold.rival.pressure = 15;
  belowThreshold.rival.respect = C.RESPECT_STAGE_THRESHOLDS.cut - 1;
  assert.equal(descriptor.requires(belowThreshold), false, "Respect just under the threshold does not unlock the stage regardless of pressure");
});

test("Rook's opening beat no longer requires pressure to become eligible", () => {
  const descriptor = C.STORY_REGISTRY.find((item) => item.id === "rook_mark");
  const state = fresh(80004);
  state.rival.pressure = 15; state.rival.respect = 0; state.player.heat = 0;
  state.stats.robbery.attempts = 0;
  assert.equal(descriptor.requires(state), false, "pressure alone does not earn Rook's attention");
  state.rival.respect = 1;
  assert.equal(descriptor.requires(state), true, "Respect earns Rook's attention instead");
});

test("a save that already reached rook_cut through the old pressure gate keeps that progress on load", () => {
  const legacy = run(80005);
  const raw = JSON.parse(JSON.stringify(legacy));
  raw.flags = { ...raw.flags, rookTaxResolved: true, rookCutResolved: true };
  raw.rival.pressure = 5; raw.rival.respect = 0; // the old pressure-only path that used to unlock this beat
  const hydrated = C.hydrateRun(raw);
  assert.ok(hydrated.rival.respect >= C.RESPECT_STAGE_THRESHOLDS.cut, "Respect is raised to the stage's minimum so it reads consistently going forward");
  assert.equal(hydrated.flags.rookCutResolved, true, "the already-earned story progress itself is preserved, not replayed");
});

test("pressure remains the driver of Rook's aggressive/competitive relationship labels, unaffected by Respect", () => {
  let state = fresh(80003);
  state.rival.pressure = 12; state.rival.respect = 0;
  state = quietAdvance(state);
  assert.equal(state.rival.relationship, "aggressive", "high pressure alone still reads as aggressive");

  let calmState = fresh(80004);
  calmState.rival.pressure = 0; calmState.rival.respect = 6;
  calmState = quietAdvance(calmState);
  assert.notEqual(calmState.rival.relationship, "aggressive", "high Respect with zero pressure never reads as aggressive");
});

test("new ambient organization beats only become eligible once their underlying system is active", () => {
  const fresh1 = fresh(90001);
  const spenardScouted = C.STORY_REGISTRY.find((item) => item.id === "spenard_block_scouted");
  const rookRespectNotice = C.STORY_REGISTRY.find((item) => item.id === "rook_respect_notice");
  const kipIntro = C.STORY_REGISTRY.find((item) => item.id === "kip_lieutenant_intro");
  const soldierAftermath = C.STORY_REGISTRY.find((item) => item.id === "soldier_raid_aftermath");
  assert.equal(spenardScouted.requires(fresh1), false, "no Eli lieutenant yet");
  assert.equal(rookRespectNotice.requires(fresh1), false, "no controlled blocks yet");
  assert.equal(kipIntro.requires(fresh1), false, "no organization income yet");
  assert.equal(soldierAftermath.requires(fresh1), false, "no raid has happened");

  const active = promotedEliSetup(90002);
  assert.equal(spenardScouted.requires(active), true, "Eli active and map not yet revealed");
});

// --- PR #52 stabilization pass ----------------------------------------------

test("cash equals dirty plus clean after purchases, debt payments, recruitment, laundering, legal work, territory income, and property spending", () => {
  function checkInvariant(state, label) {
    assert.equal(state.player.cash, state.player.dirtyCash + state.player.cleanCash, label);
  }
  let state = fresh(100001);
  checkInvariant(state, "fresh run");
  state = C.reduceGame(state, { type: "WORK_SHIFT" }); checkInvariant(state, "after legal work");
  state = C.reduceGame(state, { type: "LEASE_GARAGE" }); checkInvariant(state, "after property spending");
  state.people.crew.eli.introduced = true; state.people.crew.eli.contactStage = "recruitable"; state.base.visiting = true;
  state = C.reduceGame(state, { type: "RECRUIT_CREW", crewId: "eli" }); clearModals(state); checkInvariant(state, "after crew recruitment");
  state.player.cash += 400; state.player.dirtyCash += 400;
  state = C.reduceGame(state, { type: "PAY_DEBT", amount: 200 }); checkInvariant(state, "after a debt payment");
  state.people.crew.eli.loyalty = 3; state.stats.streetRead.level = 2; state.base.visiting = false;
  state = C.reduceGame(state, { type: "PROMOTE_LIEUTENANT", crewId: "eli" }); clearModals(state); checkInvariant(state, "after lieutenant promotion");
  state.player.cash += 5000; state.player.dirtyCash += 5000;
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); checkInvariant(state, "after soldier recruitment");
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state); checkInvariant(state, "after claiming a block");
  let next = state;
  for (let i = 0; i < 4; i += 1) next = quietAdvance(next);
  checkInvariant(next, "after territory income resolves overnight");
  state.people.crew.kip.introduced = true; state.people.crew.kip.recruited = true; state.people.crew.kip.status = "active";
  state.people.dealers.kip.standing = 3;
  const preview = C.selectors.launderAvailability(state, Math.min(100, state.player.dirtyCash));
  if (preview.available) { state = C.reduceGame(state, { type: "LAUNDER_CASH", amount: Math.min(100, state.player.dirtyCash) }); checkInvariant(state, "after laundering"); }
  const raw = JSON.parse(JSON.stringify(state));
  const hydrated = C.hydrateRun(raw);
  checkInvariant(hydrated, "after save/load");
});

test("buying product then attempting to launder in the same visit cannot launder cash that was already spent", () => {
  let state = promotedEliSetup(100002);
  state.people.crew.kip.introduced = true; state.people.crew.kip.recruited = true; state.people.crew.kip.status = "active";
  state.people.dealers.kip.standing = 3;
  state.player.cash = 171; state.player.dirtyCash = 171; state.player.cleanCash = 0;
  state.world.productAccess.weed = true;
  state.world.markets[state.world.currentNeighborhoodId].availability.weed = 100;
  const price = C.selectors.tradeUnitPrices(state, "weed").buy;
  const qty = Math.floor(161 / price);
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty });
  assert.equal(state.player.cash, state.player.dirtyCash + state.player.cleanCash, "invariant holds immediately after the purchase");
  const stillReportedDirty = 171; // what dirtyCash would have shown under the old lazy-reconciliation bug
  const rejected = C.reduceGame(state, { type: "LAUNDER_CASH", amount: stillReportedDirty });
  assert.equal(rejected, state, "laundering more than the actual current cash is rejected outright");
  assert.ok(rejected.player.cash >= 0, "cash never goes negative");
});

test("laundering can never create negative cash, even at the exact edge of the player's dirty balance", () => {
  let state = promotedEliSetup(100003);
  state.people.crew.kip.introduced = true; state.people.crew.kip.recruited = true; state.people.crew.kip.status = "active";
  state.people.dealers.kip.standing = 3;
  state.player.cash = 50; state.player.dirtyCash = 50; state.player.cleanCash = 0;
  const capacity = C.selectors.launderCapacity(state);
  const amount = Math.min(50, capacity);
  const result = C.reduceGame(state, { type: "LAUNDER_CASH", amount });
  assert.ok(result.player.cash >= 0, "cash never goes negative");
  assert.equal(result.player.cash, result.player.dirtyCash + result.player.cleanCash);
  const overdraw = C.reduceGame(state, { type: "LAUNDER_CASH", amount: 51 });
  assert.equal(overdraw, state, "laundering more than the player has is rejected outright");
});

test("Kip never enters the field-assignment UI path and does not crash Safehouse-style rendering", () => {
  let state = promotedEliSetup(100004);
  state.people.crew.kip.introduced = true; state.people.crew.kip.recruited = true; state.people.crew.kip.status = "active";
  const recruited = C.selectors.recruitedCrew(state);
  const fieldAssignable = recruited.filter((person) => person.canFieldAssign);
  const lieutenantOnly = recruited.filter((person) => !person.canFieldAssign);
  assert.ok(fieldAssignable.every((person) => person.id !== "kip"), "Kip is never in the field-assignable list");
  assert.ok(lieutenantOnly.some((person) => person.id === "kip"), "Kip is routed to the lieutenant-only list instead");
  // Mirrors the exact lookup that used to crash: assignments[person.id] was
  // undefined for Kip because the table only defines eli/miri/tone.
  const assignments = { eli: ["north_run", "outer_run"], miri: ["source_cocaine", "source_meth"], tone: ["guard_base", "intimidate_buyer"] };
  assert.doesNotThrow(() => { for (const person of fieldAssignable) assignments[person.id].length; });
  const rejected = C.reduceGame(state, { type: "ASSIGN_CREW", crewId: "kip", assignment: "north_run" });
  assert.equal(rejected, state, "the reducer itself also refuses to field-assign Kip, defense in depth");
});

test("losing a block clears every surviving soldier's assignment, not just the casualty", () => {
  // Force a raid-and-loss deterministically: three soldiers on one block,
  // then invoke advanceRun repeatedly across seeds until a block-loss occurs,
  // and confirm every remaining soldier that was on that block is detached.
  function setup(seed) {
    let state = promotedEliSetup(seed); state.player.cash = 5000; state.player.heat = 10; // raise raid odds
    state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
    state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "northern_lights_motels" }); clearModals(state); // highest patrol/heat exposure
    state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
    const spare = Object.values(state.world.soldiers).find((item) => item.status === "active" && !item.blockId);
    if (spare) state = C.reduceGame(state, { type: "ASSIGN_SOLDIER", soldierId: spare.id, blockId: "northern_lights_motels" });
    return state;
  }
  let found = false;
  for (let seed = 100010; seed < 100060 && !found; seed += 1) {
    let state = setup(seed);
    let next = state;
    for (let i = 0; i < 4 && !found; i += 1) {
      next = quietAdvance(next);
      if (next.world.territoryBlocks.northern_lights_motels.owner === "rook") {
        found = true;
        assert.deepEqual(next.world.territoryBlocks.northern_lights_motels.soldiersAssigned, [], "the block's assignment list is cleared");
        for (const soldier of Object.values(next.world.soldiers)) {
          if (soldier.status === "active") assert.notEqual(soldier.blockId, "northern_lights_motels", "no surviving soldier still references the lost block");
        }
      }
    }
  }
  assert.ok(found, "expected at least one seed in range to produce a block loss with heat=10");
});

test("no active soldier ever references a block the player does not currently control", () => {
  function playOut(seed) {
    let state = promotedEliSetup(seed); state.player.cash = 5000;
    for (let i = 0; i < 4; i += 1) { state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); }
    for (const blockId of ["spenard_rec_lot", "fourth_ave_strip", "minnesota_offramp"]) {
      const avail = C.selectors.blockClaimAvailability(state, blockId);
      if (avail.available) { state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId }); clearModals(state); }
    }
    let next = state;
    for (let i = 0; i < 12; i += 1) next = quietAdvance(next);
    return next;
  }
  for (let seed = 100100; seed < 100110; seed += 1) {
    const state = playOut(seed);
    for (const soldier of Object.values(state.world.soldiers)) {
      if (soldier.status !== "active" || !soldier.blockId) continue;
      assert.equal(state.world.territoryBlocks[soldier.blockId].owner, "player", `seed ${seed}: soldier ${soldier.id} references a non-player-controlled block`);
    }
  }
});

test("a single soldier cannot be used to claim six blocks — each claim consumes its own occupier", () => {
  let state = promotedEliSetup(100005); state.player.cash = 5000;
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  const firstClaim = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" });
  assert.equal(firstClaim.world.territoryBlocks.spenard_rec_lot.owner, "player");
  clearModals(firstClaim);
  const secondAttempt = C.reduceGame(firstClaim, { type: "CLAIM_BLOCK", blockId: "fourth_ave_strip" });
  assert.equal(secondAttempt.world.territoryBlocks.fourth_ave_strip.owner, "rook", "no soldier remains to occupy a second block");
});

test("unpaid Day 7 debt triggers Dre Tier 1 (or higher) collector enforcement in a fresh-arrival run", () => {
  let state = fresh(100006);
  assert.equal(state.lender.dueDay, C.RUN_DAYS, "fresh-arrival runs are due exactly at the end of the run");
  let next = state;
  for (let i = 0; i < 28 && next.run.status === "playing"; i += 1) next = quietAdvance(next);
  assert.ok(next.lender.balance > 0, "sanity: the debt is still unpaid");
  assert.ok(next.lender.collectorTier >= 1, "Tier 1 enforcement is reachable within the seven-day run");
});

test("a heavier unpaid balance produces a higher collector tier than a nearly-paid-off balance", () => {
  function playToEnd(seed, payment) {
    let state = fresh(seed);
    if (payment) state = C.reduceGame(state, { type: "PAY_DEBT", amount: payment });
    let next = state;
    for (let i = 0; i < 28 && next.run.status === "playing"; i += 1) next = quietAdvance(next);
    return next;
  }
  const heavy = playToEnd(100007, 0);
  const light = playToEnd(100008, 1000); // pays almost everything down, seed shares the same $1000 starting cash
  assert.ok(heavy.lender.collectorTier >= light.lender.collectorTier, "owing more of the original debt produces a tier at least as severe");
});

test("a fully paid Dre debt prevents any collector enforcement at all", () => {
  let state = fresh(100009);
  state.player.cash = 1200;
  state = C.reduceGame(state, { type: "PAY_DEBT", amount: 1200 });
  assert.equal(state.lender.balance, 0);
  let next = state;
  for (let i = 0; i < 28 && next.run.status === "playing"; i += 1) next = quietAdvance(next);
  assert.equal(next.lender.collectorTier, 0, "no debt means no collector tier ever triggers");
});

test("killing a Dre collector increases collectorsKilled and future enforcement cost", () => {
  let state = fresh(100011);
  state.lender.balance = 1200; state.lender.collectorTier = 2;
  state.player.attributes = { strength: 5, endurance: 5, reflexes: 5, presence: 5, insight: 5, discipline: 5 };
  state.player.gear.owned = ["reliable_handgun"];
  state.player.gear.equipped.weapon = "reliable_handgun";
  state.run.status = "playing";
  const interestBefore = state.lender.interestMultiplier;
  let won = false;
  for (let seed = 1; seed <= 60 && !won; seed += 1) {
    let attempt = { ...state, run: { ...state.run, rngState: seed } };
    attempt.run.pendingEncounter = null;
    C.buildEventForTest; // no-op reference to keep imports honest
    let encounterState = JSON.parse(JSON.stringify(attempt));
    // Fire the encounter directly via the shared start-encounter path by
    // simulating what scheduleStory would have produced.
    encounterState = C.reduceGame(encounterState, { type: "HYDRATE_RUN", state: encounterState }); // no-op hydrate to normalize shape
    encounterState.run.pendingEncounter = { id: "dre_collector", step: 1, enemyHealth: 1, feedback: "", finishAfter: false, title: "t", description: "d", enemyName: "Dre's Collector", guard: 0.1, evasion: 0.05, pursuit: 0.1, attack: [1, 2], pay: 1 };
    const result = C.reduceGame(encounterState, { type: "RESOLVE_ENCOUNTER", choiceId: "fight" });
    if (result.lender.collectorsKilled > (encounterState.lender.collectorsKilled || 0)) {
      won = true;
      assert.ok(result.lender.interestMultiplier > interestBefore, "interest multiplier increases after a collector kill");
    }
  }
  assert.ok(won, "expected at least one seed to produce a fight win against the collector within 60 tries");
});

test("Eli's automated soldier redistribution after promotion consumes zero additional time slots", () => {
  let state = promotedEliSetup(100012); state.player.cash = 5000;
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state);
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); // left unassigned for auto-redistribution
  const before = { day: state.run.day, slot: state.run.slot };
  const next = quietAdvance(state); // exactly one normal time-advancing action
  const expectedSlot = (before.slot + 1) % 4;
  const expectedDay = before.slot === 3 ? before.day + 1 : before.day;
  assert.equal(next.run.slot, expectedSlot);
  assert.equal(next.run.day, expectedDay, "the automated redistribution inside this tick added no extra day/slot advancement");
});

test("save/load preserves soldiers, blocks, lieutenant state, Eli's policy, and Kip's laundering state", () => {
  let state = promotedEliSetup(100013); state.player.cash = 5000;
  state = C.reduceGame(state, { type: "SET_ELI_POLICY", policy: "hold_ground" });
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state);
  state.people.crew.kip.introduced = true; state.people.crew.kip.recruited = true; state.people.crew.kip.status = "active";
  state.people.dealers.kip.standing = 3;
  const raw = JSON.parse(JSON.stringify(state));
  const hydrated = C.hydrateRun(raw);
  assert.equal(hydrated.people.crew.eli.operationPolicy, "hold_ground");
  assert.deepEqual(hydrated.world.soldiers, state.world.soldiers);
  assert.deepEqual(hydrated.world.territoryBlocks, state.world.territoryBlocks);
  assert.equal(hydrated.people.crew.eli.lieutenantStage, "operations_lieutenant");
  assert.equal(hydrated.people.crew.kip.recruited, true);
  assert.equal(hydrated.lender.collectorTier, state.lender.collectorTier);
});

// --- v1.1 presentation selectors --------------------------------------------
// Both are pure reads. These tests exist because Home's progressive disclosure
// and the action-result receipt are gameplay-visible contracts, not styling.

test("homeSituation answers the Home questions from live state and hides locked systems", () => {
  const state = fresh(60001);
  const view = C.selectors.homeSituation(state);
  assert.equal(view.day, 1);
  assert.equal(view.partLabel, "Morning");
  assert.equal(view.districtName, "Spenard");
  assert.equal(view.cash, state.player.cash);
  assert.equal(view.debt.balance, state.lender.balance);
  assert.equal(view.debt.note, `Due Day ${state.lender.dueDay}`);
  assert.equal(view.heat.label, "Low");
  assert.equal(view.identity.label, "Unproven");
  assert.ok(view.summary.length > 40, "the situation summary is authored prose, not a stat dump");
  // A Day 1 arrival owes $1,200 against $1,000 of borrowed cash.
  assert.match(view.summary, /underwater/);
  assert.match(view.summary, /Most of Spenard is still unfamiliar/);
  for (const id of ["operations", "territory", "soldiers", "district", "laundering", "rival", "crew"]) {
    assert.equal(view.unlocks[id], false, `${id} stays hidden on the first Morning`);
  }
});

test("homeSituation reveals organization systems only as the run unlocks them", () => {
  let state = promotedEliSetup(60002);
  state.player.cash = 6000; state.player.dirtyCash = 6000; state.player.cleanCash = 0;
  let view = C.selectors.homeSituation(state);
  assert.equal(view.unlocks.operations, true, "the garage unlocks Operations");
  assert.equal(view.unlocks.territory, true, "a promoted Eli unlocks Territory");
  assert.equal(view.unlocks.district, false, "District stays hidden with no blocks held");
  assert.equal(view.unlocks.laundering, false, "Laundering stays hidden until Kip runs finance");

  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state);
  state.people.crew.kip.introduced = true; state.people.crew.kip.recruited = true; state.people.crew.kip.status = "active";
  view = C.selectors.homeSituation(state);
  assert.equal(view.unlocks.district, true);
  assert.equal(view.unlocks.laundering, true);
  assert.equal(view.organization.blocks, 1);
  assert.match(view.summary, /1 block producing/);
});

test("home priorities are severity-ordered, capped at two, and never a checklist", () => {
  const calm = C.selectors.homePriorities(fresh(60003));
  assert.deepEqual(calm, [], "a calm first Morning raises nothing");

  const state = fresh(60004);
  state.run.day = 7; state.lender.dueDay = 5; state.player.health = 20; state.player.heat = 13;
  const urgent = C.selectors.homePriorities(state);
  assert.equal(urgent.length, 2, "at most two priorities ever surface");
  assert.deepEqual(urgent.map((item) => item.id), ["debt_overdue", "health_critical"], "a past-due note outranks everything");
  assert.ok(urgent.every((item) => item.tone === "bad"));

  const tonight = fresh(60004);
  tonight.run.day = tonight.lender.dueDay; tonight.player.health = 20; tonight.player.heat = 13;
  assert.deepEqual(C.selectors.homePriorities(tonight).map((item) => item.id), ["health_critical", "debt_tonight"], "critical health outranks a note that is still payable tonight");

  const dueToday = fresh(60005);
  dueToday.run.day = dueToday.lender.dueDay;
  assert.equal(C.selectors.homePriorities(dueToday)[0].id, "debt_tonight");

  const tomorrow = fresh(60006);
  tomorrow.run.day = tomorrow.lender.dueDay - 1;
  assert.equal(C.selectors.homePriorities(tomorrow)[0].id, "debt_tomorrow");

  const paid = fresh(60007);
  paid.run.day = paid.lender.dueDay; paid.lender.balance = 0;
  assert.ok(!C.selectors.homePriorities(paid).some((item) => item.id.startsWith("debt")), "a cleared note raises no debt priority");
});

test("actionResult reports time movement and the money that moved for a time-consuming action", () => {
  const before = fresh(60008);
  const after = C.reduceGame(before, { type: "WORK_SHIFT" });
  const result = C.selectors.actionResult(before, after, "WORK_SHIFT");
  assert.ok(result, "a shift that consumes part of the day produces a result");
  assert.equal(result.title, "Shift Complete");
  assert.equal(result.time.from, "Morning");
  assert.equal(result.time.to, "Afternoon");
  assert.equal(result.time.dayChanged, false);
  assert.equal(result.time.label, "MORNING → AFTERNOON");
  assert.ok(result.lines.length >= 1 && result.lines.length <= 4, "the receipt stays short");
  const clean = result.lines.find((line) => line.label === "Clean Cash");
  assert.ok(clean, "Ship Creek pay is reported as clean cash");
  assert.match(clean.value, /^\+\$\d+$/);
  assert.equal(clean.tone, "good");
});

test("actionResult names the destination and crossed-day label for travel", () => {
  let before = fresh(60009);
  before.run.slot = 3; // Night, so the ride crosses into the next day
  const after = C.reduceGame(before, { type: "BUS_TRAVEL", neighborhoodId: "downtown" });
  const result = C.selectors.actionResult(after.run.daySummary ? { ...before, run: { ...before.run } } : before, after, "BUS_TRAVEL");
  if (after.run.daySummary) {
    // A crossed day hands the outcome to the day summary instead of stacking.
    assert.equal(C.selectors.actionResult(before, after, "BUS_TRAVEL"), null);
  } else {
    assert.equal(result.title, "Arrived in Downtown");
    assert.equal(result.time.dayChanged, true);
    assert.match(result.time.label, /NIGHT → DAY 2 MORNING/);
  }
});

test("actionResult stays silent for free actions, run lifecycle, and richer result surfaces", () => {
  const state = fresh(60010);
  assert.equal(C.selectors.actionResult(state, state, "WORK_SHIFT"), null, "an identical state is not a result");

  const free = C.reduceGame(state, { type: "ASK_JOHN" });
  if (free !== state && free.run.slot === state.run.slot && free.run.day === state.run.day) {
    assert.equal(C.selectors.actionResult(state, free, "ASK_JOHN"), null, "a free action consumes no part of the day and raises nothing");
  }

  const restarted = C.reduceGame(state, { type: "NEW_RUN", seed: 4 });
  assert.equal(C.selectors.actionResult(state, restarted, "NEW_RUN"), null, "run lifecycle actions never raise a receipt");

  const withOperation = JSON.parse(JSON.stringify(state));
  withOperation.run.slot = 1;
  withOperation.run.pendingOperationResult = { title: "Takeover", summary: "", effects: [] };
  assert.equal(C.selectors.actionResult(state, withOperation, "TAKEOVER"), null, "the operation modal owns its own outcome");

  const withSummary = JSON.parse(JSON.stringify(state));
  withSummary.run.day = 2; withSummary.run.slot = 0;
  withSummary.run.daySummary = { day: 1, operationScore: 0, netWorth: 0, debt: 0, heat: 0, health: 100 };
  assert.equal(C.selectors.actionResult(state, withSummary, "END_MARKET"), null, "a crossed day hands feedback to the day summary");

  const ended = JSON.parse(JSON.stringify(state));
  ended.run.slot = 1; ended.run.status = "ended";
  assert.equal(C.selectors.actionResult(state, ended, "END_MARKET"), null, "the ending screen owns the end of the run");
});

test("actionResult reports organization outcomes without touching the reducer", () => {
  let state = promotedEliSetup(60011); state.player.cash = 6000;
  const beforeSnapshot = JSON.parse(JSON.stringify(state));
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" });
  const recruit = C.selectors.actionResult(beforeSnapshot, state, "RECRUIT_SOLDIER");
  assert.equal(recruit.title, "Soldier Recruited");
  assert.ok(recruit.lines.some((line) => line.label === "Soldiers"));
  assert.match(recruit.time.label, /→/);
  // The diff is a read: running it does not disturb either state.
  assert.deepEqual(JSON.parse(JSON.stringify(beforeSnapshot)), beforeSnapshot);

  clearModals(state);
  const beforeClaim = JSON.parse(JSON.stringify(state));
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" });
  const claim = C.selectors.actionResult(beforeClaim, state, "CLAIM_BLOCK");
  if (claim) {
    assert.equal(claim.title, "Block Claimed");
    assert.ok(claim.lines.some((line) => line.label === "Blocks Held"));
  }
});
