// The 907List resale market: what is for sale, what it is really worth, and the
// constants that price risk.
//
// Static definitions only. No logic, no state — the rolls live in
// src/events/market-events.js and the reducer cases live in game-core.js.
//
// The design rule every number here serves: a flip should be a judgment call.
// That is why `buy` (what the seller is asking) and `trueValue` (what it will
// actually fetch) are separate fields. At Tier 1 the player sees only the title
// and the asking price, so the title has to carry the tell — "cracked bezel" at
// $65 is the appraisal skill, not a hidden dice roll.

const MARKET_CATEGORIES = ["electronics", "auto_parts", "furniture", "household"];

// Where in trueValue a sale lands. Condition is hidden at Tier 1 and visible
// from Tier 2 on, which is most of what the laptop actually buys you.
const CONDITIONS = {
  mint: { id: "mint", label: "Like new", position: 0.9 },
  good: { id: "good", label: "Good", position: 0.65 },
  fair: { id: "fair", label: "Fair", position: 0.4 },
  rough: { id: "rough", label: "Rough", position: 0.15 },
};

// How likely the seller is to still be there when you show up. Visible from
// Tier 2, which is what turns the snipe from bad luck into a read.
const SELLER_RELIABILITY = {
  solid: { id: "solid", label: "Solid", snipeMultiplier: 0.5 },
  mixed: { id: "mixed", label: "Mixed", snipeMultiplier: 1 },
  flaky: { id: "flaky", label: "Flaky", snipeMultiplier: 1.8 },
};

// tier   the lowest broker tier this listing appears for. Higher tiers see the
//        whole pool below them, which is what keeps average margin from spiking
//        the moment a new band unlocks.
// buy    what the seller is asking.
// trueValue  what it is actually worth on resale. On a junk listing this sits
//        below the asking price, and nothing but the title says so.
// Margins climb with tier because throughput does not. A Scrapper sees two
// listings a day and has to wait overnight for a buyer, so roughly one flip a
// day is the ceiling no matter how well they read the board; the only lever left
// for making a tier worth reaching is what one flip is worth. Tier 3 prices are
// deliberately kept under $200 as well — a run's working capital tops out around
// $300, and an item nobody can afford is not content.
const LISTING_ITEMS = [
  // Tier 1 — Spenard curb finds. Margin about 65% of cost.
  { id: "space_heater", name: "Space heater", category: "household", tier: 1, buy: 25, trueValue: [42, 58], condition: "good" },
  { id: "winter_coat", name: "Winter coat bundle", category: "household", tier: 1, buy: 35, trueValue: [56, 78], condition: "good" },
  { id: "dresser", name: "Solid dresser", category: "furniture", tier: 1, buy: 40, trueValue: [64, 88], condition: "good" },
  { id: "shop_vac", name: "Shop vacuum", category: "household", tier: 1, buy: 45, trueValue: [71, 97], condition: "fair" },
  { id: "used_tv", name: "Used television", category: "electronics", tier: 1, buy: 55, trueValue: [86, 116], condition: "good" },
  { id: "camp_stove", name: "Camp stove", category: "household", tier: 1, buy: 60, trueValue: [93, 125], condition: "mint" },
  { id: "tool_set", name: "Mechanic tool set", category: "auto_parts", tier: 1, buy: 70, trueValue: [108, 144], condition: "good" },
  { id: "snow_tires", name: "Set of snow tires", category: "auto_parts", tier: 1, buy: 80, trueValue: [122, 162], condition: "fair" },

  // Tier 1 junk. The title is the only warning at Scrapper tier.
  { id: "cracked_tv", name: "Flatscreen, cracked bezel", category: "electronics", tier: 1, buy: 65, trueValue: [30, 48], condition: "rough" },
  { id: "rusted_toolbox", name: "Toolbox, surface rust", category: "auto_parts", tier: 1, buy: 50, trueValue: [24, 40], condition: "rough" },
  { id: "sagging_couch", name: "Couch, sags in the middle", category: "furniture", tier: 1, buy: 60, trueValue: [28, 46], condition: "rough" },

  // Tier 2 — the laptop opens the wider board. Margin about 60% of cost, on
  // stock that costs twice as much to get into.
  { id: "car_battery", name: "Car battery, tested", category: "auto_parts", tier: 2, buy: 85, trueValue: [126, 168], condition: "good" },
  { id: "office_chair", name: "Ergonomic office chair", category: "furniture", tier: 2, buy: 95, trueValue: [140, 186], condition: "good" },
  { id: "bluetooth_speaker", name: "Bluetooth speaker set", category: "electronics", tier: 2, buy: 105, trueValue: [154, 205], condition: "mint" },
  { id: "roof_rack", name: "Roof rack and crossbars", category: "auto_parts", tier: 2, buy: 115, trueValue: [169, 224], condition: "good" },
  { id: "game_console", name: "Game console, two pads", category: "electronics", tier: 2, buy: 125, trueValue: [183, 243], condition: "good" },
  { id: "chest_freezer", name: "Chest freezer", category: "household", tier: 2, buy: 140, trueValue: [204, 271], condition: "fair" },

  // Tier 2 junk.
  { id: "flood_console", name: "Console, was in a flood", category: "electronics", tier: 2, buy: 125, trueValue: [58, 92], condition: "rough" },
  { id: "bent_roof_rack", name: "Roof rack, slight bend", category: "auto_parts", tier: 2, buy: 115, trueValue: [52, 84], condition: "rough" },

  // Tier 3 — Broker inventory. Margin about 60% of cost on the heaviest stock a
  // run's bankroll can actually carry, and every dollar of it is also a robbery
  // target until it moves.
  { id: "alternator_set", name: "Rebuilt alternator set", category: "auto_parts", tier: 3, buy: 150, trueValue: [222, 292], condition: "good" },
  { id: "sectional_couch", name: "Leather sectional", category: "furniture", tier: 3, buy: 165, trueValue: [244, 320], condition: "good" },
  { id: "dslr_camera", name: "DSLR body and lens", category: "electronics", tier: 3, buy: 175, trueValue: [258, 340], condition: "mint" },
  { id: "dining_set", name: "Dining set, six chairs", category: "furniture", tier: 3, buy: 185, trueValue: [273, 359], condition: "good" },
  { id: "snow_blower", name: "Two-stage snow blower", category: "household", tier: 3, buy: 195, trueValue: [288, 378], condition: "good" },

  // Tier 3 junk. The most expensive mistake on the board.
  { id: "seized_blower", name: "Snow blower, seized last winter", category: "household", tier: 3, buy: 190, trueValue: [82, 128], condition: "rough" },
];

const LISTING_ITEM_BY_ID = Object.fromEntries(LISTING_ITEMS.map((item) => [item.id, item]));

// A listing is junk when the seller is asking more than it will ever fetch.
// Derived rather than flagged so the catalogue cannot claim one thing and price
// another.
function isJunk(item) {
  return item.buy >= item.trueValue[1];
}

// listings        how many the board shows per day
// fields          what the player is allowed to see about each one
// districts       where a meetup may be arranged
// sellDelayDays   0 means the sale resolves in the same slot (verified seller)
// capacity        how many items may be held at once
const MARKET_TIERS = {
  1: {
    id: 1, name: "Scrapper", listings: 2, capacity: 3, sellDelayDays: 1,
    fields: ["title", "price"],
    districts: ["north_star_lot"],
    quickSell: false, requests: false, bulk: false, specialist: false,
    blurb: "A random poster with no reputation. Two listings, no detail, meet in Spenard.",
  },
  2: {
    id: 2, name: "Flipper", listings: 4, capacity: 4, sellDelayDays: 1,
    fields: ["title", "price", "condition", "reliability"],
    districts: ["north_star_lot", "downtown"],
    quickSell: true, requests: false, bulk: false, specialist: true,
    blurb: "The laptop opens the board. Condition, seller reliability, Downtown meetups, and quick sells.",
  },
  3: {
    id: 3, name: "Broker", listings: 4, capacity: 6, sellDelayDays: 0,
    fields: ["title", "price", "condition", "reliability"],
    districts: ["north_star_lot", "downtown"],
    quickSell: true, requests: true, bulk: true, specialist: true,
    blurb: "Named buyers text you what they need. Verified status sells same day.",
  },
};

const MAX_TIER = 3;

// Tier 3 opens at ten clean flips. A dispute is a deal that went bad on your
// side, not a buyer who ghosted — flakes do not count against you.
const BROKER_FLIP_REQUIREMENT = 10;
const BROKER_DISPUTE_LIMIT = 2;

// Three flips in one category earns the tag and a fifth listing in it.
const SPECIALIST_FLIP_REQUIREMENT = 3;

// Robbery risk, priced off things the player chose:
//   baseRate * (min(carriedValue, cap) / 100) * district * timeOfDay * (1 + heat * heatWeight)
//
// $200 of electronics, Downtown, Night, heat 4 works out to 37.8%. The same
// items in Spenard on a Morning are 3%. Moving smart is the whole mechanic.
const ROBBERY = {
  baseRate: 0.03,
  carriedValueCap: 500,
  carriedValueDivisor: 100,
  heatWeight: 0.1,
  maxRisk: 0.85,
  districtMultiplier: { north_star_lot: 1.0, downtown: 1.8, airport_industrial: 2.2 },
  slotMultiplier: [0.5, 1.0, 1.5, 2.5],
  healthLoss: [6, 14],
  heatGain: 1,
};

// Downtown pays better because it is worth the exposure, not instead of it.
const DOWNTOWN_MARGIN_BONUS = 0.30;

// Certainty costs twenty percent. A quick sell never flakes and never waits.
const QUICK_SELL_MARKDOWN = 0.20;

// A filled request beats the open market because sourcing it was the work.
const REQUEST_PREMIUM = 0.15;

// Open-market buyers ghost. Quick sells and filled requests never do.
const FLAKE_CHANCE = 0.15;

// Someone else got there first.
const SNIPE_CHANCE = 0.15;

// What the board estimates versus what the buyer actually pays.
const PRICE_VOLATILITY = 0.20;

// A distressed seller dumping three things at once. High capital lock, and
// every dollar of it is carried value the next time you walk anywhere.
const BULK_DEAL = { items: 3, discount: 0.30, chance: 0.22 };

// Named buyers emerge at Broker tier and text what they need. Frequency scales
// with how many of their requests you have actually filled.
const BUYER_NPCS = [
  { id: "renata", name: "Renata", category: "electronics" },
  { id: "wendell", name: "Wendell", category: "auto_parts" },
  { id: "tasha", name: "Tasha", category: "furniture" },
  { id: "boone", name: "Boone", category: "household" },
];

const BUYER_REQUEST_TEMPLATES = {
  electronics: "need something electronic under ${budget}, lmk what you got",
  auto_parts: "looking for parts, ${budget} ceiling. hit me when you find it",
  furniture: "furnishing a place. under ${budget} and it's yours",
  household: "need household stuff, ${budget} max. no junk",
};

const REQUEST_BASE_CHANCE = 0.35;
const REQUEST_FILL_BONUS = 0.08;
const REQUEST_MAX_CHANCE = 0.75;
const REQUEST_EXPIRY_DAYS = 3;

// Weekly inventory-accumulation observation fires above this held value.
const INVENTORY_NOTICE_VALUE = 250;

// What the 200-run simulation is checked against. Documented here rather than
// in the test so the balance target and the catalogue live side by side.
const TIER_INCOME_TARGETS = {
  1: [30, 50],
  2: [60, 100],
  3: [100, 150],
};

module.exports = {
  MARKET_CATEGORIES,
  CONDITIONS,
  SELLER_RELIABILITY,
  LISTING_ITEMS,
  LISTING_ITEM_BY_ID,
  isJunk,
  MARKET_TIERS,
  MAX_TIER,
  BROKER_FLIP_REQUIREMENT,
  BROKER_DISPUTE_LIMIT,
  SPECIALIST_FLIP_REQUIREMENT,
  ROBBERY,
  DOWNTOWN_MARGIN_BONUS,
  QUICK_SELL_MARKDOWN,
  REQUEST_PREMIUM,
  FLAKE_CHANCE,
  SNIPE_CHANCE,
  PRICE_VOLATILITY,
  BULK_DEAL,
  BUYER_NPCS,
  BUYER_REQUEST_TEMPLATES,
  REQUEST_BASE_CHANCE,
  REQUEST_FILL_BONUS,
  REQUEST_MAX_CHANCE,
  REQUEST_EXPIRY_DAYS,
  INVENTORY_NOTICE_VALUE,
  TIER_INCOME_TARGETS,
};
