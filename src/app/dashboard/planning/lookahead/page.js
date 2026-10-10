'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { supabase } from '../../../../lib/supabase';
import { readPreconProjectId, rememberPreconProjectId } from '../../preconProject';
import { useT } from '../../../../lib/i18n/useT';
import { useLanguage } from '../../../../lib/i18n/LanguageProvider';
import { Dialog, usePageDialogs } from '../../../fieldop/ui/dialogs';
import { Empty, Icon, Notice, Segments, ui } from '../../../fieldop/ui';
import styles from '../../precon.module.css';
import { useLocationPlan } from '../useLocationPlan';
import { predecessorAuto } from './predecessorAuto';


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


// Labels: lookahead.koskela.<key> in messages/precon.<language>.json.
const KOSKELA_COLUMNS = [
  { key: 'projects_information' },
  { key: 'materials' },
  { key: 'labor' },
  { key: 'equipment' },
  { key: 'space' },
  { key: 'predecessor' },
  { key: 'external_conditions' },
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
  date,
  locale = 'en-US'
) {
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      month: '2-digit',
      day: '2-digit',
    }
  ).format(date);
}


function formatLongDate(
  isoDate,
  locale = 'en-US'
) {
  const date = parseDate(isoDate);
  if (!date) {
    return isoDate || '';
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  ).format(date);
}


function getDayLabel(
  date,
  locale = 'en-US'
) {
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      weekday: 'short',
    }
  ).format(date).replace('.', '');
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
  status,
  readinessSource = null
) {
  if (
    status === 'clear' &&
    readinessSource === 'constraint_cleared'
  ) {
    return {
      background:
        '#dbeafe',
      color:
        '#1d4ed8',
      border:
        '#93c5fd',
    };
  }

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
  // Texts: lookahead.* in messages/precon.<language>.json. `t` is stable (callbacks keep working)
  // and always reads the current language.
  const translate = useT('precon');
  const { language } = useLanguage();
  const translateRef = useRef(translate);
  translateRef.current = translate;
  const t = useMemo(
    () => new Proxy({}, { get: (_, key) => translateRef.current(`lookahead.${String(key)}`) }),
    []
  );
  const tv = useCallback((key, vars) => translateRef.current(`lookahead.${key}`, vars), []);
  const koskelaLabel = useCallback((key) => translateRef.current(`lookahead.koskela.${key}`), []);
  const dialogs = usePageDialogs();
  const [showHolidays, setShowHolidays] = useState(false);

  const [
    projects,
    setProjects,
  ] = useState([]);


  const [
    selectedProjectId,
    setSelectedProjectId,
  ] = useState('');

  // Koskela "Predecessor" auto-check from RitsuScope Tasks (locations × work packages, Weekly progress).
  const locationPlan = useLocationPlan(selectedProjectId);


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


  // Central Constraint records linked to grouped Koskela
  // assessments. Keyed by sheet_readiness_assessment_id.
  // Once a linked constraint exists, Constraint Management
  // becomes authoritative for that Koskela criterion.
  const [
    constraintsByAssessment,
    setConstraintsByAssessment,
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


  const [
    savingLookahead,
    setSavingLookahead,
  ] = useState(false);

  // R2: creating a plan from the frozen Master plan baseline.
  const [creatingPlan, setCreatingPlan] = useState(false);


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


          const projectId =
            readPreconProjectId();


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
            t.errProjects
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
            t.errPlans
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
            t.errMasterPlan
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
            t.errLibrary
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
        planId,
        options = {}
      ) => {

        const {
          silent = false,
        } = options;

        if (!planId) {

          setWorkItems([]);
          setSheetRows([]);
          setReadiness({});
          setConstraintsByAssessment({});
          setDescriptionDrafts({});
          setPackageDrafts({});
          setManualTimelineCells({});

          return;

        }


        if (
          !silent
        ) {
          setLoading(
            true
          );
        }

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

            setConstraintsByAssessment(
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
                readiness_source,
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

                readiness_source:
                  assessment.readiness_source ||
                  null,
              };

            }
          );


          setReadiness(
            readinessMap
          );



          // --------------------------------------------------
          // CENTRAL CONSTRAINTS LINKED TO KOSKELA
          // --------------------------------------------------

          const assessmentIds =
            (assessments || [])
              .map(
                (assessment) =>
                  assessment.id
              )
              .filter(Boolean);


          if (
            assessmentIds.length >
            0
          ) {

            const {
              data:
                linkedConstraints,
              error:
                linkedConstraintsError,
            } =
              await supabase
                .from(
                  'constraints'
                )
                .select(`
                  id,
                  project_id,
                  status,
                  category,
                  title,
                  sheet_readiness_assessment_id
                `)
                .in(
                  'sheet_readiness_assessment_id',
                  assessmentIds
                );


            if (
              linkedConstraintsError
            ) {
              throw linkedConstraintsError;
            }


            const linkedConstraintMap = {};


            (linkedConstraints || []).forEach(
              (constraint) => {

                if (
                  constraint
                    .sheet_readiness_assessment_id
                ) {

                  linkedConstraintMap[
                    constraint
                      .sheet_readiness_assessment_id
                  ] = constraint;

                }

              }
            );


            setConstraintsByAssessment(
              linkedConstraintMap
            );

          } else {

            setConstraintsByAssessment({});

          }


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
            t.errWorkspace
          );

        } finally {

          if (
            !silent
          ) {
            setLoading(
              false
            );
          }

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
  // SAVE LOOKAHEAD
  //
  // Persists:
  // - Start of Week 1
  // - Horizon
  // - Lookahead window finish
  // - Any edited row descriptions still pending in the UI
  //
  // Timeline cells, Koskela assessments, package selections and
  // inserted packages are already persisted at the moment the
  // user changes them. This button acts as the explicit save for
  // Lookahead-level settings and any remaining description edits.
  // ==========================================================

  const saveLookahead =
    async () => {

      if (
        !selectedPlanId ||
        savingLookahead
      ) {
        return;
      }


      const parsedStart =
        parseDate(
          windowStart
        );


      if (
        !parsedStart
      ) {

        setErrorMessage(
          t.errWeekStart
        );

        return;

      }


      const normalizedWeeks =
        Number(
          horizonWeeks
        );


      if (
        !Number.isInteger(
          normalizedWeeks
        ) ||
        normalizedWeeks < 1
      ) {

        setErrorMessage(
          t.errHorizon
        );

        return;

      }


      const calculatedFinish =
        toIsoDate(
          addDays(
            parsedStart,
            normalizedWeeks * 7 - 1
          )
        );


      setSavingLookahead(
        true
      );

      setErrorMessage(
        ''
      );


      try {

        // ----------------------------------------------------
        // 1. SAVE LOOKAHEAD PLAN SETTINGS
        // ----------------------------------------------------

        const {
          error:
            planError,
        } =
          await supabase
            .from(
              'lookahead_plans'
            )
            .update({

              window_start_date:
                windowStart,

              window_finish_date:
                calculatedFinish,

              horizon_weeks:
                normalizedWeeks,

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              'id',
              selectedPlanId
            );


        if (
          planError
        ) {
          throw planError;
        }


        // ----------------------------------------------------
        // 2. SAVE ANY DESCRIPTION DRAFTS THAT CHANGED
        // ----------------------------------------------------

        const changedRows =
          sheetRows.filter(
            (
              row
            ) =>
              String(
                descriptionDrafts[
                  row.id
                ] ||
                ''
              ).trim() !==
              String(
                row.description ||
                ''
              ).trim()
          );


        if (
          changedRows.length >
          0
        ) {

          const descriptionResults =
            await Promise.all(
              changedRows.map(
                async (
                  row
                ) => {

                  const nextDescription =
                    String(
                      descriptionDrafts[
                        row.id
                      ] ||
                      ''
                    ).trim();


                  const {
                    error,
                  } =
                    await supabase
                      .from(
                        'lookahead_sheet_rows'
                      )
                      .update({

                        description:
                          nextDescription,

                        updated_at:
                          new Date()
                            .toISOString(),
                      })
                      .eq(
                        'id',
                        row.id
                      )
                      .eq(
                        'lookahead_plan_id',
                        selectedPlanId
                      );


                  if (
                    error
                  ) {
                    throw error;
                  }


                  return {
                    id:
                      row.id,

                    description:
                      nextDescription,
                  };

                }
              )
            );


          const descriptionMap =
            new Map(
              descriptionResults.map(
                (
                  item
                ) => [
                  item.id,
                  item.description,
                ]
              )
            );


          setSheetRows(
            (
              current
            ) =>
              current.map(
                (
                  row
                ) =>
                  descriptionMap.has(
                    row.id
                  )
                    ? {
                        ...row,

                        description:
                          descriptionMap.get(
                            row.id
                          ),
                      }
                    : row
              )
          );

        }


        // ----------------------------------------------------
        // 3. UPDATE LOCAL PLAN STATE WITHOUT FULL RELOAD
        // ----------------------------------------------------

        setPlans(
          (
            current
          ) =>
            current.map(
              (
                plan
              ) =>
                plan.id ===
                selectedPlanId
                  ? {
                      ...plan,

                      window_start_date:
                        windowStart,

                      window_finish_date:
                        calculatedFinish,

                      horizon_weeks:
                        normalizedWeeks,

                      updated_at:
                        new Date()
                          .toISOString(),
                    }
                  : plan
            )
        );


        // ----------------------------------------------------
        // 4. PULL BASELINE PACKAGES THAT NOW FALL IN THE WINDOW
        //    (never duplicates or resets existing items)
        // ----------------------------------------------------

        const {
          data: refreshed,
          error: refreshError,
        } = await supabase.rpc(
          'refresh_lookahead_from_baseline',
          { target_lookahead_plan_id: selectedPlanId }
        );

        if (refreshError) {
          throw refreshError;
        }

        const addedItems = Number(refreshed?.[0]?.added_items || 0);

        if (addedItems > 0) {
          dialogs.notify(tv('refreshedNotice', { items: addedItems }));
          await loadWorkspace(selectedPlanId, { silent: true });
        }


      } catch (error) {

        console.error(
          'Save Lookahead:',
          error
        );


        setErrorMessage(
          error.message ||
          t.errSave
        );

      } finally {

        setSavingLookahead(
          false
        );

      }

    };


  // ==========================================================
  // R2 · CREATE A LOOKAHEAD FROM THE FROZEN BASELINE
  // One database call: creates the active plan, closes the
  // previous active one, pulls the packages in the window and
  // adds their package rows.
  // ==========================================================

  const createLookaheadFromBaseline = async () => {
    if (!selectedProjectId || creatingPlan) {
      return;
    }

    // Default window: Monday of the current week.
    let start = parseDate(windowStart);
    if (!start) {
      const today = new Date();
      const weekday = (today.getDay() + 6) % 7;
      start = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), -weekday);
    }
    const startIso = toIsoDate(start);
    const weeks = Number.isInteger(Number(horizonWeeks)) && Number(horizonWeeks) >= 1 ? Number(horizonWeeks) : 6;

    if (plans.length > 0) {
      const confirmed = await dialogs.confirm(tv('confirmNewPlan', { start: startIso, weeks }));
      if (!confirmed) {
        return;
      }
    }

    setCreatingPlan(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase.rpc('create_lookahead_plan_from_baseline', {
        target_project_id: selectedProjectId,
        target_window_start: startIso,
        target_horizon_weeks: weeks,
        target_name: null,
      });

      if (error) {
        throw error;
      }

      const result = data?.[0] || {};
      dialogs.notify(tv('createdNotice', { items: Number(result.added_items || 0), rows: Number(result.added_rows || 0) }));
      await loadPlans(selectedProjectId);
    } catch (error) {
      console.error('Create Lookahead:', error);
      const message = String(error?.message || '');
      setErrorMessage(message.includes('NO_BASELINE') ? t.errNoBaseline : message || t.errCreate);
    } finally {
      setCreatingPlan(false);
    }
  };


  // ==========================================================
  // PROJECT CHANGE
  //
  // Clear the previously selected Lookahead plan immediately
  // before switching projects. This prevents the previous
  // project's plan/workspace from being loaded against the
  // newly selected project while loadPlans() is still running.
  // ==========================================================

  const handleProjectChange =
    (
      projectId
    ) => {

      rememberPreconProjectId(
        projectId
      );

      setSelectedPlanId(
        ''
      );

      setPlans(
        []
      );

      setWorkItems(
        []
      );

      setSheetRows(
        []
      );

      setReadiness(
        {}
      );

      setConstraintsByAssessment(
        {}
      );

      setDescriptionDrafts(
        {}
      );

      setPackageDrafts(
        {}
      );

      setManualTimelineCells(
        {}
      );

      setMasterPlanHolidays(
        []
      );

      setSelectedProjectId(
        projectId
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
            `/dashboard/planning/lookahead?projectId=${projectId}`
          );

      } else {

        window.history
          .replaceState(
            {},
            '',
            '/dashboard/planning/lookahead'
          );

      }

    };


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
          t.errAssignPackage
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
              holiday?.date ||
              '';


            if (
              !date
            ) {
              return;
            }


            map.set(
              date,

              holiday.description ||
              t.holiday
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
  // LOCATION SEQUENCE VIEW
  //
  // Same Lookahead data, different visualization:
  // - one row per Master Plan location
  // - each day shows the Work Package active at that location
  //
  // Manual Lookahead-only activities are not included here yet
  // because the current manual activity architecture does not
  // store a Location reference.
  // ==========================================================

  const locationSequenceRows =
    useMemo(
      () => {

        const locationMap =
          new Map();


        workItems.forEach(
          (
            item
          ) => {

            const locationPath =
              String(
                getLocationPath(
                  item
                ) ||
                ''
              ).trim();


            const locationName =
              String(
                getLocationName(
                  item
                ) ||
                ''
              ).trim();


            const locationKey =
              locationPath ||
              locationName;


            if (
              !locationKey
            ) {
              return;
            }


            if (
              !locationMap.has(
                locationKey
              )
            ) {

              locationMap.set(
                locationKey,
                {
                  key:
                    locationKey,

                  name:
                    locationName ||
                    locationPath,

                  path:
                    locationPath ||
                    locationName,

                  items:
                    [],
                }
              );

            }


            locationMap
              .get(
                locationKey
              )
              .items
              .push(
                item
              );

          }
        );


        const rows =
          Array.from(
            locationMap.values()
          );


        rows.forEach(
          (
            row
          ) => {

            row.items.sort(
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


                return getPackageCode(
                  a
                ).localeCompare(
                  getPackageCode(
                    b
                  )
                );

              }
            );

          }
        );


        rows.sort(
          (
            a,
            b
          ) => {

            const firstA =
              a.items
                .map(
                  (
                    item
                  ) =>
                    getPackageDates(
                      item
                    ).start ||
                    ''
                )
                .filter(
                  Boolean
                )
                .sort()[0] ||
                '';

            const firstB =
              b.items
                .map(
                  (
                    item
                  ) =>
                    getPackageDates(
                      item
                    ).start ||
                    ''
                )
                .filter(
                  Boolean
                )
                .sort()[0] ||
                '';


            if (
              firstA !==
              firstB
            ) {

              return firstA.localeCompare(
                firstB
              );

            }


            return a.path.localeCompare(
              b.path
            );

          }
        );


        return rows;

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
          t.errDescription
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
          t.errInsertRow
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
          t.errLineId
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
          t.errDuration
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
          selectedPlanId,
          {
            silent:
              true,
          }
        );

      } catch (error) {

        console.error(
          'Insert Lookahead package:',
          error
        );


        setErrorMessage(
          error.message ||
          t.errInsertPackage
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
        await dialogs.confirm(
          t.confirmDeleteRow,
          { danger: true }
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
          t.errDeleteRow
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
                'var(--fo-muted)',
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
          t.errCell
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


      const currentAssessment =
        readiness[
          readinessKey
        ];


      const linkedConstraint =
        currentAssessment?.id
          ? constraintsByAssessment[
              currentAssessment.id
            ] || null
          : null;


      // Once a central Constraint exists, Constraint Management
      // owns this readiness criterion. The Matrix can no longer
      // override the controlled state directly.
      if (
        linkedConstraint
      ) {

        setErrorMessage(
          t.errManagedCriterion
        );

        return;

      }


      if (
        nextStatus ===
        'constrained'
      ) {

        const categoryLabel =
          KOSKELA_COLUMNS.some(
            (column) =>
              column.key ===
              category
          )
            ? koskelaLabel(category)
            : category;


        const packageLabel =
          row.package_code ||
          t.thisPackage;


        const confirmed = await dialogs.confirm(
          tv('confirmConstraint', { package: packageLabel, category: categoryLabel })
        );


        if (!confirmed) {
          return;
        }

      }


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
      // OPTIMISTIC UI UPDATE
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

            readiness_source:
              nextStatus === 'clear'
                ? 'direct'
                : null,
          },
        })
      );


      let assessmentSaved =
        false;


      try {

        // ====================================================
        // SAVE / UPDATE THE GROUPED KOSKELA ASSESSMENT
        //
        // Using one UPSERT path for both existing and new
        // assessments keeps the saved assessment UUID
        // available for the central Constraint integration.
        // ====================================================

        const {
          data:
            savedAssessment,

          error:
            assessmentError,
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

                readiness_source:
                  nextStatus === 'clear'
                    ? 'direct'
                    : null,

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
              status,
              readiness_source,
              created_at,
              updated_at
            `)
            .single();


        if (
          assessmentError
        ) {
          throw assessmentError;
        }


        assessmentSaved =
          true;


        const normalizedSavedStatus =
          normalizeReadinessStatus(
            savedAssessment
              .status
          );


        // ----------------------------------------------------
        // KEEP LOCAL STATE SYNCHRONIZED WITH THE SAVED ROW
        // ----------------------------------------------------

        setReadiness(
          (
            current
          ) => ({

            ...current,

            [readinessKey]: {

              id:
                savedAssessment
                  .id,

              sheet_row_id:
                savedAssessment
                  .sheet_row_id,

              category:
                savedAssessment
                  .category,

              status:
                normalizedSavedStatus,

              readiness_source:
                savedAssessment.readiness_source ||
                null,
            },
          })
        );


        // ====================================================
        // CENTRAL CONSTRAINT LOG SYNCHRONIZATION
        //
        // Koskela:
        //   No  = constrained
        //   Yes = clear
        //
        // When the saved status is "constrained", the database
        // creates or reuses exactly one central Constraint
        // through constraints.sheet_readiness_assessment_id.
        //
        // IMPORTANT:
        // Changing No -> Yes does NOT delete or automatically
        // clear the central Constraint. Once a Constraint has
        // entered Constraint Management, its lifecycle remains
        // governed and auditable there.
        // ====================================================

        if (
          normalizedSavedStatus ===
            'constrained' &&
          savedAssessment
            ?.id
        ) {

          const {
            error:
              constraintSyncError,
          } =
            await supabase.rpc(
              'ensure_koskela_constraint',
              {
                target_readiness_assessment_id:
                  savedAssessment.id,
              }
            );


          if (
            constraintSyncError
          ) {

            console.error(
              'Koskela -> Constraint Log synchronization:',
              constraintSyncError
            );


            setErrorMessage(
              tv('errSyncConstraint', {
                message:
                  constraintSyncError.message ||
                  t.tryAgain,
              })
            );


            return;
          }


          const {
            data:
              linkedConstraintData,
            error:
              linkedConstraintError,
          } =
            await supabase
              .from('constraints')
              .select(`
                id,
                project_id,
                status,
                category,
                title,
                sheet_readiness_assessment_id
              `)
              .eq(
                'sheet_readiness_assessment_id',
                savedAssessment.id
              )
              .maybeSingle();


          if (linkedConstraintError) {
            throw linkedConstraintError;
          }


          if (linkedConstraintData) {

            setConstraintsByAssessment(
              (current) => ({
                ...current,
                [savedAssessment.id]:
                  linkedConstraintData,
              })
            );

          }

        }

      } catch (error) {

        console.error(
          'Grouped Koskela readiness:',
          error
        );


        if (
          !assessmentSaved
        ) {

          setReadiness(
            previousReadiness
          );

        }


        setErrorMessage(
          error.message ||
          t.errAssessment
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

  const cx = (...names) => names.filter(Boolean).join(' ');

  return (
    <div>

      {/* ====================================================
          TOOLBAR
      ===================================================== */}

      <div className={styles.toolbar} style={{ marginBottom: 12 }}>
        <div className={styles.group}>
          <label className={styles.control}>
            <span>{t.project}</span>
            <select className={styles.projectSelect} value={selectedProjectId} onChange={(event) => handleProjectChange(event.target.value)}>
              <option value="">{t.selectProject}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code ? `${project.code} – ` : ''}{project.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <span>{t.planLabel}</span>
            <select className={styles.scenarioSelect} value={selectedPlanId} disabled={!selectedProjectId} onChange={(event) => handlePlanChange(event.target.value)}>
              <option value="">{t.select}</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}{plan.status === 'active' ? t.activeSuffix : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={ui.btn} disabled={!selectedPlanId || savingLookahead} onClick={saveLookahead}>
            {savingLookahead ? t.saving : t.save}
          </button>
          <button type="button" className={ui.btnGhost} disabled={!selectedProjectId || creatingPlan} onClick={createLookaheadFromBaseline}>
            {creatingPlan ? t.creatingPlan : t.newFromBaseline}
          </button>
        </div>

        <div className={styles.group}>
          <label className={styles.control}>
            <span>{t.weekStart}</span>
            <input type="date" value={windowStart} onChange={(event) => setWindowStart(event.target.value)} />
          </label>
          <label className={styles.control}>
            <span>{t.horizon}</span>
            <select value={horizonWeeks} onChange={(event) => setHorizonWeeks(Number(event.target.value))}>
              {[2, 3, 4, 5, 6, 8, 10, 12].map((weeks) => (
                <option key={weeks} value={weeks}>{weeks} {t.weeks}</option>
              ))}
            </select>
          </label>
        </div>

        <div className={cx(styles.group, styles.push)}>
          <button type="button" className={ui.btnGhost} onClick={() => setShowWeekends((current) => !current)}>
            {showWeekends ? t.hideWeekends : t.showWeekends}
          </button>
          <button
            type="button"
            className={ui.btnGhost}
            onClick={() => {
              if (masterPlanHolidays.length === 0) {
                dialogs.notify(t.noHolidays, 'warn');
                return;
              }
              setShowHolidays(true);
            }}
          >
            {t.holidays}{masterPlanHolidays.length > 0 ? ` (${masterPlanHolidays.length})` : ''}
          </button>
          <button type="button" className={ui.btnPrimary} disabled={!selectedPlanId || insertingPackage} onClick={openInsertPackageModal}>
            <Icon name="plus" size={18} />{t.insertPackage}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div style={{ marginBottom: 12 }}>
          <Notice>{errorMessage}</Notice>
        </div>
      )}

      {selectedProjectId && (
        <div style={{ marginBottom: 12 }}>
          <Segments
            items={[
              { value: 'sheet', label: t.tabSheet },
              { value: 'locations', label: t.tabLocations },
              { value: 'constraints', label: t.tabConstraints },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>
      )}

      {!selectedProjectId && (
        <Empty title={t.noProject} text={t.noProjectText} />
      )}

      {/* ====================================================
          LOOKAHEAD SHEET
      ===================================================== */}

      {selectedProjectId &&
        selectedPlanId &&
        activeTab ===
          'sheet' && (

          <div
            className={styles.sheet}
          >

            {loading ? (

              <div
                className={styles.loadingBox}
              >
                {t.loading}
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

                  tableLayout: 'fixed', fontSize: '12px',
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
                      {t.colId}
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
                      {t.colPackage}
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
                      {t.colDescription}
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
                              'var(--fo-line-soft)',
                          }}
                        >

                          {t.colWeek}{' '}
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
                          'var(--fo-sunken)',

                        fontSize:
                          '10px',

                        letterSpacing:
                          '0.02em',
                      }}
                    >
                      {t.koskelaMatrix}
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
                                ? 'var(--fo-bad-wash)'
                                : day.isWeekend
                                  ? 'var(--fo-line-soft)'
                                  : 'var(--fo-sunken)',

                            color:
                              day.isHoliday
                                ? 'var(--fo-bad)'
                                : 'var(--fo-ink)',
                          }}
                        >

                          {day.isHoliday
                            ? t.holAbbr
                            : getDayLabel(
                                day.date,
                                language
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

                          {koskelaLabel(column.key)}

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
                                  ? 'var(--fo-line-soft)'
                                  : '#ffffff',

                            color:
                              day.isHoliday
                                ? 'var(--fo-bad)'
                                : 'var(--fo-ink)',
                          }}
                        >

                          {formatShortDate(
                            day.date,
                            language
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
                                  'var(--fo-muted)',

                                fontSize:
                                  '17px',

                                cursor:
                                  'pointer',
                              }}

                              title={t.rowActions}
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
                                    '1px solid var(--fo-line)',

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
                                  {t.insertAbove}
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
                                  {t.insertBelow}
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
                                      borderTop: '1px solid var(--fo-line-soft)',
                                    }}
                                  >
                                    {deletingRowId ===
                                    row.id
                                      ? t.deleting
                                      : t.deleteRow}
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
                                      ? tv('selectedPackage', { code })
                                      : t.selectWorkPackage
                                  }

                                  style={{
                                    width:
                                      '100%',

                                    height:
                                      '30px',

                                    padding:
                                      '0 6px',

                                    border:
                                      '1px solid var(--fo-line)',

                                    borderRadius:
                                      '4px',

                                    background:
                                      code
                                        ? color
                                        : '#ffffff',

                                    color:
                                      code
                                        ? textColor
                                        : 'var(--fo-muted)',

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
                                  {code || t.select}
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
                                        '1px solid var(--fo-line)',

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
                                          'var(--fo-muted)';


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
                                                'var(--fo-ink)',

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
                                                  'var(--fo-ink)',

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
                                            'var(--fo-muted)',

                                          fontSize:
                                            '10px',

                                          textAlign:
                                            'center',
                                        }}
                                      >
                                        {t.noWorkPackages}
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
                                    'var(--fo-muted)',

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
                                  ? t.descriptionPlaceholder
                                  : t.colDescription
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
                                    ? 'var(--fo-sunken)'
                                    : '#ffffff',

                                color:
                                  'var(--fo-ink)',

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
                                    'var(--fo-muted)',

                                  fontSize:
                                    '8px',
                                }}
                              >

                                {occurrences.length}{' '}
                                {t.packageOccurrence}

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
                                  'var(--fo-muted)';


                                const cellTextColor =
                                  getTextColor(
                                    cellColor
                                  );


                                const cellSaving =
                                  savingTimelineCellKey ===
                                  cellKey;


                                if (
                                  day.isWeekend
                                ) {

                                  return (

                                    <td
                                      key={`${row.id}-${day.iso}`}
                                      title={t.weekendHint}
                                      style={{
                                        ...bodyCellStyle,
                                        width: DAY_WIDTH,
                                        minWidth: DAY_WIDTH,
                                        height: '34px',
                                        padding: 0,
                                        background: 'var(--fo-sunken)',
                                        color: 'var(--fo-muted)',
                                        fontSize: '9px',
                                        fontWeight: 800,
                                        textAlign: 'center',
                                      }}
                                    >
                                      {t.offAbbr}
                                    </td>

                                  );

                                }


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
                                            ? 'var(--fo-bad-wash)'
                                            : day.isWeekend
                                              ? 'var(--fo-sunken)'
                                              : '#ffffff',

                                      color:
                                        cellCode
                                          ? cellTextColor
                                          : day.isHoliday
                                            ? 'var(--fo-bad)'
                                            : 'var(--fo-muted)',

                                      boxShadow:
                                        day.isHoliday
                                          ? 'inset 0 0 0 1px #fca5a5'
                                          : 'none',
                                    }}
                                  >

                                    {day.isHoliday &&
                                    !cellCode ? (
                                      t.holAbbr
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
                                                : 'var(--fo-muted)',

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
                                                '1px solid var(--fo-line)',

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
                                                    '1px solid var(--fo-line-soft)',

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
                                                {t.clearCell}
                                              </button>

                                            )}


                                            {organizationWorkPackages.map(
                                              (
                                                workPackage
                                              ) => {

                                                const optionColor =
                                                  workPackage.color ||
                                                  'var(--fo-muted)';


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
                                                        'var(--fo-ink)',

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
                                                          'var(--fo-ink)',

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
                                        dates.finish &&
                                      !day.isWeekend &&
                                      !day.isHoliday
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
                                          ? 'var(--fo-bad-wash)'
                                          : day.isWeekend
                                            ? 'var(--fo-sunken)'
                                            : '#ffffff',

                                    color:
                                      active
                                        ? textColor
                                        : day.isHoliday
                                          ? 'var(--fo-bad)'
                                          : 'var(--fo-muted)',

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
                                      ? t.holAbbr
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


                              const savingKey =
                                `${row.id}___${column.key}`;


                              const assessment =
                                readiness[
                                  savingKey
                                ] || null;


                              const style =
                                readinessStyle(
                                  status,
                                  assessment?.readiness_source ||
                                    null
                                );


                              const linkedConstraint =
                                assessment?.id
                                  ? constraintsByAssessment[
                                      assessment.id
                                    ] || null
                                  : null;


                              const saving =
                                savingGroupedReadiness ===
                                savingKey;


                              const governed =
                                Boolean(
                                  linkedConstraint
                                );


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

                                  {governed ? (

                                    <button
                                      type="button"

                                      title={
                                        assessment?.readiness_source ===
                                        'constraint_cleared'
                                          ? tv('readyAfterHint', { status: linkedConstraint.status })
                                          : tv('managedHint', { status: linkedConstraint.status })
                                      }

                                      onClick={() => {

                                        window.location.href =
                                          `/dashboard/planning/constraints?projectId=${selectedProjectId}&constraintId=${linkedConstraint.id}`;

                                      }}

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
                                          800,

                                        cursor:
                                          'pointer',
                                      }}
                                    >
                                      {status === 'constrained'
                                        ? t.noLocked
                                        : status === 'clear'
                                          ? t.yesLocked
                                          : t.managedLocked}
                                    </button>

                                  ) : (

                                    <select
                                      value={status}

                                      disabled={
                                        saving
                                      }

                                      onChange={(event) =>
                                        handleGroupedReadinessChange(
                                          row,
                                          column.key,
                                          event.target.value
                                        )
                                      }

                                      title={t.noCreatesConstraint}

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
                                          saving
                                            ? 'not-allowed'
                                            : 'pointer',
                                      }}
                                    >
                                      <option value="not_assessed">—</option>
                                      <option value="clear">{t.yes}</option>
                                      <option value="constrained">{t.no}</option>
                                      <option value="not_applicable">N/A</option>
                                    </select>

                                  )}

                                  {column.key === 'predecessor' && (() => {
                                    const auto = predecessorAuto(locationPlan, row);
                                    if (!auto) return null;
                                    const canApply = !governed && !saving && auto.allReady && status !== 'clear';
                                    return (
                                      <button
                                        type="button"
                                        disabled={!canApply}
                                        title={auto.allReady
                                          ? (canApply ? tv('autoPred.applyHint', { ready: auto.ready, total: auto.total }) : tv('autoPred.readyHint', { ready: auto.ready, total: auto.total }))
                                          : tv('autoPred.blockedHint', { list: auto.blocked.map((b) => tv('autoPred.blockedItem', { location: b.location, waits: b.waits.map((w) => (w.readyOn ? tv('autoPred.waitLagItem', { code: w.code, location: w.location, date: w.readyOn }) : tv('autoPred.waitItem', { code: w.code, location: w.location, done: w.done }))).join(', ') })).join('\n') })}
                                        onClick={() => { if (canApply) handleGroupedReadinessChange(row, column.key, 'clear'); }}
                                        style={{ display: 'block', width: '100%', marginTop: 3, padding: '1px 4px', border: 0, borderRadius: 4, fontSize: '9px', fontWeight: 800, textAlign: 'center',
                                          background: auto.allReady ? '#dcfce7' : auto.ready ? '#fef3c7' : '#fee2e2',
                                          color: auto.allReady ? '#166534' : auto.ready ? '#92400e' : '#991b1b',
                                          cursor: canApply ? 'pointer' : 'help' }}
                                      >
                                        {tv('autoPred.chip', { ready: auto.ready, total: auto.total })}
                                      </button>
                                    );
                                  })()}

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
                  '1px solid var(--fo-line)',

                fontSize:
                  '9px',
              }}
            >

              <strong>
                {t.legend}
              </strong>

              <span>
                {t.legendReady}
              </span>

              <span>
                {t.legendReadyAfter}
              </span>

              <span>
                {t.legendConstraint}
              </span>

              <span>
                {t.legendManaged}
              </span>

              <span>
                {t.legendNotAssessed}
              </span>

              <span>
                {t.legendHoliday}
              </span>

              <span>
                {t.legendRow}
              </span>


              <span>
                {t.legendManual}
              </span>

            </div>

          </div>

        )}


      {/* ====================================================
          LOCATION SEQUENCE
      ===================================================== */}

      {selectedProjectId &&
        selectedPlanId &&
        activeTab ===
          'locations' && (

          <div
            className={styles.sheet}
          >

            {loading ? (

              <div
                className={styles.loadingBox}
              >
                {t.loadingLocations}
              </div>

            ) : (

              <table
                style={{
                  width:
                    'max-content',

                  minWidth:
                    '100%',

                  borderCollapse:
                    'collapse',

                  tableLayout: 'fixed', fontSize: '12px',
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
                          '54px',

                        minWidth:
                          '54px',
                      }}
                    >
                      {t.colId}
                    </th>


                    <th
                      rowSpan={
                        3
                      }

                      style={{
                        ...headerCellStyle,

                        width:
                          '330px',

                        minWidth:
                          '330px',

                        textAlign:
                          'left',

                        paddingLeft:
                          '14px',
                      }}
                    >
                      {t.colLocation}
                    </th>


                    {weekGroups.map(
                      (
                        week
                      ) => (

                        <th
                          key={
                            `location-week-${week.weekNumber}`
                          }

                          colSpan={
                            week.days.length
                          }

                          style={{
                            ...headerCellStyle,

                            background:
                              '#dbe5f1',

                            color:
                              '#0f2747',

                            fontWeight:
                              900,
                          }}
                        >
                          {t.colWeek} {week.weekNumber}
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
                          key={
                            `location-day-${day.iso}`
                          }

                          style={{
                            ...headerCellStyle,

                            width:
                              DAY_WIDTH,

                            minWidth:
                              DAY_WIDTH,

                            background:
                              day.isHoliday
                                ? 'var(--fo-bad-wash)'
                                : day.isWeekend
                                  ? 'var(--fo-sunken)'
                                  : 'var(--fo-sunken)',

                            color:
                              day.isHoliday
                                ? 'var(--fo-bad)'
                                : 'var(--fo-ink)',
                          }}
                        >
                          {day.isHoliday
                            ? t.holAbbr
                            : getDayLabel(day.date, language)}
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
                          key={
                            `location-date-${day.iso}`
                          }

                          style={{
                            ...headerCellStyle,

                            width:
                              DAY_WIDTH,

                            minWidth:
                              DAY_WIDTH,

                            background:
                              day.isHoliday
                                ? 'var(--fo-bad-wash)'
                                : day.isWeekend
                                  ? 'var(--fo-sunken)'
                                  : '#ffffff',

                            color:
                              day.isHoliday
                                ? 'var(--fo-bad)'
                                : 'var(--fo-ink)',

                            fontSize:
                              '9px',
                          }}
                        >
                          {formatShortDate(day.date, language)}
                        </th>

                      )
                    )}

                  </tr>

                </thead>


                <tbody>

                  {locationSequenceRows.length ===
                    0 ? (

                    <tr>

                      <td
                        colSpan={
                          visibleDays.length +
                          2
                        }

                        style={{
                          padding:
                            '40px 20px',

                          color:
                            'var(--fo-muted)',

                          textAlign:
                            'center',

                          borderBottom:
                            '1px solid var(--fo-line-soft)',
                        }}
                      >
                        {t.noLocations}
                      </td>

                    </tr>

                  ) : (

                    locationSequenceRows.map(
                      (
                        locationRow,
                        locationIndex
                      ) => (

                        <tr
                          key={
                            locationRow.key
                          }
                        >

                          <td
                            style={{
                              ...bodyCellStyle,

                              width:
                                '54px',

                              minWidth:
                                '54px',

                              textAlign:
                                'center',

                              fontWeight:
                                700,
                            }}
                          >
                            {locationIndex + 1}
                          </td>


                          <td
                            title={
                              locationRow.path
                            }

                            style={{
                              ...bodyCellStyle,

                              width:
                                '330px',

                              minWidth:
                                '330px',

                              padding:
                                '7px 12px',

                              textAlign:
                                'left',
                            }}
                          >

                            <div
                              style={{
                                color:
                                  'var(--fo-ink)',

                                fontSize:
                                  '11px',

                                fontWeight:
                                  800,
                              }}
                            >
                              {locationRow.name}
                            </div>


                            {locationRow.path &&
                              locationRow.path !==
                              locationRow.name && (

                              <div
                                style={{
                                  marginTop:
                                    '3px',

                                  color:
                                    'var(--fo-muted)',

                                  fontSize:
                                    '9px',
                                }}
                              >
                                {locationRow.path}
                              </div>

                            )}

                          </td>


                          {visibleDays.map(
                            (
                              day
                            ) => {

                              const activeItems =
                                locationRow.items.filter(
                                  (
                                    item
                                  ) => {

                                    if (
                                      day.isWeekend ||
                                      day.isHoliday
                                    ) {
                                      return false;
                                    }


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


                              const activeItem =
                                activeItems[0] ||
                                null;


                              const code =
                                activeItem
                                  ? getPackageCode(
                                      activeItem
                                    )
                                  : '';


                              const color =
                                code
                                  ? getServiceColor(
                                      code,
                                      organizationWorkPackages
                                    )
                                  : '';


                              const textColor =
                                color
                                  ? getTextColor(
                                      color
                                    )
                                  : 'var(--fo-muted)';


                              const tooltip =
                                activeItems
                                  .map(
                                    (
                                      item
                                    ) =>
                                      `${getPackageCode(
                                        item
                                      )} · ${getServiceName(
                                        item
                                      )}`
                                  )
                                  .join(
                                    '\n'
                                  );


                              return (

                                <td
                                  key={
                                    `${locationRow.key}-${day.iso}`
                                  }

                                  title={
                                    day.isHoliday
                                      ? day.holidayDescription
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

                                    textAlign:
                                      'center',

                                    background:
                                      code
                                        ? color
                                        : day.isHoliday
                                          ? 'var(--fo-bad-wash)'
                                          : day.isWeekend
                                            ? 'var(--fo-sunken)'
                                            : '#ffffff',

                                    color:
                                      code
                                        ? textColor
                                        : day.isHoliday
                                          ? 'var(--fo-bad)'
                                          : 'var(--fo-muted)',

                                    fontSize:
                                      '10px',

                                    fontWeight:
                                      code
                                        ? 900
                                        : 500,

                                    boxShadow:
                                      day.isHoliday
                                        ? 'inset 0 0 0 1px #fca5a5'
                                        : 'none',
                                  }}
                                >
                                  {code
                                    ? code
                                    : day.isHoliday
                                      ? t.holAbbr
                                      : day.isWeekend
                                        ? t.offAbbr
                                        : ''}
                                </td>

                              );

                            }
                          )}

                        </tr>

                      )
                    )

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
                  '1px solid var(--fo-line)',

                color:
                  'var(--fo-muted)',

                fontSize:
                  '9px',
              }}
            >
              <strong>
                {t.locationView}
              </strong>

              <span>
                {t.locationRow}
              </span>

              <span>
                {t.locationCell}
              </span>

              <span>
                {t.locationOff}
              </span>

              <span>
                {t.locationHol}
              </span>

              <span>
                {t.locationManualHidden}
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
            className={styles.sheet}
          >

            <div
              className={styles.sheetTitle}
            >
              {t.constraintsTitle}
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
                    'var(--fo-muted)',

                  fontSize:
                    '12px',
                }}
              >
                {t.noConstraints}
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
                      {t.colPackage}
                    </th>

                    <th style={headerCellStyle}>
                      {t.colDescription}
                    </th>

                    <th style={headerCellStyle}>
                      {t.colConstraint}
                    </th>

                    <th style={headerCellStyle}>
                      {t.colStatus}
                    </th>

                    <th style={headerCellStyle}>
                      {t.colSource}
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
                          {koskelaLabel(column.key)}
                        </td>


                        <td style={bodyCellStyle}>
                          {t.active}
                        </td>


                        <td style={bodyCellStyle}>

                          {row.row_type ===
                          'manual'
                            ? t.sourceLookahead
                            : t.sourceMasterPlan}

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
          INSERT PACKAGE (lookahead only)
      ===================================================== */}

      {showInsertPackageModal && (
        <Dialog
          as="form"
          onSubmit={submitInsertPackage}
          title={t.insertPackage}
          text={t.insertHelp}
          onClose={() => { if (!insertingPackage) setShowInsertPackageModal(false); }}
          footer={(
            <>
              <button type="button" className={ui.btn} disabled={insertingPackage} onClick={() => setShowInsertPackageModal(false)}>
                {t.cancel}
              </button>
              <button
                type="submit"
                className={ui.btnPrimary}
                disabled={insertingPackage || !insertPackageWorkPackageId || !insertPackageLineId || !insertPackageStartDate || Number(insertPackageDuration) < 1}
              >
                {insertingPackage ? t.inserting : t.insertPackage}
              </button>
            </>
          )}
        >
          <label className={ui.field}>
            <span className={ui.fieldLabel}>{t.workPackage}</span>
            <select value={insertPackageWorkPackageId} required onChange={(event) => setInsertPackageWorkPackageId(event.target.value)}>
              <option value="">{t.selectWorkPackage}</option>
              {organizationWorkPackages.map((workPackage) => (
                <option key={workPackage.id} value={workPackage.id}>
                  {workPackage.code} · {workPackage.description}
                </option>
              ))}
            </select>
          </label>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>{t.lineId}</span>
            <select value={insertPackageLineId} required onChange={(event) => setInsertPackageLineId(event.target.value)}>
              {Array.from({ length: sheetRows.length + 1 }, (_, index) => index + 1).map((lineId) => (
                <option key={lineId} value={lineId}>
                  {t.line} {lineId}{lineId === sheetRows.length + 1 ? t.bottomSuffix : ''}
                </option>
              ))}
            </select>
            <span className={styles.hint}>{t.lineHelp}</span>
          </label>

          <div className={styles.grid2}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>{t.startDate}</span>
              <input
                type="date"
                value={insertPackageStartDate}
                min={selectedPlan?.window_start_date || windowStart || undefined}
                max={selectedPlan?.window_finish_date || undefined}
                required
                onChange={(event) => setInsertPackageStartDate(event.target.value)}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>{t.duration} ({t.workingDays})</span>
              <input type="number" min={1} step={1} value={insertPackageDuration} required onChange={(event) => setInsertPackageDuration(Number(event.target.value))} />
            </label>
          </div>

          <p className={styles.hint}>{t.insertFoot}</p>
        </Dialog>
      )}

      {selectedProjectId &&
        !selectedPlanId &&
        !loading && (

          <Empty
            title={t.noPlan}
            text={t.noPlanText}
            action={
              <button type="button" className={ui.btnPrimary} disabled={creatingPlan} onClick={createLookaheadFromBaseline}>
                {creatingPlan ? t.creatingPlan : t.newFromBaseline}
              </button>
            }
          />

        )}

      {showHolidays && (
        <Dialog
          size="small"
          title={t.holidaysTitle}
          text={t.holidaysText}
          onClose={() => setShowHolidays(false)}
          footer={<button type="button" className={ui.btnPrimary} onClick={() => setShowHolidays(false)}>{t.close}</button>}
        >
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <tbody>
                {[...masterPlanHolidays]
                  .sort((x, y) => String(x.date).localeCompare(String(y.date)))
                  .map((holiday) => (
                    <tr key={holiday.date}>
                      <td>{formatLongDate(holiday.date, language)}</td>
                      <td>{holiday.description || t.holiday}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Dialog>
      )}

      {dialogs.element}

    </div>
  );
}


// ============================================================
// STYLES
// ============================================================

const headerCellStyle = {
  border: '1px solid var(--fo-line-soft)',
  padding: '6px 4px',
  background: 'var(--fo-sunken)',
  color: 'var(--fo-muted)',
  textAlign: 'center',
  fontSize: '11px',
  fontWeight: 600,
};


const calendarHeaderStyle = {
  ...headerCellStyle,
  width: DAY_WIDTH,
  minWidth: DAY_WIDTH,
  padding: '3px 1px',
  fontSize: '10px',
};


const bodyCellStyle = {
  border: '1px solid var(--fo-line-soft)',
  padding: '3px',
  background: 'var(--fo-surface)',
  color: 'var(--fo-ink)',
  textAlign: 'center',
  verticalAlign: 'middle',
};




















const menuButtonStyle = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  border: 0,
  borderRadius: '6px',
  background: 'transparent',
  color: 'var(--fo-ink)',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
};






