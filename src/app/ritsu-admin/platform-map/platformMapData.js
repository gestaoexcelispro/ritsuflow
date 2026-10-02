export const platformMapNodes = [
  { id: 'ritsuflow', label: 'RitsuFlow', subtitle: 'Construction Production System', type: 'platform' },

  { id: 'projects', label: 'Projects', subtitle: 'Project Foundation', type: 'workspace' },
  { id: 'precon', label: 'PreCon', subtitle: 'Plan & Prepare', type: 'workspace' },
  { id: 'fieldop', label: 'FieldOp', subtitle: 'Execute & Measure', type: 'workspace' },

  { id: 'project-information', label: 'Project Information', subtitle: 'Core project data', type: 'module', workspace: 'projects' },
  { id: 'project-team', label: 'Team', subtitle: 'Project team', type: 'module', workspace: 'projects' },
  { id: 'location-structure', label: 'Location Structure', subtitle: 'Location breakdown structure', type: 'module', workspace: 'projects' },
  { id: 'project-setup', label: 'Project Setup', subtitle: 'Project configuration', type: 'module', workspace: 'projects' },

  { id: 'pre-planning', label: 'Pre-Planning', subtitle: 'Production sequencing', type: 'module', workspace: 'precon' },
  { id: 'master-plan', label: 'Master Plan', subtitle: 'Location-based master planning', type: 'module', workspace: 'precon' },
  { id: 'lookahead-planning', label: 'Lookahead Planning', subtitle: 'Make-ready planning', type: 'module', workspace: 'precon' },
  { id: 'constraint-management', label: 'Constraint Management', subtitle: 'Constraint identification & clearing', type: 'module', workspace: 'precon' },
  { id: 'weekly-planning', label: 'Weekly Planning', subtitle: 'Commitments & PPC', type: 'module', workspace: 'precon' },
  { id: 'pull-planning', label: 'Pull Planning', subtitle: 'Milestone-driven planning', type: 'module', workspace: 'precon' },
  { id: 'precon-reports', label: 'Reports', subtitle: 'Planning & control reporting', type: 'module', workspace: 'precon' },

  { id: 'operational-dashboard', label: 'Operational Dashboard', subtitle: 'Field production overview', type: 'module', workspace: 'fieldop' },
  { id: 'daily-reports', label: 'Daily Reports', subtitle: 'Daily field records', type: 'module', workspace: 'fieldop' },
  { id: 'workforce-timekeeping', label: 'Workforce Timekeeping', subtitle: 'Attendance & timecards', type: 'module', workspace: 'fieldop' },
]

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
