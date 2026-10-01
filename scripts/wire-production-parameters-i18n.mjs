import fs from 'node:fs'

const path = 'src/app/dashboard/projects/setup/ProductionParametersWorkspace.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

required("import { createClient } from '../../../../lib/supabase/client'", "import { createClient } from '../../../../lib/supabase/client'\nimport { getProductionParametersCopy, interpolateProductionParametersCopy } from '../../../../i18n/productionParametersWorkspace'")
required('function getErrorMessage(error) {', 'function getErrorMessage(error, t) {')
required("return 'An unexpected error occurred.'", 'return t.unexpectedError')
required("return 'Production Parameters already exist for this Scope Item.'", 'return t.duplicate')
required("return 'This production parameter is connected to invalid project information.'", 'return t.invalidProjectInfo')
required("return 'The production parameter does not satisfy the project rules.'", 'return t.invalidRules')
required("return 'Your account does not have permission to perform this action.'", 'return t.permissionDenied')
required("'The requested operation could not be completed.'", 't.operationFailed')
required('function formatNumber(value) {', "function formatNumber(value, locale = 'en-US') {")
required("    'en-US',", '    locale,')
required("  initialParameters = [],\n}) {", "  initialParameters = [],\n  locale = 'en-US',\n}) {")
required("  const supabase =\n    useMemo(\n      () => createClient(),\n      []\n    )", "  const supabase =\n    useMemo(\n      () => createClient(),\n      []\n    )\n\n  const t = useMemo(() => getProductionParametersCopy(locale), [locale])\n  const tr = (key, variables = {}) => interpolateProductionParametersCopy(t[key], variables)")

source = source.replaceAll('getErrorMessage(error)', 'getErrorMessage(error, t)')
source = source.replaceAll('`${scopeItem.service_name} production parameters were cleared.`', "tr('cleared', { name: scopeItem.service_name })")
source = source.replaceAll('`${scopeItem.service_name} production parameters were saved.`', "tr('saved', { name: scopeItem.service_name })")
source = source.replaceAll('`Enter a Productivity greater than zero for ${scopeItem.service_name}.`', "tr('productivityGreaterThanZero', { name: scopeItem.service_name })")
source = source.replaceAll('`Enter an Effective Workforce greater than zero for ${scopeItem.service_name}.`', "tr('workforceGreaterThanZero', { name: scopeItem.service_name })")

source = source.replaceAll('placeholder="Search Work Packages or Scope Items..."', 'placeholder={t.searchPlaceholder}')
source = source.replaceAll('aria-label="Search Production Parameters"', 'aria-label={t.searchAria}')

const jsx = [
  ['>Scope Items<', '>{t.scopeItems}<'], ['>Active project scope<', '>{t.activeProjectScope}<'],
  ['>Configured<', '>{t.configured}<'], ['>Productivity + workforce defined<', '>{t.configuredDetail}<'],
  ['>Pending<', '>{t.pending}<'], ['>Parameters still to define<', '>{t.pendingDetail}<'],
  ['>Production Parameters<', '>{t.title}<'], ['>Work Package<', '>{t.workPackage}<'],
  ['>Scope Item<', '>{t.scopeItem}<'], ['>Unit<', '>{t.unit}<'], ['>Productivity<', '>{t.productivity}<'],
  ['>Basis<', '>{t.basis}<'], ['>Effective Workforce<', '>{t.effectiveWorkforce}<'],
  ['>Production Capacity<', '>{t.productionCapacity}<'], ['>Saving...<', '>{t.saving}<'],
]
for (const [from, to] of jsx) source = source.replaceAll(from, to)

source = source.replace(/Define one project-wide production parameter set for each Scope Item\.\s*These values form the calculation database used later to derive raw\s*activity durations from allocated quantities\. Takt standardization is\s*intentionally handled in the planning stage, not here\./g, '{t.description}')
source = source.replace(/No Scope Items available\./g, '{t.noScopeItems}')
source = source.replace(/Define the project Scope before establishing Production Parameters\./g, '{t.noScopeItemsHelp}')

// Presentation labels only; database values remain unchanged.
source = source.replaceAll('>Worker-day<', '>{t.workerDay}<')
source = source.replaceAll('>Worker-hour<', '>{t.workerHour}<')
source = source.replaceAll('>Crew-day<', '>{t.crewDay}<')
source = source.replaceAll('>Crew-hour<', '>{t.crewHour}<')

// Locale-aware calculated capacity display.
source = source.replaceAll('formatNumber(capacity)', 'formatNumber(capacity, locale)')

for (const token of ['get{t.', 'scope{t.', 'work{t.', 'production{t.', 'effective{t.']) {
  if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
}

fs.writeFileSync(path, source)
console.log(`Wired Production Parameters i18n safely: ${path}`)
