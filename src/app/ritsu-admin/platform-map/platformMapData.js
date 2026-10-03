const platformMapDatabase = {
  "weekly-planning": {
    "sourcePath": "src/app/dashboard/planning/weekly-planning/page.js",
    "sourceRef": "f1fc8beed686c6ab629ee3e9a2df7ff8a87cbafb",
    "verifiedOn": "2026-10-03",
    "dataSources": [
      {
        "name": "projects",
        "operations": [
          {
            "method": "select",
            "line": 688
          }
        ],
        "schema": "public",
        "kind": "table",
        "purpose": "Projects available for planning"
      },
      {
        "name": "weekly_plans",
        "operations": [
          {
            "method": "select",
            "line": 744
          },
          {
            "method": "insert",
            "line": 1057
          },
          {
            "method": "update",
            "line": 1427
          }
        ],
        "schema": "public",
        "kind": "table",
        "purpose": "Weekly plan definitions and settings"
      },
      {
        "name": "weekly_plan_items",
        "operations": [
          {
            "method": "select",
            "line": 790
          },
          {
            "method": "insert",
            "line": 1196
          },
          {
            "method": "update",
            "line": 1329
          },
          {
            "method": "delete",
            "line": 1372
          }
        ],
        "schema": "public",
        "kind": "table",
        "purpose": "Commitments, quantities and execution results"
      },
      {
        "name": "weekly_plan_performance",
        "operations": [
          {
            "method": "select",
            "line": 807
          }
        ],
        "schema": "public",
        "kind": "view",
        "purpose": "Plan performance"
      },
      {
        "name": "weekly_ppc_trend",
        "operations": [
          {
            "method": "select",
            "line": 818
          }
        ],
        "schema": "public",
        "kind": "view",
        "purpose": "PPC trend"
      },
      {
        "name": "weekly_variance_pareto",
        "operations": [
          {
            "method": "select",
            "line": 829
          }
        ],
        "schema": "public",
        "kind": "view",
        "purpose": "Variance reason counts"
      },
      {
        "name": "weekly_lookahead_package_readiness",
        "operations": [
          {
            "method": "select",
            "line": 915
          }
        ],
        "schema": "public",
        "kind": "view",
        "purpose": "Work-package readiness"
      },
      {
        "name": "constraint_management_overview",
        "operations": [
          {
            "method": "select",
            "line": 978
          }
        ],
        "schema": "public",
        "kind": "view",
        "purpose": "Constraint status used for readiness validation"
      }
    ],
    "functions": [
      {
        "name": "get_active_lookahead_plan",
        "schema": "public",
        "arguments": "target_project_id uuid",
        "returns": "uuid",
        "line": 1034,
        "purpose": "Locate the active Lookahead plan before creating a weekly plan."
      },
      {
        "name": "cancel_weekly_plan",
        "schema": "public",
        "arguments": "target_weekly_plan_id uuid",
        "returns": "void",
        "line": 1474,
        "purpose": "Cancel a draft weekly plan."
      },
      {
        "name": "commit_weekly_plan_with_make_ready",
        "schema": "public",
        "arguments": "target_weekly_plan_id uuid",
        "returns": "void",
        "line": 1535,
        "purpose": "Commit the plan using the Make Ready validation entry point."
      },
      {
        "name": "close_weekly_plan",
        "schema": "public",
        "arguments": "target_weekly_plan_id uuid",
        "returns": "void",
        "line": 2132,
        "purpose": "Close the weekly plan."
      }
    ]
  }
}

const preconPageMap = {
  "pre-planning": {
    "status": "mapped",
    "sourceRef": "97a59db66df4cf67fc755567a592c36c7d89d814",
    "note": "The PreCon navigation opens the standalone entry, which reuses the dashboard page implementation.",
    "routes": [
      {
        "label": "Standalone entry",
        "href": "/planning/pre-planning",
        "sourcePath": "src/app/planning/pre-planning/page.js"
      },
      {
        "label": "Shared dashboard page",
        "href": "/dashboard/planning/pre-planning",
        "sourcePath": "src/app/dashboard/planning/pre-planning/page.js"
      }
    ]
  },
  "master-plan": {
    "status": "mapped",
    "sourceRef": "97a59db66df4cf67fc755567a592c36c7d89d814",
    "note": "Page entry points verified in the source code.",
    "routes": [
      {
        "label": "Master Plan",
        "href": "/dashboard/planning/master-plan",
        "sourcePath": "src/app/dashboard/planning/master-plan/page.js"
      }
    ]
  },
  "lookahead-planning": {
    "status": "mapped",
    "sourceRef": "97a59db66df4cf67fc755567a592c36c7d89d814",
    "note": "Page entry points verified in the source code.",
    "routes": [
      {
        "label": "Lookahead Planning",
        "href": "/dashboard/planning/lookahead",
        "sourcePath": "src/app/dashboard/planning/lookahead/page.js"
      }
    ]
  },
  "constraint-management": {
    "status": "mapped",
    "sourceRef": "97a59db66df4cf67fc755567a592c36c7d89d814",
    "note": "Page entry points verified in the source code.",
    "routes": [
      {
        "label": "Constraint Management",
        "href": "/dashboard/projects/constraints",
        "sourcePath": "src/app/dashboard/projects/constraints/page.js"
      }
    ]
  },
  "weekly-planning": {
    "status": "mapped",
    "sourceRef": "97a59db66df4cf67fc755567a592c36c7d89d814",
    "note": "Page entry points verified in the source code.",
    "routes": [
      {
        "label": "Weekly Planning",
        "href": "/dashboard/planning/weekly-planning",
        "sourcePath": "src/app/dashboard/planning/weekly-planning/page.js"
      }
    ]
  },
  "pull-planning": {
    "status": "no-route",
    "sourceRef": "97a59db66df4cf67fc755567a592c36c7d89d814",
    "note": "No dedicated page was found in the audited branch. This module remains in the architecture map.",
    "routes": []
  },
  "precon-reports": {
    "status": "no-route",
    "sourceRef": "97a59db66df4cf67fc755567a592c36c7d89d814",
    "note": "No dedicated page was found in the audited branch. This module remains in the architecture map.",
    "routes": []
  }
}

export const platformMapNodes = [
  { id: 'ritsuflow', label: 'RitsuFlow', subtitle: 'Construction Planning & Control Platform', type: 'platform', purpose: 'Connect project setup, planning, control and field execution through a location- and flow-based production system.' },

  { id: 'projects', label: 'Projects', subtitle: 'Project information and foundational setup', type: 'workspace', purpose: 'Establish the project structure and core information used by planning and field operations.' },
  { id: 'precon', label: 'PreCon', subtitle: 'Planning and control before execution', type: 'workspace', purpose: 'Plan production, make work ready, manage constraints and create reliable weekly commitments.' },
  { id: 'fieldop', label: 'FieldOp', subtitle: 'Field execution and daily operations', type: 'workspace', purpose: 'Capture and control what actually happens in the field.' },

  { id: 'project-information', label: 'Project Information', subtitle: 'Core project data', type: 'module', workspace: 'projects', purpose: 'Maintain the core information that identifies and governs the project.', inputs: ['Project definition', 'Dates and settings'], process: ['Maintain project data', 'Provide shared project context'], outputs: ['Project master data'], related: ['Project Setup', 'Location Structure'] },
  { id: 'project-team', label: 'Team', subtitle: 'Users, roles and responsibilities', type: 'module', workspace: 'projects', purpose: 'Define the people and responsibilities associated with the project.', inputs: ['Project users', 'Roles'], process: ['Assign project responsibilities'], outputs: ['Project team structure'], related: ['Project Information'] },
  { id: 'location-structure', label: 'Location Structure', subtitle: 'Location breakdown structure', type: 'module', workspace: 'projects', purpose: 'Create the location hierarchy used to plan, control and report production by place.', inputs: ['Project geometry', 'Production areas'], process: ['Structure locations', 'Organize production areas'], outputs: ['Location breakdown structure'], related: ['Master Plan', 'FieldOp'] },
  { id: 'project-setup', label: 'Project Setup', subtitle: 'WBS, work packages and configuration', type: 'module', workspace: 'projects', purpose: 'Configure the project structure required by the planning and control workflow.', inputs: ['Scope', 'Work packages', 'Project standards'], process: ['Configure planning structure'], outputs: ['Planning-ready project'], related: ['Pre-Planning', 'Master Plan'] },

  { id: 'pre-planning', label: 'Pre-Planning', subtitle: 'Sequencing, durations and production cells', type: 'module', workspace: 'precon', purpose: 'Prepare the production logic before the master schedule is established.', inputs: ['Locations', 'Work packages', 'Production assumptions'], process: ['Sequence work', 'Set durations', 'Define production cells'], outputs: ['Production sequence'], related: ['Project Setup', 'Master Plan'] },
  { id: 'master-plan', label: 'Master Plan', subtitle: 'Location-based schedule (LoB)', type: 'module', workspace: 'precon', purpose: 'Establish the long-term location-based production plan.', inputs: ['Production sequence', 'Locations', 'Durations'], process: ['Schedule by location', 'Coordinate production flow'], outputs: ['Master production plan'], related: ['Pre-Planning', 'Lookahead Planning'] },
  { id: 'lookahead-planning', label: 'Lookahead Planning', subtitle: 'Make-ready planning', type: 'module', workspace: 'precon', purpose: 'Evaluate upcoming work early enough to remove constraints before weekly commitment.', inputs: ['Master Plan activities', 'Readiness information'], process: ['Assess readiness', 'Identify blockers'], outputs: ['Ready work', 'Constraints'], related: ['Master Plan', 'Constraint Management', 'Weekly Planning'] },
  { id: 'constraint-management', label: 'Constraint Management', subtitle: 'Identify, track and clear constraints', type: 'module', workspace: 'precon', purpose: 'Make constraints visible, assign responsibility and track them until work can be released.', inputs: ['Readiness failures', 'Field and planning issues'], process: ['Register constraints', 'Assign owner', 'Track resolution'], outputs: ['Cleared constraints', 'Constraint history'], related: ['Lookahead Planning', 'Weekly Planning'] },
  { id: 'weekly-planning', label: 'Weekly Planning', subtitle: 'Commit ready work, PPC and variance', type: 'module', workspace: 'precon', purpose: 'Convert ready activities into reliable weekly commitments and measure plan reliability.', inputs: ['Ready activities', 'Cleared constraints', 'Available crews'], process: ['Select and commit work', 'Validate readiness', 'Track execution', 'Record variance'], outputs: ['Weekly commitments', 'PPC', 'Variance reasons'], related: ['Lookahead Planning', 'Constraint Management', 'Daily Reports'], pages: ['Weekly planning board', 'PPC / variance analysis'], data: ['Weekly plan items', 'Weekly plan periods', 'Commitment history'] },
  { id: 'pull-planning', label: 'Pull Planning', subtitle: 'Milestone-driven collaborative planning', type: 'module', workspace: 'precon', purpose: 'Plan backwards from milestones to expose needs, handoffs and production logic.', inputs: ['Milestones', 'Production requirements'], process: ['Plan backwards', 'Coordinate handoffs'], outputs: ['Pull plan'], related: ['Master Plan', 'Pre-Planning'] },
  { id: 'precon-reports', label: 'Reports', subtitle: 'Planning and control reporting', type: 'module', workspace: 'precon', purpose: 'Consolidate planning and control information into project reports.', inputs: ['Planning data', 'Control data'], process: ['Compile project information'], outputs: ['Planning and control reports'], related: ['Master Plan', 'Weekly Planning', 'Daily Reports'] },

  { id: 'operational-dashboard', label: 'Operational Dashboard', subtitle: 'Field progress, productivity and safety', type: 'module', workspace: 'fieldop', purpose: 'Provide an operational view of current field production.', inputs: ['Field records', 'Workforce data'], process: ['Aggregate operational status'], outputs: ['Field production overview'], related: ['Daily Reports', 'Workforce Timekeeping'] },
  { id: 'daily-reports', label: 'Daily Reports', subtitle: 'Daily logs, quantities and issues', type: 'module', workspace: 'fieldop', purpose: 'Capture contemporaneous records of what happened during field execution.', inputs: ['Executed work', 'Field events', 'Issues'], process: ['Record daily production', 'Capture field context'], outputs: ['Daily production record', 'Execution history'], related: ['Weekly Planning', 'Operational Dashboard'] },
  { id: 'workforce-timekeeping', label: 'Workforce Timekeeping', subtitle: 'Check-in/out, GPS and timecards', type: 'module', workspace: 'fieldop', purpose: 'Track workforce presence and time associated with project execution.', inputs: ['Worker check-in/out', 'Location'], process: ['Track attendance', 'Build timecards'], outputs: ['Attendance records', 'Timecards'], related: ['Operational Dashboard', 'Daily Reports'] },
].map((node) => {
  const implementation = preconPageMap[node.id]
  const database = platformMapDatabase[node.id]
  if (!implementation && !database) return node
  return {
    ...node,
    ...(implementation && {
      implementation,
      pages: [...new Set([...(node.pages || []), ...implementation.routes.map((route) => route.href)])],
    }),
    ...(database && {
      database,
      data: database.dataSources.map((source) => source.name),
    }),
  }
})

export const platformMapEdges = [
  { id: 'ritsuflow-projects', source: 'ritsuflow', target: 'projects', type: 'contains' },
  { id: 'ritsuflow-precon', source: 'ritsuflow', target: 'precon', type: 'contains' },
  { id: 'ritsuflow-fieldop', source: 'ritsuflow', target: 'fieldop', type: 'contains' },
  { id: 'projects-project-information', source: 'projects', target: 'project-information', type: 'contains' },
  { id: 'projects-project-team', source: 'projects', target: 'project-team', type: 'contains' },
  { id: 'projects-location-structure', source: 'projects', target: 'location-structure', type: 'contains' },
  { id: 'projects-project-setup', source: 'projects', target: 'project-setup', type: 'contains' },
  { id: 'precon-pre-planning', source: 'precon', target: 'pre-planning', type: 'contains' },
  { id: 'precon-master-plan', source: 'precon', target: 'master-plan', type: 'contains' },
  { id: 'precon-lookahead-planning', source: 'precon', target: 'lookahead-planning', type: 'contains' },
  { id: 'precon-constraint-management', source: 'precon', target: 'constraint-management', type: 'contains' },
  { id: 'precon-weekly-planning', source: 'precon', target: 'weekly-planning', type: 'contains' },
  { id: 'precon-pull-planning', source: 'precon', target: 'pull-planning', type: 'contains' },
  { id: 'precon-reports-edge', source: 'precon', target: 'precon-reports', type: 'contains' },
  { id: 'fieldop-operational-dashboard', source: 'fieldop', target: 'operational-dashboard', type: 'contains' },
  { id: 'fieldop-daily-reports', source: 'fieldop', target: 'daily-reports', type: 'contains' },
  { id: 'fieldop-workforce-timekeeping', source: 'fieldop', target: 'workforce-timekeeping', type: 'contains' },
]

export function getPlatformMapNode(id) {
  return platformMapNodes.find((node) => node.id === id) || null
}
