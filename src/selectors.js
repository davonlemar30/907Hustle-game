// Small pure reads over run state, shared by game-core and the event cards.
// They live outside game-core so src/events/cards.js can use them without
// requiring game-core back and creating a cycle.
const { SPENARD_BLOCKS, SPENARD_BLOCK_BY_ID } = require("./data/locations.js");
const CurtisAwareness = require("./data/curtis-awareness.js");
const Territory = require("./data/territory.js");
const { stringHash } = require("./hash.js");

function checkpointDay(state) { return state.run.checkpointDay || Infinity; }

function controlled(state, areaId) { return state.world.territories[areaId]?.owner === "player"; }

function slotNumber(day, slot) { return (day - 1) * 4 + slot; }

// --- v1.20 Pherris: block intel ---------------------------------------------
//
// Territory intel used to be one boolean: flags.spenardBlocksRevealed, set by
// the scouting card Eli's map comes from. Pherris replaces the boolean with a
// tier - her runners are a standing feed, so what "revealed" means grows with
// what she can be trusted to handle.
//
//   0  nothing. The blocks are undiscovered.
//   1  the block exists, ownership is visible, and the map numbers a scout
//      could copy off a clipboard (earning, heat exposure, Curtis visibility,
//      patrol) are readable. No live read on anybody's position.
//   2  + soldier counts on player blocks, and an ESTIMATED defense on Curtis
//      blocks (+/-1, jittered from stringHash so a reload never rerolls it).
//   3  + exact defense, when he last hit a corner, and which corners his
//      people are lining up next.
//
// The flag still works on its own: a player who scouted before Pherris keeps
// level 1, and a player who never hires her keeps exactly the v1.19 game. She
// upgrades what revealed means; she is not the only way to reveal.
//
// This is deliberately a derived read with nothing cached. Later builds add
// intel SOURCES (disclosure tables, NPC one-shots) on top of the same ladder,
// and a stored level would have to be invalidated by every one of them.
function blockIntelLevel(state) {
  const pherris = state.people?.crew?.pherris;
  if (!pherris?.recruited || pherris.status !== "active") {
    return state.flags?.spenardBlocksRevealed ? 1 : 0;
  }
  return Math.min(3, Number(pherris.tier) || 1);
}

// What Curtis has standing on a corner he holds. There is no garrison record on
// his side of the map - the two numbers that describe how much of his attention
// a block carries are its Curtis visibility and its patrol frequency, so those
// are the strength his people would have to be worth. Floor of 1: he does not
// hold anything with nobody on it.
function curtisBlockDefense(blockId) {
  const definition = SPENARD_BLOCK_BY_ID[blockId];
  if (!definition) return 0;
  return Math.max(1, definition.curtisVisibility + definition.patrolFrequency);
}

// The level-2 estimate. Seeded on the run, the block, and the day, so it holds
// still for a day, moves like an estimate over a week, and never uses
// Math.random - a reloaded save reads the same number back.
function curtisBlockDefenseEstimate(state, blockId) {
  const exact = curtisBlockDefense(blockId);
  const jitter = (stringHash(`${state.run.seed}:block-intel:${blockId}:${state.run.day}`) % 3) - 1;
  return Math.max(1, exact + jitter);
}

// How he ranks two corners: how much his network carries about it, then what
// taking it back is worth, then the id so the order is total. Exported because
// the gossip surface has to reproduce this order without holding the plan - when
// there are more warned corners than people willing to call, the corner he wants
// most is the one that has to get said out loud.
function compareBlocksByCurtisPriority(aId, bId) {
  const a = SPENARD_BLOCK_BY_ID[aId];
  const b = SPENARD_BLOCK_BY_ID[bId];
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return (b.curtisVisibility - a.curtisVisibility) || (b.earningPotential - a.earningPotential) || (a.id < b.id ? -1 : 1);
}

// THE NIGHTLY PLAN (v1.23), and the one list two surfaces read.
//
// Which of the player's corners Curtis's people are working, ranked by how
// visible the block is to him and then by what taking it back would be worth,
// cut to the depth his awareness phase supports - invisible means nobody is
// looking at anything yet. Each entry carries a pressure weight: the phase's
// budget spent greedily down the list, capped per block, so the top corner
// reads "coming hard" and the tail reads "just looking".
//
// Two things about it are load-bearing.
//
// FIRST, it is gated by exactly what curtisMoveChance is gated by. Before
// v1.23 the target list only ranked - it did not apply the phase visibility
// gate and did not exclude visibility-0 corners, so at ambient it would name
// the Minnesota Off-Ramp as next while `curtisMoveChance` returned a flat zero
// for it, and at approaching it named the Spenard Rec Center Lot, a corner the
// multiplier means he never comes for at any phase. Pherris was reporting
// corners Curtis could not take. The list now answers the same question the
// night rolls against: is this corner on his map tonight.
//
// SECOND, it is a pure read with nothing stored and nothing drawn. Given the
// same day, phase and holdings it returns the same plan every time, which is
// what lets the day-end pass raise a warning about tomorrow night and the
// player re-derive the identical plan when tomorrow arrives. It deliberately
// does NOT read the garrison: the plan is his intent, and what the player posts
// in response is the thing the warning exists to let them change.
function curtisNightPlan(state) {
  const phase = state.curtisAwareness?.phase || CurtisAwareness.phaseForLevel(state.curtisAwareness?.level || 0);
  const depth = Territory.CURTIS_TARGET_DEPTH_BY_PHASE[phase] || 0;
  if (!depth || !(Territory.CURTIS_PHASE_MULTIPLIER[phase] > 0)) return [];
  const gate = Territory.CURTIS_PHASE_VISIBILITY_GATE[phase];
  const ranked = SPENARD_BLOCKS
    .filter((block) => state.world?.territoryBlocks?.[block.id]?.owner === "player")
    // A corner his network carries no news about is not on the board at any
    // phase, and one below the phase's floor is not on it tonight.
    .filter((block) => block.curtisVisibility > 0 && block.curtisVisibility >= (gate == null ? 99 : gate))
    .sort((a, b) => compareBlocksByCurtisPriority(a.id, b.id))
    .slice(0, depth);
  let budget = Territory.CURTIS_PRESSURE_BUDGET_BY_PHASE[phase] || 0;
  const plan = [];
  for (const block of ranked) {
    if (budget <= 0) break;
    const weight = Math.min(Territory.CURTIS_MAX_PRESSURE_PER_BLOCK, budget);
    budget -= weight;
    plan.push({ blockId: block.id, name: block.name, weight });
  }
  return plan;
}

function curtisBlockTargets(state) {
  return curtisNightPlan(state).map((entry) => entry.blockId);
}

// One read per block for the UI, so no screen has to remember which level owns
// which field. Everything a level does not cover comes back null rather than
// undefined: a card checks `!== null`, never a level number.
function blockIntelView(state, blockId) {
  const definition = SPENARD_BLOCK_BY_ID[blockId];
  const record = state.world?.territoryBlocks?.[blockId];
  const level = blockIntelLevel(state);
  const view = { level, blockId, known: level >= 1, owner: null, stats: null, soldiers: null, defense: null, defenseExact: false, lastRaidDay: null, targeted: false };
  if (!definition || !record || level < 1) return view;
  view.owner = record.owner;
  view.stats = { earningPotential: definition.earningPotential, heatExposure: definition.heatExposure, curtisVisibility: definition.curtisVisibility, patrolFrequency: definition.patrolFrequency };
  if (level >= 2) {
    if (record.owner === "player") view.soldiers = (record.soldiersAssigned || []).length;
    else {
      view.defense = level >= 3 ? curtisBlockDefense(blockId) : curtisBlockDefenseEstimate(state, blockId);
      view.defenseExact = level >= 3;
    }
  }
  if (level >= 3) {
    view.lastRaidDay = record.lastRaidDay;
    view.targeted = record.owner === "player" && curtisBlockTargets(state).includes(blockId);
  }
  return view;
}

module.exports = {
  checkpointDay,
  controlled,
  slotNumber,
  blockIntelLevel,
  blockIntelView,
  curtisBlockDefense,
  curtisBlockDefenseEstimate,
  curtisNightPlan,
  curtisBlockTargets,
  compareBlocksByCurtisPriority,
};
