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
// GROUPED LOOKAHEAD + KOSKELA MATRIX
//
// Architecture:
// ------------------------------------------------------------
// One visual row per Work Package.
//
// Timeline:
// - Individual Lookahead work-item occurrences remain separate.
// - Multiple locations of the same package are shown on one row.
//
// Koskela:
// - Assessment belongs to the GROUPED sheet row.
// - One package row = one assessment per Koskela category.
//
// Example:
//
// VTS -> PROJECTS -> No
//
// creates ONE grouped constraint,
// regardless of how many VTS location occurrences exist.
// ============================================================


const ACTION_WIDTH = 34;
const ID_WIDTH = 38;
const PACKAGE_WIDTH = 64;
const DESCRIPTION_WIDTH = 250;
const DAY_WIDTH = 38;
const KOSKELA_WIDTH = 88;


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


// ============================================================
// DATE HELPERS
// ============================================================

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


function toIsoDate(date) {
  if (!date) {
    return '';
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}


function addDays(
  date,
  amount
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() + amount
  );

  return result;
}


function formatShortDate(
  date
) {
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: '2-digit',
      day: '2-digit',
    }
  ).format(date);
}


function getDayLabel(
  date
) {
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'short',
    }
  ).format(date);
}


// ============================================================
// PACKAGE HELPERS
// ============================================================

function getPackageCode(
  item
) {
  return String(
    item.package_code ||
    item.package?.package_code ||
    ''
  )
    .trim()
    .toUpperCase();
}


function getServiceName(
  item
) {
  return (
    item.service_name ||
    item.package?.service_name ||
    ''
  );
}


function getLocationName(
  item
) {
  return (
    item.location_name ||
    item.package?.location_name ||
    'Unassigned Location'
  );
}


function getLocationPath(
  item
) {
  return (
    item.location_path ||
    item.package?.location_path ||
    getLocationName(item)
  );
}


function getPackageDates(
  item
) {
  return {
    start:
      item.lookahead_start_date ||
      item.package?.scheduled_start_date ||
      null,

    finish:
      item.lookahead_finish_date ||
      item.package?.scheduled_finish_date ||
      null,
  };
}


function getServiceColor(
  code
) {
  return (
    SERVICE_COLORS[code] ||
    '#64748b'
  );
}


function getTextColor(
  background
) {
  const hex =
    String(
      background || ''
    )
      .replace(
        '#',
        ''
      );

  if (
    hex.length !== 6
  ) {
    return '#ffffff';
  }

  const r =
    parseInt(
      hex.slice(
        0,
        2
      ),
      16
    );

  const g =
    parseInt(
      hex.slice(
        2,
        4
      ),
      16
    );

  const b =
    parseInt(
      hex.slice(
        4,
        6
      ),
      16
    );

  const yiq =
    (
      r * 299 +
      g * 587 +
      b * 114
    ) /
    1000;

  return yiq >= 150
    ? '#0f172a'
    : '#ffffff';
}


// ============================================================
// READINESS HELPERS
// ============================================================

function normalizeReadinessStatus(
  value
) {
  if (
    value === 'clear'
  ) {
    return 'clear';
  }

  if (
    value === 'constrained'
  ) {
    return 'constrained';
  }

  if (
    value === 'not_applicable'
  ) {
    return 'not_applicable';
  }

  return 'not_assessed';
}


function readinessStyle(
  status
) {
  switch (status) {

    case 'clear':

      return {
        background:
          '#dcfce7',
        color:
          '#166534',
        border:
          '#86efac',
      };


    case 'constrained':

      return {
        background:
          '#fee2e2',
        color:
          '#991b1b',
        border:
          '#fca5a5',
      };


    case 'not_applicable':

      return {
        background:
          '#f1f5f9',
        color:
          '#64748b',
        border:
          '#cbd5e1',
      };


    default:

      return {
        background:
          '#ffffff',
        color:
          '#64748b',
        border:
          '#cbd5e1',
      };

  }
}


// ============================================================
// PAGE
// ============================================================

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
    sheetRows,
    setSheetRows,
  ] = useState([]);


  const [
    readiness,
    setReadiness,
  ] = useState({});


  const [
    masterPlanHolidays,
    setMasterPlanHolidays,
  ] = useState([]);


  const [
    descriptionDrafts,
    setDescriptionDrafts,
  ] = useState({});


  const [
    activeTab,
    setActiveTab,
  ] = useState(
    'sheet'
  );


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
    errorMessage,
    setErrorMessage,
  ] = useState('');


  const [
    savingDescriptionId,
    setSavingDescriptionId,
  ] = useState('');


  const [
    savingGroupedReadiness,
    setSavingGroupedReadiness,
  ] = useState('');


  const [
    openRowMenuId,
    setOpenRowMenuId,
  ] = useState('');


  const [
    insertingRow,
    setInsertingRow,
  ] = useState(false);


  // ==========================================================
  // SELECTED PLAN
  // ==========================================================

  const selectedPlan =
    useMemo(
      () =>
        plans.find(
          (plan) =>
            plan.id ===
            selectedPlanId
        ) ||
        null,
      [
        plans,
        selectedPlanId,
      ]
    );


  // ==========================================================
  // LOAD PROJECTS
  // ==========================================================

  const loadProjects =
    useCallback(
      async () => {

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


          const loaded =
            data || [];


          setProjects(
            loaded
          );


          const params =
            new URLSearchParams(
              window.location
                .search
            );


          const projectId =
            params.get(
              'projectId'
            );


          if (
            projectId &&
            loaded.some(
              (project) =>
                project.id ===
                projectId
            )
          ) {

            setSelectedProjectId(
              projectId
            );

          }

        } catch (error) {

          console.error(
            'Lookahead projects:',
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
  // LOAD LOOKAHEAD PLANS
  // ==========================================================

  const loadPlans =
    useCallback(
      async (
        projectId
      ) => {

        if (!projectId) {

          setPlans([]);
          setSelectedPlanId('');

          return;

        }


        try {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'lookahead_plans'
              )
              .select(`
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


          if (error) {
            throw error;
          }


          const loadedPlans =
            data || [];


          setPlans(
            loadedPlans
          );


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
            nextPlan?.id ||
            ''
          );


          if (
            nextPlan
          ) {

            setWindowStart(
              nextPlan
                .window_start_date ||
              ''
            );


            setHorizonWeeks(
              Number(
                nextPlan
                  .horizon_weeks ||
                6
              )
            );

          }

        } catch (error) {

          console.error(
            'Lookahead plans:',
            error
          );


          setErrorMessage(
            error.message ||
            'Lookahead plans could not be loaded.'
          );

        }

      },
      []
    );


  // ==========================================================
  // LOAD MASTER PLAN HOLIDAYS
  // ==========================================================

  const loadMasterPlanHolidays =
    useCallback(
      async (
        masterPlanScenarioId
      ) => {

        if (
          !masterPlanScenarioId
        ) {

          setMasterPlanHolidays(
            []
          );

          return;

        }


        try {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'master_plan_scenarios'
              )
              .select(`
                id,
                plan_data
              `)
              .eq(
                'id',
                masterPlanScenarioId
              )
              .single();


          if (error) {
            throw error;
          }


          const holidays =
            Array.isArray(
              data?.plan_data
                ?.holidays
            )
              ? data.plan_data
                  .holidays
              : [];


          setMasterPlanHolidays(
            holidays
          );

        } catch (error) {

          console.error(
            'Lookahead - Master Plan holidays:',
            error
          );


          setMasterPlanHolidays(
            []
          );


          setErrorMessage(
            error.message ||
            'Master Plan holidays could not be loaded.'
          );

        }

      },
      []
    );


  // ==========================================================
  // LOAD WORKSPACE
  // ==========================================================

  const loadWorkspace =
    useCallback(
      async (
        planId
      ) => {

        if (!planId) {

          setWorkItems([]);
          setSheetRows([]);
          setReadiness({});
          setDescriptionDrafts({});

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
          // WORK ITEMS
          // --------------------------------------------------

          const {
            data: items,
            error:
              itemsError,
          } =
            await supabase
              .from(
                'lookahead_work_items'
              )
              .select(`
                id,
                lookahead_plan_id,
                project_id,
                master_plan_package_id,
                package_source,

                package_code,
                service_name,
                service_code,

                lookahead_description,

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
              `)
              .eq(
                'lookahead_plan_id',
                planId
              );


          if (
            itemsError
          ) {
            throw itemsError;
          }


          const normalizedItems =
            (
              items ||
              []
            ).map(
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
                    null,
                };

              }
            );


          setWorkItems(
            normalizedItems
          );


          // --------------------------------------------------
          // SHEET ROWS
          // --------------------------------------------------

          const {
            data: rows,
            error:
              rowsError,
          } =
            await supabase
              .from(
                'lookahead_sheet_rows'
              )
              .select(`
                id,
                lookahead_plan_id,
                row_type,
                package_code,
                description,
                row_order,
                created_at,
                updated_at
              `)
              .eq(
                'lookahead_plan_id',
                planId
              )
              .order(
                'row_order',
                {
                  ascending:
                    true,
                }
              );


          if (
            rowsError
          ) {
            throw rowsError;
          }


          const loadedRows =
            rows || [];


          setSheetRows(
            loadedRows
          );


          const nextDescriptions =
            {};


          loadedRows.forEach(
            (row) => {

              nextDescriptions[
                row.id
              ] =
                row.description ||
                '';

            }
          );


          setDescriptionDrafts(
            nextDescriptions
          );


          // --------------------------------------------------
          // GROUPED KOSKELA READINESS
          // --------------------------------------------------

          const sheetRowIds =
            loadedRows.map(
              (row) =>
                row.id
            );


          if (
            sheetRowIds.length ===
            0
          ) {

            setReadiness(
              {}
            );

            return;

          }


          const {
            data:
              assessments,
            error:
              assessmentError,
          } =
            await supabase
              .from(
                'lookahead_sheet_readiness_assessments'
              )
              .select(`
                id,
                sheet_row_id,
                category,
                status,
                created_at,
                updated_at
              `)
              .in(
                'sheet_row_id',
                sheetRowIds
              );


          if (
            assessmentError
          ) {
            throw assessmentError;
          }


          const readinessMap =
            {};


          (
            assessments ||
            []
          ).forEach(
            (
              assessment
            ) => {

              readinessMap[
                `${assessment.sheet_row_id}___${assessment.category}`
              ] = {

                id:
                  assessment.id,

                sheet_row_id:
                  assessment.sheet_row_id,

                category:
                  assessment.category,

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

          console.error(
            'Lookahead workspace:',
            error
          );


          setErrorMessage(
            error.message ||
            'The Lookahead workspace could not be loaded.'
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
  // LOAD EFFECTS
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

      loadPlans(
        selectedProjectId
      );

    },
    [
      selectedProjectId,
      loadPlans,
    ]
  );


  useEffect(
    () => {

      loadWorkspace(
        selectedPlanId
      );

    },
    [
      selectedPlanId,
      loadWorkspace,
    ]
  );


  useEffect(
    () => {

      loadMasterPlanHolidays(
        selectedPlan
          ?.master_plan_scenario_id ||
        null
      );

    },
    [
      selectedPlan
        ?.master_plan_scenario_id,
      loadMasterPlanHolidays,
    ]
  );


  // ==========================================================
  // PLAN CHANGE
  // ==========================================================

  const handlePlanChange =
    (
      planId
    ) => {

      setSelectedPlanId(
        planId
      );


      const plan =
        plans.find(
          (item) =>
            item.id ===
            planId
        );


      if (
        plan
      ) {

        setWindowStart(
          plan
            .window_start_date ||
          ''
        );


        setHorizonWeeks(
          Number(
            plan
              .horizon_weeks ||
            6
          )
        );

      }

    };


  // ==========================================================
  // HOLIDAY MAP
  // ==========================================================

  const holidayMap =
    useMemo(
      () => {

        const map =
          new Map();


        masterPlanHolidays.forEach(
          (
            holiday
          ) => {

            const date =
              holiday?.data ||
              holiday?.date ||
              '';


            if (
              !date
            ) {
              return;
            }


            map.set(
              date,

              holiday.descricao ||
              holiday.description ||
              'Holiday'
            );

          }
        );


        return map;

      },
      [
        masterPlanHolidays,
      ]
    );


  // ==========================================================
  // GROUP WORK ITEMS BY PACKAGE
  // ==========================================================

  const workItemsByPackage =
    useMemo(
      () => {

        const map =
          {};


        workItems.forEach(
          (
            item
          ) => {

            const code =
              getPackageCode(
                item
              );


            if (
              !code
            ) {
              return;
            }


            if (
              !map[
                code
              ]
            ) {

              map[
                code
              ] =
                [];

            }


            map[
              code
            ].push(
              item
            );

          }
        );


        Object.keys(
          map
        ).forEach(
          (
            code
          ) => {

            map[
              code
            ].sort(
              (
                a,
                b
              ) => {

                const dateA =
                  getPackageDates(
                    a
                  ).start ||
                  '';

                const dateB =
                  getPackageDates(
                    b
                  ).start ||
                  '';


                if (
                  dateA !==
                  dateB
                ) {

                  return dateA.localeCompare(
                    dateB
                  );

                }


                return getLocationPath(
                  a
                ).localeCompare(
                  getLocationPath(
                    b
                  )
                );

              }
            );

          }
        );


        return map;

      },
      [
        workItems,
      ]
    );


  // ==========================================================
  // CALENDAR
  // ==========================================================

  const allCalendarDays =
    useMemo(
      () => {

        if (
          !windowStart
        ) {
          return [];
        }


        const start =
          parseDate(
            windowStart
          );


        if (
          !start
        ) {
          return [];
        }


        const result =
          [];


        const totalDays =
          Math.max(
            1,
            Number(
              horizonWeeks
            )
          ) * 7;


        for (
          let index = 0;
          index <
          totalDays;
          index += 1
        ) {

          const date =
            addDays(
              start,
              index
            );


          const weekday =
            date.getDay();


          const iso =
            toIsoDate(
              date
            );


          result.push({

            date,

            iso,

            isWeekend:
              weekday === 0 ||
              weekday === 6,

            isHoliday:
              holidayMap.has(
                iso
              ),

            holidayDescription:
              holidayMap.get(
                iso
              ) ||
              '',
          });

        }


        return result;

      },
      [
        windowStart,
        horizonWeeks,
        holidayMap,
      ]
    );


  const visibleDays =
    useMemo(
      () =>
        showWeekends
          ? allCalendarDays
          : allCalendarDays.filter(
              (
                day
              ) =>
                !day.isWeekend
            ),
      [
        allCalendarDays,
        showWeekends,
      ]
    );


  const weekGroups =
    useMemo(
      () => {

        const groups =
          [];


        allCalendarDays.forEach(
          (
            day,
            index
          ) => {

            const weekNumber =
              Math.floor(
                index / 7
              ) +
              1;


            let group =
              groups.find(
                (
                  item
                ) =>
                  item.weekNumber ===
                  weekNumber
              );


            if (
              !group
            ) {

              group = {
                weekNumber,
                days: [],
              };


              groups.push(
                group
              );

            }


            if (
              showWeekends ||
              !day.isWeekend
            ) {

              group.days.push(
                day
              );

            }

          }
        );


        return groups.filter(
          (
            group
          ) =>
            group.days
              .length >
            0
        );

      },
      [
        allCalendarDays,
        showWeekends,
      ]
    );


  // ==========================================================
  // SAVE ROW DESCRIPTION
  // ==========================================================

  const saveRowDescription =
    async (
      row
    ) => {

      const nextValue =
        String(
          descriptionDrafts[
            row.id
          ] ||
          ''
        ).trim();


      if (
        nextValue ===
        String(
          row.description ||
          ''
        ).trim()
      ) {
        return;
      }


      setSavingDescriptionId(
        row.id
      );


      try {

        const {
          error,
        } =
          await supabase
            .from(
              'lookahead_sheet_rows'
            )
            .update({

              description:
                nextValue,

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              'id',
              row.id
            );


        if (
          error
        ) {
          throw error;
        }


        setSheetRows(
          (
            current
          ) =>
            current.map(
              (
                currentRow
              ) =>
                currentRow.id ===
                row.id
                  ? {
                      ...currentRow,

                      description:
                        nextValue,
                    }
                  : currentRow
            )
        );

      } catch (error) {

        console.error(
          'Lookahead description:',
          error
        );


        setErrorMessage(
          error.message ||
          'The row description could not be saved.'
        );

      } finally {

        setSavingDescriptionId(
          ''
        );

      }

    };


  // ==========================================================
  // INSERT ROW
  // ==========================================================

  const insertRow =
    async (
      anchorRow,
      direction
    ) => {

      if (
        !selectedPlanId ||
        !anchorRow?.id ||
        insertingRow
      ) {
        return;
      }


      setInsertingRow(
        true
      );

      setOpenRowMenuId(
        ''
      );

      setErrorMessage(
        ''
      );


      try {

        const {
          error,
        } =
          await supabase.rpc(
            'insert_lookahead_sheet_row',
            {

              target_lookahead_plan_id:
                selectedPlanId,

              target_anchor_row_id:
                anchorRow.id,

              target_direction:
                direction,
            }
          );


        if (
          error
        ) {
          throw error;
        }


        await loadWorkspace(
          selectedPlanId
        );

      } catch (error) {

        console.error(
          'Insert Lookahead row:',
          error
        );


        setErrorMessage(
          error.message ||
          'The row could not be inserted.'
        );

      } finally {

        setInsertingRow(
          false
        );

      }

    };


  // ==========================================================
  // GET GROUPED KOSKELA STATUS
  // ==========================================================

  const getGroupedReadiness =
    useCallback(
      (
        sheetRowId,
        category
      ) => {

        if (
          !sheetRowId ||
          !category
        ) {
          return 'not_assessed';
        }


        return (
          readiness[
            `${sheetRowId}___${category}`
          ]?.status ||
          'not_assessed'
        );

      },
      [
        readiness,
      ]
    );


  // ==========================================================
  // UPDATE GROUPED KOSKELA STATUS
  // ==========================================================

  const handleGroupedReadinessChange =
    async (
      row,
      category,
      nextStatus
    ) => {

      if (
        !row?.id ||
        !category
      ) {
        return;
      }


      const readinessKey =
        `${row.id}___${category}`;


      setSavingGroupedReadiness(
        readinessKey
      );

      setErrorMessage(
        ''
      );


      const previousReadiness =
        {
          ...readiness,
        };


      // ------------------------------------------------------
      // OPTIMISTIC UI
      // ------------------------------------------------------

      setReadiness(
        (
          current
        ) => ({

          ...current,

          [readinessKey]: {

            ...current[
              readinessKey
            ],

            sheet_row_id:
              row.id,

            category,

            status:
              nextStatus,
          },
        })
      );


      try {

        const existing =
          readiness[
            readinessKey
          ];


        if (
          existing?.id
        ) {

          const {
            error,
          } =
            await supabase
              .from(
                'lookahead_sheet_readiness_assessments'
              )
              .update({

                status:
                  nextStatus,

                updated_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                'id',
                existing.id
              );


          if (
            error
          ) {
            throw error;
          }

        } else {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'lookahead_sheet_readiness_assessments'
              )
              .upsert(
                {

                  sheet_row_id:
                    row.id,

                  category,

                  status:
                    nextStatus,

                  updated_at:
                    new Date()
                      .toISOString(),
                },
                {

                  onConflict:
                    'sheet_row_id,category',
                }
              )
              .select(`
                id,
                sheet_row_id,
                category,
                status
              `)
              .single();


          if (
            error
          ) {
            throw error;
          }


          setReadiness(
            (
              current
            ) => ({

              ...current,

              [readinessKey]: {

                id:
                  data.id,

                sheet_row_id:
                  data.sheet_row_id,

                category:
                  data.category,

                status:
                  normalizeReadinessStatus(
                    data.status
                  ),
              },
            })
          );

        }

      } catch (error) {

        console.error(
          'Grouped Koskela readiness:',
          error
        );


        setReadiness(
          previousReadiness
        );


        setErrorMessage(
          error.message ||
          'The Koskela assessment could not be saved.'
        );

      } finally {

        setSavingGroupedReadiness(
          ''
        );

      }

    };


  // ==========================================================
  // GROUPED CONSTRAINTS
  // ==========================================================

  const constrainedCells =
    useMemo(
      () => {

        const result =
          [];


        sheetRows.forEach(
          (
            row
          ) => {

            KOSKELA_COLUMNS.forEach(
              (
                column
              ) => {

                const assessment =
                  readiness[
                    `${row.id}___${column.key}`
                  ];


                if (
                  assessment
                    ?.status ===
                  'constrained'
                ) {

                  result.push({

                    row,

                    column,

                    assessment,
                  });

                }

              }
            );

          }
        );


        return result;

      },
      [
        sheetRows,
        readiness,
      ]
    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      style={{

        padding:
          '18px 20px 40px',

        minHeight:
          '100%',

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
          marginBottom:
            '18px',
        }}
      >

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
          LOOKAHEAD (MEDIUM TERM) &amp; KOSKELA MATRIX
        </h1>

      </div>


      {/* ====================================================
          CONTROLS
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
            '14px',
        }}
      >

        {/* PROJECT */}

        <div
          style={{
            minWidth:
              '250px',
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
            ) => {

              const projectId =
                event.target
                  .value;


              setSelectedProjectId(
                projectId
              );


              if (
                projectId
              ) {

                window.history
                  .replaceState(
                    {},
                    '',
                    `/dashboard/projetos/lookahead?projectId=${projectId}`
                  );

              }

            }}

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


        {/* LOOKAHEAD PLAN */}

        <div
          style={{
            minWidth:
              '280px',
          }}
        >

          <label
            style={
              labelStyle
            }
          >
            Scenario / Version (Lookahead)
          </label>


          <select

            value={
              selectedPlanId
            }

            disabled={
              !selectedProjectId
            }

            onChange={(
              event
            ) =>
              handlePlanChange(
                event.target
                  .value
              )
            }

            style={
              selectStyle
            }
          >

            <option value="">
              -- Select --
            </option>


            {plans.map(
              (
                plan
              ) => (

                <option
                  key={
                    plan.id
                  }

                  value={
                    plan.id
                  }
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


        {/* SAVE */}

        <button
          type="button"
          disabled
          style={
            disabledButtonStyle
          }
        >
          💾 Save
        </button>


        {/* INSERT PACKAGE */}

        <button

          type="button"

          disabled={
            !selectedPlanId
          }

          onClick={() => {

            alert(
              'Insert Package will be activated in the next scheduling step.'
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


        {/* UNDO */}

        <button
          type="button"
          disabled
          style={
            disabledButtonStyle
          }
        >
          Undo
        </button>


        {/* HOLIDAYS */}

        <button

          type="button"

          onClick={() => {

            if (
              masterPlanHolidays.length ===
              0
            ) {

              alert(
                'No holidays are registered in the originating Master Plan.'
              );

              return;

            }


            const message =
              masterPlanHolidays
                .map(
                  (
                    holiday
                  ) =>
                    `${holiday.data || holiday.date} · ${
                      holiday.descricao ||
                      holiday.description ||
                      'Holiday'
                    }`
                )
                .join(
                  '\n'
                );


            alert(
              `Master Plan Holidays\n\n${message}`
            );

          }}

          style={
            masterPlanHolidays.length >
            0
              ? holidayButtonStyle
              : secondaryButtonStyle
          }
        >

          📅 Holidays

          {masterPlanHolidays.length >
          0
            ? ` (${masterPlanHolidays.length})`
            : ''}

        </button>


        {/* WEEKENDS */}

        <button

          type="button"

          onClick={() =>
            setShowWeekends(
              (
                current
              ) =>
                !current
            )
          }

          style={
            secondaryButtonStyle
          }
        >

          {showWeekends
            ? 'Hide Weekends'
            : 'Show Weekends'}

        </button>


        {/* START */}

        <div>

          <label
            style={
              labelStyle
            }
          >
            Start of Week 1
          </label>


          <input

            type="date"

            value={
              windowStart
            }

            onChange={(
              event
            ) =>
              setWindowStart(
                event.target
                  .value
              )
            }

            style={
              inputStyle
            }
          />

        </div>


        {/* HORIZON */}

        <div>

          <label
            style={
              labelStyle
            }
          >
            Horizon
          </label>


          <select

            value={
              horizonWeeks
            }

            onChange={(
              event
            ) =>
              setHorizonWeeks(
                Number(
                  event.target
                    .value
                )
              )
            }

            style={
              inputStyle
            }
          >

            {[
              2,
              3,
              4,
              5,
              6,
              8,
              10,
              12,
            ].map(
              (
                weeks
              ) => (

                <option
                  key={
                    weeks
                  }

                  value={
                    weeks
                  }
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

            marginBottom:
              '12px',

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
              '12px',
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

          display:
            'flex',

          gap:
            '4px',

          marginTop:
            '8px',
        }}
      >

        <button

          type="button"

          onClick={() =>
            setActiveTab(
              'sheet'
            )
          }

          style={
            activeTab ===
            'sheet'
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
                '12px',
            }}
          >
            Select a project to open the Lookahead.
          </div>

        </div>

      )}


      {/* ====================================================
          LOOKAHEAD SHEET
      ===================================================== */}

      {selectedProjectId &&
        selectedPlanId &&
        activeTab ===
          'sheet' && (

          <div
            style={{

              overflowX:
                'auto',

              overflowY:
                'visible',

              border:
                '1px solid #cbd5e1',

              background:
                '#fff',
            }}
          >

            {loading ? (

              <div
                style={{

                  padding:
                    '40px',

                  textAlign:
                    'center',

                  color:
                    '#64748b',
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
                    ACTION_WIDTH +
                    ID_WIDTH +
                    PACKAGE_WIDTH +
                    DESCRIPTION_WIDTH +
                    visibleDays.length *
                      DAY_WIDTH +
                    KOSKELA_COLUMNS.length *
                      KOSKELA_WIDTH,

                  width:
                    '100%',

                  tableLayout:
                    'fixed',

                  fontSize:
                    '10px',
                }}
              >

                {/* ============================================
                    HEADER
                ============================================= */}

                <thead>

                  {/* WEEK HEADER */}

                  <tr>

                    <th

                      rowSpan={
                        3
                      }

                      style={{

                        ...headerCellStyle,

                        width:
                          ACTION_WIDTH,

                        minWidth:
                          ACTION_WIDTH,
                      }}
                    />


                    <th

                      rowSpan={
                        3
                      }

                      style={{

                        ...headerCellStyle,

                        width:
                          ID_WIDTH,

                        minWidth:
                          ID_WIDTH,
                      }}
                    >
                      ID
                    </th>


                    <th

                      rowSpan={
                        3
                      }

                      style={{

                        ...headerCellStyle,

                        width:
                          PACKAGE_WIDTH,

                        minWidth:
                          PACKAGE_WIDTH,
                      }}
                    >
                      PACKAGE
                    </th>


                    <th

                      rowSpan={
                        3
                      }

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
                      (
                        week
                      ) => (

                        <th

                          key={
                            week.weekNumber
                          }

                          colSpan={
                            week.days
                              .length
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
                      }}
                    >
                      KOSKELA FLOW MATRIX
                    </th>

                  </tr>


                  {/* DAY NAME */}

                  <tr>

                    {visibleDays.map(
                      (
                        day
                      ) => (

                        <th

                          key={`weekday-${day.iso}`}

                          title={
                            day.isHoliday
                              ? day.holidayDescription
                              : ''
                          }

                          style={{

                            ...calendarHeaderStyle,

                            background:
                              day.isHoliday
                                ? '#fee2e2'
                                : day.isWeekend
                                  ? '#e2e8f0'
                                  : '#f8fafc',

                            color:
                              day.isHoliday
                                ? '#991b1b'
                                : '#334155',
                          }}
                        >

                          {day.isHoliday
                            ? 'HOL'
                            : getDayLabel(
                                day.date
                              )}

                        </th>

                      )
                    )}


                    {KOSKELA_COLUMNS.map(
                      (
                        column
                      ) => (

                        <th

                          key={
                            column.key
                          }

                          rowSpan={
                            2
                          }

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
                      (
                        day
                      ) => (

                        <th

                          key={`date-${day.iso}`}

                          title={
                            day.isHoliday
                              ? day.holidayDescription
                              : ''
                          }

                          style={{

                            ...calendarHeaderStyle,

                            background:
                              day.isHoliday
                                ? '#fecaca'
                                : day.isWeekend
                                  ? '#e2e8f0'
                                  : '#ffffff',

                            color:
                              day.isHoliday
                                ? '#991b1b'
                                : '#334155',
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


                {/* ============================================
                    BODY
                ============================================= */}

                <tbody>

                  {sheetRows.map(
                    (
                      row,
                      index
                    ) => {

                      const code =
                        String(
                          row.package_code ||
                          ''
                        )
                          .trim()
                          .toUpperCase();


                      const occurrences =
                        code
                          ? workItemsByPackage[
                              code
                            ] ||
                            []
                          : [];


                      const color =
                        getServiceColor(
                          code
                        );


                      const textColor =
                        getTextColor(
                          color
                        );


                      return (

                        <tr
                          key={
                            row.id
                          }
                        >

                          {/* ==================================
                              ROW MENU
                          =================================== */}

                          <td
                            style={{

                              ...bodyCellStyle,

                              width:
                                ACTION_WIDTH,

                              minWidth:
                                ACTION_WIDTH,

                              padding:
                                0,

                              position:
                                'relative',
                            }}
                          >

                            <button

                              type="button"

                              onClick={() =>
                                setOpenRowMenuId(
                                  (
                                    current
                                  ) =>
                                    current ===
                                    row.id
                                      ? ''
                                      : row.id
                                )
                              }

                              style={{

                                width:
                                  '100%',

                                height:
                                  '34px',

                                border:
                                  0,

                                background:
                                  'transparent',

                                color:
                                  '#64748b',

                                fontSize:
                                  '17px',

                                cursor:
                                  'pointer',
                              }}

                              title="Row actions"
                            >
                              ⋮
                            </button>


                            {openRowMenuId ===
                              row.id && (

                              <div
                                style={{

                                  position:
                                    'absolute',

                                  top:
                                    '30px',

                                  left:
                                    '4px',

                                  zIndex:
                                    100,

                                  minWidth:
                                    '150px',

                                  padding:
                                    '4px',

                                  border:
                                    '1px solid #cbd5e1',

                                  borderRadius:
                                    '6px',

                                  background:
                                    '#ffffff',

                                  boxShadow:
                                    '0 8px 24px rgba(15,23,42,0.15)',
                                }}
                              >

                                <button

                                  type="button"

                                  disabled={
                                    insertingRow
                                  }

                                  onClick={() =>
                                    insertRow(
                                      row,
                                      'above'
                                    )
                                  }

                                  style={
                                    menuButtonStyle
                                  }
                                >
                                  Insert Row Above
                                </button>


                                <button

                                  type="button"

                                  disabled={
                                    insertingRow
                                  }

                                  onClick={() =>
                                    insertRow(
                                      row,
                                      'below'
                                    )
                                  }

                                  style={
                                    menuButtonStyle
                                  }
                                >
                                  Insert Row Below
                                </button>

                              </div>

                            )}

                          </td>


                          {/* ID */}

                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            {index + 1}
                          </td>


                          {/* PACKAGE */}

                          <td
                            style={{

                              ...bodyCellStyle,

                              width:
                                PACKAGE_WIDTH,

                              minWidth:
                                PACKAGE_WIDTH,

                              padding:
                                '4px',
                            }}
                          >

                            {code ? (

                              <span
                                style={{

                                  display:
                                    'inline-block',

                                  minWidth:
                                    '38px',

                                  padding:
                                    '4px 6px',

                                  borderRadius:
                                    '4px',

                                  background:
                                    color,

                                  color:
                                    textColor,

                                  fontSize:
                                    '10px',

                                  fontWeight:
                                    900,

                                  textAlign:
                                    'center',
                                }}
                              >
                                {code}
                              </span>

                            ) : (

                              <span
                                style={{

                                  color:
                                    '#94a3b8',

                                  fontWeight:
                                    700,
                                }}
                              >
                                —
                              </span>

                            )}

                          </td>


                          {/* DESCRIPTION */}

                          <td
                            style={{

                              ...bodyCellStyle,

                              width:
                                DESCRIPTION_WIDTH,

                              minWidth:
                                DESCRIPTION_WIDTH,

                              padding:
                                '4px 6px',

                              textAlign:
                                'left',
                            }}
                          >

                            <input

                              type="text"

                              value={
                                descriptionDrafts[
                                  row.id
                                ] ||
                                ''
                              }

                              placeholder={
                                row.row_type ===
                                'manual'
                                  ? 'Enter Lookahead description...'
                                  : 'Description'
                              }

                              onChange={(
                                event
                              ) => {

                                const value =
                                  event.target
                                    .value;


                                setDescriptionDrafts(
                                  (
                                    current
                                  ) => ({

                                    ...current,

                                    [row.id]:
                                      value,
                                  })
                                );

                              }}

                              onBlur={() =>
                                saveRowDescription(
                                  row
                                )
                              }

                              onKeyDown={(
                                event
                              ) => {

                                if (
                                  event.key ===
                                  'Enter'
                                ) {

                                  event.currentTarget
                                    .blur();

                                }

                              }}

                              disabled={
                                savingDescriptionId ===
                                row.id
                              }

                              style={{

                                width:
                                  '100%',

                                minWidth:
                                  0,

                                padding:
                                  '5px 6px',

                                border:
                                  '1px solid transparent',

                                borderRadius:
                                  '4px',

                                background:
                                  savingDescriptionId ===
                                  row.id
                                    ? '#f8fafc'
                                    : '#ffffff',

                                color:
                                  '#1e293b',

                                fontSize:
                                  '10px',

                                fontWeight:
                                  600,

                                outline:
                                  'none',
                              }}

                              onFocus={(
                                event
                              ) => {

                                event.currentTarget
                                  .style
                                  .borderColor =
                                  '#94a3b8';


                                event.currentTarget
                                  .style
                                  .background =
                                  '#f8fafc';

                              }}

                              onBlurCapture={(
                                event
                              ) => {

                                event.currentTarget
                                  .style
                                  .borderColor =
                                  'transparent';


                                event.currentTarget
                                  .style
                                  .background =
                                  '#ffffff';

                              }}
                            />


                            {occurrences.length >
                              0 && (

                              <div
                                style={{

                                  marginTop:
                                    '2px',

                                  paddingLeft:
                                    '6px',

                                  color:
                                    '#94a3b8',

                                  fontSize:
                                    '8px',
                                }}
                              >

                                {occurrences.length}{' '}
                                package occurrence

                                {occurrences.length ===
                                1
                                  ? ''
                                  : 's'}

                              </div>

                            )}

                          </td>


                          {/* ==================================
                              TIMELINE
                          =================================== */}

                          {visibleDays.map(
                            (
                              day
                            ) => {

                              const activeOccurrences =
                                occurrences.filter(
                                  (
                                    item
                                  ) => {

                                    const dates =
                                      getPackageDates(
                                        item
                                      );


                                    return (
                                      dates.start &&
                                      dates.finish &&
                                      day.iso >=
                                        dates.start &&
                                      day.iso <=
                                        dates.finish
                                    );

                                  }
                                );


                              const active =
                                activeOccurrences.length >
                                0;


                              const tooltip =
                                activeOccurrences
                                  .map(
                                    (
                                      item
                                    ) =>
                                      `${code} · ${getLocationName(
                                        item
                                      )}`
                                  )
                                  .join(
                                    '\n'
                                  );


                              return (

                                <td

                                  key={`${row.id}-${day.iso}`}

                                  title={
                                    day.isHoliday
                                      ? `${day.holidayDescription}${
                                          tooltip
                                            ? `\n${tooltip}`
                                            : ''
                                        }`
                                      : tooltip ||
                                        day.iso
                                  }

                                  style={{

                                    ...bodyCellStyle,

                                    width:
                                      DAY_WIDTH,

                                    minWidth:
                                      DAY_WIDTH,

                                    height:
                                      '34px',

                                    padding:
                                      0,

                                    background:
                                      active
                                        ? color
                                        : day.isHoliday
                                          ? '#fee2e2'
                                          : day.isWeekend
                                            ? '#f1f5f9'
                                            : '#ffffff',

                                    color:
                                      active
                                        ? textColor
                                        : day.isHoliday
                                          ? '#991b1b'
                                          : '#94a3b8',

                                    fontWeight:
                                      active
                                        ? 800
                                        : 400,

                                    cursor:
                                      active
                                        ? 'pointer'
                                        : 'default',

                                    boxShadow:
                                      day.isHoliday
                                        ? 'inset 0 0 0 1px #fca5a5'
                                        : 'none',
                                  }}
                                >

                                  {active
                                    ? code
                                    : day.isHoliday
                                      ? 'HOL'
                                      : ''}

                                </td>

                              );

                            }
                          )}


                          {/* ==================================
                              GROUPED KOSKELA MATRIX
                          =================================== */}

                          {KOSKELA_COLUMNS.map(
                            (
                              column
                            ) => {

                              const status =
                                getGroupedReadiness(
                                  row.id,
                                  column.key
                                );


                              const style =
                                readinessStyle(
                                  status
                                );


                              const savingKey =
                                `${row.id}___${column.key}`;


                              const disabled =
                                savingGroupedReadiness ===
                                savingKey;


                              return (

                                <td

                                  key={`${row.id}-${column.key}`}

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
                                      disabled
                                    }

                                    onChange={(
                                      event
                                    ) =>
                                      handleGroupedReadinessChange(
                                        row,
                                        column.key,
                                        event.target
                                          .value
                                      )
                                    }

                                    title={`Grouped Koskela assessment for ${
                                      code ||
                                      'this Lookahead row'
                                    }.`}

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

                                      cursor:
                                        disabled
                                          ? 'not-allowed'
                                          : 'pointer',

                                      opacity:
                                        disabled
                                          ? 0.65
                                          : 1,
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

                </tbody>

              </table>

            )}


            {/* ==================================================
                LEGEND
            =================================================== */}

            <div
              style={{

                display:
                  'flex',

                alignItems:
                  'center',

                gap:
                  '18px',

                flexWrap:
                  'wrap',

                padding:
                  '10px 12px',

                borderTop:
                  '1px solid #cbd5e1',

                fontSize:
                  '9px',
              }}
            >

              <strong>
                LEGEND:
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
                🟥 HOL - Master Plan Holiday
              </span>


              <span>
                Each row = one Work Package
              </span>


              <span>
                Koskela = grouped package assessment
              </span>

            </div>

          </div>

        )}


      {/* ====================================================
          GROUPED CONSTRAINT DETAILS
      ===================================================== */}

      {selectedProjectId &&
        selectedPlanId &&
        activeTab ===
          'constraints' && (

          <div
            style={{

              border:
                '1px solid #cbd5e1',

              background:
                '#fff',
            }}
          >

            <div
              style={{

                padding:
                  '12px 14px',

                borderBottom:
                  '1px solid #e2e8f0',

                fontWeight:
                  800,

                fontSize:
                  '12px',
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

                  width:
                    '100%',

                  borderCollapse:
                    'collapse',

                  fontSize:
                    '10px',
                }}
              >

                <thead>

                  <tr>

                    <th
                      style={
                        headerCellStyle
                      }
                    >
                      PACKAGE
                    </th>


                    <th
                      style={
                        headerCellStyle
                      }
                    >
                      DESCRIPTION
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
                      row,
                      column,
                      assessment,
                    }) => (

                      <tr
                        key={
                          assessment.id ||
                          `${row.id}-${column.key}`
                        }
                      >

                        <td
                          style={
                            bodyCellStyle
                          }
                        >
                          {row.package_code ||
                            '—'}
                        </td>


                        <td
                          style={{
                            ...bodyCellStyle,
                            textAlign:
                              'left',
                          }}
                        >
                          {row.description ||
                            '—'}
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

                          {row.row_type ===
                          'manual'
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
          NO PLAN
      ===================================================== */}

      {selectedProjectId &&
        !selectedPlanId &&
        !loading && (

          <div
            style={
              emptyStyle
            }
          >
            This project does not have a Lookahead plan yet.
          </div>

        )}

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
    '#fff',
};


const inputStyle = {

  height:
    '36px',

  padding:
    '0 8px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#fff',
};


const headerCellStyle = {

  border:
    '1px solid #cbd5e1',

  padding:
    '5px 4px',

  background:
    '#f8fafc',

  color:
    '#334155',

  textAlign:
    'center',

  fontSize:
    '9px',

  fontWeight:
    800,
};


const calendarHeaderStyle = {

  ...headerCellStyle,

  width:
    DAY_WIDTH,

  minWidth:
    DAY_WIDTH,

  padding:
    '3px 1px',

  fontSize:
    '8px',
};


const bodyCellStyle = {

  border:
    '1px solid #e2e8f0',

  padding:
    '3px',

  background:
    '#fff',

  color:
    '#334155',

  textAlign:
    'center',

  verticalAlign:
    'middle',
};


const primaryButtonStyle = {

  height:
    '36px',

  padding:
    '0 12px',

  border:
    '1px solid #2563eb',

  borderRadius:
    '6px',

  background:
    '#2563eb',

  color:
    '#fff',

  fontSize:
    '11px',

  fontWeight:
    700,

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
    '#fff',

  color:
    '#334155',

  fontSize:
    '11px',

  fontWeight:
    700,

  cursor:
    'pointer',
};


const holidayButtonStyle = {

  ...secondaryButtonStyle,

  border:
    '1px solid #fca5a5',

  background:
    '#fff1f2',

  color:
    '#b91c1c',
};


const disabledButtonStyle = {

  ...secondaryButtonStyle,

  opacity:
    0.45,

  cursor:
    'not-allowed',
};


const tabStyle = {

  padding:
    '9px 14px',

  border:
    '1px solid #cbd5e1',

  borderBottom:
    0,

  borderRadius:
    '6px 6px 0 0',

  background:
    '#e2e8f0',

  color:
    '#475569',

  fontSize:
    '10px',

  fontWeight:
    700,

  cursor:
    'pointer',
};


const activeTabStyle = {

  ...tabStyle,

  background:
    '#fff',

  color:
    '#0f172a',
};


const menuButtonStyle = {

  display:
    'block',

  width:
    '100%',

  padding:
    '7px 8px',

  border:
    0,

  borderRadius:
    '4px',

  background:
    '#ffffff',

  color:
    '#334155',

  textAlign:
    'left',

  fontSize:
    '10px',

  fontWeight:
    600,

  cursor:
    'pointer',
};


const emptyStyle = {

  padding:
    '50px 20px',

  border:
    '1px solid #e2e8f0',

  background:
    '#fff',

  textAlign:
    'center',

  color:
    '#64748b',

  fontSize:
    '12px',
};
