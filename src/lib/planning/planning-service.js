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

/**
 * Verified against the current Lookahead implementation.
 * Production payload currently uses:
 * { target_readiness_assessment_id: savedAssessment.id }
 */
export async function ensureKoskelaConstraint(supabase, rpcPayload) {
  requireSupabase(supabase);
  const result = await supabase.rpc("ensure_koskela_constraint", rpcPayload);
  return unwrapRpc(result, "Ensure Koskela constraint");
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
