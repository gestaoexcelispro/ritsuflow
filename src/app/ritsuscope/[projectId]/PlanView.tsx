'use client'

import { useMemo } from 'react'
import type { TakeoffItem } from '@/lib/takeoff/geometry'

type Props = {
  width: number
  height: number
  ptPerM: number
  items: TakeoffItem[]
  gridLabel: string
  selectedId: string | null
  onSelect: (elementId: string | null) => void
}

/** Read-only plan of one IFC storey on its virtual sheet (40 pt/m). */
export default function PlanView({ width, height, ptPerM, items, gridLabel, selectedId, onSelect }: Props) {
  const grid = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = []
    for (let m = 0; m * ptPerM <= width; m++) lines.push({ x1: m * ptPerM, y1: 0, x2: m * ptPerM, y2: height, major: m % 5 === 0 })
    for (let m = 0; m * ptPerM <= height; m++) lines.push({ x1: 0, y1: m * ptPerM, x2: width, y2: m * ptPerM, major: m % 5 === 0 })
    return lines
  }, [width, height, ptPerM])

  const ordered = useMemo(() => {
    const order = { area: 0, linear: 1, count: 2 }
    return [...items].sort((a, b) => order[a.kind] - order[b.kind])
  }, [items])

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={gridLabel}
        style={{ display: 'block', width: '100%', maxHeight: '100%', background: '#fff', border: '1px solid #dfe7ea', borderRadius: 10 }}
        onClick={event => { if (event.target === event.currentTarget) onSelect(null) }}
      >
        {grid.map((g, i) => (
          <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={g.major ? '#D5DBE1' : '#EEF1F4'} strokeWidth={g.major ? 0.8 : 0.5} onClick={() => onSelect(null)} />
        ))}
        {ordered.map(item =>
          item.shapes.map((shape, index) => {
            const points = shape.pts.map(p => `${p[0]},${p[1]}`).join(' ')
            const key = `${item.key}-${index}`
            const selected = !!shape.id && shape.id === selectedId
            const color = selected ? '#111827' : item.color
            const pick = { onClick: () => onSelect(shape.id ?? null), style: { cursor: 'pointer' } }
            if (item.kind === 'area') {
              return <polygon key={key} points={points} fill={item.color} fillOpacity={selected ? 0.3 : 0.14} stroke={color} strokeWidth={selected ? 2.5 : 1.2} {...pick} />
            }
            if (item.kind === 'linear') {
              return (
                <polyline
                  key={key}
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.85}
                  strokeWidth={Math.max(1.5, (item.thickness || 0.1) * ptPerM)}
                  strokeLinecap="butt"
                  {...pick}
                />
              )
            }
            const [x, y] = shape.pts[0]
            return <circle key={key} cx={x} cy={y} r={0.22 * ptPerM} fill="#fff" stroke={color} strokeWidth={selected ? 3 : 2} {...pick} />
          }),
        )}
      </svg>
      <figcaption style={{ marginTop: 6, fontSize: 10, color: '#6b8089' }}>{gridLabel}</figcaption>
    </figure>
  )
}
