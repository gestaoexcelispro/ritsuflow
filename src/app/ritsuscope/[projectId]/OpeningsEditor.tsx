'use client'

import { FormEvent, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { polyLen, shapeHeight, type ElementOpening, type TakeoffItem } from '@/lib/takeoff/geometry'
import { validateOpening } from '@/lib/takeoff/openings'
import { ui } from '../ui'

type Kind = 'door' | 'window' | 'void'

type Props = {
  kind: Kind
  /** Items of the current sheet (walls with their openings). */
  items: TakeoffItem[]
  ptPerM: number
  onSaved: (message: string) => Promise<void> | void
  /** Select the wall an opening is on (to edit or move it there). */
  onSelectWall: (elementId: string) => void
  onClose: () => void
}

const isKind = (o: ElementOpening, kind: Kind) => (kind === 'void' ? o.kind !== 'door' && o.kind !== 'window' : o.kind === kind)
const sameSize = (a: ElementOpening, b: { w: number; h: number; sill: number }) =>
  Math.abs(a.w - b.w) < 1e-3 && Math.abs(a.h - b.h) < 1e-3 && Math.abs(a.sill - b.sill) < 1e-3

/**
 * Right sidebar for the Doors / Windows / Openings rows of the item list: every opening of
 * that kind on this sheet, grouped by size. A group's size (or type) can be changed for all of
 * its openings at once; each opening links to its wall for one-off edits.
 */
export default function OpeningsEditor({ kind, items, ptPerM, onSaved, onSelectWall, onClose }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const n = (v: number) => formatNumber(v, 2)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [ed, setEd] = useState({ kind: kind as Kind, w: '', h: '', sill: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Every wall on the sheet with its openings of this kind.
  const walls = useMemo(() => items.filter(it => it.kind === 'linear').flatMap(it => it.shapes.filter(sh => sh.id).map(sh => ({
    id: sh.id as string,
    itemName: it.name,
    lengthM: ptPerM > 0 ? polyLen(sh.pts) / ptPerM : 0,
    heightM: shapeHeight(it, sh),
    openings: sh.openings || [],
  }))), [items, ptPerM])

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; w: number; h: number; sill: number; list: { wallId: string; itemName: string; off: number }[] }>()
    for (const wall of walls) for (const o of wall.openings) {
      if (!isKind(o, kind)) continue
      const key = `${o.w.toFixed(3)}|${o.h.toFixed(3)}|${o.sill.toFixed(3)}`
      const g = map.get(key) || { key, w: o.w, h: o.h, sill: o.sill, list: [] }
      g.list.push({ wallId: wall.id, itemName: wall.itemName, off: o.off })
      map.set(key, g)
    }
    return [...map.values()].sort((a, b) => b.list.length - a.list.length || a.w - b.w)
  }, [walls, kind])

  const title = t(kind === 'door' ? 'openings.listDoors' : kind === 'window' ? 'openings.listWindows' : 'openings.listVoids')

  function startEdit(g: (typeof groups)[number]) {
    setEditKey(g.key)
    setEd({ kind, w: n(g.w), h: n(g.h), sill: n(g.sill) })
    setError('')
  }

  async function saveGroup(event: FormEvent, g: (typeof groups)[number]) {
    event.preventDefault()
    const size = { w: parseLocaleNumber(ed.w), h: parseLocaleNumber(ed.h), sill: parseLocaleNumber(ed.sill) }
    if (!(size.w > 0) || !(size.h > 0) || !(size.sill >= 0)) { setError(t('opening.error.size')); return }
    setBusy(true)
    setError('')
    let changed = 0
    let skipped = 0
    try {
      for (const wall of walls) {
        const hits = wall.openings.map((o, i) => (isKind(o, kind) && sameSize(o, g) ? i : -1)).filter(i => i >= 0)
        if (!hits.length) continue
        const next = wall.openings.map((o, i) => (hits.includes(i) ? { ...o, kind: ed.kind, ...size } : o))
        // A wall is updated only if every changed opening still fits it (length, height, no overlap).
        const ok = hits.every(i => !validateOpening(next[i], wall.lengthM, wall.heightM, next.filter((_, j) => j !== i)))
        if (!ok) { skipped += hits.length; continue }
        const { error: e } = await createClient().from('takeoff_elements').update({ openings: next }).eq('id', wall.id)
        if (e) throw e
        changed += hits.length
      }
      setEditKey(null)
      if (skipped) setError(t('openings.editSkipped', { count: skipped }))
      await onSaved(t('opening.updatedMany', { count: changed }))
    } catch (e) {
      setError(t('workspace.error', { message: e instanceof Error ? e.message : String((e as { message?: string })?.message || e) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...ui.panel, gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 13, color: '#173441', flex: 1 }}>{title}</strong>
        <button type="button" style={ghost} onClick={onClose}>×</button>
      </div>
      <div style={ui.small}>{t('openings.editHint')}</div>
      {error && <div style={ui.error}>{error}</div>}
      {groups.length === 0 && <div style={ui.small}>{t('opening.empty')}</div>}
      {groups.map(g => (
        <div key={g.key} style={{ ...ui.listItem, gap: 6 }}>
          {editKey === g.key ? (
            <form onSubmit={e => void saveGroup(e, g)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                <label style={field}>
                  {t('opening.kind')}
                  <select style={{ ...input, width: 120 }} value={ed.kind} onChange={e => setEd(v => ({ ...v, kind: e.target.value as Kind }))}>
                    <option value="door">{t('opening.kind.door')}</option>
                    <option value="window">{t('opening.kind.window')}</option>
                    <option value="void">{t('opening.kind.void')}</option>
                  </select>
                </label>
                <label style={field}>{t('opening.w')}<input autoFocus style={{ ...input, width: 80 }} inputMode="decimal" value={ed.w} onChange={e => setEd(v => ({ ...v, w: e.target.value }))} /></label>
                <label style={field}>{t('opening.h')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={ed.h} onChange={e => setEd(v => ({ ...v, h: e.target.value }))} /></label>
                <label style={field}>{t('opening.sill')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={ed.sill} onChange={e => setEd(v => ({ ...v, sill: e.target.value }))} /></label>
              </div>
              <div style={ui.small}>{t('openings.editGroupHint', { count: g.list.length })}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" style={{ ...ui.button, height: 30, fontSize: 11 }} disabled={busy}>{t('opening.save')}</button>
                <button type="button" style={ghost} onClick={() => setEditKey(null)}>{t('tool.cancel')}</button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>
                <strong style={{ fontSize: 12 }}>{g.list.length}× {n(g.w)} × {n(g.h)} m</strong>
                <span style={ui.small}>{g.sill > 0 ? ` · ${t('opening.sill')} ${n(g.sill)}` : ''}</span>
              </span>
              <button type="button" style={editBtn} title={t('openings.editGroup')} disabled={busy} onClick={() => startEdit(g)}>✎</button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {g.list.map((o, i) => (
              <button key={`${o.wallId}-${i}`} type="button" style={wallChip} title={t('openings.goToWall')} onClick={() => onSelectWall(o.wallId)}>
                {o.itemName} · {n(o.off)} m
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const field = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const input = { height: 30, padding: '0 7px', border: '1px solid #d6e0e3', borderRadius: 6, fontSize: 11, background: '#fff', boxSizing: 'border-box' } as const
const ghost = { height: 30, padding: '0 10px', border: '1px solid #d3dfe2', borderRadius: 7, background: '#fff', color: '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const
const editBtn = { width: 26, height: 26, border: '1px solid #d3dfe2', borderRadius: 6, background: '#fff', color: '#294955', cursor: 'pointer' } as const
const wallChip = { height: 22, padding: '0 8px', border: '1px solid #e2ebf0', borderRadius: 11, background: '#fff', color: '#294955', fontSize: 10, cursor: 'pointer' } as const
