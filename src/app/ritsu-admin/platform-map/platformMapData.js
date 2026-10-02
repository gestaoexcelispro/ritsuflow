export const platformMapNodes = [
  { id: 'ritsuflow', label: 'RitsuFlow', subtitle: 'Construction Production System', type: 'platform' },
  { id: 'projects', label: 'Projects', subtitle: 'Project Portfolio', type: 'workspace' },
  { id: 'precon', label: 'PreCon', subtitle: 'Plan & Prepare', type: 'workspace' },
  { id: 'fieldop', label: 'FieldOp', subtitle: 'Execute & Measure', type: 'workspace' },
]

export const platformMapEdges = [
  { id: 'ritsuflow-projects', source: 'ritsuflow', target: 'projects', type: 'contains' },
  { id: 'ritsuflow-precon', source: 'ritsuflow', target: 'precon', type: 'contains' },
  { id: 'ritsuflow-fieldop', source: 'ritsuflow', target: 'fieldop', type: 'contains' },
]
