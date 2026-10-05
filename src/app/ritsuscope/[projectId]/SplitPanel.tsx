'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { polyLen } from '@/lib/takeoff/geometry'
import type { ElementRow } from '@/lib/takeoff/rows'
import { splitWall } from '@/lib/takeoff/split'
import { ui } from '../ui'

type Props = {
  element: ElementRow
  ptPerM: number
  onDone: (newElementId: string, message: string) => Promise<void> | void
}

/** Splits the selected wall in two. Both pieces keep the original IFC GlobalId as root. */
export default function SplitPanel({ element, ptPerM, onDone }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const [distance, setDistance] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const length = polyLen(element.points) / ptPerM

  async function split(event: FormEvent) {
    event.preventDefault()
    setError('')
    const d = parseLocaleNumber(distance)
    const result = splitWall(
      { pts: element.points, openings: element.openings, root: element.root_guid, guid: element.ifc_guid },
      d,
      ptPerM,
    )
    if (!result) { setError(t('split.invalid', { length: formatNumber(length, 2) })); return }
    setBusy(true)
    const supabase = createClient()
    // Update the original first, then add the second piece; undo the update if the insert fails.
    const update = await supabase
      .from('takeoff_elements')
      .update({ points: result.a.pts, openings: result.a.openings, root_guid: result.a.root })
      .eq('id', element.id)
    if (update.error) { setBusy(false); setError(t('workspace.error', { message: update.error.message })); return }
    const insert = await supabase
      .from('takeoff_elements')
      .insert({
        project_id: element.project_id,
        layer_id: element.layer_id,
        source_id: element.source_id,
        points: result.b.pts,
        openings: result.b.openings,
        root_guid: result.b.root,
        ifc_guid: element.ifc_guid,
        layer_guids: element.layer_guids,
        height_override_m: element.height_override_m,
        z_rel_m: element.z_rel_m,
        faces: element.faces,
      })
      .select('id')
      .single()
    if (insert.error || !insert.data) {
      await supabase.from('takeoff_elements').update({ points: element.points, openings: element.openings, root_guid: element.root_guid }).eq('id', element.id)
      setBusy(false)
      setError(t('workspace.error', { message: insert.error?.message || '' }))
      return
    }
    setBusy(false)
    setDistance('')
    const parts = [t('split.done', { a: formatNumber(d, 2), b: formatNumber(length - d, 2) })]
    if (result.crossesOpening) parts.push(t('split.crossing'))
    await onDone(insert.data.id, parts.join(' '))
  }

  return (
    <form onSubmit={split} style={{ ...ui.panel, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <strong style={{ fontSize: 12, color: '#173441' }}>{t('split.title')}</strong>
        <span style={ui.small}>{t('split.length', { length: formatNumber(length, 2) })}</span>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' }}>
        {t('split.distance')}
        <input
          style={{ height: 32, width: 120, padding: '0 8px', border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12 }}
          inputMode="decimal"
          value={distance}
          onChange={e => setDistance(e.target.value)}
        />
      </label>
      <button type="submit" style={{ ...ui.button, opacity: busy ? 0.6 : 1 }} disabled={busy}>{t('split.action')}</button>
      {error && <div style={{ ...ui.error, width: '100%' }}>{error}</div>}
    </form>
  )
}
