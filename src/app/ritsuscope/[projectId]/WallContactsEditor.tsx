'use client'

// What one wall touches at each end, the top and the floor. Anchors and acoustic band follow this
// instead of the automatic detection (framing.ts › fixingsForWall / endsWithContacts):
//   end   other system → anchors + band · drywall wall → junction studs only · nothing → no fixing
//   top   slab → anchors + band · drywall ceiling → screws + band · nothing → no fixing
//   floor slab → anchors + band · nothing → no fixing
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { EndContact, FloorContact, TopContact, Vec2, WallContacts } from '@/lib/takeoff/geometry'
import type { FreeEnds } from '@/lib/takeoff/framing/framing'
import type { ElementRow } from '@/lib/takeoff/rows'
import { ui } from '../ui'

type Props = {
  element: Pick<ElementRow, 'id' | 'faces' | 'points'>
  /** Detected free ends (no framed wall there), to show what "Automatic" means for each end. */
  autoEnds?: FreeEnds | null
  onSaved: (message: string) => Promise<void> | void
  compact?: boolean
}

/** Where an end sits on the plan (y down), so the user knows which one is "start". */
function sideOnPlan(pts: Vec2[], which: 'start' | 'end'): 'left' | 'right' | 'top' | 'bottom' | null {
  if (!pts || pts.length < 2) return null
  const a = pts[0], b = pts[pts.length - 1]
  const [p, q] = which === 'start' ? [a, b] : [b, a]
  const dx = q[0] - p[0], dy = q[1] - p[1]
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'left' : 'right'
  return dy > 0 ? 'top' : 'bottom'
}

export default function WallContactsEditor({ element, autoEnds, onSaved, compact = false }: Props) {
  const t = useTakeoffT()
  const saved: WallContacts = element.faces?.contacts || {}
  const [c, setC] = useState<Required<WallContacts>>({ start: saved.start || 'auto', end: saved.end || 'auto', top: saved.top || 'slab', floor: saved.floor || 'slab' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const s = element.faces?.contacts || {}
    setC({ start: s.start || 'auto', end: s.end || 'auto', top: s.top || 'slab', floor: s.floor || 'slab' })
    setError('')
  }, [element.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = c.start !== (saved.start || 'auto') || c.end !== (saved.end || 'auto') || c.top !== (saved.top || 'slab') || c.floor !== (saved.floor || 'slab')

  async function save() {
    setBusy(true)
    setError('')
    // Defaults are not stored: an untouched wall keeps following the automatic rule.
    const contacts: WallContacts = {}
    if (c.start !== 'auto') contacts.start = c.start
    if (c.end !== 'auto') contacts.end = c.end
    if (c.top !== 'slab') contacts.top = c.top
    if (c.floor !== 'slab') contacts.floor = c.floor
    const faces = { ...(element.faces || {}), contacts: Object.keys(contacts).length ? contacts : undefined }
    const { error: e } = await createClient().from('takeoff_elements').update({ faces }).eq('id', element.id)
    setBusy(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await onSaved(t('contacts.saved'))
  }

  const sel = { height: 28, padding: '0 6px', border: '1px solid #d6e0e3', borderRadius: 6, fontSize: 11.5, background: '#fff', minWidth: 0, width: '100%' } as const
  const label = { fontSize: 11, color: '#536d78', fontWeight: 700 } as const
  const endRow = (which: 'start' | 'end') => {
    const side = sideOnPlan(element.points, which)
    const auto = autoEnds ? (autoEnds[which] ? t('contacts.end.system') : t('contacts.end.drywall')) : null
    return (
      <label style={{ display: 'grid', gap: 3 }}>
        <span style={label}>{t(which === 'start' ? 'contacts.start' : 'contacts.endEnd')}{side ? ` · ${t(`contacts.side.${side}` as const)}` : ''}</span>
        <select style={sel} value={c[which]} onChange={e => setC(v => ({ ...v, [which]: e.target.value as EndContact }))}>
          <option value="auto">{auto ? t('contacts.autoIs', { value: auto }) : t('contacts.auto')}</option>
          <option value="system">{t('contacts.end.system')}</option>
          <option value="drywall">{t('contacts.end.drywall')}</option>
          <option value="none">{t('contacts.end.none')}</option>
        </select>
      </label>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!compact && <strong style={{ fontSize: 12, color: '#173441' }}>{t('contacts.title')}</strong>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {endRow('start')}
        {endRow('end')}
        <label style={{ display: 'grid', gap: 3 }}>
          <span style={label}>{t('contacts.top')}</span>
          <select style={sel} value={c.top} onChange={e => setC(v => ({ ...v, top: e.target.value as TopContact }))}>
            <option value="slab">{t('contacts.top.slab')}</option>
            <option value="drywall_ceiling">{t('contacts.top.drywall_ceiling')}</option>
            <option value="none">{t('contacts.top.none')}</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 3 }}>
          <span style={label}>{t('contacts.floor')}</span>
          <select style={sel} value={c.floor} onChange={e => setC(v => ({ ...v, floor: e.target.value as FloorContact }))}>
            <option value="slab">{t('contacts.floor.slab')}</option>
            <option value="none">{t('contacts.floor.none')}</option>
          </select>
        </label>
      </div>
      {error && <div style={{ ...ui.small, color: '#b91c1c' }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy || !dirty} onClick={() => void save()}
          style={{ height: 28, padding: '0 12px', border: 0, borderRadius: 6, background: dirty ? '#0f766e' : '#94a3b8', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: dirty ? 'pointer' : 'default' }}>{t('contacts.save')}</button>
        <span style={{ ...ui.small, flex: 1 }}>{t('contacts.hint')}</span>
      </div>
    </div>
  )
}
