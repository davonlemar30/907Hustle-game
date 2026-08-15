const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
// v1.14 is a presentation-only build: a component library extracted into the
// design system, a three-destination Travel menu, fullscreen Tonk, and an
// honest Market close label. game-core.js is untouched by design, so most of
// what follows is a source contract in the ui-contract.test.js style. The one
// reducer assertion at the bottom is the guard on that claim.
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const ds = fs.readFileSync(path.join(root, "src", "ds", "primitives.jsx"), "utf8");
const types = fs.readFileSync(path.join(root, "src", "ds", "index.d.ts"), "utf8");
const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");
const C = require("../game-core.js");

// ---------------------------------------------------------------------------
// 1. The component library
// ---------------------------------------------------------------------------

test("AccordionSection, ActionCard, and BadgeHeader live in the design system", () => {
  for (const component of ["AccordionSection", "ActionCard", "BadgeHeader"]) {
    assert.match(ds, new RegExp(`export function ${component}\\(`), `${component} is exported from primitives`);
    assert.match(types, new RegExp(`export declare function ${component}\\(props: ${component}Props\\)`), `${component} has a prop contract`);
  }
  // The two screen-level components are composed by ui.jsx; BadgeHeader is the
  // accordion's own header, which is how the Phone's badges are drawn.
  for (const component of ["AccordionSection", "ActionCard"]) assert.match(ui, new RegExp(`\\b${component}\\b`), `${component} is used by the game`);
  assert.ok(ds.includes("<BadgeHeader label={title} meta={meta} count={badge} variant={badgeVariant} />"));
  // One definition serves the game and the synced design system, so none of
  // them may read game state.
  assert.doesNotMatch(ds, /window\.GameCore\.\w|C\.selectors/);
});

test("a zero count renders no badge at all", () => {
  assert.ok(ds.includes("{count != null && count !== 0 && <span className={`badge badge-${variant}`}>{count}</span>}"));
  for (const variant of ["neutral", "warning", "danger"]) {
    assert.ok(css.includes(`.badge-${variant}{`) || variant === "neutral", `badge-${variant} is styled`);
  }
  assert.match(css, /\.badge\{[^}]*border-radius/);
});

test("the accordion keeps its 44px header, its grid-row animation, and its reduced-motion opt-out", () => {
  assert.match(css, /\.accordion-header\{[^}]*min-height:44px/);
  assert.ok(css.includes(".accordion-body{display:grid;grid-template-rows:0fr"));
  assert.ok(css.includes(".accordion-section.open .accordion-body{grid-template-rows:1fr"));
  assert.ok(css.includes("@media(prefers-reduced-motion:reduce){.accordion-body,.accordion-chevron{transition:none}}"));
  // Closed panels drop out of the tab order rather than staying focusable.
  assert.match(css, /\.accordion-body\{[^}]*visibility:hidden/);
});

test("a blocked ActionCard keeps its button and says why", () => {
  assert.ok(ds.includes("<small>{disabled ? disabledReason : hint}</small>"));
  // The card itself is never greyed out — the copy on it is the explanation.
  assert.doesNotMatch(ds, /card action-card\$\{disabled/);
  assert.match(css, /\.action-card-cta:disabled\{[^}]*cursor:not-allowed/);
});

test("Phone and Home are powered by the shared components, not private copies", () => {
  assert.doesNotMatch(ui, /function PhoneSection\(/);
  assert.doesNotMatch(ui, /className="phone-section/);
  assert.doesNotMatch(ui, /className="work-shift-btn"/);
  // The renamed rules leave no orphan selectors behind (comments naming the
  // old classes are the migration note, and are allowed).
  for (const dead of [".phone-section{", ".phone-section-head{", ".phone-badge{", ".work-shift-btn{", ".job-card{"]) assert.ok(!css.includes(dead), dead);
  assert.equal((ui.match(/<AccordionSection\b/g) || []).length, 6, "five Phone sections plus the Spenard learned panel");
  assert.match(ui, /<ActionCard\b/);
});

// ---------------------------------------------------------------------------
// 2. Travel: three destinations
// ---------------------------------------------------------------------------

test("Travel offers exactly three top-level destinations", () => {
  const travel = ui.slice(ui.indexOf("function Travel({"), ui.indexOf("function StreetScreen({"));
  const rows = travel.match(/<MenuRow\b/g) || [];
  assert.equal(rows.length, 3, "the neighbourhood, Home, and the way out");
  assert.match(travel, /<MenuRow title=\{area\.name\}/);
  assert.match(travel, /<MenuRow title="Home"/);
  assert.match(travel, /<MenuRow title="Leave Spenard"/);
  // The quick-shift shortcut is an action, not a fourth destination.
  assert.match(travel, /className=\{`quick-shift/);
});

test("everything the old Travel menu carried is still reachable", () => {
  // Neighbourhood hub -> Explore Spenard -> Places / Activities -> Jobs,
  // Wander, Contacts, and every discovered door.
  for (const token of ['<MenuRow title="Explore Spenard"', '<MenuRow title="Wander"', '<MenuRow title="Jobs"', '<MenuRow title="Contacts"', '<MenuRow title="Places"', '<MenuRow title="Night Owl"', '<MenuRow title="The Nile"']) {
    assert.ok(ui.includes(token), token);
  }
  // Home keeps storage, the household, and sleep; Leave Spenard keeps transit.
  assert.match(ui, /function Household\(/);
  assert.ok(ui.includes('type: "SLEEP_HOME"'));
  assert.match(ui, /function Destinations\(/);
  assert.match(ui, /<Transit state=\{state\} dispatch=\{dispatch\} \/>/);
});

test("Local Intel is content in the neighbourhood hub, not a menu row of its own", () => {
  assert.doesNotMatch(ui, /<MenuRow title="Local Intel"/);
  assert.doesNotMatch(ui, /function LocalIntel\(/);
  assert.match(ui, /function LearnedInSpenard\(/);
  // Gated on the same district action the row used, so nothing about when it
  // appears has changed.
  assert.ok(ui.includes('{actionOf("local_intel") && <LearnedInSpenard state={state} />}'));
  assert.ok(ui.includes("DISCOVERY_LABELS"));
});

test("the People Mover fare is stated up front and blocks with a reason", () => {
  assert.ok(ui.includes("The People Mover is $5 a ride unless a pass covers it."));
  assert.ok(ui.includes("Your pass covers the fare."));
  // Per destination: the fare, and the selector's reason when it cannot be paid.
  assert.ok(ui.includes('const fare = access.cashCost ? "$5" : "Pass covers it";'));
  assert.ok(ui.includes("disabled={!access.available}"));
});

test("the reducer, not the UI, still owns the fare", () => {
  const state = C.createRun({ seed: 4242 });
  const broke = { ...state, player: { ...state.player, cash: 0 } };
  assert.equal(C.selectors.travelAvailability(broke, "downtown").available, false);
  assert.match(C.selectors.travelAvailability(broke, "downtown").reason, /\$5/);
  const flush = { ...state, player: { ...state.player, cash: 200 } };
  assert.equal(C.selectors.travelAvailability(flush, "downtown").cashCost, 5);
});

// ---------------------------------------------------------------------------
// 3. Tonk fullscreen
// ---------------------------------------------------------------------------

test("a live Tonk hand takes the whole viewport", () => {
  assert.match(ui, /const tonkLive = !!state\.gambling\.table/);
  assert.match(ui, /const \[tonkFullscreen, setTonkFullscreen\] = useState\(tonkLive\)/);
  assert.ok(ui.includes('<div className={`app${tonkStage ? " tonk-fullscreen" : ""}`}>'));
  // The HUD band and the bottom dock come off screen together.
  assert.ok(css.includes(".app.tonk-fullscreen>.top,.app.tonk-fullscreen>.dock{display:none}"));
  assert.ok(css.includes(".app.tonk-fullscreen{grid-template-rows:minmax(0,1fr)}"));
  assert.ok(ui.includes('<div className="dock">'), "the bottom block is addressable");
});

test("the fullscreen flag is presentation state and never reaches a save", () => {
  // No new persisted field: the reducer's own gambling.table is the source of
  // truth, and the flag is derived from it on every change.
  assert.ok(ui.includes("useEffect(() => { setTonkFullscreen(tonkLive); if (!tonkLive) setConfirmQuitTonk(false); }, [tonkLive]);"));
  assert.doesNotMatch(ui, /tonkFullscreen[^\n]*serializeRun|SAVE_KEY[^\n]*tonkFullscreen/);
  const state = C.createRun({ seed: 7 });
  assert.equal("tonkFullscreen" in state, false);
  assert.equal(JSON.parse(C.serializeRun(state)).tonkFullscreen, undefined);
});

test("Quit and Back are both reachable and mean different things", () => {
  assert.match(ui, /function TonkStage\(\{ state, dispatch, onBack, onQuit \}\)/);
  assert.ok(ui.includes('<button type="button" className="tonk-quit" onClick={onQuit}>Quit</button>'));
  assert.ok(ui.includes('<button type="button" onClick={onBack}>Back</button>'));
  // Back is presentation only; Quit is a real drop, so it asks first.
  assert.ok(ui.includes("onBack={() => setTonkFullscreen(false)}"));
  assert.ok(ui.includes('act({ type: "NILE_TONK_DROP" })'));
  assert.match(ui, /confirmQuitTonk && <ConfirmPrompt title="Quit the hand\?"/);
  // A hand left standing is one tap from the table again.
  assert.ok(ui.includes("Back to the table"));
  assert.match(css, /\.tonk-exit button\{[^}]*min-height:44px/);
  assert.match(css, /\.tonk-exit\{position:fixed/);
});

test("the opponent's play is held long enough to read, and respects reduced motion", () => {
  assert.match(ui, /const CARD_DROP_MS = 1900/);
  assert.match(ui, /function useOpponentDrop\(view\)/);
  assert.ok(ui.includes("setTimeout(() => setDrop(null), CARD_DROP_MS)"));
  // 200ms in, 1.5s held, 200ms out — the keyframes divide the same total.
  assert.ok(css.includes("animation:card-reveal 1900ms ease-out both"));
  assert.match(css, /@keyframes card-reveal\{/);
  assert.ok(css.includes("@media(prefers-reduced-motion:reduce){.card-drop-inner{animation:none}}"));
  // Card face plus who played it.
  assert.ok(ui.includes("<PlayingCard card={drop.card} disabled />"));
  assert.ok(ui.includes("`Seat ${drop.seat} plays`"));
});

test("a finished hand always gets its result card", () => {
  // v1.9c suppresses receipts with no delta lines. A lost hand has none — the
  // buy-in left the wallet when the player sat down — so the one moment the
  // fullscreen table hands the shell back would otherwise pass in silence.
  assert.ok(ui.includes("const handEnded = !!record.before.gambling.table && !state.gambling.table;"));
  assert.ok(ui.includes('if (receipt && handEnded) { setResult({ ...receipt, title: "Hand Resolved" }); return; }'));
  // The quiet-receipt rule itself is untouched for every other action.
  assert.ok(ui.includes("setResult(receipt && receipt.lines.length ? receipt : null);"));
  // actionResult already carries the reducer's closing line as `detail`, which
  // is the win / loss / Tonk-out copy and its payout.
  const state = C.createRun({ seed: 31 });
  assert.equal(typeof C.selectors.actionResult, "function");
  assert.equal(C.selectors.actionResult(state, state, "NILE_TONK_DROP"), null);
});

test("fullscreen Tonk changes presentation only", () => {
  // The stage renders the same table component the Nile hub does, and adds no
  // dispatch of its own beyond the drop Quit already maps to.
  const stage = ui.slice(ui.indexOf("function TonkStage("), ui.indexOf("function CeloTable("));
  assert.match(stage, /<TonkTable state=\{state\} dispatch=\{dispatch\} \/>/);
  assert.doesNotMatch(stage, /dispatch\(\{ type:/);
});

// ---------------------------------------------------------------------------
// 4. The Market close label
// ---------------------------------------------------------------------------

test("the Market close button names the move and its price in time", () => {
  assert.ok(ui.includes("Leave Market · advance to {nextPartLabel(state)}"));
  assert.ok(ui.includes("<small>Ends your market visit</small>"));
  assert.doesNotMatch(ui, /Finish Trading/);
  // Same dispatch as before the relabel.
  assert.ok(ui.includes('act({ type: "END_MARKET" })'));
});

test("END_MARKET still closes the visit and advances the clock", () => {
  let state = C.createRun({ seed: 909 });
  state = C.reduceGame(state, { type: "START_RUN", streetName: "Test" });
  state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  const before = state.run.slot;
  const after = C.reduceGame(state, { type: "END_MARKET" });
  assert.notEqual(after, state, "END_MARKET is still handled");
  assert.notEqual(after.run.slot, before);
});
