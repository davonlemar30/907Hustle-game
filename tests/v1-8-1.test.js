// v1.8.1 was a refactor build, so these tests guard the seams it introduced:
// the save-migration aliases that are the only place legacy character ids may
// still appear, the event card schema, and the src/ module boundary.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const C = require("../game-core.js");
const root = path.join(__dirname, "..");

const fresh = (seed = 4242) => C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Migrant" });

test("legacy character ids survive only inside migrateSave", () => {
  // The v1.7/v1.8 renames (rook->curtis, mara->mina, kip->goodie,
  // miri->pherris) are done everywhere except the migration path, which has to
  // keep reading the old keys so existing saves still load. Anywhere else is a
  // missed rename.
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
  const files = [path.join(root, "game-core.js"), path.join(root, "ui.jsx"), path.join(root, "encounters.js"), ...walk(path.join(root, "src"))];
  const legacy = /\b(rook|mara|kip|miri)\b/;

  const core = fs.readFileSync(path.join(root, "game-core.js"), "utf8").split("\n");
  const start = core.findIndex((line) => line.startsWith("  function migrateSave("));
  const end = core.findIndex((line, i) => i > start && line.startsWith("  function hydrateRun("));
  assert.ok(start > 0 && end > start, "migrateSave/hydrateRun boundaries not found");

  for (const file of files) {
    fs.readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      if (!legacy.test(line)) return;
      const insideMigration = file.endsWith("game-core.js") && index >= start && index < end;
      assert.ok(insideMigration, `legacy id outside migrateSave: ${path.relative(root, file)}:${index + 1}\n  ${line.trim().slice(0, 120)}`);
    });
  }
});

test("a v4 save drops every legacy key and carries plug access across the rename", () => {
  const raw = JSON.parse(C.serializeRun(fresh(1802)));
  raw.version = 4;
  raw.npc.rook = { attention: 3 };
  raw.people.mara = { met: true, trust: 2 };
  raw.people.crew.kip = { introduced: true, recruited: true, loyalty: 2 };
  raw.people.dealers.kip = { ...raw.people.dealers.goodie, known: true, standing: 4 };
  delete raw.people.dealers.goodie;
  raw.plugs.records.kip = { unlocked: true, trades: 7 };
  delete raw.plugs.records.goodie;
  raw.plugs.unlocked = ["kip"];
  raw.world.territoryBlocks[Object.keys(raw.world.territoryBlocks)[0]].owner = "rook";

  const state = C.hydrateRun(raw);
  assert.equal(state.version, 11);

  // Data carried over rather than reset.
  assert.equal(state.people.dealers.goodie.standing, 4);
  assert.equal(state.plugs.records.goodie.trades, 7);
  assert.deepEqual(state.plugs.unlocked, ["goodie"]);
  assert.equal(state.npc.curtis.attention, 3);

  // Old keys gone, so nothing reads them by accident later.
  for (const [label, value] of Object.entries({
    "npc.rook": state.npc.rook,
    "npc.mara": state.npc.mara,
    "people.mara": state.people.mara,
    "people.crew.kip": state.people.crew.kip,
    "people.crew.miri": state.people.crew.miri,
    "people.dealers.kip": state.people.dealers.kip,
    "plugs.records.kip": state.plugs.records.kip,
  })) assert.equal(value, undefined, `${label} should be deleted by migrateSave`);

  assert.ok(Object.values(state.world.territoryBlocks).every((block) => block.owner !== "rook"), "block owners still say rook");
});

test("v3 through v10 saves all migrate to v11, and unsupported versions are refused", () => {
  // LEGACY_SAVE_KEYS promises every older schema still loads.
  assert.deepEqual(C.LEGACY_SAVE_KEYS, ["907ogr_v10", "907ogr_v9", "907ogr_v8", "907ogr_v7", "907ogr_v6", "907ogr_v5", "907ogr_v4", "907ogr_v3"]);
  for (const version of [3, 4, 5, 6, 7, 8, 9]) {
    const raw = JSON.parse(C.serializeRun(fresh(1900 + version)));
    raw.version = version;
    for (const id of C.EXPOSURE_NPC_IDS) delete raw.npc[id].ledger;
    // A pre-v10 save has no stick/criminalProfile slices and no plug suspicion.
    delete raw.stick;
    delete raw.criminalProfile;
    for (const record of Object.values(raw.plugs?.records || {})) delete record.suspicion;
    const state = C.hydrateRun(raw);
    assert.equal(state.version, 11, `v${version} save should migrate to v11`);
    // The v1.13 slices hydrate with defaults on every legacy save.
    assert.equal(state.stick.rep, 0);
    assert.ok(Array.isArray(state.stick.retaliationQueue));
    assert.ok(state.criminalProfile.districtAwareness.north_star_lot);
    assert.equal(state.plugs.records.goodie.suspicion, 0);
    assert.ok(state.run && state.player && state.world, `v${version} save lost a top-level section`);
    assert.equal(typeof state.player.cash, "number");
    // Every pre-Exposure save comes out with a ledger it can be read from.
    for (const id of C.EXPOSURE_NPC_IDS) {
      assert.ok(Array.isArray(state.npc[id].ledger), `v${version} left ${id} without a ledger`);
    }
    assert.ok(state.npc.yalonda.ledger.length > 0, `v${version} should seed the household history`);
  }
  const tooOld = JSON.parse(C.serializeRun(fresh(1905)));
  tooOld.version = 2;
  assert.equal(C.migrateSave(tooOld), null, "a v2 save is older than the supported range and must be refused");
});

test("every story descriptor matches the canonical event card shape", () => {
  const CLASSIFICATIONS = new Set(C.CLASSIFICATIONS);
  const seen = new Set();
  assert.ok(C.STORY_REGISTRY.length >= 60, `registry shrank to ${C.STORY_REGISTRY.length}`);

  for (const card of C.STORY_REGISTRY) {
    const where = `event ${card.id}`;
    assert.equal(typeof card.id, "string", `${where}: id must be a string`);
    assert.ok(!seen.has(card.id), `${where}: duplicate id`);
    seen.add(card.id);

    assert.ok(CLASSIFICATIONS.has(card.classification), `${where}: unknown classification ${card.classification}`);
    assert.ok(["chain", "reactive", "ambient"].includes(card.trigger), `${where}: unknown trigger ${card.trigger}`);
    // chain/stage identify a card's place in a multi-part arc; standalone
    // cards leave both null, and they are null together or not at all.
    assert.ok(card.chain === null || typeof card.chain === "string", `${where}: chain must be a string or null`);
    assert.ok(card.stage === null || typeof card.stage === "number", `${where}: stage must be a number or null`);
    assert.equal(card.chain === null, card.stage === null, `${where}: chain and stage must both be set or both be null`);
    assert.equal(typeof card.requires, "function", `${where}: requires must be a predicate`);
    // exit retires a card early; most cards have no early exit and leave it null.
    assert.ok(card.exit === null || typeof card.exit === "function", `${where}: exit must be a predicate or null`);
    assert.equal(typeof card.weight, "number", `${where}: weight must be a number`);
    assert.ok(card.weight > 0, `${where}: weight must be positive or the card can never fire`);
    assert.equal(typeof card.cooldown, "number", `${where}: cooldown must be a number`);
    assert.equal(typeof card.once, "boolean", `${where}: once must be a boolean`);
    assert.ok(card.area === null || typeof card.area === "string", `${where}: area must be a district id or null`);

    assert.equal(typeof card.earliest, "object", `${where}: earliest must be a window`);
    assert.equal(typeof card.earliest.day, "number", `${where}: earliest.day must be a number`);
    if (card.latest) {
      assert.ok(card.latest.day >= card.earliest.day, `${where}: latest.day ${card.latest.day} is before earliest.day ${card.earliest.day}, so it can never fire`);
    }
  }
});

test("a card's declared district is a real one", () => {
  const areas = new Set(C.NEIGHBORHOODS.map((area) => area.id));
  for (const card of C.STORY_REGISTRY) {
    if (card.area) assert.ok(areas.has(card.area), `event ${card.id} is gated to unknown district ${card.area}`);
  }
});

test("isEligible and getWeight are the single gate and the single weighting", () => {
  const { isEligible, getWeight } = require("../src/events/random.js");
  const base = {
    id: "probe", chain: null, stage: null, classification: "opportunity", trigger: "ambient",
    area: null, earliest: { day: 1, slot: 0 }, latest: null, once: false, cooldown: 2, weight: 4,
    requires: () => true, exit: null,
  };
  const state = {
    run: { day: 3, slot: 1, phase: "pressure", recentEvents: [], eventHistory: {} },
    world: { currentNeighborhoodId: "north_star_lot" },
  };
  const never = () => false;
  const at = (day, slot) => (day - 1) * 4 + slot;
  const check = (card, s = state) => isEligible(card, s, { absolute: at(s.run.day, s.run.slot), resolved: never });

  assert.equal(check(base), true);
  assert.equal(check({ ...base, area: "downtown" }), false, "district gate");
  assert.equal(check({ ...base, earliest: { day: 6, slot: 0 } }), false, "earliest gate");
  assert.equal(check({ ...base, latest: { day: 2 } }), false, "latest gate");
  assert.equal(check({ ...base, exit: () => true }), false, "exit gate");
  assert.equal(check({ ...base, requires: () => false }), false, "requires gate");
  assert.equal(check({ ...base, once: true }, state), true, "once with nothing resolved yet");
  assert.equal(isEligible({ ...base, once: true }, state, { absolute: at(3, 1), resolved: () => true }), false, "once gate");

  const recent = { ...state, run: { ...state.run, recentEvents: ["probe"] } };
  assert.equal(check(base, recent), false, "recentEvents gate");
  const cooling = { ...state, run: { ...state.run, eventHistory: { probe: at(3, 0) } } };
  assert.equal(check(base, cooling), false, "cooldown gate");

  // Week Zero holds back the escalating arcs and the run-ending cards.
  const weekZero = { ...state, run: { ...state.run, phase: "week_zero" } };
  assert.equal(check({ ...base, classification: "threat" }, weekZero), false);
  assert.equal(check({ ...base, classification: "ending_setup" }, weekZero), false);
  assert.equal(check({ ...base, chain: "dre_note", stage: 1 }, weekZero), false);
  assert.equal(check({ ...base, chain: "curtis_pressure", stage: 1 }, weekZero), false);
  assert.equal(check({ ...base, classification: "threat" }), true, "allowed once Week Zero ends");

  assert.equal(getWeight(base, state, () => 1), 4);
  assert.equal(getWeight(base, state, () => 2), 8, "multiplier applies");
  assert.ok(getWeight({ ...base, weight: 0 }, state, () => 1) > 0, "a zero-weight card keeps a floor rather than becoming unreachable");
});

test("game-core re-exports the extracted modules unchanged", () => {
  // game-core.js is a barrel over src/. If a module and the barrel ever
  // disagree, callers reading C.PRODUCTS get something different from the
  // module's own consumers.
  const products = require("../src/data/products.js");
  const locations = require("../src/data/locations.js");
  const registry = require("../src/events/registry.js");
  assert.equal(C.PRODUCTS, products.PRODUCTS);
  assert.equal(C.NEIGHBORHOODS, locations.NEIGHBORHOODS);
  assert.equal(C.HOME_DISTRICT_ID, locations.HOME_DISTRICT_ID);
  assert.equal(C.ENTITY_MATCH_ORDER, registry.ENTITY_MATCH_ORDER);
  assert.equal(products.PRODUCT_BY_ID.weed, products.PRODUCTS[0]);
});

test("the built bundle is present and free of Babel", () => {
  // GitHub Pages serves this repo directly, so a stale or missing ui.built.js
  // ships a broken game.
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.doesNotMatch(html, /babel/i, "index.html still references Babel");
  assert.doesNotMatch(html, /text\/babel/, "index.html still has a text/babel script");
  assert.match(html, /ui\.built\.js/, "index.html does not load the bundle");
  assert.ok(fs.existsSync(path.join(root, "ui.built.js")), "ui.built.js is not committed; run npm run build");
});
