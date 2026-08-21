// FS-001 Phase 7, Slice 1: shared requirement evaluator.
//
// Requirement records stay semantic and return structured blockers. Presentation
// can translate blocker_copy_key later without rebuilding eligibility logic.

const { CREW_WAGE_GRACE_DAYS } = require("../data/crew.js");

function crewRecord(facts, crewId) {
  return facts?.crew?.[crewId] || null;
}

function result(requirement, ok, current, required, blockerCode) {
  return {
    ok,
    blocker_code: ok ? null : (requirement.blockerCode || blockerCode || requirement.type),
    blocker_copy_key: ok ? null : (requirement.blockerCopyKey || `requirements.${requirement.type}`),
    current,
    required,
  };
}

function evaluateRequirement(requirement, facts = {}) {
  if (!requirement || typeof requirement !== "object") {
    return {
      ok: false,
      blocker_code: "invalid_requirement",
      blocker_copy_key: "requirements.invalid_requirement",
      current: null,
      required: "requirement_record",
    };
  }

  const crew = crewRecord(facts, requirement.crewId);
  const min = Number(requirement.min) || 0;

  switch (requirement.type) {
    case "crew_active": {
      const current = Boolean(crew?.recruited && crew?.status === "active");
      return result(requirement, current, current, true);
    }

    case "crew_loyalty_min": {
      const current = Number(crew?.loyalty) || 0;
      return result(requirement, current >= min, current, min);
    }

    case "crew_rank_min": {
      const current = Number(crew?.tier) || 0;
      return result(requirement, current >= min, current, min);
    }

    case "crew_tenure_days_min": {
      const currentDay = Number(facts.currentDay) || 0;
      const recruitedDay = crew?.recruitedDay;
      const current = recruitedDay == null
        ? Number.POSITIVE_INFINITY
        : Math.max(0, currentDay - Number(recruitedDay));
      return result(requirement, current >= min, current, min);
    }

    case "hustle_tier_min": {
      const current = Number(facts?.hustleTiers?.[requirement.hustleId]) || 0;
      return result(requirement, current >= min, current, min);
    }

    case "payroll_not_delinquent": {
      if (!crew || crew.wageMissedSince == null) {
        return result(requirement, true, 0, "within_grace");
      }
      const currentDay = Number(facts.currentDay) || 0;
      const graceDays = Number.isFinite(Number(facts.wageGraceDays))
        ? Number(facts.wageGraceDays)
        : CREW_WAGE_GRACE_DAYS;
      const missedDays = Math.max(0, currentDay - Number(crew.wageMissedSince));
      return result(requirement, missedDays <= graceDays, missedDays, graceDays);
    }

    case "crew_unassigned_today": {
      const assignment = facts?.assignments?.[requirement.crewId];
      const currentDay = Number(facts.currentDay) || 0;
      const assignedToday = Boolean(assignment && Number(assignment.day) === currentDay);
      return result(requirement, !assignedToday, assignedToday, false);
    }

    case "planning_window_open": {
      const current = Number(facts.timeSlotsToday) || 0;
      return result(requirement, current === 0, current, 0);
    }

    case "proof_flag": {
      const current = Boolean(crew?.proofs?.[requirement.key]);
      return result(requirement, current, current, true);
    }

    case "proof_counter_min": {
      const current = Number(crew?.proofs?.[requirement.key]) || 0;
      return result(requirement, current >= min, current, min);
    }

    default:
      return {
        ok: false,
        blocker_code: "unsupported_requirement",
        blocker_copy_key: "requirements.unsupported_requirement",
        current: requirement.type || null,
        required: "supported_requirement_type",
      };
  }
}

function evaluateRequirements(requirements, facts = {}) {
  for (const requirement of requirements || []) {
    const evaluated = evaluateRequirement(requirement, facts);
    if (!evaluated.ok) return evaluated;
  }
  return {
    ok: true,
    blocker_code: null,
    blocker_copy_key: null,
    current: null,
    required: null,
  };
}

module.exports = {
  evaluateRequirement,
  evaluateRequirements,
};
