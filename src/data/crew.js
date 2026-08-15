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
};

function wageFor(person, tier) {
  const curve = TIER_WAGES[person.id];
  if (!curve) return person.wage;
  return curve[Math.max(0, Math.min(curve.length - 1, (Number(tier) || 1) - 1))];
}

// Generic tier gates. Each crew member layers NPC-specific conditions on top
// (deshawn: truces brokered; pherris: cash; tone/pherris: controlled blocks) -
// those stay in crewTierAvailability in game-core. daysRecruited compares
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
};

function presenceEffectsFor(state, eventType, contextId) {
  const effects = [];
  for (const person of getActiveCrew(state)) {
    for (const effect of PRESENCE_EFFECTS[person.id] || []) {
      if (effect.eventType !== eventType) continue;
      if (contextId && effect.excludes.includes(contextId)) continue;
      effects.push({ crewId: person.id, ...effect });
    }
  }
  return effects;
}

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

// FUTURE: Soldier system (ships with the territory build).
// Each leader at Tier 2+ manages a squad of unnamed soldiers. Soldiers are
// numbers, not characters. Three types:
//   MUSCLE     - recruited by Tone, combat strength in battles
//   RUNNERS    - recruited by Pherris, info network + market coverage
//   CONNECTORS - recruited by Deshawn, community stability + heat reduction
//
// Schema shape (not active):
// state.people.crew[id].soldiers = {
//   count: 0,          // headcount
//   type: "muscle",    // matches leader's domain
//   morale: 100,       // 0-100, decays on missed wages or reckless orders
//   combatRating: 0,   // derived from count + leader tier + equipment
// }
//
// Territory battles resolve as:
//   attackStrength = soldiers.count * (1 + leader.tier * 0.3) * (morale / 100)
//   vs defenderStrength (same formula for the enemy org)
//   Player attributes modify: Combat boosts Tone's force, Charisma boosts
//   Deshawn's diplomacy path, Intelligence boosts Pherris's intel advantage.
//
// Wage scaling: the leader wage covers their whole operation (see TIER_WAGES -
// tier 1 is the leader alone, tier 2 is leader + 2-3 implied soldiers, tier 3
// is leader + 5-8 soldiers, a department).
//
// Problems escalate, not tasks. Leaders handle their domain automatically; the
// player intervenes only on escalation events:
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
  PRESENCE_EFFECTS,
  DESHAWN_LOYALTY_TRIGGERS,
  DESHAWN_VIOLENCE_WINDOW_DAYS,
  wageFor,
  tierRequirementMet,
  clampLoyalty,
  getActiveCrew,
  presenceEffectsFor,
};
