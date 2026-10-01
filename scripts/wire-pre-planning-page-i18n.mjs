import fs from 'node:fs'

const path = 'src/app/dashboard/planning/pre-planning/page.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

required("import {\n  createClient,\n} from '../../../../lib/supabase/server'", "import {\n  createClient,\n} from '../../../../lib/supabase/server'\nimport { resolveProjectCopy } from '../../../../i18n/projectServerCopy'\nimport { getPrePlanningCopy } from '../../../../i18n/prePlanning'")
required('function locationTypeLabel(\n  value\n) {', 'function locationTypeLabel(\n  value,\n  t\n) {')
required("  const labels = {\n    project: 'Project',\n    building: 'Building',\n    floor: 'Level',\n    level: 'Level',\n    division: 'Level',\n    zone: 'Zone',\n    area: 'Area',\n    room: 'Room',\n    custom: 'Custom',\n  }", '  const labels = t.locationTypes')
required("    'Division'\n  )\n}", '    t.division\n  )\n}')
required('function resolveProductionLocation(\n  allocationLocation,\n  locationMap\n) {', 'function resolveProductionLocation(\n  allocationLocation,\n  locationMap,\n  t\n) {')
required('locationTypeLabel(\n            divisionNode.location_type\n          )', 'locationTypeLabel(\n            divisionNode.location_type,\n            t\n          )')
required('  locationMap,\n}) {', '  locationMap,\n  t,\n}) {')
required('      location,\n      locationMap\n    )', '      location,\n      locationMap,\n      t\n    )')
required("      'Scope Item',", '      t.scopeItem,')
required('function ProjectSelector({\n  projects,\n  baseHref = \'/dashboard/planning/pre-planning\',\n}) {', "function ProjectSelector({\n  projects,\n  t,\n  baseHref = '/dashboard/planning/pre-planning',\n}) {")
source = source.replace('>\n          Pre-Planning\n        </h2>', '>\n          {t.title}\n        </h2>')
source = source.replace('Select a project to review calculated production durations and define the preliminary production sequence.', '{t.selectProjectHelp}')
source = source.replace('Open Pre-Planning', '{t.openPrePlanning}')
source = source.replace('No accessible projects were found.', '{t.noAccessibleProjects}')
source = source.replace('Authentication is required.', '{t.authenticationRequired}')

required('  if (!user) {', "  if (!user) {")
required("  /* =======================================================\n     PROJECTS", "  const i18n = await resolveProjectCopy(supabase, user.id)\n  const locale = i18n.locale\n  const t = getPrePlanningCopy(locale)\n\n\n  /* =======================================================\n     PROJECTS")
required('      <ProjectSelector\n        projects={\n          projects\n        }', '      <ProjectSelector\n        projects={\n          projects\n        }\n        t={t}')
required('            locationMap,\n          })', '            locationMap,\n            t,\n          })')

// Propagate the resolved company locale into the client workspace.
const workspaceAnchor = '    <PrePlanningWorkspace\n      project={\n        selectedProject\n      }'
required(workspaceAnchor, `${workspaceAnchor}\n\n      locale={locale}`)

for (const token of ['get{t.', 'location{t.', 'project{t.', 'division{t.']) {
  if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
}

fs.writeFileSync(path, source)
console.log(`Wired Pre-Planning server locale: ${path}`)
