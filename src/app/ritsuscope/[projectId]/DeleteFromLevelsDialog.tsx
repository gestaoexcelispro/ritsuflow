'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { levelGroups, type LevelRow } from '@/lib/takeoff/levels'
import type { ElementRow, LayerRow, SourceRow } from '@/lib/takeoff/rows'
import { ui } from '../ui'

type Props = {
  /** Items whose drawings are deleted. */
  itemIds: string[]
  /** Level picked by default (the current sheet's level; '' = sheets without a level). */
  defaultLevelId: string
  levels: LevelRow[]
  sources: SourceRow[]
  layers: LayerRow[]
  elements: ElementRow[]
  onDone: (message: string) => Promise<void> | void
  onClose: () => void
}

const NO_LEVEL = ''

/** Deletes the ticked items' drawings only on the chosen levels; the items stay in the project. */
export default function DeleteFromLevelsDialog({ itemIds, defaultLevelId, levels, sources, layers, elements, onDone, onClose }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const [chosen, setChosen] = useState<Set<string>>(new Set([defaultLevelId]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [restore, setRestore] = useState<Record<string, unknown>[] | null>(null)
  const [summary, setSummary] = useState('')

  const ids = useMemo(() => new Set(itemIds), [itemIds])
  const groups = levelGroups(levels)
  const known = new Set(levels.map(l => l.id))
  const rows = useMemo(() => {
    const sheetsOf = (levelId: string) => sources.filter(s => (levelId === NO_LEVEL ? !s.level_id || !known.has(s.level_id) : s.level_id === levelId))
    const list = groups.map(g => ({ id: g.master.id, name: g.master.name, elevation: g.master.elevation_m as number | null, count: g.count, sheets: sheetsOf(g.master.id) }))
    const loose = sheetsOf(NO_LEVEL)
    if (loose.length) list.push({ id: NO_LEVEL, name: t('level.unassigned'), elevation: null, count: 1, sheets: loose })
    return list.map(r => {
      const sheetIds = new Set(r.sheets.map(s => s.id))
      return { ...r, drawings: elements.filter(e => sheetIds.has(e.source_id) && ids.has(e.layer_id)).length }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels, sources, elements, ids])

  const picked = rows.filter(r => chosen.has(r.id) && r.drawings > 0)
  const total = picked.reduce((n, r) => n + r.drawings, 0)
  const names = layers.filter(l => ids.has(l.id)).map(l => l.name)

  async function run() {
    if (!total) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const sheetIds = picked.flatMap(r => r.sheets.map(s => s.id))
    try {
      const { data: old, error: e1 } = await supabase.from('takeoff_elements').select('*').in('source_id', sheetIds).in('layer_id', [...ids])
      if (e1) throw e1
      const { data: gone, error: e2 } = await supabase.from('takeoff_elements').delete().in('source_id', sheetIds).in('layer_id', [...ids]).select('id')
      if (e2) throw e2
      const goneIds = new Set((gone || []).map(r => r.id as string))
      // Only what was really deleted can be put back (others' drawings need an admin).
      setRestore(((old || []) as Record<string, unknown>[]).filter(r => goneIds.has(r.id as string)))
      const done = goneIds.size
      const msg = done < total ? t('bulk.drawingsPartial', { done, total }) : t('levelDelete.done', { count: done, levels: picked.length })
      setSummary(msg)
      setBusy(false)
      await onDone(msg)
    } catch (err) {
      setBusy(false)
      setError(t('workspace.error', { message: err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err) }))
    }
  }

  async function undo() {
    if (!restore) return
    setBusy(true)
    const supabase = createClient()
    for (let i = 0; i < restore.length; i += 500) {
      const { error: e } = await supabase.from('takeoff_elements').insert(restore.slice(i, i + 500))
      if (e) { setBusy(false); setError(t('workspace.error', { message: e.message })); return }
    }
    setBusy(false)
    onClose()
    await onDone(t('levelDelete.undone', { count: restore.length }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,35,45,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={busy ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: 18, background: '#fff', borderRadius: 12, boxShadow: '0 20px 50px rgba(15,35,45,.25)' }}>
        <strong style={{ fontSize: 15, color: '#173441' }}>{t('levelDelete.title')}</strong>
        <span style={ui.small}>{t('levelDelete.hint', { items: names.slice(0, 5).join(', ') + (names.length > 5 ? '…' : '') })}</span>
        {summary ? (
          <>
            <div style={{ fontSize: 12, color: '#0d7f77', fontWeight: 700 }}>{summary}</div>
            {error && <div style={ui.error}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {restore && restore.length > 0 && <button type="button" disabled={busy} onClick={() => void undo()} style={btn(false)}>{t('levelDelete.undo')}</button>}
              <button type="button" disabled={busy} onClick={onClose} style={btn(true)}>{t('copy.close')}</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid #e5ecee' }}>
              {rows.map(r => (
                <label key={r.id || 'none'} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#294955', cursor: r.drawings ? 'pointer' : 'default', opacity: r.drawings ? 1 : 0.5 }}>
                  <input type="checkbox" disabled={!r.drawings} checked={chosen.has(r.id) && r.drawings > 0} onChange={() => setChosen(prev => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n })} />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>
                      <strong>{r.name}</strong>
                      {r.elevation != null && <span style={ui.small}> {r.elevation >= 0 ? '+' : ''}{formatNumber(r.elevation, 2)} m</span>}
                      {r.count > 1 && <span style={{ ...ui.small, color: '#0d7f77', fontWeight: 800 }}> ×{r.count}</span>}
                    </span>
                    <span style={ui.small}>
                      {r.drawings ? t('levelDelete.count', { count: r.drawings }) : t('levelDelete.none')}
                      {r.count > 1 && r.drawings ? ` · ${t('levelDelete.typical', { count: r.count })}` : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {error && <div style={ui.error}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" disabled={busy} onClick={onClose} style={btn(false)}>{t('level.cancel')}</button>
              <button type="button" disabled={busy || !total} onClick={() => void run()} style={{ ...btn(true), background: '#c94a4a', borderColor: '#c94a4a', opacity: busy || !total ? 0.5 : 1 }}>
                {t('levelDelete.run', { count: total })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const btn = (primary: boolean) => ({ height: 32, padding: '0 14px', border: '1px solid ' + (primary ? '#109d91' : '#d3dfe2'), borderRadius: 7, background: primary ? '#109d91' : '#fff', color: primary ? '#fff' : '#294955', fontSize: 11, fontWeight: 800, cursor: 'pointer' }) as const
