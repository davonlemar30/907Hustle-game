// The Exposure engine: ledgers in, dispositions out, gossip in between.
//
// IMPORTANT: this module may require src/data/* and src/selectors.js and nothing
// else. It must never require game-core.js. src/events/cards.js needs to gate
// content on disposition, and cards.js cannot reach back into game-core without
// creating the cycle that src/selectors.js exists to avoid. game-core requires
// the engine; the engine requires no one.
//
// Nothing here stores a disposition. A score is recomputed from the ledger on
// every read, which is what makes "how you earned it" matter: two players at the
// same number got there through different rows, and the rows are what content
// and future observations actually see.

const { slotNumber } = require("../selectors.js");
const { stringHash } = require("../events/random.js");
const { createObservation, addObservation, effectiveCount } = require("../data/observations.js");
const { resolveLens, EXPOSURE_NPC_IDS } = require("../data/npc-lenses.js");
const { BANDS, bandFor, bandId, bandLabel } = require("../data/disposition-bands.js");
const {
  channelFor,
  listensOn,
  clearsCurtisFilter,
  heatChannel,
  NPC_PRESENCE_SLOTS,
  NPC_PRESENCE_AREAS,
} = require("../data/propagation.js");

function ledgerOf(state, npcId) {
  const record = state && state.npc && state.npc[npcId];
  if (!record) return [];
  if (!Array.isArray(record.ledger)) record.ledger = [];
  return record.ledger;
}

// The weight one row contributes: the lens's category weight, replaced by an
// event-specific weight where the NPC has one, scaled by how the news arrived
// and by where it happened, then multiplied by the diminishing-returns count.
//
// The location scale defaults to 1 for everyone, so it costs nothing until an
// NPC declares that somewhere matters to them more than everywhere else. Selam
// is the first: violence at The Nile is not the same fact to her as violence in
// general, because The Nile is her livelihood.
//
// `sourceMultipliers` uses `?? 1` rather than `|| 1` on purpose: Biniam's whole
// characterization is `network: 0`, and `||` would read that zero as "unset" and
// hand him back the street gossip he explicitly does not listen to.
function rowWeight(lens, row) {
  const base = row.event && row.event in lens.eventWeights
    ? lens.eventWeights[row.event]
    : lens.weights[row.type];
  const multiplier = lens.sourceMultipliers[row.source] ?? 1;
  const byLocation = (lens.locationWeights || {})[row.location];
  const locationScale = byLocation && row.type in byLocation ? byLocation[row.type] : 1;
  return base * multiplier * locationScale * effectiveCount(row);
}

function getDisposition(npcId, state) {
  const lens = resolveLens(npcId);
  if (!lens) return 0;
  let score = 0;
  for (const row of ledgerOf(state, npcId)) score += rowWeight(lens, row);
  // Rounded to two places so a float tail can never flip a band boundary
  // differently on two machines. Band floors are whole numbers.
  return Math.round(score * 100) / 100;
}

function getDispositionBand(npcId, state) {
  return bandFor(getDisposition(npcId, state));
}

// Records something an NPC learns first-hand, right now. Used by cards and
// reducer cases that name their recipient. No gating: if the code says Mina was
// told, Mina was told.
function recordObservation(state, npcId, spec) {
  if (!state || !state.npc || !state.npc[npcId]) return null;
  const observation = createObservation({ ...spec, day: spec.day || state.run.day });
  if (!observation) return null;
  return addObservation(ledgerOf(state, npcId), observation);
}

// Whether an NPC could have picked something up in person, given when and where
// it happened. Only channels flagged presence-checked consult this.
function couldObserve(npcId, { slot, location }) {
  const slots = NPC_PRESENCE_SLOTS[npcId];
  if (slots && slot != null && !slots.includes(slot)) return false;
  const areas = NPC_PRESENCE_AREAS[npcId];
  if (areas && location && !areas.includes(location)) return false;
  return true;
}

// When a channel lands, as an absolute slot number.
//
// The neighborhood takes one or two days to carry something, and which one has
// to be stable: replaying the same day must produce the same answer. Drawing
// from run.rngState would make an observation's fate depend on whether an
// unrelated encounter consumed a draw earlier in the day, so this hashes the
// seed and the observation instead.
const LAST_SLOT = 3;

function deliverySlot(state, channel, observation, { day, slot }) {
  if (channel.arrival === "now") return slotNumber(day, slot);
  if (channel.arrival === "end_of_day") return slotNumber(day, LAST_SLOT);
  let days = channel.days || 1;
  if (channel.maxExtraDays) {
    const key = `${state.run.seed}:gossip:${observation.type}:${observation.event || ""}:${observation.location || ""}:${day}`;
    days += stringHash(key) % (channel.maxExtraDays + 1);
  }
  return slotNumber(day + days, 0);
}

function receives(npcId, channelId, observation, context) {
  if (!listensOn(npcId, channelId)) return false;
  const channel = channelFor(channelId);
  if (channel.presence && !couldObserve(npcId, context)) return false;
  if (channel.timeOfDay && !channel.presence && context.slot != null) {
    const slots = NPC_PRESENCE_SLOTS[npcId];
    if (slots && !slots.includes(context.slot)) return false;
  }
  // Curtis hears through a filter, not a firehose. Corner-level activity never
  // reaches him regardless of how loud the rest of the block is about it.
  if (npcId === "curtis" && channelId === "network" && !clearsCurtisFilter(observation)) return false;
  return true;
}

// Sends one observation out over a channel. Everyone subscribed who could
// plausibly have received it gets a copy, immediately or on a delay.
// Returns the ids that will eventually hear it.
function broadcastObservation(state, spec) {
  const channelId = spec.channel || "direct";
  const channel = channelFor(channelId);
  const day = spec.day || state.run.day;
  const slot = spec.slot == null ? state.run.slot : spec.slot;
  const observation = createObservation({ ...spec, day, source: channel.source });
  if (!observation) return [];
  const context = { slot, location: spec.location || state.world.currentNeighborhoodId };
  const reached = [];
  for (const npcId of EXPOSURE_NPC_IDS) {
    if (!state.npc[npcId]) continue;
    if (!receives(npcId, channelId, observation, context)) continue;
    reached.push(npcId);
    const deliverAtSlot = deliverySlot(state, channel, observation, { day, slot });
    if (deliverAtSlot <= slotNumber(day, slot)) {
      addObservation(ledgerOf(state, npcId), { ...observation });
      continue;
    }
    state.run.pendingObservations.push({ npcId, observation: { ...observation }, deliverAtSlot });
  }
  return reached;
}

// Drains everything whose delivery time has arrived. Rebuilds the survivor list
// rather than splicing in place, matching resolveJobApplications.
function resolveObservationQueue(state) {
  const queue = state.run.pendingObservations;
  if (!Array.isArray(queue) || !queue.length) return 0;
  const now = slotNumber(state.run.day, state.run.slot);
  const waiting = [];
  let delivered = 0;
  for (const entry of queue) {
    if (!entry || !state.npc[entry.npcId] || !entry.observation) continue;
    if (now < entry.deliverAtSlot) { waiting.push(entry); continue; }
    addObservation(ledgerOf(state, entry.npcId), entry.observation);
    delivered += 1;
  }
  state.run.pendingObservations = waiting;
  return delivered;
}

// Heat is public. Past each mark it spreads on its own, with no card tagging it,
// which is what finally connects the heat meter to the people around the player.
// Recorded once per day per band so a hot week accumulates rather than spiking.
function propagateHeat(state) {
  const channel = heatChannel(state.player.heat);
  if (!channel) return null;
  broadcastObservation(state, {
    type: "heat_exposure",
    event: `heat_${channel}`,
    value: state.player.heat,
    channel,
    day: state.run.day,
    slot: state.run.slot,
  });
  return channel;
}

// Everything the debug inspector needs to answer "why did Mina go Cold".
// Exported through game-core's selectors; never rendered to a player.
function describeDisposition(state, npcId) {
  const lens = resolveLens(npcId);
  if (!lens) return null;
  const rows = ledgerOf(state, npcId).map((row) => ({
    type: row.type,
    event: row.event,
    location: row.location,
    source: row.source,
    count: row.count,
    day: row.day,
    baseWeight: row.event && row.event in lens.eventWeights ? lens.eventWeights[row.event] : lens.weights[row.type],
    sourceMultiplier: lens.sourceMultipliers[row.source] ?? 1,
    locationScale: ((lens.locationWeights || {})[row.location] || {})[row.type] ?? 1,
    effectiveCount: Math.round(effectiveCount(row) * 100) / 100,
    contribution: Math.round(rowWeight(lens, row) * 100) / 100,
  })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const score = getDisposition(npcId, state);
  const band = bandFor(score);
  return {
    npcId,
    archetype: lens.archetype,
    inverted: lens.inverted,
    score,
    band,
    bandId: bandId(band),
    bandLabel: bandLabel(band),
    rows,
    pending: (state.run.pendingObservations || [])
      .filter((entry) => entry.npcId === npcId)
      .map((entry) => ({ type: entry.observation.type, event: entry.observation.event, deliverAtSlot: entry.deliverAtSlot })),
  };
}

module.exports = {
  BANDS,
  EXPOSURE_NPC_IDS,
  getDisposition,
  getDispositionBand,
  recordObservation,
  broadcastObservation,
  resolveObservationQueue,
  propagateHeat,
  describeDisposition,
  couldObserve,
  ledgerOf,
};
