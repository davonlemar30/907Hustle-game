const C = require("../game-core.js");

const strategies = {
  cautious: { products: ["weed", "shrooms"], areas: ["north_star_lot", "downtown"], profit: 1.12, heatCap: 5, finalRisk: false },
  balanced: { products: ["weed", "shrooms", "cocaine"], areas: ["north_star_lot", "downtown", "airport_industrial"], profit: 1.16, heatCap: 8, finalRisk: true },
  aggressive: { products: ["meth", "cocaine", "shrooms"], areas: ["airport_industrial", "downtown"], profit: 1.2, heatCap: 12, finalRisk: true },
};

function legalize(state) {
  let next = state;
  if (next.run.daySummary) next = C.reduceGame(next, { type: "DISMISS_DAY_SUMMARY" });
  if (next.run.pendingEvent) {
    const choices = next.run.pendingEvent.choices;
    let choiceIndex = 0;
    if ((choices[0].effect?.cash || 0) < 0 && next.player.cash < Math.abs(choices[0].effect.cash)) choiceIndex = Math.min(1, choices.length - 1);
    next = C.reduceGame(next, { type: "RESOLVE_EVENT", choiceIndex });
  }
  return next;
}

function play(seed, name) {
  const profile = strategies[name];
  let state = C.createRun({ seed });
  let guard = 0;
  while (state.run.status === "playing" && guard++ < 100) {
    state = legalize(state);
    if (state.run.status !== "playing") break;
    const areaId = state.world.currentNeighborhoodId;
    const market = state.world.markets[areaId];

    for (const productId of profile.products) {
      const item = state.player.inventory[productId];
      const sellPrice = Math.round(market.prices[productId] * 0.96);
      if (item.qty > 0 && sellPrice >= item.avgCost * profile.profit) {
        state = C.reduceGame(state, { type: "SELL", productId, qty: item.qty });
      }
    }

    const room = state.player.cargoCapacity - C.selectors.cargoUsed(state);
    if (room > 0) {
      const candidates = profile.products
        .map((productId) => ({ productId, price: market.prices[productId], available: market.availability[productId] }))
        .filter((item) => item.available > 0 && item.price <= state.player.cash)
        .sort((a, b) => a.price - b.price);
      if (candidates.length) {
        const pick = candidates[0];
        const qty = Math.min(room, pick.available, Math.floor(state.player.cash * 0.65 / pick.price));
        if (qty > 0) state = C.reduceGame(state, { type: "BUY", productId: pick.productId, qty });
      }
    }

    if (state.run.day === 7 && state.run.slot >= 2) {
      state = C.reduceGame(state, { type: profile.finalRisk ? "FINAL_RISK" : "FINISH_SAFE" });
      continue;
    }
    if (state.lender.balance > 0 && state.player.cash >= state.lender.balance + 120 && state.run.day >= 3) {
      state = C.reduceGame(state, { type: "PAY_DEBT", amount: state.lender.balance });
      continue;
    }
    if (state.player.heat > profile.heatCap) {
      state = C.reduceGame(state, { type: "LAY_LOW" });
      continue;
    }
    const nextArea = profile.areas[(profile.areas.indexOf(areaId) + 1) % profile.areas.length];
    state = nextArea === areaId
      ? C.reduceGame(state, { type: "END_MARKET" })
      : C.reduceGame(state, { type: "TRAVEL", neighborhoodId: nextArea });
  }
  state = legalize(state);
  return C.selectRunSummary(state);
}

function summarize(name, count) {
  const runs = Array.from({ length: count }, (_, index) => play(1000 + index, name));
  const endings = {};
  for (const run of runs) endings[run.endingLabel] = (endings[run.endingLabel] || 0) + 1;
  const average = (key) => Math.round(runs.reduce((sum, run) => sum + run[key], 0) / runs.length);
  return {
    strategy: name,
    runs: count,
    averageNetWorth: average("netWorth"),
    minNetWorth: Math.min(...runs.map((run) => run.netWorth)),
    maxNetWorth: Math.max(...runs.map((run) => run.netWorth)),
    averageDebt: average("debt"),
    averageHighestHeat: average("highestHeat"),
    endings,
  };
}

const count = Number(process.argv[2] || 200);
console.log(JSON.stringify(Object.keys(strategies).map((name) => summarize(name, count)), null, 2));
