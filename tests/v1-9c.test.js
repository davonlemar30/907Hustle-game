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
// v1.14 moved the accordion and the action card into the design system, so the
// component assertions below read primitives.jsx and the screens that compose
// them read ui.jsx.
const ds = fs.readFileSync(path.join(root, "src", "ds", "primitives.jsx"), "utf8");
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

// v1.14 extracted the accordion into src/ds/primitives.jsx as AccordionSection.
// The guarantees below are v1.9c's and have not moved; only the component that
// delivers them has, so these assertions follow it rather than being deleted.
test("Phone is an accordion hub that opens with only Texts expanded", () => {
  assert.match(ds, /export function AccordionSection\(\{ title, meta, badge, badgeVariant, defaultExpanded, children \}\)/);
  assert.ok(ds.includes('className="accordion-header" aria-expanded={open} aria-controls={panelId}'));
  // Texts is the one section that opens on arrival; nothing else carries the flag.
  assert.ok(ui.includes('<AccordionSection title="Texts"'));
  assert.equal(ui.match(/<AccordionSection[^>]*defaultExpanded/g).length, 1);
  for (const section of ['title="Texts"', 'title="Contacts"', 'title="Bills"', 'title="Today\'s Log"', 'title="Word Around Town"']) assert.ok(ui.includes(`<AccordionSection ${section}`), section);
  // Expanded state stays out of the save.
  assert.doesNotMatch(ds, /accordion[^\n]*serialize/i);
  // The 907List launcher stays a plain row outside the accordion.
  assert.match(ui, /<MenuRow title="907List"/);
});

test("phone accordion animates grid rows with a reduced-motion opt-out and 44px headers", () => {
  assert.ok(css.includes(".accordion-body{display:grid;grid-template-rows:0fr"));
  assert.ok(css.includes(".accordion-section.open .accordion-body{grid-template-rows:1fr"));
  assert.match(css, /\.accordion-header\{[^}]*min-height:44px/);
  assert.ok(css.includes("@media(prefers-reduced-motion:reduce){.accordion-body,.accordion-chevron{transition:none}}"));
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
  // v1.14: the card is the shared ActionCard, and its CTA keeps the weight.
  assert.match(css, /\.action-card-cta\{[^}]*min-height:52px/);
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
