const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Territory = require("../src/data/territory.js");
const CurtisAwareness = require("../src/data/curtis-awareness.js");
const { SPENARD_BLOCKS, SPENARD_BLOCK_BY_ID } = require("../src/data/locations.js");
const Selectors = require("../src/selectors.js");
const { measure, ALL_BLOCK_IDS } = require("./measure-lieutenant-modifiers.js");

// v1.28 - the Curtis pressure balance pass. Phase 2.2, closed.
//
// Everything about him on the block layer had been authored rather than
// measured: a base chance picked in v1.21 to sit somewhere reasonable against a
// divisor, a phase multiplier ladder nobody had run, and a pressure budget that
// was a first position. This build swept them through the territory harness -
// which has worked since v1.20, and which the 10-day simulator cap never had
// anything to do with - and shipped the numbers that came back.
//
// Four things are new behavior rather than new numbers:
//
//   the heat probe    Above Heat 8 his chance is multiplied up. Not because he
//                     talks to the police, but because a hot player's soldiers
//                     keep getting arrested and an understaffed corner is an
//                     easier corner. He is an opportunist, not a strategist.
//   the unstaffed     An empty corner is half a defender rather than a whole
//   term              one, which is the first time posting your FIRST soldier
//                     on a corner has bought anything. This is where "probe the
//                     weakest" lives - at resolution, in the odds, not in the
//                     plan.
//   the grudge        A corner he has already taken back once outranks
//                     everything else in the plan.
//   the bank          Pressure the plan could not spend carries to tomorrow,
//                     capped, and is dropped when the phase moves.
//
// The two boundaries this suite exists to hold:
//
//   THE PLAN STAYS GARRISON-BLIND. The spec asked for "probe the weakest" in
//   curtisNightPlan. It is not there and must not go there: a plan that read
//   soldier counts would change the instant a warned player moved somebody, so
//   the warning would falsify itself and v1.23's whole contract - warn tonight,
//   re-derive the identical plan tomorrow - would go with it.
//
//   THE PLAN STAYS A PURE READ. The bank is read here and written by the
//   resolver, once per crossed day, BEFORE the warnings are raised. Any other
//   order telegraphs one plan and resolves a different one.
//
// Save schema stays v11: one additive boolean on the block record, one
// object-shaped session field on `run`, both hydrated by mergeDefaults.

const root = path.join(__dirname, "..");
const territorySource = fs.readFileSync(path.join(root, "src", "data", "territory.js"), "utf8");
const selectorSource = fs.readFileSync(path.join(root, "src", "selectors.js"), "utf8");

const ALL_PHASES = ["invisible", "ambient", "watching", "approaching"];

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "TwentyEight" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  return structuredClone(state);
}

// A run already holding corners. `soldiersByBlock` overrides the flat count for
// one block, which is how the probe tests put different headcounts on corners
// that are otherwise identical to him.
function holding(seed, { blocks = ["northern_lights_motels"], phase = "watching", soldiers = 2, soldiersByBlock = {}, heat = 4, retaken = [] } = {}) {
  const state = fresh(seed);
  state.base.controlled = true;
  state.player.heat = heat;
  Object.assign(state.people.crew.eli, {
    introduced: true, recruited: true, status: "active", loyalty: 8, recruitedDay: 1,
    lieutenantStage: "operations_lieutenant", lieutenantEffectiveness: 1, operationPolicy: "manual",
  });
  const level = CurtisAwareness.phaseFloor(phase);
  Object.assign(state.curtisAwareness, { level, floor: level, phase, phaseMessagesSent: ["watching", "approaching"] });
  let next = 1;
  for (const blockId of blocks) {
    const record = state.world.territoryBlocks[blockId];
    record.owner = "player";
    record.capturedDay = 1;
    const count = soldiersByBlock[blockId] != null ? soldiersByBlock[blockId] : soldiers;
    for (let i = 0; i < count; i += 1) {
      const id = `soldier_${next++}`;
      state.world.soldiers[id] = { id, status: "active", blockId };
      record.soldiersAssigned.push(id);
    }
  }
  for (const blockId of retaken) state.world.territoryBlocks[blockId].curtisTookBack = true;
  state.world.nextSoldierId = next;
  return state;
}

// --- The heat probe ---------------------------------------------------------

test("the heat factor is exactly 1.0 at or below the floor and rises 5% a point above it", () => {
  const state = holding(2801);
  const expected = { 0: 1, 3: 1, 5: 1, 7: 1, 8: 1, 9: 1.05, 10: 1.1, 12: 1.2, 15: 1.35 };
  for (const [heat, factor] of Object.entries(expected)) {
    state.player.heat = Number(heat);
    assert.ok(Math.abs(C.selectors.curtisHeatFactor(state) - factor) < 1e-12,
      `Heat ${heat} reads ${C.selectors.curtisHeatFactor(state)}, wanted ${factor}`);
  }
  assert.equal(Territory.CURTIS_HEAT_PROBE_FLOOR, 8);
  assert.equal(Territory.CURTIS_HEAT_PROBE_PER_POINT, 0.05);
});

test("the factor multiplies the Curtis roll and nothing else", () => {
  const blockId = "northern_lights_motels";
  const cold = holding(2802, { blocks: [blockId], heat: 0 });
  const base = C.selectors.curtisMoveChance(cold, blockId);
  const basePolice = C.selectors.policeRaidChance(cold, blockId);
  for (const [heat, factor] of [[8, 1], [12, 1.2], [15, 1.35]]) {
    const hot = holding(2802, { blocks: [blockId], heat });
    assert.ok(Math.abs(C.selectors.curtisMoveChance(hot, blockId) - base * factor) < 1e-12,
      `Heat ${heat} should scale the Curtis roll by ${factor}`);
  }
  // The police read Heat too, on their own weight, and the probe must not have
  // touched that path - a shared multiplier would re-merge the two adversaries
  // v1.21 split apart.
  const hot = holding(2802, { blocks: [blockId], heat: 15 });
  assert.ok(Math.abs(C.selectors.policeRaidChance(hot, blockId)
    - Math.min(0.9, basePolice + 15 * Territory.POLICE_HEAT_WEIGHT)) < 1e-12,
    "the police still read Heat on POLICE_HEAT_WEIGHT and nothing else");
});

test("the probe is a read, not a plan: it never changes what the player is warned about", () => {
  const blocks = ["northern_lights_motels", "fourth_ave_strip", "minnesota_offramp"];
  const cold = C.selectors.curtisNightPlan(holding(2803, { blocks, phase: "approaching", heat: 0 }));
  for (const heat of [8, 12, 15]) {
    assert.deepEqual(C.selectors.curtisNightPlan(holding(2803, { blocks, phase: "approaching", heat })), cold,
      `Heat ${heat} moves the odds, never the intent`);
  }
});

test("the probe draws nothing: the gate is still the hash it always was", () => {
  const blockId = "northern_lights_motels";
  const state = holding(2804, { blocks: [blockId], heat: 15 });
  const before = JSON.stringify(state.run.rngState);
  for (let i = 0; i < 5; i += 1) C.selectors.curtisMoveChance(state, blockId);
  assert.equal(JSON.stringify(state.run.rngState), before, "reading the chance never consumes a draw");
  assert.doesNotMatch(territorySource, /Math\.random\(/);
});

// --- Probe the weakest, at resolution -------------------------------------

test("a 0-soldier corner outranks a 2-soldier corner in the odds, at the same visibility", () => {
  // Two corners he cannot tell apart on any stat he reads: same visibility, and
  // the only difference between them is who is standing there.
  const a = "fourth_ave_strip";        // visibility 2
  const b = "service_road_chokepoint"; // visibility 2
  assert.equal(SPENARD_BLOCK_BY_ID[a].curtisVisibility, SPENARD_BLOCK_BY_ID[b].curtisVisibility);
  const state = holding(2805, { blocks: [a, b], soldiersByBlock: { [a]: 0, [b]: 2 } });
  assert.ok(C.selectors.curtisMoveChance(state, a) > C.selectors.curtisMoveChance(state, b),
    "the empty one is the one he walks onto");
  assert.equal(C.selectors.curtisMoveChance(state, a), C.selectors.curtisMoveChance(state, b) * 4,
    "half a defender against two is a factor of four");
});

test("the first soldier posted is worth as much as the second", () => {
  const blockId = "northern_lights_motels";
  const chance = (n) => C.selectors.curtisMoveChance(holding(2806, { blocks: [blockId], soldiers: n }), blockId);
  assert.equal(chance(0), chance(1) * 2, "nobody standing there is half a defender");
  assert.equal(chance(1), chance(2) * 2, "and the v1.20 promise that a second soldier halves it is untouched");
  assert.equal(Territory.CURTIS_UNSTAFFED_DEFENSE, 0.5);
});

test("probing the weakest lives in the odds and never in the plan", () => {
  const blocks = ["northern_lights_motels", "fourth_ave_strip"];
  const stacked = holding(2807, { blocks, soldiersByBlock: { northern_lights_motels: 3, fourth_ave_strip: 0 } });
  const flat = holding(2807, { blocks, soldiers: 2 });
  assert.deepEqual(C.selectors.curtisNightPlan(stacked), C.selectors.curtisNightPlan(flat),
    "posting people changes the odds, never whether he is coming - v1.23's contract, still held");
  assert.doesNotMatch(
    selectorSource.slice(selectorSource.indexOf("function curtisNightPlan("), selectorSource.indexOf("function curtisPressureLeftover(")),
    /soldiersAssigned/,
    "the planner does not read the garrison",
  );
});

// --- The grudge -------------------------------------------------------------

test("a corner he has taken back once outranks a more visible one he has not", () => {
  // The strong form. Minnesota Off-Ramp is visibility 1 and Northern Lights is
  // visibility 3, so without the grudge the motels lead by two whole points of
  // the stat that normally decides everything.
  const blocks = ["northern_lights_motels", "minnesota_offramp"];
  const plain = holding(2808, { blocks, phase: "watching" });
  assert.equal(C.selectors.curtisNightPlan(plain)[0].blockId, "northern_lights_motels",
    "visibility orders him when nothing has a history");
  const grudge = holding(2808, { blocks, phase: "watching", retaken: ["minnesota_offramp"] });
  assert.equal(C.selectors.curtisNightPlan(grudge)[0].blockId, "minnesota_offramp",
    "he wants back the one he has already come back for");
});

test("the grudge is stamped by the night, not by the claim - every corner starts his", () => {
  const blockId = "fourth_ave_strip";
  for (const block of SPENARD_BLOCKS) {
    assert.equal(C.createRun({ seed: 1 }).world.territoryBlocks[block.id].owner, "curtis",
      `${block.id} starts his, which is why "taken from Curtis" ranks nothing`);
  }
  const state = holding(2809, { blocks: [blockId], soldiers: 0, phase: "approaching", heat: 15 });
  assert.equal(state.world.territoryBlocks[blockId].curtisTookBack, false, "a fresh claim carries no history");
  let guard = 0;
  while (state.world.territoryBlocks[blockId].owner === "player" && guard++ < 200) {
    state.run.day = guard;
    C.resolveSoldierOperationsForTest(state, { next: () => 1, pick: (xs) => xs[0] }, true);
  }
  assert.equal(state.world.territoryBlocks[blockId].owner, "curtis", "he takes an empty corner eventually");
  assert.equal(state.world.territoryBlocks[blockId].curtisTookBack, true, "and the corner remembers it");
});

test("the grudge orders the plan and the gossip queue identically", () => {
  const blocks = ["northern_lights_motels", "fourth_ave_strip", "minnesota_offramp"];
  const state = holding(2810, { blocks, phase: "approaching", retaken: ["minnesota_offramp"] });
  const planned = C.selectors.curtisNightPlan(state).map((entry) => entry.blockId);
  const sorted = [...blocks].sort((a, b) => Selectors.compareBlocksByCurtisPriority(a, b, state));
  assert.deepEqual(planned, sorted,
    "one comparator, so what he intends and what gets said out loud cannot drift");
  assert.equal(planned[0], "minnesota_offramp");
});

test("without state the comparator is exactly the v1.23 ordering", () => {
  const ids = SPENARD_BLOCKS.map((block) => block.id);
  const withoutState = [...ids].sort((a, b) => Selectors.compareBlocksByCurtisPriority(a, b));
  const noGrudges = holding(2811, { blocks: ids });
  assert.deepEqual([...ids].sort((a, b) => Selectors.compareBlocksByCurtisPriority(a, b, noGrudges)), withoutState,
    "a board with no history ranks the way it always did");
  assert.deepEqual(withoutState,
    ["northern_lights_motels", "fourth_ave_strip", "service_road_chokepoint", "minnesota_offramp", "wash_and_go_lot", "spenard_rec_lot"]);
});

// --- The bank ---------------------------------------------------------------

test("leftover pressure carries to the next night and is capped at two", () => {
  // One corner on his board at approaching: five points of budget, and a corner
  // can absorb two, so three go unspent and two of them are carried.
  const state = holding(2812, { blocks: ["northern_lights_motels"], phase: "approaching" });
  assert.equal(state.run.curtisPressureBank.points, 0, "a new run is carrying nothing");
  assert.deepEqual(C.selectors.curtisNightPlan(state).map((e) => e.weight), [2]);
  const leftover = C.selectors.curtisPressureLeftover(state);
  assert.equal(leftover.points, Territory.CURTIS_PRESSURE_BANK_CAP, "three unspent, two carried");
  assert.equal(leftover.phase, "approaching", "the carry knows what it was earned at");
  state.run.curtisPressureBank = leftover;
  assert.equal(C.selectors.curtisPressureBank(state, "approaching"), 2, "and tomorrow's budget reads it");
  // A bank over the cap is clamped on the way out, so a hand-edited or
  // hydrated-from-anywhere value can never inflate a plan.
  state.run.curtisPressureBank = { phase: "approaching", points: 99 };
  assert.equal(C.selectors.curtisPressureBank(state, "approaching"), Territory.CURTIS_PRESSURE_BANK_CAP);
});

test("the bank turns a tail corner from just looking into coming hard", () => {
  const blocks = ["northern_lights_motels", "fourth_ave_strip"];
  const state = holding(2813, { blocks, phase: "watching" });
  assert.deepEqual(C.selectors.curtisNightPlan(state).map((e) => e.weight), [2, 1], "three points, spent down the list");
  state.run.curtisPressureBank = { phase: "watching", points: 1 };
  assert.deepEqual(C.selectors.curtisNightPlan(state).map((e) => e.weight), [2, 2],
    "a fourth point makes the second corner one he is coming for");
});

test("the bank does not survive a phase change", () => {
  const state = holding(2814, { blocks: ["northern_lights_motels"], phase: "approaching" });
  state.run.curtisPressureBank = { phase: "approaching", points: 2 };
  assert.equal(C.selectors.curtisPressureBank(state, "approaching"), 2);
  assert.equal(C.selectors.curtisPressureBank(state, "watching"), 0,
    "intent accumulated at approaching is not intent at watching");
  const dropped = holding(2814, { blocks: ["northern_lights_motels"], phase: "watching" });
  dropped.run.curtisPressureBank = { phase: "approaching", points: 2 };
  assert.deepEqual(C.selectors.curtisNightPlan(dropped).map((e) => e.weight), [2],
    "and a run that went quiet gets the quieter plan, not the saved-up one");
});

test("the plan reads the bank and never writes it", () => {
  const state = holding(2815, { blocks: ["northern_lights_motels"], phase: "approaching" });
  const before = JSON.stringify(state.run.curtisPressureBank);
  const rngBefore = JSON.stringify(state.run.rngState);
  for (let i = 0; i < 5; i += 1) C.selectors.curtisNightPlan(state);
  C.selectors.curtisPressureLeftover(state);
  assert.equal(JSON.stringify(state.run.curtisPressureBank), before, "reading the plan never banks anything");
  assert.equal(JSON.stringify(state.run.rngState), rngBefore, "and never consumes a draw");
});

test("the resolver settles the bank before the warnings, so tomorrow re-derives what was warned", () => {
  const state = holding(2816, { blocks: ["northern_lights_motels"], phase: "approaching" });
  state.run.dayEndPending = true;
  let after = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  let guard = 0;
  while (after.run.daySummary && guard++ < 5) after = C.reduceGame(after, { type: "DISMISS_DAY_SUMMARY" });
  if (after.world.territoryBlocks.northern_lights_motels.owner !== "player") return;
  assert.equal(after.run.curtisPressureBank.phase, "approaching");
  assert.ok(after.run.curtisPressureBank.points > 0, "a night that could not spend its budget carries some");
  // The plan the player can re-derive now is the plan the warning described,
  // which is only true because the bank was settled before the warning was
  // raised rather than after it.
  const reloaded = C.hydrateRun(JSON.parse(C.serializeRun(after)));
  assert.deepEqual(C.selectors.curtisNightPlan(reloaded), C.selectors.curtisNightPlan(after),
    "and a reloaded save re-derives it identically");
});

// --- The gradient, measured -------------------------------------------------

test("the loss rate is strictly monotonic across the phases", () => {
  const rates = ALL_PHASES.map((curtisPhase) =>
    measure(`gradient: ${curtisPhase}`, { runs: 60, nights: 10, curtisPhase, blocks: ALL_BLOCK_IDS }).blockLossRate);
  assert.equal(rates[0], 0, "invisible is structurally zero, not merely small");
  for (let i = 1; i < rates.length; i += 1) {
    assert.ok(rates[i] > rates[i - 1],
      `${ALL_PHASES[i]} (${rates[i]}) must exceed ${ALL_PHASES[i - 1]} (${rates[i - 1]})`);
  }
});

test("invisible is zero twice over: the multiplier and the gate would both have to break", () => {
  assert.equal(Territory.CURTIS_PHASE_MULTIPLIER.invisible, 0);
  assert.equal(Territory.CURTIS_PHASE_VISIBILITY_GATE.invisible, 99);
  const state = holding(2817, { blocks: ALL_BLOCK_IDS, phase: "invisible", soldiers: 0, heat: 15 });
  for (const blockId of ALL_BLOCK_IDS) assert.equal(C.selectors.curtisMoveChance(state, blockId), 0);
  assert.deepEqual(C.selectors.curtisNightPlan(state), []);
});

test("the ambient and approaching multipliers land where the balance targets put them", () => {
  const M = Territory.CURTIS_PHASE_MULTIPLIER;
  assert.ok(Math.abs(M.ambient / M.watching - 0.5) <= 0.15, "ambient is roughly half of watching");
  assert.equal(M.approaching / M.watching, 2, "approaching is double it");
});

test("the grudge and the bank cost the loss rate nothing at watching", () => {
  // The combined-behavior ceiling from the spec is 15%. It is met with room to
  // spare and the reason is structural rather than lucky: the resolver rolls
  // every held corner independently and never consults the plan, so a change to
  // what the PLAN says can move the telegraph and cannot move an outcome. Only
  // the heat probe and the unstaffed term touch the odds, and both are in the
  // tuned base.
  const config = { runs: 80, nights: 10, curtisPhase: "watching", blocks: ALL_BLOCK_IDS };
  const plain = measure("plain", config).blockLossRate;
  const grudged = measure("grudged", config).blockLossRate;
  assert.equal(plain, grudged, "the plan is a telegraph; it is not an input to the night");
  assert.ok(Math.abs(grudged - plain) <= plain * 0.15, "and comfortably inside the 15% ceiling either way");
});

// --- What did not move ------------------------------------------------------

test("the police stay flat across every phase, which is what makes them background", () => {
  const rates = ALL_PHASES.map((curtisPhase) =>
    measure(`police: ${curtisPhase}`, { runs: 60, nights: 10, curtisPhase, blocks: ALL_BLOCK_IDS }).policeRaidsPerBlockNight);
  const min = Math.min(...rates), max = Math.max(...rates);
  assert.ok(max - min <= 0.04, `police rate spread ${min}-${max} must not track how hard Curtis is looking`);
  // And the thing that makes them a different adversary rather than a louder
  // one: they never take a corner.
  const state = holding(2818, { blocks: ["service_road_chokepoint"], phase: "invisible", heat: 15 });
  for (let day = 1; day <= 40; day += 1) {
    state.run.day = day;
    C.resolveSoldierOperationsForTest(state, { next: () => 1, pick: (xs) => xs[0] }, true);
  }
  assert.equal(state.world.territoryBlocks.service_road_chokepoint.owner, "player",
    "forty nights of raids and the corner is still the player's");
});

test("Curtis still touches no Heat, at any phase and any temperature", () => {
  const state = holding(2819, { blocks: ["northern_lights_motels"], phase: "approaching", soldiers: 0, heat: 12 });
  const before = state.player.heat;
  let guard = 0;
  while (state.world.territoryBlocks.northern_lights_motels.owner === "player" && guard++ < 200) {
    state.run.day = guard;
    C.resolveSoldierOperationsForTest(state, { next: () => 1, pick: (xs) => xs[0] }, true);
  }
  assert.equal(state.world.territoryBlocks.northern_lights_motels.owner, "curtis");
  assert.equal(state.player.heat, before, "a corner changing hands is not public disorder");
});

// --- State ------------------------------------------------------------------

test("the save schema stays v11 and an older save hydrates into an empty bank", () => {
  assert.equal(C.VERSION, 11, "a tuning pass and two additive fields do not move the schema");
  assert.equal(C.SAVE_KEY, "907ogr_v11");
  const state = holding(2820, { blocks: ["northern_lights_motels"], phase: "watching" });
  const raw = JSON.parse(C.serializeRun(state));
  delete raw.run.curtisPressureBank;
  delete raw.world.territoryBlocks.northern_lights_motels.curtisTookBack;
  const hydrated = C.hydrateRun(raw);
  assert.deepEqual(hydrated.run.curtisPressureBank, { phase: null, points: 0 }, "carrying nothing");
  assert.equal(hydrated.world.territoryBlocks.northern_lights_motels.curtisTookBack, false, "and holding no grudge");
  assert.deepEqual(C.selectors.curtisNightPlan(hydrated), C.selectors.curtisNightPlan(state),
    "so a v11 save that predates this build plays the same night it always did");
});

test("a bank hydrated from nowhere cannot inflate a plan", () => {
  const state = holding(2821, { blocks: ["northern_lights_motels", "fourth_ave_strip"], phase: "watching" });
  for (const points of [null, undefined, -5, "3", NaN]) {
    state.run.curtisPressureBank = { phase: "watching", points };
    const weights = C.selectors.curtisNightPlan(state).map((e) => e.weight);
    assert.ok(weights.every((w) => w >= 1 && w <= Territory.CURTIS_MAX_PRESSURE_PER_BLOCK),
      `points=${String(points)} produced ${JSON.stringify(weights)}`);
  }
});
