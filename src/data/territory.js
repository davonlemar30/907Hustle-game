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
// v1.28 measured this instead of authoring it. 0.12 was a first guess carried
// since v1.21, and it was too high: at `watching` it took 29% of held corners
// over a measured window against a target of 20%.
//
// Swept 0.04-0.15 in 0.01 steps, 200 runs x 10 nights x all six corners, at all
// four phases, twice - once on the v1.27 code to get an honest control, and
// again with this build's heat probe and unstaffed term live, because tuning the
// base against a control that does not include them would ship a number that is
// wrong the moment they land. Every value in both sweeps produced a clean
// monotonic gradient across the phases, which is the finding that says the base
// was the thing that was wrong and the phase gate was not.
//
// 0.05 is the value that lands all three targets at once:
//
//   ambient      0.102   target 0.10-0.12, and roughly half of watching
//   watching     0.193   target 0.20
//   approaching  0.352   target 0.35-0.40, and roughly double watching
//
// The full table is in PROJECT_STATUS.md. Re-derive it with
// `node tests/measure-lieutenant-modifiers.js 300 10` before moving this.
const CURTIS_BASE_CHANCE = 0.05;
const CURTIS_VISIBILITY_WEIGHT = 0.4;

// What an unposted corner is worth as defense. Until v1.28 the divisor was
// `Math.max(1, soldiers)`, which made an EMPTY corner and a one-soldier corner
// arithmetically identical - so the claim two comments up, that the base was
// doubled to make an undefended corner cost double, was never true of anything
// but the two-soldier case. This is that claim, implemented: nobody standing on
// it is half a defender, so walking back onto an empty corner is twice as easy
// as walking through one person. It is also the whole of "probe the weakest" -
// the resolver already rolls each corner independently, so there is no ordering
// to tie-break, only a number that has to reward him for reading the gap.
const CURTIS_UNSTAFFED_DEFENSE = 0.5;

// --- He reads your Heat (v1.28) --------------------------------------------
// Not coordination. He has no line to the police and no plan that involves
// them. But a player running hot is a player whose soldiers keep getting
// arrested, and an understaffed corner is an easier corner - so he gets luckier
// when you are hot without ever having decided to.
//
// Below the floor this is exactly 1.0 and the build is invisible. At Heat 12 he
// is 20% more likely to move, at 15 35%. It multiplies into the existing
// `curtisMoveChance`, which is already compared against a hashed gate, so no new
// draw and no new hash: the same roll is measured against a higher bar.
//
// Deliberately NOT in the plan. `curtisNightPlan` is his intent and the gossip
// surface reports it; this is what the night does with the intent, and a warning
// that got quieter because the player's Heat dropped would be reporting the
// odds rather than the man.
const CURTIS_HEAT_PROBE_FLOOR = 8;
const CURTIS_HEAT_PROBE_PER_POINT = 0.05;

// How hard he is looking, by awareness phase. Read through
// CurtisAwareness.phaseForLevel - never re-derive the thresholds here.
//
// v1.28 moved two of these, and the reason is in the measurement rather than in
// anybody's taste. The targets are ambient at roughly half of watching and
// approaching at roughly double it. With 0.5/1.0/1.5 the measured ratios came
// out 0.43 and 1.46: ambient sat UNDER half because its visibility gate of 2
// only lets three of the six corners onto the board where watching's gate of 1
// lets five, and approaching could not reach double because 1.5 is not 2.
// So ambient is lifted to compensate for its own gate, and approaching is the
// number the target always implied.
const CURTIS_PHASE_MULTIPLIER = {
  invisible: 0,
  ambient: 0.6,
  watching: 1.0,
  approaching: 2.0,
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

// --- What he remembers, and what he saves up (v1.28) -----------------------
//
// RECAPTURE. A corner he has taken back off the player at least once outranks
// one he has not, ahead of visibility, because he wants his shit back.
//
// Note what this is NOT keyed on. The spec asked for "a corner the player
// claimed from owner: curtis", and every corner on the map starts owner:
// "curtis" - so that condition is true of all six and would rank nothing. The
// signal that actually separates corners is whether he has already come and
// taken one back, which the resolver stamps on the record when it happens. A
// corner that has changed hands twice is a corner with a history.
const CURTIS_RECAPTURE_PRIORITY = 1;

// BANK. Pressure points the plan could not spend - which only happens when he
// holds more budget than there are corners on his board - carry to tomorrow,
// capped. He accumulates intent.
//
// What this can and cannot do is worth stating plainly, because it is easy to
// read it as a difficulty knob and it is not one: the budget feeds the pressure
// WEIGHT, and the weight is not an input to curtisMoveChance. So the bank moves
// what the gossip surface and Pherris report - a tail corner reading "coming
// hard" instead of "just looking" - and cannot move a single loss rate. It is a
// telegraph, and v1.28 measured that it is a telegraph.
const CURTIS_PRESSURE_BANK_CAP = 2;

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
  CURTIS_UNSTAFFED_DEFENSE,
  CURTIS_HEAT_PROBE_FLOOR,
  CURTIS_HEAT_PROBE_PER_POINT,
  CURTIS_PHASE_MULTIPLIER,
  CURTIS_PHASE_VISIBILITY_GATE,
  CURTIS_TARGET_DEPTH_BY_PHASE,
  CURTIS_PRESSURE_BUDGET_BY_PHASE,
  CURTIS_MAX_PRESSURE_PER_BLOCK,
  CURTIS_PRESSURE_HARD,
  CURTIS_RECAPTURE_PRIORITY,
  CURTIS_PRESSURE_BANK_CAP,
  GOSSIP_WARNING_BASE_SCOPE,
  GOSSIP_DESHAWN_FULL_SCOPE_TIER,
  GOSSIP_DESHAWN_PRESSURE_TEXT_TIER,
  GOSSIP_DESHAWN_EARLY_ARRIVAL_TIER,
  GOSSIP_WARNING_ARRIVAL,
  GOSSIP_WARNING_EARLY_ARRIVAL,
  GOSSIP_RAID_ARRIVAL,
  RAID_DEFENSE_PER_SOLDIER,
};
