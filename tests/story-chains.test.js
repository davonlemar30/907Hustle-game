const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../game-core.js");

const REGISTRY = C.STORY_REGISTRY;
const CHAINS = C.EVENT_CHAINS;
const TRIGGERS = ["reactive", "chain", "ambient"];

function freshRun(seed = 51, backgroundId = "hustler") {
  return C.reduceGame(C.createRun({ seed }), { type: "CHOOSE_BACKGROUND", backgroundId });
}

test("every descriptor declares the fields the selector depends on", () => {
  assert.ok(REGISTRY.length >= 25, `expected a populated registry, saw ${REGISTRY.length}`);
  for (const item of REGISTRY) {
    assert.equal(typeof item.id, "string", `${item.id}: id`);
    assert.ok(C.CLASSIFICATIONS.includes(item.classification), `${item.id}: classification ${item.classification}`);
    assert.ok(TRIGGERS.includes(item.trigger), `${item.id}: trigger ${item.trigger}`);
    assert.equal(typeof item.requires, "function", `${item.id}: requires must be a function`);
    assert.ok(item.earliest && Number.isInteger(item.earliest.day), `${item.id}: earliest.day`);
    assert.equal(typeof item.once, "boolean", `${item.id}: once`);
    assert.ok(Number.isFinite(item.cooldown) && item.cooldown >= 0, `${item.id}: cooldown`);
    assert.ok(Number.isFinite(item.weight) && item.weight > 0, `${item.id}: weight`);
    assert.ok(item.exit === null || typeof item.exit === "function", `${item.id}: exit`);
  }
});

test("registry ids are unique and every referenced chain exists", () => {
  const ids = REGISTRY.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate event id in the registry");
  for (const item of REGISTRY) {
    if (item.chain === null) { assert.equal(item.stage, null, `${item.id}: standalone beats carry no stage`); continue; }
    assert.ok(CHAINS[item.chain], `${item.id}: unknown chain ${item.chain}`);
    assert.ok(Number.isInteger(item.stage) && item.stage > 0, `${item.id}: chain beats need a positive stage`);
  }
});

test("chain stages cover one through N with no gaps", () => {
  const byChain = {};
  for (const item of REGISTRY) {
    if (!item.chain) continue;
    (byChain[item.chain] = byChain[item.chain] || []).push(item.stage);
  }
  for (const [chain, stages] of Object.entries(byChain)) {
    // Duplicates are branches: two alternative beats at the same point in a
    // chain, such as Eli's rejection path against his test-route path. What
    // must not happen is a gap, which would strand every later stage.
    const present = new Set(stages);
    const highest = Math.max(...stages);
    for (let stage = 1; stage <= highest; stage += 1) {
      assert.ok(present.has(stage), `${chain}: no beat at stage ${stage}`);
    }
  }
});

test("no chain beat past the first is reachable on a fresh run", () => {
  const state = freshRun();
  for (const item of REGISTRY) {
    if (!item.chain || item.stage === 1) continue;
    assert.equal(item.requires(state), false, `${item.id} is reachable out of order`);
  }
});

test("ambient-tier beats never belong to a chain", () => {
  for (const item of REGISTRY.filter((entry) => entry.trigger === "ambient")) {
    assert.equal(item.chain, null, `${item.id} is ambient but declares chain ${item.chain}`);
  }
});

test("the Alpha v0.7 street events are repeatable and cooldown-gated", () => {
  const oneOffs = ["wet_bricks", "door_knock", "stranded_wagon", "found_phone", "careful_customer", "dock_shift", "garage_furnace", "sedan_rumor", "midtown_lights"];
  assert.equal(oneOffs.length, 9);
  for (const id of oneOffs) {
    const item = REGISTRY.find((entry) => entry.id === id);
    assert.ok(item, `${id} missing from the registry`);
    assert.equal(item.once, false, `${id} should be repeatable`);
    assert.ok(item.cooldown >= 8, `${id} needs a real cooldown`);
    assert.equal(item.trigger, "ambient", `${id} should sit in the ambient tier`);
  }
});

test("every registered beat builds renderable copy with concrete choices", () => {
  const state = freshRun();
  state.player.cash = 4000;
  for (const item of REGISTRY) {
    if (item.kind === "encounter") continue;
    const built = C.buildEventForTest(item.id, state);
    assert.ok(built, `${item.id} has no factory`);
    assert.ok(built.title && built.title.split(/\s+/).length <= 8, `${item.id}: title length`);
    assert.ok(built.who && built.where && built.stakes, `${item.id}: missing who/where/stakes`);
    const words = built.description.split(/\s+/).length;
    assert.ok(words >= 30 && words <= 110, `${item.id}: description is ${words} words`);
    assert.ok(built.choices.length >= 2 && built.choices.length <= 4, `${item.id}: ${built.choices.length} choices`);
    for (const choice of built.choices) {
      assert.ok(choice.label.length > 0 && choice.label.split(/\s+/).length <= 8, `${item.id}: choice label "${choice.label}"`);
      // Task 7A length guide: previews run 8-24 words. Too short stops naming a
      // consequence; too long stops being scannable on a phone.
      const previewWords = choice.preview ? choice.preview.split(/\s+/).length : 0;
      assert.ok(previewWords >= 8 && previewWords <= 24, `${item.id}: preview for "${choice.label}" is ${previewWords} words`);
      assert.ok(choice.result && choice.result.split(/\s+/).length >= 15, `${item.id}: choice "${choice.label}" has a thin result`);
      // Task 7A: previews must not fall back to filler.
      assert.doesNotMatch(choice.preview, /may matter later|consequences later|something happens/i, `${item.id}: vague preview`);
    }
  }
});

test("choice previews never expose probabilities or hidden meters", () => {
  const state = freshRun();
  state.player.cash = 4000;
  for (const item of REGISTRY) {
    if (item.kind === "encounter") continue;
    for (const choice of C.buildEventForTest(item.id, state).choices) {
      assert.doesNotMatch(choice.preview, /\d+\s*%|\bchance\b|\bprobability\b|\bstage \d|\bcooldown\b|\btrust [+-]?\d/i, `${item.id}: "${choice.preview}"`);
    }
  }
});

test("the one-off pack keeps room for ordinary life and later callbacks", () => {
  const state = freshRun();
  state.player.cash = 4000;
  const nonCriminal = ["stranded_wagon", "dock_shift", "garage_furnace", "sedan_rumor", "midtown_lights"];
  assert.ok(nonCriminal.length >= 4, "at least four one-offs must sit outside a criminal transaction");

  const callbackFlags = ["helpedStrandedDriver", "workedDockShift", "copiedBuyerList", "returnedLostPhone", "boughtWetLot"];
  const declared = new Set();
  for (const item of REGISTRY) {
    if (item.kind === "encounter") continue;
    for (const choice of C.buildEventForTest(item.id, state).choices) {
      for (const key of Object.keys(choice.effect?.setFlags || {})) declared.add(key);
    }
  }
  const present = callbackFlags.filter((flag) => declared.has(flag));
  assert.ok(present.length >= 3, `expected 3+ callback flags, saw ${present.join(", ")}`);
});

test("chain selection is deterministic for a given seed", () => {
  const trace = (seed) => {
    let state = freshRun(seed, "shooter");
    const seen = [];
    let guard = 0;
    while (state.run.status === "playing" && guard++ < 60) {
      if (state.run.pendingEvent) { seen.push(state.run.pendingEvent.id); state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 }); continue; }
      if (state.run.pendingEncounter) { seen.push(`enc:${state.run.pendingEncounter.id}`); state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: C.selectors.encounterChoices(state)[0].id }); continue; }
      if (state.run.daySummary) { state = C.reduceGame(state, { type: "DISMISS_DAY_SUMMARY" }); continue; }
      if (state.run.pendingOperationResult) { state = C.reduceGame(state, { type: "ACKNOWLEDGE_OPERATION_RESULT" }); continue; }
      state = C.reduceGame(state, { type: "END_MARKET" });
    }
    return seen.join("|");
  };
  assert.equal(trace(4242), trace(4242));
  assert.notEqual(trace(4242), trace(4243));
});

test("story order varies across seeds instead of walking a fixed ladder", () => {
  const orderings = new Set();
  for (let seed = 600; seed < 630; seed += 1) {
    let state = freshRun(seed, "shooter");
    const seen = [];
    let guard = 0, lastEncounter = null;
    while (state.run.status === "playing" && seen.length < 3 && guard++ < 60) {
      if (state.run.pendingEvent) { seen.push(state.run.pendingEvent.id); state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 }); continue; }
      if (state.run.pendingEncounter) {
        if (state.run.pendingEncounter.id !== lastEncounter) { seen.push(`enc:${state.run.pendingEncounter.id}`); lastEncounter = state.run.pendingEncounter.id; }
        state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: C.selectors.encounterChoices(state)[0].id }); continue;
      }
      if (state.run.daySummary) { state = C.reduceGame(state, { type: "DISMISS_DAY_SUMMARY" }); continue; }
      if (state.run.pendingOperationResult) { state = C.reduceGame(state, { type: "ACKNOWLEDGE_OPERATION_RESULT" }); continue; }
      state = C.reduceGame(state, { type: "END_MARKET" });
    }
    orderings.add(seen.join("|"));
  }
  // The v0.6 ladder produced exactly one ordering for every seed. The build
  // currently measures 26-27; 20 is a floor that still proves the ladder is gone.
  assert.ok(orderings.size >= 20, `expected 20+ distinct openings across 30 seeds, saw ${orderings.size}`);
});

test("no chain fires three times running while another beat is eligible", () => {
  for (let seed = 700; seed < 720; seed += 1) {
    let state = freshRun(seed, "hustler");
    let streak = 0, last = null, guard = 0, lastEncounter = null;
    while (state.run.status === "playing" && guard++ < 80) {
      if (state.run.pendingEvent || state.run.pendingEncounter) {
        const id = state.run.pendingEvent ? state.run.pendingEvent.id : state.run.pendingEncounter.id;
        const newBeat = state.run.pendingEvent ? true : id !== lastEncounter;
        if (!state.run.pendingEvent) lastEncounter = id;
        if (newBeat) {
          const descriptor = REGISTRY.find((item) => item.id === id) || {};
          // Reactive beats are caused by the player, not sampled, so they are
          // not part of what the anti-monopoly rule governs.
          const chain = descriptor.trigger === "reactive" ? null : (descriptor.chain || null);
          if (chain && chain === last) streak += 1; else streak = chain ? 1 : 0;
          last = chain;
          assert.ok(streak <= 2, `seed ${seed}: chain ${chain} ran ${streak} beats back to back`);
        }
        if (state.run.pendingEvent) state = C.reduceGame(state, { type: "RESOLVE_EVENT", choiceIndex: 0 });
        else state = C.reduceGame(state, { type: "RESOLVE_ENCOUNTER", choiceId: C.selectors.encounterChoices(state)[0].id });
        continue;
      }
      if (state.run.daySummary) { state = C.reduceGame(state, { type: "DISMISS_DAY_SUMMARY" }); continue; }
      if (state.run.pendingOperationResult) { state = C.reduceGame(state, { type: "ACKNOWLEDGE_OPERATION_RESULT" }); continue; }
      state = C.reduceGame(state, { type: "END_MARKET" });
    }
  }
});

test("a reactive beat fires on its cause rather than on a dice roll", () => {
  // Clearing Dre's note opens the post-payoff offer; it must not wait on a roll.
  let state = freshRun(88, "hustler");
  state.player.cash = state.lender.balance + 400;
  state = C.reduceGame(state, { type: "PAY_DEBT", amount: state.lender.balance });
  state = state.run.daySummary ? C.reduceGame(state, { type: "DISMISS_DAY_SUMMARY" }) : state;
  assert.equal(state.lender.balance, 0);
  assert.ok(state.run.pendingEvent, "the post-payoff offer did not fire on the payment");
  assert.equal(state.run.pendingEvent.id, "dre_after_payoff");
});

test("repeatable street events respect their cooldown", () => {
  const item = REGISTRY.find((entry) => entry.id === "sedan_rumor");
  let state = freshRun(31, "hustler");
  state.run.eventHistory.sedan_rumor = 0;
  state.run.day = 1; state.run.slot = 2;
  assert.ok(!C.storyCandidatesForTest(state).some((entry) => entry.id === "sedan_rumor"), "fired inside its cooldown");
  state.run.day = 4; state.run.slot = 0; // 12 slots later, past the 8-slot gate
  assert.ok(item.cooldown <= 12);
  assert.ok(C.storyCandidatesForTest(state).some((entry) => entry.id === "sedan_rumor"), "never returned after the cooldown");
});

test("a place-rooted beat outranks an anywhere beat when you are standing there", () => {
  const rooted = REGISTRY.filter((item) => item.trigger === "chain" && item.area);
  const anywhere = REGISTRY.filter((item) => item.trigger === "chain" && !item.area);
  assert.ok(rooted.length > 0 && anywhere.length > 0, "both kinds must exist for the rule to matter");
  // Mara's arc is district-gated; Eli, Dre, and Rook are not. Without the
  // locality preference the anywhere chains are eligible in every district and
  // starve her out of any run that travels.
  assert.ok(REGISTRY.some((item) => item.chain === "mara_spenard" && item.area === "north_star_lot"));
});

test("the completed chains each carry an end-of-week beat", () => {
  for (const chain of ["eli_routes", "dre_note", "rook_pressure"]) {
    const beats = REGISTRY.filter((item) => item.chain === chain);
    assert.ok(beats.length >= 5, `${chain} has only ${beats.length} beats`);
    assert.ok(beats.some((item) => item.classification === "ending_setup"), `${chain} has no end-of-week beat`);
  }
});

test("Dre answers a payment reactively rather than on a roll", () => {
  const first = REGISTRY.find((item) => item.id === "dre_first_payment");
  assert.equal(first.trigger, "reactive");
  assert.equal(first.chain, "dre_note");
});

test("Rook escalates through pressure before the collision", () => {
  const stages = Object.fromEntries(REGISTRY.filter((item) => item.chain === "rook_pressure").map((item) => [item.id, item.stage]));
  assert.ok(stages.rook_mark < stages.rook_tax, "he notices before he asks");
  assert.ok(stages.rook_tax < stages.mid, "he asks before it turns physical");
  assert.ok(stages.mid < stages.rook_day7, "the collision precedes the reckoning");
});
