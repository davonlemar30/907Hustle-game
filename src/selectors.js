// Small pure reads over run state, shared by game-core and the event cards.
// They live outside game-core so src/events/cards.js can use them without
// requiring game-core back and creating a cycle.
const { SPENARD_BLOCKS, SPENARD_BLOCK_BY_ID } = require("./data/locations.js");
const CurtisAwareness = require("./data/curtis-awareness.js");
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

// Level 3: which of the player's corners Curtis's people are lining up next.
// Ranked by how visible the block is to him, then by what taking it back would
// be worth. How far down that list he is actually working is his ambient
// awareness - invisible means nobody is looking at anything yet.
const CURTIS_TARGETS_BY_PHASE = { invisible: 0, ambient: 1, watching: 2, approaching: 3 };

function curtisBlockTargets(state) {
  const phase = state.curtisAwareness?.phase || CurtisAwareness.phaseForLevel(state.curtisAwareness?.level || 0);
  const depth = CURTIS_TARGETS_BY_PHASE[phase] || 0;
  if (!depth) return [];
  return SPENARD_BLOCKS
    .filter((block) => state.world?.territoryBlocks?.[block.id]?.owner === "player")
    .sort((a, b) => (b.curtisVisibility - a.curtisVisibility) || (b.earningPotential - a.earningPotential) || (a.id < b.id ? -1 : 1))
    .slice(0, depth)
    .map((block) => block.id);
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
  curtisBlockTargets,
  CURTIS_TARGETS_BY_PHASE,
};
