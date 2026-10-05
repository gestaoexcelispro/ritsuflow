// Source-backed architecture snapshot. Update the inventory when audited implementation changes.
export const platformMapInventory = {
  "audit": {
    "verifiedOn": "2026-10-03",
    "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
    "scope": "Direct accesses in the listed page, component and API files, including resolved bucket constants and documented fallbacks; public Supabase relations, RPC signatures and storage bucket existence checked against the RitsuFlow project. Record-dependent storage targets, RPC internals and nested relational-select dependencies are outside this snapshot."
  },
  "implementation": {
    "pre-planning": {
      "status": "no-route",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "note": "Removed from PreCon on 2026-10-05; planning starts in Master Plan. This module remains in the architecture map.",
      "routes": []
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
    },
    "project-information": {
      "status": "mapped",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "note": "Shared project portfolio, project record, creation, editing and history pages.",
      "routes": [
        {
          "label": "Projects portfolio",
          "href": "/projects",
          "sourcePath": "src/app/projects/page.js",
          "dynamic": false
        },
        {
          "label": "Create project",
          "href": "/projects/new",
          "sourcePath": "src/app/projects/new/page.js",
          "dynamic": false
        },
        {
          "label": "Project record",
          "href": "/projects/[projectId]",
          "sourcePath": "src/app/projects/[projectId]/page.js",
          "dynamic": true
        },
        {
          "label": "Edit project",
          "href": "/projects/[projectId]/edit",
          "sourcePath": "src/app/projects/[projectId]/edit/page.js",
          "dynamic": true
        },
        {
          "label": "Project history",
          "href": "/projects/[projectId]/history",
          "sourcePath": "src/app/projects/[projectId]/history/page.js",
          "dynamic": true
        }
      ],
      "components": [
        {
          "label": "ProjectDocuments",
          "sourcePath": "src/app/projects/[projectId]/ProjectDocuments.js"
        },
        {
          "label": "ProjectReportButton",
          "sourcePath": "src/app/projects/[projectId]/ProjectReportButton.js"
        }
      ]
    },
    "project-team": {
      "status": "embedded",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "note": "Team is implemented by ProjectTeam inside the shared project record.",
      "routes": [
        {
          "label": "Project record · Team section",
          "href": "/projects/[projectId]",
          "sourcePath": "src/app/projects/[projectId]/page.js",
          "dynamic": true
        }
      ],
      "components": [
        {
          "label": "ProjectTeam",
          "sourcePath": "src/app/projects/[projectId]/ProjectTeam.js"
        }
      ]
    },
    "location-structure": {
      "status": "mapped",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "note": "Location hierarchy, drawing map, card view and quantity allocation by location.",
      "routes": [
        {
          "label": "Location structure",
          "href": "/projects/[projectId]/locations",
          "sourcePath": "src/app/projects/[projectId]/locations/page.js",
          "dynamic": true
        },
        {
          "label": "Location drawing map",
          "href": "/projects/[projectId]/location-map",
          "sourcePath": "src/app/projects/[projectId]/location-map/page.js",
          "dynamic": true
        },
        {
          "label": "Location card view",
          "href": "/projects/[projectId]/location-map/card-view",
          "sourcePath": "src/app/projects/[projectId]/location-map/card-view/page.js",
          "dynamic": true
        }
      ],
      "components": [
        {
          "label": "StandaloneLocationWorkspace",
          "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js"
        },
        {
          "label": "LocationMapWorkspace",
          "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
        },
        {
          "label": "LocationCardViewEditor",
          "sourcePath": "src/app/projects/[projectId]/locations/LocationCardViewEditor.js"
        }
      ],
      "apis": [
        {
          "label": "locations / qr",
          "href": "/api/projects/[projectId]/locations/[locationId]/qr",
          "sourcePath": "src/app/api/projects/[projectId]/locations/[locationId]/qr/route.js",
          "methods": [
            "POST"
          ],
          "consumers": [
            {
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js",
              "line": 97
            }
          ],
          "note": "Call site found in the audited module.",
          "auth": "Signed-in user check in handler"
        }
      ]
    },
    "project-setup": {
      "status": "mapped",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "note": "Shared project scope register (project_scopes and scope_activities).",
      "routes": [
        {
          "label": "Scope management",
          "href": "/projects/[projectId]/scope",
          "sourcePath": "src/app/projects/[projectId]/scope/page.js",
          "dynamic": true
        }
      ],
      "components": [],
      "apis": []
    },
    "operational-dashboard": {
      "status": "mapped",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "note": "FieldOp currently exposes a project portfolio and per-project activity/location setup. Production, productivity and safety aggregation remains a gap.",
      "routes": [
        {
          "label": "FieldOp portfolio",
          "href": "/fieldop",
          "sourcePath": "src/app/fieldop/page.js",
          "dynamic": false
        },
        {
          "label": "FieldOp projects",
          "href": "/fieldop/projects",
          "sourcePath": "src/app/fieldop/projects/page.js",
          "dynamic": false
        },
        {
          "label": "FieldOp project setup",
          "href": "/fieldop/projects/[projectId]",
          "sourcePath": "src/app/fieldop/projects/[projectId]/page.js",
          "dynamic": true
        }
      ],
      "components": [
        {
          "label": "FieldOpLocationsSetup",
          "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpLocationsSetup.js"
        }
      ]
    },
    "daily-reports": {
      "status": "mapped",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "note": "FieldOp report list, creation, detail and project daily-report settings. The shared PDF handler is inventoried separately.",
      "routes": [
        {
          "label": "Daily report list",
          "href": "/fieldop/reports/daily",
          "sourcePath": "src/app/fieldop/reports/daily/page.js",
          "dynamic": false
        },
        {
          "label": "Create daily report",
          "href": "/fieldop/reports/daily/new",
          "sourcePath": "src/app/fieldop/reports/daily/new/page.js",
          "dynamic": false
        },
        {
          "label": "Daily report detail",
          "href": "/fieldop/reports/daily/[reportId]",
          "sourcePath": "src/app/fieldop/reports/daily/[reportId]/page.js",
          "dynamic": true
        }
      ],
      "components": [
        {
          "label": "FieldOpDailyReportSettings",
          "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpDailyReportSettings.js"
        }
      ],
      "apis": []
    },
    "workforce-timekeeping": {
      "status": "mapped",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "note": "Project workforce setup, attendance, timecards, audit trail and exception resolution.",
      "routes": [
        {
          "label": "Workforce attendance",
          "href": "/fieldop/projects/[projectId]/workforce",
          "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
          "dynamic": true
        },
        {
          "label": "Timecards",
          "href": "/fieldop/projects/[projectId]/workforce/timecards",
          "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
          "dynamic": true
        },
        {
          "label": "Attendance audit",
          "href": "/fieldop/projects/[projectId]/workforce/audit",
          "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
          "dynamic": true
        },
        {
          "label": "Attendance exceptions",
          "href": "/fieldop/projects/[projectId]/workforce/exceptions",
          "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
          "dynamic": true
        }
      ],
      "components": [
        {
          "label": "FieldOpWorkforceSetup",
          "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
        }
      ],
      "apis": []
    }
  },
  "database": {
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
      ],
      "sourcePaths": [
        "src/app/dashboard/planning/weekly-planning/page.js"
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
          "purpose": "Project cover images accessed through signed URLs.",
          "public": false,
          "operations": [
            {
              "method": "createSignedUrl",
              "line": 1812,
              "sourcePath": "src/app/dashboard/planning/master-plan/page.js"
            }
          ]
        }
      ],
      "sourcePaths": [
        "src/app/dashboard/planning/master-plan/page.js"
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
      ],
      "sourcePaths": [
        "src/app/dashboard/planning/lookahead/page.js"
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
      ],
      "sourcePaths": [
        "src/app/dashboard/projects/constraints/page.js"
      ]
    },
    "project-information": {
      "sourcePath": "src/app/projects/page.js",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "verifiedOn": "2026-10-03",
      "sourcePaths": [
        "src/app/projects/page.js",
        "src/app/projects/new/page.js",
        "src/app/projects/[projectId]/page.js",
        "src/app/projects/[projectId]/edit/page.js",
        "src/app/projects/[projectId]/history/page.js",
        "src/app/projects/[projectId]/ProjectDocuments.js",
        "src/app/projects/[projectId]/ProjectReportButton.js"
      ],
      "dataSources": [
        {
          "kind": "table",
          "name": "projects",
          "schema": "public",
          "purpose": "Shared project identity and configuration.",
          "operations": [
            {
              "method": "select",
              "line": 18,
              "sourcePath": "src/app/projects/page.js"
            },
            {
              "method": "insert",
              "line": 24,
              "sourcePath": "src/app/projects/new/page.js"
            },
            {
              "method": "select",
              "line": 26,
              "sourcePath": "src/app/projects/[projectId]/page.js"
            },
            {
              "method": "delete",
              "line": 31,
              "sourcePath": "src/app/projects/[projectId]/page.js"
            },
            {
              "method": "update",
              "line": 32,
              "sourcePath": "src/app/projects/[projectId]/page.js"
            },
            {
              "method": "select",
              "line": 21,
              "sourcePath": "src/app/projects/[projectId]/edit/page.js"
            },
            {
              "method": "update",
              "line": 24,
              "sourcePath": "src/app/projects/[projectId]/edit/page.js"
            },
            {
              "method": "select",
              "line": 18,
              "sourcePath": "src/app/projects/[projectId]/history/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "organization_members",
          "schema": "public",
          "purpose": "Organization membership context.",
          "operations": [
            {
              "method": "select",
              "line": 24,
              "sourcePath": "src/app/projects/new/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_notes",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 27,
              "sourcePath": "src/app/projects/[projectId]/page.js"
            },
            {
              "method": "insert",
              "line": 29,
              "sourcePath": "src/app/projects/[projectId]/page.js"
            },
            {
              "method": "delete",
              "line": 30,
              "sourcePath": "src/app/projects/[projectId]/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "user_profiles",
          "schema": "public",
          "purpose": "User display and author information.",
          "operations": [
            {
              "method": "select",
              "line": 29,
              "sourcePath": "src/app/projects/[projectId]/page.js"
            },
            {
              "method": "select",
              "line": 104,
              "sourcePath": "src/app/projects/[projectId]/ProjectDocuments.js"
            },
            {
              "method": "select",
              "line": 32,
              "sourcePath": "src/app/projects/[projectId]/ProjectReportButton.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_history",
          "schema": "public",
          "purpose": "Project change and reporting history.",
          "operations": [
            {
              "method": "select",
              "line": 18,
              "sourcePath": "src/app/projects/[projectId]/history/page.js"
            },
            {
              "method": "insert",
              "line": 40,
              "sourcePath": "src/app/projects/[projectId]/ProjectReportButton.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_documents",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 52,
              "sourcePath": "src/app/projects/[projectId]/ProjectDocuments.js"
            },
            {
              "method": "insert",
              "line": 125,
              "sourcePath": "src/app/projects/[projectId]/ProjectDocuments.js"
            },
            {
              "method": "delete",
              "line": 181,
              "sourcePath": "src/app/projects/[projectId]/ProjectDocuments.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_drawing_maps",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 57,
              "sourcePath": "src/app/projects/[projectId]/ProjectDocuments.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_members",
          "schema": "public",
          "purpose": "Project team assignments and roles.",
          "operations": [
            {
              "method": "select",
              "line": 26,
              "sourcePath": "src/app/projects/[projectId]/ProjectReportButton.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_scopes",
          "schema": "public",
          "purpose": "Scope register used by the shared project record.",
          "operations": [
            {
              "method": "select",
              "line": 27,
              "sourcePath": "src/app/projects/[projectId]/ProjectReportButton.js"
            }
          ]
        }
      ],
      "functions": [],
      "storage": [
        {
          "name": "project-images",
          "public": true,
          "purpose": "File storage used by the audited implementation.",
          "operations": [
            {
              "method": "upload",
              "line": 32,
              "sourcePath": "src/app/projects/[projectId]/page.js"
            },
            {
              "method": "remove",
              "line": 32,
              "sourcePath": "src/app/projects/[projectId]/page.js"
            },
            {
              "method": "getPublicUrl",
              "line": 33,
              "sourcePath": "src/app/projects/[projectId]/page.js"
            },
            {
              "method": "getPublicUrl",
              "line": 22,
              "sourcePath": "src/app/projects/[projectId]/history/page.js"
            },
            {
              "method": "getPublicUrl",
              "line": 34,
              "sourcePath": "src/app/projects/[projectId]/ProjectReportButton.js"
            }
          ]
        },
        {
          "name": "project-documents",
          "public": false,
          "purpose": "File storage used by the audited implementation.",
          "operations": [
            {
              "method": "upload",
              "line": 115,
              "sourcePath": "src/app/projects/[projectId]/ProjectDocuments.js"
            },
            {
              "method": "remove",
              "line": 141,
              "sourcePath": "src/app/projects/[projectId]/ProjectDocuments.js"
            },
            {
              "method": "createSignedUrl",
              "line": 152,
              "sourcePath": "src/app/projects/[projectId]/ProjectDocuments.js"
            }
          ]
        }
      ]
    },
    "project-team": {
      "sourcePath": "src/app/projects/[projectId]/ProjectTeam.js",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "verifiedOn": "2026-10-03",
      "sourcePaths": [
        "src/app/projects/[projectId]/ProjectTeam.js"
      ],
      "dataSources": [
        {
          "kind": "table",
          "name": "project_members",
          "schema": "public",
          "purpose": "Project team assignments and roles.",
          "operations": [
            {
              "method": "select",
              "line": 21,
              "sourcePath": "src/app/projects/[projectId]/ProjectTeam.js"
            },
            {
              "method": "insert",
              "line": 24,
              "sourcePath": "src/app/projects/[projectId]/ProjectTeam.js"
            },
            {
              "method": "update",
              "line": 25,
              "sourcePath": "src/app/projects/[projectId]/ProjectTeam.js"
            },
            {
              "method": "delete",
              "line": 26,
              "sourcePath": "src/app/projects/[projectId]/ProjectTeam.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "organization_members",
          "schema": "public",
          "purpose": "Organization membership context.",
          "operations": [
            {
              "method": "select",
              "line": 21,
              "sourcePath": "src/app/projects/[projectId]/ProjectTeam.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "user_profiles",
          "schema": "public",
          "purpose": "User display and author information.",
          "operations": [
            {
              "method": "select",
              "line": 21,
              "sourcePath": "src/app/projects/[projectId]/ProjectTeam.js"
            }
          ]
        }
      ],
      "functions": [],
      "storage": []
    },
    "location-structure": {
      "sourcePath": "src/app/projects/[projectId]/locations/page.js",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "verifiedOn": "2026-10-03",
      "sourcePaths": [
        "src/app/projects/[projectId]/locations/page.js",
        "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js",
        "src/app/projects/[projectId]/location-map/page.js",
        "src/app/projects/[projectId]/locations/LocationMapWorkspace.js",
        "src/app/projects/[projectId]/location-map/card-view/page.js",
        "src/app/projects/[projectId]/locations/LocationCardViewEditor.js",
        "src/app/api/projects/[projectId]/locations/[locationId]/qr/route.js"
      ],
      "dataSources": [
        {
          "kind": "table",
          "name": "projects",
          "schema": "public",
          "purpose": "Shared project identity and configuration.",
          "operations": [
            {
              "method": "select",
              "line": 20,
              "sourcePath": "src/app/projects/[projectId]/locations/page.js"
            },
            {
              "method": "select",
              "line": 18,
              "sourcePath": "src/app/projects/[projectId]/location-map/page.js"
            },
            {
              "method": "select",
              "line": 14,
              "sourcePath": "src/app/projects/[projectId]/location-map/card-view/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "locations",
          "schema": "public",
          "purpose": "Location hierarchy and production areas.",
          "operations": [
            {
              "method": "select",
              "line": 21,
              "sourcePath": "src/app/projects/[projectId]/locations/page.js"
            },
            {
              "method": "update",
              "line": 110,
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js"
            },
            {
              "method": "insert",
              "line": 110,
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js"
            },
            {
              "method": "delete",
              "line": 124,
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js"
            },
            {
              "method": "select",
              "line": 19,
              "sourcePath": "src/app/projects/[projectId]/location-map/page.js"
            },
            {
              "method": "select",
              "line": 15,
              "sourcePath": "src/app/projects/[projectId]/location-map/card-view/page.js"
            },
            {
              "method": "select",
              "line": 15,
              "sourcePath": "src/app/api/projects/[projectId]/locations/[locationId]/qr/route.js"
            },
            {
              "method": "update",
              "line": 43,
              "sourcePath": "src/app/api/projects/[projectId]/locations/[locationId]/qr/route.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "fieldop_project_activities",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 22,
              "sourcePath": "src/app/projects/[projectId]/locations/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "location_service_quantities",
          "schema": "public",
          "purpose": "Quantities allocated to locations.",
          "operations": [
            {
              "method": "select",
              "line": 23,
              "sourcePath": "src/app/projects/[projectId]/locations/page.js"
            },
            {
              "method": "delete",
              "line": 150,
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js"
            },
            {
              "method": "update",
              "line": 151,
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js"
            },
            {
              "method": "insert",
              "line": 151,
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js"
            },
            {
              "method": "select",
              "line": 152,
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "user_profiles",
          "schema": "public",
          "purpose": "User display and author information.",
          "operations": [
            {
              "method": "select",
              "line": 81,
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_history",
          "schema": "public",
          "purpose": "Project change and reporting history.",
          "operations": [
            {
              "method": "insert",
              "line": 82,
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_documents",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 49,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "insert",
              "line": 77,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "select",
              "line": 22,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationCardViewEditor.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_drawing_maps",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 50,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "insert",
              "line": 53,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "update",
              "line": 71,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "select",
              "line": 25,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationCardViewEditor.js"
            },
            {
              "method": "insert",
              "line": 36,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationCardViewEditor.js"
            },
            {
              "method": "update",
              "line": 37,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationCardViewEditor.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_drawing_location_geometries",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 50,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "update",
              "line": 75,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "insert",
              "line": 75,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "delete",
              "line": 76,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "select",
              "line": 25,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationCardViewEditor.js"
            }
          ]
        }
      ],
      "functions": [
        {
          "name": "delete_project_location_tree",
          "schema": "public",
          "returns": "jsonb",
          "arguments": "target_location_id uuid",
          "line": 123,
          "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js",
          "purpose": "RPC entry point called by the audited implementation.",
          "calls": [
            {
              "sourcePath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js",
              "line": 123
            }
          ]
        }
      ],
      "storage": [
        {
          "name": "project-documents",
          "public": false,
          "purpose": "File storage used by the audited implementation.",
          "operations": [
            {
              "method": "createSignedUrl",
              "line": 50,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "upload",
              "line": 77,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "remove",
              "line": 77,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js"
            },
            {
              "method": "createSignedUrl",
              "line": 24,
              "sourcePath": "src/app/projects/[projectId]/locations/LocationCardViewEditor.js"
            }
          ]
        }
      ]
    },
    "project-setup": {
      "sourcePath": "src/app/projects/[projectId]/scope/page.js",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "verifiedOn": "2026-10-03",
      "sourcePaths": [
        "src/app/projects/[projectId]/scope/page.js"
      ],
      "dataSources": [
        {
          "kind": "table",
          "name": "projects",
          "schema": "public",
          "purpose": "Shared project identity and configuration.",
          "operations": [
            {
              "method": "select",
              "line": 25,
              "sourcePath": "src/app/projects/[projectId]/scope/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_scopes",
          "schema": "public",
          "purpose": "Scope register used by the shared project record.",
          "operations": [
            {
              "method": "select",
              "line": 25,
              "sourcePath": "src/app/projects/[projectId]/scope/page.js"
            },
            {
              "method": "insert",
              "line": 43,
              "sourcePath": "src/app/projects/[projectId]/scope/page.js"
            },
            {
              "method": "update",
              "line": 44,
              "sourcePath": "src/app/projects/[projectId]/scope/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "scope_activities",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 26,
              "sourcePath": "src/app/projects/[projectId]/scope/page.js"
            },
            {
              "method": "insert",
              "line": 46,
              "sourcePath": "src/app/projects/[projectId]/scope/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "user_profiles",
          "schema": "public",
          "purpose": "User display and author information.",
          "operations": [
            {
              "method": "select",
              "line": 27,
              "sourcePath": "src/app/projects/[projectId]/scope/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_history",
          "schema": "public",
          "purpose": "Project change and reporting history.",
          "operations": [
            {
              "method": "insert",
              "line": 28,
              "sourcePath": "src/app/projects/[projectId]/scope/page.js"
            }
          ]
        }
      ],
      "functions": [],
      "storage": []
    },
    "operational-dashboard": {
      "sourcePath": "src/app/fieldop/page.js",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "verifiedOn": "2026-10-03",
      "sourcePaths": [
        "src/app/fieldop/page.js",
        "src/app/fieldop/projects/page.js",
        "src/app/fieldop/projects/[projectId]/page.js",
        "src/app/fieldop/projects/[projectId]/FieldOpLocationsSetup.js"
      ],
      "dataSources": [
        {
          "kind": "table",
          "name": "projects",
          "schema": "public",
          "purpose": "Shared project identity and configuration.",
          "operations": [
            {
              "method": "select",
              "line": 21,
              "sourcePath": "src/app/fieldop/page.js"
            },
            {
              "method": "select",
              "line": 19,
              "sourcePath": "src/app/fieldop/projects/page.js"
            },
            {
              "method": "select",
              "line": 40,
              "sourcePath": "src/app/fieldop/projects/[projectId]/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "fieldop_project_activities",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 51,
              "sourcePath": "src/app/fieldop/projects/[projectId]/page.js"
            },
            {
              "method": "insert",
              "line": 101,
              "sourcePath": "src/app/fieldop/projects/[projectId]/page.js"
            },
            {
              "method": "delete",
              "line": 102,
              "sourcePath": "src/app/fieldop/projects/[projectId]/page.js"
            },
            {
              "method": "update",
              "line": 127,
              "sourcePath": "src/app/fieldop/projects/[projectId]/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "fieldop_project_locations",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 65,
              "sourcePath": "src/app/fieldop/projects/[projectId]/page.js"
            },
            {
              "method": "select",
              "line": 33,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpLocationsSetup.js"
            },
            {
              "method": "insert",
              "line": 134,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpLocationsSetup.js"
            },
            {
              "method": "delete",
              "line": 140,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpLocationsSetup.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "field_project_assignments",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 66,
              "sourcePath": "src/app/fieldop/projects/[projectId]/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "fieldop_manual_workers",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 67,
              "sourcePath": "src/app/fieldop/projects/[projectId]/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "fieldop_daily_report_settings",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 68,
              "sourcePath": "src/app/fieldop/projects/[projectId]/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "project_scopes",
          "schema": "public",
          "purpose": "Scope register used by the shared project record.",
          "operations": [
            {
              "method": "select",
              "line": 84,
              "sourcePath": "src/app/fieldop/projects/[projectId]/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "locations",
          "schema": "public",
          "purpose": "Location hierarchy and production areas.",
          "operations": [
            {
              "method": "select",
              "line": 27,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpLocationsSetup.js"
            }
          ]
        }
      ],
      "functions": [],
      "storage": []
    },
    "daily-reports": {
      "sourcePath": "src/app/fieldop/reports/daily/page.js",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "verifiedOn": "2026-10-03",
      "sourcePaths": [
        "src/app/fieldop/reports/daily/page.js",
        "src/app/fieldop/reports/daily/new/page.js",
        "src/app/fieldop/reports/daily/[reportId]/page.js",
        "src/app/fieldop/projects/[projectId]/FieldOpDailyReportSettings.js",
        "src/app/fieldop/reports/daily/[reportId]/WorkforceSection.js",
        "src/app/fieldop/reports/daily/[reportId]/AttachmentsSection.js",
        "src/app/fieldop/reports/daily/[reportId]/InvoiceImport.js",
        "src/app/fieldop/reports/daily/[reportId]/WeatherSection.js",
        "src/app/fieldop/reports/daily/[reportId]/EquipmentSection.js",
        "src/app/fieldop/reports/daily/[reportId]/NotesSection.js",
        "src/app/fieldop/reports/daily/[reportId]/SafetySection.js",
        "src/app/fieldop/reports/daily/[reportId]/print/page.js",
        "src/app/fieldop/reports/daily/[reportId]/ApprovalSection.js"
      ],
      "dataSources": [
        {
          "kind": "table",
          "name": "daily_reports",
          "schema": "public",
          "purpose": "Daily report records and lifecycle.",
          "operations": [
            {
              "method": "select",
              "line": 14,
              "sourcePath": "src/app/fieldop/reports/daily/page.js"
            },
            {
              "method": "select",
              "line": 16,
              "sourcePath": "src/app/fieldop/reports/daily/new/page.js"
            },
            {
              "method": "insert",
              "line": 16,
              "sourcePath": "src/app/fieldop/reports/daily/new/page.js"
            },
            {
              "method": "update",
              "line": 18,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/page.js"
            },
            {
              "method": "select",
              "line": 33,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "projects",
          "schema": "public",
          "purpose": "Shared project identity and configuration.",
          "operations": [
            {
              "method": "select",
              "line": 15,
              "sourcePath": "src/app/fieldop/reports/daily/new/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "location_service_quantities",
          "schema": "public",
          "purpose": "Quantities allocated to locations.",
          "operations": [
            {
              "method": "select",
              "line": 24,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "daily_report_production",
          "schema": "public",
          "purpose": "Recorded production quantities.",
          "operations": [
            {
              "method": "select",
              "line": 24,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/page.js"
            },
            {
              "method": "update",
              "line": 25,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/page.js"
            },
            {
              "method": "insert",
              "line": 25,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "fieldop_daily_report_settings",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 53,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpDailyReportSettings.js"
            },
            {
              "method": "upsert",
              "line": 78,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpDailyReportSettings.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "daily_report_workforce",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 20,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/WorkforceSection.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "daily_report_attachments",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 54,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/AttachmentsSection.js"
            },
            {
              "method": "insert",
              "line": 87,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/AttachmentsSection.js"
            },
            {
              "method": "delete",
              "line": 118,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/AttachmentsSection.js"
            },
            {
              "method": "insert",
              "line": 147,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/InvoiceImport.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "daily_report_weather",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 35,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/WeatherSection.js"
            },
            {
              "method": "upsert",
              "line": 97,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/WeatherSection.js"
            },
            {
              "method": "delete",
              "line": 102,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/WeatherSection.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "daily_report_equipment",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 45,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/EquipmentSection.js"
            },
            {
              "method": "insert",
              "line": 49,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/EquipmentSection.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "daily_report_materials",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "insert",
              "line": 138,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/InvoiceImport.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "daily_report_issues",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 56,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/AttachmentsSection.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "daily_report_notes",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 28,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/NotesSection.js"
            },
            {
              "method": "update",
              "line": 63,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/NotesSection.js"
            },
            {
              "method": "insert",
              "line": 64,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/NotesSection.js"
            },
            {
              "method": "delete",
              "line": 73,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/NotesSection.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "daily_report_safety",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 36,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/SafetySection.js"
            },
            {
              "method": "upsert",
              "line": 75,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/SafetySection.js"
            },
            {
              "method": "select",
              "line": 79,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/page.js"
            },
            {
              "method": "select",
              "line": 39,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/print/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "daily_report_approval_history",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 34,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/ApprovalSection.js"
            },
            {
              "method": "select",
              "line": 43,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/print/page.js"
            }
          ]
        }
      ],
      "functions": [],
      "storage": [
        {
          "name": "daily-report-attachments",
          "public": false,
          "purpose": "Bucket for report attachments and photos. Each attachment row records its storage_bucket; record-dependent targets other than this default are outside this snapshot.",
          "operations": [
            {
              "method": "createSignedUrls",
              "line": 64,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/AttachmentsSection.js"
            },
            {
              "method": "upload",
              "line": 85,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/AttachmentsSection.js"
            },
            {
              "method": "remove",
              "line": 102,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/AttachmentsSection.js"
            },
            {
              "method": "remove",
              "line": 117,
              "sourcePath": "src/app/fieldop/reports/daily/[reportId]/AttachmentsSection.js"
            }
          ]
        }
      ]
    },
    "workforce-timekeeping": {
      "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js",
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b",
      "verifiedOn": "2026-10-03",
      "sourcePaths": [
        "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js",
        "src/app/fieldop/projects/[projectId]/workforce/page.js",
        "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
        "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
        "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
        "src/app/field/scan/[token]/LocationHub.js"
      ],
      "dataSources": [
        {
          "kind": "table",
          "name": "projects",
          "schema": "public",
          "purpose": "Shared project identity and configuration.",
          "operations": [
            {
              "method": "select",
              "line": 19,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            },
            {
              "method": "select",
              "line": 17,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js"
            },
            {
              "method": "select",
              "line": 19,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js"
            },
            {
              "method": "select",
              "line": 17,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js"
            },
            {
              "method": "select",
              "line": 21,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "field_project_assignments",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 20,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            },
            {
              "method": "update",
              "line": 38,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            },
            {
              "method": "insert",
              "line": 38,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            },
            {
              "method": "select",
              "line": 17,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "fieldop_manual_workers",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 21,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            },
            {
              "method": "update",
              "line": 44,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            },
            {
              "method": "insert",
              "line": 44,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            },
            {
              "method": "delete",
              "line": 45,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "field_workers",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 22,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            },
            {
              "method": "select",
              "line": 17,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js"
            },
            {
              "method": "select",
              "line": 19,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js"
            },
            {
              "method": "select",
              "line": 17,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js"
            },
            {
              "method": "select",
              "line": 21,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "field_companies",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 23,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            },
            {
              "method": "select",
              "line": 17,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "field_trades",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 24,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            },
            {
              "method": "select",
              "line": 17,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "field_roles",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 25,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "field_crews",
          "schema": "public",
          "purpose": "Direct access from the audited source files.",
          "operations": [
            {
              "method": "select",
              "line": 26,
              "sourcePath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "field_attendance_sessions",
          "schema": "public",
          "purpose": "Attendance session records.",
          "operations": [
            {
              "method": "select",
              "line": 17,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js"
            },
            {
              "method": "select",
              "line": 19,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js"
            },
            {
              "method": "select",
              "line": 21,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js"
            }
          ]
        },
        {
          "kind": "table",
          "name": "field_attendance_events",
          "schema": "public",
          "purpose": "Attendance event and exception audit trail.",
          "operations": [
            {
              "method": "select",
              "line": 17,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js"
            },
            {
              "method": "select",
              "line": 23,
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js"
            }
          ]
        }
      ],
      "functions": [
        {
          "name": "field_worker_check_in",
          "schema": "public",
          "returns": "TABLE(session_id uuid, worker_id uuid, project_id uuid, assignment_id uuid, work_date date, check_in_at timestamp with time zone, status text)",
          "arguments": "p_assignment_id uuid, p_event_at timestamp with time zone DEFAULT now(), p_method text DEFAULT 'supervisor'::text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_gps_accuracy_m double precision DEFAULT NULL::double precision, p_distance_to_project_m double precision DEFAULT NULL::double precision, p_geofence_status text DEFAULT NULL::text, p_device_id text DEFAULT NULL::text, p_notes text DEFAULT NULL::text",
          "line": 21,
          "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
          "purpose": "RPC entry point called by the audited implementation.",
          "calls": [
            {
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
              "line": 21
            }
          ]
        },
        {
          "name": "field_worker_check_out",
          "schema": "public",
          "returns": "TABLE(session_id uuid, worker_id uuid, project_id uuid, assignment_id uuid, work_date date, check_in_at timestamp with time zone, check_out_at timestamp with time zone, worked_minutes integer, status text)",
          "arguments": "p_session_id uuid, p_event_at timestamp with time zone DEFAULT now(), p_method text DEFAULT 'supervisor'::text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_gps_accuracy_m double precision DEFAULT NULL::double precision, p_distance_to_project_m double precision DEFAULT NULL::double precision, p_geofence_status text DEFAULT NULL::text, p_device_id text DEFAULT NULL::text, p_notes text DEFAULT NULL::text",
          "line": 22,
          "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
          "purpose": "RPC entry point called by the audited implementation.",
          "calls": [
            {
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
              "line": 22
            }
          ]
        },
        {
          "name": "field_correct_attendance_session",
          "schema": "public",
          "returns": "TABLE(session_id uuid, worker_id uuid, project_id uuid, assignment_id uuid, work_date date, check_in_at timestamp with time zone, check_out_at timestamp with time zone, worked_minutes integer, status text, has_exception boolean, updated_at timestamp with time zone)",
          "arguments": "p_session_id uuid, p_new_check_in_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_new_check_out_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reason text DEFAULT NULL::text",
          "line": 22,
          "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
          "purpose": "RPC entry point called by the audited implementation.",
          "calls": [
            {
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
              "line": 22
            }
          ]
        },
        {
          "name": "field_resolve_attendance_actor",
          "schema": "public",
          "returns": "TABLE(user_id uuid, display_name text, email text, job_title text)",
          "arguments": "p_user_id uuid",
          "line": 17,
          "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
          "purpose": "RPC entry point called by the audited implementation.",
          "calls": [
            {
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
              "line": 17
            },
            {
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
              "line": 20
            }
          ]
        },
        {
          "name": "field_review_attendance_exception",
          "schema": "public",
          "returns": "TABLE(session_id uuid, exception_resolution_status text, exception_resolution_notes text)",
          "arguments": "p_session_id uuid, p_review_notes text DEFAULT NULL::text",
          "line": 24,
          "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
          "purpose": "RPC entry point called by the audited implementation.",
          "calls": [
            {
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
              "line": 24
            }
          ]
        },
        {
          "name": "field_resolve_attendance_exception",
          "schema": "public",
          "returns": "TABLE(session_id uuid, exception_resolution_status text, exception_resolution_action text, exception_resolution_notes text, exception_resolved_by uuid, exception_resolved_at timestamp with time zone)",
          "arguments": "p_session_id uuid, p_resolution_action text, p_resolution_notes text",
          "line": 25,
          "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
          "purpose": "RPC entry point called by the audited implementation.",
          "calls": [
            {
              "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
              "line": 25
            }
          ]
        },
        {
          "name": "fieldop_worker_attendance_status",
          "schema": "public",
          "returns": "TABLE(worker_id uuid, assignment_id uuid, session_id uuid, status text, check_in_at timestamp with time zone)",
          "arguments": "p_project_id uuid",
          "line": 77,
          "sourcePath": "src/app/field/scan/[token]/LocationHub.js",
          "purpose": "RPC entry point called by the audited implementation.",
          "calls": [
            {
              "sourcePath": "src/app/field/scan/[token]/LocationHub.js",
              "line": 77
            }
          ]
        }
      ],
      "storage": []
    }
  },
  "gaps": [
    {
      "id": "pull-page",
      "moduleId": "pull-planning",
      "title": "Dedicated page absent",
      "detail": "The module exists in the architecture map; no dedicated application route was found.",
      "line": 1,
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b"
    },
    {
      "id": "pre-planning-page",
      "moduleId": "pre-planning",
      "title": "Dedicated page absent",
      "detail": "Pre-Planning was removed from PreCon; Master Plan is the first planning step.",
      "line": 1,
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b"
    },
    {
      "id": "precon-report-page",
      "moduleId": "precon-reports",
      "title": "Dedicated page absent",
      "detail": "The planned PreCon project-reporting module has no dedicated route in the audited branch.",
      "line": 1,
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b"
    },
    {
      "id": "fieldop-aggregation",
      "moduleId": "operational-dashboard",
      "title": "Operational metrics not aggregated",
      "detail": "The FieldOp portfolio loads projects and groups them by status; progress, productivity and safety metrics are not aggregated on this page.",
      "sourcePath": "src/app/fieldop/page.js",
      "line": 21,
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b"
    },
    {
      "id": "parallel-scope-models",
      "moduleId": "project-setup",
      "title": "Parallel scope models",
      "detail": "The Projects scope uses project_scopes and fieldop_project_activities; Master Plan still reads project_services and project_work_packages. Alignment is planned with the Master Plan rebuild.",
      "sourcePath": "src/app/projects/[projectId]/scope/page.js",
      "line": 25,
      "sourceRef": "e6b1e807993dfde1c1c19506b3703a1bf0c93c3b"
    }
  ],
  "sourceLinks": [
    {
      "sourcePath": "src/app/projects/[projectId]/page.js",
      "targetPath": "src/app/projects/[projectId]/ProjectDocuments.js",
      "type": "DEPENDS ON",
      "line": 8
    },
    {
      "sourcePath": "src/app/projects/[projectId]/page.js",
      "targetPath": "src/app/projects/[projectId]/ProjectTeam.js",
      "type": "DEPENDS ON",
      "line": 9
    },
    {
      "sourcePath": "src/app/projects/[projectId]/page.js",
      "targetPath": "src/app/projects/[projectId]/ProjectReportButton.js",
      "type": "DEPENDS ON",
      "line": 11
    },
    {
      "sourcePath": "src/app/projects/[projectId]/locations/page.js",
      "targetPath": "src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js",
      "type": "DEPENDS ON",
      "line": 6
    },
    {
      "sourcePath": "src/app/projects/[projectId]/location-map/page.js",
      "targetPath": "src/app/projects/[projectId]/locations/LocationMapWorkspace.js",
      "type": "DEPENDS ON",
      "line": 6
    },
    {
      "sourcePath": "src/app/projects/[projectId]/location-map/card-view/page.js",
      "targetPath": "src/app/projects/[projectId]/locations/LocationCardViewEditor.js",
      "type": "DEPENDS ON",
      "line": 3
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/FieldOpLocationsSetup.js",
      "type": "DEPENDS ON",
      "line": 8
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/FieldOpWorkforceSetup.js",
      "type": "DEPENDS ON",
      "line": 9
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/FieldOpDailyReportSettings.js",
      "type": "DEPENDS ON",
      "line": 10
    },
    {
      "sourcePath": "src/app/dashboard/planning/lookahead/page.js",
      "targetPath": "src/app/dashboard/projects/constraints/page.js",
      "type": "ROUTES TO",
      "line": 6390
    },
    {
      "sourcePath": "src/app/projects/page.js",
      "targetPath": "src/app/fieldop/page.js",
      "type": "ROUTES TO",
      "line": 38
    },
    {
      "sourcePath": "src/app/projects/page.js",
      "targetPath": "src/app/projects/new/page.js",
      "type": "ROUTES TO",
      "line": 50
    },
    {
      "sourcePath": "src/app/projects/page.js",
      "targetPath": "src/app/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 76
    },
    {
      "sourcePath": "src/app/projects/page.js",
      "targetPath": "src/app/projects/[projectId]/scope/page.js",
      "type": "ROUTES TO",
      "line": 76
    },
    {
      "sourcePath": "src/app/projects/new/page.js",
      "targetPath": "src/app/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 24
    },
    {
      "sourcePath": "src/app/projects/new/page.js",
      "targetPath": "src/app/projects/page.js",
      "type": "ROUTES TO",
      "line": 28
    },
    {
      "sourcePath": "src/app/projects/[projectId]/page.js",
      "targetPath": "src/app/projects/page.js",
      "type": "ROUTES TO",
      "line": 31
    },
    {
      "sourcePath": "src/app/projects/[projectId]/page.js",
      "targetPath": "src/app/fieldop/page.js",
      "type": "ROUTES TO",
      "line": 34
    },
    {
      "sourcePath": "src/app/projects/[projectId]/page.js",
      "targetPath": "src/app/projects/[projectId]/history/page.js",
      "type": "ROUTES TO",
      "line": 36
    },
    {
      "sourcePath": "src/app/projects/[projectId]/page.js",
      "targetPath": "src/app/projects/[projectId]/scope/page.js",
      "type": "ROUTES TO",
      "line": 36
    },
    {
      "sourcePath": "src/app/projects/[projectId]/page.js",
      "targetPath": "src/app/projects/[projectId]/locations/page.js",
      "type": "ROUTES TO",
      "line": 36
    },
    {
      "sourcePath": "src/app/projects/[projectId]/page.js",
      "targetPath": "src/app/projects/[projectId]/edit/page.js",
      "type": "ROUTES TO",
      "line": 36
    },
    {
      "sourcePath": "src/app/projects/[projectId]/edit/page.js",
      "targetPath": "src/app/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 24
    },
    {
      "sourcePath": "src/app/projects/[projectId]/history/page.js",
      "targetPath": "src/app/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 24
    },
    {
      "sourcePath": "src/app/projects/[projectId]/locations/page.js",
      "targetPath": "src/app/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 61
    },
    {
      "sourcePath": "src/app/projects/[projectId]/locations/page.js",
      "targetPath": "src/app/projects/[projectId]/scope/page.js",
      "type": "ROUTES TO",
      "line": 62
    },
    {
      "sourcePath": "src/app/projects/[projectId]/locations/page.js",
      "targetPath": "src/app/projects/[projectId]/location-map/page.js",
      "type": "ROUTES TO",
      "line": 71
    },
    {
      "sourcePath": "src/app/projects/[projectId]/location-map/page.js",
      "targetPath": "src/app/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 36
    },
    {
      "sourcePath": "src/app/projects/[projectId]/location-map/page.js",
      "targetPath": "src/app/projects/[projectId]/location-map/card-view/page.js",
      "type": "ROUTES TO",
      "line": 37
    },
    {
      "sourcePath": "src/app/projects/[projectId]/location-map/page.js",
      "targetPath": "src/app/projects/[projectId]/scope/page.js",
      "type": "ROUTES TO",
      "line": 38
    },
    {
      "sourcePath": "src/app/projects/[projectId]/location-map/page.js",
      "targetPath": "src/app/projects/[projectId]/locations/page.js",
      "type": "ROUTES TO",
      "line": 46
    },
    {
      "sourcePath": "src/app/projects/[projectId]/locations/LocationCardViewEditor.js",
      "targetPath": "src/app/projects/[projectId]/location-map/page.js",
      "type": "ROUTES TO",
      "line": 45
    },
    {
      "sourcePath": "src/app/projects/[projectId]/scope/page.js",
      "targetPath": "src/app/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 52
    },
    {
      "sourcePath": "src/app/fieldop/page.js",
      "targetPath": "src/app/fieldop/reports/daily/new/page.js",
      "type": "ROUTES TO",
      "line": 41
    },
    {
      "sourcePath": "src/app/fieldop/page.js",
      "targetPath": "src/app/fieldop/projects/page.js",
      "type": "ROUTES TO",
      "line": 68
    },
    {
      "sourcePath": "src/app/fieldop/projects/page.js",
      "targetPath": "src/app/fieldop/page.js",
      "type": "ROUTES TO",
      "line": 44
    },
    {
      "sourcePath": "src/app/fieldop/projects/page.js",
      "targetPath": "src/app/dashboard/projects/constraints/page.js",
      "type": "ROUTES TO",
      "line": 51
    },
    {
      "sourcePath": "src/app/fieldop/projects/page.js",
      "targetPath": "src/app/fieldop/reports/daily/page.js",
      "type": "ROUTES TO",
      "line": 52
    },
    {
      "sourcePath": "src/app/fieldop/projects/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 88
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/page.js",
      "targetPath": "src/app/fieldop/page.js",
      "type": "ROUTES TO",
      "line": 147
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/page.js",
      "targetPath": "src/app/fieldop/projects/page.js",
      "type": "ROUTES TO",
      "line": 147
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
      "type": "ROUTES TO",
      "line": 147
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/page.js",
      "targetPath": "src/app/dashboard/projects/constraints/page.js",
      "type": "ROUTES TO",
      "line": 147
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/page.js",
      "targetPath": "src/app/fieldop/reports/daily/page.js",
      "type": "ROUTES TO",
      "line": 147
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/page.js",
      "targetPath": "src/app/projects/[projectId]/scope/page.js",
      "type": "ROUTES TO",
      "line": 151
    },
    {
      "sourcePath": "src/app/fieldop/reports/daily/page.js",
      "targetPath": "src/app/fieldop/page.js",
      "type": "ROUTES TO",
      "line": 26
    },
    {
      "sourcePath": "src/app/fieldop/reports/daily/page.js",
      "targetPath": "src/app/fieldop/reports/daily/new/page.js",
      "type": "ROUTES TO",
      "line": 26
    },
    {
      "sourcePath": "src/app/fieldop/reports/daily/page.js",
      "targetPath": "src/app/fieldop/reports/daily/[reportId]/page.js",
      "type": "ROUTES TO",
      "line": 32
    },
    {
      "sourcePath": "src/app/fieldop/reports/daily/new/page.js",
      "targetPath": "src/app/fieldop/reports/daily/[reportId]/page.js",
      "type": "ROUTES TO",
      "line": 16
    },
    {
      "sourcePath": "src/app/fieldop/reports/daily/new/page.js",
      "targetPath": "src/app/fieldop/reports/daily/page.js",
      "type": "ROUTES TO",
      "line": 17
    },
    {
      "sourcePath": "src/app/fieldop/reports/daily/[reportId]/page.js",
      "targetPath": "src/app/fieldop/reports/daily/page.js",
      "type": "ROUTES TO",
      "line": 35
    },
    {
      "sourcePath": "src/app/fieldop/reports/daily/[reportId]/page.js",
      "targetPath": "src/app/fieldop/page.js",
      "type": "ROUTES TO",
      "line": 36
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
      "type": "ROUTES TO",
      "line": 24
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
      "type": "ROUTES TO",
      "line": 24
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
      "type": "ROUTES TO",
      "line": 24
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 24
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
      "type": "ROUTES TO",
      "line": 23
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
      "type": "ROUTES TO",
      "line": 23
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
      "type": "ROUTES TO",
      "line": 23
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 23
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
      "type": "ROUTES TO",
      "line": 20
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
      "type": "ROUTES TO",
      "line": 20
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
      "type": "ROUTES TO",
      "line": 20
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 20
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/page.js",
      "type": "ROUTES TO",
      "line": 27
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/timecards/page.js",
      "type": "ROUTES TO",
      "line": 27
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/workforce/audit/page.js",
      "type": "ROUTES TO",
      "line": 27
    },
    {
      "sourcePath": "src/app/fieldop/projects/[projectId]/workforce/exceptions/page.js",
      "targetPath": "src/app/fieldop/projects/[projectId]/page.js",
      "type": "ROUTES TO",
      "line": 27
    }
  ]
}
