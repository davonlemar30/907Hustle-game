// What comes for a corner at night, and what each one wants.
//
// Two adversaries, and conflating them was the v1.20 bug this file exists to
// fix. Until v1.21 a single blended roll decided both "the police busted your
// corner" and "Curtis took your corner", which meant Heat quietly governed how
// much territory the player kept and a player Curtis had never noticed still
// lost corners to him. They are separate events with separate causes now:
//
//   POLICE  read Heat and the block's patrolFrequency. They cost people and
//           cost Heat, and they NEVER change who owns the corner - the state
//           disrupts an operation, it does not claim real estate. Eli discounts
//           them, because keeping an operation quiet is the job.
//   CURTIS  reads the block's curtisVisibility and how hard he is already
//           looking. He changes who owns the corner and costs no Heat at all:
//           he is not the police, and a corner changing hands between two
//           people who both sell on it is not public disorder.
//
// Nothing here reads or writes game state, and nothing here may require
// game-core.js - the dependency runs one way, data into logic.

// --- Police ----------------------------------------------------------------
// Per staffed block per night. A quiet operator on a low-patrol corner sits
// near the 4% floor; a hot player on the Service Road Chokepoint (patrol 3)
// clears 20%. patrolFrequency is the only block stat that matters here, on
// purpose: the police do not care whose corner it is.
const POLICE_BASE_CHANCE = 0.04;
const POLICE_HEAT_WEIGHT = 0.015;
const POLICE_PATROL_WEIGHT = 0.03;

// Per point of Eli's lieutenantEffectiveness, off the police roll only.
//
// Deliberately NOT the 0.05 the single blended roll used. That number was
// tuned against a 0.10 base and a 0.15 patrol weight, where it was worth about
// a tenth of the roll per point. Against these constants it is worth a third,
// and at Heat 0 on a patrol-1 corner two points of effectiveness would clamp
// the chance to exactly zero - Eli would make a corner literally un-raidable.
// 0.015 reproduces what he was actually worth before: about -9% per point.
const POLICE_ELI_DISCOUNT = 0.015;

// --- Curtis ----------------------------------------------------------------
// Per owned block per night, staffed or not. Scaled by the block's
// curtisVisibility (0-3) and by the phase, then divided by what is standing on
// it. A visibility-0 corner multiplies out to zero at every phase, which is the
// point of the stat: Spenard Rec Center Lot is a corner his network does not
// carry news about, so he never comes for it.
//
// 0.12 rather than 0.06 because the divisor includes headcount. At two posted
// soldiers and no Tone the two cancel and a block sits where a single 0.06 roll
// would have put it; the base is doubled so that an UNDEFENDED corner - the one
// nobody is standing on - is the one that costs double.
const CURTIS_BASE_CHANCE = 0.12;
const CURTIS_VISIBILITY_WEIGHT = 0.4;

// How hard he is looking, by awareness phase. Read through
// CurtisAwareness.phaseForLevel - never re-derive the thresholds here.
const CURTIS_PHASE_MULTIPLIER = {
  invisible: 0,
  ambient: 0.5,
  watching: 1.0,
  approaching: 1.5,
};

// The minimum curtisVisibility a block must have to be targetable at all in a
// given phase. This is a gate, not a scale: below it the block is not on his
// map, and no amount of anything else puts it there.
//
//   invisible    99  he is not looking. Nothing is targetable.
//   ambient       2  he hears about the loud corners and only those.
//   watching      1  he hears about anything with a pulse.
//   approaching   0  everything with visibility above zero, and the zeroes are
//                    still zero because the multiplier - not the gate - is what
//                    keeps them off the board.
const CURTIS_PHASE_VISIBILITY_GATE = {
  invisible: 99,
  ambient: 2,
  watching: 1,
  approaching: 0,
};

// --- The nightly plan ------------------------------------------------------
// How many of the player's corners his people are working on a given night, by
// phase. This is the depth of the target list, and it is the same number the
// level-3 Pherris read shows: v1.23 made the plan the single source for both,
// so what she reports and what he actually comes for cannot drift.
const CURTIS_TARGET_DEPTH_BY_PHASE = { invisible: 0, ambient: 1, watching: 2, approaching: 3 };

// Pressure points he has to spend across that list, by phase, and the most any
// single corner can absorb. The allocation is greedy down the ranked list, so
// the budget lands as 2s at the top and 1s at the tail:
//
//   ambient      1 point,  depth 1  ->  [1]        one corner, just looking
//   watching     3 points, depth 2  ->  [2, 1]     the first one for real
//   approaching  5 points, depth 3  ->  [2, 2, 1]  two hard, one being scouted
//
// The weight is what the gossip surface calls "coming hard" (2) versus "just
// looking" (1), and it is the number that tells a warned player whether to post
// two soldiers on a corner or one. It does NOT feed curtisMoveChance: what he
// intends and what the night rolls are separate on purpose, so a warning is
// information rather than a promise.
const CURTIS_PRESSURE_BUDGET_BY_PHASE = { invisible: 0, ambient: 1, watching: 3, approaching: 5 };
const CURTIS_MAX_PRESSURE_PER_BLOCK = 2;
const CURTIS_PRESSURE_HARD = 2;

// --- Gossip warnings (v1.23) -----------------------------------------------
// The neighborhood notices his people moving before they move. How much of that
// reaches the player is a relationship question (Warm+ delivers, below Warm is
// silence) and a Deshawn question, and these are the Deshawn thresholds.
//
// Without him the player hears the loudest signal only - the plan's top target.
// He is wired into the street, so what he changes is reach and timing, never
// the plan itself:
//
//   tier 1  every corner on the plan, not just the top one
//   tier 2  + the pressure weight in the text
//   tier 3  + it arrives the evening before instead of the morning of
const GOSSIP_WARNING_BASE_SCOPE = 1;
const GOSSIP_DESHAWN_FULL_SCOPE_TIER = 1;
const GOSSIP_DESHAWN_PRESSURE_TEXT_TIER = 2;
const GOSSIP_DESHAWN_EARLY_ARRIVAL_TIER = 3;

// Where a warning lands, as (dayOffset, slot) from the day-end pass that raised
// it. Standard is the morning of the attack day; the Deshawn tier-3 bonus is the
// night before, which is the pass that is running - so it drains immediately and
// hands the player a whole extra day-part to reposition.
const GOSSIP_WARNING_ARRIVAL = { dayOffset: 1, slot: 0 };
const GOSSIP_WARNING_EARLY_ARRIVAL = { dayOffset: 0, slot: 3 };

// The morning-after read on a police raid. Reactive, not predictive: the police
// answer Heat, which can move at any time, so there is nothing to telegraph.
const GOSSIP_RAID_ARRIVAL = { dayOffset: 1, slot: 0 };

// --- Shared defense --------------------------------------------------------
// One posted soldier is one point of defense before any modifier. Both passes
// read it: the police casualty roll, and Curtis's divisor.
const RAID_DEFENSE_PER_SOLDIER = 1;

module.exports = {
  POLICE_BASE_CHANCE,
  POLICE_HEAT_WEIGHT,
  POLICE_PATROL_WEIGHT,
  POLICE_ELI_DISCOUNT,
  CURTIS_BASE_CHANCE,
  CURTIS_VISIBILITY_WEIGHT,
  CURTIS_PHASE_MULTIPLIER,
  CURTIS_PHASE_VISIBILITY_GATE,
  CURTIS_TARGET_DEPTH_BY_PHASE,
  CURTIS_PRESSURE_BUDGET_BY_PHASE,
  CURTIS_MAX_PRESSURE_PER_BLOCK,
  CURTIS_PRESSURE_HARD,
  GOSSIP_WARNING_BASE_SCOPE,
  GOSSIP_DESHAWN_FULL_SCOPE_TIER,
  GOSSIP_DESHAWN_PRESSURE_TEXT_TIER,
  GOSSIP_DESHAWN_EARLY_ARRIVAL_TIER,
  GOSSIP_WARNING_ARRIVAL,
  GOSSIP_WARNING_EARLY_ARRIVAL,
  GOSSIP_RAID_ARRIVAL,
  RAID_DEFENSE_PER_SOLDIER,
};
