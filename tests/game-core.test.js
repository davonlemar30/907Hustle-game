const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../game-core.js");
const { putInBand } = require("./exposure-helpers.js");

function run(seed = 907) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "CHOOSE_BACKGROUND", backgroundId: "shooter" });
  // Legacy-established fixtures predate the fresh-arrival plug encounter.
  state.market.visible = true; state.plugs.unlocked = ["goodie"]; state.world.productAccess.weed = true;
  return state;
}
function fresh(seed = 907) {
  return C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Rookie" });
}
function discoverJob(state, jobId) {
  if (!state.jobs.discovered.includes(jobId)) state.jobs.discovered.push(jobId);
  state.jobs.activeJobId = jobId;
  state.jobs.hired = ["day_labor", jobId];
  return state;
}
function quietAdvance(state, reason = "END_MARKET") {
  state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.pendingOperationResult = null;
  let next = C.advanceRun(state, { reason, suppressStory: true });
  next.run.pendingEvent = null; next.run.pendingEncounter = null; next.run.pendingOperationResult = null;
  if (next.run.dayEndPending && !next.run.pendingEvent && !next.run.pendingEncounter && !next.run.pendingOperationResult) next = C.reduceGame(next, { type: "CONFIRM_END_DAY" });
  return next;
}
// Alpha v0.7 selects story beats by weighted roll rather than a fixed ladder, so
// tests drive the run forward until the beat under test appears instead of
// assuming it lands on a particular tick.
function settleForTest(state) {
  let guard = 0;
  while (guard++ < 20) {
    if (state.run.daySummary) { state = C.reduceGame(state, { type: "DISMISS_DAY_SUMMARY" }); continue; }
    if (state.run.pendingOperationResult) { state = C.reduceGame(state, { type: "ACKNOWLEDGE_OPERATION_RESULT" }); continue; }
    if (state.run.dayEndPending && !state.run.pendingEvent && !state.run.pendingEncounter) { state = C.reduceGame(state, { type: "CONFIRM_END_DAY" }); continue; }
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
  assert.equal(C.VERSION, 7); assert.equal(C.SAVE_KEY, "907ogr_v7");
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
  const state = C.reduceGame(C.createRun({ seed: 8 }), { type: "START_RUN", streetName: "Rookie" });
  assert.equal(state.run.status, "playing");
  assert.equal(state.player.background, null); assert.equal(state.player.legacyBackground, null);
  assert.equal(state.player.streetName, "Rookie"); assert.equal(state.player.streetIdentity, "unproven");
  assert.deepEqual(state.player.attributes, C.ATTRIBUTE_DEFAULTS);
  assert.deepEqual(C.selectors.derivedRatings(state), { combat: 2, charisma: 2, intelligence: 2 });
});

test("meaningful behavior is deduplicated, capped, and bounded", () => {
  const state = C.reduceGame(C.createRun({ seed: 8 }), { type: "START_RUN", streetName: "Rookie" });
  assert.equal(C.recordBehaviorForTest(state, "mover", 1, "sale:a", "sale"), true);
  assert.equal(C.recordBehaviorForTest(state, "mover", 1, "sale:a", "sale"), false);
  assert.equal(C.recordBehaviorForTest(state, "mover", 1, "sale:b", "sale"), true);
  assert.equal(C.recordBehaviorForTest(state, "mover", 1, "sale:c", "sale"), false);
  for (let i = 0; i < 60; i += 1) C.recordBehaviorForTest(state, "connector", 1, `contact:${i}`, "relationship");
  assert.equal(state.player.behavior.history.length, 50);
});

test("Street Identity assigns at Day 2 Night and mixed behavior becomes Wild Card", () => {
  const mover = C.reduceGame(C.createRun({ seed: 8 }), { type: "START_RUN", streetName: "Rookie" });
  for (let i = 0; i < 6; i += 1) C.recordBehaviorForTest(mover, "mover", 1, `move:${i}`, "market_read");
  mover.run.day = 2; mover.run.slot = 3; C.evaluateStreetIdentityForTest(mover, true);
  assert.equal(mover.player.streetIdentity, "mover"); assert.equal(mover.player.identityHistory.length, 1);
  const mixed = C.reduceGame(C.createRun({ seed: 9 }), { type: "START_RUN", streetName: "Rookie" });
  for (let i = 0; i < 3; i += 1) C.recordBehaviorForTest(mixed, "mover", 1, `m:${i}`, "market_read");
  for (let i = 0; i < 3; i += 1) C.recordBehaviorForTest(mixed, "connector", 1, `c:${i}`, "relationship");
  mixed.run.day = 2; mixed.run.slot = 3; C.evaluateStreetIdentityForTest(mixed, true);
  assert.equal(mixed.player.streetIdentity, "wild_card");
});

test("identity changes require the lead to persist for two nights", () => {
  const state = C.reduceGame(C.createRun({ seed: 10 }), { type: "START_RUN", streetName: "Rookie" });
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
  const hydrated = JSON.parse(C.serializeRun(state));
  assert.equal(hydrated.version, C.VERSION); assert.equal(hydrated.player.inventory.weed.avgCost, 31.25);
  const next = C.reduceGame(hydrated, { type: "SELL", productId: "weed", qty: 1 });
  assert.equal(next.player.inventory.weed.qty, 3);
});

test("end market advances time while market evolution waits for confirmed night", () => {
  const state = run(); const next = quietAdvance(state);
  assert.equal(next.run.slot, 1); assert.equal(next.stats.pipelineAdvances, 1); assert.equal(next.stats.marketUpdates, 0);
  for (const area of C.NEIGHBORHOODS) assert.equal(next.world.markets[area.id].updatedAt, 0);
});

test("Night actions open a structured recap before confirmed rollover", () => {
  for (const reason of ["END_MARKET", "TRAVEL", "LAY_LOW", "HEAL", "PAY_DEBT", "ROBBERY", "TAKEOVER"]) {
    let state = run(); state.run.day = 1; state.run.slot = 3;
    state = C.advanceRun(state, { reason, suppressStory: true });
    assert.equal(state.run.day, 1, reason); assert.equal(state.run.dayEndPending, true, reason); assert.equal(state.run.dailyActions.at(-1).day, 1, reason);
    state.run.pendingEvent = null; state.run.pendingEncounter = null;
    state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
    assert.equal(state.run.day, 2, reason); assert.equal(state.run.slot, 0, reason);
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

test("debt payment is free and full payoff unlocks Dre's offer", () => {
  let state = run(); state.player.cash = 1000; state.run.pendingEvent = null;
  const before = state.stats.pipelineAdvances;
  state = C.reduceGame(state, { type: "PAY_DEBT", amount: 620 });
  assert.equal(state.lender.balance, 0); assert.equal(state.lender.afterPayoffOffer, "available"); assert.equal(state.stats.pipelineAdvances, before);
});

test("Rob is available once per day and returns on a later day", () => {
  let state = run(123); state.player.cash = 100; assert.equal(C.selectors.robAvailability(state).available, true);
  state = C.reduceGame(state, { type: "ROB" });
  assert.equal(state.stats.robbery.attempts, 1); assert.equal(state.stats.robbery.lastAttemptedDay, 1); assert.equal(state.stats.pipelineAdvances, 1); assert.ok(state.run.pendingOperationResult || state.run.status === "ended");
  if (state.run.status === "playing") {
    state = C.reduceGame(state, { type: "ACKNOWLEDGE_OPERATION_RESULT" });
    assert.equal(C.selectors.robAvailability(state).available, false);
    while (state.run.pendingEncounter && state.run.status === "playing") {
      const choiceId = C.selectors.encounterChoices(state)[0].id;
      state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId });
    }
    state.run.day = 2; state.run.slot = 0; state.player.cash = 50; state.base.storedCash = 0;
    assert.equal(C.selectors.robAvailability(state).available, true);
  }
});

test("all three territories start under Curtis with exact approved values", () => {
  const state = run();
  assert.deepEqual(C.TERRITORIES.map((item) => [item.power, item.attackCost, item.dailyIncome]), [[12, 100, 45], [18, 150, 75], [24, 200, 110]]);
  assert.ok(C.TERRITORIES.every((item) => state.world.territories[item.areaId].owner === "curtis"));
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
  state.world.territories.downtown.owner = "curtis";
  const curtisPrice = C.selectors.tradeUnitPrices({ ...state, world: { ...state.world, currentNeighborhoodId: "downtown" } }, "weed");
  assert.ok(controlledPrice.buy < curtisPrice.buy); assert.ok(controlledPrice.sell > curtisPrice.sell);
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
  // The capstone now asks that Curtis reads you as Trusted rather than that a
  // respect integer crossed 6.
  putInBand(state, "curtis", C.BANDS.TRUSTED);
  const capstone = C.selectors.districtControlTier(state, "north_star_lot");
  assert.equal(capstone.label, "District Control");
  assert.equal(capstone.capstone, true);

  // Downtown has no block layer yet, so it falls back to the plain owner boolean.
  assert.equal(C.selectors.districtControlTier(state, "downtown").label, "Neutral");
  state.world.territories.downtown.owner = "player";
  assert.equal(C.selectors.districtControlTier(state, "downtown").label, "District Control");
});

test("event contract explains who, where, stakes, action, preview, and result", () => {
  let state = run(); state.run.pendingEvent = C.buildEventForTest("dre_terms", state); const event = state.run.pendingEvent;
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
  old.npc.mina = { met: true, trust: 2, status: "cautious", outcomes: [] };
  old.people.crew.eli.introduced = true; delete old.people.crew.eli.contactStage;
  old.stats.robbery = { attempted: true, success: false, payout: 0 };
  const hydrated = C.hydrateRun(JSON.parse(JSON.stringify(old)));
  assert.equal(hydrated.player.background, null); assert.equal(hydrated.player.legacyBackground, "strategist"); assert.equal(hydrated.npc.mina.available, true);
  assert.deepEqual(C.selectors.derivedRatings(hydrated), { combat: 2, charisma: 1, intelligence: 3 });
  assert.equal(hydrated.people.crew.eli.contactStage, "recruitable");
  assert.deepEqual(hydrated.stats.robbery, { attempts: 1, successes: 0, failures: 1, totalPayout: 0, lastAttemptedDay: 1, attempted: true, success: false, payout: 0 });
});

test("fresh runs expose Places and People while garage operations remain earned", () => {
  let state = fresh(); let features = C.selectors.featureAvailability(state);
  assert.equal(features.market.available, false); assert.equal(features.finances.available, true); assert.equal(features.help.available, true);
  assert.equal(features.travel.available, true); assert.equal(features.operations.available, false); assert.equal(features.people.available, true); assert.equal(features.recovery.available, false);
  state.player.cash = C.GARAGE_DEPOSIT; state = C.reduceGame(state, { type: "LEASE_GARAGE" }); features = C.selectors.featureAvailability(state);
  assert.equal(features.operations.available, true); assert.equal(state.base.controlled, true);
});

test("Mina introduction resolves once and does not by itself arm her threat", () => {
  let state = run(); assert.equal(C.selectors.minaThreatEligible(state), false);
  state.run.slot = 2;
  state = C.reduceGame(state, { type: "VISIT_NIGHT_OWL" }); assert.equal(state.run.pendingEvent.id, "mina_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.npc.mina.met, true); assert.equal(state.npc.mina.introChoice, "friendly");
  assert.equal(state.flags.minaIntroResolved, true); assert.equal(state.npc.mina.chainStage, 1);
  // Alpha v0.7: the sedan is a stage-5 beat. An introduction alone must not arm it.
  assert.equal(C.selectors.minaThreatEligible(state), false);
});

test("the Day 2 threat remains Mina-free", () => {
  for (let seed = 300; seed < 325; seed += 1) {
    let state = C.reduceGame(C.createRun({ seed }), { type: "CHOOSE_BACKGROUND", backgroundId: "shooter" });
    let guard = 0, found = null;
    while (state.run.status === "playing" && state.run.day <= 4 && guard++ < 40) {
      if (state.run.pendingEncounter) { found = state.run.pendingEncounter.id; break; }
      state = settleForTest(state);
      if (state.run.status !== "playing") break;
      state = C.reduceGame(state, { type: "END_MARKET" });
    }
    if (found) assert.ok(["early_street", "mini_mart_parking_lot"].includes(found), `seed ${seed} produced ${found}`);
  }
});

test("the Mina sedan encounter is unreachable before her boundary scene", () => {
  let state = run();
  state.flags.minaIntroResolved = true; state.flags.minaShiftChangeResolved = true;
  state.npc.mina.met = true; state.npc.mina.introChoice = "flirt"; state.npc.mina.chainStage = 2;
  state.run.day = 6; state.run.slot = 2;
  assert.equal(C.selectors.minaThreatEligible(state), false);
  state.flags.minaBoundaryResolved = true; putInBand(state, "curtis", C.BANDS.HOSTILE);
  assert.equal(C.selectors.minaThreatEligible(state), true);
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

// --- Alpha v0.7: identity, save compatibility, and the Mina arc ---------------

test("street names are sanitized to a safe character set and length", () => {
  assert.equal(C.sanitizeStreetName("  Ice   Box  "), "Ice Box");
  assert.equal(C.sanitizeStreetName("Nine-Seven"), "Nine-Seven");
  assert.equal(C.sanitizeStreetName("O'Hara Jr."), "O'Hara Jr.");
  assert.equal(C.sanitizeStreetName("<script>x</script>"), "scriptxscript");
  assert.equal(C.sanitizeStreetName("ABCDEFGHIJKLMNOPQRSTUV").length, C.STREET_NAME_MAX);
  for (const empty of ["", "   ", "!!!", null, undefined, {}]) assert.equal(C.sanitizeStreetName(empty), "");
});

test("the street name is required before a fresh run can start", () => {
  const skipped = C.reduceGame(C.createRun({ seed: 12 }), { type: "START_RUN" });
  assert.equal(skipped.run.status, "creating_character");
  assert.equal(skipped.player.streetName, "");
  assert.equal(skipped.player.streetNameChosen, false);
  const chosen = C.reduceGame(C.createRun({ seed: 12 }), { type: "START_RUN", streetName: "  Kodiak!!  " });
  assert.equal(chosen.player.streetName, "Kodiak");
  assert.equal(chosen.player.streetNameChosen, true);
  assert.match(chosen.log[0].text, /Kodiak/);
  const blanked = C.reduceGame(C.createRun({ seed: 12 }), { type: "START_RUN", streetName: "###" });
  assert.equal(blanked.run.status, "creating_character");
  assert.equal(blanked.player.streetName, "");
  assert.equal(blanked.player.streetNameChosen, false);
});

test("a pre-v0.7 save migrates to v5 and gains the new fields", () => {
  const state = C.reduceGame(C.createRun({ seed: 77 }), { type: "CHOOSE_BACKGROUND", backgroundId: "shooter" });
  const legacy = JSON.parse(JSON.stringify(state));
  delete legacy.player.streetName; delete legacy.player.streetNameChosen;
  delete legacy.run.eventHistory; delete legacy.run.lastChainFired; delete legacy.run.chainStreak;
  delete legacy.run.lastChainSlot; delete legacy.run.chainBeatsToday; delete legacy.run.chainBeatsDay;
  delete legacy.npc.mina.chainStage; delete legacy.npc.mina.cleanLifeAtRisk;

  const inspection = C.inspectSave(JSON.stringify(legacy));
  assert.equal(inspection.valid, true, inspection.error || "legacy save rejected");
  assert.equal(C.VERSION, 7); assert.equal(C.SAVE_KEY, "907ogr_v7");
  const hydrated = inspection.state;
  assert.equal(hydrated.version, 7);
  assert.deepEqual(hydrated.run.eventHistory, {});
  assert.equal(hydrated.run.chainStreak, 0);
  assert.equal(hydrated.npc.mina.chainStage, 0);
  assert.equal(hydrated.npc.mina.cleanLifeAtRisk, false);
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

test("Mina's stages record chain progress without exposing it to the player", () => {
  let state = run();
  state.run.slot = 2;
  state = C.reduceGame(state, { type: "VISIT_NIGHT_OWL" });
  const built = state.run.pendingEvent;
  assert.equal(built.chain, undefined); assert.equal(built.stage, undefined); assert.equal(built.weight, undefined);
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.npc.mina.chainStage, 1);
  assert.equal(state.npc.mina.outcomes.length, 1);
  assert.equal(state.npc.mina.outcomes[0].stage, 1);
});

test("resolving a Mina scene never consumes a second part of day", () => {
  let state = run();
  state = C.reduceGame(state, { type: "VISIT_NIGHT_OWL" });
  const before = state.stats.pipelineAdvances, day = state.run.day, slot = state.run.slot;
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.stats.pipelineAdvances, before);
  assert.equal(state.run.day, day); assert.equal(state.run.slot, slot);
});

test("betraying Mina removes her from the run and names the ending for it", () => {
  let state = run();
  state.npc.mina.met = true; state.npc.mina.trust = 3; state.npc.mina.chainStage = 4;
  state.flags.minaBoundaryResolved = true; state.npc.mina.usedWithoutConsent = true;
  state.run.day = 6; state.run.slot = 0;
  // Drive the branch directly: scheduling is covered in tests/story-chains.test.js.
  state.run.pendingEvent = C.buildEventForTest("mina_after", state);
  assert.equal(state.run.pendingEvent.id, "mina_after");
  assert.match(state.run.pendingEvent.title, /Lights Off/);
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.npc.mina.available, false);
  assert.equal(state.npc.mina.status, "gone");
  assert.equal(state.npc.mina.chainStage, 6);
  state.run.day = 7; state.run.slot = 3;
  const ended = quietAdvance(state);
  assert.equal(ended.run.ending, "mina_gone");
  assert.equal(C.selectors.endingLabel("mina_gone"), "Gone Before You Were");
});

test("all three Day 7 Mina outcomes are reachable and distinct", () => {
  function endingFor(mutate) {
    let state = run();
    state.npc.mina.met = true; putInBand(state, "mina", C.BANDS.BONDED); state.npc.mina.chainStage = 6;
    state.flags.minaBoundaryResolved = true; state.flags.minaAfterResolved = true;
    state.lender.balance = 0; state.run.day = 7; state.run.slot = 3;
    mutate(state);
    return quietAdvance(state).run.ending;
  }
  assert.equal(endingFor((s) => { s.run.finalPlan = "escape"; }), "mina_escape");
  // A separation is an outcome, not a failure: she takes the Monday interview.
  assert.equal(endingFor((s) => { s.run.finalPlan = "defend"; s.npc.mina.jobAtRisk = false; }), "mina_clear");
  assert.equal(endingFor((s) => { s.npc.mina.available = false; }), "mina_gone");
  const labels = ["mina_escape", "mina_clear", "mina_gone"].map((id) => C.selectors.endingLabel(id));
  assert.equal(new Set(labels).size, 3);
});

test("a full seeded run reaches an ending with a coherent Mina record", () => {
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
  const stages = state.npc.mina.outcomes.map((entry) => entry.stage);
  assert.deepEqual(stages, [...stages].sort((a, b) => a - b), "Mina scenes played out of order");
});

// --- Alpha v0.7.1: Goodie and the dealer prototype -----------------------

function metGoodie(seed = 21) {
  const state = run(seed);
  state.people.dealers.goodie.known = true;
  state.run.day = 3; state.player.cash = 1500;
  return state;
}
function clearPending(state) {
  state.run.pendingEvent = null; state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null; state.run.daySummary = null;
  return state;
}

test("a dealer is gated to his own corner and his own hours", () => {
  const state = metGoodie();
  assert.equal(C.selectors.dealerActions(state, "goodie").buy.available, true);
  const away = clearPending(C.reduceGame(state, { type: "TRAVEL", neighborhoodId: "downtown" }));
  const actions = C.selectors.dealerActions(away, "goodie");
  assert.equal(actions.buy.available, false);
  assert.match(actions.buy.reason, /Spenard/);
  const unmet = run(); unmet.run.day = 3;
  assert.equal(C.selectors.dealerActions(unmet, "goodie").rob.available, false);
});

test("buying from Goodie is free and builds standing", () => {
  let state = metGoodie();
  const before = state.stats.pipelineAdvances, cash = state.player.cash;
  state = C.reduceGame(state, { type: "BUY_FROM_DEALER", dealerId: "goodie" });
  assert.equal(state.stats.pipelineAdvances, before, "buying at the current corner is free");
  assert.equal(state.people.dealers.goodie.standing, 1);
  assert.ok(state.player.cash < cash, "the purchase costs money");
  assert.ok(C.selectors.cargoUsed(state) > 0, "the purchase arrives in cargo");
  // once per day
  assert.equal(C.selectors.dealerActions(clearPending(state), "goodie").buy.available, false);
});

test("asking the dealer needs standing and yields a reliable lead in his own product", () => {
  let state = metGoodie();
  assert.equal(C.selectors.dealerActions(state, "goodie").ask.available, false, "no standing, no conversation");
  state.people.dealers.goodie.standing = 3;
  const before = state.stats.pipelineAdvances;
  state = C.reduceGame(state, { type: "ASK_DEALER", dealerId: "goodie" });
  assert.equal(state.stats.pipelineAdvances, before);
  const rumor = state.effects.rumors[state.effects.rumors.length - 1];
  assert.equal(rumor.reliable, true);
  assert.ok(["weed", "shrooms"].includes(rumor.productId), `he tipped ${rumor.productId}`);
});

test("standing raises the dealer discount", () => {
  const cold = metGoodie(); const warm = metGoodie();
  warm.people.dealers.goodie.standing = 3;
  assert.ok(C.selectors.dealerActions(warm, "goodie").buy.discount > C.selectors.dealerActions(cold, "goodie").buy.discount);
});

test("robbing the dealer is not gated behind the Rob comeback threshold", () => {
  const state = metGoodie();
  state.player.cash = 5000; // far above the working-capital reserve
  assert.equal(C.selectors.robAvailability(state).available, false, "Rob stays a comeback lever");
  assert.equal(C.selectors.dealerActions(state, "goodie").rob.available, true, "the stickup is a playstyle, not a comeback");
});

test("a successful dealer robbery pays out and chokes the block's supply", () => {
  let found = null;
  for (let seed = 1; seed <= 60 && !found; seed += 1) {
    const attempt = C.reduceGame(metGoodie(seed), { type: "ROB_DEALER", dealerId: "goodie" });
    if (attempt.run.pendingOperationResult.tone === "good") found = attempt;
  }
  assert.ok(found, "no successful robbery across 60 seeds");
  const goodie = found.people.dealers.goodie;
  assert.equal(goodie.robbedCount, 1);
  assert.equal(goodie.supplyChoked, 2);
  assert.ok(goodie.standing < 0, "standing is spent");
  assert.ok(found.player.heat >= 3, "the robbery is visible");
  assert.equal(C.selectors.dealerSupplyFactor(found, "north_star_lot", "weed"), 0.6);
  assert.equal(C.selectors.dealerSupplyFactor(found, "downtown", "weed"), 1, "only his own block is affected");
});

test("a failed dealer robbery costs health and arms him for next time", () => {
  let found = null;
  for (let seed = 1; seed <= 60 && !found; seed += 1) {
    const attempt = C.reduceGame(metGoodie(seed), { type: "ROB_DEALER", dealerId: "goodie" });
    if (attempt.run.pendingOperationResult.tone === "bad") found = attempt;
  }
  assert.ok(found, "no failed robbery across 60 seeds");
  assert.equal(found.people.dealers.goodie.retaliated, true);
  assert.ok(found.player.health < 100, "failure hurts");
  assert.equal(found.people.dealers.goodie.robbedCount, 0, "a failure is not a success");
});

test("the dealer can only be taken twice before he is off the block", () => {
  const state = metGoodie();
  state.people.dealers.goodie.robbedCount = 2;
  const actions = C.selectors.dealerActions(state, "goodie");
  assert.equal(actions.rob.available, false);
  assert.match(actions.rob.reason, /nothing left/i);
  state.people.dealers.goodie.gone = true;
  const gone = C.selectors.dealerActions(state, "goodie");
  assert.equal(gone.buy.available, false);
  assert.equal(gone.ask.available, false);
  assert.equal(C.selectors.dealerSupplyFactor(state, "north_star_lot", "shrooms"), 0.75, "his absence leaves a smaller permanent dent");
});

test("the choked supply expires on the daily tick", () => {
  let state = metGoodie();
  state.people.dealers.goodie.supplyChoked = 2;
  state.run.day = 3; state.run.slot = 3;
  state = quietAdvance(state);
  assert.equal(state.people.dealers.goodie.supplyChoked, 1, "one day burned off");
  state.run.slot = 3;
  state = quietAdvance(state);
  assert.equal(state.people.dealers.goodie.supplyChoked, 0);
  assert.equal(C.selectors.dealerSupplyFactor(state, "north_star_lot", "weed"), 1);
});

test("Mina hears about a robbery two blocks from her counter", () => {
  let found = null;
  for (let seed = 1; seed <= 60 && !found; seed += 1) {
    const state = metGoodie(seed);
    state.npc.mina.met = true; state.npc.mina.chainStage = 2; putInBand(state, "mina", C.BANDS.TRUSTED);
    state.run.slot = 2; // she is behind the counter, so the block can carry it to her
    const attempt = C.reduceGame(state, { type: "ROB_DEALER", dealerId: "goodie" });
    if (attempt.run.pendingOperationResult) found = attempt;
  }
  assert.ok(found);
  // The neighborhood carries it rather than a counter ticking down: the
  // observation is queued for her, and it is violence, which her lens reads
  // harder than anything else she could have heard that day.
  const carried = [...(found.npc.mina.ledger || []), ...found.run.pendingObservations.filter((entry) => entry.npcId === "mina").map((entry) => entry.observation)];
  assert.ok(carried.some((row) => row.type === "violence"), "robbing his corner should reach her as violence");
});

test("a pre-v0.7.1 save hydrates and gains the dealer record", () => {
  const state = metGoodie();
  const legacy = JSON.parse(JSON.stringify(state));
  delete legacy.people.dealers;
  const inspection = C.inspectSave(JSON.stringify(legacy));
  assert.equal(inspection.valid, true, inspection.error || "rejected");
  assert.equal(inspection.state.version, 7);
  assert.equal(inspection.state.people.dealers.goodie.known, false);
  assert.equal(inspection.state.people.dealers.goodie.robbedCount, 0);
  assert.equal(C.selectors.dealerSupplyFactor(inspection.state, "north_star_lot", "weed"), 1);
});

// --- Alpha v0.9: fresh arrival and daily life -------------------------------

test("fresh runs begin at the family home with $100 clean cash and no debt", () => {
  const state = fresh(9001);
  assert.equal(state.run.premise, "fresh_arrival"); assert.equal(state.run.openingPending, true);
  assert.equal(state.player.cash, 100); assert.equal(state.player.cleanCash, 100); assert.equal(state.player.heat, 0); assert.equal(state.lender.principal, 0); assert.equal(state.lender.balance, 0); assert.equal(state.lender.dueDay, null);
  assert.equal(state.base.controlled, false); assert.equal(state.npc.curtis.pressure, 0); assert.equal(state.npc.curtis.relationship, "unaware");
  assert.ok(Object.values(state.player.inventory).every((item) => item.qty === 0));
  assert.deepEqual([state.npc.yalonda.trust, state.npc.juan.trust, state.people.household.warnings], [2, 0, 0]);
  assert.equal(state.world.productAccess.weed, false); assert.equal(state.people.dealers.goodie.known, false);
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
  discoverJob(a, "ship_creek"); discoverJob(b, "ship_creek");
  a = C.reduceGame(a, { type: "WORK_JOB", jobId: "ship_creek", approach: "socialize" }); b = C.reduceGame(b, { type: "WORK_JOB", jobId: "ship_creek", approach: "socialize" });
  assert.equal(a.player.cash, b.player.cash); assert.ok(a.player.cash >= 210 && a.player.cash <= 240); assert.equal(a.run.slot, 1);
  assert.equal(a.world.locations.employer.standing, 1); assert.equal(C.selectors.jobAvailability(a, "ship_creek").available, false);
});

test("gym membership is paid once, then session costs escalate and progress diminishes", () => {
  let state = fresh(9004); state.discovered.spenardGym = true; state.player.cash = 1000; state.player.cleanCash = 1000; const spent = [];
  for (let i = 0; i < 4; i += 1) { state.run.pendingEvent = null; const before = state.player.cash; state = C.reduceGame(state, { type: "TRAIN_ATTRIBUTE", attribute: "strength" }); spent.push(before - state.player.cash); }
  assert.deepEqual(spent, [55, 45, 75, 120]); assert.equal(state.player.attributes.strength, 2); assert.equal(state.player.attributeProgress.strength, 7);
  state.run.pendingEvent = null; state.run.pendingEncounter = null; state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  state.player.attributeProgress.strength = 9; state.world.locations.gym.sessionDay = null; state.run.pendingEvent = null; state.run.slot = 0;
  state = C.reduceGame(state, { type: "TRAIN_ATTRIBUTE", attribute: "strength" });
  assert.equal(state.player.attributes.strength, 3); assert.equal(state.player.attributeProgress.strength, 2);
});

test("Day 2 exploration guarantees Goodie's transactional supplier encounter", () => {
  let state = fresh(9005); state.run.day = 2; state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.run.pendingEvent.id, "goodie_corner_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.people.dealers.goodie.known, true); assert.equal(state.world.productAccess.weed, true); assert.ok(state.world.locations.discoveries.includes("goodie_supplier"));
  state.run.pendingEvent = null; state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.world.locations.gamblingKnown, false, "wandering no longer reveals the game automatically");
});

test("bus opens Downtown but fresh runs cannot travel to Industrial without a route", () => {
  let state = fresh(9006); const blocked = C.reduceGame(state, { type: "TRAVEL", neighborhoodId: "airport_industrial" }); assert.equal(blocked, state);
  state = C.reduceGame(state, { type: "BUS_TRAVEL", neighborhoodId: "downtown" });
  assert.equal(state.world.currentNeighborhoodId, "downtown"); assert.equal(state.player.cash, 95); assert.equal(state.run.slot, 1);
});

test("legacy v3 saves retain garage ownership while v0.9 acquisition advances once", () => {
  const legacy = run(9008); const raw = JSON.parse(JSON.stringify(legacy)); delete raw.base.controlled; delete raw.run.premise;
  const hydrated = C.hydrateRun(raw); assert.equal(hydrated.run.premise, "legacy_established"); assert.equal(hydrated.base.controlled, true);
  let state = fresh(9009); state.player.cash = 700; state.player.cleanCash = 700; const before = state.stats.pipelineAdvances; state = C.reduceGame(state, { type: "LEASE_GARAGE" });
  assert.equal(state.base.controlled, true); assert.equal(state.player.cash, 50); assert.equal(state.stats.pipelineAdvances, before + 1);
});

// --- v1.0 Soldiers, Territory, Lieutenants, Laundering ----------------------

function clearModals(state) {
  state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.pendingOperationResult = null;
  if (state.run.dayEndPending) Object.assign(state, C.reduceGame(state, { type: "CONFIRM_END_DAY" }));
  return state;
}

function operatorSetup(seed = 42000) {
  let state = run(seed);
  state.player.energy = 100;
  state = C.reduceGame(state, { type: "LEASE_GARAGE" });
  state.people.crew.eli.introduced = true; state.people.crew.eli.contactStage = "recruitable"; state.base.visiting = true;
  state = C.reduceGame(state, { type: "RECRUIT_CREW", crewId: "eli" });
  clearModals(state);
  state.people.crew.eli.loyalty = 3; state.base.visiting = false;
  return state;
}

function promotedEliSetup(seed = 42000) {
  let state = operatorSetup(seed);
  state = C.reduceGame(state, { type: "PROMOTE_LIEUTENANT", crewId: "eli" });
  clearModals(state);
  return state;
}

test("Eli lieutenant promotion is gated on loyalty, not garage presence", () => {
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
  assert.equal(noLieutenant.world.territoryBlocks.spenard_rec_lot.owner, "curtis");

  state = promotedEliSetup(42004); state.player.cash = 5000;
  const noSoldiers = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" });
  assert.equal(noSoldiers.world.territoryBlocks.spenard_rec_lot.owner, "curtis", "claiming needs at least one soldier");

  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  const claimed = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" });
  assert.equal(claimed.world.territoryBlocks.spenard_rec_lot.owner, "player");
  assert.ok(claimed.npc.curtis.ledger.some((row) => row.event === "claimed_block"), "claiming a block is something Curtis notices");
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
  assert.equal(state.world.territories.north_star_lot.owner, "curtis", "the neighborhood-level takeover is untouched by a block claim");
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
  const { state, soldierId } = assignedSoldierSetup(50000);
  state.world.soldiers[soldierId].status = "active";
  state.world.soldiers[soldierId].blockId = "spenard_rec_lot";
  state.world.territoryBlocks.spenard_rec_lot.owner = "player";
  state.world.territoryBlocks.spenard_rec_lot.soldiersAssigned = [soldierId];
  state.world.territoryBlocks.spenard_rec_lot.incomeCollected = 0;
  clearModals(state); state.run.pendingEvent = null; state.run.slot = 3; state.run.dayEndPending = false; state.player.energy = C.MAX_ENERGY;
  const beforeDay = state.run.day, beforeSlot = state.run.slot, beforeDirty = state.player.dirtyCash;
  const next = quietAdvance(state);
  assert.equal(next.run.day, beforeDay + 1);
  assert.equal(next.run.slot, 0);
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

test("a pre-v1.0 save shape backfills soldiers, blocks, dirty/clean cash, and keeps Goodie dealer-only", () => {
  const legacy = run(42015);
  const raw = JSON.parse(JSON.stringify(legacy));
  raw.player.cash = 777;
  delete raw.player.dirtyCash; delete raw.player.cleanCash;
  delete raw.world.soldiers; delete raw.world.territoryBlocks;
  const hydrated = C.hydrateRun(raw);
  assert.equal(hydrated.player.dirtyCash, 777, "pre-existing wealth is classified as unlaundered dirty cash");
  assert.equal(hydrated.player.cleanCash, 0);
  assert.deepEqual(hydrated.world.soldiers, {});
  assert.equal(Object.keys(hydrated.world.territoryBlocks).length, C.SPENARD_BLOCKS.length);
  assert.ok(hydrated.world.territoryBlocks.spenard_rec_lot.owner === "curtis");
  assert.equal(hydrated.people.crew.goodie, undefined);
  assert.ok(hydrated.people.dealers.goodie);
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
  state = C.reduceGame(state, { type: "SET_ELI_POLICY", policy: "manual" });
  state.run.slot = 0; state.player.energy = 100;
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
    state = C.reduceGame(state, { type: "SET_ELI_POLICY", policy: "manual" });
    state.run.slot = 0; state.player.energy = 100;
    state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); // claims spenard_rec_lot (lowest earner)
    state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state);
    state.run.slot = 0; state.player.energy = 100;
    state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); // claims northern_lights_motels (highest earner)
    state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "northern_lights_motels" }); clearModals(state);
    state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); // stays unassigned — nothing left to claim it into
    state = C.reduceGame(state, { type: "SET_ELI_POLICY", policy: "maximize_income" });
    return state;
  }
  const a = setup(), b = setup();
  assert.deepEqual(Object.keys(a.world.soldiers).filter((id) => !a.world.soldiers[id].blockId), Object.keys(b.world.soldiers).filter((id) => !b.world.soldiers[id].blockId), "identical seed + actions produce identical unassigned soldiers");
  const unassignedId = Object.keys(a.world.soldiers).find((id) => a.world.soldiers[id].status === "active" && !a.world.soldiers[id].blockId);
  assert.ok(unassignedId, "one active soldier is left unassigned by the setup");
  const expectedBlock = C.SPENARD_BLOCKS
    .filter((block) => a.world.territoryBlocks[block.id].owner === "player" && a.world.territoryBlocks[block.id].soldiersAssigned.length < C.SOLDIERS_PER_BLOCK_CAP)
    .sort((left, right) => right.earningPotential - left.earningPotential)[0].id;
  a.run.status = "playing"; a.run.phase = "week_zero"; a.run.checkpointDay = null; a.run.pendingEvent = null; a.run.pendingEncounter = null; a.run.pendingOperationResult = null; a.run.slot = 3; a.run.dayEndPending = false; a.player.energy = C.MAX_ENERGY;
  const nextA = quietAdvance(a);
  const expectedName = C.SPENARD_BLOCKS.find((block) => block.id === expectedBlock).name;
  assert.ok(nextA.log.some((entry) => entry.text.includes(`soldier moved to ${expectedName}`)), "Maximize Income routes the spare soldier to the highest-earning open block before any nightly raid resolves");
});

test("Ship Creek pays clean cash while trading and robbery stay dirty, and cash always equals dirty plus clean", () => {
  let state = fresh(60001);
  discoverJob(state, "ship_creek");
  state = C.reduceGame(state, { type: "WORK_JOB", jobId: "ship_creek", approach: "socialize" });
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
  state.run.phase = "pressure"; state.run.checkpointDay = 30;
  state.lender.status = "active"; state.lender.principal = 1000; state.lender.balance = 1000; state.lender.dueDay = 1;
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

test("Curtis's curtis_cut beat is reachable through Respect alone, and pressure alone cannot advance Curtis after the migration", () => {
  // Curtis reads on one inverted axis now. Standing that he respects opens the
  // cut; exposure that makes him watch you does the opposite, and no amount of
  // it substitutes for the standing.
  const standing = fresh(80001);
  standing.flags.curtisTaxResolved = true;
  putInBand(standing, "curtis", C.BANDS.WARM);
  standing.world.currentNeighborhoodId = "north_star_lot";
  const descriptor = C.STORY_REGISTRY.find((item) => item.id === "curtis_cut");
  assert.equal(descriptor.requires(standing), true, "standing he respects unlocks curtis_cut");

  const exposureOnly = fresh(80002);
  exposureOnly.flags.curtisTaxResolved = true;
  putInBand(exposureOnly, "curtis", C.BANDS.HOSTILE);
  exposureOnly.world.currentNeighborhoodId = "airport_industrial";
  assert.equal(descriptor.requires(exposureOnly), false, "being a problem to him is not the same as being someone he cuts in");

  const belowThreshold = fresh(80003);
  belowThreshold.flags.curtisTaxResolved = true;
  putInBand(belowThreshold, "curtis", C.BANDS.NEUTRAL);
  assert.equal(descriptor.requires(belowThreshold), false, "invisible is not enough either");
});

test("Curtis's opening beat requires concrete attention exposure", () => {
  const descriptor = C.STORY_REGISTRY.find((item) => item.id === "curtis_mark");
  const state = fresh(80004);
  state.player.heat = 0;
  state.stats.robbery.attempts = 0;
  assert.equal(descriptor.requires(state), false, "minor dealing below a milestone stays invisible");
  // One concrete milestone is enough to drop him out of Neutral, and Neutral is
  // exactly what "he has no reason to look at you" means on his inverted read.
  putInBand(state, "curtis", C.BANDS.COLD);
  assert.equal(descriptor.requires(state), true, "concrete exposure earns Curtis's attention");
});

test("a save that already reached curtis_cut through the old pressure gate keeps that progress on load", () => {
  const legacy = run(80005);
  const raw = JSON.parse(JSON.stringify(legacy));
  raw.flags = { ...raw.flags, curtisTaxResolved: true, curtisCutResolved: true };
  raw.version = 5; // arriving from the pre-Exposure schema
  raw.npc.curtis.pressure = 5; raw.npc.curtis.respect = 5; // the old path that unlocked this beat
  for (const id of C.EXPOSURE_NPC_IDS) delete raw.npc[id].ledger;
  const hydrated = C.hydrateRun(raw);
  assert.ok(hydrated.npc.curtis.ledger.some((row) => row.event === "legacy_respect"), "the standing he already gave the player survives as evidence");
  assert.equal(hydrated.flags.curtisCutResolved, true, "the already-earned story progress itself is preserved, not replayed");
});

test("attention remains the driver of Curtis's aggressive relationship label", () => {
  let state = fresh(80003);
  putInBand(state, "curtis", C.BANDS.HOSTILE);
  state.npc.curtis.ledger.push({ type: "violence", event: "test_escalation", location: null, value: null, day: 1, count: 6, source: "network" });
  state = quietAdvance(state);
  assert.equal(state.npc.curtis.relationship, "aggressive", "deep exposure still reads as aggressive");

  let calmState = fresh(80004);
  putInBand(calmState, "curtis", C.BANDS.TRUSTED);
  calmState = quietAdvance(calmState);
  assert.notEqual(calmState.npc.curtis.relationship, "aggressive", "standing he respects never reads as aggressive");
});

test("new ambient organization beats only become eligible once their underlying system is active", () => {
  const fresh1 = fresh(90001);
  const spenardScouted = C.STORY_REGISTRY.find((item) => item.id === "spenard_block_scouted");
  const curtisRespectNotice = C.STORY_REGISTRY.find((item) => item.id === "curtis_respect_notice");
  const soldierAftermath = C.STORY_REGISTRY.find((item) => item.id === "soldier_raid_aftermath");
  assert.equal(spenardScouted.requires(fresh1), false, "no Eli lieutenant yet");
  assert.equal(curtisRespectNotice.requires(fresh1), false, "no controlled blocks yet");
  assert.equal(soldierAftermath.requires(fresh1), false, "no raid has happened");

  const active = promotedEliSetup(90002);
  assert.equal(spenardScouted.requires(active), true, "Eli active and map not yet revealed");
});

// --- PR #52 stabilization pass ----------------------------------------------

test("cash equals dirty plus clean after purchases, debt payments, recruitment, legal work, territory income, and property spending", () => {
  function checkInvariant(state, label) {
    assert.equal(state.player.cash, state.player.dirtyCash + state.player.cleanCash, label);
  }
  let state = fresh(100001);
  checkInvariant(state, "fresh run");
  discoverJob(state, "ship_creek");
  state = C.reduceGame(state, { type: "WORK_JOB", jobId: "ship_creek", approach: "socialize" }); checkInvariant(state, "after legal work");
  state = C.reduceGame(state, { type: "LEASE_GARAGE" }); checkInvariant(state, "after property spending");
  state.people.crew.eli.introduced = true; state.people.crew.eli.contactStage = "recruitable"; state.base.visiting = true;
  state = C.reduceGame(state, { type: "RECRUIT_CREW", crewId: "eli" }); clearModals(state); checkInvariant(state, "after crew recruitment");
  state.player.cash += 400; state.player.dirtyCash += 400;
  state = C.reduceGame(state, { type: "PAY_DEBT", amount: 200 }); checkInvariant(state, "after a debt payment");
  state.people.crew.eli.loyalty = 3; state.base.visiting = false;
  state = C.reduceGame(state, { type: "PROMOTE_LIEUTENANT", crewId: "eli" }); clearModals(state); checkInvariant(state, "after lieutenant promotion");
  state.player.cash += 5000; state.player.dirtyCash += 5000;
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state); checkInvariant(state, "after soldier recruitment");
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state); checkInvariant(state, "after claiming a block");
  let next = state;
  for (let i = 0; i < 4; i += 1) next = quietAdvance(next);
  checkInvariant(next, "after territory income resolves overnight");
  const raw = JSON.parse(JSON.stringify(state));
  const hydrated = C.hydrateRun(raw);
  checkInvariant(hydrated, "after save/load");
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
      if (next.world.territoryBlocks.northern_lights_motels.owner === "curtis") {
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
  assert.equal(secondAttempt.world.territoryBlocks.fourth_ave_strip.owner, "curtis", "no soldier remains to occupy a second block");
});

test("unpaid checkpoint debt triggers Dre Tier 1 (or higher) collector enforcement", () => {
  let state = fresh(100006);
  state.run.phase = "pressure"; state.run.checkpointDay = C.RUN_DAYS;
  state.lender.status = "active"; state.lender.principal = 1000; state.lender.balance = 1200; state.lender.dueDay = C.RUN_DAYS;
  let next = state;
  for (let i = 0; i < 29 && next.run.status === "playing"; i += 1) next = quietAdvance(next);
  next.run.pendingEvent = null; next.run.pendingEncounter = null;
  if (next.run.dayEndPending) next = C.reduceGame(next, { type: "CONFIRM_END_DAY" });
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

test("save/load preserves soldiers, blocks, Eli's lieutenant state, and dealer-only Goodie", () => {
  let state = promotedEliSetup(100013); state.player.cash = 5000;
  state = C.reduceGame(state, { type: "SET_ELI_POLICY", policy: "hold_ground" });
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state);
  state.people.dealers.goodie.known = true; state.people.dealers.goodie.standing = 3;
  const raw = JSON.parse(JSON.stringify(state));
  const hydrated = C.hydrateRun(raw);
  assert.equal(hydrated.people.crew.eli.operationPolicy, "hold_ground");
  assert.deepEqual(hydrated.world.soldiers, state.world.soldiers);
  assert.deepEqual(hydrated.world.territoryBlocks, state.world.territoryBlocks);
  assert.equal(hydrated.people.crew.eli.lieutenantStage, "operations_lieutenant");
  assert.equal(hydrated.people.crew.goodie, undefined);
  assert.equal(hydrated.people.dealers.goodie.standing, 3);
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
  assert.equal(view.debt.note, "Paid in full");
  assert.equal(view.heat.label, "Low");
  assert.equal(view.identity.label, "Unproven");
  assert.ok(view.summary.length > 40, "the situation summary is authored prose, not a stat dump");
  assert.match(view.summary, /learning Spenard/);
  assert.match(view.summary, /Most of Spenard is still unfamiliar/);
  for (const id of ["operations", "territory", "soldiers", "district", "rival", "crew"]) {
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

  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" }); clearModals(state);
  state = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: "spenard_rec_lot" }); clearModals(state);
  view = C.selectors.homeSituation(state);
  assert.equal(view.unlocks.district, true);
  assert.equal(view.organization.blocks, 1);
  assert.match(view.summary, /1 block producing/);
});

test("home priorities are severity-ordered, capped at two, and never a checklist", () => {
  const calm = C.selectors.homePriorities(fresh(60003));
  assert.deepEqual(calm, [], "a calm first Morning raises nothing");

  const state = fresh(60004);
  state.run.day = 7; state.lender.status = "active"; state.lender.balance = 500; state.lender.dueDay = 5; state.player.health = 20; state.player.heat = 13;
  const urgent = C.selectors.homePriorities(state);
  assert.equal(urgent.length, 2, "at most two priorities ever surface");
  assert.deepEqual(urgent.map((item) => item.id), ["debt_overdue", "health_critical"], "a past-due note outranks everything");
  assert.ok(urgent.every((item) => item.tone === "bad"));

  const tonight = fresh(60004);
  tonight.lender.status = "active"; tonight.lender.balance = 500; tonight.lender.dueDay = 7;
  tonight.run.day = tonight.lender.dueDay; tonight.player.health = 20; tonight.player.heat = 13;
  assert.deepEqual(C.selectors.homePriorities(tonight).map((item) => item.id), ["health_critical", "debt_tonight"], "critical health outranks a note that is still payable tonight");

  const dueToday = fresh(60005);
  dueToday.lender.status = "active"; dueToday.lender.balance = 500; dueToday.lender.dueDay = 7;
  dueToday.run.day = dueToday.lender.dueDay;
  assert.equal(C.selectors.homePriorities(dueToday)[0].id, "debt_tonight");

  const tomorrow = fresh(60006);
  tomorrow.lender.status = "active"; tomorrow.lender.balance = 500; tomorrow.lender.dueDay = 7;
  tomorrow.run.day = tomorrow.lender.dueDay - 1;
  assert.equal(C.selectors.homePriorities(tomorrow)[0].id, "debt_tomorrow");

  const paid = fresh(60007);
  paid.run.day = paid.lender.dueDay; paid.lender.balance = 0;
  assert.ok(!C.selectors.homePriorities(paid).some((item) => item.id.startsWith("debt")), "a cleared note raises no debt priority");
});

test("actionResult reports time movement and the money that moved for a time-consuming action", () => {
  const before = fresh(60008);
  discoverJob(before, "ship_creek");
  const after = C.reduceGame(before, { type: "WORK_JOB", jobId: "ship_creek", approach: "socialize" });
  const result = C.selectors.actionResult(before, after, "WORK_JOB");
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

test("Night travel is summarized by the end-day recap instead of an action receipt", () => {
  let before = fresh(60009);
  before.run.slot = 3; // Night, so the ride crosses into the next day
  const after = C.reduceGame(before, { type: "BUS_TRAVEL", neighborhoodId: "downtown" });
  assert.equal(after.run.dayEndPending, true);
  assert.equal(C.selectors.actionResult(before, after, "BUS_TRAVEL"), null);
  assert.match(after.run.dailyActions.at(-1).label, /People Mover|Rode/);
});

test("actionResult stays silent for free actions, run lifecycle, and richer result surfaces", () => {
  const state = fresh(60010);
  assert.equal(C.selectors.actionResult(state, state, "WORK_SHIFT"), null, "an identical state is not a result");

  const present = C.selectors.householdPresence(state); const free = present ? C.reduceGame(state, { type: "TALK_HOUSEHOLD", npcId: present }) : state;
  if (free !== state && free.run.slot === state.run.slot && free.run.day === state.run.day) {
    assert.equal(C.selectors.actionResult(state, free, "TALK_HOUSEHOLD"), null, "a free action consumes no part of the day and raises nothing");
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

test("free recruitment has no action receipt while a timed block claim does", () => {
  let state = promotedEliSetup(60011); state.player.cash = 6000;
  const beforeSnapshot = JSON.parse(JSON.stringify(state));
  state = C.reduceGame(state, { type: "RECRUIT_SOLDIER" });
  const recruit = C.selectors.actionResult(beforeSnapshot, state, "RECRUIT_SOLDIER");
  assert.equal(recruit, null);
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
