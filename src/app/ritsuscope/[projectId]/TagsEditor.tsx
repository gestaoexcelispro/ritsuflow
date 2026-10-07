'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { dist, type LayerKind } from '@/lib/takeoff/geometry'
import type { ElementRow } from '@/lib/takeoff/rows'
import { tagSlots } from '@/lib/takeoff/segmentTags'
import { ui } from '../ui'

type Props = {
  element: ElementRow
  kind: LayerKind
  ptPerM: number
  onSaved: (message: string) => Promise<void> | void
}

/**
 * Rename the tags of a drawn element: one per stretch for walls and lines (with its length),
 * a single one for an area or a counted point. Empty = automatic tag (shown as the placeholder).
 */
export default function TagsEditor({ element, kind, ptPerM, onSaved }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const slots = tagSlots(kind, element.points || [])
  const [values, setValues] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setValues(Array.from({ length: tagSlots(kind, element.points || []) }, (_, i) => {
      const v = Array.isArray(element.segment_tags) ? element.segment_tags[i] : null
      return typeof v === 'string' ? v : ''
    }))
    setError('')
    // Reset only when another element is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.id])

  if (!slots) return null

  async function save(event: FormEvent) {
    event.preventDefault()
    const list: (string | null)[] = Array.from({ length: slots }, (_, i) => (values[i] || '').trim() || null)
    while (list.length && list[list.length - 1] == null) list.pop()
    setBusy(true)
    setError('')
    const { error: e } = await createClient().from('takeoff_elements').update({ segment_tags: list }).eq('id', element.id)
    setBusy(false)
    if (e) { setError(/segment_tags/.test(e.message) ? t('tags.needsMigration') : t('workspace.error', { message: e.message })); return }
    await onSaved(t('tags.saved'))
  }

  const input = (i: number) => (
    <input
      style={{ height: 30, padding: '0 7px', border: '1px solid #d6e0e3', borderRadius: 6, fontSize: 11, background: '#fff', boxSizing: 'border-box', width: '100%' }}
      placeholder={element.tag_auto?.[i] || ''}
      value={values[i] || ''}
      maxLength={24}
      onChange={e => setValues(prev => { const next = [...prev]; next[i] = e.target.value; return next })}
    />
  )

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <strong style={{ fontSize: 12, color: '#173441' }}>{t(kind === 'linear' ? 'tags.title' : 'tags.titleOne')}</strong>
      {kind === 'linear' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 230, overflow: 'auto' }}>
          {Array.from({ length: slots }, (_, i) => (
            <label key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', gap: 8, fontSize: 11, color: '#536d78' }}>
              <span>{ptPerM > 0 ? `${formatNumber(dist(element.points[i], element.points[i + 1]) / ptPerM, 2)} m` : `#${i + 1}`}</span>
              {input(i)}
            </label>
          ))}
        </div>
      ) : input(0)}
      {error && <div style={ui.error}>{error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button type="submit" style={{ ...ui.button, height: 30, fontSize: 10 }} disabled={busy}>{t('element.save')}</button>
        <span style={ui.small}>{t('tags.editHint')}</span>
      </div>
    </form>
  )
}
