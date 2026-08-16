// Arrest & jail constants and pure helpers (v1.16).
//
// Data-module contract: this file may require other src/data modules but never
// game-core.js. Every number the arrest system reads lives here; the reducer
// side (arrestPlayer, BAIL_CREW, the crew release tick) lives in game-core.
//
// The design in one line: arrest is not only punishment, it RESOLVES street
// heat and replaces it with a permanent record. You come out cooler but
// marked, and the next one costs more. Without that release valve, an arrest
// is pure loss and reads as a bad roll rather than a system.

// Severity ids. `source` says which track produced the arrest; `severity` says
// what it was worth. Keep the two separate — a boost caught by an encounter is
// still boost-severity.
const SEVERITIES = ["boost1", "boost2", "stick1", "stick2", "stick3", "encounter"];

// Bail scales with what you were caught doing. Tier 1 boosting is a shoplifting
// misdemeanor; a tier 3 stick is organized robbery and priced like it.
const BAIL_BY_SEVERITY = {
  boost1: 150,
  boost2: 250,
  stick1: 350,
  stick2: 600,
  stick3: 1000,
  encounter: 300,
};

// Every prior raises the price. Indexed by prior count (arrests already on the
// record BEFORE this one); anything past the table uses the last entry, so a
// player who keeps getting caught tops out rather than spiralling to infinity.
const PRIOR_MULTIPLIER = [1, 1.5, 2, 2.75, 3.5];

// Base clock a booking eats, by severity, in parts of day. Priors lengthen
// processing too — the system already has your name, and pulling the file
// takes longer than writing it.
const PROCESSING_SLOTS = {
  boost1: 1,
  boost2: 1,
  stick1: 2,
  stick2: 2,
  stick3: 3,
  encounter: 2,
};

// One extra part of day per this many priors, on top of the base.
const PRIORS_PER_EXTRA_SLOT = 2;

// The clock cannot eat more than a whole day. Four parts of day is the run's
// slot count; kept as its own constant so a call site never has to import
// SLOTS from game-core to know the ceiling.
const MAX_PROCESSING_SLOTS = 4;

// The release valve. Heat cleared has to cost what it clears, or a cheap
// offense becomes a heat-dump exploit: get caught boosting a $40 target,
// walk out at heat 3. A stickup player at heat 12 caught on a tier 1 job
// only drops to 9 — still in the warning zone.
const HEAT_RELIEF = {
  boost1: 2,
  boost2: 2,
  stick1: 3,
  stick2: 4,
  stick3: 5,
  encounter: 3,
};

// A player who cannot pay is never soft-locked: the shortfall becomes time.
// Every this-many dollars of unpaid bail buys one more part of day inside,
// bounded by MAX_PROCESSING_SLOTS like everything else.
const SHORTFALL_PER_SLOT = 150;

// What it costs to bail a crew member out, by the severity of the job that put
// them inside. Cheaper than the player's own bail at the same severity — you
// are buying one person out, not settling your own file.
const CREW_BAIL_COST = {
  boost1: 200,
  boost2: 300,
  stick1: 400,
  stick2: 650,
  stick3: 900,
  encounter: 350,
};

// How long a crew member sits if nobody comes for them.
const CREW_JAIL_DAYS = {
  boost1: 1,
  boost2: 1,
  stick1: 2,
  stick2: 3,
  stick3: 5,
  encounter: 2,
};

// Bailing them out before their date restores them at -1 loyalty (the arrest
// shook them, but you showed up). Serving the whole stretch drops them to
// LOYALTY_AFTER_SERVED — one missed wage from walking.
const CREW_BAIL_LOYALTY_COST = 1;
const CREW_LOYALTY_AFTER_SERVED = 1;

function severityKey(severity) {
  return SEVERITIES.includes(severity) ? severity : "encounter";
}

function priorMultiplier(priors) {
  const count = Math.max(0, Math.floor(Number(priors) || 0));
  return PRIOR_MULTIPLIER[Math.min(count, PRIOR_MULTIPLIER.length - 1)];
}

// Bail for this arrest. `priors` is the count already on the record, so the
// first arrest of a run pays the base price.
function bailFor(severity, priors) {
  const base = BAIL_BY_SEVERITY[severityKey(severity)];
  return Math.round(base * priorMultiplier(priors) / 5) * 5;
}

function processingSlotsFor(severity, priors) {
  const base = PROCESSING_SLOTS[severityKey(severity)];
  const count = Math.max(0, Math.floor(Number(priors) || 0));
  const extra = Math.floor(count / PRIORS_PER_EXTRA_SLOT);
  return Math.min(MAX_PROCESSING_SLOTS, base + extra);
}

// Unpaid bail, converted to time. Returns whole parts of day, never negative.
function shortfallSlots(shortfall) {
  const owed = Math.max(0, Math.round(Number(shortfall) || 0));
  if (!owed) return 0;
  return Math.ceil(owed / SHORTFALL_PER_SLOT);
}

function heatReliefFor(severity) {
  return HEAT_RELIEF[severityKey(severity)];
}

function crewBailFor(severity) {
  return CREW_BAIL_COST[severityKey(severity)];
}

function crewJailDaysFor(severity) {
  return CREW_JAIL_DAYS[severityKey(severity)];
}

// --- Copy banks -------------------------------------------------------------
// Picked with a hash at the call site, never off run.rngState, so a replayed
// day reads the same way.

const BOOKING_LINES = {
  boost: [
    "The cuffs go on in the stockroom, past the swinging doors where the cameras stop.",
    "Loss prevention holds you until the cruiser gets there. Nobody raises their voice.",
    "They walk you out the front, past the register line, which is the part they wanted.",
  ],
  stick: [
    "The second set of hands on you has a badge. The wall is cold and the questions are patient.",
    "You get maybe a block before the headlights swing wide across the lot.",
    "Somebody called it in fast. Processing takes the rest of what was left of the day.",
  ],
  encounter: [
    "The lot fills with light and everybody's hands go where they are told.",
    "One radio call turns the whole block into a scene with your name in the middle of it.",
    "You are the one still standing there when they arrive, which is the whole problem.",
    "Plastic bench. Fluorescent hum. They already know your name.",
  ],
};

const RELEASE_LINES = {
  paid: [
    "Bail clears and the desk gives your pockets back a bag at a time.",
    "You sign your own name three times and walk out into the wrong part of the day.",
    "The money leaves, the file stays, and the street outside is suddenly quiet about you.",
  ],
  served: [
    "No money for bail. You're here until they're done with you.",
    "You sit it out on a bench under a light that never changes, and the day goes with it.",
    "Nobody comes, nothing gets paid, and the hours take what the cash could not.",
    "Forty-three hours and a headache. Spenard looks different at 6 AM.",
  ],
};

// What the release valve feels like from the inside. Shown when heat actually
// dropped, so the player learns the mechanic without a tooltip.
const HEAT_RELIEF_LINES = [
  "Whatever the block thought it knew about you got filed and closed. The watching thins out.",
  "The block goes cold on you the moment you become paperwork. That trade is not free.",
  "You are less interesting outside now, and permanently more interesting on paper.",
];

const CREW_BOOKED_LINES = [
  "%s gets caught. Bail is now your problem.",
  "They take %s out the back. Nobody says your name, which is the only good news.",
  "%s goes in the car. The rest of the ring scatters and the take stays behind.",
];

const CREW_BAIL_LINES = [
  "%s comes out squinting, skips the thank you, and shows up the next morning anyway.",
  "You put the money down for %s. The debt between you moved, and both of you know it.",
  "%s walks out to find you already waiting. That gets remembered longer than the cell.",
];

const CREW_SERVED_LINES = [
  "%s walks out on their own date. Nobody was waiting. They remember that part.",
  "%s does the whole stretch and comes back thinner and quieter. Whatever you two had, the cell kept it.",
  "%s gets released with nobody there. They come back to work, but only barely.",
];

function pickLine(bank, hash) {
  const pool = Array.isArray(bank) ? bank : [];
  if (!pool.length) return "";
  return pool[Math.abs(Math.floor(Number(hash) || 0)) % pool.length];
}

module.exports = {
  SEVERITIES,
  BAIL_BY_SEVERITY,
  PRIOR_MULTIPLIER,
  PROCESSING_SLOTS,
  PRIORS_PER_EXTRA_SLOT,
  MAX_PROCESSING_SLOTS,
  HEAT_RELIEF,
  SHORTFALL_PER_SLOT,
  CREW_BAIL_COST,
  CREW_JAIL_DAYS,
  CREW_BAIL_LOYALTY_COST,
  CREW_LOYALTY_AFTER_SERVED,
  BOOKING_LINES,
  RELEASE_LINES,
  HEAT_RELIEF_LINES,
  CREW_BOOKED_LINES,
  CREW_BAIL_LINES,
  CREW_SERVED_LINES,
  severityKey,
  priorMultiplier,
  bailFor,
  processingSlotsFor,
  shortfallSlots,
  heatReliefFor,
  crewBailFor,
  crewJailDaysFor,
  pickLine,
};
