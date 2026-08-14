// Attribute balance harness. Not a test - a measurement.
//
//   node tests/attribute-balance.js
//
// The v1.10 acceptance criteria that unit assertions are the wrong instrument
// for: whether the success curve bends smoothly from Green to Elite, whether a
// gym-focused week actually reaches Combat 3 by Day 7, and whether training
// before you steal leaves the people around you better disposed than stealing on
// Day 1. All three are distribution questions.
//
// Everything here is seeded, so two runs of this file produce identical output.

const C = require("../game-core.js");
const A = require("../src/systems/attributes.js");
const AD = require("../src/data/attributes.js");

const RUNS_PER_LEVEL = 200;
const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// 1. Success curves, 200 samples per attribute level per action
// ---------------------------------------------------------------------------

function successCurves() {
  const rows = [];
  for (const actionType of Object.keys(AD.OUTCOME_SHAPES)) {
    const attribute = AD.ACTION_ATTRIBUTE_MAP[actionType];
    const chance = 0.5;
    const pool = A.buildOutcomePool(actionType, chance);
    const row = { action: actionType, attribute, base: chance, byLevel: {} };
    for (const level of LEVELS) {
      let wins = 0;
      let catastrophes = 0;
      for (let seed = 0; seed < RUNS_PER_LEVEL; seed += 1) {
        const outcome = A.resolveWithAttribute(pool, level, `${actionType}:${seed}`);
        if (A.isSuccessTier(outcome.tier)) wins += 1;
        if (outcome.tier === "catastrophic") catastrophes += 1;
      }
      row.byLevel[level] = { success: wins / RUNS_PER_LEVEL, catastrophic: catastrophes / RUNS_PER_LEVEL };
    }
    rows.push(row);
  }
  return rows;
}

// A curve is smooth if it never goes backwards and never jumps by more than the
// advantage step could account for.
function curveIsMonotonic(byLevel) {
  let previous = -1;
  for (const level of LEVELS) {
    const value = byLevel[level].success;
    if (value < previous - 1e-9) return false;
    previous = value;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 2. How fast does a gym-focused week climb?
// ---------------------------------------------------------------------------

// Modelled rather than played: the reducer gates on cash, slots, and energy, and
// what this question is really asking is what the growth curve pays for a given
// number of sessions. Sessions per day is the lever.
function gymClimb(sessionsPerDay, activity) {
  let value = 1;
  let progress = 0;
  let sessions = 0;
  const days = [];
  for (let day = 1; day <= 14; day += 1) {
    for (let i = 0; i < sessionsPerDay; i += 1) {
      const useSparring = activity === "sparring" && value >= 3;
      progress += A.attributeGrowth(value, sessions, useSparring ? "sparring" : "bag_work");
      sessions += 1;
      if (progress >= 1) { progress -= 1; value += 1; }
    }
    days.push({ day, value, sessions });
  }
  const reached3 = days.find((entry) => entry.value >= 3);
  const reached6 = days.find((entry) => entry.value >= 6);
  return { sessionsPerDay, activity, finalValue: value, dayReached3: reached3 ? reached3.day : null, dayReached6: reached6 ? reached6.day : null };
}

// ---------------------------------------------------------------------------
// 3. Does training first actually leave people better disposed?
// ---------------------------------------------------------------------------

// Two players, same seed, same robbery. One is Green, one trained into
// Dangerous. Compare the observation footprint each robbery produces and the
// disposition it moves.
function trainedVersusGreen(samples = 200) {
  const reach = { direct: 0, household: 1, neighborhood: 2, network: 3, reputation: 3 };
  const result = {};
  for (const [label, combat] of [["green", 1], ["capable", 3], ["dangerous", 7]]) {
    let footprint = 0;
    let catastrophes = 0;
    for (let seed = 0; seed < samples; seed += 1) {
      const outcome = A.resolveWithAttribute(A.buildOutcomePool("robbery", 0.5), combat, `balance:rob:${seed}`);
      if (outcome.tier === "catastrophic") catastrophes += 1;
      for (const spec of AD.OUTCOME_OBSERVATIONS.robbery[outcome.tier]) footprint += reach[spec.channel];
    }
    result[label] = { averageReach: footprint / samples, catastrophicRate: catastrophes / samples };
  }
  return result;
}

// ---------------------------------------------------------------------------

function main() {
  console.log("# Attribute balance\n");

  console.log(`## Success curves (${RUNS_PER_LEVEL} samples per level, base chance 0.50)\n`);
  let allSmooth = true;
  for (const row of successCurves()) {
    const smooth = curveIsMonotonic(row.byLevel);
    allSmooth = allSmooth && smooth;
    const cells = LEVELS.map((level) => `${level}:${pct(row.byLevel[level].success)}`).join("  ");
    console.log(`${row.action.padEnd(16)} ${row.attribute.padEnd(13)} ${cells}${smooth ? "" : "   <-- NOT MONOTONIC"}`);
    const catastrophic = LEVELS.map((level) => row.byLevel[level].catastrophic);
    if (catastrophic.slice(6).some((value) => value > 0)) console.log(`  !! ${row.action} produced a catastrophe at attribute 6+`);
  }
  console.log(`\nAll curves monotonic: ${allSmooth}\n`);

  console.log("## Gym climb (14 days)\n");
  for (const perDay of [1, 2, 3, 4]) {
    for (const activity of ["bag_work", "sparring"]) {
      const climb = gymClimb(perDay, activity);
      console.log(`${perDay} session/day ${activity.padEnd(10)} -> Combat ${climb.finalValue} by Day 14 · reached 3 on Day ${climb.dayReached3 ?? "never"} · reached 6 on Day ${climb.dayReached6 ?? "never"}`);
    }
  }

  console.log("\n## Footprint by training level (200 seeded robberies each)\n");
  const compared = trainedVersusGreen();
  for (const [label, data] of Object.entries(compared)) {
    console.log(`${label.padEnd(10)} average observation reach ${data.averageReach.toFixed(2)} · catastrophic ${pct(data.catastrophicRate)}`);
  }
  const quieter = compared.dangerous.averageReach < compared.green.averageReach;
  console.log(`\nTraining leaves a lighter footprint: ${quieter}`);

  // A fresh run is the baseline the whole thing is tuned against.
  const fresh = C.reduceGame(C.createRun({ seed: 1000 }), { type: "START_RUN", streetName: "Balance" });
  console.log(`\nFresh run attributes: ${JSON.stringify(fresh.player.attributes)} · identity "${C.selectors.streetIdentity(fresh)}"`);
}

main();
