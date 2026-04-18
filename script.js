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

const state = {
  playerName: "",
  day: 1,
  time: "Morning",
  money: 200,
  health: 100,
  reputation: 0,
  heat: 0,
  location: "Cousin's Apt",
  activeCategory: "people",
  activeSubmenu: "Cousin",
  openingComplete: false,
  inventory: {},
  log: [],
  gameOver: false,
};

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
  state.log.unshift({ day: state.day, text, tone });
  state.log = state.log.slice(0, 80);
}

function advanceTime() {
  const cycle = ["Morning", "Afternoon", "Evening", "Late Night"];
  const idx = cycle.indexOf(state.time);
  state.time = cycle[(idx + 1) % cycle.length];
}

function renderHud() {
  el.hudPrimary.textContent = `907 HUSTLE | Day ${state.day} | ${state.time} | ${state.location}`;
  el.hudStats.textContent = `Cash: $${state.money} | Health: ${state.health} | Rep: ${state.reputation} | Heat: ${state.heat}`;
}

function renderScene() {
  el.sceneText.textContent =
    "Cousin's apartment feels cramped and temporary. A duffel bag sits by the couch, cheap blinds leak morning light, and city noise leaks through thin windows.";
}

function renderNav() {
  el.navRail.innerHTML = "";
  navCategories.forEach((category) => {
    const btn = document.createElement("button");
    btn.className = `nav-btn ${category.key === state.activeCategory ? "active" : ""}`;
    btn.innerHTML = `<span class="nav-icon">${category.icon}</span>${category.label}`;
    btn.addEventListener("click", () => {
      state.activeCategory = category.key;
      state.activeSubmenu = submenuByCategory[category.key][0];
      render();
    });
    el.navRail.appendChild(btn);
  });
}

function renderSubmenu() {
  const category = navCategories.find((entry) => entry.key === state.activeCategory);
  el.submenuTitle.textContent = category ? `${category.label} Options` : "Options";
  el.submenuPanel.innerHTML = "";

  submenuByCategory[state.activeCategory].forEach((entry) => {
    const btn = document.createElement("button");
    btn.className = `submenu-btn ${entry === state.activeSubmenu ? "active" : ""}`;
    btn.textContent = entry;
    btn.addEventListener("click", () => {
      state.activeSubmenu = entry;
      handleSubmenuAction(entry);
    });
    el.submenuPanel.appendChild(btn);
  });
}

function renderStory() {
  if (!state.openingComplete) {
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

  el.storyTitle.textContent = "Street Feed";
  const recent = state.log[0]?.text || "Pick an option on the left to make your next move.";
  el.storyText.textContent = recent;
  el.choiceButtons.innerHTML = "";
}

function renderDetailPanel() {
  el.detailTitle.textContent = state.openingComplete ? "Journal" : "Opening Notes";
  el.detailPanel.innerHTML = "";

  if (!state.log.length) {
    const row = document.createElement("div");
    row.className = "log-item";
    row.textContent = "No events yet. Your first move will set the tone.";
    el.detailPanel.appendChild(row);
    return;
  }

  state.log.slice(0, 10).forEach((entry) => {
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
  state.openingComplete = true;

  if (choice === "Talk to Cousin") {
    state.activeCategory = "people";
    state.activeSubmenu = "Cousin";
    state.reputation = clamp(state.reputation + 1, 0, 100);
    addLog("Your cousin lays out the rules: thirty days, no excuses, make something move.", "good");
  } else if (choice === "Wash Up") {
    state.activeCategory = "rest";
    state.activeSubmenu = "Recover";
    state.health = clamp(state.health + 4, 0, 100);
    addLog("Cold water wakes you up. You breathe, focus, and plan your first day.");
  } else {
    state.activeCategory = "move";
    state.activeSubmenu = "Step Outside";
    state.heat = clamp(state.heat + 1, 0, 100);
    addLog("You step outside and scan the block. The city already feels expensive.");
  }

  advanceTime();
  endOfActionCheck();
}

function handleSubmenuAction(action) {
  if (!state.openingComplete) {
    addLog("Handle your opening moment first.");
    render();
    return;
  }

  switch (action) {
    case "Step Outside": {
      state.location = "Downtown Anchorage";
      state.heat = clamp(state.heat + randomInt(0, 2), 0, 100);
      addLog("You step into the city and take stock of who is posted where.");
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
      addLog(text, tone);
      break;
    }
    case "Travel": {
      const destination = locations[randomInt(1, locations.length - 1)];
      state.location = destination;
      state.day += 1;
      state.heat = clamp(state.heat - randomInt(0, 2), 0, 100);
      addLog(`You relocate to ${destination}. A full day burns getting settled.`);
      break;
    }
    case "Cousin":
      state.reputation = clamp(state.reputation + 1, 0, 100);
      addLog("Your cousin gives you local names and warns you not to get sloppy.", "good");
      break;
    case "Contacts":
      addLog("You still have a thin contact list. One number might be worth calling.");
      break;
    case "Messages":
      addLog("No real motion in your inbox yet. You're still a stranger here.");
      break;
    case "Look for Work": {
      const payout = randomInt(45, 140);
      state.money += payout;
      state.reputation = clamp(state.reputation + randomInt(1, 3), 0, 100);
      state.heat = clamp(state.heat + randomInt(0, 3), 0, 100);
      addLog(`You catch a quick job and clear $${payout}.`, "good");
      break;
    }
    case "Ask Around": {
      state.heat = clamp(state.heat + randomInt(0, 2), 0, 100);
      addLog("You ask around for movement. People clock your face but stay guarded.");
      break;
    }
    case "Scope a Spot": {
      const injury = randomInt(0, 6);
      state.health = clamp(state.health - injury, 0, 100);
      addLog(injury ? `You scope a spot and catch minor trouble (-${injury} health).` : "You scope a spot and slip out unseen.");
      break;
    }
    case "Inventory":
      addLog(`Inventory check: ${inventoryCount()} total items stashed.`);
      break;
    case "Stats":
      addLog(`Current stats — Cash $${state.money}, Health ${state.health}, Rep ${state.reputation}, Heat ${state.heat}.`);
      break;
    case "Journal":
      addLog("You review your journal and tighten your next steps.");
      break;
    case "Sleep":
      state.day += 1;
      state.time = "Morning";
      state.health = clamp(state.health + 12, 0, 100);
      addLog("You sleep hard and recover for the next push.", "good");
      break;
    case "Wait":
      addLog("You keep your head down and let the block reset.");
      break;
    case "Recover":
      state.health = clamp(state.health + 7, 0, 100);
      state.money = Math.max(0, state.money - 10);
      addLog("You spend $10 on food and supplies, then reset your body.");
      break;
    default:
      addLog("No action tied to that option yet.");
  }

  advanceTime();
  endOfActionCheck();
}

function endOfActionCheck() {
  if (state.health <= 0) {
    state.gameOver = true;
    return endGame("You couldn't survive the streets. Your run ends cold.");
  }

  if (state.day > GAME_DAYS) {
    state.gameOver = true;
    return endGame(buildOutcome());
  }

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
  state.playerName = name || "Rookie";
  state.day = 1;
  state.time = "Morning";
  state.money = 200;
  state.health = 100;
  state.reputation = 0;
  state.heat = 0;
  state.location = "Cousin's Apt";
  state.activeCategory = "people";
  state.activeSubmenu = "Cousin";
  state.openingComplete = false;
  state.inventory = {};
  state.log = [];
  state.gameOver = false;

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
    Object.assign(state, loaded);
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
