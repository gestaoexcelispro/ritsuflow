'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { LEVEL_COLUMNS, normalizeLevels, type LevelRow } from '@/lib/takeoff/levels'
import { createFloorsForLevels, loadLocations } from '@/lib/takeoff/locationSync'
import type { BidRow, EstimateSummary } from '@/lib/commercial/bids'
import { formatMoney } from '@/lib/commercial/format'
import { ui } from '../ui'

type Props = { bid: BidRow; estimates: EstimateSummary[]; counts: { sheets: number; items: number }; onClose: () => void }

/** Won bid → project: the database converts it, then the Projects form opens for what a contract needs. */
export default function ConvertDialog({ bid, estimates, counts, onClose }: Props) {
  const t = useT('commercial')
  const router = useRouter()
  const { numberFormat } = useLanguage()
  const [levels, setLevels] = useState<LevelRow[]>([])
  const [floors, setFloors] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Same choice as the database: the latest issued revision, else the latest one.
  const baseline = estimates.find(e => e.status === 'issued') || estimates[0] || null

  useEffect(() => {
    createClient().from('takeoff_levels').select(LEVEL_COLUMNS).eq('project_id', bid.project_id)
      .then(({ data }) => setLevels(normalizeLevels((data || []) as Partial<LevelRow>[])))
  }, [bid.project_id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const newFloors = levels.filter(l => !l.location_id).length

  async function convert() {
    setBusy(true); setError('')
    const supabase = createClient()
    const { error: e } = await supabase.rpc('convert_bid_to_project', { p_project_id: bid.project_id })
    if (e) { setBusy(false); setError(t('convert.error', { message: e.message })); return }
    if (floors && newFloors > 0) {
      try {
        const locations = await loadLocations(supabase, bid.project_id)
        await createFloorsForLevels(supabase, { projectId: bid.project_id, levels, locations })
      } catch {
        // The project exists already; floors can still be created later from RitsuScope.
      }
    }
    router.push(`/projects/${bid.project_id}/edit`)
  }

  return (
    <div role="presentation" onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(23,52,65,.35)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="convert-title"
        style={{ width: '100%', maxWidth: 640, background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(23,52,65,.25)', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <span style={ui.chipTeal}>{t('convert.won', { number: bid.bid_number })}</span>
          <h2 id="convert-title" style={{ margin: '8px 0 2px', fontSize: 20, color: '#173441' }}>{t('convert.title')}</h2>
          <p style={ui.subtitle}>{[bid.projects?.name, bid.projects?.client_name].filter(Boolean).join(' · ')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <div style={{ ...ui.card, padding: 12 }}>
            <div style={ui.small}>{t('convert.contractValue')}</div>
            <strong style={{ fontSize: 17 }}>{baseline ? formatMoney(baseline.price_total, baseline.currency_code, numberFormat) : '—'}</strong>
          </div>
          <div style={{ ...ui.card, padding: 12 }}>
            <div style={ui.small}>{t('convert.baseline', { name: baseline?.name || '—' })}</div>
            <strong style={{ fontSize: 17 }}>{baseline ? formatMoney(baseline.direct_total, baseline.currency_code, numberFormat) : '—'}</strong>
          </div>
        </div>
        {baseline && baseline.status !== 'issued' && <div style={{ ...ui.notice, background: '#fff4e8', color: '#6e3610' }}>{t('convert.notIssued')}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#294955' }}>
          <strong>{t('convert.carried')}</strong>
          <span>✓ {t('convert.carriedTakeoff', { sheets: counts.sheets, items: counts.items })}</span>
          <span>✓ {t('convert.carriedEstimate')}</span>
          <span>✓ {t('convert.carriedClient')}</span>
          <strong style={{ marginTop: 6 }}>{t('convert.toFill')}</strong>
          <span>{t('convert.toFillList')}</span>
        </div>

        {newFloors > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, background: '#f2f7f8', fontSize: 13, color: '#294955' }}>
            <input type="checkbox" checked={floors} onChange={e => setFloors(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#0b7f75' }} />
            {t('convert.floors', { count: newFloors })}
          </label>
        )}
        <p style={{ ...ui.small, margin: 0 }}>{t('convert.counts')}</p>
        {error && <div role="alert" style={ui.error}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" disabled={busy} onClick={onClose} style={ui.buttonGhost}>{t('convert.notNow')}</button>
          <button type="button" disabled={busy} onClick={convert} style={ui.button}>{busy ? t('convert.working') : t('convert.go')}</button>
        </div>
      </section>
    </div>
  )
}
