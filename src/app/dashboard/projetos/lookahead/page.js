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
// - Automatic rows come ONLY from Master Plan-backed work items.
// - Individual Master Plan occurrences remain separate.
// - Multiple locations of the same Master Plan package are shown on one row.
// - Additional work appears only when the user creates a manual row.
//
// Manual rows:
// - User can insert a row above or below.
// - User-created manual rows can be deleted.
// - Manual rows select from the organization Work Package Library.
// - The Work Package UUID is the permanent identity.
// - Selecting a package does NOT change the Master Plan.
//
// Koskela:
// - Assessment belongs to the GROUPED sheet row.
// - One package row = one assessment per Koskela category.
// ============================================================


const ACTION_WIDTH = 34;
const ID_WIDTH = 38;
const PACKAGE_WIDTH = 100;
const DESCRIPTION_WIDTH = 250;
const DAY_WIDTH = 38;
const KOSKELA_WIDTH = 128;


const KOSKELA_COLUMNS = [
  { key: 'projects_information', label: 'Projects / Information' },
  { key: 'materials', label: 'Materials' },
  { key: 'labor', label: 'Labor' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'space', label: 'Space' },
  { key: 'predecessor', label: 'Predecessor' },
  { key: 'external_conditions', label: 'External Conditions' },
];




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
  code,
  workPackageCatalog = []
) {
  const normalizedCode =
    String(code || '')
      .trim()
      .toUpperCase();

  return (
    workPackageCatalog.find(
      (item) =>
        String(item.code || '')
          .trim()
          .toUpperCase() ===
        normalizedCode
    )?.color ||
    '#64748b'
  );
}


function getTextColor(
  background
) {
  const hex =
    String(
      background || ''
    ).replace(
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
      hex.slice(0, 2),
      16
    );

  const g =
    parseInt(
      hex.slice(2, 4),
      16
    );

  const b =
    parseInt(
      hex.slice(4, 6),
      16
    );

  const yiq =
    (
      r * 299 +
      g * 587 +
      b * 114
    ) / 1000;

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
    organizationWorkPackages,
    setOrganizationWorkPackages,
  ] = useState([]);


  const [
    manualTimelineCells,
    setManualTimelineCells,
  ] = useState({});


  const [
    openTimelineCellKey,
    setOpenTimelineCellKey,
  ] = useState('');


  const [
    savingTimelineCellKey,
    setSavingTimelineCellKey,
  ] = useState('');


  const [
    descriptionDrafts,
    setDescriptionDrafts,
  ] = useState({});


  const [
    packageDrafts,
    setPackageDrafts,
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
    savingPackageRowId,
    setSavingPackageRowId,
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
    openPackageDropdownRowId,
    setOpenPackageDropdownRowId,
  ] = useState('');


  const [
    insertingRow,
    setInsertingRow,
  ] = useState(false);


  const [
    deletingRowId,
    setDeletingRowId,
  ] = useState('');


  const [
    showInsertPackageModal,
    setShowInsertPackageModal,
  ] = useState(false);


  const [
    insertPackageWorkPackageId,
    setInsertPackageWorkPackageId,
  ] = useState('');


  const [
    insertPackageLineId,
    setInsertPackageLineId,
  ] = useState('');


  const [
    insertPackageStartDate,
    setInsertPackageStartDate,
  ] = useState('');


  const [
    insertPackageDuration,
    setInsertPackageDuration,
  ] = useState(1);


  const [
    insertingPackage,
    setInsertingPackage,
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
  // LOAD MASTER PLAN REFERENCE DATA
  // ==========================================================

  const loadMasterPlanReferenceData =
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

          // --------------------------------------------------
          // MASTER PLAN HOLIDAYS
          // --------------------------------------------------

          const {
            data:
              scenarioData,
            error:
              scenarioError,
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


          if (
            scenarioError
          ) {
            throw scenarioError;
          }


          const holidays =
            Array.isArray(
              scenarioData
                ?.plan_data
                ?.holidays
            )
              ? scenarioData
                  .plan_data
                  .holidays
              : [];


          setMasterPlanHolidays(
            holidays
          );

        } catch (error) {

          console.error(
            'Lookahead - Master Plan reference data:',
            error
          );


          setMasterPlanHolidays(
            []
          );


          setErrorMessage(
            error.message ||
            'Master Plan reference data could not be loaded.'
          );

        }

      },
      []
    );


  // ==========================================================
  // LOAD ORGANIZATION WORK PACKAGE LIBRARY
  // ==========================================================

  const loadOrganizationWorkPackages =
    useCallback(
      async (
        organizationId
      ) => {

        if (!organizationId) {
          setOrganizationWorkPackages([]);
          return;
        }

        try {
          const {
            data,
            error,
          } =
            await supabase.rpc(
              'get_organization_work_package_catalog',
              {
                target_organization_id:
                  organizationId,
              }
            );

          if (error) {
            throw error;
          }

          setOrganizationWorkPackages(
            (data || []).filter(
              (item) =>
                item.is_active
            )
          );

        } catch (error) {
          console.error(
            'Lookahead - Work Package Library:',
            error
          );

          setOrganizationWorkPackages([]);

          setErrorMessage(
            error.message ||
            'The company Work Package Library could not be loaded.'
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
          setPackageDrafts({});
          setManualTimelineCells({});

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
            )
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
                      null,
                  };

                }
              )
              .filter(
                (item) =>
                  Boolean(
                    item.master_plan_package_id
                  )
              );


          // Automatic Lookahead content comes only from Master Plan.
          // Additional work is added explicitly through manual rows.
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
                organization_work_package_id,
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


          const masterPlanPackageCodes =
            new Set(
              normalizedItems
                .map(
                  (item) =>
                    getPackageCode(
                      item
                    )
                )
                .filter(
                  Boolean
                )
            );


          const loadedRows =
            (
              rows ||
              []
            ).filter(
              (row) => {

                if (
                  row.row_type ===
                  'manual'
                ) {
                  return true;
                }


                if (
                  row.row_type !==
                  'package_group'
                ) {
                  return true;
                }


                const rowCode =
                  String(
                    row.package_code ||
                    ''
                  )
                    .trim()
                    .toUpperCase();


                return (
                  rowCode &&
                  masterPlanPackageCodes.has(
                    rowCode
                  )
                );

              }
            );


          // Safety net: package_group rows render only when backed
          // by a Master Plan-derived Lookahead work item.
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


          const nextPackageDrafts =
            {};


          loadedRows.forEach(
            (row) => {

              nextPackageDrafts[
                row.id
              ] =
                String(
                  row.package_code ||
                  ''
                )
                  .trim()
                  .toUpperCase();

            }
          );


          setPackageDrafts(
            nextPackageDrafts
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



          // --------------------------------------------------
          // MANUAL LOOKAHEAD TIMELINE CELLS
          // --------------------------------------------------

          const {
            data:
              manualCells,
            error:
              manualCellsError,
          } =
            await supabase.rpc(
              'get_lookahead_manual_timeline_cells',
              {
                target_lookahead_plan_id:
                  planId,
              }
            );


          if (
            manualCellsError
          ) {
            throw manualCellsError;
          }


          const manualCellMap =
            {};


          (
            manualCells ||
            []
          ).forEach(
            (
              cell
            ) => {

              manualCellMap[
                `${cell.sheet_row_id}___${cell.work_date}`
              ] = cell;

            }
          );


          setManualTimelineCells(
            manualCellMap
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

      loadMasterPlanReferenceData(
        selectedPlan
          ?.master_plan_scenario_id ||
        null
      );

    },
    [
      selectedPlan
        ?.master_plan_scenario_id,
      loadMasterPlanReferenceData,
    ]
  );


  useEffect(
    () => {

      loadOrganizationWorkPackages(
        selectedProject
          ?.organization_id ||
        null
      );

    },
    [
      selectedProject
        ?.organization_id,
      loadOrganizationWorkPackages,
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
  // MANUAL ROW WORK PACKAGE
  // ==========================================================

  const selectManualRowWorkPackage =
    async (
      row,
      organizationWorkPackageId
    ) => {

      if (
        !row?.id ||
        row.row_type !== 'manual'
      ) {
        return;
      }

      const selectedPackage =
        organizationWorkPackages.find(
          (item) =>
            item.id === organizationWorkPackageId
        ) || null;

      setSavingPackageRowId(row.id);
      setErrorMessage('');

      try {
        const {
          error,
        } =
          await supabase
            .from('lookahead_sheet_rows')
            .update({
              organization_work_package_id:
                selectedPackage?.id || null,
              package_code:
                selectedPackage?.code || null,
              updated_at:
                new Date().toISOString(),
            })
            .eq('id', row.id)
            .eq('lookahead_plan_id', selectedPlanId)
            .eq('row_type', 'manual');

        if (error) {
          throw error;
        }

        setSheetRows(
          (current) =>
            current.map(
              (currentRow) =>
                currentRow.id === row.id
                  ? {
                      ...currentRow,
                      organization_work_package_id:
                        selectedPackage?.id || null,
                      package_code:
                        selectedPackage?.code || null,
                    }
                  : currentRow
            )
        );

        setPackageDrafts(
          (current) => ({
            ...current,
            [row.id]:
              selectedPackage?.code || '',
          })
        );

      } catch (error) {
        console.error(
          'Lookahead Work Package selection:',
          error
        );

        setErrorMessage(
          error.message ||
          'The Work Package could not be assigned to this Lookahead row.'
        );

      } finally {
        setSavingPackageRowId('');
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
  // INSERT PACKAGE
  //
  // User provides:
  // - Work Package
  // - Line ID
  // - Start Date
  // - Duration (working days)
  //
  // SQL 89 creates the manual row and populates the timeline
  // atomically. Master Plan is never modified.
  // ==========================================================

  const openInsertPackageModal =
    () => {

      if (
        !selectedPlanId
      ) {
        return;
      }


      setInsertPackageWorkPackageId(
        ''
      );


      setInsertPackageLineId(
        String(
          sheetRows.length + 1
        )
      );


      setInsertPackageStartDate(
        windowStart ||
        selectedPlan?.window_start_date ||
        ''
      );


      setInsertPackageDuration(
        1
      );


      setErrorMessage(
        ''
      );


      setShowInsertPackageModal(
        true
      );

    };


  const submitInsertPackage =
    async (
      event
    ) => {

      event.preventDefault();


      if (
        !selectedPlanId ||
        !insertPackageWorkPackageId ||
        !insertPackageLineId ||
        !insertPackageStartDate ||
        !insertPackageDuration ||
        insertingPackage
      ) {
        return;
      }


      const lineId =
        Number(
          insertPackageLineId
        );


      const duration =
        Number(
          insertPackageDuration
        );


      if (
        !Number.isInteger(
          lineId
        ) ||
        lineId < 1
      ) {

        setErrorMessage(
          'Line ID must be a valid row number.'
        );

        return;

      }


      if (
        !Number.isInteger(
          duration
        ) ||
        duration < 1
      ) {

        setErrorMessage(
          'Duration must be at least 1 working day.'
        );

        return;

      }


      setInsertingPackage(
        true
      );

      setErrorMessage(
        ''
      );


      try {

        const {
          error,
        } =
          await supabase.rpc(
            'insert_lookahead_manual_package',
            {

              target_lookahead_plan_id:
                selectedPlanId,

              target_organization_work_package_id:
                insertPackageWorkPackageId,

              target_line_id:
                lineId,

              target_start_date:
                insertPackageStartDate,

              target_duration_working_days:
                duration,
            }
          );


        if (
          error
        ) {
          throw error;
        }


        setShowInsertPackageModal(
          false
        );


        await loadWorkspace(
          selectedPlanId
        );

      } catch (error) {

        console.error(
          'Insert Lookahead package:',
          error
        );


        setErrorMessage(
          error.message ||
          'The Lookahead package could not be inserted.'
        );

      } finally {

        setInsertingPackage(
          false
        );

      }

    };


  // ==========================================================
  // DELETE USER-CREATED MANUAL ROW
  // ==========================================================

  const deleteManualRow =
    async (
      row
    ) => {

      if (
        !selectedPlanId ||
        !row?.id ||
        row.row_type !== 'manual' ||
        deletingRowId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          'Delete this user-created Lookahead row? Its grouped Koskela assessments will also be removed.'
        );

      if (!confirmed) {
        return;
      }

      setDeletingRowId(row.id);
      setOpenRowMenuId('');
      setErrorMessage('');

      try {
        const {
          error,
        } =
          await supabase.rpc(
            'delete_lookahead_manual_sheet_row',
            {
              target_lookahead_plan_id:
                selectedPlanId,
              target_sheet_row_id:
                row.id,
            }
          );

        if (error) {
          throw error;
        }

        await loadWorkspace(
          selectedPlanId
        );

      } catch (error) {
        console.error(
          'Delete Lookahead row:',
          error
        );

        setErrorMessage(
          error.message ||
          'The user-created Lookahead row could not be deleted.'
        );

      } finally {
        setDeletingRowId('');
      }
    };


  // ==========================================================
  // MANUAL TIMELINE CELL
  //
  // Works like the Master Plan Actual-row cell:
  // - empty cell shows a small arrow
  // - open menu shows CODE + Description
  // - selected cell shows only the colored 3-letter code
  // ==========================================================

  const setManualTimelineCell =
    async (
      row,
      workDate,
      organizationWorkPackageId
    ) => {

      if (
        !row?.id ||
        row.row_type !==
          'manual' ||
        !workDate
      ) {
        return;
      }


      const cellKey =
        `${row.id}___${workDate}`;


      setSavingTimelineCellKey(
        cellKey
      );

      setOpenTimelineCellKey(
        ''
      );

      setErrorMessage(
        ''
      );


      try {

        const {
          data,
          error,
        } =
          await supabase.rpc(
            'set_lookahead_manual_timeline_cell',
            {
              target_sheet_row_id:
                row.id,

              target_work_date:
                workDate,

              target_organization_work_package_id:
                organizationWorkPackageId ||
                null,
            }
          );


        if (
          error
        ) {
          throw error;
        }


        if (
          !organizationWorkPackageId
        ) {

          setManualTimelineCells(
            (
              current
            ) => {

              const next =
                {
                  ...current,
                };


              delete next[
                cellKey
              ];


              return next;

            }
          );


          return;

        }


        const savedCell =
          Array.isArray(
            data
          )
            ? data[0]
            : data;


        const selectedPackage =
          organizationWorkPackages.find(
            (
              workPackage
            ) =>
              workPackage.id ===
              organizationWorkPackageId
          ) ||
          null;


        setManualTimelineCells(
          (
            current
          ) => ({

            ...current,

            [cellKey]: {

              ...savedCell,

              sheet_row_id:
                row.id,

              work_date:
                workDate,

              organization_work_package_id:
                organizationWorkPackageId,

              package_code:
                savedCell?.package_code ||
                selectedPackage?.code ||
                '',

              package_description:
                selectedPackage?.description ||
                '',

              package_color:
                selectedPackage?.color ||
                '#64748b',
            },
          })
        );

      } catch (error) {

        console.error(
          'Manual Lookahead timeline cell:',
          error
        );


        setErrorMessage(
          error.message ||
          'The Lookahead timeline cell could not be saved.'
        );

      } finally {

        setSavingTimelineCellKey(
          ''
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


        <button
          type="button"
          disabled
          style={
            disabledButtonStyle
          }
        >
          💾 Save
        </button>


        <button

          type="button"

          disabled={
            !selectedPlanId ||
            insertingPackage
          }

          onClick={
            openInsertPackageModal
          }

          style={
            selectedPlanId &&
            !insertingPackage
              ? primaryButtonStyle
              : disabledButtonStyle
          }
        >
          ⚡ Insert Package
        </button>


        <button
          type="button"
          disabled
          style={
            disabledButtonStyle
          }
        >
          Undo
        </button>


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

                <thead>

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

                        fontSize:
                          '10px',

                        letterSpacing:
                          '0.02em',
                      }}
                    >
                      KOSKELA FLOW MATRIX
                    </th>

                  </tr>


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

                            maxWidth:
                              KOSKELA_WIDTH,

                            padding:
                              '7px 5px',

                            whiteSpace:
                              'normal',

                            wordBreak:
                              'normal',

                            lineHeight:
                              1.15,

                            fontSize:
                              '9px',

                            textAlign:
                              'center',

                            verticalAlign:
                              'middle',
                          }}
                        >

                          {column.label}

                        </th>

                      )
                    )}

                  </tr>


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
                        row.row_type ===
                          'package_group' &&
                        code
                          ? workItemsByPackage[
                              code
                            ] ||
                            []
                          : [];


                      const color =
                        getServiceColor(code, organizationWorkPackages);


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

                          {/* ROW MENU */}

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

                              onClick={() => {

                                setOpenPackageDropdownRowId(
                                  ''
                                );


                                setOpenRowMenuId(
                                  (
                                    current
                                  ) =>
                                    current ===
                                    row.id
                                      ? ''
                                      : row.id
                                );

                              }}

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

                                {row.row_type ===
                                  'manual' && (
                                  <button
                                    type="button"

                                    disabled={
                                      deletingRowId ===
                                      row.id
                                    }

                                    onClick={() =>
                                      deleteManualRow(
                                        row
                                      )
                                    }

                                    style={{
                                      ...menuButtonStyle,
                                      color: '#b91c1c',
                                      borderTop: '1px solid #e2e8f0',
                                    }}
                                  >
                                    {deletingRowId ===
                                    row.id
                                      ? 'Deleting...'
                                      : 'Delete Row'}
                                  </button>
                                )}

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

                            {row.row_type ===
                              'manual' ? (

                              <div
                                style={{
                                  position:
                                    'relative',

                                  width:
                                    '100%',
                                }}
                              >

                                <button
                                  type="button"

                                  disabled={
                                    savingPackageRowId ===
                                    row.id
                                  }

                                  onClick={() =>
                                    setOpenPackageDropdownRowId(
                                      (
                                        current
                                      ) =>
                                        current ===
                                        row.id
                                          ? ''
                                          : row.id
                                    )
                                  }

                                  title={
                                    code
                                      ? `Selected Work Package: ${code}`
                                      : 'Select Work Package'
                                  }

                                  style={{
                                    width:
                                      '100%',

                                    height:
                                      '30px',

                                    padding:
                                      '0 6px',

                                    border:
                                      '1px solid #cbd5e1',

                                    borderRadius:
                                      '4px',

                                    background:
                                      code
                                        ? color
                                        : '#ffffff',

                                    color:
                                      code
                                        ? textColor
                                        : '#475569',

                                    fontSize:
                                      '10px',

                                    fontWeight:
                                      800,

                                    textAlign:
                                      'center',

                                    cursor:
                                      savingPackageRowId ===
                                      row.id
                                        ? 'not-allowed'
                                        : 'pointer',
                                  }}
                                >
                                  {code || 'Select...'}
                                </button>


                                {openPackageDropdownRowId ===
                                  row.id && (

                                  <div
                                    style={{
                                      position:
                                        'absolute',

                                      top:
                                        '34px',

                                      left:
                                        0,

                                      zIndex:
                                        300,

                                      width:
                                        '280px',

                                      maxHeight:
                                        '260px',

                                      overflowY:
                                        'auto',

                                      border:
                                        '1px solid #cbd5e1',

                                      borderRadius:
                                        '6px',

                                      background:
                                        '#ffffff',

                                      boxShadow:
                                        '0 12px 28px rgba(15,23,42,0.18)',
                                    }}
                                  >

                                    {organizationWorkPackages.map(
                                      (
                                        workPackage
                                      ) => {

                                        const optionColor =
                                          workPackage.color ||
                                          '#64748b';


                                        const optionTextColor =
                                          getTextColor(
                                            optionColor
                                          );


                                        return (

                                          <button
                                            key={
                                              workPackage.id
                                            }

                                            type="button"

                                            onClick={async () => {

                                              setOpenPackageDropdownRowId(
                                                ''
                                              );


                                              await selectManualRowWorkPackage(
                                                row,
                                                workPackage.id
                                              );

                                            }}

                                            style={{
                                              display:
                                                'flex',

                                              alignItems:
                                                'center',

                                              gap:
                                                '10px',

                                              width:
                                                '100%',

                                              padding:
                                                '8px 10px',

                                              border:
                                                0,

                                              borderBottom:
                                                '1px solid #f1f5f9',

                                              background:
                                                '#ffffff',

                                              color:
                                                '#0f172a',

                                              textAlign:
                                                'left',

                                              cursor:
                                                'pointer',
                                            }}
                                          >

                                            <span
                                              style={{
                                                display:
                                                  'inline-flex',

                                                alignItems:
                                                  'center',

                                                justifyContent:
                                                  'center',

                                                minWidth:
                                                  '46px',

                                                padding:
                                                  '4px 6px',

                                                borderRadius:
                                                  '4px',

                                                background:
                                                  optionColor,

                                                color:
                                                  optionTextColor,

                                                fontSize:
                                                  '10px',

                                                fontWeight:
                                                  900,
                                              }}
                                            >
                                              {workPackage.code}
                                            </span>


                                            <span
                                              style={{
                                                flex:
                                                  1,

                                                color:
                                                  '#334155',

                                                fontSize:
                                                  '10px',

                                                fontWeight:
                                                  600,

                                                whiteSpace:
                                                  'normal',
                                              }}
                                            >
                                              {workPackage.description}
                                            </span>

                                          </button>

                                        );

                                      }
                                    )}


                                    {organizationWorkPackages.length ===
                                      0 && (

                                      <div
                                        style={{
                                          padding:
                                            '12px',

                                          color:
                                            '#64748b',

                                          fontSize:
                                            '10px',

                                          textAlign:
                                            'center',
                                        }}
                                      >
                                        No active Work Packages are registered.
                                      </div>

                                    )}

                                  </div>

                                )}

                              </div>

                            ) : code ? (

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


                          {/* TIMELINE */}

                          {visibleDays.map(
                            (
                              day
                            ) => {

                              // --------------------------------
                              // MANUAL LOOKAHEAD ROW
                              // --------------------------------

                              if (
                                row.row_type ===
                                'manual'
                              ) {

                                const cellKey =
                                  `${row.id}___${day.iso}`;


                                const manualCell =
                                  manualTimelineCells[
                                    cellKey
                                  ] ||
                                  null;


                                const selectedPackage =
                                  manualCell
                                    ? organizationWorkPackages.find(
                                        (
                                          workPackage
                                        ) =>
                                          workPackage.id ===
                                          manualCell
                                            .organization_work_package_id
                                      ) ||
                                      null
                                    : null;


                                const cellCode =
                                  String(
                                    manualCell?.package_code ||
                                    selectedPackage?.code ||
                                    ''
                                  )
                                    .trim()
                                    .toUpperCase();


                                const cellColor =
                                  selectedPackage?.color ||
                                  manualCell?.package_color ||
                                  '#64748b';


                                const cellTextColor =
                                  getTextColor(
                                    cellColor
                                  );


                                const cellSaving =
                                  savingTimelineCellKey ===
                                  cellKey;


                                return (

                                  <td
                                    key={`${row.id}-${day.iso}`}

                                    title={
                                      day.isHoliday
                                        ? day.holidayDescription
                                        : cellCode
                                          ? `${cellCode} · ${
                                              selectedPackage?.description ||
                                              manualCell?.package_description ||
                                              ''
                                            }`
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

                                      padding:
                                        0,

                                      position:
                                        'relative',

                                      background:
                                        cellCode
                                          ? cellColor
                                          : day.isHoliday
                                            ? '#fee2e2'
                                            : day.isWeekend
                                              ? '#f1f5f9'
                                              : '#ffffff',

                                      color:
                                        cellCode
                                          ? cellTextColor
                                          : day.isHoliday
                                            ? '#991b1b'
                                            : '#64748b',

                                      boxShadow:
                                        day.isHoliday
                                          ? 'inset 0 0 0 1px #fca5a5'
                                          : 'none',
                                    }}
                                  >

                                    {day.isHoliday &&
                                    !cellCode ? (
                                      'HOL'
                                    ) : (
                                      <>

                                        <button
                                          type="button"

                                          disabled={
                                            cellSaving
                                          }

                                          onClick={() => {

                                            setOpenRowMenuId(
                                              ''
                                            );


                                            setOpenPackageDropdownRowId(
                                              ''
                                            );


                                            setOpenTimelineCellKey(
                                              (
                                                current
                                              ) =>
                                                current ===
                                                cellKey
                                                  ? ''
                                                  : cellKey
                                            );

                                          }}

                                          style={{
                                            width:
                                              '100%',

                                            height:
                                              '34px',

                                            padding:
                                              0,

                                            border:
                                              0,

                                            background:
                                              'transparent',

                                            color:
                                              cellCode
                                                ? cellTextColor
                                                : '#64748b',

                                            fontSize:
                                              cellCode
                                                ? '10px'
                                                : '9px',

                                            fontWeight:
                                              cellCode
                                                ? 900
                                                : 700,

                                            cursor:
                                              cellSaving
                                                ? 'not-allowed'
                                                : 'pointer',
                                          }}
                                        >
                                          {cellCode ||
                                            '▼'}
                                        </button>


                                        {openTimelineCellKey ===
                                          cellKey && (

                                          <div
                                            style={{
                                              position:
                                                'absolute',

                                              top:
                                                '32px',

                                              left:
                                                0,

                                              zIndex:
                                                500,

                                              width:
                                                '280px',

                                              maxHeight:
                                                '270px',

                                              overflowY:
                                                'auto',

                                              border:
                                                '1px solid #cbd5e1',

                                              borderRadius:
                                                '6px',

                                              background:
                                                '#ffffff',

                                              boxShadow:
                                                '0 12px 30px rgba(15,23,42,0.20)',
                                            }}
                                          >

                                            {cellCode && (

                                              <button
                                                type="button"

                                                onClick={() =>
                                                  setManualTimelineCell(
                                                    row,
                                                    day.iso,
                                                    null
                                                  )
                                                }

                                                style={{
                                                  display:
                                                    'block',

                                                  width:
                                                    '100%',

                                                  padding:
                                                    '8px 10px',

                                                  border:
                                                    0,

                                                  borderBottom:
                                                    '1px solid #e2e8f0',

                                                  background:
                                                    '#fff7ed',

                                                  color:
                                                    '#c2410c',

                                                  textAlign:
                                                    'left',

                                                  fontSize:
                                                    '10px',

                                                  fontWeight:
                                                    800,

                                                  cursor:
                                                    'pointer',
                                                }}
                                              >
                                                Clear cell
                                              </button>

                                            )}


                                            {organizationWorkPackages.map(
                                              (
                                                workPackage
                                              ) => {

                                                const optionColor =
                                                  workPackage.color ||
                                                  '#64748b';


                                                const optionTextColor =
                                                  getTextColor(
                                                    optionColor
                                                  );


                                                return (

                                                  <button
                                                    key={
                                                      workPackage.id
                                                    }

                                                    type="button"

                                                    onClick={() =>
                                                      setManualTimelineCell(
                                                        row,
                                                        day.iso,
                                                        workPackage.id
                                                      )
                                                    }

                                                    style={{
                                                      display:
                                                        'flex',

                                                      alignItems:
                                                        'center',

                                                      gap:
                                                        '10px',

                                                      width:
                                                        '100%',

                                                      padding:
                                                        '8px 10px',

                                                      border:
                                                        0,

                                                      borderBottom:
                                                        '1px solid #f1f5f9',

                                                      background:
                                                        '#ffffff',

                                                      color:
                                                        '#0f172a',

                                                      textAlign:
                                                        'left',

                                                      cursor:
                                                        'pointer',
                                                    }}
                                                  >

                                                    <span
                                                      style={{
                                                        display:
                                                          'inline-flex',

                                                        alignItems:
                                                          'center',

                                                        justifyContent:
                                                          'center',

                                                        minWidth:
                                                          '46px',

                                                        padding:
                                                          '4px 6px',

                                                        borderRadius:
                                                          '4px',

                                                        background:
                                                          optionColor,

                                                        color:
                                                          optionTextColor,

                                                        fontSize:
                                                          '10px',

                                                        fontWeight:
                                                          900,
                                                      }}
                                                    >
                                                      {workPackage.code}
                                                    </span>


                                                    <span
                                                      style={{
                                                        flex:
                                                          1,

                                                        color:
                                                          '#334155',

                                                        fontSize:
                                                          '10px',

                                                        fontWeight:
                                                          600,

                                                        whiteSpace:
                                                          'normal',
                                                      }}
                                                    >
                                                      {workPackage.description}
                                                    </span>

                                                  </button>

                                                );

                                              }
                                            )}

                                          </div>

                                        )}

                                      </>
                                    )}

                                  </td>

                                );

                              }


                              // --------------------------------
                              // MASTER PLAN-DERIVED ROW
                              // --------------------------------

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


                          {/* KOSKELA */}

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

                                    width:
                                      KOSKELA_WIDTH,

                                    minWidth:
                                      KOSKELA_WIDTH,

                                    padding:
                                      '4px',
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

                                    style={{
                                      width:
                                        '100%',

                                      minWidth:
                                        0,

                                      height:
                                        '28px',

                                      padding:
                                        '0 4px',

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
                Manual row timeline ▼ = select Work Package
              </span>

            </div>

          </div>

        )}


      {/* ====================================================
          CONSTRAINT DETAILS
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

                    <th style={headerCellStyle}>
                      PACKAGE
                    </th>

                    <th style={headerCellStyle}>
                      DESCRIPTION
                    </th>

                    <th style={headerCellStyle}>
                      CONSTRAINT
                    </th>

                    <th style={headerCellStyle}>
                      STATUS
                    </th>

                    <th style={headerCellStyle}>
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

                        <td style={bodyCellStyle}>
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


                        <td style={bodyCellStyle}>
                          {column.label}
                        </td>


                        <td style={bodyCellStyle}>
                          Active
                        </td>


                        <td style={bodyCellStyle}>

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
          INSERT PACKAGE MODAL
      ===================================================== */}

      {showInsertPackageModal && (

        <div
          style={{
            position:
              'fixed',

            inset:
              0,

            zIndex:
              6000,

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            padding:
              '20px',

            background:
              'rgba(6,27,47,0.58)',
          }}
        >

          <div
            style={{
              width:
                'min(520px, 96vw)',

              borderRadius:
                '10px',

              background:
                '#ffffff',

              boxShadow:
                '0 24px 70px rgba(15,23,42,0.30)',

              overflow:
                'hidden',
            }}
          >

            <div
              style={{
                padding:
                  '18px 20px',

                borderBottom:
                  '1px solid #e2e8f0',
              }}
            >

              <div
                style={{
                  color:
                    '#2563eb',

                  fontSize:
                    '10px',

                  fontWeight:
                    900,

                  letterSpacing:
                    '0.08em',

                  textTransform:
                    'uppercase',
                }}
              >
                LOOKAHEAD-ONLY ACTIVITY
              </div>


              <h2
                style={{
                  margin:
                    '5px 0 0',

                  color:
                    '#0f172a',

                  fontSize:
                    '18px',

                  fontWeight:
                    900,
                }}
              >
                Insert Package
              </h2>


              <p
                style={{
                  margin:
                    '7px 0 0',

                  color:
                    '#64748b',

                  fontSize:
                    '11px',

                  lineHeight:
                    1.5,
                }}
              >
                Add an activity directly to the Lookahead without
                changing the Master Plan.
              </p>

            </div>


            <form
              onSubmit={
                submitInsertPackage
              }

              style={{
                padding:
                  '20px',
              }}
            >

              {/* WORK PACKAGE */}

              <div
                style={{
                  marginBottom:
                    '15px',
                }}
              >

                <label
                  style={
                    modalFieldLabelStyle
                  }
                >
                  Work Package
                </label>


                <select
                  value={
                    insertPackageWorkPackageId
                  }

                  required

                  onChange={(
                    event
                  ) =>
                    setInsertPackageWorkPackageId(
                      event.target.value
                    )
                  }

                  style={
                    modalFieldInputStyle
                  }
                >

                  <option value="">
                    -- Select Work Package --
                  </option>


                  {organizationWorkPackages.map(
                    (
                      workPackage
                    ) => (

                      <option
                        key={
                          workPackage.id
                        }

                        value={
                          workPackage.id
                        }
                      >
                        {workPackage.code} · {workPackage.description}
                      </option>

                    )
                  )}

                </select>

              </div>


              {/* LINE ID */}

              <div
                style={{
                  marginBottom:
                    '15px',
                }}
              >

                <label
                  style={
                    modalFieldLabelStyle
                  }
                >
                  Line ID
                </label>


                <select
                  value={
                    insertPackageLineId
                  }

                  required

                  onChange={(
                    event
                  ) =>
                    setInsertPackageLineId(
                      event.target.value
                    )
                  }

                  style={
                    modalFieldInputStyle
                  }
                >

                  {Array.from(
                    {
                      length:
                        sheetRows.length + 1,
                    },
                    (
                      _,
                      index
                    ) =>
                      index + 1
                  ).map(
                    (
                      lineId
                    ) => (

                      <option
                        key={
                          lineId
                        }

                        value={
                          lineId
                        }
                      >
                        Line {lineId}
                        {lineId ===
                        sheetRows.length + 1
                          ? ' · Bottom'
                          : ''}
                      </option>

                    )
                  )}

                </select>


                <div
                  style={{
                    marginTop:
                      '5px',

                    color:
                      '#94a3b8',

                    fontSize:
                      '9px',
                  }}
                >
                  Existing rows at this position and below will move down.
                </div>

              </div>


              {/* START + DURATION */}

              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    '1fr 1fr',

                  gap:
                    '12px',

                  marginBottom:
                    '18px',
                }}
              >

                <div>

                  <label
                    style={
                      modalFieldLabelStyle
                    }
                  >
                    Start Date
                  </label>


                  <input
                    type="date"

                    value={
                      insertPackageStartDate
                    }

                    min={
                      selectedPlan?.window_start_date ||
                      windowStart ||
                      undefined
                    }

                    max={
                      selectedPlan?.window_finish_date ||
                      undefined
                    }

                    required

                    onChange={(
                      event
                    ) =>
                      setInsertPackageStartDate(
                        event.target.value
                      )
                    }

                    style={
                      modalFieldInputStyle
                    }
                  />

                </div>


                <div>

                  <label
                    style={
                      modalFieldLabelStyle
                    }
                  >
                    Duration
                  </label>


                  <div
                    style={{
                      display:
                        'flex',

                      alignItems:
                        'center',

                      gap:
                        '7px',
                    }}
                  >

                    <input
                      type="number"

                      min={
                        1
                      }

                      step={
                        1
                      }

                      value={
                        insertPackageDuration
                      }

                      required

                      onChange={(
                        event
                      ) =>
                        setInsertPackageDuration(
                          Number(
                            event.target.value
                          )
                        )
                      }

                      style={{
                        ...modalFieldInputStyle,

                        flex:
                          1,
                      }}
                    />


                    <span
                      style={{
                        color:
                          '#64748b',

                        fontSize:
                          '10px',

                        fontWeight:
                          700,

                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      working days
                    </span>

                  </div>

                </div>

              </div>


              <div
                style={{
                  padding:
                    '10px 11px',

                  marginBottom:
                    '18px',

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

                  lineHeight:
                    1.45,
                }}
              >
                RitsuFlow will create the manual row and populate its
                timeline automatically, skipping weekends and registered
                holidays.
              </div>


              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'flex-end',

                  gap:
                    '8px',
                }}
              >

                <button
                  type="button"

                  disabled={
                    insertingPackage
                  }

                  onClick={() =>
                    setShowInsertPackageModal(
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
                    insertingPackage ||
                    !insertPackageWorkPackageId ||
                    !insertPackageLineId ||
                    !insertPackageStartDate ||
                    Number(
                      insertPackageDuration
                    ) < 1
                  }

                  style={
                    insertingPackage ||
                    !insertPackageWorkPackageId ||
                    !insertPackageLineId ||
                    !insertPackageStartDate ||
                    Number(
                      insertPackageDuration
                    ) < 1
                      ? disabledButtonStyle
                      : primaryButtonStyle
                  }
                >
                  {insertingPackage
                    ? 'Inserting...'
                    : 'Insert Package'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}


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

const modalFieldLabelStyle = {
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


const modalFieldInputStyle = {
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

  outline:
    'none',
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
