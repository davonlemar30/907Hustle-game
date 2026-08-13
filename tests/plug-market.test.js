const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const root = path.join(__dirname, "..");

function fresh(seed = 907) {
  return C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Rookie" });
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
  const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
  assert.match(ui, /id !== "market" \|\| marketVisible/);
});

test("v1.1 shell passes market visibility through the icon nav and keeps hidden travel on Travel", () => {
  const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");
  assert.match(ui, /<Navigation tab=\{tab\} setTab=\{setTab\} features=\{features\} marketVisible=\{state\.market\.visible\}/);
  assert.match(ui, /setTab\(state\.market\.visible \? "market" : "travel"\)/);
  assert.match(css, /\.nav\.market-hidden\{grid-template-columns:repeat\(4,1fr\)\}/);
});

test("pre-market v1.1 copy does not teach or advertise the hidden drug market", () => {
  const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
  assert.doesNotMatch(ui, /market trading remains the stronger long-term plan/);
  assert.doesNotMatch(ui, /Trading inside an open market visit costs no time/);
  assert.match(ui, /legal work remains the safer long-term plan/);
  assert.match(ui, /Jobs, wandering, and people you meet through work/);
  assert.match(ui, /\{marketVisible && <div className="card"><h2>Market visits<\/h2>/);
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

test("linear introductions continue from Tasha to Malik in order", () => {
  let state = stock(meetKip(), "weed");
  state.plugs.records.kip.standing = 3;
  state.people.dealers.kip.standing = 3;
  state.plugs.records.kip.lastPurchaseDay = state.run.day - 1;
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  stock(state, "pills");
  state.plugs.records.tasha.standing = 3;
  state.plugs.records.tasha.lastPurchaseDay = state.run.day - 1;
  state = C.reduceGame(state, { type: "BUY", productId: "pills", qty: 1 });
  assert.equal(state.run.pendingEvent?.id, "malik_plug_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.deepEqual(state.plugs.unlocked, ["kip", "tasha", "malik"]);
  assert.deepEqual(C.selectors.visibleMarketProducts(state).map((product) => product.id), ["weed", "shrooms", "pills", "lean", "coke", "molly"]);
});

test("each plug enforces its purchase limit and Malik earns bulk pricing at standing three", () => {
  let state = stock(meetKip(), "weed");
  assert.equal(C.selectors.plugMaxUnits(state, "weed"), 3);
  assert.equal(C.reduceGame(state, { type: "BUY", productId: "weed", qty: 4 }), state);

  state.plugs.unlocked.push("tasha", "malik");
  for (const id of ["tasha", "malik"]) for (const product of C.PLUGS.find((plug) => plug.id === id).products) state.world.productAccess[product.id] = true;
  stock(state, "pills"); stock(state, "coke");
  assert.equal(C.selectors.plugMaxUnits(state, "pills"), 5);
  assert.equal(C.reduceGame(state, { type: "BUY", productId: "pills", qty: 6 }), state);
  assert.equal(C.selectors.plugMaxUnits(state, "coke"), 8);
  assert.equal(C.reduceGame(state, { type: "BUY", productId: "coke", qty: 9 }), state);

  state.plugs.records.malik.standing = 2;
  const regular = C.selectors.tradeProjection(state, "coke", 5, "buy").unitPrice;
  state.plugs.records.malik.standing = 3;
  const bulk = C.selectors.tradeProjection(state, "coke", 5, "buy").unitPrice;
  assert.ok(bulk < regular);
});

test("save hydration rebuilds market visibility and product access from plug state", () => {
  const state = meetKip();
  state.plugs.records.kip.standing = 2;
  state.market.visible = false;
  state.world.productAccess.weed = false;
  state.world.productAccess.shrooms = false;
  const hydrated = C.hydrateRun(JSON.parse(C.serializeRun(state)));
  assert.equal(hydrated.market.visible, true);
  assert.deepEqual(hydrated.plugs.unlocked, ["kip"]);
  assert.equal(hydrated.plugs.records.kip.standing, 2);
  assert.deepEqual(C.selectors.visibleMarketProducts(hydrated).map((product) => product.id), ["weed", "shrooms"]);
});

test("Kip's encounter fires exactly once even when the first offer is declined", () => {
  let state = fresh(919);
  state.run.day = 2;
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.run.pendingEvent?.id, "kip_corner_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 1 });
  assert.equal(state.flags.kipEncounterSeen, true);
  for (let index = 0; index < 3; index += 1) {
    state.run.pendingEvent = null;
    state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
    assert.notEqual(state.run.pendingEvent?.id, "kip_corner_intro");
  }
  assert.equal(state.market.visible, false);
});

test("buying directly from Kip cannot bypass the shrooms standing threshold", () => {
  let state = stock(meetKip(922), "weed");
  state.world.markets[state.world.currentNeighborhoodId].availability.shrooms = 50;
  state = C.reduceGame(state, { type: "BUY_FROM_DEALER", dealerId: "kip" });
  assert.ok(state.player.inventory.weed.qty > 0);
  assert.equal(state.player.inventory.shrooms.qty, 0);
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
