const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Disclosures = require("../src/data/disclosures.js");
const Territory = require("../src/data/territory.js");
const Gossip = require("../src/data/gossip.js");
const CurtisAwareness = require("../src/data/curtis-awareness.js");
const { NPC_CHANNELS } = require("../src/data/propagation.js");
const { SPENARD_BLOCK_BY_ID } = require("../src/data/locations.js");

// v1.27 - Disclosure tables. Information becomes a purchase.
//
// The engine has always known which corners Curtis is working tonight and what
// the police will roll against on each one. Until now the only way to see any
// of it was Pherris's standing tier feed, so a player without her met a fully
// determined system blind. This build sells the numbers, and what you pay is
// cash plus a relationship: the band decides whether the answer is exact or
// approximately true.
//
// Three surfaces meet here and the tests below exist mostly to keep them apart:
//
//   gossip       free, on a schedule the player does not set, gated on
//                disposition, answers with silence. v1.23, untouched.
//   Pherris      standing, always-on, gated on her crew tier. The Territory
//                block cards. v1.20, untouched.
//   disclosure   paid, on demand, gated on BAND. This build.
//
// Nothing new is persisted beyond a session-only day-scoped cache on `run`, so
// the save schema stays at v11.

const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");
const disclosureSource = fs.readFileSync(path.join(root, "src", "data", "disclosures.js"), "utf8");

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "TwentyOne" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  state.phone.active = true;
  return structuredClone(state);
}

// Same search-don't-tabulate approach as v1.23's setBand, and for the same
// reason: the lens weights differ per person, so one ledger does not put two
// people on the same band. Every placement is verified against dispositionBand
// before it is handed back, so a gate test can never pass because the fixture
// quietly landed a band away from where it was aimed.
const BAND_LEDGER_CANDIDATES = [];
for (const type of ["loyalty", "presence", "discretion", "growth", "financial", "heat_exposure", "violence", "betrayal"]) {
  for (const count of [1, 2, 3, 5, 7, 11, 15, 20, 30]) BAND_LEDGER_CANDIDATES.push([{ type, count }]);
}
for (const count of [7, 15, 30]) {
  for (const second of ["presence", "discretion", "growth", "financial"]) {
    BAND_LEDGER_CANDIDATES.push([{ type: "loyalty", count }, { type: second, count }]);
  }
}

function setBand(state, npcId, bandName) {
  const target = C.BANDS[bandName];
  for (const rows of BAND_LEDGER_CANDIDATES) {
    state.npc[npcId].ledger = rows.map((row) => ({
      type: row.type, event: null, location: null, value: null, day: 1, count: row.count, source: "witnessed",
    }));
    if (C.selectors.dispositionBand(state, npcId) === target) return state;
  }
  throw new Error(`no ledger puts ${npcId} at ${bandName}`);
}

const DEFAULT_BLOCKS = ["northern_lights_motels", "fourth_ave_strip", "service_road_chokepoint", "minnesota_offramp"];

// A player holding corners, with money, at a pinned awareness phase, with the
// named people on the named bands. Both `level` and `floor` are pinned so the
// quiet-day bleed cannot walk the phase back down inside a day-end pass.
function holding(seed, { blocks = DEFAULT_BLOCKS, phase = "approaching", bands = {}, cash = 1000, heat = 6, soldiers = 2 } = {}) {
  const state = fresh(seed);
  state.base.controlled = true;
  const level = CurtisAwareness.phaseFloor(phase);
  Object.assign(state.curtisAwareness, { level, floor: level, phase, phaseMessagesSent: ["watching", "approaching"] });
  let next = 1;
  for (const blockId of blocks) {
    const record = state.world.territoryBlocks[blockId];
    record.owner = "player";
    for (let i = 0; i < soldiers; i += 1) {
      const id = `soldier_${next++}`;
      state.world.soldiers[id] = { id, status: "active", blockId };
      record.soldiersAssigned.push(id);
    }
  }
  state.player.cash = cash;
  state.player.cleanCash = cash;
  state.player.dirtyCash = 0;
  state.player.heat = heat;
  for (const [npcId, band] of Object.entries(bands)) setBand(state, npcId, band);
  return state;
}

function buy(state, npcId, intelType) {
  return C.reduceGame(state, { type: "BUY_DISCLOSURE", npcId, intelType });
}

// The message a purchase produced, identified by sender rather than by index,
// so a test cannot accidentally assert on a gossip text that landed first.
function lastFrom(state, npcId) {
  const sender = Disclosures.senderFor(npcId);
  return [...state.phone.inbox, ...state.phone.heldInbox].find((message) => message.from === sender) || null;
}

// The band one step above a gate, which is where a disclosure becomes exact.
function bandNameAbove(minBand) {
  return Object.keys(C.BANDS).find((name) => C.BANDS[name] === minBand + 1);
}

function bandNameFor(band) {
  return Object.keys(C.BANDS).find((name) => C.BANDS[name] === band);
}

// --- the table --------------------------------------------------------------

test("every disclosure row points at a real person, a real intel type, and a real band", () => {
  assert.ok(Disclosures.DISCLOSURES.length > 0, "the table is not empty");
  const bands = new Set(Object.values(C.BANDS));
  for (const entry of Disclosures.DISCLOSURES) {
    assert.ok(C.EXPOSURE_NPC_IDS.includes(entry.npcId), `${entry.npcId} is an Exposure NPC with a lens and a band`);
    assert.ok(Disclosures.INTEL_TYPE_BY_ID[entry.intelType], `${entry.intelType} is a defined intel type`);
    assert.ok(bands.has(entry.minBand), `${entry.npcId}/${entry.intelType} gates on a real band`);
    assert.ok(Disclosures.senderFor(entry.npcId), `${entry.npcId} has a name to sign the text with`);
  }
  // No two rows sell the same person the same product at two prices.
  const keys = Disclosures.DISCLOSURES.map((entry) => `${entry.npcId}:${entry.intelType}`);
  assert.equal(new Set(keys).size, keys.length, "no duplicate npc/type rows");
});

test("every intel type reads a selector the game actually computes", () => {
  for (const type of Disclosures.INTEL_TYPES) {
    assert.equal(typeof C.selectors[type.reads], "function", `${type.id} reads ${type.reads}, which is a real selector`);
    assert.ok(type.price > 0, `${type.id} has a price`);
    assert.ok(["night", "day"].includes(type.staleness), `${type.id} declares how long it is good for`);
  }
  // The nightly plan recomputes when the phase moves; the two chance reads move
  // with Heat and the garrison. Nothing claims to be good for longer than that.
  assert.equal(Disclosures.INTEL_TYPE_BY_ID.curtis_targets.staleness, "night");
  assert.equal(Disclosures.INTEL_TYPE_BY_ID.curtis_pressure.staleness, "night");
});

test("a source can only sell what their own channel would have carried", () => {
  // Curtis's people moving travels on `network`; police patterns are something
  // you watch from a window, which is `neighborhood`. A row that violated this
  // would be handing somebody information they have no way to have heard.
  const CHANNEL_FOR_TYPE = {
    curtis_targets: "network",
    curtis_pressure: "network",
    curtis_next_move: "network",
    police_heat_map: "neighborhood",
    block_vulnerability: "neighborhood",
  };
  for (const entry of Disclosures.DISCLOSURES) {
    const channel = CHANNEL_FOR_TYPE[entry.intelType];
    assert.ok((NPC_CHANNELS[entry.npcId] || []).includes(channel),
      `${entry.npcId} listens on ${channel}, so ${entry.intelType} could reach them`);
  }
});

test("Deshawn is never a source, structurally", () => {
  // His entire value is being off Curtis's network - propagation.js wires him
  // to neighborhood and household and deliberately not to network. A man who
  // is not on the wire cannot sell what is on it. He shapes what OTHER people
  // say (the v1.23 tier ladder) and never becomes a source himself.
  assert.ok(!Disclosures.DISCLOSURE_NPC_IDS.includes("deshawn"), "no table row names Deshawn");
  assert.ok(!Disclosures.VOICES.deshawn, "no authored disclosure voice exists for Deshawn");
  assert.ok(!(NPC_CHANNELS.deshawn || []).includes("network"), "and the reason still holds: he is off the network");
  const table = disclosureSource.slice(disclosureSource.indexOf("const DISCLOSURES = ["), disclosureSource.indexOf("const DISCLOSURE_NPC_IDS"));
  assert.doesNotMatch(table, /deshawn/, "the table itself never mentions him");
});

test("Pherris is not in the table, because her intel is a subscription she already sells", () => {
  assert.ok(!Disclosures.DISCLOSURE_NPC_IDS.includes("pherris"), "no disclosure row duplicates her standing feed");
});

// --- the accuracy ladder ----------------------------------------------------

test("below the gate an NPC does not offer the intel at all", () => {
  const state = holding(2701, { bands: { dre: "NEUTRAL" } });
  assert.deepEqual(C.selectors.disclosureOffers(state, "dre"), [], "nothing is on the menu");
  assert.equal(C.selectors.disclosureAvailability(state, "dre").visible, false, "and Ask about... does not render");
  const after = buy(state, "dre", "curtis_targets");
  assert.equal(after, state, "a dispatch that slipped through is a genuine no-op");
});

test("at the gate the read is jittered, one band above it is exact", () => {
  for (const entry of Disclosures.DISCLOSURES) {
    const above = bandNameAbove(entry.minBand);
    const atGate = holding(2702, { bands: { [entry.npcId]: bandNameFor(entry.minBand) } });
    const offerAt = C.selectors.disclosureOffers(atGate, entry.npcId).find((offer) => offer.intelType === entry.intelType);
    assert.ok(offerAt, `${entry.npcId} sells ${entry.intelType} at their own gate`);
    // Bonded is the ceiling, so a Bonded-gated row has no band above it and is
    // exact at the gate - the same rule blockIntelView has followed since
    // v1.20, where the top level is exact and everything below it jitters.
    if (!above) {
      assert.equal(offerAt.accuracy, "exact", `${entry.intelType} is exact at the ceiling band`);
      continue;
    }
    assert.equal(offerAt.accuracy, "jittered", `${entry.npcId}/${entry.intelType} is approximate at the gate`);
    const higher = holding(2702, { bands: { [entry.npcId]: above } });
    const offerAbove = C.selectors.disclosureOffers(higher, entry.npcId).find((offer) => offer.intelType === entry.intelType);
    assert.equal(offerAbove.accuracy, "exact", `${entry.npcId}/${entry.intelType} is exact one band up`);
  }
});

test("an exact target list is the plan, corner for corner", () => {
  const state = holding(2703, { bands: { dre: "TRUSTED" } });
  const plan = C.selectors.curtisNightPlan(state);
  const payload = C.selectors.disclosurePayload(state, "dre", "curtis_targets", "exact");
  assert.deepEqual(payload.names, plan.map((entry) => entry.name), "no corner added, none dropped");
});

test("a jittered target list is off by at most one corner, and never invents one", () => {
  const held = new Set(DEFAULT_BLOCKS.map((id) => SPENARD_BLOCK_BY_ID[id].name));
  let sawDifference = false;
  for (let day = 1; day <= 40; day += 1) {
    const state = holding(2704, { bands: { dre: "WARM" } });
    state.run.day = day;
    const plan = C.selectors.curtisNightPlan(state).map((entry) => entry.name);
    const shown = C.selectors.disclosurePayload(state, "dre", "curtis_targets", "jittered").names;
    assert.ok(Math.abs(shown.length - plan.length) <= 1, `day ${day}: at most one entry off`);
    for (const name of shown) assert.ok(held.has(name), `day ${day}: ${name} is a corner the player actually holds`);
    if (shown.length !== plan.length || shown.some((name, i) => name !== plan[i])) sawDifference = true;
  }
  assert.ok(sawDifference, "over forty days the jitter actually bites at least once");
});

test("a jittered chance stays within 15% of the truth", () => {
  for (const [npcId, intelType, band] of [["juan", "police_heat_map", "TRUSTED"], ["biniam", "block_vulnerability", "TRUSTED"]]) {
    for (let day = 1; day <= 30; day += 1) {
      const state = holding(2705, { bands: { [npcId]: band } });
      state.run.day = day;
      const read = intelType === "police_heat_map" ? C.selectors.policeRaidChance : C.selectors.curtisMoveChance;
      const payload = C.selectors.disclosurePayload(state, npcId, intelType, "jittered");
      const exact = C.selectors.disclosurePayload(state, npcId, intelType, "exact");
      assert.equal(payload.chances.length, exact.chances.length, "the same corners are named either way");
      for (const row of payload.chances) {
        const blockId = Object.keys(SPENARD_BLOCK_BY_ID).find((id) => SPENARD_BLOCK_BY_ID[id].name === row.name);
        const truth = read(state, blockId);
        assert.ok(row.chance <= truth * 1.15 + 1e-9, `day ${day} ${row.name}: not more than 15% high`);
        assert.ok(row.chance >= truth * 0.85 - 1e-9, `day ${day} ${row.name}: not more than 15% low`);
      }
    }
  }
});

test("an exact chance read is the selector's own number", () => {
  const state = holding(2706, { bands: { juan: "BONDED" } });
  const payload = C.selectors.disclosurePayload(state, "juan", "police_heat_map", "exact");
  for (const row of payload.chances) {
    const blockId = Object.keys(SPENARD_BLOCK_BY_ID).find((id) => SPENARD_BLOCK_BY_ID[id].name === row.name);
    assert.equal(row.chance, C.selectors.policeRaidChance(state, blockId), `${row.name} is the raw number`);
  }
});

test("a jittered pressure weight is off by at most one and stays a weight Curtis could assign", () => {
  for (let day = 1; day <= 30; day += 1) {
    const state = holding(2707, { bands: { dre: "TRUSTED" } });
    state.run.day = day;
    const plan = C.selectors.curtisNightPlan(state);
    const payload = C.selectors.disclosurePayload(state, "dre", "curtis_pressure", "jittered");
    payload.weights.forEach((row, index) => {
      assert.ok(Math.abs(row.weight - plan[index].weight) <= 1, `day ${day}: within one of the real weight`);
      assert.ok(row.weight >= 1 && row.weight <= Territory.CURTIS_MAX_PRESSURE_PER_BLOCK, "and inside the real range");
      assert.equal(row.label, row.weight >= Territory.CURTIS_PRESSURE_HARD ? "coming hard" : "just looking");
    });
  }
});

test("a quiet night is a true answer, not an empty one", () => {
  // Curtis at invisible has no plan at all. The player still paid, and what
  // they bought - nobody is coming - is worth knowing.
  const state = holding(2708, { phase: "invisible", bands: { dre: "WARM" } });
  assert.deepEqual(C.selectors.curtisNightPlan(state), []);
  const after = buy(state, "dre", "curtis_targets");
  assert.equal(after.player.cash, state.player.cash - Disclosures.priceFor("curtis_targets"), "it still costs money");
  assert.equal(lastFrom(after, "dre").text, Disclosures.EMPTY_LINES.dre, "and Dre says so in his own words");
});

// --- the purchase -----------------------------------------------------------

test("buying intel debits cash through the canonical path and costs no time", () => {
  const state = holding(2709, { bands: { dre: "WARM" } });
  const before = { cash: state.player.cash, day: state.run.day, slot: state.run.slot, energy: state.player.energy };
  const after = buy(state, "dre", "curtis_targets");
  assert.equal(after.player.cash, before.cash - 50, "$50 for the target list");
  assert.equal(after.player.cash, after.player.dirtyCash + after.player.cleanCash, "the cash invariant holds");
  assert.equal(after.run.day, before.day, "no day passes");
  assert.equal(after.run.slot, before.slot, "no part of day is spent");
  assert.equal(after.player.energy, before.energy, "and no energy");
  assert.deepEqual(after.run.rngState, state.run.rngState, "a purchase draws no randomness");
});

test("the purchase lands as a text from that person plus one feed line", () => {
  const state = holding(2710, { bands: { juan: "TRUSTED" } });
  const after = buy(state, "juan", "police_heat_map");
  const message = lastFrom(after, "juan");
  assert.ok(message, "the intel arrives as a phone text");
  assert.equal(message.from, "Juan", "signed with the name the player saved the number under");
  assert.equal(message.day, state.run.day);
  assert.match(after.log[0].text, /Juan shared some intel\. Check your texts\./);
});

test("a purchase with too little cash changes nothing", () => {
  const state = holding(2711, { cash: 10, bands: { dre: "WARM" } });
  assert.equal(buy(state, "dre", "curtis_targets"), state, "no debit, no message, no cache entry");
  const offer = C.selectors.disclosureOffers(state, "dre").find((row) => row.intelType === "curtis_targets");
  assert.equal(offer.available, false);
  assert.match(offer.reason, /Need \$50/, "and the button says why");
});

test("a combination that is not in the table is refused", () => {
  const state = holding(2712, { bands: { yalonda: "BONDED" } });
  // Yalonda reads the street. She has never been written naming Curtis's plan.
  assert.equal(buy(state, "yalonda", "curtis_targets"), state);
  assert.equal(buy(state, "nobody", "police_heat_map"), state);
});

// --- the cooldown -----------------------------------------------------------

test("one call per person per day: the second ask is refused with no second debit", () => {
  const state = holding(2713, { bands: { dre: "TRUSTED" } });
  const first = buy(state, "dre", "curtis_targets");
  assert.equal(first.player.cash, state.player.cash - 50);
  const second = buy(first, "dre", "curtis_targets");
  assert.equal(second, first, "asking again is identity-equal to not asking");
  // And a different product from the same person is the same refusal: the
  // cooldown is on the person, not the purchase.
  assert.equal(buy(first, "dre", "curtis_pressure"), first);
  const messages = [...first.phone.inbox, ...first.phone.heldInbox].filter((message) => message.from === "Dre");
  assert.equal(messages.length, 1, "and the inbox still holds exactly one Dre text");
});

test("the cooldown is per person, so a second source still answers", () => {
  const state = holding(2714, { bands: { dre: "WARM", juan: "TRUSTED" } });
  const after = buy(buy(state, "dre", "curtis_targets"), "juan", "police_heat_map");
  assert.equal(after.player.cash, state.player.cash - 50 - 30);
  assert.ok(lastFrom(after, "dre") && lastFrom(after, "juan"), "both texts arrive");
});

test("the cooldown clears when the day does, and a stale record cannot leak in", () => {
  const state = holding(2715, { bands: { dre: "WARM" } });
  const after = buy(state, "dre", "curtis_targets");
  assert.equal(C.selectors.disclosureAskedToday(after, "dre"), true);
  const tomorrow = structuredClone(after);
  tomorrow.run.day += 1;
  assert.equal(C.selectors.disclosureAskedToday(tomorrow, "dre"), false, "a new day resets on read");
  assert.equal(buy(tomorrow, "dre", "curtis_targets").player.cash, tomorrow.player.cash - 50, "and he picks up again");
});

// --- staleness --------------------------------------------------------------

test("a disclosure describes the plan at the moment it was bought, and is never re-derived", () => {
  const state = holding(2716, { phase: "ambient", bands: { dre: "TRUSTED" } });
  const planAtPurchase = C.selectors.curtisNightPlan(state);
  const after = buy(state, "dre", "curtis_targets");
  const text = lastFrom(after, "dre").text;
  for (const entry of planAtPurchase) assert.match(text, new RegExp(entry.name), `${entry.name} is named`);

  // Move his awareness the way settleCurtisNight would. The plan changes; the
  // message does not, because nobody calls back with a correction. That is the
  // staleness rule, and it is implemented by the absence of code.
  const later = structuredClone(after);
  const level = CurtisAwareness.phaseFloor("approaching");
  Object.assign(later.curtisAwareness, { level, floor: level, phase: "approaching" });
  const planLater = C.selectors.curtisNightPlan(later);
  assert.notDeepEqual(planLater, planAtPurchase, "the plan really did move");
  assert.equal(lastFrom(later, "dre").text, text, "and the text the player was sold did not");
});

// --- the phone --------------------------------------------------------------

test("with the phone off there is nothing to ask and nothing to buy", () => {
  const state = holding(2717, { bands: { dre: "TRUSTED", juan: "TRUSTED", yalonda: "WARM" } });
  state.phone.active = false;
  for (const npcId of ["dre", "juan", "yalonda"]) {
    const access = C.selectors.disclosureAvailability(state, npcId);
    assert.equal(access.available, false, `${npcId} cannot be asked`);
    assert.match(access.reason, /Phone service is off/);
    for (const offer of access.offers) assert.equal(offer.available, false, `${npcId}/${offer.intelType} is not buyable`);
    assert.equal(buy(state, npcId, access.offers[0].intelType), state, "and the dispatch is a no-op");
  }
});

// --- determinism ------------------------------------------------------------

test("the same seed, day and source produce the same text and the same jitter", () => {
  for (const [npcId, intelType, band] of [["dre", "curtis_targets", "WARM"], ["yalonda", "police_heat_map", "WARM"], ["biniam", "block_vulnerability", "TRUSTED"]]) {
    const a = buy(holding(2718, { bands: { [npcId]: band } }), npcId, intelType);
    const b = buy(holding(2718, { bands: { [npcId]: band } }), npcId, intelType);
    assert.equal(lastFrom(a, npcId).text, lastFrom(b, npcId).text, `${npcId}/${intelType} replays identically`);
  }
});

test("a reload does not reroll what somebody already told you", () => {
  const state = holding(2719, { bands: { biniam: "TRUSTED" } });
  const after = buy(state, "biniam", "block_vulnerability");
  const reloaded = C.inspectSave(C.serializeRun(after));
  assert.ok(reloaded.valid, "the save round-trips");
  assert.equal(reloaded.state.version, C.VERSION);
  assert.equal(lastFrom(reloaded.state, "biniam").text, lastFrom(after, "biniam").text, "the message reads the same back");
  // And re-deriving from the hydrated state lands on the same numbers, which is
  // what makes the hash-not-RNG choice worth having.
  assert.deepEqual(
    C.selectors.disclosurePayload(reloaded.state, "biniam", "block_vulnerability", "jittered"),
    C.selectors.disclosurePayload(after, "biniam", "block_vulnerability", "jittered"),
  );
});

test("the same person asked on different days does not send the same sentence", () => {
  const seen = new Set();
  for (let day = 1; day <= 6; day += 1) {
    const state = holding(2720, { bands: { dre: "TRUSTED" } });
    state.run.day = day;
    seen.add(lastFrom(buy(state, "dre", "curtis_targets"), "dre").text);
  }
  assert.ok(seen.size > 1, "the voice rotates rather than repeating one line forever");
});

// --- the neighbours ---------------------------------------------------------

test("the save schema stays v11 and an old save hydrates into an empty day", () => {
  assert.equal(C.VERSION, 11, "disclosures persist nothing that needs a bump");
  const state = holding(2721, { bands: { dre: "WARM" } });
  const after = buy(state, "dre", "curtis_targets");
  const raw = JSON.parse(JSON.stringify(after));
  delete raw.run.disclosures;
  const hydrated = C.hydrateRun(raw);
  assert.deepEqual(hydrated.run.disclosures, { day: 0, entries: [] }, "a save that predates the field arrives having asked nobody");
  assert.equal(C.selectors.disclosureAskedToday(hydrated, "dre"), false, "so it can still make a call");
});

test("Pherris's territory cards are untouched by a purchase", () => {
  const state = holding(2722, { bands: { dre: "TRUSTED" } });
  Object.assign(state.people.crew.pherris, { introduced: true, recruited: true, status: "active", tier: 3, loyalty: 9, recruitedDay: 1 });
  const before = C.SPENARD_BLOCKS.map((block) => C.selectors.blockIntelView(state, block.id));
  const after = buy(state, "dre", "curtis_targets");
  assert.deepEqual(C.SPENARD_BLOCKS.map((block) => C.selectors.blockIntelView(after, block.id)), before,
    "her standing feed reads exactly the same before and after");
});

test("gossip and disclosure are complementary, not exclusive", () => {
  // The morning warning is a v1.23 delivery on its own schedule; the purchase
  // is a v1.27 call the player made. A player who does both gets both.
  //
  // The voices are pinned at Bonded rather than Warm on purpose: setBand
  // installs a single ledger row, and a night of raids appends enough negative
  // rows to walk a Warm fixture under the delivery gate before the morning
  // arrives. That would make this test fail for a v1.23 reason with nothing to
  // say about v1.27. Heat 0 and two corners keep the night survivable for the
  // same reason.
  const state = holding(2723, {
    blocks: ["northern_lights_motels", "fourth_ave_strip"],
    phase: "watching",
    heat: 0,
    bands: { dre: "TRUSTED", mina: "BONDED", juan: "BONDED", yalonda: "BONDED" },
  });
  state.run.dayEndPending = true;
  state.run.slot = 3;
  let next = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  next.run.pendingEvent = null;
  next.run.pendingEncounter = null;
  const gossipSenders = new Set(Gossip.GOSSIP_VOICE_IDS.map((id) => Gossip.gossipSender(id)));
  const warnings = [...next.phone.inbox, ...next.phone.heldInbox].filter((message) => gossipSenders.has(message.from));
  assert.ok(warnings.length > 0, "the gossip warning still fires on its own");
  const after = buy(next, "dre", "curtis_pressure");
  assert.equal(after.player.cash, next.player.cash - 75, "and the disclosure still sells");
  assert.ok(lastFrom(after, "dre"), "both are in the inbox");
  assert.equal(
    [...after.phone.inbox, ...after.phone.heldInbox].filter((message) => gossipSenders.has(message.from)).length,
    warnings.length,
    "buying intel neither suppresses nor duplicates a gossip text",
  );
});

// --- the surfaces -----------------------------------------------------------

test("the Ask about... panel sells intel from the Phone and only from the Phone", () => {
  const panel = ui.slice(ui.indexOf("function DisclosurePanel("), ui.indexOf("function SocialContacts("));
  assert.match(panel, /C\.selectors\.disclosureAvailability\(state, npcId\)/);
  assert.match(panel, /type: "BUY_DISCLOSURE", npcId, intelType: offer\.intelType/);
  assert.match(panel, /if \(!access\.visible\) return null/, "an NPC with nothing unlocked shows no entry point");
  assert.match(panel, /disabled=\{!offer\.available\}/, "and rows mirror the selector rather than re-deriving the guard");
  assert.match(panel, /disabled=\{!access\.available && !open\}/, "a dead line or a spent call disables the entry point");
  const contacts = ui.slice(ui.indexOf("function SocialContacts("), ui.indexOf("function GymCard("));
  assert.match(contacts, /surface === "phone" && <DisclosurePanel/);
  assert.match(ui, /<SocialContacts state=\{state\} dispatch=\{dispatch\} navigateMore=\{navigateMore\} surface="phone" \/>/);
});

test("the disclosure row is a tap target at the 44px floor and survives a narrow phone", () => {
  assert.match(css, /\.disclosure-row\{[^}]*min-height:44px/);
  assert.match(css, /\.disclosure-buy\{[^}]*min-height:44px/);
  assert.match(css, /\.disclosure-list\{[^}]*grid-column:1\/-1/, "the panel claims the whole contact-actions row");
  assert.match(css, /@media\(max-width:360px\)\{[\s\S]*\.disclosure-row\{flex-wrap:wrap\}/);
});

test("Biniam has a contact card so the block-vulnerability read has a door", () => {
  const biniam = C.STORY_CONTACTS.find((person) => person.id === "biniam");
  assert.ok(biniam, "he is a personal contact");
  const unmet = fresh(2724);
  assert.equal(biniam.visibleWhen(unmet), false, "hidden until The Nile introduces him");
  unmet.npc.biniam.met = true;
  assert.equal(biniam.visibleWhen(unmet), true, "and visible afterwards");
  assert.deepEqual(biniam.actions, [], "with no new verbs beyond the disclosure panel");
  assert.ok(C.selectors.personalContacts(unmet).some((person) => person.id === "biniam"), "so the phone can list him");
});
