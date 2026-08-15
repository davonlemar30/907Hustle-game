// Attributes: the three numbers behind every outcome in the game.
//
// Until v1.10 the player carried six attributes (strength, endurance, reflexes,
// presence, insight, discipline) and three *derived* ratings computed from them.
// The six were half-dead - only the physical three could ever grow - and the
// derived ratings were the only thing anything actually read. v1.10 deletes the
// middle layer: the three ratings became the stored attributes.
//
// The six-to-three mapping, applied once in migrateSave, takes the highest value
// of each merged group so nobody loses progress:
//
//   combat       = max(strength, endurance, reflexes)   physical
//   charisma     = max(presence, discipline)            social
//   intelligence = max(insight, discipline)             mental
//
// Discipline lands in two groups on purpose - the retired charismaRating and
// intelligenceRating both weighted it at 0.30, so it was already doing double
// duty and dropping it from either side would be the lossy choice.
//
// This file is data. The logic that reads it lives in src/systems/attributes.js.

const ATTRIBUTE_IDS = ["combat", "charisma", "intelligence"];

const ATTRIBUTE_DEFAULTS = { combat: 1, charisma: 1, intelligence: 1 };

const ATTRIBUTE_MIN = 0;
// Not a design ceiling - "8+" is the top display tier and growth past it is
// possible in principle. This is the clamp that keeps a corrupt save from
// producing a 400-combat player.
const ATTRIBUTE_MAX = 12;

const ATTRIBUTES = [
  {
    id: "combat",
    label: "Combat",
    domain: "Violence",
    purpose: "Robbery, confrontation, escape, and every physical outcome.",
  },
  {
    id: "charisma",
    label: "Charisma",
    domain: "Social",
    purpose: "Being read well: interviews, tables, first impressions, a room at night.",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    domain: "Economic",
    purpose: "Appraisal, price certainty, planning, and knowing when not to be somewhere.",
  },
];

// Players never see the number. Checked highest floor first.
const ATTRIBUTE_LABEL_TIERS = [
  { floor: 8, label: "Elite" },
  { floor: 6, label: "Dangerous" },
  { floor: 4, label: "Solid" },
  { floor: 2, label: "Capable" },
  { floor: 0, label: "Green" },
];

// Advantage thresholds. Below COMPETENT it is one roll; at COMPETENT the pool is
// rolled twice and the better result taken; at DANGEROUS the catastrophic tier is
// removed from the pool before rolling. No percentage bonuses anywhere.
const ADVANTAGE_THRESHOLD = 3;
const CATASTROPHE_IMMUNITY_THRESHOLD = 6;

// ---------------------------------------------------------------------------
// Growth
// ---------------------------------------------------------------------------

// Base rate per session, before log2 diminishing returns. Bag work is the
// reliable floor, cardio the slow build, sparring the fast lane you have to be
// good enough to survive.
//
// v1.11 opens the other two corners of the triangle. Every rate here is one
// number in one table on purpose: attributeGrowth() takes an activity id and
// nothing else, so a new growth source is a row rather than a code path.
const GROWTH_RATES = {
  // Combat - the Spenard Gym.
  bag_work: 0.3,
  cardio: 0.2,
  sparring: 0.5,
  // Charisma - The Nile's two floors, plus the Night Owl nights that were
  // already happening and simply never counted for anything.
  nile_social: 0.25,
  tonk_game: 0.4,
  night_owl_social: 0.15,
  // Intelligence - reading a table, reading a listing, reading a man's hands
  // while he pours coffee.
  celo_game: 0.4,
  list_flip: 0.2,
  coffee_ceremony: 0.15,
};

// Which attribute each growth source feeds. Split from GROWTH_RATES so a
// reducer never has to hard-code "this one is Charisma" at the call site, and
// so a source with no attribute is a loud failure rather than silent no-op.
const GROWTH_ATTRIBUTES = {
  bag_work: "combat",
  cardio: "combat",
  sparring: "combat",
  nile_social: "charisma",
  tonk_game: "charisma",
  night_owl_social: "charisma",
  celo_game: "intelligence",
  list_flip: "intelligence",
  coffee_ceremony: "intelligence",
};

const GYM_ACTIVITIES = [
  {
    id: "bag_work",
    label: "Bag work",
    attribute: "combat",
    blurb: "Reliable, safe, and the first sessions are the ones that count.",
    requires: null,
  },
  {
    id: "cardio",
    label: "Cardio",
    attribute: "combat",
    blurb: "Slower going. Builds the wind you need when a night goes wrong.",
    requires: null,
  },
  {
    id: "sparring",
    label: "Sparring",
    attribute: "combat",
    blurb: "The fastest way up, and the only one that can send you home hurt.",
    requires: { attribute: "combat", value: 3 },
  },
];

const GYM_ACTIVITY_BY_ID = Object.fromEntries(GYM_ACTIVITIES.map((item) => [item.id, item]));

const SPARRING_INJURY_CHANCE = 0.15;
const SPARRING_INJURY_HEALTH = 10;
// Three consecutive days in the gym is worth +1 effective attribute on the next
// check that cares. It is spent on use, not carried.
const GYM_STREAK_REQUIREMENT = 3;
const GYM_STREAK_BONUS = 1;
// Growth past Dangerous needs real experience, not another session on the bag.
const GROWTH_CAP_PENALTY_FLOOR = 6;
const GROWTH_CAP_PENALTY = 0.5;

// The Nile runs the same streak rule as the gym, with one difference that comes
// out of the building itself: the gym only ever trains Combat, so its streak has
// one attribute to pay out to. The Nile trains Charisma downstairs and either
// attribute upstairs, so the streak pays out to whichever one you trained most
// recently. Three days of Tonk and one wellness visit is a Charisma streak; swap
// the last day for Cee-lo and the same three days pay Intelligence.
const NILE_STREAK_REQUIREMENT = 3;
const NILE_STREAK_BONUS = 1;

// ---------------------------------------------------------------------------
// Street Identity
// ---------------------------------------------------------------------------

// Identity is cosmetic. It never gates content, never modifies a roll, and never
// touches disposition - it is the neighborhood's shorthand for you, derived on
// read from your strongest attribute and what you have actually been seen doing.

// Which matrix column an observation category counts toward.
const IDENTITY_BEHAVIOR_COLUMNS = {
  violence: "violence",
  defiance: "violence",
  betrayal: "violence",
  heat_exposure: "violence",
  presence: "presence",
  discretion: "presence",
  loyalty: "presence",
  submission: "presence",
  honesty: "presence",
  financial: "financial",
  growth: "financial",
};

// No attribute leads by more than this and you read as Balanced.
const IDENTITY_BALANCE_MARGIN = 2;
// How far back getStreetIdentity looks when deciding what you have been doing.
const IDENTITY_RECENT_DAYS = 7;

const IDENTITY_MATRIX = {
  combat: {
    violence: "Shooter",
    presence: "Enforcer",
    financial: "Collector",
    default: "Muscle",
  },
  charisma: {
    violence: "Smooth Talker",
    presence: "Connected",
    financial: "Broker",
    default: "People Person",
  },
  intelligence: {
    violence: "Ghost",
    presence: "Observer",
    financial: "Quiet Money",
    default: "Calculator",
  },
  balanced: {
    violence: "Unpredictable",
    presence: "Hustler",
    financial: "Adaptable",
    default: "New Face",
  },
};

const IDENTITY_DESCRIPTIONS = {
  Shooter: "People step back when you come up the block, and they are not wrong to.",
  Enforcer: "You are the one somebody sends. Everyone knows which somebody.",
  Collector: "What you are owed, you collect. The block has watched it happen.",
  Muscle: "Nobody has decided what you want yet. They have decided what you can do.",
  "Smooth Talker": "You have talked your way out of rooms other people got carried out of.",
  Connected: "Your name comes up in conversations you were not in.",
  Broker: "Two people who needed each other met through you, and both of them paid.",
  "People Person": "You know everybody. It has not cost you anything yet.",
  Ghost: "Things happen near you and nobody can say you were there.",
  Observer: "You are always at the edge of it, and you are always still there after.",
  "Quiet Money": "No jewelry, no noise, and somehow never short.",
  Calculator: "You think two moves out. It reads as patience, which suits you.",
  Unpredictable: "Nobody can guess your next move, which is its own kind of protection.",
  Hustler: "Whatever the week needs, you are already doing it.",
  Adaptable: "You have no lane, and that has never once slowed you down.",
  "New Face": "The block is still deciding.",
};

// ---------------------------------------------------------------------------
// Outcome tiers
// ---------------------------------------------------------------------------

// Ordinal used to compare two rolls under advantage. Higher is better for the
// player, which is the whole contract: a higher attribute may never produce a
// worse result from the same seed.
const OUTCOME_VALUES = { clean: 3, messy: 2, failure: 1, catastrophic: 0 };

// Shapes, not pools.
//
// Every wired roll already computes a context-sensitive success chance from heat,
// gear, disposition, district, and health. Replacing that with a flat weighted
// table would throw all of it away, so instead the chance is split across the
// tiers at the ratios below: `success` divides the winning half, `failure`
// divides the losing half. buildOutcomePool() in src/systems/attributes.js does
// the arithmetic.
//
// The split is where the design lives. A robbery that goes wrong is usually just
// a failed robbery (0.72) and only sometimes a catastrophe (0.28); a job
// interview cannot be a catastrophe at all, because the worst case is not being
// hired.
const OUTCOME_SHAPES = {
  robbery: { success: { clean: 0.55, messy: 0.45 }, failure: { failure: 0.72, catastrophic: 0.28 } },
  dealer_robbery: { success: { clean: 0.45, messy: 0.55 }, failure: { failure: 0.6, catastrophic: 0.4 } },
  confrontation: { success: { clean: 0.5, messy: 0.5 }, failure: { failure: 0.65, catastrophic: 0.35 } },
  negotiation: { success: { clean: 0.5, messy: 0.5 }, failure: { failure: 0.7, catastrophic: 0.3 } },
  escape: { success: { clean: 0.6, messy: 0.4 }, failure: { failure: 0.8, catastrophic: 0.2 } },
  job_interview: { success: { clean: 0.45, messy: 0.55 }, failure: { failure: 1 } },
  night_owl: { success: { clean: 0.5, messy: 0.5 }, failure: { failure: 0.85, catastrophic: 0.15 } },
  gambling: { success: { clean: 0.4, messy: 0.6 }, failure: { failure: 0.8, catastrophic: 0.2 } },
  market_meetup: { success: { clean: 0.7, messy: 0.3 }, failure: { failure: 0.55, catastrophic: 0.45 } },
  // The two Nile tables read opponents rather than resolving the hand - the
  // hand is played for real in src/data/gambling.js. What these pools decide is
  // how much the player gets to SEE: a clean read surfaces a tell, a catastrophe
  // surfaces a false one. Neither can go worse than that, which is why neither
  // carries a catastrophic tier that costs money. Losing money is the game's
  // job, not the attribute's.
  tonk_read: { success: { clean: 0.5, messy: 0.5 }, failure: { failure: 0.75, catastrophic: 0.25 } },
  celo_read: { success: { clean: 0.55, messy: 0.45 }, failure: { failure: 0.75, catastrophic: 0.25 } },
};

// Which attribute shapes which action.
const ACTION_ATTRIBUTE_MAP = {
  robbery: "combat",
  dealer_robbery: "combat",
  confrontation: "combat",
  escape: "combat",
  negotiation: "charisma",
  job_interview: "charisma",
  night_owl: "charisma",
  gambling: "charisma",
  market_meetup: "intelligence",
  tonk_read: "charisma",
  celo_read: "intelligence",
};

// What the neighborhood ends up knowing.
//
// This is the keystone of the build: outcome quality decides the observation
// footprint. Doing crime well does not make you invisible, it makes you quiet -
// a clean job still generates the financial row, it just does not travel. A
// catastrophe goes out on two channels because somebody called it in.
//
// `type` must be one of the eleven categories in src/data/observations.js.
// `event` and `location` are free-form; location is filled in by the caller.
// What the neighborhood ends up knowing.
//
// This is the keystone of the build: outcome quality decides the observation
// footprint. Doing crime well does not make you invisible, it makes you quiet -
// a clean robbery still writes its financial row, it just travels on `direct`
// instead of reaching the network.
//
// Most tiers are deliberately empty. The Exposure System is a tuned economy of
// attention, and a row for every talk-down and every night at the counter buries
// the rows that mean something - measured, it moved every disposition up by half
// a band and pulled story pacing with it. Ordinary outcomes stay covered by the
// flat OBSERVED_ACTIONS table in game-core.js; what is added here is the
// difference between doing a thing well and doing it badly.
//
// `type` must be one of the eleven categories in src/data/observations.js.
// `event` and `location` are free-form; location is filled in by the caller.
const OUTCOME_OBSERVATIONS = {
  robbery: {
    clean: [{ type: "financial", event: "robbery_profit", channel: "direct" }],
    messy: [
      { type: "violence", event: "robbery_struggle", channel: "neighborhood" },
      { type: "heat_exposure", event: "heat_seen_low", channel: "neighborhood" },
    ],
    failure: [{ type: "defiance", event: "attempted_robbery", channel: "neighborhood" }],
    catastrophic: [
      { type: "violence", event: "robbery_gone_loud", channel: "neighborhood" },
      { type: "heat_exposure", event: "heat_seen_high", channel: "network" },
    ],
  },
  dealer_robbery: {
    clean: [{ type: "financial", event: "robbery_profit", channel: "direct" }],
    messy: [{ type: "violence", event: "dealer_stickup", channel: "neighborhood" }],
    failure: [{ type: "defiance", event: "attempted_robbery", channel: "neighborhood" }],
    catastrophic: [
      { type: "violence", event: "dealer_stickup", channel: "neighborhood" },
      { type: "heat_exposure", event: "heat_seen_high", channel: "network" },
    ],
  },
  confrontation: {
    clean: [],
    messy: [{ type: "violence", event: "street_fight", channel: "neighborhood" }],
    failure: [],
    catastrophic: [
      { type: "violence", event: "serious_violence", channel: "neighborhood" },
      { type: "heat_exposure", event: "heat_seen_high", channel: "network" },
    ],
  },
  negotiation: {
    clean: [],
    messy: [],
    failure: [],
    catastrophic: [{ type: "violence", event: "street_fight", channel: "neighborhood" }],
  },
  escape: {
    clean: [],
    messy: [],
    failure: [],
    catastrophic: [{ type: "heat_exposure", event: "heat_seen_high", channel: "neighborhood" }],
  },
  job_interview: {
    clean: [{ type: "growth", event: "hired_on", channel: "household" }],
    messy: [],
    failure: [],
  },
  night_owl: {
    clean: [],
    messy: [],
    failure: [],
    catastrophic: [{ type: "violence", event: "made_a_scene", channel: "neighborhood" }],
  },
  gambling: {
    clean: [],
    messy: [],
    failure: [],
    catastrophic: [{ type: "financial", event: "gambling_debt", channel: "neighborhood" }],
  },
  // Reading a table is not an event anybody reports. Both maps are empty on
  // purpose - what The Nile broadcasts is the money at the end of the night, and
  // gamblingObservations() prices that by how much of it there was.
  tonk_read: { clean: [], messy: [], failure: [], catastrophic: [] },
  celo_read: { clean: [], messy: [], failure: [], catastrophic: [] },
  market_meetup: {
    // A clean meetup writes nothing. The flip itself already broadcasts
    // `financial / 907list_profit` when it settles; a well-run handoff in a
    // parking lot is simply not an event anybody reports.
    clean: [],
    messy: [{ type: "presence", event: "met_a_stranger", channel: "neighborhood" }],
    failure: [],
    catastrophic: [{ type: "violence", event: "robbery_victim", channel: "neighborhood" }],
  },
};

// ---------------------------------------------------------------------------
// Standing pacing
// ---------------------------------------------------------------------------

// The flat standing integers outside state.npc still accumulate linearly, which
// is how a player hits max dealer standing on day three. Gains are braked as the
// number climbs.
//
// Two ladders because there are two kinds of number. Dealer, plug, and employer
// standing are hard-capped at 5, so the spec's 5/8 thresholds would never fire;
// they get the same shape rescaled to their real ceiling. Crew loyalty and job
// coworker relationship are genuinely uncapped and use the thresholds as written.
const STANDING_PACING = {
  capped: [{ floor: 4, multiplier: 0.25 }, { floor: 3, multiplier: 0.5 }],
  open: [{ floor: 8, multiplier: 0.25 }, { floor: 5, multiplier: 0.5 }],
};

module.exports = {
  ATTRIBUTE_IDS,
  ATTRIBUTES,
  ATTRIBUTE_DEFAULTS,
  ATTRIBUTE_MIN,
  ATTRIBUTE_MAX,
  ATTRIBUTE_LABEL_TIERS,
  ADVANTAGE_THRESHOLD,
  CATASTROPHE_IMMUNITY_THRESHOLD,
  GROWTH_RATES,
  GROWTH_ATTRIBUTES,
  GYM_ACTIVITIES,
  GYM_ACTIVITY_BY_ID,
  SPARRING_INJURY_CHANCE,
  SPARRING_INJURY_HEALTH,
  GYM_STREAK_REQUIREMENT,
  GYM_STREAK_BONUS,
  NILE_STREAK_REQUIREMENT,
  NILE_STREAK_BONUS,
  GROWTH_CAP_PENALTY_FLOOR,
  GROWTH_CAP_PENALTY,
  IDENTITY_BEHAVIOR_COLUMNS,
  IDENTITY_BALANCE_MARGIN,
  IDENTITY_RECENT_DAYS,
  IDENTITY_MATRIX,
  IDENTITY_DESCRIPTIONS,
  OUTCOME_VALUES,
  OUTCOME_SHAPES,
  ACTION_ATTRIBUTE_MAP,
  OUTCOME_OBSERVATIONS,
  STANDING_PACING,
};
