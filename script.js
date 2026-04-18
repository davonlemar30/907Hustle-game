const GAME_DAYS = 30;
const SAVE_KEY = "hustle907_save";

const TIME_SLOTS = ["Morning", "Afternoon", "Evening", "LateNight"];

const LOCATION_DEFS = {
  cousins_apt: {
    name: "Cousin's Apt",
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Gritty pixel-style view of cousin's apartment with thin blinds and a worn couch.",
    text: "Cousin's apartment feels cramped and temporary. A duffel bag sits by the couch, cheap blinds leak cold light, and city noise pushes through thin windows.",
  },
  north_star_lot: {
    name: "North Star Lot",
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Cold parking lot near North Star with cars idling in the dark.",
    text: "North Star Lot is quick money and quick pressure. Eyes on fences, engines running, everyone measuring everyone.",
  },
};

const navCategories = [
  { key: "move", label: "Move", icon: "🧭" },
  { key: "people", label: "People", icon: "👥" },
  { key: "hustle", label: "Hustle", icon: "💼" },
  { key: "info", label: "Info", icon: "📓" },
  { key: "rest", label: "Rest", icon: "🛌" },
];

const submenuByCategory = {
  move: ["Step Outside", "Travel Home", "Check Area"],
  people: ["Cousin", "Contacts", "Messages"],
  hustle: ["Look for Work", "Ask Around", "Scope a Spot"],
  info: ["Inventory", "Stats", "Journal"],
  rest: ["Sleep", "Wait", "Recover"],
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
      openingComplete: false,
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
    activeCategory: "people",
    activeSubmenu: "Cousin",
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
  navRail: document.getElementById("navRail"),
  submenuTitle: document.getElementById("submenuTitle"),
  submenuPanel: document.getElementById("submenuPanel"),
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
    cooldownDays: 0,
    choices: [
      {
        id: "agree",
        label: "Agree and listen",
        outcomeText: "Dre clocks your discipline and opens a lane to North Star.",
        outcome: {
          relationships: { dre_trust: 1 },
          flags: { openingComplete: true },
          unlocks: [
            { type: "unlock_location", target: "north_star_lot" },
            { type: "unlock_event", target: "first_purchase" },
          ],
          timeAdvance: 1,
        },
      },
    ],
  },
  {
    id: "first_purchase",
    title: "First Purchase",
    text: "Mina gives you two starter options. Pick one and show you're serious.",
    location: "north_star_lot",
    requiresUnlock: true,
    cooldownDays: 0,
    requirements: {
      locations: ["north_star_lot"],
      completedEvents: ["house_rules"],
    },
    choices: [
      {
        id: "buy_snacks",
        label: "Buy snacks ($15)",
        requirements: { minMoney: 15 },
        outcomeText: "You buy snacks and keep your head clear while posted.",
        outcome: {
          money: -15,
          inventory: { snacks: 1 },
          relationships: { mina_trust: 1 },
          flags: { met_mina: true },
          unlocks: [
            { type: "unlock_vendor", target: "mina" },
            { type: "unlock_event", target: "burner_line" },
          ],
          timeAdvance: 1,
        },
      },
      {
        id: "buy_basic_meds",
        label: "Buy basic meds ($25)",
        requirements: { minMoney: 25 },
        outcomeText: "You buy basic meds and Mina starts treating you like a real regular.",
        outcome: {
          money: -25,
          inventory: { basic_meds: 1 },
          health: 3,
          relationships: { mina_trust: 1 },
          flags: { met_mina: true },
          unlocks: [
            { type: "unlock_vendor", target: "mina" },
            { type: "unlock_event", target: "burner_line" },
          ],
          timeAdvance: 1,
        },
      },
    ],
  },
  {
    id: "burner_line",
    title: "Burner Line",
    text: "Mina asks if you're ready to run a clean communication line.",
    location: "north_star_lot",
    requiresUnlock: true,
    cooldownDays: 1,
    requirements: {
      unlockedVendors: ["mina"],
      completedEvents: ["first_purchase"],
    },
    choices: [
      {
        id: "buy_burner_phone",
        label: "Buy burner phone ($60)",
        requirements: { minMoney: 60 },
        outcomeText: "You pay for a burner and Mina trusts you with quieter opportunities.",
        outcome: {
          money: -60,
          inventory: { burner_phone: 1 },
          relationships: { mina_trust: 1 },
          unlocks: [{ type: "unlock_event", target: "minas_quiet_suggestion" }],
          timeAdvance: 1,
        },
      },
      {
        id: "borrow_line",
        label: "Borrow a risky line",
        outcomeText: "You get through, but your sloppiness raises local heat.",
        outcome: {
          heat: 6,
          relationships: { mina_trust: -1 },
          timeAdvance: 1,
        },
      },
    ],
  },
  {
    id: "minas_quiet_suggestion",
    title: "Mina's Quiet Suggestion",
    text: "Mina offers a short route that only works if you stay patient.",
    location: "north_star_lot",
    requiresUnlock: true,
    cooldownDays: 1,
    requirements: {
      completedEvents: ["burner_line"],
      minRelationship: { mina_trust: 1 },
      maxHeat: 70,
    },
    choices: [
      {
        id: "take_quiet_route",
        label: "Take Mina's route",
        outcomeText: "You move quiet, bank a little trust, and unlock a faster run.",
        outcome: {
          money: 55,
          reputation: 1,
          relationships: { mina_trust: 1 },
          unlocks: [{ type: "unlock_event", target: "quick_lot_run" }],
          timeAdvance: 1,
        },
      },
      {
        id: "ignore_route",
        label: "Ignore and freestyle",
        outcomeText: "You push loud and pick up both money and attention.",
        outcome: {
          money: 80,
          heat: 8,
          timeAdvance: 1,
        },
      },
    ],
  },
  {
    id: "quick_lot_run",
    title: "Quick Lot Run",
    text: "A fast lot window opens for ten minutes. Move now or miss it.",
    location: "north_star_lot",
    requiresUnlock: true,
    cooldownDays: 1,
    requirements: {
      completedEvents: ["minas_quiet_suggestion"],
      inventory: { burner_phone: 1 },
    },
    choices: [
      {
        id: "run_clean",
        label: "Run it clean",
        outcomeText: "You finish clean: money up, profile up, no extra bruising.",
        outcome: {
          money: 140,
          reputation: 2,
          heat: 3,
          health: -2,
          timeAdvance: 1,
        },
        meta: { isRiskyAction: true },
      },
      {
        id: "push_double",
        label: "Double back for extra",
        outcomeText: "You squeeze extra money, but it costs blood and heat.",
        outcome: {
          money: 210,
          reputation: 1,
          heat: 10,
          health: -10,
          timeAdvance: 1,
        },
        meta: { isRiskyAction: true },
      },
    ],
  },
  {
    id: "rook_sizes_you_up",
    title: "Rook Sizes You Up",
    text: "Rook catches your eye at the lot fence and tests whether you're pressure-ready.",
    location: "north_star_lot",
    cooldownDays: 1,
    requirements: {
      completedEvents: ["quick_lot_run"],
      metrics: { risky_actions_on_lot: { min: 1, max: 2 } },
    },
    choices: [
      {
        id: "stand_firm",
        label: "Hold eye contact",
        outcomeText: "Rook reads confidence and lets the pressure pass.",
        outcome: {
          reputation: 2,
          relationships: { dre_trust: 1 },
          unlocks: [{ type: "unlock_event", target: "dre_checks_your_face" }],
          timeAdvance: 1,
        },
      },
      {
        id: "look_away",
        label: "Look away",
        outcomeText: "Rook marks you as uncertain and keeps watching.",
        outcome: {
          reputation: -1,
          heat: 4,
          timeAdvance: 1,
        },
      },
    ],
  },
  {
    id: "dre_checks_your_face",
    title: "Dre Checks Your Face",
    text: "Back at the apartment, Dre checks your condition and how hot you've become.",
    location: "cousins_apt",
    requiresUnlock: true,
    cooldownDays: 1,
    requirements: {
      unlockedEvents: ["dre_checks_your_face"],
      anyOf: [{ minHeat: 25 }, { maxHealth: 80 }],
      completedEvents: ["rook_sizes_you_up"],
    },
    choices: [
      {
        id: "be_honest",
        label: "Be honest about the pressure",
        outcomeText: "Dre respects honesty, helps you reset, and keeps you in play.",
        outcome: {
          reputation: 2,
          heat: -8,
          health: 8,
          relationships: { dre_trust: 1 },
          timeAdvance: 1,
        },
      },
      {
        id: "front_like_its_fine",
        label: "Pretend you're fine",
        outcomeText: "Dre hears the cap and trust stalls.",
        outcome: {
          reputation: -2,
          relationships: { dre_trust: -1 },
          timeAdvance: 1,
        },
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
  if (requirements.minDay && state.day < requirements.minDay) return false;
  if (requirements.minMoney && state.money < requirements.minMoney) return false;
  if (requirements.minHeat && state.heat < requirements.minHeat) return false;
  if (requirements.maxHeat !== undefined && state.heat > requirements.maxHeat) return false;
  if (requirements.maxHealth !== undefined && state.health > requirements.maxHealth) return false;

  if (requirements.inventory) {
    const hasInventory = Object.entries(requirements.inventory).every(
      ([item, needed]) => (state.inventory[item] || 0) >= needed,
    );
    if (!hasInventory) return false;
  }

  if (requirements.minRelationship) {
    const ok = Object.entries(requirements.minRelationship).every(
      ([person, needed]) => (state.relationships[person] || 0) >= needed,
    );
    if (!ok) return false;
  }

  if (requirements.completedEvents) {
    const ok = requirements.completedEvents.every((eventId) => state.eventState.completed[eventId]);
    if (!ok) return false;
  }

  if (requirements.unlockedEvents) {
    const ok = requirements.unlockedEvents.every((eventId) => state.unlocks.events[eventId]);
    if (!ok) return false;
  }

  if (requirements.unlockedVendors) {
    const ok = requirements.unlockedVendors.every((vendorId) => state.unlocks.vendors[vendorId]);
    if (!ok) return false;
  }

  if (requirements.locations) {
    const ok = requirements.locations.every((locationId) => state.unlocks.locations[locationId]);
    if (!ok) return false;
  }

  if (requirements.metrics) {
    const ok = Object.entries(requirements.metrics).every(([metricId, range]) => {
      const value = state.metrics[metricId] || 0;
      if (range.min !== undefined && value < range.min) return false;
      if (range.max !== undefined && value > range.max) return false;
      return true;
    });
    if (!ok) return false;
  }

  if (requirements.anyOf && !evaluateAnyOf(requirements.anyOf)) return false;

  return true;
}

function isEventOnCooldown(eventId) {
  return (state.eventState.cooldowns[eventId] || 0) > state.day;
}

function getEligibleEvent() {
  if (!state.flags.openingComplete || uiState.gameOver || uiState.awaitingContinue) return null;

  return V01_EVENTS.find((event) => {
    if (!event) return false;
    if (state.eventState.completed[event.id]) return false;
    if (event.location && event.location !== state.location) return false;
    if (event.requiresUnlock && !state.unlocks.events[event.id]) return false;
    if (isEventOnCooldown(event.id)) return false;
    return evaluateRequirements(event.requirements || {});
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
  const outcome = choice.outcome || {};

  // 1) stat/item changes
  if (outcome.money) state.money += outcome.money;
  if (outcome.health) state.health += outcome.health;
  if (outcome.reputation) state.reputation += outcome.reputation;
  if (outcome.heat) state.heat += outcome.heat;

  if (outcome.inventory) {
    Object.entries(outcome.inventory).forEach(([itemId, delta]) => {
      state.inventory[itemId] = (state.inventory[itemId] || 0) + delta;
      if (state.inventory[itemId] < 0) state.inventory[itemId] = 0;
    });
  }

  // 2) relationship changes
  if (outcome.relationships) {
    Object.entries(outcome.relationships).forEach(([person, delta]) => {
      state.relationships[person] = (state.relationships[person] || 0) + delta;
    });
  }

  // 3) flags
  if (outcome.flags) {
    Object.entries(outcome.flags).forEach(([flag, value]) => {
      state.flags[flag] = value;
    });
  }

  // 4) unlocks
  (outcome.unlocks || []).forEach(applyUnlock);

  // 5) time advancement
  advanceTimeBy(outcome.timeAdvance || 0);

  // 6) risky-action metric increment
  if (state.location === "north_star_lot" && choice.meta?.isRiskyAction) {
    state.metrics.risky_actions_on_lot = (state.metrics.risky_actions_on_lot || 0) + 1;
  }

  // 7) clamp bounded stats
  clampBoundedStats();

  state.eventState.completed[event.id] = true;
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

function renderHud() {
  el.hudPrimary.textContent = `907 HUSTLE | Day ${state.day} | ${state.timeOfDay} | ${locationName(state.location)}`;
  el.hudStats.textContent = `Cash: $${state.money} | Health: ${state.health} | Rep: ${state.reputation} | Heat: ${state.heat}`;
}

function renderScene() {
  const scene = LOCATION_DEFS[state.location] || LOCATION_DEFS.cousins_apt;
  el.sceneArt.src = scene.art;
  el.sceneArt.alt = scene.alt;
  el.sceneText.textContent = scene.text;
}

function renderNav() {
  el.navRail.innerHTML = "";
  navCategories.forEach((category) => {
    const btn = document.createElement("button");
    btn.className = `nav-btn ${category.key === uiState.activeCategory ? "active" : ""}`;
    btn.innerHTML = `<span class="nav-icon">${category.icon}</span>${category.label}`;
    btn.disabled = uiState.awaitingContinue;
    btn.addEventListener("click", () => {
      if (uiState.awaitingContinue) return;
      uiState.activeCategory = category.key;
      uiState.activeSubmenu = submenuByCategory[category.key][0];
      render();
    });
    el.navRail.appendChild(btn);
  });
}

function renderSubmenu() {
  const category = navCategories.find((entry) => entry.key === uiState.activeCategory);
  el.submenuTitle.textContent = category ? `${category.label} Options` : "Options";
  el.submenuPanel.innerHTML = "";

  submenuByCategory[uiState.activeCategory].forEach((entry) => {
    const btn = document.createElement("button");
    btn.className = `submenu-btn ${entry === uiState.activeSubmenu ? "active" : ""}`;
    btn.textContent = entry;
    btn.disabled = uiState.awaitingContinue;
    btn.addEventListener("click", () => {
      if (uiState.awaitingContinue) return;
      uiState.activeSubmenu = entry;
      handleSubmenuAction(entry);
    });
    el.submenuPanel.appendChild(btn);
  });
}

function renderStory() {
  if (!state.flags.openingComplete) {
    el.storyTitle.textContent = "Opening";
    el.storyText.textContent =
      "You wake up stiff on the couch. Dre is in the kitchen. The first conversation decides whether you get a lane at all.";

    el.choiceButtons.innerHTML = "";
    const button = document.createElement("button");
    button.className = "choice-btn";
    button.textContent = "Talk to Dre";
    button.addEventListener("click", () => openingChoice());
    el.choiceButtons.appendChild(button);
    return;
  }

  if (uiState.awaitingContinue && uiState.pendingResult) {
    el.storyTitle.textContent = uiState.pendingEvent?.awaitingChoice ? uiState.pendingEvent.title : "Action Result";
    el.storyText.textContent = uiState.pendingResult.text;
    el.choiceButtons.innerHTML = "";

    if (uiState.pendingEvent?.awaitingChoice) {
      uiState.pendingEvent.choices.forEach((choice) => {
        const choiceBtn = document.createElement("button");
        const unlocked = evaluateRequirements(choice.requirements || {});
        choiceBtn.className = "choice-btn";
        choiceBtn.textContent = unlocked ? choice.label : `${choice.label} (Locked)`;
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
  const recent = uiState.log[0]?.text || "Pick an option on the left to make your next move.";
  el.storyText.textContent = `${recent}\n\nChoose from Navigation and Options for your next move.`;
  el.choiceButtons.innerHTML = "";
}

function renderDetailPanel() {
  el.detailTitle.textContent = state.flags.openingComplete ? "Journal" : "Opening Notes";
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

function render() {
  renderHud();
  renderScene();
  renderNav();
  renderSubmenu();
  renderStory();
  renderDetailPanel();
}

function openingChoice() {
  state.flags.openingComplete = true;
  addLog("You sit down with Dre and hear the first rules.");
  const event = getEligibleEvent();
  if (event) {
    presentEvent(event);
    render();
    return;
  }
  resolveAction("Dre nods, but you still need your first real move.");
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

  if (!state.flags.openingComplete) {
    addLog("Handle your opening moment first.");
    render();
    return;
  }

  switch (action) {
    case "Step Outside": {
      const target = state.unlocks.locations.north_star_lot ? "north_star_lot" : "cousins_apt";
      moveToLocation(target, target === "north_star_lot" ? "You step into North Star Lot and read the motion." : "You stay near the apartment and keep your profile low.");
      break;
    }
    case "Travel Home":
      moveToLocation("cousins_apt", "You head back to your cousin's apartment.");
      break;
    case "Check Area": {
      const outcomes = [
        ["You map cameras and exits before moving.", ""],
        ["A patrol slows nearby and everyone gets quiet.", "bad"],
        ["A corner regular recognizes you from Mina's lane.", "good"],
      ];
      const [text, tone] = outcomes[randomInt(0, outcomes.length - 1)];
      if (tone === "good") state.reputation += 1;
      if (tone === "bad") state.heat += 2;
      resolveAction(text, tone);
      break;
    }
    case "Cousin":
      resolveAction("Dre reminds you to come home clean and not burn trust.", "good");
      break;
    case "Contacts":
      resolveAction("You keep your contact list tight and low-noise.");
      break;
    case "Messages":
      resolveAction("No open invitations. Earn your way into better messages.");
      break;
    case "Look for Work": {
      const payout = randomInt(35, 85);
      state.money += payout;
      state.reputation += 1;
      state.heat += randomInt(0, 2);
      resolveAction(`You pick up side work and clear $${payout}.`, "good");
      break;
    }
    case "Ask Around":
      state.heat += randomInt(0, 2);
      resolveAction("You ask around carefully and test the temperature.");
      break;
    case "Scope a Spot": {
      const damage = randomInt(0, 5);
      state.health -= damage;
      resolveAction(damage ? `You scope a spot and catch light damage (-${damage} health).` : "You scope a spot and slip out untouched.");
      break;
    }
    case "Inventory":
      resolveAction(`Inventory check: ${inventoryCount()} total items stashed.`, "", { skipAdvanceTime: true });
      break;
    case "Stats":
      resolveAction(`Stats — Cash $${state.money}, Health ${state.health}, Rep ${state.reputation}, Heat ${state.heat}.`, "", { skipAdvanceTime: true });
      break;
    case "Journal":
      resolveAction("You review today's choices and tighten your next move.", "", { skipAdvanceTime: true });
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
  render();
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    addLog("No saved game found.", "bad");
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
    render();
  } catch {
    addLog("Save data was corrupted.", "bad");
    render();
  }
}

el.startGameBtn.addEventListener("click", () => {
  const name = el.playerName.value.trim();
  startGame(name);
});

el.saveBtn.addEventListener("click", saveGame);
el.loadBtn.addEventListener("click", loadGame);
el.restartBtn.addEventListener("click", () => startGame(state.playerName || "Rookie"));
el.playAgainBtn.addEventListener("click", () => startGame(state.playerName || "Rookie"));

el.playerName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") el.startGameBtn.click();
});
