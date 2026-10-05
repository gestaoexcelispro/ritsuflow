'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { AppShell, ui } from '../../fieldop/ui'
import { useT } from '../../../lib/i18n/useT'
import ProjectForm from '../ProjectForm'

export default function NewProjectPage() {
  const t = useT('projects')
  const router = useRouter()

  async function create(payload) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) return t('form.errSignedOut')
      const { data: member, error: memberError } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle()
      if (memberError) throw memberError
      if (!member?.organization_id) return t('form.errNoOrg')
      const { data, error } = await supabase.from('projects').insert({ organization_id: member.organization_id, created_by: user.id, ...payload }).select('id').single()
      if (error) throw error
      router.push(`/projects/${data.id}`)
      return ''
    } catch (e) {
      return t('form.errCreate', { message: e?.message || '' })
    }
  }

  return <AppShell module="projects" active="all" bare action={<Link className={ui.btn} href="/projects">{t('form.cancel')}</Link>}>
    <ProjectForm mode="create" onSubmit={create} />
  </AppShell>
}
