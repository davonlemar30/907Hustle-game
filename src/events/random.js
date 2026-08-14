// Deterministic RNG. Every run is reproducible from its seed, which is what
// lets tests/simulate-runs.js compare two builds by hashing 200 seeded runs,
// so nothing here may use Math.random.
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

module.exports = {
  normalizeSeed,
  stringHash,
  makeRandom,
  seededShuffle,
};
