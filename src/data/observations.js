// Typed observations are the only thing an NPC ever knows about the player.
//
// A category says WHAT KIND of thing was seen. The event and location are the
// context that makes two observations of the same category distinct: "seen at
// the Night Owl" and "seen at home" are both presence, and they accumulate
// separately. Same category plus same context increments a count instead of
// appending a row, so a seven-day run cannot grow an unbounded ledger.
//
// Nothing here reads or writes game state. The engine in src/exposure/ turns a
// ledger into a score; this file only defines what may go into one.

const OBSERVATION_CATEGORIES = [
  "presence",
  "honesty",
  "violence",
  "financial",
  "heat_exposure",
  "loyalty",
  "betrayal",
  "discretion",
  "growth",
  "submission",
  "defiance",
];

const OBSERVATION_CATEGORY_SET = new Set(OBSERVATION_CATEGORIES);

// Where an NPC got this. The lens may weight a source differently: Mina counts
// what her network tells her twice as heavily as what she sees on her own.
const OBSERVATION_SOURCES = ["witnessed", "told", "household", "neighborhood", "network", "reputation"];
const OBSERVATION_SOURCE_SET = new Set(OBSERVATION_SOURCES);

// One ledger cannot exceed this many distinct rows. The key space is already
// bounded by category x event x location, so this is a guard against a future
// caller inventing unique context strings in a loop, not an expected path.
const MAX_LEDGER_ROWS = 120;

// An obligation that was promised and then missed is the one thing that gets
// worse the more it happens. Named here so the weighting rule and the callers
// that raise it cannot drift apart.
const ESCALATING_EVENT = "missed_obligation";

function normalizeCategory(type) {
  return OBSERVATION_CATEGORY_SET.has(type) ? type : null;
}

function createObservation({ type, event = null, location = null, value = null, day = 1, source = "witnessed", count = 1 } = {}) {
  const category = normalizeCategory(type);
  if (!category) return null;
  return {
    type: category,
    event: event == null ? null : String(event),
    location: location == null ? null : String(location),
    value: value == null ? null : Number(value) || 0,
    day: Math.max(1, Math.floor(Number(day) || 1)),
    count: Math.max(1, Math.floor(Number(count) || 1)),
    source: OBSERVATION_SOURCE_SET.has(source) ? source : "witnessed",
  };
}

// Two observations merge when they are the same kind of thing seen the same way
// in the same place. Source is part of the key on purpose: hearing about a
// robbery from the network is a different fact than watching one happen.
function observationKey(observation) {
  return [observation.type, observation.event || "", observation.location || "", observation.source].join("|");
}

// Returns the row that now holds this observation, or null if it was rejected.
// The stored day is the most recent sighting, which is what recency reads want.
function addObservation(ledger, observation) {
  if (!Array.isArray(ledger) || !observation) return null;
  const key = observationKey(observation);
  const existing = ledger.find((row) => observationKey(row) === key);
  if (existing) {
    existing.count += observation.count;
    existing.day = Math.max(existing.day, observation.day);
    if (observation.value != null) existing.value = observation.value;
    return existing;
  }
  if (ledger.length >= MAX_LEDGER_ROWS) return null;
  ledger.push(observation);
  return observation;
}

// The ceiling on how much any one repeated behavior can ever be worth.
//
// log2 alone is not enough to stop grinding, because log2 has no upper bound:
// visiting the Night Owl four hundred times still climbs, just slowly, and a
// patient player reaches the top band by doing one thing forever. The curve is
// therefore clamped. Four is log2(16), so repetitions past about fifteen add
// nothing, which is what "eight or more is ambient" means in practice.
//
// At this ceiling the heaviest presence weight in the cast tops out inside
// Trusted, so showing up can make someone trust you and cannot by itself make
// them Bonded. Closeness has to come from more than one kind of evidence.
const MAX_EFFECTIVE_COUNT = 4;

// How much a repeated observation still counts for.
//
// The default is logarithmic: the first three repetitions carry the weight, and
// by eight the behavior is ambient and barely moves the number.
//
// Two rules opt out, and they are not the same rule wearing two hats:
//   betrayal          never fades. Every instance lands at full weight forever.
//   missed_obligation escalates. Weight is negative, so linear growth means
//                     each additional miss hurts more than the last.
// Neither is clamped: the point of both is that they keep mattering.
function effectiveCount(observation) {
  const count = Math.max(1, Number(observation.count) || 1);
  if (observation.type === "betrayal") return count;
  if (observation.event === ESCALATING_EVENT) return count;
  return Math.min(MAX_EFFECTIVE_COUNT, Math.log2(count + 1));
}

module.exports = {
  OBSERVATION_CATEGORIES,
  OBSERVATION_CATEGORY_SET,
  OBSERVATION_SOURCES,
  MAX_LEDGER_ROWS,
  ESCALATING_EVENT,
  createObservation,
  observationKey,
  addObservation,
  effectiveCount,
};
