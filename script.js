const GAME_DAYS = 30;
const INVENTORY_CAPACITY = 30;
const SAVE_KEY = "underworld907_save";

const locations = [
  "Downtown Anchorage",
  "Spenard",
  "Mountain View",
  "Muldoon",
  "South Addition",
];

const items = {
  drugs: ["Ice", "Powder", "Shrooms"],
  "stolen goods": ["Bike", "Copper", "Tools"],
  "fake IDs": ["State ID", "Work Permit", "Passport"],
  weapons: ["Knife", "Pistol", "Shotgun"],
  pills: ["Painkillers", "Xanax", "Adderall"],
  electronics: ["Phone", "Tablet", "Laptop"],
};

const basePrices = {
  Ice: 120,
  Powder: 180,
  Shrooms: 90,
  Bike: 140,
  Copper: 85,
  Tools: 110,
  "State ID": 200,
  "Work Permit": 260,
  Passport: 320,
  Knife: 90,
  Pistol: 260,
  Shotgun: 380,
  Painkillers: 70,
  Xanax: 95,
  Adderall: 130,
  Phone: 230,
  Tablet: 280,
  Laptop: 420,
};

const state = {
  playerName: "",
  day: 1,
  money: 100,
  health: 100,
  reputation: 0,
  heat: 0,
  location: locations[0],
  inventory: {},
  relationship: {
    met: false,
    name: "Nina",
    attraction: 0,
    trust: 0,
  },
  pricesByLocation: {},
  log: [],
  gameOver: false,
};

const el = {
  startScreen: document.getElementById("startScreen"),
  gameScreen: document.getElementById("gameScreen"),
  endScreen: document.getElementById("endScreen"),
  playerName: document.getElementById("playerName"),
  startGameBtn: document.getElementById("startGameBtn"),
  welcomeName: document.getElementById("welcomeName"),
  dayLocation: document.getElementById("dayLocation"),
  statsGrid: document.getElementById("statsGrid"),
  marketList: document.getElementById("marketList"),
  itemSelect: document.getElementById("itemSelect"),
  qtyInput: document.getElementById("qtyInput"),
  buyBtn: document.getElementById("buyBtn"),
  sellBtn: document.getElementById("sellBtn"),
  inventoryList: document.getElementById("inventoryList"),
  capacityText: document.getElementById("capacityText"),
  locationSelect: document.getElementById("locationSelect"),
  travelBtn: document.getElementById("travelBtn"),
  robBtn: document.getElementById("robBtn"),
  nightlifeBtn: document.getElementById("nightlifeBtn"),
  checkRelationshipBtn: document.getElementById("checkRelationshipBtn"),
  eventLog: document.getElementById("eventLog"),
  saveBtn: document.getElementById("saveBtn"),
  loadBtn: document.getElementById("loadBtn"),
  restartBtn: document.getElementById("restartBtn"),
  outcomeSummary: document.getElementById("outcomeSummary"),
  finalStats: document.getElementById("finalStats"),
  playAgainBtn: document.getElementById("playAgainBtn"),
};

function allItemNames() {
  return Object.values(items).flat();
}

function currentPrices() {
  return state.pricesByLocation[state.location] || {};
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function inventoryCount() {
  return Object.values(state.inventory).reduce((sum, qty) => sum + qty, 0);
}

function canCarry(qty) {
  return inventoryCount() + qty <= INVENTORY_CAPACITY;
}

function generatePrices() {
  const names = allItemNames();
  locations.forEach((loc) => {
    state.pricesByLocation[loc] = {};
    names.forEach((name) => {
      const volatility = randomInt(65, 150) / 100;
      state.pricesByLocation[loc][name] = Math.max(25, Math.floor(basePrices[name] * volatility));
    });
  });
}

function populateSelectors() {
  el.itemSelect.innerHTML = "";
  allItemNames().forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    el.itemSelect.appendChild(opt);
  });

  el.locationSelect.innerHTML = "";
  locations.forEach((loc) => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    el.locationSelect.appendChild(opt);
  });
}

function addLog(text, tone = "") {
  state.log.unshift({ text, tone, day: state.day });
  state.log = state.log.slice(0, 80);
}

function renderLog() {
  el.eventLog.innerHTML = "";
  state.log.forEach((entry) => {
    const row = document.createElement("div");
    row.className = `log-item ${entry.tone}`;
    row.textContent = `Day ${entry.day}: ${entry.text}`;
    el.eventLog.appendChild(row);
  });
}

function renderStats() {
  const stats = [
    ["Cash", `$${state.money}`],
    ["Health", state.health],
    ["Reputation", state.reputation],
    ["Heat", state.heat],
    ["Day", `${state.day}/${GAME_DAYS}`],
    ["Location", state.location],
  ];

  el.statsGrid.innerHTML = "";
  stats.forEach(([label, value]) => {
    const box = document.createElement("div");
    box.className = "stat";
    box.innerHTML = `<small>${label}</small><strong>${value}</strong>`;
    el.statsGrid.appendChild(box);
  });
}

function renderMarket() {
  const prices = currentPrices();
  el.marketList.innerHTML = "";

  Object.entries(items).forEach(([category, names]) => {
    names.forEach((name) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `<span>${name} <small class="muted">(${category})</small></span><strong>$${prices[name]}</strong>`;
      el.marketList.appendChild(row);
    });
  });
}

function renderInventory() {
  el.inventoryList.innerHTML = "";
  const entries = Object.entries(state.inventory).filter(([, qty]) => qty > 0);

  if (!entries.length) {
    const row = document.createElement("div");
    row.className = "list-row";
    row.textContent = "No inventory yet.";
    el.inventoryList.appendChild(row);
  } else {
    entries.forEach(([name, qty]) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `<span>${name}</span><strong>x${qty}</strong>`;
      el.inventoryList.appendChild(row);
    });
  }

  el.capacityText.textContent = `Capacity: ${inventoryCount()} / ${INVENTORY_CAPACITY}`;
}

function renderHeader() {
  el.welcomeName.textContent = `Welcome, ${state.playerName}`;
  el.dayLocation.textContent = `Day ${state.day} • ${state.location}`;
  el.locationSelect.value = state.location;
}

function render() {
  renderHeader();
  renderStats();
  renderMarket();
  renderInventory();
  renderLog();
}

function policePressureCheck() {
  const pressureChance = Math.min(55, 8 + state.heat);
  if (randomInt(1, 100) <= pressureChance) {
    const cashLoss = randomInt(20, 80);
    const healthLoss = randomInt(0, 12);
    state.money = Math.max(0, state.money - cashLoss);
    state.health = clamp(state.health - healthLoss, 0, 100);
    addLog(`Police pressure is heavy. You lost $${cashLoss}${healthLoss ? ` and ${healthLoss} health` : ""}.`, "bad");
  }
}

function randomEvent() {
  const roll = randomInt(1, 100);

  if (roll <= 20) {
    state.heat = clamp(state.heat + randomInt(4, 9), 0, 100);
    addLog("Street checkpoints tighten. Heat climbs.", "bad");
  } else if (roll <= 35) {
    const repLoss = randomInt(1, 4);
    state.reputation = Math.max(0, state.reputation - repLoss);
    addLog("A rival crew undercuts your deal. Reputation slips.", "bad");
  } else if (roll <= 50) {
    const bonus = randomInt(40, 130);
    state.money += bonus;
    addLog(`Lucky deal from a dock contact earns you $${bonus}.`, "good");
  } else if (roll <= 65) {
    const healthLoss = randomInt(5, 17);
    state.health = clamp(state.health - healthLoss, 0, 100);
    addLog(`Things turned violent. You took ${healthLoss} damage.`, "bad");
  } else if (roll <= 80) {
    const item = allItemNames()[randomInt(0, allItemNames().length - 1)];
    const discount = Math.floor(currentPrices()[item] * 0.7);
    state.pricesByLocation[state.location][item] = discount;
    addLog(`Special offer: ${item} is running hot at only $${discount} today.`, "good");
  }
}

function relationshipEncounter() {
  if (!state.relationship.met && randomInt(1, 100) <= 28) {
    state.relationship.met = true;
    state.relationship.attraction = randomInt(8, 18);
    state.relationship.trust = randomInt(4, 12);
    addLog("You meet Nina at a late-night lounge in Spenard. She remembers your face.", "good");
    return;
  }

  if (!state.relationship.met) {
    addLog("Nightlife was loud but empty for you tonight.");
    return;
  }

  const roll = randomInt(1, 100);
  if (roll <= 35) {
    state.relationship.attraction = clamp(state.relationship.attraction + randomInt(2, 7), 0, 100);
    state.relationship.trust = clamp(state.relationship.trust + randomInt(1, 4), 0, 100);
    addLog("You and Nina hit it off. Attraction and trust rise.", "good");
  } else if (roll <= 65) {
    const giftCost = randomInt(20, 60);
    if (state.money >= giftCost) {
      state.money -= giftCost;
      state.relationship.trust = clamp(state.relationship.trust + randomInt(3, 8), 0, 100);
      addLog(`You spend $${giftCost} on a night out with Nina. Trust grows.`, "good");
    } else {
      state.relationship.trust = clamp(state.relationship.trust - 2, 0, 100);
      addLog("You couldn't cover the night tab. Trust dips.", "bad");
    }
  } else if (roll <= 82) {
    const tip = randomInt(35, 120);
    state.money += tip;
    state.relationship.trust = clamp(state.relationship.trust + 2, 0, 100);
    addLog(`Nina tips you off to a quick score worth $${tip}.`, "good");
  } else {
    state.heat = clamp(state.heat + randomInt(4, 10), 0, 100);
    state.relationship.trust = clamp(state.relationship.trust - randomInt(2, 6), 0, 100);
    addLog("Nina gets spooked by your heat. Things get complicated.", "bad");
  }
}

function attemptRobbery() {
  const risk = 45 + Math.floor(state.heat * 0.35) - Math.floor(state.reputation * 0.15);
  const successChance = clamp(60 - risk + 40, 10, 85);

  if (randomInt(1, 100) <= successChance) {
    const gain = randomInt(70, 210) + Math.floor(state.reputation * 0.8);
    state.money += gain;
    state.reputation = clamp(state.reputation + randomInt(2, 7), 0, 100);
    state.heat = clamp(state.heat + randomInt(8, 15), 0, 100);
    addLog(`Robbery successful. You scored $${gain}, but heat rose.`, "good");
  } else {
    const injury = randomInt(8, 22);
    const loss = randomInt(25, 90);
    state.health = clamp(state.health - injury, 0, 100);
    state.money = Math.max(0, state.money - loss);
    state.heat = clamp(state.heat + randomInt(10, 18), 0, 100);
    addLog(`Robbery failed. You lost $${loss} and took ${injury} damage.`, "bad");
  }

  if (state.reputation >= 45 && randomInt(1, 100) <= 25) {
    const bonus = randomInt(90, 220);
    state.money += bonus;
    addLog(`Your name carries weight now. A bigger opportunity pays $${bonus}.`, "good");
  }

  endOfActionCheck();
}

function buySelected() {
  const item = el.itemSelect.value;
  const qty = parseInt(el.qtyInput.value, 10);
  if (!item || Number.isNaN(qty) || qty <= 0) {
    addLog("Pick a valid item and quantity.", "bad");
    return;
  }

  if (!canCarry(qty)) {
    addLog("Not enough inventory space.", "bad");
    return;
  }

  const price = currentPrices()[item] * qty;
  if (state.money < price) {
    addLog("You don't have enough cash.", "bad");
    return;
  }

  state.money -= price;
  state.inventory[item] = (state.inventory[item] || 0) + qty;
  state.heat = clamp(state.heat + randomInt(0, 2), 0, 100);
  addLog(`Bought ${qty} ${item} for $${price}.`);
  endOfActionCheck();
}

function sellSelected() {
  const item = el.itemSelect.value;
  const qty = parseInt(el.qtyInput.value, 10);
  if (!item || Number.isNaN(qty) || qty <= 0) {
    addLog("Pick a valid item and quantity.", "bad");
    return;
  }

  const owned = state.inventory[item] || 0;
  if (owned < qty) {
    addLog("Not enough stock to sell.", "bad");
    return;
  }

  const value = currentPrices()[item] * qty;
  state.inventory[item] -= qty;
  state.money += value;
  state.reputation = clamp(state.reputation + randomInt(0, 2), 0, 100);
  addLog(`Sold ${qty} ${item} for $${value}.`, "good");
  endOfActionCheck();
}

function travel() {
  const destination = el.locationSelect.value;
  if (!destination || destination === state.location) {
    addLog("You're already there. Pick another district.");
    return;
  }

  state.location = destination;
  state.day += 1;
  generatePrices();
  state.heat = clamp(state.heat - randomInt(1, 4), 0, 100);
  addLog(`You moved to ${destination}. A day passes and markets reset.`);

  randomEvent();
  policePressureCheck();
  endOfActionCheck();
}

function checkRelationship() {
  if (!state.relationship.met) {
    addLog("No active relationship. Hit nightlife and meet someone.");
    return;
  }

  addLog(
    `Relationship with ${state.relationship.name}: Attraction ${state.relationship.attraction}, Trust ${state.relationship.trust}.`
  );
}

function nightlife() {
  state.day += 1;
  state.heat = clamp(state.heat + randomInt(0, 3), 0, 100);
  generatePrices();
  relationshipEncounter();
  randomEvent();
  policePressureCheck();
  endOfActionCheck();
}

function endOfActionCheck() {
  if (state.health <= 0) {
    state.gameOver = true;
    return endGame("You couldn't survive the streets. Your run ends in an icy alley.");
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

  const rel = state.relationship.met
    ? `Nina status — Attraction ${state.relationship.attraction}, Trust ${state.relationship.trust}.`
    : "You stayed solo the whole run.";

  return `${state.playerName}, after 30 days you became: ${tier}. Final heat: ${state.heat}. ${rel}`;
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
    ["Inventory Slots Used", `${inventoryCount()} / ${INVENTORY_CAPACITY}`],
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
  state.money = 100;
  state.health = 100;
  state.reputation = 0;
  state.heat = 0;
  state.location = locations[0];
  state.inventory = {};
  state.relationship = { met: false, name: "Nina", attraction: 0, trust: 0 };
  state.log = [];
  state.gameOver = false;

  generatePrices();
  populateSelectors();
  addLog("You arrived in Anchorage with $100 and no allies.");

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
    populateSelectors();
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

el.buyBtn.addEventListener("click", buySelected);
el.sellBtn.addEventListener("click", sellSelected);
el.travelBtn.addEventListener("click", travel);
el.robBtn.addEventListener("click", attemptRobbery);
el.nightlifeBtn.addEventListener("click", nightlife);
el.checkRelationshipBtn.addEventListener("click", checkRelationship);
el.saveBtn.addEventListener("click", saveGame);
el.loadBtn.addEventListener("click", loadGame);
el.restartBtn.addEventListener("click", () => startGame(state.playerName || "Rookie"));
el.playAgainBtn.addEventListener("click", () => startGame(state.playerName || "Rookie"));

el.playerName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    el.startGameBtn.click();
  }
});
