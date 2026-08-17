// v1.26 — Hustle menu Jobs, and bills the player can actually pay.
//
// The reducer half of this build is almost entirely pre-existing: PAY_RENT and
// PAY_PHONE_BILL shipped long ago, deterministic and free of the clock. What was
// missing was a surface. These tests pin the two things v1.26 relies on — that
// the pay path stays free, deterministic and pool-correct, and that the lose
// condition it protects against still fires when the player genuinely cannot pay.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");

function fresh(seed = 907) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Rookie" });
  state.run.openingPending = false;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  return state;
}
// Put the player on the far side of the rent due day with money in hand.
function rentDue(seed = 907, cash = 400) {
  const state = fresh(seed);
  state.run.day = state.obligations.rentDueDay;
  state.player.cash = cash;
  state.player.cleanCash = cash;
  state.player.dirtyCash = 0;
  return state;
}

// --- rent -----------------------------------------------------------------

test("paying rent debits cash, clears the miss latch, and costs no time or energy", () => {
  const before = rentDue();
  const dueBefore = before.obligations.rentDueDay;
  before.obligations.lastMissedDueDay = dueBefore;
  const after = C.reduceGame(before, { type: "PAY_RENT" });

  assert.equal(after.player.cash, before.player.cash - C.WEEKLY_RENT);
  assert.ok(after.obligations.rentDueDay > after.run.day, "the due day moves past today");
  assert.equal(after.obligations.rentDueDay, dueBefore + 7);
  assert.equal(after.obligations.lastMissedDueDay, null);
  assert.equal(after.npc.yalonda.rentPaidWeeks, before.npc.yalonda.rentPaidWeeks + 1);
  assert.equal(after.npc.yalonda.lastRentDay, after.run.day);
  // Free of the clock: a bill paid on a phone is not an action.
  assert.equal(after.run.slot, before.run.slot);
  assert.equal(after.run.day, before.run.day);
  assert.equal(after.player.energy, before.player.energy);
  assert.ok(after.log.some((entry) => entry.text.includes(`$${C.WEEKLY_RENT}`)), "a feed line confirms the payment");
});

test("rent spends dirty cash before clean, through the canonical pool path", () => {
  const state = rentDue(4242, 0);
  state.player.cash = 200;
  state.player.dirtyCash = 120;
  state.player.cleanCash = 80;
  const after = C.reduceGame(state, { type: "PAY_RENT" });
  assert.equal(after.player.cash, 50);
  assert.equal(after.player.dirtyCash, 0, "dirty drains first");
  assert.equal(after.player.cleanCash, 50);
  assert.equal(after.player.cash, after.player.dirtyCash + after.player.cleanCash);
});

test("rent is deterministic: same seed and state, same result, and the RNG never advances", () => {
  const a = C.reduceGame(rentDue(31337), { type: "PAY_RENT" });
  const b = C.reduceGame(rentDue(31337), { type: "PAY_RENT" });
  assert.deepEqual(a.run.rngState, rentDue(31337).run.rngState, "paying a bill draws no randomness");
  assert.equal(a.player.cash, b.player.cash);
  assert.equal(a.obligations.rentDueDay, b.obligations.rentDueDay);
});

test("rent cannot be pre-paid or paid short, and each refusal is a true no-op", () => {
  const early = fresh();
  early.player.cash = 999;
  early.run.day = early.obligations.rentDueDay - 1;
  assert.equal(C.reduceGame(early, { type: "PAY_RENT" }), early, "before the due day, nothing happens");

  const broke = rentDue(11, C.WEEKLY_RENT - 1);
  assert.equal(C.reduceGame(broke, { type: "PAY_RENT" }), broke, "short on cash, nothing happens");

  const evicted = rentDue(12);
  evicted.people.household.evicted = true;
  assert.equal(C.reduceGame(evicted, { type: "PAY_RENT" }), evicted, "there is nothing left to pay for");
});

test("rent can be paid from any district — the obligation follows the player", () => {
  const away = rentDue(77);
  away.world.currentNeighborhoodId = "downtown";
  const after = C.reduceGame(away, { type: "PAY_RENT" });
  assert.equal(after.player.cash, away.player.cash - C.WEEKLY_RENT);
});

// --- the lose condition this build protects ------------------------------

// The whole point of the Pay button is that the lose condition should punish an
// empty wallet, not a player who could not find the screen. So both halves are
// pinned: paying at the last moment saves the period, and never paying still
// ends the run exactly as before.
function night(state) {
  const armed = { ...state, run: { ...state.run, slot: 3, dayEndPending: true } };
  const settled = C.reduceGame(armed, { type: "CONFIRM_END_DAY" });
  settled.run.pendingEvent = null;
  settled.run.pendingEncounter = null;
  settled.run.pendingOperationResult = null;
  settled.run.daySummary = null;
  return settled;
}

test("paying at the last moment settles the period and accrues no miss", () => {
  let paid = rentDue(555);
  paid = C.reduceGame(paid, { type: "PAY_RENT" });
  const missesBefore = paid.npc.yalonda.rentMissed;
  const dueAfterPaying = paid.obligations.rentDueDay;
  paid = night(paid);
  assert.equal(paid.npc.yalonda.rentMissed, missesBefore, "a settled period accrues no miss");
  assert.equal(paid.obligations.rentDueDay, dueAfterPaying, "the paid-through date holds");
  assert.equal(paid.people.household.evicted, false);
  assert.equal(paid.run.status, "playing");
});

test("rent that is never paid still evicts, one miss per weekly period", () => {
  let unpaid = rentDue(556, 0);
  unpaid.flags.extraRentGraceAvailable = false;
  const misses = [];
  for (let pass = 0; pass < 40 && unpaid.run.status === "playing"; pass += 1) {
    const before = unpaid.npc.yalonda.rentMissed;
    unpaid = night(unpaid);
    if (unpaid.npc.yalonda.rentMissed !== before) misses.push(unpaid.run.day);
  }
  assert.equal(unpaid.people.household.evicted, true, "the lose condition still fires");
  assert.equal(unpaid.run.status, "ended");
  assert.equal(unpaid.run.ending, "nowhere_to_go");
  assert.equal(unpaid.npc.yalonda.rentMissed, 4, "four unpaid periods reach three warnings");
  // One miss per rent period, not one per night — the latch is what makes the
  // grace period a period rather than a single evening.
  assert.deepEqual(misses, [8, 15, 22, 29]);
});

// --- phone bill ------------------------------------------------------------

test("the phone surface pays from anywhere, where the walk-in counter cannot", () => {
  function due(seed) {
    const state = fresh(seed);
    state.run.day = state.phone.billDueDay;
    state.player.cash = 300;
    state.player.cleanCash = 300;
    state.player.dirtyCash = 0;
    state.world.currentNeighborhoodId = "downtown";
    return state;
  }
  const store = due(21);
  assert.equal(C.reduceGame(store, { type: "PAY_PHONE_BILL", surface: "store" }), store,
    "the storefront is a place, and the player is not standing in it");

  const phone = due(21);
  const after = C.reduceGame(phone, { type: "PAY_PHONE_BILL", surface: "phone" });
  assert.equal(after.player.cash, phone.player.cash - C.PHONE_BILL);
  assert.equal(after.phone.billDueDay, after.run.day + 7);
  assert.equal(after.phone.daysPastDue, 0);
  assert.equal(after.run.slot, phone.run.slot, "no time passes");
  assert.equal(after.player.energy, phone.player.energy);
  assert.ok(after.log.some((entry) => entry.text.includes(`$${C.PHONE_BILL}`)));
});

test("the phone surface still refuses a bill that is not due or not affordable", () => {
  const early = fresh();
  early.player.cash = 999;
  assert.equal(C.reduceGame(early, { type: "PAY_PHONE_BILL", surface: "phone" }), early);

  const broke = fresh();
  broke.run.day = broke.phone.billDueDay;
  broke.player.cash = C.PHONE_BILL - 1;
  broke.player.cleanCash = C.PHONE_BILL - 1;
  assert.equal(C.reduceGame(broke, { type: "PAY_PHONE_BILL", surface: "phone" }), broke);
});

// --- schema ----------------------------------------------------------------

test("v1.26 adds no state: a v11 save round-trips unchanged", () => {
  const state = rentDue(8080);
  const paid = C.reduceGame(state, { type: "PAY_RENT" });
  const hydrated = C.inspectSave(C.serializeRun(paid));
  assert.equal(hydrated.valid, true);
  assert.equal(hydrated.state.version, C.VERSION);
  assert.equal(C.VERSION, 11, "the schema stays v11");
  assert.equal(hydrated.state.obligations.rentDueDay, paid.obligations.rentDueDay);
  assert.equal(hydrated.state.phone.billDueDay, paid.phone.billDueDay);
});

// --- the surfaces ----------------------------------------------------------

test("the Bills section pays rent and the phone, and names why when it cannot", () => {
  const bills = ui.slice(ui.indexOf("function phoneBills("), ui.indexOf("function More("));
  assert.match(bills, /type: "PAY_RENT"/);
  assert.match(bills, /type: "PAY_PHONE_BILL", surface: "phone"/);
  // Gating mirrors the reducer so no button is ever a silent no-op.
  assert.match(bills, /day < rentDue/);
  assert.match(bills, /Need \$\{money\(C\.WEEKLY_RENT\)\}|Need \$\{|`Need \$\{money\(C\.WEEKLY_RENT\)\}`/);
  assert.match(bills, /Pay at the Phone Store/);
  // Crew wages and Dre keep their own screens rather than a one-tap amount.
  assert.doesNotMatch(bills, /type: "PAY_CREW"/);
  assert.doesNotMatch(bills, /type: "PAY_DEBT"/);
  assert.match(ui, /Paid up\./);
  assert.match(ui, /className="btn bill-pay"/);
});

test("the bill row is a tap target at the 44px floor and survives a narrow phone", () => {
  assert.match(css, /\.bill-row\{[^}]*min-height:44px/);
  assert.match(css, /\.bill-pay\{[^}]*min-height:44px/);
  assert.match(css, /@media\(max-width:360px\)\{\.bill-row\{flex-wrap:wrap\}/);
});

test("Jobs left Spenard for Hustle without stranding the Home shortcut", () => {
  const home = ui.slice(ui.indexOf("function HomeJobCard("), ui.indexOf("function Home("));
  assert.match(home, /type: "WORK_JOB", jobId: job\.id, approach: "work_hard"/);
  const hustle = ui.slice(ui.indexOf("function HustleScreen("), ui.indexOf("// v1.20: what this card can say"));
  assert.match(hustle, /C\.selectors\.discoveredJobs\(state\)/);
  assert.match(hustle, /C\.selectors\.jobAvailability\(state, activeJob\.id\)/);
});
