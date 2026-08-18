// What people will tell you, for money (v1.27).
//
// The game has always computed everything a player would pay to know. The
// nightly plan ranks which corners Curtis's people are working and how hard;
// policeRaidChance and curtisMoveChance are exact numbers sitting one function
// call away from the screen. Until now exactly one surface sold any of it -
// Pherris's standing tier feed - and one surface gave a sliver away free, the
// v1.23 gossip warning. A player without Pherris met a fully determined system
// blind.
//
// This file opens the other door. Information becomes a purchase, and who will
// sell it to you is a relationship question:
//
//   GOSSIP       free, on a timer you do not control, gated on disposition.
//                It tells you something is coming. It never gives you a number.
//   PHERRIS      standing, always-on, gated on her crew tier. The block cards
//                on the Territory page. A subscription.
//   DISCLOSURE   paid, on demand, gated on the band. You choose when to ask and
//                what to ask about, and the band decides whether the answer is
//                exact or approximately true.
//
// The three do not overlap and none of them replaces another. This file is the
// third one, and it duplicates neither of the first two.
//
// Nothing here reads or writes game state, and nothing here may require
// game-core.js. That boundary is not decoration: policeRaidChance and
// curtisMoveChance are closures inside game-core, so the caller gathers the
// truth and this module shapes it and speaks it. What arrives here is already
// a number or a list; what leaves is a sentence in somebody's voice.
//
// DESHAWN IS NOT IN THIS FILE, and that is a design position held since v1.20.
// His whole value is being off Curtis's network - propagation.js wires him to
// `neighborhood` and `household` and deliberately not to `network`. A man who
// is not on the wire cannot sell you what is on it. He shapes what OTHER people
// tell you (the v1.23 tier ladder) and never becomes a source himself.

const { stringHash } = require("../hash.js");
const { BANDS } = require("./disposition-bands.js");

// --- Intel types -----------------------------------------------------------
//
// `reads` names the selector each type is derived from. It is documentation
// that a test can execute: the structural test resolves every one of these
// against the exported selector bag, so a type can never claim to read
// something the game does not compute.
//
// `staleness` is how long the answer is good for.
//
//   night  the nightly plan, which recomputes when the phase moves. A plan
//          bought in the Morning describes tonight; if his awareness shifts
//          before dark, what you were told is simply out of date.
//   day    reads Heat and the garrison, both of which the player moves with
//          their own actions during the day.
//
// Neither is enforced by an expiry timer, and that is the point. A disclosure
// is CACHED AS A PHONE MESSAGE at the moment of purchase and never re-derived.
// The text does not follow the world. That is what staleness means here: the
// source told you what they knew when you asked, and they were not wrong.
const INTEL_TYPES = [
  { id: "curtis_targets", label: "What Curtis wants tonight", price: 50, reads: "curtisNightPlan", staleness: "night", shape: "list" },
  { id: "curtis_pressure", label: "How hard he's coming", price: 75, reads: "curtisNightPlan", staleness: "night", shape: "pressure" },
  { id: "police_heat_map", label: "Where the police are working", price: 30, reads: "policeRaidChance", staleness: "day", shape: "chances" },
  { id: "block_vulnerability", label: "Which corner is soft", price: 60, reads: "curtisMoveChance", staleness: "day", shape: "chances" },
  { id: "curtis_next_move", label: "The corner they keep naming", price: 100, reads: "curtisNightPlan", staleness: "day", shape: "single" },
  // v1.30. The one product on the table that is not about Curtis. It reads the
  // player's OWN corners back to them - headcount, whether the police came
  // through last night, whether a body was lost, whether the corner changed
  // hands - which is why it is the cheapest thing here. The player was already
  // told all of it, one line at a time, in a feed they were scrolling past at
  // midnight. What $40 buys is somebody who organised it before you woke up.
  { id: "territory_status", label: "How your corners came through the night", price: 40, reads: "blockSoldierCount", staleness: "day", shape: "corners" },
];

const INTEL_TYPE_BY_ID = Object.fromEntries(INTEL_TYPES.map((type) => [type.id, type]));
const INTEL_TYPE_IDS = INTEL_TYPES.map((type) => type.id);

// --- The table -------------------------------------------------------------
//
// Who sells what, and what it costs you in relationship rather than cash.
//
// Every row is justified by the channel the seller is actually on, checked
// against propagation.js by the structural test rather than by assertion here:
// the two people who can name Curtis's targets (Dre, Mina) are on `network`,
// which is the only channel his people's movements travel on; the two who read
// police patterns (Juan, Yalonda) are on `neighborhood`, because a cruiser
// going past three times is something you see from a window, not something you
// hear from the wire. Biniam is on `neighborhood` too and sells the softest
// product of the five, which is right for a man repeating what drinkers said
// upstairs.
//
// Pherris is absent on purpose. Her intel is a standing subscription on the
// Territory cards and it is already shipped; putting her here would sell the
// player a second time for something she is already giving them.
//
// Selam is not a disclosure source. She has never been written speaking about
// territory or criminal operations, and a line to fill a table would be the
// wrong character. Authored register first, table row second. v1.23 left her
// out of the gossip voices for exactly this reason, and 3.2 named her as an
// obvious candidate without checking whether there was a voice to give her.
// There is not. Writing one is a character build, not a table build.
//
// Deshawn stays out for the fourth build running. His whole value is being off
// Curtis's network, and a man who is not on the wire cannot sell what is on
// it. He shapes what other people say and never becomes a source himself.
const DISCLOSURES = [
  // Dre climbs the whole ladder alone, because he is the only pure network
  // contact the player builds a real relationship with. What Warm buys is the
  // list; Trusted buys the weights; Bonded buys the one corner they keep
  // saying out loud.
  { npcId: "dre", intelType: "curtis_targets", minBand: BANDS.WARM },
  { npcId: "dre", intelType: "curtis_pressure", minBand: BANDS.TRUSTED },
  { npcId: "dre", intelType: "curtis_next_move", minBand: BANDS.BONDED },
  // Mina hears the same wire across a counter, and she costs a band more for
  // the same product. She is not a broker and does not want to be one.
  { npcId: "mina", intelType: "curtis_targets", minBand: BANDS.TRUSTED },
  // Yalonda watches the street outside her own building all day and will tell
  // anyone she likes. Juan is out on it and reads it better, which is why his
  // gate is higher and his numbers are the ones worth buying.
  { npcId: "yalonda", intelType: "police_heat_map", minBand: BANDS.WARM },
  { npcId: "juan", intelType: "police_heat_map", minBand: BANDS.TRUSTED },
  { npcId: "biniam", intelType: "block_vulnerability", minBand: BANDS.TRUSTED },
  // v1.30. Tone is the first crew source, and the first who sells something
  // that is not Curtis intel. `requiresCrew` is the only row field the game
  // reads out of state rather than out of this file: a lieutenant who has not
  // been hired, or who has walked, is not answering the phone about your
  // corners. The check lives in disclosureOffers because THIS module may not
  // read state - it is the same boundary that keeps the jitter honest.
  { npcId: "tone", intelType: "territory_status", minBand: BANDS.WARM, requiresCrew: true },
];

const DISCLOSURE_NPC_IDS = [...new Set(DISCLOSURES.map((entry) => entry.npcId))];

// How the text is signed, same rule as gossip.js: the phone shows the name the
// player would have saved the number under.
const DISCLOSURE_SENDERS = {
  dre: "Dre",
  mina: "Mina",
  juan: "Juan",
  yalonda: "Yalonda",
  biniam: "Biniam",
  tone: "Tone",
};

function disclosureFor(npcId, intelType) {
  return DISCLOSURES.find((entry) => entry.npcId === npcId && entry.intelType === intelType) || null;
}

function disclosuresForNpc(npcId) {
  return DISCLOSURES.filter((entry) => entry.npcId === npcId);
}

function priceFor(intelType) {
  return INTEL_TYPE_BY_ID[intelType]?.price || 0;
}

function senderFor(npcId) {
  return DISCLOSURE_SENDERS[npcId] || null;
}

// --- Accuracy --------------------------------------------------------------
//
// Three states, and the middle one is the interesting one.
//
//   unavailable  below the gate. The NPC does not sell it, and there is no
//                message saying so - the offer simply is not on the list.
//   jittered     at the gate. They tell you what they think they know.
//   exact        above the gate, or at Bonded. They tell you what is true.
//
// The Bonded clause is not a special case bolted on; it is the same rule
// blockIntelView has followed since v1.20 - jittered below the top, exact at
// it. Without it `curtis_next_move`, whose gate IS Bonded, could never be
// bought accurately at any price, and the most expensive product in the game
// would be the only one that always lies a little.
//
// v1.30 adds the second exception, at the other end of the table.
// `territory_status` is authored `exact` only, so Tone hands back the truth at
// his gate instead of a jittered read. He is not guessing at Curtis - he is
// counting his own people on the player's own corners, and a man who is wrong
// about that is not an approximate source, he is a broken one. The gate stays
// at Warm because the relationship is what buys the phone call, not the
// arithmetic. disclosureText returns null for an unauthored accuracy, and
// disclosureOffers refuses to sell a row it cannot speak, so the absent
// `jittered` branch is the enforcement rather than a gap in it.
function accuracyFor(band, minBand) {
  const value = Number(band);
  if (!Number.isFinite(value) || value < minBand) return "unavailable";
  if (value > minBand || value >= BANDS.BONDED) return "exact";
  return "jittered";
}

// v1.30. The rule the two exceptions above are actually implemented by, in one
// place so the offers list, the reducer, and the tests cannot drift apart on
// it. A product with no authored `jittered` voice is exact at its own gate:
// the absence of the branch IS the design statement, and this is where it gets
// read. Everything else falls through to accuracyFor untouched, so the five
// v1.27 rows behave exactly as they did.
function resolvedAccuracy(npcId, intelType, band, minBand) {
  const accuracy = accuracyFor(band, minBand);
  if (accuracy === "jittered" && !hasVoice(npcId, intelType, "jittered")) return "exact";
  return accuracy;
}

// --- Jitter ----------------------------------------------------------------
//
// Every wobble below is hashed, never drawn. Two reasons, both load-bearing.
// A reload must not reroll what somebody already told you - the message is
// sitting in the inbox and re-deriving it would make the phone a slot machine.
// And a purchase must not move the RNG stream, or buying intel would silently
// change what happens tonight, which would make the information a cause of the
// thing it describes.
//
// The key idiom is curtisBlockDefenseEstimate's: seed, subject, day. Same day,
// same answer; a week apart, a different one.

// +/-15% of the true value, as an integer percentage offset. 31 buckets so
// zero is reachable and the two tails are symmetric.
function jitterChance(chance, key) {
  const offset = (stringHash(key) % 31) - 15;
  return Math.max(0, Math.min(0.9, chance * (1 + offset / 100)));
}

// The pressure weight, off by at most one. Clamped into the real range so a
// jittered read is always a weight Curtis could actually have assigned - being
// wrong is fine, being impossible is a bug the player can detect.
function jitterWeight(weight, key, maxWeight) {
  const offset = (stringHash(key) % 3) - 1;
  return Math.max(1, Math.min(maxWeight, weight + offset));
}

// What a jittered list does to the truth. Three outcomes rather than two,
// because a source who is wrong every single time is not a source, they are a
// tell. `faithful` is the honest read that happens to have come from a
// second-hand mouth.
const LIST_SHAPES = ["faithful", "omit", "false_positive"];

function listShape(key) {
  return LIST_SHAPES[stringHash(key) % LIST_SHAPES.length];
}

// `truth` is the ordered plan; `decoys` are corners the player holds that are
// NOT on it, which is where a false positive has to come from - naming a corner
// the player does not own would not be a mistake, it would be nonsense.
function jitterList(truth, decoys, key) {
  const shape = listShape(key);
  if (shape === "omit" && truth.length > 1) return truth.slice(0, -1);
  if (shape === "false_positive" && decoys.length) {
    const pick = decoys[stringHash(`${key}:decoy`) % decoys.length];
    return [...truth, pick];
  }
  return truth;
}

// --- Voice -----------------------------------------------------------------
//
// Two or three lines per person per product, rotated on the day so a player who
// buys from Dre on Tuesday and again on Thursday does not read the same
// sentence twice. Each set is authored, not templated across characters: the
// same fact from Yalonda and from Dre is not the same sentence with a name
// swapped, because they are not noticing the same thing.
//
// The accuracy shows in the grammar, not in a disclaimer. An exact line names
// the corner and gives the number. A jittered line hedges, rounds, or says
// "one or two" - it reads like a person being approximately helpful, which is
// what it is. Nothing anywhere tells the player which one they got. Working out
// whether your source is good is the game.

function joinNames(names) {
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function percent(chance) {
  return `${Math.round(chance * 100)}%`;
}

// Two shapes the chance voices share, so a line can lead with the worst corner
// and then trail the rest without every author hand-rolling the punctuation.
// `tail` returns "" when there is only one corner to talk about, which is what
// keeps a single-block player from reading a sentence with nothing after it.
function list(rows, render) {
  return joinNames(rows.map(render));
}

// `lead` is swallowed along with the clause when there is no tail, so a voice
// can open the trailing sentence ("Same story on ...") without stranding the
// words on a player who holds exactly one corner.
function tail(rows, render, lead = "") {
  return rows.length > 1 ? `${lead}${list(rows.slice(1), render)}.` : "";
}

// Each entry is a list of functions over the shaped payload. The payload is
// already jittered or already exact by the time it arrives; a voice never
// decides how true it is, only how it sounds.
const VOICES = {
  dre: {
    curtis_targets: {
      exact: [
        (p) => `Curtis is looking at ${joinNames(p.names)} tonight. That's the list.`,
        (p) => `Straight up: ${joinNames(p.names)}. His people are working those tonight.`,
        (p) => `You want it plain. ${joinNames(p.names)}. Tonight.`,
      ],
      jittered: [
        (p) => `Word is Curtis has people on ${joinNames(p.names)}. That's what came back to me.`,
        (p) => `${joinNames(p.names)}, near as I can tell. I'd cover those.`,
        (p) => `Heard ${joinNames(p.names)}. Don't hold me to the whole list.`,
      ],
    },
    curtis_pressure: {
      exact: [
        (p) => `Pressure reads like this: ${p.weights.map((w) => `${w.name}, ${w.label}`).join(". ")}. Post accordingly.`,
        (p) => `Here's the weight. ${p.weights.map((w) => `${w.name} — ${w.label}`).join(". ")}.`,
      ],
      jittered: [
        (p) => `What I got is ${p.weights.map((w) => `${w.name} ${w.label}`).join(", ")}. Could be off a notch.`,
        (p) => `${p.weights.map((w) => `${w.name}, sounds ${w.label}`).join(". ")}. That's secondhand weight, not mine.`,
      ],
    },
    curtis_next_move: {
      exact: [
        (p) => `One corner keeps coming up when his people talk. ${p.name}. That's the one.`,
        (p) => `You paid for the name, here's the name: ${p.name}. Everything else is noise.`,
      ],
      jittered: [
        (p) => `They keep circling one spot. ${p.name}, I think. Watch it.`,
        (p) => `Sounds like ${p.name} is the one they keep naming. Sounds like.`,
      ],
    },
  },
  mina: {
    curtis_targets: {
      exact: [
        (p) => `Some people were talking about ${joinNames(p.names)} tonight. It sounded serious.`,
        (p) => `I don't like passing this on. ${joinNames(p.names)}. Tonight. Please be careful.`,
      ],
      jittered: [
        (p) => `I heard something about ${joinNames(p.names)}. I might have the corners wrong.`,
        (p) => `There was talk at the counter. ${joinNames(p.names)}, maybe. It didn't sound like nothing.`,
      ],
    },
  },
  juan: {
    police_heat_map: {
      exact: [
        (p) => `Counted cruisers all day on my route. ${p.chances[0].name} is the worst of it, ${p.chances[0].text}. ${tail(p.chances, (c) => `${c.name} runs ${c.text}`)}`,
        (p) => `Here's what the traffic looks like. ${list(p.chances, (c) => `${c.name} at ${c.text}`)}. Straight off the route.`,
      ],
      jittered: [
        (p) => `Lot of cruisers on ${p.chances[0].name} today. More than usual — call it ${p.chances[0].text}. ${tail(p.chances, (c) => `${c.name} maybe ${c.text}`)}`,
        (p) => `From what I saw walking in: ${list(p.chances, (c) => `${c.name} around ${c.text}`)}. Give or take, man.`,
      ],
    },
  },
  yalonda: {
    police_heat_map: {
      exact: [
        (p) => `There were cops on ${p.chances[0].name} three separate times today. That's ${p.chances[0].text} of a night, and that is not normal. ${tail(p.chances, (c) => `${c.name} sits at ${c.text}`)}`,
        (p) => `I watch the street from the window and I don't like what I'm seeing. ${list(p.chances, (c) => `${c.name}, ${c.text}`)}.`,
      ],
      jittered: [
        (p) => `Baby, they came past ${p.chances[0].name} three times today. Feels like ${p.chances[0].text} to me. ${tail(p.chances, (c) => `${c.name}, maybe ${c.text}`, "Same story on ")}`,
        (p) => `Something's not right out there. ${list(p.chances, (c) => `${c.name} about ${c.text}`)}. That's just what I saw, don't make me worry.`,
      ],
    },
  },
  biniam: {
    block_vulnerability: {
      exact: [
        (p) => `Someone at the table last night said Curtis's guys were asking about your ${p.chances[0].name} spot. The way they talked, ${p.chances[0].text}. ${tail(p.chances, (c) => `${c.name} at ${c.text}`)}`,
        (p) => `The room talks after midnight and I listen. ${list(p.chances, (c) => `${c.name} sits at ${c.text}`)}. That's what was said.`,
      ],
      jittered: [
        (p) => `I heard something upstairs about ${p.chances[0].name}. Maybe ${p.chances[0].text}, the way it sounded. ${tail(p.chances, (c) => `${c.name}, around ${c.text}`, "They said something about ")}`,
        (p) => `Don't take this as more than it is. ${list(p.chances, (c) => `${c.name} around ${c.text}`)}. People drink and they talk, so.`,
      ],
    },
  },
  // v1.30. Tone gives you the fact and stops - the same register gossip.js
  // named in v1.23, and the one his page has carried since v1.18. No hedging,
  // no reassurance, no adjectives. He reports headcount the way he reported the
  // sedan in the camera blind spot: what is there, how many, and then nothing.
  // The one thing he does at the end is ask about your people, because that is
  // the only place his voice ever softens.
  tone: {
    territory_status: {
      exact: [
        (p) => `Walked them at first light. ${list(p.corners, (c) => `${c.name}: ${c.text}`)}.`,
        (p) => `Morning count. ${list(p.corners, (c) => `${c.name}: ${c.text}`)}. That's where you stand.`,
        (p) => `${list(p.corners, (c) => `${c.name}: ${c.text}`)}. Tell me who you want covered tonight.`,
      ],
    },
  },
};

// The line that comes back when the source has nothing to sell today. It is a
// real outcome, not an error: a plan with no corners on it means Curtis is not
// looking, and a player who paid to hear that has bought a true answer.
const EMPTY_LINES = {
  dre: "Nothing moving on your corners tonight. That's worth knowing too.",
  mina: "I asked around. Nobody's saying anything about your spots. That's good, right?",
  juan: "Quiet out there today. Nothing worth calling about.",
  yalonda: "Nobody's been by today. It's been quiet, thank God.",
  biniam: "The room was quiet last night. Nobody said anything about you.",
  tone: "You don't hold any corners. Nothing to walk. Say the word when that changes.",
};

function hasVoice(npcId, intelType, accuracy) {
  return Array.isArray(VOICES[npcId]?.[intelType]?.[accuracy]);
}

// The one entry point the reducer calls. `payload` is already shaped and
// already jittered; `rotation` is the day-stable hash that picks the variant.
// Returns null rather than throwing on an unauthored combination, so a table
// row without a matching voice can only ever mean no message, never a crash.
function disclosureText(npcId, intelType, accuracy, payload, rotation) {
  if (payload && payload.empty) return EMPTY_LINES[npcId] || null;
  if (!hasVoice(npcId, intelType, accuracy)) return null;
  const variants = VOICES[npcId][intelType][accuracy];
  // Trimmed because `tail` collapses to "" for a player holding one corner,
  // which would otherwise leave a line ending in a space.
  return variants[Math.abs(Number(rotation) || 0) % variants.length](payload).replace(/\s+/g, " ").trim();
}

module.exports = {
  INTEL_TYPES,
  INTEL_TYPE_BY_ID,
  INTEL_TYPE_IDS,
  DISCLOSURES,
  DISCLOSURE_NPC_IDS,
  DISCLOSURE_SENDERS,
  LIST_SHAPES,
  VOICES,
  EMPTY_LINES,
  disclosureFor,
  disclosuresForNpc,
  priceFor,
  senderFor,
  accuracyFor,
  resolvedAccuracy,
  jitterChance,
  jitterWeight,
  jitterList,
  listShape,
  joinNames,
  percent,
  list,
  tail,
  hasVoice,
  disclosureText,
};
