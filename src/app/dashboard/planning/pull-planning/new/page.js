'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '../../../../../lib/i18n/useT'
import { createPlan, loadProjects, saveParticipants } from '../../../../../lib/pull/data'
import { readPreconProjectId } from '../../../preconProject'
import { Empty, Notice, PageHeader, Panel } from '../../../../fieldop/ui'
import PlanForm from '../PlanForm'
import { PULL_BASE, errorText } from '../shared'

export default function NewPullPlanPage() {
  const t = useT('precon')
  const router = useRouter()
  const [project, setProject] = useState(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const wanted = readPreconProjectId()
    loadProjects().then((rows) => setProject(rows.find((p) => p.id === wanted) || null)).catch((e) => setError(errorText(e)))
  }, [])

  const submit = async (values, people) => {
    setSaving(true)
    setError('')
    try {
      const plan = await createPlan({ ...values, project_id: project.id })
      await saveParticipants(plan, people, [])
      router.push(`${PULL_BASE}/${plan.id}`)
    } catch (e) {
      setError(errorText(e))
      setSaving(false)
    }
  }

  return <>
    <PageHeader
      back={{ href: PULL_BASE, label: t('pull.backToPlans') }}
      title={t('pull.newPlanTitle')}
      subtitle={project ? `${t('pull.newPlanText')} · ${project.code ? `${project.code} · ` : ''}${project.name}` : t('pull.newPlanText')}
    />
    <Notice>{error}</Notice>
    {project === null && <Panel><Empty title={t('pull.pickProjectFirst')} text={t('pull.pickProjectFirstText')} /></Panel>}
    {project && <PlanForm saving={saving} onSubmit={submit} onCancel={() => router.push(PULL_BASE)} />}
  </>
}
