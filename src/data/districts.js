// v1.13 — the criminal-economy geography layer. Every criminal track reads the
// same two numbers per district: a difficulty nudge and a heat multiplier.
// Difficulty is expressed in this codebase's native unit — a delta on the 0-1
// success chance (one "difficulty point" from the design docs = 0.08 of
// chance) — because resolution here is pool-based, not roll-vs-DC.
//
// Only three districts are navigable today. fairview and mountain_view are
// scaffolded so the data shape is final before those districts ship; nothing
// references them at runtime until they join NEIGHBORHOODS.
const DISTRICT_DIFF_STEP = 0.08;

const DISTRICT_MODS = {
  // Spenard. Home turf: the market runs quieter and easier, but a stickup on
  // your own block is harder to keep anonymous and travels fast.
  north_star_lot: {
    market: { diffMod: -1, heatMod: 0.8 },
    boost: { diffMod: 0, heatMod: 0.9 },
    stick: { diffMod: 1, heatMod: 1.3 },
  },
  // Downtown. Cameras and police presence price the market up; crowds make
  // lifting easier and give a robber somewhere to vanish.
  downtown: {
    market: { diffMod: 1, heatMod: 1.2 },
    boost: { diffMod: -1, heatMod: 1.1 },
    stick: { diffMod: -1, heatMod: 1.0 },
  },
  // Industrial Service Roads. Isolated targets, secured freight: robbery is
  // easier to attempt and hotter when it lands; boosting fights fences and
  // dock security.
  airport_industrial: {
    market: { diffMod: 0, heatMod: 1.1 },
    boost: { diffMod: 1, heatMod: 1.2 },
    stick: { diffMod: -1, heatMod: 1.2 },
  },
  // Scaffold only — not navigable yet.
  fairview: {
    market: { diffMod: 0, heatMod: 1.0 },
    boost: { diffMod: 0, heatMod: 1.0 },
    stick: { diffMod: 0, heatMod: 1.0 },
  },
  mountain_view: {
    market: { diffMod: 0, heatMod: 1.0 },
    boost: { diffMod: 1, heatMod: 1.2 },
    stick: { diffMod: 1, heatMod: 1.5 },
  },
};

// Word travels along this graph: criminal awareness in one district bleeds to
// its neighbors a day later at half strength. There was no adjacency notion
// before this file — travel is flat any-to-any — so this graph exists only
// for the awareness/bleed system.
const DISTRICT_ADJACENCY = {
  north_star_lot: ["downtown", "airport_industrial"],
  downtown: ["north_star_lot", "fairview"],
  airport_industrial: ["north_star_lot"],
  fairview: ["downtown", "mountain_view"],
  mountain_view: ["fairview"],
};

// Stick (robbery) targets. Tier 1 is street work — people, not places — gated
// by time slot where the victim pool only exists at certain hours. Tier 2 is
// named registers behind a weapon gate (Goodie, the walking Tier 2 target,
// stays on his existing ROB_DEALER mechanic and feeds the same track). Tier 3
// is organized work behind rep, a weapon, and planning.
//   take: [min,max] cash. resistance: 0-1 chance penalty steps (like diffMod).
//   slots: allowed slot indices (absent = any). heat: base heat before the
//   district multiplier. retaliation: chance the victim's people come looking.
const STICK_TARGETS = [
  { id: "chilkoots_stumbler", name: "Chilkoot's stumbler", areaId: "north_star_lot", tier: 1, take: [40, 80], slots: [3], resistance: 0, heat: 2, retaliation: 0 },
  { id: "washgo_regular", name: "Wash & Go regular", areaId: "north_star_lot", tier: 1, take: [30, 50], resistance: 0, heat: 2, retaliation: 0 },
  { id: "fourth_ave_crawler", name: "Fourth Avenue bar crawler", areaId: "downtown", tier: 1, take: [50, 100], slots: [2, 3], resistance: 0, heat: 2, retaliation: 0 },
  { id: "c_street_atm", name: "C Street ATM run", areaId: "downtown", tier: 1, take: [60, 100], slots: [2], resistance: 1, heat: 2, retaliation: 0 },
  { id: "lot_hauler", name: "Long-haul driver at the truck lot", areaId: "airport_industrial", tier: 1, take: [40, 90], slots: [0, 1], resistance: 0, heat: 2, retaliation: 0 },
  { id: "spenard_fuel_till", name: "Spenard Fuel night till", areaId: "north_star_lot", tier: 2, take: [100, 180], slots: [3], resistance: 1, heat: 3, retaliation: 0.6 },
  { id: "downtown_fuel_till", name: "Downtown Fuel register", areaId: "downtown", tier: 2, take: [100, 200], resistance: 1, heat: 3, retaliation: 0.6 },
  { id: "goodie_stash", name: "Goodie's stash spot", areaId: "north_star_lot", tier: 3, take: [800, 1500], resistance: 3, heat: 4, retaliation: 0.6 },
  { id: "rec_center_dice", name: "Dice game behind the rec center", areaId: "north_star_lot", tier: 3, take: [500, 1200], slots: [2, 3], resistance: 2, heat: 4, retaliation: 0.6 },
];
const STICK_TARGET_BY_ID = Object.fromEntries(STICK_TARGETS.map((target) => [target.id, target]));

// Tier thresholds for the Stick track, mirroring the Boost ladder's shape.
const STICK_TIER_2_REP = 4;
const STICK_TIER_3_REP = 10;
const STICK_DAILY_CAP = 2;

// Plug home turf. Robbing anyone on a plug's block makes that plug wary of
// you; suspicion has teeth at these thresholds.
const PLUG_HOME_DISTRICTS = { goodie: "north_star_lot", tasha: "downtown", malik: "airport_industrial" };
const PLUG_SUSPICION_PRICE_THRESHOLD = 3; // +10% buy price
const PLUG_SUSPICION_CUTOFF = 5; // stops selling entirely
const PLUG_SUSPICION_PRICE_PENALTY = 0.10;
// Rebuild: a clean purchase (no robbery in their district that day) works
// suspicion back down one point.

// Every 3 points of track awareness in a district = one difficulty step for
// that track there. Awareness bleeds to adjacent districts at half strength,
// arriving the next day.
const AWARENESS_DIFF_DIVISOR = 3;
const AWARENESS_BLEED_FACTOR = 0.5;

module.exports = {
  DISTRICT_DIFF_STEP,
  DISTRICT_MODS,
  DISTRICT_ADJACENCY,
  STICK_TARGETS,
  STICK_TARGET_BY_ID,
  STICK_TIER_2_REP,
  STICK_TIER_3_REP,
  STICK_DAILY_CAP,
  PLUG_HOME_DISTRICTS,
  PLUG_SUSPICION_PRICE_THRESHOLD,
  PLUG_SUSPICION_CUTOFF,
  PLUG_SUSPICION_PRICE_PENALTY,
  AWARENESS_DIFF_DIVISOR,
  AWARENESS_BLEED_FACTOR,
};
