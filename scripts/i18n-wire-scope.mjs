import fs from 'node:fs'

const path = 'src/app/dashboard/projects/setup/ScopeWorkspace.js'
let s = fs.readFileSync(path, 'utf8')

const once = (from, to) => {
  if (!s.includes(from)) throw new Error(`Scope i18n migration: pattern not found: ${from.slice(0, 100)}`)
  s = s.replace(from, to)
}

once("import { createClient } from '../../../../lib/supabase/client'", "import { createClient } from '../../../../lib/supabase/client'\nimport { getScopeWorkspaceCopy, interpolateScopeCopy } from '../../../../i18n/scopeWorkspace'")

once("function getErrorMessage(error) {\n  if (!error) {\n    return 'An unexpected error occurred.'\n  }", "function getErrorMessage(error, t) {\n  if (!error) {\n    return t.unexpectedError\n  }")
once("return 'A record with the same identifying information already exists.'", "return t.duplicateRecord")
once("return 'This record is already referenced by other project information and cannot be deleted.'", "return t.referencedRecord")
once("return 'One or more values do not satisfy the project scope rules.'", "return t.invalidScopeRules")
once("return 'Your account does not have permission to perform this action.'", "return t.permissionDenied")
once("error.message ||\n    'The requested operation could not be completed.'", "error.message ||\n    t.operationFailed")

s = s.replace("function formatCurrency(value, currencyCode = 'USD') {", "function formatCurrency(value, currencyCode = 'USD', locale = 'en-US') {")
s = s.replaceAll("new Intl.NumberFormat('en-US', {", "new Intl.NumberFormat(locale, {")
s = s.replace("function formatQuantity(value) {", "function formatQuantity(value, locale = 'en-US') {")
s = s.replace("    'en-US',\n    {\n      minimumFractionDigits: 0,", "    locale,\n    {\n      minimumFractionDigits: 0,")

once("  currencyCode = 'USD',\n}) {", "  currencyCode = 'USD',\n  locale = 'en-US',\n}) {\n  const t = getScopeWorkspaceCopy(locale)\n  const tx = (key, variables = {}) => interpolateScopeCopy(t[key], variables)")

const literals = new Map([
  ["'Work Package code must contain exactly three letters.'", 't.wpCodeThreeLetters'],
  ["'Enter a Work Package description.'", 't.enterWpDescription'],
  ["'Enter a Scope Item description.'", 't.enterScopeDescription'],
  ["'Select a Work Package.'", 't.selectWpError'],
  ["'Enter a custom unit.'", 't.enterCustomUnit'],
  ["'Enter a valid Scope Quantity greater than or equal to zero.'", 't.invalidQuantity'],
  ["'Enter a valid Unit Cost greater than or equal to zero.'", 't.invalidUnitCost'],
  ["'A Scope Item with this description already exists in the project.'", 't.duplicateScopeDescription'],
  ["'A Scope Item with this code already exists in the project.'", 't.duplicateScopeCode'],
  ["'Scope Item was assigned to its Work Package.'", 't.assignedNotice'],
])
for (const [from, to] of literals) s = s.replaceAll(from, to)

s = s.replaceAll('getErrorMessage(\n          colorError\n        )', 'getErrorMessage(\n          colorError,\n          t\n        )')
s = s.replaceAll('getErrorMessage(\n          error\n        )', 'getErrorMessage(\n          error,\n          t\n        )')

s = s.replace('`Work Package ${normalizedCode} already exists in this project.`', "tx('duplicateWp', { code: normalizedCode })")
s = s.replace('`${data.code} — ${data.description} was added to the project scope.`', "tx('wpAdded', { code: data.code, description: data.description })")
s = s.replace(/`\$\{workPackage\.code\} cannot be deleted because \$\{relatedScopeItems\.length\} Scope \$\{[\s\S]*?\} still assigned to it\. Reassign those Scope Items first\.`/, "tx('wpHasItems', { code: workPackage.code, count: relatedScopeItems.length, itemWord: relatedScopeItems.length === 1 ? t.itemIs : t.itemsAre })")
s = s.replace('`Delete Work Package "${workPackage.code} — ${workPackage.description}"?\\n\\nThis permanently removes the Work Package from the project scope.`', "tx('confirmDeleteWp', { code: workPackage.code, description: workPackage.description })")
s = s.replace('`${workPackage.code} — ${workPackage.description} was deleted from the project scope.`', "tx('wpDeleted', { code: workPackage.code, description: workPackage.description })")
s = s.replace('`${data.service_name} was updated.`', "tx('scopeUpdated', { name: data.service_name })")
s = s.replace('`${data.service_name} was added to the project scope.`', "tx('scopeAdded', { name: data.service_name })")
s = s.replace('`Archive "${scopeItem.service_name}"? Existing planning, quantity, and production records will remain connected to this Scope Item.`', "tx('confirmArchive', { name: scopeItem.service_name })")
s = s.replace('`${scopeItem.service_name} was archived from the active project scope.`', "tx('scopeArchived', { name: scopeItem.service_name })")

const jsx = [
  ['Work Packages', '{t.workPackages}'], ['Active scope groups', '{t.activeScopeGroups}'], ['Scope Items', '{t.scopeItems}'], ['Project deliverables', '{t.projectDeliverables}'], ['Package Assignment', '{t.packageAssignment}'], ['Scope Items classified', '{t.scopeItemsClassified}'], ['Scope Cost', '{t.scopeCost}'], ['Scope Definition', '{t.scopeDefinition}'], ['Project Scope', '{t.projectScope}'], ['+ Work Package', '{t.addWorkPackage}'], ['+ Scope Item', '{t.addScopeItem}'], ['Start the Scope Breakdown Structure.', '{t.startSbs}'], ['+ Create first Work Package', '{t.createFirstWorkPackage}'], ['+ Add Scope Item', '{t.addScopeItemButton}'], ['No Scope Items have been\n                        assigned to this Work\n                        Package.', '{t.noScopeItemsAssigned}'], ['Scope Item', '{t.scopeItem}'], ['Unit', '{t.unit}'], ['Scope Quantity', '{t.scopeQuantity}'], ['Unit Cost', '{t.unitCost}'], ['Total Cost', '{t.totalCost}'], ['Status', '{t.status}'], ['Actions', '{t.actions}'], ['Edit', '{t.edit}'], ['Archive', '{t.archive}'], ['UNASSIGNED', '{t.unassigned}'], ['Scope Items requiring\n                        classification', '{t.classificationRequired}'], ['Assign...', '{t.assign}'], ['Scope Breakdown Structure', '{t.sbs}'], ['Add Work Package', '{t.addWorkPackageTitle}'], ['Work Package code', '{t.workPackageCode}'], ['Exactly three letters.', '{t.exactlyThreeLetters}'], ['Description', '{t.description}'], ['Cancel', '{t.cancel}'], ['Edit Scope Item', '{t.editScopeItem}'], ['Add Scope Item', '{t.addScopeItemTitle}'], ['Work Package', '{t.workPackage}'], ['Select Work Package', '{t.selectWorkPackage}'], ['Scope Item description', '{t.scopeItemDescription}'], ['Scope Item code', '{t.scopeItemCode}'], ['Other...', '{t.other}'], ['Custom unit', '{t.customUnit}'], ['Example: box', '{t.exampleCustomUnit}'], ['Save Scope Item', '{t.saveScopeItem}'], ['Saving...', '{t.saving}'], ['Deleting...', '{t.deleting}'], ['Delete', '{t.delete}'], ['Complete', '{t.complete}'], ['Incomplete', '{t.incomplete}'], ['READY', '{t.ready}'], ['ACTION REQUIRED', '{t.actionRequired}'], ['No code', '{t.noCode}'], ['Close notification', '{t.closeNotification}'], ['Close modal', '{t.closeModal}']
]
for (const [from, to] of jsx) s = s.replaceAll(`>${from}<`, `>${to}<`)

s = s.replace(/>\s*Define Work Packages and the Scope Items\s*contained within each package\. Work Packages\s*represent scope\. Planning buffers and time lags\s*are managed by the scheduling model rather than\s*the Scope Breakdown Structure\.\s*</, `>{t.projectScopeHelp}<`)
s = s.replace(/>\s*Create the first Work Package,\s*then add the Scope Items that\s*define what the project must\s*deliver\.\s*</, `>{t.startSbsHelp}<`)
s = s.replace(/>\s*Work Packages are the first\s*organizational level of the\s*project Scope Breakdown Structure\.\s*Buffers and scheduling lags are\s*defined separately in Planning\.\s*</, `>{t.workPackageHelp}<`)
s = s.replace(/>\s*A Scope Item is a measurable\s*project deliverable or production\s*operation belonging to a Work\s*Package\.\s*</, `>{t.scopeItemHelp}<`)
s = s.replace(/>\s*Authoritative project\s*quantity for this Scope Item\.\s*</, `>{t.authoritativeQuantity}<`)
s = s.replace(/>\s*Calculated automatically from Quantity × Unit Cost\.\s*</, `>{t.calculatedTotal}<`)

s = s.replaceAll("aria-label=\"Close notification\"", 'aria-label={t.closeNotification}')
s = s.replaceAll("aria-label=\"Close modal\"", 'aria-label={t.closeModal}')
s = s.replaceAll("? 'Reassign Scope Items before deleting this Work Package.'\n                              : 'Delete Work Package'", '? t.reassignBeforeDelete\n                              : t.deleteWpTitle')
s = s.replaceAll("scopeItem.service_code ||\n                                      'No code'", 'scopeItem.service_code ||\n                                      t.noCode')
s = s.replaceAll("scopeItem.service_code ||\n                                'No code'", 'scopeItem.service_code ||\n                                t.noCode')
s = s.replaceAll("formatQuantity(\n                                    scopeItem.scope_quantity\n                                  )", "formatQuantity(\n                                    scopeItem.scope_quantity,\n                                    locale\n                                  )")
s = s.replaceAll("formatQuantity(\n                              scopeItem.scope_quantity\n                            )", "formatQuantity(\n                              scopeItem.scope_quantity,\n                              locale\n                            )")
s = s.replaceAll("currencyCode\n            )", "currencyCode,\n              locale\n            )")
s = s.replaceAll("currencyCode\n                          )", "currencyCode,\n                            locale\n                          )")
s = s.replaceAll("currencyCode\n                                  )", "currencyCode,\n                                    locale\n                                  )")
s = s.replaceAll("currencyCode\n                                      )", "currencyCode,\n                                        locale\n                                      )")
s = s.replaceAll("currencyCode\n                      )", "currencyCode,\n                        locale\n                      )")
s = s.replace("{costDefinedCount}/{activeScopeItems.length} Scope Items costed", "{costDefinedCount}/{activeScopeItems.length} {t.scopeItemsCosted}")
s = s.replace("{packageItems.length === 1\n                            ? 'Scope Item'\n                            : 'Scope Items'}", "{packageItems.length === 1\n                            ? t.scopeItem\n                            : t.scopeItems}")
s = s.replace("{scopeDefinitionComplete\n              ? 'Complete'\n              : 'Incomplete'}", "{scopeDefinitionComplete\n              ? t.complete\n              : t.incomplete}")
s = s.replace("{scopeDefinitionComplete\n            ? 'READY'\n            : 'ACTION REQUIRED'}", "{scopeDefinitionComplete\n            ? t.ready\n            : t.actionRequired}")
s = s.replace("{isComplete\n                                    ? 'Complete'\n                                    : 'Incomplete'}", "{isComplete\n                                    ? t.complete\n                                    : t.incomplete}")
s = s.replace("} {' '}\n                    items", "} {' '}\n                    {t.items}")
s = s.replace("{unit === 'OTHER'\n                          ? 'Other...'\n                          : unit}", "{unit === 'OTHER'\n                          ? t.other\n                          : unit}")
s = s.replace("scopeItemForm.custom_unit || 'unit'", "scopeItemForm.custom_unit || t.genericUnit")
s = s.replace("Cost per {scopeItemForm.unit === 'OTHER'\n                    ? scopeItemForm.custom_unit || t.genericUnit\n                    : scopeItemForm.unit}.", "{tx('costPer', { unit: scopeItemForm.unit === 'OTHER' ? scopeItemForm.custom_unit || t.genericUnit : scopeItemForm.unit })}")
s = s.replace("? 'Saving...'\n                  : 'Add Work Package'", "? t.saving\n                  : t.addWorkPackageTitle")
s = s.replace("? 'Saving...'\n                  : scopeItemForm.id\n                    ? 'Save Scope Item'\n                    : 'Add Scope Item'", "? t.saving\n                  : scopeItemForm.id\n                    ? t.saveScopeItem\n                    : t.addScopeItemTitle")

// Locale must also govern sorting and every remaining currency call.
s = s.replaceAll(").localeCompare(\n                String(", ").localeCompare(\n                String(")

fs.writeFileSync(path, s)
console.log('ScopeWorkspace i18n wiring applied successfully.')
