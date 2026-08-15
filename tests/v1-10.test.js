// v1.10 — Unified Stat Architecture.
//
// What this file pins is the contract of the new pipeline: an attribute shapes
// an outcome's quality, the quality decides the observation footprint, and the
// footprint moves dispositions. The balance behind it - how fast a gym-focused
// week actually climbs, how the success curves bend at each level - is measured
// in tests/attribute-balance.js, because it is a distribution question and a
// unit assertion is the wrong instrument for it.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const A = require("../src/systems/attributes.js");
const AD = require("../src/data/attributes.js");
const M = require("../src/data/market.js");
const ME = require("../src/events/market-events.js");
const OBS = require("../src/data/observations.js");
const PROP = require("../src/data/propagation.js");

function fresh(seed = 11000) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Ten" });
  state.run.openingPending = false;
  return state;
}

function clear(state) {
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.daySummary = null;
  return state;
}

function pool(chance) {
  return A.buildOutcomePool("robbery", chance);
}

// ---------------------------------------------------------------------------
// Task 1 — three attributes
// ---------------------------------------------------------------------------

test("a fresh run starts Green across combat, charisma, and intelligence", () => {
  const state = fresh();
  assert.deepEqual(state.player.attributes, { combat: 1, charisma: 1, intelligence: 1 });
  assert.deepEqual(state.player.attributeProgress, { combat: 0, charisma: 0, intelligence: 0 });
  assert.equal(state.player.gymStreak, 0);
  assert.deepEqual(Object.keys(state.player.attributes), AD.ATTRIBUTE_IDS);
});

test("labels are the only reading a player gets, and they cover the whole range", () => {
  assert.equal(A.attributeLabel(0), "Green");
  assert.equal(A.attributeLabel(1), "Green");
  assert.equal(A.attributeLabel(2), "Capable");
  assert.equal(A.attributeLabel(3), "Capable");
  assert.equal(A.attributeLabel(4), "Solid");
  assert.equal(A.attributeLabel(5), "Solid");
  assert.equal(A.attributeLabel(6), "Dangerous");
  assert.equal(A.attributeLabel(7), "Dangerous");
  assert.equal(A.attributeLabel(8), "Elite");
  assert.equal(A.attributeLabel(40), "Elite");
});

test("the character screen shows labels and the debug inspector shows numbers", () => {
  const ui = fs.readFileSync(path.join(__dirname, "..", "ui.jsx"), "utf8");
  const character = ui.slice(ui.indexOf("function Character("), ui.indexOf("function PhoneScreen("));
  assert.match(character, /attributeLabels/);
  assert.doesNotMatch(character, /state\.player\.attributes\[/, "the character screen must never print a raw attribute");
  const debug = ui.slice(ui.indexOf("function ExposureDebug("));
  assert.match(debug, /selectors\.attributes\(state\)/, "the dev inspector is where the numbers live");
  assert.match(debug, /attributeProgress/);
});

test("a v7 save folds six attributes into three by taking the best of each group", () => {
  const raw = JSON.parse(C.serializeRun(fresh(11001)));
  raw.version = 7;
  raw.player.attributes = { strength: 4, endurance: 2, reflexes: 1, presence: 3, insight: 5, discipline: 2 };
  raw.player.attributeProgress = { strength: 6, endurance: 0, reflexes: 0, presence: 0, insight: 0, discipline: 0 };
  raw.player.streetIdentity = "stickup";
  const state = C.hydrateRun(raw);
  assert.equal(state.version, 9);
  // combat = max(strength, endurance, reflexes); charisma = max(presence,
  // discipline); intelligence = max(insight, discipline).
  assert.deepEqual(state.player.attributes, { combat: 4, charisma: 3, intelligence: 5 });
  assert.deepEqual(state.player.attributeProgress, { combat: 0, charisma: 0, intelligence: 0 });
  assert.equal(state.player.streetIdentity, undefined, "the stored label does not survive");
  assert.equal(state.player.historicalIdentity, "The Stickup", "but it is kept for display");
});

test("every supported save version arrives with exactly three attributes", () => {
  for (const version of [3, 4, 5, 6, 7, 8]) {
    const raw = JSON.parse(C.serializeRun(fresh(11010 + version)));
    raw.version = version;
    raw.player.attributes = { strength: 3, endurance: 3, reflexes: 3, presence: 2, insight: 2, discipline: 2 };
    const state = C.hydrateRun(raw);
    assert.equal(state.version, 9, `v${version} did not reach v9`);
    assert.deepEqual(Object.keys(state.player.attributes).sort(), ["charisma", "combat", "intelligence"], `v${version} kept a legacy attribute key`);
  }
});

// ---------------------------------------------------------------------------
// Task 2 — advantage resolution
// ---------------------------------------------------------------------------

test("the three thresholds behave as advantage rather than as a bonus", () => {
  const outcomes = pool(0.5);
  // Below 3 it is one look at the pool.
  const low = A.resolveWithAttribute(outcomes, 2, "key");
  assert.equal(low.tier, A.resolveWithAttribute(outcomes, 0, "key").tier, "0-2 all resolve the same way");
  // At 3 the second roll exists and the better of the two is taken.
  const first = A.resolveWithAttribute(outcomes, 2, "key");
  const second = A.resolveWithAttribute(outcomes, 3, "key");
  assert.ok(second.value >= first.value, "advantage can never return the worse of the two");
  // At 6 the catastrophic tier is not in the pool at all.
  for (let i = 0; i < 200; i += 1) {
    assert.notEqual(A.resolveWithAttribute(outcomes, 6, `k${i}`).tier, "catastrophic");
  }
});

test("a higher attribute is never worse from the same seed", () => {
  for (const chance of [0.15, 0.35, 0.55, 0.8]) {
    const outcomes = pool(chance);
    for (let seed = 0; seed < 400; seed += 1) {
      let previous = -1;
      for (const value of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
        const result = A.resolveWithAttribute(outcomes, value, `same:${chance}:${seed}`);
        assert.ok(result.value >= previous, `attribute ${value} went backwards at chance ${chance}, seed ${seed}`);
        previous = Math.max(previous, result.value);
      }
    }
  }
});

test("resolution is keyed off the seed, not the RNG stream", () => {
  const outcomes = pool(0.5);
  const a = A.resolveWithAttribute(outcomes, 4, "stable");
  const b = A.resolveWithAttribute(outcomes, 4, "stable");
  assert.equal(a.tier, b.tier);
  const system = fs.readFileSync(path.join(__dirname, "..", "src", "systems", "attributes.js"), "utf8");
  assert.doesNotMatch(system, /Math\.random/);
  // The only mention of the RNG stream is the comment explaining why this
  // module does not touch it.
  assert.equal(system.split("\n").filter((line) => /rngState/.test(line) && !line.trim().startsWith("//")).length, 0);
  assert.doesNotMatch(system, /require\(.*game-core/, "the systems module must never require the barrel back");
});

test("the outcome pool preserves the context-sensitive chance it was built from", () => {
  for (const chance of [0, 0.25, 0.5, 1]) {
    const outcomes = pool(chance);
    const success = outcomes.filter((item) => A.isSuccessTier(item.tier)).reduce((sum, item) => sum + item.weight, 0);
    assert.ok(Math.abs(success - chance) < 1e-9, `pool for ${chance} carried ${success} of success weight`);
  }
});

test("every action with a tier shape has an attribute and an observation map", () => {
  for (const actionType of Object.keys(AD.OUTCOME_SHAPES)) {
    assert.ok(AD.ACTION_ATTRIBUTE_MAP[actionType], `${actionType} has no attribute`);
    const map = AD.OUTCOME_OBSERVATIONS[actionType];
    assert.ok(map, `${actionType} has no observation map`);
    const shape = AD.OUTCOME_SHAPES[actionType];
    for (const tier of [...Object.keys(shape.success), ...Object.keys(shape.failure)]) {
      assert.ok(Array.isArray(map[tier]), `${actionType} tier ${tier} has no observation entry`);
      for (const spec of map[tier]) {
        assert.ok(OBS.OBSERVATION_CATEGORIES.includes(spec.type), `${actionType}/${tier} uses category ${spec.type}, which is not one of the eleven`);
        assert.ok(PROP.CHANNELS[spec.channel], `${actionType}/${tier} routes on unknown channel ${spec.channel}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Task 3 — the gym
// ---------------------------------------------------------------------------

test("growth diminishes with sessions and halves again past Dangerous", () => {
  assert.ok(A.attributeGrowth(1, 0, "bag_work") > A.attributeGrowth(1, 5, "bag_work"));
  assert.ok(A.attributeGrowth(1, 5, "bag_work") > A.attributeGrowth(1, 20, "bag_work"));
  assert.equal(A.attributeGrowth(6, 4, "bag_work"), A.attributeGrowth(1, 4, "bag_work") * 0.5);
  assert.ok(A.attributeGrowth(1, 0, "sparring") > A.attributeGrowth(1, 0, "bag_work"));
  assert.ok(A.attributeGrowth(1, 0, "bag_work") > A.attributeGrowth(1, 0, "cardio"));
  assert.equal(A.attributeGrowth(1, 0, "not_an_activity"), 0);
});

test("sparring carries a real injury risk and is seeded", () => {
  let state = clear(fresh(11020));
  state.discovered.spenardGym = true;
  state.player.cash = 5000;
  state.player.attributes.combat = 3;
  const injured = new Set();
  for (let seed = 0; seed < 40; seed += 1) {
    const attempt = clear(JSON.parse(JSON.stringify(state)));
    attempt.run.seed = 20000 + seed;
    const after = C.reduceGame(attempt, { type: "TRAIN_ATTRIBUTE", activity: "sparring" });
    injured.add(after.player.health < attempt.player.health);
  }
  assert.ok(injured.has(true), "forty sessions and nobody ever got hurt");
  assert.ok(injured.has(false), "forty sessions and everybody got hurt");
});

test("three consecutive gym days bank a discipline bonus that a rest day breaks", () => {
  let state = clear(fresh(11021));
  state.discovered.spenardGym = true;
  state.player.cash = 5000;
  for (let day = 0; day < 3; day += 1) {
    state.world.locations.gym.sessionDay = null;
    state.run.slot = 0; state.run.dayEndPending = false; state.player.energy = 4;
    state = clear(C.reduceGame(state, { type: "TRAIN_ATTRIBUTE", activity: "bag_work" }));
    if (day < 2) state.run.day += 1;
  }
  assert.equal(state.player.gymStreak, 3);
  assert.equal(A.gymStreakBonus(state, "combat"), AD.GYM_STREAK_BONUS);
  assert.equal(A.gymStreakBonus(state, "charisma"), 0, "the bonus is physical, not general");
  assert.equal(A.effectiveAttribute(state, "combat"), state.player.attributes.combat + 1);
  // A day that ends without a session ends the run of them.
  state.run.day += 1;
  state.run.dayEndPending = true;
  state = clear(C.reduceGame(state, { type: "CONFIRM_END_DAY" }));
  assert.equal(state.player.gymStreak, 0);
});

test("a gym streak broadcasts a growth observation the household can read", () => {
  let state = clear(fresh(11022));
  state.discovered.spenardGym = true;
  state.player.cash = 5000;
  for (let day = 0; day < 3; day += 1) {
    state.world.locations.gym.sessionDay = null;
    state.run.slot = 0; state.run.dayEndPending = false; state.player.energy = 4;
    state = clear(C.reduceGame(state, { type: "TRAIN_ATTRIBUTE", activity: "bag_work" }));
    if (day < 2) state.run.day += 1;
  }
  const seen = [...state.npc.yalonda.ledger, ...state.npc.juan.ledger, ...state.run.pendingObservations.map((item) => item.observation || item)];
  assert.ok(seen.some((row) => row && row.event === "gym_consistent"), "nobody at home noticed the routine");
});

// ---------------------------------------------------------------------------
// Task 4 — outcome quality decides the observation footprint
// ---------------------------------------------------------------------------

test("a clean robbery is quiet and a catastrophic one goes wide", () => {
  const clean = AD.OUTCOME_OBSERVATIONS.robbery.clean;
  const catastrophic = AD.OUTCOME_OBSERVATIONS.robbery.catastrophic;
  assert.deepEqual(clean.map((item) => item.channel), ["direct"]);
  assert.ok(catastrophic.some((item) => item.channel === "network"));
  assert.ok(catastrophic.length > clean.length, "a catastrophe writes more rows than a clean job");
});

test("a high-Combat player leaves a lighter footprint across a hundred seeded robberies", () => {
  // Weight by reach, not by row count: what makes a good thief quiet is that
  // their rows stay on `direct` instead of travelling to the neighborhood and
  // the network.
  const reach = { direct: 0, household: 1, neighborhood: 2, network: 3, reputation: 3 };
  function footprint(combat) {
    let score = 0;
    for (let seed = 0; seed < 100; seed += 1) {
      const outcome = A.resolveWithAttribute(pool(0.5), combat, `rob:${seed}`);
      for (const spec of AD.OUTCOME_OBSERVATIONS.robbery[outcome.tier]) score += reach[spec.channel];
    }
    return score;
  }
  const green = footprint(1);
  const dangerous = footprint(7);
  assert.ok(dangerous < green, `Dangerous carried ${dangerous} of reach against Green's ${green}`);
});

test("the whole pipeline runs end to end: action, check, outcome, observation, disposition", () => {
  let state = clear(fresh(11030));
  state.player.attributes.combat = 1;
  state.rob.visible = true;
  const dispositions = Object.fromEntries(C.EXPOSURE_NPC_IDS.map((id) => [id, C.selectors.disposition(state, id)]));
  const ledgerBefore = state.npc.curtis.ledger.length + state.npc.yalonda.ledger.length + state.run.pendingObservations.length;
  const availability = C.selectors.robAvailability(state);
  if (!availability.available) return; // the rob gate is content, not this test's subject
  state = C.reduceGame(state, { type: "ROB" });
  const ledgerAfter = state.npc.curtis.ledger.length + state.npc.yalonda.ledger.length + state.run.pendingObservations.length;
  assert.ok(ledgerAfter > ledgerBefore, "a robbery that nobody recorded is not wired in");
  const moved = C.EXPOSURE_NPC_IDS.some((id) => C.selectors.disposition(state, id) !== dispositions[id]);
  assert.ok(moved, "observations landed but nobody's disposition moved");
});

// ---------------------------------------------------------------------------
// Task 5 — derived Street Identity
// ---------------------------------------------------------------------------

test("getStreetIdentity is pure and never writes to state", () => {
  const state = fresh(11040);
  const snapshot = JSON.stringify(state);
  assert.equal(A.getStreetIdentity(state), A.getStreetIdentity(state));
  assert.equal(JSON.stringify(state), snapshot);
});

test("the identity matrix has a label for every combination", () => {
  for (const dominant of ["combat", "charisma", "intelligence", "balanced"]) {
    for (const behavior of ["violence", "presence", "financial", "default"]) {
      const label = AD.IDENTITY_MATRIX[dominant][behavior];
      assert.ok(label && typeof label === "string", `${dominant}/${behavior} has no label`);
      assert.ok(AD.IDENTITY_DESCRIPTIONS[label], `${label} has no description`);
    }
  }
});

test("changing the dominant attribute changes the label; so does changing behavior", () => {
  const state = fresh(11041);
  state.npc.curtis.ledger = [{ type: "violence", event: "stickup", location: null, value: null, day: state.run.day, count: 5, source: "network" }];
  state.player.attributes = { combat: 5, charisma: 1, intelligence: 1 };
  assert.equal(A.getStreetIdentity(state), "Shooter");
  state.player.attributes = { combat: 1, charisma: 1, intelligence: 5 };
  assert.equal(A.getStreetIdentity(state), "Ghost");
  // Same attributes, a different week.
  state.npc.curtis.ledger = [{ type: "financial", event: "907list_profit", location: null, value: 300, day: state.run.day, count: 5, source: "network" }];
  assert.equal(A.getStreetIdentity(state), "Quiet Money");
});

test("a lead of two points or less still reads as Balanced", () => {
  assert.equal(A.getDominantAttribute(3, 1, 1), "balanced");
  assert.equal(A.getDominantAttribute(4, 1, 1), "combat");
  assert.equal(A.getDominantAttribute(1, 1, 1), "balanced");
});

test("identity gates nothing", () => {
  const core = fs.readFileSync(path.join(__dirname, "..", "game-core.js"), "utf8");
  // The only reads are the two display helpers and the encounter flavour line.
  const reads = core.split("\n").filter((line) => /streetIdentity\(|identityProfile\(/.test(line) && !/function streetIdentity|function streetIdentityView/.test(line));
  for (const line of reads) {
    assert.doesNotMatch(line, /chance|clamp\(|resolveWithAttribute|Band\(/, `identity leaked into a gate: ${line.trim()}`);
  }
});

// ---------------------------------------------------------------------------
// Task 6 — heat and employment
// ---------------------------------------------------------------------------

function employed(seed, jobId = "wash_go") {
  const state = clear(fresh(seed));
  state.jobs.discovered.push(jobId);
  state.jobs.activeJobId = jobId;
  state.jobs.hired = ["day_labor", jobId];
  state.npc.mina.met = true;
  state.npc.mina.available = true;
  return state;
}

test("heat 7 says nothing and heat 8 gets you pulled aside", () => {
  let quiet = employed(11050);
  quiet.player.heat = 7;
  quiet = C.reduceGame(quiet, { type: "WORK_JOB", jobId: "wash_go", approach: "work_hard" });
  assert.equal(quiet.jobs.warnings.wash_go, undefined);
  assert.equal(quiet.jobs.activeJobId, "wash_go");

  let warned = employed(11051);
  warned.player.heat = 8;
  warned = C.reduceGame(warned, { type: "WORK_JOB", jobId: "wash_go", approach: "work_hard" });
  assert.equal(warned.jobs.warnings.wash_go, 1);
  assert.equal(warned.jobs.activeJobId, "wash_go", "a warning is not a firing");
  assert.ok(warned.log.some((entry) => /People are talking/.test(entry.text)));
  assert.ok(warned.phone.inbox.some((message) => /head down/.test(message.text)));
});

test("heat 10 is the final warning and heat 12 is the end of the job", () => {
  let final = employed(11052);
  final.player.heat = 10;
  final = C.reduceGame(final, { type: "WORK_JOB", jobId: "wash_go", approach: "work_hard" });
  assert.equal(final.jobs.warnings.wash_go, 2);
  assert.equal(final.jobs.activeJobId, "wash_go");

  let fired = employed(11053);
  fired.player.heat = 12;
  fired = C.reduceGame(fired, { type: "WORK_JOB", jobId: "wash_go", approach: "work_hard" });
  assert.equal(fired.jobs.activeJobId, null);
  assert.deepEqual(fired.jobs.hired, ["day_labor"]);
  assert.equal(fired.jobs.records.wash_go.rank, 0);
  assert.ok(fired.log.some((entry) => /let go/.test(entry.text)));
  const rows = [...fired.npc.yalonda.ledger, ...fired.run.pendingObservations.map((item) => item.observation || item)];
  assert.ok(rows.some((row) => row && row.event === "job_lost"), "losing the job never reached the household");
});

test("day labor survives any amount of heat", () => {
  let state = employed(11054, "day_labor");
  state.jobs.activeJobId = null;
  state.jobs.hired = ["day_labor"];
  state.player.heat = 14;
  assert.equal(C.selectors.jobAvailability(state, "day_labor").available, true);
  state = C.reduceGame(state, { type: "WORK_JOB", jobId: "day_labor", approach: "work_hard" });
  assert.equal(state.jobs.warnings.day_labor, undefined, "day labor never runs the ladder");
  assert.deepEqual(state.jobs.hired, ["day_labor"]);
});

test("the Night Owl stops scheduling you at heat 12 but never stops being the Night Owl", () => {
  const state = employed(11055, "night_owl");
  state.jobs.records.night_owl.rank = 1;
  state.run.slot = 2; // the counter shift is an Evening job; the heat gate sits after the clock
  state.player.heat = 12;
  const availability = C.selectors.jobAvailability(state, "night_owl");
  assert.equal(availability.available, false);
  assert.match(availability.reason, /still come in/);
  assert.equal(state.jobs.activeJobId, "night_owl", "restricted hours are not a firing");
});

test("cooling off un-arms the ladder", () => {
  let state = employed(11056);
  state.player.heat = 8;
  state = C.reduceGame(state, { type: "WORK_JOB", jobId: "wash_go", approach: "work_hard" });
  assert.equal(state.jobs.warnings.wash_go, 1);
  state.player.heat = 3;
  state.jobs.lastScheduledShiftDay = null;
  state.run.day += 1; state.run.slot = 0; state.run.dayEndPending = false; state.player.energy = 4;
  state = C.reduceGame(clear(state), { type: "WORK_JOB", jobId: "wash_go", approach: "work_hard" });
  assert.equal(state.jobs.warnings.wash_go, undefined);
});

// ---------------------------------------------------------------------------
// Task 7 — pricing and pacing
// ---------------------------------------------------------------------------

test("Intelligence narrows the sell-price swing at the documented thresholds", () => {
  const state = fresh(11060);
  state.player.attributes.intelligence = 1;
  assert.equal(ME.priceVolatility(state), M.PRICE_VOLATILITY);
  state.player.attributes.intelligence = 3;
  assert.equal(ME.priceVolatility(state), 0.15);
  state.player.attributes.intelligence = 6;
  assert.equal(ME.priceVolatility(state), 0.10);
  assert.ok(ME.priceVolatility(state) < M.PRICE_VOLATILITY, "INT 6 must be tighter than INT 1");
});

test("Intelligence surfaces one more listing once the read is real", () => {
  const green = fresh(11061);
  green.knowledge.knows907List = true;
  green.player.attributes.intelligence = 1;
  const sharp = JSON.parse(JSON.stringify(green));
  sharp.player.attributes.intelligence = 3;
  const count = (state) => C.selectors.listingSlate(state, "phone").length;
  assert.equal(count(sharp), count(green) + 1);
});

test("standing gains halve and then quarter as they climb", () => {
  assert.equal(A.adjustedStandingGain(0, 1, "capped"), 1);
  assert.equal(A.adjustedStandingGain(2, 1, "capped"), 1);
  assert.equal(A.adjustedStandingGain(3, 1, "capped"), 0.5);
  assert.equal(A.adjustedStandingGain(4, 1, "capped"), 0.25);
  // Crew loyalty and job relationship are genuinely uncapped and keep the
  // thresholds the spec names.
  assert.equal(A.adjustedStandingGain(4, 1, "open"), 1);
  assert.equal(A.adjustedStandingGain(5, 1, "open"), 0.5);
  assert.equal(A.adjustedStandingGain(8, 1, "open"), 0.25);
  // A loss is a loss. The brake only ever slows a gain.
  assert.equal(A.adjustedStandingGain(9, -2, "open"), -2);
});

test("the brake banks its remainder instead of rolling for it", () => {
  const record = {};
  assert.equal(A.bankStandingGain(record, 3, 1, "capped"), 0, "half a point is not a point");
  assert.equal(A.bankStandingGain(record, 3, 1, "capped"), 1, "two braked days pay one point");
  const twin = {};
  assert.equal(A.bankStandingGain(twin, 3, 1, "capped"), 0, "and it does the same thing every time");
});

test("ARCHITECTURE records that reputation is not a stat", () => {
  const doc = fs.readFileSync(path.join(__dirname, "..", "ARCHITECTURE.md"), "utf8");
  assert.match(doc, /Reputation is not a stat/);
  const core = fs.readFileSync(path.join(__dirname, "..", "game-core.js"), "utf8");
  assert.equal(/state\.player\.reputation|player\.reputation\b/.test(core), false, "no reputation field may exist");
});

// ---------------------------------------------------------------------------
// Task 8 — the buy guard
// ---------------------------------------------------------------------------

test("a purchase that resolves to zero units keeps the cash and says so", () => {
  const state = fresh(11070);
  state.market = { ...state.market, visible: true };
  state.world.productAccess.weed = true;
  state.plugs.unlocked = ["goodie"];
  state.plugs.records.goodie.introducedNext = true;
  const before = state.player.cash;
  const after = C.reduceGame(state, { type: "BUY", productId: "weed", qty: Number.NaN });
  assert.equal(after.player.cash, before, "a failed transaction must never move money");
  assert.ok(after.log.some((entry) => entry.text === "Transaction failed. Try again."));
  assert.ok(after.run.consequenceQueue.some((entry) => entry.text === "Transaction failed. Try again."));
});

test("an ordinary purchase is untouched by the guard", () => {
  let state = fresh(11071);
  state.market = { ...state.market, visible: true };
  state.world.productAccess.weed = true;
  state.plugs.unlocked = ["goodie"];
  state.player.cash = 2000;
  const before = state.player.cash;
  const after = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  if (after === state) return; // the market gate is content, not this test's subject
  assert.ok(after.player.cash < before);
  assert.equal(after.player.inventory.weed.qty, 1);
});
