// Small line icons for the takeoff workspace (24×24 viewBox, stroke = currentColor).
import type { CSSProperties } from 'react'

export const ICON_PATHS: Record<string, string> = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  zoning: 'M4 4h16v16H4zM4 12h9M13 4v16',
  takeoff: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  estimating: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  scale: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  line: 'M5 19L19 5',
  rect: 'M4 6h16v12H4z',
  polygon: 'M12 3l8 6-3 11H7L4 9z',
  count: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
  measure: 'M3 12h18M3 9v6M21 9v6M8 11v2M12 10v4M16 11v2',
  detect: 'M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  select: 'M5 3l14 8-6 2-2 6z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.8M6.6 6.6A17 17 0 002 12s4 6 10 6a9.7 9.7 0 004.4-1',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  chevron: 'M6 9l6 6 6-6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  back: 'M15 18l-6-6 6-6',
  origin: 'M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0M12 2v5M12 17v5M2 12h5M17 12h5',
  print: 'M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-2M7 14h10v7H7z',
  share: 'M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14',
  door: 'M6 21V3h10v18M3 21h18M13 12h.01',
  window: 'M4 4h16v16H4zM12 4v16M4 12h16',
  opening: 'M5 20V5h14v15M2 20h6M16 20h6',
  floor: 'M2 14l10-5 10 5-10 5zM7 11.5l10 5M12 9l5 2.5M7 16.5l10-5',
  wall: 'M3 5h18v14H3zM3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19',
  ceiling: 'M3 5h18M3 9h18M6 5v4M12 5v4M18 5v4M9 14l3 3 3-3M12 17v-6',
  slab: 'M2 9h20v5H2zM5 14v5M19 14v5M2 9l3-3h14l3 3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  mep: 'M13 2L5 13h6l-1 9 8-11h-6z',
  column: 'M8 3h8v18H8zM6 3h12M6 21h12',
  beam: 'M2 9h20v6H2zM6 15v6M18 15v6',
  gradeBeam: 'M2 13h20M2 13v5h20v-5M6 13V7h12v6',
  footing: 'M10 3h4v9h-4zM4 12h16v6H4zM2 21h20',
  pileCap: 'M4 6h16v7H4zM7 13v8M12 13v8M17 13v8',
  pile: 'M9 3h6v15l-3 3-3-3zM9 8h6',
  blocking: 'M3 4h18v16H3zM3 10h18M3 14h18M8 10v4M16 10v4',
  outlet: 'M5 5h14v14H5zM9.5 10v2M14.5 10v2M10 15.5h4',
  switch: 'M7 3h10v18H7zM12 7v6',
  data: 'M5 5h14v14H5zM9 10h6v5H9zM10 10V8.5h4V10',
  light: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0012 3z',
  water: 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z',
  drain: 'M12 12m-8 0a8 8 0 1016 0 8 8 0 10-16 0M8 12h8M12 8v8',
  gas: 'M12 3c1 3 5 5 5 10a5 5 0 01-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.5 2 3 0-3 0-5.5 1-8.5z',
  toilet: 'M6 3h7v6H6zM4 9h14a4 4 0 01-4 6h-1l1 6H8l1-6H8a4 4 0 01-4-4z',
  basin: 'M3 11h18a9 9 0 01-18 0zM12 11V6a2 2 0 014 0',
  shower: 'M4 21V7a4 4 0 018 0v1M8 8h8M10 12v1M14 12v1M12 15v1M10 18v1M14 18v1',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  building: 'M4 21V4h10v17M14 9h6v12M2 21h20M7 8h4M7 12h4M7 16h4M17 13h1M17 17h1',
  link: 'M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1',
}

export type IconName = keyof typeof ICON_PATHS

export default function Icon({ name, size = 16, style }: { name: IconName | string; size?: number; style?: CSSProperties }) {
  const d = ICON_PATHS[name]
  if (!d) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }} aria-hidden>
      <path d={d} />
    </svg>
  )
}
