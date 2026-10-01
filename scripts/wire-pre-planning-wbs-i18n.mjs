import fs from 'node:fs'

const path = 'src/app/dashboard/planning/pre-planning/PrePlanningWbsEditor.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

required("} from 'react'", "} from 'react'\nimport { getPrePlanningCopy } from '../../../../i18n/prePlanning'")
required('function safeNumber(value, digits = 2) {', "function safeNumber(value, digits = 2, locale = 'en-US') {")
required("    'en-US',", '    locale,')
required('function getItemTypeLabel(itemType) {', 'function getItemTypeLabel(itemType, t) {')
required("  if (itemType === 'summary') return 'Summary'\n  if (itemType === 'milestone') return 'Milestone'\n  return 'Task'", "  if (itemType === 'summary') return t.summary\n  if (itemType === 'milestone') return t.milestone\n  return t.task")
required('  onNotice,\n}) {', "  onNotice,\n  locale = 'en-US',\n}) {")
required("  const [items, setItems] = useState([])", "  const t = useMemo(() => getPrePlanningCopy(locale), [locale])\n\n  const [items, setItems] = useState([])")

source = source.replaceAll('getItemTypeLabel(\n            addType\n          )', 'getItemTypeLabel(\n            addType,\n            t\n          )')
source = source.replaceAll('getItemTypeLabel(\n                              row.itemType\n                            )', 'getItemTypeLabel(\n                              row.itemType,\n                              t\n                            )')
source = source.replaceAll('safeNumber(\n                              row.durationDays\n                            )', 'safeNumber(\n                              row.durationDays,\n                              2,\n                              locale\n                            )')

const literals = [
  ["'WBS could not be loaded.'", 't.wbsLoadFailed'],
  ["'WBS operation failed.'", 't.wbsOperationFailed'],
  ["'Historical versions are read-only.'", 't.historicalReadOnly'],
  ["'Save the sequence first to create a Pre-Planning version.'", 't.saveSequenceFirst'],
  ["'Enter a name for the new WBS line.'", 't.enterWbsName'],
  ["'The WBS line could not be added.'", 't.wbsAddFailed'],
  ["'The WBS line could not be updated.'", 't.wbsUpdateFailed'],
  ["'The WBS structure could not be updated.'", 't.wbsStructureFailed'],
  ["'There is no previous Summary available for this line.'", 't.noPreviousSummary'],
  ["'A WBS line can only be indented under a Summary.'", 't.indentSummaryOnly'],
  ["'WBS line indented.'", 't.wbsIndented'],
  ["'This WBS line is already at the root level.'", 't.alreadyRoot'],
  ["'WBS line outdented.'", 't.wbsOutdented'],
  ["'WBS line moved up.'", 't.wbsMovedUp'],
  ["'WBS line moved down.'", 't.wbsMovedDown'],
  ["'The WBS line could not be deleted.'", 't.wbsDeleteFailed'],
]
for (const [from, to] of literals) source = source.replaceAll(from, to)

const jsx = [
  ['>WBS<', '>{t.wbs}<'], ['>Summary<', '>{t.summary}<'], ['>Milestone<', '>{t.milestone}<'], ['>Task<', '>{t.task}<'],
  ['>Insert row<', '>{t.insertRow}<'], ['>Name<', '>{t.name}<'], ['>Duration<', '>{t.duration}<'], ['>Actions<', '>{t.actions}<'],
  ['>Add<', '>{t.add}<'], ['>Cancel<', '>{t.cancel}<'], ['>Delete<', '>{t.delete}<'], ['>Save<', '>{t.save}<'],
]
for (const [from, to] of jsx) source = source.replaceAll(from, to)

for (const token of ['get{t.', 'selected{t.', 'item{t.', 'set{t.', 'handle{t.']) {
  if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
}

fs.writeFileSync(path, source)
console.log(`Wired Pre-Planning WBS i18n safely: ${path}`)
