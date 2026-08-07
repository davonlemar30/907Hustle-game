const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");

test("active shell is v1.1 with a packaged title asset and no stale version copy", () => {
  assert.match(ui, /One Good Run · v1\.1/); assert.match(html, /ui\.jsx/); assert.doesNotMatch(html, /legacy-v1-ui-reference|text\/plain/);
  assert.match(ui, /907hustle-title\.png/); assert.ok(fs.existsSync(path.join(root, "assets", "907hustle-title.png")));
  assert.doesNotMatch(ui, /Alpha v0\.9|v0\.9/);
});
test("title screen exposes safe load, new-game confirmation, preview, and help", () => {
  for (const token of ["Load Game", "New Game", "Saved run", "How to Play", "inspectSave", "HYDRATE_RUN", "replace the current autosave"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /screen !== "game"/);
});
test("new games are classless and expose one Start from the Bottom confirmation", () => {
  assert.match(ui, /Start from the Bottom/); assert.match(ui, /type: "START_RUN"/); assert.doesNotMatch(ui, /Choose your edge|C\.STARTING_EDGES\.map|C\.BACKGROUNDS\.map/);
});
test("four primary navigation labels and progressive More categories are explicit", () => {
  assert.match(ui, /const NAV = \[\["market", "Market"\], \["travel", "Travel"\], \["people", "People"\], \["more", "More"\]\]/);
  for (const label of ["Street Read", "Operations", "Finances", "Recovery", "Help"]) assert.match(ui, new RegExp(`title="${label}"`));
  assert.match(css, /grid-template-columns:repeat\(4,1fr\)/);
});
test("Travel exposes the fresh-arrival activity and access model", () => {
  for (const token of ["Yalonda and John's Home", "Ship Creek Freight", "Explore Spenard", "Spenard Community Gym", "Northern Value", "Informal Game", "People Mover", "North Star Garage Listing", "Auto Lot", "Gun Counter"]) assert.ok(ui.includes(token), token);
});
test("HUD shows three primary values and a one-tap status drawer", () => {
  for (const token of ['label="Day / Time"', 'label="Cash"', 'label="Heat"', "status-toggle", 'Chip label="Debt"', "Crew Power"]) assert.ok(ui.includes(token), token);
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
test("title artwork declares all three aspect tiers and a letterbox backdrop", () => {
  assert.match(css, /@media\(min-aspect-ratio:3\/4\) and \(max-aspect-ratio:1\/1\)/);
  assert.match(css, /@media\(min-aspect-ratio:1\/1\)/);
  assert.match(css, /\.title-backdrop\{display:none\}/);
  assert.match(css, /object-fit:contain/);
  assert.match(ui, /className="title-backdrop"/);
  // Tier A must stay exactly as shipped in v0.6 so mobile does not move.
  assert.match(css, /\.title-art\{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top\}/);
});
test("the market close action names the player action and its destination", () => {
  assert.match(ui, /Finish Trading/);
  assert.doesNotMatch(ui, />End Market</);
  assert.match(ui, /nextPartLabel/);
  assert.match(ui, /Close this market visit/);
});
test("the optional Street Name is offered before classless confirmation and shown on the save", () => {
  assert.match(ui, /Street Name/); assert.match(ui, /maxLength=\{C\.STREET_NAME_MAX\}/);
  assert.match(ui, /What do they call you\?/); assert.match(ui, /streetName \}\)/);
  assert.match(ui, /\{preview\.name\}/); assert.match(ui, /Seven days as \{summary\.streetName\}/);
});
test("Character is nested under More and hides identity internals", () => {
  for (const token of ["function Character", "Strength", "Endurance", "Reflexes", "Presence", "Insight", "Discipline", "Derived ratings", "Recent reputation", "legacyBackground"]) assert.ok(ui.includes(token), token);
  assert.doesNotMatch(ui, /behavior\.scores|pendingIdentityNights|25 percent|raw margin/i);
  assert.equal((ui.match(/\[\["market", "Market"\]/g) || []).length, 1);
});
test("registry metadata never reaches the presentation layer", () => {
  for (const leak of [/event\.stage/, /event\.cooldown/, /event\.weight/, /event\.requires/, /event\.chain/, /chainStage/]) {
    assert.doesNotMatch(ui, leak, String(leak));
  }
});

// --- v1.1 UI/UX presentation pass -------------------------------------------

test("Operations remains reachable only through More, and the nav highlights More while it is open", () => {
  assert.match(ui, /if \(page === "operations"\) return <Operations/);
  assert.match(ui, /function More\(/);
  // Operations is never rendered by the top-level `screens` tab map, so the
  // active nav tab stays "more" the whole time Operations is on screen —
  // it can never read as "people" while Operations is showing.
  assert.doesNotMatch(ui, /travel: <Operations|people: <Operations|market: <Operations/);
});

test("Territory Blocks and District Control render as visually and textually separate concepts", () => {
  assert.match(ui, /Territory Blocks/);
  assert.match(ui, /District Control/);
  assert.match(ui, /className="territory-board"/);
  assert.match(ui, /className="district-summary"/);
  assert.doesNotMatch(ui, /Territory Blocks · District Control|District Control · Territory Blocks/);
});

test("Eli's standing-order policies render as selectable, labeled controls", () => {
  assert.match(ui, /C\.ELI_OPERATION_POLICIES/);
  assert.match(ui, /className="policy-grid"/);
  assert.match(ui, /className={`policy-btn/);
  assert.match(ui, /role="radio"/);
  assert.match(ui, /SET_ELI_POLICY/);
});

test("Kip never appears in the field-assignable crew list", () => {
  assert.match(ui, /recruitedCrew\(state\)\.filter\(\(person\) => person\.canFieldAssign\)/);
  assert.match(ui, /recruitedCrew\(state\)\.filter\(\(person\) => !person\.canFieldAssign\)/);
});

test("Finances renders dirty, clean, and protected money as distinct metrics", () => {
  assert.match(ui, /metric-tile dirty/);
  assert.match(ui, /metric-tile clean/);
  assert.match(ui, /metric-tile protected/);
  for (const token of ["Dirty", "Clean", "Protected"]) assert.ok(ui.includes(token), token);
});

test("disabled actions carry a reason instead of leaving the player to guess", () => {
  assert.match(ui, /action-copy">\{recruit\.available \? "Uses one part of day" : recruit\.reason\}/);
  assert.match(ui, /action-copy">\{claim\.available \? "Uses one part of day" : claim\.reason\}/);
  assert.match(ui, /action-copy">\{avail\.available \? "Free · no time cost" : avail\.reason\}/);
});

test("status chips exist for Heat and Dre and carry escalation tone classes", () => {
  assert.match(ui, /className="hud chip-row"/);
  assert.match(ui, /tone=\{state\.player\.heat >= 8 \? "escalated" : state\.player\.heat <= 2 \? "calm" : ""\}/);
  assert.match(ui, /tone=\{dreOverdue \|\| dreDueTonight \? "escalated"/);
  assert.match(css, /\.status-chip\.escalated/);
});

test("block ownership state is labeled in text, not signaled by color alone", () => {
  assert.match(ui, /Controlled/);
  assert.match(ui, /Rook Held/);
  assert.match(ui, /Unclaimed/);
  assert.match(ui, /className="node-state"/);
});

test("Finances is a general financial hub, not a Dre-centric debt screen", () => {
  assert.match(ui, /Cash, debt, and financial risk across the operation/);
  assert.match(ui, /Debt & Obligations/);
  assert.match(ui, /Financial Heat/);
  assert.doesNotMatch(ui, /Dre's note · due Day/);
  assert.match(ui, /debt-kicker">Debt/);
});

test("the lender's identity is nested inside expanded debt detail, not the persistent HUD or summary", () => {
  assert.match(ui, /setDebtOpen\(!debtOpen\)/);
  assert.match(ui, /Lender: \{state\.lender\.name\}/);
  assert.doesNotMatch(ui, /Chip label="Dre debt"/);
});
