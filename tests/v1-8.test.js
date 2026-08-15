const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const { putInBand } = require("./exposure-helpers.js");

function fresh(seed = 1800) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "North" });
  state.run.openingPending = false;
  state.run.pendingEvent = null;
  return state;
}
function clock(state) { return [state.run.day, state.run.slot]; }
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

test("v1.11 owns save version 9 and continues to advertise v3 through v8 migration keys", () => {
  assert.equal(C.VERSION, 9);
  assert.equal(C.SAVE_KEY, "907ogr_v9");
  assert.deepEqual(C.LEGACY_SAVE_KEYS, ["907ogr_v8", "907ogr_v7", "907ogr_v6", "907ogr_v5", "907ogr_v4", "907ogr_v3"]);
});

test("fresh v5 state has authoritative Mina, Curtis, Dre, Simone, jobs, and hustle records", () => {
  const state = fresh();
  assert.deepEqual(Object.keys(state.npc), ["yalonda", "juan", "mina", "curtis", "dre", "simone", "selam", "biniam"]);
  assert.equal(state.npc.curtis.attention, 0);
  assert.equal(state.npc.mina.cleanLifeAtRisk, false);
  assert.deepEqual(state.jobs.hired, ["day_labor"]);
  assert.equal(state.jobs.activeJobId, null);
  assert.equal(state.hustle.visible, false);
  assert.deepEqual(Object.keys(state.hustle.sections), ["market", "boost", "stickup", "shark"]);
});

test("v4 identity and employment data migrate once to v5 without replaying old records", () => {
  const raw = JSON.parse(C.serializeRun(fresh(1801)));
  raw.version = 4;
  raw.people.mara = { met: true, trust: 3, chainStage: 4, jobAtRisk: true, outcomes: [{ id: "mara_boundary" }] };
  delete raw.npc.mina;
  raw.npc.rook = { pressure: 6, respect: 2, relationship: "competitive" };
  delete raw.npc.curtis;
  raw.people.crew.miri = { ...raw.people.crew.pherris, introduced: true, recruited: true, loyalty: 4 };
  delete raw.people.crew.pherris;
  raw.people.crew.kip = { introduced: true, recruited: true, loyalty: 4 };
  raw.people.dealers.kip = { ...raw.people.dealers.goodie, known: true, standing: 3, robbedCount: 1 };
  delete raw.people.dealers.goodie;
  raw.world.territories.north_star_lot.owner = "rook";
  raw.jobs.hired = ["day_labor", "wash_go", "night_owl"];
  raw.jobs.records.wash_go.lastWorkedDay = 3;
  raw.jobs.records.night_owl.lastWorkedDay = 5;
  delete raw.jobs.activeJobId;
  delete raw.jobs.offers;
  const state = C.hydrateRun(raw);
  assert.equal(state.version, 9);
  assert.equal(state.npc.mina.chainStage, 4);
  assert.equal(state.npc.mina.cleanLifeAtRisk, true);
  assert.equal(state.npc.curtis.attention, 6);
  assert.equal(state.people.crew.pherris.loyalty, 4);
  assert.equal(state.people.crew.goodie, undefined);
  assert.equal(state.people.dealers.goodie.standing, 3);
  assert.equal(state.world.territories.north_star_lot.owner, "curtis");
  assert.equal(state.jobs.activeJobId, "night_owl");
  assert.deepEqual(state.jobs.hired, ["day_labor", "night_owl"]);
  assert.ok(state.jobs.offers.includes("wash_go"));
  assert.match(JSON.stringify(state), /mina_boundary/);
  assert.doesNotMatch(JSON.stringify(state), /mara_boundary/);
});

test("free v1.8 actions leave day and part unchanged", () => {
  let state = fresh(1802);
  state.run.day = 7;
  state.player.cash = 1000; state.player.cleanCash = 1000;
  const beforePhone = clock(state);
  state = C.reduceGame(state, { type: "PAY_PHONE_BILL", surface: "store" });
  assert.deepEqual(clock(state), beforePhone);
  state.run.consequenceQueue = [];
  state.player.health = 70;
  const beforeAid = clock(state);
  state = C.reduceGame(state, { type: "USE_FIRST_AID", cost: 10, amount: 18 });
  assert.deepEqual(clock(state), beforeAid);
  assert.equal(state.player.health, 88);
});

test("substantial v1.8 actions advance exactly their declared cost", () => {
  let state = fresh(1803);
  state.player.health = 60;
  state.player.cash = 500; state.player.cleanCash = 500;
  const beforeClinic = clock(state);
  state = C.reduceGame(state, { type: "HEAL", cost: 40, amount: 25 });
  assert.deepEqual(clock(state), [beforeClinic[0], beforeClinic[1] + 1]);
  state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.pendingOperationResult = null;
  const beforeWander = clock(state);
  state = C.reduceGame(state, { type: "WANDER_SPENARD" });
  assert.deepEqual(clock(state), [beforeWander[0], beforeWander[1] + 1]);
});

test("Mina trust adds five then eight discount points and caps total discount at 25%", () => {
  const state = fresh(1804);
  state.run.day = 3; state.run.slot = 2;
  state.people.dealers.goodie.known = true;
  state.people.dealers.goodie.standing = 3;
  state.plugs.unlocked = ["goodie"];
  state.world.productAccess.weed = true;
  state.npc.mina.met = true;
  // Warm buys the five points, Trusted the eight, and the cap still holds.
  putInBand(state, "mina", C.BANDS.WARM);
  assert.ok(Math.abs(C.selectors.dealerActions(state, "goodie").buy.discount - 0.23) < Number.EPSILON);
  putInBand(state, "mina", C.BANDS.TRUSTED);
  assert.equal(C.selectors.dealerActions(state, "goodie").buy.discount, 0.25);
});

test("Mina's six authored scenes and checkpoint outcomes are registered under v1.8 ids", () => {
  const titles = ["mina_intro", "mina_shift_change", "mina_invitation", "mina_boundary", "mina_sedan_night", "mina_after"].map((id) => C.buildEventForTest(id, fresh()).title);
  assert.deepEqual(titles, ["First Coffee", "Twenty Minutes Past Close", "Four Hours and No Agenda", "Someone Said Your Name Wrong", "The Vale Call", "Restocking the Cold Case"]);
  const outcomes = new Set(["mina_stays", "mina_calls_home", "mina_gone"]);
  assert.ok([...outcomes].every((id) => fs.readFileSync(path.join(__dirname, "..", "game-core.js"), "utf8").includes(id)));
});

test("Curtis attention comes from concrete sales and minor dealing remains invisible", () => {
  let state = fresh(1805);
  state.market.visible = true; state.plugs.unlocked = ["goodie"]; state.world.productAccess.weed = true;
  state.player.inventory.weed = { qty: 9, avgCost: 1 };
  state = C.reduceGame(state, { type: "SELL", productId: "weed", qty: 9 });
  // Milestones stay deduplicated; each one now lands in his ledger as the kind
  // of thing it was rather than incrementing one undifferentiated counter.
  assert.equal(state.npc.curtis.attentionMilestones.length, 1, "the conspicuous Spenard exposure is concrete even below ten cumulative units");
  assert.equal(state.npc.curtis.ledger.length, 1);
  state.player.inventory.weed = { qty: 1, avgCost: 1 };
  state = C.reduceGame(state, { type: "SELL", productId: "weed", qty: 1 });
  assert.equal(state.npc.curtis.attentionMilestones.length, 2);
  assert.ok(state.npc.curtis.attentionMilestones.includes("units_10"));
  assert.ok(state.npc.curtis.ledger.some((row) => row.event === "units_10"));
  assert.ok(C.selectors.disposition(state, "curtis") < 0, "exposure drives his read downward");
});

test("Curtis tax, friendship, guarded, and reject choices write distinct authoritative paths", () => {
  for (const [choice, expected] of [["pay_tax", "tax"], ["friendship", "accepted"], ["guarded", "guarded"], ["reject", "rejected"]]) {
    const state = fresh(1810 + choice.length);
    putInBand(state, "curtis", C.BANDS.HOSTILE);
    const next = C.reduceGame(state, { type: "CURTIS_DECISION", choice });
    if (expected === "tax") assert.equal(next.npc.curtis.taxActive, true);
    else assert.equal(next.npc.curtis.friendship, expected);
  }
});

test("Curtis betrayal takes dirty cash, carried product, and Heat after protection expires", () => {
  let state = prepareNight(fresh(1815));
  state.player.cash = 1000; state.player.dirtyCash = 1000; state.player.cleanCash = 0;
  state.player.inventory.weed = { qty: 8, avgCost: 10 };
  Object.assign(state.npc.curtis, { friendship: "accepted", friendshipDay: 1, protectionUntilDay: 3 });
  putInBand(state, "curtis", C.BANDS.HOSTILE);
  state.npc.curtis.ledger.push({ type: "growth", event: "test_escalation", location: null, value: null, day: 1, count: 4, source: "network" });
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.player.dirtyCash, 700);
  assert.equal(state.player.inventory.weed.qty, 6);
  assert.equal(state.player.heat, 2);
  assert.equal(state.npc.curtis.betrayed, true);
});

test("Deshawn Tier 3 intercepts Curtis betrayal without losing cash or product", () => {
  let state = prepareNight(fresh(1816));
  state.player.cash = 1000; state.player.dirtyCash = 1000; state.player.cleanCash = 0;
  state.player.inventory.weed = { qty: 8, avgCost: 10 };
  Object.assign(state.npc.curtis, { attention: 7, pressure: 7, friendship: "accepted", friendshipDay: 1, protectionUntilDay: 3 });
  Object.assign(state.people.crew.deshawn, { recruited: true, introduced: true, tier: 3, loyalty: 5 });
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.player.dirtyCash, 1000);
  assert.equal(state.player.inventory.weed.qty, 8);
  assert.equal(state.player.heat, 0);
});

test("Simone leverage converts a matured Curtis betrayal into a truce", () => {
  let state = prepareNight(fresh(18161));
  state.player.cash = 1000; state.player.dirtyCash = 1000; state.player.cleanCash = 0;
  state.player.inventory.weed = { qty: 8, avgCost: 10 };
  Object.assign(state.npc.curtis, { friendship: "accepted", friendshipDay: 1, protectionUntilDay: 3 });
  putInBand(state, "curtis", C.BANDS.HOSTILE);
  state.npc.curtis.ledger.push({ type: "growth", event: "test_escalation", location: null, value: null, day: 1, count: 4, source: "network" });
  state.npc.simone.leverage = 1;
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.equal(state.npc.simone.truce, true);
  assert.equal(state.player.dirtyCash, 1000);
  assert.equal(state.player.inventory.weed.qty, 8);
});

test("Curtis tax takes fifteen percent of nightly illegal gross and friendship adds a ten-percent buyer premium", () => {
  let taxed = prepareNight(fresh(18162));
  taxed.player.cash = 1000; taxed.player.dirtyCash = 1000; taxed.player.cleanCash = 0;
  taxed.npc.curtis.taxActive = true;
  taxed.hustle.revenueHistory = [{ day: taxed.run.day, slot: 1, amount: 600 }];
  taxed = C.reduceGame(taxed, { type: "CONFIRM_END_DAY" });
  assert.equal(taxed.player.dirtyCash, 910);

  const state = fresh(18163);
  state.world.productAccess.weed = true;
  const ordinary = C.selectors.tradeUnitPrices(state, "weed").sell;
  state.npc.curtis.friendship = "accepted";
  state.npc.curtis.protectionUntilDay = state.run.day + 2;
  const protectedPrice = C.selectors.tradeUnitPrices(state, "weed").sell;
  assert.ok(protectedPrice > ordinary);
  assert.ok(protectedPrice / ordinary >= 1.08 && protectedPrice / ordinary <= 1.14);
});

test("job callbacks become offers and accepting one resets only the employer being quit", () => {
  let state = fresh(1817);
  state.jobs.discovered.push("wash_go", "night_owl");
  state.jobs.activeJobId = "wash_go"; state.jobs.hired = ["day_labor", "wash_go"];
  Object.assign(state.jobs.records.wash_go, { xp: 9, rank: 2, relationship: 3, shifts: 4, coworkersMet: ["lena"], learnedDetails: ["detail"] });
  state.jobs.offers.push("night_owl");
  state = C.reduceGame(state, { type: "ACCEPT_JOB", jobId: "night_owl" });
  assert.equal(state.jobs.activeJobId, "night_owl");
  assert.deepEqual(state.jobs.hired, ["day_labor", "night_owl"]);
  assert.equal(state.jobs.records.wash_go.xp, 0);
  assert.equal(state.jobs.records.wash_go.rank, 0);
  assert.equal(state.jobs.records.wash_go.relationship, 0);
  assert.equal(state.jobs.records.wash_go.shifts, 4);
  assert.deepEqual(state.jobs.records.wash_go.coworkersMet, ["lena"]);
  assert.deepEqual(state.jobs.records.wash_go.learnedDetails, ["detail"]);
});

test("Goodie remains dealer-only and garage Operations grows field capacity from two to four", () => {
  const state = fresh(1818);
  assert.equal(C.CREW.some((person) => person.id === "goodie"), false);
  assert.ok(state.people.dealers.goodie);
  assert.equal(C.selectors.crewCapacityFor(state), 2);
  state.base.tracks.operations = 2;
  assert.equal(C.selectors.crewCapacityFor(state), 4);
});

test("Deshawn damaged-route recruitment needs restitution and a clean Dre mission", () => {
  const state = fresh(1819);
  state.run.day = 5;
  state.people.dealers.goodie.robbedCount = 1;
  assert.equal(C.selectors.deshawnRecruitmentAvailability(state).available, false);
  state.flags.goodieRestitution = true;
  state.npc.dre.cleanCompletions = 1;
  assert.equal(C.selectors.deshawnRecruitmentAvailability(state).available, true);
  state.flags.deshawnBusinessSevered = true;
  assert.equal(C.selectors.deshawnRecruitmentAvailability(state).available, false);
});

test("Dre missions are one-at-a-time, timed, outcome-aware, and stop after three refusals", () => {
  let state = fresh(1820);
  state.npc.dre.known = true; putInBand(state, "dre", C.BANDS.TRUSTED);
  state = C.reduceGame(state, { type: "REQUEST_DRE_MISSION" });
  assert.ok(state.npc.dre.activeMission);
  const before = clock(state);
  state = C.reduceGame(state, { type: "DRE_MISSION", outcome: "clean" });
  assert.deepEqual(clock(state), [before[0], before[1] + 1]);
  assert.equal(state.npc.dre.cleanCompletions, 1);
  for (let count = 0; count < 3; count += 1) {
    state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.pendingOperationResult = null;
    state = C.reduceGame(state, { type: "REQUEST_DRE_MISSION" });
    state = C.reduceGame(state, { type: "REFUSE_DRE_MISSION" });
  }
  assert.equal(state.npc.dre.offersDisabled, true);
});

test("Shark unlock requires Inner Circle, three clean missions, and two repaid Dre loans", () => {
  const state = fresh(1821);
  state.player.cash = 2000; state.player.cleanCash = 2000;
  putInBand(state, "dre", C.BANDS.BONDED); state.npc.dre.cleanCompletions = 3; state.npc.dre.loansRepaid = 1;
  assert.equal(C.selectors.sharkLoanAvailability(state, "nora", 100, 2).available, false);
  state.npc.dre.loansRepaid = 2;
  const loan = C.selectors.sharkLoanAvailability(state, "nora", 100, 2);
  assert.equal(loan.available, true);
  assert.ok(["Low", "Guarded", "High", "Severe"].includes(loan.risk));
  assert.equal(C.selectors.sharkLoanAvailability(state, "nora", 250, 2).available, false);
});

test("all Shark default choices preserve their distinct time, Heat, and relationship effects", () => {
  const seed = fresh(18211);
  seed.player.cash = 0; seed.player.cleanCash = 0; seed.player.dirtyCash = 0;
  putInBand(seed, "dre", C.BANDS.BONDED);
  seed.hustle.shark.loans = [{ id: 1, borrowerId: "jamal", amount: 250, term: 4, openedDay: 1, dueDay: 5, status: "defaulted", risk: "Guarded", extensions: 0 }];
  for (const type of ["COLLECT_SHARK", "ENFORCE_SHARK"]) {
    const before = clock(seed);
    const next = C.reduceGame(seed, { type, loanId: 1 });
    assert.notDeepEqual(clock(next), before);
    assert.equal(next.hustle.shark.loans[0].status, type === "ENFORCE_SHARK" ? "enforced" : "collected");
    assert.equal(next.player.heat, type === "ENFORCE_SHARK" ? 2 : 0);
  }
  const extended = C.reduceGame(seed, { type: "EXTEND_SHARK", loanId: 1 });
  assert.equal(extended.hustle.shark.loans[0].status, "extended");
  assert.deepEqual(clock(extended), clock(seed));
  const forgiven = C.reduceGame(seed, { type: "FORGIVE_SHARK", loanId: 1 });
  assert.equal(forgiven.hustle.shark.loans[0].status, "forgiven");
  // Walking a debt is something Dre files against you rather than a point off
  // a counter, and his lens reads defiance harder than most.
  assert.ok(forgiven.npc.dre.ledger.some((row) => row.event === "walked_a_debt"));
  assert.ok(C.selectors.disposition(forgiven, "dre") < C.selectors.disposition(seed, "dre"));
});

test("Pherris, Tone, and Deshawn tier prerequisites are independently enforced", () => {
  const state = fresh(1822);
  for (const id of ["pherris", "tone", "deshawn"]) Object.assign(state.people.crew[id], { introduced: true, recruited: true, tier: 1, loyalty: 1 });
  assert.equal(C.selectors.crewTierAvailability(state, "pherris").available, false);
  assert.equal(C.selectors.crewTierAvailability(state, "tone").available, false);
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, false);
  state.world.territoryBlocks.spenard_rec_lot.owner = "player";
  state.people.crew.pherris.loyalty = 3;
  state.people.crew.tone.loyalty = 2;
  state.people.crew.deshawn.loyalty = 3;
  assert.equal(C.selectors.crewTierAvailability(state, "pherris").available, true);
  assert.equal(C.selectors.crewTierAvailability(state, "tone").available, true);
  assert.equal(C.selectors.crewTierAvailability(state, "deshawn").available, true);
});

test("Pherris Tier 3 seeds $75–$125 network income and opens the Simone conflict", () => {
  let state = fresh(18221);
  state.player.cash = 500; state.player.dirtyCash = 500;
  Object.assign(state.people.crew.pherris, { introduced: true, recruited: true, loyalty: 4, tier: 2 });
  state.world.territoryBlocks.spenard_rec_lot.owner = "player";
  state.world.territoryBlocks.northern_lights_motels.owner = "player";
  state = C.reduceGame(state, { type: "PROMOTE_CREW_TIER", crewId: "pherris" });
  assert.equal(state.npc.simone.pherrisConflict, true);
  const before = state.player.dirtyCash;
  state = prepareNight(state, 8);
  state = C.reduceGame(state, { type: "CONFIRM_END_DAY" });
  assert.ok(state.player.dirtyCash - before >= 75 && state.player.dirtyCash - before <= 125);
});

test("Tone's Jacksonville Protect, Cut Loose, and Leverage outcomes all resolve", () => {
  for (const [choiceIndex, flag] of [[0, "toneJacksonvilleProtected"], [1, "toneJacksonvilleCutLoose"], [2, "toneJacksonvilleLeverage"]]) {
    let state = fresh(18230 + choiceIndex);
    Object.assign(state.people.crew.tone, { introduced: true, recruited: true, tier: 2, loyalty: 4 });
    state.run.day = 7; state.player.heat = 10;
    state.run.pendingEvent = C.buildEventForTest("tone_jacksonville", state);
    state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex });
    assert.equal(state.flags[flag], true);
    if (choiceIndex === 1) assert.equal(state.people.crew.tone.recruited, false);
  }
});

test("Mina's aftermath resolves all three authoritative relationship outcomes", () => {
  const cases = [
    [{ available: true }, C.BANDS.BONDED, { toldMinaTruth: true }, "mina_stays"],
    [{ available: true }, C.BANDS.TRUSTED, {}, "mina_calls_home"],
    [{ available: false }, C.BANDS.BONDED, {}, "mina_gone"],
  ];
  for (const [mina, band, flags, outcome] of cases) {
    let state = fresh(18240 + outcome.length);
    Object.assign(state.npc.mina, { met: true, chainStage: 5, ...mina });
    putInBand(state, "mina", band);
    Object.assign(state.flags, flags);
    state.run.pendingEvent = C.buildEventForTest("mina_after", state);
    state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
    assert.equal(state.npc.mina.outcome, outcome);
  }
});

test("the v1.8 shell is five-destination, Phone is unconditional, and Hustle is conditional", () => {
  const ui = fs.readFileSync(path.join(__dirname, "..", "ui.jsx"), "utf8");
  assert.match(ui, /const NAV = \[\["home", "Home"\], \["street", "Street"\], \["hustle", "Hustle"\], \["phone", "Phone"\], \["more", "More"\]\]/);
  assert.match(ui, /id !== "hustle" \|\| hustleVisible/);
  assert.doesNotMatch(ui, /id !== "phone"/);
  assert.match(ui, /No Service/);
  assert.match(ui, /title="Street Market"/);
});

test("v1.8 runtime copy contains new identities and no retired identity strings", () => {
  const root = path.join(__dirname, "..");
  // src/ holds the extracted data and event registries, so the copy sweep has
  // to walk it too or most player-facing strings go unchecked.
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
  const files = [...["game-core.js", "ui.jsx", "encounters.js"].map((file) => path.join(root, file)), ...walk(path.join(root, "src"))];
  const copy = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const name of ["Mina Vale", "Curtis Foyer", "Dre Smooth", "Goodie", "Pherris Dickens", "Simone Hart"]) assert.match(copy, new RegExp(name));
  const playerFacing = copy.split("\n").filter((line) => !line.includes("replaceAll(")).join("\n");
  assert.doesNotMatch(playerFacing, /Mara Velez|Rook Mercer|Kip Sallis|Dre Holloway/);
});
