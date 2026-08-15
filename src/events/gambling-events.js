// Playing out a hand of Tonk and a round of Cee-lo.
//
// IMPORTANT: this module may require src/data/* and src/systems/attributes.js
// and nothing else. It must never require game-core.js, and it must never call
// Math.random or draw from run.rngState. Everything here is pure: it takes a
// state to read and returns a description of what happened. The reducer applies
// it.
//
// The division of labour worth stating once: src/data/gambling.js knows the
// rules of the games, this file knows how a round of them plays against the
// attribute system, and game-core.js knows how to charge for it and who finds
// out. Nothing in the first two files can see a player's cash.

const Gambling = require("../data/gambling.js");
const Attributes = require("../systems/attributes.js");
const { ADVANTAGE_THRESHOLD, CATASTROPHE_IMMUNITY_THRESHOLD } = require("../data/attributes.js");

// ---------------------------------------------------------------------------
// What the attribute buys you
// ---------------------------------------------------------------------------

// The information tiers, stated once so the UI and the tests read the same
// table. Note what is NOT here: no tier changes a card, a die, or a payout. A
// high attribute buys a better look at the table, never a better table.
//
// The thresholds are the same 3 and 6 the whole attribute system turns on, so a
// player who has learned what "Solid" means at the gym already knows what it
// means at the card table.
const TONK_TIERS = { tells: ADVANTAGE_THRESHOLD, estimates: CATASTROPHE_IMMUNITY_THRESHOLD };
const CELO_TIERS = { odds: ADVANTAGE_THRESHOLD, exact: CATASTROPHE_IMMUNITY_THRESHOLD };

function tonkVision(charisma) {
  const value = Number(charisma) || 0;
  return {
    // 0-2: they play, you watch, and you learn nothing you did not bring.
    tells: value >= TONK_TIERS.tells,
    estimates: value >= TONK_TIERS.estimates,
  };
}

function celoVision(intelligence) {
  const value = Number(intelligence) || 0;
  return {
    odds: value >= CELO_TIERS.odds,
    exact: value >= CELO_TIERS.exact,
    // Press and back off arrive with the exact number, because pressing on a
    // feeling is not a decision, it is a mood.
    canAdjust: value >= CELO_TIERS.exact,
  };
}

// ---------------------------------------------------------------------------
// Tonk
// ---------------------------------------------------------------------------

// Deal a table. The player is always seat 0.
function dealTonk(seed, day, gameCount, opponentCount) {
  const seats = Math.max(2, Math.min(4, opponentCount + 1));
  const deck = Gambling.shuffledDeck(seed, day, gameCount);
  const hands = [];
  let cursor = 0;
  for (let seat = 0; seat < seats; seat += 1) {
    hands.push(deck.slice(cursor, cursor + Gambling.TONK_HAND_SIZE));
    cursor += Gambling.TONK_HAND_SIZE;
  }
  const discard = [deck[cursor]];
  const stock = deck.slice(cursor + 1);
  return {
    hands,
    stock,
    discard,
    styles: Gambling.opponentStyles(seed, day, gameCount, seats - 1),
    turn: 0,
    seats,
  };
}

// What the player is allowed to see about the other seats this turn.
//
// The tell is real information, not flavour: an opponent "hesitates" exactly
// when their hand is within a few points of the value their style drops at, so
// a player reading a hesitation and dropping first is making a correct play with
// incomplete information. That is the whole design goal.
const TELL_WINDOW = 6;

const ESTIMATE_BANDS = [
  { floor: 25, label: "looks lost" },
  { floor: 15, label: "looks patient" },
  { floor: 8, label: "looks confident" },
  { floor: 0, label: "looks ready" },
];

function estimateLabel(value) {
  const band = ESTIMATE_BANDS.find((entry) => value >= entry.floor);
  return band ? band.label : ESTIMATE_BANDS[ESTIMATE_BANDS.length - 1].label;
}

// The read itself is a roll, and that is the point: a player who has earned the
// tells does not get an oracle, they get a read that is usually right. A
// catastrophic read shows the tell BACKWARDS - the man who is one card from
// dropping looks comfortable. That is what makes Charisma 6 worth having, since
// it takes the catastrophic tier off the table entirely rather than nudging a
// percentage the player cannot see.
//
// Keyed on the seed, the day and the seat, never drawn from run.rngState, so a
// replayed hand reads the same table the same way.
function readOpponents(table, charisma, seed) {
  const vision = tonkVision(charisma);
  return table.styles.map((style, index) => {
    const seat = index + 1;
    const value = Gambling.handValue(table.hands[seat]);
    const close = value <= style.dropAt + TELL_WINDOW;
    // The quiet one gives almost nothing away regardless of how well you read.
    // That is a fact about him, and learning it is its own reward.
    const telegraphs = style.tell >= 0.5;
    let hesitates = false;
    if (vision.tells && telegraphs) {
      const pool = Attributes.buildOutcomePool("tonk_read", style.tell);
      const outcome = Attributes.resolveWithAttribute(pool, charisma, `${seed}:tonk:read:${table.gameIndex}:${seat}`);
      const tier = outcome ? outcome.tier : "failure";
      // A clean or messy read reports what is actually there. A plain failure
      // reports nothing. A catastrophe reports the opposite.
      if (Attributes.isSuccessTier(tier)) hesitates = close;
      else if (tier === "catastrophic") hesitates = !close;
    }
    return {
      seat,
      style: style.id,
      label: style.label,
      hesitates,
      estimate: vision.estimates ? estimateLabel(value) : null,
    };
  });
}

// Everybody else's turn, resolved in seat order. Deterministic given the table.
function runOpponentTurns(table) {
  const events = [];
  let dropper = null;
  for (let seat = 1; seat < table.seats; seat += 1) {
    const style = table.styles[seat - 1];
    const hand = table.hands[seat];
    const decision = Gambling.opponentTurn(hand, table.discard[table.discard.length - 1], style);
    if (decision.drawFromDiscard && table.discard.length) {
      hand.push(table.discard.pop());
    } else if (table.stock.length) {
      hand.push(table.stock.shift());
    }
    const pitched = Gambling.opponentDiscard(hand, style);
    hand.splice(hand.indexOf(pitched), 1);
    table.discard.push(pitched);
    events.push({ seat, drew: decision.drawFromDiscard ? "discard" : "stock", discarded: pitched.id });
    if (Gambling.handValue(hand) === 0) { dropper = seat; events.push({ seat, tonk: true }); break; }
    if (decision.dropIntent) { dropper = seat; events.push({ seat, dropped: true }); break; }
  }
  return { events, dropper };
}

// Settle a finished hand and say what it was worth in growth.
function resolveTonk({ table, dropper, buyIn }) {
  const tonk = Gambling.handValue(table.hands[dropper]) === 0;
  const settlement = Gambling.settleTonk({ dropper, hands: table.hands, buyIn, tonk });
  return {
    ...settlement,
    playerWon: settlement.winner === 0,
    handValues: table.hands.map((hand) => Gambling.handValue(hand)),
  };
}

// The social reading is the growth, win or lose. Winning adds a little on top,
// because handling a win in that room is its own skill.
const TONK_WIN_BONUS = 0.1;
const CELO_SMART_PRESS_BONUS = 0.15;

function tonkGrowth(state, sessions, playerWon) {
  const base = Attributes.growthFor(state, "tonk_game", sessions);
  if (!base) return null;
  return { ...base, growth: base.growth + (playerWon ? TONK_WIN_BONUS : 0) };
}

// ---------------------------------------------------------------------------
// Cee-lo
// ---------------------------------------------------------------------------

// The bank sets a point, then the player answers it. Both throws are hashed off
// the run seed and the round number, so a replayed day rolls the same dice.
function openCeloRound(seed, day, round) {
  const banker = Gambling.establishPoint(seed, `bank:${day}:${round}`);
  const odds = banker.reading.kind === "no_result" ? null : Gambling.winProbability(banker.reading);
  return { banker: banker.reading, attempts: banker.attempts, odds };
}

// What the player is told before deciding whether to press.
//
// The middle band is a read and can be wrong. At Intelligence 3-5 the phrase is
// an estimate produced by a roll, so a bad night at the table can hand the
// player "better than even" on a point that is nothing of the sort. At 6+ the
// catastrophic tier is gone and the exact number is shown, which is the whole
// argument for getting good: certainty, not a bigger edge.
function celoBriefing(round, intelligence, seed) {
  const vision = celoVision(intelligence);
  if (!round.odds) return { vision, probability: null, label: null, misread: false };
  const exact = Math.round(round.odds.probability * 1000) / 1000;
  if (vision.exact) return { vision, probability: exact, label: Gambling.describeOdds(round.odds.probability), misread: false };
  if (!vision.odds) return { vision, probability: null, label: null, misread: false };
  const pool = Attributes.buildOutcomePool("celo_read", round.odds.probability);
  const outcome = Attributes.resolveWithAttribute(pool, intelligence, `${seed}:celo:read:${round.roundIndex}`);
  const tier = outcome ? outcome.tier : "failure";
  // A catastrophe reads the table upside down: the odds come back inverted.
  const shown = tier === "catastrophic" ? 1 - round.odds.probability : round.odds.probability;
  return {
    vision,
    probability: null,
    label: Gambling.describeOdds(shown),
    misread: tier === "catastrophic",
  };
}

function resolveCelo({ seed, day, round, bankerReading, bet }) {
  const player = Gambling.establishPoint(seed, `player:${day}:${round}`);
  const settlement = Gambling.settleCelo({ bankerReading, playerReading: player.reading, bet });
  return { ...settlement, player: player.reading, attempts: player.attempts };
}

// A smart press is the one thing in either game that rewards playing well rather
// than playing often: doubling into odds below even and taking it down.
function celoGrowth(state, sessions, { won, pressed, probability }) {
  const base = Attributes.growthFor(state, "celo_game", sessions);
  if (!base) return null;
  const smart = won && pressed && Number(probability) > 0 && Number(probability) < 0.5;
  return { ...base, growth: base.growth + (smart ? CELO_SMART_PRESS_BONUS : 0) };
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

// The observation footprint of a session's net. Delegates the thresholds to the
// rules module so there is exactly one place the numbers live, and re-tags every
// row with The Nile so Selam's location lens and the isolation test both see it.
function sessionObservations(net, locationId) {
  return Gambling.gamblingObservations(net).map((row) => ({ ...row, location: locationId }));
}

module.exports = {
  TONK_TIERS,
  CELO_TIERS,
  tonkVision,
  celoVision,
  dealTonk,
  TELL_WINDOW,
  ESTIMATE_BANDS,
  estimateLabel,
  readOpponents,
  runOpponentTurns,
  resolveTonk,
  TONK_WIN_BONUS,
  CELO_SMART_PRESS_BONUS,
  tonkGrowth,
  openCeloRound,
  celoBriefing,
  resolveCelo,
  celoGrowth,
  sessionObservations,
};
