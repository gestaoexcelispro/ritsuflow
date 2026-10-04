'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import View3D from '@/app/ritsuscope/[projectId]/View3D'
import type { ShareSnapshot } from '@/app/ritsuscope/[projectId]/ShareDialog'

type Shared = { title: string; project: string | null; snapshot_at: string; snapshot: ShareSnapshot }

/** Public, read-only 3D view of a shared takeoff (no login). Only the snapshot stored with the link is shown. */
export default function SharedModelPage() {
  const { token } = useParams<{ token: string }>()
  const t = useTakeoffT()
  const { language, setLanguage } = useLanguage()
  const [data, setData] = useState<Shared | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    createClient().rpc('get_takeoff_share', { p_token: token }).then(({ data: res, error }) => {
      if (!alive) return
      if (error) { setState('error'); return }
      if (!res) { setState('missing'); return }
      setData(res as Shared)
      setState('ok')
    })
    return () => { alive = false }
  }, [token])

  const when = data ? new Date(data.snapshot_at).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }) : ''

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateRows: '56px minmax(0,1fr) auto', gridTemplateColumns: 'minmax(0, 1fr)', background: '#f4f7f8' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', minWidth: 0, background: '#fff', borderBottom: '1px solid #dfe7ea' }}>
        <img src="/ritsu-logo.png" alt="RitsuFlow" style={{ flexShrink: 0, height: 40, width: 'auto', display: 'block' }} />
        <strong className="ep-brand" style={{ fontSize: 15, color: '#173441', flexShrink: 0 }}>RitsuScope</strong>
        <span className="ep-brand" style={{ flexShrink: 0, width: 1, height: 26, background: '#e2eaed' }} />
        {data && (
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <strong style={{ fontSize: 14, color: '#173441', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.title}</strong>
            <span style={{ fontSize: 11, color: '#6b8089', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[data.project, t('shared.asOf', { date: when })].filter(Boolean).join(' · ')}</span>
          </span>
        )}
        {!data && <span style={{ flex: 1 }} />}
        <select value={language} onChange={e => setLanguage(e.target.value as typeof language)} style={{ flexShrink: 0, height: 30, border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12 }} aria-label="Language">
          <option value="en-US">English</option>
          <option value="pt-BR">Português</option>
        </select>
      </header>
      <main style={{ minHeight: 0, minWidth: 0, padding: 10 }}>
        <style>{'@media (max-width: 520px) { .ep-brand { display: none } }'}</style>
        {state === 'loading' && <div style={msg}>{t('workspace.loading')}</div>}
        {state === 'missing' && <div style={msg}>{t('shared.missing')}</div>}
        {state === 'error' && <div style={msg}>{t('shared.error')}</div>}
        {state === 'ok' && data && (
          data.snapshot.items.length === 0
            ? <div style={msg}>{t('shared.empty')}</div>
            : <View3D items={data.snapshot.items} ptPerM={data.snapshot.ptPerM} storeys={data.snapshot.storeys} selectedId={selected} onSelect={setSelected} />
        )}
      </main>
      <footer style={{ display: 'flex', alignItems: 'center', minHeight: 28, padding: '6px 12px', background: '#eef3f4', borderTop: '1px solid #dfe7ea', fontSize: 11, color: '#4b6570' }}>
        {t('shared.footer')}
      </footer>
    </div>
  )
}

const msg = { height: '100%', display: 'grid', placeItems: 'center', fontSize: 13, color: '#4b6570', textAlign: 'center', padding: 24 } as const
