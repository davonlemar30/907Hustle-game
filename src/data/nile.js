// The Nile: two floors, two siblings, one building.
//
// IMPORTANT: this module is data. It may require src/data/disposition-bands.js
// and nothing else - no game-core, no engine. The reducer reads these tables and
// owns every write.
//
// From the street it is a two-story professional center on Spenard Road between
// Northern Lights and Benson, sharing a lot with a tax prep office and a closed
// pet groomer. A blue neon sign reads "Blue Nile Wellness" in cursive. The
// Tesfaye family owns it outright. Selam runs a legitimate wellness practice
// downstairs; Biniam runs dice and cards upstairs behind a hookah lounge front.
//
// The mechanically load-bearing fact about this building: Curtis's network does
// not reach it. Biniam does not allow street beef in his father's building and
// the room is culturally self-policing, so a player under rival pressure can
// build social capital here without feeding the attention system. Every
// broadcast in this file's orbit uses household, neighborhood, or direct - never
// network. tests/v1-11.test.js asserts that rather than trusting it.

const { BANDS } = require("./disposition-bands.js");

const NILE_LOCATION_ID = "the_nile";

// Ground floor keeps daytime hours. The Den opens after six.
const WELLNESS_SLOTS = [0, 1, 2];
const DEN_SLOTS = [2, 3];

// Wellness service. Cheaper than the clinic, more pleasant, and available
// earlier than any other healing in the run.
const WELLNESS_COST = 30;
const WELLNESS_HEALTH = 15;

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

// Ground floor. Three paths, all wired; the build prompt's floor was two.
const DISCOVERY_METHODS = {
  board: "night_owl_board",
  juan: "juan_mention",
  wander: "spenard_wander",
};

// The wander roll ramps so a player who keeps walking always gets there. Same
// shape as the job-discovery ramp: a low base with a bump for every miss.
const WANDER_BASE_CHANCE = 0.05;
const WANDER_RAMP = 0.03;
const WANDER_MAX_CHANCE = 0.45;

function wanderChance(misses) {
  const count = Math.max(0, Math.floor(Number(misses) || 0));
  return Math.min(WANDER_MAX_CHANCE, WANDER_BASE_CHANCE + count * WANDER_RAMP);
}

// Juan mentions the place once he is Warm with the player. He knows Biniam
// through day labor.
const JUAN_MENTION_BAND = BANDS.WARM;

// Second floor. Not discoverable from the map and not from wandering - somebody
// has to vouch for you.
const DEN_ACCESS_METHODS = {
  selam: "selam_bridge",
  juan: "juan_vouch",
  regular: "night_owl_regular",
};

const SELAM_BRIDGE_BAND = BANDS.WARM;
const JUAN_VOUCH_BAND = BANDS.TRUSTED;
// Cal at the Night Owl. This is the path that used to open the abstract
// backroom game; it now opens the real one, ten feet from real Cee-lo.
const REGULAR_VOUCH_LEVEL = 2;

// The community board flyer, added to the Night Owl's rotation.
const BOARD_FLYER = {
  id: "blue_nile",
  title: "Blue Nile Wellness",
  body: "Steam, stones, and traditional bodywork on Spenard Road. Walk-ins welcome until eight.",
};

// ---------------------------------------------------------------------------
// Ambient
// ---------------------------------------------------------------------------

// Rotates by time of day and floor. Decorative - nothing here writes state.
const AMBIENT = {
  wellness: {
    0: [
      "Frankincense hits you at the door. The woman at the front desk smiles without looking up from her phone.",
      "Someone is running the steam generator in the back. The hallway is warm and smells like eucalyptus.",
    ],
    1: [
      "Steam curls under a treatment room door. Someone laughs inside, muffled.",
      "A framed photo of a mountain range you do not recognize. The colors are oversaturated.",
    ],
    2: [
      "The light through the front window has gone orange. A jebena is going somewhere out of sight.",
      "Two women talk over the front desk in a language you do not have. Neither one looks up.",
    ],
  },
  den: {
    2: [
      "The hookah haze sits at shoulder height. Someone's jebena bubbles on the charcoal.",
      "A TV mounted high is showing a match nobody is watching closely.",
      "Shoes are lined up at the edge of the raised platform. You add yours to the row.",
    ],
    3: [
      "Dice hit felt. Three languages react at once.",
      "Someone's phone rings and the whole table goes quiet until it stops.",
      "Through the floor, the wellness center's speaker blends with the TV commentary. Two kinds of distant.",
    ],
  },
};

function ambientFor(floor, slot, day) {
  const lines = (AMBIENT[floor] || {})[slot];
  if (!lines || !lines.length) return null;
  return lines[Math.abs(Number(day) || 0) % lines.length];
}

// ---------------------------------------------------------------------------
// Selam Tesfaye
// ---------------------------------------------------------------------------

// Voice: warm but economical. Professional register. No slang, no contractions.
// Amharic when stressed or affectionate - "ayzoh" (it is okay), "tiru" (good),
// "min tefeleg" (what do you want). She says what needs saying and returns to
// work. She never discusses her brother's business directly; she references it
// only through implication.
const SELAM_LINES = {
  [BANDS.HOSTILE]: "We are fully booked. I am sorry.",
  [BANDS.COLD]: "Thirty dollars for the steam room. Towels are by the door.",
  [BANDS.NEUTRAL]: "Thirty dollars for the steam room. Towels are by the door.",
  [BANDS.WARM]: "You are becoming a regular. That is good. Regulars get the good oil. My brother has people upstairs most evenings. Tell him I sent you.",
  [BANDS.TRUSTED]: "Ayzoh. Sit. You look like you have been carrying something heavy all week.",
  [BANDS.BONDED]: "Tiru. I saved you the room at the end, it is quieter. We will talk after.",
};

// Delivered by text at Trusted. She sees every man who walks through her door,
// and she remembers which ones watch the parking lot before they come in.
const SELAM_INTEL = [
  "A man was asking about someone matching your description at the corner store. Be careful.",
  "The police were parked on Spenard Road most of this morning. They are gone now. I thought you should know.",
  "One of my clients watches the other clients. I do not like that. Keep your business away from my door.",
];

// ---------------------------------------------------------------------------
// Biniam Tesfaye
// ---------------------------------------------------------------------------

// Voice: measured pace. No slang. Complete sentences. Imperative over request -
// he is a host, not a waiter. Amharic for emphasis only: "ishi" (understood),
// "endet" (how, what), "betam" (very, too much). He never threatens directly.
const BINIAM_LINES = {
  [BANDS.HOSTILE]: "Not tonight. Come back when you have thought about it.",
  [BANDS.COLD]: "Selam's brother? Have some coffee. Watch.",
  [BANDS.NEUTRAL]: "Sit down. Take the coffee. The Tonk table has room.",
  [BANDS.WARM]: "Second cup. The dice are running tonight if you want them.",
  [BANDS.TRUSTED]: "Third round. You are welcome here. There are people I want you to meet on a Saturday.",
  [BANDS.BONDED]: "Third round, and we should talk about something other than dice.",
};

// The coffee ceremony is decorative. Three rounds is the Ethiopian custom and
// the room reads it as standing: one cup means finish and go, three means you
// are welcome. Disposition drives access; the cups only show it.
function coffeeCups(band) {
  if (band >= BANDS.TRUSTED) return 3;
  if (band >= BANDS.WARM) return 2;
  return 1;
}

// Disposition to table access. Tonk is the audition; Cee-lo is earned. The
// Trusted tier is a hook with no content this build, by design.
const TONK_BAND = BANDS.NEUTRAL;
const CELO_BAND = BANDS.WARM;
const PRIVATE_BAND = BANDS.TRUSTED;

function tableAccess(band) {
  return {
    watch: true,
    tonk: band >= TONK_BAND,
    celo: band >= CELO_BAND,
    // Future content. Named so the UI can say "not yet" rather than hide it.
    privateGames: band >= PRIVATE_BAND,
    cups: coffeeCups(band),
  };
}

module.exports = {
  NILE_LOCATION_ID,
  WELLNESS_SLOTS,
  DEN_SLOTS,
  WELLNESS_COST,
  WELLNESS_HEALTH,
  DISCOVERY_METHODS,
  WANDER_BASE_CHANCE,
  WANDER_RAMP,
  WANDER_MAX_CHANCE,
  wanderChance,
  JUAN_MENTION_BAND,
  DEN_ACCESS_METHODS,
  SELAM_BRIDGE_BAND,
  JUAN_VOUCH_BAND,
  REGULAR_VOUCH_LEVEL,
  BOARD_FLYER,
  AMBIENT,
  ambientFor,
  SELAM_LINES,
  SELAM_INTEL,
  BINIAM_LINES,
  coffeeCups,
  TONK_BAND,
  CELO_BAND,
  PRIVATE_BAND,
  tableAccess,
};
