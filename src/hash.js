// FNV-1a over a string, the one deterministic hash the whole game uses.
//
// It lives in its own file rather than in src/events/random.js because that
// module requires src/selectors.js (for slotNumber), and the selectors need the
// hash too — v1.20's block-intel estimates are jittered from it. Importing it
// back from random.js would close a cycle and hand whichever module loaded
// second a half-built copy of the other. This file requires nothing, so it can
// be required from anywhere, including src/data/*.
//
// Nothing in the game may use Math.random: every probability is either drawn
// from the run's seeded RNG or hashed from the seed through here.
function stringHash(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

// 2^32 — what a stringHash result divides by to become a 0..1 probability.
const HASH_CEILING = 4294967296;

module.exports = { stringHash, HASH_CEILING };
