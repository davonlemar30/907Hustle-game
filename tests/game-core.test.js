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
  assert.deepEqual(C.BACKGROUNDS.map((item) => item.name), ["Shooter", "Hustler", "Strategist"]);
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

test("robbery is gated by working capital and can be used once", () => {
  let state = run(123); assert.equal(C.selectors.robberyAvailability(state).available, false);
  state.player.cash = 100; state.base.storedCash = 0; state.run.pendingEvent = null;
  state = C.reduceGame(state, { type: "ROBBERY" });
  assert.equal(state.stats.robbery.attempted, true); assert.equal(state.stats.pipelineAdvances, 1); assert.ok(state.run.pendingOperationResult || state.run.status === "ended");
  if (state.run.status === "playing") { state = C.reduceGame(state, { type: "ACKNOWLEDGE_OPERATION_RESULT" }); const again = C.reduceGame(state, { type: "ROBBERY" }); assert.deepEqual(again, state); }
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
  assert.equal(summary.territories.length, 3); assert.equal(summary.robbery.attempted, false); assert.equal(summary.takeovers.attempts, 0);
});
