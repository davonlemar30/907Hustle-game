const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

function fresh(seed = 907) {
  return C.reduceGame(C.createRun({ seed }), { type: "START_RUN" });
}

function meetKip(seed = 907) {
  let state = fresh(seed);
  state.run.day = 2;
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.run.pendingEvent?.id, "kip_corner_intro");
  return C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
}

function stock(state, productId, amount = 50) {
  state.player.cash = 10000;
  state.player.dirtyCash = 10000;
  state.player.cleanCash = 0;
  state.world.markets[state.world.currentNeighborhoodId].availability[productId] = amount;
  return state;
}

test("Market tab and market actions stay hidden until a plug is unlocked", () => {
  const state = fresh();
  assert.equal(state.market.visible, false);
  assert.equal(C.selectors.featureAvailability(state).market.available, false);
  assert.deepEqual(C.selectors.visibleMarketProducts(state), []);
  assert.equal(C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 }), state);
  const ui = fs.readFileSync(path.join(__dirname, "..", "ui.jsx"), "utf8");
  assert.match(ui, /id !== "market" \|\| marketVisible/);
});

test("Day 2 Spenard exploration offers one short transactional Kip encounter", () => {
  let state = fresh();
  state.run.day = 1;
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.notEqual(state.run.pendingEvent?.id, "kip_corner_intro");
  state.run.pendingEvent = null; state.run.day = 2;
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.run.pendingEvent.id, "kip_corner_intro");
  assert.ok(state.run.pendingEvent.description.trim().split(/\s+/).length < 40);
  assert.deepEqual(state.run.pendingEvent.choices.map((choice) => choice.label), ["Accept", "Decline"]);
});

test("accepting Kip reveals the Market and weed only", () => {
  const state = meetKip();
  assert.equal(state.market.visible, true);
  assert.deepEqual(state.plugs.unlocked, ["kip"]);
  assert.deepEqual(C.selectors.visibleMarketProducts(state).map((product) => product.id), ["weed"]);
});

test("plug standing increases once per day and unlocks products at threshold", () => {
  let state = stock(meetKip(), "weed");
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  assert.equal(state.plugs.records.kip.standing, 1);
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  assert.equal(state.plugs.records.kip.standing, 1, "a second same-day purchase gives no standing");
  state.run.day += 1;
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  assert.equal(state.plugs.records.kip.standing, 2);
  assert.deepEqual(C.selectors.visibleMarketProducts(state).map((product) => product.id), ["weed", "shrooms"]);
  assert.ok(state.log.some((entry) => entry.text === "Kip says he can get you shrooms now too."));
});

test("standing four triggers the next plug introduction and reveals that plug's products", () => {
  let state = stock(meetKip(), "weed");
  state.plugs.records.kip.standing = 3;
  state.people.dealers.kip.standing = 3;
  state.plugs.records.kip.lastPurchaseDay = state.run.day - 1;
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  assert.equal(state.plugs.records.kip.standing, 4);
  assert.equal(state.run.pendingEvent?.id, "tasha_plug_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.deepEqual(state.plugs.unlocked, ["kip", "tasha"]);
  assert.deepEqual(C.selectors.visibleMarketProducts(state).map((product) => product.id), ["weed", "shrooms", "pills", "lean"]);
});

test("robbing Kip never reveals products from a locked plug", () => {
  let state = meetKip(22);
  state.player.cash = 5000;
  state.run.pendingEvent = null;
  state = C.reduceGame(state, { type: "ROB_DEALER", dealerId: "kip" });
  assert.deepEqual(state.plugs.unlocked, ["kip"]);
  assert.ok(state.plugs.records.kip.standing < 0);
  assert.deepEqual(C.selectors.visibleMarketProducts(state).map((product) => product.id), ["weed"]);
  assert.equal(state.world.productAccess.pills, false);
  assert.equal(state.world.productAccess.coke, false);
});
