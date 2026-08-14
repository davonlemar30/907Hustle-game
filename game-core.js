(function (root, factory) {
  const encounters = typeof module === "object" && module.exports ? require("./encounters.js") : root.EncounterSystem;
  const api = factory(encounters);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GameCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (EncounterSystem) {
  "use strict";

  const VERSION = 5;
  const RUN_DAYS = 7;
  const PRESSURE_DAYS = 7;
  const MAX_ENERGY = 4;
  const SLOTS = ["Morning", "Afternoon", "Evening", "Night"];
  const SAVE_KEY = "907ogr_v5";
  const LEGACY_SAVE_KEYS = ["907ogr_v4", "907ogr_v3"];
  const PHONE_BILL = 75;
  const WEEKLY_RENT = 150;
  const WORKING_CAPITAL_RESERVE = 150;
  const STREET_NAME_MAX = 16;
  const GARAGE_DEPOSIT = 650;
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

  const { PRODUCTS, PRODUCT_BY_ID } = require("./src/data/products.js");

  const { HOME_DISTRICT_ID, NEIGHBORHOODS, TERRITORIES, SPENARD_BLOCKS, SPENARD_BLOCK_BY_ID, AREA_BY_ID } = require("./src/data/locations.js");

  const BACKGROUNDS = [
    { id: "shooter", name: "Steady-Hand Shooter", combat: 3, charisma: 1, intelligence: 2, cash: 375, heat: 1, description: "Weapons, direct confrontation, survival, and joining territory attacks are your strongest opening tools." },
    { id: "hustler", name: "Silver-Tongued Hustler", combat: 1, charisma: 3, intelligence: 2, cash: 375, heat: 1, description: "Negotiation, trade margins, recruiting, and relationship choices are your strongest opening tools." },
    { id: "strategist", name: "Strategist", combat: 2, charisma: 1, intelligence: 3, cash: 375, heat: 1, description: "Best at reading danger, intimidation, and judging territory strength." },
  ];
  const STARTING_EDGES = BACKGROUNDS.filter((item) => item.id !== "strategist");

  const { GEAR, BASE_UPGRADES, GEAR_BY_ID, LISTING_ITEMS, LISTING_ITEM_BY_ID } = require("./src/data/items.js");


  // Capability flags drive UI/reducer behavior instead of person-ID checks,
  // so a new crew member's role determines what it can do without touching
  // Safehouse/Operations rendering logic.
  const { CREW, CREW_BY_ID, DEALERS, DEALER_BY_ID, PLUGS, PLUG_BY_ID, HOUSEHOLD_NPCS, NIGHT_OWL_REGULARS } = require("./src/data/npcs.js");


  // --- v1.0 Soldier / Territory / Lieutenant tunables -----------------------
  // Kept centralized so balance passes touch one block, not every call site.
  const SOLDIER_RECRUIT_COST = 140;
  const SOLDIER_BASE_CAPACITY = 2;
  const SOLDIER_CAPACITY_PER_BLOCK = 2;
  const SOLDIERS_PER_BLOCK_CAP = 3;
  const SOLDIER_INCOME_BASE_DIMINISH = 0.85;
  const SOLDIER_ATTRITION_BASE_CHANCE = 0.05;
  const RAID_BASE_CHANCE = 0.10;
  const RAID_HEAT_WEIGHT = 0.02;
  const RAID_PATROL_WEIGHT = 0.15;
  const RAID_BLOCK_LOSS_CHANCE = 0.35; // conditional on a raid already hitting

  const FINANCIAL_HEAT_DIRTY_SPEND_THRESHOLD = 400;
  const FINANCIAL_HEAT_PER_OVER_THRESHOLD = 0.01;
  const FINANCIAL_HEAT_DECAY_PER_DAY = 1;
  const FINANCIAL_HEAT_FOLD_IN_THRESHOLD = 6;

  const DRE_COLLECTOR_TIERS = [
    { missedDaysAtLeast: 0, tier: 0, label: "No collector yet", feeMultiplier: 1.0 },
    { missedDaysAtLeast: 2, tier: 1, label: "Reminder calls", feeMultiplier: 1.15 },
    { missedDaysAtLeast: 4, tier: 2, label: "A collector shows up", feeMultiplier: 1.35 },
    { missedDaysAtLeast: 6, tier: 3, label: "Serious collectors", feeMultiplier: 1.6 },
  ];
  const DRE_COLLECTOR_KILL_INTEREST_BUMP = 0.25;
  const DRE_COLLECTOR_INTEREST_CAP = 3.0;

  const ELI_LIEUTENANT_UNLOCK = { minLoyalty: 3 };
  const SHARK_BORROWERS = [
    { id: "nora", name: "Nora Pike", risk: 0.08, riskLabel: "Low", max: 100, description: "Food-cart owner covering a repair before the lunch rush." },
    { id: "jamal", name: "Jamal Briggs", risk: 0.18, riskLabel: "Medium", max: 250, description: "Dock worker bridging the week before overtime clears." },
    { id: "kelsey", name: "Kelsey Roy", risk: 0.28, riskLabel: "Elevated", max: 500, description: "Bartender with steady cash and inconsistent timing." },
    { id: "leon", name: "Leon Grant", risk: 0.42, riskLabel: "High", max: 500, description: "Street runner whose next score is always supposed to settle everything." },
  ];
  const SHARK_TERMS = { 2: 0.40, 4: 0.25, 7: 0.15 };
  const DRE_MISSIONS = [
    { id: "delivery", label: "Delivery", pay: [70, 95] },
    { id: "collection", label: "Collection", pay: [90, 125] },
    { id: "enforcement", label: "Enforcement", pay: [110, 160] },
    { id: "intelligence", label: "Intelligence", pay: [80, 115] },
  ];
  const DRE_BACKSTORY = [
    "Fairbanks taught Dre that cold makes every promise sound shorter.",
    "Dre has been sober long enough to count the years without announcing the number.",
    "His grandmother kept a second freezer full for whoever arrived hungry.",
    "The oil-rig money looked permanent until the first injury and the last rotation.",
    "He learned lending from watching who came back before they were chased.",
  ];

  // Eli's standing operating order once he is Operations Lieutenant. He
  // evaluates whichever policy is active inside the existing advanceRun
  // organization-resolution pass (resolveSoldierOperations) — there is no
  // separate clock or lieutenant-management tick.
  const ELI_OPERATION_POLICIES = {
    balanced: { label: "Balanced", description: "Spreads soldiers evenly across controlled blocks for a mix of income and defense." },
    maximize_income: { label: "Maximize Income", description: "Fills the highest-earning blocks first." },
    hold_ground: { label: "Hold Ground", description: "Reinforces the blocks most exposed to Curtis and patrols." },
    stay_quiet: { label: "Stay Quiet", description: "Favors the lowest Heat and patrol-exposure blocks." },
    manual: { label: "Manual", description: "Eli leaves placement to you." },
  };
  const ELI_EFFECTIVENESS_ATTRITION_DISCOUNT = 0.01; // per effectiveness point, off the idle-attrition roll

  const RESPECT_STAGE_THRESHOLDS = { mark: 0, tax: 2, cut: 5, mid: 6, day7: 8 };

  // District Control is the strategic, neighborhood-wide layer (the old
  // world.territories takeover system, relabeled for players). Territory
  // Blocks are the tactical layer underneath it. Where an area has blocks
  // (Spenard today), District Control tracks how many of them are held, plus
  // a capstone condition, rather than double-counting the block income
  // itself. Areas without a block layer yet (Downtown, Industrial) fall back
  // to the plain owner boolean from the old takeover system.
  const DISTRICT_CONTROL_TIERS = [
    { minBlocks: 0, label: "Neutral" },
    { minBlocks: 1, label: "Presence" },
    { minBlocks: 3, label: "Influence" },
    { minBlocks: 4, label: "Dominant" },
  ];
  const DISTRICT_CONTROL_CAPSTONE_BLOCKS = 6; // all Spenard blocks
  const DISTRICT_CONTROL_CAPSTONE_RESPECT = RESPECT_STAGE_THRESHOLDS.mid; // Curtis has to take the operation seriously first
  const DISTRICT_CONTROL_LABEL = "District Control";
  const DISTRICT_CONTROL_DISCOUNT_BONUS = 0.02; // stacks on top of the existing block-owner trade discount at Dominant+




  const BOOST_TARGETS = [
    { id: "night_owl", name: "Night Owl Mini-Mart", areaId: "north_star_lot", tier: 1, take: [15, 40] },
    { id: "spenard_fuel", name: "Spenard Fuel", areaId: "north_star_lot", tier: 1, take: [15, 40] },
    { id: "fourth_ave_market", name: "Fourth Avenue Market", areaId: "downtown", tier: 1, take: [15, 40] },
    { id: "downtown_fuel", name: "Downtown Fuel", areaId: "downtown", tier: 1, take: [15, 40] },
    { id: "service_stop", name: "Service Road Stop", areaId: "airport_industrial", tier: 1, take: [15, 40] },
    { id: "airport_fuel", name: "Airport Fuel", areaId: "airport_industrial", tier: 1, take: [15, 40] },
    { id: "northern_value", name: "Northern Value", areaId: "north_star_lot", tier: 2, take: [60, 150], windowSlot: 1 },
    { id: "midtown_pharmacy", name: "Midtown Pharmacy", areaId: "north_star_lot", tier: 2, take: [60, 150], windowSlot: 2 },
    { id: "fourth_ave_electronics", name: "Fourth Avenue Electronics", areaId: "downtown", tier: 2, take: [60, 150], windowSlot: 3 },
    { id: "warehouse_club", name: "Warehouse Club", areaId: "north_star_lot", tier: 3, take: [200, 500] },
    { id: "loading_dock_seven", name: "Loading Dock Seven", areaId: "airport_industrial", tier: 3, take: [200, 500] },
    { id: "delivery_route_4", name: "Delivery Route 4", areaId: "downtown", tier: 3, take: [200, 500] },
  ];
  const BOOST_TARGET_BY_ID = Object.fromEntries(BOOST_TARGETS.map((target) => [target.id, target]));

  const { JOB_RANK_THRESHOLDS, JOB_APPROACHES, SPENARD_JOBS, SPENARD_JOB_BY_ID, STARTER_JOB_IDS } = require("./src/data/jobs.js");

  const LISTING_CAPACITY = 3;
  const NIGHT_OWL_BOARD = [
    { id: "jobs", title: "Help wanted", body: "Two counters need reliable hands this week." },
    { id: "list", title: "907List", body: "Buy it cheap. Clean it up. Find the next buyer." },
    { id: "game", title: "Late table", body: "A handwritten card promises a game after the doors lock." },
    { id: "garage", title: "North Star Garage", body: "$650 deposit. Heat works. Door sticks in winter." },
    { id: "opportunity", title: "Cash work", body: "A number is torn off every tab except one." },
    { id: "laptop", title: "Used laptop · $250", body: "Battery is tired. Browser works. Charger included." },
    { id: "gym", title: "Community gym", body: "First membership is $30. Training costs extra." },
  ];
  const DOWNTOWN_CONTENT_STUBS = ["circle_k", "fourth_avenue_bars", "rei"];
  const DOWNTOWN_AMBIENT = [
    "Construction on 4th Ave. A few bars gear up for the evening. Nothing pulls at you yet.",
    "Downtown foot traffic. People in work clothes head somewhere with purpose. You are just passing through.",
  ];

  const ALL_DAY_SLOTS = [0, 1, 2, 3];
  const DISTRICT_ACTIONS = {
    explore_spenard: {
      id: "explore_spenard", areaId: HOME_DISTRICT_ID, slots: ALL_DAY_SLOTS, cashCost: 0, timeCost: 1, healthCost: 0,
      action: { type: "WANDER_SPENARD" }, around: true, order: 10,
    },
    local_intel: {
      id: "local_intel", areaId: HOME_DISTRICT_ID, slots: ALL_DAY_SLOTS, cashCost: 0, timeCost: 0, healthCost: 0,
      action: null, around: true, order: 20,
    },
    night_owl: {
      id: "night_owl", areaId: HOME_DISTRICT_ID, slots: [2, 3], cashCost: 0, timeCost: 0, healthCost: 0,
      action: null, around: false, order: 30, closedReason: "Opens at dusk.",
    },
    spenard_gym: {
      id: "spenard_gym", areaId: HOME_DISTRICT_ID, slots: ALL_DAY_SLOTS,
      cashCost: (state) => gymSessionDetails(state).cost, timeCost: 1, healthCost: 0,
      action: { type: "TRAIN_ATTRIBUTE" }, around: false, order: 40,
      visibleWhen: (state) => !!state.discovered?.spenardGym,
    },
    spenard_phone_store: {
      id: "spenard_phone_store", areaId: HOME_DISTRICT_ID, slots: ALL_DAY_SLOTS,
      cashCost: PHONE_BILL, timeCost: 1, healthCost: 0,
      action: { type: "PAY_PHONE_BILL", surface: "store" }, around: false, order: 45,
    },
    spenard_gambling: {
      id: "spenard_gambling", areaId: HOME_DISTRICT_ID, slots: [2, 3],
      cashCost: (_state, params) => Math.max(0, Math.floor(params.stake || 0)), timeCost: 1, healthCost: 0,
      action: { type: "GAMBLE" }, around: true, order: 50,
      visibleWhen: (state) => !!state.world.locations.gamblingKnown,
      closedReason: "The game runs in the Evening and at Night.",
    },
    northern_value_shoplift: {
      id: "northern_value_shoplift", areaId: HOME_DISTRICT_ID, slots: ALL_DAY_SLOTS, cashCost: 0, timeCost: 1, healthCost: 0,
      action: { type: "SHOPLIFT" }, around: false,
    },
    night_owl_board: {
      id: "night_owl_board", areaId: HOME_DISTRICT_ID, slots: [2, 3], cashCost: 0, timeCost: 0, healthCost: 0,
      action: { type: "VIEW_NIGHT_OWL_BOARD" }, around: false, closedReason: "Opens at dusk.",
    },
    night_owl_coffee: {
      id: "night_owl_coffee", areaId: HOME_DISTRICT_ID, slots: [2, 3], cashCost: 4, timeCost: 1, healthCost: 0,
      action: { type: "BUY_COFFEE" }, around: false, closedReason: "Opens at dusk.",
    },
    night_owl_regular: {
      id: "night_owl_regular", areaId: HOME_DISTRICT_ID, slots: [2, 3], cashCost: 0, timeCost: 1, healthCost: 0,
      action: { type: "TALK_NIGHT_OWL_REGULAR" }, around: false, closedReason: "Opens at dusk.",
    },
    night_owl_visit: {
      id: "night_owl_visit", areaId: HOME_DISTRICT_ID, slots: [2, 3], cashCost: 0, timeCost: 1, healthCost: 0,
      action: { type: "VISIT_NIGHT_OWL" }, around: false, closedReason: "Opens at dusk.",
    },
    night_owl_stash: {
      id: "night_owl_stash", areaId: HOME_DISTRICT_ID, slots: [2, 3], cashCost: 0, timeCost: 0, healthCost: 0,
      action: null, around: false, closedReason: "Opens at dusk.",
    },
    return_spenard: {
      id: "return_spenard", areaId: "*", slots: ALL_DAY_SLOTS,
      cashCost: (state) => transitCovered(state) ? 0 : 5, timeCost: 1, healthCost: 0,
      action: { type: "TRAVEL", neighborhoodId: HOME_DISTRICT_ID }, around: true, order: 0,
    },
    walk_spenard: {
      id: "walk_spenard", areaId: "*", slots: ALL_DAY_SLOTS, cashCost: 0, timeCost: 2, healthCost: 3,
      action: { type: "WALK_HOME" }, around: true, order: 1,
      visibleWhen: (state) => state.world.currentNeighborhoodId !== HOME_DISTRICT_ID && !travelAvailability(state, HOME_DISTRICT_ID).available,
    },
    ...Object.fromEntries(SPENARD_JOBS.map((job) => [`job:${job.id}`, {
      id: `job:${job.id}`, areaId: job.areaId, slots: job.slots, cashCost: 0, timeCost: 1, healthCost: 0,
      action: { type: "WORK_JOB", jobId: job.id }, around: false,
    }])),
  };

  const DISTRICT_ACTION_BY_TYPE = {
    WANDER_SPENARD: "explore_spenard", EXPLORE_SPENARD: "explore_spenard", TRAIN_ATTRIBUTE: "spenard_gym", PAY_PHONE_BILL: "spenard_phone_store",
    GAMBLE: "spenard_gambling", SHOPLIFT: "northern_value_shoplift", VIEW_NIGHT_OWL_BOARD: "night_owl_board",
    BUY_COFFEE: "night_owl_coffee", TALK_NIGHT_OWL_REGULAR: "night_owl_regular", VISIT_NIGHT_OWL: "night_owl_visit",
    NIGHT_OWL_STASH_CASH: "night_owl_stash", NIGHT_OWL_STASH_PRODUCT: "night_owl_stash", WALK_HOME: "walk_spenard",
  };

  const SOCIAL_CONTACTS = Object.fromEntries([
    ...SPENARD_JOBS.flatMap((job) => job.coworkers.map((person) => ({ ...person, jobId: job.id, location: job.id === "night_owl" ? "night_owl" : `job:${job.id}` }))),
    ...NIGHT_OWL_REGULARS.map((person) => ({ ...person, location: "night_owl", regular: true })),
    ...HOUSEHOLD_NPCS,
  ].map((person) => [person.id, person]));

  const STORY_CONTACTS = [
    { id: "yalonda", name: "Yalonda Hernandez", role: "Landlord", visibleWhen: () => true,
      status: (s) => s.people.household.evicted ? "Room closed" : `${s.people.household.warnings}/3 warnings`,
      summary: (s) => `She rents you the spare room. Trust ${s.npc.yalonda.trust}; rent is due Day ${s.obligations.rentDueDay}.`, actions: ["TALK_HOUSEHOLD"] },
    { id: "juan", name: "Juan Hernandez", role: "Yalonda's son", visibleWhen: () => true,
      status: (s) => s.people.household.lastQuestionDay === s.run.day ? "Talked today" : "Available",
      summary: (s) => `Warehouse loader and local connector. Trust ${s.npc.juan.trust}.`, actions: ["TALK_HOUSEHOLD"] },
    { id: "mina", name: "Mina Vale", role: "Night Owl clerk", visibleWhen: (s) => s.npc.mina.met,
      status: (s) => s.npc.mina.status, summary: (s) => `Mina remembers the ${s.npc.mina.introChoice || "guarded"} first conversation.`, actions: ["VISIT_MINA"] },
    { id: "dre", name: "Dre Smooth", role: "Lender", visibleWhen: (s) => ["active", "cleared"].includes(s.lender.status),
      status: (s) => s.lender.relationship, summary: (s) => `$${s.lender.balance} remains on the note due Day ${s.lender.dueDay}.`, actions: ["OPEN_FINANCES"] },
    { id: "curtis", name: "Curtis Foyer", role: "Rival", visibleWhen: (s) => s.npc.curtis.relationship !== "unaware",
      status: (s) => s.npc.curtis.relationship, summary: (s) => `Attention ${s.npc.curtis.attention}/8; respect ${s.npc.curtis.respect}.`, actions: [] },
    { id: "simone", name: "Simone Hart", role: "Independent protection organizer", visibleWhen: (s) => s.npc.simone.known,
      status: (s) => s.npc.simone.truce ? "Truce" : s.npc.simone.threat > s.npc.simone.trust ? "Watching" : "Independent",
      summary: (s) => `Trust ${s.npc.simone.trust}; threat ${s.npc.simone.threat}; leverage ${s.npc.simone.leverage}.`, actions: [] },
  ];

  function contactDialogue(person, type) {
    const first = person.name.split(" ")[0];
    const place = person.location === "night_owl" ? "the Night Owl" : "work";
    const lines = {
      call: [
        `${first} answers after two rings and gives you the short version of what is moving around ${place}.`,
        `${first} keeps the call brief. A useful name lands before the line goes quiet.`,
        `${first} picks up with noise behind them and leaves you one detail worth remembering.`,
      ],
      text: [
        `${first} sends a cross street and tells you to keep the message off anybody else's screen.`,
        `${first} replies with three words, then adds the part that makes them useful.`,
        `${first} sends a time, a place, and no explanation until you answer.`,
      ],
      visit: [
        `${first} makes room beside them. The conversation opens after the small talk runs out.`,
        `${first} looks up when you arrive and sets aside what they were doing.`,
        `${first} meets you where the lights stay on and gives the conversation time to breathe.`,
      ],
    };
    return lines[type] || [];
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function awardCurtisExposure(state, id, force = false) {
    const curtis = state.npc?.curtis;
    if (!curtis || curtis.attentionMilestones.includes(id)) return false;
    curtis.attentionMilestones.push(id);
    if (force || !curtis.taxActive || curtis.attention < 5) curtis.attention = clamp(curtis.attention + 1, 0, 8);
    curtis.pressure = curtis.attention;
    return true;
  }
  function refreshCurtisAttention(state) {
    if (!state.hustle || !state.npc?.curtis) return;
    for (const threshold of [10, 25, 50]) if (state.hustle.soldUnits >= threshold) awardCurtisExposure(state, `units_${threshold}`);
    const now = slotNumber(state.run.day, state.run.slot);
    const rollingRevenue = state.hustle.revenueHistory.filter((entry) => slotNumber(entry.day, entry.slot) >= now - 3).reduce((sum, entry) => sum + entry.amount, 0);
    for (const threshold of [600, 1200]) if (rollingRevenue >= threshold) awardCurtisExposure(state, `revenue_${threshold}`);
    if (state.hustle.exposure.conspicuousSpenardSale) awardCurtisExposure(state, "spenard_sale");
    if (state.hustle.exposure.namedNpcReport) awardCurtisExposure(state, "named_report");
    if (state.hustle.exposure.networkEscalation) awardCurtisExposure(state, "network_escalation");
  }
  function recordIllegalSale(state, qty, revenue) {
    state.hustle.soldUnits += Math.max(0, Math.floor(Number(qty) || 0));
    if (state.world.currentNeighborhoodId === "north_star_lot" && (qty >= 5 || revenue >= 200)) state.hustle.exposure.conspicuousSpenardSale = true;
    if (controlledBlockCount(state) > 0 || state.plugs.unlocked.some((id) => id !== "goodie")) state.hustle.exposure.networkEscalation = true;
    refreshCurtisAttention(state);
  }
  function applyCurtisDecision(state, choice) {
    const curtis = state.npc.curtis;
    if (curtis.attention < 4 || curtis.friendship || curtis.taxActive) return false;
    if (choice === "pay_tax") curtis.taxActive = true;
    else if (choice === "friendship") {
      curtis.friendship = "accepted";
      curtis.friendshipDay = state.run.day;
      curtis.protectionUntilDay = state.run.day + 2;
    } else if (choice === "guarded") {
      curtis.friendship = "guarded";
      curtis.respect += 1;
    } else if (choice === "reject") {
      curtis.friendship = "rejected";
      curtis.respect += 2;
      awardCurtisExposure(state, "tax_rejected", true);
    } else return false;
    curtis.relationship = relationshipForRival(curtis);
    return true;
  }
  // Dirty/clean cash is a bookkeeping layer on top of the single pervasive
  // player.cash pool every existing reducer already reads/writes directly.
  // New income that knows its own legitimacy goes through addDirtyCash/
  // addCleanCash, which move cash and the bucket together. Everything else
  // (the ~35 existing call sites that still do `player.cash +=`/`-=`
  // directly) is reconciled lazily: reconcileCash() is called once at the
  // top of every advanceRun tick and folds any cash drift since the last
  // tick into dirtyCash (untracked income defaults to dirty) or drains it
  // out of dirtyCash first, then cleanCash (untracked spending is assumed
  // dirty-first). This keeps `cash === dirtyCash + cleanCash` true without
  // touching a single existing reducer.
  function addDirtyCash(state, amount) {
    const value = Math.max(0, Math.round(Number(amount) || 0));
    if (!value) return;
    state.player.cash += value;
    state.player.dirtyCash += value;
    if (state.hustle) {
      state.hustle.visible = true;
      state.hustle.illegalRevenue = Math.max(0, Number(state.hustle.illegalRevenue) || 0) + value;
      state.hustle.revenueHistory.push({ day: state.run.day, slot: state.run.slot, amount: value });
      state.hustle.revenueHistory = state.hustle.revenueHistory.slice(-24);
      refreshCurtisAttention(state);
    }
  }
  function addCleanCash(state, amount) {
    const value = Math.max(0, Math.round(Number(amount) || 0));
    if (!value) return;
    state.player.cash += value;
    state.player.cleanCash += value;
  }
  function reconcileCash(state) {
    const known = state.player.dirtyCash + state.player.cleanCash;
    const drift = Math.round(state.player.cash - known);
    if (drift > 0) {
      state.player.dirtyCash += drift;
    } else if (drift < 0) {
      let deficit = -drift;
      const fromDirty = Math.min(state.player.dirtyCash, deficit);
      state.player.dirtyCash -= fromDirty;
      deficit -= fromDirty;
      if (deficit > 0) state.player.cleanCash = Math.max(0, state.player.cleanCash - deficit);
      if (fromDirty > FINANCIAL_HEAT_DIRTY_SPEND_THRESHOLD) {
        const added = Math.round((fromDirty - FINANCIAL_HEAT_DIRTY_SPEND_THRESHOLD) * FINANCIAL_HEAT_PER_OVER_THRESHOLD);
        if (added > 0) state.player.financialHeat = clamp(state.player.financialHeat + added, 0, 10);
      }
    }
  }
  // player.cash === player.dirtyCash + player.cleanCash is a core invariant.
  // reconcileCash() is called at the start of every player-facing action (see
  // the copyState call sites below) so any drift from a prior action that
  // used bare `player.cash +=`/`-=` is folded in before the new action reads
  // or mutates the buckets — the invariant never waits for an advanceRun
  // tick. New code should prefer these helpers over manual bucket math.
  function spendCash(state, amount) {
    const value = Math.max(0, Math.round(Number(amount) || 0));
    if (!value || value > state.player.cash) return false;
    state.player.cash -= value;
    const fromDirty = Math.min(state.player.dirtyCash, value);
    state.player.dirtyCash -= fromDirty;
    state.player.cleanCash = Math.max(0, state.player.cleanCash - (value - fromDirty));
    return true;
  }
  function spendDirtyCash(state, amount) {
    const value = Math.max(0, Math.round(Number(amount) || 0));
    if (!value || value > state.player.dirtyCash || value > state.player.cash) return false;
    state.player.cash -= value;
    state.player.dirtyCash -= value;
    return true;
  }
  function spendCleanCash(state, amount) {
    const value = Math.max(0, Math.round(Number(amount) || 0));
    if (!value || value > state.player.cleanCash || value > state.player.cash) return false;
    state.player.cash -= value;
    state.player.cleanCash -= value;
    return true;
  }
  function normalizedAttributes(state) { return { ...ATTRIBUTE_DEFAULTS, ...(state?.player?.attributes || {}) }; }
  function combatRating(state) { const a = normalizedAttributes(state); return clamp(Math.round(a.strength * 0.40 + a.reflexes * 0.35 + a.endurance * 0.25), 1, 5); }
  function charismaRating(state) { const a = normalizedAttributes(state); return clamp(Math.round(a.presence * 0.70 + a.discipline * 0.30), 1, 5); }
  function intelligenceRating(state) { const a = normalizedAttributes(state); return clamp(Math.round(a.insight * 0.70 + a.discipline * 0.30), 1, 5); }
  function derivedRatings(state) { return { combat: combatRating(state), charisma: charismaRating(state), intelligence: intelligenceRating(state) }; }
  // Street Read is the only Set-bearing branch of state, and state reaches the
  // reducer by more than one route: hydrateRun, structuredClone, and - in the
  // autosave-reload path a test pins - a raw JSON.parse with no hydration at
  // all. Normalizing here means every reducer entry point sees real Sets
  // regardless of how the state got there, instead of each hook guarding itself.
  function streetReadIsHydrated(read) {
    return !!read && !!read.categories && Object.values(read.categories).every((value) => value instanceof Set);
  }
  function copyState(state) {
    const copy = typeof structuredClone === "function" ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    if (state && typeof state === "object" && !streetReadIsHydrated(copy.streetRead)) copy.streetRead = deserializeStreetRead(copy.streetRead);
    return copy;
  }
  function slotNumber(day, slot) { return (day - 1) * 4 + slot; }
  function normalizeSeed(seed) {
    const numeric = Number(seed);
    const fallback = 0x9072026;
    return ((Number.isFinite(numeric) ? numeric : fallback) >>> 0) || fallback;
  }
  function stringHash(value) {
    let hash = 2166136261;
    for (const char of String(value || "")) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
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
  function pushConsequence(state, text, tone) {
    state.run.consequenceQueue = state.run.consequenceQueue || [];
    state.run.consequenceQueue.push({ id: `${state.run.day}:${state.run.slot}:${state.run.consequenceQueue.length}:${stringHash(text)}`, text, tone: tone || "" });
    state.run.consequenceQueue = state.run.consequenceQueue.slice(-6);
  }
  function pushPhoneMessage(state, from, text) {
    const item = { id: `${state.run.day}:${state.run.slot}:${stringHash(`${from}:${text}`)}`, from, text, day: state.run.day, slot: state.run.slot, read: false };
    if (state.phone.active) state.phone.inbox.unshift(item);
    else state.phone.heldInbox.push(item);
    return item;
  }
  function resolveJobApplications(state) {
    const now = slotNumber(state.run.day, state.run.slot);
    const waiting = [];
    for (const application of state.jobs.applications) {
      const applied = slotNumber(application.appliedAtDay, application.appliedAtSlot);
      if (now - applied < 2 || !state.phone.active) { waiting.push(application); continue; }
      if (application.jobId !== state.jobs.activeJobId && !state.jobs.offers.includes(application.jobId)) state.jobs.offers.push(application.jobId);
      const job = SPENARD_JOB_BY_ID[application.jobId];
      pushPhoneMessage(state, job.name, `We have an offer for you. Call back when you're ready to commit.`);
      logEntry(state, `${job.name} calls back with an offer. It waits for your answer.`, "good");
    }
    state.jobs.applications = waiting;
  }
  function restorePhoneIfReady(state, previousAbsolute) {
    if (state.phone.reactivateAtSlot == null || slotNumber(state.run.day, state.run.slot) <= Math.max(previousAbsolute, state.phone.reactivateAtSlot)) return false;
    state.phone.active = true;
    state.phone.reactivateAtSlot = null;
    if (state.phone.heldInbox.length) {
      state.phone.inbox = [...state.phone.heldInbox.reverse(), ...state.phone.inbox];
      state.phone.heldInbox = [];
    }
    logEntry(state, "The signal bars return. Held messages fill the screen.", "good");
    resolveJobApplications(state);
    return true;
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
  // Street Read is deliberately invisible. It measures how much of the city a
  // run has actually touched - not how much it has earned - and pays that back
  // as convenience: sharper price copy, a contact who volunteers something, a
  // shop that happens to have the thing you needed. The player is never told
  // any of this exists, which is the point. A visible bar turns variety into a
  // checklist, and a checklist is exactly the grind this replaces.
  //
  // It is scored on breadth first (how many kinds of thing you did) and depth
  // second (how many distinct instances), with a staleness penalty so that
  // front-loading variety on Day 1 and then grinding one loop decays back down.
  // Entirely separate from Street Identity: identity reads WHO you are from a
  // weighted behavior ledger, this reads HOW WELL YOU KNOW THE STREETS from
  // set-membership. They share the nightly tick and nothing else.
  const STREET_READ_CATEGORIES = {
    trading: 3, social: 2, exploration: 3, risk: 1, routine: 4, recovery: 1, income: 1,
  };
  const STREET_READ_TIER_THRESHOLDS = [25, 50, 75];
  const STREET_READ_DEPTH_CAP = 40;
  const STREET_READ_BREADTH_WEIGHT = 60;

  function createStreetRead() {
    return {
      categories: Object.fromEntries(Object.keys(STREET_READ_CATEGORIES).map((key) => [key, new Set()])),
      score: 0, tier: 0, lastVarietyDay: 0, totalLifetimeEntries: 0, intelDay: null,
    };
  }
  function streetReadTier(state) { return state?.streetRead?.tier || 0; }
  // Tier 3 buys exactly one point of slack against any interaction/trust/standing
  // gate. Capped at 1 on purpose: it should feel like knowing the right door, not
  // like skipping a tier of progression.
  function streetReadAccessBonus(state) { return streetReadTier(state) >= 3 ? 1 : 0; }

  function addStreetReadEntry(state, category, key) {
    const read = state?.streetRead;
    if (!read || !key) return false;
    const set = read.categories[category];
    if (!set || set.has(key)) return false;
    set.add(key);
    read.totalLifetimeEntries += 1;
    read.lastVarietyDay = state.run.day;
    return true;
  }

  function recalculateStreetRead(state) {
    const read = state?.streetRead;
    if (!read) return;
    let met = 0, entries = 0;
    for (const [category, threshold] of Object.entries(STREET_READ_CATEGORIES)) {
      const size = read.categories[category]?.size || 0;
      entries += size;
      if (size >= threshold) met += 1;
    }
    const breadth = (met / Object.keys(STREET_READ_CATEGORIES).length) * STREET_READ_BREADTH_WEIGHT;
    const depth = Math.min(entries, STREET_READ_DEPTH_CAP);
    const idle = state.run.day - read.lastVarietyDay;
    const staleness = idle >= 2 ? (idle - 1) * 5 : 0;
    read.score = clamp(Math.round(breadth + depth - staleness), 0, 100);
    read.tier = STREET_READ_TIER_THRESHOLDS.filter((threshold) => read.score >= threshold).length;
  }

  // Sets do not survive JSON. Everything that leaves this module as a string
  // goes through these two, including the autosave in ui.jsx.
  function serializeStreetRead(read) {
    if (!read) return createStreetReadSerialized();
    return { ...read, categories: Object.fromEntries(Object.entries(read.categories).map(([key, value]) => [key, [...value]])) };
  }
  function createStreetReadSerialized() { return serializeStreetRead(createStreetRead()); }
  // Tolerates: a fresh Set-bearing object, a serialized array form, a pre-Street-Read
  // save with no field at all, and the `{}` that a naive JSON.stringify of a Set
  // produces if anything ever bypasses serializeRun().
  function deserializeStreetRead(value) {
    const fresh = createStreetRead();
    if (!value || typeof value !== "object") return fresh;
    for (const key of Object.keys(fresh.categories)) {
      const saved = value.categories ? value.categories[key] : undefined;
      fresh.categories[key] = new Set(Array.isArray(saved) ? saved.filter((entry) => typeof entry === "string") : saved instanceof Set ? [...saved] : []);
    }
    fresh.score = clamp(Math.floor(Number(value.score) || 0), 0, 100);
    fresh.tier = clamp(Math.floor(Number(value.tier) || 0), 0, 3);
    fresh.lastVarietyDay = Math.max(0, Math.floor(Number(value.lastVarietyDay) || 0));
    fresh.totalLifetimeEntries = Math.max(0, Math.floor(Number(value.totalLifetimeEntries) || 0));
    fresh.intelDay = value.intelDay == null ? null : Math.floor(Number(value.intelDay) || 0);
    return fresh;
  }

  // Maps the advanceRun() reason - the one place every slot-consuming action
  // funnels through - onto a routine activity class.
  const STREET_READ_ACTIVITY = {
    BUY: "trade", SELL: "trade", END_MARKET: "trade",
    VISIT_NIGHT_OWL: "social", CONTACT_VISIT: "social", RECRUIT_CREW: "social", ASSIGN_CREW: "social", PROMOTE_LIEUTENANT: "social", PAY_DEBT: "social", RECRUIT_SOLDIER: "social",
    HEAL: "heal", HEAL_AT_BASE: "heal", LAY_LOW: "rest", SLEEP_HOME: "rest",
    WORK_SHIFT: "work", WORK_JOB: "work", SHOPLIFT: "work", BOOST: "work", ASK_BOOST_WINDOW: "social",
    EXPLORE_SPENARD: "explore", WANDER_SPENARD: "explore", VISIT_BASE: "explore", LEASE_GARAGE: "explore", TRAIN_ATTRIBUTE: "explore", BUY_GEAR: "explore", UPGRADE_BASE: "explore",
    GAMBLE: "gamble",
    TRAVEL: "travel", BUS_TRAVEL: "travel", WALK_HOME: "travel",
    ROB: "risk", ROB_DEALER: "risk", TAKEOVER: "risk", ELI_TEST_ROUTE: "risk", CLAIM_BLOCK: "risk",
  };

  // Tier 2 pays out as a contact volunteering something once a day. The line is
  // picked by area, then rotated by day, so a run that stays in one district
  // still hears different voices. Nothing here names a system or a number - it
  // reads as a person telling you a thing they noticed.
  const STREET_READ_INTEL = {
    north_star_lot: [
      "Goodie: Northern Value's been dry all week. Might restock tomorrow.",
      "Mina: Two guys in a gray sedan have been circling since noon.",
      "Goodie: Somebody's been buying up small and paying full. New money, probably.",
      "Mina: Night Owl's had the same car in the lot three nights running.",
      "Eli: Service road behind the garage is clear this week. Nobody's watching it.",
      "Goodie: My guy up north says the good stuff is a week out. Don't overpay before then.",
      "Mina: Patrol changed shift times. They come through later now.",
      "Eli: Rec center lot's been quiet. Quiet usually doesn't last.",
      "Goodie: Somebody asked about you by description, not by name. That's better than the other way.",
    ],
    downtown: [
      "Eli: Saw Curtis's driver parked outside the gear shop.",
      "Pherris: Someone at the bar was buying in bulk last night.",
      "Eli: Cameras on the corner have been dark since the storm. Nobody's fixed them.",
      "Pherris: The club crowd is paying stupid prices this week. They don't know better.",
      "Eli: Curtis's people are short a runner. They're stretched thinner than they look.",
      "Pherris: There's a buyer working the late crowd who pays cash and doesn't haggle.",
      "Eli: Two cruisers sat on Fourth for an hour doing nothing. That's not nothing.",
      "Pherris: My old list still has three numbers that answer. Downtown remembers.",
      "Eli: Somebody got taken off near the parking structure. Word travels fast down here.",
    ],
    airport_industrial: [
      "Eli: Freight office has been busy. Might mean new supply hitting.",
      "Eli: Loading Bay Seven has a guy who doesn't ask questions and doesn't come back.",
      "Pherris: Industrial's paying premium right now because nobody wants to drive out there.",
      "Eli: Service roads flood at the north end. Take the long way if it's been raining.",
      "Goodie: Anything moving through freight is either very clean or very not. No middle.",
      "Eli: Security out there works one gate and pretends the other two don't exist.",
      "Pherris: Curtis doesn't have people past the fence line. That's why it costs what it costs.",
      "Eli: Somebody's been sleeping in the lot by the hangars. Watch your bag.",
      "Goodie: Price out there swings hard. Don't commit your whole roll on one trip.",
    ],
  };

  // Tier 1 pays out as one extra observed detail about a contact you have
  // actually dealt with. Flavor only - it never encodes a number the player
  // could act on directly.
  // Ambient flavor. Purely decorative: the world keeps moving between actions
  // so a menu reads as a corner rather than a form. Keyed by neighborhood and
  // part of day. Nothing here is state, nothing here is a hint, and nothing
  // here writes anything back.
  const { AMBIENT_FLAVOR, ENTITY_REGISTRY, ENTITY_MATCH_ORDER, EVENT_FLAVOR, EVENT_CONTEXT } = require("./src/events/registry.js");

  // The pool for where the player is standing and what part of day it is.
  // Falls back to Spenard so a new neighborhood never renders an empty bar.
  function ambientFlavor(state) {
    const byArea = AMBIENT_FLAVOR[state.world?.currentNeighborhoodId] || AMBIENT_FLAVOR.north_star_lot;
    return byArea[state.run?.slot] || byArea[0] || [];
  }

  const PHONE_INTEL = Object.fromEntries(NEIGHBORHOODS.map((area) => [area.id, SLOTS.map((part) => [
    `${area.name}: ${part.toLowerCase()} foot traffic is starting to settle.`,
    `${area.name}: a bus driver says the next run is on time.`,
    `${area.name}: somebody is asking who has reliable hands today.`,
    `${area.name}: a warm counter is drawing a small crowd.`,
    `${area.name}: road crews left one lane tighter than usual.`,
    `${area.name}: the useful names are moving by text, not flyers.`,
  ])]));
  function phoneIntel(state) {
    const byArea = PHONE_INTEL[state.world?.currentNeighborhoodId] || PHONE_INTEL.north_star_lot;
    return byArea[state.run?.slot] || byArea[0] || [];
  }

  const STREET_READ_FLAVOR = {
    mina: ["She mentioned something about a sedan last time.", "Her shift schedule changed. Might mean something.", "She's been parking around the back lately."],
    eli: ["He's been eyeing the freight routes lately.", "Said something about owing money on that car.", "He counts the exits before he sits down."],
    curtis: ["His driver's been making rounds more often.", "Word is he lost a supplier last week.", "He's been asking who works which corner."],
    dre: ["He's been counting slower. Might be testing patience.", "His phone went off three times during your last talk.", "He wrote something down after you left."],
    goodie: ["He mentioned a new grower up north.", "Seemed jumpy about someone following his supply runs.", "He's been weighing light and hoping nobody checks."],
    pherris: ["She's been working an old list harder than usual.", "Somebody from before called her and she didn't call back.", "She knows which bartender talks."],
    tone: ["He's been sleeping at the garage more nights than not.", "Somebody from his past has been asking around.", "He checks the street twice before he unlocks anything."],
  };

  // Tier 2 shop bonus. Useful, cheap, never load-bearing: the point is that the
  // shelf happens to have the thing you needed, not that the shop got better.
  const STREET_READ_BONUS_STOCK = ["larger_bag", "burner_phone", "medical_kit", "running_shoes"];

  // Tier 2, at most once per calendar day, and only for a run that has actually
  // dealt with people - an unsolicited tip from nobody you know reads as noise.
  function maybeStreetReadIntel(state, random) {
    const read = state.streetRead;
    if (!read || read.tier < 2 || state.run.status !== "playing") return;
    if (read.intelDay === state.run.day) return;
    if (!read.categories.social.size) return;
    const lines = STREET_READ_INTEL[state.world.currentNeighborhoodId];
    if (!lines || !lines.length) return;
    read.intelDay = state.run.day;
    logEntry(state, lines[(state.run.day + random.int(0, lines.length - 1)) % lines.length], "good");
  }

  // Tier 1 surfaces one extra observed detail about a contact the run has
  // actually dealt with. Returns null for everyone else, including at tier 0.
  function streetReadRecall(state, entityKey) {
    const read = state?.streetRead;
    if (!read || read.tier < 1 || !entityKey) return null;
    const lines = STREET_READ_FLAVOR[entityKey];
    if (!lines || !lines.length) return null;
    const known = [...read.categories.social].some((entry) => entry.split(":")[0] === entityKey);
    if (!known) return null;
    return lines[(state.run.day - 1) % lines.length];
  }

  // Tier 2 adds one rotating item to the shelf. Rotation is by day so a run does
  // not see the same bonus every time it walks in.
  function streetReadBonusStock(state) {
    if (streetReadTier(state) < 2) return [];
    const id = STREET_READ_BONUS_STOCK[(state.run.day - 1) % STREET_READ_BONUS_STOCK.length];
    return GEAR_BY_ID[id] ? [id] : [];
  }

  // Four standalone scenes, all outside the authored Dre/Mina/Curtis arcs. Each
  // extra option is the one a person who had been paying attention all week
  // would already have seen: a second exit, a price they have watched hold, a
  // bag put down before it is asked about. Better expected value than the
  // default lines, never strictly dominant - each still costs something.
  const STREET_SMART_CHOICES = {
    courier: {
      label: "Counter with what this lane actually pays",
      effect: { cash: 95, heat: 1, setFlags: { helpedIndustrialCourier: true } },
      preview: "+$95 and +1 Heat. You take a cut instead of the whole case.",
      result: "You get the cuff off, take a number off the route sheet that matches what you have watched this lane pay all week, and leave the rest of it cuffed to him. He counts out the difference himself rather than argue about it. The headlights turn into the far bay and stop there, and whoever is in them decides this is not the night.",
    },
    door_knock: {
      label: "Put the bag down before they get here",
      effect: { heat: -3, setFlags: { movedBagOnIce: true } },
      preview: "−3 Heat. You lose nothing, because there is nothing to find.",
      result: "You have watched them work this row twice this week and you know they take the landing before the stairwell. The bag goes into the utility closet on the half-landing, behind a water heater that belongs to the building rather than to anyone. When the knock comes you open the door with both hands empty and answer three questions about a car you do not own.",
    },
    careful_customer: {
      label: "Step back and clock the second exit",
      effect: { heat: -1, setFlags: { readCarefulCustomer: true } },
      preview: "−1 Heat. No sale, but you leave knowing what he was.",
      result: "You take one step back to where you can see the whole line and the service door behind the coolers at the same time, and you let him ask his question a third time without answering it. Somebody at the far end of the lot straightens up when you move. That is all the confirmation the question needed. You are out the side door before either of them decides what to do about it.",
    },
    sedan_rumor: {
      label: "Change the route and watch who changes with you",
      effect: { heat: -2, setFlags: { readSedanRumor: true } },
      preview: "−2 Heat. Costs you the afternoon, tells you whether it was real.",
      result: "You take the long way twice, at different hours, past two places you would have no reason to be. Nothing follows either time. Whatever the sedan was, it was not for you this week, and knowing that is worth more than the hours it cost to find out.",
    },
  };

  // Event id prefixes map onto the contact the scene is actually about.
  const STREET_READ_EVENT_NPC = { dre: "dre", mina: "mina", eli: "eli", curtis: "curtis", goodie: "goodie", pherris: "pherris", tone: "tone" };

  // Tier 3 adds one practical option to a small set of standalone scenes. Never
  // added to Dre/Mina/Curtis chain beats - those are authored arcs, not a place to
  // reward breadth. The extra choice is appended, so existing choice indices and
  // every test that addresses them by position stay valid at tier 0.
  function withStreetSmartChoice(state, event, descriptor) {
    if (!event || !Array.isArray(event.choices)) return event;
    if (streetReadTier(state) < 3) return event;
    if (descriptor && descriptor.chain) return event;
    const extra = STREET_SMART_CHOICES[event.id];
    if (!extra || event.choices.length < 3) return event;
    return { ...event, choices: [...event.choices, extra] };
  }

  // Every gear item is always on the shelf in this build, so the tier-2 payoff
  // lands as the shop happening to have one useful thing cheap this week rather
  // than as a new row appearing. Same pool, same rotation, existing surface.
  const STREET_READ_SHELF_DISCOUNT = 0.25;
  function streetReadShelfItem(state) {
    const stock = streetReadBonusStock(state);
    return stock.length ? stock[0] : null;
  }
  function gearPrice(state, gearId) {
    const item = GEAR_BY_ID[gearId];
    if (!item) return 0;
    return streetReadShelfItem(state) === gearId ? Math.round(item.cost * (1 - STREET_READ_SHELF_DISCOUNT)) : item.cost;
  }
  // Both of these used to read a visible level. They now read the hidden tier,
  // and the UI only ever sees the resulting number or boolean.
  function treatmentCost(state, baseCost) {
    return streetReadTier(state) >= 3 ? Math.round(baseCost * 0.9) : baseCost;
  }
  function debtGuidanceAvailable(state) { return (state.lender.status === "active" || state.lender.status === "cleared") && streetReadTier(state) >= 3; }
  function gearShopStock(state) {
    return GEAR.map((item) => {
      const price = gearPrice(state, item.id);
      return { ...item, price, discounted: price < item.cost };
    });
  }

  // Story beats are authored arcs and are never reweighted. Only the generic
  // opportunity/threat pool moves, and only at tier 2+.
  function streetReadEventCategory(descriptor) {
    if (descriptor.category) return descriptor.category;
    if (descriptor.chain) return "story";
    if (descriptor.classification === "opportunity") return "opportunity";
    if (descriptor.classification === "threat") return "punishment";
    return "neutral";
  }
  function streetReadWeightMultiplier(state, descriptor) {
    if (streetReadTier(state) < 2) return 1;
    const category = streetReadEventCategory(descriptor);
    if (category === "opportunity") return 1.15;
    if (category === "punishment") return 0.90;
    return 1;
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
      tier: 0, lieutenantStage: "none", lieutenantEffectiveness: 0, operationPolicy: "manual",
      networkActive: false, trucesBrokered: 0,
    }]));
  }

  // Goodie runs a corner rather than a market stall: the same person can be bought
  // from, asked for word, or robbed, and he remembers which one you picked.
  function createPlugState() {
    return {
      unlocked: [],
      records: Object.fromEntries(PLUGS.map((plug) => [plug.id, { standing: 0, lastPurchaseDay: null, introducedNext: false }])),
    };
  }
  function createDealerState() {
    return Object.fromEntries(DEALERS.map((item) => [item.id, {
      known: false, standing: 0, robbedCount: 0, lastRobbedDay: null, lastTradedDay: null,
      lastAskedDay: null, retaliated: false, gone: false, supplyChoked: 0,
    }]));
  }

  function seededShuffle(items, seed, salt) {
    const random = makeRandom(stringHash(`${normalizeSeed(seed)}:${normalizeSeed(salt)}`));
    const out = items.slice();
    for (let index = out.length - 1; index > 0; index -= 1) {
      const swap = random.int(0, index);
      [out[index], out[swap]] = [out[swap], out[index]];
    }
    return out;
  }

  function createContactsState() {
    return Object.fromEntries(Object.keys(SOCIAL_CONTACTS).map((id) => [id, {
      known: !!SOCIAL_CONTACTS[id].startsKnown, relationshipLevel: 0, lastInteraction: null, lastVisitDay: null,
    }]));
  }

  function createNpcState() {
    return {
      yalonda: { trust: 2, romanceStage: 0, rentPaidWeeks: 0, lastRentDay: null, rentMissed: 0, lastEventDay: null },
      juan: { trust: 0, infoShared: [], lastEventDay: null },
      mina: {
        met: false, available: true, trust: 0, arcStage: 0, chainStage: 0,
        introChoice: null, introTone: null, flirtHistory: false, truthTold: false,
        betrayalFlag: false, usedWithoutConsent: false, downplayed: false,
        violenceWitnessed: false, cleanLifeAtRisk: false, status: "distant",
        outcome: null, outcomes: [], recoveryLockedUntilDay: null,
      },
      curtis: {
        name: "Curtis Foyer", attention: 0, pressure: 0, respect: 0,
        relationship: "unaware", warned: false, taxActive: false, friendship: null,
        friendshipDay: null, protectionUntilDay: null, betrayed: false,
        attentionMilestones: [], recentInterference: null,
      },
      dre: {
        known: false, trust: 0, trustTier: 0, missionHistory: [], refusals: 0,
        cleanCompletions: 0, activeMission: null, nextMissionId: null,
        offersDisabled: false, backstoryFragments: [], loansTaken: 0, loansRepaid: 0,
      },
      simone: {
        known: false, trust: 0, threat: 0, pherrisConflict: false,
        leverage: 0, truce: false, outcomes: [],
      },
    };
  }

  function createJobsState(inventory, seed) {
    return {
      discoveryOrder: seededShuffle(STARTER_JOB_IDS, seed, 0x15a907),
      discovered: ["day_labor"], hired: ["day_labor"], activeJobId: null, offers: [], applications: [], discoveryChance: 0.30, lastScheduledShiftDay: null, lastDeliveryDay: null, lastWorked: null,
      records: Object.fromEntries(SPENARD_JOBS.map((job) => [job.id, {
        xp: 0, rank: 0, shifts: 0, lastWorkedDay: null, relationship: 0, contactMet: false,
        coworkersMet: [], currentCoworkerId: null, learnedDetails: [],
      }])),
      nightOwlStash: {
        mode: null, dirtyCash: 0, cleanCash: 0,
        inventory: Object.fromEntries(Object.keys(inventory).map((id) => [id, { qty: 0, avgCost: 0 }])),
      },
    };
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
        premise: "fresh_arrival", openingPending: false, phase: "week_zero", pressureStartedDay: null, checkpointDay: null,
        ending: null, pendingEvent: null, pendingEncounter: null, pendingOperationResult: null, pendingUnlocks: [], consequenceQueue: [], daySummary: null,
        dayEndPending: false, overtimeArmed: false, overtimeUsedDay: null, dailyActions: [],
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
        cash: 0, dirtyCash: 0, cleanCash: 0, financialHeat: 0, health: 100, heat: 0, cargoCapacity: 10,
        energy: MAX_ENERGY,
        stats: { combat: 0, charisma: 0, intelligence: 0 }, inventory,
        gear: { owned: [], equipped: { weapon: null, armor: null, utility: null, tool: null }, consumables: { medical_kit: 0 } },
      },
      inventory: { laptop: false },
      phone: { active: true, billDueDay: 7, daysPastDue: 0, inbox: [], heldInbox: [], reactivateAtSlot: null },
      knowledge: { knows907List: false },
      discovered: { spenardGym: false },
      memberships: { gym: false },
      world: {
        currentNeighborhoodId: "north_star_lot", markets,
        influence: { north_star_lot: 0, downtown: 0, airport_industrial: 0 },
        tradeInfluenceGranted: { north_star_lot: false, downtown: false, airport_industrial: false },
        productAccess: Object.fromEntries(PRODUCTS.map((product) => [product.id, false])),
        transport: { dayPassDay: null, weekPass: false, busRides: 0, downtownKnown: false, industrialRouteKnown: false },
        locations: {
          explorationCount: 0, discoveries: [], gamblingKnown: false, downtownAmbientSeen: [],
          gym: { sessionDay: null, sessionsToday: 0 },
          gambling: { plays: 0, wins: 0, losses: 0, net: 0 },
          discountStore: { name: "Northern Value", suspicion: 0, lastAttemptDay: null },
          employer: { name: "Ship Creek Freight", standing: 0, lastShiftDay: null, keptCommitments: 0, missedCommitments: 0 },
        },
        territories: Object.fromEntries(TERRITORIES.map((territory) => [territory.areaId, {
          owner: "curtis", power: territory.power, capturedDay: null, incomeCollected: 0, attempts: 0,
        }])),
        // Block-level footholds inside a neighborhood, additive to (and independent
        // from) the whole-neighborhood `territories` takeover above. Spenard-only
        // for now; ids are globally unique so downtown_*/airport_industrial_* blocks
        // can be added later with no schema change.
        territoryBlocks: Object.fromEntries(SPENARD_BLOCKS.map((block) => [block.id, {
          owner: "curtis", soldiersAssigned: [], managerId: null, capturedDay: null, incomeCollected: 0, lastRaidDay: null, raidCount: 0,
        }])),
        soldiers: {}, nextSoldierId: 1,
      },
      base: {
        name: "North Star Garage", controlled: false, acquiredDay: null, visiting: false,
        tracks: { security: 0, storage: 0, operations: 0, recovery: 0 },
        storedCash: 0, storedInventory, watched: false, damage: 0, assignedCrew: null,
      },
      lender: {
        name: "Dre Smooth", status: "unoffered", principal: 0, balance: 0, dueDay: null, trust: 0,
        relationship: "unknown", payments: 0, paymentCount: 0, feesAdded: 0,
        paymentHistory: [], penaltyHistory: [], clearedAt: null, missedDays: 0, lastPenaltyDay: 0,
        afterPayoffOffer: "locked",
        collectorTier: 0, collectorsKilled: 0, interestMultiplier: 1.0,
      },
      people: {
        household: { warnings: 0, contrabandFound: 0, dangerBroughtHome: 0, evicted: false, lastQuestionDay: null },
        crew: createCrewState(),
        dealers: createDealerState(),
      },
      npc: createNpcState(),
      obligations: { rentDueDay: 7 },
      plugs: createPlugState(),
      market: { visible: false },
      hustle: {
        visible: false,
        sections: { market: false, boost: false, stickup: false, shark: false },
        illegalRevenue: 0, revenueHistory: [], soldUnits: 0,
        exposure: { conspicuousSpenardSale: false, namedNpcReport: false, networkEscalation: false },
        shark: { visible: false, loans: [], history: [], nextLoanId: 1 },
      },
      jobs: createJobsState(inventory, seed),
      contacts: createContactsState(),
      onboarding: { shiftsWorked: 0, visitedLocations: ["home"], metNpcs: [], dreEligible: false },
      nightOwl: {
        boardViewedDays: [], ambientSeen: [],
        regulars: Object.fromEntries(NIGHT_OWL_REGULARS.map((person) => [person.id, { met: false, relationship: 0, lastTalkDay: null }])),
      },
      nineZeroSevenList: { known: false, tier: "basic", inventory: [], purchases: 0, sales: 0, profit: 0, alerts: { enabled: false, subscriptions: [] } },
      rob: { visible: false },
      boost: {
        visible: false, tier: 0, technique: 0, storeBans: [], fenceStanding: 0,
        dailyHits: {}, crewAssigned: null, merchandise: 0, discoveredWindows: [],
      },
      home: { storedCash: 0, storedInventory: Object.fromEntries(PRODUCTS.map((item) => [item.id, { qty: 0, avgCost: 0 }])), hiddenWeapon: null },
      flags: { featureNotices: {}, unlockCelebrations: { market: false, boost: false, rob: false, gambling: false } },
      encounterLog: { resolved: [], activeFlags: {}, randomKills: 0, randomFights: 0 },
      effects: { rumors: [], modifiers: [] },
      stats: {
        startingNetWorth: -200, bestTrade: 0, largestLoss: 0, highestHeat: 0,
        productsMoved: Object.fromEntries(PRODUCTS.map((item) => [item.id, 0])),
        decisions: 0, pipelineAdvances: 0, marketUpdates: 0, visits: [], majorDecisions: [],
        moneySpent: { debt: 0, base: 0, gear: 0, crew: 0, healing: 0, relationships: 0, events: 0 },
        encounterChoices: { fight: 0, run: 0, talk: 0, pay: 0, other: 0 },
        robbery: { attempts: 0, successes: 0, failures: 0, totalPayout: 0, lastAttemptedDay: null, attempted: false, success: false, payout: 0 },
        takeovers: { attempts: 0, wins: 0, losses: 0, crewLost: 0, income: 0 },
      },
      streetRead: createStreetRead(),
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
    const lastAttemptedDay = old.lastAttemptedDay == null ? (legacyAttempted ? state.run.day : null) : clamp(Math.floor(Number(old.lastAttemptedDay) || 1), 1, Math.max(RUN_DAYS, state.run.checkpointDay || RUN_DAYS));
    return { attempts, successes, failures, totalPayout, lastAttemptedDay, attempted: attempts > 0, success: successes > 0, payout: totalPayout };
  }

  function migrateSave(value) {
    if (!value || typeof value !== "object") return null;
    if (value.version === VERSION) return value;
    if (![3, 4].includes(value.version) || !value.run || !value.world || !value.player) return null;
    const migrated = JSON.parse(JSON.stringify(value));
    const oldHousehold = migrated.people?.household || {};
    const legacyNpc = migrated.npc || {};
    const legacyMina = migrated.people?.mara || migrated.people?.mina || legacyNpc.mara || legacyNpc.mina || {};
    const legacyCurtis = migrated.rival || legacyNpc.rook || legacyNpc.curtis || {};
    migrated.npc = mergeDefaults(createNpcState(), legacyNpc);
    migrated.npc.yalonda.trust = Number(legacyNpc.yalonda?.trust ?? oldHousehold.yalondaTrust ?? 2);
    migrated.npc.mina = mergeDefaults(migrated.npc.mina, legacyMina);
    migrated.npc.mina.cleanLifeAtRisk = !!(legacyMina.cleanLifeAtRisk || legacyMina.jobAtRisk);
    migrated.npc.mina.arcStage = Math.max(Number(legacyMina.arcStage) || 0, Number(legacyMina.chainStage) || 0);
    migrated.npc.mina.chainStage = migrated.npc.mina.arcStage;
    delete migrated.npc.mina.jobAtRisk;
    migrated.npc.curtis = mergeDefaults(migrated.npc.curtis, legacyCurtis);
    migrated.npc.curtis.attention = clamp(Number(legacyCurtis.attention ?? legacyCurtis.pressure) || 0, 0, 8);
    migrated.npc.curtis.pressure = migrated.npc.curtis.attention;
    delete migrated.npc.mara;
    delete migrated.npc.rook;
    migrated.npc.dre.trust = Math.max(Number(legacyNpc.dre?.trust ?? migrated.lender?.trust) || 0, 0);
    migrated.npc.dre.known = !!legacyNpc.dre?.known || !["unoffered", "declined"].includes(migrated.lender?.status);
    if (migrated.lender) migrated.lender.trust = migrated.npc.dre.trust;
    if (migrated.people?.household) {
      delete migrated.people.household.yalondaTrust;
      delete migrated.people.household.johnTrust;
    }
    migrated.people = migrated.people || {};
    const legacyCrew = migrated.people.crew || {};
    migrated.people.crew = migrated.people.crew || {};
    if (!migrated.people.crew.pherris && (legacyCrew.miri || legacyCrew.pherris)) migrated.people.crew.pherris = legacyCrew.miri || legacyCrew.pherris;
    delete migrated.people.crew.miri;
    delete migrated.people.crew.kip;
    delete migrated.people.crew.goodie;
    migrated.people.dealers = migrated.people.dealers || {};
    if (!migrated.people.dealers.goodie && migrated.people.dealers.kip) migrated.people.dealers.goodie = migrated.people.dealers.kip;
    delete migrated.people.dealers.kip;
    delete migrated.people.mara;
    delete migrated.people.mina;
    delete migrated.rival;
    if (migrated.plugs?.records?.kip && !migrated.plugs.records.goodie) migrated.plugs.records.goodie = migrated.plugs.records.kip;
    if (migrated.plugs?.records) delete migrated.plugs.records.kip;
    if (Array.isArray(migrated.plugs?.unlocked)) migrated.plugs.unlocked = migrated.plugs.unlocked.map((id) => id === "kip" ? "goodie" : id);
    migrated.phone = migrated.phone || { active: true, billDueDay: (Number(migrated.run.day) || 1) + 7, daysPastDue: 0, inbox: [], heldInbox: [], reactivateAtSlot: null };
    migrated.knowledge = migrated.knowledge || { knows907List: !!migrated.nineZeroSevenList?.known };
    migrated.discovered = migrated.discovered || { spenardGym: false };
    migrated.memberships = migrated.memberships || { gym: false };
    migrated.obligations = migrated.obligations || { rentDueDay: (Number(migrated.run.day) || 1) + 7 };
    migrated.jobs = migrated.jobs || {};
    migrated.jobs.discovered = [...new Set([...(migrated.jobs.discovered || []), "day_labor"])];
    const eligibleEmployers = [...new Set((migrated.jobs.hired || []).filter((id) => id !== "day_labor" && SPENARD_JOB_BY_ID[id]))];
    migrated.jobs.discovered = [...new Set([...migrated.jobs.discovered, ...eligibleEmployers])];
    const lastWorked = SPENARD_JOB_BY_ID[migrated.jobs.lastWorked] && migrated.jobs.lastWorked !== "day_labor" ? migrated.jobs.lastWorked : null;
    const activeJobId = lastWorked || eligibleEmployers.slice().sort((a, b) => Number(migrated.jobs.records?.[b]?.lastWorkedDay || 0) - Number(migrated.jobs.records?.[a]?.lastWorkedDay || 0))[0] || null;
    migrated.jobs.activeJobId = activeJobId;
    migrated.jobs.hired = ["day_labor", ...(activeJobId ? [activeJobId] : [])];
    migrated.jobs.offers = eligibleEmployers.filter((id) => id !== activeJobId);
    migrated.jobs.applications = Array.isArray(migrated.jobs.applications) ? migrated.jobs.applications : [];
    migrated.run.consequenceQueue = Array.isArray(migrated.run.consequenceQueue) ? migrated.run.consequenceQueue : [];
    const renameStoryId = (id) => typeof id === "string" ? id.replace(/^mara_/, "mina_").replace(/^rook_/, "curtis_").replace(/^kip_/, "goodie_").replace(/^miri_/, "pherris_") : id;
    const renameFlag = (id) => typeof id === "string" ? id.replace(/^mara/, "mina").replace(/^rook/, "curtis").replace(/^kip/, "goodie").replace(/^miri/, "pherris") : id;
    migrated.flags = Object.fromEntries(Object.entries(migrated.flags || {}).map(([id, flag]) => [renameFlag(id), flag]));
    migrated.run.lastChainFired = renameStoryId(migrated.run.lastChainFired);
    if (migrated.run.pendingEvent?.id) migrated.run.pendingEvent.id = renameStoryId(migrated.run.pendingEvent.id);
    if (migrated.run.pendingEncounter?.id) migrated.run.pendingEncounter.id = renameStoryId(migrated.run.pendingEncounter.id);
    migrated.run.recentEvents = (migrated.run.recentEvents || []).map(renameStoryId);
    migrated.run.eventHistory = Object.fromEntries(Object.entries(migrated.run.eventHistory || {}).map(([id, record]) => [renameStoryId(id), record]));
    const rewriteLegacyText = (item) => {
      if (typeof item === "string") return renameStoryId(item).replaceAll("Mara Velez", "Mina Vale").replaceAll("Mara", "Mina").replaceAll("Rook Mercer", "Curtis Foyer").replaceAll("Rook", "Curtis").replaceAll("Kip Sallis", "Goodie").replaceAll("Kip", "Goodie").replaceAll("Miri", "Pherris").replaceAll("Dre Holloway", "Dre Smooth");
      if (Array.isArray(item)) return item.map(rewriteLegacyText);
      if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, field]) => [key, rewriteLegacyText(field)]));
      return item;
    };
    migrated.run.pendingEvent = rewriteLegacyText(migrated.run.pendingEvent);
    migrated.run.pendingEncounter = rewriteLegacyText(migrated.run.pendingEncounter);
    migrated.npc.mina = rewriteLegacyText(migrated.npc.mina);
    migrated.npc.curtis = rewriteLegacyText(migrated.npc.curtis);
    for (const crew of Object.values(migrated.people.crew || {})) if (crew.outcomes) crew.outcomes = rewriteLegacyText(crew.outcomes);
    migrated.log = rewriteLegacyText(migrated.log || []);
    if (migrated.stats?.majorDecisions) migrated.stats.majorDecisions = rewriteLegacyText(migrated.stats.majorDecisions);
    for (const territory of Object.values(migrated.world.territories || {})) if (territory.owner === "rook") territory.owner = "curtis";
    for (const block of Object.values(migrated.world.territoryBlocks || {})) if (block.owner === "rook") block.owner = "curtis";
    migrated.version = VERSION;
    return migrated;
  }

  function hydrateRun(value) {
    value = migrateSave(value);
    if (!value || typeof value !== "object" || value.version !== VERSION || !value.run || !value.world || !value.player) return null;
    const defaults = createRun({ seed: value.run.seed });
    const state = mergeDefaults(defaults, value);
    state.version = VERSION;
    if (value.run.phase === undefined) {
      state.run.phase = "pressure";
      state.run.pressureStartedDay = 1;
      state.run.checkpointDay = RUN_DAYS;
    }
    state.run.phase = state.run.phase === "week_zero" ? "week_zero" : "pressure";
    state.run.checkpointDay = state.run.phase === "pressure" ? Math.max(state.run.day, Number(state.run.checkpointDay) || RUN_DAYS) : null;
    state.run.dailyActions = Array.isArray(state.run.dailyActions) ? state.run.dailyActions.slice(-12) : [];
    state.run.consequenceQueue = Array.isArray(state.run.consequenceQueue) ? state.run.consequenceQueue.slice(-6) : [];
    state.run.pendingUnlocks = Array.isArray(state.run.pendingUnlocks) ? [...new Set(state.run.pendingUnlocks.filter((id) => ["market", "boost", "rob", "gambling"].includes(id)))] : [];
    state.run.dayEndPending = !!state.run.dayEndPending;
    state.run.overtimeArmed = !!state.run.overtimeArmed;
    state.player.energy = clamp(Math.floor(Number(state.player.energy) || 0), 0, MAX_ENERGY);
    if (value.player.energy === undefined) state.player.energy = clamp(MAX_ENERGY - state.run.slot, 0, MAX_ENERGY);
    if (value.lender?.status === undefined) state.lender.status = state.lender.balance > 0 ? "active" : "cleared";
    if (!["unoffered", "active", "declined", "cleared"].includes(state.lender.status)) state.lender.status = state.lender.balance > 0 ? "active" : "cleared";
    if (state.lender.status !== "active") state.lender.balance = Math.max(0, Number(state.lender.balance) || 0);
    if (state.run.pendingEncounter && state.run.pendingEncounter.type === undefined) {
      Object.assign(state.run.pendingEncounter, {
        active: true, type: "authored", phase: Math.max(0, (state.run.pendingEncounter.step || 1) - 1),
        choices: [], npc: null, resolved: false, choicesMade: [], result: null, loot: null, engine: "legacy_authored",
      });
    }
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
    // mergeDefaults cannot carry a Set through, and pre-Street-Read saves have
    // no field here at all. Both cases land on a valid, empty-but-usable object.
    state.streetRead = deserializeStreetRead(value.streetRead);
    state.jobs.discovered = Array.isArray(state.jobs.discovered) ? [...new Set(state.jobs.discovered.filter((id) => SPENARD_JOB_BY_ID[id]))] : [];
    if (!state.jobs.discovered.includes("day_labor")) state.jobs.discovered.unshift("day_labor");
    state.jobs.hired = Array.isArray(state.jobs.hired) ? [...new Set(state.jobs.hired.filter((id) => SPENARD_JOB_BY_ID[id] && state.jobs.discovered.includes(id)))] : [];
    if (!state.jobs.hired.includes("day_labor")) state.jobs.hired.unshift("day_labor");
    state.jobs.activeJobId = state.jobs.activeJobId !== "day_labor" && state.jobs.hired.includes(state.jobs.activeJobId) ? state.jobs.activeJobId : state.jobs.hired.find((id) => id !== "day_labor") || null;
    state.jobs.hired = ["day_labor", ...(state.jobs.activeJobId ? [state.jobs.activeJobId] : [])];
    state.jobs.offers = Array.isArray(state.jobs.offers) ? [...new Set(state.jobs.offers.filter((id) => SPENARD_JOB_BY_ID[id] && id !== "day_labor" && id !== state.jobs.activeJobId && state.jobs.discovered.includes(id)))] : [];
    state.jobs.applications = Array.isArray(state.jobs.applications) ? state.jobs.applications.filter((item) => item && SPENARD_JOB_BY_ID[item.jobId] && state.jobs.discovered.includes(item.jobId) && !state.jobs.hired.includes(item.jobId)) : [];
    const expectedStarterOrder = seededShuffle(STARTER_JOB_IDS, state.run.seed, 0x15a907);
    state.jobs.discoveryOrder = Array.isArray(state.jobs.discoveryOrder) && state.jobs.discoveryOrder.length === STARTER_JOB_IDS.length && STARTER_JOB_IDS.every((id) => state.jobs.discoveryOrder.includes(id)) ? state.jobs.discoveryOrder : expectedStarterOrder;
    state.jobs.discoveryChance = clamp(Number(state.jobs.discoveryChance) || 0.30, 0.30, 0.70);
    // Pre-v1.6 saves carry no lastWorked. A stale or unknown id would offer a
    // shortcut into work the player has not discovered, so it has to be both a
    // real job and one they have found.
    state.jobs.lastWorked = SPENARD_JOB_BY_ID[state.jobs.lastWorked] && state.jobs.discovered.includes(state.jobs.lastWorked) ? state.jobs.lastWorked : null;
    for (const job of SPENARD_JOBS) {
      const record = state.jobs.records[job.id];
      record.xp = Math.max(0, Number(record.xp) || 0);
      record.rank = jobRankForXp(record.xp);
      record.shifts = Math.max(0, Math.floor(Number(record.shifts) || 0));
      record.relationship = Math.max(0, Number(record.relationship) || 0);
      record.contactMet = !!record.contactMet;
      record.coworkersMet = Array.isArray(record.coworkersMet) ? [...new Set(record.coworkersMet.filter((id) => job.coworkers.some((person) => person.id === id)))] : [];
      if (!record.coworkersMet.length && record.contactMet) record.coworkersMet.push(job.coworkers[0].id);
      record.contactMet = record.coworkersMet.length > 0;
      record.currentCoworkerId = job.coworkers.some((person) => person.id === record.currentCoworkerId) ? record.currentCoworkerId : record.coworkersMet.at(-1) || null;
      record.learnedDetails = Array.isArray(record.learnedDetails) ? [...new Set(record.learnedDetails.filter((index) => Number.isInteger(index) && job.details[index]))] : [];
    }
    const stash = state.jobs.nightOwlStash;
    stash.mode = ["cash", "product"].includes(stash.mode) ? stash.mode : null;
    stash.dirtyCash = Math.max(0, Math.floor(Number(stash.dirtyCash) || 0));
    stash.cleanCash = Math.max(0, Math.floor(Number(stash.cleanCash) || 0));
    if (!stash.dirtyCash && !stash.cleanCash && !Object.values(stash.inventory).some((item) => item.qty > 0)) stash.mode = null;
    state.onboarding.shiftsWorked = Math.max(0, Math.floor(Number(state.onboarding.shiftsWorked) || 0));
    state.onboarding.visitedLocations = [...new Set((Array.isArray(state.onboarding.visitedLocations) ? state.onboarding.visitedLocations : []).filter(Boolean))];
    state.onboarding.metNpcs = [...new Set((Array.isArray(state.onboarding.metNpcs) ? state.onboarding.metNpcs : []).filter(Boolean))];
    state.onboarding.dreEligible = !!state.onboarding.dreEligible;
    state.nightOwl.boardViewedDays = [...new Set((Array.isArray(state.nightOwl.boardViewedDays) ? state.nightOwl.boardViewedDays : []).map(Number).filter((day) => day > 0))];
    state.nightOwl.ambientSeen = [...new Set(Array.isArray(state.nightOwl.ambientSeen) ? state.nightOwl.ambientSeen : [])];
    for (const regular of NIGHT_OWL_REGULARS) {
      const record = state.nightOwl.regulars[regular.id];
      record.met = !!record.met;
      record.relationship = Math.max(0, Math.floor(Number(record.relationship) || 0));
    }
    for (const [id, person] of Object.entries(SOCIAL_CONTACTS)) {
      const record = state.contacts[id];
      record.known = !!record.known;
      record.relationshipLevel = Math.max(0, Math.floor(Number(record.relationshipLevel) || 0));
      record.lastInteraction = record.lastInteraction && ["call", "text", "visit"].includes(record.lastInteraction.type) ? record.lastInteraction : null;
      record.lastVisitDay = record.lastVisitDay == null ? null : Math.max(1, Math.floor(Number(record.lastVisitDay) || 1));
      const jobRecord = person.jobId && state.jobs.records[person.jobId];
      if (jobRecord?.coworkersMet.includes(id)) {
        record.known = true;
        if (value.contacts?.[id] === undefined) record.relationshipLevel = Math.max(record.relationshipLevel, Math.floor(jobRecord.relationship || 0));
      }
      const regularRecord = state.nightOwl.regulars[id];
      if (regularRecord?.met) { record.known = true; record.relationshipLevel = Math.max(record.relationshipLevel, regularRecord.relationship); }
      if (id === "mina" && state.npc.mina.met) { record.known = true; record.relationshipLevel = Math.max(record.relationshipLevel, Math.floor(state.npc.mina.trust || 0)); }
    }
    const legacyListings = value.nineZeroSevenList || value.listings || {};
    state.nineZeroSevenList = mergeDefaults(defaults.nineZeroSevenList, legacyListings);
    state.inventory.laptop = !!state.inventory.laptop;
    state.knowledge.knows907List = !!state.knowledge.knows907List || !!state.nineZeroSevenList.known;
    state.nineZeroSevenList.known = state.knowledge.knows907List;
    state.nineZeroSevenList.tier = state.inventory.laptop ? "upgraded" : "basic";
    state.nineZeroSevenList.inventory = (Array.isArray(state.nineZeroSevenList.inventory) ? state.nineZeroSevenList.inventory : []).filter((entry) => LISTING_ITEM_BY_ID[entry.itemId]).slice(0, LISTING_CAPACITY);
    state.nineZeroSevenList.purchases = Math.max(0, Math.floor(Number(state.nineZeroSevenList.purchases) || 0));
    state.nineZeroSevenList.sales = Math.max(0, Math.floor(Number(state.nineZeroSevenList.sales) || 0));
    state.nineZeroSevenList.profit = Math.floor(Number(state.nineZeroSevenList.profit) || 0);
    state.nineZeroSevenList.alerts = { enabled: false, subscriptions: [] };
    state.world.locations.downtownAmbientSeen = [...new Set((Array.isArray(state.world.locations.downtownAmbientSeen) ? state.world.locations.downtownAmbientSeen : []).filter((index) => index === 0 || index === 1))];
    state.flags.featureNotices = state.flags.featureNotices && typeof state.flags.featureNotices === "object" ? state.flags.featureNotices : {};
    state.npc.mina.available = state.npc.mina.available !== false && state.npc.mina.status !== "gone";
    state.npc.mina.cleanLifeAtRisk = !!state.npc.mina.cleanLifeAtRisk;
    state.npc.mina.arcStage = Math.max(Number(state.npc.mina.arcStage) || 0, Number(state.npc.mina.chainStage) || 0);
    state.npc.mina.chainStage = state.npc.mina.arcStage;
    state.npc.curtis.attention = clamp(Number(state.npc.curtis.attention ?? state.npc.curtis.pressure) || 0, 0, 8);
    state.npc.curtis.pressure = state.npc.curtis.attention;
    state.npc.dre.trust = Math.max(Number(state.npc.dre.trust ?? state.lender.trust) || 0, 0);
    state.lender.trust = state.npc.dre.trust;
    // Preserve established v3 runs that already met Goodie while fresh runs keep
    // the market completely absent until the transactional introduction.
    if (value.plugs === undefined && value.people?.dealers?.goodie?.known) {
      state.plugs.records.goodie.standing = Math.max(0, value.people.dealers.goodie.standing || 0);
      unlockPlug(state, "goodie", false);
    }
    state.market.visible = state.plugs.unlocked.length > 0;
    for (const plugId of state.plugs.unlocked) syncPlugProductAccess(state, plugId, false);
    state.boost.storeBans = Array.isArray(state.boost.storeBans) ? [...new Set(state.boost.storeBans.filter((id) => BOOST_TARGET_BY_ID[id]))] : [];
    state.boost.discoveredWindows = Array.isArray(state.boost.discoveredWindows) ? [...new Set(state.boost.discoveredWindows.filter((id) => BOOST_TARGET_BY_ID[id]?.tier === 2))] : [];
    state.boost.dailyHits = state.boost.dailyHits && typeof state.boost.dailyHits === "object" ? state.boost.dailyHits : {};
    updateBoostTier(state);
    state.rob.visible = !!state.rob.visible || state.stats.robbery.successes > 0;
    state.hustle.visible = !!state.hustle.visible || state.player.dirtyCash > 0 || state.stats.robbery.successes > 0;
    state.hustle.sections.market = !!state.market.visible;
    state.hustle.sections.boost = !!state.boost.visible;
    state.hustle.sections.stickup = !!state.rob.visible;
    state.hustle.sections.shark = !!state.hustle.shark.visible;
    state.hustle.revenueHistory = Array.isArray(state.hustle.revenueHistory) ? state.hustle.revenueHistory.slice(-24) : [];
    state.flags.unlockCelebrations = mergeDefaults(defaults.flags.unlockCelebrations, state.flags.unlockCelebrations);
    if (value.flags?.unlockCelebrations === undefined) {
      state.flags.unlockCelebrations.market = !!value.market?.visible || state.market.visible;
      state.flags.unlockCelebrations.boost = !!value.boost?.visible || state.boost.visible;
      state.flags.unlockCelebrations.rob = !!value.rob?.visible || (value.stats?.robbery?.successes || 0) > 0 || state.rob.visible;
      state.flags.unlockCelebrations.gambling = !!value.world?.locations?.gamblingKnown || state.world.locations.gamblingKnown;
      state.run.pendingUnlocks = [];
    }
    // Pre-v1.0 saves have no dirty/clean split. Treat all existing wealth as
    // unlaundered street money: nothing in pre-v1.0 gameplay ever laundered
    // anything, so this is the narratively honest default.
    if (value.player?.dirtyCash === undefined) {
      state.player.dirtyCash = value.player?.cash ?? 0;
      state.player.cleanCash = 0;
    }
    // Curtis's stage progression is now driven by Respect only; pressure no
    // longer advances any stage. A save that already resolved a stage under
    // the old pressure-OR gate keeps that story progress — we do not re-lock
    // content the player already earned — but its Respect is raised to the
    // minimum this stage now requires, so later Respect-gated checks stay
    // internally consistent instead of reading as a contradiction.
    if (state.flags.curtisCutResolved && state.npc.curtis.respect < RESPECT_STAGE_THRESHOLDS.cut) {
      state.npc.curtis.respect = RESPECT_STAGE_THRESHOLDS.cut;
    }
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

  // The autosave path. Anything that writes state to a string must go through
  // here, because state now contains Sets and JSON.stringify silently drops them.
  function serializeRun(state) {
    return JSON.stringify({ ...state, streetRead: serializeStreetRead(state.streetRead) });
  }

  function inspectSave(serialized) {
    if (serialized == null || serialized === "") return { exists: false, valid: false, state: null, error: null, preview: null };
    try {
      const state = hydrateRun(JSON.parse(serialized));
      if (!state) return { exists: true, valid: false, state: null, error: "This save is not a compatible 907Hustle run.", preview: null };
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
  function updateBoostTier(state) {
    if (!state.boost) return 0;
    let unlocked = state.boost.visible ? 1 : 0;
    if (state.boost.technique >= 5) unlocked = 2;
    if (state.boost.technique >= 13 && recruitedCrew(state).some((person) => person.canFieldAssign)) unlocked = 3;
    state.boost.tier = Math.max(state.boost.tier || 0, unlocked);
    return state.boost.tier;
  }
  function boostTier(state) {
    if (!state.boost?.visible) return 0;
    if (state.boost.technique >= 13 && recruitedCrew(state).some((person) => person.canFieldAssign)) return 3;
    if (state.boost.technique >= 5) return 2;
    return 1;
  }
  function visibleBoostTargets(state) {
    if (!state.boost?.visible) return [];
    const tier = Math.max(state.boost.tier || 0, boostTier(state));
    return BOOST_TARGETS.filter((target) => target.areaId === state.world.currentNeighborhoodId && target.tier <= tier);
  }
  function boostFenceRate(standing) {
    const value = clamp(Math.floor(Number(standing) || 0), 0, 5);
    if (value >= 5) return 0.60;
    if (value >= 3) return 0.55;
    return 0.40 + value * 0.05;
  }
  function boostChance(state, target) {
    const a = normalizedAttributes(state);
    const skill = target.tier === 1 ? (a.reflexes + a.insight) / 2
      : target.tier === 2 ? (a.reflexes + a.discipline) / 2
        : (a.discipline + a.presence) / 2;
    const base = target.tier === 1 ? 0.80 : target.tier === 2 ? 0.55 : 0.40;
    const windowBonus = target.tier === 2 && state.run.slot === target.windowSlot ? 0.20 : 0;
    return clamp(base + (skill - 2) * 0.10 + windowBonus, 0.10, 0.95);
  }
  function boostTargetAvailability(state, targetId) {
    const target = BOOST_TARGET_BY_ID[targetId];
    if (!state.boost?.visible || !target || target.areaId !== state.world.currentNeighborhoodId || target.tier > Math.max(state.boost.tier || 0, boostTier(state))) return { available: false, reason: "That target is not available." };
    if (state.boost.storeBans.includes(target.id)) return { available: false, reason: "You are burned at this store for the rest of the run." };
    if (state.boost.dailyHits[target.id] === state.run.day) return { available: false, reason: "Already hit today." };
    if (target.tier === 3) {
      const crew = state.people.crew[state.boost.crewAssigned];
      if (!crew?.recruited || crew.status !== "active" || !CREW_BY_ID[state.boost.crewAssigned]?.canFieldAssign) return { available: false, reason: "Assign active field crew first." };
    }
    return { available: true, reason: "Ready.", chance: boostChance(state, target) };
  }
  function resolveBoostAttempt(state, target, random, options) {
    const chance = boostChance(state, target);
    const roll = Number.isFinite(options?.roll) ? options.roll : random.next();
    const success = roll < chance;
    state.boost.dailyHits[target.id] = state.run.day;
    if (target.tier === 2 && !state.boost.discoveredWindows.includes(target.id)) state.boost.discoveredWindows.push(target.id);
    if (success) {
      const firstSuccess = !state.boost.visible;
      const take = random.int(target.take[0], target.take[1]);
      state.boost.visible = true;
      state.boost.technique += 1;
      state.player.heat = clamp(state.player.heat + (target.tier === 1 ? 0.5 : target.tier === 2 ? 1 : 2), 0, 15);
      if (target.tier === 3) {
        state.boost.merchandise += take;
        const crew = state.people.crew[state.boost.crewAssigned];
        if (crew) crew.loyalty += 1;
        logEntry(state, `${target.name} lands. $${take} in merchandise is waiting for the fence.`, "good");
      } else {
        addDirtyCash(state, take);
        logEntry(state, `You leave ${target.name} with goods worth $${take}.`, "good");
      }
      addStreetReadEntry(state, "risk", `boost:${target.areaId}:${target.id}`);
      recordBehavior(state, "stickup", 1, `boost:${state.run.day}:${target.id}`, "shoplift_pattern");
      updateBoostTier(state);
      if (firstSuccess) queueUnlock(state, "boost");
    } else if (target.tier === 1) {
      state.player.heat = clamp(state.player.heat + 1, 0, 15);
      if (!state.boost.storeBans.includes(target.id)) state.boost.storeBans.push(target.id);
      logEntry(state, "Security grabbed your arm. You dropped it and walked out.", "bad");
    } else if (target.tier === 2) {
      const chaseRoll = Number.isFinite(options?.chaseRoll) ? options.chaseRoll : random.next();
      const escaped = chaseRoll < clamp(0.45 + normalizedAttributes(state).reflexes * 0.08, 0.25, 0.85);
      state.player.heat = clamp(state.player.heat + (escaped ? 1 : 2), 0, 15);
      if (!escaped) {
        if (!state.boost.storeBans.includes(target.id)) state.boost.storeBans.push(target.id);
        if (state.player.heat > 6) state.flags.boostArrestRisk = true;
      }
      logEntry(state, escaped ? "Security gives chase, but you lose them outside." : "Security runs you down. The store has your face now.", escaped ? "warn" : "bad");
    } else {
      state.player.heat = clamp(state.player.heat + 3, 0, 15);
      const crewId = state.boost.crewAssigned;
      const caughtRoll = Number.isFinite(options?.crewCaughtRoll) ? options.crewCaughtRoll : random.next();
      if (crewId && caughtRoll < 0.30) {
        state.people.crew[crewId].status = "arrested";
        state.flags.crewBailPending = crewId;
        state.boost.crewAssigned = null;
      }
      state.boost.merchandise = 0;
      logEntry(state, crewId && state.flags.crewBailPending === crewId ? `${CREW_BY_ID[crewId].name} gets caught. Bail is now your problem.` : "The ring breaks empty-handed and leaves Heat behind.", "bad");
    }
    return { success, chance };
  }
  function crewCapacityFor(state) { return clamp(2 + Math.floor(Number(state.base?.tracks?.operations) || 0), 2, 4); }
  function influenceLabel(value) { return ["Unknown", "Active", "Established", "Contested", "Controlled"][clamp(value, 0, 4)]; }
  function inventoryValue(state) {
    const market = state.world.markets[state.world.currentNeighborhoodId];
    return PRODUCTS.reduce((sum, product) => {
      const carried = state.player.inventory[product.id]?.qty || 0;
      const stored = state.base.storedInventory[product.id]?.qty || 0;
      const hidden = state.home?.storedInventory?.[product.id]?.qty || 0;
      const workplace = state.jobs?.nightOwlStash?.inventory?.[product.id]?.qty || 0;
      return sum + (carried + stored + hidden + workplace) * (market.prices[product.id] || 0);
    }, 0);
  }
  function gearValue(state) { return state.player.gear.owned.reduce((sum, id) => sum + (GEAR_BY_ID[id]?.cost || 0), 0); }
  function baseValue(state) {
    if (!state.base.controlled) return 0;
    return BASE_UPGRADES.filter((item) => state.base.tracks[item.track] >= item.level).reduce((sum, item) => sum + item.cost, 0);
  }
  function workplaceStoredCash(state) { return (state.jobs?.nightOwlStash?.dirtyCash || 0) + (state.jobs?.nightOwlStash?.cleanCash || 0); }
  function netWorth(state) { return state.player.cash + state.base.storedCash + (state.home?.storedCash || 0) + workplaceStoredCash(state) + inventoryValue(state) + listingInventoryValue(state) - state.lender.balance; }
  function workingCapital(state) { return state.player.cash + state.base.storedCash + (state.home?.storedCash || 0) + workplaceStoredCash(state) + inventoryValue(state) + listingInventoryValue(state); }
  function safeDebtPayment(state) { return Math.min(state.lender.balance, Math.max(0, state.player.cash - WORKING_CAPITAL_RESERVE)); }
  function debtPaymentPreview(state, requestedAmount) {
    const maximum = Math.min(state.player.cash, state.lender.balance);
    const amount = clamp(Math.floor(Number(requestedAmount) || 0), 0, maximum);
    return { amount, maximum, cashAfter: state.player.cash - amount, debtAfter: state.lender.balance - amount, breaksReserve: amount > safeDebtPayment(state) };
  }
  const TIME_ACTIONS = new Set([
    "ROB", "ROB_DEALER", "ELI_TEST_ROUTE", "TAKEOVER", "WORK_JOB", "WORK_SHIFT",
    "LEASE_GARAGE", "TRAIN_ATTRIBUTE", "GAMBLE", "SHOPLIFT", "BOOST", "WANDER_SPENARD", "EXPLORE_SPENARD", "BUS_TRAVEL", "WALK_HOME",
    "TRAVEL", "END_MARKET", "SLEEP_HOME", "LAY_LOW", "VISIT_BASE", "HEAL",
    "CLAIM_BLOCK", "MINA_DATE", "DRE_MISSION", "COLLECT_SHARK", "ENFORCE_SHARK", "INVEST_NEIGHBORHOOD",
    "PREPARE_FINAL_PLAN", "APPLY_JOB",
  ]);
  function actionEnergyCost(state, actionType) {
    if (!TIME_ACTIONS.has(actionType)) return 0;
    if (actionType === "WALK_HOME") return 0;
    return state.run.overtimeArmed ? 2 : 1;
  }
  function canSpendEnergy(state, actionType) { return state.player.energy >= actionEnergyCost(state, actionType); }
  function checkpointDay(state) { return state.run.checkpointDay || Infinity; }
  function recordVisitedLocation(state, id) {
    if (!id || state.onboarding.visitedLocations.includes(id)) return false;
    state.onboarding.visitedLocations.push(id);
    updateWeekZeroEligibility(state);
    return true;
  }
  function recordMetNpc(state, id) {
    if (!id || state.onboarding.metNpcs.includes(id)) return false;
    state.onboarding.metNpcs.push(id);
    updateWeekZeroEligibility(state);
    return true;
  }
  function weekZeroProgress(state) {
    const shifts = state.onboarding.shiftsWorked;
    const locations = state.onboarding.visitedLocations.length;
    const npcs = state.onboarding.metNpcs.length;
    return { shifts, locations, npcs, ready: shifts >= 3 && locations >= 4 && npcs >= 2 };
  }
  function updateWeekZeroEligibility(state) {
    state.onboarding.dreEligible = state.run.phase === "week_zero" && weekZeroProgress(state).ready;
    return state.onboarding.dreEligible;
  }
  function queueUnlock(state, id) {
    if (!state.flags.unlockCelebrations || state.flags.unlockCelebrations[id]) return false;
    state.flags.unlockCelebrations[id] = true;
    if (!state.run.pendingUnlocks.includes(id)) state.run.pendingUnlocks.push(id);
    return true;
  }
  function startPressurePhase(state) {
    if (state.run.phase === "pressure") return;
    state.run.phase = "pressure";
    state.run.pressureStartedDay = state.run.day;
    state.run.checkpointDay = state.run.day + PRESSURE_DAYS;
    state.onboarding.dreEligible = false;
  }
  function transitCovered(state) {
    return !!(state.world.transport.weekPass || state.world.transport.dayPassDay === state.run.day);
  }
  function gymSessionDetails(state) {
    const gym = state.world.locations.gym;
    const sessionsToday = gym.sessionDay === state.run.day ? gym.sessionsToday : 0;
    const index = Math.min(3, sessionsToday);
    const sessionCost = [25, 45, 75, 120][index];
    const membershipFee = state.memberships?.gym ? 0 : 30;
    return { cost: sessionCost + membershipFee, sessionCost, membershipFee, progress: [3, 2, 1, 1][index], sessionsToday };
  }
  function resolveDistrictCost(definition, field, state, params) {
    const value = typeof definition[field] === "function" ? definition[field](state, params || {}) : definition[field];
    return Math.max(0, Math.floor(Number(value) || 0));
  }
  function travelAvailability(state, destinationId) {
    const destination = AREA_BY_ID[destinationId];
    const covered = transitCovered(state);
    const cashCost = covered ? 0 : 5;
    const base = { visible: !!destination, available: false, reason: "That route is unavailable.", cashCost, timeCost: 1, healthCost: 0 };
    if (!destination) return base;
    if (destinationId === state.world.currentNeighborhoodId) return { ...base, visible: false, reason: `You are already in ${destination.name}.`, cashCost: 0 };
    if (destinationId === "airport_industrial" && state.run.premise !== "legacy_established" && !state.world.transport.industrialRouteKnown) {
      return { ...base, reason: "Industrial needs a trusted route." };
    }
    if (state.player.cash < cashCost) return { ...base, reason: "Need $5 fare." };
    return { ...base, available: true, reason: covered ? "Your pass covers this ride." : "$5 single ride." };
  }
  function districtActionAvailability(state, actionId, params = {}) {
    const definition = DISTRICT_ACTIONS[actionId];
    const unavailable = { visible: false, available: false, reason: "Action unavailable.", cashCost: 0, timeCost: 0, healthCost: 0 };
    if (!definition || !state?.world) return unavailable;
    if (actionId === "return_spenard") {
      if (state.world.currentNeighborhoodId === HOME_DISTRICT_ID) return unavailable;
      return travelAvailability(state, HOME_DISTRICT_ID);
    }
    const cashCost = resolveDistrictCost(definition, "cashCost", state, params);
    const timeCost = resolveDistrictCost(definition, "timeCost", state, params);
    const healthCost = resolveDistrictCost(definition, "healthCost", state, params);
    const result = { visible: false, available: false, reason: "Unavailable here.", cashCost, timeCost, healthCost };
    const inDistrict = definition.areaId === "*"
      ? state.world.currentNeighborhoodId !== HOME_DISTRICT_ID
      : state.world.currentNeighborhoodId === definition.areaId;
    if (!inDistrict || (definition.visibleWhen && !definition.visibleWhen(state, params))) return result;
    result.visible = true;
    const slots = params.slots || definition.slots || ALL_DAY_SLOTS;
    if (!params.ignoreSlots && !slots.includes(state.run.slot)) {
      result.reason = definition.closedReason || `Available during ${slots.map((slot) => SLOTS[slot]).join(" or ")}.`;
      return result;
    }
    if (state.player.cash < cashCost) {
      result.reason = actionId === "return_spenard" ? "Need $5 fare." : `Need $${cashCost}.`;
      return result;
    }
    if (actionId === "walk_spenard") {
      result.available = true;
      result.reason = "Two parts of day and 3 Health.";
      return result;
    }
    if (actionId === "spenard_gym") {
      const gym = gymSessionDetails(state);
      result.available = true;
      result.reason = gym.sessionsToday ? "Same-day training costs more and gives less progress." : "The first session gives the best progress.";
      return result;
    }
    if (actionId === "spenard_gambling") {
      if (params.stake != null && ![20, 50, 100].includes(Math.floor(params.stake))) {
        result.reason = "Choose a listed stake.";
        return result;
      }
      result.available = true;
      result.reason = "Seeded risk. Reading the room helps without guaranteeing profit.";
      return result;
    }
    result.available = true;
    if (actionId === "explore_spenard") result.reason = state.world.locations.explorationCount ? "Later walks draw from a diminishing discovery pool." : "Your first useful discovery is guaranteed.";
    else if (actionId === "night_owl" || actionId.startsWith("night_owl_")) result.reason = "Open now.";
    else if (actionId === "local_intel") result.reason = "Free local information.";
    else result.reason = timeCost ? `Uses ${timeCost === 1 ? "one part" : `${timeCost} parts`} of day.` : "Available now.";
    return result;
  }
  function aroundActions(state) {
    return Object.values(DISTRICT_ACTIONS)
      .filter((definition) => definition.around)
      .map((definition) => ({ id: definition.id, action: definition.action, order: definition.order || 0, ...districtActionAvailability(state, definition.id) }))
      .filter((entry) => entry.visible)
      .sort((a, b) => a.order - b.order);
  }
  function districtActionIdFor(action) {
    if (action.type === "PAY_PHONE_BILL" && action.surface === "online") return null;
    if (action.type === "WORK_JOB") return `job:${action.jobId}`;
    if (action.type === "WORK_SHIFT") return "job:ship_creek";
    if (action.type === "TRAVEL" && action.neighborhoodId === HOME_DISTRICT_ID) return "return_spenard";
    return DISTRICT_ACTION_BY_TYPE[action.type] || null;
  }
  function districtActionPreflight(state, action) {
    const actionId = districtActionIdFor(action);
    if (!actionId) return true;
    const params = action.type === "GAMBLE" ? { stake: action.stake }
      : action.type === "WORK_JOB" && action.jobId === "night_owl" && state.jobs?.records?.night_owl?.rank >= 1 ? { slots: [2, 3] }
        : {};
    return districtActionAvailability(state, actionId, params).available;
  }
  function listingSlate(state, surface) {
    const access = nineZeroSevenListAccess(state, surface);
    if (!access.available) return [];
    const atHome = surface === "home" && state.world.currentNeighborhoodId === "north_star_lot" && state.inventory.laptop;
    const count = atHome ? 5 : 3;
    const refresh = atHome ? state.run.day : Math.floor((state.run.day - 1) / 2);
    const order = seededShuffle(LISTING_ITEMS, state.run.seed, stringHash(`907list:${refresh}:${atHome ? "home" : "phone"}`));
    return order.slice(0, count);
  }
  function listingInventoryValue(state) {
    return state.nineZeroSevenList.inventory.reduce((sum, entry) => sum + (entry.cost || 0), 0);
  }
  function nightOwlBoardItems(state) {
    const offset = Math.abs((state.run.seed || 1) + state.run.day) % NIGHT_OWL_BOARD.length;
    return [0, 1, 2].map((index) => NIGHT_OWL_BOARD[(offset + index) % NIGHT_OWL_BOARD.length]);
  }
  function nightOwlRegularFor(state) {
    return NIGHT_OWL_REGULARS[Math.abs((state.run.seed || 1) + state.run.day + state.run.slot) % NIGHT_OWL_REGULARS.length];
  }
  function nightOwlAvailability(state) {
    return districtActionAvailability(state, "night_owl");
  }
  function actionSummaryLabel(reason) {
    const labels = {
      WORK_JOB: "Worked a shift", WANDER_SPENARD: "Walked Spenard", VISIT_NIGHT_OWL: "Talked with Mina",
      BUY_COFFEE: "Had coffee at Night Owl", TALK_NIGHT_OWL_REGULAR: "Talked with a Night Owl regular",
      BUY_907LIST: "Bought from 907List", SELL_907LIST: "Sold through 907List", BUS_TRAVEL: "Rode the People Mover",
      WALK_HOME: "Walked home", TRAVEL: "Traveled", TRAIN_ATTRIBUTE: "Trained", GAMBLE: "Played the backroom game",
      SLEEP_HOME: "Rested at home", LAY_LOW: "Laid low", PAY_DEBT: "Paid Dre", END_MARKET: "Finished trading",
      ROB: "Tried a Rob", CONTACT_VISIT: "Visited a contact", BUY_LAPTOP: "Bought a used laptop",
    };
    return labels[reason] || reason.toLowerCase().replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
  }
  function recordDailyAction(state, context) {
    state.run.dailyActions.push({ day: state.run.day, label: context.summary || actionSummaryLabel(context.reason) });
    state.run.dailyActions = state.run.dailyActions.filter((entry) => entry.day === state.run.day).slice(-12);
  }
  function featureAvailability(state) {
    const progressed = state.run.day > 1 || state.run.slot > 0 || state.stats.pipelineAdvances > 0;
    const returning = state.run.day > 1 || state.stats.pipelineAdvances >= 4;
    const someoneIntroduced = state.npc.mina.met || CREW.some((person) => state.people.crew[person.id]?.introduced);
    return {
      market: { available: !!state.market?.visible, hint: state.market?.visible ? "Available now." : "Meet a supplier to unlock the Market." },
      boost: { available: !!state.boost?.visible, hint: state.boost?.visible ? "Available now." : "Hidden until your first clean lift." },
      finances: { available: true, hint: "Available now." },
      help: { available: true, hint: "Available now." },
      travel: { available: true, hint: "Places and local travel are available now." },
      operations: { available: state.base.controlled, hint: `Lease North Star Garage for $${GARAGE_DEPOSIT} to unlock Operations.` },
      people: { available: true, hint: "Yalonda and Juan are available now." },
      recovery: { available: state.player.health < 100 || state.player.heat > 1 || state.flags.recoveryIntroduced || returning, hint: "Take an injury or pick up Heat to unlock Recovery." },
    };
  }
  function activityAvailability(state) {
    const employer = state.world.locations.employer;
    const gym = gymSessionDetails(state);
    const store = state.world.locations.discountStore;
    const explore = districtActionAvailability(state, "explore_spenard");
    const gymAccess = districtActionAvailability(state, "spenard_gym");
    const gamblingAccess = districtActionAvailability(state, "spenard_gambling");
    const downtown = travelAvailability(state, "downtown");
    const industrial = travelAvailability(state, "airport_industrial");
    return {
      work: state.world.currentNeighborhoodId !== HOME_DISTRICT_ID ? { available: false, reason: "Return to Spenard first.", cost: 0 }
        : state.run.slot !== 0 ? { available: false, reason: "Ship Creek hires in the Morning only.", cost: 0 }
        : employer.lastShiftDay === state.run.day ? { available: false, reason: "You already worked today's shift.", cost: 0 }
          : { available: true, reason: "One freight shift builds legitimate standing.", cost: 0 },
      explore: { available: explore.available, reason: explore.visible ? explore.reason : "Return to Spenard first.", cost: 0 },
      busDowntown: { available: downtown.available, reason: downtown.reason, cost: downtown.cashCost },
      industrial: { available: industrial.available, reason: industrial.reason, cost: industrial.cashCost },
      gym: { available: gymAccess.available, reason: gymAccess.visible ? gymAccess.reason : "Return to Spenard to use the gym.", cost: gym.cost, progress: gym.progress, sessionsToday: gym.sessionsToday },
      gambling: state.world.currentNeighborhoodId !== HOME_DISTRICT_ID ? { available: false, reason: "Return to Spenard for the game." }
        : !state.world.locations.gamblingKnown ? { available: false, reason: "Nobody has trusted you with the game's address yet." }
          : { available: gamblingAccess.available, reason: gamblingAccess.reason },
      shoplifting: state.world.currentNeighborhoodId !== HOME_DISTRICT_ID ? { available: false, reason: "Return to Spenard first." }
        : state.boost?.visible ? { available: false, reason: "Use the Boost tab for known targets." }
        : store.lastAttemptDay === state.run.day ? { available: false, reason: "Northern Value is watching for you today." }
          : { available: true, reason: "One attempt per day. Reflexes lead; Insight, Heat, and suspicion matter." },
    };
  }

  function juanWorkIntelKnown(state) {
    return !!state.npc?.juan?.infoShared?.some((key) => typeof key === "string" && key.startsWith("work:"));
  }
  function jobRankForXp(xp) {
    let rank = 0;
    for (const threshold of JOB_RANK_THRESHOLDS) if (xp >= threshold) rank += 1;
    return rank;
  }
  function jobPayRange(state, jobId) {
    const job = SPENARD_JOB_BY_ID[jobId];
    if (!job) return null;
    const rank = state.jobs?.records?.[jobId]?.rank || 0;
    const multiplier = 1 + rank * 0.10;
    return { min: Math.round(job.pay[0] * multiplier), max: Math.round(job.pay[1] * multiplier), multiplier };
  }
  function discoveredJobs(state) {
    const discovered = new Set(state.jobs?.discovered || []);
    return SPENARD_JOBS.filter((job) => discovered.has(job.id));
  }
  function personalContacts(state) {
    return STORY_CONTACTS.filter((person) => person.visibleWhen(state)).map((person) => ({
      id: person.id, name: person.name, role: person.role, status: person.status(state), summary: person.summary(state), actions: person.actions,
    }));
  }
  function householdPresence(state) {
    const roll = stringHash(`household:${state.run.day}:${state.run.slot}`) % 10;
    if (state.run.slot <= 1) return roll < 5 ? "yalonda" : roll < 7 ? "juan" : null;
    return roll < 5 ? "juan" : roll < 7 ? "yalonda" : null;
  }
  function nineZeroSevenListAccess(state, surface = "phone") {
    if (!state.knowledge?.knows907List) return { visible: false, available: false, reason: "The link is still unknown." };
    if (surface === "home") return state.inventory.laptop
      ? { visible: true, available: true, reason: "Five listings refresh daily." }
      : { visible: false, available: false, reason: "A laptop is required at home." };
    return state.phone?.active
      ? { visible: true, available: true, reason: "Three listings refresh every two days." }
      : { visible: true, available: false, reason: "Phone service is off." };
  }
  // The shift the player worked most recently, offered as a shortcut so the
  // repeated daily action does not cost four routing taps. Returns null until
  // they have worked once, so a first run still discovers work the long way.
  function quickShift(state) {
    const jobId = state.jobs?.lastWorked;
    const job = SPENARD_JOB_BY_ID[jobId];
    if (!job || !state.jobs.discovered.includes(jobId)) return null;
    const availability = jobAvailability(state, jobId);
    return { jobId, name: job.name, available: availability.available, reason: availability.reason, pay: jobPayRange(state, jobId) };
  }

  function jobAvailability(state, jobId) {
    const job = SPENARD_JOB_BY_ID[jobId];
    const record = state.jobs?.records?.[jobId];
    if (!job || !record || !state.jobs.discovered.includes(jobId)) return { available: false, reason: "You have not found this work yet." };
    if (!job.dayLabor && state.jobs.activeJobId !== jobId) {
      if (state.jobs.applications.some((item) => item.jobId === jobId)) return { available: false, reason: "Waiting on the callback." };
      if (state.jobs.offers.includes(jobId)) return { available: false, reason: "Accept the offer before taking a shift." };
      return { available: false, reason: "Apply before taking a shift." };
    }
    if (state.run.status !== "playing") return { available: false, reason: "The run is not active." };
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return { available: false, reason: "Resolve the current situation first." };
    const allowedSlots = jobId === "night_owl" && record.rank >= 1 ? [2, 3] : job.slots;
    const districtAccess = districtActionAvailability(state, `job:${jobId}`, { slots: allowedSlots, ignoreSlots: true });
    if (!districtAccess.visible) return { available: false, reason: "Return to Spenard first." };
    if (jobId === "night_owl" && !state.npc.mina.met) return { available: false, reason: "Meet the Night Owl clerk first." };
    if (jobId === "night_owl" && !state.npc.mina.available && state.jobs.activeJobId !== "night_owl") return { available: false, reason: "Mina is not available." };
    if (jobId === "delivery" && !state.world.transport.industrialRouteKnown) return { available: false, reason: "Needs a reliable ride." };
    const timedAccess = districtActionAvailability(state, `job:${jobId}`, { slots: allowedSlots });
    if (!timedAccess.available) {
      const label = allowedSlots.map((slot) => SLOTS[slot]).join(" or ");
      return { available: false, reason: `${job.name} runs ${label} only.` };
    }
    if (job.scheduled && state.jobs.lastScheduledShiftDay === state.run.day) return { available: false, reason: "You already worked a scheduled shift today." };
    if (!job.scheduled && state.jobs.lastDeliveryDay === state.run.day) return { available: false, reason: "You already ran a delivery today." };
    return { available: true, reason: "Choose a shift approach. Uses one part of day." };
  }
  function relationshipLabel(value) {
    if (value >= 8) return "Trusted";
    if (value >= 4) return "Familiar";
    if (value > 0) return "Known";
    return "New";
  }
  function knownWorkplaceContacts(state) {
    return discoveredJobs(state).flatMap((job) => job.coworkers.filter((person) => state.jobs.records[job.id].coworkersMet.includes(person.id)).map((person) => ({
      id: person.id, name: person.name, jobId: job.id, jobName: job.name,
      rank: state.jobs.records[job.id].rank, relationship: state.contacts[person.id]?.relationshipLevel || 0,
      relationshipLabel: relationshipLabel(state.contacts[person.id]?.relationshipLevel || 0),
    })));
  }
  function knownSocialContacts(state) {
    return Object.values(SOCIAL_CONTACTS).filter((person) => state.contacts?.[person.id]?.known).map((person) => ({
      ...person,
      relationshipLevel: state.contacts[person.id].relationshipLevel,
      relationshipLabel: relationshipLabel(state.contacts[person.id].relationshipLevel),
    }));
  }
  function contactAvailability(state, npcId, type) {
    const person = SOCIAL_CONTACTS[npcId];
    const record = state.contacts?.[npcId];
    if (!person || !record?.known) return { available: false, reason: "Meet this person first." };
    if ((type === "call" || type === "text") && !state.phone?.active) return { available: false, reason: "Phone service is off. You can still visit." };
    if (type === "text" && record.relationshipLevel < 1) return { available: false, reason: "Reach Level 1 to text." };
    if (type === "visit" && record.relationshipLevel < 2) return { available: false, reason: "Reach Level 2 to visit." };
    if (type !== "visit") return { available: true, reason: "Free. No time passes." };
    if (state.world.currentNeighborhoodId !== "north_star_lot") return { available: false, reason: "Return to Spenard to visit." };
    if (person.location === "night_owl" && !nightOwlAvailability(state).available) return { available: false, reason: "The Night Owl opens at dusk." };
    const job = person.jobId && SPENARD_JOB_BY_ID[person.jobId];
    if (job && person.location !== "night_owl" && !job.slots.includes(state.run.slot)) return { available: false, reason: `${job.name} is closed right now.` };
    return { available: true, reason: "Free at the current location. No time passes." };
  }
  function contactInteractionEvent(state, npcId, type) {
    const person = SOCIAL_CONTACTS[npcId];
    const lines = contactDialogue(person, type);
    const index = normalizeSeed(state.run.seed ^ stringHash(`${npcId}:${type}:${state.run.day}`)) % lines.length;
    const tipFlag = `contactTip_${npcId}_${type}`;
    let effect = {};
    let preview = "Finish the conversation.";
    if (type === "visit" && !state.world.locations.gamblingKnown && !state.flags[tipFlag]) {
      effect = { discoverGambling: true, setFlags: { [tipFlag]: true } };
      preview = "Keep the after-hours address.";
    } else {
      const hidden = state.jobs.discoveryOrder.find((id) => !state.jobs.discovered.includes(id));
      if (type !== "call" && hidden && !state.flags[tipFlag]) {
        effect = { discoverJobId: hidden, setFlags: { [tipFlag]: true } };
        preview = `Remember the lead on ${SPENARD_JOB_BY_ID[hidden].name}.`;
      }
    }
    return event(`contact_${npcId}_${type}_${state.run.day}`, `${type[0].toUpperCase()}${type.slice(1)} ${person.name}`, lines[index], [
      { label: "Continue", effect, preview, result: `${person.name.split(" ")[0]} leaves the next move with you.` },
    ]);
  }
  function downtownArrivalEvent(state) {
    const order = seededShuffle([0, 1], state.run.seed, 0xd0470a);
    const index = order.find((item) => !state.world.locations.downtownAmbientSeen.includes(item));
    if (index === undefined) return null;
    state.world.locations.downtownAmbientSeen.push(index);
    return event(`downtown_arrival_${index}`, "Downtown", DOWNTOWN_AMBIENT[index], [
      { label: "Keep moving", effect: {}, preview: "Look around, then choose the return trip.", result: "The bus route back to Spenard stays easy to find." },
    ]);
  }
  function nightOwlStashUsed(state) {
    const stash = state.jobs.nightOwlStash;
    return {
      cash: stash.dirtyCash + stash.cleanCash,
      product: Object.values(stash.inventory).reduce((sum, item) => sum + (item.qty || 0), 0),
    };
  }
  function nightOwlStashAvailability(state) {
    const rank = state.jobs?.records?.night_owl?.rank || 0;
    if (rank < 2) return { available: false, reason: "Reach Night Owl Rank 2 first." };
    if (!state.npc.mina.met || !state.npc.mina.available) return { available: false, reason: "Mina is not available." };
    if (state.world.currentNeighborhoodId !== "north_star_lot") return { available: false, reason: "Return to Spenard first." };
    if (!nightOwlAvailability(state).available) return { available: false, reason: "The Night Owl opens at dusk." };
    return { available: true, reason: "Free transfer while the Night Owl is open.", ...nightOwlStashUsed(state) };
  }
  function eligibleHiddenJobs(state, nextWanderCount) {
    const hidden = (id) => !state.jobs.discovered.includes(id);
    return SPENARD_JOBS.filter((job) => {
      if (!hidden(job.id)) return false;
      if (job.starter) return true;
      if (job.id === "night_owl") return state.npc.mina.met || nextWanderCount >= 2;
      if (job.id === "delivery") return nextWanderCount >= 3;
      if (job.id === "ship_creek") return nextWanderCount >= 3 || juanWorkIntelKnown(state);
      return false;
    });
  }
  function discoverJob(state, job) {
    if (!job || state.jobs.discovered.includes(job.id)) return false;
    state.jobs.discovered.push(job.id);
    state.jobs.discoveryChance = 0.30;
    logEntry(state, job.discovery, "good");
    return true;
  }
  function rollJobDiscovery(state, random, previousWanderCount) {
    if (state.run.day === 1 && state.jobs.discovered.some((id) => id !== "day_labor")) {
      logEntry(state, "You catch part of a hiring conversation, but not enough to know who is taking names.", "");
      return false;
    }
    if (previousWanderCount === 0) return discoverJob(state, SPENARD_JOB_BY_ID[state.jobs.discoveryOrder[0]]);
    const candidates = eligibleHiddenJobs(state, previousWanderCount + 1);
    if (!candidates.length) return false;
    const nextStarter = state.jobs.discoveryOrder.find((id) => candidates.some((job) => job.id === id));
    const candidate = nextStarter ? SPENARD_JOB_BY_ID[nextStarter] : random.pick(candidates);
    if (random.next() < state.jobs.discoveryChance) return discoverJob(state, candidate);
    state.jobs.discoveryChance = clamp(state.jobs.discoveryChance + 0.10, 0.30, 0.70);
    logEntry(state, "You catch part of a hiring conversation, but not enough to know who is taking names.", "");
    return false;
  }

  function improveAttribute(state, attribute, progress) {
    if (!["strength", "endurance", "reflexes"].includes(attribute) || state.player.attributes[attribute] >= 5) return false;
    state.player.attributeProgress[attribute] += progress;
    const threshold = ATTRIBUTE_THRESHOLDS[state.player.attributes[attribute]];
    if (state.player.attributeProgress[attribute] < threshold) return false;
    state.player.attributeProgress[attribute] -= threshold;
    state.player.attributes[attribute] += 1;
    state.player.stats = derivedRatings(state);
    logEntry(state, `${attribute[0].toUpperCase()}${attribute.slice(1)} rises to ${state.player.attributes[attribute]}. The work is showing.`, "good");
    return true;
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
    if (state.run.day === checkpointDay(state) && state.run.slot === 3) return { available: false, reason: "There is no part of the run left for the test route." };
    return { available: true, reason: "Uses one part of day.", cost: 35 };
  }
  function minaThreatEligible(state) {
    const relevantHistory = !!(state.npc.mina.introChoice || state.flags.minaFlirted || state.flags.minaFriendlyIntro || state.flags.minaDistantIntro || state.flags.toldMinaAboutGarage || state.stats.moneySpent.relationships > 0);
    return !!(state.flags.minaBoundaryResolved && state.npc.mina.met && state.npc.mina.available !== false && state.npc.mina.status !== "gone" && relevantHistory && state.npc.curtis.pressure >= 4 && !state.flags.minaSedanNightResolved);
  }
  function controlled(state, areaId) { return state.world.territories[areaId]?.owner === "player"; }
  function recruitmentCost(state, crewId) {
    const person = CREW_BY_ID[crewId];
    if (!person) return 0;
    const charismaDiscount = Math.max(0, charismaRating(state) - 1) * 0.05;
    const territoryDiscount = controlled(state, "north_star_lot") ? 0.10 : 0;
    return Math.max(1, Math.round(person.recruitCost * (1 - charismaDiscount - territoryDiscount)));
  }
  function deshawnRecruitmentAvailability(state) {
    if (state.flags.deshawnBusinessSevered) return { available: false, reason: "'It was business' permanently closed this route." };
    if (state.run.day < 5) return { available: false, reason: "Deshawn does not make this call before Day 5." };
    const damaged = (state.people.dealers.goodie?.robbedCount || 0) > 0;
    if (damaged && !(state.flags.goodieRestitution && state.npc.dre.cleanCompletions >= 1)) return { available: false, reason: "Repair things with Goodie and finish one clean Dre mission." };
    const activeContacts = Object.values(state.contacts).filter((record) => record.known && record.relationshipLevel > 0).length;
    if (!damaged && activeContacts < 2) return { available: false, reason: "Build two active contacts first." };
    return { available: true, reason: "Deshawn is ready to hear the offer." };
  }
  function crewTierAvailability(state, crewId) {
    const crew = state.people.crew[crewId];
    const blocks = controlledBlockCount(state);
    if (!crew?.recruited) return { available: false, reason: "Recruit this contact first." };
    if (crewId === "pherris") {
      if (crew.tier < 2) return crew.loyalty >= 3 && blocks >= 1 ? { available: true, tier: 2, cost: 0 } : { available: false, reason: "Tier 2 needs loyalty 3 and one controlled block." };
      if (crew.tier < 3) return crew.loyalty >= 4 && blocks >= 2 && state.player.cash >= 500 ? { available: true, tier: 3, cost: 500 } : { available: false, reason: "Tier 3 needs loyalty 4, two blocks, and $500." };
    }
    if (crewId === "tone") {
      if (crew.tier < 2) return crew.loyalty >= 2 ? { available: true, tier: 2, cost: 0 } : { available: false, reason: "Tier 2 needs loyalty 2." };
      if (crew.tier < 3) return crew.loyalty >= 4 && blocks >= 2 ? { available: true, tier: 3, cost: 0 } : { available: false, reason: "Tier 3 needs loyalty 4 and two blocks." };
    }
    if (crewId === "deshawn") {
      if (crew.tier < 2) return crew.loyalty >= 3 ? { available: true, tier: 2, cost: 0 } : { available: false, reason: "Tier 2 needs loyalty 3." };
      if (crew.tier < 3) return crew.loyalty >= 5 && crew.trucesBrokered >= 2 && blocks >= 2 ? { available: true, tier: 3, cost: 0 } : { available: false, reason: "Tier 3 needs loyalty 5, two truces, and two blocks." };
    }
    return { available: false, reason: "This track is fully developed." };
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
      if (person.id === "tone" && crew.tier >= 2) power += crew.tier === 3 ? 4 : 2;
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
    // Dominant/District Control tiers grant a modest additional trade edge on
    // top of the base controlled-territory bonus, instead of stacking more
    // passive income on top of what Territory Blocks already pay out.
    const tier = districtControlTier(state, areaId);
    const dominanceBonus = tier.label === "Dominant" || tier.label === DISTRICT_CONTROL_LABEL ? DISTRICT_CONTROL_DISCOUNT_BONUS : 0;
    return { buyDiscount: 0.04 + dominanceBonus, sellBonus: 0.04 + dominanceBonus, riskReduction: 1, dailyIncome: territory.dailyIncome, special: territory.special };
  }
  function plugRecord(state, plugId) { return state.plugs?.records?.[plugId] || null; }
  function syncPlugProductAccess(state, plugId, announce) {
    const plug = PLUG_BY_ID[plugId];
    const record = plugRecord(state, plugId);
    if (!plug || !record) return;
    for (const product of plug.products) {
      const wasVisible = !!state.world.productAccess[product.id];
      const visible = product.standing === 0 || record.standing >= product.standing;
      state.world.productAccess[product.id] = visible;
      if (announce && visible && !wasVisible) logEntry(state, `${plug.name} says he can get you ${PRODUCT_BY_ID[product.id].name.toLowerCase()} now too.`, "good");
    }
  }
  function unlockPlug(state, plugId, celebrate = true) {
    const plug = PLUG_BY_ID[plugId];
    if (!plug || state.plugs.unlocked.includes(plugId)) return false;
    state.plugs.unlocked.push(plugId);
    state.market.visible = true;
    if (celebrate) queueUnlock(state, "market");
    syncPlugProductAccess(state, plugId, false);
    if (plugId === "goodie" && state.people.dealers?.goodie) state.people.dealers.goodie.known = true;
    return true;
  }
  function unlockedPlugForProduct(state, productId) {
    for (const plugId of state.plugs?.unlocked || []) {
      const plug = PLUG_BY_ID[plugId];
      const record = plugRecord(state, plugId);
      if (plug?.products.some((product) => product.id === productId && (product.standing === 0 || (record?.standing || 0) >= product.standing))) return plug;
    }
    return null;
  }
  function visibleMarketProducts(state) { return PRODUCTS.filter((product) => !!unlockedPlugForProduct(state, product.id)); }
  function plugMaxUnits(state, productId) {
    const plug = unlockedPlugForProduct(state, productId);
    return plug ? plug.maxUnits : 0;
  }
  function plugPriceModifier(state, productId) {
    const plug = unlockedPlugForProduct(state, productId);
    if (!plug) return 1;
    const standing = plugRecord(state, plug.id)?.standing || 0;
    let discount = plug.id === "goodie" ? (standing >= 3 ? 0.18 : 0.12) : standing >= 4 ? 0.06 : standing >= 2 ? 0.03 : 0;
    if (plug.id === "goodie") discount = Math.min(0.25, discount + (state.npc.mina.trust >= 3 ? 0.08 : state.npc.mina.trust >= 2 ? 0.05 : 0));
    const relationshipDiscount = 1 - discount;
    return plug.priceModifier * relationshipDiscount;
  }
  function tradeUnitPrices(state, productId) {
    const areaId = state.world.currentNeighborhoodId;
    const marketPriceValue = state.world.markets[areaId]?.prices[productId] || 0;
    const control = controlled(state, areaId);
    const buy = Math.round(marketPriceValue * (control ? 0.96 : 1) * plugPriceModifier(state, productId));
    const charismaBonus = Math.max(0, charismaRating(state) - 1) * 0.015;
    const influenceBonus = Math.min(0.02, state.world.influence[areaId] * 0.005);
    const curtisPremium = state.npc.curtis.friendship === "accepted" && state.npc.curtis.protectionUntilDay >= state.run.day ? 0.10 : 0;
    const pherrisPremium = areaId === "downtown" && state.people.crew.pherris?.recruited && state.people.crew.pherris.tier >= 1 ? 0.10 : 0;
    const sell = Math.round(marketPriceValue * (0.96 + charismaBonus + influenceBonus + curtisPremium + pherrisPremium + (control ? 0.04 : 0)));
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
    const plug = mode === "buy" ? unlockedPlugForProduct(state, productId) : null;
    const bulk = plug?.bulkStanding && (plugRecord(state, plug.id)?.standing || 0) >= plug.bulkStanding && qty >= 5;
    const unitPrice = mode === "buy" ? Math.round(prices.buy * (bulk ? 0.94 : 1)) : prices.sell;
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

  // --- Territory blocks, soldiers, lieutenants ------------------------------
  // Block-level footholds inside Spenard. Additive to and independent from the
  // whole-neighborhood `world.territories` takeover above.
  function controlledBlockCount(state) {
    return SPENARD_BLOCKS.reduce((sum, block) => sum + (state.world.territoryBlocks[block.id]?.owner === "player" ? 1 : 0), 0);
  }
  // District Control (player-facing name for the old world.territories
  // takeover system) tracks neighborhood-wide dominance. Where an area has a
  // block layer (Spenard only, today), its tier is driven by how many blocks
  // are held plus a Respect capstone, not by the takeover boolean directly —
  // that keeps it distinct from Territory Blocks instead of just relabeling
  // the same number twice. Areas without a block layer yet fall back to the
  // plain owner boolean from the existing takeover mechanic.
  function districtHasBlockLayer(areaId) { return areaId === "north_star_lot"; }
  function districtBlockCount(state, areaId) { return districtHasBlockLayer(areaId) ? controlledBlockCount(state) : 0; }
  function districtControlTier(state, areaId) {
    if (!districtHasBlockLayer(areaId)) {
      return { label: controlled(state, areaId) ? DISTRICT_CONTROL_LABEL : "Neutral", blocks: 0, capstone: false, hasBlockLayer: false };
    }
    const blocks = districtBlockCount(state, areaId);
    const capstone = blocks >= DISTRICT_CONTROL_CAPSTONE_BLOCKS && state.npc.curtis.respect >= DISTRICT_CONTROL_CAPSTONE_RESPECT;
    if (capstone) return { label: DISTRICT_CONTROL_LABEL, blocks, capstone: true, hasBlockLayer: true };
    const tier = [...DISTRICT_CONTROL_TIERS].reverse().find((item) => blocks >= item.minBlocks) || DISTRICT_CONTROL_TIERS[0];
    return { label: tier.label, blocks, capstone: false, hasBlockLayer: true };
  }
  function eliLieutenantActive(state) { return state.people.crew.eli.recruited && state.people.crew.eli.lieutenantStage === "operations_lieutenant"; }
  function soldierCapacity(state) {
    if (!eliLieutenantActive(state)) return 0;
    return SOLDIER_BASE_CAPACITY + controlledBlockCount(state) * SOLDIER_CAPACITY_PER_BLOCK;
  }
  function activeSoldierCount(state) { return Object.values(state.world.soldiers).filter((item) => item.status === "active").length; }
  function unassignedSoldiers(state) { return Object.values(state.world.soldiers).filter((item) => item.status === "active" && !item.blockId); }
  function blockSoldierCount(state, blockId) { return (state.world.territoryBlocks[blockId]?.soldiersAssigned || []).length; }
  function blockIntelVisible(state) { return !!state.flags.spenardBlocksRevealed; }
  function soldierRecruitAvailability(state) {
    if (state.run.status !== "playing") return { available: false, reason: "The run is not active." };
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return { available: false, reason: "Resolve the current situation first." };
    if (!state.base.controlled) return { available: false, reason: "Control North Star Garage first." };
    if (!eliLieutenantActive(state)) return { available: false, reason: "Eli needs to be running Operations before soldiers make sense." };
    const capacity = soldierCapacity(state), current = activeSoldierCount(state);
    if (current >= capacity) return { available: false, reason: `Soldier capacity is full (${current}/${capacity}). Claim more territory to expand it.`, capacity, current };
    const deshawn = state.people.crew.deshawn;
    const cost = deshawn?.recruited && deshawn.tier >= 2 ? Math.round(SOLDIER_RECRUIT_COST * 0.75) : SOLDIER_RECRUIT_COST;
    if (state.player.cash < cost) return { available: false, reason: `Recruiting a soldier costs $${cost}.`, capacity, current, cost };
    return { available: true, reason: "A soldier can be brought on.", cost, capacity, current };
  }
  function soldierAssignAvailability(state, soldierId, blockId) {
    const soldier = state.world.soldiers[soldierId];
    const block = state.world.territoryBlocks[blockId];
    if (!soldier || soldier.status !== "active") return { available: false, reason: "That soldier is not available." };
    if (soldier.blockId) return { available: false, reason: "That soldier is already assigned." };
    if (!block || block.owner !== "player") return { available: false, reason: "You do not control that block." };
    if (blockSoldierCount(state, blockId) >= SOLDIERS_PER_BLOCK_CAP) return { available: false, reason: `This block already runs ${SOLDIERS_PER_BLOCK_CAP} soldiers.` };
    return { available: true, reason: "The soldier can be posted there." };
  }
  function blockClaimAvailability(state, blockId) {
    const definition = SPENARD_BLOCK_BY_ID[blockId];
    const block = state.world.territoryBlocks[blockId];
    if (!definition || !block) return { available: false, reason: "Unknown block." };
    if (block.owner === "player") return { available: false, reason: "This block is already yours." };
    if (state.run.status !== "playing") return { available: false, reason: "The run is not active." };
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return { available: false, reason: "Resolve the current situation first." };
    if (!state.base.controlled) return { available: false, reason: "Control North Star Garage first." };
    if (!eliLieutenantActive(state)) return { available: false, reason: "Claiming corners needs an active Operations lieutenant." };
    if (unassignedSoldiers(state).length < 1) return { available: false, reason: "All soldiers are already posted. Recruit or free one up first." };
    if (state.player.cash < definition.claimCost) return { available: false, reason: `Claiming this block costs $${definition.claimCost}.`, cost: definition.claimCost };
    return { available: true, reason: "Requires 1 available soldier.", cost: definition.claimCost };
  }
  function eliPromotionAvailability(state) {
    const eli = state.people.crew.eli;
    if (!eli.recruited) return { available: false, reason: "Eli needs to be recruited first." };
    if (eli.lieutenantStage === "operations_lieutenant") return { available: false, reason: "Eli already runs Operations." };
    // Softened by one for a run that has covered enough ground. The player only
    // ever sees the loyalty number that is actually being asked of them.
    const required = Math.max(1, ELI_LIEUTENANT_UNLOCK.minLoyalty - streetReadAccessBonus(state));
    if (eli.loyalty < required) return { available: false, reason: `Eli's loyalty needs to reach ${required}.` };
    return { available: true, reason: "Eli is ready to run Operations." };
  }
  function weeklyIncomeEstimate(state) {
    // The run is only 7 days, so there is no literal rolling week to measure.
    // This is a heuristic projection from territory/soldier income collected
    // so far, scaled to a 7-day equivalent.
    const dayElapsed = Math.max(1, state.run.day);
    const collected = SPENARD_BLOCKS.reduce((sum, block) => sum + (state.world.territoryBlocks[block.id]?.incomeCollected || 0), 0);
    return Math.round((collected / dayElapsed) * RUN_DAYS);
  }
  function robAvailability(state) {
    if (state.run.status !== "playing") return { available: false, reason: "The run is not active." };
    const robbery = normalizeRobberyStats(state.stats.robbery, state);
    if (robbery.lastAttemptedDay === state.run.day) return { available: false, reason: "You already tried a Rob today." };
    if (state.run.day === checkpointDay(state) && state.run.slot === 3) return { available: false, reason: "There is no part of the run left to resolve a score." };
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return { available: false, reason: "Resolve the current situation first." };
    const capital = workingCapital(state);
    if (capital >= WORKING_CAPITAL_RESERVE) return { available: false, reason: `Rob opens when working capital falls below $${WORKING_CAPITAL_RESERVE}.` };
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
    if (state.run.day === checkpointDay(state) && state.run.slot === 3) return blocked("There is no part of the run left for this.");

    const plug = PLUG_BY_ID[id];
    const minaBonus = state.npc.mina.trust >= 3 ? 0.08 : state.npc.mina.trust >= 2 ? 0.05 : 0;
    const discount = Math.min(0.25, (record.standing >= 3 ? 0.18 : 0.12) + minaBonus);
    // An offer you cannot take must not present as available: the button would
    // enable and then do nothing, and an agent would loop on it forever.
    const availableProducts = definition.products.filter((productId) => !!unlockedPlugForProduct(state, productId));
    const cheapest = availableProducts.length ? Math.min(...availableProducts.map((productId) => Math.round(tradeUnitPrices(state, productId).buy * (1 - discount)))) : Infinity;
    const room = cargoCapacity(state) - cargoUsed(state);
    const buy = record.lastTradedDay === state.run.day
      ? { available: false, reason: "You already bought off him today." }
      : room <= 0
        ? { available: false, reason: "You have nothing left to carry it in." }
        : state.player.cash < cheapest
          ? { available: false, reason: "You cannot cover even one unit at his price." }
          : { available: true, reason: `${discount ? `${Math.round(discount * 100)}% under` : "At"} the block price on up to ${plug?.maxUnits || 3} units.`, discount, units: plug?.maxUnits || 3 };
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
    const relationships = Math.max(0, state.npc.mina.trust) * 35 + Math.max(0, state.lender.trust) * 20 + Math.max(0, state.npc.curtis.respect) * 20;
    const access = Object.values(state.world.productAccess).filter(Boolean).length * 45;
    return Math.round(netWorth(state) + baseValue(state) * 0.65 + gearValue(state) * 0.35 + crew + influence + relationships + access);
  }
  function heatBand(heat) {
    if (heat >= 12) return { id: "critical", label: "CRITICAL", tone: "bad" };
    if (heat >= 8) return { id: "high", label: "HIGH", tone: "bad" };
    if (heat >= 4) return { id: "warm", label: "WARM", tone: "warn" };
    return { id: "low", label: "LOW", tone: "" };
  }
  // TODO: when market intelligence ships, move this logic there. Street Read's
  // tier should become an accuracy modifier on that system's output rather than
  // a second, parallel source of price copy.
  //
  // The magnitude hint is deliberately given to exactly one product per market,
  // chosen deterministically from the day and area so it is stable while the
  // player is looking at it. One sharpened line reads as noticing something;
  // four reads as a readout.
  function streetReadMagnitude(price, anchor) {
    const delta = Math.abs(price - anchor) / Math.max(1, anchor);
    if (delta > 0.20) return "way";
    if (delta >= 0.10) return "noticeably";
    return "slightly";
  }
  // Chosen across the full product list rather than the unlocked subset: the
  // market screen prices every product whether or not the player can source it
  // yet, and gating the hint on access made tier 1 silently do nothing for the
  // first days of a run - which is exactly when it is supposed to be noticed.
  function streetReadHintedProduct(state, areaId) {
    let hash = state.run.day * 31;
    for (let index = 0; index < areaId.length; index += 1) hash = (hash * 33 + areaId.charCodeAt(index)) >>> 0;
    return PRODUCTS[hash % PRODUCTS.length].id;
  }
  function priceSignal(state, areaId, productId) {
    const product = PRODUCT_BY_ID[productId], area = AREA_BY_ID[areaId], market = state.world.markets[areaId];
    if (!product || !area || !market) return { id: "normal", label: "—", symbol: "—" };
    const anchor = product.base * (area.bias[productId] || 1), price = market.prices[productId];
    const tier = streetReadTier(state);
    // Tier 1 sharpens one product per market with a magnitude word. Tier 3 keeps
    // that single hint but stops hiding direction on anything else.
    const hint = tier >= 1 && streetReadHintedProduct(state, areaId) === productId ? streetReadMagnitude(price, anchor) : null;
    const decorate = (signal) => {
      const enriched = hint && signal.id !== "normal" ? { ...signal, label: `${signal.label} ${hint.toUpperCase()}`, magnitude: hint } : { ...signal };
      return enriched;
    };
    if (price >= anchor * 1.22) return decorate({ id: "high", label: "HIGH", symbol: "▲" });
    if (price <= anchor * 0.8) return decorate({ id: "low", label: "LOW", symbol: "▼" });
    const history = market.history[productId] || [];
    if (history.length >= 2) {
      const prior = history[history.length - 2];
      if (price > prior * 1.08) return decorate({ id: "up", label: "RISING", symbol: "↗" });
      if (price < prior * 0.92) return decorate({ id: "down", label: "FALLING", symbol: "↘" });
    }
    // Tier 3 reads a drift the standard signal rounds off to STEADY.
    if (tier >= 3 && history.length >= 2) {
      const prior = history[history.length - 2];
      if (price > prior * 1.02) return decorate({ id: "up", label: "RISING", symbol: "↗" });
      if (price < prior * 0.98) return decorate({ id: "down", label: "FALLING", symbol: "↘" });
    }
    return decorate({ id: "normal", label: "STEADY", symbol: "—" });
  }

  function relationshipForLender(lender, day) {
    if (lender.status === "unoffered") return "unknown";
    if (lender.status === "declined") return "offer declined";
    if (lender.balance <= 0) return lender.trust >= 2 ? "helpful" : "businesslike";
    if (day > lender.dueDay + 1) return lender.trust < 0 ? "threatening" : "demanding";
    if (day > lender.dueDay) return "demanding";
    if (lender.trust >= 2) return "patient";
    return "businesslike";
  }
  function dreTrustTier(state) {
    const trust = clamp(Math.floor(Number(state.npc.dre.trust) || 0), 0, 3);
    return ["Stranger", "Reliable", "Earner", "Inner Circle"][trust];
  }
  function dreIntroductionEligible(state) {
    const noLoan = state.lender.status !== "active" || state.lender.balance <= 0;
    const route = state.npc.juan.trust >= 1 || !state.phone.active || state.phone.daysPastDue > 0;
    return state.run.day >= 2 && state.player.cash <= 80 && noLoan && state.lender.status === "unoffered" && route;
  }
  function dreMissionAvailability(state) {
    const dre = state.npc.dre;
    if (!dre.known || dre.trust < 1) return { available: false, reason: "Build a Reliable relationship with Dre first." };
    if (dre.offersDisabled) return { available: false, reason: "Three refusals ended Dre's mission offers for this run." };
    if (dre.activeMission) return { available: false, reason: "Finish or refuse the current mission first." };
    return { available: true, reason: "Dre can put one job in front of you." };
  }
  function sharkUnlocked(state) {
    return state.npc.dre.trust >= 3 && state.npc.dre.cleanCompletions >= 3 && state.npc.dre.loansRepaid >= 2;
  }
  function sharkRiskLabel(state, borrower, amount, term) {
    const amountPressure = amount >= 500 ? 2 : amount >= 250 ? 1 : 0;
    const termRelief = term >= 7 ? 2 : term >= 4 ? 1 : 0;
    const score = borrower.risk + amountPressure - termRelief - Math.floor((normalizedAttributes(state).insight - 1) / 2) - (state.npc.dre.trust >= 3 ? 1 : 0);
    return score <= 0 ? "Low" : score <= 2 ? "Guarded" : score <= 4 ? "High" : "Severe";
  }
  function sharkLoanAvailability(state, borrowerId, amount, term) {
    const borrower = SHARK_BORROWERS.find((item) => item.id === borrowerId);
    const allowedAmounts = [100, 250, 500];
    const limit = borrower?.max || 0;
    if (!sharkUnlocked(state)) return { available: false, reason: "Shark is still locked." };
    if (!borrower || !allowedAmounts.includes(amount) || amount > limit || !SHARK_TERMS[term]) return { available: false, reason: "That borrower cannot take those terms." };
    if (state.hustle.shark.loans.some((loan) => loan.borrowerId === borrowerId && ["active", "defaulted", "extended"].includes(loan.status))) return { available: false, reason: "That borrower already has an open note." };
    if (state.player.cash < amount) return { available: false, reason: "Not enough cash to fund the principal." };
    return { available: true, reason: `${sharkRiskLabel(state, borrower, amount, term)} risk.`, risk: sharkRiskLabel(state, borrower, amount, term) };
  }
  function relationshipForRival(rival) {
    if (rival.pressure <= 0 && rival.respect <= 0) return "unaware";
    if (rival.respect >= 4 && rival.pressure <= 6) return "respectful";
    if (rival.respect >= 2 && rival.pressure <= 4) return "cooperative";
    if (rival.pressure >= 7) return "aggressive";
    if (rival.pressure >= 4) return "competitive";
    return "dismissive";
  }
  function minaStatus(person) {
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
      } else if (person.id === "pherris") {
        if (assignment === "source_cocaine") state.world.productAccess.cocaine = true;
        if (assignment === "source_meth" && state.world.influence.airport_industrial >= 1) state.world.productAccess.meth = true;
        const area = assignment === "source_meth" ? AREA_BY_ID.airport_industrial : AREA_BY_ID.downtown;
        const product = assignment === "source_meth" ? PRODUCT_BY_ID.meth : PRODUCT_BY_ID.cocaine;
        state.effects.rumors.push({ id: `pherris_${state.run.day}_${state.run.slot}`, text: `Pherris says ${product.name} is moving through ${area.name}, but the window will not stay open.`, areaId: area.id, productId: product.id, reliable: true, expiresAt: slotNumber(state.run.day, state.run.slot) + 4 });
        crew.loyalty += 1;
        logEntry(state, "Pherris circles one name on her list and tears the rest of the page away.", "good");
      } else if (person.id === "tone") {
        if (assignment === "guard_base") {
          state.base.watched = false;
          state.npc.curtis.pressure = clamp(state.npc.curtis.pressure - 1, 0, 15);
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

  // Soldiers and the blocks they staff are 1:1 coupled, so income and raid
  // resolution live in one function sharing the tick's single RNG instance
  // rather than two passes. Only acts on crossedDay, matching how territory
  // income/wage accrual already only resolve once per day today.
  // Ranks a controlled, non-full block for a given standing policy — higher
  // is a better fit. "balanced" is handled separately (fewest soldiers
  // first) since it is a relative comparison, not a per-block score.
  function eliPolicyBlockScore(policy, block) {
    if (policy === "maximize_income") return block.earningPotential;
    if (policy === "hold_ground") return block.heatExposure + block.patrolFrequency + block.curtisVisibility;
    if (policy === "stay_quiet") return -(block.heatExposure + block.patrolFrequency);
    return 0;
  }
  // Eli evaluates his standing policy inside the same passive pass that
  // resolves income/raids — no separate clock, no extra player time. This
  // both places newly recruited soldiers and redistributes anyone a lost
  // block returned to the unassigned pool on an earlier tick.
  function resolveEliAutoAssignment(state) {
    const moved = [];
    if (!eliLieutenantActive(state)) return moved;
    const policy = state.people.crew.eli.operationPolicy || "manual";
    if (policy === "manual") return moved;
    const pending = unassignedSoldiers(state);
    if (!pending.length) return moved;
    const controlledBlocks = SPENARD_BLOCKS.filter((block) => state.world.territoryBlocks[block.id].owner === "player");
    if (!controlledBlocks.length) return moved;
    for (const soldier of pending) {
      const candidates = controlledBlocks.filter((block) => state.world.territoryBlocks[block.id].soldiersAssigned.length < SOLDIERS_PER_BLOCK_CAP);
      if (!candidates.length) break;
      const best = policy === "balanced"
        ? candidates.reduce((a, b) => (state.world.territoryBlocks[a.id].soldiersAssigned.length <= state.world.territoryBlocks[b.id].soldiersAssigned.length ? a : b))
        : candidates.reduce((a, b) => (eliPolicyBlockScore(policy, b) > eliPolicyBlockScore(policy, a) ? b : a));
      state.world.soldiers[soldier.id].blockId = best.id;
      state.world.territoryBlocks[best.id].soldiersAssigned.push(soldier.id);
      moved.push(best.name);
    }
    return moved;
  }
  // Passive organization activity is summarized into a single compact report
  // per crossed day instead of one log line per block — a run with six
  // controlled blocks would otherwise flood the feed every night. Block
  // losses are the one exception ("major incidents"): each still gets its
  // own line, since losing a corner is worth reading on its own.
  function resolveSoldierOperations(state, random, crossedDay) {
    if (!crossedDay) return;
    const movedBlocks = resolveEliAutoAssignment(state);
    const eli = state.people.crew.eli;
    const effectivenessDiscount = eli.lieutenantStage === "operations_lieutenant" ? eli.lieutenantEffectiveness * 0.05 : 0;
    let totalIncome = 0;
    let raidedCount = 0;
    let attritionCount = 0;
    const raidedBlockNames = [];
    for (const block of SPENARD_BLOCKS) {
      const record = state.world.territoryBlocks[block.id];
      if (record.owner !== "player") continue;
      record.soldiersAssigned = record.soldiersAssigned.filter((id) => state.world.soldiers[id]?.status === "active");
      const assigned = record.soldiersAssigned;
      if (assigned.length > 0) {
        let blockIncome = 0;
        for (let index = 0; index < assigned.length; index += 1) blockIncome += block.earningPotential * Math.pow(SOLDIER_INCOME_BASE_DIMINISH, index);
        blockIncome = Math.round(blockIncome);
        totalIncome += blockIncome;
        record.incomeCollected += blockIncome;
        const raidChance = clamp(RAID_BASE_CHANCE + state.player.heat * RAID_HEAT_WEIGHT + block.patrolFrequency * RAID_PATROL_WEIGHT - effectivenessDiscount, 0, 0.9);
        if (random.next() < raidChance) {
          const lostId = random.pick(assigned);
          const soldier = state.world.soldiers[lostId];
          soldier.status = "lost";
          soldier.blockId = null;
          record.soldiersAssigned = record.soldiersAssigned.filter((id) => id !== lostId);
          record.lastRaidDay = state.run.day;
          record.raidCount += 1;
          state.player.heat = clamp(state.player.heat + 1, 0, 15);
          state.npc.curtis.pressure = clamp(state.npc.curtis.pressure + 1, 0, 15);
          raidedCount += 1;
          raidedBlockNames.push(block.name);
          if (random.next() < RAID_BLOCK_LOSS_CHANCE) {
            record.owner = "curtis";
            const survivors = record.soldiersAssigned;
            for (const survivorId of survivors) {
              const survivor = state.world.soldiers[survivorId];
              if (survivor) survivor.blockId = null;
            }
            record.soldiersAssigned = [];
            logEntry(state, survivors.length
              ? `Curtis takes ${block.name}. ${survivors.length} of Eli's people make it back to the garage.`
              : `${block.name} slips back under Curtis's people after the raid.`, "bad");
          }
        }
      }
      const attritionChance = Math.max(0, SOLDIER_ATTRITION_BASE_CHANCE - eli.lieutenantEffectiveness * ELI_EFFECTIVENESS_ATTRITION_DISCOUNT);
      for (const id of [...record.soldiersAssigned]) {
        const soldier = state.world.soldiers[id];
        if (!soldier || soldier.status !== "active") continue;
        if (random.next() < attritionChance) {
          soldier.status = "lost";
          soldier.blockId = null;
          record.soldiersAssigned = record.soldiersAssigned.filter((sid) => sid !== id);
          attritionCount += 1;
        }
      }
    }
    if (totalIncome > 0) addDirtyCash(state, totalIncome);
    if (totalIncome > 0 || movedBlocks.length || raidedCount || attritionCount) {
      const parts = [];
      if (totalIncome > 0) parts.push(`+$${totalIncome} territory income`);
      if (movedBlocks.length === 1) parts.push(`1 soldier moved to ${movedBlocks[0]}`);
      else if (movedBlocks.length > 1) parts.push(`${movedBlocks.length} soldiers moved (${movedBlocks.slice(0, 2).join(", ")}${movedBlocks.length > 2 ? "…" : ""})`);
      if (raidedCount) parts.push(`${raidedBlockNames.slice(0, 2).join(", ")}${raidedCount > 2 ? " and others" : ""} drew police attention`);
      if (attritionCount) parts.push(`${attritionCount} soldier${attritionCount === 1 ? "" : "s"} lost to attrition`);
      if (!raidedCount && !attritionCount) parts.push("No casualties");
      logEntry(state, `Eli's report: ${parts.join(" · ")}`, raidedCount || attritionCount ? "warn" : "good");
    }
  }

  function applyPressure(state, context, crossedDay) {
    const area = AREA_BY_ID[state.world.currentNeighborhoodId];
    const pressureActive = state.run.phase === "pressure";
    if (context.reason === "TRAVEL") {
      const riskReduction = territoryBenefits(state, area.id)?.riskReduction || 0;
      state.player.heat = clamp(state.player.heat + Math.max(0, area.risk - 1 - riskReduction), 0, 15);
      if (pressureActive) state.npc.curtis.pressure = clamp(state.npc.curtis.pressure + Math.max(0, area.rival - Math.floor(state.world.influence[area.id] / 2)), 0, 15);
    } else if (context.reason === "LAY_LOW") {
      const baseBonus = state.world.currentNeighborhoodId === "north_star_lot" ? state.base.tracks.security : 0;
      const danger = state.base.watched && state.world.currentNeighborhoodId === "north_star_lot" ? 1 : 0;
      state.player.heat = clamp(state.player.heat - Math.max(1, 2 + baseBonus - danger), 0, 15);
      state.npc.curtis.pressure = clamp(state.npc.curtis.pressure - 1, 0, 15);
    } else if (pressureActive && area.role === "Outer") {
      state.npc.curtis.pressure = clamp(state.npc.curtis.pressure + 1, 0, 15);
    }

    if (crossedDay) {
      let territoryIncome = 0;
      for (const definition of TERRITORIES) {
        if (!controlled(state, definition.areaId)) continue;
        // Once an area has its own Territory Blocks, soldier income already
        // pays out per block (resolveSoldierOperations) — the flat District
        // Control daily income would double-pay the same neighborhood.
        if (districtHasBlockLayer(definition.areaId)) continue;
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
      if (state.run.day >= state.phone.billDueDay) {
        state.phone.daysPastDue += 1;
        if (state.phone.daysPastDue > 2 && state.phone.active) {
          state.phone.active = false;
          pushConsequence(state, "The signal bars vanish. Calls and texts stop leaving.", "bad");
        }
      }
      const rentDue = state.obligations.rentDueDay;
      const currentRentDue = state.run.day >= rentDue ? rentDue + Math.floor((state.run.day - rentDue) / 7) * 7 : rentDue;
      const missedThisDue = state.obligations.lastMissedDueDay === currentRentDue;
      if (state.run.day >= rentDue && !missedThisDue) {
        state.obligations.lastMissedDueDay = currentRentDue;
        if (state.flags.extraRentGraceAvailable) {
          state.flags.extraRentGraceAvailable = false;
          logEntry(state, "Deshawn de-escalates the rent conversation and buys one extra grace intervention this week.", "good");
        } else {
          state.npc.yalonda.rentMissed += 1;
          state.npc.yalonda.trust -= 1;
          logEntry(state, "Yalonda leaves the rent envelope on the kitchen table, still empty.", "bad");
          if (state.npc.yalonda.rentMissed >= 2) householdWarning(state, 1, "Two rent weeks pass unpaid. Yalonda makes the house warning explicit.", false);
        }
      }
      state.player.financialHeat = clamp(state.player.financialHeat - FINANCIAL_HEAT_DECAY_PER_DAY, 0, 10);
      if (state.player.financialHeat >= FINANCIAL_HEAT_FOLD_IN_THRESHOLD) {
        state.player.heat = clamp(state.player.heat + 1, 0, 15);
      }
    }

    if (pressureActive && crossedDay && state.lender.status === "active" && state.lender.balance > 0 && state.run.day > state.lender.dueDay) {
      state.lender.missedDays += 1;
      // Collector tier is layered on top of the existing late-fee formula as a
      // multiplier: tier 0 with no collectors killed is byte-identical to the
      // pre-v1.0 math, so nothing changes for players who never miss enough
      // days to escalate.
      const tierEntry = [...DRE_COLLECTOR_TIERS].reverse().find((item) => state.lender.missedDays >= item.missedDaysAtLeast) || DRE_COLLECTOR_TIERS[0];
      state.lender.collectorTier = tierEntry.tier;
      if (state.lender.lastPenaltyDay !== state.run.day) {
        const fee = Math.round(Math.max(25, Math.round(state.lender.balance * 0.08)) * tierEntry.feeMultiplier * state.lender.interestMultiplier);
        state.lender.balance += fee;
        state.lender.feesAdded += fee;
        state.lender.penaltyHistory.push({ day: state.run.day, slot: state.run.slot, amount: fee });
        state.lender.trust -= 1;
        state.lender.lastPenaltyDay = state.run.day;
        state.player.heat = clamp(state.player.heat + 1, 0, 15);
        logEntry(state, `Dre leaves the new total under the Mini-Mart wiper: $${state.lender.balance}. No greeting.`, "bad");
      }
    }
    // Fresh-arrival runs set dueDay === RUN_DAYS, so `day > dueDay` can never
    // become true inside a seven-day run and missedDays/collectorTier would
    // stay 0 forever — the Day 7 deadline itself never produces a consequence.
    // Reaching that boundary with debt still owed is the first enforcement
    // trigger for this run length; severity scales with how much is unpaid.
    if (pressureActive && crossedDay && state.lender.status === "active" && state.lender.balance > 0 && state.run.day >= checkpointDay(state) && state.lender.collectorTier < 1) {
      const owedRatio = state.lender.principal > 0 ? state.lender.balance / state.lender.principal : 1;
      state.lender.collectorTier = owedRatio >= 0.9 ? 2 : 1;
      logEntry(state, "Dre's patience runs out with the note still open. Somebody is coming to collect in person.", "bad");
    }
    state.npc.curtis.pressure = state.npc.curtis.attention;
    state.lender.relationship = relationshipForLender(state.lender, state.run.day);
    state.npc.curtis.relationship = relationshipForRival(state.npc.curtis);
    state.npc.mina.status = minaStatus(state.npc.mina);
    state.stats.highestHeat = Math.max(state.stats.highestHeat, state.player.heat);
  }

  // Popup copy is two layers. The `description` a modal shows collapsed stays
  // under 40 words and carries the mechanical stakes; the cut lore lives in
  // EVENT_FLAVOR (situational backstory, surfaced by the "More" toggle) and in
  // ENTITY_REGISTRY (per-character and per-location recall, surfaced by tapping
  // the name where it appears in the collapsed text).
  //
  // `aliases` are matched longest-first with word boundaries, so "Curtis Foyer"
  // wins over "Curtis" and a name inside another word never matches.

  // Situational backstory cut from each collapsed description. Rendered behind
  // the "More" toggle. Events with several description variants pass their own
  // flavor positionally instead of reading this table.

  function effectPreview(effect) {
    const parts = [];
    if (effect.cash) parts.push(`${effect.cash > 0 ? "+" : "−"}$${Math.abs(effect.cash)} cash`);
    if (effect.health) parts.push(`${effect.health > 0 ? "+" : "−"}${Math.abs(effect.health)} Health`);
    if (effect.heat) parts.push(`${effect.heat > 0 ? "+" : "−"}${Math.abs(effect.heat)} Heat`);
    if (effect.minaTrust) parts.push(`${effect.minaTrust > 0 ? "+" : "−"}${Math.abs(effect.minaTrust)} Mina trust`);
    if (effect.lenderTrust) parts.push(`${effect.lenderTrust > 0 ? "+" : "−"}${Math.abs(effect.lenderTrust)} Dre trust`);
    if (effect.rivalPressure) parts.push(`${effect.rivalPressure > 0 ? "+" : "−"}${Math.abs(effect.rivalPressure)} Curtis pressure`);
    if (effect.rivalRespect) parts.push(`${effect.rivalRespect > 0 ? "+" : "−"}${Math.abs(effect.rivalRespect)} Curtis respect`);
    if (effect.loseRandomInventory) parts.push(`risk ${effect.loseRandomInventory} cargo`);
    if (effect.secondLoan) parts.push("take $1,200 cash and owe $1,380 within five days or by the checkpoint");
    if (effect.access) parts.push(`unlock ${effect.access} access`);
    if (effect.introduceCrew) parts.push("opens a future recruitment option");
    return parts.length ? parts.join(" · ") : "Relationship and story consequences carry forward.";
  }
  // `flavor` is the optional expanded layer. Events with one fixed description
  // read it from EVENT_FLAVOR; events that branch their description pass the
  // matching variant here so the two layers stay in step.
  function event(id, title, description, choices, flavor) {
    const context = EVENT_CONTEXT[id] || { who: "People in the current situation", where: AREA_BY_ID.north_star_lot.name, stakes: "The result changes this run." };
    return { id, title, ...context, description, flavor: flavor || EVENT_FLAVOR[id] || null, choices: choices.map((choice) => ({ ...choice, preview: choice.preview || effectPreview(choice.effect || {}) })) };
  }
  function setPendingEvent(state, item) { state.run.pendingEvent = item; }
  function activeEvent(id, state) {
    const events = {
      mina_intro: () => event("mina_intro", "First Coffee", "The Night Owl clerk slides a paper cup toward you. \"Black or cream?\" Her name tag says Mina. Set the tone of this first conversation.", [
        { label: "Friendly honesty", effect: { minaTrust: 1, setFlags: { minaFriendlyIntro: true, minaIntroChoice: "friendly" } }, preview: "Tell her you just arrived and keep the first exchange warm.", result: "You tell her Alaska is the restart, not the victory lap. Mina listens without trying to turn it into advice. She marks the coffee down as a refill and points out which bus still runs after closing. When the next customer enters, she gives you a small nod that says the conversation can continue another night." },
        { label: "Light flirtation", effect: { minaTrust: 1, setFlags: { minaFlirted: true, minaIntroChoice: "flirt" } }, preview: "Let the mutual interest show while respecting the counter between you.", result: "You ask whether every new customer gets this much attention. Mina looks at the cup, then back at you. \"Only the ones reading the machine like a legal document.\" The smile stays brief and professional, but it is real. She tells you her name even though the tag already did." },
        { label: "Brief and guarded", effect: { setFlags: { minaDistantIntro: true, minaIntroChoice: "distant" } }, preview: "Keep your history private and the exchange surface-level.", result: "You choose black, pay, and offer only your street name. Mina does not press. She gives you the correct change and a neutral goodnight, then returns to the register book. You leave as a stranger she noticed, not a story she already knows." },
      ]),
      eli_offer: () => event("eli_offer", "The Impound Notice", "Eli Ward wants work outside North Star Garage. He knows the loading yards, the service roads, and which gates chain up at what hour. He can move a small package without bringing a tail home.", [
        { label: "Hear him out", effect: { introduceCrew: "eli", setCrewStage: { id: "eli", stage: "test_available" }, crewLoyalty: { id: "eli", delta: 1 } }, preview: "Unlocks Give Eli a Test Route in People.", result: "He flattens the impound notice on the hood and draws the route on the back of it, naming each turn as he goes. He wants thirty-five for fuel and one chance to prove it. He does not ask what would be in the package, which is either professional or well practiced." },
        { label: "Ask about the service roads", effect: { introduceCrew: "eli", setCrewStage: { id: "eli", stage: "followup_required" }, addRumor: { areaId: "airport_industrial", productId: "shrooms", text: "Eli says construction has pushed patrol traffic away from the east industrial service road for a few hours." } }, preview: "Adds a short-lived Industrial Service Roads clue. Recruitment waits for a follow-up.", result: "He circles the east service road twice and explains that construction has pushed patrol traffic off it, but only until the crews finish, which is days and not weeks. He leaves the notice with you so you know where to find him, and asks for nothing in return." },
        { label: "Turn him away", effect: { introduceCrew: "eli", setCrewStage: { id: "eli", stage: "rejected" }, crewLoyalty: { id: "eli", delta: -1 }, setFlags: { refusedEli: true } }, preview: "Eli leaves. A later scene remembers the rejection.", result: "He folds the notice back into the same worn crease and puts it away. \"I know which doors close.\" There is no argument anywhere in it. He walks off toward the service road with his hands in his pockets and does not look back at the garage once." },
      ]),
      eli_callback: () => event("eli_callback", "Eli Comes Back With a Route", "Eli makes the same offer at the same price. Another driver has been asking around about your routes. He says he is finished asking after tonight. Open the door or close it.", [
        { label: "Offer the test route", effect: { setCrewStage: { id: "eli", stage: "test_available" }, crewLoyalty: { id: "eli", delta: 1 }, setFlags: { eliRejectionReopened: true } }, preview: "Unlocks Give Eli a Test Route in People.", result: "He accepts without thanking you, which somehow lands better than gratitude would have. The route and its risks are waiting in People by the time he is back in his vehicle. He does not mention the last conversation, and neither do you." },
        { label: "Tell him it is still no", effect: { setFlags: { eliRejectedFinally: true } }, preview: "Eli stays outside this operation for the rest of the week.", result: "He nods once, the way somebody nods when they have already worked out the answer and only wanted it confirmed out loud. He leaves. The next route rumor that reaches you comes through somebody who charges for it and gets half the detail wrong." },
      ]),
      pherris_offer: () => event("pherris_offer", "The List in Pherris's Pocket", "Pherris Cole puts one torn page on the table. Half the names are crossed out. The rest still pick up. She keeps her hand flat on the paper. Decide what supplier access is worth.", [
        { label: "Offer her a share of the take", effect: { introduceCrew: "pherris", crewLoyalty: { id: "pherris", delta: 2 }, setFlags: { gavePherrisOwnership: true } }, preview: "Opens a future recruitment option on her terms rather than yours.", result: "She leaves her hand where it is a second longer, then slides the page across and starts talking in terms of we, which she has not done once until now. She names two people on the list she will not introduce yet, and tells you exactly why not." },
        { label: "Ask to buy the list", effect: { introduceCrew: "pherris", crewLoyalty: { id: "pherris", delta: -1 } }, preview: "Opens a future recruitment option, colder than it could have been.", result: "She laughs without any part of her face joining in, and folds the page back into quarters. \"You want the names without the person who knows them.\" The page goes into her pocket. She still finishes the drink, and she still pays for it." },
      ]),
      tone_offer: () => event("tone_offer", "Tone at the Garage Door", "Anton Bell points out a sedan parked in the one spot your camera misses, and says how long it has sat there. Curtis's people cost him his last job. He wants a wage to guard the garage.", [
        { label: "Offer protection work", effect: { introduceCrew: "tone", crewLoyalty: { id: "tone", delta: 1 } }, preview: "Opens a future recruitment option and another wage against Curtis.", result: "He checks the doorframe, then the hinge side, then the lock, in that order, before he asks what the work pays. \"Two things. I don't start anything, and you tell me when something's already started.\" He waits on the second one specifically." },
        { label: "Say the garage is handled", effect: { introduceCrew: "tone", crewLoyalty: { id: "tone", delta: -1 } }, preview: "Tone stays available later, with less patience for the offer.", result: "He looks at the lock, then at you, and does not say the obvious thing about either. \"All right.\" He walks back toward the street past the sedan without changing his pace, and the sedan is still in the same spot in the morning." },
      ]),
      tone_jacksonville: () => event("tone_jacksonville", "Jacksonville Calls Collect", "A Jacksonville number reaches Tone after midnight. The people behind it know his old name and your two strongest blocks. Protection, separation, or leverage all leave a mark.", [
        { label: "Protect Tone", effect: { heat: 2, crewLoyalty: { id: "tone", delta: 2 }, setFlags: { toneJacksonvilleProtected: true } }, preview: "+2 Heat and +2 Tone loyalty. Keep him inside the operation.", result: "You put the garage and the blocks behind Tone. Jacksonville hears the boundary in the next call." },
        { label: "Cut Tone loose", effect: { crewLoyalty: { id: "tone", delta: -4 }, setFlags: { toneJacksonvilleCutLoose: true } }, preview: "Remove the immediate threat and break Tone's loyalty.", result: "Tone leaves the key on the workbench. The call stops reaching your phone." },
        { label: "Use the call as leverage", effect: { rivalRespect: 1, setFlags: { toneJacksonvilleLeverage: true } }, preview: "Gain leverage with Curtis; Tone remembers being used.", result: "Curtis gets the number and a reason to care. Tone gets proof that protection has conditions." },
      ]),
      mina_shift_change: () => event("mina_shift_change", "Twenty Minutes Past Close", "Mina counts the till and hands you a lead: Ship Creek freight is hiring dispatch. Then she asks what people call you, and waits like the answer matters. Give her a name or keep it.", [
        { label: "Tell her what the week looks like", effect: { minaTrust: 1, setFlags: { minaKnowsScope: true } }, preview: "Mina learns how your week is funded and holds you to it later.", result: `You give her the version with the debt in it, the checkpoint, and Dre's name. Mina listens. "All right, ${state.player.streetName || "friend"}," she says, and writes the yard's address on the back of a receipt. "Thursday mornings. Don't be here when he is."` },
        { label: "Keep the answer small", effect: { setFlags: { minaDeflected: true } }, preview: "Nothing changes tonight. Mina notices the size of the answer.", result: "You give her the short version. Mina nods, folds the receipt she was about to write on, and puts it in her apron. The heater ticks. She counts the last of the twenties without looking up." },
        { label: "Put $60 toward her yard fees", requires: "cash60", effect: { cash: -60, minaTrust: 2, setFlags: { minaTookMoney: true } }, preview: "Costs $60. Mina accepts the help and sets the terms you did not ask for.", result: "She takes the sixty and writes you a receipt on Night Owl paper, dated and signed, because she does not want it to be a favor. \"This is a loan,\" she says. \"I pay it back in March.\" She means it." },
      ]),
      mina_invitation: () => event("mina_invitation", "Four Hours and No Agenda", "Mina has four hours before her next shift and no car. The owner cut her hours again. She wants to know what kind of evening you can make. Spend the time or hand it back.", [
        { label: "Take the bus toward the inlet", effect: { minaTrust: 2, heat: -1, setFlags: { minaDateNight: true } }, preview: "Bus fare is folded into the scene; you spend the evening away from the block.", result: "You ride until the commercial lights thin out, then walk where the inlet wind cuts across the open ground. Mina talks about the yard interview, her mother, and nothing at all. On the bus back, your shoulders touch twice and neither of you moves." },
        ...(state.base.controlled ? [{ label: "Show her the garage", requires: "base_controlled", effect: { minaTrust: 1, minaJobAtRisk: true, setFlags: { minaSawGarage: true } }, preview: "She sees the operation, and she is seen near it.", result: "She walks the length of the bay once, looks at the bags, and does not touch anything. \"This is what it is, then.\" A car slows on the street outside and keeps going. Mina watches it the whole way down the block." }] : []),
        { label: "Tell her tonight is not good", effect: { setFlags: state.flags.minaRaincheck ? { minaInvitationClosed: true } : { minaRaincheck: true } }, preview: "Nothing happens tonight. The offer may come back once.", result: "She takes it evenly, the way she takes most things. \"Then another night.\" She starts walking toward the bus shelter on Spenard before you can offer the ride." },
      ]),
      mina_boundary: () => event("mina_boundary", "Someone Said Your Name Wrong", "A customer used your street name, asked which nights Mina closes, and left without buying. \"I am asking you to tell me what I am standing next to.\" Give her the truth or manage her.", [
        { label: "Tell her everything, risk included", effect: { minaTrust: 2, setFlags: { toldMinaTruth: true } }, preview: "Mina gets the whole picture, including the part that could put her at risk.", result: "You give her Curtis's name, Dre's date, and the honest odds. Mina listens all the way through without interrupting. Then she writes down the names and puts the note in her shoe. \"Now the decision is mine too,\" she says. \"That was the part you owed me.\"" },
        { label: "Give the officer her name", effect: { minaTrust: -2, heat: -1, setFlags: { usedMinaWithoutConsent: true } }, preview: "Heat drops. Mina finds out from someone else that you used her name.", result: "The story holds because her name is clean and yours is not. Some attention comes off you. Mina hears it from the officer's partner, who buys cigarettes at her counter on Fridays and assumed she already knew." },
        { label: "Tell her you can't answer that", effect: { minaTrust: -1 }, preview: "The question stays open. Mina stops expecting an answer to it.", result: "She waits long enough to be sure that is the whole reply. Then she pockets the keys. \"Okay.\" The next time you come in, the coffee is on the counter before you reach it, and she is already turned toward the register." },
      ]),
      mina_sedan_night: () => event("mina_sedan_night", "The Vale Call", "Kieran Vale arrives after Curtis's attention reaches Mina's counter. Mina knows the family name can stop this once. Decide whether she is protected, asked, or used.", [
        { label: "Protect Mina and take the pressure outside", effect: { minaTrust: 1, setFlags: { valeProtectedMina: true } }, preview: "Keep Mina out of the negotiation and accept the pressure yourself.", result: "You move the conversation away from the counter before Kieran can use her as the room's center. Mina sees exactly what you chose." },
        { label: "Ask Mina to broker it", effect: { setFlags: { minaBrokeredVale: true } }, preview: "Trust Mina to use the Vale name on terms she understands.", result: "Mina makes the call herself, states the limit before the favor, and ends it before either man can expand the deal." },
        { label: "Exploit the Vale name", effect: { minaTrust: -2, setFlags: { exploitedValeName: true } }, preview: "Gain leverage at the cost of Mina's trust and clean life.", result: "The name works. Mina watches you spend it as though it belonged to the operation." },
      ]),
      mina_after: () => {
        const name = state.player.streetName || "friend";
        if (state.npc.mina.usedWithoutConsent) {
          return event("mina_after", "The Lights Off Two Hours Early", "The Night Owl is dark two hours early. Mina is in the lot with a duffel and her sister's car running. The Ship Creek job is gone because your name reached the owner. \"I just can't be near this.\"", [
            { label: "Tell her you're sorry and mean it", effect: { minaDeparts: true, setFlags: { minaLeftClean: true } }, preview: "She leaves either way. This is the version where you do not argue.", result: `She accepts it the way she accepts most things, evenly and without making you feel better about it. "I know." She puts the duffel in the back seat. "Lock the garage at night, ${name}. You never do."` },
            { label: "Ask her to stay", effect: { minaTrust: -1, minaDeparts: true }, preview: "She has already decided. Asking does not change it.", result: "\"No.\" Not sharp, just finished. The car pulls out and turns toward Minnesota before the headlights have swung far enough to catch you." },
          ], "The night window is closed and the store is dark before nine. \"I'm not angry,\" she says, and she is not, which is worse. The owner heard her name in the wrong sentence from somebody who did not know it mattered.");
        }
        if (state.npc.mina.trust >= 3 && state.flags.minaDateNight) {
          return event("mina_after", "The Name on the Receipt", "Mina slides a folded receipt across the counter: a name, a phone number, and a bay number at the Ship Creek yard. \"He owes me, not you,\" she says. \"Which means it works once.\" Take it or leave it.", [
            { label: "Take the name", effect: { setFlags: { minaGaveContact: true }, addRumor: { areaId: "airport_industrial", productId: "cocaine", text: "Mina's contact at the Ship Creek yard says which bay doors stay unwatched after the second shift." } }, preview: "Adds a reliable Industrial Service Roads lead that Mina cannot get you twice.", result: `She watches you write the number somewhere better than your hand. "One time, ${name}. After that he doesn't know either of us." The coffee is already the right temperature, which means she poured it before you walked in.` },
            { label: "Tell her to keep it for herself", effect: { minaTrust: 1, setFlags: { refusedMinaContact: true } }, preview: "You give up the lead. Mina keeps a favor she can still spend on Monday.", result: "She looks at the receipt for a second, then puts it back in her apron without arguing. \"That's the first useful thing you've done all week.\" She says it flatly, and she means it as a compliment." },
          ], "The coffee comes with it, already poured. Outside, the first real snow of the week is holding on the pavement instead of melting. The favor is hers, and spending it on you empties it.");
        }
        return event("mina_after", "Restocking the Cold Case", "Mina keeps working through the conversation. Her Ship Creek dispatch interview follows your checkpoint. She waits for you to decide how this week closes.", [
          { label: "Wish her luck on Monday", effect: { minaTrust: 1 }, preview: "A small, honest exchange at the end of a week that did not include her.", result: "\"I don't need luck, I need him to read the second page.\" She sets the last row of bottles straight. \"But thank you.\" The cooler door swings shut and holds the fog for a while." },
          { label: "Ask if she'll still be here after", effect: {}, preview: "You get a straight answer, which may not be the one you want.", result: "\"Here, or Ship Creek, or Palmer.\" She does not stop working. \"Somewhere with a schedule.\" It is not an invitation and it is not a door closing, and she leaves it exactly that way." },
        ], "She is restocking the cold case when you come in. The cooler door fogs and clears between you. The question she leaves unasked is its own kind of answer.");
      },
      courier: () => event("courier", "Courier Behind Bay Twelve", "A courier is down beside Bay Twelve, split lip, locked case cuffed to his wrist. Headlights turn into the Industrial lane and slow down. They know what they are looking for. Move now.", [
        { label: "Spend supplies helping", effect: { cash: -55, heat: 1, setFlags: { helpedIndustrialCourier: true } }, preview: "−$55 and +1 Heat. He owes you something and knows it.", result: "You get the cuff off and get him breathing evenly against the wall. He does not thank you for it. Before he goes he tells you which service road closes on Day 6, and that the closure has nothing to do with construction." },
        { label: "Search the case", risky: true, effect: { cash: 160, heat: 2, setFlags: { robbedIndustrialCourier: true } }, preview: "+$160 and +2 Heat. He is awake for all of it.", result: "The case holds cash and a route sheet folded open to the current week, and you take both. He watches you do it from the ground with his eyes open the whole time, and the bay light is more than good enough for him to keep your face." },
        { label: "Leave before the headlights arrive", effect: {}, preview: "Nothing gained. Whatever is in the case ends up somewhere else.", result: "You are back in the vehicle before the headlights reach the bay. Two nights later the same locked case turns up open in Curtis's hand at the Downtown exit lane, and nobody has to explain to you how it got there." },
      ]),
      dre_after_payoff: () => event("dre_after_payoff", "Dre Opens Another Door", "Dre tears the note in half and keeps one piece. Then he stays, which he has not done before. He has three ways for you to use the name you just earned. Pick one.", [
        { label: "Take a larger note", effect: { secondLoan: true }, preview: `Take $1,200 now and owe $1,380 by Day ${Math.min(state.run.day + 5, state.run.checkpointDay)}.`, result: `He transfers twelve hundred before you finish agreeing. The paper says thirteen-eighty within five days or at the checkpoint, whichever comes first. "Same rules. Bigger note." He walks back to the car.` },
        { label: "Ask for the supplier", effect: { access: "cocaine", lenderTrust: 1 }, preview: "Unlocks supplier access and leaves Dre satisfied with the arrangement.", result: "He writes one Downtown address on the back of your paid note, hands it over, and burns the rest of the paperwork in the ashtray with the window cracked an inch. \"Use my name once. After that it's yours or it isn't.\"" },
        { label: "Stay independent", effect: { influence: { areaId: "north_star_lot", delta: 1 }, lenderTrust: 1, setFlags: { refusedSecondNote: true } }, preview: "No new debt. Spenard notices that you walked away clean.", result: "He puts the offer back in his jacket without any visible reaction, which from Dre is a form of respect. \"Then make your own door.\" He gets in the car. He does not say it unkindly, and he does not offer it twice." },
      ]),
      base_watch: () => event("base_watch", "The Sedan Across From the Garage", "A gray sedan has held the curb across from North Star Garage for forty minutes, windshield on the bay door, engine running. Somebody is sitting in it. None of it is hidden. Decide how you answer.", [
        { label: "Check the camera", requires: "security2", effect: { heat: -1, setFlags: { identifiedBaseWatcher: true }, baseWatched: false }, preview: "−1 Heat. You find out who is actually sitting out there.", result: "The camera catches the changeover. Curtis's driver gets out and a second man in plain clothes gets in, and neither of them looks at the lens. You now know two things they do not know you know, which is worth more than the sedan leaving would have been." },
        { label: "Move the valuable stock", effect: { heat: 1, baseWatched: true }, preview: "+1 Heat. The stock moves, and so does whoever is watching.", result: "You move the bags before first light in two trips. The sedan does not follow the first one. It follows the second one, at a distance, all the way to the turn, and then it goes back to the same piece of curb it started from." },
        { label: "Leave the garage dark", effect: { baseWatched: true }, preview: "Nothing spent. The garage stays watched and they know it.", result: "Nobody comes in and nobody tries the door. In the morning there is a chalk mark low on the frame beside the lock, small enough that you would have missed it entirely if you were not already looking for something." },
      ]),
      crew_crisis: () => event("crew_crisis", "A Crew Member Misses Check-In", "A burner buzzes at four in the morning: an APD booking number and a dollar amount. The number belongs to somebody who works for you. Whoever sent it wants money before the six o'clock shift change.", [
        { label: "Pay $180 and show up", effect: { cash: -180, crewAllLoyalty: 1, setFlags: { protectedCrewCrisis: true } }, preview: "−$180. Every person working for you hears about it.", result: "You are standing in the lot when the side door opens, which is a different thing entirely than posting the money and staying home. Nobody in the crew says anything about it directly. All of them know by the end of the day." },
        { label: "Protect the operation", effect: { crewAllLoyalty: -2, setFlags: { abandonedCrewCrisis: true } }, preview: "Nothing spent. Crew loyalty pays for it instead.", result: "You do not answer it. The garage is untouched in the morning, the stock is where you left it, and the operation loses nothing you can put a number against. The empty chair at the table stays where it is and everybody works around it." },
      ]),
      buyer_hurry: () => event("buyer_hurry", "Cash Across the Hood", "A Downtown buyer counts an overpay across your hood in the Night Owl lot, in the open. A man by the door pockets his phone, steps three feet aside, and makes a call while watching your vehicle.", [
        { label: "Take the overpay", effect: { cash: 140, heat: 1, setFlags: { buyerSeenAtMiniMart: true } }, preview: "+$140 and +1 Heat, in front of Mina's window.", result: "You take it, and it is a good number. Through the window Mina watches the man on the phone read your plate out loud, slowly, twice, and she keeps her face completely still the entire time she is ringing somebody up." },
        { label: "Move the deal elsewhere", effect: { influence: { areaId: "north_star_lot", delta: 1 }, heat: -1 }, preview: "−1 Heat and a little Spenard standing. The overpay goes away.", result: "You send him around the corner to the church lot and finish it there, out of sight of the door. It costs you four minutes and most of the premium. The Mini-Mart stays a place where you buy coffee and nothing happened in the lot." },
      ]),
      checkpoint: () => event("checkpoint", "Cones on the Service Road", "APD has the airport service road down to one lane. An officer taps the rear panel of each vehicle as he passes. The tow driver has been watching your vehicle. The line behind you keeps growing.", [
        { label: "Pay the tow driver $90", effect: { cash: -90, heat: -1 }, preview: "−$90 and −1 Heat. He opens a gate and asks nothing.", result: "He takes it without turning his head and opens the maintenance gate at the far end of the lot forty seconds later. He does not ask what is in the vehicle. He does not look at the vehicle at all, which visibly takes him some effort." },
        { label: "Risk the inspection", effect: { heat: 2, loseRandomInventory: 2, setFlags: { checkpointRecognizedVehicle: true } }, preview: "+2 Heat and up to two units gone. The vehicle gets written down.", result: "The officer takes his time and finds enough to make the time worth it. You leave two units behind and a full description of the vehicle in somebody's notebook, and he says the plate back to himself once while you are pulling away." },
      ]),
      curtis_cut: () => event("curtis_cut", "Curtis's Driver Blocks the Exit", "A black sedan blocks the Downtown exit lane. Curtis's driver opens the passenger door, leans on the roof, and waits while traffic backs up. He never says the number. He was told he does not have to.", [
        { label: "Pay Curtis $120", effect: { cash: -120, rivalPressure: -2, rivalRespect: 1, setFlags: { paidCurtisPassage: true } }, preview: "−$120. Curtis eases off and remembers that you paid.", result: "He counts it once, fast, the way somebody counts who does this several times a day. Then he moves the sedan and gives you the next block without being asked for it, which is the part that costs more than the money did." },
        { label: "Refuse the door", effect: { rivalPressure: 3, health: -8, setFlags: { refusedCurtisCut: true } }, preview: "−8 Health and sharper Curtis pressure. He hears you said no.", result: "The sedan does not move for a while. When it finally does, it is because two people have pulled you away from the wheel and made their point on the pavement. Curtis hears the version where you refused before he hears the version where you lost." },
      ]),
      rough_night: () => event("rough_night", "Red Gloves at Bay Nine", "Three people spread across the Industrial bay lane wide enough that going around is out. One wears the red work gloves you last saw on Curtis's dash. Nobody has said anything yet.", [
        { label: "Leave $80 on the concrete", effect: { cash: -80, health: -3 }, preview: "−$80 and a few bruises. They leave the bag alone.", result: "They take it off the concrete and leave the bag where it is, which is the deal they came out here to make. The one in the red gloves says there will be a next time, in the tone of somebody scheduling it rather than threatening you with it." },
        { label: "Hold your ground", effect: { health: -14, rivalRespect: 1, rivalPressure: 1, setFlags: { industrialCrewEncountered: true } }, preview: "−14 Health. Curtis hears that you did not go down.", result: "You leave upright with blood on your collar and one of them limping worse than you are. Curtis hears about it before the clinic does, and the version that reaches him is the one where you were still standing at the end of it." },
      ]),
      dre_warning: () => event("dre_warning", "Dre Counts What Is Missing", "Dre counts your partial stack on the hood twice, then folds one bill back and holds it out to you. He asks when the rest is coming. The question is genuine. He wants a date.", [
        { label: "Name the next payment", effect: { lenderTrust: 1, setFlags: { dreGoodFaithPayment: true } }, preview: "Dre takes the date and the partial payment for now.", result: "You give him a day and he repeats it back once, in the flat way he says numbers, and puts the stack in his jacket. \"Thursday.\" He does not write it down anywhere, which is not remotely the same thing as forgetting it." },
        { label: "Tell him to wait", effect: { lenderTrust: -2, heat: 1 }, preview: "+1 Heat and lasting damage to Dre's patience.", result: "He closes his jacket over the money without counting it a third time. \"All right.\" He makes one call from the driver's seat before he pulls out, short, and he is looking at the Mini-Mart door the entire time he is talking." },
      ]),
      eli_missed_turn: () => event("eli_missed_turn", "An Hour Later Than the Route", "Eli is an hour past the route time and leads with the reason. A vehicle followed him from the fuel stop, so he drove past the drop and came in from the other side. The package is intact.", [
        { label: "Ask what he saw", effect: { crewLoyalty: { id: "eli", delta: 2 }, setFlags: { eliJudgmentTrusted: true } }, preview: "Eli learns his read is worth something here.", result: "He gives you the make, the colour, which lane it held, and the two places it could have turned off and did not. None of it is guesswork and none of it is padded. Somewhere in the middle of it he stops sounding like he is defending himself." },
        { label: "Dock the route payment", effect: { crewLoyalty: { id: "eli", delta: -2 }, cash: 20, setFlags: { eliDocked: true } }, preview: "+$20 back. He learns the clock outranks his judgment.", result: "He does not argue about it, which is worse than arguing. He hands back the twenty without counting it and says the route will be on time next run. It is on time after that, every time, including the runs where it should not have been." },
        { label: "Tell him he made the right call", effect: { crewLoyalty: { id: "eli", delta: 1 }, setFlags: { eliJudgmentTrusted: true } }, preview: "He will make that call again without asking first.", result: "\"Okay.\" He says it like he is filing it somewhere. Two days later he changes a route again without checking in, and that one is also correct, and he tells you about it afterward the same flat way he tells you the fuel cost." },
      ]),
      eli_service_map: () => event("eli_service_map", "The Map He Drew Himself", "Eli spreads a hand-drawn page under the dome light: gate hours, which yards chain up at night, where patrol cars turn around, two crossings on no map. He built it over a year. He wants something for it.", [
        { label: "Pay him for a copy", requires: "cash90", effect: { cash: -90, crewLoyalty: { id: "eli", delta: 1 }, addRumor: { areaId: "airport_industrial", productId: "meth", text: "Eli's map marks two service-road crossings the patrol pattern does not cover after dark." } }, preview: "−$90. He keeps the original and you get the routes.", result: "He copies it out by hand rather than giving you the original, which takes twenty minutes and tells you exactly how he feels about the page. The copy is just as good. He folds the original back into his jacket before the money is even put away." },
        { label: "Offer him a share instead", effect: { crewLoyalty: { id: "eli", delta: 2 }, setFlags: { eliOwnsShare: true }, addRumor: { areaId: "airport_industrial", productId: "meth", text: "Eli's map marks two service-road crossings the patrol pattern does not cover after dark." } }, preview: "No cash now. He takes a cut of what the routes earn.", result: "He works out the percentage out loud, lands somewhere lower than you expected, and writes it on the corner of the map so neither of you has to remember it. Then he starts talking about a third crossing he has not verified yet, which he would not have mentioned an hour ago." },
        { label: "Tell him to keep it", effect: {}, preview: "The routes stay his. Nothing changes tonight, and he does not push.", result: "He folds it up without any visible disappointment and puts it back inside his jacket. \"It's there if you want it.\" He mentions the page exactly once more, in passing, weeks of driving later, and never pushes it again." },
      ]),
      eli_last_run: () => event("eli_last_run", "After the Seventh Night", "Eli asks what happens to him when the week is over. He wants no money. He has worked out that whatever you are building either has a driver's seat in it or it does not. Answer him.", [
        { label: "Tell him there's a seat", effect: { crewLoyalty: { id: "eli", delta: 2 }, setFlags: { eliPromisedFuture: true } }, preview: "A promise he will hold you to after the checkpoint.", result: "He nods once and goes straight back to the fuel prices, which is how you know it landed. Before he leaves he mentions that his cousin has a van with a working heater and no questions attached, and that he had not brought it up before because there had not been a reason to." },
        { label: "Tell him you don't know yet", effect: { setFlags: { eliToldHonestly: true } }, preview: "Honest and unsatisfying. He can work with honest.", result: "\"That's fair.\" He means it, mostly. He keeps driving the routes exactly as well as before, and he stops mentioning the week after next, and you notice the second thing more than you expected to." },
        { label: "Tell him this ends here", effect: { crewLoyalty: { id: "eli", delta: -1 }, setFlags: { eliToldNoFuture: true } }, preview: "He finishes the pressure phase and starts looking on his own time.", result: "He takes it without complaint because he asked and you answered. The routes stay clean through the checkpoint. He starts taking calls outside the bay, briefly, and stops leaving his jacket in the vehicle." },
      ]),
      dre_terms: () => event("dre_terms", "The Envelope After Work", `$1,000 now. $1,200 due Day ${state.run.checkpointDay}. Partial payments accepted. Dre names the terms once and keeps the envelope in his hand while the sedan idles.`, [
        { label: "Take it measured", effect: { acceptDreLoan: true, lenderTrust: 1, setFlags: { dreTermsAcknowledged: true } }, preview: `$1,000 dirty cash now. $1,200 is due Day ${state.run.checkpointDay}.`, result: "You take the envelope and hold his eyes. Dre releases it one finger at a time. He says the date once. You repeat it once." },
        { label: "Take it nervous", effect: { acceptDreLoan: true, setFlags: { dreAskedConsequences: true } }, preview: `$1,000 dirty cash now. $1,200 is due Day ${state.run.checkpointDay}.`, result: "You ask for the date again. Dre gives it to you. His thumb stays under the envelope until your grip settles." },
        { label: "Leave it with him", effect: { declineDreLoan: true, setFlags: { dreOfferDeclined: true } }, preview: "Keep grinding with your own money and no Dre debt.", result: "You leave the envelope between his hands. Dre tucks it inside his coat. The car door shuts. Your shift money stays yours." },
      ], "Dre leans against a dark sedan outside your job. Snow gathers along one shoulder. His bare hand holds a thick envelope against the roof. The engine keeps running."),
      dre_first_payment: () => {
        const name = state.player.streetName || "friend";
        return event("dre_first_payment", "The First Money You Bring Him", `Dre counts your money on the hood in stacks of five and says nothing about the amount. Then he looks at you a second longer than the transaction needs, working out whether this is a pattern.`, [
          { label: "Tell him when the next one comes", effect: { lenderTrust: 2, setFlags: { drePaymentPattern: true } }, preview: "A date on the record. Dre keeps dates.", result: `"All right, ${name}." It is the first time he has used the name, and he uses it the way he uses numbers, as a thing that is now on file. He does not write the date down. He does not need to, and both of you know that is the point.` },
          { label: "Let the money speak", effect: { lenderTrust: 1 }, preview: "No promises made, which means nothing for him to hold you to.", result: `He accepts the silence without pushing into it. "Fine." The car door closes and the light goes out and the lot is dark again. Whatever he decided about you, he decided it while counting and he is not going to share it.` },
        ]);
      },
      dre_due_day: () => {
        const balance = state.lender.balance;
        const paid = state.lender.payments;
        const heavy = paid >= 300;
        const description = balance <= 0
          ? "The note is clear and Dre came by on the due day anyway. He talks about the weather for ninety seconds, then gets to the reason: almost nobody clears one of these early."
          : heavy
            ? `Dre arrives on the due day and skips the number. $${balance} is still on the paper and there are hours left in the day. He is here to find out what you plan to do about it.`
            : `Dre is behind the Night Owl with the engine off, which means he intends to stay. $${balance} of the original amount is still on the paper. He says nothing at all. He is going to make you open.`;
        const flavor = balance <= 0
          ? "He leans on the car door with his hands in his pockets, in no hurry to explain himself. Turning up to collect nothing is the closest thing to approval he offers."
          : heavy
            ? "He has kept the running total in his head all week, so he knows what you have paid without asking. Asking beats telling, and he chose to ask."
            : "An engine left off is how he signals he has time. He has kept the running total in his head all week and he will not speak first.";
        const choices = [];
        if (balance > 0 && state.player.cash >= Math.min(balance, 100)) {
          choices.push({ label: "Pay what you have on you", effect: { payLenderNow: true, lenderTrust: 1 }, preview: "Hands over what you are carrying against the balance.", result: "You count it out onto the hood and he counts it again after you, because that is not an insult where he is from, it is just how money gets counted. The number on the paper comes down. Neither of you says anything about the part that is left." });
        }
        choices.push({ label: "Name the day you can clear it", effect: { lenderTrust: heavy ? 1 : -1, setFlags: { dreNamedFinalDate: true } }, preview: heavy ? "He has seen enough this week to take a date." : "He has not seen enough this week to take a date on faith.", result: heavy ? "He takes the date without any argument, because the week behind it does the arguing. \"I'll be here.\" He is gone in under a minute, which from Dre is a compliment." : "He listens to the date and does not agree to it or refuse it. \"You've told me a lot of things this week.\" He gets back in the car. The date stands, but so does everything else." });
        choices.push({ label: "Offer him work instead of money", effect: { lenderTrust: -1, rivalPressure: 1, setFlags: { dreOfferedFavor: true } }, preview: "He takes the offer and the balance stays where it is.", result: "\"Everybody's got something they'd rather do than pay.\" He does not say no. He takes a name and a place off you instead of cash, and by the next evening that name has a problem, and the number on your paper has not moved at all." });
        return event("dre_due_day", balance <= 0 ? "He Came By Anyway" : "The Day on the Paper", description, choices, flavor);
      },
      dre_day7: () => {
        const cleared = state.lender.balance <= 0;
        return event("dre_day7", cleared ? "The Account Closes Clean" : "What Is Left on the Paper", cleared
          ? `Dre finds you on Day ${state.run.checkpointDay} without being told where you would be. The note is settled. He is here to say what he thinks he has been dealing with all week.`
          : `Dre finds you on Day ${state.run.checkpointDay} and leaves the paper unmentioned. The balance stands at $${state.lender.balance}. He has decided what happens next. He is here to tell you.`, [
          { label: "Hear him out", effect: { lenderTrust: cleared ? 1 : 0 }, preview: cleared ? "He tells you where you stand with him." : "He tells you what the unpaid balance becomes.", result: cleared ? "\"Most people I front pay me late and act like I owe them the patience.\" He looks out at the lot rather than at you. \"You paid me. That's it. That's the whole compliment, don't wait for a better one.\"" : "\"It doesn't stop being money because the week ended.\" He says the new number, which is larger, and the new date, which is close. Then he waits to see whether you are going to argue, and does not seem to mind either way." },
          { label: "Ask what comes next", effect: { lenderTrust: cleared ? 1 : -1, setFlags: { dreAskedForFuture: true } }, preview: cleared ? "You ask about the next arrangement before he offers." : "You ask for a future while the current one is unpaid.", result: cleared ? "He takes a second with it. \"Come find me in a week and I'll have a number for you.\" It is not a yes, but he has never once said a thing like that to somebody he was finished with." : "\"Next.\" He repeats the word back like it is unfamiliar. \"You're asking me about next.\" He does not raise his voice at any point, and the conversation is over about four seconds later." },
        ], cleared
          ? "Arriving where you are without asking is its own kind of statement. He came for the reason people come at the end of an arrangement they respected."
          : "He wants to see your face while he says it. The decision was made before he arrived, so nothing said here moves the number.");
      },
      curtis_mark: () => event("curtis_mark", "Somebody Repeats a Private Detail", "The kid at the coffee counter mentions somebody asked which mornings you come in. He does not know he told you anything. The tag by the bus shelter has been gone over in a different hand.", [
        { label: "Ask the kid who was asking", effect: { setFlags: { curtisMarkInvestigated: true }, rivalRespect: 1 }, preview: "You get a description. Curtis hears that you went looking.", result: "The description is useless on its own (a man, a jacket, a car nobody looked at properly). The kid remembers he was polite and bought nothing. By the afternoon somebody has told Curtis's driver that you asked, which was always the more useful half of doing it." },
        { label: "Change which mornings you come in", effect: { heat: -1, setFlags: { curtisMarkAvoided: true } }, preview: "−1 Heat. Harder to find, and it costs you the routine.", result: "You move your hours and the coffee is worse at the new time and the walk is longer. Nothing follows you for two days. On the third, the same tag on the same wall has been gone over again, so somebody worked out the new schedule inside forty-eight hours." },
        { label: "Do nothing about it", effect: { rivalPressure: 1 }, preview: "+1 Curtis pressure. Being watched costs nothing until it does.", result: "You keep the same mornings and the same corner and act as though the wall is just a wall. Nothing happens for three days. Then a buyer who has never been late is late, and apologises without explaining, and does not meet your eye while doing it." },
      ]),
      curtis_tax: () => event("curtis_tax", "Curtis Comes Himself", "Curtis Foyer gets out of the car and offers four versions of the same future: pay him, stand beside him, keep him at arm's length, or refuse him in public.", [
        { label: "Pay the tax", effect: { curtisDecision: "pay_tax" }, preview: "Curtis takes 15% of nightly illegal gross. Ordinary attention growth pauses at 5.", result: "Curtis names no weekly minimum. He takes fifteen percent of whatever the night actually made and tells his people to stop inflating the number. The arrangement is expensive, stable, and visible." },
        { label: "Accept friendship", effect: { curtisDecision: "friendship" }, preview: "Two days of protection and a 10% buyer premium. Betrayal becomes possible after the protection expires at attention 7.", result: "Curtis calls it friendship. For two days his name keeps hands off your buyers and adds ten percent to what they will pay. The word is warmer than the arrangement." },
        { label: "Stay guarded", effect: { curtisDecision: "guarded" }, preview: "+1 respect. No protection and no betrayal trap.", result: "You keep the conversation respectful and the distance exact. Curtis recognizes the boundary, gives you nothing, and respects that you asked for nothing." },
        { label: "Reject him", effect: { curtisDecision: "reject" }, preview: "+2 respect and +1 attention. Independence remains intact and stronger confrontations unlock.", result: "You say no in front of the corner. Curtis respects the public answer, then makes sure the city notices that he heard it." },
      ]),
      curtis_day7: () => {
        const respectful = state.npc.curtis.respect >= 2 && state.npc.curtis.pressure <= 6;
        return event("curtis_day7", respectful ? "An Offer at the End of the Week" : "The Account He Has Been Keeping", respectful
          ? "Curtis's car is outside North Star Garage and the window comes down. He has watched you handle a debt, a corner, and two of his own people all week. He has a number for what you are worth to him."
          : `Curtis sends three people on Day ${state.run.checkpointDay} instead of coming. They stand in the lot. One holds a phone with an open line. He is listening live.`, [
          { label: respectful ? "Hear the offer" : "Walk out and face them", effect: { rivalRespect: 1 }, preview: respectful ? "You find out what a working arrangement costs." : "You take the meeting on your feet, in your own lot.", result: respectful ? "The arrangement he describes is genuinely good and would leave you working for him in every way that matters except the word. He does not oversell it. \"Think about it past tonight,\" he says, and the window goes back up before you have answered." : "You go out to them and nobody touches anybody. The one with the phone holds it up slightly, and a voice on it says your name once, and then they leave. The whole thing takes ninety seconds and costs you nothing you can count." },
          { label: respectful ? "Tell him you're staying independent" : "Stay inside and let them stand there", effect: { rivalPressure: 2, setFlags: { refusedCurtisFinal: true } }, preview: "+2 pressure. He learns where the line is.", result: respectful ? "\"That's a no, then.\" He is not offended, which is somehow worse than if he had been. \"You'll hear from me in a month and it won't be an offer.\" The car pulls out slowly enough that it is clearly on purpose." : "They stand in the lot for forty minutes and then go. Nothing is broken and nobody is hurt and every single person on this block watched them do it, which was always the point of sending them instead of coming." },
        ], respectful
          ? "He stays in the car the whole time. What you are worth to him and what you are worth are separate figures, and he is quoting one of them."
          : "Standing in your lot without acting is the entire message. Whatever gets said here reaches him before you finish saying it.");
      },
      goodie_corner_intro: () => event("goodie_corner_intro", "Warm Air Off the Dryer Vents", "Three people stand in the warm air off the Wash & Go dryer vents. One works a corner out of a gym bag and has clocked you twice. The second time, he lifts his chin. Decide what he becomes.", [
        { label: "Introduce yourself properly", effect: { meetDealer: "goodie", dealerStanding: { id: "goodie", delta: 1 } }, preview: "Opens Goodie as a contact in People. He decides what you are later.", result: "He gives you a name, Goodie, and does not ask for yours, which means he already has some version of it. The conversation lasts ninety seconds and covers nothing. By the end of it you know where he stands every night and he knows you bothered to ask." },
        { label: "Ask what he moves", effect: { meetDealer: "goodie" }, preview: "Opens Goodie as a contact. Straight to business, and he notices that too.", result: "He tells you weed and shrooms and nothing else, and he tells you the prices without being asked, which is either confidence or a test. He does not offer a name until you are already turning to go, and then he offers it to your back." },
        { label: "Mark the corner and keep walking", effect: { meetDealer: "goodie", dealerStanding: { id: "goodie", delta: -1 } }, preview: "Opens Goodie as a contact, cold. He read the look you gave the bag.", result: "You do not stop, but you slow down enough to count the bag, the two people with him, and the gap between the vents and the street. He watches you do all of it. Neither of you pretends the other was not counting something." },
      ]),
      goodie_regular: () => event("goodie_regular", "The Regular-Customer Price", "Goodie has stopped checking the bills twice. He names the regular price and one rule: one buy a day, no exceptions when the corner is hot.", [
        { label: "Accept the terms", effect: { dealerStanding: { id: "goodie", delta: 1 }, setFlags: { goodieRegularTerms: true } }, preview: "Build standing and keep the corner dependable.", result: "Goodie nods once. The price improves; the daily limit does not." },
        { label: "Keep it transactional", effect: { setFlags: { goodieRegularTerms: false } }, preview: "Keep access without another promise.", result: "He counts the bag, counts the cash, and leaves trust exactly where it was." },
      ]),
      goodie_atlanta: () => event("goodie_atlanta", "What Atlanta Taught Him", "Goodie talks about Atlanta only after the last buyer leaves: too many people mistaking fast growth for invisible growth, and a corner that disappeared in one afternoon.", [
        { label: "Listen without mining it", effect: { dealerStanding: { id: "goodie", delta: 1 }, setFlags: { goodieAtlantaHeard: true } }, preview: "Goodie reads respect in the silence.", result: "He finishes the story and gives you tomorrow's reliable rumor before you ask." },
        { label: "Ask who survived", effect: { setFlags: { goodieAtlantaHeard: true } }, preview: "Learn the lesson without gaining standing.", result: "Goodie names nobody. \"The ones you know are the ones who stayed visible.\"" },
      ]),
      goodie_recognized: () => event("goodie_recognized", "Deshawn Wants a Word", "Deshawn vouched for you when you were nobody here, and you robbed Goodie after. He has waited outside the Wash & Go for twenty minutes. He wants to know whether he read you wrong. He is calm.", [
        { label: "Tell him straight what you did", effect: { influence: { areaId: "north_star_lot", delta: -1 }, setFlags: { ownedGoodieRobbery: true } }, preview: "Costs you standing on the block. He keeps talking to you afterward.", result: "You give him the version with nothing shaved off it. He listens all the way through and then stands there a while longer. \"I'm not going to say anything to anybody.\" He means it, and it is somehow worse than being shouted at." },
        { label: "Offer him money to square it", effect: { cash: -120, setFlags: { paidOffDeshawn: true, goodieRestitution: true } }, requires: "cash120", preview: "−$120. It settles the debt without settling what he thinks.", result: "He takes it because turning it down would be a performance and he is not interested in performing. He counts it once, puts it away, and tells you the corner is somebody else's problem now. He does not ask where the money came from, which is its own answer." },
        { label: "Tell him it was business", effect: { influence: { areaId: "north_star_lot", delta: -1 }, rivalRespect: 1, setFlags: { dismissedDeshawn: true, deshawnBusinessSevered: true } }, preview: "Costs block standing. The version Curtis hears is that you do not flinch.", result: "\"Business.\" He repeats it back without any weight on it at all, nods once, and walks off toward Minnesota. Within two days three people who used to nod at you outside the Mini-Mart have stopped doing it, and one of them tells Curtis's driver why." },
      ]),
      wet_bricks: () => event("wet_bricks", "The Tarp Tore Past Palmer", "The load rode forty miles in freezing rain after the tarp tore past Palmer. The man unstrapping it wants it off his truck before his shift ends, and offers the whole lot at a little over half.", [
        { label: "Buy the whole lot", requires: "cash190", effect: { cash: -190, addProduct: { id: "weed", qty: 6, unitCost: 32 }, setFlags: { boughtWetLot: true } }, preview: "−$190 for six units of weed. Condition stays unverified until you try to move it.", result: "He helps you load it, which is the first generous thing he has done all night, and is gone before you finish counting. Two of the seals are soft at the corner. The rest you will find out about at the sale." },
        { label: "Buy two and check the seals", requires: "cash70", effect: { cash: -70, addProduct: { id: "weed", qty: 2, unitCost: 35 } }, preview: "−$70 for two units you inspect before committing to the rest.", result: "You take the two off the dry end of the pallet and hold each one up to the bay light. They are fine. He watches you check, decides you are not worth the argument, and re-straps what is left." },
        { label: "Leave it on the truck", effect: { setFlags: { passedWetLot: true } }, preview: "Nothing spent. He finds another buyer inside the hour.", result: "You are still in the lot when a second vehicle backs up to the flatbed and takes the lot at his asking price without opening anything. The wind comes off the flats and the whole bay smells like wet cardboard." },
      ]),
      door_knock: () => event("door_knock", "Working Their Way Along the Row", "Knocking two doors down, and a voice saying \"just a few questions.\" One officer on the landing, one at the bottom of the stairs. They are working along the row toward this door.", [
        { label: "Sit still and let it pass", effect: { heat: 1 }, preview: "+1 Heat. You stay put and hope the row ends before this door does.", result: "The knocking reaches the next unit, holds there a while, then moves on down the landing. Somebody upstairs runs water for a long time. Nobody knocks here, but the officer at the bottom of the stairs writes something down before he leaves." },
        { label: "Move the bag out the back", effect: { heat: -2, health: -3, setFlags: { movedBagOnIce: true } }, preview: "−2 Heat. The back stairs are iced and you are carrying weight down them.", result: "The back stairs have not been salted since November. You go down them fast with the bag on one shoulder and your free hand on the rail, and you land badly at the bottom. By the time the officers reach this unit there is nothing in it worth the questions." },
        { label: "Open the door first", effect: { heat: -1, setFlags: { openedDoorToAPD: true } }, preview: "−1 Heat. Volunteering looks better than being found, and costs you the conversation.", result: "You open it before they knock, which surprises them enough to change the tone. They ask about a vehicle, not about you. You answer three questions honestly because none of them are dangerous, and they move on a door earlier than they meant to." },
      ]),
      stranded_wagon: () => event("stranded_wagon", "Hazards on the Off-Ramp", "A wagon sits on the off-ramp shoulder, hazards on, hood up, two kids belted in the back with their coats zipped. She waves once, apologetically. Twenty minutes of your week against her night.", [
        { label: "Pull over and jump the battery", effect: { influence: { areaId: "north_star_lot", delta: 1 }, setFlags: { helpedStrandedDriver: true } }, preview: "Costs you the shoulder time. She and half the block will remember the vehicle.", result: "It takes two tries and a lot of engine noise before the wagon catches. She writes her number on a gas receipt and says her brother does bodywork in Mountain View, no charge, whenever you want. The kids wave through the back glass the entire time you are pulling away." },
        { label: "Call it in from the corner", effect: {}, preview: "Somebody official gets there eventually. You are not involved.", result: "You make the call from the lot at the top of the ramp and watch long enough to see a trooper's lights come up the shoulder. It takes twenty-five minutes. The kids' windows are fogged the whole time." },
        { label: "Keep driving", effect: {}, preview: "Nothing spent, nothing gained. The ramp is behind you in nine seconds.", result: "You are past before the decision finishes forming. In the mirror the hazards keep going, smaller, and then the on-ramp curve takes them out of sight." },
      ]),
      found_phone: () => event("found_phone", "Face-Down on the Bench", "A phone on the bench, still warm, screen unlocked. The last thread is a buyer arranging pickups by cross-street and half-hour window, six days out. It rings. The contact name reads DO NOT SAVE.", [
        { label: "Copy the schedule and leave the phone", effect: { setFlags: { copiedBuyerList: true }, addRumor: { areaId: "downtown", productId: "shrooms", text: "A schedule copied off a lost phone puts a Downtown buyer on Fourth Avenue in half-hour windows for the next several days." } }, preview: "Adds a short-lived Downtown lead. Somebody eventually notices the phone was read.", result: "You write the six cross-streets on the inside of a receipt and set the phone back exactly face-down, exactly where it was. It rings twice more while you are still under the shelter. You do not look at it the second time." },
        { label: "Wipe it and hand it in", effect: { influence: { areaId: "downtown", delta: 1 }, setFlags: { returnedLostPhone: true } }, preview: "You give up the schedule. The counter staff on Fourth will know your face for the right reason.", result: "The woman behind the transit counter takes it, checks the lock screen, and thanks you by name because she has seen you on this corner before. Whoever owns it gets it back at four. You will never know who they were." },
        { label: "Put it back and walk", effect: {}, preview: "You leave it exactly as you found it, warm and ringing.", result: "You set it down and go. Half a block later it is still audible under the shelter roof, and then a bus pulls in and it is not." },
      ]),
      careful_customer: () => event("careful_customer", "Better Questions Than He Should Have", "He knows the weight before you say it and the price before you quote it. He asks which lot you park in, apologizes, then asks again in a different order. His hands are wrong for his story.", [
        { label: "Sell him exactly what he asked for", effect: { cash: 95, heat: 2, setFlags: { soldToCarefulCustomer: true } }, preview: "+$95 now, +2 Heat, and he keeps whatever he came here to collect.", result: "The money is right and the handoff is clean and he thanks you twice, which nobody does. He is gone up the block before you have finished putting it away. Two of his questions are still sitting where you cannot reach them." },
        { label: "Tell him you're not holding", effect: { setFlags: { refusedCarefulCustomer: true } }, preview: "No sale, no Heat. He may simply have been careful.", result: "He accepts it immediately, which is the first thing all night that has not been strange. \"Worth asking.\" He walks to the corner, does not cross, and stands there reading his phone for a while." },
        { label: "Ask who sent him", effect: { heat: 1, setFlags: { questionedCarefulCustomer: true } }, preview: "+1 Heat. You get a name, and he gets confirmation that you noticed.", result: "He gives you a name from two blocks over, and it is a real name, and the way he produces it means he had it ready. Whatever he was checking, he now knows you count questions. Neither of you pretends otherwise." },
      ]),
      dock_shift: () => event("dock_shift", "Two People Short", "Four hours of unload at the Ship Creek dock, two people short, cash at the end of the shift and nothing written down. The foreman has a clipboard and no patience. These are four hours you do not have.", [
        { label: "Take the shift", effect: { cash: 110, heat: -1, health: -2, setFlags: { workedDockShift: true } }, preview: "+$110, −1 Heat. Four hours of honest labor and a sore back for it.", result: "It is pallets of canned goods and one long run of freight blankets, and by the third hour your hands have stopped closing properly. The foreman pays out of an envelope at the door and asks if you want Thursday. Nobody at the yard asked your name." },
        { label: "Tell him you can't tonight", effect: {}, preview: "Nothing gained. He fills the slot in under a minute.", result: "He has already turned toward the two men behind you before you finish the sentence. The doors roll open and the wind takes the sound of it up the channel." },
      ]),
      garage_furnace: () => event("garage_furnace", "The Door Seal Froze Shut", "The furnace stopped overnight. Everything stored along the back wall sat at outside temperature for six hours, and the door seal froze to the frame. The repair number is a Wasilla answering machine.", [
        { label: "Pay the emergency callout", requires: "cash130", effect: { cash: -130, setFlags: { paidFurnaceCallout: true } }, preview: "−$130. Somebody drives in from the Valley and the bay is warm by afternoon.", result: "He comes down from Wasilla in a truck with the tailgate wired shut, replaces an igniter, and charges you for the drive more than the part. The bay is warm by two. He does not ask what is stacked along the wall and does not look at it twice." },
        { label: "Patch it yourself", effect: { health: -4, setFlags: { patchedFurnace: true } }, preview: "Nothing spent. You are on a cold concrete floor with somebody else's wiring.", result: "It is a thermocouple, which you work out after an hour on the floor with a flashlight in your teeth. It lights on the fourth try and stays lit. Your knuckles are opened up across two fingers and the whole bay smells like burnt dust for the rest of the day." },
        { label: "Leave it until the week is over", effect: { baseDamage: 1, setFlags: { ignoredFurnace: true } }, preview: "Nothing spent now. The cold wall keeps being a cold wall.", result: "You shut the connecting door and decide it is a next-week problem. By evening there is condensation running down the inside of the bay window and standing water along the base of the wall where the stock is." },
      ]),
      sedan_rumor: () => event("sedan_rumor", "Everyone Agrees on the Color", "The gray sedan is a repo driver, or it is Curtis's, or it belongs to a man whose brother you have never met. Nobody in the chain saw it. Everyone agrees on the color and nothing else.", [
        { label: "Change your route for the day", effect: { heat: -1, setFlags: { reroutedOnRumor: true } }, preview: "−1 Heat from the longer way around, whether or not any of it was true.", result: "You take the long way to everything for a day, which costs you two good windows and produces no sedan. That is either because the story was wrong or because the route worked, and there is no version of the day that tells you which." },
        { label: "Ask somebody positioned to know", effect: { setFlags: { checkedSedanRumor: true } }, preview: "You spend the ask. The answer may be that nobody knows either.", result: "The third person you ask is the first one who was actually on the block, and what she says is that there was a gray sedan on Tuesday and she has no idea whose. It is the most honest version you get and it is worth almost nothing." },
        { label: "Carry on as planned", effect: {}, preview: "You act as though nothing was said, because possibly nothing was.", result: "You work the day you had already planned. Nothing happens, which proves nothing at all, and by evening two more people have told you the story with a different make of car in it." },
      ]),
      midtown_lights: () => event("midtown_lights", "Half a Mile at Walking Speed", "Four cruisers and a fire truck have the left two lanes coned off. Traffic is doing walking speed for half a mile. It is a collision. It is also every officer in Midtown with nothing else to look at.", [
        { label: "Cut over to the frontage road", effect: { heat: -1, setFlags: { avoidedMidtownLights: true } }, preview: "−1 Heat. The frontage road is slower and nobody on it is being watched.", result: "You come off at Thirty-Sixth and take the frontage road behind the strip mall, past the sign for a carpet outlet that closed years ago and never came down. It adds fifteen minutes. Nobody looks at the vehicle once." },
        { label: "Sit in the line", effect: { heat: 1 }, preview: "+1 Heat. Half a mile of being the slowest thing in front of four cruisers.", result: "It takes eleven minutes to clear the cones. A trooper glances into the vehicle somewhere around the fire truck, the way people look at anything that is moving slowly past them, and then looks at the next one. It is almost certainly nothing." },
      ]),
      eli_lieutenant_offer: () => event("eli_lieutenant_offer", "Eli Wants a Bigger Job", "Eli has a second phone he did not have last week. \"You're spending time on corners that should just be running themselves.\" He wants to place soldiers, rotate them, and bring you only the calls that need you.", [
        { label: "Give him Operations", effect: { setFlags: { eliLieutenantOfferAccepted: true }, promoteEliLieutenant: true }, preview: "Eli starts running soldier placement and corner rotation on his own.", result: "He pockets the phone like the conversation is already over. \"I'll bring you the numbers, not the errands.\" By the time you are back at the garage he has already written a rotation on the whiteboard nobody asked him to buy." },
        { label: "Keep making the calls yourself", effect: { setFlags: { eliLieutenantOfferDeclined: true }, crewLoyalty: { id: "eli", delta: -1 } }, preview: "Nothing changes yet. He will ask again once more is riding on it.", result: "He puts the second phone away without arguing. \"Your week.\" He does not bring it up again, but he also stops volunteering the small things he used to mention on his own." },
      ]),
      spenard_block_scouted: () => event("spenard_block_scouted", "Eli's Map of the Blocks", "Eli unrolls a Spenard street map with corners circled in three pens and dates beside some of them. \"This is what patrol looks like on the ground.\" He taps each circle and gives you a number for it.", [
        { label: "Take the map", effect: { setFlags: { spenardBlocksRevealed: true } }, preview: "Block earning, Heat exposure, Curtis visibility, and patrol frequency become visible before you claim anything.", result: "You fold the map into the glovebox. The numbers on it do not match the stories people tell about those corners, which is exactly why they are worth having." },
        { label: "Tell him to keep it simple", effect: { setFlags: { spenardBlocksDeclined: true } }, preview: "You skip the numbers and keep reading the blocks yourself, the way you have all week.", result: "He rolls the map back up without arguing and sets it on the shelf instead of the hood. \"It'll be here when you want it.\" You keep working corners off instinct instead of his notes." },
      ]),
      yalonda_cooking: () => event("yalonda_cooking", "Something on the Stove", "Yalonda has rice going and asks how the day treated you. She waits through the first easy answer while the pot lid taps against the steam.", [
        { label: "Tell her the useful truth", effect: { setFlags: { yalondaCookingSeen: true }, npcTrust: { id: "yalonda", delta: 1 } }, preview: "Build a little trust at home.", result: "She turns the flame down and listens until the whole answer is out." },
        { label: "Keep the answer light", effect: { setFlags: { yalondaCookingSeen: true } }, preview: "Share the meal without opening the whole day.", result: "She lets the easy answer stand and puts another spoon beside the pot." },
      ]),
      yalonda_warning: () => event("yalonda_warning", "Questions at the Walk", "Yalonda saw somebody pause outside twice. The coat was wrong for the weather, the questions were about you, and the same car stayed warm at the curb.", [
        { label: "Take the warning seriously", effect: { heat: -1, setFlags: { yalondaWarningSeen: true } }, preview: "Change your route and lose 1 Heat.", result: "You leave by the back walk. The same coat passes the front window once more." },
        { label: "Say it was nothing", effect: { setFlags: { yalondaWarningSeen: true } }, preview: "Keep your route and accept the uncertainty.", result: "Yalonda locks the deadbolt herself and says nothing more about the car." },
      ]),
      yalonda_flirt: () => event("yalonda_flirt", "The Rent Envelope Stays Open", "Yalonda sets the paid envelope beside the kettle instead of putting it away. The house is quiet, your route home stayed clean, and she asks whether you ever stop working long enough to eat.", [
        { label: "Stay for dinner", effect: { npcTrust: { id: "yalonda", delta: 1 }, setFlags: { yalondaFlirtAccepted: true } }, preview: "Let the relationship become something more personal.", result: "She leaves the second plate on the table. Neither of you calls the evening business." },
        { label: "Keep it about the room", effect: { setFlags: { yalondaFlirtDeclined: true } }, preview: "Keep the relationship warm and strictly practical.", result: "Yalonda nods, seals the envelope, and sends you off with a covered plate." },
      ]),
      juan_warehouse_story: () => event("juan_warehouse_story", "Juan Gets Home Late", "Juan drops his work gloves by the heater. A truck missed its window and the dock needs people who answer callbacks.", [
        { label: "Ask who runs the dock", effect: { shareJuanInfo: "work:ship_creek", discoverGym: true, setFlags: { juanWarehouseStorySeen: true } }, preview: "Learn a work lead and the community gym.", result: "Juan writes two names and the gym address on the back of a receipt." },
        { label: "Ask about his shift", effect: { npcTrust: { id: "juan", delta: 1 }, setFlags: { juanWarehouseStorySeen: true } }, preview: "Build trust without taking the lead.", result: "Juan tells the whole truck story and leaves the work names for another night." },
      ]),
      juan_referral: () => event("juan_referral", "Juan Makes the Call", "Juan's warehouse needs another loader before the next receiving truck. He can put your name directly in the supervisor's hand and skip the callback wait.", [
        { label: "Take the referral", effect: { hireJobId: "juan_warehouse", setFlags: { juanReferralSeen: true } }, preview: "Skip the normal two-part application delay.", result: "Juan sends the name. The supervisor replies with tomorrow's loading time." },
        { label: "Apply on your own", effect: { setFlags: { juanReferralSeen: true } }, preview: "Leave Juan's direct referral unused today.", result: "Juan pockets his phone and tells you which door takes paper applications." },
      ]),
      discover_907_juan: () => event("discover_907_juan", "Juan Sends a Link", "Juan shows you a local resale list where ordinary items move for clean cash. He says the useful posts disappear before most people finish breakfast.", [
        { label: "Save the link", effect: { discover907List: true }, preview: "Save the 907List link for later.", result: "The link stays in your phone under a plain bookmark." },
        { label: "Leave it for now", effect: {}, preview: "Keep the local listing link unknown.", result: "Juan closes the page and goes back to his music." },
      ]),
      discover_907_work: () => event("discover_907_work", "A Link Between Shifts", "A coworker texts a local resale list between shifts. The fast listings disappear first, and buyers pay clean when the item looks ready to carry home.", [
        { label: "Save it", effect: { discover907List: true }, preview: "Save the 907List link for later.", result: "The listings load beside the shift schedule." },
        { label: "Ignore the message", effect: {}, preview: "Keep the local listing link unknown.", result: "The message slides under the rest of the shift thread." },
      ]),
      discover_907_night_owl: () => event("discover_907_night_owl", "The Board's Missing Tab", "A torn Night Owl posting leaves one readable resale link under the staple. Every phone-number tab is gone, but the page address is still intact.", [
        { label: "Copy the address", effect: { discover907List: true }, preview: "Save the 907List link for later.", result: "You copy the address before the paper tears loose." },
        { label: "Leave the board alone", effect: {}, preview: "Keep the local listing link unknown.", result: "The loose corner flaps once and folds back under the staple." },
      ]),
      discover_907_wander: () => event("discover_907_wander", "A Listing on the Pole", "A resale pickup note on Spenard Road points to a local listings page. The handwriting promises cash pickup and leaves the web address twice.", [
        { label: "Follow the link", effect: { discover907List: true }, preview: "Save the 907List link for later.", result: "The page opens to three listings nearby." },
        { label: "Keep walking", effect: {}, preview: "Keep the local listing link unknown.", result: "The paper stays on the pole for the next person walking past." },
      ]),
      curtis_respect_notice: () => event("curtis_respect_notice", "Curtis Notices the Corners", "Curtis has stopped calling your operation a nuisance. One of his people called it an operation, in front of people who repeat things. That attention arrives with no threat attached. Take it seriously.", [
        { label: "Note it and keep moving", effect: {}, preview: "Nothing to spend here. The respect is already logged and worth remembering later.", result: "You do not change anything about the week because of a rumor, but you remember who told you, in case the next thing that comes through this route needs to move fast." },
        { label: "Ask what else they said", effect: {}, preview: "You spend a little time chasing the rest of the story instead of moving on.", result: "The second half of the rumor turns out thinner than the first, mostly guesswork dressed up as certainty. Still, you learn which corner the comment was made on, and that is not nothing." },
      ]),
      soldier_raid_aftermath: () => event("soldier_raid_aftermath", "The Morning After the Raid", "The block is quiet too early. Nobody is standing that corner, and the regular buyers are deciding whether to come back. Nothing here needs a decision from you. It already happened.", [
        { label: "Keep the block running", effect: {}, preview: "Acknowledge it and move on. The operation absorbs the loss and keeps working the corner.", result: "You do not close the corner. By afternoon somebody is standing on it again, and the block decides on its own how much that matters." },
        { label: "Walk the block yourself", effect: {}, preview: "You spend a little time seeing the aftermath in person instead of hearing about it.", result: "There is nothing dramatic to see, just an empty spot where somebody used to stand and a few people who noticed. You leave without changing anything, but you saw it yourself." },
      ]),
    };
    const factory = events[id];
    if (!factory) return null;
    const built = factory();
    const identity = state.player.streetIdentity;
    const identityCopy = {
      mina_intro: { mover: "Mina notices you check the counter traffic before you sit.", earner: "Mina has already heard that you keep dates written down.", stickup: "Mina watches your hands before she watches your face.", connector: "Mina knows two people who have already said your name kindly.", wild_card: "Mina says the stories about you never agree long enough to become useful." },
      eli_offer: { mover: "Eli starts with the delivery window instead of the route.", earner: "Eli asks whether the people at your table get paid on time.", stickup: "Eli names the exits before he names the turns.", connector: "Eli names the people on the route before he names the turns.", wild_card: "Eli admits he cannot tell which version of you will show up." },
      dre_terms: { mover: "Dre asks about turnover before he asks about cash in hand.", earner: "Dre already has the payment dates written down. So do you.", stickup: "Dre leaves a longer silence after he mentions consequences.", connector: "Dre names the people who vouched before he names the number.", wild_card: "Dre says inconsistency is still a pattern if it lasts long enough." },
      curtis_mark: { mover: "Curtis's people have started counting your buyers.", earner: "Curtis's people know which obligations you have kept.", stickup: "Curtis's people stopped asking whether you carry. They ask whether you came alone.", connector: "Curtis's people keep asking why calls get returned for you.", wild_card: "Curtis's people have three descriptions of you and trust none of them." },
      goodie_corner_intro: { mover: "You check the seals before the price. Goodie notices the order.", earner: "Goodie asks who taught you to keep a ledger.", stickup: "Goodie leaves one hand below the dryer-door line.", connector: "Goodie recognizes the name of the person who sent you.", wild_card: "Goodie cannot decide whether to quote you a price or watch the exit." },
      sedan_rumor: { mover: "You weigh the rumor against the lost selling window.", earner: "You weigh it against everything due before Night.", stickup: "The version people repeat gives you a weapon whether it is true or not.", connector: "Two calls tell you more than the third-hand story did.", wild_card: "The rumor changes shape because nobody knows which version of you would react." },
      dre_day7: { mover: "Dre judges the week by what kept moving.", earner: "Dre judges the week by what got paid.", stickup: "Dre judges the week by what survived the pressure.", connector: "Dre judges the week by who is still at the table.", wild_card: "Dre says the week produced evidence in every direction." },
    };
    if (identity !== "unproven" && identityCopy[id]?.[identity]) built.description += ` ${identityCopy[id][identity]}`;
    built.choices = built.choices.filter((choice) => {
      if (!choice.requires) return true;
      if (choice.requires === "security2") return state.base.tracks.security >= 2;
      if (choice.requires === "base_controlled") return state.base.controlled;
      const cashGate = /^cash(\d+)$/.exec(choice.requires);
      if (cashGate) return state.player.cash >= Number(cashGate[1]);
      return true;
    }).map((choice) => ({
      ...choice,
      preview: choice.preview.split(/\s+/).length < 8 ? `${choice.preview} This changes the next route available to you.` : choice.preview,
      result: choice.result.split(/\s+/).length < 15 ? `${choice.result} The exchange settles into the room and stays there after you move on.` : choice.result,
    }));
    return built;
  }

  function startEncounter(state, id, finishAfter) {
    const templates = {
      mina_sedan_night: { title: "Your Pressure Reaches the Night Owl", description: "The gray sedan is outside the Night Owl. A collector catches the door before it closes and uses Mina's shift to make sure you stop. She looks at the alarm, then at you. Keep this off her counter.", flavor: "Your visible choices raised Curtis's pressure far enough to bring the car here. The driver watches you the whole time and never once looks at Mina. She is waiting to see whether you keep a danger you created away from her counter.", enemyName: "Curtis's Parking-Lot Collector", enemyHealth: 30, guard: 0.10, evasion: 0.06, pursuit: 0.12, attack: [6, 12], pay: 120 },
      early_street: { title: "A Tail on the Service Road", description: "A sedan follows you away from Spenard and blocks the narrow service-road exit. No friend is close enough to pull into this decision.", enemyName: "Roadside Collector", enemyHealth: 24, guard: 0.08, evasion: 0.05, pursuit: 0.10, attack: [5, 10], pay: 85 },
      goodie_retaliation: { title: "The Wash & Go Comes Looking", description: "Goodie brings two others. They block the mouth of the lot, and a third is behind you by the time you hear the gravel. He wants the block to watch this. Answer it.", flavor: "He comes to settle what everyone on this stretch of Spenard Road saw happen to him. The bag and the money are beside the point. What matters to him is what the same people see happen next.", enemyName: "Goodie and Two Others", enemyHealth: 38, guard: 0.12, evasion: 0.08, pursuit: 0.14, attack: [7, 13], pay: 150 },
      dre_collector: { title: "Dre Sends Someone in Person", description: "The late fees came off the paper and into the driveway. Dre's collector is waiting when you get back, taking his time about it so you register how much time he has.", flavor: "Sending a person costs Dre more than sending a number, which is how you know the balance has moved into a different category. He waits in the open where the neighbors can see him do it.", enemyName: "Dre's Collector", enemyHealth: 30, guard: 0.10, evasion: 0.07, pursuit: 0.12, attack: [6, 12], pay: 150 },
      mid: { title: "Curtis's Loading-Bay Test", description: "Curtis's people close both ends of Bay Nine. They know about the garage, the crew, and which route you used to get here.", enemyName: "Curtis's Crew", enemyHealth: 42, guard: 0.14, evasion: 0.10, pursuit: 0.16, attack: [8, 14], pay: 180 },
      late: { title: "The Seventh-Night Consequence", description: "The final plan reaches the garage before you do. Red-and-blue light washes over Curtis's sedan while everybody waits to see who you protect.", enemyName: "Final Opposition", enemyHealth: 58, guard: 0.18, evasion: 0.13, pursuit: 0.20, attack: [10, 18], pay: 320 },
    };
    let template = templates[id];
    if (!template) return;
    // A collector's severity scales with how much of the debt is still
    // unpaid: a player who owes almost nothing faces a lighter encounter
    // than one who has paid down nothing at all.
    if (id === "dre_collector" && state.lender.collectorTier >= 2) {
      template = { ...template, enemyHealth: Math.round(template.enemyHealth * 1.3), pay: Math.round(template.pay * 1.3), attack: [Math.round(template.attack[0] * 1.2), Math.round(template.attack[1] * 1.2)] };
    }
    state.run.pendingEncounter = {
      active: true, id, type: "authored", phase: 0, step: 1, choices: [], npc: null,
      resolved: false, choicesMade: [], result: null, loot: null, engine: "legacy_authored",
      enemyHealth: template.enemyHealth, feedback: template.description, finishAfter: !!finishAfter, ...template,
    };
    const identity = state.player.streetIdentity;
    const preview = identity === "stickup" ? "They arrived expecting you to make this physical."
      : identity === "connector" ? "They keep looking past you for whoever might answer your call."
      : identity === "mover" ? "They chose the hour when they think your business will hurt most."
      : identity === "earner" ? "They know you have obligations you intend to reach."
      : identity === "wild_card" ? "They prepared for two different versions of you and may have guessed wrong." : "Nobody here knows yet what kind of answer you give.";
    state.run.pendingEncounter.description += ` ${preview}`;
    state.run.pendingEncounter.feedback = state.run.pendingEncounter.description;
    if (id === "mina_sedan_night") {
      const tone = state.npc.mina.introChoice === "flirt"
        ? "She taps the coffee lid twice, the same small signal from the first night you stayed to talk."
        : state.npc.mina.introChoice === "friendly"
          ? "She catches your eye the way she does across the counter, steady, waiting for you to go first."
          : "She recognizes the way you used to leave in a hurry, and waits to see whether tonight is different.";
      const history = state.flags.usedMinaWithoutConsent
        ? "She has not said a word to you since she found out whose name went to the officer."
        : state.flags.toldMinaTruth
          ? "She remembers every risk you named when she asked for the truth."
          : state.flags.minaDateNight
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
  // Mina-frequency targets; see STORY_BIBLE.md for the measured distribution.
  const STORY_BEATS_PER_DAY = 2;
  const CHAIN_BASE_CHANCE = 0.30;
  const CHAIN_PITY_BONUS = 0.16;
  const AMBIENT_BASE_CHANCE = 0.20;
  const AMBIENT_QUIET_BONUS = 0.16;
  const CLASSIFICATIONS = ["main_chapter", "character_intro", "character_followup", "relationship_scene", "threat", "opportunity", "callback", "ambient", "ending_setup"];

  const EVENT_CHAINS = {
    mina_spenard: { name: "The Night Owl", person: "mina" },
    eli_routes: { name: "Service Roads", person: "eli" },
    dre_note: { name: "Dre's Note", person: "dre" },
    curtis_pressure: { name: "Curtis's Attention", person: "curtis" },
    goodie_corner: { name: "The Wash & Go", person: "goodie" },
    household: { name: "The Spare Room", person: "household" },
  };

  function resolvedFlagName(id) { return `${id.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())}Resolved`; }
  function eventResolved(state, id) {
    if (id === "early_street") return !!state.flags.earlyThreatResolved;
    if (id === "mid") return !!state.flags.midThreatResolved;
    if (id === "dre_collector") return !!state.flags.dreCollectorThreatResolved;
    return !!state.flags[resolvedFlagName(id)];
  }
  const minaOpen = (state) => state.npc.mina.available !== false && state.npc.mina.status !== "gone";
  // Respect is the active numeric driver of Curtis's stage progression; pressure
  // no longer advances any Curtis stage (it remains a live secondary value that
  // still colors "aggressive"/"competitive" relationship labels elsewhere).
  // "Has Curtis noticed you at all" for the opening beat can still come from
  // other visible signals — Heat, robbery, a robbed dealer, district
  // influence — none of which are the pressure field itself.
  const rivalAttentionEarned = (state) => state.npc.curtis.attention > 0;

  const STORY_REGISTRY = [
    // --- The Night Owl -------------------------------------------------------
    { id: "mina_intro", chain: "mina_spenard", stage: 1, classification: "character_intro", trigger: "chain",
      requires: (s) => !!s.flags.nightOwlVisited && !s.npc.mina.met, area: "north_star_lot", earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "mina_shift_change", chain: "mina_spenard", stage: 2, classification: "character_followup", trigger: "chain",
      requires: (s) => !!s.flags.minaIntroResolved && minaOpen(s), area: "north_star_lot",
      earliest: { day: 2, slot: 1 }, latest: { day: 6 }, once: true, cooldown: 0, weight: 8, exit: (s) => !minaOpen(s) },
    { id: "mina_invitation", chain: "mina_spenard", stage: 3, classification: "relationship_scene", trigger: "chain",
      requires: (s) => !!s.flags.minaShiftChangeResolved && minaOpen(s) && s.npc.mina.trust >= 2
        && !s.flags.minaDateNight && !s.flags.minaSawGarage && !s.flags.minaInvitationClosed,
      area: "north_star_lot", earliest: { day: 3, slot: 1 }, latest: { day: 6 }, once: false, cooldown: 4, weight: 6, exit: (s) => !minaOpen(s) },
    { id: "mina_boundary", chain: "mina_spenard", stage: 4, classification: "main_chapter", trigger: "chain",
      requires: (s) => !!s.flags.minaShiftChangeResolved && minaOpen(s) && s.npc.mina.trust >= 1, area: "north_star_lot",
      earliest: { day: 4, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 8, exit: (s) => !minaOpen(s) },
    { id: "mina_sedan_night", chain: "mina_spenard", stage: 5, classification: "threat", trigger: "chain",
      requires: (s) => minaOpen(s) && s.npc.curtis.attention >= 6 && s.hustle.soldUnits >= 50 && s.npc.mina.trust >= 2, area: "north_star_lot",
      earliest: { day: 5, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 8, exit: (s) => !minaOpen(s) },
    { id: "mina_after", chain: "mina_spenard", stage: 6, classification: "callback", trigger: "chain",
      requires: (s) => !!s.flags.minaBoundaryResolved && (!!s.flags.minaSedanNightResolved || s.run.day >= checkpointDay(s)), area: "north_star_lot",
      earliest: { day: 6, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },

    // --- Service Roads -------------------------------------------------------
    { id: "eli_offer", chain: "eli_routes", stage: 1, classification: "character_intro", trigger: "chain",
      requires: (s) => s.base.controlled, area: null, earliest: { day: 1, slot: 3 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "eli_callback", chain: "eli_routes", stage: 2, classification: "callback", trigger: "chain",
      requires: (s) => !!s.flags.refusedEli && !s.flags.eliRejectedFinally, area: null,
      earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: (s) => !!s.flags.eliRejectedFinally },
    { id: "eli_missed_turn", chain: "eli_routes", stage: 2, classification: "callback", trigger: "chain",
      requires: (s) => !!s.flags.eliTestRouteResolved, area: null,
      earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "eli_service_map", chain: "eli_routes", stage: 3, classification: "opportunity", trigger: "chain",
      requires: (s) => !!s.flags.eliMissedTurnResolved || s.people.crew.eli.recruited, area: null,
      earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: null },
    { id: "eli_lieutenant_offer", chain: "eli_routes", stage: 4, classification: "opportunity", trigger: "chain",
      requires: (s) => eliPromotionAvailability(s).available, area: null,
      earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 7, exit: null },
    { id: "eli_last_run", chain: "eli_routes", stage: 5, classification: "ending_setup", trigger: "chain",
      requires: (s) => s.people.crew.eli.introduced && !s.flags.eliRejectedFinally, area: null,
      earliest: { day: 6, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "tone_jacksonville", chain: null, stage: null, classification: "threat", trigger: "chain",
      requires: (s) => s.run.day >= 7 && s.people.crew.tone.recruited && s.people.crew.tone.tier >= 2 && s.player.heat >= 10,
      area: null, earliest: { day: 7, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 10, exit: null },

    // --- Dre's Note ----------------------------------------------------------
    { id: "dre_terms", chain: "dre_note", stage: 1, classification: "main_chapter", trigger: "chain",
      requires: () => false, area: null, earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "dre_first_payment", chain: "dre_note", stage: 2, classification: "callback", trigger: "reactive",
      requires: (s) => s.lender.status === "active" && s.lender.paymentCount >= 1 && s.lender.balance > 0, area: null,
      earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "dre_due_day", chain: "dre_note", stage: 3, classification: "main_chapter", trigger: "chain",
      requires: (s) => s.lender.status === "active" && !!s.flags.dreTermsResolved && s.run.day >= s.lender.dueDay, area: null,
      earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "dre_warning", chain: "dre_note", stage: 3, classification: "threat", trigger: "chain",
      requires: (s) => s.lender.balance > 0 && s.run.day > s.lender.dueDay && !!s.flags.dreDueDayResolved, area: null,
      earliest: { day: 5, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: (s) => s.lender.balance <= 0 },
    { id: "dre_after_payoff", chain: "dre_note", stage: 4, classification: "opportunity", trigger: "reactive",
      requires: (s) => s.lender.afterPayoffOffer === "available", area: null,
      earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 10, exit: null },
    { id: "dre_collector", chain: "dre_note", stage: 4, classification: "threat", trigger: "chain", kind: "encounter",
      requires: (s) => s.lender.collectorTier >= 1, area: null,
      earliest: { day: 5, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: (s) => s.lender.balance <= 0 },
    { id: "dre_day7", chain: "dre_note", stage: 5, classification: "ending_setup", trigger: "chain",
      requires: (s) => s.lender.status === "active" && !!s.flags.dreTermsResolved && s.run.day >= checkpointDay(s), area: null,
      earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },

    // --- Curtis's Attention ----------------------------------------------------
    { id: "curtis_mark", chain: "curtis_pressure", stage: 1, classification: "threat", trigger: "chain",
      requires: (s) => rivalAttentionEarned(s), area: null, earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "early_street", chain: "curtis_pressure", stage: 2, classification: "threat", trigger: "chain", kind: "encounter",
      requires: (s) => !!s.flags.curtisMarkResolved, area: null, earliest: { day: 2, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "curtis_tax", chain: "curtis_pressure", stage: 3, classification: "main_chapter", trigger: "chain",
      requires: (s) => s.npc.curtis.attention >= 4, area: null,
      earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    // Respect is now the sole numeric driver of this stage — the migration
    // from the old pressure-OR-area.rival gate is complete. Legacy saves that
    // already resolved this beat under the old gate are migrated in
    // hydrateRun (respect is raised to this threshold), so they are not
    // re-locked out of content they already earned.
    { id: "curtis_cut", chain: "curtis_pressure", stage: 4, classification: "callback", trigger: "chain",
      requires: (s) => !!s.flags.curtisTaxResolved && s.npc.curtis.respect >= RESPECT_STAGE_THRESHOLDS.cut,
      area: null, earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: null },
    { id: "mid", chain: "curtis_pressure", stage: 5, classification: "threat", trigger: "chain", kind: "encounter",
      requires: (s) => !!s.flags.curtisTaxResolved, area: null,
      earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "curtis_day7", chain: "curtis_pressure", stage: 6, classification: "ending_setup", trigger: "chain",
      requires: (s) => !!s.flags.earlyThreatResolved && s.run.day >= checkpointDay(s), area: null,
      earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },

    // --- The Wash & Go -------------------------------------------------------
    { id: "goodie_corner_intro", chain: "goodie_corner", stage: 1, classification: "character_intro", trigger: "chain",
      requires: () => false, area: "north_star_lot", earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 7, exit: null },
    { id: "goodie_regular", chain: "goodie_corner", stage: 2, classification: "character_followup", trigger: "chain",
      requires: (s) => s.people.dealers.goodie.known && s.people.dealers.goodie.standing >= 2 && s.people.dealers.goodie.robbedCount === 0, area: "north_star_lot", earliest: { day: 2, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 7, exit: null },
    { id: "goodie_atlanta", chain: "goodie_corner", stage: 3, classification: "relationship_scene", trigger: "chain",
      requires: (s) => !!s.flags.goodieRegularResolved && s.people.dealers.goodie.standing >= 3 && s.people.dealers.goodie.robbedCount === 0, area: "north_star_lot", earliest: { day: 3, slot: 2 }, latest: null, once: true, cooldown: 0, weight: 6, exit: null },
    // Stage 2 is a branch: he comes back at you, or the person who vouched does.
    { id: "goodie_retaliation", chain: "goodie_corner", stage: 2, classification: "threat", trigger: "chain", kind: "encounter",
      requires: (s) => { const k = s.people.dealers?.goodie; return !!k && k.robbedCount > 0 && k.lastRobbedDay != null && s.run.day >= k.lastRobbedDay + 2; },
      area: null, earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "goodie_recognized", chain: "goodie_corner", stage: 2, classification: "callback", trigger: "chain",
      requires: (s) => { const k = s.people.dealers?.goodie; return !!k && k.robbedCount > 0 && k.lastTradedDay != null; },
      area: "north_star_lot", earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 7, exit: null },
    // --- The household ------------------------------------------------------
    { id: "yalonda_cooking", chain: "household", stage: 1, classification: "relationship_scene", trigger: "chain",
      requires: (s) => householdPresence(s) === "yalonda", area: HOME_DISTRICT_ID, earliest: { day: 1, slot: 0 }, latest: null, once: false, cooldown: 6, weight: 6, exit: null },
    { id: "juan_warehouse_story", chain: "household", stage: 1, classification: "relationship_scene", trigger: "chain",
      requires: (s) => householdPresence(s) === "juan", area: HOME_DISTRICT_ID, earliest: { day: 1, slot: 2 }, latest: null, once: true, cooldown: 0, weight: 7, exit: null },
    { id: "yalonda_warning", chain: "household", stage: 2, classification: "callback", trigger: "chain",
      requires: (s) => s.player.heat >= 2 && householdPresence(s) === "yalonda", area: HOME_DISTRICT_ID, earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 7, exit: null },
    { id: "juan_referral", chain: "household", stage: 2, classification: "opportunity", trigger: "chain",
      requires: (s) => s.phone.active && s.npc.juan.trust >= 1 && !s.jobs.hired.some((id) => id !== "day_labor"), area: HOME_DISTRICT_ID, earliest: { day: 2, slot: 2 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "yalonda_flirt", chain: "household", stage: 3, classification: "relationship_scene", trigger: "chain",
      requires: (s) => s.npc.yalonda.trust >= 3 && s.npc.yalonda.rentPaidWeeks >= 1 && s.player.heat <= 1
        && s.people.household.lastContrabandDay !== s.run.day && householdPresence(s) === "yalonda",
      area: HOME_DISTRICT_ID, earliest: { day: 7, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },

    // Social discovery routes. The link stays invisible until one of these lands.
    { id: "discover_907_juan", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: (s) => !s.knowledge.knows907List && s.phone.active && s.npc.juan.trust >= 1 && s.run.slot >= 2, area: HOME_DISTRICT_ID, earliest: { day: 1, slot: 2 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "discover_907_work", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: (s) => !s.knowledge.knows907List && s.phone.active && s.onboarding.shiftsWorked >= 3, area: null, earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "discover_907_night_owl", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: (s) => !s.knowledge.knows907List && !!s.flags.nightOwlVisited, area: HOME_DISTRICT_ID, earliest: { day: 1, slot: 2 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "discover_907_wander", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: (s) => !s.knowledge.knows907List && s.world.locations.explorationCount > 0, area: HOME_DISTRICT_ID, earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 7, exit: null },

    // --- Standalone beats carried over from Alpha v0.6 -----------------------
    { id: "pherris_offer", chain: null, stage: null, classification: "character_intro", trigger: "ambient",
      requires: () => true, area: "downtown", earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 5, exit: null },
    { id: "tone_offer", chain: null, stage: null, classification: "character_intro", trigger: "ambient",
      requires: (s) => s.base.controlled, area: "north_star_lot", earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 5, exit: null },
    { id: "courier", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: () => true, area: "airport_industrial", earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 5, exit: null },
    { id: "base_watch", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: (s) => baseValue(s) > 0, area: "north_star_lot", earliest: { day: 5, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: null },
    { id: "crew_crisis", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: (s) => recruitedCrew(s).length > 0, area: null, earliest: { day: 5, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: null },
    { id: "buyer_hurry", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: (s) => s.npc.mina.met, area: "north_star_lot", earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 4, exit: null },
    { id: "checkpoint", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: (s) => s.player.heat >= 5 || AREA_BY_ID[s.world.currentNeighborhoodId].police >= 3, area: null,
      earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 4, exit: null },
    { id: "rough_night", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: (s) => AREA_BY_ID[s.world.currentNeighborhoodId].risk >= 3 || s.player.health < 65, area: null,
      earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 4, exit: null },
    { id: "spenard_block_scouted", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: (s) => eliLieutenantActive(s) && !s.flags.spenardBlocksRevealed, area: "north_star_lot",
      earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 7, exit: null },
    { id: "curtis_respect_notice", chain: null, stage: null, classification: "ambient", trigger: "ambient",
      requires: (s) => s.npc.curtis.respect >= RESPECT_STAGE_THRESHOLDS.tax && controlledBlockCount(s) > 0, area: null,
      earliest: { day: 1, slot: 0 }, latest: null, once: false, cooldown: 6, weight: 5, exit: null },
    { id: "soldier_raid_aftermath", chain: null, stage: null, classification: "ambient", trigger: "ambient",
      requires: (s) => Object.values(s.world.territoryBlocks).some((block) => block.lastRaidDay === s.run.day - 1), area: null,
      earliest: { day: 1, slot: 0 }, latest: null, once: false, cooldown: 2, weight: 6, exit: null },

    // --- Alpha v0.7 one-off street events (repeatable, cooldown-gated) --------
    { id: "wet_bricks", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: (s) => s.player.cash >= 70, area: "airport_industrial", earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
    { id: "door_knock", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: (s) => s.base.controlled, area: "north_star_lot", earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
    { id: "stranded_wagon", chain: null, stage: null, classification: "ambient", trigger: "ambient",
      requires: () => true, area: null, earliest: { day: 1, slot: 2 }, latest: null, once: false, cooldown: 8, weight: 5, exit: null },
    { id: "found_phone", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: () => true, area: "downtown", earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
    { id: "careful_customer", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: () => true, area: null, earliest: { day: 1, slot: 2 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
    { id: "dock_shift", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: () => true, area: null, earliest: { day: 1, slot: 2 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
    { id: "garage_furnace", chain: null, stage: null, classification: "ambient", trigger: "ambient",
      requires: (s) => s.base.controlled, area: "north_star_lot", earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 3, exit: null },
    { id: "sedan_rumor", chain: null, stage: null, classification: "ambient", trigger: "ambient",
      requires: (s) => s.npc.curtis.pressure >= 2, area: null, earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 5, exit: null },
    { id: "midtown_lights", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: () => true, area: null, earliest: { day: 1, slot: 2 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
  ];
  const STORY_BY_ID = Object.fromEntries(STORY_REGISTRY.map((item) => [item.id, item]));

  function storyCandidates(state) {
    const absolute = slotNumber(state.run.day, state.run.slot);
    const areaId = state.world.currentNeighborhoodId;
    return STORY_REGISTRY.filter((item) => {
      if (state.run.phase === "week_zero" && (item.chain === "dre_note" || item.chain === "curtis_pressure" || item.classification === "threat" || item.classification === "ending_setup")) return false;
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
    const weights = candidates.map((item) => Math.max(0.01, item.weight) * streetReadWeightMultiplier(state, item));
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
    else setPendingEvent(state, withStreetSmartChoice(state, activeEvent(descriptor.id, state), descriptor));
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
    // belong somewhere - which is how Mina's arc got crowded out of runs that
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
    state.npc.curtis.attention = clamp(state.npc.curtis.attention + (effect.rivalPressure || 0), 0, 8);
    state.npc.curtis.pressure = state.npc.curtis.attention;
    state.npc.curtis.respect += effect.rivalRespect || 0;
    state.lender.trust += effect.lenderTrust || 0;
    state.npc.dre.trust = clamp(state.lender.trust, 0, 3);
    state.npc.mina.trust += effect.minaTrust || 0;
    if (effect.curtisDecision) applyCurtisDecision(state, effect.curtisDecision);
    if (effect.npcTrust && state.npc[effect.npcTrust.id]) state.npc[effect.npcTrust.id].trust += effect.npcTrust.delta || 0;
    if (effect.acceptDreLoan && state.lender.status === "unoffered") {
      state.lender.status = "active";
      state.lender.principal = 1000;
      state.lender.balance = 1200;
      state.lender.dueDay = state.run.checkpointDay;
      addDirtyCash(state, 1000);
      state.npc.dre.known = true;
      state.npc.dre.loansTaken += 1;
    }
    if (effect.declineDreLoan && state.lender.status === "unoffered") {
      state.lender.status = "declined";
      state.lender.principal = 0;
      state.lender.balance = 0;
      state.lender.dueDay = null;
      state.npc.dre.known = true;
    }
    if (effect.discoverGambling) {
      const firstDiscovery = !state.world.locations.gamblingKnown;
      state.world.locations.gamblingKnown = true;
      if (!state.world.locations.discoveries.includes("informal_game")) state.world.locations.discoveries.push("informal_game");
      if (firstDiscovery) queueUnlock(state, "gambling");
    }
    if (effect.discover907List) { state.knowledge.knows907List = true; state.nineZeroSevenList.known = true; }
    if (effect.discoverGym) state.discovered.spenardGym = true;
    if (effect.shareJuanInfo && !state.npc.juan.infoShared.includes(effect.shareJuanInfo)) state.npc.juan.infoShared.push(effect.shareJuanInfo);
    if (effect.hireJobId && SPENARD_JOB_BY_ID[effect.hireJobId] && !state.jobs.hired.includes(effect.hireJobId)) {
      if (!state.jobs.discovered.includes(effect.hireJobId)) state.jobs.discovered.push(effect.hireJobId);
      if (!state.jobs.offers.includes(effect.hireJobId)) state.jobs.offers.push(effect.hireJobId);
    }
    if (effect.discoverJobId && SPENARD_JOB_BY_ID[effect.discoverJobId]) discoverJob(state, SPENARD_JOB_BY_ID[effect.discoverJobId]);
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
    if (effect.unlockPlug) {
      unlockPlug(state, effect.unlockPlug);
      if (effect.unlockPlug === "goodie" && !state.world.locations.discoveries.includes("goodie_supplier")) state.world.locations.discoveries.push("goodie_supplier");
    }
    if (effect.boostTargetId && BOOST_TARGET_BY_ID[effect.boostTargetId]) resolveBoostAttempt(state, BOOST_TARGET_BY_ID[effect.boostTargetId], random, effect.boostOptions);
    if (effect.minaJobAtRisk) state.npc.mina.cleanLifeAtRisk = true;
    if (effect.minaDeparts) { state.npc.mina.available = false; state.npc.mina.status = "gone"; state.npc.mina.outcome = "mina_gone"; }
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
    if (effect.promoteEliLieutenant) {
      const eli = state.people.crew.eli;
      eli.lieutenantStage = "operations_lieutenant";
      let effectiveness = 0;
      if (state.flags.eliJudgmentTrusted) effectiveness += 1;
      if (state.flags.eliOwnsShare || state.flags.eliPromisedFuture) effectiveness += 1;
      if (state.flags.eliDocked || state.flags.eliToldNoFuture) effectiveness -= 1;
      eli.lieutenantEffectiveness = clamp(effectiveness, 0, 3);
      eli.operationPolicy = "balanced";
    }
    if (effect.secondLoan) {
      addDirtyCash(state, 1200);
      state.lender.principal = 1200;
      state.lender.balance = 1380;
      state.lender.dueDay = Math.min(state.run.day + 5, checkpointDay(state));
      state.lender.status = "active";
      state.lender.afterPayoffOffer = "accepted";
      state.flags.acceptedSecondNote = true;
      state.npc.dre.loansTaken += 1;
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
    state.npc.curtis.pressure = state.npc.curtis.attention;
    state.lender.relationship = relationshipForLender(state.lender, state.run.day);
    state.npc.curtis.relationship = relationshipForRival(state.npc.curtis);
    state.npc.mina.status = minaStatus(state.npc.mina);
  }

  function endingLabel(id) {
    return ({
      one_good_run: "One Good Run", quiet_operation: "Quiet Operation", still_owing: "Still Owing",
      mina_escape: "Two Tickets South", mina_clear: "She Gets the Monday Interview", mina_gone: "Gone Before You Were",
      clean_exit: "Clean Exit", curtis_partner: "Curtis's Partner",
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
    const minaIntact = state.npc.mina.trust >= 3 && !state.npc.mina.usedWithoutConsent && state.npc.mina.available !== false && !state.flags.seriousViolence;
    if (plan === "escape" && minaIntact) return "mina_escape";
    if (plan === "escape") return "clean_exit";
    if (state.npc.mina.available === false && state.npc.mina.chainStage >= 6) return "mina_gone";
    if (minaIntact && !state.npc.mina.cleanLifeAtRisk && state.npc.mina.chainStage >= 6) return "mina_clear";
    if (plan === "partner" && state.npc.curtis.respect >= 2) return "curtis_partner";
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
    state.npc.yalonda.trust -= Math.max(1, count || 1);
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
    householdWarning(state, repeatedWeapon ? 2 : 1, repeatedWeapon ? "Juan finds the weapon after the first warning. Yalonda says the house cannot survive another night like this." : "Yalonda finds what you hid. The contraband leaves the house, and the warning does not.", false);
  }

  function encounterActivityContext(state, context, oldSlot, visit) {
    const reason = context.reason;
    let activity = null;
    if (reason === "END_MARKET" && (visit?.grossSell || 0) > 0) activity = "selling";
    else if (reason === "ROB" || reason === "ROB_DEALER") activity = "robbery";
    else if (["TRAVEL", "BUS_TRAVEL", "WALK_HOME"].includes(reason) && cargoUsed(state) > 0) activity = "movement";
    else if (state.world.currentNeighborhoodId === "airport_industrial" && oldSlot >= 2
      && !["LAY_LOW", "SLEEP_HOME", "HEAL", "HEAL_AT_BASE"].includes(reason)) activity = "late_activity";
    return {
      activity, areaId: state.world.currentNeighborhoodId, slot: oldSlot,
      cargoValue: inventoryValue(state), visibleCash: state.player.cash,
      grossSell: visit?.grossSell || 0, cashDelta: context.cashDelta || 0,
    };
  }

  function advanceRun(inputState, context) {
    const beforeFeatures = featureAvailability(inputState);
    const state = copyState(inputState);
    if (state.run.status !== "playing" || state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult || state.run.dayEndPending) return state;
    reconcileCash(state);
    const random = makeRandom(state.run.rngState);
    const oldDay = state.run.day, oldSlot = state.run.slot;
    const completedVisit = { ...(state.run.currentVisit || {}) };
    const energyCost = actionEnergyCost(state, context.reason);
    if (state.player.energy < energyCost) return inputState;
    state.player.energy -= energyCost;
    if (state.run.overtimeArmed) {
      state.run.overtimeArmed = false;
      state.run.overtimeUsedDay = oldDay;
    }
    // Every slot-consuming action funnels through here, which makes this the one
    // honest place to record which part of the day gets spent on what. Logged
    // before the clock moves so the entry is stamped with the day it happened.
    const activity = STREET_READ_ACTIVITY[context.reason];
    if (activity) addStreetReadEntry(state, "routine", `${SLOTS[oldSlot].toLowerCase()}:${activity}`);
    closeVisit(state, context.reason);
    recordDailyAction(state, context);
    const timeCost = clamp(Math.floor(Number(context.timeCost) || 1), 1, SLOTS.length);
    const reachesDayEnd = oldSlot + timeCost >= SLOTS.length;
    state.run.slot = reachesDayEnd ? SLOTS.length - 1 : oldSlot + timeCost;
    restorePhoneIfReady(state, slotNumber(oldDay, oldSlot));
    resolveJobApplications(state);
    expireEffects(state);
    resolveCrewAssignments(state, random);
    resolveSoldierOperations(state, random, false);
    applyPressure(state, context, false);
    if (state.run.phase === "week_zero" && weekZeroProgress(state).ready) startPressurePhase(state);
    if (state.run.phase === "pressure" && dreIntroductionEligible(state) && !state.run.pendingEvent && !state.run.pendingEncounter) {
      state.npc.dre.known = true;
      state.run.pendingEvent = activeEvent("dre_terms", state);
    }
    maybeStreetReadIntel(state, random);
    state.stats.pipelineAdvances += 1;
    state.stats.decisions += 1;
    announceFeatureUnlocks(state, beforeFeatures);
    if (state.run.status !== "playing") {
      state.run.rngState = random.state;
      return state;
    }
    if (state.player.health <= 0 || state.player.heat >= 15) endRun(state);
    else {
      const encounterContext = encounterActivityContext(state, context, oldSlot, completedVisit);
      const chosenRisk = ["ROB", "ROB_DEALER", "TAKEOVER", "GAMBLE", "SHOPLIFT", "BOOST"].includes(context.reason);
      const triggered = (state.run.phase === "pressure" || chosenRisk) ? EncounterSystem?.checkEncounterTrigger(state, oldDay, oldSlot, { ...encounterContext, rng: random }) : null;
      if (triggered) {
        triggered.choices = EncounterSystem.getEligibleChoices(triggered, state).map((item) => item.id);
        state.run.pendingEncounter = triggered;
      } else if (!context.suppressStory && !reachesDayEnd) scheduleStory(state, context, random);
    }
    if (reachesDayEnd && state.run.status === "playing") state.run.dayEndPending = true;
    state.run.rngState = random.state;
    return state;
  }

  function settleCurtisNight(state) {
    const curtis = state.npc.curtis;
    if (curtis.taxActive) {
      const gross = state.hustle.revenueHistory.filter((entry) => entry.day === state.run.day).reduce((sum, entry) => sum + entry.amount, 0);
      const tax = Math.min(state.player.dirtyCash, Math.round(gross * 0.15));
      if (tax > 0) {
        spendDirtyCash(state, tax);
        logEntry(state, `Curtis's runner collects $${tax}, fifteen percent of tonight's illegal gross.`, "warn");
      }
    }
    const friendshipMature = curtis.friendship === "accepted" && curtis.friendshipDay != null && state.run.day >= curtis.friendshipDay + 2;
    if (!curtis.betrayed && friendshipMature && curtis.attention >= 7 && state.run.day > curtis.protectionUntilDay) {
      const deshawn = state.people.crew.deshawn;
      if (deshawn?.recruited && deshawn.tier >= 3 && deshawn.loyalty >= 5) {
        curtis.betrayed = true;
        logEntry(state, "Deshawn catches Curtis's move before it reaches your cash or product.", "good");
      } else if (state.npc.simone.leverage > 0) {
        curtis.betrayed = true;
        state.npc.simone.truce = true;
        logEntry(state, "Simone spends her leverage and turns Curtis's betrayal into a truce.", "good");
      } else {
        const cashLost = Math.round(state.player.dirtyCash * 0.30);
        spendDirtyCash(state, cashLost);
        let unitsLost = 0;
        for (const product of PRODUCTS) {
          const held = state.player.inventory[product.id];
          const lost = Math.floor(held.qty * 0.25);
          held.qty -= lost;
          unitsLost += lost;
          if (!held.qty) held.avgCost = 0;
        }
        state.player.heat = clamp(state.player.heat + 2, 0, 15);
        curtis.betrayed = true;
        logEntry(state, `Curtis's friendship closes like a trap: $${cashLost} and ${unitsLost} carried units disappear. Heat climbs by 2.`, "bad");
      }
    }
  }
  function resolveSharkLoans(state) {
    for (const loan of state.hustle.shark.loans) {
      if (!["active", "extended"].includes(loan.status) || state.run.day < loan.dueDay) continue;
      const borrower = SHARK_BORROWERS.find((item) => item.id === loan.borrowerId);
      const probability = clamp(borrower.risk + (loan.amount >= 500 ? 0.18 : loan.amount >= 250 ? 0.08 : 0) + (loan.term === 2 ? 0.12 : loan.term === 4 ? 0.04 : -0.04) - normalizedAttributes(state).insight * 0.025 - (state.npc.dre.trust >= 3 ? 0.08 : 0), 0.03, 0.82);
      const roll = (stringHash(`${state.run.seed}:shark:${loan.id}:${loan.dueDay}`) % 10000) / 10000;
      if (roll < probability) {
        loan.status = "defaulted";
        logEntry(state, `${borrower.name} misses the Shark deadline. The note needs a decision.`, "bad");
      } else {
        const interest = Math.round(loan.amount * SHARK_TERMS[loan.term]);
        const dreCut = Math.round(interest * 0.12);
        const returned = loan.amount + interest - dreCut;
        addDirtyCash(state, returned);
        loan.status = "repaid";
        loan.outcome = { interest, dreCut, returned };
        state.hustle.shark.history.push({ ...loan });
        logEntry(state, `${borrower.name} returns $${returned} after Dre's $${dreCut} share of the interest.`, "good");
      }
    }
  }
  function resolveCrewTracks(state) {
    const pherris = state.people.crew.pherris;
    if (pherris?.recruited && pherris.tier >= 1) {
      const product = PRODUCTS[stringHash(`${state.run.seed}:pherris-rumor:${state.run.day}`) % PRODUCTS.length];
      state.effects.rumors.push({ id: `pherris_${state.run.day}`, areaId: "downtown", productId: product.id, reliable: true, text: `Pherris confirms Downtown demand for ${product.name}.`, expiresAt: slotNumber(state.run.day + 1, 3) });
    }
    if (pherris?.recruited && pherris.tier >= 3 && pherris.networkActive) {
      const income = 75 + (stringHash(`${state.run.seed}:pherris:${state.run.day}`) % 51);
      addDirtyCash(state, income);
      logEntry(state, `Pherris's network seeds $${income} across the managed blocks.`, "good");
    }
    const tone = state.people.crew.tone;
    const toneManaging = tone?.recruited && tone.tier >= 3 && (tone.assignment || Object.values(state.world.territoryBlocks).some((block) => block.managerId === "tone"));
    if (toneManaging) {
      state.player.heat = clamp(state.player.heat + 1, 0, 15);
      logEntry(state, "Tone's active block management holds ground and adds 1 Heat.", "warn");
    }
    const quietManagers = Object.values(state.world.territoryBlocks).filter((block) => ["pherris", "deshawn"].includes(block.managerId));
    if (quietManagers.some((block) => block.managerId === "pherris") || quietManagers.some((block) => block.managerId === "deshawn" && state.people.crew.deshawn.tier >= 3)) {
      state.player.heat = clamp(state.player.heat - 1, 0, 15);
      logEntry(state, "Social management cools the managed-block Heat by 1.", "good");
    }
  }

  function confirmDayEnd(inputState) {
    if (!inputState.run.dayEndPending || inputState.run.status !== "playing" || inputState.run.pendingEvent || inputState.run.pendingEncounter || inputState.run.pendingOperationResult) return inputState;
    const state = copyState(inputState);
    const random = makeRandom(state.run.rngState);
    const oldDay = state.run.day;
    state.run.dayEndPending = false;
    state.run.overtimeArmed = false;
    state.run.slot = 3;
    evaluateStreetIdentity(state, true);
    recalculateStreetRead(state);
    checkHomeContraband(state, random);
    resolveSoldierOperations(state, random, true);
    applyPressure(state, { reason: "END_DAY" }, true);
    settleCurtisNight(state);
    resolveSharkLoans(state);
    resolveCrewTracks(state);
    evolveMarkets(state, random);
    if (state.run.phase === "pressure" && oldDay >= checkpointDay(state)) {
      state.run.dailyActions = [];
      endRun(state);
      state.run.rngState = random.state;
      return state;
    }
    state.run.day = oldDay + 1;
    state.run.slot = 0;
    state.player.energy = MAX_ENERGY;
    restorePhoneIfReady(state, slotNumber(oldDay, 3));
    resolveJobApplications(state);
    state.nineZeroSevenList.known = !!state.knowledge.knows907List;
    state.run.dailyActions = [];
    if (state.player.health <= 0 || state.player.heat >= 15) endRun(state);
    else scheduleStory(state, { reason: "END_DAY" }, random);
    state.run.rngState = random.state;
    return state;
  }

  function healthModifier(health) { return health > 75 ? 0.05 : health < 40 ? -0.12 : 0; }
  function freeCargoRatio(state) { return clamp((cargoCapacity(state) - cargoUsed(state)) / Math.max(1, cargoCapacity(state)), 0, 1); }
  function encounterChoices(state) {
    const encounter = state.run.pendingEncounter;
    if (!encounter) return [];
    if (encounter.engine === "consequence" && encounter.resolved) return [{ id: "continue", label: "Continue", description: "Return to the run." }];
    if (encounter.engine === "consequence") return EncounterSystem.getEligibleChoices(encounter, state);
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
    if (encounter.id === "mina_sedan_night" && state.npc.mina.met) choices.push({ id: "call_mina", label: "Signal Mina", description: "Trust Mina to trigger the Night Owl alarm. This spends some of the trust between you." });
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
    state.encounterLog = state.encounterLog || { resolved: [], activeFlags: {}, randomKills: 0, randomFights: 0 };
    state.encounterLog.resolved.push({ id: encounter.id, type: encounter.type || "authored", day: state.run.day, slot: state.run.slot, choicesMade: [result], outcome: result, loot: null });
    state.encounterLog.activeFlags[`${encounter.id}Resolved`] = true;
    state.run.pendingEncounter = null;
    state.run.encounterCount += 1;
    state.flags[`${encounter.id}ThreatResolved`] = true;
    if (encounter.id === "early_street") state.flags.earlyThreatResolved = true;
    if (encounter.id === "mina_sedan_night") {
      state.flags.minaSedanNightResolved = true;
      state.npc.mina.chainStage = Math.max(state.npc.mina.chainStage || 0, 5);
      state.npc.mina.outcomes.push({ stage: 5, id: "mina_sedan_night", choice: result, day: state.run.day });
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
    if (inputState.run.pendingEncounter?.engine === "consequence") {
      if (inputState.run.pendingEncounter.resolved && action.choiceId === "continue") {
        const state = copyState(inputState);
        const finishAfter = !!state.run.pendingEncounter.finishAfter;
        state.run.pendingEncounter = null;
        if (finishAfter) endRun(state);
        return state;
      }
      const random = makeRandom(inputState.run.rngState);
      const state = EncounterSystem.resolveEncounterChoice(inputState.run.pendingEncounter, action.choiceId, inputState, random);
      if (state === inputState) return inputState;
      state.run.rngState = random.state;
      if (state.run.pendingEncounter?.resolved) {
        const choice = action.choiceId === "draw" ? "fight" : ["fight", "run", "talk", "pay"].includes(action.choiceId) ? action.choiceId : "other";
        state.stats.encounterChoices[choice] += 1;
        if (["fight", "draw"].includes(action.choiceId)) recordBehavior(state, "stickup", action.choiceId === "draw" ? 2 : 1, `encounter:${state.run.pendingEncounter.id}`, "confrontation");
        else if (["talk", "call_crew", "use_relationship"].includes(action.choiceId)) recordBehavior(state, "connector", 1, `encounter:${state.run.pendingEncounter.id}`, "relationship");
        logEntry(state, state.run.pendingEncounter.result?.prose || "The confrontation ends and the run keeps moving.", ["won", "escaped", "talked", "crew_win", "relationship"].includes(state.run.pendingEncounter.result?.outcome) ? "good" : "warn");
      }
      state.stats.highestHeat = Math.max(state.stats.highestHeat, state.player.heat);
      if (state.player.health <= 0 || state.player.heat >= 15) endRun(state);
      reconcileCash(state);
      return state;
    }
    const state = copyState(inputState), encounter = state.run.pendingEncounter;
    if (!encounter) return inputState;
    reconcileCash(state);
    const available = encounterChoices(state).map((item) => item.id);
    if (!available.includes(action.choiceId)) return inputState;
    const random = makeRandom(state.run.rngState);
    const choice = action.choiceId;
    if (["fight", "draw", "intimidate"].includes(choice)) recordBehavior(state, "stickup", choice === "draw" ? 2 : 1, `encounter:${encounter.id}`, "confrontation");
    else if (["talk", "call_tone", "call_mina"].includes(choice)) recordBehavior(state, "connector", 1, `encounter:${encounter.id}`, "relationship");
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
    } else if (choice === "call_mina") {
      state.npc.mina.trust -= 1;
      state.player.heat = clamp(state.player.heat + 1, 0, 15);
      finishEncounter(state, "escape", "Mina hits the Mini-Mart alarm. The collector runs before the patrol car reaches the lot.");
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
      const chance = clamp(0.38 + intelligenceRating(state) * 0.1 + state.npc.curtis.respect * 0.03 - encounter.guard, 0.15, 0.9);
      if (random.next() < chance) finishEncounter(state, "talk", "You name the cameras, exits, and people they failed to count. Their threat collapses under its own cost.");
      else failEncounterStep(state, random, "The calculation");
    } else if (choice === "talk") {
      const influence = state.world.influence[state.world.currentNeighborhoodId] * 0.04;
      const relationship = encounter.id === "mid" ? state.npc.curtis.respect * 0.035 : encounter.id === "mina_sedan_night" ? state.npc.mina.trust * 0.02 : 0;
      const chance = clamp(0.28 + charismaRating(state) * 0.08 + influence + relationship - encounter.guard, 0.10, 0.90);
      if (random.next() < chance) {
        if (encounter.id === "mid") state.npc.curtis.respect += 1;
        finishEncounter(state, "talk", "You name the people and consequences they forgot to count. The lane opens without anybody reaching for a weapon.");
      } else failEncounterStep(state, random, "The explanation");
    } else if (choice === "run") {
      const gearBonus = GEAR_BY_ID[state.player.gear.equipped.utility]?.escape || 0;
      const chance = clamp(0.24 + intelligenceRating(state) * 0.09 + gearBonus + 0.18 * freeCargoRatio(state) + healthModifier(state.player.health) - encounter.pursuit, 0.10, 0.90);
      if (random.next() < chance) {
        const lost = encounter.id === "mina_sedan_night" || encounter.id === "early_street" ? null : loseInventory(state, 1);
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
          state.npc.curtis.respect += 1;
          influenceChange(state, state.world.currentNeighborhoodId, 1);
          if (encounter.id === "dre_collector") {
            state.lender.collectorsKilled += 1;
            state.lender.interestMultiplier = Math.min(DRE_COLLECTOR_INTEREST_CAP, state.lender.interestMultiplier + DRE_COLLECTOR_KILL_INTEREST_BUMP);
          }
          finishEncounter(state, "win", firearm ? "The shot ends the argument and starts three new ones across the neighborhood." : "You stay on your feet after the other side cannot. Word moves before you do.");
        } else {
          encounter.feedback = `${weapon?.name || "Your hands"} lands for ${damage}. ${encounter.enemyHealth} resolve remains on the other side.`;
          failEncounterStep(state, random, "The counterattack");
        }
      } else failEncounterStep(state, random, firearm ? "The shot" : "The swing");
    }
    state.npc.mina.status = minaStatus(state.npc.mina);
    state.run.rngState = random.state;
    reconcileCash(state);
    return state;
  }

  function removeEquippedGear(state, slot) {
    const gearId = state.player.gear.equipped[slot];
    if (!gearId) return null;
    state.player.gear.equipped[slot] = null;
    state.player.gear.owned = state.player.gear.owned.filter((id) => id !== gearId);
    return GEAR_BY_ID[gearId] || null;
  }

  function executeRob(inputState) {
    const availability = robAvailability(inputState);
    if (!availability.available) return inputState;
    const state = copyState(inputState);
    reconcileCash(state);
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
      state.npc.curtis.pressure = clamp(state.npc.curtis.pressure + Math.min(3, attemptNumber), 0, 15);
      state.stats.robbery.successes += 1;
      addStreetReadEntry(state, "risk", `rob:${state.world.currentNeighborhoodId}`);
      state.stats.robbery.totalPayout += payout;
      state.stats.robbery.success = true;
      state.stats.robbery.payout = state.stats.robbery.totalPayout;
      result = {
        kind: "robbery", tone: "good", title: "The Rob Pays",
        summary: `A contractor leaves a cash envelope in an idling truck off the service road. You clear $${payout}, but the driver and nearby cameras get a useful description.`,
        effects: [`+$${payout} cash`, `+${addedHeat} Heat`, `+${Math.min(3, attemptNumber)} Curtis pressure`, `Attempt ${attemptNumber} this week`],
      };
      if (!state.rob.visible) { state.rob.visible = true; queueUnlock(state, "rob"); }
    } else {
      const damage = random.int(10 + Math.min(6, attemptNumber - 1), 17 + Math.min(8, attemptNumber - 1));
      const addedHeat = Math.min(5, 3 + Math.floor((attemptNumber - 1) / 2));
      state.player.health = clamp(state.player.health - damage, 0, 100);
      state.player.heat = clamp(state.player.heat + addedHeat, 0, 15);
      state.npc.curtis.pressure = clamp(state.npc.curtis.pressure + Math.min(4, attemptNumber + 1), 0, 15);
      state.stats.robbery.failures += 1;
      state.stats.robbery.success = state.stats.robbery.successes > 0;
      result = {
        kind: "robbery", tone: "bad", title: "The Rob Falls Apart",
        summary: "The truck is empty and the driver returns with help. You get away hurt and recognized, but another attempt can open on a later day.",
        effects: [`-${damage} Health`, `+${addedHeat} Heat`, `+${Math.min(4, attemptNumber + 1)} Curtis pressure`, "$0 payout", `Attempt ${attemptNumber} this week`],
      };
    }
    state.stats.majorDecisions.push(`Rob ${attemptNumber}: ${success ? "success" : "failure"}`);
    recordBehavior(state, "stickup", 2, `rob:${state.run.day}:${attemptNumber}`, "rob");
    state.run.rngState = random.state;
    logEntry(state, result.summary, result.tone);
    const advanced = advanceRun(state, { reason: "ROB", suppressStory: true });
    if (advanced.run.status === "playing") advanced.run.pendingOperationResult = result;
    return advanced;
  }

  function executeDealerRobbery(inputState, dealerId) {
    const actions = dealerActions(inputState, dealerId);
    if (!actions.rob.available) return inputState;
    const definition = DEALER_BY_ID[dealerId];
    const first = definition.name.split(" ")[0];
    const state = copyState(inputState);
    reconcileCash(state);
    const record = state.people.dealers[dealerId];
    const random = makeRandom(state.run.rngState);
    const success = random.next() < actions.rob.chance;
    record.robbedCount += success ? 1 : 0;
    record.lastRobbedDay = state.run.day;
    state.npc.curtis.pressure = clamp(state.npc.curtis.pressure + 1, 0, 15);
    const effects = [];
    let result;

    if (success) {
      const payout = 90 + state.run.day * 12 + random.int(0, 60);
      const availableProducts = definition.products.filter((productId) => !!unlockedPlugForProduct(state, productId));
      const productId = random.pick(availableProducts);
      if (!productId) return inputState;
      const units = random.int(2, 4);
      state.player.cash += payout;
      addStreetReadEntry(state, "risk", `robbery:${state.world.currentNeighborhoodId}`);
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

    const robbedPlug = plugRecord(state, dealerId);
    if (robbedPlug) {
      robbedPlug.standing = Math.min(robbedPlug.standing, record.standing);
      syncPlugProductAccess(state, dealerId, false);
    }

    if (state.npc.mina.chainStage >= 2 && state.npc.mina.trust >= 1 && state.npc.mina.available !== false) {
      state.npc.mina.trust -= 1;
      logEntry(state, "Mina works two blocks from the Wash & Go. She hears about it before the end of her shift.", "warn");
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
    reconcileCash(state);
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
    addStreetReadEntry(state, "risk", `contact_route:${state.world.currentNeighborhoodId}`);
    addStreetReadEntry(state, "social", "eli:business");
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
    reconcileCash(state);
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
      rounds.push({ round, attackRoll, defenseRoll, attackTotal, defenseTotal, winner: attackerWon ? "player" : "curtis" });
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
      addStreetReadEntry(state, "risk", `takeover:${areaId}`);
      state.world.territories[areaId].owner = "player";
      state.world.territories[areaId].capturedDay = state.run.day;
      state.world.influence[areaId] = 4;
      state.npc.curtis.pressure = clamp(state.npc.curtis.pressure - 2, 0, 15);
      if (areaId === "downtown") state.world.productAccess.cocaine = true;
      if (areaId === "airport_industrial") state.world.productAccess.meth = true;
      title = `${AREA_BY_ID[areaId].name} Changes Hands`;
      summary = `Your crew wins ${attackerWins}–${defenderWins}. Curtis's people leave the block, and the neighborhood starts paying your operation.`;
      effects.push("Influence set to Controlled", `+$${definition.dailyIncome} after each Night`, "4% better buying and selling", definition.special);
    } else {
      state.stats.takeovers.losses += 1;
      state.player.heat = clamp(state.player.heat + 3, 0, 15);
      state.npc.curtis.pressure = clamp(state.npc.curtis.pressure + 2, 0, 15);
      effects.push("+3 Heat", "+2 Curtis pressure");
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
      summary = `Curtis's crew wins ${defenderWins}–${attackerWins}. Your operation pays the cost, loses a person, and leaves the neighborhood under Curtis.`;
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

  function plugIntroductionEvent(plugId) {
    const plug = PLUG_BY_ID[plugId];
    const copy = {
      goodie: { title: "Goodie at the Wash & Go", who: "Goodie", where: "Wash & Go, Spenard", description: "Guy outside the Wash & Go catches your eye and asks if you're looking. He's got weed, nothing crazy. Prices are mid. Take it or leave it." },
      tasha: { title: "Goodie's Introduction", who: "Tasha", where: "Spenard", description: "Goodie sends a number. Tasha answers, quotes pills and lean, and names the most she'll move at once. Cash only. No small talk." },
      malik: { title: "Tasha's Introduction", who: "Malik", where: "Downtown", description: "Tasha sends Malik's number. He quotes coke and molly, says he has weight, and asks what quantity you can pay for today." },
    }[plugId];
    if (!plug || !copy) return null;
    return {
      id: plugId === "goodie" ? "goodie_corner_intro" : `${plugId}_plug_intro`,
      title: copy.title, who: copy.who, where: copy.where, stakes: "Open this supply line or leave it alone.", description: copy.description,
      choices: [
        { label: "Accept", effect: { unlockPlug: plugId }, preview: `Unlock ${plug.products.filter((product) => product.standing === 0).map((product) => PRODUCT_BY_ID[product.id].name).join(" and ")}.`, result: `${plug.name} gives you the current price and the maximum order. Business is open.` },
        { label: "Decline", effect: { setFlags: { [`${plugId}PlugDeclined`]: true } }, preview: "No deal. Nothing unlocks.", result: `${plug.name} pockets the phone. No deal.` },
      ],
    };
  }

  function firstBoostOpportunityEvent() {
    return {
      id: "boost_first_opportunity", title: "Blind Spot", who: "You", where: "Night Owl Mini-Mart",
      stakes: "Pocket something or keep walking.",
      description: "You're browsing Night Owl Mini-Mart. The camera has a blind spot by the back aisle. Pocket something or keep walking.",
      choices: [
        { label: "Pocket it", effect: { boostTargetId: "night_owl", setFlags: { boostOpportunitySeen: true } }, preview: "Try a small lift.", result: "You make the move before the camera swings back." },
        { label: "Keep walking", effect: { setFlags: { boostOpportunitySeen: true } }, preview: "Leave it alone.", result: "You leave the shelf untouched." },
      ],
    };
  }

  function gamblingDiscoveryEvent(source) {
    const person = SOCIAL_CONTACTS[source];
    const fromCoworker = person && source !== "cal";
    return event("gambling_discovery", "A Door After Closing", fromCoworker
      ? `${person.name.split(" ")[0]} gives you a side-door address. The game starts after the storefront closes.`
      : "Cal lowers his voice and gives you a side-door address. The table opens after the storefront closes.", [
      { label: "Keep the address", effect: { discoverGambling: true }, preview: "Unlock the backroom game in Spenard.", result: "You fold the address into your pocket. The door will open when the tables are running." },
    ], fromCoworker
      ? `${person.name.split(" ")[0]} checks the room before speaking. The address stays covered under one hand.`
      : "Cal scratches the address onto a coffee sleeve. His chair stays angled toward the front door while he writes.");
  }

  function coworkerForShift(state, job) {
    if (!job.coworkers.length) return null;
    const record = state.jobs.records[job.id];
    const order = seededShuffle(job.coworkers, state.run.seed, stringHash(`coworkers:${job.id}`));
    return order.find((person) => !record.coworkersMet.includes(person.id)) || order[record.shifts % order.length];
  }

  function resolveJobShift(inputState, action) {
    const job = SPENARD_JOB_BY_ID[action.jobId];
    const approach = JOB_APPROACHES[action.approach];
    if (!job || !approach || !jobAvailability(inputState, job.id).available) return inputState;
    const state = copyState(inputState);
    const dreWasEligible = state.onboarding.dreEligible;
    reconcileCash(state);
    const random = makeRandom(state.run.rngState);
    const record = state.jobs.records[job.id];
    const coworker = coworkerForShift(state, job);
    const pay = jobPayRange(state, job.id);
    const payout = Math.round(random.int(pay.min, pay.max) * approach.payMultiplier);
    const oldRank = record.rank;

    addCleanCash(state, payout);
    state.player.health = clamp(state.player.health + approach.health, 1, 100);
    record.xp += approach.xp;
    record.relationship += approach.relationship;
    record.shifts += 1;
    record.lastWorkedDay = state.run.day;
    record.rank = jobRankForXp(record.xp);
    if (job.scheduled) state.jobs.lastScheduledShiftDay = state.run.day;
    else state.jobs.lastDeliveryDay = state.run.day;
    state.jobs.lastWorked = job.id;
    state.onboarding.shiftsWorked += 1;
    recordVisitedLocation(state, `job:${job.id}`);

    record.currentCoworkerId = coworker?.id || null;
    if (coworker && !record.coworkersMet.includes(coworker.id)) {
      record.coworkersMet.push(coworker.id);
      record.contactMet = true;
      state.contacts[coworker.id].known = true;
      recordMetNpc(state, coworker.id);
      logEntry(state, coworker.introduction, "good");
    }
    if (coworker && approach.id === "socialize") state.contacts[coworker.id].relationshipLevel += 1;
    if (state.run.phase === "week_zero" && job.id === "wash_go" && record.shifts >= 2 && !state.nightOwl.ambientSeen.includes("lena_money")) {
      state.nightOwl.ambientSeen.push("lena_money");
      logEntry(state, "Lena says she used to make bigger money, then starts folding towels before the sentence finishes.", "");
    }
    if (approach.id === "learn_job") {
      const detailIndex = job.details.findIndex((_, index) => !record.learnedDetails.includes(index));
      if (detailIndex >= 0) {
        record.learnedDetails.push(detailIndex);
        logEntry(state, job.details[detailIndex], "");
      } else {
        logEntry(state, `${coworker ? coworker.name.split(" ")[0] : "The foreman"} says you know the routine well enough to spot what changes.`, "");
      }
    }
    if (job.id === "ship_creek") {
      const employer = state.world.locations.employer;
      employer.lastShiftDay = state.run.day;
      employer.standing = clamp(employer.standing + 1, 0, 5);
      employer.keptCommitments += 1;
      if (employer.standing >= 3) state.flags.legalCover = true;
    }
    if (record.rank > oldRank) {
      if (job.id === "night_owl" && record.rank >= 3) {
        state.flags.spenardVouched = true;
        logEntry(state, "Mina introduces Deshawn. He puts his name behind yours on Spenard Road.", "good");
      } else if (job.id === "night_owl" && record.rank === 2) {
        logEntry(state, "Night Owl Rank 2. Mina clears a small back-room stash for you.", "good");
      } else if (job.id === "night_owl" && record.rank === 1) {
        logEntry(state, "Night Owl Rank 1. Mina adds Night shifts to your schedule.", "good");
      } else {
        logEntry(state, `${job.name}: Rank ${record.rank}. The better rate starts with your next shift.`, "good");
      }
    }
    recordBehavior(state, "earner", record.rank >= 2 ? 2 : 1, `job:${job.id}:${state.run.day}`, "legal_work");
    addStreetReadEntry(state, "income", `job:${job.id}`);
    updateWeekZeroEligibility(state);
    const dialogueIndex = normalizeSeed(state.run.seed ^ stringHash(`${job.id}:shift:${record.shifts}`)) % job.shiftDialogue.length;
    logEntry(state, job.shiftDialogue[dialogueIndex], "");
    state.run.rngState = random.state;
    logEntry(state, `${job.name} shift done. +$${payout}.`, "good");
    const advanced = advanceRun(state, { reason: "WORK_JOB", suppressStory: dreWasEligible, summary: `${job.name} shift (+$${payout})` });
    if (advanced.run.status !== "playing" || advanced.run.pendingEncounter) return advanced;
    if (record.shifts >= 3 && !advanced.world.locations.gamblingKnown && !advanced.flags.gamblingDiscoverySeen) {
      advanced.flags.gamblingDiscoverySeen = true;
      advanced.run.pendingEvent = gamblingDiscoveryEvent(coworker?.id || "cal");
      return advanced;
    }
    return advanced;
  }

  function reduceGame(inputState, action) {
    if (!inputState || !action || !action.type) return inputState;
    if (action.type === "HYDRATE_RUN") return hydrateRun(action.state) || inputState;
    if (action.type === "NEW_RUN") return createRun({ seed: action.seed });
    if (action.type === "DISMISS_TAB_UNLOCK") {
      if (!inputState.run.pendingUnlocks.length) return inputState;
      const next = copyState(inputState);
      next.run.pendingUnlocks.shift();
      return next;
    }
    if (action.type === "DISMISS_CONSEQUENCE") {
      if (!inputState.run.consequenceQueue?.length) return inputState;
      const next = copyState(inputState);
      if (action.id) next.run.consequenceQueue = next.run.consequenceQueue.filter((item) => item.id !== action.id);
      else next.run.consequenceQueue.shift();
      return next;
    }
    if (action.type === "CONFIRM_END_DAY") {
      if (inputState.run.overtimeArmed && !inputState.run.dayEndPending) {
        const stopped = copyState(inputState);
        stopped.run.overtimeArmed = false;
        stopped.run.dayEndPending = true;
        return confirmDayEnd(stopped);
      }
      return confirmDayEnd(inputState);
    }
    if (action.type === "ONE_MORE_THING") {
      if (!inputState.run.dayEndPending || inputState.run.pendingEvent || inputState.run.pendingEncounter || inputState.player.energy < 2 || inputState.run.overtimeUsedDay === inputState.run.day) return inputState;
      const overtime = copyState(inputState);
      overtime.run.dayEndPending = false;
      overtime.run.overtimeArmed = true;
      return overtime;
    }
    if (action.type === "START_RUN" || action.type === "CHOOSE_BACKGROUND") {
      if (inputState.run.status !== "creating_character") return inputState;
      const background = BACKGROUNDS.find((item) => item.id === action.backgroundId);
      if (action.type === "CHOOSE_BACKGROUND" && !background) return inputState;
      const state = copyState(inputState);
      const chosenName = sanitizeStreetName(action.streetName);
      if (action.type === "START_RUN" && !chosenName) return inputState;
      state.player.background = null;
      state.player.legacyBackground = action.type === "CHOOSE_BACKGROUND" ? background.id : null;
      state.player.attributes = action.type === "CHOOSE_BACKGROUND" ? { ...LEGACY_ATTRIBUTES[background.id] } : { ...ATTRIBUTE_DEFAULTS };
      state.player.streetName = chosenName || DEFAULT_STREET_NAMES[background.id];
      state.player.streetNameChosen = !!chosenName;
      state.player.cash = action.type === "CHOOSE_BACKGROUND" ? 375 : 100;
      state.player.dirtyCash = action.type === "CHOOSE_BACKGROUND" ? state.player.cash : 0;
      state.player.cleanCash = action.type === "CHOOSE_BACKGROUND" ? 0 : state.player.cash;
      state.player.heat = action.type === "CHOOSE_BACKGROUND" ? 1 : 0;
      if (action.type === "CHOOSE_BACKGROUND") {
        state.run.premise = "legacy_established";
        state.run.phase = "pressure";
        state.run.pressureStartedDay = 1;
        state.run.checkpointDay = RUN_DAYS;
        state.base.controlled = true;
        state.base.acquiredDay = 1;
        state.lender.principal = 620;
        state.lender.balance = 620;
        state.lender.dueDay = 4;
        state.lender.status = "active";
        state.npc.dre.known = true;
        state.npc.dre.trust = Math.max(1, state.npc.dre.trust);
        state.npc.dre.loansTaken = Math.max(1, state.npc.dre.loansTaken);
        state.npc.curtis.pressure = 1;
        state.npc.curtis.attention = 1;
        state.npc.curtis.relationship = "dismissive";
        state.world.productAccess.weed = true;
        state.world.productAccess.shrooms = true;
        state.world.transport.downtownKnown = true;
        state.world.transport.industrialRouteKnown = true;
      }
      state.player.stats = derivedRatings(state);
      state.run.status = "playing";
      state.run.openingPending = action.type === "START_RUN";
      state.stats.startingNetWorth = state.player.cash - state.lender.balance;
      state.log = [];
      logEntry(state, action.type === "START_RUN" ? `${state.player.streetName} wakes in Yalonda's spare room with $100 and a city that has not opened yet.` : `${state.player.streetName} continues an established week under Dre's note.`, "warn");
      return state;
    }
    if (!districtActionPreflight(inputState, action)) return inputState;
    if (TIME_ACTIONS.has(action.type) && (inputState.run.dayEndPending || !canSpendEnergy(inputState, action.type))) return inputState;
    if (action.type === "RESOLVE_ENCOUNTER") return reduceEncounter(inputState, action);
    if (action.type === "ACKNOWLEDGE_ENCOUNTER") {
      if (!inputState.run.pendingEncounter?.resolved) return inputState;
      return reduceEncounter(inputState, { type: "RESOLVE_ENCOUNTER", choiceId: "continue" });
    }
    if (action.type === "ROB") return executeRob(inputState);
    if (action.type === "ELI_TEST_ROUTE") return executeEliTestRoute(inputState);
    if (action.type === "ROB_DEALER") return executeDealerRobbery(inputState, action.dealerId);
    if (action.type === "TAKEOVER") return executeTakeover(inputState, action.neighborhoodId, !!action.includePlayer);

    const state = copyState(inputState);
    reconcileCash(state);
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
      const eventCategory = current.id.startsWith("dre_") ? "earner" : current.id.startsWith("curtis_") ? "stickup" : current.id.startsWith("eli_") || current.id.startsWith("mina_") ? "connector" : current.id.startsWith("goodie_") ? "mover" : null;
      if (eventCategory) recordBehavior(state, eventCategory, current.id.endsWith("day7") ? 2 : 1, `event:${current.id}`, "story_choice");
      // A scene the player engaged with counts as knowing the person in it, and
      // a choice authored as risky counts as having taken that kind of risk.
      if (!/^(leave|cancel|walk away|say nothing)/i.test(choice.label)) {
        const npc = STREET_READ_EVENT_NPC[current.id.split("_")[0]];
        if (npc) addStreetReadEntry(state, "social", `${npc}:${choice.trustBuilding ? "trust_choice" : "conversation"}`);
      }
      if (choice.risky) addStreetReadEntry(state, "risk", `event_risk:${state.world.currentNeighborhoodId}`);
      logEntry(state, choice.result, (choice.effect?.cash || 0) >= 0 ? "good" : "warn");
      state.stats.majorDecisions.push(`${current.title}: ${choice.label}`);
      state.run.recentEvents = [current.id, ...state.run.recentEvents.filter((id) => id !== current.id)].slice(0, 4);
      state.flags[`${current.id.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())}Resolved`] = true;
      if (current.id === "mina_intro") {
        state.npc.mina.met = true;
        state.contacts.mina.known = true;
        recordMetNpc(state, "mina");
        updateWeekZeroEligibility(state);
        state.npc.mina.introChoice = state.flags.minaIntroChoice || (state.flags.minaFlirted ? "flirt" : state.flags.minaFriendlyIntro ? "friendly" : "distant");
        state.npc.mina.flirtHistory = !!state.flags.minaFlirted;
        state.flags.minaIntroResolved = true;
      }
      const descriptor = STORY_BY_ID[current.id];
      if (descriptor && descriptor.chain === "mina_spenard") {
        state.npc.mina.chainStage = Math.max(state.npc.mina.chainStage || 0, descriptor.stage);
        state.npc.mina.arcStage = state.npc.mina.chainStage;
        state.npc.mina.outcomes.push({ stage: descriptor.stage, id: current.id, choice: choice.label, day: state.run.day });
        if (current.id === "mina_after") {
          state.npc.mina.outcome = state.npc.mina.available === false || state.flags.exploitedValeName || state.npc.mina.trust <= 0 ? "mina_gone" : state.npc.mina.trust >= 3 && (state.flags.toldMinaTruth || state.flags.valeProtectedMina || state.flags.minaBrokeredVale) ? "mina_stays" : "mina_calls_home";
        }
      }
      if (descriptor?.chain === "household") {
        const npcId = current.id.startsWith("juan_") ? "juan" : current.id.startsWith("yalonda_") ? "yalonda" : null;
        if (npcId) state.npc[npcId].lastEventDay = state.run.day;
        if (current.id === "yalonda_flirt" && choice.effect?.setFlags?.yalondaFlirtAccepted) state.npc.yalonda.romanceStage = 1;
      }
      if (current.id === "eli_offer") state.flags.eliOfferResolved = true;
      if (current.id === "pherris_offer") state.flags.pherrisOfferResolved = true;
      if (current.id === "tone_offer") state.flags.toneOfferResolved = true;
      if (current.id === "tone_jacksonville" && state.flags.toneJacksonvilleCutLoose) {
        state.people.crew.tone.recruited = false;
        state.people.crew.tone.status = "outside";
        state.people.crew.tone.assignment = null;
      }
      if (current.id === "courier") state.flags.courierResolved = true;
      if (current.id === "dre_after_payoff") { state.flags.dreAfterPayoffResolved = true; if (state.lender.afterPayoffOffer === "available") state.lender.afterPayoffOffer = "resolved"; }
      if (current.id === "base_watch") state.flags.baseWatchResolved = true;
      if (current.id === "crew_crisis") state.flags.crewCrisisResolved = true;
      state.run.rngState = random.state;
      announceFeatureUnlocks(state, beforeFeatures);
      if (state.player.health <= 0 || state.player.heat >= 15) endRun(state);
      reconcileCash(state);
      if (current.id === "mina_invitation" && !/not good/i.test(choice.label) && state.run.status === "playing") return advanceRun(state, { reason: "MINA_DATE", suppressStory: true });
      return state;
    }

    if (action.type === "BUY") {
      const product = PRODUCT_BY_ID[action.productId], market = state.world.markets[state.world.currentNeighborhoodId];
      const qty = Math.max(0, Math.floor(action.qty || 0));
      const plug = product ? unlockedPlugForProduct(state, product.id) : null;
      if (!state.market?.visible || !product || !plug || qty < 1 || qty > plugMaxUnits(state, product.id)) return inputState;
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
      addStreetReadEntry(state, "trading", `${state.world.currentNeighborhoodId}:${product.id}`);
      if (state.player.heat >= 8) addStreetReadEntry(state, "risk", `high_heat_trade:${state.world.currentNeighborhoodId}`);
      logEntry(state, `You move ${qty} ${product.name} into the bag for $${cost}.`, "good");
      const record = plugRecord(state, plug.id);
      if (record && record.lastPurchaseDay !== state.run.day) {
        record.lastPurchaseDay = state.run.day;
        record.standing = Math.min(5, record.standing + 1);
        if (plug.id === "goodie" && state.people.dealers?.goodie) {
          state.people.dealers.goodie.standing = record.standing;
          state.people.dealers.goodie.lastTradedDay = state.run.day;
        }
        syncPlugProductAccess(state, plug.id, true);
        if (record.standing >= 4 && plug.introducesNext && !record.introducedNext && !state.plugs.unlocked.includes(plug.introducesNext)) {
          record.introducedNext = true;
          state.run.pendingEvent = plugIntroductionEvent(plug.introducesNext);
        }
      }
      reconcileCash(state);
      return state;
    }
    if (action.type === "SELL") {
      const product = PRODUCT_BY_ID[action.productId], market = state.world.markets[state.world.currentNeighborhoodId];
      const qty = Math.max(0, Math.floor(action.qty || 0));
      if (!state.market?.visible || !product || !unlockedPlugForProduct(state, product.id) || qty < 1 || state.player.inventory[product.id].qty < qty) return inputState;
      const item = state.player.inventory[product.id];
      const projection = tradeProjection(state, product.id, qty, "sell");
      const unitPrice = projection.unitPrice;
      const total = projection.revenue, profit = projection.profitLoss;
      item.qty -= qty;
      if (!item.qty) item.avgCost = 0;
      addDirtyCash(state, total);
      state.run.currentVisit.trades += 1;
      state.run.currentVisit.grossSell += total;
      addStreetReadEntry(state, "trading", `${state.world.currentNeighborhoodId}:${product.id}`);
      if (state.player.heat >= 8) addStreetReadEntry(state, "risk", `high_heat_trade:${state.world.currentNeighborhoodId}`);
      state.stats.productsMoved[product.id] += qty;
      recordIllegalSale(state, qty, total);
      state.stats.bestTrade = Math.max(state.stats.bestTrade, total);
      state.stats.largestLoss = Math.max(state.stats.largestLoss, Math.max(0, -profit));
      if (profit >= 20) recordBehavior(state, "mover", profit >= 100 ? 2 : 1, `sale:${state.run.day}:${state.world.currentNeighborhoodId}:${state.run.currentVisit.trades}:${product.id}`, "sale");
      if (profit > 0 && qty >= 3 && !state.world.tradeInfluenceGranted[state.world.currentNeighborhoodId]) {
        influenceChange(state, state.world.currentNeighborhoodId, 1);
        state.world.tradeInfluenceGranted[state.world.currentNeighborhoodId] = true;
      }
      logEntry(state, `The buyer takes ${qty} ${product.name}. You count $${total} before leaving the block.`, profit >= 0 ? "good" : "bad");
      reconcileCash(state);
      return state;
    }

    if (action.type === "STORE_CASH" || action.type === "RETRIEVE_CASH") {
      if (!state.base.controlled) return inputState;
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
      reconcileCash(state);
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
      reconcileCash(state);
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
    if (action.type === "TALK_HOUSEHOLD") {
      const npcId = action.npcId;
      if (!["yalonda", "juan"].includes(npcId) || state.people.household.evicted || state.people.household.lastQuestionDay === state.run.day || householdPresence(state) !== npcId) return inputState;
      state.people.household.lastQuestionDay = state.run.day;
      recordBehavior(state, "connector", 1, `household:${npcId}:talk`, "family_contact");
      addStreetReadEntry(state, "social", `${npcId}:advice`);
      if (npcId === "juan") {
        state.npc.juan.trust += 1;
        if (!state.npc.juan.infoShared.includes("work:ship_creek")) state.npc.juan.infoShared.push("work:ship_creek");
        state.effects.rumors.push({ id: `juan_${state.run.day}`, areaId: "north_star_lot", productId: "weed", reliable: true, text: "Juan says Ship Creek hires early and his warehouse dock keeps a short callback list.", expiresAt: slotNumber(state.run.day, state.run.slot) + 4 });
        pushConsequence(state, "Juan writes a loading-dock name on your receipt.", "good");
      } else {
        state.npc.yalonda.trust += 1;
        state.effects.rumors.push({ id: `yalonda_${state.run.day}`, areaId: "north_star_lot", productId: "weed", reliable: true, text: "Yalonda says somebody asked questions outside, then describes the coat.", expiresAt: slotNumber(state.run.day, state.run.slot) + 4 });
        pushConsequence(state, "Yalonda lowers the stove flame and tells you who came by.", "warn");
      }
      logEntry(state, `${npcId === "juan" ? "Juan" : "Yalonda"} gives you the useful part without wasting words.`, "good");
      return state;
    }
    if (action.type === "HOUSE_VIOLATION") {
      state.people.household.dangerBroughtHome += action.danger ? 1 : 0;
      householdWarning(state, action.serious ? 2 : 1, action.reason || "Trouble reaches Yalonda's front step, and the house rules become a warning.", !!action.catastrophic);
      return state;
    }
    if (action.type === "STORE_PRODUCT" || action.type === "RETRIEVE_PRODUCT") {
      if (!state.base.controlled || !state.base.visiting || !PRODUCT_BY_ID[action.productId]) return inputState;
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
      if (!state.base.controlled || !state.base.visiting || !CREW_BY_ID[action.crewId]) return inputState;
      const crew = state.people.crew[action.crewId];
      if (!crew.recruited || crew.wageDue <= 0 || state.player.cash < crew.wageDue) return inputState;
      const amount = crew.wageDue;
      state.player.cash -= amount; crew.wageDue = 0; crew.loyalty += 1; state.stats.moneySpent.crew += amount;
      recordBehavior(state, "earner", 2, `crew_pay:${action.crewId}:${state.run.day}`, "crew_pay");
      logEntry(state, `${CREW_BY_ID[action.crewId].name.split(" ")[0]} folds the full $${amount} into a pocket and stays for the next plan.`, "good");
      reconcileCash(state);
      return state;
    }
    if (action.type === "PAY_RENT") {
      if (state.run.day < state.obligations.rentDueDay || state.player.cash < WEEKLY_RENT || state.people.household.evicted) return inputState;
      spendCash(state, WEEKLY_RENT);
      while (state.obligations.rentDueDay <= state.run.day) state.obligations.rentDueDay += 7;
      state.obligations.lastMissedDueDay = null;
      state.npc.yalonda.rentPaidWeeks += 1;
      state.npc.yalonda.lastRentDay = state.run.day;
      state.npc.yalonda.trust += 1;
      recordBehavior(state, "earner", 2, `rent:${state.run.day}`, "rent_payment");
      pushConsequence(state, "Yalonda counts the rent once and closes the envelope.", "good");
      logEntry(state, `Weekly rent paid in cash: $${WEEKLY_RENT}.`, "good");
      return state;
    }
    if (action.type === "PAY_PHONE_BILL") {
      const online = action.surface === "online";
      const due = state.run.day >= state.phone.billDueDay || state.phone.daysPastDue > 0 || !state.phone.active;
      if (!due || state.player.cash < PHONE_BILL) return inputState;
      if (online && (!state.inventory.laptop || !state.phone.active || !state.knowledge.knows907List)) return inputState;
      spendCash(state, PHONE_BILL);
      state.phone.billDueDay = state.run.day + 7;
      state.phone.daysPastDue = 0;
      if (!state.phone.active) state.phone.reactivateAtSlot = slotNumber(state.run.day, state.run.slot);
      recordBehavior(state, "earner", 1, `phone_bill:${state.run.day}`, "phone_payment");
      logEntry(state, `Phone bill paid: $${PHONE_BILL}.`, "good");
      if (online) { pushConsequence(state, "Payment clears. The next bill date slides one week.", "good"); return state; }
      pushConsequence(state, "Payment clears. The next bill date slides one week.", "good");
      return state;
    }
    if (action.type === "APPLY_JOB") {
      const job = SPENARD_JOB_BY_ID[action.jobId];
      if (!job || job.dayLabor || !state.jobs.discovered.includes(job.id) || state.jobs.activeJobId === job.id || state.jobs.offers.includes(job.id) || state.jobs.applications.some((item) => item.jobId === job.id) || !state.phone.active) return inputState;
      state.jobs.applications.push({ jobId: job.id, appliedAtDay: state.run.day, appliedAtSlot: state.run.slot });
      logEntry(state, `You leave an application with ${job.name}. They say to keep your phone on.`, "");
      return advanceRun(state, { reason: "APPLY_JOB", summary: `Applied at ${job.name}` });
    }
    if (action.type === "ACCEPT_JOB") {
      const job = SPENARD_JOB_BY_ID[action.jobId];
      if (!job || !state.jobs.offers.includes(job.id)) return inputState;
      const previousId = state.jobs.activeJobId;
      if (previousId && state.jobs.records[previousId]) {
        const previous = state.jobs.records[previousId];
        previous.xp = 0;
        previous.rank = 0;
        previous.relationship = 0;
      }
      state.jobs.activeJobId = job.id;
      state.jobs.hired = ["day_labor", job.id];
      state.jobs.offers = state.jobs.offers.filter((id) => id !== job.id);
      pushConsequence(state, previousId ? `${SPENARD_JOB_BY_ID[previousId].name} gets the quit call. ${job.name} is now your employer.` : `${job.name} is now your employer.`, "good");
      return state;
    }
    if (action.type === "DECLINE_JOB") {
      if (!state.jobs.offers.includes(action.jobId)) return inputState;
      state.jobs.offers = state.jobs.offers.filter((id) => id !== action.jobId);
      pushConsequence(state, `You turn down ${SPENARD_JOB_BY_ID[action.jobId].name}.`, "");
      return state;
    }
    if (action.type === "CURTIS_DECISION") {
      if (!applyCurtisDecision(state, action.choice)) return inputState;
      pushConsequence(state, action.choice === "pay_tax" ? "Curtis's fifteen-percent nightly tax is active." : action.choice === "friendship" ? "Curtis grants two days of protection and a buyer premium." : action.choice === "guarded" ? "You keep the relationship guarded and gain Curtis's respect." : "You reject Curtis, keep independence, and draw more attention.", action.choice === "reject" ? "warn" : "good");
      return state;
    }
    if (action.type === "TAKE_DRE_LOAN") {
      if (!state.npc.dre.known || state.lender.status === "active" || state.lender.balance > 0) return inputState;
      const repeat = state.npc.dre.loansTaken > 0;
      const principal = repeat ? 1200 : 1000;
      state.lender.status = "active";
      state.lender.principal = principal;
      state.lender.balance = repeat ? 1380 : 1200;
      state.lender.dueDay = repeat ? Math.min(state.run.day + 5, checkpointDay(state)) : checkpointDay(state);
      state.npc.dre.loansTaken += 1;
      addDirtyCash(state, principal);
      pushConsequence(state, `Dre opens a $${principal} note. $${state.lender.balance} is due Day ${state.lender.dueDay}.`, "warn");
      return state;
    }
    if (action.type === "REQUEST_DRE_MISSION") {
      if (!dreMissionAvailability(state).available) return inputState;
      const available = DRE_MISSIONS.filter((mission) => mission.id !== state.npc.dre.missionHistory.at(-1)?.missionId);
      const mission = available[stringHash(`${state.run.seed}:dre-mission:${state.npc.dre.missionHistory.length}:${state.run.day}`) % available.length];
      state.npc.dre.activeMission = { missionId: mission.id, offeredDay: state.run.day };
      pushConsequence(state, `Dre offers one ${mission.label.toLowerCase()} mission.`, "");
      return state;
    }
    if (action.type === "REFUSE_DRE_MISSION") {
      if (!state.npc.dre.activeMission) return inputState;
      state.npc.dre.missionHistory.push({ ...state.npc.dre.activeMission, outcome: "refused", day: state.run.day });
      state.npc.dre.activeMission = null;
      state.npc.dre.refusals += 1;
      if (state.npc.dre.refusals >= 3) state.npc.dre.offersDisabled = true;
      pushConsequence(state, state.npc.dre.offersDisabled ? "The third refusal closes Dre's mission book for this run." : "Dre accepts the refusal and remembers it.", "warn");
      return state;
    }
    if (action.type === "DRE_MISSION") {
      const active = state.npc.dre.activeMission;
      const mission = active && DRE_MISSIONS.find((item) => item.id === active.missionId);
      if (!mission) return inputState;
      const allowed = ["clean", "violent", "soft", "failed"];
      const outcome = allowed.includes(action.outcome) ? action.outcome : "clean";
      const pay = outcome === "failed" ? 0 : mission.pay[0] + (stringHash(`${state.run.seed}:${mission.id}:${state.run.day}`) % (mission.pay[1] - mission.pay[0] + 1));
      if (pay) addDirtyCash(state, pay);
      if (outcome === "clean") { state.npc.dre.cleanCompletions += 1; state.npc.dre.trust = clamp(state.npc.dre.trust + 1, 0, 3); }
      else if (outcome === "violent") { state.player.heat = clamp(state.player.heat + 2, 0, 15); state.npc.dre.trust = Math.max(0, state.npc.dre.trust - 1); }
      else if (outcome === "soft") state.npc.dre.trust = clamp(state.npc.dre.trust + (mission.id === "intelligence" ? 1 : 0), 0, 3);
      else state.npc.dre.trust = Math.max(0, state.npc.dre.trust - 1);
      state.lender.trust = state.npc.dre.trust;
      state.npc.dre.missionHistory.push({ ...active, outcome, pay, day: state.run.day });
      state.npc.dre.activeMission = null;
      if (sharkUnlocked(state)) { state.hustle.shark.visible = true; state.hustle.sections.shark = true; }
      logEntry(state, `Dre's ${mission.label.toLowerCase()} mission ends ${outcome}${pay ? `, paying $${pay}` : ""}.`, outcome === "clean" ? "good" : outcome === "violent" || outcome === "failed" ? "bad" : "warn");
      return advanceRun(state, { reason: "DRE_MISSION", suppressStory: true });
    }
    if (action.type === "DRE_TALK") {
      if (state.npc.dre.trust < 2) return inputState;
      const remaining = DRE_BACKSTORY.map((_, index) => index).filter((index) => !state.npc.dre.backstoryFragments.includes(index));
      if (!remaining.length) return inputState;
      const index = remaining[stringHash(`${state.run.seed}:dre-story:${state.npc.dre.backstoryFragments.length}`) % remaining.length];
      state.npc.dre.backstoryFragments.push(index);
      pushConsequence(state, DRE_BACKSTORY[index], "");
      return state;
    }
    if (action.type === "FUND_SHARK") {
      const amount = Math.floor(Number(action.amount) || 0), term = Math.floor(Number(action.term) || 0);
      const readiness = sharkLoanAvailability(state, action.borrowerId, amount, term);
      if (!readiness.available || !spendCash(state, amount)) return inputState;
      const loan = { id: state.hustle.shark.nextLoanId++, borrowerId: action.borrowerId, amount, term, openedDay: state.run.day, dueDay: state.run.day + term, status: "active", risk: readiness.risk, extensions: 0 };
      state.hustle.shark.loans.push(loan);
      pushConsequence(state, `${SHARK_BORROWERS.find((item) => item.id === action.borrowerId).name} takes $${amount} for ${term} days. Displayed risk: ${readiness.risk}.`, "warn");
      return state;
    }
    if (["COLLECT_SHARK", "ENFORCE_SHARK", "EXTEND_SHARK", "FORGIVE_SHARK"].includes(action.type)) {
      const loan = state.hustle.shark.loans.find((item) => item.id === action.loanId && item.status === "defaulted");
      if (!loan) return inputState;
      const interest = Math.round(loan.amount * SHARK_TERMS[loan.term]);
      if (action.type === "EXTEND_SHARK") {
        loan.status = "extended"; loan.extensions += 1; loan.dueDay = state.run.day + 2;
        pushConsequence(state, "The borrower gets two more days. The note stays open.", "warn");
        return state;
      }
      if (action.type === "FORGIVE_SHARK") {
        loan.status = "forgiven";
        state.npc.dre.trust = Math.max(0, state.npc.dre.trust - 1);
        pushConsequence(state, "You forgive the note. Dre calls it mercy once and poor underwriting twice.", "warn");
        return state;
      }
      const violent = action.type === "ENFORCE_SHARK";
      const recovered = violent ? loan.amount + interest : loan.amount + Math.round(interest * 0.75);
      const dreCut = Math.round(Math.max(0, recovered - loan.amount) * 0.12);
      addDirtyCash(state, recovered - dreCut);
      if (violent) state.player.heat = clamp(state.player.heat + 2, 0, 15);
      loan.status = violent ? "enforced" : "collected";
      loan.outcome = { recovered, dreCut };
      logEntry(state, `${violent ? "Enforcement" : "Collection"} closes the note at $${recovered - dreCut} after Dre's share.`, violent ? "bad" : "good");
      return advanceRun(state, { reason: action.type, suppressStory: true });
    }
    if (action.type === "SIMONE_CHOICE") {
      if (!["respect", "poach", "threaten", "leverage", "truce"].includes(action.choice)) return inputState;
      state.npc.simone.known = true;
      if (action.choice === "respect") state.npc.simone.trust += 1;
      else if (["poach", "threaten"].includes(action.choice)) state.npc.simone.threat += 1;
      else if (action.choice === "leverage") { state.npc.simone.leverage += 1; state.npc.simone.threat += 1; }
      else if (action.choice === "truce" && state.npc.simone.trust >= 2) state.npc.simone.truce = true;
      state.npc.simone.outcomes.push({ choice: action.choice, day: state.run.day });
      return state;
    }
    if (action.type === "PROMOTE_CREW_TIER") {
      const readiness = crewTierAvailability(state, action.crewId);
      if (!readiness.available) return inputState;
      if (readiness.cost) spendCash(state, readiness.cost);
      const crew = state.people.crew[action.crewId];
      crew.tier = readiness.tier;
      if (action.crewId === "pherris" && readiness.tier === 3) { crew.networkActive = true; state.npc.simone.known = true; state.npc.simone.pherrisConflict = true; }
      pushConsequence(state, `${CREW_BY_ID[action.crewId].name} reaches Tier ${readiness.tier}.`, "good");
      return state;
    }
    if (action.type === "ASSIGN_BLOCK_MANAGER") {
      const block = state.world.territoryBlocks[action.blockId];
      const crew = state.people.crew[action.crewId];
      if (!block || block.owner !== "player" || !["pherris", "tone", "deshawn"].includes(action.crewId) || !crew?.recruited || crew.tier < 2) return inputState;
      for (const record of Object.values(state.world.territoryBlocks)) if (record.managerId === action.crewId) record.managerId = null;
      block.managerId = action.crewId;
      pushConsequence(state, `${CREW_BY_ID[action.crewId].name} now manages ${SPENARD_BLOCK_BY_ID[action.blockId].name}.`, "good");
      return state;
    }
    if (action.type === "BROKER_CURTIS_TRUCE") {
      const deshawn = state.people.crew.deshawn;
      if (!deshawn?.recruited || deshawn.tier < 2 || state.npc.curtis.attention < 4) return inputState;
      state.npc.curtis.protectionUntilDay = Math.max(state.npc.curtis.protectionUntilDay || 0, state.run.day + 1);
      deshawn.trucesBrokered += 1;
      state.npc.simone.truce = state.npc.simone.trust >= 1 || state.npc.simone.leverage > 0;
      pushConsequence(state, "Deshawn brokers a temporary Curtis truce through the people who can enforce it.", "good");
      return state;
    }

    let base = state;
    if (["CONTACT_CALL", "CONTACT_TEXT", "CONTACT_VISIT"].includes(action.type)) {
      const type = action.type.replace("CONTACT_", "").toLowerCase();
      const available = contactAvailability(state, action.npcId, type);
      if (!available.available) return inputState;
      const record = base.contacts[action.npcId];
      record.lastInteraction = { type, day: base.run.day };
      if (type === "visit" && record.lastVisitDay !== base.run.day) {
        record.lastVisitDay = base.run.day;
        record.relationshipLevel += 1;
      }
      const card = contactInteractionEvent(base, action.npcId, type);
      if (type !== "visit") { base.run.pendingEvent = card; return base; }
      base.run.pendingEvent = card;
      return base;
    }
    if (action.type === "VIEW_NIGHT_OWL_BOARD") {
      if (!nightOwlAvailability(state).available) return inputState;
      base.flags.nightOwlVisited = true;
      recordVisitedLocation(base, "night_owl");
      if (!base.nightOwl.boardViewedDays.includes(base.run.day)) base.nightOwl.boardViewedDays.push(base.run.day);
      const board = nightOwlBoardItems(base);
      if (board.some((entry) => entry.id === "gym")) applyEventEffect(base, { discoverGym: true }, random);
      if (base.run.phase === "week_zero" && !base.nightOwl.ambientSeen.includes("board_opportunity")) {
        base.nightOwl.ambientSeen.push("board_opportunity");
        logEntry(base, "One board tab promises opportunity without naming the work. Someone has taken every phone number but one.", "");
      } else {
        logEntry(base, "The Night Owl board has three fresh postings and yesterday's staple holes.", "");
      }
      return base;
    }
    if (action.type === "BUY_COFFEE") {
      if (!nightOwlAvailability(state).available || state.player.cash < 4) return inputState;
      spendCash(base, 4);
      base.player.energy = Math.min(MAX_ENERGY, base.player.energy + 1);
      base.flags.nightOwlVisited = true;
      recordVisitedLocation(base, "night_owl");
      if (base.run.phase === "week_zero" && !base.nightOwl.ambientSeen.includes("put_on")) {
        base.nightOwl.ambientSeen.push("put_on");
        logEntry(base, "A customer asks Mina who put you on. She glances at you and lets the question hang over the coffee machine.", "");
      } else {
        logEntry(base, "Four dollars buys a hot coffee and enough room at the counter to reset.", "good");
      }
      pushConsequence(base, "Coffee buys a quiet minute at the counter.", "good");
      return base;
    }
    if (action.type === "TALK_NIGHT_OWL_REGULAR") {
      if (!nightOwlAvailability(state).available) return inputState;
      const regular = NIGHT_OWL_REGULARS.find((item) => item.id === action.regularId);
      const present = nightOwlRegularFor(state);
      const relationship = regular && base.nightOwl.regulars[regular.id];
      if (!regular || present.id !== regular.id || relationship.lastTalkDay === base.run.day) return inputState;
      relationship.met = true;
      relationship.relationship += 1;
      relationship.lastTalkDay = base.run.day;
      base.contacts[regular.id].known = true;
      base.contacts[regular.id].relationshipLevel = Math.max(base.contacts[regular.id].relationshipLevel, relationship.relationship);
      recordVisitedLocation(base, "night_owl");
      recordMetNpc(base, regular.id);
      updateWeekZeroEligibility(base);
      if (regular.id === "nia" && relationship.relationship >= 2 && !base.flags.niaCourierHint) {
        base.flags.niaCourierHint = true;
        logEntry(base, "Nia says a courier who can keep a route quiet never stays short of work. She leaves the next part for later.", "good");
      } else {
        logEntry(base, regular.id === "cal" ? "Cal turns a loud story into a conversation and remembers that you stayed for the ending." : "Nia closes her paperback and trades one careful detail about the roads.", "good");
      }
      if (regular.id === "cal" && relationship.relationship >= 2 && !base.world.locations.gamblingKnown && !base.run.pendingEvent) {
        base.flags.gamblingDiscoverySeen = true;
        base.run.pendingEvent = gamblingDiscoveryEvent("cal");
      }
      return base;
    }
    if (action.type === "BUY_907LIST") {
      const item = LISTING_ITEM_BY_ID[action.itemId];
      const list = base.nineZeroSevenList;
      if (!nineZeroSevenListAccess(base, action.surface).available || !item || !listingSlate(base, action.surface).some((entry) => entry.id === item.id) || list.inventory.length >= LISTING_CAPACITY || base.player.cash < item.buy) return inputState;
      spendCash(base, item.buy);
      list.inventory.push({ id: `${base.run.day}:${base.run.slot}:${list.purchases}`, itemId: item.id, cost: item.buy, boughtDay: base.run.day });
      list.purchases += 1;
      logEntry(base, `You buy the ${item.name.toLowerCase()} for $${item.buy} and make room to hold it.`, "good");
      return base;
    }
    if (action.type === "SELL_907LIST") {
      const list = base.nineZeroSevenList;
      const index = list.inventory.findIndex((entry) => entry.id === action.inventoryId);
      const held = list.inventory[index];
      const item = held && LISTING_ITEM_BY_ID[held.itemId];
      if (index < 0 || !item || (!nineZeroSevenListAccess(base, action.surface || "phone").available && !nineZeroSevenListAccess(base, "home").available)) return inputState;
      const random = makeRandom(base.run.rngState);
      const payout = random.int(item.resale[0], item.resale[1]);
      base.run.rngState = random.state;
      list.inventory.splice(index, 1);
      list.sales += 1;
      list.profit += payout - held.cost;
      addCleanCash(base, payout);
      logEntry(base, `A 907List buyer takes the ${item.name.toLowerCase()} for $${payout}. The money is clean.`, "good");
      return base;
    }
    if (action.type === "BUY_LAPTOP") {
      const offeredAtNightOwl = nightOwlAvailability(base).available
        && base.nightOwl.boardViewedDays.includes(base.run.day)
        && nightOwlBoardItems(base).some((entry) => entry.id === "laptop");
      if ((!base.nineZeroSevenList.known && !offeredAtNightOwl) || base.inventory.laptop || base.player.cash < 250) return inputState;
      spendCash(base, 250);
      base.inventory.laptop = true;
      base.nineZeroSevenList.tier = "upgraded";
      logEntry(base, "The used laptop boots at home. Five listings refresh there every day.", "good");
      return base;
    }
    if (action.type === "VISIT_NIGHT_OWL") {
      if (!nightOwlAvailability(state).available) return inputState;
      base.flags.nightOwlVisited = true;
      recordVisitedLocation(base, "night_owl");
      addStreetReadEntry(base, "exploration", `${base.world.currentNeighborhoodId}:night_owl`);
      if (base.npc.mina.met) addStreetReadEntry(base, "social", "mina:visit");
      logEntry(base, state.npc.mina.met ? "Mina sets a clean cup beside the register and waits for you to choose the conversation." : "Mina looks up from the register and gives you enough time to introduce yourself.", "");
      if (base.run.status === "playing" && !base.npc.mina.met && !base.run.pendingEvent) fireStory(base, STORY_BY_ID.mina_intro);
      return base;
    }
    if (action.type === "LEASE_GARAGE") {
      if (state.base.controlled || state.player.cash < GARAGE_DEPOSIT) return inputState;
      base.player.cash -= GARAGE_DEPOSIT;
      base.base.controlled = true;
      base.base.acquiredDay = base.run.day;
      recordVisitedLocation(base, "north_star_garage");
      base.stats.moneySpent.base += GARAGE_DEPOSIT;
      recordBehavior(base, "mover", 3, "property:north_star", "property");
      addStreetReadEntry(base, "exploration", `${base.world.currentNeighborhoodId}:garage`);
      logEntry(base, `You put $${GARAGE_DEPOSIT} down on North Star Garage. The first week is included; storage, upgrades, recovery, and crew operations are now yours to build.`, "good");
      return advanceRun(base, { reason: "LEASE_GARAGE" });
    }
    if (action.type === "TRAIN_ATTRIBUTE") {
      const attribute = action.attribute;
      const available = activityAvailability(state).gym;
      if (!available.available || !["strength", "endurance", "reflexes"].includes(attribute) || state.player.attributes[attribute] >= 5) return inputState;
      const gym = base.world.locations.gym;
      recordVisitedLocation(base, "spenard_gym");
      if (gym.sessionDay !== base.run.day) { gym.sessionDay = base.run.day; gym.sessionsToday = 0; }
      base.player.cash -= available.cost;
      base.memberships.gym = true;
      gym.sessionsToday += 1;
      const improved = improveAttribute(base, attribute, available.progress);
      if (improved) addStreetReadEntry(base, "exploration", `${base.world.currentNeighborhoodId}:training`);
      logEntry(base, `Gym session: $${available.cost}, +${available.progress} hidden ${attribute} progress${improved ? ", milestone reached" : ""}.`, "good");
      return advanceRun(base, { reason: "TRAIN_ATTRIBUTE" });
    }
    if (action.type === "GAMBLE") {
      const available = activityAvailability(state).gambling;
      const stake = Math.floor(action.stake || 0);
      if (!available.available || ![20, 50, 100].includes(stake) || state.player.cash < stake) return inputState;
      const random = makeRandom(base.run.rngState);
      const approach = ["read", "steady", "press"].includes(action.approach) ? action.approach : "read";
      const skill = approach === "read" ? base.player.attributes.insight : approach === "steady" ? base.player.attributes.discipline : base.player.attributes.presence;
      const chance = clamp(0.35 + skill * 0.035 - stake / 2000, 0.32, 0.54);
      const won = random.next() < chance;
      base.player.cash -= stake;
      if (won) base.player.cash += stake * 2;
      const game = base.world.locations.gambling;
      game.plays += 1; game[won ? "wins" : "losses"] += 1; game.net += won ? stake : -stake;
      if (game.plays === 1) recordBehavior(base, "connector", 1, "gambling:first_contact", "gambling_contact");
      addStreetReadEntry(base, "exploration", `${base.world.currentNeighborhoodId}:gambling`);
      base.run.rngState = random.state;
      logEntry(base, won ? `The ${approach} approach holds. You leave the game $${stake} ahead.` : `The room takes your $${stake}. Nobody offers credit, and the next choice is yours.`, won ? "good" : "bad");
      return advanceRun(base, { reason: "GAMBLE" });
    }
    if (action.type === "ASSIGN_BOOST_CREW") {
      const crew = base.people.crew[action.crewId];
      if (!base.boost.visible || base.boost.tier < 3 || !crew?.recruited || crew.status !== "active" || !CREW_BY_ID[action.crewId]?.canFieldAssign) return inputState;
      base.boost.crewAssigned = action.crewId;
      logEntry(base, `${CREW_BY_ID[action.crewId].name} is assigned to boost duty.`, "good");
      return base;
    }
    if (action.type === "ASK_BOOST_WINDOW") {
      const target = BOOST_TARGET_BY_ID[action.targetId];
      if (!base.boost.visible || base.boost.tier < 2 || target?.tier !== 2 || target.areaId !== base.world.currentNeighborhoodId || base.boost.discoveredWindows.includes(target.id)) return inputState;
      base.boost.discoveredWindows.push(target.id);
      logEntry(base, `Word is ${target.name} is softest during ${SLOTS[target.windowSlot]}.`, "good");
      return advanceRun(base, { reason: "ASK_BOOST_WINDOW" });
    }
    if (action.type === "FENCE_BOOST_GOODS") {
      if (!base.boost.visible || base.boost.tier < 3 || base.boost.merchandise <= 0) return inputState;
      const rate = boostFenceRate(base.boost.fenceStanding);
      const gross = base.boost.merchandise;
      const payout = Math.round(gross * rate);
      base.boost.merchandise = 0;
      base.boost.fenceStanding = clamp(base.boost.fenceStanding + 1, 0, 5);
      addDirtyCash(base, payout);
      logEntry(base, `He looks at what you brought, quotes $${payout}, and takes the merchandise.`, "good");
      return base;
    }
    if (action.type === "BOOST" || action.type === "SHOPLIFT") {
      updateBoostTier(base);
      let target = BOOST_TARGET_BY_ID[action.targetId];
      const legacyFirst = action.type === "SHOPLIFT" && !base.boost.visible;
      if (!target && action.type === "SHOPLIFT") target = legacyFirst ? BOOST_TARGET_BY_ID.night_owl : visibleBoostTargets(base)[0];
      if (!target) return inputState;
      if (!legacyFirst && !boostTargetAvailability(base, target.id).available) return inputState;
      if (action.type === "SHOPLIFT") base.world.locations.discountStore.lastAttemptDay = base.run.day;
      const random = makeRandom(base.run.rngState);
      resolveBoostAttempt(base, target, random, action);
      base.run.rngState = random.state;
      return advanceRun(base, { reason: action.type });
    }
    if (action.type === "WANDER_SPENARD" || action.type === "EXPLORE_SPENARD") {
      if (state.world.currentNeighborhoodId !== HOME_DISTRICT_ID) return inputState;
      const random = makeRandom(base.run.rngState);
      const count = base.world.locations.explorationCount;
      base.world.locations.explorationCount += 1;
      if (!base.discovered.spenardGym && count === 0) applyEventEffect(base, { discoverGym: true }, random);
      recordVisitedLocation(base, "spenard_streets");
      addStreetReadEntry(base, "exploration", `${base.world.currentNeighborhoodId}:explore`);
      const jobDiscovered = rollJobDiscovery(base, random, count);
      const meetsGoodie = base.run.day >= 2 && !base.flags.goodieEncounterSeen;
      const meetsBoost = !meetsGoodie && !base.flags.boostOpportunitySeen && !base.boost.visible && (count === 0 || base.world.locations.gamblingKnown);
      if (!meetsBoost && !meetsGoodie && !jobDiscovered) {
        const discoveries = [
          "Juan's bus advice matches the posted Downtown timetable.",
          "A freight worker confirms Ship Creek hires before breakfast.",
          "The North Star listing is real, but the owner will not move on the deposit.",
          "You learn which Northern Value aisle has the longest camera gap.",
        ];
        logEntry(base, random.pick(discoveries), "");
      }
      if (base.run.phase === "week_zero" && count >= 1 && !base.nightOwl.ambientSeen.includes("flash_car")) {
        base.nightOwl.ambientSeen.push("flash_car");
        logEntry(base, "A polished coupe stops beside a locked service gate. The driver disappears inside. The gate stays closed to you.", "");
      }
      base.run.rngState = random.state;
      const advanced = advanceRun(base, { reason: "WANDER_SPENARD", suppressStory: meetsBoost || meetsGoodie });
      if (meetsBoost && advanced.run.status === "playing") {
        advanced.run.pendingEvent = firstBoostOpportunityEvent();
      } else if (meetsGoodie && advanced.run.status === "playing") {
        advanced.flags.goodieEncounterSeen = true;
        advanced.run.pendingEvent = plugIntroductionEvent("goodie");
      }
      return advanced;
    }
    if (action.type === "WORK_JOB") return resolveJobShift(inputState, action);
    if (action.type === "WORK_SHIFT") return resolveJobShift(inputState, { ...action, type: "WORK_JOB", jobId: "ship_creek", approach: action.approach || "work_hard" });
    if (action.type === "NIGHT_OWL_STASH_CASH") {
      if (!nightOwlStashAvailability(state).available) return inputState;
      const amount = Math.max(0, Math.floor(Number(action.amount) || 0));
      const stash = base.jobs.nightOwlStash;
      if (!amount) return inputState;
      if (action.direction === "store") {
        const used = stash.dirtyCash + stash.cleanCash;
        if ((stash.mode && stash.mode !== "cash") || amount > base.player.cash || used + amount > 300) return inputState;
        const dirty = Math.min(base.player.dirtyCash, amount);
        base.player.cash -= amount; base.player.dirtyCash -= dirty; base.player.cleanCash -= amount - dirty;
        stash.dirtyCash += dirty; stash.cleanCash += amount - dirty; stash.mode = "cash";
      } else if (action.direction === "retrieve") {
        const available = stash.dirtyCash + stash.cleanCash;
        if (amount > available) return inputState;
        const dirty = Math.min(stash.dirtyCash, amount);
        stash.dirtyCash -= dirty; stash.cleanCash -= amount - dirty;
        base.player.cash += amount; base.player.dirtyCash += dirty; base.player.cleanCash += amount - dirty;
        if (!stash.dirtyCash && !stash.cleanCash) stash.mode = null;
      } else return inputState;
      logEntry(base, `${action.direction === "store" ? "Stashed" : "Retrieved"} $${amount} at the Night Owl.`, "good");
      return base;
    }
    if (action.type === "NIGHT_OWL_STASH_PRODUCT") {
      if (!nightOwlStashAvailability(state).available) return inputState;
      const qty = Math.max(0, Math.floor(Number(action.qty) || 0));
      const carried = base.player.inventory[action.productId];
      const stash = base.jobs.nightOwlStash;
      const stored = stash.inventory[action.productId];
      if (!qty || !carried || !stored) return inputState;
      const used = Object.values(stash.inventory).reduce((sum, item) => sum + item.qty, 0);
      if (action.direction === "store") {
        if ((stash.mode && stash.mode !== "product") || carried.qty < qty || used + qty > 3) return inputState;
        const total = stored.qty + qty;
        stored.avgCost = total ? ((stored.avgCost * stored.qty) + carried.avgCost * qty) / total : 0;
        stored.qty = total; carried.qty -= qty; if (!carried.qty) carried.avgCost = 0; stash.mode = "product";
      } else if (action.direction === "retrieve") {
        if (stored.qty < qty || cargoUsed(base) + qty > cargoCapacity(base)) return inputState;
        const total = carried.qty + qty;
        carried.avgCost = total ? ((carried.avgCost * carried.qty) + stored.avgCost * qty) / total : 0;
        carried.qty = total; stored.qty -= qty; if (!stored.qty) stored.avgCost = 0;
        if (!Object.values(stash.inventory).some((item) => item.qty > 0)) stash.mode = null;
      } else return inputState;
      logEntry(base, `${action.direction === "store" ? "Stashed" : "Retrieved"} ${qty} ${PRODUCT_BY_ID[action.productId].name} at the Night Owl.`, "good");
      return base;
    }
    if (action.type === "BUY_BUS_PASS") {
      const kind = action.passType;
      const cost = kind === "day" ? 12 : kind === "week" ? 45 : 0;
      if (!cost || state.player.cash < cost) return inputState;
      base.player.cash -= cost;
      if (kind === "day") base.world.transport.dayPassDay = base.run.day;
      else base.world.transport.weekPass = true;
      logEntry(base, `You buy a ${kind === "day" ? "day" : "seven-day"} People Mover pass for $${cost}.`, "good");
      return base;
    }
    if (action.type === "BUS_TRAVEL") {
      const destination = action.neighborhoodId;
      if (![HOME_DISTRICT_ID, "downtown"].includes(destination) || destination === state.world.currentNeighborhoodId) return inputState;
      const access = travelAvailability(state, destination);
      if (!access.available) return inputState;
      const cost = access.cashCost;
      base.player.cash -= cost;
      base.world.currentNeighborhoodId = destination;
      recordVisitedLocation(base, destination);
      base.world.transport.busRides += 1;
      let arrival = null;
      if (destination === "downtown") { base.world.transport.downtownKnown = true; arrival = downtownArrivalEvent(base); }
      logEntry(base, `The People Mover carries you to ${AREA_BY_ID[destination].name}${cost ? " for $5" : " on your pass"}.`, "");
      const advanced = advanceRun(base, { reason: "BUS_TRAVEL", suppressStory: !!arrival });
      if (arrival && advanced.run.status === "playing" && !advanced.run.pendingEncounter) advanced.run.pendingEvent = arrival;
      return advanced;
    }
    if (action.type === "WALK_HOME") {
      if (state.world.currentNeighborhoodId === HOME_DISTRICT_ID) return inputState;
      base.world.currentNeighborhoodId = HOME_DISTRICT_ID;
      recordVisitedLocation(base, HOME_DISTRICT_ID);
      base.player.health = clamp(base.player.health - 3, 0, 100);
      logEntry(base, "With no fare left, you walk back to Spenard. The trip costs two parts of day and 3 Health.", "warn");
      return advanceRun(base, { reason: "WALK_HOME", timeCost: 2 });
    }
    if (action.type === "TRAVEL") {
      if (!AREA_BY_ID[action.neighborhoodId] || action.neighborhoodId === state.world.currentNeighborhoodId) return inputState;
      if (state.run.premise === "fresh_arrival" && action.neighborhoodId === "downtown") return inputState;
      if (state.run.premise === "fresh_arrival" && action.neighborhoodId === "airport_industrial" && !state.world.transport.industrialRouteKnown) return inputState;
      const access = travelAvailability(state, action.neighborhoodId);
      if (!access.available) return inputState;
      const fare = access.cashCost;
      spendCash(base, fare);
      base.world.currentNeighborhoodId = action.neighborhoodId;
      base.world.transport.busRides += 1;
      recordVisitedLocation(base, action.neighborhoodId);
      const arrival = action.neighborhoodId === "downtown" ? downtownArrivalEvent(base) : null;
      logEntry(base, `You reach ${AREA_BY_ID[action.neighborhoodId].name}${fare ? " for $5" : " on your pass"} before the same headlights can settle behind you.`, "");
      const advanced = advanceRun(base, { reason: "TRAVEL", suppressStory: !!arrival });
      if (arrival && advanced.run.status === "playing" && !advanced.run.pendingEncounter) advanced.run.pendingEvent = arrival;
      return advanced;
    }
    if (action.type === "END_MARKET") { logEntry(base, "The last buyer leaves and the neighborhood starts pricing tomorrow's rumors.", ""); return advanceRun(base, { reason: "END_MARKET" }); }
    if (action.type === "SLEEP_HOME") {
      if (state.people.household.evicted) return inputState;
      base.player.health = clamp(base.player.health + 12, 0, 100);
      logEntry(base, "Yalonda keeps the house quiet. You sleep, eat something basic, and recover twelve Health.", "good");
      addStreetReadEntry(base, "recovery", "rest");
      return advanceRun(base, { reason: "SLEEP_HOME" });
    }
    if (action.type === "LAY_LOW") { logEntry(base, state.base.watched ? "You kill the garage lights, but the sedan across the street never leaves." : "You kill the lights and let North Star forget your vehicle for a few hours.", ""); return advanceRun(base, { reason: "LAY_LOW" }); }
    if (action.type === "VISIT_BASE") {
      if (!state.base.controlled) return inputState;
      const next = advanceRun(base, { reason: "VISIT_BASE" });
      if (next.run.status === "playing") next.base.visiting = true;
      logEntry(next, "The North Star Garage door rolls down behind you. Storage, crew, and upgrades are available until you leave.", "");
      return next;
    }
    if (action.type === "USE_FIRST_AID") {
      const cost = Math.max(0, Math.floor(action.cost || 0));
      const amount = Math.max(1, Math.floor(action.amount || 18));
      if (state.player.health >= 100 || state.player.cash < cost) return inputState;
      spendCash(base, cost);
      base.player.health = clamp(base.player.health + amount, 0, 100);
      base.stats.moneySpent.healing += cost;
      pushConsequence(base, `Immediate first aid restores ${amount} Health.`, "good");
      return base;
    }
    if (action.type === "HEAL") {
      const cost = Math.max(0, Math.floor(action.cost || 0)), amount = Math.max(0, Math.floor(action.amount || 0));
      if (!amount || state.player.health >= 100 || state.player.cash < cost) return inputState;
      base.player.cash -= cost; base.player.health = clamp(base.player.health + amount, 0, 100); base.stats.moneySpent.healing += cost;
      logEntry(base, `The clinic worker closes the curtain and repairs ${amount} health for $${cost}.`, "good");
      addStreetReadEntry(base, "recovery", action.amount >= 40 ? "hospital" : "clinic");
      return advanceRun(base, { reason: "HEAL" });
    }
    if (action.type === "HEAL_AT_BASE") {
      if (!state.base.controlled || !state.base.visiting || state.base.tracks.recovery < 1 || state.player.health >= 100) return inputState;
      const cost = state.base.tracks.recovery >= 2 ? 25 : 45, amount = state.base.tracks.recovery >= 2 ? 35 : 22;
      if (state.player.cash < cost) return inputState;
      base.player.cash -= cost; base.player.health = clamp(base.player.health + amount, 0, 100); base.stats.moneySpent.healing += cost;
      logEntry(base, `The garage first-aid table puts ${amount} health back before the next knock.`, "good");
      addStreetReadEntry(base, "recovery", "base_heal");
      pushConsequence(base, `Immediate first aid restores ${amount} Health.`, "good");
      return base;
    }
    if (action.type === "PAY_DEBT") {
      if (state.lender.status !== "active") return inputState;
      const amount = Math.min(state.lender.balance, Math.max(0, Math.floor(action.amount || 0)));
      if (!amount || state.player.cash < amount) return inputState;
      base.player.cash -= amount; base.lender.balance -= amount; base.lender.payments += amount; base.lender.paymentCount += 1;
      base.lender.paymentHistory.push({ day: base.run.day, slot: base.run.slot, amount });
      base.lender.trust += amount >= 150 ? 1 : 0; base.stats.moneySpent.debt += amount;
      if (!base.lender.balance) {
        base.lender.status = "cleared";
        base.lender.trust += 2; base.lender.clearedAt = { day: base.run.day, slot: base.run.slot }; base.lender.afterPayoffOffer = "available";
        base.flags.drePaidEarly = base.run.day <= base.lender.dueDay;
      }
      base.lender.relationship = relationshipForLender(base.lender, base.run.day);
      recordBehavior(base, "earner", amount >= 150 || !base.lender.balance ? 2 : 1, `dre_payment:${base.run.day}:${base.lender.paymentCount}`, "dre_payment");
      addStreetReadEntry(base, "social", "dre:payment");
      logEntry(base, base.lender.balance ? `Dre counts $${amount} behind the Mini-Mart. $${base.lender.balance} stays written on the note.` : "Dre counts the final stack, tears the note in half, and keeps one piece.", "good");
      base.npc.dre.trust = base.lender.trust;
      if (!base.lender.balance) { base.npc.dre.loansRepaid += 1; base.hustle.sections.shark = sharkUnlocked(base); base.hustle.shark.visible = base.hustle.sections.shark; }
      pushConsequence(base, base.lender.balance ? `$${base.lender.balance} remains on Dre's note.` : "Dre tears the paid note in half.", "good");
      return base;
    }
    if (action.type === "UPGRADE_BASE") {
      if (!state.base.controlled) return inputState;
      const track = action.track, nextLevel = (state.base.tracks[track] || 0) + 1;
      const upgrade = BASE_UPGRADES.find((item) => item.track === track && item.level === nextLevel);
      if (!upgrade || state.player.cash < upgrade.cost) return inputState;
      base.player.cash -= upgrade.cost; base.base.tracks[track] = nextLevel; base.stats.moneySpent.base += upgrade.cost;
      recordBehavior(base, "earner", 2, `base_upgrade:${track}:${nextLevel}`, "safehouse_investment");
      logEntry(base, `${upgrade.name} changes what the garage can protect.`, "good");
      return base;
    }
    if (action.type === "BUY_GEAR") {
      if (!state.base.controlled) return inputState;
      const item = GEAR_BY_ID[action.gearId];
      const price = gearPrice(state, item.id);
      if (!item || state.player.cash < price || (item.id !== "medical_kit" && hasGear(state, item.id))) return inputState;
      base.player.cash -= price; base.stats.moneySpent.gear += price;
      addStreetReadEntry(base, "exploration", `${base.world.currentNeighborhoodId}:gear_shop`);
      if (item.id === "medical_kit") base.player.gear.consumables.medical_kit += 1;
      else {
        base.player.gear.owned.push(item.id);
        if (["weapon", "armor", "utility", "tool"].includes(item.slot)) base.player.gear.equipped[item.slot] = item.id;
      }
      logEntry(base, `${item.name} goes onto the garage shelf and into the week's plan.`, "good");
      return base;
    }
    if (action.type === "RECRUIT_CREW") {
      const crewCapacity = crewCapacityFor(state);
      if (!state.base.controlled || !state.base.visiting || !CREW_BY_ID[action.crewId] || recruitedCrew(state).length >= crewCapacity) return inputState;
      const person = CREW_BY_ID[action.crewId], crew = state.people.crew[action.crewId], cost = recruitmentCost(state, action.crewId);
      if ((!crew.introduced && person.id !== "deshawn") || crew.recruited || state.player.cash < cost || (person.id === "eli" && crew.contactStage !== "recruitable")) return inputState;
      if (person.id === "deshawn" && !deshawnRecruitmentAvailability(state).available) return inputState;
      if (person.id === "deshawn") crew.introduced = true;
      base.player.cash -= cost; crew.recruited = true; crew.status = "active"; crew.loyalty += 1; crew.wageDue = person.wage; base.stats.moneySpent.crew += cost;
      crew.contactStage = "active"; crew.tier = Math.max(1, crew.tier || 0);
      if (person.id === "deshawn") base.flags.extraRentGraceAvailable = true;
      updateBoostTier(base);
      recordBehavior(base, "connector", 3, `recruit:${action.crewId}`, "recruit");
      addStreetReadEntry(base, "social", `${action.crewId}:recruitment`);
      logEntry(base, `${person.name} takes the chair at the garage table. The operation has another person to answer for.`, "good");
      return base;
    }
    if (action.type === "ASSIGN_CREW") {
      if (!state.base.controlled || !state.base.visiting || !CREW_BY_ID[action.crewId] || !CREW_BY_ID[action.crewId].canFieldAssign) return inputState;
      const crew = state.people.crew[action.crewId];
      if (!crew.recruited || crew.assignment) return inputState;
      const allowed = { eli: ["north_run", "outer_run"], pherris: ["source_cocaine", "source_meth"], tone: ["guard_base", "intimidate_buyer"] };
      if (!allowed[action.crewId] || !allowed[action.crewId].includes(action.assignment)) return inputState;
      crew.assignment = action.assignment;
      logEntry(base, `${CREW_BY_ID[action.crewId].name.split(" ")[0]} leaves the garage with one assignment and one promised check-in.`, "");
      return base;
    }
    if (action.type === "PROMOTE_LIEUTENANT" && action.crewId === "eli") {
      if (!state.base.controlled) return inputState;
      const readiness = eliPromotionAvailability(state);
      if (!readiness.available) return inputState;
      base.people.crew.eli.lieutenantStage = "operations_lieutenant";
      const eli = base.people.crew.eli;
      let effectiveness = 0;
      if (base.flags.eliJudgmentTrusted) effectiveness += 1;
      if (base.flags.eliOwnsShare || base.flags.eliPromisedFuture) effectiveness += 1;
      if (base.flags.eliDocked || base.flags.eliToldNoFuture) effectiveness -= 1;
      eli.lieutenantEffectiveness = clamp(effectiveness, 0, 3);
      eli.operationPolicy = "balanced";
      recordBehavior(base, "connector", 3, "eli:lieutenant", "lieutenant_promotion");
      addStreetReadEntry(base, "social", "eli:promotion");
      logEntry(base, "Eli takes the garage's second set of keys. Corners, soldiers, and rotation are his call now.", "good");
      return base;
    }
    if (action.type === "RECRUIT_SOLDIER") {
      if (!state.base.controlled) return inputState;
      const readiness = soldierRecruitAvailability(state);
      if (!readiness.available) return inputState;
      base.player.cash -= readiness.cost;
      const id = `soldier_${base.world.nextSoldierId}`;
      base.world.nextSoldierId += 1;
      base.world.soldiers[id] = { id, blockId: null, hiredDay: base.run.day, status: "active" };
      base.stats.moneySpent.crew += readiness.cost;
      logEntry(base, `Another soldier goes on the payroll. Eli will find him a corner.`, "good");
      return base;
    }
    if (action.type === "ASSIGN_SOLDIER") {
      if (!state.base.controlled) return inputState;
      const readiness = soldierAssignAvailability(state, action.soldierId, action.blockId);
      if (!readiness.available) return inputState;
      base.world.soldiers[action.soldierId].blockId = action.blockId;
      base.world.territoryBlocks[action.blockId].soldiersAssigned.push(action.soldierId);
      logEntry(base, `A soldier posts up on ${SPENARD_BLOCK_BY_ID[action.blockId].name}.`, "");
      // Once Eli is running Operations, hand-placing an individual soldier is
      // a radio call, not a trip — it costs no player time, same as changing
      // his standing policy. The point of the promotion is fewer required
      // actions, not the same actions with an extra title on them.
      return base;
    }
    if (action.type === "SET_ELI_POLICY") {
      if (!eliLieutenantActive(state) || !ELI_OPERATION_POLICIES[action.policy]) return inputState;
      base.people.crew.eli.operationPolicy = action.policy;
      logEntry(base, `Eli switches to a ${ELI_OPERATION_POLICIES[action.policy].label} standing order.`, "");
      return base;
    }
    if (action.type === "CLAIM_BLOCK") {
      if (!state.base.controlled) return inputState;
      const readiness = blockClaimAvailability(state, action.blockId);
      if (!readiness.available) return inputState;
      const definition = SPENARD_BLOCK_BY_ID[action.blockId];
      const occupier = unassignedSoldiers(base)[0];
      if (!occupier) return inputState;
      base.player.cash -= definition.claimCost;
      base.stats.moneySpent.base += definition.claimCost;
      const block = base.world.territoryBlocks[action.blockId];
      block.owner = "player";
      block.capturedDay = base.run.day;
      base.world.soldiers[occupier.id].blockId = action.blockId;
      block.soldiersAssigned.push(occupier.id);
      base.npc.curtis.respect += 1;
      base.hustle.exposure.networkEscalation = true;
      refreshCurtisAttention(base);
      recordBehavior(base, "stickup", 2, `block:${action.blockId}`, "territory_expansion");
      addStreetReadEntry(base, "risk", `block_claim:${base.world.currentNeighborhoodId}`);
      logEntry(base, `${definition.name} answers to your operation now. One soldier posts up immediately. Curtis's people will hear about it.`, "good");
      return advanceRun(base, { reason: "CLAIM_BLOCK" });
    }
    if (action.type === "VISIT_MINA") {
      if (!state.npc.mina.met || !nightOwlAvailability(state).available || state.npc.mina.lastConversationDay === state.run.day) return inputState;
      base.npc.mina.lastConversationDay = state.run.day;
      if (base.npc.mina.trust >= 2) {
        const product = PRODUCTS[stringHash(`${base.run.seed}:mina-tip:${base.run.day}`) % PRODUCTS.length];
        base.effects.rumors.push({ id: `mina_${base.run.day}`, areaId: "north_star_lot", productId: product.id, reliable: true, text: `Mina passes along one reliable Spenard buyer tip for ${product.name}.`, expiresAt: slotNumber(base.run.day + 1, 0) });
      }
      logEntry(base, "Mina keeps the conversation local, direct, and off the clock.", "good");
      return base;
    }
    if (action.type === "BUY_FROM_DEALER") {
      const actions = dealerActions(state, action.dealerId);
      if (!actions.buy.available) return inputState;
      const definition = DEALER_BY_ID[action.dealerId];
      const first = definition.name.split(" ")[0];
      const record = base.people.dealers[action.dealerId];
      const random = makeRandom(base.run.rngState);
      const availableProducts = definition.products.filter((productId) => !!unlockedPlugForProduct(state, productId));
      const productId = random.pick(availableProducts);
      if (!productId) return inputState;
      const unitPrice = Math.max(1, Math.round(tradeUnitPrices(state, productId).buy * (1 - actions.buy.discount)));
      const room = cargoCapacity(state) - cargoUsed(state);
      const units = Math.min(actions.buy.units, room, Math.floor(state.player.cash / unitPrice));
      if (units <= 0) return inputState;
      base.player.cash -= unitPrice * units;
      applyEventEffect(base, { addProduct: { id: productId, qty: units, unitCost: unitPrice } }, random);
      record.standing = Math.min(5, record.standing + 1);
      record.lastTradedDay = base.run.day;
      const plug = PLUG_BY_ID[action.dealerId];
      const plugState = plugRecord(base, action.dealerId);
      let introduction = null;
      if (plug && plugState && plugState.lastPurchaseDay !== base.run.day) {
        plugState.lastPurchaseDay = base.run.day;
        plugState.standing = Math.max(plugState.standing, record.standing);
        syncPlugProductAccess(base, plug.id, true);
        if (plugState.standing >= 4 && plug.introducesNext && !plugState.introducedNext && !base.plugs.unlocked.includes(plug.introducesNext)) {
          plugState.introducedNext = true;
          introduction = plugIntroductionEvent(plug.introducesNext);
        }
      }
      recordBehavior(base, "mover", 1, `dealer_buy:${action.dealerId}:${base.run.day}`, "dealer_buy");
      addStreetReadEntry(base, "social", `${action.dealerId}:business`);
      base.run.rngState = random.state;
      logEntry(base, `${first} counts out ${units} off the books at $${unitPrice} a unit and remembers that you paid without arguing.`, "good");
      if (introduction && base.run.status === "playing") base.run.pendingEvent = introduction;
      return base;
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
      addStreetReadEntry(base, "social", `${action.dealerId}:conversation`);
      base.effects.rumors.push({
        id: `dealer_${action.dealerId}_${base.run.day}_${base.run.slot}`,
        areaId: area.id, productId: product.id, reliable: true,
        text: `${first} says there is money in ${product.name} out in ${area.name} for the next day or so.`,
        expiresAt: slotNumber(base.run.day, base.run.slot) + 4,
      });
      base.run.rngState = random.state;
      logEntry(base, `${first} talks for a while about who is buying where, and none of it is a guess.`, "good");
      return base;
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
      if (state.run.day < checkpointDay(state) - 1 || !allowed.includes(action.planId) || state.run.finalPlanPrepared) return inputState;
      base.run.finalPlan = action.planId; base.run.finalPlanPrepared = true;
      base.stats.majorDecisions.push(`Prepared final plan: ${action.planId}`);
      recordBehavior(base, "earner", 2, `final_plan:${action.planId}`, "day7_plan");
      logEntry(base, `The garage table is cleared for one final plan: ${action.planId.replace("_", " ")}.`, "warn");
      return advanceRun(base, { reason: "PREPARE_FINAL_PLAN" });
    }
    if (action.type === "EXECUTE_FINAL_PLAN") {
      if (state.run.day !== checkpointDay(state) || !state.run.finalPlan || state.run.pendingEncounter) return inputState;
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
      influence: { ...state.world.influence }, minaStatus: state.npc.mina.status, minaTrust: state.npc.mina.trust,
      lenderRelationship: state.lender.relationship, rivalRelationship: state.npc.curtis.relationship,
      bestTrade: state.stats.bestTrade, largestLoss: state.stats.largestLoss, highestHeat: state.stats.highestHeat,
      productsMoved: { ...state.stats.productsMoved }, majorDecisions: [...state.stats.majorDecisions],
      territories, robbery: { ...state.stats.robbery }, takeovers: { ...state.stats.takeovers },
    };
  }

  // ===========================================================================
  // v1.1 presentation selectors.
  //
  // Both of these are pure reads over already-committed state. They never
  // mutate, never advance time, and never touch the RNG — the UI layer decides
  // when to call them. They live here rather than in ui.jsx so the Home model
  // and the action-result diff can be unit tested in Node like every other
  // selector.
  // ===========================================================================

  const cashText = (value) => `$${Math.round(Math.abs(value || 0))}`;
  const signedCash = (value) => `${value >= 0 ? "+" : "−"}${cashText(value)}`;
  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

  // Which systems this run has actually unlocked. Home and the menus read this
  // so a Day 1 arrival never inherits a Day 6 operator's interface: an empty
  // system is hidden outright rather than shown as "Soldiers: 0".
  function homeUnlocks(state) {
    return {
      crew: recruitedCrew(state).length > 0,
      operations: !!state.base.controlled,
      territory: eliLieutenantActive(state),
      soldiers: eliLieutenantActive(state),
      district: controlledBlockCount(state) > 0,
      rival: state.npc.curtis.relationship !== "unaware",
      recovery: state.player.health < 100 || state.player.heat > 0,
    };
  }

  // At most two priorities, ordered by severity. This is deliberately not a
  // task list — 907Hustle should never read like a checklist app.
  function homePriorities(state) {
    const out = [];
    const push = (id, label, detail, tone) => { if (out.length < 2 && !out.some((item) => item.id === id)) out.push({ id, label, detail, tone }); };
    const balance = state.lender.balance;
    const daysLeft = state.lender.dueDay - state.run.day;
    if (balance > 0 && daysLeft < 0) push("debt_overdue", "Debt is past due", "Collection is already moving.", "bad");
    if (state.player.health < 35) push("health_critical", "Health is low", `${state.player.health} of 100. One bad night ends the run.`, "bad");
    if (balance > 0 && daysLeft === 0) push("debt_tonight", "Debt comes due tonight", `${cashText(balance)} still owed.`, "bad");
    if (state.player.heat >= 12) push("heat_critical", "Police attention is critical", "Anything visible carries a real risk.", "bad");
    if (!state.phone.active) push("phone_off", "Phone service is off", "Calls, texts, callbacks, and mobile listings are dark.", "bad");
    if (state.run.day >= state.obligations.rentDueDay) push("rent_due", "Weekly rent is due", `${cashText(WEEKLY_RENT)} cash keeps the room current.`, "bad");
    const pressured = SPENARD_BLOCKS.find((block) => {
      const record = state.world.territoryBlocks[block.id];
      return record && record.owner === "player" && record.lastRaidDay != null && state.run.day - record.lastRaidDay <= 1;
    });
    if (pressured) push("block_pressure", `${pressured.name} under pressure`, "Raided within the last day.", "warn");
    if (balance > 0 && daysLeft === 1) push("debt_tomorrow", "Debt due tomorrow", `${cashText(balance)} still owed.`, "warn");
    if (state.run.day >= state.phone.billDueDay) push("phone_due", "Phone bill is due", `${cashText(PHONE_BILL)} before the grace period ends.`, "warn");
    if (state.player.heat >= 8) push("heat_high", "Police attention is high", "Lay Low or stay off the corners.", "warn");
    if (state.player.health < 60) push("health_hurt", "You are carrying an injury", `${state.player.health} of 100.`, "warn");
    const idle = unassignedSoldiers(state).length;
    if (idle > 0 && (state.people.crew.eli.operationPolicy || "manual") === "manual") push("soldiers_idle", `${plural(idle, "soldier")} unposted`, "Nobody earns on an empty corner.", "warn");
    const wages = recruitedCrew(state).reduce((sum, person) => sum + (state.people.crew[person.id].wageDue || 0), 0);
    if (wages > 0) push("wages_due", "Crew wages unpaid", `${cashText(wages)} owed.`, "warn");
    return out;
  }

  // A short situation paragraph assembled from live state. Describes the
  // player's life, never the game's mechanics.
  function homeSummary(state) {
    const cash = state.player.cash;
    const balance = state.lender.balance;
    const daysLeft = state.lender.dueDay - state.run.day;
    const blocks = controlledBlockCount(state);
    // Framed on net position, not raw cash: Day 1 starts with $1,000 of
    // somebody else's money against a $1,200 note, and "money is moving" would
    // be a lie on the first Morning.
    const net = netWorth(state);
    const hasDreDebt = state.lender.status === "active" || state.lender.status === "cleared";
    const clauses = [
      cash < 150 ? "Cash is thin." : net < 0 ? "You are still underwater on what you owe." : net < 400 ? "You are barely ahead." : net < 2000 ? "Money is moving." : "There is real money running through the operation now.",
      hasDreDebt ? (!balance ? "The note is clear." : daysLeft < 0 ? "The note is past due." : daysLeft === 0 ? "The note comes due tonight." : daysLeft === 1 ? "The note comes due tomorrow." : `The note comes due in ${daysLeft} days.`) : state.run.phase === "week_zero" ? "You are still learning Spenard." : "The pressure clock is moving without a lender balance.",
    ];
    if (blocks > 0) clauses.push(`${plural(blocks, "block")} producing with ${plural(activeSoldierCount(state), "soldier")} posted.`);
    else if (eliLieutenantActive(state)) clauses.push("Eli can place people, but you hold no blocks yet.");
    else if (state.base.controlled) clauses.push("The garage is yours and nobody runs it but you.");
    else if (state.world.locations.explorationCount > 0) clauses.push("You know a few corners, but you own nothing yet.");
    else clauses.push("Most of Spenard is still unfamiliar.");
    if (state.player.heat >= 8) clauses.push("Police attention is high.");
    else if (state.npc.curtis.relationship !== "unaware") clauses.push("Curtis has started paying attention.");
    return clauses.join(" ");
  }

  function homeSituation(state) {
    const area = AREA_BY_ID[state.world.currentNeighborhoodId] || NEIGHBORHOODS[0];
    const band = heatBand(state.player.heat);
    const balance = state.lender.balance;
    const daysLeft = state.lender.dueDay - state.run.day;
    return {
      day: state.run.day, runDays: state.run.checkpointDay || "open", slot: state.run.slot, partLabel: SLOTS[state.run.slot],
      districtName: area.name,
      cash: state.player.cash, health: state.player.health,
      heat: {
        value: state.player.heat,
        label: band.id === "warm" ? "Building" : `${band.label.charAt(0)}${band.label.slice(1).toLowerCase()}`,
        tone: band.tone === "bad" ? "bad" : band.tone === "warn" ? "warn" : "good",
      },
      debt: {
        balance, dueDay: state.lender.dueDay, daysLeft,
        label: balance ? cashText(balance) : "Clear",
        note: !balance ? "Paid in full" : daysLeft < 0 ? "Past due" : daysLeft === 0 ? "Due tonight" : daysLeft === 1 ? "Due tomorrow" : `Due Day ${state.lender.dueDay}`,
        tone: !balance ? "good" : daysLeft <= 0 ? "bad" : daysLeft === 1 ? "warn" : "",
      },
      identity: STREET_IDENTITIES[state.player.streetIdentity] || STREET_IDENTITIES.unproven,
      summary: homeSummary(state),
      priorities: homePriorities(state),
      unlocks: homeUnlocks(state),
      organization: {
        blocks: controlledBlockCount(state), blockTotal: SPENARD_BLOCKS.length,
        soldiers: activeSoldierCount(state), soldierCapacity: soldierCapacity(state),
        district: districtControlTier(state, "north_star_lot").label,
        weeklyIncome: weeklyIncomeEstimate(state), respect: state.npc.curtis.respect,
      },
      household: { present: householdPresence(state), rentDueDay: state.obligations.rentDueDay, warnings: state.people.household.warnings },
    };
  }

  // Titles for the compact action-result overlay. Keyed by dispatched action
  // type; travel overrides this with the district it arrived in.
  const ACTION_RESULT_TITLES = {
    WORK_SHIFT: "Shift Complete", WORK_JOB: "Shift Complete", TRAIN_ATTRIBUTE: "Training Complete", EXPLORE_SPENARD: "Walk Complete", WANDER_SPENARD: "Walk Complete",
    SHOPLIFT: "Attempt Resolved", BOOST: "Boost Resolved", ASK_BOOST_WINDOW: "Window Learned", GAMBLE: "Game Resolved", END_MARKET: "Market Visit Closed",
    SLEEP_HOME: "Night Passed", LAY_LOW: "Laid Low", HEAL: "Treatment Complete",
    PAY_DEBT: "Payment Made", CLAIM_BLOCK: "Block Claimed",
    RECRUIT_SOLDIER: "Soldier Recruited", RECRUIT_CREW: "Crew Recruited", PROMOTE_LIEUTENANT: "Lieutenant Promoted",
    VISIT_BASE: "Garage Open", UPGRADE_BASE: "Upgrade Installed", BUY_GEAR: "Gear Acquired",
    ASSIGN_CREW: "Assignment Given", ELI_TEST_ROUTE: "Test Route Complete", LEASE_GARAGE: "Property Leased",
    VISIT_MINA: "Conversation Finished", VISIT_NIGHT_OWL: "Night Owl Visit", TALK_HOUSEHOLD: "Conversation Finished",
    APPLY_JOB: "Application Left", PAY_PHONE_BILL: "Phone Bill Paid", PAY_RENT: "Rent Paid",
    BUY_FROM_DEALER: "Deal Done", ASK_DEALER: "Word Passed", RESOLVE_EVENT: "Choice Made",
    ROB: "Rob Resolved", CONTACT_VISIT: "Visit Complete", BUY_LAPTOP: "Laptop Acquired",
  };

  // Diffs two committed states into the compact "what just happened" card.
  // Returns null when the action consumed no part of the day, when the run
  // ended, or when a richer operation-result modal already owns the outcome —
  // routine actions get a fast system receipt, story keeps its own surface.
  const ACTION_RESULT_SKIPPED = ["NEW_RUN", "HYDRATE_RUN", "START_RUN", "CHOOSE_BACKGROUND"];
  function actionResult(before, after, actionType) {
    if (!before || !after || after === before) return null;
    if (ACTION_RESULT_SKIPPED.includes(actionType)) return null;
    if (after.run.status !== "playing") return null;
    const dayChanged = after.run.day !== before.run.day;
    const slotChanged = after.run.slot !== before.run.slot;
    if (!dayChanged && !slotChanged) return null;
    // Richer surfaces own their own outcome: a takeover gets the operation
    // modal and a crossed day gets the day summary. Never stack two.
    if (after.run.pendingOperationResult && !before.run.pendingOperationResult) return null;
    if (after.run.daySummary && !before.run.daySummary) return null;
    if (after.run.pendingEncounter && !before.run.pendingEncounter) return null;

    const lines = [];
    const add = (label, value, tone) => { if (lines.length < 4 && !lines.some((line) => line.label === label)) lines.push({ label, value, tone: tone || "" }); };
    const toneOf = (delta) => (delta >= 0 ? "good" : "bad");

    const cleanDelta = after.player.cleanCash - before.player.cleanCash;
    const dirtyDelta = after.player.dirtyCash - before.player.dirtyCash;
    const cashDelta = after.player.cash - before.player.cash;
    if (cleanDelta && dirtyDelta) { add("Clean Cash", signedCash(cleanDelta), toneOf(cleanDelta)); add("Dirty Cash", signedCash(dirtyDelta), toneOf(dirtyDelta)); }
    else if (cleanDelta) add("Clean Cash", signedCash(cleanDelta), toneOf(cleanDelta));
    else if (dirtyDelta) add("Dirty Cash", signedCash(dirtyDelta), toneOf(dirtyDelta));
    else if (cashDelta) add("Cash", signedCash(cashDelta), toneOf(cashDelta));

    const movedTo = after.world.currentNeighborhoodId !== before.world.currentNeighborhoodId ? AREA_BY_ID[after.world.currentNeighborhoodId] : null;
    const raised = Object.keys(after.player.attributes).find((id) => after.player.attributes[id] > before.player.attributes[id]);
    if (raised) add(`${raised.charAt(0).toUpperCase()}${raised.slice(1)}`, `${before.player.attributes[raised]} → ${after.player.attributes[raised]}`, "good");
    const blockDelta = controlledBlockCount(after) - controlledBlockCount(before);
    if (blockDelta) add("Blocks Held", `${controlledBlockCount(after)}/${SPENARD_BLOCKS.length}`, toneOf(blockDelta));
    const soldierDelta = activeSoldierCount(after) - activeSoldierCount(before);
    if (soldierDelta) add("Soldiers", `${activeSoldierCount(after)}/${soldierCapacity(after)}`, toneOf(soldierDelta));
    const debtDelta = after.lender.balance - before.lender.balance;
    if (debtDelta) add("Debt", after.lender.balance ? cashText(after.lender.balance) : "Paid in full", toneOf(-debtDelta));
    const healthDelta = after.player.health - before.player.health;
    if (healthDelta) add("Health", `${after.player.health}/100`, toneOf(healthDelta));
    const heatDelta = after.player.heat - before.player.heat;
    if (heatDelta) add("Heat", `${after.player.heat}/15 · ${heatBand(after.player.heat).label.toLowerCase()}`, toneOf(-heatDelta));
    const respectDelta = after.npc.curtis.respect - before.npc.curtis.respect;
    if (respectDelta) add("Respect", `${respectDelta > 0 ? "+" : "−"}${Math.abs(respectDelta)}`, toneOf(respectDelta));
    const unlocked = PRODUCTS.filter((product) => after.world.productAccess[product.id] && !before.world.productAccess[product.id]);
    if (unlocked.length) add("New Access", unlocked.map((product) => product.name).join(", "), "good");

    const time = {
      from: SLOTS[before.run.slot], to: SLOTS[after.run.slot],
      fromDay: before.run.day, toDay: after.run.day, dayChanged,
      label: dayChanged
        ? `${SLOTS[before.run.slot].toUpperCase()} → DAY ${after.run.day} ${SLOTS[after.run.slot].toUpperCase()}`
        : `${SLOTS[before.run.slot].toUpperCase()} → ${SLOTS[after.run.slot].toUpperCase()}`,
    };
    const newest = after.log[0];
    return {
      title: movedTo ? `Arrived in ${movedTo.name}` : ACTION_RESULT_TITLES[actionType] || "Action Complete",
      actionType: actionType || null,
      lines,
      detail: newest && newest !== before.log[0] ? newest.text : null,
      tone: newest && newest !== before.log[0] ? newest.tone || "" : "",
      time,
    };
  }

  return {
    VERSION, RUN_DAYS, PRESSURE_DAYS, MAX_ENERGY, SLOTS, SAVE_KEY, LEGACY_SAVE_KEYS, PHONE_BILL, WEEKLY_RENT, HOME_DISTRICT_ID, DISTRICT_ACTIONS, WORKING_CAPITAL_RESERVE, GARAGE_DEPOSIT, ATTRIBUTE_THRESHOLDS, PRODUCTS, NEIGHBORHOODS, BACKGROUNDS, STARTING_EDGES, GEAR, BASE_UPGRADES, CREW, TERRITORIES,
    STREET_NAME_MAX, DEFAULT_STREET_NAMES, ATTRIBUTE_DEFAULTS, LEGACY_ATTRIBUTES, STREET_IDENTITIES, sanitizeStreetName,
    CLASSIFICATIONS, EVENT_CHAINS, STORY_REGISTRY, DEALERS, ENTITY_REGISTRY, ENTITY_MATCH_ORDER, PLUGS, BOOST_TARGETS, SPENARD_JOBS, STARTER_JOB_IDS, JOB_APPROACHES, JOB_RANK_THRESHOLDS,
    LISTING_ITEMS, LISTING_CAPACITY, NIGHT_OWL_REGULARS, NIGHT_OWL_BOARD, HOUSEHOLD_NPCS, SOCIAL_CONTACTS, STORY_CONTACTS, PHONE_INTEL, DOWNTOWN_CONTENT_STUBS, DOWNTOWN_AMBIENT,
    SPENARD_BLOCKS, SOLDIER_RECRUIT_COST, SOLDIER_BASE_CAPACITY, SOLDIER_CAPACITY_PER_BLOCK, SOLDIERS_PER_BLOCK_CAP,
    SHARK_BORROWERS, SHARK_TERMS, DRE_MISSIONS, DRE_COLLECTOR_TIERS, ELI_LIEUTENANT_UNLOCK, RESPECT_STAGE_THRESHOLDS,
    DISTRICT_CONTROL_TIERS, DISTRICT_CONTROL_CAPSTONE_BLOCKS, DISTRICT_CONTROL_LABEL, ELI_OPERATION_POLICIES,
    buildEventForTest: activeEvent, storyCandidatesForTest: storyCandidates,
    recordBehaviorForTest: recordBehavior, evaluateStreetIdentityForTest: evaluateStreetIdentity,
    // Street Read is invisible to the player but has to be reachable by tests.
    // Nothing here is imported by ui.jsx.
    streetRead: {
      createStreetRead, addStreetReadEntry, recalculateStreetRead, serializeStreetRead, deserializeStreetRead,
      streetReadTier, streetReadAccessBonus, streetReadRecall, streetReadBonusStock, streetReadShelfItem,
      streetReadWeightMultiplier, streetReadEventCategory, withStreetSmartChoice, maybeStreetReadIntel,
      CATEGORIES: STREET_READ_CATEGORIES, TIER_THRESHOLDS: STREET_READ_TIER_THRESHOLDS,
      INTEL: STREET_READ_INTEL, FLAVOR: STREET_READ_FLAVOR, BONUS_STOCK: STREET_READ_BONUS_STOCK,
      SMART_CHOICES: STREET_SMART_CHOICES, ACTIVITY: STREET_READ_ACTIVITY,
    },
    serializeRun, migrateSave,
    createRun, hydrateRun, inspectSave, reduceGame, advanceRun, selectRunSummary,
    selectors: {
      cargoUsed, cargoCapacity, storedCargoUsed, storageCapacity, storedCashCapacity, inventoryValue, netWorth,
      combatRating, charismaRating, intelligenceRating, derivedRatings,
      operationScore, baseValue, gearValue, heatBand, priceSignal, influenceLabel, encounterChoices, endingLabel,
      crewCapacityFor, gearShopStock, gearPrice, treatmentCost, debtGuidanceAvailable,
      recruitedCrew, workingCapital, safeDebtPayment, debtPaymentPreview, featureAvailability, activityAvailability, layLowPreview, controlled, recruitmentCost, operationGearPower, crewPower,
      territoryPowerEstimate, territoryBenefits, tradeUnitPrices, tradeProjection, takeoverReadiness, robAvailability, eliTestRouteAvailability, minaThreatEligible,
      dealerRecord, dealerActions, dealerStandingLabel, dealerSupplyFactor,
      visibleMarketProducts, plugMaxUnits, unlockedPlugForProduct,
      visibleBoostTargets, boostTargetAvailability, boostChance, boostFenceRate, boostTier,
      controlledBlockCount, eliLieutenantActive, soldierCapacity, activeSoldierCount, blockSoldierCount, blockIntelVisible,
      soldierRecruitAvailability, soldierAssignAvailability, blockClaimAvailability, eliPromotionAvailability,
      weeklyIncomeEstimate,
      dreTrustTier, dreIntroductionEligible, dreMissionAvailability, sharkUnlocked, sharkRiskLabel, sharkLoanAvailability,
      deshawnRecruitmentAvailability, crewTierAvailability,
      districtControlTier, districtHasBlockLayer, unassignedSoldiers,
      homeSituation, homeUnlocks, homePriorities, homeSummary, actionResult,
      juanWorkIntelKnown, jobRankForXp, jobPayRange, discoveredJobs, jobAvailability, quickShift, ambientFlavor, phoneIntel, knownWorkplaceContacts, knownSocialContacts, personalContacts, contactAvailability,
      districtActionAvailability, aroundActions, travelAvailability, householdPresence, nineZeroSevenListAccess,
      nightOwlStashUsed, nightOwlStashAvailability, relationshipLabel,
      checkpointDay, weekZeroProgress, listingSlate, nightOwlBoardItems, nightOwlRegularFor, nightOwlAvailability, listingInventoryValue,
    },
  };
});
