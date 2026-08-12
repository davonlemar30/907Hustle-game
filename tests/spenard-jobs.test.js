const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../game-core.js");

function fresh(seed = 907) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN" });
  state.run.openingPending = false;
  return state;
}
function clearSurfaces(state) {
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.daySummary = null;
  return state;
}
function discover(state, ...ids) {
  for (const id of ids) if (!state.jobs.discovered.includes(id)) state.jobs.discovered.push(id);
  return state;
}

test("the first Wander always discovers Wash & Go and still fires the existing first-walk event", () => {
  let state = fresh(1001);
  state = C.reduceGame(state, { type: "WANDER_SPENARD" });
  assert.deepEqual(state.jobs.discovered, ["wash_go"]);
  assert.equal(state.jobs.discoveryChance, 0.30);
  assert.ok(state.log.some((entry) => entry.text.includes("Help Wanted") && entry.text.includes("Wash & Go")));
  assert.equal(state.run.pendingEvent?.id, "boost_first_opportunity");
  assert.equal(state.world.locations.explorationCount, 1);
});

test("later Wanders discover at most one eligible hidden job and ramp or reset the seeded chance", () => {
  let observedMiss = false, observedHit = false;
  for (let seed = 1; seed < 300 && (!observedMiss || !observedHit); seed += 1) {
    let state = fresh(seed);
    discover(state, "wash_go");
    state.world.locations.explorationCount = 2;
    state.jobs.discoveryChance = 0.30;
    state.flags.boostOpportunitySeen = true;
    state.run.day = 1;
    const before = state.jobs.discovered.length;
    state = C.reduceGame(state, { type: "WANDER_SPENARD" });
    const delta = state.jobs.discovered.length - before;
    assert.ok(delta === 0 || delta === 1);
    if (delta === 0) { observedMiss = true; assert.equal(state.jobs.discoveryChance, 0.40); }
    if (delta === 1) { observedHit = true; assert.equal(state.jobs.discoveryChance, 0.30); }
  }
  assert.equal(observedMiss, true);
  assert.equal(observedHit, true);
});

test("structured John work intel makes Ship Creek eligible without depending on a John implementation", () => {
  let found = false;
  for (let seed = 1; seed < 300 && !found; seed += 1) {
    let state = fresh(seed);
    state.john = { questionsAsked: ["work:1"] };
    discover(state, "wash_go", "night_owl");
    state.world.locations.explorationCount = 1;
    state.jobs.discoveryChance = 0.70;
    state.flags.boostOpportunitySeen = true;
    state = C.reduceGame(state, { type: "WANDER_SPENARD" });
    found = state.jobs.discovered.includes("ship_creek");
  }
  assert.equal(found, true);
  assert.equal(C.selectors.johnWorkIntelKnown({ john: undefined }), false);
});

test("discovered job selectors keep hidden jobs absent and show unmet execution gates", () => {
  const state = fresh();
  discover(state, "wash_go", "night_owl", "delivery");
  assert.deepEqual(C.selectors.discoveredJobs(state).map((job) => job.id), ["wash_go", "night_owl", "delivery"]);
  assert.equal(C.selectors.jobAvailability(state, "ship_creek").available, false);
  assert.equal(C.selectors.jobAvailability(state, "night_owl").reason, "Meet the Night Owl clerk first.");
  assert.equal(C.selectors.jobAvailability(state, "delivery").reason, "Needs a reliable ride.");
});

test("one scheduled shift per day coexists with one separate Delivery gig", () => {
  let state = fresh(2202);
  discover(state, "wash_go", "delivery");
  state.world.transport.industrialRouteKnown = true;
  state = C.reduceGame(state, { type: "WORK_JOB", jobId: "wash_go", approach: "socialize" });
  clearSurfaces(state);
  assert.equal(C.selectors.jobAvailability(state, "wash_go").available, false);
  assert.equal(C.selectors.jobAvailability(state, "delivery").available, true);
  state = C.reduceGame(state, { type: "WORK_JOB", jobId: "delivery", approach: "socialize" });
  assert.equal(state.run.pendingEncounter, null, "legitimate delivery work has no default encounter roll");
  clearSurfaces(state);
  assert.equal(C.selectors.jobAvailability(state, "delivery").available, false);
});

test("approaches affect pay, health, XP, relationships, details, and seeded results", () => {
  function work(seed, approach) {
    let state = fresh(seed); discover(state, "wash_go"); state.player.health = 50;
    return C.reduceGame(state, { type: "WORK_JOB", jobId: "wash_go", approach });
  }
  const hardA = work(3303, "work_hard"), hardB = work(3303, "work_hard"), social = work(3303, "socialize"), easy = work(3303, "take_it_easy"), learn = work(3303, "learn_job");
  assert.equal(hardA.player.cash, hardB.player.cash);
  assert.ok(hardA.player.cash > social.player.cash);
  assert.equal(hardA.player.health, 48); assert.equal(easy.player.health, 51);
  assert.equal(hardA.jobs.records.wash_go.xp, 2); assert.equal(easy.jobs.records.wash_go.xp, 0); assert.equal(learn.jobs.records.wash_go.xp, 1.5);
  assert.equal(social.jobs.records.wash_go.relationship, 1); assert.equal(hardA.jobs.records.wash_go.relationship, 0.5);
  assert.equal(learn.jobs.records.wash_go.learnedDetails.length, 1);
  const ranked = fresh(); discover(ranked, "wash_go"); ranked.jobs.records.wash_go.xp = 14; ranked.jobs.records.wash_go.rank = 3;
  assert.deepEqual(C.selectors.jobPayRange(ranked, "wash_go"), { min: 52, max: 78, multiplier: 1.3 });
  const rankedResult = C.reduceGame(ranked, { type: "WORK_JOB", jobId: "wash_go", approach: "socialize" });
  assert.ok(rankedResult.player.cleanCash >= 52 && rankedResult.player.cleanCash <= 78);
});

test("Night Owl ranks unlock Night scheduling, the exclusive stash, and Deshawn's vouch", () => {
  let state = fresh(4404); discover(state, "night_owl"); state.people.mara.met = true;
  for (let shift = 1; shift <= 7; shift += 1) {
    clearSurfaces(state); state.run.day = shift; state.run.slot = 2;
    state = C.reduceGame(state, { type: "WORK_JOB", jobId: "night_owl", approach: "work_hard" });
  }
  assert.equal(state.jobs.records.night_owl.xp, 14);
  assert.equal(state.jobs.records.night_owl.rank, 3);
  clearSurfaces(state); state.run.slot = 3; state.jobs.lastScheduledShiftDay = null;
  assert.equal(C.selectors.jobAvailability(state, "night_owl").available, true);
  assert.equal(state.flags.spenardVouched, true);
  assert.equal(C.selectors.knownWorkplaceContacts(state)[0].name, "Mara Velez");

  state.player.inventory.weed.qty = 1;
  state = C.reduceGame(state, { type: "NIGHT_OWL_STASH_PRODUCT", direction: "store", productId: "weed", qty: 1 });
  const cashBlocked = C.reduceGame(state, { type: "NIGHT_OWL_STASH_CASH", direction: "store", amount: 50 });
  assert.equal(cashBlocked, state, "cash cannot share the product-mode stash");
  state = C.reduceGame(state, { type: "NIGHT_OWL_STASH_PRODUCT", direction: "retrieve", productId: "weed", qty: 1 });
  state = C.reduceGame(state, { type: "NIGHT_OWL_STASH_CASH", direction: "store", amount: 300 });
  assert.equal(C.selectors.nightOwlStashUsed(state).cash, 300);
  assert.equal(C.reduceGame(state, { type: "NIGHT_OWL_STASH_CASH", direction: "store", amount: 1 }), state);
});

test("job state and Night Owl storage hydrate additively under the v3 save key", () => {
  let state = fresh(); discover(state, "wash_go");
  state.jobs.records.wash_go.xp = 4; state.jobs.records.wash_go.rank = 1; state.jobs.records.wash_go.contactMet = true;
  const hydrated = C.inspectSave(C.serializeRun(state));
  assert.equal(hydrated.valid, true);
  assert.deepEqual(hydrated.state.jobs.discovered, ["wash_go"]);
  assert.equal(hydrated.state.jobs.records.wash_go.rank, 1);
  const legacy = JSON.parse(C.serializeRun(state)); delete legacy.jobs;
  const migrated = C.hydrateRun(legacy);
  assert.deepEqual(migrated.jobs.discovered, []);
  assert.equal(migrated.jobs.discoveryChance, 0.30);
});

test("all authored job discovery, introduction, detail, and live result copy stays under forty words", () => {
  const authored = C.SPENARD_JOBS.flatMap((job) => [job.discovery, job.contact.introduction, ...job.details]);
  for (const line of authored) assert.ok(line.trim().split(/\s+/).length < 40, line);
  for (const job of C.SPENARD_JOBS) {
    let state = fresh(); discover(state, job.id);
    if (job.id === "night_owl") { state.people.mara.met = true; state.run.slot = 2; }
    if (job.id === "delivery") state.world.transport.industrialRouteKnown = true;
    state = C.reduceGame(state, { type: "WORK_JOB", jobId: job.id, approach: "learn_job" });
    for (const entry of state.log.slice(0, 4)) assert.ok(entry.text.trim().split(/\s+/).length < 40, entry.text);
  }
  for (const line of [
    "You catch part of a hiring conversation, but not enough to know who is taking names.",
    "Night Owl Rank 1. Mara adds Night shifts to your schedule.",
    "Night Owl Rank 2. Mara clears a small back-room stash for you.",
    "Mara introduces Deshawn. He puts his name behind yours on Spenard Road.",
    "Wash & Go Attendant: Rank 3. The better rate starts with your next shift.",
  ]) assert.ok(line.trim().split(/\s+/).length < 40, line);
});
