const test = require("node:test");
const assert = require("node:assert/strict");
const GameCore = require("../game-core.js");

function clearInterruptions(state) {
  const next = JSON.parse(JSON.stringify(state));
  next.run.pendingEvent = null;
  next.run.daySummary = null;
  return next;
}

test("seeded runs are reproducible", () => {
  assert.deepEqual(GameCore.createRun({ seed: 907 }), GameCore.createRun({ seed: 907 }));
  assert.notDeepEqual(GameCore.createRun({ seed: 907 }), GameCore.createRun({ seed: 908 }));
});

test("buy and sell stay inside a market visit", () => {
  let state = GameCore.createRun({ seed: 907 });
  const before = { day: state.run.day, slot: state.run.slot, advances: state.stats.pipelineAdvances };
  const price = state.world.markets.north_star_lot.prices.weed;
  state = GameCore.reduceGame(state, { type: "BUY", productId: "weed", qty: 2 });
  assert.equal(state.run.day, before.day);
  assert.equal(state.run.slot, before.slot);
  assert.equal(state.stats.pipelineAdvances, before.advances);
  assert.equal(state.player.cash, 350 - price * 2);
  assert.equal(state.run.currentVisit.trades, 1);
  state = GameCore.reduceGame(state, { type: "SELL", productId: "weed", qty: 1 });
  assert.equal(state.run.slot, before.slot);
  assert.equal(state.run.currentVisit.trades, 2);
});

test("ending a market visit advances once and updates every market", () => {
  let state = GameCore.createRun({ seed: 22 });
  const before = Object.fromEntries(GameCore.NEIGHBORHOODS.map((area) => [area.id, { ...state.world.markets[area.id].prices }]));
  state = GameCore.reduceGame(state, { type: "END_MARKET" });
  assert.equal(state.run.slot, 1);
  assert.equal(state.stats.pipelineAdvances, 1);
  assert.equal(state.stats.marketUpdates, 1);
  for (const area of GameCore.NEIGHBORHOODS) {
    assert.equal(state.world.markets[area.id].updatedAt, 1);
    assert.notDeepEqual(state.world.markets[area.id].prices, before[area.id]);
  }
});

test("all consuming actions route through the pipeline exactly once", () => {
  const cases = [
    [{ type: "END_MARKET" }, null],
    [{ type: "LAY_LOW" }, null],
    [{ type: "TRAVEL", neighborhoodId: "downtown" }, null],
    [{ type: "HEAL", amount: 20, cost: 25 }, (s) => { s.player.health = 70; }],
    [{ type: "PAY_DEBT", amount: 40 }, null],
    [{ type: "BANK", amount: 40 }, null],
    [{ type: "UNBANK", amount: 40 }, (s) => { s.player.banked = 50; }],
    [{ type: "VISIT_SOCIAL" }, null],
  ];
  for (const [action, prepare] of cases) {
    let state = GameCore.createRun({ seed: 500 });
    if (prepare) prepare(state);
    const next = GameCore.reduceGame(state, action);
    assert.equal(next.stats.pipelineAdvances, 1, action.type);
  }
});

test("invalid consuming actions do not advance", () => {
  const state = GameCore.createRun({ seed: 40 });
  const invalid = [
    { type: "TRAVEL", neighborhoodId: "north_star_lot" },
    { type: "HEAL", amount: 20, cost: 25 },
    { type: "PAY_DEBT", amount: 9999 },
    { type: "BANK", amount: 9999 },
    { type: "UNBANK", amount: 10 },
  ];
  for (const action of invalid) {
    const next = GameCore.reduceGame(state, action);
    assert.equal(next.stats.pipelineAdvances, 0, action.type);
  }
});

test("four advances roll into the next day with a summary", () => {
  let state = GameCore.createRun({ seed: 101 });
  for (let i = 0; i < 4; i += 1) {
    state = clearInterruptions(GameCore.reduceGame(state, { type: "END_MARKET" }));
  }
  assert.equal(state.run.day, 2);
  assert.equal(state.run.slot, 0);
  assert.equal(state.stats.pipelineAdvances, 4);
});

test("Day 7 Night ends without exposing Day 8", () => {
  let state = GameCore.createRun({ seed: 1 });
  state.run.day = 7;
  state.run.slot = 3;
  state.player.heat = 1;
  state.rival.pressure = 1;
  state = GameCore.reduceGame(state, { type: "END_MARKET" });
  assert.equal(state.run.status, "ended");
  assert.equal(state.run.day, 7);
  assert.equal(state.run.slot, 3);
  assert.ok(state.run.ending);
});

test("net worth subtracts debt and includes local liquidation value", () => {
  const state = GameCore.createRun({ seed: 9 });
  const market = state.world.markets[state.world.currentNeighborhoodId];
  state.player.inventory.weed.qty = 2;
  assert.equal(
    GameCore.selectors.netWorth(state),
    state.player.cash + state.player.banked + market.prices.weed * 2 - state.lender.balance,
  );
});

test("event resolution never advances time a second time", () => {
  let state = GameCore.createRun({ seed: 7 });
  state.run.pendingEvent = {
    id: "test", title: "Test", description: "Test",
    choices: [{ label: "Choose", effect: { cash: 5 }, result: "Done" }],
  };
  const before = state.stats.pipelineAdvances;
  state = GameCore.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.stats.pipelineAdvances, before);
  assert.equal(state.run.pendingEvent, null);
});

test("prices remain inside configured bounds over a full run", () => {
  let state = GameCore.createRun({ seed: 1234 });
  for (let i = 0; i < 27 && state.run.status === "playing"; i += 1) {
    state = GameCore.reduceGame(clearInterruptions(state), { type: "END_MARKET" });
  }
  for (const area of GameCore.NEIGHBORHOODS) {
    for (const product of GameCore.PRODUCTS) {
      const price = state.world.markets[area.id].prices[product.id];
      assert.ok(price >= product.min * 0.72, `${area.id}/${product.id} lower bound`);
      assert.ok(price <= product.max * 1.2, `${area.id}/${product.id} upper bound`);
    }
  }
});

test("banking moves money once and never creates interest", () => {
  let state = GameCore.createRun({ seed: 55 });
  state = GameCore.reduceGame(state, { type: "BANK", amount: 100 });
  assert.equal(state.player.cash, 250);
  assert.equal(state.player.banked, 100);
  state = clearInterruptions(state);
  state = GameCore.reduceGame(state, { type: "UNBANK", amount: 40 });
  assert.equal(state.player.cash, 290);
  assert.equal(state.player.banked, 60);
});

test("crossing the overdue deadline applies one lender penalty", () => {
  let state = GameCore.createRun({ seed: 91 });
  state.run.day = 4;
  state.run.slot = 3;
  const heatBefore = state.player.heat;
  state = GameCore.reduceGame(state, { type: "END_MARKET" });
  assert.equal(state.run.day, 5);
  assert.equal(state.lender.balance, 518);
  assert.equal(state.lender.lastPenaltyDay, 5);
  assert.equal(state.player.heat, heatBefore + 1);
  assert.equal(state.lender.relationship, "demanding");
  assert.equal(state.lender.feesAdded, 38);
  assert.deepEqual(state.lender.penaltyHistory, [{ day: 5, slot: 0, amount: 38 }]);
});

test("loan details record partial payments and the payoff moment", () => {
  let state = GameCore.createRun({ seed: 907 });
  state.player.cash = 700;
  state = GameCore.reduceGame(state, { type: "PAY_DEBT", amount: 180 });
  state = clearInterruptions(state);
  state = GameCore.reduceGame(state, { type: "PAY_DEBT", amount: 300 });
  const details = GameCore.selectors.loanDetails(state);
  assert.equal(state.lender.balance, 0);
  assert.equal(details.principal, 480);
  assert.equal(details.repaid, 480);
  assert.equal(details.paymentCount, 2);
  assert.deepEqual(details.paymentHistory.map((entry) => entry.amount), [180, 300]);
  assert.deepEqual(details.clearedAt, { day: 1, slot: 1 });
});

test("additive loan ledger fields hydrate safely from an earlier One Good Run save", () => {
  const state = GameCore.createRun({ seed: 12 });
  delete state.lender.principal;
  delete state.lender.feesAdded;
  delete state.lender.paymentCount;
  delete state.lender.paymentHistory;
  delete state.lender.penaltyHistory;
  delete state.lender.clearedAt;
  const next = GameCore.reduceGame(state, { type: "PAY_DEBT", amount: 40 });
  const details = GameCore.selectors.loanDetails(next);
  assert.equal(details.principal, 480);
  assert.equal(details.repaid, 40);
  assert.equal(details.paymentCount, 1);
  assert.equal(details.paymentHistory[0].amount, 40);
});

test("expired modifiers are removed by the unified pipeline", () => {
  let state = GameCore.createRun({ seed: 77 });
  state.effects.modifiers.push({ areaId: "downtown", productId: "cocaine", multiplier: 2, expiresAt: 0 });
  state = GameCore.reduceGame(state, { type: "END_MARKET" });
  assert.equal(state.effects.modifiers.length, 0);
});

test("critical heat produces an early Caught ending", () => {
  let state = GameCore.createRun({ seed: 81 });
  state.player.heat = 14;
  state = GameCore.reduceGame(state, { type: "TRAVEL", neighborhoodId: "downtown" });
  assert.equal(state.run.status, "ended");
  assert.equal(state.run.ending, "caught");
});

test("a strong debt-free final slot earns One Good Run", () => {
  let state = GameCore.createRun({ seed: 82 });
  state.run.day = 7;
  state.run.slot = 3;
  state.lender.balance = 0;
  state.player.cash = 800;
  state.player.heat = 2;
  state = GameCore.reduceGame(state, { type: "END_MARKET" });
  assert.equal(state.run.ending, "one_good_run");
});

test("neighborhood product identities remain statistically distinct", () => {
  let homeCocaine = 0;
  let downtownCocaine = 0;
  let homeMeth = 0;
  let outerMeth = 0;
  for (let seed = 1; seed <= 100; seed += 1) {
    const state = GameCore.createRun({ seed });
    homeCocaine += state.world.markets.north_star_lot.prices.cocaine;
    downtownCocaine += state.world.markets.downtown.prices.cocaine;
    homeMeth += state.world.markets.north_star_lot.prices.meth;
    outerMeth += state.world.markets.airport_industrial.prices.meth;
  }
  assert.ok(downtownCocaine > homeCocaine * 1.2);
  assert.ok(outerMeth > homeMeth * 1.35);
});
