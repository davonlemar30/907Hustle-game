const test = require("node:test");
const assert = require("node:assert/strict");
const Crew = require("../src/data/crew.js");
const Progression = require("../src/data/crew-progression.js");
const Requirements = require("../src/systems/requirements.js");

function eligibleFacts(overrides = {}) {
  const facts = {
    currentDay: 14,
    timeSlotsToday: 0,
    wageGraceDays: Crew.CREW_WAGE_GRACE_DAYS,
    crew: {
      pherris: {
        recruited: true,
        status: "active",
        loyalty: 8,
        tier: 2,
        recruitedDay: 1,
        wageMissedSince: null,
        proofs: {
          first_route: true,
          completed_routes: 4,
        },
      },
    },
    hustleTiers: { "907list": 3 },
    assignments: {},
  };
  return Object.assign(facts, overrides);
}

test("FS-001 defines the six approved Crew ranks", () => {
  assert.equal(Progression.crewRankLabel(1), "RECRUIT");
  assert.equal(Progression.crewRankLabel(2), "PROVEN");
  assert.equal(Progression.crewRankLabel(3), "TRUSTED");
  assert.equal(Progression.crewRankLabel(4), "SPECIALIST LEAD");
  assert.equal(Progression.crewRankLabel(5), "LIEUTENANT");
  assert.equal(Progression.crewRankLabel(6), "INNER CIRCLE");
  assert.equal(Progression.crewRankLabel(99), "INNER CIRCLE", "unknown higher ranks clamp safely");
});

test("rank curves retain their highest authored value above the authored range", () => {
  assert.equal(Progression.curveValueForRank([60, 120, 220], 1), 60);
  assert.equal(Progression.curveValueForRank([60, 120, 220], 3), 220);
  assert.equal(Progression.curveValueForRank([60, 120, 220], 6), 220);
  assert.equal(Progression.curveValueForRank({ 1: 1.15, 2: 1.3, 3: 1.5 }, 6), 1.5);
  assert.equal(Progression.curveValueForRank({}, 6, 7), 7);
});

test("new curve helper matches current wage behavior through and above Tier 3", () => {
  const deshawn = { id: "deshawn", wage: 50 };
  for (const rank of [1, 2, 3, 4, 6]) {
    assert.equal(
      Progression.curveValueForRank(Crew.TIER_WAGES.deshawn, rank),
      Crew.wageFor(deshawn, rank),
    );
  }
});

test("existing Tone and Deshawn modifiers retain Tier 3 benefits at future ranks", () => {
  const state = {
    people: {
      crew: {
        tone: { recruited: true, status: "active", loyalty: 10, tier: 6 },
        deshawn: { recruited: true, status: "active", loyalty: 10, tier: 6 },
      },
    },
  };
  assert.equal(Crew.toneDefenseMultiplier(state), 1.5);
  assert.equal(Crew.deshawnHeatReduction(state), 0.4);
});

test("Pherris capability scales 1/2/3 cycles and clamps at three above Trusted", () => {
  assert.equal(Progression.crewHasCapability("pherris", "907list_run_board", 1), true);
  assert.equal(Progression.crewCapabilitySummary("pherris", "907list_run_board", 1).maxCycles, 1);
  assert.equal(Progression.crewCapabilitySummary("pherris", "907list_run_board", 2).maxCycles, 2);
  assert.equal(Progression.crewCapabilitySummary("pherris", "907list_run_board", 3).maxCycles, 3);
  assert.equal(Progression.crewCapabilitySummary("pherris", "907list_run_board", 6).maxCycles, 3);
  assert.equal(Progression.crewHasCapability("tone", "907list_run_board", 3), false);
});

test("Crew capacity remains two in the structural slice", () => {
  assert.equal(Progression.crewCapacity(), 2);
});

test("Requirement Evaluator accepts the approved Pherris foundation gates", () => {
  const requirements = [
    { type: "crew_active", crewId: "pherris" },
    { type: "crew_loyalty_min", crewId: "pherris", min: 6 },
    { type: "crew_rank_min", crewId: "pherris", min: 1 },
    { type: "crew_tenure_days_min", crewId: "pherris", min: 5 },
    { type: "hustle_tier_min", hustleId: "907list", min: 3 },
    { type: "payroll_not_delinquent", crewId: "pherris" },
    { type: "crew_unassigned_today", crewId: "pherris" },
    { type: "planning_window_open" },
    { type: "proof_flag", crewId: "pherris", key: "first_route" },
    { type: "proof_counter_min", crewId: "pherris", key: "completed_routes", min: 3 },
  ];
  assert.deepEqual(Requirements.evaluateRequirements(requirements, eligibleFacts()), {
    ok: true,
    blocker_code: null,
    blocker_copy_key: null,
    current: null,
    required: null,
  });
});

test("Requirement Evaluator returns the first structured blocker deterministically", () => {
  const blocker = Requirements.evaluateRequirements([
    { type: "crew_loyalty_min", crewId: "pherris", min: 9 },
    { type: "planning_window_open" },
  ], eligibleFacts({ timeSlotsToday: 2 }));
  assert.deepEqual(blocker, {
    ok: false,
    blocker_code: "crew_loyalty_min",
    blocker_copy_key: "requirements.crew_loyalty_min",
    current: 8,
    required: 9,
  });
});

test("payroll stays eligible through wage grace and blocks after Loyalty bleed begins", () => {
  const withinGrace = eligibleFacts();
  withinGrace.crew.pherris.wageMissedSince = 12;
  assert.equal(Requirements.evaluateRequirement(
    { type: "payroll_not_delinquent", crewId: "pherris" },
    withinGrace,
  ).ok, true);

  const delinquent = eligibleFacts();
  delinquent.crew.pherris.wageMissedSince = 11;
  const blocker = Requirements.evaluateRequirement(
    { type: "payroll_not_delinquent", crewId: "pherris" },
    delinquent,
  );
  assert.equal(blocker.ok, false);
  assert.equal(blocker.current, 3);
  assert.equal(blocker.required, 2);
});

test("daily assignment, planning window, and proof requirements expose semantic blockers", () => {
  const assigned = eligibleFacts({ assignments: { pherris: { day: 14, operationId: "other" } } });
  assert.equal(Requirements.evaluateRequirement(
    { type: "crew_unassigned_today", crewId: "pherris" },
    assigned,
  ).ok, false);

  const late = eligibleFacts({ timeSlotsToday: 1 });
  assert.equal(Requirements.evaluateRequirement({ type: "planning_window_open" }, late).ok, false);

  const proof = eligibleFacts();
  proof.crew.pherris.proofs.completed_routes = 1;
  const blocker = Requirements.evaluateRequirement(
    { type: "proof_counter_min", crewId: "pherris", key: "completed_routes", min: 3 },
    proof,
  );
  assert.equal(blocker.blocker_code, "proof_counter_min");
  assert.equal(blocker.current, 1);
  assert.equal(blocker.required, 3);
});

test("unknown requirement types fail closed", () => {
  assert.deepEqual(Requirements.evaluateRequirement({ type: "future_magic_gate" }, eligibleFacts()), {
    ok: false,
    blocker_code: "unsupported_requirement",
    blocker_copy_key: "requirements.unsupported_requirement",
    current: "future_magic_gate",
    required: "supported_requirement_type",
  });
});
