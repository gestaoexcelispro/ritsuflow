// RitsuFlow FieldOp workflow domain contract
//
// This module deliberately contains no Supabase or Rete.js implementation.
// It defines the stable business vocabulary that the visual workflow layer
// will orchestrate. Existing Projects and FieldOp capabilities remain the
// source of truth for their own data and operations.

export const FIELDOP_WORKFLOW_VERSION = 1;

export const FIELDOP_NODE_TYPES = Object.freeze({
  PROJECT: 'project',
  LOCATION: 'location',
  LOCATION_QR: 'location_qr',
  PROJECT_ASSIGNMENT: 'project_assignment',
  CHECK_IN: 'check_in',
  WORK_PACKAGE: 'work_package',
  EXECUTION: 'execution',
  CHECK_OUT: 'check_out',
  DAILY_REPORT: 'daily_report',
});

export const FIELDOP_NODE_DEFINITIONS = Object.freeze({
  [FIELDOP_NODE_TYPES.PROJECT]: {
    label: 'Project',
    kind: 'context',
    requires: ['project_id'],
    provides: ['project_id', 'organization_id'],
  },

  [FIELDOP_NODE_TYPES.LOCATION]: {
    label: 'Location',
    kind: 'context',
    requires: ['project_id'],
    provides: ['location_id'],
  },

  [FIELDOP_NODE_TYPES.LOCATION_QR]: {
    label: 'Location QR',
    kind: 'trigger',
    requires: ['project_id', 'location_id'],
    provides: ['project_id', 'location_id'],
  },

  [FIELDOP_NODE_TYPES.PROJECT_ASSIGNMENT]: {
    label: 'Project Assignment',
    kind: 'context',
    requires: ['project_id', 'worker_id'],
    provides: ['assignment_id', 'worker_id'],
  },

  [FIELDOP_NODE_TYPES.CHECK_IN]: {
    label: 'Check In',
    kind: 'action',
    requires: ['project_id', 'worker_id'],
    provides: ['attendance_session_id', 'checked_in_at'],
  },

  [FIELDOP_NODE_TYPES.WORK_PACKAGE]: {
    label: 'Work Package',
    kind: 'context',
    requires: ['organization_id'],
    provides: ['work_package_id'],
  },

  [FIELDOP_NODE_TYPES.EXECUTION]: {
    label: 'Execution',
    kind: 'action',
    requires: [
      'project_id',
      'location_id',
      'worker_id',
      'work_package_id',
      'attendance_session_id',
    ],
    provides: ['execution_id'],
  },

  [FIELDOP_NODE_TYPES.CHECK_OUT]: {
    label: 'Check Out',
    kind: 'action',
    requires: ['attendance_session_id'],
    provides: ['checked_out_at', 'worked_minutes'],
  },

  [FIELDOP_NODE_TYPES.DAILY_REPORT]: {
    label: 'Daily Report',
    kind: 'output',
    requires: ['project_id'],
    provides: ['daily_report_id'],
  },
});

export const FIELDOP_V1_FLOW = Object.freeze([
  FIELDOP_NODE_TYPES.PROJECT,
  FIELDOP_NODE_TYPES.LOCATION,
  FIELDOP_NODE_TYPES.LOCATION_QR,
  FIELDOP_NODE_TYPES.PROJECT_ASSIGNMENT,
  FIELDOP_NODE_TYPES.CHECK_IN,
  FIELDOP_NODE_TYPES.WORK_PACKAGE,
  FIELDOP_NODE_TYPES.EXECUTION,
  FIELDOP_NODE_TYPES.CHECK_OUT,
  FIELDOP_NODE_TYPES.DAILY_REPORT,
]);

export function getFieldOpNodeDefinition(type) {
  return FIELDOP_NODE_DEFINITIONS[type] || null;
}

export function validateFieldOpNodeInput(type, context = {}) {
  const definition = getFieldOpNodeDefinition(type);

  if (!definition) {
    return {
      valid: false,
      missing: [],
      error: `Unknown FieldOp workflow node type: ${type}`,
    };
  }

  const missing = definition.requires.filter((key) => {
    const value = context[key];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missing.length === 0,
    missing,
    error: missing.length
      ? `Missing required workflow context: ${missing.join(', ')}`
      : '',
  };
}
