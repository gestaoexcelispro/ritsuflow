'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '../../../../lib/supabase';


// ============================================================
// RitsuFlow™
// CONSTRAINT MANAGEMENT — SPLIT WORKSPACE
// ============================================================


// ============================================================
// CONSTANTS
// ============================================================

const ACTIVE_CONSTRAINT_STATUSES = [
  'open',
  'in_progress',
  'waiting',
  'resolved',
];


const TERMINAL_CONSTRAINT_STATUSES = [
  'cleared',
  'cancelled',
];


const DRAWER_TABS = [
  {
    value: 'details',
    label: 'Details',
  },
  {
    value: 'forecast',
    label: 'Forecast',
  },
  {
    value: 'actions',
    label: 'Action Plan',
  },
  {
    value: 'work',
    label: 'Affected Work',
  },
  {
    value: 'history',
    label: 'History',
  },
];


const STATUS_OPTIONS = [
  {
    value: '',
    label: 'All Statuses',
  },
  {
    value: 'open',
    label: 'Open',
  },
  {
    value: 'in_progress',
    label: 'In Progress',
  },
  {
    value: 'waiting',
    label: 'Waiting',
  },
  {
    value: 'resolved',
    label: 'Resolved',
  },
  {
    value: 'cleared',
    label: 'Cleared',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
  },
];


const CATEGORY_OPTIONS = [
  {
    value: 'projects_information',
    label: 'Projects / Information',
  },
  {
    value: 'materials',
    label: 'Materials',
  },
  {
    value: 'labor',
    label: 'Labor',
  },
  {
    value: 'equipment',
    label: 'Equipment',
  },
  {
    value: 'space',
    label: 'Space',
  },
  {
    value: 'predecessor',
    label: 'Predecessor',
  },
  {
    value: 'external_conditions',
    label: 'External Conditions',
  },
];


const PRIORITY_OPTIONS = [
  {
    value: 'low',
    label: 'Low',
  },
  {
    value: 'medium',
    label: 'Medium',
  },
  {
    value: 'high',
    label: 'High',
  },
  {
    value: 'critical',
    label: 'Critical',
  },
];


const RESPONSE_APPROACH_OPTIONS = [
  {
    value: 'eliminate_cause',
    label: 'Eliminate Cause',
  },
  {
    value: 'reduce_impact',
    label: 'Reduce Impact',
  },
  {
    value: 'alternative_solution',
    label: 'Alternative Solution',
  },
  {
    value: 'transfer_responsibility',
    label: 'Transfer Responsibility',
  },
  {
    value: 'accept_impact',
    label: 'Accept Impact',
  },
  {
    value: 'escalate',
    label: 'Escalate',
  },
];


const EXPECTED_IMPACT_OPTIONS = [
  {
    value: 'protect_required_by',
    label: 'Protect Required By Date',
  },
  {
    value: 'reduce_delay',
    label: 'Reduce Schedule Exposure',
  },
  {
    value: 'no_schedule_effect',
    label: 'No Schedule Effect',
  },
  {
    value: 'other',
    label: 'Other',
  },
];


const EFFECTIVENESS_OPTIONS = [
  {
    value: 'effective',
    label: 'Effective',
  },
  {
    value: 'partially_effective',
    label: 'Partially Effective',
  },
  {
    value: 'ineffective',
    label: 'Ineffective',
  },
];


const CATEGORY_LABELS =
  Object.fromEntries(
    CATEGORY_OPTIONS.map(
      (item) => [
        item.value,
        item.label,
      ]
    )
  );


const ACTION_TYPE_LABELS = {
  created:
    'Constraint Created',

  assigned:
    'Assigned',

  responsible_changed:
    'Responsible Changed',

  action_updated:
    'Constraint Details Updated',

  status_changed:
    'Status Changed',

  target_date_changed:
    'Forecast Updated',

  comment_added:
    'Comment Added',

  resolved:
    'Resolution Reported',

  verified:
    'Resolution Verified',

  cleared:
    'Constraint Cleared',

  cancelled:
    'Constraint Cancelled',

  action_plan_added:
    'Recovery Action Added',

  action_plan_completed:
    'Recovery Action Completed',

  action_effectiveness_evaluated:
    'Recovery Effectiveness Evaluated',

  priority_auto_escalated:
    'Priority Auto-Escalated',

  priority_auto_escalation_removed:
    'Automatic Critical Escalation Removed',
};


// ============================================================
// HELPERS
// ============================================================

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}


function formatLabel(value) {
  if (!value) {
    return '—';
  }

  if (CATEGORY_LABELS[value]) {
    return CATEGORY_LABELS[value];
  }

  return String(value)
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}


function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }
  ).format(date);
}


function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(date);
}


function getConstraintReference(
  constraintId
) {
  if (!constraintId) {
    return 'CON-UNKNOWN';
  }

  const compact =
    String(constraintId)
      .replace(/-/g, '')
      .slice(0, 6)
      .toUpperCase();

  return `CON-${compact}`;
}


function getSourceLabel(
  constraint
) {
  if (
    constraint
      ?.readiness_assessment_id
  ) {
    return 'Lookahead';
  }

  if (
    constraint
      ?.lookahead_work_item_id
  ) {
    return 'Lookahead';
  }

  if (
    constraint
      ?.master_plan_package_id
  ) {
    return 'Master Plan';
  }

  return 'Manual / Project';
}


function getStatusLabel(status) {
  switch (status) {
    case 'open':
      return 'Open';

    case 'in_progress':
      return 'In Progress';

    case 'waiting':
      return 'Waiting';

    case 'resolved':
      return 'Resolved';

    case 'cleared':
      return 'Cleared';

    case 'cancelled':
      return 'Cancelled';

    case 'completed':
      return 'Completed';

    default:
      return formatLabel(status);
  }
}


function getActionTypeLabel(
  actionType
) {
  if (!actionType) {
    return 'History Entry';
  }

  return (
    ACTION_TYPE_LABELS[
      actionType
    ] ||
    formatLabel(actionType)
  );
}


function getStatusStyle(status) {
  switch (status) {
    case 'open':
      return {
        background: '#fee2e2',
        border: '#fca5a5',
        color: '#991b1b',
      };

    case 'in_progress':
      return {
        background: '#dbeafe',
        border: '#93c5fd',
        color: '#1d4ed8',
      };

    case 'waiting':
      return {
        background: '#fef3c7',
        border: '#fcd34d',
        color: '#92400e',
      };

    case 'resolved':
      return {
        background: '#ede9fe',
        border: '#c4b5fd',
        color: '#6d28d9',
      };

    case 'cleared':
    case 'completed':
      return {
        background: '#dcfce7',
        border: '#86efac',
        color: '#166534',
      };

    case 'cancelled':
      return {
        background: '#f1f5f9',
        border: '#cbd5e1',
        color: '#64748b',
      };

    default:
      return {
        background: '#f8fafc',
        border: '#cbd5e1',
        color: '#475569',
      };
  }
}


function getPriorityStyle(
  priority
) {
  switch (
    normalizeText(priority)
  ) {
    case 'critical':
      return {
        background: '#fee2e2',
        border: '#ef4444',
        color: '#991b1b',
      };

    case 'high':
      return {
        background: '#fff7ed',
        border: '#fdba74',
        color: '#c2410c',
      };

    case 'medium':
      return {
        background: '#fefce8',
        border: '#fde047',
        color: '#854d0e',
      };

    case 'low':
      return {
        background: '#f0fdf4',
        border: '#86efac',
        color: '#166534',
      };

    default:
      return {
        background: '#f8fafc',
        border: '#cbd5e1',
        color: '#475569',
      };
  }
}


function getEffectivenessStyle(
  effectiveness
) {
  switch (effectiveness) {
    case 'effective':
      return {
        background: '#dcfce7',
        border: '#86efac',
        color: '#166534',
      };

    case 'partially_effective':
      return {
        background: '#fef3c7',
        border: '#fcd34d',
        color: '#92400e',
      };

    case 'ineffective':
      return {
        background: '#fee2e2',
        border: '#fca5a5',
        color: '#991b1b',
      };

    default:
      return {
        background: '#f1f5f9',
        border: '#cbd5e1',
        color: '#64748b',
      };
  }
}


function dateDifferenceDays(
  fromDate,
  toDate
) {
  if (
    !fromDate ||
    !toDate
  ) {
    return null;
  }

  const start =
    new Date(
      `${fromDate}T00:00:00`
    );

  const finish =
    new Date(
      `${toDate}T00:00:00`
    );

  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      finish.getTime()
    )
  ) {
    return null;
  }

  return Math.round(
    (
      finish.getTime() -
      start.getTime()
    ) /
    86400000
  );
}


function getExposureLabel(
  days
) {
  if (
    days === null ||
    days === undefined
  ) {
    return '—';
  }

  if (days > 0) {
    return `+${days} day${days === 1 ? '' : 's'}`;
  }

  if (days === 0) {
    return 'On required date';
  }

  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} early`;
}


function getOutlookLabel(value) {
  switch (value) {
    case 'cleared':
      return 'Cleared';

    case 'awaiting_verification':
      return 'Awaiting Verification';

    case 'awaiting_verification_exposed':
      return 'Awaiting Verification · Exposed';

    case 'recovery_possible':
      return 'Recovery Possible';

    case 'schedule_exposed':
      return 'Schedule Exposed';

    case 'action_plan_active':
      return 'Action Plan Active';

    case 'protected':
      return 'Protected';

    default:
      return formatLabel(value);
  }
}


async function getPerformedBy() {
  try {
    const {
      data,
    } =
      await supabase.auth
        .getUser();

    const user =
      data?.user;

    if (!user) {
      return null;
    }

    return (
      user.user_metadata
        ?.full_name ||
      user.user_metadata
        ?.name ||
      user.email ||
      null
    );

  } catch (error) {
    console.error(
      'Constraint actor:',
      error
    );

    return null;
  }
}


// ============================================================
// FORM BUILDERS
// ============================================================

function createInitialConstraintForm() {
  return {
    category:
      'projects_information',

    title:
      '',

    description:
      '',

    action_required:
      '',

    responsible_party:
      '',

    required_by_date:
      '',

    priority:
      'medium',

    blocking:
      true,
  };
}


function createManagementForm(
  constraint
) {
  return {
    responsible_party:
      constraint
        ?.responsible_party ||
      '',

    action_required:
      constraint
        ?.action_required ||
      '',

    priority:
      constraint
        ?.base_priority ||
      constraint
        ?.legacy_priority ||
      constraint
        ?.priority ||
      'medium',

    description:
      constraint
        ?.description ||
      '',

    blocking:
      Boolean(
        constraint
          ?.blocking
      ),

    comment:
      '',
  };
}


function createRecoveryActionForm() {
  return {
    response_approach:
      'alternative_solution',

    action_title:
      '',

    action_description:
      '',

    responsible_party:
      '',

    due_date:
      '',

    expected_impact:
      'protect_required_by',
  };
}


// ============================================================
// PAGE
// ============================================================

export default function ConstraintLogPage() {

  // ==========================================================
  // DATA
  // ==========================================================

  const [
    projects,
    setProjects,
  ] = useState([]);


  const [
    selectedProjectId,
    setSelectedProjectId,
  ] = useState('');


  const [
    constraints,
    setConstraints,
  ] = useState([]);


  const [
    affectedWork,
    setAffectedWork,
  ] = useState([]);


  const [
    lookaheadItems,
    setLookaheadItems,
  ] = useState({});


  const [
    masterPlanPackages,
    setMasterPlanPackages,
  ] = useState({});


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');


  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');


  // ==========================================================
  // FILTERS
  // ==========================================================

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('');


  const [
    statusFilter,
    setStatusFilter,
  ] = useState('');


  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState('');


  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState('');


  const [
    exposureFilter,
    setExposureFilter,
  ] = useState('');


  const [
    responsibleFilter,
    setResponsibleFilter,
  ] = useState('');


  // ==========================================================
  // CREATE
  // ==========================================================

  const [
    showCreateModal,
    setShowCreateModal,
  ] = useState(false);


  const [
    creatingConstraint,
    setCreatingConstraint,
  ] = useState(false);


  const [
    createForm,
    setCreateForm,
  ] = useState(
    createInitialConstraintForm()
  );


  // ==========================================================
  // DRAWER
  // ==========================================================

  const [
    managedConstraint,
    setManagedConstraint,
  ] = useState(null);


  const [
    drawerTab,
    setDrawerTab,
  ] = useState(
    'details'
  );


  const [
    managementForm,
    setManagementForm,
  ] = useState(
    createManagementForm()
  );


  const [
    savingDetails,
    setSavingDetails,
  ] = useState(false);


  const [
    activeManagementPanel,
    setActiveManagementPanel,
  ] = useState(null);


  const [
    managementNote,
    setManagementNote,
  ] = useState('');


  const [
    forecastDate,
    setForecastDate,
  ] = useState('');


  const [
    savingAction,
    setSavingAction,
  ] = useState(false);


  // ==========================================================
  // HISTORY
  // ==========================================================

  const [
    constraintHistory,
    setConstraintHistory,
  ] = useState([]);


  const [
    loadingHistory,
    setLoadingHistory,
  ] = useState(false);


  const [
    historyError,
    setHistoryError,
  ] = useState('');


  // ==========================================================
  // RECOVERY ACTIONS
  // ==========================================================

  const [
    recoveryActions,
    setRecoveryActions,
  ] = useState([]);


  const [
    loadingRecoveryActions,
    setLoadingRecoveryActions,
  ] = useState(false);


  const [
    recoveryActionForm,
    setRecoveryActionForm,
  ] = useState(
    createRecoveryActionForm()
  );


  const [
    savingRecoveryAction,
    setSavingRecoveryAction,
  ] = useState(false);


  const [
    selectedRecoveryActionId,
    setSelectedRecoveryActionId,
  ] = useState(null);


  const [
    recoveryActionNote,
    setRecoveryActionNote,
  ] = useState('');


  const [
    effectivenessValue,
    setEffectivenessValue,
  ] = useState(
    'effective'
  );


  const [
    recoveryActionPanel,
    setRecoveryActionPanel,
  ] = useState(null);


  // ==========================================================
  // LOAD PROJECTS
  // ==========================================================

  const loadProjects =
    useCallback(
      async () => {

        setErrorMessage('');

        try {

          const {
            data,
            error,
          } =
            await supabase
              .from('projects')
              .select(`
                id,
                organization_id,
                code,
                name,
                status,
                created_at
              `)
              .neq(
                'status',
                'archived'
              )
              .order(
                'created_at',
                {
                  ascending:
                    false,
                }
              );


          if (error) {
            throw error;
          }


          const rows =
            data || [];


          setProjects(rows);


          const params =
            new URLSearchParams(
              window.location.search
            );


          const requested =
            params.get(
              'projectId'
            );


          if (
            requested &&
            rows.some(
              (project) =>
                project.id ===
                requested
            )
          ) {
            setSelectedProjectId(
              requested
            );

            return;
          }


          if (
            rows.length ===
            1
          ) {
            setSelectedProjectId(
              rows[0].id
            );
          }

        } catch (error) {

          console.error(
            'Projects:',
            error
          );


          setErrorMessage(
            error.message ||
            'Projects could not be loaded.'
          );

        }

      },
      []
    );


  // ==========================================================
  // LOAD CONSTRAINTS
  // ==========================================================

  const loadConstraintLog =
    useCallback(
      async (
        projectId
      ) => {

        if (!projectId) {

          setConstraints([]);
          setAffectedWork([]);
          setLookaheadItems({});
          setMasterPlanPackages({});

          return;
        }


        setLoading(true);
        setErrorMessage('');


        try {

          const {
            data:
              constraintData,

            error:
              constraintError,
          } =
            await supabase
              .from(
                'constraint_management_overview'
              )
              .select('*')
              .eq(
                'project_id',
                projectId
              )
              .order(
                'created_at',
                {
                  ascending:
                    false,
                }
              );


          if (
            constraintError
          ) {
            throw constraintError;
          }


          const loadedConstraints =
            constraintData ||
            [];


          setConstraints(
            loadedConstraints
          );


          if (
            loadedConstraints.length ===
            0
          ) {

            setAffectedWork([]);
            setLookaheadItems({});
            setMasterPlanPackages({});

            return;
          }


          const constraintIds =
            loadedConstraints.map(
              (constraint) =>
                constraint.id
            );


          const {
            data:
              affectedData,

            error:
              affectedError,
          } =
            await supabase
              .from(
                'constraint_affected_work'
              )
              .select(`
                id,
                constraint_id,
                lookahead_work_item_id,
                master_plan_package_id,
                created_at
              `)
              .in(
                'constraint_id',
                constraintIds
              );


          if (
            affectedError
          ) {
            throw affectedError;
          }


          const loadedAffected =
            affectedData ||
            [];


          setAffectedWork(
            loadedAffected
          );


          const lookaheadIds =
            Array.from(
              new Set([
                ...loadedAffected
                  .map(
                    (item) =>
                      item
                        .lookahead_work_item_id
                  )
                  .filter(Boolean),

                ...loadedConstraints
                  .map(
                    (constraint) =>
                      constraint
                        .lookahead_work_item_id
                  )
                  .filter(Boolean),
              ])
            );


          let lookaheadMap =
            {};


          if (
            lookaheadIds.length >
            0
          ) {

            const {
              data,
              error,
            } =
              await supabase
                .from(
                  'lookahead_work_items'
                )
                .select(`
                  id,
                  project_id,
                  master_plan_package_id,
                  package_code,
                  service_name,
                  service_code,
                  location_name,
                  location_path,
                  lookahead_description,
                  lookahead_start_date,
                  lookahead_finish_date
                `)
                .in(
                  'id',
                  lookaheadIds
                );


            if (error) {
              throw error;
            }


            lookaheadMap =
              Object.fromEntries(
                (data || []).map(
                  (item) => [
                    item.id,
                    item,
                  ]
                )
              );
          }


          setLookaheadItems(
            lookaheadMap
          );


          const masterIds =
            Array.from(
              new Set([
                ...loadedAffected
                  .map(
                    (item) =>
                      item
                        .master_plan_package_id
                  )
                  .filter(Boolean),

                ...loadedConstraints
                  .map(
                    (constraint) =>
                      constraint
                        .master_plan_package_id
                  )
                  .filter(Boolean),

                ...Object
                  .values(
                    lookaheadMap
                  )
                  .map(
                    (item) =>
                      item
                        .master_plan_package_id
                  )
                  .filter(Boolean),
              ])
            );


          let masterMap =
            {};


          if (
            masterIds.length >
            0
          ) {

            const {
              data,
              error,
            } =
              await supabase
                .from(
                  'master_plan_packages'
                )
                .select(`
                  id,
                  project_id,
                  package_code,
                  service_name,
                  service_code,
                  location_name,
                  location_path,
                  scheduled_start_date,
                  scheduled_finish_date
                `)
                .in(
                  'id',
                  masterIds
                );


            if (error) {
              throw error;
            }


            masterMap =
              Object.fromEntries(
                (data || []).map(
                  (item) => [
                    item.id,
                    item,
                  ]
                )
              );
          }


          setMasterPlanPackages(
            masterMap
          );

        } catch (error) {

          console.error(
            'Constraint Log:',
            error
          );


          setErrorMessage(
            error.message ||
            'Constraint Log could not be loaded.'
          );

        } finally {

          setLoading(false);

        }

      },
      []
    );


  // ==========================================================
  // HISTORY
  // ==========================================================

  const loadConstraintHistory =
    useCallback(
      async (
        constraintId
      ) => {

        if (!constraintId) {
          return;
        }


        setLoadingHistory(true);


        try {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'constraint_logs'
              )
              .select(`
                id,
                constraint_id,
                status_from,
                status_to,
                previous_target_resolution_date,
                new_target_resolution_date,
                comment,
                action_type,
                performed_by,
                performed_by_user_id,
                created_at
              `)
              .eq(
                'constraint_id',
                constraintId
              )
              .order(
                'created_at',
                {
                  ascending:
                    false,
                }
              );


          if (error) {
            throw error;
          }


          setConstraintHistory(
            data || []
          );

        } catch (error) {

          console.error(
            'Constraint History:',
            error
          );


          setHistoryError(
            error.message ||
            'Action History could not be loaded.'
          );

        } finally {

          setLoadingHistory(false);

        }

      },
      []
    );


  // ==========================================================
  // RECOVERY ACTIONS
  // ==========================================================

  const loadRecoveryActions =
    useCallback(
      async (
        constraintId
      ) => {

        if (!constraintId) {
          setRecoveryActions([]);
          return;
        }


        setLoadingRecoveryActions(
          true
        );


        try {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'constraint_actions'
              )
              .select(`
                id,
                constraint_id,
                project_id,
                response_approach,
                action_title,
                action_description,
                responsible_party,
                due_date,
                status,
                expected_impact,
                effectiveness,
                effectiveness_notes,
                completed_at,
                cancelled_at,
                created_by,
                created_by_user_id,
                created_at,
                updated_at
              `)
              .eq(
                'constraint_id',
                constraintId
              )
              .order(
                'created_at',
                {
                  ascending:
                    true,
                }
              );


          if (error) {
            throw error;
          }


          setRecoveryActions(
            data || []
          );

        } catch (error) {

          console.error(
            'Recovery Actions:',
            error
          );


          setHistoryError(
            error.message ||
            'Action Plan could not be loaded.'
          );

        } finally {

          setLoadingRecoveryActions(
            false
          );

        }

      },
      []
    );


  // ==========================================================
  // REFRESH SELECTED CONSTRAINT
  // ==========================================================

  const refreshManagedConstraint =
    useCallback(
      async (
        constraintId
      ) => {

        if (
          !constraintId ||
          !selectedProjectId
        ) {
          return;
        }


        await loadConstraintLog(
          selectedProjectId
        );


        const {
          data,
          error,
        } =
          await supabase
            .from(
              'constraint_management_overview'
            )
            .select('*')
            .eq(
              'id',
              constraintId
            )
            .single();


        if (error) {
          throw error;
        }


        setManagedConstraint(data);


        setManagementForm(
          createManagementForm(
            data
          )
        );


        setForecastDate(
          data
            .target_resolution_date ||
          data
            .required_by_date ||
          ''
        );


        await Promise.all([
          loadConstraintHistory(
            constraintId
          ),

          loadRecoveryActions(
            constraintId
          ),
        ]);

      },
      [
        selectedProjectId,
        loadConstraintLog,
        loadConstraintHistory,
        loadRecoveryActions,
      ]
    );


  // ==========================================================
  // EFFECTS
  // ==========================================================

  useEffect(
    () => {
      loadProjects();
    },
    [
      loadProjects,
    ]
  );


  useEffect(
    () => {
      loadConstraintLog(
        selectedProjectId
      );
    },
    [
      selectedProjectId,
      loadConstraintLog,
    ]
  );


  // ==========================================================
  // PROJECT CHANGE
  // ==========================================================

  function handleProjectChange(
    projectId
  ) {

    setSelectedProjectId(
      projectId
    );

    setSearchTerm('');
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setExposureFilter('');
    setResponsibleFilter('');
    setSuccessMessage('');
    setErrorMessage('');

    closeManagementDrawer();


    if (projectId) {

      window.history
        .replaceState(
          {},
          '',
          `/dashboard/projects/constraints?projectId=${projectId}`
        );

    } else {

      window.history
        .replaceState(
          {},
          '',
          '/dashboard/projects/constraints'
        );

    }

  }


  // ==========================================================
  // CREATE CONSTRAINT
  // ==========================================================

  function openCreateModal() {

    setCreateForm(
      createInitialConstraintForm()
    );

    setShowCreateModal(true);

  }


  async function createConstraint(
    event
  ) {

    event.preventDefault();


    if (
      creatingConstraint
    ) {
      return;
    }


    const title =
      String(
        createForm.title ||
        ''
      ).trim();


    const responsible =
      String(
        createForm
          .responsible_party ||
        ''
      ).trim();


    const action =
      String(
        createForm
          .action_required ||
        ''
      ).trim();


    if (
      !title ||
      !responsible ||
      !action ||
      !createForm
        .required_by_date
    ) {

      setErrorMessage(
        'Title, Responsible Party, Required Action and Required By Date are required.'
      );

      return;
    }


    setCreatingConstraint(true);


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'create_manual_constraint_with_history',
          {
            target_project_id:
              selectedProjectId,

            target_category:
              createForm.category,

            target_title:
              title,

            target_description:
              createForm.description ||
              null,

            target_action_required:
              action,

            target_responsible_party:
              responsible,

            target_required_by_date:
              createForm
                .required_by_date,

            target_priority:
              createForm.priority,

            target_blocking:
              Boolean(
                createForm.blocking
              ),

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      setShowCreateModal(false);


      await loadConstraintLog(
        selectedProjectId
      );

    } catch (error) {

      console.error(
        'Create Constraint:',
        error
      );


      setErrorMessage(
        error.message ||
        'Constraint could not be created.'
      );

    } finally {

      setCreatingConstraint(false);

    }

  }


  // ==========================================================
  // DRAWER
  // ==========================================================

  async function openManagementDrawer(
    constraint
  ) {

    setManagedConstraint(
      constraint
    );


    setDrawerTab(
      'details'
    );


    setManagementForm(
      createManagementForm(
        constraint
      )
    );


    setForecastDate(
      constraint
        .target_resolution_date ||
      constraint
        .required_by_date ||
      ''
    );


    setManagementNote('');

    setActiveManagementPanel(
      null
    );

    setHistoryError('');

    setRecoveryActionForm(
      createRecoveryActionForm()
    );

    setRecoveryActionPanel(
      null
    );

    setSelectedRecoveryActionId(
      null
    );

    setRecoveryActionNote('');

    setEffectivenessValue(
      'effective'
    );


    await Promise.all([
      loadConstraintHistory(
        constraint.id
      ),

      loadRecoveryActions(
        constraint.id
      ),
    ]);

  }


  function closeManagementDrawer() {

    setManagedConstraint(null);

    setDrawerTab(
      'details'
    );

    setManagementForm(
      createManagementForm()
    );

    setActiveManagementPanel(
      null
    );

    setManagementNote('');

    setForecastDate('');

    setConstraintHistory([]);

    setRecoveryActions([]);

    setRecoveryActionForm(
      createRecoveryActionForm()
    );

    setRecoveryActionPanel(
      null
    );

    setSelectedRecoveryActionId(
      null
    );

    setRecoveryActionNote('');

    setEffectivenessValue(
      'effective'
    );

    setHistoryError('');

  }


  function selectDrawerTab(
    tab
  ) {

    setDrawerTab(
      tab
    );

    setActiveManagementPanel(
      null
    );

    setManagementNote('');

    setRecoveryActionPanel(
      null
    );

    setSelectedRecoveryActionId(
      null
    );

    setRecoveryActionNote('');

    setHistoryError('');

  }


  function toggleManagementPanel(
    panel
  ) {

    setHistoryError('');

    setManagementNote('');


    if (managedConstraint) {

      setForecastDate(
        managedConstraint
          .target_resolution_date ||
        managedConstraint
          .required_by_date ||
        ''
      );

    }


    setActiveManagementPanel(
      (current) =>
        current === panel
          ? null
          : panel
    );

  }


  // ==========================================================
  // SAVE DETAILS
  // ==========================================================

  async function saveManagementDetails() {

    if (
      !managedConstraint ||
      savingDetails
    ) {
      return;
    }


    const responsible =
      String(
        managementForm
          .responsible_party ||
        ''
      ).trim();


    const requiredAction =
      String(
        managementForm
          .action_required ||
        ''
      ).trim();


    if (
      !responsible ||
      !requiredAction
    ) {

      setHistoryError(
        'Responsible Party and Required Action are required.'
      );

      return;
    }


    setSavingDetails(true);
    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'update_constraint_details_with_history',
          {
            target_constraint_id:
              managedConstraint.id,

            target_responsible_party:
              responsible,

            target_action_required:
              requiredAction,

            target_priority:
              managementForm.priority,

            target_description:
              managementForm.description ||
              null,

            target_blocking:
              Boolean(
                managementForm.blocking
              ),

            target_comment:
              managementForm.comment ||
              null,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      console.error(
        'Save Details:',
        error
      );


      setHistoryError(
        error.message ||
        'Constraint details could not be saved.'
      );

    } finally {

      setSavingDetails(false);

    }

  }


  // ==========================================================
  // COMMENT
  // ==========================================================

  async function addManagementComment() {

    const note =
      String(
        managementNote ||
        ''
      ).trim();


    if (!note) {

      setHistoryError(
        'Comment is required.'
      );

      return;
    }


    setSavingAction(true);
    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'add_constraint_comment_with_history',
          {
            target_constraint_id:
              managedConstraint.id,

            target_comment:
              note,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      setManagementNote('');

      setActiveManagementPanel(
        null
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        'Comment could not be added.'
      );

    } finally {

      setSavingAction(false);

    }

  }


  // ==========================================================
  // UPDATE FORECAST
  // ==========================================================

  async function updateForecast() {

    const reason =
      String(
        managementNote ||
        ''
      ).trim();


    if (!forecastDate) {

      setHistoryError(
        'New Planned Resolution Date is required.'
      );

      return;
    }


    if (!reason) {

      setHistoryError(
        'Reason for Date Change is required.'
      );

      return;
    }


    setSavingAction(true);
    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'update_constraint_forecast_with_history',
          {
            target_constraint_id:
              managedConstraint.id,

            target_new_resolution_date:
              forecastDate,

            target_reason:
              reason,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      setManagementNote('');

      setActiveManagementPanel(
        null
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        'Forecast could not be updated.'
      );

    } finally {

      setSavingAction(false);

    }

  }


  // ==========================================================
  // REOPEN
  // ==========================================================

  async function reopenConstraint() {

    if (
      !managedConstraint ||
      savingAction
    ) {
      return;
    }


    const reason =
      String(
        managementNote ||
        ''
      ).trim();


    if (!forecastDate) {

      setHistoryError(
        'New Planned Resolution Date is required.'
      );

      return;
    }


    if (!reason) {

      setHistoryError(
        'Reason for Reopening and Date Change is required.'
      );

      return;
    }


    setSavingAction(true);
    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'reopen_constraint_with_history',
          {
            target_constraint_id:
              managedConstraint.id,

            target_new_resolution_date:
              forecastDate,

            target_reason:
              reason,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      setManagementNote('');

      setActiveManagementPanel(
        null
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      console.error(
        'Reopen Constraint:',
        error
      );


      setHistoryError(
        error.message ||
        'Constraint could not be reopened.'
      );

    } finally {

      setSavingAction(false);

    }

  }


  // ==========================================================
  // LIFECYCLE
  // ==========================================================

  async function executeLifecycleAction(
    action
  ) {

    const note =
      String(
        managementNote ||
        ''
      ).trim();


    let functionName =
      null;


    let parameters =
      null;


    const performedBy =
      await getPerformedBy();


    switch (action) {

      case 'start':

        functionName =
          'start_constraint_action_with_history';

        parameters = {
          target_constraint_id:
            managedConstraint.id,

          target_comment:
            note || null,

          target_performed_by:
            performedBy,
        };

        break;


      case 'waiting':

        if (!note) {

          setHistoryError(
            'Reason for Waiting is required.'
          );

          return;
        }


        functionName =
          'set_constraint_waiting_with_history';

        parameters = {
          target_constraint_id:
            managedConstraint.id,

          target_reason:
            note,

          target_performed_by:
            performedBy,
        };

        break;


      case 'resume':

        functionName =
          'resume_constraint_action_with_history';

        parameters = {
          target_constraint_id:
            managedConstraint.id,

          target_comment:
            note || null,

          target_performed_by:
            performedBy,
        };

        break;


      case 'resolve':

        if (!note) {

          setHistoryError(
            'Resolution Note is required.'
          );

          return;
        }


        functionName =
          'resolve_constraint_with_history';

        parameters = {
          target_constraint_id:
            managedConstraint.id,

          target_resolution_note:
            note,

          target_performed_by:
            performedBy,
        };

        break;


      case 'clear':

        if (!note) {

          setHistoryError(
            'Verification Note is required.'
          );

          return;
        }


        functionName =
          'verify_and_clear_constraint_with_history';

        parameters = {
          target_constraint_id:
            managedConstraint.id,

          target_verification_note:
            note,

          target_performed_by:
            performedBy,
        };

        break;


      case 'cancel':

        if (!note) {

          setHistoryError(
            'Cancellation Reason is required.'
          );

          return;
        }


        functionName =
          'cancel_constraint_with_history';

        parameters = {
          target_constraint_id:
            managedConstraint.id,

          target_reason:
            note,

          target_performed_by:
            performedBy,
        };

        break;


      default:
        return;
    }


    setSavingAction(true);
    setHistoryError('');


    try {

      const {
        error,
      } =
        await supabase.rpc(
          functionName,
          parameters
        );


      if (error) {
        throw error;
      }


      setManagementNote('');

      setActiveManagementPanel(
        null
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        'Constraint status could not be changed.'
      );

    } finally {

      setSavingAction(false);

    }

  }


  // ==========================================================
  // RECOVERY ACTION — CREATE
  // ==========================================================

  async function createRecoveryAction() {

    if (
      !managedConstraint ||
      savingRecoveryAction
    ) {
      return;
    }


    const title =
      String(
        recoveryActionForm
          .action_title ||
        ''
      ).trim();


    const responsible =
      String(
        recoveryActionForm
          .responsible_party ||
        ''
      ).trim();


    if (!title) {

      setHistoryError(
        'Recovery Action is required.'
      );

      return;
    }


    if (!responsible) {

      setHistoryError(
        'Recovery Action Responsible Party is required.'
      );

      return;
    }


    if (
      !recoveryActionForm
        .due_date
    ) {

      setHistoryError(
        'Recovery Action Due Date is required.'
      );

      return;
    }


    setSavingRecoveryAction(
      true
    );

    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'create_constraint_action_with_history',
          {
            target_constraint_id:
              managedConstraint.id,

            target_response_approach:
              recoveryActionForm
                .response_approach,

            target_action_title:
              title,

            target_action_description:
              recoveryActionForm
                .action_description ||
              null,

            target_responsible_party:
              responsible,

            target_due_date:
              recoveryActionForm
                .due_date,

            target_expected_impact:
              recoveryActionForm
                .expected_impact,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      setRecoveryActionForm(
        createRecoveryActionForm()
      );


      setRecoveryActionPanel(
        null
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        'Recovery Action could not be created.'
      );

    } finally {

      setSavingRecoveryAction(
        false
      );

    }

  }


  // ==========================================================
  // RECOVERY ACTION — START
  // ==========================================================

  async function startRecoveryAction(
    actionId
  ) {

    setSavingRecoveryAction(
      true
    );

    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'start_constraint_action_plan_item_with_history',
          {
            target_action_id:
              actionId,

            target_comment:
              recoveryActionNote ||
              null,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      closeRecoveryActionPanel();


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        'Recovery Action could not be started.'
      );

    } finally {

      setSavingRecoveryAction(
        false
      );

    }

  }


  // ==========================================================
  // RECOVERY ACTION — COMPLETE
  // ==========================================================

  async function completeRecoveryAction(
    actionId
  ) {

    const note =
      String(
        recoveryActionNote ||
        ''
      ).trim();


    if (!note) {

      setHistoryError(
        'Completion Note is required.'
      );

      return;
    }


    setSavingRecoveryAction(
      true
    );

    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'complete_constraint_action_with_history',
          {
            target_action_id:
              actionId,

            target_completion_note:
              note,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      closeRecoveryActionPanel();


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        'Recovery Action could not be completed.'
      );

    } finally {

      setSavingRecoveryAction(
        false
      );

    }

  }


  // ==========================================================
  // RECOVERY ACTION — EFFECTIVENESS
  // ==========================================================

  async function evaluateRecoveryAction(
    actionId
  ) {

    const note =
      String(
        recoveryActionNote ||
        ''
      ).trim();


    if (!note) {

      setHistoryError(
        'Effectiveness Notes are required.'
      );

      return;
    }


    setSavingRecoveryAction(
      true
    );

    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'evaluate_constraint_action_effectiveness_with_history',
          {
            target_action_id:
              actionId,

            target_effectiveness:
              effectivenessValue,

            target_notes:
              note,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      closeRecoveryActionPanel();


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        'Effectiveness could not be evaluated.'
      );

    } finally {

      setSavingRecoveryAction(
        false
      );

    }

  }


  // ==========================================================
  // RECOVERY ACTION — CANCEL
  // ==========================================================

  async function cancelRecoveryAction(
    actionId
  ) {

    const reason =
      String(
        recoveryActionNote ||
        ''
      ).trim();


    if (!reason) {

      setHistoryError(
        'Cancellation Reason is required.'
      );

      return;
    }


    setSavingRecoveryAction(
      true
    );

    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'cancel_constraint_action_with_history',
          {
            target_action_id:
              actionId,

            target_reason:
              reason,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      closeRecoveryActionPanel();


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        'Recovery Action could not be cancelled.'
      );

    } finally {

      setSavingRecoveryAction(
        false
      );

    }

  }


  function openRecoveryActionPanel(
    actionId,
    panel
  ) {

    setSelectedRecoveryActionId(
      actionId
    );

    setRecoveryActionPanel(
      panel
    );

    setRecoveryActionNote('');

    setEffectivenessValue(
      'effective'
    );

    setHistoryError('');

  }


  function closeRecoveryActionPanel() {

    setSelectedRecoveryActionId(
      null
    );

    setRecoveryActionPanel(
      null
    );

    setRecoveryActionNote('');

    setEffectivenessValue(
      'effective'
    );

  }


  // ==========================================================
  // AFFECTED WORK
  // ==========================================================

  const affectedWorkByConstraint =
    useMemo(
      () => {

        const map =
          {};


        affectedWork.forEach(
          (relationship) => {

            if (
              !map[
                relationship
                  .constraint_id
              ]
            ) {
              map[
                relationship
                  .constraint_id
              ] =
                [];
            }


            map[
              relationship
                .constraint_id
            ].push(
              relationship
            );

          }
        );


        return map;

      },
      [
        affectedWork,
      ]
    );


  const getConstraintAffectedWork =
    useCallback(
      (
        constraint
      ) => {

        const relationships =
          affectedWorkByConstraint[
            constraint.id
          ] || [];


        const candidates =
          [];


        relationships.forEach(
          (relationship) => {

            if (
              relationship
                .lookahead_work_item_id
            ) {

              const item =
                lookaheadItems[
                  relationship
                    .lookahead_work_item_id
                ];


              if (item) {

                candidates.push({
                  key:
                    `lookahead-${item.id}`,

                  type:
                    'Lookahead',

                  packageCode:
                    item.package_code ||
                    '—',

                  serviceName:
                    item.service_name ||
                    '',

                  location:
                    item.location_path ||
                    item.location_name ||
                    'Unassigned Location',

                  startDate:
                    item
                      .lookahead_start_date,

                  finishDate:
                    item
                      .lookahead_finish_date,
                });

              }

            }


            if (
              relationship
                .master_plan_package_id
            ) {

              const item =
                masterPlanPackages[
                  relationship
                    .master_plan_package_id
                ];


              if (item) {

                candidates.push({
                  key:
                    `master-${item.id}`,

                  type:
                    'Master Plan',

                  packageCode:
                    item.package_code ||
                    '—',

                  serviceName:
                    item.service_name ||
                    '',

                  location:
                    item.location_path ||
                    item.location_name ||
                    'Unassigned Location',

                  startDate:
                    item
                      .scheduled_start_date,

                  finishDate:
                    item
                      .scheduled_finish_date,
                });

              }

            }

          }
        );


        const unique =
          new Map();


        candidates.forEach(
          (item) => {

            const key =
              `${normalizeText(
                item.packageCode
              )}|${normalizeText(
                item.location
              )}`;


            const existing =
              unique.get(key);


            if (
              !existing ||
              (
                existing.type ===
                  'Master Plan' &&
                item.type ===
                  'Lookahead'
              )
            ) {

              unique.set(
                key,
                item
              );

            }

          }
        );


        return Array.from(
          unique.values()
        );

      },
      [
        affectedWorkByConstraint,
        lookaheadItems,
        masterPlanPackages,
      ]
    );


  const managedAffectedWork =
    useMemo(
      () =>
        managedConstraint
          ? getConstraintAffectedWork(
              managedConstraint
            )
          : [],
      [
        managedConstraint,
        getConstraintAffectedWork,
      ]
    );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    useMemo(
      () => {

        return {

          active:
            constraints.filter(
              (constraint) =>
                ACTIVE_CONSTRAINT_STATUSES.includes(
                  constraint.status
                )
            ).length,


          exposed:
            constraints.filter(
              (constraint) =>
                constraint
                  .schedule_exposure_status ===
                'exposed'
            ).length,


          resolved:
            constraints.filter(
              (constraint) =>
                constraint.status ===
                'resolved'
            ).length,


          cleared:
            constraints.filter(
              (constraint) =>
                constraint.status ===
                'cleared'
            ).length,

        };

      },
      [
        constraints,
      ]
    );


  // ==========================================================
  // FILTER OPTIONS
  // ==========================================================

  const categoryOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            constraints
              .map(
                (constraint) =>
                  constraint.category
              )
              .filter(Boolean)
          )
        ),
      [
        constraints,
      ]
    );


  const responsibleOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            constraints
              .map(
                (constraint) =>
                  constraint
                    .responsible_party
              )
              .filter(Boolean)
          )
        ),
      [
        constraints,
      ]
    );


  // ==========================================================
  // FILTERED CONSTRAINTS
  // ==========================================================

  const filteredConstraints =
    useMemo(
      () => {

        const search =
          normalizeText(
            searchTerm
          );


        return constraints.filter(
          (constraint) => {

            if (
              statusFilter &&
              constraint.status !==
              statusFilter
            ) {
              return false;
            }


            if (
              categoryFilter &&
              constraint.category !==
              categoryFilter
            ) {
              return false;
            }


            if (
              priorityFilter &&
              constraint
                .effective_priority !==
              priorityFilter
            ) {
              return false;
            }


            if (
              exposureFilter &&
              constraint
                .schedule_exposure_status !==
              exposureFilter
            ) {
              return false;
            }


            if (
              responsibleFilter &&
              constraint
                .responsible_party !==
              responsibleFilter
            ) {
              return false;
            }


            if (!search) {
              return true;
            }


            const affected =
              getConstraintAffectedWork(
                constraint
              );


            const text =
              [
                getConstraintReference(
                  constraint.id
                ),

                constraint.title,

                constraint.description,

                constraint.category,

                constraint
                  .action_required,

                constraint
                  .responsible_party,

                constraint
                  .base_priority,

                constraint
                  .effective_priority,

                constraint.status,

                constraint
                  .schedule_exposure_status,

                ...affected.map(
                  (item) =>
                    `${item.packageCode} ${item.location}`
                ),
              ].join(' ');


            return normalizeText(
              text
            ).includes(search);

          }
        );

      },
      [
        constraints,
        searchTerm,
        statusFilter,
        categoryFilter,
        priorityFilter,
        exposureFilter,
        responsibleFilter,
        getConstraintAffectedWork,
      ]
    );


  // ==========================================================
  // FORECAST PREVIEW
  // ==========================================================

  const forecastPreview =
    useMemo(
      () => {

        if (
          !managedConstraint ||
          !forecastDate
        ) {
          return null;
        }


        const variance =
          dateDifferenceDays(
            managedConstraint
              .required_by_date,
            forecastDate
          );


        if (
          variance === null
        ) {
          return null;
        }


        return {
          variance,

          delayed:
            variance > 0,

          label:
            getExposureLabel(
              variance
            ),
        };

      },
      [
        managedConstraint,
        forecastDate,
      ]
    );


  const reopenValidation =
    useMemo(
      () => {

        const hasDate =
          Boolean(
            forecastDate
          );


        const hasReason =
          Boolean(
            String(
              managementNote ||
              ''
            ).trim()
          );


        return {
          hasDate,
          hasReason,

          canSubmit:
            hasDate &&
            hasReason,
        };

      },
      [
        forecastDate,
        managementNote,
      ]
    );


  const actionPlanSummary =
    useMemo(
      () => {

        const open =
          recoveryActions.filter(
            (action) =>
              action.status ===
              'open'
          ).length;


        const inProgress =
          recoveryActions.filter(
            (action) =>
              action.status ===
              'in_progress'
          ).length;


        const completed =
          recoveryActions.filter(
            (action) =>
              action.status ===
              'completed'
          ).length;


        const effective =
          recoveryActions.filter(
            (action) =>
              action.effectiveness ===
              'effective'
          ).length;


        const protectionActions =
          recoveryActions.filter(
            (action) =>
              [
                'open',
                'in_progress',
              ].includes(
                action.status
              ) &&
              action.expected_impact ===
              'protect_required_by'
          ).length;


        const active =
          open +
          inProgress;


        const activeDates =
          recoveryActions
            .filter(
              (action) =>
                [
                  'open',
                  'in_progress',
                ].includes(
                  action.status
                )
            )
            .map(
              (action) =>
                action.due_date
            )
            .filter(Boolean)
            .sort();


        return {
          total:
            recoveryActions.length,

          active,

          completed,

          effective,

          protectionActions,

          nextDue:
            activeDates[0] ||
            null,
        };

      },
      [
        recoveryActions,
      ]
    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div style={pageStyle}>

      {/* ======================================================
          PROJECT TOOLBAR
      ====================================================== */}

      <div style={projectToolbarStyle}>

        <div style={projectToolbarLeftStyle}>

          <label
            htmlFor="constraint-project-selector"
            style={projectToolbarLabelStyle}
          >
            Project
          </label>


          <div style={projectSelectStyle}>

            <select
              id="constraint-project-selector"
              value={
                selectedProjectId
              }
              onChange={(
                event
              ) =>
                handleProjectChange(
                  event.target.value
                )
              }
              style={inputStyle}
            >

              <option value="">
                -- Select a Project --
              </option>

              {projects.map(
                (project) => (
                  <option
                    key={
                      project.id
                    }
                    value={
                      project.id
                    }
                  >
                    {project.code
                      ? `${project.code} - `
                      : ''}

                    {project.name}
                  </option>
                )
              )}

            </select>

          </div>


          {selectedProjectId && (
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                loadConstraintLog(
                  selectedProjectId
                )
              }
              style={
                secondaryButtonStyle
              }
            >
              {loading
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          )}

        </div>


        {selectedProjectId && (
          <button
            type="button"
            onClick={
              openCreateModal
            }
            style={
              primaryButtonStyle
            }
          >
            + Add Constraint
          </button>
        )}

      </div>


      {errorMessage && (
        <MessageBox type="error">
          {errorMessage}
        </MessageBox>
      )}


      {successMessage && (
        <MessageBox type="success">
          {successMessage}
        </MessageBox>
      )}


      {selectedProjectId && (
        <>

          {/* ==================================================
              CONSTRAINT OVERVIEW
          ================================================== */}

          <SectionCard
            title="Constraint Overview"
            subtitle="Current readiness, schedule exposure and resolution status."
          >

            <div style={summaryGridStyle}>

              <SummaryCard
                label="Active Constraints"
                value={summary.active}
                description="Still requiring management"
              />

              <SummaryCard
                label="Schedule Exposed"
                value={summary.exposed}
                description="Forecast exceeds Required By"
                alert={
                  summary.exposed >
                  0
                }
              />

              <SummaryCard
                label="Resolved"
                value={summary.resolved}
                description="Awaiting verification"
              />

              <SummaryCard
                label="Cleared"
                value={summary.cleared}
                description="Verified and released"
                positive
              />

            </div>

          </SectionCard>


          {/* ==================================================
              FILTERS
          ================================================== */}

          <SectionCard
            title="Filters"
            subtitle="Narrow the register by status, category, priority, exposure or responsible party."
          >

            <div style={filtersGridStyle}>

              <FilterField label="Search">
                <input
                  value={searchTerm}
                  onChange={(
                    event
                  ) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Constraint, package, location, action..."
                  style={
                    filterInputStyle
                  }
                />
              </FilterField>


              <FilterField label="Status">
                <select
                  value={statusFilter}
                  onChange={(
                    event
                  ) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  style={
                    filterInputStyle
                  }
                >
                  {STATUS_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value ||
                          'all'
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </FilterField>


              <FilterField label="Category">
                <select
                  value={
                    categoryFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setCategoryFilter(
                      event.target.value
                    )
                  }
                  style={
                    filterInputStyle
                  }
                >
                  <option value="">
                    All Categories
                  </option>

                  {categoryOptions.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {formatLabel(
                          category
                        )}
                      </option>
                    )
                  )}
                </select>
              </FilterField>


              <FilterField label="Effective Priority">
                <select
                  value={
                    priorityFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setPriorityFilter(
                      event.target.value
                    )
                  }
                  style={
                    filterInputStyle
                  }
                >

                  <option value="">
                    All Priorities
                  </option>

                  {PRIORITY_OPTIONS.map(
                    (priority) => (
                      <option
                        key={
                          priority.value
                        }
                        value={
                          priority.value
                        }
                      >
                        {priority.label}
                      </option>
                    )
                  )}

                </select>
              </FilterField>


              <FilterField label="Exposure">
                <select
                  value={
                    exposureFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setExposureFilter(
                      event.target.value
                    )
                  }
                  style={
                    filterInputStyle
                  }
                >

                  <option value="">
                    All Exposure
                  </option>

                  <option value="exposed">
                    Exposed
                  </option>

                  <option value="protected">
                    Protected
                  </option>

                </select>
              </FilterField>


              <FilterField label="Responsible">
                <select
                  value={
                    responsibleFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setResponsibleFilter(
                      event.target.value
                    )
                  }
                  style={
                    filterInputStyle
                  }
                >

                  <option value="">
                    All Responsible
                  </option>

                  {responsibleOptions.map(
                    (responsible) => (
                      <option
                        key={responsible}
                        value={responsible}
                      >
                        {responsible}
                      </option>
                    )
                  )}

                </select>
              </FilterField>

            </div>

          </SectionCard>


          {/* ==================================================
              SPLIT WORKSPACE
          ================================================== */}

          <div
            style={{
              ...splitWorkspaceStyle,

              gridTemplateColumns:
                managedConstraint
                  ? 'minmax(0, 1fr) minmax(390px, 36%)'
                  : 'minmax(0, 1fr)',
            }}
          >

            {/* ================================================
                CONSTRAINT REGISTER
            ================================================ */}

            <div style={registerPanelStyle}>

              <div style={registerHeaderStyle}>

                <div>

                  <div style={sectionHeadingStyle}>
                    Constraint Register
                  </div>

                  <div style={sectionSupportingTextStyle}>
                    Review and open constraints requiring project-level management.
                  </div>

                </div>


                <div style={registerCountStyle}>
                  {filteredConstraints.length}{' '}
                  shown
                </div>

              </div>


              <div style={tableContainerStyle}>

                {loading ? (
                  <div style={emptyStyle}>
                    Loading Constraint Log...
                  </div>
                ) : filteredConstraints.length ===
                  0 ? (
                  <div style={emptyStyle}>
                    No constraints found.
                  </div>
                ) : (
                  <table style={tableStyle}>

                    <thead>
                      <tr>
                        {[
                          'REFERENCE',
                          'PACKAGE / LOCATION',
                          'STATUS',
                          'BASE',
                          'EFFECTIVE',
                          'EXPOSURE',
                          'PLANNED RESOLUTION',
                          'RESPONSIBLE',
                          '',
                        ].map(
                          (header) => (
                            <th
                              key={
                                header ||
                                'action'
                              }
                              style={
                                headerCellStyle
                              }
                            >
                              {header}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>


                    <tbody>

                      {filteredConstraints.map(
                        (constraint) => {

                          const affected =
                            getConstraintAffectedWork(
                              constraint
                            );


                          const isSelected =
                            managedConstraint
                              ?.id ===
                            constraint.id;


                          const effectiveAuto =
                            constraint
                              .effective_priority ===
                              'critical' &&
                            constraint
                              .base_priority !==
                              'critical';


                          return (
                            <tr
                              key={
                                constraint.id
                              }
                              onClick={() =>
                                openManagementDrawer(
                                  constraint
                                )
                              }
                              style={{
                                cursor:
                                  'pointer',

                                background:
                                  isSelected
                                    ? '#eff6ff'
                                    : '#ffffff',
                              }}
                            >

                              <td style={leftCellStyle}>

                                <strong>
                                  {getConstraintReference(
                                    constraint.id
                                  )}
                                </strong>


                                <div style={constraintTitleStyle}>
                                  {constraint.title}
                                </div>


                                <div style={inlineBadgesStyle}>

                                  {constraint.blocking && (
                                    <span style={blockingInlineStyle}>
                                      BLOCKING
                                    </span>
                                  )}


                                  <span style={sourceInlineStyle}>
                                    {getSourceLabel(
                                      constraint
                                    )}
                                  </span>

                                </div>

                              </td>


                              <td style={leftCellStyle}>

                                <strong>
                                  {affected[0]
                                    ?.packageCode ||
                                    'Project-level'}
                                </strong>

                                <div style={secondaryTextStyle}>
                                  {affected[0]
                                    ?.location ||
                                    'Project-level'}
                                </div>

                              </td>


                              <td style={bodyCellStyle}>

                                <StatusBadge
                                  label={
                                    getStatusLabel(
                                      constraint.status
                                    )
                                  }
                                  style={
                                    getStatusStyle(
                                      constraint.status
                                    )
                                  }
                                />

                              </td>


                              <td style={bodyCellStyle}>

                                <StatusBadge
                                  label={
                                    formatLabel(
                                      constraint
                                        .base_priority
                                    )
                                  }
                                  style={
                                    getPriorityStyle(
                                      constraint
                                        .base_priority
                                    )
                                  }
                                />

                              </td>


                              <td style={bodyCellStyle}>

                                <div style={effectivePriorityStackStyle}>

                                  <StatusBadge
                                    label={
                                      formatLabel(
                                        constraint
                                          .effective_priority
                                      )
                                    }
                                    style={
                                      getPriorityStyle(
                                        constraint
                                          .effective_priority
                                      )
                                    }
                                  />


                                  {effectiveAuto && (
                                    <span style={autoLabelStyle}>
                                      AUTO
                                    </span>
                                  )}

                                </div>

                              </td>


                              <td style={bodyCellStyle}>

                                <ExposureBadge
                                  status={
                                    constraint
                                      .schedule_exposure_status
                                  }
                                  days={
                                    constraint
                                      .schedule_exposure_days
                                  }
                                />

                              </td>


                              <td style={bodyCellStyle}>

                                <strong>
                                  {formatDate(
                                    constraint
                                      .target_resolution_date ||
                                    constraint
                                      .required_by_date
                                  )}
                                </strong>

                                <div style={secondaryTextStyle}>
                                  Required{' '}
                                  {formatDate(
                                    constraint
                                      .required_by_date
                                  )}
                                </div>

                              </td>


                              <td style={leftCellStyle}>
                                {constraint
                                  .responsible_party ||
                                  '—'}
                              </td>


                              <td style={bodyCellStyle}>

                                <button
                                  type="button"
                                  onClick={(
                                    event
                                  ) => {

                                    event.stopPropagation();

                                    openManagementDrawer(
                                      constraint
                                    );

                                  }}
                                  style={
                                    manageButtonStyle
                                  }
                                >
                                  Manage
                                </button>

                              </td>

                            </tr>
                          );

                        }
                      )}

                    </tbody>

                  </table>
                )}

              </div>

            </div>


            {/* ================================================
                MANAGEMENT DRAWER
            ================================================ */}

            {managedConstraint && (

              <aside style={drawerStyle}>

                <div style={drawerHeaderStyle}>

                  <div>

                    <div style={drawerEyebrowStyle}>
                      CONSTRAINT MANAGEMENT
                    </div>


                    <div style={drawerTitleRowStyle}>

                      <h2 style={drawerTitleStyle}>
                        {getConstraintReference(
                          managedConstraint.id
                        )}
                      </h2>


                      <StatusBadge
                        label={
                          getStatusLabel(
                            managedConstraint.status
                          )
                        }
                        style={
                          getStatusStyle(
                            managedConstraint.status
                          )
                        }
                      />

                    </div>


                    <div style={drawerConstraintTitleStyle}>
                      {managedConstraint.title}
                    </div>


                    <div style={drawerPriorityRowStyle}>

                      <div>
                        <span style={drawerMetaLabelStyle}>
                          Base
                        </span>

                        <StatusBadge
                          label={
                            formatLabel(
                              managedConstraint
                                .base_priority
                            )
                          }
                          style={
                            getPriorityStyle(
                              managedConstraint
                                .base_priority
                            )
                          }
                        />
                      </div>


                      <div>
                        <span style={drawerMetaLabelStyle}>
                          Effective
                        </span>

                        <StatusBadge
                          label={
                            managedConstraint
                              .effective_priority ===
                              'critical' &&
                            managedConstraint
                              .base_priority !==
                              'critical'
                              ? 'Critical · Auto'
                              : formatLabel(
                                  managedConstraint
                                    .effective_priority
                                )
                          }
                          style={
                            getPriorityStyle(
                              managedConstraint
                                .effective_priority
                            )
                          }
                        />
                      </div>


                      {managedConstraint.blocking && (
                        <span style={blockingPillStyle}>
                          BLOCKING
                        </span>
                      )}

                    </div>

                  </div>


                  <button
                    type="button"
                    onClick={
                      closeManagementDrawer
                    }
                    style={
                      closeButtonStyle
                    }
                  >
                    ×
                  </button>

                </div>


                <div style={drawerSummaryStyle}>

                  <DrawerMetric
                    label="Exposure"
                    value={
                      getExposureLabel(
                        managedConstraint
                          .schedule_exposure_days
                      )
                    }
                    alert={
                      managedConstraint
                        .schedule_exposure_status ===
                      'exposed'
                    }
                  />


                  <DrawerMetric
                    label="Outlook"
                    value={
                      getOutlookLabel(
                        managedConstraint
                          .current_outlook
                      )
                    }
                    alert={
                      managedConstraint
                        .schedule_exposure_status ===
                      'exposed'
                    }
                  />


                  <DrawerMetric
                    label="Recovery Actions"
                    value={
                      managedConstraint
                        .total_recovery_actions ??
                      0
                    }
                  />

                </div>


                <div style={drawerTabsStyle}>

                  {DRAWER_TABS.map(
                    (tab) => (
                      <button
                        key={
                          tab.value
                        }
                        type="button"
                        onClick={() =>
                          selectDrawerTab(
                            tab.value
                          )
                        }
                        style={{
                          ...drawerTabStyle,

                          borderBottom:
                            drawerTab ===
                              tab.value
                              ? '2px solid #2563eb'
                              : '2px solid transparent',

                          color:
                            drawerTab ===
                              tab.value
                              ? '#1d4ed8'
                              : '#64748b',

                          background:
                            drawerTab ===
                              tab.value
                              ? '#eff6ff'
                              : '#ffffff',
                        }}
                      >
                        {tab.label}
                      </button>
                    )
                  )}

                </div>


                <div style={drawerBodyStyle}>

                  {historyError && (
                    <MessageBox type="error">
                      {historyError}
                    </MessageBox>
                  )}


                  {/* DETAILS */}

                  {drawerTab ===
                    'details' && (
                    <>

                      <DrawerSection
                        title="Constraint Details"
                        subtitle="Operational ownership and required response."
                      >

                        <ModalField
                          label="Responsible Party"
                        >
                          <input
                            disabled={
                              TERMINAL_CONSTRAINT_STATUSES.includes(
                                managedConstraint.status
                              )
                            }
                            value={
                              managementForm
                                .responsible_party
                            }
                            onChange={(
                              event
                            ) =>
                              setManagementForm(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  responsible_party:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            style={
                              modalInputStyle
                            }
                          />
                        </ModalField>


                        <ModalField
                          label="Base Priority"
                        >
                          <select
                            disabled={
                              TERMINAL_CONSTRAINT_STATUSES.includes(
                                managedConstraint.status
                              )
                            }
                            value={
                              managementForm
                                .priority
                            }
                            onChange={(
                              event
                            ) =>
                              setManagementForm(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  priority:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            style={
                              modalInputStyle
                            }
                          >
                            {PRIORITY_OPTIONS.map(
                              (
                                option
                              ) => (
                                <option
                                  key={
                                    option.value
                                  }
                                  value={
                                    option.value
                                  }
                                >
                                  {option.label}
                                </option>
                              )
                            )}
                          </select>
                        </ModalField>


                        {managedConstraint
                          .effective_priority ===
                          'critical' &&
                          managedConstraint
                            .base_priority !==
                            'critical' && (
                          <div style={autoPriorityNoticeStyle}>
                            Effective Priority is currently <strong>Critical</strong> because Planned Resolution exceeds Required By. Base Priority remains unchanged.
                          </div>
                        )}


                        <ModalField
                          label="Required Action"
                        >
                          <textarea
                            disabled={
                              TERMINAL_CONSTRAINT_STATUSES.includes(
                                managedConstraint.status
                              )
                            }
                            value={
                              managementForm
                                .action_required
                            }
                            onChange={(
                              event
                            ) =>
                              setManagementForm(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  action_required:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            style={
                              modalTextareaStyle
                            }
                          />
                        </ModalField>


                        <ModalField
                          label="Description"
                        >
                          <textarea
                            disabled={
                              TERMINAL_CONSTRAINT_STATUSES.includes(
                                managedConstraint.status
                              )
                            }
                            value={
                              managementForm
                                .description
                            }
                            onChange={(
                              event
                            ) =>
                              setManagementForm(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  description:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            style={
                              modalTextareaStyle
                            }
                          />
                        </ModalField>


                        {!TERMINAL_CONSTRAINT_STATUSES.includes(
                          managedConstraint.status
                        ) && (
                          <>

                            <label style={checkboxStyle}>

                              <input
                                type="checkbox"
                                checked={
                                  managementForm
                                    .blocking
                                }
                                onChange={(
                                  event
                                ) =>
                                  setManagementForm(
                                    (
                                      current
                                    ) => ({
                                      ...current,

                                      blocking:
                                        event
                                          .target
                                          .checked,
                                    })
                                  )
                                }
                              />

                              Blocking Constraint

                            </label>


                            <ModalField
                              label="Reason / Comment for Changes"
                            >
                              <textarea
                                value={
                                  managementForm
                                    .comment
                                }
                                onChange={(
                                  event
                                ) =>
                                  setManagementForm(
                                    (
                                      current
                                    ) => ({
                                      ...current,

                                      comment:
                                        event
                                          .target
                                          .value,
                                    })
                                  )
                                }
                                style={
                                  smallTextareaStyle
                                }
                              />
                            </ModalField>


                            <div style={rightActionsStyle}>

                              <button
                                type="button"
                                disabled={
                                  savingDetails
                                }
                                onClick={
                                  saveManagementDetails
                                }
                                style={
                                  primaryButtonStyle
                                }
                              >
                                {savingDetails
                                  ? 'Saving...'
                                  : 'Save Details'}
                              </button>

                            </div>

                          </>
                        )}

                      </DrawerSection>


                      <DrawerSection
                        title="Status Management"
                        subtitle={`Current Status: ${getStatusLabel(
                          managedConstraint.status
                        )}`}
                      >

                        <div style={lifecycleFlowStyle}>

                          <LifecycleStage
                            label="Open"
                            active={
                              managedConstraint
                                .status ===
                              'open'
                            }
                          />

                          <span style={lifecycleArrowStyle}>
                            →
                          </span>

                          <LifecycleStage
                            label="In Progress"
                            active={
                              managedConstraint
                                .status ===
                              'in_progress'
                            }
                          />

                          <span style={lifecycleArrowStyle}>
                            ↔
                          </span>

                          <LifecycleStage
                            label="Waiting"
                            active={
                              managedConstraint
                                .status ===
                              'waiting'
                            }
                          />

                          <span style={lifecycleArrowStyle}>
                            →
                          </span>

                          <LifecycleStage
                            label="Resolved"
                            active={
                              managedConstraint
                                .status ===
                              'resolved'
                            }
                          />

                          <span style={lifecycleArrowStyle}>
                            →
                          </span>

                          <LifecycleStage
                            label="Cleared"
                            active={
                              managedConstraint
                                .status ===
                              'cleared'
                            }
                          />

                        </div>


                        <div style={lifecycleButtonsGridStyle}>

                          {managedConstraint
                            .status ===
                            'open' && (
                            <LifecycleButton
                              label="Start"
                              description="Begin active management"
                              onClick={() =>
                                toggleManagementPanel(
                                  'start'
                                )
                              }
                            />
                          )}


                          {managedConstraint
                            .status ===
                            'in_progress' && (
                            <>
                              <LifecycleButton
                                label="Set Waiting"
                                description="Temporarily blocked"
                                onClick={() =>
                                  toggleManagementPanel(
                                    'waiting'
                                  )
                                }
                              />

                              <LifecycleButton
                                label="Resolve"
                                description="Problem solved"
                                emphasis
                                onClick={() =>
                                  toggleManagementPanel(
                                    'resolve'
                                  )
                                }
                              />
                            </>
                          )}


                          {managedConstraint
                            .status ===
                            'waiting' && (
                            <>
                              <LifecycleButton
                                label="Resume"
                                description="Continue management"
                                onClick={() =>
                                  toggleManagementPanel(
                                    'resume'
                                  )
                                }
                              />

                              <LifecycleButton
                                label="Resolve"
                                description="Problem solved"
                                emphasis
                                onClick={() =>
                                  toggleManagementPanel(
                                    'resolve'
                                  )
                                }
                              />
                            </>
                          )}


                          {managedConstraint
                            .status ===
                            'resolved' && (
                            <>
                              <LifecycleButton
                                label="Verify & Clear"
                                description="Release readiness"
                                emphasis
                                onClick={() =>
                                  toggleManagementPanel(
                                    'clear'
                                  )
                                }
                              />

                              <LifecycleButton
                                label="Reopen"
                                description="Problem remains"
                                warning
                                onClick={() => {

                                  setDrawerTab(
                                    'forecast'
                                  );

                                  toggleManagementPanel(
                                    'reopen'
                                  );

                                }}
                              />
                            </>
                          )}


                          {ACTIVE_CONSTRAINT_STATUSES.includes(
                            managedConstraint.status
                          ) && (
                            <LifecycleButton
                              label="Cancel"
                              description="No longer applicable"
                              danger
                              onClick={() =>
                                toggleManagementPanel(
                                  'cancel'
                                )
                              }
                            />
                          )}

                        </div>


                        {activeManagementPanel ===
                          'start' && (
                          <LifecycleActionPanel
                            title="Start Constraint Resolution"
                            description="Move this constraint from Open to In Progress."
                            label="Optional Comment"
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel="Start"
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'start'
                              )
                            }
                          />
                        )}


                        {activeManagementPanel ===
                          'waiting' && (
                          <LifecycleActionPanel
                            title="Set Waiting"
                            description="Explain what is temporarily preventing resolution."
                            label="Reason for Waiting *"
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel="Set Waiting"
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'waiting'
                              )
                            }
                          />
                        )}


                        {activeManagementPanel ===
                          'resume' && (
                          <LifecycleActionPanel
                            title="Resume Constraint"
                            description="Return the constraint to active management."
                            label="Optional Comment"
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel="Resume"
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'resume'
                              )
                            }
                          />
                        )}


                        {activeManagementPanel ===
                          'resolve' && (
                          <LifecycleActionPanel
                            title="Resolve Constraint"
                            description="The underlying problem has been solved. Verification is still required."
                            label="Resolution Note *"
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel="Mark Resolved"
                            positive
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'resolve'
                              )
                            }
                          />
                        )}


                        {activeManagementPanel ===
                          'clear' && (
                          <LifecycleActionPanel
                            title="Verify & Clear"
                            description="Confirm the resolution and release the readiness condition."
                            label="Verification Note *"
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel="Verify & Clear"
                            positive
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'clear'
                              )
                            }
                          />
                        )}


                        {activeManagementPanel ===
                          'cancel' && (
                          <LifecycleActionPanel
                            title="Cancel Constraint"
                            description="Use when the constraint is no longer applicable."
                            label="Cancellation Reason *"
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel="Cancel Constraint"
                            danger
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'cancel'
                              )
                            }
                          />
                        )}

                      </DrawerSection>


                      <DrawerSection
                        title="Management Update"
                        subtitle="Record progress without changing status."
                      >

                        <textarea
                          value={
                            activeManagementPanel ===
                              'comment'
                              ? managementNote
                              : ''
                          }
                          placeholder="Add a progress update..."
                          onFocus={() => {

                            setActiveManagementPanel(
                              'comment'
                            );

                          }}
                          onChange={(
                            event
                          ) => {

                            setActiveManagementPanel(
                              'comment'
                            );

                            setManagementNote(
                              event.target.value
                            );

                          }}
                          style={
                            smallTextareaStyle
                          }
                        />


                        <div style={rightActionsStyle}>

                          <button
                            type="button"
                            disabled={
                              activeManagementPanel !==
                                'comment' ||
                              savingAction
                            }
                            onClick={
                              addManagementComment
                            }
                            style={
                              secondaryActionButtonStyle
                            }
                          >
                            Add Comment
                          </button>

                        </div>

                      </DrawerSection>

                    </>
                  )}


                  {/* FORECAST */}

                  {drawerTab ===
                    'forecast' && (
                    <DrawerSection
                      title="Resolution Forecast"
                      subtitle="Forecast versus the date required to protect the plan."
                    >

                      <div style={forecastStackStyle}>

                        <ForecastCard
                          label="Required By"
                          value={
                            formatDate(
                              managedConstraint
                                .required_by_date
                            )
                          }
                          description="Date required by production"
                        />


                        <ForecastCard
                          label="Planned Resolution"
                          value={
                            formatDate(
                              managedConstraint
                                .target_resolution_date ||
                              managedConstraint
                                .required_by_date
                            )
                          }
                          description="Current expected resolution"
                        />


                        <ForecastCard
                          label="Schedule Exposure"
                          value={
                            getExposureLabel(
                              managedConstraint
                                .schedule_exposure_days
                            )
                          }
                          description={
                            managedConstraint
                              .schedule_exposure_status ===
                              'exposed'
                              ? 'Production plan is currently exposed'
                              : 'Current forecast protects the Required By date'
                          }
                          alert={
                            managedConstraint
                              .schedule_exposure_status ===
                            'exposed'
                          }
                        />


                        <ForecastCard
                          label="Current Outlook"
                          value={
                            getOutlookLabel(
                              managedConstraint
                                .current_outlook
                            )
                          }
                          description="Current management position"
                          alert={
                            managedConstraint
                              .schedule_exposure_status ===
                            'exposed'
                          }
                        />

                      </div>


                      {managedConstraint
                        .schedule_exposure_status ===
                        'exposed' && (
                        <div style={criticalEscalationStyle}>

                          <div>

                            <strong>
                              Automatic Priority Escalation
                            </strong>

                            <div style={noticeTextStyle}>
                              Planned Resolution exceeds Required By, so Effective Priority is automatically Critical.
                            </div>

                          </div>


                          <StatusBadge
                            label="Critical · Auto"
                            style={
                              getPriorityStyle(
                                'critical'
                              )
                            }
                          />

                        </div>
                      )}


                      {[
                        'open',
                        'in_progress',
                        'waiting',
                      ].includes(
                        managedConstraint.status
                      ) && (
                        <button
                          type="button"
                          onClick={() =>
                            toggleManagementPanel(
                              'forecast'
                            )
                          }
                          style={
                            forecastButtonStyle
                          }
                        >
                          Update Forecast
                        </button>
                      )}


                      {activeManagementPanel ===
                        'forecast' && (
                        <ActionPanel
                          title="Update Planned Resolution"
                          description="A reason is mandatory whenever the Planned Resolution Date changes."
                        >

                          <ForecastDateFields
                            requiredBy={
                              managedConstraint
                                .required_by_date
                            }
                            date={
                              forecastDate
                            }
                            setDate={
                              setForecastDate
                            }
                            preview={
                              forecastPreview
                            }
                          />


                          <ModalField
                            label="Reason for Date Change *"
                          >
                            <textarea
                              value={
                                managementNote
                              }
                              onChange={(
                                event
                              ) =>
                                setManagementNote(
                                  event.target.value
                                )
                              }
                              placeholder="Explain why the forecast is changing."
                              style={
                                smallTextareaStyle
                              }
                            />
                          </ModalField>


                          <div style={warningBoxStyle}>
                            Required By remains unchanged. Previous date, new date and reason will be retained in Action History.
                          </div>


                          <ActionButtons
                            saving={
                              savingAction
                            }
                            confirmLabel="Confirm Forecast Update"
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={
                              updateForecast
                            }
                          />

                        </ActionPanel>
                      )}


                      {managedConstraint
                        .status ===
                        'resolved' && (
                        <button
                          type="button"
                          onClick={() =>
                            toggleManagementPanel(
                              'reopen'
                            )
                          }
                          style={
                            reopenButtonStyle
                          }
                        >
                          Reopen Constraint
                        </button>
                      )}


                      {activeManagementPanel ===
                        'reopen' && (
                        <ActionPanel
                          title="Reopen Constraint"
                          description="Use this when the previously reported resolution was unsuccessful."
                        >

                          <div style={reopenNoticeStyle}>
                            Status will change from <strong>Resolved</strong> to <strong>In Progress</strong>. Required By remains unchanged.
                          </div>


                          <ForecastDateFields
                            requiredBy={
                              managedConstraint
                                .required_by_date
                            }
                            date={
                              forecastDate
                            }
                            setDate={(
                              value
                            ) => {

                              setForecastDate(
                                value
                              );

                              if (value) {
                                setHistoryError('');
                              }

                            }}
                            preview={
                              forecastPreview
                            }
                          />


                          <ModalField
                            label="Reason for Reopening and Date Change *"
                          >
                            <textarea
                              value={
                                managementNote
                              }
                              onChange={(
                                event
                              ) => {

                                const value =
                                  event
                                    .target
                                    .value;


                                setManagementNote(
                                  value
                                );


                                if (
                                  value.trim()
                                ) {
                                  setHistoryError('');
                                }

                              }}
                              placeholder="Example: Supplier did not deliver on the previously confirmed date."
                              style={
                                smallTextareaStyle
                              }
                            />


                            {!reopenValidation
                              .hasReason && (
                              <div style={inlineValidationStyle}>
                                A reason is required.
                              </div>
                            )}

                          </ModalField>


                          <div style={reopenTransitionStyle}>

                            <div>
                              <div style={metaLabelStyle}>
                                Current Status
                              </div>

                              <strong>
                                Resolved
                              </strong>
                            </div>


                            <div style={reopenArrowStyle}>
                              →
                            </div>


                            <div>
                              <div style={metaLabelStyle}>
                                New Status
                              </div>

                              <strong
                                style={{
                                  color:
                                    '#1d4ed8',
                                }}
                              >
                                In Progress
                              </strong>
                            </div>

                          </div>


                          <div style={rightActionsStyle}>

                            <button
                              type="button"
                              onClick={() => {

                                setActiveManagementPanel(
                                  null
                                );

                                setManagementNote('');

                                setHistoryError('');

                              }}
                              style={
                                secondaryButtonStyle
                              }
                            >
                              Cancel
                            </button>


                            <button
                              type="button"
                              disabled={
                                savingAction ||
                                !reopenValidation
                                  .canSubmit
                              }
                              onClick={
                                reopenConstraint
                              }
                              style={{
                                ...warningPrimaryButtonStyle,

                                opacity:
                                  savingAction ||
                                  !reopenValidation
                                    .canSubmit
                                    ? 0.45
                                    : 1,

                                cursor:
                                  savingAction ||
                                  !reopenValidation
                                    .canSubmit
                                    ? 'not-allowed'
                                    : 'pointer',
                              }}
                            >
                              {savingAction
                                ? 'Reopening...'
                                : 'Confirm Reopen'}
                            </button>

                          </div>

                        </ActionPanel>
                      )}

                    </DrawerSection>
                  )}


                  {/* ACTION PLAN */}

                  {drawerTab ===
                    'actions' && (
                    <DrawerSection
                      title="Recovery Action Plan"
                      subtitle="Management responses designed to eliminate or reduce the constraint's effect."
                    >

                      <div style={actionSummaryGridStyle}>

                        <MiniSummary
                          label="Total"
                          value={
                            actionPlanSummary
                              .total
                          }
                        />

                        <MiniSummary
                          label="Active"
                          value={
                            actionPlanSummary
                              .active
                          }
                        />

                        <MiniSummary
                          label="Completed"
                          value={
                            actionPlanSummary
                              .completed
                          }
                        />

                        <MiniSummary
                          label="Effective"
                          value={
                            actionPlanSummary
                              .effective
                          }
                        />

                        <MiniSummary
                          label="Plan Protection"
                          value={
                            actionPlanSummary
                              .protectionActions
                          }
                        />

                        <MiniSummary
                          label="Next Due"
                          value={
                            formatDate(
                              actionPlanSummary
                                .nextDue
                            )
                          }
                        />

                      </div>


                      {!TERMINAL_CONSTRAINT_STATUSES.includes(
                        managedConstraint.status
                      ) && (
                        <button
                          type="button"
                          onClick={() => {

                            setRecoveryActionForm(
                              createRecoveryActionForm()
                            );

                            setRecoveryActionPanel(
                              recoveryActionPanel ===
                                'create'
                                ? null
                                : 'create'
                            );

                            setSelectedRecoveryActionId(
                              null
                            );

                            setHistoryError('');

                          }}
                          style={
                            addRecoveryButtonStyle
                          }
                        >
                          + Add Recovery Action
                        </button>
                      )}


                      {recoveryActionPanel ===
                        'create' && (
                        <ActionPanel
                          title="New Recovery Action"
                          description="Define a specific action intended to protect or recover the production plan."
                        >

                          <ModalField
                            label="Response Approach"
                          >
                            <select
                              value={
                                recoveryActionForm
                                  .response_approach
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    response_approach:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              style={
                                modalInputStyle
                              }
                            >
                              {RESPONSE_APPROACH_OPTIONS.map(
                                (
                                  option
                                ) => (
                                  <option
                                    key={
                                      option.value
                                    }
                                    value={
                                      option.value
                                    }
                                  >
                                    {option.label}
                                  </option>
                                )
                              )}
                            </select>
                          </ModalField>


                          <ModalField
                            label="Recovery Action *"
                          >
                            <input
                              value={
                                recoveryActionForm
                                  .action_title
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    action_title:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              placeholder="Example: Purchase from alternate supplier."
                              style={
                                modalInputStyle
                              }
                            />
                          </ModalField>


                          <ModalField
                            label="Action Description"
                          >
                            <textarea
                              value={
                                recoveryActionForm
                                  .action_description
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    action_description:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              style={
                                smallTextareaStyle
                              }
                            />
                          </ModalField>


                          <ModalField
                            label="Responsible Party *"
                          >
                            <input
                              value={
                                recoveryActionForm
                                  .responsible_party
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    responsible_party:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              placeholder="Example: Procurement"
                              style={
                                modalInputStyle
                              }
                            />
                          </ModalField>


                          <ModalField
                            label="Action Due Date *"
                          >
                            <input
                              type="date"
                              value={
                                recoveryActionForm
                                  .due_date
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    due_date:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              style={
                                modalInputStyle
                              }
                            />
                          </ModalField>


                          <ModalField
                            label="Expected Impact"
                          >
                            <select
                              value={
                                recoveryActionForm
                                  .expected_impact
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    expected_impact:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              style={
                                modalInputStyle
                              }
                            >
                              {EXPECTED_IMPACT_OPTIONS.map(
                                (
                                  option
                                ) => (
                                  <option
                                    key={
                                      option.value
                                    }
                                    value={
                                      option.value
                                    }
                                  >
                                    {option.label}
                                  </option>
                                )
                              )}
                            </select>
                          </ModalField>


                          <ActionButtons
                            saving={
                              savingRecoveryAction
                            }
                            confirmLabel="Add Recovery Action"
                            onCancel={() =>
                              setRecoveryActionPanel(
                                null
                              )
                            }
                            onConfirm={
                              createRecoveryAction
                            }
                          />

                        </ActionPanel>
                      )}


                      {loadingRecoveryActions ? (
                        <div style={emptyInnerStyle}>
                          Loading Action Plan...
                        </div>
                      ) : recoveryActions.length ===
                        0 ? (
                        <div style={actionPlanEmptyStyle}>

                          <strong>
                            No recovery actions yet.
                          </strong>

                          <div style={emptyDescriptionStyle}>
                            Create an Action Plan when management can eliminate, reduce or recover the constraint's effect.
                          </div>

                        </div>
                      ) : (
                        <div style={recoveryActionListStyle}>

                          {recoveryActions.map(
                            (action) => (
                              <RecoveryActionCard
                                key={
                                  action.id
                                }
                                action={
                                  action
                                }
                                selected={
                                  selectedRecoveryActionId ===
                                  action.id
                                }
                                activePanel={
                                  recoveryActionPanel
                                }
                                note={
                                  recoveryActionNote
                                }
                                setNote={
                                  setRecoveryActionNote
                                }
                                effectiveness={
                                  effectivenessValue
                                }
                                setEffectiveness={
                                  setEffectivenessValue
                                }
                                saving={
                                  savingRecoveryAction
                                }
                                onOpenPanel={
                                  openRecoveryActionPanel
                                }
                                onClosePanel={
                                  closeRecoveryActionPanel
                                }
                                onStart={
                                  startRecoveryAction
                                }
                                onComplete={
                                  completeRecoveryAction
                                }
                                onEvaluate={
                                  evaluateRecoveryAction
                                }
                                onCancel={
                                  cancelRecoveryAction
                                }
                              />
                            )
                          )}

                        </div>
                      )}

                    </DrawerSection>
                  )}


                  {/* AFFECTED WORK */}

                  {drawerTab ===
                    'work' && (
                    <DrawerSection
                      title="Affected Work"
                      subtitle={`${managedAffectedWork.length} linked work item${managedAffectedWork.length === 1 ? '' : 's'}`}
                    >

                      {managedAffectedWork.length ===
                        0 ? (
                        <div style={emptyInnerStyle}>
                          This is currently a project-level constraint.
                        </div>
                      ) : (
                        managedAffectedWork.map(
                          (item) => (
                            <div
                              key={
                                item.key
                              }
                              style={
                                affectedCardStyle
                              }
                            >

                              <div style={affectedHeaderStyle}>

                                <strong>
                                  {item.packageCode}

                                  {item.serviceName
                                    ? ` · ${item.serviceName}`
                                    : ''}
                                </strong>


                                <span style={sourceBadgeStyle}>
                                  {item.type}
                                </span>

                              </div>


                              <div style={affectedLocationStyle}>
                                {item.location}
                              </div>


                              <div style={affectedDateStyle}>
                                {formatDate(
                                  item.startDate
                                )}

                                {' → '}

                                {formatDate(
                                  item.finishDate
                                )}
                              </div>

                            </div>
                          )
                        )
                      )}

                    </DrawerSection>
                  )}


                  {/* HISTORY */}

                  {drawerTab ===
                    'history' && (
                    <DrawerSection
                      title="Action History"
                      subtitle="Read-only audit trail of constraint decisions, forecast changes and recovery actions."
                    >

                      {loadingHistory ? (
                        <div style={emptyInnerStyle}>
                          Loading Action History...
                        </div>
                      ) : constraintHistory.length ===
                        0 ? (
                        <div style={emptyInnerStyle}>
                          No Action History recorded yet.
                        </div>
                      ) : (
                        constraintHistory.map(
                          (entry) => (
                            <HistoryEntry
                              key={
                                entry.id
                              }
                              entry={
                                entry
                              }
                            />
                          )
                        )
                      )}

                    </DrawerSection>
                  )}

                </div>


                <div style={drawerFooterStyle}>

                  <div style={footerMetaStyle}>
                    {getConstraintReference(
                      managedConstraint.id
                    )}

                    {' · '}

                    {getSourceLabel(
                      managedConstraint
                    )}
                  </div>


                  <button
                    type="button"
                    onClick={
                      closeManagementDrawer
                    }
                    style={
                      secondaryButtonStyle
                    }
                  >
                    Close
                  </button>

                </div>

              </aside>
            )}

          </div>

        </>
      )}


      {/* ======================================================
          CREATE MODAL
      ====================================================== */}

      {showCreateModal && (

        <div style={modalOverlayStyle}>

          <div style={createModalStyle}>

            <div style={createModalHeaderStyle}>

              <div>

                <div style={drawerEyebrowStyle}>
                  PROJECT CONSTRAINT
                </div>

                <h2 style={createModalTitleStyle}>
                  Add Constraint
                </h2>

              </div>


              <button
                type="button"
                onClick={() =>
                  setShowCreateModal(
                    false
                  )
                }
                style={
                  closeButtonStyle
                }
              >
                ×
              </button>

            </div>


            <form
              onSubmit={
                createConstraint
              }
              style={createFormStyle}
            >

              <ModalField
                label="Category"
              >
                <select
                  value={
                    createForm.category
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,

                        category:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalInputStyle
                  }
                >
                  {CATEGORY_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </ModalField>


              <ModalField
                label="Base Priority"
              >
                <select
                  value={
                    createForm.priority
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,

                        priority:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalInputStyle
                  }
                >
                  {PRIORITY_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </ModalField>


              <ModalField
                label="What is blocking the work? *"
              >
                <input
                  value={
                    createForm.title
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,

                        title:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalInputStyle
                  }
                />
              </ModalField>


              <ModalField
                label="Responsible Party *"
              >
                <input
                  value={
                    createForm
                      .responsible_party
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,

                        responsible_party:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalInputStyle
                  }
                />
              </ModalField>


              <ModalField
                label="Required By Date *"
              >
                <input
                  type="date"
                  value={
                    createForm
                      .required_by_date
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,

                        required_by_date:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalInputStyle
                  }
                />
              </ModalField>


              <ModalField
                label="Required Action *"
              >
                <textarea
                  value={
                    createForm
                      .action_required
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,

                        action_required:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalTextareaStyle
                  }
                />
              </ModalField>


              <ModalField
                label="Notes"
              >
                <textarea
                  value={
                    createForm
                      .description
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,

                        description:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalTextareaStyle
                  }
                />
              </ModalField>


              <label style={checkboxStyle}>

                <input
                  type="checkbox"
                  checked={
                    createForm.blocking
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,

                        blocking:
                          event
                            .target
                            .checked,
                      })
                    )
                  }
                />

                Blocking Constraint

              </label>


              <div style={rightActionsStyle}>

                <button
                  type="button"
                  onClick={() =>
                    setShowCreateModal(
                      false
                    )
                  }
                  style={
                    secondaryButtonStyle
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  disabled={
                    creatingConstraint
                  }
                  style={
                    primaryButtonStyle
                  }
                >
                  {creatingConstraint
                    ? 'Creating...'
                    : 'Create Constraint'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}


// ============================================================
// COMPONENTS
// ============================================================

function SectionCard({
  title,
  subtitle,
  children,
}) {

  return (
    <section style={sectionCardStyle}>

      <div style={sectionHeaderStyle}>

        <div style={sectionHeadingStyle}>
          {title}
        </div>

        {subtitle && (
          <div style={sectionSupportingTextStyle}>
            {subtitle}
          </div>
        )}

      </div>


      <div style={sectionContentStyle}>
        {children}
      </div>

    </section>
  );
}


function SummaryCard({
  label,
  value,
  description,
  alert,
  positive,
}) {

  return (
    <div
      style={{
        ...summaryCardStyle,

        borderColor:
          alert
            ? '#fecaca'
            : positive
              ? '#bbf7d0'
              : '#e2e8f0',

        background:
          alert
            ? '#fff7f7'
            : positive
              ? '#f7fef9'
              : '#ffffff',
      }}
    >

      <div style={summaryLabelStyle}>
        {label}
      </div>

      <div
        style={{
          ...summaryValueStyle,

          color:
            alert
              ? '#b91c1c'
              : positive
                ? '#166534'
                : '#0f172a',
        }}
      >
        {value}
      </div>

      <div style={summaryDescriptionStyle}>
        {description}
      </div>

    </div>
  );
}


function DrawerMetric({
  label,
  value,
  alert,
}) {

  return (
    <div
      style={{
        ...drawerMetricStyle,

        background:
          alert
            ? '#fff7f7'
            : '#f8fafc',

        borderColor:
          alert
            ? '#fecaca'
            : '#e2e8f0',
      }}
    >

      <div style={metaLabelStyle}>
        {label}
      </div>

      <div
        style={{
          marginTop:
            '5px',

          color:
            alert
              ? '#b91c1c'
              : '#0f172a',

          fontSize:
            '14px',

          fontWeight:
            900,
        }}
      >
        {value}
      </div>

    </div>
  );
}


function MiniSummary({
  label,
  value,
}) {

  return (
    <div style={miniSummaryStyle}>

      <div style={metaLabelStyle}>
        {label}
      </div>

      <div style={miniSummaryValueStyle}>
        {value ?? '—'}
      </div>

    </div>
  );
}


function FilterField({
  label,
  children,
}) {

  return (
    <div>

      <label style={filterLabelStyle}>
        {label}
      </label>

      {children}

    </div>
  );
}


function ModalField({
  label,
  children,
}) {

  return (
    <div style={fieldStyle}>

      <label style={modalLabelStyle}>
        {label}
      </label>

      {children}

    </div>
  );
}


function DrawerSection({
  title,
  subtitle,
  children,
}) {

  return (
    <section style={drawerSectionStyle}>

      <div style={drawerSectionHeadingStyle}>
        {title}
      </div>

      {subtitle && (
        <div style={drawerSectionSupportingTextStyle}>
          {subtitle}
        </div>
      )}

      <div style={sectionBodyStyle}>
        {children}
      </div>

    </section>
  );
}


function ForecastCard({
  label,
  value,
  description,
  alert,
}) {

  return (
    <div
      style={{
        ...forecastCardStyle,

        background:
          alert
            ? '#fff7f7'
            : '#f8fafc',

        borderColor:
          alert
            ? '#fecaca'
            : '#e2e8f0',
      }}
    >

      <div style={metaLabelStyle}>
        {label}
      </div>

      <div
        style={{
          marginTop:
            '5px',

          color:
            alert
              ? '#b91c1c'
              : '#0f172a',

          fontSize:
            '15px',

          fontWeight:
            900,
        }}
      >
        {value}
      </div>

      <div style={forecastDescriptionStyle}>
        {description}
      </div>

    </div>
  );
}


function ForecastDateFields({
  requiredBy,
  date,
  setDate,
  preview,
}) {

  return (
    <>

      <ModalField
        label="New Planned Resolution Date *"
      >
        <input
          type="date"
          value={date}
          onChange={(
            event
          ) =>
            setDate(
              event.target.value
            )
          }
          style={
            modalInputStyle
          }
        />
      </ModalField>


      <div
        style={
          preview?.delayed
            ? delayAssessmentStyle
            : safeAssessmentStyle
        }
      >

        <div style={metaLabelStyle}>
          Schedule Exposure
        </div>

        <strong>
          {preview?.label ||
            'Select a date'}
        </strong>

        <div style={helperTextStyle}>
          Required By:{' '}
          {formatDate(
            requiredBy
          )}
        </div>

      </div>

    </>
  );
}


function StatusBadge({
  label,
  style,
}) {

  return (
    <span
      style={{
        ...badgeBaseStyle,

        background:
          style.background,

        border:
          `1px solid ${style.border}`,

        color:
          style.color,
      }}
    >
      {label}
    </span>
  );
}


function ExposureBadge({
  status,
  days,
}) {

  const exposed =
    status ===
    'exposed';


  return (
    <div
      style={{
        ...exposureBadgeStyle,

        borderColor:
          exposed
            ? '#fecaca'
            : '#bbf7d0',

        background:
          exposed
            ? '#fef2f2'
            : '#f0fdf4',

        color:
          exposed
            ? '#b91c1c'
            : '#166534',
      }}
    >

      <strong>
        {getExposureLabel(
          days
        )}
      </strong>

      <span style={exposureStatusTextStyle}>
        {exposed
          ? 'EXPOSED'
          : 'PROTECTED'}
      </span>

    </div>
  );
}


function LifecycleStage({
  label,
  active,
}) {

  return (
    <span
      style={{
        ...lifecycleStageStyle,

        borderColor:
          active
            ? '#2563eb'
            : '#e2e8f0',

        background:
          active
            ? '#eff6ff'
            : '#ffffff',

        color:
          active
            ? '#1d4ed8'
            : '#64748b',

        fontWeight:
          active
            ? 900
            : 700,
      }}
    >
      {label}
    </span>
  );
}


function LifecycleButton({
  label,
  description,
  onClick,
  emphasis,
  warning,
  danger,
}) {

  let background =
    '#ffffff';

  let border =
    '#cbd5e1';

  let color =
    '#334155';


  if (emphasis) {
    background =
      '#f0fdf4';

    border =
      '#86efac';

    color =
      '#166534';
  }


  if (warning) {
    background =
      '#fff7ed';

    border =
      '#fdba74';

    color =
      '#9a3412';
  }


  if (danger) {
    background =
      '#fef2f2';

    border =
      '#fecaca';

    color =
      '#b91c1c';
  }


  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...lifecycleButtonStyle,

        background,

        border:
          `1px solid ${border}`,

        color,
      }}
    >

      <strong>
        {label}
      </strong>

      <span style={lifecycleDescriptionStyle}>
        {description}
      </span>

    </button>
  );
}


function ActionPanel({
  title,
  description,
  children,
}) {

  return (
    <div style={actionPanelStyle}>

      <div style={actionPanelTitleStyle}>
        {title}
      </div>

      <div style={actionPanelDescriptionStyle}>
        {description}
      </div>

      <div style={actionPanelBodyStyle}>
        {children}
      </div>

    </div>
  );
}


function LifecycleActionPanel({
  title,
  description,
  label,
  value,
  setValue,
  saving,
  confirmLabel,
  onCancel,
  onConfirm,
  positive,
  danger,
}) {

  return (
    <ActionPanel
      title={title}
      description={description}
    >

      <ModalField
        label={label}
      >
        <textarea
          value={value}
          onChange={(
            event
          ) =>
            setValue(
              event.target.value
            )
          }
          style={
            smallTextareaStyle
          }
        />
      </ModalField>


      <ActionButtons
        saving={saving}
        confirmLabel={
          confirmLabel
        }
        onCancel={onCancel}
        onConfirm={onConfirm}
        positive={positive}
        danger={danger}
      />

    </ActionPanel>
  );
}


function ActionButtons({
  saving,
  confirmLabel,
  onCancel,
  onConfirm,
  positive,
  warning,
  danger,
}) {

  let style =
    primaryButtonStyle;


  if (positive) {
    style =
      successPrimaryButtonStyle;
  }


  if (warning) {
    style =
      warningPrimaryButtonStyle;
  }


  if (danger) {
    style =
      dangerPrimaryButtonStyle;
  }


  return (
    <div style={rightActionsStyle}>

      <button
        type="button"
        onClick={onCancel}
        style={
          secondaryButtonStyle
        }
      >
        Cancel
      </button>


      <button
        type="button"
        disabled={saving}
        onClick={onConfirm}
        style={style}
      >
        {saving
          ? 'Processing...'
          : confirmLabel}
      </button>

    </div>
  );
}


function RecoveryActionCard({
  action,
  selected,
  activePanel,
  note,
  setNote,
  effectiveness,
  setEffectiveness,
  saving,
  onOpenPanel,
  onClosePanel,
  onStart,
  onComplete,
  onEvaluate,
  onCancel,
}) {

  return (
    <div style={recoveryActionCardStyle}>

      <div style={recoveryActionHeaderStyle}>

        <div>

          <div style={recoveryActionTitleRowStyle}>

            <strong>
              {action.action_title}
            </strong>


            <StatusBadge
              label={
                getStatusLabel(
                  action.status
                )
              }
              style={
                getStatusStyle(
                  action.status
                )
              }
            />

          </div>


          <div style={recoveryActionApproachStyle}>
            {formatLabel(
              action
                .response_approach
            )}

            {' · '}

            {formatLabel(
              action
                .expected_impact
            )}
          </div>

        </div>


        <div style={recoveryActionDueStyle}>
          Due{' '}
          <strong>
            {formatDate(
              action.due_date
            )}
          </strong>
        </div>

      </div>


      {action.action_description && (
        <div style={recoveryActionDescriptionStyle}>
          {action.action_description}
        </div>
      )}


      <div style={recoveryActionMetaGridStyle}>

        <div>

          <div style={metaLabelStyle}>
            Responsible
          </div>

          <strong>
            {action
              .responsible_party}
          </strong>

        </div>


        <div>

          <div style={metaLabelStyle}>
            Effectiveness
          </div>

          <StatusBadge
            label={
              action.effectiveness ===
                'not_evaluated'
                ? 'Not Evaluated'
                : formatLabel(
                    action.effectiveness
                  )
            }
            style={
              getEffectivenessStyle(
                action.effectiveness
              )
            }
          />

        </div>

      </div>


      {action.effectiveness_notes && (
        <div style={effectivenessNotesStyle}>
          {action.effectiveness_notes}
        </div>
      )}


      <div style={recoveryActionButtonsStyle}>

        {action.status ===
          'open' && (
          <button
            type="button"
            onClick={() =>
              onOpenPanel(
                action.id,
                'start'
              )
            }
            style={
              smallActionButtonStyle
            }
          >
            Start
          </button>
        )}


        {[
          'open',
          'in_progress',
        ].includes(
          action.status
        ) && (
          <button
            type="button"
            onClick={() =>
              onOpenPanel(
                action.id,
                'complete'
              )
            }
            style={
              smallPositiveButtonStyle
            }
          >
            Complete
          </button>
        )}


        {action.status ===
          'completed' &&
          action.effectiveness ===
            'not_evaluated' && (
          <button
            type="button"
            onClick={() =>
              onOpenPanel(
                action.id,
                'evaluate'
              )
            }
            style={
              smallEvaluationButtonStyle
            }
          >
            Evaluate
          </button>
        )}


        {[
          'open',
          'in_progress',
        ].includes(
          action.status
        ) && (
          <button
            type="button"
            onClick={() =>
              onOpenPanel(
                action.id,
                'cancel'
              )
            }
            style={
              smallDangerButtonStyle
            }
          >
            Cancel
          </button>
        )}

      </div>


      {selected &&
        activePanel ===
          'start' && (
        <ActionPanel
          title="Start Recovery Action"
          description="Move this action to In Progress."
        >

          <ModalField
            label="Optional Comment"
          >
            <textarea
              value={note}
              onChange={(
                event
              ) =>
                setNote(
                  event.target.value
                )
              }
              style={
                smallTextareaStyle
              }
            />
          </ModalField>


          <ActionButtons
            saving={saving}
            confirmLabel="Start"
            onCancel={
              onClosePanel
            }
            onConfirm={() =>
              onStart(
                action.id
              )
            }
          />

        </ActionPanel>
      )}


      {selected &&
        activePanel ===
          'complete' && (
        <ActionPanel
          title="Complete Recovery Action"
          description="Completion does not automatically resolve the parent constraint."
        >

          <ModalField
            label="Completion Note *"
          >
            <textarea
              value={note}
              onChange={(
                event
              ) =>
                setNote(
                  event.target.value
                )
              }
              style={
                smallTextareaStyle
              }
            />
          </ModalField>


          <ActionButtons
            saving={saving}
            confirmLabel="Mark Completed"
            positive
            onCancel={
              onClosePanel
            }
            onConfirm={() =>
              onComplete(
                action.id
              )
            }
          />

        </ActionPanel>
      )}


      {selected &&
        activePanel ===
          'evaluate' && (
        <ActionPanel
          title="Evaluate Effectiveness"
          description="Determine whether this action actually protected or improved the plan."
        >

          <ModalField
            label="Effectiveness *"
          >
            <select
              value={
                effectiveness
              }
              onChange={(
                event
              ) =>
                setEffectiveness(
                  event.target.value
                )
              }
              style={
                modalInputStyle
              }
            >
              {EFFECTIVENESS_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </ModalField>


          <ModalField
            label="Effectiveness Notes *"
          >
            <textarea
              value={note}
              onChange={(
                event
              ) =>
                setNote(
                  event.target.value
                )
              }
              style={
                smallTextareaStyle
              }
            />
          </ModalField>


          <ActionButtons
            saving={saving}
            confirmLabel="Save Evaluation"
            onCancel={
              onClosePanel
            }
            onConfirm={() =>
              onEvaluate(
                action.id
              )
            }
          />

        </ActionPanel>
      )}


      {selected &&
        activePanel ===
          'cancel' && (
        <ActionPanel
          title="Cancel Recovery Action"
          description="Use when this action is no longer applicable."
        >

          <ModalField
            label="Cancellation Reason *"
          >
            <textarea
              value={note}
              onChange={(
                event
              ) =>
                setNote(
                  event.target.value
                )
              }
              style={
                smallTextareaStyle
              }
            />
          </ModalField>


          <ActionButtons
            saving={saving}
            confirmLabel="Cancel Action"
            danger
            onCancel={
              onClosePanel
            }
            onConfirm={() =>
              onCancel(
                action.id
              )
            }
          />

        </ActionPanel>
      )}

    </div>
  );
}


function HistoryEntry({
  entry,
}) {

  const statusChanged =
    entry.status_from !==
      entry.status_to &&
    (
      entry.status_from ||
      entry.status_to
    );


  const forecastChanged =
    entry
      .previous_target_resolution_date !==
      entry
        .new_target_resolution_date &&
    (
      entry
        .previous_target_resolution_date ||
      entry
        .new_target_resolution_date
    );


  return (
    <div style={historyCardStyle}>

      <div style={historyHeaderStyle}>

        <div>

          <strong>
            {getActionTypeLabel(
              entry.action_type
            )}
          </strong>

          <div style={historyActorStyle}>
            {entry.performed_by ||
              'System / Legacy Record'}
          </div>

        </div>


        <div style={historyDateStyle}>
          {formatDateTime(
            entry.created_at
          )}
        </div>

      </div>


      {statusChanged && (
        <div style={historyChangeStyle}>

          <span>
            Status
          </span>

          <strong>
            {getStatusLabel(
              entry.status_from
            )}

            {' → '}

            {getStatusLabel(
              entry.status_to
            )}
          </strong>

        </div>
      )}


      {forecastChanged && (
        <div style={historyChangeStyle}>

          <span>
            Forecast
          </span>

          <strong>
            {formatDate(
              entry
                .previous_target_resolution_date
            )}

            {' → '}

            {formatDate(
              entry
                .new_target_resolution_date
            )}
          </strong>

        </div>
      )}


      {entry.comment && (
        <div style={historyCommentStyle}>
          {entry.comment}
        </div>
      )}

    </div>
  );
}


function MessageBox({
  type,
  children,
}) {

  return (
    <div
      style={
        type ===
        'error'
          ? errorMessageStyle
          : successMessageStyle
      }
    >
      {children}
    </div>
  );
}


// ============================================================
// STYLES
// ============================================================

const pageStyle = {
  minHeight:
    '100%',

  padding:
    '22px 24px 44px',

  background:
    '#f8fafc',

  color:
    '#0f172a',
};


// ============================================================
// STANDARD PAGE SECTIONS
// ============================================================

const sectionCardStyle = {
  marginBottom:
    '14px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '9px',

  background:
    '#ffffff',

  overflow:
    'hidden',
};


const sectionHeaderStyle = {
  minHeight:
    '62px',

  padding:
    '13px 14px 0',
};


const sectionHeadingStyle = {
  color:
    '#0f172a',

  fontSize:
    '18px',

  fontWeight:
    900,

  lineHeight:
    1.2,
};


const sectionSupportingTextStyle = {
  marginTop:
    '4px',

  color:
    '#94a3b8',

  fontSize:
    '13px',

  lineHeight:
    1.45,
};


const sectionContentStyle = {
  padding:
    '12px 14px 14px',
};


// ============================================================
// PROJECT TOOLBAR
// ============================================================

const projectToolbarStyle = {
  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'space-between',

  gap:
    '14px',

  marginBottom:
    '14px',

  padding:
    '12px 14px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '9px',

  background:
    '#ffffff',

  minHeight:
    '68px',
};


const projectToolbarLeftStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '10px',

  minWidth:
    0,

  flex:
    1,

  flexWrap:
    'wrap',
};


const projectToolbarLabelStyle = {
  color:
    '#0f172a',

  fontSize:
    '14px',

  fontWeight:
    900,

  lineHeight:
    1.2,

  whiteSpace:
    'nowrap',
};


const projectSelectStyle = {
  width:
    'min(460px,100%)',

  flex:
    '0 1 460px',
};


const inputStyle = {
  width:
    '100%',

  height:
    '44px',

  padding:
    '0 11px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#ffffff',

  color:
    '#0f172a',

  fontSize:
    '14px',

  fontWeight:
    500,
};


// ============================================================
// SUMMARY
// ============================================================

const summaryGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(4,minmax(0,1fr))',

  gap:
    '10px',

  margin:
    0,
};


const summaryCardStyle = {
  padding:
    '14px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '8px',

  background:
    '#ffffff',
};


const summaryLabelStyle = {
  color:
    '#64748b',

  fontSize:
    '13px',

  fontWeight:
    900,

  textTransform:
    'uppercase',
};


const summaryValueStyle = {
  marginTop:
    '5px',

  fontSize:
    '36px',

  fontWeight:
    900,
};


const summaryDescriptionStyle = {
  marginTop:
    '6px',

  color:
    '#94a3b8',

  fontSize:
    '13px',
};


// ============================================================
// FILTERS
// ============================================================

const filtersGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'minmax(220px,2fr) repeat(5,minmax(115px,1fr))',

  gap:
    '8px',
};


const filterLabelStyle = {
  display:
    'block',

  marginBottom:
    '4px',

  color:
    '#64748b',

  fontSize:
    '13px',

  fontWeight:
    900,
};


const filterInputStyle = {
  width:
    '100%',

  height:
    '42px',

  padding:
    '0 8px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '5px',

  background:
    '#ffffff',

  fontSize:
    '14px',
};


// ============================================================
// SPLIT WORKSPACE
// ============================================================

const splitWorkspaceStyle = {
  display:
    'grid',

  gap:
    '12px',

  alignItems:
    'start',
};


const registerPanelStyle = {
  minWidth:
    0,

  overflow:
    'hidden',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '9px',

  background:
    '#ffffff',
};


const registerHeaderStyle = {
  display:
    'flex',

  alignItems:
    'flex-start',

  justifyContent:
    'space-between',

  gap:
    '12px',

  minHeight:
    '56px',

  padding:
    '13px 14px',

  borderBottom:
    '1px solid #e2e8f0',

  background:
    '#ffffff',
};


const registerCountStyle = {
  color:
    '#64748b',

  fontSize:
    '12px',

  fontWeight:
    700,
};


const tableContainerStyle = {
  overflowX:
    'auto',
};


const tableStyle = {
  width:
    '100%',

  minWidth:
    '1200px',

  borderCollapse:
    'collapse',

  tableLayout:
    'auto',
};


const headerCellStyle = {
  padding:
    '11px 10px',

  borderBottom:
    '1px solid #cbd5e1',

  background:
    '#f8fafc',

  color:
    '#64748b',

  fontSize:
    '12px',

  fontWeight:
    900,

  textAlign:
    'center',
};


const bodyCellStyle = {
  padding:
    '13px 11px',

  borderBottom:
    '1px solid #e2e8f0',

  fontSize:
    '13px',

  textAlign:
    'center',

  verticalAlign:
    'middle',
};


const leftCellStyle = {
  ...bodyCellStyle,

  textAlign:
    'left',
};


const constraintTitleStyle = {
  maxWidth:
    '220px',

  marginTop:
    '4px',

  color:
    '#475569',

  fontSize:
    '13px',

  lineHeight:
    1.4,
};


const inlineBadgesStyle = {
  display:
    'flex',

  gap:
    '4px',

  marginTop:
    '5px',

  flexWrap:
    'wrap',
};


const blockingInlineStyle = {
  padding:
    '2px 5px',

  borderRadius:
    '999px',

  background:
    '#fef2f2',

  color:
    '#b91c1c',

  fontSize:
    '10px',

  fontWeight:
    900,
};


const sourceInlineStyle = {
  padding:
    '2px 5px',

  borderRadius:
    '999px',

  background:
    '#eff6ff',

  color:
    '#1d4ed8',

  fontSize:
    '10px',

  fontWeight:
    900,
};


const secondaryTextStyle = {
  marginTop:
    '3px',

  color:
    '#94a3b8',

  fontSize:
    '12px',
};


const effectivePriorityStackStyle = {
  display:
    'inline-flex',

  flexDirection:
    'column',

  alignItems:
    'center',

  gap:
    '3px',
};


const autoLabelStyle = {
  color:
    '#b91c1c',

  fontSize:
    '10px',

  fontWeight:
    900,

  letterSpacing:
    '0.08em',
};


// ============================================================
// BADGES
// ============================================================

const badgeBaseStyle = {
  display:
    'inline-flex',

  alignItems:
    'center',

  padding:
    '4px 7px',

  borderRadius:
    '999px',

  fontSize:
    '11px',

  fontWeight:
    900,
};


const exposureBadgeStyle = {
  display:
    'inline-flex',

  flexDirection:
    'column',

  alignItems:
    'center',

  gap:
    '2px',

  padding:
    '5px 7px',

  border:
    '1px solid',

  borderRadius:
    '6px',

  fontSize:
    '11px',
};


const exposureStatusTextStyle = {
  fontSize:
    '9px',

  fontWeight:
    900,

  letterSpacing:
    '0.08em',
};


const blockingPillStyle = {
  ...badgeBaseStyle,

  border:
    '1px solid #fecaca',

  background:
    '#fef2f2',

  color:
    '#b91c1c',
};


// ============================================================
// BUTTONS
// ============================================================

const primaryButtonStyle = {
  height:
    '42px',

  padding:
    '0 12px',

  border:
    '1px solid #2563eb',

  borderRadius:
    '6px',

  background:
    '#2563eb',

  color:
    '#ffffff',

  fontSize:
    '14px',

  fontWeight:
    900,

  cursor:
    'pointer',
};


const successPrimaryButtonStyle = {
  ...primaryButtonStyle,

  border:
    '1px solid #16a34a',

  background:
    '#16a34a',
};


const warningPrimaryButtonStyle = {
  ...primaryButtonStyle,

  border:
    '1px solid #ea580c',

  background:
    '#ea580c',
};


const dangerPrimaryButtonStyle = {
  ...primaryButtonStyle,

  border:
    '1px solid #dc2626',

  background:
    '#dc2626',
};


const secondaryButtonStyle = {
  height:
    '42px',

  padding:
    '0 11px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#ffffff',

  color:
    '#334155',

  fontSize:
    '14px',

  fontWeight:
    800,

  cursor:
    'pointer',
};


const secondaryActionButtonStyle = {
  ...secondaryButtonStyle,

  border:
    '1px solid #bfdbfe',

  background:
    '#eff6ff',

  color:
    '#1d4ed8',
};


const manageButtonStyle = {
  height:
    '34px',

  padding:
    '0 9px',

  border:
    '1px solid #93c5fd',

  borderRadius:
    '5px',

  background:
    '#eff6ff',

  color:
    '#1d4ed8',

  fontSize:
    '12px',

  fontWeight:
    900,

  cursor:
    'pointer',
};


// ============================================================
// DRAWER
// ============================================================

const drawerStyle = {
  position:
    'sticky',

  top:
    '14px',

  display:
    'flex',

  flexDirection:
    'column',

  maxHeight:
    'calc(100vh - 28px)',

  overflow:
    'hidden',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '10px',

  background:
    '#ffffff',

  boxShadow:
    '0 12px 36px rgba(15,23,42,0.12)',
};


const drawerHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '12px',

  padding:
    '14px',

  borderBottom:
    '1px solid #e2e8f0',

  background:
    '#ffffff',
};


const drawerEyebrowStyle = {
  color:
    '#2563eb',

  fontSize:
    '11px',

  fontWeight:
    900,

  letterSpacing:
    '0.08em',
};


const drawerTitleRowStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '6px',

  marginTop:
    '4px',

  flexWrap:
    'wrap',
};


const drawerTitleStyle = {
  margin:
    0,

  fontSize:
    '20px',

  fontWeight:
    900,
};


const drawerConstraintTitleStyle = {
  marginTop:
    '5px',

  color:
    '#475569',

  fontSize:
    '14px',

  fontWeight:
    700,

  lineHeight:
    1.4,
};


const drawerPriorityRowStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '8px',

  marginTop:
    '9px',

  flexWrap:
    'wrap',
};


const drawerMetaLabelStyle = {
  marginRight:
    '4px',

  color:
    '#94a3b8',

  fontSize:
    '10px',

  fontWeight:
    900,

  textTransform:
    'uppercase',
};


const closeButtonStyle = {
  width:
    '31px',

  height:
    '31px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '6px',

  background:
    '#ffffff',

  color:
    '#64748b',

  fontSize:
    '22px',

  cursor:
    'pointer',
};


const drawerSummaryStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(3,minmax(0,1fr))',

  gap:
    '6px',

  padding:
    '9px 12px',

  borderBottom:
    '1px solid #e2e8f0',

  background:
    '#f8fafc',
};


const drawerMetricStyle = {
  padding:
    '8px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '6px',
};


const drawerTabsStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(5,minmax(0,1fr))',

  borderBottom:
    '1px solid #e2e8f0',
};


const drawerTabStyle = {
  minHeight:
    '46px',

  padding:
    '5px 3px',

  border:
    'none',

  fontSize:
    '12px',

  fontWeight:
    900,

  cursor:
    'pointer',
};


const drawerBodyStyle = {
  flex:
    1,

  overflowY:
    'auto',

  padding:
    '10px',

  background:
    '#f8fafc',
};


const drawerFooterStyle = {
  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'space-between',

  gap:
    '8px',

  padding:
    '9px 12px',

  borderTop:
    '1px solid #e2e8f0',

  background:
    '#ffffff',
};


const footerMetaStyle = {
  color:
    '#64748b',

  fontSize:
    '11px',

  fontWeight:
    700,
};


const drawerSectionStyle = {
  marginBottom:
    '9px',

  padding:
    '11px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '8px',

  background:
    '#ffffff',
};


const drawerSectionHeadingStyle = {
  color:
    '#0f172a',

  fontSize:
    '16px',

  fontWeight:
    900,
};


const drawerSectionSupportingTextStyle = {
  marginTop:
    '3px',

  color:
    '#94a3b8',

  fontSize:
    '12px',

  lineHeight:
    1.4,
};


const sectionBodyStyle = {
  marginTop:
    '11px',
};


const fieldStyle = {
  marginBottom:
    '11px',
};


const modalLabelStyle = {
  display:
    'block',

  marginBottom:
    '5px',

  color:
    '#334155',

  fontSize:
    '13px',

  fontWeight:
    800,
};


const modalInputStyle = {
  width:
    '100%',

  height:
    '42px',

  padding:
    '0 8px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#ffffff',

  color:
    '#0f172a',

  fontSize:
    '14px',
};


const modalTextareaStyle = {
  width:
    '100%',

  minHeight:
    '90px',

  padding:
    '8px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#ffffff',

  color:
    '#0f172a',

  fontFamily:
    'inherit',

  fontSize:
    '14px',

  resize:
    'vertical',
};


const smallTextareaStyle = {
  ...modalTextareaStyle,

  minHeight:
    '78px',
};


const checkboxStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '7px',

  marginBottom:
    '11px',

  padding:
    '9px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '6px',

  background:
    '#f8fafc',

  fontSize:
    '12px',

  fontWeight:
    700,
};


const rightActionsStyle = {
  display:
    'flex',

  justifyContent:
    'flex-end',

  gap:
    '7px',

  flexWrap:
    'wrap',
};


const autoPriorityNoticeStyle = {
  marginBottom:
    '11px',

  padding:
    '9px',

  border:
    '1px solid #fecaca',

  borderRadius:
    '6px',

  background:
    '#fef2f2',

  color:
    '#991b1b',

  fontSize:
    '11px',

  lineHeight:
    1.45,
};


// ============================================================
// LIFECYCLE
// ============================================================

const lifecycleFlowStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '4px',

  marginBottom:
    '10px',

  flexWrap:
    'wrap',
};


const lifecycleStageStyle = {
  padding:
    '4px 6px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '999px',

  fontSize:
    '11px',
};


const lifecycleArrowStyle = {
  color:
    '#cbd5e1',

  fontSize:
    '12px',

  fontWeight:
    900,
};


const lifecycleButtonsGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2,minmax(0,1fr))',

  gap:
    '6px',
};


const lifecycleButtonStyle = {
  display:
    'flex',

  flexDirection:
    'column',

  padding:
    '9px',

  borderRadius:
    '6px',

  textAlign:
    'left',

  fontSize:
    '12px',

  cursor:
    'pointer',
};


const lifecycleDescriptionStyle = {
  marginTop:
    '3px',

  color:
    '#64748b',

  fontSize:
    '11px',
};


// ============================================================
// ACTION PANEL
// ============================================================

const actionPanelStyle = {
  marginTop:
    '10px',

  padding:
    '10px',

  border:
    '1px solid #bfdbfe',

  borderRadius:
    '7px',

  background:
    '#f8fbff',
};


const actionPanelTitleStyle = {
  fontSize:
    '14px',

  fontWeight:
    900,
};


const actionPanelDescriptionStyle = {
  marginTop:
    '3px',

  color:
    '#64748b',

  fontSize:
    '12px',

  lineHeight:
    1.4,
};


const actionPanelBodyStyle = {
  marginTop:
    '10px',
};


// ============================================================
// FORECAST
// ============================================================

const forecastStackStyle = {
  display:
    'grid',

  gap:
    '7px',

  marginBottom:
    '10px',
};


const forecastCardStyle = {
  padding:
    '10px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',
};


const forecastDescriptionStyle = {
  marginTop:
    '3px',

  color:
    '#64748b',

  fontSize:
    '12px',

  lineHeight:
    1.4,
};


const metaLabelStyle = {
  color:
    '#94a3b8',

  fontSize:
    '10px',

  fontWeight:
    900,

  textTransform:
    'uppercase',
};


const forecastButtonStyle = {
  height:
    '38px',

  padding:
    '0 10px',

  border:
    '1px solid #fdba74',

  borderRadius:
    '6px',

  background:
    '#fff7ed',

  color:
    '#9a3412',

  fontSize:
    '12px',

  fontWeight:
    900,

  cursor:
    'pointer',
};


const reopenButtonStyle = {
  ...forecastButtonStyle,

  marginTop:
    '8px',

  border:
    '1px solid #f97316',

  background:
    '#fff7ed',

  color:
    '#c2410c',
};


const delayAssessmentStyle = {
  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #fecaca',

  borderRadius:
    '6px',

  background:
    '#fef2f2',

  color:
    '#b91c1c',

  fontSize:
    '12px',
};


const safeAssessmentStyle = {
  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #bbf7d0',

  borderRadius:
    '6px',

  background:
    '#f0fdf4',

  color:
    '#166534',

  fontSize:
    '12px',
};


const helperTextStyle = {
  marginTop:
    '4px',

  color:
    '#64748b',

  fontSize:
    '11px',
};


const criticalEscalationStyle = {
  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'space-between',

  gap:
    '8px',

  marginBottom:
    '10px',

  padding:
    '10px',

  border:
    '1px solid #fecaca',

  borderRadius:
    '7px',

  background:
    '#fef2f2',

  color:
    '#991b1b',

  fontSize:
    '12px',
};


const noticeTextStyle = {
  marginTop:
    '3px',

  fontSize:
    '11px',

  lineHeight:
    1.4,
};


const warningBoxStyle = {
  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #fde68a',

  borderRadius:
    '6px',

  background:
    '#fffbeb',

  color:
    '#92400e',

  fontSize:
    '11px',

  lineHeight:
    1.4,
};


const reopenNoticeStyle = {
  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #fdba74',

  borderRadius:
    '6px',

  background:
    '#fff7ed',

  color:
    '#9a3412',

  fontSize:
    '11px',
};


const inlineValidationStyle = {
  marginTop:
    '5px',

  color:
    '#b91c1c',

  fontSize:
    '11px',

  fontWeight:
    700,
};


const reopenTransitionStyle = {
  display:
    'grid',

  gridTemplateColumns:
    '1fr auto 1fr',

  alignItems:
    'center',

  gap:
    '8px',

  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '6px',

  background:
    '#ffffff',

  fontSize:
    '12px',
};


const reopenArrowStyle = {
  color:
    '#cbd5e1',

  fontSize:
    '20px',

  fontWeight:
    900,
};


// ============================================================
// ACTION PLAN
// ============================================================

const actionSummaryGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(3,minmax(0,1fr))',

  gap:
    '6px',

  marginBottom:
    '10px',
};


const miniSummaryStyle = {
  padding:
    '8px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '6px',

  background:
    '#f8fafc',
};


const miniSummaryValueStyle = {
  marginTop:
    '4px',

  fontSize:
    '13px',

  fontWeight:
    900,
};


const addRecoveryButtonStyle = {
  height:
    '38px',

  padding:
    '0 10px',

  border:
    '1px solid #93c5fd',

  borderRadius:
    '6px',

  background:
    '#eff6ff',

  color:
    '#1d4ed8',

  fontSize:
    '12px',

  fontWeight:
    900,

  cursor:
    'pointer',
};


const actionPlanEmptyStyle = {
  marginTop:
    '10px',

  padding:
    '14px',

  border:
    '1px dashed #cbd5e1',

  borderRadius:
    '7px',

  background:
    '#f8fafc',

  color:
    '#64748b',

  fontSize:
    '12px',
};


const emptyDescriptionStyle = {
  marginTop:
    '4px',

  fontSize:
    '11px',

  lineHeight:
    1.4,
};


const recoveryActionListStyle = {
  display:
    'grid',

  gap:
    '8px',

  marginTop:
    '10px',
};


const recoveryActionCardStyle = {
  padding:
    '10px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',

  background:
    '#f8fafc',
};


const recoveryActionHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '8px',

  flexWrap:
    'wrap',

  fontSize:
    '12px',
};


const recoveryActionTitleRowStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '5px',

  flexWrap:
    'wrap',
};


const recoveryActionApproachStyle = {
  marginTop:
    '4px',

  color:
    '#64748b',

  fontSize:
    '11px',

  fontWeight:
    700,
};


const recoveryActionDueStyle = {
  color:
    '#475569',

  fontSize:
    '11px',
};


const recoveryActionDescriptionStyle = {
  marginTop:
    '8px',

  color:
    '#475569',

  fontSize:
    '12px',

  lineHeight:
    1.4,
};


const recoveryActionMetaGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2,minmax(0,1fr))',

  gap:
    '8px',

  marginTop:
    '9px',

  fontSize:
    '11px',
};


const effectivenessNotesStyle = {
  marginTop:
    '8px',

  padding:
    '7px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '5px',

  background:
    '#ffffff',

  color:
    '#475569',

  fontSize:
    '11px',
};


const recoveryActionButtonsStyle = {
  display:
    'flex',

  gap:
    '5px',

  flexWrap:
    'wrap',

  marginTop:
    '9px',
};


const smallActionButtonStyle = {
  height:
    '32px',

  padding:
    '0 8px',

  border:
    '1px solid #93c5fd',

  borderRadius:
    '5px',

  background:
    '#eff6ff',

  color:
    '#1d4ed8',

  fontSize:
    '11px',

  fontWeight:
    800,

  cursor:
    'pointer',
};


const smallPositiveButtonStyle = {
  ...smallActionButtonStyle,

  border:
    '1px solid #86efac',

  background:
    '#f0fdf4',

  color:
    '#166534',
};


const smallEvaluationButtonStyle = {
  ...smallActionButtonStyle,

  border:
    '1px solid #c4b5fd',

  background:
    '#f5f3ff',

  color:
    '#6d28d9',
};


const smallDangerButtonStyle = {
  ...smallActionButtonStyle,

  border:
    '1px solid #fecaca',

  background:
    '#fef2f2',

  color:
    '#b91c1c',
};


// ============================================================
// AFFECTED WORK
// ============================================================

const affectedCardStyle = {
  marginBottom:
    '7px',

  padding:
    '10px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',

  background:
    '#f8fafc',
};


const affectedHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '8px',

  fontSize:
    '12px',
};


const sourceBadgeStyle = {
  padding:
    '3px 6px',

  border:
    '1px solid #bfdbfe',

  borderRadius:
    '999px',

  background:
    '#eff6ff',

  color:
    '#1d4ed8',

  fontSize:
    '10px',

  fontWeight:
    800,
};


const affectedLocationStyle = {
  marginTop:
    '4px',

  color:
    '#475569',

  fontSize:
    '12px',

  fontWeight:
    700,
};


const affectedDateStyle = {
  marginTop:
    '6px',

  color:
    '#64748b',

  fontSize:
    '11px',
};


// ============================================================
// HISTORY
// ============================================================

const historyCardStyle = {
  marginBottom:
    '8px',

  padding:
    '9px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',

  background:
    '#f8fafc',

  fontSize:
    '11px',
};


const historyHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '8px',
};


const historyActorStyle = {
  marginTop:
    '3px',

  color:
    '#64748b',

  fontSize:
    '10px',
};


const historyDateStyle = {
  color:
    '#94a3b8',

  fontSize:
    '10px',
};


const historyChangeStyle = {
  display:
    'grid',

  gridTemplateColumns:
    '60px 1fr',

  gap:
    '6px',

  marginTop:
    '7px',
};


const historyCommentStyle = {
  marginTop:
    '7px',

  paddingTop:
    '7px',

  borderTop:
    '1px solid #e2e8f0',

  color:
    '#475569',

  lineHeight:
    1.4,
};


// ============================================================
// CREATE MODAL
// ============================================================

const modalOverlayStyle = {
  position:
    'fixed',

  inset:
    0,

  zIndex:
    9500,

  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'center',

  padding:
    '20px',

  background:
    'rgba(15,23,42,0.62)',
};


const createModalStyle = {
  width:
    'min(620px,96vw)',

  maxHeight:
    '92vh',

  overflowY:
    'auto',

  borderRadius:
    '10px',

  background:
    '#ffffff',

  boxShadow:
    '0 24px 70px rgba(15,23,42,0.30)',
};


const createModalHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '20px',

  padding:
    '16px 18px',

  borderBottom:
    '1px solid #e2e8f0',
};


const createModalTitleStyle = {
  margin:
    '4px 0 0',

  fontSize:
    '22px',
};


const createFormStyle = {
  padding:
    '18px',
};


// ============================================================
// MESSAGES / EMPTY
// ============================================================

const emptyStyle = {
  padding:
    '38px',

  textAlign:
    'center',

  color:
    '#64748b',

  fontSize:
    '13px',
};


const emptyInnerStyle = {
  padding:
    '14px',

  border:
    '1px dashed #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#f8fafc',

  color:
    '#64748b',

  textAlign:
    'center',

  fontSize:
    '12px',
};


const errorMessageStyle = {
  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #fecaca',

  borderRadius:
    '6px',

  background:
    '#fef2f2',

  color:
    '#b91c1c',

  fontSize:
    '12px',
};


const successMessageStyle = {
  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #bbf7d0',

  borderRadius:
    '6px',

  background:
    '#f0fdf4',

  color:
    '#166534',

  fontSize:
    '12px',
};
