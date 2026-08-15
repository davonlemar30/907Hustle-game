// Test helpers for the Exposure System.
//
// Before v1.9a a test that needed a relationship wrote `state.npc.mina.trust = 3`.
// There is no such number any more, and a test that hand-builds a ledger to hit
// a score is really testing the weight table, not the thing it cares about.
//
// putInBand adds plausible evidence until the NPC lands in the band asked for.
// That keeps every migrated test asserting what it always asserted (does this
// gate open) and leaves the lens free to be retuned without a test rewrite.

const C = require("../game-core.js");

// Categories that move a disposition hardest in each direction, per archetype.
// Chosen to be things the character would actually notice, so a seeded ledger
// still reads as a story someone could have lived.
const UP = { mina: "honesty", curtis: "submission", dre: "financial", yalonda: "loyalty", juan: "loyalty", simone: "submission", selam: "discretion", biniam: "discretion" };
const DOWN = { mina: "violence", curtis: "growth", dre: "defiance", yalonda: "heat_exposure", juan: "violence", simone: "growth", selam: "heat_exposure", biniam: "violence" };

function ledgerRow(type, count, source) {
  return { type, event: "test_history", location: null, value: null, day: 1, count: Math.max(1, count), source: source || "witnessed" };
}

// Raise or lower an NPC until they sit in `band`, then stop. Returns the state.
// Throws rather than looping forever if the band is unreachable, because a
// silently-unreached band would make the calling test pass for the wrong reason.
function putInBand(state, npcId, band) {
  const current = C.selectors.dispositionBand(state, npcId);
  if (current === band) return state;
  const goingUp = band > current;
  const type = goingUp ? UP[npcId] : DOWN[npcId];
  // One row saturates: diminishing returns are clamped, so repeating a single
  // behavior forever stops paying. Varied evidence is what actually moves
  // someone, which is the design, so the helper adds fresh rows once the
  // current one stops earning.
  let row = null;
  let index = 0;
  let lastScore = null;
  for (let step = 0; step < 600; step += 1) {
    const at = C.selectors.dispositionBand(state, npcId);
    if (at === band) return state;
    if (goingUp ? at > band : at < band) {
      throw new Error(`overshot band ${band} for ${npcId}: landed at ${at} (score ${C.selectors.disposition(state, npcId)})`);
    }
    const score = C.selectors.disposition(state, npcId);
    if (!row || score === lastScore) {
      index += 1;
      row = ledgerRow(type, 1);
      row.event = `test_history_${index}`;
      state.npc[npcId].ledger.push(row);
    } else {
      row.count += 1;
    }
    lastScore = score;
  }
  throw new Error(`could not reach band ${band} for ${npcId}`);
}

// The common case: "this person is at least X with the player".
function atLeastBand(state, npcId, band) {
  if (C.selectors.dispositionBand(state, npcId) >= band) return state;
  return putInBand(state, npcId, band);
}

module.exports = { putInBand, atLeastBand, ledgerRow, UP, DOWN };
