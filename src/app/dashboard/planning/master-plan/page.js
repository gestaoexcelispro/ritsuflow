'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import { readPreconProjectId, rememberPreconProjectId } from '../../preconProject';
import { useT } from '../../../../lib/i18n/useT';
import { useLanguage } from '../../../../lib/i18n/LanguageProvider';
import { Badge, Empty, Icon, Segments, ui } from '../../../fieldop/ui';
import { Dialog, usePreconDialogs } from '../../preconDialogs';
import styles from '../../precon.module.css';

// ============================================================
// MASTER PLAN
// The project's activities (Projects › Scope) are the schedulable
// packages; locations come from the project's location structure.
// ============================================================

// ============================================================
// SYSTEM CALENDAR MARKERS
// ============================================================
//
// IMPORTANT:
// Activities are NOT hard-coded in Master Plan. They come from the
// project's scope (see buildProjectActivityCatalog below).
//
// These three entries are system/calendar markers only.
// They are not project activities.
// ============================================================
const SYSTEM_CALENDAR_CODES = {
  '': {
    labelPt: '',
    labelEn: '',
    color: 'transparent',
    text: '#000'
  },

  OFF: {
    labelPt: 'Fim de Semana',
    labelEn: 'Weekend',
    color: '#a0aec0',
    text: '#fff'
  },

  FER: {
    labelPt: 'Feriado',
    labelEn: 'Holiday',
    color: '#e53e3e',
    text: '#fff'
  }
};


const getContrastYIQ = (hexcolor) => {
  const hex = hexcolor.replace("#", "");
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
};


// ----------------------------------------------------
// MASTER PLAN LOCATION STRUCTURE INTEGRATION
// ----------------------------------------------------
// The canonical RitsuFlow Location Structure becomes the default
// planning backbone for NEW / BLANK Master Plan scenarios.
//
// Existing saved scenarios are never overwritten. Their saved sections
// remain exactly as they were when the scenario was created.
//
// Leaf locations become planning rows. Their immediate parent path becomes
// the visual section title. Stable IDs are derived from the canonical
// location UUIDs so saved grid cells remain deterministic.
const buildMasterPlanSectionsFromLocations = (locations = []) => {
  if (!Array.isArray(locations) || locations.length === 0) {
    return [];
  }

  const locationMap = new Map(
    locations.map((location) => [location.id, location])
  );

  const childCount = new Map();

  locations.forEach((location) => {
    if (!location.parent_id) return;

    childCount.set(
      location.parent_id,
      (childCount.get(location.parent_id) || 0) + 1
    );
  });

  const pathCache = new Map();

  const buildPath = (location) => {
    if (!location) return '';
    if (pathCache.has(location.id)) return pathCache.get(location.id);

    const parts = [];
    const visited = new Set();
    let current = location;

    while (current && !visited.has(current.id)) {
      visited.add(current.id);

      if (current.name) {
        parts.unshift(current.name);
      }

      current = current.parent_id
        ? locationMap.get(current.parent_id)
        : null;
    }

    const path = parts.join(' / ');
    pathCache.set(location.id, path);

    return path;
  };

  const planningLocations = locations.filter(
    (location) => !childCount.has(location.id)
  );

  const rowsSource =
    planningLocations.length > 0
      ? planningLocations
      : locations;

  const sectionMap = new Map();

  rowsSource.forEach((location) => {
    const parent = location.parent_id
      ? locationMap.get(location.parent_id)
      : null;

    const sectionKey = parent?.id || 'root';

    const sectionTitle = parent
      ? buildPath(parent)
      : 'PROJECT LOCATIONS';

    if (!sectionMap.has(sectionKey)) {
      sectionMap.set(sectionKey, {
        id: `locsec_${sectionKey}`,
        title: sectionTitle || 'PROJECT LOCATIONS',
        source: 'location_structure',
        locationParentId: parent?.id || null,
        rows: [],
      });
    }

    sectionMap.get(sectionKey).rows.push({
      id: `loc_${location.id}`,
      description: location.name || buildPath(location),
      locationId: location.id,
      locationPath: buildPath(location),
      source: 'location_structure',
      sequenceNumber: Number(location.sequence_number || 0),
    });
  });

  return Array.from(sectionMap.values())
    .map((section) => ({
      ...section,
      rows: [...section.rows].sort((a, b) => {
        const bySequence =
          Number(a.sequenceNumber || 0) -
          Number(b.sequenceNumber || 0);

        if (bySequence !== 0) return bySequence;

        return String(a.description || '').localeCompare(
          String(b.description || '')
        );
      }),
    }))
    .sort((a, b) =>
      String(a.title || '').localeCompare(
        String(b.title || '')
      )
    );
};

// ============================================================
// PROJECT ACTIVITIES (Projects › Scope)
// ============================================================
// Master Plan schedules the project's active activities
// (fieldop_project_activities, each linked to a project_scopes item).
// Each activity gets a short key shown in the grid cells: its scope
// code when it fits in 3 characters (master_plan_packages.package_code
// allows 1 to 3), otherwise A1, A2, ... The full scope code is kept
// as service_code.
const ACTIVITY_COLORS = [
  '#2563EB', '#16A34A', '#EA580C', '#9333EA', '#0891B2', '#DC2626',
  '#CA8A04', '#DB2777', '#4F46E5', '#059669', '#B45309', '#7C3AED',
];

const compareScopeCodes = (a, b) => {
  const left = String(a || '').split('.');
  const right = String(b || '').split('.');
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const x = left[index] ?? '';
    const y = right[index] ?? '';
    const difference = (Number(x) || 0) - (Number(y) || 0);
    if (difference) return difference;
    if (x !== y) return x.localeCompare(y);
  }
  return 0;
};

const buildProjectActivityCatalog = (activities = []) => {
  const reserved = new Set(Object.keys(SYSTEM_CALENDAR_CODES));
  const catalog = {};
  let fallback = 0;

  const rows = activities
    .map((activity) => {
      const scope = activity.scope_item || null;
      const fromScope = activity.source === 'scope' && scope;
      return {
        activity,
        scopeCode: String((fromScope && scope.scope_code) || '').trim(),
        name: (fromScope && scope.scope_name) || activity.activity_name || '',
        unit: (fromScope && scope.unit) || activity.unit || '',
      };
    })
    .sort((a, b) =>
      (a.scopeCode && b.scopeCode)
        ? compareScopeCodes(a.scopeCode, b.scopeCode)
        : (a.scopeCode ? -1 : b.scopeCode ? 1 : String(a.name).localeCompare(String(b.name)))
    );

  rows.forEach(({ activity, scopeCode, name, unit }, index) => {
    let key = scopeCode.toUpperCase();
    if (!key || key.length > 3 || reserved.has(key) || catalog[key]) {
      do {
        fallback += 1;
        key = `A${fallback}`;
      } while (catalog[key]);
    }

    const color = ACTIVITY_COLORS[index % ACTIVITY_COLORS.length];

    catalog[key] = {
      labelPt: name || key,
      labelEn: name || key,
      color,
      text: getContrastYIQ(color),
      activityId: activity.id,
      projectServiceId: null,
      projectWorkPackageId: null,
      sourceServiceCode: scopeCode || key,
      unit,
      source: 'project_activities',
    };
  });

  return catalog;
};

export default function MasterPlanPage() {
  // Texts live in messages/precon.<language>.json under masterPlan.*; `t.key` reads them.
  const translate = useT('precon');
  const { language } = useLanguage();
  const t = React.useMemo(
    () => new Proxy({}, { get: (_, key) => translate(`masterPlan.${String(key)}`) }),
    [translate]
  );
  const dialogs = usePreconDialogs();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [isBaselineFrozen, setIsBaselineFrozen] = useState(false);
  const [controlMode, setControlMode] = useState(false);

  const [dataInicio, setDataInicio] = useState('2026-08-03');
  const [dataFim, setDataFim] = useState('2026-10-31');
  const [hideWeekends, setHideWeekends] = useState(false);

  // ============================================================
  // PROJECT ACTIVITY CATALOG
  // ============================================================
  //
  // Keyed by the short activity code shown in the grid
  // (buildProjectActivityCatalog). OFF / FER are calendar markers,
  // not activities, so they remain system-level visual definitions.
  //
  const [projectServices, setProjectServices] = useState({});

  const workPackageCatalog = {
    ...projectServices,

    '': SYSTEM_CALENDAR_CODES[''],
    OFF: SYSTEM_CALENDAR_CODES.OFF,
    FER: SYSTEM_CALENDAR_CODES.FER
  };


  const [showHolidaysModal, setShowHolidaysModal] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayDescription, setNewHolidayDescription] = useState('');

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfConfig, setPdfConfig] = useState({ formato: 'a3', orientacao: 'landscape' });

  const [scenarios, setScenarios] = useState([]);
  const [activeScenarioId, setActiveScenarioId] = useState(null);

  // MOTOR DE AGENDAMENTO (SCHEDULING ENGINE)
  const [workPackages, setWorkPackages] = useState([]); 
  const [showWorkPackageModal, setShowWorkPackageModal] = useState(false);
  const [packageStartType, setPackageStartType] = useState('date'); 
  const [predecessorPackageId, setPredecessorPackageId] = useState('');
  const [packageActivity, setPackageActivity] = useState('');
  const [packageRowId, setPackageRowId] = useState('');
  const [packageStartDate, setPackageStartDate] = useState('');
  const [packageDuration, setPackageDuration] = useState(1);

  // WORK SEQUENCE GENERATOR
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [sequenceLocations, setSequenceLocations] = useState([]);
  const [sequenceActivities, setSequenceActivities] = useState([]);
  const [sequenceNewActivity, setSequenceNewActivity] = useState('');
  const [sequenceStartType, setSequenceStartType] = useState('date');
  const [sequenceStartDate, setSequenceStartDate] = useState('');
  const [sequencePredecessor, setSequencePredecessor] = useState('');
  const [sequenceStartLag, setSequenceStartLag] = useState(0);
  const [sequenceConfigurations, setSequenceConfigurations] = useState([]);
  const [activeSequenceConfigId, setActiveSequenceConfigId] = useState(null);
  const [sequenceName, setSequenceName] = useState('');
  const [sequenceEditingId, setSequenceEditingId] = useState(null);
  const [sequenceDrag, setSequenceDrag] = useState(null);
  const [sequenceDragOver, setSequenceDragOver] = useState(null);
  const [packageDrag, setPackageDrag] = useState(null);

  const [calendarDates, setCalendarDates] = useState([]);
  const [plannedCellData, setPlannedCellData] = useState({});
  const [actualCellData, setActualCellData] = useState({});
  const [zonasColeta, setZonasColeta] = useState([]);

  // Canonical Location Structure template used by new / blank scenarios.
  // Saved scenarios keep their own persisted section snapshots.
  const [
    locationStructureSections,
    setLocationStructureSections
  ] = useState([]);

  const [sections, setSections] = useState([]);

  // ----------------------------------------------------
  // ----------------------------------------------------
  const [history, setHistory] = useState([]);
  const isUndoRef = useRef(false);

  const saveHistory = () => {
    setHistory(prev => [...prev, {
      packages: JSON.stringify(workPackages),
      plannedCells: JSON.stringify(plannedCellData),
      actualCells: JSON.stringify(actualCellData),
      holidays: JSON.stringify(holidays),
      sections: JSON.stringify(sections)
    }]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    
    isUndoRef.current = true;
    
    const newHistory = [...history];
    const snapshot = newHistory.pop();
    setHistory(newHistory);

    setWorkPackages(JSON.parse(snapshot.packages));
    setPlannedCellData(JSON.parse(snapshot.plannedCells));
    setActualCellData(JSON.parse(snapshot.actualCells));
    setHolidays(JSON.parse(snapshot.holidays));
    setSections(JSON.parse(snapshot.sections));
    setActiveScenarioId(null);
  };
  // ----------------------------------------------------

  const formatScenarioDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString(
      language,
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }
    );
  };

  const mapScenarioRecord = (record) => ({
    id: record.id,
    nome: record.name,
    data: formatScenarioDate(record.updated_at || record.created_at),
    status: record.status,
    isBaseline: Boolean(record.is_baseline),
    plannedStartDate: record.planned_start_date,
    plannedFinishDate: record.planned_finish_date,
    planData: record.plan_data || {}
  });

  const applySavedPlan = (scenario) => {
    const plan = scenario?.planData || {};

    setWorkPackages(Array.isArray(plan.packages) ? plan.packages : []);
    setHolidays(Array.isArray(plan.holidays) ? plan.holidays : []);

    if (Array.isArray(plan.sections) && plan.sections.length > 0) {
      setSections(plan.sections);
    }

    setPlannedCellData(
      plan.plannedCells && typeof plan.plannedCells === 'object'
        ? plan.plannedCells
        : {}
    );

    setActualCellData(
      plan.actualCells && typeof plan.actualCells === 'object'
        ? plan.actualCells
        : {}
    );

    setHideWeekends(Boolean(plan.hideWeekends));

    const savedSequenceConfigurations =
      Array.isArray(plan.sequenceConfigurations)
        ? plan.sequenceConfigurations
        : [];

    setSequenceConfigurations(savedSequenceConfigurations);
    setActiveSequenceConfigId(savedSequenceConfigurations[0]?.id || null);
    setSequenceEditingId(null);

    if (scenario?.plannedStartDate) setDataInicio(scenario.plannedStartDate);
    if (scenario?.plannedFinishDate) setDataFim(scenario.plannedFinishDate);

    setIsBaselineFrozen(Boolean(scenario?.isBaseline));
    setControlMode(Boolean(scenario?.isBaseline));
    setActiveScenarioId(scenario?.id || null);
    setHistory([]);
  };

  const getPackageDependencies = (packageItem) => {
    if (
      Array.isArray(
        packageItem?.dependencies
      ) &&
      packageItem.dependencies.length > 0
    ) {
      return packageItem.dependencies
        .filter(
          (dependency) =>
            dependency?.predecessorId
        )
        .map(
          (dependency) => ({
            type:
              dependency.type ||
              'external',
            predecessorId:
              dependency.predecessorId,
            lagWorkingDays:
              Math.max(
                0,
                Number(
                  dependency.lagWorkingDays ||
                  0
                )
              )
          })
        );
    }

    if (
      packageItem?.packageStartType ===
        'predecessor' &&
      packageItem?.predecessorId
    ) {
      return [
        {
          type: 'external',
          predecessorId:
            packageItem.predecessorId,
          lagWorkingDays:
            Math.max(
              0,
              Number(
                packageItem.lagWorkingDays ||
                0
              )
            )
        }
      ];
    }

    return [];
  };

  // ----------------------------------------------------
  // OPTIMIZED DEPENDENCY NETWORK RECONSTRUCTION
  // ----------------------------------------------------
  // This is intentionally calculated ONCE with useMemo below.
  // Never call this helper from individual calendar cells.
  const getPackageSequenceConfig = (
    packageItem
  ) => {
    if (!packageItem) return null;

    if (packageItem.sequenceGroupId) {
      const directConfig =
        sequenceConfigurations.find(
          (config) =>
            config.id ===
            packageItem.sequenceGroupId
        );

      if (directConfig) {
        return directConfig;
      }
    }

    // Legacy fallback for a generated package created before
    // sequenceGroupId was persisted.
    if (
      packageItem.generatedBySequence &&
      sequenceConfigurations.length === 1
    ) {
      return sequenceConfigurations[0];
    }

    return null;
  };

  const isSequenceAnchorPackage = (
    packageItem
  ) => {
    const config =
      getPackageSequenceConfig(
        packageItem
      );

    if (!config) return false;

    const firstLocation =
      (
        config.locations ||
        []
      ).find(
        (location) =>
          location.selected !== false
      );

    const firstActivity =
      (
        config.activities ||
        []
      )[0];

    if (
      !firstLocation ||
      !firstActivity
    ) {
      return false;
    }

    return (
      packageItem.rowId ===
        firstLocation.rowId &&
      packageItem.activity ===
        firstActivity.code
    );
  };

  const rebuildDependencyNetwork = (
    packagesSnapshot
  ) => {
    const packages =
      Array.isArray(
        packagesSnapshot
      )
        ? packagesSnapshot
        : [];

    if (
      packages.length === 0
    ) {
      return [];
    }

    // IMPORTANT:
    // Location flow must NOT be inferred from the visual top-to-bottom
    // order of the Line of Balance rows. The user may have reordered
    // locations inside the Work Sequence Generator, and the execution
    // direction may be bottom-to-top.
    //
    // workPackages preserves the original generator order, because
    // the generator creates every activity for Location 1, then every
    // activity for Location 2, and so on.
    //
    // Therefore the first appearance of each rowId is the safest
    // representation of the actual Location Flow that was saved.
    const orderedRowIds = [];

    packages.forEach(
      (pkg) => {
        if (
          pkg?.rowId &&
          !orderedRowIds.includes(
            pkg.rowId
          )
        ) {
          orderedRowIds.push(
            pkg.rowId
          );
        }
      }
    );

    // Fallback only for rows that currently have no package.
    // They are appended after the saved execution-flow rows and do
    // not alter the dependency order of existing scheduled packages.
    sections.forEach(
      (section) => {
        (
          section.rows ||
          []
        ).forEach(
          (row) => {
            if (
              row?.id &&
              !orderedRowIds.includes(
                row.id
              )
            ) {
              orderedRowIds.push(
                row.id
              );
            }
          }
        );
      }
    );

    const rowIndex =
      new Map(
        orderedRowIds.map(
          (
            rowId,
            index
          ) => [
            rowId,
            index
          ]
        )
      );

    // Activity order comes from first appearance in the
    // current package snapshot, which preserves the generator
    // sequence without scanning the calendar.
    const orderedActivities =
      [];

    packages.forEach(
      (pkg) => {
        if (
          pkg?.activity &&
          !orderedActivities.includes(
            pkg.activity
          )
        ) {
          orderedActivities.push(
            pkg.activity
          );
        }
      }
    );

    const activityIndex =
      new Map(
        orderedActivities.map(
          (
            activity,
            index
          ) => [
            activity,
            index
          ]
        )
      );

    const packageAt =
      new Map();

    packages.forEach(
      (pkg) => {
        packageAt.set(
          `${pkg.rowId}___${pkg.activity}`,
          pkg
        );
      }
    );

    return packages.map(
      (pkg) => {
        const isSequenceAnchor =
          isSequenceAnchorPackage(
            pkg
          );

        const existing =
          isSequenceAnchor
            ? []
            : getPackageDependencies(
                pkg
              );

        const dependencies =
          [];

        const seen =
          new Set();

        const addDependency = (
          dependency
        ) => {
          if (
            !dependency
              ?.predecessorId ||
            dependency
              .predecessorId ===
              pkg.id
          ) {
            return;
          }

          const key =
            `${dependency.type || 'external'}___${dependency.predecessorId}`;

          if (
            seen.has(
              key
            )
          ) {
            return;
          }

          seen.add(
            key
          );

          dependencies.push({
            type:
              dependency.type ||
              'external',

            predecessorId:
              dependency
                .predecessorId,

            lagWorkingDays:
              Math.max(
                0,
                Number(
                  dependency
                    .lagWorkingDays ||
                  0
                )
              )
          });
        };

        // Keep explicit external anchors.
        existing
          .filter(
            (dependency) =>
              dependency.type ===
              'external'
          )
          .forEach(
            addDependency
          );

        const hasSavedTrade =
          existing.some(
            (dependency) =>
              dependency.type ===
              'trade'
          );

        const hasSavedFlow =
          existing.some(
            (dependency) =>
              dependency.type ===
              'flow'
          );

        const currentRowIndex =
          rowIndex.get(
            pkg.rowId
          );

        const currentActivityIndex =
          activityIndex.get(
            pkg.activity
          );

        // TRADE dependency:
        // previous activity in the SAME location.
        if (
          !isSequenceAnchor &&
          !hasSavedTrade &&
          Number.isInteger(
            currentActivityIndex
          ) &&
          currentActivityIndex > 0
        ) {
          const previousActivity =
            orderedActivities[
              currentActivityIndex -
                1
            ];

          const previousTrade =
            packageAt.get(
              `${pkg.rowId}___${previousActivity}`
            );

          if (
            previousTrade
          ) {
            const existingTrade =
              existing.find(
                (dependency) =>
                  dependency.type ===
                    'trade' &&
                  dependency
                    .predecessorId ===
                    previousTrade.id
              );

            addDependency({
              type: 'trade',

              predecessorId:
                previousTrade.id,

              lagWorkingDays:
                existingTrade
                  ?.lagWorkingDays ??
                (
                  pkg.predecessorId ===
                  previousTrade.id
                    ? Number(
                        pkg.lagWorkingDays ||
                        0
                      )
                    : 0
                )
            });
          }
        }

        // FLOW dependency:
        // same activity in the immediately previous location
        // where that activity exists.
        if (
          !isSequenceAnchor &&
          !hasSavedFlow &&
          Number.isInteger(
            currentRowIndex
          ) &&
          currentRowIndex > 0
        ) {
          for (
            let previousRowIndex =
              currentRowIndex -
                1;
            previousRowIndex >=
            0;
            previousRowIndex -= 1
          ) {
            const previousRowId =
              orderedRowIds[
                previousRowIndex
              ];

            const previousLocation =
              packageAt.get(
                `${previousRowId}___${pkg.activity}`
              );

            if (
              !previousLocation
            ) {
              continue;
            }

            const existingFlow =
              existing.find(
                (dependency) =>
                  dependency.type ===
                    'flow' &&
                  dependency
                    .predecessorId ===
                    previousLocation.id
              );

            addDependency({
              type: 'flow',

              predecessorId:
                previousLocation.id,

              lagWorkingDays:
                existingFlow
                  ?.lagWorkingDays ??
                (
                  pkg.predecessorId ===
                  previousLocation.id
                    ? Number(
                        pkg.lagWorkingDays ||
                        0
                      )
                    : 0
                )
            });

            break;
          }
        }

        // Preserve any other previously stored relationships.
        existing.forEach(
          addDependency
        );

        return {
          ...pkg,
          dependencies
        };
      }
    );
  };

  // One dependency-network rebuild per schedule/section change.
  // This avoids the performance problem from Step 12.5 where
  // the network was reconstructed repeatedly inside cell logic.
  const networkPackages =
    React.useMemo(
      () =>
        rebuildDependencyNetwork(
          workPackages
        ),
      [
        workPackages,
        sections
      ]
    );

  const networkPackageById =
    React.useMemo(
      () =>
        new Map(
          networkPackages.map(
            (pkg) => [
              pkg.id,
              pkg
            ]
          )
        ),
      [
        networkPackages
      ]
    );

  const buildPlanData = () => ({
    sections: sections,
    packages: workPackages,
    plannedCells: plannedCellData,
    actualCells: actualCellData,
    holidays: holidays,
    hideWeekends: hideWeekends,
    sequenceConfigurations
  });

  const getPackageDatesInVisibleGrid = (
    packageItem
  ) => {
    if (
      !packageItem?.rowId ||
      !packageItem?.activity
    ) {
      return {
        scheduledStartDate: null,
        scheduledFinishDate: null
      };
    }

    const matchingDates =
      calendarDates
        .filter(
          (day) => {
            if (
              day.isWeekend ||
              day.isHoliday
            ) {
              return false;
            }

            const cellKey =
              `${packageItem.rowId}___${day.isoDate}`;

            return (
              plannedCellData[
                cellKey
              ] ===
              packageItem.activity
            );
          }
        )
        .map(
          (day) =>
            day.isoDate
        );

    return {
      scheduledStartDate:
        matchingDates[0] ||
        null,

      scheduledFinishDate:
        matchingDates[
          matchingDates.length -
            1
        ] ||
        null
    };
  };

  const createImmutableScheduleSnapshot = (
    packagesSnapshot
  ) => {
    const rawPackages =
      Array.isArray(
        packagesSnapshot
      )
        ? packagesSnapshot
        : [];

    const packages =
      rebuildDependencyNetwork(
        rawPackages
      );

    const schedules =
      calculateFullPackageSchedule(
        packages
      );

    const snapshot =
      new Map();

    packages.forEach(
      (pkg) => {
        const schedule =
          schedules.get(
            pkg.id
          ) ||
          null;

        snapshot.set(
          pkg.id,
          {
            scheduledStartDate:
              schedule
                ? (
                    calendarDates[
                      schedule.startIndex
                    ]?.isoDate ||
                    null
                  )
                : null,

            scheduledFinishDate:
              schedule
                ? (
                    calendarDates[
                      schedule.endIndex
                    ]?.isoDate ||
                    null
                  )
                : null,

            sequenceGroupId:
              pkg.sequenceGroupId ||
              getPackageSequenceConfig(
                pkg
              )?.id ||
              null
          }
        );
      }
    );

    return {
      packages,
      snapshot
    };
  };


  const syncNormalizedPackages = async (
    scenarioId,
    packagesSnapshot = workPackages,
    immutableScheduleSnapshot = null
  ) => {
    if (!scenarioId || !selectedProjectId) {
      return {
        ok: false,
        error: new Error(
          'Scenario or project is missing.'
        )
      };
    }

    const preparedSchedule =
      immutableScheduleSnapshot &&
      immutableScheduleSnapshot.packages &&
      immutableScheduleSnapshot.snapshot
        ? immutableScheduleSnapshot
        : createImmutableScheduleSnapshot(
            packagesSnapshot
          );

    const packages =
      preparedSchedule.packages;

    const immutableSnapshot =
      preparedSchedule.snapshot;

    // IMPORTANT:
    // The schedule snapshot is built BEFORE the async persistence flow.
    //
    // packageSchedule is the authoritative schedule already used to draw
    // the Line of Balance. Persisting those exact results guarantees
    // that the database dates match what the user sees on screen.
    //
    // This also avoids timing differences between regeneration, drag,
    // calendar expansion and the save operation.

    // ----------------------------------------------------
    // 1. CLEAR PREVIOUS NORMALIZED NETWORK
    // ----------------------------------------------------
    const {
      error: dependencyDeleteError
    } = await supabase
      .from(
        'master_plan_package_dependencies'
      )
      .delete()
      .eq(
        'scenario_id',
        scenarioId
      )
      .eq(
        'project_id',
        selectedProjectId
      );

    if (dependencyDeleteError) {
      console.error(
        'Master Plan - delete normalized dependencies:',
        dependencyDeleteError
      );

      return {
        ok: false,
        error: dependencyDeleteError
      };
    }

    const {
      error: deleteError
    } = await supabase
      .from(
        'master_plan_packages'
      )
      .delete()
      .eq(
        'scenario_id',
        scenarioId
      )
      .eq(
        'project_id',
        selectedProjectId
      );

    if (deleteError) {
      console.error(
        'Master Plan - delete normalized packages:',
        deleteError
      );

      return {
        ok: false,
        error: deleteError
      };
    }

    if (packages.length === 0) {
      return {
        ok: true,
        insertedCount: 0,
        dependencyCount: 0
      };
    }

    // ----------------------------------------------------
    // 2. LOOKUP MAPS
    // ----------------------------------------------------
    const rowById = new Map();

    sections.forEach((section) => {
      (section.rows || []).forEach((row) => {
        rowById.set(
          row.id,
          row
        );
      });
    });

    const packageByUiId =
      new Map(
        packages.map(
          (pkg) => [
            pkg.id,
            pkg
          ]
        )
      );

    const dbIdByUiId =
      new Map();

    const inserted =
      new Set();

    const visiting =
      new Set();

    // ----------------------------------------------------
    // 3. INSERT PACKAGES IN DEPENDENCY ORDER
    //
    // This preserves the existing DB constraint:
    //
    // predecessor start rule
    //     => predecessor_package_id must already exist.
    //
    // We still preserve EVERY logical predecessor separately
    // in master_plan_package_dependencies afterward.
    // ----------------------------------------------------
    const insertPackage = async (
      pkg,
      sequenceNumber
    ) => {
      if (!pkg?.id) {
        throw new Error(
          'Master Plan package is missing its UI identifier.'
        );
      }

      if (
        inserted.has(
          pkg.id
        )
      ) {
        return dbIdByUiId.get(
          pkg.id
        );
      }

      if (
        visiting.has(
          pkg.id
        )
      ) {
        throw new Error(
          `Circular dependency detected for package ${pkg.id}.`
        );
      }

      visiting.add(
        pkg.id
      );

      const dependencies =
        getPackageDependencies(
          pkg
        );

      // Compatibility controlling predecessor.
      // The full network is stored later in the dependency table.
      const controllingDependency =
        dependencies.find(
          (dependency) =>
            dependency.predecessorId ===
            pkg.predecessorId
        ) ||
        dependencies[0] ||
        null;

      let controllingPredecessorDbId =
        null;

      if (
        controllingDependency
          ?.predecessorId
      ) {
        const predecessor =
          packageByUiId.get(
            controllingDependency
              .predecessorId
          );

        if (!predecessor) {
          throw new Error(
            `Predecessor ${controllingDependency.predecessorId} was not found in this scenario.`
          );
        }

        const predecessorIndex =
          packages.findIndex(
            (item) =>
              item.id ===
              predecessor.id
          );

        controllingPredecessorDbId =
          await insertPackage(
            predecessor,
            predecessorIndex >= 0
              ? predecessorIndex
              : 0
          );
      }

      const row =
        rowById.get(
          pkg.rowId
        ) || null;

      const service =
        workPackageCatalog[
          pkg.activity
        ] || null;

      const hasPredecessor =
        Boolean(
          controllingPredecessorDbId
        );

      const fallbackStartDate =
        pkg.startDate ||
        dataInicio ||
        null;

      const persistedSchedule =
        immutableSnapshot.get(
          pkg.id
        ) ||
        null;

      const scheduledStartDate =
        persistedSchedule
          ?.scheduledStartDate ||
        null;

      const scheduledFinishDate =
        persistedSchedule
          ?.scheduledFinishDate ||
        null;

      if (
        !scheduledStartDate ||
        !scheduledFinishDate
      ) {
        console.warn(
          'Master Plan - immutable schedule snapshot missing dates:',
          {
            packageId:
              pkg.id,
            packageCode:
              pkg.activity,
            rowId:
              pkg.rowId
          }
        );
      }

      const persistedSequenceGroupId =
        persistedSchedule
          ?.sequenceGroupId ||
        null;

      const payload = {
        scenario_id:
          scenarioId,

        project_id:
          selectedProjectId,

        location_id:
          pkg.locationId ||
          row?.locationId ||
          null,

        project_service_id:
          pkg.projectServiceId ||
          service?.projectServiceId ||
          null,

        activity_id:
          pkg.activityId ||
          service?.activityId ||
          null,

        row_key:
          pkg.rowId ||
          null,

        package_code:
          String(
            pkg.activity ||
            ''
          )
            .trim()
            .toUpperCase()
            .slice(
              0,
              3
            ) ||
          null,

        location_name:
          row?.description ||
          null,

        location_path:
          pkg.locationPath ||
          row?.locationPath ||
          row?.description ||
          null,

        service_name:
          service?.labelEn ||
          pkg.activity ||
          null,

        service_code:
          service?.sourceServiceCode ||
          pkg.activity ||
          null,

        unit:
          service?.unit ||
          null,

        start_rule:
          hasPredecessor
            ? 'predecessor'
            : 'date',

        planned_start_date:
          hasPredecessor
            ? null
            : fallbackStartDate,

        predecessor_package_id:
          controllingPredecessorDbId,

        duration_working_days:
          Math.max(
            1,
            Number(
              pkg.duration ||
              1
            )
          ),

        lag_working_days:
          Math.max(
            0,
            Number(
              controllingDependency
                ?.lagWorkingDays ||
              pkg.lagWorkingDays ||
              0
            )
          ),

        manual_delay_working_days:
          Math.max(
            0,
            Number(
              pkg.manualDelayWorkingDays ||
              0
            )
          ),

        scheduled_start_date:
          scheduledStartDate,

        scheduled_finish_date:
          scheduledFinishDate,

        sequence_group_id:
          persistedSequenceGroupId,

        sequence_number:
          Math.max(
            0,
            Number(
              sequenceNumber ||
              0
            )
          )
      };

      const {
        data: insertedPackage,
        error: insertError
      } = await supabase
        .from(
          'master_plan_packages'
        )
        .insert(
          payload
        )
        .select(`
          id,
          scheduled_start_date,
          scheduled_finish_date,
          sequence_group_id
        `)
        .single();

      if (insertError) {
        throw insertError;
      }

      if (
        scheduledStartDate &&
        insertedPackage
          ?.scheduled_start_date !==
          scheduledStartDate
      ) {
        throw new Error(
          `Master Plan schedule persistence mismatch for ${pkg.activity}: expected start ${scheduledStartDate}, stored ${insertedPackage?.scheduled_start_date || 'NULL'}.`
        );
      }

      if (
        scheduledFinishDate &&
        insertedPackage
          ?.scheduled_finish_date !==
          scheduledFinishDate
      ) {
        throw new Error(
          `Master Plan schedule persistence mismatch for ${pkg.activity}: expected finish ${scheduledFinishDate}, stored ${insertedPackage?.scheduled_finish_date || 'NULL'}.`
        );
      }

      dbIdByUiId.set(
        pkg.id,
        insertedPackage.id
      );

      inserted.add(
        pkg.id
      );

      visiting.delete(
        pkg.id
      );

      return insertedPackage.id;
    };

    try {
      for (
        let index = 0;
        index < packages.length;
        index += 1
      ) {
        await insertPackage(
          packages[index],
          index
        );
      }
    } catch (error) {
      console.error(
        'Master Plan - normalized package insertion:',
        error
      );

      return {
        ok: false,
        error
      };
    }

    // ----------------------------------------------------
    // 4. INSERT FULL MULTI-PREDECESSOR NETWORK
    // ----------------------------------------------------
    const dependencyRows =
      [];

    packages.forEach((pkg) => {
      const packageDbId =
        dbIdByUiId.get(
          pkg.id
        );

      if (!packageDbId) {
        return;
      }

      getPackageDependencies(
        pkg
      ).forEach(
        (dependency) => {
          const predecessorDbId =
            dbIdByUiId.get(
              dependency
                .predecessorId
            );

          if (
            !predecessorDbId
          ) {
            return;
          }

          dependencyRows.push({
            scenario_id:
              scenarioId,

            project_id:
              selectedProjectId,

            package_id:
              packageDbId,

            predecessor_package_id:
              predecessorDbId,

            dependency_type:
              dependency.type ||
              'external',

            lag_working_days:
              Math.max(
                0,
                Number(
                  dependency
                    .lagWorkingDays ||
                  0
                )
              )
          });
        }
      );
    });

    if (
      dependencyRows.length > 0
    ) {
      const {
        error:
          dependencyInsertError
      } = await supabase
        .from(
          'master_plan_package_dependencies'
        )
        .insert(
          dependencyRows
        );

      if (
        dependencyInsertError
      ) {
        console.error(
          'Master Plan - insert dependency network:',
          dependencyInsertError
        );

        return {
          ok: false,
          error:
            dependencyInsertError
        };
      }
    }

    return {
      ok: true,
      insertedCount:
        inserted.size,
      dependencyCount:
        dependencyRows.length
    };
  };

  useEffect(() => {
    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          code,
          name,
          status,
          created_at
        `)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Master Plan - projects:', error);
        return;
      }

      const projects = data || [];
      setProjects(projects);

      // Open the project chosen in the URL or last selected in PreCon.
      const projectIdFromUrl = readPreconProjectId();
      if (projectIdFromUrl && projects.some((project) => project.id === projectIdFromUrl)) {
        setSelectedProjectId(projectIdFromUrl);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    const loadProjectMasterPlan = async () => {
      if (!selectedProjectId) {
        setZonasColeta([]);
        setLocationStructureSections([]);
        setSections([]);
        setProjectServices({});
        setScenarios([]);
        setActiveScenarioId(null);
        setSequenceConfigurations([]);
        setActiveSequenceConfigId(null);
        setSequenceEditingId(null);
        setIsBaselineFrozen(false);
        setControlMode(false);
        setHistory([]);
        return;
      }

      const [
        locationsResult,
        activitiesResult,
        scenariosResult
      ] = await Promise.all([
        supabase
          .from('locations')
          .select(`
            id,
            project_id,
            parent_id,
            name,
            location_type,
            environment_type,
            sequence_number
          `)
          .eq('project_id', selectedProjectId)
          .order('sequence_number', { ascending: true })
          .order('name', { ascending: true }),

        // ----------------------------------------------------
        // PROJECT ACTIVITIES (Projects › Scope)
        // ----------------------------------------------------
        supabase
          .from('fieldop_project_activities')
          .select(`
            id,
            source,
            activity_name,
            unit,
            is_active,
            scope_item:project_scopes(id, scope_code, scope_name, unit)
          `)
          .eq('project_id', selectedProjectId)
          .eq('is_active', true),

        supabase
          .from('master_plan_scenarios')
          .select(`
            id,
            project_id,
            name,
            status,
            planned_start_date,
            planned_finish_date,
            is_baseline,
            plan_data,
            created_at,
            updated_at
          `)
          .eq('project_id', selectedProjectId)
          .order('is_baseline', { ascending: false })
          .order('updated_at', { ascending: false })
      ]);

      const loadError =
        locationsResult.error ||
        activitiesResult.error ||
        scenariosResult.error;

      if (loadError) {
        console.error('Master Plan - load:', loadError);
        dialogs.notify(`${t.scenarioLoadError}\n${loadError.message}`, 'bad');
        return;
      }

      const locations = locationsResult.data || [];
      const locationMap = new Map(locations.map((location) => [location.id, location]));
      const pathCache = new Map();

      const buildLocationPath = (location) => {
        if (!location) return '';
        if (pathCache.has(location.id)) return pathCache.get(location.id);

        const parts = [];
        const visited = new Set();
        let current = location;

        while (current && !visited.has(current.id)) {
          visited.add(current.id);
          if (current.name) parts.unshift(current.name);
          current = current.parent_id ? locationMap.get(current.parent_id) : null;
        }

        const path = parts.join(' / ');
        pathCache.set(location.id, path);
        return path;
      };

      const canonicalSections =
        buildMasterPlanSectionsFromLocations(
          locations
        );

      setLocationStructureSections(
        canonicalSections
      );

      // Only planning rows (leaf locations) are exposed as selectable
      // Master Plan locations. Full paths stay available for context.
      setZonasColeta(
        [
          ...new Set(
            canonicalSections.flatMap(
              (section) =>
                section.rows.map(
                  (row) =>
                    row.locationPath ||
                    row.description
                )
            )
          ),
        ].filter(Boolean)
      );

      // The project's activities from Projects › Scope are the
      // schedulable Master Plan activities (see buildProjectActivityCatalog).
      setProjectServices(
        buildProjectActivityCatalog(
          activitiesResult.data || []
        )
      );

      const mappedVersions = (scenariosResult.data || []).map(mapScenarioRecord);
      setScenarios(mappedVersions);

      const initialVersion =
        mappedVersions.find((item) => item.isBaseline) ||
        mappedVersions[0] ||
        null;

      if (initialVersion) {
        applySavedPlan(initialVersion);
      } else {
        setActiveScenarioId(null);
        setIsBaselineFrozen(false);
        setControlMode(false);
        setSequenceConfigurations([]);
        setActiveSequenceConfigId(null);
        setSequenceEditingId(null);
        setWorkPackages([]);
        setHolidays([]);
        setPlannedCellData({});
        setActualCellData({});

        // New Master Plans start from the project's canonical
        // Location Structure instead of the old hard-coded rows.
        setSections(canonicalSections);

        setHistory([]);
      }
    };

    loadProjectMasterPlan();
  }, [selectedProjectId]);
  // CALENDAR GENERATION
  useEffect(() => {
    const generateCalendarDates = () => {
      if (!dataInicio || !dataFim || !selectedProjectId) return;

      const parseLocalDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        return new Date(year, month - 1, day);
      };

      const startDate = parseLocalDate(dataInicio);
      const endDate = parseLocalDate(dataFim);

      if (endDate < startDate) { setCalendarDates([]); return; }

      const dates = [];
      let currentDate = new Date(startDate);
      // Header labels follow the user's language (day/month order, weekday names).
      const dayMonth = new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit' });
      const weekday = new Intl.DateTimeFormat(language, { weekday: 'short' });

      while (currentDate <= endDate) {
        const clonedDate = new Date(currentDate);
        const day = String(clonedDate.getDate()).padStart(2, '0');
        const month = String(clonedDate.getMonth() + 1).padStart(2, '0');
        const year = clonedDate.getFullYear();
        const weekdayIndex = clonedDate.getDay();
        
        const isoDate = `${year}-${month}-${day}`;
        const isHoliday = holidays.some(f => f.date === isoDate);

        dates.push({
          dateLabel: dayMonth.format(clonedDate),
          weekLabel: weekday.format(clonedDate).replace('.', ''),
          isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
          isHoliday: isHoliday,
          isoDate: isoDate // Stable database and history key
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      setCalendarDates(dates);
    };
    generateCalendarDates();
  }, [dataInicio, dataFim, holidays, selectedProjectId, language]);

  const visibleDates = calendarDates.filter(d => hideWeekends ? !d.isWeekend : true);

  // ----------------------------------------------------
  // DYNAMIC FLOW SCHEDULING ENGINE
  // ----------------------------------------------------
  // Calculates the complete package network from every
  // Trade / Flow / External dependency.
  //
  // manualDelayWorkingDays is an ADDITIONAL offset after
  // the earliest legal start. Horizontal dragging changes
  // this offset, never the package's Location or dependency
  // identity.
  const calculateFullPackageSchedule = (
    packagesSnapshot = workPackages
  ) => {
    const packages =
      Array.isArray(packagesSnapshot)
        ? packagesSnapshot
        : [];

    const packageById =
      new Map(
        packages.map(
          (packageItem) => [
            packageItem.id,
            packageItem
          ]
        )
      );

    const scheduleCache =
      new Map();

    const isWorkingDay = (
      index
    ) => {
      const day =
        calendarDates[index];

      return Boolean(
        day &&
        !day.isWeekend &&
        !day.isHoliday
      );
    };

    const nextWorkingDayIndex = (
      index
    ) => {
      let current =
        Math.max(
          0,
          Number(
            index ||
            0
          )
        );

      while (
        current <
          calendarDates.length &&
        !isWorkingDay(
          current
        )
      ) {
        current += 1;
      }

      return current;
    };

    const advanceWorkingDaysFromStart = (
      startIndex,
      workingDays
    ) => {
      let current =
        nextWorkingDayIndex(
          startIndex
        );

      let remaining =
        Math.max(
          0,
          Number(
            workingDays ||
            0
          )
        );

      while (
        remaining > 0 &&
        current + 1 <
          calendarDates.length
      ) {
        current += 1;

        if (
          isWorkingDay(
            current
          )
        ) {
          remaining -= 1;
        }
      }

      return nextWorkingDayIndex(
        current
      );
    };

    const calculate = (
      packageItem,
      stack = new Set()
    ) => {
      if (
        !packageItem?.id
      ) {
        return null;
      }

      if (
        scheduleCache.has(
          packageItem.id
        )
      ) {
        return scheduleCache.get(
          packageItem.id
        );
      }

      if (
        stack.has(
          packageItem.id
        )
      ) {
        console.error(
          'Master Plan - circular dependency detected:',
          packageItem.id
        );

        return null;
      }

      const nextStack =
        new Set(
          stack
        );

      nextStack.add(
        packageItem.id
      );

      const dependencies =
        getPackageDependencies(
          packageItem
        );

      let earliestLegalStart =
        -1;

      if (
        dependencies.length === 0
      ) {
        earliestLegalStart =
          calendarDates.findIndex(
            (day) =>
              day.isoDate ===
              packageItem.startDate
          );

        earliestLegalStart =
          nextWorkingDayIndex(
            earliestLegalStart
          );
      } else {
        dependencies.forEach(
          (dependency) => {
            const predecessor =
              packageById.get(
                dependency
                  .predecessorId
              );

            if (!predecessor) {
              return;
            }

            const predecessorSchedule =
              calculate(
                predecessor,
                nextStack
              );

            if (
              !predecessorSchedule ||
              predecessorSchedule.endIndex <
                0
            ) {
              return;
            }

            // Lag occurs AFTER predecessor finish.
            let readyIndex =
              predecessorSchedule
                .endIndex;

            let remainingLag =
              Math.max(
                0,
                Number(
                  dependency
                    .lagWorkingDays ||
                  0
                )
              );

            while (
              remainingLag > 0 &&
              readyIndex + 1 <
                calendarDates.length
            ) {
              readyIndex += 1;

              if (
                isWorkingDay(
                  readyIndex
                )
              ) {
                remainingLag -= 1;
              }
            }

            // Successor begins on the next working day.
            readyIndex =
              nextWorkingDayIndex(
                readyIndex + 1
              );

            earliestLegalStart =
              Math.max(
                earliestLegalStart,
                readyIndex
              );
          }
        );
      }

      if (
        earliestLegalStart < 0 ||
        earliestLegalStart >=
          calendarDates.length
      ) {
        return null;
      }

      const startIndex =
        dependencies.length > 0
          ? advanceWorkingDaysFromStart(
              earliestLegalStart,
              Math.max(
                0,
                Number(
                  packageItem
                    .manualDelayWorkingDays ||
                  0
                )
              )
            )
          : earliestLegalStart;

      if (
        startIndex < 0 ||
        startIndex >=
          calendarDates.length
      ) {
        return null;
      }

      let allocatedDays = 0;
      let endIndex =
        startIndex;

      for (
        let index = startIndex;
        index <
          calendarDates.length &&
        allocatedDays <
          Math.max(
            1,
            Number(
              packageItem.duration ||
              1
            )
          );
        index += 1
      ) {
        if (
          isWorkingDay(
            index
          )
        ) {
          allocatedDays += 1;
          endIndex = index;
        }
      }

      const result = {
        startIndex,
        endIndex:
          allocatedDays > 0
            ? endIndex
            : -1,
        earliestLegalStart
      };

      scheduleCache.set(
        packageItem.id,
        result
      );

      return result;
    };

    packages.forEach(
      (packageItem) => {
        calculate(
          packageItem
        );
      }
    );

    return scheduleCache;
  };

  const countWorkingDaysBetweenIndices = (
    fromIndex,
    toIndex
  ) => {
    if (
      toIndex <=
      fromIndex
    ) {
      return 0;
    }

    let count = 0;

    for (
      let index =
        fromIndex + 1;
      index <=
        toIndex;
      index += 1
    ) {
      const day =
        calendarDates[index];

      if (
        day &&
        !day.isWeekend &&
        !day.isHoliday
      ) {
        count += 1;
      }
    }

    return count;
  };

  const normalizeDragTarget = (
    targetIndex,
    direction = 1
  ) => {
    let index =
      Math.max(
        0,
        Math.min(
          Number(
            targetIndex ||
            0
          ),
          Math.max(
            0,
            calendarDates.length -
              1
          )
        )
      );

    const step =
      direction < 0
        ? -1
        : 1;

    while (
      index >= 0 &&
      index <
        calendarDates.length &&
      (
        calendarDates[
          index
        ]?.isWeekend ||
        calendarDates[
          index
        ]?.isHoliday
      )
    ) {
      index += step;
    }

    if (
      index < 0
    ) {
      index = 0;

      while (
        index <
          calendarDates.length &&
        (
          calendarDates[
            index
          ]?.isWeekend ||
          calendarDates[
            index
          ]?.isHoliday
        )
      ) {
        index += 1;
      }
    }

    if (
      index >=
      calendarDates.length
    ) {
      index =
        calendarDates.length -
        1;

      while (
        index >= 0 &&
        (
          calendarDates[
            index
          ]?.isWeekend ||
          calendarDates[
            index
          ]?.isHoliday
        )
      ) {
        index -= 1;
      }
    }

    return Math.max(
      0,
      index
    );
  };

  const packageSchedule =
    React.useMemo(
      () =>
        calculateFullPackageSchedule(
          networkPackages
        ),
      [
        networkPackages,
        calendarDates
      ]
    );

  const packageByCell =
    React.useMemo(
      () => {
        const map =
          new Map();

        networkPackages.forEach(
          (packageItem) => {
            const schedule =
              packageSchedule.get(
                packageItem.id
              );

            if (!schedule) return;

            let allocatedDays = 0;

            for (
              let index =
                schedule.startIndex;
              index <
                calendarDates.length &&
              allocatedDays <
                Math.max(
                  1,
                  Number(
                    packageItem.duration ||
                    1
                  )
                );
              index += 1
            ) {
              const day =
                calendarDates[index];

              if (
                day &&
                !day.isWeekend &&
                !day.isHoliday
              ) {
                map.set(
                  `${packageItem.rowId}___${day.isoDate}`,
                  packageItem
                );

                allocatedDays += 1;
              }
            }
          }
        );

        return map;
      },
      [
        networkPackages,
        packageSchedule,
        calendarDates
      ]
    );

  const startPackageDrag = (
    event,
    packageItem,
    sourceDataIso
  ) => {
    if (
      !packageItem ||
      isBaselineFrozen
    ) {
      return;
    }

    const schedule =
      packageSchedule.get(
        packageItem.id
      );

    if (!schedule) return;

    const sourceIndex =
      calendarDates.findIndex(
        (day) =>
          day.isoDate ===
          sourceDataIso
      );

    if (
      sourceIndex < 0
    ) {
      return;
    }

    // Preserve the exact point where the user grabbed the
    // multi-day package. If the user grabs day 2 of a 3-day
    // package and drops it five cells earlier, the WHOLE package
    // moves five cells earlier — the dropped cell does not become
    // the package start.
    const grabOffset =
      Math.max(
        0,
        sourceIndex -
          schedule.startIndex
      );

    event.dataTransfer.effectAllowed =
      'move';

    event.dataTransfer.setData(
      'text/plain',
      packageItem.id
    );

    setPackageDrag({
      packageId:
        packageItem.id,
      rowId:
        packageItem.rowId,
      startIndex:
        schedule.startIndex,
      sourceIndex,
      grabOffset,
      targetIndex:
        sourceIndex
    });
  };

  const updatePackageDragTarget = (
    event,
    rowId,
    isoDate
  ) => {
    if (
      !packageDrag ||
      packageDrag.rowId !==
        rowId
    ) {
      return;
    }

    event.preventDefault();

    event.dataTransfer.dropEffect =
      'move';

    const index =
      calendarDates.findIndex(
        (day) =>
          day.isoDate ===
          isoDate
      );

    if (index < 0) return;

    setPackageDrag(
      (current) =>
        current
          ? {
              ...current,
              targetIndex:
                index
            }
          : current
    );
  };

  const finishPackageDrag = (
    event,
    rowId,
    isoDate
  ) => {
    if (!packageDrag) {
      return;
    }

    // RULE: manual drag cannot change Location row.
    if (
      packageDrag.rowId !==
      rowId
    ) {
      setPackageDrag(null);
      return;
    }

    event.preventDefault();

    const rawTargetIndex =
      calendarDates.findIndex(
        (day) =>
          day.isoDate ===
          isoDate
      );

    if (
      rawTargetIndex < 0
    ) {
      setPackageDrag(null);
      return;
    }

    const rawProposedStart =
      rawTargetIndex -
      Math.max(
        0,
        Number(
          packageDrag.grabOffset ||
          0
        )
      );

    const dragDirection =
      rawProposedStart <
      packageDrag.startIndex
        ? -1
        : 1;

    const targetIndex =
      normalizeDragTarget(
        rawProposedStart,
        dragDirection
      );

    const packageItem =
      networkPackageById.get(
        packageDrag.packageId
      ) || null;

    if (!packageItem) {
      setPackageDrag(null);
      return;
    }

    const schedule =
      packageSchedule.get(
        packageItem.id
      );

    if (!schedule) {
      setPackageDrag(null);
      return;
    }

    saveHistory();

    const isSequenceAnchor =
      isSequenceAnchorPackage(
        packageItem
      );

    const dependencies =
      isSequenceAnchor
        ? []
        : getPackageDependencies(
            packageItem
          );

    setWorkPackages(
      (current) =>
        current.map(
          (item) => {
            if (
              item.id !==
              packageItem.id
            ) {
              return item;
            }

            // Anchor package:
            // horizontal movement changes only its explicit start date.
            if (
              dependencies.length ===
              0
            ) {
              const legalTarget =
                Math.max(
                  0,
                  targetIndex
                );

              const newStartDate =
                calendarDates[
                  legalTarget
                ]?.isoDate ||
                item.startDate;

              const sequenceConfig =
                getPackageSequenceConfig(
                  item
                );

              if (
                sequenceConfig
              ) {
                setSequenceConfigurations(
                  (currentConfigs) =>
                    currentConfigs.map(
                      (config) =>
                        config.id ===
                        sequenceConfig.id
                          ? {
                              ...config,
                              startType:
                                'data',
                              startDate:
                                newStartDate,
                              predecessorId:
                                '',
                              startLag:
                                0,
                              updatedAt:
                                new Date().toISOString()
                            }
                          : config
                    )
                );
              }

              return {
                ...item,
                packageStartType:
                  'data',
                startDate:
                  newStartDate,
                predecessorId:
                  '',
                dependencies: [],
                lagWorkingDays:
                  0,
                manualDelayWorkingDays:
                  0
              };
            }

            // Dependent package:
            // package remains connected to ALL predecessors.
            //
            // Dragging later adds a manual working-day delay after
            // the earliest legal start.
            //
            // Dragging earlier reduces that delay, but never below
            // the dependency-constrained earliest legal start.
            const earliestLegalStart =
              schedule
                .earliestLegalStart;

            const legalTarget =
              Math.max(
                earliestLegalStart,
                targetIndex
              );

            const manualDelay =
              countWorkingDaysBetweenIndices(
                earliestLegalStart,
                legalTarget
              );

            const repairedPackage =
              networkPackageById.get(
                item.id
              );

            return {
              ...item,

              dependencies:
                repairedPackage
                  ?.dependencies ||
                item.dependencies ||
                [],

              manualDelayWorkingDays:
                manualDelay
            };
          }
        )
    );

    setPackageDrag(null);
  };

  useEffect(() => {
    if (
      calendarDates.length === 0
    ) {
      return;
    }

    if (
      isUndoRef.current
    ) {
      isUndoRef.current =
        false;

      return;
    }

    const newGrid = {};

    networkPackages.forEach(
      (packageItem) => {
        const schedule =
          packageSchedule.get(
            packageItem.id
          );

        if (!schedule) return;

        let allocatedDays = 0;

        for (
          let index =
            schedule.startIndex;
          index <
            calendarDates.length &&
          allocatedDays <
            Math.max(
              1,
              Number(
                packageItem.duration ||
                1
              )
            );
          index += 1
        ) {
          const day =
            calendarDates[index];

          if (
            day &&
            !day.isWeekend &&
            !day.isHoliday
          ) {
            newGrid[
              `${packageItem.rowId}___${day.isoDate}`
            ] =
              packageItem.activity;

            allocatedDays += 1;
          }
        }
      }
    );

    setPlannedCellData(
      newGrid
    );
  }, [
    networkPackages,
    calendarDates,
    packageSchedule
  ]);

  const calculateSuggestedRole = () => {
    const dateColumnCount = visibleDates.length;
    const estimatedWidthPx = 320 + (dateColumnCount * 45);

    if (estimatedWidthPx <= 1047) return 'a4';
    if (estimatedWidthPx <= 1512) return 'a3';
    if (estimatedWidthPx <= 2170) return 'a2';
    if (estimatedWidthPx <= 3103) return 'a1';
    if (estimatedWidthPx <= 4418) return 'a0';
    return 'unica';
  };
  
  const formatoIdealCode = calculateSuggestedRole();

  const handleCellChange = (rowId, isoDate, value) => {
    saveHistory();
    setPlannedCellData(prev => ({ ...prev, [`${rowId}___${isoDate}`]: value }));
  };

  const handleActualCellChange = (rowId, isoDate, value) => {
    saveHistory();
    setActualCellData(prev => ({ ...prev, [`${rowId}___${isoDate}`]: value }));
  };

  const handleFreezeBaseline = async () => {
    if (!(await dialogs.confirm(t.confirmFreeze))) return;
    if (!selectedProjectId) return;

    let targetScenarioId = activeScenarioId;

    if (!targetScenarioId) {
      const nomeCenario = await dialogs.prompt(t.promptScenario);
      if (!nomeCenario?.trim()) return;

      const { data: createdScenario, error: createError } = await supabase
        .from('master_plan_scenarios')
        .insert({
          project_id: selectedProjectId,
          name: nomeCenario.trim(),
          status: 'draft',
          planned_start_date: dataInicio || null,
          planned_finish_date: dataFim || null,
          plan_data: buildPlanData()
        })
        .select(`
          id,
          project_id,
          name,
          status,
          planned_start_date,
          planned_finish_date,
          is_baseline,
          plan_data,
          created_at,
          updated_at
        `)
        .single();

      if (createError) {
        console.error('Master Plan - create baseline scenario:', createError);
        dialogs.notify(`${t.scenarioSaveError}\n${createError.message}`, 'bad');
        return;
      }

      const createdVersion = mapScenarioRecord(createdScenario);
      setScenarios((prev) => [createdVersion, ...prev]);

      targetScenarioId = createdScenario.id;
      setActiveScenarioId(targetScenarioId);
    }

    const previousBaselines = scenarios.filter(
      (item) => item.isBaseline && item.id !== targetScenarioId
    );

    for (const baseline of previousBaselines) {
      const { error: clearError } = await supabase
        .from('master_plan_scenarios')
        .update({
          is_baseline: false,
          status: 'active'
        })
        .eq('id', baseline.id)
        .eq('project_id', selectedProjectId);

      if (clearError) {
        console.error('Master Plan - clear previous baseline:', clearError);
        dialogs.notify(`${t.scenarioSaveError}\n${clearError.message}`, 'bad');
        return;
      }
    }

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .update({
        is_baseline: true,
        status: 'baseline',
        planned_start_date: dataInicio || null,
        planned_finish_date: dataFim || null,
        plan_data: buildPlanData()
      })
      .eq('id', targetScenarioId)
      .eq('project_id', selectedProjectId)
      .select(`
        id,
        project_id,
        name,
        status,
        planned_start_date,
        planned_finish_date,
        is_baseline,
        plan_data,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Master Plan - freeze baseline:', error);
      dialogs.notify(`${t.scenarioSaveError}\n${error.message}`, 'bad');
      return;
    }

    const frozenVersion = mapScenarioRecord(data);

    setScenarios((prev) =>
      prev.map((item) => {
        if (item.id === frozenVersion.id) return frozenVersion;

        if (item.isBaseline) {
          return {
            ...item,
            isBaseline: false,
            status: item.status === 'baseline' ? 'active' : item.status
          };
        }

        return item;
      })
    );

    setActiveScenarioId(frozenVersion.id);
    setIsBaselineFrozen(true);
    setControlMode(true);

    const immutableScheduleSnapshot =
      createImmutableScheduleSnapshot(
        workPackages
      );

    const packageSync =
      await syncNormalizedPackages(
        frozenVersion.id,
        workPackages,
        immutableScheduleSnapshot
      );

    if (!packageSync.ok) {
      dialogs.notify(
        `${t.packageSyncError}
${
          packageSync.error?.message ||
          ''
        }`, 'bad');
    }
  };

  const handleUnfreeze = async () => {
    if (!(await dialogs.confirm(t.confirmUnfreeze, { danger: true }))) return;

    if (activeScenarioId) {
      const { data, error } = await supabase
        .from('master_plan_scenarios')
        .update({
          is_baseline: false,
          status: 'active',
          plan_data: buildPlanData(),
          planned_start_date: dataInicio || null,
          planned_finish_date: dataFim || null
        })
        .eq('id', activeScenarioId)
        .eq('project_id', selectedProjectId)
        .select(`
          id,
          project_id,
          name,
          status,
          planned_start_date,
          planned_finish_date,
          is_baseline,
          plan_data,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        console.error('Master Plan - unfreeze baseline:', error);
        dialogs.notify(`${t.scenarioSaveError}\n${error.message}`, 'bad');
        return;
      }

      const updatedVersion = mapScenarioRecord(data);

      setScenarios((prev) =>
        prev.map((item) =>
          item.id === updatedVersion.id ? updatedVersion : item
        )
      );
    }

    setIsBaselineFrozen(false);
    setControlMode(false);
  };

  // ----------------------------------------------------
  const handleSaveScenario = async () => {
    if (!selectedProjectId) return;

    const nomeCenario = await dialogs.prompt(t.promptScenario);
    if (!nomeCenario?.trim()) return;

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .insert({
        project_id: selectedProjectId,
        name: nomeCenario.trim(),
        status: 'draft',
        planned_start_date: dataInicio || null,
        planned_finish_date: dataFim || null,
        plan_data: buildPlanData()
      })
      .select(`
        id,
        project_id,
        name,
        status,
        planned_start_date,
        planned_finish_date,
        is_baseline,
        plan_data,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Master Plan - save scenario:', error);
      dialogs.notify(`${t.scenarioSaveError}\n${error.message}`, 'bad');
      return;
    }

    const newScenario = mapScenarioRecord(data);

    setScenarios((prev) => [
      newScenario,
      ...prev.filter((item) => item.id !== newScenario.id)
    ]);

    setActiveScenarioId(newScenario.id);

    const immutableScheduleSnapshot =
      createImmutableScheduleSnapshot(
        workPackages
      );

    const packageSync =
      await syncNormalizedPackages(
        newScenario.id,
        workPackages,
        immutableScheduleSnapshot
      );

    if (!packageSync.ok) {
      dialogs.notify(
        `${t.packageSyncError}
${
          packageSync.error?.message ||
          ''
        }`, 'bad');
      return;
    }

    dialogs.notify(t.scenarioSaved, 'ok');
  };

  const handleUpdateScenario = async () => {
    if (!activeScenarioId) return;

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .update({
        planned_start_date: dataInicio || null,
        planned_finish_date: dataFim || null,
        plan_data: buildPlanData()
      })
      .eq('id', activeScenarioId)
      .eq('project_id', selectedProjectId)
      .select(`
        id,
        project_id,
        name,
        status,
        planned_start_date,
        planned_finish_date,
        is_baseline,
        plan_data,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Master Plan - update scenario:', error);
      dialogs.notify(`${t.scenarioSaveError}\n${error.message}`, 'bad');
      return;
    }

    const updatedScenario = mapScenarioRecord(data);

    setScenarios((prev) =>
      prev.map((item) =>
        item.id === updatedScenario.id ? updatedScenario : item
      )
    );

    const immutableScheduleSnapshot =
      createImmutableScheduleSnapshot(
        workPackages
      );

    const packageSync =
      await syncNormalizedPackages(
        updatedScenario.id,
        workPackages,
        immutableScheduleSnapshot
      );

    if (!packageSync.ok) {
      dialogs.notify(
        `${t.packageSyncError}
${
          packageSync.error?.message ||
          ''
        }`, 'bad');
      return;
    }

    dialogs.notify(t.scenarioUpdated, 'ok');
  };

  const handleDuplicateScenario = async () => {
    if (!selectedProjectId) return;

    const nomeCopia = await dialogs.prompt(t.promptDuplicate);
    if (!nomeCopia?.trim()) return;

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .insert({
        project_id: selectedProjectId,
        name: nomeCopia.trim(),
        status: 'draft',
        planned_start_date: dataInicio || null,
        planned_finish_date: dataFim || null,
        is_baseline: false,
        plan_data: buildPlanData()
      })
      .select(`
        id,
        project_id,
        name,
        status,
        planned_start_date,
        planned_finish_date,
        is_baseline,
        plan_data,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Master Plan - duplicate scenario:', error);
      dialogs.notify(`${t.scenarioSaveError}\n${error.message}`, 'bad');
      return;
    }

    const newScenario = mapScenarioRecord(data);

    setScenarios((prev) => [newScenario, ...prev]);
    setActiveScenarioId(newScenario.id);
    setIsBaselineFrozen(false);
    setControlMode(false);

    const immutableScheduleSnapshot =
      createImmutableScheduleSnapshot(
        workPackages
      );

    const packageSync =
      await syncNormalizedPackages(
        newScenario.id,
        workPackages,
        immutableScheduleSnapshot
      );

    if (!packageSync.ok) {
      dialogs.notify(
        `${t.packageSyncError}
${
          packageSync.error?.message ||
          ''
        }`, 'bad');
      return;
    }

    dialogs.notify(t.scenarioSaved, 'ok');
  };

  const handleLoadScenario = async (scenarioId) => {
    if (!scenarioId) {
      if ((await dialogs.confirm(t.confirmClear, { danger: true }))) {
        saveHistory();
        setWorkPackages([]);
        setHolidays([]);
        setPlannedCellData({});
        setActualCellData({});
        setSequenceConfigurations([]);
        setActiveSequenceConfigId(null);
        setSequenceEditingId(null);

        // Blank Scenario means a fresh plan using the project's
        // current canonical Location Structure.
        if (locationStructureSections.length > 0) {
          setSections(
            JSON.parse(
              JSON.stringify(
                locationStructureSections
              )
            )
          );
        }

        setActiveScenarioId(null);
        setIsBaselineFrozen(false);
        setControlMode(false);
      }
      return;
    }

    if (!(await dialogs.confirm(t.confirmLoad))) return;

    saveHistory();

    const scenario = scenarios.find((item) => item.id === scenarioId);

    if (scenario) applySavedPlan(scenario);
  };
  // ----------------------------------------------------

  const handleAddHoliday = (e) => {
    e.preventDefault();
    if (newHolidayDate && newHolidayDescription) {
      if (holidays.find(f => f.date === newHolidayDate)) return dialogs.notify(t.errHolidayExists, 'warn');
      saveHistory();
      setHolidays([...holidays, { date: newHolidayDate, description: newHolidayDescription }]);
      setNewHolidayDate(''); 
      setNewHolidayDescription('');
    }
  };
  
  const handleRemoveHoliday = (data) => {
    saveHistory();
    setHolidays(holidays.filter(f => f.date !== data));
  };

  const handleAddSection = () => {
    saveHistory();
    setSections([...sections, { id: `sec_${Date.now()}`, title: t.newSecTitle, rows: [] }]);
  };
  
  const handleUpdateSectionTitle = (secId, newTitle) => setSections(sections.map(s => s.id === secId ? { ...s, title: newTitle } : s));
  
  const handleRemoveSection = async (secId) => {
    if (await dialogs.confirm(t.confirmDelSection, { danger: true })) {
      saveHistory();
      setSections(sections.filter(s => s.id !== secId)); 
    }
  };
  
  const handleAddRow = (secId) => {
    saveHistory();

    setSections(
      sections.map((section) =>
        section.id === secId
          ? {
              ...section,
              rows: [
                ...section.rows,
                {
                  id: `l_${Date.now()}`,
                  description: '',
                  locationId: null,
                  locationPath: '',
                  source: 'manual'
                }
              ]
            }
          : section
      )
    );
  };

  const handleUpdateRow = (secId, rowId, value) =>
    setSections(
      sections.map((section) =>
        section.id === secId
          ? {
              ...section,
              rows: section.rows.map((row) =>
                row.id === rowId
                  ? {
                      ...row,
                      description: value,
                      // Editing a canonical row turns it into a manual row.
                      // This prevents a renamed label from silently pointing
                      // to the wrong Location Structure record.
                      locationId:
                        row.source === 'location_structure'
                          ? null
                          : row.locationId || null,
                      locationPath:
                        row.source === 'location_structure'
                          ? ''
                          : row.locationPath || '',
                      source:
                        row.source === 'location_structure'
                          ? 'manual'
                          : row.source || 'manual'
                    }
                  : row
              )
            }
          : section
      )
    );
  
  const handleRemoveRow = (secId, rowId) => {
    saveHistory();
    setSections(sections.map(s => s.id === secId ? { ...s, rows: s.rows.filter(l => l.id !== rowId) } : s));
  };

  const existingPackages = workPackages.map(p => {
    let desc = p.rowId;
    sections.forEach(sec => sec.rows.forEach(l => { if(l.id === p.rowId) desc = l.description; }));
    const sName = workPackageCatalog[p.activity]?.labelEn || p.activity;
    return {
      id: p.id,
      label: `${desc} - ${sName}`
    };
  });

  const abrirGeradorSequencia = () => {
    const rows = [];

    sections.forEach((section) => {
      (section.rows || []).forEach((row) => {
        if (!row?.id) return;

        rows.push({
          rowId: row.id,
          locationId: row.locationId || null,
          label: row.locationPath || row.description || row.id,
          selected: true
        });
      });
    });

    setSequenceLocations(rows);
    setSequenceActivities([]);
    setSequenceNewActivity('');
    setSequenceStartType('date');
    setSequenceStartDate('');
    setSequencePredecessor('');
    setSequenceStartLag(0);
    setSequenceName(t.defaultSequenceName);
    setSequenceEditingId(null);
    setShowSequenceModal(true);
  };

  const abrirConfiguracoesSequencia = () => {
    const config =
      sequenceConfigurations.find(
        (item) => item.id === activeSequenceConfigId
      ) ||
      sequenceConfigurations[0] ||
      null;

    if (!config) {
      dialogs.notify(t.noSequenceConfigured, 'warn');
      return;
    }

    const currentRows = new Map();

    sections.forEach((section) => {
      (section.rows || []).forEach((row) => {
        currentRows.set(row.id, row);
      });
    });

    const restoredLocations =
      Array.isArray(config.locations)
        ? config.locations.map((saved) => {
            const row = currentRows.get(saved.rowId);

            return {
              rowId: saved.rowId,
              locationId:
                saved.locationId ||
                row?.locationId ||
                null,
              label:
                saved.label ||
                row?.locationPath ||
                row?.description ||
                saved.rowId,
              selected: saved.selected !== false
            };
          })
        : [];

    const restoredActivities =
      Array.isArray(config.activities)
        ? config.activities.map((activity, index) => ({
            id:
              activity.id ||
              `seqact_restore_${Date.now()}_${index}`,
            code: activity.code,
            duration: Math.max(1, Number(activity.duration || 1)),
            lag: Math.max(0, Number(activity.lag || 0))
          }))
        : [];

    setSequenceLocations(restoredLocations);
    setSequenceActivities(restoredActivities);
    setSequenceNewActivity('');
    setSequenceStartType(config.startType || 'date');
    setSequenceStartDate(config.startDate || '');
    setSequencePredecessor(config.predecessorId || '');
    setSequenceStartLag(Math.max(0, Number(config.startLag || 0)));
    setSequenceName(config.name || t.defaultSequenceName);
    setSequenceEditingId(config.id);
    setActiveSequenceConfigId(config.id);
    setShowSequenceModal(true);
  };

  const moveSequence = (setter, index, direction) => {
    setter((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const finalizarDragSequencia = (
    type,
    targetIndex
  ) => {
    if (
      !sequenceDrag ||
      sequenceDrag.type !== type ||
      sequenceDrag.index === targetIndex
    ) {
      setSequenceDrag(null);
      setSequenceDragOver(null);
      return;
    }

    const setter =
      type === 'location'
        ? setSequenceLocations
        : setSequenceActivities;

    setter((current) => {
      const next = [...current];
      const [moved] = next.splice(
        sequenceDrag.index,
        1
      );

      next.splice(
        targetIndex,
        0,
        moved
      );

      return next;
    });

    setSequenceDrag(null);
    setSequenceDragOver(null);
  };

  const addSequenceActivity = () => {
    if (!sequenceNewActivity) return;
    setSequenceActivities((current) => [
      ...current,
      {
        id: `seqact_${Date.now()}_${current.length}`,
        code: sequenceNewActivity,
        duration: 1,
        lag: 0
      }
    ]);
    setSequenceNewActivity('');
  };

  const advanceGeneratorWorkingDays = (
    startIndex,
    workingDays
  ) => {
    let index = startIndex;
    let remaining = Math.max(
      0,
      Number(
        workingDays ||
        0
      )
    );

    while (
      remaining > 0 &&
      index + 1 < calendarDates.length
    ) {
      index += 1;

      const day =
        calendarDates[index];

      if (
        !day.isWeekend &&
        !day.isHoliday
      ) {
        remaining -= 1;
      }
    }

    return index;
  };

  const calculateGeneratingPackageEnd = (
    packageItem,
    packagePool,
    cache = new Map(),
    stack = new Set()
  ) => {
    if (!packageItem?.id) return -1;

    if (cache.has(packageItem.id)) {
      return cache.get(packageItem.id);
    }

    if (stack.has(packageItem.id)) {
      return -1;
    }

    stack.add(packageItem.id);

    let startIndex = -1;

    if (packageItem.packageStartType === 'date') {
      startIndex = calendarDates.findIndex(
        (day) =>
          day.isoDate ===
          packageItem.startDate
      );
    } else if (
      packageItem.packageStartType === 'predecessor' &&
      packageItem.predecessorId
    ) {
      const predecessor =
        packagePool.find(
          (item) =>
            item.id ===
            packageItem.predecessorId
        );

      if (predecessor) {
        const predecessorEnd =
          calculateGeneratingPackageEnd(
            predecessor,
            packagePool,
            cache,
            stack
          );

        if (predecessorEnd >= 0) {
          const lagEndIndex =
            advanceGeneratorWorkingDays(
              predecessorEnd,
              Math.max(
                0,
                Number(
                  packageItem.lagWorkingDays ||
                  0
                )
              )
            );

          startIndex =
            lagEndIndex + 1;
        }
      }
    }

    if (startIndex < 0) {
      stack.delete(packageItem.id);
      cache.set(packageItem.id, -1);
      return -1;
    }

    let allocatedDays = 0;
    let lastIndex = startIndex;

    for (
      let index = startIndex;
      index < calendarDates.length &&
      allocatedDays <
        Math.max(
          1,
          Number(
            packageItem.duration ||
            1
          )
        );
      index += 1
    ) {
      const day =
        calendarDates[index];

      if (
        !day.isWeekend &&
        !day.isHoliday
      ) {
        allocatedDays += 1;
        lastIndex = index;
      }
    }

    const endIndex =
      allocatedDays > 0
        ? lastIndex
        : -1;

    stack.delete(packageItem.id);
    cache.set(
      packageItem.id,
      endIndex
    );

    return endIndex;
  };

  const gerarSequenciaTrabalho = async () => {
    const selectedLocations =
      sequenceLocations.filter((item) => item.selected);

    if (selectedLocations.length === 0) {
      dialogs.notify(t.selectAtLeastOneLocation, 'warn');
      return;
    }

    if (sequenceActivities.length === 0) {
      dialogs.notify(t.selectAtLeastOneActivity, 'warn');
      return;
    }

    if (sequenceStartType === 'date' && !sequenceStartDate) {
      dialogs.notify(t.errSelectDate, 'warn');
      return;
    }

    if (
      sequenceStartType === 'predecessor' &&
      !sequencePredecessor
    ) {
      dialogs.notify(t.errSelectPred, 'warn');
      return;
    }

    const isRegenerating = Boolean(sequenceEditingId);

    if (
      isRegenerating &&
      !(await dialogs.confirm(t.confirmRegenerate, { danger: true }))
    ) {
      return;
    }

    saveHistory();

    if (
      sequenceStartType === 'date' &&
      sequenceStartDate &&
      (
        !dataInicio ||
        sequenceStartDate <
          dataInicio
      )
    ) {
      setDataInicio(
        sequenceStartDate
      );
    }

    const sequenceGroupId =
      sequenceEditingId ||
      `seq_${Date.now()}`;

    const activeConfig =
      sequenceConfigurations.find(
        (config) =>
          config.id ===
          sequenceGroupId
      ) ||
      null;

    const activeLocationIds =
      new Set(
        (
          activeConfig?.locations ||
          sequenceLocations
        )
          .filter(
            (location) =>
              location.selected !== false
          )
          .map(
            (location) =>
              location.rowId
          )
      );

    const activeActivityCodes =
      new Set(
        (
          activeConfig?.activities ||
          sequenceActivities
        ).map(
          (activity) =>
            activity.code
        )
      );

    const belongsToEditedSequence = (
      pkg
    ) => {
      if (
        pkg.sequenceGroupId ===
        sequenceGroupId
      ) {
        return true;
      }

      // Legacy migration fallback:
      // a generated package may predate sequenceGroupId. If there
      // is only one stored sequence configuration, packages marked
      // generatedBySequence that match its Location × Activity
      // footprint belong to that same sequence.
      if (
        !pkg.sequenceGroupId &&
        pkg.generatedBySequence &&
        sequenceConfigurations.length <= 1 &&
        activeLocationIds.has(
          pkg.rowId
        ) &&
        activeActivityCodes.has(
          pkg.activity
        )
      ) {
        return true;
      }

      return false;
    };

    const basePackages =
      isRegenerating
        ? workPackages.filter(
            (pkg) =>
              !belongsToEditedSequence(
                pkg
              )
          )
        : workPackages;

    const generated = [];
    const generatedByCell = new Map();
    const stamp = Date.now();

    selectedLocations.forEach((location, locationIndex) => {
      sequenceActivities.forEach((activity, activityIndex) => {
        const service = workPackageCatalog[activity.code] || null;
        const id =
          `pct_seq_${stamp}_${locationIndex}_${activityIndex}`;

        let startType = 'predecessor';
        let predecessorId = '';
        let startDate = '';
        let relationshipLag = 0;
        let dependencies = [];

        if (locationIndex === 0 && activityIndex === 0) {
          if (sequenceStartType === 'predecessor') {
            predecessorId = sequencePredecessor;
            relationshipLag = Math.max(
              0,
              Number(sequenceStartLag || 0)
            );

            dependencies = [
              {
                type: 'external',
                predecessorId: sequencePredecessor,
                lagWorkingDays: relationshipLag
              }
            ];
          } else {
            startType = 'date';
            startDate = sequenceStartDate;
            dependencies = [];
          }
        } else {
          const previousTrade =
            activityIndex > 0
              ? generatedByCell.get(
                  `${locationIndex}:${activityIndex - 1}`
                )
              : null;

          const previousLocation =
            locationIndex > 0
              ? generatedByCell.get(
                  `${locationIndex - 1}:${activityIndex}`
                )
              : null;

          const activityLag = Math.max(
            0,
            Number(activity.lag || 0)
          );

          dependencies = [];

          if (previousTrade) {
            dependencies.push({
              type: 'trade',
              predecessorId: previousTrade.id,
              lagWorkingDays: activityLag
            });
          }

          if (previousLocation) {
            dependencies.push({
              type: 'flow',
              predecessorId: previousLocation.id,
              lagWorkingDays: 0
            });
          }

          if (dependencies.length > 0) {
            const pool = [
              ...basePackages,
              ...generated
            ];

            const finishCache = new Map();
            let latestReadyIndex = -1;
            let controlling = dependencies[0];

            dependencies.forEach((dependency) => {
              const predecessor =
                pool.find(
                  (item) =>
                    item.id === dependency.predecessorId
                );

              if (!predecessor) return;

              const finish =
                calculateGeneratingPackageEnd(
                  predecessor,
                  pool,
                  finishCache
                );

              const ready =
                advanceGeneratorWorkingDays(
                  finish,
                  dependency.lagWorkingDays
                );

              if (ready > latestReadyIndex) {
                latestReadyIndex = ready;
                controlling = dependency;
              }
            });

            predecessorId = controlling.predecessorId;
            relationshipLag = controlling.lagWorkingDays;
          } else {
            startType = 'date';
            startDate = sequenceStartDate;
          }
        }

        const isFirstGeneratedPackage =
          locationIndex === 0 &&
          activityIndex === 0;

        const pkg = {
          id,
          activity: activity.code,
          rowId: location.rowId,
          locationId: location.locationId || null,
          locationPath: location.label || '',
          activityId: service?.activityId || null,
          projectServiceId: service?.projectServiceId || null,
          projectWorkPackageId: service?.projectWorkPackageId || null,
          packageStartType:
            isFirstGeneratedPackage &&
            sequenceStartType === 'date'
              ? 'data'
              : startType,
          startDate:
            isFirstGeneratedPackage &&
            sequenceStartType === 'date'
              ? sequenceStartDate
              : startDate,
          predecessorId:
            isFirstGeneratedPackage &&
            sequenceStartType === 'date'
              ? ''
              : predecessorId,
          lagWorkingDays:
            startType === 'predecessor'
              ? relationshipLag
              : 0,
          dependencies:
            isFirstGeneratedPackage &&
            sequenceStartType === 'date'
              ? []
              : dependencies,
          manualDelayWorkingDays: 0,
          duration: Math.max(1, Number(activity.duration || 1)),
          generatedBySequence: true,
          sequenceGroupId
        };

        generated.push(pkg);
        generatedByCell.set(
          `${locationIndex}:${activityIndex}`,
          pkg
        );
      });
    });

    const configuration = {
      id: sequenceGroupId,
      name:
        sequenceName?.trim() ||
        t.defaultSequenceName,
      locations:
        sequenceLocations.map((location) => ({
          rowId: location.rowId,
          locationId: location.locationId || null,
          label: location.label || '',
          selected: location.selected !== false
        })),
      activities:
        sequenceActivities.map((activity) => ({
          id: activity.id,
          code: activity.code,
          duration: Math.max(1, Number(activity.duration || 1)),
          lag: Math.max(0, Number(activity.lag || 0))
        })),
      startType: sequenceStartType,
      startDate:
        sequenceStartType === 'date'
          ? sequenceStartDate
          : '',
      predecessorId:
        sequenceStartType === 'predecessor'
          ? sequencePredecessor
          : '',
      startLag:
        sequenceStartType === 'predecessor'
          ? Math.max(0, Number(sequenceStartLag || 0))
          : 0,
      flowRule: 'continuous',
      updatedAt: new Date().toISOString()
    };

    setWorkPackages([
      ...basePackages,
      ...generated
    ]);

    setSequenceConfigurations((current) => {
      const exists =
        current.some(
          (item) => item.id === sequenceGroupId
        );

      if (exists) {
        return current.map((item) =>
          item.id === sequenceGroupId
            ? configuration
            : item
        );
      }

      return [
        ...current,
        configuration
      ];
    });

    setActiveSequenceConfigId(sequenceGroupId);
    setSequenceEditingId(sequenceGroupId);
    setShowSequenceModal(false);

    dialogs.notify(
      isRegenerating
        ? t.sequenceRegenerated
        : translate('masterPlan.packagesCreated', { count: generated.length }), 'ok');
  };

  const handleInsertAutomationPackage = (e) => {
    e.preventDefault();
    if (!packageActivity || !packageRowId || packageDuration < 1) {
      dialogs.notify(t.errFillFields, 'warn');
      return;
    }

    if (packageStartType === 'date' && !packageStartDate) return dialogs.notify(t.errSelectDate, 'warn');
    if (packageStartType === 'predecessor' && !predecessorPackageId) return dialogs.notify(t.errSelectPred, 'warn');

    saveHistory();

    let selectedPlanningRow = null;

    sections.some((section) => {
      const foundRow =
        section.rows.find(
          (row) =>
            row.id ===
            packageRowId
        );

      if (foundRow) {
        selectedPlanningRow =
          foundRow;

        return true;
      }

      return false;
    });

    const selectedService =
      workPackageCatalog[
        packageActivity
      ] || null;

    const manualDependencies =
      packageStartType === 'predecessor' &&
      predecessorPackageId
        ? [
            {
              type: 'external',
              predecessorId:
                predecessorPackageId,
              lagWorkingDays: 0
            }
          ]
        : [];

    const newPackage = {
      id: `pct_${Date.now()}`,
      activity: packageActivity,
      rowId: packageRowId,

      // Canonical links are persisted inside the scenario snapshot.
      // They prepare Master Plan -> Lookahead -> Weekly -> Production
      // integration without changing the current scheduling engine.
      locationId:
        selectedPlanningRow?.locationId ||
        null,
      locationPath:
        selectedPlanningRow?.locationPath ||
        selectedPlanningRow?.description ||
        '',
      activityId:
        selectedService?.activityId ||
        null,

      projectServiceId:
        selectedService?.projectServiceId ||
        null,

      projectWorkPackageId:
        selectedService?.projectWorkPackageId ||
        null,

      packageStartType: packageStartType,
      startDate: packageStartDate,
      predecessorId: predecessorPackageId,
      lagWorkingDays: 0,
      dependencies:
        manualDependencies,
      manualDelayWorkingDays: 0,
      duration: packageDuration
    };

    setWorkPackages([...workPackages, newPackage]);

    setShowWorkPackageModal(false);
    setPackageStartDate('');
    setPredecessorPackageId('');
    setPackageDuration(1);
    
    setActiveScenarioId(null); 
  };

  const gerarPDF = () => {
    import('html2pdf.js').then((html2pdf) => {
      const element = document.getElementById('conteudo-masterplan-pdf');
      let pdfConfiguration = { unit: 'mm', format: pdfConfig.formato, orientation: pdfConfig.orientacao };
      if (pdfConfig.formato === 'unica') {
        const rect = element.getBoundingClientRect();
        pdfConfiguration = { unit: 'px', format: [rect.height + 40, rect.width + 40], orientation: 'landscape' };
      }
      const options = { margin: 10, filename: `master-plan-${selectedProjectId}-${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: pdfConfiguration };
      html2pdf.default().from(element).set(options).save();
      setShowPdfModal(false);
    });
  };

  let globalIdCounter = 1;

  const cx = (...names) => names.filter(Boolean).join(' ');
  const selectedLocationCount = sequenceLocations.filter((item) => item.selected).length;
  const projectOptions = projects.map((project) => (
    <option key={project.id} value={project.id}>
      {project.code ? `${project.code} – ` : ''}{project.name}
    </option>
  ));
  const handleProjectSelect = (event) => {
    const projectId = event.target.value;
    setSelectedProjectId(projectId);
    rememberPreconProjectId(projectId);
  };
  // Calendar markers keep their codes (OFF, FER); their names follow the language.
  const activityLabel = (code, info) =>
    code === 'OFF' ? t.weekend : code === 'FER' ? t.holiday : (info?.labelEn || code);
  const activityOptions = Object.entries(workPackageCatalog)
    .filter(([code]) => code !== '' && code !== 'OFF' && code !== 'FER');
  const formatHolidayDate = (isoDate) => {
    const [year, month, day] = String(isoDate || '').split('-').map(Number);
    if (!year || !month || !day) return isoDate || '';
    return new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric' })
      .format(new Date(year, month - 1, day));
  };

  // No project selected yet: a compact picker (the Overview tab lists every project).
  if (!selectedProjectId) {
    return (
      <div className={styles.frame}>
        <div className={styles.pickProject}>
          <Empty
            title={t.noProject}
            text={projects.length ? t.noProjectDesc : t.noProjectsAvailable}
            action={projects.length > 0 && (
              <select value="" onChange={handleProjectSelect} aria-label={t.projectLabel}>
                <option value="">{t.selectProject}</option>
                {projectOptions}
              </select>
            )}
          />
        </div>
        {dialogs.element}
      </div>
    );
  }

  return (
    <div className={styles.frame}>
      <datalist id="lista-zonas-coleta">
        {zonasColeta.map((zona, idx) => <option key={idx} value={zona} />)}
      </datalist>

      {/* Project, scenario, baseline and schedule window */}
      <div className={styles.toolbar}>
        <div className={styles.group}>
          <label className={styles.control}>
            <span>{t.projectLabel}</span>
            <select className={styles.projectSelect} value={selectedProjectId} onChange={handleProjectSelect}>
              {projectOptions}
            </select>
          </label>

          {!isBaselineFrozen && (
            <>
              <label className={styles.control}>
                <span>{t.scenarioLabel}</span>
                <select className={styles.scenarioSelect} value={activeScenarioId || ''} onChange={(e) => handleLoadScenario(e.target.value)}>
                  <option value="">{activeScenarioId === null && workPackages.length > 0 ? t.unsavedEdit : t.newBlank}</option>
                  {scenarios.map((v) => <option key={v.id} value={v.id}>{v.nome} ({v.data})</option>)}
                </select>
              </label>
              {activeScenarioId === null ? (
                <button type="button" className={ui.btn} onClick={handleSaveScenario} disabled={workPackages.length === 0}>
                  {t.saveScenario}
                </button>
              ) : (
                <>
                  <button type="button" className={ui.btn} onClick={handleUpdateScenario} title={t.updateScenarioHint}>{t.updateScenario}</button>
                  <button type="button" className={ui.btnGhost} onClick={handleDuplicateScenario} title={t.duplicateScenarioHint}>{t.duplicateScenario}</button>
                </>
              )}
            </>
          )}
        </div>

        <div className={styles.group}>
          {!isBaselineFrozen ? (
            <button type="button" className={ui.btn} onClick={handleFreezeBaseline}>{t.freezeBase}</button>
          ) : (
            <>
              <span className={styles.state}><Badge tone="ok">{t.baselineFrozen}</Badge></span>
              <button type="button" className={ui.btnGhost} onClick={handleUnfreeze}>{t.editBase}</button>
              <Segments
                items={[{ value: 'plan', label: t.planning }, { value: 'control', label: t.control }]}
                value={controlMode ? 'control' : 'plan'}
                onChange={(value) => setControlMode(value === 'control')}
              />
            </>
          )}
        </div>

        <div className={cx(styles.group, styles.push)}>
          <div className={styles.dateRange}>
            <label className={styles.control}>
              <span>{t.startPrev}</span>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} disabled={isBaselineFrozen} />
            </label>
            <span className={styles.dateArrow} aria-hidden="true">→</span>
            <label className={styles.control}>
              <span>{t.endPrev}</span>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} disabled={isBaselineFrozen} />
            </label>
          </div>
        </div>
      </div>

      {/* Planning actions */}
      <div className={styles.toolbar}>
        <div className={styles.group}>
          <button type="button" className={ui.btnPrimary} onClick={abrirGeradorSequencia} disabled={isBaselineFrozen}>
            <Icon name="plus" size={18} />{t.generateSequence}
          </button>
          <button
            type="button"
            className={ui.btn}
            onClick={abrirConfiguracoesSequencia}
            disabled={isBaselineFrozen || sequenceConfigurations.length === 0}
            title={sequenceConfigurations.length === 0 ? t.noSequenceConfigured : t.editSequenceHelp}
          >
            {t.sequenceSettings}
          </button>
          <button type="button" className={ui.btn} onClick={() => setShowWorkPackageModal(true)} disabled={isBaselineFrozen}>
            {t.insertPackage}
          </button>
          <button type="button" className={ui.btnGhost} onClick={handleUndo} disabled={history.length === 0 || isBaselineFrozen}>
            ↩ {t.undoBtn}
          </button>
        </div>
        <div className={cx(styles.group, styles.push)}>
          <button type="button" className={ui.btnGhost} onClick={() => setHideWeekends(!hideWeekends)}>
            {hideWeekends ? t.showWeekends : t.hideWeekends}
          </button>
          <button type="button" className={ui.btnGhost} onClick={() => setShowHolidaysModal(true)}>{t.holidaysBtn}</button>
          <button type="button" className={ui.btn} onClick={() => { setPdfConfig((prev) => ({ ...prev, formato: formatoIdealCode })); setShowPdfModal(true); }}>
            {t.exportPdf}
          </button>
        </div>
      </div>

      {/* Work sequence generator */}
      {showSequenceModal && (
        <Dialog
          size="wide"
          title={sequenceEditingId ? t.sequenceSettings : t.sequenceGenerator}
          text={sequenceEditingId ? t.editSequenceHelp : undefined}
          onClose={() => setShowSequenceModal(false)}
          footer={(
            <>
              <span className={styles.dialogFootNote}>
                {translate('masterPlan.sequenceSummary', {
                  locations: selectedLocationCount,
                  activities: sequenceActivities.length,
                  packages: selectedLocationCount * sequenceActivities.length,
                })}
              </span>
              <button type="button" className={ui.btn} onClick={() => setShowSequenceModal(false)}>{t.mPkgCancel}</button>
              <button type="button" className={ui.btnPrimary} onClick={gerarSequenciaTrabalho}>
                {sequenceEditingId ? t.regenerateSequence : t.generatePackages}
              </button>
            </>
          )}
        >
          <label className={ui.field} style={{ maxWidth: 420 }}>
            <span className={ui.fieldLabel}>{t.sequenceName}</span>
            <input type="text" value={sequenceName} onChange={(e) => setSequenceName(e.target.value)} />
          </label>

          <div className={styles.grid2}>
            <section className={styles.box}>
              <div>
                <h3 className={styles.boxTitle}>{t.sequenceLocations}</h3>
                <p className={styles.hint}>{t.dragToReorder}</p>
              </div>
              <div className={styles.list}>
                {sequenceLocations.map((location, index) => {
                  const over = sequenceDragOver?.type === 'location' && sequenceDragOver?.index === index;
                  return (
                    <div
                      key={location.rowId}
                      draggable
                      onDragStart={() => setSequenceDrag({ type: 'location', index })}
                      onDragOver={(e) => { e.preventDefault(); setSequenceDragOver({ type: 'location', index }); }}
                      onDrop={(e) => { e.preventDefault(); finalizarDragSequencia('location', index); }}
                      onDragEnd={() => { setSequenceDrag(null); setSequenceDragOver(null); }}
                      className={cx(styles.listRow, location.selected && styles.listRowOn, over && styles.listRowOver)}
                      style={{ gridTemplateColumns: '20px 18px minmax(0, 1fr) 32px 32px' }}
                    >
                      <input
                        type="checkbox"
                        checked={location.selected}
                        aria-label={location.label}
                        onChange={(e) => setSequenceLocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, selected: e.target.checked } : item))}
                      />
                      <span className={styles.handle} title={t.dragToReorder} aria-hidden="true">⋮⋮</span>
                      <span className={styles.listText} title={location.label}>{index + 1}. {location.label}</span>
                      <button type="button" className={styles.iconBtn} disabled={index === 0} onClick={() => moveSequence(setSequenceLocations, index, -1)} aria-label={t.moveUp}>↑</button>
                      <button type="button" className={styles.iconBtn} disabled={index === sequenceLocations.length - 1} onClick={() => moveSequence(setSequenceLocations, index, 1)} aria-label={t.moveDown}>↓</button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={styles.box}>
              <div>
                <h3 className={styles.boxTitle}>{t.sequenceActivities}</h3>
                <p className={styles.hint}>{t.dragToReorder}</p>
              </div>
              <div className={styles.inline}>
                <select value={sequenceNewActivity} onChange={(e) => setSequenceNewActivity(e.target.value)} style={{ flex: 1, minWidth: 0 }} aria-label={t.mPkgService}>
                  <option value="">{t.mPkgSelectAct}</option>
                  {activityOptions.map(([code, service]) => (
                    <option key={code} value={code}>{code} – {service.labelEn}</option>
                  ))}
                </select>
                <button type="button" className={ui.btn} onClick={addSequenceActivity}>{t.addActivity}</button>
              </div>

              <div className={styles.listScroll}>
              {sequenceActivities.length > 0 && (
                <div className={styles.listHead} style={{ gridTemplateColumns: '18px 22px minmax(0, 1fr) 76px 76px 32px 32px 32px' }}>
                  <span /><span>#</span><span>{t.activityHeader}</span><span>{t.durationDays}</span><span>{t.lagWorkingDays}</span><span /><span /><span />
                </div>
              )}

              <div className={styles.list} style={{ maxHeight: 275 }}>
                {sequenceActivities.map((activity, index) => {
                  const service = workPackageCatalog[activity.code];
                  const over = sequenceDragOver?.type === 'activity' && sequenceDragOver?.index === index;
                  return (
                    <div
                      key={activity.id}
                      draggable
                      onDragStart={() => setSequenceDrag({ type: 'activity', index })}
                      onDragOver={(e) => { e.preventDefault(); setSequenceDragOver({ type: 'activity', index }); }}
                      onDrop={(e) => { e.preventDefault(); finalizarDragSequencia('activity', index); }}
                      onDragEnd={() => { setSequenceDrag(null); setSequenceDragOver(null); }}
                      className={cx(styles.listRow, over && styles.listRowOver)}
                      style={{ gridTemplateColumns: '18px 22px minmax(0, 1fr) 76px 76px 32px 32px 32px' }}
                    >
                      <span className={styles.handle} title={t.dragToReorder} aria-hidden="true">⋮⋮</span>
                      <strong>{index + 1}</strong>
                      <span className={styles.listText} title={service?.labelEn}>{activity.code} · {service?.labelEn}</span>
                      <input type="number" min="1" aria-label={t.durationDays} value={activity.duration} onChange={(e) => setSequenceActivities((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, duration: Math.max(1, Number(e.target.value || 1)) } : item))} />
                      <input type="number" min="0" aria-label={t.lagWorkingDays} value={activity.lag ?? 0} onChange={(e) => setSequenceActivities((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, lag: Math.max(0, Number(e.target.value || 0)) } : item))} />
                      <button type="button" className={styles.iconBtn} disabled={index === 0} onClick={() => moveSequence(setSequenceActivities, index, -1)} aria-label={t.moveUp}>↑</button>
                      <button type="button" className={styles.iconBtn} disabled={index === sequenceActivities.length - 1} onClick={() => moveSequence(setSequenceActivities, index, 1)} aria-label={t.moveDown}>↓</button>
                      <button type="button" className={cx(styles.iconBtn, styles.iconBtnDanger)} onClick={() => setSequenceActivities((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={t.removeActivity}>×</button>
                    </div>
                  );
                })}
              </div>
              </div>
            </section>
          </div>

          <section className={styles.box}>
            <h3 className={styles.boxTitle}>{t.sequenceStart}</h3>
            <div className={styles.inline}>
              <label className={styles.radio}>
                <input type="radio" checked={sequenceStartType === 'date'} onChange={() => setSequenceStartType('date')} />
                {t.specificStartDate}
              </label>
              <input type="date" disabled={sequenceStartType !== 'date'} value={sequenceStartDate} onChange={(e) => setSequenceStartDate(e.target.value)} aria-label={t.specificStartDate} />
            </div>
            <div className={styles.inline}>
              <label className={styles.radio}>
                <input type="radio" checked={sequenceStartType === 'predecessor'} onChange={() => setSequenceStartType('predecessor')} />
                {t.existingPredecessor}
              </label>
              <select disabled={sequenceStartType !== 'predecessor'} value={sequencePredecessor} onChange={(e) => setSequencePredecessor(e.target.value)} style={{ minWidth: 240, flex: 1 }} aria-label={t.existingPredecessor}>
                <option value="">{t.mPkgSelectPred}</option>
                {existingPackages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.label}</option>)}
              </select>
              <label className={styles.radio} style={{ opacity: sequenceStartType === 'predecessor' ? 1 : 0.5 }}>
                {t.startLag}
                <input type="number" min="0" disabled={sequenceStartType !== 'predecessor'} value={sequenceStartLag} onChange={(e) => setSequenceStartLag(Math.max(0, Number(e.target.value || 0)))} style={{ width: 80 }} />
              </label>
            </div>
            <div className={cx(ui.notice, ui.noticeOk)}>
              <strong>{t.continuousFlow}.</strong> {t.continuousFlowHelp}
            </div>
          </section>
        </Dialog>
      )}

      {/* Insert one work package */}
      {showWorkPackageModal && (
        <Dialog
          as="form"
          onSubmit={handleInsertAutomationPackage}
          title={t.mPkgTitle}
          onClose={() => setShowWorkPackageModal(false)}
          footer={(
            <>
              <button type="button" className={ui.btn} onClick={() => setShowWorkPackageModal(false)}>{t.mPkgCancel}</button>
              <button type="submit" className={ui.btnPrimary}>{t.mPkgAddGrid}</button>
            </>
          )}
        >
          <div className={styles.grid2}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>{t.mPkgService}</span>
              <select required value={packageActivity} onChange={(e) => setPackageActivity(e.target.value)}>
                <option value="">{t.mPkgSelect}</option>
                {activityOptions.map(([code, info]) => <option key={code} value={code}>{info.labelEn} ({code})</option>)}
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>{t.mPkgZone}</span>
              <select required value={packageRowId} onChange={(e) => setPackageRowId(e.target.value)}>
                <option value="">{t.mPkgSelect}</option>
                {sections.map((sec) => (
                  <optgroup key={sec.id} label={sec.title}>
                    {sec.rows.map((row) => <option key={row.id} value={row.id}>{row.description || translate('masterPlan.rowFallback', { id: row.id })}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.box}>
            <div className={styles.radios}>
              <label className={styles.radio}>
                <input type="radio" name="packageStartType" value="date" checked={packageStartType === 'date'} onChange={() => setPackageStartType('date')} />
                {t.mPkgRadioDate}
              </label>
              <label className={styles.radio}>
                <input type="radio" name="packageStartType" value="predecessor" checked={packageStartType === 'predecessor'} onChange={() => setPackageStartType('predecessor')} />
                {t.mPkgRadioPred}
              </label>
            </div>
            {packageStartType === 'date' ? (
              <label className={ui.field}>
                <span className={ui.fieldLabel}>{t.mPkgStartDate}</span>
                <input type="date" required value={packageStartDate} onChange={(e) => setPackageStartDate(e.target.value)} />
              </label>
            ) : (
              <label className={ui.field}>
                <span className={ui.fieldLabel}>{t.mPkgLinkPred}</span>
                <select required value={predecessorPackageId} onChange={(e) => setPredecessorPackageId(e.target.value)}>
                  <option value="">{t.mPkgSelectPred}</option>
                  {existingPackages.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                {existingPackages.length === 0 && <span className={styles.errorText}>{t.mPkgNoPred}</span>}
              </label>
            )}
          </div>

          <label className={ui.field} style={{ maxWidth: 220 }}>
            <span className={ui.fieldLabel}>{t.mPkgDuration}</span>
            <input type="number" required min="1" value={packageDuration} onChange={(e) => setPackageDuration(Number(e.target.value))} />
          </label>
        </Dialog>
      )}

      {/* Project holidays */}
      {showHolidaysModal && (
        <Dialog
          title={t.mHolTitle}
          onClose={() => setShowHolidaysModal(false)}
          footer={<button type="button" className={ui.btnPrimary} onClick={() => setShowHolidaysModal(false)}>{t.mHolDone}</button>}
        >
          <form onSubmit={handleAddHoliday} className={styles.inline}>
            <input type="date" required value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} aria-label={t.mHolDateCol} />
            <input type="text" required placeholder={t.mHolDescPlace} value={newHolidayDescription} onChange={(e) => setNewHolidayDescription(e.target.value)} style={{ flex: 1, minWidth: 160 }} aria-label={t.mHolDescCol} />
            <button type="submit" className={ui.btn}>{t.mHolAdd}</button>
          </form>

          {holidays.length === 0 ? (
            <p className={styles.hint}>{t.mHolEmpty}</p>
          ) : (
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr><th>{t.mHolDateCol}</th><th>{t.mHolDescCol}</th><th /></tr>
                </thead>
                <tbody>
                  {[...holidays].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((f) => (
                    <tr key={f.date}>
                      <td>{formatHolidayDate(f.date)}</td>
                      <td>{f.description}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className={cx(ui.btnGhost, ui.small)} onClick={() => handleRemoveHoliday(f.date)}>{t.mHolDel}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Dialog>
      )}

      {/* PDF export */}
      {showPdfModal && (
        <Dialog
          title={t.mPdfTitle}
          onClose={() => setShowPdfModal(false)}
          footer={(
            <>
              <button type="button" className={ui.btn} onClick={() => setShowPdfModal(false)}>{t.mPkgCancel}</button>
              <button type="button" className={ui.btnPrimary} onClick={gerarPDF}>{t.mPdfConfirm}</button>
            </>
          )}
        >
          <div className={styles.box}>
            <p className={styles.hint}>
              {translate('masterPlan.mPdfSugestText', { columns: visibleDates.length, size: formatoIdealCode.toUpperCase() })}
            </p>
          </div>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>{t.mPdfSize}</span>
            <select value={pdfConfig.formato} onChange={(e) => setPdfConfig({ ...pdfConfig, formato: e.target.value })}>
              <option value="a4">{t.mPdf_a4}</option>
              <option value="a3">{t.mPdf_a3}</option>
              <option value="a2">{t.mPdf_a2}</option>
              <option value="a1">{t.mPdf_a1}</option>
              <option value="a0">{t.mPdf_a0}</option>
              <option value="unica">{t.mPdf_unica}</option>
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>{t.mPdfOrient}</span>
            <select value={pdfConfig.orientacao} onChange={(e) => setPdfConfig({ ...pdfConfig, orientacao: e.target.value })} disabled={pdfConfig.formato === 'unica'}>
              <option value="landscape">{t.mPdfLand}</option>
              <option value="portrait">{t.mPdfPort}</option>
            </select>
          </label>
        </Dialog>
      )}

      {dialogs.element}

      <div className={styles.frameBody}>
          <div className={styles.gridWrap}>
            <div id="conteudo-masterplan-pdf" style={{ minWidth: 'max-content', paddingBottom: '20px' }}>
              
              <table style={{ borderCollapse: 'collapse', whiteSpace: 'nowrap', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--fo-navy)' }}>
                  <tr>
                    <th rowSpan={2} style={{ position: 'sticky', left: 0, zIndex: 11, backgroundColor: 'var(--fo-navy)', color: 'white', padding: '8px', borderRight: '1px solid #2a4365', width: '40px' }}>{t.idHeader}</th>
                    <th rowSpan={2} style={{ position: 'sticky', left: '40px', zIndex: 11, backgroundColor: 'var(--fo-navy)', color: 'white', padding: '8px 15px', borderRight: '1px solid #2a4365', textAlign: 'left', minWidth: 'var(--mp-desc, 320px)' }}>{t.descHeader}</th>
                    {visibleDates.map((d, i) => (
                      <th key={`data-${i}`} style={{ backgroundColor: 'var(--fo-navy)', borderRight: '1px solid #2a4365', borderBottom: '1px solid #2a4365', padding: '4px 2px', fontSize: '0.8rem', color: 'white', textAlign: 'center' }}>
                        {d.dateLabel}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {visibleDates.map((d, i) => (
                      <th key={`sem-${i}`} style={{ backgroundColor: d.isHoliday ? '#c53030' : (d.isWeekend ? '#718096' : '#edf2f7'), borderRight: '1px solid #cbd5e0', borderBottom: '1px solid #cbd5e0', padding: '4px 2px', fontSize: '0.75rem', color: (d.isHoliday || d.isWeekend) ? 'white' : 'var(--fo-navy)', fontWeight: 'bold', textAlign: 'center' }}>
                        {d.weekLabel}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {sections.map((section) => {
                    const displayTitle = section.title;
                    return (
                    <React.Fragment key={section.id}>
                      <tr style={{ backgroundColor: '#edf2f7' }}>
                        <td colSpan={2} style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: '#edf2f7', padding: '6px 15px', borderBottom: '2px solid #2a4365', borderTop: '2px solid #2a4365' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '85%' }}>
                              <input 
                                type="text"
                                value={displayTitle}
                                onChange={(e) => handleUpdateSectionTitle(section.id, e.target.value)}
                                disabled={isBaselineFrozen}
                                style={{ fontWeight: 'bold', fontStyle: 'italic', color: '#2a4365', background: 'transparent', border: 'none', outline: 'none', flex: 1, minWidth: 0, fontSize: '0.9rem' }}
                              />

                              {section.source === 'location_structure' && (
                                <span
                                  title={t.locationBadgeHint}
                                  style={{
                                    flexShrink: 0,
                                    padding: '2px 6px',
                                    borderRadius: '999px',
                                    backgroundColor: '#dff7f2',
                                    color: '#087f73',
                                    fontSize: '0.58rem',
                                    fontWeight: 900,
                                    letterSpacing: '0.05em'
                                  }}
                                >
                                  {t.locationBadge}
                                </span>
                              )}
                            </div>
                            {!isBaselineFrozen && (
                              <button onClick={() => handleRemoveSection(section.id)} style={{ border: 'none', background: 'transparent', color: '#e53e3e', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                            )}
                          </div>
                        </td>
                        {visibleDates.map((d, i) => (
                          <td key={`g-${section.id}-${i}`} style={{ borderBottom: '2px solid #2a4365', borderTop: '2px solid #2a4365', backgroundColor: d.isHoliday ? '#fed7d7' : (d.isWeekend ? '#e2e8f0' : '#edf2f7'), minWidth: '45px' }}></td>
                        ))}
                      </tr>

                      {section.rows.map((row) => {
                        const currentId = globalIdCounter++;
                        
                        const renderCells = (isActual) => {
                          return visibleDates.map((d) => {
                            const cellKey = `${row.id}___${d.isoDate}`;
                            const cellData = isActual ? actualCellData : plannedCellData;
                            const savedValue = cellData[cellKey];
                            
                            let defaultValue = '';
                            if (d.isHoliday) defaultValue = 'FER';
                            else if (d.isWeekend) defaultValue = 'OFF';

                            // Project calendar markers belong to both
                            // Planning and Control. A holiday remains a
                            // holiday regardless of which row is being viewed.
                            //
                            // Actual data can still override FER/OFF if work
                            // was genuinely performed on that non-working day.
                            const effectiveValue =
                              savedValue !== undefined
                                ? savedValue
                                : defaultValue;
                            const colorConfig = workPackageCatalog[effectiveValue] || workPackageCatalog[''];

                            let bgColor = 'transparent';

                            if (colorConfig.color !== 'transparent') {
                              bgColor = colorConfig.color;
                            } else if (d.isHoliday) {
                              bgColor = '#fed7d7';
                            } else if (d.isWeekend) {
                              bgColor = '#e2e8f0';
                            }

                            const isInputLocked = isActual ? false : isBaselineFrozen;

                            const cellPackage =
                              !isActual
                                ? packageByCell.get(
                                    cellKey
                                  ) || null
                                : null;

                            const currentCellIndex =
                              calendarDates.findIndex(
                                (day) =>
                                  day.isoDate ===
                                  d.isoDate
                              );

                            const proposedDragStart =
                              packageDrag
                                ? normalizeDragTarget(
                                    (
                                      packageDrag.targetIndex -
                                      Math.max(
                                        0,
                                        Number(
                                          packageDrag.grabOffset ||
                                          0
                                        )
                                      )
                                    ),
                                    (
                                      packageDrag.targetIndex -
                                      Math.max(
                                        0,
                                        Number(
                                          packageDrag.grabOffset ||
                                          0
                                        )
                                      )
                                    ) <
                                    packageDrag.startIndex
                                      ? -1
                                      : 1
                                  )
                                : -1;

                            const isDragTarget =
                              Boolean(
                                packageDrag &&
                                packageDrag.rowId === row.id &&
                                proposedDragStart ===
                                  currentCellIndex
                              );

                            return (
                              <td
                                key={cellKey}
                                onDragOver={(event) =>
                                  updatePackageDragTarget(
                                    event,
                                    row.id,
                                    d.isoDate
                                  )
                                }
                                onDrop={(event) =>
                                  finishPackageDrag(
                                    event,
                                    row.id,
                                    d.isoDate
                                  )
                                }
                                style={{
                                  borderRight: '1px dotted #cbd5e0',
                                  padding: '1px',
                                  backgroundColor:
                                    isDragTarget
                                      ? '#dff7f2'
                                      : bgColor,
                                  outline:
                                    isDragTarget
                                      ? '2px solid #0d9488'
                                      : 'none',
                                  outlineOffset:
                                    '-2px',
                                  textAlign: 'center',
                                  width: '45px',
                                  minWidth: '45px',
                                  maxWidth: '45px',
                                  height: '26px',
                                  overflow: 'hidden'
                                }}
                              >
                                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {cellPackage ? (
                                    <div
                                      draggable={!isInputLocked}
                                      onDragStart={(event) =>
                                        startPackageDrag(
                                          event,
                                          cellPackage,
                                          d.isoDate
                                        )
                                      }
                                      onDragEnd={() =>
                                        setPackageDrag(
                                          null
                                        )
                                      }
                                      title={`${t.dragPackageHint} · ${t.dragPackageLockedRow}`}
                                      style={{
                                        width: '43px',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor:
                                          colorConfig.color,
                                        color:
                                          colorConfig.text,
                                        borderRadius: '2px',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        cursor:
                                          isInputLocked
                                            ? 'default'
                                            : 'ew-resize',
                                        userSelect: 'none',
                                        opacity:
                                          controlMode
                                            ? 0.6
                                            : 1
                                      }}
                                    >
                                      {effectiveValue}
                                    </div>
                                  ) : (
                                    <>
                                      <select
                                        value={effectiveValue}
                                        onChange={(e) => isActual ? handleActualCellChange(row.id, d.isoDate, e.target.value) : handleCellChange(row.id, d.isoDate, e.target.value)}
                                        disabled={isInputLocked}
                                        style={{ width: '43px', minWidth: 0, maxWidth: '43px', height: '100%', backgroundColor: colorConfig.color, color: colorConfig.text, border: 'none', outline: 'none', fontSize: '0.7rem', fontWeight: 'bold', textAlign: 'center', textAlignLast: 'center', appearance: 'none', cursor: isInputLocked ? 'default' : 'pointer', borderRadius: '2px', opacity: (controlMode && !isActual && effectiveValue) ? 0.6 : 1, padding: '0 4px', overflow: 'hidden' }}
                                      >
                                        <option value=""></option>
                                        {Object.keys(workPackageCatalog).filter(k => k !== '').map(sigla => (
                                          <option key={sigla} value={sigla}>{sigla}</option>
                                        ))}
                                      </select>

                                      {!isInputLocked && (
                                        <div style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '0.45rem', color: colorConfig.text === '#fff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}>▼</div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            );
                          });
                        };

                        return (
                          <React.Fragment key={row.id}>
                            <tr style={{ borderBottom: controlMode ? 'none' : '1px dotted #cbd5e0', backgroundColor: controlMode ? '#f7fafc' : 'white' }}>
                              <td style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: controlMode ? '#f7fafc' : 'white', padding: '4px', textAlign: 'center', color: '#4a5568', borderRight: '1px solid #e2e8f0', fontWeight: '500' }}>
                                {currentId}
                              </td>
                              <td style={{ position: 'sticky', left: '40px', zIndex: 5, backgroundColor: controlMode ? '#f7fafc' : 'white', padding: '4px 10px', borderRight: '2px solid #cbd5e0', minWidth: 'var(--mp-desc, 320px)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '90%' }}>
                                    <input 
                                      type="text" 
                                      value={row.description} 
                                      onChange={(e) => handleUpdateRow(section.id, row.id, e.target.value)} 
                                      disabled={isBaselineFrozen}
                                      list="lista-zonas-coleta"
                                      placeholder={t.selectOrType}
                                      title={
                                        row.locationPath ||
                                        row.description ||
                                        ''
                                      }
                                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: '#2d3748', fontSize: '0.85rem' }}
                                    />
                                    {controlMode && <span style={{ fontSize: '0.65rem', backgroundColor: '#cbd5e0', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', color: '#4a5568' }}>{t.plannedBadge}</span>}
                                  </div>
                                  {!isBaselineFrozen && (
                                    <button onClick={() => handleRemoveRow(section.id, row.id)} style={{ border: 'none', background: 'transparent', color: '#e53e3e', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                                  )}
                                </div>
                              </td>
                              {renderCells(false)}
                            </tr>

                            {controlMode && (
                              <tr style={{ borderBottom: '1px dotted #cbd5e0', backgroundColor: 'white' }}>
                                <td style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: 'white', padding: '4px', borderRight: '1px solid #e2e8f0', color: 'transparent' }}>
                                  {currentId}
                                </td>
                                <td style={{ position: 'sticky', left: '40px', zIndex: 5, backgroundColor: 'white', padding: '4px 10px', borderRight: '2px solid #cbd5e0', minWidth: 'var(--mp-desc, 320px)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '90%' }}>
                                      <span style={{ flex: 1, color: '#a0aec0', fontSize: '0.85rem', paddingLeft: '2px' }}>↳ {row.description}</span>
                                      <span style={{ fontSize: '0.65rem', backgroundColor: '#3182ce', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', color: 'white' }}>{t.actualBadge}</span>
                                    </div>
                                  </div>
                                </td>
                                {renderCells(true)}
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      
                      {!isBaselineFrozen && (
                        <tr>
                          <td colSpan={2} style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: 'white', padding: '5px 15px', borderBottom: '1px solid #cbd5e0' }}>
                            <button type="button" onClick={() => handleAddRow(section.id)} className={cx(ui.btnGhost, ui.small)}>+ {t.addRow}</button>
                          </td>
                          {visibleDates.map((d, i) => (
                            <td key={`add-${section.id}-${i}`} style={{ borderBottom: '1px solid #cbd5e0', backgroundColor: d.isHoliday ? '#fed7d7' : (d.isWeekend ? '#e2e8f0' : 'white') }}></td>
                          ))}
                        </tr>
                      )}
                    </React.Fragment>
                    )
                  })}

                  {!isBaselineFrozen && (
                    <tr>
                      <td colSpan={2 + visibleDates.length} style={{ padding: '20px', backgroundColor: '#f4f7f6', textAlign: 'left' }}>
                        <button type="button" onClick={handleAddSection} className={ui.btn}>
                          + {t.addSection}
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={styles.legend}>
            <span className={styles.legendTitle}>{t.legend}</span>
            {Object.entries(workPackageCatalog).filter(([code]) => code !== '').map(([code, info]) => (
              <span key={code} className={styles.legendItem}>
                <span className={styles.swatch} style={{ backgroundColor: info.color }} />
                <span><b>{code}</b> – {activityLabel(code, info)}</span>
              </span>
            ))}
          </div>
        </div>
    </div>
  );
}
