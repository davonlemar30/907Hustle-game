const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("Phase 1 HUD omits relationship adjectives and visit analytics", () => {
  assert.doesNotMatch(html, /Dre: <b>/);
  assert.doesNotMatch(html, /Rook: <b>/);
  assert.doesNotMatch(html, /Visit \{state\.run\.currentVisit\.trades\}/);
  assert.doesNotMatch(html, /Relationship: \{state\.lender\.relationship\}/);
});

test("Cash + Debt exposes total, loan disclosure, payoff state, and payment MAX", () => {
  assert.match(html, /You owe Dre/);
  assert.match(html, /View loan details/);
  assert.match(html, /Paid in full/);
  assert.match(html, /setPay\(paymentMax\)/);
});

test("trade quantity supports exact, fast-step, and MAX controls", () => {
  assert.match(html, /aria-label="Trade quantity"/);
  assert.match(html, />−5<\/button>/);
  assert.match(html, />\+5<\/button>/);
  assert.match(html, /setQty\(max\)\}>MAX/);
  assert.match(html, /Cash after/);
  assert.match(html, /Cargo space after/);
});
