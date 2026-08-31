'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '../../../../lib/supabase';

// ============================================================
// CONSTANTS
// ============================================================

const VARIANCE_REASONS = [
  { value: 'labor', label: 'Labor' },
  { value: 'material', label: 'Material' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'design_information', label: 'Design / Information' },
  { value: 'predecessor', label: 'Predecessor' },
  { value: 'workspace_access', label: 'Workspace / Access' },
  { value: 'weather', label: 'Weather' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'client_owner', label: 'Client / Owner' },
  { value: 'planning', label: 'Planning' },
  { value: 'quality_rework', label: 'Quality / Rework' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

const EMPTY_UNPLANNED_FORM = {
  activityDescription: '',
  locationName: '',
  responsibleParty: '',
  plannedQuantity: '',
  actualQuantity: '',
  unit: '',
  notes: '',
};

// ============================================================
// DATE HELPERS
// ============================================================

function dateToIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const [year, month, day] = value
    .split('-')
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
  );
}

function addDays(value, days) {
  const date = parseLocalDate(value);

  date.setDate(
    date.getDate() + days,
  );

  return dateToIso(date);
}

function getMonday(value) {
  const date = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    12,
    0,
    0,
  );

  const day = date.getDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  date.setDate(
    date.getDate() + difference,
  );

  return date;
}

function getIsoWeekInfo(value) {
  const local = parseLocalDate(value);

  const date = new Date(
    Date.UTC(
      local.getFullYear(),
      local.getMonth(),
      local.getDate(),
    ),
  );

  const day =
    date.getUTCDay() || 7;

  date.setUTCDate(
    date.getUTCDate() + 4 - day,
  );

  const yearStart =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        0,
        1,
      ),
    );

  const week = Math.ceil(
    (
      (
        date.getTime() -
        yearStart.getTime()
      ) /
        86400000 +
      1
    ) / 7,
  );

  return {
    week,
    year: date.getUTCFullYear(),
  };
}

function formatDate(value) {
  if (!value) return '—';

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    },
  ).format(
    parseLocalDate(value),
  );
}

function formatShortDate(value) {
  if (!value) return '—';

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
    },
  ).format(
    parseLocalDate(value),
  );
}

function numberOrNull(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

  const normalized =
    text.replace(',', '.');

  const parsed =
    Number(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

// ============================================================
// LABEL HELPERS
// ============================================================

function varianceLabel(value) {
  if (!value) {
    return '—';
  }

  return (
    VARIANCE_REASONS.find(
      (reason) =>
        reason.value === value,
    )?.label || value
  );
}

function planStatusLabel(status) {
  switch (status) {
    case 'draft':
      return 'Draft';

    case 'committed':
      return 'Committed';

    case 'closed':
      return 'Closed';

    case 'cancelled':
      return 'Cancelled';

    default:
      return status;
  }
}

// ============================================================
// PAGE
// ============================================================

export default function WeeklyPlanningPage() {
  const initialMonday = useMemo(
    () =>
      dateToIso(
        getMonday(new Date()),
      ),
    [],
  );

  // ----------------------------------------------------------
  // GENERAL STATE
  // ----------------------------------------------------------

  const [
    projects,
    setProjects,
  ] = useState([]);

  const [
    selectedProjectId,
    setSelectedProjectId,
  ] = useState('');

  const [
    weekStartDate,
    setWeekStartDate,
  ] = useState(
    initialMonday,
  );

  const [
    weeklyPlan,
    setWeeklyPlan,
  ] = useState(null);

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    performance,
    setPerformance,
  ] = useState(null);

  const [
    trend,
    setTrend,
  ] = useState(null);

  const [
    pareto,
    setPareto,
  ] = useState([]);

  const [
    lookaheadCandidates,
    setLookaheadCandidates,
  ] = useState([]);

  const [
    selectedCandidateIds,
    setSelectedCandidateIds,
  ] = useState([]);

  const [
    showLookaheadPanel,
    setShowLookaheadPanel,
  ] = useState(false);

  const [
    showUnplannedPanel,
    setShowUnplannedPanel,
  ] = useState(false);

  const [
    unplannedForm,
    setUnplannedForm,
  ] = useState(
    EMPTY_UNPLANNED_FORM,
  );

  const [
    missedCommitment,
    setMissedCommitment,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  // ----------------------------------------------------------
  // DERIVED DATA
  // ----------------------------------------------------------

  const selectedProject =
    projects.find(
      (project) =>
        project.id ===
        selectedProjectId,
    ) || null;

  const weekEndDate =
    addDays(
      weekStartDate,
      4,
    );

  const weekInfo =
    getIsoWeekInfo(
      weekStartDate,
    );

  const isDraft =
    weeklyPlan?.status ===
    'draft';

  const isCommitted =
    weeklyPlan?.status ===
    'committed';

  const isClosed =
    weeklyPlan?.status ===
    'closed';

  const formalItems =
    items.filter(
      (item) =>
        !item.is_unplanned_work,
    );

  const unplannedItems =
    items.filter(
      (item) =>
        item.is_unplanned_work,
    );

  // ----------------------------------------------------------
  // FEEDBACK
  // ----------------------------------------------------------

  const clearMessages =
    useCallback(() => {
      setMessage('');
      setErrorMessage('');
    }, []);

  const showError =
    useCallback((error) => {
      console.error(error);

      if (
        error &&
        typeof error === 'object' &&
        error.message
      ) {
        setErrorMessage(
          String(error.message),
        );

        return;
      }

      setErrorMessage(
        'Unexpected error.',
      );
    }, []);

  // ==========================================================
  // LOAD PROJECTS
  // ==========================================================

  const loadProjects =
    useCallback(
      async () => {
        clearMessages();

        const {
          data,
          error,
        } =
          await supabase
            .from('projects')
            .select(
              'id, name, organization_id',
            )
            .order('name', {
              ascending: true,
            });

        if (error) {
          showError(error);
          return;
        }

        setProjects(
          data || [],
        );
      },
      [
        clearMessages,
        showError,
      ],
    );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // ==========================================================
  // LOAD WEEKLY PLAN
  // ==========================================================

  const loadWeeklyPlan =
    useCallback(
      async () => {
        if (
          !selectedProjectId
        ) {
          setWeeklyPlan(null);
          setItems([]);
          setPerformance(null);
          setTrend(null);
          setPareto([]);

          return;
        }

        setLoading(true);
        clearMessages();

        try {
          const {
            data: planData,
            error: planError,
          } =
            await supabase
              .from(
                'weekly_plans',
              )
              .select('*')
              .eq(
                'project_id',
                selectedProjectId,
              )
              .eq(
                'week_number',
                weekInfo.week,
              )
              .eq(
                'year_number',
                weekInfo.year,
              )
              .neq(
                'status',
                'cancelled',
              )
              .maybeSingle();

          if (planError) {
            throw planError;
          }

          if (!planData) {
            setWeeklyPlan(null);
            setItems([]);
            setPerformance(null);
            setTrend(null);
            setPareto([]);

            return;
          }

          setWeeklyPlan(
            planData,
          );

          const [
            itemsResult,
            performanceResult,
            trendResult,
            paretoResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  'weekly_plan_items',
                )
                .select('*')
                .eq(
                  'weekly_plan_id',
                  planData.id,
                )
                .order(
                  'sequence_number',
                  {
                    ascending:
                      true,
                    nullsFirst:
                      false,
                  },
                ),

              supabase
                .from(
                  'weekly_plan_performance',
                )
                .select('*')
                .eq(
                  'weekly_plan_id',
                  planData.id,
                )
                .maybeSingle(),

              supabase
                .from(
                  'weekly_ppc_trend',
                )
                .select('*')
                .eq(
                  'weekly_plan_id',
                  planData.id,
                )
                .maybeSingle(),

              supabase
                .from(
                  'weekly_variance_pareto',
                )
                .select('*')
                .eq(
                  'weekly_plan_id',
                  planData.id,
                )
                .order(
                  'variance_count',
                  {
                    ascending:
                      false,
                  },
                ),
            ]);

          if (
            itemsResult.error
          ) {
            throw itemsResult.error;
          }

          if (
            performanceResult.error
          ) {
            throw performanceResult.error;
          }

          if (
            trendResult.error
          ) {
            throw trendResult.error;
          }

          if (
            paretoResult.error
          ) {
            throw paretoResult.error;
          }

          setItems(
            itemsResult.data ||
              [],
          );

          setPerformance(
            performanceResult.data ||
              null,
          );

          setTrend(
            trendResult.data ||
              null,
          );

          setPareto(
            paretoResult.data ||
              [],
          );
        } catch (error) {
          showError(error);
        } finally {
          setLoading(false);
        }
      },
      [
        selectedProjectId,
        weekInfo.week,
        weekInfo.year,
        clearMessages,
        showError,
      ],
    );

  useEffect(() => {
    loadWeeklyPlan();
  }, [loadWeeklyPlan]);

  // ==========================================================
  // LOAD LOOKAHEAD CANDIDATES
  // ==========================================================

  const loadLookaheadCandidates =
    useCallback(
      async () => {
        if (
          !selectedProjectId
        ) {
          setLookaheadCandidates(
            [],
          );

          return;
        }

        clearMessages();

        const {
          data,
          error,
        } =
          await supabase
            .from(
              'lookahead_work_items',
            )
            .select(`
              id,
              project_id,
              lookahead_plan_id,
              master_plan_package_id,
              package_code,
              service_code,
              service_name,
              description,
              location_name,
              location_path,
              lookahead_start_date,
              lookahead_finish_date,
              readiness_status,
              committed_to_weekly
            `)
            .eq(
              'project_id',
              selectedProjectId,
            )
            .eq(
              'readiness_status',
              'ready',
            )
            .eq(
              'committed_to_weekly',
              false,
            )
            .lte(
              'lookahead_start_date',
              weekEndDate,
            )
            .gte(
              'lookahead_finish_date',
              weekStartDate,
            )
            .order(
              'lookahead_start_date',
              {
                ascending: true,
              },
            );

        if (error) {
          showError(error);

          return;
        }

        setLookaheadCandidates(
          data || [],
        );
      },
      [
        selectedProjectId,
        weekStartDate,
        weekEndDate,
        clearMessages,
        showError,
      ],
    );

  // ==========================================================
  // CREATE WEEKLY PLAN
  // ==========================================================

  const createWeeklyPlan =
    async () => {
      if (!selectedProject) {
        setErrorMessage(
          'Select a project first.',
        );

        return null;
      }

      clearMessages();

      try {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              'weekly_plans',
            )
            .insert({
              organization_id:
                selectedProject.organization_id,

              project_id:
                selectedProject.id,

              week_start_date:
                weekStartDate,

              week_end_date:
                weekEndDate,

              week_number:
                weekInfo.week,

              year_number:
                weekInfo.year,

              name:
                `Week ${weekInfo.week} · ${weekInfo.year}`,

              status: 'draft',

              ppc_target: 85,
            })
            .select('*')
            .single();

        if (error) {
          throw error;
        }

        setWeeklyPlan(data);

        setMessage(
          'Weekly Plan created.',
        );

        return data;
      } catch (error) {
        showError(error);

        return null;
      }
    };

  // ==========================================================
  // ADD FROM LOOKAHEAD
  // ==========================================================

  const toggleCandidate = (
    id,
  ) => {
    setSelectedCandidateIds(
      (previous) =>
        previous.includes(id)
          ? previous.filter(
              (itemId) =>
                itemId !== id,
            )
          : [
              ...previous,
              id,
            ],
    );
  };

  const addSelectedFromLookahead =
    async () => {
      if (
        selectedCandidateIds.length ===
        0
      ) {
        setErrorMessage(
          'Select at least one Ready Lookahead activity.',
        );

        return;
      }

      clearMessages();
      setActionLoading(true);

      try {
        let plan =
          weeklyPlan;

        if (!plan) {
          plan =
            await createWeeklyPlan();
        }

        if (!plan) {
          return;
        }

        if (
          plan.status !== 'draft'
        ) {
          throw new Error(
            'Only Draft Weekly Plans can receive planned work from Lookahead.',
          );
        }

        const selected =
          lookaheadCandidates.filter(
            (candidate) =>
              selectedCandidateIds.includes(
                candidate.id,
              ),
          );

        const currentMaxSequence =
          items.reduce(
            (max, item) =>
              Math.max(
                max,
                item.sequence_number ||
                  0,
              ),
            0,
          );

        const rows =
          selected.map(
            (
              candidate,
              index,
            ) => ({
              weekly_plan_id:
                plan.id,

              organization_id:
                selectedProject.organization_id,

              project_id:
                selectedProject.id,

              lookahead_work_item_id:
                candidate.id,

              master_plan_package_id:
                candidate.master_plan_package_id,

              source_type:
                'lookahead',

              package_code:
                candidate.package_code,

              activity_description:
                candidate.description ||
                candidate.service_name ||
                candidate.service_code ||
                candidate.package_code ||
                'Lookahead Activity',

              location_name:
                candidate.location_name,

              location_path:
                candidate.location_path,

              planned_start_date:
                candidate.lookahead_start_date,

              planned_finish_date:
                candidate.lookahead_finish_date,

              sequence_number:
                currentMaxSequence +
                index +
                1,

              is_unplanned_work:
                false,

              commitment_status:
                'draft',

              execution_result:
                'pending',
            }),
          );

        const {
          error,
        } =
          await supabase
            .from(
              'weekly_plan_items',
            )
            .insert(rows);

        if (error) {
          throw error;
        }

        setSelectedCandidateIds(
          [],
        );

        setShowLookaheadPanel(
          false,
        );

        setMessage(
          `${rows.length} Lookahead ${
            rows.length === 1
              ? 'activity'
              : 'activities'
          } added to the Weekly Plan.`,
        );

        await loadWeeklyPlan();
        await loadLookaheadCandidates();
      } catch (error) {
        showError(error);
      } finally {
        setActionLoading(false);
      }
    };

  // ==========================================================
  // UPDATE DRAFT ITEM
  // ==========================================================

  const updateDraftItem =
    async (
      itemId,
      field,
      value,
    ) => {
      if (!isDraft) {
        return;
      }

      const dbValue =
        field ===
        'planned_quantity'
          ? numberOrNull(value)
          : String(
              value || '',
            ).trim() ||
            null;

      setItems(
        (previous) =>
          previous.map(
            (item) =>
              item.id === itemId
                ? {
                    ...item,
                    [field]:
                      dbValue,
                  }
                : item,
          ),
      );

      const {
        error,
      } =
        await supabase
          .from(
            'weekly_plan_items',
          )
          .update({
            [field]:
              dbValue,
          })
          .eq(
            'id',
            itemId,
          );

      if (error) {
        showError(error);

        await loadWeeklyPlan();
      }
    };

  // ==========================================================
  // REMOVE DRAFT ITEM
  // ==========================================================

  const deleteDraftItem =
    async (item) => {
      if (!isDraft) {
        return;
      }

      const confirmed =
        window.confirm(
          `Remove "${item.activity_description}" from this Weekly Plan?`,
        );

      if (!confirmed) {
        return;
      }

      clearMessages();

      const {
        error,
      } =
        await supabase
          .from(
            'weekly_plan_items',
          )
          .delete()
          .eq(
            'id',
            item.id,
          );

      if (error) {
        showError(error);

        return;
      }

      setMessage(
        'Activity removed from the Weekly Plan.',
      );

      await loadWeeklyPlan();
      await loadLookaheadCandidates();
    };

  // ==========================================================
  // PPC TARGET
  // ==========================================================

  const updatePpcTarget =
    async (value) => {
      if (
        !weeklyPlan ||
        !isDraft
      ) {
        return;
      }

      const target =
        Math.min(
          100,
          Math.max(
            0,
            Number(value) || 0,
          ),
        );

      setWeeklyPlan(
        (previous) => ({
          ...previous,
          ppc_target:
            target,
        }),
      );

      const {
        error,
      } =
        await supabase
          .from(
            'weekly_plans',
          )
          .update({
            ppc_target:
              target,
          })
          .eq(
            'id',
            weeklyPlan.id,
          );

      if (error) {
        showError(error);

        await loadWeeklyPlan();
      }
    };

  // ==========================================================
  // COMMIT WEEK
  // ==========================================================

  const commitWeek =
    async () => {
      if (!weeklyPlan) {
        return;
      }

      if (
        formalItems.length ===
        0
      ) {
        setErrorMessage(
          'Add at least one Ready Lookahead activity before committing the week.',
        );

        return;
      }

      const confirmed =
        window.confirm(
          'Commit this Weekly Plan? The commitment baseline will be frozen and used for PPC.',
        );

      if (!confirmed) {
        return;
      }

      clearMessages();
      setActionLoading(true);

      try {
        const {
          error,
        } =
          await supabase.rpc(
            'commit_weekly_plan',
            {
              target_weekly_plan_id:
                weeklyPlan.id,
            },
          );

        if (error) {
          throw error;
        }

        setMessage(
          'Weekly Plan committed. The PPC baseline is now frozen.',
        );

        await loadWeeklyPlan();
        await loadLookaheadCandidates();
      } catch (error) {
        showError(error);
      } finally {
        setActionLoading(false);
      }
    };

  // ==========================================================
  // MARK COMPLETED
  // ==========================================================

  const markCompleted =
    async (item) => {
      if (!isCommitted) {
        return;
      }

      clearMessages();
      setActionLoading(true);

      try {
        const {
          error,
        } =
          await supabase
            .from(
              'weekly_plan_items',
            )
            .update({
              execution_result:
                'completed',

              completed_at:
                new Date().toISOString(),

              variance_reason:
                null,

              variance_notes:
                null,
            })
            .eq(
              'id',
              item.id,
            );

        if (error) {
          throw error;
        }

        setMessage(
          `"${item.activity_description}" marked Completed.`,
        );

        await loadWeeklyPlan();
      } catch (error) {
        showError(error);
      } finally {
        setActionLoading(false);
      }
    };

  // ==========================================================
  // MISSED COMMITMENT
  // ==========================================================

  const openMissedModal =
    (item) => {
      setMissedCommitment({
        itemId: item.id,

        varianceReason:
          item.variance_reason ||
          '',

        varianceNotes:
          item.variance_notes ||
          '',

        actualQuantity:
          item.actual_quantity !==
          null &&
          item.actual_quantity !==
          undefined
            ? String(
                item.actual_quantity,
              )
            : '',
      });
    };

  const saveMissedCommitment =
    async () => {
      if (
        !missedCommitment
      ) {
        return;
      }

      if (
        !missedCommitment.varianceReason
      ) {
        setErrorMessage(
          'Reason for Variance is required for a missed commitment.',
        );

        return;
      }

      clearMessages();
      setActionLoading(true);

      try {
        const {
          error,
        } =
          await supabase
            .from(
              'weekly_plan_items',
            )
            .update({
              execution_result:
                'not_completed',

              actual_quantity:
                numberOrNull(
                  missedCommitment.actualQuantity,
                ),

              completed_at:
                null,

              variance_reason:
                missedCommitment.varianceReason,

              variance_notes:
                missedCommitment.varianceNotes.trim() ||
                null,
            })
            .eq(
              'id',
              missedCommitment.itemId,
            );

        if (error) {
          throw error;
        }

        setMissedCommitment(
          null,
        );

        setMessage(
          'Missed commitment recorded with its Reason for Variance.',
        );

        await loadWeeklyPlan();
      } catch (error) {
        showError(error);
      } finally {
        setActionLoading(false);
      }
    };

  // ==========================================================
  // ACTUAL QUANTITY
  // ==========================================================

  const updateActualQuantity =
    async (
      itemId,
      value,
    ) => {
      if (!isCommitted) {
        return;
      }

      const actual =
        numberOrNull(value);

      setItems(
        (previous) =>
          previous.map(
            (item) =>
              item.id === itemId
                ? {
                    ...item,
                    actual_quantity:
                      actual,
                  }
                : item,
          ),
      );

      const {
        error,
      } =
        await supabase
          .from(
            'weekly_plan_items',
          )
          .update({
            actual_quantity:
              actual,
          })
          .eq(
            'id',
            itemId,
          );

      if (error) {
        showError(error);

        await loadWeeklyPlan();
      }
    };

  // ==========================================================
  // UNPLANNED WORK
  // ==========================================================

  const addUnplannedWork =
    async () => {
      if (
        !weeklyPlan ||
        !isCommitted
      ) {
        return;
      }

      if (
        !unplannedForm.activityDescription.trim()
      ) {
        setErrorMessage(
          'Activity description is required.',
        );

        return;
      }

      clearMessages();
      setActionLoading(true);

      try {
        const maxSequence =
          items.reduce(
            (max, item) =>
              Math.max(
                max,
                item.sequence_number ||
                  0,
              ),
            0,
          );

        const {
          error,
        } =
          await supabase
            .from(
              'weekly_plan_items',
            )
            .insert({
              weekly_plan_id:
                weeklyPlan.id,

              organization_id:
                weeklyPlan.organization_id,

              project_id:
                weeklyPlan.project_id,

              source_type:
                'unplanned',

              activity_description:
                unplannedForm.activityDescription.trim(),

              location_name:
                unplannedForm.locationName.trim() ||
                null,

              responsible_party:
                unplannedForm.responsibleParty.trim() ||
                null,

              planned_quantity:
                numberOrNull(
                  unplannedForm.plannedQuantity,
                ),

              actual_quantity:
                numberOrNull(
                  unplannedForm.actualQuantity,
                ),

              unit:
                unplannedForm.unit.trim() ||
                null,

              notes:
                unplannedForm.notes.trim() ||
                null,

              sequence_number:
                maxSequence +
                1,

              is_unplanned_work:
                true,

              commitment_status:
                'draft',

              execution_result:
                'pending',
            });

        if (error) {
          throw error;
        }

        setUnplannedForm(
          EMPTY_UNPLANNED_FORM,
        );

        setShowUnplannedPanel(
          false,
        );

        setMessage(
          'Unplanned Work added. It is visible but excluded from PPC.',
        );

        await loadWeeklyPlan();
      } catch (error) {
        showError(error);
      } finally {
        setActionLoading(false);
      }
    };

  // ==========================================================
  // CLOSE WEEK
  // ==========================================================

  const closeWeek =
    async () => {
      if (!weeklyPlan) {
        return;
      }

      const confirmed =
        window.confirm(
          'Close this Weekly Plan? PPC will become final and the plan will become historical.',
        );

      if (!confirmed) {
        return;
      }

      clearMessages();
      setActionLoading(true);

      try {
        const {
          error,
        } =
          await supabase.rpc(
            'close_weekly_plan',
            {
              target_weekly_plan_id:
                weeklyPlan.id,
            },
          );

        if (error) {
          throw error;
        }

        setMessage(
          'Weekly Plan closed. PPC is now final.',
        );

        await loadWeeklyPlan();
      } catch (error) {
        showError(error);
      } finally {
        setActionLoading(false);
      }
    };

  // ==========================================================
  // WEEK NAVIGATION
  // ==========================================================

  const moveWeek =
    (difference) => {
      setWeekStartDate(
        addDays(
          weekStartDate,
          difference * 7,
        ),
      );

      setShowLookaheadPanel(
        false,
      );

      setShowUnplannedPanel(
        false,
      );

      setSelectedCandidateIds(
        [],
      );

      clearMessages();
    };

  const handleWeekDateChange =
    (value) => {
      if (!value) {
        return;
      }

      const monday =
        dateToIso(
          getMonday(
            parseLocalDate(value),
          ),
        );

      setWeekStartDate(
        monday,
      );

      setShowLookaheadPanel(
        false,
      );

      setShowUnplannedPanel(
        false,
      );

      setSelectedCandidateIds(
        [],
      );

      clearMessages();
    };

  // ==========================================================
  // DISPLAY VALUES
  // ==========================================================

  const ppc =
    performance?.ppc_percent ??
    null;

  const ppcTarget =
    weeklyPlan?.ppc_target ??
    85;

  const ppcTargetMet =
    performance?.ppc_target_met ??
    null;

  const canClose =
    isCommitted &&
    (
      performance?.total_commitments ||
      0
    ) > 0 &&
    (
      performance?.pending_commitments ||
      0
    ) === 0;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      style={{
        minHeight:
          'calc(100vh - 100px)',
        padding: '24px',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily:
          'Inter, Arial, sans-serif',
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems:
            'flex-start',
          gap: '20px',
          flexWrap: 'wrap',
          marginBottom:
            '22px',
        }}
      >
        <div>
          <div
            style={{
              fontSize:
                '0.75rem',
              fontWeight: 800,
              letterSpacing:
                '0.08em',
              color: '#64748b',
              textTransform:
                'uppercase',
              marginBottom:
                '6px',
            }}
          >
            Planning
          </div>

          <h1
            style={{
              margin: 0,
              fontSize:
                '1.8rem',
              color: '#0f2745',
            }}
          >
            Weekly Planning
          </h1>

          <p
            style={{
              margin:
                '7px 0 0 0',
              color: '#64748b',
              fontSize:
                '0.9rem',
            }}
          >
            Convert Ready Lookahead work into reliable weekly commitments and measure PPC.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            alignItems:
              'center',
          }}
        >
          <select
            value={
              selectedProjectId
            }
            onChange={(
              event,
            ) =>
              setSelectedProjectId(
                event.target.value,
              )
            }
            style={styles.select}
          >
            <option value="">
              Select Project
            </option>

            {projects.map(
              (project) => (
                <option
                  key={project.id}
                  value={project.id}
                >
                  {project.name}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            onClick={
              loadWeeklyPlan
            }
            disabled={
              !selectedProjectId ||
              loading
            }
            style={
              styles.secondaryButton
            }
          >
            Refresh
          </button>
        </div>
      </div>

      {/* FEEDBACK */}

      {message && (
        <div
          style={
            styles.successBox
          }
        >
          {message}
        </div>
      )}

      {errorMessage && (
        <div
          style={
            styles.errorBox
          }
        >
          {errorMessage}
        </div>
      )}

      {!selectedProjectId ? (
        <div
          style={
            styles.emptyState
          }
        >
          <div
            style={{
              fontSize:
                '2.5rem',
              marginBottom:
                '10px',
            }}
          >
            📅
          </div>

          <h2
            style={{
              margin:
                '0 0 8px 0',
              color: '#0f2745',
            }}
          >
            Select a Project
          </h2>

          <p
            style={{
              margin: 0,
              color: '#64748b',
            }}
          >
            Choose a project to create, commit and evaluate its Weekly Plan.
          </p>
        </div>
      ) : (
        <>
          {/* WEEK CONTROL */}

          <div
            style={
              styles.card
            }
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                gap: '16px',
                flexWrap:
                  'wrap',
                alignItems:
                  'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems:
                    'center',
                  flexWrap:
                    'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    moveWeek(-1)
                  }
                  style={
                    styles.iconButton
                  }
                >
                  ←
                </button>

                <div>
                  <div
                    style={{
                      fontWeight:
                        800,
                      color:
                        '#0f2745',
                    }}
                  >
                    Week{' '}
                    {weekInfo.week}{' '}
                    ·{' '}
                    {weekInfo.year}
                  </div>

                  <div
                    style={{
                      fontSize:
                        '0.82rem',
                      color:
                        '#64748b',
                      marginTop:
                        '3px',
                    }}
                  >
                    {formatDate(
                      weekStartDate,
                    )}{' '}
                    –{' '}
                    {formatDate(
                      weekEndDate,
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    moveWeek(1)
                  }
                  style={
                    styles.iconButton
                  }
                >
                  →
                </button>

                <input
                  type="date"
                  value={
                    weekStartDate
                  }
                  onChange={(
                    event,
                  ) =>
                    handleWeekDateChange(
                      event.target.value,
                    )
                  }
                  style={
                    styles.input
                  }
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap:
                    'wrap',
                  alignItems:
                    'center',
                }}
              >
                {weeklyPlan ? (
                  <span
                    style={{
                      ...styles.statusBadge,

                      ...(isDraft
                        ? styles.draftBadge
                        : isCommitted
                          ? styles.committedBadge
                          : isClosed
                            ? styles.closedBadge
                            : styles.cancelledBadge),
                    }}
                  >
                    {planStatusLabel(
                      weeklyPlan.status,
                    )}
                  </span>
                ) : (
                  <span
                    style={{
                      ...styles.statusBadge,
                      background:
                        '#f1f5f9',
                      color:
                        '#64748b',
                    }}
                  >
                    No Weekly Plan
                  </span>
                )}

                {!weeklyPlan && (
                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={async () => {
                      setActionLoading(
                        true,
                      );

                      await createWeeklyPlan();

                      setActionLoading(
                        false,
                      );
                    }}
                    style={
                      styles.primaryButton
                    }
                  >
                    Create Weekly Plan
                  </button>
                )}

                {isDraft && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        setShowLookaheadPanel(
                          true,
                        );

                        await loadLookaheadCandidates();
                      }}
                      style={
                        styles.primaryButton
                      }
                    >
                      + Add from Lookahead
                    </button>

                    <button
                      type="button"
                      disabled={
                        formalItems.length ===
                          0 ||
                        actionLoading
                      }
                      onClick={
                        commitWeek
                      }
                      style={
                        styles.commitButton
                      }
                    >
                      Commit Week
                    </button>
                  </>
                )}

                {isCommitted && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setShowUnplannedPanel(
                          true,
                        )
                      }
                      style={
                        styles.secondaryButton
                      }
                    >
                      + Add Unplanned Work
                    </button>

                    <button
                      type="button"
                      disabled={
                        !canClose ||
                        actionLoading
                      }
                      onClick={
                        closeWeek
                      }
                      style={
                        styles.closeButton
                      }
                    >
                      Close Week
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* METRICS */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginBottom:
                '18px',
            }}
          >
            <MetricCard
              label="PPC"
              value={
                ppc === null
                  ? '—'
                  : `${Number(
                      ppc,
                    ).toFixed(1)}%`
              }
              accent={
                ppcTargetMet ===
                true
                  ? 'success'
                  : ppcTargetMet ===
                      false
                    ? 'danger'
                    : 'neutral'
              }
              footer={
                isClosed
                  ? 'Final PPC'
                  : isCommitted
                    ? 'Live PPC'
                    : 'Available after commitment'
              }
            />

            <MetricCard
              label="Committed"
              value={String(
                performance?.total_commitments ||
                  0,
              )}
            />

            <MetricCard
              label="Completed"
              value={String(
                performance?.completed_commitments ||
                  0,
              )}
              accent="success"
            />

            <MetricCard
              label="Missed"
              value={String(
                performance?.missed_commitments ||
                  0,
              )}
              accent="danger"
            />

            <MetricCard
              label="Pending"
              value={String(
                performance?.pending_commitments ||
                  0,
              )}
            />

            <MetricCard
              label="Unplanned"
              value={String(
                performance?.unplanned_work_items ??
                  unplannedItems.length,
              )}
              footer="Excluded from PPC"
            />
          </div>

          {/* SECONDARY METRICS */}

          {weeklyPlan && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginBottom:
                  '18px',
              }}
            >
              <div
                style={
                  styles.card
                }
              >
                <div
                  style={
                    styles.smallLabel
                  }
                >
                  PPC Target
                </div>

                {isDraft ? (
                  <div
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: '8px',
                      marginTop:
                        '8px',
                    }}
                  >
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        weeklyPlan.ppc_target
                      }
                      onChange={(
                        event,
                      ) =>
                        updatePpcTarget(
                          event.target.value,
                        )
                      }
                      style={{
                        ...styles.input,
                        width:
                          '85px',
                      }}
                    />

                    <strong>
                      %
                    </strong>
                  </div>
                ) : (
                  <div
                    style={
                      styles.secondaryMetricValue
                    }
                  >
                    {Number(
                      ppcTarget,
                    ).toFixed(1)}
                    %
                  </div>
                )}
              </div>

              <div
                style={
                  styles.card
                }
              >
                <div
                  style={
                    styles.smallLabel
                  }
                >
                  Previous Week PPC
                </div>

                <div
                  style={
                    styles.secondaryMetricValue
                  }
                >
                  {trend?.previous_week_ppc ===
                    null ||
                  trend?.previous_week_ppc ===
                    undefined
                    ? '—'
                    : `${Number(
                        trend.previous_week_ppc,
                      ).toFixed(
                        1,
                      )}%`}
                </div>
              </div>

              <div
                style={
                  styles.card
                }
              >
                <div
                  style={
                    styles.smallLabel
                  }
                >
                  Change vs Previous
                </div>

                <div
                  style={
                    styles.secondaryMetricValue
                  }
                >
                  {trend?.ppc_change_vs_previous_week ===
                    null ||
                  trend?.ppc_change_vs_previous_week ===
                    undefined
                    ? '—'
                    : `${Number(
                        trend.ppc_change_vs_previous_week,
                      ) >= 0
                        ? '+'
                        : ''}${Number(
                        trend.ppc_change_vs_previous_week,
                      ).toFixed(
                        1,
                      )} pp`}
                </div>
              </div>

              <div
                style={
                  styles.card
                }
              >
                <div
                  style={
                    styles.smallLabel
                  }
                >
                  Rolling 4-Week PPC
                </div>

                <div
                  style={
                    styles.secondaryMetricValue
                  }
                >
                  {trend?.rolling_4_week_ppc ===
                    null ||
                  trend?.rolling_4_week_ppc ===
                    undefined
                    ? '—'
                    : `${Number(
                        trend.rolling_4_week_ppc,
                      ).toFixed(
                        1,
                      )}%`}
                </div>
              </div>
            </div>
          )}

          {/* NO PLAN */}

          {!weeklyPlan &&
            !loading && (
              <div
                style={
                  styles.emptyState
                }
              >
                <h2
                  style={{
                    margin:
                      '0 0 8px 0',
                    color:
                      '#0f2745',
                  }}
                >
                  No Weekly Plan for Week{' '}
                  {weekInfo.week}
                </h2>

                <p
                  style={{
                    margin:
                      '0 0 18px 0',
                    color:
                      '#64748b',
                  }}
                >
                  Create the plan, then add activities that have passed Lookahead readiness.
                </p>

                <button
                  type="button"
                  disabled={
                    actionLoading
                  }
                  onClick={async () => {
                    setActionLoading(
                      true,
                    );

                    await createWeeklyPlan();

                    setActionLoading(
                      false,
                    );
                  }}
                  style={
                    styles.primaryButton
                  }
                >
                  Create Weekly Plan
                </button>
              </div>
            )}

          {/* WEEKLY ITEMS */}

          {weeklyPlan && (
            <div
              style={
                styles.card
              }
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'center',
                  gap: '12px',
                  flexWrap:
                    'wrap',
                  marginBottom:
                    '14px',
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize:
                        '1.05rem',
                      color:
                        '#0f2745',
                    }}
                  >
                    Weekly Commitments
                  </h2>

                  <div
                    style={{
                      color:
                        '#64748b',
                      fontSize:
                        '0.82rem',
                      marginTop:
                        '4px',
                    }}
                  >
                    Ready work becomes a commitment only when the week is committed.
                  </div>
                </div>

                <div
                  style={{
                    fontSize:
                      '0.8rem',
                    color:
                      '#64748b',
                  }}
                >
                  {items.length}{' '}
                  {items.length === 1
                    ? 'item'
                    : 'items'}
                </div>
              </div>

              {items.length ===
              0 ? (
                <div
                  style={
                    styles.tableEmpty
                  }
                >
                  No activities have been added to this Weekly Plan.
                </div>
              ) : (
                <div
                  style={{
                    overflowX:
                      'auto',
                    border:
                      '1px solid #e2e8f0',
                    borderRadius:
                      '8px',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      minWidth:
                        '1450px',
                      borderCollapse:
                        'collapse',
                      background:
                        '#ffffff',
                    }}
                  >
                    <thead>
                      <tr>
                        <TableHeader>
                          Type
                        </TableHeader>

                        <TableHeader>
                          Package
                        </TableHeader>

                        <TableHeader>
                          Activity
                        </TableHeader>

                        <TableHeader>
                          Location
                        </TableHeader>

                        <TableHeader>
                          Dates
                        </TableHeader>

                        <TableHeader>
                          Responsible
                        </TableHeader>

                        <TableHeader>
                          Planned Qty.
                        </TableHeader>

                        <TableHeader>
                          Actual Qty.
                        </TableHeader>

                        <TableHeader>
                          Unit
                        </TableHeader>

                        <TableHeader>
                          Commitment
                        </TableHeader>

                        <TableHeader>
                          Result
                        </TableHeader>

                        <TableHeader>
                          Variance
                        </TableHeader>

                        <TableHeader>
                          Actions
                        </TableHeader>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map(
                        (item) => {
                          const quantityAchievement =
                            item.planned_quantity &&
                            item.actual_quantity !==
                              null &&
                            item.actual_quantity !==
                              undefined
                              ? (
                                  Number(
                                    item.actual_quantity,
                                  ) /
                                  Number(
                                    item.planned_quantity,
                                  )
                                ) *
                                100
                              : null;

                          return (
                            <tr
                              key={
                                item.id
                              }
                              style={{
                                background:
                                  item.is_unplanned_work
                                    ? '#fffbeb'
                                    : item.execution_result ===
                                        'completed'
                                      ? '#f0fdf4'
                                      : item.execution_result ===
                                          'not_completed'
                                        ? '#fef2f2'
                                        : '#ffffff',

                                borderBottom:
                                  '1px solid #e2e8f0',
                              }}
                            >
                              <TableCell>
                                <span
                                  style={{
                                    ...styles.miniBadge,

                                    background:
                                      item.is_unplanned_work
                                        ? '#fef3c7'
                                        : '#e0f2fe',

                                    color:
                                      item.is_unplanned_work
                                        ? '#92400e'
                                        : '#075985',
                                  }}
                                >
                                  {item.is_unplanned_work
                                    ? 'Unplanned'
                                    : 'Lookahead'}
                                </span>
                              </TableCell>

                              <TableCell>
                                <strong>
                                  {item.package_code ||
                                    '—'}
                                </strong>
                              </TableCell>

                              <TableCell>
                                <div
                                  style={{
                                    fontWeight:
                                      700,
                                    color:
                                      '#0f2745',
                                    maxWidth:
                                      '320px',
                                    whiteSpace:
                                      'normal',
                                  }}
                                >
                                  {item.activity_description}
                                </div>
                              </TableCell>

                              <TableCell>
                                <div
                                  style={{
                                    maxWidth:
                                      '220px',
                                    whiteSpace:
                                      'normal',
                                  }}
                                >
                                  {item.location_path ||
                                    item.location_name ||
                                    '—'}
                                </div>
                              </TableCell>

                              <TableCell>
                                <div>
                                  {formatShortDate(
                                    item.planned_start_date,
                                  )}
                                </div>

                                <div
                                  style={{
                                    fontSize:
                                      '0.75rem',
                                    color:
                                      '#64748b',
                                    marginTop:
                                      '2px',
                                  }}
                                >
                                  to{' '}
                                  {formatShortDate(
                                    item.planned_finish_date,
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                {isDraft ? (
                                  <input
                                    defaultValue={
                                      item.responsible_party ||
                                      ''
                                    }
                                    onBlur={(
                                      event,
                                    ) =>
                                      updateDraftItem(
                                        item.id,
                                        'responsible_party',
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Responsible"
                                    style={
                                      styles.tableInput
                                    }
                                  />
                                ) : (
                                  item.responsible_party ||
                                  '—'
                                )}
                              </TableCell>

                              <TableCell>
                                {isDraft ? (
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    defaultValue={
                                      item.planned_quantity ??
                                      ''
                                    }
                                    onBlur={(
                                      event,
                                    ) =>
                                      updateDraftItem(
                                        item.id,
                                        'planned_quantity',
                                        event.target.value,
                                      )
                                    }
                                    style={
                                      styles.tableNumberInput
                                    }
                                  />
                                ) : (
                                  item.planned_quantity ??
                                  '—'
                                )}
                              </TableCell>

                              <TableCell>
                                {isCommitted ? (
                                  <div>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={
                                        item.actual_quantity ??
                                        ''
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        setItems(
                                          (
                                            previous,
                                          ) =>
                                            previous.map(
                                              (
                                                current,
                                              ) =>
                                                current.id ===
                                                item.id
                                                  ? {
                                                      ...current,
                                                      actual_quantity:
                                                        numberOrNull(
                                                          event.target.value,
                                                        ),
                                                    }
                                                  : current,
                                            ),
                                        )
                                      }
                                      onBlur={(
                                        event,
                                      ) =>
                                        updateActualQuantity(
                                          item.id,
                                          event.target.value,
                                        )
                                      }
                                      style={
                                        styles.tableNumberInput
                                      }
                                    />

                                    {quantityAchievement !==
                                      null && (
                                      <div
                                        style={{
                                          fontSize:
                                            '0.72rem',
                                          color:
                                            '#64748b',
                                          marginTop:
                                            '4px',
                                        }}
                                      >
                                        {quantityAchievement.toFixed(
                                          1,
                                        )}
                                        %
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  item.actual_quantity ??
                                  '—'
                                )}
                              </TableCell>

                              <TableCell>
                                {isDraft ? (
                                  <input
                                    defaultValue={
                                      item.unit ||
                                      ''
                                    }
                                    onBlur={(
                                      event,
                                    ) =>
                                      updateDraftItem(
                                        item.id,
                                        'unit',
                                        event.target.value,
                                      )
                                    }
                                    placeholder="m²"
                                    style={{
                                      ...styles.tableInput,
                                      width:
                                        '70px',
                                    }}
                                  />
                                ) : (
                                  item.unit ||
                                  '—'
                                )}
                              </TableCell>

                              <TableCell>
                                <span
                                  style={{
                                    ...styles.miniBadge,

                                    background:
                                      item.commitment_status ===
                                      'committed'
                                        ? '#dbeafe'
                                        : '#f1f5f9',

                                    color:
                                      item.commitment_status ===
                                      'committed'
                                        ? '#1d4ed8'
                                        : '#475569',
                                  }}
                                >
                                  {item.commitment_status}
                                </span>
                              </TableCell>

                              <TableCell>
                                <ExecutionBadge
                                  result={
                                    item.execution_result
                                  }
                                />
                              </TableCell>

                              <TableCell>
                                <div
                                  style={{
                                    maxWidth:
                                      '190px',
                                    whiteSpace:
                                      'normal',
                                  }}
                                >
                                  {varianceLabel(
                                    item.variance_reason,
                                  )}

                                  {item.variance_notes && (
                                    <div
                                      style={{
                                        marginTop:
                                          '4px',
                                        fontSize:
                                          '0.75rem',
                                        color:
                                          '#64748b',
                                      }}
                                    >
                                      {item.variance_notes}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <div
                                  style={{
                                    display:
                                      'flex',
                                    gap: '6px',
                                    flexWrap:
                                      'wrap',
                                  }}
                                >
                                  {isDraft &&
                                    !item.is_unplanned_work && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteDraftItem(
                                            item,
                                          )
                                        }
                                        style={
                                          styles.smallDangerButton
                                        }
                                      >
                                        Remove
                                      </button>
                                    )}

                                  {isCommitted &&
                                    !item.is_unplanned_work &&
                                    item.execution_result ===
                                      'pending' && (
                                      <>
                                        <button
                                          type="button"
                                          disabled={
                                            actionLoading
                                          }
                                          onClick={() =>
                                            markCompleted(
                                              item,
                                            )
                                          }
                                          style={
                                            styles.smallSuccessButton
                                          }
                                        >
                                          Completed
                                        </button>

                                        <button
                                          type="button"
                                          disabled={
                                            actionLoading
                                          }
                                          onClick={() =>
                                            openMissedModal(
                                              item,
                                            )
                                          }
                                          style={
                                            styles.smallDangerButton
                                          }
                                        >
                                          Missed
                                        </button>
                                      </>
                                    )}

                                  {!isDraft &&
                                    !isCommitted && (
                                      <span
                                        style={{
                                          color:
                                            '#94a3b8',
                                          fontSize:
                                            '0.78rem',
                                        }}
                                      >
                                        Locked
                                      </span>
                                    )}
                                </div>
                              </TableCell>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VARIANCE PARETO */}

          {weeklyPlan &&
            pareto.length > 0 && (
              <div
                style={{
                  ...styles.card,
                  marginTop:
                    '18px',
                }}
              >
                <h2
                  style={{
                    margin:
                      '0 0 5px 0',
                    fontSize:
                      '1.05rem',
                    color:
                      '#0f2745',
                  }}
                >
                  Reasons for Variance
                </h2>

                <p
                  style={{
                    margin:
                      '0 0 15px 0',
                    fontSize:
                      '0.82rem',
                    color:
                      '#64748b',
                  }}
                >
                  Pareto analysis of missed formal commitments.
                </p>

                <div
                  style={{
                    display:
                      'grid',
                    gap: '9px',
                  }}
                >
                  {pareto.map(
                    (row) => (
                      <div
                        key={
                          row.variance_reason
                        }
                        style={{
                          display:
                            'grid',
                          gridTemplateColumns:
                            'minmax(180px, 1fr) 90px 90px 100px',
                          gap: '12px',
                          alignItems:
                            'center',
                          padding:
                            '10px 12px',
                          border:
                            '1px solid #e2e8f0',
                          borderRadius:
                            '7px',
                        }}
                      >
                        <strong>
                          {varianceLabel(
                            row.variance_reason,
                          )}
                        </strong>

                        <span>
                          {row.variance_count}{' '}
                          occurrences
                        </span>

                        <span>
                          {Number(
                            row.variance_percent,
                          ).toFixed(
                            1,
                          )}
                          %
                        </span>

                        <span>
                          {Number(
                            row.cumulative_variance_percent,
                          ).toFixed(
                            1,
                          )}
                          % cumulative
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

          {/* LOOKAHEAD MODAL */}

          {showLookaheadPanel &&
            isDraft && (
              <ModalOverlay>
                <div
                  style={
                    styles.modalLarge
                  }
                >
                  <div
                    style={
                      styles.modalHeader
                    }
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          color:
                            '#0f2745',
                        }}
                      >
                        Add from Lookahead
                      </h2>

                      <p
                        style={{
                          margin:
                            '5px 0 0 0',
                          color:
                            '#64748b',
                          fontSize:
                            '0.85rem',
                        }}
                      >
                        Only Ready activities within the selected week are eligible.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setShowLookaheadPanel(
                          false,
                        )
                      }
                      style={
                        styles.closeModalButton
                      }
                    >
                      ×
                    </button>
                  </div>

                  {lookaheadCandidates.length ===
                  0 ? (
                    <div
                      style={
                        styles.tableEmpty
                      }
                    >
                      No Ready Lookahead activities are available for this week.
                    </div>
                  ) : (
                    <div
                      style={{
                        display:
                          'grid',
                        gap: '8px',
                        maxHeight:
                          '460px',
                        overflowY:
                          'auto',
                      }}
                    >
                      {lookaheadCandidates.map(
                        (
                          candidate,
                        ) => {
                          const selected =
                            selectedCandidateIds.includes(
                              candidate.id,
                            );

                          return (
                            <label
                              key={
                                candidate.id
                              }
                              style={{
                                display:
                                  'grid',
                                gridTemplateColumns:
                                  '26px 90px minmax(240px, 1fr) 220px 150px',
                                gap: '10px',
                                alignItems:
                                  'center',
                                padding:
                                  '12px',
                                border:
                                  selected
                                    ? '1px solid #3b82f6'
                                    : '1px solid #e2e8f0',
                                borderRadius:
                                  '8px',
                                background:
                                  selected
                                    ? '#eff6ff'
                                    : '#ffffff',
                                cursor:
                                  'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  selected
                                }
                                onChange={() =>
                                  toggleCandidate(
                                    candidate.id,
                                  )
                                }
                              />

                              <strong>
                                {candidate.package_code ||
                                  candidate.service_code ||
                                  '—'}
                              </strong>

                              <div>
                                <div
                                  style={{
                                    fontWeight:
                                      700,
                                  }}
                                >
                                  {candidate.description ||
                                    candidate.service_name ||
                                    'Lookahead Activity'}
                                </div>

                                <div
                                  style={{
                                    fontSize:
                                      '0.75rem',
                                    color:
                                      '#16a34a',
                                    marginTop:
                                      '3px',
                                  }}
                                >
                                  Ready
                                </div>
                              </div>

                              <div
                                style={{
                                  fontSize:
                                    '0.82rem',
                                  color:
                                    '#475569',
                                }}
                              >
                                {candidate.location_path ||
                                  candidate.location_name ||
                                  '—'}
                              </div>

                              <div
                                style={{
                                  fontSize:
                                    '0.8rem',
                                  color:
                                    '#64748b',
                                }}
                              >
                                {formatShortDate(
                                  candidate.lookahead_start_date,
                                )}{' '}
                                –{' '}
                                {formatShortDate(
                                  candidate.lookahead_finish_date,
                                )}
                              </div>
                            </label>
                          );
                        },
                      )}
                    </div>
                  )}

                  <div
                    style={
                      styles.modalFooter
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setShowLookaheadPanel(
                          false,
                        )
                      }
                      style={
                        styles.secondaryButton
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={
                        selectedCandidateIds.length ===
                          0 ||
                        actionLoading
                      }
                      onClick={
                        addSelectedFromLookahead
                      }
                      style={
                        styles.primaryButton
                      }
                    >
                      Add Selected (
                      {selectedCandidateIds.length})
                    </button>
                  </div>
                </div>
              </ModalOverlay>
            )}

          {/* UNPLANNED WORK MODAL */}

          {showUnplannedPanel &&
            isCommitted && (
              <ModalOverlay>
                <div
                  style={
                    styles.modal
                  }
                >
                  <div
                    style={
                      styles.modalHeader
                    }
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          color:
                            '#0f2745',
                        }}
                      >
                        Add Unplanned Work
                      </h2>

                      <p
                        style={{
                          margin:
                            '5px 0 0 0',
                          color:
                            '#64748b',
                          fontSize:
                            '0.85rem',
                        }}
                      >
                        This work occurred after the weekly commitment freeze and will not affect PPC.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setShowUnplannedPanel(
                          false,
                        )
                      }
                      style={
                        styles.closeModalButton
                      }
                    >
                      ×
                    </button>
                  </div>

                  <FormField label="Activity">
                    <input
                      value={
                        unplannedForm.activityDescription
                      }
                      onChange={(
                        event,
                      ) =>
                        setUnplannedForm(
                          (
                            previous,
                          ) => ({
                            ...previous,
                            activityDescription:
                              event.target.value,
                          }),
                        )
                      }
                      style={
                        styles.input
                      }
                      placeholder="Describe the unplanned activity"
                    />
                  </FormField>

                  <FormField label="Location">
                    <input
                      value={
                        unplannedForm.locationName
                      }
                      onChange={(
                        event,
                      ) =>
                        setUnplannedForm(
                          (
                            previous,
                          ) => ({
                            ...previous,
                            locationName:
                              event.target.value,
                          }),
                        )
                      }
                      style={
                        styles.input
                      }
                    />
                  </FormField>

                  <FormField label="Responsible">
                    <input
                      value={
                        unplannedForm.responsibleParty
                      }
                      onChange={(
                        event,
                      ) =>
                        setUnplannedForm(
                          (
                            previous,
                          ) => ({
                            ...previous,
                            responsibleParty:
                              event.target.value,
                          }),
                        )
                      }
                      style={
                        styles.input
                      }
                    />
                  </FormField>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        '1fr 1fr 1fr',
                      gap: '10px',
                    }}
                  >
                    <FormField label="Planned Qty.">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={
                          unplannedForm.plannedQuantity
                        }
                        onChange={(
                          event,
                        ) =>
                          setUnplannedForm(
                            (
                              previous,
                            ) => ({
                              ...previous,
                              plannedQuantity:
                                event.target.value,
                            }),
                          )
                        }
                        style={
                          styles.input
                        }
                      />
                    </FormField>

                    <FormField label="Actual Qty.">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={
                          unplannedForm.actualQuantity
                        }
                        onChange={(
                          event,
                        ) =>
                          setUnplannedForm(
                            (
                              previous,
                            ) => ({
                              ...previous,
                              actualQuantity:
                                event.target.value,
                            }),
                          )
                        }
                        style={
                          styles.input
                        }
                      />
                    </FormField>

                    <FormField label="Unit">
                      <input
                        value={
                          unplannedForm.unit
                        }
                        onChange={(
                          event,
                        ) =>
                          setUnplannedForm(
                            (
                              previous,
                            ) => ({
                              ...previous,
                              unit:
                                event.target.value,
                            }),
                          )
                        }
                        style={
                          styles.input
                        }
                        placeholder="m²"
                      />
                    </FormField>
                  </div>

                  <FormField label="Notes">
                    <textarea
                      rows="3"
                      value={
                        unplannedForm.notes
                      }
                      onChange={(
                        event,
                      ) =>
                        setUnplannedForm(
                          (
                            previous,
                          ) => ({
                            ...previous,
                            notes:
                              event.target.value,
                          }),
                        )
                      }
                      style={{
                        ...styles.input,
                        resize:
                          'vertical',
                      }}
                    />
                  </FormField>

                  <div
                    style={
                      styles.modalFooter
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setShowUnplannedPanel(
                          false,
                        )
                      }
                      style={
                        styles.secondaryButton
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={
                        actionLoading
                      }
                      onClick={
                        addUnplannedWork
                      }
                      style={
                        styles.primaryButton
                      }
                    >
                      Add Unplanned Work
                    </button>
                  </div>
                </div>
              </ModalOverlay>
            )}

          {/* MISSED COMMITMENT MODAL */}

          {missedCommitment && (
            <ModalOverlay>
              <div
                style={
                  styles.modal
                }
              >
                <div
                  style={
                    styles.modalHeader
                  }
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        color:
                          '#0f2745',
                      }}
                    >
                      Missed Commitment
                    </h2>

                    <p
                      style={{
                        margin:
                          '5px 0 0 0',
                        color:
                          '#64748b',
                        fontSize:
                          '0.85rem',
                      }}
                    >
                      Capture why the commitment was not completed.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setMissedCommitment(
                        null,
                      )
                    }
                    style={
                      styles.closeModalButton
                    }
                  >
                    ×
                  </button>
                </div>

                <FormField label="Reason for Variance">
                  <select
                    value={
                      missedCommitment.varianceReason
                    }
                    onChange={(
                      event,
                    ) =>
                      setMissedCommitment(
                        {
                          ...missedCommitment,
                          varianceReason:
                            event.target.value,
                        },
                      )
                    }
                    style={
                      styles.select
                    }
                  >
                    <option value="">
                      Select reason
                    </option>

                    {VARIANCE_REASONS.map(
                      (reason) => (
                        <option
                          key={
                            reason.value
                          }
                          value={
                            reason.value
                          }
                        >
                          {reason.label}
                        </option>
                      ),
                    )}
                  </select>
                </FormField>

                <FormField label="Actual Quantity">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={
                      missedCommitment.actualQuantity
                    }
                    onChange={(
                      event,
                    ) =>
                      setMissedCommitment(
                        {
                          ...missedCommitment,
                          actualQuantity:
                            event.target.value,
                        },
                      )
                    }
                    style={
                      styles.input
                    }
                  />
                </FormField>

                <FormField label="Variance Notes">
                  <textarea
                    rows="4"
                    value={
                      missedCommitment.varianceNotes
                    }
                    onChange={(
                      event,
                    ) =>
                      setMissedCommitment(
                        {
                          ...missedCommitment,
                          varianceNotes:
                            event.target.value,
                        },
                      )
                    }
                    style={{
                      ...styles.input,
                      resize:
                        'vertical',
                    }}
                    placeholder="Describe what prevented completion."
                  />
                </FormField>

                <div
                  style={
                    styles.modalFooter
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setMissedCommitment(
                        null,
                      )
                    }
                    style={
                      styles.secondaryButton
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={
                      saveMissedCommitment
                    }
                    style={
                      styles.dangerButton
                    }
                  >
                    Record Missed Commitment
                  </button>
                </div>
              </div>
            </ModalOverlay>
          )}
        </>
      )}

      {loading && (
        <div
          style={{
            marginTop:
              '12px',
            color:
              '#64748b',
            fontSize:
              '0.85rem',
          }}
        >
          Loading Weekly Planning...
        </div>
      )}
    </div>
  );
}

// ============================================================
// SMALL COMPONENTS
// ============================================================

function MetricCard({
  label,
  value,
  footer,
  accent = 'neutral',
}) {
  const accentStyle =
    accent === 'success'
      ? {
          background:
            '#f0fdf4',
          borderColor:
            '#bbf7d0',
          color:
            '#166534',
        }
      : accent === 'danger'
        ? {
            background:
              '#fef2f2',
            borderColor:
              '#fecaca',
            color:
              '#991b1b',
          }
        : {
            background:
              '#ffffff',
            borderColor:
              '#e2e8f0',
            color:
              '#0f2745',
          };

  return (
    <div
      style={{
        border: `1px solid ${accentStyle.borderColor}`,
        background:
          accentStyle.background,
        borderRadius:
          '10px',
        padding:
          '15px',
      }}
    >
      <div
        style={
          styles.smallLabel
        }
      >
        {label}
      </div>

      <div
        style={{
          fontSize:
            '1.65rem',
          fontWeight:
            900,
          color:
            accentStyle.color,
          marginTop:
            '7px',
        }}
      >
        {value}
      </div>

      {footer && (
        <div
          style={{
            fontSize:
              '0.72rem',
            color:
              '#64748b',
            marginTop:
              '5px',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

function ExecutionBadge({
  result,
}) {
  let background =
    '#f1f5f9';

  let color =
    '#475569';

  let label =
    'Pending';

  if (
    result === 'completed'
  ) {
    background =
      '#dcfce7';

    color =
      '#166534';

    label =
      'Completed';
  }

  if (
    result ===
    'not_completed'
  ) {
    background =
      '#fee2e2';

    color =
      '#991b1b';

    label =
      'Missed';
  }

  if (
    result ===
    'not_applicable'
  ) {
    background =
      '#e2e8f0';

    color =
      '#475569';

    label =
      'N/A';
  }

  return (
    <span
      style={{
        ...styles.miniBadge,
        background,
        color,
      }}
    >
      {label}
    </span>
  );
}

function TableHeader({
  children,
}) {
  return (
    <th
      style={{
        background:
          '#0f2745',
        color:
          '#ffffff',
        padding:
          '11px 10px',
        textAlign:
          'left',
        fontSize:
          '0.75rem',
        letterSpacing:
          '0.02em',
        borderRight:
          '1px solid #27476d',
        position:
          'sticky',
        top: 0,
        zIndex: 2,
      }}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
}) {
  return (
    <td
      style={{
        padding:
          '10px',
        fontSize:
          '0.82rem',
        borderRight:
          '1px solid #e2e8f0',
        verticalAlign:
          'middle',
      }}
    >
      {children}
    </td>
  );
}

function ModalOverlay({
  children,
}) {
  return (
    <div
      style={{
        position:
          'fixed',
        inset: 0,
        background:
          'rgba(15, 23, 42, 0.50)',
        display:
          'flex',
        alignItems:
          'center',
        justifyContent:
          'center',
        padding:
          '20px',
        zIndex:
          9999,
      }}
    >
      {children}
    </div>
  );
}

function FormField({
  label,
  children,
}) {
  return (
    <label
      style={{
        display:
          'grid',
        gap:
          '6px',
        marginBottom:
          '13px',
      }}
    >
      <span
        style={{
          fontSize:
            '0.8rem',
          fontWeight:
            800,
          color:
            '#334155',
        }}
      >
        {label}
      </span>

      {children}
    </label>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = {
  card: {
    background:
      '#ffffff',

    border:
      '1px solid #e2e8f0',

    borderRadius:
      '10px',

    padding:
      '16px',

    boxShadow:
      '0 1px 2px rgba(15, 23, 42, 0.04)',

    marginBottom:
      '18px',
  },

  emptyState: {
    background:
      '#ffffff',

    border:
      '1px dashed #cbd5e1',

    borderRadius:
      '12px',

    minHeight:
      '300px',

    display:
      'flex',

    alignItems:
      'center',

    justifyContent:
      'center',

    flexDirection:
      'column',

    textAlign:
      'center',

    padding:
      '30px',
  },

  tableEmpty: {
    padding:
      '28px',

    textAlign:
      'center',

    color:
      '#64748b',

    background:
      '#f8fafc',

    borderRadius:
      '8px',
  },

  input: {
    border:
      '1px solid #cbd5e1',

    borderRadius:
      '7px',

    padding:
      '9px 10px',

    fontSize:
      '0.85rem',

    outline:
      'none',

    background:
      '#ffffff',

    color:
      '#0f172a',
  },

  select: {
    border:
      '1px solid #cbd5e1',

    borderRadius:
      '7px',

    padding:
      '9px 10px',

    minWidth:
      '220px',

    fontSize:
      '0.85rem',

    outline:
      'none',

    background:
      '#ffffff',

    color:
      '#0f172a',
  },

  tableInput: {
    border:
      '1px solid #cbd5e1',

    borderRadius:
      '5px',

    padding:
      '6px 7px',

    fontSize:
      '0.78rem',

    width:
      '140px',
  },

  tableNumberInput: {
    border:
      '1px solid #cbd5e1',

    borderRadius:
      '5px',

    padding:
      '6px 7px',

    fontSize:
      '0.78rem',

    width:
      '90px',
  },

  primaryButton: {
    border:
      'none',

    borderRadius:
      '7px',

    background:
      '#1d4ed8',

    color:
      '#ffffff',

    padding:
      '9px 14px',

    fontWeight:
      800,

    fontSize:
      '0.82rem',

    cursor:
      'pointer',
  },

  secondaryButton: {
    border:
      '1px solid #cbd5e1',

    borderRadius:
      '7px',

    background:
      '#ffffff',

    color:
      '#334155',

    padding:
      '9px 14px',

    fontWeight:
      700,

    fontSize:
      '0.82rem',

    cursor:
      'pointer',
  },

  commitButton: {
    border:
      'none',

    borderRadius:
      '7px',

    background:
      '#0f766e',

    color:
      '#ffffff',

    padding:
      '9px 14px',

    fontWeight:
      800,

    fontSize:
      '0.82rem',

    cursor:
      'pointer',
  },

  closeButton: {
    border:
      'none',

    borderRadius:
      '7px',

    background:
      '#0f2745',

    color:
      '#ffffff',

    padding:
      '9px 14px',

    fontWeight:
      800,

    fontSize:
      '0.82rem',

    cursor:
      'pointer',
  },

  dangerButton: {
    border:
      'none',

    borderRadius:
      '7px',

    background:
      '#b91c1c',

    color:
      '#ffffff',

    padding:
      '9px 14px',

    fontWeight:
      800,

    fontSize:
      '0.82rem',

    cursor:
      'pointer',
  },

  iconButton: {
    width:
      '36px',

    height:
      '36px',

    border:
      '1px solid #cbd5e1',

    borderRadius:
      '7px',

    background:
      '#ffffff',

    color:
      '#334155',

    cursor:
      'pointer',

    fontWeight:
      900,
  },

  smallSuccessButton: {
    border:
      '1px solid #86efac',

    background:
      '#f0fdf4',

    color:
      '#166534',

    borderRadius:
      '5px',

    padding:
      '5px 7px',

    fontSize:
      '0.72rem',

    fontWeight:
      800,

    cursor:
      'pointer',
  },

  smallDangerButton: {
    border:
      '1px solid #fecaca',

    background:
      '#fef2f2',

    color:
      '#991b1b',

    borderRadius:
      '5px',

    padding:
      '5px 7px',

    fontSize:
      '0.72rem',

    fontWeight:
      800,

    cursor:
      'pointer',
  },

  smallLabel: {
    fontSize:
      '0.72rem',

    fontWeight:
      800,

    letterSpacing:
      '0.05em',

    color:
      '#64748b',

    textTransform:
      'uppercase',
  },

  secondaryMetricValue: {
    marginTop:
      '8px',

    fontSize:
      '1.35rem',

    fontWeight:
      900,

    color:
      '#0f2745',
  },

  statusBadge: {
    display:
      'inline-flex',

    alignItems:
      'center',

    minHeight:
      '32px',

    padding:
      '0 11px',

    borderRadius:
      '999px',

    fontSize:
      '0.75rem',

    fontWeight:
      800,
  },

  draftBadge: {
    background:
      '#fef3c7',

    color:
      '#92400e',
  },

  committedBadge: {
    background:
      '#dbeafe',

    color:
      '#1d4ed8',
  },

  closedBadge: {
    background:
      '#dcfce7',

    color:
      '#166534',
  },

  cancelledBadge: {
    background:
      '#f1f5f9',

    color:
      '#64748b',
  },

  miniBadge: {
    display:
      'inline-block',

    padding:
      '4px 7px',

    borderRadius:
      '999px',

    fontSize:
      '0.7rem',

    fontWeight:
      800,

    textTransform:
      'capitalize',
  },

  successBox: {
    background:
      '#f0fdf4',

    border:
      '1px solid #bbf7d0',

    color:
      '#166534',

    borderRadius:
      '8px',

    padding:
      '10px 12px',

    marginBottom:
      '14px',

    fontSize:
      '0.84rem',
  },

  errorBox: {
    background:
      '#fef2f2',

    border:
      '1px solid #fecaca',

    color:
      '#991b1b',

    borderRadius:
      '8px',

    padding:
      '10px 12px',

    marginBottom:
      '14px',

    fontSize:
      '0.84rem',
  },

  modal: {
    width:
      '100%',

    maxWidth:
      '560px',

    maxHeight:
      '90vh',

    overflowY:
      'auto',

    background:
      '#ffffff',

    borderRadius:
      '12px',

    padding:
      '20px',

    boxShadow:
      '0 24px 60px rgba(15, 23, 42, 0.25)',
  },

  modalLarge: {
    width:
      '100%',

    maxWidth:
      '1050px',

    maxHeight:
      '90vh',

    overflowY:
      'auto',

    background:
      '#ffffff',

    borderRadius:
      '12px',

    padding:
      '20px',

    boxShadow:
      '0 24px 60px rgba(15, 23, 42, 0.25)',
  },

  modalHeader: {
    display:
      'flex',

    justifyContent:
      'space-between',

    gap:
      '15px',

    alignItems:
      'flex-start',

    marginBottom:
      '18px',
  },

  modalFooter: {
    display:
      'flex',

    justifyContent:
      'flex-end',

    gap:
      '8px',

    marginTop:
      '18px',

    paddingTop:
      '14px',

    borderTop:
      '1px solid #e2e8f0',
  },

  closeModalButton: {
    border:
      'none',

    background:
      'transparent',

    color:
      '#64748b',

    fontSize:
      '1.6rem',

    cursor:
      'pointer',

    lineHeight:
      1,
  },
};
