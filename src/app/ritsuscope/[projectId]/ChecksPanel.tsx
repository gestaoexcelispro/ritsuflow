'use client'

import { useMemo, useState } from 'react'
import { checkWall, type CheckStatus } from '@/lib/takeoff/checks'
import { shapeHeight, type TakeoffItem, type TakeoffShape } from '@/lib/takeoff/geometry'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { ui } from '../ui'

type Props = { item: TakeoffItem; shape: TakeoffShape }

const statusColor: Record<CheckStatus, string> = { ok: '#0b7c73', fail: '#b42318', unknown: '#6b8089' }

/** Stud size from the stud name ("Montante 70 mm") or, failing that, the core thickness. */
function studSize(item: TakeoffItem): number {
  const fromName = item.framing?.studName?.match(/(\d{2,3})\s*mm/)
  if (fromName) return Number(fromName[1])
  return Math.round(((item.thickness || 0.095) - 0.025) * 1000)
}

function boardType(name: string | undefined): 'ST' | 'RU' | 'RF' {
  if (/\bRF\b/i.test(name || '')) return 'RF'
  if (/\bRU\b/i.test(name || '')) return 'RU'
  return 'ST'
}

export default function ChecksPanel({ item, shape }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const [fire, setFire] = useState('')
  const [db, setDb] = useState('')
  const [wool, setWool] = useState(false)
  const [double, setDouble] = useState(false)

  const F = item.framing
  const result = useMemo(() => {
    if (!F) return null
    const reqFire = parseLocaleNumber(fire)
    const reqDb = parseLocaleNumber(db)
    return checkWall({
      studMm: studSize(item),
      spacingMm: Math.round(F.spacing * 1000),
      doubleStuds: double,
      boardsPerFace: Math.max(F.layersA, F.layersB),
      heightM: shapeHeight(item, shape),
      board: boardType(shape.faceA || F.boardA),
      glassWool: wool,
      requiredFireMin: Number.isFinite(reqFire) ? reqFire : null,
      requiredAcousticDb: Number.isFinite(reqDb) ? reqDb : null,
    })
  }, [F, item, shape, fire, db, wool, double])

  if (!F || !result) return null
  const label = (s: CheckStatus) => t(s === 'ok' ? 'checks.ok' : s === 'fail' ? 'checks.fail' : 'checks.unknown')
  const Row = ({ name, status, detail }: { name: string; status: CheckStatus; detail: string }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', fontSize: 11, color: '#294955' }}>
      <span><strong>{name}</strong>{detail && <span style={ui.small}> · {detail}</span>}</span>
      <span style={{ fontWeight: 800, color: statusColor[status] }}>{label(status)}</span>
    </div>
  )

  return (
    <div style={ui.panel}>
      <h2 style={ui.panelTitle}>{t('checks.title')}</h2>
      {result.wallType && <div style={ui.small}>{t(result.wallType === 'simples' ? 'checks.wallType.simples' : 'checks.wallType.separativa')} · {studSize(item)} mm · {Math.round(F.spacing * 1000)} mm</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <label style={fieldStyle}>{t('checks.requiredFire')}<input style={inputStyle} inputMode="numeric" value={fire} onChange={e => setFire(e.target.value)} /></label>
        <label style={fieldStyle}>{t('checks.requiredDb')}<input style={inputStyle} inputMode="numeric" value={db} onChange={e => setDb(e.target.value)} /></label>
        <label style={checkStyle}><input type="checkbox" checked={wool} onChange={e => setWool(e.target.checked)} />{t('checks.wool')}</label>
        <label style={checkStyle}><input type="checkbox" checked={double} onChange={e => setDouble(e.target.checked)} />{t('checks.double')}</label>
      </div>
      <Row
        name={t('checks.height')}
        status={result.height.status}
        detail={result.height.limitM == null ? '' : t('checks.heightDetail', { height: formatNumber(result.height.heightM, 2), limit: formatNumber(result.height.limitM, 2) })}
      />
      <Row name={t('checks.fire')} status={result.fire.status} detail={result.fire.ratingMin == null ? '' : t('checks.fireDetail', { rating: result.fire.ratingMin })} />
      <Row
        name={t('checks.acoustic')}
        status={result.acoustic.status}
        detail={result.acoustic.range ? t('checks.acousticDetail', { low: result.acoustic.range[0], high: result.acoustic.range[1] }) : ''}
      />
      {result.note && <div style={ui.small}>{t('checks.notInTable', { reason: result.note })}</div>}
      <div style={ui.small}>{t('checks.footnote')}</div>
    </div>
  )
}

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const inputStyle = { height: 30, width: 90, padding: '0 7px', border: '1px solid #d6e0e3', borderRadius: 6, fontSize: 11 } as const
const checkStyle = { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#294955' } as const
