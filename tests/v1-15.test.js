const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Crew = require("../src/data/crew.js");
const CurtisAwareness = require("../src/data/curtis-awareness.js");
const { stringHash } = require("../src/events/random.js");
const { putInBand } = require("./exposure-helpers.js");
const root = path.join(__dirname, "..");
const uiSource = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const encountersSource = fs.readFileSync(path.join(root, "encounters.js"), "utf8");

// v1.15 — Crew System + Curtis Ambient Pressure + Deshawn Tier 1.
// Wage auto-deduction, 0-10 loyalty with departures, the curtisAwareness
// tracker with watcher flavor, and Deshawn's recruitment scene, de-escalation,
// weekly introductions, and rent grace.

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Fifteen" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  return structuredClone(state);
}

function prepareNight(state, day = 5) {
  state.run.phase = "pressure";
  state.run.checkpointDay = day + 10;
  state.run.day = day;
  state.run.slot = 3;
  state.run.dayEndPending = true;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  return state;
}

function withDeshawn(state, overrides = {}) {
  Object.assign(state.people.crew.deshawn, {
    introduced: true, recruited: true, status: "active", tier: 1,
    loyalty: 5, wageDue: 0, recruitedDay: state.run.day, wageMissedSince: null,
    ...overrides,
  });
  return state;
}

// --- Schema and migration ---------------------------------------------------

test("v1.15 owns save version 11 and the v10 key joins the legacy list", () => {
  assert.equal(C.VERSION, 11);
  assert.equal(C.SAVE_KEY, "907ogr_v11");
  assert.ok(C.LEGACY_SAVE_KEYS.includes("907ogr_v10"));
  const state = fresh(4200);
  assert.equal(state.version, 11);
  assert.deepEqual(state.crewMeta, { totalWagesPaid: 0 });
  assert.equal(state.curtisAwareness.level, 0);
  assert.equal(state.curtisAwareness.phase, "invisible");
});

test("a v10 save migrates without the lossy legacy pass and rescales crew loyalty", () => {
  const raw = JSON.parse(C.serializeRun(fresh(4201)));
  raw.version = 10;
  raw.player.attributeProgress = { combat: 0.6 };
  raw.jobs.activeJobId = null;
  raw.jobs.hired = ["day_labor"];
  raw.people.crew.pherris.loyalty = 3;
  raw.people.crew.tone.loyalty = -1;
  raw.people.crew.eli.loyalty = 0;
  delete raw.crewMeta;
  delete raw.curtisAwareness;
  const state = C.hydrateRun(raw);
  assert.equal(state.version, 11);
  // The legacy flat pass deletes attributeProgress; a v10 save must keep it.
  assert.equal(state.player.attributeProgress.combat, 0.6);
  // Rescale: clamp(5 + old, 0, 10).
  assert.equal(state.people.crew.pherris.loyalty, 8);
  assert.equal(state.people.crew.tone.loyalty, 4);
  assert.equal(state.people.crew.eli.loyalty, 5);
  // Additive v11 slices default in.
  assert.equal(state.crewMeta.totalWagesPaid, 0);
  assert.equal(state.curtisAwareness.phase, "invisible");
  assert.ok(Array.isArray(state.npc.deshawn.ledger), "deshawn gets a ledger on migration");
});

test("crew records carry recruitedDay and wageMissedSince, loyalty starts at 5", () => {
  const state = fresh(4202);
  for (const person of C.CREW) {
    const crew = state.people.crew[person.id];
    assert.equal(crew.loyalty, Crew.CREW_LOYALTY_START);
    assert.equal(crew.recruitedDay, null);
    assert.equal(crew.wageMissedSince, null);
  }
});

// --- Wages ------------------------------------------------------------------

test("wages auto-deduct at day end, dirty cash first, and are tracked for life", () => {
  let state = fresh(4210);
  withDeshawn(state);
  state.player.cash = 300; state.player.dirtyCash = 200; state.player.cleanCash = 100;
  prepareNight(state, 5);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.player.cash, 250);
  assert.equal(state.player.dirtyCash, 150, "wages come from dirty cash first");
  assert.equal(state.player.cleanCash, 100);
  assert.equal(state.crewMeta.totalWagesPaid, 50);
  assert.equal(state.people.crew.deshawn.wageDue, 0);
});

test("wageFor follows the tier curve for Deshawn and stays flat for others", () => {
  const deshawn = C.CREW.find((person) => person.id === "deshawn");
  const tone = C.CREW.find((person) => person.id === "tone");
  assert.equal(Crew.wageFor(deshawn, 1), 50);
  assert.equal(Crew.wageFor(deshawn, 2), 100);
  assert.equal(Crew.wageFor(deshawn, 3), 200);
  assert.equal(Crew.wageFor(tone, 1), tone.wage);
  assert.equal(Crew.wageFor(tone, 3), tone.wage);
});

test("a short night accrues arrears with two days of grace before loyalty bleeds", () => {
  let state = fresh(4211);
  withDeshawn(state, { recruitedDay: 3 });
  state.player.cash = 0; state.player.dirtyCash = 0; state.player.cleanCash = 0;
  prepareNight(state, 5);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.people.crew.deshawn.wageDue, 50);
  assert.equal(state.people.crew.deshawn.wageMissedSince, 5);
  assert.equal(state.people.crew.deshawn.loyalty, 5, "first missed night is grace");
  state.player.cash = 0; state.player.dirtyCash = 0; state.player.cleanCash = 0;
  prepareNight(state, 6);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.people.crew.deshawn.loyalty, 5, "second missed night is still grace");
  state.player.cash = 0; state.player.dirtyCash = 0; state.player.cleanCash = 0;
  prepareNight(state, 7);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.people.crew.deshawn.loyalty, 4, "grace ends after two days");
  assert.equal(state.people.crew.deshawn.wageDue, 150);
  assert.equal(state.flags.crewUnderpaid, true);
});

test("when cash covers only one wage, the higher-loyalty member gets paid", () => {
  let state = fresh(4212);
  withDeshawn(state, { loyalty: 8 });
  Object.assign(state.people.crew.tone, { introduced: true, recruited: true, status: "active", tier: 1, loyalty: 4, wageDue: 0, recruitedDay: 4, wageMissedSince: null });
  state.player.cash = 60; state.player.dirtyCash = 60; state.player.cleanCash = 0;
  prepareNight(state, 5);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.people.crew.deshawn.wageDue, 0, "loyal crew paid first ($50 of $60)");
  assert.equal(state.people.crew.tone.wageDue, 85, "the shortfall lands on the least loyal");
});

test("loyalty zero means departure: assignments clear and capacity frees", () => {
  let state = fresh(4213);
  withDeshawn(state, { loyalty: 1, wageMissedSince: 2, wageDue: 100, assignment: "smooth_networks" });
  state.player.cash = 0; state.player.dirtyCash = 0; state.player.cleanCash = 0;
  prepareNight(state, 5);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  const crew = state.people.crew.deshawn;
  assert.equal(crew.loyalty, 0);
  assert.equal(crew.status, "departed");
  assert.equal(crew.assignment, null);
  assert.ok(!C.selectors.recruitedCrew(state).some((person) => person.id === "deshawn"));
  assert.ok(!Crew.getActiveCrew(state).some((person) => person.id === "deshawn"));
});

test("PAY_CREW clears arrears and resets the missed-wage clock", () => {
  let state = fresh(4214);
  withDeshawn(state, { wageDue: 100, wageMissedSince: 3 });
  state.base.controlled = true; state.base.visiting = true;
  state.player.cash = 500; state.player.dirtyCash = 500;
  state = C.reduceGame(state, { type: "PAY_CREW", crewId: "deshawn" });
  assert.equal(state.people.crew.deshawn.wageDue, 0);
  assert.equal(state.people.crew.deshawn.wageMissedSince, null);
});

// --- Tier gates -------------------------------------------------------------

test("tier promotion needs loyalty 7 plus five days, then loyalty 9 plus twelve", () => {
  const state = fresh(4220);
  state.run.day = 7;
  withDeshawn(state, { loyalty: 6, recruitedDay: 1 });
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, false, "loyalty 6 blocks tier 2");
  state.people.crew.deshawn.loyalty = 7;
  state.people.crew.deshawn.recruitedDay = 5;
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, false, "two days on the crew blocks tier 2");
  state.people.crew.deshawn.recruitedDay = 1;
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, true, "loyalty 7 and six days opens tier 2");
  // Tier 3: the generic gate plus his own conditions.
  state.people.crew.deshawn.tier = 2;
  state.people.crew.deshawn.loyalty = 9;
  state.people.crew.deshawn.trucesBrokered = 2;
  state.run.day = 14;
  state.world.territoryBlocks.spenard_rec_lot.owner = "player";
  state.world.territoryBlocks.northern_lights_motels.owner = "player";
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, true);
  state.people.crew.deshawn.recruitedDay = 10;
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, false, "tier 3 needs twelve days on the crew");
  // A migrated member with no recruitedDay counts as recruited long ago.
  state.people.crew.deshawn.recruitedDay = null;
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, true);
});

// --- Curtis awareness -------------------------------------------------------

function marketReady(seed) {
  let state = fresh(seed);
  state.run.day = 2;
  state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.dayEndPending = false;
  state.run.slot = 0; state.player.energy = 4;
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.run.pendingEvent?.id, "goodie_corner_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  state.player.cash = 900; state.player.dirtyCash = 900; state.player.cleanCash = 0;
  state.world.markets.north_star_lot.availability.weed = 50;
  state.run.day = 3; state.run.phase = "pressure"; state.run.checkpointDay = 13;
  return state;
}

test("three Spenard market transactions in one day raise awareness once", () => {
  let state = marketReady(4230);
  const before = state.curtisAwareness.level;
  for (let i = 0; i < 4 && state.run.status === "playing"; i += 1) {
    state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.dayEndPending = false;
    state.run.slot = 0; state.player.energy = 4;
    state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  }
  assert.equal(state.curtisAwareness.spenardMarketTxCount >= 3, true);
  assert.equal(state.curtisAwareness.level, before + 1, "three transactions bump once, the fourth does not repeat it");
  assert.equal(state.curtisAwareness.lastCriminalDay, 3);
});

test("quiet days bleed awareness down but never below a reached phase floor", () => {
  let state = fresh(4231);
  Object.assign(state.curtisAwareness, { level: 5, phase: "ambient", floor: 3, quietStreak: 1, lastCriminalDay: 1 });
  prepareNight(state, 4);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.curtisAwareness.level, 4, "second consecutive quiet day starts the decay");
  prepareNight(state, 5);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.curtisAwareness.level, 3);
  prepareNight(state, 6);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.curtisAwareness.level, 3, "the ambient floor holds");
  assert.equal(state.curtisAwareness.phase, "ambient");
});

test("phase thresholds sit at 3/7/11 and each phase message fires exactly once", () => {
  assert.equal(CurtisAwareness.phaseForLevel(0), "invisible");
  assert.equal(CurtisAwareness.phaseForLevel(3), "ambient");
  assert.equal(CurtisAwareness.phaseForLevel(7), "watching");
  assert.equal(CurtisAwareness.phaseForLevel(11), "approaching");
  let state = marketReady(4232);
  Object.assign(state.curtisAwareness, { level: 6, phase: "ambient", floor: 3 });
  for (let i = 0; i < 3 && state.run.status === "playing"; i += 1) {
    state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.dayEndPending = false;
    state.run.slot = 0; state.player.energy = 4;
    state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  }
  assert.equal(state.curtisAwareness.level, 7);
  assert.equal(state.curtisAwareness.phase, "watching");
  assert.equal(state.curtisAwareness.floor, 7, "reaching watching raises the floor");
  const wordMessages = state.phone.inbox.filter((item) => item.from === "Word Around Town");
  assert.equal(wordMessages.length, 1, "one Word Around Town text per phase transition");
  assert.deepEqual(state.curtisAwareness.phaseMessagesSent, ["watching"]);
});

test("watcher encounters follow the seeded roll, cap at one per day, and never repeat within three", () => {
  const seed = fresh(4233).run.seed;
  // The test replicates the exact roll the reducer makes, so the assertion is
  // deterministic: whatever the hash says should happen is what must happen.
  const expectFire = (state, day, slot) => {
    const roll = (stringHash(`${state.run.seed}:curtis:watcher:${day}:${slot}`) % 10000) / 10000;
    return roll < CurtisAwareness.watcherChance(state.curtisAwareness.level);
  };
  let state = fresh(4233);
  Object.assign(state.curtisAwareness, { level: 10, phase: "watching", floor: 7 });
  state.run.phase = "pressure"; state.run.checkpointDay = 20;
  let fired = 0;
  for (let day = 3; day <= 9; day += 1) {
    state.run.day = day; state.run.slot = 0; state.player.energy = 4;
    state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.dayEndPending = false;
    const before = state.curtisAwareness.watchersSeen;
    const shouldFire = expectFire(state, day, 0);
    state = C.reduceGame(state, { type: "WANDER_SPENARD" });
    if (state.run.status !== "playing") break;
    assert.equal(state.curtisAwareness.watchersSeen, before + (shouldFire ? 1 : 0), `day ${day} watcher roll`);
    if (shouldFire) {
      fired += 1;
      // Second qualifying action the same day never fires a second watcher.
      state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.dayEndPending = false;
      state.run.slot = Math.min(3, state.run.slot); state.player.energy = 4;
      const seen = state.curtisAwareness.watchersSeen;
      state = C.reduceGame(state, { type: "WANDER_SPENARD" });
      assert.equal(state.curtisAwareness.watchersSeen, seen, "one watcher per day maximum");
    }
    assert.ok(state.curtisAwareness.recentWatcherLines.length <= 3, "memory holds the last three lines");
    assert.equal(new Set(state.curtisAwareness.recentWatcherLines).size, state.curtisAwareness.recentWatcherLines.length, "no repeats within the last three");
  }
  assert.ok(fired >= 1, `expected at least one watcher across the week (saw ${fired})`);
});

test("watcher probability caps at 0.7 and watchers leave no observation behind", () => {
  assert.equal(CurtisAwareness.watcherChance(0), 0.3);
  assert.equal(CurtisAwareness.watcherChance(10), 0.7);
  assert.equal(CurtisAwareness.watcherChance(15), 0.7);
  let state = fresh(4234);
  Object.assign(state.curtisAwareness, { level: 10, phase: "watching", floor: 7 });
  state.run.phase = "pressure"; state.run.checkpointDay = 20;
  const ledgerBefore = state.npc.curtis.ledger.length;
  for (let day = 3; day <= 6; day += 1) {
    state.run.day = day; state.run.slot = 0; state.player.energy = 4;
    state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.dayEndPending = false;
    state = C.reduceGame(state, { type: "WANDER_SPENARD" });
    if (state.run.status !== "playing") break;
  }
  assert.ok(state.curtisAwareness.watchersSeen >= 1);
  const flavorRows = state.npc.curtis.ledger.length - ledgerBefore;
  assert.equal(flavorRows, 0, "watcher flavor writes nothing to any ledger");
});

// --- Deshawn recruitment gate and offer scene -------------------------------

test("'it was business' permanently blocks recruitment", () => {
  const state = fresh(4240);
  state.run.day = 6;
  state.flags.deshawnBusinessSevered = true;
  assert.equal(C.selectors.deshawnRecruitmentAvailability(state).available, false);
});

test("two Warm-band Spenard ledgers satisfy the clean-path contact gate", () => {
  const state = fresh(4241);
  state.run.day = 6;
  for (const record of Object.values(state.contacts)) { record.known = false; record.relationshipLevel = 0; }
  assert.equal(C.selectors.deshawnRecruitmentAvailability(state).available, false);
  putInBand(state, "mina", C.BANDS.WARM);
  putInBand(state, "juan", C.BANDS.WARM);
  assert.equal(C.selectors.deshawnRecruitmentAvailability(state).available, true);
});

test("inverted lenses never count as vouching contacts", () => {
  const state = fresh(4242);
  state.run.day = 6;
  for (const record of Object.values(state.contacts)) { record.known = false; record.relationshipLevel = 0; }
  // Curtis at NEUTRAL-or-better reads as "no problem to him", not affection.
  putInBand(state, "curtis", C.BANDS.WARM);
  assert.equal(C.selectors.deshawnRecruitmentAvailability(state).available, false);
});

test("the redemption path needs restitution plus one clean Dre mission", () => {
  const state = fresh(4243);
  state.run.day = 6;
  state.people.dealers.goodie.robbedCount = 1;
  assert.equal(C.selectors.deshawnRecruitmentAvailability(state).available, false);
  state.flags.goodieRestitution = true;
  assert.equal(C.selectors.deshawnRecruitmentAvailability(state).available, false);
  state.npc.dre.cleanCompletions = 1;
  assert.equal(C.selectors.deshawnRecruitmentAvailability(state).available, true);
});

test("the offer card recruits without a garage fee and remembers the path taken", () => {
  let state = fresh(4244);
  state.run.day = 6;
  state.people.dealers.goodie.robbedCount = 1;
  state.flags.goodieRestitution = true;
  state.npc.dre.cleanCompletions = 1;
  const card = C.buildEventForTest("deshawn_offer", state);
  assert.ok(card.description.includes("You made it right with Goodie"), "redemption path gets its own opening line");
  const cashBefore = state.player.cash;
  state.run.pendingEvent = card;
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  const crew = state.people.crew.deshawn;
  assert.equal(crew.recruited, true);
  assert.equal(crew.status, "active");
  assert.equal(crew.tier, 1);
  assert.equal(crew.recruitedDay, 6);
  assert.equal(state.player.cash, cashBefore, "the scene costs nothing up front");
  assert.equal(state.flags.extraRentGraceAvailable, true);
  assert.equal(state.flags.deshawnRedemptionPath, true);
});

test("declining the offer sets a three-day rain check the registry respects", () => {
  let state = fresh(4245);
  state.run.day = 6;
  putInBand(state, "mina", C.BANDS.WARM);
  putInBand(state, "juan", C.BANDS.WARM);
  state.run.pendingEvent = C.buildEventForTest("deshawn_offer", state);
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 1 });
  assert.equal(state.people.crew.deshawn.recruited, false);
  assert.equal(state.flags.deshawnOfferDeclined, true);
  assert.equal(state.flags.deshawnNextOfferDay, 9);
  const entry = C.STORY_REGISTRY.find((item) => item.id === "deshawn_offer");
  assert.ok(entry, "deshawn_offer is registered");
  assert.equal(entry.requires(state), false, "no re-offer before the rain check");
  state.run.day = 9;
  assert.equal(entry.requires(state), true, "the offer comes back on day nine");
});

test("the offer card never fires at capacity or after recruitment", () => {
  const state = fresh(4246);
  state.run.day = 6;
  putInBand(state, "mina", C.BANDS.WARM);
  putInBand(state, "juan", C.BANDS.WARM);
  const entry = C.STORY_REGISTRY.find((item) => item.id === "deshawn_offer");
  assert.equal(entry.requires(state), true);
  withDeshawn(state);
  assert.equal(entry.requires(state), false, "already recruited");
});

// --- De-escalation ----------------------------------------------------------

function legacyEncounter(id) {
  return { id, title: "Test Confrontation", enemyName: "Two collectors", enemyHealth: 20, guard: 0.1, evasion: 0.1, pursuit: 0.1, pay: 60, step: 0, attack: [4, 8] };
}

test("the de-escalation choice appears for Deshawn but never against Curtis's crews", () => {
  const state = fresh(4250);
  withDeshawn(state);
  state.run.pendingEncounter = legacyEncounter("dre_collector");
  assert.ok(C.selectors.encounterChoices(state).some((item) => item.id === "deshawn_deescalate"));
  for (const id of Crew.CURTIS_CREW_ENCOUNTER_IDS.filter((item) => item !== "mini_mart_parking_lot")) {
    state.run.pendingEncounter = legacyEncounter(id);
    assert.ok(!C.selectors.encounterChoices(state).some((item) => item.id === "deshawn_deescalate"), `${id} is Curtis's people`);
  }
  state.run.pendingEncounter = legacyEncounter("dre_collector");
  state.people.crew.deshawn.loyalty = 0;
  assert.ok(!C.selectors.encounterChoices(state).some((item) => item.id === "deshawn_deescalate"), "no loyalty, no favor");
});

test("de-escalation ends the encounter with no health loss, less heat, and a discretion row", () => {
  let state = fresh(4251);
  withDeshawn(state);
  state.player.heat = 5;
  const health = state.player.health;
  const curtisLedger = state.npc.curtis.ledger.length;
  state.run.pendingEncounter = legacyEncounter("dre_collector");
  state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: "deshawn_deescalate" });
  assert.equal(state.run.pendingEncounter, null);
  assert.equal(state.player.health, health, "no blood");
  assert.equal(state.player.heat, 4, "one point of heat worked off");
  assert.equal(state.people.crew.deshawn.loyalty, 6, "being trusted with it earns a point");
  assert.equal(state.npc.deshawn.lastDeescalationDay, state.run.day);
  const landed = state.npc.deshawn.ledger.some((row) => row.event === "deshawn_deescalation")
    || state.run.pendingObservations.some((item) => item.npcId === "deshawn" && item.observation.event === "deshawn_deescalation");
  assert.ok(landed, "his own ledger notices (now or on the neighborhood delay)");
  assert.ok(!state.run.pendingObservations.some((item) => item.npcId === "curtis" && item.observation.event === "deshawn_deescalation"), "nothing queued for Curtis either");
  assert.equal(state.npc.curtis.ledger.length, curtisLedger, "discretion never clears Curtis's network filter");
});

test("choosing violence when his option was on the table costs one loyalty, once", () => {
  let state = fresh(4252);
  withDeshawn(state, { loyalty: 6 });
  state.player.attributes.combat = 3;
  state.run.pendingEncounter = legacyEncounter("dre_collector");
  state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: "fight" });
  assert.equal(state.people.crew.deshawn.loyalty, 5, "violence with de-escalation available costs a point");
});

test("violence within two days of a de-escalation costs the point even when he is absent from the scene", () => {
  let state = fresh(4253);
  withDeshawn(state, { loyalty: 6 });
  state.npc.deshawn.lastDeescalationDay = state.run.day - 1;
  state.player.attributes.combat = 3;
  // Curtis-crew encounter: his choice is not offered, but he still watches.
  state.run.pendingEncounter = legacyEncounter("mid");
  state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: "fight" });
  assert.equal(state.people.crew.deshawn.loyalty, 5);
  assert.equal(state.npc.deshawn.lastDeescalationDay, null, "one penalty per de-escalation");
});

test("the consequence engine carries the same choice and the retaliation card offers it", () => {
  assert.ok(encountersSource.includes('"deshawn_deescalate"') || encountersSource.includes("deshawn_deescalate"), "consequence engine knows the choice");
  assert.ok(encountersSource.includes("CURTIS_CREW_ENCOUNTER_IDS"), "consequence engine honors the exclusion list");
  const core = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
  assert.ok(core.includes("deshawnDeescalate: true"), "stick retaliation card carries the option");
});

// --- Weekly introductions and rent grace ------------------------------------

test("the first weekly introduction opens The Nile's ground floor with two texts", () => {
  let state = fresh(4260);
  withDeshawn(state, { recruitedDay: 1 });
  assert.equal(state.world.locations.theNile.discovered, false);
  prepareNight(state, 8);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.world.locations.theNile.discovered, true);
  assert.equal(state.world.locations.theNile.discoveryMethod, "deshawn_intro");
  assert.equal(state.world.locations.theNile.secondFloorAccess, false, "ground floor only");
  assert.equal(state.npc.deshawn.lastIntroDay, 8);
  assert.deepEqual(state.npc.deshawn.introducedContacts, ["selam"]);
  const inbox = [...state.phone.inbox, ...state.phone.heldInbox];
  assert.ok(inbox.some((item) => item.from === "Deshawn" && item.text.includes("Tell her D sent you")));
  assert.ok(inbox.some((item) => item.from === "Selam"));
});

test("introductions prioritize undiscovered content and fall back to a market tip", () => {
  let state = fresh(4261);
  withDeshawn(state, { recruitedDay: 1 });
  state.world.locations.theNile.discovered = true;
  prepareNight(state, 8);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.discovered.spenardGym, true, "gym is next in line");
  // A week later: regulars. Then, with everything found, the market tip.
  state.nightOwl.regulars.cal.met = true;
  state.nightOwl.regulars.nia.met = true;
  state.player.cash = 500; state.player.dirtyCash = 0; state.player.cleanCash = 500;
  prepareNight(state, 15);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.ok(state.effects.rumors.some((rumor) => rumor.id.startsWith("deshawn_tip_") && rumor.reliable), "reliable tip when the map is used up");
  assert.equal(state.npc.deshawn.lastIntroDay, 15);
});

test("no introduction before seven days on the crew, and none after departure", () => {
  let state = fresh(4262);
  withDeshawn(state, { recruitedDay: 3 });
  prepareNight(state, 8);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.npc.deshawn.lastIntroDay, null, "five days is not a week");
  state.people.crew.deshawn.status = "departed";
  prepareNight(state, 11);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.npc.deshawn.lastIntroDay, null, "departed crew make no calls");
});

test("the rent grace re-arms once per rent period while Deshawn is active", () => {
  let state = fresh(4270);
  withDeshawn(state);
  assert.equal(state.flags.extraRentGraceAvailable, undefined);
  state.flags.extraRentGraceAvailable = true;
  state.player.cash = 0; state.player.dirtyCash = 0; state.player.cleanCash = 0;
  state.obligations.rentDueDay = 5;
  prepareNight(state, 5);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.flags.extraRentGraceAvailable, false, "grace consumed on the missed due day");
  assert.equal(state.flags.extraRentGraceUsedDueDay, 5);
  assert.equal(state.npc.yalonda.rentMissed, 0, "the grace ate the miss");
  // Same period: no re-arm, the next miss lands.
  prepareNight(state, 6);
  state.player.cash = 0; state.player.dirtyCash = 0; state.player.cleanCash = 0;
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.flags.extraRentGraceAvailable, false, "once per overdue period");
  // Next rent period: he talks to Yalonda again.
  prepareNight(state, 12);
  state.player.cash = 0; state.player.dirtyCash = 0; state.player.cleanCash = 0;
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.flags.extraRentGraceUsedDueDay, 12, "the new period's grace was armed and consumed");
});

test("no re-arm after Deshawn departs", () => {
  let state = fresh(4271);
  withDeshawn(state, { status: "departed" });
  state.flags.extraRentGraceUsedDueDay = 5;
  state.flags.extraRentGraceAvailable = false;
  prepareNight(state, 12);
  state.player.cash = 200; state.player.dirtyCash = 0; state.player.cleanCash = 200;
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.flags.extraRentGraceAvailable, false);
});

// --- Exposure wiring and UI contract ----------------------------------------

test("Deshawn is a full Exposure citizen off the network channel", () => {
  assert.ok(C.EXPOSURE_NPC_IDS.includes("deshawn"));
  const state = fresh(4280);
  assert.ok(Array.isArray(state.npc.deshawn.ledger));
  assert.deepEqual(state.npc.deshawn.channels, ["direct", "neighborhood", "household"], "never the network - he stays off Curtis's radar");
});

test("the More menu carries the crew entry and the crew copy reads loyalty out of ten", () => {
  assert.ok(uiSource.includes('setPage("crew")'), "More routes to the crew panel");
  assert.ok(uiSource.includes('initialPage="crew"'), "the crew route opens People at the crew page");
  assert.ok(uiSource.includes("loyalty {crew.loyalty}/10") || uiSource.includes("Loyalty {crew.loyalty}/10"), "loyalty renders on the 0-10 scale");
});
