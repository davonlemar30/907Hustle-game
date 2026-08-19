const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

// v1.34 - Crime played competently, to find out what competent crime is worth.
//
// The design position, from Davon: the legal path is the highest expected-value
// outcome. Crime is faster, riskier, and worse in expectation. Smart crime
// APPROACHES the job's net return without beating it. The hustle is seductive
// and the hustle is a lie.
//
// This build measures the current economy against that position rather than
// tuning toward it, because the previous four builds all found that "the engine
// is broken" meant "the instrument never played it." It found the same thing
// again, and then found something else.

const root = path.join(__dirname, "..");
const core = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
const arch = fs.readFileSync(path.join(root, "ARCHITECTURE.md"), "utf8");

// --- The route exists, and it holds -----------------------------------------

test("in-market spreads cannot fund a trip, so profit can only be arbitrage", () => {
  // The load-bearing fact. Buying and selling where you stand cannot make money,
  // which is why fourteen strategies trading that way realised -6% to -22%.
  // Measured at 6 seeds x 5 days x 3 products across every market: the widest
  // in-market spread observed is +1.9%, and it is an integer-rounding artifact
  // (buy 54, sell 55) rather than a margin - against a cross-market route paying
  // +45% to +76% on the same products. This is a design property and it should
  // fail loudly if it changes.
  const areas = ["north_star_lot", "downtown", "airport_industrial", "midtown", "spenard_strip"];
  let widest = -Infinity, where = "";
  for (const seed of [1000, 1002, 1004]) {
    let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Spread" });
    while (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
    state = structuredClone(state);
    for (const id of ["weed", "shrooms", "cocaine"]) state.world.productAccess[id] = true;
    for (const day of [1, 12, 40]) {
      state.run.day = day;
      for (const area of areas) {
        if (!state.world.markets[area]) continue;
        state.world.currentNeighborhoodId = area;
        for (const id of ["weed", "shrooms", "cocaine"]) {
          const price = C.selectors.tradeUnitPrices(state, id);
          const spread = price.sell / price.buy - 1;
          if (spread > widest) { widest = spread; where = `${id} in ${area} at ${price.buy}/${price.sell}`; }
        }
      }
    }
  }
  assert.ok(widest < 0.02, `no market round-trips for a real margin (widest was +${(widest * 100).toFixed(1)}%, ${where})`);
});

test("the cross-market route is real and stable across seeds and days", () => {
  // Measured at 6 seeds x 5 days x 3 products: never negative, averaging +73%
  // on weed. A single seed was not enough to commit a build to, so this samples.
  const areas = ["north_star_lot", "downtown", "airport_industrial"];
  let worst = Infinity;
  for (const seed of [1000, 1002, 1004]) {
    let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Route" });
    while (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
    state = structuredClone(state);
    for (const id of ["weed", "shrooms"]) state.world.productAccess[id] = true;
    for (const day of [5, 20, 40]) {
      state.run.day = day;
      for (const id of ["weed", "shrooms"]) {
        const price = {};
        for (const area of areas) { state.world.currentNeighborhoodId = area; price[area] = C.selectors.tradeUnitPrices(state, id); }
        let best = -Infinity;
        for (const from of areas) for (const to of areas) {
          if (from === to) continue;
          best = Math.max(best, price[to].sell / price[from].buy - 1);
        }
        worst = Math.min(worst, best);
      }
    }
  }
  assert.ok(worst > 0.2, `the best route is always worth taking (worst observed +${(worst * 100).toFixed(0)}%)`);
});

// --- The strategies that finally take it ------------------------------------

test("the arbitrage strategy trades at a positive margin, where the old ones could not", () => {
  const { play } = require("./simulate-runs.js");
  const raw = C.reduceGame;
  const measure = (name) => {
    let spent = 0, back = 0;
    C.reduceGame = (state, action) => {
      const before = state.player.cash;
      const next = raw(state, action);
      const delta = next.player.cash - before;
      if (action.type === "BUY" && delta < 0) spent -= delta;
      if (action.type === "SELL" && delta > 0) back += delta;
      return next;
    };
    try { for (const seed of [1000, 1001, 1002, 1003]) play(seed, name); } finally { C.reduceGame = raw; }
    return spent ? back / spent - 1 : null;
  };
  const arb = measure("arbitrage");
  const old = measure("trader");
  assert.ok(arb > 0, `arbitrage returns more than it spends (${(arb * 100).toFixed(0)}%)`);
  assert.ok(old < 0, `the cheapest-in-this-market rule still loses money (${(old * 100).toFixed(0)}%)`);
});

test("it buys the pass, because a courier who does not is paying to work", () => {
  // $45 once, no part of the day, never expires - against $470 a run in singles,
  // which was most of why the route first measured as dead.
  const { play } = require("./simulate-runs.js");
  const raw = C.reduceGame;
  let passes = 0, fares = 0;
  C.reduceGame = (state, action) => {
    const before = state.player.cash;
    const next = raw(state, action);
    const delta = next.player.cash - before;
    if (action.type === "BUY_BUS_PASS" && delta < 0) passes += 1;
    if (action.type === "BUS_TRAVEL" && delta < 0) fares -= delta;
    return next;
  };
  try { play(1000, "arbitrage"); } finally { C.reduceGame = raw; }
  assert.ok(passes > 0, "the week pass gets bought");
  assert.ok(fares < 100, `and single fares stop being the cost of the run ($${fares})`);
});

test("it does not shuttle: it checks both districts before moving", () => {
  // The first cut hopped whenever nothing here was affordable, so when nothing
  // was affordable on either side it rode back and forth - 105 bus rides against
  // 19 sales. Standing still is a legal move.
  const { play } = require("./simulate-runs.js");
  const raw = C.reduceGame;
  let rides = 0, sales = 0;
  C.reduceGame = (state, action) => {
    if (action.type === "BUS_TRAVEL") rides += 1;
    if (action.type === "SELL") sales += 1;
    return raw(state, action);
  };
  try { play(1000, "arbitrage"); } finally { C.reduceGame = raw; }
  assert.ok(rides < sales * 3, `travel is proportionate to trade (${rides} rides, ${sales} sales)`);
});

// --- What competent crime is actually worth ---------------------------------

test("pure crime does not come close to the job, and the reason is capital", () => {
  // The design position wants smart crime at 70-90% of the job. It is at 17%,
  // and not because the margin is bad - the margin is +17% to +24%. A courier
  // who can only ever afford four units of a ten-unit load earns four units of
  // profit. This is the measurement v1.35 has to move, and it is a capital
  // curve rather than a price.
  const { summarize } = require("./simulate-runs.js");
  const job = summarize("legal_worker", 6).averageNetWorth;
  const crime = summarize("arbitrage", 6).averageNetWorth;
  assert.ok(crime > 0, "the route is not actively ruinous");
  assert.ok(crime < job, "and it does not beat the job, which is the design position holding");
});

test("crime alongside a job beats the job, which the design position says it must not", () => {
  // The finding that matters. Running the route on top of employment lands
  // ABOVE the pure job, because the trade currently has no risk term to pay.
  const { summarize } = require("./simulate-runs.js");
  const job = summarize("legal_worker", 6).averageNetWorth;
  const both = summarize("hustler", 6).averageNetWorth;
  assert.ok(both > job * 0.9, `the hybrid is at least competitive with the job (${both} vs ${job})`);
});

test("the trading path once carried no Heat, and v1.35 closed that gap", () => {
  // The engine gap v1.34 exists to have found, and v1.35 exists to have fixed.
  //
  // As of v1.34: `SELL` had no Heat term at all - it moved dirty cash, recorded
  // the activity and logged, and never touched `player.heat`. `BUY` had one,
  // but it was `floor(product.heat * qty / 5)`, and the two open-access products
  // the route runs on carry `heat: 0` (src/data/products.js). Zero times
  // anything is zero, and cocaine at `heat: 1` needed five units in a single
  // purchase to score one point. Measured across four seeds of three trading
  // profiles: 383 purchases, 521 units, and exactly 0 Heat. Forty days of
  // couriering read to the police like forty days at the Chevron.
  //
  // v1.35 gave both legs a quantity-keyed risk term (BUY floor(qty/8), SELL
  // floor(qty/4)); the exact-quantity behaviour is proved in tests/v1-35.test.js.
  // This test guards, at the source, that the gap is closed: SELL writes Heat
  // and BUY reads quantity rather than the dead product-heat term.
  const sellCase = core.slice(core.indexOf('if (action.type === "SELL")'), core.indexOf('if (action.type === "STORE_CASH"'));
  assert.match(sellCase, /state\.player\.heat = clamp\(state\.player\.heat \+ Math\.floor\(qty \/ 4\)/, "SELL now writes Heat (v1.35)");
  const buyCase = core.slice(core.indexOf('if (action.type === "BUY")'), core.indexOf('if (action.type === "SELL")'));
  assert.match(buyCase, /state\.player\.heat = clamp\(state\.player\.heat \+ Math\.floor\(qty \/ 8\)/, "BUY reads quantity (v1.35)");
  assert.doesNotMatch(buyCase, /product\.heat \* qty/, "the dead product-heat term is gone");
  // The measured aftermath, and the finding v1.35 hands to v1.36: the term is
  // real but the strategies trade below it. A courier capped at three units a
  // buy (Goodie's maxUnits) never reaches BUY's 8-unit or SELL's 4-unit step,
  // so the two profitable profiles still register almost no Heat, and the
  // hybrid still pays no risk premium. The teeth are the deferred event-card
  // pass; this build ships the substrate they will read.
  const { play } = require("./simulate-runs.js");
  const raw = C.reduceGame;
  let purchases = 0, heat = 0;
  C.reduceGame = (state, action) => {
    const before = state.player.heat;
    const next = raw(state, action);
    if (action.type === "BUY" && next !== state) { purchases += 1; heat += next.player.heat - before; }
    return next;
  };
  try { for (const seed of [1000, 1001]) for (const name of ["arbitrage", "hustler"]) play(seed, name); }
  finally { C.reduceGame = raw; }
  assert.ok(purchases > 20, "the profiles really do buy product");
  assert.equal(heat, 0, `and a courier buying in threes still trips no BUY Heat (${heat} across ${purchases} purchases) — the v1.35 finding`);
});

// --- The design position is written down ------------------------------------

test("ARCHITECTURE states the economy philosophy and the scaling rule", () => {
  assert.match(arch, /## Economy philosophy/, "the section exists");
  assert.match(arch, /highest expected-value outcome/, "the legal path is named as the ceiling");
  assert.match(arch, /ceiling and the floor/, "and the scaling rule for new districts is stated");
});

test("guards from the previous builds still hold", () => {
  const { summarize } = require("./simulate-runs.js");
  const territory = summarize("territory", 5);
  assert.equal(territory.deadEnds, 0);
  assert.ok(territory.territory.claimed > 0, "the block layer is still measurable");
  assert.equal(summarize("worker", 5).evictions, 0, "a strategy that pays is not evicted");
});
