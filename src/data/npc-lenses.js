// A lens is how one person reads the same ledger everyone else is reading.
//
// STORY_BIBLE has said for a long time that each character notices a different
// axis: Mina reads consent and safety, Curtis reads exposure, Dre reads whether
// you follow through. This file is the first place that idea exists in code.
//
// Four archetypes carry a full weight table across all eleven categories. An NPC
// picks a base and overrides three to five entries. That is the whole authoring
// cost of a new character, which is the point: adding Biniam or Selam later
// should be one base and a handful of numbers, not a new relationship system.

const { OBSERVATION_CATEGORIES } = require("./observations.js");
const { NILE_LOCATION_ID } = require("./nile.js");

// CIVILIAN reads stability. Showing up and paying what you owe count; heat and
// violence at their door cost more than anything you could do to earn it back.
const CIVILIAN = {
  presence: 1.0,
  honesty: 1.5,
  violence: -3.0,
  financial: 1.5,
  heat_exposure: -2.5,
  loyalty: 1.5,
  betrayal: -4.0,
  discretion: 1.0,
  growth: 1.0,
  submission: 0.5,
  defiance: -1.0,
};

// STREET reads earning and follow-through. Heat is a cost of doing business, so
// it barely registers; going back on your word is close to unrecoverable.
const STREET = {
  presence: 0.6,
  honesty: 1.0,
  violence: -0.5,
  financial: 2.0,
  heat_exposure: -1.0,
  loyalty: 2.0,
  betrayal: -5.0,
  discretion: 1.5,
  growth: 1.5,
  submission: -0.5,
  defiance: 0.5,
};

// ROMANTIC reads who you are when nothing is being traded. Time and honesty
// carry it; being used carries the steepest penalty in the game.
const ROMANTIC = {
  presence: 1.5,
  honesty: 2.5,
  violence: -2.0,
  financial: 0.3,
  heat_exposure: -1.5,
  loyalty: 2.0,
  betrayal: -6.0,
  discretion: 2.0,
  growth: 1.0,
  submission: 0.0,
  defiance: -0.5,
};

// THREAT is inverted, and deliberately so. For a rival, a high score is not
// affection, it is being no problem to them. Everything that makes you worth
// noticing drives the number DOWN, which is why Curtis reads Neutral as
// invisible, Cold as watched, and Hostile as the tax and the confrontation.
const THREAT = {
  presence: -0.3,
  honesty: 0.5,
  violence: -2.5,
  financial: -1.5,
  heat_exposure: -1.5,
  loyalty: 1.0,
  betrayal: -3.0,
  discretion: 1.5,
  growth: -2.0,
  submission: 2.0,
  defiance: -2.5,
};

const ARCHETYPES = { CIVILIAN, STREET, ROMANTIC, THREAT };

// Event weights every lens inherits unless it names its own.
//
// A missed obligation is filed under `financial` because that is the category
// it belongs to, but the category weight is positive: money changing hands is
// normally a good sign. Without this the escalating rule would make repeated
// missed rent look better and better, which is the exact opposite of the point.
// Nobody is glad you did not pay them.
// Named letdowns need their own weights because category sign is not reliable
// in the negative direction. STREET scores `defiance` POSITIVELY on purpose:
// Dre respects nerve. That is good characterization and a trap for any generic
// "negative things go in the defiance bucket" rule, which would have scored
// walking a debt to him as a credit. Anything that means "you cost me
// something" is priced here instead of inherited from its category.
const SHARED_EVENT_WEIGHTS = {
  missed_obligation: -2.5,
  let_them_down: -2.0,
  walked_a_debt: -3.0,
  botched_mission: -2.0,
  refused_work: -1.5,
};

// Archetypes whose score runs backwards. Content gating for these reads "at
// most Neutral" rather than "at least Warm", and the debug inspector says so.
const INVERTED_ARCHETYPES = new Set(["THREAT"]);

// Per-NPC definitions. `weights` overrides the base category table.
// `eventWeights` overrides a single named event inside a category, which is how
// Yalonda can care about rent specifically without caring about money in
// general. `sourceMultipliers` scales by how the news arrived.
// `locationWeights` scales a category by WHERE it happened, which is how Selam
// can be ordinary about violence in general and hypervigilant about violence at
// her own address.
const NPC_LENSES = {
  mina: {
    archetype: "ROMANTIC",
    weights: { violence: -4.0, discretion: 4.0 },
    // She hears things. What the network carries back weighs double what she
    // watches happen across her own counter.
    sourceMultipliers: { network: 2.0 },
  },
  curtis: {
    archetype: "THREAT",
    weights: { growth: -3.0 },
  },
  dre: {
    archetype: "STREET",
    weights: { financial: 4.0, honesty: 2.0 },
  },
  yalonda: {
    archetype: "CIVILIAN",
    weights: { heat_exposure: -3.0, presence: 1.5 },
    eventWeights: { rent_paid: 3.0 },
  },
  juan: {
    archetype: "CIVILIAN",
    weights: { violence: -1.0, growth: 2.0, discretion: 1.5 },
  },
  simone: {
    // Stubbed on the base table until her content exists. Listed rather than
    // omitted so a missing lens is always a bug, never a silent default.
    archetype: "THREAT",
    weights: {},
  },
  // Selam runs the ground floor of The Nile and reads one axis above all
  // others: is this person a threat to the building. Her father's building is
  // the family's only real asset and a raid upstairs closes her business by
  // association, so heat and violence at her door are existential rather than
  // merely bad.
  selam: {
    archetype: "CIVILIAN",
    weights: { heat_exposure: -4, discretion: 3, presence: 2, growth: 2, violence: -4 },
    // Hypervigilant about her own address specifically. A fight two districts
    // over is a fight; a fight outside her window is her livelihood.
    locationWeights: { [NILE_LOCATION_ID]: { violence: 2, heat_exposure: 2 } },
    // She does not care how the dice went. Her character doc is explicit that
    // gambling behavior carries no weight with her - it is her brother's
    // business and she has said so out loud.
    eventWeights: { gambling_profit: 0, gambling_loss: 0 },
  },
  // Biniam watches what happens in his house and nothing else. The single most
  // characterful line in his lens is the source multiplier: street gossip about
  // his guests is worth exactly zero to him.
  biniam: {
    archetype: "STREET",
    weights: { violence: -2, discretion: 3, presence: 1.5, defiance: -2, growth: 2 },
    sourceMultipliers: { network: 0 },
  },
  // Deshawn judges one thing: whether you burn people. Violence is expensive
  // in his ledger, discretion and loyalty are what he stakes his name on, and
  // a betrayal - of anyone - costs more with him than with anyone else on the
  // block, because he expected better.
  deshawn: {
    archetype: "STREET",
    weights: { violence: -3, discretion: 3, loyalty: 4, betrayal: -5, presence: 2 },
  },
};

const EXPOSURE_NPC_IDS = Object.keys(NPC_LENSES);

// Flattens a definition into a plain category table plus its modifiers. Called
// once per disposition read; cheap enough that nothing caches it, and keeping
// it uncached means a test can edit a weight and see the effect immediately.
function resolveLens(npcId) {
  const definition = NPC_LENSES[npcId];
  if (!definition) return null;
  const base = ARCHETYPES[definition.archetype];
  const weights = {};
  for (const category of OBSERVATION_CATEGORIES) {
    weights[category] = definition.weights && category in definition.weights
      ? definition.weights[category]
      : base[category];
  }
  return {
    npcId,
    archetype: definition.archetype,
    inverted: INVERTED_ARCHETYPES.has(definition.archetype),
    weights,
    eventWeights: { ...SHARED_EVENT_WEIGHTS, ...(definition.eventWeights || {}) },
    sourceMultipliers: definition.sourceMultipliers || {},
    locationWeights: definition.locationWeights || {},
  };
}

module.exports = {
  ARCHETYPES,
  SHARED_EVENT_WEIGHTS,
  INVERTED_ARCHETYPES,
  NPC_LENSES,
  EXPOSURE_NPC_IDS,
  resolveLens,
};
