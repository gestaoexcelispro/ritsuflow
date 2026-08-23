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
// Step 14D.3A
//
// LOCATION × TIME LOOKAHEAD BOARD
//
// IMPORTANT ARCHITECTURAL RULE
// ------------------------------------------------------------
// React DOES NOT calculate the production schedule.
//
// Package dates come from the persisted frozen Master Plan
// baseline.
//
// This page only:
//   1. Reads the active Lookahead plan.
//   2. Reads its materialized work items.
//   3. Reads their normalized Master Plan packages.
//   4. Visualizes those packages across location and time.
// ============================================================


const DAY_WIDTH = 48;
const LOCATION_WIDTH = 230;
const ROW_HEIGHT = 58;


// ============================================================
// READINESS VISUAL CONFIGURATION
// ============================================================

const READINESS_CONFIG = {
  not_assessed: {
    label: 'Not Assessed',
    background: '#e2e8f0',
    color: '#334155',
    border: '#cbd5e1'
  },

  constrained: {
    label: 'Constrained',
    background: '#fed7aa',
    color: '#9a3412',
    border: '#fb923c'
  },

  ready: {
    label: 'Ready',
    background: '#bbf7d0',
    color: '#166534',
    border: '#4ade80'
  }
};


// ============================================================
// DATE HELPERS
// ============================================================

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}


function toDateKey(date) {
  if (!date) {
    return '';
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}


function addDays(date, amount) {
  const next = new Date(date);

  next.setDate(
    next.getDate() + amount
  );

  return next;
}


function differenceInCalendarDays(
  start,
  finish
) {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );

  const finishUtc = Date.UTC(
    finish.getFullYear(),
    finish.getMonth(),
    finish.getDate()
  );

  return Math.round(
    (finishUtc - startUtc) /
      86400000
  );
}


function formatDate(value) {
  const date =
    typeof value === 'string'
      ? parseDate(value)
      : value;

  if (!date) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }
  ).format(date);
}


function formatMonthDay(date) {
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric'
    }
  ).format(date);
}


function getDayName(date) {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'short'
    }
  ).format(date);
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


// ============================================================
// METRIC CARD
// ============================================================

function MetricCard({
  label,
  value,
  helper
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '17px 18px',
        background: '#ffffff',
        border: '1px solid #dbe4ee',
        borderRadius: '12px'
      }}
    >
      <div
        style={{
          marginBottom: '7px',
          color: '#64748b',
          fontSize: '11px',
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
          fontSize: '25px',
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
          fontSize: '11px'
        }}
      >
        {helper}
      </div>
    </div>
  );
}


// ============================================================
// READINESS LEGEND
// ============================================================

function ReadinessLegend() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap'
      }}
    >
      {Object.entries(
        READINESS_CONFIG
      ).map(
        ([status, config]) => (
          <div
            key={status}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#64748b',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '3px',
                background:
                  config.background,
                border:
                  `1px solid ${config.border}`
              }}
            />

            {config.label}
          </div>
        )
      )}
    </div>
  );
}


// ============================================================
// MAIN PAGE
// ============================================================

export default function LookaheadPlanningPage() {

  const [
    projects,
    setProjects
  ] = useState([]);

  const [
    selectedProjectId,
    setSelectedProjectId
  ] = useState('');

  const [
    lookaheadPlan,
    setLookaheadPlan
  ] = useState(null);

  const [
    workItems,
    setWorkItems
  ] = useState([]);

  const [
    isLoadingProjects,
    setIsLoadingProjects
  ] = useState(true);

  const [
    isLoadingLookahead,
    setIsLoadingLookahead
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage
  ] = useState('');


  // ==========================================================
  // SELECTED PROJECT
  // ==========================================================

  const selectedProject =
    useMemo(() => {

      return (
        projects.find(
          (project) =>
            project.id ===
            selectedProjectId
        ) || null
      );

    }, [
      projects,
      selectedProjectId
    ]);


  // ==========================================================
  // METRICS
  // ==========================================================

  const metrics =
    useMemo(() => {

      const total =
        workItems.length;

      const notAssessed =
        workItems.filter(
          (item) =>
            item.readiness_status ===
            'not_assessed'
        ).length;

      const constrained =
        workItems.filter(
          (item) =>
            item.readiness_status ===
            'constrained'
        ).length;

      const ready =
        workItems.filter(
          (item) =>
            item.readiness_status ===
            'ready'
        ).length;

      const committed =
        workItems.filter(
          (item) =>
            item.committed_to_weekly ===
            true
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
  // CALENDAR DAYS
  // ==========================================================

  const calendarDays =
    useMemo(() => {

      if (!lookaheadPlan) {
        return [];
      }

      const start =
        parseDate(
          lookaheadPlan
            .window_start_date
        );

      const finish =
        parseDate(
          lookaheadPlan
            .window_finish_date
        );

      if (!start || !finish) {
        return [];
      }

      const days = [];

      let cursor =
        new Date(start);

      while (cursor <= finish) {

        days.push(
          new Date(cursor)
        );

        cursor =
          addDays(cursor, 1);
      }

      return days;

    }, [lookaheadPlan]);


  // ==========================================================
  // WEEK GROUPS
  // ==========================================================

  const weekGroups =
    useMemo(() => {

      if (
        calendarDays.length === 0
      ) {
        return [];
      }

      const groups = [];

      for (
        let index = 0;
        index < calendarDays.length;
        index += 7
      ) {

        const days =
          calendarDays.slice(
            index,
            index + 7
          );

        groups.push({
          weekNumber:
            groups.length + 1,

          start:
            days[0],

          finish:
            days[
              days.length - 1
            ],

          dayCount:
            days.length
        });
      }

      return groups;

    }, [calendarDays]);


  // ==========================================================
  // LOCATION GROUPS
  // ==========================================================

  const locationGroups =
    useMemo(() => {

      const map =
        new Map();

      workItems.forEach(
        (item) => {

          const pkg =
            item.package;

          if (!pkg) {
            return;
          }

          const key =
            pkg.location_path ||
            pkg.location_name ||
            'Unassigned Location';

          if (!map.has(key)) {

            map.set(key, {
              key,
              name:
                pkg.location_name ||
                'Unassigned Location',
              path:
                pkg.location_path ||
                pkg.location_name ||
                '',
              items: []
            });
          }

          map
            .get(key)
            .items.push(item);

        }
      );


      return Array.from(
        map.values()
      ).sort(
        (a, b) => {

          const firstA =
            a.items[0]?.package;

          const firstB =
            b.items[0]?.package;

          const sequenceA =
            Number(
              firstA
                ?.sequence_number ??
              999999
            );

          const sequenceB =
            Number(
              firstB
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

          return a.path.localeCompare(
            b.path
          );

        }
      );

    }, [workItems]);


  // ==========================================================
  // LOAD PROJECTS
  // ==========================================================

  const loadProjects =
    useCallback(async () => {

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
          .neq(
            'status',
            'archived'
          )
          .order(
            'created_at',
            {
              ascending: false
            }
          );

        if (error) {
          throw error;
        }

        const availableProjects =
          data || [];

        setProjects(
          availableProjects
        );


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

  const loadLookahead =
    useCallback(
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

          // --------------------------------------------------
          // 1. ACTIVE LOOKAHEAD PLAN
          // --------------------------------------------------

          const {
            data: plans,
            error: planError
          } = await supabase
            .from(
              'lookahead_plans'
            )
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
              {
                ascending: false
              }
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


          // --------------------------------------------------
          // 2. MATERIALIZED LOOKAHEAD WORK ITEMS
          // --------------------------------------------------

          const {
            data: items,
            error: itemsError
          } = await supabase
            .from(
              'lookahead_work_items'
            )
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
              .map(
                (item) => {

                  const packageData =
                    Array.isArray(
                      item
                        .master_plan_packages
                    )
                      ? item
                          .master_plan_packages[0]
                      : item
                          .master_plan_packages;

                  return {
                    ...item,
                    package:
                      packageData ||
                      null
                  };

                }
              )
              .sort(
                (a, b) => {

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

                  return (
                    sequenceA -
                    sequenceB
                  );

                }
              );


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
  // TIMELINE WIDTH
  // ==========================================================

  const timelineWidth =
    calendarDays.length *
    DAY_WIDTH;


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
          PAGE HEADER
      ====================================================== */}

      <div
        style={{
          marginBottom: '22px'
        }}
      >

        <div
          style={{
            marginBottom: '7px',
            color: '#0f766e',
            fontSize: '11px',
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
            fontSize: '29px',
            lineHeight: 1.15,
            fontWeight: 800
          }}
        >
          Lookahead Planning
        </h1>

        <p
          style={{
            maxWidth: '760px',
            margin: '9px 0 0',
            color: '#64748b',
            fontSize: '13px',
            lineHeight: 1.6
          }}
        >
          Review upcoming Master Plan
          work packages by location and
          determine whether they are
          ready for execution.
        </p>

      </div>


      {/* =====================================================
          PROJECT SELECTOR
      ====================================================== */}

      <div
        style={{
          marginBottom: '16px',
          padding: '16px',
          background: '#ffffff',
          border:
            '1px solid #dbe4ee',
          borderRadius: '12px'
        }}
      >

        <label
          htmlFor="lookahead-project"
          style={{
            display: 'block',
            marginBottom: '7px',
            color: '#334155',
            fontSize: '12px',
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
            minHeight: '40px',
            padding: '0 12px',
            border:
              '1px solid #cbd5e1',
            borderRadius: '8px',
            background: '#ffffff',
            color: '#0f172a',
            fontSize: '13px'
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
            marginBottom: '16px',
            padding: '13px 15px',
            border:
              '1px solid #fecaca',
            borderRadius: '9px',
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: '13px'
          }}
        >
          {errorMessage}
        </div>
      )}


      {/* =====================================================
          EMPTY PROJECT
      ====================================================== */}

      {!selectedProjectId &&
        !isLoadingProjects && (
          <div
            style={{
              padding: '45px 24px',
              border:
                '1px dashed #cbd5e1',
              borderRadius: '12px',
              background: '#ffffff',
              color: '#64748b',
              textAlign: 'center'
            }}
          >
            Select a project to open its
            Lookahead planning window.
          </div>
        )}


      {/* =====================================================
          LOADING
      ====================================================== */}

      {selectedProjectId &&
        isLoadingLookahead && (
          <div
            style={{
              padding: '45px 24px',
              border:
                '1px solid #dbe4ee',
              borderRadius: '12px',
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
          NO ACTIVE PLAN
      ====================================================== */}

      {selectedProjectId &&
        !isLoadingLookahead &&
        !lookaheadPlan &&
        !errorMessage && (
          <div
            style={{
              padding: '45px 24px',
              border:
                '1px dashed #cbd5e1',
              borderRadius: '12px',
              background: '#ffffff',
              textAlign: 'center'
            }}
          >

            <div
              style={{
                marginBottom: '7px',
                color: '#0f172a',
                fontSize: '17px',
                fontWeight: 800
              }}
            >
              No active Lookahead plan
            </div>

            <div
              style={{
                color: '#64748b',
                fontSize: '13px'
              }}
            >
              {selectedProject?.code ||
                selectedProject?.name ||
                'This project'}{' '}
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

            {/* =================================================
                ACTIVE PLAN HEADER
            ================================================== */}

            <div
              style={{
                marginBottom: '14px',
                padding: '17px',
                border:
                  '1px solid #dbe4ee',
                borderRadius: '12px',
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
                      marginBottom: '5px',
                      color: '#64748b',
                      fontSize: '10px',
                      fontWeight: 800,
                      letterSpacing:
                        '0.06em',
                      textTransform:
                        'uppercase'
                    }}
                  >
                    Active Lookahead
                  </div>

                  <div
                    style={{
                      color: '#0f172a',
                      fontSize: '19px',
                      fontWeight: 800
                    }}
                  >
                    {lookaheadPlan.name}
                  </div>

                  <div
                    style={{
                      marginTop: '5px',
                      color: '#64748b',
                      fontSize: '11px'
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
                    gap: '20px',
                    flexWrap: 'wrap'
                  }}
                >

                  <div>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '9px',
                        fontWeight: 800,
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
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    >
                      {formatDate(
                        lookaheadPlan
                          .window_start_date
                      )}
                      {' – '}
                      {formatDate(
                        lookaheadPlan
                          .window_finish_date
                      )}
                    </div>
                  </div>


                  <div>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '9px',
                        fontWeight: 800,
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
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    >
                      {
                        lookaheadPlan
                          .horizon_weeks
                      }{' '}
                      weeks
                    </div>
                  </div>


                  <div>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '9px',
                        fontWeight: 800,
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
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform:
                          'capitalize'
                      }}
                    >
                      {
                        lookaheadPlan
                          .status
                      }
                    </div>
                  </div>

                </div>

              </div>

            </div>


            {/* =================================================
                KPIs
            ================================================== */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(5, minmax(0, 1fr))',
                gap: '10px',
                marginBottom: '14px'
              }}
            >

              <MetricCard
                label="Work Packages"
                value={metrics.total}
                helper="Inside this Lookahead plan"
              />

              <MetricCard
                label="Not Assessed"
                value={
                  metrics.notAssessed
                }
                helper="Readiness review pending"
              />

              <MetricCard
                label="Constrained"
                value={
                  metrics.constrained
                }
                helper="Blocked from ready work"
              />

              <MetricCard
                label="Ready"
                value={metrics.ready}
                helper="Available for commitment"
              />

              <MetricCard
                label="Committed"
                value={
                  metrics.committed
                }
                helper="Sent toward Weekly Planning"
              />

            </div>


            {/* =================================================
                LOCATION × TIME BOARD
            ================================================== */}

            <div
              style={{
                overflow: 'hidden',
                border:
                  '1px solid #dbe4ee',
                borderRadius: '12px',
                background: '#ffffff'
              }}
            >

              {/* BOARD TITLE */}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    'space-between',
                  gap: '16px',
                  padding: '15px 17px',
                  borderBottom:
                    '1px solid #e2e8f0',
                  flexWrap: 'wrap'
                }}
              >

                <div>

                  <div
                    style={{
                      color: '#0f172a',
                      fontSize: '15px',
                      fontWeight: 800
                    }}
                  >
                    Location × Time
                  </div>

                  <div
                    style={{
                      marginTop: '3px',
                      color: '#64748b',
                      fontSize: '11px'
                    }}
                  >
                    Frozen Master Plan
                    packages inside the
                    active Lookahead window.
                  </div>

                </div>

                <ReadinessLegend />

              </div>


              {/* HORIZONTAL SCROLL */}

              <div
                style={{
                  overflowX: 'auto',
                  overflowY: 'hidden'
                }}
              >

                <div
                  style={{
                    minWidth:
                      LOCATION_WIDTH +
                      timelineWidth
                  }}
                >

                  {/* ===========================================
                      WEEK HEADER
                  ============================================ */}

                  <div
                    style={{
                      display: 'flex',
                      height: '34px',
                      borderBottom:
                        '1px solid #e2e8f0',
                      background:
                        '#f8fafc'
                    }}
                  >

                    <div
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 6,
                        width:
                          LOCATION_WIDTH,
                        minWidth:
                          LOCATION_WIDTH,
                        display: 'flex',
                        alignItems:
                          'center',
                        padding:
                          '0 14px',
                        borderRight:
                          '1px solid #dbe4ee',
                        background:
                          '#f8fafc',
                        color: '#64748b',
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing:
                          '0.05em',
                        textTransform:
                          'uppercase'
                      }}
                    >
                      Location
                    </div>


                    <div
                      style={{
                        display: 'flex',
                        width:
                          timelineWidth
                      }}
                    >

                      {weekGroups.map(
                        (week) => (
                          <div
                            key={
                              week.weekNumber
                            }
                            style={{
                              width:
                                week.dayCount *
                                DAY_WIDTH,
                              minWidth:
                                week.dayCount *
                                DAY_WIDTH,
                              display:
                                'flex',
                              alignItems:
                                'center',
                              justifyContent:
                                'center',
                              borderRight:
                                '1px solid #cbd5e1',
                              color:
                                '#475569',
                              fontSize:
                                '10px',
                              fontWeight:
                                800
                            }}
                          >
                            Week{' '}
                            {
                              week.weekNumber
                            }
                            {' · '}
                            {formatMonthDay(
                              week.start
                            )}
                            {' – '}
                            {formatMonthDay(
                              week.finish
                            )}
                          </div>
                        )
                      )}

                    </div>

                  </div>


                  {/* ===========================================
                      DAY HEADER
                  ============================================ */}

                  <div
                    style={{
                      display: 'flex',
                      height: '48px',
                      borderBottom:
                        '1px solid #dbe4ee',
                      background:
                        '#ffffff'
                    }}
                  >

                    <div
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 6,
                        width:
                          LOCATION_WIDTH,
                        minWidth:
                          LOCATION_WIDTH,
                        borderRight:
                          '1px solid #dbe4ee',
                        background:
                          '#ffffff'
                      }}
                    />


                    <div
                      style={{
                        display: 'flex',
                        width:
                          timelineWidth
                      }}
                    >

                      {calendarDays.map(
                        (day) => {

                          const dayName =
                            getDayName(
                              day
                            );

                          const isWeekend =
                            dayName ===
                              'Sat' ||
                            dayName ===
                              'Sun';

                          return (
                            <div
                              key={
                                toDateKey(
                                  day
                                )
                              }
                              style={{
                                width:
                                  DAY_WIDTH,
                                minWidth:
                                  DAY_WIDTH,
                                display:
                                  'flex',
                                flexDirection:
                                  'column',
                                alignItems:
                                  'center',
                                justifyContent:
                                  'center',
                                borderRight:
                                  '1px solid #eef2f7',
                                background:
                                  isWeekend
                                    ? '#f8fafc'
                                    : '#ffffff'
                              }}
                            >

                              <div
                                style={{
                                  color:
                                    '#94a3b8',
                                  fontSize:
                                    '9px',
                                  fontWeight:
                                    700,
                                  textTransform:
                                    'uppercase'
                                }}
                              >
                                {dayName}
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    '2px',
                                  color:
                                    '#334155',
                                  fontSize:
                                    '11px',
                                  fontWeight:
                                    800
                                }}
                              >
                                {day.getDate()}
                              </div>

                            </div>
                          );

                        }
                      )}

                    </div>

                  </div>


                  {/* ===========================================
                      LOCATION ROWS
                  ============================================ */}

                  {locationGroups.length ===
                    0 && (
                    <div
                      style={{
                        padding:
                          '35px 20px',
                        color:
                          '#64748b',
                        fontSize:
                          '13px',
                        textAlign:
                          'center'
                      }}
                    >
                      No work packages were
                      found in this Lookahead
                      plan.
                    </div>
                  )}


                  {locationGroups.map(
                    (location) => {

                      const windowStart =
                        parseDate(
                          lookaheadPlan
                            .window_start_date
                        );

                      return (
                        <div
                          key={
                            location.key
                          }
                          style={{
                            display:
                              'flex',
                            minHeight:
                              ROW_HEIGHT,
                            borderBottom:
                              '1px solid #e2e8f0'
                          }}
                        >

                          {/* LOCATION CELL */}

                          <div
                            style={{
                              position:
                                'sticky',
                              left: 0,
                              zIndex: 5,
                              width:
                                LOCATION_WIDTH,
                              minWidth:
                                LOCATION_WIDTH,
                              display:
                                'flex',
                              flexDirection:
                                'column',
                              justifyContent:
                                'center',
                              padding:
                                '8px 14px',
                              borderRight:
                                '1px solid #dbe4ee',
                              background:
                                '#ffffff'
                            }}
                          >

                            <div
                              style={{
                                color:
                                  '#0f172a',
                                fontSize:
                                  '11px',
                                fontWeight:
                                  800
                              }}
                            >
                              {
                                location.name
                              }
                            </div>

                            {location.path &&
                              location.path !==
                                location.name && (
                                <div
                                  style={{
                                    marginTop:
                                      '3px',
                                    overflow:
                                      'hidden',
                                    color:
                                      '#94a3b8',
                                    fontSize:
                                      '9px',
                                    textOverflow:
                                      'ellipsis',
                                    whiteSpace:
                                      'nowrap'
                                  }}
                                  title={
                                    location.path
                                  }
                                >
                                  {
                                    location.path
                                  }
                                </div>
                              )}

                          </div>


                          {/* TIMELINE ROW */}

                          <div
                            style={{
                              position:
                                'relative',
                              width:
                                timelineWidth,
                              minWidth:
                                timelineWidth,
                              height:
                                ROW_HEIGHT,
                              background:
                                '#ffffff'
                            }}
                          >

                            {/* DAY GRID */}

                            <div
                              style={{
                                position:
                                  'absolute',
                                inset: 0,
                                display:
                                  'flex'
                              }}
                            >

                              {calendarDays.map(
                                (day) => {

                                  const dayName =
                                    getDayName(
                                      day
                                    );

                                  const isWeekend =
                                    dayName ===
                                      'Sat' ||
                                    dayName ===
                                      'Sun';

                                  return (
                                    <div
                                      key={
                                        toDateKey(
                                          day
                                        )
                                      }
                                      style={{
                                        width:
                                          DAY_WIDTH,
                                        minWidth:
                                          DAY_WIDTH,
                                        borderRight:
                                          '1px solid #f1f5f9',
                                        background:
                                          isWeekend
                                            ? '#fafafa'
                                            : 'transparent'
                                      }}
                                    />
                                  );

                                }
                              )}

                            </div>


                            {/* PACKAGE BARS */}

                            {location.items.map(
                              (
                                item,
                                itemIndex
                              ) => {

                                const pkg =
                                  item.package;

                                if (
                                  !pkg ||
                                  !windowStart
                                ) {
                                  return null;
                                }

                                const packageStart =
                                  parseDate(
                                    pkg
                                      .scheduled_start_date
                                  );

                                const packageFinish =
                                  parseDate(
                                    pkg
                                      .scheduled_finish_date
                                  );

                                if (
                                  !packageStart ||
                                  !packageFinish
                                ) {
                                  return null;
                                }


                                const visibleStart =
                                  packageStart <
                                  windowStart
                                    ? windowStart
                                    : packageStart;


                                const windowFinish =
                                  parseDate(
                                    lookaheadPlan
                                      .window_finish_date
                                  );


                                const visibleFinish =
                                  packageFinish >
                                  windowFinish
                                    ? windowFinish
                                    : packageFinish;


                                const startOffset =
                                  differenceInCalendarDays(
                                    windowStart,
                                    visibleStart
                                  );


                                const visibleDuration =
                                  differenceInCalendarDays(
                                    visibleStart,
                                    visibleFinish
                                  ) + 1;


                                const left =
                                  startOffset *
                                  DAY_WIDTH;


                                const width =
                                  Math.max(
                                    visibleDuration *
                                      DAY_WIDTH -
                                      6,
                                    24
                                  );


                                const config =
                                  READINESS_CONFIG[
                                    item
                                      .readiness_status
                                  ] ||
                                  READINESS_CONFIG
                                    .not_assessed;


                                // Most normalized Master Plan
                                // packages should not overlap
                                // inside the same location.
                                // Small vertical staggering
                                // prevents accidental complete
                                // overlap while we validate the
                                // real board.
                                const top =
                                  10 +
                                  (itemIndex %
                                    2) *
                                    22;


                                return (
                                  <div
                                    key={
                                      item.id
                                    }
                                    title={[
                                      pkg
                                        .package_code,
                                      pkg
                                        .service_name,
                                      location.name,
                                      `${formatDate(
                                        pkg
                                          .scheduled_start_date
                                      )} – ${formatDate(
                                        pkg
                                          .scheduled_finish_date
                                      )}`,
                                      config.label
                                    ]
                                      .filter(
                                        Boolean
                                      )
                                      .join(
                                        '\n'
                                      )}
                                    style={{
                                      position:
                                        'absolute',
                                      top,
                                      left:
                                        left + 3,
                                      width,
                                      height:
                                        '20px',
                                      display:
                                        'flex',
                                      alignItems:
                                        'center',
                                      gap: '5px',
                                      padding:
                                        '0 7px',
                                      overflow:
                                        'hidden',
                                      border:
                                        `1px solid ${config.border}`,
                                      borderRadius:
                                        '5px',
                                      background:
                                        config.background,
                                      color:
                                        config.color,
                                      boxSizing:
                                        'border-box',
                                      fontSize:
                                        '9px',
                                      fontWeight:
                                        800,
                                      lineHeight:
                                        1,
                                      whiteSpace:
                                        'nowrap',
                                      textOverflow:
                                        'ellipsis',
                                      cursor:
                                        'default'
                                    }}
                                  >

                                    <span>
                                      {
                                        pkg
                                          .package_code
                                      }
                                    </span>

                                    {width >
                                      90 && (
                                      <span
                                        style={{
                                          overflow:
                                            'hidden',
                                          fontWeight:
                                            600,
                                          textOverflow:
                                            'ellipsis'
                                        }}
                                      >
                                        {
                                          pkg
                                            .service_name
                                        }
                                      </span>
                                    )}

                                  </div>
                                );

                              }
                            )}

                          </div>

                        </div>
                      );

                    }
                  )}

                </div>

              </div>


              {/* BOARD FOOTER */}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    'space-between',
                  gap: '12px',
                  padding: '11px 16px',
                  borderTop:
                    '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  fontSize: '10px',
                  flexWrap: 'wrap'
                }}
              >

                <div>
                  {locationGroups.length}{' '}
                  locations ·{' '}
                  {workItems.length}{' '}
                  packages
                </div>

                <div>
                  Schedule dates are inherited
                  from the frozen Master Plan
                  baseline.
                </div>

              </div>

            </div>

          </>
        )}

    </div>
  );
}
