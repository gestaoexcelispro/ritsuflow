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
// Current operational scope:
//
// - Central project Constraint Log
// - Manual project-level constraint creation
// - Constraint Management drawer
// - Edit Details
// - Add Comment
// - Update Forecast
// - Action History
// - Required By vs Planned Resolution
// - Forecast variance / Delay Expected
//
// Lifecycle actions are intentionally NOT active yet:
//
// - Start Action
// - Waiting
// - Resume
// - Resolve
// - Verify & Clear
// - Cancel
//
// Those will be introduced through governed RPCs.
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


function getTodayIso() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
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


function getDueDate(
  constraint
) {
  return (
    constraint
      .target_resolution_date ||
    constraint
      .required_by_date ||
    null
  );
}


function isConstraintOverdue(
  constraint
) {
  const dueDate =
    getDueDate(
      constraint
    );

  if (!dueDate) {
    return false;
  }

  if (
    TERMINAL_STATUSES.includes(
      constraint.status
    )
  ) {
    return false;
  }

  return (
    dueDate <
    getTodayIso()
  );
}


function getSourceLabel(
  constraint
) {
  if (
    constraint
      .readiness_assessment_id
  ) {
    return 'Lookahead / Koskela';
  }

  if (
    constraint
      .lookahead_work_item_id
  ) {
    return 'Lookahead';
  }

  if (
    constraint
      .master_plan_package_id
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


function getStatusStyle(status) {
  switch (status) {

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
  const normalized =
    normalizeText(
      priority
    );

  if (
    normalized ===
    'critical'
  ) {
    return {
      background:
        '#fee2e2',
      border:
        '#ef4444',
      color:
        '#991b1b',
    };
  }

  if (
    normalized ===
    'high'
  ) {
    return {
      background:
        '#fff7ed',
      border:
        '#fdba74',
      color:
        '#c2410c',
    };
  }

  if (
    normalized ===
    'medium'
  ) {
    return {
      background:
        '#fefce8',
      border:
        '#fde047',
      color:
        '#854d0e',
    };
  }

  if (
    normalized ===
    'low'
  ) {
    return {
      background:
        '#f0fdf4',
      border:
        '#86efac',
      color:
        '#166534',
    };
  }

  return {
    background:
      '#f8fafc',
    border:
      '#cbd5e1',
    color:
      '#64748b',
  };
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
  const requiredBy =
    constraint
      ?.required_by_date;

  const plannedResolution =
    constraint
      ?.target_resolution_date ||
    requiredBy;


  const variance =
    dateDifferenceDays(
      requiredBy,
      plannedResolution
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
// INITIAL FORMS
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
  // SELECTED PROJECT
  // ==========================================================

  const selectedProject =
    useMemo(
      () =>
        projects.find(
          (project) =>
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
              (project) =>
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
              (constraint) =>
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
                    (item) =>
                      item
                        .lookahead_work_item_id
                  )
                  .filter(
                    Boolean
                  ),

                ...loadedConstraints
                  .map(
                    (constraint) =>
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
                  (item) => [
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
                    (item) =>
                      item
                        .master_plan_package_id
                  )
                  .filter(
                    Boolean
                  ),

                ...loadedConstraints
                  .map(
                    (constraint) =>
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
                    (item) =>
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
                  (item) => [
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
          !selectedProjectId ||
          !constraintId
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


    setErrorMessage(
      ''
    );


    setSuccessMessage(
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
  // CREATE CONSTRAINT
  // ==========================================================

  function openCreateModal() {

    if (
      !selectedProjectId
    ) {
      return;
    }


    setForm(
      createInitialForm()
    );


    setErrorMessage(
      ''
    );


    setSuccessMessage(
      ''
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
      !selectedProjectId ||
      creatingConstraint
    ) {
      return;
    }


    const title =
      String(
        form.title ||
        ''
      ).trim();


    const actionRequired =
      String(
        form.action_required ||
        ''
      ).trim();


    const responsibleParty =
      String(
        form.responsible_party ||
        ''
      ).trim();


    if (
      !title ||
      !actionRequired ||
      !responsibleParty ||
      !form.required_by_date
    ) {

      setErrorMessage(
        'Title, responsible party, required action and due date are required.'
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
              String(
                form.description ||
                ''
              ).trim() ||
              null,

            target_action_required:
              actionRequired,

            target_responsible_party:
              responsibleParty,

            target_required_by_date:
              form.required_by_date,

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


      const createdConstraintId =
        Array.isArray(
          data
        )
          ? data[0]
          : data;


      setShowCreateModal(
        false
      );


      setSuccessMessage(
        `Constraint ${getConstraintReference(
          createdConstraintId
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
        'The constraint could not be created.'
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

    if (
      !constraint?.id
    ) {
      return;
    }


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


    setShowEditModal(
      false
    );


    setShowCommentModal(
      false
    );


    setShowForecastModal(
      false
    );

  }


  // ==========================================================
  // EDIT DETAILS
  // ==========================================================

  function openEditModal() {

    if (
      !managedConstraint
    ) {
      return;
    }


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


    if (
      !String(
        editForm
          .responsible_party ||
        ''
      ).trim() ||
      !String(
        editForm
          .action_required ||
        ''
      ).trim()
    ) {

      setHistoryError(
        'Responsible Party and Required Action are required.'
      );

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
              editForm.responsible_party,

            target_action_required:
              editForm.action_required,

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


      setSuccessMessage(
        `${getConstraintReference(
          managedConstraint.id
        )} updated successfully.`
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
  // ADD COMMENT
  // ==========================================================

  function openCommentModal() {

    setCommentText(
      ''
    );


    setHistoryError(
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


    const normalizedComment =
      String(
        commentText ||
        ''
      ).trim();


    if (
      !normalizedComment
    ) {

      setHistoryError(
        'Comment is required.'
      );

      return;

    }


    setSavingComment(
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
          'add_constraint_comment_with_history',
          {
            target_constraint_id:
              managedConstraint.id,

            target_comment:
              normalizedComment,

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


      setCommentText(
        ''
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (
      error
    ) {

      console.error(
        'Add Constraint Comment:',
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
  // UPDATE FORECAST
  // ==========================================================

  function openForecastModal() {

    if (
      !managedConstraint
    ) {
      return;
    }


    setForecastForm(
      createForecastForm(
        managedConstraint
      )
    );


    setHistoryError(
      ''
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
      !managedConstraint ||
      savingForecast
    ) {
      return;
    }


    const reason =
      String(
        forecastForm
          .reason ||
        ''
      ).trim();


    if (
      !forecastForm
        .new_resolution_date
    ) {

      setHistoryError(
        'New Planned Resolution Date is required.'
      );

      return;

    }


    if (
      !reason
    ) {

      setHistoryError(
        'Reason for forecast change is required.'
      );

      return;

    }


    setSavingForecast(
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
          'update_constraint_forecast_with_history',
          {
            target_constraint_id:
              managedConstraint.id,

            target_new_resolution_date:
              forecastForm
                .new_resolution_date,

            target_reason:
              reason,

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
        'Update Constraint Forecast:',
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
  // AFFECTED WORK MAP
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


  // ==========================================================
  // AFFECTED WORK
  //
  // Prefer Lookahead representation when it contains useful
  // package/location data. Master Plan fallback is retained.
  // ==========================================================

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


        // ----------------------------------------------------
        // DIRECT LEGACY REFERENCES
        // ----------------------------------------------------

        if (
          constraint
            .lookahead_work_item_id
        ) {

          const item =
            lookaheadItems[
              constraint
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
          constraint
            .master_plan_package_id
        ) {

          const item =
            masterPlanPackages[
              constraint
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


        // ----------------------------------------------------
        // DEDUPLICATE BY PACKAGE + LOCATION
        //
        // If Lookahead and Master Plan describe the same work,
        // keep the Lookahead representation.
        // ----------------------------------------------------

        const unique =
          new Map();


        candidates.forEach(
          (
            item
          ) => {

            const logicalKey =
              [
                normalizeText(
                  item.packageCode
                ),

                normalizeText(
                  item.location
                ),
              ].join(
                '|'
              );


            const existing =
              unique.get(
                logicalKey
              );


            if (
              !existing
            ) {

              unique.set(
                logicalKey,
                item
              );

              return;

            }


            if (
              existing.type ===
                'Master Plan' &&
              item.type ===
                'Lookahead'
            ) {

              unique.set(
                logicalKey,
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
                (constraint) =>
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
                (constraint) =>
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
                (constraint) =>
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
  // KPI SUMMARY
  // ==========================================================

  const summary =
    useMemo(
      () => ({

        active:
          constraints.filter(
            (constraint) =>
              ACTIVE_STATUSES.includes(
                constraint.status
              )
          ).length,

        overdue:
          constraints.filter(
            isConstraintOverdue
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

        const normalizedSearch =
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
              !normalizedSearch
            ) {
              return true;
            }


            const affected =
              getConstraintAffectedWork(
                constraint
              );


            const affectedSearch =
              affected
                .map(
                  (item) =>
                    [
                      item.packageCode,
                      item.serviceName,
                      item.location,
                      item.type,
                    ].join(
                      ' '
                    )
                )
                .join(
                  ' '
                );


            return normalizeText(
              [
                getConstraintReference(
                  constraint.id
                ),

                constraint.title,
                constraint.description,
                constraint.category,
                constraint.action_required,
                constraint.responsible_party,
                constraint.priority,
                constraint.status,

                getSourceLabel(
                  constraint
                ),

                affectedSearch,
              ].join(
                ' '
              )
            ).includes(
              normalizedSearch
            );

          }
        );

      },
      [
        constraints,
        searchTerm,
        statusFilter,
        categoryFilter,
        priorityFilter,
        responsibleFilter,
        getConstraintAffectedWork,
      ]
    );


  // ==========================================================
  // FORECAST ASSESSMENT
  // ==========================================================

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
      style={{
        minHeight:
          '100%',

        padding:
          '18px 20px 40px',

        background:
          '#f8fafc',

        color:
          '#0f172a',
      }}
    >

      {/* ====================================================
          PAGE HEADER
      ===================================================== */}

      <div
        style={{
          display:
            'flex',

          justifyContent:
            'space-between',

          alignItems:
            'flex-start',

          gap:
            '16px',

          flexWrap:
            'wrap',

          marginBottom:
            '18px',
        }}
      >

        <div>

          <h1
            style={{
              margin:
                0,

              fontSize:
                '22px',

              fontWeight:
                800,
            }}
          >
            CONSTRAINT LOG
          </h1>


          <p
            style={{
              maxWidth:
                '760px',

              margin:
                '6px 0 0',

              color:
                '#64748b',

              fontSize:
                '11px',
            }}
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
          PROJECT SELECTOR
      ===================================================== */}

      <div
        style={{
          display:
            'flex',

          alignItems:
            'flex-end',

          gap:
            '12px',

          flexWrap:
            'wrap',

          marginBottom:
            '16px',
        }}
      >

        <div
          style={{
            width:
              'min(360px, 100%)',
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
              selectStyle
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

            disabled={
              loading
            }

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


        {selectedProject && (

          <div
            style={
              projectBadgeStyle
            }
          >
            {selectedProject.code
              ? `${selectedProject.code} · `
              : ''}

            {selectedProject.name}
          </div>

        )}

      </div>


      {/* ====================================================
          MESSAGES
      ===================================================== */}

      {errorMessage && (

        <div
          style={
            errorMessageStyle
          }
        >
          {errorMessage}
        </div>

      )}


      {successMessage && (

        <div
          style={
            successMessageStyle
          }
        >
          {successMessage}
        </div>

      )}


      {!selectedProjectId && (

        <div
          style={
            emptyStyle
          }
        >
          Select a project to open its centralized Constraint Log.
        </div>

      )}


      {/* ====================================================
          PROJECT WORKSPACE
      ===================================================== */}

      {selectedProjectId && (

        <>

          {/* SUMMARY */}

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
              description="Awaiting verification / clearance"
            />


            <SummaryCard
              label="Cleared"
              value={
                summary.cleared
              }
              description="Verified and released"
            />

          </div>


          {/* FILTERS */}

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

                placeholder="Reference, location, action..."

                style={
                  filterInputStyle
                }
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


          <div
            style={
              resultCountStyle
            }
          >
            Showing{' '}
            <strong>
              {filteredConstraints.length}
            </strong>{' '}
            of{' '}
            <strong>
              {constraints.length}
            </strong>{' '}
            constraints
          </div>


          {/* TABLE */}

          <div
            style={
              tableContainerStyle
            }
          >

            {loading ? (

              <div
                style={
                  loadingStyle
                }
              >
                Loading Constraint Log...
              </div>

            ) : filteredConstraints.length ===
              0 ? (

              <div
                style={
                  loadingStyle
                }
              >
                No constraints match the current project/filter selection.
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
                      'LOCATION / AFFECTED WORK',
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
                        label
                      ) => (

                        <th
                          key={
                            label
                          }

                          style={
                            headerCellStyle
                          }
                        >
                          {label}
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
                                  blockingTextStyle
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
                            style={{
                              ...bodyCellStyle,

                              textAlign:
                                'left',
                            }}
                          >
                            {affected[0]
                              ?.location ||
                              'Project-level constraint'}
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

                            <span
                              style={{
                                ...badgeBaseStyle,

                                background:
                                  statusStyle.background,

                                border:
                                  `1px solid ${statusStyle.border}`,

                                color:
                                  statusStyle.color,
                              }}
                            >
                              {getStatusLabel(
                                constraint.status
                              )}
                            </span>

                          </td>


                          <td
                            style={
                              bodyCellStyle
                            }
                          >

                            <span
                              style={{
                                ...badgeBaseStyle,

                                background:
                                  priorityStyle.background,

                                border:
                                  `1px solid ${priorityStyle.border}`,

                                color:
                                  priorityStyle.color,
                              }}
                            >
                              {formatLabel(
                                constraint.priority
                              )}
                            </span>

                          </td>


                          <td
                            style={{
                              ...bodyCellStyle,

                              textAlign:
                                'left',
                            }}
                          >
                            {constraint
                              .responsible_party ||
                              '—'}
                          </td>


                          <td
                            style={{
                              ...bodyCellStyle,

                              textAlign:
                                'left',
                            }}
                          >
                            {constraint
                              .action_required ||
                              '—'}
                          </td>


                          <td
                            style={
                              bodyCellStyle
                            }
                          >

                            <div
                              style={{
                                fontWeight:
                                  700,
                              }}
                            >
                              {formatDate(
                                constraint
                                  .target_resolution_date ||
                                constraint
                                  .required_by_date
                              )}
                            </div>


                            {forecast.delayed && (

                              <div
                                style={
                                  delayTextStyle
                                }
                              >
                                {forecast
                                  .varianceLabel}
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


              {/* SCHEDULE EXPOSURE */}

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

                    description="Current expected completion"
                  />


                  <ForecastCard
                    label="Variance"

                    value={
                      managedForecast
                        .varianceLabel
                    }

                    description="Against required date"

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
                        ? 'Current forecast exceeds required date'
                        : 'Current forecast protects required date'
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

                  <button
                    type="button"

                    onClick={
                      openEditModal
                    }

                    style={
                      managementButtonStyle
                    }
                  >
                    <strong>
                      Edit Details
                    </strong>

                    <span>
                      Owner, action, priority and blocking
                    </span>
                  </button>


                  <button
                    type="button"

                    onClick={
                      openCommentModal
                    }

                    style={
                      managementButtonStyle
                    }
                  >
                    <strong>
                      Add Comment
                    </strong>

                    <span>
                      Record progress without changing status
                    </span>
                  </button>


                  {!TERMINAL_STATUSES.includes(
                    managedConstraint.status
                  ) &&
                  ![
                    'resolved',
                  ].includes(
                    managedConstraint.status
                  ) && (

                    <button
                      type="button"

                      onClick={
                        openForecastModal
                      }

                      style={
                        forecastButtonStyle
                      }
                    >
                      <strong>
                        Update Forecast
                      </strong>

                      <span>
                        Revise planned completion and explain the delay
                      </span>
                    </button>

                  )}


                  {managedConstraint.status ===
                    'resolved' && (

                    <PrototypeActionButton
                      label="Verify & Clear"

                      description="Verify resolution and release readiness"

                      emphasis
                    />

                  )}


                  {managedConstraint.status ===
                    'open' && (

                    <PrototypeActionButton
                      label="Start Action"

                      description="Open → In Progress"
                    />

                  )}


                  {managedConstraint.status ===
                    'in_progress' && (

                    <PrototypeActionButton
                      label="Resolve"

                      description="Report required action completed"
                    />

                  )}

                </div>


                <div
                  style={
                    prototypeNoticeStyle
                  }
                >
                  Lifecycle transitions remain disabled until their
                  governed database functions are installed.
                </div>

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
                    Project-level constraint with no specific planning
                    occurrence linked.
                  </div>

                ) : (

                  <div
                    style={{
                      display:
                        'grid',

                      gap:
                        '8px',
                    }}
                  >

                    {managedAffectedWork.map(
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

                          <div
                            style={{
                              fontSize:
                                '11px',

                              fontWeight:
                                900,
                            }}
                          >
                            {item.packageCode}

                            {item.serviceName
                              ? ` · ${item.serviceName}`
                              : ''}
                          </div>


                          <div
                            style={{
                              marginTop:
                                '4px',

                              fontSize:
                                '10px',

                              color:
                                '#475569',

                              fontWeight:
                                700,
                            }}
                          >
                            {item.location}
                          </div>


                          <div
                            style={{
                              marginTop:
                                '7px',

                              color:
                                '#64748b',

                              fontSize:
                                '9px',
                            }}
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
                    )}

                  </div>

                )}

              </ManagementSection>


              {/* HISTORY */}

              <ManagementSection
                title="Action History"

                subtitle="Read-only audit trail"
              >

                {historyError && (

                  <div
                    style={
                      errorMessageStyle
                    }
                  >
                    {historyError}
                  </div>

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
          title="Add Constraint"

          eyebrow="PROJECT CONSTRAINT"

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
          EDIT DETAILS MODAL
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

                placeholder="Optional explanation for this change"

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

                placeholder="Example: Supplier contacted. Awaiting confirmation of revised shipment date."

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


            <div
              style={
                infoBoxStyle
              }
            >
              This comment will be appended to Action History without
              changing the current constraint status.
            </div>


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
          UPDATE FORECAST MODAL
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
              forecastModalSummaryStyle
            }
          >

            <div>
              <span>
                Required By
              </span>

              <strong>
                {formatDate(
                  managedConstraint
                    .required_by_date
                )}
              </strong>
            </div>


            <div>
              <span>
                Current Forecast
              </span>

              <strong>
                {formatDate(
                  managedConstraint
                    .target_resolution_date ||
                  managedConstraint
                    .required_by_date
                )}
              </strong>
            </div>

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


            {forecastForm
              .new_resolution_date && (

              <div
                style={
                  getForecastPreviewStyle(
                    managedConstraint
                      .required_by_date,

                    forecastForm
                      .new_resolution_date
                  )
                }
              >

                {(() => {

                  const variance =
                    dateDifferenceDays(
                      managedConstraint
                        .required_by_date,

                      forecastForm
                        .new_resolution_date
                    );


                  if (
                    variance === null
                  ) {
                    return 'Forecast could not be evaluated.';
                  }


                  if (
                    variance > 0
                  ) {
                    return `DELAY EXPECTED · +${variance} day${variance === 1 ? '' : 's'} beyond the required date`;
                  }


                  if (
                    variance === 0
                  ) {
                    return 'ON TIME · Forecast remains on the required date';
                  }


                  return `AHEAD · ${Math.abs(variance)} day${Math.abs(variance) === 1 ? '' : 's'} before the required date`;

                })()}

              </div>

            )}


            <ModalField
              label="Reason for Forecast Change"
            >

              <textarea
                value={
                  forecastForm.reason
                }

                placeholder="Example: Supplier confirmed that material will only arrive on September 2."

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
              The original Required By date will not be changed.
              RitsuFlow will preserve the previous forecast and the
              reason for this revision in Action History.
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

      <div
        style={{
          marginBottom:
            '12px',
        }}
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

      </div>

      {children}

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
          managementValueStyle
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
          '13px',
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
          managementDetailValueStyle
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

        borderColor:
          alert
            ? '#fecaca'
            : '#e2e8f0',

        background:
          alert
            ? '#fef2f2'
            : '#f8fafc',
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
        style={{
          marginTop:
            '5px',

          color:
            alert
              ? '#b91c1c'
              : '#0f172a',

          fontSize:
            '12px',

          fontWeight:
            900,
        }}
      >
        {value}
      </div>


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

          lineHeight:
            1.4,
        }}
      >
        {description}
      </div>

    </div>
  );
}


function PrototypeActionButton({
  label,
  description,
  emphasis,
}) {

  return (
    <button
      type="button"

      disabled

      style={{
        ...managementButtonStyle,

        background:
          emphasis
            ? '#f0fdf4'
            : '#f8fafc',

        borderColor:
          emphasis
            ? '#86efac'
            : '#cbd5e1',

        opacity:
          0.7,

        cursor:
          'not-allowed',
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

  const hasStatusChange =
    entry.status_from !==
      entry.status_to &&
    (
      entry.status_from ||
      entry.status_to
    );


  const hasDateChange =
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

          <div
            style={
              historyTitleStyle
            }
          >
            {getActionTypeLabel(
              entry.action_type
            )}
          </div>


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


      {hasStatusChange && (

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


      {hasDateChange && (

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
      style={{
        display:
          'flex',

        justifyContent:
          'flex-end',

        gap:
          '8px',

        marginTop:
          '20px',
      }}
    >
      {children}
    </div>
  );
}


function getForecastPreviewStyle(
  requiredBy,
  forecast
) {

  const variance =
    dateDifferenceDays(
      requiredBy,
      forecast
    );


  const delayed =
    variance !== null &&
    variance > 0;


  return {
    margin:
      '-5px 0 15px',

    padding:
      '9px 10px',

    border:
      `1px solid ${
        delayed
          ? '#fecaca'
          : '#bbf7d0'
      }`,

    borderRadius:
      '6px',

    background:
      delayed
        ? '#fef2f2'
        : '#f0fdf4',

    color:
      delayed
        ? '#b91c1c'
        : '#166534',

    fontSize:
      '9px',

    fontWeight:
      900,
  };
}


// ============================================================
// STYLES
// ============================================================

const labelStyle = {
  display:
    'block',

  marginBottom:
    '5px',

  color:
    '#334155',

  fontSize:
    '11px',

  fontWeight:
    700,
};


const selectStyle = {
  width:
    '100%',

  height:
    '36px',

  padding:
    '0 10px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#ffffff',

  color:
    '#0f172a',

  fontSize:
    '11px',
};


const projectBadgeStyle = {
  padding:
    '9px 11px',

  border:
    '1px solid #dbeafe',

  borderRadius:
    '6px',

  background:
    '#eff6ff',

  color:
    '#1e40af',

  fontSize:
    '10px',

  fontWeight:
    700,
};


const summaryGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(auto-fit, minmax(180px, 1fr))',

  gap:
    '10px',

  marginBottom:
    '14px',
};


const summaryCardStyle = {
  minHeight:
    '92px',

  padding:
    '14px 15px',

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
    800,

  textTransform:
    'uppercase',
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
    'minmax(220px, 2fr) repeat(4, minmax(145px, 1fr))',

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
    800,

  textTransform:
    'uppercase',
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

  color:
    '#0f172a',

  fontSize:
    '10px',
};


const resultCountStyle = {
  marginBottom:
    '7px',

  color:
    '#64748b',

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

  fontSize:
    '10px',
};


const headerCellStyle = {
  padding:
    '7px 6px',

  border:
    '1px solid #cbd5e1',

  background:
    '#f8fafc',

  color:
    '#334155',

  textAlign:
    'center',

  fontSize:
    '8px',

  fontWeight:
    900,
};


const bodyCellStyle = {
  padding:
    '7px',

  border:
    '1px solid #e2e8f0',

  background:
    '#ffffff',

  color:
    '#334155',

  textAlign:
    'center',

  verticalAlign:
    'middle',

  fontSize:
    '9px',
};


const badgeBaseStyle = {
  display:
    'inline-flex',

  alignItems:
    'center',

  justifyContent:
    'center',

  padding:
    '4px 7px',

  borderRadius:
    '999px',

  fontSize:
    '8px',

  fontWeight:
    900,
};


const blockingTextStyle = {
  marginTop:
    '3px',

  color:
    '#b91c1c',

  fontSize:
    '8px',

  fontWeight:
    900,
};


const delayTextStyle = {
  marginTop:
    '3px',

  color:
    '#b91c1c',

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

  fontSize:
    '11px',

  fontWeight:
    800,

  cursor:
    'pointer',
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

  fontSize:
    '11px',

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


const loadingStyle = {
  padding:
    '50px 20px',

  color:
    '#64748b',

  textAlign:
    'center',

  fontSize:
    '12px',
};


const emptyStyle = {
  padding:
    '50px 20px',

  border:
    '1px solid #e2e8f0',

  background:
    '#ffffff',

  color:
    '#64748b',

  textAlign:
    'center',
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


const errorMessageStyle = {
  marginBottom:
    '14px',

  padding:
    '10px 12px',

  border:
    '1px solid #fecaca',

  borderRadius:
    '6px',

  background:
    '#fef2f2',

  color:
    '#b91c1c',

  fontSize:
    '11px',
};


const successMessageStyle = {
  marginBottom:
    '14px',

  padding:
    '10px 12px',

  border:
    '1px solid #bbf7d0',

  borderRadius:
    '6px',

  background:
    '#f0fdf4',

  color:
    '#166534',

  fontSize:
    '11px',

  fontWeight:
    700,
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
    'min(660px, 95vw)',

  background:
    '#f8fafc',

  boxShadow:
    '-20px 0 60px rgba(15,23,42,0.22)',

  overflowY:
    'auto',
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

  alignItems:
    'flex-start',

  gap:
    '20px',

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


const managementSummaryGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(3, minmax(0, 1fr))',

  gap:
    '14px',
};


const forecastGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2, minmax(0, 1fr))',

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


const metaLabelStyle = {
  color:
    '#94a3b8',

  fontSize:
    '8px',

  fontWeight:
    900,

  letterSpacing:
    '0.04em',

  textTransform:
    'uppercase',
};


const managementValueStyle = {
  marginTop:
    '5px',

  color:
    '#0f172a',

  fontSize:
    '10px',

  fontWeight:
    700,
};


const managementDetailValueStyle = {
  marginTop:
    '5px',

  color:
    '#334155',

  fontSize:
    '10px',

  fontWeight:
    600,

  lineHeight:
    1.55,
};


const actionGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2, minmax(0, 1fr))',

  gap:
    '8px',
};


const managementButtonStyle = {
  display:
    'flex',

  flexDirection:
    'column',

  gap:
    '4px',

  padding:
    '10px 11px',

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

  fontSize:
    '10px',
};


const forecastButtonStyle = {
  ...managementButtonStyle,

  border:
    '1px solid #fdba74',

  background:
    '#fff7ed',

  color:
    '#9a3412',
};


const prototypeNoticeStyle = {
  marginTop:
    '12px',

  padding:
    '9px 10px',

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


const affectedWorkCardStyle = {
  padding:
    '11px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',

  background:
    '#f8fafc',
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
    '12px',

  flexWrap:
    'wrap',
};


const historyTitleStyle = {
  fontSize:
    '10px',

  fontWeight:
    900,
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
    '80px minmax(0, 1fr)',

  gap:
    '8px',

  marginTop:
    '9px',

  color:
    '#475569',

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
// MODALS
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
    'min(680px, 96vw)',

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

  alignItems:
    'flex-start',

  padding:
    '18px 20px',

  borderBottom:
    '1px solid #e2e8f0',
};


const modalTitleStyle = {
  margin:
    '4px 0 0',

  fontSize:
    '19px',

  fontWeight:
    900,
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

  color:
    '#334155',

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

  color:
    '#0f172a',

  fontSize:
    '11px',
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

  background:
    '#ffffff',

  color:
    '#0f172a',

  fontFamily:
    'inherit',

  fontSize:
    '11px',

  resize:
    'vertical',
};


const twoColumnStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2, minmax(0, 1fr))',

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

  fontSize:
    '10px',

  fontWeight:
    700,
};


const infoBoxStyle = {
  padding:
    '10px',

  border:
    '1px solid #dbeafe',

  borderRadius:
    '6px',

  background:
    '#eff6ff',

  color:
    '#1e40af',

  fontSize:
    '9px',
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

  lineHeight:
    1.5,
};


const forecastModalSummaryStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2, minmax(0, 1fr))',

  gap:
    '10px',

  marginBottom:
    '18px',

  padding:
    '12px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',

  background:
    '#f8fafc',

  fontSize:
    '9px',
};
