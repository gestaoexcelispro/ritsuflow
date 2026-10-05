'use client'

import { useMemo, useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { polyArea } from '@/lib/takeoff/geometry'
import type { ZoneRow } from '@/lib/takeoff/zones'
import Icon from './icons'

type Props = {
  zones: ZoneRow[]
  sheetName: string | null
  ptPerM: number
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDetect: () => void
  onToggleVisible: (zone: ZoneRow) => void
  onRename: (zone: ZoneRow) => void
  onDelete: (zone: ZoneRow) => void
  /** Bulk actions on the ticked locations. */
  onDeleteMany: (zones: ZoneRow[]) => Promise<boolean> | boolean
  onSetVisibleMany: (zones: ZoneRow[], visible: boolean) => Promise<void> | void
  /** Shown instead of the list when zoning isn't available yet (e.g. database not ready). */
  unavailable?: string | null
}

/** Left sidebar in Zoning mode: the locations drawn on the current sheet. */
export default function ZoningSidebar({ zones, sheetName, ptPerM, selectedId, onSelect, onAdd, onDetect, onToggleVisible, onRename, onDelete, onDeleteMany, onSetVisibleMany, unavailable }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const [search, setSearch] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? zones.filter(z => z.name.toLowerCase().includes(q)) : zones
  }, [zones, search])
  /** Ticked locations (bulk actions) and the last one clicked (Shift-click ranges). */
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const last = useRef<string | null>(null)
  const checkedZones = zones.filter(z => checked.has(z.id))
  const allChecked = visible.length > 0 && visible.every(z => checked.has(z.id))

  function toggle(id: string, shift: boolean) {
    setChecked(prev => {
      const next = new Set(prev)
      const on = !prev.has(id)
      if (shift && last.current) {
        const ids = visible.map(z => z.id)
        const a = ids.indexOf(last.current)
        const b = ids.indexOf(id)
        if (a >= 0 && b >= 0) {
          for (const k of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) { if (on) next.add(k); else next.delete(k) }
          return next
        }
      }
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
    last.current = id
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #e5ecee' }}>
        <div style={title}>{t('zone.sidebarTitle')}</div>
      </div>
      <div style={{ padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={title}>{t('zone.locations')}</span>
          <button type="button" style={addBtn} onClick={onAdd} disabled={!!unavailable}><Icon name="plus" size={14} />{t('zone.add')}</button>
        </div>
        {sheetName && <span style={{ fontSize: 11, color: '#6b8089' }}>{t('zone.foundIn', { sheet: sheetName })}</span>}
        <button type="button" style={{ ...addBtn, justifyContent: 'center', color: '#0d7f77', borderColor: '#9fd8d2', background: '#f2fbfa' }} onClick={onDetect} disabled={!!unavailable}>
          <Icon name="detect" size={14} />{t('rooms.detect')}
        </button>
        <label style={searchBox}>
          <Icon name="search" size={15} style={{ color: '#8aa0a8' }} />
          <input style={{ border: 0, outline: 0, flex: 1, fontSize: 12, background: 'transparent' }} placeholder={t('zone.search')} value={search} onChange={e => setSearch(e.target.value)} />
        </label>
      </div>
      {!unavailable && zones.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#f2f7f8', borderTop: '1px solid #e5ecee', borderBottom: '1px solid #e5ecee', fontSize: 10, fontWeight: 800, color: '#536d78' }}>
          <input
            type="checkbox"
            title={t('bulk.selectAll')}
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = checkedZones.length > 0 && !allChecked }}
            onChange={() => setChecked(allChecked ? new Set() : new Set(visible.map(z => z.id)))}
            style={{ margin: 0 }}
          />
          <span>{t('bulk.selectAll')}</span>
        </div>
      )}
      {checkedZones.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff8f2', borderBottom: '1px solid #f3dcc8' }}>
          <strong style={{ fontSize: 11, color: '#7c2d12', flex: '1 0 100%' }}>{t('bulk.zonesSelected', { count: checkedZones.length })}</strong>
          <button type="button" style={addBtn} onClick={() => void onSetVisibleMany(checkedZones, true)}><Icon name="eye" size={13} />{t('zone.show')}</button>
          <button type="button" style={addBtn} onClick={() => void onSetVisibleMany(checkedZones, false)}><Icon name="eyeOff" size={13} />{t('zone.hide')}</button>
          <button
            type="button"
            style={{ ...addBtn, color: '#fff', background: '#c94a4a', borderColor: '#c94a4a' }}
            onClick={async () => { if (await onDeleteMany(checkedZones)) setChecked(new Set()) }}
          >
            <Icon name="trash" size={13} />{t('zone.delete')}
          </button>
          <button type="button" style={addBtn} onClick={() => setChecked(new Set())}>{t('bulk.clear')}</button>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {unavailable ? (
          <div style={empty}>{unavailable}</div>
        ) : visible.length === 0 ? (
          <div style={empty}>{zones.length ? t('zone.noMatch') : t('zone.empty')}</div>
        ) : visible.map(z => {
          const active = z.id === selectedId
          const area = ptPerM > 0 ? polyArea(z.points) / (ptPerM * ptPerM) : 0
          return (
            <div
              key={z.id}
              onClick={() => onSelect(z.id)}
              style={{
                position: 'relative', display: 'grid', gridTemplateColumns: '16px 18px minmax(0,1fr) auto 24px 24px', gap: 8, alignItems: 'center',
                padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f4f5',
                background: checked.has(z.id) ? '#fff4ec' : active ? '#e6f6f4' : 'transparent', boxShadow: active ? 'inset 3px 0 0 #109d91' : 'none', opacity: z.is_visible ? 1 : 0.5,
              }}
            >
              <input
                type="checkbox"
                checked={checked.has(z.id)}
                onClick={e => { e.stopPropagation(); toggle(z.id, e.shiftKey) }}
                onChange={() => { /* handled in onClick (needs Shift) */ }}
                style={{ margin: 0 }}
              />
              <span style={{ width: 16, height: 16, borderRadius: 4, background: z.color, opacity: 0.85 }} />
              <span style={{ fontSize: 13, fontWeight: 650, color: '#173441', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.name}</span>
              <span style={{ fontSize: 12, color: '#294955' }}>{ptPerM > 0 ? `${formatNumber(area, 2)} m²` : ''}</span>
              <button type="button" title={t(z.is_visible ? 'zone.hide' : 'zone.show')} style={iconBtn} onClick={e => { e.stopPropagation(); onToggleVisible(z) }}>
                <Icon name={z.is_visible ? 'eye' : 'eyeOff'} size={16} />
              </button>
              <button type="button" title={t('zone.more')} style={iconBtn} onClick={e => { e.stopPropagation(); setMenuFor(m => (m === z.id ? null : z.id)) }}>
                <Icon name="more" size={16} />
              </button>
              {menuFor === z.id && (
                <div style={menu} onClick={e => e.stopPropagation()}>
                  <button type="button" style={menuItem} onClick={() => { setMenuFor(null); onRename(z) }}>{t('zone.rename')}</button>
                  <button type="button" style={{ ...menuItem, color: '#c94a4a' }} onClick={() => { setMenuFor(null); onDelete(z) }}>{t('zone.delete')}</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const title = { fontSize: 11, fontWeight: 800, color: '#173441', letterSpacing: '.06em', textTransform: 'uppercase' } as const
const addBtn = { display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', border: '1px solid #d3dfe2', borderRadius: 7, background: '#fff', color: '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const
const searchBox = { display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', border: '1px solid #d6e0e3', borderRadius: 8, background: '#fff' } as const
const iconBtn = { width: 24, height: 24, display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: '#294955', cursor: 'pointer', borderRadius: 6, padding: 0 } as const
const empty = { padding: 14, fontSize: 11, color: '#6b8089', lineHeight: 1.5 } as const
const menu = { position: 'absolute', right: 10, top: 36, zIndex: 20, display: 'flex', flexDirection: 'column', minWidth: 140, padding: 4, background: '#fff', border: '1px solid #dfe7ea', borderRadius: 8, boxShadow: '0 6px 18px rgba(15,35,45,.14)' } as const
const menuItem = { textAlign: 'left', padding: '7px 10px', border: 0, background: 'transparent', fontSize: 12, color: '#294955', cursor: 'pointer', borderRadius: 6 } as const
