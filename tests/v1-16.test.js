const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Arrest = require("../src/data/arrest.js");
const root = path.join(__dirname, "..");
const uiSource = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const coreSource = fs.readFileSync(path.join(root, "game-core.js"), "utf8");

// v1.16 - Caught & Consequences.
// The arrest funnel, the permanent record, crew jail and bail, and the boost
// caught-state (fight / run / surrender) delivered through the consequence
// encounter engine.

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Sixteen" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  return structuredClone(state);
}

// The boost track needs its unlock, a target the player is allowed to hit, and
// a garage to keep crew in. Mirrors tests/boost-track.js's openTier.
function openBoost(seed, tier = 1) {
  const state = fresh(seed);
  state.boost.visible = true;
  state.boost.technique = tier === 1 ? 0 : tier === 2 ? 6 : 14;
  state.world.currentNeighborhoodId = "north_star_lot";
  state.run.day = 3;
  state.run.slot = 0;
  state.player.cash = 600;
  state.player.cleanCash = 600;
  state.player.dirtyCash = 0;
  return state;
}

function withCrew(state, crewId = "tone", overrides = {}) {
  Object.assign(state.people.crew[crewId], {
    introduced: true, recruited: true, status: "active", tier: 1,
    loyalty: 6, wageDue: 0, recruitedDay: state.run.day, wageMissedSince: null,
    ...overrides,
  });
  return state;
}

// --- Data module ------------------------------------------------------------

test("bail scales with severity and with priors, and tops out", () => {
  assert.ok(Arrest.bailFor("boost1", 0) < Arrest.bailFor("stick1", 0));
  assert.ok(Arrest.bailFor("stick1", 0) < Arrest.bailFor("stick3", 0));
  assert.ok(Arrest.bailFor("stick3", 0) < Arrest.bailFor("stick3", 1));
  assert.ok(Arrest.bailFor("stick3", 1) < Arrest.bailFor("stick3", 3));
  // Past the table the multiplier stops climbing rather than running away.
  assert.equal(Arrest.bailFor("boost1", 9), Arrest.bailFor("boost1", Arrest.PRIOR_MULTIPLIER.length - 1));
  // An unknown severity falls back rather than returning NaN.
  assert.equal(Arrest.bailFor("nonsense", 0), Arrest.bailFor("encounter", 0));
});

test("processing time grows with severity and priors but never exceeds a day", () => {
  assert.ok(Arrest.processingSlotsFor("stick3", 0) > Arrest.processingSlotsFor("boost1", 0));
  assert.ok(Arrest.processingSlotsFor("boost1", 4) > Arrest.processingSlotsFor("boost1", 0));
  assert.equal(Arrest.processingSlotsFor("stick3", 40), Arrest.MAX_PROCESSING_SLOTS);
});

test("heat relief is ordered by severity so cheap offenses cannot farm heat dumps", () => {
  const order = ["boost1", "boost2", "stick1", "stick2", "stick3"];
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(Arrest.heatReliefFor(order[i]) >= Arrest.heatReliefFor(order[i - 1]));
  }
  assert.ok(Arrest.heatReliefFor("stick3") > Arrest.heatReliefFor("boost1"));
});

test("unpaid bail converts to whole parts of day", () => {
  assert.equal(Arrest.shortfallSlots(0), 0);
  assert.equal(Arrest.shortfallSlots(-50), 0);
  assert.equal(Arrest.shortfallSlots(1), 1);
  assert.equal(Arrest.shortfallSlots(Arrest.SHORTFALL_PER_SLOT * 2), 2);
});

// --- State and hydration ----------------------------------------------------

test("the record is additive: schema stays at v11 and old saves default into it", () => {
  assert.equal(C.VERSION, 11);
  assert.equal(C.SAVE_KEY, "907ogr_v11");
  const state = fresh(1601);
  assert.deepEqual(state.record, { arrests: 0, lastArrestDay: null, charges: [] });
  assert.equal(state.people.crew.tone.jailedUntilDay, null);
  assert.equal(state.boost.pendingCaught, null);
});

test("v3 through v11 saves all hydrate and gain the record with no migration pass", () => {
  for (const version of [3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const legacy = JSON.parse(C.serializeRun(fresh(2000 + version)));
    legacy.version = version;
    delete legacy.record;
    if (legacy.people?.crew?.tone) delete legacy.people.crew.tone.jailedUntilDay;
    const hydrated = C.hydrateRun(legacy);
    assert.ok(hydrated, `v${version} failed to hydrate`);
    assert.equal(hydrated.record.arrests, 0, `v${version} lost the record default`);
    assert.deepEqual(hydrated.record.charges, []);
    assert.equal(hydrated.people.crew.tone.jailedUntilDay, null);
  }
});

// --- Stick arrests ----------------------------------------------------------

test("an arrest charges bail, clears heat, and writes the record", () => {
  let state = openBoost(1610);
  state.player.heat = 10;
  state.player.cash = 1000;
  state.player.cleanCash = 1000;
  // Route through the boost caught-state, which is the funnel's live call site.
  state.boost.pendingCaught = null;
  const target = C.BOOST_TARGETS.find((item) => item.tier === 1);
  state = C.reduceGame(state, { type: "BOOST", targetId: target.id, roll: 1 });
  assert.equal(state.run.pendingEncounter?.type, "boost_caught");
  const heatBefore = state.player.heat;
  const cashBefore = state.player.cash;
  state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: "fight" });
  const outcome = state.run.pendingEncounter.result.outcome;
  if (outcome === "boost_fight_loss") {
    assert.equal(state.record.arrests, 1);
    assert.equal(state.record.charges[0].source, "boost");
    assert.ok(["boost1", "boost2"].includes(state.record.charges[0].severity));
    assert.equal(state.record.lastArrestDay, state.run.day);
    assert.ok(state.player.cash < cashBefore, "bail should have been charged");
    assert.ok(state.player.heat < heatBefore + 3, "heat relief should have offset the bust");
  } else {
    assert.equal(state.record.arrests, 0);
    assert.ok(state.player.heat >= heatBefore);
  }
});

test("a broke player serves time instead of paying and is never soft-locked", () => {
  let state = openBoost(1611);
  state.player.heat = 12;
  state.player.cash = 0;
  state.player.cleanCash = 0;
  state.player.dirtyCash = 0;
  const target = C.BOOST_TARGETS.find((item) => item.tier === 1);
  state = C.reduceGame(state, { type: "BOOST", targetId: target.id, roll: 1 });
  assert.equal(state.run.pendingEncounter?.type, "boost_caught");
  state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: "fight" });
  const arrested = state.run.pendingEncounter.result.outcome === "boost_fight_loss";
  assert.equal(state.player.cash, 0);
  if (arrested) assert.ok(state.run.pendingArrestSlots > 0, "unpaid bail should owe time");
  // The dismissal always resolves - no state where the player cannot continue.
  const day = state.run.day, slot = state.run.slot;
  state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: "continue" });
  assert.equal(state.run.pendingEncounter, null);
  assert.ok(state.run.status === "playing" || state.run.status === "ended");
  if (arrested && state.run.status === "playing") {
    assert.ok(state.run.day > day || state.run.slot > slot, "processing should have eaten clock");
  }
});

test("priors make the next arrest dearer", () => {
  const first = Arrest.bailFor("boost1", 0);
  const second = Arrest.bailFor("boost1", 1);
  const third = Arrest.bailFor("boost1", 2);
  assert.ok(second > first && third > second);
});

// --- Boost caught-state -----------------------------------------------------

test("a failed boost opens the three-option caught state at every tier", () => {
  for (const tier of [1, 2, 3]) {
    let state = openBoost(1620 + tier, tier);
    const target = C.selectors.visibleBoostTargets(state).find((item) => item.tier === tier)
      || C.BOOST_TARGETS.find((item) => item.tier === tier);
    if (tier === 3) {
      state = withCrew(state, "tone");
      state.base.controlled = true;
      state.boost.crewAssigned = "tone";
    }
    state.boost.dailyHits = {};
    const next = C.reduceGame(state, { type: "BOOST", targetId: target.id, roll: 1 });
    if (next === state) continue; // gated target at this tier; the other tiers cover it
    assert.equal(next.run.pendingEncounter?.type, "boost_caught", `tier ${tier} did not open the scene`);
    const ids = C.selectors.encounterChoices(next).map((choice) => choice.id);
    assert.deepEqual(ids, ["fight", "run", "surrender"], `tier ${tier} choices wrong`);
    assert.equal(next.run.pendingEncounter.boost.tier, tier);
  }
});

test("opponent difficulty scales by tier", () => {
  const EncounterSystem = require("../encounters.js");
  const one = EncounterSystem.BOOST_OPPONENTS[1];
  const two = EncounterSystem.BOOST_OPPONENTS[2];
  const three = EncounterSystem.BOOST_OPPONENTS[3];
  assert.ok(one.fight > two.fight && two.fight > three.fight);
  assert.ok(one.flee > two.flee && two.flee > three.flee);
  assert.ok(three.lossDamage[1] > one.lossDamage[1]);
});

test("surrender costs the take and the store, and nothing else", () => {
  let state = openBoost(1630);
  state.player.heat = 4;
  const target = C.BOOST_TARGETS.find((item) => item.tier === 1);
  state = C.reduceGame(state, { type: "BOOST", targetId: target.id, roll: 1 });
  assert.equal(state.run.pendingEncounter?.type, "boost_caught");
  const heat = state.player.heat, health = state.player.health, cash = state.player.cash;
  state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: "surrender" });
  assert.equal(state.run.pendingEncounter.result.outcome, "boost_surrender");
  assert.equal(state.player.heat, heat, "surrender must not add heat");
  assert.equal(state.player.health, health, "surrender must not cost health");
  assert.equal(state.player.cash, cash, "surrender must not cost cash");
  assert.equal(state.record.arrests, 0, "surrender must not arrest");
  assert.ok(state.boost.storeBans.includes(target.id), "surrender still bans the store");
});

test("winning the fight keeps the take; losing it bans, hurts, and books you", () => {
  let fightWin = null, fightLoss = null;
  for (let seed = 1700; seed < 1760 && (!fightWin || !fightLoss); seed += 1) {
    let state = openBoost(seed);
    state.player.heat = 9;
    const target = C.BOOST_TARGETS.find((item) => item.tier === 1);
    const opened = C.reduceGame(state, { type: "BOOST", targetId: target.id, roll: 1 });
    if (opened.run.pendingEncounter?.type !== "boost_caught") continue;
    const take = opened.run.pendingEncounter.boost.take;
    const before = { cash: opened.player.cash, health: opened.player.health, bans: [...opened.boost.storeBans] };
    const done = C.reduceGame(opened, { type: "RESOLVE_ENCOUNTER", choiceId: "fight" });
    const outcome = done.run.pendingEncounter.result.outcome;
    if (outcome === "boost_fight_win" && !fightWin) fightWin = { done, before, take, target };
    if (outcome === "boost_fight_loss" && !fightLoss) fightLoss = { done, before, take, target };
  }
  assert.ok(fightWin, "no fight win found across 60 seeds");
  assert.ok(fightLoss, "no fight loss found across 60 seeds");
  // Win: goods kept, no ban, health paid.
  assert.equal(fightWin.done.player.cash, fightWin.before.cash + fightWin.take);
  assert.ok(!fightWin.done.boost.storeBans.includes(fightWin.target.id));
  assert.ok(fightWin.done.player.health < fightWin.before.health, "a win still costs health");
  assert.equal(fightWin.done.record.arrests, 0);
  // Loss: ban, damage, arrest.
  assert.ok(fightLoss.done.boost.storeBans.includes(fightLoss.target.id));
  assert.ok(fightLoss.done.player.health < fightLoss.before.health);
  assert.equal(fightLoss.done.record.arrests, 1);
  assert.equal(fightLoss.done.record.charges[0].source, "boost");
});

test("every caught-state outcome writes an exposure row", () => {
  for (const choiceId of ["fight", "run", "surrender"]) {
    let state = openBoost(1780);
    state.player.heat = 5;
    const target = C.BOOST_TARGETS.find((item) => item.tier === 1);
    state = C.reduceGame(state, { type: "BOOST", targetId: target.id, roll: 1 });
    assert.equal(state.run.pendingEncounter?.type, "boost_caught");
    const before = C.EXPOSURE_NPC_IDS.reduce((sum, id) => sum + (state.npc[id].ledger || []).length, 0)
      + (state.run.pendingObservations || []).length;
    const done = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId });
    const after = C.EXPOSURE_NPC_IDS.reduce((sum, id) => sum + (done.npc[id].ledger || []).length, 0)
      + (done.run.pendingObservations || []).length;
    assert.ok(after >= before, `${choiceId} lost observation rows`);
    assert.ok(done.run.pendingEncounter.result.outcome.startsWith("boost_"), `${choiceId} produced no boost outcome`);
  }
});

test("the caught state clears its handoff and boostArrestRisk on settle", () => {
  let state = openBoost(1790);
  state.player.heat = 9;
  const target = C.BOOST_TARGETS.find((item) => item.tier === 1);
  state = C.reduceGame(state, { type: "BOOST", targetId: target.id, roll: 1 });
  assert.equal(state.flags.boostArrestRisk, true, "heat above 6 arms the escalation flag");
  state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: "surrender" });
  assert.equal(state.flags.boostArrestRisk, false);
  assert.equal(state.boost.pendingCaught, null);
});

// --- Crew jail and bail -----------------------------------------------------

test("a jailed crew member leaves the active roster and carries a release date", () => {
  let state = openBoost(1800, 3);
  state = withCrew(state, "tone");
  state.base.controlled = true;
  const before = C.selectors.recruitedCrew(state).length;
  state.boost.crewAssigned = "tone";
  const target = C.BOOST_TARGETS.find((item) => item.tier === 3);
  state = C.reduceGame(state, { type: "BOOST", targetId: target.id, roll: 1, crewCaughtRoll: 0 });
  const crew = state.people.crew.tone;
  assert.equal(crew.status, "arrested");
  assert.equal(crew.jailedSeverity, "boost2");
  assert.equal(crew.jailedUntilDay, state.run.day + Arrest.crewJailDaysFor("boost2"));
  assert.equal(state.flags.crewBailPending, "tone");
  assert.equal(state.boost.crewAssigned, null);
  assert.equal(C.selectors.recruitedCrew(state).length, before - 1);
});

test("BAIL_CREW restores an arrested member and is rejected without the cash", () => {
  let state = openBoost(1810);
  state = withCrew(state, "tone", { status: "arrested", jailedUntilDay: state.run.day + 3, jailedSeverity: "stick2", loyalty: 6 });
  state.flags.crewBailPending = "tone";
  const cost = C.selectors.crewBailAvailability(state, "tone").cost;
  assert.equal(cost, Arrest.crewBailFor("stick2"));

  const broke = structuredClone(state);
  broke.player.cash = cost - 1;
  broke.player.cleanCash = cost - 1;
  broke.player.dirtyCash = 0;
  assert.equal(C.selectors.crewBailAvailability(broke, "tone").available, false);
  assert.equal(C.reduceGame(broke, { type: "BAIL_CREW", crewId: "tone" }), broke);

  state.player.cash = cost + 50;
  state.player.cleanCash = cost + 50;
  state.player.dirtyCash = 0;
  const paid = C.reduceGame(state, { type: "BAIL_CREW", crewId: "tone" });
  assert.equal(paid.people.crew.tone.status, "active");
  assert.equal(paid.people.crew.tone.jailedUntilDay, null);
  assert.equal(paid.people.crew.tone.loyalty, 5, "bailing costs one point of loyalty");
  assert.equal(paid.player.cash, 50);
  assert.equal(paid.flags.crewBailPending, null);
});

test("bailing a member out never itself drops them to departure", () => {
  let state = openBoost(1815);
  state = withCrew(state, "tone", { status: "arrested", jailedUntilDay: state.run.day + 2, jailedSeverity: "boost1", loyalty: 1 });
  state.player.cash = 5000;
  state.player.cleanCash = 5000;
  const paid = C.reduceGame(state, { type: "BAIL_CREW", crewId: "tone" });
  assert.equal(paid.people.crew.tone.loyalty, 1);
  assert.equal(paid.people.crew.tone.status, "active");
});

test("nobody comes: the sentence runs out and loyalty lands at 1", () => {
  let state = openBoost(1820);
  state = withCrew(state, "tone", { status: "arrested", jailedUntilDay: state.run.day + 1, jailedSeverity: "boost1", loyalty: 8 });
  state.run.slot = 3;
  state.run.dayEndPending = true;
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  const crew = state.people.crew.tone;
  assert.equal(crew.status, "active");
  assert.equal(crew.loyalty, Arrest.CREW_LOYALTY_AFTER_SERVED);
  assert.equal(crew.jailedUntilDay, null);
  assert.ok(!state.flags.crewBailPending);
});

test("a legacy arrested record with no release date is repaired rather than stranded", () => {
  let state = openBoost(1830);
  state = withCrew(state, "tone", { status: "arrested", jailedUntilDay: null, loyalty: 7 });
  state.run.slot = 3;
  state.run.dayEndPending = true;
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.people.crew.tone.status, "active");
});

// --- Stubs are gone ---------------------------------------------------------

test("the v1.13 stick arrest stub and the dead boostArrestRisk flag are both gone", () => {
  assert.ok(!coreSource.includes("TODO: replace with the full arrest system"));
  // The flag is read now, not only written.
  const reads = coreSource.split("state.flags.boostArrestRisk").length - 1;
  assert.ok(reads >= 3, "boostArrestRisk should be written, read, and cleared");
  assert.ok(coreSource.includes("arrestPlayer(base, { severity: `stick${target.tier}`"), "all three stick tiers route through arrestPlayer");
});

// --- UI ---------------------------------------------------------------------

test("the Character screen shows the record and the crew page offers bail", () => {
  assert.ok(uiSource.includes("arrestRecord"), "Character screen must read the record");
  assert.ok(uiSource.includes("BAIL_CREW"), "crew detail must dispatch BAIL_CREW");
  assert.ok(uiSource.includes("crewBailAvailability"), "the bail button must read the availability selector");
});

test("the built bundle is current with ui.jsx and encounters.js", () => {
  const built = fs.readFileSync(path.join(root, "ui.built.js"), "utf8");
  assert.ok(built.includes("BAIL_CREW"), "run npm run build - ui.built.js is stale");
  assert.ok(built.includes("boost_caught"), "run npm run build - ui.built.js is stale");
});
