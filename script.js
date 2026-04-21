const DRUGS = [
  { id: "weed", displayName: "Weed", minPrice: 18, maxPrice: 85, volatility: 0.22, riskTier: 1, category: "street" },
  { id: "cocaine", displayName: "Cocaine", minPrice: 180, maxPrice: 650, volatility: 0.28, riskTier: 3, category: "powder" },
  { id: "adderall", displayName: "Adderall", minPrice: 22, maxPrice: 120, volatility: 0.24, riskTier: 2, category: "pill" },
  { id: "heroin", displayName: "Heroin", minPrice: 130, maxPrice: 500, volatility: 0.3, riskTier: 4, category: "opiate" },
  { id: "meth", displayName: "Meth", minPrice: 90, maxPrice: 420, volatility: 0.33, riskTier: 4, category: "street" },
  { id: "crack", displayName: "Crack", minPrice: 70, maxPrice: 300, volatility: 0.31, riskTier: 3, category: "street" },
  { id: "xanax", displayName: "Xanax", minPrice: 18, maxPrice: 90, volatility: 0.21, riskTier: 2, category: "pill" },
  { id: "oxy", displayName: "Oxy", minPrice: 45, maxPrice: 210, volatility: 0.25, riskTier: 3, category: "pill" },
  { id: "percocet", displayName: "Percocet", minPrice: 30, maxPrice: 170, volatility: 0.24, riskTier: 3, category: "pill" },
  { id: "mdma", displayName: "Molly / MDMA", minPrice: 55, maxPrice: 260, volatility: 0.27, riskTier: 2, category: "party" },
  { id: "shrooms", displayName: "Shrooms", minPrice: 35, maxPrice: 150, volatility: 0.2, riskTier: 1, category: "party" },
  { id: "lsd", displayName: "Acid / LSD", minPrice: 28, maxPrice: 180, volatility: 0.29, riskTier: 2, category: "party" },
  { id: "fentanyl", displayName: "Fentanyl", minPrice: 110, maxPrice: 620, volatility: 0.35, riskTier: 5, category: "opiate" },
  { id: "ecstasy", displayName: "Ecstasy", minPrice: 45, maxPrice: 220, volatility: 0.24, riskTier: 2, category: "party" },
  { id: "ketamine", displayName: "Ketamine", minPrice: 60, maxPrice: 280, volatility: 0.26, riskTier: 2, category: "party" },
  { id: "vicodin", displayName: "Vicodin", minPrice: 24, maxPrice: 145, volatility: 0.22, riskTier: 2, category: "pill" },
  { id: "lean", displayName: "Lean / Promethazine", minPrice: 50, maxPrice: 260, volatility: 0.25, riskTier: 2, category: "syrup" },
  { id: "hydros", displayName: "Hydros", minPrice: 20, maxPrice: 120, volatility: 0.22, riskTier: 2, category: "pill" },
  { id: "ritalin", displayName: "Ritalin", minPrice: 18, maxPrice: 105, volatility: 0.2, riskTier: 2, category: "pill" },
  { id: "vyvanse", displayName: "Vyvanse", minPrice: 24, maxPrice: 135, volatility: 0.23, riskTier: 2, category: "pill" },
  { id: "rx_mix", displayName: "Prescription Mix", minPrice: 32, maxPrice: 190, volatility: 0.24, riskTier: 3, category: "pill" },
];

const AREAS = [
  { id: "north_star_lot", displayName: "North Star Lot", riskLevel: 1, policePressure: 1, rivalPressure: 0, marketBias: { weed: 0.85, shrooms: 0.9, xanax: 0.9 }, hint: "cheap street stock" },
  { id: "spenard", displayName: "Spenard", riskLevel: 2, policePressure: 2, rivalPressure: 1, marketBias: { cocaine: 1.2, meth: 1.15, oxy: 1.12 }, hint: "powder demand" },
  { id: "mountain_view", displayName: "Mountain View", riskLevel: 3, policePressure: 2, rivalPressure: 2, marketBias: { crack: 1.2, heroin: 1.16, fentanyl: 1.2 }, hint: "hard market" },
  { id: "downtown", displayName: "Downtown", riskLevel: 2, policePressure: 3, rivalPressure: 1, marketBias: { adderall: 1.17, cocaine: 1.22, mdma: 1.16 }, hint: "club flips" },
  { id: "muldoon", displayName: "Muldoon", riskLevel: 3, policePressure: 2, rivalPressure: 3, marketBias: { meth: 1.22, hydros: 1.17, lean: 1.15 }, hint: "rival corners" },
  { id: "midtown", displayName: "Midtown", riskLevel: 2, policePressure: 2, rivalPressure: 1, marketBias: { adderall: 0.86, ritalin: 0.84, vyvanse: 0.82 }, hint: "pill discounts" },
  { id: "southside", displayName: "Southside", riskLevel: 1, policePressure: 1, rivalPressure: 1, marketBias: { shrooms: 1.15, lsd: 1.2, ecstasy: 1.14 }, hint: "party crowd" },
  { id: "airport_industrial", displayName: "Airport / Industrial", riskLevel: 4, policePressure: 3, rivalPressure: 2, marketBias: { ketamine: 1.24, fentanyl: 1.26, rx_mix: 1.2 }, hint: "high margin, high heat" },
];

const UPGRADES = [
  { id: "beater", displayName: "Used Beater", cost: 900, category: "car", statEffects: { maxCarry: 20, heatDeltaOnTravel: -2 }, unlockRequirements: { money: 700 } },
  { id: "stash_closet", displayName: "Hidden Closet Stash", cost: 650, category: "stash", statEffects: { stashSafety: 12, maxCarry: 10 }, unlockRequirements: { money: 500 } },
  { id: "burner_pack", displayName: "Burner Pack", cost: 450, category: "ops", statEffects: { eventProtection: 8 }, unlockRequirements: { money: 350 } },
  { id: "muscle_1", displayName: "1 Crew Muscle", cost: 1700, category: "crew", statEffects: { muggingDefense: 18, rookPressureMod: -8 }, unlockRequirements: { money: 1200, rep: 12 } },
];

const GAME = {
  day: 1,
  tick: 1,
  locationId: "north_star_lot",
  cash: 200,
  bank: 0,
  heat: 0,
  rep: 0,
  health: 100,
  maxCarry: 30,
  inventory: Object.fromEntries(DRUGS.map((drug) => [drug.id, 0])),
  prices: {},
  events: [],
  dre: { loanOutstanding: 0, deadlineDay: null, trust: 0 },
  mina: { trust: 0, dealChanceBonus: 0 },
  rook: { attention: 0, warned: false, taxActive: false },
  flags: { robbedRecently: false },
  assets: [],
};

const el = {
  hudStats: document.getElementById("hudStats"),
  screenTitle: document.getElementById("screenTitle"),
  primaryNav: document.getElementById("primaryNav"),
  secondaryNav: document.getElementById("secondaryNav"),
  mainPanel: document.getElementById("mainPanel"),
  eventFeed: document.getElementById("eventFeed"),
  stayBtn: document.getElementById("stayBtn"),
  travelModalBtn: document.getElementById("travelModalBtn"),
  clearFeedBtn: document.getElementById("clearFeedBtn"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
};

const UI = {
  primary: "places",
  secondary: "drug_market",
};

const NAV = {
  places: [
    { id: "drug_market", label: "Drug Market", title: "Drug Market" },
    { id: "finances", label: "Finances", title: "Street Finances" },
    { id: "hospital", label: "Hospital", title: "Hospital" },
    { id: "shopping", label: "Shopping", title: "Shopping" },
    { id: "shipping", label: "Shipping", title: "Shipping" },
  ],
  info: [
    { id: "player_stats", label: "Player Stats", title: "Player Stats" },
    { id: "rumors", label: "Rumors", title: "Street Rumors" },
  ],
  inventory: [
    { id: "inventory_drugs", label: "Drugs", title: "Inventory: Drugs" },
    { id: "inventory_equipment", label: "Equipment", title: "Inventory: Equipment" },
    { id: "inventory_consumables", label: "Consumables", title: "Inventory: Consumables" },
  ],
};

function rng(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick(entries) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return entries[0];
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}

function currentArea() {
  return AREAS.find((area) => area.id === GAME.locationId);
}

function nameOf(drugId) {
  return DRUGS.find((drug) => drug.id === drugId)?.displayName || drugId;
}

function cargoCount() {
  return Object.values(GAME.inventory).reduce((sum, qty) => sum + qty, 0);
}

function sellPriceFor(drugId) {
  const base = GAME.prices[drugId] || 0;
  const markup = 1.03 + Math.min(0.14, GAME.rep * 0.003);
  const taxPenalty = GAME.rook.taxActive && currentArea().riskLevel >= 3 ? 0.95 : 1;
  return Math.max(1, Math.round(base * markup * taxPenalty));
}

function cargoValue() {
  return DRUGS.reduce((sum, drug) => sum + (GAME.inventory[drug.id] || 0) * sellPriceFor(drug.id), 0);
}

function assetEffect(effectId) {
  return GAME.assets.reduce((sum, assetId) => {
    const asset = UPGRADES.find((item) => item.id === assetId);
    return sum + (asset?.statEffects?.[effectId] || 0);
  }, 0);
}

function rookPressureState() {
  const area = currentArea();
  const loadFactor = Math.floor(cargoValue() / 450);
  const score = GAME.rook.attention + area.rivalPressure * 2 + loadFactor + Math.floor(GAME.rep / 4) - Math.floor(assetEffect("rookPressureMod") / 10);
  if (score >= 15) return "Active";
  if (score >= 8) return "Watching";
  return "None";
}

function areaRiskLabel(level) {
  if (level >= 4) return "High";
  if (level >= 2) return "Medium";
  return "Low";
}

function addFeed(text, tone = "") {
  GAME.events.unshift({ text, tone, stamp: `D${GAME.day}T${GAME.tick}` });
  GAME.events = GAME.events.slice(0, 70);
}

function generatePrices() {
  const area = currentArea();
  for (const drug of DRUGS) {
    const span = drug.maxPrice - drug.minPrice;
    const base = drug.minPrice + Math.random() * span;
    const volatilitySwing = 1 + (Math.random() * 2 - 1) * drug.volatility;
    const locationBias = area.marketBias[drug.id] || 1;
    const minaDiscount = GAME.mina.trust >= 5 ? 0.95 : 1;
    const rookTax = rookPressureState() === "Active" && area.riskLevel >= 3 ? 1.05 : 1;
    const scaled = base * volatilitySwing * locationBias * minaDiscount * rookTax;
    GAME.prices[drug.id] = Math.max(5, Math.round(scaled));
  }
}

function incrementTick() {
  GAME.tick += 1;
  if (GAME.tick > 4) {
    GAME.tick = 1;
    GAME.day += 1;
    if (GAME.bank > 0) {
      const interest = Math.max(1, Math.floor(GAME.bank * 0.02));
      GAME.bank += interest;
      addFeed(`Bank kicked in +$${interest} interest.`, "good");
    }
  }
}

function stepTick(reason = "") {
  incrementTick();
  GAME.flags.robbedRecently = false;
  if (reason) addFeed(reason);
  triggerRandomEvent("tick");
  generatePrices();
  render();
}

function maxBuyQty(drugId) {
  const freeSlots = GAME.maxCarry - cargoCount();
  const byCash = Math.floor(GAME.cash / GAME.prices[drugId]);
  return Math.max(0, Math.min(freeSlots, byCash));
}

function buyDrug(drugId, qty = 1) {
  const amount = Math.max(1, qty);
  const canBuy = maxBuyQty(drugId);
  if (canBuy <= 0) return addFeed("Not enough room or cash for that buy.", "bad");
  const actual = Math.min(amount, canBuy);
  const totalCost = GAME.prices[drugId] * actual;
  GAME.cash -= totalCost;
  GAME.inventory[drugId] += actual;

  if (["mdma", "cocaine", "heroin", "fentanyl", "meth"].includes(drugId)) {
    GAME.heat += Math.max(1, Math.floor(actual / 2));
    GAME.rep += Math.max(1, Math.floor(actual / 2));
    GAME.rook.attention += 1;
  }

  addFeed(`Bought ${actual} ${nameOf(drugId)} for $${totalCost}.`, "good");
  triggerRandomEvent("deal");
  render();
}

function sellDrug(drugId, qty = 1) {
  const owned = GAME.inventory[drugId] || 0;
  if (!owned) return addFeed(`No ${nameOf(drugId)} in your pockets.`, "bad");
  const actual = Math.min(Math.max(1, qty), owned);
  const salePrice = sellPriceFor(drugId);
  GAME.inventory[drugId] -= actual;
  GAME.cash += salePrice * actual;
  GAME.rep += Math.max(1, Math.floor(actual / 2));
  GAME.rook.attention += currentArea().riskLevel >= 3 ? 1 : 0;

  addFeed(`Sold ${actual} ${nameOf(drugId)} for $${salePrice * actual}.`, "good");
  triggerRandomEvent("deal");
  render();
}

function travelTo(areaId) {
  if (areaId === GAME.locationId) return;
  const target = AREAS.find((area) => area.id === areaId);
  GAME.locationId = areaId;
  incrementTick();
  GAME.heat = Math.max(0, GAME.heat + target.riskLevel - 1 - assetEffect("heatDeltaOnTravel"));
  GAME.rook.attention += target.rivalPressure;
  addFeed(`Moved to ${target.displayName}.`, "");
  triggerRandomEvent("travel");
  generatePrices();
  render();
}

function robAction() {
  const area = currentArea();
  const pressure = rookPressureState();
  const hotCarry = Math.floor(cargoValue() / 500);

  const entries = [
    { weight: Math.max(8, 30 - GAME.heat - area.policePressure), run: () => { const cash = rng(65, 145); GAME.cash += cash; GAME.heat += 1; GAME.rep += 1; addFeed(`Rob hit clean. +$${cash}.`, "good"); } },
    { weight: 18, run: () => { const cash = rng(20, 65); GAME.cash += cash; GAME.heat += 2; addFeed(`Quick score landed: +$${cash}.`, "good"); } },
    { weight: 10 + GAME.heat + area.policePressure + hotCarry, run: () => { const dmg = rng(8, 20); GAME.health -= dmg; GAME.heat += 2; addFeed(`Rob went bad. Took ${dmg} damage.`, "bad"); } },
    { weight: 12 + area.rivalPressure, run: () => addFeed("Target had nothing worth taking.") },
    { weight: pressure === "Active" ? 13 : 4, run: () => { GAME.health -= rng(6, 16); GAME.rook.attention += 3; GAME.heat += 3; addFeed("Wrong person. Retaliation hit you fast.", "bad"); } },
    { weight: 10 + GAME.heat + area.policePressure * 2, run: () => { GAME.heat += 4; addFeed("Cops lit up the block after that robbery.", "bad"); } },
  ];

  weightedPick(entries).run();
  GAME.flags.robbedRecently = true;
  triggerRandomEvent("rob");
  render();
}

function takeDreLoan() {
  if (GAME.dre.loanOutstanding > 0) return addFeed("Dre says clear your current note first.", "bad");
  const amount = 400;
  GAME.cash += amount;
  GAME.dre.loanOutstanding = Math.round(amount * 1.2);
  GAME.dre.deadlineDay = GAME.day + 5;
  GAME.dre.trust += 1;
  addFeed(`Dre fronts you $${amount}. Owe $${GAME.dre.loanOutstanding} by day ${GAME.dre.deadlineDay}.`);
  render();
}

function repayDre() {
  if (GAME.dre.loanOutstanding <= 0) return addFeed("No debt with Dre right now.");
  if (GAME.cash < GAME.dre.loanOutstanding) return addFeed("Not enough cash to clear Dre's loan.", "bad");
  GAME.cash -= GAME.dre.loanOutstanding;
  GAME.dre.loanOutstanding = 0;
  GAME.dre.deadlineDay = null;
  GAME.dre.trust += 2;
  GAME.rep += 2;
  GAME.mina.trust += 1;
  addFeed("You paid Dre in full. Trust goes up across your circle.", "good");
  render();
}

function maybeBuyUpgrade(upgradeId) {
  const upgrade = UPGRADES.find((item) => item.id === upgradeId);
  if (!upgrade || GAME.assets.includes(upgradeId)) return;
  if (GAME.cash < upgrade.cost) return addFeed(`Need $${upgrade.cost} for ${upgrade.displayName}.`, "bad");
  if ((upgrade.unlockRequirements.rep || 0) > GAME.rep) return addFeed(`${upgrade.displayName} requires more reputation.`, "bad");
  GAME.cash -= upgrade.cost;
  GAME.assets.push(upgradeId);
  GAME.maxCarry += upgrade.statEffects.maxCarry || 0;
  addFeed(`Purchased ${upgrade.displayName}.`, "good");
  render();
}

function triggerRandomEvent(source) {
  if (Math.random() > 0.62) return;

  const area = currentArea();
  const pressure = rookPressureState();
  const loadedValue = cargoValue();
  const carryRisk = Math.floor(loadedValue / 450);
  const robbedFactor = GAME.flags.robbedRecently ? 4 : 0;

  if (GAME.dre.loanOutstanding > 0 && GAME.day > GAME.dre.deadlineDay) {
    const penalty = Math.min(120, GAME.cash);
    GAME.cash -= penalty;
    GAME.dre.trust -= 2;
    GAME.rook.attention += 2;
    GAME.dre.deadlineDay = GAME.day + 2;
    addFeed(`Dre collected $${penalty} and extended your deadline.`, "bad");
  }

  const pool = [
    {
      id: "police_attention",
      weight: 5 + GAME.heat + area.policePressure + robbedFactor + carryRisk,
      run: () => {
        GAME.heat += rng(2, 5);
        const fine = rng(10, 45);
        GAME.cash = Math.max(0, GAME.cash - fine);
        addFeed(`Police attention spikes. Burned $${fine} staying mobile.`, "bad");
      },
    },
    {
      id: "mugging_attempt",
      weight: 4 + area.riskLevel + carryRisk,
      run: () => {
        if (Math.random() < assetEffect("muggingDefense") / 100) return addFeed("Crew muscle scared off a mugging attempt.", "good");
        const loss = rng(20, 95);
        GAME.cash = Math.max(0, GAME.cash - loss);
        GAME.health -= rng(3, 12);
        addFeed(`Mugging attempt lands. Lost $${loss}.`, "bad");
      },
    },
    {
      id: "lucky_buyer",
      weight: source === "deal" ? 11 + GAME.rep : 3,
      run: () => {
        const inventoryOptions = DRUGS.filter((drug) => GAME.inventory[drug.id] > 0);
        if (!inventoryOptions.length) return;
        const pick = inventoryOptions[rng(0, inventoryOptions.length - 1)];
        const bonus = rng(28, 110);
        GAME.cash += bonus;
        GAME.inventory[pick.id] -= 1;
        GAME.rep += 2;
        addFeed(`Lucky buyer overpaid for ${pick.displayName}. Bonus +$${bonus}.`, "good");
      },
    },
    {
      id: "dry_supply",
      weight: 6 + area.riskLevel,
      run: () => {
        const pick = DRUGS[rng(0, DRUGS.length - 1)];
        GAME.prices[pick.id] = Math.round(GAME.prices[pick.id] * 1.2);
        addFeed(`Dry supply: ${pick.displayName} spikes in ${area.displayName}.`, "bad");
      },
    },
    {
      id: "good_deal",
      weight: 7 + GAME.mina.trust + GAME.mina.dealChanceBonus,
      run: () => {
        const pick = DRUGS[rng(0, DRUGS.length - 1)];
        const discount = Math.round(GAME.prices[pick.id] * 0.22);
        GAME.prices[pick.id] = Math.max(5, GAME.prices[pick.id] - discount);
        GAME.mina.trust += 1;
        addFeed(`Mina tip: ${pick.displayName} down $${discount} this stop.`, "good");
      },
    },
    {
      id: "hot_area_warning",
      weight: area.riskLevel >= 3 ? 8 + GAME.heat : 2,
      run: () => {
        GAME.heat += 2;
        addFeed(`${area.displayName} runs hot right now.`, "bad");
      },
    },
    {
      id: "random_tip",
      weight: 5,
      run: () => {
        const cash = rng(18, 55);
        GAME.cash += cash;
        GAME.rep += 1;
        addFeed(`Random tip cashes out +$${cash}.`, "good");
      },
    },
    {
      id: "stash_loss_risk",
      weight: 3 + carryRisk,
      run: () => {
        if (Math.random() < assetEffect("stashSafety") / 100) return addFeed("Stash setup blocked a theft attempt.", "good");
        const inventoryOptions = DRUGS.filter((drug) => GAME.inventory[drug.id] > 0);
        if (!inventoryOptions.length) return;
        const pick = inventoryOptions[rng(0, inventoryOptions.length - 1)];
        const amount = Math.min(GAME.inventory[pick.id], rng(1, 3));
        GAME.inventory[pick.id] -= amount;
        addFeed(`Stash loss: ${amount} ${pick.displayName} vanished.`, "bad");
      },
    },
    {
      id: "bad_batch",
      weight: 4 + area.riskLevel,
      run: () => {
        const loss = rng(20, 90);
        GAME.cash = Math.max(0, GAME.cash - loss);
        GAME.rep = Math.max(0, GAME.rep - 1);
        addFeed(`Bad batch burns your rep and costs $${loss}.`, "bad");
      },
    },
  ];

  if (source === "rob") {
    pool.push({
      id: "robbery_blowback",
      weight: 10 + area.rivalPressure,
      run: () => {
        GAME.heat += 2;
        GAME.health -= rng(3, 9);
        addFeed("Robbery blowback: people are looking for you.", "bad");
      },
    });
  }

  if (pressure !== "None" || area.rivalPressure >= 2) {
    pool.push({
      id: "rival_pressure",
      weight: pressure === "Active" ? 12 : 7,
      run: () => {
        GAME.rook.warned = true;
        GAME.rook.attention += 3;
        addFeed("Rival pressure rises. Rook's people are checking your route.", "bad");
      },
    });
    pool.push({
      id: "rook_tax",
      weight: pressure === "Active" ? 9 : 3,
      run: () => {
        const tax = Math.min(GAME.cash, rng(35, 130));
        GAME.cash -= tax;
        GAME.rook.taxActive = true;
        addFeed(`Rook pressure tax hits for $${tax}.`, "bad");
      },
    });
  }

  const event = weightedPick(pool);
  event.run();

  GAME.health = Math.max(0, GAME.health);
  GAME.heat = Math.max(0, GAME.heat);

  if (GAME.health <= 0) {
    addFeed("You got folded. Reset and run it cleaner next time.", "bad");
    resetGame();
  }
}

function marketSignals() {
  let bestMarginId = null;
  let bestMarginValue = -Infinity;
  let cheapestId = null;
  let cheapestPrice = Infinity;
  let bestFlipId = null;
  let bestFlipScore = -Infinity;

  for (const drug of DRUGS) {
    const buy = GAME.prices[drug.id];
    const sell = sellPriceFor(drug.id);
    const margin = sell - buy;
    const flip = (drug.maxPrice - buy) / Math.max(1, buy);

    if (margin > bestMarginValue) {
      bestMarginValue = margin;
      bestMarginId = drug.id;
    }
    if (buy < cheapestPrice) {
      cheapestPrice = buy;
      cheapestId = drug.id;
    }
    if (flip > bestFlipScore) {
      bestFlipScore = flip;
      bestFlipId = drug.id;
    }
  }

  return { bestMarginId, cheapestId, bestFlipId };
}

function currentRank() {
  if (GAME.rep >= 60) return "Boss";
  if (GAME.rep >= 35) return "Shot Caller";
  if (GAME.rep >= 18) return "Runner";
  return "Hustler";
}

function renderHud() {
  const area = currentArea();
  const chips = [
    `Cash $${GAME.cash}`,
    `Bank $${GAME.bank}`,
    `Health ${GAME.health}`,
    `Capacity ${cargoCount()} / ${GAME.maxCarry}`,
    `City ${area.displayName}`,
    `Day ${GAME.day} / 30`,
    `Rank ${currentRank()}`,
    `Heat ${GAME.heat}`,
  ];
  el.hudStats.innerHTML = chips.map((chip) => `<span class="status-chip">${chip}</span>`).join("");
}

function renderNav() {
  const primaryOrder = [
    { id: "places", label: "Places" },
    { id: "info", label: "Info" },
    { id: "inventory", label: "Inventory" },
  ];

  el.primaryNav.innerHTML = primaryOrder
    .map((entry) => `<button class="btn ${UI.primary === entry.id ? "active" : ""}" data-primary="${entry.id}" type="button">${entry.label}</button>`)
    .join("");

  const secondaryOptions = NAV[UI.primary];
  if (!secondaryOptions.some((item) => item.id === UI.secondary)) UI.secondary = secondaryOptions[0].id;
  el.secondaryNav.innerHTML = secondaryOptions
    .map((entry) => `<button class="btn ${UI.secondary === entry.id ? "active" : ""}" data-secondary="${entry.id}" type="button">${entry.label}</button>`)
    .join("");
  el.screenTitle.textContent = secondaryOptions.find((item) => item.id === UI.secondary)?.title || "907 Hustle";
}

function renderMarketScreen() {
  const { bestMarginId, cheapestId, bestFlipId } = marketSignals();
  const rows = [
    '<div class="row market header"><div>Drug</div><div>Buy</div><div>Sell</div><div>Owned</div><div>Margin</div><div>Actions</div></div>',
  ];

  for (const drug of DRUGS) {
    const buy = GAME.prices[drug.id];
    const sell = sellPriceFor(drug.id);
    const margin = sell - buy;
    const cues = [];

    if (drug.id === cheapestId) cues.push('<span class="signal cheap">cheap</span>');
    if (drug.id === bestMarginId) cues.push('<span class="signal hot">hot</span>');
    if (drug.id === bestFlipId) cues.push('<span class="signal flip">flip</span>');

    rows.push(`
      <div class="row market">
        <div class="drug-meta"><strong>${drug.displayName}</strong>${cues.join("")}</div>
        <div>$${buy}</div>
        <div>$${sell}</div>
        <div>${GAME.inventory[drug.id]}</div>
        <div class="${margin >= 0 ? "margin-positive" : "margin-negative"}">${margin >= 0 ? "+" : ""}$${margin}</div>
        <div class="actions">
          <button class="btn" data-buy-one="${drug.id}" type="button">B1</button>
          <button class="btn" data-buy-max="${drug.id}" type="button">BMax</button>
          <button class="btn" data-sell-one="${drug.id}" type="button">S1</button>
          <button class="btn" data-sell-all="${drug.id}" type="button">SAll</button>
        </div>
      </div>
    `);
  }

  el.mainPanel.innerHTML = `
    <h3 class="section-title">Drug Market</h3>
    <div class="card-grid" style="margin-bottom:8px;">
      <section class="card">
        <p class="eyebrow">Quick Actions</p>
        <div class="input-row">
          <button class="btn danger" data-quick-action="rob" type="button">Rob for Cash</button>
          <button class="btn secondary" data-quick-action="loan" type="button">Ask Dre for Loan</button>
          <button class="btn secondary" data-quick-action="repay" type="button">Repay Dre</button>
        </div>
      </section>
      <section class="card">
        <p class="eyebrow">Risk Preview</p>
        <p>Area Risk: <strong>${areaRiskLabel(currentArea().riskLevel)}</strong> · Rook: <strong>${rookPressureState()}</strong></p>
      </section>
    </div>
    <div class="market-table">${rows.join("")}</div>
  `;
}

function renderFinancesScreen() {
  el.mainPanel.innerHTML = `
    <h3 class="section-title">Finances</h3>
    <div class="card-grid">
      <section class="card">
        <p class="eyebrow">Street Cash</p>
        <h3>$${GAME.cash}</h3>
        <p class="muted">Use this for trading and quick actions.</p>
      </section>
      <section class="card">
        <p class="eyebrow">Bank Balance</p>
        <h3>$${GAME.bank}</h3>
        <p class="muted">Safe stash. Simple 2% daily interest.</p>
      </section>
    </div>
    <div class="card" style="margin-top:8px;">
      <h3>Move Money</h3>
      <div class="input-row">
        <input id="financeAmount" type="number" min="1" value="50" />
        <button class="btn primary" data-finance-action="deposit" type="button">Deposit</button>
        <button class="btn secondary" data-finance-action="withdraw" type="button">Withdraw</button>
      </div>
    </div>
  `;
}

function renderInventoryDrugsScreen() {
  const lines = DRUGS
    .filter((drug) => GAME.inventory[drug.id] > 0)
    .sort((a, b) => GAME.inventory[b.id] - GAME.inventory[a.id])
    .map((drug) => `<div class="row simple"><span>${drug.displayName}</span><strong>${GAME.inventory[drug.id]}</strong></div>`)
    .join("");
  el.mainPanel.innerHTML = `
    <h3 class="section-title">Inventory - Drugs</h3>
    <div class="list-table">
      <div class="row simple header"><div>Item</div><div>Qty</div></div>
      ${lines || '<div class="row simple"><span class="muted">No product on hand.</span><span>-</span></div>'}
    </div>
  `;
}

function renderInventoryEquipmentScreen() {
  const lines = (GAME.assets || [])
    .map((assetId) => UPGRADES.find((upgrade) => upgrade.id === assetId))
    .filter(Boolean)
    .map((asset) => `<div class="row simple"><span>${asset.displayName}</span><strong class="good">Equipped</strong></div>`)
    .join("");
  el.mainPanel.innerHTML = `
    <h3 class="section-title">Inventory - Equipment</h3>
    <div class="list-table">
      <div class="row simple header"><div>Gear</div><div>Status</div></div>
      ${lines || '<div class="row simple"><span class="muted">No equipment owned.</span><span>-</span></div>'}
    </div>
  `;
}

function renderInventoryConsumablesScreen() {
  el.mainPanel.innerHTML = `
    <h3 class="section-title">Inventory - Consumables</h3>
    <div class="card">
      <p class="muted">No consumables yet. Future updates will route medkits, boosters, and one-use items here.</p>
    </div>
  `;
}

function renderHospitalScreen() {
  const missing = Math.max(0, 100 - GAME.health);
  const healCost = missing * 4;
  el.mainPanel.innerHTML = `
    <h3 class="section-title">Hospital</h3>
    <div class="card-grid">
      <section class="card"><p class="eyebrow">Current Health</p><h3>${GAME.health} / 100</h3></section>
      <section class="card"><p class="eyebrow">Full Heal Cost</p><h3>$${healCost}</h3></section>
    </div>
    <div class="input-row">
      <button class="btn primary" data-heal="full" type="button" ${healCost <= 0 || GAME.cash < healCost ? "disabled" : ""}>Heal Up</button>
    </div>
  `;
}

function renderShoppingScreen() {
  const lines = UPGRADES.map((item) => {
    const owned = GAME.assets.includes(item.id);
    return `<div class="row simple"><span>${item.displayName} - $${item.cost}</span><button class="btn ${owned ? "secondary" : "primary"}" data-upgrade-buy="${item.id}" ${owned ? "disabled" : ""}>${owned ? "Owned" : "Buy"}</button></div>`;
  }).join("");
  el.mainPanel.innerHTML = `
    <h3 class="section-title">Shopping</h3>
    <div class="list-table">
      <div class="row simple header"><div>Gear</div><div>Action</div></div>
      ${lines}
    </div>
  `;
}

function renderShippingScreen() {
  el.mainPanel.innerHTML = `
    <h3 class="section-title">Shipping</h3>
    <div class="card"><p class="muted">Shipment network not wired yet. This screen is reserved in the shell so future shipping systems stay mode-based.</p></div>
  `;
}

function renderPlayerStatsScreen() {
  const area = currentArea();
  el.mainPanel.innerHTML = `
    <h3 class="section-title">Player Stats</h3>
    <div class="card-grid">
      <section class="card"><p class="eyebrow">Rep</p><h3>${GAME.rep}</h3></section>
      <section class="card"><p class="eyebrow">Heat</p><h3>${GAME.heat}</h3></section>
      <section class="card"><p class="eyebrow">Rook Pressure</p><h3>${rookPressureState()}</h3></section>
      <section class="card"><p class="eyebrow">Current Area Risk</p><h3>${areaRiskLabel(area.riskLevel)}</h3></section>
    </div>
  `;
}

function renderRumorsScreen() {
  const area = currentArea();
  el.mainPanel.innerHTML = `
    <h3 class="section-title">Rumors</h3>
    <div class="card">
      <p>Word on the block: <strong>${area.hint}</strong> around ${area.displayName}.</p>
      <div class="input-row"><button class="btn primary" data-open-rumor="1" type="button">Open Rumor Brief</button></div>
    </div>
  `;
}

function renderMainPanel() {
  switch (UI.secondary) {
    case "drug_market": return renderMarketScreen();
    case "finances": return renderFinancesScreen();
    case "hospital": return renderHospitalScreen();
    case "shopping": return renderShoppingScreen();
    case "shipping": return renderShippingScreen();
    case "player_stats": return renderPlayerStatsScreen();
    case "rumors": return renderRumorsScreen();
    case "inventory_drugs": return renderInventoryDrugsScreen();
    case "inventory_equipment": return renderInventoryEquipmentScreen();
    case "inventory_consumables": return renderInventoryConsumablesScreen();
    default: return renderMarketScreen();
  }
}

function renderFeed() {
  el.eventFeed.innerHTML = GAME.events
    .map((entry) => `<div class="feed-item ${entry.tone}"><strong>[${entry.stamp}]</strong> ${entry.text}</div>`)
    .join("");
}

function openModal(title, bodyHtml) {
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = bodyHtml;
  el.modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  el.modalBackdrop.classList.add("hidden");
  el.modalBody.innerHTML = "";
}

function openTravelModal() {
  const lines = AREAS.map((area) => `
    <div class="row simple">
      <span>${area.displayName} <small class="muted">(Risk ${areaRiskLabel(area.riskLevel)})</small></span>
      <button class="btn primary" data-travel-go="${area.id}" ${area.id === GAME.locationId ? "disabled" : ""}>Go</button>
    </div>
  `).join("");
  openModal("Travel", `<div class="list-table">${lines}</div>`);
}

function maybeShowPromotionModal() {
  const rank = currentRank();
  if (GAME.rep <= 0) return;
  if (GAME.lastPromotion === rank) return;
  GAME.lastPromotion = rank;
  openModal("Rank Promotion", `<p>You are now <strong>${rank}</strong>.</p><p class="muted">Keep stacking rep to unlock tougher routes and better leverage.</p><button class="btn primary" data-modal-ok="1">Back to work</button>`);
}

function render() {
  renderHud();
  renderNav();
  renderMainPanel();
  renderFeed();
  maybeShowPromotionModal();
}

function bindEvents() {
  el.primaryNav.addEventListener("click", (event) => {
    const nextPrimary = event.target.getAttribute("data-primary");
    if (!nextPrimary) return;
    UI.primary = nextPrimary;
    UI.secondary = NAV[UI.primary][0].id;
    render();
  });

  el.secondaryNav.addEventListener("click", (event) => {
    const nextSecondary = event.target.getAttribute("data-secondary");
    if (!nextSecondary) return;
    UI.secondary = nextSecondary;
    render();
  });

  el.mainPanel.addEventListener("click", (event) => {
    const buyOne = event.target.getAttribute("data-buy-one");
    const buyMax = event.target.getAttribute("data-buy-max");
    const sellOne = event.target.getAttribute("data-sell-one");
    const sellAll = event.target.getAttribute("data-sell-all");
    const financeAction = event.target.getAttribute("data-finance-action");
    const doHeal = event.target.getAttribute("data-heal");
    const upgradeBuy = event.target.getAttribute("data-upgrade-buy");
    const openRumor = event.target.getAttribute("data-open-rumor");
    const quickAction = event.target.getAttribute("data-quick-action");

    if (buyOne) buyDrug(buyOne, 1);
    if (buyMax) buyDrug(buyMax, maxBuyQty(buyMax));
    if (sellOne) sellDrug(sellOne, 1);
    if (sellAll) sellDrug(sellAll, GAME.inventory[sellAll]);
    if (doHeal) healAtHospital();
    if (upgradeBuy) maybeBuyUpgrade(upgradeBuy);
    if (openRumor) openRumorModal();
    if (quickAction === "rob") robAction();
    if (quickAction === "loan") takeDreLoan();
    if (quickAction === "repay") repayDre();
    if (financeAction) moveMoney(financeAction);
  });

  el.stayBtn.addEventListener("click", () => stepTick("You lay low and let one market tick pass."));
  el.travelModalBtn.addEventListener("click", openTravelModal);
  el.clearFeedBtn.addEventListener("click", () => {
    GAME.events = [];
    renderFeed();
  });
  el.modalCloseBtn.addEventListener("click", closeModal);

  el.modalBody.addEventListener("click", (event) => {
    const go = event.target.getAttribute("data-travel-go");
    const ok = event.target.getAttribute("data-modal-ok");
    if (go) {
      travelTo(go);
      closeModal();
    }
    if (ok) closeModal();
  });
}

function moveMoney(kind) {
  const amount = Math.max(1, Number(document.getElementById("financeAmount")?.value || 0));
  if (!amount) return;
  if (kind === "deposit") {
    const moved = Math.min(amount, GAME.cash);
    if (!moved) return addFeed("No cash to deposit.", "bad");
    GAME.cash -= moved;
    GAME.bank += moved;
    addFeed(`Deposited $${moved} to bank.`, "good");
  } else {
    const moved = Math.min(amount, GAME.bank);
    if (!moved) return addFeed("No bank funds to withdraw.", "bad");
    GAME.bank -= moved;
    GAME.cash += moved;
    addFeed(`Withdrew $${moved} from bank.`, "good");
  }
  render();
}

function healAtHospital() {
  const missing = Math.max(0, 100 - GAME.health);
  const cost = missing * 4;
  if (cost <= 0) return addFeed("You're already at full health.");
  if (GAME.cash < cost) return addFeed("Not enough cash for treatment.", "bad");
  GAME.cash -= cost;
  GAME.health = 100;
  addFeed(`Hospital patched you up for $${cost}.`, "good");
  render();
}

function openRumorModal() {
  const area = currentArea();
  const rumor = `Word is ${area.hint} in ${area.displayName}. Keep your load light if pressure is rising.`;
  openModal("Rumor", `<p>${rumor}</p><button class="btn primary" data-modal-ok="1">Got it</button>`);
}

function resetGame() {
  GAME.day = 1;
  GAME.tick = 1;
  GAME.locationId = "north_star_lot";
  GAME.cash = 200;
  GAME.bank = 0;
  GAME.heat = 0;
  GAME.rep = 0;
  GAME.health = 100;
  GAME.maxCarry = 30;
  GAME.inventory = Object.fromEntries(DRUGS.map((drug) => [drug.id, 0]));
  GAME.events = [];
  GAME.dre = { loanOutstanding: 0, deadlineDay: null, trust: 0 };
  GAME.mina = { trust: 0, dealChanceBonus: 0 };
  GAME.rook = { attention: 0, warned: false, taxActive: false };
  GAME.flags = { robbedRecently: false };
  GAME.assets = [];
  GAME.lastPromotion = currentRank();
  generatePrices();
  addFeed("Fresh run started: $200 cash, no crew, no safety net.");
  render();
}

bindEvents();
resetGame();
