'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { levelGroups, masterOf, sortLevels, wallHeightOf, type LevelRow } from '@/lib/takeoff/levels'
import type { SourceRow } from '@/lib/takeoff/rows'
import { createFloorsForLevels, loadLocations, locationTree, type ProjectLocation } from '@/lib/takeoff/locationSync'
import { ui } from '../ui'

type Props = {
  level: LevelRow
  levels: LevelRow[]
  sources: SourceRow[]
  onChanged: (message: string) => Promise<void> | void
  onClose: () => void
  /** Opens "copy to levels" from this level's sheet (when it has one). */
  onCopy?: () => void
}

/** Right sidebar: a level's name, elevation, heights, and its typical-floor group. */
export default function LevelProperties({ level, levels, sources, onChanged, onClose, onCopy }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const byId = new Map<string, LevelRow>(levels.map(l => [l.id, l] as [string, LevelRow]))
  const master = masterOf(level, byId)
  const isFollower = master.id !== level.id
  const n = (v: number | null) => (v == null ? '' : formatNumber(v, 2))
  const [form, setForm] = useState({ name: level.name, elevation: n(level.elevation_m), height: n(level.height_m), slab: n(level.slab_m) })
  const [followers, setFollowers] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  /** The project's Location Breakdown: this level is linked to one of its floors. */
  const [locations, setLocations] = useState<ProjectLocation[]>([])
  useEffect(() => {
    let alive = true
    loadLocations(createClient(), level.project_id).then(rows => { if (alive) setLocations(rows) }).catch(() => { if (alive) setLocations([]) })
    return () => { alive = false }
  }, [level.project_id, level.location_id])
  const floorOptions = locationTree(locations).filter(({ location }) => location.location_type === 'floor' || location.id === level.location_id)
  const linkedFloor = level.location_id ? locations.find(l => l.id === level.location_id) || null : null

  async function linkFloor(locationId: string) {
    setBusy(true)
    setError('')
    const { error: e } = await createClient().from('takeoff_levels').update({ location_id: locationId || null }).eq('id', level.id)
    setBusy(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await onChanged(t('level.saved'))
  }

  async function createFloor() {
    setBusy(true)
    setError('')
    try {
      await createFloorsForLevels(createClient(), { projectId: level.project_id, levels: [level], locations })
      await onChanged(t('level.floorCreated', { name: level.name }))
    } catch (e) {
      setError(t('workspace.error', { message: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    setForm({ name: level.name, elevation: n(level.elevation_m), height: n(level.height_m), slab: n(level.slab_m) })
    setFollowers(new Set(levels.filter(l => l.typical_of === level.id).map(l => l.id)))
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id, levels])

  const sheetsOf = (id: string) => sources.filter(s => s.level_id === id)
  const groupIds = new Set(levelGroups(levels).filter(g => g.followers.length).map(g => g.master.id))
  /** Levels that can repeat this one: no sheets of their own and not the master of another group. */
  const candidates = sortLevels(levels).filter(l => l.id !== level.id && (l.typical_of === level.id || (!sheetsOf(l.id).length && !groupIds.has(l.id) && !l.typical_of)))
  const wallH = wallHeightOf({ height_m: Number.isFinite(parseLocaleNumber(form.height)) ? parseLocaleNumber(form.height) : null, slab_m: Number.isFinite(parseLocaleNumber(form.slab)) ? parseLocaleNumber(form.slab) : null })

  function parse(v: string, required: boolean): number | null | undefined {
    if (!v.trim()) return required ? undefined : null
    const x = parseLocaleNumber(v)
    return Number.isFinite(x) ? x : undefined
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const elevation = parse(form.elevation, true)
    const height = parse(form.height, false)
    const slab = parse(form.slab, false)
    if (!form.name.trim() || elevation === undefined || height === undefined || slab === undefined || (height != null && height <= 0) || (slab != null && slab < 0)) { setError(t('level.invalid')); return }
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error: e1 } = await supabase.from('takeoff_levels').update({ name: form.name.trim(), elevation_m: elevation, height_m: height, slab_m: slab }).eq('id', level.id)
    if (e1) { setBusy(false); setError(/duplicate|unique/i.test(e1.message) ? t('level.duplicate') : t('workspace.error', { message: e1.message })); return }
    if (!isFollower) {
      const before = new Set(levels.filter(l => l.typical_of === level.id).map(l => l.id))
      const add = [...followers].filter(id => !before.has(id))
      const remove = [...before].filter(id => !followers.has(id))
      if (add.length) {
        const { error: e2 } = await supabase.from('takeoff_levels').update({ typical_of: level.id }).in('id', add)
        if (e2) { setBusy(false); setError(t('workspace.error', { message: e2.message })); return }
      }
      if (remove.length) {
        const { error: e3 } = await supabase.from('takeoff_levels').update({ typical_of: null }).in('id', remove)
        if (e3) { setBusy(false); setError(t('workspace.error', { message: e3.message })); return }
      }
      setBusy(false)
      await onChanged(add.length || remove.length ? t('level.typicalSaved', { count: followers.size + 1 }) : t('level.saved'))
      return
    }
    setBusy(false)
    await onChanged(t('level.saved'))
  }

  /** Stops repeating the master: its sheets and drawings are copied to this level, to edit it on its own. */
  async function detach() {
    const sheets = sheetsOf(master.id)
    if (!window.confirm(t('level.detachConfirm', { name: level.name, master: master.name }))) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    let copiedSheets = 0
    let copiedElements = 0
    try {
      for (const s of sheets) {
        const { data: full, error: e1 } = await supabase.from('takeoff_sources').select('*').eq('id', s.id).single()
        if (e1 || !full) throw e1 || new Error('sheet not found')
        const { id: _id, created_at: _c, updated_at: _u, created_by: _b, ...rest } = full as Record<string, unknown>
        void _id; void _c; void _u; void _b
        const { data: copy, error: e2 } = await supabase.from('takeoff_sources')
          .insert({ ...rest, name: `${s.name} · ${level.name}`, level_id: level.id, level_name: null, level_elevation_m: null, sort_order: Number(rest.sort_order || 0) + 1 })
          .select('id').single()
        if (e2 || !copy) throw e2 || new Error('copy failed')
        copiedSheets++
        const { data: els, error: e3 } = await supabase.from('takeoff_elements').select('*').eq('source_id', s.id)
        if (e3) throw e3
        const rows = (els || []).map(el => {
          const { id: _i, created_at: _a, updated_at: _d, created_by: _e, ...r } = el as Record<string, unknown>
          void _i; void _a; void _d; void _e
          return { ...r, source_id: copy.id }
        })
        for (let i = 0; i < rows.length; i += 500) {
          const { error: e4 } = await supabase.from('takeoff_elements').insert(rows.slice(i, i + 500))
          if (e4) throw e4
        }
        copiedElements += rows.length
      }
      const { error: e5 } = await supabase.from('takeoff_levels').update({ typical_of: null }).eq('id', level.id)
      if (e5) throw e5
      setBusy(false)
      await onChanged(t('level.detached', { name: level.name, sheets: copiedSheets, elements: copiedElements }))
    } catch (err) {
      setBusy(false)
      setError(t('workspace.error', { message: err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err) }))
    }
  }

  async function remove() {
    if (!window.confirm(t('level.confirmDelete', { name: level.name }))) return
    setBusy(true)
    const { data, error: e } = await createClient().from('takeoff_levels').delete().eq('id', level.id).select('id')
    setBusy(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    if (!data || !data.length) { setError(t('element.deleteDenied')); return }
    onClose()
    await onChanged(t('level.deleted', { name: level.name }))
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1, fontSize: 13, color: '#173441' }}>{t('level.propsTitle')}</strong>
        <button type="button" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 16, cursor: 'pointer', color: '#6b8089' }}>×</button>
      </div>
      <label style={field}>{t('level.name')}<input style={input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={field}>{t('level.elevation')}<input style={input} inputMode="decimal" value={form.elevation} onChange={e => setForm(f => ({ ...f, elevation: e.target.value }))} /></label>
        <label style={field}>{t('level.height')}<input style={input} inputMode="decimal" value={form.height} placeholder="3,00" onChange={e => setForm(f => ({ ...f, height: e.target.value }))} /></label>
        <label style={field}>{t('level.slab')}<input style={input} inputMode="decimal" value={form.slab} placeholder="0,15" onChange={e => setForm(f => ({ ...f, slab: e.target.value }))} /></label>
      </div>
      <span style={ui.small}>{wallH != null ? t('level.wallHeight', { h: formatNumber(wallH, 2) }) : t('level.wallHeightNone')}</span>

      <div style={{ borderTop: '1px solid #e5ecee', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong style={{ fontSize: 12, color: '#173441' }}>{t('level.lbsFloor')}</strong>
        <select style={input} value={level.location_id || ''} disabled={busy} onChange={e => void linkFloor(e.target.value)}>
          <option value="">—</option>
          {floorOptions.map(({ location: l, depth }) => <option key={l.id} value={l.id}>{'\u00a0\u00a0\u00a0'.repeat(depth)}{l.name}</option>)}
        </select>
        {!linkedFloor && <button type="button" disabled={busy} onClick={() => void createFloor()} style={{ ...btn(false), color: '#5b21b6', borderColor: '#d8c8f5' }}>{t('level.createFloor')}</button>}
      </div>

      <div style={{ borderTop: '1px solid #e5ecee', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong style={{ fontSize: 12, color: '#173441' }}>{t('level.typicalTitle')}</strong>
        {isFollower ? (
          <>
            <span style={ui.small}>{t('level.followerHint', { master: master.name })}</span>
            <button type="button" disabled={busy} onClick={() => void detach()} style={btn(false)}>{t('level.detach')}</button>
          </>
        ) : (
          <>
            <span style={ui.small}>{t('level.typicalHint')}</span>
            {candidates.length === 0 && <span style={{ ...ui.small, color: '#a0b0b6' }}>{t('level.typicalNone')}</span>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflow: 'auto' }}>
              {candidates.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#294955' }}>
                  <input type="checkbox" checked={followers.has(c.id)} onChange={() => setFollowers(prev => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next })} />
                  {c.name} <span style={ui.small}>{c.elevation_m >= 0 ? '+' : ''}{formatNumber(c.elevation_m, 2)} m</span>
                </label>
              ))}
            </div>
            {followers.size > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: '#0d7f77' }}>{t('level.typicalCount', { count: followers.size + 1 })}</span>}
          </>
        )}
      </div>

      {onCopy && !isFollower && sheetsOf(level.id).length > 0 && levels.length > 1 && (
        <div style={{ borderTop: '1px solid #e5ecee', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ fontSize: 12, color: '#173441' }}>{t('copy.title')}</strong>
          <button type="button" onClick={onCopy} style={btn(false)}>{t('copy.button')}</button>
        </div>
      )}
      {error && <div style={ui.error}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy} style={btn(true)}>{t('level.save')}</button>
        <button type="button" disabled={busy} onClick={() => void remove()} style={{ ...btn(false), color: '#c94a4a', borderColor: '#efcaca' }}>{t('level.delete')}</button>
      </div>
    </form>
  )
}

const field = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontWeight: 700, color: '#536d78' } as const
const input = { height: 30, padding: '0 8px', border: '1px solid #d3dfe2', borderRadius: 6, fontSize: 12, color: '#173441', minWidth: 0 } as const
const btn = (primary: boolean) => ({ height: 30, padding: '0 12px', border: '1px solid ' + (primary ? '#109d91' : '#d3dfe2'), borderRadius: 7, background: primary ? '#109d91' : '#fff', color: primary ? '#fff' : '#294955', fontSize: 11, fontWeight: 800, cursor: 'pointer' }) as const
