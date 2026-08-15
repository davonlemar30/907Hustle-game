const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../game-core.js");
const Exposure = require("../src/exposure/engine.js");
const { createObservation, addObservation, effectiveCount } = require("../src/data/observations.js");
const { resolveLens, ARCHETYPES } = require("../src/data/npc-lenses.js");
const { bandFor } = require("../src/data/disposition-bands.js");
const { clearsCurtisFilter, heatChannel } = require("../src/data/propagation.js");
const { putInBand } = require("./exposure-helpers.js");

function fresh(seed = 1900) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "North" });
  state.run.openingPending = false;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  return state;
}
function row(state, npcId, spec) { return Exposure.recordObservation(state, npcId, spec); }

// ---------------------------------------------------------------- schema

test("an observation merges by category, context, and how it was heard", () => {
  const ledger = [];
  addObservation(ledger, createObservation({ type: "presence", event: "night_owl", day: 1 }));
  addObservation(ledger, createObservation({ type: "presence", event: "night_owl", day: 3 }));
  assert.equal(ledger.length, 1, "the same thing seen twice is one row with a count");
  assert.equal(ledger[0].count, 2);
  assert.equal(ledger[0].day, 3, "the row carries the most recent sighting");

  addObservation(ledger, createObservation({ type: "presence", event: "home_at_night" }));
  assert.equal(ledger.length, 2, "different context is a different row");
  addObservation(ledger, createObservation({ type: "presence", event: "night_owl", source: "network" }));
  assert.equal(ledger.length, 3, "hearing about it is a different fact than seeing it");
});

test("an unknown category is refused rather than silently stored", () => {
  assert.equal(createObservation({ type: "vibes" }), null);
  assert.equal(createObservation({}), null);
});

// ------------------------------------------------------- diminishing returns

test("repeated observations flatten out on a log2 curve", () => {
  const counts = [1, 2, 3, 8, 20].map((count) => effectiveCount({ type: "presence", count }));
  for (let i = 1; i < counts.length; i += 1) assert.ok(counts[i] > counts[i - 1], "more is still more");
  assert.equal(Math.round(counts[0] * 100) / 100, 1, "the first sighting is worth one");
  assert.equal(Math.round(counts[2] * 100) / 100, 2, "the third is worth two");
  // The whole point: two more repetitions early are worth far more than two
  // more once the behavior is ambient.
  const early = effectiveCount({ type: "presence", count: 3 }) - effectiveCount({ type: "presence", count: 1 });
  const late = effectiveCount({ type: "presence", count: 20 }) - effectiveCount({ type: "presence", count: 18 });
  assert.ok(late < early / 5, "by twenty repetitions the behavior barely moves the number");
  // And the curve has a ceiling, because log2 alone never stops climbing.
  assert.equal(effectiveCount({ type: "presence", count: 400 }), effectiveCount({ type: "presence", count: 4000 }));
});

test("betrayal never fades and a missed obligation gets worse", () => {
  assert.equal(effectiveCount({ type: "betrayal", count: 4 }), 4, "betrayal lands at full weight every time");
  assert.equal(effectiveCount({ type: "financial", event: "missed_obligation", count: 4 }), 4);
  assert.ok(effectiveCount({ type: "presence", count: 4 }) < 4, "everything else diminishes");

  // A missed obligation is priced negatively regardless of its category, so
  // escalation makes it hurt more rather than reading as more money moving.
  const state = fresh(1901);
  const before = C.selectors.disposition(state, "yalonda");
  row(state, "yalonda", { type: "financial", event: "missed_obligation", count: 3, source: "household" });
  assert.ok(C.selectors.disposition(state, "yalonda") < before, "three missed weeks must cost her");
});

test("grinding one behavior cannot reach the top band", () => {
  const state = fresh(1902);
  row(state, "mina", { type: "presence", event: "night_owl", count: 400, source: "witnessed" });
  assert.ok(C.selectors.dispositionBand(state, "mina") < C.BANDS.BONDED, "showing up 400 times is not a relationship");
  assert.ok(C.selectors.dispositionBand(state, "mina") >= C.BANDS.WARM, "though it is not nothing either");
  // Adding a second, different kind of evidence is what moves her further.
  row(state, "mina", { type: "honesty", event: "told_truth", source: "witnessed" });
  row(state, "mina", { type: "discretion", event: "kept_quiet", count: 3, source: "witnessed" });
  assert.ok(C.selectors.dispositionBand(state, "mina") >= C.BANDS.BONDED, "a rounder record can");
});

// -------------------------------------------------------------- lenses

test("the same ledger read through different lenses produces different dispositions", () => {
  const state = fresh(1903);
  const evidence = { type: "violence", event: "robbery", count: 1, source: "witnessed" };
  for (const id of C.EXPOSURE_NPC_IDS) row(state, id, evidence);
  const scores = C.EXPOSURE_NPC_IDS.map((id) => C.selectors.disposition(state, id));
  assert.ok(new Set(scores).size > 1, "one act cannot mean the same thing to everyone");
  // Mina's override makes her the harshest reader of violence in the cast.
  const mina = C.selectors.disposition(state, "mina");
  assert.ok(scores.every((score) => score >= mina), "violence costs Mina more than anyone");
});

test("every NPC has a lens and every lens covers all eleven categories", () => {
  for (const id of C.EXPOSURE_NPC_IDS) {
    const lens = resolveLens(id);
    assert.ok(lens, `${id} has no lens`);
    assert.ok(ARCHETYPES[lens.archetype], `${id} names an archetype that does not exist`);
    for (const category of require("../src/data/observations.js").OBSERVATION_CATEGORIES) {
      assert.equal(typeof lens.weights[category], "number", `${id} has no weight for ${category}`);
    }
  }
  assert.equal(resolveLens("nobody"), null);
});

test("Curtis reads backwards: what earns closeness elsewhere earns attention from him", () => {
  const state = fresh(1904);
  row(state, "curtis", { type: "growth", event: "moving_weight", count: 3, source: "network" });
  assert.ok(C.selectors.disposition(state, "curtis") < 0, "growing is a threat to a rival, not a credit");
  assert.ok(resolveLens("curtis").inverted);
  assert.ok(!resolveLens("mina").inverted);
});

test("Mina weighs what her network carries twice as heavily as what she sees", () => {
  const witnessed = fresh(1905); row(witnessed, "mina", { type: "honesty", event: "x", source: "witnessed" });
  const told = fresh(1905); row(told, "mina", { type: "honesty", event: "x", source: "network" });
  assert.equal(C.selectors.disposition(told, "mina"), C.selectors.disposition(witnessed, "mina") * 2);
});

// --------------------------------------------------------------- bands

test("band boundaries land on the documented values", () => {
  assert.equal(bandFor(-6), C.BANDS.HOSTILE);
  assert.equal(bandFor(-5), C.BANDS.COLD, "score -5 is Cold");
  assert.equal(bandFor(-1), C.BANDS.COLD);
  assert.equal(bandFor(0), C.BANDS.NEUTRAL);
  assert.equal(bandFor(2), C.BANDS.NEUTRAL);
  assert.equal(bandFor(3), C.BANDS.WARM);
  assert.equal(bandFor(5), C.BANDS.WARM);
  assert.equal(bandFor(6), C.BANDS.TRUSTED, "score 6 is Trusted");
  assert.equal(bandFor(8), C.BANDS.TRUSTED);
  assert.equal(bandFor(9), C.BANDS.BONDED);
});

test("bands are ordered so a gate can be one comparison", () => {
  assert.ok(C.BANDS.HOSTILE < C.BANDS.COLD);
  assert.ok(C.BANDS.COLD < C.BANDS.NEUTRAL);
  assert.ok(C.BANDS.NEUTRAL < C.BANDS.WARM);
  assert.ok(C.BANDS.WARM < C.BANDS.TRUSTED);
  assert.ok(C.BANDS.TRUSTED < C.BANDS.BONDED);
});

// ---------------------------------------------------------- propagation

test("a Night Owl observation in the Evening reaches Mina and the same one in the Morning does not", () => {
  const evening = fresh(1906); evening.run.day = 2;
  const reachedEvening = Exposure.broadcastObservation(evening, { type: "presence", event: "night_owl", location: "north_star_lot", channel: "neighborhood", slot: 2 });
  assert.ok(reachedEvening.includes("mina"), "she is behind the counter in the Evening");

  const morning = fresh(1906); morning.run.day = 2;
  const reachedMorning = Exposure.broadcastObservation(morning, { type: "presence", event: "night_owl", location: "north_star_lot", channel: "neighborhood", slot: 0 });
  assert.ok(!reachedMorning.includes("mina"), "she is not there in the Morning, so it never becomes something she knows");
});

test("delayed observations arrive on the day their channel promises", () => {
  const state = fresh(1907); state.run.day = 2; state.run.slot = 1;
  Exposure.broadcastObservation(state, { type: "growth", event: "moving_weight", channel: "network", slot: 1 });
  assert.equal(state.npc.dre.ledger.length, 0, "the wire does not carry it the same afternoon");
  assert.ok(state.run.pendingObservations.length > 0);

  state.run.day = 2; state.run.slot = 3;
  Exposure.resolveObservationQueue(state);
  assert.equal(state.npc.dre.ledger.length, 0, "still not that night");

  state.run.day = 3; state.run.slot = 0;
  Exposure.resolveObservationQueue(state);
  assert.ok(state.npc.dre.ledger.some((entry) => entry.event === "moving_weight"), "it lands the next morning");
});

test("the household channel lands the same night", () => {
  const state = fresh(1908); state.run.day = 2; state.run.slot = 0;
  Exposure.broadcastObservation(state, { type: "presence", event: "home_at_night", channel: "household", slot: 0 });
  state.run.slot = 3;
  Exposure.resolveObservationQueue(state);
  assert.ok(state.npc.yalonda.ledger.some((entry) => entry.event === "home_at_night"));
});

test("Curtis's network filters corner-level activity and passes what actually matters", () => {
  assert.ok(!clearsCurtisFilter({ type: "presence", event: "corner" }));
  assert.ok(!clearsCurtisFilter({ type: "financial", event: "small_day", value: 50 }));
  assert.ok(clearsCurtisFilter({ type: "financial", event: "big_day", value: 400 }), "volume gets on his radar");
  assert.ok(clearsCurtisFilter({ type: "violence", event: "robbery" }));
  assert.ok(clearsCurtisFilter({ type: "defiance", event: "territory_claim" }));

  const state = fresh(1909); state.run.slot = 2;
  const quiet = Exposure.broadcastObservation(state, { type: "presence", event: "corner", channel: "network", slot: 2 });
  assert.ok(!quiet.includes("curtis"));
  const loud = Exposure.broadcastObservation(state, { type: "violence", event: "robbery", channel: "network", slot: 2 });
  assert.ok(loud.includes("curtis"));
});

test("heat spreads on its own past 8, 10, and 12", () => {
  assert.equal(heatChannel(7), null);
  assert.equal(heatChannel(9), "household");
  assert.equal(heatChannel(11), "neighborhood");
  assert.equal(heatChannel(13), "network");

  const state = fresh(1910); state.player.heat = 13; state.run.slot = 2;
  assert.equal(Exposure.propagateHeat(state), "network");
  const state2 = fresh(1910); state2.player.heat = 3;
  assert.equal(Exposure.propagateHeat(state2), null, "a quiet player generates no gossip");
});

test("gossip delay is stable across replays of the same day", () => {
  const runOnce = () => {
    const state = fresh(1911); state.run.day = 2; state.run.slot = 2;
    Exposure.broadcastObservation(state, { type: "violence", event: "robbery", location: "north_star_lot", channel: "neighborhood", slot: 2 });
    return state.run.pendingObservations.map((entry) => entry.deliverAtSlot);
  };
  assert.deepEqual(runOnce(), runOnce(), "the same seed and day must schedule identically");
});

// -------------------------------------------------- action to disposition

test("an action becomes an observation becomes a disposition change", () => {
  let state = fresh(1912);
  state.run.day = 2; state.run.slot = 2;
  const before = C.selectors.disposition(state, "yalonda");
  state = C.reduceGame(state, { type: "SLEEP_HOME" });
  state.run.slot = 3;
  Exposure.resolveObservationQueue(state);
  assert.ok(state.npc.yalonda.ledger.some((entry) => entry.event === "home_at_night"), "she notices you were home");
  assert.ok(C.selectors.disposition(state, "yalonda") > before);
});

// ------------------------------------------------------------ migration

test("v3 through v7 saves all arrive with a ledger they can be read from", () => {
  for (const version of [3, 4, 5, 6, 7, 8]) {
    const raw = JSON.parse(C.serializeRun(fresh(1920 + version)));
    raw.version = version;
    raw.npc.mina.trust = 3; raw.npc.mina.met = true;
    raw.npc.curtis.attention = 4; raw.npc.curtis.attentionMilestones = ["units_10", "revenue_600"];
    raw.npc.yalonda.rentPaidWeeks = 2;
    raw.flags.toldMinaTruth = true;
    for (const id of C.EXPOSURE_NPC_IDS) delete raw.npc[id].ledger;

    const state = C.hydrateRun(raw);
    assert.equal(state.version, 11, `v${version} did not migrate`);
    assert.ok(state.npc.mina.ledger.some((entry) => entry.event === "told_truth"), `v${version} lost the truth she was told`);
    assert.ok(state.npc.mina.ledger.some((entry) => entry.event === "legacy_history"), `v${version} lost her accumulated history`);
    assert.ok(state.npc.curtis.ledger.some((entry) => entry.event === "units_10"), `v${version} lost Curtis's milestones`);
    assert.ok(state.npc.yalonda.ledger.some((entry) => entry.event === "rent_paid"), `v${version} lost the rent record`);
    assert.ok(C.selectors.disposition(state, "mina") > 0, `v${version} threw away the relationship`);
  }
});

test("a v6 save reloads without seeding its history a second time", () => {
  const raw = JSON.parse(C.serializeRun(fresh(1925)));
  raw.version = 5;
  raw.npc.mina.trust = 3;
  for (const id of C.EXPOSURE_NPC_IDS) delete raw.npc[id].ledger;
  const once = C.hydrateRun(raw);
  const twice = C.hydrateRun(JSON.parse(C.serializeRun(once)));
  assert.equal(twice.npc.mina.ledger.length, once.npc.mina.ledger.length);
  assert.equal(C.selectors.disposition(twice, "mina"), C.selectors.disposition(once, "mina"));
});

test("a save older than v3 is still refused", () => {
  const tooOld = JSON.parse(C.serializeRun(fresh(1926)));
  tooOld.version = 2;
  assert.equal(C.migrateSave(tooOld), null);
});

test("the pending queue survives a save round trip", () => {
  const state = fresh(1927); state.run.day = 2; state.run.slot = 1;
  Exposure.broadcastObservation(state, { type: "growth", event: "moving_weight", channel: "network", slot: 1 });
  assert.ok(state.run.pendingObservations.length > 0);
  const reloaded = C.hydrateRun(JSON.parse(C.serializeRun(state)));
  assert.deepEqual(reloaded.run.pendingObservations, state.run.pendingObservations);
});

// ---------------------------------------------------------- content gates

test("Mina's arc gates read bands, and the same band opens the same content", () => {
  const stage4 = C.STORY_REGISTRY.find((item) => item.id === "mina_boundary");
  const stage3 = C.STORY_REGISTRY.find((item) => item.id === "mina_invitation");
  const state = fresh(1930);
  state.npc.mina.met = true; state.npc.mina.available = true;
  state.flags.minaShiftChangeResolved = true;
  state.run.day = 5; state.run.slot = 2; state.world.currentNeighborhoodId = "north_star_lot";

  putInBand(state, "mina", C.BANDS.NEUTRAL);
  assert.equal(stage4.requires(state), false, "Neutral is counter service and nothing more");
  putInBand(state, "mina", C.BANDS.WARM);
  assert.equal(stage4.requires(state), true, "Warm opens Stage 4");
  assert.equal(stage3.requires(state), false, "but not yet the invitation");
  putInBand(state, "mina", C.BANDS.TRUSTED);
  assert.equal(stage3.requires(state), true, "Trusted opens it");
});

test("Dre's ladder is walkable from stranger to the shark tab", () => {
  const state = fresh(1931);
  state.npc.dre.known = true;
  assert.equal(C.selectors.dreTrustTier(state), "Stranger");
  assert.equal(C.selectors.dreMissionAvailability(state).available, false);

  putInBand(state, "dre", C.BANDS.WARM);
  assert.equal(C.selectors.dreTrustTier(state), "Reliable");
  putInBand(state, "dre", C.BANDS.TRUSTED);
  assert.equal(C.selectors.dreTrustTier(state), "Earner");
  assert.equal(C.selectors.dreMissionAvailability(state).available, true, "Trusted unlocks missions");

  putInBand(state, "dre", C.BANDS.BONDED);
  assert.equal(C.selectors.dreTrustTier(state), "Inner Circle");
  state.player.cash = 2000; state.player.cleanCash = 2000;
  state.npc.dre.cleanCompletions = 3; state.npc.dre.loansRepaid = 2;
  assert.equal(C.selectors.sharkLoanAvailability(state, "nora", 100, 2).available, true);
});

test("Curtis is invisible at Neutral, watching at Cold, and taxing at Hostile", () => {
  const mark = C.STORY_REGISTRY.find((item) => item.id === "curtis_mark");
  const tax = C.STORY_REGISTRY.find((item) => item.id === "curtis_tax");

  const invisible = fresh(1932);
  putInBand(invisible, "curtis", C.BANDS.NEUTRAL);
  assert.equal(mark.requires(invisible), false);
  assert.equal(tax.requires(invisible), false);

  const watched = fresh(1933);
  putInBand(watched, "curtis", C.BANDS.COLD);
  assert.equal(mark.requires(watched), true, "Cold is being watched");
  assert.equal(tax.requires(watched), false, "but not yet taxed");

  const hostile = fresh(1934);
  putInBand(hostile, "curtis", C.BANDS.HOSTILE);
  assert.equal(tax.requires(hostile), true, "Hostile is where the tax comes");
});

// ------------------------------------------------------------- inspector

test("the debug inspector explains a score rather than restating it", () => {
  const state = fresh(1940);
  row(state, "mina", { type: "honesty", event: "told_truth", source: "witnessed" });
  row(state, "mina", { type: "violence", event: "robbery", count: 2, source: "neighborhood" });
  const read = C.selectors.describeDisposition(state, "mina");
  assert.equal(read.npcId, "mina");
  assert.equal(read.archetype, "ROMANTIC");
  assert.equal(read.score, C.selectors.disposition(state, "mina"));
  assert.equal(read.rows.length, 2);
  // Sorted by how much each row actually moved the number, so the first line
  // answers "why is she here".
  assert.ok(Math.abs(read.rows[0].contribution) >= Math.abs(read.rows[1].contribution));
  const total = read.rows.reduce((sum, entry) => sum + entry.contribution, 0);
  assert.ok(Math.abs(total - read.score) < 0.05, "the rows must add up to the score");
  assert.equal(C.selectors.describeDisposition(state, "nobody"), null);
});

// ------------------------------------------------------------ determinism

test("nothing in the exposure path reaches for Math.random", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..");
  for (const file of ["src/exposure/engine.js", "src/data/observations.js", "src/data/npc-lenses.js", "src/data/propagation.js", "src/data/disposition-bands.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /Math\.random/, `${file} must stay seeded`);
  }
});

test("the engine never requires game-core back", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..");
  for (const file of ["src/exposure/engine.js", "src/data/observations.js", "src/data/npc-lenses.js", "src/data/propagation.js", "src/data/disposition-bands.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /require\(["'].*game-core/, `${file} would create a cycle`);
  }
});
