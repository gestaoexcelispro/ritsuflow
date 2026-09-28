// RitsuFlow™ grouped readiness persistence service.
// Extracted from Lookahead behavior without changing its database contract.
// No UI state lives here.

import { ensureKoskelaConstraint } from "./planning-service";

function requireSupabase(supabase) {
  if (!supabase?.from || !supabase?.rpc) {
    throw new Error("A Supabase client is required by the readiness assessment service.");
  }
}

function normalizeSavedStatus(value) {
  if (value === "clear" || value === "constrained" || value === "not_applicable") {
    return value;
  }
  return "not_assessed";
}

/**
 * Persist one grouped Koskela assessment using the same table, conflict key,
 * readiness_source rule and central-constraint synchronization currently used
 * by the Lookahead page.
 *
 * Important lifecycle rule:
 * - constrained => ensure one central Constraint exists
 * - clear does NOT clear an existing central Constraint
 * - once a Constraint exists, Constraint Management remains authoritative
 *
 * Partial-save behavior is intentional: if the assessment saves successfully
 * but central Constraint synchronization fails, the saved assessment is
 * returned together with constraintSyncError. This mirrors the existing
 * Lookahead behavior and prevents the UI from pretending the assessment write
 * was rolled back when it was not.
 */
export async function saveGroupedReadinessAssessment(
  supabase,
  { sheetRowId, category, status }
) {
  requireSupabase(supabase);

  if (!sheetRowId || !category) {
    throw new Error("sheetRowId and category are required.");
  }

  const readinessSource = status === "clear" ? "direct" : null;

  const { data: savedAssessment, error: assessmentError } = await supabase
    .from("lookahead_sheet_readiness_assessments")
    .upsert(
      {
        sheet_row_id: sheetRowId,
        category,
        status,
        readiness_source: readinessSource,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "sheet_row_id,category",
      }
    )
    .select(
      "id, sheet_row_id, category, status, readiness_source, created_at, updated_at"
    )
    .single();

  if (assessmentError) {
    throw assessmentError;
  }

  const assessment = {
    ...savedAssessment,
    status: normalizeSavedStatus(savedAssessment?.status),
    readiness_source: savedAssessment?.readiness_source || null,
  };

  let linkedConstraint = null;
  let constraintSyncError = null;

  if (assessment.status === "constrained" && assessment.id) {
    try {
      await ensureKoskelaConstraint(supabase, {
        target_readiness_assessment_id: assessment.id,
      });

      const { data, error } = await supabase
        .from("constraints")
        .select(
          "id, project_id, status, category, title, sheet_readiness_assessment_id"
        )
        .eq("sheet_readiness_assessment_id", assessment.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      linkedConstraint = data || null;
    } catch (error) {
      constraintSyncError = error;
    }
  }

  return {
    assessment,
    linkedConstraint,
    constraintSyncError,
  };
}
