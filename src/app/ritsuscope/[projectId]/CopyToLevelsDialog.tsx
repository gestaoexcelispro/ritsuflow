'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import { copiedElements, copiedZones, copyTarget, sheetMapper, type CopyTargetStatus } from '@/lib/takeoff/copyLevels'
import { levelGroups, sortLevels, type LevelRow } from '@/lib/takeoff/levels'
import type { ElementRow, LayerRow, SourceRow } from '@/lib/takeoff/rows'
import type { ZoneRow } from '@/lib/takeoff/zones'
import { ui } from '../ui'

type Props = {
  /** Sheet the takeoff is copied from. */
  from: SourceRow
  levels: LevelRow[]
  sources: SourceRow[]
  layers: LayerRow[]
  elements: ElementRow[]
  zones: ZoneRow[]
  /** Items ticked in the list (copy only those, when chosen). */
  checkedItemIds: string[]
  onDone: (message: string) => Promise<void> | void
  onClose: () => void
}

type Undo = { sources: string[]; elements: string[]; zones: string[]; restoreElements: Record<string, unknown>[]; restoreZones: Record<string, unknown>[] }

const BLOCK_KEY: Record<string, TakeoffMessageKey> = {
  typical: 'copy.blockedTypical',
  noOrigin: 'copy.blockedOrigin',
  noScale: 'copy.blockedScale',
  same: 'copy.blockedSame',
}

/** "Copy to levels": each chosen level gets its own copy of this sheet's takeoff. */
export default function CopyToLevelsDialog({ from, levels, sources, layers, elements, zones, checkedItemIds, onDone, onClose }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const fromLevel = from.level_id ? levels.find(l => l.id === from.level_id) || null : null
  const followerIds = useMemo(() => new Set(levelGroups(levels).flatMap(g => g.followers.map(f => f.id))), [levels])
  const [scope, setScope] = useState<'all' | 'checked'>(checkedItemIds.length ? 'checked' : 'all')
  const [withZones, setWithZones] = useState(true)
  const [mode, setMode] = useState<'replace' | 'add'>('replace')
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<Undo | null>(null)
  const [summary, setSummary] = useState('')

  const fromElements = elements.filter(e => e.source_id === from.id && (scope === 'all' || checkedItemIds.includes(e.layer_id)))
  const layerIds = new Set(fromElements.map(e => e.layer_id))
  const fromZones = withZones ? zones.filter(z => z.source_id === from.id) : []
  const itemNames = layers.filter(l => layerIds.has(l.id)).map(l => l.name)

  const targets = useMemo(() => sortLevels(levels).reverse()
    .filter(l => l.id !== fromLevel?.id)
    .map(l => {
      const sheets = sources.filter(s => s.level_id === l.id)
      const status: CopyTargetStatus = copyTarget(from, sheets, followerIds.has(l.id))
      const existing = status.kind === 'sheet' ? elements.filter(e => e.source_id === status.sheet.id && layerIds.has(e.layer_id)).length : 0
      return { level: l, status, existing }
    }), [levels, sources, elements, from, fromLevel, followerIds, layerIds])

  const picked = targets.filter(x => chosen.has(x.level.id) && x.status.kind !== 'blocked')
  const toReplace = mode === 'replace' ? picked.reduce((n, x) => n + x.existing, 0) : 0

  async function run() {
    if (!picked.length || !fromElements.length) return
    if (toReplace > 0 && !window.confirm(t('copy.confirmReplace', { count: toReplace }))) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const u: Undo = { sources: [], elements: [], zones: [], restoreElements: [], restoreZones: [] }
    try {
      // Full rows of the drawings being copied (the list in memory has no location column).
      const { data: full, error: e0 } = await supabase.from('takeoff_elements').select('*').in('id', fromElements.map(e => e.id))
      if (e0) throw e0
      const rows = (full || []) as (ElementRow & { location_id?: string | null })[]
      let copied = 0
      for (const x of picked) {
        let target: SourceRow
        if (x.status.kind === 'newSheet') {
          const { data: src, error: e1 } = await supabase.from('takeoff_sources').select('*').eq('id', from.id).single()
          if (e1 || !src) throw e1 || new Error('sheet not found')
          const { id: _i, created_at: _c, updated_at: _u, created_by: _b, ...rest } = src as Record<string, unknown>
          void _i; void _c; void _u; void _b
          const { data: made, error: e2 } = await supabase.from('takeoff_sources')
            .insert({ ...rest, name: `${from.name} · ${x.level.name}`, level_id: x.level.id, level_name: null, level_elevation_m: null })
            .select('*').single()
          if (e2 || !made) throw e2 || new Error('sheet copy failed')
          u.sources.push(made.id)
          target = made as SourceRow
        } else if (x.status.kind === 'sheet') {
          target = x.status.sheet
          if (mode === 'replace' && x.existing > 0) {
            const { data: old, error: e3 } = await supabase.from('takeoff_elements').select('*').eq('source_id', target.id).in('layer_id', [...layerIds])
            if (e3) throw e3
            const { error: e4 } = await supabase.from('takeoff_elements').delete().eq('source_id', target.id).in('layer_id', [...layerIds])
            if (e4) throw e4
            u.restoreElements.push(...((old || []) as Record<string, unknown>[]))
          }
          if (mode === 'replace' && fromZones.length) {
            const { data: oldZ, error: e7 } = await supabase.from('takeoff_zones').select('*').eq('source_id', target.id)
            if (e7) throw e7
            if (oldZ && oldZ.length) {
              const { error: e8 } = await supabase.from('takeoff_zones').delete().eq('source_id', target.id)
              if (e8) throw e8
              u.restoreZones.push(...(oldZ as Record<string, unknown>[]))
            }
          }
        } else continue
        const map = sheetMapper(from, target)
        const newEls = copiedElements(rows, target.id, map)
        for (let i = 0; i < newEls.length; i += 500) {
          const { data: ins, error: e5 } = await supabase.from('takeoff_elements').insert(newEls.slice(i, i + 500)).select('id')
          if (e5) throw e5
          u.elements.push(...(ins || []).map(r => r.id as string))
        }
        copied += newEls.length
        if (fromZones.length) {
          const { data: zs, error: e6 } = await supabase.from('takeoff_zones').insert(copiedZones(fromZones, target.id, map)).select('id')
          if (e6) throw e6
          u.zones.push(...(zs || []).map(r => r.id as string))
        }
      }
      setUndo(u)
      const msg = t('copy.done', { count: copied, levels: picked.length })
      setSummary(msg)
      setBusy(false)
      await onDone(msg)
    } catch (err) {
      setUndo(u)
      setBusy(false)
      setError(t('workspace.error', { message: err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err) }))
    }
  }

  /** Removes everything this copy created and puts back what it replaced. */
  async function revert() {
    if (!undo) return
    setBusy(true)
    const supabase = createClient()
    try {
      if (undo.zones.length) { const { error: e } = await supabase.from('takeoff_zones').delete().in('id', undo.zones); if (e) throw e }
      for (let i = 0; i < undo.elements.length; i += 500) {
        const { error: e } = await supabase.from('takeoff_elements').delete().in('id', undo.elements.slice(i, i + 500))
        if (e) throw e
      }
      if (undo.sources.length) { const { error: e } = await supabase.from('takeoff_sources').delete().in('id', undo.sources); if (e) throw e }
      if (undo.restoreZones.length) { const { error: e } = await supabase.from('takeoff_zones').insert(undo.restoreZones); if (e) throw e }
      for (let i = 0; i < undo.restoreElements.length; i += 500) {
        const { error: e } = await supabase.from('takeoff_elements').insert(undo.restoreElements.slice(i, i + 500))
        if (e) throw e
      }
      setBusy(false)
      onClose()
      await onDone(t('copy.undone'))
    } catch (err) {
      setBusy(false)
      setError(t('workspace.error', { message: err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err) }))
    }
  }

  const elev = (v: number) => `${v >= 0 ? '+' : ''}${formatNumber(v, 2)} m`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,35,45,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={busy ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: 18, background: '#fff', borderRadius: 12, boxShadow: '0 20px 50px rgba(15,35,45,.25)' }}>
        <strong style={{ fontSize: 15, color: '#173441' }}>{t('copy.title')}</strong>
        <span style={ui.small}>{t('copy.from', { sheet: from.name, level: fromLevel?.name || t('level.unassigned') })} {t('copy.hint')}</span>

        {summary ? (
          <>
            <div style={{ fontSize: 12, color: '#0d7f77', fontWeight: 700 }}>{summary}</div>
            {error && <div style={ui.error}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" disabled={busy} onClick={() => void revert()} style={btn(false)}>{t('copy.undo')}</button>
              <button type="button" disabled={busy} onClick={onClose} style={btn(true)}>{t('copy.close')}</button>
            </div>
          </>
        ) : (
          <>
            <div style={section}>
              <strong style={label}>{t('copy.what')}</strong>
              <label style={row}><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} />{t('copy.scopeAll')}</label>
              <label style={{ ...row, opacity: checkedItemIds.length ? 1 : 0.5 }}><input type="radio" disabled={!checkedItemIds.length} checked={scope === 'checked'} onChange={() => setScope('checked')} />{t('copy.scopeChecked', { count: checkedItemIds.length })}</label>
              <span style={ui.small}>{t('copy.summary', { count: fromElements.length, items: itemNames.length })}{itemNames.length ? `: ${itemNames.slice(0, 6).join(', ')}${itemNames.length > 6 ? '…' : ''}` : ''}</span>
              <label style={row}><input type="checkbox" checked={withZones} onChange={e => setWithZones(e.target.checked)} />{t('copy.withZones', { count: zones.filter(z => z.source_id === from.id).length })}</label>
            </div>

            <div style={section}>
              <strong style={label}>{t('copy.to')}</strong>
              {targets.length === 0 && <span style={ui.small}>{t('copy.noLevels')}</span>}
              {targets.map(x => {
                const blocked = x.status.kind === 'blocked'
                const note = x.status.kind === 'blocked' ? t(BLOCK_KEY[x.status.reason]) : x.status.kind === 'newSheet' ? t('copy.newSheet') : x.existing ? t('copy.onSheetExisting', { sheet: x.status.sheet.name, count: x.existing }) : t('copy.onSheet', { sheet: x.status.sheet.name })
                return (
                  <label key={x.level.id} style={{ ...row, alignItems: 'flex-start', opacity: blocked ? 0.5 : 1 }}>
                    <input type="checkbox" disabled={blocked} checked={chosen.has(x.level.id) && !blocked} onChange={() => setChosen(prev => { const n = new Set(prev); if (n.has(x.level.id)) n.delete(x.level.id); else n.add(x.level.id); return n })} />
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <span><strong>{x.level.name}</strong> <span style={ui.small}>{elev(x.level.elevation_m)}</span></span>
                      <span style={ui.small}>{note}</span>
                    </span>
                  </label>
                )
              })}
              {targets.some(x => x.status.kind !== 'blocked') && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={linkBtn} onClick={() => setChosen(new Set(targets.filter(x => x.status.kind !== 'blocked').map(x => x.level.id)))}>{t('copy.selectAll')}</button>
                  <button type="button" style={linkBtn} onClick={() => setChosen(new Set())}>{t('copy.selectNone')}</button>
                </div>
              )}
            </div>

            {picked.some(x => x.existing > 0) && (
              <div style={section}>
                <strong style={label}>{t('copy.existingTitle')}</strong>
                <label style={row}><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} />{t('copy.replace')}</label>
                <label style={row}><input type="radio" checked={mode === 'add'} onChange={() => setMode('add')} />{t('copy.add')}</label>
              </div>
            )}

            {error && <div style={ui.error}>{error}</div>}
            {error && undo && (undo.elements.length > 0 || undo.sources.length > 0) && <button type="button" disabled={busy} onClick={() => void revert()} style={btn(false)}>{t('copy.undoPartial')}</button>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" disabled={busy} onClick={onClose} style={btn(false)}>{t('level.cancel')}</button>
              <button type="button" disabled={busy || !picked.length || !fromElements.length} onClick={() => void run()} style={{ ...btn(true), opacity: busy || !picked.length || !fromElements.length ? 0.5 : 1 }}>
                {busy ? t('copy.working') : t('copy.run', { count: picked.length })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const section = { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid #e5ecee' } as const
const label = { fontSize: 12, color: '#173441' } as const
const row = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#294955', cursor: 'pointer' } as const
const linkBtn = { border: 0, background: 'transparent', color: '#0d7f77', fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: 0 } as const
const btn = (primary: boolean) => ({ height: 32, padding: '0 14px', border: '1px solid ' + (primary ? '#109d91' : '#d3dfe2'), borderRadius: 7, background: primary ? '#109d91' : '#fff', color: primary ? '#fff' : '#294955', fontSize: 11, fontWeight: 800, cursor: 'pointer' }) as const
