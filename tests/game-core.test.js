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

test("v3 run uses an isolated save and approved equal-resource backgrounds", () => {
  assert.equal(C.VERSION, 3); assert.equal(C.SAVE_KEY, "907ogr_v3");
  assert.equal(C.BACKGROUNDS.length, 3);
  assert.deepEqual(C.BACKGROUNDS.map((item) => item.name), ["Steady-Hand Shooter", "Silver-Tongued Hustler", "Strategist"]);
  assert.deepEqual(C.STARTING_EDGES.map((item) => item.id), ["shooter", "hustler"]);
  assert.ok(C.BACKGROUNDS.every((item) => item.cash === 375 && item.heat === 1));
});

test("backgrounds create the approved stat identities", () => {
  const expected = { shooter: [3, 1, 2], hustler: [1, 3, 2], strategist: [2, 1, 3] };
  for (const [id, values] of Object.entries(expected)) {
    const state = C.reduceGame(C.createRun({ seed: 4 }), { type: "CHOOSE_BACKGROUND", backgroundId: id });
    assert.deepEqual(Object.values(state.player.stats), values);
    assert.equal(state.player.cash, 375);
  }
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
  const state = run(); state.player.stats.intelligence = 1; assert.equal(C.selectors.territoryPowerEstimate(state, "north_star_lot").label, "9–15");
  state.player.stats.intelligence = 2; assert.equal(C.selectors.territoryPowerEstimate(state, "north_star_lot").label, "11–13");
  state.player.stats.intelligence = 3; assert.equal(C.selectors.territoryPowerEstimate(state, "north_star_lot").label, "12");
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

test("v3 hydration preserves Strategist and normalizes additive fields", () => {
  const old = run(88); old.player.background = "strategist"; old.player.stats = { combat: 2, charisma: 1, intelligence: 3 };
  old.people.mara = { met: true, trust: 2, status: "cautious", outcomes: [] };
  old.people.crew.eli.introduced = true; delete old.people.crew.eli.contactStage;
  old.stats.robbery = { attempted: true, success: false, payout: 0 };
  const hydrated = C.hydrateRun(JSON.parse(JSON.stringify(old)));
  assert.equal(hydrated.player.background, "strategist"); assert.equal(hydrated.people.mara.available, true);
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

test("Mara introduction resolves once and gates the relationship-dependent threat", () => {
  let state = run(); assert.equal(C.selectors.maraThreatEligible(state), false);
  state = C.reduceGame(state, { type: "END_MARKET" }); assert.equal(state.run.pendingEvent.id, "mara_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.people.mara.met, true); assert.equal(state.people.mara.introChoice, "flirt"); assert.equal(C.selectors.maraThreatEligible(state), true);
  state.flags.eliOfferResolved = true; state.run.day = 2; state.run.slot = 0; state.run.pendingEvent = null;
  state = C.reduceGame(state, { type: "END_MARKET" });
  assert.equal(state.run.pendingEncounter.id, "early_mara"); assert.match(state.run.pendingEncounter.description, /stayed to flirt/);
  assert.equal(state.flags.maraIntroResolved, true);
});

test("Mara-free runs receive a different early threat", () => {
  let state = run(); state.flags.maraIntroResolved = true; state.flags.eliOfferResolved = true; state.run.day = 2; state.people.mara.met = false;
  state = C.reduceGame(state, { type: "END_MARKET" });
  assert.equal(state.run.pendingEncounter.id, "early_street"); assert.doesNotMatch(state.run.pendingEncounter.description, /Mara/);
});

test("Eli progresses from introduction through a time-consuming test route", () => {
  let state = run(901); state.flags.maraIntroResolved = true; state.run.slot = 2;
  state = C.reduceGame(state, { type: "END_MARKET" }); assert.equal(state.run.pendingEvent.id, "eli_offer");
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
