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
// CENTRALIZED CONSTRAINT MANAGEMENT
//
// Operational scope:
//
// - Central project Constraint Log
// - Manual constraint creation
// - Edit Details
// - Add Comment
// - Update Forecast
// - Start Action
// - Set Waiting
// - Resume Action
// - Resolve
// - Verify & Clear
// - Cancel Constraint
// - Action History
// - Required By vs Planned Resolution
// - Forecast variance
// - Lookahead / Koskela readiness release on CLEARED
//
// ============================================================


// ============================================================
// CONSTANTS
// ============================================================

const ACTIVE_STATUSES = [
  'open',
  'in_progress',
  'waiting',
  'resolved',
];


const TERMINAL_STATUSES = [
  'cleared',
  'cancelled',
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
};


// ============================================================
// HELPERS
// ============================================================

function normalizeText(value) {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase();
}


function formatLabel(value) {
  if (!value) {
    return '—';
  }

  if (
    CATEGORY_LABELS[value]
  ) {
    return CATEGORY_LABELS[
      value
    ];
  }

  return String(value)
    .replace(
      /_/g,
      ' '
    )
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
      month:
        'short',

      day:
        '2-digit',

      year:
        'numeric',
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
      month:
        'short',

      day:
        '2-digit',

      year:
        'numeric',

      hour:
        '2-digit',

      minute:
        '2-digit',
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
    String(
      constraintId
    )
      .replace(
        /-/g,
        ''
      )
      .slice(
        0,
        6
      )
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
    return 'Lookahead / Koskela';
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


function getStatusLabel(
  status
) {
  switch (
    status
  ) {

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

    default:
      return formatLabel(
        status
      );
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
    formatLabel(
      actionType
    )
  );
}


function getStatusStyle(
  status
) {
  switch (
    status
  ) {

    case 'open':
      return {
        background:
          '#fee2e2',

        border:
          '#fca5a5',

        color:
          '#991b1b',
      };

    case 'in_progress':
      return {
        background:
          '#dbeafe',

        border:
          '#93c5fd',

        color:
          '#1d4ed8',
      };

    case 'waiting':
      return {
        background:
          '#fef3c7',

        border:
          '#fcd34d',

        color:
          '#92400e',
      };

    case 'resolved':
      return {
        background:
          '#ede9fe',

        border:
          '#c4b5fd',

        color:
          '#6d28d9',
      };

    case 'cleared':
      return {
        background:
          '#dcfce7',

        border:
          '#86efac',

        color:
          '#166534',
      };

    case 'cancelled':
      return {
        background:
          '#f1f5f9',

        border:
          '#cbd5e1',

        color:
          '#64748b',
      };

    default:
      return {
        background:
          '#f8fafc',

        border:
          '#cbd5e1',

        color:
          '#475569',
      };
  }
}


function getPriorityStyle(
  priority
) {
  switch (
    normalizeText(
      priority
    )
  ) {

    case 'critical':
      return {
        background:
          '#fee2e2',

        border:
          '#ef4444',

        color:
          '#991b1b',
      };

    case 'high':
      return {
        background:
          '#fff7ed',

        border:
          '#fdba74',

        color:
          '#c2410c',
      };

    case 'medium':
      return {
        background:
          '#fefce8',

        border:
          '#fde047',

        color:
          '#854d0e',
      };

    case 'low':
      return {
        background:
          '#f0fdf4',

        border:
          '#86efac',

        color:
          '#166534',
      };

    default:
      return {
        background:
          '#f8fafc',

        border:
          '#cbd5e1',

        color:
          '#64748b',
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


function getForecastAssessment(
  constraint
) {
  if (
    !constraint
  ) {
    return {
      variance:
        null,

      varianceLabel:
        '—',

      outlook:
        'Not Evaluated',

      delayed:
        false,
    };
  }


  const requiredBy =
    constraint
      .required_by_date;


  const forecast =
    constraint
      .target_resolution_date ||
    requiredBy;


  const variance =
    dateDifferenceDays(
      requiredBy,
      forecast
    );


  if (
    variance === null
  ) {
    return {
      variance:
        null,

      varianceLabel:
        '—',

      outlook:
        'Not Evaluated',

      delayed:
        false,
    };
  }


  if (
    variance > 0
  ) {
    return {
      variance,

      varianceLabel:
        `+${variance} day${variance === 1 ? '' : 's'}`,

      outlook:
        'Delay Expected',

      delayed:
        true,
    };
  }


  if (
    variance < 0
  ) {
    return {
      variance,

      varianceLabel:
        `${Math.abs(
          variance
        )} day${Math.abs(variance) === 1 ? '' : 's'} early`,

      outlook:
        'Ahead of Required Date',

      delayed:
        false,
    };
  }


  return {
    variance:
      0,

    varianceLabel:
      'On required date',

    outlook:
      'On Time',

    delayed:
      false,
  };
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


    if (
      !user
    ) {
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

  } catch (
    error
  ) {

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

function createInitialForm() {
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


function createEditForm(
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


function createForecastForm(
  constraint
) {
  return {
    new_resolution_date:
      constraint
        ?.target_resolution_date ||
      constraint
        ?.required_by_date ||
      '',

    reason:
      '',
  };
}


// ============================================================
// PAGE
// ============================================================

export default function ConstraintLogPage() {

  // ==========================================================
  // MAIN DATA
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
    form,
    setForm,
  ] = useState(
    createInitialForm()
  );


  // ==========================================================
  // MANAGEMENT DRAWER
  // ==========================================================

  const [
    managedConstraint,
    setManagedConstraint,
  ] = useState(null);


  const [
    showManagementDrawer,
    setShowManagementDrawer,
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
  // EDIT DETAILS
  // ==========================================================

  const [
    showEditModal,
    setShowEditModal,
  ] = useState(false);


  const [
    savingEdit,
    setSavingEdit,
  ] = useState(false);


  const [
    editForm,
    setEditForm,
  ] = useState(
    createEditForm()
  );


  // ==========================================================
  // COMMENT
  // ==========================================================

  const [
    showCommentModal,
    setShowCommentModal,
  ] = useState(false);


  const [
    commentText,
    setCommentText,
  ] = useState('');


  const [
    savingComment,
    setSavingComment,
  ] = useState(false);


  // ==========================================================
  // FORECAST
  // ==========================================================

  const [
    showForecastModal,
    setShowForecastModal,
  ] = useState(false);


  const [
    forecastForm,
    setForecastForm,
  ] = useState(
    createForecastForm()
  );


  const [
    savingForecast,
    setSavingForecast,
  ] = useState(false);


  // ==========================================================
  // LIFECYCLE ACTION MODAL
  // ==========================================================

  const [
    lifecycleAction,
    setLifecycleAction,
  ] = useState(null);


  const [
    lifecycleNote,
    setLifecycleNote,
  ] = useState('');


  const [
    savingLifecycle,
    setSavingLifecycle,
  ] = useState(false);


  // ==========================================================
  // SELECTED PROJECT
  // ==========================================================

  const selectedProject =
    useMemo(
      () =>
        projects.find(
          (
            project
          ) =>
            project.id ===
            selectedProjectId
        ) ||
        null,
      [
        projects,
        selectedProjectId,
      ]
    );


  // ==========================================================
  // LOAD PROJECTS
  // ==========================================================

  const loadProjects =
    useCallback(
      async () => {

        setErrorMessage(
          ''
        );


        try {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'projects'
              )
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


          if (
            error
          ) {
            throw error;
          }


          const loadedProjects =
            data ||
            [];


          setProjects(
            loadedProjects
          );


          const params =
            new URLSearchParams(
              window.location
                .search
            );


          const requestedProjectId =
            params.get(
              'projectId'
            );


          if (
            requestedProjectId &&
            loadedProjects.some(
              (
                project
              ) =>
                project.id ===
                requestedProjectId
            )
          ) {

            setSelectedProjectId(
              requestedProjectId
            );

            return;

          }


          if (
            loadedProjects.length ===
            1
          ) {

            setSelectedProjectId(
              loadedProjects[0]
                .id
            );

          }

        } catch (
          error
        ) {

          console.error(
            'Constraint Log projects:',
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
  // LOAD CONSTRAINT LOG
  // ==========================================================

  const loadConstraintLog =
    useCallback(
      async (
        projectId
      ) => {

        if (
          !projectId
        ) {

          setConstraints(
            []
          );

          setAffectedWork(
            []
          );

          setLookaheadItems(
            {}
          );

          setMasterPlanPackages(
            {}
          );

          return;

        }


        setLoading(
          true
        );


        setErrorMessage(
          ''
        );


        try {

          const {
            data:
              constraintData,

            error:
              constraintError,
          } =
            await supabase
              .from(
                'constraints'
              )
              .select(`
                id,
                project_id,

                lookahead_work_item_id,
                master_plan_package_id,
                readiness_assessment_id,

                category,
                title,
                description,
                action_required,
                responsible_party,

                required_by_date,
                target_resolution_date,

                status,
                blocking,
                priority,

                action_started_at,
                resolved_at,
                verified_at,
                verified_by,
                verification_notes,
                cleared_at,

                created_at,
                updated_at
              `)
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

            setAffectedWork(
              []
            );

            setLookaheadItems(
              {}
            );

            setMasterPlanPackages(
              {}
            );

            return;

          }


          const constraintIds =
            loadedConstraints.map(
              (
                constraint
              ) =>
                constraint.id
            );


          const {
            data:
              affectedWorkData,

            error:
              affectedWorkError,
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
            affectedWorkError
          ) {
            throw affectedWorkError;
          }


          const loadedAffectedWork =
            affectedWorkData ||
            [];


          setAffectedWork(
            loadedAffectedWork
          );


          // --------------------------------------------------
          // LOOKAHEAD REFERENCES
          // --------------------------------------------------

          const allLookaheadIds =
            Array.from(
              new Set([
                ...loadedAffectedWork
                  .map(
                    (
                      item
                    ) =>
                      item
                        .lookahead_work_item_id
                  )
                  .filter(
                    Boolean
                  ),

                ...loadedConstraints
                  .map(
                    (
                      constraint
                    ) =>
                      constraint
                        .lookahead_work_item_id
                  )
                  .filter(
                    Boolean
                  ),
              ])
            );


          let nextLookaheadMap =
            {};


          if (
            allLookaheadIds.length >
            0
          ) {

            const {
              data:
                lookaheadData,

              error:
                lookaheadError,
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
                  allLookaheadIds
                );


            if (
              lookaheadError
            ) {
              throw lookaheadError;
            }


            nextLookaheadMap =
              Object.fromEntries(
                (
                  lookaheadData ||
                  []
                ).map(
                  (
                    item
                  ) => [
                    item.id,
                    item,
                  ]
                )
              );

          }


          setLookaheadItems(
            nextLookaheadMap
          );


          // --------------------------------------------------
          // MASTER PLAN REFERENCES
          // --------------------------------------------------

          const allMasterIds =
            Array.from(
              new Set([
                ...loadedAffectedWork
                  .map(
                    (
                      item
                    ) =>
                      item
                        .master_plan_package_id
                  )
                  .filter(
                    Boolean
                  ),

                ...loadedConstraints
                  .map(
                    (
                      constraint
                    ) =>
                      constraint
                        .master_plan_package_id
                  )
                  .filter(
                    Boolean
                  ),

                ...Object
                  .values(
                    nextLookaheadMap
                  )
                  .map(
                    (
                      item
                    ) =>
                      item
                        .master_plan_package_id
                  )
                  .filter(
                    Boolean
                  ),
              ])
            );


          let nextMasterPlanMap =
            {};


          if (
            allMasterIds.length >
            0
          ) {

            const {
              data:
                masterPlanData,

              error:
                masterPlanError,
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
                  allMasterIds
                );


            if (
              masterPlanError
            ) {
              throw masterPlanError;
            }


            nextMasterPlanMap =
              Object.fromEntries(
                (
                  masterPlanData ||
                  []
                ).map(
                  (
                    item
                  ) => [
                    item.id,
                    item,
                  ]
                )
              );

          }


          setMasterPlanPackages(
            nextMasterPlanMap
          );

        } catch (
          error
        ) {

          console.error(
            'Constraint Management:',
            error
          );


          setErrorMessage(
            error.message ||
            'The Constraint Log could not be loaded.'
          );

        } finally {

          setLoading(
            false
          );

        }

      },
      []
    );


  // ==========================================================
  // LOAD HISTORY
  // ==========================================================

  const loadConstraintHistory =
    useCallback(
      async (
        constraintId
      ) => {

        if (
          !constraintId
        ) {
          return;
        }


        setLoadingHistory(
          true
        );


        setHistoryError(
          ''
        );


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


          if (
            error
          ) {
            throw error;
          }


          setConstraintHistory(
            data ||
            []
          );

        } catch (
          error
        ) {

          console.error(
            'Constraint Action History:',
            error
          );


          setHistoryError(
            error.message ||
            'Action History could not be loaded.'
          );

        } finally {

          setLoadingHistory(
            false
          );

        }

      },
      []
    );


  // ==========================================================
  // REFRESH MANAGED CONSTRAINT
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
              'constraints'
            )
            .select(`
              id,
              project_id,
              lookahead_work_item_id,
              master_plan_package_id,
              readiness_assessment_id,
              category,
              title,
              description,
              action_required,
              responsible_party,
              required_by_date,
              target_resolution_date,
              status,
              blocking,
              priority,
              action_started_at,
              resolved_at,
              verified_at,
              verified_by,
              verification_notes,
              cleared_at,
              created_at,
              updated_at
            `)
            .eq(
              'id',
              constraintId
            )
            .single();


        if (
          error
        ) {
          throw error;
        }


        setManagedConstraint(
          data
        );


        await loadConstraintHistory(
          constraintId
        );

      },
      [
        selectedProjectId,
        loadConstraintLog,
        loadConstraintHistory,
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


    setSearchTerm(
      ''
    );


    setStatusFilter(
      ''
    );


    setCategoryFilter(
      ''
    );


    setPriorityFilter(
      ''
    );


    setResponsibleFilter(
      ''
    );


    setSuccessMessage(
      ''
    );


    setErrorMessage(
      ''
    );


    closeManagementDrawer();


    if (
      projectId
    ) {

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
  // CREATE
  // ==========================================================

  function openCreateModal() {

    setForm(
      createInitialForm()
    );


    setShowCreateModal(
      true
    );

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
        form.title ||
        ''
      ).trim();


    const responsible =
      String(
        form
          .responsible_party ||
        ''
      ).trim();


    const action =
      String(
        form
          .action_required ||
        ''
      ).trim();


    if (
      !title ||
      !responsible ||
      !action ||
      !form
        .required_by_date
    ) {

      setErrorMessage(
        'Title, Responsible Party, Required Action and Required By Date are required.'
      );

      return;

    }


    setCreatingConstraint(
      true
    );


    setErrorMessage(
      ''
    );


    try {

      const performedBy =
        await getPerformedBy();


      const {
        data,
        error,
      } =
        await supabase.rpc(
          'create_manual_constraint_with_history',
          {
            target_project_id:
              selectedProjectId,

            target_category:
              form.category,

            target_title:
              title,

            target_description:
              form.description ||
              null,

            target_action_required:
              action,

            target_responsible_party:
              responsible,

            target_required_by_date:
              form
                .required_by_date,

            target_priority:
              form.priority,

            target_blocking:
              Boolean(
                form.blocking
              ),

            target_performed_by:
              performedBy,
          }
        );


      if (
        error
      ) {
        throw error;
      }


      setShowCreateModal(
        false
      );


      setSuccessMessage(
        `Constraint ${getConstraintReference(
          Array.isArray(data)
            ? data[0]
            : data
        )} created successfully.`
      );


      await loadConstraintLog(
        selectedProjectId
      );

    } catch (
      error
    ) {

      console.error(
        'Create Constraint:',
        error
      );


      setErrorMessage(
        error.message ||
        'Constraint could not be created.'
      );

    } finally {

      setCreatingConstraint(
        false
      );

    }

  }


  // ==========================================================
  // MANAGEMENT DRAWER
  // ==========================================================

  async function openManagementDrawer(
    constraint
  ) {

    setManagedConstraint(
      constraint
    );


    setShowManagementDrawer(
      true
    );


    setConstraintHistory(
      []
    );


    await loadConstraintHistory(
      constraint.id
    );

  }


  function closeManagementDrawer() {

    setShowManagementDrawer(
      false
    );


    setManagedConstraint(
      null
    );


    setConstraintHistory(
      []
    );


    setHistoryError(
      ''
    );


    setLifecycleAction(
      null
    );


    setLifecycleNote(
      ''
    );

  }


  // ==========================================================
  // EDIT DETAILS
  // ==========================================================

  function openEditModal() {

    setEditForm(
      createEditForm(
        managedConstraint
      )
    );


    setShowEditModal(
      true
    );

  }


  async function saveConstraintDetails(
    event
  ) {

    event.preventDefault();


    if (
      !managedConstraint ||
      savingEdit
    ) {
      return;
    }


    setSavingEdit(
      true
    );


    setHistoryError(
      ''
    );


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
              editForm
                .responsible_party,

            target_action_required:
              editForm
                .action_required,

            target_priority:
              editForm.priority,

            target_description:
              editForm.description ||
              null,

            target_blocking:
              Boolean(
                editForm.blocking
              ),

            target_comment:
              editForm.comment ||
              null,

            target_performed_by:
              performedBy,
          }
        );


      if (
        error
      ) {
        throw error;
      }


      setShowEditModal(
        false
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (
      error
    ) {

      console.error(
        'Edit Constraint:',
        error
      );


      setHistoryError(
        error.message ||
        'Constraint details could not be updated.'
      );

    } finally {

      setSavingEdit(
        false
      );

    }

  }


  // ==========================================================
  // COMMENT
  // ==========================================================

  function openCommentModal() {

    setCommentText(
      ''
    );


    setShowCommentModal(
      true
    );

  }


  async function saveConstraintComment(
    event
  ) {

    event.preventDefault();


    if (
      !managedConstraint ||
      savingComment
    ) {
      return;
    }


    const comment =
      String(
        commentText ||
        ''
      ).trim();


    if (
      !comment
    ) {

      setHistoryError(
        'Comment is required.'
      );

      return;

    }


    setSavingComment(
      true
    );


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
              comment,

            target_performed_by:
              performedBy,
          }
        );


      if (
        error
      ) {
        throw error;
      }


      setShowCommentModal(
        false
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (
      error
    ) {

      console.error(
        'Constraint Comment:',
        error
      );


      setHistoryError(
        error.message ||
        'Comment could not be added.'
      );

    } finally {

      setSavingComment(
        false
      );

    }

  }


  // ==========================================================
  // FORECAST
  // ==========================================================

  function openForecastModal() {

    setForecastForm(
      createForecastForm(
        managedConstraint
      )
    );


    setShowForecastModal(
      true
    );

  }


  async function saveForecast(
    event
  ) {

    event.preventDefault();


    if (
      savingForecast ||
      !managedConstraint
    ) {
      return;
    }


    if (
      !forecastForm
        .new_resolution_date ||
      !String(
        forecastForm.reason ||
        ''
      ).trim()
    ) {

      setHistoryError(
        'New Planned Resolution Date and Reason are required.'
      );

      return;

    }


    setSavingForecast(
      true
    );


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
              forecastForm
                .new_resolution_date,

            target_reason:
              forecastForm.reason,

            target_performed_by:
              performedBy,
          }
        );


      if (
        error
      ) {
        throw error;
      }


      setShowForecastModal(
        false
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (
      error
    ) {

      console.error(
        'Constraint Forecast:',
        error
      );


      setHistoryError(
        error.message ||
        'Forecast could not be updated.'
      );

    } finally {

      setSavingForecast(
        false
      );

    }

  }


  // ==========================================================
  // LIFECYCLE ACTIONS
  // ==========================================================

  function openLifecycleAction(
    action
  ) {

    setLifecycleAction(
      action
    );


    setLifecycleNote(
      ''
    );


    setHistoryError(
      ''
    );

  }


  function getLifecycleConfiguration(
    action
  ) {

    switch (
      action
    ) {

      case 'start':
        return {
          eyebrow:
            'LIFECYCLE',

          title:
            'Start Action',

          description:
            'Move this constraint from Open to In Progress.',

          label:
            'Optional Comment',

          placeholder:
            'Example: Procurement team started contacting suppliers.',

          required:
            false,

          button:
            'Start Action',
        };


      case 'waiting':
        return {
          eyebrow:
            'LIFECYCLE',

          title:
            'Set Waiting',

          description:
            'Record why active resolution work cannot continue.',

          label:
            'Reason for Waiting',

          placeholder:
            'Example: Waiting for supplier confirmation.',

          required:
            true,

          button:
            'Set Waiting',
        };


      case 'resume':
        return {
          eyebrow:
            'LIFECYCLE',

          title:
            'Resume Action',

          description:
            'Move this constraint back to active resolution.',

          label:
            'Optional Comment',

          placeholder:
            'Example: Supplier response received. Procurement resumed.',

          required:
            false,

          button:
            'Resume Action',
        };


      case 'resolve':
        return {
          eyebrow:
            'RESOLUTION',

          title:
            'Resolve Constraint',

          description:
            'Report that the required action has been completed. The constraint will remain blocking until verified and cleared.',

          label:
            'Resolution Note',

          placeholder:
            'Example: Supplier confirmed material delivery for August 29.',

          required:
            true,

          button:
            'Mark Resolved',
        };


      case 'clear':
        return {
          eyebrow:
            'VERIFICATION',

          title:
            'Verify & Clear',

          description:
            'Confirm that the reported resolution is valid and affected work may proceed.',

          label:
            'Verification Note',

          placeholder:
            'Example: Delivery confirmation reviewed. Material availability no longer blocks production.',

          required:
            true,

          button:
            'Verify & Clear',
        };


      case 'cancel':
        return {
          eyebrow:
            'CONSTRAINT MANAGEMENT',

          title:
            'Cancel Constraint',

          description:
            'Cancel means the constraint is no longer applicable. It does not mean the issue was successfully resolved.',

          label:
            'Cancellation Reason',

          placeholder:
            'Example: Work package removed from current scope.',

          required:
            true,

          button:
            'Cancel Constraint',
        };


      default:
        return null;
    }

  }


  async function executeLifecycleAction(
    event
  ) {

    event.preventDefault();


    if (
      !managedConstraint ||
      !lifecycleAction ||
      savingLifecycle
    ) {
      return;
    }


    const configuration =
      getLifecycleConfiguration(
        lifecycleAction
      );


    const note =
      String(
        lifecycleNote ||
        ''
      ).trim();


    if (
      configuration
        ?.required &&
      !note
    ) {

      setHistoryError(
        `${configuration.label} is required.`
      );

      return;

    }


    setSavingLifecycle(
      true
    );


    setHistoryError(
      ''
    );


    try {

      const performedBy =
        await getPerformedBy();


      let functionName =
        null;


      let parameters =
        null;


      switch (
        lifecycleAction
      ) {

        case 'start':

          functionName =
            'start_constraint_action_with_history';


          parameters = {
            target_constraint_id:
              managedConstraint.id,

            target_comment:
              note ||
              null,

            target_performed_by:
              performedBy,
          };

          break;


        case 'waiting':

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
              note ||
              null,

            target_performed_by:
              performedBy,
          };

          break;


        case 'resolve':

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

          throw new Error(
            'Unknown lifecycle action.'
          );

      }


      const {
        error,
      } =
        await supabase.rpc(
          functionName,
          parameters
        );


      if (
        error
      ) {
        throw error;
      }


      setLifecycleAction(
        null
      );


      setLifecycleNote(
        ''
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (
      error
    ) {

      console.error(
        'Constraint Lifecycle:',
        error
      );


      setHistoryError(
        error.message ||
        'Constraint lifecycle action could not be completed.'
      );

    } finally {

      setSavingLifecycle(
        false
      );

    }

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
          (
            relationship
          ) => {

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
          ] ||
          [];


        const candidates =
          [];


        relationships.forEach(
          (
            relationship
          ) => {

            if (
              relationship
                .lookahead_work_item_id
            ) {

              const item =
                lookaheadItems[
                  relationship
                    .lookahead_work_item_id
                ];


              if (
                item &&
                (
                  item.package_code ||
                  item.location_path ||
                  item.location_name
                )
              ) {

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
                    item.lookahead_start_date ||
                    null,

                  finishDate:
                    item.lookahead_finish_date ||
                    null,
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


              if (
                item
              ) {

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
                    item.scheduled_start_date ||
                    null,

                  finishDate:
                    item.scheduled_finish_date ||
                    null,
                });

              }

            }

          }
        );


        const unique =
          new Map();


        candidates.forEach(
          (
            item
          ) => {

            const key =
              `${normalizeText(
                item.packageCode
              )}|${normalizeText(
                item.location
              )}`;


            const existing =
              unique.get(
                key
              );


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
      () => {

        if (
          !managedConstraint
        ) {
          return [];
        }


        return getConstraintAffectedWork(
          managedConstraint
        );

      },
      [
        managedConstraint,
        getConstraintAffectedWork,
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
                (
                  constraint
                ) =>
                  constraint.category
              )
              .filter(
                Boolean
              )
          )
        ).sort(),
      [
        constraints,
      ]
    );


  const priorityOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            constraints
              .map(
                (
                  constraint
                ) =>
                  constraint.priority
              )
              .filter(
                Boolean
              )
          )
        ).sort(),
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
                (
                  constraint
                ) =>
                  constraint
                    .responsible_party
              )
              .filter(
                Boolean
              )
          )
        ).sort(),
      [
        constraints,
      ]
    );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    useMemo(
      () => ({

        active:
          constraints.filter(
            (
              constraint
            ) =>
              ACTIVE_STATUSES.includes(
                constraint.status
              )
          ).length,

        overdue:
          constraints.filter(
            (
              constraint
            ) => {

              if (
                TERMINAL_STATUSES.includes(
                  constraint.status
                )
              ) {
                return false;
              }


              const forecast =
                constraint
                  .target_resolution_date ||
                constraint
                  .required_by_date;


              if (
                !forecast
              ) {
                return false;
              }


              const today =
                new Date()
                  .toISOString()
                  .slice(
                    0,
                    10
                  );


              return (
                forecast <
                today
              );

            }
          ).length,

        resolved:
          constraints.filter(
            (
              constraint
            ) =>
              constraint.status ===
              'resolved'
          ).length,

        cleared:
          constraints.filter(
            (
              constraint
            ) =>
              constraint.status ===
              'cleared'
          ).length,

      }),
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
          (
            constraint
          ) => {

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
              constraint.priority !==
              priorityFilter
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


            if (
              !search
            ) {
              return true;
            }


            const affected =
              getConstraintAffectedWork(
                constraint
              );


            return normalizeText(
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

                constraint.priority,

                constraint.status,

                getSourceLabel(
                  constraint
                ),

                ...affected.map(
                  (
                    item
                  ) =>
                    `${item.packageCode} ${item.location}`
                ),
              ].join(
                ' '
              )
            ).includes(
              search
            );

          }
        );

      },
      [
        constraints,
        statusFilter,
        categoryFilter,
        priorityFilter,
        responsibleFilter,
        searchTerm,
        getConstraintAffectedWork,
      ]
    );


  const managedForecast =
    useMemo(
      () =>
        getForecastAssessment(
          managedConstraint
        ),
      [
        managedConstraint,
      ]
    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      style={
        pageStyle
      }
    >

      {/* ====================================================
          HEADER
      ===================================================== */}

      <div
        style={
          pageHeaderStyle
        }
      >

        <div>

          <h1
            style={
              pageTitleStyle
            }
          >
            CONSTRAINT LOG
          </h1>


          <p
            style={
              pageDescriptionStyle
            }
          >
            Central project-level management of constraints,
            ownership, actions, forecasts and readiness clearance.
          </p>

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


      {/* ====================================================
          PROJECT
      ===================================================== */}

      <div
        style={
          projectRowStyle
        }
      >

        <div
          style={{
            width:
              'min(360px,100%)',
          }}
        >

          <label
            style={
              labelStyle
            }
          >
            Project
          </label>


          <select
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

            style={
              inputStyle
            }
          >

            <option value="">
              -- Select a Project --
            </option>


            {projects.map(
              (
                project
              ) => (

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

            onClick={() =>
              loadConstraintLog(
                selectedProjectId
              )
            }

            style={
              secondaryButtonStyle
            }
          >
            Refresh
          </button>

        )}

      </div>


      {errorMessage && (
        <MessageBox
          type="error"
        >
          {errorMessage}
        </MessageBox>
      )}


      {successMessage && (
        <MessageBox
          type="success"
        >
          {successMessage}
        </MessageBox>
      )}


      {selectedProjectId && (

        <>

          {/* ==================================================
              KPI
          ================================================== */}

          <div
            style={
              summaryGridStyle
            }
          >

            <SummaryCard
              label="Active Constraints"
              value={
                summary.active
              }
              description="Still affecting readiness"
            />


            <SummaryCard
              label="Overdue"
              value={
                summary.overdue
              }
              description="Past planned resolution"
            />


            <SummaryCard
              label="Resolved"
              value={
                summary.resolved
              }
              description="Awaiting verification"
            />


            <SummaryCard
              label="Cleared"
              value={
                summary.cleared
              }
              description="Verified and released"
            />

          </div>


          {/* ==================================================
              FILTERS
          ================================================== */}

          <div
            style={
              filtersStyle
            }
          >

            <FilterField
              label="Search"
            >
              <input
                value={
                  searchTerm
                }

                onChange={(
                  event
                ) =>
                  setSearchTerm(
                    event.target.value
                  )
                }

                style={
                  filterInputStyle
                }

                placeholder="Reference, package, location, action..."
              />
            </FilterField>


            <FilterField
              label="Status"
            >

              <select
                value={
                  statusFilter
                }

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
                  (
                    option
                  ) => (

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


            <FilterField
              label="Category"
            >

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
                  (
                    category
                  ) => (

                    <option
                      key={
                        category
                      }

                      value={
                        category
                      }
                    >
                      {formatLabel(
                        category
                      )}
                    </option>

                  )
                )}

              </select>

            </FilterField>


            <FilterField
              label="Priority"
            >

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


                {priorityOptions.map(
                  (
                    priority
                  ) => (

                    <option
                      key={
                        priority
                      }

                      value={
                        priority
                      }
                    >
                      {formatLabel(
                        priority
                      )}
                    </option>

                  )
                )}

              </select>

            </FilterField>


            <FilterField
              label="Responsible"
            >

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
                  (
                    responsible
                  ) => (

                    <option
                      key={
                        responsible
                      }

                      value={
                        responsible
                      }
                    >
                      {responsible}
                    </option>

                  )
                )}

              </select>

            </FilterField>

          </div>


          {/* ==================================================
              TABLE
          ================================================== */}

          <div
            style={
              tableContainerStyle
            }
          >

            {loading ? (

              <div
                style={
                  emptyStyle
                }
              >
                Loading Constraint Log...
              </div>

            ) : (

              <table
                style={
                  tableStyle
                }
              >

                <thead>

                  <tr>

                    {[
                      'REFERENCE',
                      'PACKAGE',
                      'LOCATION',
                      'CATEGORY',
                      'STATUS',
                      'PRIORITY',
                      'RESPONSIBLE',
                      'REQUIRED ACTION',
                      'PLANNED RESOLUTION',
                      'SOURCE',
                      'ACTIONS',
                    ].map(
                      (
                        item
                      ) => (

                        <th
                          key={
                            item
                          }

                          style={
                            headerCellStyle
                          }
                        >
                          {item}
                        </th>

                      )
                    )}

                  </tr>

                </thead>


                <tbody>

                  {filteredConstraints.map(
                    (
                      constraint
                    ) => {

                      const affected =
                        getConstraintAffectedWork(
                          constraint
                        );


                      const statusStyle =
                        getStatusStyle(
                          constraint.status
                        );


                      const priorityStyle =
                        getPriorityStyle(
                          constraint.priority
                        );


                      const forecast =
                        getForecastAssessment(
                          constraint
                        );


                      return (

                        <tr
                          key={
                            constraint.id
                          }
                        >

                          <td
                            style={
                              bodyCellStyle
                            }
                          >

                            <strong>
                              {getConstraintReference(
                                constraint.id
                              )}
                            </strong>


                            {constraint.blocking && (

                              <div
                                style={
                                  blockingStyle
                                }
                              >
                                BLOCKING
                              </div>

                            )}

                          </td>


                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            {affected[0]
                              ?.packageCode ||
                              'Project-level'}
                          </td>


                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            {affected[0]
                              ?.location ||
                              'Project-level'}
                          </td>


                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            {formatLabel(
                              constraint.category
                            )}
                          </td>


                          <td
                            style={
                              bodyCellStyle
                            }
                          >

                            <StatusBadge
                              label={
                                getStatusLabel(
                                  constraint.status
                                )
                              }

                              style={
                                statusStyle
                              }
                            />

                          </td>


                          <td
                            style={
                              bodyCellStyle
                            }
                          >

                            <StatusBadge
                              label={
                                formatLabel(
                                  constraint.priority
                                )
                              }

                              style={
                                priorityStyle
                              }
                            />

                          </td>


                          <td
                            style={
                              leftCellStyle
                            }
                          >
                            {constraint
                              .responsible_party}
                          </td>


                          <td
                            style={
                              leftCellStyle
                            }
                          >
                            {constraint
                              .action_required}
                          </td>


                          <td
                            style={
                              bodyCellStyle
                            }
                          >

                            {formatDate(
                              constraint
                                .target_resolution_date ||
                              constraint
                                .required_by_date
                            )}


                            {forecast.delayed && (

                              <div
                                style={
                                  blockingStyle
                                }
                              >
                                {
                                  forecast
                                    .varianceLabel
                                }
                              </div>

                            )}

                          </td>


                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            {getSourceLabel(
                              constraint
                            )}
                          </td>


                          <td
                            style={
                              bodyCellStyle
                            }
                          >

                            <button
                              type="button"

                              onClick={() =>
                                openManagementDrawer(
                                  constraint
                                )
                              }

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

        </>

      )}


      {/* ====================================================
          MANAGEMENT DRAWER
      ===================================================== */}

      {showManagementDrawer &&
        managedConstraint && (

        <>

          <div
            style={
              drawerOverlayStyle
            }

            onClick={
              closeManagementDrawer
            }
          />


          <aside
            style={
              drawerStyle
            }
          >

            <div
              style={
                drawerHeaderStyle
              }
            >

              <div>

                <div
                  style={
                    eyebrowStyle
                  }
                >
                  CONSTRAINT MANAGEMENT
                </div>


                <h2
                  style={
                    drawerTitleStyle
                  }
                >
                  {getConstraintReference(
                    managedConstraint.id
                  )}
                </h2>


                <div
                  style={
                    drawerSubtitleStyle
                  }
                >
                  {managedConstraint.title}
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


            <div
              style={
                drawerContentStyle
              }
            >

              {/* CURRENT STATE */}

              <ManagementSection
                title="Current State"
              >

                <div
                  style={
                    managementSummaryGridStyle
                  }
                >

                  <ManagementValue
                    label="Status"
                    value={
                      getStatusLabel(
                        managedConstraint.status
                      )
                    }
                  />


                  <ManagementValue
                    label="Priority"
                    value={
                      formatLabel(
                        managedConstraint.priority
                      )
                    }
                  />


                  <ManagementValue
                    label="Category"
                    value={
                      formatLabel(
                        managedConstraint.category
                      )
                    }
                  />


                  <ManagementValue
                    label="Source"
                    value={
                      getSourceLabel(
                        managedConstraint
                      )
                    }
                  />


                  <ManagementValue
                    label="Blocking"
                    value={
                      managedConstraint.blocking
                        ? 'Yes'
                        : 'No'
                    }
                  />

                </div>

              </ManagementSection>


              {/* FORECAST */}

              <ManagementSection
                title="Resolution Forecast"
              >

                <div
                  style={
                    forecastGridStyle
                  }
                >

                  <ForecastCard
                    label="Required By"

                    value={
                      formatDate(
                        managedConstraint
                          .required_by_date
                      )
                    }

                    description="Date required to protect the plan"
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
                    label="Variance"

                    value={
                      managedForecast
                        .varianceLabel
                    }

                    description="Against Required By date"

                    alert={
                      managedForecast
                        .delayed
                    }
                  />


                  <ForecastCard
                    label="Outlook"

                    value={
                      managedForecast
                        .outlook
                    }

                    description={
                      managedForecast
                        .delayed
                        ? 'Forecast exceeds required date'
                        : 'Forecast protects required date'
                    }

                    alert={
                      managedForecast
                        .delayed
                    }
                  />

                </div>

              </ManagementSection>


              {/* OWNERSHIP */}

              <ManagementSection
                title="Ownership & Action"
              >

                <ManagementDetail
                  label="Responsible Party"

                  value={
                    managedConstraint
                      .responsible_party ||
                    '—'
                  }
                />


                <ManagementDetail
                  label="Required Action"

                  value={
                    managedConstraint
                      .action_required ||
                    '—'
                  }
                />


                <ManagementDetail
                  label="Description"

                  value={
                    managedConstraint
                      .description ||
                    managedConstraint
                      .title ||
                    '—'
                  }
                />

              </ManagementSection>


              {/* MANAGEMENT */}

              <ManagementSection
                title="Management"
              >

                <div
                  style={
                    actionGridStyle
                  }
                >

                  {!TERMINAL_STATUSES.includes(
                    managedConstraint.status
                  ) && (

                    <button
                      type="button"

                      onClick={
                        openEditModal
                      }

                      style={
                        actionButtonStyle
                      }
                    >
                      <strong>
                        Edit Details
                      </strong>

                      <span>
                        Owner, action, priority and blocking
                      </span>
                    </button>

                  )}


                  <button
                    type="button"

                    onClick={
                      openCommentModal
                    }

                    style={
                      actionButtonStyle
                    }
                  >
                    <strong>
                      Add Comment
                    </strong>

                    <span>
                      Add a management update
                    </span>
                  </button>


                  {[
                    'open',
                    'in_progress',
                    'waiting',
                  ].includes(
                    managedConstraint.status
                  ) && (

                    <button
                      type="button"

                      onClick={
                        openForecastModal
                      }

                      style={
                        forecastActionButtonStyle
                      }
                    >
                      <strong>
                        Update Forecast
                      </strong>

                      <span>
                        Revise planned resolution date
                      </span>
                    </button>

                  )}


                  {managedConstraint.status ===
                    'open' && (

                    <LifecycleButton
                      label="Start Action"

                      description="Open → In Progress"

                      onClick={() =>
                        openLifecycleAction(
                          'start'
                        )
                      }
                    />

                  )}


                  {managedConstraint.status ===
                    'in_progress' && (

                    <>
                      <LifecycleButton
                        label="Set Waiting"

                        description="In Progress → Waiting"

                        onClick={() =>
                          openLifecycleAction(
                            'waiting'
                          )
                        }
                      />


                      <LifecycleButton
                        label="Resolve"

                        description="Report required action complete"

                        emphasis

                        onClick={() =>
                          openLifecycleAction(
                            'resolve'
                          )
                        }
                      />
                    </>

                  )}


                  {managedConstraint.status ===
                    'waiting' && (

                    <>
                      <LifecycleButton
                        label="Resume Action"

                        description="Waiting → In Progress"

                        onClick={() =>
                          openLifecycleAction(
                            'resume'
                          )
                        }
                      />


                      <LifecycleButton
                        label="Resolve"

                        description="Report required action complete"

                        emphasis

                        onClick={() =>
                          openLifecycleAction(
                            'resolve'
                          )
                        }
                      />
                    </>

                  )}


                  {managedConstraint.status ===
                    'resolved' && (

                    <LifecycleButton
                      label="Verify & Clear"

                      description="Verify resolution and release readiness"

                      emphasis

                      onClick={() =>
                        openLifecycleAction(
                          'clear'
                        )
                      }
                    />

                  )}


                  {[
                    'open',
                    'in_progress',
                    'waiting',
                    'resolved',
                  ].includes(
                    managedConstraint.status
                  ) && (

                    <LifecycleButton
                      label="Cancel Constraint"

                      description="Close as no longer applicable"

                      danger

                      onClick={() =>
                        openLifecycleAction(
                          'cancel'
                        )
                      }
                    />

                  )}

                </div>


                {managedConstraint.status ===
                  'resolved' && (

                  <div
                    style={
                      resolvedNoticeStyle
                    }
                  >
                    This constraint has been reported resolved, but it
                    still blocks readiness until verification is complete.
                  </div>

                )}


                {managedConstraint.status ===
                  'cleared' && (

                  <div
                    style={
                      clearedNoticeStyle
                    }
                  >
                    Resolution verified. This constraint is cleared and
                    no longer blocks associated readiness.
                  </div>

                )}

              </ManagementSection>


              {/* AFFECTED WORK */}

              <ManagementSection
                title="Affected Work"

                subtitle={`${managedAffectedWork.length} unique linked work item${managedAffectedWork.length === 1 ? '' : 's'}`}
              >

                {managedAffectedWork.length ===
                0 ? (

                  <div
                    style={
                      emptyInnerStyle
                    }
                  >
                    Project-level constraint with no specific work
                    occurrence linked.
                  </div>

                ) : (

                  managedAffectedWork.map(
                    (
                      item
                    ) => (

                      <div
                        key={
                          item.key
                        }

                        style={
                          affectedWorkCardStyle
                        }
                      >

                        <strong>
                          {item.packageCode}

                          {item.serviceName
                            ? ` · ${item.serviceName}`
                            : ''}
                        </strong>


                        <div
                          style={
                            affectedLocationStyle
                          }
                        >
                          {item.location}
                        </div>


                        <div
                          style={
                            affectedMetaStyle
                          }
                        >
                          {item.type}

                          {item.startDate
                            ? ` · ${formatDate(item.startDate)}`
                            : ''}

                          {item.finishDate
                            ? ` → ${formatDate(item.finishDate)}`
                            : ''}
                        </div>

                      </div>

                    )
                  )

                )}

              </ManagementSection>


              {/* ACTION HISTORY */}

              <ManagementSection
                title="Action History"

                subtitle="Read-only audit trail"
              >

                {historyError && (

                  <MessageBox
                    type="error"
                  >
                    {historyError}
                  </MessageBox>

                )}


                {loadingHistory ? (

                  <div
                    style={
                      emptyInnerStyle
                    }
                  >
                    Loading Action History...
                  </div>

                ) : constraintHistory.length ===
                  0 ? (

                  <div
                    style={
                      emptyInnerStyle
                    }
                  >
                    No Action History recorded yet.
                  </div>

                ) : (

                  constraintHistory.map(
                    (
                      entry
                    ) => (

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

              </ManagementSection>

            </div>

          </aside>

        </>

      )}


      {/* ====================================================
          CREATE MODAL
      ===================================================== */}

      {showCreateModal && (

        <ModalShell
          eyebrow="PROJECT CONSTRAINT"

          title="Add Constraint"

          onClose={() =>
            setShowCreateModal(
              false
            )
          }
        >

          <form
            onSubmit={
              createConstraint
            }
          >

            <div
              style={
                twoColumnStyle
              }
            >

              <ModalField
                label="Category"
              >

                <select
                  value={
                    form.category
                  }

                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        category:
                          event.target.value,
                      })
                    )
                  }

                  style={
                    modalInputStyle
                  }
                >

                  {CATEGORY_OPTIONS.map(
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
                label="Priority"
              >

                <select
                  value={
                    form.priority
                  }

                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        priority:
                          event.target.value,
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

            </div>


            <ModalField
              label="What is blocking the work?"
            >

              <input
                value={
                  form.title
                }

                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,

                      title:
                        event.target.value,
                    })
                  )
                }

                style={
                  modalInputStyle
                }
              />

            </ModalField>


            <div
              style={
                twoColumnStyle
              }
            >

              <ModalField
                label="Responsible Party"
              >

                <input
                  value={
                    form
                      .responsible_party
                  }

                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        responsible_party:
                          event.target.value,
                      })
                    )
                  }

                  style={
                    modalInputStyle
                  }
                />

              </ModalField>


              <ModalField
                label="Required By Date"
              >

                <input
                  type="date"

                  value={
                    form
                      .required_by_date
                  }

                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        required_by_date:
                          event.target.value,
                      })
                    )
                  }

                  style={
                    modalInputStyle
                  }
                />

              </ModalField>

            </div>


            <ModalField
              label="Required Action"
            >

              <textarea
                value={
                  form
                    .action_required
                }

                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,

                      action_required:
                        event.target.value,
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
                  form.description
                }

                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,

                      description:
                        event.target.value,
                    })
                  )
                }

                style={
                  modalTextareaStyle
                }
              />

            </ModalField>


            <label
              style={
                checkboxStyle
              }
            >

              <input
                type="checkbox"

                checked={
                  form.blocking
                }

                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,

                      blocking:
                        event.target.checked,
                    })
                  )
                }
              />

              Blocking Constraint

            </label>


            <ModalActions>

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

            </ModalActions>

          </form>

        </ModalShell>

      )}


      {/* ====================================================
          EDIT MODAL
      ===================================================== */}

      {showEditModal &&
        managedConstraint && (

        <ModalShell
          eyebrow="CONSTRAINT MANAGEMENT"

          title="Edit Details"

          onClose={() =>
            setShowEditModal(
              false
            )
          }
        >

          <form
            onSubmit={
              saveConstraintDetails
            }
          >

            <div
              style={
                twoColumnStyle
              }
            >

              <ModalField
                label="Responsible Party"
              >

                <input
                  value={
                    editForm
                      .responsible_party
                  }

                  onChange={(
                    event
                  ) =>
                    setEditForm(
                      (
                        current
                      ) => ({
                        ...current,

                        responsible_party:
                          event.target.value,
                      })
                    )
                  }

                  style={
                    modalInputStyle
                  }
                />

              </ModalField>


              <ModalField
                label="Priority"
              >

                <select
                  value={
                    editForm.priority
                  }

                  onChange={(
                    event
                  ) =>
                    setEditForm(
                      (
                        current
                      ) => ({
                        ...current,

                        priority:
                          event.target.value,
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

            </div>


            <ModalField
              label="Required Action"
            >

              <textarea
                value={
                  editForm
                    .action_required
                }

                onChange={(
                  event
                ) =>
                  setEditForm(
                    (
                      current
                    ) => ({
                      ...current,

                      action_required:
                        event.target.value,
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
                value={
                  editForm.description
                }

                onChange={(
                  event
                ) =>
                  setEditForm(
                    (
                      current
                    ) => ({
                      ...current,

                      description:
                        event.target.value,
                    })
                  )
                }

                style={
                  modalTextareaStyle
                }
              />

            </ModalField>


            <ModalField
              label="Reason / Comment"
            >

              <textarea
                value={
                  editForm.comment
                }

                onChange={(
                  event
                ) =>
                  setEditForm(
                    (
                      current
                    ) => ({
                      ...current,

                      comment:
                        event.target.value,
                    })
                  )
                }

                style={
                  modalTextareaStyle
                }
              />

            </ModalField>


            <label
              style={
                checkboxStyle
              }
            >

              <input
                type="checkbox"

                checked={
                  editForm.blocking
                }

                onChange={(
                  event
                ) =>
                  setEditForm(
                    (
                      current
                    ) => ({
                      ...current,

                      blocking:
                        event.target.checked,
                    })
                  )
                }
              />

              Blocking Constraint

            </label>


            <ModalActions>

              <button
                type="button"

                onClick={() =>
                  setShowEditModal(
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
                  savingEdit
                }

                style={
                  primaryButtonStyle
                }
              >
                {savingEdit
                  ? 'Saving...'
                  : 'Save Changes'}
              </button>

            </ModalActions>

          </form>

        </ModalShell>

      )}


      {/* ====================================================
          COMMENT MODAL
      ===================================================== */}

      {showCommentModal &&
        managedConstraint && (

        <ModalShell
          eyebrow="ACTION HISTORY"

          title="Add Comment"

          onClose={() =>
            setShowCommentModal(
              false
            )
          }
        >

          <form
            onSubmit={
              saveConstraintComment
            }
          >

            <ModalField
              label="Management Update"
            >

              <textarea
                value={
                  commentText
                }

                onChange={(
                  event
                ) =>
                  setCommentText(
                    event.target.value
                  )
                }

                style={{
                  ...modalTextareaStyle,

                  minHeight:
                    '130px',
                }}
              />

            </ModalField>


            <ModalActions>

              <button
                type="button"

                onClick={() =>
                  setShowCommentModal(
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
                  savingComment
                }

                style={
                  primaryButtonStyle
                }
              >
                {savingComment
                  ? 'Adding...'
                  : 'Add Comment'}
              </button>

            </ModalActions>

          </form>

        </ModalShell>

      )}


      {/* ====================================================
          FORECAST MODAL
      ===================================================== */}

      {showForecastModal &&
        managedConstraint && (

        <ModalShell
          eyebrow="SCHEDULE EXPOSURE"

          title="Update Forecast"

          onClose={() =>
            setShowForecastModal(
              false
            )
          }
        >

          <div
            style={
              forecastModalGridStyle
            }
          >

            <ForecastCard
              label="Required By"

              value={
                formatDate(
                  managedConstraint
                    .required_by_date
                )
              }

              description="Original required date"
            />


            <ForecastCard
              label="Current Forecast"

              value={
                formatDate(
                  managedConstraint
                    .target_resolution_date ||
                  managedConstraint
                    .required_by_date
                )
              }

              description="Current planned resolution"
            />

          </div>


          <form
            onSubmit={
              saveForecast
            }
          >

            <ModalField
              label="New Planned Resolution Date"
            >

              <input
                type="date"

                value={
                  forecastForm
                    .new_resolution_date
                }

                onChange={(
                  event
                ) =>
                  setForecastForm(
                    (
                      current
                    ) => ({
                      ...current,

                      new_resolution_date:
                        event.target.value,
                    })
                  )
                }

                style={
                  modalInputStyle
                }
              />

            </ModalField>


            <ModalField
              label="Reason for Forecast Change"
            >

              <textarea
                value={
                  forecastForm.reason
                }

                onChange={(
                  event
                ) =>
                  setForecastForm(
                    (
                      current
                    ) => ({
                      ...current,

                      reason:
                        event.target.value,
                    })
                  )
                }

                style={{
                  ...modalTextareaStyle,

                  minHeight:
                    '120px',
                }}
              />

            </ModalField>


            <div
              style={
                warningBoxStyle
              }
            >
              Required By will remain unchanged. The previous forecast
              and reason for revision will be retained in Action History.
            </div>


            <ModalActions>

              <button
                type="button"

                onClick={() =>
                  setShowForecastModal(
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
                  savingForecast
                }

                style={
                  primaryButtonStyle
                }
              >
                {savingForecast
                  ? 'Updating...'
                  : 'Update Forecast'}
              </button>

            </ModalActions>

          </form>

        </ModalShell>

      )}


      {/* ====================================================
          LIFECYCLE MODAL
      ===================================================== */}

      {lifecycleAction &&
        managedConstraint && (

        <ModalShell
          eyebrow={
            getLifecycleConfiguration(
              lifecycleAction
            )?.eyebrow
          }

          title={
            getLifecycleConfiguration(
              lifecycleAction
            )?.title
          }

          onClose={() =>
            setLifecycleAction(
              null
            )
          }
        >

          <p
            style={
              lifecycleDescriptionStyle
            }
          >
            {
              getLifecycleConfiguration(
                lifecycleAction
              )?.description
            }
          </p>


          {lifecycleAction ===
            'clear' && (

            <div
              style={
                verificationWarningStyle
              }
            >
              Clearing this constraint will release its associated
              Lookahead/Koskela readiness condition.
            </div>

          )}


          <form
            onSubmit={
              executeLifecycleAction
            }
          >

            <ModalField
              label={
                getLifecycleConfiguration(
                  lifecycleAction
                )?.label
              }
            >

              <textarea
                value={
                  lifecycleNote
                }

                placeholder={
                  getLifecycleConfiguration(
                    lifecycleAction
                  )?.placeholder
                }

                onChange={(
                  event
                ) =>
                  setLifecycleNote(
                    event.target.value
                  )
                }

                style={{
                  ...modalTextareaStyle,

                  minHeight:
                    '125px',
                }}
              />

            </ModalField>


            <ModalActions>

              <button
                type="button"

                onClick={() =>
                  setLifecycleAction(
                    null
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
                  savingLifecycle
                }

                style={
                  lifecycleAction ===
                    'cancel'
                    ? dangerPrimaryButtonStyle
                    : primaryButtonStyle
                }
              >
                {savingLifecycle
                  ? 'Processing...'
                  : getLifecycleConfiguration(
                      lifecycleAction
                    )?.button}
              </button>

            </ModalActions>

          </form>

        </ModalShell>

      )}

    </div>
  );
}


// ============================================================
// COMPONENTS
// ============================================================

function SummaryCard({
  label,
  value,
  description,
}) {

  return (
    <div
      style={
        summaryCardStyle
      }
    >

      <div
        style={
          summaryLabelStyle
        }
      >
        {label}
      </div>


      <div
        style={
          summaryValueStyle
        }
      >
        {value}
      </div>


      <div
        style={
          summaryDescriptionStyle
        }
      >
        {description}
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

      <label
        style={
          filterLabelStyle
        }
      >
        {label}
      </label>

      {children}

    </div>
  );
}


function ManagementSection({
  title,
  subtitle,
  children,
}) {

  return (
    <section
      style={
        managementSectionStyle
      }
    >

      <h3
        style={
          sectionTitleStyle
        }
      >
        {title}
      </h3>


      {subtitle && (

        <div
          style={
            sectionSubtitleStyle
          }
        >
          {subtitle}
        </div>

      )}


      <div
        style={{
          marginTop:
            '12px',
        }}
      >
        {children}
      </div>

    </section>
  );
}


function ManagementValue({
  label,
  value,
}) {

  return (
    <div>

      <div
        style={
          metaLabelStyle
        }
      >
        {label}
      </div>


      <div
        style={
          valueStyle
        }
      >
        {value}
      </div>

    </div>
  );
}


function ManagementDetail({
  label,
  value,
}) {

  return (
    <div
      style={{
        marginBottom:
          '14px',
      }}
    >

      <div
        style={
          metaLabelStyle
        }
      >
        {label}
      </div>


      <div
        style={
          detailValueStyle
        }
      >
        {value}
      </div>

    </div>
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
            ? '#fef2f2'
            : '#f8fafc',

        borderColor:
          alert
            ? '#fecaca'
            : '#e2e8f0',
      }}
    >

      <div
        style={
          metaLabelStyle
        }
      >
        {label}
      </div>


      <strong
        style={{
          display:
            'block',

          marginTop:
            '5px',

          color:
            alert
              ? '#b91c1c'
              : '#0f172a',

          fontSize:
            '12px',
        }}
      >
        {value}
      </strong>


      <div
        style={{
          marginTop:
            '4px',

          color:
            alert
              ? '#991b1b'
              : '#64748b',

          fontSize:
            '8px',
        }}
      >
        {description}
      </div>

    </div>
  );
}


function LifecycleButton({
  label,
  description,
  onClick,
  emphasis,
  danger,
}) {

  return (
    <button
      type="button"

      onClick={
        onClick
      }

      style={{
        ...actionButtonStyle,

        background:
          danger
            ? '#fef2f2'
            : emphasis
              ? '#f0fdf4'
              : '#ffffff',

        borderColor:
          danger
            ? '#fecaca'
            : emphasis
              ? '#86efac'
              : '#cbd5e1',

        color:
          danger
            ? '#b91c1c'
            : emphasis
              ? '#166534'
              : '#334155',
      }}
    >

      <strong>
        {label}
      </strong>


      <span>
        {description}
      </span>

    </button>
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
    <div
      style={
        historyCardStyle
      }
    >

      <div
        style={
          historyHeaderStyle
        }
      >

        <div>

          <strong>
            {getActionTypeLabel(
              entry.action_type
            )}
          </strong>


          <div
            style={
              historyActorStyle
            }
          >
            {entry.performed_by ||
              'System / Legacy Record'}
          </div>

        </div>


        <div
          style={
            historyDateStyle
          }
        >
          {formatDateTime(
            entry.created_at
          )}
        </div>

      </div>


      {statusChanged && (

        <HistoryChange
          label="Status"

          value={`${entry.status_from
            ? getStatusLabel(
                entry.status_from
              )
            : '—'} → ${entry.status_to
            ? getStatusLabel(
                entry.status_to
              )
            : '—'}`}
        />

      )}


      {forecastChanged && (

        <HistoryChange
          label="Forecast"

          value={`${formatDate(
            entry
              .previous_target_resolution_date
          )} → ${formatDate(
            entry
              .new_target_resolution_date
          )}`}
        />

      )}


      {entry.comment && (

        <div
          style={
            historyCommentStyle
          }
        >
          {entry.comment}
        </div>

      )}

    </div>
  );
}


function HistoryChange({
  label,
  value,
}) {

  return (
    <div
      style={
        historyChangeStyle
      }
    >

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}


function StatusBadge({
  label,
  style,
}) {

  return (
    <span
      style={{
        ...badgeStyle,

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


function ModalShell({
  eyebrow,
  title,
  onClose,
  children,
}) {

  return (
    <div
      style={
        modalOverlayStyle
      }
    >

      <div
        style={
          modalStyle
        }
      >

        <div
          style={
            modalHeaderStyle
          }
        >

          <div>

            <div
              style={
                eyebrowStyle
              }
            >
              {eyebrow}
            </div>


            <h2
              style={
                modalTitleStyle
              }
            >
              {title}
            </h2>

          </div>


          <button
            type="button"

            onClick={
              onClose
            }

            style={
              closeButtonStyle
            }
          >
            ×
          </button>

        </div>


        <div
          style={{
            padding:
              '20px',
          }}
        >
          {children}
        </div>

      </div>

    </div>
  );
}


function ModalField({
  label,
  children,
}) {

  return (
    <div
      style={{
        marginBottom:
          '15px',
      }}
    >

      <label
        style={
          modalLabelStyle
        }
      >
        {label}
      </label>

      {children}

    </div>
  );
}


function ModalActions({
  children,
}) {

  return (
    <div
      style={
        modalActionsStyle
      }
    >
      {children}
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
          ? errorBoxStyle
          : successBoxStyle
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
    '18px 20px 40px',

  background:
    '#f8fafc',

  color:
    '#0f172a',
};


const pageHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '16px',

  marginBottom:
    '18px',
};


const pageTitleStyle = {
  margin:
    0,

  fontSize:
    '22px',

  fontWeight:
    900,
};


const pageDescriptionStyle = {
  margin:
    '6px 0 0',

  color:
    '#64748b',

  fontSize:
    '11px',
};


const projectRowStyle = {
  display:
    'flex',

  alignItems:
    'flex-end',

  gap:
    '12px',

  marginBottom:
    '16px',
};


const labelStyle = {
  display:
    'block',

  marginBottom:
    '5px',

  fontSize:
    '11px',

  fontWeight:
    700,
};


const inputStyle = {
  width:
    '100%',

  height:
    '36px',

  padding:
    '0 9px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#ffffff',
};


const summaryGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(4, minmax(0, 1fr))',

  gap:
    '10px',

  marginBottom:
    '14px',
};


const summaryCardStyle = {
  padding:
    '14px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',

  background:
    '#ffffff',
};


const summaryLabelStyle = {
  color:
    '#64748b',

  fontSize:
    '9px',

  fontWeight:
    900,
};


const summaryValueStyle = {
  marginTop:
    '5px',

  fontSize:
    '25px',

  fontWeight:
    900,
};


const summaryDescriptionStyle = {
  marginTop:
    '7px',

  color:
    '#94a3b8',

  fontSize:
    '9px',
};


const filtersStyle = {
  display:
    'grid',

  gridTemplateColumns:
    '2fr repeat(4, 1fr)',

  gap:
    '8px',

  padding:
    '12px',

  marginBottom:
    '12px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',

  background:
    '#ffffff',
};


const filterLabelStyle = {
  display:
    'block',

  marginBottom:
    '4px',

  color:
    '#64748b',

  fontSize:
    '9px',

  fontWeight:
    900,
};


const filterInputStyle = {
  width:
    '100%',

  height:
    '34px',

  padding:
    '0 8px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '5px',

  background:
    '#ffffff',

  fontSize:
    '10px',
};


const tableContainerStyle = {
  overflowX:
    'auto',

  border:
    '1px solid #cbd5e1',

  background:
    '#ffffff',
};


const tableStyle = {
  width:
    '100%',

  minWidth:
    '1500px',

  borderCollapse:
    'collapse',

  tableLayout:
    'fixed',
};


const headerCellStyle = {
  padding:
    '7px',

  border:
    '1px solid #cbd5e1',

  background:
    '#f8fafc',

  fontSize:
    '8px',

  fontWeight:
    900,

  textAlign:
    'center',
};


const bodyCellStyle = {
  padding:
    '7px',

  border:
    '1px solid #e2e8f0',

  fontSize:
    '9px',

  textAlign:
    'center',
};


const leftCellStyle = {
  ...bodyCellStyle,

  textAlign:
    'left',
};


const blockingStyle = {
  marginTop:
    '3px',

  color:
    '#b91c1c',

  fontSize:
    '8px',

  fontWeight:
    900,
};


const badgeStyle = {
  display:
    'inline-flex',

  padding:
    '4px 7px',

  borderRadius:
    '999px',

  fontSize:
    '8px',

  fontWeight:
    900,
};


const primaryButtonStyle = {
  height:
    '36px',

  padding:
    '0 13px',

  border:
    '1px solid #2563eb',

  borderRadius:
    '6px',

  background:
    '#2563eb',

  color:
    '#ffffff',

  fontWeight:
    800,

  cursor:
    'pointer',
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
    '36px',

  padding:
    '0 12px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#ffffff',

  color:
    '#334155',

  fontWeight:
    700,

  cursor:
    'pointer',
};


const manageButtonStyle = {
  height:
    '29px',

  padding:
    '0 10px',

  border:
    '1px solid #93c5fd',

  borderRadius:
    '5px',

  background:
    '#eff6ff',

  color:
    '#1d4ed8',

  fontSize:
    '9px',

  fontWeight:
    900,

  cursor:
    'pointer',
};


const emptyStyle = {
  padding:
    '40px',

  textAlign:
    'center',

  color:
    '#64748b',
};


const emptyInnerStyle = {
  padding:
    '16px',

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
    '9px',
};


// ============================================================
// DRAWER
// ============================================================

const drawerOverlayStyle = {
  position:
    'fixed',

  inset:
    0,

  zIndex:
    7998,

  background:
    'rgba(15,23,42,0.32)',
};


const drawerStyle = {
  position:
    'fixed',

  top:
    0,

  right:
    0,

  bottom:
    0,

  zIndex:
    7999,

  width:
    'min(660px,95vw)',

  overflowY:
    'auto',

  background:
    '#f8fafc',

  boxShadow:
    '-20px 0 60px rgba(15,23,42,0.22)',
};


const drawerHeaderStyle = {
  position:
    'sticky',

  top:
    0,

  zIndex:
    3,

  display:
    'flex',

  justifyContent:
    'space-between',

  padding:
    '20px',

  borderBottom:
    '1px solid #e2e8f0',

  background:
    '#ffffff',
};


const drawerTitleStyle = {
  margin:
    '4px 0 0',

  fontSize:
    '20px',

  fontWeight:
    900,
};


const drawerSubtitleStyle = {
  marginTop:
    '5px',

  color:
    '#475569',

  fontSize:
    '11px',

  fontWeight:
    600,
};


const drawerContentStyle = {
  display:
    'grid',

  gap:
    '12px',

  padding:
    '14px',
};


const managementSectionStyle = {
  padding:
    '15px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '8px',

  background:
    '#ffffff',
};


const sectionTitleStyle = {
  margin:
    0,

  fontSize:
    '12px',

  fontWeight:
    900,
};


const sectionSubtitleStyle = {
  marginTop:
    '3px',

  color:
    '#94a3b8',

  fontSize:
    '9px',
};


const managementSummaryGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(3, minmax(0,1fr))',

  gap:
    '14px',
};


const metaLabelStyle = {
  color:
    '#94a3b8',

  fontSize:
    '8px',

  fontWeight:
    900,

  textTransform:
    'uppercase',
};


const valueStyle = {
  marginTop:
    '5px',

  fontSize:
    '10px',

  fontWeight:
    700,
};


const detailValueStyle = {
  marginTop:
    '5px',

  color:
    '#334155',

  fontSize:
    '10px',

  lineHeight:
    1.55,
};


const forecastGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2,minmax(0,1fr))',

  gap:
    '8px',
};


const forecastCardStyle = {
  padding:
    '11px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',
};


const actionGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2,minmax(0,1fr))',

  gap:
    '8px',
};


const actionButtonStyle = {
  display:
    'flex',

  flexDirection:
    'column',

  gap:
    '4px',

  padding:
    '10px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '7px',

  background:
    '#ffffff',

  color:
    '#334155',

  textAlign:
    'left',

  cursor:
    'pointer',
};


const forecastActionButtonStyle = {
  ...actionButtonStyle,

  border:
    '1px solid #fdba74',

  background:
    '#fff7ed',

  color:
    '#9a3412',
};


const resolvedNoticeStyle = {
  marginTop:
    '12px',

  padding:
    '10px',

  border:
    '1px solid #ddd6fe',

  borderRadius:
    '6px',

  background:
    '#f5f3ff',

  color:
    '#6d28d9',

  fontSize:
    '9px',
};


const clearedNoticeStyle = {
  marginTop:
    '12px',

  padding:
    '10px',

  border:
    '1px solid #bbf7d0',

  borderRadius:
    '6px',

  background:
    '#f0fdf4',

  color:
    '#166534',

  fontSize:
    '9px',
};


const affectedWorkCardStyle = {
  marginBottom:
    '8px',

  padding:
    '11px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',

  background:
    '#f8fafc',
};


const affectedLocationStyle = {
  marginTop:
    '4px',

  color:
    '#475569',

  fontSize:
    '10px',

  fontWeight:
    700,
};


const affectedMetaStyle = {
  marginTop:
    '7px',

  color:
    '#64748b',

  fontSize:
    '9px',
};


// ============================================================
// HISTORY
// ============================================================

const historyCardStyle = {
  marginBottom:
    '9px',

  padding:
    '11px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',

  background:
    '#f8fafc',
};


const historyHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '10px',
};


const historyActorStyle = {
  marginTop:
    '3px',

  color:
    '#64748b',

  fontSize:
    '8px',
};


const historyDateStyle = {
  color:
    '#94a3b8',

  fontSize:
    '8px',
};


const historyChangeStyle = {
  display:
    'grid',

  gridTemplateColumns:
    '80px 1fr',

  gap:
    '8px',

  marginTop:
    '9px',

  fontSize:
    '9px',
};


const historyCommentStyle = {
  marginTop:
    '9px',

  paddingTop:
    '9px',

  borderTop:
    '1px solid #e2e8f0',

  color:
    '#475569',

  fontSize:
    '9px',

  lineHeight:
    1.5,
};


// ============================================================
// MODAL
// ============================================================

const modalOverlayStyle = {
  position:
    'fixed',

  inset:
    0,

  zIndex:
    9000,

  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'center',

  padding:
    '20px',

  background:
    'rgba(6,27,47,0.62)',
};


const modalStyle = {
  width:
    'min(680px,96vw)',

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


const modalHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  padding:
    '18px 20px',

  borderBottom:
    '1px solid #e2e8f0',
};


const eyebrowStyle = {
  color:
    '#2563eb',

  fontSize:
    '9px',

  fontWeight:
    900,

  letterSpacing:
    '0.08em',
};


const modalTitleStyle = {
  margin:
    '4px 0 0',

  fontSize:
    '19px',

  fontWeight:
    900,
};


const closeButtonStyle = {
  width:
    '34px',

  height:
    '34px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '6px',

  background:
    '#ffffff',

  color:
    '#64748b',

  fontSize:
    '20px',

  cursor:
    'pointer',
};


const modalLabelStyle = {
  display:
    'block',

  marginBottom:
    '6px',

  fontSize:
    '10px',

  fontWeight:
    800,
};


const modalInputStyle = {
  width:
    '100%',

  height:
    '38px',

  padding:
    '0 9px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#ffffff',
};


const modalTextareaStyle = {
  width:
    '100%',

  minHeight:
    '82px',

  padding:
    '9px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  fontFamily:
    'inherit',

  resize:
    'vertical',
};


const twoColumnStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2,minmax(0,1fr))',

  gap:
    '12px',
};


const checkboxStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '8px',

  padding:
    '10px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '6px',

  background:
    '#f8fafc',
};


const modalActionsStyle = {
  display:
    'flex',

  justifyContent:
    'flex-end',

  gap:
    '8px',

  marginTop:
    '20px',
};


const forecastModalGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2,minmax(0,1fr))',

  gap:
    '8px',

  marginBottom:
    '18px',
};


const warningBoxStyle = {
  padding:
    '10px',

  border:
    '1px solid #fde68a',

  borderRadius:
    '6px',

  background:
    '#fffbeb',

  color:
    '#92400e',

  fontSize:
    '9px',
};


const lifecycleDescriptionStyle = {
  margin:
    '0 0 16px',

  color:
    '#475569',

  fontSize:
    '10px',

  lineHeight:
    1.55,
};


const verificationWarningStyle = {
  marginBottom:
    '16px',

  padding:
    '10px',

  border:
    '1px solid #86efac',

  borderRadius:
    '6px',

  background:
    '#f0fdf4',

  color:
    '#166534',

  fontSize:
    '9px',

  fontWeight:
    700,
};


const errorBoxStyle = {
  marginBottom:
    '14px',

  padding:
    '10px',

  border:
    '1px solid #fecaca',

  borderRadius:
    '6px',

  background:
    '#fef2f2',

  color:
    '#b91c1c',

  fontSize:
    '10px',
};


const successBoxStyle = {
  marginBottom:
    '14px',

  padding:
    '10px',

  border:
    '1px solid #bbf7d0',

  borderRadius:
    '6px',

  background:
    '#f0fdf4',

  color:
    '#166534',

  fontSize:
    '10px',
};
