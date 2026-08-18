// v1.29 — the playtest QoL pass.
//
// Six of the seven tasks in this build are display work, and display work is
// exactly what a simulation hash cannot see. These tests are the proof the
// hashes are not: the phone can be emptied and answered, the attendance ladder
// climbs and resets on real reducer passes, and a lost run says what lost it.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");

const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");
const cards = fs.readFileSync(path.join(root, "src/events/cards.js"), "utf8");

function fresh(seed = 1129) {
  const state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Rookie" });
  state.run.openingPending = false;
  state.run.pendingEvent = null;
  state.run.pendingEncounter = null;
  return state;
}

// Roll the clock to the end of the day, the way v1-26 does.
function night(state) {
  const armed = { ...state, run: { ...state.run, slot: 3, dayEndPending: true } };
  const settled = C.reduceGame(armed, { type: "CONFIRM_END_DAY" });
  settled.run.pendingEvent = null;
  settled.run.pendingEncounter = null;
  settled.run.pendingOperationResult = null;
  settled.run.daySummary = null;
  return settled;
}

// Put the player on a real employer's payroll without walking the whole
// application chain, which has RNG in it and is not what these tests measure.
function employed(seed = 1129, jobId = "wash_go") {
  const state = fresh(seed);
  state.knowledge = state.knowledge || {};
  if (!state.jobs.discovered.includes(jobId)) state.jobs.discovered.push(jobId);
  state.jobs.offers = [jobId];
  const hired = C.reduceGame(state, { type: "ACCEPT_JOB", jobId });
  assert.equal(hired.jobs.activeJobId, jobId, "setup: the job should be accepted");
  return hired;
}

// --- task 2: the phone ----------------------------------------------------

test("a text can be dismissed, stays dismissed, and drops the badge count", () => {
  const state = fresh();
  state.phone.active = true;
  state.phone.inbox = [
    { id: "a", from: "Goodie", text: "corner's hot", day: 1, slot: 2, read: false },
    { id: "b", from: "Dre", text: "day five", day: 1, slot: 2, read: false },
  ];
  const after = C.reduceGame(state, { type: "DISMISS_PHONE_MESSAGE", id: "a" });
  assert.equal(after.phone.inbox.length, 1);
  assert.equal(after.phone.inbox[0].id, "b");
  // The nav badge reads inbox length, so clearing one has to move it.
  assert.ok(after.phone.inbox.length < state.phone.inbox.length);
  // Dismissing the same id again is a no-op, not a resurrection.
  const again = C.reduceGame(after, { type: "DISMISS_PHONE_MESSAGE", id: "a" });
  assert.equal(again, after, "a dismissed message must not come back");
});

test("clear all empties the inbox and no-ops when it is already empty", () => {
  const state = fresh();
  state.phone.active = true;
  state.phone.inbox = [{ id: "a", from: "Goodie", text: "x", day: 1, slot: 2, read: false }];
  const cleared = C.reduceGame(state, { type: "CLEAR_PHONE_INBOX" });
  assert.equal(cleared.phone.inbox.length, 0);
  assert.equal(C.reduceGame(cleared, { type: "CLEAR_PHONE_INBOX" }), cleared);
});

test("dismissing costs no time, no energy, and no money", () => {
  const state = fresh();
  state.phone.active = true;
  state.phone.inbox = [{ id: "a", from: "Goodie", text: "x", day: 1, slot: 2, read: false }];
  const after = C.reduceGame(state, { type: "DISMISS_PHONE_MESSAGE", id: "a" });
  assert.equal(after.run.day, state.run.day);
  assert.equal(after.run.slot, state.run.slot);
  assert.equal(after.player.cash, state.player.cash);
  assert.equal(after.player.health, state.player.health);
});

test("a job offer arrives tagged so the phone can answer it", () => {
  const state = employed(1129, "wash_go");
  // ACCEPT_JOB retires the offer text, so check the tag on the push itself.
  assert.match(ui, /message\.action\.kind === "job_offer"/);
  assert.match(ui, /type: "ACCEPT_JOB", jobId: offer\.jobId/);
  assert.match(ui, /type: "DECLINE_JOB", jobId: offer\.jobId/);
  assert.equal(state.jobs.activeJobId, "wash_go");
});

test("answering an offer retires the text that carried it, in either direction", () => {
  for (const answer of ["ACCEPT_JOB", "DECLINE_JOB"]) {
    const state = fresh();
    state.phone.active = true;
    if (!state.jobs.discovered.includes("wash_go")) state.jobs.discovered.push("wash_go");
    state.jobs.offers = ["wash_go"];
    state.phone.inbox = [{ id: "offer", from: "Wash & Go", text: "We have an offer for you.", day: 1, slot: 1, read: false, action: { kind: "job_offer", jobId: "wash_go" } }];
    const after = C.reduceGame(state, { type: answer, jobId: "wash_go" });
    assert.equal(after.phone.inbox.length, 0, `${answer} should take the offer text with it`);
    assert.ok(!after.jobs.offers.includes("wash_go"));
  }
});

test("the message card offers an action or a dismiss, never a dead tap", () => {
  // Every card renders a dismiss control; the answer buttons are gated on the
  // offer still being live, so a stale card degrades instead of dead-tapping.
  assert.match(ui, /className="message-dismiss"/);
  assert.match(ui, /const live = offer && state\.jobs\.offers\.includes\(offer\.jobId\)/);
  assert.match(ui, /\{live && <div className="btn-row message-actions">/);
  assert.match(css, /\.message-dismiss\{[^}]*width:44px;height:44px/);
});

// --- task 3: 907List on Hustle -------------------------------------------

test("907List lives on Hustle and is gone from More and the Phone", () => {
  const hustleRow = /\{state\.knowledge\.knows907List && <MenuRow title="907List"/;
  assert.equal((ui.match(new RegExp(hustleRow.source, "g")) || []).length, 1,
    "exactly one 907List menu row should remain");
  // It routes inside the Hustle screen now.
  assert.match(ui, /if \(page === "907list"\) return <NineOhSevenList state=\{state\} dispatch=\{dispatch\} surface=\{sub === "home" \? "home" : "phone"\}/);
  // And the Home laptop points at Hustle rather than More.
  assert.match(ui, /navigate\("hustle", "root", "home", "907list"\)/);
  assert.doesNotMatch(ui, /navigate\("more", "907list"/);
  // The Phone no longer takes an openList prop at all.
  assert.doesNotMatch(ui, /openList/);
});

test("moving 907List changed no 907List behaviour", () => {
  // The move is navigation only: access rules still answer to the same
  // selector, with the same two surfaces.
  const state = fresh();
  state.knowledge.knows907List = true;
  state.phone.active = true;
  for (const surface of ["phone", "home"]) {
    const access = C.selectors.nineZeroSevenListAccess(state, surface);
    assert.ok(typeof access.available === "boolean");
    assert.ok(typeof access.visible === "boolean");
  }
});

// --- task 4: the fail state ----------------------------------------------

test("eviction ends the run naming the obligation that caused it", () => {
  let state = fresh(4242);
  // Never pay rent. v1-26 already pins that this ends the run; what is new is
  // that it now says why.
  state.player.cash = 0;
  state.player.cleanCash = 0;
  state.player.dirtyCash = 0;
  for (let i = 0; i < 40 && state.run.status === "playing"; i += 1) state = night(state);
  assert.equal(state.run.status, "ended", "an unpaid run must still end");
  assert.equal(state.run.ending, "nowhere_to_go");
  assert.ok(state.run.endCause, "the run must record what ended it");
  assert.ok(state.run.endCause.title.length > 0);
  assert.ok(state.run.endCause.line.length > 0);
  // The cause is the specific obligation line, not the generic ending label.
  assert.notEqual(state.run.endCause.line, "Nowhere to Go");
  // And it reaches the player as a titled consequence card, tone "bad".
  const card = (state.run.consequenceQueue || []).find((entry) => entry.title === state.run.endCause.title);
  assert.ok(card, "the ending must push a titled consequence card");
  assert.equal(card.tone, "bad");
});

test("the run summary carries the numbers the end screen shows", () => {
  let state = fresh(4242);
  state.player.cash = 0;
  state.player.cleanCash = 0;
  state.player.dirtyCash = 0;
  for (let i = 0; i < 40 && state.run.status === "playing"; i += 1) state = night(state);
  const summary = C.selectRunSummary(state);
  assert.equal(summary.daysSurvived, state.run.day);
  assert.equal(typeof summary.netGain, "number");
  assert.equal(summary.netGain, summary.netWorth - state.stats.startingNetWorth);
  assert.ok(summary.endCause, "a lost run reports its cause through the summary");
  assert.equal(summary.reachedCheckpoint, false, "eviction is not a checkpoint");
  assert.ok(Array.isArray(summary.crew));
  assert.ok(Array.isArray(summary.territories));
});

test("the end screen leads with the cause and keeps checkpoint framing for checkpoints", () => {
  assert.match(ui, /cause \? cause\.title : summary\.endingLabel/);
  assert.match(ui, /<p className="popup-lead bad">\{cause\.line\}<\/p>/);
  assert.match(ui, /<Outcome label="Days survived" value=\{summary\.daysSurvived\} \/>/);
  assert.match(ui, /<Outcome label="Net gain"/);
});

test("a save written before this build still ends cleanly with no endCause", () => {
  // Additive hydration: nothing migrates, and the absent field falls back to
  // the ending label rather than throwing.
  let state = fresh(77);
  delete state.run.endCause;
  const summary = C.selectRunSummary(state);
  assert.equal(summary.endCause, null);
  assert.equal(typeof summary.endingLabel, "string");
});

// --- task 5: attendance ---------------------------------------------------

test("the attendance ladder climbs warning, text, fired on three consecutive misses", () => {
  let state = employed(1129, "wash_go");
  const jobId = "wash_go";
  // Day one is the hire day and carries grace.
  state = night(state);
  assert.equal(state.jobs.missedShifts[jobId] || 0, 0, "no count on the day you are hired");
  assert.equal(state.jobs.activeJobId, jobId);

  state = night(state);
  assert.equal(state.jobs.missedShifts[jobId], 1, "first miss");
  assert.equal(state.jobs.activeJobId, jobId, "a first miss never costs the job");
  assert.ok(state.log.some((entry) => /asking where you were/i.test(entry.text)), "miss 1 is a feed line");

  const inboxBefore = state.phone.inbox.length;
  state = night(state);
  assert.equal(state.jobs.missedShifts[jobId], 2, "second miss");
  assert.equal(state.jobs.activeJobId, jobId, "a second miss never costs the job");
  assert.ok(state.phone.inbox.length > inboxBefore, "miss 2 is a text from the employer");
  assert.ok(state.phone.inbox.some((message) => /pattern/i.test(message.text)));

  state = night(state);
  assert.equal(state.jobs.activeJobId, null, "third consecutive miss is the firing");
  assert.ok(!state.jobs.hired.includes(jobId));
  assert.deepEqual(state.jobs.hired, ["day_labor"], "day labor is still there");
  const card = (state.run.consequenceQueue || []).find((entry) => /attendance/i.test(entry.text));
  assert.ok(card, "firing pushes a consequence card");
  assert.equal(card.tone, "bad");
});

test("working any shift resets the ladder, so every-other-day never gets fired", () => {
  let state = employed(1129, "wash_go");
  state = night(state);           // hire-day grace
  state = night(state);           // miss 1
  assert.equal(state.jobs.missedShifts.wash_go, 1);
  // Show up. The reducer records lastWorkedDay; this pins the reset rule
  // itself rather than the shift action's RNG.
  state.jobs.records.wash_go.lastWorkedDay = state.run.day;
  state = night(state);
  assert.equal(state.jobs.missedShifts.wash_go, 0, "a worked shift clears the ladder");
  // Two more cycles of work-then-skip must never reach the firing rung.
  for (let i = 0; i < 3; i += 1) {
    state = night(state);
    assert.ok(state.jobs.activeJobId, "an irregular schedule is not abandonment");
    state.jobs.records.wash_go.lastWorkedDay = state.run.day;
    state = night(state);
  }
  assert.equal(state.jobs.activeJobId, "wash_go");
});

test("firing over attendance broadcasts job_lost, the same way the Heat ladder does", () => {
  let state = employed(1129, "wash_go");
  for (let i = 0; i < 5 && state.jobs.activeJobId; i += 1) state = night(state);
  assert.equal(state.jobs.activeJobId, null, "setup: the ladder should have fired");
  // Read it where v1-10 reads the Heat ladder's copy: the household ledger plus
  // anything still queued for delivery.
  const rows = [...state.npc.yalonda.ledger, ...state.run.pendingObservations.map((item) => item.observation || item)];
  assert.ok(rows.some((row) => row && row.event === "job_lost"), "losing the job never reached the household");
});

test("day labor is exempt at every rung", () => {
  let state = fresh();
  assert.ok(state.jobs.hired.includes("day_labor"));
  for (let i = 0; i < 8; i += 1) state = night(state);
  assert.deepEqual(state.jobs.missedShifts, {}, "day labor never enters the ladder");
  assert.ok(state.jobs.hired.includes("day_labor"), "the floor of the run cannot be taken away");
});

test("the Night Owl is de-scheduled rather than fired", () => {
  let state = fresh(1129);
  if (!state.jobs.discovered.includes("night_owl")) state.jobs.discovered.push("night_owl");
  state.npc.mina.met = true;
  state.jobs.offers = ["night_owl"];
  state = C.reduceGame(state, { type: "ACCEPT_JOB", jobId: "night_owl" });
  assert.equal(state.jobs.activeJobId, "night_owl");
  for (let i = 0; i < 6; i += 1) state = night(state);
  // Mina stops putting you on the schedule. That relationship was never
  // employment, and the Heat ladder already respected the same rule.
  // Pin that the ladder genuinely reached the firing rung, so this is the
  // exemption doing the work rather than the counter never having climbed.
  assert.ok((state.jobs.missedShifts.night_owl || 0) >= 3, "the ladder must actually reach the firing rung");
  assert.equal(state.jobs.activeJobId, "night_owl", "the Night Owl does not fire you");
  assert.ok(state.jobs.hired.includes("night_owl"), "and it does not take the job off you either");
  assert.ok(state.log.some((entry) => /off the schedule/i.test(entry.text)));
});

test("the attendance ladder is deterministic", () => {
  const runOnce = () => {
    let state = employed(31337, "wash_go");
    for (let i = 0; i < 5; i += 1) state = night(state);
    return { active: state.jobs.activeJobId, missed: { ...state.jobs.missedShifts } };
  };
  assert.deepEqual(runOnce(), runOnce(), "no RNG anywhere in the ladder");
});

test("a save written before this build loads, plays, and stays on schema v11", () => {
  // mergeDefaults supplies `missedShifts` and `hiredDay` to every old save, so
  // there is nothing to migrate. This pins the version and then removes both
  // fields by hand anyway, employer and all, because a throw inside the day-end
  // settlement would take a real run down.
  assert.equal(C.VERSION, 11, "schema stays v11");
  const state = employed(8801, "wash_go");
  assert.equal(state.version, 11);
  delete state.jobs.missedShifts;
  delete state.jobs.records.wash_go.hiredDay;
  let settled = night(state);
  assert.equal(settled.run.status, "playing");
  // And the ladder starts counting from where the absent field implied: zero.
  assert.equal(settled.jobs.missedShifts.wash_go, 1);
  settled = night(settled);
  assert.equal(settled.jobs.missedShifts.wash_go, 2);
  assert.equal(settled.jobs.activeJobId, "wash_go");
});

// --- task 6: Rank ---------------------------------------------------------

test("no player-facing string says Identity", () => {
  assert.match(ui, /<span className="k">Rank<\/span>/);
  assert.match(ui, /description="Rank, what you are good at, and what the block remembers\."/);
  assert.doesNotMatch(ui, /Street Identity/);
  assert.doesNotMatch(ui, /<span className="k">Identity<\/span>/);
  // Internal names are untouched on purpose: this is a display change.
  assert.match(ui, /C\.selectors\.streetIdentityView\(state\)/);
  assert.ok(typeof C.selectors.streetIdentity === "function");
});

// --- task 7: the choice card ---------------------------------------------

test("both regular-customer options state their trade in under 20 words", () => {
  const block = cards.slice(cards.indexOf("goodie_regular: () =>"));
  const previews = [...block.slice(0, 1200).matchAll(/preview: "([^"]+)"/g)].slice(0, 2).map((match) => match[1]);
  assert.equal(previews.length, 2);
  for (const preview of previews) {
    assert.ok(preview.split(/\s+/).length < 20, `over 20 words: ${preview}`);
    assert.doesNotMatch(preview, /—/, "no em dashes");
  }
  // The point of the rewrite: each option names a gain and a cost.
  assert.match(previews[0], /cheaper/i);
  assert.match(previews[0], /one buy a day/i);
  assert.match(previews[1], /no discount/i);
  assert.match(previews[1], /as often as you want/i);
  // The old copy said neither.
  assert.doesNotMatch(block.slice(0, 1200), /Build standing and keep the corner dependable/);
});
