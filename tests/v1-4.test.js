const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

function fresh(seed = 1400, name = "North") {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: name });
  state.run.openingPending = false;
  return state;
}

function clearStory(state) {
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  return state;
}

function readyForDre(day = 4) {
  const state = fresh(1440);
  state.run.day = day;
  state.run.slot = 0;
  state.jobs.discovered = ["wash_go"];
  state.onboarding.shiftsWorked = 3;
  state.onboarding.visitedLocations = ["home", "spenard_streets", "night_owl", "spenard_gym"];
  state.onboarding.metNpcs = ["mara", "cal"];
  state.onboarding.dreEligible = true;
  return C.reduceGame(state, { type: "WORK_JOB", jobId: "wash_go", approach: "work_hard" });
}

test("fresh characters require a valid Street Name and start with only $100 clean cash", () => {
  const creating = C.createRun({ seed: 1 });
  assert.equal(C.reduceGame(creating, { type: "START_RUN" }), creating);
  assert.equal(C.reduceGame(creating, { type: "START_RUN", streetName: "!!!" }), creating);
  const state = C.reduceGame(creating, { type: "START_RUN", streetName: "  Snow Fox  " });
  assert.equal(state.player.streetName, "Snow Fox");
  assert.equal(state.player.cash, 100);
  assert.equal(state.player.cleanCash, 100);
  assert.equal(state.player.dirtyCash, 0);
  assert.equal(state.lender.status, "unoffered");
  assert.equal(state.lender.balance, 0);
  assert.equal(state.run.phase, "week_zero");
  assert.equal(state.run.checkpointDay, null);
});

test("Week Zero progress deduplicates locations and eligible NPCs", () => {
  let state = fresh(2);
  state = C.reduceGame(state, { type: "VIEW_NIGHT_OWL_BOARD" });
  state = C.reduceGame(state, { type: "VIEW_NIGHT_OWL_BOARD" });
  assert.equal(state.onboarding.visitedLocations.filter((id) => id === "night_owl").length, 1);
  state.onboarding.shiftsWorked = 3;
  state.onboarding.visitedLocations = ["home", "night_owl", "spenard_streets", "job:wash_go"];
  state.onboarding.metNpcs = ["mara", "lena"];
  assert.deepEqual(C.selectors.weekZeroProgress(state), { shifts: 3, locations: 4, npcs: 2, ready: true });
  assert.equal(state.onboarding.metNpcs.includes("john"), false);
});

test("Dre approaches on the shift after Week Zero, and Day 4 sets a Day 11 checkpoint", () => {
  const offered = readyForDre(4);
  assert.equal(offered.run.phase, "pressure");
  assert.equal(offered.run.pressureStartedDay, 4);
  assert.equal(offered.run.checkpointDay, 11);
  assert.equal(offered.run.pendingEvent.id, "dre_terms");
  const accepted = C.reduceGame(offered, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(accepted.lender.status, "active");
  assert.equal(accepted.lender.balance, 1200);
  assert.equal(accepted.lender.dueDay, 11);
  assert.equal(accepted.player.dirtyCash >= 1000, true);
});

test("declining Dre is final, starts pressure, and creates no debt", () => {
  const offered = readyForDre(4);
  const declined = C.reduceGame(offered, { type: "RESOLVE_EVENT", choiceIndex: 2 });
  assert.equal(declined.run.phase, "pressure");
  assert.equal(declined.run.checkpointDay, 11);
  assert.equal(declined.lender.status, "declined");
  assert.equal(declined.lender.balance, 0);
  assert.equal(declined.lender.dueDay, null);
});

test("Week Zero suppresses automatic Dre, Rook, collector, and ending beats", () => {
  const state = fresh(5);
  state.run.day = 9;
  state.lender.status = "active";
  state.lender.balance = 900;
  state.lender.principal = 1000;
  state.lender.dueDay = 2;
  const ids = C.storyCandidatesForTest(state, { reason: "END_DAY" }).map((item) => item.id);
  assert.equal(ids.some((id) => id.startsWith("dre_") || id.startsWith("rook_") || id === "dre_collector"), false);
  state.run.slot = 2;
  const next = C.advanceRun(state, { reason: "END_MARKET", suppressStory: false });
  assert.equal(next.lender.balance, 900);
  assert.equal(next.lender.collectorTier, 0);
});

test("Night actions defer nightly processing until one confirmed rollover", () => {
  let state = fresh(6);
  state.run.slot = 3;
  state.player.energy = 2;
  const marketUpdates = state.stats.marketUpdates;
  state = C.reduceGame(state, { type: "BUY_COFFEE" });
  assert.equal(state.run.day, 1);
  assert.equal(state.run.slot, 3);
  assert.equal(state.run.dayEndPending, true);
  assert.equal(state.stats.marketUpdates, marketUpdates);
  assert.equal(state.run.dailyActions.at(-1).label, "Coffee at Night Owl (-$4)");
  const next = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(next.run.day, 2);
  assert.equal(next.run.slot, 0);
  assert.equal(next.player.energy, C.MAX_ENERGY);
  assert.equal(next.stats.marketUpdates, marketUpdates + 1);
  assert.equal(next.run.dailyActions.length, 0);
  assert.equal(C.reduceGame(next, { type: "CONFIRM_END_DAY" }), next);
});

test("One More Thing arms once, costs two Energy, and reopens the gate", () => {
  let state = fresh(7);
  state.run.slot = 3;
  state.player.energy = 3;
  state = C.reduceGame(state, { type: "BUY_COFFEE" });
  state = C.reduceGame(state, { type: "ONE_MORE_THING" });
  assert.equal(state.run.overtimeArmed, true);
  assert.equal(state.run.dayEndPending, false);
  const before = state.player.energy;
  state = C.reduceGame(state, { type: "WANDER_SPENARD" });
  assert.equal(state.player.energy, before - 2);
  assert.equal(state.run.overtimeUsedDay, 1);
  assert.equal(state.run.dayEndPending, true);
  assert.equal(C.reduceGame(state, { type: "ONE_MORE_THING" }), state);
});

test("the dynamic checkpoint ends only after confirmation without exposing another day", () => {
  let state = fresh(8);
  state.run.phase = "pressure";
  state.run.checkpointDay = 3;
  state.run.day = 3;
  state.run.slot = 3;
  state.player.energy = 4;
  state = C.reduceGame(state, { type: "BUY_COFFEE" });
  assert.equal(state.run.status, "playing");
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.run.status, "ended");
  assert.equal(state.run.day, 3);
});

test("legacy v3 saves hydrate directly into pressure with inferred lender state", () => {
  const legacy = JSON.parse(JSON.stringify(fresh(9)));
  delete legacy.run.phase;
  delete legacy.run.pressureStartedDay;
  delete legacy.run.checkpointDay;
  delete legacy.player.energy;
  delete legacy.onboarding;
  legacy.lender.balance = 420;
  delete legacy.lender.status;
  const loaded = C.hydrateRun(legacy);
  assert.equal(loaded.run.phase, "pressure");
  assert.equal(loaded.run.pressureStartedDay, 1);
  assert.equal(loaded.run.checkpointDay, 7);
  assert.equal(loaded.lender.status, "active");
  assert.ok(loaded.onboarding);
  assert.equal(C.SAVE_KEY, "907ogr_v3");
});

test("Night Owl postings rotate deterministically and regulars keep separate relationships", () => {
  let state = fresh(10);
  const boardA = C.selectors.nightOwlBoardItems(state).map((item) => item.id);
  const boardB = C.selectors.nightOwlBoardItems(state).map((item) => item.id);
  assert.deepEqual(boardA, boardB);
  assert.equal(new Set(boardA).size, 3);
  const present = C.selectors.nightOwlRegularFor(state);
  state = C.reduceGame(state, { type: "TALK_NIGHT_OWL_REGULAR", regularId: present.id });
  assert.equal(state.nightOwl.regulars[present.id].relationship, 1);
  assert.equal(state.nightOwl.regulars[present.id === "cal" ? "nia" : "cal"].relationship, 0);
});

test("Cal Level 2 and Lena's third shift both unlock gambling through a scene", () => {
  let cal = fresh(11);
  cal.nightOwl.regulars.cal.relationship = 1;
  cal.run.seed = 11;
  cal.run.day = 1;
  cal.run.slot = 0;
  while (C.selectors.nightOwlRegularFor(cal).id !== "cal") cal.run.slot += 1;
  cal = C.reduceGame(cal, { type: "TALK_NIGHT_OWL_REGULAR", regularId: "cal" });
  assert.equal(cal.run.pendingEvent?.id, "gambling_discovery");
  cal = C.reduceGame(cal, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(cal.world.locations.gamblingKnown, true);

  let lena = fresh(12);
  lena.jobs.discovered = ["wash_go"];
  lena.jobs.records.wash_go.shifts = 2;
  lena.run.slot = 0;
  lena = C.reduceGame(lena, { type: "WORK_JOB", jobId: "wash_go", approach: "socialize" });
  assert.equal(lena.run.pendingEvent?.id, "gambling_discovery");
});

test("907List has three deterministic listings, a three-item cap, and clean resale profit", () => {
  let state = fresh(13);
  state.listings.known = true;
  state.player.cash = 500;
  state.player.cleanCash = 500;
  state.player.dirtyCash = 0;
  const slate = C.selectors.listingSlate(state);
  assert.equal(slate.length, 3);
  assert.equal(new Set(slate.map((item) => item.id)).size, 3);
  for (const item of slate) {
    state = clearStory(C.reduceGame(state, { type: "BUY_907LIST", itemId: item.id }));
  }
  assert.equal(state.listings.inventory.length, 3);
  const blocked = C.reduceGame(state, { type: "BUY_907LIST", itemId: slate[0].id });
  assert.equal(blocked, state);
  const held = state.listings.inventory[0];
  const item = C.LISTING_ITEMS.find((entry) => entry.id === held.itemId);
  const cleanBefore = state.player.cleanCash;
  state = C.reduceGame(state, { type: "SELL_907LIST", inventoryId: held.id });
  const payout = state.player.cleanCash - cleanBefore;
  assert.ok(payout >= item.resale[0] && payout <= item.resale[1]);
  assert.equal(state.listings.inventory.length, 2);
  assert.equal(state.listings.profit, payout - held.cost);
});

test("travel applies a $5 fare unless a pass covers it", () => {
  let state = fresh(14);
  state.world.transport.downtownKnown = true;
  const cash = state.player.cash;
  state = C.reduceGame(state, { type: "BUS_TRAVEL", neighborhoodId: "downtown" });
  assert.equal(state.player.cash, cash - 5);
  assert.equal(state.world.currentNeighborhoodId, "downtown");
  assert.ok(state.onboarding.visitedLocations.includes("downtown"));
  state = clearStory(state);
  state.world.transport.dayPassDay = state.run.day;
  const coveredCash = state.player.cash;
  state = C.reduceGame(state, { type: "BUS_TRAVEL", neighborhoodId: "north_star_lot" });
  assert.equal(state.player.cash, coveredCash);
});

test("UI exposes the three Travel roots, Night Owl hub, 907List, and hidden debt gates", () => {
  const ui = fs.readFileSync(path.join(__dirname, "..", "ui.jsx"), "utf8");
  const travel = ui.slice(ui.indexOf("function Travel("), ui.indexOf("function SpenardBlockCard"));
  assert.equal((travel.match(/<MenuRow title=/g) || []).length, 3);
  for (const label of ["Spenard", "Home", "Leave Spenard"]) assert.match(travel, new RegExp(`title=\\"${label}\\"`));
  assert.match(ui, /function NightOwlHub/);
  assert.match(ui, /nightOwlRegularFor/);
  assert.match(ui, /title="907List"/);
  assert.match(ui, /North Star Garage/);
  assert.match(ui, /hasDreDebt/);
  assert.match(ui, /End the day\?/);
  assert.match(ui, /One More Thing/);
  assert.doesNotMatch(ui, /label="Energy"/);
});
