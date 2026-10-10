import type { CSSProperties } from 'react'

// Shared inline styles for the Takeoff pages, matching the existing
// management palette (teal #109d91, ink #173441, borders #dfe7ea).
export const ui = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, padding: 24, minWidth: 0 },
  header: { display: 'flex', flexDirection: 'column', gap: 4 },
  eyebrow: { fontSize: 10, fontWeight: 900, letterSpacing: '.12em', color: '#0f9d92' },
  title: { margin: 0, fontSize: 22, color: '#173441' },
  subtitle: { margin: 0, fontSize: 12, color: '#6b8089' },
  muted: { padding: 24, fontSize: 12, color: '#6b8089' },
  empty: { padding: 28, border: '1px dashed #cddcdf', borderRadius: 8, textAlign: 'center', fontSize: 12, color: '#70848c', background: '#fff' },
  error: { padding: 10, borderRadius: 6, background: '#fff5f5', color: '#a44343', fontSize: 11 },
  table: { border: '1px solid #e0e8ea', borderRadius: 8, overflow: 'hidden', background: '#fff' },
  tableHead: { background: '#f2f7f8', fontSize: 10, fontWeight: 850, color: '#536d78', minHeight: 36 },
  row: { display: 'grid', gridTemplateColumns: 'minmax(0,2fr) 90px 90px 90px 90px', gap: 10, alignItems: 'center', minHeight: 48, padding: '8px 14px', borderTop: '1px solid #edf1f2', fontSize: 12, color: '#294955' },
  code: { marginLeft: 8, padding: '2px 6px', borderRadius: 5, background: '#eaf3f5', color: '#42636f', fontSize: 10 },
  linkButton: { justifySelf: 'end', padding: '7px 12px', borderRadius: 7, background: '#109d91', color: '#fff', fontSize: 11, fontWeight: 800, textDecoration: 'none' },
  button: { height: 36, padding: '0 14px', border: 0, borderRadius: 7, background: '#109d91', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' },
  backLink: { fontSize: 11, color: '#0f9d92', textDecoration: 'none', fontWeight: 700 },
  workspace: { display: 'grid', gridTemplateColumns: '280px minmax(0,1fr)', gap: 16, alignItems: 'start' },
  panel: { display: 'flex', flexDirection: 'column', gap: 10, padding: 14, border: '1px solid #dfe7ea', borderRadius: 10, background: '#fff' },
  panelTitle: { margin: 0, fontSize: 13, color: '#173441' },
  listItem: { display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', border: '1px solid #edf1f2', borderRadius: 7, fontSize: 12, color: '#294955' },
  small: { fontSize: 10, color: '#6b8089' },
  swatch: { display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6, verticalAlign: 'middle' },
  viewer: { minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, border: '1px dashed #cddcdf', borderRadius: 10, background: '#f9fbfc', textAlign: 'center', fontSize: 12, color: '#70848c' },
} satisfies Record<string, CSSProperties>
