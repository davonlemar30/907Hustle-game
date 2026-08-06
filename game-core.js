(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GameCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 3;
  const RUN_DAYS = 7;
  const SLOTS = ["Morning", "Afternoon", "Evening", "Night"];
  const SAVE_KEY = "907ogr_v3";
  const WORKING_CAPITAL_RESERVE = 150;
  const STREET_NAME_MAX = 16;
  const GARAGE_DEPOSIT = 650;
  const STREET_READ_LEVELS = [40, 110, 210, 340];
  const ATTRIBUTE_THRESHOLDS = { 2: 10, 3: 18, 4: 28 };
  const DEFAULT_STREET_NAMES = { shooter: "Steady", hustler: "Silver", strategist: "Quiet", neutral: "Rookie" };
  const ATTRIBUTE_DEFAULTS = { strength: 2, endurance: 2, reflexes: 2, presence: 2, insight: 2, discipline: 2 };
  const LEGACY_ATTRIBUTES = {
    shooter: { strength: 3, endurance: 3, reflexes: 3, presence: 1, insight: 2, discipline: 1 },
    hustler: { strength: 1, endurance: 1, reflexes: 1, presence: 3, insight: 2, discipline: 2 },
    strategist: { strength: 2, endurance: 2, reflexes: 2, presence: 1, insight: 3, discipline: 2 },
  };
  const STREET_IDENTITIES = {
    unproven: { label: "Unproven", description: "The block is still deciding." },
    mover: { label: "The Mover", description: "People notice the way you read a market and keep product moving." },
    earner: { label: "The Earner", description: "People notice that your promises turn into payments and plans." },
    stickup: { label: "The Stickup", description: "People expect pressure, confrontation, and a willingness to take the fast risk." },
    connector: { label: "The Connector", description: "People notice who answers when you call and who trusts you with a route." },
    wild_card: { label: "The Wild Card", description: "The stories about how you move do not agree long enough to become a rule." },
  };

  // Character-set sanitation only. This is a local single-player run: a profanity
  // blocklist is unwinnable and the real risk is layout breakage, not language.
  function sanitizeStreetName(input) {
    if (typeof input !== "string" && typeof input !== "number") return "";
    return String(input).replace(/[^A-Za-z0-9 '\-.]/g, "").replace(/\s+/g, " ").trim().slice(0, STREET_NAME_MAX).trim();
  }

  const PRODUCTS = [
    { id: "weed", name: "Weed", role: "Dependable", base: 34, min: 18, max: 68, volatility: 0.12, heat: 0, access: "open" },
    { id: "shrooms", name: "Shrooms", role: "Volatile", base: 82, min: 35, max: 180, volatility: 0.25, heat: 0, access: "open" },
    { id: "cocaine", name: "Cocaine", role: "Premium", base: 290, min: 145, max: 690, volatility: 0.30, heat: 1, access: "supplier" },
    { id: "meth", name: "Meth", role: "Extreme Risk", base: 185, min: 70, max: 560, volatility: 0.38, heat: 2, access: "industrial" },
  ];

  const NEIGHBORHOODS = [
    {
      id: "north_star_lot", name: "Spenard", role: "Home", risk: 1, police: 1, rival: 0,
      accent: "#d7d7d7", blurb: "North Star Garage, the Night Owl Mini-Mart, and familiar blocks that offer the week's safest footing.",
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
      id: "airport_industrial", name: "Industrial Service Roads", role: "Outer", risk: 4, police: 2, rival: 3,
      accent: "#9a1d18", blurb: "Loading yards, warehouses, service roads, rare supply, and expensive mistakes.",
      bias: { weed: 1.12, shrooms: 1.18, cocaine: 1.32, meth: 1.62 },
      availability: { weed: 0.72, shrooms: 0.7, cocaine: 0.7, meth: 0.86 },
    },
  ];

  const BACKGROUNDS = [
    { id: "shooter", name: "Steady-Hand Shooter", combat: 3, charisma: 1, intelligence: 2, cash: 375, heat: 1, description: "Weapons, direct confrontation, survival, and joining territory attacks are your strongest opening tools." },
    { id: "hustler", name: "Silver-Tongued Hustler", combat: 1, charisma: 3, intelligence: 2, cash: 375, heat: 1, description: "Negotiation, trade margins, recruiting, and relationship choices are your strongest opening tools." },
    { id: "strategist", name: "Strategist", combat: 2, charisma: 1, intelligence: 3, cash: 375, heat: 1, description: "Best at reading danger, intimidation, and judging territory strength." },
  ];
  const STARTING_EDGES = BACKGROUNDS.filter((item) => item.id !== "strategist");

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
    { id: "eli", name: "Eli ‘Shortcut’ Ward", role: "Runner", power: 3, recruitCost: 120, wage: 45, description: "Moves small bundles and knows service-road exits." },
    { id: "miri", name: "Samira ‘Miri’ Cole", role: "Connector", power: 2, recruitCost: 180, wage: 60, description: "Opens buyers and supply through an aging Downtown list." },
    { id: "tone", name: "Anton ‘Tone’ Bell", role: "Enforcer / Lookout", power: 5, recruitCost: 250, wage: 85, description: "Protects the garage and changes confrontation choices." },
  ];

  const TERRITORIES = [
    { areaId: "north_star_lot", power: 12, attackCost: 100, dailyIncome: 45, special: "Recruitment costs 10% less." },
    { areaId: "downtown", power: 18, attackCost: 150, dailyIncome: 75, special: "Cocaine access opens." },
    { areaId: "airport_industrial", power: 24, attackCost: 200, dailyIncome: 110, special: "Meth access opens." },
  ];

  const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((item) => [item.id, item]));
  const AREA_BY_ID = Object.fromEntries(NEIGHBORHOODS.map((item) => [item.id, item]));
  const GEAR_BY_ID = Object.fromEntries(GEAR.map((item) => [item.id, item]));
  const CREW_BY_ID = Object.fromEntries(CREW.map((item) => [item.id, item]));

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function normalizedAttributes(state) { return { ...ATTRIBUTE_DEFAULTS, ...(state?.player?.attributes || {}) }; }
  function combatRating(state) { const a = normalizedAttributes(state); return clamp(Math.round(a.strength * 0.40 + a.reflexes * 0.35 + a.endurance * 0.25), 1, 5); }
  function charismaRating(state) { const a = normalizedAttributes(state); return clamp(Math.round(a.presence * 0.70 + a.discipline * 0.30), 1, 5); }
  function intelligenceRating(state) { const a = normalizedAttributes(state); return clamp(Math.round(a.insight * 0.70 + a.discipline * 0.30), 1, 5); }
  function derivedRatings(state) { return { combat: combatRating(state), charisma: charismaRating(state), intelligence: intelligenceRating(state) }; }
  function copyState(state) {
    return typeof structuredClone === "function" ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  }
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

  function behaviorSummary(category, type) {
    const summaries = {
      mover: type === "sale" ? "Turned a real profit without wasting the window." : "Read the market or a supplier and moved with purpose.",
      earner: type === "dre_payment" ? "Put real money against Dre's note." : "Followed through on a responsibility or long plan.",
      stickup: type === "dealer_robbery" ? "Tried to take a dealer's corner by force." : "Chose confrontation when a safer route existed.",
      connector: type === "recruit" ? "Brought another person into the operation." : "Built a route through people instead of pressure.",
    };
    return summaries[category] || "Made a choice the neighborhood will remember.";
  }
  function identityCandidate(scores) {
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [first, second] = ranked;
    if (!first || first[1] <= 0) return "unproven";
    const close = second && first[1] - second[1] < 3 && second[1] >= first[1] * 0.75;
    return close ? "wild_card" : first[0];
  }
  function assignIdentity(state, identity, reasonSummary) {
    state.player.streetIdentity = identity;
    state.player.identityAssignedDay = state.run.day;
    state.player.identityHistory.push({ identity, day: state.run.day, reasonSummary });
    state.player.behavior.pendingIdentity = null;
    state.player.behavior.pendingIdentityNights = 0;
    logEntry(state, `People around ${AREA_BY_ID[state.world.currentNeighborhoodId].name} have started calling you ${STREET_IDENTITIES[identity].label}.`, "good");
  }
  function evaluateStreetIdentity(state, nightly) {
    const behavior = state.player.behavior;
    if (!behavior || behavior.lastEvaluatedDay === state.run.day && nightly) return;
    if (nightly) behavior.lastEvaluatedDay = state.run.day;
    const firstReady = behavior.meaningfulActions >= 6 && nightly && state.run.day >= 2;
    const delayedReady = behavior.meaningfulActions >= 8;
    if (state.player.streetIdentity === "unproven") {
      if (!firstReady && !delayedReady) return;
      const candidate = identityCandidate(behavior.scores);
      if (candidate !== "unproven") assignIdentity(state, candidate, candidate === "wild_card" ? "The week has stayed deliberately mixed." : `Your recent choices consistently point toward ${STREET_IDENTITIES[candidate].label}.`);
      return;
    }
    if (!nightly) return;
    const candidate = identityCandidate(behavior.scores);
    if (candidate === state.player.streetIdentity || candidate === "unproven") {
      behavior.pendingIdentity = null; behavior.pendingIdentityNights = 0; return;
    }
    const currentScore = state.player.streetIdentity === "wild_card" ? 0 : (behavior.scores[state.player.streetIdentity] || 0);
    const candidateScore = candidate === "wild_card" ? Math.max(...Object.values(behavior.scores)) : (behavior.scores[candidate] || 0);
    const clearsLead = candidate === "wild_card" || (candidateScore >= currentScore * 1.25 && candidateScore - currentScore >= 3);
    if (!clearsLead) { behavior.pendingIdentity = null; behavior.pendingIdentityNights = 0; return; }
    if (behavior.pendingIdentity === candidate) behavior.pendingIdentityNights += 1;
    else { behavior.pendingIdentity = candidate; behavior.pendingIdentityNights = 1; }
    if (behavior.pendingIdentityNights >= 2) assignIdentity(state, candidate, `Two nights of choices changed what the neighborhood expects from you.`);
  }
  function recordBehavior(state, category, points, sourceId, type) {
    const behavior = state.player.behavior;
    if (!behavior || !Object.hasOwn(behavior.scores, category) || !sourceId) return false;
    if (behavior.history.some((entry) => entry.sourceId === sourceId)) return false;
    const day = state.run.day;
    const capKey = `${type || category}:${day}`;
    const dailyCaps = { sale: 2, dre_payment: 1, dealer_buy: 1, dealer_ask: 1 };
    const used = behavior.caps[capKey] || 0;
    if (dailyCaps[type] && used >= dailyCaps[type]) return false;
    behavior.caps[capKey] = used + 1;
    const entry = { type: type || category, category, points: clamp(Math.floor(points || 1), 1, 3), day, slot: state.run.slot, sourceId, summary: behaviorSummary(category, type) };
    behavior.scores[category] += entry.points;
    behavior.meaningfulActions += 1;
    behavior.history.push(entry);
    behavior.history = behavior.history.slice(-50);
    if (behavior.meaningfulActions >= 8 && state.player.streetIdentity === "unproven") evaluateStreetIdentity(state, false);
    return true;
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
      contactStage: "unknown", crisisResolved: false, status: "outside", outcomes: [],
    }]));
  }

  // Kip runs a corner rather than a market stall: the same person can be bought
  // from, asked for word, or robbed, and he remembers which one you picked.
  const DEALERS = [
    { id: "kip", name: "Kip Sallis", where: "the Wash & Go lot on Spenard Road", areaId: "north_star_lot", products: ["weed", "shrooms"] },
  ];
  const DEALER_BY_ID = Object.fromEntries(DEALERS.map((item) => [item.id, item]));
  function createDealerState() {
    return Object.fromEntries(DEALERS.map((item) => [item.id, {
      known: false, standing: 0, robbedCount: 0, lastRobbedDay: null, lastTradedDay: null,
      lastAskedDay: null, retaliated: false, gone: false, supplyChoked: 0,
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
        status: "creating_character", day: 1, slot: 0, seed, rngState: random.state,
        premise: "fresh_arrival", openingPending: false,
        ending: null, pendingEvent: null, pendingEncounter: null, pendingOperationResult: null, daySummary: null,
        currentVisit: { trades: 0, grossBuy: 0, grossSell: 0, startedAt: 0 },
        recentEvents: [], encounterCount: 0, finalPlan: null, finalPlanPrepared: false,
        eventHistory: {}, lastChainFired: null, chainStreak: 0, lastChainSlot: null, lastBeatSlot: null, chainBeatsToday: 0, chainBeatsDay: 1,
      },
      player: {
        background: null, legacyBackground: null, streetName: "", streetNameChosen: false,
        streetIdentity: "unproven", identityAssignedDay: null, identityHistory: [],
        attributes: { ...ATTRIBUTE_DEFAULTS },
        attributeProgress: { strength: 0, endurance: 0, reflexes: 0, presence: 0, insight: 0, discipline: 0 },
        behavior: { scores: { mover: 0, earner: 0, stickup: 0, connector: 0 }, meaningfulActions: 0, history: [], pendingIdentity: null, pendingIdentityNights: 0, lastEvaluatedDay: null, caps: {} },
        cash: 0, health: 100, heat: 0, cargoCapacity: 10,
        stats: { combat: 0, charisma: 0, intelligence: 0 }, inventory,
        gear: { owned: [], equipped: { weapon: null, armor: null, utility: null, tool: null }, consumables: { medical_kit: 0 } },
      },
      world: {
        currentNeighborhoodId: "north_star_lot", markets,
        influence: { north_star_lot: 0, downtown: 0, airport_industrial: 0 },
        tradeInfluenceGranted: { north_star_lot: false, downtown: false, airport_industrial: false },
        productAccess: { weed: true, shrooms: true, cocaine: false, meth: false },
        territories: Object.fromEntries(TERRITORIES.map((territory) => [territory.areaId, {
          owner: "rook", power: territory.power, capturedDay: null, incomeCollected: 0, attempts: 0,
        }])),
      },
      base: {
        name: "North Star Garage", controlled: false, acquiredDay: null, visiting: false,
        tracks: { security: 0, storage: 0, operations: 0, recovery: 0 },
        storedCash: 0, storedInventory, watched: false, damage: 0, assignedCrew: null,
      },
      lender: {
        name: "Dre Holloway", principal: 1000, balance: 1200, dueDay: 7, trust: 0,
        relationship: "businesslike", payments: 0, paymentCount: 0, feesAdded: 0,
        paymentHistory: [], penaltyHistory: [], clearedAt: null, missedDays: 0, lastPenaltyDay: 0,
        afterPayoffOffer: "locked",
      },
      rival: { name: "Rook Mercer", pressure: 0, respect: 0, relationship: "unaware", recentInterference: null },
      people: {
        household: { yalondaTrust: 2, johnTrust: 1, warnings: 0, contrabandFound: 0, dangerBroughtHome: 0, evicted: false, lastQuestionDay: null },
        mara: { met: false, available: true, trust: 0, introChoice: null, flirtHistory: false, truthTold: false, usedWithoutConsent: false, status: "distant", outcomes: [], chainStage: 0, jobAtRisk: false },
        crew: createCrewState(),
        dealers: createDealerState(),
      },
      home: { storedCash: 0, storedInventory: Object.fromEntries(PRODUCTS.map((item) => [item.id, { qty: 0, avgCost: 0 }])), hiddenWeapon: null },
      flags: { featureNotices: {} },
      effects: { rumors: [], modifiers: [] },
      stats: {
        startingNetWorth: -200, bestTrade: 0, largestLoss: 0, highestHeat: 0,
        streetRead: { xp: 0, level: 0, awards: {} },
        productsMoved: Object.fromEntries(PRODUCTS.map((item) => [item.id, 0])),
        decisions: 0, pipelineAdvances: 0, marketUpdates: 0, visits: [], majorDecisions: [],
        moneySpent: { debt: 0, base: 0, gear: 0, crew: 0, healing: 0, relationships: 0, events: 0 },
        encounterChoices: { fight: 0, run: 0, talk: 0, pay: 0, other: 0 },
        robbery: { attempts: 0, successes: 0, failures: 0, totalPayout: 0, lastAttemptedDay: null, attempted: false, success: false, payout: 0 },
        takeovers: { attempts: 0, wins: 0, losses: 0, crewLost: 0, income: 0 },
      },
      log: [],
    };
    logEntry(state, "You do not choose what the block calls you. The week decides.", "warn");
    return state;
  }

  function mergeDefaults(defaults, value) {
    if (Array.isArray(defaults)) return Array.isArray(value) ? value : defaults;
    if (!defaults || typeof defaults !== "object") return value === undefined ? defaults : value;
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const merged = {};
    for (const key of new Set([...Object.keys(defaults), ...Object.keys(source)])) {
      merged[key] = key in defaults ? mergeDefaults(defaults[key], source[key]) : source[key];
    }
    return merged;
  }

  function normalizeRobberyStats(value, state) {
    const old = value && typeof value === "object" ? value : {};
    const legacyAttempted = !!old.attempted;
    const legacySuccess = !!old.success;
    const attempts = Math.max(0, Math.floor(Number(old.attempts ?? (legacyAttempted ? 1 : 0)) || 0));
    const successes = Math.min(attempts, Math.max(0, Math.floor(Number(old.successes ?? (legacySuccess ? 1 : 0)) || 0)));
    const failures = Math.max(0, Math.floor(Number(old.failures ?? Math.max(0, attempts - successes)) || 0));
    const totalPayout = Math.max(0, Math.floor(Number(old.totalPayout ?? old.payout ?? 0) || 0));
    const lastAttemptedDay = old.lastAttemptedDay == null ? (legacyAttempted ? state.run.day : null) : clamp(Math.floor(Number(old.lastAttemptedDay) || 1), 1, RUN_DAYS);
    return { attempts, successes, failures, totalPayout, lastAttemptedDay, attempted: attempts > 0, success: successes > 0, payout: totalPayout };
  }

  function hydrateRun(value) {
    if (!value || typeof value !== "object" || value.version !== VERSION || !value.run || !value.world || !value.player) return null;
    const defaults = createRun({ seed: value.run.seed });
    const state = mergeDefaults(defaults, value);
    state.version = VERSION;
    if (value.run.premise === undefined) state.run.premise = "legacy_established";
    if (value.base?.controlled === undefined) {
      state.base.controlled = true;
      state.base.acquiredDay = value.run.day || 1;
    }
    const legacy = ["shooter", "hustler", "strategist"].includes(value.player.background) ? value.player.background : value.player.legacyBackground;
    if (!value.player.attributes && legacy && LEGACY_ATTRIBUTES[legacy]) state.player.attributes = { ...LEGACY_ATTRIBUTES[legacy] };
    state.player.legacyBackground = legacy || null;
    state.player.background = null;
    state.player.stats = derivedRatings(state);
    state.player.streetIdentity = STREET_IDENTITIES[state.player.streetIdentity] ? state.player.streetIdentity : "unproven";
    state.player.behavior.history = Array.isArray(state.player.behavior.history) ? state.player.behavior.history.slice(-50) : [];
    state.player.behavior.caps = state.player.behavior.caps && typeof state.player.behavior.caps === "object" ? state.player.behavior.caps : {};
    state.stats.robbery = normalizeRobberyStats(value.stats?.robbery, state);
    state.flags.featureNotices = state.flags.featureNotices && typeof state.flags.featureNotices === "object" ? state.flags.featureNotices : {};
    state.people.mara.available = state.people.mara.available !== false && state.people.mara.status !== "gone";
    for (const person of CREW) {
      const crew = state.people.crew[person.id];
      if (!value.people?.crew?.[person.id]?.contactStage) {
        if (!crew.introduced) crew.contactStage = "unknown";
        else if (crew.recruited) crew.contactStage = "active";
        else if (person.id === "eli") crew.contactStage = "recruitable";
        else crew.contactStage = "recruitable";
      }
    }
    return state;
  }

  function inspectSave(serialized) {
    if (serialized == null || serialized === "") return { exists: false, valid: false, state: null, error: null, preview: null };
    try {
      const state = hydrateRun(JSON.parse(serialized));
      if (!state) return { exists: true, valid: false, state: null, error: "This save is not a compatible 907Hustle v3 run.", preview: null };
      const area = AREA_BY_ID[state.world.currentNeighborhoodId] || AREA_BY_ID.north_star_lot;
      return {
        exists: true, valid: true, state, error: null,
        preview: { name: state.player.streetName || "Unnamed run", day: state.run.day, part: SLOTS[state.run.slot] || SLOTS[0], district: area.name, cash: state.player.cash, debt: state.lender.balance },
      };
    } catch {
      return { exists: true, valid: false, state: null, error: "The saved run could not be read. Start a new run to replace it.", preview: null };
    }
  }

  function hasGear(state, id) { return state.player.gear.owned.includes(id); }
  function equippedWeapon(state) { return GEAR_BY_ID[state.player.gear.equipped.weapon] || null; }
  function cargoCapacity(state) { return state.player.cargoCapacity + (hasGear(state, "larger_bag") ? 5 : 0); }
  function cargoUsed(state) { return PRODUCTS.reduce((sum, item) => sum + (state.player.inventory[item.id]?.qty || 0), 0); }
  function storedCargoUsed(state) { return PRODUCTS.reduce((sum, item) => sum + (state.base.storedInventory[item.id]?.qty || 0), 0); }
  function storageCapacity(state) { return 2 + state.base.tracks.storage * 6; }
  function storedCashCapacity(state) { return state.base.tracks.storage === 0 ? 0 : state.base.tracks.storage === 1 ? 300 : 1200; }
  function homeStoredCargoUsed(state) { return PRODUCTS.reduce((sum, item) => sum + (state.home?.storedInventory?.[item.id]?.qty || 0), 0); }
  function recruitedCrew(state) { return CREW.filter((person) => state.people.crew[person.id].recruited && state.people.crew[person.id].status === "active"); }
  function influenceLabel(value) { return ["Unknown", "Active", "Established", "Contested", "Controlled"][clamp(value, 0, 4)]; }
  function inventoryValue(state) {
    const market = state.world.markets[state.world.currentNeighborhoodId];
    return PRODUCTS.reduce((sum, product) => {
      const carried = state.player.inventory[product.id]?.qty || 0;
      const stored = state.base.storedInventory[product.id]?.qty || 0;
      const hidden = state.home?.storedInventory?.[product.id]?.qty || 0;
      return sum + (carried + stored + hidden) * (market.prices[product.id] || 0);
    }, 0);
  }
  function gearValue(state) { return state.player.gear.owned.reduce((sum, id) => sum + (GEAR_BY_ID[id]?.cost || 0), 0); }
  function baseValue(state) {
    return BASE_UPGRADES.filter((item) => state.base.tracks[item.track] >= item.level).reduce((sum, item) => sum + item.cost, 0);
  }
  function netWorth(state) { return state.player.cash + state.base.storedCash + (state.home?.storedCash || 0) + inventoryValue(state) - state.lender.balance; }
  function workingCapital(state) { return state.player.cash + state.base.storedCash + (state.home?.storedCash || 0) + inventoryValue(state); }
  function safeDebtPayment(state) { return Math.min(state.lender.balance, Math.max(0, state.player.cash - WORKING_CAPITAL_RESERVE)); }
  function debtPaymentPreview(state, requestedAmount) {
    const maximum = Math.min(state.player.cash, state.lender.balance);
    const amount = clamp(Math.floor(Number(requestedAmount) || 0), 0, maximum);
    return { amount, maximum, cashAfter: state.player.cash - amount, debtAfter: state.lender.balance - amount, breaksReserve: amount > safeDebtPayment(state) };
  }
  function featureAvailability(state) {
    const progressed = state.run.day > 1 || state.run.slot > 0 || state.stats.pipelineAdvances > 0;
    const returning = state.run.day > 1 || state.stats.pipelineAdvances >= 4;
    const someoneIntroduced = state.people.mara.met || CREW.some((person) => state.people.crew[person.id]?.introduced);
    return {
      market: { available: true, hint: "Available now." },
      finances: { available: true, hint: "Available now." },
      help: { available: true, hint: "Available now." },
      travel: { available: progressed, hint: "Finish trading once to unlock Travel." },
      operations: { available: progressed, hint: "Finish trading once to unlock Operations." },
      people: { available: someoneIntroduced || returning, hint: "Meet someone who sticks around to unlock People." },
      recovery: { available: state.player.health < 100 || state.player.heat > 1 || state.flags.recoveryIntroduced || returning, hint: "Take an injury or pick up Heat to unlock Recovery." },
    };
  }
  function announceFeatureUnlocks(state, before) {
    const after = featureAvailability(state);
    const labels = { travel: "Travel", operations: "Operations", people: "People", recovery: "Recovery" };
    state.flags.featureNotices = state.flags.featureNotices || {};
    for (const id of Object.keys(labels)) {
      if (!before[id].available && after[id].available && !state.flags.featureNotices[id]) {
        state.flags.featureNotices[id] = true;
        logEntry(state, `${labels[id]} is now available.`, "good");
      }
    }
  }
  function layLowPreview(state) {
    const baseBonus = state.world.currentNeighborhoodId === "north_star_lot" ? state.base.tracks.security : 0;
    const danger = state.base.watched && state.world.currentNeighborhoodId === "north_star_lot" ? 1 : 0;
    return { heatReduction: Math.min(state.player.heat, Math.max(1, 2 + baseBonus - danger)), advances: true };
  }
  function eliTestRouteAvailability(state) {
    const eli = state.people.crew.eli;
    if (state.run.status !== "playing") return { available: false, reason: "The run is not active." };
    if (!eli.introduced) return { available: false, reason: "Meet Eli before offering him a route." };
    if (eli.recruited || eli.contactStage === "active") return { available: false, reason: "Eli already works with the crew." };
    if (eli.contactStage === "rejected") return { available: false, reason: "Eli remembers being turned away. A later conversation must reopen the door." };
    if (eli.contactStage === "recruitable") return { available: false, reason: "The test is complete. Visit the garage to recruit Eli." };
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return { available: false, reason: "Resolve the current situation first." };
    if (state.player.cash < 35) return { available: false, reason: "The test route needs $35 for fuel and a vehicle." };
    if (state.run.day === RUN_DAYS && state.run.slot === 3) return { available: false, reason: "There is no part of the week left for the test route." };
    return { available: true, reason: "Uses one part of day.", cost: 35 };
  }
  function maraThreatEligible(state) {
    const relevantHistory = !!(state.people.mara.introChoice || state.flags.maraFlirted || state.flags.maraFriendlyIntro || state.flags.maraDistantIntro || state.flags.toldMaraAboutGarage || state.stats.moneySpent.relationships > 0);
    return !!(state.flags.maraBoundaryResolved && state.people.mara.met && state.people.mara.available !== false && state.people.mara.status !== "gone" && relevantHistory && !state.flags.maraSedanNightResolved);
  }
  function controlled(state, areaId) { return state.world.territories[areaId]?.owner === "player"; }
  function recruitmentCost(state, crewId) {
    const person = CREW_BY_ID[crewId];
    if (!person) return 0;
    const charismaDiscount = Math.max(0, charismaRating(state) - 1) * 0.05;
    const territoryDiscount = controlled(state, "north_star_lot") ? 0.10 : 0;
    return Math.max(1, Math.round(person.recruitCost * (1 - charismaDiscount - territoryDiscount)));
  }
  function operationGearPower(state) {
    const weapon = equippedWeapon(state);
    const weaponPower = weapon?.id === "reliable_handgun" ? 4 : weapon?.id === "cheap_handgun" ? 3 : weapon ? 1 : 0;
    return weaponPower + (state.player.gear.equipped.armor ? 2 : 0) + (state.player.gear.equipped.utility ? 1 : 0) + (state.player.gear.equipped.tool ? 1 : 0);
  }
  function crewPower(state, includePlayer) {
    let power = operationGearPower(state) + state.base.tracks.operations;
    for (const person of recruitedCrew(state)) {
      const crew = state.people.crew[person.id];
      power += person.power + clamp(crew.loyalty, 0, 3) - (crew.wageDue > 0 ? 2 : 0);
    }
    if (includePlayer) {
      power += combatRating(state) * 2 + charismaRating(state) + intelligenceRating(state);
      if (state.player.health > 80) power += 1;
      if (state.player.health < 50) power -= 2;
    }
    return Math.max(0, power);
  }
  function territoryPowerEstimate(state, areaId) {
    const exact = state.world.territories[areaId]?.power || 0;
    const intelligence = intelligenceRating(state);
    const spread = intelligence >= 3 ? 0 : intelligence === 2 ? 1 : 3;
    return { exact: spread === 0, min: Math.max(0, exact - spread), max: exact + spread, label: spread ? `${Math.max(0, exact - spread)}–${exact + spread}` : String(exact) };
  }
  function territoryBenefits(state, areaId) {
    const territory = TERRITORIES.find((item) => item.areaId === areaId);
    if (!territory || !controlled(state, areaId)) return null;
    return { buyDiscount: 0.04, sellBonus: 0.04, riskReduction: 1, dailyIncome: territory.dailyIncome, special: territory.special };
  }
  function tradeUnitPrices(state, productId) {
    const areaId = state.world.currentNeighborhoodId;
    const marketPriceValue = state.world.markets[areaId]?.prices[productId] || 0;
    const control = controlled(state, areaId);
    const buy = Math.round(marketPriceValue * (control ? 0.96 : 1));
    const charismaBonus = Math.max(0, charismaRating(state) - 1) * 0.015;
    const influenceBonus = Math.min(0.02, state.world.influence[areaId] * 0.005);
    const sell = Math.round(marketPriceValue * (0.96 + charismaBonus + influenceBonus + (control ? 0.04 : 0)));
    return { market: marketPriceValue, buy, sell };
  }
  // Inventory uses weighted-average cost. This pure projection is shared by the
  // UI and reducer so confirmation totals cannot drift from settled trades.
  function tradeProjection(state, productId, quantity, mode) {
    const product = PRODUCT_BY_ID[productId];
    const item = state.player.inventory[productId];
    const qty = Math.max(0, Math.floor(Number(quantity) || 0));
    if (!product || !item || (mode !== "buy" && mode !== "sell")) return null;
    const prices = tradeUnitPrices(state, productId);
    const unitPrice = mode === "buy" ? prices.buy : prices.sell;
    const total = unitPrice * qty;
    const costBasis = item.avgCost * qty;
    const market = state.world.markets[state.world.currentNeighborhoodId];
    const history = market.history[productId] || [];
    const previous = history.length > 1 ? history[history.length - 2] : null;
    const localContext = previous == null ? {
      available: false,
      label: "No earlier local price recorded",
      previous: null,
      delta: null,
    } : {
      available: true,
      label: prices.market === previous ? `Steady from the prior local price of $${previous}` : `${prices.market > previous ? "Up" : "Down"} $${Math.abs(prices.market - previous)} from the prior local price of $${previous}`,
      previous,
      delta: prices.market - previous,
    };
    return {
      mode,
      productId,
      quantity: qty,
      unitPrice,
      total,
      purchaseCost: mode === "buy" ? total : 0,
      revenue: mode === "sell" ? total : 0,
      averageCost: item.avgCost,
      costBasis: mode === "sell" ? costBasis : 0,
      profitLoss: mode === "sell" ? total - costBasis : 0,
      cashAfter: state.player.cash + (mode === "sell" ? total : -total),
      cargoAfter: cargoUsed(state) + (mode === "buy" ? qty : -qty),
      cargoCapacity: cargoCapacity(state),
      localContext,
    };
  }
  function takeoverReadiness(state, areaId, includePlayer) {
    const definition = TERRITORIES.find((item) => item.areaId === areaId);
    const territory = state.world.territories[areaId];
    if (!definition || !territory) return { available: false, reason: "Unknown territory." };
    if (territory.owner === "player") return { available: false, reason: "Your crew already controls this neighborhood." };
    if (state.run.status !== "playing") return { available: false, reason: "The run is not active." };
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return { available: false, reason: "Resolve the current situation first." };
    if (!recruitedCrew(state).length) return { available: false, reason: "Recruit at least one active crew member." };
    if (state.player.cash < definition.attackCost) return { available: false, reason: `The operation requires $${definition.attackCost}.` };
    if (includePlayer && state.player.health <= 30) return { available: false, reason: "You need more than 30 health to join the attack." };
    return {
      available: true, reason: "The crew can launch the operation.", attackCost: definition.attackCost,
      crewPower: crewPower(state, includePlayer), defender: territoryPowerEstimate(state, areaId), includePlayer: !!includePlayer,
    };
  }
  function robberyAvailability(state) {
    if (state.run.status !== "playing") return { available: false, reason: "The run is not active." };
    const robbery = normalizeRobberyStats(state.stats.robbery, state);
    if (robbery.lastAttemptedDay === state.run.day) return { available: false, reason: "You already attempted a Quick Score today." };
    if (state.run.day === RUN_DAYS && state.run.slot === 3) return { available: false, reason: "There is no part of the week left to resolve a score." };
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return { available: false, reason: "Resolve the current situation first." };
    const capital = workingCapital(state);
    if (capital >= WORKING_CAPITAL_RESERVE) return { available: false, reason: `Quick Score is a comeback option when working capital falls below $${WORKING_CAPITAL_RESERVE}.` };
    const weaponBonus = equippedWeapon(state) ? 0.05 : 0;
    const crewBonus = Math.min(0.08, recruitedCrew(state).length * 0.04);
    const repeatPenalty = robbery.attempts * 0.035;
    const chance = clamp(0.30 + combatRating(state) * 0.065 + intelligenceRating(state) * 0.035 + weaponBonus + crewBonus - state.player.heat * 0.015 - repeatPenalty, 0.22, 0.72);
    return { available: true, reason: "One attempt is available today. It uses one part of day.", chance, chanceLabel: `${Math.round(chance * 100)}%`, workingCapital: capital, attempts: robbery.attempts };
  }
  // A robbed corner stops supplying the block. Losing him for good leaves a
  // smaller permanent dent than the days immediately after the robbery.
  function dealerSupplyFactor(state, areaId, productId) {
    let factor = 1;
    for (const dealer of DEALERS) {
      if (dealer.areaId !== areaId || !dealer.products.includes(productId)) continue;
      const record = state.people.dealers?.[dealer.id];
      if (!record) continue;
      if (record.supplyChoked > 0) factor *= 0.6;
      else if (record.gone) factor *= 0.75;
    }
    return factor;
  }
  function dealerRecord(state, id) { return state.people.dealers?.[id] || null; }
  function dealerStandingLabel(record) {
    if (!record || !record.known) return "Not met";
    if (record.gone) return "Gone";
    if (record.robbedCount > 0) return "Burned";
    if (record.standing >= 3) return "Solid";
    if (record.standing >= 1) return "Known";
    return "Cautious";
  }
  function dealerActions(state, id) {
    const definition = DEALER_BY_ID[id];
    const record = dealerRecord(state, id);
    const blocked = (reason) => ({ buy: { available: false, reason }, rob: { available: false, reason }, ask: { available: false, reason } });
    if (!definition || !record) return blocked("No such contact.");
    if (state.run.status !== "playing") return blocked("The run is not active.");
    if (!record.known) return blocked("You have not met this contact yet.");
    if (record.gone) return blocked(`${definition.name.split(" ")[0]} does not work this block any more.`);
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return blocked("Resolve the current situation first.");
    if (state.world.currentNeighborhoodId !== definition.areaId) return blocked(`${definition.name.split(" ")[0]} works out of ${AREA_BY_ID[definition.areaId].name}.`);
    if (state.run.day === RUN_DAYS && state.run.slot === 3) return blocked("There is no part of the week left for this.");

    const discount = record.standing >= 3 ? 0.18 : 0.12;
    // An offer you cannot take must not present as available: the button would
    // enable and then do nothing, and an agent would loop on it forever.
    const cheapest = Math.min(...definition.products.map((id) => Math.round(tradeUnitPrices(state, id).buy * (1 - discount))));
    const room = cargoCapacity(state) - cargoUsed(state);
    const buy = record.lastTradedDay === state.run.day
      ? { available: false, reason: "You already bought off him today." }
      : room <= 0
        ? { available: false, reason: "You have nothing left to carry it in." }
        : state.player.cash < cheapest
          ? { available: false, reason: "You cannot cover even one unit at his price." }
          : { available: true, reason: `${Math.round(discount * 100)}% under the block price on three units.`, discount, units: 3 };
    const ask = record.standing < 2
      ? { available: false, reason: "He does not talk business with you yet." }
      : record.lastAskedDay === state.run.day
        ? { available: false, reason: "You already asked him today." }
        : { available: true, reason: "One straight answer about what is moving." };

    let rob;
    if (record.robbedCount >= 2) rob = { available: false, reason: "There is nothing left of him to take." };
    else if (record.lastRobbedDay === state.run.day) rob = { available: false, reason: "Not twice in one day." };
    else rob = { available: true, reason: "Take the corner. Injury, Heat, retaliation, and the block's supply are all on the table.", chance: dealerRobberyChance(state, record) };
    return { buy, rob, ask };
  }
  function dealerRobberyChance(state, record) {
    const weapon = equippedWeapon(state);
    const weaponBonus = weapon ? (weapon.type === "firearm" ? 0.12 : 0.06) : 0;
    return clamp(
      0.38 + combatRating(state) * 0.07 + weaponBonus + Math.min(0.10, recruitedCrew(state).length * 0.05)
      + intelligenceRating(state) * 0.02 - state.player.heat * 0.012 - record.robbedCount * 0.10 - (record.retaliated ? 0.08 : 0),
      0.20, 0.78);
  }

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
    if (rival.pressure <= 0 && rival.respect <= 0) return "unaware";
    if (rival.respect >= 4 && rival.pressure <= 6) return "respectful";
    if (rival.respect >= 2 && rival.pressure <= 4) return "cooperative";
    if (rival.pressure >= 12) return "aggressive";
    if (rival.pressure >= 7) return "competitive";
    return "dismissive";
  }
  function maraStatus(person) {
    // A departure is authoritative. Once she has left, no later trust arithmetic
    // walks it back.
    if (person.available === false) return "gone";
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
        market.availability[product.id] = Math.floor(market.availability[product.id] * dealerSupplyFactor(state, area.id, product.id));
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
        const success = random.next() < 0.58 + intelligenceRating(state) * 0.05 + loyaltyBonus - (assignment === "outer_run" ? 0.14 : 0);
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
      const riskReduction = territoryBenefits(state, area.id)?.riskReduction || 0;
      state.player.heat = clamp(state.player.heat + Math.max(0, area.risk - 1 - riskReduction), 0, 15);
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
      let territoryIncome = 0;
      for (const definition of TERRITORIES) {
        if (!controlled(state, definition.areaId)) continue;
        territoryIncome += definition.dailyIncome;
        state.world.territories[definition.areaId].incomeCollected += definition.dailyIncome;
      }
      if (territoryIncome) {
        state.player.cash += territoryIncome;
        state.stats.takeovers.income += territoryIncome;
        logEntry(state, `The controlled neighborhoods deliver $${territoryIncome} in daily income.`, "good");
      }
      for (const dealer of DEALERS) {
        const record = state.people.dealers?.[dealer.id];
        if (record && record.supplyChoked > 0) record.supplyChoked -= 1;
      }
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

  const EVENT_CONTEXT = {
    mara_intro: { who: "Mara Velez, the clerk who recognizes you", where: "Night Owl Mini-Mart, Spenard", stakes: "Choose whether this familiar face starts the week as a flirtation, a friend, or someone kept at a distance." },
    eli_offer: { who: "Eli Ward, a local driver looking for work", where: "Outside North Star Garage, Spenard", stakes: "Decide whether Eli gets a test route, only shares road information, or remembers being turned away." },
    eli_callback: { who: "Eli Ward, still working the service roads", where: "North Star Garage, Spenard", stakes: "Reopen the door to a test route or confirm that Eli should look elsewhere." },
    miri_offer: { who: "Miri Cole, a connected supplier", where: "Downtown corner booth", stakes: "Supplier access, loyalty, and how much ownership you are willing to share." },
    tone_offer: { who: "Anton Bell, a former security worker", where: "North Star Garage", stakes: "Protection against Rook at the cost of another wage." },
    mara_shift_change: { who: "Mara Velez, twenty minutes past close", where: "Night Owl Mini-Mart, Spenard", stakes: "Mara is building an exit that public association with your operation would close. How much you tell her sets the terms." },
    mara_invitation: { who: "Mara, off shift early and without a car", where: "The Night Owl lot, Spenard", stakes: "Four hours away from the block, or four hours she spends near your operation. Both cost time." },
    mara_boundary: { who: "Mara and the plate number on her wrist", where: "Behind the Night Owl after closing", stakes: "A plate number, her job, and whether she gets to make this decision with real information." },
    mara_after: { who: "Mara, at the end of your week and the start of hers", where: "Night Owl Mini-Mart, Spenard", stakes: "What the week cost her, and what is left to say about it." },
    eli_missed_turn: { who: "Eli Ward, back an hour later than the route allows", where: "North Star Garage, Spenard", stakes: "Whether you want a driver who thinks, or one who does what the clock says." },
    eli_service_map: { who: "Eli and a map he drew himself", where: "Passenger seat outside North Star Garage", stakes: "Route knowledge nobody else on this block has, and what he wants for it." },
    eli_last_run: { who: "Eli, asking a question he has clearly rehearsed", where: "North Star Garage, Spenard", stakes: "Whether the operation has a place for him after the seventh night." },
    dre_terms: { who: "Dre Holloway and one folded sheet of paper", where: "Behind the Night Owl Mini-Mart", stakes: "The amount, the date, and what he expects between now and then." },
    dre_first_payment: { who: "Dre, counting the first money you have brought him", where: "Behind the Night Owl Mini-Mart", stakes: "The shape of the rest of the week's arrangement." },
    dre_due_day: { who: "Dre on the day the note comes due", where: "Behind the Night Owl Mini-Mart", stakes: "What happens to the balance, and to his patience." },
    dre_day7: { who: "Dre, closing the week's account", where: "Behind the Night Owl Mini-Mart", stakes: "What your name is worth to him after seven days." },
    rook_mark: { who: "Rook's people, working through somebody else", where: "Your usual corner", stakes: "Confirmation that you are being watched, and by whom." },
    rook_tax: { who: "Rook Mercer, in person, which is the message", where: "The Downtown exit lane", stakes: "A cut, a favor, or a public no." },
    rook_day7: { who: "Rook, deciding what you were", where: "Wherever he finds you on the seventh day", stakes: "Whether the week ends as a partnership, a truce, or a problem." },
    kip_corner_intro: { who: "Kip Sallis, running a corner out of a gym bag", where: "The Wash & Go lot, Spenard Road", stakes: "Whether the block's nearest supply becomes a contact, a mark, or neither." },
    kip_recognized: { who: "Deshawn, who vouched for you before you robbed Kip", where: "Outside the Wash & Go, Spenard", stakes: "What your word is worth on the block after you spent it." },
    wet_bricks: { who: "A driver unstrapping someone else's mistake", where: "Loading Bay Seven, Industrial Service Roads", stakes: "Cheap weight of unverified condition, and a seller who will not be here tomorrow." },
    door_knock: { who: "Two APD officers working the row", where: "The fourplex two doors from North Star Garage", stakes: "What is in the unit with you, and how long the knocking takes to reach this door." },
    stranded_wagon: { who: "A woman with two kids and a dead battery", where: "The Minnesota Drive off-ramp shoulder", stakes: "Twenty minutes of your week against a stranger's night." },
    found_phone: { who: "Whoever left it, and whoever keeps calling it", where: "The transit shelter on Fourth Avenue", stakes: "Six days of somebody's pickup schedule, and whether you take it." },
    careful_customer: { who: "A buyer asking better questions than he should", where: "The corner you are standing on", stakes: "One sale, and who hears about it afterward." },
    dock_shift: { who: "A foreman short two people on a night unload", where: "Ship Creek freight dock", stakes: "Four hours you do not have, for money nobody writes down." },
    garage_furnace: { who: "The garage, and everything stored along the cold wall", where: "North Star Garage, back bay", stakes: "A repair bill, an afternoon, or whatever six hours of outside temperature did to the stock." },
    sedan_rumor: { who: "Somebody's cousin, two conversations removed", where: "Wherever you happened to be standing", stakes: "A story nobody has confirmed, and what you are willing to spend on it." },
    midtown_lights: { who: "Four cruisers and a closed left lane", where: "The Seward Highway at Thirty-Sixth", stakes: "Half a mile at walking speed in front of every officer in Midtown." },
    courier: { who: "An injured courier and approaching drivers", where: "Industrial Service Roads, Bay Twelve", stakes: "Cash, Heat, and who controls the courier's route information." },
    dre_after_payoff: { who: "Dre Holloway", where: "Behind the Mini-Mart", stakes: "A new debt, premium supply access, or independence." },
    base_watch: { who: "Rook's watcher and a possible plainclothes officer", where: "Across from North Star Garage", stakes: "Your stored operation and whether the watcher identifies its value." },
    crew_crisis: { who: "A jailed crew member and APD", where: "North Star Garage burner line", stakes: "$180 or the loyalty of everyone working for you." },
    buyer_hurry: { who: "A hurried buyer, Mara, and an observer", where: "Mini-Mart parking lot", stakes: "Fast cash against Heat and exposure near Mara's job." },
    checkpoint: { who: "APD officers and a tow driver", where: "Airport service road", stakes: "$90 or a risky inspection of your vehicle and cargo." },
    rook_cut: { who: "Rook's driver", where: "Downtown exit lane", stakes: "$120, physical injury, and Rook's respect." },
    rough_night: { who: "Three people tied to Rook", where: "Industrial Bay Nine", stakes: "$80 or a dangerous attempt to hold your ground." },
    dre_warning: { who: "Dre Holloway", where: "Behind the Mini-Mart", stakes: "Dre's patience and the pressure attached to the unpaid balance." },
  };
  function effectPreview(effect) {
    const parts = [];
    if (effect.cash) parts.push(`${effect.cash > 0 ? "+" : "−"}$${Math.abs(effect.cash)} cash`);
    if (effect.health) parts.push(`${effect.health > 0 ? "+" : "−"}${Math.abs(effect.health)} Health`);
    if (effect.heat) parts.push(`${effect.heat > 0 ? "+" : "−"}${Math.abs(effect.heat)} Heat`);
    if (effect.maraTrust) parts.push(`${effect.maraTrust > 0 ? "+" : "−"}${Math.abs(effect.maraTrust)} Mara trust`);
    if (effect.lenderTrust) parts.push(`${effect.lenderTrust > 0 ? "+" : "−"}${Math.abs(effect.lenderTrust)} Dre trust`);
    if (effect.rivalPressure) parts.push(`${effect.rivalPressure > 0 ? "+" : "−"}${Math.abs(effect.rivalPressure)} Rook pressure`);
    if (effect.rivalRespect) parts.push(`${effect.rivalRespect > 0 ? "+" : "−"}${Math.abs(effect.rivalRespect)} Rook respect`);
    if (effect.loseRandomInventory) parts.push(`risk ${effect.loseRandomInventory} cargo`);
    if (effect.secondLoan) parts.push("take $500 cash and owe $600 by Day 7");
    if (effect.access) parts.push(`unlock ${effect.access} access`);
    if (effect.introduceCrew) parts.push("opens a future recruitment option");
    return parts.length ? parts.join(" · ") : "Relationship and story consequences carry forward.";
  }
  function event(id, title, description, choices) {
    const context = EVENT_CONTEXT[id] || { who: "People in the current situation", where: AREA_BY_ID.north_star_lot.name, stakes: "The result changes this run." };
    return { id, title, ...context, description, choices: choices.map((choice) => ({ ...choice, preview: choice.preview || effectPreview(choice.effect || {}) })) };
  }
  function setPendingEvent(state, item) { state.run.pendingEvent = item; }
  function activeEvent(id, state) {
    const events = {
      mara_intro: () => event("mara_intro", "Mara on the Night Shift", "You have been coming to the Night Owl for months, and tonight Mara has the coffee poured before you reach the counter. She asks about the garage the way people ask about weather, out of habit rather than interest. A gray sedan goes past the window for the second time in ten minutes. Mara does not look at it, which means she noticed it before you did.", [
        { label: "Flirt and stay a minute", effect: { maraTrust: 1, setFlags: { maraFlirted: true, maraIntroChoice: "flirt" } }, preview: "Records a flirtatious first conversation that later scenes will remember.", result: "She tops up a cup you have not finished and leans on the register. \"The late shift goes faster when you stop pretending to be in a hurry.\" Somebody comes in for cigarettes and she is professional again in under a second, but she looks back at you on their way out." },
        { label: "Keep it friendly", effect: { setFlags: { maraFriendlyIntro: true, maraIntroChoice: "friendly" } }, preview: "Establishes a friendly contact. Romance stays possible later.", result: "You trade neighborhood news until a customer comes in. The fourplex on the corner sold, and the plow took out somebody's mailbox again. She rings you up at the end anyway. \"Next one's still on you.\" It is not quite a joke and not quite serious." },
        { label: "Grab the coffee and go", effect: { setFlags: { maraDistantIntro: true, maraIntroChoice: "distant" } }, preview: "Introduces Mara at a distance. She remembers that you did not stay.", result: "You take the cup and go. In the reflection off the cooler door she watches the sedan make its third pass, and she writes something small in the corner of the till tape before the door has finished closing behind you." },
      ]),
      eli_offer: () => event("eli_offer", "The Impound Notice", "Eli Ward is waiting outside North Star Garage with an impound notice folded into his jacket, the crease worn soft from being taken out and put back. He gets to it fast: he knows the loading yards, the service roads, and which gates get chained at what hour. He can move a small package without bringing a tail home. He has clearly rehearsed that last sentence.", [
        { label: "Hear him out", effect: { introduceCrew: "eli", setCrewStage: { id: "eli", stage: "test_available" }, crewLoyalty: { id: "eli", delta: 1 } }, preview: "Unlocks Give Eli a Test Route in People.", result: "He flattens the impound notice on the hood and draws the route on the back of it, naming each turn as he goes. He wants thirty-five for fuel and one chance to prove it. He does not ask what would be in the package, which is either professional or well practiced." },
        { label: "Ask about the service roads", effect: { introduceCrew: "eli", setCrewStage: { id: "eli", stage: "followup_required" }, addRumor: { areaId: "airport_industrial", productId: "shrooms", text: "Eli says construction has pushed patrol traffic away from the east industrial service road for a few hours." } }, preview: "Adds a short-lived Industrial Service Roads clue. Recruitment waits for a follow-up.", result: "He circles the east service road twice and explains that construction has pushed patrol traffic off it, but only until the crews finish, which is days and not weeks. He leaves the notice with you so you know where to find him, and asks for nothing in return." },
        { label: "Turn him away", effect: { introduceCrew: "eli", setCrewStage: { id: "eli", stage: "rejected" }, crewLoyalty: { id: "eli", delta: -1 }, setFlags: { refusedEli: true } }, preview: "Eli leaves. A later scene remembers the rejection.", result: "He folds the notice back into the same worn crease and puts it away. \"I know which doors close.\" There is no argument anywhere in it. He walks off toward the service road with his hands in his pockets and does not look back at the garage once." },
      ]),
      eli_callback: () => event("eli_callback", "Eli Comes Back With a Route", "Eli comes up beside the garage without knocking, which is new. He heard that another driver has been asking around about your routes, and he wanted you to hear it from him first. Then he makes the same offer he made before, in the same words, which is his way of showing that he has not lowered the price. He says he is finished asking after tonight.", [
        { label: "Offer the test route", effect: { setCrewStage: { id: "eli", stage: "test_available" }, crewLoyalty: { id: "eli", delta: 1 }, setFlags: { eliRejectionReopened: true } }, preview: "Unlocks Give Eli a Test Route in People.", result: "He accepts without thanking you, which somehow lands better than gratitude would have. The route and its risks are waiting in People by the time he is back in his vehicle. He does not mention the last conversation, and neither do you." },
        { label: "Tell him it is still no", effect: { setFlags: { eliRejectedFinally: true } }, preview: "Eli stays outside this operation for the rest of the week.", result: "He nods once, the way somebody nods when they have already worked out the answer and only wanted it confirmed out loud. He leaves. The next route rumor that reaches you comes through somebody who charges for it and gets half the detail wrong." },
      ]),
      miri_offer: () => event("miri_offer", "The List in Miri's Pocket", "Miri Cole takes the corner booth Downtown before you arrive and has already ordered for both of you, which tells you how the conversation is going to go. She sets one torn page on the table between the glasses. Half the names are crossed out. The ones left are the ones who still pick up, and she keeps her hand flat on the paper while she explains that.", [
        { label: "Offer her a real share", effect: { introduceCrew: "miri", crewLoyalty: { id: "miri", delta: 2 }, setFlags: { gaveMiriOwnership: true } }, preview: "Opens a future recruitment option on her terms rather than yours.", result: "She leaves her hand where it is a second longer, then slides the page across and starts talking in terms of we, which she has not done once until now. She names two people on the list she will not introduce yet, and tells you exactly why not." },
        { label: "Ask to buy the list", effect: { introduceCrew: "miri", crewLoyalty: { id: "miri", delta: -1 } }, preview: "Opens a future recruitment option, colder than it could have been.", result: "She laughs without any part of her face joining in, and folds the page back into quarters. \"You want the names without the person who knows them.\" The page goes into her pocket. She still finishes the drink, and she still pays for it." },
      ]),
      tone_offer: () => event("tone_offer", "Tone at the Garage Door", "Anton Bell is standing under the broken security light when you get to the garage, far enough back that he is not in the doorway. He points out a sedan parked in the one spot your camera does not reach, and tells you how long it has been sitting there. Rook's people cost him his last job. He does not lead with that part.", [
        { label: "Offer protection work", effect: { introduceCrew: "tone", crewLoyalty: { id: "tone", delta: 1 } }, preview: "Opens a future recruitment option and another wage against Rook.", result: "He checks the doorframe, then the hinge side, then the lock, in that order, before he asks what the work pays. \"Two things. I don't start anything, and you tell me when something's already started.\" He waits on the second one specifically." },
        { label: "Say the garage is handled", effect: { introduceCrew: "tone", crewLoyalty: { id: "tone", delta: -1 } }, preview: "Tone stays available later, with less patience for the offer.", result: "He looks at the lock, then at you, and does not say the obvious thing about either. \"All right.\" He walks back toward the street past the sedan without changing his pace, and the sedan is still in the same spot in the morning." },
      ]),
      mara_shift_change: () => event("mara_shift_change", "Twenty Minutes Past Close", "The heater ticks over the door while Mara counts the till twenty minutes past close. She tells you the Ship Creek freight yard is hiring dispatch, that the owner drinks coffee here every Thursday, and that he knows every face on this block. Then she asks what people call you, and waits like the answer matters.", [
        { label: "Tell her what the week looks like", effect: { maraTrust: 1, setFlags: { maraKnowsScope: true } }, preview: "Mara learns the real shape of your week and holds you to it later.", result: `You give her the version with the debt in it, and the seventh night, and Dre's name. Mara does not flinch. "All right, ${state.player.streetName || "friend"}," she says, and writes the yard's address on the back of a receipt. "Thursday mornings. Don't be here when he is."` },
        { label: "Keep the answer small", effect: { setFlags: { maraDeflected: true } }, preview: "Nothing changes tonight. Mara notices the size of the answer.", result: "You give her the short version. Mara nods, folds the receipt she was about to write on, and puts it in her apron. The heater ticks. She counts the last of the twenties without looking up." },
        { label: "Put $60 toward her yard fees", requires: "cash60", effect: { cash: -60, maraTrust: 2, setFlags: { maraTookMoney: true } }, preview: "Costs $60. Mara accepts the help and sets the terms you did not ask for.", result: "She takes the sixty and writes you a receipt on Night Owl paper, dated and signed, because she does not want it to be a favor. \"This is a loan,\" she says. \"I pay it back in March.\" She means it." },
      ]),
      mara_invitation: () => event("mara_invitation", "Four Hours and No Car", "Mara is outside when you come around the corner, coat already on, keys in her fist. Her shift ended early because the owner cut hours again. \"I have four hours and no car,\" she says. The lot's sodium light makes the slush look orange. She is not asking for a favor. She is asking what you want to do with the evening.", [
        { label: "Drive out to Point Woronzof", effect: { maraTrust: 2, heat: -1, setFlags: { maraDateNight: true } }, preview: "Lowers Heat and puts real ground between her and the block.", result: "You park where the inlet wind comes off the water hard enough to rock the vehicle. Mara talks about the yard, then about her mother, then about nothing at all. On the drive back she falls asleep against the window and does not apologize for it." },
        { label: "Bring her to the garage", effect: { maraTrust: 1, maraJobAtRisk: true, setFlags: { maraSawGarage: true } }, preview: "She sees the operation, and she is seen near it.", result: "She walks the length of the bay once, looks at the bags, and does not touch anything. \"This is what it is, then.\" A car slows on the street outside and keeps going. Mara watches it the whole way down the block." },
        { label: "Tell her tonight is not good", effect: { setFlags: state.flags.maraRaincheck ? { maraInvitationClosed: true } : { maraRaincheck: true } }, preview: "Nothing happens tonight. The offer may come back once.", result: "She takes it evenly, the way she takes most things. \"Then another night.\" She starts walking toward the bus shelter on Spenard before you can offer the ride." },
      ]),
      mara_boundary: () => event("mara_boundary", "The Plate on Her Wrist", "Mara meets you behind the Night Owl with the keys already in her hand and the store dark behind her. A car followed her to her door last night, sat there eleven minutes, and left. She has the plate written on the inside of her wrist. \"I am not asking you to fix it,\" she says. \"I am asking you to tell me what it is.\"", [
        { label: "Tell her everything, risk included", effect: { maraTrust: 2, setFlags: { toldMaraTruth: true } }, preview: "Mara gets the whole picture, including the part that puts her at risk.", result: "You give her Rook's name, Dre's date, and the honest odds. Mara listens all the way through without interrupting. Then she copies the plate onto a second slip and puts one in her shoe. \"Now it's mine too,\" she says. \"That was the part you owed me.\"" },
        { label: "Give the officer her name", effect: { maraTrust: -2, heat: -1, setFlags: { usedMaraWithoutConsent: true } }, preview: "Heat drops. Mara finds out from someone else that you used her name.", result: "The story holds because her name is clean and yours is not. Two days of Heat come off you. Mara hears it from the officer's partner, who buys cigarettes at her counter on Fridays and assumed she already knew." },
        { label: "Tell her you can't answer that", effect: { maraTrust: -1 }, preview: "The question stays open. Mara stops expecting an answer to it.", result: "She waits long enough to be sure that is the whole reply. Then she pockets the keys. \"Okay.\" The next time you come in, the coffee is on the counter before you reach it, and she is already turned toward the register." },
      ]),
      mara_after: () => {
        const name = state.player.streetName || "friend";
        if (state.people.mara.usedWithoutConsent) {
          return event("mara_after", "The Lights Off Two Hours Early", "The night window is closed and the Night Owl is dark before nine. Mara is in the lot with a duffel and her sister's car running. The yard job is gone; the owner heard her name in the wrong sentence from someone who did not know it mattered. \"I'm not angry,\" she says, and she is not. \"I just can't be near this.\"", [
            { label: "Tell her you're sorry and mean it", effect: { maraDeparts: true, setFlags: { maraLeftClean: true } }, preview: "She leaves either way. This is the version where you do not argue.", result: `She accepts it the way she accepts most things, evenly and without making you feel better about it. "I know." She puts the duffel in the back seat. "Lock the garage at night, ${name}. You never do."` },
            { label: "Ask her to stay", effect: { maraTrust: -1, maraDeparts: true }, preview: "She has already decided. Asking does not change it.", result: "\"No.\" Not sharp, just finished. The car pulls out and turns toward Minnesota before the headlights have swung far enough to catch you." },
          ]);
        }
        if (state.people.mara.trust >= 3 && state.flags.maraDateNight) {
          return event("mara_after", "The Name on the Receipt", "Mara slides a folded receipt across the counter with your coffee. There is a name on it, a phone number, and a bay number at the Ship Creek yard. \"He owes me, not you,\" she says. \"Which means it works once.\" Outside, the first real snow of the week is holding on the pavement instead of melting.", [
            { label: "Take the name", effect: { setFlags: { maraGaveContact: true }, addRumor: { areaId: "airport_industrial", productId: "cocaine", text: "Mara's contact at the Ship Creek yard says which bay doors stay unwatched after the second shift." } }, preview: "Adds a reliable Industrial Service Roads lead that Mara cannot get you twice.", result: `She watches you write the number somewhere better than your hand. "One time, ${name}. After that he doesn't know either of us." The coffee is already the right temperature, which means she poured it before you walked in.` },
            { label: "Tell her to keep it for herself", effect: { maraTrust: 1, setFlags: { refusedMaraContact: true } }, preview: "You give up the lead. Mara keeps a favor she can still spend on Monday.", result: "She looks at the receipt for a second, then puts it back in her apron without arguing. \"That's the first useful thing you've done all week.\" She says it flatly, and she means it as a compliment." },
          ]);
        }
        return event("mara_after", "Restocking the Cold Case", "Mara is restocking the cold case when you come in, and she keeps working through the conversation. The dispatch interview is Monday, after your week is over. She does not ask what happens to you on the seventh night, which is its own kind of answer. The cooler door fogs and clears between you.", [
          { label: "Wish her luck on Monday", effect: { maraTrust: 1 }, preview: "A small, honest exchange at the end of a week that did not include her.", result: "\"I don't need luck, I need him to read the second page.\" She sets the last row of bottles straight. \"But thank you.\" The cooler door swings shut and holds the fog for a while." },
          { label: "Ask if she'll still be here after", effect: {}, preview: "You get a straight answer, which may not be the one you want.", result: "\"Here, or Ship Creek, or Palmer.\" She does not stop working. \"Somewhere with a schedule.\" It is not an invitation and it is not a door closing, and she leaves it exactly that way." },
        ]);
      },
      courier: () => event("courier", "Courier Behind Bay Twelve", "There is a courier down beside the Industrial loading bay with a split lip and a locked case still cuffed to one wrist. He is conscious and not saying much of anything. At the far end of the lane headlights come around the corner and slow down rather than speed up, which tells you they already know what they are looking for.", [
        { label: "Spend supplies helping", effect: { cash: -55, heat: 1, setFlags: { helpedIndustrialCourier: true } }, preview: "−$55 and +1 Heat. He owes you something and knows it.", result: "You get the cuff off and get him breathing evenly against the wall. He does not thank you for it. Before he goes he tells you which service road closes on Day 6, and that the closure has nothing to do with construction." },
        { label: "Search the case", effect: { cash: 160, heat: 2, setFlags: { robbedIndustrialCourier: true } }, preview: "+$160 and +2 Heat. He is awake for all of it.", result: "The case holds cash and a route sheet folded open to the current week, and you take both. He watches you do it from the ground with his eyes open the whole time, and the bay light is more than good enough for him to keep your face." },
        { label: "Leave before the headlights arrive", effect: {}, preview: "Nothing gained. Whatever is in the case ends up somewhere else.", result: "You are back in the vehicle before the headlights reach the bay. Two nights later the same locked case turns up open in Rook's hand at the Downtown exit lane, and nobody has to explain to you how it got there." },
      ]),
      dre_after_payoff: () => event("dre_after_payoff", "Dre Opens Another Door", "Dre counts the final stack across the hood behind the Mini-Mart and, when it comes out right, tears the note in half and keeps one piece. Then he stands there instead of leaving, which he has not done before. He has three ways for you to use the name you just earned, and he lays them out like a man reading from a menu he wrote himself.", [
        { label: "Take a larger note", effect: { secondLoan: true }, preview: "Take $500 now and owe $600 by the seventh night.", result: "He transfers five hundred before you have finished agreeing to it. The new paper says six hundred by the seventh night, in the same handwriting as the last one. \"Same date. Different number.\" He is already walking back to the car while he says it." },
        { label: "Ask for the supplier", effect: { access: "cocaine", lenderTrust: 1 }, preview: "Unlocks supplier access and leaves Dre satisfied with the arrangement.", result: "He writes one Downtown address on the back of your paid note, hands it over, and burns the rest of the paperwork in the ashtray with the window cracked an inch. \"Use my name once. After that it's yours or it isn't.\"" },
        { label: "Stay independent", effect: { influence: { areaId: "north_star_lot", delta: 1 }, lenderTrust: 1, setFlags: { refusedSecondNote: true } }, preview: "No new debt. Spenard notices that you walked away clean.", result: "He puts the offer back in his jacket without any visible reaction, which from Dre is a form of respect. \"Then make your own door.\" He gets in the car. He does not say it unkindly, and he does not offer it twice." },
      ]),
      base_watch: () => event("base_watch", "The Sedan Across From the Garage", "The same gray sedan has held the curb across from North Star Garage for forty minutes. The windshield faces the bay door. The engine has not been shut off once in that time, which in this weather means somebody is sitting in it rather than watching from somewhere warm. None of it is hidden. That appears to be the point of it.", [
        { label: "Check the camera", requires: "security2", effect: { heat: -1, setFlags: { identifiedBaseWatcher: true }, baseWatched: false }, preview: "−1 Heat. You find out who is actually sitting out there.", result: "The camera catches the changeover. Rook's driver gets out and a second man in plain clothes gets in, and neither of them looks at the lens. You now know two things they do not know you know, which is worth more than the sedan leaving would have been." },
        { label: "Move the valuable stock", effect: { heat: 1, baseWatched: true }, preview: "+1 Heat. The stock moves, and so does whoever is watching.", result: "You move the bags before first light in two trips. The sedan does not follow the first one. It follows the second one, at a distance, all the way to the turn, and then it goes back to the same piece of curb it started from." },
        { label: "Leave the garage dark", effect: { baseWatched: true }, preview: "Nothing spent. The garage stays watched and they know it.", result: "Nobody comes in and nobody tries the door. In the morning there is a chalk mark low on the frame beside the lock, small enough that you would have missed it entirely if you were not already looking for something." },
      ]),
      crew_crisis: () => event("crew_crisis", "A Crew Member Misses Check-In", "A burner vibrates itself half off the garage table at four in the morning. The message is an APD booking number and a dollar amount, and nothing else — no name, no explanation, no request. The booking number belongs to somebody who works for you. Whoever sent it wants money before the shift changes, and the shift changes at six.", [
        { label: "Pay $180 and show up", effect: { cash: -180, crewAllLoyalty: 1, setFlags: { protectedCrewCrisis: true } }, preview: "−$180. Every person working for you hears about it.", result: "You are standing in the lot when the side door opens, which is a different thing entirely than posting the money and staying home. Nobody in the crew says anything about it directly. All of them know by the end of the day." },
        { label: "Protect the operation", effect: { crewAllLoyalty: -2, setFlags: { abandonedCrewCrisis: true } }, preview: "Nothing spent. Crew loyalty pays for it instead.", result: "You do not answer it. The garage is untouched in the morning, the stock is where you left it, and the operation loses nothing you can put a number against. The empty chair at the table stays where it is and everybody works around it." },
      ]),
      buyer_hurry: () => event("buyer_hurry", "Cash Across the Hood", "A Downtown buyer counts an overpay across your hood in the Mini-Mart lot, in the open, in a hurry that is his and not yours. Two customers are waiting by the door for the cigarette line to clear. One of them stops looking at his phone, steps three feet to the side, and makes a call while he is still looking at the vehicle.", [
        { label: "Take the overpay", effect: { cash: 140, heat: 1, setFlags: { buyerSeenAtMiniMart: true } }, preview: "+$140 and +1 Heat, in front of Mara's window.", result: "You take it, and it is a good number. Through the window Mara watches the man on the phone read your plate out loud, slowly, twice, and she keeps her face completely still the entire time she is ringing somebody up." },
        { label: "Move the deal elsewhere", effect: { influence: { areaId: "north_star_lot", delta: 1 }, heat: -1 }, preview: "−1 Heat and a little Spenard standing. The overpay goes away.", result: "You send him around the corner to the church lot and finish it there, out of sight of the door. It costs you four minutes and most of the premium. The Mini-Mart stays a place where you buy coffee and nothing happened in the lot." },
      ]),
      checkpoint: () => event("checkpoint", "Cones on the Service Road", "APD has the airport service road down to one lane with orange cones and a tow truck parked at the head of it. An officer walks the line and taps the rear panel of each vehicle as he passes, not looking inside, just tapping. The line behind you grows while he does it. The tow driver has been watching your vehicle specifically for a while now.", [
        { label: "Pay the tow driver $90", effect: { cash: -90, heat: -1 }, preview: "−$90 and −1 Heat. He opens a gate and asks nothing.", result: "He takes it without turning his head and opens the maintenance gate at the far end of the lot forty seconds later. He does not ask what is in the vehicle. He does not look at the vehicle at all, which visibly takes him some effort." },
        { label: "Risk the inspection", effect: { heat: 2, loseRandomInventory: 2, setFlags: { checkpointRecognizedVehicle: true } }, preview: "+2 Heat and up to two units gone. The vehicle gets written down.", result: "The officer takes his time and finds enough to make the time worth it. You leave two units behind and a full description of the vehicle in somebody's notebook, and he says the plate back to himself once while you are pulling away." },
      ]),
      rook_cut: () => event("rook_cut", "Rook's Driver Blocks the Exit", "A black sedan stops across the Downtown exit lane at an angle that is not accidental. Rook's driver gets out, opens the passenger door, and then leans on the roof and waits, unhurried, while the traffic backs up behind you. He does not say what the number is. He has clearly been told that he does not have to say it.", [
        { label: "Pay Rook $120", effect: { cash: -120, rivalPressure: -2, rivalRespect: 1, setFlags: { paidRookPassage: true } }, preview: "−$120. Rook eases off and remembers that you paid.", result: "He counts it once, fast, the way somebody counts who does this several times a day. Then he moves the sedan and gives you the next block without being asked for it, which is the part that costs more than the money did." },
        { label: "Refuse the door", effect: { rivalPressure: 3, health: -8, setFlags: { refusedRookCut: true } }, preview: "−8 Health and sharper Rook pressure. He hears you said no.", result: "The sedan does not move for a while. When it finally does, it is because two people have pulled you away from the wheel and made their point on the pavement. Rook hears the version where you refused before he hears the version where you lost." },
      ]),
      rough_night: () => event("rough_night", "Red Gloves at Bay Nine", "Three people come out from behind the Industrial loading bay, spread wide enough that going around them is not one of the options. One of them is wearing the red work gloves you last saw folded on the dash of Rook's car. Nobody has said anything yet. They are letting the arithmetic happen on its own, which is most of the work.", [
        { label: "Leave $80 on the concrete", effect: { cash: -80, health: -3 }, preview: "−$80 and a few bruises. They leave the bag alone.", result: "They take it off the concrete and leave the bag where it is, which is the deal they came out here to make. The one in the red gloves says there will be a next time, in the tone of somebody scheduling it rather than threatening you with it." },
        { label: "Hold your ground", effect: { health: -14, rivalRespect: 1, rivalPressure: 1, setFlags: { industrialCrewEncountered: true } }, preview: "−14 Health. Rook hears that you did not go down.", result: "You leave upright with blood on your collar and one of them limping worse than you are. Rook hears about it before the clinic does, and the version that reaches him is the one where you were still standing at the end of it." },
      ]),
      dre_warning: () => event("dre_warning", "Dre Counts What Is Missing", "Dre parks behind the Mini-Mart with the engine off and counts your partial stack on the hood, twice, without hurrying either time. He does not comment on the amount. When he finishes he folds one bill back and holds it out to you, which is worse than being short, and asks when the rest is coming. The question is genuine. He wants a date.", [
        { label: "Name the next payment", effect: { lenderTrust: 1, setFlags: { dreGoodFaithPayment: true } }, preview: "Dre takes the date and the partial payment for now.", result: "You give him a day and he repeats it back once, in the flat way he says numbers, and puts the stack in his jacket. \"Thursday.\" He does not write it down anywhere, which is not remotely the same thing as forgetting it." },
        { label: "Tell him to wait", effect: { lenderTrust: -2, heat: 1 }, preview: "+1 Heat and real damage to Dre's patience.", result: "He closes his jacket over the money without counting it a third time. \"All right.\" He makes one call from the driver's seat before he pulls out, short, and he is looking at the Mini-Mart door the entire time he is talking." },
      ]),
      eli_missed_turn: () => event("eli_missed_turn", "An Hour Later Than the Route", "Eli gets back an hour past when the route said he would, and he leads with the reason instead of the apology. A vehicle sat behind him from the fuel stop to the second turn, so he drove past the drop, took a lap around the freight yard, and came in from the other side. The package is intact. He is watching your face to find out whether that was the right call.", [
        { label: "Ask what he saw", effect: { crewLoyalty: { id: "eli", delta: 2 }, setFlags: { eliJudgmentTrusted: true } }, preview: "Eli learns his read is worth something here.", result: "He gives you the make, the colour, which lane it held, and the two places it could have turned off and did not. None of it is guesswork and none of it is padded. Somewhere in the middle of it he stops sounding like he is defending himself." },
        { label: "Dock the route payment", effect: { crewLoyalty: { id: "eli", delta: -2 }, cash: 20, setFlags: { eliDocked: true } }, preview: "+$20 back. He learns the clock outranks his judgment.", result: "He does not argue about it, which is worse than arguing. He hands back the twenty without counting it and says the route will be on time next run. It is on time after that, every time, including the runs where it should not have been." },
        { label: "Tell him he made the right call", effect: { crewLoyalty: { id: "eli", delta: 1 }, setFlags: { eliJudgmentTrusted: true } }, preview: "He will make that call again without asking first.", result: "\"Okay.\" He says it like he is filing it somewhere. Two days later he changes a route again without checking in, and that one is also correct, and he tells you about it afterward the same flat way he tells you the fuel cost." },
      ]),
      eli_service_map: () => event("eli_service_map", "The Map He Drew Himself", "Eli spreads a page across the passenger seat under the dome light. It is hand-drawn, to no scale at all, and better than anything you could buy: gate hours, which yards chain up at night, where the patrol cars turn around, and two crossings that do not appear on any map because they are technically somebody's parking lot. He has been building it for a year and he has never shown anyone.", [
        { label: "Pay him for a copy", requires: "cash90", effect: { cash: -90, crewLoyalty: { id: "eli", delta: 1 }, addRumor: { areaId: "airport_industrial", productId: "meth", text: "Eli's map marks two service-road crossings the patrol pattern does not cover after dark." } }, preview: "−$90. He keeps the original and you get the routes.", result: "He copies it out by hand rather than giving you the original, which takes twenty minutes and tells you exactly how he feels about the page. The copy is just as good. He folds the original back into his jacket before the money is even put away." },
        { label: "Offer him a share instead", effect: { crewLoyalty: { id: "eli", delta: 2 }, setFlags: { eliOwnsShare: true }, addRumor: { areaId: "airport_industrial", productId: "meth", text: "Eli's map marks two service-road crossings the patrol pattern does not cover after dark." } }, preview: "No cash now. He takes a cut of what the routes earn.", result: "He works out the percentage out loud, lands somewhere lower than you expected, and writes it on the corner of the map so neither of you has to remember it. Then he starts talking about a third crossing he has not verified yet, which he would not have mentioned an hour ago." },
        { label: "Tell him to keep it", effect: {}, preview: "The routes stay his. Nothing changes tonight, and he does not push.", result: "He folds it up without any visible disappointment and puts it back inside his jacket. \"It's there if you want it.\" He mentions the page exactly once more, in passing, weeks of driving later, and never pushes it again." },
      ]),
      eli_last_run: () => event("eli_last_run", "After the Seventh Night", "Eli asks it in the middle of a conversation about fuel prices, the way people ask questions they have been carrying around: what happens to him when this week is over. He is not angling for money. He has worked out that whatever you are building either has a driver's seat in it or it does not, and he would rather find out now than in eight days.", [
        { label: "Tell him there's a seat", effect: { crewLoyalty: { id: "eli", delta: 2 }, setFlags: { eliPromisedFuture: true } }, preview: "A promise he will hold you to after the seventh night.", result: "He nods once and goes straight back to the fuel prices, which is how you know it landed. Before he leaves he mentions that his cousin has a van with a working heater and no questions attached, and that he had not brought it up before because there had not been a reason to." },
        { label: "Tell him you don't know yet", effect: { setFlags: { eliToldHonestly: true } }, preview: "Honest and unsatisfying. He can work with honest.", result: "\"That's fair.\" He means it, mostly. He keeps driving the routes exactly as well as before, and he stops mentioning the week after next, and you notice the second thing more than you expected to." },
        { label: "Tell him this is a one-week job", effect: { crewLoyalty: { id: "eli", delta: -1 }, setFlags: { eliToldNoFuture: true } }, preview: "He finishes the week. He starts looking on his own time.", result: "He takes it without complaint because he asked and you answered. The routes stay clean through the seventh night. But he starts taking calls outside the bay, briefly, and he stops leaving his jacket in the vehicle." },
      ]),
      dre_terms: () => event("dre_terms", "One Folded Sheet of Paper", "Dre parks behind the Mini-Mart with the engine running and hands you one folded sheet. It has your name on it, an amount, and a date, and nothing else — no interest schedule, no signature line, no conditions. He waits while you read all four lines of it. \"That's the whole arrangement,\" he says. \"People make it complicated after. Not me.\"", [
        { label: "Say the date back to him", effect: { lenderTrust: 1, setFlags: { dreTermsAcknowledged: true } }, preview: "Dre starts the week believing you understood him.", result: "He repeats it once after you, flat, the way he says all numbers, and puts the car in gear. \"Good.\" That is the entire ceremony. The paper stays in your pocket for the rest of the week and gets softer at the folds every time you check it." },
        { label: "Ask what happens if it's late", effect: { setFlags: { dreAskedConsequences: true } }, preview: "You get a straight answer. It is not a threat.", result: "\"It gets bigger, and I stop being somebody you can call.\" He says it in the same tone as the date. There is no menace anywhere in it, which somehow makes it land harder than a threat would have. \"Most people only hear the first half.\"" },
        { label: "Ask for more time up front", effect: { lenderTrust: -1, setFlags: { dreAskedExtension: true } }, preview: "He says no. He also remembers that you asked before you started.", result: "\"No.\" No pause before it, no reason after it. Then, at the window as he pulls away: \"Ask me again on the day and I might have a different answer. Asking now just tells me what you think of yourself.\"" },
      ]),
      dre_first_payment: () => {
        const name = state.player.streetName || "friend";
        return event("dre_first_payment", "The First Money You Bring Him", `Dre counts it on the hood without hurrying, in stacks of five, and does not comment on the amount. The Mini-Mart's back light is out again so he does it by the glow of the open car door. When he finishes he puts it away and looks at you for a second longer than the transaction needs, working out whether this is a pattern or a one-off.`, [
          { label: "Tell him when the next one comes", effect: { lenderTrust: 2, setFlags: { drePaymentPattern: true } }, preview: "A date on the record. Dre keeps dates.", result: `"All right, ${name}." It is the first time he has used the name, and he uses it the way he uses numbers, as a thing that is now on file. He does not write the date down. He does not need to, and both of you know that is the point.` },
          { label: "Let the money speak", effect: { lenderTrust: 1 }, preview: "No promises made, which means nothing for him to hold you to.", result: `He accepts the silence without pushing into it. "Fine." The car door closes and the light goes out and the lot is dark again. Whatever he decided about you, he decided it while counting and he is not going to share it.` },
        ]);
      },
      dre_due_day: () => {
        const balance = state.lender.balance;
        const paid = state.lender.payments;
        const heavy = paid >= 300;
        const description = balance <= 0
          ? "Dre comes by on the due day anyway, which he did not have to do. The note is already clear. He leans on the door of the car with his hands in his pockets and talks about the weather for a minute and a half before he gets to why he is actually here, and the reason turns out to be that almost nobody clears one of these early."
          : heavy
            ? `Dre arrives on the due day and does not open with the number. He knows what you have paid; he has been keeping the running total in his head all week. $${balance} is still on the paper and there are hours left in the day. He is here to find out what you want to do about it rather than to tell you.`
            : `Dre is behind the Mini-Mart on the due day with the engine off, which he does when he intends to stay a while. $${balance} of the original amount is still sitting on the paper. He does not say anything at all when you walk up. He is going to make you open.`;
        const choices = [];
        if (balance > 0 && state.player.cash >= Math.min(balance, 100)) {
          choices.push({ label: "Pay what you have on you", effect: { payLenderNow: true, lenderTrust: 1 }, preview: "Hands over what you are carrying against the balance.", result: "You count it out onto the hood and he counts it again after you, because that is not an insult where he is from, it is just how money gets counted. The number on the paper comes down. Neither of you says anything about the part that is left." });
        }
        choices.push({ label: "Name the day you can clear it", effect: { lenderTrust: heavy ? 1 : -1, setFlags: { dreNamedFinalDate: true } }, preview: heavy ? "He has seen enough this week to take a date." : "He has not seen enough this week to take a date on faith.", result: heavy ? "He takes the date without any argument, because the week behind it does the arguing. \"I'll be here.\" He is gone in under a minute, which from Dre is a compliment." : "He listens to the date and does not agree to it or refuse it. \"You've told me a lot of things this week.\" He gets back in the car. The date stands, but so does everything else." });
        choices.push({ label: "Offer him work instead of money", effect: { lenderTrust: -1, rivalPressure: 1, setFlags: { dreOfferedFavor: true } }, preview: "He takes the offer and the balance stays where it is.", result: "\"Everybody's got something they'd rather do than pay.\" He does not say no. He takes a name and a place off you instead of cash, and by the next evening that name has a problem, and the number on your paper has not moved at all." });
        return event("dre_due_day", balance <= 0 ? "He Came By Anyway" : "The Day on the Paper", description, choices);
      },
      dre_day7: () => {
        const cleared = state.lender.balance <= 0;
        return event("dre_day7", cleared ? "The Account Closes Clean" : "What Is Left on the Paper", cleared
          ? "Dre finds you on the seventh day without having been told where you would be, which is its own kind of statement. The note is settled and there is nothing to collect, so he is here for the other reason people come at the end of an arrangement: to say out loud what he thinks he has been dealing with all week."
          : `Dre finds you on the seventh day and does not bring up the paper immediately, which is worse than if he had. The balance stands at $${state.lender.balance}. He has already decided what happens next. He is here to tell you, and to see your face while he does it.`, [
          { label: "Hear him out", effect: { lenderTrust: cleared ? 1 : 0 }, preview: cleared ? "He tells you where you stand with him." : "He tells you what the unpaid balance becomes.", result: cleared ? "\"Most people I front pay me late and act like I owe them the patience.\" He looks out at the lot rather than at you. \"You paid me. That's it. That's the whole compliment, don't wait for a better one.\"" : "\"It doesn't stop being money because the week ended.\" He says the new number, which is larger, and the new date, which is close. Then he waits to see whether you are going to argue, and does not seem to mind either way." },
          { label: "Ask what comes next", effect: { lenderTrust: cleared ? 1 : -1, setFlags: { dreAskedForFuture: true } }, preview: cleared ? "You ask about the next arrangement before he offers." : "You ask for a future while the current one is unpaid.", result: cleared ? "He takes a second with it. \"Come find me in a week and I'll have a number for you.\" It is not a yes, but he has never once said a thing like that to somebody he was finished with." : "\"Next.\" He repeats the word back like it is unfamiliar. \"You're asking me about next.\" He does not raise his voice at any point, and the conversation is over about four seconds later." },
        ]);
      },
      rook_mark: () => event("rook_mark", "Somebody Repeats a Private Detail", "The kid who sells you coffee mentions, unprompted and friendly, that somebody was asking which mornings you come in. He does not know he has told you anything. Two blocks later the tag on the wall by the bus shelter has been gone over — same wall, same spot, different hand — and whatever it says now, it is not what it said on Monday. Nobody has spoken to you directly.", [
        { label: "Ask the kid who was asking", effect: { setFlags: { rookMarkInvestigated: true }, rivalRespect: 1 }, preview: "You get a description. Rook hears that you went looking.", result: "The description is useless on its own — a man, a jacket, a car nobody looked at properly — but the kid remembers he was polite and did not buy anything. By the afternoon somebody has told Rook's driver that you asked, which was always the more useful half of doing it." },
        { label: "Change which mornings you come in", effect: { heat: -1, setFlags: { rookMarkAvoided: true } }, preview: "−1 Heat. Harder to find, and it costs you the routine.", result: "You move your hours and the coffee is worse at the new time and the walk is longer. Nothing follows you for two days. On the third, the same tag on the same wall has been gone over again, so somebody worked out the new schedule inside forty-eight hours." },
        { label: "Do nothing about it", effect: { rivalPressure: 1 }, preview: "+1 Rook pressure. Being watched costs nothing until it does.", result: "You keep the same mornings and the same corner and act as though the wall is just a wall. Nothing happens for three days. Then a buyer who has never been late is late, and apologises without explaining, and does not meet your eye while doing it." },
      ]),
      rook_tax: () => event("rook_tax", "Rook Comes Himself", "Rook Mercer gets out of the car, which the people who work for him say he almost never does. He is unhurried and entirely unthreatening and he stands close enough that the conversation cannot be overheard by the two people waiting at the corner. He names a weekly number. It is smaller than you expected, and that is deliberate: it is priced to be paid, not to be argued about.", [
        { label: "Pay the number", requires: "cash140", effect: { cash: -140, rivalPressure: -3, rivalRespect: 1, setFlags: { paidRookTax: true } }, preview: "−$140. Pressure comes off and the arrangement is real.", result: "He takes it, folds it once, and puts it in his coat without counting, which is a performance and both of you know it. \"That's this week.\" He gets back in the car. Two of the corners that were closed to you on Tuesday are open again on Wednesday." },
        { label: "Tell him you need a week", effect: { rivalPressure: 1, setFlags: { delayedRookTax: true } }, preview: "+1 pressure. He grants it, and the number will move.", result: "\"A week.\" He agrees to it immediately, which is the part that should worry you. He does not name a new figure and he does not need to, because the one thing everybody on this block knows about Rook is that the second number is never the first number." },
        { label: "Offer him a name instead", effect: { rivalRespect: 2, rivalPressure: -1, setFlags: { tradedNameToRook: true }, influence: { areaId: "north_star_lot", delta: -1 } }, preview: "Buys your pressure down using somebody else's exposure instead of cash.", result: "You give him somebody who is not you, and he takes it, and he is visibly a little more interested in you afterward than he was before. It costs nothing today. Within two days the person whose name you traded has stopped working the block, and people know why." },
        { label: "Tell him no, out loud", effect: { rivalPressure: 4, rivalRespect: 1, setFlags: { refusedRookTax: true } }, preview: "+4 pressure. Said in front of witnesses, which is the point.", result: "He accepts it without any change of expression and gets back in the car, and the two people at the corner heard all of it, which is why you said it there. By nightfall the story is around the block in a version where you said it louder." },
      ]),
      rook_day7: () => {
        const respectful = state.rival.respect >= 2 && state.rival.pressure <= 6;
        return event("rook_day7", respectful ? "An Offer at the End of the Week" : "The Account He Has Been Keeping", respectful
          ? "Rook's car is outside the garage on the seventh day and he does not get out of it. The window comes down. He has spent a week watching you handle a debt, a corner, and at least two people who work for him, and he has arrived at a number for what you are worth to him — which is not the same as what you are worth."
          : "Rook does not come himself on the seventh day. Three people arrive instead and stand in the lot without doing anything at all, which is the entire message. One of them is holding a phone with an open line on it. Whatever gets said here, he is listening to it live.", [
          { label: respectful ? "Hear the offer" : "Walk out and face them", effect: { rivalRespect: 1 }, preview: respectful ? "You find out what a working arrangement costs." : "You take the meeting on your feet, in your own lot.", result: respectful ? "The arrangement he describes is genuinely good and would leave you working for him in every way that matters except the word. He does not oversell it. \"Think about it past tonight,\" he says, and the window goes back up before you have answered." : "You go out to them and nobody touches anybody. The one with the phone holds it up slightly, and a voice on it says your name once, and then they leave. The whole thing takes ninety seconds and costs you nothing you can count." },
          { label: respectful ? "Tell him you're staying independent" : "Stay inside and let them stand there", effect: { rivalPressure: 2, setFlags: { refusedRookFinal: true } }, preview: "+2 pressure. He learns where the line is.", result: respectful ? "\"That's a no, then.\" He is not offended, which is somehow worse than if he had been. \"You'll hear from me in a month and it won't be an offer.\" The car pulls out slowly enough that it is clearly on purpose." : "They stand in the lot for forty minutes and then go. Nothing is broken and nobody is hurt and every single person on this block watched them do it, which was always the point of sending them instead of coming." },
        ]);
      },
      kip_corner_intro: () => event("kip_corner_intro", "Warm Air Off the Dryer Vents", "The Wash & Go's dryer vents push a column of warm lint-smelling air across the lot, and three people are standing in it because it is the only warm thing on this stretch of Spenard Road. One of them is working a corner out of a gym bag and has already clocked you twice. The second time you look over, he lifts his chin instead of looking away.", [
        { label: "Introduce yourself properly", effect: { meetDealer: "kip", dealerStanding: { id: "kip", delta: 1 } }, preview: "Opens Kip as a contact in People. He decides what you are later.", result: "He gives you a name, Kip, and does not ask for yours, which means he already has some version of it. The conversation lasts ninety seconds and covers nothing. By the end of it you know where he stands every night and he knows you bothered to ask." },
        { label: "Ask what he moves", effect: { meetDealer: "kip" }, preview: "Opens Kip as a contact. Straight to business, and he notices that too.", result: "He tells you weed and shrooms and nothing else, and he tells you the prices without being asked, which is either confidence or a test. He does not offer a name until you are already turning to go, and then he offers it to your back." },
        { label: "Mark the corner and keep walking", effect: { meetDealer: "kip", dealerStanding: { id: "kip", delta: -1 } }, preview: "Opens Kip as a contact, cold. He read the look you gave the bag.", result: "You do not stop, but you slow down enough to count the bag, the two people with him, and the gap between the vents and the street. He watches you do all of it. Neither of you pretends the other was not counting something." },
      ]),
      kip_recognized: () => event("kip_recognized", "Deshawn Wants a Word", "Deshawn put your name in front of Kip when you were nobody on this block, and he has been standing outside the Wash & Go for twenty minutes waiting for you to come past. He is not angry, which is worse. He wants to know whether he read you wrong, and he wants to hear it from you rather than from the four people who have already told him.", [
        { label: "Tell him straight what you did", effect: { influence: { areaId: "north_star_lot", delta: -1 }, setFlags: { ownedKipRobbery: true } }, preview: "Costs you standing on the block. He keeps talking to you afterward.", result: "You give him the version with nothing shaved off it. He listens all the way through and then stands there a while longer. \"I'm not going to say anything to anybody.\" He means it, and it is somehow worse than being shouted at." },
        { label: "Offer him money to square it", effect: { cash: -120, setFlags: { paidOffDeshawn: true } }, requires: "cash120", preview: "−$120. It settles the debt without settling what he thinks.", result: "He takes it because turning it down would be a performance and he is not interested in performing. He counts it once, puts it away, and tells you the corner is somebody else's problem now. He does not ask where the money came from, which is its own answer." },
        { label: "Tell him it was business", effect: { influence: { areaId: "north_star_lot", delta: -1 }, rivalRespect: 1, setFlags: { dismissedDeshawn: true } }, preview: "Costs block standing. The version Rook hears is that you do not flinch.", result: "\"Business.\" He repeats it back without any weight on it at all, nods once, and walks off toward Minnesota. Within two days three people who used to nod at you outside the Mini-Mart have stopped doing it, and one of them tells Rook's driver why." },
      ]),
      wet_bricks: () => event("wet_bricks", "The Tarp Tore Past Palmer", "The tarp on the flatbed tore somewhere past Palmer and the load rode the last forty miles in freezing rain. The man unstrapping it is not the man who packed it, and he wants it off his truck before his shift ends. He offers the whole lot at a little over half. The seals look intact. Some of them look intact.", [
        { label: "Buy the whole lot", requires: "cash190", effect: { cash: -190, addProduct: { id: "weed", qty: 6, unitCost: 32 }, setFlags: { boughtWetLot: true } }, preview: "−$190 for six units of weed. Condition stays unverified until you try to move it.", result: "He helps you load it, which is the first generous thing he has done all night, and is gone before you finish counting. Two of the seals are soft at the corner. The rest you will find out about at the sale." },
        { label: "Buy two and check the seals", requires: "cash70", effect: { cash: -70, addProduct: { id: "weed", qty: 2, unitCost: 35 } }, preview: "−$70 for two units you can actually inspect before committing.", result: "You take the two off the dry end of the pallet and hold each one up to the bay light. They are fine. He watches you check, decides you are not worth the argument, and re-straps what is left." },
        { label: "Leave it on the truck", effect: { setFlags: { passedWetLot: true } }, preview: "Nothing spent. He finds another buyer inside the hour.", result: "You are still in the lot when a second vehicle backs up to the flatbed and takes the lot at his asking price without opening anything. The wind comes off the flats and the whole bay smells like wet cardboard." },
      ]),
      door_knock: () => event("door_knock", "Working Their Way Along the Row", "Knocking carries through the wall, then a voice saying the words \"just a few questions\" at the unit two doors down. Through the blind you can see one officer on the landing and one at the bottom of the stairs where the plow berm blocks the walk. Whatever they want, they are working their way along the row toward this door.", [
        { label: "Sit still and let it pass", effect: { heat: 1 }, preview: "+1 Heat. You stay put and hope the row ends before this door does.", result: "The knocking reaches the next unit, holds there a while, then moves on down the landing. Somebody upstairs runs water for a long time. Nobody knocks here, but the officer at the bottom of the stairs writes something down before he leaves." },
        { label: "Move the bag out the back", effect: { heat: -2, health: -3, setFlags: { movedBagOnIce: true } }, preview: "−2 Heat. The back stairs are iced and you are carrying weight down them.", result: "The back stairs have not been salted since November. You go down them fast with the bag on one shoulder and your free hand on the rail, and you land badly at the bottom. By the time the officers reach this unit there is nothing in it worth the questions." },
        { label: "Open the door first", effect: { heat: -1, setFlags: { openedDoorToAPD: true } }, preview: "−1 Heat. Volunteering looks better than being found, and costs you the conversation.", result: "You open it before they knock, which surprises them enough to change the tone. They ask about a vehicle, not about you. You answer three questions honestly because none of them are dangerous, and they move on a door earlier than they meant to." },
      ]),
      stranded_wagon: () => event("stranded_wagon", "Hazards on the Off-Ramp", "The wagon is on the shoulder with its hazards going and the hood already up, which means she has been out here a while. Two kids are still belted in the back with their coats zipped to the chin. She waves once, apologetically, the way people do when they have already been passed forty times and have stopped expecting anything.", [
        { label: "Pull over and jump the battery", effect: { influence: { areaId: "north_star_lot", delta: 1 }, setFlags: { helpedStrandedDriver: true } }, preview: "Costs you the shoulder time. She and half the block will remember the vehicle.", result: "It takes two tries and a lot of engine noise before the wagon catches. She writes her number on a gas receipt and says her brother does bodywork in Mountain View, no charge, whenever you want. The kids wave through the back glass the entire time you are pulling away." },
        { label: "Call it in from the corner", effect: {}, preview: "Somebody official gets there eventually. You are not involved.", result: "You make the call from the lot at the top of the ramp and watch long enough to see a trooper's lights come up the shoulder. It takes twenty-five minutes. The kids' windows are fogged the whole time." },
        { label: "Keep driving", effect: {}, preview: "Nothing spent, nothing gained. The ramp is behind you in nine seconds.", result: "You are past before the decision finishes forming. In the mirror the hazards keep going, smaller, and then the on-ramp curve takes them out of sight." },
      ]),
      found_phone: () => event("found_phone", "Face-Down on the Bench", "The phone is face-down on the bench seat, still warm, screen unlocked. The last thread is a buyer arranging pickups by cross-street and half-hour window, six days out. It rings while you are holding it. The contact name on the screen is DO NOT SAVE.", [
        { label: "Copy the schedule and leave the phone", effect: { setFlags: { copiedBuyerList: true }, addRumor: { areaId: "downtown", productId: "shrooms", text: "A schedule copied off a lost phone puts a Downtown buyer on Fourth Avenue in half-hour windows for the next several days." } }, preview: "Adds a short-lived Downtown lead. Somebody eventually notices the phone was read.", result: "You write the six cross-streets on the inside of a receipt and set the phone back exactly face-down, exactly where it was. It rings twice more while you are still under the shelter. You do not look at it the second time." },
        { label: "Wipe it and hand it in", effect: { influence: { areaId: "downtown", delta: 1 }, setFlags: { returnedLostPhone: true } }, preview: "You give up the schedule. The counter staff on Fourth will know your face for the right reason.", result: "The woman behind the transit counter takes it, checks the lock screen, and thanks you by name because she has seen you on this corner before. Whoever owns it gets it back at four. You will never know who they were." },
        { label: "Put it back and walk", effect: {}, preview: "You leave it exactly as you found it, warm and ringing.", result: "You set it down and go. Half a block later it is still audible under the shelter roof, and then a bus pulls in and it is not." },
      ]),
      careful_customer: () => event("careful_customer", "Better Questions Than He Should Have", "He knows the weight before you say it and the price before you quote it. He asks which lot you park in, then apologizes for asking, then asks the same thing again in a different order. His hands are wrong for the story he is telling. Behind him nobody else in the line is looking at either of you, which is its own kind of information.", [
        { label: "Sell him exactly what he asked for", effect: { cash: 95, heat: 2, setFlags: { soldToCarefulCustomer: true } }, preview: "+$95 now, +2 Heat, and he keeps whatever he came here to collect.", result: "The money is right and the handoff is clean and he thanks you twice, which nobody does. He is gone up the block before you have finished putting it away. Two of his questions are still sitting where you cannot reach them." },
        { label: "Tell him you're not holding", effect: { setFlags: { refusedCarefulCustomer: true } }, preview: "No sale, no Heat. He may simply have been careful.", result: "He accepts it immediately, which is the first thing all night that has not been strange. \"Worth asking.\" He walks to the corner, does not cross, and stands there reading his phone for a while." },
        { label: "Ask who sent him", effect: { heat: 1, setFlags: { questionedCarefulCustomer: true } }, preview: "+1 Heat. You get a name, and he gets confirmation that you noticed.", result: "He gives you a name from two blocks over, and it is a real name, and the way he produces it means he had it ready. Whatever he was checking, he now knows you count questions. Neither of you pretends otherwise." },
      ]),
      dock_shift: () => event("dock_shift", "Two People Short", "The foreman is in the door light with a clipboard and no patience, four hours of unload and two people short. It pays cash at the end of the shift and nobody writes anything down. The wind comes up the channel hard enough to make the sodium lamps swing on their arms. It is honest work and it is four hours you do not have.", [
        { label: "Take the shift", effect: { cash: 110, heat: -1, health: -2, setFlags: { workedDockShift: true } }, preview: "+$110, −1 Heat. Four hours of real work and a sore back for it.", result: "It is pallets of canned goods and one long run of freight blankets, and by the third hour your hands have stopped closing properly. The foreman pays out of an envelope at the door and asks if you want Thursday. Nobody at the yard asked your name." },
        { label: "Tell him you can't tonight", effect: {}, preview: "Nothing gained. He fills the slot in under a minute.", result: "He has already turned toward the two men behind you before you finish the sentence. The doors roll open and the wind takes the sound of it up the channel." },
      ]),
      garage_furnace: () => event("garage_furnace", "The Door Seal Froze Shut", "The furnace stops during the night and the back bay is cold enough by morning that the door seal has frozen to the frame. Everything stored along that wall has been sitting at outside temperature for six hours. The repair number on the sticker is a Wasilla area code and an answering machine that does not say when anyone will call back.", [
        { label: "Pay the emergency callout", requires: "cash130", effect: { cash: -130, setFlags: { paidFurnaceCallout: true } }, preview: "−$130. Somebody drives in from the Valley and the bay is warm by afternoon.", result: "He comes down from Wasilla in a truck with the tailgate wired shut, replaces an igniter, and charges you for the drive more than the part. The bay is warm by two. He does not ask what is stacked along the wall and does not look at it twice." },
        { label: "Patch it yourself", effect: { health: -4, setFlags: { patchedFurnace: true } }, preview: "Nothing spent. You are on a cold concrete floor with somebody else's wiring.", result: "It is a thermocouple, which you work out after an hour on the floor with a flashlight in your teeth. It lights on the fourth try and stays lit. Your knuckles are opened up across two fingers and the whole bay smells like burnt dust for the rest of the day." },
        { label: "Leave it until the week is over", effect: { baseDamage: 1, setFlags: { ignoredFurnace: true } }, preview: "Nothing spent now. The cold wall keeps being a cold wall.", result: "You shut the connecting door and decide it is a next-week problem. By evening there is condensation running down the inside of the bay window and standing water along the base of the wall where the stock is." },
      ]),
      sedan_rumor: () => event("sedan_rumor", "Everyone Agrees on the Color", "The story reaches you third-hand and improves on the way. The gray sedan is a repo driver, or it is Rook's, or it belongs to a man whose brother you have never met. The person telling you did not see it. The person who told them did not see it either. Everyone agrees on the color and nothing else.", [
        { label: "Change your route for the day", effect: { heat: -1, setFlags: { reroutedOnRumor: true } }, preview: "−1 Heat from the longer way around, whether or not any of it was true.", result: "You take the long way to everything for a day, which costs you two good windows and produces no sedan. That is either because the story was wrong or because the route worked, and there is no version of the day that tells you which." },
        { label: "Ask somebody who would actually know", effect: { setFlags: { checkedSedanRumor: true } }, preview: "You spend the ask. The answer may be that nobody knows either.", result: "The third person you ask is the first one who was actually on the block, and what she says is that there was a gray sedan on Tuesday and she has no idea whose. It is the most honest version you get and it is worth almost nothing." },
        { label: "Carry on as planned", effect: {}, preview: "You act as though nothing was said, because possibly nothing was.", result: "You work the day you had already planned. Nothing happens, which proves nothing at all, and by evening two more people have told you the story with a different make of car in it." },
      ]),
      midtown_lights: () => event("midtown_lights", "Half a Mile at Walking Speed", "The left two lanes are coned off with four cruisers and a fire truck at the head of it, and traffic is doing walking speed for half a mile. It is a collision, not a checkpoint. It is also every officer in Midtown standing in one place, watching cars go past at ten miles an hour with nothing else to look at.", [
        { label: "Cut over to the frontage road", effect: { heat: -1, setFlags: { avoidedMidtownLights: true } }, preview: "−1 Heat. The frontage road is slower and nobody on it is being watched.", result: "You come off at Thirty-Sixth and take the frontage road behind the strip mall, past the sign for a carpet outlet that closed years ago and never came down. It adds fifteen minutes. Nobody looks at the vehicle once." },
        { label: "Sit in the line", effect: { heat: 1 }, preview: "+1 Heat. Half a mile of being the slowest thing in front of four cruisers.", result: "It takes eleven minutes to clear the cones. A trooper glances into the vehicle somewhere around the fire truck, the way people look at anything that is moving slowly past them, and then looks at the next one. It is almost certainly nothing." },
      ]),
    };
    const factory = events[id];
    if (!factory) return null;
    const built = factory();
    const identity = state.player.streetIdentity;
    const identityCopy = {
      mara_intro: { mover: "Mara notices you check the counter traffic before you sit.", earner: "Mara has already heard that you keep dates written down.", stickup: "Mara watches your hands before she watches your face.", connector: "Mara knows two people who have already said your name kindly.", wild_card: "Mara says the stories about you never agree long enough to become useful." },
      eli_offer: { mover: "Eli starts with the delivery window instead of the route.", earner: "Eli asks whether the people at your table get paid on time.", stickup: "Eli names the exits before he names the turns.", connector: "Eli names the people on the route before he names the turns.", wild_card: "Eli admits he cannot tell which version of you will show up." },
      dre_terms: { mover: "Dre asks about turnover before he asks about cash in hand.", earner: "Dre already has the payment dates written down. So do you.", stickup: "Dre leaves a longer silence after he mentions consequences.", connector: "Dre names the people who vouched before he names the number.", wild_card: "Dre says inconsistency is still a pattern if it lasts long enough." },
      rook_mark: { mover: "Rook's people have started counting your buyers.", earner: "Rook's people know which obligations you have kept.", stickup: "Rook's people stopped asking whether you carry. They ask whether you came alone.", connector: "Rook's people keep asking why calls get returned for you.", wild_card: "Rook's people have three descriptions of you and trust none of them." },
      kip_corner_intro: { mover: "You check the seals before the price. Kip notices the order.", earner: "Kip asks who taught you to keep a ledger.", stickup: "Kip leaves one hand below the dryer-door line.", connector: "Kip recognizes the name of the person who sent you.", wild_card: "Kip cannot decide whether to quote you a price or watch the exit." },
      sedan_rumor: { mover: "You weigh the rumor against the lost selling window.", earner: "You weigh it against everything due before Night.", stickup: "The version people repeat gives you a weapon whether it is true or not.", connector: "Two calls tell you more than the third-hand story did.", wild_card: "The rumor changes shape because nobody knows which version of you would react." },
      dre_day7: { mover: "Dre judges the week by what kept moving.", earner: "Dre judges the week by what got paid.", stickup: "Dre judges the week by what survived the pressure.", connector: "Dre judges the week by who is still at the table.", wild_card: "Dre says the week produced evidence in every direction." },
    };
    if (identity !== "unproven" && identityCopy[id]?.[identity]) built.description += ` ${identityCopy[id][identity]}`;
    built.choices = built.choices.filter((choice) => {
      if (!choice.requires) return true;
      if (choice.requires === "security2") return state.base.tracks.security >= 2;
      const cashGate = /^cash(\d+)$/.exec(choice.requires);
      if (cashGate) return state.player.cash >= Number(cashGate[1]);
      return true;
    });
    return built;
  }

  function startEncounter(state, id, finishAfter) {
    const templates = {
      mara_sedan_night: { title: "The Sedan Waits for Her Shift", description: "The gray sedan is in the Night Owl lot with the engine running when Mara's shift ends. A collector catches the door before it closes behind her. She does not look at him. She looks at you, and her hand goes under the counter to where the alarm is, and she waits.", enemyName: "Parking Lot Collector", enemyHealth: 30, guard: 0.10, evasion: 0.06, pursuit: 0.12, attack: [6, 12], pay: 120 },
      early_street: { title: "A Tail on the Service Road", description: "A sedan follows you away from Spenard and blocks the narrow service-road exit. No friend is close enough to pull into this decision.", enemyName: "Roadside Collector", enemyHealth: 24, guard: 0.08, evasion: 0.05, pursuit: 0.10, attack: [5, 10], pay: 85 },
      kip_retaliation: { title: "The Wash & Go Comes Looking", description: "Kip does not come alone and he does not come to talk. Two of them block the mouth of the lot and a third is already behind you by the time you hear the gravel. He is not interested in the bag or the money. He is interested in what everyone on this block saw happen to him and what they are going to see happen next.", enemyName: "Kip and Two Others", enemyHealth: 38, guard: 0.12, evasion: 0.08, pursuit: 0.14, attack: [7, 13], pay: 150 },
      mid: { title: "Rook's Loading-Bay Test", description: "Rook's people close both ends of Bay Nine. They know about the garage, the crew, and which route you used to get here.", enemyName: "Rook's Crew", enemyHealth: 42, guard: 0.14, evasion: 0.10, pursuit: 0.16, attack: [8, 14], pay: 180 },
      late: { title: "The Seventh-Night Consequence", description: "The final plan reaches the garage before you do. Red-and-blue light washes over Rook's sedan while everybody waits to see who you protect.", enemyName: "Final Opposition", enemyHealth: 58, guard: 0.18, evasion: 0.13, pursuit: 0.20, attack: [10, 18], pay: 320 },
    };
    const template = templates[id];
    if (!template) return;
    state.run.pendingEncounter = { id, step: 1, enemyHealth: template.enemyHealth, feedback: template.description, finishAfter: !!finishAfter, ...template };
    const identity = state.player.streetIdentity;
    const preview = identity === "stickup" ? "They arrived expecting you to make this physical."
      : identity === "connector" ? "They keep looking past you for whoever might answer your call."
      : identity === "mover" ? "They chose the hour when they think your business will hurt most."
      : identity === "earner" ? "They know you have obligations you intend to reach."
      : identity === "wild_card" ? "They prepared for two different versions of you and may have guessed wrong." : "Nobody here knows yet what kind of answer you give.";
    state.run.pendingEncounter.description += ` ${preview}`;
    state.run.pendingEncounter.feedback = state.run.pendingEncounter.description;
    if (id === "mara_sedan_night") {
      const tone = state.people.mara.introChoice === "flirt"
        ? "She taps the coffee lid twice, the same small signal from the first night you stayed to talk."
        : state.people.mara.introChoice === "friendly"
          ? "She catches your eye the way she does across the counter, steady, waiting for you to go first."
          : "She recognizes the way you used to leave in a hurry, and waits to see whether tonight is different.";
      const history = state.flags.usedMaraWithoutConsent
        ? "She has not said a word to you since she found out whose name went to the officer."
        : state.flags.toldMaraTruth
          ? "She has the plate memorized from the night she wrote it on the inside of her wrist."
          : state.flags.maraDateNight
            ? "Point Woronzof was four days ago. This is the same week."
            : "The question she asked behind the store is still sitting between you, unanswered.";
      state.run.pendingEncounter.description += ` ${tone} ${history}`;
      state.run.pendingEncounter.feedback = state.run.pendingEncounter.description;
    }
  }

  // ---------------------------------------------------------------------------
  // Story registry.
  //
  // Alpha v0.6 chose story beats through a linear if/else ladder, so every run
  // walked the same priority chain in the same order. The registry below replaces
  // that with declarative descriptors and a three-tier weighted selector: chains
  // stay readable, but their order and spacing vary per seed.
  //
  // Descriptor fields:
  //   id             registry key; also the activeEvent()/startEncounter() key
  //   chain          EVENT_CHAINS key, or null for a standalone beat
  //   stage          1-based position within the chain, or null
  //   classification one of CLASSIFICATIONS
  //   trigger        "reactive" (fires on cause), "chain" (story), "ambient"
  //   kind           "event" (default) or "encounter"
  //   requires       (state) => boolean gate, including prior-beat flags
  //   area           areaId the player must be standing in, or null for anywhere
  //   earliest       { day, slot } floor; slot defaults to 0
  //   latest         { day } ceiling, or null
  //   once           true when the beat may only ever fire a single time
  //   cooldown       slots that must pass before a repeatable beat returns
  //   weight         relative pick weight inside its tier
  //   exit           (state) => boolean; abandons the beat permanently
  //
  // None of this reaches the player. Events render title/who/where/stakes only.
  // Story pacing. Tuned in tests/simulate-runs.js against the Task 7A mix and
  // Mara-frequency targets; see STORY_BIBLE.md for the measured distribution.
  const STORY_BEATS_PER_DAY = 2;
  const CHAIN_BASE_CHANCE = 0.30;
  const CHAIN_PITY_BONUS = 0.16;
  const AMBIENT_BASE_CHANCE = 0.20;
  const AMBIENT_QUIET_BONUS = 0.16;
  const CLASSIFICATIONS = ["main_chapter", "character_intro", "character_followup", "relationship_scene", "threat", "opportunity", "callback", "ambient", "ending_setup"];

  const EVENT_CHAINS = {
    mara_spenard: { name: "The Night Owl", person: "mara" },
    eli_routes: { name: "Service Roads", person: "eli" },
    dre_note: { name: "Dre's Note", person: "dre" },
    rook_pressure: { name: "Rook's Attention", person: "rook" },
    kip_corner: { name: "The Wash & Go", person: "kip" },
  };

  function resolvedFlagName(id) { return `${id.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())}Resolved`; }
  function eventResolved(state, id) {
    if (id === "early_street") return !!state.flags.earlyThreatResolved;
    if (id === "mid") return !!state.flags.midThreatResolved;
    return !!state.flags[resolvedFlagName(id)];
  }
  const maraOpen = (state) => state.people.mara.available !== false && state.people.mara.status !== "gone";

  const STORY_REGISTRY = [
    // --- The Night Owl -------------------------------------------------------
    { id: "mara_intro", chain: "mara_spenard", stage: 1, classification: "character_intro", trigger: "chain",
      requires: () => true, area: "north_star_lot", earliest: { day: 1, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "mara_shift_change", chain: "mara_spenard", stage: 2, classification: "character_followup", trigger: "chain",
      requires: (s) => !!s.flags.maraIntroResolved && maraOpen(s), area: "north_star_lot",
      earliest: { day: 2, slot: 1 }, latest: { day: 6 }, once: true, cooldown: 0, weight: 8, exit: (s) => !maraOpen(s) },
    { id: "mara_invitation", chain: "mara_spenard", stage: 3, classification: "relationship_scene", trigger: "chain",
      requires: (s) => !!s.flags.maraShiftChangeResolved && maraOpen(s) && s.people.mara.trust >= 2
        && !s.flags.maraDateNight && !s.flags.maraSawGarage && !s.flags.maraInvitationClosed,
      area: "north_star_lot", earliest: { day: 3, slot: 1 }, latest: { day: 6 }, once: false, cooldown: 4, weight: 6, exit: (s) => !maraOpen(s) },
    { id: "mara_boundary", chain: "mara_spenard", stage: 4, classification: "main_chapter", trigger: "chain",
      requires: (s) => !!s.flags.maraShiftChangeResolved && maraOpen(s) && s.people.mara.trust >= 1, area: "north_star_lot",
      earliest: { day: 4, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 8, exit: (s) => !maraOpen(s) },
    { id: "mara_sedan_night", chain: "mara_spenard", stage: 5, classification: "threat", trigger: "chain", kind: "encounter",
      requires: (s) => maraThreatEligible(s), area: "north_star_lot",
      earliest: { day: 5, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 8, exit: (s) => !maraOpen(s) },
    { id: "mara_after", chain: "mara_spenard", stage: 6, classification: "callback", trigger: "chain",
      requires: (s) => !!s.flags.maraBoundaryResolved, area: "north_star_lot",
      earliest: { day: 6, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },

    // --- Service Roads -------------------------------------------------------
    { id: "eli_offer", chain: "eli_routes", stage: 1, classification: "character_intro", trigger: "chain",
      requires: () => true, area: null, earliest: { day: 1, slot: 3 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "eli_callback", chain: "eli_routes", stage: 2, classification: "callback", trigger: "chain",
      requires: (s) => !!s.flags.refusedEli && !s.flags.eliRejectedFinally, area: null,
      earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: (s) => !!s.flags.eliRejectedFinally },
    { id: "eli_missed_turn", chain: "eli_routes", stage: 2, classification: "callback", trigger: "chain",
      requires: (s) => !!s.flags.eliTestRouteResolved, area: null,
      earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "eli_service_map", chain: "eli_routes", stage: 3, classification: "opportunity", trigger: "chain",
      requires: (s) => !!s.flags.eliMissedTurnResolved || s.people.crew.eli.recruited, area: null,
      earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: null },
    { id: "eli_last_run", chain: "eli_routes", stage: 4, classification: "ending_setup", trigger: "chain",
      requires: (s) => s.people.crew.eli.introduced && !s.flags.eliRejectedFinally, area: null,
      earliest: { day: 6, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },

    // --- Dre's Note ----------------------------------------------------------
    { id: "dre_terms", chain: "dre_note", stage: 1, classification: "main_chapter", trigger: "chain",
      requires: () => true, area: null, earliest: { day: 1, slot: 1 }, latest: { day: 3 }, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "dre_first_payment", chain: "dre_note", stage: 2, classification: "callback", trigger: "reactive",
      requires: (s) => s.lender.paymentCount >= 1 && s.lender.balance > 0, area: null,
      earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "dre_due_day", chain: "dre_note", stage: 3, classification: "main_chapter", trigger: "chain",
      requires: (s) => !!s.flags.dreTermsResolved && s.run.day >= s.lender.dueDay, area: null,
      earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "dre_warning", chain: "dre_note", stage: 3, classification: "threat", trigger: "chain",
      requires: (s) => s.lender.balance > 0 && s.run.day > s.lender.dueDay && !!s.flags.dreDueDayResolved, area: null,
      earliest: { day: 5, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: (s) => s.lender.balance <= 0 },
    { id: "dre_after_payoff", chain: "dre_note", stage: 4, classification: "opportunity", trigger: "reactive",
      requires: (s) => s.lender.afterPayoffOffer === "available", area: null,
      earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 10, exit: null },
    { id: "dre_day7", chain: "dre_note", stage: 5, classification: "ending_setup", trigger: "chain",
      requires: (s) => !!s.flags.dreTermsResolved, area: null,
      earliest: { day: 7, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },

    // --- Rook's Attention ----------------------------------------------------
    { id: "rook_mark", chain: "rook_pressure", stage: 1, classification: "threat", trigger: "chain",
      requires: () => true, area: null, earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "early_street", chain: "rook_pressure", stage: 2, classification: "threat", trigger: "chain", kind: "encounter",
      requires: (s) => !!s.flags.rookMarkResolved, area: null, earliest: { day: 2, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "rook_tax", chain: "rook_pressure", stage: 3, classification: "main_chapter", trigger: "chain",
      requires: (s) => !!s.flags.earlyThreatResolved, area: null,
      earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "rook_cut", chain: "rook_pressure", stage: 4, classification: "callback", trigger: "chain",
      requires: (s) => !!s.flags.rookTaxResolved && (s.rival.pressure >= 5 || AREA_BY_ID[s.world.currentNeighborhoodId].rival >= 3),
      area: null, earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: null },
    { id: "mid", chain: "rook_pressure", stage: 5, classification: "threat", trigger: "chain", kind: "encounter",
      requires: (s) => !!s.flags.rookTaxResolved, area: null,
      earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "rook_day7", chain: "rook_pressure", stage: 6, classification: "ending_setup", trigger: "chain",
      requires: (s) => !!s.flags.earlyThreatResolved, area: null,
      earliest: { day: 7, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },

    // --- The Wash & Go -------------------------------------------------------
    { id: "kip_corner_intro", chain: "kip_corner", stage: 1, classification: "character_intro", trigger: "chain",
      requires: () => true, area: "north_star_lot", earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 7, exit: null },
    // Stage 2 is a branch: he comes back at you, or the person who vouched does.
    { id: "kip_retaliation", chain: "kip_corner", stage: 2, classification: "threat", trigger: "chain", kind: "encounter",
      requires: (s) => { const k = s.people.dealers?.kip; return !!k && k.robbedCount > 0 && k.lastRobbedDay != null && s.run.day >= k.lastRobbedDay + 2; },
      area: null, earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "kip_recognized", chain: "kip_corner", stage: 2, classification: "callback", trigger: "chain",
      requires: (s) => { const k = s.people.dealers?.kip; return !!k && k.robbedCount > 0 && k.lastTradedDay != null; },
      area: "north_star_lot", earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 7, exit: null },

    // --- Standalone beats carried over from Alpha v0.6 -----------------------
    { id: "miri_offer", chain: null, stage: null, classification: "character_intro", trigger: "ambient",
      requires: () => true, area: "downtown", earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 5, exit: null },
    { id: "tone_offer", chain: null, stage: null, classification: "character_intro", trigger: "ambient",
      requires: () => true, area: "north_star_lot", earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 5, exit: null },
    { id: "courier", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: () => true, area: "airport_industrial", earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 5, exit: null },
    { id: "base_watch", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: (s) => baseValue(s) > 0, area: "north_star_lot", earliest: { day: 5, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: null },
    { id: "crew_crisis", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: (s) => recruitedCrew(s).length > 0, area: null, earliest: { day: 5, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: null },
    { id: "buyer_hurry", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: (s) => s.people.mara.met, area: "north_star_lot", earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 4, exit: null },
    { id: "checkpoint", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: (s) => s.player.heat >= 5 || AREA_BY_ID[s.world.currentNeighborhoodId].police >= 3, area: null,
      earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 4, exit: null },
    { id: "rough_night", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: (s) => AREA_BY_ID[s.world.currentNeighborhoodId].risk >= 3 || s.player.health < 65, area: null,
      earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 4, exit: null },

    // --- Alpha v0.7 one-off street events (repeatable, cooldown-gated) --------
    { id: "wet_bricks", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: (s) => s.player.cash >= 70, area: "airport_industrial", earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
    { id: "door_knock", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: () => true, area: "north_star_lot", earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
    { id: "stranded_wagon", chain: null, stage: null, classification: "ambient", trigger: "ambient",
      requires: () => true, area: null, earliest: { day: 1, slot: 2 }, latest: null, once: false, cooldown: 8, weight: 5, exit: null },
    { id: "found_phone", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: () => true, area: "downtown", earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
    { id: "careful_customer", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: () => true, area: null, earliest: { day: 1, slot: 2 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
    { id: "dock_shift", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: () => true, area: null, earliest: { day: 1, slot: 2 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
    { id: "garage_furnace", chain: null, stage: null, classification: "ambient", trigger: "ambient",
      requires: () => true, area: "north_star_lot", earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 3, exit: null },
    { id: "sedan_rumor", chain: null, stage: null, classification: "ambient", trigger: "ambient",
      requires: () => true, area: null, earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 5, exit: null },
    { id: "midtown_lights", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: () => true, area: null, earliest: { day: 1, slot: 2 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
  ];
  const STORY_BY_ID = Object.fromEntries(STORY_REGISTRY.map((item) => [item.id, item]));

  function storyCandidates(state) {
    const absolute = slotNumber(state.run.day, state.run.slot);
    const areaId = state.world.currentNeighborhoodId;
    return STORY_REGISTRY.filter((item) => {
      if (item.once && eventResolved(state, item.id)) return false;
      if (item.area && item.area !== areaId) return false;
      if (absolute < slotNumber(item.earliest.day, item.earliest.slot || 0)) return false;
      if (item.latest && state.run.day > item.latest.day) return false;
      if (state.run.recentEvents.includes(item.id)) return false;
      const last = state.run.eventHistory ? state.run.eventHistory[item.id] : undefined;
      if (last !== undefined && absolute - last < item.cooldown) return false;
      if (item.exit && item.exit(state)) return false;
      return item.requires(state);
    });
  }
  function weightedPick(candidates, state, random) {
    const weights = candidates.map((item) => Math.max(0.01, item.weight));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let roll = random.next() * total;
    for (let index = 0; index < candidates.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) return candidates[index];
    }
    return candidates[candidates.length - 1];
  }
  function fireStory(state, descriptor) {
    state.run.eventHistory[descriptor.id] = slotNumber(state.run.day, state.run.slot);
    state.run.lastBeatSlot = slotNumber(state.run.day, state.run.slot);
    // Reactive beats fire because the player caused them, so they do not count
    // toward the anti-monopoly streak. Dre answering a payment is the game
    // responding, not his storyline crowding out the week.
    if (descriptor.chain && descriptor.trigger !== "reactive") {
      state.run.chainStreak = state.run.lastChainFired === descriptor.chain ? (state.run.chainStreak || 0) + 1 : 1;
      state.run.lastChainFired = descriptor.chain;
      state.run.lastChainSlot = slotNumber(state.run.day, state.run.slot);
    } else if (descriptor.chain) {
      state.run.lastChainSlot = slotNumber(state.run.day, state.run.slot);
    } else {
      state.run.chainStreak = 0;
      state.run.lastChainFired = null;
    }
    if (descriptor.chain) {
      if (state.run.chainBeatsDay !== state.run.day) { state.run.chainBeatsDay = state.run.day; state.run.chainBeatsToday = 0; }
      state.run.chainBeatsToday += 1;
    }
    if (descriptor.kind === "encounter") startEncounter(state, descriptor.id, false);
    else setPendingEvent(state, activeEvent(descriptor.id, state));
  }
  function scheduleStory(state, context, random) {
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.status !== "playing") return;
    const candidates = storyCandidates(state);
    if (!candidates.length) return;

    // Causally triggered callbacks fire on the cause, not on a dice roll.
    const reactive = candidates.filter((item) => item.trigger === "reactive");
    if (reactive.length) {
      fireStory(state, reactive.reduce((best, item) => (item.weight > best.weight ? item : best)));
      return;
    }
    const ambient = candidates.filter((item) => item.trigger === "ambient");
    let chains = candidates.filter((item) => item.trigger === "chain");
    // Two consecutive beats from one chain is enough. A third only happens when
    // nothing else in the week is eligible to interrupt it.
    if ((state.run.chainStreak || 0) >= 2) {
      const others = chains.filter((item) => item.chain !== state.run.lastChainFired);
      if (others.length || ambient.length) chains = others;
    }
    // The seven-day rhythm carries roughly one significant beat per day. Without
    // this cap the chain tier consumes the whole registry by Day 4 and every run
    // resolves every storyline, which is how the v0.6 ladder felt.
    const beatsToday = state.run.chainBeatsDay === state.run.day ? (state.run.chainBeatsToday || 0) : 0;
    if (beatsToday >= STORY_BEATS_PER_DAY) chains = [];
    // A beat tied to a place outranks one that could happen anywhere, when you
    // are actually standing in that place. Without this, location-agnostic
    // chains are eligible in every district and quietly starve the ones that
    // belong somewhere - which is how Mara's arc got crowded out of runs that
    // travel. It also makes standing in a district worth something.
    const rooted = chains.filter((item) => item.area);
    if (rooted.length) chains = rooted;
    if (chains.length) {
      const absolute = slotNumber(state.run.day, state.run.slot);
      // Tuned against the Task 7A mix target (3-5 story beats and 2-4 ambient
      // beats per completed run). A higher chain rate crowds street life out of
      // the opening and rebuilds the v0.6 ladder by another route.
      const stale = state.run.lastChainSlot == null || absolute - state.run.lastChainSlot >= 3;
      if (random.next() < Math.min(CHAIN_BASE_CHANCE + CHAIN_PITY_BONUS, CHAIN_BASE_CHANCE + (stale ? CHAIN_PITY_BONUS : 0))) {
        fireStory(state, weightedPick(chains, state, random));
        return;
      }
    }
    if (!ambient.length) return;
    const area = AREA_BY_ID[state.world.currentNeighborhoodId];
    // A week that goes silent for two in-game days reads as a broken game rather
    // than a quiet one. Players who never stand still long enough to pick up a
    // chain beat still get street life.
    const absoluteNow = slotNumber(state.run.day, state.run.slot);
    const quiet = state.run.lastBeatSlot == null ? absoluteNow >= 5 : absoluteNow - state.run.lastBeatSlot >= 5;
    const chance = Math.min(0.55, AMBIENT_BASE_CHANCE + (quiet ? AMBIENT_QUIET_BONUS : 0) + state.player.heat * 0.01 + area.risk * 0.015);
    if (random.next() <= chance) fireStory(state, weightedPick(ambient, state, random));
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
    if (effect.payLenderNow) {
      const amount = Math.min(state.lender.balance, state.player.cash);
      if (amount > 0) {
        state.player.cash -= amount; state.lender.balance -= amount;
        state.lender.payments += amount; state.lender.paymentCount += 1;
        state.lender.paymentHistory.push({ day: state.run.day, slot: state.run.slot, amount });
        state.stats.moneySpent.debt += amount;
        if (state.lender.balance <= 0 && state.lender.afterPayoffOffer === "locked") {
          state.lender.clearedAt = { day: state.run.day, slot: state.run.slot };
          state.lender.afterPayoffOffer = "available";
        }
      }
    }
    if (effect.meetDealer && state.people.dealers?.[effect.meetDealer]) state.people.dealers[effect.meetDealer].known = true;
    if (effect.dealerStanding && state.people.dealers?.[effect.dealerStanding.id]) {
      const record = state.people.dealers[effect.dealerStanding.id];
      record.standing = clamp(record.standing + effect.dealerStanding.delta, -5, 5);
    }
    if (effect.maraJobAtRisk) state.people.mara.jobAtRisk = true;
    if (effect.maraDeparts) { state.people.mara.available = false; state.people.mara.status = "gone"; }
    if (effect.baseDamage) state.base.damage += effect.baseDamage;
    if (effect.addProduct) {
      const slot = state.player.inventory[effect.addProduct.id];
      const room = Math.max(0, cargoCapacity(state) - cargoUsed(state));
      const gained = Math.min(room, Math.max(0, Math.floor(effect.addProduct.qty || 0)));
      if (gained > 0) {
        const unitCost = Math.max(0, Math.floor(effect.addProduct.unitCost || 0));
        const totalQty = slot.qty + gained;
        slot.avgCost = ((slot.avgCost * slot.qty) + unitCost * gained) / totalQty;
        slot.qty = totalQty;
        state.stats.productsMoved[effect.addProduct.id] += gained;
      }
      if (gained < (effect.addProduct.qty || 0)) logEntry(state, "The bag is full. What does not fit stays where it was.", "warn");
    }
    if (effect.influence) influenceChange(state, effect.influence.areaId, effect.influence.delta);
    if (effect.setFlags) Object.assign(state.flags, effect.setFlags);
    if (effect.introduceCrew && state.people.crew[effect.introduceCrew]) {
      state.people.crew[effect.introduceCrew].introduced = true;
      if (effect.introduceCrew !== "eli" && state.people.crew[effect.introduceCrew].contactStage === "unknown") state.people.crew[effect.introduceCrew].contactStage = "recruitable";
    }
    if (effect.setCrewStage && state.people.crew[effect.setCrewStage.id]) state.people.crew[effect.setCrewStage.id].contactStage = effect.setCrewStage.stage;
    if (effect.addRumor) state.effects.rumors.push({ id: `contact_${state.run.day}_${state.run.slot}_${effect.addRumor.areaId}`, ...effect.addRumor, reliable: true, expiresAt: slotNumber(state.run.day, state.run.slot) + 3 });
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
      mara_escape: "Two Tickets South", mara_clear: "She Gets the Monday Interview", mara_gone: "Gone Before You Were",
      clean_exit: "Clean Exit", rook_partner: "Rook's Partner",
      takeover: "North Star Takes the Week", dre_expansion: "Dre's New Operator", crew_saved: "Everybody Gets Home",
      disappeared: "Gone Before Dawn", arrested: "Caught", killed: "Taken Down", base_lost: "The Garage Is Gone", nowhere_to_go: "Nowhere to Go",
    })[id] || "Run Complete";
  }
  function chooseEnding(state, forced) {
    if (forced) return forced;
    if (state.people.household?.evicted) return "nowhere_to_go";
    if (state.player.health <= 0) return state.base.tracks.recovery >= 2 ? "base_lost" : "killed";
    if (state.player.heat >= 15) return "arrested";
    if (state.base.damage >= 3) return "base_lost";
    const plan = state.run.finalPlan;
    const maraIntact = state.people.mara.trust >= 3 && !state.people.mara.usedWithoutConsent && state.people.mara.available !== false;
    if (plan === "escape" && maraIntact) return "mara_escape";
    if (plan === "escape") return "clean_exit";
    if (state.people.mara.available === false && state.people.mara.chainStage >= 6) return "mara_gone";
    if (maraIntact && !state.people.mara.jobAtRisk && state.people.mara.chainStage >= 6) return "mara_clear";
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
    state.run.pendingOperationResult = null;
    state.run.ending = chooseEnding(state, forced);
    logEntry(state, `By sunrise, the week has a name: ${endingLabel(state.run.ending)}.`, state.run.ending === "one_good_run" ? "good" : "warn");
  }

  function householdWarning(state, count, reason, catastrophic) {
    const household = state.people.household;
    household.warnings += Math.max(1, count || 1);
    household.yalondaTrust -= Math.max(1, count || 1);
    household.johnTrust -= catastrophic ? 2 : 1;
    logEntry(state, reason, "bad");
    if (catastrophic || household.warnings >= 3) {
      household.evicted = true;
      endRun(state, "nowhere_to_go");
    }
  }

  function checkHomeContraband(state, random) {
    const productUnits = homeStoredCargoUsed(state);
    const itemCount = productUnits + (state.home.hiddenWeapon ? 1 : 0);
    if (!itemCount || state.people.household.evicted) return;
    const chance = clamp(0.10 + Math.max(0, itemCount - 1) * 0.08 + Math.max(0, state.player.heat - 2) * 0.02 + (state.player.heat >= 6 ? 0.10 : 0), 0, 0.90);
    if (random.next() >= chance) return;
    state.people.household.contrabandFound += 1;
    const repeatedWeapon = !!state.home.hiddenWeapon && state.people.household.warnings > 0;
    for (const product of PRODUCTS) state.home.storedInventory[product.id] = { qty: 0, avgCost: 0 };
    state.home.hiddenWeapon = null;
    householdWarning(state, repeatedWeapon ? 2 : 1, repeatedWeapon ? "John finds the weapon after the first warning. Yalonda tells you the house cannot survive another night like this." : "Yalonda finds what you hid. The contraband leaves the house, and the warning does not.", false);
  }

  function advanceRun(inputState, context) {
    const beforeFeatures = featureAvailability(inputState);
    const state = copyState(inputState);
    if (state.run.status !== "playing" || state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return state;
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
    if (crossedDay || finalSlot) {
      const nextDay = state.run.day, nextSlot = state.run.slot;
      state.run.day = oldDay; state.run.slot = 3;
      evaluateStreetIdentity(state, true);
      checkHomeContraband(state, random);
      state.run.day = nextDay; state.run.slot = nextSlot;
    }
    state.stats.pipelineAdvances += 1;
    state.stats.decisions += 1;
    announceFeatureUnlocks(state, beforeFeatures);
    if (crossedDay) state.run.daySummary = { day: oldDay, netWorth: netWorth(state), operationScore: operationScore(state), heat: state.player.heat, debt: state.lender.balance, health: state.player.health, baseValue: baseValue(state), crew: recruitedCrew(state).length };
    if (state.player.health <= 0 || state.player.heat >= 15) endRun(state);
    else if (finalSlot) endRun(state);
    else if (!context.suppressStory) scheduleStory(state, context, random);
    state.run.rngState = random.state;
    return state;
  }

  function healthModifier(health) { return health > 75 ? 0.05 : health < 40 ? -0.12 : 0; }
  function freeCargoRatio(state) { return clamp((cargoCapacity(state) - cargoUsed(state)) / Math.max(1, cargoCapacity(state)), 0, 1); }
  function encounterChoices(state) {
    const encounter = state.run.pendingEncounter;
    if (!encounter) return [];
    const choices = [
      { id: "talk", label: "Talk them down", description: "Use Charisma, influence, and relationships." },
      { id: "run", label: "Break for an exit", description: "Health, Intelligence, shoes, and a light bag matter." },
    ];
    if (state.player.cash >= encounter.pay) choices.push({ id: "pay", label: `Pay $${encounter.pay}`, description: "Keep the bag and accept the cost." });
    if (cargoUsed(state) > 0) choices.push({ id: "surrender", label: "Surrender product", description: "Protect health by giving up part of the bag." });
    const weapon = equippedWeapon(state);
    if (weapon?.type === "close" || combatRating(state) >= 3) choices.push({ id: "fight", label: weapon ? `Fight with ${weapon.name}` : "Stand and fight", description: "Combat, health, armor, and close protection matter." });
    if (weapon?.type === "firearm") choices.push({ id: "draw", label: `Draw ${weapon.name}`, description: "Combat and weapon accuracy matter. Firing raises heat." });
    if (intelligenceRating(state) >= 3) choices.push({ id: "intimidate", label: "Name their weak position", description: "Use Intelligence to make the threat feel too expensive." });
    const tone = state.people.crew.tone;
    if (tone.recruited && tone.loyalty >= 0) choices.push({ id: "call_tone", label: "Call Tone", description: "Spend crew loyalty to end this on his terms." });
    if (encounter.id === "mara_sedan_night" && state.people.mara.met) choices.push({ id: "call_mara", label: "Signal Mara", description: "Trust Mara to trigger the Night Owl alarm. This spends some of the trust between you." });
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
    if (encounter.id === "early_street") state.flags.earlyThreatResolved = true;
    if (encounter.id === "mara_sedan_night") {
      state.flags.maraSedanNightResolved = true;
      state.people.mara.chainStage = Math.max(state.people.mara.chainStage || 0, 5);
      state.people.mara.outcomes.push({ stage: 5, id: "mara_sedan_night", choice: result, day: state.run.day });
    }
    state.flags[`${encounter.id}EncounterResult`] = result;
    state.stats.majorDecisions.push(`${encounter.title}: ${result}`);
    logEntry(state, text, result === "win" || result === "escape" || result === "talk" ? "good" : "warn");
    if (encounter.finishAfter) endRun(state);
  }
  function failEncounterStep(state, random, action) {
    const encounter = state.run.pendingEncounter;
    const armor = GEAR_BY_ID[state.player.gear.equipped.armor]?.armor || 0;
    const raw = random.int(encounter.attack[0], encounter.attack[1]);
    const damage = Math.max(1, raw - armor - Math.floor(combatRating(state) / 2));
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
    if (["fight", "draw", "intimidate"].includes(choice)) recordBehavior(state, "stickup", choice === "draw" ? 2 : 1, `encounter:${encounter.id}`, "confrontation");
    else if (["talk", "call_tone", "call_mara"].includes(choice)) recordBehavior(state, "connector", 1, `encounter:${encounter.id}`, "relationship");
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
    } else if (choice === "intimidate") {
      const chance = clamp(0.38 + intelligenceRating(state) * 0.1 + state.rival.respect * 0.03 - encounter.guard, 0.15, 0.9);
      if (random.next() < chance) finishEncounter(state, "talk", "You name the cameras, exits, and people they failed to count. Their threat collapses under its own cost.");
      else failEncounterStep(state, random, "The calculation");
    } else if (choice === "talk") {
      const influence = state.world.influence[state.world.currentNeighborhoodId] * 0.04;
      const relationship = encounter.id === "mid" ? state.rival.respect * 0.035 : encounter.id === "mara_sedan_night" ? state.people.mara.trust * 0.02 : 0;
      const chance = clamp(0.28 + charismaRating(state) * 0.08 + influence + relationship - encounter.guard, 0.10, 0.90);
      if (random.next() < chance) {
        if (encounter.id === "mid") state.rival.respect += 1;
        finishEncounter(state, "talk", "You name the people and consequences they forgot to count. The lane opens without anybody reaching for a weapon.");
      } else failEncounterStep(state, random, "The explanation");
    } else if (choice === "run") {
      const gearBonus = GEAR_BY_ID[state.player.gear.equipped.utility]?.escape || 0;
      const chance = clamp(0.24 + intelligenceRating(state) * 0.09 + gearBonus + 0.18 * freeCargoRatio(state) + healthModifier(state.player.health) - encounter.pursuit, 0.10, 0.90);
      if (random.next() < chance) {
        const lost = encounter.id === "mara_sedan_night" || encounter.id === "early_street" ? null : loseInventory(state, 1);
        finishEncounter(state, "escape", lost ? `You clear the lane but drop ${lost.lost} ${lost.product.name} under the fence.` : "You saw the open lane before they did and reach the street with the bag intact.");
      } else failEncounterStep(state, random, "The escape");
    } else if (choice === "fight" || choice === "draw") {
      const weapon = equippedWeapon(state);
      const firearm = choice === "draw";
      const chance = clamp((firearm ? 0.28 + combatRating(state) * 0.09 : 0.30 + combatRating(state) * 0.09) + (weapon?.accuracy || 0) + healthModifier(state.player.health) - (firearm ? encounter.evasion : encounter.guard), 0.10, 0.90);
      if (firearm) {
        state.player.heat = clamp(state.player.heat + weapon.heat, 0, 15);
        state.flags.firedWeaponDowntown = state.world.currentNeighborhoodId === "downtown";
      }
      if (random.next() < chance) {
        const damage = weapon ? random.int(weapon.damage[0], weapon.damage[1]) + (firearm ? 0 : Math.floor(combatRating(state) / 2)) : random.int(4, 8) + combatRating(state);
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

  function removeEquippedGear(state, slot) {
    const gearId = state.player.gear.equipped[slot];
    if (!gearId) return null;
    state.player.gear.equipped[slot] = null;
    state.player.gear.owned = state.player.gear.owned.filter((id) => id !== gearId);
    return GEAR_BY_ID[gearId] || null;
  }

  function executeRobbery(inputState) {
    const availability = robberyAvailability(inputState);
    if (!availability.available) return inputState;
    const state = copyState(inputState);
    state.stats.robbery = normalizeRobberyStats(state.stats.robbery, state);
    const random = makeRandom(state.run.rngState);
    const success = random.next() < availability.chance;
    const attemptNumber = state.stats.robbery.attempts + 1;
    state.stats.robbery.attempts = attemptNumber;
    state.stats.robbery.lastAttemptedDay = state.run.day;
    state.stats.robbery.attempted = true;
    let result;
    if (success) {
      const payout = random.int(115, 210);
      const addedHeat = 2 + Math.floor((attemptNumber - 1) / 2);
      state.player.cash += payout;
      state.player.heat = clamp(state.player.heat + addedHeat, 0, 15);
      state.rival.pressure = clamp(state.rival.pressure + Math.min(3, attemptNumber), 0, 15);
      state.stats.robbery.successes += 1;
      state.stats.robbery.totalPayout += payout;
      state.stats.robbery.success = true;
      state.stats.robbery.payout = state.stats.robbery.totalPayout;
      result = {
        kind: "robbery", tone: "good", title: "The Quick Score Pays",
        summary: `A contractor leaves a cash envelope in an idling truck off the service road. You clear $${payout}, but the driver and nearby cameras get a useful description.`,
        effects: [`+$${payout} cash`, `+${addedHeat} Heat`, `+${Math.min(3, attemptNumber)} Rook pressure`, `Attempt ${attemptNumber} this week`],
      };
    } else {
      const damage = random.int(10 + Math.min(6, attemptNumber - 1), 17 + Math.min(8, attemptNumber - 1));
      const addedHeat = Math.min(5, 3 + Math.floor((attemptNumber - 1) / 2));
      state.player.health = clamp(state.player.health - damage, 0, 100);
      state.player.heat = clamp(state.player.heat + addedHeat, 0, 15);
      state.rival.pressure = clamp(state.rival.pressure + Math.min(4, attemptNumber + 1), 0, 15);
      state.stats.robbery.failures += 1;
      state.stats.robbery.success = state.stats.robbery.successes > 0;
      result = {
        kind: "robbery", tone: "bad", title: "The Quick Score Falls Apart",
        summary: "The truck is empty and the driver returns with help. You get away hurt and recognized, but another attempt can open on a later day.",
        effects: [`-${damage} Health`, `+${addedHeat} Heat`, `+${Math.min(4, attemptNumber + 1)} Rook pressure`, "$0 payout", `Attempt ${attemptNumber} this week`],
      };
    }
    state.stats.majorDecisions.push(`Quick Score ${attemptNumber}: ${success ? "success" : "failure"}`);
    recordBehavior(state, "stickup", 2, `quick_score:${state.run.day}:${attemptNumber}`, "quick_score");
    state.run.rngState = random.state;
    logEntry(state, result.summary, result.tone);
    const advanced = advanceRun(state, { reason: "QUICK_SCORE", suppressStory: true });
    if (advanced.run.status === "playing") advanced.run.pendingOperationResult = result;
    return advanced;
  }

  function executeDealerRobbery(inputState, dealerId) {
    const actions = dealerActions(inputState, dealerId);
    if (!actions.rob.available) return inputState;
    const definition = DEALER_BY_ID[dealerId];
    const first = definition.name.split(" ")[0];
    const state = copyState(inputState);
    const record = state.people.dealers[dealerId];
    const random = makeRandom(state.run.rngState);
    const success = random.next() < actions.rob.chance;
    record.robbedCount += success ? 1 : 0;
    record.lastRobbedDay = state.run.day;
    state.rival.pressure = clamp(state.rival.pressure + 1, 0, 15);
    const effects = [];
    let result;

    if (success) {
      const payout = 90 + state.run.day * 12 + random.int(0, 60);
      const productId = random.pick(definition.products);
      const units = random.int(2, 4);
      state.player.cash += payout;
      applyEventEffect(state, { addProduct: { id: productId, qty: units, unitCost: 0 } }, random);
      state.player.heat = clamp(state.player.heat + 2, 0, 15);
      record.standing = Math.max(-5, record.standing - 3);
      record.supplyChoked = 2;
      effects.push(`+$${payout} cash`, `+${units} ${PRODUCTS.find((item) => item.id === productId).name} at no cost`, "+2 Heat", "Spenard supply tightens for two days");
      if (record.robbedCount >= 2) {
        record.gone = true;
        effects.push(`${first} is finished on this block`);
      }
      result = {
        kind: "dealer_robbery", tone: "good", title: `${first} Gives Up the Corner`,
        summary: `He goes down behind the dryer vents without much of a fight and hands over the bag rather than the beating. You clear $${payout} and ${units} units. He watches you the whole way to the street, and by tomorrow nobody on this block is holding.`,
        effects,
      };
    } else {
      const armed = !!equippedWeapon(state);
      const damage = random.int(armed ? 12 : 20, 26);
      state.player.health = clamp(state.player.health - damage, 0, 100);
      state.player.heat = clamp(state.player.heat + 3, 0, 15);
      record.standing = Math.max(-5, record.standing - 3);
      record.retaliated = true;
      effects.push(`-${damage} Health`, "+3 Heat", "$0 taken", `${first} will be ready next time`);
      result = {
        kind: "dealer_robbery", tone: "bad", title: `${first} Was Waiting`,
        summary: `He is not alone and he is not surprised. You come out of the Wash & Go lot with ${damage} less health, nothing in your hands, and a face he will describe accurately to anyone who asks.`,
        effects,
      };
    }

    if (state.people.mara.chainStage >= 2 && state.people.mara.trust >= 1 && state.people.mara.available !== false) {
      state.people.mara.trust -= 1;
      logEntry(state, "Mara works two blocks from the Wash & Go. She hears about it before the end of her shift.", "warn");
    }
    state.stats.majorDecisions.push(`Robbed ${first}: ${success ? "took the corner" : "came away empty"}`);
    recordBehavior(state, "stickup", 3, `dealer_robbery:${dealerId}:${state.run.day}:${record.lastRobbedDay}:${state.player.behavior.meaningfulActions}`, "dealer_robbery");
    state.run.rngState = random.state;
    logEntry(state, result.summary, result.tone);
    const advanced = advanceRun(state, { reason: "ROB_DEALER", suppressStory: true });
    advanced.run.pendingOperationResult = result;
    return advanced;
  }

  function executeEliTestRoute(inputState) {
    const availability = eliTestRouteAvailability(inputState);
    if (!availability.available) return inputState;
    const state = copyState(inputState);
    const random = makeRandom(state.run.rngState);
    state.player.cash -= availability.cost;
    state.stats.moneySpent.crew += availability.cost;
    const successChance = clamp(0.52 + intelligenceRating(state) * 0.06 + Math.max(0, state.people.crew.eli.loyalty) * 0.03 - state.player.heat * 0.01, 0.42, 0.78);
    const success = random.next() < successChance;
    let result;
    if (success) {
      const payout = random.int(50, 80);
      state.player.cash += payout;
      state.people.crew.eli.loyalty += 1;
      result = { kind: "eli_test_route", tone: "good", title: "Eli Clears the Test Route", summary: `Eli uses the warehouse access road, delivers the package, and returns with $${payout}. He is now available to recruit at North Star Garage.`, effects: [`-$${availability.cost} route cost`, `+$${payout} delivery cash`, "+1 Eli loyalty", "Eli is recruitable"] };
    } else {
      const damage = random.int(5, 9);
      state.player.health = clamp(state.player.health - damage, 0, 100);
      state.player.heat = clamp(state.player.heat + 1, 0, 15);
      result = { kind: "eli_test_route", tone: "warn", title: "The Test Route Draws Attention", summary: `A yard truck blocks Eli's shortcut. You pull the vehicle free, lose ${damage} Health, and pick up Heat, but Eli finishes the route and is available to recruit.`, effects: [`-$${availability.cost} route cost`, `-${damage} Health`, "+1 Heat", "Eli is recruitable"] };
    }
    state.people.crew.eli.contactStage = "recruitable";
    state.flags.eliTestRouteResolved = true;
    state.stats.majorDecisions.push(`Eli test route: ${success ? "clean" : "compromised"}`);
    recordBehavior(state, "connector", 2, `eli_test_route:${state.run.day}`, "eli_route");
    state.run.rngState = random.state;
    logEntry(state, result.summary, result.tone);
    const advanced = advanceRun(state, { reason: "ELI_TEST_ROUTE", suppressStory: true });
    if (advanced.run.status === "playing") advanced.run.pendingOperationResult = result;
    return advanced;
  }

  function executeTakeover(inputState, areaId, includePlayer) {
    const readiness = takeoverReadiness(inputState, areaId, includePlayer);
    if (!readiness.available) return inputState;
    const definition = TERRITORIES.find((item) => item.areaId === areaId);
    const state = copyState(inputState);
    const random = makeRandom(state.run.rngState);
    const attackPower = crewPower(state, includePlayer);
    const defensePower = state.world.territories[areaId].power;
    const rounds = [];
    let attackerWins = 0;
    let defenderWins = 0;
    for (let round = 1; round <= 3 && attackerWins < 2 && defenderWins < 2; round += 1) {
      const attackRoll = random.int(-3, 3);
      const defenseRoll = random.int(-3, 3);
      const attackTotal = attackPower + attackRoll;
      const defenseTotal = defensePower + defenseRoll;
      const attackerWon = attackTotal > defenseTotal;
      if (attackerWon) attackerWins += 1;
      else defenderWins += 1;
      rounds.push({ round, attackRoll, defenseRoll, attackTotal, defenseTotal, winner: attackerWon ? "player" : "rook" });
    }
    const won = attackerWins >= 2;
    state.player.cash -= definition.attackCost;
    state.stats.moneySpent.base += definition.attackCost;
    state.stats.takeovers.attempts += 1;
    state.world.territories[areaId].attempts += 1;
    let title;
    let summary;
    const effects = [`-$${definition.attackCost} operation cost`];
    if (won) {
      state.stats.takeovers.wins += 1;
      state.world.territories[areaId].owner = "player";
      state.world.territories[areaId].capturedDay = state.run.day;
      state.world.influence[areaId] = 4;
      state.rival.pressure = clamp(state.rival.pressure - 2, 0, 15);
      if (areaId === "downtown") state.world.productAccess.cocaine = true;
      if (areaId === "airport_industrial") state.world.productAccess.meth = true;
      title = `${AREA_BY_ID[areaId].name} Changes Hands`;
      summary = `Your crew wins ${attackerWins}–${defenderWins}. Rook's people leave the block, and the neighborhood starts paying your operation.`;
      effects.push("Influence set to Controlled", `+$${definition.dailyIncome} after each Night`, "4% better buying and selling", definition.special);
    } else {
      state.stats.takeovers.losses += 1;
      state.player.heat = clamp(state.player.heat + 3, 0, 15);
      state.rival.pressure = clamp(state.rival.pressure + 2, 0, 15);
      effects.push("+3 Heat", "+2 Rook pressure");
      const participants = recruitedCrew(state);
      if (participants.length) {
        const lowest = Math.min(...participants.map((person) => state.people.crew[person.id].loyalty));
        const tied = participants.filter((person) => state.people.crew[person.id].loyalty === lowest);
        const lost = random.pick(tied);
        state.people.crew[lost.id].status = "gone";
        state.people.crew[lost.id].assignment = null;
        state.stats.takeovers.crewLost += 1;
        effects.push(`${lost.name} is permanently out`);
      }
      if (includePlayer) {
        const damage = random.int(20, 30);
        state.player.health = clamp(state.player.health - damage, 0, 100);
        effects.push(`-${damage} Health`);
      }
      if (defenderWins === 2 && attackerWins === 0) {
        const destroyable = ["weapon", "armor"].filter((slot) => state.player.gear.equipped[slot]);
        if (destroyable.length) {
          const destroyed = removeEquippedGear(state, random.pick(destroyable));
          effects.push(`${destroyed.name} destroyed in the shutout`);
        }
      }
      title = `${AREA_BY_ID[areaId].name} Holds`;
      summary = `Rook's crew wins ${defenderWins}–${attackerWins}. Your operation pays the cost, loses a person, and leaves the neighborhood under Rook.`;
    }
    const result = { kind: "takeover", tone: won ? "good" : "bad", title, summary, rounds, effects, areaId, won, attackPower, defensePower };
    state.stats.majorDecisions.push(`${AREA_BY_ID[areaId].name} takeover: ${won ? "won" : "lost"}`);
    recordBehavior(state, "stickup", 3, `takeover:${areaId}:${state.run.day}`, "territory_attack");
    state.run.rngState = random.state;
    logEntry(state, summary, result.tone);
    const advanced = advanceRun(state, { reason: "TAKEOVER", suppressStory: true });
    if (advanced.run.status === "playing") advanced.run.pendingOperationResult = result;
    return advanced;
  }

  function reduceGame(inputState, action) {
    if (!inputState || !action || !action.type) return inputState;
    if (action.type === "HYDRATE_RUN") return hydrateRun(action.state) || inputState;
    if (action.type === "NEW_RUN") return createRun({ seed: action.seed });
    if (action.type === "START_RUN" || action.type === "CHOOSE_BACKGROUND") {
      if (inputState.run.status !== "creating_character") return inputState;
      const background = BACKGROUNDS.find((item) => item.id === action.backgroundId);
      if (action.type === "CHOOSE_BACKGROUND" && !background) return inputState;
      const state = copyState(inputState);
      const chosenName = sanitizeStreetName(action.streetName);
      state.player.background = null;
      state.player.legacyBackground = action.type === "CHOOSE_BACKGROUND" ? background.id : null;
      state.player.attributes = action.type === "CHOOSE_BACKGROUND" ? { ...LEGACY_ATTRIBUTES[background.id] } : { ...ATTRIBUTE_DEFAULTS };
      state.player.streetName = chosenName || (action.type === "CHOOSE_BACKGROUND" ? DEFAULT_STREET_NAMES[background.id] : DEFAULT_STREET_NAMES.neutral);
      state.player.streetNameChosen = !!chosenName;
      state.player.cash = action.type === "CHOOSE_BACKGROUND" ? 375 : 1000;
      state.player.heat = action.type === "CHOOSE_BACKGROUND" ? 1 : 0;
      if (action.type === "CHOOSE_BACKGROUND") {
        state.run.premise = "legacy_established";
        state.base.controlled = true;
        state.base.acquiredDay = 1;
        state.lender.principal = 620;
        state.lender.balance = 620;
        state.lender.dueDay = 4;
        state.rival.pressure = 1;
        state.rival.relationship = "dismissive";
      }
      state.player.stats = derivedRatings(state);
      state.run.status = "playing";
      state.run.openingPending = action.type === "START_RUN";
      state.stats.startingNetWorth = state.player.cash - state.lender.balance;
      state.log = [];
      logEntry(state, action.type === "START_RUN" ? `${state.player.streetName} arrives in Anchorage with one suitcase, Yalonda's spare room, and Dre's fixed $1,200 note due on Day 7.` : `${state.player.streetName} continues an established week under Dre's note.`, "warn");
      return state;
    }
    if (action.type === "RESOLVE_ENCOUNTER") return reduceEncounter(inputState, action);
    if (action.type === "ROBBERY" || action.type === "QUICK_SCORE") return executeRobbery(inputState);
    if (action.type === "ELI_TEST_ROUTE") return executeEliTestRoute(inputState);
    if (action.type === "ROB_DEALER") return executeDealerRobbery(inputState, action.dealerId);
    if (action.type === "TAKEOVER") return executeTakeover(inputState, action.neighborhoodId, !!action.includePlayer);

    const state = copyState(inputState);
    if (state.run.status !== "playing" && action.type !== "DISMISS_DAY_SUMMARY") return inputState;
    if (action.type === "DISMISS_DAY_SUMMARY") { state.run.daySummary = null; return state; }
    if (action.type === "DISMISS_OPENING") { state.run.openingPending = false; return state; }
    if (action.type === "ACKNOWLEDGE_OPERATION_RESULT") { state.run.pendingOperationResult = null; return state; }
    if (state.run.pendingOperationResult) return inputState;
    if (state.run.pendingEncounter) return inputState;
    if (state.run.pendingEvent && action.type !== "RESOLVE_EVENT") return inputState;

    const random = makeRandom(state.run.rngState);
    if (action.type === "RESOLVE_EVENT") {
      const beforeFeatures = featureAvailability(state);
      const current = state.run.pendingEvent;
      const choice = current?.choices?.[action.choiceIndex];
      if (!current || !choice) return inputState;
      state.run.pendingEvent = null;
      applyEventEffect(state, choice.effect || {}, random);
      const eventCategory = current.id.startsWith("dre_") ? "earner" : current.id.startsWith("rook_") ? "stickup" : current.id.startsWith("eli_") || current.id.startsWith("mara_") ? "connector" : current.id.startsWith("kip_") ? "mover" : null;
      if (eventCategory) recordBehavior(state, eventCategory, current.id.endsWith("day7") ? 2 : 1, `event:${current.id}`, "story_choice");
      logEntry(state, choice.result, (choice.effect?.cash || 0) >= 0 ? "good" : "warn");
      state.stats.majorDecisions.push(`${current.title}: ${choice.label}`);
      state.run.recentEvents = [current.id, ...state.run.recentEvents.filter((id) => id !== current.id)].slice(0, 4);
      state.flags[`${current.id.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())}Resolved`] = true;
      if (current.id === "mara_intro") {
        state.people.mara.met = true;
        state.people.mara.introChoice = state.flags.maraIntroChoice || (state.flags.maraFlirted ? "flirt" : state.flags.maraFriendlyIntro ? "friendly" : "distant");
        state.people.mara.flirtHistory = !!state.flags.maraFlirted;
        state.flags.maraIntroResolved = true;
      }
      const descriptor = STORY_BY_ID[current.id];
      if (descriptor && descriptor.chain === "mara_spenard") {
        state.people.mara.chainStage = Math.max(state.people.mara.chainStage || 0, descriptor.stage);
        state.people.mara.outcomes.push({ stage: descriptor.stage, id: current.id, choice: choice.label, day: state.run.day });
      }
      if (current.id === "eli_offer") state.flags.eliOfferResolved = true;
      if (current.id === "miri_offer") state.flags.miriOfferResolved = true;
      if (current.id === "tone_offer") state.flags.toneOfferResolved = true;
      if (current.id === "courier") state.flags.courierResolved = true;
      if (current.id === "dre_after_payoff") { state.flags.dreAfterPayoffResolved = true; if (state.lender.afterPayoffOffer === "available") state.lender.afterPayoffOffer = "resolved"; }
      if (current.id === "base_watch") state.flags.baseWatchResolved = true;
      if (current.id === "crew_crisis") state.flags.crewCrisisResolved = true;
      state.run.rngState = random.state;
      announceFeatureUnlocks(state, beforeFeatures);
      if (state.player.health <= 0 || state.player.heat >= 15) endRun(state);
      return state;
    }

    if (action.type === "BUY") {
      const product = PRODUCT_BY_ID[action.productId], market = state.world.markets[state.world.currentNeighborhoodId];
      const qty = Math.max(0, Math.floor(action.qty || 0));
      if (!product || qty < 1 || !state.world.productAccess[product.id]) return inputState;
      const projection = tradeProjection(state, product.id, qty, "buy");
      const cost = projection.purchaseCost, available = market.availability[product.id] || 0;
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
      const projection = tradeProjection(state, product.id, qty, "sell");
      const unitPrice = projection.unitPrice;
      const total = projection.revenue, profit = projection.profitLoss;
      item.qty -= qty;
      if (!item.qty) item.avgCost = 0;
      state.player.cash += total;
      state.run.currentVisit.trades += 1;
      state.run.currentVisit.grossSell += total;
      state.stats.productsMoved[product.id] += qty;
      state.stats.bestTrade = Math.max(state.stats.bestTrade, total);
      state.stats.largestLoss = Math.max(state.stats.largestLoss, Math.max(0, -profit));
      if (profit >= 20) recordBehavior(state, "mover", profit >= 100 ? 2 : 1, `sale:${state.run.day}:${state.world.currentNeighborhoodId}:${state.run.currentVisit.trades}:${product.id}`, "sale");
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
    if (action.type === "HOME_STORE_CASH" || action.type === "HOME_RETRIEVE_CASH") {
      const amount = Math.max(0, Math.floor(action.amount || 0));
      if (!amount || state.people.household.evicted) return inputState;
      if (action.type === "HOME_STORE_CASH") {
        if (amount > state.player.cash) return inputState;
        state.player.cash -= amount; state.home.storedCash += amount;
        logEntry(state, `You put $${amount} with your personal things in Yalonda's spare room.`, "good");
      } else {
        if (amount > state.home.storedCash) return inputState;
        state.home.storedCash -= amount; state.player.cash += amount;
        logEntry(state, `You take $${amount} back into street cash.`, "");
      }
      return state;
    }
    if (action.type === "HOME_STORE_PRODUCT" || action.type === "HOME_RETRIEVE_PRODUCT") {
      if (!PRODUCT_BY_ID[action.productId] || state.people.household.evicted) return inputState;
      const qty = Math.max(0, Math.floor(action.qty || 0));
      if (!qty) return inputState;
      const carried = state.player.inventory[action.productId], stored = state.home.storedInventory[action.productId];
      if (action.type === "HOME_STORE_PRODUCT") {
        if (qty > carried.qty || homeStoredCargoUsed(state) + qty > 2) return inputState;
        const total = stored.qty + qty;
        stored.avgCost = total ? ((stored.avgCost * stored.qty) + carried.avgCost * qty) / total : 0;
        stored.qty = total; carried.qty -= qty; if (!carried.qty) carried.avgCost = 0;
        logEntry(state, `You hide ${qty} ${PRODUCT_BY_ID[action.productId].name} in a house where it is not allowed.`, "warn");
      } else {
        if (qty > stored.qty || cargoUsed(state) + qty > cargoCapacity(state)) return inputState;
        const total = carried.qty + qty;
        carried.avgCost = total ? ((carried.avgCost * carried.qty) + stored.avgCost * qty) / total : 0;
        carried.qty = total; stored.qty -= qty; if (!stored.qty) stored.avgCost = 0;
      }
      return state;
    }
    if (action.type === "HOME_HIDE_WEAPON" || action.type === "HOME_RETRIEVE_WEAPON") {
      if (state.people.household.evicted) return inputState;
      if (action.type === "HOME_HIDE_WEAPON") {
        const item = GEAR_BY_ID[action.gearId];
        if (!item || item.slot !== "weapon" || !hasGear(state, item.id) || state.home.hiddenWeapon) return inputState;
        state.home.hiddenWeapon = item.id;
        state.player.gear.owned = state.player.gear.owned.filter((id) => id !== item.id);
        if (state.player.gear.equipped.weapon === item.id) state.player.gear.equipped.weapon = null;
        logEntry(state, `You hide ${item.name} in Yalonda's house against the rules.`, "warn");
      } else {
        if (!state.home.hiddenWeapon) return inputState;
        const id = state.home.hiddenWeapon; state.home.hiddenWeapon = null;
        state.player.gear.owned.push(id); state.player.gear.equipped.weapon = id;
      }
      return state;
    }
    if (action.type === "ASK_JOHN") {
      if (state.people.household.evicted || state.people.household.lastQuestionDay === state.run.day) return inputState;
      state.people.household.lastQuestionDay = state.run.day;
      state.effects.rumors.push({ id: `john_${state.run.day}`, areaId: "north_star_lot", productId: "weed", reliable: true, text: "John says the bus is reliable for Downtown, Ship Creek hires early, and the Industrial roads need a ride you trust.", expiresAt: slotNumber(state.run.day, state.run.slot) + 4 });
      logEntry(state, "John gives you one careful answer without pretending the city is safer than it is.", "good");
      return state;
    }
    if (action.type === "HOUSE_VIOLATION") {
      state.people.household.dangerBroughtHome += action.danger ? 1 : 0;
      householdWarning(state, action.serious ? 2 : 1, action.reason || "Trouble reaches Yalonda's front step, and the house rules become a warning.", !!action.catastrophic);
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
      recordBehavior(state, "earner", 2, `crew_pay:${action.crewId}:${state.run.day}`, "crew_pay");
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
    if (action.type === "SLEEP_HOME") {
      if (state.people.household.evicted) return inputState;
      base.player.health = clamp(base.player.health + 12, 0, 100);
      logEntry(base, "Yalonda keeps the house quiet. You sleep, eat something basic, and recover twelve Health.", "good");
      return advanceRun(base, { reason: "SLEEP_HOME" });
    }
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
      recordBehavior(base, "earner", amount >= 150 || !base.lender.balance ? 2 : 1, `dre_payment:${base.run.day}:${base.lender.paymentCount}`, "dre_payment");
      logEntry(base, base.lender.balance ? `Dre counts $${amount} behind the Mini-Mart. $${base.lender.balance} stays written on the note.` : "Dre counts the final stack, tears the note in half, and keeps one piece.", "good");
      return advanceRun(base, { reason: "PAY_DEBT" });
    }
    if (action.type === "UPGRADE_BASE") {
      if (!state.base.visiting) return inputState;
      const track = action.track, nextLevel = (state.base.tracks[track] || 0) + 1;
      const upgrade = BASE_UPGRADES.find((item) => item.track === track && item.level === nextLevel);
      if (!upgrade || state.player.cash < upgrade.cost) return inputState;
      base.player.cash -= upgrade.cost; base.base.tracks[track] = nextLevel; base.stats.moneySpent.base += upgrade.cost;
      recordBehavior(base, "earner", 2, `base_upgrade:${track}:${nextLevel}`, "safehouse_investment");
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
      const person = CREW_BY_ID[action.crewId], crew = state.people.crew[action.crewId], cost = recruitmentCost(state, action.crewId);
      if (!crew.introduced || crew.recruited || state.player.cash < cost || (person.id === "eli" && crew.contactStage !== "recruitable")) return inputState;
      base.player.cash -= cost; crew.recruited = true; crew.status = "active"; crew.loyalty += 1; crew.wageDue = person.wage; base.stats.moneySpent.crew += cost;
      crew.contactStage = "active";
      recordBehavior(base, "connector", 3, `recruit:${action.crewId}`, "recruit");
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
    if (action.type === "BUY_FROM_DEALER") {
      const actions = dealerActions(state, action.dealerId);
      if (!actions.buy.available) return inputState;
      const definition = DEALER_BY_ID[action.dealerId];
      const first = definition.name.split(" ")[0];
      const record = base.people.dealers[action.dealerId];
      const random = makeRandom(base.run.rngState);
      const productId = random.pick(definition.products);
      const unitPrice = Math.max(1, Math.round(tradeUnitPrices(state, productId).buy * (1 - actions.buy.discount)));
      const room = cargoCapacity(state) - cargoUsed(state);
      const units = Math.min(actions.buy.units, room, Math.floor(state.player.cash / unitPrice));
      if (units <= 0) return inputState;
      base.player.cash -= unitPrice * units;
      applyEventEffect(base, { addProduct: { id: productId, qty: units, unitCost: unitPrice } }, random);
      record.standing = Math.min(5, record.standing + 1);
      record.lastTradedDay = base.run.day;
      recordBehavior(base, "mover", 1, `dealer_buy:${action.dealerId}:${base.run.day}`, "dealer_buy");
      base.run.rngState = random.state;
      logEntry(base, `${first} counts out ${units} off the books at $${unitPrice} a unit and remembers that you paid without arguing.`, "good");
      return advanceRun(base, { reason: "BUY_FROM_DEALER" });
    }
    if (action.type === "ASK_DEALER") {
      const actions = dealerActions(state, action.dealerId);
      if (!actions.ask.available) return inputState;
      const definition = DEALER_BY_ID[action.dealerId];
      const first = definition.name.split(" ")[0];
      const record = base.people.dealers[action.dealerId];
      const random = makeRandom(base.run.rngState);
      const area = random.pick(NEIGHBORHOODS);
      // He knows his own corner's product, not the whole city's supply chain.
      const product = random.pick(PRODUCTS.filter((item) => definition.products.includes(item.id)));
      record.lastAskedDay = base.run.day;
      recordBehavior(base, "mover", 1, `dealer_ask:${action.dealerId}:${base.run.day}`, "dealer_ask");
      base.effects.rumors.push({
        id: `dealer_${action.dealerId}_${base.run.day}_${base.run.slot}`,
        areaId: area.id, productId: product.id, reliable: true,
        text: `${first} says there is money in ${product.name} out in ${area.name} for the next day or so.`,
        expiresAt: slotNumber(base.run.day, base.run.slot) + 4,
      });
      base.run.rngState = random.state;
      logEntry(base, `${first} talks for a while about who is buying where, and none of it is a guess.`, "good");
      return advanceRun(base, { reason: "ASK_DEALER" });
    }
    if (action.type === "INVEST_NEIGHBORHOOD") {
      const areaId = action.neighborhoodId;
      if (!AREA_BY_ID[areaId] || state.world.currentNeighborhoodId !== areaId || state.world.influence[areaId] >= 4 || state.player.cash < 150) return inputState;
      base.player.cash -= 150; influenceChange(base, areaId, 1); base.stats.moneySpent.base += 150;
      recordBehavior(base, "earner", 2, `neighborhood_investment:${areaId}`, "safehouse_investment");
      logEntry(base, `You put $150 into a promise people in ${AREA_BY_ID[areaId].name} can see.`, "good");
      return advanceRun(base, { reason: "INVEST_NEIGHBORHOOD" });
    }
    if (action.type === "PREPARE_FINAL_PLAN") {
      const allowed = ["escape", "defend", "partner", "challenge", "last_score"];
      if (state.run.day < 6 || !allowed.includes(action.planId) || state.run.finalPlanPrepared) return inputState;
      base.run.finalPlan = action.planId; base.run.finalPlanPrepared = true;
      base.stats.majorDecisions.push(`Prepared final plan: ${action.planId}`);
      recordBehavior(base, "earner", 2, `final_plan:${action.planId}`, "day7_plan");
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
    const territories = TERRITORIES.map((definition) => ({
      ...definition,
      owner: state.world.territories[definition.areaId].owner,
      capturedDay: state.world.territories[definition.areaId].capturedDay,
      incomeCollected: state.world.territories[definition.areaId].incomeCollected,
    }));
    return {
      ending: state.run.ending, endingLabel: endingLabel(state.run.ending), cash: state.player.cash,
      streetName: state.player.streetName || "Unnamed run",
      streetIdentity: state.player.streetIdentity, streetIdentityLabel: STREET_IDENTITIES[state.player.streetIdentity]?.label || STREET_IDENTITIES.unproven.label,
      storedCash: state.base.storedCash, debt: state.lender.balance, inventoryValue: inventoryValue(state),
      netWorth: netWorth(state), operationScore: operationScore(state), baseValue: baseValue(state), gearValue: gearValue(state),
      baseTracks: { ...state.base.tracks }, crew: recruitedCrew(state).map((person) => ({ id: person.id, name: person.name, loyalty: state.people.crew[person.id].loyalty, status: state.people.crew[person.id].status })),
      influence: { ...state.world.influence }, maraStatus: state.people.mara.status, maraTrust: state.people.mara.trust,
      lenderRelationship: state.lender.relationship, rivalRelationship: state.rival.relationship,
      bestTrade: state.stats.bestTrade, largestLoss: state.stats.largestLoss, highestHeat: state.stats.highestHeat,
      productsMoved: { ...state.stats.productsMoved }, majorDecisions: [...state.stats.majorDecisions],
      territories, robbery: { ...state.stats.robbery }, takeovers: { ...state.stats.takeovers },
    };
  }

  return {
    VERSION, RUN_DAYS, SLOTS, SAVE_KEY, WORKING_CAPITAL_RESERVE, PRODUCTS, NEIGHBORHOODS, BACKGROUNDS, STARTING_EDGES, GEAR, BASE_UPGRADES, CREW, TERRITORIES,
    STREET_NAME_MAX, DEFAULT_STREET_NAMES, ATTRIBUTE_DEFAULTS, LEGACY_ATTRIBUTES, STREET_IDENTITIES, sanitizeStreetName,
    CLASSIFICATIONS, EVENT_CHAINS, STORY_REGISTRY, DEALERS,
    buildEventForTest: activeEvent, storyCandidatesForTest: storyCandidates,
    recordBehaviorForTest: recordBehavior, evaluateStreetIdentityForTest: evaluateStreetIdentity,
    createRun, hydrateRun, inspectSave, reduceGame, advanceRun, selectRunSummary,
    selectors: {
      cargoUsed, cargoCapacity, storedCargoUsed, storageCapacity, storedCashCapacity, inventoryValue, netWorth,
      combatRating, charismaRating, intelligenceRating, derivedRatings,
      operationScore, baseValue, gearValue, heatBand, priceSignal, influenceLabel, encounterChoices, endingLabel,
      recruitedCrew, workingCapital, safeDebtPayment, debtPaymentPreview, featureAvailability, layLowPreview, controlled, recruitmentCost, operationGearPower, crewPower,
      territoryPowerEstimate, territoryBenefits, tradeUnitPrices, tradeProjection, takeoverReadiness, robberyAvailability, eliTestRouteAvailability, maraThreatEligible,
      dealerRecord, dealerActions, dealerStandingLabel, dealerSupplyFactor,
    },
  };
});
