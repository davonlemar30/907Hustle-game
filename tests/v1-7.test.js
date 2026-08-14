const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

function fresh(seed = 1700) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "North" });
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

function confirmNight(state, day) {
  clearSurfaces(state);
  state.run.day = day;
  state.run.slot = 3;
  state.run.dayEndPending = true;
  return C.reduceGame(state, { type: "CONFIRM_END_DAY" });
}

test("v1.7 removes John and spouse framing from player-facing runtime copy", () => {
  const root = path.join(__dirname, "..");
  const copy = `${fs.readFileSync(path.join(root, "game-core.js"), "utf8")}\n${fs.readFileSync(path.join(root, "ui.jsx"), "utf8")}`;
  const stringLiterals = copy.match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) || [];
  assert.equal(stringLiterals.some((line) => /\bJohn\b|\bspouse\b|\bhusband\b|\bboyfriend\b/i.test(line)), false);
});

test("Yalonda and Juan are known social and personal contacts from game start", () => {
  const state = fresh();
  assert.equal(C.SOCIAL_CONTACTS.yalonda.role, "Landlord");
  assert.equal(C.SOCIAL_CONTACTS.juan.role, "Yalonda's son");
  assert.equal(state.contacts.yalonda.known, true);
  assert.equal(state.contacts.juan.known, true);
  assert.deepEqual(C.selectors.personalContacts(state).map((person) => person.id), ["yalonda", "juan"]);
});

test("household presence is stable within a part of day and favors the intended resident", () => {
  const state = fresh();
  state.run.day = 9;
  state.run.slot = 2;
  assert.equal(C.selectors.householdPresence(state), C.selectors.householdPresence(state));
  const counts = { earlyYalonda: 0, earlyJuan: 0, lateYalonda: 0, lateJuan: 0 };
  for (let day = 1; day <= 200; day += 1) {
    state.run.day = day;
    state.run.slot = 0;
    if (C.selectors.householdPresence(state) === "yalonda") counts.earlyYalonda += 1;
    if (C.selectors.householdPresence(state) === "juan") counts.earlyJuan += 1;
    state.run.slot = 3;
    if (C.selectors.householdPresence(state) === "yalonda") counts.lateYalonda += 1;
    if (C.selectors.householdPresence(state) === "juan") counts.lateJuan += 1;
  }
  assert.ok(counts.earlyYalonda > counts.earlyJuan);
  assert.ok(counts.lateJuan > counts.lateYalonda);
});

test("household talk is free, once daily, and writes to the NPC source of truth", () => {
  const state = fresh(1701);
  let found = false;
  for (let day = 1; day < 30 && !found; day += 1) {
    for (let slot = 0; slot < 4 && !found; slot += 1) {
      state.run.day = day;
      state.run.slot = slot;
      found = C.selectors.householdPresence(state) === "juan";
    }
  }
  const beforeTrust = state.npc.juan.trust;
  const beforeSlot = state.run.slot;
  const talked = C.reduceGame(state, { type: "TALK_HOUSEHOLD", npcId: "juan" });
  assert.equal(talked.run.slot, beforeSlot);
  assert.equal(talked.npc.juan.trust, beforeTrust + 1);
  assert.equal(C.selectors.juanWorkIntelKnown(talked), true);
  assert.equal(talked.run.consequenceQueue.length, 1);
  assert.equal(C.reduceGame(talked, { type: "TALK_HOUSEHOLD", npcId: "juan" }), talked);
});

test("the gym stays hidden until discovered and charges membership only once", () => {
  let state = fresh(1702);
  state.player.cash = 500;
  state.player.cleanCash = 500;
  assert.equal(C.selectors.districtActionAvailability(state, "spenard_gym").visible, false);
  state.discovered.spenardGym = true;
  assert.equal(C.selectors.activityAvailability(state).gym.cost, 55);
  state = C.reduceGame(state, { type: "TRAIN_ATTRIBUTE", attribute: "strength" });
  assert.equal(state.memberships.gym, true);
  assert.equal(state.player.cash, 445);
  clearSurfaces(state);
  assert.equal(C.selectors.activityAvailability(state).gym.cost, 45);
});

test("Night Owl board flyers can reveal the gym but never unlock 907List directly", () => {
  let sawGym = false;
  for (let seed = 1; seed < 50 && !sawGym; seed += 1) {
    let state = fresh(seed);
    state.run.slot = 2;
    if (!C.selectors.nightOwlBoardItems(state).some((item) => item.id === "gym")) continue;
    state = C.reduceGame(state, { type: "VIEW_NIGHT_OWL_BOARD" });
    sawGym = state.discovered.spenardGym;
    assert.equal(state.knowledge.knows907List, false);
  }
  assert.equal(sawGym, true);
});

test("free consequences queue while ordinary time actions stay on their existing result surface", () => {
  let state = fresh(1703);
  let found = false;
  for (let day = 1; day < 30 && !found; day += 1) {
    for (let slot = 0; slot < 4 && !found; slot += 1) {
      state.run.day = day;
      state.run.slot = slot;
      found = C.selectors.householdPresence(state) === "yalonda";
    }
  }
  state = C.reduceGame(state, { type: "TALK_HOUSEHOLD", npcId: "yalonda" });
  assert.equal(state.run.consequenceQueue.length, 1);
  state = C.reduceGame(state, { type: "DISMISS_CONSEQUENCE" });
  clearSurfaces(state);
  state.player.energy = C.MAX_ENERGY;
  state = C.reduceGame(state, { type: "WORK_JOB", jobId: "day_labor", approach: "work_hard" });
  assert.equal(state.run.consequenceQueue.length, 0);
});

test("phone bill grace lasts through Day 9 and service shuts off entering Day 10", () => {
  let state = fresh(1704);
  state = confirmNight(state, 7);
  assert.equal(state.run.day, 8);
  assert.equal(state.phone.daysPastDue, 1);
  assert.equal(state.phone.active, true);
  state = confirmNight(state, 8);
  assert.equal(state.phone.daysPastDue, 2);
  assert.equal(state.phone.active, true);
  state = confirmNight(state, 9);
  assert.equal(state.run.day, 10);
  assert.equal(state.phone.daysPastDue, 3);
  assert.equal(state.phone.active, false);
});

test("walk-in payment restores a dead phone immediately without spending time", () => {
  let state = fresh(1705);
  state.run.day = 10;
  state.run.slot = 0;
  state.phone.active = false;
  state.phone.daysPastDue = 3;
  state.phone.heldInbox = [{ id: "held", from: "Juan", text: "Call me.", day: 9, slot: 3, read: false }];
  state.player.cash = 200;
  state.player.cleanCash = 200;
  state = C.reduceGame(state, { type: "PAY_PHONE_BILL", surface: "store" });
  assert.equal(state.run.slot, 0);
  assert.equal(state.phone.active, false);
  assert.equal(state.phone.reactivateAtSlot != null, true);
  state.run.consequenceQueue = [];
  state = C.advanceRun(state, { reason: "END_MARKET", suppressStory: true });
  assert.equal(state.phone.active, true);
  assert.equal(state.phone.heldInbox.length, 0);
  assert.equal(state.phone.inbox.some((message) => message.id === "held"), true);
});

test("907List online payment is free and requires both laptop and live service", () => {
  let state = fresh(1714);
  state.run.day = 7;
  state.knowledge.knows907List = true;
  state.nineZeroSevenList.known = true;
  state.player.cash = 200;
  state.player.cleanCash = 200;
  assert.equal(C.reduceGame(state, { type: "PAY_PHONE_BILL", surface: "online" }), state);
  state.inventory.laptop = true;
  state.phone.active = false;
  assert.equal(C.reduceGame(state, { type: "PAY_PHONE_BILL", surface: "online" }), state);
  state.phone.active = true;
  const paid = C.reduceGame(state, { type: "PAY_PHONE_BILL", surface: "online" });
  assert.equal(paid.run.slot, state.run.slot);
  assert.equal(paid.player.cash, 200 - C.PHONE_BILL);
  assert.equal(paid.phone.billDueDay, 14);
  assert.equal(paid.run.consequenceQueue.length, 1);
});

test("phone shutoff blocks calls and texts, preserves visits, and blocks mobile listings only", () => {
  const state = fresh(1706);
  state.contacts.juan.relationshipLevel = 2;
  state.phone.active = false;
  state.knowledge.knows907List = true;
  state.nineZeroSevenList.known = true;
  assert.equal(C.selectors.contactAvailability(state, "juan", "call").available, false);
  assert.equal(C.selectors.contactAvailability(state, "juan", "text").available, false);
  assert.equal(C.selectors.contactAvailability(state, "juan", "visit").available, true);
  assert.equal(C.selectors.nineZeroSevenListAccess(state, "phone").available, false);
  state.inventory.laptop = true;
  assert.equal(C.selectors.nineZeroSevenListAccess(state, "home").available, true);
});

test("rent misses cool Yalonda's trust and a second missed week enters the warning path", () => {
  let state = fresh(1707);
  const trust = state.npc.yalonda.trust;
  state = confirmNight(state, 7);
  assert.equal(state.npc.yalonda.rentMissed, 1);
  assert.equal(state.npc.yalonda.trust, trust - 1);
  state = confirmNight(state, 14);
  assert.equal(state.npc.yalonda.rentMissed, 2);
  assert.equal(state.people.household.warnings, 1);
});

test("907List is invisible until social discovery and all four authored routes can grant access", () => {
  const hidden = fresh(1708);
  assert.equal(C.selectors.nineZeroSevenListAccess(hidden).visible, false);
  for (const id of ["discover_907_juan", "discover_907_work", "discover_907_night_owl", "discover_907_wander"]) {
    let state = fresh(1708);
    state.run.pendingEvent = C.buildEventForTest(id, state);
    state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
    assert.equal(state.knowledge.knows907List, true, id);
    assert.equal(state.nineZeroSevenList.known, true, id);
  }
});

test("Day 1 yields one discovered employer and Day Labor remains an always-hired fallback", () => {
  let state = fresh(1709);
  assert.deepEqual(state.jobs.discovered, ["day_labor"]);
  assert.equal(C.selectors.jobAvailability(state, "day_labor").available, true);
  state = C.reduceGame(state, { type: "WANDER_SPENARD" });
  clearSurfaces(state);
  const employerCount = state.jobs.discovered.filter((id) => id !== "day_labor").length;
  assert.equal(employerCount, 1);
  state = C.reduceGame(state, { type: "WANDER_SPENARD" });
  assert.equal(state.jobs.discovered.filter((id) => id !== "day_labor").length, 1);
});

test("applications consume one part and mature into explicit offers", () => {
  let state = fresh(1710);
  state.jobs.discovered.push("wash_go");
  state = C.reduceGame(state, { type: "APPLY_JOB", jobId: "wash_go" });
  assert.equal(state.run.slot, 1);
  assert.equal(state.jobs.applications.length, 1);
  assert.equal(state.jobs.hired.includes("wash_go"), false);
  clearSurfaces(state);
  state = C.advanceRun(state, { reason: "END_MARKET", suppressStory: true });
  clearSurfaces(state);
  state = C.advanceRun(state, { reason: "END_MARKET", suppressStory: true });
  assert.equal(state.jobs.applications.length, 0);
  assert.equal(state.jobs.offers.includes("wash_go"), true);
  assert.equal(state.jobs.hired.includes("wash_go"), false);
  assert.equal(state.phone.inbox.some((message) => message.from === "Wash & Go Attendant"), true);
});

test("a dead phone holds an application callback until service returns", () => {
  let state = fresh(1711);
  state.jobs.discovered.push("wash_go");
  state = C.reduceGame(state, { type: "APPLY_JOB", jobId: "wash_go" });
  clearSurfaces(state);
  state.phone.active = false;
  state = C.advanceRun(state, { reason: "END_MARKET", suppressStory: true });
  state = C.advanceRun(clearSurfaces(state), { reason: "END_MARKET", suppressStory: true });
  assert.equal(state.jobs.hired.includes("wash_go"), false);
  assert.equal(state.jobs.applications.length, 1);
  state.phone.active = true;
  state.phone.reactivateAtSlot = null;
  state.phone.heldInbox = [];
  state = C.advanceRun(clearSurfaces(state), { reason: "END_MARKET", suppressStory: true });
  assert.equal(state.phone.active, true);
  assert.equal(state.jobs.offers.includes("wash_go"), true);
});

test("Juan's referral skips the callback delay and creates an explicit offer", () => {
  let state = fresh(1712);
  state.run.pendingEvent = C.buildEventForTest("juan_referral", state);
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(state.jobs.offers.includes("juan_warehouse"), true);
  assert.equal(state.jobs.hired.includes("juan_warehouse"), false);
  assert.equal(state.jobs.discovered.includes("juan_warehouse"), true);
  assert.equal(state.jobs.applications.length, 0);
});

test("Yalonda's personal gate needs trust, a paid week, and a clean route home", () => {
  const descriptor = C.STORY_REGISTRY.find((event) => event.id === "yalonda_flirt");
  const state = fresh(1715);
  state.run.day = 8;
  state.npc.yalonda.trust = 3;
  state.npc.yalonda.rentPaidWeeks = 1;
  state.player.heat = 0;
  let present = false;
  for (let day = 8; day < 40 && !present; day += 1) {
    state.run.day = day;
    for (let slot = 0; slot < 4 && !present; slot += 1) {
      state.run.slot = slot;
      present = C.selectors.householdPresence(state) === "yalonda";
    }
  }
  assert.equal(descriptor.requires(state), true);
  state.player.heat = 2;
  assert.equal(descriptor.requires(state), false);
  state.player.heat = 0;
  state.run.pendingEvent = C.buildEventForTest("yalonda_flirt", state);
  const resolved = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.equal(resolved.npc.yalonda.romanceStage, 1);
  assert.equal(resolved.npc.yalonda.lastEventDay, state.run.day);
});

test("PHONE_INTEL supplies at least six unique lines for every district and part of day", () => {
  for (const area of C.NEIGHBORHOODS) {
    assert.equal(C.PHONE_INTEL[area.id].length, 4);
    for (const pool of C.PHONE_INTEL[area.id]) assert.ok(new Set(pool).size >= 6, `${area.id} has a thin phone pool`);
  }
});

test("v3 saves migrate jobs, household trust, listing knowledge, and terminal states to v5", () => {
  for (const [status, phase] of [["playing", "week_zero"], ["playing", "pressure"], ["ended", "pressure"]]) {
    const raw = JSON.parse(C.serializeRun(fresh(1713)));
    raw.version = 3;
    raw.run.status = status;
    raw.run.phase = phase;
    raw.run.day = phase === "pressure" ? 5 : 2;
    raw.jobs.discovered = ["wash_go"];
    delete raw.jobs.hired;
    delete raw.jobs.applications;
    raw.people.household.yalondaTrust = 4;
    raw.people.household.johnTrust = 3;
    raw.nineZeroSevenList.known = true;
    delete raw.npc;
    delete raw.phone;
    delete raw.knowledge;
    delete raw.discovered;
    delete raw.memberships;
    delete raw.obligations;
    const loaded = C.hydrateRun(raw);
    assert.equal(loaded.version, 5);
    assert.equal(loaded.run.status, status);
    assert.equal(loaded.npc.yalonda.trust, 4);
    assert.equal(loaded.knowledge.knows907List, true);
    assert.equal(loaded.jobs.offers.includes("wash_go"), false);
    assert.equal(loaded.jobs.hired.includes("day_labor"), true);
    assert.equal(loaded.phone.billDueDay, raw.run.day + 7);
  }
});
