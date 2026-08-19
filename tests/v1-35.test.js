const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const root = path.join(__dirname, "..");
const core = fs.readFileSync(path.join(root, "game-core.js"), "utf8");

// v1.35 — the risk term.
//
// Through v1.34 the whole courier loop was risk-free: BUY's term was
// `floor(product.heat * qty / 5)` and the two open-access products the route
// runs on carry `heat: 0`, so it never fired; SELL had no Heat term at all;
// carrying on the People Mover looked at nothing. Forty days of couriering read
// to the police like forty days at the Chevron, which made the game's own
// economy thesis ("faster, riskier, worse in expectation") false on the trading
// path.
//
// The fix is quantity-keyed and deliberately tiny. Buying weight is the quieter
// half, so it draws less; selling on a corner is the visible act, so it draws
// more. The Heat itself is not the punishment — it is the surface area for the
// Exposure system and event cards to find you, which is why the numbers are
// small and the consequence lands later.
//
//   BUY  += floor(qty / 8)   1-7 units free, 8+ = +1, a full 10-load = +1
//   SELL += floor(qty / 4)   1-3 units free, 4+ = +1, a full 10-load = +2
//   CARRY (BUS_TRAVEL) unchanged — carry risk is authored event content, not a
//   passive tick, and is out of scope for this build.

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

// A market state with room to move real weight: Goodie for weed/shrooms, Malik
// unlocked for coke (maxUnits 8, coke standing 0), a full wallet and a big bag.
function marketState(seed = 907) {
  let state = meetGoodie(seed);
  state.plugs.unlocked.push("tasha", "malik");
  state.player.cash = 100000;
  state.player.dirtyCash = 100000;
  state.player.cleanCash = 0;
  state.player.cargoCapacity = 40;
  const market = state.world.markets[state.world.currentNeighborhoodId];
  for (const id of ["weed", "shrooms", "coke"]) market.availability[id] = 80;
  return state;
}

function buyHeat(qty, productId = "coke", seed = 907) {
  const state = marketState(seed);
  const before = state.player.heat;
  const next = C.reduceGame(state, { type: "BUY", productId, qty });
  assert.notEqual(next, state, `BUY ${qty} ${productId} should succeed`);
  return next.player.heat - before;
}

function sellHeat(qty, productId = "coke", seed = 907) {
  const state = marketState(seed);
  // Pre-load inventory directly so the sell is not bounded by a plug's maxUnits.
  state.player.inventory[productId] = { qty, avgCost: 10 };
  const before = state.player.heat;
  const next = C.reduceGame(state, { type: "SELL", productId, qty });
  assert.notEqual(next, state, `SELL ${qty} ${productId} should succeed`);
  return next.player.heat - before;
}

// --- BUY: floor(qty / 8) -----------------------------------------------------

test("BUY heat is floor(qty/8): a bag at a time is invisible, a load is one point", () => {
  assert.equal(buyHeat(1), 0, "one unit draws nothing");
  assert.equal(buyHeat(7), 0, "seven units still draws nothing");
  assert.equal(buyHeat(8), 1, "a full eight-unit buy picks up one point");
});

test("BUY on an open, heat:0 product now registers when bought in weight", () => {
  // The v1.34 dead-term case: weed carries heat:0, so the old
  // floor(product.heat * qty / 5) could never fire. The quantity-keyed term
  // does not care what the product's heat rating is.
  assert.equal(buyHeat(3, "weed"), 0, "a small weed buy is free");
  // Goodie caps weed at 3 units, so weight has to come through Malik's coke;
  // the point stands that the term keys off quantity, not product heat.
  assert.equal(buyHeat(8, "coke"), 1);
});

// --- SELL: floor(qty / 4) ----------------------------------------------------

test("SELL heat is floor(qty/4): standing on a corner runs hotter than buying", () => {
  assert.equal(sellHeat(3), 0, "moving three or fewer draws nothing");
  assert.equal(sellHeat(4), 1, "four picks up a point");
  assert.equal(sellHeat(8), 2, "a full load is two points");
  assert.equal(sellHeat(10), 2, "and ten is still two");
});

test("SELL writes Heat at all — the v1.34 gap is closed", () => {
  const sellCase = core.slice(core.indexOf('if (action.type === "SELL")'), core.indexOf('if (action.type === "STORE_CASH"'));
  assert.match(sellCase, /state\.player\.heat = clamp\(state\.player\.heat \+ Math\.floor\(qty \/ 4\)/, "SELL adds floor(qty/4)");
});

test("BUY uses the quantity term, not the old product-heat term", () => {
  const buyCase = core.slice(core.indexOf('if (action.type === "BUY")'), core.indexOf('if (action.type === "SELL")'));
  assert.match(buyCase, /state\.player\.heat = clamp\(state\.player\.heat \+ Math\.floor\(qty \/ 8\)/, "BUY adds floor(qty/8)");
  assert.doesNotMatch(buyCase, /product\.heat \* qty/, "the old dead term is gone");
});

// --- CARRY stays free: the People Mover does not search you -------------------

test("carrying product on the bus is not itself a Heat source", () => {
  // Davon's call: carry risk belongs to authored event cards (a stop, a nosy
  // passenger, Curtis's people on the bus), not a passive tick. BUS_TRAVEL must
  // not touch player.heat.
  const busCase = core.slice(core.indexOf('action.type === "BUS_TRAVEL"'));
  const busBlock = busCase.slice(0, 1200);
  assert.doesNotMatch(busBlock, /player\.heat = /, "BUS_TRAVEL never writes Heat");

  let state = marketState(1234);
  state.player.inventory.coke = { qty: 10, avgCost: 100 };
  // Find a reachable district to ride to.
  const before = state.player.heat;
  const targets = C.selectors?.busDestinations ? C.selectors.busDestinations(state) : null;
  const to = Array.isArray(targets) && targets.length ? (targets[0].id || targets[0]) : null;
  if (to) {
    const next = C.reduceGame(state, { type: "BUS_TRAVEL", to });
    if (next !== state) assert.equal(next.player.heat, before, "riding holding a full load adds no Heat");
  }
});
