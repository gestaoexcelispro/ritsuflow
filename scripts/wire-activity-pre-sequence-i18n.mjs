import fs from 'node:fs'

const path = 'src/app/dashboard/planning/pre-planning/ActivityPreSequence.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

required("} from 'react'", "} from 'react'\nimport { getPrePlanningCopy, interpolatePrePlanningCopy } from '../../../../i18n/prePlanning'")
required('  initialItems,\n}) {', "  initialItems,\n  locale = 'en-US',\n}) {")
required('  const [items, setItems] =', '  const t = useMemo(() => getPrePlanningCopy(locale), [locale])\n\n  const [items, setItems] =')
required("        'The activity sequence could not be saved.'", '        t.activitySequenceSaveFailed')
required('        No active Scope Items are available for sequencing.', '        {t.noActiveScopeItemsForSequencing}')
required('            Production rule:', '            {t.productionRule}:')
required('          one layer follows the previous layer. Activities inside the same layer may be performed in parallel.', '          {t.productionRuleHelp}')
required("            ? 'Saving sequence…'\n            : saveState === 'saved'\n              ? 'Sequence saved'\n              : saveState === 'error'\n                ? 'Save failed'\n                : 'Autosave enabled'", "            ? t.savingSequence\n            : saveState === 'saved'\n              ? t.sequenceSavedShort\n              : saveState === 'error'\n                ? t.saveFailed\n                : t.autosaveEnabled")
required('        Drop an activity <strong>inside a layer</strong> to make it parallel with that layer. Drop it on the <strong>gap between layers</strong> to create a separate production layer.', '        {t.dropActivityPrefix} <strong>{t.insideLayer}</strong> {t.dropActivityParallel} <strong>{t.gapBetweenLayers}</strong> {t.dropActivitySeparateLayer}')
required('                      Production Layer', '                      {t.productionLayer}')
required("                    {layer.items.length > 1\n                      ? `${layer.items.length} activities · parallel allowed`\n                      : '1 activity'}", "                    {layer.items.length > 1\n                      ? interpolatePrePlanningCopy(t.activitiesParallelAllowed, { count: layer.items.length })\n                      : t.oneActivity}")
required('                          title="Hold and drag"', '                          title={t.holdAndDrag}')
required('                          aria-label={`Drag ${item.code} ${item.description}`}', '                          aria-label={interpolatePrePlanningCopy(t.dragActivity, { code: item.code, description: item.description })}')

for (const token of ['get{t.', 'set{t.', 'item{t.', 'layer{t.', 'save{t.']) {
  if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
}

fs.writeFileSync(path, source)
console.log(`Wired Activity Pre-Sequence i18n safely: ${path}`)
