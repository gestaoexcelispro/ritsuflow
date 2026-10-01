import fs from 'node:fs'

const path = 'src/app/dashboard/projects/setup/QuantityAllocationMatrix.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 100)}`)
  source = source.replace(from, to)
}

required("import { createClient } from '../../../../lib/supabase/client'", "import { createClient } from '../../../../lib/supabase/client'\nimport { getQuantityAllocationCopy } from '../../../../i18n/quantityAllocationMatrix'")
required("function getErrorMessage(error) {", "function getErrorMessage(error, t) {")
required("return 'An unexpected error occurred.'", "return t.unexpectedError")
required("return 'A quantity record with the same identifying information already exists.'", "return t.duplicateQuantity")
required("return 'This quantity is connected to other project information and cannot be changed.'", "return t.connectedQuantity")
required("return 'The quantity does not satisfy the project allocation rules.'", "return t.invalidAllocationRules")
required("return 'Your account does not have permission to perform this action.'", "return t.permissionDenied")
required("'The requested operation could not be completed.'", "t.operationFailed")

required("function getLocationTypeLabel(locationType) {", "function getLocationTypeLabel(locationType, t) {")
required("  const labels = {\n    building: 'Building',\n    floor: 'Floor',\n    zone: 'Zone',\n    area: 'Area',\n    room: 'Room',\n    custom: 'Custom',\n  }", "  const labels = t.locationTypes")
required("    'Location'\n  )\n}\n\n\nfunction getZoneColor", "    t.location\n  )\n}\n\n\nfunction getZoneColor")
required("function formatQuantity(value) {", "function formatQuantity(value, locale = 'en-US') {")
required("    'en-US',", "    locale,")
required("  initialAllocations = [],\n}) {", "  initialAllocations = [],\n  locale = 'en-US',\n}) {")
required("  const supabase =\n    useMemo(\n      () => createClient(),\n      []\n    )", "  const supabase =\n    useMemo(\n      () => createClient(),\n      []\n    )\n\n  const t = useMemo(() => getQuantityAllocationCopy(locale), [locale])")

// Function calls: target complete call shapes only. Never replace generic words globally.
source = source.replaceAll("getErrorMessage(\n            error\n          )", "getErrorMessage(\n            error,\n            t\n          )")
source = source.replaceAll("getErrorMessage(\n          error\n        )", "getErrorMessage(\n          error,\n          t\n        )")
source = source.replaceAll("getLocationTypeLabel(\n                                location.location_type\n                              )", "getLocationTypeLabel(\n                                location.location_type,\n                                t\n                              )")
source = source.replaceAll("formatQuantity(\n                              scopeItem.scope_quantity\n                            )", "formatQuantity(\n                              scopeItem.scope_quantity,\n                              locale\n                            )")

for (const [from, to] of [
  ["'Allocation quantity was cleared.'", 't.quantityCleared'],
  ["'Allocation quantity was updated.'", 't.quantityUpdated'],
  ["'Allocation quantity was saved.'", 't.quantitySaved'],
  ["'Enter a valid quantity greater than or equal to zero.'", 't.invalidQuantity'],
]) source = source.replaceAll(from, to)

// Attribute values are safe exact targets.
source = source.replaceAll('placeholder="Search locations or Scope Items..."', 'placeholder={t.searchPlaceholder}')
source = source.replaceAll('aria-label="Filter allocation matrix by division"', 'aria-label={t.filterDivision}')

// Visible JSX text: replacements include element boundaries so identifiers such as
// getLocationTypeLabel/getZoneColor/locationType can never be modified.
const jsxText = [
  ['>Scope Allocation Matrix<', '>{t.title}<'],
  ['>All divisions<', '>{t.allDivisions}<'],
  ['>Location<', '>{t.location}<'],
  ['>Type<', '>{t.type}<'],
  ['>Division<', '>{t.division}<'],
  ['>Zone<', '>{t.zone}<'],
  ['>Saving...<', '>{t.saving}<'],
]
for (const [from, to] of jsxText) source = source.replaceAll(from, to)

source = source.replaceAll("Scope:{' '}", "{t.scope}:{' '}")
source = source.replace(/No Scope Items\s+available\./g, '{t.noScopeItems}')
source = source.replace(/No production\s+locations available\./g, '{t.noLocations}')
source = source.replace(/Distribute each Scope Item quantity across the\s*project&apos;s production locations\. Scope Quantity\s*remains authoritative and the reconciliation above\s*updates after each saved allocation\./g, '{t.description}')
source = source.replace(/Define the project\s*Scope Breakdown\s*Structure before\s*allocating quantities\./g, '{t.noScopeItemsHelp}')
source = source.replace(/Define the physical\s*production hierarchy\s*before allocating Scope\s*Item quantities\./g, '{t.noLocationsHelp}')

// Guardrails: fail before writing if a translation expression ever enters an identifier.
const forbidden = [
  'get{t.',
  'location{t.',
  'scope{t.',
  'selected{t.',
  'grouped{t.',
]
for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
}

fs.writeFileSync(path, source)
console.log(`Wired Allocation i18n safely: ${path}`)
