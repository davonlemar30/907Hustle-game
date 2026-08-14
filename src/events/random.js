// Deterministic RNG. Every run is reproducible from its seed, which is what
// lets tests/simulate-runs.js compare two builds by hashing 200 seeded runs,
// so nothing here may use Math.random.
const { slotNumber } = require("../selectors.js");

function normalizeSeed(seed) {
  const numeric = Number(seed);
  const fallback = 0x9072026;
  return ((Number.isFinite(numeric) ? numeric : fallback) >>> 0) || fallback;
}

function stringHash(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function makeRandom(seed) {
  let value = normalizeSeed(seed);
  return {
    next() { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; value >>>= 0; return value / 4294967296; },
    int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; },
    pick(items) { return items[Math.floor(this.next() * items.length)]; },
    get state() { return value >>> 0; },
  };
}

function seededShuffle(items, seed, salt) {
  const random = makeRandom(stringHash(`${normalizeSeed(seed)}:${normalizeSeed(salt)}`));
  const out = items.slice();
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = random.int(0, index);
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

const HASH_CEILING = 4294967296;

// A weighted pick keyed on a string rather than drawn from run.rngState.
//
// Same algorithm as weightedPick in game-core and weightedTemplate in
// encounters.js, and deliberately not a third copy of the *stream* version: an
// attribute check must resolve the same way on a replay of the same day, which
// it cannot do if an unrelated encounter earlier in the day consumed a draw
// first. Entries carry an optional `weight` and default to 1.
function seededPick(items, key) {
  if (!Array.isArray(items) || !items.length) return null;
  const weights = items.map((item) => Math.max(0, Number(item && item.weight) || 0));
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return items[stringHash(key) % items.length];
  let roll = (stringHash(key) / HASH_CEILING) * total;
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return items[index];
  }
  return items[items.length - 1];
}

// Week Zero is the tutorial stretch, so the arcs that escalate pressure and the
// cards that close a run are held back until it ends.
const WEEK_ZERO_BLOCKED_CHAINS = ["dre_note", "curtis_pressure"];
const WEEK_ZERO_BLOCKED_CLASSIFICATIONS = ["threat", "ending_setup"];

// The single gate every story card passes through. Kept here, and kept free of
// game-core imports, so the reducer and the tests ask the same question:
// `resolved(state, id)` is injected because "has this already happened" lives in
// game-core's flag naming.
function isEligible(card, state, { absolute, resolved }) {
  if (state.run.phase === "week_zero"
    && (WEEK_ZERO_BLOCKED_CHAINS.includes(card.chain) || WEEK_ZERO_BLOCKED_CLASSIFICATIONS.includes(card.classification))) return false;
  if (card.once && resolved(state, card.id)) return false;
  if (card.area && card.area !== state.world.currentNeighborhoodId) return false;
  if (absolute < slotNumber(card.earliest.day, card.earliest.slot || 0)) return false;
  if (card.latest && state.run.day > card.latest.day) return false;
  if (state.run.recentEvents.includes(card.id)) return false;
  const last = state.run.eventHistory ? state.run.eventHistory[card.id] : undefined;
  if (last !== undefined && absolute - last < card.cooldown) return false;
  if (card.exit && card.exit(state)) return false;
  return card.requires(state);
}

// A card's draw weight. The floor keeps a card that some multiplier drove to
// zero still nominally drawable rather than silently unreachable.
function getWeight(card, state, weightMultiplier) {
  return Math.max(0.01, card.weight) * weightMultiplier(state, card);
}

module.exports = {
  normalizeSeed,
  stringHash,
  makeRandom,
  seededShuffle,
  seededPick,
  isEligible,
  getWeight,
};
