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
 * Verified against Weekly Planning's current plan-creation workflow.
 * Production payload currently uses:
 * { target_project_id: selectedProject.id }
 *
 * The RPC remains authoritative for selecting the project's active Lookahead
 * Plan before a Weekly Plan is created.
 */
export async function getActiveLookaheadPlan(supabase, rpcPayload) {
  return executeRpc(
    supabase,
    "get_active_lookahead_plan",
    rpcPayload,
    "Get active Lookahead Plan"
  );
}

/**
 * Verified against the current Weekly Planning commit workflow.
 * Production payload currently uses:
 * { target_weekly_plan_id: weeklyPlan.id }
 *
 * The database RPC remains authoritative: it revalidates Make Ready and freezes
 * the commitment baseline used for PPC before the plan becomes committed.
 */
export async function commitWeeklyPlanWithMakeReady(supabase, rpcPayload) {
  return executeRpc(
    supabase,
    "commit_weekly_plan_with_make_ready",
    rpcPayload,
    "Commit Weekly Plan with Make Ready"
  );
}

/**
 * Verified against the current Weekly Planning cancellation workflow.
 * Only the draft-week cancellation operation is represented here; committed
 * work is intentionally outside this adapter's contract.
 */
export async function cancelWeeklyPlan(supabase, rpcPayload) {
  return executeRpc(
    supabase,
    "cancel_weekly_plan",
    rpcPayload,
    "Cancel Weekly Plan"
  );
}

/**
 * Verified against the current Weekly Planning close workflow.
 * Production payload currently uses:
 * { target_weekly_plan_id: weeklyPlan.id }
 *
 * The database operation remains authoritative for finalizing PPC and moving
 * the committed Weekly Plan into its historical closed state.
 */
export async function closeWeeklyPlan(supabase, rpcPayload) {
  return executeRpc(
    supabase,
    "close_weekly_plan",
    rpcPayload,
    "Close Weekly Plan"
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
