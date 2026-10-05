'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { generateLevels, type LevelRow } from '@/lib/takeoff/levels'
import { ui } from '../ui'

type Props = { projectId: string; levels: LevelRow[]; onDone: (message: string) => Promise<void> | void; onClose: () => void }

/** "Generate levels": a building's floors in one go (ground, levels 1…n−1, roof). */
export default function GenerateLevelsDialog({ projectId, levels, onDone, onClose }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const [form, setForm] = useState({ storeys: '10', ground: '0,00', height: '3,00', slab: '0,15', roof: true })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const storeys = Math.floor(Number(form.storeys))
  const ground = parseLocaleNumber(form.ground)
  const height = parseLocaleNumber(form.height)
  const slab = form.slab.trim() ? parseLocaleNumber(form.slab) : null
  const valid = storeys >= 1 && storeys <= 200 && Number.isFinite(ground) && height > 0 && (slab == null || (Number.isFinite(slab) && slab >= 0 && slab < height))
  const names = { ground: t('level.nameGround'), level: (n: number) => t('level.nameLevel', { n }), roof: t('level.nameRoof') }
  const rows = valid ? generateLevels({ storeys, groundElevation: ground, heightM: height, slabM: slab, roof: form.roof, names }) : []
  const taken = new Set(levels.map(l => l.name.trim().toLowerCase()))
  const fresh = rows.filter(r => !taken.has(r.name.trim().toLowerCase()))

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!valid) { setError(t('level.invalid')); return }
    if (!fresh.length) { setError(t('level.genNothing')); return }
    setBusy(true)
    const { error: e1 } = await createClient().from('takeoff_levels').insert(fresh.map(r => ({ ...r, project_id: projectId })))
    setBusy(false)
    if (e1) { setError(t('workspace.error', { message: e1.message })); return }
    onClose()
    await onDone(t('level.genDone', { count: fresh.length }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,35,45,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <form onSubmit={create} onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: 18, background: '#fff', borderRadius: 12, boxShadow: '0 20px 50px rgba(15,35,45,.25)' }}>
        <strong style={{ fontSize: 15, color: '#173441' }}>{t('level.genTitle')}</strong>
        <span style={ui.small}>{t('level.genHint')}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={field}>{t('level.genStoreys')}<input style={input} inputMode="numeric" value={form.storeys} onChange={e => setForm(f => ({ ...f, storeys: e.target.value }))} /></label>
          <label style={field}>{t('level.genGround')}<input style={input} inputMode="decimal" value={form.ground} onChange={e => setForm(f => ({ ...f, ground: e.target.value }))} /></label>
          <label style={field}>{t('level.height')}<input style={input} inputMode="decimal" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} /></label>
          <label style={field}>{t('level.slab')}<input style={input} inputMode="decimal" value={form.slab} onChange={e => setForm(f => ({ ...f, slab: e.target.value }))} /></label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#294955' }}>
          <input type="checkbox" checked={form.roof} onChange={e => setForm(f => ({ ...f, roof: e.target.checked }))} />{t('level.genRoof')}
        </label>
        {rows.length > 0 && (
          <div style={{ fontSize: 11, color: '#294955', background: '#f4f8f9', borderRadius: 8, padding: 10 }}>
            {t('level.genPreview', { count: rows.length, first: `${rows[0].name} (${formatNumber(rows[0].elevation_m, 2)} m)`, last: `${rows[rows.length - 1].name} (${formatNumber(rows[rows.length - 1].elevation_m, 2)} m)` })}
            {fresh.length < rows.length && <div style={{ marginTop: 4, color: '#9a6b12' }}>{t('level.genExists', { count: rows.length - fresh.length })}</div>}
          </div>
        )}
        {error && <div style={ui.error}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={btn(false)}>{t('level.cancel')}</button>
          <button type="submit" disabled={busy || !valid || !fresh.length} style={{ ...btn(true), opacity: busy || !valid || !fresh.length ? 0.5 : 1 }}>{t('level.genCreate', { count: fresh.length })}</button>
        </div>
      </form>
    </div>
  )
}

const field = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontWeight: 700, color: '#536d78' } as const
const input = { height: 32, padding: '0 8px', border: '1px solid #d3dfe2', borderRadius: 6, fontSize: 12, color: '#173441', minWidth: 0 } as const
const btn = (primary: boolean) => ({ height: 32, padding: '0 14px', border: '1px solid ' + (primary ? '#109d91' : '#d3dfe2'), borderRadius: 7, background: primary ? '#109d91' : '#fff', color: primary ? '#fff' : '#294955', fontSize: 11, fontWeight: 800, cursor: 'pointer' }) as const
