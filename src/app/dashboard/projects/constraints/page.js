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
// Architecture:
// ------------------------------------------------------------
// Constraint Log belongs to the PROJECT.
//
// Lookahead / Koskela may identify or link constraints,
// but constraints remain independent project-level objects.
//
// Readiness governance:
// OPEN        -> blocking
// IN PROGRESS -> blocking
// WAITING     -> blocking
// RESOLVED    -> blocking
// CLEARED     -> released
// CANCELLED   -> released
//
// SQL foundation:
// 94_constraint_management_foundation.sql
// 96_constraint_cleared_readiness_gate.sql
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


const CATEGORY_LABELS = {
  projects_information:
    'Projects / Information',

  materials:
    'Materials',

  labor:
    'Labor',

  equipment:
    'Equipment',

  space:
    'Space',

  predecessor:
    'Predecessor',

  predecessors:
    'Predecessor',

  external_conditions:
    'External Conditions',
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
      month: 'short',
      day: '2-digit',
      year: 'numeric',
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
  const normalized =
    normalizeText(
      priority
    );

  if (
    normalized === 'critical'
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
    normalized === 'high'
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
    normalized === 'medium'
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
    normalized === 'low'
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
      async (
        projectId
      ) => {

        if (!projectId) {

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

          // --------------------------------------------------
          // CENTRAL PROJECT CONSTRAINTS
          // --------------------------------------------------

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


          // --------------------------------------------------
          // MULTIPLE AFFECTED WORK RELATIONSHIPS
          // --------------------------------------------------

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
          // LOOKAHEAD WORK REFERENCES
          // --------------------------------------------------

          const lookaheadIds =
            Array.from(
              new Set(
                loadedAffectedWork
                  .map(
                    (item) =>
                      item
                        .lookahead_work_item_id
                  )
                  .filter(
                    Boolean
                  )
              )
            );


          const directLookaheadIds =
            loadedConstraints
              .map(
                (constraint) =>
                  constraint
                    .lookahead_work_item_id
              )
              .filter(
                Boolean
              );


          const allLookaheadIds =
            Array.from(
              new Set([
                ...lookaheadIds,
                ...directLookaheadIds,
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

          const affectedMasterPlanIds =
            loadedAffectedWork
              .map(
                (item) =>
                  item
                    .master_plan_package_id
              )
              .filter(
                Boolean
              );


          const directMasterPlanIds =
            loadedConstraints
              .map(
                (constraint) =>
                  constraint
                    .master_plan_package_id
              )
              .filter(
                Boolean
              );


          const lookaheadMasterPlanIds =
            Object
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
              );


          const allMasterPlanIds =
            Array.from(
              new Set([
                ...affectedMasterPlanIds,
                ...directMasterPlanIds,
                ...lookaheadMasterPlanIds,
              ])
            );


          let nextMasterPlanMap =
            {};


          if (
            allMasterPlanIds.length >
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
                  allMasterPlanIds
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

          setLoading(
            false
          );

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
    (
      projectId
    ) => {

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


      if (
        projectId
      ) {

        window.history
          .replaceState(
            {},
            '',
            `/dashboard/projetos/constraints?projectId=${projectId}`
          );

      } else {

        window.history
          .replaceState(
            {},
            '',
            '/dashboard/projetos/constraints'
          );

      }

    };


  // ==========================================================
  // RELATIONSHIP MAP
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
              ] = [];

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
  // AFFECTED WORK DISPLAY
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


        const workItems =
          [];


        relationships.forEach(
          (
            relationship
          ) => {

            if (
              relationship
                .lookahead_work_item_id
            ) {

              const lookaheadItem =
                lookaheadItems[
                  relationship
                    .lookahead_work_item_id
                ];


              if (
                lookaheadItem
              ) {

                workItems.push({
                  key:
                    `lookahead-${lookaheadItem.id}`,

                  type:
                    'Lookahead',

                  packageCode:
                    lookaheadItem
                      .package_code ||
                    '—',

                  serviceName:
                    lookaheadItem
                      .service_name ||
                    '',

                  location:
                    lookaheadItem
                      .location_path ||
                    lookaheadItem
                      .location_name ||
                    'Unassigned Location',
                });

              }

            }


            if (
              relationship
                .master_plan_package_id
            ) {

              const masterPlanItem =
                masterPlanPackages[
                  relationship
                    .master_plan_package_id
                ];


              if (
                masterPlanItem
              ) {

                workItems.push({
                  key:
                    `master-${masterPlanItem.id}`,

                  type:
                    'Master Plan',

                  packageCode:
                    masterPlanItem
                      .package_code ||
                    '—',

                  serviceName:
                    masterPlanItem
                      .service_name ||
                    '',

                  location:
                    masterPlanItem
                      .location_path ||
                    masterPlanItem
                      .location_name ||
                    'Unassigned Location',
                });

              }

            }

          }
        );


        // ----------------------------------------------------
        // LEGACY DIRECT RELATIONSHIPS
        //
        // SQL 94 preserves these temporarily for compatibility.
        // Add them only when the many-to-many relationship
        // layer did not already provide the same reference.
        // ----------------------------------------------------

        if (
          constraint
            .lookahead_work_item_id
        ) {

          const lookaheadItem =
            lookaheadItems[
              constraint
                .lookahead_work_item_id
            ];


          const alreadyIncluded =
            workItems.some(
              (item) =>
                item.key ===
                `lookahead-${constraint.lookahead_work_item_id}`
            );


          if (
            lookaheadItem &&
            !alreadyIncluded
          ) {

            workItems.push({
              key:
                `lookahead-${lookaheadItem.id}`,

              type:
                'Lookahead',

              packageCode:
                lookaheadItem
                  .package_code ||
                '—',

              serviceName:
                lookaheadItem
                  .service_name ||
                '',

              location:
                lookaheadItem
                  .location_path ||
                lookaheadItem
                  .location_name ||
                'Unassigned Location',
            });

          }

        }


        if (
          constraint
            .master_plan_package_id
        ) {

          const masterPlanItem =
            masterPlanPackages[
              constraint
                .master_plan_package_id
            ];


          const alreadyIncluded =
            workItems.some(
              (item) =>
                item.key ===
                `master-${constraint.master_plan_package_id}`
            );


          if (
            masterPlanItem &&
            !alreadyIncluded
          ) {

            workItems.push({
              key:
                `master-${masterPlanItem.id}`,

              type:
                'Master Plan',

              packageCode:
                masterPlanItem
                  .package_code ||
                '—',

              serviceName:
                masterPlanItem
                  .service_name ||
                '',

              location:
                masterPlanItem
                  .location_path ||
                masterPlanItem
                  .location_name ||
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
  // KPI COUNTS
  // ==========================================================

  const summary =
    useMemo(
      () => {

        return {

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

                  constraint
                    .responsible_party,

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
          TITLE
      ===================================================== */}

      <div
        style={{
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

              lineHeight:
                1.5,
            }}
          >
            Central project-level management of constraints,
            ownership, required actions, due dates and readiness
            clearance.
          </p>

        </div>


        {selectedProject && (

          <div
            style={{
              padding:
                '8px 11px',

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

            onClick={() =>
              loadConstraintLog(
                selectedProjectId
              )
            }

            disabled={
              loading
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

      </div>


      {/* ====================================================
          ERROR
      ===================================================== */}

      {errorMessage && (

        <div
          style={{
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

            lineHeight:
              1.45,
          }}
        >
          {errorMessage}
        </div>

      )}


      {/* ====================================================
          NO PROJECT
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
              marginTop:
                '6px',

              color:
                '#64748b',

              fontSize:
                '11px',
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

          {/* ==================================================
              SUMMARY
          ================================================== */}

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',

              gap:
                '10px',

              marginBottom:
                '14px',
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


          {/* ==================================================
              FILTERS
          ================================================== */}

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                'minmax(220px, 2fr) repeat(4, minmax(145px, 1fr))',

              gap:
                '8px',

              marginBottom:
                '12px',

              padding:
                '12px',

              border:
                '1px solid #e2e8f0',

              borderRadius:
                '7px',

              background:
                '#ffffff',
            }}
          >

            <div>

              <label
                style={
                  filterLabelStyle
                }
              >
                Search
              </label>


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

            </div>


            <div>

              <label
                style={
                  filterLabelStyle
                }
              >
                Status
              </label>


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

            </div>


            <div>

              <label
                style={
                  filterLabelStyle
                }
              >
                Category
              </label>


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

            </div>


            <div>

              <label
                style={
                  filterLabelStyle
                }
              >
                Priority
              </label>


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

            </div>


            <div>

              <label
                style={
                  filterLabelStyle
                }
              >
                Responsible
              </label>


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

            </div>

          </div>


          {/* ==================================================
              RESULT COUNT
          ================================================== */}

          <div
            style={{
              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'space-between',

              gap:
                '12px',

              marginBottom:
                '7px',

              color:
                '#64748b',

              fontSize:
                '10px',
            }}
          >

            <span>
              Showing{' '}
              <strong
                style={{
                  color:
                    '#0f172a',
                }}
              >
                {
                  filteredConstraints.length
                }
              </strong>{' '}
              of{' '}
              <strong
                style={{
                  color:
                    '#0f172a',
                }}
              >
                {
                  constraints.length
                }
              </strong>{' '}
              constraints
            </span>


            {(
              searchTerm ||
              statusFilter ||
              categoryFilter ||
              priorityFilter ||
              responsibleFilter
            ) && (

              <button
                type="button"

                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setCategoryFilter('');
                  setPriorityFilter('');
                  setResponsibleFilter('');
                }}

                style={
                  clearFiltersButtonStyle
                }
              >
                Clear Filters
              </button>

            )}

          </div>


          {/* ==================================================
              TABLE
          ================================================== */}

          <div
            style={{
              overflowX:
                'auto',

              border:
                '1px solid #cbd5e1',

              background:
                '#ffffff',
            }}
          >

            {loading ? (

              <div
                style={{
                  padding:
                    '50px 20px',

                  color:
                    '#64748b',

                  textAlign:
                    'center',

                  fontSize:
                    '12px',
                }}
              >
                Loading Constraint Log...
              </div>

            ) : filteredConstraints.length ===
              0 ? (

              <div
                style={{
                  padding:
                    '50px 20px',

                  color:
                    '#64748b',

                  textAlign:
                    'center',

                  fontSize:
                    '12px',
                }}
              >

                {constraints.length ===
                0
                  ? 'No constraints are registered for this project.'
                  : 'No constraints match the selected filters.'}

              </div>

            ) : (

              <table
                style={{
                  width:
                    '100%',

                  minWidth:
                    '1450px',

                  borderCollapse:
                    'collapse',

                  tableLayout:
                    'fixed',

                  fontSize:
                    '10px',
                }}
              >

                <thead>

                  <tr>

                    <th
                      style={{
                        ...headerCellStyle,
                        width:
                          '92px',
                      }}
                    >
                      REFERENCE
                    </th>


                    <th
                      style={{
                        ...headerCellStyle,
                        width:
                          '100px',
                      }}
                    >
                      PACKAGE
                    </th>


                    <th
                      style={{
                        ...headerCellStyle,
                        width:
                          '230px',
                      }}
                    >
                      LOCATION / AFFECTED WORK
                    </th>


                    <th
                      style={{
                        ...headerCellStyle,
                        width:
                          '150px',
                      }}
                    >
                      CATEGORY
                    </th>


                    <th
                      style={{
                        ...headerCellStyle,
                        width:
                          '115px',
                      }}
                    >
                      STATUS
                    </th>


                    <th
                      style={{
                        ...headerCellStyle,
                        width:
                          '115px',
                      }}
                    >
                      PRIORITY
                    </th>


                    <th
                      style={{
                        ...headerCellStyle,
                        width:
                          '170px',
                      }}
                    >
                      RESPONSIBLE
                    </th>


                    <th
                      style={{
                        ...headerCellStyle,
                        width:
                          '260px',
                      }}
                    >
                      REQUIRED ACTION
                    </th>


                    <th
                      style={{
                        ...headerCellStyle,
                        width:
                          '105px',
                      }}
                    >
                      DUE DATE
                    </th>


                    <th
                      style={{
                        ...headerCellStyle,
                        width:
                          '125px',
                      }}
                    >
                      SOURCE
                    </th>

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


                      const uniquePackages =
                        Array.from(
                          new Set(
                            affected
                              .map(
                                (item) =>
                                  item.packageCode
                              )
                              .filter(
                                Boolean
                              )
                          )
                        );


                      const dueDate =
                        getDueDate(
                          constraint
                        );


                      const overdue =
                        isConstraintOverdue(
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


                      return (

                        <tr
                          key={
                            constraint.id
                          }
                        >

                          {/* REFERENCE */}

                          <td
                            style={
                              bodyCellStyle
                            }
                          >

                            <div
                              style={{
                                color:
                                  '#0f172a',

                                fontSize:
                                  '10px',

                                fontWeight:
                                  900,
                              }}
                            >
                              {getConstraintReference(
                                constraint.id
                              )}
                            </div>


                            {constraint.blocking && (

                              <div
                                style={{
                                  marginTop:
                                    '3px',

                                  color:
                                    '#b91c1c',

                                  fontSize:
                                    '8px',

                                  fontWeight:
                                    800,
                                }}
                              >
                                BLOCKING
                              </div>

                            )}

                          </td>


                          {/* PACKAGE */}

                          <td
                            style={
                              bodyCellStyle
                            }
                          >

                            {uniquePackages.length >
                            0 ? (

                              <div
                                style={{
                                  display:
                                    'flex',

                                  alignItems:
                                    'center',

                                  justifyContent:
                                    'center',

                                  gap:
                                    '3px',

                                  flexWrap:
                                    'wrap',
                                }}
                              >

                                {uniquePackages
                                  .slice(
                                    0,
                                    3
                                  )
                                  .map(
                                    (
                                      packageCode
                                    ) => (

                                      <span
                                        key={
                                          packageCode
                                        }

                                        style={
                                          packageBadgeStyle
                                        }
                                      >
                                        {packageCode}
                                      </span>

                                    )
                                  )}


                                {uniquePackages.length >
                                  3 && (

                                  <span
                                    style={{
                                      color:
                                        '#64748b',

                                      fontSize:
                                        '8px',

                                      fontWeight:
                                        700,
                                    }}
                                  >
                                    +{
                                      uniquePackages.length -
                                      3
                                    }
                                  </span>

                                )}

                              </div>

                            ) : (

                              <span
                                style={
                                  mutedStyle
                                }
                              >
                                Project-level
                              </span>

                            )}

                          </td>


                          {/* AFFECTED WORK */}

                          <td
                            style={{
                              ...bodyCellStyle,

                              padding:
                                '7px 9px',

                              textAlign:
                                'left',
                            }}
                          >

                            {affected.length >
                            0 ? (

                              <div>

                                {affected
                                  .slice(
                                    0,
                                    3
                                  )
                                  .map(
                                    (
                                      item
                                    ) => (

                                      <div
                                        key={
                                          item.key
                                        }

                                        style={{
                                          marginBottom:
                                            '4px',
                                        }}
                                      >

                                        <div
                                          style={{
                                            color:
                                              '#334155',

                                            fontSize:
                                              '9px',

                                            fontWeight:
                                              700,

                                            lineHeight:
                                              1.35,
                                          }}
                                        >
                                          {item.location}
                                        </div>


                                        <div
                                          style={{
                                            marginTop:
                                              '1px',

                                            color:
                                              '#94a3b8',

                                            fontSize:
                                              '8px',
                                          }}
                                        >
                                          {item.type}
                                        </div>

                                      </div>

                                    )
                                  )}


                                {affected.length >
                                  3 && (

                                  <div
                                    style={{
                                      color:
                                        '#64748b',

                                      fontSize:
                                        '8px',

                                      fontWeight:
                                        700,
                                    }}
                                  >
                                    +{
                                      affected.length -
                                      3
                                    } more affected work items
                                  </div>

                                )}

                              </div>

                            ) : (

                              <span
                                style={
                                  mutedStyle
                                }
                              >
                                Project-level constraint
                              </span>

                            )}

                          </td>


                          {/* CATEGORY */}

                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            {formatLabel(
                              constraint.category
                            )}
                          </td>


                          {/* STATUS */}

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
                                style={{
                                  marginTop:
                                    '4px',

                                  color:
                                    '#7c3aed',

                                  fontSize:
                                    '8px',

                                  fontWeight:
                                    700,
                                }}
                              >
                                Awaiting Clearance
                              </div>

                            )}

                          </td>


                          {/* PRIORITY */}

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


                          {/* RESPONSIBLE */}

                          <td
                            style={{
                              ...bodyCellStyle,

                              padding:
                                '7px 9px',

                              textAlign:
                                'left',

                              fontWeight:
                                600,
                            }}
                          >
                            {constraint
                              .responsible_party ||
                              '—'}
                          </td>


                          {/* ACTION */}

                          <td
                            style={{
                              ...bodyCellStyle,

                              padding:
                                '7px 9px',

                              textAlign:
                                'left',
                            }}
                          >

                            <div
                              style={{
                                color:
                                  '#334155',

                                fontWeight:
                                  600,

                                lineHeight:
                                  1.4,
                              }}
                            >
                              {constraint
                                .action_required ||
                                constraint.title ||
                                constraint.description ||
                                '—'}
                            </div>

                          </td>


                          {/* DUE DATE */}

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
                                style={{
                                  marginTop:
                                    '3px',

                                  color:
                                    '#b91c1c',

                                  fontSize:
                                    '8px',

                                  fontWeight:
                                    900,
                                }}
                              >
                                OVERDUE
                              </div>

                            )}

                          </td>


                          {/* SOURCE */}

                          <td
                            style={
                              bodyCellStyle
                            }
                          >

                            <span
                              style={
                                sourceBadgeStyle
                              }
                            >
                              {getSourceLabel(
                                constraint
                              )}
                            </span>

                          </td>

                        </tr>

                      );

                    }
                  )}

                </tbody>

              </table>

            )}

          </div>


          {/* ==================================================
              GOVERNANCE LEGEND
          ================================================== */}

          <div
            style={{
              display:
                'flex',

              alignItems:
                'center',

              gap:
                '14px',

              flexWrap:
                'wrap',

              padding:
                '10px 12px',

              border:
                '1px solid #e2e8f0',

              borderTop:
                0,

              background:
                '#ffffff',

              color:
                '#64748b',

              fontSize:
                '9px',
            }}
          >

            <strong
              style={{
                color:
                  '#334155',
              }}
            >
              READINESS GOVERNANCE:
            </strong>


            <span>
              Open = Blocking
            </span>


            <span>
              In Progress = Blocking
            </span>


            <span>
              Waiting = Blocking
            </span>


            <span>
              Resolved = Still Blocking
            </span>


            <span>
              Cleared = Released
            </span>


            <span>
              Cancelled = Released
            </span>

          </div>

        </>

      )}

    </div>
  );
}


// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  label,
  value,
  description,
}) {

  return (
    <div
      style={{
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
      }}
    >

      <div
        style={{
          color:
            '#64748b',

          fontSize:
            '9px',

          fontWeight:
            800,

          letterSpacing:
            '0.04em',

          textTransform:
            'uppercase',
        }}
      >
        {label}
      </div>


      <div
        style={{
          marginTop:
            '5px',

          color:
            '#0f172a',

          fontSize:
            '25px',

          fontWeight:
            900,

          lineHeight:
            1,
        }}
      >
        {value}
      </div>


      <div
        style={{
          marginTop:
            '7px',

          color:
            '#94a3b8',

          fontSize:
            '9px',

          lineHeight:
            1.35,
        }}
      >
        {description}
      </div>

    </div>
  );
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

  outline:
    'none',
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

  outline:
    'none',
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


const disabledButtonStyle = {
  ...secondaryButtonStyle,

  opacity:
    0.45,

  cursor:
    'not-allowed',
};


const clearFiltersButtonStyle = {
  padding:
    '4px 7px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '4px',

  background:
    '#ffffff',

  color:
    '#475569',

  fontSize:
    '9px',

  fontWeight:
    700,

  cursor:
    'pointer',
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

  verticalAlign:
    'middle',

  fontSize:
    '8px',

  fontWeight:
    900,

  letterSpacing:
    '0.02em',
};


const bodyCellStyle = {
  padding:
    '6px',

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

  maxWidth:
    '100%',

  padding:
    '4px 7px',

  borderRadius:
    '999px',

  fontSize:
    '8px',

  fontWeight:
    900,

  whiteSpace:
    'nowrap',
};


const packageBadgeStyle = {
  display:
    'inline-flex',

  alignItems:
    'center',

  justifyContent:
    'center',

  minWidth:
    '38px',

  padding:
    '3px 5px',

  border:
    '1px solid #bfdbfe',

  borderRadius:
    '4px',

  background:
    '#eff6ff',

  color:
    '#1d4ed8',

  fontSize:
    '8px',

  fontWeight:
    900,
};


const sourceBadgeStyle = {
  display:
    'inline-flex',

  alignItems:
    'center',

  justifyContent:
    'center',

  padding:
    '4px 6px',

  border:
    '1px solid #e2e8f0',

  borderRadius:
    '4px',

  background:
    '#f8fafc',

  color:
    '#475569',

  fontSize:
    '8px',

  fontWeight:
    700,
};


const mutedStyle = {
  color:
    '#94a3b8',

  fontSize:
    '8px',

  fontWeight:
    600,
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

  fontSize:
    '12px',
};
