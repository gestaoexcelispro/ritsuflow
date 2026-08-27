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
// CENTERED MANAGEMENT WORKSPACE
//
// LIFECYCLE:
//
// OPEN
//   ↓
// IN PROGRESS
//   ↔ WAITING
//   ↓
// RESOLVED
//   ├── VERIFY & CLEAR → CLEARED
//   └── REOPEN → IN PROGRESS
//
// CANCELLED = separate terminal state.
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

function normalizeText(
  value
) {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase();
}


function formatLabel(
  value
) {
  if (!value) {
    return '—';
  }


  if (
    CATEGORY_LABELS[
      value
    ]
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


function formatDate(
  value
) {
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


function formatDateTime(
  value
) {
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


function getStatusStyle(
  status
) {
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
  if (!constraint) {
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
  // CREATE CONSTRAINT
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
  // CENTERED MANAGEMENT WORKSPACE
  // ==========================================================

  const [
    managedConstraint,
    setManagedConstraint,
  ] = useState(null);


  const [
    showManagementModal,
    setShowManagementModal,
  ] = useState(false);


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


  // ==========================================================
  // MANAGEMENT ACTION PANEL
  // ==========================================================

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


          if (error) {
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

        if (!projectId) {

          setConstraints([]);
          setAffectedWork([]);
          setLookaheadItems({});
          setMasterPlanPackages({});

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

            setAffectedWork([]);
            setLookaheadItems({});
            setMasterPlanPackages({});

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

        if (!constraintId) {
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


          if (error) {
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
            'Constraint history:',
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


        if (error) {
          throw error;
        }


        setManagedConstraint(
          data
        );


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


    setSearchTerm('');
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setResponsibleFilter('');
    setErrorMessage('');
    setSuccessMessage('');


    closeManagementModal();


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
        createForm.title ||
        ''
      ).trim();


    const responsibleParty =
      String(
        createForm
          .responsible_party ||
        ''
      ).trim();


    const requiredAction =
      String(
        createForm
          .action_required ||
        ''
      ).trim();


    if (
      !title ||
      !responsibleParty ||
      !requiredAction ||
      !createForm
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
              createForm.category,

            target_title:
              title,

            target_description:
              createForm.description ||
              null,

            target_action_required:
              requiredAction,

            target_responsible_party:
              responsibleParty,

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


      setShowCreateModal(
        false
      );


      setSuccessMessage(
        `Constraint ${getConstraintReference(
          Array.isArray(
            data
          )
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
        'Create constraint:',
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
  // MANAGEMENT MODAL
  // ==========================================================

  async function openManagementModal(
    constraint
  ) {

    setManagedConstraint(
      constraint
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
    setActiveManagementPanel(null);
    setConstraintHistory([]);
    setHistoryError('');


    setShowManagementModal(
      true
    );


    await loadConstraintHistory(
      constraint.id
    );

  }


  function closeManagementModal() {

    setShowManagementModal(
      false
    );


    setManagedConstraint(
      null
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
    setHistoryError('');

  }


  function toggleManagementPanel(
    panel
  ) {

    setHistoryError('');


    setManagementNote('');


    if (
      managedConstraint
    ) {
      setForecastDate(
        managedConstraint
          .target_resolution_date ||
        managedConstraint
          .required_by_date ||
        ''
      );
    }


    setActiveManagementPanel(
      (
        current
      ) =>
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


    setSavingDetails(
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

    } catch (
      error
    ) {

      console.error(
        'Save constraint details:',
        error
      );


      setHistoryError(
        error.message ||
        'Constraint details could not be saved.'
      );

    } finally {

      setSavingDetails(
        false
      );

    }

  }


  // ==========================================================
  // ADD COMMENT
  // ==========================================================

  async function addManagementComment() {

    if (
      !managedConstraint ||
      savingAction
    ) {
      return;
    }


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


    setSavingAction(
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
              note,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      setManagementNote('');
      setActiveManagementPanel(null);


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (
      error
    ) {

      console.error(
        'Add constraint comment:',
        error
      );


      setHistoryError(
        error.message ||
        'Comment could not be added.'
      );

    } finally {

      setSavingAction(
        false
      );

    }

  }


  // ==========================================================
  // UPDATE FORECAST
  // ==========================================================

  async function updateForecast() {

    if (
      !managedConstraint ||
      savingAction
    ) {
      return;
    }


    const note =
      String(
        managementNote ||
        ''
      ).trim();


    if (
      !forecastDate
    ) {

      setHistoryError(
        'New Planned Resolution Date is required.'
      );


      return;

    }


    if (!note) {

      setHistoryError(
        'Reason for forecast change is required.'
      );


      return;

    }


    setSavingAction(
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
              forecastDate,

            target_reason:
              note,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      setManagementNote('');
      setActiveManagementPanel(null);


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (
      error
    ) {

      console.error(
        'Update forecast:',
        error
      );


      setHistoryError(
        error.message ||
        'Forecast could not be updated.'
      );

    } finally {

      setSavingAction(
        false
      );

    }

  }


  // ==========================================================
  // REOPEN RESOLVED CONSTRAINT
  // SQL 104
  // ==========================================================

  async function reopenConstraint() {

    if (
      !managedConstraint ||
      savingAction
    ) {
      return;
    }


    if (
      managedConstraint.status !==
      'resolved'
    ) {

      setHistoryError(
        'Only a Resolved constraint can be reopened.'
      );


      return;

    }


    const reason =
      String(
        managementNote ||
        ''
      ).trim();


    if (
      !forecastDate
    ) {

      setHistoryError(
        'New Planned Resolution Date is required.'
      );


      return;

    }


    if (!reason) {

      setHistoryError(
        'Reason for reopening is required.'
      );


      return;

    }


    setSavingAction(
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
      setActiveManagementPanel(null);


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (
      error
    ) {

      console.error(
        'Reopen constraint:',
        error
      );


      setHistoryError(
        error.message ||
        'Constraint could not be reopened.'
      );

    } finally {

      setSavingAction(
        false
      );

    }

  }


  // ==========================================================
  // LIFECYCLE
  // ==========================================================

  async function executeLifecycleAction(
    action
  ) {

    if (
      !managedConstraint ||
      savingAction
    ) {
      return;
    }


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
            note ||
            null,

          target_performed_by:
            performedBy,
        };

        break;


      case 'waiting':

        if (!note) {

          setHistoryError(
            'Reason for waiting is required.'
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
            note ||
            null,

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


    setSavingAction(
      true
    );


    setHistoryError(
      ''
    );


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
      setActiveManagementPanel(null);


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (
      error
    ) {

      console.error(
        'Constraint lifecycle:',
        error
      );


      setHistoryError(
        error.message ||
        'Constraint lifecycle action could not be completed.'
      );

    } finally {

      setSavingAction(
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
      () => {

        const today =
          new Date()
            .toISOString()
            .slice(
              0,
              10
            );


        return {

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


                return (
                  forecast &&
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

        };

      },
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


            if (!search) {
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


  // ==========================================================
  // FORECAST CALCULATIONS
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
            variance > 0
              ? `DELAY EXPECTED · +${variance} day${variance === 1 ? '' : 's'}`
              : variance === 0
                ? 'ON TIME'
                : `AHEAD · ${Math.abs(variance)} day${Math.abs(variance) === 1 ? '' : 's'}`,
        };

      },
      [
        managedConstraint,
        forecastDate,
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

            ) : filteredConstraints.length ===
              0 ? (

              <div
                style={
                  emptyStyle
                }
              >
                No constraints match the current project or filters.
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
                              leftCellStyle
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
                              .responsible_party ||
                              '—'}
                          </td>


                          <td
                            style={
                              leftCellStyle
                            }
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
                                openManagementModal(
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
          CENTERED CONSTRAINT MANAGEMENT
      ===================================================== */}

      {showManagementModal &&
        managedConstraint && (

        <div
          style={
            managementOverlayStyle
          }
        >

          <div
            style={
              managementModalStyle
            }
          >

            {/* HEADER */}

            <div
              style={
                managementHeaderStyle
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


                <div
                  style={
                    managementHeaderTitleRowStyle
                  }
                >

                  <h2
                    style={
                      managementTitleStyle
                    }
                  >
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


                  <StatusBadge
                    label={
                      formatLabel(
                        managedConstraint.priority
                      )
                    }

                    style={
                      getPriorityStyle(
                        managedConstraint.priority
                      )
                    }
                  />


                  {managedConstraint.blocking && (

                    <span
                      style={
                        blockingPillStyle
                      }
                    >
                      BLOCKING
                    </span>

                  )}

                </div>


                <div
                  style={
                    managementSubtitleStyle
                  }
                >
                  {managedConstraint.title}
                </div>

              </div>


              <button
                type="button"

                onClick={
                  closeManagementModal
                }

                style={
                  closeButtonStyle
                }
              >
                ×
              </button>

            </div>


            {/* BODY */}

            <div
              style={
                managementBodyStyle
              }
            >

              {/* IMPORTANT:
                  ERROR NOW APPEARS AT TOP
              */}

              {historyError && (

                <MessageBox
                  type="error"
                >
                  {historyError}
                </MessageBox>

              )}


              {/* RESPONSIBILITY */}

              <ManagementSection
                title="Responsibility & Action"

                subtitle="Update the operational information directly."
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
                      disabled={
                        TERMINAL_STATUSES.includes(
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
                      disabled={
                        TERMINAL_STATUSES.includes(
                          managedConstraint.status
                        )
                      }

                      value={
                        managementForm.priority
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
                    disabled={
                      TERMINAL_STATUSES.includes(
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
                    disabled={
                      TERMINAL_STATUSES.includes(
                        managedConstraint.status
                      )
                    }

                    value={
                      managementForm.description
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
                            event.target.value,
                        })
                      )
                    }

                    style={
                      modalTextareaStyle
                    }
                  />

                </ModalField>


                {!TERMINAL_STATUSES.includes(
                  managedConstraint.status
                ) && (

                  <>

                    <label
                      style={
                        checkboxStyle
                      }
                    >

                      <input
                        type="checkbox"

                        checked={
                          managementForm.blocking
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
                                event.target.checked,
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
                          managementForm.comment
                        }

                        placeholder="Optional explanation for these changes."

                        onChange={(
                          event
                        ) =>
                          setManagementForm(
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
                          smallTextareaStyle
                        }
                      />

                    </ModalField>


                    <div
                      style={
                        inlineActionsRightStyle
                      }
                    >

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
                          : 'Save Changes'}
                      </button>

                    </div>

                  </>

                )}

              </ManagementSection>


              {/* FORECAST */}

              <ManagementSection
                title="Resolution Forecast"

                subtitle="Required By remains fixed. Planned Resolution is the current forecast."
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

                    description="Against Required By"

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


                {[
                  'open',
                  'in_progress',
                  'waiting',
                ].includes(
                  managedConstraint.status
                ) && (

                  <div
                    style={{
                      marginTop:
                        '12px',
                    }}
                  >

                    <button
                      type="button"

                      onClick={() =>
                        toggleManagementPanel(
                          'forecast'
                        )
                      }

                      style={
                        forecastActionButtonStyle
                      }
                    >
                      Update Forecast
                    </button>

                  </div>

                )}


                {activeManagementPanel ===
                  'forecast' && (

                  <ExpandableActionPanel
                    title="Update Planned Resolution"

                    description="Use this when the problem will not be solved by the current forecast."
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
                      label="Reason for Forecast Change"
                    >

                      <textarea
                        value={
                          managementNote
                        }

                        placeholder="Example: Supplier postponed material delivery."

                        onChange={(
                          event
                        ) =>
                          setManagementNote(
                            event.target.value
                          )
                        }

                        style={
                          smallTextareaStyle
                        }
                      />

                    </ModalField>


                    <div
                      style={
                        warningBoxStyle
                      }
                    >
                      Required By will not change. The previous forecast,
                      new forecast, reason, actor and timestamp will remain
                      in Action History.
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

                  </ExpandableActionPanel>

                )}

              </ManagementSection>


              {/* STATUS MANAGEMENT */}

              <ManagementSection
                title="Status Management"

                subtitle={`Current Status: ${getStatusLabel(
                  managedConstraint.status
                )}`}
              >

                {/* FULL STATUS FLOW */}

                <div
                  style={
                    lifecycleFlowStyle
                  }
                >

                  <LifecycleStage
                    label="Open"

                    active={
                      managedConstraint.status ===
                      'open'
                    }
                  />


                  <span
                    style={
                      lifecycleArrowStyle
                    }
                  >
                    →
                  </span>


                  <LifecycleStage
                    label="In Progress"

                    active={
                      managedConstraint.status ===
                      'in_progress'
                    }
                  />


                  <span
                    style={
                      lifecycleArrowStyle
                    }
                  >
                    ↔
                  </span>


                  <LifecycleStage
                    label="Waiting"

                    active={
                      managedConstraint.status ===
                      'waiting'
                    }
                  />


                  <span
                    style={
                      lifecycleArrowStyle
                    }
                  >
                    →
                  </span>


                  <LifecycleStage
                    label="Resolved"

                    active={
                      managedConstraint.status ===
                      'resolved'
                    }
                  />


                  <span
                    style={
                      lifecycleArrowStyle
                    }
                  >
                    →
                  </span>


                  <LifecycleStage
                    label="Cleared"

                    active={
                      managedConstraint.status ===
                      'cleared'
                    }
                  />

                </div>


                <div
                  style={
                    actionGridStyle
                  }
                >

                  {/* OPEN */}

                  {managedConstraint.status ===
                    'open' && (

                    <LifecycleButton
                      label="Start Action"

                      description="Open → In Progress"

                      onClick={() =>
                        toggleManagementPanel(
                          'start'
                        )
                      }
                    />

                  )}


                  {/* IN PROGRESS */}

                  {managedConstraint.status ===
                    'in_progress' && (

                    <>

                      <LifecycleButton
                        label="Set Waiting"

                        description="Resolution temporarily blocked"

                        onClick={() =>
                          toggleManagementPanel(
                            'waiting'
                          )
                        }
                      />


                      <LifecycleButton
                        label="Resolve"

                        description="Required action completed"

                        emphasis

                        onClick={() =>
                          toggleManagementPanel(
                            'resolve'
                          )
                        }
                      />

                    </>

                  )}


                  {/* WAITING */}

                  {managedConstraint.status ===
                    'waiting' && (

                    <>

                      <LifecycleButton
                        label="Resume Action"

                        description="Waiting → In Progress"

                        onClick={() =>
                          toggleManagementPanel(
                            'resume'
                          )
                        }
                      />


                      <LifecycleButton
                        label="Resolve"

                        description="Required action completed"

                        emphasis

                        onClick={() =>
                          toggleManagementPanel(
                            'resolve'
                          )
                        }
                      />

                    </>

                  )}


                  {/* RESOLVED */}

                  {managedConstraint.status ===
                    'resolved' && (

                    <>

                      <LifecycleButton
                        label="Verify & Clear"

                        description="Resolution is valid"

                        emphasis

                        onClick={() =>
                          toggleManagementPanel(
                            'clear'
                          )
                        }
                      />


                      <LifecycleButton
                        label="Reopen Constraint"

                        description="Problem still exists"

                        warning

                        onClick={() =>
                          toggleManagementPanel(
                            'reopen'
                          )
                        }
                      />

                    </>

                  )}


                  {/* CANCEL */}

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

                      description="Constraint no longer applicable"

                      danger

                      onClick={() =>
                        toggleManagementPanel(
                          'cancel'
                        )
                      }
                    />

                  )}

                </div>


                {/* START */}

                {activeManagementPanel ===
                  'start' && (

                  <LifecycleActionPanel
                    title="Start Action"

                    description="Active work to remove this constraint is beginning."

                    label="Optional Comment"

                    placeholder="Example: Procurement team started contacting suppliers."

                    value={
                      managementNote
                    }

                    onChange={
                      setManagementNote
                    }

                    saving={
                      savingAction
                    }

                    actionLabel="Confirm Start Action"

                    onConfirm={() =>
                      executeLifecycleAction(
                        'start'
                      )
                    }

                    onCancel={() =>
                      setActiveManagementPanel(
                        null
                      )
                    }
                  />

                )}


                {/* WAITING */}

                {activeManagementPanel ===
                  'waiting' && (

                  <LifecycleActionPanel
                    title="Set Waiting"

                    description="Explain what is preventing the team from continuing resolution work."

                    label="Reason for Waiting"

                    placeholder="Example: Waiting for supplier confirmation."

                    value={
                      managementNote
                    }

                    onChange={
                      setManagementNote
                    }

                    saving={
                      savingAction
                    }

                    actionLabel="Confirm Waiting"

                    onConfirm={() =>
                      executeLifecycleAction(
                        'waiting'
                      )
                    }

                    onCancel={() =>
                      setActiveManagementPanel(
                        null
                      )
                    }
                  />

                )}


                {/* RESUME */}

                {activeManagementPanel ===
                  'resume' && (

                  <LifecycleActionPanel
                    title="Resume Action"

                    description="Move the constraint back to active resolution."

                    label="Optional Comment"

                    placeholder="Example: Supplier response received. Resolution work resumed."

                    value={
                      managementNote
                    }

                    onChange={
                      setManagementNote
                    }

                    saving={
                      savingAction
                    }

                    actionLabel="Confirm Resume"

                    onConfirm={() =>
                      executeLifecycleAction(
                        'resume'
                      )
                    }

                    onCancel={() =>
                      setActiveManagementPanel(
                        null
                      )
                    }
                  />

                )}


                {/* RESOLVE */}

                {activeManagementPanel ===
                  'resolve' && (

                  <LifecycleActionPanel
                    title="Resolve Constraint"

                    description="The responsible party is reporting that the required action has been completed. Readiness will remain blocked until verification."

                    label="Resolution Note"

                    placeholder="Example: Supplier confirmed material delivery and availability."

                    value={
                      managementNote
                    }

                    onChange={
                      setManagementNote
                    }

                    saving={
                      savingAction
                    }

                    actionLabel="Mark Resolved"

                    onConfirm={() =>
                      executeLifecycleAction(
                        'resolve'
                      )
                    }

                    onCancel={() =>
                      setActiveManagementPanel(
                        null
                      )
                    }

                    success
                  />

                )}


                {/* CLEAR */}

                {activeManagementPanel ===
                  'clear' && (

                  <LifecycleActionPanel
                    title="Verify & Clear"

                    description="Confirm that the reported resolution is valid and the affected work may proceed."

                    label="Verification Note"

                    placeholder="Example: Material confirmation reviewed. The constraint no longer blocks production."

                    value={
                      managementNote
                    }

                    onChange={
                      setManagementNote
                    }

                    saving={
                      savingAction
                    }

                    actionLabel="Verify & Clear"

                    onConfirm={() =>
                      executeLifecycleAction(
                        'clear'
                      )
                    }

                    onCancel={() =>
                      setActiveManagementPanel(
                        null
                      )
                    }

                    success
                  >

                    <div
                      style={
                        verificationWarningStyle
                      }
                    >
                      Clearing this constraint will release the associated
                      Lookahead / Koskela readiness condition.
                    </div>

                  </LifecycleActionPanel>

                )}


                {/* REOPEN — SQL 104 */}

                {activeManagementPanel ===
                  'reopen' && (

                  <ExpandableActionPanel
                    title="Reopen Constraint"

                    description="Use this when the previously reported resolution was unsuccessful and the problem still exists."
                  >

                    <div
                      style={
                        reopenWarningStyle
                      }
                    >
                      Status will change from <strong>Resolved</strong> to{' '}
                      <strong>In Progress</strong>. Required By will remain
                      unchanged.
                    </div>


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
                      label="Why was the constraint not resolved?"
                    >

                      <textarea
                        value={
                          managementNote
                        }

                        placeholder="Example: Supplier did not deliver on the previously confirmed date."

                        onChange={(
                          event
                        ) =>
                          setManagementNote(
                            event.target.value
                          )
                        }

                        style={
                          smallTextareaStyle
                        }
                      />

                    </ModalField>


                    <div
                      style={
                        reopenImpactStyle
                      }
                    >

                      <div>

                        <div
                          style={
                            metaLabelStyle
                          }
                        >
                          Current Status
                        </div>

                        <strong>
                          Resolved
                        </strong>

                      </div>


                      <div
                        style={
                          lifecycleArrowLargeStyle
                        }
                      >
                        →
                      </div>


                      <div>

                        <div
                          style={
                            metaLabelStyle
                          }
                        >
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


                    <ActionButtons
                      saving={
                        savingAction
                      }

                      confirmLabel="Confirm Reopen"

                      warning

                      onCancel={() =>
                        setActiveManagementPanel(
                          null
                        )
                      }

                      onConfirm={
                        reopenConstraint
                      }
                    />

                  </ExpandableActionPanel>

                )}


                {/* CANCEL */}

                {activeManagementPanel ===
                  'cancel' && (

                  <LifecycleActionPanel
                    title="Cancel Constraint"

                    description="Cancellation means the constraint is no longer applicable. It does not mean the problem was successfully solved."

                    label="Cancellation Reason"

                    placeholder="Example: Work package removed from current scope."

                    value={
                      managementNote
                    }

                    onChange={
                      setManagementNote
                    }

                    saving={
                      savingAction
                    }

                    actionLabel="Cancel Constraint"

                    onConfirm={() =>
                      executeLifecycleAction(
                        'cancel'
                      )
                    }

                    onCancel={() =>
                      setActiveManagementPanel(
                        null
                      )
                    }

                    danger
                  />

                )}


                {managedConstraint.status ===
                  'resolved' && (

                  <div
                    style={
                      resolvedNoticeStyle
                    }
                  >
                    This constraint is reported as resolved but still blocks
                    readiness. Choose <strong>Verify & Clear</strong> if the
                    solution is valid, or <strong>Reopen Constraint</strong>{' '}
                    if the problem remains.
                  </div>

                )}


                {managedConstraint.status ===
                  'cleared' && (

                  <div
                    style={
                      clearedNoticeStyle
                    }
                  >
                    Resolution verified. This constraint is formally cleared
                    and no longer blocks readiness.
                  </div>

                )}

              </ManagementSection>


              {/* MANAGEMENT UPDATE */}

              <ManagementSection
                title="Management Update"

                subtitle="Record progress without changing the current status."
              >

                <textarea
                  value={
                    activeManagementPanel ===
                      'comment'
                      ? managementNote
                      : ''
                  }

                  placeholder="Add a comment or progress update..."

                  onFocus={() => {

                    if (
                      activeManagementPanel !==
                      'comment'
                    ) {

                      setActiveManagementPanel(
                        'comment'
                      );


                      setManagementNote('');

                    }

                  }}

                  onChange={(
                    event
                  ) => {

                    if (
                      activeManagementPanel !==
                      'comment'
                    ) {

                      setActiveManagementPanel(
                        'comment'
                      );

                    }


                    setManagementNote(
                      event.target.value
                    );

                  }}

                  style={
                    smallTextareaStyle
                  }
                />


                <div
                  style={
                    inlineActionsRightStyle
                  }
                >

                  <button
                    type="button"

                    disabled={
                      savingAction ||
                      activeManagementPanel !==
                        'comment'
                    }

                    onClick={
                      addManagementComment
                    }

                    style={
                      secondaryActionButtonStyle
                    }
                  >
                    {savingAction
                      ? 'Adding...'
                      : 'Add Comment'}
                  </button>

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

                        <div
                          style={
                            affectedHeaderStyle
                          }
                        >

                          <strong>
                            {item.packageCode}

                            {item.serviceName
                              ? ` · ${item.serviceName}`
                              : ''}
                          </strong>


                          <span
                            style={
                              sourcePillStyle
                            }
                          >
                            {item.type}
                          </span>

                        </div>


                        <div
                          style={
                            affectedLocationStyle
                          }
                        >
                          {item.location}
                        </div>


                        {(item.startDate ||
                          item.finishDate) && (

                          <div
                            style={
                              affectedMetaStyle
                            }
                          >
                            {formatDate(
                              item.startDate
                            )}

                            {' → '}

                            {formatDate(
                              item.finishDate
                            )}
                          </div>

                        )}

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


            {/* FOOTER */}

            <div
              style={
                managementFooterStyle
              }
            >

              <div
                style={
                  footerStatusStyle
                }
              >
                {getStatusLabel(
                  managedConstraint.status
                )}

                {' · '}

                {getConstraintReference(
                  managedConstraint.id
                )}
              </div>


              <button
                type="button"

                onClick={
                  closeManagementModal
                }

                style={
                  secondaryButtonStyle
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}


      {/* ====================================================
          CREATE CONSTRAINT MODAL
      ===================================================== */}

      {showCreateModal && (

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
                  PROJECT CONSTRAINT
                </div>


                <h2
                  style={
                    modalTitleStyle
                  }
                >
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

              style={
                modalBodyStyle
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
                    createForm.description
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
                          event.target.checked,
                      })
                    )
                  }
                />

                Blocking Constraint

              </label>


              <div
                style={
                  modalActionsStyle
                }
              >

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


function ModalField({
  label,
  children,
}) {

  return (
    <div
      style={{
        marginBottom:
          '14px',
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
            '13px',
        }}
      >
        {children}
      </div>

    </section>
  );
}


function ExpandableActionPanel({
  title,
  description,
  children,
}) {

  return (
    <div
      style={
        expandablePanelStyle
      }
    >

      <div
        style={
          expandableTitleStyle
        }
      >
        {title}
      </div>


      <div
        style={
          expandableDescriptionStyle
        }
      >
        {description}
      </div>


      <div
        style={{
          marginTop:
            '13px',
        }}
      >
        {children}
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
    <div
      style={
        twoColumnStyle
      }
    >

      <ModalField
        label="New Planned Resolution Date"
      >

        <input
          type="date"

          value={
            date
          }

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


      <div>

        <div
          style={
            metaLabelStyle
          }
        >
          Schedule Impact
        </div>


        <div
          style={
            preview?.delayed
              ? delayPreviewStyle
              : safePreviewStyle
          }
        >
          {preview
            ?.label ||
            'Select a date'}
        </div>


        <div
          style={
            requiredByHelperStyle
          }
        >
          Required By: {formatDate(
            requiredBy
          )}
        </div>

      </div>

    </div>
  );
}


function LifecycleActionPanel({
  title,
  description,
  label,
  placeholder,
  value,
  onChange,
  saving,
  actionLabel,
  onConfirm,
  onCancel,
  danger,
  success,
  children,
}) {

  return (
    <ExpandableActionPanel
      title={
        title
      }

      description={
        description
      }
    >

      {children}


      <ModalField
        label={
          label
        }
      >

        <textarea
          value={
            value
          }

          placeholder={
            placeholder
          }

          onChange={(
            event
          ) =>
            onChange(
              event.target.value
            )
          }

          style={
            smallTextareaStyle
          }
        />

      </ModalField>


      <ActionButtons
        saving={
          saving
        }

        confirmLabel={
          actionLabel
        }

        danger={
          danger
        }

        success={
          success
        }

        onCancel={
          onCancel
        }

        onConfirm={
          onConfirm
        }
      />

    </ExpandableActionPanel>
  );
}


function ActionButtons({
  saving,
  confirmLabel,
  onCancel,
  onConfirm,
  danger,
  success,
  warning,
}) {

  let style =
    primaryButtonStyle;


  if (success) {
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
    <div
      style={
        inlineActionsRightStyle
      }
    >

      <button
        type="button"

        onClick={
          onCancel
        }

        style={
          secondaryButtonStyle
        }
      >
        Cancel
      </button>


      <button
        type="button"

        disabled={
          saving
        }

        onClick={
          onConfirm
        }

        style={
          style
        }
      >
        {saving
          ? 'Processing...'
          : confirmLabel}
      </button>

    </div>
  );
}


function LifecycleStage({
  label,
  active,
}) {

  return (
    <div
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
    </div>
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

  let borderColor =
    '#cbd5e1';

  let color =
    '#334155';


  if (emphasis) {

    background =
      '#f0fdf4';

    borderColor =
      '#86efac';

    color =
      '#166534';

  }


  if (warning) {

    background =
      '#fff7ed';

    borderColor =
      '#fdba74';

    color =
      '#9a3412';

  }


  if (danger) {

    background =
      '#fef2f2';

    borderColor =
      '#fecaca';

    color =
      '#b91c1c';

  }


  return (
    <button
      type="button"

      onClick={
        onClick
      }

      style={{
        ...actionButtonStyle,

        background,

        borderColor,

        color,
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

          lineHeight:
            1.4,
        }}
      >
        {description}
      </div>

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

          <strong
            style={{
              fontSize:
                '10px',
            }}
          >
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

  alignItems:
    'flex-start',

  justifyContent:
    'space-between',

  gap:
    '16px',

  flexWrap:
    'wrap',

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

  flexWrap:
    'wrap',

  marginBottom:
    '16px',
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

  color:
    '#0f172a',
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
    'minmax(220px, 2fr) repeat(4, minmax(140px, 1fr))',

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

  color:
    '#334155',

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

  color:
    '#334155',

  fontSize:
    '9px',

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


const blockingPillStyle = {
  display:
    'inline-flex',

  padding:
    '4px 7px',

  border:
    '1px solid #fecaca',

  borderRadius:
    '999px',

  background:
    '#fef2f2',

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
    '10px',

  fontWeight:
    800,

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
    '10px',

  fontWeight:
    700,

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

  fontSize:
    '11px',
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
// MANAGEMENT MODAL
// ============================================================

const managementOverlayStyle = {
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
    'rgba(15,23,42,0.58)',
};


const managementModalStyle = {
  display:
    'flex',

  flexDirection:
    'column',

  width:
    'min(980px, 95vw)',

  maxHeight:
    '92vh',

  overflow:
    'hidden',

  border:
    '1px solid #dbe3ee',

  borderRadius:
    '12px',

  background:
    '#f8fafc',

  boxShadow:
    '0 30px 90px rgba(15,23,42,0.35)',
};


const managementHeaderStyle = {
  flexShrink:
    0,

  display:
    'flex',

  alignItems:
    'flex-start',

  justifyContent:
    'space-between',

  gap:
    '20px',

  padding:
    '18px 20px',

  borderBottom:
    '1px solid #e2e8f0',

  background:
    '#ffffff',
};


const managementHeaderTitleRowStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '7px',

  flexWrap:
    'wrap',

  marginTop:
    '4px',
};


const managementTitleStyle = {
  margin:
    0,

  marginRight:
    '3px',

  fontSize:
    '20px',

  fontWeight:
    900,
};


const managementSubtitleStyle = {
  marginTop:
    '6px',

  color:
    '#475569',

  fontSize:
    '11px',

  fontWeight:
    600,
};


const managementBodyStyle = {
  flex:
    1,

  display:
    'grid',

  gap:
    '12px',

  padding:
    '14px',

  overflowY:
    'auto',
};


const managementFooterStyle = {
  flexShrink:
    0,

  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'space-between',

  gap:
    '12px',

  padding:
    '12px 16px',

  borderTop:
    '1px solid #e2e8f0',

  background:
    '#ffffff',
};


const footerStatusStyle = {
  color:
    '#64748b',

  fontSize:
    '9px',

  fontWeight:
    700,
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

  color:
    '#0f172a',

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


const expandablePanelStyle = {
  marginTop:
    '12px',

  padding:
    '13px',

  border:
    '1px solid #dbeafe',

  borderRadius:
    '8px',

  background:
    '#f8fbff',
};


const expandableTitleStyle = {
  color:
    '#0f172a',

  fontSize:
    '11px',

  fontWeight:
    900,
};


const expandableDescriptionStyle = {
  marginTop:
    '4px',

  color:
    '#64748b',

  fontSize:
    '9px',

  lineHeight:
    1.5,
};


const forecastGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(4, minmax(0, 1fr))',

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


const forecastActionButtonStyle = {
  height:
    '32px',

  padding:
    '0 11px',

  border:
    '1px solid #fdba74',

  borderRadius:
    '6px',

  background:
    '#fff7ed',

  color:
    '#9a3412',

  fontSize:
    '9px',

  fontWeight:
    900,

  cursor:
    'pointer',
};


const delayPreviewStyle = {
  marginTop:
    '6px',

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
    '9px',

  fontWeight:
    900,
};


const safePreviewStyle = {
  marginTop:
    '6px',

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

  fontWeight:
    900,
};


const requiredByHelperStyle = {
  marginTop:
    '5px',

  color:
    '#94a3b8',

  fontSize:
    '8px',
};


const lifecycleFlowStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '6px',

  flexWrap:
    'wrap',

  marginBottom:
    '13px',
};


const lifecycleStageStyle = {
  padding:
    '6px 9px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '999px',

  fontSize:
    '8px',
};


const lifecycleArrowStyle = {
  color:
    '#cbd5e1',

  fontSize:
    '11px',

  fontWeight:
    900,
};


const lifecycleArrowLargeStyle = {
  color:
    '#cbd5e1',

  fontSize:
    '20px',

  fontWeight:
    900,
};


const actionGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2, minmax(0, 1fr))',

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
    '9px',
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

  fontWeight:
    700,
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

  fontWeight:
    700,
};


const verificationWarningStyle = {
  marginBottom:
    '12px',

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


const reopenWarningStyle = {
  marginBottom:
    '14px',

  padding:
    '10px',

  border:
    '1px solid #fdba74',

  borderRadius:
    '6px',

  background:
    '#fff7ed',

  color:
    '#9a3412',

  fontSize:
    '9px',

  lineHeight:
    1.5,
};


const reopenImpactStyle = {
  display:
    'grid',

  gridTemplateColumns:
    '1fr auto 1fr',

  alignItems:
    'center',

  gap:
    '12px',

  marginBottom:
    '14px',

  padding:
    '12px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '7px',

  background:
    '#ffffff',
};


const warningBoxStyle = {
  padding:
    '10px',

  marginBottom:
    '12px',

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


const inlineActionsRightStyle = {
  display:
    'flex',

  justifyContent:
    'flex-end',

  gap:
    '8px',
};


// ============================================================
// AFFECTED WORK
// ============================================================

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


const affectedHeaderStyle = {
  display:
    'flex',

  alignItems:
    'flex-start',

  justifyContent:
    'space-between',

  gap:
    '10px',

  fontSize:
    '10px',
};


const sourcePillStyle = {
  display:
    'inline-flex',

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
    '8px',

  fontWeight:
    800,
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

  flexWrap:
    'wrap',
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
// MODAL / FORM
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

  alignItems:
    'flex-start',

  justifyContent:
    'space-between',

  gap:
    '20px',

  padding:
    '18px 20px',

  borderBottom:
    '1px solid #e2e8f0',
};


const modalBodyStyle = {
  padding:
    '20px',
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

  flexShrink:
    0,

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


const smallTextareaStyle = {
  ...modalTextareaStyle,

  minHeight:
    '76px',
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

  marginBottom:
    '14px',

  padding:
    '10px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '6px',

  background:
    '#f8fafc',

  color:
    '#334155',

  fontSize:
    '10px',

  fontWeight:
    700,
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


// ============================================================
// MESSAGE BOXES
// ============================================================

const errorBoxStyle = {
  marginBottom:
    '2px',

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

  fontWeight:
    700,
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
