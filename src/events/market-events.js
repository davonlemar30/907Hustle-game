// The rolls behind a 907List flip: who got there first, who ghosted, what the
// buyer actually paid, and whether the walk home went badly.
//
// IMPORTANT: this module may require src/data/* and src/events/random.js and
// nothing else. It must never require game-core.js — game-core requires it.
//
// Every probability here is drawn from `stringHash(seed:market:...)` rather than
// `run.rngState`, and that is not a style preference. The RNG stream is shared
// with encounters, story cards, and crew resolution, so a draw taken from it
// makes a flip's outcome depend on whether an unrelated encounter fired earlier
// in the day. Replaying the same day would then produce a different robbery.
// Hashing the seed with the thing being decided keeps each roll independent and
// replay-stable, which is what the simulation hash actually measures.

const { stringHash } = require("./random.js");
const {
  CONDITIONS,
  SELLER_RELIABILITY,
  LISTING_ITEMS,
  LISTING_ITEM_BY_ID,
  MARKET_TIERS,
  ROBBERY,
  DOWNTOWN_MARGIN_BONUS,
  QUICK_SELL_MARKDOWN,
  REQUEST_PREMIUM,
  FLAKE_CHANCE,
  SNIPE_CHANCE,
  PRICE_VOLATILITY,
  INTELLIGENCE_VOLATILITY,
  BULK_DEAL,
  BUYER_NPCS,
  BUYER_REQUEST_TEMPLATES,
  REQUEST_BASE_CHANCE,
  REQUEST_FILL_BONUS,
  REQUEST_MAX_CHANCE,
} = require("../data/market.js");

const HASH_CEILING = 4294967296;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// A stable float in [0, 1) for one named decision. The key must name everything
// that makes this decision distinct — day, slot, and the item or listing id —
// or two decisions in the same slot share an outcome.
function roll(seed, key) {
  return stringHash(`${seed}:market:${key}`) / HASH_CEILING;
}

// A stable integer in [min, max], drawn from the same key space.
function rollRange(seed, key, min, max) {
  if (max <= min) return min;
  return min + Math.floor(roll(seed, key) * (max - min + 1));
}

// ---------------------------------------------------------------------------
// Robbery
// ---------------------------------------------------------------------------

// Risk priced off four things the player chose and one they earned:
//
//   baseRate * (carriedValue / 100) * district * timeOfDay * (1 + heat * 0.1)
//
// carriedValue stops contributing past $500 so a Broker holding a full board is
// not facing a certainty, and the whole thing is capped so there is always a
// way through.
function robberyRisk(state, { carriedValue = 0, district, slot } = {}) {
  const value = clamp(Number(carriedValue) || 0, 0, ROBBERY.carriedValueCap);
  const areaId = district || state.world.currentNeighborhoodId;
  const districtMultiplier = ROBBERY.districtMultiplier[areaId] != null
    ? ROBBERY.districtMultiplier[areaId]
    : 1;
  const slotIndex = clamp(Math.floor(slot == null ? state.run.slot : slot), 0, ROBBERY.slotMultiplier.length - 1);
  const timeMultiplier = ROBBERY.slotMultiplier[slotIndex];
  const heatModifier = 1 + (Number(state.player.heat) || 0) * ROBBERY.heatWeight;
  const risk = ROBBERY.baseRate
    * (value / ROBBERY.carriedValueDivisor)
    * districtMultiplier
    * timeMultiplier
    * heatModifier;
  return clamp(Math.round(risk * 10000) / 10000, 0, ROBBERY.maxRisk);
}

// Everything the UI needs to let the player reason about the meetup before
// committing to it. Without this the formula is invisible and "risk management"
// is guesswork.
function robberyPreview(state, context = {}) {
  const risk = robberyRisk(state, context);
  return {
    risk,
    percent: Math.round(risk * 100),
    band: risk >= 0.30 ? "severe" : risk >= 0.15 ? "high" : risk >= 0.06 ? "moderate" : "low",
    carriedValue: clamp(Number(context.carriedValue) || 0, 0, ROBBERY.carriedValueCap),
    district: context.district || state.world.currentNeighborhoodId,
    slot: context.slot == null ? state.run.slot : context.slot,
  };
}

function rollRobbery(state, context = {}) {
  const risk = robberyRisk(state, context);
  if (risk <= 0) return false;
  const key = `robbery:${state.run.day}:${context.slot == null ? state.run.slot : context.slot}:${context.nonce || 0}`;
  return roll(state.run.seed, key) < risk;
}

function robberyHealthLoss(state, nonce = 0) {
  return rollRange(state.run.seed, `robbery_hp:${state.run.day}:${state.run.slot}:${nonce}`, ROBBERY.healthLoss[0], ROBBERY.healthLoss[1]);
}

// ---------------------------------------------------------------------------
// Buying
// ---------------------------------------------------------------------------

// Someone else got there first. Seller reliability moves this, which is what
// makes the Tier 2 reliability readout worth having.
function rollSnipe(state, itemId, reliabilityId) {
  const reliability = SELLER_RELIABILITY[reliabilityId] || SELLER_RELIABILITY.mixed;
  const chance = clamp(SNIPE_CHANCE * reliability.snipeMultiplier, 0, 0.9);
  return roll(state.run.seed, `snipe:${state.run.day}:${state.run.slot}:${itemId}`) < chance;
}

// Which reliability band a listing carries on a given day. Stable per item per
// day so the board does not reshuffle its own tells between reads.
function reliabilityFor(state, itemId, day) {
  const value = roll(state.run.seed, `reliability:${day}:${itemId}`);
  if (value < 0.45) return "solid";
  if (value < 0.82) return "mixed";
  return "flaky";
}

// ---------------------------------------------------------------------------
// Selling
// ---------------------------------------------------------------------------

// What a buyer actually pays.
//
// Condition places the sale inside the item's true-value band; volatility then
// moves it +/-20% around that point. The estimate the board shows is the band
// midpoint, so "estimated profit" is honest without being a promise — which is
// the uncertainty Task 2 asks for.
// How wide the swing is. Intelligence tightens it; nothing else touches it.
function priceVolatility(state) {
  const intelligence = Number(state?.player?.attributes?.intelligence) || 0;
  const band = INTELLIGENCE_VOLATILITY.find((entry) => intelligence >= entry.floor);
  return band ? band.volatility : PRICE_VOLATILITY;
}

function salePrice(state, item, { condition, nonce = 0, district, quickSell = false, request = false } = {}) {
  const listing = typeof item === "string" ? LISTING_ITEM_BY_ID[item] : item;
  if (!listing) return 0;
  const band = CONDITIONS[condition || listing.condition] || CONDITIONS.good;
  const [low, high] = listing.trueValue;
  const anchor = low + (high - low) * band.position;
  const swing = (roll(state.run.seed, `volatility:${state.run.day}:${state.run.slot}:${listing.id}:${nonce}`) * 2 - 1) * priceVolatility(state);
  let price = anchor * (1 + swing);
  // Downtown pays a better margin, not a better price: the bonus applies to the
  // spread so a thin flip stays thin and the exposure still has to be earned.
  if (district === "downtown") price += Math.max(0, price - listing.buy) * DOWNTOWN_MARGIN_BONUS;
  if (quickSell) price *= 1 - QUICK_SELL_MARKDOWN;
  if (request) price *= 1 + REQUEST_PREMIUM;
  return Math.max(1, Math.round(price));
}

// What the board advertises before any of the above resolves.
function estimatedResale(item) {
  const listing = typeof item === "string" ? LISTING_ITEM_BY_ID[item] : item;
  if (!listing) return 0;
  return Math.round((listing.trueValue[0] + listing.trueValue[1]) / 2);
}

// Open-market buyers ghost. Quick sells and filled requests never do, so this
// is only ever asked about a pending open-market sale.
function rollFlake(state, pendingId) {
  return roll(state.run.seed, `flake:${pendingId}`) < FLAKE_CHANCE;
}

// ---------------------------------------------------------------------------
// Broker tier: requests and bulk deals
// ---------------------------------------------------------------------------

// A reliable broker gets more work. Frequency climbs with filled requests and
// stops at three in four days so it never becomes the only thing happening.
function requestChance(filledRequests) {
  return clamp(REQUEST_BASE_CHANCE + (Number(filledRequests) || 0) * REQUEST_FILL_BONUS, 0, REQUEST_MAX_CHANCE);
}

// Whether a named buyer texts today, and what they want. Deterministic from the
// seed and the day, so the same run always gets the same requests.
function generateBuyerRequest(state, { filledRequests = 0, day } = {}) {
  const onDay = day == null ? state.run.day : day;
  if (roll(state.run.seed, `request:${onDay}`) >= requestChance(filledRequests)) return null;
  const buyer = BUYER_NPCS[rollRange(state.run.seed, `request_buyer:${onDay}`, 0, BUYER_NPCS.length - 1)];
  const pool = LISTING_ITEMS.filter((item) => item.category === buyer.category);
  if (!pool.length) return null;
  const budget = rollRange(state.run.seed, `request_budget:${onDay}`, 120, 320);
  return {
    id: `req:${onDay}:${buyer.id}`,
    buyerId: buyer.id,
    buyerName: buyer.name,
    category: buyer.category,
    budget,
    day: onDay,
    text: BUYER_REQUEST_TEMPLATES[buyer.category].replace("${budget}", `$${budget}`),
  };
}

// A distressed seller listing three things at once. Buying the lot is a large
// capital lock and a large robbery target; flipping them individually is where
// the reward is.
function generateBulkDeal(state, { tier, day } = {}) {
  const onDay = day == null ? state.run.day : day;
  if (!MARKET_TIERS[tier] || !MARKET_TIERS[tier].bulk) return null;
  if (roll(state.run.seed, `bulk:${onDay}`) >= BULK_DEAL.chance) return null;
  const pool = LISTING_ITEMS.filter((item) => item.tier <= tier && item.buy < item.trueValue[1]);
  if (pool.length < BULK_DEAL.items) return null;
  const itemIds = [];
  for (let index = 0; index < BULK_DEAL.items; index += 1) {
    const remaining = pool.filter((item) => !itemIds.includes(item.id));
    itemIds.push(remaining[rollRange(state.run.seed, `bulk_item:${onDay}:${index}`, 0, remaining.length - 1)].id);
  }
  const listPrice = itemIds.reduce((sum, id) => sum + LISTING_ITEM_BY_ID[id].buy, 0);
  return {
    id: `bulk:${onDay}`,
    itemIds,
    listPrice,
    price: Math.round(listPrice * (1 - BULK_DEAL.discount)),
    discount: BULK_DEAL.discount,
    day: onDay,
  };
}

module.exports = {
  priceVolatility,
  roll,
  rollRange,
  robberyRisk,
  robberyPreview,
  rollRobbery,
  robberyHealthLoss,
  rollSnipe,
  reliabilityFor,
  salePrice,
  estimatedResale,
  rollFlake,
  requestChance,
  generateBuyerRequest,
  generateBulkDeal,
};
