'use client'

export default function OrthogonalConnection({ data }) {
  const start = data?.start
  const end = data?.end
  if (!start || !end) return null

  const sx = start.x
  const sy = start.y
  const ex = end.x
  const ey = end.y
  const midY = sy + (ey - sy) * 0.45
  const path = `M ${sx} ${sy} V ${midY} H ${ex} V ${ey}`

  return <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
}
