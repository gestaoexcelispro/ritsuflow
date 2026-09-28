// RitsuFlow™ canonical planning domain helpers.
// Milestone 12: pure rules only. No Supabase access and no UI dependencies.

export const READINESS_CRITERIA = Object.freeze([
  "space",
  "equipment",
  "labor",
  "materials",
  "information",
  "external",
]);

export const READINESS_STATES = Object.freeze({
  CLEAR: "clear",
  CONSTRAINED: "constrained",
  NOT_APPLICABLE: "not_applicable",
});

export const CONSTRAINT_ACTIVE_STATUSES = Object.freeze([
  "open",
  "in_progress",
  "waiting",
  "resolved",
]);

export const CONSTRAINT_RELEASED_STATUS = "cleared";

export function normalizeReadinessState(value) {
  if (value === true || value === "yes" || value === "clear") return READINESS_STATES.CLEAR;
  if (value === false || value === "no" || value === "constrained") return READINESS_STATES.CONSTRAINED;
  if (value === "n/a" || value === "na" || value === "not_applicable") return READINESS_STATES.NOT_APPLICABLE;
  return null;
}

export function isCriterionSatisfied(value) {
  const state = normalizeReadinessState(value);
  return state === READINESS_STATES.CLEAR || state === READINESS_STATES.NOT_APPLICABLE;
}

export function evaluateReadiness(criteria = {}) {
  const normalized = {};
  const blockers = [];

  for (const criterion of READINESS_CRITERIA) {
    const state = normalizeReadinessState(criteria?.[criterion]);
    normalized[criterion] = state;

    if (!isCriterionSatisfied(state)) {
      blockers.push({
        criterion,
        state,
        reason: state === READINESS_STATES.CONSTRAINED ? "constrained" : "missing_assessment",
      });
    }
  }

  return {
    isClear: blockers.length === 0,
    normalized,
    blockers,
  };
}

export function canMoveToWeeklyPlanning(readiness) {
  return Boolean(readiness?.isClear ?? readiness?.readiness_is_clear);
}

export function assertWeeklyPlanningEligibility(readiness, label = "Work Package") {
  if (!canMoveToWeeklyPlanning(readiness)) {
    throw new Error(`${label} is not Make Ready and cannot move to Weekly Planning.`);
  }
  return true;
}

export function isConstraintLifecycleBlocking(status) {
  return CONSTRAINT_ACTIVE_STATUSES.includes(String(status || "").toLowerCase());
}

export function isConstraintReleased(status) {
  return String(status || "").toLowerCase() === CONSTRAINT_RELEASED_STATUS;
}

export function readinessSourceAfterConstraintRelease() {
  return "constraint_cleared";
}
