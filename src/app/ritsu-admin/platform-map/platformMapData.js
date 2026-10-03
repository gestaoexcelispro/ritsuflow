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
  },
  "master-plan": {
    "sourcePath": "src/app/dashboard/planning/master-plan/page.js",
    "sourceRef": "9c322452ee8ccea7a9aaa60e991e809a4ae62238",
    "verifiedOn": "2026-10-03",
    "dataSources": [
      {
        "name": "master_plan_package_dependencies",
        "schema": "public",
        "kind": "table",
        "purpose": "Dependencies between scheduled work packages",
        "operations": [
          {
            "method": "insert",
            "line": 1738
          },
          {
            "method": "delete",
            "line": 1218
          }
        ]
      },
      {
        "name": "master_plan_packages",
        "schema": "public",
        "kind": "table",
        "purpose": "Scheduled work-package occurrences",
        "operations": [
          {
            "method": "insert",
            "line": 1589
          },
          {
            "method": "delete",
            "line": 1246
          }
        ]
      },
      {
        "name": "projects",
        "schema": "public",
        "kind": "table",
        "purpose": "Projects available for planning",
        "operations": [
          {
            "method": "select",
            "line": 1773
          }
        ]
      },
      {
        "name": "production_control_project_portfolio",
        "schema": "public",
        "kind": "view",
        "purpose": "Project production progress summary",
        "operations": [
          {
            "method": "select",
            "line": 1825
          }
        ]
      },
      {
        "name": "locations",
        "schema": "public",
        "kind": "table",
        "purpose": "Project location structure",
        "operations": [
          {
            "method": "select",
            "line": 1886
          }
        ]
      },
      {
        "name": "project_services",
        "schema": "public",
        "kind": "table",
        "purpose": "Legacy service references used during package synchronization",
        "operations": [
          {
            "method": "select",
            "line": 1922
          }
        ]
      },
      {
        "name": "master_plan_scenarios",
        "schema": "public",
        "kind": "table",
        "purpose": "Scenarios, baselines and saved schedule data",
        "operations": [
          {
            "method": "select",
            "line": 1938
          },
          {
            "method": "insert",
            "line": 3199
          },
          {
            "method": "update",
            "line": 3241
          }
        ]
      }
    ],
    "functions": [
      {
        "name": "get_project_work_packages",
        "schema": "public",
        "arguments": "target_project_id uuid",
        "returns": "TABLE(id uuid, project_id uuid, code text, description text, color text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)",
        "line": 1905,
        "purpose": "Load the project's work-package catalog."
      }
    ],
    "storage": [
      {
        "name": "project-covers",
        "method": "createSignedUrl",
        "line": 1812,
        "purpose": "Project cover images accessed through signed URLs."
      }
    ]
  },
  "lookahead-planning": {
    "sourcePath": "src/app/dashboard/planning/lookahead/page.js",
    "sourceRef": "9c322452ee8ccea7a9aaa60e991e809a4ae62238",
    "verifiedOn": "2026-10-03",
    "dataSources": [
      {
        "name": "projects",
        "schema": "public",
        "kind": "table",
        "purpose": "Projects available for planning",
        "operations": [
          {
            "method": "select",
            "line": 657
          }
        ]
      },
      {
        "name": "lookahead_plans",
        "schema": "public",
        "kind": "table",
        "purpose": "Lookahead horizon and plan settings",
        "operations": [
          {
            "method": "select",
            "line": 770
          },
          {
            "method": "update",
            "line": 1791
          }
        ]
      },
      {
        "name": "master_plan_scenarios",
        "schema": "public",
        "kind": "table",
        "purpose": "Scenarios, baselines and saved schedule data",
        "operations": [
          {
            "method": "select",
            "line": 909
          }
        ]
      },
      {
        "name": "lookahead_work_items",
        "schema": "public",
        "kind": "table",
        "purpose": "Master Plan-derived work items",
        "operations": [
          {
            "method": "select",
            "line": 1083
          }
        ]
      },
      {
        "name": "lookahead_sheet_rows",
        "schema": "public",
        "kind": "table",
        "purpose": "Grouped work-package rows and manual rows",
        "operations": [
          {
            "method": "select",
            "line": 1198
          },
          {
            "method": "update",
            "line": 1869
          }
        ]
      },
      {
        "name": "lookahead_sheet_readiness_assessments",
        "schema": "public",
        "kind": "table",
        "purpose": "Koskela readiness assessments",
        "operations": [
          {
            "method": "select",
            "line": 1381
          },
          {
            "method": "upsert",
            "line": 3664
          }
        ]
      },
      {
        "name": "constraints",
        "schema": "public",
        "kind": "table",
        "purpose": "Constraint records and readiness links",
        "operations": [
          {
            "method": "select",
            "line": 1476
          }
        ]
      }
    ],
    "functions": [
      {
        "name": "get_organization_work_package_catalog",
        "schema": "public",
        "arguments": "target_organization_id uuid",
        "returns": "TABLE(id uuid, organization_id uuid, code text, description text, color text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)",
        "line": 991,
        "purpose": "Load the organization work-package catalog for manual rows."
      },
      {
        "name": "get_lookahead_manual_timeline_cells",
        "schema": "public",
        "arguments": "target_lookahead_plan_id uuid",
        "returns": "TABLE(id uuid, sheet_row_id uuid, work_date date, organization_work_package_id uuid, package_code text, package_description text, package_color text)",
        "line": 1543,
        "purpose": "Load manual-row timeline cells."
      },
      {
        "name": "insert_lookahead_sheet_row",
        "schema": "public",
        "arguments": "target_lookahead_plan_id uuid, target_anchor_row_id uuid, target_direction text",
        "returns": "uuid",
        "line": 2967,
        "purpose": "Insert a manual sheet row around the selected anchor."
      },
      {
        "name": "insert_lookahead_manual_package",
        "schema": "public",
        "arguments": "target_lookahead_plan_id uuid, target_organization_work_package_id uuid, target_line_id integer, target_start_date date, target_duration_working_days integer",
        "returns": "TABLE(sheet_row_id uuid, package_code text, row_order numeric, scheduled_start_date date, scheduled_finish_date date, scheduled_working_days integer)",
        "line": 3155,
        "purpose": "Insert a manually scheduled work package."
      },
      {
        "name": "delete_lookahead_manual_sheet_row",
        "schema": "public",
        "arguments": "target_lookahead_plan_id uuid, target_sheet_row_id uuid",
        "returns": "void",
        "line": 3256,
        "purpose": "Delete the selected manual row from its Lookahead plan."
      },
      {
        "name": "set_lookahead_manual_timeline_cell",
        "schema": "public",
        "arguments": "target_sheet_row_id uuid, target_work_date date, target_organization_work_package_id uuid",
        "returns": "TABLE(id uuid, sheet_row_id uuid, work_date date, organization_work_package_id uuid, package_code text)",
        "line": 3340,
        "purpose": "Set the work package for a manual timeline cell."
      },
      {
        "name": "ensure_koskela_constraint",
        "schema": "public",
        "arguments": "target_readiness_assessment_id uuid",
        "returns": "uuid",
        "line": 3788,
        "purpose": "Synchronize a constraint from a Koskela readiness assessment."
      }
    ]
  },
  "constraint-management": {
    "sourcePath": "src/app/dashboard/projects/constraints/page.js",
    "sourceRef": "9c322452ee8ccea7a9aaa60e991e809a4ae62238",
    "verifiedOn": "2026-10-03",
    "dataSources": [
      {
        "name": "projects",
        "schema": "public",
        "kind": "table",
        "purpose": "Projects available for planning",
        "operations": [
          {
            "method": "select",
            "line": 1253
          }
        ]
      },
      {
        "name": "constraint_management_overview",
        "schema": "public",
        "kind": "view",
        "purpose": "Constraint management summary",
        "operations": [
          {
            "method": "select",
            "line": 1379
          }
        ]
      },
      {
        "name": "constraints",
        "schema": "public",
        "kind": "table",
        "purpose": "Constraint records and readiness links",
        "operations": [
          {
            "method": "select",
            "line": 1437
          }
        ]
      },
      {
        "name": "constraint_affected_work",
        "schema": "public",
        "kind": "table",
        "purpose": "Work affected by constraints",
        "operations": [
          {
            "method": "select",
            "line": 1558
          }
        ]
      },
      {
        "name": "lookahead_work_items",
        "schema": "public",
        "kind": "table",
        "purpose": "Master Plan-derived work items",
        "operations": [
          {
            "method": "select",
            "line": 1627
          }
        ]
      },
      {
        "name": "master_plan_packages",
        "schema": "public",
        "kind": "table",
        "purpose": "Scheduled work-package occurrences",
        "operations": [
          {
            "method": "select",
            "line": 1718
          }
        ]
      },
      {
        "name": "constraint_logs",
        "schema": "public",
        "kind": "table",
        "purpose": "Constraint lifecycle history",
        "operations": [
          {
            "method": "select",
            "line": 1808
          }
        ]
      },
      {
        "name": "constraint_actions",
        "schema": "public",
        "kind": "table",
        "purpose": "Constraint recovery action plans",
        "operations": [
          {
            "method": "select",
            "line": 1898
          }
        ]
      }
    ],
    "functions": [
      {
        "name": "create_manual_constraint_with_history",
        "schema": "public",
        "arguments": "target_project_id uuid, target_category text, target_title text, target_description text, target_action_required text, target_responsible_party text, target_required_by_date date, target_priority text, target_blocking boolean DEFAULT true, target_performed_by text DEFAULT NULL::text",
        "returns": "uuid",
        "line": 2470,
        "purpose": "Create a manual constraint with history."
      },
      {
        "name": "set_constraint_impact_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_impact text, target_comment text DEFAULT NULL::text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 2529,
        "purpose": "Set the constraint impact with a history record."
      },
      {
        "name": "update_constraint_details_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_responsible_party text, target_action_required text, target_priority text, target_description text, target_blocking boolean, target_comment text DEFAULT NULL::text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 2823,
        "purpose": "Update constraint details with history."
      },
      {
        "name": "add_constraint_comment_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_comment text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 2964,
        "purpose": "Add a comment to constraint history."
      },
      {
        "name": "update_constraint_forecast_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_new_resolution_date date, target_reason text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3057,
        "purpose": "Revise the resolution forecast with a reason."
      },
      {
        "name": "reopen_constraint_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_new_resolution_date date, target_reason text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3161,
        "purpose": "Reopen a constraint with a revised resolution date."
      },
      {
        "name": "start_constraint_action_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_comment text DEFAULT NULL::text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3248,
        "purpose": "Start work on a constraint."
      },
      {
        "name": "set_constraint_waiting_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_reason text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3277,
        "purpose": "Put a constraint into Waiting with a reason."
      },
      {
        "name": "resume_constraint_action_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_comment text DEFAULT NULL::text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3296,
        "purpose": "Resume work on a waiting constraint."
      },
      {
        "name": "resolve_constraint_directly_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_resolution_note text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3328,
        "purpose": "Record constraint resolution with history."
      },
      {
        "name": "verify_and_clear_constraint_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_verification_note text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3357,
        "purpose": "Verify and clear a resolved constraint."
      },
      {
        "name": "cancel_constraint_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_reason text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3386,
        "purpose": "Cancel a constraint with a reason."
      },
      {
        "name": "create_constraint_action_with_history",
        "schema": "public",
        "arguments": "target_constraint_id uuid, target_response_approach text, target_action_title text, target_action_description text, target_responsible_party text, target_due_date date, target_expected_impact text, target_performed_by text DEFAULT NULL::text",
        "returns": "uuid",
        "line": 3534,
        "purpose": "Create a recovery action in the constraint action plan."
      },
      {
        "name": "start_constraint_action_plan_item_with_history",
        "schema": "public",
        "arguments": "target_action_id uuid, target_comment text DEFAULT NULL::text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3630,
        "purpose": "Start a recovery action."
      },
      {
        "name": "complete_constraint_action_with_history",
        "schema": "public",
        "arguments": "target_action_id uuid, target_completion_note text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3717,
        "purpose": "Record recovery-action completion."
      },
      {
        "name": "evaluate_constraint_action_effectiveness_with_history",
        "schema": "public",
        "arguments": "target_action_id uuid, target_effectiveness text, target_notes text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3803,
        "purpose": "Record the effectiveness of a recovery action."
      },
      {
        "name": "cancel_constraint_action_with_history",
        "schema": "public",
        "arguments": "target_action_id uuid, target_reason text, target_performed_by text DEFAULT NULL::text",
        "returns": "void",
        "line": 3892,
        "purpose": "Cancel a recovery action with a reason."
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
      data: [
        ...database.dataSources.map((source) => source.name),
        ...(database.storage || []).map((bucket) => bucket.name),
      ],
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
