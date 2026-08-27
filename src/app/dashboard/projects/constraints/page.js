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
// CENTRALIZED CONSTRAINT LOG
//
// Project-level Constraint Management workspace.
//
// Current scope:
// - Read central constraints
// - Project filtering
// - KPI summary
// - Search and filters
// - Manual project-level constraint creation
// - Atomic creation + Action History
// - Read-only Action History timeline
//
// Future scope:
// - Edit / assign
// - Status lifecycle actions
// - Resolved -> Verify -> Cleared
// - Koskela creation/link integration
// - Weekly Planning readiness
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
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'cancelled', label: 'Cancelled' },
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
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
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
  created: 'Constraint Created',
  assigned: 'Assigned',
  responsible_changed: 'Responsible Changed',
  action_updated: 'Required Action Updated',
  status_changed: 'Status Changed',
  target_date_changed: 'Target Date Changed',
  comment_added: 'Comment Added',
  resolved: 'Resolution Reported',
  verified: 'Resolution Verified',
  cleared: 'Constraint Cleared',
  cancelled: 'Constraint Cancelled',
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


function getTodayIso() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      now.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
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


function getDueDate(constraint) {
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
    getDueDate(constraint);

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
  const normalized =
    normalizeText(priority);

  if (
    normalized ===
    'critical'
  ) {
    return {
      background: '#fee2e2',
      border: '#ef4444',
      color: '#991b1b',
    };
  }

  if (
    normalized ===
    'high'
  ) {
    return {
      background: '#fff7ed',
      border: '#fdba74',
      color: '#c2410c',
    };
  }

  if (
    normalized ===
    'medium'
  ) {
    return {
      background: '#fefce8',
      border: '#fde047',
      color: '#854d0e',
    };
  }

  if (
    normalized ===
    'low'
  ) {
    return {
      background: '#f0fdf4',
      border: '#86efac',
      color: '#166534',
    };
  }

  return {
    background: '#f8fafc',
    border: '#cbd5e1',
    color: '#64748b',
  };
}


// ============================================================
// INITIAL FORM
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


// ============================================================
// PAGE
// ============================================================

export default function ConstraintLogPage() {

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
  // ACTION HISTORY STATE
  // ==========================================================

  const [
    showHistoryModal,
    setShowHistoryModal,
  ] = useState(false);


  const [
    historyConstraint,
    setHistoryConstraint,
  ] = useState(null);


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
          (project) =>
            project.id ===
            selectedProjectId
        ) || null,
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
                  ascending: false,
                }
              );


          if (error) {
            throw error;
          }


          const loadedProjects =
            data || [];


          setProjects(
            loadedProjects
          );


          const params =
            new URLSearchParams(
              window.location.search
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
              loadedProjects[0].id
            );
          }

        } catch (error) {

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
  // LOAD CENTRAL CONSTRAINT LOG
  // ==========================================================

  const loadConstraintLog =
    useCallback(
      async (projectId) => {

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
            data: constraintData,
            error: constraintError,
          } =
            await supabase
              .from('constraints')
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
                  ascending: false,
                }
              );


          if (constraintError) {
            throw constraintError;
          }


          const loadedConstraints =
            constraintData || [];


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


          // --------------------------------------------------
          // AFFECTED WORK
          // --------------------------------------------------

          const {
            data: affectedWorkData,
            error: affectedWorkError,
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


          if (affectedWorkError) {
            throw affectedWorkError;
          }


          const loadedAffectedWork =
            affectedWorkData || [];


          setAffectedWork(
            loadedAffectedWork
          );


          // --------------------------------------------------
          // LOOKAHEAD REFERENCES
          // --------------------------------------------------

          const affectedLookaheadIds =
            loadedAffectedWork
              .map(
                (item) =>
                  item.lookahead_work_item_id
              )
              .filter(Boolean);


          const directLookaheadIds =
            loadedConstraints
              .map(
                (constraint) =>
                  constraint.lookahead_work_item_id
              )
              .filter(Boolean);


          const allLookaheadIds =
            Array.from(
              new Set([
                ...affectedLookaheadIds,
                ...directLookaheadIds,
              ])
            );


          let nextLookaheadMap = {};


          if (
            allLookaheadIds.length > 0
          ) {

            const {
              data: lookaheadData,
              error: lookaheadError,
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


            if (lookaheadError) {
              throw lookaheadError;
            }


            nextLookaheadMap =
              Object.fromEntries(
                (
                  lookaheadData || []
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

          const affectedMasterIds =
            loadedAffectedWork
              .map(
                (item) =>
                  item.master_plan_package_id
              )
              .filter(Boolean);


          const directMasterIds =
            loadedConstraints
              .map(
                (constraint) =>
                  constraint.master_plan_package_id
              )
              .filter(Boolean);


          const lookaheadMasterIds =
            Object
              .values(
                nextLookaheadMap
              )
              .map(
                (item) =>
                  item.master_plan_package_id
              )
              .filter(Boolean);


          const allMasterIds =
            Array.from(
              new Set([
                ...affectedMasterIds,
                ...directMasterIds,
                ...lookaheadMasterIds,
              ])
            );


          let nextMasterPlanMap = {};


          if (
            allMasterIds.length > 0
          ) {

            const {
              data: masterPlanData,
              error: masterPlanError,
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


            if (masterPlanError) {
              throw masterPlanError;
            }


            nextMasterPlanMap =
              Object.fromEntries(
                (
                  masterPlanData || []
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

        } catch (error) {

          console.error(
            'Constraint Log workspace:',
            error
          );


          setErrorMessage(
            error.message ||
            'The Constraint Log could not be loaded.'
          );

        } finally {

          setLoading(false);

        }

      },
      []
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

  const handleProjectChange =
    (projectId) => {

      setSelectedProjectId(
        projectId
      );

      setConstraints([]);
      setAffectedWork([]);
      setLookaheadItems({});
      setMasterPlanPackages({});

      setSearchTerm('');
      setStatusFilter('');
      setCategoryFilter('');
      setPriorityFilter('');
      setResponsibleFilter('');

      setErrorMessage('');
      setSuccessMessage('');


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

    };


  // ==========================================================
  // OPEN CREATE MODAL
  // ==========================================================

  const openCreateModal =
    () => {

      if (!selectedProjectId) {
        return;
      }

      setForm(
        createInitialForm()
      );

      setErrorMessage('');
      setSuccessMessage('');

      setShowCreateModal(true);

    };


  // ==========================================================
  // CREATE MANUAL CONSTRAINT + INITIAL HISTORY
  // ==========================================================

  const createConstraint =
    async (event) => {

      event.preventDefault();


      if (
        !selectedProjectId ||
        creatingConstraint
      ) {
        return;
      }


      const title =
        String(
          form.title || ''
        ).trim();


      const actionRequired =
        String(
          form.action_required || ''
        ).trim();


      const responsibleParty =
        String(
          form.responsible_party || ''
        ).trim();


      if (!form.category) {
        setErrorMessage(
          'Constraint category is required.'
        );
        return;
      }


      if (!title) {
        setErrorMessage(
          'Constraint title is required.'
        );
        return;
      }


      if (!actionRequired) {
        setErrorMessage(
          'Required action is required.'
        );
        return;
      }


      if (!responsibleParty) {
        setErrorMessage(
          'Responsible party is required.'
        );
        return;
      }


      if (!form.required_by_date) {
        setErrorMessage(
          'Due date is required.'
        );
        return;
      }


      setCreatingConstraint(true);
      setErrorMessage('');
      setSuccessMessage('');


      try {

        let performedBy = null;


        const {
          data: userData,
        } =
          await supabase.auth
            .getUser();


        const user =
          userData?.user;


        if (user) {

          performedBy =
            user.user_metadata
              ?.full_name ||
            user.user_metadata
              ?.name ||
            user.email ||
            null;

        }


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
                  form.description || ''
                ).trim() || null,

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


        if (error) {
          throw error;
        }


        const createdConstraintId =
          Array.isArray(data)
            ? data[0]
            : data;


        setShowCreateModal(false);

        setForm(
          createInitialForm()
        );


        setSuccessMessage(
          `Constraint ${getConstraintReference(
            createdConstraintId
          )} created successfully.`
        );


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
          'The constraint could not be created.'
        );

      } finally {

        setCreatingConstraint(false);

      }

    };


  // ==========================================================
  // LOAD ACTION HISTORY
  // ==========================================================

  const openConstraintHistory =
    async (constraint) => {

      if (!constraint?.id) {
        return;
      }


      setHistoryConstraint(
        constraint
      );

      setConstraintHistory([]);

      setHistoryError('');

      setShowHistoryModal(true);

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
              constraint.id
            )
            .order(
              'created_at',
              {
                ascending: false,
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
          'Constraint Action History:',
          error
        );


        setHistoryError(
          error.message ||
          'Action History could not be loaded.'
        );

      } finally {

        setLoadingHistory(false);

      }

    };


  const closeConstraintHistory =
    () => {

      setShowHistoryModal(false);

      setHistoryConstraint(null);

      setConstraintHistory([]);

      setHistoryError('');

    };


  // ==========================================================
  // RELATIONSHIP MAP
  // ==========================================================

  const affectedWorkByConstraint =
    useMemo(
      () => {

        const map = {};


        affectedWork.forEach(
          (relationship) => {

            if (
              !map[
                relationship.constraint_id
              ]
            ) {
              map[
                relationship.constraint_id
              ] = [];
            }


            map[
              relationship.constraint_id
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
  // ==========================================================

  const getConstraintAffectedWork =
    useCallback(
      (constraint) => {

        const relationships =
          affectedWorkByConstraint[
            constraint.id
          ] || [];


        const workItems = [];


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

                workItems.push({
                  key:
                    `lookahead-${item.id}`,

                  type:
                    'Lookahead',

                  packageCode:
                    item.package_code ||
                    '—',

                  location:
                    item.location_path ||
                    item.location_name ||
                    'Unassigned Location',
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

                workItems.push({
                  key:
                    `master-${item.id}`,

                  type:
                    'Master Plan',

                  packageCode:
                    item.package_code ||
                    '—',

                  location:
                    item.location_path ||
                    item.location_name ||
                    'Unassigned Location',
                });

              }

            }

          }
        );


        if (
          constraint
            .lookahead_work_item_id
        ) {

          const item =
            lookaheadItems[
              constraint
                .lookahead_work_item_id
            ];


          const exists =
            workItems.some(
              (workItem) =>
                workItem.key ===
                `lookahead-${constraint.lookahead_work_item_id}`
            );


          if (
            item &&
            !exists
          ) {

            workItems.push({
              key:
                `lookahead-${item.id}`,

              type:
                'Lookahead',

              packageCode:
                item.package_code ||
                '—',

              location:
                item.location_path ||
                item.location_name ||
                'Unassigned Location',
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


          const exists =
            workItems.some(
              (workItem) =>
                workItem.key ===
                `master-${constraint.master_plan_package_id}`
            );


          if (
            item &&
            !exists
          ) {

            workItems.push({
              key:
                `master-${item.id}`,

              type:
                'Master Plan',

              packageCode:
                item.package_code ||
                '—',

              location:
                item.location_path ||
                item.location_name ||
                'Unassigned Location',
            });

          }

        }


        return workItems;

      },
      [
        affectedWorkByConstraint,
        lookaheadItems,
        masterPlanPackages,
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
              .filter(Boolean)
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
                  constraint.responsible_party
              )
              .filter(Boolean)
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
              constraint.priority !==
              priorityFilter
            ) {
              return false;
            }


            if (
              responsibleFilter &&
              constraint.responsible_party !==
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
                      item.location,
                      item.type,
                    ].join(' ')
                )
                .join(' ');


            const haystack =
              normalizeText(
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
                ].join(' ')
              );


            return haystack.includes(
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
  // RENDER
  // ==========================================================

  return (
    <div
      style={{
        minHeight: '100%',
        padding: '18px 20px 40px',
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >

      {/* ====================================================
          TITLE
      ===================================================== */}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '18px',
        }}
      >

        <div>

          <h1
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 800,
            }}
          >
            CONSTRAINT LOG
          </h1>


          <p
            style={{
              maxWidth: '760px',
              margin: '6px 0 0',
              color: '#64748b',
              fontSize: '11px',
              lineHeight: 1.5,
            }}
          >
            Central project-level management of constraints,
            ownership, required actions, due dates and readiness
            clearance.
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
          PROJECT CONTROL
      ===================================================== */}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '16px',
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

            disabled={
              loading
            }

            onClick={() =>
              loadConstraintLog(
                selectedProjectId
              )
            }

            style={
              loading
                ? disabledButtonStyle
                : secondaryButtonStyle
            }
          >
            {loading
              ? 'Refreshing...'
              : 'Refresh'}
          </button>

        )}


        {selectedProject && (

          <div
            style={{
              padding: '9px 11px',
              border:
                '1px solid #dbeafe',
              borderRadius: '6px',
              background: '#eff6ff',
              color: '#1e40af',
              fontSize: '10px',
              fontWeight: 700,
            }}
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
          style={{
            marginBottom: '14px',
            padding: '10px 12px',
            border:
              '1px solid #fecaca',
            borderRadius: '6px',
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: '11px',
          }}
        >
          {errorMessage}
        </div>

      )}


      {successMessage && (

        <div
          style={{
            marginBottom: '14px',
            padding: '10px 12px',
            border:
              '1px solid #bbf7d0',
            borderRadius: '6px',
            background: '#f0fdf4',
            color: '#166534',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          {successMessage}
        </div>

      )}


      {/* ====================================================
          EMPTY PROJECT
      ===================================================== */}

      {!selectedProjectId && (

        <div
          style={
            emptyStyle
          }
        >

          <strong>
            No Project Selected
          </strong>


          <div
            style={{
              marginTop: '6px',
              color: '#64748b',
              fontSize: '11px',
            }}
          >
            Select a project to open its centralized Constraint Log.
          </div>

        </div>

      )}


      {/* ====================================================
          WORKSPACE
      ===================================================== */}

      {selectedProjectId && (

        <>

          {/* SUMMARY */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '10px',
              marginBottom: '14px',
            }}
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
              description="Past required resolution date"
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
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(220px, 2fr) repeat(4, minmax(145px, 1fr))',
              gap: '8px',
              marginBottom: '12px',
              padding: '12px',
              border:
                '1px solid #e2e8f0',
              borderRadius: '7px',
              background: '#ffffff',
            }}
          >

            <FilterField label="Search">

              <input
                type="text"

                value={
                  searchTerm
                }

                placeholder="Reference, package, location, action..."

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
              />

            </FilterField>


            <FilterField label="Status">

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


            <FilterField label="Priority">

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
                  (priority) => (

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


          {/* RESULTS */}

          <div
            style={{
              marginBottom: '7px',
              color: '#64748b',
              fontSize: '10px',
            }}
          >
            Showing{' '}
            <strong
              style={{
                color: '#0f172a',
              }}
            >
              {filteredConstraints.length}
            </strong>{' '}
            of{' '}
            <strong
              style={{
                color: '#0f172a',
              }}
            >
              {constraints.length}
            </strong>{' '}
            constraints
          </div>


          {/* TABLE */}

          <div
            style={{
              overflowX: 'auto',
              border:
                '1px solid #cbd5e1',
              background: '#ffffff',
            }}
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
                {constraints.length ===
                0
                  ? 'No constraints are registered for this project.'
                  : 'No constraints match the selected filters.'}
              </div>

            ) : (

              <table
                style={{
                  width: '100%',
                  minWidth: '1540px',
                  borderCollapse:
                    'collapse',
                  tableLayout: 'fixed',
                  fontSize: '10px',
                }}
              >

                <thead>

                  <tr>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '92px',
                      }}
                    >
                      REFERENCE
                    </th>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '100px',
                      }}
                    >
                      PACKAGE
                    </th>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '230px',
                      }}
                    >
                      LOCATION / AFFECTED WORK
                    </th>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '150px',
                      }}
                    >
                      CATEGORY
                    </th>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '115px',
                      }}
                    >
                      STATUS
                    </th>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '115px',
                      }}
                    >
                      PRIORITY
                    </th>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '170px',
                      }}
                    >
                      RESPONSIBLE
                    </th>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '260px',
                      }}
                    >
                      REQUIRED ACTION
                    </th>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '105px',
                      }}
                    >
                      DUE DATE
                    </th>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '125px',
                      }}
                    >
                      SOURCE
                    </th>

                    <th
                      style={{
                        ...headerCellStyle,
                        width: '90px',
                      }}
                    >
                      ACTIONS
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {filteredConstraints.map(
                    (constraint) => {

                      const affected =
                        getConstraintAffectedWork(
                          constraint
                        );


                      const packageCodes =
                        Array.from(
                          new Set(
                            affected
                              .map(
                                (item) =>
                                  item.packageCode
                              )
                              .filter(Boolean)
                          )
                        );


                      const statusStyle =
                        getStatusStyle(
                          constraint.status
                        );


                      const priorityStyle =
                        getPriorityStyle(
                          constraint.priority
                        );


                      const dueDate =
                        getDueDate(
                          constraint
                        );


                      const overdue =
                        isConstraintOverdue(
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
                            {packageCodes.length >
                            0
                              ? packageCodes.join(
                                  ', '
                                )
                              : (
                                <span
                                  style={
                                    mutedStyle
                                  }
                                >
                                  Project-level
                                </span>
                              )}
                          </td>


                          <td
                            style={{
                              ...bodyCellStyle,
                              textAlign: 'left',
                            }}
                          >
                            {affected.length >
                            0
                              ? affected.map(
                                  (item) => (
                                    <div
                                      key={
                                        item.key
                                      }
                                      style={{
                                        marginBottom:
                                          '4px',
                                      }}
                                    >
                                      <strong>
                                        {item.location}
                                      </strong>

                                      <div
                                        style={
                                          mutedStyle
                                        }
                                      >
                                        {item.type}
                                      </div>
                                    </div>
                                  )
                                )
                              : (
                                <span
                                  style={
                                    mutedStyle
                                  }
                                >
                                  Project-level constraint
                                </span>
                              )}
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

                            {constraint.status ===
                              'resolved' && (
                              <div
                                style={
                                  resolvedTextStyle
                                }
                              >
                                Awaiting Clearance
                              </div>
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
                              textAlign: 'left',
                            }}
                          >
                            {constraint
                              .responsible_party ||
                              '—'}
                          </td>


                          <td
                            style={{
                              ...bodyCellStyle,
                              textAlign: 'left',
                            }}
                          >
                            {constraint
                              .action_required ||
                              constraint.title ||
                              constraint.description ||
                              '—'}
                          </td>


                          <td
                            style={{
                              ...bodyCellStyle,
                              color:
                                overdue
                                  ? '#b91c1c'
                                  : '#334155',
                              fontWeight:
                                overdue
                                  ? 800
                                  : 600,
                            }}
                          >
                            {formatDate(
                              dueDate
                            )}

                            {overdue && (
                              <div
                                style={
                                  blockingTextStyle
                                }
                              >
                                OVERDUE
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
                                openConstraintHistory(
                                  constraint
                                )
                              }

                              style={
                                historyButtonStyle
                              }
                            >
                              History
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
                    modalEyebrowStyle
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


                <p
                  style={
                    modalDescriptionStyle
                  }
                >
                  Register a project-level constraint that may exist
                  independently from Lookahead Planning.
                </p>

              </div>


              <button
                type="button"

                disabled={
                  creatingConstraint
                }

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

              style={{
                padding: '20px',
              }}
            >

              <div
                style={
                  modalGridStyle
                }
              >

                <ModalField
                  label="Constraint Category"
                >

                  <select
                    required

                    value={
                      form.category
                    }

                    onChange={(
                      event
                    ) =>
                      setForm(
                        (current) => ({
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
                        (current) => ({
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

              </div>


              <ModalField
                label="What is blocking the work?"
              >

                <input
                  type="text"
                  required

                  value={
                    form.title
                  }

                  placeholder="Example: Approved structural drawing unavailable"

                  onChange={(
                    event
                  ) =>
                    setForm(
                      (current) => ({
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
                  modalGridStyle
                }
              >

                <ModalField
                  label="Responsible Party"
                >

                  <input
                    type="text"
                    required

                    value={
                      form.responsible_party
                    }

                    placeholder="Company or responsible person"

                    onChange={(
                      event
                    ) =>
                      setForm(
                        (current) => ({
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
                  label="Due Date"
                >

                  <input
                    type="date"
                    required

                    value={
                      form.required_by_date
                    }

                    onChange={(
                      event
                    ) =>
                      setForm(
                        (current) => ({
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
                  required
                  rows={3}

                  value={
                    form.action_required
                  }

                  placeholder="Example: Issue approved IFC drawing before production release"

                  onChange={(
                    event
                  ) =>
                    setForm(
                      (current) => ({
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
                  rows={3}

                  value={
                    form.description
                  }

                  placeholder="Additional context, impact, background or observations..."

                  onChange={(
                    event
                  ) =>
                    setForm(
                      (current) => ({
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
                  blockingToggleStyle
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
                      (current) => ({
                        ...current,

                        blocking:
                          event.target.checked,
                      })
                    )
                  }
                />


                <div>

                  <strong>
                    Blocking Constraint
                  </strong>


                  <div
                    style={{
                      marginTop: '3px',
                      color: '#64748b',
                      fontSize: '9px',
                      lineHeight: 1.4,
                    }}
                  >
                    Blocking constraints can affect production readiness
                    until formally cleared.
                  </div>

                </div>

              </label>


              <div
                style={
                  governanceBoxStyle
                }
              >
                New manual constraints start as{' '}
                <strong>OPEN</strong>. Creation is automatically
                recorded in Action History. A constraint that later
                reaches <strong>RESOLVED</strong> remains active until
                its resolution is verified and the constraint becomes{' '}
                <strong>CLEARED</strong>.
              </div>


              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  marginTop: '20px',
                }}
              >

                <button
                  type="button"

                  disabled={
                    creatingConstraint
                  }

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
                    creatingConstraint
                      ? disabledPrimaryButtonStyle
                      : primaryButtonStyle
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


      {/* ====================================================
          ACTION HISTORY MODAL
      ===================================================== */}

      {showHistoryModal &&
        historyConstraint && (

        <div
          style={
            modalOverlayStyle
          }
        >

          <div
            style={
              historyModalStyle
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
                    modalEyebrowStyle
                  }
                >
                  ACTION HISTORY
                </div>


                <h2
                  style={
                    modalTitleStyle
                  }
                >
                  {getConstraintReference(
                    historyConstraint.id
                  )}
                </h2>


                <p
                  style={
                    modalDescriptionStyle
                  }
                >
                  {historyConstraint.title}
                </p>

              </div>


              <button
                type="button"

                onClick={
                  closeConstraintHistory
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
                padding: '20px',
              }}
            >

              {/* CURRENT STATE */}

              <div
                style={
                  historyCurrentStateStyle
                }
              >

                <div>

                  <div
                    style={
                      historyMetaLabelStyle
                    }
                  >
                    CURRENT STATUS
                  </div>

                  <div
                    style={{
                      marginTop: '4px',
                      fontWeight: 800,
                    }}
                  >
                    {getStatusLabel(
                      historyConstraint.status
                    )}
                  </div>

                </div>


                <div>

                  <div
                    style={
                      historyMetaLabelStyle
                    }
                  >
                    RESPONSIBLE
                  </div>

                  <div
                    style={{
                      marginTop: '4px',
                      fontWeight: 800,
                    }}
                  >
                    {historyConstraint
                      .responsible_party ||
                      '—'}
                  </div>

                </div>


                <div>

                  <div
                    style={
                      historyMetaLabelStyle
                    }
                  >
                    TARGET DATE
                  </div>

                  <div
                    style={{
                      marginTop: '4px',
                      fontWeight: 800,
                    }}
                  >
                    {formatDate(
                      getDueDate(
                        historyConstraint
                      )
                    )}
                  </div>

                </div>

              </div>


              {historyError && (

                <div
                  style={{
                    marginBottom: '14px',
                    padding: '10px 12px',
                    border:
                      '1px solid #fecaca',
                    borderRadius: '6px',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    fontSize: '11px',
                  }}
                >
                  {historyError}
                </div>

              )}


              {loadingHistory ? (

                <div
                  style={
                    historyEmptyStyle
                  }
                >
                  Loading Action History...
                </div>

              ) : constraintHistory.length ===
                0 ? (

                <div
                  style={
                    historyEmptyStyle
                  }
                >
                  No Action History has been recorded for this
                  constraint yet.
                </div>

              ) : (

                <div
                  style={{
                    position: 'relative',
                  }}
                >

                  {constraintHistory.map(
                    (
                      entry,
                      index
                    ) => {

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
                          key={
                            entry.id
                          }

                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              '28px minmax(0, 1fr)',
                            gap: '12px',
                          }}
                        >

                          {/* TIMELINE */}

                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                            }}
                          >

                            <div
                              style={
                                historyDotStyle
                              }
                            />

                            {index <
                              constraintHistory.length -
                                1 && (

                              <div
                                style={
                                  historyLineStyle
                                }
                              />

                            )}

                          </div>


                          {/* ENTRY */}

                          <div
                            style={{
                              paddingBottom:
                                index <
                                constraintHistory.length -
                                  1
                                  ? '20px'
                                  : 0,
                            }}
                          >

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent:
                                  'space-between',
                                gap: '12px',
                                flexWrap: 'wrap',
                              }}
                            >

                              <div>

                                <div
                                  style={
                                    historyActionTitleStyle
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
                                  historyTimestampStyle
                                }
                              >
                                {formatDateTime(
                                  entry.created_at
                                )}
                              </div>

                            </div>


                            {(hasStatusChange ||
                              hasDateChange ||
                              entry.comment) && (

                              <div
                                style={
                                  historyEntryBoxStyle
                                }
                              >

                                {hasStatusChange && (

                                  <div
                                    style={
                                      historyChangeRowStyle
                                    }
                                  >

                                    <span
                                      style={
                                        historyChangeLabelStyle
                                      }
                                    >
                                      Status
                                    </span>

                                    <span>
                                      {entry.status_from
                                        ? getStatusLabel(
                                            entry.status_from
                                          )
                                        : '—'}

                                      {' → '}

                                      {entry.status_to
                                        ? getStatusLabel(
                                            entry.status_to
                                          )
                                        : '—'}
                                    </span>

                                  </div>

                                )}


                                {hasDateChange && (

                                  <div
                                    style={
                                      historyChangeRowStyle
                                    }
                                  >

                                    <span
                                      style={
                                        historyChangeLabelStyle
                                      }
                                    >
                                      Target Date
                                    </span>

                                    <span>
                                      {formatDate(
                                        entry
                                          .previous_target_resolution_date
                                      )}

                                      {' → '}

                                      {formatDate(
                                        entry
                                          .new_target_resolution_date
                                      )}
                                    </span>

                                  </div>

                                )}


                                {entry.comment && (

                                  <div
                                    style={{
                                      marginTop:
                                        hasStatusChange ||
                                        hasDateChange
                                          ? '9px'
                                          : 0,

                                      paddingTop:
                                        hasStatusChange ||
                                        hasDateChange
                                          ? '9px'
                                          : 0,

                                      borderTop:
                                        hasStatusChange ||
                                        hasDateChange
                                          ? '1px solid #e2e8f0'
                                          : 'none',

                                      color: '#475569',
                                      fontSize: '10px',
                                      lineHeight: 1.55,
                                    }}
                                  >
                                    {entry.comment}
                                  </div>

                                )}

                              </div>

                            )}

                          </div>

                        </div>

                      );

                    }
                  )}

                </div>

              )}


              <div
                style={
                  historyAuditNoticeStyle
                }
              >
                Action History is read-only. Historical records are
                retained as an audit trail of constraint management
                decisions and lifecycle changes.
              </div>


              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '18px',
                }}
              >

                <button
                  type="button"

                  onClick={
                    closeConstraintHistory
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
      style={{
        minHeight: '92px',
        padding: '14px 15px',
        border:
          '1px solid #e2e8f0',
        borderRadius: '7px',
        background: '#ffffff',
      }}
    >

      <div
        style={{
          color: '#64748b',
          fontSize: '9px',
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>


      <div
        style={{
          marginTop: '5px',
          color: '#0f172a',
          fontSize: '25px',
          fontWeight: 900,
        }}
      >
        {value}
      </div>


      <div
        style={{
          marginTop: '7px',
          color: '#94a3b8',
          fontSize: '9px',
        }}
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
        marginBottom: '15px',
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


// ============================================================
// STYLES
// ============================================================

const labelStyle = {
  display: 'block',
  marginBottom: '5px',
  color: '#334155',
  fontSize: '11px',
  fontWeight: 700,
};


const selectStyle = {
  width: '100%',
  height: '36px',
  padding: '0 10px',
  border:
    '1px solid #cbd5e1',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '11px',
};


const filterLabelStyle = {
  display: 'block',
  marginBottom: '4px',
  color: '#64748b',
  fontSize: '9px',
  fontWeight: 800,
  textTransform: 'uppercase',
};


const filterInputStyle = {
  width: '100%',
  height: '34px',
  padding: '0 8px',
  border:
    '1px solid #cbd5e1',
  borderRadius: '5px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '10px',
};


const primaryButtonStyle = {
  height: '36px',
  padding: '0 13px',
  border:
    '1px solid #2563eb',
  borderRadius: '6px',
  background: '#2563eb',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 800,
  cursor: 'pointer',
};


const disabledPrimaryButtonStyle = {
  ...primaryButtonStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};


const secondaryButtonStyle = {
  height: '36px',
  padding: '0 12px',
  border:
    '1px solid #cbd5e1',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#334155',
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
};


const disabledButtonStyle = {
  ...secondaryButtonStyle,
  opacity: 0.45,
  cursor: 'not-allowed',
};


const historyButtonStyle = {
  height: '28px',
  padding: '0 9px',
  border:
    '1px solid #bfdbfe',
  borderRadius: '5px',
  background: '#eff6ff',
  color: '#1d4ed8',
  fontSize: '9px',
  fontWeight: 800,
  cursor: 'pointer',
};


const headerCellStyle = {
  padding: '7px 6px',
  border:
    '1px solid #cbd5e1',
  background: '#f8fafc',
  color: '#334155',
  textAlign: 'center',
  fontSize: '8px',
  fontWeight: 900,
};


const bodyCellStyle = {
  padding: '7px',
  border:
    '1px solid #e2e8f0',
  background: '#ffffff',
  color: '#334155',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontSize: '9px',
};


const badgeBaseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 7px',
  borderRadius: '999px',
  fontSize: '8px',
  fontWeight: 900,
};


const mutedStyle = {
  color: '#94a3b8',
  fontSize: '8px',
};


const blockingTextStyle = {
  marginTop: '3px',
  color: '#b91c1c',
  fontSize: '8px',
  fontWeight: 900,
};


const resolvedTextStyle = {
  marginTop: '4px',
  color: '#7c3aed',
  fontSize: '8px',
  fontWeight: 700,
};


const loadingStyle = {
  padding: '50px 20px',
  color: '#64748b',
  textAlign: 'center',
  fontSize: '12px',
};


const emptyStyle = {
  padding: '50px 20px',
  border:
    '1px solid #e2e8f0',
  background: '#ffffff',
  color: '#64748b',
  textAlign: 'center',
  fontSize: '12px',
};


const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 7000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  background:
    'rgba(6,27,47,0.60)',
};


const modalStyle = {
  width:
    'min(680px, 96vw)',
  maxHeight: '92vh',
  overflowY: 'auto',
  borderRadius: '10px',
  background: '#ffffff',
  boxShadow:
    '0 24px 70px rgba(15,23,42,0.30)',
};


const historyModalStyle = {
  width:
    'min(760px, 96vw)',
  maxHeight: '92vh',
  overflowY: 'auto',
  borderRadius: '10px',
  background: '#ffffff',
  boxShadow:
    '0 24px 70px rgba(15,23,42,0.30)',
};


const modalHeaderStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent:
    'space-between',
  gap: '20px',
  padding: '18px 20px',
  borderBottom:
    '1px solid #e2e8f0',
};


const modalEyebrowStyle = {
  color: '#2563eb',
  fontSize: '9px',
  fontWeight: 900,
  letterSpacing: '0.08em',
};


const modalTitleStyle = {
  margin: '4px 0 0',
  fontSize: '19px',
  fontWeight: 900,
};


const modalDescriptionStyle = {
  margin: '6px 0 0',
  color: '#64748b',
  fontSize: '10px',
  lineHeight: 1.5,
};


const closeButtonStyle = {
  width: '34px',
  height: '34px',
  border:
    '1px solid #e2e8f0',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#64748b',
  fontSize: '20px',
  cursor: 'pointer',
};


const modalGridStyle = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(2, minmax(0, 1fr))',
  gap: '12px',
};


const modalLabelStyle = {
  display: 'block',
  marginBottom: '6px',
  color: '#334155',
  fontSize: '10px',
  fontWeight: 800,
};


const modalInputStyle = {
  width: '100%',
  height: '38px',
  padding: '0 9px',
  border:
    '1px solid #cbd5e1',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '11px',
  outline: 'none',
};


const modalTextareaStyle = {
  width: '100%',
  minHeight: '82px',
  padding: '9px',
  border:
    '1px solid #cbd5e1',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '11px',
  fontFamily: 'inherit',
  resize: 'vertical',
  outline: 'none',
};


const blockingToggleStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '11px',
  border:
    '1px solid #e2e8f0',
  borderRadius: '6px',
  background: '#f8fafc',
  color: '#334155',
  fontSize: '10px',
  cursor: 'pointer',
};


const governanceBoxStyle = {
  marginTop: '14px',
  padding: '10px 11px',
  border:
    '1px solid #ddd6fe',
  borderRadius: '6px',
  background: '#f5f3ff',
  color: '#5b21b6',
  fontSize: '9px',
  lineHeight: 1.5,
};


// ============================================================
// ACTION HISTORY STYLES
// ============================================================

const historyCurrentStateStyle = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(3, minmax(0, 1fr))',
  gap: '10px',
  marginBottom: '22px',
  padding: '12px',
  border:
    '1px solid #e2e8f0',
  borderRadius: '7px',
  background: '#f8fafc',
  color: '#334155',
  fontSize: '10px',
};


const historyMetaLabelStyle = {
  color: '#94a3b8',
  fontSize: '8px',
  fontWeight: 900,
  letterSpacing: '0.04em',
};


const historyDotStyle = {
  width: '10px',
  height: '10px',
  flexShrink: 0,
  marginTop: '4px',
  border:
    '2px solid #2563eb',
  borderRadius: '50%',
  background: '#ffffff',
};


const historyLineStyle = {
  width: '2px',
  minHeight: '76px',
  flex: 1,
  marginTop: '4px',
  background: '#dbeafe',
};


const historyActionTitleStyle = {
  color: '#0f172a',
  fontSize: '11px',
  fontWeight: 900,
};


const historyActorStyle = {
  marginTop: '3px',
  color: '#64748b',
  fontSize: '9px',
  fontWeight: 600,
};


const historyTimestampStyle = {
  color: '#94a3b8',
  fontSize: '9px',
  whiteSpace: 'nowrap',
};


const historyEntryBoxStyle = {
  marginTop: '9px',
  padding: '10px 11px',
  border:
    '1px solid #e2e8f0',
  borderRadius: '6px',
  background: '#f8fafc',
};


const historyChangeRowStyle = {
  display: 'grid',
  gridTemplateColumns:
    '90px minmax(0, 1fr)',
  gap: '8px',
  marginBottom: '5px',
  color: '#334155',
  fontSize: '9px',
};


const historyChangeLabelStyle = {
  color: '#64748b',
  fontWeight: 800,
};


const historyEmptyStyle = {
  padding: '38px 20px',
  color: '#64748b',
  textAlign: 'center',
  fontSize: '11px',
};


const historyAuditNoticeStyle = {
  marginTop: '20px',
  padding: '10px 11px',
  border:
    '1px solid #dbeafe',
  borderRadius: '6px',
  background: '#eff6ff',
  color: '#1e40af',
  fontSize: '9px',
  lineHeight: 1.5,
};
