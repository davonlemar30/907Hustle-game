(function (root, factory) {
  const encounters = typeof module === "object" && module.exports ? require("./encounters.js") : root.EncounterSystem;
  const api = factory(encounters);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GameCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (EncounterSystem) {
  "use strict";
  const { normalizeSeed, stringHash, makeRandom, seededShuffle, seededPick, isEligible, getWeight } = require("./src/events/random.js");
  const { effectPreview, event, activeEvent } = require("./src/events/cards.js");
  const { checkpointDay, controlled, slotNumber, blockIntelLevel, blockIntelView, curtisBlockDefense, curtisBlockTargets, curtisNightPlan, curtisPressureBank, curtisPressureLeftover, curtisRetookBlock, compareBlocksByCurtisPriority } = require("./src/selectors.js");
  const Exposure = require("./src/exposure/engine.js");
  const { BANDS, bandFor, bandId, bandLabel } = require("./src/data/disposition-bands.js");
  const { EXPOSURE_NPC_IDS } = require("./src/data/npc-lenses.js");
  const { NPC_CHANNELS, NPC_PRESENCE_AREAS } = require("./src/data/propagation.js");
  const Market = require("./src/data/market.js");
  const MarketEvents = require("./src/events/market-events.js");
  const AttributeData = require("./src/data/attributes.js");
  const Attributes = require("./src/systems/attributes.js");
  const Nile = require("./src/data/nile.js");
  const Mina = require("./src/data/mina.js");
  const Gambling = require("./src/data/gambling.js");
  const GamblingEvents = require("./src/events/gambling-events.js");
  const Crew = require("./src/data/crew.js");
  const Arrest = require("./src/data/arrest.js");
  const CurtisAwareness = require("./src/data/curtis-awareness.js");
  const Territory = require("./src/data/territory.js");
  const Gossip = require("./src/data/gossip.js");
  const Disclosures = require("./src/data/disclosures.js");

  const VERSION = 11;
  const RUN_DAYS = 7;
  // v1.31. Dre fronts you cash and wants it back in a week. This used to be
  // `lender.dueDay = run.checkpointDay`, which meant the note quietly inherited
  // the run's old day-count ending - and removing that ending without rehoming
  // this would have deleted a lose condition rather than freed one.
  const LOAN_TERM_DAYS = 7;
  // v1.33. The note stops growing at twice what was borrowed. The late fee is
  // 8% OF THE BALANCE, compounding daily with a collector multiplier on top and
  // no ceiling - which inside a seven-day run meant about three fees and a real
  // decision, and at forty days meant a measured $1,000 principal reaching a
  // mean balance of $12,700 and a worst case of $22,629. A debt nobody can pay
  // is not pressure, it is wallpaper: the player stops reading the number and
  // the whole obligation stops being a choice.
  //
  // A cap rather than a gentler rate, because the pressure is supposed to come
  // from the collector ladder - the tier escalation, the encounter, the heat -
  // and not from an arithmetic that outruns every income in the game. Dre stops
  // adding to the paper; he does not stop wanting it.
  const LOAN_MAX_BALANCE_MULTIPLIER = 2;
  const PRESSURE_DAYS = 7;
  const MAX_ENERGY = 4;
  const SLOTS = ["Morning", "Afternoon", "Evening", "Night"];
  const SAVE_KEY = "907ogr_v11";
  const LEGACY_SAVE_KEYS = ["907ogr_v10", "907ogr_v9", "907ogr_v8", "907ogr_v7", "907ogr_v6", "907ogr_v5", "907ogr_v4", "907ogr_v3"];
  const PHONE_BILL = 75;
  const WEEKLY_RENT = 150;
  const WORKING_CAPITAL_RESERVE = 150;
  const STREET_NAME_MAX = 16;
  const GARAGE_DEPOSIT = 650;
  const DEFAULT_STREET_NAMES = { shooter: "Steady", hustler: "Silver", strategist: "Quiet", neutral: "Rookie" };
  const { ATTRIBUTE_DEFAULTS, ATTRIBUTE_IDS, ATTRIBUTE_MIN, ATTRIBUTE_MAX } = AttributeData;
  // The six-attribute era. Kept only so migrateSave knows which old keys merge
  // into which new attribute; see the mapping comment in src/data/attributes.js.
  const LEGACY_ATTRIBUTE_GROUPS = {
    combat: ["strength", "endurance", "reflexes"],
    charisma: ["presence", "discipline"],
    intelligence: ["insight", "discipline"],
  };
  // Street Identity used to be assigned nightly from a behavior score and stored.
  // v1.10 derives it on read instead. This table survives so a migrated save can
  // keep its old label as player.historicalIdentity, which is display-only.
  const LEGACY_STREET_IDENTITIES = {
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
  const Districts = require("./src/data/districts.js");
  const { DISTRICT_MODS, DISTRICT_ADJACENCY, DISTRICT_DIFF_STEP, STICK_TARGETS, STICK_TARGET_BY_ID } = Districts;

  const BACKGROUNDS = [
    { id: "shooter", name: "Steady-Hand Shooter", combat: 3, charisma: 1, intelligence: 2, cash: 375, heat: 1, description: "Weapons, direct confrontation, survival, and joining territory attacks are your strongest opening tools." },
    { id: "hustler", name: "Silver-Tongued Hustler", combat: 1, charisma: 3, intelligence: 2, cash: 375, heat: 1, description: "Negotiation, trade margins, recruiting, and relationship choices are your strongest opening tools." },
    { id: "strategist", name: "Strategist", combat: 2, charisma: 1, intelligence: 3, cash: 375, heat: 1, description: "Best at reading danger, intimidation, and judging territory strength." },
  ];
  const STARTING_EDGES = BACKGROUNDS.filter((item) => item.id !== "strategist");
  const BACKGROUND_BY_ID = Object.fromEntries(BACKGROUNDS.map((item) => [item.id, item]));

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

  // --- v1.21 raid defense ---------------------------------------------------
  // The chances themselves live in src/data/territory.js, which is where a
  // balance pass belongs. What lives here is how the garrison meets them.
  //
  // Defense strength is the people who were standing there when it started,
  // times whatever Tone is worth (Crew.toneDefenseMultiplier - 1.0 when he is
  // not on the crew):
  //
  //   defenseStrength = soldiersAssigned.length * RAID_DEFENSE_PER_SOLDIER * tone
  //
  // Both adversaries roll a casualty against it, in takeRaidCasualty:
  //
  //   casualty     assigned.length / defenseStrength - whoever showed up
  //                getting through the people posted. Headcount cancels out on
  //                purpose: a second body is a second target as much as a
  //                second defender, so this is Tone's number alone (1.0
  //                without him, 0.67 at tier 3).
  //
  // Holding the corner is a different question, and after v1.21 only Curtis
  // asks it. A police raid never changes who owns a block, so there is no
  // block-loss roll on that side at all; on Curtis's side the garrison is a
  // divisor on his chance to come at all rather than a save after the fact,
  // which is what keeps v1.20's promise that a second posted soldier halves
  // the chance of losing the corner.
  const RAID_DEFENSE_PER_SOLDIER = Territory.RAID_DEFENSE_PER_SOLDIER;

  // --- v1.20 territory heat trickle -----------------------------------------
  // Held corners cost attention whether or not anybody is posted on them, at
  // heatExposure (1-3) per block per night. Heat is a 0-15 integer, so the
  // trickle is a nightly chance rather than a fractional accumulator: the sum
  // of the held blocks' exposure times this weight, rolled once per crossed day
  // against the tick's seeded RNG. No blocks, no roll - which is also why a
  // player holding nothing gets nothing out of Deshawn.
  //
  // 0.06 puts one held corner at roughly one Heat per twelve nights and the
  // full six-block map at roughly two per three nights. Deshawn's reduction
  // multiplies the chance (Crew.deshawnHeatReduction), so tier 3 turns the full
  // map into something a player can actually carry to Day 14.
  const TERRITORY_HEAT_CHANCE_PER_EXPOSURE = 0.06;
  const TERRITORY_HEAT_CHANCE_CAP = 0.9;

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

  const ELI_LIEUTENANT_UNLOCK = { minLoyalty: 8 }; // 0-10 loyalty scale (was 3 on the old ±delta scale)
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

  // --- v1.13 criminal-economy geography -------------------------------------
  // Every criminal track reads the same two per-district numbers (see
  // src/data/districts.js). Difficulty lands as a chance delta; heat lands as
  // a multiplier applied before the usual 0-15 clamp.
  function districtMods(areaId, track) {
    return DISTRICT_MODS[areaId]?.[track] || { diffMod: 0, heatMod: 1 };
  }
  function districtChanceDelta(state, areaId, track) {
    const mods = districtMods(areaId, track);
    const awareness = state.criminalProfile?.districtAwareness?.[areaId]?.[track] || 0;
    return -(mods.diffMod + Math.floor(awareness / Districts.AWARENESS_DIFF_DIVISOR)) * DISTRICT_DIFF_STEP;
  }
  function districtHeat(state, areaId, track, amount) {
    return amount * districtMods(areaId, track).heatMod;
  }
  // One point of awareness lands where the action happened; half a point
  // reaches each adjacent district a day later. Every 3 points = one
  // difficulty step for that track in that district.
  function recordCriminalActivity(state, areaId, track) {
    // v1.15: any criminal activity resets Curtis's quiet-day clock, and
    // high-volume Spenard dealing (3+ market transactions in a day) reads as
    // exactly the kind of new operation his people get paid to notice.
    const awareness = curtisAwarenessOf(state);
    awareness.lastCriminalDay = state.run.day;
    if (track === "market" && areaId === "north_star_lot") {
      if (awareness.spenardMarketTxDay !== state.run.day) {
        awareness.spenardMarketTxDay = state.run.day;
        awareness.spenardMarketTxCount = 0;
      }
      awareness.spenardMarketTxCount += 1;
      if (awareness.spenardMarketTxCount >= 3 && awareness.marketBumpDay !== state.run.day) {
        awareness.marketBumpDay = state.run.day;
        raiseCurtisAwareness(state, 1);
      }
    }
    const profile = state.criminalProfile;
    if (!profile) return;
    if (!profile.districtAwareness[areaId]) profile.districtAwareness[areaId] = { market: 0, boost: 0, stick: 0 };
    profile.districtAwareness[areaId][track] += 1;
    for (const neighbor of DISTRICT_ADJACENCY[areaId] || []) {
      profile.bleedPending.push({ toDistrict: neighbor, track, amount: Districts.AWARENESS_BLEED_FACTOR, arrivalDay: state.run.day + 1 });
    }
  }
  function resolveBleedArrivals(state) {
    const profile = state.criminalProfile;
    if (!profile || !profile.bleedPending?.length) return;
    const remaining = [];
    for (const entry of profile.bleedPending) {
      if (state.run.day >= entry.arrivalDay) {
        if (!profile.districtAwareness[entry.toDistrict]) profile.districtAwareness[entry.toDistrict] = { market: 0, boost: 0, stick: 0 };
        profile.districtAwareness[entry.toDistrict][entry.track] += entry.amount;
      } else remaining.push(entry);
    }
    profile.bleedPending = remaining;
  }
  // A robbery on a plug's home block makes that plug wary; robbing a plug
  // directly burns standing with every plug at once and spikes suspicion
  // hardest where it happened.
  function bumpPlugSuspicion(state, areaId, options = {}) {
    for (const plug of PLUGS) {
      const record = state.plugs.records[plug.id];
      if (!record) continue;
      if (record.suspicion == null) record.suspicion = 0;
      const homeDistrict = Districts.PLUG_HOME_DISTRICTS[plug.id];
      if (options.direct) {
        // skipStandingFor: the robbed plug's own standing drop is applied at
        // the call site (it also has to sync the dealer mirror there).
        if (plug.id !== options.skipStandingFor) record.standing = Math.max(-5, (record.standing || 0) - 3);
        record.suspicion = Math.min(8, record.suspicion + (homeDistrict === areaId ? 2 : 1));
      } else if (homeDistrict === areaId) {
        record.suspicion = Math.min(8, record.suspicion + 1);
      }
    }
  }
  function plugSuspicion(state, plugId) {
    return state.plugs.records?.[plugId]?.suspicion || 0;
  }




  // v1.17: every boost target carries an Anchorage name and a one-line read of
  // the place (rendered on the Boost screen). Ids never change - tests and
  // saved runs look targets up by id, and the take/tier/window numbers are the
  // balance, which this pass does not touch.
  const BOOST_TARGETS = [
    { id: "night_owl", name: "Night Owl Mini-Mart", areaId: "north_star_lot", tier: 1, take: [15, 40], desc: "The counter you already know. The camera by the back aisle has a blind spot everyone in Spenard learned first." },
    { id: "spenard_fuel", name: "Spenard Chevron", areaId: "north_star_lot", tier: 1, take: [15, 40], desc: "Two pumps and a cooler aisle on Spenard Road. The clerk watches the lot, never the shelves." },
    { id: "fourth_ave_market", name: "Rebel Convenience on 4th", areaId: "downtown", tier: 1, take: [15, 40], desc: "Chips, chargers, single cans. One camera, aimed at the register, exactly like the sticker on the door promises." },
    { id: "downtown_fuel", name: "Holiday on C Street", areaId: "downtown", tier: 1, take: [15, 40], desc: "Downtown gas at downtown prices. The snack aisle sits behind a pillar the security mirror cannot see around." },
    { id: "service_stop", name: "Denali Express", areaId: "airport_industrial", tier: 1, take: [15, 40], desc: "A truck-stop shop off Old Seward. Everything is bolted down except what you came in for." },
    { id: "airport_fuel", name: "Shell on International", areaId: "airport_industrial", tier: 1, take: [15, 40], desc: "Fuel for the airport runs. Half the customers are on the clock and all of them are on their phones." },
    { id: "northern_value", name: "Northern Value", areaId: "north_star_lot", tier: 2, take: [60, 150], windowSlot: 1, desc: "The Spenard thrift barn. Racks too dense to police and tags too cheap for anyone to chase." },
    { id: "midtown_pharmacy", name: "Northern Lights Pharmacy", areaId: "north_star_lot", tier: 2, take: [60, 150], windowSlot: 2, desc: "Strip-mall pharmacy on Northern Lights. The pickup line keeps every eye in the building pointed forward." },
    { id: "fourth_ave_electronics", name: "Gateway Electronics on 4th", areaId: "downtown", tier: 2, take: [60, 150], windowSlot: 3, desc: "Locked cases up front, open stock in the back. The one clerk cannot be both places." },
    { id: "warehouse_club", name: "Arctic Cash & Carry", areaId: "north_star_lot", tier: 3, take: [200, 500], desc: "Pallet aisles off Minnesota Drive. The membership desk checks cards on the way in, never boxes on the way out." },
    { id: "loading_dock_seven", name: "Ship Creek Yards, Dock Seven", areaId: "airport_industrial", tier: 3, take: [200, 500], desc: "Container rows off Ship Creek. The manifest says more than the fence-line cameras ever will." },
    { id: "delivery_route_4", name: "Minnesota Drive Route", areaId: "downtown", tier: 3, take: [200, 500], desc: "A box truck running the same Minnesota Drive loop every day. A schedule is a kind of key." },
  ];
  const BOOST_TARGET_BY_ID = Object.fromEntries(BOOST_TARGETS.map((target) => [target.id, target]));

  const { JOB_RANK_THRESHOLDS, JOB_APPROACHES, SPENARD_JOBS, SPENARD_JOB_BY_ID, STARTER_JOB_IDS } = require("./src/data/jobs.js");

  // Kept as the Tier 1 figure and the export name every caller already uses.
  // How much a player can actually hold is per-tier now: see marketCapacity().
  const LISTING_CAPACITY = Market.MARKET_TIERS[1].capacity;
  const NIGHT_OWL_BOARD = [
    { id: "jobs", title: "Help wanted", body: "Two counters need reliable hands this week." },
    { id: "list", title: "907List", body: "Buy it cheap. Clean it up. Find the next buyer." },
    { id: "game", title: "Late table", body: "A handwritten card promises a game after the doors lock." },
    { id: "garage", title: "North Star Garage", body: "$650 deposit. Heat works. Door sticks in winter." },
    { id: "opportunity", title: "Cash work", body: "A number is torn off every tab except one." },
    { id: "laptop", title: "Used laptop · $250", body: "Battery is tired. Browser works. Charger included." },
    { id: "gym", title: "Community gym", body: "First membership is $30. Training costs extra." },
    Nile.BOARD_FLYER,
  ];
  const DOWNTOWN_CONTENT_STUBS = ["circle_k", "fourth_avenue_bars", "rei"];
  const DOWNTOWN_AMBIENT = [
    "Construction on 4th Ave. A few bars gear up for the evening. Nothing pulls at you yet.",
    "Downtown foot traffic. People in work clothes head somewhere with purpose. You are just passing through.",
  ];

  // What counts as a flip worth learning from. Below this the sale is a wash and
  // the player learned nothing about appraisal they did not already know.
  const PROFITABLE_FLIP_MARGIN = 1.3;

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
    // The Nile. Two entries because they are two floors with different hours and
    // different gates, the same way night_owl and its sub-actions are separate
    // rows rather than one entry with a mode flag.
    //
    // v1.11 retired `spenard_gambling` (the abstract GAMBLE stat-check) in favour
    // of these. The discovery path that used to open it - Cal at the Night Owl -
    // now opens the Den, so the narrative beat survived and only the fake dice
    // roll went away.
    the_nile: {
      id: "the_nile", areaId: HOME_DISTRICT_ID, slots: Nile.WELLNESS_SLOTS, cashCost: 0, timeCost: 0, healthCost: 0,
      action: null, around: false, order: 35, closedReason: "Blue Nile closes at eight.",
      visibleWhen: (state) => !!state.world.locations.theNile?.discovered,
    },
    the_nile_wellness: {
      id: "the_nile_wellness", areaId: HOME_DISTRICT_ID, slots: Nile.WELLNESS_SLOTS,
      cashCost: Nile.WELLNESS_COST, timeCost: 1, healthCost: 0,
      action: { type: "NILE_WELLNESS" }, around: false,
      closedReason: "Blue Nile closes at eight.",
      visibleWhen: (state) => !!state.world.locations.theNile?.discovered,
    },
    the_nile_den: {
      id: "the_nile_den", areaId: HOME_DISTRICT_ID, slots: Nile.DEN_SLOTS, cashCost: 0, timeCost: 0, healthCost: 0,
      action: null, around: false, order: 36, closedReason: "The stairwell door stays shut until evening.",
      visibleWhen: (state) => !!state.world.locations.theNile?.secondFloorAccess,
    },
    the_nile_coffee: {
      id: "the_nile_coffee", areaId: HOME_DISTRICT_ID, slots: Nile.DEN_SLOTS, cashCost: 0, timeCost: 1, healthCost: 0,
      action: { type: "NILE_COFFEE" }, around: false,
      closedReason: "The stairwell door stays shut until evening.",
      visibleWhen: (state) => !!state.world.locations.theNile?.secondFloorAccess,
    },
    the_nile_tonk: {
      id: "the_nile_tonk", areaId: HOME_DISTRICT_ID, slots: Nile.DEN_SLOTS,
      cashCost: (_state, params) => Math.max(0, Math.floor(params.buyIn || 0)), timeCost: 1, healthCost: 0,
      action: { type: "NILE_TONK_SIT" }, around: false,
      closedReason: "The stairwell door stays shut until evening.",
      visibleWhen: (state) => !!state.world.locations.theNile?.secondFloorAccess,
    },
    the_nile_celo: {
      id: "the_nile_celo", areaId: HOME_DISTRICT_ID, slots: Nile.DEN_SLOTS,
      cashCost: (_state, params) => Math.max(0, Math.floor(params.buyIn || 0)), timeCost: 1, healthCost: 0,
      action: { type: "NILE_CELO_SIT" }, around: false,
      closedReason: "The stairwell door stays shut until evening.",
      visibleWhen: (state) => !!state.world.locations.theNile?.secondFloorAccess,
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
    // The Downtown meetup point. A routing entry like night_owl and local_intel:
    // it costs nothing to walk up to, and the slot is charged by whichever
    // 907List action the player takes once the board is open. Downtown listings
    // pay a 30% better margin and carry a 1.8x robbery multiplier, which is the
    // whole reason to make the trip.
    downtown_907list_meetup: {
      id: "downtown_907list_meetup", areaId: "downtown", slots: ALL_DAY_SLOTS, cashCost: 0, timeCost: 0, healthCost: 0,
      action: null, around: true, order: 15,
      visibleWhen: (state) => !!state.knowledge?.knows907List && marketTierConfig(state).districts.includes("downtown"),
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
    SHOPLIFT: "northern_value_shoplift", VIEW_NIGHT_OWL_BOARD: "night_owl_board",
    NILE_WELLNESS: "the_nile_wellness", NILE_COFFEE: "the_nile_coffee",
    NILE_TONK_SIT: "the_nile_tonk", NILE_CELO_SIT: "the_nile_celo",
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
      summary: (s) => `She rents you the spare room. ${bandLabel(bandOf(s, "yalonda"))} with you; rent is due Day ${s.obligations.rentDueDay}.`, actions: ["TALK_HOUSEHOLD"] },
    { id: "juan", name: "Juan Hernandez", role: "Yalonda's son", visibleWhen: () => true,
      status: (s) => s.people.household.lastQuestionDay === s.run.day ? "Talked today" : "Available",
      summary: (s) => `Warehouse loader and local connector. ${bandLabel(bandOf(s, "juan"))} with you.`, actions: ["TALK_HOUSEHOLD"] },
    { id: "mina", name: "Mina Vale", role: "Night Owl clerk", visibleWhen: (s) => s.npc.mina.met,
      status: (s) => s.npc.mina.status, summary: (s) => `Mina remembers the ${s.npc.mina.introChoice || "guarded"} first conversation.`, actions: ["VISIT_MINA"] },
    { id: "dre", name: "Dre Smooth", role: "Lender", visibleWhen: (s) => ["active", "cleared"].includes(s.lender.status),
      status: (s) => s.lender.relationship, summary: (s) => `$${s.lender.balance} remains on the note due Day ${s.lender.dueDay}.`, actions: ["OPEN_FINANCES"] },
    // v1.27. He is here because the disclosure table needs a door to him: he
    // sells the block-vulnerability read and there was nowhere on the phone to
    // ask. Nothing else about Biniam moves - he is still met at The Nile, still
    // has no call/text/visit verbs, and this card is a place to stand.
    { id: "biniam", name: "Biniam Tesfaye", role: "The Nile, second floor", visibleWhen: (s) => s.npc.biniam.met,
      status: (s) => bandLabel(bandOf(s, "biniam")),
      summary: (s) => `He runs the room upstairs and hears what the table says. ${bandLabel(bandOf(s, "biniam"))} with you.`, actions: [] },
    // v1.30, and the same reason Biniam is here: the disclosure table needs a
    // door. He is the first crew source, and crew live on the People screens
    // rather than in the phone book, so without this card the territory_status
    // row had nowhere to be asked for. Gated on him actually being on the
    // payroll - a lieutenant who was never hired is not a contact, and one who
    // walked stops being one. No call/text/visit verbs: this is a place to
    // stand, and everything else about Tone is unchanged.
    { id: "tone", name: "Anton 'Tone' Bell", role: "Enforcer", visibleWhen: (s) => crewIsActive(s, "tone"),
      status: (s) => `Loyalty ${s.people.crew.tone.loyalty}/10`,
      summary: (s) => `He walks your corners at first light and reports what he counted. ${bandLabel(bandOf(s, "tone"))} with you.`, actions: [] },
    { id: "curtis", name: "Curtis Foyer", role: "Rival", visibleWhen: (s) => s.npc.curtis.relationship !== "unaware",
      status: (s) => s.npc.curtis.relationship, summary: (s) => `He reads you as ${s.npc.curtis.relationship}.`, actions: [] },
    { id: "simone", name: "Simone Hart", role: "Independent protection organizer", visibleWhen: (s) => s.npc.simone.known,
      status: (s) => s.npc.simone.truce ? "Truce" : s.npc.simone.threat > 0 ? "Watching" : "Independent",
      summary: (s) => `She reads you as ${bandLabel(bandOf(s, "simone"))}. Leverage ${s.npc.simone.leverage}.`, actions: [] },
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
    // Milestones stay deduplicated the way they always were; what changes is
    // that each one now lands in his ledger as the kind of thing it actually
    // was, instead of incrementing a single undifferentiated counter.
    const MILESTONE_TYPES = { units_10: "growth", units_25: "growth", units_50: "growth", revenue_600: "financial", revenue_1200: "financial", spenard_sale: "growth", named_report: "defiance", network_escalation: "defiance", tax_rejected: "defiance" };
    Exposure.recordObservation(state, "curtis", { type: MILESTONE_TYPES[id] || "growth", event: id, source: "network" });
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
    if (!curtisHostile(state) || curtis.friendship || curtis.taxActive) return false;
    if (choice === "pay_tax") curtis.taxActive = true;
    else if (choice === "friendship") {
      curtis.friendship = "accepted";
      curtis.friendshipDay = state.run.day;
      curtis.protectionUntilDay = state.run.day + 2;
    } else if (choice === "guarded") {
      curtis.friendship = "guarded";
      Exposure.recordObservation(state, "curtis", { type: "submission", event: "stood_guarded", source: "witnessed" });
    } else if (choice === "reject") {
      curtis.friendship = "rejected";
      Exposure.recordObservation(state, "curtis", { type: "defiance", event: "rejected_tax", source: "witnessed" });
      awardCurtisExposure(state, "tax_rejected", true);
    } else return false;
    curtis.relationship = relationshipForRival(state);
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
  // Combat, Charisma, and Intelligence are stored now, not derived. The *Rating
  // helpers survive as the compatibility scale - see compatibilityRating in
  // src/systems/attributes.js for why the offset is there - so crew power,
  // takeover odds, boost difficulty, and trade pricing behave on Day 1 exactly
  // as they did before the consolidation. Anything wired to resolveWithAttribute
  // reads the raw value through attributeOf instead and carries no inline term.
  function normalizedAttributes(state) { return Attributes.normalizedAttributes(state); }
  // What a reader gets: the stored attributes themselves.
  function combatRating(state) { return normalizedAttributes(state).combat; }
  function charismaRating(state) { return normalizedAttributes(state).charisma; }
  function intelligenceRating(state) { return normalizedAttributes(state).intelligence; }
  function derivedRatings(state) { return normalizedAttributes(state); }
  // What the pre-v1.10 formulas get: the 1-5 scale they were tuned against, with
  // the starting attribute mapped onto the old starting value. See
  // compatibilityRating in src/systems/attributes.js for why the offset exists.
  function combatCompat(state) { return Attributes.compatibilityRating(state, "combat"); }
  function charismaCompat(state) { return Attributes.compatibilityRating(state, "charisma"); }
  function intelligenceCompat(state) { return Attributes.compatibilityRating(state, "intelligence"); }
  function attributeOf(state, attribute) { return Attributes.effectiveAttribute(state, attribute); }
  function normalizedAttributeProgress(progress) {
    const source = progress && typeof progress === "object" ? progress : {};
    const out = {};
    for (const id of ATTRIBUTE_IDS) {
      const value = Number(source[id]);
      out[id] = Number.isFinite(value) && value > 0 ? Math.min(1, value) : 0;
    }
    return out;
  }
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

  function logEntry(state, text, tone) {
    state.log.unshift({ text, tone: tone || "", stamp: `Day ${state.run.day} · ${SLOTS[state.run.slot]}` });
    state.log = state.log.slice(0, 80);
  }
  // `title` is optional and almost always absent (v1.24). A consequence is
  // usually one line about what just happened, and a heading on top of one line
  // is noise. Ceremony beats are the exception: the first corner claimed reads
  // as a moment, not as feedback, and the heading is what makes it land. Cards
  // written before this field existed - including ones sitting in an old save's
  // queue - come through with `title: ""` and render exactly as they did.
  function pushConsequence(state, text, tone, title) {
    state.run.consequenceQueue = state.run.consequenceQueue || [];
    state.run.consequenceQueue.push({ id: `${state.run.day}:${state.run.slot}:${state.run.consequenceQueue.length}:${stringHash(text)}`, text, tone: tone || "", title: title || "" });
    state.run.consequenceQueue = state.run.consequenceQueue.slice(-6);
  }
  // v1.29: `action` is an optional descriptor that lets a text be answered from
  // the phone instead of only reporting that something happened. It is a plain
  // tag - `{ kind, jobId }` - and the UI maps a kind to buttons that dispatch
  // reducer cases that already exist. Messages written before this build carry
  // no `action` and stay informational, which is why nothing needed migrating.
  function pushPhoneMessage(state, from, text, action) {
    const item = { id: `${state.run.day}:${state.run.slot}:${stringHash(`${from}:${text}`)}`, from, text, day: state.run.day, slot: state.run.slot, read: false };
    if (action) item.action = action;
    if (state.phone.active) state.phone.inbox.unshift(item);
    else state.phone.heldInbox.push(item);
    return item;
  }
  // An offer answered from anywhere - the phone, the Jobs screen - takes its own
  // text down with it. Otherwise the inbox keeps a card whose Accept button has
  // nothing left to accept, which is the dead tap this build is removing.
  function retireOfferMessages(state, jobId) {
    const live = (message) => !(message.action && message.action.kind === "job_offer" && message.action.jobId === jobId);
    state.phone.inbox = state.phone.inbox.filter(live);
    state.phone.heldInbox = state.phone.heldInbox.filter(live);
  }

  function resolveJobApplications(state) {
    const now = slotNumber(state.run.day, state.run.slot);
    const waiting = [];
    for (const application of state.jobs.applications) {
      const applied = slotNumber(application.appliedAtDay, application.appliedAtSlot);
      if (now - applied < 2 || !state.phone.active) { waiting.push(application); continue; }
      const job = SPENARD_JOB_BY_ID[application.jobId];
      // Applying used to be a formality - every application became an offer.
      // It is a real interview now, read through Charisma. Heat costs you here
      // too: a manager who has heard things is a harder room.
      const chance = clamp(0.62 - Math.max(0, state.player.heat - 4) * 0.04, 0.25, 0.95);
      const outcome = resolveOutcome(state, "job_interview", chance, `${state.run.seed}:job_interview:${application.jobId}:${application.appliedAtDay}:${application.appliedAtSlot}`);
      broadcastOutcome(state, "job_interview", outcome.tier);
      if (!Attributes.isSuccessTier(outcome.tier)) {
        pushPhoneMessage(state, job.name, "We went with someone else this time. You can try again.");
        logEntry(state, `${job.name} passed. Nothing stops you applying again.`, "bad");
        continue;
      }
      if (application.jobId !== state.jobs.activeJobId && !state.jobs.offers.includes(application.jobId)) state.jobs.offers.push(application.jobId);
      pushPhoneMessage(state, job.name, `We have an offer for you. Call back when you're ready to commit.`, { kind: "job_offer", jobId: job.id });
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
  // Street Identity is derived on read now - see Attributes.getStreetIdentity.
  // The nightly assignment loop, its two-night hysteresis, and the stored label
  // are gone; what survives is the behavior ledger below, which still feeds the
  // Character screen's recent-reputation list and nothing else.
  // The keystone of the unified pipeline: an outcome's tier decides what the
  // neighborhood ends up knowing. Better outcomes are not invisible, they are
  // quiet - a clean job still writes its row, it just travels on `direct`
  // instead of going out to the network.
  //
  // Adding a new action is two entries and no new code: a tier shape in
  // OUTCOME_SHAPES and an observation map in OUTCOME_OBSERVATIONS.
  // --- Curtis ambient awareness (v1.15) ------------------------------------
  // How hard Curtis's people are looking for the player. Fed by criminal
  // observations that actually reach Curtis through the network channel, plus
  // volume signals (heavy Spenard dealing, successful robberies). Distinct
  // from his disposition ledger and from police district awareness.
  function curtisAwarenessOf(state) {
    if (!state.curtisAwareness) {
      state.curtisAwareness = {
        level: 0, phase: "invisible", floor: 0, lastIncrementDay: null,
        watchersSeen: 0, lastWatcherDay: null, recentWatcherLines: [],
        quietStreak: 0, lastCriminalDay: null,
        spenardMarketTxDay: null, spenardMarketTxCount: 0, marketBumpDay: null,
        phaseMessagesSent: [],
      };
    }
    return state.curtisAwareness;
  }
  function refreshAwarenessPhase(state) {
    const awareness = curtisAwarenessOf(state);
    const phase = CurtisAwareness.phaseForLevel(awareness.level);
    if (phase === awareness.phase) return;
    awareness.phase = phase;
    const floor = CurtisAwareness.phaseFloor(phase);
    if (floor > awareness.floor) awareness.floor = floor;
    // One Word Around Town text per phase reached, ever - not daily spam.
    const message = CurtisAwareness.PHASE_MESSAGES[phase];
    if (message && !awareness.phaseMessagesSent.includes(phase)) {
      awareness.phaseMessagesSent.push(phase);
      pushPhoneMessage(state, "Word Around Town", message);
    }
  }
  function raiseCurtisAwareness(state, amount) {
    const awareness = curtisAwarenessOf(state);
    awareness.level = clamp(awareness.level + amount, 0, CurtisAwareness.AWARENESS_MAX);
    awareness.lastIncrementDay = state.run.day;
    refreshAwarenessPhase(state);
  }
  // Broadcast an observation and, when it genuinely lands on Curtis through
  // the network channel, count it against the player's ambient visibility.
  // The Nile stays dark: nothing that happens inside raises awareness, which
  // matches the propagation rule that its broadcasts never ride network.
  function broadcastTracked(state, spec) {
    const reached = Exposure.broadcastObservation(state, spec);
    const location = spec.location || state.world.currentNeighborhoodId;
    if (spec.channel === "network" && Array.isArray(reached) && reached.includes("curtis") && location !== Nile.NILE_LOCATION_ID) {
      raiseCurtisAwareness(state, 1);
    }
    return reached;
  }
  // Watcher encounters: ambient, non-blocking flavor while moving through
  // Spenard once Curtis's people are looking. At most one per day. Rolled off
  // stringHash, never the rng stream, so runs that never qualify keep their
  // exact event sequence. These are UI texture, not observations - no ledger
  // row, no card, nothing to resolve.
  function maybeWatcherEncounter(state, context, oldDay, oldSlot) {
    const awareness = curtisAwarenessOf(state);
    if (awareness.phase === "invisible") return;
    if (state.world.currentNeighborhoodId !== "north_star_lot") return;
    if (!CurtisAwareness.WATCHER_ELIGIBLE_REASONS.includes(context.reason)) return;
    if (awareness.lastWatcherDay === oldDay) return;
    const roll = (stringHash(`${state.run.seed}:curtis:watcher:${oldDay}:${oldSlot}`) % 10000) / 10000;
    if (roll >= CurtisAwareness.watcherChance(awareness.level)) return;
    const pool = CurtisAwareness.WATCHER_LINES[awareness.phase] || CurtisAwareness.WATCHER_LINES.ambient;
    const fresh = pool.filter((line) => !awareness.recentWatcherLines.includes(line));
    const candidates = fresh.length ? fresh : pool;
    const line = candidates[stringHash(`${state.run.seed}:curtis:watcher:line:${awareness.watchersSeen}`) % candidates.length];
    awareness.watchersSeen += 1;
    awareness.lastWatcherDay = oldDay;
    awareness.recentWatcherLines = [...awareness.recentWatcherLines, line].slice(-3);
    logEntry(state, line, "warn");
    pushConsequence(state, line, "warn");
  }
  // v1.17: Mina's counter line for this visit. Same discipline as the watcher
  // pool above - stringHash off seed/day/slot, never the rng stream, a last-3
  // exclusion window, and no writes beyond the rotation memory. She reads the
  // player before the register: a recent arrest first, then an injury, then a
  // pocket full of money; otherwise the disposition band and her shift decide
  // the register. The Night Owl keeps Evening/Night hours, so slot 2 is the
  // on-shift voice and slot 3 is the shop-to-herself voice.
  function pickMinaLine(state) {
    const day = state.run.day; const slot = state.run.slot;
    const arrestedRecently = state.record?.lastArrestDay != null && day - state.record.lastArrestDay <= Mina.MINA_ARREST_RECENT_DAYS;
    const statePool = arrestedRecently ? Mina.MINA_STATE_LINES.arrested
      : state.player.health < Mina.MINA_INJURED_HEALTH ? Mina.MINA_STATE_LINES.injured
      : state.player.cash >= Mina.MINA_FLUSH_CASH ? Mina.MINA_STATE_LINES.flush
      : null;
    const bands = Mina.MINA_LINES[Mina.minaBandKey(Exposure.getDispositionBand("mina", state))];
    const pool = statePool || (slot >= 3 ? bands.late : bands.early);
    const recent = state.nightOwl.recentMinaLines || [];
    // A pool the size of the memory window would otherwise repeat a line seen
    // two visits ago when it exhausts, so the fallback relaxes progressively:
    // exclude the full window first, then just the freshest two.
    const fresh = pool.filter((line) => !recent.includes(line));
    const relaxed = fresh.length ? fresh : pool.filter((line) => !recent.slice(-2).includes(line));
    const candidates = relaxed.length ? relaxed : pool;
    const line = candidates[stringHash(`${state.run.seed}:mina-line:${day}:${slot}`) % candidates.length];
    state.nightOwl.recentMinaLines = [...recent, line].slice(-Mina.MINA_RECENT_LIMIT);
    return line;
  }
  function broadcastOutcome(state, actionType, tier, value) {
    const specs = AttributeData.OUTCOME_OBSERVATIONS[actionType]?.[tier] || [];
    for (const spec of specs) {
      broadcastTracked(state, {
        ...spec,
        location: spec.location || state.world.currentNeighborhoodId,
        value: value == null ? spec.value ?? null : value,
        day: state.run.day,
      });
    }
    return specs.length;
  }
  // A check that reads an attribute spends whichever streak is banked against
  // it. Both are spent on use rather than carried, so three days of discipline
  // buys exactly one better roll and then it is gone.
  function resolveOutcome(state, actionType, chance, key, bonus) {
    const outcome = Attributes.resolveAction(state, actionType, chance, key, bonus);
    const attribute = AttributeData.ACTION_ATTRIBUTE_MAP[actionType];
    if (Attributes.gymStreakBonus(state, attribute)) { state.player.gymStreak = 0; state.player.gymStreakDay = null; }
    if (Attributes.nileStreakBonus(state, attribute)) {
      state.player.nileStreak = 0;
      state.player.nileStreakDay = null;
      state.player.nileStreakAttribute = null;
    }
    return outcome;
  }
  // Standing gains slow down as they climb, so nobody is maxed out with most of
  // the week still ahead of them. Integer standings take the braked value as a
  // hashed chance of a whole point rather than growing a decimal the UI would
  // have to explain; floats (job coworker relationship) take it directly.
  function standingGain(record, current, rawGain, ladder) {
    return Attributes.bankStandingGain(record, current, rawGain, ladder);
  }
  function standingGainFloat(current, rawGain, ladder) {
    return Attributes.adjustedStandingGain(current, rawGain, ladder);
  }
  // A purchase that resolves to nothing must not resolve to a silent no-op.
  //
  // This is a guard, not a root-cause fix: the reducer already returned early
  // without deducting cash, so the money was never at risk - what was missing
  // was any signal to the player that the tap they made did nothing.
  function failedPurchase(state, productId, source) {
    logEntry(state, "Transaction failed. Try again.", "bad");
    pushConsequence(state, "Transaction failed. Try again.", "bad");
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[907] purchase resolved to zero units", {
        source, productId, day: state.run.day, slot: state.run.slot,
        catalog: PRODUCTS.map((item) => item.id),
        access: { ...state.world.productAccess },
      });
    }
    return state;
  }
  function streetIdentity(state) { return Attributes.getStreetIdentity(state); }
  function streetIdentityView(state) { return Attributes.describeStreetIdentity(state); }
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
    BUY_907LIST: "trade", DELIVER_907LIST: "trade", QUICK_SELL_907LIST: "trade", FILL_BUYER_REQUEST: "trade", BUY_BULK_907LIST: "trade",
    VISIT_NIGHT_OWL: "social", CONTACT_VISIT: "social", RECRUIT_CREW: "social", ASSIGN_CREW: "social", PROMOTE_LIEUTENANT: "social", PAY_DEBT: "social", RECRUIT_SOLDIER: "social",
    HEAL: "heal", HEAL_AT_BASE: "heal", LAY_LOW: "rest", SLEEP_HOME: "rest",
    WORK_SHIFT: "work", WORK_JOB: "work", SHOPLIFT: "work", BOOST: "work", ASK_BOOST_WINDOW: "social",
    EXPLORE_SPENARD: "explore", WANDER_SPENARD: "explore", VISIT_BASE: "explore", LEASE_GARAGE: "explore", TRAIN_ATTRIBUTE: "explore", BUY_GEAR: "explore", UPGRADE_BASE: "explore",
    NILE_TONK_SIT: "gamble", NILE_CELO_SIT: "gamble", NILE_WELLNESS: "heal", NILE_COFFEE: "social",
    TRAVEL: "travel", BUS_TRAVEL: "travel", WALK_HOME: "travel",
    ROB: "risk", ROB_DEALER: "risk", TAKEOVER: "risk", ELI_TEST_ROUTE: "risk", CLAIM_BLOCK: "risk",
  };

  // What each kind of action looks like from the outside.
  //
  // Every slot-consuming action already funnels through advanceRun, which makes
  // this table the cheap way to cover most of the observation surface without
  // touching individual reducer cases. Keyed on the same context.reason that
  // STREET_READ_ACTIVITY uses.
  //
  // `channel` decides who hears. Working a shift is neighborhood-visible;
  // sleeping at home is only visible to the household; a robbery travels the
  // network. Actions with no entry are not worth remarking on, which is the
  // right default: not everything a player does is a fact about them.
  const OBSERVED_ACTIONS = {
    WORK_SHIFT: { type: "presence", event: "steady_work", channel: "neighborhood" },
    WORK_JOB: { type: "presence", event: "steady_work", channel: "neighborhood" },
    SLEEP_HOME: { type: "presence", event: "home_at_night", channel: "household" },
    VISIT_NIGHT_OWL: { type: "presence", event: "night_owl", channel: "direct" },
    CONTACT_VISIT: { type: "presence", event: "keeps_in_touch", channel: "neighborhood" },
    TRAIN_ATTRIBUTE: { type: "growth", event: "training", channel: "neighborhood" },
    LAY_LOW: { type: "discretion", event: "kept_quiet", channel: "neighborhood" },
    TAKEOVER: { type: "defiance", event: "territory_claim", channel: "network" },
    CLAIM_BLOCK: { type: "defiance", event: "territory_claim", channel: "network" },
    SHOPLIFT: { type: "financial", event: "petty_theft", channel: "neighborhood" },
    BOOST: { type: "financial", event: "boosting", channel: "network" },
    // ROB and ROB_DEALER used to live here as one flat row apiece. They are
    // tiered now (see OUTCOME_OBSERVATIONS in src/data/attributes.js), which says
    // the same thing with more fidelity - keeping both would record every
    // robbery twice and inflate every disposition that heard about it.
    //
    // GAMBLE was the last flat row of that kind and it is gone with the action
    // in v1.11. The Nile broadcasts from its own reducer cases instead, keyed on
    // the money that actually changed hands, because a $12 night at the Tonk
    // table and a $300 night at the dice are not the same fact about a person.
    // Those broadcasts never use the network channel; see gamblingObservations
    // in src/data/gambling.js and the isolation test in tests/v1-11.test.js.
    NILE_WELLNESS: { type: "presence", event: "the_nile", channel: "direct", location: Nile.NILE_LOCATION_ID },
    NILE_COFFEE: { type: "presence", event: "the_nile", channel: "direct", location: Nile.NILE_LOCATION_ID },
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
      introduced: false, recruited: false, loyalty: Crew.CREW_LOYALTY_START, wageDue: 0, assignment: null,
      contactStage: "unknown", crisisResolved: false, status: "outside", outcomes: [],
      tier: 0, lieutenantStage: "none", lieutenantEffectiveness: 0, operationPolicy: "manual",
      networkActive: false, trucesBrokered: 0, recruitedDay: null, wageMissedSince: null,
      // v1.16: set when status flips to "arrested". Null for everyone else, so
      // mergeDefaults hands it to every pre-v1.16 save without a migration.
      jailedUntilDay: null, jailedSeverity: null,
      // v1.18: encounter wins where this member's backup actually applied. Tone's
      // tier-2 gate reads it. Kept on the crew record rather than counted out of
      // encounterLog, which truncates to its last 80 rows and would silently
      // reset a gate the player had already earned.
      combatWins: 0,
    }]));
  }

  // Goodie runs a corner rather than a market stall: the same person can be bought
  // from, asked for word, or robbed, and he remembers which one you picked.
  function createPlugState() {
    return {
      unlocked: [],
      // v1.13: `suspicion` — how sure this plug is that you rob people where
      // they work. 3+ raises their prices, 5 cuts you off entirely; a clean
      // purchase works it back down one point.
      records: Object.fromEntries(PLUGS.map((plug) => [plug.id, { standing: 0, lastPurchaseDay: null, introducedNext: false, suspicion: 0 }])),
    };
  }
  function createDealerState() {
    return Object.fromEntries(DEALERS.map((item) => [item.id, {
      known: false, standing: 0, robbedCount: 0, lastRobbedDay: null, lastTradedDay: null,
      lastAskedDay: null, retaliated: false, gone: false, supplyChoked: 0,
    }]));
  }


  function createContactsState() {
    return Object.fromEntries(Object.keys(SOCIAL_CONTACTS).map((id) => [id, {
      known: !!SOCIAL_CONTACTS[id].startsKnown, relationshipLevel: 0, lastInteraction: null, lastVisitDay: null,
    }]));
  }

  // Every NPC now carries a ledger and a channel subscription. The remaining
  // per-character fields are arc bookkeeping (which scene has fired, whether a
  // tax is running); the relationship itself is derived from the ledger and is
  // never stored. The old trust/attention/respect integers stay in the shape so
  // v5 saves have somewhere to land during migration, and so the sim telemetry
  // and day summary keep reading a number, but nothing gates on them any more.
  function createNpcState() {
    const base = {
      yalonda: { trust: 2, romanceStage: 0, rentPaidWeeks: 0, lastRentDay: null, rentMissed: 0, lastEventDay: null },
      juan: { trust: 0, infoShared: [], lastEventDay: null },
      mina: {
        met: false, available: true, trust: 0, arcStage: 0, chainStage: 0,
        introChoice: null, flirtHistory: false,
        usedWithoutConsent: false,
        cleanLifeAtRisk: false, status: "distant",
        outcome: null, outcomes: [],
      },
      curtis: {
        name: "Curtis Foyer", attention: 0, pressure: 0, respect: 0,
        relationship: "unaware", taxActive: false, friendship: null,
        friendshipDay: null, protectionUntilDay: null, betrayed: false,
        attentionMilestones: [],
      },
      dre: {
        known: false, trust: 0, missionHistory: [], refusals: 0,
        cleanCompletions: 0, activeMission: null,
        offersDisabled: false, backstoryFragments: [], loansTaken: 0, loansRepaid: 0,
      },
      simone: {
        known: false, trust: 0, threat: 0, pherrisConflict: false,
        leverage: 0, truce: false, outcomes: [],
      },
      // The Tesfayes. Neither carries a trust integer - they were authored after
      // the Exposure System, so their standing is only ever their ledger. `met`
      // and the intel counter are the whole of their bespoke state.
      selam: { met: false, visits: 0, mentionedBiniam: false, intelSent: [], lastIntelDay: null },
      biniam: { met: false, tonkGames: 0, celoRounds: 0, coffeeRounds: 0 },
      // Deshawn was authored after the Exposure System, so like the Tesfayes
      // his standing is only ever his ledger. Crew mechanics (loyalty, tier,
      // wage) live in state.people.crew.deshawn; this record carries what the
      // person knows and does: his weekly introductions and the de-escalation
      // window his loyalty triggers read.
      deshawn: { lastIntroDay: null, introducedContacts: [], lastDeescalationDay: null },
      // v1.18: same split as Deshawn. Crew mechanics (loyalty, tier, wage,
      // combat wins) live in state.people.crew.tone; this record is what the
      // person knows and has been told. It has to exist for the loop below to
      // give him a ledger at all - a lens with no record here is a subscriber
      // broadcastObservation silently skips.
      tone: { met: false, offersDeclined: 0 },
      // v1.19: Pherris predates the Exposure System by several builds, so unlike
      // Tone she already had crew mechanics and no ledger at all. This record is
      // the missing half, and it is not optional - the loop below skips any lens
      // without one, which would leave her a subscriber that never hears anything.
      pherris: { met: false, offersDeclined: 0 },
    };
    for (const id of EXPOSURE_NPC_IDS) {
      if (!base[id]) continue;
      base[id].ledger = [];
      base[id].channels = [...(NPC_CHANNELS[id] || ["direct"])];
    }
    // Yalonda opened at trust 2 because she is family and the player is already
    // under her roof on Day 1. That head start is a fact about the household,
    // not a number, so it starts as one row in her ledger instead.
    base.yalonda.ledger.push({ type: "presence", event: "family_household", location: HOME_DISTRICT_ID, value: null, day: 1, count: 2, source: "household" });
    return base;
  }

  function createJobsState(inventory, seed) {
    return {
      discoveryOrder: seededShuffle(STARTER_JOB_IDS, seed, 0x15a907),
      discovered: ["day_labor"], hired: ["day_labor"], activeJobId: null, offers: [], applications: [], discoveryChance: 0.30, lastScheduledShiftDay: null, lastDeliveryDay: null, lastWorked: null,
      // How many times an employer has pulled you aside about the heat. Keyed by
      // employer id; day labor never appears here.
      warnings: {},
      // v1.29: consecutive days ended without working for that employer. Keyed
      // the same way, reset to zero by any shift, and day labor never appears
      // here either. Separate from `warnings` on purpose - Heat and attendance
      // are two different ladders and an employer can be climbing both.
      missedShifts: {},
      records: Object.fromEntries(SPENARD_JOBS.map((job) => [job.id, {
        xp: 0, rank: 0, shifts: 0, lastWorkedDay: null, hiredDay: null, relationship: 0, contactMet: false,
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
        ending: null, endCause: null, pendingEvent: null, pendingEncounter: null, pendingOperationResult: null, pendingUnlocks: [], consequenceQueue: [], pendingObservations: [], daySummary: null,
        // v1.23: which voices have already texted today, so one NPC cannot send
        // two gossip texts in a day. Session state - nothing here needs to
        // outlive the run, and it rebuilds itself on the first delivery.
        gossipVoices: { day: 0, npcIds: [] },
        // v1.27: who the player has already asked for intel today, and what
        // they asked about. One entry per purchase; one purchase per NPC per
        // day. Session state on `run` for the same reason gossipVoices is:
        // nothing here outlives the run, and a save that predates the field
        // hydrates to a day nobody has been called on yet.
        disclosures: { day: 0, entries: [] },
        // v1.28: pressure points last night's plan could not spend, carried to
        // tonight's budget and capped. `phase` travels with the points because
        // the carry does not survive him changing how hard he is looking - an
        // operation that drops out of approaching does not get to keep the
        // interest. Session state on `run` for the same reason the two above
        // are, object-shaped so mergeDefaults hydrates an older save to an
        // empty bank and the schema stays v11.
        curtisPressureBank: { phase: null, points: 0 },
        // v1.16: parts of day a booking still owes, spent once the caught-state
        // encounter is dismissed and advanceRun is allowed to move again.
        pendingArrestSlots: null,
        dayEndPending: false, overtimeArmed: false, overtimeUsedDay: null, dailyActions: [],
        currentVisit: { trades: 0, grossBuy: 0, grossSell: 0, startedAt: 0 },
        recentEvents: [], encounterCount: 0, finalPlan: null, finalPlanPrepared: false,
        eventHistory: {}, lastChainFired: null, chainStreak: 0, lastChainSlot: null, lastBeatSlot: null, chainBeatsToday: 0, chainBeatsDay: 1,
      },
      player: {
        background: null, legacyBackground: null, streetName: "", streetNameChosen: false,
        historicalIdentity: null,
        attributes: { ...ATTRIBUTE_DEFAULTS },
        // Fractional. Growth returns a partial level; a whole point is banked
        // when the accumulator crosses 1.
        attributeProgress: { combat: 0, charisma: 0, intelligence: 0 },
        gymStreak: 0, gymStreakDay: null,
        // The Nile's streak carries the attribute it earned, because the
        // building trains two of them and the bonus has to know which.
        nileStreak: 0, nileStreakDay: null, nileStreakAttribute: null,
        behavior: { scores: { mover: 0, earner: 0, stickup: 0, connector: 0 }, meaningfulActions: 0, history: [], caps: {} },
        cash: 0, dirtyCash: 0, cleanCash: 0, financialHeat: 0, health: 100, heat: 0, cargoCapacity: 10,
        energy: MAX_ENERGY,
        inventory,
        gear: { owned: [], equipped: { weapon: null, armor: null, utility: null, tool: null }, consumables: { medical_kit: 0 } },
      },
      inventory: { laptop: false },
      phone: { active: true, billDueDay: 7, daysPastDue: 0, inbox: [], heldInbox: [], reactivateAtSlot: null },
      knowledge: { knows907List: false },
      discovered: { spenardGym: false },
      memberships: { gym: false },
      // Table state. `table` and `round` hold a game in progress between
      // dispatches - a hand of Tonk spans several actions, and the player is
      // allowed to close the app in the middle of one.
      gambling: {
        tonkGamesPlayed: 0, celoRoundsPlayed: 0, sessionProfit: 0,
        dailyGamesPlayed: 0, dailyGamesDay: null,
        table: null, round: null,
      },
      world: {
        currentNeighborhoodId: "north_star_lot", markets,
        influence: { north_star_lot: 0, downtown: 0, airport_industrial: 0 },
        tradeInfluenceGranted: { north_star_lot: false, downtown: false, airport_industrial: false },
        productAccess: Object.fromEntries(PRODUCTS.map((product) => [product.id, false])),
        transport: { dayPassDay: null, weekPass: false, busRides: 0, downtownKnown: false, industrialRouteKnown: false },
        locations: {
          explorationCount: 0, discoveries: [], gamblingKnown: false, downtownAmbientSeen: [],
          gym: { sessionDay: null, sessionsToday: 0, activitySessions: { bag_work: 0, cardio: 0, sparring: 0 } },
          // Kept from the retired backroom game. The counters still mean what
          // they meant - plays, wins, losses, net - they are just fed by real
          // Tonk and Cee-lo now instead of by a single roll.
          gambling: { plays: 0, wins: 0, losses: 0, net: 0 },
          theNile: {
            discovered: false, secondFloorAccess: false, discoveryMethod: null, accessMethod: null,
            wanderMisses: 0, lastVisitDay: null,
            activitySessions: { nile_social: 0, tonk_game: 0, celo_game: 0, coffee_ceremony: 0 },
          },
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
          // v1.28. Set the first time he takes this corner back off the player,
          // and never cleared. Additive and boolean, so mergeDefaults hydrates
          // every save that predates it to false and the schema stays v11.
          curtisTookBack: false,
          // v1.30. The day this corner last lost a soldier, to police, to
          // Curtis, or to attrition. Read by Tone's territory_status briefing;
          // null on a corner that has never lost anybody. Additive the same
          // way, so the schema stays v11.
          lastCasualtyDay: null,
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
      crewMeta: { totalWagesPaid: 0 },
      // v1.16: the permanent record. Purely additive, which is why the save
      // schema stays at v11 — mergeDefaults supplies this to every old save.
      record: { arrests: 0, lastArrestDay: null, charges: [] },
      curtisAwareness: {
        level: 0, phase: "invisible", floor: 0, lastIncrementDay: null,
        watchersSeen: 0, lastWatcherDay: null, recentWatcherLines: [],
        quietStreak: 0, lastCriminalDay: null,
        spenardMarketTxDay: null, spenardMarketTxCount: 0, marketBumpDay: null,
        phaseMessagesSent: [],
      },
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
        boardViewedDays: [], ambientSeen: [], socialSessions: 0,
        // v1.17: the last three Mina lines shown, so no line repeats within a
        // three-visit window. Additive - schema stays at v11 and mergeDefaults
        // supplies this to every old save.
        recentMinaLines: [],
        regulars: Object.fromEntries(NIGHT_OWL_REGULARS.map((person) => [person.id, { met: false, relationship: 0, lastTalkDay: null }])),
      },
      // v1.9b: the broker track. `tier` is derived on every read by marketTier()
      // and mirrored here for saves and display, never trusted as the source.
      // The build prompt calls this state `market.*`; that key is already the
      // plug market's, so the broker fields live where 907List already lived.
      nineZeroSevenList: {
        known: false, tier: 1, inventory: [], purchases: 0, sales: 0, profit: 0,
        flipCount: 0, disputes: 0, specialist: null, categoryFlips: {},
        pendingSells: [], buyerRequests: [], filledRequests: 0, bulkDeal: null,
        robberies: 0, lastNoticeDay: 0, taken: { day: 0, ids: [] },
        alerts: { enabled: false, subscriptions: [] },
      },
      rob: { visible: false },
      boost: {
        visible: false, tier: 0, technique: 0, storeBans: [], fenceStanding: 0,
        dailyHits: {}, crewAssigned: null, merchandise: 0, discoveredWindows: [],
        // v1.16: the caught-state handoff. Holds the target and the take while
        // the fight/flee/surrender encounter is on screen; cleared on settle.
        pendingCaught: null,
      },
      // v1.13: the Stick track. Visibility stays on state.rob.visible (the
      // existing unlock flag); this slice carries the ladder. `tier` is derived
      // on read by stickTier() and mirrored here for saves, never trusted.
      stick: {
        tier: 0, rep: 0, casedTargets: [], retaliationQueue: [],
        dailyCount: 0, lastRobberyDay: null, lastRobberyDistrict: null, heatStreak: 0, organizedHits: 0,
      },
      // v1.13: how loudly each district has heard about each criminal track.
      // Every 3 points = one difficulty step there; awareness bleeds to
      // adjacent districts at half strength a day later.
      criminalProfile: {
        districtAwareness: Object.fromEntries(Object.keys(DISTRICT_MODS).map((id) => [id, { market: 0, boost: 0, stick: 0 }])),
        bleedPending: [],
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

  // v11: crew loyalty moves from a delta accumulator centered on 0 to a 0-10
  // scale that starts at 5. Everything else in v11 (crewMeta, curtisAwareness,
  // Deshawn's npc record, recruitedDay) is additive and defaults in through
  // mergeDefaults, so the rescale is the only transform old saves need.
  function applyV11CrewMigration(migrated) {
    for (const crew of Object.values(migrated.people?.crew || {})) {
      crew.loyalty = clamp(5 + Math.round(Number(crew.loyalty) || 0), 0, 10);
    }
    return migrated;
  }

  function migrateSave(value) {
    if (!value || typeof value !== "object") return null;
    if (value.version === VERSION) return value;
    // A v10 save is already modern: the legacy flat pass below would be lossy
    // for it (it rebuilds jobs.hired/offers, re-clamps curtis.attention, and
    // deletes attributeProgress). Only the v11 crew transform applies.
    if (value.version === 10) {
      if (!value.run || !value.world || !value.player) return null;
      const modern = applyV11CrewMigration(JSON.parse(JSON.stringify(value)));
      modern.version = VERSION;
      return modern;
    }
    if (![3, 4, 5, 6, 7, 8, 9].includes(value.version) || !value.run || !value.world || !value.player) return null;
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
    migrated.run.pendingObservations = Array.isArray(migrated.run.pendingObservations) ? migrated.run.pendingObservations : [];
    // v1.23. Additive: a save from any earlier schema hydrates to "nobody has
    // spoken yet", which is exactly right - the day's first delivery resets it.
    migrated.run.gossipVoices = migrated.run.gossipVoices && Array.isArray(migrated.run.gossipVoices.npcIds)
      ? migrated.run.gossipVoices
      : { day: 0, npcIds: [] };
    // v1.27, same shape and the same reasoning. An old save arrives having
    // asked nobody anything, which is true of it.
    migrated.run.disclosures = migrated.run.disclosures && Array.isArray(migrated.run.disclosures.entries)
      ? migrated.run.disclosures
      : { day: 0, entries: [] };
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
    // v7: 907List grew a broker track. Every new field is additive, so
    // mergeDefaults in hydrateRun supplies them; the only thing that cannot be
    // merged is the old `tier`, which was the string "basic" or "upgraded" and
    // is now a number. Left as a string it would fail every tier comparison, so
    // it is dropped here and re-derived by marketTier() from the laptop.
    const legacyList = migrated.nineZeroSevenList;
    if (legacyList && typeof legacyList.tier === "string") delete legacyList.tier;
    if (legacyList) {
      legacyList.pendingSells = Array.isArray(legacyList.pendingSells) ? legacyList.pendingSells : [];
      legacyList.buyerRequests = Array.isArray(legacyList.buyerRequests) ? legacyList.buyerRequests : [];
      // Pre-v7 flips were free and risk-free, so they never earned broker
      // standing. Sales carry over as the flip count they would have been.
      legacyList.flipCount = Math.max(0, Math.floor(Number(legacyList.flipCount ?? legacyList.sales) || 0));
    }
    // v8: six attributes collapse into three, and Street Identity stops being
    // stored. Both need an explicit hand here rather than a default merge:
    // mergeDefaults carries source keys that the defaults no longer own, so a
    // retired field survives forever unless it is deleted on the way through.
    const player = migrated.player;
    const legacyAttributes = player.attributes && typeof player.attributes === "object" ? player.attributes : null;
    const hasLegacySix = legacyAttributes && LEGACY_ATTRIBUTE_GROUPS.combat.some((key) => key in legacyAttributes);
    if (hasLegacySix) {
      // Highest of each merged group, so nothing a player earned is lost.
      const converted = {};
      for (const [attribute, sources] of Object.entries(LEGACY_ATTRIBUTE_GROUPS)) {
        const best = Math.max(...sources.map((key) => Number(legacyAttributes[key]) || 0));
        converted[attribute] = clamp(Math.round(best), ATTRIBUTE_MIN, ATTRIBUTE_MAX);
      }
      player.attributes = converted;
    } else if (legacyAttributes) {
      const converted = {};
      for (const id of ATTRIBUTE_IDS) converted[id] = clamp(Math.round(Number(legacyAttributes[id]) || ATTRIBUTE_DEFAULTS[id]), ATTRIBUTE_MIN, ATTRIBUTE_MAX);
      player.attributes = converted;
    }
    // Hidden progress was counted in whole points against a threshold table and
    // is now a fractional accumulator. There is no honest conversion, so it
    // resets; the attribute levels it already bought are what carried over.
    delete player.attributeProgress;
    delete player.stats;
    if (player.streetIdentity) {
      player.historicalIdentity = LEGACY_STREET_IDENTITIES[player.streetIdentity]?.label || null;
      delete player.streetIdentity;
    }
    delete player.identityAssignedDay;
    delete player.identityHistory;
    if (player.behavior && typeof player.behavior === "object") {
      delete player.behavior.pendingIdentity;
      delete player.behavior.pendingIdentityNights;
      delete player.behavior.lastEvaluatedDay;
    }
    applyV11CrewMigration(migrated);
    migrated.version = VERSION;
    return migrated;
  }

  function hydrateRun(value) {
    // Read the version off the save as it arrived. migrateSave stamps it to
    // current and merges in default state, so after that call there is no way
    // left to tell a pre-Exposure save from a converted one.
    const incomingVersion = value && typeof value === "object" ? value.version : null;
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
    const legacyBackground = BACKGROUND_BY_ID[legacy];
    if (!value.player.attributes && legacyBackground) {
      state.player.attributes = { combat: legacyBackground.combat, charisma: legacyBackground.charisma, intelligence: legacyBackground.intelligence };
    }
    state.player.legacyBackground = legacy || null;
    state.player.background = null;
    state.player.attributes = normalizedAttributes(state);
    state.player.attributeProgress = normalizedAttributeProgress(state.player.attributeProgress);
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
    const list = state.nineZeroSevenList;
    list.purchases = Math.max(0, Math.floor(Number(list.purchases) || 0));
    list.sales = Math.max(0, Math.floor(Number(list.sales) || 0));
    list.profit = Math.floor(Number(list.profit) || 0);
    list.flipCount = Math.max(0, Math.floor(Number(list.flipCount) || 0));
    list.disputes = Math.max(0, Math.floor(Number(list.disputes) || 0));
    list.filledRequests = Math.max(0, Math.floor(Number(list.filledRequests) || 0));
    list.robberies = Math.max(0, Math.floor(Number(list.robberies) || 0));
    list.lastNoticeDay = Math.max(0, Math.floor(Number(list.lastNoticeDay) || 0));
    list.categoryFlips = list.categoryFlips && typeof list.categoryFlips === "object" ? list.categoryFlips : {};
    // Derived, never trusted from the save: a v6 save carrying "upgraded", or a
    // v7 save edited by hand, both land on whatever the laptop and the flip
    // record actually justify.
    list.tier = marketTier(state);
    list.specialist = specialistCategory(state);
    list.inventory = (Array.isArray(list.inventory) ? list.inventory : [])
      .filter((entry) => entry && LISTING_ITEM_BY_ID[entry.itemId])
      .slice(0, marketCapacity(state));
    list.pendingSells = (Array.isArray(list.pendingSells) ? list.pendingSells : [])
      .filter((entry) => entry && LISTING_ITEM_BY_ID[entry.itemId] && entry.resolveAtSlot != null);
    list.buyerRequests = (Array.isArray(list.buyerRequests) ? list.buyerRequests : [])
      .filter((entry) => entry && Market.MARKET_CATEGORIES.includes(entry.category));
    list.bulkDeal = list.bulkDeal && Array.isArray(list.bulkDeal.itemIds)
      && list.bulkDeal.itemIds.every((id) => LISTING_ITEM_BY_ID[id]) ? list.bulkDeal : null;
    list.taken = list.taken && Array.isArray(list.taken.ids)
      ? { day: Math.max(0, Math.floor(Number(list.taken.day) || 0)), ids: list.taken.ids.filter((id) => LISTING_ITEM_BY_ID[id]) }
      : { day: 0, ids: [] };
    list.alerts = { enabled: false, subscriptions: [] };
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
    if (incomingVersion !== VERSION) seedExposureLedgers(state);
    return state;
  }

  // Turns a pre-v1.9a relationship into a ledger.
  //
  // Deliberately placed after hydrateRun rather than between it and migrateSave:
  // tests/v1-8-1.test.js treats everything between those two function
  // declarations as the amnesty window where legacy character ids are allowed,
  // and this code has no business widening that window.
  //
  // The build prompt named three flags to convert. Only one of them was real:
  // toldMinaTruth lives in the flat state.flags bag, and minaViolenceWitnessed /
  // minaDownplayed never existed under any name. npc.mina.violenceWitnessed and
  // .downplayed were declared and never once read or written. What follows
  // converts the fields that actually carried meaning.
  function seedExposureLedgers(state) {
    // Only ever called for a save that predates the ledger. The caller decides
    // that from the version the save arrived with, because by the time state
    // exists mergeDefaults has already given every NPC an empty ledger.
    const day = state.run.day;
    const seed = (npcId, spec) => Exposure.recordObservation(state, npcId, { day, ...spec });

    // Trust integers become presence: time spent, nothing more specific. That is
    // honest about what the old number actually recorded, and it means a
    // migrated save lands mid-band rather than inheriting content it never
    // earned a reason for.
    for (const id of ["yalonda", "juan", "mina", "dre", "simone"]) {
      const trust = Math.floor(Number(state.npc[id]?.trust) || 0);
      if (trust > 0) seed(id, { type: "presence", event: "legacy_history", count: trust, source: "witnessed" });
      if (trust < 0) seed(id, { type: "defiance", event: "legacy_friction", count: Math.abs(trust), source: "witnessed" });
    }

    // Curtis's attention was already the closest thing in the old code to an
    // observation ledger: deduplicated, milestone-keyed, and earned by concrete
    // acts. Each milestone converts to the category it was actually measuring.
    const milestoneCategory = {
      units_10: "growth", units_25: "growth", units_50: "growth",
      revenue_600: "financial", revenue_1200: "financial",
      spenard_sale: "growth", named_report: "defiance", network_escalation: "defiance",
      tax_rejected: "defiance",
    };
    for (const milestone of state.npc.curtis.attentionMilestones || []) {
      const type = milestoneCategory[milestone];
      if (type) seed("curtis", { type, event: milestone, source: "network" });
    }
    // Attention that outran its milestones (older saves, forced awards) lands as
    // undifferentiated growth so the total still reads as exposure.
    const unexplained = Math.max(0, Math.floor(Number(state.npc.curtis.attention) || 0) - (state.npc.curtis.attentionMilestones || []).length);
    if (unexplained > 0) seed("curtis", { type: "growth", event: "legacy_exposure", count: unexplained, source: "network" });
    const respect = Math.floor(Number(state.npc.curtis.respect) || 0);
    if (respect > 0) seed("curtis", { type: "submission", event: "legacy_respect", count: respect, source: "witnessed" });

    // Mina's history was split between npc.mina booleans and the flat flag bag,
    // with usedWithoutConsent duplicated across both. Collapse to one row.
    const flags = state.flags || {};
    if (flags.toldMinaTruth) seed("mina", { type: "honesty", event: "told_truth", source: "witnessed" });
    if (flags.minaDateNight) seed("mina", { type: "presence", event: "date_night", source: "witnessed" });
    if (flags.valeProtectedMina) seed("mina", { type: "loyalty", event: "protected_her", source: "witnessed" });
    if (flags.usedMinaWithoutConsent || state.npc.mina.usedWithoutConsent) {
      seed("mina", { type: "betrayal", event: "used_without_consent", source: "witnessed" });
    }
    if (flags.exploitedValeName) seed("mina", { type: "betrayal", event: "exploited_name", source: "network" });
    // Serious violence was the live substitute for the flag the prompt named.
    // It is public, so it reaches everyone on the network, not only Mina.
    if (flags.seriousViolence) {
      for (const id of EXPOSURE_NPC_IDS) seed(id, { type: "violence", event: "serious_violence", source: "network" });
    }

    // Rent is the one obligation the old code tracked both ways. Paid weeks are
    // financial credit; missed ones are the escalating kind that gets worse.
    const paidWeeks = Math.floor(Number(state.npc.yalonda.rentPaidWeeks) || 0);
    if (paidWeeks > 0) seed("yalonda", { type: "financial", event: "rent_paid", count: paidWeeks, source: "household" });
    const missed = Math.floor(Number(state.npc.yalonda.rentMissed) || 0);
    if (missed > 0) seed("yalonda", { type: "financial", event: "missed_obligation", count: missed, source: "household" });

    // Dre kept the cleanest behavioral record of anyone: completions, repayments
    // and refusals were all counted, and all three mean different things to him.
    const dre = state.npc.dre;
    if (dre.cleanCompletions > 0) seed("dre", { type: "loyalty", event: "clean_mission", count: Math.floor(dre.cleanCompletions), source: "witnessed" });
    if (dre.loansRepaid > 0) seed("dre", { type: "financial", event: "loan_repaid", count: Math.floor(dre.loansRepaid), source: "witnessed" });
    if (dre.refusals > 0) seed("dre", { type: "defiance", event: "refused_work", count: Math.floor(dre.refusals), source: "witnessed" });

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
    // Was reflexes/insight/discipline/presence blends before the consolidation.
    // Read through the 1-5 compatibility scale so the tier curve is unchanged.
    const skill = target.tier === 1 ? (combatCompat(state) + intelligenceCompat(state)) / 2
      : target.tier === 2 ? (combatCompat(state) + intelligenceCompat(state)) / 2
        : (intelligenceCompat(state) + charismaCompat(state)) / 2;
    const base = target.tier === 1 ? 0.80 : target.tier === 2 ? 0.55 : 0.40;
    const windowBonus = target.tier === 2 && state.run.slot === target.windowSlot ? 0.20 : 0;
    // v1.13: geography counts — crowded aisles help, dock security hurts, and
    // a district that has heard about your lifting watches the mirrors.
    return clamp(base + (skill - 2) * 0.10 + windowBonus + districtChanceDelta(state, target.areaId, "boost"), 0.10, 0.95);
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
    recordCriminalActivity(state, target.areaId, "boost");
    if (success) {
      const firstSuccess = !state.boost.visible;
      const take = random.int(target.take[0], target.take[1]);
      state.boost.visible = true;
      state.boost.technique += 1;
      state.player.heat = clamp(state.player.heat + districtHeat(state, target.areaId, "boost", target.tier === 1 ? 0.5 : target.tier === 2 ? 1 : 2), 0, 15);
      if (target.tier === 3) {
        state.boost.merchandise += take;
        const crew = state.people.crew[state.boost.crewAssigned];
        if (crew) crew.loyalty = Crew.clampLoyalty(crew.loyalty + standingGain(crew, crew.loyalty, 1, "open"));
        logEntry(state, `${target.name} lands. $${take} in merchandise is waiting for the fence.`, "good");
      } else {
        addDirtyCash(state, take);
        logEntry(state, `You leave ${target.name} with goods worth $${take}.`, "good");
      }
      addStreetReadEntry(state, "risk", `boost:${target.areaId}:${target.id}`);
      recordBehavior(state, "stickup", 1, `boost:${state.run.day}:${target.id}`, "shoplift_pattern");
      updateBoostTier(state);
      if (firstSuccess) queueUnlock(state, "boost");
    } else {
      // v1.16: getting caught is a scene now, not a line of log text. Every
      // tier hands off to the consequence encounter engine with the take still
      // in play — fight for it, run with it, or hand it back. Nothing here
      // costs heat, goods, or a ban yet; settleBoostCaught does all of that
      // once the player has answered.
      const take = random.int(target.take[0], target.take[1]);
      // The dead flag from v1.13 finally has a reader. It is the escalation
      // trigger: with real heat already on you (or on a ring job), a botched
      // escape is what turns a store incident into a booking.
      state.flags.boostArrestRisk = state.player.heat > 6 || target.tier === 3;
      if (target.tier === 3) {
        const crewId = state.boost.crewAssigned;
        const caughtRoll = Number.isFinite(options?.crewCaughtRoll) ? options.crewCaughtRoll : random.next();
        if (crewId && caughtRoll < 0.30) jailCrewMember(state, crewId, "boost2");
        else logEntry(state, "The ring breaks and scatters. You are the one still inside.", "bad");
      }
      state.boost.pendingCaught = {
        targetId: target.id, targetName: target.name, tier: target.tier, areaId: target.areaId, take,
      };
    }
    return { success, chance, caught: !success };
  }
  // Open the caught-state scene if there is room for it, and settle it the old
  // automatic way if there is not. Both boost call sites - the BOOST/SHOPLIFT
  // reducer and the first-opportunity event effect - go through here, so a
  // failed lift can never end up costing nothing at all.
  function openOrSettleBoostCaught(state) {
    const pending = state.boost?.pendingCaught;
    if (!pending) return state;
    if (state.run.status === "playing" && !state.run.pendingEncounter) {
      state.run.pendingEncounter = EncounterSystem.buildBoostCaughtEncounter(state, pending);
      return state;
    }
    state.flags.boostArrestRisk = false;
    settleBoostCaught(state, {
      boost: { ...pending, severity: EncounterSystem.BOOST_SEVERITY[pending.tier] },
      result: { outcome: "boost_flee_loss" },
    });
    return state;
  }
  // The other half of the boost caught-state: the encounter engine decided what
  // happened, this settles what it cost. Heat rides districtHeat so the
  // district awareness curve still applies, and every branch broadcasts, so a
  // player who fights their way out of every bust builds a violence record the
  // civilian NPCs weight against them.
  function settleBoostCaught(state, encounter) {
    const info = encounter.boost;
    const outcome = encounter.result?.outcome;
    const target = BOOST_TARGET_BY_ID[info.targetId];
    const areaId = info.areaId || state.world.currentNeighborhoodId;
    const tier = info.tier;
    const ban = () => { if (!state.boost.storeBans.includes(info.targetId)) state.boost.storeBans.push(info.targetId); };
    const heat = (amount) => { state.player.heat = clamp(state.player.heat + districtHeat(state, areaId, "boost", amount), 0, 15); };
    const keepTake = () => {
      if (!info.take) return;
      if (tier === 3) state.boost.merchandise += info.take;
      else addDirtyCash(state, info.take);
      logEntry(state, tier === 3 ? `$${info.take} in merchandise comes out with you.` : `You clear the lot still holding $${info.take} in goods.`, "good");
    };
    const loseRing = () => { if (tier === 3) state.boost.merchandise = 0; };
    let arrestDetail = null;
    if (outcome === "boost_fight_win") {
      heat(1);
      keepTake();
      broadcastTracked(state, { type: "violence", event: "store_scuffle", channel: "neighborhood", location: areaId, day: state.run.day });
    } else if (outcome === "boost_fight_loss") {
      ban();
      loseRing();
      heat(tier === 1 ? 2 : tier === 2 ? 3 : 4);
      broadcastTracked(state, { type: "violence", event: "store_scuffle", channel: "neighborhood", location: areaId, day: state.run.day });
      arrestDetail = arrestPlayer(state, { severity: info.severity, source: "boost" });
    } else if (outcome === "boost_flee_win") {
      heat(tier === 1 ? 1 : 2);
      keepTake();
      broadcastTracked(state, { type: "heat_exposure", event: "heat_seen_low", channel: "neighborhood", location: areaId, day: state.run.day });
    } else if (outcome === "boost_flee_loss") {
      ban();
      loseRing();
      heat(tier + 1);
      broadcastTracked(state, { type: "defiance", event: "attempted_boost", channel: "neighborhood", location: areaId, day: state.run.day });
      // boostArrestRisk is the gate: running and losing is a ban and bruises on
      // a quiet week, and a booking once somebody was already looking.
      if (state.flags.boostArrestRisk) arrestDetail = arrestPlayer(state, { severity: info.severity, source: "boost" });
    } else {
      ban();
      loseRing();
      broadcastTracked(state, { type: "submission", event: "backed_down", channel: "neighborhood", location: areaId, day: state.run.day });
      logEntry(state, `${target?.name || info.targetName} keeps the goods and your name. No Heat, no charge.`, "warn");
    }
    state.flags.boostArrestRisk = false;
    state.boost.pendingCaught = null;
    updateBoostTier(state);
    if (outcome !== "boost_surrender") recordBehavior(state, "stickup", 1, `boost_caught:${state.run.day}:${info.targetId}`, "shoplift_pattern");
    return arrestDetail;
  }

  // --- v1.13 Stick track ----------------------------------------------------
  // Robbery grows the way boosting does: a ladder with gates. Tier 1 is street
  // work, open once the first robbery lands (state.rob.visible). Tier 2 is
  // named registers behind a weapon. Tier 3 is organized work behind rep, a
  // weapon, and planning. Goodie stays on his own ROB_DEALER mechanic and
  // feeds the same rep ladder as the walking Tier 2 target.
  function stickTier(state) {
    if (!state.rob?.visible) return 0;
    const rep = state.stick?.rep || 0;
    const weapon = equippedWeapon(state);
    if (rep >= Districts.STICK_TIER_3_REP && weapon) return 3;
    if (rep >= Districts.STICK_TIER_2_REP && weapon) return 2;
    return 1;
  }
  function updateStickTier(state) {
    state.stick.tier = Math.max(state.stick.tier || 0, stickTier(state));
    return state.stick.tier;
  }
  function stickCasing(state, targetId) {
    return state.stick?.casedTargets?.find((entry) => entry.targetId === targetId) || null;
  }
  function stickCrewReady(state) {
    return recruitedCrew(state).some((person) => person.canFieldAssign && state.people.crew[person.id]?.status === "active");
  }
  function stickChance(state, target) {
    const weapon = equippedWeapon(state);
    const weaponBonus = weapon?.type === "firearm" ? 0.12 : weapon ? 0.06 : 0;
    const casing = Math.min(2, stickCasing(state, target.id)?.timesObserved || 0);
    const planning = casing * 0.06 + (target.tier === 3 && stickCrewReady(state) ? 0.06 : 0);
    const base = target.tier === 1 ? 0.62 : target.tier === 2 ? 0.52 : 0.40;
    return clamp(
      base + (combatCompat(state) - 2) * 0.08 + weaponBonus + planning
        - target.resistance * DISTRICT_DIFF_STEP - state.player.heat * 0.012
        + districtChanceDelta(state, target.areaId, "stick"),
      0.15, 0.90,
    );
  }
  function stickHeatMultiplier(state) { return 1 + 0.1 * (state.stick?.heatStreak || 0); }
  // Bookkeeping every robbery shares, whichever surface it came through: the
  // repeat-work heat streak, the daily cap, plug suspicion, and district word.
  function recordRobberyActivity(state, areaId, options = {}) {
    const stick = state.stick;
    if (stick) {
      if (stick.lastRobberyDay != null && state.run.day - stick.lastRobberyDay <= 2 && stick.lastRobberyDistrict === areaId) stick.heatStreak += 1;
      else stick.heatStreak = 0;
      stick.lastRobberyDay = state.run.day;
      stick.lastRobberyDistrict = areaId;
      stick.dailyCount = (stick.dailyCount || 0) + 1;
    }
    recordCriminalActivity(state, areaId, "stick");
    bumpPlugSuspicion(state, areaId, options);
  }
  function stickTargetAvailability(state, targetId) {
    const target = STICK_TARGET_BY_ID[targetId];
    if (!state.rob?.visible || !target) return { available: false, reason: "That corner has not opened yet." };
    if (target.areaId !== state.world.currentNeighborhoodId) return { available: false, reason: "Wrong part of town." };
    if (target.tier > Math.max(state.stick?.tier || 0, stickTier(state))) return { available: false, reason: "You are not there yet." };
    if (target.slots && !target.slots.includes(state.run.slot)) return { available: false, reason: `Runs ${target.slots.map((slot) => SLOTS[slot]).join(" or ")} only.` };
    if ((state.stick?.dailyCount || 0) >= Districts.STICK_DAILY_CAP) return { available: false, reason: "Two in a day is how people get named. Tomorrow." };
    if (target.tier >= 2 && !equippedWeapon(state)) return { available: false, reason: "Bring a weapon before pressing a register." };
    if (target.tier === 3 && Math.min(2, stickCasing(state, targetId)?.timesObserved || 0) < 2 && !stickCrewReady(state)) {
      return { available: false, reason: "Case it twice or bring crew before a job this size." };
    }
    return { available: true, reason: "Ready.", chance: stickChance(state, target) };
  }
  function visibleStickTargets(state) {
    if (!state.rob?.visible) return [];
    const tier = Math.max(state.stick?.tier || 0, stickTier(state));
    return STICK_TARGETS.filter((target) => target.areaId === state.world.currentNeighborhoodId && target.tier <= tier);
  }
  // Retaliation is decided when the card is built so the choices carry plain
  // declarative effects; hash-keyed, so replaying the morning is stable.
  function stickRetaliationEvent(state, entry) {
    // v1.19: one expression, two uses. It decides whether the third choice
    // exists AND whether standing your ground reads as overriding his judgment,
    // and those two have to agree - tagging a violent choice against someone who
    // was never offered would charge the player for a choice they did not have.
    const deshawnActive = Crew.deEscalateAvailable(state, "stick_retaliation");
    const target = STICK_TARGET_BY_ID[entry.targetId];
    const name = target ? target.name : "the last mark";
    const won = stringHash(`${state.run.seed}:retaliation:${state.run.day}:${entry.targetId}`) % 100 < clamp(35 + combatCompat(state) * 10, 20, 85);
    const payoff = Math.min(120, state.player.cash);
    return {
      id: "stick_retaliation", title: "They Found You", who: "People from the job", where: AREA_BY_ID[entry.areaId]?.name || "Spenard",
      stakes: "Word got back. Someone came looking.",
      description: `People connected to ${name} caught up with you. Two ways this goes.`,
      choices: [
        won
          ? { label: "Stand your ground", effect: { heat: 1, ...(deshawnActive ? { deshawnViolentChoice: true } : {}) }, preview: "Hold the corner.", result: "You do not blink. They decide you are not worth it and move on." }
          : { label: "Stand your ground", effect: { heat: 1, health: -14, ...(deshawnActive ? { deshawnViolentChoice: true } : {}) }, preview: "Hold the corner.", result: "It costs you. You keep your feet, barely, and they leave a warning." },
        { label: "Pay them off", effect: { cash: -payoff }, preview: payoff > 0 ? `Hand over $${payoff}.` : "Empty pockets talk too.", result: "Money calms the conversation. Nobody swings." },
        ...(deshawnActive ? [{ label: "Let Deshawn handle it", effect: { deshawnDeescalate: true }, preview: "No blood, −1 Heat. He remembers being trusted with it.", result: "Deshawn hears them out all the way through, which nobody has done for them yet. He names a number lower than they wanted and a reason better than they had. They take both." }] : []),
      ],
    };
  }
  function resolveStickRetaliation(state, random) {
    const queue = state.stick?.retaliationQueue;
    if (!queue?.length || state.run.status !== "playing") return;
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return;
    const dueIndex = queue.findIndex((entry) => state.run.day >= entry.triggerDay);
    if (dueIndex === -1) return;
    const [entry] = queue.splice(dueIndex, 1);
    state.run.pendingEvent = stickRetaliationEvent(state, entry);
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
    "ROB", "ROB_DEALER", "STICKUP", "CASE_TARGET", "ELI_TEST_ROUTE", "TAKEOVER", "WORK_JOB", "WORK_SHIFT",
    "LEASE_GARAGE", "TRAIN_ATTRIBUTE", "NILE_WELLNESS", "NILE_COFFEE", "NILE_TONK_SIT", "NILE_CELO_SIT", "SHOPLIFT", "BOOST", "WANDER_SPENARD", "EXPLORE_SPENARD", "BUS_TRAVEL", "WALK_HOME",
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
  // v1.31. The day the run's late-game story beats consider "late enough".
  // This is the SAME arithmetic the old checkpoint used, and deliberately so -
  // three authored beats (Dre's note coming due, Curtis's late pressure, Mina's
  // callback) were paced against it and should keep firing exactly when they
  // did. What changed is that it no longer has the power to end anything. The
  // stored field is still `run.checkpointDay` because renaming it would move
  // the save schema for no player-visible gain; the name is historical, and
  // this function is the only thing that should read it.
  function lateRunDay(state) {
    return state.run.checkpointDay || Infinity;
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
  // The cash ladder is unchanged: the gym charges more for the second and third
  // hour of the same day. What changed in v1.10 is what the hour buys - growth
  // now comes from Attributes.attributeGrowth, which taper on lifetime sessions
  // of that activity rather than on sessions today.
  function gymSessionDetails(state, activityId) {
    const gym = state.world.locations.gym;
    const sessionsToday = gym.sessionDay === state.run.day ? gym.sessionsToday : 0;
    const index = Math.min(3, sessionsToday);
    const sessionCost = [25, 45, 75, 120][index];
    const membershipFee = state.memberships?.gym ? 0 : 30;
    const activity = AttributeData.GYM_ACTIVITY_BY_ID[activityId] || AttributeData.GYM_ACTIVITIES[0];
    const priorSessions = gym.activitySessions?.[activity.id] || 0;
    const current = normalizedAttributes(state)[activity.attribute];
    const growth = Attributes.attributeGrowth(current, priorSessions, activity.id);
    return {
      cost: sessionCost + membershipFee, sessionCost, membershipFee, sessionsToday,
      activity, growth, priorSessions,
      unlocked: Attributes.gymActivityAvailable(state, activity.id),
    };
  }
  // Consecutive days, not consecutive sessions - three visits in one afternoon
  // is not discipline. The streak is read as +1 effective Combat on the next
  // check that wants it, and the day it breaks is handled in confirmDayEnd.
  function registerGymDay(state) {
    const day = state.run.day;
    if (state.player.gymStreakDay === day) return;
    state.player.gymStreak = state.player.gymStreakDay === day - 1 ? (state.player.gymStreak || 0) + 1 : 1;
    state.player.gymStreakDay = day;
    if (state.player.gymStreak !== AttributeData.GYM_STREAK_REQUIREMENT) return;
    // Showing up three days running is the kind of thing the people you live
    // with notice, and it reads well to every civilian lens.
    for (const channel of ["household", "neighborhood"]) {
      Exposure.broadcastObservation(state, {
        type: "growth", event: "gym_consistent", location: "spenard", channel,
      });
    }
    logEntry(state, "Three days straight. Juan noticed the bag gloves by the door.", "good");
  }
  // The Night Owl's contribution to Charisma. Deliberately the smallest of the
  // three sources: a night at the counter is incidental practice, not training,
  // and it should never compete with actually going somewhere to get better.
  function growAtNightOwl(state) {
    const read = Attributes.growthFor(state, "night_owl_social", state.nightOwl.socialSessions - 1);
    if (!read) return false;
    return improveAttribute(state, read.attribute, read.growth);
  }

  // ---- The Nile ----------------------------------------------------------

  // One growth call for every Nile source. Sessions taper on lifetime count of
  // that specific activity, matching the gym: your fortieth hand of Tonk teaches
  // you less than your second, and neither one is worth what a real negotiation
  // is worth.
  function growAtNile(state, activity, priorSessions) {
    const read = Attributes.growthFor(state, activity, priorSessions);
    if (!read) return false;
    const improved = improveAttribute(state, read.attribute, read.growth);
    if (improved) addStreetReadEntry(state, "exploration", `${state.world.currentNeighborhoodId}:the_nile`);
    return improved;
  }

  // Consecutive days at the building, either floor. Mirrors registerGymDay, with
  // the one difference that it records which attribute it earned - The Nile
  // teaches two things and the bonus has to know which one it is paying out.
  function registerNileDay(state, attribute) {
    const day = state.run.day;
    state.player.nileStreakAttribute = attribute;
    state.world.locations.theNile.lastVisitDay = day;
    if (state.player.nileStreakDay === day) return;
    state.player.nileStreak = state.player.nileStreakDay === day - 1 ? (state.player.nileStreak || 0) + 1 : 1;
    state.player.nileStreakDay = day;
    if (state.player.nileStreak !== AttributeData.NILE_STREAK_REQUIREMENT) return;
    // Household and neighborhood only. Never network - the whole strategic
    // value of this building is that Curtis does not hear about it.
    for (const channel of ["household", "neighborhood"]) {
      Exposure.broadcastObservation(state, {
        type: "growth", event: "nile_consistent", location: Nile.NILE_LOCATION_ID, channel,
      });
    }
    logEntry(state, "Three days running at The Nile. The front desk stops asking your name.", "good");
  }

  // The wandering path. Ramped rather than flat for the same reason job
  // discovery is: a flat 5% leaves a patient player walking the same blocks for
  // a week, and a ramp guarantees they get there eventually without making the
  // first walk a certainty. What they notice is the foot traffic - too many men
  // going into a wellness spa after dark.
  //
  // Hashed off the seed and the walk count, never drawn from run.rngState, so a
  // replayed day discovers the building on the same walk.
  function rollNileDiscovery(state) {
    const nile = state.world.locations.theNile;
    if (nile.discovered) return false;
    const chance = Nile.wanderChance(nile.wanderMisses);
    const roll = (stringHash(`${state.run.seed}:nile:wander:${nile.wanderMisses}`) % 1000) / 1000;
    if (roll >= chance) { nile.wanderMisses += 1; return false; }
    discoverNile(state, Nile.DISCOVERY_METHODS.wander);
    logEntry(state, "Four men go into the wellness place on Spenard Road inside ten minutes. None of them look like they came for a massage.", "");
    return true;
  }

  // Juan knows Biniam through day labor. At Warm he mentions the building; at
  // Trusted he vouches, which is a different thing and opens the stairwell.
  function maybeJuanNileMention(state) {
    const band = bandOf(state, "juan");
    if (band >= Nile.JUAN_VOUCH_BAND && !state.world.locations.theNile.secondFloorAccess) {
      logEntry(state, "Juan says he called ahead. The Ethiopian spot on Spenard, upstairs. Ask for Biniam and say the name Hernandez.", "good");
      return grantDenAccess(state, Nile.DEN_ACCESS_METHODS.juan);
    }
    if (band >= Nile.JUAN_MENTION_BAND && !state.world.locations.theNile.discovered) {
      logEntry(state, "Juan mentions a wellness place on Spenard Road run by a family he did some work for. Says the steam is worth the thirty dollars.", "good");
      return discoverNile(state, Nile.DISCOVERY_METHODS.juan);
    }
    return false;
  }

  // Ground floor discovery. Any of three routes, recorded so the changelog and
  // the tests can tell which one a run actually took.
  function discoverNile(state, method) {
    const nile = state.world.locations.theNile;
    if (nile.discovered) return false;
    nile.discovered = true;
    nile.discoveryMethod = method;
    queueUnlock(state, "gambling");
    logEntry(state, "Blue Nile Wellness, on Spenard Road. Beige siding, blue neon, and frankincense before you are through the door.", "good");
    return true;
  }

  // Second floor. Somebody has to vouch for you; it is never found by walking.
  function grantDenAccess(state, method) {
    const nile = state.world.locations.theNile;
    if (nile.secondFloorAccess) return false;
    // You cannot be handed the upstairs code without knowing the building.
    if (!nile.discovered) discoverNile(state, method);
    nile.secondFloorAccess = true;
    nile.accessMethod = method;
    state.world.locations.gamblingKnown = true;
    logEntry(state, "The code for the stairwell door changes weekly. You have this week's.", "good");
    return true;
  }

  // Selam names her brother once she is Warm. This is the discovery bridge the
  // location doc describes: the player finds the ground floor first, becomes a
  // regular, and the room upstairs arrives through her.
  function maybeSelamBridge(state) {
    if (state.npc.selam.mentionedBiniam) return false;
    if (bandOf(state, "selam") < Nile.SELAM_BRIDGE_BAND) return false;
    state.npc.selam.mentionedBiniam = true;
    logEntry(state, `Selam Tesfaye, on her way past: "${Nile.SELAM_LINES[BANDS.WARM]}"`, "good");
    return grantDenAccess(state, Nile.DEN_ACCESS_METHODS.selam);
  }

  // At Trusted she starts telling you what she sees. She watches every man who
  // walks through that door and she remembers which ones watch the lot first.
  function maybeSelamIntel(state) {
    if (bandOf(state, "selam") < BANDS.TRUSTED) return false;
    if (state.npc.selam.lastIntelDay === state.run.day) return false;
    const unsent = Nile.SELAM_INTEL.filter((text) => !state.npc.selam.intelSent.includes(text));
    if (!unsent.length) return false;
    const text = unsent[stringHash(`${state.run.seed}:selam:intel:${state.run.day}`) % unsent.length];
    state.npc.selam.intelSent.push(text);
    state.npc.selam.lastIntelDay = state.run.day;
    pushPhoneMessage(state, "Selam", text);
    return true;
  }

  // Three games a day, same slot competition as everything else. The counter
  // resets on the day rather than in confirmDayEnd so a save loaded mid-run
  // cannot arrive with yesterday's count.
  function registerGameStart(state) {
    const gambling = state.gambling;
    if (gambling.dailyGamesDay !== state.run.day) {
      gambling.dailyGamesDay = state.run.day;
      gambling.dailyGamesPlayed = 0;
    }
    gambling.dailyGamesPlayed += 1;
  }

  function gamesPlayedToday(state) {
    return state.gambling.dailyGamesDay === state.run.day ? state.gambling.dailyGamesPlayed : 0;
  }

  function lowestTonkSeat(table) {
    let best = 0;
    for (let seat = 1; seat < table.hands.length; seat += 1) {
      if (Gambling.handValue(table.hands[seat]) < Gambling.handValue(table.hands[best])) best = seat;
    }
    return best;
  }

  // Money changes hands, the room notices or does not, and the night is over.
  function settleNileSession(state, net) {
    const game = state.world.locations.gambling;
    game.plays += 1;
    game[net > 0 ? "wins" : "losses"] += 1;
    game.net += net;
    state.gambling.sessionProfit += net;
    if (game.plays === 1) recordBehavior(state, "connector", 1, "gambling:first_contact", "gambling_contact");
    addStreetReadEntry(state, "exploration", `${state.world.currentNeighborhoodId}:gambling`);
    // Biniam watches how you handle it. He is reading composure, not the cards.
    Exposure.recordObservation(state, "biniam", {
      type: net >= 0 ? "presence" : "discretion",
      event: net >= 0 ? "played_clean" : "lost_well",
      location: Nile.NILE_LOCATION_ID, source: "witnessed",
    });
    for (const row of GamblingEvents.sessionObservations(net, Nile.NILE_LOCATION_ID)) {
      Exposure.broadcastObservation(state, { ...row, day: state.run.day, slot: state.run.slot });
    }
  }

  function finishTonk(state, dropper) {
    const table = state.gambling.table;
    const result = GamblingEvents.resolveTonk({ table, dropper, buyIn: table.buyIn });
    const net = result.playerWon ? result.payout : -table.buyIn;
    if (result.playerWon && result.payout > 0) state.player.cash += table.buyIn + result.payout;
    else if (result.caught && dropper === 0) spendCash(state, Math.min(state.player.cash, table.buyIn));
    state.gambling.tonkGamesPlayed += 1;
    state.npc.biniam.tonkGames += 1;
    const nile = state.world.locations.theNile;
    nile.activitySessions.tonk_game = (nile.activitySessions.tonk_game || 0) + 1;
    // The social reading is the growth, win or lose. That is the whole point of
    // the table: you learn the room either way.
    const read = GamblingEvents.tonkGrowth(state, nile.activitySessions.tonk_game - 1, result.playerWon);
    if (read) improveAttribute(state, read.attribute, read.growth);
    settleNileSession(state, net);
    logEntry(state, result.tonk && result.playerWon
      ? `Tonk. Hand of nothing, and the table pays double. Up $${result.payout}.`
      : result.playerWon
        ? `You drop with ${result.handValues[0]} and it holds. Up $${result.payout}.`
        : result.caught && dropper === 0
          ? `You drop with ${result.handValues[0]} and somebody had less. That one costs double.`
          : `Seat ${dropper} drops before you do. Your $${table.buyIn} stays on the table.`,
    result.playerWon ? "good" : "bad");
    state.gambling.table = null;
    registerNileDay(state, "charisma");
    return advanceRun(state, { reason: "NILE_TONK_SIT" });
  }

  function finishCelo(state, { round, result, bet, adjustment }) {
    if (result.payout > 0) state.player.cash += bet + result.payout;
    else if (result.result === "push") state.player.cash += bet;
    state.gambling.celoRoundsPlayed += 1;
    state.npc.biniam.celoRounds += 1;
    const nile = state.world.locations.theNile;
    nile.activitySessions.celo_game = (nile.activitySessions.celo_game || 0) + 1;
    const read = GamblingEvents.celoGrowth(state, nile.activitySessions.celo_game - 1, {
      won: result.result === "win",
      pressed: adjustment === "press",
      probability: round.odds ? round.odds.probability : null,
    });
    if (read) improveAttribute(state, read.attribute, read.growth);
    settleNileSession(state, result.payout);
    logEntry(state, result.result === "win"
      ? `${result.player.dice.join("-")} against the bank's ${round.banker.dice.join("-")}. Up $${result.payout}.`
      : result.result === "push"
        ? `${result.player.dice.join("-")}. Nobody moves. The bet comes back.`
        : `${result.player.dice.join("-")} against ${round.banker.dice.join("-")}. The bank takes it.`,
    result.result === "win" ? "good" : result.result === "push" ? "" : "bad");
    state.gambling.round = null;
    registerNileDay(state, "intelligence");
    return advanceRun(state, { reason: "NILE_CELO_SIT" });
  }

  function gymActivityOptions(state) {
    return AttributeData.GYM_ACTIVITIES.map((activity) => {
      const details = gymSessionDetails(state, activity.id);
      return {
        id: activity.id, label: activity.label, blurb: activity.blurb,
        attribute: activity.attribute, cost: details.cost, unlocked: details.unlocked,
        reason: details.unlocked ? null : "Sparring opens once you can handle yourself.",
      };
    });
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
      result.reason = gym.sessionsToday ? "Coming back the same day costs more and does less." : "The first session of the day is the one that counts.";
      return result;
    }
    if (actionId === "the_nile_tonk" || actionId === "the_nile_celo") {
      const tonk = actionId === "the_nile_tonk";
      const floor = tonk ? Gambling.TONK_MIN_BUY_IN : Gambling.CELO_MIN_BUY_IN;
      const ceiling = tonk ? Gambling.TONK_MAX_BUY_IN : Gambling.CELO_MAX_BUY_IN;
      if (params.buyIn != null && (params.buyIn < floor || params.buyIn > ceiling)) {
        result.reason = `Buy-in runs $${floor} to $${ceiling}.`;
        return result;
      }
      result.available = true;
      result.reason = tonk ? "Cards. Five each, and the low hand takes it." : "Dice. Three throws to set a point.";
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
    // Only the walk-in counter is a place. Paying online, or from the Bills list
    // on the phone itself (v1.26), is a surface the player carries with them, so
    // neither answers to the Spenard storefront's district gate.
    if (action.type === "PAY_PHONE_BILL" && (action.surface === "online" || action.surface === "phone")) return null;
    if (action.type === "WORK_JOB") return `job:${action.jobId}`;
    if (action.type === "WORK_SHIFT") return "job:ship_creek";
    if (action.type === "TRAVEL" && action.neighborhoodId === HOME_DISTRICT_ID) return "return_spenard";
    return DISTRICT_ACTION_BY_TYPE[action.type] || null;
  }
  function districtActionPreflight(state, action) {
    const actionId = districtActionIdFor(action);
    if (!actionId) return true;
    const params = action.type === "NILE_TONK_SIT" || action.type === "NILE_CELO_SIT" ? { buyIn: action.buyIn }
      : action.type === "WORK_JOB" && action.jobId === "night_owl" && state.jobs?.records?.night_owl?.rank >= 1 ? { slots: [2, 3] }
        : {};
    return districtActionAvailability(state, actionId, params).available;
  }
  // ---------------------------------------------------------------------------
  // 907List broker track (v1.9b)
  // ---------------------------------------------------------------------------

  // Which tier the player is actually at, recomputed on every read rather than
  // stored. Tier 2 is bought (the laptop); Tier 3 is earned, and the dispute
  // ceiling is what stops it being a pure grind: ten flips only count if you
  // were reading the listings instead of buying everything on the board.
  function marketTier(state) {
    const list = state.nineZeroSevenList;
    if (!list) return 1;
    const flips = Math.max(0, Math.floor(Number(list.flipCount) || 0));
    const disputes = Math.max(0, Math.floor(Number(list.disputes) || 0));
    if (state.inventory?.laptop && flips >= Market.BROKER_FLIP_REQUIREMENT && disputes < Market.BROKER_DISPUTE_LIMIT) return 3;
    if (state.inventory?.laptop) return 2;
    return 1;
  }

  function marketTierConfig(state) {
    return Market.MARKET_TIERS[marketTier(state)];
  }

  function marketCapacity(state) {
    return marketTierConfig(state).capacity;
  }

  // The first category to reach three flips keeps the tag for the run. Checked
  // in a fixed category order so two categories crossing on the same flip do not
  // resolve differently on two machines.
  function specialistCategory(state) {
    if (!marketTierConfig(state).specialist) return null;
    const counts = state.nineZeroSevenList?.categoryFlips || {};
    for (const category of Market.MARKET_CATEGORIES) {
      if ((Number(counts[category]) || 0) >= Market.SPECIALIST_FLIP_REQUIREMENT) return category;
    }
    return null;
  }

  // Where a meetup can happen: wherever the player is standing, provided the
  // tier reaches it. Downtown is not a menu option, it is a bus ride — which is
  // what makes the +30% margin cost something before the robbery roll is even
  // made.
  function marketMeetupDistrict(state) {
    const here = state.world.currentNeighborhoodId;
    return marketTierConfig(state).districts.includes(here) ? here : null;
  }

  // Anything held or listed. Listed items have not left the player's hands yet —
  // the buyer has only agreed — so they still count as carried value on the walk
  // to the next meetup.
  function listingInventoryValue(state) {
    return state.nineZeroSevenList.inventory.reduce((sum, entry) => sum + (entry.cost || 0), 0);
  }

  // Carried value is what the bag cost, not what it might fetch. The player is
  // shown this number next to the risk it produces, so it has to be one they can
  // do arithmetic on: "I paid $155 for the freezer" is checkable, "it might go
  // for $208" is a forecast, and pricing risk off a forecast makes the readout
  // impossible to plan against.
  function marketCarriedValue(state) {
    return state.nineZeroSevenList.inventory.reduce((sum, entry) => sum + (Number(entry.cost) || 0), 0);
  }

  function marketRobberyPreview(state, overrides = {}) {
    return MarketEvents.robberyPreview(state, {
      carriedValue: marketCarriedValue(state),
      district: marketMeetupDistrict(state) || state.world.currentNeighborhoodId,
      ...overrides,
    });
  }

  // The board. One draw per day from everything the tier can see, with the
  // specialist category adding a fifth slot in the thing the player got good at.
  //
  // Fields the tier does not include are nulled rather than omitted, so a UI
  // that forgets to check the tier still cannot leak condition to a Scrapper.
  function listingSlate(state, surface) {
    const access = nineZeroSevenListAccess(state, surface);
    if (!access.available) return [];
    const tier = marketTier(state);
    const config = Market.MARKET_TIERS[tier];
    const day = state.run.day;
    const list = state.nineZeroSevenList;
    const heldIds = new Set(list.inventory.map((entry) => entry.itemId));
    const takenIds = new Set(list.taken?.day === day ? list.taken.ids : []);
    const pool = LISTING_ITEMS.filter((item) => item.tier <= tier && !heldIds.has(item.id) && !takenIds.has(item.id));
    const order = seededShuffle(pool, state.run.seed, stringHash(`907list:${day}:${tier}`));
    // Intelligence is knowing where to look. A Scrapper who reads the board
    // well sees one more listing a day than one who does not - the same board,
    // just more of it noticed.
    const extraListing = normalizedAttributes(state).intelligence >= AttributeData.ADVANTAGE_THRESHOLD ? 1 : 0;
    const picked = order.slice(0, config.listings + extraListing);
    const specialist = specialistCategory(state);
    if (specialist) {
      const bonus = order.find((item) => item.category === specialist && !picked.includes(item));
      if (bonus) picked.push(bonus);
    }
    return picked.map((item) => decorateListing(state, item, day, config));
  }

  function decorateListing(state, item, day, config) {
    const shows = (field) => config.fields.includes(field);
    const reliability = MarketEvents.reliabilityFor(state, item.id, day);
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      buy: item.buy,
      estimate: MarketEvents.estimatedResale(item),
      condition: shows("condition") ? item.condition : null,
      conditionLabel: shows("condition") ? Market.CONDITIONS[item.condition].label : null,
      reliability: shows("reliability") ? reliability : null,
      reliabilityLabel: shows("reliability") ? Market.SELLER_RELIABILITY[reliability].label : null,
      specialist: specialistCategory(state) === item.category,
    };
  }

  // A distressed seller's three-item lot. Regenerated per day from the seed, so
  // it is the same lot every replay and it disappears if it is not taken.
  function marketBulkDeal(state) {
    if (!marketTierConfig(state).bulk) return null;
    const list = state.nineZeroSevenList;
    if (list.bulkDeal?.day === state.run.day) return list.bulkDeal;
    return MarketEvents.generateBulkDeal(state, { tier: marketTier(state), day: state.run.day });
  }

  function marketRequests(state) {
    return (state.nineZeroSevenList.buyerRequests || [])
      .filter((request) => state.run.day - request.day < Market.REQUEST_EXPIRY_DAYS);
  }

  // Which held item can satisfy a given request: right category, and priced
  // inside what the buyer said they would pay.
  function requestFillCandidates(state, requestId) {
    const request = marketRequests(state).find((entry) => entry.id === requestId);
    if (!request) return [];
    return state.nineZeroSevenList.inventory.filter((held) => {
      if (held.listed) return false;
      const item = LISTING_ITEM_BY_ID[held.itemId];
      return item && item.category === request.category && item.buy <= request.budget;
    });
  }

  // Everything the 907List page needs in one read, so the UI never has to
  // recompute a tier gate and get it slightly different.
  function marketOverview(state) {
    const tier = marketTier(state);
    const config = Market.MARKET_TIERS[tier];
    const list = state.nineZeroSevenList;
    return {
      tier,
      name: config.name,
      blurb: config.blurb,
      capacity: config.capacity,
      held: list.inventory.length,
      carriedValue: marketCarriedValue(state),
      flipCount: list.flipCount,
      disputes: list.disputes,
      specialist: specialistCategory(state),
      quickSell: config.quickSell,
      requests: config.requests,
      bulk: config.bulk,
      verified: tier >= Market.MAX_TIER,
      district: marketMeetupDistrict(state),
      nextTier: tier < Market.MAX_TIER ? nextTierRequirement(state, tier) : null,
    };
  }

  function nextTierRequirement(state, tier) {
    if (tier === 1) return "A used laptop opens the wider board.";
    const remaining = Math.max(0, Market.BROKER_FLIP_REQUIREMENT - state.nineZeroSevenList.flipCount);
    if (state.nineZeroSevenList.disputes >= Market.BROKER_DISPUTE_LIMIT) return "Too many disputes. Broker standing is closed this run.";
    return `${remaining} more clean ${remaining === 1 ? "flip" : "flips"} for Broker standing.`;
  }

  // The risk check every meetup runs. Returns true when the player was robbed,
  // having already applied the whole outcome: the bag is gone, so is the health,
  // and the block heard about it.
  //
  // Losing the bag also drops anything already promised to a buyer, which is why
  // pendingSells is rebuilt rather than left pointing at inventory ids that no
  // longer exist.
  function marketMeetupRobbery(state, nonce) {
    const district = marketMeetupDistrict(state) || state.world.currentNeighborhoodId;
    const carriedValue = marketCarriedValue(state);
    if (!MarketEvents.rollRobbery(state, { carriedValue, district, slot: state.run.slot, nonce })) {
      // The meetup went ahead. How visible it was is an Intelligence read -
      // picking the hour and the lot. The robbery roll itself is deliberately
      // left alone so the risk number the page shows stays honest.
      //
      // v1.19: Pherris's edge applies here, as one effective level, the same
      // shape as Tone's on a confrontation. Knowing which buyer is serious is
      // exactly what picking the hour and the lot is made of.
      const marketRead = Crew.intelAdvantageFor(state, "market_transaction");
      const outcome = resolveOutcome(state, "market_meetup", 0.75, `${state.run.seed}:meetup:${state.run.day}:${state.run.slot}:${nonce}`, marketRead);
      broadcastOutcome(state, "market_meetup", outcome.tier);
      return false;
    }
    const list = state.nineZeroSevenList;
    const lost = list.inventory.length;
    list.inventory = [];
    list.pendingSells = [];
    list.robberies += 1;
    const damage = MarketEvents.robberyHealthLoss(state, nonce);
    state.player.health = clamp(state.player.health - damage, 0, 100);
    state.player.heat = clamp(state.player.heat + Market.ROBBERY.heatGain, 0, 15);
    broadcastOutcome(state, "market_meetup", "catastrophic", carriedValue);
    logEntry(state, lost
      ? `Two of them work the meetup. You lose ${lost === 1 ? "the item" : `all ${lost} items`} and ${damage} health, and the block will hear about it.`
      : `Two of them work the meetup and find nothing worth taking. You lose ${damage} health.`, "bad");
    return true;
  }

  // One completed flip: the money landed, the counters move, and the household
  // notices a run of clean income.
  //
  // A dispute is a flip delivered for less than it cost. That is the appraisal
  // skill made consequential: buying the flatscreen with the cracked bezel is
  // not just a thin day, it is the thing that closes Broker standing.
  function recordMarketFlip(state, { item, payout, cost, district }) {
    const list = state.nineZeroSevenList;
    list.sales += 1;
    list.profit += payout - cost;
    list.flipCount += 1;
    list.categoryFlips[item.category] = (list.categoryFlips[item.category] || 0) + 1;
    if (payout < cost) list.disputes += 1;
    addCleanCash(state, payout);
    // A flip that clears 30% was a good read, not a lucky one, and reading value
    // is exactly what Intelligence is for. Breaking even teaches nothing, which
    // is why the gate is a margin rather than a sale.
    if (cost > 0 && payout > cost * PROFITABLE_FLIP_MARGIN) {
      const read = Attributes.growthFor(state, "list_flip", list.flipCount - 1);
      if (read) improveAttribute(state, read.attribute, read.growth);
    }
    // value carries the payout because Curtis's network filter gates financial
    // observations at $200: a big 907List day is exactly how this is meant to
    // reach him, and a $40 space heater is exactly how it is meant not to.
    //
    // v1.19: network as well as household. Until now the only financial channel
    // in the game was the one the player lives on, so the people who trade in
    // money for a living - Pherris, Dre - could never hear about the money. The
    // filter above is what keeps this honest: small flips stay a household fact,
    // and a day big enough for Pherris to notice is a day Curtis's people notice
    // too. Getting large enough to attract talent is what attracts attention.
    // Tracked rather than raw so the network arrival credits his awareness.
    for (const channel of ["household", "network"]) {
      broadcastTracked(state, {
        type: "financial",
        event: "907list_profit",
        location: district,
        value: payout,
        channel,
      });
    }
    const beforeTier = list.tier;
    list.tier = marketTier(state);
    list.specialist = specialistCategory(state);
    if (list.tier > beforeTier && list.tier === Market.MAX_TIER) {
      Exposure.broadcastObservation(state, {
        type: "growth",
        event: "market_reputation",
        value: list.flipCount,
        channel: "reputation",
      });
      logEntry(state, "Enough clean deals have closed that people use your name. Broker standing: buyers text you now, and your listings move the same day.", "good");
      pushPhoneMessage(state, "907List", "your account is verified. listings post same-day now.");
    }
    return payout - cost;
  }

  // Marks the listing as taken so the same item cannot be bought twice off one
  // day's board.
  function markListingTaken(state, itemId) {
    const list = state.nineZeroSevenList;
    if (list.taken.day !== state.run.day) list.taken = { day: state.run.day, ids: [] };
    if (!list.taken.ids.includes(itemId)) list.taken.ids.push(itemId);
  }

  // Buyers responding to open-market listings. Rebuilds the survivor list rather
  // than splicing in place, matching resolveJobApplications.
  //
  // A flake is the buyer ghosting, not the player's fault, so it costs the slot
  // that was spent listing and nothing else: the item stays held and can be
  // relisted.
  function resolveMarketSells(state) {
    const list = state.nineZeroSevenList;
    if (!Array.isArray(list.pendingSells) || !list.pendingSells.length) return 0;
    const now = slotNumber(state.run.day, state.run.slot);
    const waiting = [];
    let resolved = 0;
    for (const pending of list.pendingSells) {
      const held = list.inventory.find((entry) => entry.id === pending.inventoryId);
      if (!held) continue;
      if (pending.status !== "listed" || now < pending.resolveAtSlot) { waiting.push(pending); continue; }
      const item = LISTING_ITEM_BY_ID[pending.itemId];
      if (MarketEvents.rollFlake(state, pending.id)) {
        held.listed = false;
        logEntry(state, `The buyer for the ${item.name.toLowerCase()} stops answering. It is still yours to list again.`, "warn");
        continue;
      }
      pending.status = "ready";
      pending.price = MarketEvents.salePrice(state, item, { condition: item.condition, nonce: pending.id, district: pending.district });
      waiting.push(pending);
      resolved += 1;
      pushPhoneMessage(state, "907List", `buyer confirmed for the ${item.name.toLowerCase()} at $${pending.price}. meet up to close it.`);
    }
    list.pendingSells = waiting;
    return resolved;
  }

  // A named buyer texts once a day at Broker tier, and expired asks fall off.
  function resolveBuyerRequests(state) {
    const list = state.nineZeroSevenList;
    if (!marketTierConfig(state).requests) return;
    list.buyerRequests = marketRequests(state);
    if (list.buyerRequests.some((request) => request.day === state.run.day)) return;
    const request = MarketEvents.generateBuyerRequest(state, { filledRequests: list.filledRequests, day: state.run.day });
    if (!request) return;
    list.buyerRequests.push(request);
    pushPhoneMessage(state, request.buyerName, request.text);
  }

  // Holding a board's worth of resale stock is visible from the street. Fires at
  // most once a week so a Broker who never sells does not flood the ledger.
  function noticeMarketInventory(state) {
    const list = state.nineZeroSevenList;
    if (marketCarriedValue(state) < Market.INVENTORY_NOTICE_VALUE) return;
    if (state.run.day - list.lastNoticeDay < 7) return;
    list.lastNoticeDay = state.run.day;
    Exposure.broadcastObservation(state, {
      type: "growth",
      event: "inventory_accumulation",
      location: state.world.currentNeighborhoodId,
      value: marketCarriedValue(state),
      channel: "neighborhood",
    });
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
      DELIVER_907LIST: "Delivered a 907List sale", QUICK_SELL_907LIST: "Took a 907List quick sell",
      FILL_BUYER_REQUEST: "Filled a buyer's request", BUY_BULK_907LIST: "Bought a 907List lot",
      WALK_HOME: "Walked home", TRAVEL: "Traveled", TRAIN_ATTRIBUTE: "Trained", NILE_WELLNESS: "Steam room at The Nile", NILE_COFFEE: "Coffee upstairs at The Nile", NILE_TONK_SIT: "Played Tonk at The Nile", NILE_CELO_SIT: "Played Cee-lo at The Nile",
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
  // Everything the two floors will and will not let you do right now, in one
  // read. The UI renders from this and the reducer preflights against it, so
  // there is one answer to "can I sit down" rather than two that can drift.
  function nileAvailability(state) {
    const nile = state.world.locations.theNile;
    const home = state.world.currentNeighborhoodId === HOME_DISTRICT_ID;
    const wellness = districtActionAvailability(state, "the_nile_wellness");
    const den = districtActionAvailability(state, "the_nile_den");
    // Two siblings, two dispositions. They are tracked separately because they
    // are separate people: being welcome at Biniam's table says nothing about
    // whether Selam has decided you are good for her building.
    const band = bandOf(state, "biniam");
    const selamBand = bandOf(state, "selam");
    const access = Nile.tableAccess(band);
    const played = gamesPlayedToday(state);
    const capped = played >= Gambling.MAX_GAMES_PER_DAY;
    const midGame = !!(state.gambling.table || state.gambling.round);
    const deny = (reason) => ({ available: false, reason });
    const table = (allowed, gate, floor, ceiling) => {
      if (!home) return deny("Return to Spenard.");
      if (!nile.secondFloorAccess) return deny("You do not have the code for the stairwell door.");
      if (!den.available) return deny(den.reason);
      if (!allowed) return deny(gate);
      if (midGame) return deny("Finish the hand you are in.");
      if (capped) return deny("Three games is enough for one day.");
      if (state.player.cash < floor) return deny(`Buy-in starts at $${floor}.`);
      return { available: true, reason: `Buy-in $${floor}-$${ceiling}.` };
    };
    return {
      discovered: !!nile.discovered,
      secondFloorAccess: !!nile.secondFloorAccess,
      band, selamBand, cups: access.cups, gamesToday: played, maxGames: Gambling.MAX_GAMES_PER_DAY,
      wellness: !home ? deny("Return to Spenard.")
        : !nile.discovered ? deny("You have not found the place yet.")
        : !wellness.available ? deny(wellness.reason)
        : state.player.cash < Nile.WELLNESS_COST ? deny(`The steam room is $${Nile.WELLNESS_COST}.`)
          : { available: true, reason: `$${Nile.WELLNESS_COST} · restores ${Nile.WELLNESS_HEALTH} health` },
      coffee: !home ? deny("Return to Spenard.")
        : !nile.secondFloorAccess ? deny("You do not have the code for the stairwell door.")
        : !den.available ? deny(den.reason)
        : midGame ? deny("Finish the hand you are in.")
          : { available: true, reason: "Free · one part of day" },
      tonk: table(access.tonk, "Biniam has not offered you a seat yet.", Gambling.TONK_MIN_BUY_IN, Gambling.TONK_MAX_BUY_IN),
      celo: table(access.celo, "The dice are for people he knows better.", Gambling.CELO_MIN_BUY_IN, Gambling.CELO_MAX_BUY_IN),
      privateGames: access.privateGames,
    };
  }

  function nileAmbient(state, floor) {
    return Nile.ambientFor(floor, state.run.slot, state.run.day);
  }

  // Everything the Tonk table needs to render, including exactly as much about
  // the other seats as the player's Charisma has earned. The opponents' actual
  // cards never leave the reducer.
  function tonkView(state) {
    const table = state.gambling.table;
    if (!table) return null;
    const charisma = Attributes.effectiveAttribute(state, "charisma");
    const hand = table.hands[0];
    return {
      buyIn: table.buyIn,
      pot: table.buyIn * table.seats,
      hand: hand.map((card) => ({ id: card.id, rank: card.rank, suit: card.suit, value: card.value })),
      ...Gambling.describeHand(hand),
      discardTop: table.discard.length ? table.discard[table.discard.length - 1] : null,
      stockLeft: table.stock.length,
      opponents: GamblingEvents.readOpponents(table, charisma, state.run.seed),
      vision: GamblingEvents.tonkVision(charisma),
    };
  }

  // The Cee-lo briefing. The dice are already set; what varies by Intelligence
  // is whether the player is told the odds, told the exact number, or told
  // nothing and left to decide on nerve.
  function celoView(state) {
    const round = state.gambling.round;
    if (!round) return null;
    const intelligence = Attributes.effectiveAttribute(state, "intelligence");
    const briefing = GamblingEvents.celoBriefing(round, intelligence, state.run.seed);
    return {
      buyIn: round.buyIn,
      banker: round.banker,
      bankerNoResult: round.banker.kind === "no_result",
      ...briefing,
      pressTo: Gambling.adjustedBet(round.buyIn, "press"),
      backOffTo: Gambling.adjustedBet(round.buyIn, "back_off"),
      canPress: briefing.vision.canAdjust && state.player.cash >= Gambling.adjustedBet(round.buyIn, "press") - round.buyIn,
    };
  }

  function activityAvailability(state) {
    const employer = state.world.locations.employer;
    const gym = gymSessionDetails(state);
    const store = state.world.locations.discountStore;
    const explore = districtActionAvailability(state, "explore_spenard");
    const gymAccess = districtActionAvailability(state, "spenard_gym");
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
      gym: { available: gymAccess.available, reason: gymAccess.visible ? gymAccess.reason : "Return to Spenard to use the gym.", cost: gym.cost, sessionsToday: gym.sessionsToday, activities: gymActivityOptions(state), streak: state.player.gymStreak || 0 },
      // `gambling` now means "is there a table you can sit at tonight", and the
      // tables are at The Nile. Kept under the old key because the Street page,
      // the unlock celebration, and the simulator all read it by that name.
      gambling: (() => {
        const nile = nileAvailability(state);
        if (nile.tonk.available || nile.celo.available) return { available: true, reason: nile.celo.available ? "Cards and dice are both running." : "The Tonk table has room." };
        return { available: false, reason: nile.tonk.reason };
      })(),
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
  // Reading the board and meeting a seller are two different permissions. The
  // board is a phone surface and travels with the player; a meetup only happens
  // where the tier reaches, which is why a Scrapper standing Downtown can browse
  // and cannot buy.
  function nineZeroSevenListAccess(state, surface = "phone") {
    if (!state.knowledge?.knows907List) return { visible: false, available: false, reason: "The link is still unknown." };
    if (surface === "home" && !state.inventory.laptop) return { visible: false, available: false, reason: "A laptop is required at home." };
    if (!state.phone?.active && surface !== "home") return { visible: true, available: false, reason: "Phone service is off." };
    const config = marketTierConfig(state);
    return { visible: true, available: true, reason: `${config.name} tier. ${config.listings} listings refresh daily.` };
  }

  // Whether a seller will actually meet you where you are standing.
  function marketMeetupAvailability(state) {
    const access = nineZeroSevenListAccess(state, "phone");
    if (!access.available) return { available: false, reason: access.reason };
    const district = marketMeetupDistrict(state);
    if (!district) {
      const config = marketTierConfig(state);
      return config.districts.length > 1
        ? { available: false, reason: "No 907List sellers meet out here. Spenard or Downtown." }
        : { available: false, reason: "Scrapper meetups happen in Spenard only." };
    }
    return { available: true, reason: district === "downtown" ? "Downtown meetup: better margins, more exposure." : "Spenard meetup." };
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
    // The Night Owl does not fire you, it just stops putting you on the
    // schedule. Mina is still there, and that relationship is not employment.
    if (jobId === "night_owl" && state.player.heat >= JOB_HEAT_FIRING) {
      return { available: false, reason: "Mina cannot put you on the schedule this week. You can still come in." };
    }
    return { available: true, reason: "Choose a shift approach. Uses one part of day." };
  }

  // Heat costs you work.
  //
  // A ladder, not a coin flip, and shaped like Yalonda's housing warnings: the
  // employer says something before they do something, and the rung you are on
  // is legible. Day labor is exempt at every rung - it is the floor the run
  // stands on, and taking it away turns a bad week into an unrecoverable one.
  const JOB_HEAT_FIRST_WARNING = 8;
  const JOB_HEAT_FINAL_WARNING = 10;
  const JOB_HEAT_FIRING = 12;
  // Attendance costs you work too (v1.29).
  //
  // The complement to applyHeatEmployment, and deliberately the same shape: the
  // employer says something before they do something, and the rung you are on
  // is legible. Jobs paid like free money before this, with all the time in the
  // world left over to hustle and no reason to ever show up.
  //
  // The rule is CONSECUTIVE days, not total. Working any shift resets the count
  // to zero, so somebody who works every other day is never fired for it. That
  // is the design: this punishes ghosting, not an irregular schedule. There is
  // no employer roster in state - `job.scheduled` is a once-per-day flag, not a
  // rota - so "a day ended and you did not come in" is the honest reading of a
  // missed shift, and it is what the ladder counts.
  //
  // No RNG anywhere. The counter hits the threshold and you are fired.
  const JOB_MISSED_FIRST_WARNING = 1;
  const JOB_MISSED_FINAL_WARNING = 2;
  const JOB_MISSED_FIRING = 3;
  function applyAttendance(state, endedDay) {
    const jobId = state.jobs.activeJobId;
    const job = SPENARD_JOB_BY_ID[jobId];
    if (!job || job.dayLabor) return null;
    const record = state.jobs.records[jobId];
    if (!record) return null;
    // Worked today: the ladder resets, whatever rung it was on.
    if (record.lastWorkedDay === endedDay) {
      if (state.jobs.missedShifts) state.jobs.missedShifts[jobId] = 0;
      return null;
    }
    // Grace on the day you are hired. Nobody is fired for not starting a shift
    // on an afternoon they were still being interviewed in the morning.
    if (record.hiredDay === endedDay) return null;
    // mergeDefaults hands `missedShifts` to every old save on load, so this is
    // belt-and-braces rather than a migration. It is worth the one expression:
    // this runs inside the day-end settlement, and throwing here would take the
    // run down at the moment the player has the least ability to recover it.
    if (!state.jobs.missedShifts) state.jobs.missedShifts = {};
    const missed = (state.jobs.missedShifts[jobId] || 0) + 1;
    state.jobs.missedShifts[jobId] = missed;
    // The Night Owl does not fire you, it stops putting you on the schedule -
    // the same pattern the Heat ladder already respects. Mina is still there,
    // and that relationship was never employment.
    if (missed >= JOB_MISSED_FIRING && jobId === "night_owl") {
      logEntry(state, "Mina takes you off the schedule. She does not make it a conversation.", "warn");
      return "descheduled";
    }
    if (missed >= JOB_MISSED_FIRING) {
      state.jobs.activeJobId = null;
      state.jobs.hired = ["day_labor"];
      state.jobs.offers = state.jobs.offers.filter((id) => id !== jobId);
      // The same reset ACCEPT_JOB and the Heat ladder use: the standing was
      // with them, not with you.
      record.xp = 0;
      record.rank = 0;
      record.relationship = 0;
      record.hiredDay = null;
      delete state.jobs.missedShifts[jobId];
      delete state.jobs.warnings[jobId];
      pushPhoneMessage(state, job.name, "Three days, no call. We gave the shifts away. Don't come back.");
      logEntry(state, `${job.name} let you go for not showing up.`, "bad");
      pushConsequence(state, `${job.name} fired you over attendance. Day labor is still there.`, "bad", "You Stopped Showing Up");
      for (const channel of ["household", "neighborhood"]) {
        Exposure.broadcastObservation(state, {
          type: "financial", event: "job_lost", location: state.world.currentNeighborhoodId, channel,
        });
      }
      return "fired";
    }
    if (missed === JOB_MISSED_FINAL_WARNING) {
      pushPhoneMessage(state, job.name, "Second day nobody heard from you. Don't make this a pattern.");
      logEntry(state, `${job.name} texts about the second day you missed.`, "warn");
      return "final_warning";
    }
    if (missed === JOB_MISSED_FIRST_WARNING) {
      logEntry(state, "Your boss is asking where you were.", "warn");
      return "warned";
    }
    return null;
  }

  function applyHeatEmployment(state, jobId) {
    const job = SPENARD_JOB_BY_ID[jobId];
    if (!job || job.dayLabor) return null;
    const heat = state.player.heat;
    // Cooling off un-arms the ladder. Nothing else clears a warning, which is
    // why laying low is the answer to the first one.
    if (heat < JOB_HEAT_FIRST_WARNING) { delete state.jobs.warnings[jobId]; return null; }
    if (heat >= JOB_HEAT_FIRING && jobId !== "night_owl") {
      state.jobs.activeJobId = null;
      state.jobs.hired = ["day_labor"];
      state.jobs.offers = state.jobs.offers.filter((id) => id !== jobId);
      // Same reset ACCEPT_JOB uses when you quit: the standing was with them,
      // not with you.
      const record = state.jobs.records[jobId];
      if (record) { record.xp = 0; record.rank = 0; record.relationship = 0; }
      delete state.jobs.warnings[jobId];
      pushPhoneMessage(state, job.name, "Don't come in tomorrow. We'll mail the last check.");
      logEntry(state, "You got let go. They didn't say why but you know.", "bad");
      pushConsequence(state, `${job.name} let you go. Day labor is still there.`, "bad");
      for (const channel of ["household", "neighborhood"]) {
        Exposure.broadcastObservation(state, {
          type: "financial", event: "job_lost", location: state.world.currentNeighborhoodId, channel,
        });
      }
      return "fired";
    }
    const rung = heat >= JOB_HEAT_FINAL_WARNING ? 2 : 1;
    const given = state.jobs.warnings[jobId] || 0;
    if (given >= rung) return null;
    state.jobs.warnings[jobId] = rung;
    if (rung === 1) {
      pushPhoneMessage(state, job.name, "People are talking. Keep your head down.");
      logEntry(state, "Your boss pulled you aside. 'People are talking. Keep your head down.'", "warn");
      return "warned";
    }
    pushPhoneMessage(state, job.name, "Final warning. Next problem and you're done here.");
    logEntry(state, "Final warning. Next problem and you're done here.", "bad");
    return "final_warning";
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

  // Growth arrives fractionally and banks a whole point when the accumulator
  // crosses one. The player is told they got better, never by how much - the
  // number lives behind the debug flag.
  function improveAttribute(state, attribute, growth) {
    if (!ATTRIBUTE_IDS.includes(attribute)) return false;
    const gained = Number(growth) || 0;
    if (gained <= 0) return false;
    if (state.player.attributes[attribute] >= ATTRIBUTE_MAX) return false;
    state.player.attributeProgress[attribute] += gained;
    if (state.player.attributeProgress[attribute] < 1) return false;
    state.player.attributeProgress[attribute] -= 1;
    state.player.attributes[attribute] = clamp(state.player.attributes[attribute] + 1, ATTRIBUTE_MIN, ATTRIBUTE_MAX);
    const label = Attributes.attributeLabel(state.player.attributes[attribute]);
    logEntry(state, `Something has changed in how you carry yourself. People read you as ${label} now.`, "good");
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
    return { available: true, reason: "Uses one part of day.", cost: 35 };
  }
  function minaThreatEligible(state) {
    const relevantHistory = !!(state.npc.mina.introChoice || state.flags.minaFlirted || state.flags.minaFriendlyIntro || state.flags.minaDistantIntro || state.flags.toldMinaAboutGarage || state.stats.moneySpent.relationships > 0);
    return !!(state.flags.minaBoundaryResolved && state.npc.mina.met && state.npc.mina.available !== false && state.npc.mina.status !== "gone" && relevantHistory && curtisHostile(state) && !state.flags.minaSedanNightResolved);
  }
  function recruitmentCost(state, crewId) {
    const person = CREW_BY_ID[crewId];
    if (!person) return 0;
    const charismaDiscount = Math.max(0, charismaCompat(state) - 1) * 0.05;
    const territoryDiscount = controlled(state, "north_star_lot") ? 0.10 : 0;
    return Math.max(1, Math.round(person.recruitCost * (1 - charismaDiscount - territoryDiscount)));
  }
  // NPCs whose lens is inverted (THREAT archetype): a "warm" band with them
  // means they consider the player harmless, not that they like them, so they
  // never count as vouching contacts.
  const INVERTED_LENS_IDS = ["curtis", "simone"];
  // Crew are not references. Deshawn, Tone, and Pherris all carry lenses now,
  // and letting any of them count toward another's recruitment gate would be the
  // crew vouching for itself.
  const CREW_LENS_IDS = ["deshawn", "tone", "pherris"];
  function warmNpcContactCount(state) {
    return EXPOSURE_NPC_IDS.filter((id) => !CREW_LENS_IDS.includes(id) && !INVERTED_LENS_IDS.includes(id) && state.npc[id] && bandOf(state, id) >= BANDS.WARM).length;
  }
  // v1.18: the proof gate, resolved. crew.js owns which band and score each
  // person needs; the ledger read stays here because src/data may not reach into
  // src/exposure. Returns true for anyone with no proof requirement.
  function crewRecruitmentEligible(state, crewId) {
    return Crew.recruitmentEligible(crewId, bandOf(state, crewId), Exposure.getDisposition(crewId, state));
  }
  // v1.18: Tone's gate, as one reason string the card and the UI can both read.
  // The condition that matters is earned rather than bought: his own ledger has
  // to say the player holds a position, read through a lens that only counts
  // nerve. He does not approach nobodies, and the ledger is what decides who is
  // one.
  //
  // The build prompt also gated this on curtisAwareness >= 7, on the theory that
  // the network telling Curtis told Tone too. Measured over 2,000 seeded runs
  // that gate is not a difficulty, it is a wall: average awareness is 0.32 of
  // 15 and two runs in two thousand reach the watching phase, so the card fired
  // zero times. The two halves pull apart because awareness is fed by
  // successful robberies while Tone's proof is fed by violence and defiance on
  // the neighborhood channel, which never reaches Curtis at all. Feeding the
  // awareness counter properly is its own build; gating a character behind it
  // today would ship him as content nobody sees.
  function toneRecruitmentAvailability(state) {
    const crew = state.people.crew.tone;
    if (crew.recruited) return { available: false, reason: "He already works here." };
    if (crew.status === "departed") return { available: false, reason: "He does not come back." };
    if (!crewRecruitmentEligible(state, "tone")) return { available: false, reason: "He has not heard anything about you worth hearing." };
    if (recruitedCrew(state).length >= crewCapacityFor(state)) return { available: false, reason: "No room on the crew." };
    if (state.player.cash < recruitmentCost(state, "tone")) return { available: false, reason: "Not enough cash for what he asks up front." };
    return { available: true, reason: "Tone is ready to hear the offer." };
  }
  // v1.19: the same gate, one domain over. Tone reads whether the player holds a
  // position; Pherris reads whether they are worth being connected to, which her
  // lens scores as money moving and an operation growing without noise. She does
  // not need to have been introduced first - the pherris_offer booth scene is a
  // separate beat about ownership of her list, and either can happen first.
  function pherrisRecruitmentAvailability(state) {
    const crew = state.people.crew.pherris;
    if (crew.recruited) return { available: false, reason: "She already works here." };
    if (crew.status === "departed") return { available: false, reason: "She does not come back." };
    if (!crewRecruitmentEligible(state, "pherris")) return { available: false, reason: "Nothing about your business has reached her yet." };
    if (recruitedCrew(state).length >= crewCapacityFor(state)) return { available: false, reason: "No room on the crew." };
    if (state.player.cash < recruitmentCost(state, "pherris")) return { available: false, reason: "Not enough cash for what she asks up front." };
    return { available: true, reason: "Pherris is ready to hear the offer." };
  }
  function deshawnRecruitmentAvailability(state) {
    if (state.flags.deshawnBusinessSevered) return { available: false, reason: "'It was business' permanently closed this route." };
    if (state.run.day < 5) return { available: false, reason: "Deshawn does not make this call before Day 5." };
    const damaged = (state.people.dealers.goodie?.robbedCount || 0) > 0;
    if (damaged && !(state.flags.goodieRestitution && state.npc.dre.cleanCompletions >= 1)) return { available: false, reason: "Repair things with Goodie and finish one clean Dre mission." };
    // He wants proof the player doesn't burn people: two social contacts kept
    // active, or two named people around Spenard whose ledgers read Warm.
    const activeContacts = Object.values(state.contacts).filter((record) => record.known && record.relationshipLevel > 0).length;
    if (!damaged && activeContacts < 2 && warmNpcContactCount(state) < 2) return { available: false, reason: "Build two active contacts first." };
    return { available: true, reason: "Deshawn is ready to hear the offer." };
  }
  // v1.15: the generic gates (loyalty 7 for tier 2, loyalty 9 for tier 3, plus
  // days on the crew) live in Crew.TIER_REQUIREMENTS; each member keeps their
  // own extra conditions on top. Promotion stays player-initiated.
  function crewTierAvailability(state, crewId) {
    const crew = state.people.crew[crewId];
    const blocks = controlledBlockCount(state);
    if (!crew?.recruited) return { available: false, reason: "Recruit this contact first." };
    if (crew.status === "departed") return { available: false, reason: "They are no longer on the crew." };
    const targetTier = crew.tier < 2 ? 2 : crew.tier < 3 ? 3 : null;
    if (!targetTier) return { available: false, reason: "This track is fully developed." };
    const req = Crew.TIER_REQUIREMENTS[targetTier];
    if (!Crew.tierRequirementMet(crew, targetTier, state.run.day)) {
      return { available: false, reason: `Tier ${targetTier} needs loyalty ${req.loyalty} and ${req.daysRecruited} days on the crew.` };
    }
    if (crewId === "pherris") {
      // v1.19: she manages the market, so the market is what promotes her. Tier
      // 2 is proof the player is actually in the business - a run of flips, or
      // enough lifetime margin that the volume says it instead. Tier 3 is a
      // block of her own to work plus Broker standing, because a network that
      // pays for itself needs somewhere to put the names.
      //
      // The old gate was blocks plus a $500 fee. Both are gone: Tone and Deshawn
      // promote free once their proof holds, and territory plus Broker is a
      // harder thing to reach than $500 is by the time you have either.
      const list = state.nineZeroSevenList;
      if (targetTier === 2) {
        return list.flipCount >= Crew.PHERRIS_TIER2_FLIPS || list.profit >= Crew.PHERRIS_TIER2_PROFIT
          ? { available: true, tier: 2, cost: 0 }
          : { available: false, reason: `Tier 2 needs ${Crew.PHERRIS_TIER2_FLIPS} flips or $${Crew.PHERRIS_TIER2_PROFIT} of market profit.` };
      }
      // marketTier() rather than list.tier: the stored field is a mirror kept for
      // saves and display, and the rule this file has followed since v1.9b is
      // that it is never the source. A gate reading the mirror would open for a
      // save that had drifted.
      return blocks >= 1 && marketTier(state) >= Market.MAX_TIER
        ? { available: true, tier: 3, cost: 0 }
        : { available: false, reason: "Tier 3 needs one controlled block and Broker standing." };
    }
    if (crewId === "tone") {
      // v1.18: he does not promote on time served. Tier 2 is three fights he was
      // standing in, which is the one thing on this screen money cannot buy.
      if (targetTier === 2) {
        const wins = crew.combatWins || 0;
        return wins >= Crew.TONE_TIER2_COMBAT_WINS
          ? { available: true, tier: 2, cost: 0 }
          : { available: false, reason: `Tier 2 needs ${Crew.TONE_TIER2_COMBAT_WINS} fights he was in. He has been in ${wins}.` };
      }
      return blocks >= 2 ? { available: true, tier: 3, cost: 0 } : { available: false, reason: "Tier 3 needs two controlled blocks." };
    }
    if (crewId === "deshawn") {
      // v1.19: retro-gated onto his own ledger. His tier 2 used to be an
      // unconditional pass and his tier 3 waited on a Curtis confrontation
      // pipeline that was never built; both now read the lens he already has.
      // It weights loyalty, discretion, and betrayal, so this is a CHARACTER
      // gate rather than a skill one - he promotes people who have not burned
      // anyone, which is the only thing his credibility is made of.
      if (targetTier === 2) {
        return atLeastBand(state, "deshawn", BANDS.TRUSTED)
          ? { available: true, tier: 2, cost: 0 }
          : { available: false, reason: "Tier 2 needs him to trust you, not just employ you." };
      }
      return atLeastBand(state, "deshawn", BANDS.BONDED)
        ? { available: true, tier: 3, cost: 0 }
        : { available: false, reason: "Tier 3 needs years of trust in a week. He is not there yet." };
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
      power += person.power + clamp(crew.loyalty - Crew.CREW_LOYALTY_START, 0, 3) - (crew.wageDue > 0 ? 2 : 0);
      if (person.id === "tone" && crew.tier >= 2) power += crew.tier === 3 ? 4 : 2;
    }
    if (includePlayer) {
      power += combatCompat(state) * 2 + charismaCompat(state) + intelligenceCompat(state);
      if (state.player.health > 80) power += 1;
      if (state.player.health < 50) power -= 2;
    }
    return Math.max(0, power);
  }
  function territoryPowerEstimate(state, areaId) {
    const exact = state.world.territories[areaId]?.power || 0;
    const intelligence = intelligenceCompat(state);
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
      // v1.13: a plug who is sure you rob people where they work stops selling.
      if (plugSuspicion(state, plugId) >= Districts.PLUG_SUSPICION_CUTOFF) continue;
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
    if (plug.id === "goodie") discount = Math.min(0.25, discount + (atLeastBand(state, "mina", BANDS.TRUSTED) ? 0.08 : atLeastBand(state, "mina", BANDS.WARM) ? 0.05 : 0));
    const relationshipDiscount = 1 - discount;
    // v1.13: a wary plug prices the risk of serving you into every unit.
    const suspicionPenalty = plugSuspicion(state, plug.id) >= Districts.PLUG_SUSPICION_PRICE_THRESHOLD ? 1 + Districts.PLUG_SUSPICION_PRICE_PENALTY : 1;
    return plug.priceModifier * relationshipDiscount * suspicionPenalty;
  }
  function tradeUnitPrices(state, productId) {
    const areaId = state.world.currentNeighborhoodId;
    const marketPriceValue = state.world.markets[areaId]?.prices[productId] || 0;
    const control = controlled(state, areaId);
    // v1.13: district difficulty lands on the market as price, not a roll —
    // a harder district (and one that has heard too much about your trading)
    // charges for the risk of serving you. One step = 4% on the buy side.
    const marketMods = districtMods(areaId, "market");
    const marketAwareness = state.criminalProfile?.districtAwareness?.[areaId]?.market || 0;
    const districtBuyFactor = 1 + (marketMods.diffMod + Math.floor(marketAwareness / Districts.AWARENESS_DIFF_DIVISOR)) * 0.04;
    const buy = Math.round(marketPriceValue * (control ? 0.96 : 1) * plugPriceModifier(state, productId) * districtBuyFactor);
    const charismaBonus = Math.max(0, charismaCompat(state) - 1) * 0.015;
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
    const capstone = blocks >= DISTRICT_CONTROL_CAPSTONE_BLOCKS && atLeastBand(state, "curtis", BANDS.TRUSTED);
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
  // v1.20: the old boolean is now the bottom rung of the intel ladder. Every
  // caller that only wants "can the player read this map at all" keeps working;
  // anything that wants a number asks blockIntelView.
  function blockIntelVisible(state) { return blockIntelLevel(state) >= 1; }

  // v1.20: the one line the crew screen shows for a lieutenant's territory
  // modifier. Null when the modifier would be information about nothing — the
  // person is not active, or the player holds no corners for it to act on.
  function lieutenantTerritoryModifier(state, crewId) {
    if (controlledBlockCount(state) < 1) return null;
    if (!Crew.modifierTier(state, crewId)) return null;
    if (crewId === "tone") {
      const bonus = Math.round((Crew.toneDefenseMultiplier(state) - 1) * 100);
      return { crewId, label: "Defense", value: `+${bonus}%`, detail: "Stationed soldiers defend harder against raids." };
    }
    if (crewId === "pherris") {
      const level = blockIntelLevel(state);
      return { crewId, label: "Intel Level", value: `${level}`, detail: BLOCK_INTEL_LEVEL_COPY[level] || BLOCK_INTEL_LEVEL_COPY[1] };
    }
    if (crewId === "deshawn") {
      const cut = Math.round((1 - Crew.deshawnHeatReduction(state)) * 100);
      return { crewId, label: "Heat Reduction", value: `${cut}%`, detail: "Less nightly Heat from the corners you hold." };
    }
    return null;
  }
  const BLOCK_INTEL_LEVEL_COPY = {
    1: "Ownership across the block map.",
    2: "Ownership, your posted soldiers, and an estimate of what Curtis has on his.",
    3: "Exact strength on Curtis's corners, when he last moved, and which of yours he is lining up.",
  };
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
    const required = Math.max(Crew.CREW_LOYALTY_START + 1, ELI_LIEUTENANT_UNLOCK.minLoyalty - streetReadAccessBonus(state));
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
    if ((state.stick?.dailyCount || 0) >= Districts.STICK_DAILY_CAP) return { available: false, reason: "Two robberies in a day is how people get named. Tomorrow." };
    if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult) return { available: false, reason: "Resolve the current situation first." };
    const capital = workingCapital(state);
    if (capital >= WORKING_CAPITAL_RESERVE) return { available: false, reason: `Rob opens when working capital falls below $${WORKING_CAPITAL_RESERVE}.` };
    const weaponBonus = equippedWeapon(state) ? 0.05 : 0;
    const crewBonus = Math.min(0.08, recruitedCrew(state).length * 0.04);
    const repeatPenalty = robbery.attempts * 0.035;
    // The Combat term used to live here. It is gone because resolveWithAttribute
    // owns it now, and the constant is the old formula evaluated at the old
    // *starting* attribute of 2 - not at 1. A fresh player therefore faces
    // exactly the odds they always did, and everything above that is advantage
    // rather than a bonus. Anchoring at 1 instead cost about a third of the run
    // economy, which is what the simulator caught.
    const chance = clamp(0.43 + intelligenceCompat(state) * 0.035 + weaponBonus + crewBonus - state.player.heat * 0.015 - repeatPenalty, 0.22, 0.72);
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

    const plug = PLUG_BY_ID[id];
    const minaBonus = atLeastBand(state, "mina", BANDS.TRUSTED) ? 0.08 : atLeastBand(state, "mina", BANDS.WARM) ? 0.05 : 0;
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
    else if ((state.stick?.dailyCount || 0) >= Districts.STICK_DAILY_CAP) rob = { available: false, reason: "Two robberies in a day is how people get named. Tomorrow." };
    else rob = { available: true, reason: "Take the corner. Injury, Heat, retaliation, and the block's supply are all on the table.", chance: dealerRobberyChance(state, record) };
    return { buy, rob, ask };
  }
  function dealerRobberyChance(state, record) {
    const weapon = equippedWeapon(state);
    const weaponBonus = weapon ? (weapon.type === "firearm" ? 0.12 : 0.06) : 0;
    return clamp(
      0.52 + weaponBonus + Math.min(0.10, recruitedCrew(state).length * 0.05)
      + intelligenceCompat(state) * 0.02 - state.player.heat * 0.012 - record.robbedCount * 0.10 - (record.retaliated ? 0.08 : 0),
      0.20, 0.78);
  }

  function operationScore(state) {
    const crew = recruitedCrew(state).reduce((sum, person) => sum + Math.max(0, state.people.crew[person.id].loyalty - Crew.CREW_LOYALTY_START + 2) * 35, 0);
    const influence = Object.values(state.world.influence).reduce((sum, value) => sum + value * 70, 0);
    const relationships = Math.max(0, dispositionOf(state, "mina")) * 12 + Math.max(0, dispositionOf(state, "dre")) * 7 + Math.max(0, dispositionOf(state, "curtis")) * 7;
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

  // The four label functions below keep the names the UI and the tests already
  // read, and only change what they consult. Each one now derives from the
  // ledger instead of an integer, which is where the old model was doing its
  // one honest piece of work: turning a number into something a player can hear.
  function relationshipForLender(state) {
    const lender = state.lender;
    const day = state.run.day;
    if (lender.status === "unoffered") return "unknown";
    if (lender.status === "declined") return "offer declined";
    const band = bandOf(state, "dre");
    if (lender.balance <= 0) return band >= BANDS.TRUSTED ? "helpful" : "businesslike";
    if (day > lender.dueDay + 1) return band <= BANDS.COLD ? "threatening" : "demanding";
    if (day > lender.dueDay) return "demanding";
    if (band >= BANDS.TRUSTED) return "patient";
    return "businesslike";
  }
  function dreTrustTier(state) {
    const band = bandOf(state, "dre");
    if (band >= BANDS.BONDED) return "Inner Circle";
    if (band >= BANDS.TRUSTED) return "Earner";
    if (band >= BANDS.WARM) return "Reliable";
    return "Stranger";
  }
  function dreIntroductionEligible(state) {
    const noLoan = state.lender.status !== "active" || state.lender.balance <= 0;
    const route = knowsYou(state, "juan") || !state.phone.active || state.phone.daysPastDue > 0;
    return state.run.day >= 2 && state.player.cash <= 80 && noLoan && state.lender.status === "unoffered" && route;
  }
  function dreMissionAvailability(state) {
    const dre = state.npc.dre;
    if (!dre.known || !atLeastBand(state, "dre", BANDS.TRUSTED)) return { available: false, reason: "Build a Reliable relationship with Dre first." };
    if (dre.offersDisabled) return { available: false, reason: "Three refusals ended Dre's mission offers for this run." };
    if (dre.activeMission) return { available: false, reason: "Finish or refuse the current mission first." };
    return { available: true, reason: "Dre can put one job in front of you." };
  }
  function sharkUnlocked(state) {
    return atLeastBand(state, "dre", BANDS.BONDED) && state.npc.dre.cleanCompletions >= 3 && state.npc.dre.loansRepaid >= 2;
  }
  function sharkRiskLabel(state, borrower, amount, term) {
    const amountPressure = amount >= 500 ? 2 : amount >= 250 ? 1 : 0;
    const termRelief = term >= 7 ? 2 : term >= 4 ? 1 : 0;
    const score = borrower.risk + amountPressure - termRelief - Math.floor((intelligenceCompat(state) - 1) / 2) - (atLeastBand(state, "dre", BANDS.BONDED) ? 1 : 0);
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
  // Curtis's label is the inverted read made legible. A score at or above
  // Neutral means he has no reason to look at you; every step below it is a
  // step toward the tax and the confrontation.
  function relationshipForRival(state) {
    const score = dispositionOf(state, "curtis");
    if (score === 0) return "unaware";
    if (score >= 6) return "respectful";
    if (score >= 3) return "cooperative";
    if (score <= -9) return "aggressive";
    if (score <= -5) return "competitive";
    return "dismissive";
  }
  function minaStatus(state) {
    const person = state.npc.mina;
    // A departure is authoritative. Once she has left, no later arithmetic
    // walks it back.
    if (person.available === false) return "gone";
    const band = bandOf(state, "mina");
    if (person.usedWithoutConsent && band < BANDS.WARM) return "gone";
    if (person.usedWithoutConsent) return "compromised";
    if (band >= BANDS.BONDED) return "committed";
    if (band >= BANDS.TRUSTED) return "trusted";
    if (band >= BANDS.WARM) return "cautious";
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
      const loyaltyBonus = clamp(crew.loyalty - Crew.CREW_LOYALTY_START, -2, 4) * 0.04;
      if (person.id === "eli") {
        const success = random.next() < 0.58 + intelligenceCompat(state) * 0.05 + loyaltyBonus - (assignment === "outer_run" ? 0.14 : 0);
        if (success) {
          const gain = random.int(85, assignment === "outer_run" ? 210 : 145);
          state.player.cash += gain;
          influenceChange(state, assignment === "outer_run" ? "airport_industrial" : "north_star_lot", 1);
          logEntry(state, `Eli returns through the garage side door with $${gain} and a route nobody followed.`, "good");
        } else {
          crew.loyalty = Crew.clampLoyalty(crew.loyalty - 1);
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
        crew.loyalty = Crew.clampLoyalty(crew.loyalty + standingGain(crew, crew.loyalty, 1, "open"));
        logEntry(state, "Pherris circles one name on her list and tears the rest of the page away.", "good");
      } else if (person.id === "tone") {
        if (assignment === "guard_base") {
          state.base.watched = false;
          Exposure.recordObservation(state, "curtis", { type: "discretion", event: "kept_low", source: "network" });
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
  // Both nightly gates, hashed rather than drawn off the tick's RNG. Same
  // idiom as the watcher roll: the seed, the subject, the day, and a salt that
  // keeps the two passes from ever sharing an answer. Hashing them is what
  // lets a second pass exist at all without shifting the stream for everything
  // that resolves after it tonight, and it means reloading a save replays the
  // night instead of rerolling it. The roll is fixed; the threshold it is
  // compared against is not, which is where the player's agency lives.
  function blockGateRoll(state, blockId, kind) {
    return (stringHash(`${state.run.seed}:raid:${blockId}:${state.run.day}:${kind}`) % 10000) / 10000;
  }
  // What the police roll against on a staffed corner. Heat and the block's own
  // patrol frequency, discounted by Eli. curtisVisibility is deliberately not
  // in here: the police do not care whose corner it is.
  function policeRaidChance(state, blockId) {
    const block = SPENARD_BLOCK_BY_ID[blockId];
    const record = state.world.territoryBlocks?.[blockId];
    if (!block || !record || record.owner !== "player" || !record.soldiersAssigned.length) return 0;
    const eli = state.people.crew.eli;
    const discount = eli.lieutenantStage === "operations_lieutenant" ? eli.lieutenantEffectiveness * Territory.POLICE_ELI_DISCOUNT : 0;
    return clamp(Territory.POLICE_BASE_CHANCE
      + state.player.heat * Territory.POLICE_HEAT_WEIGHT
      + block.patrolFrequency * Territory.POLICE_PATROL_WEIGHT
      - discount, 0, 0.9);
  }
  // How much easier a hot player's corners are, and the honest reason why
  // (v1.28). patrolFrequency is still not in here and never will be: he does not
  // read patrol routes. Heat is different - it is the player's own number, and
  // what it buys him is not information but arithmetic. Hot means arrests,
  // arrests mean thinner corners, thinner corners are cheaper to walk onto. He
  // is an opportunist, not a strategist, so this is a multiplier on a roll he was
  // already making and not a branch in a plan.
  //
  // Exactly 1.0 at or below the floor, so a player who keeps Heat down never
  // meets this build at all.
  function curtisHeatFactor(state) {
    const heat = Number(state.player?.heat) || 0;
    return 1 + Math.max(0, heat - Territory.CURTIS_HEAT_PROBE_FLOOR) * Territory.CURTIS_HEAT_PROBE_PER_POINT;
  }
  // What Curtis rolls against on any corner the player holds, posted or empty.
  // Visibility and phase decide whether he comes; the garrison decides how hard
  // it is when he does, and since v1.28 the player's Heat decides how lucky he
  // gets. patrolFrequency is deliberately not in here: he is not the police and
  // does not read their patrol routes.
  function curtisMoveChance(state, blockId) {
    const block = SPENARD_BLOCK_BY_ID[blockId];
    const record = state.world.territoryBlocks?.[blockId];
    if (!block || !record || record.owner !== "player") return 0;
    const phase = CurtisAwareness.phaseForLevel(curtisAwarenessOf(state).level);
    const gate = Territory.CURTIS_PHASE_VISIBILITY_GATE[phase];
    if (block.curtisVisibility < (gate == null ? 99 : gate)) return 0;
    // v1.28: an empty corner is half a defender rather than a whole one, so it
    // is finally cheaper than a corner with one person standing on it. Tone
    // still multiplies whatever is there, which is what he did before.
    const posted = record.soldiersAssigned.length;
    const defense = (posted > 0 ? posted * RAID_DEFENSE_PER_SOLDIER : Territory.CURTIS_UNSTAFFED_DEFENSE)
      * Crew.toneDefenseMultiplier(state);
    return clamp(Territory.CURTIS_BASE_CHANCE
      * (block.curtisVisibility * Territory.CURTIS_VISIBILITY_WEIGHT)
      * (Territory.CURTIS_PHASE_MULTIPLIER[phase] || 0)
      * curtisHeatFactor(state)
      / defense, 0, 0.9);
  }
  // The casualty half of a raid, shared by both adversaries: whether the
  // garrison takes a loss, and who. Tone is the whole number here — headcount
  // cancels out of assigned/defenseStrength on purpose, because a second body
  // is a second target as much as a second defender. Returns true on a loss.
  function takeRaidCasualty(state, random, record, toneDefense) {
    const assigned = record.soldiersAssigned;
    if (!assigned.length) return false;
    const defenseStrength = assigned.length * RAID_DEFENSE_PER_SOLDIER * toneDefense;
    const casualtyChance = clamp(assigned.length / defenseStrength, 0, 1);
    if (random.next() >= casualtyChance) return false;
    const lostId = random.pick(assigned);
    const soldier = state.world.soldiers[lostId];
    soldier.status = "lost";
    soldier.blockId = null;
    record.soldiersAssigned = assigned.filter((id) => id !== lostId);
    // v1.30: the only record that this corner lost somebody tonight. Before
    // this the casualty went into the feed as text and nowhere else - the
    // soldier's blockId is nulled and the block record kept no trace, so
    // "which corner lost a man last night" was unanswerable the morning after.
    // Tone's territory_status disclosure reads it. Additive: an older save has
    // no field, undefined never equals yesterday, and the schema stays v11.
    record.lastCasualtyDay = state.run.day;
    return true;
  }
  // Passive organization activity is summarized into a single compact report
  // per crossed day instead of one log line per block — a run with six
  // controlled blocks would otherwise flood the feed every night. Block
  // losses are the one exception ("major incidents"): each still gets its
  // own line, since losing a corner is worth reading on its own.
  //
  // v1.21: two adversaries, two passes, one night, in this order per block.
  //
  //   POLICE  costs people and costs Heat, and NEVER changes who owns the
  //           corner — the state disrupts an operation, it does not claim real
  //           estate. Staffed corners only: there is nothing to bust and
  //           nobody to arrest on an empty lot.
  //   CURTIS  changes who owns the corner and costs no Heat at all. Runs on
  //           unstaffed corners too, and at double the rate — an empty one you
  //           hold is the easiest one for him to walk back onto.
  //
  // Tone divides both. Eli discounts the police pass only: he manages an
  // operation against the police, not a war with Curtis.
  function resolveSoldierOperations(state, random, crossedDay) {
    if (!crossedDay) return;
    const movedBlocks = resolveEliAutoAssignment(state);
    const eli = state.people.crew.eli;
    let totalIncome = 0;
    let policeCount = 0;
    let curtisCount = 0;
    let attritionCount = 0;
    let heldExposure = 0;
    let repelledCount = 0;
    const policeBlockNames = [];
    const lostBlockNames = [];
    // v1.20: what Tone is worth tonight, read once. He is a modifier on the
    // guard layer, not a soldier — the number multiplies the people already
    // posted and is 1.0 the moment he is gone.
    const toneDefense = Crew.toneDefenseMultiplier(state);
    for (const block of SPENARD_BLOCKS) {
      const record = state.world.territoryBlocks[block.id];
      if (record.owner !== "player") continue;
      record.soldiersAssigned = record.soldiersAssigned.filter((id) => state.world.soldiers[id]?.status === "active");
      // Ownership is what costs attention, not staffing: an empty corner you
      // hold is still a corner people know is yours.
      heldExposure += block.heatExposure;
      if (record.soldiersAssigned.length > 0) {
        const assigned = record.soldiersAssigned;
        let blockIncome = 0;
        for (let index = 0; index < assigned.length; index += 1) blockIncome += block.earningPotential * Math.pow(SOLDIER_INCOME_BASE_DIMINISH, index);
        blockIncome = Math.round(blockIncome);
        totalIncome += blockIncome;
        record.incomeCollected += blockIncome;
        // --- Pass A: the police ------------------------------------------
        // They arrive on Heat and patrol frequency, and what the garrison
        // decides is how it ends — not who owns the corner afterward.
        if (blockGateRoll(state, block.id, "police") < policeRaidChance(state, block.id)) {
          record.lastRaidDay = state.run.day;
          record.raidCount += 1;
          state.player.heat = clamp(state.player.heat + 1, 0, 15);
          policeCount += 1;
          policeBlockNames.push(block.name);
          // A bust on the corner is public in Spenard and it is not news
          // Curtis trades in: heat_exposure does not clear his network filter
          // and he is not on the neighborhood channel at all. The location is
          // the block, not wherever the player happens to be standing.
          broadcastTracked(state, { type: "heat_exposure", event: "police_raid", channel: "neighborhood", location: HOME_DISTRICT_ID });
          // v1.23: and the morning-after read, which carries the corner so a
          // Warm+ neighbor can name it. One per raided corner per night, which
          // is already one per corner - a corner takes at most one police roll.
          emitRaidGossip(state, block.id);
          if (!takeRaidCasualty(state, random, record, toneDefense)) repelledCount += 1;
        }
      }
      // --- Pass B: Curtis --------------------------------------------------
      // No Heat is touched anywhere in here. He is not the police, and a corner
      // changing hands between two people who both sell on it is not something
      // the state noticed.
      const curtisChance = curtisMoveChance(state, block.id);
      if (curtisChance > 0 && blockGateRoll(state, block.id, "curtis") < curtisChance) {
        const staffed = record.soldiersAssigned.length > 0;
        takeRaidCasualty(state, random, record, toneDefense);
        const survivors = record.soldiersAssigned;
        for (const survivorId of survivors) {
          const survivor = state.world.soldiers[survivorId];
          if (survivor) survivor.blockId = null;
        }
        record.soldiersAssigned = [];
        record.owner = "curtis";
        // v1.28: the corner now has a history, and he remembers it. Every block
        // on the map starts out his, so "he used to own this" separates nothing
        // - what separates a corner is that he has already come and taken it
        // back once. If the player claims it again, the planner ranks it first.
        record.curtisTookBack = true;
        curtisCount += 1;
        lostBlockNames.push(block.name);
        // The network carries this, and broadcastTracked is the seam that turns
        // carrying it into him looking harder at the next corner.
        broadcastTracked(state, { type: "defiance", event: "block_lost_to_curtis", channel: "network", location: HOME_DISTRICT_ID });
        logEntry(state, staffed
          ? `Curtis takes ${block.name}. ${survivors.length} of Eli's people make it back to the garage.`
          : `${block.name} slips back under Curtis's people. Nobody was posted on it.`, "bad");
        continue; // nobody is left to lose on a corner that is no longer ours
      }
      const attritionChance = Math.max(0, SOLDIER_ATTRITION_BASE_CHANCE - eli.lieutenantEffectiveness * ELI_EFFECTIVENESS_ATTRITION_DISCOUNT);
      for (const id of [...record.soldiersAssigned]) {
        const soldier = state.world.soldiers[id];
        if (!soldier || soldier.status !== "active") continue;
        if (random.next() < attritionChance) {
          soldier.status = "lost";
          soldier.blockId = null;
          record.soldiersAssigned = record.soldiersAssigned.filter((sid) => sid !== id);
          record.lastCasualtyDay = state.run.day;
          attritionCount += 1;
        }
      }
    }
    if (totalIncome > 0) addDirtyCash(state, totalIncome);
    // The one territory heat path. Rolled after the blocks resolve so a corner
    // lost tonight stops costing attention tonight, and only when something is
    // actually held — a player with no blocks never touches this and so never
    // gets anything out of Deshawn's reduction.
    const territoryHeat = heldExposure > 0 && random.next() < territoryHeatChance(state, heldExposure);
    if (territoryHeat) state.player.heat = clamp(state.player.heat + 1, 0, 15);
    // One text per adversary per night, not one per block. Six corners on a bad
    // night is two messages and one card, not twelve messages and six modals —
    // the same volume rule the report itself exists to enforce.
    if (policeCount) {
      pushPhoneMessage(state, "Eli", policeCount === 1
        ? `Police came through ${policeBlockNames[0]} tonight. Corner's still ours.`
        : `Police worked ${policeBlockNames.slice(0, 2).join(" and ")} tonight. Corners are still ours.`);
    }
    if (curtisCount) {
      pushPhoneMessage(state, "Eli", curtisCount === 1
        ? `Curtis's people are standing on ${lostBlockNames[0]}. That corner isn't ours anymore.`
        : `We lost ${curtisCount} corners to Curtis tonight. Everybody who walked away is at the garage.`);
      pushConsequence(state, curtisCount === 1
        ? `Curtis has ${lostBlockNames[0]}.`
        : `Curtis has ${lostBlockNames.slice(0, 2).join(" and ")}${curtisCount > 2 ? " and more" : ""}.`, "bad");
    }
    if (totalIncome > 0 || movedBlocks.length || policeCount || curtisCount || attritionCount || territoryHeat) {
      const parts = [];
      if (totalIncome > 0) parts.push(`+$${totalIncome} territory income`);
      if (movedBlocks.length === 1) parts.push(`1 soldier moved to ${movedBlocks[0]}`);
      else if (movedBlocks.length > 1) parts.push(`${movedBlocks.length} soldiers moved (${movedBlocks.slice(0, 2).join(", ")}${movedBlocks.length > 2 ? "…" : ""})`);
      if (policeCount) parts.push(`${policeBlockNames.slice(0, 2).join(", ")}${policeCount > 2 ? " and others" : ""} took a police raid`);
      if (repelledCount) parts.push(`${repelledCount} raid${repelledCount === 1 ? "" : "s"} turned away at the corner`);
      if (curtisCount) parts.push(`${curtisCount === 1 ? lostBlockNames[0] : `${curtisCount} corners`} lost to Curtis`);
      if (attritionCount) parts.push(`${attritionCount} soldier${attritionCount === 1 ? "" : "s"} lost to attrition`);
      if (territoryHeat) parts.push("the held corners drew a look (+1 Heat)");
      if (!policeCount && !curtisCount && !attritionCount) parts.push("No casualties");
      // The tone stays warn/good. Severity is expressed through the "lost to
      // Curtis" clause, which is what the report card reads — a "bad" tone here
      // would render the good class.
      logEntry(state, `Eli's report: ${parts.join(" · ")}`, policeCount || curtisCount || attritionCount ? "warn" : "good");
    }
  }

  // --- ATTACK TELEGRAPHING THROUGH GOSSIP (v1.23) --------------------------
  //
  // Before Curtis's people move, the block knows. Whether that reaches the
  // player depends on who likes them: at Warm and above somebody texts, below
  // Warm nobody does, and a player with no warm neighborhood relationships meets
  // him cold. That silence is the whole feature - there is no negative branch
  // anywhere in here, only a candidate set that a Neutral NPC is not in.
  //
  // The shape, end to end:
  //
  //   1. The day-end pass reads curtisNightPlan for TOMORROW's night, once the
  //      night that just resolved has settled ownership and the crew tracks have
  //      settled who is still on the payroll.
  //   2. Each targeted corner raises one `territory / curtis_move_planned`
  //      observation on the neighborhood channel, queued straight onto
  //      run.pendingObservations at a slot this file computed. Curtis never sees
  //      it: he is not on the neighborhood channel, and `territory` does not
  //      clear his network filter either. This is the block reacting to his
  //      people moving, not a report to him.
  //   3. The queue drains at the top of the attack day (or the evening before,
  //      with Deshawn at tier 3), and whoever the player is closest to among the
  //      NPCs who heard it sends a phone text naming the corner.
  //
  // Why the plan is read for tomorrow rather than tonight: a warning that lands
  // after the corner changed hands is not a warning. The day-end pass is the only
  // place the next night's inputs are all final, so that is where it is raised,
  // and the neighborhood's standard one-day carry puts it in the player's hand on
  // the morning of the night it describes.
  //
  // Phone only, deliberately. Pherris's level-3 block card already carries the
  // standing strategic read ("his people are asking about this corner"); this is
  // the event-driven complement ("tonight"), and it is a private tip rather than
  // public news. The two surfaces do not overlap and the Territory page is
  // untouched.

  // Who could carry a piece of block news to the player, for a corner in a given
  // district. Authored voice AND routing: an NPC needs a line in gossip.js, has
  // to listen on the neighborhood channel, and has to be reachable where the
  // corner is. Nobody can be handed a line they had no way to have heard.
  function gossipAudience(state, districtId) {
    return Gossip.GOSSIP_VOICE_IDS.filter((npcId) => {
      if (!state.npc[npcId]) return false;
      if (!(NPC_CHANNELS[npcId] || []).includes("neighborhood")) return false;
      const areas = NPC_PRESENCE_AREAS[npcId];
      return !areas || !districtId || areas.includes(districtId);
    });
  }

  // What Deshawn is worth to the warning surface. modifierTier rather than a
  // bare getActiveCrew check because it is the established reading of "is this
  // lieutenant actually working" - departed, arrested, never recruited and
  // loyalty-0 all come back 0, so the bonus disappears the moment he does and
  // the player reverts to the no-Deshawn behavior with no extra branch.
  function gossipDeshawnTier(state) {
    return Crew.modifierTier(state, "deshawn");
  }

  // v1.28: carry what the plan could not spend into tomorrow's budget, capped,
  // and drop it entirely when the phase moves. The planner is a pure read and
  // stays one - it reads this field, it never writes it - so the write lives
  // here, on the resolver's side of the line, exactly once per crossed day.
  //
  // Zeroing on a phase change is the interesting rule rather than housekeeping.
  // The bank is intent he has accumulated at a given level of attention; an
  // operation that goes quiet enough to drop out of approaching has actually
  // bought itself something, and letting the carry survive that would mean
  // going quiet was worth nothing.
  function settleCurtisPressureBank(state) {
    state.run.curtisPressureBank = curtisPressureLeftover(state);
  }

  // Raises tomorrow night's warnings. Scope and timing are the Deshawn ladder;
  // the plan itself is never changed by him, because he does not change what
  // Curtis intends, only how much of it the player gets to hear.
  function emitCurtisGossipWarnings(state) {
    const plan = curtisNightPlan(state);
    if (!plan.length) return [];
    const tier = gossipDeshawnTier(state);
    const scope = tier >= Territory.GOSSIP_DESHAWN_FULL_SCOPE_TIER ? plan.length : Territory.GOSSIP_WARNING_BASE_SCOPE;
    const arrival = tier >= Territory.GOSSIP_DESHAWN_EARLY_ARRIVAL_TIER
      ? Territory.GOSSIP_WARNING_EARLY_ARRIVAL
      : Territory.GOSSIP_WARNING_ARRIVAL;
    const deliverAtSlot = slotNumber(state.run.day + arrival.dayOffset, arrival.slot);
    const audience = gossipAudience(state, HOME_DISTRICT_ID);
    const raised = [];
    for (const entry of plan.slice(0, scope)) {
      Exposure.queueObservation(state, audience, {
        type: "territory",
        event: Gossip.GOSSIP_WARNING_EVENT,
        // The corner, not the district. Routing was decided above, so location is
        // free to be the thing the text has to name.
        location: entry.blockId,
        value: entry.weight,
        channel: "neighborhood",
        day: state.run.day,
      }, deliverAtSlot);
      raised.push(entry.blockId);
    }
    return raised;
  }

  // The morning-after read on a police raid. Reactive by design: the police
  // answer Heat, which can move at any time, so there is nothing to telegraph and
  // no predictive version of this is coming. What it is worth is that the world
  // noticed - and that the person who noticed cared enough to ask.
  //
  // The v1.21 `heat_exposure / police_raid` broadcast is untouched and still
  // carries the disposition consequence on the district. This rides alongside it
  // carrying the corner, because a district-scoped row cannot name a corner and
  // rescoping the existing one to the block would break its own routing - no
  // NPC's presence areas contain a block id.
  function emitRaidGossip(state, blockId) {
    const arrival = Territory.GOSSIP_RAID_ARRIVAL;
    Exposure.queueObservation(state, gossipAudience(state, HOME_DISTRICT_ID), {
      type: "territory",
      event: Gossip.GOSSIP_RAID_EVENT,
      location: blockId,
      channel: "neighborhood",
      day: state.run.day,
    }, slotNumber(state.run.day + arrival.dayOffset, arrival.slot));
  }

  // One voice speaks once a day. Reset lazily on the first delivery of a new day
  // rather than in the day-end pass, so a text that lands in the evening and one
  // that lands the next morning are correctly on different days. Session state on
  // `run`: nothing here needs to outlive a run, and a save that predates the
  // field hydrates to an empty day.
  function gossipVoicesUsed(state) {
    const record = state.run.gossipVoices;
    if (!record || record.day !== state.run.day) {
      state.run.gossipVoices = { day: state.run.day, npcIds: [] };
    }
    return state.run.gossipVoices.npcIds;
  }

  // Who tells the player, out of everyone who heard it.
  //
  // Highest disposition wins, because the point of the surface is that closeness
  // is what buys information. Ties break on a hash of the seed, the corner and
  // the day, so two people who are equally close to the player do not resolve on
  // object key order and a reloaded save picks the same messenger.
  //
  // Three gates, and the middle one is the feature:
  //   - they have to have heard it (the caller passes only recipients)
  //   - they have to be Warm or better
  //   - their ledger cannot be empty. An NPC nobody has ever observed scores 0,
  //     which is Neutral, so this is belt and braces - but the acceptance
  //     criterion is explicitly that an uncomputed disposition can never speak,
  //     and asserting it here means no future default can quietly grant a voice.
  function pickGossipVoice(state, npcIds, blockId) {
    const spokenAlready = gossipVoicesUsed(state);
    const candidates = npcIds
      .filter((npcId) => !spokenAlready.includes(npcId))
      .filter((npcId) => Exposure.ledgerOf(state, npcId).length > 0)
      .filter((npcId) => atLeastBand(state, npcId, BANDS.WARM))
      .map((npcId) => ({
        npcId,
        score: dispositionOf(state, npcId),
        tiebreak: stringHash(`${state.run.seed}:warn-npc:${blockId}:${state.run.day}:${npcId}`),
      }))
      .sort((a, b) => (b.score - a.score) || (a.tiebreak - b.tiebreak) || (a.npcId < b.npcId ? -1 : 1));
    return candidates.length ? candidates[0].npcId : null;
  }

  // Turns a drained batch of gossip observations into at most one text per
  // corner. Resolved after the drain rather than inside it on purpose: picking
  // the messenger reads dispositions, and rows landing mid-drain would make the
  // choice depend on queue order.
  function deliverGossipTexts(state, landed) {
    if (!landed.length) return;
    const tier = gossipDeshawnTier(state);
    const byCorner = new Map();
    for (const entry of landed) {
      const key = `${entry.event}:${entry.blockId}`;
      if (!byCorner.has(key)) byCorner.set(key, { event: entry.event, blockId: entry.blockId, weight: entry.weight, npcIds: [] });
      const bucket = byCorner.get(key);
      if (!bucket.npcIds.includes(entry.npcId)) bucket.npcIds.push(entry.npcId);
    }
    // Heaviest pressure first, then his own ranking of the corners, so when the
    // roster of available voices runs short - one warm neighbor, three warned
    // corners - the one that gets said out loud is the one he wants most. The
    // comparator is the planner's, imported rather than restated: the plan is not
    // in hand here, and a second copy of the ranking would drift from it.
    const buckets = [...byCorner.values()].sort((a, b) => (b.weight || 0) - (a.weight || 0) || compareBlocksByCurtisPriority(a.blockId, b.blockId, state));
    for (const bucket of buckets) {
      const block = SPENARD_BLOCK_BY_ID[bucket.blockId];
      if (!block) continue;
      const npcId = pickGossipVoice(state, bucket.npcIds, bucket.blockId);
      if (!npcId) continue;
      // The pressure rider is Deshawn tier 2. Everyone else gets the plain line -
      // they know something is coming, not how hard.
      const pressure = bucket.event === Gossip.GOSSIP_WARNING_EVENT && tier >= Territory.GOSSIP_DESHAWN_PRESSURE_TEXT_TIER
        ? bucket.weight
        : null;
      const text = Gossip.gossipText(npcId, bucket.event, block.name, pressure);
      if (!text) continue;
      gossipVoicesUsed(state).push(npcId);
      pushPhoneMessage(state, Gossip.gossipSender(npcId), text);
    }
  }

  // The one call site for draining the observation queue. Everything that used to
  // call Exposure.resolveObservationQueue directly goes through here so a gossip
  // row can never land without the text that is the point of it.
  function drainObservations(state) {
    const landed = [];
    const delivered = Exposure.resolveObservationQueue(state, (entry) => {
      const observation = entry.observation;
      if (observation.type !== "territory") return;
      if (observation.event !== Gossip.GOSSIP_WARNING_EVENT && observation.event !== Gossip.GOSSIP_RAID_EVENT) return;
      landed.push({ npcId: entry.npcId, event: observation.event, blockId: observation.location, weight: observation.value });
    });
    deliverGossipTexts(state, landed);
    return delivered;
  }

  // ===========================================================================
  // v1.27 DISCLOSURE TABLES — the intel economy.
  //
  // Gossip is the block calling you unprompted. This is you calling the block.
  // Same underlying facts, opposite direction, and the differences are the
  // whole design: gossip is free and arrives on a schedule the player does not
  // set, disclosure is paid and arrives when they ask. Gossip is gated on
  // disposition and answers with silence. Disclosure is gated on BAND and
  // answers with a number whose accuracy is the band.
  //
  // Everything below is a pure read plus a debit. No RNG draw anywhere in the
  // path — the jitter is hashed inside src/data/disclosures.js — so buying
  // intel cannot change what happens tonight. That matters more than it
  // sounds: if a purchase moved the stream, the information would become a
  // cause of the thing it describes, and a player who bought a warning would
  // be buying a different night rather than a view of this one.

  // Who has already been called today. Lazily reset on read, exactly like
  // gossipVoicesUsed and for the same reason - a save loaded mid-run must not
  // arrive carrying yesterday's calls.
  // How many corners a chance-shaped read names. See disclosurePayload for why
  // this is a voice constraint rather than a balance one.
  const DISCLOSURE_CHANCE_DEPTH = 3;

  function disclosuresToday(state) {
    const record = state.run.disclosures;
    if (!record || record.day !== state.run.day) {
      state.run.disclosures = { day: state.run.day, entries: [] };
    }
    return state.run.disclosures.entries;
  }

  function disclosureAskedToday(state, npcId) {
    return disclosuresToday(state).some((entry) => entry.npcId === npcId);
  }

  // Recruited and still standing. Crew.getActiveCrew is the canonical predicate
  // and this is the same test on one id, kept here because disclosures are the
  // only caller that needs it per-person rather than as a roster.
  function crewIsActive(state, npcId) {
    const record = state.people?.crew?.[npcId];
    return !!(record && record.recruited && record.status === "active");
  }

  // The corners the player actually holds, in Curtis's own priority order. Both
  // chance-shaped products read this: a heat map of corners you do not own is
  // not intel, it is trivia.
  function heldBlockIds(state) {
    return SPENARD_BLOCKS
      .filter((block) => state.world?.territoryBlocks?.[block.id]?.owner === "player")
      .map((block) => block.id)
      .sort((a, b) => compareBlocksByCurtisPriority(a, b, state));
  }

  // THE ONE PLACE THAT READS LIVE STATE, and it reads it at the moment of
  // purchase. Nothing is pre-computed and nothing is scheduled. If the player
  // buys the nightly plan in the Morning they get the plan as it stands in the
  // Morning; if his awareness phase moves before dark, the message in their
  // inbox is out of date and stays out of date, because the source is not going
  // to call back with a correction. That is the staleness rule, and it is
  // implemented by the absence of code rather than by an expiry stamp.
  function disclosureTruth(state, intelType) {
    if (intelType === "curtis_targets" || intelType === "curtis_pressure" || intelType === "curtis_next_move") {
      return { plan: curtisNightPlan(state) };
    }
    // v1.30. Tone's read, and the only one pointed at the player's own side of
    // the board. Every field here is something the player was already told
    // overnight and has since scrolled past: how many are still standing, who
    // got raided, who lost somebody, whose corner changed hands. Yesterday, not
    // today, because the briefing is the morning after the night it describes.
    if (intelType === "territory_status") {
      const lastNight = state.run.day - 1;
      return {
        corners: heldBlockIds(state).map((blockId) => {
          const record = state.world.territoryBlocks[blockId];
          return {
            blockId,
            name: SPENARD_BLOCK_BY_ID[blockId].name,
            soldiers: blockSoldierCount(state, blockId),
            raided: record.lastRaidDay === lastNight,
            lostSomebody: record.lastCasualtyDay === lastNight,
          };
        }),
      };
    }
    const read = intelType === "police_heat_map" ? policeRaidChance : curtisMoveChance;
    return { chances: heldBlockIds(state).map((blockId) => ({ blockId, name: SPENARD_BLOCK_BY_ID[blockId].name, chance: read(state, blockId) })) };
  }

  // Truth in, spoken shape out. `accuracy` decides whether the numbers wobble;
  // the voice module decides how they sound. Returning `{ empty: true }` is a
  // real answer - "nothing is moving on your corners" is worth $50 to a player
  // who was about to spend the night defending one.
  function disclosurePayload(state, npcId, intelType, accuracy) {
    const truth = disclosureTruth(state, intelType);
    const key = `${state.run.seed}:disclosure:${npcId}:${intelType}:${state.run.day}`;
    const exact = accuracy === "exact";
    if (intelType === "curtis_targets") {
      const planIds = truth.plan.map((entry) => entry.blockId);
      if (!planIds.length) return { empty: true };
      const decoys = heldBlockIds(state).filter((blockId) => !planIds.includes(blockId));
      const shown = exact ? planIds : Disclosures.jitterList(planIds, decoys, `${key}:shape`);
      return { names: shown.map((blockId) => SPENARD_BLOCK_BY_ID[blockId].name) };
    }
    if (intelType === "curtis_pressure") {
      if (!truth.plan.length) return { empty: true };
      return {
        weights: truth.plan.map((entry) => {
          const weight = exact ? entry.weight : Disclosures.jitterWeight(entry.weight, `${key}:${entry.blockId}`, Territory.CURTIS_MAX_PRESSURE_PER_BLOCK);
          return { name: entry.name, weight, label: weight >= Territory.CURTIS_PRESSURE_HARD ? "coming hard" : "just looking" };
        }),
      };
    }
    if (intelType === "curtis_next_move") {
      if (!truth.plan.length) return { empty: true };
      // The top of the plan is the answer. A jittered read slides one down the
      // list rather than inventing a corner: the source is repeating the wrong
      // name off a real conversation, not making one up.
      const index = exact ? 0 : Disclosures.listShape(`${key}:shape`) === "faithful" ? 0 : Math.min(1, truth.plan.length - 1);
      return { name: truth.plan[index].name };
    }
    // No jitter branch on purpose: this product is authored exact only. See the
    // accuracy note in disclosures.js - a man miscounting his own people on the
    // player's own corners is a bug, not a texture.
    if (intelType === "territory_status") {
      if (!truth.corners.length) return { empty: true };
      return {
        corners: truth.corners.map((corner) => {
          const head = corner.soldiers === 0 ? "nobody on it"
            : corner.soldiers === 1 ? "one up"
            : `${corner.soldiers} up`;
          // "everybody held" is only true if there was anybody there to hold
          // it. An empty corner the police walked through gets the plainer
          // clause, because the alternative is Tone congratulating a garrison
          // that does not exist.
          const night = corner.lostSomebody ? "lost a man"
            : corner.raided ? (corner.soldiers > 0 ? "cops came through, everybody held" : "cops came through")
            : "quiet night";
          return { name: corner.name, soldiers: corner.soldiers, text: `${head}, ${night}` };
        }),
      };
    }
    if (!truth.chances.length) return { empty: true };
    // Worst first, and only the worst few. This is a presentation cap, not a
    // second accuracy axis - the numbers that survive it are as true as the
    // band makes them. It exists because none of these five people talk in
    // spreadsheets: Yalonda reciting six percentages off the top of her head
    // is not Yalonda, and a player on a 320px screen cannot read it anyway.
    // The voices are written to describe rather than enumerate, so a corner
    // falling off the end reads as somebody mentioning what stood out.
    const ranked = truth.chances
      .map((row) => {
        const chance = exact ? row.chance : Disclosures.jitterChance(row.chance, `${key}:${row.blockId}`);
        return { name: row.name, chance, text: Disclosures.percent(chance) };
      })
      .sort((a, b) => (b.chance - a.chance) || (a.name < b.name ? -1 : 1));
    return { chances: ranked.slice(0, DISCLOSURE_CHANCE_DEPTH) };
  }

  // What the phone offers, per NPC. Every row mirrors a reducer guard rather
  // than inventing a second rule, which is what keeps a button from lying - the
  // phoneBills discipline, applied to a surface that spends money.
  function disclosureOffers(state, npcId) {
    const asked = disclosureAskedToday(state, npcId);
    const phoneOff = !state.phone?.active;
    return Disclosures.disclosuresForNpc(npcId)
      .map((entry) => {
        const type = Disclosures.INTEL_TYPE_BY_ID[entry.intelType];
        const accuracy = Disclosures.resolvedAccuracy(npcId, entry.intelType, bandOf(state, npcId), entry.minBand);
        const price = type.price;
        if (accuracy === "unavailable") return null;
        // v1.30. The one row field that is a state read. A crew source has to
        // actually be on the crew: not hired, in custody, or walked out over
        // unpaid wages all mean the phone rings out. Hidden rather than greyed,
        // the same rule the band gate follows - a locked row for a lieutenant
        // the player has never met would advertise the table.
        if (entry.requiresCrew && !crewIsActive(state, npcId)) return null;
        // And a row whose accuracy has no authored voice is not for sale.
        // territory_status is exact-only, so this is what stops a Warm-band
        // jittered read from being offered and then coming back as silence.
        if (!Disclosures.hasVoice(npcId, entry.intelType, accuracy)) return null;
        const available = !phoneOff && !asked && state.player.cash >= price;
        // The button already renders the price, so the sub-label says the thing
        // the price does not: this is a phone call, and it does not cost a part
        // of the day. Printing the amount twice was the first thing that read
        // wrong on the built screen.
        const reason = phoneOff ? "Phone service is off"
          : asked ? "Already talked today"
          : state.player.cash < price ? `Need ${cashText(price)}`
          : "No time passes";
        return { intelType: entry.intelType, label: type.label, price, accuracy, available, reason };
      })
      .filter(Boolean);
  }

  // The "Ask about..." entry point. Hidden entirely when this person has
  // nothing unlocked - a greyed row for intel the player cannot yet buy would
  // advertise the table, and the table is meant to be discovered by getting
  // close to somebody, not read off a menu.
  function disclosureAvailability(state, npcId) {
    const offers = disclosureOffers(state, npcId);
    if (!offers.length) return { visible: false, available: false, reason: "", offers };
    if (!state.phone?.active) return { visible: true, available: false, reason: "Phone service is off", offers };
    if (disclosureAskedToday(state, npcId)) return { visible: true, available: false, reason: "Already talked today", offers };
    return { visible: true, available: true, reason: `${offers.length} thing${offers.length === 1 ? "" : "s"} to ask about`, offers };
  }

  // Ambient heat from held territory: every held block's heatExposure, weighted
  // into a nightly chance, times whatever Deshawn is worth (1.0 without him).
  // Exposed as a selector so the Territory screen can show the player the same
  // number the night rolls against.
  function territoryHeatChance(state, exposureOverride) {
    const exposure = exposureOverride != null ? exposureOverride : SPENARD_BLOCKS.reduce(
      (sum, block) => sum + (state.world.territoryBlocks[block.id]?.owner === "player" ? block.heatExposure : 0), 0);
    if (exposure <= 0) return 0;
    return clamp(exposure * TERRITORY_HEAT_CHANCE_PER_EXPOSURE * Crew.deshawnHeatReduction(state), 0, TERRITORY_HEAT_CHANCE_CAP);
  }

  // v1.15: Deshawn's weekly introduction. Every seven days on the crew he
  // connects the player to something they have not found yet - the Nile's
  // ground floor, the gym, a Night Owl regular - and when the map is used up,
  // a reliable market tip instead. Two texts: his, then the contact's.
  function resolveDeshawnIntro(state) {
    const crew = state.people.crew.deshawn;
    if (!crew?.recruited || crew.status !== "active") return;
    const record = state.npc.deshawn;
    const day = state.run.day;
    const since = record.lastIntroDay == null ? (crew.recruitedDay == null ? 7 : day - crew.recruitedDay) : day - record.lastIntroDay;
    if (since < 7) return;
    record.lastIntroDay = day;
    if (!state.world.locations.theNile.discovered) {
      discoverNile(state, Nile.DISCOVERY_METHODS.deshawn);
      record.introducedContacts.push("selam");
      pushPhoneMessage(state, "Deshawn", "Got somebody you should meet. She works mornings at the blue building on Spenard. Tell her D sent you.");
      pushPhoneMessage(state, "Selam", "Deshawn says you carry yourself right. Wellness desk is open from morning. Ask for Selam.");
      return;
    }
    if (!state.discovered.spenardGym) {
      state.discovered.spenardGym = true;
      record.introducedContacts.push("spenard_gym");
      pushPhoneMessage(state, "Deshawn", "Gym past the laundromat, same block. Ask about the week pass. Tell them I sent you.");
      pushPhoneMessage(state, "Spenard Gym", "D's people get the first week on the house. Doors open early. Come through.");
      return;
    }
    const unmetRegular = NIGHT_OWL_REGULARS.find((person) => !state.nightOwl.regulars[person.id]?.met);
    if (unmetRegular) {
      state.nightOwl.regulars[unmetRegular.id].met = true;
      if (state.contacts[unmetRegular.id]) state.contacts[unmetRegular.id].known = true;
      record.introducedContacts.push(unmetRegular.id);
      pushPhoneMessage(state, "Deshawn", `You know ${unmetRegular.name.split(" ")[0]} from the Night Owl? You should. Good people. I told them about you.`);
      pushPhoneMessage(state, unmetRegular.name.split(" ")[0], `Deshawn gave me your number. I'm at the Night Owl most nights. Come say hey.`);
      return;
    }
    // Everything findable is found: a market tip instead. Reliable by
    // definition - his name is on it.
    const product = PRODUCTS[stringHash(`${state.run.seed}:deshawn:tip:${day}`) % PRODUCTS.length];
    const area = AREA_BY_ID.north_star_lot;
    state.effects.rumors.push({ id: `deshawn_tip_${day}`, areaId: area.id, productId: product.id, reliable: true, text: `Deshawn heard ${product.name} is moving in ${area.name}. His information is never loose.`, expiresAt: slotNumber(day, 3) + 4 });
    pushPhoneMessage(state, "Deshawn", `Nobody new to meet this week. One thing instead: ${product.name} is moving in Spenard. Quietly. Do what you want with that.`);
  }
  // --- v1.16 Arrest & jail --------------------------------------------------
  // The single funnel every arrest goes through. Every number it reads lives in
  // src/data/arrest.js; what happens here is the state write.
  //
  // The trade the system makes: bail and clock in exchange for heat relief and
  // a permanent record. Priors make the next one dearer and longer, so farming
  // arrests to dump heat gets expensive fast, and a broke player pays in time
  // instead of money rather than soft-locking against a bail they cannot meet.
  //
  // Does NOT move the clock itself. It returns `processingSlots`, and the call
  // site feeds that to the one advanceRun it was already going to make — the
  // one-advance-per-action contract stays intact.
  function arrestPlayer(state, options) {
    const severity = Arrest.severityKey(options?.severity);
    const source = options?.source || "encounter";
    if (!state.record) state.record = { arrests: 0, lastArrestDay: null, charges: [] };
    const priors = Number(state.record.arrests) || 0;
    const bail = Arrest.bailFor(severity, priors);
    const paid = Math.min(state.player.cash, bail);
    if (paid > 0) spendCash(state, paid);
    const shortfall = bail - paid;
    const processingSlots = Math.min(
      Arrest.MAX_PROCESSING_SLOTS,
      Arrest.processingSlotsFor(severity, priors) + Arrest.shortfallSlots(shortfall),
    );
    const relief = Math.min(state.player.heat, Arrest.heatReliefFor(severity));
    state.player.heat = clamp(state.player.heat - relief, 0, 15);
    state.record.arrests = priors + 1;
    state.record.lastArrestDay = state.run.day;
    state.record.charges.push({ day: state.run.day, severity, source });
    state.stats.moneySpent.events += paid;
    state.stats.majorDecisions.push(`Arrest: ${severity} via ${source}`);
    // Being arrested is exactly what Curtis's people notice, and the network
    // channel is what raises his awareness through broadcastTracked.
    broadcastTracked(state, {
      type: "heat_exposure",
      event: severity.startsWith("stick") ? "heat_seen_high" : "heat_seen_low",
      channel: "network",
      location: state.world.currentNeighborhoodId,
      day: state.run.day,
    });
    const hash = stringHash(`${state.run.seed}:arrest:${state.run.day}:${state.run.slot}:${severity}:${state.record.arrests}`);
    const bookingBank = Arrest.BOOKING_LINES[source] || Arrest.BOOKING_LINES.encounter;
    logEntry(state, Arrest.pickLine(bookingBank, hash), "bad");
    const releaseBank = shortfall > 0 ? Arrest.RELEASE_LINES.served : Arrest.RELEASE_LINES.paid;
    pushConsequence(state, Arrest.pickLine(releaseBank, hash), "bad");
    pushConsequence(state, shortfall > 0
      ? `Bail was $${bail}. You had $${paid}. The rest came out of your hours. That makes ${state.record.arrests} on the sheet.`
      : `$${bail} to walk. The sheet says ${state.record.arrests} now, and sheets do not forget.`, "warn");
    if (relief > 0) pushConsequence(state, `${Arrest.pickLine(Arrest.HEAT_RELIEF_LINES, hash)} (-${relief} Heat)`, "");
    return { severity, source, bail, paid, shortfall, processingSlots, heatRelief: relief, priors: state.record.arrests };
  }

  // A crew member caught on a job. They keep their record and their arrears —
  // what changes is that they stop being active, which is what pulls them out
  // of capacity, power, wages, and field assignment until they are back.
  function jailCrewMember(state, crewId, severity) {
    const crew = state.people.crew?.[crewId];
    if (!crew?.recruited || crew.status !== "active") return null;
    const key = Arrest.severityKey(severity);
    crew.status = "arrested";
    crew.assignment = null;
    crew.jailedSeverity = key;
    crew.jailedUntilDay = state.run.day + Arrest.crewJailDaysFor(key);
    state.flags.crewBailPending = crewId;
    if (state.boost.crewAssigned === crewId) state.boost.crewAssigned = null;
    for (const block of Object.values(state.world.territoryBlocks || {})) {
      if (block.managerId === crewId) block.managerId = null;
    }
    const name = CREW_BY_ID[crewId].name.split(" ")[0];
    const hash = stringHash(`${state.run.seed}:crew-arrest:${crewId}:${state.run.day}`);
    logEntry(state, Arrest.pickLine(Arrest.CREW_BOOKED_LINES, hash).replace("%s", name), "bad");
    pushConsequence(state, `${name} got picked up. $${Arrest.crewBailFor(key)} makes it go away before Day ${crew.jailedUntilDay}.`, "bad");
    return crew;
  }

  // Nobody came. They walk out on their own date with loyalty at 1 — back on
  // the payroll, and one missed wage from leaving for good. Also the repair for
  // the v1.15 bug where an "arrested" member had no way back at all: a record
  // with no release date is released the first time this runs.
  function releaseServedCrew(state) {
    for (const person of CREW) {
      const crew = state.people.crew?.[person.id];
      if (!crew || crew.status !== "arrested") continue;
      if (crew.jailedUntilDay != null && state.run.day < crew.jailedUntilDay) continue;
      crew.status = "active";
      crew.jailedUntilDay = null;
      crew.jailedSeverity = null;
      crew.loyalty = Crew.clampLoyalty(Arrest.CREW_LOYALTY_AFTER_SERVED);
      if (state.flags.crewBailPending === person.id) state.flags.crewBailPending = null;
      const name = person.name.split(" ")[0];
      const hash = stringHash(`${state.run.seed}:crew-release:${person.id}:${state.run.day}`);
      logEntry(state, Arrest.pickLine(Arrest.CREW_SERVED_LINES, hash).replace("%s", name), "bad");
      pushConsequence(state, `${name} served the whole stretch. Nobody was at the door. They clocked that.`, "bad");
    }
  }

  // The Character screen read: priors, the last one, and what the next one
  // would cost at the severity the player is most likely to meet it at.
  function arrestRecord(state) {
    const record = state.record || { arrests: 0, lastArrestDay: null, charges: [] };
    const charges = Array.isArray(record.charges) ? record.charges : [];
    return {
      arrests: record.arrests || 0,
      lastArrestDay: record.lastArrestDay,
      charges,
      lastCharge: charges.length ? charges[charges.length - 1] : null,
      multiplier: Arrest.priorMultiplier(record.arrests || 0),
    };
  }
  function crewBailAvailability(state, crewId) {
    const person = CREW_BY_ID[crewId];
    const crew = state.people.crew?.[crewId];
    if (!person || !crew) return { available: false, reason: "No such crew member.", cost: 0 };
    if (crew.status !== "arrested") return { available: false, reason: "Nobody to bail out.", cost: 0 };
    const cost = Arrest.crewBailFor(crew.jailedSeverity);
    if (state.player.cash < cost) return { available: false, reason: `Bail is $${cost}. You are short.`, cost };
    return { available: true, reason: `Free · no time passes`, cost };
  }

  // v1.15: wages come out of cash automatically at day end, dirty money first
  // (criminal income paying criminal workers). Highest loyalty gets paid first,
  // so when the roll runs short the arrears land on whoever trusts the player
  // least. A missed night accrues as wageDue; the first two nights are grace,
  // every night after costs the member a loyalty point. Loyalty 0 means they
  // walk. PAY_CREW remains the way to clear arrears mid-run.
  function settleCrewWages(state) {
    if (!state.crewMeta) state.crewMeta = { totalWagesPaid: 0 };
    const roster = recruitedCrew(state)
      .map((person) => ({ person, crew: state.people.crew[person.id] }))
      .sort((a, b) => b.crew.loyalty - a.crew.loyalty);
    for (const { person, crew } of roster) {
      const wage = Crew.wageFor(person, crew.tier);
      if (spendCash(state, wage)) {
        state.crewMeta.totalWagesPaid += wage;
        state.stats.moneySpent.crew += wage;
        if (crew.wageDue <= 0) crew.wageMissedSince = null;
      } else {
        crew.wageDue += wage;
        if (crew.wageMissedSince == null) crew.wageMissedSince = state.run.day;
        state.flags.crewUnderpaid = true;
        if (state.run.day - crew.wageMissedSince >= Crew.CREW_WAGE_GRACE_DAYS) {
          crew.loyalty = Crew.clampLoyalty(crew.loyalty - 1);
          logEntry(state, `${person.name.split(" ")[0]} didn't say anything about the money again. That's worse.`, "bad");
        } else {
          logEntry(state, `No cash for ${person.name.split(" ")[0]}'s wage tonight. It goes on the ledger.`, "bad");
        }
      }
    }
    for (const { person, crew } of roster) {
      if (crew.loyalty > Crew.CREW_LOYALTY_MIN) continue;
      crew.status = "departed";
      crew.assignment = null;
      if (state.boost.crewAssigned === person.id) state.boost.crewAssigned = null;
      for (const block of Object.values(state.world.territoryBlocks || {})) {
        if (block.managerId === person.id) block.managerId = null;
      }
      logEntry(state, `${person.name.split(" ")[0]}'s number doesn't ring anymore. The people they introduced you to stop texting back.`, "bad");
      pushConsequence(state, `${person.name.split(" ")[0]} is gone. No note, no argument. The unpaid ledger stays behind.`, "bad");
    }
  }
  function applyPressure(state, context, crossedDay) {
    const area = AREA_BY_ID[state.world.currentNeighborhoodId];
    const pressureActive = state.run.phase === "pressure";
    if (context.reason === "TRAVEL") {
      const riskReduction = territoryBenefits(state, area.id)?.riskReduction || 0;
      state.player.heat = clamp(state.player.heat + Math.max(0, area.risk - 1 - riskReduction), 0, 15);
      if (pressureActive && area.rival - Math.floor(state.world.influence[area.id] / 2) > 0) Exposure.recordObservation(state, "curtis", { type: "growth", event: "rival_ground", location: area.id, source: "network" });
    } else if (context.reason === "LAY_LOW") {
      const baseBonus = state.world.currentNeighborhoodId === "north_star_lot" ? state.base.tracks.security : 0;
      const danger = state.base.watched && state.world.currentNeighborhoodId === "north_star_lot" ? 1 : 0;
      state.player.heat = clamp(state.player.heat - Math.max(1, 2 + baseBonus - danger), 0, 15);
      Exposure.recordObservation(state, "curtis", { type: "discretion", event: "quiet_day", source: "network" });
    } else if (pressureActive && area.role === "Outer") {
      Exposure.recordObservation(state, "curtis", { type: "growth", event: "busy_day", source: "network" });
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
      settleCrewWages(state);
      // v1.15: Curtis's people lose interest slowly. A day with no criminal
      // activity extends the quiet streak; from the second consecutive quiet
      // day on, awareness bleeds one point per day - but never below the floor
      // of a phase already reached. Once Curtis notices you, he doesn't fully
      // forget.
      {
        const awareness = curtisAwarenessOf(state);
        if (awareness.lastCriminalDay === state.run.day) {
          awareness.quietStreak = 0;
        } else {
          awareness.quietStreak += 1;
          if (awareness.quietStreak >= 2 && awareness.level > awareness.floor) {
            awareness.level = Math.max(awareness.floor, awareness.level - 1);
            refreshAwarenessPhase(state);
          }
        }
      }
      resolveDeshawnIntro(state);
      if (state.run.day >= state.phone.billDueDay) {
        state.phone.daysPastDue += 1;
        if (state.phone.daysPastDue > 2 && state.phone.active) {
          state.phone.active = false;
          pushConsequence(state, "The signal bars vanish. Calls and texts stop leaving.", "bad");
        }
      }
      const rentDue = state.obligations.rentDueDay;
      const currentRentDue = state.run.day >= rentDue ? rentDue + Math.floor((state.run.day - rentDue) / 7) * 7 : rentDue;
      // v1.15: while Deshawn is on the crew the grace re-arms once per rent
      // period - he will talk to Yalonda every week, but only once a week. If
      // he departs, whatever grace is banked is the last one.
      //
      // v1.32: the re-arm stays; what the grace DOES changed. It used to stamp
      // `lastMissedDueDay` and cancel the whole period's miss, so one grace a
      // week against one rent a week meant rent was never missed at all. Inside
      // a run that ended at day 10 that was a bounded perk - Deshawn ate at most
      // one miss. v1.31 removed the day cap and the boundary went with it: a
      // measurement across 15 strategies found eviction, the game's primary lose
      // condition, was unreachable in 100% of runs where Deshawn was active and
      // reachable in 13-63% of runs where he was not. The mechanic never
      // changed; the run length did.
      //
      // Now it defers by a day instead of cancelling a week, which is what the
      // log line under it has always said. The miss lands tomorrow unless the
      // rent is found today, and Deshawn is worth exactly the day he buys.
      {
        const deshawnCrew = state.people.crew.deshawn;
        if (deshawnCrew?.recruited && deshawnCrew.status === "active" && !state.flags.extraRentGraceAvailable
          && state.flags.extraRentGraceUsedDueDay != null && state.flags.extraRentGraceUsedDueDay !== currentRentDue) {
          state.flags.extraRentGraceAvailable = true;
        }
      }
      const missedThisDue = state.obligations.lastMissedDueDay === currentRentDue;
      if (state.run.day >= rentDue && !missedThisDue) {
        if (state.flags.extraRentGraceAvailable) {
          state.flags.extraRentGraceAvailable = false;
          state.flags.extraRentGraceUsedDueDay = currentRentDue;
          // Deliberately does NOT stamp `lastMissedDueDay`. That is the whole
          // deferral: the check re-fires tomorrow night, the grace is spent by
          // then, and the miss lands one day late. Paying in the meantime rolls
          // `rentDueDay` past today and the check goes quiet, which is the day
          // Deshawn actually bought. No new field - the deferral is derived from
          // the absence of the stamp, so the save schema does not move.
          state.obligations.lastMissedDueDay = null;
          logEntry(state, "Deshawn talks to Yalonda before the envelope comes out. The rent conversation waits one more day.", "good");
        } else {
          state.obligations.lastMissedDueDay = currentRentDue;
          state.npc.yalonda.rentMissed += 1;
          Exposure.recordObservation(state, "yalonda", { type: "financial", event: "missed_obligation", source: "household" });
          logEntry(state, "Yalonda leaves the rent envelope on the kitchen table, still empty.", "bad");
          if (state.npc.yalonda.rentMissed >= 2) householdWarning(state, 1, "Two rent weeks pass unpaid. Yalonda makes the house warning explicit.", false);
        }
      }
      state.player.financialHeat = clamp(state.player.financialHeat - FINANCIAL_HEAT_DECAY_PER_DAY, 0, 10);
      if (state.player.financialHeat >= FINANCIAL_HEAT_FOLD_IN_THRESHOLD) {
        state.player.heat = clamp(state.player.heat + 1, 0, 15);
      }
      // v1.13: a quiet day on a plug's block works suspicion down one point —
      // the no-robbery rebuild path, and the only road back from a cutoff.
      for (const plug of PLUGS) {
        const suspicionRecord = state.plugs?.records?.[plug.id];
        if (!suspicionRecord || !(suspicionRecord.suspicion > 0)) continue;
        const plugHome = Districts.PLUG_HOME_DISTRICTS[plug.id];
        const robbedThereToday = state.stick?.lastRobberyDay === state.run.day && state.stick?.lastRobberyDistrict === plugHome;
        if (!robbedThereToday) suspicionRecord.suspicion = Math.max(0, suspicionRecord.suspicion - 1);
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
      const feeCeiling = Math.round((state.lender.principal || 0) * LOAN_MAX_BALANCE_MULTIPLIER);
      if (state.lender.lastPenaltyDay !== state.run.day && state.lender.balance < feeCeiling) {
        const raw = Math.round(Math.max(25, Math.round(state.lender.balance * 0.08)) * tierEntry.feeMultiplier * state.lender.interestMultiplier);
        // The last fee lands on the ceiling rather than through it, so the
        // number the player is quoted is one they could actually work toward.
        const fee = Math.min(raw, feeCeiling - state.lender.balance);
        state.lender.balance += fee;
        state.lender.feesAdded += fee;
        state.lender.penaltyHistory.push({ day: state.run.day, slot: state.run.slot, amount: fee });
        Exposure.recordObservation(state, "dre", { type: "financial", event: "missed_obligation", source: "witnessed" });
        state.lender.lastPenaltyDay = state.run.day;
        state.player.heat = clamp(state.player.heat + 1, 0, 15);
        logEntry(state, `Dre leaves the new total under the Mini-Mart wiper: $${state.lender.balance}. No greeting.`, "bad");
      }
    }
    // v1.31: this reads the note now, not the run. The old comment here
    // explained a workaround - fresh-arrival runs set dueDay to the run length,
    // so `day > dueDay` could never come true inside a seven-day run and the
    // deadline produced no consequence, so the checkpoint stood in for it. With
    // the run open-ended and the loan on a real seven-day term from the day it
    // is taken, the due day arrives on its own and the workaround is gone.
    if (pressureActive && crossedDay && state.lender.status === "active" && state.lender.balance > 0 && state.run.day >= state.lender.dueDay && state.lender.collectorTier < 1) {
      const owedRatio = state.lender.principal > 0 ? state.lender.balance / state.lender.principal : 1;
      state.lender.collectorTier = owedRatio >= 0.9 ? 2 : 1;
      logEntry(state, "Dre's patience runs out with the note still open. Somebody is coming to collect in person.", "bad");
    }
    state.npc.curtis.pressure = state.npc.curtis.attention;
    state.lender.relationship = relationshipForLender(state);
    state.npc.curtis.relationship = relationshipForRival(state);
    state.npc.mina.status = minaStatus(state);
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

  // `flavor` is the optional expanded layer. Events with one fixed description
  // read it from EVENT_FLAVOR; events that branch their description pass the
  // matching variant here so the two layers stay in step.
  function setPendingEvent(state, item) { state.run.pendingEvent = item; }

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
    // What they expect from you, read off the identity the block has derived.
    const identity = Attributes.identityProfile(state);
    const preview = identity.dominant === "combat" ? "They arrived expecting you to make this physical."
      : identity.dominant === "charisma" ? "They keep looking past you for whoever might answer your call."
      : identity.dominant === "intelligence" ? "They chose the hour they think costs you most."
      : "They prepared for two different versions of you and may have guessed wrong.";
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
  const rivalAttentionEarned = (state) => curtisNoticed(state);

  const STORY_REGISTRY = [
    // --- The Night Owl -------------------------------------------------------
    { id: "mina_intro", chain: "mina_spenard", stage: 1, classification: "character_intro", trigger: "chain",
      requires: (s) => !!s.flags.nightOwlVisited && !s.npc.mina.met, area: "north_star_lot", earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "mina_shift_change", chain: "mina_spenard", stage: 2, classification: "character_followup", trigger: "chain",
      requires: (s) => !!s.flags.minaIntroResolved && minaOpen(s), area: "north_star_lot",
      earliest: { day: 2, slot: 1 }, latest: { day: 6 }, once: true, cooldown: 0, weight: 8, exit: (s) => !minaOpen(s) },
    { id: "mina_invitation", chain: "mina_spenard", stage: 3, classification: "relationship_scene", trigger: "chain",
      requires: (s) => !!s.flags.minaShiftChangeResolved && minaOpen(s) && atLeastBand(s, "mina", BANDS.TRUSTED)
        && !s.flags.minaDateNight && !s.flags.minaSawGarage && !s.flags.minaInvitationClosed,
      area: "north_star_lot", earliest: { day: 3, slot: 1 }, latest: { day: 6 }, once: false, cooldown: 4, weight: 6, exit: (s) => !minaOpen(s) },
    { id: "mina_boundary", chain: "mina_spenard", stage: 4, classification: "main_chapter", trigger: "chain",
      requires: (s) => !!s.flags.minaShiftChangeResolved && minaOpen(s) && atLeastBand(s, "mina", BANDS.WARM), area: "north_star_lot",
      earliest: { day: 4, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 8, exit: (s) => !minaOpen(s) },
    { id: "mina_sedan_night", chain: "mina_spenard", stage: 5, classification: "threat", trigger: "chain",
      requires: (s) => minaOpen(s) && curtisHostile(s) && s.hustle.soldUnits >= 50 && atLeastBand(s, "mina", BANDS.TRUSTED), area: "north_star_lot",
      earliest: { day: 5, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 8, exit: (s) => !minaOpen(s) },
    { id: "mina_after", chain: "mina_spenard", stage: 6, classification: "callback", trigger: "chain",
      requires: (s) => !!s.flags.minaBoundaryResolved && (!!s.flags.minaSedanNightResolved || s.run.day >= lateRunDay(s)), area: "north_star_lot",
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
      requires: (s) => s.lender.status === "active" && !!s.flags.dreTermsResolved && s.run.day >= s.lender.dueDay, area: null,
      earliest: { day: 1, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },

    // --- Curtis's Attention ----------------------------------------------------
    { id: "curtis_mark", chain: "curtis_pressure", stage: 1, classification: "threat", trigger: "chain",
      requires: (s) => rivalAttentionEarned(s), area: null, earliest: { day: 2, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "early_street", chain: "curtis_pressure", stage: 2, classification: "threat", trigger: "chain", kind: "encounter",
      requires: (s) => !!s.flags.curtisMarkResolved, area: null, earliest: { day: 2, slot: 1 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
    { id: "curtis_tax", chain: "curtis_pressure", stage: 3, classification: "main_chapter", trigger: "chain",
      requires: (s) => curtisHostile(s), area: null,
      earliest: { day: 3, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    // Respect is now the sole numeric driver of this stage — the migration
    // from the old pressure-OR-area.rival gate is complete. Legacy saves that
    // already resolved this beat under the old gate are migrated in
    // hydrateRun (respect is raised to this threshold), so they are not
    // re-locked out of content they already earned.
    { id: "curtis_cut", chain: "curtis_pressure", stage: 4, classification: "callback", trigger: "chain",
      requires: (s) => !!s.flags.curtisTaxResolved && atLeastBand(s, "curtis", BANDS.WARM),
      area: null, earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 6, exit: null },
    { id: "mid", chain: "curtis_pressure", stage: 5, classification: "threat", trigger: "chain", kind: "encounter",
      requires: (s) => !!s.flags.curtisTaxResolved, area: null,
      earliest: { day: 4, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "curtis_day7", chain: "curtis_pressure", stage: 6, classification: "ending_setup", trigger: "chain",
      requires: (s) => !!s.flags.earlyThreatResolved && s.run.day >= lateRunDay(s), area: null,
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
      requires: (s) => s.phone.active && knowsYou(s, "juan") && !s.jobs.hired.some((id) => id !== "day_labor"), area: HOME_DISTRICT_ID, earliest: { day: 2, slot: 2 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },
    { id: "yalonda_flirt", chain: "household", stage: 3, classification: "relationship_scene", trigger: "chain",
      requires: (s) => atLeastBand(s, "yalonda", BANDS.BONDED) && s.npc.yalonda.rentPaidWeeks >= 1 && s.player.heat <= 1
        && s.people.household.lastContrabandDay !== s.run.day && householdPresence(s) === "yalonda",
      area: HOME_DISTRICT_ID, earliest: { day: 7, slot: 0 }, latest: null, once: true, cooldown: 0, weight: 8, exit: null },

    // Social discovery routes. The link stays invisible until one of these lands.
    { id: "discover_907_juan", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
      requires: (s) => !s.knowledge.knows907List && s.phone.active && knowsYou(s, "juan") && s.run.slot >= 2, area: HOME_DISTRICT_ID, earliest: { day: 1, slot: 2 }, latest: null, once: true, cooldown: 0, weight: 9, exit: null },
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
    // v1.19: Pherris's recruitment scene, the market-domain twin of tone_recruit.
    // No area: she is the one person on this roster who moves between districts,
    // so she turns up wherever the player is working. Reactive, because the whole
    // characterization is that she already knew before you told her. Declining
    // sets pherrisNextOfferDay and the cooldown paces the re-offer at three days.
    // The Week Zero clause is explicit for the same reason Tone's is:
    // character_intro is not a suppressed classification.
    { id: "pherris_recruit", chain: null, stage: null, classification: "character_intro", trigger: "reactive",
      requires: (s) => s.run.phase !== "week_zero"
        && pherrisRecruitmentAvailability(s).available
        && (!s.flags.pherrisNextOfferDay || s.run.day >= s.flags.pherrisNextOfferDay),
      area: null, earliest: { day: 4, slot: 0 }, latest: null, once: false, cooldown: 3, weight: 8, exit: null },
    // v1.15: Deshawn's recruitment scene. Fires at the Night Owl once his gate
    // holds; declining sets deshawnNextOfferDay, and the cooldown plus that
    // flag pace the re-offer at three days.
    { id: "deshawn_offer", chain: null, stage: null, classification: "character_intro", trigger: "ambient",
      requires: (s) => deshawnRecruitmentAvailability(s).available && !s.people.crew.deshawn.recruited
        && recruitedCrew(s).length < crewCapacityFor(s)
        && (!s.flags.deshawnNextOfferDay || s.run.day >= s.flags.deshawnNextOfferDay),
      area: "north_star_lot", earliest: { day: 5, slot: 0 }, latest: null, once: false, cooldown: 3, weight: 7, exit: null },
    // v1.18: Tone's recruitment scene, gated on proof rather than on owning the
    // garage. His ledger has to read Warm through a lens that only counts nerve,
    // and it has to read it by enough of a margin that one fight is not the whole
    // argument. Reactive: the moment it holds he is already standing there, which
    // is the characterization. Declining sets toneNextOfferDay and paces the
    // re-offer at three days, the same shape as Deshawn's. The Week Zero clause
    // is explicit because character_intro is not a suppressed classification and
    // this beat should never open the tutorial stretch.
    { id: "tone_recruit", chain: null, stage: null, classification: "character_intro", trigger: "reactive",
      requires: (s) => s.run.phase !== "week_zero"
        && toneRecruitmentAvailability(s).available
        && (!s.flags.toneNextOfferDay || s.run.day >= s.flags.toneNextOfferDay),
      area: "north_star_lot", earliest: { day: 4, slot: 0 }, latest: null, once: false, cooldown: 3, weight: 8, exit: null },
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
      requires: (s) => atLeastBand(s, "curtis", BANDS.WARM) && controlledBlockCount(s) > 0, area: null,
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
      requires: (s) => curtisNoticed(s), area: null, earliest: { day: 2, slot: 0 }, latest: null, once: false, cooldown: 8, weight: 5, exit: null },
    { id: "midtown_lights", chain: null, stage: null, classification: "threat", trigger: "ambient",
      requires: () => true, area: null, earliest: { day: 1, slot: 2 }, latest: null, once: false, cooldown: 8, weight: 4, exit: null },
  ];
  const STORY_BY_ID = Object.fromEntries(STORY_REGISTRY.map((item) => [item.id, item]));

  function storyCandidates(state) {
    const absolute = slotNumber(state.run.day, state.run.slot);
    return STORY_REGISTRY.filter((item) => isEligible(item, state, { absolute, resolved: eventResolved }));
  }
  function weightedPick(candidates, state, random) {
    const weights = candidates.map((item) => getWeight(item, state, streetReadWeightMultiplier));
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

  // The band readers. Every content gate in the game goes through one of these.
  //
  // Mapping from the old per-character thresholds: a relationship the old code
  // called trust 1 is Warm, trust 2 is Trusted, trust 3 is Bonded. Curtis and
  // Simone run on the inverted THREAT lens, so they read downward instead and
  // get their own named helpers rather than a confusing >= against a rival.
  const dispositionOf = (state, npcId) => Exposure.getDisposition(npcId, state);
  const bandOf = (state, npcId) => Exposure.getDispositionBand(npcId, state);
  const atLeastBand = (state, npcId, band) => bandOf(state, npcId) >= band;
  const atMostBand = (state, npcId, band) => bandOf(state, npcId) <= band;
  // "Any positive history at all", which is what the old trust >= 1 checks that
  // were about acquaintance rather than closeness actually meant.
  const knowsYou = (state, npcId) => dispositionOf(state, npcId) > 0;

  // Curtis reads backwards. Neutral is invisible, Cold is watched, Hostile is
  // the tax and the confrontation.
  const curtisNoticed = (state) => atMostBand(state, "curtis", BANDS.COLD);
  const curtisHostile = (state) => atMostBand(state, "curtis", BANDS.HOSTILE);
  // How far past the Hostile floor he is, for the beats that used to key off
  // deeper attention than the tax did.
  const curtisPressureScore = (state) => -dispositionOf(state, "curtis");

  // How a legacy relationship delta reads as an observation.
  //
  // A card that said "minaTrust: +2" was never really saying "add two"; it was
  // saying "she saw you do something worth two". The sign picks the category and
  // the magnitude becomes the count, so the diminishing-returns rule applies to
  // repeats the way it does to everything else.
  //
  // rivalPressure is exposure, which the THREAT lens reads as growth and scores
  // downward. rivalRespect is the player conceding standing to Curtis, which
  // reads as submission and scores upward. That inversion is deliberate: for a
  // rival, a high score means you are not a problem.
  const EFFECT_OBSERVATIONS = {
    minaTrust: { npcId: "mina", up: "loyalty", down: "loyalty" },
    lenderTrust: { npcId: "dre", up: "loyalty", down: "loyalty" },
    rivalRespect: { npcId: "curtis", up: "submission", down: "defiance", downEvent: "pushed_back" },
    rivalPressure: { npcId: "curtis", up: "growth", down: "discretion", downEvent: "dropped_profile" },
  };

  // A positive delta keeps the card id, so repeats of the same scene diminish
  // against themselves. A negative one collapses to a single named letdown row
  // priced by SHARED_EVENT_WEIGHTS, because category sign cannot be trusted
  // downward: Dre's lens reads defiance as a credit.
  const LETDOWN_EVENT = "let_them_down";

  function recordRelationshipDelta(state, npcId, delta, sourceId, mapping) {
    const amount = Math.round(Number(delta) || 0);
    if (!amount || !state.npc[npcId]) return;
    // rivalPressure runs backwards: a negative delta was the player lowering
    // their profile, which is a discretion credit, not a defiance debit.
    const type = amount > 0 ? mapping.up : mapping.down;
    const event = amount > 0 ? (sourceId || "story_choice") : (mapping.downEvent || LETDOWN_EVENT);
    Exposure.recordObservation(state, npcId, { type, event, count: Math.abs(amount), source: "witnessed" });
  }

  function applyRelationshipEffects(state, effect, context) {
    const sourceId = (context && context.eventId) || "story_choice";
    for (const [key, mapping] of Object.entries(EFFECT_OBSERVATIONS)) {
      if (!effect[key]) continue;
      recordRelationshipDelta(state, mapping.npcId, effect[key], sourceId, mapping);
    }
    if (effect.npcTrust && state.npc[effect.npcTrust.id]) {
      recordRelationshipDelta(state, effect.npcTrust.id, effect.npcTrust.delta, sourceId, { up: "loyalty", down: "defiance" });
    }
  }

  function applyEventEffect(state, effect, random, context) {
    const cashBefore = state.player.cash;
    state.player.cash = Math.max(0, state.player.cash + (effect.cash || 0));
    state.player.health = clamp(state.player.health + (effect.health || 0), 0, 100);
    state.player.heat = clamp(state.player.heat + (effect.heat || 0), 0, 15);
    // Sixty relationship effects are declared across the event cards. Rather
    // than rewrite all sixty into observation syntax and risk sixty separate
    // mistakes, the declarations stay as they are and are translated here.
    // This is the one write seam the old integer model had, so it is the one
    // place the new model needs to intercept.
    applyRelationshipEffects(state, effect, context);
    if (effect.curtisDecision) applyCurtisDecision(state, effect.curtisDecision);
    if (effect.acceptDreLoan && state.lender.status === "unoffered") {
      state.lender.status = "active";
      state.lender.principal = 1000;
      state.lender.balance = 1200;
      state.lender.dueDay = state.run.day + LOAN_TERM_DAYS;
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
      if (!state.world.locations.discoveries.includes("informal_game")) state.world.locations.discoveries.push("informal_game");
      // A vouch opens both floors at once: whoever handed over the address knew
      // the building, and the ground floor is how you get to the stairwell.
      grantDenAccess(state, Nile.DEN_ACCESS_METHODS.regular);
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
    // v1.15: scene-driven recruitment. Unlike the garage RECRUIT_CREW action
    // there is no cash cost - the wage is the ask - but capacity and the NPC's
    // own gate still hold.
    if (effect.recruitCrew && state.people.crew[effect.recruitCrew]) {
      const crewId = effect.recruitCrew;
      const person = CREW_BY_ID[crewId], crew = state.people.crew[crewId];
      // v1.18: a scene may charge the sticker price. Deshawn's does not, because
      // the wage is his whole ask, so the cost is opt-in per card rather than a
      // property of the token.
      const cost = effect.recruitCrewPaid ? recruitmentCost(state, crewId) : 0;
      const eligible = !crew.recruited && recruitedCrew(state).length < crewCapacityFor(state)
        && state.player.cash >= cost
        && crewRecruitmentEligible(state, crewId)
        && (crewId !== "deshawn" || deshawnRecruitmentAvailability(state).available);
      if (eligible) {
        if (cost) { spendCash(state, cost); state.stats.moneySpent.crew += cost; }
        crew.introduced = true; crew.recruited = true; crew.status = "active";
        crew.contactStage = "active"; crew.tier = Math.max(1, crew.tier || 0);
        crew.recruitedDay = state.run.day;
        crew.loyalty = Crew.clampLoyalty(crew.loyalty + 1);
        if (crewId === "tone") {
          // He starts at the neutral mark, not a point above it. Nobody who made
          // you prove it first is grateful on day one.
          crew.loyalty = Crew.CREW_LOYALTY_START;
          state.npc.tone.met = true;
          pushPhoneMessage(state, "Tone", "Key's on my belt. Call before you go somewhere you'd rather not go by yourself.");
          // Neighborhood, not network. The block sees him at your door; Curtis
          // finding out is its own event, and routing this through the network
          // would hand him a free point of attention for hiring a guard.
          broadcastTracked(state, {
            type: "growth", event: "crew_recruited", channel: "neighborhood",
            location: "north_star_lot", day: state.run.day, slot: state.run.slot,
          });
        }
        if (crewId === "pherris") {
          // Same reading as Tone. She made the player prove it first, so she
          // starts level rather than grateful.
          crew.loyalty = Crew.CREW_LOYALTY_START;
          state.npc.pherris.met = true;
          pushPhoneMessage(state, "Pherris", "Sending you three names tonight. Two of them buy. Don't call the third one before I do.");
          // Neighborhood, same as Tone: the block sees who is working with whom.
          // Her own channel is the network, but broadcasting a hire onto it would
          // hand Curtis a free point of attention for making a phone call.
          broadcastTracked(state, {
            type: "growth", event: "crew_recruited", channel: "neighborhood",
            location: state.world.currentNeighborhoodId, day: state.run.day, slot: state.run.slot,
          });
        }
        if (crewId === "deshawn") {
          state.flags.extraRentGraceAvailable = true;
          // He came around because the player robbed Goodie and then paid the
          // cost of making it right. That path stays on the record.
          if ((state.people.dealers.goodie?.robbedCount || 0) > 0) state.flags.deshawnRedemptionPath = true;
        }
        updateBoostTier(state);
        recordBehavior(state, "connector", 3, `recruit:${crewId}`, "recruit");
        addStreetReadEntry(state, "social", `${crewId}:recruitment`);
        logEntry(state, `${person.name} is on the crew. The operation has another person to answer for.`, "good");
      }
    }
    if (effect.deshawnDeescalate) applyDeshawnDeescalation(state);
    if (effect.deshawnViolentChoice) noteViolentChoice(state, true);
    // Declining Deshawn's offer is not a refusal, it's a rain check - he asks
    // again in three days as long as the gate still holds.
    if (effect.deshawnDeclineOffer) {
      state.flags.deshawnOfferDeclined = true;
      state.flags.deshawnNextOfferDay = state.run.day + 3;
    }
    // v1.18: declining Tone is a rain check too. Three days, and the number does
    // not move - he does not negotiate himself down to stay wanted.
    if (effect.toneDeclineOffer) {
      state.npc.tone.offersDeclined += 1;
      state.flags.toneOfferDeclined = true;
      state.flags.toneNextOfferDay = state.run.day + 3;
    }
    // v1.19: Pherris the same. She has other people to call in the meantime and
    // says so, which is why the number does not move either.
    if (effect.pherrisDeclineOffer) {
      state.npc.pherris.offersDeclined += 1;
      state.flags.pherrisOfferDeclined = true;
      state.flags.pherrisNextOfferDay = state.run.day + 3;
    }
    if (effect.addRumor) state.effects.rumors.push({ id: `contact_${state.run.day}_${state.run.slot}_${effect.addRumor.areaId}`, ...effect.addRumor, reliable: true, expiresAt: slotNumber(state.run.day, state.run.slot) + 3 });
    if (effect.crewLoyalty && state.people.crew[effect.crewLoyalty.id]) { const record = state.people.crew[effect.crewLoyalty.id]; record.loyalty = Crew.clampLoyalty(record.loyalty + effect.crewLoyalty.delta); }
    if (effect.crewAllLoyalty) for (const person of recruitedCrew(state)) { const record = state.people.crew[person.id]; record.loyalty = Crew.clampLoyalty(record.loyalty + effect.crewAllLoyalty); }
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
      state.lender.dueDay = state.run.day + 5;
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
    state.lender.relationship = relationshipForLender(state);
    state.npc.curtis.relationship = relationshipForRival(state);
    state.npc.mina.status = minaStatus(state);
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
    const minaIntact = atLeastBand(state, "mina", BANDS.BONDED) && !state.npc.mina.usedWithoutConsent && state.npc.mina.available !== false && !state.flags.seriousViolence;
    if (plan === "escape" && minaIntact) return "mina_escape";
    if (plan === "escape") return "clean_exit";
    if (state.npc.mina.available === false && state.npc.mina.chainStage >= 6) return "mina_gone";
    if (minaIntact && !state.npc.mina.cleanLifeAtRisk && state.npc.mina.chainStage >= 6) return "mina_clear";
    if (plan === "partner" && atLeastBand(state, "curtis", BANDS.WARM)) return "curtis_partner";
    if (plan === "challenge" && Object.values(state.world.influence).reduce((a, b) => a + b, 0) >= 5) return "takeover";
    if (state.flags.acceptedSecondNote && state.lender.balance <= 0) return "dre_expansion";
    if (plan === "defend" && recruitedCrew(state).some((person) => state.people.crew[person.id].loyalty >= 6)) return "crew_saved";
    if (plan === "last_score" && operationScore(state) >= 1300 && state.lender.balance <= 0) return "one_good_run";
    if (state.lender.balance > 0) return "still_owing";
    if (operationScore(state) >= 800) return "quiet_operation";
    return "clean_exit";
  }
  // v1.29: what ended the run, in the player's words.
  //
  // The run has always had an ending id and a label. What it never had was the
  // obligation that caused it, so a loss read as the game closing rather than
  // as a consequence. `nowhere_to_go` covered rent, contraband, and danger
  // brought home without distinguishing them, and the end screen opened with a
  // checkpoint sentence whether you reached the checkpoint or were evicted.
  //
  // `cause` is the line householdWarning was already writing for the feed;
  // every other terminal derives one from its ending id. Stored on `run`, which
  // is rebuilt by NEW_RUN, so no schema bump and no migration - an older save
  // has no endCause and falls back to the label.
  const END_CAUSES = {
    nowhere_to_go: { title: "Nowhere to Go", line: "The room is closed. Yalonda is done waiting, and there is nobody left to call." },
    arrested: { title: "Caught", line: "The Heat finally had somewhere to land. They had your name before you got to the corner." },
    killed: { title: "Taken Down", line: "You ran out of health on a night that had no give in it." },
    base_lost: { title: "The Garage Is Gone", line: "North Star took too much damage to hold. Everything staged there went with it." },
  };
  function endRun(state, forced, cause) {
    state.run.status = "ended";
    state.run.pendingEvent = null;
    state.run.pendingEncounter = null;
    state.run.pendingOperationResult = null;
    state.run.ending = chooseEnding(state, forced);
    const fallback = END_CAUSES[state.run.ending];
    const line = cause || (fallback && fallback.line) || null;
    const title = (fallback && fallback.title) || endingLabel(state.run.ending);
    if (line) {
      state.run.endCause = { id: state.run.ending, title, line };
      pushConsequence(state, line, "bad", title);
    }
    logEntry(state, `By sunrise, the week has a name: ${endingLabel(state.run.ending)}.`, state.run.ending === "one_good_run" ? "good" : "warn");
  }

  function householdWarning(state, count, reason, catastrophic) {
    const household = state.people.household;
    household.warnings += Math.max(1, count || 1);
    Exposure.recordObservation(state, "yalonda", { type: "financial", event: "missed_obligation", count: Math.max(1, count || 1), source: "household" });
    logEntry(state, reason, "bad");
    if (catastrophic || household.warnings >= 3) {
      household.evicted = true;
      // `reason` is the specific obligation that broke - the missed rent, the
      // contraband, the danger brought home. It is what the player needs named.
      endRun(state, "nowhere_to_go", reason);
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
    // Same funnel, same reason: what the block saw you doing this slot. Sent
    // before the clock moves so the observation carries the day and part of day
    // it actually happened in, which is what the presence checks read.
    const observed = OBSERVED_ACTIONS[context.reason];
    if (observed) {
      broadcastTracked(state, {
        ...observed,
        // The district is the right default - most actions are just "somewhere
        // in Spenard". A row that names its own location keeps it, which is how
        // a Nile visit reaches Selam's location lens as `the_nile` rather than
        // being flattened into the neighborhood it sits in.
        location: observed.location || state.world.currentNeighborhoodId,
        value: Math.abs(Number(context.cashDelta) || 0),
        day: oldDay,
        slot: oldSlot,
      });
    }
    closeVisit(state, context.reason);
    recordDailyAction(state, context);
    const timeCost = clamp(Math.floor(Number(context.timeCost) || 1), 1, SLOTS.length);
    const reachesDayEnd = oldSlot + timeCost >= SLOTS.length;
    state.run.slot = reachesDayEnd ? SLOTS.length - 1 : oldSlot + timeCost;
    restorePhoneIfReady(state, slotNumber(oldDay, oldSlot));
    resolveJobApplications(state);
    resolveMarketSells(state);
    resolveBuyerRequests(state);
    noticeMarketInventory(state);
    drainObservations(state);
    expireEffects(state);
    resolveCrewAssignments(state, random);
    resolveSoldierOperations(state, random, false);
    applyPressure(state, context, false);
    maybeWatcherEncounter(state, context, oldDay, oldSlot);
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
      const chosenRisk = ["ROB", "ROB_DEALER", "TAKEOVER", "NILE_TONK_SIT", "NILE_CELO_SIT", "SHOPLIFT", "BOOST"].includes(context.reason);
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
    if (!curtis.betrayed && friendshipMature && curtisPressureScore(state) >= 8 && state.run.day > curtis.protectionUntilDay) {
      const deshawn = state.people.crew.deshawn;
      if (deshawn?.recruited && deshawn.status !== "departed" && deshawn.tier >= 3 && deshawn.loyalty >= 8) {
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
      const probability = clamp(borrower.risk + (loan.amount >= 500 ? 0.18 : loan.amount >= 250 ? 0.08 : 0) + (loan.term === 2 ? 0.12 : loan.term === 4 ? 0.04 : -0.04) - intelligenceCompat(state) * 0.025 - (atLeastBand(state, "dre", BANDS.BONDED) ? 0.08 : 0), 0.03, 0.82);
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
    // A day that ends without a gym visit ends the streak. Checked here rather
    // than on the next visit so the bonus cannot survive a rest day. The Nile
    // works the same way, and drops the attribute it was pointed at with it.
    if (state.player.gymStreakDay !== oldDay) { state.player.gymStreak = 0; state.player.gymStreakDay = null; }
    if (state.player.nileStreakDay !== oldDay) {
      state.player.nileStreak = 0;
      state.player.nileStreakDay = null;
      state.player.nileStreakAttribute = null;
    }
    // Three games a day, and tomorrow is a new day.
    state.gambling.dailyGamesPlayed = 0;
    state.gambling.dailyGamesDay = null;
    recalculateStreetRead(state);
    checkHomeContraband(state, random);
    resolveSoldierOperations(state, random, true);
    applyPressure(state, { reason: "END_DAY" }, true);
    settleCurtisNight(state);
    resolveSharkLoans(state);
    resolveCrewTracks(state);
    // v1.29: the day that just ended is the one attendance is judged on. It is
    // passed explicitly rather than read off state so the rung does not depend
    // on sitting above the `run.day = oldDay + 1` line further down.
    applyAttendance(state, oldDay);
    // v1.23: tomorrow night's warnings. Raised here because this is the first
    // point where every input is final - the night just resolved so ownership is
    // settled, settleCurtisNight moved the awareness phase, and resolveCrewTracks
    // decided whether Deshawn is still on the payroll. Before the drain below, so
    // his tier-3 "evening before" arrival lands tonight rather than waiting a
    // whole day for the next pass.
    //
    // v1.28: the bank is settled BEFORE the warnings, and the order is the whole
    // correctness argument. A warning raised tonight has to name the same plan
    // the player re-derives tomorrow, so nothing that feeds the plan may move
    // between the two. Writing the carry first means the warning already
    // reflects it and tomorrow's board reproduces it exactly; writing it after
    // would telegraph one plan and resolve a different one, which is precisely
    // the v1.23 bug the plan exists to prevent.
    settleCurtisPressureBank(state);
    emitCurtisGossipWarnings(state);
    // Heat is public past a point, so it spreads on its own with no card
    // tagging it. This is the connection the v1.8.1 audit filed as absent:
    // heat now reaches the people around the player instead of only the police
    // roll. Raised before the queue drains so a hot night lands the same night.
    Exposure.propagateHeat(state);
    drainObservations(state);
    evolveMarkets(state, random);
    // v1.31: the run does not end because a number went up. This is where a
    // day count used to terminate it - phase "pressure" plus oldDay past the
    // checkpoint called endRun outright, with no obligation, health or Heat
    // check anywhere in the condition. That contradicted the standing design
    // correction every build prompt has carried since v1.24: THE GAME HAS NO
    // FIXED RUN LENGTH. A run now ends three ways and three only - an
    // obligation you cannot pay (rent, the phone, Dre's note), health at zero,
    // or Heat at the terminal 15 - plus the one the player chooses, which is
    // EXECUTE_FINAL_PLAN and is no longer locked to a particular day either.
    state.run.day = oldDay + 1;
    state.run.slot = 0;
    state.player.energy = MAX_ENERGY;
    restorePhoneIfReady(state, slotNumber(oldDay, 3));
    // v1.16: anyone whose date came up walks out. Run after the clock rolls so
    // a member released this morning is not paid for the night they were in.
    releaseServedCrew(state);
    resolveJobApplications(state);
    // Drained again after the clock rolls: the network and neighborhood channels
    // deliver at Morning of a later day, and a player who takes no action that
    // morning should still have the news land on the right day.
    drainObservations(state);
    // v1.13: yesterday's word lands in the neighboring districts, the stick
    // ledger rolls over, and anyone owed a visit gets their morning.
    resolveBleedArrivals(state);
    if (state.stick) {
      state.stick.dailyCount = 0;
      if (state.stick.lastRobberyDay != null && state.run.day - state.stick.lastRobberyDay > 2) state.stick.heatStreak = 0;
    }
    resolveStickRetaliation(state, random);
    state.nineZeroSevenList.known = !!state.knowledge.knows907List;
    state.run.dailyActions = [];
    if (state.player.health <= 0 || state.player.heat >= 15) endRun(state);
    else scheduleStory(state, { reason: "END_DAY" }, random);
    state.run.rngState = random.state;
    return state;
  }

  // --- Deshawn tier-1 de-escalation (v1.15) --------------------------------
  // Shared by the legacy encounter engine, the consequence engine, and the
  // stick retaliation card. Resolves a confrontation without violence: no
  // health loss, one point of heat worked off quietly, a discretion row for
  // the neighbors (discretion never clears Curtis's network filter, so this
  // stays local), and Deshawn remembers being trusted with it.
  function applyDeshawnDeescalation(state) {
    const crew = state.people.crew.deshawn;
    if (!crew?.recruited || crew.status === "departed") return;
    crew.loyalty = Crew.clampLoyalty(crew.loyalty + Crew.DESHAWN_LOYALTY_TRIGGERS.deescalateUsed);
    state.npc.deshawn.lastDeescalationDay = state.run.day;
    state.player.heat = clamp(state.player.heat - 1, 0, 15);
    // He was standing there for it - his row is first-hand, not gossip. The
    // neighborhood hears its own version on the usual delay.
    Exposure.recordObservation(state, "deshawn", { type: "discretion", event: "deshawn_deescalation", source: "witnessed" });
    broadcastTracked(state, { type: "discretion", event: "deshawn_deescalation", channel: "neighborhood", day: state.run.day });
  }
  // Choosing violence right after (or instead of) his diplomacy costs a point
  // of loyalty - once per de-escalation, so a single loud choice is a lesson
  // rather than a spiral.
  function noteViolentChoice(state, deescalateWasAvailable) {
    const crew = state.people.crew.deshawn;
    if (!crew?.recruited || crew.status === "departed") return;
    const record = state.npc.deshawn;
    const withinWindow = record.lastDeescalationDay != null && state.run.day - record.lastDeescalationDay <= Crew.DESHAWN_VIOLENCE_WINDOW_DAYS;
    if (!deescalateWasAvailable && !withinWindow) return;
    crew.loyalty = Crew.clampLoyalty(crew.loyalty + Crew.DESHAWN_LOYALTY_TRIGGERS.violenceAfterDeescalate);
    if (withinWindow) record.lastDeescalationDay = null;
    logEntry(state, "Deshawn watches you choose the loud way. He does not say anything, which says it.", "warn");
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
    if (weapon?.type === "close" || combatCompat(state) >= 3) choices.push({ id: "fight", label: weapon ? `Fight with ${weapon.name}` : "Stand and fight", description: "Combat, health, armor, and close protection matter." });
    if (weapon?.type === "firearm") choices.push({ id: "draw", label: `Draw ${weapon.name}`, description: "Combat and weapon accuracy matter. Firing raises heat." });
    if (intelligenceCompat(state) >= 3) choices.push({ id: "intimidate", label: "Name their weak position", description: "Use Intelligence to make the threat feel too expensive." });
    const tone = state.people.crew.tone;
    if (tone.recruited && tone.status !== "departed" && tone.loyalty >= 5) choices.push({ id: "call_tone", label: "Call Tone", description: "Spend crew loyalty to end this on his terms." });
    if (encounter.id === "mina_sedan_night" && state.npc.mina.met) choices.push({ id: "call_mina", label: "Signal Mina", description: "Trust Mina to trigger the Night Owl alarm. This spends some of the trust between you." });
    // v1.19: through the presence-effect framework rather than an inline read of
    // his record. The exclusion list is the effect's own, not this call site's.
    if (Crew.deEscalateAvailable(state, "encounter", encounter.id)) choices.push({ id: "deshawn_deescalate", label: "Let Deshawn handle it", description: "No blood, one point of heat worked off. He notices what you choose next." });
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
    const damage = Math.max(1, raw - armor - Math.floor(combatCompat(state) / 2));
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
        if (finishAfter) { endRun(state); return state; }
        // v1.16: booking eats the clock. The arrest itself was settled while the
        // scene was still on screen; the time it cost is spent here, once the
        // encounter is off the board and advanceRun will actually run.
        const arrestSlots = state.run.pendingArrestSlots;
        state.run.pendingArrestSlots = null;
        if (arrestSlots) return advanceRun(state, { reason: "ARRESTED", suppressStory: true, timeCost: arrestSlots });
        return state;
      }
      const random = makeRandom(inputState.run.rngState);
      const deescalateWasAvailable = EncounterSystem.getEligibleChoices(inputState.run.pendingEncounter, inputState).some((item) => item.id === "deshawn_deescalate");
      const state = EncounterSystem.resolveEncounterChoice(inputState.run.pendingEncounter, action.choiceId, inputState, random);
      if (state === inputState) return inputState;
      state.run.rngState = random.state;
      // Exposure and crew side effects stay out of encounters.js on purpose -
      // the engine finishes the scene, game-core settles what it cost.
      if (action.choiceId === "deshawn_deescalate") applyDeshawnDeescalation(state);
      if (["fight", "draw"].includes(action.choiceId)) noteViolentChoice(state, deescalateWasAvailable);
      if (state.run.pendingEncounter?.type === "boost_caught" && state.run.pendingEncounter.resolved) {
        const detail = settleBoostCaught(state, state.run.pendingEncounter);
        state.run.pendingArrestSlots = detail ? detail.processingSlots : null;
      }
      if (state.run.pendingEncounter?.resolved) {
        const choice = action.choiceId === "draw" ? "fight" : ["fight", "run", "talk", "pay"].includes(action.choiceId) ? action.choiceId : "other";
        state.stats.encounterChoices[choice] += 1;
        if (["fight", "draw"].includes(action.choiceId)) recordBehavior(state, "stickup", action.choiceId === "draw" ? 2 : 1, `encounter:${state.run.pendingEncounter.id}`, "confrontation");
        else if (["talk", "call_crew", "use_relationship", "deshawn_deescalate"].includes(action.choiceId)) recordBehavior(state, "connector", 1, `encounter:${state.run.pendingEncounter.id}`, "relationship");
        logEntry(state, state.run.pendingEncounter.result?.prose || "The confrontation ends and the run keeps moving.", ["won", "escaped", "talked", "crew_win", "relationship", "deescalated"].includes(state.run.pendingEncounter.result?.outcome) ? "good" : "warn");
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
    else if (["talk", "call_tone", "call_mina", "deshawn_deescalate"].includes(choice)) recordBehavior(state, "connector", 1, `encounter:${encounter.id}`, "relationship");
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
      state.people.crew.tone.loyalty = Crew.clampLoyalty(state.people.crew.tone.loyalty - 1);
      state.player.heat = clamp(state.player.heat + 2, 0, 15);
      finishEncounter(state, "win", "Tone arrives without raising his voice. The other side leaves, and two nearby windows close their blinds.");
    } else if (choice === "call_mina") {
      Exposure.recordObservation(state, "mina", { type: "defiance", event: "called_her_into_it", source: "witnessed" });
      state.player.heat = clamp(state.player.heat + 1, 0, 15);
      finishEncounter(state, "escape", "Mina hits the Mini-Mart alarm. The collector runs before the patrol car reaches the lot.");
    } else if (choice === "deshawn_deescalate") {
      applyDeshawnDeescalation(state);
      finishEncounter(state, "talk", "Deshawn crosses the lot like he was already headed this way. Four sentences, none of them raised. The other side leaves with something that lets everyone keep face, and the street forgets it by morning.");
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
      const chance = clamp(0.58 + Math.max(0, dispositionOf(state, "curtis")) * 0.03 - encounter.guard, 0.15, 0.9);
      const outcome = resolveOutcome(state, "negotiation", chance, `${state.run.seed}:intimidate:${state.run.day}:${state.run.slot}:${encounter.id}`);
      broadcastOutcome(state, "negotiation", outcome.tier);
      if (Attributes.isSuccessTier(outcome.tier)) finishEncounter(state, "talk", "You name the cameras, exits, and people they failed to count. Their threat collapses under its own cost.");
      else failEncounterStep(state, random, "The calculation");
    } else if (choice === "talk") {
      const influence = state.world.influence[state.world.currentNeighborhoodId] * 0.04;
      const relationship = encounter.id === "mid" ? Math.max(0, dispositionOf(state, "curtis")) * 0.035 : encounter.id === "mina_sedan_night" ? Math.max(0, dispositionOf(state, "mina")) * 0.02 : 0;
      const chance = clamp(0.44 + influence + relationship - encounter.guard, 0.10, 0.90);
      const outcome = resolveOutcome(state, "negotiation", chance, `${state.run.seed}:talk:${state.run.day}:${state.run.slot}:${encounter.id}`);
      broadcastOutcome(state, "negotiation", outcome.tier);
      if (Attributes.isSuccessTier(outcome.tier)) {
        if (encounter.id === "mid") Exposure.recordObservation(state, "curtis", { type: "submission", event: "held_the_line", source: "witnessed" });
        finishEncounter(state, "talk", "You name the people and consequences they forgot to count. The lane opens without anybody reaching for a weapon.");
      } else failEncounterStep(state, random, "The explanation");
    } else if (choice === "run") {
      const gearBonus = GEAR_BY_ID[state.player.gear.equipped.utility]?.escape || 0;
      const chance = clamp(0.42 + gearBonus + 0.18 * freeCargoRatio(state) + healthModifier(state.player.health) - encounter.pursuit, 0.10, 0.90);
      const outcome = resolveOutcome(state, "escape", chance, `${state.run.seed}:escape:${state.run.day}:${state.run.slot}:${encounter.id}`);
      broadcastOutcome(state, "escape", outcome.tier);
      if (Attributes.isSuccessTier(outcome.tier)) {
        const lost = encounter.id === "mina_sedan_night" || encounter.id === "early_street" ? null : loseInventory(state, 1);
        finishEncounter(state, "escape", lost ? `You clear the lane but drop ${lost.lost} ${lost.product.name} under the fence.` : "You saw the open lane before they did and reach the street with the bag intact.");
      } else failEncounterStep(state, random, "The escape");
    } else if (choice === "fight" || choice === "draw") {
      noteViolentChoice(state, available.includes("deshawn_deescalate"));
      const weapon = equippedWeapon(state);
      const firearm = choice === "draw";
      // The combat term is gone from the chance on purpose: the attribute acts
      // through resolveWithAttribute below, and carrying it in both places would
      // pay the player twice for the same number.
      const chance = clamp((firearm ? 0.46 : 0.48) + (weapon?.accuracy || 0) + healthModifier(state.player.health) - (firearm ? encounter.evasion : encounter.guard), 0.10, 0.90);
      if (firearm) {
        state.player.heat = clamp(state.player.heat + weapon.heat, 0, 15);
        state.flags.firedWeaponDowntown = state.world.currentNeighborhoodId === "downtown";
      }
      const backup = Crew.combatAdvantageFor(state, "encounter", encounter.id);
      const outcome = resolveOutcome(state, "confrontation", chance, `${state.run.seed}:confrontation:${state.run.day}:${state.run.slot}:${encounter.id}:${encounter.step}`, backup);
      broadcastOutcome(state, "confrontation", outcome.tier);
      if (Attributes.isSuccessTier(outcome.tier)) {
        const damage = weapon ? random.int(weapon.damage[0], weapon.damage[1]) + (firearm ? 0 : Math.floor(combatCompat(state) / 2)) : random.int(4, 8) + combatCompat(state);
        encounter.enemyHealth -= damage;
        if (encounter.enemyHealth <= 0) {
          // At the kill, not per successful step. This engine resolves a fight
          // over several steps, so crediting each one would count a single
          // encounter two or three times.
          for (const crewId of Crew.combatAdvantageCrewIds(state, "encounter", encounter.id)) {
            const record = state.people.crew[crewId];
            if (record) record.combatWins = (record.combatWins || 0) + 1;
          }
          if (firearm || encounter.id === "late") state.flags.seriousViolence = true;
          Exposure.recordObservation(state, "curtis", { type: "submission", event: "won_the_room", source: "witnessed" });
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
    state.npc.mina.status = minaStatus(state);
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
    const attemptNumber = state.stats.robbery.attempts + 1;
    const outcome = resolveOutcome(state, "robbery", availability.chance, `${state.run.seed}:robbery:${state.run.day}:${state.run.slot}:${attemptNumber}`);
    const success = Attributes.isSuccessTier(outcome.tier);
    state.stats.robbery.attempts = attemptNumber;
    state.stats.robbery.lastAttemptedDay = state.run.day;
    state.stats.robbery.attempted = true;
    // v1.13: the envelope feeds the same ladder as every other robbery —
    // streak, daily cap, district word, plug wariness.
    recordRobberyActivity(state, state.world.currentNeighborhoodId, {});
    let result;
    if (success) {
      const clean = outcome.tier === "clean";
      const payout = random.int(115, 210);
      // A clean job is worth the same money and half the attention. That is the
      // whole payoff for training: not a bigger number, a smaller footprint.
      const addedHeat = districtHeat(state, state.world.currentNeighborhoodId, "stick", clean ? 1 : 2 + Math.floor((attemptNumber - 1) / 2)) * stickHeatMultiplier(state);
      state.player.cash += payout;
      state.player.heat = clamp(state.player.heat + addedHeat, 0, 15);
      state.stick.rep += 1;
      updateStickTier(state);
      raiseCurtisAwareness(state, 2); // a successful robbery is loud in Curtis's world
      if (!clean) Exposure.recordObservation(state, "curtis", { type: "violence", event: "stickup", count: Math.min(3, attemptNumber), source: "network" });
      state.stats.robbery.successes += 1;
      addStreetReadEntry(state, "risk", `rob:${state.world.currentNeighborhoodId}`);
      state.stats.robbery.totalPayout += payout;
      state.stats.robbery.success = true;
      state.stats.robbery.payout = state.stats.robbery.totalPayout;
      result = {
        kind: "robbery", tone: "good", title: clean ? "The Rob Goes Clean" : "The Rob Pays",
        summary: clean
          ? `A contractor leaves a cash envelope in an idling truck off the service road. You clear $${payout} and nobody ever looks up.`
          : `A contractor leaves a cash envelope in an idling truck off the service road. You clear $${payout}, but there is a struggle and the cameras get a useful description.`,
        effects: [`+$${payout} cash`, `+${Math.round(addedHeat * 10) / 10} Heat`, `Attempt ${attemptNumber} this week`],
      };
      broadcastOutcome(state, "robbery", outcome.tier, payout);
      if (!state.rob.visible) { state.rob.visible = true; queueUnlock(state, "rob"); }
    } else {
      const severe = outcome.tier === "catastrophic";
      const damage = random.int(10 + Math.min(6, attemptNumber - 1), 17 + Math.min(8, attemptNumber - 1)) + (severe ? 8 : 0);
      const addedHeat = districtHeat(state, state.world.currentNeighborhoodId, "stick", Math.min(6, (severe ? 5 : 3) + Math.floor((attemptNumber - 1) / 2))) * stickHeatMultiplier(state);
      state.player.health = clamp(state.player.health - damage, 0, 100);
      state.player.heat = clamp(state.player.heat + addedHeat, 0, 15);
      Exposure.recordObservation(state, "curtis", { type: "violence", event: "dealer_stickup", count: Math.min(4, attemptNumber + 1), source: "network" });
      state.stats.robbery.failures += 1;
      state.stats.robbery.success = state.stats.robbery.successes > 0;
      result = {
        kind: "robbery", tone: "bad", title: severe ? "The Rob Goes Wrong" : "The Rob Falls Apart",
        summary: severe
          ? "The truck is not empty and the driver is not alone. You get out hurt, and somebody called it in before you cleared the lot."
          : "The truck is empty and the driver returns with help. You get away hurt and recognized, but another attempt can open on a later day.",
        effects: [`-${damage} Health`, `+${Math.round(addedHeat * 10) / 10} Heat`, "$0 payout", `Attempt ${attemptNumber} this week`],
      };
      broadcastOutcome(state, "robbery", outcome.tier);
    }
    state.stats.majorDecisions.push(`Rob ${attemptNumber}: ${outcome.tier}`);
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
    const outcome = resolveOutcome(state, "dealer_robbery", actions.rob.chance, `${state.run.seed}:dealer_robbery:${state.run.day}:${state.run.slot}:${dealerId}`);
    const success = Attributes.isSuccessTier(outcome.tier);
    record.robbedCount += success ? 1 : 0;
    record.lastRobbedDay = state.run.day;
    Exposure.recordObservation(state, "curtis", { type: "defiance", event: "took_ground", source: "network" });
    // v1.13: robbing a plug directly is the loudest possible robbery — every
    // plug hears it, the whole ladder ticks. Goodie's own standing drop stays
    // below where it also syncs the dealer mirror.
    recordRobberyActivity(state, definition.areaId, { direct: true, skipStandingFor: dealerId });
    const dealerHeatScale = (amount) => districtHeat(state, definition.areaId, "stick", amount) * stickHeatMultiplier(state);
    const effects = [];
    let result;

    if (success) {
      const payout = 90 + state.run.day * 12 + random.int(0, 60);
      // v1.13: a plug who cut you off (suspicion) is not "holding" for you —
      // the robbery still takes his cash, there is just no product to lift.
      // The old early return here became an infinite no-op once suspicion
      // could empty this list mid-run.
      const availableProducts = definition.products.filter((productId) => !!unlockedPlugForProduct(state, productId));
      const productId = availableProducts.length ? random.pick(availableProducts) : null;
      const units = productId ? random.int(2, 4) : 0;
      state.player.cash += payout;
      state.stick.rep += 1;
      updateStickTier(state);
      raiseCurtisAwareness(state, 2); // a successful robbery is loud in Curtis's world
      addStreetReadEntry(state, "risk", `robbery:${state.world.currentNeighborhoodId}`);
      if (productId) applyEventEffect(state, { addProduct: { id: productId, qty: units, unitCost: 0 } }, random);
      const takenHeat = dealerHeatScale(outcome.tier === "clean" ? 1 : 2);
      state.player.heat = clamp(state.player.heat + takenHeat, 0, 15);
      record.standing = Math.max(-5, record.standing - 3);
      record.supplyChoked = 2;
      effects.push(`+$${payout} cash`, productId ? `+${units} ${PRODUCTS.find((item) => item.id === productId).name} at no cost` : "He was not holding product for you", `+${Math.round(takenHeat * 10) / 10} Heat`, "Spenard supply tightens for two days");
      broadcastOutcome(state, "dealer_robbery", outcome.tier, payout);
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
      const severe = outcome.tier === "catastrophic";
      const damage = random.int(armed ? 12 : 20, 26) + (severe ? 8 : 0);
      const takenHeat = dealerHeatScale(severe ? 5 : 3);
      state.player.health = clamp(state.player.health - damage, 0, 100);
      state.player.heat = clamp(state.player.heat + takenHeat, 0, 15);
      record.standing = Math.max(-5, record.standing - 3);
      record.retaliated = true;
      effects.push(`-${damage} Health`, `+${Math.round(takenHeat * 10) / 10} Heat`, "$0 taken", `${first} will be ready next time`);
      broadcastOutcome(state, "dealer_robbery", outcome.tier);
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

    if (state.npc.mina.chainStage >= 2 && knowsYou(state, "mina") && state.npc.mina.available !== false) {
      // She works two blocks from this corner. The neighborhood carries it.
      Exposure.broadcastObservation(state, { type: "violence", event: "robbery_near_her", location: HOME_DISTRICT_ID, channel: "neighborhood" });
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
    const successChance = clamp(0.52 + intelligenceCompat(state) * 0.06 + Math.max(0, state.people.crew.eli.loyalty - Crew.CREW_LOYALTY_START) * 0.03 - state.player.heat * 0.01, 0.42, 0.78);
    const success = random.next() < successChance;
    let result;
    if (success) {
      const payout = random.int(50, 80);
      state.player.cash += payout;
      state.people.crew.eli.loyalty = Crew.clampLoyalty(state.people.crew.eli.loyalty + standingGain(state.people.crew.eli, state.people.crew.eli.loyalty, 1, "open"));
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
      Exposure.recordObservation(state, "curtis", { type: "discretion", event: "laid_low", count: 2, source: "network" });
      if (areaId === "downtown") state.world.productAccess.cocaine = true;
      if (areaId === "airport_industrial") state.world.productAccess.meth = true;
      title = `${AREA_BY_ID[areaId].name} Changes Hands`;
      summary = `Your crew wins ${attackerWins}–${defenderWins}. Curtis's people leave the block, and the neighborhood starts paying your operation.`;
      effects.push("Influence set to Controlled", `+$${definition.dailyIncome} after each Night`, "4% better buying and selling", definition.special);
    } else {
      state.stats.takeovers.losses += 1;
      state.player.heat = clamp(state.player.heat + 3, 0, 15);
      Exposure.recordObservation(state, "curtis", { type: "growth", event: "pushed_hard", count: 2, source: "network" });
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
      goodie: { title: "Goodie at the Wash & Go", who: "Goodie", where: "Wash & Go, Spenard Road", description: "Guy outside the Wash & Go on Spenard catches your eye and asks if you're looking. He's got weed, nothing crazy. Prices are mid. Take it or leave it." },
      tasha: { title: "Goodie's Introduction", who: "Tasha", where: "Bus shelter, Spenard and Northern Lights", description: "Goodie sends a number. Tasha answers from the bus shelter at Spenard and Northern Lights, quotes pills and lean, and names the most she'll move at once. Cash only. No small talk." },
      malik: { title: "Tasha's Introduction", who: "Malik", where: "Parking garage, 4th and Gambell", description: "Tasha sends Malik's number. He works out of the parking garage at 4th and Gambell, quotes coke and molly, says he has weight, and asks what quantity you can pay for today." },
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

  // v1.13: the first blind spot is seeded per run — store and framing both
  // vary — instead of always being the Night Owl camera, which read as a
  // scripted beat on repeat plays. Same event id, same choices, same unlock.
  const BOOST_FIRST_FRAMINGS = [
    { id: "blind_spot", title: "Blind Spot", line: (name) => `You're browsing ${name}. The camera has a blind spot by the back aisle. Pocket something or keep walking.` },
    { id: "back_turned", title: "Back Turned", line: (name) => `The clerk at ${name} is deep in a phone argument, back to the floor. Pocket something or keep walking.` },
    { id: "propped_door", title: "Propped Door", line: (name) => `A vendor drop has ${name} in chaos. Boxes stacked, door propped, nobody watching. Pocket something or keep walking.` },
  ];
  function firstBoostOpportunityEvent(state) {
    const areaId = state?.world?.currentNeighborhoodId || HOME_DISTRICT_ID;
    const targets = BOOST_TARGETS.filter((target) => target.tier === 1 && target.areaId === areaId);
    const pool = targets.flatMap((target) => BOOST_FIRST_FRAMINGS.map((framing) => ({ target, framing, weight: 1 })));
    const pick = seededPick(pool, `${state?.run?.seed || 0}:boost_first`) || { target: BOOST_TARGET_BY_ID.night_owl, framing: BOOST_FIRST_FRAMINGS[0] };
    return {
      id: "boost_first_opportunity", title: pick.framing.title, who: "You", where: pick.target.name,
      stakes: "Pocket something or keep walking.",
      description: pick.framing.line(pick.target.name),
      choices: [
        { label: "Pocket it", effect: { boostTargetId: pick.target.id, setFlags: { boostOpportunitySeen: true } }, preview: "Try a small lift.", result: "You make the move before the camera swings back." },
        { label: "Keep walking", effect: { setFlags: { boostOpportunitySeen: true } }, preview: "Leave it alone.", result: "You leave the shelf untouched." },
      ],
    };
  }

  // The card that used to open the abstract backroom game. It now opens the room
  // upstairs at The Nile, which is where the games actually are - the narrative
  // beat was always good and only the destination was a placeholder.
  function gamblingDiscoveryEvent(source) {
    const person = SOCIAL_CONTACTS[source];
    const fromCoworker = person && source !== "cal";
    const teller = fromCoworker ? person.name.split(" ")[0] : "Cal";
    return event("gambling_discovery", "A Door After Closing", fromCoworker
      ? `${teller} gives you an address on Spenard Road. Two floors, blue neon, and a stairwell behind the front desk.`
      : "Cal lowers his voice. There is a wellness place on Spenard Road, he says, and a room above it that runs after six.", [
      { label: "Keep the address", effect: { discoverGambling: true }, preview: "Opens the room above Blue Nile Wellness.", result: "You fold the address into your pocket. He says the door code changes weekly and that Biniam will text you this one." },
    ], fromCoworker
      ? `${teller} checks the room before speaking. The address stays covered under one hand.`
      : "Cal scratches it onto a coffee sleeve. His chair stays angled toward the front door while he writes.");
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
    // Checked as the shift starts, so the conversation happens before the work
    // and a firing costs you the shift you came in for.
    if (applyHeatEmployment(state, job.id) === "fired") return advanceRun(state, { reason: "WORK_JOB" });
    const random = makeRandom(state.run.rngState);
    const record = state.jobs.records[job.id];
    const coworker = coworkerForShift(state, job);
    const pay = jobPayRange(state, job.id);
    const payout = Math.round(random.int(pay.min, pay.max) * approach.payMultiplier);
    const oldRank = record.rank;

    addCleanCash(state, payout);
    state.player.health = clamp(state.player.health + approach.health, 1, 100);
    record.xp += approach.xp;
    record.relationship += standingGainFloat(record.relationship, approach.relationship, "open");
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
      employer.standing = clamp(employer.standing + standingGain(employer, employer.standing, 1, "capped"), 0, 5);
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
      state.player.attributes = action.type === "CHOOSE_BACKGROUND"
        ? { combat: background.combat, charisma: background.charisma, intelligence: background.intelligence }
        : { ...ATTRIBUTE_DEFAULTS };
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
        Exposure.recordObservation(state, "dre", { type: "financial", event: "took_the_note", source: "witnessed" });
        state.npc.dre.loansTaken = Math.max(1, state.npc.dre.loansTaken);
        Exposure.recordObservation(state, "curtis", { type: "growth", event: "arrived_working", source: "network" });
        state.npc.curtis.relationship = "dismissive";
        state.world.productAccess.weed = true;
        state.world.productAccess.shrooms = true;
        state.world.transport.downtownKnown = true;
        state.world.transport.industrialRouteKnown = true;
      }
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
      applyEventEffect(state, choice.effect || {}, random, { eventId: current.id });
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
          state.npc.mina.outcome = state.npc.mina.available === false || state.flags.exploitedValeName || dispositionOf(state, "mina") <= 0 ? "mina_gone" : atLeastBand(state, "mina", BANDS.BONDED) && (state.flags.toldMinaTruth || state.flags.valeProtectedMina || state.flags.minaBrokeredVale) ? "mina_stays" : "mina_calls_home";
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
      // The first-boost opportunity resolves a lift inside an event effect
      // rather than through the BOOST reducer. It gets the same caught-state.
      openOrSettleBoostCaught(state);
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
      if (!state.market?.visible || !plug) return inputState;
      // A missing product or a quantity that came through as NaN used to fall
      // out here without a word. Same guard, now with a receipt.
      if (!product || qty < 1) return failedPurchase(state, action.productId, "market");
      if (qty > plugMaxUnits(state, product.id)) return inputState;
      const projection = tradeProjection(state, product.id, qty, "buy");
      const cost = projection.purchaseCost, available = market.availability[product.id] || 0;
      if (qty > available || cost > state.player.cash || cargoUsed(state) + qty > cargoCapacity(state)) return inputState;
      const item = state.player.inventory[product.id], totalQty = item.qty + qty;
      item.avgCost = ((item.avgCost * item.qty) + cost) / totalQty;
      item.qty = totalQty;
      state.player.cash -= cost;
      market.availability[product.id] -= qty;
      // v1.35 risk term. Buying weight is the quieter half of the trade, so it
      // reads as ambient awareness: one bag at a time (1-7 units) draws nothing,
      // a full load (8+) picks up a single point. Quantity, not product, is the
      // signal — someone noticed you buying weight. The consequence is not this
      // Heat; it is the event cards and Exposure that only find you once Heat is
      // above zero. Added flat (integer, no district multiplier) so the surface
      // the player reads stays legible.
      state.player.heat = clamp(state.player.heat + Math.floor(qty / 8), 0, 15);
      recordCriminalActivity(state, state.world.currentNeighborhoodId, "market");
      state.run.currentVisit.trades += 1;
      state.run.currentVisit.grossBuy += cost;
      addStreetReadEntry(state, "trading", `${state.world.currentNeighborhoodId}:${product.id}`);
      if (state.player.heat >= 8) addStreetReadEntry(state, "risk", `high_heat_trade:${state.world.currentNeighborhoodId}`);
      logEntry(state, `${qty} ${product.name} in the bag. $${cost} out the other pocket. Nobody looked twice.`, "good");
      const record = plugRecord(state, plug.id);
      if (record && record.lastPurchaseDay !== state.run.day) {
        record.lastPurchaseDay = state.run.day;
        record.standing = Math.min(5, record.standing + standingGain(record, record.standing, 1, "capped"));
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
      // v1.13: a clean purchase — nothing robbed on this plug's block today —
      // works suspicion back down one point.
      if (record && (record.suspicion || 0) > 0) {
        const homeDistrict = Districts.PLUG_HOME_DISTRICTS[plug.id];
        const robbedThereToday = state.stick?.lastRobberyDay === state.run.day && state.stick?.lastRobberyDistrict === homeDistrict;
        if (!robbedThereToday) record.suspicion = Math.max(0, record.suspicion - 1);
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
      // v1.35 risk term. Selling is the visible act — standing on a corner
      // making the exchange — so it runs hotter than the buy: 1-3 units draw
      // nothing, 4+ picks up a point, a full load (8+) two. Same ambient logic
      // as BUY; the real cost lands later, through what Heat above zero lets
      // find you. Flat integer, no district multiplier.
      state.player.heat = clamp(state.player.heat + Math.floor(qty / 4), 0, 15);
      recordCriminalActivity(state, state.world.currentNeighborhoodId, "market");
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
      logEntry(state, `${qty} ${product.name} gone. $${total} cash. Quick count, quick exit.`, profit >= 0 ? "good" : "bad");
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
        Exposure.recordObservation(state, "juan", { type: "loyalty", event: "sat_and_talked", source: "household" });
        if (!state.npc.juan.infoShared.includes("work:ship_creek")) state.npc.juan.infoShared.push("work:ship_creek");
        state.effects.rumors.push({ id: `juan_${state.run.day}`, areaId: "north_star_lot", productId: "weed", reliable: true, text: "Juan says Ship Creek hires early and his warehouse dock keeps a short callback list.", expiresAt: slotNumber(state.run.day, state.run.slot) + 4 });
        pushConsequence(state, "Juan writes a loading-dock name on your receipt.", "good");
        // He knows the Tesfayes through day labor. What he passes on depends on
        // how far he trusts you: an address at Warm, an introduction at Trusted.
        maybeJuanNileMention(state);
      } else {
        Exposure.recordObservation(state, "yalonda", { type: "loyalty", event: "sat_and_talked", source: "household" });
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
    // v1.30: no garage clause. Tone, Pherris and Deshawn recruit through
    // Exposure scenes rather than through the garage, so gating payroll on
    // owning and standing inside the base built a trap: crew with arrears the
    // player had no reachable way to clear, bleeding a loyalty point a night
    // until they walked. The garage is a territory prerequisite (Eli, soldiers,
    // claims), never a crew one. BAIL_CREW and PROMOTE_CREW_TIER were already
    // ungated for the same reason - this row just joins them.
    if (action.type === "PAY_CREW") {
      if (!CREW_BY_ID[action.crewId]) return inputState;
      const crew = state.people.crew[action.crewId];
      if (!crew.recruited || crew.wageDue <= 0 || state.player.cash < crew.wageDue) return inputState;
      const amount = crew.wageDue;
      state.player.cash -= amount; crew.wageDue = 0; crew.wageMissedSince = null; crew.loyalty = Crew.clampLoyalty(crew.loyalty + standingGain(crew, crew.loyalty, 1, "open")); state.stats.moneySpent.crew += amount;
      recordBehavior(state, "earner", 2, `crew_pay:${action.crewId}:${state.run.day}`, "crew_pay");
      logEntry(state, `${CREW_BY_ID[action.crewId].name.split(" ")[0]} folds the full $${amount} into a pocket and stays for the next plan.`, "good");
      reconcileCash(state);
      return state;
    }
    // v1.16: the other half of the crew arrest. Showing up costs money and one
    // point of loyalty; not showing up costs the rest of their sentence and
    // leaves them at 1. Free of the clock, same as PAY_CREW.
    if (action.type === "BAIL_CREW") {
      const availability = crewBailAvailability(state, action.crewId);
      if (!availability.available) return inputState;
      const crew = state.people.crew[action.crewId];
      spendCash(state, availability.cost);
      state.stats.moneySpent.crew += availability.cost;
      crew.status = "active";
      crew.jailedUntilDay = null;
      crew.jailedSeverity = null;
      crew.loyalty = Crew.clampLoyalty(Math.max(1, crew.loyalty - Arrest.CREW_BAIL_LOYALTY_COST));
      if (state.flags.crewBailPending === action.crewId) state.flags.crewBailPending = null;
      const name = CREW_BY_ID[action.crewId].name.split(" ")[0];
      const hash = stringHash(`${state.run.seed}:crew-bail:${action.crewId}:${state.run.day}`);
      logEntry(state, Arrest.pickLine(Arrest.CREW_BAIL_LINES, hash).replace("%s", name), "good");
      pushConsequence(state, `${name} is out. $${availability.cost} lighter. They don't say thank you. You don't ask for one.`, "warn");
      recordBehavior(state, "connector", 1, `crew_bail:${action.crewId}:${state.run.day}`, "crew_bail");
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
      Exposure.recordObservation(state, "yalonda", { type: "financial", event: "rent_paid", source: "household" });
      recordBehavior(state, "earner", 2, `rent:${state.run.day}`, "rent_payment");
      pushConsequence(state, "Yalonda counts the rent once and closes the envelope.", "good");
      logEntry(state, `Weekly rent paid in cash: $${WEEKLY_RENT}.`, "good");
      return state;
    }
    // v1.27. A phone call, so it costs money and nothing else - no slot, no
    // energy, no location. It is not in TIME_ACTIONS and it does not call
    // advanceRun, which is the same shape PAY_RENT and PAY_PHONE_BILL have had
    // for versions and the reason none of the three appears in the day's
    // action budget.
    //
    // Every guard returns inputState unchanged rather than a mutated copy, so a
    // dispatch the UI should not have offered is a genuine no-op: no debit, no
    // message, and identity-equal state a test can assert on.
    if (action.type === "BUY_DISCLOSURE") {
      const npcId = action.npcId;
      const intelType = action.intelType;
      const entry = Disclosures.disclosureFor(npcId, intelType);
      if (!entry || !state.phone?.active) return inputState;
      const accuracy = Disclosures.resolvedAccuracy(npcId, intelType, bandOf(state, npcId), entry.minBand);
      if (accuracy === "unavailable") return inputState;
      // v1.30. disclosureOffers mirrors this; the reducer owns it. A crew
      // source who was never hired, is in custody, or walked out over unpaid
      // wages is not answering, and a stale card must not be able to buy from
      // them. The unauthored-accuracy case is already covered below by the
      // `!text` guard, which is what keeps territory_status exact-only.
      if (entry.requiresCrew && !crewIsActive(state, npcId)) return inputState;
      // One call per person per day. They do not sit by the phone waiting, and
      // the cooldown is what stops the intel economy becoming a vending
      // machine for anyone with cash. Note this also covers "bought the same
      // thing twice": the first purchase is already in the inbox, and the
      // second ask never reaches a second debit.
      if (disclosureAskedToday(state, npcId)) return inputState;
      const price = Disclosures.priceFor(intelType);
      if (state.player.cash < price) return inputState;
      const payload = disclosurePayload(state, npcId, intelType, accuracy);
      const rotation = stringHash(`${state.run.seed}:disclosure-text:${npcId}:${intelType}:${state.run.day}`);
      const text = Disclosures.disclosureText(npcId, intelType, accuracy, payload, rotation);
      if (!text) return inputState;
      spendCash(state, price);
      disclosuresToday(state).push({ npcId, intelType, day: state.run.day, slot: state.run.slot });
      pushPhoneMessage(state, Disclosures.senderFor(npcId), text);
      logEntry(state, `${Disclosures.senderFor(npcId)} shared some intel. Check your texts.`, "good");
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
      state.jobs.records[job.id].hiredDay = state.run.day;
      retireOfferMessages(state, job.id);
      pushConsequence(state, previousId ? `${SPENARD_JOB_BY_ID[previousId].name} gets the quit call. ${job.name} is now your employer.` : `${job.name} is now your employer.`, "good");
      return state;
    }
    if (action.type === "DECLINE_JOB") {
      if (!state.jobs.offers.includes(action.jobId)) return inputState;
      state.jobs.offers = state.jobs.offers.filter((id) => id !== action.jobId);
      retireOfferMessages(state, action.jobId);
      pushConsequence(state, `You turn down ${SPENARD_JOB_BY_ID[action.jobId].name}.`, "");
      return state;
    }
    // v1.29: the inbox stacked up with no way to empty it, and the nav badge
    // counted messages the player had already read and acted on. Neither case
    // costs time or answers to a district, for the reason PAY_PHONE_BILL from
    // the phone does not: clearing a text is not an action in the world.
    if (action.type === "DISMISS_PHONE_MESSAGE") {
      const before = state.phone.inbox.length;
      state.phone.inbox = state.phone.inbox.filter((message) => message.id !== action.id);
      if (state.phone.inbox.length === before) return inputState;
      return state;
    }
    if (action.type === "CLEAR_PHONE_INBOX") {
      if (!state.phone.inbox.length) return inputState;
      state.phone.inbox = [];
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
      state.lender.dueDay = state.run.day + (repeat ? 5 : LOAN_TERM_DAYS);
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
      if (outcome === "clean") { state.npc.dre.cleanCompletions += 1; Exposure.recordObservation(state, "dre", { type: "loyalty", event: "clean_mission", source: "witnessed" }); }
      else if (outcome === "violent") { state.player.heat = clamp(state.player.heat + 2, 0, 15); broadcastTracked(state, { type: "violence", event: "mission_went_loud", channel: "network" }); }
      else if (outcome === "soft") { if (mission.id === "intelligence") Exposure.recordObservation(state, "dre", { type: "loyalty", event: "useful_intel", source: "witnessed" }); }
      else Exposure.recordObservation(state, "dre", { type: "defiance", event: "botched_mission", source: "witnessed" });
      state.npc.dre.missionHistory.push({ ...active, outcome, pay, day: state.run.day });
      state.npc.dre.activeMission = null;
      if (sharkUnlocked(state)) { state.hustle.shark.visible = true; state.hustle.sections.shark = true; }
      logEntry(state, `Dre's ${mission.label.toLowerCase()} mission ends ${outcome}${pay ? `, paying $${pay}` : ""}.`, outcome === "clean" ? "good" : outcome === "violent" || outcome === "failed" ? "bad" : "warn");
      return advanceRun(state, { reason: "DRE_MISSION", suppressStory: true });
    }
    if (action.type === "DRE_TALK") {
      if (!atLeastBand(state, "dre", BANDS.BONDED)) return inputState;
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
        Exposure.recordObservation(state, "dre", { type: "defiance", event: "walked_a_debt", source: "witnessed" });
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
      if (action.choice === "respect") Exposure.recordObservation(state, "simone", { type: "submission", event: "gave_respect", source: "witnessed" });
      else if (["poach", "threaten"].includes(action.choice)) state.npc.simone.threat += 1;
      else if (action.choice === "leverage") { state.npc.simone.leverage += 1; state.npc.simone.threat += 1; }
      else if (action.choice === "truce" && atLeastBand(state, "simone", BANDS.WARM)) state.npc.simone.truce = true;
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
      if (!deshawn?.recruited || deshawn.tier < 2 || !curtisHostile(state)) return inputState;
      state.npc.curtis.protectionUntilDay = Math.max(state.npc.curtis.protectionUntilDay || 0, state.run.day + 1);
      deshawn.trucesBrokered += 1;
      state.npc.simone.truce = knowsYou(state, "simone") || state.npc.simone.leverage > 0;
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
      // The flyer opens the ground floor only. Nothing on a community board is
      // ever going to mention the room upstairs.
      if (board.some((entry) => entry.id === Nile.BOARD_FLYER.id)) discoverNile(base, Nile.DISCOVERY_METHODS.board);
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
      // These nights were already happening and already counted for nothing.
      // Reading a room full of night-shift regulars is Charisma practice at a
      // slow rate - the lowest of the three sources, because it is incidental.
      base.nightOwl.socialSessions += 1;
      growAtNightOwl(base);
      // How a night at the counter lands is a Charisma read. The conversation
      // always happens - only whether it moves the relationship is in question,
      // and a bad read is a flat night rather than a locked door.
      const outcome = resolveOutcome(base, "night_owl", 0.78, `${base.run.seed}:night_owl:${base.run.day}:${regular.id}`);
      const landed = Attributes.isSuccessTier(outcome.tier);
      relationship.met = true;
      if (landed) relationship.relationship += 1;
      relationship.lastTalkDay = base.run.day;
      broadcastOutcome(base, "night_owl", outcome.tier);
      base.contacts[regular.id].known = true;
      base.contacts[regular.id].relationshipLevel = Math.max(base.contacts[regular.id].relationshipLevel, relationship.relationship);
      recordVisitedLocation(base, "night_owl");
      recordMetNpc(base, regular.id);
      updateWeekZeroEligibility(base);
      if (regular.id === "nia" && relationship.relationship >= 2 && !base.flags.niaCourierHint) {
        base.flags.niaCourierHint = true;
        logEntry(base, "Nia says a courier who can keep a route quiet never stays short of work. She leaves the next part for later.", "good");
      } else if (!landed) {
        logEntry(base, outcome.tier === "catastrophic"
          ? "You push the joke one beat too far and the counter goes quiet. Everybody in the room clocks it."
          : `${regular.name.split(" ")[0]} is polite about it, but the conversation never finds a second gear.`, outcome.tier === "catastrophic" ? "bad" : "");
      } else {
        logEntry(base, regular.id === "cal" ? "Cal turns a loud story into a conversation and remembers that you stayed for the ending." : "Nia closes her paperback and trades one careful detail about the roads.", "good");
      }
      if (regular.id === "cal" && relationship.relationship >= 2 && !base.world.locations.gamblingKnown && !base.run.pendingEvent) {
        base.flags.gamblingDiscoverySeen = true;
        base.run.pendingEvent = gamblingDiscoveryEvent("cal");
      }
      return base;
    }
    // Buying is a meetup: one slot to travel, inspect, and pay, and a robbery
    // roll on the way back with whatever is now in the bag.
    if (action.type === "BUY_907LIST") {
      const item = LISTING_ITEM_BY_ID[action.itemId];
      const list = base.nineZeroSevenList;
      const meetup = marketMeetupAvailability(base);
      if (!meetup.available || !item
        || !listingSlate(base, action.surface).some((entry) => entry.id === item.id)
        || list.inventory.length >= marketCapacity(base)
        || base.player.cash < item.buy) return inputState;
      const reliability = MarketEvents.reliabilityFor(base, item.id, base.run.day);
      markListingTaken(base, item.id);
      // Someone else got there first. The slot is still gone: the trip happened.
      if (MarketEvents.rollSnipe(base, item.id, reliability)) {
        logEntry(base, `The ${item.name.toLowerCase()} is already gone when you get there. Somebody moved faster.`, "warn");
        return advanceRun(base, { reason: "BUY_907LIST", suppressStory: true, summary: "Listing already taken" });
      }
      spendCash(base, item.buy);
      list.inventory.push({ id: `${base.run.day}:${base.run.slot}:${list.purchases}`, itemId: item.id, cost: item.buy, boughtDay: base.run.day, listed: false });
      list.purchases += 1;
      logEntry(base, `You buy the ${item.name.toLowerCase()} for $${item.buy} and make room to hold it.`, "good");
      marketMeetupRobbery(base, `buy:${item.id}`);
      return advanceRun(base, { reason: "BUY_907LIST", suppressStory: true, cashDelta: item.buy, summary: `Bought ${item.name.toLowerCase()}` });
    }
    // Listing costs nothing but the wait. A buyer answers next morning, or at
    // Broker tier immediately, and either way the delivery is its own slot.
    if (action.type === "SELL_907LIST") {
      const list = base.nineZeroSevenList;
      const held = list.inventory.find((entry) => entry.id === action.inventoryId);
      const item = held && LISTING_ITEM_BY_ID[held.itemId];
      if (!held || held.listed || !item || !nineZeroSevenListAccess(base, action.surface || "phone").available) return inputState;
      const config = marketTierConfig(base);
      const district = marketMeetupDistrict(base) || HOME_DISTRICT_ID;
      held.listed = true;
      list.pendingSells.push({
        id: `sell:${base.run.day}:${base.run.slot}:${held.id}`,
        inventoryId: held.id, itemId: item.id, cost: held.cost, district,
        status: "listed", price: 0,
        resolveAtSlot: config.sellDelayDays === 0
          ? slotNumber(base.run.day, base.run.slot)
          : slotNumber(base.run.day + config.sellDelayDays, 0),
      });
      logEntry(base, config.sellDelayDays === 0
        ? `You post the ${item.name.toLowerCase()}. Verified listings move the same day.`
        : `You post the ${item.name.toLowerCase()} and wait. Somebody answers by morning, or nobody does.`, "");
      // A verified listing resolves in the slot it was posted, which is the
      // whole benefit of the tier. Everything else waits for advanceRun.
      if (config.sellDelayDays === 0) resolveMarketSells(base);
      return base;
    }
    // The delivery half of an open-market sale. One slot, one meetup, one more
    // robbery roll while carrying everything still unsold.
    if (action.type === "DELIVER_907LIST") {
      const list = base.nineZeroSevenList;
      const pending = list.pendingSells.find((entry) => entry.id === action.pendingId && entry.status === "ready");
      const held = pending && list.inventory.find((entry) => entry.id === pending.inventoryId);
      const item = held && LISTING_ITEM_BY_ID[held.itemId];
      const meetup = marketMeetupAvailability(base);
      if (!pending || !held || !item || !meetup.available) return inputState;
      if (marketMeetupRobbery(base, `deliver:${pending.id}`)) {
        return advanceRun(base, { reason: "DELIVER_907LIST", suppressStory: true, summary: "Robbed at the meetup" });
      }
      list.inventory = list.inventory.filter((entry) => entry.id !== held.id);
      list.pendingSells = list.pendingSells.filter((entry) => entry.id !== pending.id);
      const margin = recordMarketFlip(base, { item, payout: pending.price, cost: held.cost, district: pending.district });
      logEntry(base, `The buyer takes the ${item.name.toLowerCase()} for $${pending.price}. ${margin >= 0 ? `That is $${margin} clean.` : `That is $${Math.abs(margin)} down, and they made sure 907List heard about it.`}`, margin >= 0 ? "good" : "warn");
      return advanceRun(base, { reason: "DELIVER_907LIST", suppressStory: true, cashDelta: pending.price, summary: `Sold ${item.name.toLowerCase()} (+$${pending.price})` });
    }
    // Certainty for twenty percent. The buyer comes to you, same slot, and never
    // ghosts — the trade is margin for a day you can plan around.
    if (action.type === "QUICK_SELL_907LIST") {
      const list = base.nineZeroSevenList;
      const held = list.inventory.find((entry) => entry.id === action.inventoryId);
      const item = held && LISTING_ITEM_BY_ID[held.itemId];
      const meetup = marketMeetupAvailability(base);
      if (!held || held.listed || !item || !meetup.available || !marketTierConfig(base).quickSell) return inputState;
      if (marketMeetupRobbery(base, `quick:${held.id}`)) {
        return advanceRun(base, { reason: "QUICK_SELL_907LIST", suppressStory: true, summary: "Robbed at the meetup" });
      }
      const district = marketMeetupDistrict(base) || HOME_DISTRICT_ID;
      const payout = MarketEvents.salePrice(base, item, { condition: item.condition, nonce: `quick:${held.id}`, district, quickSell: true });
      list.inventory = list.inventory.filter((entry) => entry.id !== held.id);
      const margin = recordMarketFlip(base, { item, payout, cost: held.cost, district });
      logEntry(base, `A known buyer takes the ${item.name.toLowerCase()} off your hands for $${payout}, no haggling. ${margin >= 0 ? `$${margin} clean.` : `$${Math.abs(margin)} down.`}`, margin >= 0 ? "good" : "warn");
      return advanceRun(base, { reason: "QUICK_SELL_907LIST", suppressStory: true, cashDelta: payout, summary: `Quick sold ${item.name.toLowerCase()} (+$${payout})` });
    }
    // Filling a named buyer's ask. The sourcing was the work, so this pays a
    // premium and never flakes — but the player had to read the request and go
    // find the thing.
    if (action.type === "FILL_BUYER_REQUEST") {
      const list = base.nineZeroSevenList;
      const request = marketRequests(base).find((entry) => entry.id === action.requestId);
      const held = list.inventory.find((entry) => entry.id === action.inventoryId);
      const item = held && LISTING_ITEM_BY_ID[held.itemId];
      const meetup = marketMeetupAvailability(base);
      if (!request || !held || held.listed || !item || !meetup.available
        || item.category !== request.category || item.buy > request.budget) return inputState;
      if (marketMeetupRobbery(base, `fill:${request.id}`)) {
        return advanceRun(base, { reason: "FILL_BUYER_REQUEST", suppressStory: true, summary: "Robbed at the meetup" });
      }
      const district = marketMeetupDistrict(base) || HOME_DISTRICT_ID;
      const payout = MarketEvents.salePrice(base, item, { condition: item.condition, nonce: `fill:${request.id}`, district, request: true });
      list.inventory = list.inventory.filter((entry) => entry.id !== held.id);
      list.buyerRequests = list.buyerRequests.filter((entry) => entry.id !== request.id);
      list.filledRequests += 1;
      const margin = recordMarketFlip(base, { item, payout, cost: held.cost, district });
      logEntry(base, `${request.buyerName} takes the ${item.name.toLowerCase()} for $${payout} and says to keep them in mind. $${Math.abs(margin)} ${margin >= 0 ? "clean" : "down"}.`, margin >= 0 ? "good" : "warn");
      return advanceRun(base, { reason: "FILL_BUYER_REQUEST", suppressStory: true, cashDelta: payout, summary: `Filled ${request.buyerName}'s ask (+$${payout})` });
    }
    // Three items from a seller who needs them gone today. Thirty percent off the
    // lot, and every dollar of it becomes carried value until it moves.
    if (action.type === "BUY_BULK_907LIST") {
      const list = base.nineZeroSevenList;
      const deal = marketBulkDeal(base);
      const meetup = marketMeetupAvailability(base);
      if (!deal || deal.id !== action.dealId || !meetup.available
        || list.inventory.length + deal.itemIds.length > marketCapacity(base)
        || base.player.cash < deal.price) return inputState;
      spendCash(base, deal.price);
      deal.itemIds.forEach((itemId, index) => {
        const item = LISTING_ITEM_BY_ID[itemId];
        markListingTaken(base, itemId);
        list.inventory.push({
          id: `${base.run.day}:${base.run.slot}:${list.purchases + index}`,
          itemId, cost: Math.round(item.buy * (1 - deal.discount)), boughtDay: base.run.day, listed: false,
        });
      });
      list.purchases += deal.itemIds.length;
      list.bulkDeal = { ...deal, taken: true };
      logEntry(base, `The seller wants the whole lot gone. Three items for $${deal.price}, $${deal.listPrice - deal.price} under asking, and now you are carrying all of it.`, "good");
      marketMeetupRobbery(base, `bulk:${deal.id}`);
      return advanceRun(base, { reason: "BUY_BULK_907LIST", suppressStory: true, cashDelta: deal.price, summary: `Bought a three-item lot for $${deal.price}` });
    }
    if (action.type === "BUY_LAPTOP") {
      const offeredAtNightOwl = nightOwlAvailability(base).available
        && base.nightOwl.boardViewedDays.includes(base.run.day)
        && nightOwlBoardItems(base).some((entry) => entry.id === "laptop");
      if ((!base.nineZeroSevenList.known && !offeredAtNightOwl) || base.inventory.laptop || base.player.cash < 250) return inputState;
      spendCash(base, 250);
      base.inventory.laptop = true;
      base.nineZeroSevenList.tier = marketTier(base);
      logEntry(base, "The used laptop boots at home. Four listings a day now, with condition and seller history on every one, and Downtown sellers will meet you.", "good");
      return base;
    }
    if (action.type === "VISIT_NIGHT_OWL") {
      if (!nightOwlAvailability(state).available) return inputState;
      base.flags.nightOwlVisited = true;
      recordVisitedLocation(base, "night_owl");
      addStreetReadEntry(base, "exploration", `${base.world.currentNeighborhoodId}:night_owl`);
      if (base.npc.mina.met) addStreetReadEntry(base, "social", "mina:visit");
      base.nightOwl.socialSessions += 1;
      growAtNightOwl(base);
      logEntry(base, state.npc.mina.met ? pickMinaLine(base) : "Mina looks up from the register and gives you enough time to introduce yourself.", "");
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
      // `attribute` is the pre-v1.10 argument name. The gym now dispatches an
      // activity, and bag work is the sensible default for anything that still
      // asks for a bare workout.
      const activityId = AttributeData.GYM_ACTIVITY_BY_ID[action.activity] ? action.activity : "bag_work";
      const available = activityAvailability(state).gym;
      if (!available.available || !Attributes.gymActivityAvailable(state, activityId)) return inputState;
      const details = gymSessionDetails(state, activityId);
      if (state.player.cash < details.cost) return inputState;
      const gym = base.world.locations.gym;
      recordVisitedLocation(base, "spenard_gym");
      if (gym.sessionDay !== base.run.day) { gym.sessionDay = base.run.day; gym.sessionsToday = 0; }
      base.player.cash -= details.cost;
      base.memberships.gym = true;
      gym.sessionsToday += 1;
      gym.activitySessions[activityId] = (gym.activitySessions[activityId] || 0) + 1;
      const improved = improveAttribute(base, details.activity.attribute, details.growth);
      if (improved) addStreetReadEntry(base, "exploration", `${base.world.currentNeighborhoodId}:training`);
      logEntry(base, `${details.activity.label} at the gym, $${details.cost}.`, "good");
      // Sparring is the fast lane and the only one that can send you home hurt.
      if (activityId === "sparring") {
        const injuryRoll = (stringHash(`${base.run.seed}:sparring:${base.run.day}:${base.run.slot}`) % 1000) / 1000;
        if (injuryRoll < AttributeData.SPARRING_INJURY_CHANCE) {
          base.player.health = clamp(base.player.health - AttributeData.SPARRING_INJURY_HEALTH, 0, 100);
          logEntry(base, "You caught one you did not see. Ice on the way home.", "bad");
        }
      }
      registerGymDay(base);
      return advanceRun(base, { reason: "TRAIN_ATTRIBUTE" });
    }
    // ---- The Nile ---------------------------------------------------------
    //
    // Ground floor. Thirty dollars and a part of the day buys back fifteen
    // health, which makes Selam the cheapest recovery in the run and the reason
    // a player finds the building before they find the room upstairs.
    if (action.type === "NILE_WELLNESS") {
      const access = nileAvailability(state).wellness;
      if (!access.available || state.player.cash < Nile.WELLNESS_COST) return inputState;
      const nile = base.world.locations.theNile;
      recordVisitedLocation(base, "the_nile");
      spendCash(base, Nile.WELLNESS_COST);
      base.player.health = clamp(base.player.health + Nile.WELLNESS_HEALTH, 0, 100);
      base.npc.selam.met = true;
      base.npc.selam.visits += 1;
      nile.activitySessions.nile_social = (nile.activitySessions.nile_social || 0) + 1;
      growAtNile(base, "nile_social", nile.activitySessions.nile_social - 1);
      // Showing up is the observation. Selam reads presence at +2 and she is the
      // one standing there, so this is how a regular becomes a regular.
      Exposure.recordObservation(base, "selam", {
        type: "presence", event: "wellness_regular", location: Nile.NILE_LOCATION_ID, source: "witnessed",
      });
      logEntry(base, "Steam, hot stones, and forty minutes of nobody wanting anything from you.", "good");
      maybeSelamBridge(base);
      maybeSelamIntel(base);
      registerNileDay(base, "charisma");
      return advanceRun(base, { reason: "NILE_WELLNESS" });
    }
    // Watching Biniam work the jebena. Free, costs a part of the day, and grows
    // Intelligence because what you are actually studying is a man who reads
    // people for a living and does not know he is teaching.
    if (action.type === "NILE_COFFEE") {
      const access = nileAvailability(state).coffee;
      if (!access.available) return inputState;
      const nile = base.world.locations.theNile;
      base.npc.biniam.met = true;
      base.npc.biniam.coffeeRounds += 1;
      nile.activitySessions.coffee_ceremony = (nile.activitySessions.coffee_ceremony || 0) + 1;
      growAtNile(base, "coffee_ceremony", nile.activitySessions.coffee_ceremony - 1);
      Exposure.recordObservation(base, "biniam", {
        type: "presence", event: "sat_and_watched", location: Nile.NILE_LOCATION_ID, source: "witnessed",
      });
      logEntry(base, "Three rounds, small cups, no sugar. You watch his hands more than the cards.", "good");
      registerNileDay(base, "intelligence");
      return advanceRun(base, { reason: "NILE_COFFEE" });
    }
    // Sitting down at a table. Both games deal here and resolve through their
    // own actions, because a hand is several decisions and the player is allowed
    // to put the phone down in the middle of one.
    if (action.type === "NILE_TONK_SIT" || action.type === "NILE_CELO_SIT") {
      const tonk = action.type === "NILE_TONK_SIT";
      const access = nileAvailability(state)[tonk ? "tonk" : "celo"];
      const buyIn = Math.floor(action.buyIn || 0);
      const floor = tonk ? Gambling.TONK_MIN_BUY_IN : Gambling.CELO_MIN_BUY_IN;
      const ceiling = tonk ? Gambling.TONK_MAX_BUY_IN : Gambling.CELO_MAX_BUY_IN;
      if (!access.available || buyIn < floor || buyIn > ceiling || state.player.cash < buyIn) return inputState;
      if (base.gambling.table || base.gambling.round) return inputState;
      recordVisitedLocation(base, "the_nile");
      base.npc.biniam.met = true;
      spendCash(base, buyIn);
      registerGameStart(base);
      if (tonk) {
        const table = GamblingEvents.dealTonk(base.run.seed, base.run.day, base.gambling.tonkGamesPlayed, 2);
        base.gambling.table = { ...table, buyIn, gameIndex: base.gambling.tonkGamesPlayed };
        logEntry(base, `You buy in for $${buyIn}. Five cards, two other players, and a discard face up.`, "good");
        return base;
      }
      const round = GamblingEvents.openCeloRound(base.run.seed, base.run.day, base.gambling.celoRoundsPlayed);
      base.gambling.round = { ...round, buyIn, bet: buyIn, adjusted: null, roundIndex: base.gambling.celoRoundsPlayed };
      logEntry(base, round.banker.kind === "no_result"
        ? "Three throws and the bank never landed on anything. The dice come to you."
        : `The bank sets on ${round.banker.dice.join("-")}.`, "good");
      return base;
    }
    // A Tonk turn: take the discard or the stock, then pitch one card. The
    // opponents answer in seat order, and either side can end the hand.
    if (action.type === "NILE_TONK_TURN") {
      const table = base.gambling.table;
      if (!table) return inputState;
      const hand = table.hands[0];
      if (action.draw === "discard" && table.discard.length) hand.push(table.discard.pop());
      else if (table.stock.length) hand.push(table.stock.shift());
      else return finishTonk(base, 0);
      const pitched = hand.find((card) => card.id === action.discardId) || hand[hand.length - 1];
      hand.splice(hand.indexOf(pitched), 1);
      table.discard.push(pitched);
      const { dropper } = GamblingEvents.runOpponentTurns(table);
      if (dropper != null) return finishTonk(base, dropper);
      // Stock exhausted ends it on the lowest hand, same as the table rule.
      if (!table.stock.length) return finishTonk(base, lowestTonkSeat(table));
      return base;
    }
    // Calling it. Drop with the lowest hand and the pot is yours; drop without
    // it and you pay double to whoever actually had it.
    if (action.type === "NILE_TONK_DROP") {
      if (!base.gambling.table) return inputState;
      return finishTonk(base, 0);
    }
    // Cee-lo: press, back off, or take the bet as it stands, then roll.
    if (action.type === "NILE_CELO_ROLL") {
      const round = base.gambling.round;
      if (!round) return inputState;
      const vision = GamblingEvents.celoVision(Attributes.effectiveAttribute(base, "intelligence"));
      const adjustment = vision.canAdjust && ["press", "back_off"].includes(action.adjust) ? action.adjust : null;
      const bet = Gambling.adjustedBet(round.buyIn, adjustment);
      // Pressing costs the difference up front. A player cannot press into money
      // they do not have.
      const extra = Math.max(0, bet - round.buyIn);
      if (extra > base.player.cash) return inputState;
      if (extra) spendCash(base, extra);
      // Backing off returns the half they are no longer risking.
      if (bet < round.buyIn) base.player.cash += round.buyIn - bet;
      const result = GamblingEvents.resolveCelo({
        seed: base.run.seed, day: base.run.day, round: round.roundIndex,
        bankerReading: round.banker, bet,
      });
      return finishCelo(base, { round, result, bet, adjustment });
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
      // v1.13: the fence has a name — Slide Okafor, a storage unit off Tudor
      // Road, strictly transactional. There is no somewhere else. Slide is
      // discreet: the sale reaches the household channel only.
      Exposure.broadcastObservation(base, { type: "financial", event: "fence_sale", channel: "household", value: payout, day: base.run.day });
      logEntry(base, `Slide looks at what you brought, quotes $${payout}, and takes the merchandise. There is no somewhere else.`, "good");
      return base;
    }
    if (action.type === "CASE_TARGET") {
      const target = STICK_TARGET_BY_ID[action.targetId];
      if (!base.rob?.visible || !target || target.tier < 2) return inputState;
      if (target.areaId !== base.world.currentNeighborhoodId) return inputState;
      const existing = stickCasing(base, target.id);
      if (existing && existing.timesObserved >= 2) return inputState;
      if (existing) existing.timesObserved += 1;
      else base.stick.casedTargets.push({ targetId: target.id, timesObserved: 1 });
      const observed = stickCasing(base, target.id).timesObserved;
      logEntry(base, observed === 1
        ? `You watch ${target.name} long enough to price it: $${target.take[0]}–$${target.take[1]} moving through.`
        : `Second pass at ${target.name}. You know the rhythm now.`, "");
      return advanceRun(base, { reason: "CASE_TARGET", suppressStory: true });
    }
    if (action.type === "STICKUP") {
      const availability = stickTargetAvailability(base, action.targetId);
      if (!availability.available) return inputState;
      const target = STICK_TARGET_BY_ID[action.targetId];
      reconcileCash(base);
      base.stats.robbery = normalizeRobberyStats(base.stats.robbery, base);
      const random = makeRandom(base.run.rngState);
      // v1.18: Tone at the confrontation is worth one effective level here too.
      // No combatWins credit: his tier gate counts fights somebody stood next to
      // him in, and walking into a store is not one of those.
      const stickBackup = Crew.combatAdvantageFor(base, "stick_target", target.id);
      const outcome = resolveOutcome(base, "robbery", availability.chance, `${base.run.seed}:stickup:${base.run.day}:${base.run.slot}:${target.id}`, stickBackup);
      const success = Attributes.isSuccessTier(outcome.tier);
      // Streak first: the Nth repeat in the same district inside two days is
      // the one the block was already talking about.
      recordRobberyActivity(base, target.areaId, {});
      const heatScale = (amount) => districtHeat(base, target.areaId, "stick", amount) * stickHeatMultiplier(base);
      base.stats.robbery.attempts += 1;
      base.stats.robbery.lastAttemptedDay = base.run.day;
      base.stats.robbery.attempted = true;
      const effects = [];
      let result;
      if (success) {
        const clean = outcome.tier === "clean";
        const take = random.int(target.take[0], target.take[1]);
        const addedHeat = heatScale(clean ? Math.max(1, target.heat - 1) : target.heat);
        if (target.tier === 1) base.player.cash += take;
        else addDirtyCash(base, take);
        base.player.heat = clamp(base.player.heat + addedHeat, 0, 15);
        base.stick.rep += 1;
        raiseCurtisAwareness(base, 2); // a successful robbery is loud in Curtis's world
        base.stats.robbery.successes += 1;
        base.stats.robbery.totalPayout += take;
        base.stats.robbery.success = true;
        base.stats.robbery.payout = base.stats.robbery.totalPayout;
        addStreetReadEntry(base, "risk", `stickup:${target.areaId}:${target.id}`);
        effects.push(`+$${take} ${target.tier === 1 ? "cash" : "dirty cash"}`, `+${Math.round(addedHeat * 10) / 10} Heat`);
        if (target.tier === 3) {
          base.stick.organizedHits += 1;
          if (base.stick.organizedHits >= 2) Exposure.recordObservation(base, "curtis", { type: "violence", event: "organized_hit", count: base.stick.organizedHits, source: "network" });
          if (target.id === "goodie_stash" && base.people.dealers?.goodie) {
            // Hitting the stash is hitting the man: supply dies for the rest
            // of the run and his people are guaranteed to come looking.
            base.people.dealers.goodie.supplyChoked = 7;
            base.people.dealers.goodie.retaliated = true;
            bumpPlugSuspicion(base, target.areaId, { direct: true, skipStandingFor: null });
            base.stick.retaliationQueue.push({ targetId: target.id, areaId: target.areaId, triggerDay: base.run.day + 2 });
            effects.push("Goodie's supply is gone for the run", "His people will come looking");
          }
        }
        if (target.retaliation > 0 && target.id !== "goodie_stash" && random.next() < target.retaliation) {
          base.stick.retaliationQueue.push({ targetId: target.id, areaId: target.areaId, triggerDay: base.run.day + 2 });
        }
        result = {
          kind: "robbery", tone: "good", title: clean ? "Quiet Take" : "Loud Take",
          summary: clean
            ? `${target.name} gives it up without a scene. You clear $${take} and the block keeps moving.`
            : `${target.name} gives it up, but not quietly. You clear $${take} and leave a description behind.`,
          effects,
        };
        broadcastOutcome(base, "robbery", outcome.tier, take);
      } else {
        const severe = outcome.tier === "catastrophic";
        const damage = random.int(target.tier === 1 ? 8 : target.tier === 2 ? 15 : 20, target.tier === 1 ? 15 : target.tier === 2 ? 26 : 40) + (severe ? 6 : 0);
        let addedHeat = heatScale(target.heat + (severe ? 1 : 0));
        if (random.next() < 0.30) { addedHeat += 1; effects.push("A witness got a good look"); }
        base.player.health = clamp(base.player.health - damage, 0, 100);
        base.player.heat = clamp(base.player.heat + addedHeat, 0, 15);
        base.stats.robbery.failures += 1;
        base.stats.robbery.success = base.stats.robbery.successes > 0;
        effects.unshift(`-${damage} Health`, `+${Math.round(addedHeat * 10) / 10} Heat`, "$0 taken");
        // v1.16: the v1.13 stub is gone. All three Stick tiers route into
        // arrestPlayer with their own severity. A blown job either goes badly
        // enough on its own (catastrophic) or is loud enough for the heat you
        // are already carrying — and the bigger the tier, the less heat it
        // takes for somebody to already be looking your way.
        const arrestHeatGate = target.tier === 1 ? 10 : target.tier === 2 ? 8 : 6;
        const arrested = severe || base.player.heat > arrestHeatGate;
        let arrestDetail = null;
        if (arrested) {
          arrestDetail = arrestPlayer(base, { severity: `stick${target.tier}`, source: "stick" });
          effects.push(
            arrestDetail.shortfall > 0
              ? `Booked. $${arrestDetail.paid} of $${arrestDetail.bail} bail, the rest served`
              : `Booked and released. $${arrestDetail.bail} bail`,
            `-${arrestDetail.heatRelief} Heat on the record`,
            `Prior arrests: ${arrestDetail.priors}`,
          );
        }
        result = {
          kind: "robbery", tone: "bad", title: severe ? "It Goes Wrong" : "It Falls Apart",
          summary: arrested
            ? `${target.name} does not go down, and the next set of hands on you has a badge. Processing eats the day.`
            : severe
              ? `${target.name} fights back harder than the plan allowed. You get out hurt, and somebody called it in.`
              : `${target.name} does not go down. You get away hurt and lighter than you came.`,
          effects,
        };
        broadcastOutcome(base, "robbery", outcome.tier);
        if (arrested) {
          updateStickTier(base);
          base.stats.majorDecisions.push(`Stickup ${target.id}: arrested`);
          recordBehavior(base, "stickup", 2, `stickup:${base.run.day}:${target.id}`, "rob");
          base.run.rngState = random.state;
          logEntry(base, result.summary, result.tone);
          const held = advanceRun(base, { reason: "STICKUP", suppressStory: true, timeCost: arrestDetail.processingSlots });
          if (held.run.status === "playing") held.run.pendingOperationResult = result;
          return held;
        }
      }
      updateStickTier(base);
      base.stats.majorDecisions.push(`Stickup ${target.id}: ${outcome.tier}`);
      recordBehavior(base, "stickup", 2, `stickup:${base.run.day}:${target.id}`, "rob");
      base.run.rngState = random.state;
      logEntry(base, result.summary, result.tone);
      const advanced = advanceRun(base, { reason: "STICKUP", suppressStory: true });
      if (advanced.run.status === "playing") advanced.run.pendingOperationResult = result;
      return advanced;
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
      // The clock moves first, then the scene opens - same shape as the boost
      // opportunity event. An encounter the slot roll already produced wins,
      // and the bust settles automatically rather than stacking.
      return openOrSettleBoostCaught(advanceRun(base, { reason: action.type }));
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
      const nileFound = rollNileDiscovery(base);
      const meetsGoodie = base.run.day >= 2 && !base.flags.goodieEncounterSeen;
      const meetsBoost = !meetsGoodie && !base.flags.boostOpportunitySeen && !base.boost.visible && (count === 0 || base.world.locations.gamblingKnown);
      if (!meetsBoost && !meetsGoodie && !jobDiscovered && !nileFound) {
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
        advanced.run.pendingEvent = firstBoostOpportunityEvent(advanced);
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
      spendCash(base, cost);
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
      // The outbound bus leg used a raw cash decrement while the TRAVEL leg home
      // used spendCash, so a Spenard/Downtown round trip left cash and the
      // dirty/clean split disagreeing. Both legs draw the same way now.
      const cost = access.cashCost;
      if (cost) spendCash(base, cost);
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
      if (amount >= 150) Exposure.recordObservation(base, "dre", { type: "financial", event: "paid_down", source: "witnessed" });
      base.stats.moneySpent.debt += amount;
      if (!base.lender.balance) {
        base.lender.status = "cleared";
        Exposure.recordObservation(base, "dre", { type: "financial", event: "loan_repaid", count: 2, source: "witnessed" }); base.lender.clearedAt = { day: base.run.day, slot: base.run.slot }; base.lender.afterPayoffOffer = "available";
        base.flags.drePaidEarly = base.run.day <= base.lender.dueDay;
      }
      base.lender.relationship = relationshipForLender(base);
      recordBehavior(base, "earner", amount >= 150 || !base.lender.balance ? 2 : 1, `dre_payment:${base.run.day}:${base.lender.paymentCount}`, "dre_payment");
      addStreetReadEntry(base, "social", "dre:payment");
      logEntry(base, base.lender.balance ? `Dre counts $${amount} behind the Mini-Mart. $${base.lender.balance} stays written on the note.` : "Dre counts the final stack, tears the note in half, and keeps one piece.", "good");
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
      // v1.18: the proof gate holds at the garage too. Without this, walking
      // into the base is a way around the whole thing.
      if (!crewRecruitmentEligible(state, person.id)) return inputState;
      if (person.id === "deshawn") crew.introduced = true;
      base.player.cash -= cost; crew.recruited = true; crew.status = "active"; crew.loyalty = Crew.clampLoyalty(crew.loyalty + 1); crew.recruitedDay = base.run.day; base.stats.moneySpent.crew += cost;
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
      // Read before the ownership write below, or this is never true (v1.24).
      // Nothing is stored for it: the sixth claim and the first differ only in
      // what the player already holds, which the board already knows.
      const isFirstClaim = controlledBlockCount(base) === 0;
      base.player.cash -= definition.claimCost;
      base.stats.moneySpent.base += definition.claimCost;
      const block = base.world.territoryBlocks[action.blockId];
      block.owner = "player";
      block.capturedDay = base.run.day;
      base.world.soldiers[occupier.id].blockId = action.blockId;
      block.soldiersAssigned.push(occupier.id);
      Exposure.recordObservation(base, "curtis", { type: "submission", event: "claimed_block", source: "network" });
      base.hustle.exposure.networkEscalation = true;
      refreshCurtisAttention(base);
      recordBehavior(base, "stickup", 2, `block:${action.blockId}`, "territory_expansion");
      addStreetReadEntry(base, "risk", `block_claim:${base.world.currentNeighborhoodId}`);
      if (isFirstClaim) {
        // The block hears that the player is in the territory game at all -
        // once, on the first corner, and never again. `location` is the
        // district and not the block: the neighborhood channel checks presence,
        // and NPC_PRESENCE_AREAS holds district ids, so a block id here would
        // filter every listener out and land in nobody's ledger. The block is
        // named where a player can read it - the card, the text, the feed.
        //
        // Curtis is not on this channel at all (NPC_CHANNELS), so this cannot
        // reach him; his copy is the `submission / claimed_block` row above.
        broadcastTracked(base, {
          type: "growth", event: "first_territory", channel: "neighborhood",
          location: HOME_DISTRICT_ID, value: 1, day: base.run.day, slot: base.run.slot,
        });
        // Deshawn is the one who would notice. When he is gone the block still
        // talks, it just has no name attached to it.
        const deshawn = base.people.crew.deshawn;
        const deshawnHere = Boolean(deshawn?.recruited && deshawn.status === "active");
        pushPhoneMessage(base,
          deshawnHere ? "Deshawn" : "Word Around Town",
          deshawnHere
            ? `You got one. ${definition.name}. That's not nothing. Now keep it.`
            : `${definition.name} is yours. Word travels fast around here.`);
        pushConsequence(base, `First one's yours. ${definition.name}. A soldier stands on it and the block knows. This is what the money was building toward.`, "good", "Your Corner");
      }
      logEntry(base, isFirstClaim
        ? `First corner claimed: ${definition.name}. Soldier posted. The neighborhood sees it. Curtis's people will too.`
        : `${definition.name} answers to your operation now. One soldier posts up immediately. Curtis's people will hear about it.`, "good");
      return advanceRun(base, { reason: "CLAIM_BLOCK" });
    }
    if (action.type === "VISIT_MINA") {
      if (!state.npc.mina.met || !nightOwlAvailability(state).available || state.npc.mina.lastConversationDay === state.run.day) return inputState;
      base.npc.mina.lastConversationDay = state.run.day;
      if (atLeastBand(base, "mina", BANDS.TRUSTED)) {
        const product = PRODUCTS[stringHash(`${base.run.seed}:mina-tip:${base.run.day}`) % PRODUCTS.length];
        base.effects.rumors.push({ id: `mina_${base.run.day}`, areaId: "north_star_lot", productId: product.id, reliable: true, text: `Mina passes along one reliable Spenard buyer tip for ${product.name}.`, expiresAt: slotNumber(base.run.day + 1, 0) });
      }
      logEntry(base, pickMinaLine(base), "good");
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
      if (!productId) return failedPurchase(base, null, "dealer");
      const unitPrice = Math.max(1, Math.round(tradeUnitPrices(state, productId).buy * (1 - actions.buy.discount)));
      const room = cargoCapacity(state) - cargoUsed(state);
      const units = Math.min(actions.buy.units, room, Math.floor(state.player.cash / unitPrice));
      if (units <= 0) return failedPurchase(base, productId, "dealer");
      base.player.cash -= unitPrice * units;
      applyEventEffect(base, { addProduct: { id: productId, qty: units, unitCost: unitPrice } }, random);
      record.standing = Math.min(5, record.standing + standingGain(record, record.standing, 1, "capped"));
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
      // v1.31: no day gate. Calling the final score is how a player chooses to
      // stop, and an open-ended run cannot tell them which day they are allowed
      // to want that. Preparing it still costs a part of the day, and it can
      // still only be prepared once.
      if (!allowed.includes(action.planId) || state.run.finalPlanPrepared) return inputState;
      base.run.finalPlan = action.planId; base.run.finalPlanPrepared = true;
      base.stats.majorDecisions.push(`Prepared final plan: ${action.planId}`);
      recordBehavior(base, "earner", 2, `final_plan:${action.planId}`, "day7_plan");
      logEntry(base, `The garage table is cleared for one final plan: ${action.planId.replace("_", " ")}.`, "warn");
      return advanceRun(base, { reason: "PREPARE_FINAL_PLAN" });
    }
    if (action.type === "EXECUTE_FINAL_PLAN") {
      // v1.31: executable whenever the plan is prepared, rather than on one
      // specific day. This is the "or choose to stop" half of the lose
      // condition, and it is the only ending the player controls.
      if (!state.run.finalPlan || state.run.pendingEncounter) return inputState;
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
      // v1.29: what ended it, how long you lasted, and what the run was worth
      // in the end. `netGain` is derived, not tracked - startingNetWorth has
      // been in stats since the beginning, so no new field and no schema bump.
      endCause: state.run.endCause || null,
      daysSurvived: state.run.day,
      netGain: netWorth(state) - state.stats.startingNetWorth,
      reachedCheckpoint: state.run.ending !== "nowhere_to_go" && state.run.ending !== "arrested" && state.run.ending !== "killed" && state.run.ending !== "base_lost",
      streetName: state.player.streetName || "Unnamed run",
      streetIdentity: streetIdentity(state), streetIdentityLabel: streetIdentity(state),
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

  // At most three priorities, ordered by severity. This is deliberately not a
  // task list — 907Hustle should never read like a checklist app. Three is the
  // ceiling the Home screen's Needs Attention block is laid out for; a fourth
  // row turns the section into a backlog.
  function homePriorities(state) {
    const out = [];
    const push = (id, label, detail, tone) => { if (out.length < 3 && !out.some((item) => item.id === id)) out.push({ id, label, detail, tone }); };
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
      day: state.run.day, runDays: "open", slot: state.run.slot, partLabel: SLOTS[state.run.slot],
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
      identity: streetIdentityView(state),
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
    SHOPLIFT: "Attempt Resolved", BOOST: "Boost Resolved", ASK_BOOST_WINDOW: "Window Learned", STICKUP: "Stickup Resolved", CASE_TARGET: "Target Cased", NILE_TONK_SIT: "Hand Resolved", NILE_CELO_SIT: "Round Resolved", NILE_WELLNESS: "Session Done", NILE_COFFEE: "Coffee Done", END_MARKET: "Market Visit Closed",
    SLEEP_HOME: "Night Passed", LAY_LOW: "Laid Low", HEAL: "Treatment Complete", ARRESTED: "Booked and Released",
    PAY_DEBT: "Payment Made", CLAIM_BLOCK: "Block Claimed",
    RECRUIT_SOLDIER: "Soldier Recruited", RECRUIT_CREW: "Crew Recruited", PROMOTE_LIEUTENANT: "Lieutenant Promoted",
    VISIT_BASE: "Garage Open", UPGRADE_BASE: "Upgrade Installed", BUY_GEAR: "Gear Acquired",
    ASSIGN_CREW: "Assignment Given", ELI_TEST_ROUTE: "Test Route Complete", LEASE_GARAGE: "Property Leased",
    VISIT_MINA: "Conversation Finished", VISIT_NIGHT_OWL: "Night Owl Visit", TALK_HOUSEHOLD: "Conversation Finished",
    APPLY_JOB: "Application Left", PAY_PHONE_BILL: "Phone Bill Paid", PAY_RENT: "Rent Paid",
    BUY_FROM_DEALER: "Deal Done", ASK_DEALER: "Word Passed", RESOLVE_EVENT: "Choice Made",
    ROB: "Rob Resolved", CONTACT_VISIT: "Visit Complete", BUY_LAPTOP: "Laptop Acquired",
    BUY_907LIST: "Meetup Done", DELIVER_907LIST: "Sale Closed", QUICK_SELL_907LIST: "Quick Sell Done",
    FILL_BUYER_REQUEST: "Request Filled", BUY_BULK_907LIST: "Lot Acquired",
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
    BANDS, bandFor, bandId, bandLabel, EXPOSURE_NPC_IDS,
    VERSION, RUN_DAYS, PRESSURE_DAYS, MAX_ENERGY, SLOTS, SAVE_KEY, LEGACY_SAVE_KEYS, PHONE_BILL, WEEKLY_RENT, HOME_DISTRICT_ID, DISTRICT_ACTIONS, WORKING_CAPITAL_RESERVE, GARAGE_DEPOSIT, PRODUCTS, NEIGHBORHOODS, BACKGROUNDS, STARTING_EDGES, GEAR, BASE_UPGRADES, CREW, TERRITORIES,
    STREET_NAME_MAX, DEFAULT_STREET_NAMES, ATTRIBUTE_DEFAULTS, ATTRIBUTES: AttributeData, attributeSystem: Attributes, sanitizeStreetName,
    CLASSIFICATIONS, EVENT_CHAINS, STORY_REGISTRY, DEALERS, ENTITY_REGISTRY, ENTITY_MATCH_ORDER, PLUGS, BOOST_TARGETS, STICK_TARGETS, DISTRICTS: Districts, SPENARD_JOBS, STARTER_JOB_IDS, JOB_APPROACHES, JOB_RANK_THRESHOLDS,
    NILE: Nile, GAMBLING: Gambling, gamblingEvents: GamblingEvents,
    LISTING_ITEMS, LISTING_CAPACITY, MARKET: Market, marketEvents: MarketEvents, NIGHT_OWL_REGULARS, NIGHT_OWL_BOARD, HOUSEHOLD_NPCS, SOCIAL_CONTACTS, STORY_CONTACTS, PHONE_INTEL, DOWNTOWN_CONTENT_STUBS, DOWNTOWN_AMBIENT,
    SPENARD_BLOCKS, SOLDIER_RECRUIT_COST, SOLDIER_BASE_CAPACITY, SOLDIER_CAPACITY_PER_BLOCK, SOLDIERS_PER_BLOCK_CAP,
    RAID_DEFENSE_PER_SOLDIER, TERRITORY: Territory, DISCLOSURES: Disclosures,
    TERRITORY_HEAT_CHANCE_PER_EXPOSURE, TERRITORY_HEAT_CHANCE_CAP, BLOCK_INTEL_LEVEL_COPY,
    SHARK_BORROWERS, SHARK_TERMS, DRE_MISSIONS, DRE_COLLECTOR_TIERS, ELI_LIEUTENANT_UNLOCK, RESPECT_STAGE_THRESHOLDS,
    Crew, Arrest, CREW_LOYALTY_MAX: Crew.CREW_LOYALTY_MAX, CREW_LOYALTY_START: Crew.CREW_LOYALTY_START, TIER_REQUIREMENTS: Crew.TIER_REQUIREMENTS,
    DISTRICT_CONTROL_TIERS, DISTRICT_CONTROL_CAPSTONE_BLOCKS, DISTRICT_CONTROL_LABEL, ELI_OPERATION_POLICIES,
    buildEventForTest: activeEvent, storyCandidatesForTest: storyCandidates,
    recordBehaviorForTest: recordBehavior,
    // v1.31. Ending SELECTION and ending TRIGGERING used to be testable in one
    // step, because a day count reliably ended a run and tests reached endings
    // by walking to Day 7 Night. With the terminator gone, the two are separate
    // concerns: chooseEnding is pure state -> ending and is what those tests
    // were always really asserting, while the paths that reach it (obligation,
    // health, Heat, the player's own final score) get their own coverage.
    endRunForTest: endRun,
    // v1.21: the nightly territory pass, reachable without driving a whole
    // CONFIRM_END_DAY. Isolating one Heat delta otherwise means fighting rent,
    // pressure, the Curtis settle, and the markets for it.
    resolveSoldierOperationsForTest: resolveSoldierOperations,
    // v1.23 gossip seams, so a test can drive one half of the pipeline without
    // running a whole day through the reducer.
    emitCurtisGossipWarningsForTest: emitCurtisGossipWarnings,
    emitRaidGossipForTest: emitRaidGossip,
    drainObservationsForTest: drainObservations,
    gossipAudienceForTest: gossipAudience,
    blockGateRollForTest: blockGateRoll,
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
      // Exposure reads. getDispositionBand is the gate every piece of content
      // now asks; describeDisposition is the dev inspector and is never shown
      // to a player.
      disposition: (state, npcId) => Exposure.getDisposition(npcId, state),
      dispositionBand: (state, npcId) => Exposure.getDispositionBand(npcId, state),
      describeDisposition: (state, npcId) => Exposure.describeDisposition(state, npcId),
      cargoUsed, cargoCapacity, storedCargoUsed, storageCapacity, storedCashCapacity, inventoryValue, netWorth,
      combatRating, charismaRating, intelligenceRating, derivedRatings,
      // Attribute reads. Players see attributeLabels; the raw numbers are for
      // the dev inspector only.
      attributes: (state) => normalizedAttributes(state),
      attributeLabels: (state) => Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, Attributes.attributeLabel(normalizedAttributes(state)[id])])),
      streetIdentity, streetIdentityView, identityProfile: (state) => Attributes.identityProfile(state),
      operationScore, baseValue, gearValue, heatBand, priceSignal, influenceLabel, encounterChoices, endingLabel,
      crewCapacityFor, gearShopStock, gearPrice, treatmentCost, debtGuidanceAvailable,
      recruitedCrew, getActiveCrew: Crew.getActiveCrew, curtisAwareness: (state) => curtisAwarenessOf(state), workingCapital, safeDebtPayment, debtPaymentPreview, featureAvailability, activityAvailability, layLowPreview, controlled, recruitmentCost, operationGearPower, crewPower,
      territoryPowerEstimate, territoryBenefits, tradeUnitPrices, tradeProjection, takeoverReadiness, robAvailability, eliTestRouteAvailability, minaThreatEligible,
      dealerRecord, dealerActions, dealerStandingLabel, dealerSupplyFactor,
      visibleMarketProducts, plugMaxUnits, unlockedPlugForProduct,
      visibleBoostTargets, boostTargetAvailability, boostChance, boostFenceRate, boostTier,
      visibleStickTargets, stickTargetAvailability, stickChance, stickTier, stickCasing, plugSuspicion, districtMods,
      controlledBlockCount, eliLieutenantActive, soldierCapacity, activeSoldierCount, blockSoldierCount, blockIntelVisible,
      // v1.20 Made Men modifiers. blockIntelLevel/blockIntelView are the pure
      // reads from src/selectors.js, re-exported here so the UI has one import.
      blockIntelLevel, blockIntelView, curtisBlockDefense, curtisBlockTargets,
      // v1.23: the plan behind the target list, with the pressure weights the
      // gossip surface reads. Same list, one level less flattened.
      curtisNightPlan,
      // v1.28: what the plan could not spend and is carrying, and whether he has
      // already taken a corner back once. Exposed for the harness and the tests
      // rather than for a screen — nothing in the UI reads either yet.
      curtisPressureBank, curtisPressureLeftover, curtisRetookBlock,
      toneDefenseMultiplier: Crew.toneDefenseMultiplier, deshawnHeatReduction: Crew.deshawnHeatReduction,
      territoryHeatChance, lieutenantTerritoryModifier,
      // v1.21: the two nightly gates, exposed the same way territoryHeatChance
      // is — so a Territory screen can show the player the same number the
      // night rolls against, for each adversary separately.
      policeRaidChance, curtisMoveChance,
      // v1.28: the Heat multiplier on the Curtis gate, separately readable so a
      // measurement can attribute loss rate to it rather than infer it.
      curtisHeatFactor,
      // v1.27: what the phone can sell, and what it costs. The offers list
      // mirrors the BUY_DISCLOSURE guards so a row is never rendered for a
      // dispatch the reducer would drop.
      disclosureOffers, disclosureAvailability, disclosureAskedToday, disclosurePayload,
      soldierRecruitAvailability, soldierAssignAvailability, blockClaimAvailability, eliPromotionAvailability,
      weeklyIncomeEstimate,
      dreTrustTier, dreIntroductionEligible, dreMissionAvailability, sharkUnlocked, sharkRiskLabel, sharkLoanAvailability,
      deshawnRecruitmentAvailability, toneRecruitmentAvailability, pherrisRecruitmentAvailability, crewRecruitmentEligible, warmNpcContactCount, crewTierAvailability, crewBailAvailability, arrestRecord,
      districtControlTier, districtHasBlockLayer, unassignedSoldiers,
      homeSituation, homeUnlocks, homePriorities, homeSummary, actionResult,
      juanWorkIntelKnown, jobRankForXp, jobPayRange, discoveredJobs, jobAvailability, quickShift, ambientFlavor, phoneIntel, knownWorkplaceContacts, knownSocialContacts, personalContacts, contactAvailability,
      districtActionAvailability, aroundActions, travelAvailability, householdPresence, nineZeroSevenListAccess,
      // The Nile. `nileAvailability` is the one read the two floors need; the
      // table reads exist so the UI can render a hand without the reducer.
      nileAvailability, nileAmbient, tonkView, celoView,
      nightOwlStashUsed, nightOwlStashAvailability, relationshipLabel,
      checkpointDay, weekZeroProgress, listingSlate, nightOwlBoardItems, nightOwlRegularFor, nightOwlAvailability, listingInventoryValue,
      // v1.9b broker track. marketOverview is the one read the 907List page
      // needs; the rest exist so tests and the simulator can ask a narrower
      // question without recomputing a tier gate slightly differently.
      marketTier, marketTierConfig, marketCapacity, marketOverview, marketMeetupDistrict, marketMeetupAvailability,
      marketCarriedValue, marketRobberyPreview, marketBulkDeal, marketRequests, requestFillCandidates, specialistCategory,
    },
  };
});
