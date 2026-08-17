const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Crew = require("../src/data/crew.js");
const Selectors = require("../src/selectors.js");
const { stringHash } = require("../src/hash.js");
const { SPENARD_BLOCK_BY_ID } = require("../src/data/locations.js");
const { measure, territoryRun } = require("./measure-lieutenant-modifiers.js");

// v1.20 - Lieutenant Typed Modifiers on Soldiers.
//
// Each Made Man now owns one number on the guard layer instead of only better
// encounter rolls: Tone multiplies what a posted soldier is worth when a raid
// arrives, Pherris raises what the player can read off the block map, Deshawn
// lowers what held corners cost in ambient Heat. Nothing is stored - every
// modifier is derived from the crew record the save already carries, which is
// why the schema stays at v11.

const root = path.join(__dirname, "..");
const uiSource = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const selectorSource = fs.readFileSync(path.join(root, "src", "selectors.js"), "utf8");

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Twenty" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  return structuredClone(state);
}

function withCrew(state, crewId, fields) {
  Object.assign(state.people.crew[crewId], { introduced: true, recruited: true, status: "active", loyalty: 8, tier: 1, ...fields });
  return state;
}

function holdBlocks(state, blockIds) {
  for (const blockId of blockIds) {
    state.world.territoryBlocks[blockId].owner = "player";
    state.world.territoryBlocks[blockId].capturedDay = 1;
  }
  return state;
}

// --- Task 1: Tone, defense weight -------------------------------------------

test("Tone's defense multiplier is tiered, and 1.0 whenever he is not standing there", () => {
  const state = fresh(2001);
  assert.equal(C.selectors.toneDefenseMultiplier(state), 1, "not recruited");
  withCrew(state, "tone", { tier: 1 });
  assert.equal(C.selectors.toneDefenseMultiplier(state), 1.15);
  state.people.crew.tone.tier = 2;
  assert.equal(C.selectors.toneDefenseMultiplier(state), 1.3);
  state.people.crew.tone.tier = 3;
  assert.equal(C.selectors.toneDefenseMultiplier(state), 1.5);
  assert.ok(Crew.TONE_DEFENSE_MULTIPLIER[2] > Crew.TONE_DEFENSE_MULTIPLIER[1], "tier 2 beats tier 1");
  assert.ok(Crew.TONE_DEFENSE_MULTIPLIER[3] > Crew.TONE_DEFENSE_MULTIPLIER[2], "tier 3 beats tier 2");
});

test("Tone's defense multiplier disappears on departure, arrest, and loyalty zero", () => {
  const state = withCrew(fresh(2002), "tone", { tier: 3 });
  assert.equal(C.selectors.toneDefenseMultiplier(state), 1.5);
  state.people.crew.tone.status = "arrested";
  assert.equal(C.selectors.toneDefenseMultiplier(state), 1, "a man in a cell defends nothing");
  state.people.crew.tone.status = "departed";
  assert.equal(C.selectors.toneDefenseMultiplier(state), 1, "and neither does one who quit");
  state.people.crew.tone.status = "active";
  state.people.crew.tone.loyalty = 0;
  assert.equal(C.selectors.toneDefenseMultiplier(state), 1, "loyalty 0 is the day he stops showing up");
});

// The defense formula is a probability, so it is measured rather than asserted
// on a single roll: same seeds, same blocks, same soldiers, one thing changed.
// v1.21: measured at `watching`. Below that phase Curtis never comes, so every
// blockLossRate is structurally zero and the tier comparison would pass or fail
// on nothing at all.
test("Tone measurably raises block retention, and every tier beats the one below", () => {
  const config = { runs: 60, nights: 8, curtisPhase: "watching" };
  const baseline = measure("baseline", { ...config });
  const tier1 = measure("tone1", { ...config, tone: 1 });
  const tier2 = measure("tone2", { ...config, tone: 2 });
  const tier3 = measure("tone3", { ...config, tone: 3 });
  assert.ok(tier1.blockLossRate < baseline.blockLossRate, `tier 1 (${tier1.blockLossRate}) must beat no Tone (${baseline.blockLossRate})`);
  assert.ok(tier2.blockLossRate < tier1.blockLossRate, `tier 2 (${tier2.blockLossRate}) must beat tier 1 (${tier1.blockLossRate})`);
  assert.ok(tier3.blockLossRate < tier2.blockLossRate, `tier 3 (${tier3.blockLossRate}) must beat tier 2 (${tier2.blockLossRate})`);
  assert.ok(tier3.incomePerRun > baseline.incomePerRun, "corners held longer are corners that earn longer");
});

test("a departed Tone defends exactly like no Tone at all", () => {
  const config = { runs: 40, nights: 6, curtisPhase: "watching" };
  const baseline = measure("baseline", { ...config });
  const departed = measure("departed", { ...config, tone: 3, toneStatus: "departed" });
  assert.deepEqual(departed, { ...baseline, config: "departed" }, "every measured number is identical");
});

test("the raid pass reads defense strength from soldiers times Tone, and nothing else", () => {
  const core = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
  assert.match(core, /const defenseStrength = assigned\.length \* RAID_DEFENSE_PER_SOLDIER \* toneDefense;/);
  // v1.21 split the raid in two, and the casualty half is now shared: both
  // adversaries roll against the same garrison through takeRaidCasualty. The
  // conditional block-loss roll it replaced belonged to a police raid that
  // could take the corner, which is exactly what no longer happens.
  assert.match(core, /function takeRaidCasualty\(state, random, record, toneDefense\)/);
  assert.equal((core.match(/takeRaidCasualty\(state, random, record, toneDefense\)/g) || []).length, 3,
    "defined once, called once by each pass");
  assert.doesNotMatch(core, /RAID_BLOCK_LOSS_CHANCE/, "a police raid no longer has a block-loss roll at all");
  assert.equal(C.RAID_DEFENSE_PER_SOLDIER, 1, "one soldier is one point of defense before any modifier");
});

// --- Task 2: Pherris, block intel -------------------------------------------

test("blockIntelLevel is 0 with nothing, 1 on the old flag, and Pherris's tier with her", () => {
  const state = fresh(2003);
  assert.equal(C.selectors.blockIntelLevel(state), 0);
  assert.equal(C.selectors.blockIntelVisible(state), false);
  state.flags.spenardBlocksRevealed = true;
  assert.equal(C.selectors.blockIntelLevel(state), 1, "the scouting card still works on its own");
  assert.equal(C.selectors.blockIntelVisible(state), true);
  withCrew(state, "pherris", { tier: 1 });
  assert.equal(C.selectors.blockIntelLevel(state), 1);
  state.people.crew.pherris.tier = 2;
  assert.equal(C.selectors.blockIntelLevel(state), 2);
  state.people.crew.pherris.tier = 3;
  assert.equal(C.selectors.blockIntelLevel(state), 3);
  state.people.crew.pherris.tier = 4; // no such tier exists; the ladder still stops at 3
  assert.equal(C.selectors.blockIntelLevel(state), 3);
});

test("Pherris raises intel without the flag, and her departure drops it back to the flag", () => {
  const state = withCrew(fresh(2004), "pherris", { tier: 3 });
  assert.equal(C.selectors.blockIntelLevel(state), 3, "she is the source; the flag is not required");
  state.people.crew.pherris.status = "departed";
  assert.equal(C.selectors.blockIntelLevel(state), 0, "and without the flag there is nothing left");
  state.flags.spenardBlocksRevealed = true;
  assert.equal(C.selectors.blockIntelLevel(state), 1, "a player who scouted keeps what they scouted");
  state.people.crew.pherris.status = "arrested";
  assert.equal(C.selectors.blockIntelLevel(state), 1, "a jailed runner files no reports");
});

test("each intel level reveals exactly its own rung", () => {
  const state = fresh(2005);
  const blockId = "northern_lights_motels";
  assert.deepEqual(C.selectors.blockIntelView(state, blockId).stats, null, "level 0 shows nothing");
  assert.equal(C.selectors.blockIntelView(state, blockId).known, false);

  state.flags.spenardBlocksRevealed = true;
  const one = C.selectors.blockIntelView(state, blockId);
  assert.equal(one.known, true);
  assert.equal(one.owner, "curtis", "ownership is visible at level 1");
  assert.ok(one.stats, "and the map numbers a scout copies down");
  assert.equal(one.defense, null, "but no defense number at level 1");
  assert.equal(one.lastRaidDay, null);

  withCrew(state, "pherris", { tier: 2 });
  const two = C.selectors.blockIntelView(state, blockId);
  assert.ok(two.defense >= 1, "level 2 estimates what Curtis has on it");
  assert.equal(two.defenseExact, false);
  assert.ok(Math.abs(two.defense - Selectors.curtisBlockDefense(blockId)) <= 1, "the estimate is within one of the truth");

  state.people.crew.pherris.tier = 3;
  const three = C.selectors.blockIntelView(state, blockId);
  assert.equal(three.defense, Selectors.curtisBlockDefense(blockId), "level 3 is exact");
  assert.equal(three.defenseExact, true);
});

test("soldier counts read at level 2 on the player's own corners, never a defense estimate", () => {
  const state = holdBlocks(withCrew(fresh(2006), "pherris", { tier: 1 }), ["fourth_ave_strip"]);
  state.world.soldiers = { soldier_1: { id: "soldier_1", blockId: "fourth_ave_strip", hiredDay: 1, status: "active" } };
  state.world.territoryBlocks.fourth_ave_strip.soldiersAssigned = ["soldier_1"];
  assert.equal(C.selectors.blockIntelView(state, "fourth_ave_strip").soldiers, null, "level 1 counts nobody");
  state.people.crew.pherris.tier = 2;
  const view = C.selectors.blockIntelView(state, "fourth_ave_strip");
  assert.equal(view.soldiers, 1);
  assert.equal(view.defense, null, "a block you hold has no Curtis estimate on it");
});

test("the level-2 estimate is hashed from the seed, never rolled", () => {
  const state = withCrew(fresh(2007), "pherris", { tier: 2 });
  const blockId = "service_road_chokepoint";
  const expected = Math.max(1, Selectors.curtisBlockDefense(blockId)
    + ((stringHash(`${state.run.seed}:block-intel:${blockId}:${state.run.day}`) % 3) - 1));
  assert.equal(Selectors.curtisBlockDefenseEstimate(state, blockId), expected);
  for (let i = 0; i < 5; i += 1) assert.equal(C.selectors.blockIntelView(state, blockId).defense, expected, "reading it again never rerolls it");
  const reloaded = C.hydrateRun(JSON.parse(C.serializeRun(state)));
  assert.equal(Selectors.curtisBlockDefenseEstimate(reloaded, blockId), expected, "and a reloaded save reads the same number back");
  assert.doesNotMatch(selectorSource, /Math\.random\(/, "no probability in the selectors may come from a real random call");
});

test("level 3 names the corners Curtis is lining up, gated by how hard he is looking", () => {
  const state = holdBlocks(withCrew(fresh(2008), "pherris", { tier: 3 }), ["northern_lights_motels", "fourth_ave_strip", "spenard_rec_lot"]);
  state.curtisAwareness.level = 0;
  state.curtisAwareness.phase = "invisible";
  assert.deepEqual(C.selectors.curtisBlockTargets(state), [], "nobody is looking at anything yet");
  state.curtisAwareness.phase = "ambient";
  assert.deepEqual(C.selectors.curtisBlockTargets(state), ["northern_lights_motels"], "the most visible corner is first");
  state.curtisAwareness.phase = "watching";
  assert.deepEqual(C.selectors.curtisBlockTargets(state), ["northern_lights_motels", "fourth_ave_strip"]);
  assert.equal(C.selectors.blockIntelView(state, "northern_lights_motels").targeted, true);
  assert.equal(C.selectors.blockIntelView(state, "spenard_rec_lot").targeted, false, "the quiet lot is nobody's priority");
  state.people.crew.pherris.tier = 2;
  assert.equal(C.selectors.blockIntelView(state, "northern_lights_motels").targeted, false, "targeting is a level-3 read");
});

test("Curtis's defense on a corner is derived, not stored, and never zero", () => {
  for (const block of C.SPENARD_BLOCKS) {
    const definition = SPENARD_BLOCK_BY_ID[block.id];
    assert.equal(Selectors.curtisBlockDefense(block.id), Math.max(1, definition.curtisVisibility + definition.patrolFrequency));
    assert.ok(Selectors.curtisBlockDefense(block.id) >= 1, "he does not hold anything with nobody on it");
  }
});

// --- Task 3: Deshawn, territory heat ----------------------------------------

test("Deshawn's heat reduction is tiered and disappears with him", () => {
  const state = fresh(2009);
  assert.equal(C.selectors.deshawnHeatReduction(state), 1);
  withCrew(state, "deshawn", { tier: 1 });
  assert.equal(C.selectors.deshawnHeatReduction(state), 0.8);
  state.people.crew.deshawn.tier = 2;
  assert.equal(C.selectors.deshawnHeatReduction(state), 0.6);
  state.people.crew.deshawn.tier = 3;
  assert.equal(C.selectors.deshawnHeatReduction(state), 0.4);
  state.people.crew.deshawn.status = "arrested";
  assert.equal(C.selectors.deshawnHeatReduction(state), 1);
  state.people.crew.deshawn.status = "departed";
  assert.equal(C.selectors.deshawnHeatReduction(state), 1);
});

test("the territory heat trickle is the held blocks' exposure, cut by Deshawn's tier", () => {
  const state = holdBlocks(fresh(2010), ["fourth_ave_strip", "spenard_rec_lot"]); // exposure 2 + 1
  const base = 3 * C.TERRITORY_HEAT_CHANCE_PER_EXPOSURE;
  assert.ok(Math.abs(C.selectors.territoryHeatChance(state) - base) < 1e-9);
  withCrew(state, "deshawn", { tier: 1 });
  assert.ok(Math.abs(C.selectors.territoryHeatChance(state) - base * 0.8) < 1e-9, "tier 1 leaves 80%");
  state.people.crew.deshawn.tier = 3;
  assert.ok(Math.abs(C.selectors.territoryHeatChance(state) - base * 0.4) < 1e-9, "tier 3 leaves 40%");
  state.people.crew.deshawn.status = "departed";
  assert.ok(Math.abs(C.selectors.territoryHeatChance(state) - base) < 1e-9, "and the full trickle resumes when he goes");
});

test("a player holding nothing gets nothing from Deshawn", () => {
  const state = withCrew(fresh(2011), "deshawn", { tier: 3 });
  assert.equal(C.selectors.controlledBlockCount(state), 0);
  assert.equal(C.selectors.territoryHeatChance(state), 0, "the reduction applies to territory Heat only");
  assert.equal(C.selectors.lieutenantTerritoryModifier(state, "deshawn"), null, "and the screen does not offer it as a benefit");
  const before = state.player.heat;
  state.run.dayEndPending = true;
  const after = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.ok(after.player.heat <= before + 1, "no held corner ever adds territory Heat");
});

test("Deshawn measurably lowers peak Heat for a block-holding run, tier over tier", () => {
  const config = { runs: 60, nights: 8, curtisPhase: "watching" };
  const baseline = measure("baseline", { ...config });
  const tier1 = measure("deshawn1", { ...config, deshawn: 1 });
  const tier2 = measure("deshawn2", { ...config, deshawn: 2 });
  const tier3 = measure("deshawn3", { ...config, deshawn: 3 });
  assert.ok(tier1.averagePeakHeat < baseline.averagePeakHeat, `tier 1 (${tier1.averagePeakHeat}) must beat no Deshawn (${baseline.averagePeakHeat})`);
  assert.ok(tier2.averagePeakHeat < tier1.averagePeakHeat, `tier 2 (${tier2.averagePeakHeat}) must beat tier 1 (${tier1.averagePeakHeat})`);
  assert.ok(tier3.averagePeakHeat < tier2.averagePeakHeat, `tier 3 (${tier3.averagePeakHeat}) must beat tier 2 (${tier2.averagePeakHeat})`);
  assert.equal(tier3.blockLossRate >= baseline.blockLossRate - 0.05, true, "he is not a defense modifier; retention is Tone's job");
});

test("the nightly pass is the only place block Heat is applied", () => {
  const core = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
  const trickles = core.split("\n").filter((line) => line.includes("territoryHeatChance("));
  assert.equal(trickles.filter((line) => line.includes("random.next()")).length, 1, "exactly one trickle path");
  assert.match(core, /const territoryHeat = heldExposure > 0 && random\.next\(\) < territoryHeatChance\(state, heldExposure\);/);
});

// --- Task 4: the modifier lines ---------------------------------------------

test("each lieutenant's territory line reads their own number, and only with a corner held", () => {
  const state = fresh(2012);
  withCrew(state, "tone", { tier: 2 });
  withCrew(state, "pherris", { tier: 2 });
  withCrew(state, "deshawn", { tier: 2 });
  for (const id of ["tone", "pherris", "deshawn"]) {
    assert.equal(C.selectors.lieutenantTerritoryModifier(state, id), null, `${id} has nothing to modify without territory`);
  }
  holdBlocks(state, ["fourth_ave_strip"]);
  assert.deepEqual(
    ["tone", "pherris", "deshawn"].map((id) => {
      const line = C.selectors.lieutenantTerritoryModifier(state, id);
      return [line.label, line.value];
    }),
    [["Defense", "+30%"], ["Intel Level", "2"], ["Heat Reduction", "40%"]],
  );
  state.people.crew.tone.tier = 3;
  assert.equal(C.selectors.lieutenantTerritoryModifier(state, "tone").value, "+50%", "the line follows the tier");
  state.people.crew.tone.status = "departed";
  assert.equal(C.selectors.lieutenantTerritoryModifier(state, "tone"), null, "and vanishes with the person");
  assert.equal(C.selectors.lieutenantTerritoryModifier(state, "eli"), null, "Eli's modifier is the whole soldier system, not a line");
});

test("the crew screen renders the modifier line and the block card reads the intel level", () => {
  assert.match(uiSource, /const modifier = C\.selectors\.lieutenantTerritoryModifier\(state, person\.id\)/);
  assert.match(uiSource, /\{modifier && <p className="compact"><b>\{modifier\.label\} \{modifier\.value\}<\/b>/);
  assert.match(uiSource, /const intel = C\.selectors\.blockIntelView\(state, block\.id\)/);
  assert.match(uiSource, /intel\.defense != null &&/, "the defense line is gated on the level, not on ownership");
  assert.match(uiSource, /intel\.targeted &&/);
  // Read-only text inside existing cards: the build adds no new control, so the
  // 44px tap-target floor is untouched by construction.
  assert.doesNotMatch(uiSource, /modifier\.label[^<]*<button/);
});

// --- Save compatibility ------------------------------------------------------

test("the modifiers need no new state: a v11 save carries them, a v3 save migrates into them", () => {
  assert.equal(C.VERSION, 11, "v1.20 adds no persisted field, so the schema does not move");
  const state = holdBlocks(withCrew(withCrew(fresh(2013), "tone", { tier: 3 }), "deshawn", { tier: 2 }), ["fourth_ave_strip"]);
  const reloaded = C.hydrateRun(JSON.parse(C.serializeRun(state)));
  assert.equal(C.selectors.toneDefenseMultiplier(reloaded), 1.5);
  assert.equal(C.selectors.deshawnHeatReduction(reloaded), 0.6);
  assert.equal(C.selectors.territoryHeatChance(reloaded), C.selectors.territoryHeatChance(state));

  const raw = JSON.parse(C.serializeRun(state));
  raw.version = 3;
  delete raw.npc.pherris;
  delete raw.npc.tone;
  const migrated = C.hydrateRun(C.migrateSave(raw));
  assert.ok(migrated, "a v3 save still completes the chain");
  assert.equal(migrated.version, C.VERSION);
  assert.equal(C.selectors.toneDefenseMultiplier(migrated), 1.5, "and arrives with the modifier computed from the record it already had");
  assert.equal(C.selectors.blockIntelLevel(migrated), 0);
});

test("nothing in the modifier path requires game-core from a data module", () => {
  for (const file of ["src/data/crew.js", "src/data/locations.js", "src/hash.js", "src/selectors.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /require\(["'].*game-core/, `${file} must not require game-core`);
  }
  // src/hash.js exists so the selectors can hash without closing a cycle
  // through src/events/random.js, which requires the selectors.
  assert.doesNotMatch(fs.readFileSync(path.join(root, "src", "hash.js"), "utf8"), /require\(/, "the hash module requires nothing");
  assert.match(fs.readFileSync(path.join(root, "src", "events", "random.js"), "utf8"), /require\("\.\.\/hash\.js"\)/);
  assert.equal(require("../src/events/random.js").stringHash, stringHash, "and random.js still re-exports it for its old callers");
});

test("the ARCHITECTURE note names the triangle", () => {
  const architecture = fs.readFileSync(path.join(root, "ARCHITECTURE.md"), "utf8");
  for (const token of ["Made Men modifier triangle", "Defense strength multiplier", "Block intel visibility tiers", "heat trickle reduction"]) {
    assert.ok(architecture.includes(token), token);
  }
});

// A guard against the harness silently measuring nothing: if the fixture stops
// producing a territory-holding run, every A/B test above would pass on zeros.
test("the measurement harness really does hold corners and take raids", () => {
  const state = territoryRun(2100, {});
  assert.equal(C.selectors.controlledBlockCount(state), 3);
  assert.equal(C.selectors.activeSoldierCount(state), 6);
  const measured = measure("smoke", { runs: 20, nights: 6 });
  assert.ok(measured.raidsPerBlockNight > 0, "raids happen");
  assert.ok(measured.incomePerRun > 0, "corners pay");
});
