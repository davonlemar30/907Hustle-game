const GAME_DAYS = 30;
const SAVE_KEY = "hustle907_save";

const TIME_SLOTS = ["Morning", "Afternoon", "Evening", "LateNight"];

const LOCATION_DEFS = {
  cousins_apt: {
    name: "Cousin's Apartment",
    district: "Home Block",
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Gritty pixel-style view of cousin's apartment with thin blinds and a worn couch.",
    text: "Cousin's apartment feels cramped and temporary. A duffel bag sits by the couch, cheap blinds leak cold light, and city noise pushes through thin windows.",
    description: "Safe enough to reset. Dre watches discipline and tracks how you move.",
    lockHint: "You're already home.",
    startsUnlocked: true,
  },
  apt_exterior: {
    name: "Apartment Exterior",
    district: "Home Block",
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Worn apartment exterior with a half-lit parking lot and old snow piles.",
    text: "The apartment exterior is a pressure valve between indoors and the street. Engines idle, people smoke, and news moves faster than text.",
    description: "Good place to listen without committing.",
    lockHint: "Step outside from home to unlock.",
    startsUnlocked: true,
  },
  corner_store: {
    name: "Corner Store",
    district: "Home Block",
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Small Anchorage corner store with bright signs and tired security glass.",
    text: "The corner store is bright, cramped, and overstocked with cheap food. Everyone stops here at least once a day.",
    description: "Low risk supply stop and rumor hub.",
    lockHint: "Talk to locals near the apartment first.",
    startsUnlocked: true,
  },
  bus_stop: {
    name: "Bus Stop",
    district: "Home Block",
    art: "assets/cousins-apt-placeholder.svg",
    alt: "A cold bus stop with route signs and frozen slush.",
    text: "The bus stop sits under buzzing lights. Shift workers, students, and hustlers all cross paths here.",
    description: "Cheap movement and overheard leads.",
    lockHint: "It's already on your local route.",
    startsUnlocked: true,
  },
  side_street: {
    name: "Side Street / Alley",
    district: "Home Block",
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Narrow side street with alley cut-through and chain-link fences.",
    text: "The side street and alley feel quiet until they don't. Escape lanes matter here.",
    description: "Useful cut-through; medium risk after dark.",
    lockHint: "Check the area near home to learn safe entry times.",
    startsUnlocked: false,
  },
  gas_station: {
    name: "Gas Station",
    district: "Home Block",
    art: "assets/cousins-apt-placeholder.svg",
    alt: "24-hour gas station under cold lights on a windy night.",
    text: "The gas station runs all night and attracts every type. Quick buys, quick talks, quick trouble.",
    description: "Night traffic, useful intel, watch for cameras.",
    lockHint: "Unlock by scouting routes around the block.",
    startsUnlocked: false,
  },
  north_star_lot: {
    name: "North Star Lot",
    district: "North Star Edge",
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Cold parking lot near North Star with cars idling in the dark.",
    text: "North Star Lot is quick money and quick pressure. Eyes on fences, engines running, everyone measuring everyone.",
    description: "First serious lane with better money and higher heat.",
    lockHint: "Dre must open your lane first.",
    startsUnlocked: false,
  },
  north_star_edge: {
    name: "North Star Entrance",
    district: "North Star Edge",
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Mall edge entrance with shuttered storefront lights.",
    text: "The mall edge stays half-alive after dark. Security patterns matter as much as people.",
    description: "Advanced starter-zone node for info and cleaner routes.",
    lockHint: "Earn trust at North Star Lot to unlock this edge.",
    startsUnlocked: false,
  },
};

const actionMenuTree = {
  Travel: {
    "Local Map": [],
    Destinations: [],
    "Return Home": ["Travel Home"],
    "Check Area": ["Check Area"],
  },
  People: [],
  Hustle: [],
  Market: [],
  Info: {
    Stats: ["Overview", "Street Pressure"],
    Inventory: ["Inventory", "Stash Count"],
    "Journal Notes": ["Journal"],
  },
  Rest: [],
};

const TREND_LABELS = {
  up: "More expensive than yesterday",
  down: "Cheaper than yesterday",
  stable: "Stable",
};

const LOCATION_ACTIONS = {
  cousins_apt: {
    identity: "Reset, stash, recover, and check in with Dre.",
    risk: "Low",
    categories: {
      People: ["Talk to Dre", "Check Messages", "Review Contacts"],
      Hustle: ["Plan a Route", "Find Cash", "Scope the Area"],
      Rest: ["Rest Up", "Recover", "Lay Low"],
      Market: ["Check Market Board"],
    },
  },
  apt_exterior: {
    identity: "Listen and move without drawing heat.",
    risk: "Low-Medium",
    categories: {
      People: ["Ask Around", "Check Messages"],
      Hustle: ["Find Cash", "Scope the Area", "Work a Shift"],
      Rest: ["Lay Low", "Wait"],
      Market: ["Check Market Board"],
    },
  },
  corner_store: {
    identity: "Legal supplies and low-noise rumors.",
    risk: "Low",
    categories: {
      People: ["Ask Around", "Check Messages"],
      Hustle: ["Work a Shift", "Find Cash"],
      Rest: ["Wait"],
      Market: ["Check Market Board", "Buy Store Snacks", "Buy Basic Meds"],
    },
  },
  bus_stop: {
    identity: "Transit chatter and low-paying shifts.",
    risk: "Low",
    categories: {
      People: ["Ask Around", "Check Messages"],
      Hustle: ["Work a Shift", "Find Cash", "Scope the Area"],
      Rest: ["Wait", "Lay Low"],
      Market: ["Check Market Board"],
    },
  },
  side_street: {
    identity: "Cut-through routes and quiet movement.",
    risk: "Medium",
    categories: {
      People: ["Ask Around"],
      Hustle: ["Run a Quick Move", "Scope the Area", "Find Cash"],
      Rest: ["Lay Low", "Wait"],
      Market: ["Check Market Board"],
    },
  },
  gas_station: {
    identity: "24-hour traffic, cameras, and shift cash.",
    risk: "Medium",
    categories: {
      People: ["Ask Around", "Check Messages"],
      Hustle: ["Work a Shift", "Find Cash", "Scope the Area"],
      Rest: ["Wait", "Lay Low"],
      Market: ["Check Market Board"],
    },
  },
  north_star_lot: {
    identity: "Street pressure, Mina access, and risky opportunities.",
    risk: "High",
    categories: {
      People: ["Check with Mina", "Ask Around", "Check Messages"],
      Hustle: ["Run a Quick Move", "Scope the Area", "Find Cash", "Lay Low"],
      Rest: ["Lay Low", "Wait"],
      Market: ["Check Market Board", "Ask Off-Menu Stock"],
    },
  },
  north_star_edge: {
    identity: "Cleaner approach lane near mall security patterns.",
    risk: "Medium",
    categories: {
      People: ["Ask Around", "Check Messages"],
      Hustle: ["Scope the Area", "Work a Shift", "Find Cash"],
      Rest: ["Lay Low", "Wait"],
      Market: ["Check Market Board"],
    },
  },
};

const MARKET_CATALOG = {
  store_snacks: {
    name: "Snacks",
    itemId: "snacks",
    price: 10,
    source: "corner_store",
    lane: "legal",
    trend: "stable",
  },
  store_meds: {
    name: "Basic Meds",
    itemId: "basic_meds",
    price: 15,
    source: "corner_store",
    lane: "legal",
    trend: "up",
  },
  mina_burner: {
    name: "Burner Phone",
    itemId: "burner_phone",
    price: 35,
    source: "mina",
    lane: "street",
    trend: "stable",
    requirements: { unlock_vendor: "mina" },
  },
  unknown_supply_1: {
    name: "Unknown Supply",
    source: "mina",
    lane: "off_menu",
    trend: "down",
    lockedLabel: "Unknown supply slot — need burner line",
    requirements: { unlock_product: "unknown_supply_1", flag_true: "has_burner_phone" },
  },
  hot_goods: {
    name: "Hot Goods (small electronics)",
    itemId: "hot_goods",
    price: 60,
    source: "mina",
    lane: "off_menu",
    trend: "up",
    requirements: {
      unlock_product: "hot_goods",
      flag_true: "hot_goods_lane_unlocked",
      relationship_gte: { mina_trust: 1 },
    },
  },
};

function createOpeningState() {
  return {
    playerName: "",
    day: 1,
    timeOfDay: "Morning",
    location: "cousins_apt",
    money: 200,
    health: 100,
    reputation: 0,
    heat: 0,
    inventory: {
      snacks: 0,
      basic_meds: 0,
      burner_phone: 0,
      hot_goods: 0,
    },
    relationships: {
      dre_trust: 0,
      mina_trust: 0,
    },
    flags: {
      met_mina: false,
      hot_goods_lane_unlocked: false,
    },
    metrics: {
      risky_actions_on_lot: 0,
    },
    unlocks: {
      events: {
        house_rules: true,
      },
      locations: {
        cousins_apt: true,
        apt_exterior: true,
        corner_store: true,
        bus_stop: true,
      },
      vendors: {},
      products: {},
    },
    eventState: {
      seen: {},
      completed: {},
      lastTriggeredDay: {},
      cooldowns: {},
      activeEventId: null,
    },
  };
}

function createUiState() {
  return {
    actionPath: [],
    overlays: {
      actions: false,
      journal: false,
      scene: false,
      menu: false,
    },
    log: [],
    awaitingContinue: false,
    pendingResult: null,
    pendingEvent: null,
    gameOver: false,
  };
}

const state = createOpeningState();
const uiState = createUiState();

const el = {
  startScreen: document.getElementById("startScreen"),
  gameScreen: document.getElementById("gameScreen"),
  endScreen: document.getElementById("endScreen"),
  playerName: document.getElementById("playerName"),
  startGameBtn: document.getElementById("startGameBtn"),
  hudPrimary: document.getElementById("hudPrimary"),
  hudStats: document.getElementById("hudStats"),
  menuToggleBtn: document.getElementById("menuToggleBtn"),
  openActionsBtn: document.getElementById("openActionsBtn"),
  openJournalBtn: document.getElementById("openJournalBtn"),
  openSceneBtn: document.getElementById("openSceneBtn"),
  actionsSheet: document.getElementById("actionsSheet"),
  actionsTitle: document.getElementById("actionsTitle"),
  actionsPanel: document.getElementById("actionsPanel"),
  actionsBackBtn: document.getElementById("actionsBackBtn"),
  closeActionsBtn: document.getElementById("closeActionsBtn"),
  journalOverlay: document.getElementById("journalOverlay"),
  closeJournalBtn: document.getElementById("closeJournalBtn"),
  sceneOverlay: document.getElementById("sceneOverlay"),
  closeSceneBtn: document.getElementById("closeSceneBtn"),
  menuOverlay: document.getElementById("menuOverlay"),
  closeMenuBtn: document.getElementById("closeMenuBtn"),
  sceneArt: document.getElementById("sceneArt"),
  sceneText: document.getElementById("sceneText"),
  storyTitle: document.getElementById("storyTitle"),
  storyText: document.getElementById("storyText"),
  choiceButtons: document.getElementById("choiceButtons"),
  detailTitle: document.getElementById("detailTitle"),
  detailPanel: document.getElementById("detailPanel"),
  saveBtn: document.getElementById("saveBtn"),
  loadBtn: document.getElementById("loadBtn"),
  restartBtn: document.getElementById("restartBtn"),
  outcomeSummary: document.getElementById("outcomeSummary"),
  finalStats: document.getElementById("finalStats"),
  playAgainBtn: document.getElementById("playAgainBtn"),
};

const V01_EVENTS = [
  {
    id: "house_rules",
    title: "House Rules",
    text: "Dre lays out house rules: stay disciplined, stay reachable, and build clean before you build loud.",
    location: "cousins_apt",
    repeatable: false,
    cooldownDays: 0,
    requirements: {
      day_eq: 1,
      time_in: ["Morning"],
      event_not_seen: true,
    },
    choices: [
      {
        id: "listen_agree",
        label: "Listen and agree",
        outcomeText: "You listen close. Dre nods and opens the lane to North Star.",
        outcome: {
          reputation: 1,
          relationships: { dre_trust: 1 },
          flags: { dre_rules_heard: true, dre_safe_tip_unlocked: true },
          unlocks: [
            { type: "unlock_location", target: "north_star_lot" },
          ],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "push_back",
        label: "Push back a little",
        outcomeText: "You push a little, but hear him out enough to get the lane.",
        outcome: {
          flags: { dre_rules_heard: true },
          unlocks: [{ type: "unlock_location", target: "north_star_lot" }],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "brush_off",
        label: "Brush him off and leave",
        outcomeText: "You brush him off and walk. Word spreads fast.",
        outcome: {
          reputation: -1,
          flags: { dre_rules_heard: true },
          unlocks: [{ type: "unlock_location", target: "north_star_lot" }],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
    ],
  },
  {
    id: "first_purchase",
    title: "First Purchase",
    text: "Mina gives you two starter options. Pick one and show you're serious.",
    location: "north_star_lot",
    repeatable: false,
    cooldownDays: 0,
    requirements: {
      unlock_location: "north_star_lot",
      time_in: ["Morning", "Afternoon", "Evening"],
      event_not_seen: true,
    },
    choices: [
      {
        id: "buy_snacks",
        label: "Buy snacks for $10",
        requirements: { money_gte: 10 },
        outcomeText: "You buy snacks and Mina starts treating you like a regular.",
        outcome: {
          money: -10,
          inventory: { snacks: 1 },
          relationships: { mina_trust: 1 },
          flags: { met_mina: true },
          unlocks: [
            { type: "unlock_vendor", target: "mina" },
            { type: "unlock_event", target: "burner_line" },
            { type: "unlock_location", target: "north_star_edge" },
          ],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "buy_meds",
        label: "Buy basic meds for $15",
        requirements: { money_gte: 15 },
        outcomeText: "You buy basic meds and Mina clocks you as prepared.",
        outcome: {
          money: -15,
          inventory: { basic_meds: 1 },
          relationships: { mina_trust: 1 },
          flags: { met_mina: true },
          unlocks: [
            { type: "unlock_vendor", target: "mina" },
            { type: "unlock_event", target: "burner_line" },
            { type: "unlock_location", target: "north_star_edge" },
          ],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "ask_off_menu",
        label: "Ask what she has off-menu",
        outcomeText: "Mina gives you a look and files your name away.",
        outcome: {
          flags: { met_mina: true },
          unlocks: [
            { type: "unlock_vendor", target: "mina" },
            { type: "unlock_event", target: "burner_line" },
            { type: "unlock_location", target: "north_star_edge" },
          ],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "observe_leave",
        label: "Observe and leave",
        outcomeText: "You observe the lot and dip without buying.",
        outcome: { timeAdvance: 1 },
        meta: { isRiskyAction: false },
      },
    ],
  },
  {
    id: "burner_line",
    title: "Burner Line",
    text: "Mina asks if you're ready to run a clean communication line.",
    location: "north_star_lot",
    repeatable: false,
    cooldownDays: 0,
    requirements: {
      unlock_event: "burner_line",
      time_in: ["Afternoon", "Evening"],
      flag_false: "mina_refuses_service",
      event_not_seen: true,
    },
    choices: [
      {
        id: "buy_burner",
        label: "Buy the burner for $35",
        requirements: { money_gte: 35 },
        outcomeText: "You buy a clean burner and Mina lowers her voice.",
        outcome: {
          money: -35,
          inventory: { burner_phone: 1 },
          flags: { has_burner_phone: true },
          unlocks: [
            { type: "unlock_event", target: "minas_quiet_suggestion" },
            { type: "unlock_product", target: "unknown_supply_1" },
          ],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "hold_one",
        label: "Ask Mina to hold one for later",
        outcomeText: "Mina agrees to hold one and tells you to come quiet.",
        outcome: {
          flags: { mina_holds_burner: true },
          unlocks: [{ type: "unlock_event", target: "minas_quiet_suggestion" }],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "skip",
        label: "Skip it",
        outcomeText: "You pass on the burner for now.",
        outcome: { timeAdvance: 1 },
        meta: { isRiskyAction: false },
      },
    ],
  },
  {
    id: "minas_quiet_suggestion",
    title: "Mina's Quiet Suggestion",
    text: "Mina offers a short route that only works if you stay patient.",
    location: "north_star_lot",
    repeatable: false,
    cooldownDays: 0,
    requirements: {
      unlock_event: "minas_quiet_suggestion",
      time_in: ["Evening", "LateNight"],
      flag_true: "met_mina",
      flag_false: "mina_refuses_service",
      any_of: [{ relationship_gte: { mina_trust: 1 } }, { money_gte: 20 }],
    },
    choices: [
      {
        id: "pay_for_lead",
        label: "Pay $20 for the lead",
        requirements: { money_gte: 20 },
        outcomeText: "You pay Mina and she hands over a quick job lead.",
        outcome: {
          money: -20,
          flags: { mina_quick_job_hint_unlocked: true },
          unlocks: [{ type: "unlock_event", target: "quick_lot_run" }],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "ask_good_faith",
        label: "Ask for the lead on good faith",
        outcomeText: "You ask Mina to trust you on this one.",
        outcome: {
          conditional: [
            {
              if: { relationship_gte: { mina_trust: 1 } },
              then: {
                flags: { mina_quick_job_hint_unlocked: true },
                unlocks: [{ type: "unlock_event", target: "quick_lot_run" }],
              },
              else: {
                reputation: -1,
              },
            },
          ],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "decline",
        label: "Decline",
        outcomeText: "You decline and keep your options open.",
        outcome: { timeAdvance: 1 },
        meta: { isRiskyAction: false },
      },
    ],
  },
  {
    id: "quick_lot_run",
    title: "Quick Lot Run",
    text: "A fast lot window opens for ten minutes. Move now or miss it.",
    location: "north_star_lot",
    repeatable: true,
    cooldownDays: 1,
    requirements: {
      unlock_event: "quick_lot_run",
      time_in: ["Evening", "LateNight"],
      item_gte: { burner_phone: 1 },
      heat_lte: 5,
    },
    choices: [
      {
        id: "run_clean",
        label: "Run it clean",
        outcomeText: "You keep it clean and get out with cash.",
        outcome: {
          moneyRange: { min: 60, max: 90 },
          reputation: 1,
          heat: 1,
          conditional: [
            {
              if: { flag_true: "rook_hostile" },
              then: {
                heat: 1,
                health: -5,
              },
            },
          ],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: true },
      },
      {
        id: "rush_it",
        label: "Rush it for extra cash",
        outcomeText: "You rush for extra cash and take on extra pressure.",
        outcome: {
          moneyRange: { min: 90, max: 120 },
          reputation: 1,
          heat: 2,
          conditional: [
            {
              if: { flag_true: "rook_hostile" },
              then: {
                heat: 1,
                health: -5,
                flags: { rook_humiliated: true },
              },
            },
          ],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: true },
      },
      {
        id: "pass_for_now",
        label: "Pass for now",
        outcomeText: "You pass and wait for a cleaner window.",
        outcome: { timeAdvance: 1 },
        meta: { isRiskyAction: false },
      },
    ],
  },
  {
    id: "rook_sizes_you_up",
    title: "Rook Sizes You Up",
    text: "Rook catches your eye at the lot fence and tests whether you're pressure-ready.",
    location: "north_star_lot",
    repeatable: false,
    cooldownDays: 0,
    requirements: {
      metric_between: { risky_actions_on_lot: { min: 1, max: 2 } },
      flag_false: "met_rook",
    },
    choices: [
      {
        id: "respectful",
        label: "Keep it respectful",
        outcomeText: "You keep it respectful and Rook gives a warning, not a problem.",
        outcome: {
          flags: { met_rook: true, rook_warned_player: true },
          timeAdvance: 1,
        },
        meta: { isRiskyAction: true },
      },
      {
        id: "offer_snacks",
        label: "Offer him snacks and smooth it over",
        requirements: { item_gte: { snacks: 1 } },
        outcomeText: "You hand him snacks and smooth it over.",
        outcome: {
          inventory: { snacks: -1 },
          reputation: 1,
          flags: { met_rook: true, rook_warned_player: true },
          timeAdvance: 1,
        },
        meta: { isRiskyAction: true },
      },
      {
        id: "stand_ground",
        label: "Stand your ground",
        outcomeText: "You stand your ground and the whole lot feels it.",
        outcome: {
          reputation: 1,
          heat: 1,
          flags: { met_rook: true, rook_warned_player: true },
          timeAdvance: 1,
        },
        meta: { isRiskyAction: true },
      },
      {
        id: "mouth_off",
        label: "Mouth off",
        outcomeText: "You mouth off and make an enemy.",
        outcome: {
          heat: 2,
          health: -5,
          flags: { met_rook: true, rook_hostile: true },
          timeAdvance: 1,
        },
        meta: { isRiskyAction: true },
      },
    ],
  },
  {
    id: "dre_checks_your_face",
    title: "Dre Checks Your Face",
    text: "Back at the apartment, Dre checks your condition and how hot you've become.",
    location: "cousins_apt",
    repeatable: true,
    cooldownDays: 1,
    requirements: {
      flag_true: "dre_rules_heard",
      any_of: [{ heat_gte: 3 }, { health_lt: 95 }],
    },
    choices: [
      {
        id: "tell_truth",
        label: "Tell Dre straight up",
        outcomeText: "You tell Dre the truth.",
        outcome: {
          conditional: [
            {
              if: { heat_lt: 5 },
              then: { relationships: { dre_trust: 1 } },
            },
          ],
          flags: { dre_safe_tip_unlocked: true, told_dre_truth_once: true },
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "downplay",
        label: "Downplay it",
        outcomeText: "You downplay what happened.",
        outcome: {
          conditional: [
            {
              if: { any_of: [{ heat_gte: 5 }, { health_lt: 95 }] },
              then: {
                relationships: { dre_trust: -1 },
                flags: { dre_disappointed: true },
              },
            },
          ],
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
      {
        id: "patch_up_first",
        label: "Patch yourself up first",
        requirements: { item_gte: { basic_meds: 1 } },
        outcomeText: "You patch yourself up first.",
        outcome: {
          inventory: { basic_meds: -1 },
          health: 10,
          timeAdvance: 1,
        },
        meta: { isRiskyAction: false },
      },
    ],
  },
];

const EVENT_BY_ID = Object.fromEntries(V01_EVENTS.map((event) => [event.id, event]));

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function locationName(locationId) {
  return LOCATION_DEFS[locationId]?.name || locationId;
}

function allLocationIds() {
  return Object.keys(LOCATION_DEFS);
}

function unlockedLocationIds() {
  return allLocationIds().filter((locationId) => !!state.unlocks.locations[locationId]);
}

function inventoryCount() {
  return Object.values(state.inventory).reduce((sum, qty) => sum + qty, 0);
}

function addLog(text, tone = "") {
  uiState.log.unshift({ day: state.day, text, tone });
  uiState.log = uiState.log.slice(0, 80);
}

function advanceTimeBy(slots = 1) {
  for (let i = 0; i < slots; i += 1) {
    const idx = TIME_SLOTS.indexOf(state.timeOfDay);
    const safeIndex = idx < 0 ? 0 : idx;
    if (safeIndex === TIME_SLOTS.length - 1) {
      state.timeOfDay = TIME_SLOTS[0];
      state.day += 1;
    } else {
      state.timeOfDay = TIME_SLOTS[safeIndex + 1];
    }
  }
}

function clampBoundedStats() {
  state.money = Math.max(0, state.money);
  state.health = clamp(state.health, 0, 100);
  state.heat = clamp(state.heat, 0, 100);
  state.reputation = clamp(state.reputation, -10, 10);
  state.relationships.dre_trust = clamp(state.relationships.dre_trust || 0, 0, 5);
  state.relationships.mina_trust = clamp(state.relationships.mina_trust || 0, 0, 5);
}

function applyUnlock(unlock) {
  if (!unlock?.type || !unlock.target) return;
  if (unlock.type === "unlock_event") state.unlocks.events[unlock.target] = true;
  if (unlock.type === "unlock_location") state.unlocks.locations[unlock.target] = true;
  if (unlock.type === "unlock_vendor") state.unlocks.vendors[unlock.target] = true;
  if (unlock.type === "unlock_product") state.unlocks.products[unlock.target] = true;
}

function evaluateAnyOf(anyOf = []) {
  return anyOf.some((condition) => evaluateRequirements(condition));
}

function evaluateRequirements(requirements = {}) {
  if (requirements.day_eq !== undefined && state.day !== requirements.day_eq) return false;
  if (requirements.time_in && !requirements.time_in.includes(state.timeOfDay)) return false;
  if (requirements.money_gte !== undefined && state.money < requirements.money_gte) return false;
  if (requirements.heat_lte !== undefined && state.heat > requirements.heat_lte) return false;
  if (requirements.heat_gte !== undefined && state.heat < requirements.heat_gte) return false;
  if (requirements.heat_lt !== undefined && state.heat >= requirements.heat_lt) return false;
  if (requirements.health_lt !== undefined && state.health >= requirements.health_lt) return false;

  if (requirements.event_not_seen && (state.eventState.seen[requirements.event_not_seen] || 0) > 0) {
    return false;
  }

  if (requirements.item_gte) {
    const hasItems = Object.entries(requirements.item_gte).every(
      ([item, needed]) => (state.inventory[item] || 0) >= needed,
    );
    if (!hasItems) return false;
  }

  if (requirements.relationship_gte) {
    const ok = Object.entries(requirements.relationship_gte).every(
      ([person, needed]) => (state.relationships[person] || 0) >= needed,
    );
    if (!ok) return false;
  }

  if (requirements.unlock_event && !state.unlocks.events[requirements.unlock_event]) return false;
  if (requirements.unlock_location && !state.unlocks.locations[requirements.unlock_location]) return false;
  if (requirements.unlock_vendor && !state.unlocks.vendors[requirements.unlock_vendor]) return false;
  if (requirements.unlock_product && !state.unlocks.products[requirements.unlock_product]) return false;

  if (requirements.flag_true && state.flags[requirements.flag_true] !== true) return false;
  if (requirements.flag_false && state.flags[requirements.flag_false] === true) return false;

  if (requirements.metric_between) {
    const ok = Object.entries(requirements.metric_between).every(([metricId, range]) => {
      const value = state.metrics[metricId] || 0;
      if (range.min !== undefined && value < range.min) return false;
      if (range.max !== undefined && value > range.max) return false;
      return true;
    });
    if (!ok) return false;
  }

  if (requirements.any_of && !evaluateAnyOf(requirements.any_of)) return false;

  return true;
}

function requirementHint(requirements = {}) {
  if (!requirements || Object.keys(requirements).length === 0) return "Unavailable right now.";
  if (requirements.money_gte !== undefined) return `Need $${requirements.money_gte}.`;
  if (requirements.item_gte) {
    const [item, qty] = Object.entries(requirements.item_gte)[0];
    return `Need ${qty} ${item.replaceAll("_", " ")}.`;
  }
  if (requirements.relationship_gte) {
    const [person, qty] = Object.entries(requirements.relationship_gte)[0];
    return `Need ${person.replaceAll("_", " ")} trust ${qty}+`;
  }
  return "Progress further to unlock this choice.";
}

function isEventOnCooldown(eventId) {
  return (state.eventState.cooldowns[eventId] || 0) > state.day;
}

function getEligibleEvent() {
  if (uiState.gameOver || uiState.awaitingContinue) return null;

  return V01_EVENTS.find((event) => {
    if (!event) return false;
    if (!event.repeatable && state.eventState.completed[event.id]) return false;
    if (event.location && event.location !== state.location) return false;
    if (event.requiresUnlock && !state.unlocks.events[event.id]) return false;
    if (isEventOnCooldown(event.id)) return false;
    return evaluateRequirements({
      ...(event.requirements || {}),
      ...(event.requirements?.event_not_seen ? { event_not_seen: event.id } : {}),
    });
  });
}

function presentEvent(event) {
  state.eventState.activeEventId = event.id;
  state.eventState.seen[event.id] = (state.eventState.seen[event.id] || 0) + 1;
  state.eventState.lastTriggeredDay[event.id] = state.day;

  uiState.pendingEvent = {
    id: event.id,
    title: event.title,
    choices: event.choices || [],
    awaitingChoice: true,
  };

  uiState.pendingResult = {
    text: `[${event.title}] ${event.text}`,
    tone: "",
  };
  uiState.awaitingContinue = true;
}

function resolveAction(text, tone = "", options = {}) {
  const { skipAdvanceTime = false } = options;
  addLog(text, tone);

  if (!skipAdvanceTime) advanceTimeBy(1);

  clampBoundedStats();
  uiState.pendingResult = { text, tone };
  uiState.awaitingContinue = true;

  const event = getEligibleEvent();
  if (event) presentEvent(event);

  endOfActionCheck();
}

function applyOutcomeInOrder(event, choice) {
  const applyOutcomeChunk = (outcome = {}) => {
    if (outcome.money) state.money += outcome.money;
    if (outcome.moneyRange) state.money += randomInt(outcome.moneyRange.min, outcome.moneyRange.max);
    if (outcome.health) state.health += outcome.health;
    if (outcome.reputation) state.reputation += outcome.reputation;
    if (outcome.heat) state.heat += outcome.heat;

    if (outcome.inventory) {
      Object.entries(outcome.inventory).forEach(([itemId, delta]) => {
        state.inventory[itemId] = (state.inventory[itemId] || 0) + delta;
        if (state.inventory[itemId] < 0) state.inventory[itemId] = 0;
      });
    }

    if (outcome.relationships) {
      Object.entries(outcome.relationships).forEach(([person, delta]) => {
        state.relationships[person] = (state.relationships[person] || 0) + delta;
      });
    }

    if (outcome.flags) {
      Object.entries(outcome.flags).forEach(([flag, value]) => {
        state.flags[flag] = value;
      });
    }

    (outcome.unlocks || []).forEach(applyUnlock);
  };

  const outcome = choice.outcome || {};

  // 1) stat/item changes
  applyOutcomeChunk(outcome);
  (outcome.conditional || []).forEach((entry) => {
    if (evaluateRequirements(entry.if || {})) {
      applyOutcomeChunk(entry.then || {});
    } else if (entry.else) {
      applyOutcomeChunk(entry.else || {});
    }
  });

  // 5) time advancement
  advanceTimeBy(outcome.timeAdvance || 0);

  // 6) risky-action metric increment
  if (state.location === "north_star_lot" && choice.meta?.isRiskyAction) {
    state.metrics.risky_actions_on_lot = (state.metrics.risky_actions_on_lot || 0) + 1;
  }

  // 7) clamp bounded stats
  clampBoundedStats();

  if (!event.repeatable) state.eventState.completed[event.id] = true;
  state.eventState.cooldowns[event.id] = state.day + (event.cooldownDays || 0);
  state.eventState.activeEventId = null;
}

function resolveEventChoice(eventId, choiceId) {
  const event = EVENT_BY_ID[eventId];
  if (!event || uiState.pendingEvent?.id !== eventId) return;

  const choice = (event.choices || []).find((entry) => entry.id === choiceId);
  if (!choice || !evaluateRequirements(choice.requirements || {})) return;

  const priorText = uiState.pendingResult?.text || "";
  applyOutcomeInOrder(event, choice);

  addLog(`[${event.title}] ${choice.outcomeText}`, "good");

  uiState.pendingResult = {
    text: `${priorText}\n\n${choice.outcomeText}`.trim(),
    tone: choice.outcome?.heat > 0 ? "bad" : "good",
  };
  uiState.pendingEvent = {
    id: eventId,
    title: event.title,
    choices: [],
    awaitingChoice: false,
  };

  render();
}

function clearResultAndReturnToHub() {
  uiState.awaitingContinue = false;
  uiState.pendingResult = null;
  uiState.pendingEvent = null;

  const followUp = getEligibleEvent();
  if (followUp) {
    presentEvent(followUp);
  }

  render();
}

function closeAllOverlays() {
  uiState.overlays.actions = false;
  uiState.overlays.journal = false;
  uiState.overlays.scene = false;
  uiState.overlays.menu = false;
}

function openOverlay(name) {
  closeAllOverlays();
  if (uiState.overlays[name] !== undefined) uiState.overlays[name] = true;
  if (name === "actions") uiState.actionPath = [];
  render();
}

function closeOverlay(name) {
  if (uiState.overlays[name] !== undefined) uiState.overlays[name] = false;
  render();
}

function renderHud() {
  el.hudPrimary.textContent = `Day ${state.day} · ${state.timeOfDay} · ${locationName(state.location)}`;
  el.hudStats.innerHTML = [
    `Cash $${state.money}`,
    `Health ${state.health}`,
    `Rep ${state.reputation}`,
    `Heat ${state.heat}`,
  ]
    .map((chip) => `<span class="hud-chip">${chip}</span>`)
    .join("");
}

function renderScene() {
  const scene = LOCATION_DEFS[state.location] || LOCATION_DEFS.cousins_apt;
  const profile = locationProfile(state.location);
  el.sceneArt.src = scene.art;
  el.sceneArt.alt = scene.alt;
  el.sceneText.textContent = `${scene.text}\n\nRole: ${profile.identity}\nRisk profile: ${profile.risk}`;
}

function getActionNode() {
  let node = actionMenuTree;
  for (const step of uiState.actionPath) {
    if (node && typeof node === "object" && !Array.isArray(node) && step in node) {
      node = node[step];
    } else {
      return actionMenuTree;
    }
  }
  return node;
}

function locationProfile(locationId = state.location) {
  return LOCATION_ACTIONS[locationId] || {
    identity: "Keep moving and read the room.",
    risk: "Unknown",
    categories: { People: [], Hustle: [], Rest: [], Market: ["Check Market Board"] },
  };
}

function buildDynamicActionEntries(category) {
  const profile = locationProfile(state.location);
  const actionIds = profile.categories[category] || [];
  return actionIds.map((actionId) => {
    if (actionId === "Review Contacts") {
      const hasContacts = state.flags.met_mina || state.relationships.mina_trust > 0;
      return {
        id: actionId,
        label: hasContacts ? actionId : "Review Contacts (locked)",
        disabled: !hasContacts,
        hint: hasContacts ? "" : "Locked until you build street contacts.",
      };
    }

    if (actionId === "Run a Quick Move") {
      const unlocked = !!state.unlocks.events.quick_lot_run || !!state.flags.mina_quick_job_hint_unlocked;
      return {
        id: actionId,
        label: unlocked ? actionId : "Run a Quick Move (locked)",
        disabled: !unlocked,
        hint: unlocked ? "" : "Need Mina's quiet route first.",
      };
    }

    return { id: actionId, label: actionId, disabled: false, hint: "" };
  });
}

function getMarketBoardEntries() {
  const entries = [];
  const atCornerStore = state.location === "corner_store";
  const aroundNorthStar = state.location === "north_star_lot" || state.location === "north_star_edge";

  Object.entries(MARKET_CATALOG).forEach(([stockId, stock]) => {
    const visible =
      (atCornerStore && stock.source === "corner_store") ||
      (aroundNorthStar && stock.source === "mina");
    if (!visible) return;

    const unlocked = evaluateRequirements(stock.requirements || {});
    entries.push({
      stockId,
      unlocked,
      line: unlocked
        ? `${stock.name} · $${stock.price || "?"} · ${TREND_LABELS[stock.trend] || "Stable"}`
        : `${stock.lockedLabel || `${stock.name} (locked)`}`,
      lane: stock.lane,
    });
  });

  if (!entries.length) {
    entries.push({
      stockId: "none",
      unlocked: false,
      line: "No known stock at this location yet.",
      lane: "info",
    });
  }

  return entries;
}

function renderActionsMenu() {
  const node = getActionNode();
  const atRoot = uiState.actionPath.length === 0;
  const pathKey = uiState.actionPath.join(">");
  el.actionsTitle.textContent = atRoot ? "Actions" : uiState.actionPath.join(" › ");
  el.actionsBackBtn.disabled = atRoot;
  el.actionsPanel.innerHTML = "";

  if (pathKey === "Travel>Local Map" || pathKey === "Travel>Destinations") {
    const mapNote = document.createElement("div");
    mapNote.className = "travel-note";
    const current = LOCATION_DEFS[state.location];
    mapNote.innerHTML = `<strong>Current:</strong> ${current?.name || state.location} · <span class="muted">${current?.district || "Anchorage"}</span>`;
    el.actionsPanel.appendChild(mapNote);

    if (pathKey === "Travel>Local Map") {
      const districtGroups = {};
      allLocationIds().forEach((locationId) => {
        const district = LOCATION_DEFS[locationId].district || "Anchorage";
        if (!districtGroups[district]) districtGroups[district] = [];
        districtGroups[district].push(locationId);
      });
      Object.entries(districtGroups).forEach(([district, locationIds]) => {
        const header = document.createElement("div");
        header.className = "travel-group";
        header.textContent = district;
        el.actionsPanel.appendChild(header);
        locationIds.forEach((locationId) => {
          el.actionsPanel.appendChild(buildDestinationButton(locationId));
        });
      });
      return;
    }

    allLocationIds().forEach((locationId) => {
      el.actionsPanel.appendChild(buildDestinationButton(locationId));
    });
    return;
  }

  const isDynamicCategory = ["People", "Hustle", "Rest", "Market"].includes(pathKey);
  const entries = isDynamicCategory
    ? buildDynamicActionEntries(pathKey)
    : Array.isArray(node)
      ? node.map((entry) => ({ id: entry, label: entry, disabled: false, hint: "" }))
      : Object.keys(node).map((entry) => ({ id: entry, label: entry, disabled: false, hint: "" }));

  if (isDynamicCategory) {
    const profile = locationProfile(state.location);
    const blurb = document.createElement("div");
    blurb.className = "travel-note";
    blurb.innerHTML = `<strong>${locationName(state.location)} · Risk ${profile.risk}</strong><br><span class="muted">${profile.identity}</span>`;
    el.actionsPanel.appendChild(blurb);
  }

  entries.forEach((entry) => {
    const btn = document.createElement("button");
    btn.className = "menu-btn";
    btn.textContent = entry.label;
    btn.disabled = uiState.awaitingContinue || !!entry.disabled;
    btn.addEventListener("click", () => {
      if (uiState.awaitingContinue || entry.disabled) return;
      const currentNode = getActionNode();
      if (Array.isArray(currentNode)) {
        handleSubmenuAction(entry.id);
        closeOverlay("actions");
        return;
      }

      const nextNode = currentNode[entry.id];
      if (Array.isArray(nextNode)) {
        if (nextNode.length === 0) {
          uiState.actionPath = [...uiState.actionPath, entry.id];
          renderActionsMenu();
          return;
        }
        if (nextNode.length === 1) {
          handleSubmenuAction(nextNode[0]);
          closeOverlay("actions");
          return;
        }
        uiState.actionPath = [...uiState.actionPath, entry.id];
        renderActionsMenu();
        return;
      }
      if (typeof nextNode === "object") {
        uiState.actionPath = [...uiState.actionPath, entry.id];
        renderActionsMenu();
        return;
      }
      handleSubmenuAction(entry.id);
      closeOverlay("actions");
    });
    el.actionsPanel.appendChild(btn);
    if (entry.hint) {
      const hint = document.createElement("div");
      hint.className = "muted";
      hint.style.fontSize = "0.82rem";
      hint.style.padding = "0 2px 4px";
      hint.textContent = entry.hint;
      el.actionsPanel.appendChild(hint);
    }
  });
}

function buildDestinationButton(locationId) {
  const def = LOCATION_DEFS[locationId];
  const unlocked = !!state.unlocks.locations[locationId];
  const isCurrent = state.location === locationId;
  const btn = document.createElement("button");
  btn.className = "menu-btn destination-btn";
  btn.disabled = uiState.awaitingContinue;

  const status = isCurrent ? "Here now" : unlocked ? "Unlocked" : "Locked";
  const details = unlocked ? def.description : `Locked: ${def.lockHint}`;
  btn.innerHTML = `<strong>${def.name}</strong><br><span class="muted">${status} · ${details}</span>`;

  btn.addEventListener("click", () => {
    if (uiState.awaitingContinue) return;
    if (isCurrent) {
      resolveAction(`You're already at ${def.name}.`, "", { skipAdvanceTime: true });
      closeOverlay("actions");
      return;
    }
    if (!unlocked) {
      resolveAction(`${def.name} is locked. Hint: ${def.lockHint}`, "bad", { skipAdvanceTime: true });
      closeOverlay("actions");
      return;
    }
    moveToLocation(locationId, `You travel to ${def.name}. ${def.description}`);
    closeOverlay("actions");
  });
  return btn;
}

function renderStory() {
  if (uiState.awaitingContinue && uiState.pendingResult) {
    el.storyTitle.textContent = uiState.pendingEvent?.awaitingChoice ? uiState.pendingEvent.title : "Action Result";
    el.storyText.textContent = uiState.pendingResult.text;
    el.choiceButtons.innerHTML = "";

    if (uiState.pendingEvent?.awaitingChoice) {
      uiState.pendingEvent.choices.forEach((choice) => {
        const choiceBtn = document.createElement("button");
        const unlocked = evaluateRequirements(choice.requirements || {});
        choiceBtn.className = "choice-btn";
        choiceBtn.textContent = unlocked ? choice.label : `${choice.label} (Locked: ${requirementHint(choice.requirements || {})})`;
        choiceBtn.disabled = !unlocked;
        choiceBtn.addEventListener("click", () => resolveEventChoice(uiState.pendingEvent.id, choice.id));
        el.choiceButtons.appendChild(choiceBtn);
      });
    } else {
      const continueBtn = document.createElement("button");
      continueBtn.className = "choice-btn continue-btn";
      continueBtn.textContent = "Continue to Hub";
      continueBtn.addEventListener("click", clearResultAndReturnToHub);
      el.choiceButtons.appendChild(continueBtn);
    }
    return;
  }

  el.storyTitle.textContent = "Street Feed";
  const recent = uiState.log[0]?.text || "Tap Actions to make your first move.";
  el.storyText.textContent = `${recent}\n\nUse the quick bar for Actions, Journal, and Scene.`;
  el.choiceButtons.innerHTML = "";
}

function renderDetailPanel() {
  el.detailTitle.textContent = "Journal";
  el.detailPanel.innerHTML = "";

  if (!uiState.log.length) {
    const row = document.createElement("div");
    row.className = "log-item";
    row.textContent = "No events yet. Your first move will set the tone.";
    el.detailPanel.appendChild(row);
    return;
  }

  uiState.log.slice(0, 10).forEach((entry) => {
    const row = document.createElement("div");
    row.className = `log-item ${entry.tone}`;
    row.textContent = `Day ${entry.day}: ${entry.text}`;
    el.detailPanel.appendChild(row);
  });
}

function renderOverlays() {
  const overlays = {
    actions: el.actionsSheet,
    journal: el.journalOverlay,
    scene: el.sceneOverlay,
    menu: el.menuOverlay,
  };

  Object.entries(overlays).forEach(([key, node]) => {
    if (!node) return;
    const visible = !!uiState.overlays[key];
    node.classList.toggle("hidden", !visible);
    node.setAttribute("aria-hidden", String(!visible));
  });
}

function render() {
  renderHud();
  renderScene();
  renderActionsMenu();
  renderStory();
  renderDetailPanel();
  renderOverlays();
}

function moveToLocation(locationId, text) {
  if (!state.unlocks.locations[locationId]) {
    resolveAction(`${locationName(locationId)} is still locked.`, "bad", { skipAdvanceTime: true });
    return;
  }

  state.location = locationId;
  resolveAction(text);
}

function handleSubmenuAction(action) {
  if (uiState.awaitingContinue) return;

  switch (action) {
    case "Travel Home":
      moveToLocation("cousins_apt", "You head back to your cousin's apartment.");
      break;
    case "Check Area": {
      const localChecks = {
        cousins_apt: {
          text: "From the apartment window, you map who comes and goes. Dre points out the safer route to the parking lot.",
          unlock: "apt_exterior",
          tone: "",
        },
        apt_exterior: {
          text: "You walk the parking lot and side fences, learning blind spots and who hangs around after dark.",
          unlock: "side_street",
          tone: "good",
        },
        side_street: {
          text: "The alley connects you to the gas station lane. You can now move that way without guessing.",
          unlock: "gas_station",
          tone: "good",
        },
        north_star_lot: {
          text: "You trace the foot traffic around the lot and spot the cleaner mall-edge entrance.",
          unlock: "north_star_edge",
          tone: "good",
        },
      };
      const result = localChecks[state.location] || {
        text: "You check the area and note exits, cameras, and faces.",
        tone: "",
      };
      if (result.unlock && !state.unlocks.locations[result.unlock]) {
        applyUnlock({ type: "unlock_location", target: result.unlock });
        resolveAction(`${result.text} New destination unlocked: ${locationName(result.unlock)}.`, result.tone);
        break;
      }
      if (result.tone === "good") state.reputation += 1;
      resolveAction(result.text, result.tone);
      break;
    }
    case "Talk to Dre":
      if (state.location !== "cousins_apt") {
        resolveAction("Dre isn't here. You'll need to head back to the apartment.", "", { skipAdvanceTime: true });
        break;
      }
      resolveAction(
        "Dre clocks your face before you talk. He says keep your lane clean, don't linger where cameras can read your pattern.",
        "good",
      );
      break;
    case "Review Contacts":
      resolveAction(`Contacts tracked: Dre (${state.relationships.dre_trust}/5 trust), Mina (${state.relationships.mina_trust}/5 trust).`, "", { skipAdvanceTime: true });
      break;
    case "Check Messages":
      resolveAction(
        state.flags.has_burner_phone
          ? "Burner line is active. One ping mentions a small electronics lane getting warmer near North Star."
          : "No secure line yet. Mina hinted a burner phone unlocks better intel and cleaner work windows.",
      );
      break;
    case "Find Cash": {
      const riskySpot = ["north_star_lot", "side_street"].includes(state.location);
      const payout = randomInt(riskySpot ? 45 : 20, riskySpot ? 95 : 55);
      state.money += payout;
      state.heat += randomInt(0, riskySpot ? 2 : 1);
      if (riskySpot) state.reputation += 1;
      resolveAction(
        riskySpot
          ? `You move quick and clear $${payout}. The lot feels tense—everybody notices who lingers too long.`
          : `You hustle small errands and pocket $${payout}. It's not loud money, but it keeps you moving.`,
        "good",
      );
      break;
    }
    case "Work a Shift": {
      const payout = randomInt(18, 40);
      state.money += payout;
      state.heat += randomInt(0, 1);
      state.health -= randomInt(0, 2);
      resolveAction(`You grind a legal shift and make $${payout}. Lower reward, lower noise, steady progress.`, "good");
      break;
    }
    case "Ask Around": {
      const highRisk = state.location === "north_star_lot";
      state.heat += randomInt(0, highRisk ? 2 : 1);
      if (state.location === "corner_store" && !state.unlocks.locations.bus_stop) {
        applyUnlock({ type: "unlock_location", target: "bus_stop" });
      }
      if (state.location === "north_star_lot" && !state.flags.hot_goods_lane_unlocked && state.flags.has_burner_phone) {
        state.flags.hot_goods_lane_unlocked = true;
        state.unlocks.products.hot_goods = true;
        resolveAction(
          "You ask around near North Star Lot. Mina watches you like she's deciding if you're worth the trouble. A quiet hot-goods lane just opened.",
          "good",
        );
        break;
      }
      resolveAction(
        highRisk
          ? "You ask around at the lot. Faces stay neutral, but word is moving faster tonight."
          : `You ask around near ${locationName(state.location)} and pick up small leads without drawing too much attention.`,
      );
      break;
    }
    case "Scope the Area": {
      const damage = randomInt(0, 5);
      state.health -= damage;
      resolveAction(
        damage
          ? `You scope ${locationName(state.location)} and catch light damage (-${damage} health). You still map exits and blind spots.`
          : `You scope ${locationName(state.location)} and slip out untouched. The route feels cleaner next time.`,
      );
      break;
    }
    case "Plan a Route":
      resolveAction("You sketch the day in your head: bus lines, cameras, and where to disappear if pressure spikes.", "good");
      break;
    case "Run a Quick Move":
      if (!state.unlocks.events.quick_lot_run && !state.flags.mina_quick_job_hint_unlocked) {
        resolveAction("You don't have a clean move lined up yet. Mina might open one if trust stays solid.", "bad", { skipAdvanceTime: true });
        break;
      }
      state.money += randomInt(50, 105);
      state.heat += randomInt(1, 3);
      state.reputation += 1;
      state.metrics.risky_actions_on_lot = (state.metrics.risky_actions_on_lot || 0) + 1;
      resolveAction("You run a quick move and clear cash before the window closes. Fast money, real exposure.", "good");
      break;
    case "Check with Mina":
      if (state.location !== "north_star_lot") {
        resolveAction("Mina works the North Star lot. She's not taking random calls right now.", "", { skipAdvanceTime: true });
        break;
      }
      resolveAction(
        state.unlocks.vendors.mina
          ? "Mina keeps it short: stay patient, stay reachable, and don't ask for off-menu if your heat is sloppy."
          : "Mina spots you but keeps distance. Build one clean interaction before she opens up.",
      );
      break;
    case "Check Market Board": {
      const entries = getMarketBoardEntries();
      const lines = entries.map((entry) => `• [${entry.lane}] ${entry.line}`).join("\n");
      resolveAction(`Current supply board:\n${lines}`, "", { skipAdvanceTime: true });
      break;
    }
    case "Ask Off-Menu Stock":
      if (state.location !== "north_star_lot") {
        resolveAction("No one discusses off-menu stock out here.", "", { skipAdvanceTime: true });
        break;
      }
      if (!state.flags.has_burner_phone) {
        resolveAction("Mina shuts it down: no burner, no off-menu conversation.", "bad");
        break;
      }
      if (state.heat >= 6) {
        state.flags.mina_refuses_service = true;
        resolveAction("Mina reads your heat and refuses service for now. Lay low before asking again.", "bad");
        break;
      }
      state.flags.mina_refuses_service = false;
      state.flags.hot_goods_lane_unlocked = true;
      state.unlocks.products.hot_goods = true;
      resolveAction("Mina finally mentions off-menu stock. Small electronics, quick flips, no sloppy movement.", "good");
      break;
    case "Buy Store Snacks":
      if (state.location !== "corner_store") {
        resolveAction("You need to be at the corner store for that buy.", "", { skipAdvanceTime: true });
        break;
      }
      if (state.money < 10) {
        resolveAction("Not enough cash for snacks.", "bad", { skipAdvanceTime: true });
        break;
      }
      state.money -= 10;
      state.inventory.snacks += 1;
      resolveAction("You grab snacks and keep the receipt. Cheap supplies, no extra heat.", "good");
      break;
    case "Buy Basic Meds":
      if (state.location !== "corner_store") {
        resolveAction("You need to be at the corner store for meds.", "", { skipAdvanceTime: true });
        break;
      }
      if (state.money < 15) {
        resolveAction("Not enough cash for basic meds.", "bad", { skipAdvanceTime: true });
        break;
      }
      state.money -= 15;
      state.inventory.basic_meds += 1;
      resolveAction("You buy basic meds and stash them before heading back out.", "good");
      break;
    case "Inventory":
    case "Stash Count":
      resolveAction(`Inventory check: ${inventoryCount()} total items stashed.`, "", { skipAdvanceTime: true });
      break;
    case "Stats":
    case "Overview":
      resolveAction(`Stats — Cash $${state.money}, Health ${state.health}, Rep ${state.reputation}, Heat ${state.heat}.`, "", { skipAdvanceTime: true });
      break;
    case "Street Pressure":
      resolveAction(`Street pressure reads at Heat ${state.heat} with Rep ${state.reputation}. Move accordingly.`, "", { skipAdvanceTime: true });
      break;
    case "Journal":
      openOverlay("journal");
      break;
    case "Rest Up":
      state.health += 12;
      resolveAction("You sleep hard and reset.", "good", { skipAdvanceTime: true });
      advanceTimeBy(1);
      while (state.timeOfDay !== "Morning") advanceTimeBy(1);
      break;
    case "Wait":
      resolveAction("You keep your head down and let the block reset.");
      break;
    case "Recover":
      state.health += 7;
      state.money -= 10;
      resolveAction("You spend $10 on recovery and steady out.");
      break;
    case "Lay Low":
      state.heat -= 1;
      resolveAction("You keep your head down and don't make noise. Smart.");
      break;
    default:
      resolveAction("No action tied to that option yet.");
  }
}

function endOfActionCheck() {
  if (state.health <= 0) {
    uiState.gameOver = true;
    return endGame("You couldn't survive the streets. Your run ends cold.");
  }

  if (state.day > GAME_DAYS) {
    uiState.gameOver = true;
    return endGame(buildOutcome());
  }

  render();
}

function buildOutcome() {
  let tier = "A forgotten drifter";
  if (state.money >= 800 || state.reputation >= 5) tier = "A connected hustler";
  if (state.money >= 1800 || state.reputation >= 8) tier = "A rising underworld name";
  if (state.money >= 3000 && state.reputation >= 10) tier = "An Anchorage kingpin";

  return `${state.playerName}, after 30 days you became: ${tier}. Final heat: ${state.heat}.`;
}

function endGame(summaryText) {
  el.gameScreen.classList.add("hidden");
  el.endScreen.classList.remove("hidden");
  el.outcomeSummary.textContent = summaryText;

  const finalPairs = [
    ["Cash", `$${state.money}`],
    ["Health", state.health],
    ["Reputation", state.reputation],
    ["Heat", state.heat],
    ["Location", locationName(state.location)],
  ];

  el.finalStats.innerHTML = "";
  finalPairs.forEach(([k, v]) => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `<span>${k}</span><strong>${v}</strong>`;
    el.finalStats.appendChild(row);
  });
}

function startGame(name) {
  Object.assign(state, createOpeningState(), { playerName: name || "Rookie" });
  Object.assign(uiState, createUiState());

  el.startScreen.classList.add("hidden");
  el.endScreen.classList.add("hidden");
  el.gameScreen.classList.remove("hidden");
  const event = getEligibleEvent();
  if (event) presentEvent(event);
  render();
}

function sanitizeLoadedState(loaded) {
  const base = createOpeningState();
  const normalized = Object.assign({}, base, loaded || {});

  normalized.inventory = Object.assign({}, base.inventory, loaded?.inventory || {});
  normalized.relationships = Object.assign({}, base.relationships, loaded?.relationships || {});
  normalized.flags = Object.assign({}, base.flags, loaded?.flags || {});
  normalized.metrics = Object.assign({}, base.metrics, loaded?.metrics || {});
  normalized.unlocks = {
    events: Object.assign({}, base.unlocks.events, loaded?.unlocks?.events || {}),
    locations: Object.assign({}, base.unlocks.locations, loaded?.unlocks?.locations || {}),
    vendors: Object.assign({}, base.unlocks.vendors, loaded?.unlocks?.vendors || {}),
    products: Object.assign({}, base.unlocks.products, loaded?.unlocks?.products || {}),
  };
  normalized.eventState = Object.assign({}, base.eventState, loaded?.eventState || {});
  normalized.eventState.seen = Object.assign({}, base.eventState.seen, loaded?.eventState?.seen || {});
  normalized.eventState.completed = Object.assign({}, base.eventState.completed, loaded?.eventState?.completed || {});
  normalized.eventState.lastTriggeredDay = Object.assign({}, base.eventState.lastTriggeredDay, loaded?.eventState?.lastTriggeredDay || {});
  normalized.eventState.cooldowns = Object.assign({}, base.eventState.cooldowns, loaded?.eventState?.cooldowns || {});

  if (!TIME_SLOTS.includes(normalized.timeOfDay)) normalized.timeOfDay = "Morning";
  if (!LOCATION_DEFS[normalized.location]) normalized.location = "cousins_apt";

  clampBoundedStats();
  return normalized;
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  addLog("Game saved to local device.", "good");
  closeOverlay("menu");
  render();
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    addLog("No saved game found.", "bad");
    closeOverlay("menu");
    render();
    return;
  }

  try {
    const loaded = JSON.parse(raw);
    const normalized = sanitizeLoadedState(loaded);
    Object.assign(state, normalized);
    Object.assign(uiState, createUiState());

    el.startScreen.classList.add("hidden");
    el.endScreen.classList.add("hidden");
    el.gameScreen.classList.remove("hidden");

    addLog("Loaded saved game.", "good");
    closeAllOverlays();
    const event = getEligibleEvent();
    if (event) presentEvent(event);
    render();
  } catch {
    addLog("Save data was corrupted.", "bad");
    closeOverlay("menu");
    render();
  }
}

el.startGameBtn.addEventListener("click", () => {
  const name = el.playerName.value.trim();
  startGame(name);
});

el.menuToggleBtn?.addEventListener("click", () => openOverlay("menu"));
el.openActionsBtn?.addEventListener("click", () => openOverlay("actions"));
el.openJournalBtn?.addEventListener("click", () => openOverlay("journal"));
el.openSceneBtn?.addEventListener("click", () => openOverlay("scene"));
el.actionsBackBtn?.addEventListener("click", () => {
  if (!uiState.actionPath.length) return;
  uiState.actionPath = uiState.actionPath.slice(0, -1);
  renderActionsMenu();
});
el.closeActionsBtn?.addEventListener("click", () => closeOverlay("actions"));
el.closeJournalBtn?.addEventListener("click", () => closeOverlay("journal"));
el.closeSceneBtn?.addEventListener("click", () => closeOverlay("scene"));
el.closeMenuBtn?.addEventListener("click", () => closeOverlay("menu"));

el.saveBtn.addEventListener("click", saveGame);
el.loadBtn.addEventListener("click", loadGame);
el.restartBtn.addEventListener("click", () => startGame(state.playerName || "Rookie"));
el.playAgainBtn.addEventListener("click", () => startGame(state.playerName || "Rookie"));

el.playerName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") el.startGameBtn.click();
});

document.querySelectorAll("[data-close-overlay]").forEach((node) => {
  node.addEventListener("click", () => {
    const overlayName = node.getAttribute("data-close-overlay");
    if (overlayName) closeOverlay(overlayName);
  });
});
