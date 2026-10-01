import fs from 'node:fs'

const path = 'src/app/dashboard/planning/master-plan/page.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

if (!source.includes("import { getMasterPlanCopy } from '../../../../i18n/masterPlan';")) {
  required("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\nimport { getMasterPlanCopy } from '../../../../i18n/masterPlan';")
}
if (!source.includes("import { getMasterPlanPortfolioCopy } from '../../../../i18n/masterPlanPortfolio';")) {
  required("import { getMasterPlanCopy } from '../../../../i18n/masterPlan';", "import { getMasterPlanCopy } from '../../../../i18n/masterPlan';\nimport { getMasterPlanPortfolioCopy } from '../../../../i18n/masterPlanPortfolio';")
}

if (!source.includes("const [locale, setLocale] = useState('en-US');")) {
  const start = source.indexOf('  const t = {', source.indexOf('export default function MasterPlanPage()'))
  if (start < 0) throw new Error('Master Plan local translation object start was not found.')
  const endMarker = '\n  };\n\n  const [projects, setProjects]'
  const end = source.indexOf(endMarker, start)
  if (end < 0) throw new Error('Master Plan local translation object end was not found.')
  source = source.slice(0, start) + "  const [locale, setLocale] = useState('en-US');\n  const t = { ...getMasterPlanCopy(locale), ...getMasterPlanPortfolioCopy(locale) };\n" + source.slice(end + '\n  };\n'.length)
} else {
  source = source.replace('const t = getMasterPlanCopy(locale);', 'const t = { ...getMasterPlanCopy(locale), ...getMasterPlanPortfolioCopy(locale) };')
}

if (!source.includes('async function loadOrganizationLocale()')) {
  required('  const [projects, setProjects] = useState([]);', `  const [projects, setProjects] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadOrganizationLocale() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle();
        if (!membership?.organization_id) return;
        const { data: organization } = await supabase.from('organizations').select('locale').eq('id', membership.organization_id).maybeSingle();
        const nextLocale = organization?.locale;
        if (active && ['en-US', 'pt-BR', 'es'].includes(nextLocale)) setLocale(nextLocale);
      } catch (error) {
        console.warn('Master Plan locale fallback to en-US.', error);
      }
    }
    loadOrganizationLocale();
    return () => { active = false; };
  }, []);`)
}

source = source.replace("      'en-US',\n      {", "      locale,\n      {")
source = source.replaceAll("'PROJECT LOCATIONS'", 't.projectLocations')

const literalReplacements = [
  ['PLANNING &amp; PRODUCTION CONTROL', '{t.portfolioEyebrow}'], ['>Master Plan<', '>{t.portfolioTitle}<'], ['Select a project to access its Master Plan.', '{t.portfolioHelp}'], ['No projects are available for Master Plan.', '{t.portfolioEmpty}'], ['PROJECT COVER', '{t.projectCover}'], ["{project.code || 'UNASSIGNED'}", '{project.code || t.unassigned}'], ['>PROJECT<', '>{t.projectLabel}<'], ["{project.client_name || 'Client not assigned'}", '{project.client_name || t.clientNotAssigned}'], ["{locationText || project.country_code || 'Location not assigned'}", '{locationText || project.country_code || t.locationNotAssigned}'], ['>Overall Progress<', '>{t.overallProgress}<'], ["'Production Control data not available yet.'", 't.productionDataUnavailable'], ["'Production scope available. Field production has not started yet.'", 't.productionNotStarted'], ['<span>Open Project</span>', '<span>{t.openProject}</span>'], ["alt={`${project.name} project`}", 'alt={`${project.name} ${t.projectImageSuffix}`}'],
  ['>MASTER PLAN<', '>{t.masterPlanLabel}<'], ['<span>ACTIVITY</span>', '<span>{t.activityHeader}</span>'], ['title="Update current scenario"', 'title={t.updateScenarioTitle}'], ['title="Create a copy of this scenario"', 'title={t.duplicateScenarioTitle}']
]
for (const [from, to] of literalReplacements) source = source.replaceAll(from, to)
source = source.replace('`${progressRecord.completed_count} of ${progressRecord.scope_item_count} scope items completed.`', 't.completedScopeItems(progressRecord.completed_count, progressRecord.scope_item_count)')
source = source.replace('`${progressRecord.in_progress_count} scope item${progressRecord.in_progress_count === 1 ? \'\' : \'s\'} in progress.`', 't.scopeItemsInProgress(progressRecord.in_progress_count)')
source = source.replace('}</strong> locations × <strong>{sequenceActivities.length}</strong> activities =', '}</strong> {t.locationsWord} × <strong>{sequenceActivities.length}</strong> {t.activitiesWord} =')
source = source.replace('`Row ID: ${row.id}`', '`${t.rowIdLabel}: ${row.id}`')

for (const token of ['get{t.', 'set{t.', 'locale{t.', 'project{t.', 'selected{t.']) if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
if (source.includes('  const t = {\n    title:')) throw new Error('Legacy English-only Master Plan translation object still exists.')
if (!source.includes('getMasterPlanCopy(locale)')) throw new Error('Master Plan catalog is not wired to locale.')
if (!source.includes('getMasterPlanPortfolioCopy(locale)')) throw new Error('Master Plan portfolio catalog is not wired to locale.')
if (!source.includes('loadOrganizationLocale')) throw new Error('Organization locale loader is missing.')

fs.writeFileSync(path, source)
console.log(`Wired Master Plan locale catalogs and rendered literals: ${path}`)
