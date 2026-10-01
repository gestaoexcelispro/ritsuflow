import fs from 'node:fs'

const path = 'src/app/dashboard/projects/setup/QuantityAllocationMatrix.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 100)}`)
  source = source.replace(from, to)
}

required("import { createClient } from '../../../../lib/supabase/client'", "import { createClient } from '../../../../lib/supabase/client'\nimport { getQuantityAllocationCopy } from '../../../../i18n/quantityAllocationMatrix'")
required("function getErrorMessage(error) {", "function getErrorMessage(error, t) {")
source = source.replace("return 'An unexpected error occurred.'", "return t.unexpectedError")
source = source.replace("return 'A quantity record with the same identifying information already exists.'", "return t.duplicateQuantity")
source = source.replace("return 'This quantity is connected to other project information and cannot be changed.'", "return t.connectedQuantity")
source = source.replace("return 'The quantity does not satisfy the project allocation rules.'", "return t.invalidAllocationRules")
source = source.replace("return 'Your account does not have permission to perform this action.'", "return t.permissionDenied")
source = source.replace("'The requested operation could not be completed.'", "t.operationFailed")

required("function getLocationTypeLabel(locationType) {", "function getLocationTypeLabel(locationType, t) {")
required("  const labels = {\n    building: 'Building',\n    floor: 'Floor',\n    zone: 'Zone',\n    area: 'Area',\n    room: 'Room',\n    custom: 'Custom',\n  }", "  const labels = t.locationTypes")
source = source.replace("    'Location'", "    t.location")
required("function formatQuantity(value) {", "function formatQuantity(value, locale = 'en-US') {")
required("    'en-US',", "    locale,")
required("  initialAllocations = [],\n}) {", "  initialAllocations = [],\n  locale = 'en-US',\n}) {")
required("  const supabase =\n    useMemo(\n      () => createClient(),\n      []\n    )", "  const supabase =\n    useMemo(\n      () => createClient(),\n      []\n    )\n\n  const t = useMemo(() => getQuantityAllocationCopy(locale), [locale])")

source = source.replaceAll("getErrorMessage(\n            error\n          )", "getErrorMessage(\n            error,\n            t\n          )")
source = source.replaceAll("getErrorMessage(\n          error\n        )", "getErrorMessage(\n          error,\n          t\n        )")
source = source.replaceAll("getLocationTypeLabel(\n                                location.location_type\n                              )", "getLocationTypeLabel(\n                                location.location_type,\n                                t\n                              )")
source = source.replaceAll("formatQuantity(\n                              scopeItem.scope_quantity\n                            )", "formatQuantity(\n                              scopeItem.scope_quantity,\n                              locale\n                            )")
source = source.replaceAll("formatQuantity(\n", "formatQuantity(\n")

const simple = [
  ["'Allocation quantity was cleared.'", 't.quantityCleared'],
  ["'Allocation quantity was updated.'", 't.quantityUpdated'],
  ["'Allocation quantity was saved.'", 't.quantitySaved'],
  ["'Enter a valid quantity greater than or equal to zero.'", 't.invalidQuantity'],
]
for (const [a,b] of simple) source = source.replaceAll(a,b)

const jsx = [
  ['Scope Allocation Matrix', '{t.title}'],
  ['Search locations or Scope Items...', '{t.searchPlaceholder}'],
  ['All divisions', '{t.allDivisions}'],
  ['No Scope Items\n            available.', '{t.noScopeItems}'],
  ['No production\n            locations available.', '{t.noLocations}'],
  ['Location', '{t.location}'],
  ['Type', '{t.type}'],
  ['Division', '{t.division}'],
  ['Zone', '{t.zone}'],
  ["Scope:{' '}", "{t.scope}:{' '}"],
  ['Saving...', '{t.saving}'],
]
for (const [a,b] of jsx) source = source.replaceAll(a,b)
source = source.replace('placeholder="Search locations or Scope Items..."', 'placeholder={t.searchPlaceholder}')
source = source.replace('aria-label="Filter allocation matrix by division"', 'aria-label={t.filterDivision}')

// Multi-line descriptive/empty-state copy.
source = source.replace(/Distribute each Scope Item quantity across the\n\s*project&apos;s production locations\. Scope Quantity\n\s*remains authoritative and the reconciliation above\n\s*updates after each saved allocation\./, '{t.description}')
source = source.replace(/Define the project\n\s*Scope Breakdown\n\s*Structure before\n\s*allocating quantities\./, '{t.noScopeItemsHelp}')
source = source.replace(/Define the physical\n\s*production hierarchy\n\s*before allocating Scope\n\s*Item quantities\./, '{t.noLocationsHelp}')

fs.writeFileSync(path, source)
console.log(`Wired Allocation i18n: ${path}`)
