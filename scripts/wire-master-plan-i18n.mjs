import fs from 'node:fs'

const path = 'src/app/dashboard/planning/master-plan/page.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

required("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\nimport { getMasterPlanCopy } from '../../../../i18n/masterPlan';")
required("export default function MasterPlanPage() {\n  const t = {", "export default function MasterPlanPage() {\n  const [locale, setLocale] = useState('en-US');\n  const t = getMasterPlanCopy(locale);\n  /* LEGACY_MASTER_PLAN_COPY_START\n  const legacyMasterPlanCopy = {")
required("    mPdfConfirm: 'Confirm and Download PDF',\n  };\n\n  const [projects, setProjects]", "    mPdfConfirm: 'Confirm and Download PDF',\n  };\n  LEGACY_MASTER_PLAN_COPY_END */\n\n  const [projects, setProjects]")

// The client page already owns the authenticated Supabase session. Resolve the
// organization's persisted locale without converting this large page to a
// server component.
required("  const [projects, setProjects] = useState([]);", "  const [projects, setProjects] = useState([]);\n\n  useEffect(() => {\n    let active = true;\n\n    async function loadOrganizationLocale() {\n      try {\n        const { data: { user } } = await supabase.auth.getUser();\n        if (!user) return;\n\n        const { data: membership } = await supabase\n          .from('organization_members')\n          .select('organization_id')\n          .eq('user_id', user.id)\n          .limit(1)\n          .maybeSingle();\n\n        if (!membership?.organization_id) return;\n\n        const { data: organization } = await supabase\n          .from('organizations')\n          .select('locale')\n          .eq('id', membership.organization_id)\n          .maybeSingle();\n\n        const nextLocale = organization?.locale;\n        if (active && ['en-US', 'pt-BR', 'es'].includes(nextLocale)) {\n          setLocale(nextLocale);\n        }\n      } catch (error) {\n        console.warn('Master Plan locale fallback to en-US.', error);\n      }\n    }\n\n    loadOrganizationLocale();\n    return () => { active = false; };\n  }, []);")

for (const token of ['get{t.', 'set{t.', 'locale{t.', 'project{t.']) {
  if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
}

fs.writeFileSync(path, source)
console.log(`Wired Master Plan locale catalog: ${path}`)
