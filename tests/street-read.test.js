const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

const SR = C.streetRead;

function fresh(seed = 907) {
  return C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Rookie" });
}
// Minimum setup for a purchasable market. Trading is gated behind an accepted
// plug, so a Street Read trading test has to get past that gate first.
function openMarket(state) {
  state.market.visible = true;
  state.plugs.unlocked = ["goodie"];
  state.world.productAccess.weed = true;
  state.world.markets[state.world.currentNeighborhoodId].availability.weed = 10;
  return state;
}
function quietAdvance(state, reason = "END_MARKET") {
  state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.pendingOperationResult = null;
  let next = C.advanceRun(state, { reason, suppressStory: true });
  if (next.run.dayEndPending && !next.run.pendingEvent && !next.run.pendingEncounter && !next.run.pendingOperationResult) next = C.reduceGame(next, { type: "CONFIRM_END_DAY" });
  return next;
}
// Builds a state whose Street Read is exactly the shape a test wants, without
// having to play a run into that shape.
function stateWith(entries, { day = 1, lastVarietyDay = 1 } = {}) {
  const state = fresh(4242);
  state.run.day = day;
  for (const [category, keys] of Object.entries(entries)) {
    for (const key of keys) state.streetRead.categories[category].add(key);
  }
  state.streetRead.lastVarietyDay = lastVarietyDay;
  return state;
}
// n distinct filler keys for a category, for score-shape tests.
function fill(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`);
}

// ---------------------------------------------------------------------------
// 1. Score calculation
// ---------------------------------------------------------------------------

test("an untouched run scores zero and sits at tier zero", () => {
  const state = fresh(1001);
  SR.recalculateStreetRead(state);
  assert.equal(state.streetRead.score, 0);
  assert.equal(state.streetRead.tier, 0);
  assert.equal(state.streetRead.totalLifetimeEntries, 0);
});

test("four of seven categories met with fifteen entries lands in tier 1", () => {
  // 4/7 categories * 60 = 34.29 breadth, + 15 depth = 49.29 -> 49.
  const state = stateWith({
    trading: fill("spenard:p", 3),
    social: fill("npc", 2),
    exploration: fill("area:a", 3),
    routine: fill("slot:act", 4),
    recovery: [],
    income: [],
    risk: fill("risk:ctx", 3),
  });
  // trading/social/exploration/routine meet their thresholds; risk also meets
  // its threshold of 1, so trim risk back out to land on exactly four.
  state.streetRead.categories.risk.clear();
  for (const key of fill("pad", 3)) state.streetRead.categories.trading.add(key);
  SR.recalculateStreetRead(state);
  assert.equal(state.streetRead.score, 49);
  assert.equal(state.streetRead.tier, 1);
});

test("all seven categories with deep coverage saturates at 100 and tier 3", () => {
  const state = stateWith({
    trading: fill("t", 8), social: fill("s", 8), exploration: fill("e", 8),
    risk: fill("r", 8), routine: fill("o", 8), recovery: fill("c", 8), income: fill("i", 8),
  });
  SR.recalculateStreetRead(state);
  assert.equal(state.streetRead.score, 100, "60 breadth + 40 capped depth");
  assert.equal(state.streetRead.tier, 3);
});

test("score is clamped at both ends regardless of inputs", () => {
  const saturated = stateWith({
    trading: fill("t", 40), social: fill("s", 40), exploration: fill("e", 40),
    risk: fill("r", 40), routine: fill("o", 40), recovery: fill("c", 40), income: fill("i", 40),
  });
  SR.recalculateStreetRead(saturated);
  assert.equal(saturated.streetRead.score, 100);

  // A single stale entry cannot push the score below zero.
  const decayed = stateWith({ recovery: ["hospital"] }, { day: 7, lastVarietyDay: 1 });
  SR.recalculateStreetRead(decayed);
  assert.equal(decayed.streetRead.score, 0);
  assert.equal(decayed.streetRead.tier, 0);
});

test("depth contribution is capped at 40 so breadth cannot be bought with volume", () => {
  const wide = stateWith({
    trading: fill("t", 3), social: fill("s", 2), exploration: fill("e", 3),
    risk: ["r"], routine: fill("o", 4), recovery: ["c"], income: ["i"],
  });
  const deep = stateWith({ trading: fill("t", 60) });
  SR.recalculateStreetRead(wide);
  SR.recalculateStreetRead(deep);
  assert.equal(wide.streetRead.score, 75, "7/7 breadth + 15 entries");
  assert.ok(deep.streetRead.score < wide.streetRead.score, "one deep category never beats full breadth");
});

// ---------------------------------------------------------------------------
// 2. Staleness decay
// ---------------------------------------------------------------------------

test("variety on the current day carries no staleness penalty", () => {
  const state = stateWith({ trading: fill("t", 3), social: fill("s", 2) }, { day: 4, lastVarietyDay: 4 });
  SR.recalculateStreetRead(state);
  // 2/7 * 60 = 17.14 breadth + 5 depth = 22.14 -> 22, no penalty.
  assert.equal(state.streetRead.score, 22);
});

test("three days without a new entry costs exactly ten points", () => {
  const active = stateWith({ trading: fill("t", 3), social: fill("s", 2) }, { day: 4, lastVarietyDay: 4 });
  const stale = stateWith({ trading: fill("t", 3), social: fill("s", 2) }, { day: 4, lastVarietyDay: 1 });
  SR.recalculateStreetRead(active);
  SR.recalculateStreetRead(stale);
  assert.equal(active.streetRead.score - stale.streetRead.score, 10, "(3 - 1) * 5");
});

test("a one-day gap is forgiven; the penalty starts at two", () => {
  const oneDay = stateWith({ trading: fill("t", 3), social: fill("s", 2) }, { day: 3, lastVarietyDay: 2 });
  const twoDay = stateWith({ trading: fill("t", 3), social: fill("s", 2) }, { day: 3, lastVarietyDay: 1 });
  SR.recalculateStreetRead(oneDay);
  SR.recalculateStreetRead(twoDay);
  assert.equal(oneDay.streetRead.score, 22, "idle of 1 is not stale");
  assert.equal(oneDay.streetRead.score - twoDay.streetRead.score, 5);
});

test("staleness can drop a run back down a tier", () => {
  const entries = { trading: fill("t", 3), social: fill("s", 2), exploration: fill("e", 3), routine: fill("o", 4) };
  const active = stateWith(entries, { day: 3, lastVarietyDay: 3 });
  SR.recalculateStreetRead(active);
  assert.equal(active.streetRead.tier, 1, "4/7 breadth + 12 depth = 46");

  const stale = stateWith(entries, { day: 9, lastVarietyDay: 3 });
  SR.recalculateStreetRead(stale);
  assert.equal(stale.streetRead.tier, 0, "six idle days decay it out of tier 1");
  assert.ok(stale.streetRead.score < 25);
});

// ---------------------------------------------------------------------------
// 3. Tier output gating
// ---------------------------------------------------------------------------

test("tier 0 price signals carry no magnitude language at all", () => {
  const state = fresh(2002);
  assert.equal(state.streetRead.tier, 0);
  for (const area of C.NEIGHBORHOODS) {
    for (const product of C.PRODUCTS) {
      const signal = C.selectors.priceSignal(state, area.id, product.id);
      assert.equal(signal.magnitude, undefined);
      assert.match(signal.label, /^(HIGH|LOW|RISING|FALLING|STEADY|—)$/);
    }
  }
});

test("tier 1 enhances exactly one product per area, not all of them", () => {
  const state = fresh(2003);
  state.streetRead.tier = 1;
  for (const area of C.NEIGHBORHOODS) {
    const enhanced = C.PRODUCTS.filter((product) => C.selectors.priceSignal(state, area.id, product.id).magnitude);
    assert.ok(enhanced.length <= 1, `${area.id} enhanced ${enhanced.length} products`);
  }
});

test("magnitude wording tracks how far the price has actually moved", () => {
  assert.equal(SR.streetReadTier({ streetRead: { tier: 2 } }), 2);
  const state = fresh(2004);
  state.streetRead.tier = 1;
  // Drive one area's price far from its anchor and confirm the hinted product,
  // whichever it is, reports the strongest magnitude band.
  const area = C.NEIGHBORHOODS[0];
  const market = state.world.markets[area.id];
  for (const product of C.PRODUCTS) market.prices[product.id] = product.base * area.bias[product.id] * 2;
  const hinted = C.PRODUCTS.map((product) => C.selectors.priceSignal(state, area.id, product.id)).filter((signal) => signal.magnitude);
  assert.equal(hinted.length, 1);
  assert.equal(hinted[0].magnitude, "way");
  assert.match(hinted[0].label, /WAY$/);
});

test("tier 3 reports direction on drift the standard signal rounds off to steady", () => {
  const base = fresh(2005);
  const area = C.NEIGHBORHOODS[1];
  const product = C.PRODUCTS[0];
  const anchor = product.base * area.bias[product.id];
  const configure = (state) => {
    const market = state.world.markets[area.id];
    market.prices[product.id] = anchor;
    market.history[product.id] = [anchor * 0.97, anchor * 0.97];
    market.prices[product.id] = anchor;
  };
  configure(base);
  assert.equal(C.selectors.priceSignal(base, area.id, product.id).id, "normal", "a 3% drift is STEADY at tier 0");

  const dialed = fresh(2005);
  configure(dialed);
  dialed.streetRead.tier = 3;
  assert.equal(C.selectors.priceSignal(dialed, area.id, product.id).id, "up", "tier 3 reads the same drift as rising");
});

test("tier 2 multiplies opportunity and punishment weights and leaves story alone", () => {
  const state = fresh(2006);
  const opportunity = { classification: "opportunity", chain: null };
  const punishment = { classification: "threat", chain: null };
  const story = { classification: "main_chapter", chain: "dre" };
  const neutral = { classification: "ambient", chain: null };

  for (const descriptor of [opportunity, punishment, story, neutral]) {
    assert.equal(SR.streetReadWeightMultiplier(state, descriptor), 1, "tier 0 changes nothing");
  }

  state.streetRead.tier = 2;
  assert.equal(SR.streetReadWeightMultiplier(state, opportunity), 1.15);
  assert.equal(SR.streetReadWeightMultiplier(state, punishment), 0.90);
  assert.equal(SR.streetReadWeightMultiplier(state, story), 1, "authored arcs are never reweighted");
  assert.equal(SR.streetReadWeightMultiplier(state, neutral), 1);
});

test("every registry beat resolves to exactly one category, and chains are always story", () => {
  const allowed = new Set(["opportunity", "punishment", "story", "neutral"]);
  for (const descriptor of C.STORY_REGISTRY) {
    const category = SR.streetReadEventCategory(descriptor);
    assert.ok(allowed.has(category), `${descriptor.id} -> ${category}`);
    if (descriptor.chain) assert.equal(category, "story", `${descriptor.id} is a chain beat`);
  }
});

test("tier 3 softens an access threshold by exactly one and never more", () => {
  const state = fresh(2007);
  assert.equal(SR.streetReadAccessBonus(state), 0);
  for (const tier of [1, 2]) {
    state.streetRead.tier = tier;
    assert.equal(SR.streetReadAccessBonus(state), 0, `tier ${tier} does not soften access`);
  }
  state.streetRead.tier = 3;
  assert.equal(SR.streetReadAccessBonus(state), 1);
  // The reduction is capped: it does not scale past a single point.
  state.streetRead.score = 100;
  assert.equal(SR.streetReadAccessBonus(state), 1);
});

test("tier 3 lowers Eli's promotion bar by one without changing what the player is told", () => {
  const state = fresh(2008);
  state.people.crew.eli.recruited = true;
  state.people.crew.eli.status = "active";
  state.people.crew.eli.loyalty = C.ELI_LIEUTENANT_UNLOCK.minLoyalty - 1;
  const blocked = C.selectors.eliPromotionAvailability(state);
  assert.equal(blocked.available, false);
  assert.doesNotMatch(blocked.reason, /street read|tier|variety/i);

  state.streetRead.tier = 3;
  assert.equal(C.selectors.eliPromotionAvailability(state).available, true);
});

test("street knowledge no longer changes field capacity but keeps its recovery discount", () => {
  const state = fresh(2009);
  assert.equal(C.selectors.crewCapacityFor(state), 2);
  assert.equal(C.selectors.treatmentCost(state, 200), 200);
  assert.equal(C.selectors.debtGuidanceAvailable(state), false);

  state.streetRead.tier = 3;
  assert.equal(C.selectors.crewCapacityFor(state), 2);
  state.base.tracks.operations = 2;
  assert.equal(C.selectors.crewCapacityFor(state), 4);
  assert.equal(C.selectors.treatmentCost(state, 200), 180);
  assert.equal(C.selectors.debtGuidanceAvailable(state), false, "Week Zero has no Dre debt guidance");
  state.phase = "pressure";
  state.lender.status = "active";
  state.lender.balance = 1200;
  assert.equal(C.selectors.debtGuidanceAvailable(state), true);
});

test("tier 2 puts one rotating bonus item on the shelf at a discount", () => {
  const state = fresh(2010);
  assert.deepEqual(SR.streetReadBonusStock(state), [], "nothing extra below tier 2");
  assert.equal(C.selectors.gearShopStock(state).filter((item) => item.discounted).length, 0);

  state.streetRead.tier = 2;
  const seen = new Set();
  for (let day = 1; day <= C.RUN_DAYS; day += 1) {
    state.run.day = day;
    const stock = SR.streetReadBonusStock(state);
    assert.equal(stock.length, 1, `day ${day} offers exactly one bonus item`);
    seen.add(stock[0]);
    const discounted = C.selectors.gearShopStock(state).filter((item) => item.discounted);
    assert.equal(discounted.length, 1);
    assert.equal(discounted[0].id, stock[0]);
    assert.ok(discounted[0].price < discounted[0].cost);
  }
  assert.equal(seen.size, SR.BONUS_STOCK.length, "the pool rotates across a run");
});

test("tier 1 recall lines only appear for contacts the run has actually dealt with", () => {
  const state = fresh(2011);
  state.streetRead.categories.social.add("mina:conversation");
  state.streetRead.categories.social.add("goodie:business");
  assert.equal(SR.streetReadRecall(state, "goodie"), null, "tier 0 surfaces nothing");

  state.streetRead.tier = 1;
  assert.ok(SR.streetReadRecall(state, "goodie"), "a known contact gains a line");
  assert.equal(SR.streetReadRecall(state, "curtis"), null, "an unmet contact does not");
  assert.equal(SR.streetReadRecall(state, "nobody"), null);
});

test("street-smart choices are appended only at tier 3 and never to chain beats", () => {
  const state = fresh(2012);
  const smartIds = Object.keys(SR.SMART_CHOICES);
  assert.ok(smartIds.length >= 3 && smartIds.length <= 4, "3-4 events, as scoped");

  for (const id of smartIds) {
    const descriptor = C.STORY_REGISTRY.find((item) => item.id === id);
    assert.ok(descriptor, `${id} exists in the registry`);
    assert.equal(descriptor.chain, null, `${id} is not part of an authored arc`);

    const event = C.buildEventForTest(id, state);
    const baseline = SR.withStreetSmartChoice(state, event, descriptor);
    assert.equal(baseline.choices.length, event.choices.length, "tier 0 sees the authored choice list");
    assert.ok(event.choices.length >= 3, `${id} has 3+ choices`);

    state.streetRead.tier = 3;
    const enriched = SR.withStreetSmartChoice(state, event, descriptor);
    assert.equal(enriched.choices.length, event.choices.length + 1);
    // Appended, so existing choice indices stay stable for every other test.
    assert.deepEqual(enriched.choices.slice(0, event.choices.length).map((c) => c.label), event.choices.map((c) => c.label));
    const extra = enriched.choices[enriched.choices.length - 1];
    assert.ok(extra.label && extra.preview && extra.result, "the extra choice is fully authored");
    state.streetRead.tier = 0;
  }
});

test("a tier 3 chain beat never gains an extra choice", () => {
  const state = fresh(2013);
  state.streetRead.tier = 3;
  const chained = C.STORY_REGISTRY.filter((item) => item.chain);
  assert.ok(chained.length > 0);
  for (const descriptor of chained) {
    const event = { id: descriptor.id, choices: [{ label: "a" }, { label: "b" }, { label: "c" }] };
    assert.equal(SR.withStreetSmartChoice(state, event, descriptor).choices.length, 3, descriptor.id);
  }
});

// ---------------------------------------------------------------------------
// 4. Set deduplication
// ---------------------------------------------------------------------------

test("a repeated key never grows the set or the lifetime counter", () => {
  const state = fresh(3001);
  assert.equal(SR.addStreetReadEntry(state, "trading", "spenard:weed"), true);
  assert.equal(SR.addStreetReadEntry(state, "trading", "spenard:weed"), false);
  assert.equal(state.streetRead.categories.trading.size, 1);
  assert.equal(state.streetRead.totalLifetimeEntries, 1);

  assert.equal(SR.addStreetReadEntry(state, "trading", "downtown:weed"), true);
  assert.equal(state.streetRead.categories.trading.size, 2);
  assert.equal(state.streetRead.totalLifetimeEntries, 2);
});

test("buying and selling the same product in one area counts once", () => {
  let state = openMarket(fresh(3002));
  state.player.cash = 5000;
  const area = state.world.currentNeighborhoodId;
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 2 });
  const afterBuy = state.streetRead.categories.trading.size;
  state = C.reduceGame(state, { type: "SELL", productId: "weed", qty: 1 });
  assert.equal(state.streetRead.categories.trading.size, afterBuy, "same area + product is one entry");
  assert.ok(state.streetRead.categories.trading.has(`${area}:weed`));
});

test("unknown categories and empty keys are rejected without mutating anything", () => {
  const state = fresh(3003);
  assert.equal(SR.addStreetReadEntry(state, "nonsense", "a:b"), false);
  assert.equal(SR.addStreetReadEntry(state, "trading", ""), false);
  assert.equal(SR.addStreetReadEntry(state, "trading", null), false);
  assert.equal(state.streetRead.totalLifetimeEntries, 0);
});

test("adding a genuinely new entry stamps the current day as the last variety day", () => {
  const state = fresh(3004);
  state.run.day = 5;
  SR.addStreetReadEntry(state, "recovery", "hospital");
  assert.equal(state.streetRead.lastVarietyDay, 5);

  state.run.day = 6;
  SR.addStreetReadEntry(state, "recovery", "hospital");
  assert.equal(state.streetRead.lastVarietyDay, 5, "a duplicate does not refresh the clock");
});

// ---------------------------------------------------------------------------
// 5. Reset behavior
// ---------------------------------------------------------------------------

test("a new run starts with empty sets and a zeroed score", () => {
  const state = C.createRun({ seed: 3101 });
  assert.equal(state.streetRead.score, 0);
  assert.equal(state.streetRead.tier, 0);
  assert.equal(state.streetRead.lastVarietyDay, 0);
  assert.equal(state.streetRead.totalLifetimeEntries, 0);
  for (const [category, set] of Object.entries(state.streetRead.categories)) {
    assert.ok(set instanceof Set, `${category} is a Set`);
    assert.equal(set.size, 0);
  }
  assert.deepEqual(Object.keys(state.streetRead.categories).sort(), Object.keys(SR.CATEGORIES).sort());
});

test("a fresh run does not inherit the previous run's street read", () => {
  const played = fresh(3102);
  SR.addStreetReadEntry(played, "trading", "spenard:weed");
  SR.addStreetReadEntry(played, "risk", "robbery:downtown");
  assert.equal(played.streetRead.totalLifetimeEntries, 2);

  const next = C.reduceGame(played, { type: "NEW_RUN", seed: 3103 });
  assert.equal(next.streetRead.totalLifetimeEntries, 0);
  assert.equal(next.streetRead.categories.trading.size, 0);
  assert.equal(next.streetRead.categories.risk.size, 0);
});

test("street read survives a mid-run continuation rather than resetting on it", () => {
  // The Day 7 "Keep Moving" fork is not implemented yet, so this pins the
  // property that fork will depend on: advancing the clock past a day boundary
  // preserves accumulated variety instead of clearing it.
  let state = fresh(3104);
  SR.addStreetReadEntry(state, "trading", "spenard:weed");
  SR.addStreetReadEntry(state, "social", "goodie:business");
  const before = state.streetRead.totalLifetimeEntries;

  for (let tick = 0; tick < 5; tick += 1) state = quietAdvance(state);
  assert.ok(state.run.day > 1, "the run crossed at least one day boundary");
  assert.ok(state.streetRead.totalLifetimeEntries >= before, "entries are never cleared by the clock");
  assert.ok(state.streetRead.categories.trading.has("spenard:weed"));
  assert.ok(state.streetRead.categories.social.has("goodie:business"));
});

// ---------------------------------------------------------------------------
// 6. Save/Load round-trip
// ---------------------------------------------------------------------------

test("a populated street read survives a serialize/deserialize round trip", () => {
  const state = fresh(3201);
  SR.addStreetReadEntry(state, "trading", "spenard:weed");
  SR.addStreetReadEntry(state, "trading", "downtown:cocaine");
  SR.addStreetReadEntry(state, "social", "mina:conversation");
  SR.addStreetReadEntry(state, "risk", "robbery:downtown");
  SR.recalculateStreetRead(state);

  const restored = SR.deserializeStreetRead(JSON.parse(JSON.stringify(SR.serializeStreetRead(state.streetRead))));
  for (const category of Object.keys(SR.CATEGORIES)) {
    assert.deepEqual([...restored.categories[category]].sort(), [...state.streetRead.categories[category]].sort(), category);
    assert.ok(restored.categories[category] instanceof Set);
  }
  assert.equal(restored.score, state.streetRead.score);
  assert.equal(restored.tier, state.streetRead.tier);
  assert.equal(restored.totalLifetimeEntries, state.streetRead.totalLifetimeEntries);
  assert.equal(restored.lastVarietyDay, state.streetRead.lastVarietyDay);
});

test("serializeRun writes street read as plain arrays that hydrate back into Sets", () => {
  const state = fresh(3202);
  SR.addStreetReadEntry(state, "exploration", "downtown:gear_shop");
  SR.addStreetReadEntry(state, "income", "job:spenard");

  const raw = JSON.parse(C.serializeRun(state));
  assert.ok(Array.isArray(raw.streetRead.categories.exploration), "serialized as an array, not {}");
  assert.deepEqual(raw.streetRead.categories.exploration, ["downtown:gear_shop"]);

  const hydrated = C.hydrateRun(raw);
  assert.ok(hydrated.streetRead.categories.exploration instanceof Set);
  assert.ok(hydrated.streetRead.categories.exploration.has("downtown:gear_shop"));
  assert.ok(hydrated.streetRead.categories.income.has("job:spenard"));
});

test("a pre-Street-Read save loads with a fresh system instead of crashing", () => {
  const state = fresh(3203);
  const legacy = JSON.parse(C.serializeRun(state));
  delete legacy.streetRead;

  const hydrated = C.hydrateRun(legacy);
  assert.ok(hydrated, "the save still hydrates");
  assert.equal(hydrated.streetRead.score, 0);
  assert.equal(hydrated.streetRead.tier, 0);
  assert.equal(hydrated.streetRead.totalLifetimeEntries, 0);
  for (const set of Object.values(hydrated.streetRead.categories)) {
    assert.ok(set instanceof Set);
    assert.equal(set.size, 0);
  }
  // And it is immediately usable, not just non-crashing.
  assert.equal(SR.addStreetReadEntry(hydrated, "trading", "spenard:weed"), true);
});

test("deserialization survives corrupt, partial, and Set-flattened payloads", () => {
  for (const payload of [null, undefined, {}, "nonsense", 12, { categories: null }, { categories: { trading: {} } }, { categories: { trading: ["ok", 5, null] } }]) {
    const restored = SR.deserializeStreetRead(payload);
    for (const set of Object.values(restored.categories)) assert.ok(set instanceof Set);
    assert.equal(typeof restored.score, "number");
    assert.equal(typeof restored.tier, "number");
  }
  // Non-string members are dropped rather than stored.
  const filtered = SR.deserializeStreetRead({ categories: { trading: ["ok", 5, null] } });
  assert.deepEqual([...filtered.categories.trading], ["ok"]);
});

test("the reducer accepts a raw parsed save that never went through hydrateRun", () => {
  const state = openMarket(fresh(3204));
  state.player.cash = 3000;
  const raw = JSON.parse(C.serializeRun(state));
  const next = C.reduceGame(raw, { type: "BUY", productId: "weed", qty: 1 });
  assert.ok(next.streetRead.categories.trading instanceof Set);
  assert.equal(next.streetRead.categories.trading.size, 1);
});

// ---------------------------------------------------------------------------
// 7. Nightly recalculation
// ---------------------------------------------------------------------------

test("the score updates on the nightly tick, not on the action that earned it", () => {
  let state = fresh(3301);
  for (const key of fill("t", 3)) SR.addStreetReadEntry(state, "trading", key);
  for (const key of fill("s", 2)) SR.addStreetReadEntry(state, "social", key);
  assert.equal(state.streetRead.score, 0, "entries alone do not move the score");

  while (state.run.day === 1 && state.run.status === "playing") state = quietAdvance(state);
  assert.ok(state.streetRead.score > 0, "the night crossing scored it");
});

test("the day-crossing tick still scores street read, and no identity pass runs beside it", () => {
  // v1.10 retired the nightly identity assignment: Street Identity is derived on
  // read now, so there is no longer an ordering to pin here. What remains worth
  // guarding is that nothing reintroduced an assignment pass into the tick.
  const core = fs.readFileSync(path.join(__dirname, "..", "game-core.js"), "utf8");
  const block = core.slice(core.indexOf("function confirmDayEnd("));
  assert.ok(block.indexOf("recalculateStreetRead(state)") >= 0, "street read is recalculated on the day-crossing tick");
  assert.equal(block.indexOf("evaluateStreetIdentity"), -1, "the nightly identity assignment loop must stay gone");
  assert.equal(core.indexOf("assignIdentity"), -1, "nothing may write a stored street identity");

  // And the tick does in fact score the run.
  let state = fresh(3302);
  for (const key of fill("t", 4)) SR.addStreetReadEntry(state, "trading", key);
  while (state.run.day === 1 && state.run.status === "playing") state = quietAdvance(state);
  assert.ok(state.streetRead.score > 0);
});

test("identity and street read do not read each other's data", () => {
  const state = fresh(3303);
  for (const key of fill("t", 8)) SR.addStreetReadEntry(state, "trading", key);
  SR.recalculateStreetRead(state);
  // Breadth is not behavior. Street Read moving cannot move the identity, which
  // reads attributes and the observation ledgers and nothing else.
  const before = C.selectors.streetIdentity(state);
  for (const key of fill("u", 8)) SR.addStreetReadEntry(state, "trading", key);
  SR.recalculateStreetRead(state);
  assert.equal(C.selectors.streetIdentity(state), before, "breadth alone never changes the label");

  const identityDriven = fresh(3304);
  C.recordBehaviorForTest(identityDriven, "mover", 3, "test:mover:1", "sale");
  C.recordBehaviorForTest(identityDriven, "mover", 3, "test:mover:2", "sale");
  assert.equal(identityDriven.streetRead.totalLifetimeEntries, 0, "behavior scoring never feeds street read");
});

test("routine entries are stamped with the day the slot was actually spent", () => {
  let state = fresh(3305);
  state.run.slot = 3;
  const day = state.run.day;
  state = quietAdvance(state);
  assert.ok(state.run.day > day, "the clock crossed into a new day");
  assert.equal(state.streetRead.lastVarietyDay, day, "the entry belongs to the day it happened");
  assert.ok(state.streetRead.categories.routine.has("night:trade"));
});

// ---------------------------------------------------------------------------
// 8. Feed message rate limiting
// ---------------------------------------------------------------------------

test("tier 2 contact intel fires at most once per day", () => {
  let state = fresh(3401);
  state.streetRead.tier = 2;
  SR.addStreetReadEntry(state, "social", "goodie:business");
  const intelLines = new Set(Object.values(SR.INTEL).flat());
  const countIntel = (value) => value.log.filter((entry) => intelLines.has(entry.text)).length;

  const startDay = state.run.day;
  let guard = 0;
  while (state.run.day === startDay && state.run.status === "playing" && guard++ < 8) state = quietAdvance(state);
  assert.ok(countIntel(state) <= 1, `expected at most one line on day ${startDay}, saw ${countIntel(state)}`);
  assert.equal(state.streetRead.intelDay, startDay);
});

test("the once-per-day intel flag resets when the day does", () => {
  let state = fresh(3402);
  state.streetRead.tier = 2;
  SR.addStreetReadEntry(state, "social", "goodie:business");
  const random = { int: () => 0, next: () => 0 };

  SR.maybeStreetReadIntel(state, random);
  assert.equal(state.streetRead.intelDay, state.run.day);
  const afterFirst = state.log.length;

  SR.maybeStreetReadIntel(state, random);
  assert.equal(state.log.length, afterFirst, "a second call on the same day is a no-op");

  state.run.day += 1;
  SR.maybeStreetReadIntel(state, random);
  assert.ok(state.log.length > afterFirst, "the new day allows one more line");
  assert.equal(state.streetRead.intelDay, state.run.day);
});

test("intel stays silent below tier 2 and for a run that knows nobody", () => {
  const lowTier = fresh(3403);
  lowTier.streetRead.tier = 1;
  SR.addStreetReadEntry(lowTier, "social", "goodie:business");
  const before = lowTier.log.length;
  SR.maybeStreetReadIntel(lowTier, { int: () => 0, next: () => 0 });
  assert.equal(lowTier.log.length, before, "tier 1 volunteers nothing");

  const noContacts = fresh(3404);
  noContacts.streetRead.tier = 3;
  const baseline = noContacts.log.length;
  SR.maybeStreetReadIntel(noContacts, { int: () => 0, next: () => 0 });
  assert.equal(noContacts.log.length, baseline, "nobody you know has nothing to tell you");
});

test("every area has a full intel table and every contact has recall lines", () => {
  for (const area of C.NEIGHBORHOODS) {
    const lines = SR.INTEL[area.id];
    assert.ok(Array.isArray(lines), `${area.id} has an intel table`);
    assert.ok(lines.length >= 8, `${area.id} has ${lines.length} lines, expected 8+`);
    assert.equal(new Set(lines).size, lines.length, `${area.id} lines are unique`);
  }
  for (const [npc, lines] of Object.entries(SR.FLAVOR)) {
    assert.ok(lines.length >= 2, `${npc} has ${lines.length} recall lines`);
    assert.equal(new Set(lines).size, lines.length, `${npc} lines are unique`);
  }
});

// ---------------------------------------------------------------------------
// 9. No UI leakage
// ---------------------------------------------------------------------------

const FORBIDDEN = [/street\s*read/i, /\bvariety\b/i, /hidden score/i, /behavioral variety/i, /\btier\s*[0-3]\b/i];

test("no authored player-facing string names the system", () => {
  const surfaces = [
    ...Object.values(SR.INTEL).flat(),
    ...Object.values(SR.FLAVOR).flat(),
    ...Object.values(SR.SMART_CHOICES).flatMap((choice) => [choice.label, choice.preview, choice.result]),
  ];
  for (const line of surfaces) {
    for (const pattern of FORBIDDEN) assert.doesNotMatch(line, pattern, `"${line}"`);
  }
});

test("the rendered UI never mentions the system or reads its state", () => {
  const ui = fs.readFileSync(path.join(__dirname, "..", "ui.jsx"), "utf8");
  for (const pattern of [/street\s*read/i, /hidden score/i, /behavioral variety/i]) {
    assert.doesNotMatch(ui, pattern, `ui.jsx matched ${pattern}`);
  }
  // No component reads the score, the tier, or the raw category sets. Every
  // benefit reaches the UI as an already-resolved number or boolean.
  assert.doesNotMatch(ui, /streetRead/i, "ui.jsx must not touch streetRead state directly");
});

test("no player-facing reason string explains a gate by naming the system", () => {
  const state = fresh(3501);
  const reasons = [
    C.selectors.eliPromotionAvailability(state).reason,
    C.selectors.soldierRecruitAvailability(state).reason,
    C.selectors.featureAvailability(state).operations.hint,
    C.selectors.featureAvailability(state).recovery.hint,
  ].filter(Boolean);
  assert.ok(reasons.length > 0);
  for (const reason of reasons) {
    for (const pattern of FORBIDDEN) assert.doesNotMatch(reason, pattern, `"${reason}"`);
  }
});

test("nothing the system writes to the feed names the system", () => {
  let state = fresh(3502);
  state.streetRead.tier = 3;
  SR.addStreetReadEntry(state, "social", "goodie:business");
  for (let tick = 0; tick < 12 && state.run.status === "playing"; tick += 1) state = quietAdvance(state);
  for (const entry of state.log) {
    for (const pattern of [/street\s*read/i, /\bvariety\b/i, /hidden score/i]) {
      assert.doesNotMatch(entry.text, pattern, `feed line: "${entry.text}"`);
    }
  }
});

test("the run summary reports no street read score, tier, or entry count", () => {
  const state = fresh(3503);
  SR.addStreetReadEntry(state, "trading", "spenard:weed");
  SR.recalculateStreetRead(state);
  const summary = C.selectRunSummary(state);
  assert.equal(summary.streetRead, undefined);
  assert.equal(JSON.stringify(summary).toLowerCase().includes("streetread"), false);
});
