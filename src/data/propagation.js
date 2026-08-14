// How news travels.
//
// An event card does not decide who hears about it. It tags an observation with
// a channel, and this table decides who that reaches and how long it takes. That
// is what makes the same action land differently depending on where you did it:
// a robbery two blocks from the Night Owl reaches Mina that evening through the
// neighborhood, and the same robbery out on the service roads may never reach
// her at all.

const { OBSERVATION_CATEGORIES } = require("./observations.js");

// arrival     when it lands. "now" is the same slot; "end_of_day" is Night of
//             the same day; "days" waits `days` whole days and lands at Morning.
// maxExtraDays  spread on a "days" arrival, resolved by a stable hash so the
//             same day always replays the same way.
// source      what the receiving lens will call this, for source multipliers.
// presence    when true, the NPC has to have been reachable to pick it up.
// timeOfDay   when false, the channel ignores whether the NPC is on shift.
const CHANNELS = {
  direct: { id: "direct", arrival: "now", source: "witnessed", presence: false, timeOfDay: true },
  household: { id: "household", arrival: "end_of_day", source: "household", presence: false, timeOfDay: false },
  neighborhood: { id: "neighborhood", arrival: "days", days: 1, maxExtraDays: 1, source: "neighborhood", presence: true, timeOfDay: true },
  network: { id: "network", arrival: "days", days: 1, source: "network", presence: false, timeOfDay: false },
  reputation: { id: "reputation", arrival: "days", days: 7, source: "reputation", presence: false, timeOfDay: false },
};

const CHANNEL_IDS = Object.keys(CHANNELS);

// Who listens on what. Yalonda and Juan share a roof with the player, so the
// household channel is theirs alone. Curtis is the only one wired to the
// network, and Mina is on it because the block talks to her across a counter.
const NPC_CHANNELS = {
  yalonda: ["direct", "household", "neighborhood"],
  juan: ["direct", "household", "neighborhood"],
  mina: ["direct", "neighborhood", "network"],
  curtis: ["direct", "network", "reputation"],
  dre: ["direct", "network"],
  simone: ["direct", "network"],
};

// Curtis does not care about corner-level activity, and the whole design of his
// attention depends on that staying true. Only these categories clear his
// network filter; anything else stays below his radar no matter how often it
// happens. Territory claims and named reports arrive as defiance.
const CURTIS_NETWORK_CATEGORIES = new Set(["violence", "defiance", "growth"]);

// Volume, not category, is the other way onto his radar. A financial
// observation reaches him only when it was a big enough day to be worth a
// phone call.
const CURTIS_VOLUME_THRESHOLD = 200;

// Heat is public. Past these marks the player is visibly hot and the news
// spreads on its own, without any card tagging it.
const HEAT_CHANNEL_THRESHOLDS = [
  { above: 12, channel: "network" },
  { above: 10, channel: "neighborhood" },
  { above: 8, channel: "household" },
];

// Which parts of the day each NPC is reachable in person. Mina works evenings
// and nights behind the counter, which is why a Morning sighting at the Night
// Owl never becomes something she knows.
const NPC_PRESENCE_SLOTS = {
  yalonda: [0, 2, 3],
  juan: [0, 2, 3],
  mina: [2, 3],
  curtis: [1, 2, 3],
  dre: [1, 2, 3],
  simone: [1, 2, 3],
};

// Where each NPC can pick something up in person. Null means anywhere in the
// home district.
const NPC_PRESENCE_AREAS = {
  yalonda: ["north_star_lot"],
  juan: ["north_star_lot"],
  mina: ["north_star_lot"],
  curtis: ["north_star_lot", "downtown"],
  dre: ["north_star_lot", "downtown"],
  simone: ["north_star_lot", "downtown"],
};

function channelFor(id) {
  return CHANNELS[id] || CHANNELS.direct;
}

function listensOn(npcId, channelId) {
  return (NPC_CHANNELS[npcId] || ["direct"]).includes(channelId);
}

// Curtis's sensitivity threshold. Returns true when an observation is loud
// enough to reach him through the network at all.
function clearsCurtisFilter(observation) {
  if (CURTIS_NETWORK_CATEGORIES.has(observation.type)) return true;
  if (observation.type === "financial") return Math.abs(Number(observation.value) || 0) >= CURTIS_VOLUME_THRESHOLD;
  return false;
}

function heatChannel(heat) {
  const value = Number(heat) || 0;
  for (const entry of HEAT_CHANNEL_THRESHOLDS) if (value > entry.above) return entry.channel;
  return null;
}

module.exports = {
  CHANNELS,
  CHANNEL_IDS,
  NPC_CHANNELS,
  CURTIS_NETWORK_CATEGORIES,
  CURTIS_VOLUME_THRESHOLD,
  HEAT_CHANNEL_THRESHOLDS,
  NPC_PRESENCE_SLOTS,
  NPC_PRESENCE_AREAS,
  OBSERVATION_CATEGORIES,
  channelFor,
  listensOn,
  clearsCurtisFilter,
  heatChannel,
};
