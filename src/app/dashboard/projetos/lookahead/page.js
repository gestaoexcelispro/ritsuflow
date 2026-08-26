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
// LOOKAHEAD PLANNING
//
// Step 14F.1
//
// Restores the original Lookahead + Koskela workspace
// architecture on top of the normalized backend.
//
// CURRENT STEP
// ------------------------------------------------------------
// ✓ projects
// ✓ active Lookahead plan
// ✓ inherited Master Plan packages
// ✓ Lookahead-only packages
// ✓ Lookahead calendar
// ✓ 7 Koskela readiness dimensions
// ✓ readiness persistence
// ✓ weekend visibility
// ✓ horizon visibility
// ✓ Constraints Details tab foundation
//
// NEXT STEP
// ------------------------------------------------------------
// - Insert Package modal
// - Master Plan working-day engine
// - predecessor + lag
// - holidays
// - horizontal drag
// - propagation
// - Undo for scheduling edits
// ============================================================


const DAY_WIDTH = 38;
const ID_WIDTH = 44;
const DESCRIPTION_WIDTH = 250;
const KOSKELA_WIDTH = 90;

const KOSKELA_COLUMNS = [
  {
    key: 'projects_information',
    label: 'PROJECTS',
  },
  {
    key: 'materials',
    label: 'MATERIALS',
  },
  {
    key: 'labor',
    label: 'LABOR',
  },
  {
    key: 'equipment',
    label: 'EQUIPMENT',
  },
  {
    key: 'space',
    label: 'SPACE',
  },
  {
    key: 'predecessor',
    label: 'PREDECESSOR',
  },
  {
    key: 'external_conditions',
    label: 'EXTERNAL COND.',
  },
];

const SERVICE_COLORS = {
  FUN: '#ff00ff',
  PNS: '#8a2be2',
  VTS: '#0000ff',
  VEX: '#00cfd5',
  LMI: '#00c853',
  VIN: '#ff9900',
  PIS: '#8b0000',
  FOR: '#556b2f',
  COB: '#b05070',
  INS: '#4682b4',
  BUF: '#000000',
  PIN: '#daa520',
  ESQ: '#d8cc63',
  REV: '#d2691e',
  SUP: '#ff0000',
  TST: '#475569',
};


function parseDate(value) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}


function toIsoDate(date) {
  if (!date) return '';

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
  const result = new Date(date);

  result.setDate(
    result.getDate() + amount
  );

  return result;
}


function formatShortDate(date) {
  if (!date) return '';

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: '2-digit',
      day: '2-digit',
    }
  ).format(date);
}


function getDayLabel(date) {
  if (!date) return '';

  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'short',
    }
  ).format(date);
}


function getPackageDates(item) {
  const packageData = item.package;

  const start =
    item.lookahead_start_date ||
    packageData?.scheduled_start_date ||
    null;

  const finish =
    item.lookahead_finish_date ||
    packageData?.scheduled_finish_date ||
    null;

  return {
    start,
    finish,
  };
}


function getPackageCode(item) {
  return (
    item.package_code ||
    item.package?.package_code ||
    ''
  );
}


function getServiceName(item) {
  return (
    item.service_name ||
    item.package?.service_name ||
    ''
  );
}


function getLocationName(item) {
  return (
    item.location_name ||
    item.package?.location_name ||
    'Unassigned Location'
  );
}


function getLocationPath(item) {
  return (
    item.location_path ||
    item.package?.location_path ||
    getLocationName(item)
  );
}


function getServiceColor(code) {
  return (
    SERVICE_COLORS[code] ||
    '#64748b'
  );
}


function getTextColor(background) {
  const hex =
    background.replace('#', '');

  if (hex.length !== 6) {
    return '#ffffff';
  }

  const r =
    parseInt(hex.slice(0, 2), 16);

  const g =
    parseInt(hex.slice(2, 4), 16);

  const b =
    parseInt(hex.slice(4, 6), 16);

  const yiq =
    (r * 299 +
      g * 587 +
      b * 114) /
    1000;

  return yiq >= 150
    ? '#0f172a'
    : '#ffffff';
}


function normalizeReadinessStatus(value) {
  if (value === 'clear') {
    return 'clear';
  }

  if (value === 'constrained') {
    return 'constrained';
  }

  if (value === 'not_applicable') {
    return 'not_applicable';
  }

  return 'not_assessed';
}


function readinessStyle(status) {
  switch (status) {
    case 'clear':
      return {
        background: '#dcfce7',
        color: '#166534',
        border: '#86efac',
      };

    case 'constrained':
      return {
        background: '#fee2e2',
        color: '#991b1b',
        border: '#fca5a5',
      };

    case 'not_applicable':
      return {
        background: '#f1f5f9',
        color: '#64748b',
        border: '#cbd5e1',
      };

    default:
      return {
        background: '#ffffff',
        color: '#64748b',
        border: '#cbd5e1',
      };
  }
}


export default function LookaheadPage() {
  const [
    projects,
    setProjects,
  ] = useState([]);

  const [
    selectedProjectId,
    setSelectedProjectId,
  ] = useState('');

  const [
    plans,
    setPlans,
  ] = useState([]);

  const [
    selectedPlanId,
    setSelectedPlanId,
  ] = useState('');

  const [
    workItems,
    setWorkItems,
  ] = useState([]);

  const [
    readiness,
    setReadiness,
  ] = useState({});

  const [
    activeTab,
    setActiveTab,
  ] = useState('sheet');

  const [
    showWeekends,
    setShowWeekends,
  ] = useState(false);

  const [
    horizonWeeks,
    setHorizonWeeks,
  ] = useState(6);

  const [
    windowStart,
    setWindowStart,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    savingReadiness,
    setSavingReadiness,
  ] = useState('');

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');


  // ==========================================================
  // CURRENT PLAN
  // ==========================================================

  const selectedPlan =
    useMemo(
      () =>
        plans.find(
          (plan) =>
            plan.id ===
            selectedPlanId
        ) || null,
      [
        plans,
        selectedPlanId,
      ]
    );


  // ==========================================================
  // PROJECTS
  // ==========================================================

  const loadProjects =
    useCallback(async () => {
      try {
        const {
          data,
          error,
        } = await supabase
          .from('projects')
          .select(
            `
              id,
              code,
              name,
              status,
              created_at
            `
          )
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

        setProjects(data || []);
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error.message ||
            'Projects could not be loaded.'
        );
      }
    }, []);


  // ==========================================================
  // LOOKAHEAD PLANS
  // ==========================================================

  const loadPlans =
    useCallback(
      async (projectId) => {
        if (!projectId) {
          setPlans([]);
          setSelectedPlanId('');
          return;
        }

        try {
          const {
            data,
            error,
          } = await supabase
            .from('lookahead_plans')
            .select(
              `
                id,
                project_id,
                master_plan_scenario_id,
                name,
                window_start_date,
                window_finish_date,
                horizon_weeks,
                status,
                created_at,
                updated_at
              `
            )
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

          if (error) {
            throw error;
          }

          const loadedPlans =
            data || [];

          setPlans(loadedPlans);

          const active =
            loadedPlans.find(
              (plan) =>
                plan.status ===
                'active'
            );

          const nextPlan =
            active ||
            loadedPlans[0] ||
            null;

          setSelectedPlanId(
            nextPlan?.id || ''
          );

          if (nextPlan) {
            setWindowStart(
              nextPlan.window_start_date ||
                ''
            );

            setHorizonWeeks(
              Number(
                nextPlan.horizon_weeks ||
                  6
              )
            );
          }
        } catch (error) {
          console.error(error);

          setErrorMessage(
            error.message ||
              'Lookahead plans could not be loaded.'
          );
        }
      },
      []
    );


  // ==========================================================
  // WORK ITEMS + READINESS
  // ==========================================================

  const loadWorkspace =
    useCallback(
      async (planId) => {
        if (!planId) {
          setWorkItems([]);
          setReadiness({});
          return;
        }

        setLoading(true);
        setErrorMessage('');

        try {
          const {
            data: items,
            error: itemsError,
          } = await supabase
            .from(
              'lookahead_work_items'
            )
            .select(
              `
                id,
                lookahead_plan_id,
                project_id,
                master_plan_package_id,
                package_source,
                package_code,
                service_name,
                service_code,
                location_name,
                location_path,
                duration_working_days,
                start_rule,
                predecessor_lookahead_work_item_id,
                lag_working_days,
                lookahead_start_date,
                lookahead_finish_date,
                readiness_status,
                priority,
                notes,
                committed_to_weekly,
                created_at,

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
              `
            )
            .eq(
              'lookahead_plan_id',
              planId
            );

          if (itemsError) {
            throw itemsError;
          }

          const normalized =
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
                    packageData ||
                    null,
                };
              })
              .sort((a, b) => {
                const pathA =
                  getLocationPath(a);

                const pathB =
                  getLocationPath(b);

                const byLocation =
                  pathA.localeCompare(
                    pathB
                  );

                if (byLocation !== 0) {
                  return byLocation;
                }

                const startA =
                  getPackageDates(a)
                    .start || '';

                const startB =
                  getPackageDates(b)
                    .start || '';

                return startA.localeCompare(
                  startB
                );
              });

          setWorkItems(normalized);

          const ids =
            normalized.map(
              (item) => item.id
            );

          if (ids.length === 0) {
            setReadiness({});
            return;
          }

          const {
            data: assessments,
            error:
              assessmentError,
          } = await supabase
            .from(
              'lookahead_readiness_assessments'
            )
            .select(
              `
                id,
                lookahead_work_item_id,
                category,
                status
              `
            )
            .in(
              'lookahead_work_item_id',
              ids
            );

          if (assessmentError) {
            throw assessmentError;
          }

          const readinessMap = {};

          (
            assessments || []
          ).forEach(
            (assessment) => {
              readinessMap[
                `${assessment.lookahead_work_item_id}___${assessment.category}`
              ] = {
                id: assessment.id,
                status:
                  normalizeReadinessStatus(
                    assessment.status
                  ),
              };
            }
          );

          setReadiness(
            readinessMap
          );
        } catch (error) {
          console.error(error);

          setErrorMessage(
            error.message ||
              'The Lookahead workspace could not be loaded.'
          );
        } finally {
          setLoading(false);
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


  useEffect(() => {
    loadPlans(
      selectedProjectId
    );
  }, [
    selectedProjectId,
    loadPlans,
  ]);


  useEffect(() => {
    loadWorkspace(
      selectedPlanId
    );
  }, [
    selectedPlanId,
    loadWorkspace,
  ]);


  // ==========================================================
  // PLAN CHANGE
  // ==========================================================

  const handlePlanChange =
    (planId) => {
      setSelectedPlanId(planId);

      const plan =
        plans.find(
          (item) =>
            item.id === planId
        );

      if (plan) {
        setWindowStart(
          plan.window_start_date ||
            ''
        );

        setHorizonWeeks(
          Number(
            plan.horizon_weeks ||
              6
          )
        );
      }
    };


  // ==========================================================
  // CALENDAR
  // ==========================================================

  const allCalendarDays =
    useMemo(() => {
      if (!windowStart) {
        return [];
      }

      const start =
        parseDate(windowStart);

      if (!start) {
        return [];
      }

      const result = [];

      const totalDays =
        Math.max(
          1,
          Number(horizonWeeks)
        ) * 7;

      for (
        let index = 0;
        index < totalDays;
        index += 1
      ) {
        const date =
          addDays(
            start,
            index
          );

        const day =
          date.getDay();

        result.push({
          date,
          iso: toIsoDate(date),
          isWeekend:
            day === 0 ||
            day === 6,
        });
      }

      return result;
    }, [
      windowStart,
      horizonWeeks,
    ]);


  const visibleDays =
    useMemo(
      () =>
        showWeekends
          ? allCalendarDays
          : allCalendarDays.filter(
              (day) =>
                !day.isWeekend
            ),
      [
        allCalendarDays,
        showWeekends,
      ]
    );


  const weekGroups =
    useMemo(() => {
      const groups = [];

      allCalendarDays.forEach(
        (day, index) => {
          const weekNumber =
            Math.floor(index / 7) +
            1;

          let group =
            groups.find(
              (item) =>
                item.weekNumber ===
                weekNumber
            );

          if (!group) {
            group = {
              weekNumber,
              days: [],
            };

            groups.push(group);
          }

          if (
            showWeekends ||
            !day.isWeekend
          ) {
            group.days.push(day);
          }
        }
      );

      return groups.filter(
        (group) =>
          group.days.length > 0
      );
    }, [
      allCalendarDays,
      showWeekends,
    ]);


  // ==========================================================
  // READINESS UPDATE
  // ==========================================================

  const handleReadinessChange =
    async (
      itemId,
      category,
      status
    ) => {
      const key =
        `${itemId}___${category}`;

      const existing =
        readiness[key];

      if (!existing?.id) {
        return;
      }

      const previous =
        existing.status;

      setReadiness(
        (current) => ({
          ...current,
          [key]: {
            ...existing,
            status,
          },
        })
      );

      setSavingReadiness(key);

      try {
        const {
          error,
        } = await supabase
          .from(
            'lookahead_readiness_assessments'
          )
          .update({
            status,
          })
          .eq(
            'id',
            existing.id
          );

        if (error) {
          throw error;
        }

        await loadWorkspace(
          selectedPlanId
        );
      } catch (error) {
        console.error(error);

        setReadiness(
          (current) => ({
            ...current,
            [key]: {
              ...existing,
              status: previous,
            },
          })
        );

        setErrorMessage(
          error.message ||
            'Readiness could not be updated.'
        );
      } finally {
        setSavingReadiness('');
      }
    };


  // ==========================================================
  // ACTIVE CONSTRAINTS
  // ==========================================================

  const constrainedCells =
    useMemo(() => {
      const rows = [];

      workItems.forEach(
        (item) => {
          KOSKELA_COLUMNS.forEach(
            (column) => {
              const key =
                `${item.id}___${column.key}`;

              const assessment =
                readiness[key];

              if (
                assessment?.status ===
                'constrained'
              ) {
                rows.push({
                  item,
                  column,
                });
              }
            }
          );
        }
      );

      return rows;
    }, [
      workItems,
      readiness,
    ]);


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      style={{
        padding: '18px 20px 40px',
        minHeight: '100%',
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >
      {/* ====================================================
          TITLE
      ===================================================== */}

      <div
        style={{
          marginBottom: '18px',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 800,
          }}
        >
          LOOKAHEAD (MEDIUM TERM) &amp; KOSKELA MATRIX
        </h1>
      </div>


      {/* ====================================================
          TOP CONTROLS
      ===================================================== */}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            minWidth: '250px',
          }}
        >
          <label
            style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            Project
          </label>

          <select
            value={
              selectedProjectId
            }
            onChange={(event) => {
              setSelectedProjectId(
                event.target.value
              );
            }}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              border:
                '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#fff',
            }}
          >
            <option value="">
              -- Select a Project --
            </option>

            {projects.map(
              (project) => (
                <option
                  key={project.id}
                  value={project.id}
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


        <div
          style={{
            minWidth: '280px',
          }}
        >
          <label
            style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            Scenario / Version (Lookahead)
          </label>

          <select
            value={selectedPlanId}
            disabled={
              !selectedProjectId
            }
            onChange={(event) =>
              handlePlanChange(
                event.target.value
              )
            }
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              border:
                '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#fff',
            }}
          >
            <option value="">
              -- Select --
            </option>

            {plans.map(
              (plan) => (
                <option
                  key={plan.id}
                  value={plan.id}
                >
                  {plan.name}
                  {plan.status ===
                  'active'
                    ? ' · Active'
                    : ''}
                </option>
              )
            )}
          </select>
        </div>


        <button
          type="button"
          disabled
          title="Scenario persistence will be restored in a later step."
          style={disabledButtonStyle}
        >
          💾 Save
        </button>


        <button
          type="button"
          disabled={!selectedPlanId}
          onClick={() => {
            alert(
              'Insert Package is the next implementation step. The backend foundation is already ready.'
            );
          }}
          style={
            selectedPlanId
              ? primaryButtonStyle
              : disabledButtonStyle
          }
        >
          ⚡ Insert Package
        </button>


        <button
          type="button"
          disabled
          title="Undo will be activated with schedule editing."
          style={disabledButtonStyle}
        >
          Undo
        </button>


        <button
          type="button"
          disabled
          title="Holiday management will be connected to the Master Plan calendar in the scheduling step."
          style={disabledButtonStyle}
        >
          📅 Holidays
        </button>


        <button
          type="button"
          onClick={() =>
            setShowWeekends(
              (current) =>
                !current
            )
          }
          style={secondaryButtonStyle}
        >
          {showWeekends
            ? 'Hide Weekends'
            : 'Show Weekends'}
        </button>


        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            Start of Week 1
          </label>

          <input
            type="date"
            value={windowStart}
            onChange={(event) =>
              setWindowStart(
                event.target.value
              )
            }
            style={{
              height: '36px',
              padding: '0 8px',
              border:
                '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#fff',
            }}
          />
        </div>


        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            Horizon
          </label>

          <select
            value={horizonWeeks}
            onChange={(event) =>
              setHorizonWeeks(
                Number(
                  event.target.value
                )
              )
            }
            style={{
              height: '36px',
              padding: '0 8px',
              border:
                '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#fff',
            }}
          >
            {[2, 3, 4, 5, 6, 8, 10, 12].map(
              (weeks) => (
                <option
                  key={weeks}
                  value={weeks}
                >
                  {weeks} Weeks
                </option>
              )
            )}
          </select>
        </div>
      </div>


      {/* ====================================================
          ERROR
      ===================================================== */}

      {errorMessage && (
        <div
          style={{
            marginBottom: '12px',
            padding: '10px 12px',
            border:
              '1px solid #fecaca',
            borderRadius: '6px',
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: '12px',
          }}
        >
          {errorMessage}
        </div>
      )}


      {/* ====================================================
          TABS
      ===================================================== */}

      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginTop: '8px',
        }}
      >
        <button
          type="button"
          onClick={() =>
            setActiveTab('sheet')
          }
          style={
            activeTab === 'sheet'
              ? activeTabStyle
              : tabStyle
          }
        >
          📅 Lookahead &amp; Koskela Sheet
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab(
              'constraints'
            )
          }
          style={
            activeTab ===
            'constraints'
              ? activeTabStyle
              : tabStyle
          }
        >
          ⚠️ Constraints Details
        </button>
      </div>


      {/* ====================================================
          NO PROJECT
      ===================================================== */}

      {!selectedProjectId && (
        <div
          style={{
            padding: '60px 20px',
            border:
              '1px solid #e2e8f0',
            background: '#fff',
            textAlign: 'center',
          }}
        >
          <strong>
            No Project Selected
          </strong>

          <div
            style={{
              marginTop: '6px',
              color: '#64748b',
              fontSize: '12px',
            }}
          >
            Select a project from the
            menu above to open the
            Lookahead.
          </div>
        </div>
      )}


      {/* ====================================================
          SHEET
      ===================================================== */}

      {selectedProjectId &&
        selectedPlanId &&
        activeTab === 'sheet' && (
          <div
            style={{
              overflowX: 'auto',
              border:
                '1px solid #cbd5e1',
              background: '#fff',
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#64748b',
                }}
              >
                Loading Lookahead...
              </div>
            ) : (
              <table
                style={{
                  borderCollapse:
                    'collapse',
                  minWidth:
                    ID_WIDTH +
                    DESCRIPTION_WIDTH +
                    visibleDays.length *
                      DAY_WIDTH +
                    KOSKELA_COLUMNS.length *
                      KOSKELA_WIDTH,
                  width: '100%',
                  tableLayout: 'fixed',
                  fontSize: '10px',
                }}
              >
                <thead>
                  {/* WEEK HEADER */}

                  <tr>
                    <th
                      rowSpan={3}
                      style={{
                        ...headerCellStyle,
                        width: ID_WIDTH,
                        minWidth:
                          ID_WIDTH,
                      }}
                    >
                      ID
                    </th>

                    <th
                      rowSpan={3}
                      style={{
                        ...headerCellStyle,
                        width:
                          DESCRIPTION_WIDTH,
                        minWidth:
                          DESCRIPTION_WIDTH,
                      }}
                    >
                      DESCRIPTION
                    </th>

                    {weekGroups.map(
                      (week) => (
                        <th
                          key={
                            week.weekNumber
                          }
                          colSpan={
                            week.days.length
                          }
                          style={{
                            ...headerCellStyle,
                            background:
                              '#e2e8f0',
                          }}
                        >
                          WEEK{' '}
                          {
                            week.weekNumber
                          }
                        </th>
                      )
                    )}

                    <th
                      colSpan={
                        KOSKELA_COLUMNS.length
                      }
                      style={{
                        ...headerCellStyle,
                        background:
                          '#f1f5f9',
                        fontWeight: 800,
                      }}
                    >
                      KOSKELA FLOW MATRIX
                    </th>
                  </tr>


                  {/* DAY NAME */}

                  <tr>
                    {visibleDays.map(
                      (day) => (
                        <th
                          key={`weekday-${day.iso}`}
                          style={{
                            ...calendarHeaderStyle,
                            background:
                              day.isWeekend
                                ? '#e2e8f0'
                                : '#f8fafc',
                          }}
                        >
                          {getDayLabel(
                            day.date
                          )}
                        </th>
                      )
                    )}

                    {KOSKELA_COLUMNS.map(
                      (column) => (
                        <th
                          key={column.key}
                          rowSpan={2}
                          style={{
                            ...headerCellStyle,
                            width:
                              KOSKELA_WIDTH,
                            minWidth:
                              KOSKELA_WIDTH,
                            whiteSpace:
                              'normal',
                          }}
                        >
                          {column.label}
                        </th>
                      )
                    )}
                  </tr>


                  {/* DATE */}

                  <tr>
                    {visibleDays.map(
                      (day) => (
                        <th
                          key={`date-${day.iso}`}
                          style={{
                            ...calendarHeaderStyle,
                            background:
                              day.isWeekend
                                ? '#e2e8f0'
                                : '#fff',
                          }}
                        >
                          {formatShortDate(
                            day.date
                          )}
                        </th>
                      )
                    )}
                  </tr>
                </thead>


                <tbody>
                  {workItems.map(
                    (item, index) => {
                      const code =
                        getPackageCode(
                          item
                        );

                      const service =
                        getServiceName(
                          item
                        );

                      const location =
                        getLocationName(
                          item
                        );

                      const locationPath =
                        getLocationPath(
                          item
                        );

                      const dates =
                        getPackageDates(
                          item
                        );

                      const color =
                        getServiceColor(
                          code
                        );

                      const textColor =
                        getTextColor(
                          color
                        );

                      return (
                        <tr key={item.id}>
                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            {index + 1}
                          </td>

                          <td
                            style={{
                              ...bodyCellStyle,
                              padding:
                                '5px 7px',
                              textAlign:
                                'left',
                            }}
                          >
                            <div
                              style={{
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                gap: '6px',
                              }}
                            >
                              <span
                                style={{
                                  padding:
                                    '2px 5px',
                                  borderRadius:
                                    '3px',
                                  background:
                                    item.package_source ===
                                    'lookahead'
                                      ? '#0f172a'
                                      : '#e2e8f0',
                                  color:
                                    item.package_source ===
                                    'lookahead'
                                      ? '#fff'
                                      : '#475569',
                                  fontSize:
                                    '8px',
                                  fontWeight:
                                    800,
                                }}
                              >
                                {item.package_source ===
                                'lookahead'
                                  ? 'LA'
                                  : 'MP'}
                              </span>

                              <strong>
                                {location}
                              </strong>
                            </div>

                            <div
                              style={{
                                marginTop:
                                  '3px',
                                color:
                                  '#64748b',
                                fontSize:
                                  '9px',
                              }}
                              title={
                                locationPath
                              }
                            >
                              {code}
                              {service
                                ? ` · ${service}`
                                : ''}
                            </div>
                          </td>


                          {visibleDays.map(
                            (day) => {
                              const isActive =
                                dates.start &&
                                dates.finish &&
                                day.iso >=
                                  dates.start &&
                                day.iso <=
                                  dates.finish;

                              return (
                                <td
                                  key={`${item.id}-${day.iso}`}
                                  title={
                                    isActive
                                      ? `${code} · ${service}`
                                      : day.iso
                                  }
                                  style={{
                                    ...bodyCellStyle,
                                    width:
                                      DAY_WIDTH,
                                    minWidth:
                                      DAY_WIDTH,
                                    height:
                                      '34px',
                                    padding: 0,
                                    background:
                                      isActive
                                        ? color
                                        : day.isWeekend
                                          ? '#f1f5f9'
                                          : '#fff',
                                    color:
                                      isActive
                                        ? textColor
                                        : '#94a3b8',
                                    fontWeight:
                                      isActive
                                        ? 800
                                        : 400,
                                  }}
                                >
                                  {isActive
                                    ? code
                                    : ''}
                                </td>
                              );
                            }
                          )}


                          {KOSKELA_COLUMNS.map(
                            (column) => {
                              const key =
                                `${item.id}___${column.key}`;

                              const assessment =
                                readiness[key];

                              const status =
                                assessment?.status ||
                                'not_assessed';

                              const style =
                                readinessStyle(
                                  status
                                );

                              return (
                                <td
                                  key={key}
                                  style={{
                                    ...bodyCellStyle,
                                    padding:
                                      '3px',
                                  }}
                                >
                                  <select
                                    value={
                                      status
                                    }
                                    disabled={
                                      !assessment ||
                                      savingReadiness ===
                                        key
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      handleReadinessChange(
                                        item.id,
                                        column.key,
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    style={{
                                      width:
                                        '100%',
                                      height:
                                        '26px',
                                      border:
                                        `1px solid ${style.border}`,
                                      borderRadius:
                                        '4px',
                                      background:
                                        style.background,
                                      color:
                                        style.color,
                                      fontSize:
                                        '9px',
                                      fontWeight:
                                        700,
                                    }}
                                  >
                                    <option value="not_assessed">
                                      —
                                    </option>

                                    <option value="clear">
                                      Yes
                                    </option>

                                    <option value="constrained">
                                      No
                                    </option>

                                    <option value="not_applicable">
                                      N/A
                                    </option>
                                  </select>
                                </td>
                              );
                            }
                          )}
                        </tr>
                      );
                    }
                  )}


                  {/* ADD ROW PLACEHOLDER */}

                  <tr>
                    <td
                      style={
                        bodyCellStyle
                      }
                    />

                    <td
                      style={{
                        ...bodyCellStyle,
                        textAlign:
                          'left',
                        padding: '7px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          alert(
                            'Add New Row will use the Lookahead-only package flow in Step 14F.2.'
                          );
                        }}
                        style={{
                          border: 0,
                          background:
                            'transparent',
                          color:
                            '#2563eb',
                          fontSize:
                            '10px',
                          fontWeight:
                            700,
                          cursor:
                            'pointer',
                        }}
                      >
                        + Add New Row
                      </button>
                    </td>

                    <td
                      colSpan={
                        visibleDays.length +
                        KOSKELA_COLUMNS.length
                      }
                      style={
                        bodyCellStyle
                      }
                    />
                  </tr>
                </tbody>
              </table>
            )}


            {/* LEGEND */}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                flexWrap: 'wrap',
                padding:
                  '10px 12px',
                borderTop:
                  '1px solid #cbd5e1',
                fontSize: '9px',
              }}
            >
              <strong>
                LEGEND (KOSKELA):
              </strong>

              <span>
                🟢 Yes - Cleared
              </span>

              <span>
                🔴 No - Active Constraint
              </span>

              <span>
                ⚪ Not Assessed
              </span>

              <span>
                MP = Master Plan
              </span>

              <span>
                LA = Lookahead-only
              </span>
            </div>
          </div>
        )}


      {/* ====================================================
          CONSTRAINTS TAB
      ===================================================== */}

      {selectedProjectId &&
        selectedPlanId &&
        activeTab ===
          'constraints' && (
          <div
            style={{
              border:
                '1px solid #cbd5e1',
              background: '#fff',
            }}
          >
            <div
              style={{
                padding:
                  '12px 14px',
                borderBottom:
                  '1px solid #e2e8f0',
                fontWeight: 800,
                fontSize: '12px',
              }}
            >
              CONSTRAINTS DETAILS
            </div>

            {constrainedCells.length ===
            0 ? (
              <div
                style={{
                  padding:
                    '40px 20px',
                  textAlign:
                    'center',
                  color:
                    '#64748b',
                  fontSize:
                    '12px',
                }}
              >
                🎉 No active constraints at the moment.
              </div>
            ) : (
              <table
                style={{
                  width: '100%',
                  borderCollapse:
                    'collapse',
                  fontSize: '10px',
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={
                        headerCellStyle
                      }
                    >
                      TASK
                    </th>

                    <th
                      style={
                        headerCellStyle
                      }
                    >
                      TASK CODE
                    </th>

                    <th
                      style={
                        headerCellStyle
                      }
                    >
                      CONSTRAINT
                    </th>

                    <th
                      style={
                        headerCellStyle
                      }
                    >
                      STATUS
                    </th>

                    <th
                      style={
                        headerCellStyle
                      }
                    >
                      SOURCE
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {constrainedCells.map(
                    ({
                      item,
                      column,
                    }) => (
                      <tr
                        key={`${item.id}-${column.key}`}
                      >
                        <td
                          style={
                            bodyCellStyle
                          }
                        >
                          {getLocationName(
                            item
                          )}
                        </td>

                        <td
                          style={
                            bodyCellStyle
                          }
                        >
                          {getPackageCode(
                            item
                          )}
                        </td>

                        <td
                          style={
                            bodyCellStyle
                          }
                        >
                          {column.label}
                        </td>

                        <td
                          style={
                            bodyCellStyle
                          }
                        >
                          Active
                        </td>

                        <td
                          style={
                            bodyCellStyle
                          }
                        >
                          {item.package_source ===
                          'lookahead'
                            ? 'Lookahead'
                            : 'Master Plan'}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}


      {/* ====================================================
          SELECTED PROJECT BUT NO PLAN
      ===================================================== */}

      {selectedProjectId &&
        !selectedPlanId &&
        !loading && (
          <div
            style={{
              padding: '50px 20px',
              border:
                '1px solid #e2e8f0',
              background: '#fff',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '12px',
            }}
          >
            This project does not have a
            Lookahead plan yet.
          </div>
        )}
    </div>
  );
}


// ============================================================
// STYLES
// ============================================================

const headerCellStyle = {
  border: '1px solid #cbd5e1',
  padding: '5px 4px',
  background: '#f8fafc',
  color: '#334155',
  textAlign: 'center',
  fontSize: '9px',
  fontWeight: 800,
};

const calendarHeaderStyle = {
  ...headerCellStyle,
  width: DAY_WIDTH,
  minWidth: DAY_WIDTH,
  padding: '3px 1px',
  fontSize: '8px',
};

const bodyCellStyle = {
  border: '1px solid #e2e8f0',
  padding: '3px',
  background: '#fff',
  color: '#334155',
  textAlign: 'center',
  verticalAlign: 'middle',
};

const primaryButtonStyle = {
  height: '36px',
  padding: '0 12px',
  border: '1px solid #2563eb',
  borderRadius: '6px',
  background: '#2563eb',
  color: '#fff',
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  height: '36px',
  padding: '0 12px',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  background: '#fff',
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

const tabStyle = {
  padding: '9px 14px',
  border: '1px solid #cbd5e1',
  borderBottom: 0,
  borderRadius: '6px 6px 0 0',
  background: '#e2e8f0',
  color: '#475569',
  fontSize: '10px',
  fontWeight: 700,
  cursor: 'pointer',
};

const activeTabStyle = {
  ...tabStyle,
  background: '#fff',
  color: '#0f172a',
};
