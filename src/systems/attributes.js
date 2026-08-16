// The attribute system: resolution, growth, identity, and pacing.
//
// IMPORTANT: this module may require src/data/*, src/selectors.js,
// src/events/random.js, and src/exposure/engine.js, and nothing else. It must
// never require game-core.js. Everything here is pure - it reads state and
// returns values, it does not mutate and it does not log. The reducer in
// game-core.js owns every write, including the observation broadcasts that
// follow a resolved outcome.

const {
  ATTRIBUTE_IDS,
  ATTRIBUTE_DEFAULTS,
  ATTRIBUTE_MIN,
  ATTRIBUTE_MAX,
  ATTRIBUTE_LABEL_TIERS,
  ADVANTAGE_THRESHOLD,
  CATASTROPHE_IMMUNITY_THRESHOLD,
  GROWTH_RATES,
  GROWTH_CAP_PENALTY_FLOOR,
  GROWTH_CAP_PENALTY,
  GYM_ACTIVITY_BY_ID,
  GYM_STREAK_REQUIREMENT,
  GYM_STREAK_BONUS,
  NILE_STREAK_REQUIREMENT,
  NILE_STREAK_BONUS,
  GROWTH_ATTRIBUTES,
  IDENTITY_BEHAVIOR_COLUMNS,
  IDENTITY_BALANCE_MARGIN,
  IDENTITY_RECENT_DAYS,
  IDENTITY_MATRIX,
  IDENTITY_DESCRIPTIONS,
  OUTCOME_VALUES,
  OUTCOME_SHAPES,
  ACTION_ATTRIBUTE_MAP,
  STANDING_PACING,
} = require("../data/attributes.js");
const { seededPick } = require("../events/random.js");
const { EXPOSURE_NPC_IDS } = require("../data/npc-lenses.js");
const { ledgerOf } = require("../exposure/engine.js");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Reading attributes
// ---------------------------------------------------------------------------

function normalizedAttributes(state) {
  const stored = (state && state.player && state.player.attributes) || {};
  const out = {};
  for (const id of ATTRIBUTE_IDS) {
    const value = Number(stored[id]);
    out[id] = clamp(Number.isFinite(value) ? Math.floor(value) : ATTRIBUTE_DEFAULTS[id], ATTRIBUTE_MIN, ATTRIBUTE_MAX);
  }
  return out;
}

function attributeValue(state, attribute) {
  return normalizedAttributes(state)[attribute] ?? ATTRIBUTE_MIN;
}

// The compatibility scale.
//
// Formulas written before v1.10 were tuned against attributes that ran 1-5 and
// started at 2. The new attributes run 0-8 and start at 1, so reading them
// directly would quietly dock every one of those formulas a point on Day 1 -
// worth about 40% of the run economy when it was measured. The offset maps the
// new baseline onto the old one: attribute 1 is the old default of 2, and the
// old ceiling of 5 still caps it.
//
// Anything routed through resolveWithAttribute reads the raw value instead and
// carries no inline term at all. This is only for the formulas that were never
// converted.
function compatibilityRating(state, attribute) {
  return clamp(attributeValue(state, attribute) + 1, 1, 5);
}

// Players see this, never the number.
function attributeLabel(value) {
  const numeric = Number(value) || 0;
  const tier = ATTRIBUTE_LABEL_TIERS.find((entry) => numeric >= entry.floor);
  return tier ? tier.label : ATTRIBUTE_LABEL_TIERS[ATTRIBUTE_LABEL_TIERS.length - 1].label;
}

// Three consecutive gym days are worth one effective level on the next check
// that reads this attribute. The caller clears the streak when it spends it.
function gymStreakBonus(state, attribute) {
  if (attribute !== "combat") return 0;
  const streak = Number(state && state.player && state.player.gymStreak) || 0;
  return streak >= GYM_STREAK_REQUIREMENT ? GYM_STREAK_BONUS : 0;
}

// The Nile's streak works the same way and pays out to whichever attribute the
// player trained most recently there - the building teaches two things, so the
// streak has to know which one it earned.
function nileStreakBonus(state, attribute) {
  const player = (state && state.player) || {};
  if (attribute !== player.nileStreakAttribute) return 0;
  const streak = Number(player.nileStreak) || 0;
  return streak >= NILE_STREAK_REQUIREMENT ? NILE_STREAK_BONUS : 0;
}

// Both streaks are readable at once but can never stack, because they never
// address the same attribute: the gym only trains Combat and The Nile only
// trains Charisma and Intelligence. Summing is still the honest expression -
// if a third venue ever trains Combat, this keeps working without an edit.
function streakBonus(state, attribute) {
  return gymStreakBonus(state, attribute) + nileStreakBonus(state, attribute);
}

function effectiveAttribute(state, attribute) {
  return clamp(attributeValue(state, attribute) + streakBonus(state, attribute), ATTRIBUTE_MIN, ATTRIBUTE_MAX);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

// Turn a context-sensitive success chance into a tiered pool.
//
// Every wired roll already computes its chance from heat, gear, health,
// disposition, and district. Splitting that chance across the tiers keeps all of
// it and adds quality on top; a flat weighted table would have thrown it away.
function buildOutcomePool(actionType, chance) {
  const shape = OUTCOME_SHAPES[actionType];
  if (!shape) return [];
  const success = clamp(Number(chance) || 0, 0, 1);
  const pool = [];
  for (const [tier, share] of Object.entries(shape.success || {})) {
    pool.push({ tier, value: OUTCOME_VALUES[tier], weight: success * share });
  }
  for (const [tier, share] of Object.entries(shape.failure || {})) {
    pool.push({ tier, value: OUTCOME_VALUES[tier], weight: (1 - success) * share });
  }
  return pool;
}

// The one entry point for an attribute-modified roll. Tabletop advantage rather
// than a percentage bonus: being good does not shift a number the player cannot
// see, it gives them a second look and eventually takes the worst thing off the
// table entirely.
//
// Keyed on a string and hashed, never drawn from run.rngState, so replaying the
// same day resolves the same way regardless of what else happened first.
function resolveWithAttribute(outcomePool, attributeValue, seed) {
  let pool = Array.isArray(outcomePool) ? outcomePool.slice() : [];
  if (!pool.length) return null;
  const value = Number(attributeValue) || 0;
  if (value >= CATASTROPHE_IMMUNITY_THRESHOLD) {
    const survivors = pool.filter((outcome) => outcome.tier !== "catastrophic");
    if (survivors.length) pool = survivors;
  }
  const first = seededPick(pool, `${seed}`);
  if (value < ADVANTAGE_THRESHOLD) return first;
  const second = seededPick(pool, `${seed}:adv`);
  if (!first) return second;
  if (!second) return first;
  return (Number(first.value) || 0) >= (Number(second.value) || 0) ? first : second;
}

// Convenience wrapper for the common shape: an action id, a computed chance, and
// a state to read the attribute from.
//
// `bonus` (v1.18) is an effective-level modifier from something outside the
// player - crew standing next to them, for now. It is re-clamped to the same
// ceiling the attribute itself lives under, so backup can push a Combat 5 up to
// the catastrophe-immunity line but can never push anyone past the top tier.
// Omitting it resolves exactly as before, which is what keeps every call site
// that has no backup byte-identical.
//
// Deliberately a level and not a chance bump: ADVANTAGE_THRESHOLD is 3 and
// CATASTROPHE_IMMUNITY_THRESHOLD is 6, so a single level is invisible at 0-1 and
// 3-4 and decisive at 2 and 5. That is what a big guy standing next to you
// actually does - it does not make you better at fighting, it takes the worst
// ending off the table.
function resolveAction(state, actionType, chance, seed, bonus) {
  const attribute = ACTION_ATTRIBUTE_MAP[actionType];
  const pool = buildOutcomePool(actionType, chance);
  const level = clamp(effectiveAttribute(state, attribute) + (Number(bonus) || 0), ATTRIBUTE_MIN, ATTRIBUTE_MAX);
  const outcome = resolveWithAttribute(pool, level, seed);
  return outcome || { tier: "failure", value: OUTCOME_VALUES.failure };
}

function isSuccessTier(tier) {
  return tier === "clean" || tier === "messy";
}

// ---------------------------------------------------------------------------
// Growth
// ---------------------------------------------------------------------------

// Same log2 shape as the Exposure System's observation capping, for the same
// reason: sessions one through three move the needle, four through seven taper,
// and past that the gym alone cannot carry you. Getting good enough to be
// Dangerous takes confrontations, not another hour on the bag.
function attributeGrowth(currentValue, sessionCount, activity) {
  const baseGrowth = GROWTH_RATES[activity];
  if (!baseGrowth) return 0;
  const sessions = Math.max(0, Math.floor(Number(sessionCount) || 0));
  const diminishing = 1 / Math.log2(sessions + 2);
  const capPenalty = (Number(currentValue) || 0) >= GROWTH_CAP_PENALTY_FLOOR ? GROWTH_CAP_PENALTY : 1;
  return baseGrowth * diminishing * capPenalty;
}

// Which attribute a growth source feeds. Null for an unknown id, so a typo at a
// call site fails visibly instead of quietly training nothing.
function growthAttribute(activity) {
  return GROWTH_ATTRIBUTES[activity] || null;
}

// The whole growth read for one source in one call: what it trains, and how much
// this particular session is worth given the player's current value and how many
// times they have done it before. The reducer owns the write.
function growthFor(state, activity, sessionCount) {
  const attribute = growthAttribute(activity);
  if (!attribute) return null;
  const current = normalizedAttributes(state)[attribute];
  return { attribute, growth: attributeGrowth(current, sessionCount, activity) };
}

function gymActivityAvailable(state, activityId) {
  const activity = GYM_ACTIVITY_BY_ID[activityId];
  if (!activity) return false;
  if (!activity.requires) return true;
  return attributeValue(state, activity.requires.attribute) >= activity.requires.value;
}

// ---------------------------------------------------------------------------
// Street Identity
// ---------------------------------------------------------------------------

// Every observation any NPC is carrying from the last `days` days. Rows keep
// their most recent sighting in `row.day` (addObservation maxes it), which is
// exactly what a recency read wants.
function getRecentObservations(state, days) {
  const today = Number(state && state.run && state.run.day) || 1;
  const window = Math.max(1, Number(days) || IDENTITY_RECENT_DAYS);
  const floor = today - window + 1;
  const out = [];
  for (const npcId of EXPOSURE_NPC_IDS) {
    for (const row of ledgerOf(state, npcId)) {
      if ((Number(row.day) || 0) >= floor) out.push(row);
    }
  }
  return out;
}

function getDominantAttribute(combat, charisma, intelligence) {
  const ranked = [
    ["combat", Number(combat) || 0],
    ["charisma", Number(charisma) || 0],
    ["intelligence", Number(intelligence) || 0],
  ].sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  return first[1] - second[1] > IDENTITY_BALANCE_MARGIN ? first[0] : "balanced";
}

function getDominantCategory(observations) {
  const totals = {};
  for (const row of observations || []) {
    const column = IDENTITY_BEHAVIOR_COLUMNS[row && row.type];
    if (!column) continue;
    totals[column] = (totals[column] || 0) + Math.max(1, Number(row.count) || 1);
  }
  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return "default";
  // A tie is not a signal. Fall back to the dominant attribute's default label.
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return "default";
  return ranked[0][0];
}

// Pure. Same state in, same label out, and it never writes anything - which is
// the entire point of retiring the nightly assignment loop it replaced.
function getStreetIdentity(state) {
  const { combat, charisma, intelligence } = normalizedAttributes(state);
  const recentObs = getRecentObservations(state, IDENTITY_RECENT_DAYS);
  const dominant = getDominantAttribute(combat, charisma, intelligence);
  const recentBehavior = getDominantCategory(recentObs);
  const row = IDENTITY_MATRIX[dominant] || IDENTITY_MATRIX.balanced;
  return row[recentBehavior] || row.default;
}

// The label plus the two reads behind it, for callers that want to vary copy by
// what kind of person you are rather than by the exact name for it.
function identityProfile(state) {
  const { combat, charisma, intelligence } = normalizedAttributes(state);
  const dominant = getDominantAttribute(combat, charisma, intelligence);
  const behavior = getDominantCategory(getRecentObservations(state, IDENTITY_RECENT_DAYS));
  const row = IDENTITY_MATRIX[dominant] || IDENTITY_MATRIX.balanced;
  const label = row[behavior] || row.default;
  return { dominant, behavior, label, description: IDENTITY_DESCRIPTIONS[label] || IDENTITY_DESCRIPTIONS["New Face"] };
}

function describeStreetIdentity(state) {
  const { label, description } = identityProfile(state);
  return { label, description };
}

// ---------------------------------------------------------------------------
// Standing pacing
// ---------------------------------------------------------------------------

// A soft brake, not a cap. The first few points of standing arrive at full rate;
// after that the same favors buy less, so nobody is maxed out with the week
// still ahead of them.
function adjustedStandingGain(currentStanding, rawGain, ladder = "capped") {
  const gain = Number(rawGain) || 0;
  if (gain <= 0) return gain;
  const standing = Number(currentStanding) || 0;
  const rungs = STANDING_PACING[ladder] || STANDING_PACING.capped;
  for (const rung of rungs) {
    if (standing >= rung.floor) return gain * rung.multiplier;
  }
  return gain;
}

// Standings that must stay integers bank the braked gain in a hidden
// accumulator on the record and pay out whole points, the same way attribute
// growth does.
//
// Deliberately not a probability roll. Plug standing four opens Tasha's
// introduction and dealer standing three opens two story cards, so a coin flip
// here would make content gating non-deterministic - the one thing the seeded
// simulator exists to rule out. A braked gain means the next point takes two
// qualifying days instead of one, which is pacing the player can feel and a
// replay can reproduce.
function bankStandingGain(record, currentStanding, rawGain, ladder = "capped") {
  if (!record || typeof record !== "object") return Math.round(Number(rawGain) || 0);
  const adjusted = adjustedStandingGain(currentStanding, rawGain, ladder);
  const banked = (Number(record.standingProgress) || 0) + adjusted;
  const whole = Math.floor(banked);
  record.standingProgress = banked - whole;
  return whole;
}

module.exports = {
  normalizedAttributes,
  attributeValue,
  compatibilityRating,
  attributeLabel,
  effectiveAttribute,
  gymStreakBonus,
  nileStreakBonus,
  streakBonus,
  growthAttribute,
  growthFor,
  buildOutcomePool,
  resolveWithAttribute,
  resolveAction,
  isSuccessTier,
  attributeGrowth,
  gymActivityAvailable,
  getRecentObservations,
  getDominantAttribute,
  getDominantCategory,
  getStreetIdentity,
  identityProfile,
  describeStreetIdentity,
  adjustedStandingGain,
  bankStandingGain,
};
