const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
// v1.9c is a UI-only build: quiet time receipts, the Phone accordion hub, the
// Home shift shortcut, and the Travel row rename. These are source contracts
// in the ui-contract.test.js style — game-core.js is intentionally untouched
// by the build, so nothing here loads the reducer.
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("content-free time receipts are suppressed; real receipts keep the time band", () => {
  // The gate lives in GameShell's diff effect: a receipt with no delta lines
  // is pure time passage and never reaches the overlay.
  assert.match(ui, /setResult\(receipt && receipt\.lines\.length \? receipt : null\)/);
  // Receipts that do render are action results and keep their time band.
  assert.ok(ui.includes('<div className="result-time">{result.time.label}</div>'));
  // The day-end confirmation gate is untouched.
  assert.match(ui, /function EndDayModal/);
  assert.ok(ui.includes('type: "CONFIRM_END_DAY"'));
});

test("Phone is an accordion hub that opens with only Texts expanded", () => {
  assert.match(ui, /function PhoneSection\(\{ id, title, meta, badge, badgeTone, open, onToggle, children \}\)/);
  assert.ok(ui.includes('className="phone-section-head" aria-expanded={open} aria-controls={panelId}'));
  assert.ok(ui.includes("useState({ texts: true })"));
  for (const section of ['id="texts" title="Texts"', 'id="contacts" title="Contacts"', 'id="bills" title="Bills"', 'id="log" title="Today\'s Log"', 'id="intel" title="Word Around Town"']) assert.ok(ui.includes(section), section);
  // The 907List launcher stays a plain row outside the accordion.
  assert.match(ui, /<MenuRow title="907List"/);
});

test("phone accordion animates grid rows with a reduced-motion opt-out and 44px headers", () => {
  assert.ok(css.includes(".phone-section-panel{display:grid;grid-template-rows:0fr"));
  assert.ok(css.includes(".phone-section.open .phone-section-panel{grid-template-rows:1fr"));
  assert.match(css, /\.phone-section-head\{[^}]*min-height:44px/);
  assert.ok(css.includes("@media(prefers-reduced-motion:reduce){.phone-section-panel,.phone-section-chevron{transition:none}}"));
});

test("Phone hosts the same contacts logic as the standalone screens", () => {
  // Wholesale reuse — same component, same CONTACT_* dispatches, no duplicates.
  assert.ok(ui.includes("<SocialContacts state={state} dispatch={dispatch} navigateMore={navigateMore} />"));
  // The standalone surfaces and their contract strings survive.
  assert.match(ui, /<MenuRow title="Contacts"/);
  assert.ok(ui.includes("Personal and social contacts"));
});

test("Bills panel reads existing obligation state and stays display-only", () => {
  assert.match(ui, /function phoneBills\(state\)/);
  for (const token of ["No bills yet.", "Phone service", '"Pay at Home"', "Crew wages", "recruitedCrew(state)", "state.lender.balance"]) assert.ok(ui.includes(token), token);
  // Status ladder: red / amber / neutral / the one honest green.
  for (const token of ['"Service off"', '"Past due"', '"Due soon"', '"Upcoming"', '"Paid up"']) assert.ok(ui.includes(token), token);
  // Display-only: bill rows are divs, not buttons, and add no new pay dispatches.
  assert.ok(ui.includes('<div className={`bill-row'));
});

test("Home surfaces the active job with the canonical WORK_JOB dispatch", () => {
  assert.match(ui, /function HomeJobCard\(\{ state, dispatch \}\)/);
  assert.ok(ui.includes('type: "WORK_JOB", jobId: job.id, approach: "work_hard"'));
  assert.ok(ui.includes("<HomeJobCard state={state} dispatch={dispatch} />"));
  // No-job state is a prompt, not a dead button.
  assert.ok(ui.includes("No job yet"));
  assert.ok(ui.includes("Explore Street to find work."));
  // The two availability gaps the selector does not cover are spelled out.
  assert.ok(ui.includes("No energy left today."));
  assert.ok(ui.includes("The day is done. Settle tonight first."));
  assert.match(css, /\.work-shift-btn\{[^}]*min-height:52px/);
});

test("Street's travel row no longer repeats the screen it opens", () => {
  assert.ok(ui.includes('<MenuRow title="Travel" status={`In ${area.name}`}'));
  assert.doesNotMatch(ui, /<MenuRow title=\{`Around \$\{area\.name\}`\} status="Places & activities"/);
});

// Version-agnostic on purpose: v1.9c introduced the discipline that the two
// display strings and both cache-busters move together; later builds keep
// bumping them without editing this file.
test("version strings and cache-busters are present and consistent", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(html.includes(`v05.css?v=${pkg.version}`), "stylesheet cache-buster matches package.json");
  assert.ok(html.includes(`ui.built.js?v=${pkg.version}`), "bundle cache-buster matches package.json");
  assert.match(ui, /One Good Run · v\d/);
  assert.match(ui, /907Hustle v\d/);
});
