'use client'

function hash(value = '') {
  let result = 0
  for (let i = 0; i < value.length; i += 1) result = ((result << 5) - result + value.charCodeAt(i)) | 0
  return Math.abs(result)
}

export default function OrthogonalConnection({ data }) {
  const start = data?.start
  const end = data?.end
  if (!start || !end) return null

  const sx = start.x
  const sy = start.y
  const ex = end.x
  const ey = end.y
  const id = data?.payload?.id || data?.id || `${sx}-${sy}-${ex}-${ey}`
  const lane = (hash(String(id)) % 9) - 4
  const gap = Math.max(42, Math.min(105, Math.abs(ey - sy) * 0.26))
  const routeY = sy + gap + lane * 8

  const path = `M ${sx} ${sy} V ${routeY} H ${ex} V ${ey}`

  return <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
}
