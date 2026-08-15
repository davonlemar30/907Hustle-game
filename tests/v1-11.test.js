// v1.11 — Attribute Growth Triangle + The Nile.
//
// Three contracts are pinned here and they are not the same kind of claim.
//
// 1. The games are real. Tonk scoring and Cee-lo combinations are asserted
//    against the rules directly, because "genuinely playable" is only a
//    meaningful promise if the rules are the actual rules.
// 2. Growth closes the triangle without opening a grind. Charisma and
//    Intelligence now have sources; none of them can carry a player to
//    Dangerous alone. The distribution question - how fast a Nile-focused week
//    climbs - lives in tests/attribute-balance.js, which is the right
//    instrument for it.
// 3. The Nile is quiet. Nothing that happens in that building reaches Curtis.
//    This is load-bearing for the whole location's strategic point, so it is
//    asserted rather than trusted to the channel table staying as it is.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const A = require("../src/systems/attributes.js");
const AD = require("../src/data/attributes.js");
const G = require("../src/data/gambling.js");
const GE = require("../src/events/gambling-events.js");
const N = require("../src/data/nile.js");
const { BANDS } = require("../src/data/disposition-bands.js");
const { putInBand } = require("./exposure-helpers.js");

function fresh(seed = 4242) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Tester" });
  state.run.openingPending = false;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  return state;
}

// Put the player in the building with both floors open and the day at Evening,
// which is the only slot where every Nile action is legal at once.
function atTheNile(seed = 4242, { cash = 500, slot = 2 } = {}) {
  const state = fresh(seed);
  state.world.locations.theNile.discovered = true;
  state.world.locations.theNile.secondFloorAccess = true;
  state.world.locations.gamblingKnown = true;
  state.player.cash = cash;
  state.player.cleanCash = cash;
  state.player.dirtyCash = 0;
  state.run.slot = slot;
  putInBand(state, "biniam", BANDS.WARM);
  return state;
}

// Put the run back at the top of a fresh slot with a full reserve. Several
// tests below play many actions in a row, and without this they run out of
// Energy and start silently no-opping - which would make them pass for the
// wrong reason rather than fail.
function readyAt(state, day, slot) {
  state.run.day = day;
  state.run.slot = slot;
  state.run.dayEndPending = false;
  state.run.overtimeArmed = false;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.daySummary = null;
  state.player.energy = 4;
  return state;
}

// 907List helpers, matching the shapes tests/v1-9b.test.js established.
function clear(state) {
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  state.run.daySummary = null;
  return state;
}

function settle907(state) {
  let next = state;
  for (let guard = 0; guard < 20; guard += 1) {
    if (next.run.openingPending) { next = C.reduceGame(next, { type: "DISMISS_OPENING" }); continue; }
    if (next.run.daySummary) { next = C.reduceGame(next, { type: "DISMISS_DAY_SUMMARY" }); continue; }
    if (next.run.pendingOperationResult) { next = C.reduceGame(next, { type: "ACKNOWLEDGE_OPERATION_RESULT" }); continue; }
    if (next.run.pendingEncounter) { next.run.pendingEncounter = null; continue; }
    if (next.run.pendingEvent) { next.run.pendingEvent = null; continue; }
    if (next.run.dayEndPending) { next = C.reduceGame(next, { type: "CONFIRM_END_DAY" }); continue; }
    break;
  }
  return next;
}

function funded907(seed, cash = 1200) {
  const state = fresh(seed);
  state.player.cash = cash;
  state.player.cleanCash = cash;
  state.player.dirtyCash = 0;
  state.knowledge.knows907List = true;
  state.nineZeroSevenList.known = true;
  return state;
}

function waitForBuyer907(state) {
  let next = settle907(state);
  for (let guard = 0; guard < 12; guard += 1) {
    if (next.nineZeroSevenList.pendingSells.some((entry) => entry.status === "ready")) return next;
    if (!next.nineZeroSevenList.pendingSells.length) return next;
    next = settle907(C.reduceGame(readyAt(next, next.run.day, next.run.slot), { type: "WANDER_SPENARD" }));
  }
  return next;
}

const card = (rank, suit) => ({ id: `${rank}${suit}`, rank, suit, value: G.RANK_VALUES[rank] });

// ---------------------------------------------------------------------------
// Tonk
// ---------------------------------------------------------------------------

test("a Tonk deal is five cards each off one 52-card deck with no duplicates", () => {
  const table = GE.dealTonk(99, 3, 0, 2);
  assert.equal(table.seats, 3);
  for (const hand of table.hands) assert.equal(hand.length, G.TONK_HAND_SIZE);
  const dealt = [...table.hands.flat(), ...table.discard, ...table.stock];
  assert.equal(dealt.length, 52, "every card is accounted for");
  assert.equal(new Set(dealt.map((entry) => entry.id)).size, 52, "no card is dealt twice");
});

test("spreads and runs are detected and leave the hand value behind", () => {
  // Three of a kind is a spread; the two loose cards are what you are holding.
  assert.equal(G.handValue([card("7", "S"), card("7", "H"), card("7", "D"), card("K", "C"), card("2", "S")]), 12);
  // Three sequential in one suit is a run. Same two loose cards, same 12.
  assert.equal(G.handValue([card("4", "S"), card("5", "S"), card("6", "S"), card("K", "C"), card("2", "H")]), 12);
  // Sequence is by rank order, not by value: J, Q, K all count 10 but only run
  // in that order, so 10-J-Q is a run and 10-10-J is not.
  assert.equal(G.findRuns([card("10", "H"), card("J", "H"), card("Q", "H")]).length, 1);
  assert.equal(G.findRuns([card("10", "H"), card("J", "H"), card("K", "H")]).length, 0);
  // Off-suit sequences are not runs.
  assert.equal(G.findRuns([card("4", "S"), card("5", "H"), card("6", "D")]).length, 0);
  // Nothing lays down, so you are holding all of it. Ace is low at 1.
  assert.equal(G.handValue([card("A", "S"), card("2", "H"), card("K", "C")]), 13);
});

test("a hand that lays down entirely is a Tonk and pays double from everyone", () => {
  const hand = [card("4", "S"), card("5", "S"), card("6", "S"), card("7", "S"), card("8", "S")];
  assert.equal(G.handValue(hand), 0, "a five-card run is worth nothing");
  const settled = G.settleTonk({ dropper: 0, hands: [hand, [card("K", "C")], [card("Q", "D")]], buyIn: 20, tonk: true });
  assert.equal(settled.tonk, true);
  // Two opponents at $20 each, doubled, is $80 before the house takes its cut.
  assert.equal(settled.payout + settled.rake, 80);
});

test("dropping with the lowest hand takes the pot and dropping without it pays double", () => {
  const low = [card("2", "S"), card("3", "H")];
  const high = [card("K", "S"), card("Q", "H")];
  const won = G.settleTonk({ dropper: 0, hands: [low, high], buyIn: 20, tonk: false });
  assert.equal(won.winner, 0);
  assert.equal(won.caught, false);
  const caught = G.settleTonk({ dropper: 0, hands: [high, low], buyIn: 20, tonk: false });
  assert.equal(caught.caught, true, "somebody had less");
  assert.equal(caught.winner, 1);
  assert.equal(caught.payout, -40, "the penalty is double the buy-in");
});

test("the house takes ten percent of a pot over fifty and nothing below it", () => {
  assert.equal(G.rakeFor(50), 0, "the floor is exclusive");
  assert.equal(G.rakeFor(51), 5);
  assert.equal(G.rakeFor(100), 10);
});

// ---------------------------------------------------------------------------
// Cee-lo
// ---------------------------------------------------------------------------

test("every Cee-lo combination reads the way the street reads it", () => {
  assert.equal(G.readDice([4, 5, 6]).kind, "instant_win");
  assert.equal(G.readDice([6, 4, 5]).kind, "instant_win", "order does not matter");
  assert.equal(G.readDice([1, 2, 3]).kind, "instant_loss");
  assert.equal(G.readDice([3, 3, 3]).kind, "trips");
  assert.equal(G.readDice([1, 3, 5]).kind, "no_result");
  // A pair leaves the odd die as your point, whichever side of the pair it is.
  assert.equal(G.readDice([2, 2, 5]).point, 5);
  assert.equal(G.readDice([6, 6, 2]).point, 2);
});

test("ranking puts 4-5-6 above trips, trips above points, and 1-2-3 below everything", () => {
  const rank = (dice) => G.celoRank(G.readDice(dice));
  assert.ok(rank([4, 5, 6]) > rank([6, 6, 6]), "four-five-six beats even the best trips");
  assert.ok(rank([6, 6, 6]) > rank([2, 2, 6]), "trips beat any point");
  assert.ok(rank([3, 3, 3]) < rank([5, 5, 5]), "trips rank against each other");
  assert.ok(rank([2, 2, 6]) > rank([3, 3, 5]), "a 6 point beats a 5 point");
  assert.ok(rank([1, 2, 3]) < rank([2, 2, 1]), "one-two-three loses to the worst point there is");
});

test("challenger settlement follows the ranking, including pushes", () => {
  const settle = (mine, theirs) => G.settleCelo({
    bankerReading: G.readDice(theirs), playerReading: G.readDice(mine), bet: 25,
  });
  assert.equal(settle([2, 2, 6], [3, 3, 5]).result, "win");
  assert.equal(settle([2, 2, 6], [3, 3, 5]).payout, 25);
  assert.equal(settle([3, 3, 5], [2, 2, 6]).result, "loss");
  assert.equal(settle([3, 3, 5], [2, 2, 6]).payout, -25);
  assert.equal(settle([2, 2, 5], [3, 3, 5]).result, "push", "equal points push");
  assert.equal(settle([4, 5, 6], [6, 6, 6]).result, "win", "instant win regardless");
  assert.equal(settle([1, 2, 3], [2, 2, 1]).result, "loss", "instant loss regardless");
});

test("win probability is computed off the real 216-outcome space", () => {
  // Against a 5 point the true figure is 29%, not the ~40% the build prompt used
  // as an illustration. The number shown to the player is the real one.
  const againstFive = G.winProbability(G.readDice([2, 2, 5]));
  assert.equal(againstFive.wins + againstFive.losses + againstFive.pushes, 216);
  assert.ok(Math.abs(againstFive.probability - 0.29) < 0.01, `expected ~29%, got ${againstFive.probability}`);
  // Nothing beats 4-5-6, and almost everything beats a 2.
  assert.equal(G.winProbability(G.readDice([4, 5, 6])).probability, 0);
  assert.ok(G.winProbability(G.readDice([6, 6, 2])).probability > 0.7);
});

test("press doubles and back off halves, and neither can go below a dollar", () => {
  assert.equal(G.adjustedBet(50, "press"), 100);
  assert.equal(G.adjustedBet(50, "back_off"), 25);
  assert.equal(G.adjustedBet(50, null), 50);
  assert.equal(G.adjustedBet(1, "back_off"), 1);
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("no gambling file reaches for Math.random, the RNG stream, or game-core", () => {
  for (const file of ["src/data/gambling.js", "src/events/gambling-events.js", "src/data/nile.js"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8")
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!source.includes("Math.random"), `${file} uses Math.random`);
    assert.ok(!source.includes("rngState"), `${file} draws from the RNG stream`);
    assert.ok(!/require\(["'][^"']*game-core/.test(source), `${file} requires game-core`);
  }
});

test("the dice are fair, which a rules test alone would never have caught", () => {
  // This is a distribution assertion rather than a rules one, and it exists
  // because the first implementation was badly biased and every rules test still
  // passed: they all used hand-built dice. Deriving three dice from keys that
  // differ only in their last character reads correlated bits out of FNV-1a, and
  // the throws came out near-consecutive - 1-2-3 at 14% against a true 2.8%.
  const SAMPLES = 60000;
  const kinds = {};
  const faces = {};
  for (let i = 0; i < SAMPLES; i += 1) {
    const dice = G.rollDice(999 + i, `fair:${i}`);
    for (const die of dice) faces[die] = (faces[die] || 0) + 1;
    const kind = G.readDice(dice).kind;
    kinds[kind] = (kinds[kind] || 0) + 1;
  }
  // Every face equally likely, within a point of 1/6.
  for (let face = 1; face <= 6; face += 1) {
    const share = faces[face] / (SAMPLES * 3);
    assert.ok(Math.abs(share - 1 / 6) < 0.01, `face ${face} came up ${(share * 100).toFixed(2)}%`);
  }
  // The true single-throw distribution over all 216 outcomes.
  const expected = { no_result: 0.5, point: 0.4167, instant_win: 0.0278, instant_loss: 0.0278, trips: 0.0278 };
  for (const [kind, target] of Object.entries(expected)) {
    const share = (kinds[kind] || 0) / SAMPLES;
    assert.ok(Math.abs(share - target) < 0.015, `${kind} came out ${(share * 100).toFixed(2)}%, expected ${(target * 100).toFixed(2)}%`);
  }
});

test("a shuffled deck deals every card with roughly equal frequency to each seat", () => {
  // The same class of bug on the card side. Fisher-Yates through seededShuffle
  // was already correct, but nothing asserted it.
  const seen = {};
  const SAMPLES = 4000;
  for (let i = 0; i < SAMPLES; i += 1) {
    for (const entry of GE.dealTonk(500 + i, (i % 14) + 1, i % 3, 2).hands[0]) {
      seen[entry.id] = (seen[entry.id] || 0) + 1;
    }
  }
  assert.equal(Object.keys(seen).length, 52, "every card should reach the player's hand sometimes");
  const shares = Object.values(seen).map((count) => count / (SAMPLES * 5));
  for (const share of shares) assert.ok(Math.abs(share - 1 / 52) < 0.006, `a card appeared at ${(share * 100).toFixed(2)}%`);
});

test("the same seed deals the same hand and throws the same dice", () => {
  assert.deepEqual(G.rollDice(777, "a:1"), G.rollDice(777, "a:1"));
  assert.notDeepEqual(G.rollDice(777, "a:1"), G.rollDice(777, "a:2"));
  const first = GE.dealTonk(555, 4, 0, 2).hands[0].map((entry) => entry.id);
  assert.deepEqual(GE.dealTonk(555, 4, 0, 2).hands[0].map((entry) => entry.id), first);
  // A second game on the same day is a different shuffle.
  assert.notDeepEqual(GE.dealTonk(555, 4, 1, 2).hands[0].map((entry) => entry.id), first);
});

test("a whole Cee-lo round replays identically off a burned RNG stream", () => {
  const play = (burn) => {
    const state = atTheNile(31337);
    for (let step = 0; step < burn; step += 1) state.run.rngState = (state.run.rngState * 31 + 7) >>> 0;
    const sat = C.reduceGame(state, { type: "NILE_CELO_SIT", buyIn: 20 });
    return C.reduceGame(sat, { type: "NILE_CELO_ROLL" }).world.locations.gambling.net;
  };
  assert.equal(play(0), play(40), "an unrelated draw earlier in the day cannot change the dice");
});

// ---------------------------------------------------------------------------
// Attribute integration
// ---------------------------------------------------------------------------

test("Charisma decides how much of the Tonk table the player can see", () => {
  const table = GE.dealTonk(12, 1, 0, 2);
  assert.equal(GE.tonkVision(0).tells, false, "Green reads nothing");
  assert.equal(GE.tonkVision(3).tells, true);
  assert.equal(GE.tonkVision(3).estimates, false, "the middle band gets tells, not estimates");
  assert.equal(GE.tonkVision(6).estimates, true);
  assert.ok(GE.readOpponents(table, 0, 12).every((seat) => seat.estimate === null && seat.hesitates === false));
  assert.ok(GE.readOpponents(table, 6, 12).every((seat) => typeof seat.estimate === "string"));
});

test("Intelligence turns a phrase into a number, and only the high band is certain", () => {
  const round = GE.openCeloRound(88, 2, 0);
  if (!round.odds) return; // A no-result bank has nothing to brief.
  assert.equal(GE.celoBriefing(round, 0, 88).label, null, "Green is told nothing");
  const middle = GE.celoBriefing(round, 4, 88);
  assert.equal(middle.probability, null, "the middle band gets a phrase");
  assert.ok(typeof middle.label === "string");
  const high = GE.celoBriefing(round, 7, 88);
  assert.equal(typeof high.probability, "number", "the high band gets the number");
  assert.equal(high.misread, false, "and it can never be wrong");
  assert.equal(GE.celoVision(7).canAdjust, true, "press and back off arrive with certainty");
  assert.equal(GE.celoVision(4).canAdjust, false);
});

test("the middle band can be misread and the high band cannot", () => {
  // Charisma 6 removes the catastrophic tier from the pool entirely, which is
  // what makes a false tell impossible rather than merely unlikely.
  const pool = A.buildOutcomePool("tonk_read", 0.5);
  assert.ok(pool.some((entry) => entry.tier === "catastrophic"), "a read can go wrong in principle");
  let sawCatastrophe = false;
  for (let seed = 0; seed < 300; seed += 1) {
    const outcome = A.resolveWithAttribute(pool, AD.CATASTROPHE_IMMUNITY_THRESHOLD, `probe:${seed}`);
    if (outcome.tier === "catastrophic") sawCatastrophe = true;
  }
  assert.equal(sawCatastrophe, false, "Dangerous never misreads a table");
});

// ---------------------------------------------------------------------------
// Growth
// ---------------------------------------------------------------------------

test("every growth source names an attribute and carries the documented rate", () => {
  const expected = {
    nile_social: ["charisma", 0.25], tonk_game: ["charisma", 0.4], night_owl_social: ["charisma", 0.15],
    celo_game: ["intelligence", 0.4], list_flip: ["intelligence", 0.2], coffee_ceremony: ["intelligence", 0.15],
  };
  for (const [activity, [attribute, rate]] of Object.entries(expected)) {
    assert.equal(AD.GROWTH_ATTRIBUTES[activity], attribute, `${activity} trains the wrong attribute`);
    assert.equal(AD.GROWTH_RATES[activity], rate, `${activity} has the wrong base rate`);
  }
  // Every rate has an attribute and vice versa; a source with only half a
  // definition would train nothing and say nothing about it.
  assert.deepEqual(Object.keys(AD.GROWTH_RATES).sort(), Object.keys(AD.GROWTH_ATTRIBUTES).sort());
});

test("growth diminishes on lifetime sessions of that specific activity", () => {
  const first = A.attributeGrowth(1, 0, "tonk_game");
  const tenth = A.attributeGrowth(1, 9, "tonk_game");
  assert.ok(first > tenth, "the tenth hand teaches less than the first");
  // Past Dangerous the source halves again, because a card table cannot make
  // anyone great at reading people.
  assert.ok(A.attributeGrowth(AD.GROWTH_CAP_PENALTY_FLOOR, 0, "tonk_game") < first);
});

test("no single Nile source can carry a player to Dangerous alone", () => {
  for (const [activity, attribute] of [["nile_social", "charisma"], ["celo_game", "intelligence"], ["tonk_game", "charisma"]]) {
    let total = 0;
    for (let session = 0; session < 30; session += 1) total += A.attributeGrowth(1 + Math.floor(total), session, activity);
    assert.ok(1 + total < 6, `30 sessions of ${activity} reached ${1 + total} ${attribute}, which should not reach Dangerous`);
  }
});

test("a wellness visit costs thirty dollars and a slot, restores fifteen, and grows Charisma", () => {
  const state = atTheNile(600, { cash: 200, slot: 0 });
  state.player.health = 50;
  const before = { cash: state.player.cash, slot: state.run.slot, progress: state.player.attributeProgress.charisma };
  const after = C.reduceGame(state, { type: "NILE_WELLNESS" });
  assert.equal(after.player.cash, before.cash - N.WELLNESS_COST);
  assert.equal(after.player.health, 65);
  assert.notEqual(after.run.slot, before.slot, "it costs a part of the day");
  assert.ok(after.player.attributeProgress.charisma > before.progress, "and it is Charisma practice");
  assert.equal(after.npc.selam.visits, 1);
  // Cash stays split honestly, which is the invariant spendCash exists for.
  assert.equal(after.player.cash, after.player.cleanCash + after.player.dirtyCash);
});

test("the coffee ceremony grows Intelligence and costs a slot but no money", () => {
  const state = atTheNile(601);
  const after = C.reduceGame(state, { type: "NILE_COFFEE" });
  assert.equal(after.player.cash, state.player.cash, "the coffee is always free");
  assert.ok(after.player.attributeProgress.intelligence > state.player.attributeProgress.intelligence);
  assert.notEqual(after.run.slot, state.run.slot);
});

// Buy one listing, post it, wait for the buyer, deliver, and report what the
// flip was worth and what it taught. Returns null when the buyer flaked.
function runFlip(seed, itemId) {
  const state = funded907(seed);
  const listing = C.selectors.listingSlate(state, "phone").find((entry) => entry.id === itemId);
  if (!listing) return null;
  const bought = clear(C.reduceGame(state, { type: "BUY_907LIST", itemId: listing.id, surface: "phone" }));
  if (!bought.nineZeroSevenList.inventory.length) return null;
  const held = bought.nineZeroSevenList.inventory[0];
  const listed = C.reduceGame(bought, { type: "SELL_907LIST", inventoryId: held.id, surface: "phone" });
  const ready = waitForBuyer907(listed);
  const pending = ready.nineZeroSevenList.pendingSells.find((entry) => entry.status === "ready");
  if (!pending) return null;
  const before = ready.player.attributeProgress.intelligence;
  const delivered = settle907(C.reduceGame(ready, { type: "DELIVER_907LIST", pendingId: pending.id }));
  return {
    cost: held.cost, price: pending.price, before,
    after: delivered.player.attributeProgress.intelligence,
    profitable: held.cost > 0 && pending.price > held.cost * 1.3,
  };
}

test("a profitable 907List flip grows Intelligence, driven end to end", () => {
  // Seed 2100's shop_vac closes at $67 on a $45 cost, which clears the 1.3x gate.
  const good = runFlip(2100, "shop_vac");
  assert.ok(good, "seed 2100 should close the shop_vac flip");
  assert.equal(good.profitable, true, `expected a profitable flip, got ${good.price} on ${good.cost}`);
  assert.ok(good.after > good.before, "reading value well is what Intelligence is for");
});

test("a 907List flip sold at a loss teaches nothing", () => {
  // The same seed's first listing goes the other way: bought at $60, sold at $25.
  // That is a dispute, and a dispute is not a lesson in appraisal worth paying for.
  const bad = runFlip(2100, C.selectors.listingSlate(funded907(2100), "phone")[0].id);
  assert.ok(bad, "seed 2100 should close its first flip too");
  assert.equal(bad.profitable, false, `expected a wash, got ${bad.price} on ${bad.cost}`);
  assert.equal(bad.after, bad.before, "a loss moves nothing");
});

test("the profitable-flip gate is a real margin, not any sale at all", () => {
  // Pinned separately from the end-to-end run above, because that one depends on
  // whatever margin the seed produced and this is the boundary itself.
  const qualifies = (payout, cost) => cost > 0 && payout > cost * 1.3;
  assert.equal(qualifies(200, 100), true, "double your money is a good read");
  assert.equal(qualifies(131, 100), true, "just over the line counts");
  assert.equal(qualifies(130, 100), false, "exactly the line does not");
  assert.equal(qualifies(120, 100), false, "twenty percent is a wash");
  assert.equal(qualifies(90, 100), false, "a dispute teaches nothing good");
});

test("Night Owl nights now count for Charisma, at the smallest rate of the three", () => {
  assert.ok(AD.GROWTH_RATES.night_owl_social < AD.GROWTH_RATES.nile_social);
  assert.ok(AD.GROWTH_RATES.nile_social < AD.GROWTH_RATES.tonk_game);
  const state = fresh(702);
  state.run.slot = 2;
  state.npc.mina.met = true;
  const after = C.reduceGame(state, { type: "VISIT_NIGHT_OWL" });
  assert.ok(after.player.attributeProgress.charisma > state.player.attributeProgress.charisma);
  assert.equal(after.nightOwl.socialSessions, 1);
});

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

test("three consecutive Nile days bank a bonus that pays the attribute it earned", () => {
  let state = atTheNile(800, { cash: 900, slot: 0 });
  for (let day = 1; day <= 3; day += 1) {
    readyAt(state, day, 0);
    const after = C.reduceGame(state, { type: "NILE_WELLNESS" });
    assert.notEqual(after, state, `day ${day} visit should be allowed`);
    state = after;
  }
  assert.equal(state.player.nileStreak, AD.NILE_STREAK_REQUIREMENT);
  assert.equal(state.player.nileStreakAttribute, "charisma");
  assert.equal(A.nileStreakBonus(state, "charisma"), AD.NILE_STREAK_BONUS);
  // It pays the attribute it was earned in and nothing else.
  assert.equal(A.nileStreakBonus(state, "intelligence"), 0);
  assert.equal(A.nileStreakBonus(state, "combat"), 0);
  assert.equal(
    A.effectiveAttribute(state, "charisma"),
    A.attributeValue(state, "charisma") + AD.NILE_STREAK_BONUS,
  );
});

test("the streak follows whichever floor was used most recently", () => {
  const state = atTheNile(801, { cash: 900 });
  state.player.nileStreak = 3;
  state.player.nileStreakDay = state.run.day;
  state.player.nileStreakAttribute = "charisma";
  const after = C.reduceGame(state, { type: "NILE_COFFEE" });
  assert.equal(after.player.nileStreakAttribute, "intelligence", "the last thing trained claims the streak");
  assert.equal(A.nileStreakBonus(after, "charisma"), 0);
});

test("a gym streak and a Nile streak never stack, because they never share an attribute", () => {
  const state = atTheNile(802);
  state.player.gymStreak = 3;
  state.player.gymStreakDay = state.run.day;
  state.player.nileStreak = 3;
  state.player.nileStreakDay = state.run.day;
  state.player.nileStreakAttribute = "charisma";
  assert.equal(A.streakBonus(state, "combat"), AD.GYM_STREAK_BONUS);
  assert.equal(A.streakBonus(state, "charisma"), AD.NILE_STREAK_BONUS);
  assert.equal(A.streakBonus(state, "intelligence"), 0);
});

test("a three-day Nile streak reaches the household and the block but never the network", () => {
  let state = atTheNile(803, { cash: 900, slot: 0 });
  for (let day = 1; day <= 3; day += 1) {
    readyAt(state, day, 0);
    state = C.reduceGame(state, { type: "NILE_WELLNESS" });
  }
  const rows = [...state.npc.yalonda.ledger, ...state.run.pendingObservations.map((entry) => entry.observation)];
  assert.ok(rows.some((row) => row.event === "nile_consistent"), "the household notices the routine");
  assert.equal(
    state.npc.curtis.ledger.filter((row) => row.event === "nile_consistent").length,
    0,
    "and Curtis does not",
  );
});

// ---------------------------------------------------------------------------
// The location
// ---------------------------------------------------------------------------

test("each floor keeps its own hours", () => {
  for (const slot of [0, 1, 2, 3]) {
    const state = atTheNile(900, { slot });
    const nile = C.selectors.nileAvailability(state);
    assert.equal(nile.wellness.available, N.WELLNESS_SLOTS.includes(slot), `wellness at slot ${slot}`);
    assert.equal(nile.coffee.available, N.DEN_SLOTS.includes(slot), `the den at slot ${slot}`);
  }
  assert.deepEqual(N.WELLNESS_SLOTS, [0, 1, 2], "ground floor is Morning through Evening, never Night");
  assert.deepEqual(N.DEN_SLOTS, [2, 3], "the den is Evening and Night only");
});

test("the second floor is never reachable by walking, only by a vouch", () => {
  const state = fresh(901);
  state.run.slot = 2;
  // Walk until the ground floor turns up. It always does; the roll ramps.
  let walked = state;
  for (let step = 0; step < 60 && !walked.world.locations.theNile.discovered; step += 1) {
    readyAt(walked, 1 + step, 0);
    walked = C.reduceGame(walked, { type: "WANDER_SPENARD" });
  }
  assert.equal(walked.world.locations.theNile.discovered, true, "wandering finds the building");
  assert.equal(walked.world.locations.theNile.secondFloorAccess, false, "but never the room upstairs");
  assert.equal(walked.world.locations.theNile.discoveryMethod, N.DISCOVERY_METHODS.wander);
});

test("the wander roll ramps so a patient player always gets there", () => {
  assert.equal(N.wanderChance(0), N.WANDER_BASE_CHANCE);
  assert.ok(N.wanderChance(5) > N.wanderChance(0));
  assert.ok(N.wanderChance(500) <= N.WANDER_MAX_CHANCE, "and it is capped");
});

test("Selam names her brother at Warm, which is what opens the stairwell", () => {
  const state = atTheNile(902, { cash: 300, slot: 0 });
  state.world.locations.theNile.secondFloorAccess = false;
  putInBand(state, "selam", BANDS.WARM);
  const after = C.reduceGame(state, { type: "NILE_WELLNESS" });
  assert.equal(after.npc.selam.mentionedBiniam, true);
  assert.equal(after.world.locations.theNile.secondFloorAccess, true);
  assert.equal(after.world.locations.theNile.accessMethod, N.DEN_ACCESS_METHODS.selam);
});

test("Selam sends intel at Trusted and stays professional below it", () => {
  const cold = atTheNile(903, { cash: 300, slot: 0 });
  cold.world.locations.theNile.secondFloorAccess = false;
  const quiet = C.reduceGame(cold, { type: "NILE_WELLNESS" });
  assert.equal(quiet.phone.inbox.filter((entry) => entry.from === "Selam").length, 0);

  const trusted = atTheNile(904, { cash: 300, slot: 0 });
  putInBand(trusted, "selam", BANDS.TRUSTED);
  const after = C.reduceGame(trusted, { type: "NILE_WELLNESS" });
  const texts = [...after.phone.inbox, ...after.phone.heldInbox].filter((entry) => entry.from === "Selam");
  assert.equal(texts.length, 1, "one text, once a day");
  assert.ok(N.SELAM_INTEL.includes(texts[0].text));
});

test("the board flyer opens the ground floor and says nothing about upstairs", () => {
  assert.ok(C.NIGHT_OWL_BOARD.some((entry) => entry.id === N.BOARD_FLYER.id), "the flyer is in the rotation");
  const body = `${N.BOARD_FLYER.title} ${N.BOARD_FLYER.body}`.toLowerCase();
  for (const word of ["game", "dice", "cards", "tonk", "cee-lo", "upstairs"]) {
    assert.ok(!body.includes(word), `a community board flyer should not mention ${word}`);
  }
});

// ---------------------------------------------------------------------------
// The Tesfayes
// ---------------------------------------------------------------------------

test("both Tesfayes carry their archetype and neither is wired to the network", () => {
  const { resolveLens } = require("../src/data/npc-lenses.js");
  const PROP = require("../src/data/propagation.js");
  const selam = resolveLens("selam");
  assert.equal(selam.archetype, "CIVILIAN");
  assert.equal(selam.weights.heat_exposure, -4);
  assert.equal(selam.weights.discretion, 3);
  assert.equal(selam.weights.violence, -4);
  const biniam = resolveLens("biniam");
  assert.equal(biniam.archetype, "STREET");
  assert.equal(biniam.weights.violence, -2);
  assert.equal(biniam.weights.discretion, 3);
  for (const id of ["selam", "biniam"]) {
    assert.ok(!PROP.NPC_CHANNELS[id].includes("network"), `${id} must not listen on the network`);
    assert.ok(!PROP.NPC_CHANNELS[id].includes("reputation"), `${id} must not listen on reputation`);
  }
});

test("Biniam gives street gossip exactly zero weight", () => {
  const state = fresh(1000);
  const heard = C.reduceGame(state, { type: "NOOP" });
  // The same observation, once witnessed and once carried by the network.
  const witnessed = fresh(1001);
  witnessed.npc.biniam.ledger.push({ type: "violence", event: "street_fight", location: null, value: null, day: 1, count: 1, source: "witnessed" });
  const gossip = fresh(1002);
  gossip.npc.biniam.ledger.push({ type: "violence", event: "street_fight", location: null, value: null, day: 1, count: 1, source: "network" });
  assert.ok(C.selectors.disposition(witnessed, "biniam") < 0, "he saw it happen and it counts");
  assert.equal(C.selectors.disposition(gossip, "biniam"), 0, "he does not listen to talk about his guests");
});

test("Selam weighs violence and heat at her own address double", () => {
  const elsewhere = fresh(1010);
  elsewhere.npc.selam.ledger.push({ type: "violence", event: "street_fight", location: "north_star_lot", value: null, day: 1, count: 1, source: "witnessed" });
  const atTheDoor = fresh(1011);
  atTheDoor.npc.selam.ledger.push({ type: "violence", event: "street_fight", location: N.NILE_LOCATION_ID, value: null, day: 1, count: 1, source: "witnessed" });
  const away = C.selectors.disposition(elsewhere, "selam");
  const near = C.selectors.disposition(atTheDoor, "selam");
  assert.ok(near < away, "violence at the building is worse than violence in general");
  assert.equal(near, away * 2, "exactly double, as specified");
  // Heat carries the same rule.
  const heat = fresh(1012);
  heat.npc.selam.ledger.push({ type: "heat_exposure", event: "heat_seen_high", location: N.NILE_LOCATION_ID, value: null, day: 1, count: 1, source: "witnessed" });
  assert.equal(C.selectors.disposition(heat, "selam"), -8, "heat_exposure -4, doubled at her door");
});

test("Selam does not care how the dice went", () => {
  const state = fresh(1013);
  state.npc.selam.ledger.push({ type: "financial", event: "gambling_profit", location: N.NILE_LOCATION_ID, value: 300, day: 1, count: 1, source: "witnessed" });
  assert.equal(C.selectors.disposition(state, "selam"), 0, "gambling is her brother's business, not hers");
});

test("Biniam's table access is gated by band and the coffee count shows it", () => {
  const access = (band) => N.tableAccess(band);
  assert.equal(access(BANDS.COLD).tonk, false, "Cold gets coffee and a chair to watch from");
  assert.equal(access(BANDS.NEUTRAL).tonk, true);
  assert.equal(access(BANDS.NEUTRAL).celo, false, "the dice are earned separately");
  assert.equal(access(BANDS.WARM).celo, true);
  assert.equal(access(BANDS.TRUSTED).privateGames, true, "a hook, with no content this build");
  assert.equal(N.coffeeCups(BANDS.NEUTRAL), 1);
  assert.equal(N.coffeeCups(BANDS.WARM), 2);
  assert.equal(N.coffeeCups(BANDS.TRUSTED), 3);
  assert.equal(N.coffeeCups(BANDS.BONDED), 3, "three is the ceremony's whole count");
});

test("the siblings carry separate dispositions and the UI reads each its own", () => {
  // Caught in the browser: one shared `band` had Selam speaking her Warm line
  // because her brother liked the player. They are separate people and being
  // welcome upstairs says nothing about what she thinks of you.
  const state = atTheNile(1050);
  putInBand(state, "biniam", BANDS.TRUSTED);
  const nile = C.selectors.nileAvailability(state);
  assert.equal(nile.band, BANDS.TRUSTED, "band is Biniam's, because he runs the tables");
  assert.equal(nile.selamBand, BANDS.NEUTRAL, "and Selam has her own");
  assert.notEqual(N.SELAM_LINES[nile.selamBand], N.SELAM_LINES[nile.band], "which must read differently");
});

test("neither Tesfaye uses slang or contractions in an authored line", () => {
  const lines = [...Object.values(N.SELAM_LINES), ...Object.values(N.BINIAM_LINES), ...N.SELAM_INTEL];
  for (const line of lines) {
    assert.ok(!/\b\w+['’]\w+\b/.test(line.replace(/Selam['’]s/g, "")), `contraction in: ${line}`);
    for (const slang of ["gonna", "wanna", "yeah", "bro", "dawg", "nah", "yo"]) {
      assert.ok(!new RegExp(`\\b${slang}\\b`, "i").test(line), `slang "${slang}" in: ${line}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Isolation — the load-bearing promise
// ---------------------------------------------------------------------------

test("nothing that happens at The Nile ever reaches Curtis", () => {
  let state = atTheNile(1100, { cash: 2000 });
  const before = C.selectors.disposition(state, "curtis");
  // Play every table action the building offers, several times.
  for (let round = 0; round < 3; round += 1) {
    readyAt(state, round + 1, 2);
    const sat = C.reduceGame(state, { type: "NILE_CELO_SIT", buyIn: 100 });
    state = C.reduceGame(sat, { type: "NILE_CELO_ROLL" });
  }
  assert.ok(state.world.locations.gambling.plays > 0, "the games actually ran");
  assert.equal(C.selectors.disposition(state, "curtis"), before, "Curtis's disposition never moved");
  assert.equal(state.npc.curtis.ledger.length, 0, "and nothing was written to his ledger");
  assert.equal(state.npc.curtis.attention, 0);
  const queued = state.run.pendingObservations.filter((entry) => entry.npcId === "curtis");
  assert.equal(queued.length, 0, "nothing is even in the post for him");
});

test("a big win reaches the block, a bigger one reaches the household, and neither reaches the network", () => {
  const channels = (net) => G.gamblingObservations(net).map((row) => row.channel);
  assert.deepEqual(channels(20), [], "a small night is nobody's business");
  assert.deepEqual(channels(50), ["neighborhood"], "fifty is the floor for being noticed");
  assert.deepEqual(channels(150), ["neighborhood", "household"], "a hundred and up and Yalonda hears");
  assert.deepEqual(channels(-50), [], "a small loss stays yours");
  assert.deepEqual(channels(-150), ["household"], "a big loss is a household fact only");
  for (const net of [50, 150, 500, -150, -900]) {
    assert.ok(!channels(net).includes("network"), `net ${net} must never reach the network`);
    assert.ok(!channels(net).includes("reputation"), `net ${net} must never reach reputation`);
  }
});

// ---------------------------------------------------------------------------
// Table rules through the reducer
// ---------------------------------------------------------------------------

test("a buy-in leaves the wallet and a win comes back to it", () => {
  const state = atTheNile(1200, { cash: 300 });
  const sat = C.reduceGame(state, { type: "NILE_CELO_SIT", buyIn: 50 });
  assert.equal(sat.player.cash, 250, "the buy-in is down before the dice move");
  const done = C.reduceGame(sat, { type: "NILE_CELO_ROLL" });
  const net = done.world.locations.gambling.net;
  assert.equal(done.player.cash, 300 + net, "the wallet reflects exactly the night's net");
  assert.equal(done.player.cash, done.player.cleanCash + done.player.dirtyCash, "and the split stays honest");
});

test("three games is the daily limit and the day resets it", () => {
  let state = atTheNile(1201, { cash: 2000 });
  const day = state.run.day;
  for (let game = 0; game < G.MAX_GAMES_PER_DAY; game += 1) {
    readyAt(state, day, 2);
    const sat = C.reduceGame(state, { type: "NILE_CELO_SIT", buyIn: 20 });
    assert.notEqual(sat, state, `game ${game + 1} should be allowed`);
    state = C.reduceGame(sat, { type: "NILE_CELO_ROLL" });
  }
  readyAt(state, day, 2);
  assert.equal(C.selectors.nileAvailability(state).celo.available, false, "the fourth is refused");
  const blocked = C.reduceGame(state, { type: "NILE_CELO_SIT", buyIn: 20 });
  assert.equal(blocked, state, "and the reducer refuses it too");
  readyAt(state, day + 1, 2);
  assert.equal(C.selectors.nileAvailability(state).celo.available, true, "tomorrow is a new day");
});

test("each table quotes its own buy-in range", () => {
  // Caught in the browser: a ternary comparing two booleans quoted Cee-lo the
  // Tonk ceiling, so the card advertised $20-$50 above three buttons that went
  // to $100.
  const nile = C.selectors.nileAvailability(atTheNile(1203, { cash: 2000 }));
  assert.match(nile.tonk.reason, new RegExp(`\\$${G.TONK_MIN_BUY_IN}-\\$${G.TONK_MAX_BUY_IN}`), nile.tonk.reason);
  assert.match(nile.celo.reason, new RegExp(`\\$${G.CELO_MIN_BUY_IN}-\\$${G.CELO_MAX_BUY_IN}`), nile.celo.reason);
});

test("a buy-in outside the listed range is refused at both the selector and the reducer", () => {
  const state = atTheNile(1202, { cash: 2000 });
  for (const buyIn of [5, 0, 500, -20]) {
    assert.equal(C.reduceGame(state, { type: "NILE_TONK_SIT", buyIn }), state, `tonk should refuse ${buyIn}`);
  }
  assert.notEqual(C.reduceGame(state, { type: "NILE_TONK_SIT", buyIn: G.TONK_MIN_BUY_IN }), state);
});

test("a hand of Tonk plays to a finish and settles the money", () => {
  let state = atTheNile(1300, { cash: 400 });
  state = C.reduceGame(state, { type: "NILE_TONK_SIT", buyIn: 20 });
  assert.ok(state.gambling.table, "sitting down deals a hand");
  const view = C.selectors.tonkView(state);
  assert.equal(view.hand.length, 5);
  assert.equal(view.pot, 60, "three seats at twenty");
  // Play it out. Either the table ends it or the player drops.
  for (let turn = 0; turn < 30 && state.gambling.table; turn += 1) {
    const current = C.selectors.tonkView(state);
    if (!current) break;
    state = C.reduceGame(state, { type: "NILE_TONK_TURN", draw: "stock", discardId: current.hand[current.hand.length - 1].id });
  }
  if (state.gambling.table) state = C.reduceGame(state, { type: "NILE_TONK_DROP" });
  assert.equal(state.gambling.table, null, "the hand finishes");
  assert.equal(state.gambling.tonkGamesPlayed, 1);
  assert.ok(state.player.attributeProgress.charisma > 0, "playing is the growth, win or lose");
  assert.equal(state.player.cash, state.player.cleanCash + state.player.dirtyCash);
});

test("the reducer refuses a second table while a hand is in progress", () => {
  const seated = C.reduceGame(atTheNile(1301, { cash: 900 }), { type: "NILE_TONK_SIT", buyIn: 20 });
  assert.equal(C.reduceGame(seated, { type: "NILE_CELO_SIT", buyIn: 20 }), seated, "one table at a time");
  assert.equal(C.selectors.nileAvailability(seated).celo.available, false);
});

// ---------------------------------------------------------------------------
// The retired action
// ---------------------------------------------------------------------------

test("the abstract backroom game is gone from every surface", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "game-core.js"), "utf8");
  assert.equal(C.DISTRICT_ACTIONS.spenard_gambling, undefined, "the district action is retired");
  assert.ok(!/action\.type === "GAMBLE"/.test(source), "the reducer case is gone");
  const state = atTheNile(1400, { cash: 500 });
  assert.equal(C.reduceGame(state, { type: "GAMBLE", stake: 20, approach: "read" }), state, "and dispatching it does nothing");
});

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

test("a v8 save loads on v9 with The Nile undiscovered and the tables at zero", () => {
  const raw = JSON.parse(C.serializeRun(fresh(1500)));
  raw.version = 8;
  delete raw.world.locations.theNile;
  delete raw.gambling;
  delete raw.player.nileStreak;
  const state = C.hydrateRun(raw);
  assert.equal(state.version, 11);
  assert.equal(state.world.locations.theNile.discovered, false);
  assert.equal(state.world.locations.theNile.secondFloorAccess, false);
  assert.deepEqual(state.gambling.tonkGamesPlayed, 0);
  assert.deepEqual(state.gambling.celoRoundsPlayed, 0);
  assert.equal(state.gambling.table, null);
  assert.equal(state.player.nileStreak, 0);
  assert.equal(state.player.nileStreakAttribute, null);
  // The new NPCs arrive with readable ledgers rather than undefined.
  for (const id of ["selam", "biniam"]) {
    assert.ok(Array.isArray(state.npc[id].ledger), `${id} has no ledger`);
    assert.equal(C.selectors.dispositionBand(state, id), BANDS.NEUTRAL, `${id} should start Neutral`);
  }
});

test("every supported save version reaches v9 with a playable Nile", () => {
  for (const version of [3, 4, 5, 6, 7, 8]) {
    const raw = JSON.parse(C.serializeRun(fresh(1600 + version)));
    raw.version = version;
    delete raw.world.locations.theNile;
    delete raw.gambling;
    const state = C.hydrateRun(raw);
    assert.equal(state.version, 11, `v${version} did not reach v11`);
    assert.equal(typeof state.world.locations.theNile.discovered, "boolean", `v${version} lost the Nile`);
    assert.equal(state.gambling.dailyGamesPlayed, 0, `v${version} lost the table counters`);
  }
});

test("v10 owns its save key and still advertises every older one", () => {
  assert.equal(C.VERSION, 11);
  assert.equal(C.SAVE_KEY, "907ogr_v11");
  assert.ok(C.LEGACY_SAVE_KEYS.includes("907ogr_v8"), "v8 saves must still be findable");
  assert.equal(C.LEGACY_SAVE_KEYS.length, 8);
});
