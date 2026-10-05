'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { AppShell, Empty, ui } from '../../../fieldop/ui'
import { useT } from '../../../../lib/i18n/useT'
import ProjectForm, { EMPTY_PROJECT } from '../../ProjectForm'

const dateOnly = (v) => (v ? String(v).slice(0, 10) : '')
const text = (v) => v ?? ''

/** Maps a `projects` row to form fields. Older rows keep the number inside address_line ("Street, 123"). */
function toForm(p) {
  let address = p.address_line || '', number = p.address_number || ''
  if (!number && address) { const m = address.match(/^(.*?),\s*([^,]+)$/); if (m) { address = m[1]; number = m[2] } }
  return {
    ...EMPTY_PROJECT,
    name: p.name || '', client_name: p.client_name || '', contract_number: p.contract_number || '', status: p.status || 'planning',
    country_code: p.country_code || 'BR', postal_code: p.postal_code || '', address_line: address, address_number: number,
    neighborhood: p.neighborhood || '', city: p.city || '', state_region: p.state_region || '', latitude: text(p.latitude), longitude: text(p.longitude),
    contract_value: text(p.contract_value), currency_code: p.currency_code || 'BRL',
    billing_method: p.billing_method || 'progress_percent_complete', billing_cycle: p.billing_cycle || 'monthly',
    billing_cutoff_day: text(p.billing_cutoff_day), payment_terms_days: p.payment_terms_days ?? '30',
    has_retainage: !!p.has_retainage, retainage_percent: text(p.retainage_percent), retainage_payment_days: text(p.retainage_payment_days),
    material_included: !!p.material_included, material_value: text(p.material_value),
    planned_start_date: dateOnly(p.planned_start_date), contractual_term_days: text(p.contractual_term_days), success_criteria: p.success_criteria || '',
  }
}

export default function EditProjectPage() {
  const t = useT('projects')
  const { projectId } = useParams()
  const router = useRouter()
  const [initial, setInitial] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    supabase.from('projects').select('*').eq('id', projectId).maybeSingle().then(({ data, error: e }) => {
      if (!alive) return
      if (e || !data) setError(e?.message || t('detail.notFound'))
      else setInitial(toForm(data))
    })
    return () => { alive = false }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(payload) {
    const { error: e } = await supabase.from('projects').update(payload).eq('id', projectId)
    if (e) return t('form.errSave', { message: e.message })
    router.push(`/projects/${projectId}`)
    router.refresh()
    return ''
  }

  return <AppShell module="projects" active="overview" projectId={projectId} bare action={<Link className={ui.btn} href={`/projects/${projectId}`}>{t('form.cancel')}</Link>}>
    {error ? <div style={{ padding: 28 }}><Empty title={t('detail.unavailable')} text={error} action={<Link className={ui.btn} href="/projects">{t('detail.backToList')}</Link>} /></div>
      : !initial ? <p style={{ padding: 28, color: 'var(--fo-muted)' }}>{t('detail.loading')}</p>
      : <ProjectForm mode="edit" initial={initial} onSubmit={save} />}
  </AppShell>
}
