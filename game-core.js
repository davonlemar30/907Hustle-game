(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GameCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const RUN_DAYS = 7;
  const SLOTS = ["Morning", "Afternoon", "Evening", "Night"];
  const SAVE_KEY = "907ogr_v1";

  const PRODUCTS = [
    { id: "weed", name: "Weed", role: "Dependable", base: 34, min: 18, max: 68, volatility: 0.12, heat: 0 },
    { id: "shrooms", name: "Shrooms", role: "Volatile", base: 82, min: 35, max: 180, volatility: 0.25, heat: 0 },
    { id: "cocaine", name: "Cocaine", role: "Premium", base: 290, min: 145, max: 690, volatility: 0.3, heat: 1 },
    { id: "meth", name: "Meth", role: "Extreme Risk", base: 185, min: 70, max: 560, volatility: 0.38, heat: 2 },
  ];

  const NEIGHBORHOODS = [
    {
      id: "north_star_lot", name: "North Star Lot", role: "Home", risk: 1, police: 1, rival: 0,
      accent: "#d7d7d7", blurb: "Familiar blocks, steady stock, smaller margins.",
      bias: { weed: 0.78, shrooms: 0.88, cocaine: 1.02, meth: 0.95 },
      availability: { weed: 1, shrooms: 0.88, cocaine: 0.55, meth: 0.48 },
    },
    {
      id: "downtown", name: "Downtown", role: "Commercial", risk: 2, police: 3, rival: 1,
      accent: "#e14332", blurb: "Nightlife money moves fast under bright cameras.",
      bias: { weed: 1.08, shrooms: 1.32, cocaine: 1.46, meth: 1.08 },
      availability: { weed: 0.9, shrooms: 0.9, cocaine: 0.78, meth: 0.58 },
    },
    {
      id: "airport_industrial", name: "Airport / Industrial", role: "Outer", risk: 4, police: 2, rival: 3,
      accent: "#9a1d18", blurb: "Isolated lanes, rare supply, and expensive mistakes.",
      bias: { weed: 1.12, shrooms: 1.18, cocaine: 1.32, meth: 1.62 },
      availability: { weed: 0.72, shrooms: 0.7, cocaine: 0.7, meth: 0.86 },
    },
  ];

  const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const AREA_BY_ID = Object.fromEntries(NEIGHBORHOODS.map((a) => [a.id, a]));

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function cargoUsed(state) { return PRODUCTS.reduce((sum, p) => sum + (state.player.inventory[p.id]?.qty || 0), 0); }
  function slotNumber(day, slot) { return (day - 1) * 4 + slot; }

  function normalizeSeed(seed) {
    const numeric = Number(seed);
    const fallback = 0x9072026;
    return ((Number.isFinite(numeric) ? numeric : fallback) >>> 0) || fallback;
  }

  function makeRandom(seed) {
    let value = normalizeSeed(seed);
    return {
      next() {
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        value >>>= 0;
        return value / 4294967296;
      },
      int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; },
      pick(items) { return items[Math.floor(this.next() * items.length)]; },
      get state() { return value >>> 0; },
    };
  }

  function copyState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function marketPrice(product, area, random, previous) {
    const anchor = product.base * (area.bias[product.id] || 1);
    const prior = Number(previous) || anchor;
    const reversion = prior + (anchor - prior) * 0.34;
    const movement = 1 + (random.next() * 2 - 1) * product.volatility;
    return Math.round(clamp(reversion * movement, product.min * 0.72, product.max * 1.2));
  }

  function initialMarket(area, random) {
    const prices = {};
    const availability = {};
    const history = {};
    for (const product of PRODUCTS) {
      prices[product.id] = marketPrice(product, area, random, null);
      availability[product.id] = random.next() <= area.availability[product.id]
        ? Math.max(2, random.int(4, area.role === "Outer" ? 12 : 9))
        : 0;
      history[product.id] = [prices[product.id]];
    }
    return { prices, availability, history, updatedAt: 0 };
  }

  function logEntry(state, text, tone) {
    state.log.unshift({
      text,
      tone: tone || "",
      stamp: `Day ${state.run.day} · ${SLOTS[state.run.slot]}`,
    });
    state.log = state.log.slice(0, 60);
  }

  function relationshipForLender(lender, day) {
    if (lender.balance <= 0) return lender.trust >= 2 ? "helpful" : "businesslike";
    if (day > lender.dueDay + 1) return lender.trust < 0 ? "threatening" : "demanding";
    if (day > lender.dueDay) return "demanding";
    if (lender.trust >= 2) return "patient";
    return "businesslike";
  }

  function relationshipForRival(rival) {
    if (rival.respect >= 4 && rival.pressure <= 6) return "respectful";
    if (rival.respect >= 2 && rival.pressure <= 4) return "cooperative";
    if (rival.pressure >= 12) return "aggressive";
    if (rival.pressure >= 7) return "competitive";
    return "dismissive";
  }

  function createRun(options) {
    const seed = normalizeSeed(options && options.seed);
    const random = makeRandom(seed);
    const markets = {};
    for (const area of NEIGHBORHOODS) markets[area.id] = initialMarket(area, random);
    const inventory = Object.fromEntries(PRODUCTS.map((p) => [p.id, { qty: 0, avgCost: 0 }]));
    const state = {
      version: VERSION,
      run: {
        status: "playing", day: 1, slot: 0, seed, rngState: random.state,
        ending: null, pendingEvent: null, daySummary: null,
        currentVisit: { trades: 0, grossBuy: 0, grossSell: 0, startedAt: 0 },
      },
      player: {
        cash: 350, banked: 0, health: 100, heat: 1, reputation: 0, cargoCapacity: 10,
        inventory,
      },
      world: { currentNeighborhoodId: "north_star_lot", markets },
      lender: {
        name: "Dre Holloway", principal: 480, balance: 480, dueDay: 4, trust: 0,
        relationship: "businesslike", payments: 0, paymentCount: 0, feesAdded: 0,
        paymentHistory: [], penaltyHistory: [], clearedAt: null,
        missedDays: 0, lastPenaltyDay: 0,
      },
      rival: { name: "Rook Mercer", pressure: 1, respect: 0, relationship: "dismissive", recentInterference: null },
      effects: { rumors: [], modifiers: [] },
      stats: {
        startingNetWorth: -130, bestTrade: 0, largestLoss: 0, highestHeat: 1,
        productsMoved: Object.fromEntries(PRODUCTS.map((p) => [p.id, 0])),
        decisions: 0, pipelineAdvances: 0, marketUpdates: 0, visits: [], majorDecisions: [],
      },
      log: [],
    };
    logEntry(state, "Seven days. One debt. Make the week count.", "warn");
    logEntry(state, "North Star is steady. Read the market before you move.", "");
    return state;
  }

  function inventoryValue(state) {
    const market = state.world.markets[state.world.currentNeighborhoodId];
    return PRODUCTS.reduce((sum, product) => {
      const qty = state.player.inventory[product.id]?.qty || 0;
      return sum + qty * (market.prices[product.id] || 0);
    }, 0);
  }

  function netWorth(state) {
    return state.player.cash + state.player.banked + inventoryValue(state) - state.lender.balance;
  }

  function loanDetails(state) {
    const lender = state.lender || {};
    const principal = Number.isFinite(lender.principal) ? lender.principal : 480;
    const feesAdded = Number.isFinite(lender.feesAdded)
      ? lender.feesAdded
      : Math.max(0, (lender.balance || 0) + (lender.payments || 0) - principal);
    const repaid = Number.isFinite(lender.payments) ? lender.payments : 0;
    const paymentHistory = Array.isArray(lender.paymentHistory) ? lender.paymentHistory : [];
    const penaltyHistory = Array.isArray(lender.penaltyHistory) ? lender.penaltyHistory : [];
    return {
      principal,
      feesAdded,
      repaid,
      paymentCount: Number.isFinite(lender.paymentCount) ? lender.paymentCount : paymentHistory.length,
      paymentHistory: paymentHistory.map((entry) => ({ ...entry })),
      penaltyHistory: penaltyHistory.map((entry) => ({ ...entry })),
      clearedAt: lender.clearedAt || null,
    };
  }

  function ensureLenderLedger(state) {
    const details = loanDetails(state);
    if (!Number.isFinite(state.lender.principal)) state.lender.principal = details.principal;
    if (!Number.isFinite(state.lender.feesAdded)) state.lender.feesAdded = details.feesAdded;
    if (!Number.isFinite(state.lender.paymentCount)) state.lender.paymentCount = details.paymentCount;
    if (!Array.isArray(state.lender.paymentHistory)) state.lender.paymentHistory = [];
    if (!Array.isArray(state.lender.penaltyHistory)) state.lender.penaltyHistory = [];
    if (!("clearedAt" in state.lender)) state.lender.clearedAt = null;
  }

  function heatBand(heat) {
    if (heat >= 12) return { id: "critical", label: "CRITICAL", tone: "bad" };
    if (heat >= 8) return { id: "high", label: "HIGH", tone: "bad" };
    if (heat >= 4) return { id: "warm", label: "WARM", tone: "warn" };
    return { id: "low", label: "LOW", tone: "" };
  }

  function priceSignal(state, areaId, productId) {
    const product = PRODUCT_BY_ID[productId];
    const area = AREA_BY_ID[areaId];
    const market = state.world.markets[areaId];
    if (!product || !area || !market) return { id: "normal", label: "—" };
    const anchor = product.base * area.bias[productId];
    const price = market.prices[productId];
    if (price >= anchor * 1.22) return { id: "high", label: "HIGH", symbol: "▲" };
    if (price <= anchor * 0.8) return { id: "low", label: "LOW", symbol: "▼" };
    const history = market.history[productId] || [];
    if (history.length >= 2) {
      const prior = history[history.length - 2];
      if (price > prior * 1.08) return { id: "up", label: "RISING", symbol: "↗" };
      if (price < prior * 0.92) return { id: "down", label: "FALLING", symbol: "↘" };
    }
    return { id: "normal", label: "STEADY", symbol: "—" };
  }

  function closeVisit(state, reason) {
    const visit = state.run.currentVisit;
    state.stats.visits.push({
      day: state.run.day, slot: state.run.slot,
      neighborhoodId: state.world.currentNeighborhoodId,
      trades: visit.trades, grossBuy: visit.grossBuy, grossSell: visit.grossSell,
      reason,
    });
    state.run.currentVisit = {
      trades: 0, grossBuy: 0, grossSell: 0,
      startedAt: slotNumber(state.run.day, state.run.slot) + 1,
    };
  }

  function evolveMarkets(state, random) {
    const absolute = slotNumber(state.run.day, state.run.slot);
    for (const area of NEIGHBORHOODS) {
      const market = state.world.markets[area.id];
      for (const product of PRODUCTS) {
        let price = marketPrice(product, area, random, market.prices[product.id]);
        for (const modifier of state.effects.modifiers) {
          if (modifier.areaId === area.id && modifier.productId === product.id) price *= modifier.multiplier;
        }
        price = Math.round(clamp(price, product.min * 0.72, product.max * 1.2));
        market.prices[product.id] = price;
        market.history[product.id] = [...(market.history[product.id] || []), price].slice(-8);
        const baseChance = area.availability[product.id];
        market.availability[product.id] = random.next() <= baseChance
          ? random.int(3, area.role === "Outer" ? 13 : 9)
          : 0;
      }
      market.updatedAt = absolute;
    }
    state.stats.marketUpdates += 1;
  }

  function expireEffects(state) {
    const now = slotNumber(state.run.day, state.run.slot);
    state.effects.modifiers = state.effects.modifiers.filter((effect) => effect.expiresAt >= now);
    state.effects.rumors = state.effects.rumors.filter((rumor) => rumor.expiresAt >= now);
  }

  function applyPressure(state, context, crossedDay) {
    const area = AREA_BY_ID[state.world.currentNeighborhoodId];
    if (context.reason === "TRAVEL") {
      state.player.heat = clamp(state.player.heat + Math.max(0, area.risk - 1), 0, 15);
      state.rival.pressure = clamp(state.rival.pressure + area.rival, 0, 15);
    } else if (context.reason === "LAY_LOW") {
      state.player.heat = clamp(state.player.heat - (area.role === "Home" ? 2 : 1), 0, 15);
      state.rival.pressure = clamp(state.rival.pressure - 1, 0, 15);
    } else if (area.role === "Outer") {
      state.rival.pressure = clamp(state.rival.pressure + 1, 0, 15);
    }

    if (crossedDay && state.lender.balance > 0 && state.run.day > state.lender.dueDay) {
      ensureLenderLedger(state);
      state.lender.missedDays += 1;
      if (state.lender.lastPenaltyDay !== state.run.day) {
        const fee = Math.max(20, Math.round(state.lender.balance * 0.08));
        state.lender.balance += fee;
        state.lender.feesAdded += fee;
        state.lender.penaltyHistory.push({ day: state.run.day, slot: state.run.slot, amount: fee });
        state.lender.trust -= 1;
        state.lender.lastPenaltyDay = state.run.day;
        state.player.heat = clamp(state.player.heat + 1, 0, 15);
        logEntry(state, `Dre adds $${fee} after the missed deadline.`, "bad");
      }
    }
    state.lender.relationship = relationshipForLender(state.lender, state.run.day);
    state.rival.relationship = relationshipForRival(state.rival);
    state.stats.highestHeat = Math.max(state.stats.highestHeat, state.player.heat);
  }

  function eventChoices(id) {
    const choices = {
      checkpoint: [
        { label: "Pay $90 and cool it", effect: { cash: -90, heat: -1 }, result: "You pay for the clean exit." },
        { label: "Risk the stop", effect: { heat: 2, loseRandomInventory: 2 }, result: "The stop gets expensive." },
      ],
      rook_tax: [
        { label: "Pay Rook $120", effect: { cash: -120, rivalPressure: -2, rivalRespect: 1 }, result: "Rook takes the cut and remembers it." },
        { label: "Refuse", effect: { rivalPressure: 3, health: -10 }, result: "Rook's people make the refusal hurt." },
      ],
      lucky_buyer: [
        { label: "Take the overpay", effect: { cash: 140, heat: 1 }, result: "Fast cash, extra attention." },
        { label: "Keep it quiet", effect: { reputation: 1, heat: -1 }, result: "You protect the lane instead." },
      ],
      rough_night: [
        { label: "Give up $80", effect: { cash: -80, health: -3 }, result: "You buy your way out." },
        { label: "Stand your ground", effect: { health: -16, rivalRespect: 1, rivalPressure: 1 }, result: "You stay standing, barely." },
      ],
      dre_warning: [
        { label: "Promise a payment", effect: { lenderTrust: 1 }, result: "Dre gives you one measured nod." },
        { label: "Brush him off", effect: { lenderTrust: -2, heat: 1 }, result: "Dre stops being patient." },
      ],
    };
    return choices[id];
  }

  function maybeSelectEvent(state, context, random) {
    if (state.run.status !== "playing" || state.run.pendingEvent) return;
    const area = AREA_BY_ID[state.world.currentNeighborhoodId];
    const chance = 0.16 + state.player.heat * 0.012 + area.risk * 0.018;
    if (random.next() > Math.min(0.42, chance)) return;
    const eligible = ["lucky_buyer"];
    if (state.player.heat >= 5 || area.police >= 3) eligible.push("checkpoint");
    if (state.rival.pressure >= 5 || area.rival >= 3) eligible.push("rook_tax");
    if (area.risk >= 3 || state.player.health < 65) eligible.push("rough_night");
    if (state.lender.balance > 0 && state.run.day >= state.lender.dueDay) eligible.push("dre_warning");
    const id = random.pick(eligible);
    const meta = {
      checkpoint: ["Checkpoint Sweep", "APD lights stack up across the next block."],
      rook_tax: ["Rook Wants a Cut", "Rook's people say you have been visible in his lanes."],
      lucky_buyer: ["Buyer in a Hurry", "A buyer offers extra cash for a fast, noisy handoff."],
      rough_night: ["Wrong Place, Late Hour", "The lot goes quiet and three shapes block the exit."],
      dre_warning: ["Dre Checks the Clock", "Dre reminds you that patience is part of the price."],
    }[id];
    state.run.pendingEvent = { id, title: meta[0], description: meta[1], choices: eventChoices(id) };
  }

  function chooseEnding(state, forced) {
    if (forced) return forced;
    if (state.player.health <= 0) return "burned_out";
    if (state.player.heat >= 15) return "caught";
    if (state.rival.pressure >= 15) return "taken_down";
    const worth = netWorth(state);
    if (state.lender.balance <= 0 && worth >= 700 && state.player.heat <= 7 && state.player.health >= 40) return "one_good_run";
    if (state.lender.balance <= 0 && worth > 0) return "clean_exit";
    if (state.player.cash + state.player.banked + inventoryValue(state) <= 0 && state.lender.balance > 0) return "broke_again";
    if (state.lender.balance > 0) return "still_owing";
    return "clean_exit";
  }

  function endRun(state, forced) {
    state.run.status = "ended";
    state.run.pendingEvent = null;
    state.run.ending = chooseEnding(state, forced);
    logEntry(state, `Run ended: ${endingLabel(state.run.ending)}.`, state.run.ending === "one_good_run" ? "good" : "warn");
  }

  function endingLabel(id) {
    return ({
      one_good_run: "One Good Run", clean_exit: "Clean Exit", still_owing: "Still Owing",
      burned_out: "Burned Out", caught: "Caught", taken_down: "Taken Down",
      broke_again: "Broke Again", rare_relationship: "An Unlikely Alliance",
    })[id] || "Run Complete";
  }

  function advanceRun(inputState, context) {
    const state = copyState(inputState);
    if (state.run.status !== "playing" || state.run.pendingEvent) return state;
    const random = makeRandom(state.run.rngState);
    const oldDay = state.run.day;
    const oldSlot = state.run.slot;
    closeVisit(state, context.reason);

    const finalSlot = oldDay === RUN_DAYS && oldSlot === 3;
    if (!finalSlot) {
      if (oldSlot === 3) { state.run.day += 1; state.run.slot = 0; }
      else state.run.slot += 1;
    }
    const crossedDay = !finalSlot && oldSlot === 3;
    expireEffects(state);
    evolveMarkets(state, random);
    applyPressure(state, context, crossedDay);
    state.stats.pipelineAdvances += 1;
    state.stats.decisions += 1;

    if (crossedDay) {
      state.run.daySummary = {
        day: oldDay, netWorth: netWorth(state), heat: state.player.heat,
        debt: state.lender.balance, health: state.player.health,
      };
    }
    if (state.player.health <= 0 || state.player.heat >= 15 || state.rival.pressure >= 15) {
      endRun(state);
    } else if (finalSlot) {
      endRun(state);
    } else {
      maybeSelectEvent(state, context, random);
    }
    state.run.rngState = random.state;
    return state;
  }

  function applyEventEffect(state, effect, random) {
    const cashBefore = state.player.cash;
    state.player.cash = Math.max(0, state.player.cash + (effect.cash || 0));
    state.player.health = clamp(state.player.health + (effect.health || 0), 0, 100);
    state.player.heat = clamp(state.player.heat + (effect.heat || 0), 0, 15);
    state.player.reputation = Math.max(0, state.player.reputation + (effect.reputation || 0));
    state.rival.pressure = clamp(state.rival.pressure + (effect.rivalPressure || 0), 0, 15);
    state.rival.respect += effect.rivalRespect || 0;
    state.lender.trust += effect.lenderTrust || 0;
    if (effect.loseRandomInventory) {
      const held = PRODUCTS.filter((p) => state.player.inventory[p.id].qty > 0);
      if (held.length) {
        const product = random.pick(held);
        const lost = Math.min(effect.loseRandomInventory, state.player.inventory[product.id].qty);
        state.player.inventory[product.id].qty -= lost;
        if (!state.player.inventory[product.id].qty) state.player.inventory[product.id].avgCost = 0;
        logEntry(state, `Lost ${lost} ${product.name} during the stop.`, "bad");
      }
    }
    state.stats.largestLoss = Math.max(state.stats.largestLoss, Math.max(0, cashBefore - state.player.cash));
    state.lender.relationship = relationshipForLender(state.lender, state.run.day);
    state.rival.relationship = relationshipForRival(state.rival);
  }

  function reduceGame(inputState, action) {
    if (!inputState || !action || !action.type) return inputState;
    if (action.type === "NEW_RUN") return createRun({ seed: action.seed });
    const state = copyState(inputState);
    ensureLenderLedger(state);
    if (state.run.status !== "playing" && !["DISMISS_DAY_SUMMARY"].includes(action.type)) return state;
    const random = makeRandom(state.run.rngState);

    if (action.type === "DISMISS_DAY_SUMMARY") {
      state.run.daySummary = null;
      return state;
    }
    if (state.run.pendingEvent && action.type !== "RESOLVE_EVENT") return state;

    if (action.type === "BUY") {
      const product = PRODUCT_BY_ID[action.productId];
      const market = state.world.markets[state.world.currentNeighborhoodId];
      const qty = Math.max(0, Math.floor(action.qty || 0));
      if (!product || qty < 1) return state;
      const available = market.availability[product.id] || 0;
      const cost = market.prices[product.id] * qty;
      if (qty > available || cost > state.player.cash || cargoUsed(state) + qty > state.player.cargoCapacity) return state;
      const item = state.player.inventory[product.id];
      const totalQty = item.qty + qty;
      item.avgCost = ((item.avgCost * item.qty) + cost) / totalQty;
      item.qty = totalQty;
      state.player.cash -= cost;
      market.availability[product.id] -= qty;
      state.player.heat = clamp(state.player.heat + Math.floor((product.heat * qty) / 5), 0, 15);
      state.run.currentVisit.trades += 1;
      state.run.currentVisit.grossBuy += cost;
      state.stats.bestTrade = Math.max(state.stats.bestTrade, cost);
      logEntry(state, `Bought ${qty} ${product.name} for $${cost}.`, "good");
      state.run.rngState = random.state;
      return state;
    }

    if (action.type === "SELL") {
      const product = PRODUCT_BY_ID[action.productId];
      const market = state.world.markets[state.world.currentNeighborhoodId];
      const qty = Math.max(0, Math.floor(action.qty || 0));
      if (!product || qty < 1) return state;
      const item = state.player.inventory[product.id];
      if (item.qty < qty) return state;
      const unitPrice = Math.round(market.prices[product.id] * (0.96 + Math.min(0.03, state.player.reputation * 0.002)));
      const total = unitPrice * qty;
      const profit = total - item.avgCost * qty;
      item.qty -= qty;
      if (!item.qty) item.avgCost = 0;
      state.player.cash += total;
      state.player.reputation += profit > 0 && qty >= 3 ? 1 : 0;
      state.run.currentVisit.trades += 1;
      state.run.currentVisit.grossSell += total;
      state.stats.productsMoved[product.id] += qty;
      state.stats.bestTrade = Math.max(state.stats.bestTrade, total);
      state.stats.largestLoss = Math.max(state.stats.largestLoss, Math.max(0, -profit));
      logEntry(state, `Sold ${qty} ${product.name} for $${total} (${profit >= 0 ? "+" : "−"}$${Math.abs(Math.round(profit))}).`, profit >= 0 ? "good" : "bad");
      return state;
    }

    if (action.type === "RESOLVE_EVENT") {
      const event = state.run.pendingEvent;
      const choice = event?.choices?.[action.choiceIndex];
      if (!event || !choice) return state;
      state.run.pendingEvent = null;
      applyEventEffect(state, choice.effect || {}, random);
      logEntry(state, choice.result, (choice.effect?.cash || 0) >= 0 ? "good" : "warn");
      state.stats.majorDecisions.push(`${event.title}: ${choice.label}`);
      state.run.rngState = random.state;
      if (state.player.health <= 0 || state.player.heat >= 15 || state.rival.pressure >= 15) endRun(state);
      return state;
    }

    let base = state;
    if (action.type === "TRAVEL") {
      if (!AREA_BY_ID[action.neighborhoodId] || action.neighborhoodId === state.world.currentNeighborhoodId) return state;
      base.world.currentNeighborhoodId = action.neighborhoodId;
      logEntry(base, `Moved to ${AREA_BY_ID[action.neighborhoodId].name}.`, "");
      return advanceRun(base, { reason: "TRAVEL" });
    }
    if (action.type === "END_MARKET") {
      logEntry(base, "Closed the market visit and watched the block shift.", "");
      return advanceRun(base, { reason: "END_MARKET" });
    }
    if (action.type === "LAY_LOW") {
      logEntry(base, "Laid low and let attention cool.", "");
      return advanceRun(base, { reason: "LAY_LOW" });
    }
    if (action.type === "HEAL") {
      const cost = Math.max(0, Math.floor(action.cost || 0));
      const amount = Math.max(0, Math.floor(action.amount || 0));
      if (!amount || state.player.health >= 100 || state.player.cash < cost) return state;
      base.player.cash -= cost;
      base.player.health = clamp(base.player.health + amount, 0, 100);
      logEntry(base, `Clinic visit restored ${amount} health for $${cost}.`, "good");
      return advanceRun(base, { reason: "HEAL" });
    }
    if (action.type === "PAY_DEBT") {
      const amount = Math.min(state.lender.balance, Math.max(0, Math.floor(action.amount || 0)));
      if (!amount || state.player.cash < amount) return state;
      base.player.cash -= amount;
      base.lender.balance -= amount;
      base.lender.payments += amount;
      base.lender.paymentCount += 1;
      base.lender.paymentHistory.push({ day: base.run.day, slot: base.run.slot, amount });
      base.lender.trust += amount >= 120 ? 1 : 0;
      if (!base.lender.balance) {
        base.lender.trust += 2;
        base.player.reputation += 1;
        base.lender.clearedAt = { day: base.run.day, slot: base.run.slot };
      }
      base.lender.relationship = relationshipForLender(base.lender, base.run.day);
      logEntry(base, `Paid Dre $${amount}${base.lender.balance ? `; $${base.lender.balance} remains` : "; the debt is clear"}.`, "good");
      return advanceRun(base, { reason: "PAY_DEBT" });
    }
    if (action.type === "BANK") {
      const amount = Math.max(0, Math.floor(action.amount || 0));
      if (!amount || state.player.cash < amount) return state;
      base.player.cash -= amount;
      base.player.banked += amount;
      logEntry(base, `Banked $${amount}.`, "good");
      return advanceRun(base, { reason: "BANK" });
    }
    if (action.type === "UNBANK") {
      const amount = Math.max(0, Math.floor(action.amount || 0));
      if (!amount || state.player.banked < amount) return state;
      base.player.banked -= amount;
      base.player.cash += amount;
      logEntry(base, `Pulled $${amount} back into street cash.`, "warn");
      return advanceRun(base, { reason: "UNBANK" });
    }
    if (action.type === "VISIT_SOCIAL") {
      const area = random.pick(NEIGHBORHOODS.filter((a) => a.id !== state.world.currentNeighborhoodId));
      const product = random.pick(PRODUCTS);
      const truthful = random.next() < 0.72;
      const market = state.world.markets[area.id];
      const direction = market.prices[product.id] > product.base * area.bias[product.id] ? "paying high" : "running cheap";
      const rumor = {
        id: `rumor_${state.run.day}_${state.run.slot}_${random.state}`,
        text: truthful ? `${product.name} is ${direction} in ${area.name}.` : `${product.name} might move in ${area.name}—source sounded unsure.`,
        areaId: area.id, productId: product.id, reliable: truthful,
        expiresAt: slotNumber(state.run.day, state.run.slot) + 4,
      };
      base.effects.rumors.push(rumor);
      if (state.rival.pressure >= 6 && random.next() < 0.45) {
        base.rival.respect += 1;
        base.rival.pressure = clamp(base.rival.pressure - 1, 0, 15);
        logEntry(base, "Rook shares the overlook without starting trouble. Respect shifts.", "warn");
      }
      logEntry(base, `Mini-Mart rumor: ${rumor.text}`, truthful ? "good" : "warn");
      base.run.rngState = random.state;
      return advanceRun(base, { reason: "VISIT_SOCIAL" });
    }
    if (action.type === "FINISH_SAFE") {
      base.stats.majorDecisions.push("Protected the run on Day 7");
      endRun(base);
      return base;
    }
    if (action.type === "FINAL_RISK") {
      if (state.run.day !== 7) return state;
      const winChance = clamp(0.48 + state.rival.respect * 0.03 - state.player.heat * 0.018, 0.2, 0.72);
      if (random.next() < winChance) {
        const gain = random.int(500, 1100);
        base.player.cash += gain;
        base.rival.respect += 2;
        logEntry(base, `The final move lands: +$${gain}.`, "good");
      } else {
        const loss = Math.min(base.player.cash, random.int(250, 700));
        base.player.cash -= loss;
        base.player.health = clamp(base.player.health - random.int(8, 24), 0, 100);
        base.player.heat = clamp(base.player.heat + 3, 0, 15);
        base.stats.largestLoss = Math.max(base.stats.largestLoss, loss);
        logEntry(base, `The final move collapses: −$${loss}.`, "bad");
      }
      base.stats.majorDecisions.push("Took the final risk on Day 7");
      base.run.rngState = random.state;
      endRun(base, base.rival.respect >= 6 && base.player.health > 0 && base.player.heat < 15 ? "rare_relationship" : null);
      return base;
    }
    return state;
  }

  function selectRunSummary(state) {
    return {
      ending: state.run.ending,
      endingLabel: endingLabel(state.run.ending),
      cash: state.player.cash,
      banked: state.player.banked,
      debt: state.lender.balance,
      inventoryValue: inventoryValue(state),
      netWorth: netWorth(state),
      bestTrade: state.stats.bestTrade,
      largestLoss: state.stats.largestLoss,
      highestHeat: state.stats.highestHeat,
      productsMoved: { ...state.stats.productsMoved },
      lenderRelationship: state.lender.relationship,
      rivalRelationship: state.rival.relationship,
      majorDecisions: [...state.stats.majorDecisions],
    };
  }

  return {
    VERSION, RUN_DAYS, SLOTS, SAVE_KEY, PRODUCTS, NEIGHBORHOODS,
    createRun, reduceGame, advanceRun, selectRunSummary,
    selectors: { cargoUsed, inventoryValue, netWorth, loanDetails, heatBand, priceSignal, endingLabel },
  };
});
