(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GameCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 2;
  const RUN_DAYS = 7;
  const SLOTS = ["Morning", "Afternoon", "Evening", "Night"];
  const SAVE_KEY = "907ogr_v2";

  const PRODUCTS = [
    { id: "weed", name: "Weed", role: "Dependable", base: 34, min: 18, max: 68, volatility: 0.12, heat: 0, access: "open" },
    { id: "shrooms", name: "Shrooms", role: "Volatile", base: 82, min: 35, max: 180, volatility: 0.25, heat: 0, access: "open" },
    { id: "cocaine", name: "Cocaine", role: "Premium", base: 290, min: 145, max: 690, volatility: 0.30, heat: 1, access: "supplier" },
    { id: "meth", name: "Meth", role: "Extreme Risk", base: 185, min: 70, max: 560, volatility: 0.38, heat: 2, access: "industrial" },
  ];

  const NEIGHBORHOODS = [
    {
      id: "north_star_lot", name: "North Star Lot", role: "Home", risk: 1, police: 1, rival: 0,
      accent: "#d7d7d7", blurb: "Familiar blocks, the Mini-Mart glow, and the garage you are trying to hold.",
      bias: { weed: 0.78, shrooms: 0.88, cocaine: 1.02, meth: 0.95 },
      availability: { weed: 1, shrooms: 0.88, cocaine: 0.55, meth: 0.48 },
    },
    {
      id: "downtown", name: "Downtown", role: "Commercial", risk: 2, police: 3, rival: 1,
      accent: "#e14332", blurb: "Nightlife money moves fast under cameras and through Rook's buyers.",
      bias: { weed: 1.08, shrooms: 1.32, cocaine: 1.46, meth: 1.08 },
      availability: { weed: 0.9, shrooms: 0.9, cocaine: 0.78, meth: 0.58 },
    },
    {
      id: "airport_industrial", name: "Airport / Industrial", role: "Outer", risk: 4, police: 2, rival: 3,
      accent: "#9a1d18", blurb: "Loading bays, service roads, rare supply, and expensive mistakes.",
      bias: { weed: 1.12, shrooms: 1.18, cocaine: 1.32, meth: 1.62 },
      availability: { weed: 0.72, shrooms: 0.7, cocaine: 0.7, meth: 0.86 },
    },
  ];

  const BACKGROUNDS = [
    { id: "runner", name: "Runner", aim: 1, grit: 2, instinct: 3, cash: 375, heat: 1, description: "You see exits early and travel light." },
    { id: "enforcer", name: "Enforcer", aim: 2, grit: 3, instinct: 1, cash: 400, heat: 3, description: "You hold ground, and people remember it." },
    { id: "shooter", name: "Shooter", aim: 3, grit: 1, instinct: 2, cash: 325, heat: 1, description: "Your advantage matters once you can afford a firearm." },
  ];

  const GEAR = [
    { id: "utility_knife", name: "Utility Knife", cost: 90, slot: "weapon", type: "close", accuracy: 0.04, damage: [8, 14], heat: 0, description: "Concealable close-range protection." },
    { id: "cheap_handgun", name: "Cheap Handgun", cost: 230, slot: "weapon", type: "firearm", accuracy: -0.06, damage: [14, 24], heat: 2, description: "Affordable stopping power with unreliable aim." },
    { id: "reliable_handgun", name: "Reliable Handgun", cost: 430, slot: "weapon", type: "firearm", accuracy: 0.08, damage: [18, 30], heat: 2, description: "Accurate, costly, and difficult to explain." },
    { id: "protective_vest", name: "Protective Vest", cost: 300, slot: "armor", armor: 4, description: "Cuts incoming damage but marks you as prepared for trouble." },
    { id: "running_shoes", name: "Running Shoes", cost: 160, slot: "utility", escape: 0.10, description: "A real advantage when the bag is not overloaded." },
    { id: "medical_kit", name: "Medical Kit", cost: 95, slot: "consumable", heal: 24, description: "One use during an encounter or at the garage." },
    { id: "larger_bag", name: "Larger Bag", cost: 260, slot: "gear", cargo: 5, description: "Five more carried units, with more weight to escape with." },
    { id: "burner_phone", name: "Burner Phone", cost: 180, slot: "tool", call: true, description: "Unlocks selected warnings, calls, and remote coordination." },
  ];

  const BASE_UPGRADES = [
    { track: "security", level: 1, id: "better_locks", name: "Better Locks", cost: 140, description: "Protects stored goods from the first intrusion." },
    { track: "security", level: 2, id: "camera_door", name: "Camera + Reinforced Door", cost: 360, description: "Reveals surveillance and changes raid choices." },
    { track: "storage", level: 1, id: "hidden_compartment", name: "Hidden Compartment", cost: 120, description: "Adds protected product space and a small cash stash." },
    { track: "storage", level: 2, id: "secure_lockbox", name: "Secure Lockbox", cost: 300, description: "Expands protected inventory and off-street cash." },
    { track: "operations", level: 1, id: "burner_station", name: "Burner Station", cost: 180, description: "Improves coordination and unlocks crew assignments." },
    { track: "operations", level: 2, id: "market_table", name: "Market Board + Packaging Table", cost: 420, description: "Improves rumors and opens harder supply lanes." },
    { track: "recovery", level: 1, id: "first_aid_setup", name: "First-Aid Setup", cost: 150, description: "Makes garage recovery cheaper and safer." },
    { track: "recovery", level: 2, id: "safe_room", name: "Safe Room + Medical Contact", cost: 380, description: "Protects one person and can prevent a fatal ending." },
  ];

  const CREW = [
    { id: "eli", name: "Eli ‘Shortcut’ Ward", role: "Runner", recruitCost: 120, wage: 45, description: "Moves small bundles and knows service-road exits." },
    { id: "miri", name: "Samira ‘Miri’ Cole", role: "Connector", recruitCost: 180, wage: 60, description: "Opens buyers and supply through an aging Downtown list." },
    { id: "tone", name: "Anton ‘Tone’ Bell", role: "Enforcer / Lookout", recruitCost: 250, wage: 85, description: "Protects the garage and changes confrontation choices." },
  ];

  const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((item) => [item.id, item]));
  const AREA_BY_ID = Object.fromEntries(NEIGHBORHOODS.map((item) => [item.id, item]));
  const GEAR_BY_ID = Object.fromEntries(GEAR.map((item) => [item.id, item]));
  const CREW_BY_ID = Object.fromEntries(CREW.map((item) => [item.id, item]));

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function copyState(state) { return JSON.parse(JSON.stringify(state)); }
  function slotNumber(day, slot) { return (day - 1) * 4 + slot; }
  function normalizeSeed(seed) {
    const numeric = Number(seed);
    const fallback = 0x9072026;
    return ((Number.isFinite(numeric) ? numeric : fallback) >>> 0) || fallback;
  }
  function makeRandom(seed) {
    let value = normalizeSeed(seed);
    return {
      next() { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; value >>>= 0; return value / 4294967296; },
      int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; },
      pick(items) { return items[Math.floor(this.next() * items.length)]; },
      get state() { return value >>> 0; },
    };
  }

  function logEntry(state, text, tone) {
    state.log.unshift({ text, tone: tone || "", stamp: `Day ${state.run.day} · ${SLOTS[state.run.slot]}` });
    state.log = state.log.slice(0, 80);
  }

  function initialMarket(area, random) {
    const prices = {}, availability = {}, history = {};
    for (const product of PRODUCTS) {
      prices[product.id] = marketPrice(product, area, random, null);
      availability[product.id] = random.next() <= area.availability[product.id] ? random.int(4, area.role === "Outer" ? 12 : 9) : 0;
      history[product.id] = [prices[product.id]];
    }
    return { prices, availability, history, updatedAt: 0 };
  }
  function marketPrice(product, area, random, previous) {
    const anchor = product.base * (area.bias[product.id] || 1);
    const prior = Number(previous) || anchor;
    const reversion = prior + (anchor - prior) * 0.34;
    const movement = 1 + (random.next() * 2 - 1) * product.volatility;
    return Math.round(clamp(reversion * movement, product.min * 0.72, product.max * 1.2));
  }

  function createCrewState() {
    return Object.fromEntries(CREW.map((person) => [person.id, {
      introduced: false, recruited: false, loyalty: 0, wageDue: 0, assignment: null,
      crisisResolved: false, status: "outside", outcomes: [],
    }]));
  }

  function createRun(options) {
    const seed = normalizeSeed(options && options.seed);
    const random = makeRandom(seed);
    const markets = {};
    for (const area of NEIGHBORHOODS) markets[area.id] = initialMarket(area, random);
    const inventory = Object.fromEntries(PRODUCTS.map((item) => [item.id, { qty: 0, avgCost: 0 }]));
    const storedInventory = Object.fromEntries(PRODUCTS.map((item) => [item.id, { qty: 0, avgCost: 0 }]));
    const state = {
      version: VERSION,
      run: {
        status: "choosing_background", day: 1, slot: 0, seed, rngState: random.state,
        ending: null, pendingEvent: null, pendingEncounter: null, daySummary: null,
        currentVisit: { trades: 0, grossBuy: 0, grossSell: 0, startedAt: 0 },
        recentEvents: [], encounterCount: 0, finalPlan: null, finalPlanPrepared: false,
      },
      player: {
        background: null, cash: 0, health: 100, heat: 1, cargoCapacity: 10,
        stats: { aim: 0, grit: 0, instinct: 0 }, inventory,
        gear: { owned: [], equipped: { weapon: null, armor: null, utility: null, tool: null }, consumables: { medical_kit: 0 } },
      },
      world: {
        currentNeighborhoodId: "north_star_lot", markets,
        influence: { north_star_lot: 0, downtown: 0, airport_industrial: 0 },
        tradeInfluenceGranted: { north_star_lot: false, downtown: false, airport_industrial: false },
        productAccess: { weed: true, shrooms: true, cocaine: false, meth: false },
      },
      base: {
        name: "North Star Garage", visiting: false,
        tracks: { security: 0, storage: 0, operations: 0, recovery: 0 },
        storedCash: 0, storedInventory, watched: false, damage: 0, assignedCrew: null,
      },
      lender: {
        name: "Dre Holloway", principal: 620, balance: 620, dueDay: 4, trust: 0,
        relationship: "businesslike", payments: 0, paymentCount: 0, feesAdded: 0,
        paymentHistory: [], penaltyHistory: [], clearedAt: null, missedDays: 0, lastPenaltyDay: 0,
        afterPayoffOffer: "locked",
      },
      rival: { name: "Rook Mercer", pressure: 1, respect: 0, relationship: "dismissive", recentInterference: null },
      people: {
        mara: { met: false, trust: 0, truthTold: false, usedWithoutConsent: false, status: "distant", outcomes: [] },
        crew: createCrewState(),
      },
      flags: {},
      effects: { rumors: [], modifiers: [] },
      stats: {
        startingNetWorth: -620, bestTrade: 0, largestLoss: 0, highestHeat: 1,
        productsMoved: Object.fromEntries(PRODUCTS.map((item) => [item.id, 0])),
        decisions: 0, pipelineAdvances: 0, marketUpdates: 0, visits: [], majorDecisions: [],
        moneySpent: { debt: 0, base: 0, gear: 0, crew: 0, healing: 0, relationships: 0, events: 0 },
        encounterChoices: { fight: 0, run: 0, talk: 0, pay: 0, other: 0 },
      },
      log: [],
    };
    logEntry(state, "Choose how you learned to survive before the week begins.", "warn");
    return state;
  }

  function hasGear(state, id) { return state.player.gear.owned.includes(id); }
  function equippedWeapon(state) { return GEAR_BY_ID[state.player.gear.equipped.weapon] || null; }
  function cargoCapacity(state) { return state.player.cargoCapacity + (hasGear(state, "larger_bag") ? 5 : 0); }
  function cargoUsed(state) { return PRODUCTS.reduce((sum, item) => sum + (state.player.inventory[item.id]?.qty || 0), 0); }
  function storedCargoUsed(state) { return PRODUCTS.reduce((sum, item) => sum + (state.base.storedInventory[item.id]?.qty || 0), 0); }
  function storageCapacity(state) { return 2 + state.base.tracks.storage * 6; }
  function storedCashCapacity(state) { return state.base.tracks.storage === 0 ? 0 : state.base.tracks.storage === 1 ? 300 : 1200; }
  function recruitedCrew(state) { return CREW.filter((person) => state.people.crew[person.id].recruited); }
  function influenceLabel(value) { return ["Unknown", "Active", "Established", "Contested", "Controlled"][clamp(value, 0, 4)]; }
  function inventoryValue(state) {
    const market = state.world.markets[state.world.currentNeighborhoodId];
    return PRODUCTS.reduce((sum, product) => {
      const carried = state.player.inventory[product.id]?.qty || 0;
      const stored = state.base.storedInventory[product.id]?.qty || 0;
      return sum + (carried + stored) * (market.prices[product.id] || 0);
    }, 0);
  }
  function gearValue(state) { return state.player.gear.owned.reduce((sum, id) => sum + (GEAR_BY_ID[id]?.cost || 0), 0); }
  function baseValue(state) {
    return BASE_UPGRADES.filter((item) => state.base.tracks[item.track] >= item.level).reduce((sum, item) => sum + item.cost, 0);
  }
  function netWorth(state) { return state.player.cash + state.base.storedCash + inventoryValue(state) - state.lender.balance; }
  function operationScore(state) {
    const crew = recruitedCrew(state).reduce((sum, person) => sum + Math.max(0, state.people.crew[person.id].loyalty + 2) * 35, 0);
    const influence = Object.values(state.world.influence).reduce((sum, value) => sum + value * 70, 0);
    const relationships = Math.max(0, state.people.mara.trust) * 35 + Math.max(0, state.lender.trust) * 20 + Math.max(0, state.rival.respect) * 20;
    const access = Object.values(state.world.productAccess).filter(Boolean).length * 45;
    return Math.round(netWorth(state) + baseValue(state) * 0.65 + gearValue(state) * 0.35 + crew + influence + relationships + access);
  }
  function heatBand(heat) {
    if (heat >= 12) return { id: "critical", label: "CRITICAL", tone: "bad" };
    if (heat >= 8) return { id: "high", label: "HIGH", tone: "bad" };
    if (heat >= 4) return { id: "warm", label: "WARM", tone: "warn" };
    return { id: "low", label: "LOW", tone: "" };
  }
  function priceSignal(state, areaId, productId) {
    const product = PRODUCT_BY_ID[productId], area = AREA_BY_ID[areaId], market = state.world.markets[areaId];
    if (!product || !area || !market) return { id: "normal", label: "—", symbol: "—" };
    const anchor = product.base * area.bias[productId], price = market.prices[productId];
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
  function maraStatus(person) {
    if (person.usedWithoutConsent && person.trust < 1) return "gone";
    if (person.usedWithoutConsent) return "compromised";
    if (person.trust >= 5) return "committed";
    if (person.trust >= 3) return "trusted";
    if (person.trust >= 1) return "cautious";
    return "distant";
  }

  function closeVisit(state, reason) {
    const visit = state.run.currentVisit;
    state.stats.visits.push({ day: state.run.day, slot: state.run.slot, neighborhoodId: state.world.currentNeighborhoodId, trades: visit.trades, grossBuy: visit.grossBuy, grossSell: visit.grossSell, reason });
    state.run.currentVisit = { trades: 0, grossBuy: 0, grossSell: 0, startedAt: slotNumber(state.run.day, state.run.slot) + 1 };
    if (reason !== "VISIT_BASE") state.base.visiting = false;
  }
  function expireEffects(state) {
    const now = slotNumber(state.run.day, state.run.slot);
    state.effects.modifiers = state.effects.modifiers.filter((item) => item.expiresAt >= now);
    state.effects.rumors = state.effects.rumors.filter((item) => item.expiresAt >= now);
  }
  function evolveMarkets(state, random) {
    const absolute = slotNumber(state.run.day, state.run.slot);
    for (const area of NEIGHBORHOODS) {
      const market = state.world.markets[area.id];
      for (const product of PRODUCTS) {
        let price = marketPrice(product, area, random, market.prices[product.id]);
        for (const modifier of state.effects.modifiers) if (modifier.areaId === area.id && modifier.productId === product.id) price *= modifier.multiplier;
        price = Math.round(clamp(price, product.min * 0.72, product.max * 1.2));
        market.prices[product.id] = price;
        market.history[product.id] = [...(market.history[product.id] || []), price].slice(-8);
        market.availability[product.id] = random.next() <= area.availability[product.id] ? random.int(3, area.role === "Outer" ? 13 : 9) : 0;
      }
      market.updatedAt = absolute;
    }
    state.stats.marketUpdates += 1;
  }

  function influenceChange(state, areaId, delta) {
    if (!AREA_BY_ID[areaId] || !delta) return;
    state.world.influence[areaId] = clamp(state.world.influence[areaId] + delta, 0, 4);
  }

  function resolveCrewAssignments(state, random) {
    for (const person of CREW) {
      const crew = state.people.crew[person.id];
      if (!crew.recruited || !crew.assignment) continue;
      const assignment = crew.assignment;
      crew.assignment = null;
      const loyaltyBonus = clamp(crew.loyalty, -2, 4) * 0.04;
      if (person.id === "eli") {
        const success = random.next() < 0.58 + state.player.stats.instinct * 0.05 + loyaltyBonus - (assignment === "outer_run" ? 0.14 : 0);
        if (success) {
          const gain = random.int(85, assignment === "outer_run" ? 210 : 145);
          state.player.cash += gain;
          influenceChange(state, assignment === "outer_run" ? "airport_industrial" : "north_star_lot", 1);
          logEntry(state, `Eli returns through the garage side door with $${gain} and a route nobody followed.`, "good");
        } else {
          crew.loyalty -= 1;
          state.flags.runnerSentOuter = assignment === "outer_run";
          state.player.heat = clamp(state.player.heat + 1, 0, 15);
          logEntry(state, "Eli misses the check-in. His burner rings once, then goes dark.", "bad");
        }
      } else if (person.id === "miri") {
        if (assignment === "source_cocaine") state.world.productAccess.cocaine = true;
        if (assignment === "source_meth" && state.world.influence.airport_industrial >= 1) state.world.productAccess.meth = true;
        const area = assignment === "source_meth" ? AREA_BY_ID.airport_industrial : AREA_BY_ID.downtown;
        const product = assignment === "source_meth" ? PRODUCT_BY_ID.meth : PRODUCT_BY_ID.cocaine;
        state.effects.rumors.push({ id: `miri_${state.run.day}_${state.run.slot}`, text: `Miri says ${product.name} is moving through ${area.name}, but the window will not stay open.`, areaId: area.id, productId: product.id, reliable: true, expiresAt: slotNumber(state.run.day, state.run.slot) + 4 });
        crew.loyalty += 1;
        logEntry(state, "Miri circles one name on her list and tears the rest of the page away.", "good");
      } else if (person.id === "tone") {
        if (assignment === "guard_base") {
          state.base.watched = false;
          state.rival.pressure = clamp(state.rival.pressure - 1, 0, 15);
          logEntry(state, "Tone spends the shift across from the garage. The sedan watching the door leaves first.", "good");
        } else {
          state.flags.toneIntimidatedBuyer = true;
          state.player.heat = clamp(state.player.heat + 2, 0, 15);
          influenceChange(state, "downtown", 1);
          logEntry(state, "Tone returns from Downtown with a buyer's apology and two patrol cars looking for his jacket.", "warn");
        }
      }
    }
  }

  function applyPressure(state, context, crossedDay) {
    const area = AREA_BY_ID[state.world.currentNeighborhoodId];
    if (context.reason === "TRAVEL") {
      state.player.heat = clamp(state.player.heat + Math.max(0, area.risk - 1), 0, 15);
      state.rival.pressure = clamp(state.rival.pressure + Math.max(0, area.rival - Math.floor(state.world.influence[area.id] / 2)), 0, 15);
    } else if (context.reason === "LAY_LOW") {
      const baseBonus = state.world.currentNeighborhoodId === "north_star_lot" ? state.base.tracks.security : 0;
      const danger = state.base.watched && state.world.currentNeighborhoodId === "north_star_lot" ? 1 : 0;
      state.player.heat = clamp(state.player.heat - Math.max(1, 2 + baseBonus - danger), 0, 15);
      state.rival.pressure = clamp(state.rival.pressure - 1, 0, 15);
    } else if (area.role === "Outer") {
      state.rival.pressure = clamp(state.rival.pressure + 1, 0, 15);
    }

    if (crossedDay) {
      for (const person of recruitedCrew(state)) {
        const crew = state.people.crew[person.id];
        if (crew.wageDue > 0) {
          crew.loyalty -= 1;
          state.flags.crewUnderpaid = true;
          logEntry(state, `${person.name.split(" ")[0]} sees yesterday's pay still sitting unpaid on the garage ledger.`, "bad");
        }
        crew.wageDue += person.wage;
      }
    }

    if (crossedDay && state.lender.balance > 0 && state.run.day > state.lender.dueDay) {
      state.lender.missedDays += 1;
      if (state.lender.lastPenaltyDay !== state.run.day) {
        const fee = Math.max(25, Math.round(state.lender.balance * 0.08));
        state.lender.balance += fee;
        state.lender.feesAdded += fee;
        state.lender.penaltyHistory.push({ day: state.run.day, slot: state.run.slot, amount: fee });
        state.lender.trust -= 1;
        state.lender.lastPenaltyDay = state.run.day;
        state.player.heat = clamp(state.player.heat + 1, 0, 15);
        logEntry(state, `Dre leaves the new total under the Mini-Mart wiper: $${state.lender.balance}. No greeting.`, "bad");
      }
    }
    state.lender.relationship = relationshipForLender(state.lender, state.run.day);
    state.rival.relationship = relationshipForRival(state.rival);
    state.people.mara.status = maraStatus(state.people.mara);
    state.stats.highestHeat = Math.max(state.stats.highestHeat, state.player.heat);
  }

  function event(id, title, description, choices) { return { id, title, description, choices }; }
  function setPendingEvent(state, item) { state.run.pendingEvent = item; }
  function activeEvent(id, state) {
    const events = {
      mara_intro: () => event("mara_intro", "The Night Clerk", "Mara Velez slides your coffee across the Mini-Mart counter. She looks past you at the same sedan that has circled twice.", [
        { label: "Tell her about the garage", effect: { maraTrust: 1, setFlags: { toldMaraAboutGarage: true } }, result: "Mara locks the front door for ten seconds and tells you which car has been watching North Star." },
        { label: "Keep it ordinary", effect: { maraTrust: 0 }, result: "You talk about the weather. Mara watches the sedan instead of believing you." },
      ]),
      eli_offer: () => event("eli_offer", "A Runner Without a Route", "Eli Ward waits beside an impound notice outside the garage. He knows every service road between North Star and the airport, but he needs paid work.", [
        { label: "Invite him to the garage", effect: { introduceCrew: "eli", crewLoyalty: { id: "eli", delta: 1 } }, result: "Eli folds the notice into his pocket and asks when the first route leaves." },
        { label: "Send him away", effect: { introduceCrew: "eli", crewLoyalty: { id: "eli", delta: -1 }, setFlags: { refusedEli: true } }, result: "Eli nods once. By morning, somebody else may own his route." },
      ]),
      miri_offer: () => event("miri_offer", "The List in Miri's Pocket", "Miri Cole takes the corner booth Downtown and places one torn page between the glasses. Half the names are crossed out; the remaining names still answer.", [
        { label: "Offer her a real share", effect: { introduceCrew: "miri", crewLoyalty: { id: "miri", delta: 2 }, setFlags: { gaveMiriOwnership: true } }, result: "Miri keeps the page and starts talking in terms of ‘we.’" },
        { label: "Ask to buy the list", effect: { introduceCrew: "miri", crewLoyalty: { id: "miri", delta: -1 } }, result: "Miri laughs without smiling. The names stay in her pocket." },
      ]),
      tone_offer: () => event("tone_offer", "Tone at the Garage Door", "Anton Bell stands under the broken security light and points out the sedan parked where your camera cannot see. Rook's people cost him his last job.", [
        { label: "Offer protection work", effect: { introduceCrew: "tone", crewLoyalty: { id: "tone", delta: 1 } }, result: "Tone checks the doorframe before he asks what the work pays." },
        { label: "Say the garage is handled", effect: { introduceCrew: "tone", crewLoyalty: { id: "tone", delta: -1 } }, result: "Tone looks at the bad lock, then at you. He leaves without arguing." },
      ]),
      mara_truth: () => event("mara_truth", "Mara Stops Asking Casually", "After closing, Mara sets the Mini-Mart keys between you. Someone followed her home, and she wants the truth before she decides what to do next.", [
        { label: "Tell her what the garage is", effect: { maraTrust: 2, setFlags: { toldMaraTruth: true } }, result: "Mara listens without interrupting. She does not approve, but now her next choice is hers." },
        { label: "Use her concern as an alibi", effect: { maraTrust: -2, heat: -1, setFlags: { usedMaraWithoutConsent: true } }, result: "The story works on the officer. Mara learns you used her name from somebody else." },
        { label: "Walk away from the question", effect: { maraTrust: -1 }, result: "Mara picks up the keys. The next coffee waits on the customer side of the counter." },
      ]),
      courier: () => event("courier", "Courier Behind Bay Twelve", "A courier lies beside an Industrial loading bay with a split lip and a locked case cuffed to one wrist. Headlights are moving at the far end of the lane.", [
        { label: "Spend supplies helping", effect: { cash: -55, heat: 1, setFlags: { helpedIndustrialCourier: true } }, result: "You cut the cuff and get the courier breathing. Before leaving, they whisper which service road will close on Day 6." },
        { label: "Search the case", effect: { cash: 160, heat: 2, setFlags: { robbedIndustrialCourier: true } }, result: "The case holds cash and a route sheet. The courier sees your face before you leave." },
        { label: "Leave before the headlights arrive", effect: {}, result: "You are gone before the cars arrive. The locked case appears in Rook's hand two nights later." },
      ]),
      dre_after_payoff: () => event("dre_after_payoff", "Dre Opens Another Door", "Dre counts the final stack across the hood behind the Mini-Mart. Then he gives you three ways to use the name you just earned.", [
        { label: "Take a larger note", effect: { secondLoan: true }, result: "Dre transfers $500. The new paper says $600 by the seventh night." },
        { label: "Ask for the supplier", effect: { access: "cocaine", lenderTrust: 1 }, result: "Dre writes one Downtown address on the back of your paid note and burns the rest." },
        { label: "Stay independent", effect: { influence: { areaId: "north_star_lot", delta: 1 }, lenderTrust: 1, setFlags: { refusedSecondNote: true } }, result: "Dre pockets the offer. ‘Then make your own door,’ he says." },
      ]),
      base_watch: () => event("base_watch", "The Sedan Across From the Garage", "The same gray sedan has held the curb for forty minutes. Its windshield faces the garage door; the engine never shuts off.", [
        { label: "Check the camera", requires: "security2", effect: { heat: -1, setFlags: { identifiedBaseWatcher: true }, baseWatched: false }, result: "The camera catches Rook's driver trading places with a plainclothes officer." },
        { label: "Move the valuable stock", effect: { heat: 1, baseWatched: true }, result: "You move the bags before dawn, but the sedan follows the second trip." },
        { label: "Leave the garage dark", effect: { baseWatched: true }, result: "Nobody enters. By morning, a chalk mark sits beside the lock." },
      ]),
      crew_crisis: () => event("crew_crisis", "A Crew Member Misses Check-In", "A burner vibrates on the garage table. The only message is an APD booking number and a demand for money before morning.", [
        { label: "Pay $180 and show up", effect: { cash: -180, crewAllLoyalty: 1, setFlags: { protectedCrewCrisis: true } }, result: "You are waiting when the side door opens. Nobody in the crew forgets that." },
        { label: "Protect the operation", effect: { crewAllLoyalty: -2, setFlags: { abandonedCrewCrisis: true } }, result: "The garage stays safe. The empty chair at the table says what it cost." },
      ]),
      buyer_hurry: () => event("buyer_hurry", "Cash Across the Hood", "Outside the Mini-Mart, a Downtown buyer counts an overpay across the hood while two customers wait. One of them steps away and makes a call.", [
        { label: "Take the overpay", effect: { cash: 140, heat: 1, setFlags: { buyerSeenAtMiniMart: true } }, result: "You leave with the extra cash. Mara watches the caller memorize your plate." },
        { label: "Move the deal elsewhere", effect: { influence: { areaId: "north_star_lot", delta: 1 }, heat: -1 }, result: "You send the buyer around the corner and keep the Mini-Mart out of it." },
      ]),
      checkpoint: () => event("checkpoint", "Cones on the Service Road", "APD closes the Airport service road with orange cones. An officer taps the rear panel while the line behind you grows.", [
        { label: "Pay the tow driver $90", effect: { cash: -90, heat: -1 }, result: "The tow driver opens a maintenance gate and never asks what is in the bag." },
        { label: "Risk the inspection", effect: { heat: 2, loseRandomInventory: 2, setFlags: { checkpointRecognizedVehicle: true } }, result: "The officer remembers the vehicle even after you leave two units behind." },
      ]),
      rook_cut: () => event("rook_cut", "Rook's Driver Blocks the Exit", "A black sedan stops across the Downtown exit. Rook's driver leaves the passenger door open and waits for your answer.", [
        { label: "Pay Rook $120", effect: { cash: -120, rivalPressure: -2, rivalRespect: 1, setFlags: { paidRookPassage: true } }, result: "The driver counts the cut once and gives you the next block without being asked." },
        { label: "Refuse the door", effect: { rivalPressure: 3, health: -8, setFlags: { refusedRookCut: true } }, result: "The sedan moves only after two people drag you away from the wheel." },
      ]),
      rough_night: () => event("rough_night", "Red Gloves at Bay Nine", "Three people step from behind the Industrial loading bay. One wears the red work gloves you saw near Rook's car.", [
        { label: "Leave $80 on the concrete", effect: { cash: -80, health: -3 }, result: "They take the money and leave the bag. The one in red gloves says there will be a next time." },
        { label: "Hold your ground", effect: { health: -14, rivalRespect: 1, rivalPressure: 1, setFlags: { industrialCrewEncountered: true } }, result: "You leave upright with blood on your collar. Rook hears that before the clinic does." },
      ]),
      dre_warning: () => event("dre_warning", "Dre Counts What Is Missing", "Dre parks behind the Mini-Mart and counts your partial stack on the hood. He returns one folded bill and asks when the rest is coming.", [
        { label: "Name the next payment", effect: { lenderTrust: 1, setFlags: { dreGoodFaithPayment: true } }, result: "Dre keeps the stack and the date. For now, that is enough." },
        { label: "Tell him to wait", effect: { lenderTrust: -2, heat: 1 }, result: "Dre closes his jacket over the money and makes one call before you leave." },
      ]),
    };
    const factory = events[id];
    if (!factory) return null;
    const built = factory();
    built.choices = built.choices.filter((choice) => {
      if (choice.requires === "security2") return state.base.tracks.security >= 2;
      return true;
    });
    return built;
  }

  function startEncounter(state, id, finishAfter) {
    const templates = {
      early: { title: "Mini-Mart Parking Lot Threat", description: "A man from the gray sedan catches the Mini-Mart door before it closes. Mara is behind the counter; your bag is over one shoulder.", enemyName: "Parking Lot Collector", enemyHealth: 24, guard: 0.08, evasion: 0.05, pursuit: 0.10, attack: [5, 10], pay: 85 },
      mid: { title: "Rook's Loading-Bay Test", description: "Rook's people close both ends of Bay Nine. They know about the garage, the crew, and which route you used to get here.", enemyName: "Rook's Crew", enemyHealth: 42, guard: 0.14, evasion: 0.10, pursuit: 0.16, attack: [8, 14], pay: 180 },
      late: { title: "The Seventh-Night Consequence", description: "The final plan reaches the garage before you do. Red-and-blue light washes over Rook's sedan while everybody waits to see who you protect.", enemyName: "Final Opposition", enemyHealth: 58, guard: 0.18, evasion: 0.13, pursuit: 0.20, attack: [10, 18], pay: 320 },
    };
    const template = templates[id];
    if (!template) return;
    state.run.pendingEncounter = { id, step: 1, enemyHealth: template.enemyHealth, feedback: template.description, finishAfter: !!finishAfter, ...template };
  }

  function eventEligible(state, id) { return !state.run.recentEvents.includes(id); }
  function scheduleStory(state, context, random) {
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.status !== "playing") return;
    const absolute = slotNumber(state.run.day, state.run.slot);
    let id = null;
    if (!state.flags.maraIntroResolved && absolute >= 1) id = "mara_intro";
    else if (!state.flags.eliOfferResolved && absolute >= 3) id = "eli_offer";
    else if (!state.flags.earlyThreatResolved && state.run.day >= 2) { startEncounter(state, "early", false); return; }
    else if (state.lender.afterPayoffOffer === "available" && !state.flags.dreAfterPayoffResolved) id = "dre_after_payoff";
    else if (!state.flags.maraTruthResolved && state.people.mara.met && state.run.day >= 3 && random.next() < 0.45) id = "mara_truth";
    else if (!state.flags.courierResolved && state.run.day >= 3 && random.next() < 0.35) id = "courier";
    else if (!state.flags.miriOfferResolved && state.run.day >= 3 && random.next() < 0.4) id = "miri_offer";
    else if (!state.flags.toneOfferResolved && state.run.day >= 4 && random.next() < 0.45) id = "tone_offer";
    else if (!state.flags.midThreatResolved && state.run.day >= 4) { startEncounter(state, "mid", false); return; }
    else if (!state.flags.baseWatchResolved && state.run.day >= 5 && baseValue(state) > 0 && random.next() < 0.55) id = "base_watch";
    else if (!state.flags.crewCrisisResolved && state.run.day >= 5 && recruitedCrew(state).length && random.next() < 0.45) id = "crew_crisis";
    else {
      const area = AREA_BY_ID[state.world.currentNeighborhoodId];
      const chance = Math.min(0.38, 0.12 + state.player.heat * 0.01 + area.risk * 0.015);
      if (random.next() <= chance) {
        const eligible = ["buyer_hurry"];
        if (state.player.heat >= 5 || area.police >= 3) eligible.push("checkpoint");
        if (state.rival.pressure >= 5 || area.rival >= 3) eligible.push("rook_cut");
        if (area.risk >= 3 || state.player.health < 65) eligible.push("rough_night");
        if (state.lender.balance > 0 && state.run.day >= state.lender.dueDay) eligible.push("dre_warning");
        const fresh = eligible.filter((eventId) => eventEligible(state, eventId));
        if (fresh.length) id = random.pick(fresh);
      }
    }
    if (id) setPendingEvent(state, activeEvent(id, state));
  }

  function applyEventEffect(state, effect, random) {
    const cashBefore = state.player.cash;
    state.player.cash = Math.max(0, state.player.cash + (effect.cash || 0));
    state.player.health = clamp(state.player.health + (effect.health || 0), 0, 100);
    state.player.heat = clamp(state.player.heat + (effect.heat || 0), 0, 15);
    state.rival.pressure = clamp(state.rival.pressure + (effect.rivalPressure || 0), 0, 15);
    state.rival.respect += effect.rivalRespect || 0;
    state.lender.trust += effect.lenderTrust || 0;
    state.people.mara.trust += effect.maraTrust || 0;
    if (effect.influence) influenceChange(state, effect.influence.areaId, effect.influence.delta);
    if (effect.setFlags) Object.assign(state.flags, effect.setFlags);
    if (effect.introduceCrew && state.people.crew[effect.introduceCrew]) state.people.crew[effect.introduceCrew].introduced = true;
    if (effect.crewLoyalty && state.people.crew[effect.crewLoyalty.id]) state.people.crew[effect.crewLoyalty.id].loyalty += effect.crewLoyalty.delta;
    if (effect.crewAllLoyalty) for (const person of recruitedCrew(state)) state.people.crew[person.id].loyalty += effect.crewAllLoyalty;
    if (effect.baseWatched !== undefined) state.base.watched = effect.baseWatched;
    if (effect.access) state.world.productAccess[effect.access] = true;
    if (effect.secondLoan) {
      state.player.cash += 500;
      state.lender.principal = 600;
      state.lender.balance = 600;
      state.lender.dueDay = 7;
      state.lender.afterPayoffOffer = "accepted";
      state.flags.acceptedSecondNote = true;
    }
    if (effect.loseRandomInventory) {
      const held = PRODUCTS.filter((product) => state.player.inventory[product.id].qty > 0);
      if (held.length) {
        const product = random.pick(held);
        const lost = Math.min(effect.loseRandomInventory, state.player.inventory[product.id].qty);
        state.player.inventory[product.id].qty -= lost;
        if (!state.player.inventory[product.id].qty) state.player.inventory[product.id].avgCost = 0;
        logEntry(state, `The officer leaves ${lost} ${product.name} on the inspection table and keeps the rest.`, "bad");
      }
    }
    if (effect.cash < 0) state.stats.moneySpent.events += Math.min(cashBefore, -effect.cash);
    state.stats.largestLoss = Math.max(state.stats.largestLoss, Math.max(0, cashBefore - state.player.cash));
    state.lender.relationship = relationshipForLender(state.lender, state.run.day);
    state.rival.relationship = relationshipForRival(state.rival);
    state.people.mara.status = maraStatus(state.people.mara);
  }

  function endingLabel(id) {
    return ({
      one_good_run: "One Good Run", quiet_operation: "Quiet Operation", still_owing: "Still Owing",
      mara_escape: "Two Tickets South", clean_exit: "Clean Exit", rook_partner: "Rook's Partner",
      takeover: "North Star Takes the Week", dre_expansion: "Dre's New Operator", crew_saved: "Everybody Gets Home",
      disappeared: "Gone Before Dawn", arrested: "Caught", killed: "Taken Down", base_lost: "The Garage Is Gone",
    })[id] || "Run Complete";
  }
  function chooseEnding(state, forced) {
    if (forced) return forced;
    if (state.player.health <= 0) return state.base.tracks.recovery >= 2 ? "base_lost" : "killed";
    if (state.player.heat >= 15) return "arrested";
    if (state.base.damage >= 3) return "base_lost";
    const plan = state.run.finalPlan;
    if (plan === "escape" && state.people.mara.trust >= 3 && !state.people.mara.usedWithoutConsent) return "mara_escape";
    if (plan === "escape") return "clean_exit";
    if (plan === "partner" && state.rival.respect >= 2) return "rook_partner";
    if (plan === "challenge" && Object.values(state.world.influence).reduce((a, b) => a + b, 0) >= 5) return "takeover";
    if (state.flags.acceptedSecondNote && state.lender.balance <= 0) return "dre_expansion";
    if (plan === "defend" && recruitedCrew(state).some((person) => state.people.crew[person.id].loyalty >= 1)) return "crew_saved";
    if (plan === "last_score" && operationScore(state) >= 1300 && state.lender.balance <= 0) return "one_good_run";
    if (state.lender.balance > 0) return "still_owing";
    if (operationScore(state) >= 800) return "quiet_operation";
    return "clean_exit";
  }
  function endRun(state, forced) {
    state.run.status = "ended";
    state.run.pendingEvent = null;
    state.run.pendingEncounter = null;
    state.run.ending = chooseEnding(state, forced);
    logEntry(state, `By sunrise, the week has a name: ${endingLabel(state.run.ending)}.`, state.run.ending === "one_good_run" ? "good" : "warn");
  }

  function advanceRun(inputState, context) {
    const state = copyState(inputState);
    if (state.run.status !== "playing" || state.run.pendingEvent || state.run.pendingEncounter) return state;
    const random = makeRandom(state.run.rngState);
    const oldDay = state.run.day, oldSlot = state.run.slot;
    closeVisit(state, context.reason);
    const finalSlot = oldDay === RUN_DAYS && oldSlot === 3;
    if (!finalSlot) {
      if (oldSlot === 3) { state.run.day += 1; state.run.slot = 0; }
      else state.run.slot += 1;
    }
    const crossedDay = !finalSlot && oldSlot === 3;
    expireEffects(state);
    evolveMarkets(state, random);
    resolveCrewAssignments(state, random);
    applyPressure(state, context, crossedDay);
    state.stats.pipelineAdvances += 1;
    state.stats.decisions += 1;
    if (crossedDay) state.run.daySummary = { day: oldDay, netWorth: netWorth(state), operationScore: operationScore(state), heat: state.player.heat, debt: state.lender.balance, health: state.player.health, baseValue: baseValue(state), crew: recruitedCrew(state).length };
    if (state.player.health <= 0 || state.player.heat >= 15) endRun(state);
    else if (finalSlot) endRun(state);
    else scheduleStory(state, context, random);
    state.run.rngState = random.state;
    return state;
  }

  function healthModifier(health) { return health > 75 ? 0.05 : health < 40 ? -0.12 : 0; }
  function freeCargoRatio(state) { return clamp((cargoCapacity(state) - cargoUsed(state)) / Math.max(1, cargoCapacity(state)), 0, 1); }
  function encounterChoices(state) {
    const encounter = state.run.pendingEncounter;
    if (!encounter) return [];
    const choices = [
      { id: "talk", label: "Talk", description: "Use instinct, influence, and relationships." },
      { id: "run", label: "Run", description: "Health, Instinct, shoes, and a light bag matter." },
    ];
    if (state.player.cash >= encounter.pay) choices.push({ id: "pay", label: `Pay $${encounter.pay}`, description: "Keep the bag and accept the cost." });
    if (cargoUsed(state) > 0) choices.push({ id: "surrender", label: "Surrender product", description: "Protect health by giving up part of the bag." });
    const weapon = equippedWeapon(state);
    if (weapon?.type === "close" || state.player.stats.grit >= 3) choices.push({ id: "fight", label: weapon ? `Fight with ${weapon.name}` : "Fight", description: "Grit, health, armor, and close protection matter." });
    if (weapon?.type === "firearm") choices.push({ id: "draw", label: `Draw ${weapon.name}`, description: "Aim and accuracy matter. Firing raises heat." });
    const tone = state.people.crew.tone;
    if (tone.recruited && tone.loyalty >= 0) choices.push({ id: "call_tone", label: "Call Tone", description: "Spend crew loyalty to end this on his terms." });
    if (encounter.id === "early" && state.people.mara.trust >= 2 && state.people.mara.met) choices.push({ id: "call_mara", label: "Signal Mara", description: "Let her trigger the Mini-Mart alarm." });
    if (encounter.id === "late" && state.base.tracks.security >= 1) choices.push({ id: "use_base", label: "Fall back to the garage", description: "Security and crew assignments determine the result." });
    if (state.player.gear.consumables.medical_kit > 0 && state.player.health < 100) choices.push({ id: "medical_kit", label: "Use medical kit", description: "Recover before making the next move." });
    return choices;
  }

  function loseInventory(state, qty) {
    const held = PRODUCTS.filter((product) => state.player.inventory[product.id].qty > 0).sort((a, b) => (state.world.markets[state.world.currentNeighborhoodId].prices[b.id] || 0) - (state.world.markets[state.world.currentNeighborhoodId].prices[a.id] || 0));
    if (!held.length) return null;
    const product = held[0], lost = Math.min(qty, state.player.inventory[product.id].qty);
    state.player.inventory[product.id].qty -= lost;
    if (!state.player.inventory[product.id].qty) state.player.inventory[product.id].avgCost = 0;
    return { product, lost };
  }
  function finishEncounter(state, result, text) {
    const encounter = state.run.pendingEncounter;
    state.run.pendingEncounter = null;
    state.run.encounterCount += 1;
    state.flags[`${encounter.id}ThreatResolved`] = true;
    state.flags[`${encounter.id}EncounterResult`] = result;
    state.stats.majorDecisions.push(`${encounter.title}: ${result}`);
    logEntry(state, text, result === "win" || result === "escape" || result === "talk" ? "good" : "warn");
    if (encounter.finishAfter) endRun(state);
  }
  function failEncounterStep(state, random, action) {
    const encounter = state.run.pendingEncounter;
    const armor = GEAR_BY_ID[state.player.gear.equipped.armor]?.armor || 0;
    const raw = random.int(encounter.attack[0], encounter.attack[1]);
    const damage = Math.max(1, raw - armor - Math.floor(state.player.stats.grit / 2));
    state.player.health = clamp(state.player.health - damage, 0, 100);
    encounter.step += 1;
    encounter.feedback = `${action} fails. ${encounter.enemyName} closes the distance and you lose ${damage} health.`;
    if (state.player.health <= 0) { endRun(state, state.base.tracks.recovery >= 2 ? "base_lost" : "killed"); return; }
    if (encounter.step > 3) {
      const loss = Math.min(state.player.cash, encounter.pay);
      state.player.cash -= loss;
      state.stats.largestLoss = Math.max(state.stats.largestLoss, loss);
      finishEncounter(state, "loss", `${encounter.enemyName} takes $${loss} and leaves you standing only long enough to remember it.`);
    }
  }

  function reduceEncounter(inputState, action) {
    const state = copyState(inputState), encounter = state.run.pendingEncounter;
    if (!encounter) return inputState;
    const available = encounterChoices(state).map((item) => item.id);
    if (!available.includes(action.choiceId)) return inputState;
    const random = makeRandom(state.run.rngState);
    const choice = action.choiceId;
    if (["fight", "draw", "run", "talk", "pay"].includes(choice)) state.stats.encounterChoices[choice === "draw" ? "fight" : choice] += 1;
    else state.stats.encounterChoices.other += 1;

    if (choice === "pay") {
      state.player.cash -= encounter.pay;
      state.stats.moneySpent.events += encounter.pay;
      finishEncounter(state, "paid", `You leave $${encounter.pay} on the hood. The lane opens, but everybody sees who collected.`);
    } else if (choice === "surrender") {
      const lost = loseInventory(state, encounter.id === "late" ? 3 : 2);
      finishEncounter(state, "surrendered", lost ? `You set down ${lost.lost} ${lost.product.name}. They take the product and let you keep your pulse.` : "The empty bag buys you a few seconds to leave.");
    } else if (choice === "call_tone") {
      state.people.crew.tone.loyalty -= 1;
      state.player.heat = clamp(state.player.heat + 2, 0, 15);
      finishEncounter(state, "win", "Tone arrives without raising his voice. The other side leaves, and two nearby windows close their blinds.");
    } else if (choice === "call_mara") {
      state.people.mara.trust -= 1;
      state.player.heat = clamp(state.player.heat + 1, 0, 15);
      finishEncounter(state, "escape", "Mara hits the Mini-Mart alarm. The collector runs before the patrol car reaches the lot.");
    } else if (choice === "use_base") {
      const defense = state.base.tracks.security + (state.people.crew.tone.assignment === "guard_base" ? 1 : 0);
      if (random.next() < 0.38 + defense * 0.18) finishEncounter(state, "win", "The reinforced garage door holds while the camera catches every face outside it.");
      else { state.base.damage += 1; failEncounterStep(state, random, "The garage defense"); }
    } else if (choice === "medical_kit") {
      state.player.gear.consumables.medical_kit -= 1;
      state.player.health = clamp(state.player.health + GEAR_BY_ID.medical_kit.heal, 0, 100);
      encounter.step += 1;
      encounter.feedback = "You seal the worst injury and force your hands steady. One decision remains.";
    } else if (choice === "talk") {
      const influence = state.world.influence[state.world.currentNeighborhoodId] * 0.04;
      const relationship = encounter.id === "mid" ? state.rival.respect * 0.035 : state.people.mara.trust * 0.02;
      const chance = clamp(0.28 + state.player.stats.instinct * 0.08 + influence + relationship - encounter.guard, 0.10, 0.90);
      if (random.next() < chance) {
        if (encounter.id === "mid") state.rival.respect += 1;
        finishEncounter(state, "talk", "You name the people and consequences they forgot to count. The lane opens without anybody reaching for a weapon.");
      } else failEncounterStep(state, random, "The explanation");
    } else if (choice === "run") {
      const gearBonus = GEAR_BY_ID[state.player.gear.equipped.utility]?.escape || 0;
      const chance = clamp(0.24 + state.player.stats.instinct * 0.09 + gearBonus + 0.18 * freeCargoRatio(state) + healthModifier(state.player.health) - encounter.pursuit, 0.10, 0.90);
      if (random.next() < chance) {
        const lost = encounter.id === "early" ? null : loseInventory(state, 1);
        finishEncounter(state, "escape", lost ? `You clear the lane but drop ${lost.lost} ${lost.product.name} under the fence.` : "You saw the open lane before they did and reach the street with the bag intact.");
      } else failEncounterStep(state, random, "The escape");
    } else if (choice === "fight" || choice === "draw") {
      const weapon = equippedWeapon(state);
      const firearm = choice === "draw";
      const chance = clamp((firearm ? 0.28 + state.player.stats.aim * 0.09 : 0.30 + state.player.stats.grit * 0.09) + (weapon?.accuracy || 0) + healthModifier(state.player.health) - (firearm ? encounter.evasion : encounter.guard), 0.10, 0.90);
      if (firearm) {
        state.player.heat = clamp(state.player.heat + weapon.heat, 0, 15);
        state.flags.firedWeaponDowntown = state.world.currentNeighborhoodId === "downtown";
      }
      if (random.next() < chance) {
        const damage = weapon ? random.int(weapon.damage[0], weapon.damage[1]) + (firearm ? 0 : Math.floor(state.player.stats.grit / 2)) : random.int(4, 8) + state.player.stats.grit;
        encounter.enemyHealth -= damage;
        if (encounter.enemyHealth <= 0) {
          if (firearm || encounter.id === "late") state.flags.seriousViolence = true;
          state.rival.respect += 1;
          influenceChange(state, state.world.currentNeighborhoodId, 1);
          finishEncounter(state, "win", firearm ? "The shot ends the argument and starts three new ones across the neighborhood." : "You stay on your feet after the other side cannot. Word moves before you do.");
        } else {
          encounter.feedback = `${weapon?.name || "Your hands"} lands for ${damage}. ${encounter.enemyHealth} resolve remains on the other side.`;
          failEncounterStep(state, random, "The counterattack");
        }
      } else failEncounterStep(state, random, firearm ? "The shot" : "The swing");
    }
    state.people.mara.status = maraStatus(state.people.mara);
    state.run.rngState = random.state;
    return state;
  }

  function reduceGame(inputState, action) {
    if (!inputState || !action || !action.type) return inputState;
    if (action.type === "NEW_RUN") return createRun({ seed: action.seed });
    if (action.type === "CHOOSE_BACKGROUND") {
      if (inputState.run.status !== "choosing_background") return inputState;
      const background = BACKGROUNDS.find((item) => item.id === action.backgroundId);
      if (!background) return inputState;
      const state = copyState(inputState);
      state.player.background = background.id;
      state.player.cash = background.cash;
      state.player.heat = background.heat;
      state.player.stats = { aim: background.aim, grit: background.grit, instinct: background.instinct };
      state.run.status = "playing";
      state.stats.startingNetWorth = background.cash - state.lender.balance;
      state.log = [];
      logEntry(state, "The North Star Garage key sticks once before the lock turns. Seven nights start now.", "warn");
      return state;
    }
    if (action.type === "RESOLVE_ENCOUNTER") return reduceEncounter(inputState, action);

    const state = copyState(inputState);
    if (state.run.status !== "playing" && action.type !== "DISMISS_DAY_SUMMARY") return inputState;
    if (action.type === "DISMISS_DAY_SUMMARY") { state.run.daySummary = null; return state; }
    if (state.run.pendingEncounter) return inputState;
    if (state.run.pendingEvent && action.type !== "RESOLVE_EVENT") return inputState;

    const random = makeRandom(state.run.rngState);
    if (action.type === "RESOLVE_EVENT") {
      const current = state.run.pendingEvent;
      const choice = current?.choices?.[action.choiceIndex];
      if (!current || !choice) return inputState;
      state.run.pendingEvent = null;
      applyEventEffect(state, choice.effect || {}, random);
      logEntry(state, choice.result, (choice.effect?.cash || 0) >= 0 ? "good" : "warn");
      state.stats.majorDecisions.push(`${current.title}: ${choice.label}`);
      state.run.recentEvents = [current.id, ...state.run.recentEvents.filter((id) => id !== current.id)].slice(0, 4);
      state.flags[`${current.id.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())}Resolved`] = true;
      if (current.id === "mara_intro") { state.people.mara.met = true; state.flags.maraIntroResolved = true; }
      if (current.id === "eli_offer") state.flags.eliOfferResolved = true;
      if (current.id === "miri_offer") state.flags.miriOfferResolved = true;
      if (current.id === "tone_offer") state.flags.toneOfferResolved = true;
      if (current.id === "mara_truth") state.flags.maraTruthResolved = true;
      if (current.id === "courier") state.flags.courierResolved = true;
      if (current.id === "dre_after_payoff") { state.flags.dreAfterPayoffResolved = true; if (state.lender.afterPayoffOffer === "available") state.lender.afterPayoffOffer = "resolved"; }
      if (current.id === "base_watch") state.flags.baseWatchResolved = true;
      if (current.id === "crew_crisis") state.flags.crewCrisisResolved = true;
      state.run.rngState = random.state;
      if (state.player.health <= 0 || state.player.heat >= 15) endRun(state);
      return state;
    }

    if (action.type === "BUY") {
      const product = PRODUCT_BY_ID[action.productId], market = state.world.markets[state.world.currentNeighborhoodId];
      const qty = Math.max(0, Math.floor(action.qty || 0));
      if (!product || qty < 1 || !state.world.productAccess[product.id]) return inputState;
      const cost = market.prices[product.id] * qty, available = market.availability[product.id] || 0;
      if (qty > available || cost > state.player.cash || cargoUsed(state) + qty > cargoCapacity(state)) return inputState;
      const item = state.player.inventory[product.id], totalQty = item.qty + qty;
      item.avgCost = ((item.avgCost * item.qty) + cost) / totalQty;
      item.qty = totalQty;
      state.player.cash -= cost;
      market.availability[product.id] -= qty;
      state.player.heat = clamp(state.player.heat + Math.floor((product.heat * qty) / 5), 0, 15);
      state.run.currentVisit.trades += 1;
      state.run.currentVisit.grossBuy += cost;
      logEntry(state, `You move ${qty} ${product.name} into the bag for $${cost}.`, "good");
      return state;
    }
    if (action.type === "SELL") {
      const product = PRODUCT_BY_ID[action.productId], market = state.world.markets[state.world.currentNeighborhoodId];
      const qty = Math.max(0, Math.floor(action.qty || 0));
      if (!product || qty < 1 || state.player.inventory[product.id].qty < qty) return inputState;
      const item = state.player.inventory[product.id];
      const influenceBonus = Math.min(0.04, state.world.influence[state.world.currentNeighborhoodId] * 0.01);
      const unitPrice = Math.round(market.prices[product.id] * (0.95 + influenceBonus));
      const total = unitPrice * qty, profit = total - item.avgCost * qty;
      item.qty -= qty;
      if (!item.qty) item.avgCost = 0;
      state.player.cash += total;
      state.run.currentVisit.trades += 1;
      state.run.currentVisit.grossSell += total;
      state.stats.productsMoved[product.id] += qty;
      state.stats.bestTrade = Math.max(state.stats.bestTrade, total);
      state.stats.largestLoss = Math.max(state.stats.largestLoss, Math.max(0, -profit));
      if (profit > 0 && qty >= 3 && !state.world.tradeInfluenceGranted[state.world.currentNeighborhoodId]) {
        influenceChange(state, state.world.currentNeighborhoodId, 1);
        state.world.tradeInfluenceGranted[state.world.currentNeighborhoodId] = true;
      }
      logEntry(state, `The buyer takes ${qty} ${product.name}. You count $${total} before leaving the block.`, profit >= 0 ? "good" : "bad");
      return state;
    }

    if (action.type === "STORE_CASH" || action.type === "RETRIEVE_CASH") {
      if (!state.base.visiting) return inputState;
      const amount = Math.max(0, Math.floor(action.amount || 0));
      if (!amount) return inputState;
      if (action.type === "STORE_CASH") {
        if (amount > state.player.cash || state.base.storedCash + amount > storedCashCapacity(state)) return inputState;
        state.player.cash -= amount; state.base.storedCash += amount;
        logEntry(state, `You lock $${amount} inside the garage compartment.`, "good");
      } else {
        if (amount > state.base.storedCash) return inputState;
        state.base.storedCash -= amount; state.player.cash += amount;
        logEntry(state, `You pull $${amount} back into street cash.`, "warn");
      }
      return state;
    }
    if (action.type === "STORE_PRODUCT" || action.type === "RETRIEVE_PRODUCT") {
      if (!state.base.visiting || !PRODUCT_BY_ID[action.productId]) return inputState;
      const qty = Math.max(0, Math.floor(action.qty || 0));
      if (!qty) return inputState;
      const carried = state.player.inventory[action.productId], stored = state.base.storedInventory[action.productId];
      if (action.type === "STORE_PRODUCT") {
        if (qty > carried.qty || storedCargoUsed(state) + qty > storageCapacity(state)) return inputState;
        const total = stored.qty + qty;
        stored.avgCost = total ? ((stored.avgCost * stored.qty) + carried.avgCost * qty) / total : 0;
        stored.qty = total; carried.qty -= qty; if (!carried.qty) carried.avgCost = 0;
      } else {
        if (qty > stored.qty || cargoUsed(state) + qty > cargoCapacity(state)) return inputState;
        const total = carried.qty + qty;
        carried.avgCost = total ? ((carried.avgCost * carried.qty) + stored.avgCost * qty) / total : 0;
        carried.qty = total; stored.qty -= qty; if (!stored.qty) stored.avgCost = 0;
      }
      logEntry(state, `${action.type === "STORE_PRODUCT" ? "Stored" : "Retrieved"} ${qty} ${PRODUCT_BY_ID[action.productId].name} at the garage.`, "");
      return state;
    }
    if (action.type === "PAY_CREW") {
      if (!state.base.visiting || !CREW_BY_ID[action.crewId]) return inputState;
      const crew = state.people.crew[action.crewId];
      if (!crew.recruited || crew.wageDue <= 0 || state.player.cash < crew.wageDue) return inputState;
      const amount = crew.wageDue;
      state.player.cash -= amount; crew.wageDue = 0; crew.loyalty += 1; state.stats.moneySpent.crew += amount;
      logEntry(state, `${CREW_BY_ID[action.crewId].name.split(" ")[0]} folds the full $${amount} into a pocket and stays for the next plan.`, "good");
      return state;
    }

    let base = state;
    if (action.type === "TRAVEL") {
      if (!AREA_BY_ID[action.neighborhoodId] || action.neighborhoodId === state.world.currentNeighborhoodId) return inputState;
      base.world.currentNeighborhoodId = action.neighborhoodId;
      logEntry(base, `You reach ${AREA_BY_ID[action.neighborhoodId].name} before the same headlights can settle behind you.`, "");
      return advanceRun(base, { reason: "TRAVEL" });
    }
    if (action.type === "END_MARKET") { logEntry(base, "The last buyer leaves and the neighborhood starts pricing tomorrow's rumors.", ""); return advanceRun(base, { reason: "END_MARKET" }); }
    if (action.type === "LAY_LOW") { logEntry(base, state.base.watched ? "You kill the garage lights, but the sedan across the street never leaves." : "You kill the lights and let North Star forget your vehicle for a few hours.", ""); return advanceRun(base, { reason: "LAY_LOW" }); }
    if (action.type === "VISIT_BASE") {
      const next = advanceRun(base, { reason: "VISIT_BASE" });
      if (next.run.status === "playing") next.base.visiting = true;
      logEntry(next, "The North Star Garage door rolls down behind you. Storage, crew, and upgrades are available until you leave.", "");
      return next;
    }
    if (action.type === "HEAL") {
      const cost = Math.max(0, Math.floor(action.cost || 0)), amount = Math.max(0, Math.floor(action.amount || 0));
      if (!amount || state.player.health >= 100 || state.player.cash < cost) return inputState;
      base.player.cash -= cost; base.player.health = clamp(base.player.health + amount, 0, 100); base.stats.moneySpent.healing += cost;
      logEntry(base, `The clinic worker closes the curtain and repairs ${amount} health for $${cost}.`, "good");
      return advanceRun(base, { reason: "HEAL" });
    }
    if (action.type === "HEAL_AT_BASE") {
      if (!state.base.visiting || state.base.tracks.recovery < 1 || state.player.health >= 100) return inputState;
      const cost = state.base.tracks.recovery >= 2 ? 25 : 45, amount = state.base.tracks.recovery >= 2 ? 35 : 22;
      if (state.player.cash < cost) return inputState;
      base.player.cash -= cost; base.player.health = clamp(base.player.health + amount, 0, 100); base.stats.moneySpent.healing += cost;
      logEntry(base, `The garage first-aid table puts ${amount} health back before the next knock.`, "good");
      return advanceRun(base, { reason: "HEAL_AT_BASE" });
    }
    if (action.type === "PAY_DEBT") {
      const amount = Math.min(state.lender.balance, Math.max(0, Math.floor(action.amount || 0)));
      if (!amount || state.player.cash < amount) return inputState;
      base.player.cash -= amount; base.lender.balance -= amount; base.lender.payments += amount; base.lender.paymentCount += 1;
      base.lender.paymentHistory.push({ day: base.run.day, slot: base.run.slot, amount });
      base.lender.trust += amount >= 150 ? 1 : 0; base.stats.moneySpent.debt += amount;
      if (!base.lender.balance) {
        base.lender.trust += 2; base.lender.clearedAt = { day: base.run.day, slot: base.run.slot }; base.lender.afterPayoffOffer = "available";
        base.flags.drePaidEarly = base.run.day <= base.lender.dueDay;
      }
      base.lender.relationship = relationshipForLender(base.lender, base.run.day);
      logEntry(base, base.lender.balance ? `Dre counts $${amount} behind the Mini-Mart. $${base.lender.balance} stays written on the note.` : "Dre counts the final stack, tears the note in half, and keeps one piece.", "good");
      return advanceRun(base, { reason: "PAY_DEBT" });
    }
    if (action.type === "UPGRADE_BASE") {
      if (!state.base.visiting) return inputState;
      const track = action.track, nextLevel = (state.base.tracks[track] || 0) + 1;
      const upgrade = BASE_UPGRADES.find((item) => item.track === track && item.level === nextLevel);
      if (!upgrade || state.player.cash < upgrade.cost) return inputState;
      base.player.cash -= upgrade.cost; base.base.tracks[track] = nextLevel; base.stats.moneySpent.base += upgrade.cost;
      logEntry(base, `${upgrade.name} changes what the garage can protect.`, "good");
      return advanceRun(base, { reason: "UPGRADE_BASE" });
    }
    if (action.type === "BUY_GEAR") {
      if (!state.base.visiting) return inputState;
      const item = GEAR_BY_ID[action.gearId];
      if (!item || state.player.cash < item.cost || (item.id !== "medical_kit" && hasGear(state, item.id))) return inputState;
      base.player.cash -= item.cost; base.stats.moneySpent.gear += item.cost;
      if (item.id === "medical_kit") base.player.gear.consumables.medical_kit += 1;
      else {
        base.player.gear.owned.push(item.id);
        if (["weapon", "armor", "utility", "tool"].includes(item.slot)) base.player.gear.equipped[item.slot] = item.id;
      }
      logEntry(base, `${item.name} goes onto the garage shelf and into the week's plan.`, "good");
      return advanceRun(base, { reason: "BUY_GEAR" });
    }
    if (action.type === "RECRUIT_CREW") {
      if (!state.base.visiting || !CREW_BY_ID[action.crewId] || recruitedCrew(state).length >= 2) return inputState;
      const person = CREW_BY_ID[action.crewId], crew = state.people.crew[action.crewId];
      if (!crew.introduced || crew.recruited || state.player.cash < person.recruitCost) return inputState;
      base.player.cash -= person.recruitCost; crew.recruited = true; crew.status = "active"; crew.loyalty += 1; crew.wageDue = person.wage; base.stats.moneySpent.crew += person.recruitCost;
      logEntry(base, `${person.name} takes the chair at the garage table. The operation has another person to answer for.`, "good");
      return advanceRun(base, { reason: "RECRUIT_CREW" });
    }
    if (action.type === "ASSIGN_CREW") {
      if (!state.base.visiting || !CREW_BY_ID[action.crewId]) return inputState;
      const crew = state.people.crew[action.crewId];
      if (!crew.recruited || crew.assignment) return inputState;
      const allowed = { eli: ["north_run", "outer_run"], miri: ["source_cocaine", "source_meth"], tone: ["guard_base", "intimidate_buyer"] };
      if (!allowed[action.crewId].includes(action.assignment)) return inputState;
      crew.assignment = action.assignment;
      logEntry(base, `${CREW_BY_ID[action.crewId].name.split(" ")[0]} leaves the garage with one assignment and one promised check-in.`, "");
      return advanceRun(base, { reason: "ASSIGN_CREW" });
    }
    if (action.type === "VISIT_MARA") {
      if (!state.people.mara.met) return inputState;
      const cost = 40;
      if (state.player.cash < cost) return inputState;
      base.player.cash -= cost; base.people.mara.trust += 1; base.stats.moneySpent.relationships += cost;
      if (base.player.health < 75 && base.people.mara.trust >= 3) base.player.health = clamp(base.player.health + 12, 0, 100);
      logEntry(base, "You leave the market unopened for one hour and sit with Mara after the Mini-Mart closes.", "good");
      return advanceRun(base, { reason: "VISIT_MARA" });
    }
    if (action.type === "INVEST_NEIGHBORHOOD") {
      const areaId = action.neighborhoodId;
      if (!AREA_BY_ID[areaId] || state.world.currentNeighborhoodId !== areaId || state.world.influence[areaId] >= 4 || state.player.cash < 150) return inputState;
      base.player.cash -= 150; influenceChange(base, areaId, 1); base.stats.moneySpent.base += 150;
      logEntry(base, `You put $150 into a promise people in ${AREA_BY_ID[areaId].name} can see.`, "good");
      return advanceRun(base, { reason: "INVEST_NEIGHBORHOOD" });
    }
    if (action.type === "PREPARE_FINAL_PLAN") {
      const allowed = ["escape", "defend", "partner", "challenge", "last_score"];
      if (state.run.day < 6 || !allowed.includes(action.planId) || state.run.finalPlanPrepared) return inputState;
      base.run.finalPlan = action.planId; base.run.finalPlanPrepared = true;
      base.stats.majorDecisions.push(`Prepared final plan: ${action.planId}`);
      logEntry(base, `The garage table is cleared for one final plan: ${action.planId.replace("_", " ")}.`, "warn");
      return advanceRun(base, { reason: "PREPARE_FINAL_PLAN" });
    }
    if (action.type === "EXECUTE_FINAL_PLAN") {
      if (state.run.day !== 7 || !state.run.finalPlan || state.run.pendingEncounter) return inputState;
      startEncounter(base, "late", true);
      base.run.pendingEncounter.feedback = `${base.run.pendingEncounter.description} Your ${base.run.finalPlan.replace("_", " ")} plan decides what is at stake.`;
      return base;
    }
    return inputState;
  }

  function selectRunSummary(state) {
    return {
      ending: state.run.ending, endingLabel: endingLabel(state.run.ending), cash: state.player.cash,
      storedCash: state.base.storedCash, debt: state.lender.balance, inventoryValue: inventoryValue(state),
      netWorth: netWorth(state), operationScore: operationScore(state), baseValue: baseValue(state), gearValue: gearValue(state),
      baseTracks: { ...state.base.tracks }, crew: recruitedCrew(state).map((person) => ({ id: person.id, name: person.name, loyalty: state.people.crew[person.id].loyalty, status: state.people.crew[person.id].status })),
      influence: { ...state.world.influence }, maraStatus: state.people.mara.status, maraTrust: state.people.mara.trust,
      lenderRelationship: state.lender.relationship, rivalRelationship: state.rival.relationship,
      bestTrade: state.stats.bestTrade, largestLoss: state.stats.largestLoss, highestHeat: state.stats.highestHeat,
      productsMoved: { ...state.stats.productsMoved }, majorDecisions: [...state.stats.majorDecisions],
    };
  }

  return {
    VERSION, RUN_DAYS, SLOTS, SAVE_KEY, PRODUCTS, NEIGHBORHOODS, BACKGROUNDS, GEAR, BASE_UPGRADES, CREW,
    createRun, reduceGame, advanceRun, selectRunSummary,
    selectors: {
      cargoUsed, cargoCapacity, storedCargoUsed, storageCapacity, storedCashCapacity, inventoryValue, netWorth,
      operationScore, baseValue, gearValue, heatBand, priceSignal, influenceLabel, encounterChoices, endingLabel,
      recruitedCrew,
    },
  };
});
