const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Arrest = require("../src/data/arrest.js");
const Mina = require("../src/data/mina.js");
const { BANDS } = require("../src/data/disposition-bands.js");
const { STICK_TARGETS } = require("../src/data/districts.js");
const root = path.join(__dirname, "..");
const uiSource = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "v05.css"), "utf8");
const cardsSource = fs.readFileSync(path.join(root, "src", "events", "cards.js"), "utf8");

// v1.17 - Voice & Copy Polish, the Market close, and the CSS tone fix.
// The button is gone (leaving a traded visit is the close), consequence cards
// get their severity stripes back, and the copy banks speak Spenard instead of
// spreadsheet.

function fresh(seed) {
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Seventeen" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  return structuredClone(state);
}

const words = (line) => line.split(/\s+/).filter(Boolean).length;
// The style gate every new v1.17 line passes through: no em or en dash, no
// hidden-stat name, no vague intensifier, no "not X but Y" pivot, short.
function assertVoice(line, label, maxWords = 20) {
  assert.doesNotMatch(line, /[—–]/, `${label} uses a dash: ${line}`);
  assert.doesNotMatch(line, /\b(loyalty|disposition|observation)\b/i, `${label} names a hidden stat: ${line}`);
  assert.doesNotMatch(line, /\b(really|very|truly|actually|basically|literally)\b/i, `${label} uses an intensifier: ${line}`);
  assert.doesNotMatch(line, /\bnot\b[^.!?]{0,40}\bbut\b/i, `${label} uses a negation pivot: ${line}`);
  assert.ok(words(line) <= maxWords, `${label} runs long (${words(line)} words): ${line}`);
}

// ---------------------------------------------------------------------------
// 1. Market: leaving is the close, and only a traded visit costs time
// ---------------------------------------------------------------------------

test("BUY and SELL mark the visit; the reducer resets the mark when time moves", () => {
  // Mirrors tests/v1-15.test.js's marketReady: Goodie's corner intro is the
  // market unlock.
  // Same seed and street name as v1-15's marketReady, whose first explore is
  // known to raise Goodie's corner.
  let state = C.reduceGame(C.createRun({ seed: 4230 }), { type: "START_RUN", streetName: "Fifteen" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  state.run.day = 2;
  state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.dayEndPending = false;
  state.run.slot = 0; state.player.energy = 4;
  state = C.reduceGame(state, { type: "EXPLORE_SPENARD" });
  assert.equal(state.run.pendingEvent?.id, "goodie_corner_intro");
  state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  assert.ok(state.market.visible, "Goodie's corner unlocked the market");
  state.player.cash = 900; state.player.dirtyCash = 900; state.player.cleanCash = 0;
  state.world.markets.north_star_lot.availability.weed = 50;
  state.run.pendingEvent = null; state.run.pendingEncounter = null; state.run.dayEndPending = false;
  state.run.slot = 0; state.player.energy = 4;
  assert.equal(state.run.currentVisit.trades, 0);
  state = C.reduceGame(state, { type: "BUY", productId: "weed", qty: 1 });
  assert.equal(state.run.currentVisit.trades, 1, "BUY counts as a trade this visit");
  state.run.pendingEvent = null; state.run.pendingEncounter = null;
  state = C.reduceGame(state, { type: "END_MARKET" });
  assert.equal(state.run.currentVisit.trades, 0, "closing the visit resets the mark");
});

test("END_MARKET with no trades still advances the clock (the shell, not the reducer, is the gate)", () => {
  // The sim harness and a decade of tests use bare END_MARKET as "stay put and
  // advance time"; guarding it in the reducer would dead-end every strategy.
  // The trades check lives in the shell's nav-away hook only.
  const state = fresh(1702);
  assert.equal(state.run.currentVisit.trades, 0);
  const after = C.reduceGame(state, { type: "END_MARKET" });
  assert.notEqual(after.run.slot, state.run.slot, "time still moves on a bare END_MARKET");
});

test("the shell fires END_MARKET on the way out of a traded visit and never renders a close button", () => {
  assert.match(uiSource, /function closeMarketIfTraded/);
  assert.ok(uiSource.includes("state.run.currentVisit.trades > 0"), "the dispatch is gated on a trade this visit");
  assert.ok(uiSource.includes('act({ type: "END_MARKET" })'), "the shell still owns the dispatch");
  assert.doesNotMatch(uiSource, />Leave Market/);
  assert.doesNotMatch(uiSource, /Finish Trading/);
  assert.doesNotMatch(uiSource, /Ends your market visit/);
  // Both page setters and the tab funnel run through the hook.
  assert.match(uiSource, /setStreetPageSafe/);
  assert.match(uiSource, /setHustlePageSafe/);
});

// ---------------------------------------------------------------------------
// 2. CSS: the consequence-card tone variables exist
// ---------------------------------------------------------------------------

test("the four tone variables the consequence layer references are defined as palette aliases", () => {
  assert.match(cssSource, /:root\{--text:var\(--white\);--good:var\(--green\);--warn:var\(--amber\);--bad:var\(--red2\)\}/);
  // And the rules that consume them are still shaped the way v1.1 shipped them.
  assert.match(cssSource, /\.consequence-card\.good\{border-left-color:var\(--good\)\}/);
  assert.match(cssSource, /\.consequence-card\.warn\{border-left-color:var\(--warn\)\}/);
  assert.match(cssSource, /\.consequence-card\.bad\{border-left-color:var\(--bad\)\}/);
});

// ---------------------------------------------------------------------------
// 3. Voice pass: the copy banks hold the register
// ---------------------------------------------------------------------------

test("arrest copy banks pass the voice gate and keep their machinery", () => {
  const banks = [
    ...Object.values(Arrest.BOOKING_LINES),
    ...Object.values(Arrest.RELEASE_LINES),
    Arrest.HEAT_RELIEF_LINES,
  ];
  for (const bank of banks) {
    assert.ok(bank.length >= 3, "every arrest bank keeps at least three lines");
    for (const line of bank) assertVoice(line, "arrest bank");
  }
  // heat stays out of the arrest banks too - the HUD receipt in game-core is
  // the one licensed use of the word.
  for (const bank of banks) for (const line of bank) assert.doesNotMatch(line, /\bheat\b/i);
  for (const bank of [Arrest.CREW_BOOKED_LINES, Arrest.CREW_BAIL_LINES, Arrest.CREW_SERVED_LINES]) {
    assert.ok(bank.length >= 3);
    for (const line of bank) {
      assert.ok(line.includes("%s"), `crew line keeps the name token: ${line}`);
      assertVoice(line, "crew bank");
    }
  }
});

test("event-card previews speak in-world for hidden relationships and keep numbers for HUD stats", () => {
  const { activeEvent } = require("../src/events/cards.js");
  const state = fresh(1703);
  const boundary = activeEvent("mina_boundary", state);
  for (const choice of boundary.choices) {
    assert.doesNotMatch(choice.preview, /\btrust\b\s*[-+−]?\d|[-+−]\d+\s*(Mina|Dre|Curtis)/i, `preview prices a relationship: ${choice.preview}`);
  }
  // The generated previews never name the relationship stats...
  assert.doesNotMatch(cardsSource, /\$\{Math\.abs\(effect\.minaTrust\)\} Mina trust/);
  assert.doesNotMatch(cardsSource, /Curtis pressure`/);
  // ...while cash, Health, and Heat keep their numeric tags (HUD-visible).
  assert.match(cardsSource, /\$\{Math\.abs\(effect\.cash\)\} cash/);
  assert.match(cardsSource, /\$\{Math\.abs\(effect\.heat\)\} Heat/);
});

test("the market feed lines read as the player's own count, and the crew popups lost their stat receipts", () => {
  const coreSource = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
  assert.doesNotMatch(coreSource, /You move \$\{qty\}/, "the old BUY receipt is gone");
  assert.doesNotMatch(coreSource, /Loyalty is down to/, "served release no longer prints the stat");
  assert.doesNotMatch(coreSource, /left the crew\. Loyalty ran out/, "departure no longer prints the stat");
  assert.doesNotMatch(coreSource, /gone, loyalty \$\{crew\.loyalty\}/, "bail popup no longer prints the stat");
});

// ---------------------------------------------------------------------------
// 4. Mina: the conversation tree
// ---------------------------------------------------------------------------

test("every band pool carries both shifts and at least four lines, and they all pass the voice gate", () => {
  const slang = /\b(gonna|wanna|yeah|bro|dawg|nah|yo)\b/i;
  for (const band of [BANDS.NEUTRAL, BANDS.WARM, BANDS.TRUSTED, BANDS.BONDED]) {
    const pools = Mina.MINA_LINES[band];
    assert.ok(pools, `band ${band} has pools`);
    assert.ok(pools.early.length >= 1 && pools.late.length >= 1, "both shifts are voiced");
    const all = [...pools.early, ...pools.late];
    assert.ok(all.length >= 4, `band ${band} carries at least four lines`);
    for (const line of all) {
      assertVoice(line, `Mina band ${band}`);
      assert.doesNotMatch(line, slang, `Mina never uses slang: ${line}`);
    }
  }
  for (const pool of Object.values(Mina.MINA_STATE_LINES)) {
    assert.ok(pool.length >= 3, "each state-reactive pool carries at least three lines");
    for (const line of pool) assertVoice(line, "Mina state line");
  }
});

test("below Neutral she goes formal, never hostile: the band key clamps up", () => {
  assert.equal(Mina.minaBandKey(BANDS.HOSTILE), BANDS.NEUTRAL);
  assert.equal(Mina.minaBandKey(BANDS.COLD), BANDS.NEUTRAL);
  assert.equal(Mina.minaBandKey(BANDS.NEUTRAL), BANDS.NEUTRAL);
  assert.equal(Mina.minaBandKey(BANDS.BONDED), BANDS.BONDED);
});

test("no Mina line repeats inside a three-visit window, and the rotation is deterministic", () => {
  const visit = (state) => {
    state.npc.mina.met = true;
    state.npc.mina.lastConversationDay = null;
    state.world.currentNeighborhoodId = "north_star_lot";
    state.run.slot = 2;
    return C.reduceGame(state, { type: "VISIT_MINA" });
  };
  let state = fresh(1704);
  const seen = [];
  for (let day = 1; day <= 6; day++) {
    state.run.day = day;
    state = visit(structuredClone(state));
    const recent = state.nightOwl.recentMinaLines;
    assert.ok(recent.length <= Mina.MINA_RECENT_LIMIT, "the memory keeps at most three lines");
    assert.equal(new Set(recent).size, recent.length, "nothing inside the window repeats");
    seen.push(recent[recent.length - 1]);
  }
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], "consecutive visits never repeat a line");
  // Same seed, same day, same slot: the same line. stringHash, not the rng.
  let a = fresh(1705); let b = fresh(1705);
  a = visit(a); b = visit(b);
  assert.equal(a.nightOwl.recentMinaLines[0], b.nightOwl.recentMinaLines[0]);
});

test("she reads the player before the register: arrest, injury, and money each pull their own pool", () => {
  const base = () => {
    const state = fresh(1706);
    state.npc.mina.met = true;
    state.npc.mina.lastConversationDay = null;
    state.world.currentNeighborhoodId = "north_star_lot";
    state.run.slot = 2;
    state.run.day = 3;
    return state;
  };
  const lineOf = (state) => C.reduceGame(state, { type: "VISIT_MINA" }).nightOwl.recentMinaLines.slice(-1)[0];
  const arrested = base();
  arrested.record.lastArrestDay = 2;
  assert.ok(Mina.MINA_STATE_LINES.arrested.includes(lineOf(arrested)), "a recent arrest pulls the arrested pool");
  const hurt = base();
  hurt.player.health = Mina.MINA_INJURED_HEALTH - 5;
  assert.ok(Mina.MINA_STATE_LINES.injured.includes(lineOf(hurt)), "a visible injury pulls the injured pool");
  const flush = base();
  flush.player.cash = Mina.MINA_FLUSH_CASH + 200;
  flush.player.cleanCash = flush.player.cash;
  assert.ok(Mina.MINA_STATE_LINES.flush.includes(lineOf(flush)), "a pocket full of money pulls the flush pool");
  const plain = base();
  plain.player.cash = 100; plain.player.cleanCash = 100;
  const bands = Mina.MINA_LINES[Mina.minaBandKey(BANDS.NEUTRAL)];
  assert.ok([...bands.early, ...bands.late].includes(lineOf(plain)), "otherwise the band pool speaks");
});

test("the two shifts carry different registers: slot 2 draws early, slot 3 draws late", () => {
  const at = (slot) => {
    const state = fresh(1707);
    state.npc.mina.met = true;
    state.npc.mina.lastConversationDay = null;
    state.world.currentNeighborhoodId = "north_star_lot";
    state.run.day = 4;
    state.run.slot = slot;
    state.player.cash = 100; state.player.cleanCash = 100;
    return C.reduceGame(state, { type: "VISIT_MINA" }).nightOwl.recentMinaLines.slice(-1)[0];
  };
  const bands = Mina.MINA_LINES[BANDS.NEUTRAL];
  assert.ok(bands.early.includes(at(2)), "Evening pulls the on-shift pool");
  assert.ok(bands.late.includes(at(3)), "Night pulls the comfort-zone pool");
});

// ---------------------------------------------------------------------------
// 5. Anchorage names
// ---------------------------------------------------------------------------

test("every boost and stick target carries a named identity line", () => {
  for (const target of C.BOOST_TARGETS) {
    assert.ok(target.desc && target.desc.trim().length, `${target.id} has a description`);
    assert.ok(words(target.desc) <= 25, `${target.id} description stays short`);
    assert.doesNotMatch(target.desc, /[—–]/);
    assert.doesNotMatch(target.name, /^Tier \d/i);
  }
  for (const target of STICK_TARGETS) {
    assert.ok(target.desc && target.desc.trim().length, `${target.id} has a description`);
    assert.ok(words(target.desc) <= 25, `${target.id} description stays short`);
    assert.doesNotMatch(target.desc, /[—–]/);
  }
  // The generic fuel names went to their real-strip replacements.
  const names = C.BOOST_TARGETS.map((target) => target.name).join("|");
  assert.doesNotMatch(names, /Spenard Fuel|Downtown Fuel|Airport Fuel|Warehouse Club|Delivery Route 4/);
  assert.match(names, /Spenard Chevron/);
  assert.match(names, /Ship Creek Yards/);
  // And the UI renders the identity line instead of the old tier template.
  assert.ok(uiSource.includes("{target.desc}"));
  assert.doesNotMatch(uiSource, /has what you need behind minimal security/);
});
