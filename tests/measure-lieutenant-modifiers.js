// v1.20 measurement harness: what Tone's defense multiplier and Deshawn's heat
// reduction are actually worth over a run's worth of nights.
//
// Why this exists instead of a strategy in simulate-runs.js: none of the
// thirteen sim strategies reaches the territory layer. Holding a corner needs
// the garage, Eli recruited AND promoted to Operations, a soldier, and the
// claim cost on top - and across 2,000 seeded runs the `operator` strategy
// claims exactly zero blocks. The territory keys in simulate-runs.js report
// that honestly (all zero), which is a finding about run pacing, not a
// measurement of these modifiers.
//
// So this harness starts where a territory player actually is: garage held, Eli
// running Operations, corners claimed, soldiers posted. Everything else is the
// real reducer on the real seeded RNG - the nights are resolved by
// CONFIRM_END_DAY, not by a copy of the raid math.
//
//   node tests/measure-lieutenant-modifiers.js [runs] [nights]

const C = require("../game-core.js");

const BLOCK_IDS = ["fourth_ave_strip", "northern_lights_motels", "service_road_chokepoint"];

function settle(state) {
  let s = state, guard = 0;
  while (guard++ < 30) {
    if (s.run.openingPending) { s = C.reduceGame(s, { type: "DISMISS_OPENING" }); continue; }
    if (s.run.daySummary) { s = C.reduceGame(s, { type: "DISMISS_DAY_SUMMARY" }); continue; }
    if (s.run.pendingOperationResult) { s = C.reduceGame(s, { type: "ACKNOWLEDGE_OPERATION_RESULT" }); continue; }
    if (s.run.pendingEncounter) { s = C.reduceGame(s, { type: "RESOLVE_ENCOUNTER", choiceId: C.selectors.encounterChoices(s)[0].id }); continue; }
    if (s.run.pendingEvent) { s = C.reduceGame(s, { type: "RESOLVE_EVENT", choiceIndex: 0 }); continue; }
    break;
  }
  return s;
}

// A run that already owns an operation. Written directly rather than played
// into: the point of measurement is the nightly pass, and forty slots of
// trading before it would only add variance to what the pass does.
// toneStatus/deshawnStatus exist so a run can be measured with the person on
// the roster but not on the street ("departed", "arrested") — the A/B that
// proves a modifier really does leave when its owner does.
function territoryRun(seed, { tone = 0, deshawn = 0, toneStatus = "active", deshawnStatus = "active", blocks = BLOCK_IDS, soldiersPerBlock = 2, heat = 4 }) {
  let s = settle(C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Measure" }));
  s = structuredClone(s);
  s.base.controlled = true;
  s.base.acquiredDay = 1;
  s.player.cash = 50000;      // wages never miss, so nobody departs mid-measurement
  s.player.heat = heat;
  Object.assign(s.people.crew.eli, { introduced: true, recruited: true, status: "active", loyalty: 8, recruitedDay: 1, lieutenantStage: "operations_lieutenant", lieutenantEffectiveness: 1, operationPolicy: "balanced" });
  for (const [id, tier, status] of [["tone", tone, toneStatus], ["deshawn", deshawn, deshawnStatus]]) {
    if (!tier) continue;
    Object.assign(s.people.crew[id], { introduced: true, recruited: true, status, loyalty: 8, recruitedDay: 1, tier });
  }
  let next = 1;
  for (const blockId of blocks) {
    const record = s.world.territoryBlocks[blockId];
    record.owner = "player";
    record.capturedDay = 1;
    for (let i = 0; i < soldiersPerBlock; i += 1) {
      const id = `soldier_${next}`;
      next += 1;
      s.world.soldiers[id] = { id, blockId, hiredDay: 1, status: "active" };
      record.soldiersAssigned.push(id);
    }
  }
  s.world.nextSoldierId = next;
  return s;
}

function measure(label, { runs, nights, ...config }) {
  const totals = { blockNights: 0, raids: 0, soldiersLost: 0, blocksLost: 0, peakHeat: 0, heatSum: 0, income: 0 };
  for (let i = 0; i < runs; i += 1) {
    let s = territoryRun(2000 + i, config);
    let peak = s.player.heat;
    for (let night = 0; night < nights && s.run.status === "playing"; night += 1) {
      totals.blockNights += C.selectors.controlledBlockCount(s);
      s.run.dayEndPending = true;
      s = settle(C.reduceGame(s, { type: "CONFIRM_END_DAY" }));
      s.player.cash = 50000;
      peak = Math.max(peak, s.player.heat);
    }
    const blocks = Object.values(s.world.territoryBlocks);
    totals.raids += blocks.reduce((n, b) => n + (b.raidCount || 0), 0);
    totals.income += blocks.reduce((n, b) => n + (b.incomeCollected || 0), 0);
    totals.blocksLost += blocks.filter((b) => b.capturedDay != null && b.owner !== "player").length;
    totals.soldiersLost += Object.values(s.world.soldiers).filter((x) => x.status !== "active").length;
    totals.peakHeat = Math.max(totals.peakHeat, peak);
    totals.heatSum += peak;
  }
  const claimed = runs * (config.blocks || BLOCK_IDS).length;
  return {
    config: label,
    blockLossRate: Number((totals.blocksLost / claimed).toFixed(3)),
    soldiersLostPerRun: Number((totals.soldiersLost / runs).toFixed(2)),
    raidsPerBlockNight: Number((totals.raids / Math.max(1, totals.blockNights)).toFixed(3)),
    averagePeakHeat: Number((totals.heatSum / runs).toFixed(2)),
    worstPeakHeat: totals.peakHeat,
    incomePerRun: Math.round(totals.income / runs),
  };
}

if (require.main === module) {
  const runs = Math.max(1, Number(process.argv[2] || 300));
  const nights = Math.max(1, Number(process.argv[3] || 10));
  const rows = [
    measure("baseline (no lieutenants)", { runs, nights }),
    measure("Tone tier 1", { runs, nights, tone: 1 }),
    measure("Tone tier 2", { runs, nights, tone: 2 }),
    measure("Tone tier 3", { runs, nights, tone: 3 }),
    measure("Deshawn tier 1", { runs, nights, deshawn: 1 }),
    measure("Deshawn tier 2", { runs, nights, deshawn: 2 }),
    measure("Deshawn tier 3", { runs, nights, deshawn: 3 }),
    measure("Tone 3 + Deshawn 3", { runs, nights, tone: 3, deshawn: 3 }),
  ];
  console.log(JSON.stringify({ runs, nights, blocks: BLOCK_IDS.length, rows }, null, 2));
}

module.exports = { territoryRun, measure };
