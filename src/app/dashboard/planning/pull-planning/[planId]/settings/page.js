'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '../../../../../../lib/i18n/useT'
import { deletePlan, loadPlan, saveParticipants, updatePlan } from '../../../../../../lib/pull/data'
import { rememberPreconProjectId } from '../../../../preconProject'
import { usePageDialogs } from '../../../../../fieldop/ui/dialogs'
import { Empty, Icon, Notice, PageHeader, Panel, ui } from '../../../../../fieldop/ui'
import PlanForm from '../../PlanForm'
import { PULL_BASE, errorText } from '../../shared'

export default function PullPlanSettingsPage({ params }) {
  const { planId } = params
  const t = useT('precon')
  const router = useRouter()
  const dialogs = usePageDialogs()
  const [data, setData] = useState(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPlan(planId).then((result) => {
      setData(result)
      if (result) rememberPreconProjectId(result.plan.project_id)
    }).catch((e) => setError(errorText(e)))
  }, [planId])

  const boardHref = `${PULL_BASE}/${planId}`

  const submit = async (values, people) => {
    setSaving(true)
    setError('')
    try {
      const changes = { ...values }
      if (values.status === 'agreed' && data.plan.status !== 'agreed') changes.agreed_at = new Date().toISOString()
      if (values.status !== 'agreed') changes.agreed_at = null
      const plan = await updatePlan(planId, changes)
      await saveParticipants(plan, people, data.participants.map((p) => p.id))
      router.push(boardHref)
    } catch (e) {
      setError(errorText(e))
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!(await dialogs.confirm(t('pull.deletePlanConfirm', { name: data.plan.name }), { danger: true, confirmLabel: t('pull.deletePlan') }))) return
    try {
      await deletePlan(planId)
      router.push(PULL_BASE)
    } catch (e) { setError(errorText(e)) }
  }

  return <>
    {dialogs.element}
    <PageHeader
      back={{ href: data ? boardHref : PULL_BASE, label: data ? data.plan.name : t('pull.backToPlans') }}
      title={t('pull.settingsTitle')}
      subtitle={t('pull.settingsText')}
      actions={data && <button type="button" className={ui.btnDanger} onClick={remove}><Icon name="close" size={16} />{t('pull.deletePlan')}</button>}
    />
    <Notice>{error}</Notice>
    {data === null && <Panel><Empty title={t('pull.notFound')} text={t('pull.notFoundText')} /></Panel>}
    {data && <PlanForm plan={data.plan} participants={data.participants} saving={saving} showStatus onSubmit={submit} onCancel={() => router.push(boardHref)} />}
  </>
}
