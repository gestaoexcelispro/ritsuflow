import fs from 'node:fs'

const path = 'src/app/dashboard/projects/setup/LocationWorkspace.js'
let source = fs.readFileSync(path, 'utf8')

function replaceOnce(from, to) {
  if (!source.includes(from)) throw new Error(`Expected source fragment not found: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

replaceOnce("import { createClient } from '../../../../lib/supabase/client'", "import { createClient } from '../../../../lib/supabase/client'\nimport { getLocationWorkspaceCopy, interpolateLocationCopy } from '../../../../i18n/locationWorkspace'")
replaceOnce("function getErrorMessage(error) {\n  if (!error) return 'An unexpected error occurred.'\n  if (error.code === '23505') return 'A location with the same identifying information already exists.'\n  if (error.code === '23503') return 'This record is connected to other project information and cannot be changed.'\n  if (error.code === '23514') return 'One or more values do not satisfy the location structure rules.'\n  if (error.code === '42501') return 'Your account does not have permission to perform this action.'\n  return error.message || 'The requested operation could not be completed.'\n}", "function getErrorMessage(error, t) {\n  if (!error) return t.unexpectedError\n  if (error.code === '23505') return t.duplicateLocation\n  if (error.code === '23503') return t.connectedRecord\n  if (error.code === '23514') return t.invalidRules\n  if (error.code === '42501') return t.permissionDenied\n  return error.message || t.operationFailed\n}")
replaceOnce("function locationTypeLabel(value) {\n  return locationTypes.find((item) => item.value === value)?.label || value || 'Location'\n}", "function locationTypeLabel(value, t) {\n  return t.locationTypes?.[value] || value || t.location\n}")
replaceOnce("function formatQuantity(value) {", "function formatQuantity(value, locale = 'en-US') {")
replaceOnce("return new Intl.NumberFormat('en-US', {", "return new Intl.NumberFormat(locale, {")
replaceOnce("  allocations = [],\n}) {", "  allocations = [],\n  locale = 'en-US',\n}) {")
replaceOnce("  const supabase = useMemo(() => createClient(), [])", "  const supabase = useMemo(() => createClient(), [])\n  const t = useMemo(() => getLocationWorkspaceCopy(locale), [locale])\n  const tr = (key, variables = {}) => interpolateLocationCopy(t[key], variables)")

const replacements = [
  ["setErrorMessage('Enter a location name.')", "setErrorMessage(t.enterLocationName)"],
  ["setErrorMessage('A location cannot be its own parent.')", "setErrorMessage(t.ownParent)"],
  ["getErrorMessage(result.error)", "getErrorMessage(result.error, t)"],
  ["getErrorMessage(error)", "getErrorMessage(error, t)"],
  ["setNoticeMessage(`${result.data.name} was updated.`)", "setNoticeMessage(tr('updated', { name: result.data.name }))"],
  ["setNoticeMessage(`${result.data.name} was added to the location structure.`)", "setNoticeMessage(tr('added', { name: result.data.name }))"],
  ["locationTypeLabel(location.location_type)", "locationTypeLabel(location.location_type, t)"],
  ["formatQuantity(scopeItem.allocatedQuantity)", "formatQuantity(scopeItem.allocatedQuantity, locale)"],
]
for (const [from, to] of replacements) source = source.split(from).join(to)

// Dynamic deletion confirmation.
source = source.replace(/descendants\.size > 0\n\s*\? `Delete \$\{location\.name\}\? This will also delete \$\{descendants\.size\} contained location\$\{descendants\.size === 1 \? '' : 's'\}\. This action cannot be undone\.`\n\s*: `Delete \$\{location\.name\}\? This action cannot be undone\.`/, "descendants.size > 0\n        ? tr('deleteTree', { name: location.name, count: descendants.size, locationWord: descendants.size === 1 ? t.containedLocation : t.containedLocations })\n        : tr('deleteSingle', { name: location.name })")
source = source.replace(/setNoticeMessage\(`\$\{location\.name\} was deleted from the location structure\.`\)/g, "setNoticeMessage(tr('deleted', { name: location.name }))")

// Translate common visible literals without touching stored database values.
const literals = new Map([
  ['Location Structure', '{t.locationStructure}'],
  ['Search locations...', '{t.searchPlaceholder}'],
  ['No locations have been created yet.', '{t.noLocations}'],
  ['+ Create first Location', '{t.createFirstLocation}'],
  ['No production locations in this group.', '{t.noProductionLocations}'],
  ['Scope Quantities', '{t.scopeQuantities}'],
  ['No allocated scope quantities for this location.', '{t.noAllocatedScope}'],
  ['Environment Type', '{t.environmentType}'],
  ['Sequence', '{t.sequence}'],
  ['Actions', '{t.actions}'],
  ['Saving...', '{t.saving}'],
  ['Cancel', '{t.cancel}'],
  ['Save', '{t.save}'],
  ['Create', '{t.create}'],
  ['Edit Location', '{t.editLocation}'],
  ['Create Location', '{t.createLocation}'],
])
for (const [literal, expr] of literals) {
  source = source.replaceAll(`>${literal}<`, `>${expr}<`)
  source = source.replaceAll(`placeholder=\"${literal}\"`, `placeholder={t.searchPlaceholder}`)
}

// Location type option labels are presentation-only; values remain stable English keys.
source = source.replace(/\{locationTypes\.map\(\(item\) => \(\s*<option key=\{item\.value\} value=\{item\.value\}>\s*\{item\.label\}\s*<\/option>\s*\)\)\}/g, "{locationTypes.map((item) => (\n                  <option key={item.value} value={item.value}>\n                    {t.locationTypes?.[item.value] || item.label}\n                  </option>\n                ))}")

fs.writeFileSync(path, source)
console.log(`Wired LocationWorkspace i18n: ${path}`)
