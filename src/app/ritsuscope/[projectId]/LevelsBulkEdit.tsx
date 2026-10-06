'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { sortLevels, type LevelRow } from '@/lib/takeoff/levels'
import type { SourceRow } from '@/lib/takeoff/rows'
import { ui } from '../ui'

type Props = {
  /** Levels picked in the levels panel (groups already expanded to all their floors). */
  levels: LevelRow[]
  sources: SourceRow[]
  onChanged: (message: string) => Promise<void> | void
  onClose: () => void
}

/** Right sidebar: change or delete several levels at once. Empty fields keep each level's own value. */
export default function LevelsBulkEdit({ levels, sources, onChanged, onClose }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const [form, setForm] = useState({ height: '', slab: '', shift: '' })
  const [restack, setRestack] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ordered = sortLevels(levels).slice().sort((a, b) => a.elevation_m - b.elevation_m)
  const ids = ordered.map(l => l.id)
  const sheetCount = sources.filter(s => s.level_id && ids.includes(s.level_id)).length

  /** Empty → keep (null); a number → that value; anything else → invalid (undefined). */
  function parse(v: string): number | null | undefined {
    if (!v.trim()) return null
    const x = parseLocaleNumber(v)
    return Number.isFinite(x) ? x : undefined
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const height = parse(form.height)
    const slab = parse(form.slab)
    const shift = parse(form.shift)
    if (height === undefined || slab === undefined || shift === undefined || (height != null && height <= 0) || (slab != null && slab < 0)) { setError(t('level.invalid')); return }
    if (height == null && slab == null && !shift && !restack) { setError(t('levelBulk.nothing')); return }
    // New values per level, lowest first (restacking needs the level below's new elevation and height).
    const rows: { id: string; patch: Partial<Pick<LevelRow, 'elevation_m' | 'height_m' | 'slab_m'>> }[] = []
    let prev: { elevation: number; height: number | null } | null = null
    for (const l of ordered) {
      const h = height ?? l.height_m
      let elevation = l.elevation_m + (shift || 0)
      if (restack && prev) {
        if (prev.height == null) { setError(t('levelBulk.restackNeedsHeight')); return }
        elevation = prev.elevation + prev.height
      }
      elevation = Math.round(elevation * 1000) / 1000
      const patch: Partial<Pick<LevelRow, 'elevation_m' | 'height_m' | 'slab_m'>> = {}
      if (elevation !== l.elevation_m) patch.elevation_m = elevation
      if (height != null) patch.height_m = height
      if (slab != null) patch.slab_m = slab
      rows.push({ id: l.id, patch })
      prev = { elevation, height: h }
    }
    const changed = rows.filter(r => Object.keys(r.patch).length)
    setBusy(true)
    setError('')
    const supabase = createClient()
    for (const r of changed) {
      const { error: e1 } = await supabase.from('takeoff_levels').update(r.patch).eq('id', r.id)
      if (e1) { setBusy(false); setError(t('workspace.error', { message: e1.message })); await onChanged(''); return }
    }
    setBusy(false)
    setForm({ height: '', slab: '', shift: '' })
    setRestack(false)
    await onChanged(t('levelBulk.saved', { count: changed.length }))
  }

  async function remove() {
    if (!window.confirm(t('levelBulk.confirmDelete', { count: ids.length, sheets: sheetCount }))) return
    setBusy(true)
    setError('')
    const { data, error: e } = await createClient().from('takeoff_levels').delete().in('id', ids).select('id')
    setBusy(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    const done = data?.length || 0
    if (!done) { setError(t('element.deleteDenied')); return }
    onClose()
    await onChanged(done < ids.length ? t('levelBulk.deletedPartial', { done, total: ids.length }) : t('levelBulk.deleted', { count: done }))
  }

  const elev = (v: number) => `${v >= 0 ? '+' : ''}${formatNumber(v, 2)} m`

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1, fontSize: 13, color: '#173441' }}>{t('levelBulk.title', { count: ids.length })}</strong>
        <button type="button" onClick={onClose} title={t('levelBulk.clear')} style={{ border: 0, background: 'transparent', fontSize: 16, cursor: 'pointer', color: '#6b8089' }}>×</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {ordered.slice().reverse().map(l => (
          <span key={l.id} style={{ padding: '2px 7px', borderRadius: 10, background: '#eef3f4', color: '#294955', fontSize: 10, fontWeight: 700 }}>{l.name} <span style={{ color: '#6b8089', fontWeight: 600 }}>{elev(l.elevation_m)}</span></span>
        ))}
      </div>
      <span style={ui.small}>{t('levelBulk.hint')}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={field}>{t('level.height')}<input style={input} inputMode="decimal" value={form.height} placeholder="—" onChange={e => setForm(f => ({ ...f, height: e.target.value }))} /></label>
        <label style={field}>{t('level.slab')}<input style={input} inputMode="decimal" value={form.slab} placeholder="—" onChange={e => setForm(f => ({ ...f, slab: e.target.value }))} /></label>
        <label style={field}>{t('levelBulk.shift')}<input style={input} inputMode="decimal" value={form.shift} placeholder="0" onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} /></label>
      </div>
      {ordered.length > 1 && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#294955' }}>
          <input type="checkbox" checked={restack} onChange={e => setRestack(e.target.checked)} style={{ marginTop: 2 }} />
          <span>{t('levelBulk.restack', { name: ordered[0].name })}</span>
        </label>
      )}
      {error && <div style={ui.error}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy} style={btn(true)}>{t('levelBulk.apply')}</button>
        <button type="button" disabled={busy} onClick={() => void remove()} style={{ ...btn(false), color: '#c94a4a', borderColor: '#efcaca' }}>{t('levelBulk.delete', { count: ids.length })}</button>
      </div>
    </form>
  )
}

const field = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontWeight: 700, color: '#536d78' } as const
const input = { height: 30, padding: '0 8px', border: '1px solid #d3dfe2', borderRadius: 6, fontSize: 12, color: '#173441', minWidth: 0 } as const
const btn = (primary: boolean) => ({ height: 30, padding: '0 12px', border: '1px solid ' + (primary ? '#109d91' : '#d3dfe2'), borderRadius: 7, background: primary ? '#109d91' : '#fff', color: primary ? '#fff' : '#294955', fontSize: 11, fontWeight: 800, cursor: 'pointer' }) as const
