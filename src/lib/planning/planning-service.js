// RitsuFlow™ planning service boundary.
// Milestone 12: adapters are added only after their production operation is verified.
// This module intentionally does not invent or duplicate database business logic.

import { evaluateMakeReady, weeklyPlanningEligibility } from "./make-ready-domain";
import { constraintReleaseEffect } from "./constraint-domain";

function requireSupabase(supabase) {
  if (!supabase?.rpc) {
    throw new Error("A Supabase client is required by the planning service.");
  }
}

function unwrapRpc(result, operation) {
  if (result?.error) {
    const error = new Error(result.error.message || `${operation} failed.`);
    error.cause = result.error;
    throw error;
  }
  return result?.data;
}

async function executeRpc(supabase, functionName, rpcPayload, operation) {
  requireSupabase(supabase);
  const result = await supabase.rpc(functionName, rpcPayload);
  return unwrapRpc(result, operation);
}

/**
 * Verified against the current Lookahead implementation.
 * Production payload currently uses:
 * { target_readiness_assessment_id: savedAssessment.id }
 */
export async function ensureKoskelaConstraint(supabase, rpcPayload) {
  return executeRpc(
    supabase,
    "ensure_koskela_constraint",
    rpcPayload,
    "Ensure Koskela constraint"
  );
}

/**
 * Verified against Constraint Management's current lifecycle implementation.
 * Open, In Progress or Waiting -> Resolved. Resolution does not release work.
 */
export async function resolveConstraint(supabase, rpcPayload) {
  return executeRpc(
    supabase,
    "resolve_constraint_directly_with_history",
    rpcPayload,
    "Resolve constraint"
  );
}

/**
 * Verified against Constraint Management's current lifecycle implementation.
 * Resolved -> Cleared after explicit verification. For Koskela-linked
 * constraints, the database operation remains authoritative for releasing the
 * readiness condition and recording history.
 */
export async function verifyAndReleaseConstraint(supabase, rpcPayload) {
  return executeRpc(
    supabase,
    "verify_and_clear_constraint_with_history",
    rpcPayload,
    "Verify and release constraint"
  );
}

/**
 * Verified against the current Constraint Management reopen workflow.
 */
export async function reopenConstraint(supabase, rpcPayload) {
  return executeRpc(
    supabase,
    "reopen_constraint_with_history",
    rpcPayload,
    "Reopen constraint"
  );
}

/**
 * Pure evaluation entry point shared by UI code and future workflow nodes.
 */
export function getMakeReadyState(input) {
  return evaluateMakeReady(input);
}

/**
 * Pure Weekly Planning eligibility entry point.
 * Persistence/commit adapters will be added only after the current production
 * operation and exact contract are verified from the source implementation.
 */
export function getWeeklyPlanningEligibility(input) {
  return weeklyPlanningEligibility(input);
}

/**
 * Domain-only representation of the expected release transition.
 * This does not execute persistence.
 */
export function getConstraintReleaseEffect(status) {
  return constraintReleaseEffect(status);
}
