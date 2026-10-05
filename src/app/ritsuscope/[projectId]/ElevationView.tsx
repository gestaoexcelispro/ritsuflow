'use client'

import { useMemo } from 'react'
import { findJunctions, junctionStudsOnWall, layoutWall } from '@/lib/takeoff/framing/framing'
import type { TakeoffItem, TakeoffShape } from '@/lib/takeoff/geometry'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { ui } from '../ui'

type Props = { item: TakeoffItem; shape: TakeoffShape; ptPerM: number; allItems: TakeoffItem[] }

const STUD_COLOR = { montante: '#2563EB', batente: '#C2410C', complemento: '#9333EA' } as const
const TRACK_COLOR = '#0F9D8A'
const JUNCTION_COLOR = '#DC2626'

/** Framing elevation of one wall: studs, tracks, headers and side A board joints. */
export default function ElevationView({ item, shape, ptPerM, allItems }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const lay = useMemo(() => layoutWall(item, shape, ptPerM), [item, shape, ptPerM])
  const extra = useMemo(() => junctionStudsOnWall(findJunctions(allItems, ptPerM), shape, ptPerM), [allItems, shape, ptPerM])
  const extraCount = extra.reduce((s, j) => s + j.studs, 0)

  const pad = 0.15
  const W = lay.L + pad * 2
  const H = lay.H + pad * 2
  const X = (x: number) => x + pad
  const Y = (y: number) => lay.H - y + pad // metres, y up
  const thin = Math.max(W, H) / 400

  const openings = lay.segs.flatMap(s => s.ops.map(o => ({ ...o, x0: o.x0 + s.start, x1: o.x1 + s.start })))

  return (
    <div style={ui.panel}>
      <h2 style={ui.panelTitle}>{t('elevation.title')}</h2>
      <div style={ui.small}>
        {t('elevation.summary', {
          length: formatNumber(lay.L, 2),
          height: formatNumber(lay.H, 2),
          studs: lay.studs.length + extraCount,
          headers: lay.headers.length,
          boards: lay.board.A.length,
        })}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 360, background: '#fff', border: '1px solid #edf1f2', borderRadius: 8 }}>
        <rect x={X(0)} y={Y(lay.H)} width={lay.L} height={lay.H} fill="#f9fbfc" stroke="#cddcdf" strokeWidth={thin} />
        {lay.board.A.map((b, i) => (
          <rect key={`b${i}`} x={X(b.x0)} y={Y(b.y1)} width={b.x1 - b.x0} height={b.y1 - b.y0} fill={b.notch ? '#fde68a' : 'none'} fillOpacity={0.35} stroke="#94a3b8" strokeWidth={thin} strokeDasharray={`${thin * 4} ${thin * 3}`} />
        ))}
        {openings.map((o, i) => (
          <rect key={`o${i}`} x={X(o.x0)} y={Y(o.y1)} width={o.x1 - o.x0} height={o.y1 - o.y0} fill="#e2e8f0" stroke="#64748b" strokeWidth={thin} />
        ))}
        {lay.tracks.map((tr, i) => (
          <line key={`t${i}`} x1={X(tr.x0)} y1={Y(tr.y)} x2={X(tr.x1)} y2={Y(tr.y)} stroke={TRACK_COLOR} strokeWidth={thin * 4} />
        ))}
        {lay.headers.map((h, i) => (
          <line key={`h${i}`} x1={X(h.x0)} y1={Y(h.y)} x2={X(h.x1)} y2={Y(h.y)} stroke={TRACK_COLOR} strokeWidth={thin * 4} />
        ))}
        {extra.flatMap((j, i) =>
          Array.from({ length: j.studs }, (_, n) => {
            // Spread the extra studs 5 cm apart, centred on the junction.
            const x = Math.max(0, Math.min(lay.L, j.x + (n - (j.studs - 1) / 2) * 0.05))
            return <line key={`j${i}-${n}`} x1={X(x)} y1={Y(0)} x2={X(x)} y2={Y(lay.H)} stroke={JUNCTION_COLOR} strokeWidth={thin * 3} strokeDasharray={`${thin * 6} ${thin * 3}`} />
          }),
        )}
        {lay.studs.map((s, i) => (
          <line key={`s${i}`} x1={X(s.x)} y1={Y(s.y0)} x2={X(s.x)} y2={Y(s.y1)} stroke={STUD_COLOR[s.kind]} strokeWidth={thin * 3} />
        ))}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, ...ui.small }}>
        <Legend color={STUD_COLOR.montante} label={t('elevation.legend.stud')} />
        <Legend color={STUD_COLOR.batente} label={t('elevation.legend.jamb')} />
        <Legend color={STUD_COLOR.complemento} label={t('elevation.legend.short')} />
        <Legend color={TRACK_COLOR} label={t('elevation.legend.track')} />
        {extraCount > 0 && <Legend color={JUNCTION_COLOR} label={t('elevation.legend.junction')} dashed />}
        <Legend color="#94a3b8" label={t('elevation.faceA')} dashed />
      </div>
    </div>
  )
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 16, height: 0, borderTop: `3px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
      {label}
    </span>
  )
}
