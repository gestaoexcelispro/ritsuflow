// RitsuFlow™ canonical Make Ready rules.
// This module composes readiness and constraint state without performing persistence.

import { evaluateReadiness } from "./readiness-domain";
import { isConstraintBlocking } from "./constraint-domain";

export function evaluateMakeReady({ criteria = {}, constraints = [] } = {}) {
  const readiness = evaluateReadiness(criteria);
  const blockingConstraints = (constraints || []).filter((constraint) =>
    isConstraintBlocking(constraint?.status)
  );

  const blockers = [
    ...readiness.blockers.map((blocker) => ({
      type: "readiness",
      ...blocker,
    })),
    ...blockingConstraints.map((constraint) => ({
      type: "constraint",
      constraintId: constraint?.id ?? null,
      status: constraint?.status ?? null,
      criterion: constraint?.criterion ?? constraint?.category ?? null,
    })),
  ];

  return {
    isMakeReady: readiness.isClear && blockingConstraints.length === 0,
    readiness,
    blockingConstraints,
    blockers,
  };
}

export function weeklyPlanningEligibility(input = {}) {
  const result = evaluateMakeReady(input);
  return {
    eligible: result.isMakeReady,
    reason: result.isMakeReady ? "make_ready" : "not_make_ready",
    blockers: result.blockers,
  };
}
