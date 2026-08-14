const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

function fresh(seed = 1500) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "North" });
  state.run.openingPending = false;
  state.run.pendingEvent = null;
  return state;
}
function clear(state) {
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  return state;
}

test("all four starter jobs lead the seeded order across 50 seeds and first Wander guarantees that lead", () => {
  const leaders = new Set();
  for (let seed = 1; seed <= 50; seed += 1) {
    let state = fresh(seed);
    assert.deepEqual(new Set(state.jobs.discoveryOrder), new Set(C.STARTER_JOB_IDS));
    assert.equal(state.jobs.discoveryOrder.length, 4);
    leaders.add(state.jobs.discoveryOrder[0]);
    state = C.reduceGame(state, { type: "WANDER_SPENARD" });
    assert.deepEqual(state.jobs.discovered, ["day_labor", state.jobs.discoveryOrder[0]], `seed ${seed}`);
  }
  assert.deepEqual(leaders, new Set(C.STARTER_JOB_IDS));
});

test("starter shifts prioritize unseen coworkers and any third shift can refer the gambling game", () => {
  for (const jobId of C.STARTER_JOB_IDS) {
    let state = fresh(1600 + C.STARTER_JOB_IDS.indexOf(jobId));
    state.jobs.discovered = ["day_labor", jobId]; state.jobs.hired = ["day_labor", jobId]; state.jobs.activeJobId = jobId;
    const seen = [];
    for (let shift = 1; shift <= 3; shift += 1) {
      clear(state);
      state.run.day = shift;
      state.run.slot = 0;
      state.jobs.lastScheduledShiftDay = null;
      state = C.reduceGame(state, { type: "WORK_JOB", jobId, approach: "socialize" });
      seen.push(state.jobs.records[jobId].currentCoworkerId);
    }
    assert.equal(new Set(seen.slice(0, 2)).size, 2, jobId);
    assert.equal(state.jobs.records[jobId].coworkersMet.length, 2, jobId);
    assert.equal(state.run.pendingEvent?.id, "gambling_discovery", jobId);
    assert.equal(state.onboarding.shiftsWorked, 3, jobId);
  }
});

test("social contacts enforce tiers, free call and text, and one visit relationship gain per day", () => {
  let state = fresh(1700);
  state.contacts.lena.known = true;
  const before = [state.run.day, state.run.slot];
  state = C.reduceGame(state, { type: "CONTACT_CALL", npcId: "lena" });
  assert.deepEqual([state.run.day, state.run.slot], before);
  assert.equal(state.run.pendingEvent.id, "contact_lena_call_1");
  clear(state);
  assert.equal(C.selectors.contactAvailability(state, "lena", "text").available, false);
  assert.equal(C.selectors.contactAvailability(state, "lena", "visit").available, false);
  state.contacts.lena.relationshipLevel = 2;
  state = C.reduceGame(state, { type: "CONTACT_TEXT", npcId: "lena" });
  assert.deepEqual([state.run.day, state.run.slot], before);
  clear(state);
  const firstDay = state.run.day;
  state = C.reduceGame(state, { type: "CONTACT_VISIT", npcId: "lena" });
  assert.equal(state.contacts.lena.relationshipLevel, 3);
  assert.equal(state.contacts.lena.lastVisitDay, firstDay);
  clear(state);
  state.run.day = firstDay;
  state = C.reduceGame(state, { type: "CONTACT_VISIT", npcId: "lena" });
  assert.equal(state.contacts.lena.relationshipLevel, 3);
});

test("each contact has three seeded variants for call, text, and visit", () => {
  for (const npcId of Object.keys(C.SOCIAL_CONTACTS)) {
    for (const type of ["CALL", "TEXT", "VISIT"]) {
      const descriptions = new Set();
      for (let day = 1; day <= 30; day += 1) {
        let state = fresh(1750);
        state.run.day = day;
        const person = C.SOCIAL_CONTACTS[npcId];
        const job = person.jobId && C.SPENARD_JOBS.find((entry) => entry.id === person.jobId);
        state.run.slot = person.location === "night_owl" ? 2 : job ? job.slots[0] : 2;
        state.contacts[npcId].known = true;
        state.contacts[npcId].relationshipLevel = 2;
        state = C.reduceGame(state, { type: `CONTACT_${type}`, npcId });
        descriptions.add(state.run.pendingEvent?.description);
      }
      descriptions.delete(undefined);
      assert.equal(descriptions.size, 3, `${npcId} ${type}`);
    }
  }
});

test("first true feature unlocks queue once and acknowledgements preserve FIFO order", () => {
  let state = C.reduceGame(fresh(1800), { type: "SHOPLIFT", roll: 0 });
  assert.deepEqual(state.run.pendingUnlocks, ["boost"]);
  state = C.reduceGame(state, { type: "SHOPLIFT", roll: 0 });
  assert.deepEqual(state.run.pendingUnlocks, ["boost"]);
  state.run.pendingUnlocks.push("gambling", "market");
  state = C.reduceGame(state, { type: "DISMISS_TAB_UNLOCK" });
  assert.deepEqual(state.run.pendingUnlocks, ["gambling", "market"]);
  state = C.reduceGame(state, { type: "DISMISS_TAB_UNLOCK" });
  assert.deepEqual(state.run.pendingUnlocks, ["market"]);
});

test("Rob uses the canonical action and migrates successful robbery history to a celebrated visible tab", () => {
  let success = null;
  for (let seed = 1; seed <= 100 && !success; seed += 1) {
    const state = fresh(seed);
    state.player.cash = 0;
    state.player.cleanCash = 0;
    state.player.dirtyCash = 0;
    const attempt = C.reduceGame(state, { type: "ROB" });
    if (attempt.stats.robbery.successes) success = attempt;
  }
  assert.ok(success);
  assert.equal(success.rob.visible, true);
  assert.deepEqual(success.run.pendingUnlocks, ["rob"]);

  const legacy = JSON.parse(C.serializeRun(fresh(1810)));
  delete legacy.rob;
  delete legacy.flags.unlockCelebrations;
  delete legacy.run.pendingUnlocks;
  legacy.stats.robbery = { attempts: 1, successes: 1, failures: 0, totalPayout: 90, lastAttemptedDay: 1 };
  const loaded = C.hydrateRun(legacy);
  assert.equal(loaded.rob.visible, true);
  assert.equal(loaded.flags.unlockCelebrations.rob, true);
  assert.deepEqual(loaded.run.pendingUnlocks, []);
  const source = fs.readFileSync(path.join(__dirname, "..", "game-core.js"), "utf8");
  for (const stale of [["QUICK", "SCORE"].join("_"), ["Quick", "Score"].join(" "), ["robbery", "Availability"].join(""), ["execute", "Robbery"].join("")]) assert.equal(source.includes(stale), false, stale);
});

test("Night Owl reducers reject Morning and Afternoon and open at dusk", () => {
  let state = fresh(1900);
  state.player.cash = 500;
  state.run.slot = 0;
  const regular = C.selectors.nightOwlRegularFor(state);
  for (const action of [
    { type: "VIEW_NIGHT_OWL_BOARD" },
    { type: "BUY_COFFEE" },
    { type: "TALK_NIGHT_OWL_REGULAR", regularId: regular.id },
    { type: "VISIT_NIGHT_OWL" },
  ]) assert.equal(C.reduceGame(state, action), state, action.type);
  assert.equal(C.selectors.nightOwlAvailability(state).reason, "Opens at dusk.");
  state.run.slot = 2;
  assert.notEqual(C.reduceGame(state, { type: "VIEW_NIGHT_OWL_BOARD" }), state);
});

test("Downtown shows two seeded once-per-run arrivals and always supports the return flow", () => {
  let state = fresh(2000);
  state.player.cash = 100;
  const ids = [];
  for (let visit = 0; visit < 3; visit += 1) {
    state = clear(state);
    state.run.day = visit + 1;
    state.run.slot = 0;
    state = C.reduceGame(state, { type: "BUS_TRAVEL", neighborhoodId: "downtown" });
    if (state.run.pendingEvent) ids.push(state.run.pendingEvent.id);
    clear(state);
    state = C.reduceGame(state, { type: "BUS_TRAVEL", neighborhoodId: "north_star_lot" });
  }
  assert.equal(new Set(ids).size, 2);
  assert.deepEqual(state.world.locations.downtownAmbientSeen.sort(), [0, 1]);
  assert.deepEqual(C.DOWNTOWN_CONTENT_STUBS, ["circle_k", "fourth_avenue_bars", "rei"]);
});

// v1.9b: the board refreshes daily at every tier, and the laptop buys detail and
// reach rather than a second surface with more rows.
test("the board refreshes daily and the laptop takes the player from two blind listings to four detailed ones", () => {
  const state = fresh(2100);
  state.nineZeroSevenList.known = true;
  state.knowledge.knows907List = true;
  const day1 = C.selectors.listingSlate(state, "phone").map((item) => item.id);
  assert.equal(day1.length, 2);
  state.run.day = 2;
  assert.notDeepEqual(C.selectors.listingSlate(state, "phone").map((item) => item.id), day1);

  state.inventory.laptop = true;
  assert.equal(C.selectors.marketTier(state), 2);
  const flipper = C.selectors.listingSlate(state, "phone");
  assert.equal(flipper.length, 4);
  for (const listing of flipper) {
    assert.ok(listing.conditionLabel, `${listing.id} should show condition at Flipper tier`);
    assert.ok(listing.reliabilityLabel, `${listing.id} should show seller reliability at Flipper tier`);
  }
  // The laptop is also what makes a Downtown seller willing to meet.
  assert.deepEqual(C.selectors.marketTierConfig(state).districts, ["north_star_lot", "downtown"]);
  assert.deepEqual(state.nineZeroSevenList.alerts, { enabled: false, subscriptions: [] });
});

test("Night Owl laptop offers require reading a rotating board that contains the listing", () => {
  let state = fresh(2150);
  state.player.cash = 500;
  state.run.slot = 2;
  while (!C.selectors.nightOwlBoardItems(state).some((entry) => entry.id === "laptop")) state.run.day += 1;
  assert.equal(C.reduceGame(state, { type: "BUY_LAPTOP" }), state);
  state = C.reduceGame(state, { type: "VIEW_NIGHT_OWL_BOARD" });
  state = clear(state);
  state = C.reduceGame(state, { type: "BUY_LAPTOP" });
  assert.equal(state.inventory.laptop, true);
  assert.equal(state.player.cash, 250);
});

test("legacy jobs, relationships, listings, and unlocked features hydrate additively", () => {
  const legacy = JSON.parse(C.serializeRun(fresh(2200)));
  legacy.jobs.discovered = ["wash_go"];
  legacy.jobs.records.wash_go.contactMet = true;
  legacy.jobs.records.wash_go.relationship = 4;
  delete legacy.jobs.discoveryOrder;
  delete legacy.contacts;
  legacy.listings = { known: true, inventory: [], purchases: 2, sales: 1, profit: 25 };
  delete legacy.nineZeroSevenList;
  legacy.market.visible = true;
  delete legacy.flags.unlockCelebrations;
  const loaded = C.hydrateRun(legacy);
  assert.equal(loaded.jobs.discoveryOrder.length, 4);
  assert.equal(loaded.contacts[loaded.jobs.records.wash_go.coworkersMet[0]].relationshipLevel, 4);
  assert.equal(loaded.nineZeroSevenList.known, true);
  assert.equal(loaded.nineZeroSevenList.profit, 25);
  assert.equal(loaded.flags.unlockCelebrations.market, true);
  assert.deepEqual(loaded.run.pendingUnlocks, []);
});
