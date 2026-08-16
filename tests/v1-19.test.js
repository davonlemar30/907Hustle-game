const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Encounters = require("../encounters.js");
const Exposure = require("../src/exposure/engine.js");
const Crew = require("../src/data/crew.js");
const Market = require("../src/data/market.js");
const MarketEvents = require("../src/events/market-events.js");
const Attributes = require("../src/systems/attributes.js");
const { BANDS } = require("../src/data/disposition-bands.js");
const { resolveLens, ARCHETYPES } = require("../src/data/npc-lenses.js");
const { NPC_CHANNELS, NPC_PRESENCE_SLOTS, NPC_PRESENCE_AREAS } = require("../src/data/propagation.js");
const { CREW_BY_ID } = require("../src/data/npcs.js");
const { putInBand } = require("./exposure-helpers.js");

// v1.19 - Observation-Gated Recruitment: Pherris + Deshawn Retro-Gate.
//
// Pherris predates the Exposure System by several builds, so she arrived with
// crew mechanics and no ledger at all. She gets the Tone treatment one domain
// over: a lens that counts money moving quietly, channels that reach her, a
// recruitment card that waits for proof, one effective level of Intelligence on
// market reads once she is hired, and tier gates that read the market she
// manages. Deshawn's tiers stop being a flat pass and read his own lens, which
// makes every crew advancement in the game an Exposure read.

const root = path.join(__dirname, "..");

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Nineteen" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  return structuredClone(state);
}

// The state a player who earned her actually arrives in: past Week Zero, with
// enough money in hand for what she asks and a ledger past her floor.
function readyForPherris(seed, { day = 6, cash = 1000 } = {}) {
  const state = fresh(seed);
  state.run.phase = "pressure";
  state.run.day = day;
  state.player.cash = cash;
  state.world.currentNeighborhoodId = "north_star_lot";
  // Bonded rather than Trusted on purpose. Her floor is 8 and the Trusted floor
  // is 6, so putInBand stops short of the gate - landing in the band is not the
  // same as clearing the score, which is the entire reason minScore exists.
  putInBand(state, "pherris", BANDS.BONDED);
  return state;
}

function withPherris(state, overrides) {
  Object.assign(state.people.crew.pherris, {
    introduced: true, recruited: true, status: "active", loyalty: 5, tier: 1, recruitedDay: 1,
  }, overrides || {});
  return state;
}

function withDeshawn(state, overrides) {
  Object.assign(state.people.crew.deshawn, {
    introduced: true, recruited: true, status: "active", loyalty: 5, tier: 1, recruitedDay: 1,
  }, overrides || {});
  return state;
}

function prepareNight(state, day) {
  state.run.phase = "pressure";
  state.run.checkpointDay = day + 10;
  state.run.day = day;
  state.run.slot = 3;
  state.run.dayEndPending = true;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  return state;
}

const descriptor = (id) => C.STORY_REGISTRY.find((item) => item.id === id);

// --- Task 1: Pherris joins the Exposure System ------------------------------

test("Pherris's lens reads money moving quietly and nothing else", () => {
  const lens = resolveLens("pherris");
  assert.ok(lens, "resolveLens('pherris') returns a lens");
  assert.equal(lens.archetype, "STREET");
  assert.equal(lens.inverted, false);
  assert.equal(lens.weights.financial, 4);
  assert.equal(lens.weights.growth, 3);
  assert.equal(lens.weights.discretion, 2);
  // Heat on a network she spent years building is a cost, not a credit.
  assert.equal(lens.weights.violence, -2);
  assert.equal(lens.weights.defiance, -1);
  // Unoverridden categories fall through to the archetype.
  assert.equal(lens.weights.betrayal, ARCHETYPES.STREET.betrayal);
  assert.equal(lens.weights.loyalty, ARCHETYPES.STREET.loyalty);
});

test("getting fired is not the best week she ever saw", () => {
  // job_lost broadcasts as `financial`, and at weight 4 an unguarded lens would
  // read it as a credit. The event weight is what stops that.
  const lens = resolveLens("pherris");
  assert.ok(lens.eventWeights.job_lost < 0, "a lost job costs her, it does not pay");
  const state = fresh(1900);
  const before = C.selectors.disposition(state, "pherris");
  Exposure.recordObservation(state, "pherris", { type: "financial", event: "job_lost", source: "neighborhood" });
  assert.ok(C.selectors.disposition(state, "pherris") < before, "the row moves her down");
});

test("she has a record, a ledger, and the channels of someone who is a network", () => {
  const state = fresh(1901);
  assert.ok(state.npc.pherris, "the npc record exists - without it the ledger loop skips her");
  assert.deepEqual(state.npc.pherris.ledger, []);
  assert.deepEqual(state.npc.pherris.channels, NPC_CHANNELS.pherris);
  assert.deepEqual(NPC_CHANNELS.pherris, ["direct", "neighborhood", "network"]);
  assert.ok(!NPC_CHANNELS.pherris.includes("household"), "she has never been to the house");
  assert.ok(!NPC_CHANNELS.pherris.includes("reputation"), "reputation is Curtis's channel alone");
  assert.ok(C.EXPOSURE_NPC_IDS.includes("pherris"), "the lens keys enroll her automatically");
  // Empty ledger is Neutral, not friendly and not hostile.
  assert.equal(C.selectors.disposition(state, "pherris"), 0);
  assert.equal(C.selectors.dispositionBand(state, "pherris"), BANDS.NEUTRAL);
});

test("she is the one crew member who works both districts", () => {
  assert.deepEqual(NPC_PRESENCE_AREAS.pherris, ["north_star_lot", "downtown"]);
  assert.deepEqual(NPC_PRESENCE_SLOTS.pherris, [1, 2, 3]);
  assert.equal(Exposure.couldObserve("pherris", { slot: 2, location: "downtown" }), true);
  assert.equal(Exposure.couldObserve("pherris", { slot: 0, location: "downtown" }), false, "mornings are the phone");
});

test("network financial and neighborhood growth both reach her ledger", () => {
  const state = fresh(1902);
  state.run.day = 4; state.run.slot = 2;
  state.world.currentNeighborhoodId = "downtown";
  assert.ok(Exposure.broadcastObservation(state, { type: "financial", event: "907list_profit", value: 300, channel: "network" }).includes("pherris"));
  assert.ok(Exposure.broadcastObservation(state, { type: "growth", event: "inventory_accumulation", channel: "neighborhood", location: "downtown" }).includes("pherris"));
  // Household is the one financial channel she is deliberately not on.
  assert.ok(!Exposure.broadcastObservation(state, { type: "financial", event: "fence_sale", channel: "household" }).includes("pherris"));
  // Both arrive on a delay, so drain the queue before reading the ledger.
  state.run.day = 7;
  Exposure.resolveObservationQueue(state);
  assert.ok(state.npc.pherris.ledger.some((row) => row.event === "907list_profit"));
  assert.ok(state.npc.pherris.ledger.some((row) => row.event === "inventory_accumulation"));
  assert.ok(C.selectors.disposition(state, "pherris") > 0, "both read as credits");
});

// The end-to-end version of this - a real flip, driven through the reducer -
// lives in v1-9b.test.js beside the household assertion it extends. This is the
// channel contract on its own: the two arrivals are different facts, and only
// the network one is hers.
test("a flip is a household fact and a network fact, and only one of them is hers", () => {
  const state = fresh(1903);
  state.run.day = 3; state.run.slot = 1;
  const household = Exposure.broadcastObservation(state, { type: "financial", event: "907list_profit", value: 400, channel: "household" });
  const network = Exposure.broadcastObservation(state, { type: "financial", event: "907list_profit", value: 400, channel: "network" });
  assert.ok(household.includes("yalonda") && household.includes("juan"), "the house hears it");
  assert.ok(!household.includes("pherris"), "she has never been to the house");
  assert.ok(network.includes("pherris"), "she hears the wire");
  assert.ok(network.includes("curtis"), "$400 clears his volume filter");
  // And a small one stays below his radar while still reaching her.
  const small = Exposure.broadcastObservation(state, { type: "financial", event: "907list_profit", value: 40, channel: "network" });
  assert.ok(small.includes("pherris"), "she notices the small ones too");
  assert.ok(!small.includes("curtis"), "a $40 space heater is not a phone call");
});

test("crew never vouches for crew", () => {
  const state = fresh(1904);
  putInBand(state, "pherris", BANDS.TRUSTED);
  // warmNpcContactCount feeds Deshawn's recruitment gate; a Warm Pherris must
  // not count toward it, for the same reason Tone and Deshawn do not.
  assert.equal(C.selectors.warmNpcContactCount(state), 0, "a Warm crew member is not a reference");
});

// --- Task 2: recruitment by proof -------------------------------------------

test("a fresh game cannot recruit her", () => {
  const state = fresh(1910);
  assert.equal(C.selectors.crewRecruitmentEligible(state, "pherris"), false);
  assert.equal(C.selectors.pherrisRecruitmentAvailability(state).available, false);
});

test("her floor exists because one flip already clears the Warm band", () => {
  const proof = Crew.recruitmentProofFor("pherris");
  assert.equal(proof.minBand, "WARM");
  assert.ok(proof.minScore > BANDS.WARM);
  // The exact failure minScore prevents: one financial row scores 4.0 through
  // her lens, which is already past the Warm floor of 3.
  assert.equal(Crew.recruitmentEligible("pherris", BANDS.WARM, 4), false, "one good day is not a hire");
  assert.equal(Crew.recruitmentEligible("pherris", BANDS.WARM, proof.minScore), true);
  assert.equal(Crew.recruitmentEligible("pherris", BANDS.NEUTRAL, 99), false, "the band gate holds at any score");
});

test("sustained market evidence opens the gate, and landing in the band does not", () => {
  // Trusted is band 4 and clears minBand, but its floor is 6 and her score
  // floor is 8. One is not the other, which is what the floor is for.
  const barely = fresh(1911);
  putInBand(barely, "pherris", BANDS.TRUSTED);
  assert.ok(C.selectors.dispositionBand(barely, "pherris") >= BANDS.WARM, "the band gate passes");
  assert.equal(C.selectors.crewRecruitmentEligible(barely, "pherris"), false, "the score gate does not");

  const state = readyForPherris(1912);
  assert.equal(C.selectors.crewRecruitmentEligible(state, "pherris"), true);
  assert.equal(C.selectors.pherrisRecruitmentAvailability(state).available, true);
});

test("her card waits for proof, for cash, and for Week Zero to end", () => {
  const card = descriptor("pherris_recruit");
  assert.ok(card, "pherris_recruit is registered");
  assert.equal(card.trigger, "reactive");
  assert.equal(card.classification, "character_intro");
  assert.equal(card.area, null, "she moves between districts, so she turns up anywhere");
  assert.equal(card.once, false, "declining has to leave a way back");
  assert.equal(card.cooldown, 3);

  const state = readyForPherris(1912);
  assert.equal(card.requires(state), true);

  const weekZero = readyForPherris(1913);
  weekZero.run.phase = "week_zero";
  assert.equal(card.requires(weekZero), false, "never during Week Zero");

  const broke = readyForPherris(1914, { cash: 0 });
  assert.equal(card.requires(broke), false, "she asks for money up front");

  const unproven = fresh(1915);
  unproven.run.phase = "pressure";
  unproven.run.day = 6;
  unproven.player.cash = 1000;
  assert.equal(card.requires(unproven), false, "proof is the gate");

  const hired = readyForPherris(1916);
  withPherris(hired);
  assert.equal(card.requires(hired), false, "she does not re-offer once she works here");
});

test("taking the offer deducts her price and puts her on the roster", () => {
  let state = readyForPherris(1917);
  const cost = C.selectors.recruitmentCost(state, "pherris");
  const cash = state.player.cash;
  state.run.pendingEvent = C.buildEventForTest("pherris_recruit", state);
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  const crew = state.people.crew.pherris;
  assert.equal(crew.recruited, true);
  assert.equal(crew.status, "active");
  assert.equal(crew.recruitedDay, state.run.day);
  assert.equal(crew.tier, 1);
  // She made the player prove it first, so she starts level rather than grateful.
  assert.equal(crew.loyalty, Crew.CREW_LOYALTY_START);
  assert.equal(state.player.cash, cash - cost);
  assert.equal(state.npc.pherris.met, true);
});

test("hiring her tells the block, not the wire", () => {
  let state = readyForPherris(1918);
  // The neighborhood channel is presence-checked, and nobody is on the block at
  // Morning. A hire happens when people are out, so the test says so.
  state.run.slot = 2;
  state.run.pendingEvent = C.buildEventForTest("pherris_recruit", state);
  const awareness = state.curtisAwareness.level;
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  state.run.day += 3;
  Exposure.resolveObservationQueue(state);
  const row = state.npc.deshawn.ledger.find((entry) => entry.event === "crew_recruited");
  assert.ok(row, "the neighborhood sees who is working with whom");
  assert.equal(row.source, "neighborhood");
  assert.equal(state.curtisAwareness.level, awareness, "making a phone call is not a free point of attention");
});

test("declining is a rain check, and the number does not move", () => {
  let state = readyForPherris(1919);
  const cost = C.selectors.recruitmentCost(state, "pherris");
  state.run.pendingEvent = C.buildEventForTest("pherris_recruit", state);
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 1 });
  assert.equal(state.people.crew.pherris.recruited, false);
  assert.equal(state.flags.pherrisOfferDeclined, true);
  assert.equal(state.flags.pherrisNextOfferDay, state.run.day + 3);
  assert.equal(state.npc.pherris.offersDeclined, 1);

  const card = descriptor("pherris_recruit");
  assert.equal(card.requires(state), false, "not tomorrow");
  state.run.day = state.flags.pherrisNextOfferDay;
  state.run.recentEvents = [];
  assert.equal(card.requires(state), true, "but three days later, yes");
  assert.equal(C.selectors.recruitmentCost(state, "pherris"), cost, "at the same price");
});

test("the garage door is not a way around her gate", () => {
  // Both recruitment paths run through crewRecruitmentEligible.
  let state = fresh(1920);
  state.run.day = 6;
  state.player.cash = 2000;
  state.base.controlled = true;
  state.base.visiting = true;
  state.people.crew.pherris.introduced = true;
  state.people.crew.pherris.contactStage = "recruitable";
  state = C.reduceGame(state, { type: "RECRUIT_CREW", crewId: "pherris" });
  assert.equal(state.people.crew.pherris.recruited, false, "unproven, so walking in does nothing");
  putInBand(state, "pherris", BANDS.BONDED);
  state = C.reduceGame(state, { type: "RECRUIT_CREW", crewId: "pherris" });
  assert.equal(state.people.crew.pherris.recruited, true);
});

// --- Task 3: intel_advantage -------------------------------------------------

test("an active Pherris is worth one effective level on market reads", () => {
  const state = fresh(1930);
  assert.equal(Crew.intelAdvantageFor(state, "market_transaction"), 0, "not on the payroll, no edge");
  withPherris(state);
  assert.equal(Crew.intelAdvantageFor(state, "market_transaction"), 1);
  assert.equal(Crew.intelAdvantageFor(state, "907list_flip"), 1);
  assert.deepEqual(Crew.intelAdvantageCrewIds(state, "market_transaction"), ["pherris"]);
  // She changes prices, not fights.
  assert.equal(Crew.combatAdvantageFor(state, "encounter", "dre_collector"), 0);
  assert.equal(Crew.intelAdvantageFor(state, "encounter", "dre_collector"), 0);
});

test("presenceEffectsFor names her for market contexts and nobody else's", () => {
  const state = withPherris(fresh(1931));
  const effects = Crew.presenceEffectsFor(state, "market_transaction");
  assert.equal(effects.length, 1);
  assert.equal(effects[0].crewId, "pherris");
  assert.equal(effects[0].modification, "intel_advantage");
  assert.deepEqual(Crew.presenceEffectsFor(state, "stick_target"), []);
});

test("her edge disappears when she does", () => {
  const departed = withPherris(fresh(1932), { loyalty: 0 });
  assert.equal(Crew.intelAdvantageFor(departed, "907list_flip"), 0, "loyalty 0 is the day she stops showing up");
  const gone = withPherris(fresh(1933), { status: "departed" });
  assert.equal(Crew.intelAdvantageFor(gone, "907list_flip"), 0);
  const jailed = withPherris(fresh(1934), { status: "arrested" });
  assert.equal(Crew.intelAdvantageFor(jailed, "907list_flip"), 0, "she cannot work a phone from a cell");
});

test("the edge never stacks past one level", () => {
  const state = withPherris(fresh(1935));
  Object.assign(state.people.crew.tone, { introduced: true, recruited: true, status: "active", loyalty: 5, tier: 1 });
  assert.equal(Crew.intelAdvantageFor(state, "907list_flip"), Crew.INTEL_ADVANTAGE_CAP);
  assert.equal(Crew.INTEL_ADVANTAGE_CAP, 1);
});

test("she narrows the sale swing by one effective level of Intelligence", () => {
  const without = fresh(1936);
  without.player.attributes.intelligence = 2;
  const with_ = withPherris(structuredClone(without));
  // Intelligence 2 sits below the tightening band; her level pushes it over.
  assert.ok(MarketEvents.priceVolatility(with_) < MarketEvents.priceVolatility(without),
    "one effective level moves the band");
  // And she cannot invent a band that does not exist.
  const capped = withPherris(fresh(1937));
  capped.player.attributes.intelligence = 6;
  assert.equal(MarketEvents.priceVolatility(capped), MarketEvents.priceVolatility(Object.assign(fresh(1938), { player: capped.player })));
});

test("passing an explicit zero bonus resolves exactly as passing none", () => {
  // The determinism guard v1.18 added for Tone, repeated for the market action:
  // every call site without an edge has to stay byte-identical.
  const state = fresh(1939);
  for (let seed = 0; seed < 40; seed += 1) {
    const key = `${state.run.seed}:meetup:${seed}`;
    const plain = Attributes.resolveAction(state, "market_meetup", 0.75, key);
    const zeroed = Attributes.resolveAction(state, "market_meetup", 0.75, key, 0);
    assert.deepEqual(zeroed, plain, `seed ${seed} drifted`);
  }
});

// --- Task 4: wage and tier curve ---------------------------------------------

test("her wage scales with tier and starts where her roster wage already was", () => {
  assert.deepEqual(Crew.TIER_WAGES.pherris, [60, 120, 220]);
  assert.equal(Crew.wageFor(CREW_BY_ID.pherris, 1), CREW_BY_ID.pherris.wage, "tier 1 changes nothing");
  assert.equal(Crew.wageFor(CREW_BY_ID.pherris, 2), 120);
  assert.equal(Crew.wageFor(CREW_BY_ID.pherris, 3), 220);
  // Cheaper than muscle at every tier.
  for (const tier of [1, 2, 3]) {
    assert.ok(Crew.wageFor(CREW_BY_ID.pherris, tier) < Crew.wageFor(CREW_BY_ID.tone, tier));
  }
});

test("her wage comes out of the nightly settlement", () => {
  let state = fresh(1940);
  withPherris(state, { tier: 2, wageDue: 0 });
  state.player.cash = 600; state.player.dirtyCash = 600;
  const before = state.player.dirtyCash;
  state = prepareNight(state, 6);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(before - state.player.dirtyCash, Crew.wageFor(CREW_BY_ID.pherris, 2));
});

test("an unpaid wage bleeds loyalty only after the grace period", () => {
  let state = fresh(1941);
  withPherris(state, { loyalty: 6 });
  state.player.cash = 0; state.player.dirtyCash = 0;
  let day = 6;
  for (let night = 0; night < Crew.CREW_WAGE_GRACE_DAYS; night += 1) {
    state = prepareNight(state, day++);
    state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  }
  assert.equal(state.people.crew.pherris.loyalty, 6, "the first two nights are grace");
  state = prepareNight(state, day);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.people.crew.pherris.loyalty, 5, "every night after costs a point");
});

test("her tier 2 counts market activity, not blocks", () => {
  const state = fresh(1942);
  state.run.day = 8;
  withPherris(state, { loyalty: 7, recruitedDay: 1 });
  state.world.territoryBlocks.spenard_rec_lot.owner = "player";
  assert.equal(C.selectors.crewTierAvailability(state, "pherris").available, false, "a block is not her domain");
  state.nineZeroSevenList.flipCount = Crew.PHERRIS_TIER2_FLIPS;
  assert.equal(C.selectors.crewTierAvailability(state, "pherris").available, true);

  // Or the same evidence expressed as margin instead of count.
  const byProfit = fresh(1943);
  byProfit.run.day = 8;
  withPherris(byProfit, { loyalty: 7, recruitedDay: 1 });
  byProfit.nineZeroSevenList.profit = Crew.PHERRIS_TIER2_PROFIT;
  assert.equal(C.selectors.crewTierAvailability(byProfit, "pherris").available, true);
});

test("her tier 3 needs a block and Broker standing, and costs nothing", () => {
  const state = fresh(1944);
  state.run.day = 16;
  withPherris(state, { loyalty: 9, tier: 2, recruitedDay: 1 });
  state.inventory.laptop = true;
  state.nineZeroSevenList.flipCount = Market.BROKER_FLIP_REQUIREMENT;
  state.nineZeroSevenList.disputes = 0;
  assert.equal(C.selectors.marketTier(state), Market.MAX_TIER, "Broker");
  assert.equal(C.selectors.crewTierAvailability(state, "pherris").available, false, "Broker alone is not enough");
  state.world.territoryBlocks.spenard_rec_lot.owner = "player";
  const ready = C.selectors.crewTierAvailability(state, "pherris");
  assert.equal(ready.available, true);
  assert.equal(ready.tier, 3);
  assert.equal(ready.cost, 0, "she promotes free, like Tone and Deshawn");

  // A block without Broker is the other half missing.
  const noBroker = fresh(1945);
  noBroker.run.day = 16;
  withPherris(noBroker, { loyalty: 9, tier: 2, recruitedDay: 1 });
  noBroker.world.territoryBlocks.spenard_rec_lot.owner = "player";
  assert.equal(C.selectors.crewTierAvailability(noBroker, "pherris").available, false);
});

// --- Task 5: Deshawn's retro-gate --------------------------------------------

test("Deshawn's tier 2 needs him to trust you, not just employ you", () => {
  const state = fresh(1950);
  state.run.day = 8;
  withDeshawn(state, { loyalty: 7, recruitedDay: 1 });
  // The universal gate passes; his own does not.
  assert.ok(Crew.tierRequirementMet(state.people.crew.deshawn, 2, state.run.day));
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, false, "loyalty and time used to be the whole gate");
  putInBand(state, "deshawn", BANDS.WARM);
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, false, "Warm is not Trusted");
  putInBand(state, "deshawn", BANDS.TRUSTED);
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, true);
});

test("Deshawn's tier 3 needs Bonded", () => {
  const state = fresh(1951);
  state.run.day = 16;
  withDeshawn(state, { loyalty: 9, tier: 2, recruitedDay: 1 });
  putInBand(state, "deshawn", BANDS.TRUSTED);
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, false, "Trusted got him tier 2, not tier 3");
  putInBand(state, "deshawn", BANDS.BONDED);
  const ready = C.selectors.crewTierAvailability(state, "deshawn");
  assert.equal(ready.available, true);
  assert.equal(ready.tier, 3);
  assert.equal(ready.cost, 0);
});

test("a maxed-out loyalty with a Cold disposition promotes nobody", () => {
  // The case the build asked for by name: everything the old gate measured,
  // and none of what the new one does.
  const state = fresh(1952);
  state.run.day = 20;
  withDeshawn(state, { loyalty: 10, tier: 2, recruitedDay: 1 });
  putInBand(state, "deshawn", BANDS.COLD);
  assert.ok(Crew.tierRequirementMet(state.people.crew.deshawn, 3, state.run.day), "loyalty 9+ and twelve days served");
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, false);
  assert.equal(C.selectors.dispositionBand(state, "deshawn"), BANDS.COLD);
});

test("promotion is still player-initiated and the reducer honors the gate", () => {
  let state = fresh(1953);
  state.run.day = 8;
  withDeshawn(state, { loyalty: 7, recruitedDay: 1 });
  state = C.reduceGame(state, { type: "PROMOTE_CREW_TIER", crewId: "deshawn" });
  assert.equal(state.people.crew.deshawn.tier, 1, "blocked at the reducer, not just in the UI");
  putInBand(state, "deshawn", BANDS.TRUSTED);
  state = C.reduceGame(state, { type: "PROMOTE_CREW_TIER", crewId: "deshawn" });
  assert.equal(state.people.crew.deshawn.tier, 2);
});

// --- Task 6: de-escalation through the framework ------------------------------

test("de-escalation is one question answered in one place", () => {
  const state = withDeshawn(fresh(1960));
  assert.deepEqual(Crew.deEscalateCrewIds(state, "encounter", "dre_collector"), ["deshawn"]);
  assert.equal(Crew.deEscalateAvailable(state, "stick_retaliation"), true);
  // Still never against Curtis's own people.
  for (const id of Crew.CURTIS_CREW_ENCOUNTER_IDS) {
    assert.deepEqual(Crew.deEscalateCrewIds(state, "encounter", id), [], `${id} is Curtis's`);
  }
  // And Pherris talks nobody down.
  withPherris(state);
  assert.deepEqual(Crew.deEscalateCrewIds(state, "encounter", "dre_collector"), ["deshawn"]);
});

test("both engines and the retaliation card read the same answer", () => {
  const state = withDeshawn(fresh(1961));
  state.run.pendingEncounter = { id: "dre_collector", title: "T", enemyName: "Two collectors", enemyHealth: 20, guard: 0.1, evasion: 0.1, pursuit: 0.1, pay: 60, step: 0, attack: [4, 8] };
  assert.ok(C.selectors.encounterChoices(state).some((item) => item.id === "deshawn_deescalate"));
  const consequence = { id: "dre_collector", type: "random", phase: 0, areaId: "north_star_lot", npc: { demand: 60 }, resolved: false };
  assert.ok(Encounters.getEligibleChoices(consequence, state).some((item) => item.id === "deshawn_deescalate"));
  // An authored consequence encounter is a written scene and never offers it.
  assert.ok(!Encounters.getEligibleChoices({ ...consequence, type: "authored", pay: 60 }, state).some((item) => item.id === "deshawn_deescalate"));
});

test("the framework has a live caller for every modification it declares", () => {
  // de_escalate sat declared and unread from v1.15 until this build. Nothing in
  // PRESENCE_EFFECTS should be dead again.
  const declared = new Set(Object.values(Crew.PRESENCE_EFFECTS).flat().map((effect) => effect.modification));
  assert.deepEqual([...declared].sort(), ["combat_advantage", "de_escalate", "intel_advantage"]);
  const state = withPherris(withDeshawn(fresh(1962)));
  Object.assign(state.people.crew.tone, { introduced: true, recruited: true, status: "active", loyalty: 5, tier: 1 });
  assert.equal(Crew.deEscalateAvailable(state, "encounter", "dre_collector"), true);
  assert.equal(Crew.combatAdvantageFor(state, "encounter", "dre_collector"), 1);
  assert.equal(Crew.intelAdvantageFor(state, "907list_flip"), 1);
});

// --- Contracts ----------------------------------------------------------------

test("the data modules stay data modules", () => {
  for (const file of [["src", "data", "crew.js"], ["src", "data", "npc-lenses.js"], ["src", "data", "propagation.js"], ["src", "events", "cards.js"], ["src", "events", "market-events.js"]]) {
    const source = fs.readFileSync(path.join(root, ...file), "utf8");
    assert.doesNotMatch(source, /require\(["'].*game-core/, `${file.join("/")} would create a cycle`);
  }
  // src/data may not reach into src/exposure; src/events may.
  const crew = fs.readFileSync(path.join(root, "src", "data", "crew.js"), "utf8");
  assert.doesNotMatch(crew, /require\(["'].*exposure/);
});

test("every Exposure NPC has a lens, channels, and a state record", () => {
  const state = fresh(1970);
  for (const id of C.EXPOSURE_NPC_IDS) {
    assert.ok(resolveLens(id), `${id} has a lens`);
    assert.ok(NPC_CHANNELS[id], `${id} has channels`);
    assert.ok(state.npc[id], `${id} has a state record`);
    assert.ok(Array.isArray(state.npc[id].ledger), `${id} has a ledger`);
  }
});

test("Pherris is named Pherris Dickens everywhere the player can read it", () => {
  for (const file of [["src", "events", "cards.js"], ["src", "events", "registry.js"], ["src", "data", "npcs.js"]]) {
    const source = fs.readFileSync(path.join(root, ...file), "utf8");
    assert.doesNotMatch(source, /Pherris Cole/, `${file.join("/")} carries the retired surname`);
  }
});

test("a v11 save with no Pherris ledger loads with an empty one", () => {
  const state = fresh(1971);
  putInBand(state, "pherris", BANDS.WARM);
  const raw = JSON.parse(C.serializeRun(state));
  delete raw.npc.pherris;
  const loaded = C.hydrateRun(raw);
  assert.ok(loaded, "the save still loads");
  assert.ok(loaded.npc.pherris, "mergeDefaults supplies the record");
  assert.deepEqual(loaded.npc.pherris.ledger, []);
  assert.equal(C.selectors.disposition(loaded, "pherris"), 0);
  assert.equal(C.selectors.crewRecruitmentEligible(loaded, "pherris"), false);
});

test("a v3 save still completes the whole migration chain into a playable run", () => {
  const state = fresh(1972);
  const raw = JSON.parse(C.serializeRun(state));
  raw.version = 3;
  delete raw.npc.pherris;
  delete raw.npc.tone;
  const loaded = C.hydrateRun(C.migrateSave(raw));
  assert.ok(loaded, "a v3 save migrates");
  assert.equal(loaded.version, C.VERSION);
  assert.ok(loaded.npc.pherris && Array.isArray(loaded.npc.pherris.ledger));
  const played = C.reduceGame(loaded, { type: "ADVANCE_SLOT" });
  assert.ok(played, "and it plays");
});
