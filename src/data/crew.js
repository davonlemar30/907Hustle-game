// Crew system constants and pure helpers (v1.15).
//
// Data-module contract: this file may require other src/data modules but never
// game-core.js. Reducer logic (wage settlement, departures, recruitment) lives
// in game-core; this module owns the numbers and the pure lookups so the tier
// curve and loyalty scale exist in exactly one place.
//
// Loyalty is a 0-10 scale. 5 is the neutral starting point, 0 is departure,
// 10 is maximum. Pre-v11 saves stored loyalty as a delta accumulator centered
// on 0; migrateSave rescales those with clamp(5 + old, 0, 10).

const { CREW } = require("./npcs.js");
const { BANDS } = require("./disposition-bands.js");

const CREW_LOYALTY_MIN = 0;
const CREW_LOYALTY_MAX = 10;
const CREW_LOYALTY_START = 5;

// Nights a wage can go unpaid before loyalty starts bleeding. The first two
// missed nights are grace ("they give 2 days"); every night after costs the
// member one loyalty point.
const CREW_WAGE_GRACE_DAYS = 2;

// Wage curve per tier. A tier-1 leader is alone; tier 2 implies a couple of
// unnamed hands; tier 3 is a department. Only Deshawn's curve is authored so
// far - crew without an entry keep their flat roster wage at every tier, which
// is the pre-v1.15 behavior. Design the curve here, not at call sites, so the
// soldier build can extend it without a migration.
const TIER_WAGES = {
  deshawn: [50, 100, 200],
  // v1.18: Tone is expensive because muscle is. Tier 2 means he has brought
  // hands with him, tier 3 means a squad, and the wage says so before the
  // player has to find out the other way.
  tone: [85, 150, 250],
  // v1.19: information costs less than muscle, and it still scales - tier 2 is a
  // couple of people making calls for her, tier 3 is a desk. Tier 1 matches her
  // flat roster wage, so putting her on the curve changes nothing until she is
  // actually promoted.
  pherris: [60, 120, 220],
};

function wageFor(person, tier) {
  const curve = TIER_WAGES[person.id];
  if (!curve) return person.wage;
  return curve[Math.max(0, Math.min(curve.length - 1, (Number(tier) || 1) - 1))];
}

// Generic tier gates. Each crew member layers NPC-specific conditions on top
// (deshawn: his own disposition; pherris: market activity, then territory and
// Broker standing; tone: fights he stood in, then controlled blocks) - those
// stay in crewTierAvailability in game-core. daysRecruited compares
// against crew.recruitedDay; a migrated member with recruitedDay null counts
// as recruited long ago and passes the day gate.
const TIER_REQUIREMENTS = {
  2: { loyalty: 7, daysRecruited: 5 },
  3: { loyalty: 9, daysRecruited: 12 },
};

function tierRequirementMet(crewRecord, targetTier, currentDay) {
  const req = TIER_REQUIREMENTS[targetTier];
  if (!req) return false;
  if ((Number(crewRecord.loyalty) || 0) < req.loyalty) return false;
  if (crewRecord.recruitedDay == null) return true;
  return (Number(currentDay) || 0) - Number(crewRecord.recruitedDay) >= req.daysRecruited;
}

function clampLoyalty(value) {
  return Math.max(CREW_LOYALTY_MIN, Math.min(CREW_LOYALTY_MAX, Math.round(Number(value) || 0)));
}

// Active crew: recruited and still working. Departed members keep their record
// (history matters for the story) but stop counting toward capacity, power,
// wages, or presence effects.
function getActiveCrew(state) {
  return CREW.filter((person) => {
    const record = state.people?.crew?.[person.id];
    return record && record.recruited && record.status === "active";
  });
}

// Encounters run by Curtis's own people. Deshawn's diplomacy does not work on
// them at tier 1 - they know who pays him no respect yet. Legacy encounter
// templates early/mid/late are Curtis pressure; mini_mart_parking_lot is the
// red-gloves crew from the consequence engine.
const CURTIS_CREW_ENCOUNTER_IDS = ["early_street", "mid", "late", "mini_mart_parking_lot"];

// Presence-effect framework: what an active crew member changes about event
// resolution just by being on the payroll. Checked at choice-build time (the
// encounter selectors and card builders), not at render time, so the reducer
// and the UI agree about which choices exist.
const PRESENCE_EFFECTS = {
  deshawn: [
    { eventType: "encounter", modification: "de_escalate", excludes: CURTIS_CREW_ENCOUNTER_IDS },
    { eventType: "stick_retaliation", modification: "de_escalate", excludes: [] },
  ],
  // v1.18: Tone talks nobody down. What he changes is how it goes once it has
  // started - one effective level of Combat on the roll. Never against Curtis's
  // own people: they knew him when he worked their side of it, and a face they
  // already know is not a reason to walk away.
  tone: [
    { eventType: "encounter", modification: "combat_advantage", excludes: CURTIS_CREW_ENCOUNTER_IDS },
    { eventType: "stick_target", modification: "combat_advantage", excludes: [] },
  ],
  // v1.19: Pherris changes nothing about a fight and everything about a price.
  // One effective level of Intelligence on market reads - she knows which of
  // these buyers is serious, so the meetup is chosen better and the swing on a
  // sale is narrower. No exclusions: a contact list does not care whose corner
  // the deal is on.
  pherris: [
    { eventType: "market_transaction", modification: "intel_advantage", excludes: [] },
    { eventType: "907list_flip", modification: "intel_advantage", excludes: [] },
  ],
};

function presenceEffectsFor(state, eventType, contextId) {
  const effects = [];
  for (const person of getActiveCrew(state)) {
    // Loyalty 0 is the day they stop showing up; the wage settlement is what
    // makes it official that night by flipping status to "departed". Until then
    // they are on the roster and doing nothing, which is what the number means.
    if ((Number(state.people?.crew?.[person.id]?.loyalty) || 0) <= 0) continue;
    for (const effect of PRESENCE_EFFECTS[person.id] || []) {
      if (effect.eventType !== eventType) continue;
      if (contextId && effect.excludes.includes(contextId)) continue;
      effects.push({ crewId: person.id, ...effect });
    }
  }
  return effects;
}

// v1.19: the de-escalate consumer. The two `de_escalate` records above were
// declared in v1.15 and read by nobody - the three sites that offer Deshawn's
// choice each rebuilt the predicate inline instead. These are what they call
// now, so "who can talk this down" is answered in one place.
//
// Note this is stricter than the inline checks were, and deliberately: they
// tested `status !== "departed"`, which let an ARRESTED Deshawn talk down an
// encounter he was in a cell for. getActiveCrew tests `status === "active"`,
// so a jailed member now stays out of it. That is the intended reading of the
// framework, and it is why this refactor moves the simulation hash.
function deEscalateCrewIds(state, eventType, contextId) {
  return presenceEffectsFor(state, eventType, contextId)
    .filter((effect) => effect.modification === "de_escalate")
    .map((effect) => effect.crewId);
}

function deEscalateAvailable(state, eventType, contextId) {
  return deEscalateCrewIds(state, eventType, contextId).length > 0;
}

// One effective attribute level, no matter how many people are standing there.
// A second enforcer is a second person, not a second bonus - the roster already
// prices headcount through wages and capacity.
const COMBAT_ADVANTAGE_CAP = 1;

function combatAdvantageFor(state, eventType, contextId) {
  return Math.min(COMBAT_ADVANTAGE_CAP, combatAdvantageCrewIds(state, eventType, contextId).length);
}

// Who supplied the advantage, so the caller can credit the win to the right
// record. Reads through the same exclusion-aware path as the bonus itself, so a
// win the bonus did not apply to can never be counted.
function combatAdvantageCrewIds(state, eventType, contextId) {
  return presenceEffectsFor(state, eventType, contextId)
    .filter((effect) => effect.modification === "combat_advantage")
    .map((effect) => effect.crewId);
}

// v1.19: the market half of the same idea, and capped for the same reason. A
// second connector is a second person, not a second bonus.
const INTEL_ADVANTAGE_CAP = 1;

function intelAdvantageFor(state, eventType, contextId) {
  return Math.min(INTEL_ADVANTAGE_CAP, intelAdvantageCrewIds(state, eventType, contextId).length);
}

function intelAdvantageCrewIds(state, eventType, contextId) {
  return presenceEffectsFor(state, eventType, contextId)
    .filter((effect) => effect.modification === "intel_advantage")
    .map((effect) => effect.crewId);
}

// RECRUITMENT PROOF (v1.18): some people want proof of standing before they
// take a wage, and the proof is whatever their own lens decided to count.
//
// Band-gated rather than category-counting on purpose. The lens already does
// the work of deciding what matters to a given person - Tone's violence: 3 and
// submission: -3 overrides mean five fights and three refusals score nothing
// like eight quiet nights. Re-implementing that arithmetic here would be a
// second copy of it, and the two would drift.
//
// `minScore` is the floor above the band, and it exists because a band is a
// wide bucket: one witnessed violence row scores exactly 3.0 through Tone's
// lens, which is the Warm floor on the nose. Without it he would sign on after
// a single fight. With it he wants two or three, and paying a tax without
// argument genuinely sets the player back.
//
// Takes a resolved band and score rather than state: this file may require
// other src/data modules, never src/exposure and never game-core. The reducer
// resolves the ledger and passes the numbers in.
const RECRUITMENT_PROOF = {
  tone: { minBand: "WARM", minScore: 6 },
};

function recruitmentProofFor(crewId) {
  return RECRUITMENT_PROOF[crewId] || null;
}

// No entry means no gate, which is what makes this additive: giving Pherris a
// proof requirement later is a data edit, not a code change.
function recruitmentEligible(crewId, band, score) {
  const proof = RECRUITMENT_PROOF[crewId];
  if (!proof) return true;
  if ((Number(band) || 0) < BANDS[proof.minBand]) return false;
  if (proof.minScore != null && (Number(score) || 0) < proof.minScore) return false;
  return true;
}

// Tone's tier-2 condition on top of the universal loyalty 7 plus five days.
// Standing next to someone while it goes badly three times is the version of
// proof a promotion needs, and it is the one thing here that cannot be bought.
const TONE_TIER2_COMBAT_WINS = 3;

// v1.19: Pherris's tier-2 condition. Either shape of proof that the player is
// actually in the business she manages - a run of completed flips, or enough
// lifetime margin that the volume speaks for itself. OR rather than AND because
// a few large flips and many small ones are the same evidence to her.
const PHERRIS_TIER2_FLIPS = 5;
const PHERRIS_TIER2_PROFIT = 500;

// Deshawn's loyalty triggers (tier 1). The generic missed-wage bleed applies to
// every crew member and lives in the wage settlement; these are his.
const DESHAWN_LOYALTY_TRIGGERS = {
  deescalateUsed: 1,          // player lets him handle it
  violenceAfterDeescalate: -1, // violence within 2 days of a de-escalation
  betrayIntroducedContact: -3, // burning a name he vouched for
  honoredContactCommitment: 1, // following through with someone he connected
};

// How many days after a de-escalation a violent choice still reads as
// overriding his judgment.
const DESHAWN_VIOLENCE_WINDOW_DAYS = 2;

// MADE MEN AND GUARDS: how this file's tiers meet the soldiers that already
// exist.
//
// An earlier draft of this comment proposed a per-leader squad
// (state.people.crew[id].soldiers = { count, type, morale, combatRating }) with
// its own battle math. That schema is dead and must not be built: game-core
// already owns a soldier system, and a second one would double-count every
// headcount, wage, and territory payout.
//
// What actually exists today:
//   state.world.soldiers      individual records, { id, status, blockId }.
//                             Anonymous - an id and a posting, nothing else.
//   state.world.territoryBlocks[*].soldiersAssigned
//                             which soldiers hold which block, capped at 3.
//   Eli as Operations Lieutenant  the gate on the whole system (loyalty 8),
//                             plus the standing-order policy that redistributes
//                             them nightly in resolveSoldierOperations.
//
// So the two populations are already separate, and the reconciliation is about
// naming them, not merging them:
//
//   MADE MEN are the named crew in this file - Eli, Pherris, Tone, Deshawn.
//   They carry loyalty, a tier, a wage, presence effects, and story. A tier is
//   scope of responsibility, NOT a headcount: tier 2 does not grant soldiers,
//   it grants what that person can be trusted to handle alone. That is why
//   TIER_WAGES prices the person and not an implied squad.
//
//   GUARDS are the world.soldiers records. They are recruited through Eli
//   against a capacity of 2 + 2 per controlled block, posted to blocks, and
//   lost to raids and attrition. They belong to the ORGANIZATION, never to a
//   leader, which is what keeps their income and losses in one resolution pass.
//
// The open work is the seam between them, and it is small:
//   - a Made Man at tier 2+ could become a block's managerId (the field exists
//     on every territoryBlock record and is currently only cleared, never set
//     by a tier gate), giving that block a named face and a reason to care.
//   - domain flavor belongs on the manager, not on a soldier type: Tone's block
//     resists raids, Pherris's reads the market, Deshawn's cools heat. Guards
//     stay identical to each other on purpose - the moment a guard has a type,
//     it wants a name, and then it is a character with no story.
//
// Problems escalate, not tasks. Whatever ships here, the player should be
// intervening on escalations rather than assigning work:
//   "Tone's guy got arrested. Bail him ($200) or let it ride?"
//   "One of Pherris's runners is skimming. Confront or let Pherris handle it?"

module.exports = {
  CREW_LOYALTY_MIN,
  CREW_LOYALTY_MAX,
  CREW_LOYALTY_START,
  CREW_WAGE_GRACE_DAYS,
  TIER_WAGES,
  TIER_REQUIREMENTS,
  CURTIS_CREW_ENCOUNTER_IDS,
  COMBAT_ADVANTAGE_CAP,
  RECRUITMENT_PROOF,
  TONE_TIER2_COMBAT_WINS,
  PHERRIS_TIER2_FLIPS,
  PHERRIS_TIER2_PROFIT,
  recruitmentProofFor,
  recruitmentEligible,
  combatAdvantageFor,
  combatAdvantageCrewIds,
  deEscalateCrewIds,
  deEscalateAvailable,
  INTEL_ADVANTAGE_CAP,
  intelAdvantageFor,
  intelAdvantageCrewIds,
  PRESENCE_EFFECTS,
  DESHAWN_LOYALTY_TRIGGERS,
  DESHAWN_VIOLENCE_WINDOW_DAYS,
  wageFor,
  tierRequirementMet,
  clampLoyalty,
  getActiveCrew,
  presenceEffectsFor,
};
