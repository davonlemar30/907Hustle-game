# FS-001 Phase 7 — Slice 1: Web Canon Structural Crew Foundation

## Scope

This slice establishes the behavior-preserving web-canon foundation required by TI-001 before Named Crew Operations are introduced.

Implemented:

- six Crew rank labels from Recruit through Inner Circle;
- safe rank-curve lookup that retains the highest authored value above the authored range;
- a `crewCapacity()` extension seam that continues to return the current capacity of 2;
- named Crew capability data, beginning with Pherris `907list_run_board` at 1 / 2 / 3 cycles for Rank 1 / 2 / 3+;
- a shared Requirement Evaluator with structured blocker output;
- coverage for rank boundaries, curve clamping, current wage/effect parity, capability scaling, requirement gates, wage grace, assignment occupancy, planning window, proof state, and unsupported requirements.

## Behavior Boundary

This slice introduces no delegation action, assignment persistence, save-schema change, 907List purchase behavior, UI change, Boost availability change, wage change, promotion-rule change, or economy tuning.

Existing Crew gameplay remains on its current code paths. Later FS-001 slices consume the new rank/capability and requirement contracts.

## Requirement Types

The shared evaluator supports the TI-001 initial contract:

- `crew_active`
- `crew_loyalty_min`
- `crew_rank_min`
- `crew_tenure_days_min`
- `hustle_tier_min`
- `payroll_not_delinquent`
- `crew_unassigned_today`
- `planning_window_open`
- `proof_flag`
- `proof_counter_min`

Blockers return:

```js
{
  ok,
  blocker_code,
  blocker_copy_key,
  current,
  required,
}
```

Evaluation stops at the first failed requirement so caller-defined ordering remains deterministic.

## Compatibility Decisions

- Persisted Crew field `tier` remains unchanged.
- Tier 1–3 promotion rules remain unchanged.
- Higher rank labels exist as representation only. Exact Tier 4–6 promotion requirements remain deferred.
- Existing wage arrays continue to preserve their highest authored value at higher tiers.
- Existing Tone and Deshawn rank-dependent effects continue retaining their Tier 3 benefit at higher tiers.
- Pherris capability data describes capacity only. It performs no buying, assignment, or settlement.
- Boost remains independent because this slice does not read or reserve daily assignments from existing Boost progression/execution paths.

## Validation

Primary command:

```sh
npm test
```

Focused file:

```sh
node --test tests/fs-001-slice-1.test.js
```

Phase 7 acceptance requires the new focused tests plus the existing Crew regression suite to pass before merge.

## Intentional Divergences

None. The implementation follows the approved Phase 5 and Phase 6 contracts for Slice 1.

## Next Slice Dependency

FS-001.3 Named Crew Operations may consume these contracts after this slice is accepted. FS-001.2 Godot 907List parity repair remains independently parallelizable.
