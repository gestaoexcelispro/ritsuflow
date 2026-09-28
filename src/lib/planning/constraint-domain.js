// RitsuFlow™ canonical constraint lifecycle rules.
// Pure domain rules only: no Supabase access and no UI dependencies.

import {
  CONSTRAINT_ACTIVE_STATUSES,
  CONSTRAINT_RELEASED_STATUS,
  READINESS_STATES,
  readinessSourceAfterConstraintRelease,
} from "./readiness-domain";

export const CONSTRAINT_STATUSES = Object.freeze({
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  WAITING: "waiting",
  RESOLVED: "resolved",
  CLEARED: CONSTRAINT_RELEASED_STATUS,
  CANCELLED: "cancelled",
});

export function normalizeConstraintStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return Object.values(CONSTRAINT_STATUSES).includes(value) ? value : null;
}

export function canResolveConstraint(status) {
  const normalized = normalizeConstraintStatus(status);
  return [
    CONSTRAINT_STATUSES.OPEN,
    CONSTRAINT_STATUSES.IN_PROGRESS,
    CONSTRAINT_STATUSES.WAITING,
  ].includes(normalized);
}

export function requiresVerification(status) {
  return normalizeConstraintStatus(status) === CONSTRAINT_STATUSES.RESOLVED;
}

export function canVerifyAndReleaseConstraint(status) {
  return requiresVerification(status);
}

export function isConstraintBlocking(status) {
  return CONSTRAINT_ACTIVE_STATUSES.includes(normalizeConstraintStatus(status));
}

export function constraintReleaseEffect(status) {
  if (!canVerifyAndReleaseConstraint(status)) {
    return {
      canRelease: false,
      nextConstraintStatus: normalizeConstraintStatus(status),
      readinessState: null,
      readinessSource: null,
    };
  }

  return {
    canRelease: true,
    nextConstraintStatus: CONSTRAINT_STATUSES.CLEARED,
    readinessState: READINESS_STATES.CLEAR,
    readinessSource: readinessSourceAfterConstraintRelease(),
  };
}
