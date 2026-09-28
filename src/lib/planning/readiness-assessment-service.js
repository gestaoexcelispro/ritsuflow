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

  const normalizedStatus = normalizeSavedStatus(savedAssessment?.status);
  let linkedConstraint = null;

  if (normalizedStatus === "constrained" && savedAssessment?.id) {
    await ensureKoskelaConstraint(supabase, {
      target_readiness_assessment_id: savedAssessment.id,
    });

    const { data, error } = await supabase
      .from("constraints")
      .select(
        "id, project_id, status, category, title, sheet_readiness_assessment_id"
      )
      .eq("sheet_readiness_assessment_id", savedAssessment.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    linkedConstraint = data || null;
  }

  return {
    assessment: {
      ...savedAssessment,
      status: normalizedStatus,
      readiness_source: savedAssessment?.readiness_source || null,
    },
    linkedConstraint,
  };
}
