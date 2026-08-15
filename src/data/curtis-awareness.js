// Curtis crew ambient presence (v1.15).
//
// Before Curtis ever appears as a character, his people exist as unnamed
// watchers the player bumps into around Spenard. state.curtisAwareness tracks
// how visible the player has become to that network; this module owns the
// thresholds and the copy. The tracker is separate from Curtis's disposition
// ledger (what he feels) and from criminalProfile.districtAwareness (police
// difficulty) - awareness here is "how hard his people are looking".
//
// Data-module contract: no game-core require, pure data + pure functions.

const AWARENESS_MAX = 15;

// Phase floors. Once a phase is reached the level can decay, but never below
// that phase's threshold - once Curtis notices you, he does not fully forget.
const AWARENESS_PHASES = [
  { id: "approaching", at: 11 },
  { id: "watching", at: 7 },
  { id: "ambient", at: 3 },
  { id: "invisible", at: 0 },
];

function phaseForLevel(level) {
  for (const phase of AWARENESS_PHASES) {
    if (level >= phase.at) return phase.id;
  }
  return "invisible";
}

function phaseFloor(phaseId) {
  const phase = AWARENESS_PHASES.find((entry) => entry.id === phaseId);
  return phase ? phase.at : 0;
}

// Watcher encounter frequency: at most one per day, probability rises with
// awareness. 0.3 + level * 0.04, capped at 0.7.
function watcherChance(level) {
  return Math.min(0.7, 0.3 + level * 0.04);
}

// Ambient watcher copy per phase. Cycled without repeating any line within the
// last three encounters. These are UI flavor, not observations - nothing here
// touches a ledger.
const WATCHER_LINES = {
  ambient: [
    "A kid at the coffee shop watches you from the window. When you look back, he's on his phone.",
    "Same sedan you saw yesterday. Different driver. Engine running.",
    "The guy at the laundromat isn't doing laundry. He's been here twenty minutes with no basket.",
    "Someone at Night Owl asked Cal about you. Cal told you later. Didn't say who.",
  ],
  watching: [
    "A man you don't know nodded at you outside The Nile. Like he expected you.",
    "Word Around Town: 'somebody with money is paying for information about new faces.'",
    "Your phone buzzed. Unknown number, no message. Then a text from Juan: 'Be careful out there.'",
    "The Night Owl regular who asks too many questions wasn't there tonight. First time in weeks.",
  ],
  approaching: [
    "A woman you've never met called you by name outside the apartment building. Smiled and walked away.",
    "Goodie pulled you aside: 'Curtis knows your name. That's not the same as knowing you, but it's close.'",
    "A man in a black Carhartt was standing outside the gym when you left. He didn't follow you. He didn't need to.",
  ],
};

// One Word Around Town text per phase transition (not daily spam), delivered
// through the phone when the phase is reached.
const PHASE_MESSAGES = {
  watching: "Word Around Town: somebody's been asking about you at Night Owl. Paying for answers, not gossip.",
  approaching: "Word Around Town: Curtis's people stopped asking questions about you. That means they think they have the answers.",
};

// Actions that count as "moving through Spenard" for watcher encounters:
// wandering, exploring, entering locations. Deliberately not the criminal
// actions themselves - watchers appear during ordinary movement, which is what
// makes them unsettling.
const WATCHER_ELIGIBLE_REASONS = [
  "WANDER_SPENARD", "EXPLORE_SPENARD", "VISIT_NIGHT_OWL", "TRAVEL", "BUS_TRAVEL", "WALK_HOME",
  "VISIT_BASE", "TRAIN_ATTRIBUTE", "NILE_COFFEE", "NILE_WELLNESS", "CONTACT_VISIT",
];

module.exports = {
  AWARENESS_MAX,
  AWARENESS_PHASES,
  WATCHER_LINES,
  PHASE_MESSAGES,
  WATCHER_ELIGIBLE_REASONS,
  phaseForLevel,
  phaseFloor,
  watcherChance,
};
