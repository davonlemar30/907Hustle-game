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
// Why this exists instead of a strategy in simulate-runs.js: of the fourteen sim
// strategies only `territory` reaches the block layer at all, and it holds a
// soldier in 24 runs out of 200. Holding a corner needs the garage, Eli
// recruited AND promoted to Operations, a soldier, and the claim cost on top.
// The territory keys in simulate-runs.js report that honestly, which is a
// finding about run pacing, not a measurement of these modifiers.
//
// So this harness starts where a territory player actually is: garage held, Eli
// running Operations, corners claimed, soldiers posted. Everything else is the
// real reducer on the real seeded RNG - the nights are resolved by
// CONFIRM_END_DAY, not by a copy of the raid math.
//
//   node tests/measure-lieutenant-modifiers.js [runs] [nights]
//
// ---------------------------------------------------------------------------
// v1.28 BASELINES. Measured on this file at 300 runs x 10 nights, six corners,
// two soldiers each, Heat starting at 4. These are the numbers the balance pass
// tuned against and the regression surface for anything that touches the block
// layer afterwards. `blockLossRate` is the fraction of held corners Curtis took
// across the window and is the metric the targets attach to; the per-night
// column is the same events divided by held corner-nights and is reported so a
// reader can see both.
//
// BEFORE (v1.27 constants: base 0.12, multipliers 0/0.5/1.0/1.5, no heat probe,
// unstaffed corners floored to one defender):
//
//   phase         loss    /night  police/night  soldiers/run  peakHeat
//   invisible     0.000   0.000   0.171         8.76          14.94
//   ambient       0.119   0.018   0.171         9.08          14.84
//   watching      0.294   0.047   0.170         9.57          14.54
//   approaching   0.422   0.069   0.169         9.89          14.08
//
// AFTER (v1.28: base 0.05, multipliers 0/0.6/1.0/2.0, heat probe live, an empty
// corner worth half a defender) - see the table this file prints.
//
// Three things that were true before the pass and stayed true:
//
//   - The POLICE rate is flat across every phase (0.169-0.171). It was already
//     independent of how hard Curtis is looking, which is what the v1.21 split
//     was for, and this build did not touch it. Police cost soldiers and Heat
//     and never take a corner.
//   - `invisible` is structurally zero, not merely small. The phase multiplier
//     is 0 AND the visibility gate is 99, so two independent things would have
//     to break for a corner to be lost while he is not looking.
//   - Losing a corner raises his awareness by one (the `defiance` broadcast in
//     resolveSoldierOperations) and the awareness FLOOR ratchets and never
//     falls. A player who slips once is pushed toward slipping again. v1.28
//     measured this loop and deliberately did not add counter-pressure to it.
//
// ---------------------------------------------------------------------------

const C = require("../game-core.js");
const CurtisAwareness = require("../src/data/curtis-awareness.js");
const Territory = require("../src/data/territory.js");
const { stringHash } = require("../src/hash.js");

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
// reserveSoldiers are hired and idle at the garage rather than posted. They are
// what makes "act on the warning" a real option instead of a shell game: without
// a reserve, reinforcing a warned corner means stripping another one, and the
// measurement ends up scoring a player robbing Peter to pay Paul.
function territoryRun(seed, { tone = 0, deshawn = 0, toneStatus = "active", deshawnStatus = "active", blocks = BLOCK_IDS, soldiersPerBlock = 2, reserveSoldiers = 0, heat = 4, curtisPhase = "invisible" }) {
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
  for (let i = 0; i < reserveSoldiers; i += 1) {
    const id = `soldier_${next}`;
    next += 1;
    s.world.soldiers[id] = { id, blockId: null, hiredDay: 1, status: "active" };
  }
  s.world.nextSoldierId = next;
  return s;
}

// --- v1.28 instrumentation --------------------------------------------------
//
// The gate Curtis rolls against is a hash of the seed, the corner and the day,
// not a draw off the tick's stream (game-core `blockGateRoll`). That is what
// makes the warning question answerable EXACTLY rather than statistically: the
// roll for tonight is already decided and can be read without perturbing it, so
// "would this corner have fallen, and does posting soldiers on it change that"
// is arithmetic on one number rather than two runs that have to be matched up.
//
// Reproduced here rather than exported from game-core because the harness has
// to be able to ask the question for a staffing level the game is not in.
function curtisGateRoll(state, blockId) {
  return (stringHash(`${state.run.seed}:raid:${blockId}:${state.run.day}:curtis`) % 10000) / 10000;
}

// What the corner's chance would be at a different headcount. curtisMoveChance
// is linear in 1/defense and everything above the divisor is unchanged, so the
// counterfactual is the live chance scaled by the ratio of the two divisors -
// no clone of a large state per corner per night.
function chanceAtStaffing(state, blockId, posted) {
  const live = C.selectors.curtisMoveChance(state, blockId);
  if (!live) return 0;
  const record = state.world.territoryBlocks[blockId];
  const now = record.soldiersAssigned.length;
  const divisor = (n) => (n > 0 ? n * C.RAID_DEFENSE_PER_SOLDIER : Territory.CURTIS_UNSTAFFED_DEFENSE);
  return Math.min(0.9, live * divisor(now) / divisor(posted));
}

// Acting on a warning, made concrete - and made finite, which is the whole
// point of it.
//
// The pressure weight is the number the gossip text exists to deliver, "coming
// hard" (2) versus "just looking" (1), and the tactical reading of it is how
// many people to put on the corner: weight + 1, capped by the block cap. What
// makes that a decision rather than a formality is that the player does not get
// new soldiers to do it with. They redistribute the ones they have, down the
// plan in his own priority order, until they run out - so at a phase that names
// two corners they can cover both, and at one that names three they are choosing.
//
// That scarcity is why this is measured against the plan's DEPTH and BUDGET and
// not against the base chance. If the answer at approaching is the same as the
// answer at watching, the budget table is not spreading him thin enough to make
// the warning a triage decision, and the budget is the thing to move.
function warnedDefensePlan(state, plan, held) {
  let pool = held.reduce((sum, id) => sum + state.world.territoryBlocks[id].soldiersAssigned.length, 0)
    + C.selectors.unassignedSoldiers(state).length;
  const assigned = new Map();
  for (const entry of plan) {
    const want = Math.min(C.SOLDIERS_PER_BLOCK_CAP, (Number(entry.weight) || 1) + 1);
    const give = Math.max(0, Math.min(want, pool));
    assigned.set(entry.blockId, give);
    pool -= give;
  }
  return assigned;
}

function measure(label, { runs, nights, ...config }) {
  const held = config.blocks || BLOCK_IDS;
  const totals = {
    blockNights: 0, policeRaids: 0, curtisFlips: 0, soldiersLost: 0, peakHeat: 0, heatSum: 0, income: 0,
    // v1.28 columns.
    heatFactorSum: 0, heatFactorNights: 0,
    warnedNights: 0, warnedUnderThreat: 0, warnedSaved: 0, warnedCovered: 0,
    topWarnedUnderThreat: 0, topWarnedSaved: 0,
    bankNights: 0, bankPointSum: 0,
    grudgeFlips: 0, freshFlips: 0,
  };
  // Per corner, so a reader can see WHICH block each adversary went for rather
  // than only how often something happened somewhere.
  const byBlock = Object.fromEntries(held.map((id) => [id, { blockNights: 0, policeRaids: 0, curtisFlips: 0, income: 0 }]));
  for (let i = 0; i < runs; i += 1) {
    let s = territoryRun(2000 + i, config);
    let peak = s.player.heat;
    for (let night = 0; night < nights && s.run.status === "playing"; night += 1) {
      totals.blockNights += C.selectors.controlledBlockCount(s);
      for (const id of held) if (s.world.territoryBlocks[id].owner === "player") byBlock[id].blockNights += 1;
      // --- read the night before it resolves ---------------------------------
      // Everything below is a pure read of the state the day-end pass is about
      // to consume. Nothing here writes, so the measurement cannot move what it
      // is measuring.
      totals.heatFactorSum += C.selectors.curtisHeatFactor(s);
      totals.heatFactorNights += 1;
      const bank = s.run.curtisPressureBank || { points: 0 };
      if ((bank.points || 0) > 0) { totals.bankNights += 1; totals.bankPointSum += bank.points; }
      const plan = C.selectors.curtisNightPlan(s).filter((entry) => s.world.territoryBlocks[entry.blockId]?.owner === "player");
      const defended = warnedDefensePlan(s, plan, held.filter((id) => s.world.territoryBlocks[id].owner === "player"));
      for (let rank = 0; rank < plan.length; rank += 1) {
        const entry = plan[rank];
        const want = Math.min(C.SOLDIERS_PER_BLOCK_CAP, (Number(entry.weight) || 1) + 1);
        const got = defended.get(entry.blockId) || 0;
        totals.warnedNights += 1;
        // Coverage is the triage question on its own, independent of whether the
        // roll happened to land: could the player put on this corner what the
        // warning told them to. At a phase that names more corners than they
        // have people, some of these are always no.
        if (got >= want) totals.warnedCovered += 1;
        const roll = curtisGateRoll(s, entry.blockId);
        // Only corners the night was actually going to take can be saved. A
        // warning about a corner that was never going to fall is not a save,
        // and counting it as one would inflate the number that decides whether
        // the gossip system is worth anything.
        if (roll >= C.selectors.curtisMoveChance(s, entry.blockId)) continue;
        totals.warnedUnderThreat += 1;
        const saved = roll >= chanceAtStaffing(s, entry.blockId, got);
        if (saved) totals.warnedSaved += 1;
        // The corner he wants most, tracked on its own. It is the one corner a
        // player without Deshawn hears about at all (GOSSIP_WARNING_BASE_SCOPE
        // is 1), so its save rate is the honest answer to "is the warning worth
        // anything to somebody who is not wired in".
        if (rank === 0) {
          totals.topWarnedUnderThreat += 1;
          if (saved) totals.topWarnedSaved += 1;
        }
      }
      const grudgeBefore = new Set(held.filter((id) => s.world.territoryBlocks[id].curtisTookBack));
      const heldBefore = new Set(held.filter((id) => s.world.territoryBlocks[id].owner === "player"));
      s.run.dayEndPending = true;
      s = settle(C.reduceGame(s, { type: "CONFIRM_END_DAY" }));
      // pinHeat holds the player at a fixed temperature for the whole
      // measurement. Without it a Heat sweep measures the wrong thing entirely:
      // Heat climbs on its own, a hot run gets the player arrested, an arrested
      // run stops early, and the column ends up reporting how many nights the
      // run survived rather than what the probe is worth. Cash is already
      // reset on the same line and for the same kind of reason.
      if (config.pinHeat) s.player.heat = config.heat;
      // Did he come back for one he had already taken once, or take a new one?
      for (const id of held) {
        if (!heldBefore.has(id) || s.world.territoryBlocks[id].owner === "player") continue;
        if (grudgeBefore.has(id)) totals.grudgeFlips += 1; else totals.freshFlips += 1;
      }
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
    // --- v1.28 columns ------------------------------------------------------
    // The mean Heat multiplier the nights actually ran at. 1.0 means the probe
    // never engaged; the phase fixture starts at Heat 4 and climbs, so it does.
    // How much of the loss rate this is worth is the paired control below, not
    // this number - a multiplier is not a share.
    averageHeatFactor: Number((totals.heatFactorSum / Math.max(1, totals.heatFactorNights)).toFixed(3)),
    // Of the warned corners the night was going to take, how many survive if
    // the player acts on the warning. This is the number that says whether the
    // gossip system is tactically useful or merely atmospheric.
    warnedCornerNights: totals.warnedNights,
    warnedUnderThreat: totals.warnedUnderThreat,
    warningSaveRate: Number((totals.warnedSaved / Math.max(1, totals.warnedUnderThreat)).toFixed(3)),
    // The corner at the top of his list - the only one an unwired player hears
    // about - and whether the player had the people to do what they were told.
    topWarningSaveRate: Number((totals.topWarnedSaved / Math.max(1, totals.topWarnedUnderThreat)).toFixed(3)),
    warningCoverage: Number((totals.warnedCovered / Math.max(1, totals.warnedNights)).toFixed(3)),
    // How often he is carrying unspent intent, and how much.
    bankActiveNightRate: rate(totals.bankNights, totals.heatFactorNights),
    averageBankedPoints: Number((totals.bankPointSum / Math.max(1, totals.bankNights)).toFixed(2)),
    // Corners he came back for versus corners he took for the first time.
    recaptureFlips: totals.grudgeFlips,
    freshFlips: totals.freshFlips,
    recaptureShare: Number((totals.grudgeFlips / Math.max(1, totals.grudgeFlips + totals.freshFlips)).toFixed(3)),
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

  // v1.28: what the Heat probe is actually worth, as a paired control rather
  // than an inference. The probe is neutralized by zeroing its per-point value
  // for the duration of the second pass - the same technique the fixture uses
  // when it writes a run's end state directly, and the constant is restored
  // immediately so nothing downstream reads a doctored module.
  const probePerPoint = Territory.CURTIS_HEAT_PROBE_PER_POINT;
  Territory.CURTIS_HEAT_PROBE_PER_POINT = 0;
  const withoutProbe = CURTIS_PHASES.map((curtisPhase) =>
    measure(`phase: ${curtisPhase} (heat probe off)`, { runs, nights, curtisPhase, blocks: ALL_BLOCK_IDS }));
  Territory.CURTIS_HEAT_PROBE_PER_POINT = probePerPoint;
  const heatProbe = CURTIS_PHASES.map((curtisPhase, index) => {
    const on = phases[index], off = withoutProbe[index];
    return {
      config: `phase: ${curtisPhase}`,
      averageHeatFactor: on.averageHeatFactor,
      blockLossRate: on.blockLossRate,
      blockLossRateWithoutProbe: off.blockLossRate,
      // The share of the loss rate the probe is responsible for. Zero at
      // invisible because there is nothing to be responsible for.
      heatFactorLossShare: on.blockLossRate
        ? Number(((on.blockLossRate - off.blockLossRate) / on.blockLossRate).toFixed(3))
        : 0,
    };
  });

  // The probe on its own, read directly off the gate rather than sampled from
  // runs - and that choice is the measurement, not a shortcut.
  //
  // A full-run Heat sweep cannot answer this question honestly. Heat climbs on
  // its own, a hot player gets arrested, an arrested run stops early, and a run
  // that stops on night two only ever sampled nights where the garrisons were
  // still full. Measured that way the loss rate FALLS from Heat 12 to Heat 15,
  // which is survivorship reporting itself as safety. `curtisMoveChance` is a
  // pure function of the state, so the multiplier can be read exactly at a fixed
  // staffing with nothing to survive.
  const heatProbeBlock = "northern_lights_motels";
  const heatLevels = [0, 5, 8, 9, 10, 12, 15].map((heat) => {
    const row = { heat, factor: null, chanceByStaffing: {} };
    for (const posted of [0, 1, 2]) {
      const state = territoryRun(2000, { curtisPhase: "watching", blocks: [heatProbeBlock], soldiersPerBlock: posted, heat });
      row.factor = Number(C.selectors.curtisHeatFactor(state).toFixed(3));
      row.chanceByStaffing[posted] = Number(C.selectors.curtisMoveChance(state, heatProbeBlock).toFixed(4));
    }
    return row;
  });

  // Corner survival by how many people are standing on it. The v1.28 unstaffed
  // term is the difference between the 0 row and the 1 row: before this build
  // they were arithmetically identical.
  const staffing = [0, 1, 2].map((soldiersPerBlock) =>
    ({ soldiersPerBlock, ...measure(`soldiers: ${soldiersPerBlock}`, { runs, nights, curtisPhase: "watching", soldiersPerBlock, blocks: ALL_BLOCK_IDS }) }))
    .map(({ byBlock, ...row }) => row);

  // What the territory Heat trickle costs, with and without Deshawn. Read off
  // peak Heat rather than a counter: the trickle is the only path that raises
  // Heat in a fixture that never commits a crime.
  const heatTrickle = [0, 1, 2, 3].map((deshawn) =>
    ({ deshawnTier: deshawn, ...measure(`trickle: deshawn ${deshawn}`, { runs, nights, curtisPhase: "invisible", deshawn, blocks: ALL_BLOCK_IDS }) }))
    .map(({ byBlock, ...row }) => row);

  // Is the warning worth acting on? Measured on the operation the balance
  // targets actually describe - three corners and a thin crew - rather than on
  // the six-corner phase sweep, where twelve soldiers cover every warned corner
  // at once and the answer is a property of the fixture instead of the design.
  // One soldier a corner is the player who has just built the ladder and has
  // nothing spare, which is exactly the player the warning is for.
  const warnings = CURTIS_PHASES.map((curtisPhase) =>
    measure(`warning: ${curtisPhase}`, { runs, nights, curtisPhase, soldiersPerBlock: 1, reserveSoldiers: 3 }))
    .map(({ byBlock, ...row }) => row);

  console.log(JSON.stringify({
    runs, nights, blocks: BLOCK_IDS.length,
    constants: {
      curtisBase: Territory.CURTIS_BASE_CHANCE,
      phaseMultiplier: Territory.CURTIS_PHASE_MULTIPLIER,
      unstaffedDefense: Territory.CURTIS_UNSTAFFED_DEFENSE,
      heatProbeFloor: Territory.CURTIS_HEAT_PROBE_FLOOR,
      heatProbePerPoint: Territory.CURTIS_HEAT_PROBE_PER_POINT,
    },
    modifiers, phases, heatProbe, heatLevels, staffing, heatTrickle, warnings,
  }, null, 2));
}

module.exports = { territoryRun, measure, BLOCK_IDS, ALL_BLOCK_IDS, CURTIS_PHASES };
