import fs from 'node:fs'

const files = [
  'src/app/dashboard/planning/pre-planning/page.js',
  'src/app/dashboard/planning/pre-planning/PrePlanningWorkspace.js',
  'src/app/dashboard/planning/pre-planning/PrePlanningWbsEditor.js',
  'src/app/dashboard/planning/pre-planning/ActivityPreSequence.js',
]

const contents = Object.fromEntries(files.map((file) => [file, fs.readFileSync(file, 'utf8')]))
const failures = []

function requireIn(file, token, label = token) {
  if (!contents[file].includes(token)) failures.push(`${file}: missing ${label}`)
}
function forbidIn(file, token, label = token) {
  if (contents[file].includes(token)) failures.push(`${file}: unsafe/untranslated token ${label}`)
}

const page = files[0]
const workspace = files[1]
const wbs = files[2]
const sequence = files[3]

requireIn(page, "resolveProjectCopy", 'server locale resolver')
requireIn(page, 'getPrePlanningCopy', 'Pre-Planning server catalog')
requireIn(page, 'locale={locale}', 'locale propagation to workspace')
requireIn(workspace, 'getPrePlanningCopy(locale)', 'workspace locale catalog')
requireIn(wbs, 'getPrePlanningCopy(locale)', 'WBS locale catalog')
requireIn(sequence, 'getPrePlanningCopy(locale)', 'Activity Pre-Sequence locale catalog')
requireIn(sequence, 'interpolatePrePlanningCopy', 'Activity Pre-Sequence interpolation')

for (const file of files) {
  for (const token of ['get{t.', 'set{t.', 'selected{t.', 'item{t.', 'activity{t.', 'production{t.']) {
    forbidIn(file, token)
  }
}

// Known English literals that should no longer remain in their original visible boundaries.
for (const token of ['>Pre-Planning<', '>Save Sequencing<', '>Apply Sequence<', '>Create Version<', '>Duplicate Version<', '>Delete Version<']) forbidIn(workspace, token)
for (const token of ['>Summary<', '>Milestone<', '>Task<', '>Insert row<']) forbidIn(wbs, token)
for (const token of ['No active Scope Items are available for sequencing.', 'Production Layer', 'Autosave enabled', 'Sequence saved', 'Save failed']) forbidIn(sequence, token)

const catalog = fs.readFileSync('src/i18n/prePlanning.js', 'utf8')
for (const locale of ["'en-US'", "'pt-BR'", 'es:']) {
  if (!catalog.includes(locale)) failures.push(`catalog: missing locale ${locale}`)
}
for (const key of ['title:', 'sequencing:', 'wbs:', 'productionLayer:', 'activitySequenceSaveFailed:', 'wbsLoadFailed:']) {
  if (!catalog.includes(key)) failures.push(`catalog: missing key ${key}`)
}

if (failures.length) {
  console.error('PRE-PLANNING I18N VALIDATION: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('PRE-PLANNING I18N VALIDATION: PASS')
console.log(`Validated ${files.length} integrated Pre-Planning components plus shared catalog.`)
