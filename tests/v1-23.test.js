const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Territory = require("../src/data/territory.js");
const Gossip = require("../src/data/gossip.js");
const CurtisAwareness = require("../src/data/curtis-awareness.js");
const Exposure = require("../src/exposure/engine.js");
const { clearsCurtisFilter, NPC_CHANNELS } = require("../src/data/propagation.js");
const { resolveLens } = require("../src/data/npc-lenses.js");
const { OBSERVATION_CATEGORIES } = require("../src/data/observations.js");
const { SPENARD_BLOCK_BY_ID } = require("../src/data/locations.js");

// v1.23 - Attack telegraphing through gossip channels.
//
// Before Curtis's people move, the block knows. Whether that reaches the player
// is a relationship question: at Warm and above somebody texts naming the
// corner, below Warm nobody does, and a player with no warm neighborhood
// relationships meets him cold. The silence is the mechanic - it is the first
// place in the game where the social layer pays a tactical dividend.
//
// Three surfaces meet here and must not be confused:
//
//   the plan     curtisNightPlan, a pure read. Which corners his people are
//                working and how hard, ranked and gated by exactly what
//                curtisMoveChance is gated by.
//   Pherris      the standing strategic read on the Territory block card, level
//                3. "These corners are at risk." Unchanged by this build except
//                that it now reads the plan, so it can no longer name a corner
//                Curtis is unable to take.
//   the gossip   a private phone text on the morning of. "They're coming
//                tonight." Phone only.
//
// Nothing new is persisted beyond a session-only run field, so the save schema
// stays at v11.

const root = path.join(__dirname, "..");
const uiSource = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const gossipSource = fs.readFileSync(path.join(root, "src", "data", "gossip.js"), "utf8");
const territorySource = fs.readFileSync(path.join(root, "src", "data", "territory.js"), "utf8");
const coreSource = fs.readFileSync(path.join(root, "game-core.js"), "utf8");

const WARN = Gossip.GOSSIP_WARNING_EVENT;
const RAID = Gossip.GOSSIP_RAID_EVENT;

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

// Puts an NPC on a named band by writing rows their own lens reads, because
// there is nowhere to write a score - a disposition is recomputed from the
// ledger on every read, which is the whole design.
//
// It searches rather than tabulating, and that is not laziness: the same rows do
// NOT put two people in the same place. Deshawn weights loyalty at 4 and Juan at
// 1.5, so a single loyalty row that leaves Juan at Neutral leaves Deshawn at
// Warm - which is exactly the kind of quiet mis-setup that would make a silence
// test pass for the wrong reason. Every ledger below is verified against
// dispositionBand before it is used.
const BAND_LEDGER_CANDIDATES = [];
for (const type of ["loyalty", "presence", "discretion", "growth", "financial", "heat_exposure", "violence", "betrayal"]) {
  for (const count of [1, 2, 3, 5, 7, 11, 15]) BAND_LEDGER_CANDIDATES.push([{ type, count }]);
}
for (const count of [7, 15]) {
  for (const second of ["presence", "discretion", "growth", "financial"]) {
    BAND_LEDGER_CANDIDATES.push([{ type: "loyalty", count }, { type: second, count }]);
  }
  BAND_LEDGER_CANDIDATES.push([{ type: "betrayal", count }, { type: "violence", count }]);
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

// A state holding the named corners at a pinned awareness phase, with the named
// people at Warm. Both level and floor are pinned: the quiet-day bleed would
// otherwise walk the phase back down inside a day-end pass.
function holding(seed, { blocks = ["northern_lights_motels"], phase = "watching", warm = [], soldiers = 2, deshawn = 0, deshawnStatus = "active" } = {}) {
  const state = fresh(seed);
  state.base.controlled = true;
  Object.assign(state.people.crew.eli, {
    introduced: true, recruited: true, status: "active", loyalty: 8, recruitedDay: 1,
    lieutenantStage: "operations_lieutenant", lieutenantEffectiveness: 1, operationPolicy: "manual",
  });
  if (deshawn) {
    Object.assign(state.people.crew.deshawn, {
      introduced: true, recruited: true, status: deshawnStatus, loyalty: 9, recruitedDay: 1, tier: deshawn,
    });
  }
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
  for (const npcId of warm) setBand(state, npcId, "WARM");
  return state;
}

function endDay(state) {
  const next = structuredClone(state);
  next.run.dayEndPending = true;
  return C.reduceGame(next, { type: "CONFIRM_END_DAY" });
}

// Everything in the inbox, held or delivered, that came from a gossip voice.
// Eli's nightly report is not gossip and is filtered out everywhere.
function gossipTexts(state) {
  const senders = new Set(Gossip.GOSSIP_VOICE_IDS.map((id) => Gossip.gossipSender(id)));
  return [...state.phone.inbox, ...state.phone.heldInbox].filter((message) => senders.has(message.from));
}

function pendingWarnings(state) {
  return state.run.pendingObservations.filter((entry) => entry.observation.type === "territory" && entry.observation.event === WARN);
}

const ALL_PHASES = ["invisible", "ambient", "watching", "approaching"];

// --- The plan ---------------------------------------------------------------

test("the nightly plan names corners, ranked, with a pressure weight each", () => {
  const state = holding(2301, { blocks: ["northern_lights_motels", "fourth_ave_strip", "minnesota_offramp"], phase: "approaching" });
  const plan = C.selectors.curtisNightPlan(state);
  assert.deepEqual(plan.map((entry) => entry.blockId), ["northern_lights_motels", "fourth_ave_strip", "minnesota_offramp"],
    "most visible first, then what taking it back is worth");
  assert.deepEqual(plan.map((entry) => entry.weight), [2, 2, 1],
    "five points of pressure, capped at two a corner, spent down the list");
  assert.equal(plan.reduce((sum, entry) => sum + entry.weight, 0), Territory.CURTIS_PRESSURE_BUDGET_BY_PHASE.approaching);
  for (const entry of plan) assert.equal(entry.name, SPENARD_BLOCK_BY_ID[entry.blockId].name, "the display name travels with the plan");
});

test("the plan deepens with the phase and is empty while he is not looking", () => {
  const blocks = ["northern_lights_motels", "fourth_ave_strip", "minnesota_offramp"];
  const expected = {
    invisible: [],
    ambient: [["northern_lights_motels", 1]],
    watching: [["northern_lights_motels", 2], ["fourth_ave_strip", 1]],
    approaching: [["northern_lights_motels", 2], ["fourth_ave_strip", 2], ["minnesota_offramp", 1]],
  };
  for (const phase of ALL_PHASES) {
    const state = holding(2302, { blocks, phase });
    assert.deepEqual(
      C.selectors.curtisNightPlan(state).map((entry) => [entry.blockId, entry.weight]),
      expected[phase],
      `${phase} plan`,
    );
  }
});

test("the plan and curtisMoveChance can no longer disagree", () => {
  const blocks = ["northern_lights_motels", "fourth_ave_strip", "minnesota_offramp", "spenard_rec_lot", "wash_and_go_lot", "service_road_chokepoint"];
  for (const phase of ALL_PHASES) {
    const state = holding(2303, { blocks, phase });
    for (const entry of C.selectors.curtisNightPlan(state)) {
      assert.ok(
        C.selectors.curtisMoveChance(state, entry.blockId) > 0,
        `${phase}: the plan named ${entry.blockId}, which he cannot take`,
      );
    }
  }
});

test("the quiet lot is on nobody's plan at any phase, and neither is a corner below the gate", () => {
  const blocks = ["spenard_rec_lot", "minnesota_offramp"];
  for (const phase of ALL_PHASES) {
    const targets = C.selectors.curtisBlockTargets(holding(2304, { blocks, phase }));
    assert.ok(!targets.includes("spenard_rec_lot"), `${phase}: visibility 0 is never his`);
  }
  // Minnesota Off-Ramp is visibility 1. The ambient gate is 2, so at ambient it
  // is not on the board even though it is the only other corner held.
  assert.deepEqual(C.selectors.curtisBlockTargets(holding(2304, { blocks, phase: "ambient" })), []);
  assert.deepEqual(C.selectors.curtisBlockTargets(holding(2304, { blocks, phase: "watching" })), ["minnesota_offramp"]);
});

test("the target list Pherris reads is the plan, flattened", () => {
  const state = holding(2305, { blocks: ["northern_lights_motels", "fourth_ave_strip"], phase: "approaching" });
  assert.deepEqual(
    C.selectors.curtisBlockTargets(state),
    C.selectors.curtisNightPlan(state).map((entry) => entry.blockId),
  );
});

test("the plan is a pure read: no stored state, no draw off the rng stream", () => {
  const state = holding(2306, { blocks: ["northern_lights_motels", "fourth_ave_strip"], phase: "watching" });
  const first = JSON.stringify(C.selectors.curtisNightPlan(state));
  const rngBefore = JSON.stringify(state.run.rngState);
  for (let i = 0; i < 5; i += 1) assert.equal(JSON.stringify(C.selectors.curtisNightPlan(state)), first, "reading it again never rerolls it");
  assert.equal(JSON.stringify(state.run.rngState), rngBefore, "and never consumes a draw");
  const reloaded = C.hydrateRun(JSON.parse(C.serializeRun(state)));
  assert.equal(JSON.stringify(C.selectors.curtisNightPlan(reloaded)), first, "a reloaded save re-derives the same plan");
});

test("the plan does not read the garrison - it is his intent, not the odds", () => {
  const posted = holding(2307, { blocks: ["northern_lights_motels"], phase: "watching", soldiers: 3 });
  const empty = holding(2307, { blocks: ["northern_lights_motels"], phase: "watching", soldiers: 0 });
  assert.deepEqual(C.selectors.curtisNightPlan(posted), C.selectors.curtisNightPlan(empty),
    "posting soldiers changes the odds, never whether he is coming");
});

// --- The observation --------------------------------------------------------

test("one observation per targeted corner, on the neighborhood channel", () => {
  const state = holding(2310, { blocks: ["northern_lights_motels", "fourth_ave_strip"], phase: "watching", deshawn: 1 });
  const raised = C.emitCurtisGossipWarningsForTest(state);
  assert.deepEqual(raised, ["northern_lights_motels", "fourth_ave_strip"]);
  const byCorner = new Map();
  for (const entry of pendingWarnings(state)) {
    assert.equal(entry.observation.source, "neighborhood", "it arrives as neighborhood gossip, not as something witnessed");
    byCorner.set(entry.observation.location, (byCorner.get(entry.observation.location) || 0) + 1);
  }
  assert.deepEqual([...byCorner.keys()].sort(), ["fourth_ave_strip", "northern_lights_motels"]);
  const audience = C.gossipAudienceForTest(state, "north_star_lot");
  for (const count of byCorner.values()) assert.equal(count, audience.length, "one row per corner per listener");
});

test("the observation carries the corner and the pressure weight", () => {
  const state = holding(2311, { blocks: ["northern_lights_motels"], phase: "watching" });
  C.emitCurtisGossipWarningsForTest(state);
  const entry = pendingWarnings(state)[0];
  assert.equal(entry.observation.location, "northern_lights_motels");
  assert.equal(entry.observation.value, 2, "the top corner at watching is worth two points of pressure");
});

test("the warning never reaches Curtis, by two independent rules", () => {
  const state = holding(2312, { blocks: ["northern_lights_motels", "fourth_ave_strip"], phase: "approaching", deshawn: 1 });
  C.emitCurtisGossipWarningsForTest(state);
  assert.ok(!pendingWarnings(state).some((entry) => entry.npcId === "curtis"), "he is not on the neighborhood channel");
  assert.ok(!NPC_CHANNELS.curtis.includes("neighborhood"));
  assert.equal(clearsCurtisFilter({ type: "territory", event: WARN, value: 2 }), false,
    "and territory does not clear his network filter either");
  assert.equal(clearsCurtisFilter({ type: "territory", event: RAID, value: null }), false);
  assert.equal(state.npc.curtis.ledger.filter((row) => row.type === "territory").length, 0);
});

test("territory is a category every lens scores at zero", () => {
  assert.ok(OBSERVATION_CATEGORIES.includes("territory"));
  for (const npcId of C.EXPOSURE_NPC_IDS) {
    const lens = resolveLens(npcId);
    assert.equal(lens.weights.territory, 0, `${npcId} must not be moved by news about Curtis`);
  }
  const state = holding(2313, { blocks: ["northern_lights_motels"], phase: "watching", warm: ["mina"] });
  const before = C.selectors.disposition(state, "mina");
  const after = endDay(state);
  assert.ok(after.npc.mina.ledger.some((row) => row.type === "territory"), "she heard it");
  assert.equal(C.selectors.disposition(after, "mina"), before, "and it moved nothing");
});

// --- Who speaks, and who does not -------------------------------------------

test("Warm and above speak; Neutral and below are silent", () => {
  const speaks = { HOSTILE: false, COLD: false, NEUTRAL: false, WARM: true, TRUSTED: true, BONDED: true };
  for (const [bandName, expected] of Object.entries(speaks)) {
    const state = holding(2320, { blocks: ["northern_lights_motels"], phase: "watching" });
    setBand(state, "mina", bandName);
    assert.equal(C.bandId(C.selectors.dispositionBand(state, "mina")), bandName.toLowerCase(), `${bandName} setup`);
    const after = endDay(state);
    const texts = gossipTexts(after);
    assert.equal(texts.length > 0, expected, `${bandName} should ${expected ? "speak" : "say nothing"}`);
    if (expected) assert.equal(texts[0].from, "Mina");
  }
});

test("a player with no warm neighborhood relationships meets him cold", () => {
  const state = holding(2321, { blocks: ["northern_lights_motels", "fourth_ave_strip"], phase: "approaching", deshawn: 1 });
  for (const npcId of Gossip.GOSSIP_VOICE_IDS) setBand(state, npcId, "NEUTRAL");
  const after = endDay(state);
  assert.equal(gossipTexts(after).length, 0, "the neighborhood knows and nobody tells them");
  assert.ok(after.npc.mina.ledger.some((row) => row.event === WARN), "the observation still landed - only the text did not");
});

test("an NPC nobody has ever observed cannot speak", () => {
  const state = holding(2322, { blocks: ["northern_lights_motels"], phase: "watching" });
  for (const npcId of Gossip.GOSSIP_VOICE_IDS) state.npc[npcId].ledger = [];
  const after = endDay(state);
  assert.equal(gossipTexts(after).length, 0, "an empty ledger is not a relationship, whatever a default might say");
});

test("the closest person speaks, and ties break on a hash rather than key order", () => {
  const state = holding(2323, { blocks: ["northern_lights_motels"], phase: "watching" });
  setBand(state, "mina", "WARM");
  setBand(state, "yalonda", "BONDED");
  assert.equal(gossipTexts(endDay(state))[0].from, "Yalonda", "the closest one, not the first one defined");
  const tied = holding(2323, { blocks: ["northern_lights_motels"], phase: "watching" });
  setBand(tied, "yalonda", "WARM");
  setBand(tied, "juan", "WARM");
  assert.equal(C.selectors.disposition(tied, "yalonda"), C.selectors.disposition(tied, "juan"), "genuinely tied");
  const first = gossipTexts(endDay(tied))[0].from;
  for (let i = 0; i < 3; i += 1) assert.equal(gossipTexts(endDay(structuredClone(tied)))[0].from, first, "and it resolves the same way every time");
  assert.ok(["Yalonda", "Juan"].includes(first));
});

test("every voice is authored, names the corner by its display name, and nobody speaks twice in a day", () => {
  for (const npcId of Gossip.GOSSIP_VOICE_IDS) {
    const state = holding(2324, { blocks: ["northern_lights_motels"], phase: "watching" });
    setBand(state, npcId, "BONDED");
    const texts = gossipTexts(endDay(state));
    assert.equal(texts.length, 1, `${npcId} sends exactly one`);
    assert.equal(texts[0].from, Gossip.gossipSender(npcId));
    assert.equal(texts[0].text, Gossip.gossipText(npcId, WARN, "Northern Lights Motel Row"), `${npcId} uses their own line`);
    assert.match(texts[0].text, /Northern Lights Motel Row/);
  }
  const lines = new Set(Gossip.GOSSIP_VOICE_IDS.map((id) => Gossip.gossipText(id, WARN, "Motel Row")));
  assert.equal(lines.size, Gossip.GOSSIP_VOICE_IDS.length, "seven voices, seven distinct lines");
});

test("one voice, one text a day, even when several corners are called", () => {
  const state = holding(2325, { blocks: ["northern_lights_motels", "fourth_ave_strip", "minnesota_offramp"], phase: "approaching", deshawn: 1 });
  setBand(state, "mina", "BONDED");
  const after = endDay(state);
  const texts = gossipTexts(after);
  assert.equal(texts.length, 1, "the one warm voice says one thing");
  assert.equal(texts[0].from, "Mina");
  assert.match(texts[0].text, /Northern Lights Motel Row/, "and says it about the corner he wants most, not the first one alphabetically");
  assert.equal(C.selectors.curtisNightPlan(state)[0].blockId, "northern_lights_motels");
  assert.deepEqual(after.run.gossipVoices.npcIds, ["mina"]);
  assert.equal(after.run.gossipVoices.day, after.run.day);
});

// --- Timing -----------------------------------------------------------------

test("the warning lands the morning of the night it describes", () => {
  const state = holding(2330, { blocks: ["northern_lights_motels"], phase: "watching", warm: ["mina"] });
  const startDay = state.run.day;
  const after = endDay(state);
  const message = gossipTexts(after)[0];
  assert.equal(after.run.day, startDay + 1);
  assert.equal(message.day, startDay + 1, "the attack day");
  assert.equal(message.slot, 0, "at Morning");
  assert.equal(pendingWarnings(after).length, 0, "and nothing is left waiting");
});

test("the warning describes the night that has not happened yet, not the one that just did", () => {
  const state = holding(2331, { blocks: ["northern_lights_motels", "fourth_ave_strip"], phase: "watching", deshawn: 1 });
  for (const npcId of Gossip.GOSSIP_VOICE_IDS) setBand(state, npcId, "WARM");
  const after = endDay(state);
  const named = gossipTexts(after).map((message) => message.text).join(" ");
  for (const blockId of C.selectors.curtisBlockTargets(after)) {
    assert.match(named, new RegExp(SPENARD_BLOCK_BY_ID[blockId].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      "the corners named are the ones tomorrow's plan is working");
  }
});

// --- Deshawn ----------------------------------------------------------------

test("without Deshawn the player hears the loudest signal only", () => {
  const state = holding(2340, { blocks: ["northern_lights_motels", "fourth_ave_strip", "minnesota_offramp"], phase: "approaching" });
  for (const npcId of Gossip.GOSSIP_VOICE_IDS) setBand(state, npcId, "WARM");
  assert.equal(C.selectors.curtisNightPlan(state).length, 3, "three corners are genuinely on his plan");
  const texts = gossipTexts(endDay(state));
  assert.equal(texts.length, Territory.GOSSIP_WARNING_BASE_SCOPE, "and exactly one of them reaches the player");
  assert.match(texts[0].text, /Northern Lights Motel Row/, "the top target");
});

test("Deshawn tier 1 widens the window to every corner on the plan", () => {
  const state = holding(2341, { blocks: ["northern_lights_motels", "fourth_ave_strip", "minnesota_offramp"], phase: "approaching", deshawn: 1 });
  for (const npcId of Gossip.GOSSIP_VOICE_IDS) setBand(state, npcId, "WARM");
  const named = gossipTexts(endDay(state)).map((message) => message.text).join(" ");
  for (const name of ["Northern Lights Motel Row", "Fourth Avenue Strip", "Minnesota Off-Ramp"]) {
    assert.ok(named.includes(name), `${name} is warned about`);
  }
});

test("Deshawn tier 2 tells the player how hard, which is how many soldiers to post", () => {
  const blocks = ["northern_lights_motels", "fourth_ave_strip"];
  const state = holding(2342, { blocks, phase: "watching", deshawn: 2 });
  for (const npcId of Gossip.GOSSIP_VOICE_IDS) setBand(state, npcId, "WARM");
  assert.deepEqual(C.selectors.curtisNightPlan(state).map((entry) => entry.weight), [2, 1], "one for real, one being scouted");
  const texts = gossipTexts(endDay(state));
  const hard = texts.find((message) => message.text.includes("Northern Lights Motel Row"));
  const looking = texts.find((message) => message.text.includes("Fourth Avenue Strip"));
  assert.match(hard.text, /coming hard/);
  assert.match(looking.text, /just looking/);
  const tier1 = holding(2342, { blocks, phase: "watching", deshawn: 1 });
  for (const npcId of Gossip.GOSSIP_VOICE_IDS) setBand(tier1, npcId, "WARM");
  for (const message of gossipTexts(endDay(tier1))) {
    assert.doesNotMatch(message.text, /coming hard|just looking/, "tier 1 knows they are coming, not how hard");
  }
});

test("Deshawn tier 3 arrives the evening before instead of the morning of", () => {
  const state = holding(2343, { blocks: ["northern_lights_motels"], phase: "watching", warm: ["mina"], deshawn: 3 });
  const startDay = state.run.day;
  const after = endDay(state);
  const message = gossipTexts(after)[0];
  assert.equal(message.day, startDay, "the night before the attack day");
  assert.equal(message.slot, 3, "at Night");
  const standard = gossipTexts(endDay(holding(2343, { blocks: ["northern_lights_motels"], phase: "watching", warm: ["mina"], deshawn: 2 })))[0];
  assert.equal(standard.day, startDay + 1, "tier 2 still waits for the morning");
});

test("a departed Deshawn reverts the player to the no-Deshawn behavior", () => {
  const blocks = ["northern_lights_motels", "fourth_ave_strip", "minnesota_offramp"];
  for (const [label, options] of [
    ["departed", { deshawn: 3, deshawnStatus: "departed" }],
    ["never recruited", {}],
  ]) {
    const state = holding(2344, { blocks, phase: "approaching", ...options });
    for (const npcId of Gossip.GOSSIP_VOICE_IDS) setBand(state, npcId, "WARM");
    const startDay = state.run.day;
    const texts = gossipTexts(endDay(state));
    assert.equal(texts.length, 1, `${label}: one corner`);
    assert.equal(texts[0].day, startDay + 1, `${label}: morning of, not the evening before`);
    assert.doesNotMatch(texts[0].text, /coming hard|just looking/, `${label}: no pressure read`);
  }
});

test("Deshawn does not deliver the warning by virtue of being on the payroll", () => {
  const state = holding(2345, { blocks: ["northern_lights_motels"], phase: "watching", deshawn: 3 });
  setBand(state, "deshawn", "NEUTRAL");
  setBand(state, "mina", "BONDED");
  const texts = gossipTexts(endDay(state));
  assert.equal(texts.length, 1);
  assert.equal(texts[0].from, "Mina", "his network hears it earlier and wider; whoever the player is closest to says it");
});

// --- Police raids, after the fact -------------------------------------------

test("a police raid gets a morning-after read from a Warm+ neighbor", () => {
  const state = holding(2350, { blocks: ["northern_lights_motels"], phase: "invisible", warm: ["mina"] });
  const startDay = state.run.day;
  C.emitRaidGossipForTest(state, "northern_lights_motels");
  state.run.day = startDay + 1;
  state.run.slot = 0;
  C.drainObservationsForTest(state);
  const texts = gossipTexts(state);
  assert.equal(texts.length, 1);
  assert.equal(texts[0].from, "Mina");
  assert.equal(texts[0].text, Gossip.gossipText("mina", RAID, "Northern Lights Motel Row"));
  assert.equal(texts[0].day, startDay + 1, "the morning after");
  assert.equal(texts[0].slot, 0);
});

test("the raid read is silent below Warm, and never predictive", () => {
  const state = holding(2351, { blocks: ["northern_lights_motels"], phase: "invisible" });
  for (const npcId of Gossip.GOSSIP_VOICE_IDS) setBand(state, npcId, "NEUTRAL");
  C.emitRaidGossipForTest(state, "northern_lights_motels");
  state.run.day += 1;
  state.run.slot = 0;
  C.drainObservationsForTest(state);
  assert.equal(gossipTexts(state).length, 0);
  // The police answer Heat, which can move at any time, so there is deliberately
  // nothing on the predictive side of this surface to find.
  assert.equal(coreSource.includes("police_raid_planned"), false, "no predictive police warning exists");
});

test("two corners raided the same night is two texts, never two about one corner", () => {
  const state = holding(2352, { blocks: ["northern_lights_motels", "fourth_ave_strip"], phase: "invisible" });
  setBand(state, "mina", "BONDED");
  setBand(state, "yalonda", "TRUSTED");
  C.emitRaidGossipForTest(state, "northern_lights_motels");
  C.emitRaidGossipForTest(state, "fourth_ave_strip");
  state.run.day += 1;
  state.run.slot = 0;
  C.drainObservationsForTest(state);
  const texts = gossipTexts(state);
  assert.equal(texts.length, 2);
  assert.equal(new Set(texts.map((message) => message.from)).size, 2, "two people, because one voice speaks once a day");
  const corners = texts.map((message) => (message.text.includes("Northern Lights Motel Row") ? "motels" : "fourth"));
  assert.deepEqual([...corners].sort(), ["fourth", "motels"]);
});

test("the police pass raises the corner-scoped read alongside v1.21's district-scoped one", () => {
  assert.match(coreSource, /event: "police_raid", channel: "neighborhood", location: HOME_DISTRICT_ID \}\);\s*\n(\s*\/\/.*\n)*\s*emitRaidGossip\(state, block\.id\);/,
    "the v1.21 broadcast is intact and the corner-scoped read rides beside it");
});

// --- Reconciliation with Pherris's standing intel ----------------------------

test("Pherris can text the tip and still be showing the standing intel", () => {
  const state = holding(2360, { blocks: ["northern_lights_motels"], phase: "watching" });
  Object.assign(state.people.crew.pherris, { introduced: true, recruited: true, status: "active", loyalty: 9, recruitedDay: 1, tier: 3 });
  setBand(state, "pherris", "BONDED");
  const after = endDay(state);
  const texts = gossipTexts(after);
  assert.equal(texts.length, 1);
  assert.equal(texts[0].from, "Pherris");
  const view = C.selectors.blockIntelView(after, "northern_lights_motels");
  assert.equal(view.level, 3);
  assert.equal(view.targeted, true, "the block card read is untouched by her having also said it out loud");
});

test("the Territory page carries no gossip text - the tip is the Phone's alone", () => {
  assert.ok(uiSource.includes("Pherris: Curtis's people are asking about this corner"), "her standing intel line is unchanged");
  for (const npcId of Gossip.GOSSIP_VOICE_IDS) {
    const line = Gossip.gossipText(npcId, WARN, "Northern Lights Motel Row");
    assert.equal(uiSource.includes(line), false, `${npcId}'s warning must not render on a block card`);
  }
  assert.equal(uiSource.includes(WARN), false, "the UI has no reason to know the event id");
});

// --- Determinism, schema, and the social sweep -------------------------------

test("nothing in the gossip path draws a random number", () => {
  for (const [label, source] of [["gossip.js", gossipSource], ["territory.js", territorySource]]) {
    assert.doesNotMatch(source, /Math\.random\(/, `${label} must not use Math.random`);
  }
  const state = holding(2370, { blocks: ["northern_lights_motels", "fourth_ave_strip"], phase: "watching", warm: ["mina", "yalonda"], deshawn: 1 });
  const first = gossipTexts(endDay(state)).map((message) => `${message.from}|${message.text}`);
  for (let i = 0; i < 3; i += 1) {
    assert.deepEqual(gossipTexts(endDay(structuredClone(state))).map((message) => `${message.from}|${message.text}`), first,
      "the same day replays to the same messengers and the same words");
  }
  const reloaded = C.hydrateRun(JSON.parse(C.serializeRun(state)));
  assert.deepEqual(gossipTexts(endDay(reloaded)).map((message) => `${message.from}|${message.text}`), first,
    "and a reloaded save replays it rather than rerolling it");
});

test("the save schema stays at v11 and older saves hydrate additively", () => {
  assert.equal(C.VERSION, 11);
  const state = holding(2371, { blocks: ["northern_lights_motels"], phase: "watching", warm: ["mina"] });
  const legacy = JSON.parse(C.serializeRun(state));
  delete legacy.run.gossipVoices;
  const hydrated = C.hydrateRun(legacy);
  assert.deepEqual(hydrated.run.gossipVoices, { day: 0, npcIds: [] }, "a save with no record of it hydrates to nobody having spoken");
  assert.equal(gossipTexts(endDay(hydrated)).length, 1, "and plays");
});

// A player who builds relationships hears about the night; a player who does not
// mostly meets it cold. Two cohorts over the same 200 seeds with the same
// holdings and the same phase, so the only variable is who they know.
//
// The solitary cohort is not asserted at a flat zero, and the reason is worth
// stating: a run is a day of play, and a day of play writes observations. An NPC
// parked just under the Warm floor can be carried over it by something that
// happened between the warning being raised and the warning being delivered,
// which is the system behaving correctly - the gate is read at delivery, not at
// emission. So the assertion is the invariant rather than the count: nobody
// speaks who was not Warm or better when they spoke.
test("warnings track the player's social behavior across 200 seeded runs", () => {
  const blocks = ["northern_lights_motels", "fourth_ave_strip"];
  let social = 0;
  let solitary = 0;
  let plans = 0;
  const leaks = [];
  for (let seed = 1; seed <= 200; seed += 1) {
    const base = holding(seed, { blocks, phase: "watching" });
    if (C.selectors.curtisNightPlan(base).length) plans += 1;

    const warm = structuredClone(base);
    for (const npcId of ["mina", "yalonda", "juan"]) setBand(warm, npcId, "WARM");
    social += gossipTexts(endDay(warm)).length;

    const alone = structuredClone(base);
    for (const npcId of Gossip.GOSSIP_VOICE_IDS) setBand(alone, npcId, "NEUTRAL");
    const after = endDay(alone);
    const spoke = gossipTexts(after);
    solitary += spoke.length;
    for (const message of spoke) {
      const npcId = Gossip.GOSSIP_VOICE_IDS.find((id) => Gossip.gossipSender(id) === message.from);
      if (C.selectors.dispositionBand(after, npcId) < C.BANDS.WARM) leaks.push(`${seed}:${npcId}`);
    }
  }
  assert.equal(plans, 200, "every seed had a plan to warn about");
  assert.deepEqual(leaks, [], "nobody below Warm ever spoke");
  assert.ok(social >= 200, `a player who built relationships is warned every time (got ${social})`);
  assert.ok(solitary * 4 < social, `and building nothing is worth far less information (${solitary} vs ${social})`);
});
