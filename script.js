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
  People: ["Cousin", "Contacts", "Messages"],
  Hustle: ["Look for Work", "Ask Around", "Scope a Spot"],
  Info: {
    Stats: ["Overview", "Street Pressure"],
    Inventory: ["Inventory", "Stash Count"],
    "Journal Notes": ["Journal"],
  },
  Rest: ["Sleep", "Wait", "Recover"],
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
    },
    relationships: {
      dre_trust: 0,
      mina_trust: 0,
    },
    flags: {
      met_mina: false,
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
          unlocks: [{ type: "unlock_event", target: "minas_quiet_suggestion" }],
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
  el.sceneArt.src = scene.art;
  el.sceneArt.alt = scene.alt;
  el.sceneText.textContent = scene.text;
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

  const entries = Array.isArray(node) ? node : Object.keys(node);
  entries.forEach((entry) => {
    const btn = document.createElement("button");
    btn.className = "menu-btn";
    btn.textContent = entry;
    btn.disabled = uiState.awaitingContinue;
    btn.addEventListener("click", () => {
      if (uiState.awaitingContinue) return;
      const currentNode = getActionNode();
      if (Array.isArray(currentNode)) {
        handleSubmenuAction(entry);
        closeOverlay("actions");
        return;
      }

      const nextNode = currentNode[entry];
      if (Array.isArray(nextNode)) {
        if (nextNode.length === 0) {
          uiState.actionPath = [...uiState.actionPath, entry];
          renderActionsMenu();
          return;
        }
        if (nextNode.length === 1) {
          handleSubmenuAction(nextNode[0]);
          closeOverlay("actions");
          return;
        }
        uiState.actionPath = [...uiState.actionPath, entry];
        renderActionsMenu();
        return;
      }
      if (typeof nextNode === "object") {
        uiState.actionPath = [...uiState.actionPath, entry];
        renderActionsMenu();
      }
    });
    el.actionsPanel.appendChild(btn);
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
    case "Cousin":
      resolveAction("Dre gives you local pointers: keep heat low near home and check routes before chasing money.", "good", { skipAdvanceTime: true });
      break;
    case "Contacts":
      resolveAction(`Contacts tracked: Dre (${state.relationships.dre_trust}/5 trust), Mina (${state.relationships.mina_trust}/5 trust).`, "", { skipAdvanceTime: true });
      break;
    case "Messages":
      resolveAction(state.flags.has_burner_phone ? "Burner line is active. A few low-noise pings are waiting tonight." : "No secure line yet. Mina hinted a burner phone opens better messages.");
      break;
    case "Look for Work": {
      const payout = randomInt(30, state.location === "north_star_lot" ? 95 : 70);
      state.money += payout;
      state.reputation += state.location === "north_star_lot" ? 1 : 0;
      state.heat += randomInt(0, state.location === "north_star_lot" ? 2 : 1);
      resolveAction(`You pick up side work around ${locationName(state.location)} and clear $${payout}.`, "good");
      break;
    }
    case "Ask Around": {
      state.heat += randomInt(0, 2);
      if (state.location === "corner_store" && !state.unlocks.locations.bus_stop) {
        applyUnlock({ type: "unlock_location", target: "bus_stop" });
      }
      resolveAction(`You ask around near ${locationName(state.location)} and test the temperature.`);
      break;
    }
    case "Scope a Spot": {
      const damage = randomInt(0, 5);
      state.health -= damage;
      resolveAction(damage ? `You scope ${locationName(state.location)} and catch light damage (-${damage} health).` : `You scope ${locationName(state.location)} and slip out untouched.`);
      break;
    }
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
    case "Sleep":
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
