const GAME_DAYS = 30;
const SAVE_KEY = "hustle907_save";

const locations = [
  "Cousin's Apt",
  "Downtown Anchorage",
  "Spenard",
  "Mountain View",
  "Muldoon",
  "South Addition",
];

const navCategories = [
  { key: "move", label: "Move", icon: "🧭" },
  { key: "people", label: "People", icon: "👥" },
  { key: "hustle", label: "Hustle", icon: "💼" },
  { key: "info", label: "Info", icon: "📓" },
  { key: "rest", label: "Rest", icon: "🛌" },
];

const submenuByCategory = {
  move: ["Step Outside", "Check Area", "Travel"],
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
    location: "Cousin's Apt",
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
    },
    metrics: {},
    unlocks: {
      events: ["house_rules"],
      locations: [],
      vendors: [],
    },
    eventState: {
      seen: {},
      completed: {},
      lastTriggeredDay: {},
      cooldowns: {},
      runtime: {
        unlockedEvents: ["house_rules"],
        lastEventDay: 0,
      },
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

const sceneByLocation = {
  "Cousin's Apt": {
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Gritty pixel-style view of cousin's apartment with thin blinds and a worn couch.",
    text: "Cousin's apartment feels cramped and temporary. A duffel bag sits by the couch, cheap blinds leak cold light, and city noise pushes through thin windows.",
  },
  "Downtown Anchorage": {
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Dark city block in Anchorage at street level.",
    text: "Downtown traffic and foot movement never fully settle. You can feel hustle, pressure, and cameras on every block.",
  },
  Spenard: {
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Street corner in Spenard with low light and parked cars.",
    text: "Spenard moves on side conversations and favors. If you listen more than you talk, people show you where motion is.",
  },
  "Mountain View": {
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Anchorage neighborhood view at dusk.",
    text: "Mountain View carries tension and community at the same time. Outsiders get sized up quickly.",
  },
  Muldoon: {
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Muted neighborhood street with apartments and overhead wires.",
    text: "Muldoon feels spread out and watchful. Good for laying low, bad for sloppy moves.",
  },
  "South Addition": {
    art: "assets/cousins-apt-placeholder.svg",
    alt: "Older buildings in South Addition with moody evening light.",
    text: "South Addition has money close by but pressure too. One wrong read can bring heat fast.",
  },
};

const v01EventChain = [
  {
    id: "house_rules",
    title: "House Rules",
    text: "Your cousin sets terms: make clean moves, don't burn the couch, and build with people who can vouch for you.",
    cooldownDays: 0,
    requirements: { minDay: 1 },
    unlocks: ["first_purchase"],
    choices: [
      {
        id: "listen_and_lock_in",
        label: "Listen and lock in",
        outcomeText: "You keep your mouth shut and absorb game. People clock that discipline.",
        outcome: { reputation: 1, relationships: { dre_trust: 1 }, completeEvent: true },
      },
      {
        id: "push_back",
        label: "Push back a little",
        outcomeText: "You test your cousin's patience and get checked quick.",
        outcome: { heat: 1, relationships: { dre_trust: -1 }, completeEvent: true },
      },
    ],
  },
  {
    id: "first_purchase",
    title: "First Purchase",
    text: "A bodega clerk offers a starter package. What you buy shapes your first week.",
    cooldownDays: 0,
    requirements: { minMoney: 30 },
    unlocks: ["burner_line"],
    choices: [
      {
        id: "buy_burner",
        label: "Buy burner phone ($75)",
        requirements: { minMoney: 75 },
        outcomeText: "You buy a burner and keep one clean line for business.",
        outcome: {
          money: -75,
          inventory: { burner_phone: 1 },
          relationships: { mina_trust: 1 },
          completeEvent: true,
        },
      },
      {
        id: "buy_meds_and_snacks",
        label: "Buy meds + snacks ($30)",
        requirements: { minMoney: 30 },
        outcomeText: "You stock up to stay steady and avoid sloppy hunger moves.",
        outcome: {
          money: -30,
          inventory: { basic_meds: 1, snacks: 1 },
          health: 3,
          completeEvent: true,
        },
      },
      {
        id: "hold_cash",
        label: "Hold your cash",
        outcomeText: "You pass on buying anything and keep your pocket tight.",
        outcome: { reputation: -1, completeEvent: true },
      },
    ],
  },
  {
    id: "burner_line",
    title: "Burner Line",
    text: "A number gets slid to you for after-hours movement. How you make contact matters.",
    cooldownDays: 1,
    requirements: { minReputation: 1 },
    unlocks: ["minas_quiet_suggestion"],
    choices: [
      {
        id: "use_burner",
        label: "Call from burner",
        requirements: { inventory: { burner_phone: 1 } },
        outcomeText: "You call off the burner. Mina notes you moved careful.",
        outcome: { reputation: 2, relationships: { mina_trust: 1 }, completeEvent: true },
      },
      {
        id: "borrow_random_phone",
        label: "Borrow a random phone",
        outcomeText: "The line still connects, but sloppy routing puts eyes on you.",
        outcome: { heat: 3, relationships: { mina_trust: -1 }, completeEvent: true },
      },
    ],
  },
  {
    id: "minas_quiet_suggestion",
    title: "Mina's Quiet Suggestion",
    text: "Mina tells you about a low-noise lane if you can move with patience.",
    cooldownDays: 1,
    requirements: { relationships: { mina_trust: 1 }, maxHeat: 65 },
    unlocks: ["quick_lot_run"],
    choices: [
      {
        id: "take_advice",
        label: "Take Mina's lane",
        outcomeText: "You follow Mina's route and earn respect for staying invisible.",
        outcome: { money: 120, reputation: 2, relationships: { mina_trust: 1 }, completeEvent: true },
      },
      {
        id: "go_loud",
        label: "Ignore and go loud",
        outcomeText: "You freestyle in a hot lane. Quick cash, but way more attention.",
        outcome: { money: 170, heat: 4, completeEvent: true },
      },
    ],
  },
  {
    id: "quick_lot_run",
    title: "Quick Lot Run",
    text: "A parking lot exchange opens for ten minutes. It's pure speed and read-react.",
    cooldownDays: 2,
    requirements: { minReputation: 4, maxHeat: 75 },
    unlocks: ["rook_sizes_you_up"],
    choices: [
      {
        id: "run_it_clean",
        label: "Run it clean",
        outcomeText: "You keep it short and sharp. Money lands, no extra noise.",
        outcome: { money: 220, reputation: 2, heat: -1, completeEvent: true },
      },
      {
        id: "double_back_for_more",
        label: "Double back for more",
        outcomeText: "Greed gets you one extra handoff and a camera angle you don't like.",
        outcome: { money: 300, heat: 5, health: -4, completeEvent: true },
      },
    ],
  },
  {
    id: "rook_sizes_you_up",
    title: "Rook Sizes You Up",
    text: "Rook posts at the fence and studies your face, deciding if you're real or temporary.",
    cooldownDays: 2,
    requirements: { minMoney: 250, minReputation: 6 },
    unlocks: ["dre_checks_your_face"],
    choices: [
      {
        id: "stand_tall",
        label: "Stand tall and answer direct",
        outcomeText: "Rook respects the calm. He stops testing and starts passing your name.",
        outcome: { reputation: 3, relationships: { dre_trust: 1 }, completeEvent: true },
      },
      {
        id: "duck_out",
        label: "Duck out early",
        outcomeText: "You leave before pressure peaks. Rook marks you as uncertain.",
        outcome: { reputation: -2, heat: -1, completeEvent: true },
      },
    ],
  },
  {
    id: "dre_checks_your_face",
    title: "Dre Checks Your Face",
    text: "Dre finally pulls up and gives you a long look. This decides whether doors stay open.",
    cooldownDays: 3,
    requirements: { minReputation: 8, relationships: { dre_trust: 2 }, maxHeat: 80 },
    choices: [
      {
        id: "keep_it_honest",
        label: "Keep it honest",
        outcomeText: "Dre nods once. You're not family, but you're official now.",
        outcome: {
          money: 300,
          reputation: 4,
          relationships: { dre_trust: 2 },
          unlockState: { vendors: ["dre-network"] },
          completeEvent: true,
        },
      },
      {
        id: "oversell",
        label: "Oversell your résumé",
        outcomeText: "Dre hears the cap and goes cold. You're frozen out for now.",
        outcome: { reputation: -3, heat: 2, relationships: { dre_trust: -2 }, completeEvent: true },
      },
    ],
  },
];

const eventById = Object.fromEntries(v01EventChain.map((event) => [event.id, event]));

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function inventoryCount() {
  return Object.values(state.inventory).reduce((sum, qty) => sum + qty, 0);
}

function addLog(text, tone = "") {
  uiState.log.unshift({ day: state.day, text, tone });
  uiState.log = uiState.log.slice(0, 80);
}

function advanceTime() {
  const cycle = ["Morning", "Afternoon", "Evening", "Late Night"];
  const idx = cycle.indexOf(state.timeOfDay);
  state.timeOfDay = cycle[(idx + 1) % cycle.length];
}

function renderHud() {
  el.hudPrimary.textContent = `907 HUSTLE | Day ${state.day} | ${state.timeOfDay} | ${state.location}`;
  el.hudStats.textContent = `Cash: $${state.money} | Health: ${state.health} | Rep: ${state.reputation} | Heat: ${state.heat}`;
}

function getEventRuntimeState() {
  if (!state.eventState.runtime) {
    state.eventState.runtime = {
      unlockedEvents: ["house_rules"],
      lastEventDay: 0,
    };
  }
  if (!Array.isArray(state.eventState.runtime.unlockedEvents)) {
    state.eventState.runtime.unlockedEvents = ["house_rules"];
  }
  return state.eventState.runtime;
}

function evaluateRequirements(requirements = {}) {
  if (requirements.minDay && state.day < requirements.minDay) return false;
  if (requirements.minMoney && state.money < requirements.minMoney) return false;
  if (requirements.minReputation && state.reputation < requirements.minReputation) return false;
  if (requirements.maxHeat !== undefined && state.heat > requirements.maxHeat) return false;

  if (requirements.inventory) {
    const hasInventory = Object.entries(requirements.inventory).every(
      ([item, needed]) => (state.inventory[item] || 0) >= needed,
    );
    if (!hasInventory) return false;
  }

  if (requirements.relationships) {
    const hasRelationships = Object.entries(requirements.relationships).every(
      ([person, needed]) => (state.relationships[person] || 0) >= needed,
    );
    if (!hasRelationships) return false;
  }

  return true;
}

function unlockEvents(eventIds = []) {
  const runtime = getEventRuntimeState();
  eventIds.forEach((eventId) => {
    if (!eventById[eventId]) return;
    if (!runtime.unlockedEvents.includes(eventId)) runtime.unlockedEvents.push(eventId);
    if (!state.unlocks.events.includes(eventId)) state.unlocks.events.push(eventId);
  });
}

function applyEventOutcome(outcome = {}) {
  if (outcome.money) state.money = Math.max(0, state.money + outcome.money);
  if (outcome.health) state.health = clamp(state.health + outcome.health, 0, 100);
  if (outcome.reputation) state.reputation = clamp(state.reputation + outcome.reputation, 0, 100);
  if (outcome.heat) state.heat = clamp(state.heat + outcome.heat, 0, 100);

  if (outcome.inventory) {
    Object.entries(outcome.inventory).forEach(([item, delta]) => {
      const current = state.inventory[item] || 0;
      state.inventory[item] = Math.max(0, current + delta);
    });
  }

  if (outcome.relationships) {
    Object.entries(outcome.relationships).forEach(([person, delta]) => {
      const current = state.relationships[person] || 0;
      state.relationships[person] = clamp(current + delta, -10, 100);
    });
  }

  if (outcome.unlockState?.vendors) {
    outcome.unlockState.vendors.forEach((vendor) => {
      if (!state.unlocks.vendors.includes(vendor)) state.unlocks.vendors.push(vendor);
    });
  }

  if (outcome.unlockState?.locations) {
    outcome.unlockState.locations.forEach((location) => {
      if (!state.unlocks.locations.includes(location)) state.unlocks.locations.push(location);
    });
  }

  if (outcome.unlockEvents) unlockEvents(outcome.unlockEvents);
}

function runEventRuntime() {
  if (!state.flags.openingComplete || uiState.gameOver || uiState.pendingEvent) return null;

  const runtime = getEventRuntimeState();
  if (runtime.lastEventDay === state.day) return null;

  const activeEvent = runtime.unlockedEvents
    .map((eventId) => eventById[eventId])
    .find((event) => {
      if (!event || state.eventState.completed[event.id]) return false;
      const cooldownReady = (state.eventState.cooldowns[event.id] || 0) <= state.day;
      return cooldownReady && evaluateRequirements(event.requirements);
    });

  if (!activeEvent) return null;

  state.eventState.seen[activeEvent.id] = (state.eventState.seen[activeEvent.id] || 0) + 1;
  state.eventState.lastTriggeredDay[activeEvent.id] = state.day;
  state.eventState.cooldowns[activeEvent.id] = state.day + (activeEvent.cooldownDays || 0);
  runtime.lastEventDay = state.day;

  return activeEvent;
}

function renderScene() {
  const scene = sceneByLocation[state.location] || sceneByLocation["Cousin's Apt"];
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
      "You wake up stiff on the couch.\nYour cousin gave you thirty days.\nYou got two hundred dollars, no motion, and no one in this city really checking for you yet.\nYou hear movement in the kitchen.\nWhat do you do first?";

    el.choiceButtons.innerHTML = "";
    ["Talk to Cousin", "Wash Up", "Step Outside"].forEach((choice) => {
      const button = document.createElement("button");
      button.className = "choice-btn";
      button.textContent = choice;
      button.addEventListener("click", () => openingChoice(choice));
      el.choiceButtons.appendChild(button);
    });
    return;
  }

  if (uiState.awaitingContinue && uiState.pendingResult) {
    el.storyTitle.textContent = "Action Result";
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

function openingChoice(choice) {
  state.flags.openingComplete = true;
  let resultText = "";
  let tone = "";

  if (choice === "Talk to Cousin") {
    uiState.activeCategory = "people";
    uiState.activeSubmenu = "Cousin";
    state.reputation = clamp(state.reputation + 1, 0, 100);
    resultText = "Your cousin lays out the rules: thirty days, no excuses, make something move.";
    tone = "good";
  } else if (choice === "Wash Up") {
    uiState.activeCategory = "rest";
    uiState.activeSubmenu = "Recover";
    state.health = clamp(state.health + 4, 0, 100);
    resultText = "Cold water wakes you up. You breathe, focus, and plan your first day.";
  } else {
    uiState.activeCategory = "move";
    uiState.activeSubmenu = "Step Outside";
    state.heat = clamp(state.heat + 1, 0, 100);
    resultText = "You step outside and scan the block. The city already feels expensive.";
  }

  resolveAction(resultText, tone);
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
      state.location = "Downtown Anchorage";
      state.heat = clamp(state.heat + randomInt(0, 2), 0, 100);
      resolveAction("You step into the city and take stock of who is posted where.");
      break;
    }
    case "Check Area": {
      const outcomes = [
        ["A corner runner points you toward a low-profile block.", "good"],
        ["Cops drift through and everyone goes quiet.", "bad"],
        ["You learn who is taxing this area and who to avoid.", ""],
      ];
      const [text, tone] = outcomes[randomInt(0, outcomes.length - 1)];
      if (tone === "good") state.reputation = clamp(state.reputation + 1, 0, 100);
      if (tone === "bad") state.heat = clamp(state.heat + 2, 0, 100);
      resolveAction(text, tone);
      break;
    }
    case "Travel": {
      const destination = locations[randomInt(1, locations.length - 1)];
      state.location = destination;
      state.day += 1;
      state.heat = clamp(state.heat - randomInt(0, 2), 0, 100);
      resolveAction(`You relocate to ${destination}. A full day burns getting settled.`);
      break;
    }
    case "Cousin":
      state.reputation = clamp(state.reputation + 1, 0, 100);
      resolveAction("Your cousin gives you local names and warns you not to get sloppy.", "good");
      break;
    case "Contacts":
      resolveAction("You still have a thin contact list. One number might be worth calling.");
      break;
    case "Messages":
      resolveAction("No real motion in your inbox yet. You're still a stranger here.");
      break;
    case "Look for Work": {
      const payout = randomInt(45, 140);
      state.money += payout;
      state.reputation = clamp(state.reputation + randomInt(1, 3), 0, 100);
      state.heat = clamp(state.heat + randomInt(0, 3), 0, 100);
      resolveAction(`You catch a quick job and clear $${payout}.`, "good");
      break;
    }
    case "Ask Around": {
      state.heat = clamp(state.heat + randomInt(0, 2), 0, 100);
      resolveAction("You ask around for movement. People clock your face but stay guarded.");
      break;
    }
    case "Scope a Spot": {
      const injury = randomInt(0, 6);
      state.health = clamp(state.health - injury, 0, 100);
      resolveAction(injury ? `You scope a spot and catch minor trouble (-${injury} health).` : "You scope a spot and slip out unseen.");
      break;
    }
    case "Inventory":
      resolveAction(`Inventory check: ${inventoryCount()} total items stashed.`);
      break;
    case "Stats":
      resolveAction(`Current stats — Cash $${state.money}, Health ${state.health}, Rep ${state.reputation}, Heat ${state.heat}.`);
      break;
    case "Journal":
      resolveAction("You review your journal and tighten your next steps.");
      break;
    case "Sleep":
      state.day += 1;
      state.timeOfDay = "Morning";
      state.health = clamp(state.health + 12, 0, 100);
      resolveAction("You sleep hard and recover for the next push.", "good", { skipAdvanceTime: true });
      break;
    case "Wait":
      resolveAction("You keep your head down and let the block reset.");
      break;
    case "Recover":
      state.health = clamp(state.health + 7, 0, 100);
      state.money = Math.max(0, state.money - 10);
      resolveAction("You spend $10 on food and supplies, then reset your body.");
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

function resolveAction(text, tone = "", options = {}) {
  const { skipAdvanceTime = false } = options;
  addLog(text, tone);
  if (!skipAdvanceTime) advanceTime();

  const runtimeEvent = runEventRuntime();
  if (runtimeEvent) {
    const runtimeText = `[${runtimeEvent.title}] ${runtimeEvent.text}`;
    uiState.pendingEvent = {
      id: runtimeEvent.id,
      title: runtimeEvent.title,
      choices: runtimeEvent.choices || [],
      awaitingChoice: Array.isArray(runtimeEvent.choices) && runtimeEvent.choices.length > 0,
    };

    if (!uiState.pendingEvent.awaitingChoice) {
      state.eventState.completed[runtimeEvent.id] = true;
      unlockEvents(runtimeEvent.unlocks || []);
      addLog(runtimeText, "good");
      uiState.pendingResult = { text: `${text}\n\n${runtimeText}`, tone };
    } else {
      uiState.pendingResult = { text: `${text}\n\n${runtimeText}`, tone };
    }
  } else {
    uiState.pendingEvent = null;
    uiState.pendingResult = { text, tone };
  }

  uiState.awaitingContinue = true;
  endOfActionCheck();
}

function resolveEventChoice(eventId, choiceId) {
  const event = eventById[eventId];
  if (!event) return;

  const choice = (event.choices || []).find((entry) => entry.id === choiceId);
  if (!choice || !evaluateRequirements(choice.requirements || {})) return;

  applyEventOutcome(choice.outcome || {});
  const completeEvent = choice.outcome?.completeEvent !== false;
  if (completeEvent) {
    state.eventState.completed[eventId] = true;
    unlockEvents(event.unlocks || []);
  }

  addLog(`[${event.title}] ${choice.outcomeText}`, "good");
  uiState.pendingResult = {
    text: `${uiState.pendingResult?.text || ""}\n\n${choice.outcomeText}`.trim(),
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
  render();
}

function buildOutcome() {
  let tier = "A forgotten drifter";
  if (state.money >= 2000 || state.reputation >= 35) tier = "A connected hustler";
  if (state.money >= 4500 || state.reputation >= 60) tier = "A rising underworld name";
  if (state.money >= 8000 && state.reputation >= 75) tier = "An Anchorage kingpin";

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
    ["Location", state.location],
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
    if (!loaded.timeOfDay && loaded.time) loaded.timeOfDay = loaded.time;
    Object.assign(state, createOpeningState(), loaded);
    state.eventState = Object.assign(createOpeningState().eventState, loaded.eventState || {});
    state.eventState.runtime = Object.assign(createOpeningState().eventState.runtime, state.eventState.runtime || {});
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
