const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Territory = require("../src/data/territory.js");
const CurtisAwareness = require("../src/data/curtis-awareness.js");
const { stringHash } = require("../src/hash.js");
const { SPENARD_BLOCKS, SPENARD_BLOCK_BY_ID } = require("../src/data/locations.js");
const { measure, territoryRun } = require("./measure-lieutenant-modifiers.js");

// v1.21 - Police Raids and Curtis Moves, split.
//
// Until now one blended roll decided both "the police busted your corner" and
// "Curtis took your corner", which meant Heat quietly governed how much
// territory the player kept and a player Curtis had never noticed still lost
// corners to him. They are two events now, with two sets of inputs and two
// outcomes:
//
//   POLICE  Heat + patrolFrequency, discounted by Eli. Costs people and Heat.
//           Never changes who owns the corner. Staffed corners only.
//   CURTIS  curtisVisibility + awareness phase, divided by the garrison. Takes
//           the corner. Costs no Heat. Runs on empty corners too.
//
// Nothing new is persisted, so the save schema stays at v11.

const root = path.join(__dirname, "..");
const coreSource = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const territorySource = fs.readFileSync(path.join(root, "src", "data", "territory.js"), "utf8");

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "TwentyOne" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  return structuredClone(state);
}

// A state holding the named blocks, each with `soldiers` posted, at a pinned
// awareness phase. Both level and floor are set: the quiet-day bleed would
// otherwise walk the phase back down mid-test.
function holding(seed, { blocks = ["fourth_ave_strip"], soldiers = 2, phase = "watching", heat = 4, tone = 0, eli = 1 } = {}) {
  const state = fresh(seed);
  state.player.heat = heat;
  state.base.controlled = true;
  Object.assign(state.people.crew.eli, {
    introduced: true, recruited: true, status: "active", loyalty: 8, recruitedDay: 1,
    lieutenantStage: "operations_lieutenant", lieutenantEffectiveness: eli, operationPolicy: "manual",
  });
  if (tone) Object.assign(state.people.crew.tone, { introduced: true, recruited: true, status: "active", loyalty: 8, recruitedDay: 1, tier: tone });
  const level = CurtisAwareness.phaseFloor(phase);
  Object.assign(state.curtisAwareness, { level, floor: level, phase, phaseMessagesSent: ["watching", "approaching"] });
  let next = 1;
  for (const blockId of blocks) {
    const record = state.world.territoryBlocks[blockId];
    record.owner = "player";
    record.capturedDay = 1;
    record.soldiersAssigned = [];
    for (let i = 0; i < soldiers; i += 1) {
      const id = `soldier_${next}`;
      next += 1;
      state.world.soldiers[id] = { id, blockId, hiredDay: 1, status: "active" };
      record.soldiersAssigned.push(id);
    }
  }
  state.world.nextSoldierId = next;
  return state;
}

// A stub that never produces a casualty and never picks anybody, so a test can
// isolate the gate from what the gate causes.
const noCasualty = () => ({ next: () => 0.99, pick: (list) => list[0] });
// The mirror: every casualty roll lands.
const alwaysCasualty = () => ({ next: () => 0, pick: (list) => list[0] });

function gateRoll(state, blockId, kind) {
  return (stringHash(`${state.run.seed}:raid:${blockId}:${state.run.day}:${kind}`) % 10000) / 10000;
}

// The observation queue holds one row per recipient — { npcId, observation,
// deliverAtSlot } — so "who heard about it" is the set of npcIds carrying the
// named event.
function heardAbout(state, event) {
  return (state.run.pendingObservations || []).filter((row) => row.observation?.event === event);
}
function listeners(state, event) {
  return heardAbout(state, event).map((row) => row.npcId);
}

// Walks days until the named gate rolls under `chance` (or over it, for a miss).
// The roll is hashed off the day, so "make it fire" means "find the night it
// fires on" rather than "rig the RNG".
function dayWhere(state, blockId, kind, predicate) {
  for (let day = 1; day <= 400; day += 1) {
    const probe = { ...state, run: { ...state.run, day } };
    if (predicate(gateRoll(probe, blockId, kind))) return day;
  }
  throw new Error(`no day in range satisfied the ${kind} gate on ${blockId}`);
}

// --- Task 1: the constants --------------------------------------------------

test("the territory constants live in one data module at their specified values", () => {
  assert.equal(Territory.POLICE_BASE_CHANCE, 0.04);
  assert.equal(Territory.POLICE_HEAT_WEIGHT, 0.015);
  assert.equal(Territory.POLICE_PATROL_WEIGHT, 0.03);
  assert.equal(Territory.CURTIS_VISIBILITY_WEIGHT, 0.4);
  // v1.28 measured these. ambient is lifted to compensate for its own tighter
  // visibility gate (three corners on the board where watching has five) so it
  // lands at roughly half of watching, and approaching is 2.0 because "roughly
  // double watching" is what the balance target always meant and 1.5 is not it.
  assert.deepEqual(Territory.CURTIS_PHASE_MULTIPLIER, { invisible: 0, ambient: 0.6, watching: 1.0, approaching: 2.0 });
  assert.deepEqual(Territory.CURTIS_PHASE_VISIBILITY_GATE, { invisible: 99, ambient: 2, watching: 1, approaching: 0 });
  assert.equal(Territory.RAID_DEFENSE_PER_SOLDIER, 1);
  assert.equal(C.RAID_DEFENSE_PER_SOLDIER, Territory.RAID_DEFENSE_PER_SOLDIER, "game-core reads it from the data module");
  assert.equal(C.TERRITORY, Territory, "and re-exports the module itself rather than copying the numbers");
});

test("the Curtis base is the measured one, and Eli's discount is not the old one", () => {
  // v1.28 replaced the authored 0.12 with a swept 0.05. The sweep ran 0.04-0.15
  // in 0.01 steps at all four phases, twice - once on the v1.27 code and again
  // with this build's heat probe and unstaffed term live - and 0.05 is the only
  // value that lands ambient, watching and approaching on their targets at once.
  assert.equal(Territory.CURTIS_BASE_CHANCE, 0.05);
  // 0.05 was a tenth of the old roll and is a third of this one; at Heat 0 on a
  // patrol-1 corner two points of Eli would clamp the police chance to zero.
  assert.equal(Territory.POLICE_ELI_DISCOUNT, 0.015);
  const state = holding(2101, { heat: 0, blocks: ["spenard_rec_lot"], eli: 2 });
  assert.ok(C.selectors.policeRaidChance(state, "spenard_rec_lot") > 0, "Eli never makes a corner un-raidable");
});

test("the territory data module never requires game-core", () => {
  assert.doesNotMatch(territorySource, /require\(["'][^"']*game-core/, "the dependency runs data into logic, never back");
  assert.doesNotMatch(territorySource, /Math\.random\(/);
});

test("the old blended raid constants are gone from the core and its surface", () => {
  for (const name of ["RAID_BASE_CHANCE", "RAID_HEAT_WEIGHT", "RAID_PATROL_WEIGHT", "RAID_BLOCK_LOSS_CHANCE"]) {
    assert.equal(C[name], undefined, `${name} is no longer exported`);
    assert.doesNotMatch(coreSource, new RegExp(`\\b${name}\\b`), `${name} is no longer referenced`);
  }
});

// --- Task 2: the police pass ------------------------------------------------

test("the police roll reads Heat and patrol frequency, and Eli discounts it", () => {
  for (const heat of [0, 4, 10, 15]) {
    for (const blockId of ["spenard_rec_lot", "fourth_ave_strip", "service_road_chokepoint"]) {
      for (const eli of [0, 1, 2]) {
        const state = holding(2102, { blocks: [blockId], heat, eli });
        const block = SPENARD_BLOCK_BY_ID[blockId];
        const expected = Math.max(0, Math.min(0.9, Territory.POLICE_BASE_CHANCE
          + heat * Territory.POLICE_HEAT_WEIGHT
          + block.patrolFrequency * Territory.POLICE_PATROL_WEIGHT
          - eli * Territory.POLICE_ELI_DISCOUNT));
        assert.ok(Math.abs(C.selectors.policeRaidChance(state, blockId) - expected) < 1e-12,
          `${blockId} at heat ${heat}, Eli ${eli}`);
      }
    }
  }
});

test("the police roll ignores curtisVisibility entirely", () => {
  // Two corners with the same patrol frequency and different visibility.
  const quiet = SPENARD_BLOCK_BY_ID.spenard_rec_lot;   // visibility 0, patrol 1
  const seen = SPENARD_BLOCK_BY_ID.wash_and_go_lot;    // visibility 1, patrol 1
  assert.equal(quiet.patrolFrequency, seen.patrolFrequency, "the fixture only works if patrol matches");
  assert.notEqual(quiet.curtisVisibility, seen.curtisVisibility);
  const state = holding(2103, { blocks: [quiet.id, seen.id] });
  assert.equal(C.selectors.policeRaidChance(state, quiet.id), C.selectors.policeRaidChance(state, seen.id));
});

test("a police raid costs people and Heat and never changes who owns the corner", () => {
  const blockId = "service_road_chokepoint";
  let state = holding(2104, { blocks: [blockId], phase: "invisible" });   // Curtis cannot interfere
  const chance = C.selectors.policeRaidChance(state, blockId);
  const day = dayWhere(state, blockId, "police", (roll) => roll < chance);
  state.run.day = day;
  const heatBefore = state.player.heat;
  // noCasualty also holds the territory-Heat trickle off, so the +1 asserted
  // below can only have come from the raid itself.
  C.resolveSoldierOperationsForTest(state, noCasualty(), true);
  const record = state.world.territoryBlocks[blockId];
  assert.equal(record.owner, "player", "the police disrupt an operation, they do not claim real estate");
  assert.equal(record.raidCount, 1);
  assert.equal(record.lastRaidDay, day);
  assert.equal(state.player.heat, heatBefore + 1, "exactly one Heat, from the raid and nothing else");
  // Without Tone the casualty chance is assigned.length/defenseStrength = 1.0,
  // so a raid that arrives always costs somebody. That is not a stub artifact:
  // turning a raid away is the thing Tone is for, and nothing else does it.
  assert.equal(record.soldiersAssigned.length, 1, "one of the two posted took the loss");

  // With Tone at tier 3 the same night on the same seed is survivable.
  const guarded = holding(2104, { blocks: [blockId], phase: "invisible", tone: 3 });
  guarded.run.day = day;
  C.resolveSoldierOperationsForTest(guarded, noCasualty(), true);
  const guardedRecord = guarded.world.territoryBlocks[blockId];
  assert.equal(guardedRecord.raidCount, 1, "the raid still arrived — Tone does not stop the police coming");
  assert.equal(guardedRecord.soldiersAssigned.length, 2, "but everybody walked away from it");
  assert.equal(guardedRecord.owner, "player");
});

test("an empty corner the player holds is never raided by the police", () => {
  const blockId = "service_road_chokepoint";
  const state = holding(2105, { blocks: [blockId], soldiers: 0, phase: "invisible" });
  assert.equal(C.selectors.policeRaidChance(state, blockId), 0, "there is nobody to arrest on an empty lot");
  for (let day = 1; day <= 60; day += 1) {
    state.run.day = day;
    C.resolveSoldierOperationsForTest(state, alwaysCasualty(), true);
  }
  assert.equal(state.world.territoryBlocks[blockId].raidCount, 0);
});

test("a police raid is public in the neighborhood and is not news Curtis trades in", () => {
  const blockId = "service_road_chokepoint";
  const state = holding(2106, { blocks: [blockId], phase: "invisible" });
  state.run.slot = 3;   // the pass runs at Night, which is when the block is out
  const chance = C.selectors.policeRaidChance(state, blockId);
  state.run.day = dayWhere(state, blockId, "police", (roll) => roll < chance);
  const awarenessBefore = state.curtisAwareness.level;
  C.resolveSoldierOperationsForTest(state, noCasualty(), true);
  const rows = heardAbout(state, "police_raid");
  assert.ok(rows.length > 0, "the bust is queued onto the neighborhood channel");
  assert.equal(rows[0].observation.type, "heat_exposure");
  assert.equal(rows[0].observation.source, "neighborhood");
  assert.ok(!listeners(state, "police_raid").includes("curtis"),
    "he is not on the neighborhood channel, and heat_exposure would not clear his filter anyway");
  assert.ok(listeners(state, "police_raid").includes("mina"), "but the block hears it");
  assert.equal(state.curtisAwareness.level, awarenessBefore, "and a bust does not make him look harder");
});

// --- Task 3: the Curtis pass ------------------------------------------------

test("the Curtis roll reads visibility and phase, gated per phase, and nothing else", () => {
  for (const phase of ["invisible", "ambient", "watching", "approaching"]) {
    const gate = Territory.CURTIS_PHASE_VISIBILITY_GATE[phase];
    for (const block of SPENARD_BLOCKS) {
      const state = holding(2107, { blocks: [block.id], phase });
      const expected = block.curtisVisibility >= gate
        ? Math.min(0.9, Territory.CURTIS_BASE_CHANCE
            * (block.curtisVisibility * Territory.CURTIS_VISIBILITY_WEIGHT)
            * Territory.CURTIS_PHASE_MULTIPLIER[phase] / 2)   // two posted soldiers
        : 0;
      assert.ok(Math.abs(C.selectors.curtisMoveChance(state, block.id) - expected) < 1e-12,
        `${block.id} (visibility ${block.curtisVisibility}) at ${phase}`);
    }
  }
});

test("patrol frequency and Eli never move the Curtis roll, and Heat only above the probe floor", () => {
  const blockId = "northern_lights_motels";
  const base = C.selectors.curtisMoveChance(holding(2108, { blocks: [blockId], heat: 0 }), blockId);
  // v1.28 gave him a Heat read, and this is the half of the old assertion that
  // survives it: below the floor he is exactly where he was, so a player who
  // keeps Heat down never meets the probe. Above it he gets luckier, which the
  // v1.28 suite pins to the multiplier.
  for (const heat of [4, 8]) {
    assert.equal(C.selectors.curtisMoveChance(holding(2108, { blocks: [blockId], heat }), blockId), base,
      "at or below the probe floor he does not read the player's Heat");
  }
  for (const heat of [10, 15]) {
    assert.ok(C.selectors.curtisMoveChance(holding(2108, { blocks: [blockId], heat }), blockId) > base,
      "above it he does, because a hot player's corners are the understaffed ones");
  }
  for (const eli of [0, 2]) {
    assert.equal(C.selectors.curtisMoveChance(holding(2108, { blocks: [blockId], eli }), blockId), base,
      "and Eli's operations management does not fight him");
  }
  // Two corners with the same visibility and different patrol frequency.
  const a = SPENARD_BLOCK_BY_ID.fourth_ave_strip;         // visibility 2, patrol 2
  const b = SPENARD_BLOCK_BY_ID.service_road_chokepoint;  // visibility 2, patrol 3
  assert.equal(a.curtisVisibility, b.curtisVisibility);
  assert.notEqual(a.patrolFrequency, b.patrolFrequency);
  const state = holding(2108, { blocks: [a.id, b.id] });
  assert.equal(C.selectors.curtisMoveChance(state, a.id), C.selectors.curtisMoveChance(state, b.id),
    "he does not read police patrol routes");
});

test("the quiet lot is invisible to him at every phase, approaching included", () => {
  for (const phase of ["invisible", "ambient", "watching", "approaching"]) {
    const state = holding(2109, { blocks: ["spenard_rec_lot"], phase });
    assert.equal(C.selectors.curtisMoveChance(state, "spenard_rec_lot"), 0,
      `visibility 0 multiplies out to nothing at ${phase}`);
  }
  // And it survives contact with the real pass, over a run's worth of nights.
  const state = holding(2109, { blocks: ["spenard_rec_lot"], phase: "approaching" });
  for (let day = 1; day <= 80; day += 1) {
    state.run.day = day;
    C.resolveSoldierOperationsForTest(state, noCasualty(), true);
  }
  assert.equal(state.world.territoryBlocks.spenard_rec_lot.owner, "player");
});

test("below ambient Curtis never moves on anything at all", () => {
  const state = holding(2110, { blocks: SPENARD_BLOCKS.map((b) => b.id), phase: "invisible" });
  for (let day = 1; day <= 80; day += 1) {
    state.run.day = day;
    C.resolveSoldierOperationsForTest(state, noCasualty(), true);
  }
  for (const block of SPENARD_BLOCKS) {
    assert.equal(state.world.territoryBlocks[block.id].owner, "player", `${block.id} is still held`);
  }
});

test("at ambient only the loud corners are on his map; at watching the quiet ones join", () => {
  const ambient = holding(2111, { blocks: SPENARD_BLOCKS.map((b) => b.id), phase: "ambient" });
  const watching = holding(2111, { blocks: SPENARD_BLOCKS.map((b) => b.id), phase: "watching" });
  for (const block of SPENARD_BLOCKS) {
    const onMapAtAmbient = C.selectors.curtisMoveChance(ambient, block.id) > 0;
    const onMapAtWatching = C.selectors.curtisMoveChance(watching, block.id) > 0;
    assert.equal(onMapAtAmbient, block.curtisVisibility >= 2, `${block.id} at ambient`);
    assert.equal(onMapAtWatching, block.curtisVisibility >= 1, `${block.id} at watching`);
  }
});

test("a Curtis move takes the corner, costs no Heat, and tells his network", () => {
  const blockId = "northern_lights_motels";
  const state = holding(2112, { blocks: [blockId], phase: "approaching" });
  const chance = C.selectors.curtisMoveChance(state, blockId);
  state.run.day = dayWhere(state, blockId, "curtis", (roll) => roll < chance);
  const heatBefore = state.player.heat;
  const awarenessBefore = state.curtisAwareness.level;
  // noCasualty also keeps the territory-Heat trickle from firing, so any Heat
  // movement at all would have to have come from the Curtis pass.
  C.resolveSoldierOperationsForTest(state, noCasualty(), true);
  const record = state.world.territoryBlocks[blockId];
  assert.equal(record.owner, "curtis");
  assert.deepEqual(record.soldiersAssigned, [], "nobody is left posted on a corner that is not ours");
  assert.equal(state.player.heat, heatBefore, "he is not the police; losing to him is not public disorder");
  assert.equal(record.raidCount, 0, "and it is not a raid, so the raid counter does not move");
  for (const soldier of Object.values(state.world.soldiers)) {
    assert.equal(soldier.blockId, null, "survivors walk back to the garage unposted");
  }
  const rows = heardAbout(state, "block_lost_to_curtis");
  assert.ok(rows.length > 0, "the network carries it");
  assert.equal(rows[0].observation.type, "defiance");
  assert.equal(rows[0].observation.source, "network");
  assert.ok(listeners(state, "block_lost_to_curtis").includes("curtis"), "defiance clears his filter");
  assert.equal(state.curtisAwareness.level, awarenessBefore + 1, "and carrying it makes him look harder");
});

test("he walks onto an empty corner, and the first body posted on it is the one that matters most", () => {
  const blockId = "northern_lights_motels";
  const empty = holding(2113, { blocks: [blockId], soldiers: 0, phase: "watching" });
  const one = holding(2113, { blocks: [blockId], soldiers: 1, phase: "watching" });
  const defended = holding(2113, { blocks: [blockId], soldiers: 2, phase: "watching" });
  assert.ok(C.selectors.curtisMoveChance(empty, blockId) > 0, "an empty corner is still a corner he can take");
  assert.equal(C.selectors.curtisMoveChance(one, blockId), C.selectors.curtisMoveChance(defended, blockId) * 2,
    "a second posted soldier halves it, which is v1.20's promise kept");
  // v1.28. Until this build the divisor floored at 1, so an EMPTY corner and a
  // one-soldier corner were arithmetically identical and posting your first
  // person on a corner bought nothing at all. Nobody standing on it is now half
  // a defender, so the first body is worth as much as the second.
  assert.equal(C.selectors.curtisMoveChance(empty, blockId), C.selectors.curtisMoveChance(one, blockId) * 2,
    "and the first one halves it too, which is what makes an undefended corner the cheap one");
  const chance = C.selectors.curtisMoveChance(empty, blockId);
  empty.run.day = dayWhere(empty, blockId, "curtis", (roll) => roll < chance);
  C.resolveSoldierOperationsForTest(empty, noCasualty(), true);
  assert.equal(empty.world.territoryBlocks[blockId].owner, "curtis");
  assert.ok(empty.log.some((entry) => entry.text.includes("Nobody was posted on it")),
    "and the copy says so rather than counting survivors that never existed");
});

// --- Task 4: the modifiers map to the two passes ----------------------------

test("Tone divides both passes, and Eli only the police one", () => {
  const blockId = "northern_lights_motels";
  const police = [], curtis = [];
  for (const tone of [0, 1, 2, 3]) {
    const state = holding(2114, { blocks: [blockId], tone });
    police.push(C.selectors.policeRaidChance(state, blockId));
    curtis.push(C.selectors.curtisMoveChance(state, blockId));
  }
  // Tone is not in the police CHANCE - he is in what the raid costs when it
  // lands, through the shared casualty roll. His number on the Curtis side is
  // a divisor on whether it happens at all.
  assert.equal(new Set(police).size, 1, "Tone does not stop the police from showing up");
  for (let i = 1; i < curtis.length; i += 1) {
    assert.ok(curtis[i] < curtis[i - 1], `Tone tier ${i} must beat tier ${i - 1} against Curtis`);
  }
  const tiers = [1, 1.15, 1.30, 1.50];
  for (let i = 0; i < curtis.length; i += 1) {
    assert.ok(Math.abs(curtis[i] - curtis[0] / tiers[i]) < 1e-12, `tier ${i} divides by ${tiers[i]}`);
  }
  // Eli is the mirror: he is in the police chance and nowhere near Curtis.
  const eliLow = holding(2114, { blocks: [blockId], eli: 0 });
  const eliHigh = holding(2114, { blocks: [blockId], eli: 2 });
  assert.ok(C.selectors.policeRaidChance(eliHigh, blockId) < C.selectors.policeRaidChance(eliLow, blockId));
  assert.equal(C.selectors.curtisMoveChance(eliHigh, blockId), C.selectors.curtisMoveChance(eliLow, blockId));
});

test("Tone's casualty saving still applies to whoever showed up", () => {
  // Both passes route through takeRaidCasualty, so the garrison meets the
  // police and Curtis the same way once either is standing on the corner.
  const shared = coreSource.match(/takeRaidCasualty\(state, random, record, toneDefense\)/g) || [];
  assert.equal(shared.length, 3, "one definition, one call from each pass");
  assert.match(coreSource, /const casualtyChance = clamp\(assigned\.length \/ defenseStrength, 0, 1\);/);
});

// --- Task 5: determinism and independence -----------------------------------

test("both gates are hashed off the seed, with different salts", () => {
  assert.match(coreSource, /\$\{state\.run\.seed\}:raid:\$\{blockId\}:\$\{state\.run\.day\}:\$\{kind\}/);
  const state = holding(2115, { blocks: ["fourth_ave_strip"] });
  for (const block of SPENARD_BLOCKS) {
    for (let day = 1; day <= 7; day += 1) {
      const probe = { ...state, run: { ...state.run, day } };
      assert.notEqual(C.blockGateRollForTest(probe, block.id, "police"), C.blockGateRollForTest(probe, block.id, "curtis"),
        `${block.id} day ${day}: the two passes must never share an answer`);
    }
  }
});

test("the same night replays the same way, and a reloaded save does not reroll it", () => {
  const blockId = "northern_lights_motels";
  const first = holding(2116, { blocks: [blockId], phase: "approaching" });
  first.run.day = dayWhere(first, blockId, "curtis", (roll) => roll < C.selectors.curtisMoveChance(first, blockId));
  const second = C.hydrateRun(JSON.parse(C.serializeRun(first)));
  C.resolveSoldierOperationsForTest(first, noCasualty(), true);
  C.resolveSoldierOperationsForTest(second, noCasualty(), true);
  assert.equal(first.world.territoryBlocks[blockId].owner, second.world.territoryBlocks[blockId].owner);
  assert.equal(first.player.heat, second.player.heat);
});

test("the gates draw nothing from the tick's RNG, so neither pass shifts the other", () => {
  const blockId = "northern_lights_motels";
  const counts = [];
  for (const phase of ["invisible", "approaching"]) {
    const state = holding(2117, { blocks: [blockId], phase, soldiers: 0 });
    let draws = 0;
    const counting = { next: () => { draws += 1; return 0.99; }, pick: (list) => list[0] };
    state.run.day = dayWhere(state, blockId, "curtis", (roll) => roll < 0.2);
    C.resolveSoldierOperationsForTest(state, counting, true);
    counts.push(draws);
  }
  assert.equal(counts[0], counts[1],
    "an unstaffed corner draws the same whether Curtis came for it or not: the gate is hashed, not drawn");
});

test("both adversaries can hit the same corner the same night", () => {
  const blockId = "service_road_chokepoint";
  const probe = holding(2118, { blocks: [blockId], phase: "approaching", heat: 10 });
  const policeChance = C.selectors.policeRaidChance(probe, blockId);
  const curtisChance = C.selectors.curtisMoveChance(probe, blockId);
  // A night where both gates clear. The independent salts are what make it
  // reachable at all — one roll could never land on both sides of itself.
  let both = null;
  for (let d = 1; d <= 400 && both == null; d += 1) {
    const at = { ...probe, run: { ...probe.run, day: d } };
    if (gateRoll(at, blockId, "police") < policeChance && gateRoll(at, blockId, "curtis") < curtisChance) both = d;
  }
  assert.ok(both != null, `a catastrophic night must be reachable (police ${policeChance}, curtis ${curtisChance})`);
  const state = holding(2118, { blocks: [blockId], phase: "approaching", heat: 10 });
  state.run.day = both;
  const heatBefore = state.player.heat;
  C.resolveSoldierOperationsForTest(state, noCasualty(), true);
  const record = state.world.territoryBlocks[blockId];
  assert.equal(record.raidCount, 1, "the police came");
  assert.equal(record.owner, "curtis", "and so did he");
  assert.equal(state.player.heat, heatBefore + 1, "one Heat from the raid, none from him");
});

test("the police can take the last soldier and Curtis can still walk onto the empty corner", () => {
  const blockId = "service_road_chokepoint";
  const probe = holding(2119, { blocks: [blockId], soldiers: 1, phase: "approaching", heat: 15 });
  const policeChance = C.selectors.policeRaidChance(probe, blockId);
  // The Curtis chance is read AFTER the police pass has emptied the corner, so
  // the night to look for is the one that clears the undefended number.
  const emptied = holding(2119, { blocks: [blockId], soldiers: 0, phase: "approaching", heat: 15 });
  const curtisChance = C.selectors.curtisMoveChance(emptied, blockId);
  let both = null;
  for (let d = 1; d <= 400 && both == null; d += 1) {
    const at = { ...probe, run: { ...probe.run, day: d } };
    if (gateRoll(at, blockId, "police") < policeChance && gateRoll(at, blockId, "curtis") < curtisChance) both = d;
  }
  assert.ok(both != null, "swept and then taken must be reachable");
  const state = holding(2119, { blocks: [blockId], soldiers: 1, phase: "approaching", heat: 15 });
  state.run.day = both;
  C.resolveSoldierOperationsForTest(state, alwaysCasualty(), true);
  assert.equal(state.world.territoryBlocks[blockId].owner, "curtis");
  assert.equal(Object.values(state.world.soldiers).filter((s) => s.status === "active").length, 0);
});

// --- Task 6: the outcomes the player reads ----------------------------------

test("each adversary gets its own phone message, and the report names the loss", () => {
  const blockId = "northern_lights_motels";
  const state = holding(2120, { blocks: [blockId], phase: "approaching" });
  state.run.day = dayWhere(state, blockId, "curtis", (roll) => roll < C.selectors.curtisMoveChance(state, blockId));
  C.resolveSoldierOperationsForTest(state, noCasualty(), true);
  const texts = state.phone.inbox.map((item) => item.text);
  assert.ok(texts.some((t) => t.includes("Curtis's people are standing on")), "the Curtis text");
  assert.ok(!texts.some((t) => t.includes("Police came through")), "and not the police one");
  const report = state.log.find((entry) => entry.text.startsWith("Eli's report:"));
  assert.ok(report, "the summary still exists and still carries its prefix");
  assert.match(report.text, /lost to Curtis/);
  assert.equal(report.tone, "warn", "severity travels in the text, never as a bad tone");
  assert.ok((state.run.consequenceQueue || []).some((c) => c.text.startsWith("Curtis has ")));
});

test("a police night says police, and says the corner is still ours", () => {
  const blockId = "service_road_chokepoint";
  const state = holding(2121, { blocks: [blockId], phase: "invisible" });
  state.run.day = dayWhere(state, blockId, "police", (roll) => roll < C.selectors.policeRaidChance(state, blockId));
  C.resolveSoldierOperationsForTest(state, noCasualty(), true);
  const texts = state.phone.inbox.map((item) => item.text);
  assert.ok(texts.some((t) => t.includes("Police came through") && t.includes("Corner's still ours")));
  assert.ok(!texts.some((t) => t.includes("Curtis's people")));
  const report = state.log.find((entry) => entry.text.startsWith("Eli's report:"));
  assert.match(report.text, /took a police raid|turned away at the corner/);
  assert.doesNotMatch(report.text, /lost to Curtis/);
});

test("a six-corner disaster stays one report, two texts, and one card", () => {
  const state = holding(2122, { blocks: SPENARD_BLOCKS.map((b) => b.id), phase: "approaching", heat: 15 });
  // Whatever the night does, the volume rule holds: block losses get their own
  // feed line, and everything else is summarized.
  let worst = { texts: 0, cards: 0, reports: 0 };
  for (let day = 1; day <= 40; day += 1) {
    const nightly = holding(2122, { blocks: SPENARD_BLOCKS.map((b) => b.id), phase: "approaching", heat: 15 });
    nightly.run.day = day;
    C.resolveSoldierOperationsForTest(nightly, alwaysCasualty(), true);
    const reports = nightly.log.filter((entry) => entry.text.startsWith("Eli's report:")).length;
    worst = {
      texts: Math.max(worst.texts, nightly.phone.inbox.length),
      cards: Math.max(worst.cards, (nightly.run.consequenceQueue || []).length),
      reports: Math.max(worst.reports, reports),
    };
    assert.equal(reports, 1, `day ${day} logged ${reports} reports`);
  }
  assert.ok(worst.texts <= 2, `at most one text per adversary, saw ${worst.texts}`);
  assert.ok(worst.cards <= 1, `at most one consequence card, saw ${worst.cards}`);
  assert.equal(state.run.status, "playing");
});

test("the report card reads its own severity instead of whatever logged last", () => {
  assert.match(uiSource, /const severe = \/lost to Curtis\/\.test\(report\.text\);/);
  assert.doesNotMatch(uiSource, /const severe = .*state\.log\[0\]/, "the old check never matched anything");
});

// --- Task 7: the harness reports the split ----------------------------------

test("the harness pins the awareness phase for the whole measurement", () => {
  let state = territoryRun(2123, { curtisPhase: "watching" });
  assert.equal(state.curtisAwareness.level, CurtisAwareness.phaseFloor("watching"));
  assert.equal(state.curtisAwareness.floor, CurtisAwareness.phaseFloor("watching"),
    "the floor is what stops the quiet-day bleed from walking it back down");
  for (let night = 0; night < 10 && state.run.status === "playing"; night += 1) {
    state.run.dayEndPending = true;
    state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
    let guard = 0;
    while (guard++ < 30) {
      if (state.run.openingPending) { state = C.reduceGame(state, { type: "DISMISS_OPENING" }); continue; }
      if (state.run.daySummary) { state = C.reduceGame(state, { type: "DISMISS_DAY_SUMMARY" }); continue; }
      if (state.run.pendingOperationResult) { state = C.reduceGame(state, { type: "ACKNOWLEDGE_OPERATION_RESULT" }); continue; }
      if (state.run.pendingEncounter) { state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: C.selectors.encounterChoices(state)[0].id }); continue; }
      if (state.run.pendingEvent) { state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 }); continue; }
      break;
    }
    state.player.cash = 50000;
  }
  assert.ok(state.curtisAwareness.level >= CurtisAwareness.phaseFloor("watching"),
    "he never forgets his way back below the phase he reached");
});

test("the harness reports the two adversaries separately, and they separate cleanly", () => {
  const quiet = measure("invisible", { runs: 40, nights: 8, curtisPhase: "invisible" });
  const watched = measure("watching", { runs: 40, nights: 8, curtisPhase: "watching" });
  assert.ok(quiet.policeRaidsPerBlockNight > 0, "the police come regardless of what Curtis knows");
  assert.equal(quiet.curtisFlipsPerBlockNight, 0, "and he does not, below ambient");
  assert.ok(watched.curtisFlipsPerBlockNight > 0, "at watching he does");
  assert.equal(watched.raidsPerBlockNight, watched.policeRaidsPerBlockNight,
    "the old metric name still means police raids, because every raid is one now");
});

test("the per-block sweep carries the finding: quiet lot safe, chokepoint raided, and the police feed him", () => {
  const blocks = SPENARD_BLOCKS.map((b) => b.id);
  const watched = measure("watching", { runs: 60, nights: 8, curtisPhase: "watching", blocks });
  const byBlock = watched.byBlock;
  assert.equal(byBlock.spenard_rec_lot.curtisFlipsPerBlockNight, 0, "visibility 0 is never his");
  const mostRaided = Object.entries(byBlock).sort((a, b) => b[1].policeRaidsPerBlockNight - a[1].policeRaidsPerBlockNight)[0][0];
  assert.equal(mostRaided, "service_road_chokepoint", "patrol 3 is theirs");

  // v1.28, and this is a REVERSAL of what v1.21 asserted here. v1.21 checked the
  // split by proxy - the most-hunted corner and the most-raided corner had to be
  // different ones - and that proxy no longer holds, by a margin of 0.001 in the
  // old constants and a real one now. Making an empty corner cheap for him
  // (CURTIS_UNSTAFFED_DEFENSE) couples the two adversaries through the garrison:
  // the police empty the chokepoint, and an emptied corner is the one he walks
  // onto. He still does not read patrol routes - the coupling runs through who
  // is standing there, not through anything he knows.
  //
  // So the split is asserted where it is actually a split, which is what it
  // always meant: the police never take a corner, and he never touches Heat.
  // Those two are pinned in their own tests above and cannot drift.
  const mostHunted = Object.entries(byBlock).sort((a, b) => b[1].curtisFlipsPerBlockNight - a[1].curtisFlipsPerBlockNight)[0][0];
  assert.equal(mostHunted, "service_road_chokepoint", "the corner the police keep emptying is the one he keeps taking");
  assert.ok(byBlock.northern_lights_motels.curtisFlipsPerBlockNight > byBlock.minnesota_offramp.curtisFlipsPerBlockNight,
    "visibility still orders him: the motels outrank the off-ramp with the same police pressure on neither");
});

test("losing corners is what moves him, and the escalation is bounded by the map", () => {
  const blocks = SPENARD_BLOCKS.map((b) => b.id);
  const state = holding(2124, { blocks, soldiers: 0, phase: "approaching" });
  const before = state.curtisAwareness.level;
  for (let day = 1; day <= 60; day += 1) {
    state.run.day = day;
    C.resolveSoldierOperationsForTest(state, noCasualty(), true);
  }
  const lost = blocks.filter((id) => state.world.territoryBlocks[id].owner === "curtis").length;
  assert.ok(lost > 0, "an undefended map does get taken");
  assert.equal(state.curtisAwareness.level - before, Math.min(lost, CurtisAwareness.AWARENESS_MAX - before),
    "one level per corner lost, and nothing else — the map is six corners, so the spiral cannot run away");
  assert.ok(state.curtisAwareness.level <= CurtisAwareness.AWARENESS_MAX);
});

// --- Task 8: nothing new is stored ------------------------------------------

test("the split needs no new state: a v11 save carries it, a v3 save migrates into it", () => {
  assert.equal(C.VERSION, 11, "the split is a change to nightly resolution, not to state shape");
  assert.equal(C.SAVE_KEY, "907ogr_v11");
  const state = holding(2125, { blocks: ["fourth_ave_strip"], phase: "watching" });
  const record = state.world.territoryBlocks.fourth_ave_strip;
  // v1.28 added `curtisTookBack` and v1.30 added `lastCasualtyDay`. Both are
  // additive scalars that default to a falsy value, so mergeDefaults hydrates
  // every older save and the schema still does not move. The list is asserted
  // whole rather than by membership so a future build cannot slip a field in
  // unnoticed - which is exactly how v1.30's field was caught here.
  assert.deepEqual(Object.keys(record).sort(),
    ["capturedDay", "curtisTookBack", "incomeCollected", "lastCasualtyDay", "lastRaidDay", "managerId", "owner", "raidCount", "soldiersAssigned"],
    "the block record gained two additive scalars and nothing else");
  const reloaded = C.hydrateRun(JSON.parse(C.serializeRun(state)));
  assert.equal(reloaded.version, C.VERSION);
  C.resolveSoldierOperationsForTest(reloaded, noCasualty(), true);
  const raw = JSON.parse(C.serializeRun(state));
  raw.version = 3;
  delete raw.curtisAwareness;
  const migrated = C.hydrateRun(C.migrateSave(raw));
  assert.equal(migrated.version, C.VERSION);
  assert.ok(migrated.curtisAwareness, "a v3 save arrives with an awareness record the Curtis pass can read");
  C.resolveSoldierOperationsForTest(migrated, noCasualty(), true);
  assert.equal(migrated.run.status, "playing", "and the night resolves without throwing");
});

test("nothing in the nightly pass reaches for a real random number", () => {
  assert.doesNotMatch(territorySource, /Math\.random/);
  const pass = coreSource.slice(coreSource.indexOf("function blockGateRoll"), coreSource.indexOf("function territoryHeatChance"));
  assert.doesNotMatch(pass, /Math\.random/);
  assert.match(pass, /stringHash\(/, "the gates are hashed off the seed");
});

test("ARCHITECTURE documents the split and the phase gate", () => {
  const architecture = fs.readFileSync(path.join(root, "ARCHITECTURE.md"), "utf8");
  for (const token of ["POLICE_BASE_CHANCE", "CURTIS_PHASE_VISIBILITY_GATE", "curtisVisibility", "src/data/territory.js"]) {
    assert.ok(architecture.includes(token), `ARCHITECTURE.md must name ${token}`);
  }
  // Pinned to the package version rather than to v1.21 literally: the header has
  // to keep up with the build, and hard-coding one release here means every later
  // build trips a v1.21 test for a reason that has nothing to do with the split.
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const [major, minor] = pkg.version.split(".");
  assert.match(architecture, new RegExp(`current as of\\s+\\**v${major}\\.${minor}\\**`, "i"));
});
