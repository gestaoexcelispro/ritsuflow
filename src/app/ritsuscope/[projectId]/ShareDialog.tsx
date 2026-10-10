'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { TakeoffItem } from '@/lib/takeoff/geometry'
import Icon from './icons'

/** What a shared link shows: the 3D items (in sheet points with ptPerM, or metres with ptPerM = 1) and storeys. */
export type ShareSnapshot = {
  version: 1
  ptPerM: number
  items: TakeoffItem[]
  storeys?: { page: number; name: string; elevation: number }[]
  sheets: string[]
}

type LinkRow = {
  id: string
  token: string
  title: string
  snapshot_at: string
  revoked_at: string | null
  view_count: number
  last_viewed_at: string | null
  created_at: string
}

type Props = {
  projectId: string
  defaultTitle: string
  /** Builds the snapshot of what's in the 3D view right now (null if nothing to share). */
  makeSnapshot: () => ShareSnapshot | null
  onClose: () => void
}

/** 32 random bytes as URL-safe base64 (43 characters). */
function newToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/ritsuscope-share/${token}`
}

export default function ShareDialog({ projectId, defaultTitle, makeSnapshot, onClose }: Props) {
  const t = useTakeoffT()
  const { language } = useLanguage()
  const [links, setLinks] = useState<LinkRow[]>([])
  const [title, setTitle] = useState(defaultTitle)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: e } = await createClient()
      .from('takeoff_share_links')
      .select('id, token, title, snapshot_at, revoked_at, view_count, last_viewed_at, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (e) setError(t('workspace.error', { message: e.message }))
    setLinks((data || []) as LinkRow[])
  }, [projectId, t])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' }) : '—')

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(token))
      setCopied(token)
      setTimeout(() => setCopied(c => (c === token ? null : c)), 2000)
    } catch {
      window.prompt(t('share.copyManually'), shareUrl(token))
    }
  }

  async function create() {
    const snapshot = makeSnapshot()
    if (!snapshot) { setError(t('share.nothing')); return }
    setBusy(true)
    setError('')
    const token = newToken()
    const { error: e } = await createClient().from('takeoff_share_links').insert({ project_id: projectId, token, title: title.trim() || defaultTitle, snapshot })
    setBusy(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await load()
    await copy(token)
    setMessage(t('share.created'))
  }

  async function refresh(link: LinkRow) {
    const snapshot = makeSnapshot()
    if (!snapshot) { setError(t('share.nothing')); return }
    if (!window.confirm(t('share.confirmUpdate', { title: link.title }))) return
    const { error: e } = await createClient().from('takeoff_share_links').update({ snapshot, snapshot_at: new Date().toISOString() }).eq('id', link.id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setMessage(t('share.updated'))
    await load()
  }

  async function setRevoked(link: LinkRow, revoked: boolean) {
    if (revoked && !window.confirm(t('share.confirmRevoke', { title: link.title }))) return
    const { error: e } = await createClient().from('takeoff_share_links').update({ revoked_at: revoked ? new Date().toISOString() : null }).eq('id', link.id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setMessage(t(revoked ? 'share.revoked' : 'share.restored'))
    await load()
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()} role="dialog" aria-label={t('share.title')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="share" size={18} />
          <strong style={{ fontSize: 15, color: '#173441', flex: 1 }}>{t('share.title')}</strong>
          <button type="button" style={ghost} onClick={onClose}>×</button>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#4b6570', lineHeight: 1.5 }}>{t('share.explain')}</p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontWeight: 700, color: '#607681', flex: 1 }}>
            {t('share.linkTitle')}
            <input style={input} value={title} onChange={e => setTitle(e.target.value)} />
          </label>
          <button type="button" style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void create()}>
            <Icon name="link" size={15} />{t('share.create')}
          </button>
        </div>
        {error && <div style={{ fontSize: 11, color: '#a44343' }}>{error}</div>}
        {message && !error && <div style={{ fontSize: 11, color: '#0d7f77' }}>{message}</div>}

        <div style={{ fontSize: 11, fontWeight: 800, color: '#173441', letterSpacing: '.06em', textTransform: 'uppercase' }}>{t('share.links')}</div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {links.length === 0 ? (
            <div style={{ fontSize: 11, color: '#6b8089' }}>{t('share.none')}</div>
          ) : links.map(link => {
            const off = !!link.revoked_at
            return (
              <div key={link.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, border: '1px solid #e2eaed', borderRadius: 8, background: off ? '#f7f9fa' : '#fff', opacity: off ? 0.75 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 12, color: '#173441', flex: 1 }}>{link.title}</strong>
                  <span style={{ fontSize: 10, fontWeight: 800, color: off ? '#a44343' : '#0b7c73' }}>{t(off ? 'share.status.revoked' : 'share.status.active')}</span>
                </div>
                <div style={{ fontSize: 10, color: '#6b8089' }}>
                  {t('share.meta', { snapshot: when(link.snapshot_at), views: link.view_count, last: when(link.last_viewed_at) })}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {!off && <button type="button" style={small(copied === link.token)} onClick={() => void copy(link.token)}>{t(copied === link.token ? 'share.copied' : 'share.copy')}</button>}
                  {!off && <a href={shareUrl(link.token)} target="_blank" rel="noreferrer" style={{ ...small(false), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>{t('share.open')}</a>}
                  {!off && <button type="button" style={small(false)} onClick={() => void refresh(link)}>{t('share.update')}</button>}
                  <button type="button" style={{ ...small(false), color: off ? '#0d7f77' : '#c94a4a', borderColor: off ? '#9fd8d2' : '#efcaca' }} onClick={() => void setRevoked(link, !off)}>
                    {t(off ? 'share.restore' : 'share.revoke')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const backdrop = { position: 'fixed', inset: 0, background: 'rgba(15, 35, 45, .35)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 } as const
const dialog = { width: 'min(620px, 100%)', maxHeight: 'min(640px, 100%)', display: 'flex', flexDirection: 'column', gap: 12, padding: 18, background: '#fff', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,.2)' } as const
const input = { height: 34, padding: '0 10px', border: '1px solid #d6e0e3', borderRadius: 8, fontSize: 12, background: '#fff', boxSizing: 'border-box', width: '100%' } as const
const primary = { display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', border: 0, borderRadius: 8, background: '#109d91', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' } as const
const ghost = { width: 30, height: 30, border: '1px solid #d3dfe2', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14 } as const
const small = (on: boolean) => ({ height: 28, padding: '0 10px', border: '1px solid ' + (on ? '#109d91' : '#d3dfe2'), borderRadius: 7, background: on ? '#109d91' : '#fff', color: on ? '#fff' : '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' }) as const
