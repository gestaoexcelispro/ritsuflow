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
import { Empty, Icon, Notice, Panel, Stat, ui } from '../../../fieldop/ui';
import styles from '../../precon.module.css';


// ============================================================
// TRANSLATIONS
// ============================================================
// Texts: constraints.* in messages/precon.<language>.json. The page sets the
// translator on every render, so the helpers and the module-level components
// below always read the current language. Stored values (statuses,
// categories, action types) stay in the database as they are.
const I18N = {
  translate: (key) => key,
  language: 'en-US',
};

const tr = (key, vars) =>
  I18N.translate(`constraints.${key}`, vars);

const t = new Proxy({}, {
  get: (_, key) => tr(String(key)),
});

// Option label read at render time from constraints.<group>.<value>.
const option = (group, value) => ({
  value,
  get label() {
    return tr(`${group}.${value || 'all'}`);
  },
});


// ============================================================
// RitsuFlow™
// CONSTRAINT MANAGEMENT — CENTERED MODAL WORKSPACE
// ============================================================


// ============================================================
// CONSTANTS
// ============================================================

const ACTIVE_CONSTRAINT_STATUSES = [
  'open',
  'in_progress',
  'waiting',
  'resolved',
];


const TERMINAL_CONSTRAINT_STATUSES = [
  'cleared',
  'cancelled',
];


const DRAWER_TABS = [
  option('tab', 'details'),
  option('tab', 'forecast'),
  option('tab', 'actions'),
  option('tab', 'work'),
  option('tab', 'history'),
];


const STATUS_OPTIONS = [
  option('statusValue', ''),
  option('statusValue', 'open'),
  option('statusValue', 'in_progress'),
  option('statusValue', 'waiting'),
  option('statusValue', 'resolved'),
  option('statusValue', 'cleared'),
  option('statusValue', 'cancelled'),
];


const CATEGORY_OPTIONS = [
  option('categoryValue', 'projects_information'),
  option('categoryValue', 'materials'),
  option('categoryValue', 'labor'),
  option('categoryValue', 'equipment'),
  option('categoryValue', 'space'),
  option('categoryValue', 'predecessor'),
  option('categoryValue', 'external_conditions'),
];


const PRIORITY_OPTIONS = [
  option('priorityValue', 'low'),
  option('priorityValue', 'normal'),
  option('priorityValue', 'high'),
  option('priorityValue', 'critical'),
];


const IMPACT_OPTIONS = [
  option('impactValue', 'none'),
  option('impactValue', 'low'),
  option('impactValue', 'moderate'),
  option('impactValue', 'high'),
  option('impactValue', 'critical'),
];


const RESPONSE_APPROACH_OPTIONS = [
  option('approachValue', 'eliminate_cause'),
  option('approachValue', 'reduce_impact'),
  option('approachValue', 'alternative_solution'),
  option('approachValue', 'transfer_responsibility'),
  option('approachValue', 'accept_impact'),
  option('approachValue', 'escalate'),
];


const EXPECTED_IMPACT_OPTIONS = [
  option('expectedValue', 'protect_required_by'),
  option('expectedValue', 'reduce_delay'),
  option('expectedValue', 'no_schedule_effect'),
  option('expectedValue', 'other'),
];


const EFFECTIVENESS_OPTIONS = [
  option('effectivenessValue', 'effective'),
  option('effectivenessValue', 'partially_effective'),
  option('effectivenessValue', 'ineffective'),
];


const CATEGORY_VALUES = new Set(
  CATEGORY_OPTIONS.map(
    (item) => item.value
  )
);


// Affected-work types are compared in code; only their display is translated.
const WORK_TYPE_KEYS = {
  'Master Plan': 'sourceMasterPlan',
  Lookahead: 'sourceLookahead',
  'Lookahead / Koskela': 'sourceKoskela',
};

const ACTION_TYPES = new Set([
  'created',
  'assigned',
  'responsible_changed',
  'action_updated',
  'status_changed',
  'target_date_changed',
  'comment_added',
  'resolved',
  'verified',
  'cleared',
  'cancelled',
  'action_plan_added',
  'action_plan_completed',
  'action_effectiveness_evaluated',
  'priority_auto_escalated',
  'priority_auto_escalation_removed',
]);


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

  if (CATEGORY_VALUES.has(value)) {
    return tr(`categoryValue.${value}`);
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
    I18N.language,
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
    I18N.language,
    {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
    String(constraintId)
      .replace(/-/g, '')
      .slice(0, 6)
      .toUpperCase();

  return `CON-${compact}`;
}


function getSourceLabel(
  constraint
) {
  if (
    constraint
      ?.sheet_readiness_assessment_id
  ) {
    return tr('sourceKoskela');
  }

  if (
    constraint
      ?.readiness_assessment_id
  ) {
    return tr('sourceLookahead');
  }

  if (
    constraint
      ?.lookahead_work_item_id
  ) {
    return tr('sourceLookahead');
  }

  if (
    constraint
      ?.master_plan_package_id
  ) {
    return tr('sourceMasterPlan');
  }

  return tr('sourceManual');
}


function getStatusLabel(status) {
  switch (status) {
    case 'open':
      return tr('statusValue.open');

    case 'in_progress':
      return tr('statusValue.in_progress');

    case 'waiting':
      return tr('statusValue.waiting');

    case 'resolved':
      return tr('statusValue.resolved');

    case 'cleared':
      return tr('statusValue.cleared');

    case 'cancelled':
      return tr('statusValue.cancelled');

    case 'completed':
      return tr('statusValue.completed');

    default:
      return formatLabel(status);
  }
}


function getActionTypeLabel(
  actionType
) {
  if (!actionType) {
    return tr('actionType.unknown');
  }

  return ACTION_TYPES.has(actionType)
    ? tr(`actionType.${actionType}`)
    : formatLabel(actionType);
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
    case 'completed':
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
  switch (
    normalizeText(priority)
  ) {
    case 'critical':
      return {
        background: '#fee2e2',
        border: '#ef4444',
        color: '#991b1b',
      };

    case 'high':
      return {
        background: '#fff7ed',
        border: '#fdba74',
        color: '#c2410c',
      };

    case 'normal':
    case 'medium':
      return {
        background: '#fefce8',
        border: '#fde047',
        color: '#854d0e',
      };

    case 'low':
      return {
        background: '#f0fdf4',
        border: '#86efac',
        color: '#166534',
      };

    default:
      return {
        background: '#f8fafc',
        border: '#cbd5e1',
        color: '#475569',
      };
  }
}


function getImpactStyle(
  impact
) {
  switch (
    normalizeText(impact)
  ) {
    case 'critical':
      return {
        background: '#fee2e2',
        border: '#ef4444',
        color: '#991b1b',
      };

    case 'high':
      return {
        background: '#fff7ed',
        border: '#fdba74',
        color: '#c2410c',
      };

    case 'moderate':
      return {
        background: '#fefce8',
        border: '#fde047',
        color: '#854d0e',
      };

    case 'low':
      return {
        background: '#f0fdf4',
        border: '#86efac',
        color: '#166534',
      };

    case 'none':
      return {
        background: '#f8fafc',
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


function formatResolvedDate(
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
    return '—';
  }

  return new Intl.DateTimeFormat(
    I18N.language,
    {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }
  ).format(date);
}


function extractConstraintId(
  value
) {
  if (!value) {
    return null;
  }

  if (
    typeof value ===
    'string'
  ) {
    return value;
  }

  if (
    Array.isArray(value)
  ) {
    return extractConstraintId(
      value[0]
    );
  }

  if (
    typeof value ===
    'object'
  ) {
    return (
      value.id ||
      value.constraint_id ||
      value.created_constraint_id ||
      null
    );
  }

  return null;
}


function getEffectivenessStyle(
  effectiveness
) {
  switch (effectiveness) {
    case 'effective':
      return {
        background: '#dcfce7',
        border: '#86efac',
        color: '#166534',
      };

    case 'partially_effective':
      return {
        background: '#fef3c7',
        border: '#fcd34d',
        color: '#92400e',
      };

    case 'ineffective':
      return {
        background: '#fee2e2',
        border: '#fca5a5',
        color: '#991b1b',
      };

    default:
      return {
        background: '#f1f5f9',
        border: '#cbd5e1',
        color: '#64748b',
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


function getExposureLabel(
  days
) {
  if (
    days === null ||
    days === undefined
  ) {
    return '—';
  }

  if (days > 0) {
    return tr(days === 1 ? 'exposureLateOne' : 'exposureLate', { count: days });
  }

  if (days === 0) {
    return tr('exposureOnDate');
  }

  const early = Math.abs(days);
  return tr(early === 1 ? 'exposureEarlyOne' : 'exposureEarly', { count: early });
}


function getOutlookLabel(value) {
  switch (value) {
    case 'cleared':
      return tr('statusValue.cleared');

    case 'awaiting_verification':
      return tr('outlook.awaiting_verification');

    case 'awaiting_verification_exposed':
      return tr('outlook.awaiting_verification_exposed');

    case 'recovery_possible':
      return tr('outlook.recovery_possible');

    case 'schedule_exposed':
      return tr('outlook.schedule_exposed');

    case 'action_plan_active':
      return tr('outlook.action_plan_active');

    case 'protected':
      return tr('outlook.protected');

    default:
      return formatLabel(value);
  }
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

  } catch (error) {
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
      'normal',

    impact:
      'moderate',

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
      constraint
        ?.base_priority ||
      constraint
        ?.legacy_priority ||
      'normal',

    impact:
      constraint
        ?.impact ||
      'moderate',

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


function createRecoveryActionForm() {
  return {
    response_approach:
      'alternative_solution',

    action_title:
      '',

    action_description:
      '',

    responsible_party:
      '',

    due_date:
      '',

    expected_impact:
      'protect_required_by',
  };
}


// ============================================================
// PAGE
// ============================================================

export default function ConstraintLogPage() {
  const translate = useT('precon');
  const { language } = useLanguage();
  I18N.translate = translate;
  I18N.language = language;

  // ==========================================================
  // DATA
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
    impactFilter,
    setImpactFilter,
  ] = useState('');


  const [
    responsibleFilter,
    setResponsibleFilter,
  ] = useState('');


  // ==========================================================
  // CREATE
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
  // DRAWER
  // ==========================================================

  const [
    managedConstraint,
    setManagedConstraint,
  ] = useState(null);


  const [
    drawerTab,
    setDrawerTab,
  ] = useState(
    'details'
  );


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
  // RECOVERY ACTIONS
  // ==========================================================

  const [
    recoveryActions,
    setRecoveryActions,
  ] = useState([]);


  const [
    loadingRecoveryActions,
    setLoadingRecoveryActions,
  ] = useState(false);


  const [
    recoveryActionForm,
    setRecoveryActionForm,
  ] = useState(
    createRecoveryActionForm()
  );


  const [
    savingRecoveryAction,
    setSavingRecoveryAction,
  ] = useState(false);


  const [
    selectedRecoveryActionId,
    setSelectedRecoveryActionId,
  ] = useState(null);


  const [
    recoveryActionNote,
    setRecoveryActionNote,
  ] = useState('');


  const [
    effectivenessValue,
    setEffectivenessValue,
  ] = useState(
    'effective'
  );


  const [
    recoveryActionPanel,
    setRecoveryActionPanel,
  ] = useState(null);


  // ==========================================================
  // DEEP-LINK GOVERNANCE
  //
  // Lookahead locked Koskela cells navigate here with:
  // ?projectId=<project>&constraintId=<constraint>
  //
  // The ref prevents lifecycle refreshes from repeatedly
  // reopening the same constraint modal.
  // ==========================================================

  const autoOpenedConstraintIdRef =
    useRef(null);


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
                  ascending:
                    false,
                }
              );


          if (error) {
            throw error;
          }


          const rows =
            data || [];


          setProjects(rows);


          const requested =
            readPreconProjectId();


          if (
            requested &&
            rows.some(
              (project) =>
                project.id ===
                requested
            )
          ) {
            setSelectedProjectId(
              requested
            );

            return;
          }


          if (
            rows.length ===
            1
          ) {
            setSelectedProjectId(
              rows[0].id
            );
          }

        } catch (error) {

          console.error(
            'Projects:',
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
  // LOAD CONSTRAINTS
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


        setLoading(true);
        setErrorMessage('');


        try {

          const {
            data:
              constraintData,

            error:
              constraintError,
          } =
            await supabase
              .from(
                'constraint_management_overview'
              )
              .select('*')
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


          const overviewConstraints =
            constraintData ||
            [];


          if (
            overviewConstraints.length ===
            0
          ) {

            setConstraints([]);
            setAffectedWork([]);
            setLookaheadItems({});
            setMasterPlanPackages({});

            return;
          }


          const overviewConstraintIds =
            overviewConstraints.map(
              (constraint) =>
                constraint.id
            );


          const {
            data:
              constraintMetaData,

            error:
              constraintMetaError,
          } =
            await supabase
              .from('constraints')
              .select(`
                id,
                status,
                blocking,
                priority,
                impact,
                resolved_at,
                sheet_readiness_assessment_id
              `)
              .in(
                'id',
                overviewConstraintIds
              );


          if (
            constraintMetaError
          ) {
            throw constraintMetaError;
          }


          const constraintMetaMap =
            Object.fromEntries(
              (
                constraintMetaData ||
                []
              ).map(
                (item) => [
                  item.id,
                  item,
                ]
              )
            );


          const loadedConstraints =
            overviewConstraints.map(
              (constraint) => {

                const meta =
                  constraintMetaMap[
                    constraint.id
                  ] ||
                  {};


                return {
                  ...constraint,

                  // The constraints table is the lifecycle source of truth.
                  // Do not rely on the overview view for live status after an RPC.
                  status:
                    meta.status ||
                    constraint.status,

                  blocking:
                    typeof meta.blocking === 'boolean'
                      ? meta.blocking
                      : constraint.blocking,

                  priority:
                    meta.priority ||
                    constraint.priority ||
                    constraint.base_priority ||
                    'normal',

                  impact:
                    meta.impact ||
                    constraint.impact ||
                    'moderate',

                  resolved_at:
                    meta.resolved_at ||
                    constraint.resolved_at ||
                    null,

                  sheet_readiness_assessment_id:
                    meta.sheet_readiness_assessment_id ||
                    constraint.sheet_readiness_assessment_id ||
                    null,
                };

              }
            );


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


          const {
            data:
              affectedData,

            error:
              affectedError,
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
            affectedError
          ) {
            throw affectedError;
          }


          const loadedAffected =
            affectedData ||
            [];


          setAffectedWork(
            loadedAffected
          );


          const lookaheadIds =
            Array.from(
              new Set([
                ...loadedAffected
                  .map(
                    (item) =>
                      item
                        .lookahead_work_item_id
                  )
                  .filter(Boolean),

                ...loadedConstraints
                  .map(
                    (constraint) =>
                      constraint
                        .lookahead_work_item_id
                  )
                  .filter(Boolean),
              ])
            );


          let lookaheadMap =
            {};


          if (
            lookaheadIds.length >
            0
          ) {

            const {
              data,
              error,
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
                  lookaheadIds
                );


            if (error) {
              throw error;
            }


            lookaheadMap =
              Object.fromEntries(
                (data || []).map(
                  (item) => [
                    item.id,
                    item,
                  ]
                )
              );
          }


          setLookaheadItems(
            lookaheadMap
          );


          const masterIds =
            Array.from(
              new Set([
                ...loadedAffected
                  .map(
                    (item) =>
                      item
                        .master_plan_package_id
                  )
                  .filter(Boolean),

                ...loadedConstraints
                  .map(
                    (constraint) =>
                      constraint
                        .master_plan_package_id
                  )
                  .filter(Boolean),

                ...Object
                  .values(
                    lookaheadMap
                  )
                  .map(
                    (item) =>
                      item
                        .master_plan_package_id
                  )
                  .filter(Boolean),
              ])
            );


          let masterMap =
            {};


          if (
            masterIds.length >
            0
          ) {

            const {
              data,
              error,
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
                  masterIds
                );


            if (error) {
              throw error;
            }


            masterMap =
              Object.fromEntries(
                (data || []).map(
                  (item) => [
                    item.id,
                    item,
                  ]
                )
              );
          }


          setMasterPlanPackages(
            masterMap
          );

        } catch (error) {

          console.error(
            'Constraint Log:',
            error
          );


          setErrorMessage(
            error.message ||
            t.errLog
          );

        } finally {

          setLoading(false);

        }

      },
      []
    );


  // ==========================================================
  // HISTORY
  // ==========================================================

  const loadConstraintHistory =
    useCallback(
      async (
        constraintId
      ) => {

        if (!constraintId) {
          return;
        }


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
            data || []
          );

        } catch (error) {

          console.error(
            'Constraint History:',
            error
          );


          setHistoryError(
            error.message ||
            t.errHistory
          );

        } finally {

          setLoadingHistory(false);

        }

      },
      []
    );


  // ==========================================================
  // RECOVERY ACTIONS
  // ==========================================================

  const loadRecoveryActions =
    useCallback(
      async (
        constraintId
      ) => {

        if (!constraintId) {
          setRecoveryActions([]);
          return;
        }


        setLoadingRecoveryActions(
          true
        );


        try {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'constraint_actions'
              )
              .select(`
                id,
                constraint_id,
                project_id,
                response_approach,
                action_title,
                action_description,
                responsible_party,
                due_date,
                status,
                expected_impact,
                effectiveness,
                effectiveness_notes,
                completed_at,
                cancelled_at,
                created_by,
                created_by_user_id,
                created_at,
                updated_at
              `)
              .eq(
                'constraint_id',
                constraintId
              )
              .order(
                'created_at',
                {
                  ascending:
                    true,
                }
              );


          if (error) {
            throw error;
          }


          setRecoveryActions(
            data || []
          );

        } catch (error) {

          console.error(
            'Recovery Actions:',
            error
          );


          setHistoryError(
            error.message ||
            t.errPlan
          );

        } finally {

          setLoadingRecoveryActions(
            false
          );

        }

      },
      []
    );


  // ==========================================================
  // REFRESH SELECTED CONSTRAINT
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
              'constraint_management_overview'
            )
            .select('*')
            .eq(
              'id',
              constraintId
            )
            .single();


        if (error) {
          throw error;
        }


        const {
          data:
            constraintMeta,

          error:
            constraintMetaError,
        } =
          await supabase
            .from('constraints')
            .select(`
              id,
              status,
              blocking,
              priority,
              impact,
              resolved_at,
              sheet_readiness_assessment_id
            `)
            .eq(
              'id',
              constraintId
            )
            .single();


        if (
          constraintMetaError
        ) {
          throw constraintMetaError;
        }


        const mergedConstraint = {
          ...data,

          // The base constraints row is authoritative for lifecycle state.
          // This makes status changes visible immediately after lifecycle RPCs.
          status:
            constraintMeta
              ?.status ||
            data.status,

          blocking:
            typeof constraintMeta?.blocking === 'boolean'
              ? constraintMeta.blocking
              : data.blocking,

          priority:
            constraintMeta
              ?.priority ||
            data.priority ||
            data.base_priority ||
            'normal',

          impact:
            constraintMeta
              ?.impact ||
            data.impact ||
            'moderate',

          resolved_at:
            constraintMeta
              ?.resolved_at ||
            data.resolved_at ||
            null,

          sheet_readiness_assessment_id:
            constraintMeta
              ?.sheet_readiness_assessment_id ||
            data.sheet_readiness_assessment_id ||
            null,
        };


        setManagedConstraint(
          mergedConstraint
        );


        setManagementForm(
          createManagementForm(
            mergedConstraint
          )
        );


        setForecastDate(
          mergedConstraint
            .target_resolution_date ||
          mergedConstraint
            .required_by_date ||
          ''
        );


        await Promise.all([
          loadConstraintHistory(
            constraintId
          ),

          loadRecoveryActions(
            constraintId
          ),
        ]);

      },
      [
        selectedProjectId,
        loadConstraintLog,
        loadConstraintHistory,
        loadRecoveryActions,
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
  // OPEN DEEP-LINKED CONSTRAINT
  // ==========================================================

  useEffect(
    () => {

      if (
        !selectedProjectId ||
        loading ||
        constraints.length === 0
      ) {
        return;
      }


      const params =
        new URLSearchParams(
          window.location.search
        );


      const requestedConstraintId =
        params.get(
          'constraintId'
        );


      if (
        !requestedConstraintId ||
        autoOpenedConstraintIdRef.current ===
          requestedConstraintId
      ) {
        return;
      }


      const requestedConstraint =
        constraints.find(
          (constraint) =>
            constraint.id ===
            requestedConstraintId
        );


      if (!requestedConstraint) {
        return;
      }


      autoOpenedConstraintIdRef.current =
        requestedConstraintId;


      openManagementDrawer(
        requestedConstraint
      );

    },
    [
      selectedProjectId,
      loading,
      constraints,
    ]
  );


  // ==========================================================
  // PROJECT CHANGE
  // ==========================================================

  function handleProjectChange(
    projectId
  ) {

    rememberPreconProjectId(
      projectId
    );

    autoOpenedConstraintIdRef.current =
      null;


    setSelectedProjectId(
      projectId
    );

    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setImpactFilter('');
    setResponsibleFilter('');
    setSuccessMessage('');
    setErrorMessage('');

    closeManagementDrawer();


    if (projectId) {

      window.history
        .replaceState(
          {},
          '',
          `/dashboard/planning/constraints?projectId=${projectId}`
        );

    } else {

      window.history
        .replaceState(
          {},
          '',
          '/dashboard/planning/constraints'
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

    setShowCreateModal(true);

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


    const responsible =
      String(
        createForm
          .responsible_party ||
        ''
      ).trim();


    const action =
      String(
        createForm
          .action_required ||
        ''
      ).trim();


    if (
      !title ||
      !responsible ||
      !action ||
      !createForm
        .required_by_date
    ) {

      setErrorMessage(
        t.errCreateRequired
      );

      return;
    }


    setCreatingConstraint(true);


    try {

      const performedBy =
        await getPerformedBy();


      const {
        data:
          createdConstraintData,

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
              action,

            target_responsible_party:
              responsible,

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


      const createdConstraintId =
        extractConstraintId(
          createdConstraintData
        );


      if (
        createdConstraintId
      ) {

        const {
          error:
            impactError,
        } =
          await supabase.rpc(
            'set_constraint_impact_with_history',
            {
              target_constraint_id:
                createdConstraintId,

              target_impact:
                createForm.impact,

              target_comment:
                'Impact defined during constraint creation.',

              target_performed_by:
                performedBy,
            }
          );


        if (
          impactError
        ) {
          throw impactError;
        }

      }


      setShowCreateModal(false);


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
        t.errCreate
      );

    } finally {

      setCreatingConstraint(false);

    }

  }


  // ==========================================================
  // DRAWER
  // ==========================================================

  async function openManagementDrawer(
    constraint
  ) {

    setManagedConstraint(
      constraint
    );


    setDrawerTab(
      'details'
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

    setActiveManagementPanel(
      null
    );

    setHistoryError('');

    setRecoveryActionForm(
      createRecoveryActionForm()
    );

    setRecoveryActionPanel(
      null
    );

    setSelectedRecoveryActionId(
      null
    );

    setRecoveryActionNote('');

    setEffectivenessValue(
      'effective'
    );


    await Promise.all([
      loadConstraintHistory(
        constraint.id
      ),

      loadRecoveryActions(
        constraint.id
      ),
    ]);

  }


  function closeManagementDrawer() {

    setManagedConstraint(null);

    setDrawerTab(
      'details'
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

    setRecoveryActions([]);

    setRecoveryActionForm(
      createRecoveryActionForm()
    );

    setRecoveryActionPanel(
      null
    );

    setSelectedRecoveryActionId(
      null
    );

    setRecoveryActionNote('');

    setEffectivenessValue(
      'effective'
    );

    setHistoryError('');

  }


  function selectDrawerTab(
    tab
  ) {

    setDrawerTab(
      tab
    );

    setActiveManagementPanel(
      null
    );

    setManagementNote('');

    setRecoveryActionPanel(
      null
    );

    setSelectedRecoveryActionId(
      null
    );

    setRecoveryActionNote('');

    setHistoryError('');

  }


  function toggleManagementPanel(
    panel
  ) {

    setHistoryError('');

    setManagementNote('');


    if (managedConstraint) {

      setForecastDate(
        managedConstraint
          .target_resolution_date ||
        managedConstraint
          .required_by_date ||
        ''
      );

    }


    setActiveManagementPanel(
      (current) =>
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
        t.errDetailsRequired
      );

      return;
    }


    setSavingDetails(true);
    setHistoryError('');


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


      if (
        managementForm.impact !==
        (
          managedConstraint.impact ||
          'moderate'
        )
      ) {

        const {
          error:
            impactError,
        } =
          await supabase.rpc(
            'set_constraint_impact_with_history',
            {
              target_constraint_id:
                managedConstraint.id,

              target_impact:
                managementForm.impact,

              target_comment:
                managementForm.comment ||
                'Constraint impact updated.',

              target_performed_by:
                performedBy,
            }
          );


        if (
          impactError
        ) {
          throw impactError;
        }

      }


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      console.error(
        'Save Details:',
        error
      );


      setHistoryError(
        error.message ||
        t.errDetails
      );

    } finally {

      setSavingDetails(false);

    }

  }


  // ==========================================================
  // COMMENT
  // ==========================================================

  async function addManagementComment() {

    const note =
      String(
        managementNote ||
        ''
      ).trim();


    if (!note) {

      setHistoryError(
        t.errCommentRequired
      );

      return;
    }


    setSavingAction(true);
    setHistoryError('');


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

      setActiveManagementPanel(
        null
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        t.errComment
      );

    } finally {

      setSavingAction(false);

    }

  }


  // ==========================================================
  // UPDATE FORECAST
  // ==========================================================

  async function updateForecast() {

    const reason =
      String(
        managementNote ||
        ''
      ).trim();


    if (!forecastDate) {

      setHistoryError(
        t.errNewDateRequired
      );

      return;
    }


    if (!reason) {

      setHistoryError(
        t.errDateReasonRequired
      );

      return;
    }


    setSavingAction(true);
    setHistoryError('');


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
              reason,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      setManagementNote('');

      setActiveManagementPanel(
        null
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        t.errForecast
      );

    } finally {

      setSavingAction(false);

    }

  }


  // ==========================================================
  // REOPEN
  // ==========================================================

  async function reopenConstraint() {

    if (
      !managedConstraint ||
      savingAction
    ) {
      return;
    }


    const reason =
      String(
        managementNote ||
        ''
      ).trim();


    if (!forecastDate) {

      setHistoryError(
        t.errNewDateRequired
      );

      return;
    }


    if (!reason) {

      setHistoryError(
        t.errReopenReasonRequired
      );

      return;
    }


    setSavingAction(true);
    setHistoryError('');


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

      setActiveManagementPanel(
        null
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      console.error(
        'Reopen Constraint:',
        error
      );


      setHistoryError(
        error.message ||
        t.errReopen
      );

    } finally {

      setSavingAction(false);

    }

  }


  // ==========================================================
  // LIFECYCLE
  // ==========================================================

  async function executeLifecycleAction(
    action
  ) {

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
            note || null,

          target_performed_by:
            performedBy,
        };

        break;


      case 'waiting':

        if (!note) {

          setHistoryError(
            t.errWaitingReasonRequired
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
            note || null,

          target_performed_by:
            performedBy,
        };

        break;


      case 'resolve':

        if (!note) {

          setHistoryError(
            t.errResolutionRequired
          );

          return;
        }


        // Simplified atomic resolution workflow.
        // SQL 126 accepts Open, In Progress or Waiting and
        // records the true previous status directly to Resolved.
        functionName =
          'resolve_constraint_directly_with_history';

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
            t.errVerificationRequired
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
            t.errCancelReasonRequired
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


    setSavingAction(true);
    setHistoryError('');


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

      setActiveManagementPanel(
        null
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        t.errStatus
      );

    } finally {

      setSavingAction(false);

    }

  }


  // ==========================================================
  // RECOVERY ACTION — CREATE
  // ==========================================================

  async function createRecoveryAction() {

    if (
      !managedConstraint ||
      savingRecoveryAction
    ) {
      return;
    }


    const title =
      String(
        recoveryActionForm
          .action_title ||
        ''
      ).trim();


    const responsible =
      String(
        recoveryActionForm
          .responsible_party ||
        ''
      ).trim();


    if (!title) {

      setHistoryError(
        t.errActionRequired
      );

      return;
    }


    if (!responsible) {

      setHistoryError(
        t.errActionOwnerRequired
      );

      return;
    }


    if (
      !recoveryActionForm
        .due_date
    ) {

      setHistoryError(
        t.errActionDueRequired
      );

      return;
    }


    setSavingRecoveryAction(
      true
    );

    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'create_constraint_action_with_history',
          {
            target_constraint_id:
              managedConstraint.id,

            target_response_approach:
              recoveryActionForm
                .response_approach,

            target_action_title:
              title,

            target_action_description:
              recoveryActionForm
                .action_description ||
              null,

            target_responsible_party:
              responsible,

            target_due_date:
              recoveryActionForm
                .due_date,

            target_expected_impact:
              recoveryActionForm
                .expected_impact,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      setRecoveryActionForm(
        createRecoveryActionForm()
      );


      setRecoveryActionPanel(
        null
      );


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        t.errActionCreate
      );

    } finally {

      setSavingRecoveryAction(
        false
      );

    }

  }


  // ==========================================================
  // RECOVERY ACTION — START
  // ==========================================================

  async function startRecoveryAction(
    actionId
  ) {

    setSavingRecoveryAction(
      true
    );

    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'start_constraint_action_plan_item_with_history',
          {
            target_action_id:
              actionId,

            target_comment:
              recoveryActionNote ||
              null,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      closeRecoveryActionPanel();


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        t.errActionStart
      );

    } finally {

      setSavingRecoveryAction(
        false
      );

    }

  }


  // ==========================================================
  // RECOVERY ACTION — COMPLETE
  // ==========================================================

  async function completeRecoveryAction(
    actionId
  ) {

    const note =
      String(
        recoveryActionNote ||
        ''
      ).trim();


    if (!note) {

      setHistoryError(
        t.errCompletionRequired
      );

      return;
    }


    setSavingRecoveryAction(
      true
    );

    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'complete_constraint_action_with_history',
          {
            target_action_id:
              actionId,

            target_completion_note:
              note,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      closeRecoveryActionPanel();


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        t.errActionComplete
      );

    } finally {

      setSavingRecoveryAction(
        false
      );

    }

  }


  // ==========================================================
  // RECOVERY ACTION — EFFECTIVENESS
  // ==========================================================

  async function evaluateRecoveryAction(
    actionId
  ) {

    const note =
      String(
        recoveryActionNote ||
        ''
      ).trim();


    if (!note) {

      setHistoryError(
        t.errEffectivenessRequired
      );

      return;
    }


    setSavingRecoveryAction(
      true
    );

    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'evaluate_constraint_action_effectiveness_with_history',
          {
            target_action_id:
              actionId,

            target_effectiveness:
              effectivenessValue,

            target_notes:
              note,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      closeRecoveryActionPanel();


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        t.errEffectiveness
      );

    } finally {

      setSavingRecoveryAction(
        false
      );

    }

  }


  // ==========================================================
  // RECOVERY ACTION — CANCEL
  // ==========================================================

  async function cancelRecoveryAction(
    actionId
  ) {

    const reason =
      String(
        recoveryActionNote ||
        ''
      ).trim();


    if (!reason) {

      setHistoryError(
        t.errCancelReasonRequired
      );

      return;
    }


    setSavingRecoveryAction(
      true
    );

    setHistoryError('');


    try {

      const performedBy =
        await getPerformedBy();


      const {
        error,
      } =
        await supabase.rpc(
          'cancel_constraint_action_with_history',
          {
            target_action_id:
              actionId,

            target_reason:
              reason,

            target_performed_by:
              performedBy,
          }
        );


      if (error) {
        throw error;
      }


      closeRecoveryActionPanel();


      await refreshManagedConstraint(
        managedConstraint.id
      );

    } catch (error) {

      setHistoryError(
        error.message ||
        t.errActionCancel
      );

    } finally {

      setSavingRecoveryAction(
        false
      );

    }

  }


  function openRecoveryActionPanel(
    actionId,
    panel
  ) {

    setSelectedRecoveryActionId(
      actionId
    );

    setRecoveryActionPanel(
      panel
    );

    setRecoveryActionNote('');

    setEffectivenessValue(
      'effective'
    );

    setHistoryError('');

  }


  function closeRecoveryActionPanel() {

    setSelectedRecoveryActionId(
      null
    );

    setRecoveryActionPanel(
      null
    );

    setRecoveryActionNote('');

    setEffectivenessValue(
      'effective'
    );

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
          ] || [];


        const candidates =
          [];


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
                    tr('unassignedLocation'),

                  startDate:
                    item
                      .lookahead_start_date,

                  finishDate:
                    item
                      .lookahead_finish_date,
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
                    tr('unassignedLocation'),

                  startDate:
                    item
                      .scheduled_start_date,

                  finishDate:
                    item
                      .scheduled_finish_date,
                });

              }

            }

          }
        );


        // --------------------------------------------------
        // GROUPED LOOKAHEAD / KOSKELA TRACEABILITY
        //
        // SQL 120 exposes the exact grouped sheet row directly
        // through constraint_management_overview. Koskela
        // constraints do not require constraint_affected_work
        // records to identify their governing Work Package.
        // --------------------------------------------------

        if (
          constraint
            ?.sheet_readiness_assessment_id &&
          constraint
            ?.koskela_package_code
        ) {

          candidates.push({
            key:
              `koskela-${constraint.sheet_readiness_assessment_id}`,

            type:
              'Lookahead / Koskela',

            packageCode:
              constraint.koskela_package_code ||
              '—',

            serviceName:
              constraint.koskela_package_description ||
              '',

            location:
              `Readiness · ${formatLabel(
                constraint.koskela_category ||
                constraint.category
              )}`,

            startDate:
              null,

            finishDate:
              null,
          });

        }


        const unique =
          new Map();


        candidates.forEach(
          (item) => {

            const key =
              `${normalizeText(
                item.packageCode
              )}|${normalizeText(
                item.location
              )}`;


            const existing =
              unique.get(key);


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
      () =>
        managedConstraint
          ? getConstraintAffectedWork(
              managedConstraint
            )
          : [],
      [
        managedConstraint,
        getConstraintAffectedWork,
      ]
    );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    useMemo(
      () => {

        return {

          active:
            constraints.filter(
              (constraint) =>
                ACTIVE_CONSTRAINT_STATUSES.includes(
                  constraint.status
                )
            ).length,


          highImpact:
            constraints.filter(
              (constraint) =>
                [
                  'high',
                  'critical',
                ].includes(
                  normalizeText(
                    constraint.impact
                  )
                )
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
        ),
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
              .filter(Boolean)
          )
        ),
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
              normalizeText(
                constraint.priority ||
                constraint.base_priority
              ) !==
              priorityFilter
            ) {
              return false;
            }


            if (
              impactFilter &&
              normalizeText(
                constraint.impact
              ) !==
              impactFilter
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


            return true;

          }
        );

      },
      [
        constraints,
        statusFilter,
        categoryFilter,
        priorityFilter,
        impactFilter,
        responsibleFilter,
        getConstraintAffectedWork,
      ]
    );


  // ==========================================================
  // FORECAST PREVIEW
  // ==========================================================

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
            getExposureLabel(
              variance
            ),
        };

      },
      [
        managedConstraint,
        forecastDate,
      ]
    );


  const reopenValidation =
    useMemo(
      () => {

        const hasDate =
          Boolean(
            forecastDate
          );


        const hasReason =
          Boolean(
            String(
              managementNote ||
              ''
            ).trim()
          );


        return {
          hasDate,
          hasReason,

          canSubmit:
            hasDate &&
            hasReason,
        };

      },
      [
        forecastDate,
        managementNote,
      ]
    );


  const actionPlanSummary =
    useMemo(
      () => {

        const open =
          recoveryActions.filter(
            (action) =>
              action.status ===
              'open'
          ).length;


        const inProgress =
          recoveryActions.filter(
            (action) =>
              action.status ===
              'in_progress'
          ).length;


        const completed =
          recoveryActions.filter(
            (action) =>
              action.status ===
              'completed'
          ).length;


        const effective =
          recoveryActions.filter(
            (action) =>
              action.effectiveness ===
              'effective'
          ).length;


        const protectionActions =
          recoveryActions.filter(
            (action) =>
              [
                'open',
                'in_progress',
              ].includes(
                action.status
              ) &&
              action.expected_impact ===
              'protect_required_by'
          ).length;


        const active =
          open +
          inProgress;


        const activeDates =
          recoveryActions
            .filter(
              (action) =>
                [
                  'open',
                  'in_progress',
                ].includes(
                  action.status
                )
            )
            .map(
              (action) =>
                action.due_date
            )
            .filter(Boolean)
            .sort();


        return {
          total:
            recoveryActions.length,

          active,

          completed,

          effective,

          protectionActions,

          nextDue:
            activeDates[0] ||
            null,
        };

      },
      [
        recoveryActions,
      ]
    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div style={pageStyle}>
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
          <button type="button" className={ui.btnGhost} disabled={!selectedProjectId || loading} onClick={() => loadConstraintLog(selectedProjectId)}>
            {t.refresh}
          </button>
        </div>
        <div className={`${styles.group} ${styles.push}`}>
          <button type="button" className={ui.btnPrimary} disabled={!selectedProjectId} onClick={openCreateModal}>
            <Icon name="plus" size={18} />{t.addConstraint}
          </button>
        </div>
      </div>

      {!selectedProjectId && (
        <Empty title={t.noProject} text={t.noProjectText} />
      )}

      {errorMessage && (
        <MessageBox type="error">
          {errorMessage}
        </MessageBox>
      )}


      {successMessage && (
        <MessageBox type="success">
          {successMessage}
        </MessageBox>
      )}


      {selectedProjectId && (
        <>

          {/* ==================================================
              CONSTRAINT OVERVIEW
          ================================================== */}

          <SectionCard
            title={t.overviewTitle}
            subtitle={t.overviewText}
          >

            <div style={summaryGridStyle}>

              <SummaryCard
                label={t.statActive}
                value={summary.active}
                description={t.statActiveHint}
              />

              <SummaryCard
                label={t.statHighImpact}
                value={summary.highImpact}
                description={t.statHighImpactHint}
                alert={
                  summary.highImpact >
                  0
                }
              />

              <SummaryCard
                label={t.statResolved}
                value={summary.resolved}
                description={t.statResolvedHint}
              />

              <SummaryCard
                label={t.statCleared}
                value={summary.cleared}
                description={t.statClearedHint}
                positive
              />

            </div>

          </SectionCard>


          {/* ==================================================
              CONSTRAINT WORKSPACE
          ================================================== */}

          <div style={splitWorkspaceStyle}>

            {/* ================================================
                CONSTRAINT REGISTER
            ================================================ */}

            <div style={registerPanelStyle}>

              <div style={registerHeaderStyle}>

                <div style={registerHeaderTopStyle}>

                  <div>

                    <div style={sectionHeadingStyle}>
                      {t.registerTitle}
                    </div>

                    <div style={sectionSupportingTextStyle}>
                      {t.registerText}
                    </div>

                  </div>


                  <div style={registerCountStyle}>
                    {filteredConstraints.length}{' '}
                    {t.shown}
                  </div>

                </div>


                <div style={registerFiltersStyle}>

                  <FilterField label={t.status}>
                    <select
                      value={statusFilter}
                      onChange={(
                        event
                      ) =>
                        setStatusFilter(
                          event.target.value
                        )
                      }
                      style={registerFilterInputStyle}
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


                  <FilterField label={t.category}>
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
                      style={registerFilterInputStyle}
                    >
                      <option value="">
                        {t.allCategories}
                      </option>

                      {categoryOptions.map(
                        (category) => (
                          <option
                            key={category}
                            value={category}
                          >
                            {formatLabel(
                              category
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </FilterField>


                  <FilterField label={t.priority}>
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
                      style={registerFilterInputStyle}
                    >

                      <option value="">
                        {t.allPriorities}
                      </option>

                      {PRIORITY_OPTIONS.map(
                        (priority) => (
                          <option
                            key={
                              priority.value
                            }
                            value={
                              priority.value
                            }
                          >
                            {priority.label}
                          </option>
                        )
                      )}

                    </select>
                  </FilterField>


                  <FilterField label={t.impact}>
                    <select
                      value={
                        impactFilter
                      }
                      onChange={(
                        event
                      ) =>
                        setImpactFilter(
                          event.target.value
                        )
                      }
                      style={registerFilterInputStyle}
                    >

                      <option value="">
                        {t.allImpacts}
                      </option>

                      {IMPACT_OPTIONS.map(
                        (impact) => (
                          <option
                            key={
                              impact.value
                            }
                            value={
                              impact.value
                            }
                          >
                            {impact.label}
                          </option>
                        )
                      )}

                    </select>
                  </FilterField>


                  <FilterField label={t.responsible}>
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
                      style={registerFilterInputStyle}
                    >

                      <option value="">
                        {t.allResponsible}
                      </option>

                      {responsibleOptions.map(
                        (responsible) => (
                          <option
                            key={responsible}
                            value={responsible}
                          >
                            {responsible}
                          </option>
                        )
                      )}

                    </select>
                  </FilterField>

                </div>

              </div>


              <div style={tableContainerStyle}>

                {loading ? (
                  <div style={emptyStyle}>
                    {t.loading}
                  </div>
                ) : filteredConstraints.length ===
                  0 ? (
                  <div style={emptyStyle}>
                    {t.empty}
                  </div>
                ) : (
                  <table style={tableStyle}>

                    <thead>
                      <tr>
                        {[
                          'REFERENCE',
                          'PACKAGE / LOCATION',
                          'STATUS',
                          'PRIORITY',
                          'IMPACT',
                          'PLANNED RESOLUTION',
                          'ACTUAL RESOLUTION',
                          'RESPONSIBLE',
                          '',
                        ].map(
                          (header) => (
                            <th
                              key={
                                header ||
                                'action'
                              }
                              style={
                                headerCellStyle
                              }
                            >
                              {header}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>


                    <tbody>

                      {filteredConstraints.map(
                        (constraint) => {

                          const affected =
                            getConstraintAffectedWork(
                              constraint
                            );


                          const isSelected =
                            managedConstraint
                              ?.id ===
                            constraint.id;


                          return (
                            <tr
                              key={
                                constraint.id
                              }
                              onClick={() =>
                                openManagementDrawer(
                                  constraint
                                )
                              }
                              style={{
                                cursor:
                                  'pointer',

                                background:
                                  isSelected
                                    ? '#eff6ff'
                                    : '#ffffff',
                              }}
                            >

                              <td style={leftCellStyle}>

                                <strong>
                                  {getConstraintReference(
                                    constraint.id
                                  )}
                                </strong>


                                <div style={constraintTitleStyle}>
                                  {constraint.title}
                                </div>


                                <div style={inlineBadgesStyle}>

                                  {constraint.blocking && (
                                    <span style={blockingInlineStyle}>
                                      {t.blockingBadge}
                                    </span>
                                  )}


                                  <span style={sourceInlineStyle}>
                                    {getSourceLabel(
                                      constraint
                                    )}
                                  </span>

                                </div>

                              </td>


                              <td style={leftCellStyle}>

                                <strong>
                                  {affected[0]
                                    ?.packageCode ||
                                    t.projectLevel}
                                </strong>

                                <div style={secondaryTextStyle}>
                                  {affected[0]
                                    ?.location ||
                                    t.projectLevel}
                                </div>

                              </td>


                              <td style={bodyCellStyle}>

                                <StatusBadge
                                  label={
                                    getStatusLabel(
                                      constraint.status
                                    )
                                  }
                                  style={
                                    getStatusStyle(
                                      constraint.status
                                    )
                                  }
                                />

                              </td>


                              <td style={bodyCellStyle}>

                                <StatusBadge
                                  label={
                                    formatLabel(
                                      constraint.priority ||
                                      constraint.base_priority
                                    )
                                  }
                                  style={
                                    getPriorityStyle(
                                      constraint.priority ||
                                      constraint.base_priority
                                    )
                                  }
                                />

                              </td>


                              <td style={bodyCellStyle}>

                                <StatusBadge
                                  label={
                                    formatLabel(
                                      constraint.impact ||
                                      'moderate'
                                    )
                                  }
                                  style={
                                    getImpactStyle(
                                      constraint.impact ||
                                      'moderate'
                                    )
                                  }
                                />

                              </td>


                              <td style={bodyCellStyle}>

                                <strong>
                                  {formatDate(
                                    constraint
                                      .target_resolution_date ||
                                    constraint
                                      .required_by_date
                                  )}
                                </strong>

                              </td>


                              <td style={bodyCellStyle}>

                                <strong>
                                  {formatResolvedDate(
                                    constraint
                                      .resolved_at
                                  )}
                                </strong>

                              </td>


                              <td style={leftCellStyle}>
                                {constraint
                                  .responsible_party ||
                                  '—'}
                              </td>


                              <td style={bodyCellStyle}>

                                <button
                                  type="button"
                                  onClick={(
                                    event
                                  ) => {

                                    event.stopPropagation();

                                    openManagementDrawer(
                                      constraint
                                    );

                                  }}
                                  style={
                                    manageButtonStyle
                                  }
                                >
                                  {t.manage}
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

            </div>


            {/* ================================================
                CENTERED CONSTRAINT MANAGEMENT MODAL
            ================================================ */}

            {managedConstraint && (

              <div style={managementModalOverlayStyle}>

                <aside
                  style={drawerStyle}
                  role="dialog"
                  aria-modal="true"
                  aria-label={t.drawerAria}
                >

                <div style={drawerHeaderStyle}>

                  <div>

                    <div style={drawerEyebrowStyle}>
                      {t.drawerEyebrow}
                    </div>


                    <div style={drawerTitleRowStyle}>

                      <h2 style={drawerTitleStyle}>
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

                    </div>


                    <div style={drawerConstraintTitleStyle}>
                      {managedConstraint.title}
                    </div>


                    <div style={drawerPriorityRowStyle}>

                      <div>
                        <span style={drawerMetaLabelStyle}>
                          {t.priority}
                        </span>

                        <StatusBadge
                          label={
                            formatLabel(
                              managedConstraint
                                .priority ||
                              managedConstraint
                                .base_priority
                            )
                          }
                          style={
                            getPriorityStyle(
                              managedConstraint
                                .priority ||
                              managedConstraint
                                .base_priority
                            )
                          }
                        />
                      </div>


                      <div>
                        <span style={drawerMetaLabelStyle}>
                          {t.impact}
                        </span>

                        <StatusBadge
                          label={
                            formatLabel(
                              managedConstraint
                                .impact ||
                              'moderate'
                            )
                          }
                          style={
                            getImpactStyle(
                              managedConstraint
                                .impact ||
                              'moderate'
                            )
                          }
                        />
                      </div>


                      {managedConstraint.blocking && (
                        <span style={blockingPillStyle}>
                          {t.blockingBadge}
                        </span>
                      )}

                    </div>

                  </div>


                  <button
                    type="button"
                    onClick={
                      closeManagementDrawer
                    }
                    style={
                      closeButtonStyle
                    }
                  >
                    ×
                  </button>

                </div>


                <div style={drawerSummaryStyle}>

                  <DrawerMetric
                    label={t.plannedResolution}
                    value={
                      formatDate(
                        managedConstraint
                          .target_resolution_date ||
                        managedConstraint
                          .required_by_date
                      )
                    }
                  />


                  <DrawerMetric
                    label={t.actualResolution}
                    value={
                      formatResolvedDate(
                        managedConstraint
                          .resolved_at
                      )
                    }
                  />


                  <DrawerMetric
                    label={t.recoveryActions}
                    value={
                      managedConstraint
                        .total_recovery_actions ??
                      0
                    }
                  />

                </div>


                <div style={drawerTabsStyle}>

                  {DRAWER_TABS.map(
                    (tab) => (
                      <button
                        key={
                          tab.value
                        }
                        type="button"
                        onClick={() =>
                          selectDrawerTab(
                            tab.value
                          )
                        }
                        style={{
                          ...drawerTabStyle,

                          borderBottom:
                            drawerTab ===
                              tab.value
                              ? '2px solid #2563eb'
                              : '2px solid transparent',

                          color:
                            drawerTab ===
                              tab.value
                              ? '#1d4ed8'
                              : '#64748b',

                          background:
                            drawerTab ===
                              tab.value
                              ? '#eff6ff'
                              : '#ffffff',
                        }}
                      >
                        {tab.label}
                      </button>
                    )
                  )}

                </div>


                <div style={drawerBodyStyle}>

                  {historyError && (
                    <MessageBox type="error">
                      {historyError}
                    </MessageBox>
                  )}


                  {/* DETAILS */}

                  {drawerTab ===
                    'details' && (
                    <>

                      <DrawerSection
                        title={t.detailsTitle}
                        subtitle={t.detailsText}
                      >

                        <ModalField
                          label={t.responsibleParty}
                        >
                          <input
                            disabled={
                              TERMINAL_CONSTRAINT_STATUSES.includes(
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
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            style={
                              modalInputStyle
                            }
                          />
                        </ModalField>


                        <ModalField
                          label={t.priority}
                        >
                          <select
                            disabled={
                              TERMINAL_CONSTRAINT_STATUSES.includes(
                                managedConstraint.status
                              )
                            }
                            value={
                              managementForm
                                .priority
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
                                    event
                                      .target
                                      .value,
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


                        <ModalField
                          label={t.impact}
                        >
                          <select
                            disabled={
                              TERMINAL_CONSTRAINT_STATUSES.includes(
                                managedConstraint.status
                              )
                            }
                            value={
                              managementForm
                                .impact
                            }
                            onChange={(
                              event
                            ) =>
                              setManagementForm(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  impact:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            style={
                              modalInputStyle
                            }
                          >
                            {IMPACT_OPTIONS.map(
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
                          label={t.requiredAction}
                        >
                          <textarea
                            disabled={
                              TERMINAL_CONSTRAINT_STATUSES.includes(
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
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            style={
                              modalTextareaStyle
                            }
                          />
                        </ModalField>


                        <ModalField
                          label={t.description}
                        >
                          <textarea
                            disabled={
                              TERMINAL_CONSTRAINT_STATUSES.includes(
                                managedConstraint.status
                              )
                            }
                            value={
                              managementForm
                                .description
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
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            style={
                              modalTextareaStyle
                            }
                          />
                        </ModalField>


                        {!TERMINAL_CONSTRAINT_STATUSES.includes(
                          managedConstraint.status
                        ) && (
                          <>

                            <label style={checkboxStyle}>

                              <input
                                type="checkbox"
                                checked={
                                  managementForm
                                    .blocking
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
                                        event
                                          .target
                                          .checked,
                                    })
                                  )
                                }
                              />

                              {t.blockingConstraint}

                            </label>


                            <ModalField
                              label={t.changeComment}
                            >
                              <textarea
                                value={
                                  managementForm
                                    .comment
                                }
                                onChange={(
                                  event
                                ) =>
                                  setManagementForm(
                                    (
                                      current
                                    ) => ({
                                      ...current,

                                      comment:
                                        event
                                          .target
                                          .value,
                                    })
                                  )
                                }
                                style={
                                  smallTextareaStyle
                                }
                              />
                            </ModalField>


                            <div style={rightActionsStyle}>

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
                                  ? t.saving
                                  : t.saveDetails}
                              </button>

                            </div>

                          </>
                        )}

                      </DrawerSection>


                      <DrawerSection
                        title={t.statusTitle}
                        subtitle={tr('currentStatusValue', { status: getStatusLabel(managedConstraint.status) })}
                      >

                        <div style={lifecycleFlowStyle}>

                          <LifecycleStage
                            label={t.stageOpen}
                            active={
                              managedConstraint
                                .status ===
                              'open' ||
                              managedConstraint
                                .status ===
                              'in_progress'
                            }
                          />

                          <span style={lifecycleArrowStyle}>
                            →
                          </span>

                          <LifecycleStage
                            label={t.stageResolved}
                            active={
                              managedConstraint
                                .status ===
                              'resolved'
                            }
                          />

                          <span style={lifecycleArrowStyle}>
                            →
                          </span>

                          <LifecycleStage
                            label={t.stageReleased}
                            active={
                              managedConstraint
                                .status ===
                              'cleared'
                            }
                          />

                          {managedConstraint
                            .status ===
                            'waiting' && (
                            <>
                              <span style={lifecycleArrowStyle}>
                                ·
                              </span>

                              <LifecycleStage
                                label={t.stageWaiting}
                                active
                              />
                            </>
                          )}

                        </div>


                        <div style={lifecycleButtonsGridStyle}>

                          {(managedConstraint
                            .status ===
                            'open' ||
                            managedConstraint
                              .status ===
                            'in_progress') && (
                            <>
                              <LifecycleButton
                                label={t.resolve}
                                description={t.resolveHint}
                                emphasis
                                onClick={() =>
                                  toggleManagementPanel(
                                    'resolve'
                                  )
                                }
                              />

                              <LifecycleButton
                                label={t.setWaiting}
                                description={t.setWaitingHint}
                                onClick={() =>
                                  toggleManagementPanel(
                                    'waiting'
                                  )
                                }
                              />
                            </>
                          )}


                          {managedConstraint
                            .status ===
                            'waiting' && (
                            <>
                              <LifecycleButton
                                label={t.resume}
                                description={t.resumeHint}
                                onClick={() =>
                                  toggleManagementPanel(
                                    'resume'
                                  )
                                }
                              />

                              <LifecycleButton
                                label={t.resolve}
                                description={t.resolveHint}
                                emphasis
                                onClick={() =>
                                  toggleManagementPanel(
                                    'resolve'
                                  )
                                }
                              />
                            </>
                          )}


                          {managedConstraint
                            .status ===
                            'resolved' && (
                            <>
                              <LifecycleButton
                                label={t.verify}
                                description={t.verifyHint}
                                emphasis
                                onClick={() =>
                                  toggleManagementPanel(
                                    'clear'
                                  )
                                }
                              />

                              <LifecycleButton
                                label={t.reopen}
                                description={t.reopenHint}
                                warning
                                onClick={() => {

                                  setDrawerTab(
                                    'forecast'
                                  );

                                  toggleManagementPanel(
                                    'reopen'
                                  );

                                }}
                              />
                            </>
                          )}


                          {ACTIVE_CONSTRAINT_STATUSES.includes(
                            managedConstraint.status
                          ) && (
                            <LifecycleButton
                              label={t.cancelConstraintShort}
                              description={t.cancelHint}
                              danger
                              onClick={() =>
                                toggleManagementPanel(
                                  'cancel'
                                )
                              }
                            />
                          )}

                        </div>


                        {activeManagementPanel ===
                          'waiting' && (
                          <LifecycleActionPanel
                            title={t.setWaiting}
                            description={t.setWaitingText}
                            label={t.waitingReason}
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel={t.setWaiting}
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'waiting'
                              )
                            }
                          />
                        )}


                        {activeManagementPanel ===
                          'resume' && (
                          <LifecycleActionPanel
                            title={t.resumeTitle}
                            description={t.resumeText}
                            label={t.optionalComment}
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel={t.resume}
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'resume'
                              )
                            }
                          />
                        )}


                        {activeManagementPanel ===
                          'resolve' && (
                          <LifecycleActionPanel
                            title={t.resolve}
                            description={t.resolveText}
                            label={t.resolution}
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel={t.saveResolution}
                            positive
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'resolve'
                              )
                            }
                          />
                        )}


                        {activeManagementPanel ===
                          'clear' && (
                          <LifecycleActionPanel
                            title={t.verify}
                            description={t.verifyText}
                            label={t.verificationNote}
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel={t.verify}
                            positive
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'clear'
                              )
                            }
                          />
                        )}


                        {activeManagementPanel ===
                          'cancel' && (
                          <LifecycleActionPanel
                            title={t.cancelConstraint}
                            description={t.cancelText}
                            label={t.cancelReason}
                            value={
                              managementNote
                            }
                            setValue={
                              setManagementNote
                            }
                            saving={
                              savingAction
                            }
                            confirmLabel={t.cancelConstraint}
                            danger
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={() =>
                              executeLifecycleAction(
                                'cancel'
                              )
                            }
                          />
                        )}

                      </DrawerSection>


                      <DrawerSection
                        title={t.updateTitle}
                        subtitle={t.updateText}
                      >

                        <textarea
                          value={
                            activeManagementPanel ===
                              'comment'
                              ? managementNote
                              : ''
                          }
                          placeholder={t.updatePlaceholder}
                          onFocus={() => {

                            setActiveManagementPanel(
                              'comment'
                            );

                          }}
                          onChange={(
                            event
                          ) => {

                            setActiveManagementPanel(
                              'comment'
                            );

                            setManagementNote(
                              event.target.value
                            );

                          }}
                          style={
                            smallTextareaStyle
                          }
                        />


                        <div style={rightActionsStyle}>

                          <button
                            type="button"
                            disabled={
                              activeManagementPanel !==
                                'comment' ||
                              savingAction
                            }
                            onClick={
                              addManagementComment
                            }
                            style={
                              secondaryActionButtonStyle
                            }
                          >
                            {t.addComment}
                          </button>

                        </div>

                      </DrawerSection>

                    </>
                  )}


                  {/* FORECAST */}

                  {drawerTab ===
                    'forecast' && (
                    <DrawerSection
                      title={t.forecastTitle}
                      subtitle={t.forecastText}
                    >

                      <div style={forecastStackStyle}>

                        <ForecastCard
                          label={t.requiredBy}
                          value={
                            formatDate(
                              managedConstraint
                                .required_by_date
                            )
                          }
                          description={t.requiredByHint}
                        />


                        <ForecastCard
                          label={t.plannedResolution}
                          value={
                            formatDate(
                              managedConstraint
                                .target_resolution_date ||
                              managedConstraint
                                .required_by_date
                            )
                          }
                          description={t.plannedResolutionHint}
                        />


                        <ForecastCard
                          label={t.forecastVariance}
                          value={
                            getExposureLabel(
                              managedConstraint
                                .schedule_exposure_days
                            )
                          }
                          description={
                            managedConstraint
                              .schedule_exposure_status ===
                              'exposed'
                              ? t.varianceLate
                              : t.varianceOnTime
                          }
                          alert={
                            managedConstraint
                              .schedule_exposure_status ===
                            'exposed'
                          }
                        />


                        <ForecastCard
                          label={t.outlook}
                          value={
                            getOutlookLabel(
                              managedConstraint
                                .current_outlook
                            )
                          }
                          description={t.outlookHint}
                          alert={
                            managedConstraint
                              .schedule_exposure_status ===
                            'exposed'
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
                        <button
                          type="button"
                          onClick={() =>
                            toggleManagementPanel(
                              'forecast'
                            )
                          }
                          style={
                            forecastButtonStyle
                          }
                        >
                          {t.updateForecast}
                        </button>
                      )}


                      {activeManagementPanel ===
                        'forecast' && (
                        <ActionPanel
                          title={t.updateForecastTitle}
                          description={t.updateForecastText}
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
                            label={t.dateReason}
                          >
                            <textarea
                              value={
                                managementNote
                              }
                              onChange={(
                                event
                              ) =>
                                setManagementNote(
                                  event.target.value
                                )
                              }
                              placeholder={t.dateReasonPlaceholder}
                              style={
                                smallTextareaStyle
                              }
                            />
                          </ModalField>


                          <div style={warningBoxStyle}>
                            {t.dateChangeNote}
                          </div>


                          <ActionButtons
                            saving={
                              savingAction
                            }
                            confirmLabel={t.confirmForecast}
                            onCancel={() =>
                              setActiveManagementPanel(
                                null
                              )
                            }
                            onConfirm={
                              updateForecast
                            }
                          />

                        </ActionPanel>
                      )}


                      {managedConstraint
                        .status ===
                        'resolved' && (
                        <button
                          type="button"
                          onClick={() =>
                            toggleManagementPanel(
                              'reopen'
                            )
                          }
                          style={
                            reopenButtonStyle
                          }
                        >
                          {t.reopenTitle}
                        </button>
                      )}


                      {activeManagementPanel ===
                        'reopen' && (
                        <ActionPanel
                          title={t.reopenTitle}
                          description={t.reopenText}
                        >

                          <div style={reopenNoticeStyle}>
                            {t.statusChangeFrom} <strong>{t.stageResolved}</strong> {t.statusChangeTo} <strong>{t.stageInProgress}</strong>{t.statusChangeEnd}
                          </div>


                          <ForecastDateFields
                            requiredBy={
                              managedConstraint
                                .required_by_date
                            }
                            date={
                              forecastDate
                            }
                            setDate={(
                              value
                            ) => {

                              setForecastDate(
                                value
                              );

                              if (value) {
                                setHistoryError('');
                              }

                            }}
                            preview={
                              forecastPreview
                            }
                          />


                          <ModalField
                            label={t.reopenReason}
                          >
                            <textarea
                              value={
                                managementNote
                              }
                              onChange={(
                                event
                              ) => {

                                const value =
                                  event
                                    .target
                                    .value;


                                setManagementNote(
                                  value
                                );


                                if (
                                  value.trim()
                                ) {
                                  setHistoryError('');
                                }

                              }}
                              placeholder={t.reopenPlaceholder}
                              style={
                                smallTextareaStyle
                              }
                            />


                            {!reopenValidation
                              .hasReason && (
                              <div style={inlineValidationStyle}>
                                {t.reasonRequired}
                              </div>
                            )}

                          </ModalField>


                          <div style={reopenTransitionStyle}>

                            <div>
                              <div style={metaLabelStyle}>
                                {t.currentStatus}
                              </div>

                              <strong>
                                {t.stageResolved}
                              </strong>
                            </div>


                            <div style={reopenArrowStyle}>
                              →
                            </div>


                            <div>
                              <div style={metaLabelStyle}>
                                {t.newStatus}
                              </div>

                              <strong
                                style={{
                                  color:
                                    '#1d4ed8',
                                }}
                              >
                                {t.stageInProgress}
                              </strong>
                            </div>

                          </div>


                          <div style={rightActionsStyle}>

                            <button
                              type="button"
                              onClick={() => {

                                setActiveManagementPanel(
                                  null
                                );

                                setManagementNote('');

                                setHistoryError('');

                              }}
                              style={
                                secondaryButtonStyle
                              }
                            >
                              {t.cancel}
                            </button>


                            <button
                              type="button"
                              disabled={
                                savingAction ||
                                !reopenValidation
                                  .canSubmit
                              }
                              onClick={
                                reopenConstraint
                              }
                              style={{
                                ...warningPrimaryButtonStyle,

                                opacity:
                                  savingAction ||
                                  !reopenValidation
                                    .canSubmit
                                    ? 0.45
                                    : 1,

                                cursor:
                                  savingAction ||
                                  !reopenValidation
                                    .canSubmit
                                    ? 'not-allowed'
                                    : 'pointer',
                              }}
                            >
                              {savingAction
                                ? t.reopening
                                : t.confirmReopen}
                            </button>

                          </div>

                        </ActionPanel>
                      )}

                    </DrawerSection>
                  )}


                  {/* ACTION PLAN */}

                  {drawerTab ===
                    'actions' && (
                    <DrawerSection
                      title={t.planTitle}
                      subtitle={t.planText}
                    >

                      <div style={actionSummaryGridStyle}>

                        <MiniSummary
                          label={t.planTotal}
                          value={
                            actionPlanSummary
                              .total
                          }
                        />

                        <MiniSummary
                          label={t.planActive}
                          value={
                            actionPlanSummary
                              .active
                          }
                        />

                        <MiniSummary
                          label={t.planCompleted}
                          value={
                            actionPlanSummary
                              .completed
                          }
                        />

                        <MiniSummary
                          label={t.planEffective}
                          value={
                            actionPlanSummary
                              .effective
                          }
                        />

                        <MiniSummary
                          label={t.planProtection}
                          value={
                            actionPlanSummary
                              .protectionActions
                          }
                        />

                        <MiniSummary
                          label={t.planNextDue}
                          value={
                            formatDate(
                              actionPlanSummary
                                .nextDue
                            )
                          }
                        />

                      </div>


                      {!TERMINAL_CONSTRAINT_STATUSES.includes(
                        managedConstraint.status
                      ) && (
                        <button
                          type="button"
                          onClick={() => {

                            setRecoveryActionForm(
                              createRecoveryActionForm()
                            );

                            setRecoveryActionPanel(
                              recoveryActionPanel ===
                                'create'
                                ? null
                                : 'create'
                            );

                            setSelectedRecoveryActionId(
                              null
                            );

                            setHistoryError('');

                          }}
                          style={
                            addRecoveryButtonStyle
                          }
                        >
                          {t.addAction}
                        </button>
                      )}


                      {recoveryActionPanel ===
                        'create' && (
                        <ActionPanel
                          title={t.newActionTitle}
                          description={t.newActionText}
                        >

                          <ModalField
                            label={t.responseApproach}
                          >
                            <select
                              value={
                                recoveryActionForm
                                  .response_approach
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    response_approach:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              style={
                                modalInputStyle
                              }
                            >
                              {RESPONSE_APPROACH_OPTIONS.map(
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
                            label={t.actionTitle}
                          >
                            <input
                              value={
                                recoveryActionForm
                                  .action_title
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    action_title:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              placeholder={t.actionPlaceholder}
                              style={
                                modalInputStyle
                              }
                            />
                          </ModalField>


                          <ModalField
                            label={t.actionDescription}
                          >
                            <textarea
                              value={
                                recoveryActionForm
                                  .action_description
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    action_description:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              style={
                                smallTextareaStyle
                              }
                            />
                          </ModalField>


                          <ModalField
                            label={t.responsiblePartyRequired}
                          >
                            <input
                              value={
                                recoveryActionForm
                                  .responsible_party
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    responsible_party:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              placeholder={t.ownerPlaceholder}
                              style={
                                modalInputStyle
                              }
                            />
                          </ModalField>


                          <ModalField
                            label={t.actionDue}
                          >
                            <input
                              type="date"
                              value={
                                recoveryActionForm
                                  .due_date
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    due_date:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              style={
                                modalInputStyle
                              }
                            />
                          </ModalField>


                          <ModalField
                            label={t.expectedImpact}
                          >
                            <select
                              value={
                                recoveryActionForm
                                  .expected_impact
                              }
                              onChange={(
                                event
                              ) =>
                                setRecoveryActionForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    expected_impact:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              style={
                                modalInputStyle
                              }
                            >
                              {EXPECTED_IMPACT_OPTIONS.map(
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


                          <ActionButtons
                            saving={
                              savingRecoveryAction
                            }
                            confirmLabel={t.addActionConfirm}
                            onCancel={() =>
                              setRecoveryActionPanel(
                                null
                              )
                            }
                            onConfirm={
                              createRecoveryAction
                            }
                          />

                        </ActionPanel>
                      )}


                      {loadingRecoveryActions ? (
                        <div style={emptyInnerStyle}>
                          {t.loadingPlan}
                        </div>
                      ) : recoveryActions.length ===
                        0 ? (
                        <div style={actionPlanEmptyStyle}>

                          <strong>
                            {t.planEmpty}
                          </strong>

                          <div style={emptyDescriptionStyle}>
                            {t.planEmptyText}
                          </div>

                        </div>
                      ) : (
                        <div style={recoveryActionListStyle}>

                          {recoveryActions.map(
                            (action) => (
                              <RecoveryActionCard
                                key={
                                  action.id
                                }
                                action={
                                  action
                                }
                                selected={
                                  selectedRecoveryActionId ===
                                  action.id
                                }
                                activePanel={
                                  recoveryActionPanel
                                }
                                note={
                                  recoveryActionNote
                                }
                                setNote={
                                  setRecoveryActionNote
                                }
                                effectiveness={
                                  effectivenessValue
                                }
                                setEffectiveness={
                                  setEffectivenessValue
                                }
                                saving={
                                  savingRecoveryAction
                                }
                                onOpenPanel={
                                  openRecoveryActionPanel
                                }
                                onClosePanel={
                                  closeRecoveryActionPanel
                                }
                                onStart={
                                  startRecoveryAction
                                }
                                onComplete={
                                  completeRecoveryAction
                                }
                                onEvaluate={
                                  evaluateRecoveryAction
                                }
                                onCancel={
                                  cancelRecoveryAction
                                }
                              />
                            )
                          )}

                        </div>
                      )}

                    </DrawerSection>
                  )}


                  {/* AFFECTED WORK */}

                  {drawerTab ===
                    'work' && (
                    <DrawerSection
                      title={t.workTitle}
                      subtitle={tr(managedAffectedWork.length === 1 ? 'linkedWorkOne' : 'linkedWork', { count: managedAffectedWork.length })}
                    >

                      {managedAffectedWork.length ===
                        0 ? (
                        <div style={emptyInnerStyle}>
                          {t.workProjectLevel}
                        </div>
                      ) : (
                        managedAffectedWork.map(
                          (item) => (
                            <div
                              key={
                                item.key
                              }
                              style={
                                affectedCardStyle
                              }
                            >

                              <div style={affectedHeaderStyle}>

                                <strong>
                                  {item.packageCode}

                                  {item.serviceName
                                    ? ` · ${item.serviceName}`
                                    : ''}
                                </strong>


                                <span style={sourceBadgeStyle}>
                                  {tr(WORK_TYPE_KEYS[item.type] || 'sourceManual')}
                                </span>

                              </div>


                              <div style={affectedLocationStyle}>
                                {item.location}
                              </div>


                              {(item.startDate ||
                                item.finishDate) && (
                                <div style={affectedDateStyle}>
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

                    </DrawerSection>
                  )}


                  {/* HISTORY */}

                  {drawerTab ===
                    'history' && (
                    <DrawerSection
                      title={t.historyTitle}
                      subtitle={t.historyText}
                    >

                      {loadingHistory ? (
                        <div style={emptyInnerStyle}>
                          {t.loadingHistory}
                        </div>
                      ) : constraintHistory.length ===
                        0 ? (
                        <div style={emptyInnerStyle}>
                          {t.historyEmpty}
                        </div>
                      ) : (
                        constraintHistory.map(
                          (entry) => (
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

                    </DrawerSection>
                  )}

                </div>


                <div style={drawerFooterStyle}>

                  <div style={footerMetaStyle}>
                    {getConstraintReference(
                      managedConstraint.id
                    )}

                    {' · '}

                    {getSourceLabel(
                      managedConstraint
                    )}
                  </div>


                  <button
                    type="button"
                    onClick={
                      closeManagementDrawer
                    }
                    style={
                      secondaryButtonStyle
                    }
                  >
                    {t.close}
                  </button>

                </div>

                </aside>

              </div>
            )}

          </div>

        </>
      )}


      {/* ======================================================
          CREATE MODAL
      ====================================================== */}

      {showCreateModal && (

        <div style={modalOverlayStyle}>

          <div style={createModalStyle}>

            <div style={createModalHeaderStyle}>

              <div>

                <div style={drawerEyebrowStyle}>
                  {t.createEyebrow}
                </div>

                <h2 style={createModalTitleStyle}>
                  {t.addConstraint}
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
              style={createFormStyle}
            >

              <ModalField
                label={t.category}
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
                          event
                            .target
                            .value,
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
                label={t.priority}
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
                          event
                            .target
                            .value,
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


              <ModalField
                label={t.impact}
              >
                <select
                  value={
                    createForm.impact
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,

                        impact:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalInputStyle
                  }
                >
                  {IMPACT_OPTIONS.map(
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
                label={t.whatBlocks}
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
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalInputStyle
                  }
                />
              </ModalField>


              <ModalField
                label={t.responsiblePartyRequired}
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
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalInputStyle
                  }
                />
              </ModalField>


              <ModalField
                label={t.requiredByRequired}
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
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalInputStyle
                  }
                />
              </ModalField>


              <ModalField
                label={t.requiredActionRequired}
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
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalTextareaStyle
                  }
                />
              </ModalField>


              <ModalField
                label={t.notes}
              >
                <textarea
                  value={
                    createForm
                      .description
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
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    modalTextareaStyle
                  }
                />
              </ModalField>


              <label style={checkboxStyle}>

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
                          event
                            .target
                            .checked,
                      })
                    )
                  }
                />

                {t.blockingConstraint}

              </label>


              <div style={rightActionsStyle}>

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
                  {t.cancel}
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
                    ? t.creating
                    : t.createConstraint}
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

function SectionCard({
  title,
  subtitle,
  children,
}) {
  return (
    <Panel title={title} text={subtitle} style={{ marginBottom: 12 }}>
      {children}
    </Panel>
  );
}


function SummaryCard({
  label,
  value,
  description,
  alert,
  positive,
}) {
  return (
    <Stat
      label={label}
      value={value}
      hint={description}
      tone={alert ? 'warn' : positive ? 'ok' : undefined}
    />
  );
}


function DrawerMetric({
  label,
  value,
  alert,
}) {

  return (
    <div
      style={{
        ...drawerMetricStyle,

        background:
          alert
            ? '#fff7f7'
            : '#f8fafc',

        borderColor:
          alert
            ? '#fecaca'
            : '#e2e8f0',
      }}
    >

      <div style={metaLabelStyle}>
        {label}
      </div>

      <div
        style={{
          marginTop:
            '5px',

          color:
            alert
              ? '#b91c1c'
              : '#0f172a',

          fontSize:
            '14px',

          fontWeight:
            900,
        }}
      >
        {value}
      </div>

    </div>
  );
}


function MiniSummary({
  label,
  value,
}) {

  return (
    <div style={miniSummaryStyle}>

      <div style={metaLabelStyle}>
        {label}
      </div>

      <div style={miniSummaryValueStyle}>
        {value ?? '—'}
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

      <label style={filterLabelStyle}>
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
    <div style={fieldStyle}>

      <label style={modalLabelStyle}>
        {label}
      </label>

      {children}

    </div>
  );
}


function DrawerSection({
  title,
  subtitle,
  children,
}) {

  return (
    <section style={drawerSectionStyle}>

      <div style={drawerSectionHeadingStyle}>
        {title}
      </div>

      {subtitle && (
        <div style={drawerSectionSupportingTextStyle}>
          {subtitle}
        </div>
      )}

      <div style={sectionBodyStyle}>
        {children}
      </div>

    </section>
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
            ? '#fff7f7'
            : '#f8fafc',

        borderColor:
          alert
            ? '#fecaca'
            : '#e2e8f0',
      }}
    >

      <div style={metaLabelStyle}>
        {label}
      </div>

      <div
        style={{
          marginTop:
            '5px',

          color:
            alert
              ? '#b91c1c'
              : '#0f172a',

          fontSize:
            '15px',

          fontWeight:
            900,
        }}
      >
        {value}
      </div>

      <div style={forecastDescriptionStyle}>
        {description}
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
    <>

      <ModalField
        label={t.newPlannedDate}
      >
        <input
          type="date"
          value={date}
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


      <div
        style={
          preview?.delayed
            ? delayAssessmentStyle
            : safeAssessmentStyle
        }
      >

        <div style={metaLabelStyle}>
          {t.exposure}
        </div>

        <strong>
          {preview?.label ||
            t.selectDate}
        </strong>

        <div style={helperTextStyle}>
          {t.requiredByColon}{' '}
          {formatDate(
            requiredBy
          )}
        </div>

      </div>

    </>
  );
}


function StatusBadge({
  label,
  style,
}) {

  return (
    <span
      style={{
        ...badgeBaseStyle,

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


function ExposureBadge({
  status,
  days,
}) {

  const exposed =
    status ===
    'exposed';


  return (
    <div
      style={{
        ...exposureBadgeStyle,

        borderColor:
          exposed
            ? '#fecaca'
            : '#bbf7d0',

        background:
          exposed
            ? '#fef2f2'
            : '#f0fdf4',

        color:
          exposed
            ? '#b91c1c'
            : '#166534',
      }}
    >

      <strong>
        {getExposureLabel(
          days
        )}
      </strong>

      <span style={exposureStatusTextStyle}>
        {exposed
          ? t.exposed
          : t.protected}
      </span>

    </div>
  );
}


function LifecycleStage({
  label,
  active,
}) {

  return (
    <span
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
    </span>
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

  let border =
    '#cbd5e1';

  let color =
    '#334155';


  if (emphasis) {
    background =
      '#f0fdf4';

    border =
      '#86efac';

    color =
      '#166534';
  }


  if (warning) {
    background =
      '#fff7ed';

    border =
      '#fdba74';

    color =
      '#9a3412';
  }


  if (danger) {
    background =
      '#fef2f2';

    border =
      '#fecaca';

    color =
      '#b91c1c';
  }


  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...lifecycleButtonStyle,

        background,

        border:
          `1px solid ${border}`,

        color,
      }}
    >

      <strong>
        {label}
      </strong>

      <span style={lifecycleDescriptionStyle}>
        {description}
      </span>

    </button>
  );
}


function ActionPanel({
  title,
  description,
  children,
}) {

  return (
    <div style={actionPanelStyle}>

      <div style={actionPanelTitleStyle}>
        {title}
      </div>

      <div style={actionPanelDescriptionStyle}>
        {description}
      </div>

      <div style={actionPanelBodyStyle}>
        {children}
      </div>

    </div>
  );
}


function LifecycleActionPanel({
  title,
  description,
  label,
  value,
  setValue,
  saving,
  confirmLabel,
  onCancel,
  onConfirm,
  positive,
  danger,
}) {

  return (
    <ActionPanel
      title={title}
      description={description}
    >

      <ModalField
        label={label}
      >
        <textarea
          value={value}
          onChange={(
            event
          ) =>
            setValue(
              event.target.value
            )
          }
          style={
            smallTextareaStyle
          }
        />
      </ModalField>


      <ActionButtons
        saving={saving}
        confirmLabel={
          confirmLabel
        }
        onCancel={onCancel}
        onConfirm={onConfirm}
        positive={positive}
        danger={danger}
      />

    </ActionPanel>
  );
}


function ActionButtons({
  saving,
  confirmLabel,
  onCancel,
  onConfirm,
  positive,
  warning,
  danger,
}) {

  let style =
    primaryButtonStyle;


  if (positive) {
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
    <div style={rightActionsStyle}>

      <button
        type="button"
        onClick={onCancel}
        style={
          secondaryButtonStyle
        }
      >
        {t.cancel}
      </button>


      <button
        type="button"
        disabled={saving}
        onClick={onConfirm}
        style={style}
      >
        {saving
          ? t.processing
          : confirmLabel}
      </button>

    </div>
  );
}


function RecoveryActionCard({
  action,
  selected,
  activePanel,
  note,
  setNote,
  effectiveness,
  setEffectiveness,
  saving,
  onOpenPanel,
  onClosePanel,
  onStart,
  onComplete,
  onEvaluate,
  onCancel,
}) {

  return (
    <div style={recoveryActionCardStyle}>

      <div style={recoveryActionHeaderStyle}>

        <div>

          <div style={recoveryActionTitleRowStyle}>

            <strong>
              {action.action_title}
            </strong>


            <StatusBadge
              label={
                getStatusLabel(
                  action.status
                )
              }
              style={
                getStatusStyle(
                  action.status
                )
              }
            />

          </div>


          <div style={recoveryActionApproachStyle}>
            {formatLabel(
              action
                .response_approach
            )}

            {' · '}

            {formatLabel(
              action
                .expected_impact
            )}
          </div>

        </div>


        <div style={recoveryActionDueStyle}>
          {t.due}{' '}
          <strong>
            {formatDate(
              action.due_date
            )}
          </strong>
        </div>

      </div>


      {action.action_description && (
        <div style={recoveryActionDescriptionStyle}>
          {action.action_description}
        </div>
      )}


      <div style={recoveryActionMetaGridStyle}>

        <div>

          <div style={metaLabelStyle}>
            {t.responsible}
          </div>

          <strong>
            {action
              .responsible_party}
          </strong>

        </div>


        <div>

          <div style={metaLabelStyle}>
            {t.effectiveness}
          </div>

          <StatusBadge
            label={
              action.effectiveness ===
                'not_evaluated'
                ? t.notEvaluated
                : formatLabel(
                    action.effectiveness
                  )
            }
            style={
              getEffectivenessStyle(
                action.effectiveness
              )
            }
          />

        </div>

      </div>


      {action.effectiveness_notes && (
        <div style={effectivenessNotesStyle}>
          {action.effectiveness_notes}
        </div>
      )}


      <div style={recoveryActionButtonsStyle}>

        {action.status ===
          'open' && (
          <button
            type="button"
            onClick={() =>
              onOpenPanel(
                action.id,
                'start'
              )
            }
            style={
              smallActionButtonStyle
            }
          >
            {t.start}
          </button>
        )}


        {[
          'open',
          'in_progress',
        ].includes(
          action.status
        ) && (
          <button
            type="button"
            onClick={() =>
              onOpenPanel(
                action.id,
                'complete'
              )
            }
            style={
              smallPositiveButtonStyle
            }
          >
            {t.complete}
          </button>
        )}


        {action.status ===
          'completed' &&
          action.effectiveness ===
            'not_evaluated' && (
          <button
            type="button"
            onClick={() =>
              onOpenPanel(
                action.id,
                'evaluate'
              )
            }
            style={
              smallEvaluationButtonStyle
            }
          >
            {t.evaluate}
          </button>
        )}


        {[
          'open',
          'in_progress',
        ].includes(
          action.status
        ) && (
          <button
            type="button"
            onClick={() =>
              onOpenPanel(
                action.id,
                'cancel'
              )
            }
            style={
              smallDangerButtonStyle
            }
          >
            {t.cancel}
          </button>
        )}

      </div>


      {selected &&
        activePanel ===
          'start' && (
        <ActionPanel
          title={t.startActionTitle}
          description={t.startActionText}
        >

          <ModalField
            label={t.optionalComment}
          >
            <textarea
              value={note}
              onChange={(
                event
              ) =>
                setNote(
                  event.target.value
                )
              }
              style={
                smallTextareaStyle
              }
            />
          </ModalField>


          <ActionButtons
            saving={saving}
            confirmLabel={t.start}
            onCancel={
              onClosePanel
            }
            onConfirm={() =>
              onStart(
                action.id
              )
            }
          />

        </ActionPanel>
      )}


      {selected &&
        activePanel ===
          'complete' && (
        <ActionPanel
          title={t.completeActionTitle}
          description={t.completeActionText}
        >

          <ModalField
            label={t.completionNote}
          >
            <textarea
              value={note}
              onChange={(
                event
              ) =>
                setNote(
                  event.target.value
                )
              }
              style={
                smallTextareaStyle
              }
            />
          </ModalField>


          <ActionButtons
            saving={saving}
            confirmLabel={t.markCompleted}
            positive
            onCancel={
              onClosePanel
            }
            onConfirm={() =>
              onComplete(
                action.id
              )
            }
          />

        </ActionPanel>
      )}


      {selected &&
        activePanel ===
          'evaluate' && (
        <ActionPanel
          title={t.evaluateTitle}
          description={t.evaluateText}
        >

          <ModalField
            label={t.effectivenessRequired}
          >
            <select
              value={
                effectiveness
              }
              onChange={(
                event
              ) =>
                setEffectiveness(
                  event.target.value
                )
              }
              style={
                modalInputStyle
              }
            >
              {EFFECTIVENESS_OPTIONS.map(
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
            label={t.effectivenessNotes}
          >
            <textarea
              value={note}
              onChange={(
                event
              ) =>
                setNote(
                  event.target.value
                )
              }
              style={
                smallTextareaStyle
              }
            />
          </ModalField>


          <ActionButtons
            saving={saving}
            confirmLabel={t.saveEvaluation}
            onCancel={
              onClosePanel
            }
            onConfirm={() =>
              onEvaluate(
                action.id
              )
            }
          />

        </ActionPanel>
      )}


      {selected &&
        activePanel ===
          'cancel' && (
        <ActionPanel
          title={t.cancelActionTitle}
          description={t.cancelActionText}
        >

          <ModalField
            label={t.cancelReason}
          >
            <textarea
              value={note}
              onChange={(
                event
              ) =>
                setNote(
                  event.target.value
                )
              }
              style={
                smallTextareaStyle
              }
            />
          </ModalField>


          <ActionButtons
            saving={saving}
            confirmLabel={t.cancelAction}
            danger
            onCancel={
              onClosePanel
            }
            onConfirm={() =>
              onCancel(
                action.id
              )
            }
          />

        </ActionPanel>
      )}

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
    <div style={historyCardStyle}>

      <div style={historyHeaderStyle}>

        <div>

          <strong>
            {getActionTypeLabel(
              entry.action_type
            )}
          </strong>

          <div style={historyActorStyle}>
            {entry.performed_by ||
              t.systemRecord}
          </div>

        </div>


        <div style={historyDateStyle}>
          {formatDateTime(
            entry.created_at
          )}
        </div>

      </div>


      {statusChanged && (
        <div style={historyChangeStyle}>

          <span>
            {t.status}
          </span>

          <strong>
            {getStatusLabel(
              entry.status_from
            )}

            {' → '}

            {getStatusLabel(
              entry.status_to
            )}
          </strong>

        </div>
      )}


      {forecastChanged && (
        <div style={historyChangeStyle}>

          <span>
            {t.forecast}
          </span>

          <strong>
            {formatDate(
              entry
                .previous_target_resolution_date
            )}

            {' → '}

            {formatDate(
              entry
                .new_target_resolution_date
            )}
          </strong>

        </div>
      )}


      {entry.comment && (
        <div style={historyCommentStyle}>
          {entry.comment}
        </div>
      )}

    </div>
  );
}


function MessageBox({
  type,
  children,
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Notice tone={type === 'error' ? 'bad' : 'ok'}>{children}</Notice>
    </div>
  );
}


// ============================================================
// STYLES
// ============================================================

const pageStyle = {
  minWidth: 0,
  color: 'var(--fo-ink)',
};


// ============================================================
// STANDARD PAGE SECTIONS
// ============================================================


const sectionHeadingStyle = {
  color:
    'var(--fo-ink)',

  fontSize:
    '18px',

  fontWeight:
    900,

  lineHeight:
    1.2,
};


const sectionSupportingTextStyle = {
  marginTop:
    '4px',

  color:
    'var(--fo-muted)',

  fontSize:
    '13px',

  lineHeight:
    1.45,
};


// ============================================================
// SUMMARY
// ============================================================

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '10px',
};


// ============================================================
// REGISTER FILTERS
// ============================================================

const filterLabelStyle = {
  display: 'block',
  marginBottom: '4px',
  color: 'var(--fo-muted)',
  fontSize: '12px',
  fontWeight: 600,
};


const registerFiltersStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(5,minmax(125px,1fr))',

  gap:
    '8px',

  marginTop:
    '10px',
};


const registerFilterInputStyle = {
  width: '100%',
  minHeight: '40px',
};


// ============================================================
// SPLIT WORKSPACE
// ============================================================

const splitWorkspaceStyle = {
  display:
    'block',

  width:
    '100%',
};


const registerPanelStyle = {
  minWidth:
    0,

  overflow:
    'hidden',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '9px',

  background:
    'var(--fo-surface)',
};


const registerHeaderStyle = {
  padding:
    '12px 14px 10px',

  borderBottom:
    '1px solid var(--fo-line-soft)',

  background:
    'var(--fo-surface)',
};


const registerHeaderTopStyle = {
  display:
    'flex',

  alignItems:
    'flex-start',

  justifyContent:
    'space-between',

  gap:
    '12px',
};


const registerCountStyle = {
  color:
    'var(--fo-muted)',

  fontSize:
    '12px',

  fontWeight:
    700,
};


const tableContainerStyle = {
  overflowX:
    'auto',

  overflowY:
    'auto',

  maxHeight:
    'calc(100vh - 445px)',

  minHeight:
    '220px',

  scrollbarGutter:
    'stable',
};


const tableStyle = {
  width:
    '100%',

  minWidth:
    '1200px',

  borderCollapse:
    'collapse',

  tableLayout:
    'auto',
};


const headerCellStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 5,
  padding: '10px 12px',
  borderBottom: '1px solid var(--fo-line-soft)',
  background: 'var(--fo-sunken)',
  color: 'var(--fo-muted)',
  fontSize: '13px',
  fontWeight: 600,
  textAlign: 'center',
  whiteSpace: 'nowrap',
};


const bodyCellStyle = {
  padding: '12px',
  borderBottom: '1px solid var(--fo-line-soft)',
  fontSize: '14px',
  textAlign: 'center',
  verticalAlign: 'middle',
};


const leftCellStyle = {
  ...bodyCellStyle,

  textAlign:
    'left',
};


const constraintTitleStyle = {
  maxWidth:
    '220px',

  marginTop:
    '4px',

  color:
    'var(--fo-muted)',

  fontSize:
    '13px',

  lineHeight:
    1.4,
};


const inlineBadgesStyle = {
  display:
    'flex',

  gap:
    '4px',

  marginTop:
    '5px',

  flexWrap:
    'wrap',
};


const blockingInlineStyle = {
  padding:
    '2px 5px',

  borderRadius:
    '999px',

  background:
    'var(--fo-bad-wash)',

  color:
    'var(--fo-bad)',

  fontSize:
    '10px',

  fontWeight:
    900,
};


const sourceInlineStyle = {
  padding:
    '2px 5px',

  borderRadius:
    '999px',

  background:
    'var(--fo-info-wash)',

  color:
    'var(--fo-info)',

  fontSize:
    '10px',

  fontWeight:
    900,
};


const secondaryTextStyle = {
  marginTop:
    '3px',

  color:
    'var(--fo-muted)',

  fontSize:
    '12px',
};


// ============================================================
// BADGES
// ============================================================

const badgeBaseStyle = {
  display:
    'inline-flex',

  alignItems:
    'center',

  padding:
    '4px 7px',

  borderRadius:
    '999px',

  fontSize:
    '11px',

  fontWeight:
    900,
};


const exposureBadgeStyle = {
  display:
    'inline-flex',

  flexDirection:
    'column',

  alignItems:
    'center',

  gap:
    '2px',

  padding:
    '5px 7px',

  border:
    '1px solid',

  borderRadius:
    '6px',

  fontSize:
    '11px',
};


const exposureStatusTextStyle = {
  fontSize:
    '9px',

  fontWeight:
    900,

  letterSpacing:
    '0.08em',
};


const blockingPillStyle = {
  ...badgeBaseStyle,

  border:
    '1px solid #fecaca',

  background:
    'var(--fo-bad-wash)',

  color:
    'var(--fo-bad)',
};


// ============================================================
// BUTTONS
// ============================================================

const primaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--fo-teal)',
  background: 'var(--fo-teal)',
  color: '#04312c',
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
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--fo-line)',
  background: 'var(--fo-surface)',
  color: 'var(--fo-ink)',
};


const secondaryActionButtonStyle = {
  ...secondaryButtonStyle,

  border:
    '1px solid #bfdbfe',

  background:
    'var(--fo-info-wash)',

  color:
    'var(--fo-info)',
};


const manageButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: '34px',
  padding: '0 12px',
  border: '1px solid var(--fo-line)',
  background: 'var(--fo-surface)',
  color: 'var(--fo-teal-ink)',
};


// ============================================================
// CENTERED CONSTRAINT MANAGEMENT MODAL
// ============================================================

const managementModalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 9800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'rgba(6, 38, 55, 0.55)',
};


const drawerStyle = {
  display:
    'flex',

  flexDirection:
    'column',

  width:
    'min(1180px, calc(100vw - 48px))',

  height:
    'min(880px, calc(100vh - 48px))',

  maxWidth:
    '1180px',

  maxHeight:
    'calc(100vh - 48px)',

  overflow:
    'hidden',

  border:
    '1px solid var(--fo-line)',

  borderRadius:
    '14px',

  background:
    'var(--fo-surface)',

  boxShadow:
    '0 28px 80px rgba(15,23,42,0.32)',
};


const drawerHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '12px',

  padding:
    '16px 18px',

  borderBottom:
    '1px solid var(--fo-line-soft)',

  background:
    'var(--fo-surface)',

  flexShrink:
    0,
};


const drawerEyebrowStyle = {
  color:
    'var(--fo-info)',

  fontSize:
    '11px',

  fontWeight:
    900,

  letterSpacing:
    '0.08em',
};


const drawerTitleRowStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '6px',

  marginTop:
    '4px',

  flexWrap:
    'wrap',
};


const drawerTitleStyle = {
  margin:
    0,

  fontSize:
    '20px',

  fontWeight:
    900,
};


const drawerConstraintTitleStyle = {
  marginTop:
    '5px',

  color:
    'var(--fo-muted)',

  fontSize:
    '14px',

  fontWeight:
    700,

  lineHeight:
    1.4,
};


const drawerPriorityRowStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '8px',

  marginTop:
    '9px',

  flexWrap:
    'wrap',
};


const drawerMetaLabelStyle = {
  marginRight:
    '4px',

  color:
    'var(--fo-muted)',

  fontSize:
    '10px',

  fontWeight:
    900,

  textTransform:
    'uppercase',
};


const closeButtonStyle = {
  width:
    '31px',

  height:
    '31px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '6px',

  background:
    'var(--fo-surface)',

  color:
    'var(--fo-muted)',

  fontSize:
    '22px',

  cursor:
    'pointer',
};


const drawerSummaryStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(3,minmax(0,1fr))',

  gap:
    '8px',

  padding:
    '10px 18px',

  borderBottom:
    '1px solid var(--fo-line-soft)',

  background:
    'var(--fo-sunken)',

  flexShrink:
    0,
};


const drawerMetricStyle = {
  padding:
    '8px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '6px',
};


const drawerTabsStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(5,minmax(0,1fr))',

  borderBottom:
    '1px solid var(--fo-line-soft)',

  flexShrink:
    0,
};


const drawerTabStyle = {
  minHeight:
    '46px',

  padding:
    '5px 3px',

  border:
    'none',

  fontSize:
    '12px',

  fontWeight:
    900,

  cursor:
    'pointer',
};


const drawerBodyStyle = {
  flex:
    1,

  minHeight:
    0,

  overflowY:
    'auto',

  padding:
    '16px 18px',

  background:
    'var(--fo-sunken)',
};


const drawerFooterStyle = {
  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'space-between',

  gap:
    '8px',

  padding:
    '10px 18px',

  borderTop:
    '1px solid var(--fo-line-soft)',

  background:
    'var(--fo-surface)',

  flexShrink:
    0,
};


const footerMetaStyle = {
  color:
    'var(--fo-muted)',

  fontSize:
    '11px',

  fontWeight:
    700,
};


const drawerSectionStyle = {
  marginBottom:
    '9px',

  padding:
    '11px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '8px',

  background:
    'var(--fo-surface)',
};


const drawerSectionHeadingStyle = {
  color:
    'var(--fo-ink)',

  fontSize:
    '16px',

  fontWeight:
    900,
};


const drawerSectionSupportingTextStyle = {
  marginTop:
    '3px',

  color:
    'var(--fo-muted)',

  fontSize:
    '12px',

  lineHeight:
    1.4,
};


const sectionBodyStyle = {
  marginTop:
    '11px',
};


const fieldStyle = {
  marginBottom:
    '11px',
};


const modalLabelStyle = {
  display: 'block',
  marginBottom: '6px',
  color: 'var(--fo-ink)',
  fontSize: '14px',
  fontWeight: 600,
};


const modalInputStyle = {
  width: '100%',
  minHeight: '42px',
};


const modalTextareaStyle = {
  width:
    '100%',

  minHeight:
    '90px',

  padding:
    '8px',

  border:
    '1px solid var(--fo-line)',

  borderRadius:
    '6px',

  background:
    'var(--fo-surface)',

  color:
    'var(--fo-ink)',

  fontFamily:
    'inherit',

  fontSize:
    '14px',

  resize:
    'vertical',
};


const smallTextareaStyle = {
  ...modalTextareaStyle,

  minHeight:
    '78px',
};


const checkboxStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '7px',

  marginBottom:
    '11px',

  padding:
    '9px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '6px',

  background:
    'var(--fo-sunken)',

  fontSize:
    '12px',

  fontWeight:
    700,
};


const rightActionsStyle = {
  display:
    'flex',

  justifyContent:
    'flex-end',

  gap:
    '7px',

  flexWrap:
    'wrap',
};


// ============================================================
// LIFECYCLE
// ============================================================

const lifecycleFlowStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '4px',

  marginBottom:
    '10px',

  flexWrap:
    'wrap',
};


const lifecycleStageStyle = {
  padding:
    '4px 6px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '999px',

  fontSize:
    '11px',
};


const lifecycleArrowStyle = {
  color:
    'var(--fo-line)',

  fontSize:
    '12px',

  fontWeight:
    900,
};


const lifecycleButtonsGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2,minmax(0,1fr))',

  gap:
    '6px',
};


const lifecycleButtonStyle = {
  display:
    'flex',

  flexDirection:
    'column',

  padding:
    '9px',

  borderRadius:
    '6px',

  textAlign:
    'left',

  fontSize:
    '12px',

  cursor:
    'pointer',
};


const lifecycleDescriptionStyle = {
  marginTop:
    '3px',

  color:
    'var(--fo-muted)',

  fontSize:
    '11px',
};


// ============================================================
// ACTION PANEL
// ============================================================

const actionPanelStyle = {
  marginTop:
    '10px',

  padding:
    '10px',

  border:
    '1px solid #bfdbfe',

  borderRadius:
    '7px',

  background:
    'var(--fo-sunken)',
};


const actionPanelTitleStyle = {
  fontSize:
    '14px',

  fontWeight:
    900,
};


const actionPanelDescriptionStyle = {
  marginTop:
    '3px',

  color:
    'var(--fo-muted)',

  fontSize:
    '12px',

  lineHeight:
    1.4,
};


const actionPanelBodyStyle = {
  marginTop:
    '10px',
};


// ============================================================
// FORECAST
// ============================================================

const forecastStackStyle = {
  display:
    'grid',

  gap:
    '7px',

  marginBottom:
    '10px',
};


const forecastCardStyle = {
  padding:
    '10px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '7px',
};


const forecastDescriptionStyle = {
  marginTop:
    '3px',

  color:
    'var(--fo-muted)',

  fontSize:
    '12px',

  lineHeight:
    1.4,
};


const metaLabelStyle = {
  color:
    'var(--fo-muted)',

  fontSize:
    '10px',

  fontWeight:
    900,

  textTransform:
    'uppercase',
};


const forecastButtonStyle = {
  height:
    '38px',

  padding:
    '0 10px',

  border:
    '1px solid #fdba74',

  borderRadius:
    '6px',

  background:
    '#fff7ed',

  color:
    '#9a3412',

  fontSize:
    '12px',

  fontWeight:
    900,

  cursor:
    'pointer',
};


const reopenButtonStyle = {
  ...forecastButtonStyle,

  marginTop:
    '8px',

  border:
    '1px solid #f97316',

  background:
    '#fff7ed',

  color:
    '#c2410c',
};


const delayAssessmentStyle = {
  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #fecaca',

  borderRadius:
    '6px',

  background:
    'var(--fo-bad-wash)',

  color:
    'var(--fo-bad)',

  fontSize:
    '12px',
};


const safeAssessmentStyle = {
  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #bbf7d0',

  borderRadius:
    '6px',

  background:
    'var(--fo-ok-wash)',

  color:
    'var(--fo-ok)',

  fontSize:
    '12px',
};


const helperTextStyle = {
  marginTop:
    '4px',

  color:
    'var(--fo-muted)',

  fontSize:
    '11px',
};


const warningBoxStyle = {
  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #fde68a',

  borderRadius:
    '6px',

  background:
    '#fffbeb',

  color:
    '#92400e',

  fontSize:
    '11px',

  lineHeight:
    1.4,
};


const reopenNoticeStyle = {
  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid #fdba74',

  borderRadius:
    '6px',

  background:
    '#fff7ed',

  color:
    '#9a3412',

  fontSize:
    '11px',
};


const inlineValidationStyle = {
  marginTop:
    '5px',

  color:
    'var(--fo-bad)',

  fontSize:
    '11px',

  fontWeight:
    700,
};


const reopenTransitionStyle = {
  display:
    'grid',

  gridTemplateColumns:
    '1fr auto 1fr',

  alignItems:
    'center',

  gap:
    '8px',

  marginBottom:
    '10px',

  padding:
    '9px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '6px',

  background:
    'var(--fo-surface)',

  fontSize:
    '12px',
};


const reopenArrowStyle = {
  color:
    'var(--fo-line)',

  fontSize:
    '20px',

  fontWeight:
    900,
};


// ============================================================
// ACTION PLAN
// ============================================================

const actionSummaryGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(3,minmax(0,1fr))',

  gap:
    '6px',

  marginBottom:
    '10px',
};


const miniSummaryStyle = {
  padding:
    '8px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '6px',

  background:
    'var(--fo-sunken)',
};


const miniSummaryValueStyle = {
  marginTop:
    '4px',

  fontSize:
    '13px',

  fontWeight:
    900,
};


const addRecoveryButtonStyle = {
  height:
    '38px',

  padding:
    '0 10px',

  border:
    '1px solid #93c5fd',

  borderRadius:
    '6px',

  background:
    'var(--fo-info-wash)',

  color:
    'var(--fo-info)',

  fontSize:
    '12px',

  fontWeight:
    900,

  cursor:
    'pointer',
};


const actionPlanEmptyStyle = {
  marginTop:
    '10px',

  padding:
    '14px',

  border:
    '1px dashed var(--fo-line)',

  borderRadius:
    '7px',

  background:
    'var(--fo-sunken)',

  color:
    'var(--fo-muted)',

  fontSize:
    '12px',
};


const emptyDescriptionStyle = {
  marginTop:
    '4px',

  fontSize:
    '11px',

  lineHeight:
    1.4,
};


const recoveryActionListStyle = {
  display:
    'grid',

  gap:
    '8px',

  marginTop:
    '10px',
};


const recoveryActionCardStyle = {
  padding:
    '10px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '7px',

  background:
    'var(--fo-sunken)',
};


const recoveryActionHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '8px',

  flexWrap:
    'wrap',

  fontSize:
    '12px',
};


const recoveryActionTitleRowStyle = {
  display:
    'flex',

  alignItems:
    'center',

  gap:
    '5px',

  flexWrap:
    'wrap',
};


const recoveryActionApproachStyle = {
  marginTop:
    '4px',

  color:
    'var(--fo-muted)',

  fontSize:
    '11px',

  fontWeight:
    700,
};


const recoveryActionDueStyle = {
  color:
    'var(--fo-muted)',

  fontSize:
    '11px',
};


const recoveryActionDescriptionStyle = {
  marginTop:
    '8px',

  color:
    'var(--fo-muted)',

  fontSize:
    '12px',

  lineHeight:
    1.4,
};


const recoveryActionMetaGridStyle = {
  display:
    'grid',

  gridTemplateColumns:
    'repeat(2,minmax(0,1fr))',

  gap:
    '8px',

  marginTop:
    '9px',

  fontSize:
    '11px',
};


const effectivenessNotesStyle = {
  marginTop:
    '8px',

  padding:
    '7px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '5px',

  background:
    'var(--fo-surface)',

  color:
    'var(--fo-muted)',

  fontSize:
    '11px',
};


const recoveryActionButtonsStyle = {
  display:
    'flex',

  gap:
    '5px',

  flexWrap:
    'wrap',

  marginTop:
    '9px',
};


const smallActionButtonStyle = {
  height:
    '32px',

  padding:
    '0 8px',

  border:
    '1px solid #93c5fd',

  borderRadius:
    '5px',

  background:
    'var(--fo-info-wash)',

  color:
    'var(--fo-info)',

  fontSize:
    '11px',

  fontWeight:
    800,

  cursor:
    'pointer',
};


const smallPositiveButtonStyle = {
  ...smallActionButtonStyle,

  border:
    '1px solid #86efac',

  background:
    'var(--fo-ok-wash)',

  color:
    'var(--fo-ok)',
};


const smallEvaluationButtonStyle = {
  ...smallActionButtonStyle,

  border:
    '1px solid #c4b5fd',

  background:
    '#f5f3ff',

  color:
    '#6d28d9',
};


const smallDangerButtonStyle = {
  ...smallActionButtonStyle,

  border:
    '1px solid #fecaca',

  background:
    'var(--fo-bad-wash)',

  color:
    'var(--fo-bad)',
};


// ============================================================
// AFFECTED WORK
// ============================================================

const affectedCardStyle = {
  marginBottom:
    '7px',

  padding:
    '10px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '7px',

  background:
    'var(--fo-sunken)',
};


const affectedHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '8px',

  fontSize:
    '12px',
};


const sourceBadgeStyle = {
  padding:
    '3px 6px',

  border:
    '1px solid #bfdbfe',

  borderRadius:
    '999px',

  background:
    'var(--fo-info-wash)',

  color:
    'var(--fo-info)',

  fontSize:
    '10px',

  fontWeight:
    800,
};


const affectedLocationStyle = {
  marginTop:
    '4px',

  color:
    'var(--fo-muted)',

  fontSize:
    '12px',

  fontWeight:
    700,
};


const affectedDateStyle = {
  marginTop:
    '6px',

  color:
    'var(--fo-muted)',

  fontSize:
    '11px',
};


// ============================================================
// HISTORY
// ============================================================

const historyCardStyle = {
  marginBottom:
    '8px',

  padding:
    '9px',

  border:
    '1px solid var(--fo-line-soft)',

  borderRadius:
    '7px',

  background:
    'var(--fo-sunken)',

  fontSize:
    '11px',
};


const historyHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '8px',
};


const historyActorStyle = {
  marginTop:
    '3px',

  color:
    'var(--fo-muted)',

  fontSize:
    '10px',
};


const historyDateStyle = {
  color:
    'var(--fo-muted)',

  fontSize:
    '10px',
};


const historyChangeStyle = {
  display:
    'grid',

  gridTemplateColumns:
    '60px 1fr',

  gap:
    '6px',

  marginTop:
    '7px',
};


const historyCommentStyle = {
  marginTop:
    '7px',

  paddingTop:
    '7px',

  borderTop:
    '1px solid var(--fo-line-soft)',

  color:
    'var(--fo-muted)',

  lineHeight:
    1.4,
};


// ============================================================
// CREATE MODAL
// ============================================================

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 9500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  background: 'rgba(6, 38, 55, 0.55)',
};


const createModalStyle = {
  width:
    'min(620px,96vw)',

  maxHeight:
    '92vh',

  overflowY:
    'auto',

  borderRadius:
    '10px',

  background:
    'var(--fo-surface)',

  boxShadow:
    '0 24px 70px rgba(15,23,42,0.30)',
};


const createModalHeaderStyle = {
  display:
    'flex',

  justifyContent:
    'space-between',

  gap:
    '20px',

  padding:
    '16px 18px',

  borderBottom:
    '1px solid var(--fo-line-soft)',
};


const createModalTitleStyle = {
  margin:
    '4px 0 0',

  fontSize:
    '22px',
};


const createFormStyle = {
  padding:
    '18px',
};


// ============================================================
// MESSAGES / EMPTY
// ============================================================

const emptyStyle = {
  padding:
    '38px',

  textAlign:
    'center',

  color:
    'var(--fo-muted)',

  fontSize:
    '13px',
};


const emptyInnerStyle = {
  padding:
    '14px',

  border:
    '1px dashed var(--fo-line)',

  borderRadius:
    '6px',

  background:
    'var(--fo-sunken)',

  color:
    'var(--fo-muted)',

  textAlign:
    'center',

  fontSize:
    '12px',
};


