'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { AppLanguage, NumberFormat } from '@/lib/i18n/settings'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import {
  DEFAULT_CORNER_STUDS,
  DEFAULT_LA_PER_STUD_END,
  DEFAULT_SCREW_SPACING,
  DEFAULT_TEE_STUDS,
  applyFramingDefaults,
  defaultFraming,
  parseBars,
  sanitizeFramingDefaults,
  type FramingDefaults,
} from '@/lib/takeoff/framing/framing'
import { ui } from '../ui'

type Form = {
  spacing: string
  doorJamb: string
  winJamb: string
  bars: string
  boardW: string
  boardH: string
  faceOffset: string
  cornerStuds: string
  teeStuds: string
  screwsFromLayout: boolean
  screwSpacing: string
  laPerStudEnd: string
}

/** Project framing defaults and the user's display preferences; a section of the workspace. */
export default function SettingsPanel({ projectId, onChanged, framingLocked = false }: { projectId: string; onChanged?: () => Promise<void> | void; /** Framing defaults are part of the RitsuScope license. */ framingLocked?: boolean }) {
  const t = useTakeoffT()
  const { language, setLanguage, numberFormatChoice, setNumberFormat, unitSystem, formatNumber } = useLanguage()
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const toForm = useCallback((d: FramingDefaults): Form => {
    const f = applyFramingDefaults(defaultFraming({ thickness: 0.095 }), d)
    const n = (v: number) => formatNumber(v, 2)
    return {
      spacing: n(f.spacing),
      doorJamb: String(f.doorJamb),
      winJamb: String(f.winJamb),
      bars: f.bars.map(n).join('; '),
      boardW: n(f.boardW),
      boardH: n(f.boardH),
      faceOffset: n(f.faceOffset),
      cornerStuds: String(f.cornerStuds ?? DEFAULT_CORNER_STUDS),
      teeStuds: String(f.teeStuds ?? DEFAULT_TEE_STUDS),
      screwsFromLayout: f.screwsFromLayout !== false,
      screwSpacing: n(f.screwSpacing ?? DEFAULT_SCREW_SPACING),
      laPerStudEnd: String(f.laPerStudEnd ?? DEFAULT_LA_PER_STUD_END),
    }
  }, [formatNumber])

  useEffect(() => {
    let alive = true
    const supabase = createClient()
    supabase.from('takeoff_framing_defaults').select('settings').eq('project_id', projectId).maybeSingle().then(d => {
      if (!alive) return
      if (d.error) setError(t('workspace.error', { message: d.error.message }))
      setForm(toForm(sanitizeFramingDefaults(d.data?.settings)))
    })
    return () => { alive = false }
  }, [projectId, t, toForm])

  if (!form) {
    return <div style={ui.muted}>{t('workspace.loading')}</div>
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => (f ? { ...f, [key]: value } : f))

  function collect(): FramingDefaults {
    const num = (s: string) => parseLocaleNumber(s)
    const int = (s: string) => parseInt(s, 10)
    return sanitizeFramingDefaults({
      spacing: num(form!.spacing),
      doorJamb: int(form!.doorJamb),
      winJamb: int(form!.winJamb),
      bars: parseBars(form!.bars),
      boardW: num(form!.boardW),
      boardH: num(form!.boardH),
      faceOffset: num(form!.faceOffset),
      cornerStuds: int(form!.cornerStuds),
      teeStuds: int(form!.teeStuds),
      screwsFromLayout: form!.screwsFromLayout,
      screwSpacing: num(form!.screwSpacing),
      laPerStudEnd: int(form!.laPerStudEnd),
    })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    const settings = collect()
    const { error: e } = await createClient().from('takeoff_framing_defaults').upsert({ project_id: projectId, settings }, { onConflict: 'project_id' })
    setSaving(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setForm(toForm(settings))
    await onChanged?.()
    setMessage(t('settings.saved'))
  }

  /** Optional: copies the defaults into every framed layer of this project (asks first). */
  async function applyToLayers() {
    if (!window.confirm(t('settings.applyConfirm'))) return
    setError('')
    setMessage('')
    const supabase = createClient()
    const defaults = collect()
    const { data, error: e } = await supabase.from('takeoff_layers').select('id, framing, thickness_m').eq('project_id', projectId).eq('kind', 'linear')
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    let updated = 0
    for (const l of data || []) {
      const stored = (l.framing || {}) as Record<string, unknown>
      if (typeof stored.spacing !== 'number') continue // layers without framing yet keep using defaults when edited
      const next = applyFramingDefaults(stored as never, defaults)
      const { error: ue } = await supabase.from('takeoff_layers').update({ framing: next }).eq('id', l.id)
      if (ue) { setError(t('workspace.error', { message: ue.message })); return }
      updated++
    }
    await onChanged?.()
    setMessage(t('settings.applied', { count: updated }))
  }

  const text = (key: keyof Form, label: string, width = 110) => (
    <label style={field}>
      {label}
      <input style={{ ...input, width }} value={form[key] as string} onChange={e => set(key, e.target.value as never)} />
    </label>
  )

  return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 }}>
        <h2 style={ui.panelTitle}>{t('settings.title')}</h2>
        {error && <div style={ui.error}>{error}</div>}
        {message && <div style={ui.small}>{message}</div>}

        {framingLocked ? (
          <div style={{ ...ui.panel, gap: 6 }}>
            <h2 style={ui.panelTitle}>{t('settings.framing')}</h2>
            <div style={ui.small}>🔒 {t('license.locked')}</div>
          </div>
        ) : <form onSubmit={save} style={{ ...ui.panel, gap: 12 }}>
          <h2 style={ui.panelTitle}>{t('settings.framing')}</h2>
          <div style={ui.small}>{t('settings.framingHint')}</div>
          <div style={row}>
            {text('spacing', t('framing.spacing'))}
            {text('bars', t('framing.bars'), 140)}
            {text('doorJamb', t('framing.doorJamb'), 80)}
            {text('winJamb', t('framing.winJamb'), 80)}
          </div>
          <div style={row}>
            {text('boardW', t('framing.boardW'))}
            {text('boardH', t('framing.boardH'))}
            {text('faceOffset', t('settings.faceOffset'))}
          </div>
          <div style={row}>
            {text('cornerStuds', t('framing.cornerStuds'), 80)}
            {text('teeStuds', t('framing.teeStuds'), 80)}
          </div>
          <label style={check}><input type="checkbox" checked={form.screwsFromLayout} onChange={e => set('screwsFromLayout', e.target.checked)} />{t('framing.screwsFromLayout')}</label>
          {form.screwsFromLayout && (
            <div style={row}>
              {text('screwSpacing', t('framing.screwSpacing'))}
              {text('laPerStudEnd', t('framing.laPerStudEnd'), 80)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" style={{ ...ui.button, opacity: saving ? 0.6 : 1 }} disabled={saving}>{t('settings.save')}</button>
            <button type="button" style={{ ...ui.button, background: '#fff', color: '#294955', border: '1px solid #d3dfe2' }} onClick={() => void applyToLayers()}>{t('settings.applyToLayers')}</button>
          </div>
        </form>}

        <div style={{ ...ui.panel, gap: 12 }}>
          <h2 style={ui.panelTitle}>{t('settings.display')}</h2>
          <div style={ui.small}>{t('settings.displayHint')}</div>
          <div style={row}>
            <label style={field}>
              {t('settings.language')}
              <select style={{ ...input, width: 200 }} value={language} onChange={e => setLanguage(e.target.value as AppLanguage)}>
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
              </select>
            </label>
            <label style={field}>
              {t('settings.numberFormat')}
              <select style={{ ...input, width: 220 }} value={numberFormatChoice || ''} onChange={e => setNumberFormat((e.target.value || null) as NumberFormat | null)}>
                <option value="">{t('settings.numberFormat.follow')}</option>
                <option value="pt-BR">1.234,56</option>
                <option value="en-US">1,234.56</option>
              </select>
            </label>
            <label style={field}>
              {t('settings.units')}
              <select style={{ ...input, width: 200 }} value={unitSystem} disabled>
                <option value="metric">{t('settings.units.metric')}</option>
              </select>
            </label>
          </div>
          <div style={ui.small}>{t('settings.unitsNote')}</div>
        </div>
      </section>
  )
}

const row = { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' } as const
const field = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const input = { height: 32, padding: '0 8px', border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12, background: '#fff', boxSizing: 'border-box' } as const
const check = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#294955' } as const
