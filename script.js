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
  priceHistory: {},
  events: [],
  modifiers: [],
  dre: { loanOutstanding: 0, deadlineDay: null, trust: 0 },
  mina: { trust: 0, dealChanceBonus: 0 },
  rook: { attention: 0, warned: false, taxActive: false },
  flags: { robbedRecently: false },
  assets: [],
};

const el = {
  hudStats: document.getElementById("hudStats"),
  mainNav: document.getElementById("mainNav"),
  mainPanel: document.getElementById("mainPanel"),
  eventFeed: document.getElementById("eventFeed"),
  stayBtn: document.getElementById("stayBtn"),
  stayBtnSub: document.getElementById("stayBtnSub"),
  travelModalBtn: document.getElementById("travelModalBtn"),
  clearFeedBtn: document.getElementById("clearFeedBtn"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
};

const UI = {
  tab: "market",
  expandedDrug: null,
  qty: {},
};

const SLOTS = ["Morning", "Afternoon", "Evening", "Night"];
function currentSlotName() { return SLOTS[GAME.tick - 1] || SLOTS[0]; }
function nextSlotName() { return SLOTS[GAME.tick % 4]; }

const TABS = [
  { id: "market",   label: "Market", title: "Drug Market", icon: "cash" },
  { id: "stash",    label: "Stash", title: "Bag + Street Intel", icon: "bag" },
  { id: "bank",     label: "Cash/Bank", title: "Cash + Bank", icon: "bank" },
  { id: "shop",     label: "Gear", title: "Gear Shop", icon: "shop" },
  { id: "hospital", label: "Clinic", title: "Clinic", icon: "health" },
];

function iconSvg(kind = "info") {
  const icons = {
    cash: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9h12l-1 10H7z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/></svg>',
    heat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3c2 3 0 4 2 6 1 1 3 2 3 5a6 6 0 1 1-12 0c0-4 3-5 4-8 2 1 2 2 3 3z"/></svg>',
    day: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    location: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    health: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 9v5M12 17h.01"/></svg>',
    bank: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18M5 9v9M9 9v9M13 9v9M17 9v9M3 18h18"/><path d="M2 9l10-5 10 5"/></svg>',
    shop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16l-1 3H5z"/><path d="M6 10h12v10H6z"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>',
  };
  return `<span class="icon-badge icon-${kind}">${icons[kind] || icons.info}</span>`;
}

function sectionHeader(title, icon = "info") {
  return `<div class="screen-title">${iconSvg(icon)}<span>${title}</span></div>`;
}

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
  GAME.events.unshift({ text, tone, stamp: `Day ${GAME.day} · ${currentSlotName()}` });
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
    let scaled = base * volatilitySwing * locationBias * minaDiscount * rookTax;
    if (typeof applyModifiers === "function") scaled = applyModifiers(drug.id, scaled);
    GAME.prices[drug.id] = Math.max(5, Math.round(scaled));
  }
  recordPriceHistory();
}

function recordPriceHistory() {
  GAME.priceHistory = GAME.priceHistory || {};
  for (const drug of DRUGS) {
    const h = GAME.priceHistory[drug.id] || [];
    h.push(GAME.prices[drug.id]);
    if (h.length > 5) h.shift();
    GAME.priceHistory[drug.id] = h;
  }
}

function getTrend(drugId) {
  const h = (GAME.priceHistory || {})[drugId] || [];
  if (h.length < 2) return { dir: "flat", arrow: "—" };
  const cur = h[h.length - 1];
  const prev = h[h.length - 2];
  const delta = (cur - prev) / Math.max(1, prev);
  if (delta > 0.18) return { dir: "up-strong", arrow: "▲▲" };
  if (delta > 0.05) return { dir: "up", arrow: "▲" };
  if (delta < -0.18) return { dir: "down-strong", arrow: "▼▼" };
  if (delta < -0.05) return { dir: "down", arrow: "▼" };
  return { dir: "flat", arrow: "—" };
}

function isHotDrug(drugId) {
  const trend = getTrend(drugId);
  const margin = sellPriceFor(drugId) - (GAME.prices[drugId] || 0);
  return trend.dir === "up-strong" || (margin > 0 && trend.dir === "up");
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
    if (typeof expireModifiers === "function") expireModifiers();
  }
}

function stepTick(reason = "") {
  incrementTick();
  GAME.flags.robbedRecently = false;
  if (reason) addFeed(reason);
  generatePrices();
  const popped = (typeof tryPopupEvent === "function") && tryPopupEvent("laylow");
  if (!popped) triggerRandomEvent("tick");
  render();
}

function maxBuyQty(drugId) {
  const freeSlots = GAME.maxCarry - cargoCount();
  const byCash = Math.floor(GAME.cash / GAME.prices[drugId]);
  return Math.max(0, Math.min(freeSlots, byCash));
}

function buyDrug(drugId, qty = 1, anchor = null) {
  const amount = Math.max(1, qty);
  const canBuy = maxBuyQty(drugId);
  if (canBuy <= 0 || amount > canBuy) {
    playBonk();
    shakeElement(`[data-drug-id="${drugId}"]`);
    addFeed("Not enough cash or bag space.", "bad");
    return;
  }
  const totalCost = GAME.prices[drugId] * amount;
  GAME.cash -= totalCost;
  GAME.inventory[drugId] = (GAME.inventory[drugId] || 0) + amount;

  if (["mdma", "cocaine", "heroin", "fentanyl", "meth"].includes(drugId)) {
    GAME.heat += Math.max(1, Math.floor(amount / 2));
    GAME.rep += Math.max(1, Math.floor(amount / 2));
    GAME.rook.attention += 1;
  }

  playBuyChime();
  pulseCash("down");
  flashTradeRow(drugId, "buy");
  floatText(`−$${totalCost.toLocaleString()}`, "var(--spend)", anchor);
  addFeed(`Bought ${amount} ${nameOf(drugId)} for $${totalCost.toLocaleString()}.`, "good");
  triggerRandomEvent("deal");
  render();
}

function sellDrug(drugId, qty = 1, anchor = null) {
  const owned = GAME.inventory[drugId] || 0;
  if (!owned) { playBonk(); addFeed(`No ${nameOf(drugId)} in your pockets.`, "bad"); return; }
  const actual = Math.min(Math.max(1, qty), owned);
  const salePrice = sellPriceFor(drugId);
  const total = salePrice * actual;
  GAME.inventory[drugId] -= actual;
  GAME.cash += total;
  GAME.rep += Math.max(1, Math.floor(actual / 2));
  GAME.rook.attention += currentArea().riskLevel >= 3 ? 1 : 0;

  playChaChing();
  pulseCash("up");
  flashTradeRow(drugId, "sell");
  floatText(`+$${total.toLocaleString()}`, "var(--money)", anchor);
  addFeed(`Sold ${actual} ${nameOf(drugId)} for $${total.toLocaleString()}.`, "good");
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
  generatePrices();
  const popped = (typeof tryPopupEvent === "function") && tryPopupEvent("travel");
  if (!popped) triggerRandomEvent("travel");
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

// ============================================================================
// AUDIO — Web Audio cha-ching, bonk, click (no file deps)
// ============================================================================
let audioCtx = null;
let audioEnabled = true;

function ensureAudio() {
  if (!audioEnabled) return null;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioEnabled = false; return null; }
  }
  if (audioCtx.state === "suspended") {
    try {
      const resumed = audioCtx.resume();
      if (resumed && typeof resumed.catch === "function") resumed.catch(() => { audioEnabled = false; });
    } catch (e) {
      audioEnabled = false;
      return null;
    }
  }
  return audioCtx;
}

function playTone(freq, dur = 0.15, type = "triangle", peak = 0.2, delay = 0) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function playChaChing() {
  // classic two-note cash register: high bright ping + rising sparkle
  playTone(988,  0.12, "triangle", 0.22, 0);
  playTone(1319, 0.30, "triangle", 0.26, 0.08);
  playTone(1760, 0.18, "sine",     0.12, 0.12);
}

function playBuyChime() {
  playTone(523, 0.08, "triangle", 0.18, 0);
  playTone(392, 0.16, "triangle", 0.15, 0.05);
}

function playBonk() {
  playTone(180, 0.15, "square", 0.12, 0);
  playTone(120, 0.20, "sawtooth", 0.08, 0.03);
}

function playClick() {
  playTone(720, 0.03, "square", 0.06);
}

function playCombatHit() {
  playTone(90, 0.08, "sawtooth", 0.2, 0);
  playTone(60, 0.12, "square", 0.15, 0.04);
}

// ============================================================================
// FLOATING NUMBER ANIMATION
// ============================================================================
function floatText(text, color, anchorEl) {
  const node = document.createElement("div");
  node.className = "float-text";
  node.textContent = text;
  node.style.color = color || "var(--money)";
  const rect = anchorEl ? anchorEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
  node.style.left = (rect.left + rect.width / 2) + "px";
  node.style.top  = (rect.top  + rect.height / 2) + "px";
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1100);
}

function shakeElement(selector) {
  const e = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!e) return;
  e.classList.remove("shake");
  void e.offsetWidth;
  e.classList.add("shake");
}

// ============================================================================
// SLEEP / LAY LOW OVERLAY
// ============================================================================
function showSleepOverlay(nextSlot, done) {
  const ov = document.createElement("div");
  ov.className = "sleep-overlay";
  ov.innerHTML = `
    <div class="sleep-box">
      <div class="sleep-label">Lay Low</div>
      <div class="sleep-zzz"><span>•</span><span>•</span><span>•</span></div>
      <div class="sleep-clock">${nextSlot || "…"}</div>
      <div class="sleep-sub">Street noise fades. Another run starts.</div>
    </div>
  `;
  document.body.appendChild(ov);
  // soft low-pitch breathing tone
  playTone(220, 0.4, "sine", 0.08, 0);
  playTone(165, 0.5, "sine", 0.06, 0.15);
  setTimeout(() => {
    ov.classList.add("fade-out");
    setTimeout(() => { ov.remove(); if (done) done(); }, 240);
  }, 550);
}


function pulseCash(type = "") {
  const chip = document.querySelector("[data-cash-chip]");
  if (!chip) return;
  chip.classList.remove("cash-up", "cash-down");
  void chip.offsetWidth;
  chip.classList.add(type === "up" ? "cash-up" : "cash-down");
}

function flashTradeRow(drugId, type = "buy") {
  const row = document.querySelector(`[data-drug-id="${drugId}"]`);
  if (!row) return;
  const cls = type === "sell" ? "sold" : "bought";
  row.classList.remove("bought", "sold");
  void row.offsetWidth;
  row.classList.add(cls);
}

function renderHud() {
  const area = currentArea();
  const heatLvl = Math.min(5, GAME.heat);
  const heatBar = "●".repeat(heatLvl) + "○".repeat(5 - heatLvl);
  const heatCls = GAME.heat >= 6 ? "chip-danger" : GAME.heat >= 3 ? "chip-warn" : "";
  const hpCls = GAME.health < 40 ? "chip-danger" : GAME.health < 70 ? "chip-warn" : "";

  const chip = (label, value, cls = "", icon = "info") =>
    `<span class="status-chip ${cls}">${iconSvg(icon)}<span class="chip-k">${label}</span><span class="chip-v">${value}</span></span>`;

  const parts = [];
  parts.push(`<span class="status-chip chip-money" data-cash-chip="1">${iconSvg("cash")}<span class="chip-k">Cash</span><span class="chip-v">$${GAME.cash.toLocaleString()}</span></span>`);
  parts.push(chip("Bank", `$${GAME.bank.toLocaleString()}`, "chip-bank", "bank"));
  parts.push(chip("Bag", `${cargoCount()}/${GAME.maxCarry}`, "chip-bag", "bag"));
  parts.push(chip("Clock", `Day ${GAME.day}/30 · ${currentSlotName()}`, "", "day"));
  if (GAME.dre.loanOutstanding > 0) {
    const overdue = GAME.day > GAME.dre.deadlineDay;
    parts.push(chip("Dre", `$${GAME.dre.loanOutstanding} · D${GAME.dre.deadlineDay}`, overdue ? "chip-danger" : "chip-warn", "warn"));
  }
  parts.push(chip("Area", area.displayName, "chip-location", "location"));
  parts.push(chip("Heat", heatBar, heatCls, "heat"));
  parts.push(chip("Health", `${GAME.health}`, hpCls, "health"));

  el.hudStats.innerHTML = parts.join("");

  if (el.stayBtn) {
    el.stayBtn.innerHTML = `Lay Low<small>advance to ${nextSlotName()}</small>`;
  }
  if (el.travelModalBtn) {
    el.travelModalBtn.innerHTML = `Travel<small>leave ${area.displayName}</small>`;
  }
}

function renderNav() {
  el.mainNav.innerHTML = TABS
    .map((t) => `
      <button class="tab ${UI.tab === t.id ? "active" : ""}" data-tab="${t.id}" type="button">
        ${iconSvg(t.icon)}
        <span class="tab-text">${t.label}</span>
      </button>`)
    .join("");
}

function renderMarketScreen() {
  const area = currentArea();

  const rowsHtml = DRUGS.map((drug) => {
    const buy = GAME.prices[drug.id] || 0;
    const sell = sellPriceFor(drug.id);
    const owned = GAME.inventory[drug.id] || 0;
    const expanded = UI.expandedDrug === drug.id;
    const trend = getTrend(drug.id);
    const hot = isHotDrug(drug.id);
    const qty = Math.max(1, UI.qty[drug.id] || 1);
    const maxBuy = maxBuyQty(drug.id);
    const canBuy = maxBuyQty(drug.id) >= qty && buy > 0;
    const sellQty = Math.min(qty, owned);
    const canSell = sellQty > 0;
    const buyCost = buy * qty;
    const sellTotal = sell * sellQty;

    const expandedHtml = expanded ? `
      <div class="trade-row-expand">
        <div class="trade-expand-head">Trade Quantity</div>
        <div class="qty-stepper">
          <button class="stepper" data-qty-minus="${drug.id}" type="button">−</button>
          <input class="qty-input" type="number" min="1" value="${qty}" data-qty-input="${drug.id}" />
          <button class="stepper" data-qty-plus="${drug.id}" type="button">+</button>
          <button class="qty-max" data-qty-max="${drug.id}" type="button">Max ${Math.max(maxBuy, owned)}</button>
        </div>
        <div class="trade-actions">
          <button class="action-btn buy-btn" data-do-buy="${drug.id}" ${canBuy ? "" : "disabled"} type="button">
            Buy ${qty}
            <small>−$${buyCost.toLocaleString()}</small>
          </button>
          <button class="action-btn sell-btn" data-do-sell="${drug.id}" ${canSell ? "" : "disabled"} type="button">
            Sell ${sellQty}
            <small>+$${sellTotal.toLocaleString()}</small>
          </button>
        </div>
      </div>` : "";

    return `
      <div class="trade-row ${expanded ? "expanded" : ""} ${hot ? "hot" : ""}" data-drug-id="${drug.id}">
        <div class="trade-row-main" data-toggle-row="${drug.id}">
          <div class="trade-drug">
            <strong>${drug.displayName}</strong>
            <small>${drug.category.toUpperCase()} · TIER ${drug.riskTier}</small>
            ${hot ? '<span class="tag-hot">Hot</span>' : ""}
          </div>
          <div class="trade-price">$${buy.toLocaleString()}<small>sell $${sell.toLocaleString()}</small></div>
          <div class="trend-wrap">
            <span class="trend ${trend.dir}" title="${trend.dir.replace("-", " ")}">${trend.arrow}</span>
          </div>
          <div class="trade-owned ${owned > 0 ? "has" : ""}"><span>Owned</span><strong>${owned}</strong></div>
          <div class="trade-toggle">
            <button class="trade-btn" data-toggle-trade="${drug.id}" type="button">${expanded ? "Collapse" : "Open Trade"}</button>
          </div>
        </div>
        ${expandedHtml}
      </div>`;
  }).join("");

  el.mainPanel.innerHTML = `
    ${sectionHeader(`Drug Market · ${area.displayName}`, "cash")}
    <div class="market-head">
      <div>Drug</div>
      <div>Price</div>
      <div>Trend</div>
      <div>Owned</div>
      <div>Trade</div>
    </div>
    <div class="trade-list">${rowsHtml}</div>
    <div class="quick-strip">
      <button class="btn danger" data-quick-action="rob" type="button">Rob for Cash</button>
      <button class="btn" data-quick-action="loan" type="button">Ask Dre for Loan</button>
      <button class="btn" data-quick-action="repay" type="button" ${GAME.dre.loanOutstanding > 0 ? "" : "disabled"}>Repay Dre</button>
    </div>
  `;
}

function renderBankScreen() {
  el.mainPanel.innerHTML = `
    ${sectionHeader("Cash + Bank", "bank")}
    <div class="card-grid" style="margin-bottom:12px;">
      <section class="card money"><p class="eyebrow">Street Cash</p><h3>$${GAME.cash.toLocaleString()}</h3><p class="muted">Can be lost in muggings, busts, robberies.</p></section>
      <section class="card"><p class="eyebrow">Bank Balance</p><h3>$${GAME.bank.toLocaleString()}</h3><p class="muted">Safe. Earns 2% daily interest.</p></section>
    </div>
    <div class="card">
      <p class="eyebrow">Move Money</p>
      <div class="input-row">
        <input id="financeAmount" type="number" min="1" value="100" />
        <button class="btn primary" data-finance-action="deposit" type="button">Deposit</button>
        <button class="btn" data-finance-action="withdraw" type="button">Withdraw</button>
      </div>
    </div>
  `;
}

function renderStashScreen() {
  const drugLines = DRUGS
    .filter((drug) => GAME.inventory[drug.id] > 0)
    .sort((a, b) => GAME.inventory[b.id] - GAME.inventory[a.id])
    .map((drug) => {
      const worth = sellPriceFor(drug.id) * GAME.inventory[drug.id];
      return `<div class="row simple"><span>${drug.displayName} × <strong>${GAME.inventory[drug.id]}</strong></span><span class="good">$${worth.toLocaleString()}</span></div>`;
    })
    .join("");

  const gearLines = (GAME.assets || [])
    .map((assetId) => UPGRADES.find((u) => u.id === assetId))
    .filter(Boolean)
    .map((a) => `<div class="row simple"><span>${a.displayName}</span><span class="good">Equipped</span></div>`)
    .join("");

  const cargoValueStr = cargoValue().toLocaleString();

  el.mainPanel.innerHTML = `
    ${sectionHeader("Stash + Street Intel", "bag")}
    <div class="card-grid" style="margin-bottom:12px;">
      <section class="card money"><p class="eyebrow">Total Value</p><h3>$${cargoValueStr}</h3><p class="muted">If you sold everything here right now.</p></section>
      <section class="card"><p class="eyebrow">Bag</p><h3>${cargoCount()} / ${GAME.maxCarry}</h3><p class="muted">Upgrade via the Shop tab.</p></section>
    </div>

    ${sectionHeader("Street Intel", "info")}
    <div class="card-grid" style="margin-bottom:12px;">
      <section class="card"><p class="eyebrow">Rank</p><h3>${currentRank()}</h3><p class="muted">${GAME.rep} rep</p></section>
      <section class="card"><p class="eyebrow">Pressure</p><h3>${rookPressureState()}</h3><p class="muted">Heat ${GAME.heat} · ${areaRiskLabel(currentArea().riskLevel)} risk zone.</p></section>
    </div>
    ${sectionHeader("Drugs on Hand", "cash")}
    <div class="list-table" style="margin-bottom:12px;">
      ${drugLines || '<div class="row simple"><span class="muted">Nothing in the bag.</span><span>—</span></div>'}
    </div>
    ${sectionHeader("Gear", "shop")}
    <div class="list-table">
      ${gearLines || '<div class="row simple"><span class="muted">No gear equipped.</span><span>—</span></div>'}
    </div>
  `;
}

function renderHospitalScreen() {
  const missing = Math.max(0, 100 - GAME.health);
  const healCost = missing * 4;
  el.mainPanel.innerHTML = `
    ${sectionHeader("Hospital", "health")}
    <div class="card-grid" style="margin-bottom:12px;">
      <section class="card"><p class="eyebrow">Current Health</p><h3>${GAME.health} / 100</h3></section>
      <section class="card"><p class="eyebrow">Full Heal</p><h3>$${healCost.toLocaleString()}</h3><p class="muted">Street Doctor event is cheaper when available.</p></section>
    </div>
    <button class="btn primary" data-heal="full" type="button" ${healCost <= 0 || GAME.cash < healCost ? "disabled" : ""}>Heal Up</button>
  `;
}

function renderShopScreen() {
  const lines = UPGRADES.map((item) => {
    const owned = GAME.assets.includes(item.id);
    const canAfford = GAME.cash >= item.cost;
    const btnCls = owned ? "btn secondary" : canAfford ? "btn primary" : "btn";
    return `
      <div class="row simple">
        <span><strong>${item.displayName}</strong><br><small class="muted">$${item.cost.toLocaleString()}</small></span>
        <button class="${btnCls}" data-upgrade-buy="${item.id}" ${owned || !canAfford ? "disabled" : ""}>${owned ? "Owned" : "Buy"}</button>
      </div>`;
  }).join("");
  el.mainPanel.innerHTML = `
    ${sectionHeader("Gear Shop", "shop")}
    <div class="list-table">
      <div class="row simple header"><span>Item</span><span>Action</span></div>
      ${lines}
    </div>
  `;
}

function renderMainPanel() {
  switch (UI.tab) {
    case "market":   return renderMarketScreen();
    case "stash":    return renderStashScreen();
    case "bank":     return renderBankScreen();
    case "shop":     return renderShopScreen();
    case "hospital": return renderHospitalScreen();
    default:         return renderMarketScreen();
  }
}

function renderFeed() {
  el.eventFeed.innerHTML = GAME.events
    .map((entry) => `<div class="feed-item ${entry.tone}"><strong>${entry.stamp}</strong>${entry.text}</div>`)
    .join("");
}

function openModal(title, bodyHtml) {
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = bodyHtml;
  el.modalBackdrop.classList.remove("hidden");
}

function closeModal(force = false) {
  if (!force) {
    if (typeof CURRENT_EVENT !== "undefined" && CURRENT_EVENT) return;
    if (typeof COMBAT !== "undefined" && COMBAT) return;
  }
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
  el.mainNav.addEventListener("click", (event) => {
    const tabId = event.target.closest("[data-tab]")?.getAttribute("data-tab");
    if (!tabId) return;
    UI.tab = tabId;
    playClick();
    render();
  });

  el.mainPanel.addEventListener("click", (event) => {
    const t = event.target;
    const toggleTrade = t.closest("[data-toggle-trade]")?.getAttribute("data-toggle-trade");
    const toggleRow = t.closest("[data-toggle-row]")?.getAttribute("data-toggle-row");
    const qMinus = t.closest("[data-qty-minus]")?.getAttribute("data-qty-minus");
    const qPlus = t.closest("[data-qty-plus]")?.getAttribute("data-qty-plus");
    const qMax = t.closest("[data-qty-max]")?.getAttribute("data-qty-max");
    const doBuy = t.closest("[data-do-buy]")?.getAttribute("data-do-buy");
    const doSell = t.closest("[data-do-sell]")?.getAttribute("data-do-sell");
    const financeAction = t.closest("[data-finance-action]")?.getAttribute("data-finance-action");
    const doHeal = t.closest("[data-heal]")?.getAttribute("data-heal");
    const upgradeBuy = t.closest("[data-upgrade-buy]")?.getAttribute("data-upgrade-buy");
    const quickAction = t.closest("[data-quick-action]")?.getAttribute("data-quick-action");

    // Trade button or row-body click toggles expansion
    const toToggle = toggleTrade || (toggleRow && !qMinus && !qPlus && !qMax && !doBuy && !doSell ? toggleRow : null);
    if (toToggle) {
      UI.expandedDrug = UI.expandedDrug === toToggle ? null : toToggle;
      UI.qty[toToggle] = UI.qty[toToggle] || 1;
      playClick();
      render();
      return;
    }

    if (qMinus) { UI.qty[qMinus] = Math.max(1, (UI.qty[qMinus] || 1) - 1); playClick(); t.closest(".qty-stepper")?.classList.add("bump"); setTimeout(() => t.closest(".qty-stepper")?.classList.remove("bump"), 120); render(); return; }
    if (qPlus)  { UI.qty[qPlus]  = (UI.qty[qPlus] || 1) + 1; playClick(); t.closest(".qty-stepper")?.classList.add("bump"); setTimeout(() => t.closest(".qty-stepper")?.classList.remove("bump"), 120); render(); return; }
    if (qMax)   {
      const owned = GAME.inventory[qMax] || 0;
      UI.qty[qMax] = Math.max(1, Math.max(owned, maxBuyQty(qMax)));
      playClick();
      render();
      return;
    }

    if (doBuy)  { buyDrug(doBuy, UI.qty[doBuy] || 1, t); return; }
    if (doSell) { sellDrug(doSell, UI.qty[doSell] || 1, t); return; }

    if (doHeal) { healAtHospital(); return; }
    if (upgradeBuy) { maybeBuyUpgrade(upgradeBuy); return; }
    if (quickAction === "rob") { robAction(); return; }
    if (quickAction === "loan") { takeDreLoan(); return; }
    if (quickAction === "repay") { repayDre(); return; }
    if (financeAction) { moveMoney(financeAction); return; }
  });

  el.mainPanel.addEventListener("change", (event) => {
    const input = event.target.closest("[data-qty-input]");
    if (!input) return;
    const id = input.getAttribute("data-qty-input");
    UI.qty[id] = Math.max(1, Number(input.value) || 1);
    render();
  });

  el.stayBtn.addEventListener("click", () => {
    const nextSlot = nextSlotName();
    showSleepOverlay(`Day ${GAME.tick === 4 ? GAME.day + 1 : GAME.day} · ${nextSlot}`, () => {
      stepTick("You lay low and let time pass.");
    });
  });

  el.travelModalBtn.addEventListener("click", () => { playClick(); openTravelModal(); });
  el.clearFeedBtn.addEventListener("click", () => { GAME.events = []; renderFeed(); });
  el.modalCloseBtn.addEventListener("click", () => closeModal());

  el.modalBody.addEventListener("click", (event) => {
    const go = event.target.closest("[data-travel-go]")?.getAttribute("data-travel-go");
    const ok = event.target.closest("[data-modal-ok]")?.getAttribute("data-modal-ok");
    const eventChoice = event.target.closest("[data-event-choice]")?.getAttribute("data-event-choice");
    const combatAct = event.target.closest("[data-combat]")?.getAttribute("data-combat");
    if (go) { closeModal(true); travelTo(go); }
    if (ok) closeModal();
    if (eventChoice !== null && eventChoice !== undefined) resolveEventChoice(Number(eventChoice));
    if (combatAct) combatAction(combatAct);
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
  GAME.modifiers = [];
  GAME.friendRepayDay = null;
  GAME.lastPromotion = currentRank();
  if (typeof CURRENT_EVENT !== "undefined") CURRENT_EVENT = null;
  if (typeof COMBAT !== "undefined") COMBAT = null;
  generatePrices();
  addFeed("Fresh run started: $200 cash, no crew, no safety net.");
  render();
}

bindEvents();
resetGame();
