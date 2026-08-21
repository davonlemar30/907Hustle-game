// FS-001 Phase 7, Slice 1: long-run Crew rank and capability foundation.
//
// This module is deliberately pure and behavior-preserving. Existing Crew
// recruitment, payroll, promotion, presence effects, and Boost rules continue
// to run through their current paths until later FS-001 slices wire these
// helpers into operation behavior.

const CREW_RANKS = Object.freeze({
  1: Object.freeze({ rank: 1, label: "RECRUIT" }),
  2: Object.freeze({ rank: 2, label: "PROVEN" }),
  3: Object.freeze({ rank: 3, label: "TRUSTED" }),
  4: Object.freeze({ rank: 4, label: "SPECIALIST LEAD" }),
  5: Object.freeze({ rank: 5, label: "LIEUTENANT" }),
  6: Object.freeze({ rank: 6, label: "INNER CIRCLE" }),
});

const MAX_CREW_RANK = 6;
const BASE_CREW_CAPACITY = 2;

function normalizeRank(value) {
  const rank = Math.floor(Number(value) || 1);
  return Math.max(1, Math.min(MAX_CREW_RANK, rank));
}

function crewRankLabel(value) {
  return CREW_RANKS[normalizeRank(value)].label;
}

// Read a rank-indexed balance curve without allowing an unauthored higher rank
// to drop an existing benefit. Arrays use rank 1 at index 0. Objects may use
// numeric rank keys. Ranks above the highest authored entry retain that entry.
function curveValueForRank(curve, rank, fallback = 1) {
  if (Array.isArray(curve)) {
    if (curve.length === 0) return fallback;
    const requested = Math.max(1, Math.floor(Number(rank) || 1));
    const value = curve[Math.min(curve.length, requested) - 1];
    return value == null ? fallback : value;
  }

  if (curve && typeof curve === "object") {
    const keys = Object.keys(curve)
      .map((key) => Number(key))
      .filter((key) => Number.isFinite(key))
      .sort((a, b) => a - b);
    if (keys.length === 0) return fallback;

    const requested = Math.max(1, Math.floor(Number(rank) || 1));
    let selected = keys[0];
    for (const key of keys) {
      if (key > requested) break;
      selected = key;
    }
    const value = curve[selected];
    return value == null ? fallback : value;
  }

  return fallback;
}

function crewCapacity() {
  return BASE_CREW_CAPACITY;
}

// Capability data describes what a named Crew member can eventually be asked
// to do. It does not assign them, reserve their day, or execute domain logic.
// Those responsibilities belong to Named Crew Operations in a later slice.
const CREW_CAPABILITIES = Object.freeze({
  pherris: Object.freeze({
    "907list_run_board": Object.freeze({
      minRank: 1,
      maxCyclesByRank: Object.freeze([1, 2, 3]),
    }),
  }),
});

function capabilityDefinition(crewId, capabilityId) {
  return CREW_CAPABILITIES[crewId]?.[capabilityId] || null;
}

function crewHasCapability(crewId, capabilityId, rank) {
  const definition = capabilityDefinition(crewId, capabilityId);
  if (!definition) return false;
  const numericRank = Math.floor(Number(rank) || 0);
  return numericRank >= definition.minRank;
}

function crewCapabilityValue(crewId, capabilityId, field, rank, fallback = null) {
  const definition = capabilityDefinition(crewId, capabilityId);
  if (!definition || !crewHasCapability(crewId, capabilityId, rank)) return fallback;
  return curveValueForRank(definition[field], rank, fallback);
}

function crewCapabilitySummary(crewId, capabilityId, rank) {
  const available = crewHasCapability(crewId, capabilityId, rank);
  return {
    crewId,
    capabilityId,
    available,
    maxCycles: available
      ? crewCapabilityValue(crewId, capabilityId, "maxCyclesByRank", rank, 0)
      : 0,
  };
}

module.exports = {
  CREW_RANKS,
  MAX_CREW_RANK,
  BASE_CREW_CAPACITY,
  CREW_CAPABILITIES,
  normalizeRank,
  crewRankLabel,
  curveValueForRank,
  crewCapacity,
  capabilityDefinition,
  crewHasCapability,
  crewCapabilityValue,
  crewCapabilitySummary,
};
