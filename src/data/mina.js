// Mina Vale: the Night Owl counter, and what it costs to get past it.
//
// IMPORTANT: this module is data. It may require src/data/disposition-bands.js
// and nothing else - no game-core, no engine. The reducer reads these tables
// and owns every write (game-core's pickMinaLine).
//
// Voice: Irish-American, measured, direct without being cold. Complete
// sentences, short ones. Contractions are hers; slang and filler are never.
// She omits more than she lies. Discomfort shows as work: the counter gets
// wiped, the register gets squared, the music gets adjusted. Amusement is one
// corner of her mouth. Anger goes quieter, never louder.
//
// The Night Owl keeps Evening and Night hours (districtActionAvailability,
// slots [2, 3] since v1.11 - unchanged here). So the time split lands where
// her day actually splits: on shift in the Evening she is quieter and
// professional, and late at Night the shop is her comfort zone and the warmth
// shows. The `early` pool also covers any earlier slot if hours ever widen.
//
// tests/v1-17.test.js asserts pool sizes, the band fallback, the no-repeat
// window, and the voice constraints (no dashes, no hidden-stat names, no
// intensifiers, under 20 words) rather than trusting this header.

const { BANDS } = require("./disposition-bands.js");

// Below Neutral she does not perform hostility - she goes formal. The
// transactional register already is her cold shoulder, so COLD and HOSTILE
// clamp up to the NEUTRAL pool instead of carrying pools of their own.
function minaBandKey(band) {
  return band > BANDS.NEUTRAL ? band : BANDS.NEUTRAL;
}

// One pool per disposition band, split by shift. `early` is the Evening
// register (slot 2 and anything earlier), `late` is Night (slot 3).
const MINA_LINES = {
  [BANDS.NEUTRAL]: {
    early: [
      '"What can I get you." It isn\'t a question. The register stays between you.',
      '"Drip\'s fresh. Pastries came in at six." She\'s already looking past you at the door.',
      "She takes the order, makes it, sets it down. Three motions, no spare words.",
    ],
    late: [
      '"Last pot of the night. It\'s stronger than it should be." She almost smiles about it.',
      '"We close at eleven." A beat. "The corner table\'s free until then."',
      "She wipes the counter in slow circles while your coffee brews. The shop answers questions for her.",
    ],
  },
  [BANDS.WARM]: {
    early: [
      "\"The usual?\" She's pouring before you answer.",
      "\"You're in early. Or you haven't slept.\" She doesn't push either way. The cup lands soft.",
      '"That car\'s been outside three nights now. Probably nothing." She says it to the espresso machine.',
    ],
    late: [
      '"Sit. You look like the day won." The good chair is somehow already clear.',
      '"The laundromat guy asked about you. I said you drink drip. Nothing else."',
      "\"One question. You don't have to answer it.\" She only ever spends the one.",
    ],
  },
  [BANDS.TRUSTED]: {
    early: [
      '"I moved here to stop being someone\'s daughter. Anchorage is far enough." She refills your cup unasked.',
      '"My family runs bars back east. The bars were never the business." She leaves it there.',
      "\"Two men sat in that corner an hour last night. They didn't drink. Watch yourself today.\"",
    ],
    late: [
      '"I keep the shop open late because quiet rooms scared me once. Now I sell them."',
      '"You remind me of my brother. That isn\'t a compliment yet." She holds the eye contact.',
      "\"Whatever you're into, it followed you here twice this week. I notice things. Family trait.\"",
    ],
  },
  [BANDS.BONDED]: {
    early: [
      "The good pastry is under the counter with your name on the bag. She doesn't mention it.",
      '"I was going to text you before close. You saved me the trouble."',
      "\"Kieran called again. I didn't answer.\" First time she's said the name. She watches you hold it.",
    ],
    late: [
      "\"Stay until I lock up. I'll drive you.\" She's never offered anyone the passenger seat.",
      "The back door's unlocked when you need somewhere quiet. She never announced it. You just know.",
      '"You know more about me than anyone in this state. Decide what that\'s worth to you."',
    ],
  },
};

// She reads the room before the order. A player who walks in marked by the
// week gets one of these instead of the band line - arrest reads first, then
// injury, then a pocket full of money, because that is the order she would
// notice them in.
const MINA_STATE_LINES = {
  arrested: [
    "She looks at your wrists first. Says nothing. The coffee arrives with two of the good sugars.",
    "\"Rough couple days.\" Told to the cup she's drying. The door chime sounds louder than usual.",
    '"You don\'t have to tell me. Everyone who came in already did." The cup lands gentle.',
  ],
  injured: [
    "Her eyes go to how you're standing. She pulls the near chair out with her foot.",
    "\"Ice or coffee first?\" She's already reaching under the counter for the first aid box.",
    "She sets the cup down slower than usual, like the sound might land on a bruise.",
  ],
  flush: [
    '"Big tipper tonight." She slides the bill back. "Money moves faster here than people think. Careful."',
    "You pay from a folded stack. She looks at you a half second longer than the coffee costs.",
    '"Whatever came in today, spend it boring." She counts your change exact and slow.',
  ],
};

// Thresholds the reducer reads. Arrest within two days is still on your face;
// under 40 health is visible across a counter; $800 in pocket money is more
// than the Night Owl sees in a shift.
const MINA_ARREST_RECENT_DAYS = 2;
const MINA_INJURED_HEALTH = 40;
const MINA_FLUSH_CASH = 800;

// No line repeats inside a three-visit window (the recentWatcherLines
// pattern: filter, fall back to the full pool when exhausted, keep the tail).
const MINA_RECENT_LIMIT = 3;

module.exports = {
  MINA_LINES,
  MINA_STATE_LINES,
  MINA_ARREST_RECENT_DAYS,
  MINA_INJURED_HEALTH,
  MINA_FLUSH_CASH,
  MINA_RECENT_LIMIT,
  minaBandKey,
};
