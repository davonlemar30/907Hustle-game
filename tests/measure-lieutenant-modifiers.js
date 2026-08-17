// v1.20/v1.21 measurement harness: what Tone's defense multiplier and Deshawn's
// heat reduction are actually worth over a run's worth of nights, and — since
// v1.21 — which adversary is doing the damage.
//
// The two nightly passes are measured separately because they are separate
// events with separate counterplay. They also separate cleanly with nothing new
// stored, because the split is total: a police raid never changes who owns a
// corner, and Curtis never leaves one standing. So `raidCount` counts police
// raids and only police raids, and an owner flip is a Curtis move and only a
// Curtis move.
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
const CurtisAwareness = require("../src/data/curtis-awareness.js");

const BLOCK_IDS = ["fourth_ave_strip", "northern_lights_motels", "service_road_chokepoint"];
// Every corner, for the per-block sweep. The three that carry the v1.21 finding
// are spenard_rec_lot (visibility 0 — Curtis never comes, at any phase),
// northern_lights_motels (visibility 3 — he comes most), and
// service_road_chokepoint (patrol 3 — the police come most). A block that tops
// one column and not the other is the split working.
const ALL_BLOCK_IDS = C.SPENARD_BLOCKS.map((block) => block.id);
const CURTIS_PHASES = ["invisible", "ambient", "watching", "approaching"];

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
// curtisPhase pins how hard Curtis is looking for the whole measurement, which
// after v1.21 is the single biggest input to whether corners change hands.
// BOTH level and floor are set on purpose: the day-end block bleeds a level per
// quiet day down to the floor, and every night in here is a quiet day, so a
// level with nothing under it decays to invisible in three nights and measures
// nothing at all.
function territoryRun(seed, { tone = 0, deshawn = 0, toneStatus = "active", deshawnStatus = "active", blocks = BLOCK_IDS, soldiersPerBlock = 2, heat = 4, curtisPhase = "invisible" }) {
  let s = settle(C.reduceGame(C.createRun({ seed }), { type: "START_RUN", streetName: "Measure" }));
  s = structuredClone(s);
  s.base.controlled = true;
  s.base.acquiredDay = 1;
  s.player.cash = 50000;      // wages never miss, so nobody departs mid-measurement
  s.player.heat = heat;
  const awarenessLevel = CurtisAwareness.phaseFloor(curtisPhase);
  // phaseMessagesSent is pre-latched so the fixture does not spend its first
  // night on a Word Around Town text that a real run would already have had.
  Object.assign(s.curtisAwareness, {
    level: awarenessLevel, floor: awarenessLevel, phase: curtisPhase,
    phaseMessagesSent: ["watching", "approaching"],
  });
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
  const held = config.blocks || BLOCK_IDS;
  const totals = { blockNights: 0, policeRaids: 0, curtisFlips: 0, soldiersLost: 0, peakHeat: 0, heatSum: 0, income: 0 };
  // Per corner, so a reader can see WHICH block each adversary went for rather
  // than only how often something happened somewhere.
  const byBlock = Object.fromEntries(held.map((id) => [id, { blockNights: 0, policeRaids: 0, curtisFlips: 0, income: 0 }]));
  for (let i = 0; i < runs; i += 1) {
    let s = territoryRun(2000 + i, config);
    let peak = s.player.heat;
    for (let night = 0; night < nights && s.run.status === "playing"; night += 1) {
      totals.blockNights += C.selectors.controlledBlockCount(s);
      for (const id of held) if (s.world.territoryBlocks[id].owner === "player") byBlock[id].blockNights += 1;
      s.run.dayEndPending = true;
      s = settle(C.reduceGame(s, { type: "CONFIRM_END_DAY" }));
      s.player.cash = 50000;
      peak = Math.max(peak, s.player.heat);
    }
    // The split is total, so the two existing fields separate the adversaries
    // with nothing new persisted: raidCount is police and only police, an owner
    // flip is Curtis and only Curtis.
    for (const id of held) {
      const record = s.world.territoryBlocks[id];
      const raids = record.raidCount || 0;
      const flipped = record.capturedDay != null && record.owner !== "player" ? 1 : 0;
      byBlock[id].policeRaids += raids;
      byBlock[id].curtisFlips += flipped;
      byBlock[id].income += record.incomeCollected || 0;
      totals.policeRaids += raids;
      totals.curtisFlips += flipped;
      totals.income += record.incomeCollected || 0;
    }
    totals.soldiersLost += Object.values(s.world.soldiers).filter((x) => x.status !== "active").length;
    totals.peakHeat = Math.max(totals.peakHeat, peak);
    totals.heatSum += peak;
  }
  const claimed = runs * held.length;
  const rate = (n, d) => Number((n / Math.max(1, d)).toFixed(3));
  const policeRate = rate(totals.policeRaids, totals.blockNights);
  return {
    config: label,
    blockLossRate: Number((totals.curtisFlips / claimed).toFixed(3)),
    soldiersLostPerRun: Number((totals.soldiersLost / runs).toFixed(2)),
    // Kept as an alias: after v1.21 every raid is a police raid, so the old
    // metric name still means exactly what it always meant.
    raidsPerBlockNight: policeRate,
    policeRaidsPerBlockNight: policeRate,
    curtisFlipsPerBlockNight: rate(totals.curtisFlips, totals.blockNights),
    averagePeakHeat: Number((totals.heatSum / runs).toFixed(2)),
    worstPeakHeat: totals.peakHeat,
    incomePerRun: Math.round(totals.income / runs),
    byBlock: Object.fromEntries(Object.entries(byBlock).map(([id, row]) => [id, {
      policeRaidsPerBlockNight: rate(row.policeRaids, row.blockNights),
      curtisFlipsPerBlockNight: rate(row.curtisFlips, row.blockNights),
      lossRate: Number((row.curtisFlips / runs).toFixed(3)),
      incomePerRun: Math.round(row.income / runs),
    }])),
  };
}

if (require.main === module) {
  const runs = Math.max(1, Number(process.argv[2] || 300));
  const nights = Math.max(1, Number(process.argv[3] || 10));
  // The modifier A/B runs at `watching`, where both adversaries are live: at
  // invisible every Curtis number is structurally zero and Tone would look
  // worthless, which would be an artifact of the fixture rather than a finding.
  const modifiers = [
    measure("baseline (no lieutenants)", { runs, nights, curtisPhase: "watching" }),
    measure("Tone tier 1", { runs, nights, curtisPhase: "watching", tone: 1 }),
    measure("Tone tier 2", { runs, nights, curtisPhase: "watching", tone: 2 }),
    measure("Tone tier 3", { runs, nights, curtisPhase: "watching", tone: 3 }),
    measure("Deshawn tier 1", { runs, nights, curtisPhase: "watching", deshawn: 1 }),
    measure("Deshawn tier 2", { runs, nights, curtisPhase: "watching", deshawn: 2 }),
    measure("Deshawn tier 3", { runs, nights, curtisPhase: "watching", deshawn: 3 }),
    measure("Tone 3 + Deshawn 3", { runs, nights, curtisPhase: "watching", tone: 3, deshawn: 3 }),
  ].map(({ byBlock, ...row }) => row);
  // The v1.21 sweep: all six corners, every phase. This is the measurement the
  // split exists to produce — the gradient from "quiet and safe" to "watched
  // and losing corners", and which corner each adversary actually goes for.
  const phases = CURTIS_PHASES.map((curtisPhase) =>
    measure(`phase: ${curtisPhase}`, { runs, nights, curtisPhase, blocks: ALL_BLOCK_IDS }));
  console.log(JSON.stringify({ runs, nights, blocks: BLOCK_IDS.length, modifiers, phases }, null, 2));
}

module.exports = { territoryRun, measure, BLOCK_IDS, ALL_BLOCK_IDS, CURTIS_PHASES };
