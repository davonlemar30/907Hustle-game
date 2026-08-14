const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const root = path.join(__dirname, "..");

function fresh(seed = 907) {
  return C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Rookie" });
}

function meetGoodie(seed = 907) {
  let state = fresh(seed);
  state.run.day = 2;
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.run.pendingEvent?.id, "goodie_corner_intro");
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
  assert.match(ui, /function HustleScreen/);
  assert.match(ui, /A discovered street market remains available through Street/);
});

test("v1.8 shell keeps market in Hustle while Street preserves the first-sale route", () => {
  const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");
  assert.match(ui, /<Navigation tab=\{tab\} setTab=\{setTab\} hustleVisible=\{state\.hustle\.visible\}/);
  assert.match(ui, /title="Street Market"/);
  assert.match(css, /\.nav/);
});

test("pre-market v1.1 copy does not teach or advertise the hidden drug market", () => {
  const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
  assert.doesNotMatch(ui, /market trading remains the stronger long-term plan/);
  assert.doesNotMatch(ui, /Trading inside an open market visit costs no time/);
  assert.match(ui, /legal work remains the safer long-term plan/);
  assert.match(ui, /Jobs, wandering, and people you meet through work/);
  assert.match(ui, /\{marketVisible && <div className="card"><h2>Market visits<\/h2>/);
});

test("Day 2 Spenard exploration offers one short transactional Goodie encounter", () => {
  let state = fresh();
  state.run.day = 1;
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.notEqual(state.run.pendingEvent?.id, "goodie_corner_intro");
  state.run.pendingEvent = null; state.run.day = 2;
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.run.pendingEvent.id, "goodie_corner_intro");
  assert.ok(state.run.pendingEvent.description.trim().split(/\s+/).length < 40);
  assert.deepEqual(state.run.pendingEvent.choices.map((choice) => choice.label), ["Accept", "Decline"]);
});

test("accepting Goodie reveals the Market and weed only", () => {
  const state = meetGoodie();
  assert.equal(state.market.visible, true);
  assert.deepEqual(state.plugs.unlocked, ["goodie"]);
  assert.deepEqual(C.selectors.visibleMarketProducts(state).map((product) => product.id), ["weed"]);
});

test("plug standing increases once per day and unlocks products at threshold", () => {
  let state = stock(meetGoodie(), "weed");
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  assert.equal(state.plugs.records.goodie.standing, 1);
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  assert.equal(state.plugs.records.goodie.standing, 1, "a second same-day purchase gives no standing");
  state.run.day += 1;
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  assert.equal(state.plugs.records.goodie.standing, 2);
  assert.deepEqual(C.selectors.visibleMarketProducts(state).map((product) => product.id), ["weed", "shrooms"]);
  assert.ok(state.log.some((entry) => entry.text === "Goodie says he can get you shrooms now too."));
});

// v1.10 brakes standing gains as they climb: above 3 a day's business is worth
// half a point, so the fourth point takes two days of buying rather than one.
// The brake banks the remainder deterministically - it is pacing, not a roll.
function buyOn(state, productId) {
  state.plugs.records.goodie.lastPurchaseDay = state.run.day - 1;
  for (const record of Object.values(state.plugs.records)) if (record.lastPurchaseDay != null) record.lastPurchaseDay = state.run.day - 1;
  return C.reduceGame(state, { type: "BUY", productId, qty: 1 });
}

test("standing four triggers the next plug introduction and reveals that plug's products", () => {
  let state = stock(meetGoodie(), "weed");
  state.plugs.records.goodie.standing = 3;
  state.people.dealers.goodie.standing = 3;
  state = buyOn(state, "weed");
  assert.equal(state.plugs.records.goodie.standing, 3, "the first braked day banks half a point");
  stock(state, "weed");
  state.run.day += 1;
  state = buyOn(state, "weed");
  assert.equal(state.plugs.records.goodie.standing, 4);
  assert.equal(state.run.pendingEvent?.id, "tasha_plug_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.deepEqual(state.plugs.unlocked, ["goodie", "tasha"]);
  assert.deepEqual(C.selectors.visibleMarketProducts(state).map((product) => product.id), ["weed", "shrooms", "pills", "lean"]);
});

test("linear introductions continue from Tasha to Malik in order", () => {
  let state = stock(meetGoodie(), "weed");
  state.plugs.records.goodie.standing = 3;
  state.people.dealers.goodie.standing = 3;
  state = buyOn(state, "weed");
  stock(state, "weed");
  state.run.day += 1;
  state = buyOn(state, "weed");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  stock(state, "pills");
  state.plugs.records.tasha.standing = 3;
  state = buyOn(state, "pills");
  stock(state, "pills");
  state.run.day += 1;
  state = buyOn(state, "pills");
  assert.equal(state.run.pendingEvent?.id, "malik_plug_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.deepEqual(state.plugs.unlocked, ["goodie", "tasha", "malik"]);
  assert.deepEqual(C.selectors.visibleMarketProducts(state).map((product) => product.id), ["weed", "shrooms", "pills", "lean", "coke", "molly"]);
});

test("each plug enforces its purchase limit and Malik earns bulk pricing at standing three", () => {
  let state = stock(meetGoodie(), "weed");
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
  const state = meetGoodie();
  state.plugs.records.goodie.standing = 2;
  state.market.visible = false;
  state.world.productAccess.weed = false;
  state.world.productAccess.shrooms = false;
  const hydrated = C.hydrateRun(JSON.parse(C.serializeRun(state)));
  assert.equal(hydrated.market.visible, true);
  assert.deepEqual(hydrated.plugs.unlocked, ["goodie"]);
  assert.equal(hydrated.plugs.records.goodie.standing, 2);
  assert.deepEqual(C.selectors.visibleMarketProducts(hydrated).map((product) => product.id), ["weed", "shrooms"]);
});

test("Goodie's encounter fires exactly once even when the first offer is declined", () => {
  let state = fresh(919);
  state.run.day = 2;
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.run.pendingEvent?.id, "goodie_corner_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 1 });
  assert.equal(state.flags.goodieEncounterSeen, true);
  for (let index = 0; index < 3; index += 1) {
    state.run.pendingEvent = null;
    state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
    assert.notEqual(state.run.pendingEvent?.id, "goodie_corner_intro");
  }
  assert.equal(state.market.visible, false);
});

test("buying directly from Goodie cannot bypass the shrooms standing threshold", () => {
  let state = stock(meetGoodie(922), "weed");
  state.world.markets[state.world.currentNeighborhoodId].availability.shrooms = 50;
  state = C.reduceGame(state, { type: "BUY_FROM_DEALER", dealerId: "goodie" });
  assert.ok(state.player.inventory.weed.qty > 0);
  assert.equal(state.player.inventory.shrooms.qty, 0);
});

test("robbing Goodie never reveals products from a locked plug", () => {
  let state = meetGoodie(22);
  state.player.cash = 5000;
  state.run.pendingEvent = null;
  state = C.reduceGame(state, { type: "ROB_DEALER", dealerId: "goodie" });
  assert.deepEqual(state.plugs.unlocked, ["goodie"]);
  assert.ok(state.plugs.records.goodie.standing < 0);
  assert.deepEqual(C.selectors.visibleMarketProducts(state).map((product) => product.id), ["weed"]);
  assert.equal(state.world.productAccess.pills, false);
  assert.equal(state.world.productAccess.coke, false);
});
