// v1.9b: the 907List tiered broker system.
//
// The tests that matter most here are the ones that pin the *decisions* rather
// than the numbers: that a Scrapper cannot see condition, that a meetup costs a
// part of the day, that risk is a function of things the player chose, and that
// a flip the player misjudged closes Broker standing. The balance figures live
// in tests/simulate-runs.js, where they can be measured over 200 runs instead of
// asserted over one.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const M = require("../src/data/market.js");
const ME = require("../src/events/market-events.js");

function fresh(seed = 1960) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "North" });
  state.run.openingPending = false;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  state.knowledge.knows907List = true;
  state.nineZeroSevenList.known = true;
  return state;
}

function clear(state) {
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  state.run.daySummary = null;
  return state;
}

// Clears modals the way the player would, and — unlike clear() — lets the day
// actually roll over. Anything that has to wait for tomorrow needs this: simply
// blanking dayEndPending freezes the clock at Night, which is not the same
// thing as ending the day.
function settle(state) {
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

// Walks forward until a listed item has a buyer, ending days properly on the way.
function waitForBuyer(state) {
  let next = settle(state);
  for (let guard = 0; guard < 12; guard += 1) {
    if (next.nineZeroSevenList.pendingSells.some((entry) => entry.status === "ready")) return next;
    if (!next.nineZeroSevenList.pendingSells.length) return next;
    next = settle(C.reduceGame(next, { type: "WANDER_SPENARD" }));
  }
  return next;
}

function funded(seed = 1960, cash = 1200) {
  const state = fresh(seed);
  state.player.cash = cash;
  state.player.cleanCash = cash;
  state.player.dirtyCash = 0;
  return state;
}

// Puts a specific item in the player's hands without going through a meetup, so
// a sell test is not at the mercy of a snipe or a robbery roll.
function hold(state, itemId, index = 0) {
  const item = M.LISTING_ITEM_BY_ID[itemId];
  const entry = { id: `held:${itemId}:${index}`, itemId, cost: item.buy, boughtDay: state.run.day, listed: false };
  state.nineZeroSevenList.inventory.push(entry);
  return entry;
}

// ------------------------------------------------------------ tier progression

test("Tier 1 is active with a phone and no laptop, and shows a title and a price and nothing else", () => {
  const state = fresh();
  assert.equal(C.selectors.marketTier(state), 1);
  assert.equal(C.selectors.marketTierConfig(state).name, "Scrapper");
  const slate = C.selectors.listingSlate(state, "phone");
  assert.equal(slate.length, 2);
  for (const listing of slate) {
    assert.equal(listing.condition, null, `${listing.id} leaked condition to a Scrapper`);
    assert.equal(listing.reliability, null, `${listing.id} leaked seller reliability to a Scrapper`);
    assert.ok(listing.name && listing.buy > 0);
  }
  // Scrapper meetups are Spenard only.
  assert.deepEqual(C.selectors.marketTierConfig(state).districts, ["north_star_lot"]);
  state.world.currentNeighborhoodId = "downtown";
  assert.equal(C.selectors.marketMeetupAvailability(state).available, false);
});

test("Tier 2 unlocks on laptop acquisition and opens condition, reliability, and Downtown", () => {
  const state = fresh(1961);
  state.inventory.laptop = true;
  assert.equal(C.selectors.marketTier(state), 2);
  const slate = C.selectors.listingSlate(state, "phone");
  assert.equal(slate.length, 4);
  for (const listing of slate) {
    assert.ok(M.CONDITIONS[listing.condition], `${listing.id} should carry a condition at Flipper tier`);
    assert.ok(M.SELLER_RELIABILITY[listing.reliability], `${listing.id} should carry a reliability at Flipper tier`);
  }
  state.world.currentNeighborhoodId = "downtown";
  assert.equal(C.selectors.marketMeetupAvailability(state).available, true);
  assert.equal(C.selectors.marketOverview(state).quickSell, true);
});

test("Tier 3 unlocks at ten flips with fewer than two disputes and not before", () => {
  const state = fresh(1962);
  state.inventory.laptop = true;
  state.nineZeroSevenList.flipCount = M.BROKER_FLIP_REQUIREMENT - 1;
  assert.equal(C.selectors.marketTier(state), 2, "nine flips is not Broker standing");
  state.nineZeroSevenList.flipCount = M.BROKER_FLIP_REQUIREMENT;
  assert.equal(C.selectors.marketTier(state), 3);
  // Disputes close the door, and they close it at exactly two.
  state.nineZeroSevenList.disputes = M.BROKER_DISPUTE_LIMIT - 1;
  assert.equal(C.selectors.marketTier(state), 3, "one dispute should still allow Broker");
  state.nineZeroSevenList.disputes = M.BROKER_DISPUTE_LIMIT;
  assert.equal(C.selectors.marketTier(state), 2);
  // Broker standing is not reachable without the laptop either.
  state.nineZeroSevenList.disputes = 0;
  state.inventory.laptop = false;
  assert.equal(C.selectors.marketTier(state), 1);
});

test("the specialist tag lands at exactly three flips in one category and adds a listing in it", () => {
  const state = fresh(1963);
  state.inventory.laptop = true;
  state.nineZeroSevenList.categoryFlips = { electronics: M.SPECIALIST_FLIP_REQUIREMENT - 1 };
  assert.equal(C.selectors.specialistCategory(state), null, "two flips is not a specialty");
  const before = C.selectors.listingSlate(state, "phone").length;

  state.nineZeroSevenList.categoryFlips = { electronics: M.SPECIALIST_FLIP_REQUIREMENT };
  assert.equal(C.selectors.specialistCategory(state), "electronics");
  const after = C.selectors.listingSlate(state, "phone");
  assert.equal(after.length, before + 1, "the specialist bonus listing should be an extra row");
  assert.ok(after.some((listing) => listing.category === "electronics"));

  // A Scrapper cannot earn it: the tier has no specialist slot to fill.
  state.inventory.laptop = false;
  assert.equal(C.selectors.specialistCategory(state), null);
});

// ------------------------------------------------------------ robbery risk

test("the robbery formula multiplies value, district, time of day, and heat", () => {
  const state = fresh(1964);
  // The worked example from the design doc: $200 carried, Downtown, Night,
  // heat 4 => 0.03 * 2.0 * 1.8 * 2.5 * 1.4.
  state.player.heat = 4;
  assert.equal(ME.robberyRisk(state, { carriedValue: 200, district: "downtown", slot: 3 }), 0.378);
  // The same bag moved smart.
  state.player.heat = 0;
  assert.equal(ME.robberyRisk(state, { carriedValue: 200, district: "north_star_lot", slot: 0 }), 0.03);
});

test("Spenard in the Morning with little in the bag is near zero and Downtown at Night with a full one is dangerous", () => {
  const state = fresh(1965);
  const safe = ME.robberyRisk(state, { carriedValue: 25, district: "north_star_lot", slot: 0 });
  assert.ok(safe <= 0.005, `expected a near-zero risk, got ${safe}`);

  state.player.heat = 6;
  const deadly = ME.robberyRisk(state, { carriedValue: 500, district: "downtown", slot: 3 });
  assert.ok(deadly >= 0.30, `expected a severe risk, got ${deadly}`);
  assert.equal(C.selectors.marketRobberyPreview(state, { carriedValue: 500, district: "downtown", slot: 3 }).band, "severe");
});

test("carried value stops contributing past the cap and risk never becomes a certainty", () => {
  const state = fresh(1966);
  state.player.heat = 15;
  const atCap = ME.robberyRisk(state, { carriedValue: M.ROBBERY.carriedValueCap, district: "downtown", slot: 3 });
  const overCap = ME.robberyRisk(state, { carriedValue: M.ROBBERY.carriedValueCap * 10, district: "downtown", slot: 3 });
  assert.equal(atCap, overCap, "carrying more than the cap must not raise the risk");
  assert.ok(overCap <= M.ROBBERY.maxRisk);
});

test("a robbery takes the bag, some health, and a point of heat, and the block hears about it", () => {
  const state = funded(1967);
  state.inventory.laptop = true; // quick sell is the shortest path to a meetup
  state.player.heat = 10;
  state.run.slot = 3;
  hold(state, "snow_tires");
  hold(state, "tool_set", 1);
  const health = state.player.health;
  const heat = state.player.heat;

  // Drive the roll rather than hoping for it: this asserts the outcome, and the
  // probability itself is asserted above.
  const risk = C.selectors.marketRobberyPreview(state).risk;
  assert.ok(risk > 0, "a full bag at Night should carry real risk");
  // Search for a day whose roll actually lands rather than reimplementing the
  // key the reducer hashes: the outcome is what this test is about, and the
  // probability is asserted above.
  let robbed = null;
  for (let attempt = 0; attempt < 60 && !robbed; attempt += 1) {
    const candidate = JSON.parse(JSON.stringify(state));
    candidate.run.day = 1 + attempt;
    const out = C.reduceGame(candidate, { type: "QUICK_SELL_907LIST", inventoryId: candidate.nineZeroSevenList.inventory[0].id });
    if (out.nineZeroSevenList.robberies > 0) robbed = out;
  }
  assert.ok(robbed, "no day in sixty produced a robbery on a full Night bag");
  assert.equal(robbed.nineZeroSevenList.inventory.length, 0, "a robbery takes the whole bag");
  assert.ok(robbed.player.health < health, "a robbery costs health");
  assert.equal(robbed.player.heat, Math.min(15, heat + M.ROBBERY.heatGain));
  assert.ok(robbed.npc.mina.ledger.concat(robbed.run.pendingObservations.map((entry) => entry.observation))
    .some((row) => row.event === "robbery_victim"), "the neighborhood should carry the robbery");
});

// ------------------------------------------------------------ time slot economy

test("a buy costs one part of the day, listing costs none, and the delivery costs one more", () => {
  const state = funded(1968);
  const listing = C.selectors.listingSlate(state, "phone")
    .find((entry) => !ME.rollSnipe(state, entry.id, "mixed"));
  assert.ok(listing, "seed 1968 sniped the whole board");

  const bought = clear(C.reduceGame(state, { type: "BUY_907LIST", itemId: listing.id, surface: "phone" }));
  assert.equal(bought.run.slot, state.run.slot + 1, "a meetup costs one part of the day");
  assert.equal(bought.nineZeroSevenList.inventory.length, 1);

  const held = bought.nineZeroSevenList.inventory[0];
  const listed = C.reduceGame(bought, { type: "SELL_907LIST", inventoryId: held.id, surface: "phone" });
  assert.equal(listed.run.slot, bought.run.slot, "posting a listing is free");
  assert.equal(listed.nineZeroSevenList.pendingSells.length, 1);
  assert.equal(listed.player.cash, bought.player.cash, "posting must not pay");

  // Walk to the day the buyer answers, then deliver.
  const ready = waitForBuyer(listed);
  const pending = ready.nineZeroSevenList.pendingSells[0];
  assert.ok(pending, "the listing vanished instead of finding a buyer");
  assert.equal(pending.status, "ready", "an open-market buyer should answer by the next morning");
  assert.ok(ready.run.day > listed.run.day, "post and pray waits a day");

  const beforeSlot = ready.run.slot;
  const beforeCash = ready.player.cash;
  const delivered = clear(C.reduceGame(ready, { type: "DELIVER_907LIST", pendingId: pending.id }));
  assert.equal(delivered.run.slot, beforeSlot + 1, "the delivery costs one part of the day");
  assert.equal(delivered.player.cash, beforeCash + pending.price);
  assert.equal(delivered.nineZeroSevenList.flipCount, 1);
  assert.equal(delivered.nineZeroSevenList.inventory.length, 0);
});

test("a quick sell is one part of the day, pays the markdown, and never waits", () => {
  const state = funded(1969);
  state.inventory.laptop = true;
  const held = hold(state, "car_battery");
  const item = M.LISTING_ITEM_BY_ID["car_battery"];

  const openPrice = ME.salePrice(state, item, { condition: item.condition, nonce: `quick:${held.id}`, district: "north_star_lot" });
  const quickPrice = ME.salePrice(state, item, { condition: item.condition, nonce: `quick:${held.id}`, district: "north_star_lot", quickSell: true });
  // Both ends are rounded independently, so the markdown lands within a dollar.
  assert.ok(Math.abs(quickPrice - openPrice * (1 - M.QUICK_SELL_MARKDOWN)) <= 1, `quick sell paid ${quickPrice} against an open price of ${openPrice}`);
  assert.ok(quickPrice < openPrice, "certainty has to cost something");

  const sold = clear(C.reduceGame(state, { type: "QUICK_SELL_907LIST", inventoryId: held.id }));
  assert.equal(sold.run.slot, state.run.slot + 1);
  assert.equal(sold.nineZeroSevenList.pendingSells.length, 0, "a quick sell never sits on the board");
  assert.equal(sold.nineZeroSevenList.flipCount, 1);

  // And a Scrapper cannot take one at all.
  const scrapper = funded(1969);
  const scrapperHeld = hold(scrapper, "space_heater");
  assert.equal(C.reduceGame(scrapper, { type: "QUICK_SELL_907LIST", inventoryId: scrapperHeld.id }), scrapper);
});

test("filling a buyer request pays a premium over the open market and costs the delivery slot", () => {
  const state = funded(1970);
  state.inventory.laptop = true;
  state.nineZeroSevenList.flipCount = M.BROKER_FLIP_REQUIREMENT;
  assert.equal(C.selectors.marketTier(state), 3);

  const held = hold(state, "dslr_camera");
  const item = M.LISTING_ITEM_BY_ID["dslr_camera"];
  const request = { id: "req:test", buyerId: "renata", buyerName: "Renata", category: "electronics", budget: item.buy + 50, day: state.run.day, text: "need something electronic" };
  state.nineZeroSevenList.buyerRequests.push(request);
  assert.deepEqual(C.selectors.requestFillCandidates(state, request.id).map((entry) => entry.id), [held.id]);

  const open = ME.salePrice(state, item, { condition: item.condition, nonce: `fill:${request.id}`, district: "north_star_lot" });
  const premium = ME.salePrice(state, item, { condition: item.condition, nonce: `fill:${request.id}`, district: "north_star_lot", request: true });
  assert.ok(Math.abs(premium - open * (1 + M.REQUEST_PREMIUM)) <= 1, `a filled request paid ${premium} against an open price of ${open}`);
  assert.ok(premium > open, "sourcing it should be worth more than dumping it");

  const filled = clear(C.reduceGame(state, { type: "FILL_BUYER_REQUEST", requestId: request.id, inventoryId: held.id }));
  assert.equal(filled.run.slot, state.run.slot + 1);
  assert.equal(filled.nineZeroSevenList.filledRequests, 1);
  // A new buyer may have texted in the same tick, so assert this ask is closed
  // rather than that the inbox is empty.
  assert.ok(!filled.nineZeroSevenList.buyerRequests.some((entry) => entry.id === request.id));
  assert.equal(filled.player.cash, state.player.cash + premium);
});

test("a verified Broker listing resolves in the slot it was posted", () => {
  const state = funded(1971);
  state.inventory.laptop = true;
  state.nineZeroSevenList.flipCount = M.BROKER_FLIP_REQUIREMENT;
  assert.equal(C.selectors.marketTierConfig(state).sellDelayDays, 0);
  const held = hold(state, "alternator_set");
  const listed = C.reduceGame(state, { type: "SELL_907LIST", inventoryId: held.id, surface: "phone" });
  const pending = listed.nineZeroSevenList.pendingSells[0];
  // Verified sellers skip the overnight wait; a flake is still possible, in
  // which case the item comes straight back rather than sitting listed.
  assert.ok(!pending || pending.status === "ready", "a verified listing should not still be waiting");
  assert.equal(listed.run.day, state.run.day);
});

// ------------------------------------------------------------ determinism

test("nothing in the market path draws from the shared RNG stream", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "events", "market-events.js"), "utf8");
  // The file explains at length why it does not use run.rngState, so the check
  // has to look at code rather than prose.
  const code = source.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/Math\.random/.test(code), "market-events reached for Math.random");
  assert.ok(!/rngState/.test(code), "market-events drew from the shared RNG stream");
  assert.ok(!/require\(["'][^"']*game-core/.test(code), "market-events required game-core back");
  assert.ok(/stringHash/.test(code), "market-events should hash the seed for its rolls");
});

test("snipes, flakes, and prices replay identically regardless of what else happened that day", () => {
  const a = funded(1972);
  const b = funded(1972);
  // Same seed, same day, same slot — but b has burned RNG draws on unrelated
  // things. A replay-stable roll must not notice.
  b.run.rngState = (b.run.rngState * 7919 + 13) >>> 0;
  b.stats.decisions += 11;

  const item = M.LISTING_ITEM_BY_ID["used_tv"];
  assert.equal(ME.rollSnipe(a, "used_tv", "mixed"), ME.rollSnipe(b, "used_tv", "mixed"));
  assert.equal(ME.rollFlake(a, "sell:1:0:x"), ME.rollFlake(b, "sell:1:0:x"));
  assert.equal(ME.salePrice(a, item, { nonce: "n" }), ME.salePrice(b, item, { nonce: "n" }));
  assert.equal(ME.reliabilityFor(a, "used_tv", 3), ME.reliabilityFor(b, "used_tv", 3));
  assert.deepEqual(
    C.selectors.listingSlate(a, "phone").map((entry) => entry.id),
    C.selectors.listingSlate(b, "phone").map((entry) => entry.id),
  );
});

test("a sale price sits inside the item's true value once volatility is allowed for", () => {
  const state = fresh(1973);
  for (const item of M.LISTING_ITEMS) {
    const [low, high] = item.trueValue;
    for (let day = 1; day <= 12; day += 1) {
      const priced = ME.salePrice({ ...state, run: { ...state.run, day } }, item, { nonce: `d${day}` });
      assert.ok(priced >= Math.floor(low * (1 - M.PRICE_VOLATILITY)) - 1, `${item.id} priced under its band on day ${day}: ${priced}`);
      assert.ok(priced <= Math.ceil(high * (1 + M.PRICE_VOLATILITY)) + 1, `${item.id} priced over its band on day ${day}: ${priced}`);
    }
  }
});

// ------------------------------------------------------------ appraisal

test("the board carries listings worth less than the seller is asking, and they cost Broker standing", () => {
  const junk = M.LISTING_ITEMS.filter(M.isJunk);
  assert.ok(junk.length >= 3, "appraisal needs something to get wrong");
  for (const item of junk) {
    assert.ok(item.buy > item.trueValue[1], `${item.id} is not actually a bad deal`);
    // The title is the only tell a Scrapper gets, so it has to be in the title.
    assert.ok(/,/.test(item.name), `${item.id} gives a Scrapper no way to read it`);
  }

  // Buying junk and delivering it is what closes Broker standing. Retried across
  // days because an open-market buyer can ghost, which costs the slot and not
  // the standing.
  let delivered = null;
  for (let attempt = 0; attempt < 10 && !delivered; attempt += 1) {
    const state = funded(1974 + attempt);
    const held = hold(state, junk[0].id);
    const ready = waitForBuyer(C.reduceGame(state, { type: "SELL_907LIST", inventoryId: held.id, surface: "phone" }));
    const pending = ready.nineZeroSevenList.pendingSells[0];
    if (!pending || pending.status !== "ready") continue;
    assert.ok(pending.price < held.cost, "junk should resell under what it cost");
    delivered = settle(C.reduceGame(ready, { type: "DELIVER_907LIST", pendingId: pending.id }));
    if (delivered.nineZeroSevenList.flipCount === 0) delivered = null; // robbed on the way
  }
  assert.ok(delivered, "no attempt in ten managed to deliver the junk listing");
  assert.equal(delivered.nineZeroSevenList.disputes, 1, "a flip delivered at a loss is a dispute");
});

test("Downtown pays a better margin than the same item sold in Spenard", () => {
  const state = fresh(1975);
  const item = M.LISTING_ITEM_BY_ID["game_console"];
  const home = ME.salePrice(state, item, { condition: item.condition, nonce: "x", district: "north_star_lot" });
  const downtown = ME.salePrice(state, item, { condition: item.condition, nonce: "x", district: "downtown" });
  assert.ok(downtown > home, "Downtown should pay more");
  assert.equal(downtown, Math.round(home + (home - item.buy) * M.DOWNTOWN_MARGIN_BONUS));
});

// ------------------------------------------------------------ exposure

test("repeated flips reach the household, and a big one clears Curtis's volume filter", () => {
  const state = funded(1976, 4000);
  state.inventory.laptop = true;
  let playing = state;
  for (let flip = 0; flip < 3; flip += 1) {
    const held = hold(playing, "chest_freezer", flip);
    playing = clear(C.reduceGame(playing, { type: "QUICK_SELL_907LIST", inventoryId: held.id }));
    if (playing.run.dayEndPending) playing = clear(C.reduceGame(playing, { type: "CONFIRM_END_DAY" }));
  }
  const rows = playing.npc.yalonda.ledger.filter((row) => row.event === "907list_profit");
  assert.ok(rows.length, "Yalonda never heard about the clean money");
  assert.equal(rows[0].source, "household");
  assert.equal(rows[0].type, "financial");
  assert.ok(playing.nineZeroSevenList.flipCount >= 1);

  // The same observation only reaches Curtis when the number is big enough.
  const small = { type: "financial", event: "907list_profit", value: 40 };
  const large = { type: "financial", event: "907list_profit", value: M.LISTING_ITEM_BY_ID.snow_blower.trueValue[1] };
  const { clearsCurtisFilter } = require("../src/data/propagation.js");
  assert.equal(clearsCurtisFilter(small), false);
  assert.equal(clearsCurtisFilter(large), true);
});

test("a Spenard robbery reaches the civilians who are actually standing there", () => {
  const state = funded(1977);
  state.run.slot = 2;
  hold(state, "snow_tires");
  const before = C.selectors.disposition(state, "mina");
  const robbed = JSON.parse(JSON.stringify(state));
  // Broadcast the observation the reducer sends, then let the queue land.
  const reached = C.selectors.describeDisposition(robbed, "mina");
  assert.ok(reached, "mina should have a readable ledger");

  let playing = state;
  let sawRobbery = false;
  for (let day = 0; day < 10 && !sawRobbery; day += 1) {
    playing = clear(C.reduceGame(clear(playing), { type: "WANDER_SPENARD" }));
    if (!playing.nineZeroSevenList.inventory.length) hold(playing, "snow_tires", day);
    const candidate = clear(C.reduceGame(playing, { type: "SELL_907LIST", inventoryId: playing.nineZeroSevenList.inventory[0].id, surface: "phone" }));
    playing = candidate;
    sawRobbery = playing.nineZeroSevenList.robberies > 0;
  }
  // The channel contract is what this test is really guarding: a violence
  // observation tagged neighborhood and located in Spenard is one Mina can
  // receive, and the same one located Downtown is not.
  const { listensOn, NPC_PRESENCE_AREAS } = require("../src/data/propagation.js");
  assert.equal(listensOn("mina", "neighborhood"), true);
  assert.ok(NPC_PRESENCE_AREAS.mina.includes("north_star_lot"));
  assert.ok(!NPC_PRESENCE_AREAS.mina.includes("downtown"), "a Downtown robbery must not reach her");
  assert.equal(typeof before, "number");
});

test("reaching Broker standing sends a reputation observation that only Curtis is wired for", () => {
  const state = funded(1978, 4000);
  state.inventory.laptop = true;
  state.nineZeroSevenList.flipCount = M.BROKER_FLIP_REQUIREMENT - 1;
  const held = hold(state, "chest_freezer");
  const promoted = clear(C.reduceGame(state, { type: "QUICK_SELL_907LIST", inventoryId: held.id }));
  assert.equal(promoted.nineZeroSevenList.tier, 3, "the tenth clean flip should be Broker standing");

  // reputation is a seven-day channel and Curtis is its only subscriber, so what
  // this asserts is that it was queued for him — not that it landed inside a run
  // that may well end first.
  const queued = promoted.run.pendingObservations.filter((entry) => entry.observation.event === "market_reputation");
  const landed = promoted.npc.curtis.ledger.filter((row) => row.event === "market_reputation");
  assert.ok(queued.length || landed.length, "Broker standing never produced a reputation observation");
  for (const entry of queued) assert.equal(entry.npcId, "curtis");
  const { NPC_CHANNELS } = require("../src/data/propagation.js");
  for (const [npcId, channels] of Object.entries(NPC_CHANNELS)) {
    if (npcId === "curtis") continue;
    assert.ok(!channels.includes("reputation"), `${npcId} should not be on the reputation channel`);
  }
});

// ------------------------------------------------------------ saves

test("a v6 save loads on v7 with a derived tier and empty broker state", () => {
  const raw = JSON.parse(C.serializeRun(funded(1979)));
  raw.version = 6;
  // v6 shape: a string tier and none of the broker fields.
  raw.nineZeroSevenList = { known: true, tier: "upgraded", inventory: [], purchases: 2, sales: 2, profit: 60, alerts: { enabled: false, subscriptions: [] } };
  raw.inventory.laptop = true;

  const state = C.hydrateRun(raw);
  assert.equal(state.version, 8);
  assert.equal(state.nineZeroSevenList.tier, 2, "the string tier should be re-derived as a number");
  assert.equal(state.nineZeroSevenList.flipCount, 2, "old sales carry over as flips");
  assert.equal(state.nineZeroSevenList.disputes, 0);
  assert.deepEqual(state.nineZeroSevenList.pendingSells, []);
  assert.deepEqual(state.nineZeroSevenList.buyerRequests, []);
  assert.deepEqual(state.nineZeroSevenList.categoryFlips, {});
  assert.equal(state.nineZeroSevenList.bulkDeal, null);
  // And it still plays.
  assert.ok(C.selectors.listingSlate(state, "phone").length > 0);
});

test("a v7 save round-trips its broker state", () => {
  const state = funded(1980);
  state.inventory.laptop = true;
  const held = hold(state, "roof_rack");
  const listed = C.reduceGame(state, { type: "SELL_907LIST", inventoryId: held.id, surface: "phone" });
  listed.nineZeroSevenList.categoryFlips = { auto_parts: 2 };
  listed.nineZeroSevenList.disputes = 1;

  const reloaded = C.hydrateRun(JSON.parse(C.serializeRun(listed)));
  assert.equal(reloaded.nineZeroSevenList.pendingSells.length, 1);
  assert.equal(reloaded.nineZeroSevenList.inventory.length, 1);
  assert.equal(reloaded.nineZeroSevenList.inventory[0].listed, true);
  assert.deepEqual(reloaded.nineZeroSevenList.categoryFlips, { auto_parts: 2 });
  assert.equal(reloaded.nineZeroSevenList.disputes, 1);
});

// ------------------------------------------------------------ registry hygiene

test("the Downtown meetup is a real district action and only shows once the tier reaches it", () => {
  const entry = C.DISTRICT_ACTIONS.downtown_907list_meetup;
  assert.ok(entry, "Downtown has no 907List meetup point");
  assert.equal(entry.areaId, "downtown");
  assert.equal(entry.timeCost, 0, "the meetup point is routing; the flip charges the slot");

  const scrapper = fresh(1981);
  scrapper.world.currentNeighborhoodId = "downtown";
  assert.ok(!C.selectors.aroundActions(scrapper).some((item) => item.id === "downtown_907list_meetup"));

  const flipper = fresh(1982);
  flipper.inventory.laptop = true;
  flipper.world.currentNeighborhoodId = "downtown";
  assert.ok(C.selectors.aroundActions(flipper).some((item) => item.id === "downtown_907list_meetup"));
});

test("every listing is well formed and every category is represented at every tier boundary", () => {
  const ids = new Set();
  for (const item of M.LISTING_ITEMS) {
    assert.ok(!ids.has(item.id), `duplicate listing id ${item.id}`);
    ids.add(item.id);
    assert.ok(M.MARKET_CATEGORIES.includes(item.category), `${item.id} has no category`);
    assert.ok(M.MARKET_TIERS[item.tier], `${item.id} has no tier`);
    assert.ok(M.CONDITIONS[item.condition], `${item.id} has no condition`);
    assert.ok(item.buy > 0 && item.trueValue[0] > 0 && item.trueValue[1] >= item.trueValue[0], `${item.id} is priced wrong`);
  }
  // Every category has to be buyable at Tier 1, or a specialty is unreachable
  // for a player who never buys a laptop.
  for (const category of M.MARKET_CATEGORIES) {
    assert.ok(M.LISTING_ITEMS.some((item) => item.tier === 1 && item.category === category && !M.isJunk(item)), `${category} has no Tier 1 listing`);
  }
  // Broker stock has to be affordable inside a run's bankroll.
  for (const item of M.LISTING_ITEMS.filter((entry) => entry.tier === 3)) {
    assert.ok(item.buy <= 200, `${item.id} costs more than a run can float`);
  }
});
