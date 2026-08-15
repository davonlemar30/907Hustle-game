// Tonk and Cee-lo: the actual rules, played for real.
//
// IMPORTANT: this module may require src/events/random.js and nothing else. It
// must never require game-core.js, and it must never call Math.random or draw
// from run.rngState - every card and every die is hashed off the run seed so a
// replayed day deals the same hand. The reducer in game-core.js owns every
// write; everything here is pure.
//
// The design constraint from the build prompt is the one worth restating: these
// are games, not stat checks with animation. A player makes real decisions - which
// card to keep, when to drop, whether to press a bad point - and the attribute
// decides how much information those decisions are made with, never what the
// cards are. That split is what keeps a Green player's win a real win.

const { stringHash, seededShuffle, makeRandom } = require("../events/random.js");

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const SUITS = ["S", "H", "D", "C"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

// Tonk counts face cards at 10 and the ace low at 1. This is the scoring that
// matters: your hand value is what you are trying to drive to zero, and it is
// what decides who wins when somebody drops.
const RANK_VALUES = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 10, Q: 10, K: 10 };

// Sequence position, separate from value, because a run is A-2-3 and not
// A-J-Q even though J and Q share a value with 10.
const RANK_ORDER = Object.fromEntries(RANKS.map((rank, index) => [rank, index]));

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ id: `${rank}${suit}`, rank, suit, value: RANK_VALUES[rank] });
  }
  return deck;
}

// Fisher-Yates through the shared seeded shuffle, keyed on the run seed plus the
// day and how many games have already been played. Two games on the same day
// deal differently; the same game on a replayed day deals identically.
function shuffledDeck(seed, day, gameCount) {
  return seededShuffle(buildDeck(), seed, stringHash(`tonk:${day}:${gameCount}`));
}

const TONK_HAND_SIZE = 5;

// ---------------------------------------------------------------------------
// Tonk: spreads, runs, and hand value
// ---------------------------------------------------------------------------

// A spread is three or more of the same rank. A run is three or more sequential
// cards in one suit. Both leave your hand, which is how a hand gets to zero.
function findSpreads(cards) {
  const byRank = {};
  for (const card of cards) (byRank[card.rank] = byRank[card.rank] || []).push(card);
  return Object.values(byRank).filter((group) => group.length >= 3);
}

function findRuns(cards) {
  const runs = [];
  for (const suit of SUITS) {
    const inSuit = cards.filter((card) => card.suit === suit).sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
    let current = [];
    for (const card of inSuit) {
      const previous = current[current.length - 1];
      if (previous && RANK_ORDER[card.rank] === RANK_ORDER[previous.rank] + 1) current.push(card);
      else current = [card];
      if (current.length >= 3) {
        // Replace the shorter prefix of the same run rather than recording both.
        if (runs.length && runs[runs.length - 1][0] === current[0]) runs[runs.length - 1] = current.slice();
        else runs.push(current.slice());
      }
    }
  }
  return runs;
}

// Every card that can be laid down, counted once even when it belongs to both a
// spread and a run.
function meldedCards(cards) {
  const melded = new Set();
  for (const group of [...findSpreads(cards), ...findRuns(cards)]) {
    for (const card of group) melded.add(card.id);
  }
  return melded;
}

// What the hand is worth right now: the cards you could not lay down. Zero is a
// Tonk, and it pays double from everyone at the table.
function handValue(cards) {
  const melded = meldedCards(cards);
  return cards.reduce((total, card) => (melded.has(card.id) ? total : total + card.value), 0);
}

function describeHand(cards) {
  const spreads = findSpreads(cards);
  const runs = findRuns(cards);
  return {
    value: handValue(cards),
    spreads: spreads.map((group) => group.map((card) => card.id)),
    runs: runs.map((group) => group.map((card) => card.id)),
    canDrop: true,
  };
}

// ---------------------------------------------------------------------------
// Tonk: opponents
// ---------------------------------------------------------------------------

// Three play styles, assigned by seed so a table has texture rather than three
// copies of the same bot. `dropAt` is the hand value each will call at, and
// `tell` is how loudly they telegraph being close - which is exactly what the
// player's Charisma buys a look at.
const TONK_STYLES = [
  { id: "aggressive", label: "the trucker", dropAt: 18, tell: 0.8, discardsHigh: true },
  { id: "conservative", label: "the quiet one", dropAt: 8, tell: 0.25, discardsHigh: true },
  { id: "erratic", label: "the loud one", dropAt: 25, tell: 0.6, discardsHigh: false },
];

const TONK_STYLE_BY_ID = Object.fromEntries(TONK_STYLES.map((style) => [style.id, style]));

function opponentStyles(seed, day, gameCount, count) {
  const rotated = seededShuffle(TONK_STYLES, seed, stringHash(`tonk:styles:${day}:${gameCount}`));
  return rotated.slice(0, Math.max(1, Math.min(TONK_STYLES.length, count)));
}

// An opponent's turn is deterministic given its hand and style: take the discard
// if it lowers the hand, otherwise draw, then pitch the least useful card. No
// randomness, which means an opponent never gets luckier than its cards.
function opponentTurn(hand, discardTop, style) {
  const withDiscard = discardTop ? [...hand, discardTop] : hand;
  const drawFromDiscard = !!discardTop && handValue(withDiscard) < handValue(hand);
  return { drawFromDiscard, dropIntent: handValue(hand) <= style.dropAt };
}

// Which card an opponent pitches: the highest-value unmelded card for the styles
// that play the odds, the lowest for the one that does not.
function opponentDiscard(hand, style) {
  const melded = meldedCards(hand);
  const loose = hand.filter((card) => !melded.has(card.id));
  const pool = loose.length ? loose : hand;
  const sorted = pool.slice().sort((a, b) => b.value - a.value);
  return style.discardsHigh ? sorted[0] : sorted[sorted.length - 1];
}

// ---------------------------------------------------------------------------
// Tonk: settlement
// ---------------------------------------------------------------------------

const TONK_MIN_BUY_IN = 10;
const TONK_MAX_BUY_IN = 50;

// Biniam takes 10% of pots over $50. It is his room and his coffee.
const HOUSE_RAKE_FLOOR = 50;
const HOUSE_RAKE = 0.1;

function rakeFor(pot) {
  return pot > HOUSE_RAKE_FLOOR ? Math.floor(pot * HOUSE_RAKE) : 0;
}

// Drop with the lowest hand and you take the pot. Drop without it and you pay
// double your buy-in to the player who actually had it. A hand of exactly zero
// is a Tonk and pays double from everyone.
function settleTonk({ dropper, hands, buyIn, tonk }) {
  const values = hands.map((hand, seat) => ({ seat, value: handValue(hand) }));
  const lowest = values.reduce((best, entry) => (entry.value < best.value ? entry : best), values[0]);
  const pot = buyIn * hands.length;
  if (tonk) {
    const winnings = buyIn * 2 * (hands.length - 1);
    return { winner: dropper, tonk: true, caught: false, pot, rake: rakeFor(winnings), payout: winnings - rakeFor(winnings) };
  }
  const caught = lowest.seat !== dropper;
  if (caught) {
    // The dropper pays double. They are out their buy-in plus that penalty.
    return { winner: lowest.seat, tonk: false, caught: true, pot, rake: 0, payout: -(buyIn * 2) };
  }
  const rake = rakeFor(pot);
  return { winner: dropper, tonk: false, caught: false, pot, rake, payout: pot - rake - buyIn };
}

// ---------------------------------------------------------------------------
// Cee-lo
// ---------------------------------------------------------------------------

const CELO_MIN_BUY_IN = 20;
const CELO_MAX_BUY_IN = 100;
const CELO_MAX_ROLLS = 3;

// Three dice from one key.
//
// The obvious implementation - hash `${key}:0`, `${key}:1`, `${key}:2` and take
// each mod 6 - is badly broken, and it took a playtest to notice rather than a
// unit test, because every rules test used hand-built dice. stringHash is FNV-1a,
// which xors the byte and multiplies: two keys differing only in their LAST
// character land in neighbouring regions of the output, so the three dice came
// out near-consecutive. Measured, that produced 1-2-3 at 14% against a true 2.8%
// and a real point at 0.8% against a true 41.7%. The house was not rigged, but
// the dice were.
//
// The fix is to hash the key ONCE and use it to seed the xorshift generator the
// rest of the codebase already trusts, then draw three independent values -
// exactly what seededShuffle does. Still keyed on a string and still replay
// stable; just no longer reading correlated bits off three adjacent hashes.
function rollDice(seed, key) {
  const random = makeRandom(stringHash(`${seed}:celo:${key}`));
  return [random.int(1, 6), random.int(1, 6), random.int(1, 6)].sort((a, b) => a - b);
}

// A single die, for callers that want one value rather than a throw.
function rollDie(seed, key) {
  return makeRandom(stringHash(`${seed}:celo:${key}`)).int(1, 6);
}

// The combination table, in the order the street reads them.
//
//   4-5-6   instant win
//   trips   instant win
//   1-2-3   instant loss
//   pair    the odd die is your point
//   none    no result, roll again (three tries, then pass the bank)
function readDice(dice) {
  const sorted = dice.slice().sort((a, b) => a - b);
  const [low, mid, high] = sorted;
  if (low === 4 && mid === 5 && high === 6) return { kind: "instant_win", point: 7, dice: sorted };
  if (low === 1 && mid === 2 && high === 3) return { kind: "instant_loss", point: 0, dice: sorted };
  if (low === mid && mid === high) return { kind: "trips", point: 6 + low, dice: sorted, trip: low };
  if (low === mid) return { kind: "point", point: high, dice: sorted };
  if (mid === high) return { kind: "point", point: low, dice: sorted };
  return { kind: "no_result", point: null, dice: sorted };
}

// Trips beat any point and beat each other by rank, 4-5-6 beats everything, so a
// single comparable number keeps settlement to one comparison. Points are 1-6,
// trips are 7-12, 4-5-6 is 7 as well by convention but wins on kind first.
function celoRank(reading) {
  if (!reading) return -1;
  if (reading.kind === "instant_win") return 100;
  if (reading.kind === "trips") return 50 + reading.trip;
  if (reading.kind === "instant_loss") return -1;
  if (reading.kind === "point") return reading.point;
  return 0;
}

// Roll until the dice say something or three tries are up.
function establishPoint(seed, key) {
  const attempts = [];
  for (let roll = 0; roll < CELO_MAX_ROLLS; roll += 1) {
    const reading = readDice(rollDice(seed, `${key}:${roll}`));
    attempts.push(reading);
    if (reading.kind !== "no_result") return { reading, attempts };
  }
  return { reading: attempts[attempts.length - 1], attempts };
}

// Exact odds of beating a given banker point, computed off the full 216-outcome
// space rather than approximated. This is what Intelligence 6+ shows the player,
// and what the 3-5 band rounds into a phrase.
function winProbability(bankerReading) {
  const bankerRank = celoRank(bankerReading);
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  for (let a = 1; a <= 6; a += 1) {
    for (let b = 1; b <= 6; b += 1) {
      for (let c = 1; c <= 6; c += 1) {
        const reading = readDice([a, b, c]);
        if (reading.kind === "no_result") { pushes += 1; continue; }
        const rank = celoRank(reading);
        if (rank > bankerRank) wins += 1;
        else if (rank < bankerRank) losses += 1;
        else pushes += 1;
      }
    }
  }
  const decided = wins + losses;
  return { wins, losses, pushes, probability: decided ? wins / decided : 0 };
}

// The phrase an Intelligence 3-5 player gets instead of the number.
const CELO_ODDS_BANDS = [
  { floor: 0.66, label: "strong odds" },
  { floor: 0.5, label: "better than even" },
  { floor: 0.34, label: "against you" },
  { floor: 0, label: "long odds" },
];

function describeOdds(probability) {
  const band = CELO_ODDS_BANDS.find((entry) => probability >= entry.floor);
  return band ? band.label : CELO_ODDS_BANDS[CELO_ODDS_BANDS.length - 1].label;
}

// Press doubles the bet, back off halves it. Both are Intelligence 6+ only, and
// both are decisions the player makes after seeing the banker's point - which is
// the whole reason the high band is worth having.
const PRESS_MULTIPLIER = 2;
const BACK_OFF_MULTIPLIER = 0.5;

function adjustedBet(bet, adjustment) {
  const base = Math.max(0, Math.floor(Number(bet) || 0));
  if (adjustment === "press") return base * PRESS_MULTIPLIER;
  if (adjustment === "back_off") return Math.max(1, Math.floor(base * BACK_OFF_MULTIPLIER));
  return base;
}

// Settle one challenger against the bank.
function settleCelo({ bankerReading, playerReading, bet }) {
  const bankerRank = celoRank(bankerReading);
  const playerRank = celoRank(playerReading);
  const stake = Math.max(0, Math.floor(Number(bet) || 0));
  if (playerRank > bankerRank) return { result: "win", payout: stake };
  if (playerRank < bankerRank) return { result: "loss", payout: -stake };
  return { result: "push", payout: 0 };
}

// ---------------------------------------------------------------------------
// Shared table rules
// ---------------------------------------------------------------------------

const MAX_GAMES_PER_DAY = 3;

// What the room notices. Winning quietly is invisible; winning loudly is not.
// None of these carry the network channel and none ever will - see the isolation
// test in tests/v1-11.test.js. The Nile staying off Curtis's radar is the whole
// strategic point of the location.
const GAMBLING_PROFIT_NEIGHBORHOOD = 50;
const GAMBLING_PROFIT_HOUSEHOLD = 100;
const GAMBLING_LOSS_HOUSEHOLD = 100;

function gamblingObservations(net) {
  const delta = Math.round(Number(net) || 0);
  const out = [];
  if (delta >= GAMBLING_PROFIT_NEIGHBORHOOD) {
    out.push({ type: "financial", event: "gambling_profit", channel: "neighborhood", value: delta });
    if (delta >= GAMBLING_PROFIT_HOUSEHOLD) {
      out.push({ type: "financial", event: "gambling_profit", channel: "household", value: delta });
    }
  } else if (-delta >= GAMBLING_LOSS_HOUSEHOLD) {
    out.push({ type: "financial", event: "gambling_loss", channel: "household", value: delta });
  }
  return out;
}

module.exports = {
  SUITS,
  RANKS,
  RANK_VALUES,
  RANK_ORDER,
  buildDeck,
  shuffledDeck,
  TONK_HAND_SIZE,
  findSpreads,
  findRuns,
  meldedCards,
  handValue,
  describeHand,
  TONK_STYLES,
  TONK_STYLE_BY_ID,
  opponentStyles,
  opponentTurn,
  opponentDiscard,
  TONK_MIN_BUY_IN,
  TONK_MAX_BUY_IN,
  HOUSE_RAKE_FLOOR,
  HOUSE_RAKE,
  rakeFor,
  settleTonk,
  CELO_MIN_BUY_IN,
  CELO_MAX_BUY_IN,
  CELO_MAX_ROLLS,
  rollDie,
  rollDice,
  readDice,
  celoRank,
  establishPoint,
  winProbability,
  CELO_ODDS_BANDS,
  describeOdds,
  PRESS_MULTIPLIER,
  BACK_OFF_MULTIPLIER,
  adjustedBet,
  settleCelo,
  MAX_GAMES_PER_DAY,
  GAMBLING_PROFIT_NEIGHBORHOOD,
  GAMBLING_PROFIT_HOUSEHOLD,
  GAMBLING_LOSS_HOUSEHOLD,
  gamblingObservations,
};
