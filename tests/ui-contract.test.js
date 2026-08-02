const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");

test("active shell is Alpha v0.5 with no embedded legacy UI", () => {
  assert.match(ui, /Alpha v0\.5/); assert.match(html, /ui\.jsx/); assert.doesNotMatch(html, /legacy-v1-ui-reference|text\/plain/);
});
test("six approved navigation labels are explicit", () => {
  for (const label of ["Market", "Travel", "Operations", "People", "Finances", "Recovery"]) assert.match(ui, new RegExp(`"${label}"`));
  assert.doesNotMatch(ui, /Cash \+ Dre|Services/);
});
test("backgrounds, robbery, territory, and safe payoff surfaces are wired", () => {
  for (const token of ["background.combat", "background.charisma", "background.intelligence", 'type: "ROBBERY"', 'type: "TAKEOVER"', 'type: "PAY_CREW"', "safeDebtPayment", "window.confirm"]) assert.ok(ui.includes(token), token);
});
test("event and operation results expose decisions and consequences", () => {
  for (const token of ["event.who", "event.where", "event.stakes", "choice.preview", "result.rounds", "result.effects"]) assert.ok(ui.includes(token), token);
});
test("mobile primary controls retain a 44px target and six-column navigation", () => {
  assert.match(css, /min-height:44px/); assert.match(css, /grid-template-columns:repeat\(6,1fr\)/);
});
test("shared trade modal exposes signed transaction projections", () => {
  for (const token of ["tradeProjection", "Total cost", "Revenue", "Cost basis", "Profit", "Loss", "Cash after", "Cargo after", "Recent local context", "signedMoney"]) assert.ok(ui.includes(token), token);
  assert.match(css, /trade-projection/); assert.match(css, /trade-result\.profit/); assert.match(css, /trade-result\.loss/);
});
