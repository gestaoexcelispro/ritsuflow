'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import type { TakeoffItem } from '@/lib/takeoff/geometry'
import { KIND_COLOR, ZONE_KINDS, containingZone, takeoffInZone, zoneStats, type ZoneKind, type ZoneRow } from '@/lib/takeoff/zones'
import type { LevelRow } from '@/lib/takeoff/levels'
import type { SourceRow } from '@/lib/takeoff/rows'
import { createLocationsForZones, loadLocations, locationTree, suggestedParentId, type ProjectLocation } from '@/lib/takeoff/locationSync'
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import { useRitsuScopeLicensed } from '../license'

type Props = {
  zone: ZoneRow
  ptPerM: number
  items: TakeoffItem[]
  projectId: string
  /** Every zone of the project, levels and sheets: to place the zone in the location tree. */
  zones: ZoneRow[]
  levels: LevelRow[]
  sources: SourceRow[]
  onSaved: (message: string) => Promise<void> | void
  onDelete: () => void
}

/** Right sidebar in Zoning mode: spatial information about the selected location. */
export default function ZoneProperties({ zone, ptPerM, items, projectId, zones, levels, sources, onSaved, onDelete }: Props) {
  const t = useTakeoffT()
  const licensed = useRitsuScopeLicensed()
  const { formatNumber } = useLanguage()
  const n = (v: number) => formatNumber(v, 2)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(zone.name)
  const [color, setColor] = useState(zone.color)
  const [height, setHeight] = useState('')
  const [locationId, setLocationId] = useState(zone.location_id || '')
  const [kind, setKind] = useState<ZoneKind>(zone.zone_kind || 'room')
  const [locations, setLocations] = useState<ProjectLocation[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(zone.name)
    setColor(zone.color)
    setHeight(zone.ceiling_height_m == null ? '' : formatNumber(Number(zone.ceiling_height_m), 2))
    setLocationId(zone.location_id || '')
    setKind(zone.zone_kind || 'room')
    setError('')
    // Reset only when another zone is selected or it was saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.id, zone.name, zone.color, zone.ceiling_height_m, zone.location_id, zone.zone_kind])

  useEffect(() => {
    let alive = true
    // The project's Location Breakdown (RitsuFlow locations), shown as a tree.
    loadLocations(createClient(), projectId).then(rows => { if (alive) setLocations(rows) }).catch(() => { if (alive) setLocations([]) })
    return () => { alive = false }
  }, [projectId, zone.location_id])
  const tree = useMemo(() => locationTree(locations), [locations])
  const byId = useMemo(() => new Map(locations.map(l => [l.id, l] as [string, ProjectLocation])), [locations])
  const container = useMemo(() => containingZone(zone, zones), [zone, zones])
  const parentId = useMemo(() => suggestedParentId(zone, zones, levels, sources), [zone, zones, levels, sources])

  async function addToBreakdown() {
    setBusy(true)
    setError('')
    try {
      await createLocationsForZones(createClient(), { projectId, targets: [zone], zones, levels, sources, locations })
      await onSaved(t('zone.locationCreated', { name: zone.name }))
    } catch (e) {
      setError(t('workspace.error', { message: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusy(false)
    }
  }

  const stats = useMemo(() => zoneStats(zone, ptPerM), [zone, ptPerM])
  const inside = useMemo(() => takeoffInZone(zone.points, items, ptPerM), [zone.points, items, ptPerM])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) { setError(t('layer.nameRequired')); return }
    const h = parseLocaleNumber(height)
    if (height.trim() && !(h > 0)) { setError(t('element.heightInvalid')); return }
    setBusy(true)
    setError('')
    const { error: e } = await createClient().from('takeoff_zones').update({
      name: name.trim(),
      color,
      ceiling_height_m: height.trim() ? h : null,
      location_id: locationId || null,
      zone_kind: kind,
    }).eq('id', zone.id)
    setBusy(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setEditing(false)
    await onSaved(t('zone.saved'))
  }

  const row = (label: string, value: string) => (
    <div style={rowStyle} key={label}>
      <span style={{ color: '#4b6570' }}>{label}</span>
      <span style={{ color: '#173441', fontWeight: 600 }}>{value}</span>
    </div>
  )
  const loc = zone.location_id ? byId.get(zone.location_id) : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #e5ecee' }}>
        <div style={sectionTitle}>{t('zone.properties')}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 6, background: zone.color }} />
          <strong style={{ fontSize: 17, color: '#173441', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{zone.name}</strong>
          <span style={tag}>{t(`zone.kind.${zone.zone_kind || 'room'}` as TakeoffMessageKey)}</span>
        </div>
        {container && <div style={{ fontSize: 11, color: '#6b8089', marginTop: -8 }}>{t('zone.inside', { name: container.name })}</div>}

        <div style={{ padding: 12, border: `1px solid ${loc ? '#cfe6e2' : '#f1d9b8'}`, borderRadius: 10, background: loc ? '#f3fbfa' : '#fffaf2', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={sectionTitle}>{t('zone.lbs')}</div>
          {loc ? (
            <div style={{ fontSize: 12, color: '#173441' }}>{t('zone.linkedTo')} <strong>{loc.name}</strong>{loc.parent_id && byId.get(loc.parent_id) ? <span style={{ color: '#6b8089' }}> · {byId.get(loc.parent_id)!.name}</span> : null}</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#7c4a03' }}>{t('zone.notLinked')}</div>
              <div style={{ fontSize: 11, color: '#6b8089' }}>{t('zone.createUnder', { parent: parentId ? byId.get(parentId)?.name || '—' : t('zone.root') })}</div>
              <button type="button" style={{ ...primary, background: '#6d28d9', alignSelf: 'flex-start' }} disabled={busy} onClick={() => void addToBreakdown()}>{t('zone.createLocation')}</button>
            </>
          )}
        </div>

        {editing && (
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, border: '1px solid #dfe7ea', borderRadius: 10, background: '#fbfdfd' }}>
            <label style={field}>{t('zone.name')}<input autoFocus style={input} value={name} onChange={e => setName(e.target.value)} /></label>
            <label style={field}>{t('zone.kind')}
              <select style={input} value={kind} onChange={e => { const k = e.target.value as ZoneKind; setKind(k); if (color === KIND_COLOR[kind]) setColor(KIND_COLOR[k]) }}>
                {ZONE_KINDS.map(k => <option key={k} value={k}>{t(`zone.kind.${k}` as TakeoffMessageKey)}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ ...field, flex: 1 }}>{t('zone.ceilingHeight')}<input style={input} inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} placeholder="2,80" /></label>
              <label style={field}>{t('layer.color')}<input type="color" style={{ ...input, width: 52, padding: 2 }} value={color} onChange={e => setColor(e.target.value)} /></label>
            </div>
            <label style={field}>{t('zone.planningLocation')}
              <select style={input} value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">—</option>
                {tree.map(({ location: l, depth }) => <option key={l.id} value={l.id}>{'\u00a0\u00a0\u00a0'.repeat(depth)}{l.name} · {l.location_type}</option>)}
              </select>
            </label>
            {error && <div style={{ fontSize: 11, color: '#a44343' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={primary} disabled={busy}>{t('zone.save')}</button>
              <button type="button" style={secondary} onClick={() => setEditing(false)}>{t('tool.cancel')}</button>
            </div>
          </form>
        )}

        <div>
          <div style={sectionTitle}>{t('zone.spatial')}</div>
          <div style={{ marginTop: 8 }}>
            {row(t('zone.area'), ptPerM > 0 ? `${n(stats.areaM2)} m²` : '—')}
            {row(t('zone.perimeter'), ptPerM > 0 ? `${n(stats.perimeterM)} m` : '—')}
            {row(t('zone.ceilingHeight'), stats.heightM ? `${n(stats.heightM)} m` : t('zone.notSet'))}
            {row(t('zone.volume'), stats.volumeM3 != null && ptPerM > 0 ? `${n(stats.volumeM3)} m³` : '—')}
            {licensed && row(t('zone.wallLength'), ptPerM > 0 ? `${n(stats.perimeterM)} m` : '—')}
            {licensed && row(t('zone.wallArea'), stats.wallAreaM2 != null && ptPerM > 0 ? `${n(stats.wallAreaM2)} m²` : '—')}
            {row(t('zone.planningLocation'), loc ? loc.name : '—')}
          </div>
          {licensed && <div style={{ fontSize: 10, color: '#8aa0a8', marginTop: 6 }}>{t('zone.statsNote')}</div>}
        </div>

        {licensed ? <div>
          <div style={sectionTitle}>{t('zone.takeoffInside')}</div>
          <div style={{ marginTop: 8 }}>
            {inside.length === 0 ? (
              <div style={{ fontSize: 11, color: '#6b8089' }}>{t('zone.takeoffEmpty')}</div>
            ) : inside.map(line => row(
              line.name,
              line.kind === 'linear' ? `${n(line.lengthM)} m` : line.kind === 'area' ? `${n(line.areaM2)} m²` : `${line.count} ${t('unit.un')}`,
            ))}
          </div>
          {inside.length > 0 && <div style={{ fontSize: 10, color: '#8aa0a8', marginTop: 6 }}>{t('zone.takeoffNote')}</div>}
        </div> : (
          <div style={{ padding: 10, border: '1px dashed #d3dfe2', borderRadius: 8, fontSize: 11, color: '#6b8089' }}>🔒 {t('zone.takeoffInside')} · {t('license.locked')}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, padding: 14, borderTop: '1px solid #e5ecee' }}>
        <button type="button" style={{ ...primary, flex: 1, height: 42 }} onClick={() => setEditing(v => !v)}>{t('zone.edit')}</button>
        <button type="button" style={{ ...secondary, height: 42, padding: '0 22px' }} onClick={onDelete}>{t('zone.delete')}</button>
      </div>
    </div>
  )
}

const sectionTitle = { fontSize: 11, fontWeight: 800, color: '#173441', letterSpacing: '.06em', textTransform: 'uppercase' } as const
const rowStyle = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, padding: '9px 10px', borderBottom: '1px solid #edf1f2', fontSize: 12 } as const
const tag = { padding: '3px 8px', borderRadius: 6, background: '#eef3f4', border: '1px solid #dfe7ea', fontSize: 10, color: '#4b6570' } as const
const field = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const input = { height: 32, padding: '0 8px', border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12, background: '#fff', boxSizing: 'border-box' } as const
const primary = { height: 34, padding: '0 14px', border: 0, borderRadius: 8, background: '#109d91', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' } as const
const secondary = { height: 34, padding: '0 14px', border: '1px solid #d3dfe2', borderRadius: 8, background: '#fff', color: '#294955', fontSize: 12, fontWeight: 700, cursor: 'pointer' } as const
