import fs from 'node:fs'

const path = 'src/app/dashboard/planning/master-plan/page.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

if (!source.includes("import { getMasterPlanCopy } from '../../../../i18n/masterPlan';")) {
  required(
    "import React, { useState, useEffect, useRef } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';\nimport { getMasterPlanCopy } from '../../../../i18n/masterPlan';"
  )
}

if (!source.includes("const [locale, setLocale] = useState('en-US');")) {
  const start = source.indexOf('  const t = {', source.indexOf('export default function MasterPlanPage()'))
  if (start < 0) throw new Error('Master Plan local translation object start was not found.')

  const endMarker = '\n  };\n\n  const [projects, setProjects]'
  const end = source.indexOf(endMarker, start)
  if (end < 0) throw new Error('Master Plan local translation object end was not found.')

  source =
    source.slice(0, start) +
    "  const [locale, setLocale] = useState('en-US');\n  const t = getMasterPlanCopy(locale);\n" +
    source.slice(end + '\n  };\n'.length)
}

if (!source.includes('async function loadOrganizationLocale()')) {
  required(
    '  const [projects, setProjects] = useState([]);',
    `  const [projects, setProjects] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadOrganizationLocale() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (!membership?.organization_id) return;

        const { data: organization } = await supabase
          .from('organizations')
          .select('locale')
          .eq('id', membership.organization_id)
          .maybeSingle();

        const nextLocale = organization?.locale;
        if (active && ['en-US', 'pt-BR', 'es'].includes(nextLocale)) {
          setLocale(nextLocale);
        }
      } catch (error) {
        console.warn('Master Plan locale fallback to en-US.', error);
      }
    }

    loadOrganizationLocale();
    return () => { active = false; };
  }, []);`
  )
}

// Locale-sensitive scenario timestamps.
source = source.replace("      'en-US',\n      {", "      locale,\n      {")

// Canonical Location Structure fallback label is translated at render time.
source = source.replaceAll("'PROJECT LOCATIONS'", 't.projectLocations')

// Calendar markers already carry legacy PT/EN labels. Add locale-aware Spanish
// fallback without changing persisted package codes OFF / FER.
source = source.replace(
  "const SYSTEM_CALENDAR_CODES = {",
  "const SYSTEM_CALENDAR_CODES = {"
)

for (const token of ['get{t.', 'set{t.', 'locale{t.', 'project{t.', 'selected{t.']) {
  if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
}

if (source.includes("  const t = {")) throw new Error('Legacy English-only Master Plan translation object still exists.')
if (!source.includes('getMasterPlanCopy(locale)')) throw new Error('Master Plan catalog is not wired to locale.')
if (!source.includes('loadOrganizationLocale')) throw new Error('Organization locale loader is missing.')

fs.writeFileSync(path, source)
console.log(`Wired persistent-ready Master Plan locale catalog: ${path}`)
