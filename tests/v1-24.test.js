const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../game-core.js");
const Exposure = require("../src/exposure/engine.js");
const { NPC_CHANNELS, NPC_PRESENCE_AREAS, CHANNELS } = require("../src/data/propagation.js");
const { resolveLens } = require("../src/data/npc-lenses.js");
const { SPENARD_BLOCKS, SPENARD_BLOCK_BY_ID, HOME_DISTRICT_ID } = require("../src/data/locations.js");
const { stringHash } = require("../src/hash.js");

// v1.24 - The first-claim ceremony.
//
// Until now the first corner the player ever put their name on read exactly
// like the sixth: one feed line, generic, indistinguishable. Phase 2 got there
// first in both directions - v1.21 wrote the copy for losing a corner and v1.23
// wrote seven voices warning about one - so the game could tell you a corner
// was threatened and tell you it was gone, and had nothing to say about winning
// the first one.
//
// The first claim now gets four things the rest do not:
//
//   the card    a titled consequence card. The only titled card in the game so
//               far; `title` is new on pushConsequence and optional.
//   the text    Deshawn, same day, by name. "Word Around Town" when he is not
//               on the roster.
//   the feed    its own line, framed as a beginning rather than an increment.
//   the block   a growth/first_territory observation on the neighborhood
//               channel, so the people who live there register it.
//
// Nothing is persisted for any of it. `controlledBlockCount(state) === 0`
// answers "is this the first", and it is a derived read over the board, so the
// save schema stays at v11.

const root = path.join(__dirname, "..");
const coreSource = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "v05.css"), "utf8");

const FIRST_EVENT = "first_territory";
const CARD_TITLE = "Your Corner";
// Cheapest first, so a single cash float covers a whole run of claims.
const CLAIM_ORDER = [...SPENARD_BLOCKS].sort((a, b) => a.claimCost - b.claimCost).map((block) => block.id);

// Seeds must be NUMERIC. `normalizeSeed` (src/events/random.js) falls back to a
// single constant whenever `Number(seed)` is not finite, so every string seed in
// the suite is silently the SAME run - which makes a "checked across four seeds"
// loop four copies of one seed, passing for the wrong reason. Labels stay
// readable and the seed still varies by hashing the label.
function seedFor(label) {
  return stringHash(`v1.24:${label}`);
}

function fresh(label) {
  const seed = seedFor(label);
  let state = C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "TwentyFour" });
  if (state.run.openingPending) state = C.reduceGame(state, { type: "DISMISS_OPENING" });
  let guard = 0;
  while (state.run.pendingEvent && guard++ < 6) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  state.run.pendingEncounter = null;
  state.run.pendingOperationResult = null;
  state.run.dayEndPending = false;
  state.phone.active = true;
  return structuredClone(state);
}

// A state that can actually claim: garage controlled, Eli standing as the
// operations lieutenant, cash on hand, and `soldiers` unassigned bodies waiting.
// Everything blockClaimAvailability gates on, and nothing else.
function claimReady(label, { soldiers = 6, cash = 5000, deshawn = null } = {}) {
  const state = fresh(label);
  state.base.controlled = true;
  state.player.cash = cash;
  Object.assign(state.people.crew.eli, {
    introduced: true, recruited: true, status: "active", loyalty: 8, recruitedDay: 1,
    lieutenantStage: "operations_lieutenant", lieutenantEffectiveness: 1, operationPolicy: "manual",
  });
  if (deshawn) {
    Object.assign(state.people.crew.deshawn, {
      introduced: true, recruited: true, loyalty: 9, recruitedDay: 1, tier: 1, ...deshawn,
    });
  }
  for (let i = 1; i <= soldiers; i += 1) {
    state.world.soldiers[`soldier_${i}`] = { id: `soldier_${i}`, status: "active", blockId: null };
  }
  return state;
}

// A claim runs advanceRun, which spends a slot and an energy point and can
// raise an event or an encounter on the way through. Four claims empty a day,
// and a fifth is refused inside advanceRun - atomically, so the corner stays
// Curtis's rather than being taken for free.
//
// A real player sleeps between them. This is that: resolve whatever came up,
// put the clock back at Morning, and hand back a rested player. Queues, feed
// and ledgers are deliberately untouched, because those are what the tests
// below are diffing.
function settle(state) {
  let current = state;
  let guard = 0;
  while (current.run.pendingEvent && guard++ < 6) current = C.reduceGame(current, { type: "RESOLVE_EVENT", choiceIndex: 0 });
  current = structuredClone(current);
  current.run.pendingEvent = null;
  current.run.pendingEncounter = null;
  current.run.pendingOperationResult = null;
  current.run.dayEndPending = false;
  current.run.slot = 0;
  current.player.energy = C.MAX_ENERGY;
  return current;
}

// Dispatch a claim and hand back the state after it. Asserts the claim actually
// happened, because CLAIM_BLOCK returns the input state unchanged on any failed
// gate - a silently rejected claim would make every absence assertion below
// pass for the wrong reason.
function claim(state, blockId) {
  const before = state.world.territoryBlocks[blockId].owner;
  const after = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId });
  assert.notEqual(before, "player", `${blockId} was already claimed`);
  assert.equal(after.world.territoryBlocks[blockId].owner, "player", `CLAIM_BLOCK on ${blockId} was rejected`);
  return after;
}

// Claim `count` corners in a row off one state, returning each intermediate.
// The consequence queue, inbox, feed and ledgers are never cleared between
// claims, so "did the second claim add a card" is answered by diffing against
// the previous step rather than by resetting state a real player never resets.
function claimSeries(state, count) {
  const steps = [];
  let current = state;
  for (let i = 0; i < count; i += 1) {
    current = claim(settle(current), CLAIM_ORDER[i]);
    steps.push(current);
  }
  return steps;
}

function firstTerritoryRows(state, npcId) {
  const landed = (state.npc[npcId]?.ledger || []).filter((row) => row.event === FIRST_EVENT);
  const pending = (state.run.pendingObservations || [])
    .filter((row) => row.npcId === npcId && row.observation?.event === FIRST_EVENT)
    .map((row) => row.observation);
  return [...landed, ...pending];
}

function allFirstTerritoryRows(state) {
  const rows = [];
  for (const npcId of C.EXPOSURE_NPC_IDS) {
    for (const row of firstTerritoryRows(state, npcId)) rows.push({ npcId, row });
  }
  return rows;
}

function cardsAfter(state) {
  return state.run.consequenceQueue || [];
}

function firstClaimCards(state) {
  return cardsAfter(state).filter((card) => card.title === CARD_TITLE);
}

function inboxOf(state) {
  return [...state.phone.inbox, ...state.phone.heldInbox];
}

function claimTexts(state, blockName) {
  return inboxOf(state).filter((item) => item.text.includes(blockName));
}

// ---------------------------------------------------------------------------
// 1. The branch itself
// ---------------------------------------------------------------------------

function heldCount(state) {
  return SPENARD_BLOCKS.filter((block) => state.world.territoryBlocks[block.id].owner === "player").length;
}

test("the first claim is the one where the player held nothing", () => {
  const state = claimReady("first-branch");
  assert.equal(heldCount(state), 0, "starts holding nothing");
  const [one, two] = claimSeries(state, 2);
  assert.equal(heldCount(one), 1, "one corner after the first claim");
  assert.equal(firstClaimCards(one).length, 1, "first claim fires the ceremony");
  assert.equal(heldCount(two), 2, "two corners after the second");
  assert.equal(firstClaimCards(two).length, 1, "second claim adds no second ceremony");
});

test("the check is read before the block changes hands", () => {
  // If isFirstClaim were computed after `block.owner = \"player\"` the count
  // would already be 1 and the ceremony would never fire for anyone.
  const source = coreSource.slice(coreSource.indexOf('if (action.type === "CLAIM_BLOCK")'));
  const caseBody = source.slice(0, source.indexOf('if (action.type === "VISIT_MINA")'));
  const checkAt = caseBody.indexOf("const isFirstClaim");
  const ownerAt = caseBody.indexOf('block.owner = "player"');
  assert.ok(checkAt > -1, "the branch exists");
  assert.ok(ownerAt > -1, "the ownership write exists");
  assert.ok(checkAt < ownerAt, "isFirstClaim is read before the ownership write");
});

test("the ceremony fires exactly once across a full six-corner sweep", () => {
  const steps = claimSeries(claimReady("full-sweep"), SPENARD_BLOCKS.length);
  assert.equal(steps.length, 6, "all six corners claimed");
  assert.equal(heldCount(steps[5]), 6, "the whole district is the player's");
  // Counted per step rather than off the final queue: consequenceQueue keeps
  // only the last six cards, so a sweep that raised other cards could evict the
  // ceremony one and make a naive end-state count pass for the wrong reason.
  const fired = steps.filter((step, i) => firstClaimCards(step).length > firstClaimCards(steps[i - 1] || { run: {} }).length).length;
  assert.equal(fired, 1, "the titled card was pushed on exactly one claim");
  assert.equal(firstClaimCards(steps[0]).length, 1, "and that claim was the first");
  const events = allFirstTerritoryRows(steps[5]);
  assert.ok(events.length > 0, "the observation went out");
  // Merged rows carry a count. One claim means one, no matter how many
  // corners followed.
  for (const { npcId, row } of events) assert.equal(row.count, 1, `${npcId} heard it once`);
});

// ---------------------------------------------------------------------------
// 2. The consequence card
// ---------------------------------------------------------------------------

test("the first claim pushes a titled, positive consequence card naming the block", () => {
  const blockId = CLAIM_ORDER[0];
  const state = claim(claimReady("card"), blockId);
  const cards = firstClaimCards(state);
  assert.equal(cards.length, 1, "one card");
  assert.equal(cards[0].title, CARD_TITLE);
  assert.equal(cards[0].tone, "good", "positive tone, which is the green stripe");
  assert.ok(cards[0].text.includes(SPENARD_BLOCK_BY_ID[blockId].name), "names the block");
  assert.ok(cards[0].text.includes("First one's yours"), "the authored copy");
});

test("claims two through six push no ceremony card", () => {
  const steps = claimSeries(claimReady("card-absent"), 6);
  for (let i = 1; i < steps.length; i += 1) {
    const added = cardsAfter(steps[i]).filter((card) => !cardsAfter(steps[i - 1]).some((prior) => prior.id === card.id));
    assert.deepEqual(added.filter((card) => card.title === CARD_TITLE), [], `claim ${i + 1} added no ceremony card`);
  }
});

test("pushConsequence's title is optional and old three-arg calls are unchanged", () => {
  // The block-loss card (v1.21) is the reference three-arg caller. Driving it
  // through a real claim is the cheapest way to get an untitled card into the
  // queue on the same code path.
  const state = claimReady("back-compat");
  const after = C.reduceGame(claim(state, CLAIM_ORDER[0]), { type: "ASSIGN_BLOCK_MANAGER", blockId: CLAIM_ORDER[0], crewId: "eli" });
  for (const card of cardsAfter(after)) {
    assert.equal(typeof card.title, "string", "every card carries a string title");
    if (card.title !== CARD_TITLE) assert.equal(card.title, "", "an untitled card is empty, not undefined");
  }
});

test("a card queued before this build had a title field renders untouched", () => {
  // An old save's consequenceQueue has no `title` at all. The renderer tests
  // truthiness, so undefined has to behave exactly like "".
  const legacy = { id: "1:0:0:legacy", text: "Curtis has Fourth Avenue Strip.", tone: "bad" };
  assert.equal(Boolean(legacy.title), false, "undefined title is falsy, so no heading renders");
});

// ---------------------------------------------------------------------------
// 3. The phone text
// ---------------------------------------------------------------------------

test("Deshawn texts by name when he is on the roster", () => {
  const blockId = CLAIM_ORDER[0];
  const name = SPENARD_BLOCK_BY_ID[blockId].name;
  const state = claim(claimReady("deshawn-here", { deshawn: { status: "active" } }), blockId);
  const texts = claimTexts(state, name).filter((item) => item.from === "Deshawn");
  assert.equal(texts.length, 1, "one text from Deshawn");
  assert.ok(texts[0].text.includes("You got one."), "his voice");
  assert.ok(texts[0].text.includes(name), "names the corner");
});

test("the text falls back to Word Around Town when Deshawn was never recruited", () => {
  const blockId = CLAIM_ORDER[0];
  const name = SPENARD_BLOCK_BY_ID[blockId].name;
  const state = claim(claimReady("deshawn-absent"), blockId);
  assert.equal(state.people.crew.deshawn.recruited, false, "he really is off the roster");
  const texts = claimTexts(state, name);
  assert.equal(texts.length, 1, "still exactly one text");
  assert.equal(texts[0].from, "Word Around Town", "no sender name");
  assert.ok(texts[0].text.includes("Word travels fast around here"), "the anonymous copy");
});

test("a departed Deshawn does not text", () => {
  const blockId = CLAIM_ORDER[0];
  const name = SPENARD_BLOCK_BY_ID[blockId].name;
  for (const status of ["departed", "arrested"]) {
    const state = claim(claimReady(`deshawn-${status}`, { deshawn: { status } }), blockId);
    const texts = claimTexts(state, name);
    assert.equal(texts.length, 1, `${status}: one text`);
    assert.equal(texts[0].from, "Word Around Town", `${status}: falls back rather than texting from a man who is gone`);
  }
});

test("the text is same-day, not carried by the neighborhood", () => {
  const state = claimReady("timing", { deshawn: { status: "active" } });
  const after = claim(state, CLAIM_ORDER[0]);
  const text = inboxOf(after).find((item) => item.from === "Deshawn");
  assert.ok(text, "it arrived");
  assert.equal(text.day, state.run.day, "same day");
  assert.equal(text.slot, state.run.slot, "same slot - a direct observation, not gossip");
});

test("with the phone off the text is held rather than lost", () => {
  const state = claimReady("phone-off", { deshawn: { status: "active" } });
  state.phone.active = false;
  const after = claim(state, CLAIM_ORDER[0]);
  assert.equal(after.phone.inbox.some((item) => item.from === "Deshawn"), false, "nothing in the live inbox");
  assert.equal(after.phone.heldInbox.some((item) => item.from === "Deshawn"), true, "held for when service comes back");
});

test("claims two through six send no text", () => {
  const steps = claimSeries(claimReady("text-absent", { deshawn: { status: "active" } }), 6);
  for (let i = 1; i < steps.length; i += 1) {
    const name = SPENARD_BLOCK_BY_ID[CLAIM_ORDER[i]].name;
    assert.deepEqual(claimTexts(steps[i], name), [], `claim ${i + 1} sent no text`);
  }
});

// ---------------------------------------------------------------------------
// 4. The feed line
// ---------------------------------------------------------------------------

test("the first claim writes its own feed line and the second writes the generic one", () => {
  const [one, two] = claimSeries(claimReady("feed"), 2);
  const firstName = SPENARD_BLOCK_BY_ID[CLAIM_ORDER[0]].name;
  const secondName = SPENARD_BLOCK_BY_ID[CLAIM_ORDER[1]].name;

  const firstLine = one.log.find((entry) => entry.text.includes(firstName));
  assert.ok(firstLine, "the first claim logged");
  assert.ok(firstLine.text.startsWith("First corner claimed:"), "the first-claim framing");
  assert.ok(firstLine.text.includes(firstName), "names the block");

  const secondLine = two.log.find((entry) => entry.text.includes(secondName));
  assert.ok(secondLine, "the second claim logged");
  assert.ok(secondLine.text.includes("answers to your operation now"), "the generic line, unchanged");
  assert.equal(secondLine.text.startsWith("First corner claimed:"), false, "not the ceremony line");
});

test("every claim one through six still logs, and only one is the ceremony line", () => {
  const steps = claimSeries(claimReady("feed-sweep"), 6);
  const ceremony = steps[5].log.filter((entry) => entry.text.startsWith("First corner claimed:"));
  assert.equal(ceremony.length, 1, "one ceremony line in the whole feed");
  const generic = steps[5].log.filter((entry) => entry.text.includes("answers to your operation now"));
  assert.equal(generic.length, 5, "five generic lines");
});

// ---------------------------------------------------------------------------
// 5. The observation
// ---------------------------------------------------------------------------

test("the first claim emits growth/first_territory and later claims do not", () => {
  const steps = claimSeries(claimReady("observation"), 6);
  const rows = allFirstTerritoryRows(steps[0]);
  assert.ok(rows.length > 0, "somebody on the block heard it");
  for (const { npcId, row } of rows) {
    assert.equal(row.type, "growth", `${npcId}: growth`);
    assert.equal(row.event, FIRST_EVENT, `${npcId}: first_territory`);
    assert.equal(row.value, 1, `${npcId}: value 1`);
    assert.equal(row.source, "neighborhood", `${npcId}: carried by the neighborhood, not witnessed`);
  }
  assert.equal(allFirstTerritoryRows(steps[5]).length, rows.length, "no further rows across five more claims");
});

test("the observation reaches neighborhood NPCs and never Curtis", () => {
  // Curtis is not on the neighborhood channel at all, so this is structural
  // rather than a coincidence of one seed - but check both, because a future
  // channel edit should fail here loudly. The four labels below really are four
  // different runs; see `seedFor`.
  assert.equal(NPC_CHANNELS.curtis.includes("neighborhood"), false, "Curtis does not listen on the block");
  for (const seed of ["curtis-a", "curtis-b", "curtis-c", "curtis-d"]) {
    const state = claim(claimReady(seed), CLAIM_ORDER[0]);
    assert.deepEqual(firstTerritoryRows(state, "curtis"), [], `${seed}: nothing reached Curtis`);
    const reached = allFirstTerritoryRows(state).map(({ npcId }) => npcId);
    assert.ok(reached.length > 0, `${seed}: reached somebody`);
    for (const npcId of reached) {
      assert.ok(NPC_CHANNELS[npcId].includes("neighborhood"), `${npcId} is a neighborhood listener`);
    }
  }
});

test("Curtis's own claim observation is untouched", () => {
  // The submission/claimed_block row that has always fired on every claim still
  // fires on every claim, first or sixth. The new row does not replace it.
  const steps = claimSeries(claimReady("curtis-submission"), 3);
  for (let i = 0; i < steps.length; i += 1) {
    const rows = (steps[i].npc.curtis.ledger || []).filter((row) => row.event === "claimed_block");
    assert.equal(rows.length, 1, `after claim ${i + 1}: one merged claimed_block row`);
    assert.equal(rows[0].count, i + 1, `after claim ${i + 1}: counted ${i + 1} times`);
  }
});

test("the observation is located at the district, because the block id would reach nobody", () => {
  // This is the v1.23 finding restated as a guard. The neighborhood channel
  // checks presence, and NPC_PRESENCE_AREAS holds district ids only, so a block
  // id here silently filters out every listener.
  assert.equal(CHANNELS.neighborhood.presence, true, "the channel checks presence");
  for (const [npcId, areas] of Object.entries(NPC_PRESENCE_AREAS)) {
    for (const block of SPENARD_BLOCKS) {
      assert.equal(areas.includes(block.id), false, `${npcId} has no block-level presence area (${block.id})`);
    }
  }
  const state = claim(claimReady("location"), CLAIM_ORDER[0]);
  for (const { npcId, row } of allFirstTerritoryRows(state)) {
    assert.equal(row.location, HOME_DISTRICT_ID, `${npcId}: located at the district`);
  }
});

test("the observation carries no Curtis awareness with it", () => {
  // broadcastTracked only raises awareness on the network channel. A corner
  // claimed is already loud on the network through the existing rows; the block
  // hearing about it must not add a second bump.
  const state = claimReady("awareness");
  const control = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: CLAIM_ORDER[0] });
  const second = claim(control, CLAIM_ORDER[1]);
  assert.equal(
    control.curtisAwareness.level - state.curtisAwareness.level,
    second.curtisAwareness.level - control.curtisAwareness.level,
    "the first claim moves awareness by exactly as much as the second",
  );
});

test("growth is a category the neighborhood lenses actually reward", () => {
  const neighbors = Object.keys(NPC_CHANNELS).filter((npcId) => NPC_CHANNELS[npcId].includes("neighborhood"));
  const rewarded = neighbors.filter((npcId) => (resolveLens(npcId)?.weights?.growth || 0) > 0);
  assert.ok(rewarded.length > 0, "at least one neighborhood listener weights growth positively");
});

test("the observation moves a neighborhood NPC's disposition up, not down", () => {
  // Measured as a delta against a matched control rather than against a
  // constant: the weight is the lens's business, and pinning the number here
  // would make a future lens tune fail in the wrong file.
  const seeds = ["lens-a", "lens-b", "lens-c", "lens-d", "lens-e", "lens-f"];
  let compared = 0;
  for (const seed of seeds) {
    const before = claimReady(seed);
    const after = claim(before, CLAIM_ORDER[0]);
    for (const { npcId, row } of allFirstTerritoryRows(after)) {
      if ((resolveLens(npcId)?.weights?.growth || 0) <= 0) continue;
      // Score the row on its own, against the same ledger without it, so the
      // rest of the claim's fallout cannot be mistaken for this row's effect.
      const withRow = structuredClone(after);
      withRow.npc[npcId].ledger = [row];
      const without = structuredClone(after);
      without.npc[npcId].ledger = [];
      const delta = Exposure.getDisposition(npcId, withRow) - Exposure.getDisposition(npcId, without);
      assert.ok(delta > 0, `${seed}/${npcId}: growth/first_territory is a positive contribution (got ${delta})`);
      compared += 1;
    }
  }
  assert.ok(compared > 0, "at least one lens was actually measured");
});

// ---------------------------------------------------------------------------
// 6. Everything the ceremony must not have disturbed
// ---------------------------------------------------------------------------

test("every claim still posts a soldier, stamps capturedDay, and escalates the network", () => {
  const state = claimReady("regression");
  const steps = claimSeries(state, 6);
  for (let i = 0; i < steps.length; i += 1) {
    const blockId = CLAIM_ORDER[i];
    const block = steps[i].world.territoryBlocks[blockId];
    assert.equal(block.owner, "player", `${blockId}: owned`);
    assert.equal(block.soldiersAssigned.length, 1, `${blockId}: one soldier posted`);
    assert.equal(typeof block.capturedDay, "number", `${blockId}: capturedDay stamped`);
    assert.equal(steps[i].world.soldiers[block.soldiersAssigned[0]].blockId, blockId, `${blockId}: the soldier knows where he is`);
    assert.equal(steps[i].hustle.exposure.networkEscalation, true, `${blockId}: network escalation set`);
  }
});

test("the claim still costs its money on the first claim as on the rest", () => {
  const state = claimReady("cost");
  const first = claim(state, CLAIM_ORDER[0]);
  const second = claim(first, CLAIM_ORDER[1]);
  assert.equal(state.player.cash - first.player.cash, SPENARD_BLOCK_BY_ID[CLAIM_ORDER[0]].claimCost, "first claim charged");
  assert.equal(first.player.cash - second.player.cash, SPENARD_BLOCK_BY_ID[CLAIM_ORDER[1]].claimCost, "second claim charged");
});

test("a rejected claim runs no ceremony", () => {
  // No unassigned soldier: blockClaimAvailability closes and CLAIM_BLOCK returns
  // the input state. Nothing may leak out of the branch.
  const state = claimReady("rejected", { soldiers: 0 });
  const after = C.reduceGame(state, { type: "CLAIM_BLOCK", blockId: CLAIM_ORDER[0] });
  assert.equal(after.world.territoryBlocks[CLAIM_ORDER[0]].owner, "curtis", "the claim was rejected");
  assert.deepEqual(firstClaimCards(after), [], "no card");
  assert.deepEqual(allFirstTerritoryRows(after), [], "no observation");
  assert.deepEqual(inboxOf(after).filter((item) => item.from === "Word Around Town"), [], "no text");
});

test("the save schema did not move and a claimed run round-trips", () => {
  assert.equal(C.VERSION, 11, "save schema is still v11 - nothing here is persisted");
  const state = claim(claimReady("schema"), CLAIM_ORDER[0]);
  const restored = C.migrateSave(JSON.parse(C.serializeRun(state)));
  assert.ok(restored, "a run with a titled card in its queue reloads");
  assert.equal(restored.world.territoryBlocks[CLAIM_ORDER[0]].owner, "player", "the corner survived the round trip");
  const card = (restored.run.consequenceQueue || []).find((item) => item.title === CARD_TITLE);
  assert.ok(card, "the titled card survived the round trip");
});

test("a v11 save written before this build loads and its cards still render", () => {
  // The field is additive: an old queue row has no `title` at all, and the
  // renderer tests truthiness, so it has to come back as falsy rather than
  // break hydration.
  const state = claimReady("legacy-save");
  const legacy = JSON.parse(C.serializeRun(state));
  legacy.run.consequenceQueue = [{ id: "1:0:0:legacy", text: "Curtis has Fourth Avenue Strip.", tone: "bad" }];
  const restored = C.migrateSave(legacy);
  assert.ok(restored, "the old save loads");
  const card = restored.run.consequenceQueue[0];
  assert.equal(Boolean(card.title), false, "no heading renders for a card that never had one");
  assert.equal(card.text, "Curtis has Fourth Avenue Strip.", "its body is untouched");
});

// ---------------------------------------------------------------------------
// 7. The surface
// ---------------------------------------------------------------------------

test("the consequence card renders its title only when there is one", () => {
  const popup = uiSource.slice(uiSource.indexOf("consequence-stack"));
  const line = popup.slice(0, popup.indexOf("\n"));
  assert.ok(line.includes("item.title ?"), "the title is conditional, so untitled cards are unchanged");
  assert.ok(line.includes("consequence-title"), "it renders through its own class");
  assert.ok(line.includes("{item.text}"), "the body still renders");
});

test("the title has a style rule and the card keeps its tap target", () => {
  assert.ok(cssSource.includes(".consequence-title{"), "the rule exists");
  const card = cssSource.slice(cssSource.indexOf(".consequence-card{"));
  const rule = card.slice(0, card.indexOf("}"));
  assert.ok(rule.includes("min-height:44px"), "44px minimum tap target intact");
  assert.ok(rule.includes("width:min(100%,520px)"), "still fluid down to 320px");
});

test("ui.built.js was rebuilt with the title", () => {
  const built = fs.readFileSync(path.join(root, "ui.built.js"), "utf8");
  assert.ok(built.includes("consequence-title"), "run `npm run build` and commit ui.built.js");
});

test("this suite's seeds are numeric, because string seeds silently collapse", () => {
  // The trap this guards: normalizeSeed falls back to one constant whenever
  // Number(seed) is not finite, so `createRun({ seed: "curtis-a" })` and
  // `createRun({ seed: "curtis-b" })` are the SAME run. Any test that loops over
  // string seeds to prove something holds "across seeds" proves nothing.
  const a = C.createRun({ seed: "curtis-a" });
  const b = C.createRun({ seed: "curtis-b" });
  assert.equal(a.run.seed, b.run.seed, "two different strings really do collapse to one seed");

  // seedFor is the fix: distinct labels, distinct numeric seeds.
  const labels = ["curtis-a", "curtis-b", "curtis-c", "curtis-d", "lens-a", "lens-f"];
  const seeds = labels.map(seedFor);
  for (const seed of seeds) assert.equal(Number.isFinite(seed), true, "numeric");
  assert.equal(new Set(seeds).size, labels.length, "every label gets its own seed");
  assert.equal(new Set(labels.map((l) => fresh(l).run.seed)).size, labels.length, "and its own run");
});

test("the copy follows the naming rules", () => {
  const state = claim(claimReady("naming", { deshawn: { status: "active" } }), CLAIM_ORDER[0]);
  const copy = [
    ...firstClaimCards(state).map((card) => `${card.title} ${card.text}`),
    ...inboxOf(state).map((item) => `${item.from} ${item.text}`),
    ...state.log.map((entry) => entry.text),
  ].join(" ");
  for (const banned of ["Rook", "Kip Sallis", "Mara", "Miri", "Samira"]) {
    assert.equal(copy.includes(banned), false, `${banned} is not a name this game uses`);
  }
});
