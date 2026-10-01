import fs from 'node:fs'

const path = 'src/app/dashboard/planning/pre-planning/PrePlanningWorkspace.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

required("import styles from './pre-planning.module.css'", "import styles from './pre-planning.module.css'\nimport { getPrePlanningCopy } from '../../../../i18n/prePlanning'")
required('function safeNumber(\n  value,\n  digits = 2\n) {', "function safeNumber(\n  value,\n  digits = 2,\n  locale = 'en-US'\n) {")
required("    'en-US',", '    locale,')
required('function getBasisLabel(\n  basis\n) {', 'function getBasisLabel(\n  basis,\n  t\n) {')
required("    ? 'Per crew / day'\n    : 'Per worker / day'", '    ? t.perCrewDay\n    : t.perWorkerDay')
required('function getResourceUnit(\n  activity,\n  value = 2\n) {', 'function getResourceUnit(\n  activity,\n  value = 2,\n  t\n) {')
required("      ? 'crew'\n      : 'crews'", '      ? t.crew\n      : t.crews')
required("    ? 'worker'\n    : 'workers'", '    ? t.worker\n    : t.workers')
required('function getResourceLabel(\n  activity\n) {', 'function getResourceLabel(\n  activity,\n  t,\n  locale\n) {')
required('  return `${safeNumber(\n    value\n  )} ${getResourceUnit(\n    activity,\n    value\n  )}`', '  return `${safeNumber(\n    value,\n    2,\n    locale\n  )} ${getResourceUnit(\n    activity,\n    value,\n    t\n  )}`')
required('function buildWbsRows(\n  activities,\n  desiredDurations\n) {', 'function buildWbsRows(\n  activities,\n  desiredDurations,\n  t\n) {')
required("              'Unassigned Location',", '              t.unassignedLocation,')
required("                : 'Unassigned Division',", '                : t.unassignedDivision,')
required("  standalone = false,\n}) {", "  standalone = false,\n  locale = 'en-US',\n}) {")
required('  const router =\n    useRouter()', '  const router =\n    useRouter()\n\n  const t = useMemo(\n    () => getPrePlanningCopy(locale),\n    [locale]\n  )')

// Pass translation context only into helper calls with known complete shapes.
source = source.replaceAll('getBasisLabel(\n                            activity.productivityBasis\n                          )', 'getBasisLabel(\n                            activity.productivityBasis,\n                            t\n                          )')
source = source.replaceAll('getResourceLabel(\n                            activity\n                          )', 'getResourceLabel(\n                            activity,\n                            t,\n                            locale\n                          )')
source = source.replaceAll('buildWbsRows(\n          filteredActivities,\n          desiredDurations\n        )', 'buildWbsRows(\n          filteredActivities,\n          desiredDurations,\n          t\n        )')

// Locale-aware number formatting for the most common complete call shapes.
source = source.replaceAll('safeNumber(\n                            activity.quantity\n                          )', 'safeNumber(\n                            activity.quantity,\n                            2,\n                            locale\n                          )')
source = source.replaceAll('safeNumber(\n                            activity.productivity\n                          )', 'safeNumber(\n                            activity.productivity,\n                            2,\n                            locale\n                          )')

// Exact visible JSX boundaries only. Do not replace generic words globally.
const jsx = [
  ['>Pre-Planning<', '>{t.title}<'],
  ['>Sequencing<', '>{t.sequencing}<'],
  ['>Durations<', '>{t.durations}<'],
  ['>Production Cells<', '>{t.productionCells}<'],
  ['>Versions<', '>{t.versions}<'],
  ['>Filters<', '>{t.filters}<'],
  ['>Work Package<', '>{t.workPackage}<'],
  ['>Scope Item<', '>{t.scopeItem}<'],
  ['>Activity<', '>{t.activity}<'],
  ['>Quantity<', '>{t.quantity}<'],
  ['>Unit<', '>{t.unit}<'],
  ['>Productivity<', '>{t.productivity}<'],
  ['>Duration<', '>{t.duration}<'],
  ['>Workforce<', '>{t.workforce}<'],
  ['>Resources<', '>{t.resources}<'],
  ['>Sequence<', '>{t.sequence}<'],
  ['>Actions<', '>{t.actions}<'],
  ['>Save Sequencing<', '>{t.saveSequencing}<'],
  ['>Apply Sequence<', '>{t.applySequence}<'],
  ['>Create Version<', '>{t.createVersion}<'],
  ['>Duplicate Version<', '>{t.duplicateVersion}<'],
  ['>Delete Version<', '>{t.deleteVersion}<'],
  ['>Saving...<', '>{t.saving}<'],
]
for (const [from, to] of jsx) source = source.replaceAll(from, to)

source = source.replaceAll('placeholder="Search..."', 'placeholder={t.search}')

// Guardrails learned from the Allocation migration incident.
for (const token of ['get{t.', 'set{t.', 'selected{t.', 'production{t.', 'activity{t.', 'work{t.', 'scope{t.']) {
  if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
}

fs.writeFileSync(path, source)
console.log(`Wired Pre-Planning main workspace i18n safely: ${path}`)
