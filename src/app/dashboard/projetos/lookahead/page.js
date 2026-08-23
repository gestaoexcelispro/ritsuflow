'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import { supabase } from '../../../../lib/supabase';


// ============================================================
// RitsuFlow™
// Lookahead Planning
//
// Step 14D.2
//
// PURPOSE
// ------------------------------------------------------------
// First frontend connection to the normalized Lookahead backend.
//
// This version intentionally focuses on READ ONLY integration:
//
// projects
//      ↓
// lookahead_plans
//      ↓
// lookahead_work_items
//      ↓
// master_plan_packages
//
// Editing, readiness assessment and Constraint Log interaction
// will be added only after this data connection is validated.
// ============================================================


const READINESS_CONFIG = {
  not_assessed: {
    label: 'Not Assessed',
    background: '#f1f5f9',
    color: '#475569',
    border: '#cbd5e1'
  },

  constrained: {
    label: 'Constrained',
    background: '#fff7ed',
    color: '#c2410c',
    border: '#fdba74'
  },

  ready: {
    label: 'Ready',
    background: '#ecfdf5',
    color: '#047857',
    border: '#6ee7b7'
  },

  committed: {
    label: 'Committed',
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '#93c5fd'
  }
};


function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(date);
}


function getErrorMessage(error) {
  if (!error) {
    return 'An unexpected error occurred.';
  }

  if (error.code === '42501') {
    return 'Your account does not have permission to access this Lookahead information.';
  }

  return (
    error.message ||
    'The requested Lookahead information could not be loaded.'
  );
}


function StatusBadge({ status }) {
  const config =
    READINESS_CONFIG[status] ||
    READINESS_CONFIG.not_assessed;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '26px',
        padding: '3px 10px',
        borderRadius: '999px',
        border: `1px solid ${config.border}`,
        background: config.background,
        color: config.color,
        fontSize: '12px',
        fontWeight: 700,
        whiteSpace: 'nowrap'
      }}
    >
      {config.label}
    </span>
  );
}


function MetricCard({
  label,
  value,
  helper
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '18px 20px',
        minWidth: 0
      }}
    >
      <div
        style={{
          marginBottom: '8px',
          color: '#64748b',
          fontSize: '12px',
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase'
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: '#0f172a',
          fontSize: '28px',
          fontWeight: 800,
          lineHeight: 1
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: '8px',
          color: '#94a3b8',
          fontSize: '12px'
        }}
      >
        {helper}
      </div>
    </div>
  );
}


export default function LookaheadPlanningPage() {

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] =
    useState('');

  const [lookaheadPlan, setLookaheadPlan] =
    useState(null);

  const [workItems, setWorkItems] =
    useState([]);

  const [isLoadingProjects, setIsLoadingProjects] =
    useState(true);

  const [isLoadingLookahead, setIsLoadingLookahead] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');


  // ==========================================================
  // SELECTED PROJECT
  // ==========================================================

  const selectedProject = useMemo(() => {
    return (
      projects.find(
        (project) =>
          project.id === selectedProjectId
      ) || null
    );
  }, [
    projects,
    selectedProjectId
  ]);


  // ==========================================================
  // METRICS
  // ==========================================================

  const metrics = useMemo(() => {

    const total = workItems.length;

    const notAssessed = workItems.filter(
      (item) =>
        item.readiness_status ===
        'not_assessed'
    ).length;

    const constrained = workItems.filter(
      (item) =>
        item.readiness_status ===
        'constrained'
    ).length;

    const ready = workItems.filter(
      (item) =>
        item.readiness_status ===
        'ready'
    ).length;

    const committed = workItems.filter(
      (item) =>
        item.readiness_status ===
          'committed' ||
        item.committed_to_weekly === true
    ).length;

    return {
      total,
      notAssessed,
      constrained,
      ready,
      committed
    };

  }, [workItems]);


  // ==========================================================
  // LOAD PROJECTS
  // ==========================================================

  const loadProjects = useCallback(async () => {

    setIsLoadingProjects(true);
    setErrorMessage('');

    try {

      const {
        data,
        error
      } = await supabase
        .from('projects')
        .select(`
          id,
          code,
          name,
          client_name,
          status,
          created_at
        `)
        .neq('status', 'archived')
        .order(
          'created_at',
          { ascending: false }
        );

      if (error) {
        throw error;
      }

      const availableProjects =
        data || [];

      setProjects(
        availableProjects
      );


      // ------------------------------------------------------
      // Preserve project-first navigation when projectId is
      // supplied in the URL.
      // ------------------------------------------------------

      const queryParameters =
        new URLSearchParams(
          window.location.search
        );

      const projectIdFromUrl =
        queryParameters.get(
          'projectId'
        );

      if (
        projectIdFromUrl &&
        availableProjects.some(
          (project) =>
            project.id ===
            projectIdFromUrl
        )
      ) {

        setSelectedProjectId(
          projectIdFromUrl
        );

      }

    } catch (error) {

      console.error(
        'Lookahead projects load error:',
        error
      );

      setErrorMessage(
        getErrorMessage(error)
      );

    } finally {

      setIsLoadingProjects(false);

    }

  }, []);


  // ==========================================================
  // LOAD ACTIVE LOOKAHEAD
  // ==========================================================

  const loadLookahead = useCallback(
    async (projectId) => {

      if (!projectId) {

        setLookaheadPlan(null);
        setWorkItems([]);

        return;
      }


      setIsLoadingLookahead(true);
      setErrorMessage('');
      setLookaheadPlan(null);
      setWorkItems([]);


      try {

        // ----------------------------------------------------
        // 1. Find the active Lookahead plan.
        // ----------------------------------------------------

        const {
          data: plans,
          error: planError
        } = await supabase
          .from('lookahead_plans')
          .select(`
            id,
            project_id,
            master_plan_scenario_id,
            name,
            window_start_date,
            horizon_weeks,
            window_finish_date,
            status,
            notes,
            created_at,
            updated_at
          `)
          .eq(
            'project_id',
            projectId
          )
          .eq(
            'status',
            'active'
          )
          .order(
            'created_at',
            { ascending: false }
          )
          .limit(1);


        if (planError) {
          throw planError;
        }


        const activePlan =
          plans?.[0] || null;


        if (!activePlan) {

          setLookaheadPlan(null);
          setWorkItems([]);

          return;
        }


        setLookaheadPlan(
          activePlan
        );


        // ----------------------------------------------------
        // 2. Load the materialized work items.
        //
        // We intentionally query the normalized package
        // relationship rather than rebuilding schedule logic
        // in React.
        // ----------------------------------------------------

        const {
          data: items,
          error: itemsError
        } = await supabase
          .from('lookahead_work_items')
          .select(`
            id,
            lookahead_plan_id,
            project_id,
            master_plan_package_id,
            readiness_status,
            lookahead_start_date,
            lookahead_finish_date,
            priority,
            notes,
            committed_to_weekly,
            created_at,
            updated_at,

            master_plan_packages (
              id,
              package_code,
              service_name,
              service_code,
              location_name,
              location_path,
              duration_working_days,
              scheduled_start_date,
              scheduled_finish_date,
              sequence_number,
              sequence_group_id
            )
          `)
          .eq(
            'lookahead_plan_id',
            activePlan.id
          );


        if (itemsError) {
          throw itemsError;
        }


        const normalizedItems =
          (items || [])
            .map((item) => {

              const packageData =
                Array.isArray(
                  item.master_plan_packages
                )
                  ? item
                      .master_plan_packages[0]
                  : item.master_plan_packages;

              return {
                ...item,
                package:
                  packageData || null
              };

            })
            .sort((a, b) => {

              const startA =
                a.package
                  ?.scheduled_start_date ||
                '';

              const startB =
                b.package
                  ?.scheduled_start_date ||
                '';

              if (
                startA !== startB
              ) {
                return startA.localeCompare(
                  startB
                );
              }


              const sequenceA =
                Number(
                  a.package
                    ?.sequence_number ??
                  999999
                );

              const sequenceB =
                Number(
                  b.package
                    ?.sequence_number ??
                  999999
                );

              if (
                sequenceA !== sequenceB
              ) {
                return (
                  sequenceA -
                  sequenceB
                );
              }


              return String(
                a.package
                  ?.location_path ||
                ''
              ).localeCompare(
                String(
                  b.package
                    ?.location_path ||
                  ''
                )
              );

            });


        setWorkItems(
          normalizedItems
        );

      } catch (error) {

        console.error(
          'Lookahead workspace load error:',
          error
        );

        setErrorMessage(
          getErrorMessage(error)
        );

        setLookaheadPlan(null);
        setWorkItems([]);

      } finally {

        setIsLoadingLookahead(false);

      }

    },
    []
  );


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);


  // ==========================================================
  // PROJECT CHANGE
  // ==========================================================

  useEffect(() => {

    loadLookahead(
      selectedProjectId
    );

  }, [
    selectedProjectId,
    loadLookahead
  ]);


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      style={{
        minHeight: '100%',
        padding: '24px',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}
    >

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent:
            'space-between',
          gap: '20px',
          marginBottom: '24px'
        }}
      >

        <div>

          <div
            style={{
              marginBottom: '7px',
              color: '#0f766e',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}
          >
            Planning & Production Control
          </div>

          <h1
            style={{
              margin: 0,
              color: '#0f172a',
              fontSize: '30px',
              lineHeight: 1.15,
              fontWeight: 800
            }}
          >
            Lookahead Planning
          </h1>

          <p
            style={{
              maxWidth: '760px',
              margin:
                '10px 0 0',
              color: '#64748b',
              fontSize: '14px',
              lineHeight: 1.6
            }}
          >
            Review upcoming Master Plan
            work packages and determine
            whether they are ready for
            execution.
          </p>

        </div>

      </div>


      {/* =====================================================
          PROJECT SELECTOR
      ====================================================== */}

      <div
        style={{
          marginBottom: '20px',
          padding: '18px',
          background: '#ffffff',
          border:
            '1px solid #e2e8f0',
          borderRadius: '14px'
        }}
      >

        <label
          htmlFor="lookahead-project"
          style={{
            display: 'block',
            marginBottom: '8px',
            color: '#334155',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          Project
        </label>

        <select
          id="lookahead-project"
          value={
            selectedProjectId
          }
          disabled={
            isLoadingProjects
          }
          onChange={(event) => {
            setSelectedProjectId(
              event.target.value
            );
          }}
          style={{
            width: '100%',
            maxWidth: '520px',
            minHeight: '42px',
            padding: '0 12px',
            border:
              '1px solid #cbd5e1',
            borderRadius: '9px',
            background: '#ffffff',
            color: '#0f172a',
            fontSize: '14px',
            outline: 'none'
          }}
        >

          <option value="">
            {isLoadingProjects
              ? 'Loading projects...'
              : 'Select a project'}
          </option>

          {projects.map(
            (project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.code
                  ? `${project.code} · `
                  : ''}
                {project.name}
              </option>
            )
          )}

        </select>

      </div>


      {/* =====================================================
          ERROR
      ====================================================== */}

      {errorMessage && (
        <div
          style={{
            marginBottom: '20px',
            padding:
              '14px 16px',
            border:
              '1px solid #fecaca',
            borderRadius: '10px',
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: '14px'
          }}
        >
          {errorMessage}
        </div>
      )}


      {/* =====================================================
          NO PROJECT
      ====================================================== */}

      {!selectedProjectId &&
        !isLoadingProjects && (
          <div
            style={{
              padding: '48px 24px',
              border:
                '1px dashed #cbd5e1',
              borderRadius: '14px',
              background: '#ffffff',
              textAlign: 'center'
            }}
          >

            <div
              style={{
                marginBottom: '8px',
                color: '#0f172a',
                fontSize: '18px',
                fontWeight: 800
              }}
            >
              Select a project
            </div>

            <div
              style={{
                color: '#64748b',
                fontSize: '14px'
              }}
            >
              Choose a project to open
              its active Lookahead
              planning window.
            </div>

          </div>
        )}


      {/* =====================================================
          LOADING LOOKAHEAD
      ====================================================== */}

      {selectedProjectId &&
        isLoadingLookahead && (
          <div
            style={{
              padding: '48px 24px',
              border:
                '1px solid #e2e8f0',
              borderRadius: '14px',
              background: '#ffffff',
              color: '#64748b',
              textAlign: 'center'
            }}
          >
            Loading Lookahead planning
            data...
          </div>
        )}


      {/* =====================================================
          NO ACTIVE LOOKAHEAD
      ====================================================== */}

      {selectedProjectId &&
        !isLoadingLookahead &&
        !lookaheadPlan &&
        !errorMessage && (
          <div
            style={{
              padding: '48px 24px',
              border:
                '1px dashed #cbd5e1',
              borderRadius: '14px',
              background: '#ffffff',
              textAlign: 'center'
            }}
          >

            <div
              style={{
                marginBottom: '8px',
                color: '#0f172a',
                fontSize: '18px',
                fontWeight: 800
              }}
            >
              No active Lookahead plan
            </div>

            <div
              style={{
                color: '#64748b',
                fontSize: '14px'
              }}
            >
              {selectedProject
                ? `${selectedProject.code || ''} ${selectedProject.name}`.trim()
                : 'This project'}{' '}
              does not currently have an
              active Lookahead planning
              window.
            </div>

          </div>
        )}


      {/* =====================================================
          ACTIVE LOOKAHEAD
      ====================================================== */}

      {lookaheadPlan &&
        !isLoadingLookahead && (
          <>

            {/* PLAN HEADER */}

            <div
              style={{
                marginBottom: '18px',
                padding: '20px',
                border:
                  '1px solid #dbe4ee',
                borderRadius: '14px',
                background: '#ffffff'
              }}
            >

              <div
                style={{
                  display: 'flex',
                  alignItems:
                    'flex-start',
                  justifyContent:
                    'space-between',
                  gap: '20px',
                  flexWrap: 'wrap'
                }}
              >

                <div>

                  <div
                    style={{
                      marginBottom: '6px',
                      color: '#64748b',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '0.05em'
                    }}
                  >
                    Active Lookahead
                  </div>

                  <div
                    style={{
                      color: '#0f172a',
                      fontSize: '20px',
                      fontWeight: 800
                    }}
                  >
                    {lookaheadPlan.name}
                  </div>

                  <div
                    style={{
                      marginTop: '6px',
                      color: '#64748b',
                      fontSize: '13px'
                    }}
                  >
                    {selectedProject?.code}
                    {selectedProject?.code &&
                    selectedProject?.name
                      ? ' · '
                      : ''}
                    {selectedProject?.name}
                  </div>

                </div>


                <div
                  style={{
                    display: 'flex',
                    gap: '18px',
                    flexWrap: 'wrap'
                  }}
                >

                  <div>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform:
                          'uppercase'
                      }}
                    >
                      Window
                    </div>

                    <div
                      style={{
                        marginTop: '3px',
                        color: '#334155',
                        fontSize: '13px',
                        fontWeight: 700
                      }}
                    >
                      {formatDate(
                        lookaheadPlan.window_start_date
                      )}
                      {' – '}
                      {formatDate(
                        lookaheadPlan.window_finish_date
                      )}
                    </div>
                  </div>


                  <div>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform:
                          'uppercase'
                      }}
                    >
                      Horizon
                    </div>

                    <div
                      style={{
                        marginTop: '3px',
                        color: '#334155',
                        fontSize: '13px',
                        fontWeight: 700
                      }}
                    >
                      {lookaheadPlan.horizon_weeks}{' '}
                      weeks
                    </div>
                  </div>


                  <div>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform:
                          'uppercase'
                      }}
                    >
                      Status
                    </div>

                    <div
                      style={{
                        marginTop: '3px',
                        color: '#047857',
                        fontSize: '13px',
                        fontWeight: 800,
                        textTransform:
                          'capitalize'
                      }}
                    >
                      {lookaheadPlan.status}
                    </div>
                  </div>

                </div>

              </div>

            </div>


            {/* METRICS */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(5, minmax(0, 1fr))',
                gap: '12px',
                marginBottom: '18px'
              }}
            >

              <MetricCard
                label="Work Packages"
                value={metrics.total}
                helper="Inside this Lookahead plan"
              />

              <MetricCard
                label="Not Assessed"
                value={metrics.notAssessed}
                helper="Readiness review pending"
              />

              <MetricCard
                label="Constrained"
                value={metrics.constrained}
                helper="Blocked from ready work"
              />

              <MetricCard
                label="Ready"
                value={metrics.ready}
                helper="Available for commitment"
              />

              <MetricCard
                label="Committed"
                value={metrics.committed}
                helper="Sent toward Weekly Planning"
              />

            </div>


            {/* WORK PACKAGE TABLE */}

            <div
              style={{
                overflow: 'hidden',
                border:
                  '1px solid #dbe4ee',
                borderRadius: '14px',
                background: '#ffffff'
              }}
            >

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    'space-between',
                  gap: '16px',
                  padding:
                    '18px 20px',
                  borderBottom:
                    '1px solid #e2e8f0'
                }}
              >

                <div>

                  <div
                    style={{
                      color: '#0f172a',
                      fontSize: '16px',
                      fontWeight: 800
                    }}
                  >
                    Upcoming Work Packages
                  </div>

                  <div
                    style={{
                      marginTop: '4px',
                      color: '#64748b',
                      fontSize: '12px'
                    }}
                  >
                    Read-only connection to
                    the normalized Master Plan
                    baseline.
                  </div>

                </div>

                <div
                  style={{
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                >
                  {workItems.length}{' '}
                  packages
                </div>

              </div>


              <div
                style={{
                  overflowX: 'auto'
                }}
              >

                <table
                  style={{
                    width: '100%',
                    minWidth: '1050px',
                    borderCollapse:
                      'collapse'
                  }}
                >

                  <thead>
                    <tr
                      style={{
                        background:
                          '#f8fafc'
                      }}
                    >

                      {[
                        'Package',
                        'Service',
                        'Location',
                        'Baseline Start',
                        'Baseline Finish',
                        'Duration',
                        'Sequence',
                        'Readiness',
                        'Weekly'
                      ].map(
                        (heading) => (
                          <th
                            key={heading}
                            style={{
                              padding:
                                '11px 14px',
                              borderBottom:
                                '1px solid #e2e8f0',
                              color:
                                '#64748b',
                              fontSize:
                                '11px',
                              fontWeight:
                                800,
                              letterSpacing:
                                '0.04em',
                              textAlign:
                                'left',
                              textTransform:
                                'uppercase',
                              whiteSpace:
                                'nowrap'
                            }}
                          >
                            {heading}
                          </th>
                        )
                      )}

                    </tr>
                  </thead>


                  <tbody>

                    {workItems.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={9}
                          style={{
                            padding:
                              '38px 20px',
                            color:
                              '#64748b',
                            fontSize:
                              '14px',
                            textAlign:
                              'center'
                          }}
                        >
                          This Lookahead plan
                          does not contain any
                          materialized work
                          packages.
                        </td>
                      </tr>
                    )}


                    {workItems.map(
                      (item) => {

                        const pkg =
                          item.package;

                        return (
                          <tr
                            key={item.id}
                          >

                            <td
                              style={{
                                padding:
                                  '13px 14px',
                                borderBottom:
                                  '1px solid #f1f5f9',
                                color:
                                  '#0f172a',
                                fontSize:
                                  '13px',
                                fontWeight:
                                  800,
                                whiteSpace:
                                  'nowrap'
                              }}
                            >
                              {pkg?.package_code ||
                                '—'}
                            </td>


                            <td
                              style={{
                                padding:
                                  '13px 14px',
                                borderBottom:
                                  '1px solid #f1f5f9',
                                color:
                                  '#334155',
                                fontSize:
                                  '13px'
                              }}
                            >
                              {pkg?.service_name ||
                                '—'}
                            </td>


                            <td
                              style={{
                                padding:
                                  '13px 14px',
                                borderBottom:
                                  '1px solid #f1f5f9',
                                color:
                                  '#334155',
                                fontSize:
                                  '13px'
                              }}
                            >
                              <div
                                style={{
                                  fontWeight:
                                    700
                                }}
                              >
                                {pkg?.location_name ||
                                  '—'}
                              </div>

                              {pkg?.location_path &&
                                pkg.location_path !==
                                  pkg.location_name && (
                                  <div
                                    style={{
                                      marginTop:
                                        '3px',
                                      color:
                                        '#94a3b8',
                                      fontSize:
                                        '11px'
                                    }}
                                  >
                                    {
                                      pkg.location_path
                                    }
                                  </div>
                                )}
                            </td>


                            <td
                              style={{
                                padding:
                                  '13px 14px',
                                borderBottom:
                                  '1px solid #f1f5f9',
                                color:
                                  '#475569',
                                fontSize:
                                  '13px',
                                whiteSpace:
                                  'nowrap'
                              }}
                            >
                              {formatDate(
                                pkg?.scheduled_start_date
                              )}
                            </td>


                            <td
                              style={{
                                padding:
                                  '13px 14px',
                                borderBottom:
                                  '1px solid #f1f5f9',
                                color:
                                  '#475569',
                                fontSize:
                                  '13px',
                                whiteSpace:
                                  'nowrap'
                              }}
                            >
                              {formatDate(
                                pkg?.scheduled_finish_date
                              )}
                            </td>


                            <td
                              style={{
                                padding:
                                  '13px 14px',
                                borderBottom:
                                  '1px solid #f1f5f9',
                                color:
                                  '#475569',
                                fontSize:
                                  '13px',
                                whiteSpace:
                                  'nowrap'
                              }}
                            >
                              {pkg?.duration_working_days ??
                                '—'}
                              {pkg?.duration_working_days
                                ? ' days'
                                : ''}
                            </td>


                            <td
                              style={{
                                padding:
                                  '13px 14px',
                                borderBottom:
                                  '1px solid #f1f5f9',
                                color:
                                  '#475569',
                                fontSize:
                                  '13px',
                                textAlign:
                                  'center'
                              }}
                            >
                              {pkg?.sequence_number ??
                                '—'}
                            </td>


                            <td
                              style={{
                                padding:
                                  '13px 14px',
                                borderBottom:
                                  '1px solid #f1f5f9'
                              }}
                            >
                              <StatusBadge
                                status={
                                  item.readiness_status
                                }
                              />
                            </td>


                            <td
                              style={{
                                padding:
                                  '13px 14px',
                                borderBottom:
                                  '1px solid #f1f5f9',
                                color:
                                  item.committed_to_weekly
                                    ? '#047857'
                                    : '#94a3b8',
                                fontSize:
                                  '12px',
                                fontWeight:
                                  700,
                                whiteSpace:
                                  'nowrap'
                              }}
                            >
                              {item.committed_to_weekly
                                ? 'Committed'
                                : 'Not committed'}
                            </td>

                          </tr>
                        );

                      }
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </>
        )}

    </div>
  );
}
