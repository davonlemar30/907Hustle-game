const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");

test("active shell is Alpha v0.6 with a packaged title asset", () => {
  assert.match(ui, /Alpha v0\.6/); assert.match(html, /ui\.jsx/); assert.doesNotMatch(html, /legacy-v1-ui-reference|text\/plain/);
  assert.match(ui, /907hustle-title\.png/); assert.ok(fs.existsSync(path.join(root, "assets", "907hustle-title.png")));
});
test("title screen exposes safe load, new-game confirmation, preview, and help", () => {
  for (const token of ["Load Game", "New Game", "Saved run", "How to Play", "inspectSave", "HYDRATE_RUN", "replace the current autosave"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /screen !== "game"/);
});
test("new games expose only two edges while legacy Strategist remains in core tests", () => {
  assert.match(ui, /Choose your edge/); assert.match(ui, /C\.STARTING_EDGES\.map/); assert.doesNotMatch(ui, /C\.BACKGROUNDS\.map/);
});
test("four primary navigation labels and progressive More categories are explicit", () => {
  assert.match(ui, /const NAV = \[\["market", "Market"\], \["travel", "Travel"\], \["people", "People"\], \["more", "More"\]\]/);
  for (const label of ["Operations", "Finances", "Recovery", "Help"]) assert.match(ui, new RegExp(`title="${label}"`));
  assert.match(css, /grid-template-columns:repeat\(4,1fr\)/);
});
test("HUD shows three primary values and a one-tap status drawer", () => {
  for (const token of ['label="Day / Time"', 'label="Cash"', 'label="Heat"', "status-toggle", "Dre debt", "Crew Power"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /aria-expanded=\{open\}/);
});
test("People and Operations use nested full-screen navigation", () => {
  for (const token of ["Key People", "Recent History", "Quick Score", "Territory", "Gear", "Safehouse", "← Back"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /page\.startsWith\("crew:"\)/); assert.match(ui, /page === "safehouse"/);
});
test("Finance exposes increments, clamped preview, and reserve wording", () => {
  for (const token of ["+$25", "+$50", "+$100", "Safe Maximum", "Pay Full", "Cash remaining", "Debt remaining", "debtPaymentPreview", "Manage protected cash in Safehouse"]) assert.ok(ui.includes(token), token);
});
test("shared trade modal keeps projection parity and hides empty local context", () => {
  for (const token of ["tradeProjection", "Total cost", "Revenue", "Cost basis", "Profit", "Loss", "Cash after", "Cargo after", "signedMoney"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /projection\.localContext\.available &&/); assert.match(css, /trade-result\.profit/); assert.match(css, /trade-result\.loss/);
});
test("player-facing time copy avoids ambiguous slot terminology", () => {
  assert.doesNotMatch(ui, /Costs? 1 slot|one slot|advances exactly one slot/i); assert.match(ui, /part of day/); assert.match(ui, /Morning, Afternoon, Evening, and Night/);
});
test("mobile controls retain 44px targets and reduced-height title handling", () => {
  assert.match(css, /min-height:44px/); assert.match(css, /@media\(max-height:600px\)/); assert.match(css, /height:100dvh/);
});
