'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { dist, polyLen, shapeHeight, type ElementOpening, type TakeoffItem, type TakeoffShape } from '@/lib/takeoff/geometry'
import { addOpening, OPENING_PRESETS, validateOpening, type OpeningError } from '@/lib/takeoff/openings'
import type { ElementRow } from '@/lib/takeoff/rows'
import { ui } from '../ui'

type Props = {
  element: ElementRow
  item: TakeoffItem
  shape: TakeoffShape
  ptPerM: number
  onSaved: (message: string) => Promise<void> | void
  /** Place the opening configured below by clicking on the plan (PDF sheets). */
  onPickOnPlan?: (opening: Omit<ElementOpening, 'off' | 'guid'>) => void
  picking?: boolean
}

const BOARD_SUGGESTIONS = ['Chapa ST 12,5 mm', 'Chapa RU 12,5 mm', 'Chapa RF 12,5 mm', 'ST board 12.5 mm', 'RU board 12.5 mm', 'RF board 12.5 mm']

const kindKey: Record<'door' | 'window' | 'void', TakeoffMessageKey> = {
  door: 'opening.kind.door',
  window: 'opening.kind.window',
  void: 'opening.kind.void',
}
const errorKey: Record<OpeningError, TakeoffMessageKey> = {
  size: 'opening.error.size',
  outside_length: 'opening.error.length',
  outside_height: 'opening.error.height',
  overlap: 'opening.error.overlap',
}

/** Per-wall settings: own height, Face A / Face B boards and openings. */
export default function ElementPanel({ element, item, shape, ptPerM, onSaved, onPickOnPlan, picking = false }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const n = (v: number) => formatNumber(v, 2)
  const lengthM = polyLen(element.points) / ptPerM
  const heightM = shapeHeight(item, shape)
  const framed = !!item.framing?.on

  const [height, setHeight] = useState('')
  const [faceA, setFaceA] = useState('')
  const [faceB, setFaceB] = useState('')
  const [flip, setFlip] = useState(false)
  const [kind, setKind] = useState<'door' | 'window' | 'void'>('door')
  const [op, setOp] = useState({ off: '', w: '', h: '', sill: '' })
  const [error, setError] = useState('')
  /** Opening being edited in place (index in the wall's list) and its form values. */
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [ed, setEd] = useState({ kind: 'door' as 'door' | 'window' | 'void', off: '', w: '', h: '', sill: '', all: false })
  const [busy, setBusy] = useState(false)
  /** Renamed tag of each stretch ('' = automatic). */
  const [tagEdit, setTagEdit] = useState<string[]>([])
  const segCount = Math.max(0, (element.points?.length || 0) - 1)
  const tagged = item.kind === 'linear' && segCount > 0

  useEffect(() => {
    setHeight(element.height_override_m == null ? '' : n(Number(element.height_override_m)))
    setFaceA(element.faces?.faceA || '')
    setFaceB(element.faces?.faceB || '')
    setFlip(!!element.faces?.flip)
    const p = OPENING_PRESETS.door
    setKind('door')
    setOp({ off: '', w: n(p.w), h: n(p.h), sill: n(p.sill) })
    setEditIdx(null)
    setError('')
    setTagEdit(Array.from({ length: Math.max(0, (element.points?.length || 0) - 1) }, (_, i) => {
      const v = Array.isArray(element.segment_tags) ? element.segment_tags[i] : null
      return typeof v === 'string' ? v : ''
    }))
    // Reset only when another element is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.id])

  async function update(fields: Partial<ElementRow>, message: string) {
    setBusy(true)
    setError('')
    const { error: e } = await createClient().from('takeoff_elements').update(fields).eq('id', element.id)
    setBusy(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await onSaved(message)
  }

  function saveHeight(event: FormEvent) {
    event.preventDefault()
    const v = parseLocaleNumber(height)
    if (height.trim() && !(v > 0)) { setError(t('element.heightInvalid')); return }
    void update({ height_override_m: height.trim() ? v : null }, t('element.saved'))
  }

  function saveFaces(event: FormEvent) {
    event.preventDefault()
    const faces = { ...(element.faces || {}), faceA: faceA.trim() || undefined, faceB: faceB.trim() || undefined, flip }
    void update({ faces }, t('element.saved'))
  }

  function changeKind(next: 'door' | 'window' | 'void') {
    setKind(next)
    const p = OPENING_PRESETS[next]
    setOp(o => ({ ...o, w: n(p.w), h: n(p.h), sill: n(p.sill) }))
  }

  function addNew(event: FormEvent) {
    event.preventDefault()
    const candidate = { off: parseLocaleNumber(op.off), w: parseLocaleNumber(op.w), h: parseLocaleNumber(op.h), sill: parseLocaleNumber(op.sill) }
    if (!Number.isFinite(candidate.off)) { setError(t('opening.error.length', { length: n(lengthM) })); return }
    const problem = validateOpening(candidate, lengthM, heightM, element.openings || [])
    if (problem) { setError(t(errorKey[problem], { length: n(lengthM), height: n(heightM) })); return }
    void update({ openings: addOpening(element.openings || [], { ...candidate, kind }) }, t('opening.added'))
  }

  function pickOnPlan() {
    if (!onPickOnPlan) return
    const candidate = { w: parseLocaleNumber(op.w), h: parseLocaleNumber(op.h), sill: parseLocaleNumber(op.sill) }
    if (!(candidate.w > 0) || !(candidate.h > 0) || !(candidate.sill >= 0)) { setError(t('opening.error.size')); return }
    if (candidate.sill + candidate.h > heightM + 1e-3) { setError(t('opening.error.height', { height: n(heightM) })); return }
    if (candidate.w > lengthM + 1e-3) { setError(t('opening.error.length', { length: n(lengthM) })); return }
    setError('')
    onPickOnPlan({ ...candidate, kind })
  }

  function startEdit(index: number) {
    const o = (element.openings || [])[index]
    if (!o) return
    setEditIdx(index)
    setEd({ kind: o.kind === 'door' || o.kind === 'window' ? o.kind : 'void', off: n(o.off), w: n(o.w), h: n(o.h), sill: n(o.sill), all: false })
    setError('')
  }

  /** Same type and size as the opening being edited (for "apply to all identical"). */
  const sameAs = (a: ElementOpening, b: ElementOpening) =>
    a.kind === b.kind && Math.abs(a.w - b.w) < 1e-3 && Math.abs(a.h - b.h) < 1e-3 && Math.abs(a.sill - b.sill) < 1e-3

  function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (editIdx == null) return
    const list = element.openings || []
    const original = list[editIdx]
    if (!original) return
    const size = { w: parseLocaleNumber(ed.w), h: parseLocaleNumber(ed.h), sill: parseLocaleNumber(ed.sill) }
    const off = parseLocaleNumber(ed.off)
    if (!Number.isFinite(off)) { setError(t('opening.error.length', { length: n(lengthM) })); return }
    // Which openings change: this one, or every identical one on the wall (keeping their positions).
    const targets = new Set(list.map((o, i) => i).filter(i => i === editIdx || (ed.all && sameAs(list[i], original))))
    const next = list.map((o, i) => (targets.has(i) ? { ...o, kind: ed.kind, ...size, off: i === editIdx ? off : o.off } : o))
    for (const i of targets) {
      const problem = validateOpening(next[i], lengthM, heightM, next.filter((_, j) => j !== i))
      if (problem) { setError(t(errorKey[problem], { length: n(lengthM), height: n(heightM) })); return }
    }
    setEditIdx(null)
    void update({ openings: [...next].sort((a, b) => a.off - b.off) }, t(targets.size > 1 ? 'opening.updatedMany' : 'opening.updated', { count: targets.size }))
  }

  function remove(index: number) {
    const next = (element.openings || []).filter((_, i) => i !== index)
    void update({ openings: next }, t('opening.removed'))
  }

  const openings: ElementOpening[] = element.openings || []

  async function saveTags(event: FormEvent) {
    event.preventDefault()
    const list: (string | null)[] = Array.from({ length: segCount }, (_, i) => (tagEdit[i] || '').trim() || null)
    while (list.length && list[list.length - 1] == null) list.pop()
    setBusy(true)
    setError('')
    const { error: e } = await createClient().from('takeoff_elements').update({ segment_tags: list }).eq('id', element.id)
    setBusy(false)
    if (e) { setError(/segment_tags/.test(e.message) ? t('tags.needsMigration') : t('workspace.error', { message: e.message })); return }
    await onSaved(t('tags.saved'))
  }

  return (
    <div style={{ ...ui.panel, gap: 12 }}>
      <h2 style={ui.panelTitle}>{t('element.title')}</h2>
      <div style={ui.small}>{t('element.summary', { length: n(lengthM), height: n(heightM) })}</div>
      {error && <div style={ui.error}>{error}</div>}

      <form onSubmit={saveHeight} style={rowForm}>
        <label style={field}>
          {t('element.height')}
          <input style={{ ...input, width: 110 }} inputMode="decimal" placeholder={n(item.height || 0)} value={height} onChange={e => setHeight(e.target.value)} />
        </label>
        <button type="submit" style={smallBtn} disabled={busy}>{t('element.save')}</button>
        <span style={ui.small}>{t('element.heightHint')}</span>
      </form>

      {tagged && (
        <form onSubmit={saveTags} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ fontSize: 12, color: '#173441' }}>{t('tags.title')}</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 230, overflow: 'auto' }}>
            {Array.from({ length: segCount }, (_, i) => (
              <label key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', gap: 8, fontSize: 11, color: '#536d78' }}>
                <span>{n(dist(element.points[i], element.points[i + 1]) / ptPerM)} m</span>
                <input
                  style={{ ...input, width: '100%' }}
                  placeholder={element.tag_auto?.[i] || ''}
                  value={tagEdit[i] || ''}
                  maxLength={24}
                  onChange={e => setTagEdit(prev => { const next = [...prev]; next[i] = e.target.value; return next })}
                />
              </label>
            ))}
          </div>
          <div style={rowForm}>
            <button type="submit" style={smallBtn} disabled={busy}>{t('element.save')}</button>
            <span style={ui.small}>{t('tags.editHint')}</span>
          </div>
        </form>
      )}

      {framed && (
        <form onSubmit={saveFaces} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong style={{ fontSize: 12, color: '#173441' }}>{t('element.faces')}</strong>
          <datalist id={`boards-${element.id}`}>
            {[item.framing?.boardA, item.framing?.boardB, ...BOARD_SUGGESTIONS].filter((v, i, a): v is string => !!v && a.indexOf(v) === i).map(v => <option key={v} value={v} />)}
          </datalist>
          <div style={rowForm}>
            <label style={field}>{t('framing.boardA')}<input style={{ ...input, width: 200 }} list={`boards-${element.id}`} placeholder={item.framing?.boardA} value={faceA} onChange={e => setFaceA(e.target.value)} /></label>
            <label style={field}>{t('framing.boardB')}<input style={{ ...input, width: 200 }} list={`boards-${element.id}`} placeholder={item.framing?.boardB} value={faceB} onChange={e => setFaceB(e.target.value)} /></label>
          </div>
          <label style={check}><input type="checkbox" checked={flip} onChange={e => setFlip(e.target.checked)} />{t('element.flip')}</label>
          <div style={rowForm}>
            <button type="submit" style={smallBtn} disabled={busy}>{t('element.save')}</button>
            <span style={ui.small}>{t('element.facesHint')}</span>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong style={{ fontSize: 12, color: '#173441' }}>{t('opening.title')}</strong>
        {openings.length === 0 ? (
          <div style={ui.small}>{t('opening.empty')}</div>
        ) : openings.map((o, i) => editIdx === i ? (
          <form key={`${o.off}-${i}`} onSubmit={saveEdit} style={{ ...ui.listItem, gap: 8, borderColor: '#9fd8d2', background: '#f2fbfa' }}>
            <div style={rowForm}>
              <label style={field}>
                {t('opening.kind')}
                <select style={{ ...input, width: 120 }} value={ed.kind} onChange={e => setEd(v => ({ ...v, kind: e.target.value as typeof v.kind }))}>
                  <option value="door">{t('opening.kind.door')}</option>
                  <option value="window">{t('opening.kind.window')}</option>
                  <option value="void">{t('opening.kind.void')}</option>
                </select>
              </label>
              <label style={field}>{t('opening.off')}<input style={{ ...input, width: 100 }} inputMode="decimal" value={ed.off} onChange={e => setEd(v => ({ ...v, off: e.target.value }))} /></label>
              <label style={field}>{t('opening.w')}<input autoFocus style={{ ...input, width: 80 }} inputMode="decimal" value={ed.w} onChange={e => setEd(v => ({ ...v, w: e.target.value }))} /></label>
              <label style={field}>{t('opening.h')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={ed.h} onChange={e => setEd(v => ({ ...v, h: e.target.value }))} /></label>
              <label style={field}>{t('opening.sill')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={ed.sill} onChange={e => setEd(v => ({ ...v, sill: e.target.value }))} /></label>
            </div>
            {openings.filter(x => sameAs(x, o)).length > 1 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#294955' }}>
                <input type="checkbox" checked={ed.all} onChange={e => setEd(v => ({ ...v, all: e.target.checked }))} />
                {t('opening.applyAll', { count: openings.filter(x => sameAs(x, o)).length })}
              </label>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={smallBtn} disabled={busy}>{t('opening.save')}</button>
              <button type="button" style={{ ...smallBtn, background: '#fff', color: '#294955', border: '1px solid #d3dfe2' }} onClick={() => setEditIdx(null)}>{t('tool.cancel')}</button>
            </div>
          </form>
        ) : (
          <div key={`${o.off}-${i}`} style={{ ...ui.listItem, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span>
              <strong>{t(kindKey[(o.kind === 'door' || o.kind === 'window' ? o.kind : 'void')])}</strong>{' '}
              <span style={ui.small}>{t('opening.detail', { w: n(o.w), h: n(o.h), sill: n(o.sill), off: n(o.off) })}</span>
              {o.guid && <span style={ui.small}> · IFC</span>}
            </span>
            <span style={{ display: 'flex', gap: 4 }}>
              <button type="button" style={editBtn} disabled={busy} title={t('opening.edit')} onClick={() => startEdit(i)}>✎</button>
              <button type="button" style={removeBtn} disabled={busy} title={t('opening.remove')} onClick={() => remove(i)}>×</button>
            </span>
          </div>
        ))}
        <form onSubmit={addNew} style={rowForm}>
          <label style={field}>
            {t('opening.kind')}
            <select style={{ ...input, width: 140 }} value={kind} onChange={e => changeKind(e.target.value as 'door' | 'window' | 'void')}>
              <option value="door">{t('opening.kind.door')}</option>
              <option value="window">{t('opening.kind.window')}</option>
              <option value="void">{t('opening.kind.void')}</option>
            </select>
          </label>
          <label style={field}>{t('opening.off')}<input style={{ ...input, width: 100 }} inputMode="decimal" value={op.off} onChange={e => setOp(v => ({ ...v, off: e.target.value }))} /></label>
          <label style={field}>{t('opening.w')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={op.w} onChange={e => setOp(v => ({ ...v, w: e.target.value }))} /></label>
          <label style={field}>{t('opening.h')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={op.h} onChange={e => setOp(v => ({ ...v, h: e.target.value }))} /></label>
          <label style={field}>{t('opening.sill')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={op.sill} onChange={e => setOp(v => ({ ...v, sill: e.target.value }))} /></label>
          <button type="submit" style={smallBtn} disabled={busy}>+ {t('opening.add')}</button>
          {onPickOnPlan && (
            <button type="button" style={{ ...smallBtn, background: picking ? '#2563EB' : '#fff', color: picking ? '#fff' : '#0d7f77', border: '1px solid ' + (picking ? '#2563EB' : '#9fd8d2') }} disabled={busy} onClick={pickOnPlan}>
              {picking ? t('opening.picking') : t('opening.pickOnPlan')}
            </button>
          )}
        </form>
        <div style={ui.small}>{t('opening.hint', { length: n(lengthM) })}</div>
      </div>
    </div>
  )
}

const rowForm = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' } as const
const field = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const input = { height: 30, padding: '0 7px', border: '1px solid #d6e0e3', borderRadius: 6, fontSize: 11, background: '#fff', boxSizing: 'border-box' } as const
const check = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#294955' } as const
const smallBtn = { ...ui.button, height: 30, fontSize: 10 } as const
const editBtn = { width: 26, height: 26, border: '1px solid #d3dfe2', borderRadius: 6, background: '#fff', color: '#294955', cursor: 'pointer' } as const
const removeBtn = { width: 26, height: 26, border: '1px solid #efcaca', borderRadius: 6, background: '#fff7f7', color: '#c94a4a', cursor: 'pointer' } as const
