const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../game-core.js");

function run(seed = 907) {
  return C.reduceGame(C.createRun({ seed }), { type: "CHOOSE_BACKGROUND", backgroundId: "shooter" });
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
  let state = run(); state.world.territories.north_star_lot.owner = "player";
  const controlledPrice = C.selectors.tradeUnitPrices(state, "weed"); state.world.territories.north_star_lot.owner = "rook"; const rookPrice = C.selectors.tradeUnitPrices(state, "weed");
  assert.ok(controlledPrice.buy < rookPrice.buy); assert.ok(controlledPrice.sell > rookPrice.sell);
  state.world.territories.north_star_lot.owner = "player"; state.run.slot = 3; const cash = state.player.cash; state = quietAdvance(state);
  assert.equal(state.player.cash, cash + 45); assert.equal(state.stats.takeovers.income, 45);
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

test("feature availability follows milestones and returning saves bypass early locks", () => {
  let state = run(); let features = C.selectors.featureAvailability(state);
  assert.equal(features.market.available, true); assert.equal(features.finances.available, true); assert.equal(features.help.available, true);
  assert.equal(features.travel.available, false); assert.equal(features.operations.available, false); assert.equal(features.people.available, false); assert.equal(features.recovery.available, false);
  state = quietAdvance(state); features = C.selectors.featureAvailability(state);
  assert.equal(features.travel.available, true); assert.equal(features.operations.available, true);
  state.run.day = 3; features = C.selectors.featureAvailability(state);
  assert.equal(features.people.available, true); assert.equal(features.recovery.available, true);
});

test("Mara introduction resolves once and does not by itself arm her threat", () => {
  let state = run(); assert.equal(C.selectors.maraThreatEligible(state), false);
  state = driveTo(state, "mara_intro"); assert.equal(state.run.pendingEvent.id, "mara_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.people.mara.met, true); assert.equal(state.people.mara.introChoice, "flirt");
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
  state.flags.maraBoundaryResolved = true;
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
  state = driveTo(state, "mara_intro");
  const built = state.run.pendingEvent;
  assert.equal(built.chain, undefined); assert.equal(built.stage, undefined); assert.equal(built.weight, undefined);
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.people.mara.chainStage, 1);
  assert.equal(state.people.mara.outcomes.length, 1);
  assert.equal(state.people.mara.outcomes[0].stage, 1);
});

test("resolving a Mara scene never consumes a second part of day", () => {
  let state = run();
  state = driveTo(state, "mara_intro");
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
