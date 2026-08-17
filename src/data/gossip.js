// What the block says out loud, and who says it (v1.23).
//
// The Exposure system has always been one-directional: observations flow from
// the player into NPC ledgers, and the ledger decides what content unlocks.
// This file is the return path. Twice now the neighborhood knows something the
// player would want to know - Curtis's people are working a corner tonight, and
// the police swept a corner last night - and whether that reaches the player is
// a relationship question. Warm and above, somebody picks up the phone. Neutral
// and below, nobody does, and the player meets the night cold.
//
// The silence is the mechanic. There is no predicate for it and no negative
// branch anywhere in the delivery path: an NPC below Warm simply is not in the
// candidate set, so nothing is sent. That is what makes the social layer worth
// something to a player who was treating it as flavor - the warning is the
// receipt for a week of showing up.
//
// Nothing here reads or writes game state, and nothing here may require
// game-core.js. Voices only; the routing lives in src/exposure/engine.js and
// the timing in src/data/territory.js.

// The two events that carry a voice. Both ride `territory` observations, which
// every lens scores at zero - see npc-lenses.js for why that is deliberate.
const GOSSIP_WARNING_EVENT = "curtis_move_planned";
const GOSSIP_RAID_EVENT = "police_swept_corner";

// Who can pass something on, and what they sound like doing it.
//
// Membership here is the authored half of eligibility; the routing half (on the
// neighborhood channel, and reachable in the corner's district) is checked
// against propagation.js at emission, so nobody can be given a line they have no
// way to have heard. Curtis is absent because he is not on the neighborhood
// channel at all and `territory` does not clear his network filter either -
// this is the block reacting to his people moving, not a report to him. Selam is
// absent for a plainer reason: she has never been written speaking about the
// corners, and giving her a line to fill a table would be the wrong Selam.
//
// Each voice is authored, not templated. Yalonda asks if you are okay because
// that is the only thing she wants to know; Tone gives you the fact and stops;
// Pherris tells you what her people asked and lets you draw the conclusion.
const GOSSIP_VOICES = {
  mina: {
    name: "Mina",
    [GOSSIP_WARNING_EVENT]: (corner) => `Heard talk at the Owl about ${corner}. Might want eyes on it tonight.`,
    [GOSSIP_RAID_EVENT]: (corner) => `Your spot on ${corner} got swept last night. Heard it from the regulars.`,
  },
  juan: {
    name: "Juan",
    [GOSSIP_WARNING_EVENT]: (corner) => `Word around the building, somebody's people been scouting ${corner}.`,
    [GOSSIP_RAID_EVENT]: (corner) => `Hey man, ${corner} caught a raid. You good?`,
  },
  yalonda: {
    name: "Yalonda",
    [GOSSIP_WARNING_EVENT]: (corner) => `Baby, be careful tonight. People been asking about ${corner}.`,
    [GOSSIP_RAID_EVENT]: (corner) => `Baby, I heard ${corner} got raided. Are you okay?`,
  },
  deshawn: {
    name: "Deshawn",
    [GOSSIP_WARNING_EVENT]: (corner) => `Yo, my people say Curtis got eyes on ${corner} tonight. Handle that.`,
    [GOSSIP_RAID_EVENT]: (corner) => `Block got swept. ${corner}. Wasn't nothing I could do from here.`,
  },
  tone: {
    name: "Tone",
    [GOSSIP_WARNING_EVENT]: (corner) => `Heads up. ${corner}'s getting looked at.`,
    [GOSSIP_RAID_EVENT]: (corner) => `${corner}. Cops hit it. Your people alright?`,
  },
  biniam: {
    name: "Biniam",
    [GOSSIP_WARNING_EVENT]: (corner) => `Heard something downstairs about ${corner}. Thought you should know.`,
    [GOSSIP_RAID_EVENT]: (corner) => `Heard about ${corner}. The police.`,
  },
  pherris: {
    name: "Pherris",
    [GOSSIP_WARNING_EVENT]: (corner) => `That corner on ${corner}? His people asking questions. Tonight.`,
    [GOSSIP_RAID_EVENT]: (corner) => `${corner} caught a sweep last night. FYI.`,
  },
};

const GOSSIP_VOICE_IDS = Object.keys(GOSSIP_VOICES);

// The Deshawn tier-2 rider. One shared clause rather than seven authored ones,
// because it is explicitly not the speaker's read - it is what Deshawn's people
// told them, arriving through whoever the player is closest to. Keeping it in
// one register makes that provenance legible instead of muddying seven voices.
const GOSSIP_PRESSURE_CLAUSE = {
  2: "Word is they're coming hard.",
  1: "Word is they're just looking.",
};

function hasVoice(npcId, event) {
  return typeof GOSSIP_VOICES[npcId]?.[event] === "function";
}

// How the text is signed. Authored next to the voice rather than pulled from a
// character registry, because the phone shows the name the player would have
// saved the number under - first names, the way the rest of the inbox reads.
function gossipSender(npcId) {
  return GOSSIP_VOICES[npcId]?.name || null;
}

// The line, plus the pressure rider when the caller has earned it. `pressure` is
// null for everyone without Deshawn at tier 2+, and the clause is appended
// rather than interpolated so an unrecognized weight can only ever mean the
// player gets the plain line.
function gossipText(npcId, event, cornerName, pressure = null) {
  if (!hasVoice(npcId, event)) return null;
  const line = GOSSIP_VOICES[npcId][event](cornerName);
  const rider = pressure == null ? null : GOSSIP_PRESSURE_CLAUSE[pressure];
  return rider ? `${line} ${rider}` : line;
}

module.exports = {
  GOSSIP_WARNING_EVENT,
  GOSSIP_RAID_EVENT,
  GOSSIP_VOICES,
  GOSSIP_VOICE_IDS,
  GOSSIP_PRESSURE_CLAUSE,
  hasVoice,
  gossipSender,
  gossipText,
};
