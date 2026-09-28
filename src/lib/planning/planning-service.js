// RitsuFlow™ planning service boundary.
// Milestone 12: adapters around existing canonical Supabase RPCs.
// This module intentionally does not duplicate database business logic.

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

/**
 * Preserve the existing canonical database behavior that ensures a Koskela
 * readiness constraint exists. The caller supplies the RPC payload because
 * the production function signature remains authoritative.
 */
export async function ensureKoskelaConstraint(supabase, rpcPayload) {
  requireSupabase(supabase);
  const result = await supabase.rpc("ensure_koskela_constraint", rpcPayload);
  return unwrapRpc(result, "Ensure Koskela constraint");
}

/**
 * Preserve the existing Verify & Release operation. Resolution alone does not
 * make work ready; the canonical RPC performs the verified clear transition
 * and history behavior.
 */
export async function verifyAndReleaseConstraint(supabase, rpcPayload) {
  requireSupabase(supabase);
  const result = await supabase.rpc("verify_and_clear_constraint_with_history", rpcPayload);
  return unwrapRpc(result, "Verify and release constraint");
}

/**
 * Preserve the existing Weekly Plan commitment gate. The canonical RPC must
 * revalidate Make Ready before the PPC commitment baseline is frozen.
 */
export async function commitWeeklyPlan(supabase, rpcPayload) {
  requireSupabase(supabase);
  const result = await supabase.rpc("commit_weekly_plan_with_make_ready", rpcPayload);
  return unwrapRpc(result, "Commit Weekly Plan");
}

/**
 * Pure evaluation entry point shared by UI code and future workflow nodes.
 */
export function getMakeReadyState(input) {
  return evaluateMakeReady(input);
}

/**
 * Pure Weekly Planning eligibility entry point. This is an early/pre-draft
 * gate; commitWeeklyPlan remains the authoritative final commitment gate.
 */
export function getWeeklyPlanningEligibility(input) {
  return weeklyPlanningEligibility(input);
}

/**
 * Expose the expected domain effect of Verify & Release for callers that need
 * to render or validate the transition without executing persistence.
 */
export function getConstraintReleaseEffect(status) {
  return constraintReleaseEffect(status);
}
