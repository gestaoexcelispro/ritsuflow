'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import { IFC_SHEET_PT_PER_M, importIfcModel, importLabelsEnUS, importLabelsPtBR } from '@/lib/takeoff/ifc/importIfcModel'
import { readIfc } from '@/lib/takeoff/ifc/readIfc'
import { compareRevisions, entitiesFromItems, entitiesFromStored, summarize, type RevisionDiff, type RevisionEntity } from '@/lib/takeoff/revision'
import type { ElementRow, LayerRow, SourceRow } from '@/lib/takeoff/rows'
import { ui } from '../ui'

type Props = { sources: SourceRow[]; layers: LayerRow[]; elements: ElementRow[] }

const statusKey: Record<Exclude<RevisionDiff['status'], 'unchanged'>, TakeoffMessageKey> = {
  added: 'revision.status.added',
  removed: 'revision.status.removed',
  changed: 'revision.status.changed',
}
const statusColor = { added: '#0b7c73', removed: '#b42318', changed: '#9a6700' } as const
const changeKey: Record<RevisionDiff['changes'][number], TakeoffMessageKey> = {
  measure: 'revision.change.measure',
  height: 'revision.change.height',
  openings: 'revision.change.openings',
}

/** Read-only comparison of the stored IFC elements with a new IFC file, by GlobalId. */
export default function RevisionPanel({ sources, layers, elements }: Props) {
  const t = useTakeoffT()
  const { formatNumber, language } = useLanguage()
  const [diffs, setDiffs] = useState<RevisionDiff[] | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const stored = useMemo(() => {
    const ifcSources = new Map(sources.filter(s => s.kind === 'ifc_storey').map(s => [s.id, Number(s.scale_pt_per_m) || IFC_SHEET_PT_PER_M]))
    const layerById = new Map(layers.map(l => [l.id, l]))
    return entitiesFromStored(
      elements
        .filter(e => ifcSources.has(e.source_id) && layerById.has(e.layer_id))
        .map(e => {
          const l = layerById.get(e.layer_id)!
          return {
            kind: l.kind,
            layerName: l.name,
            layerHeightM: l.height_m,
            points: e.points,
            heightOverrideM: e.height_override_m,
            ifcGuid: e.ifc_guid,
            rootGuid: e.root_guid,
            openings: e.openings,
            ptPerM: ifcSources.get(e.source_id)!,
          }
        }),
    )
  }, [sources, layers, elements])

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setDiffs(null)
    setStatus(t('revision.reading', { name: file.name }))
    try {
      const text = new TextDecoder('iso-8859-1').decode(await file.arrayBuffer())
      const model = importIfcModel(readIfc(text), language === 'en-US' ? importLabelsEnUS : importLabelsPtBR)
      setDiffs(compareRevisions(stored, entitiesFromItems(model.items, model.sheet.ptPerM)))
      setStatus('')
    } catch (err) {
      setStatus('')
      setError(t('workspace.ifc.readError', { message: err instanceof Error ? err.message : String(err) }))
    }
  }

  const measure = (e: RevisionEntity | null) => {
    if (!e) return '—'
    const value = e.kind === 'linear' ? `${formatNumber(e.measure, 2)} m` : e.kind === 'area' ? `${formatNumber(e.measure, 2)} m²` : `${e.measure}`
    const height = e.heightM != null ? ` × ${formatNumber(e.heightM, 2)} m` : ''
    const openings = e.kind === 'linear' && e.openings ? ` · ${e.openings} ${t('revision.change.openings')}` : ''
    return `${value}${height}${openings}`
  }

  if (stored.size === 0) {
    return (
      <div style={ui.panel}>
        <h2 style={ui.panelTitle}>{t('revision.title')}</h2>
        <div style={ui.small}>{t('revision.noIfc')}</div>
      </div>
    )
  }

  const visible = (diffs || []).filter(d => d.status !== 'unchanged')
  const s = diffs ? summarize(diffs) : null

  return (
    <div style={ui.panel}>
      <h2 style={ui.panelTitle}>{t('revision.title')}</h2>
      <div style={ui.small}>{t('revision.hint')}</div>
      <label style={{ ...ui.button, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}>
        {t('revision.choose')}
        <input type="file" accept=".ifc" onChange={handleFile} hidden />
      </label>
      {status && <div style={ui.small}>{status}</div>}
      {error && <div style={ui.error}>{error}</div>}
      {s && <div style={{ fontSize: 12, fontWeight: 700, color: '#173441' }}>{t('revision.summary', s)}</div>}
      {diffs && visible.length === 0 && <div style={ui.small}>{t('revision.none')}</div>}
      {visible.length > 0 && (
        <div style={{ ...ui.table, maxHeight: 320, overflow: 'auto' }}>
          <div style={{ ...gridRow, ...ui.tableHead }}>
            <span />
            <span>{t('csv.layer')}</span>
            <span>{t('revision.before')}</span>
            <span>{t('revision.after')}</span>
          </div>
          {visible.map(d => (
            <div key={d.guid} style={gridRow} title={d.guid}>
              <strong style={{ color: statusColor[d.status as keyof typeof statusColor] }}>
                {t(statusKey[d.status as keyof typeof statusKey])}
                {d.changes.length > 0 && <span style={{ fontWeight: 500 }}> ({d.changes.map(c => t(changeKey[c])).join(', ')})</span>}
              </strong>
              <span>{d.name}</span>
              <span>{measure(d.before)}</span>
              <span>{measure(d.after)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={ui.small}>{t('revision.positionNote')}</div>
    </div>
  )
}

const gridRow = { display: 'grid', gridTemplateColumns: '150px minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr)', gap: 8, alignItems: 'center', padding: '7px 12px', borderTop: '1px solid #edf1f2', fontSize: 11, color: '#294955' } as const
