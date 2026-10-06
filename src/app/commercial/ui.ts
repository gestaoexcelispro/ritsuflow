import type { CSSProperties } from 'react'

// Shared inline styles for Commercial, in the RitsuFlow management palette
// (teal #0b7f75 for actions, ink #173441, borders #dfe7ea), matching RitsuScope.
export const ui = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 20px 40px', maxWidth: 1240, margin: '0 auto', minWidth: 0 },
  header: { display: 'flex', flexDirection: 'column', gap: 4 },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: '#0b7f75' },
  title: { margin: 0, fontSize: 24, color: '#173441' },
  subtitle: { margin: 0, fontSize: 13, color: '#4f6670' },
  muted: { padding: 24, fontSize: 13, color: '#4f6670' },
  small: { fontSize: 12, color: '#4f6670' },
  empty: { padding: 28, border: '1px dashed #cddcdf', borderRadius: 10, textAlign: 'center', fontSize: 13, color: '#4f6670', background: '#fff' },
  error: { padding: 10, borderRadius: 8, background: '#fff5f5', color: '#a44343', fontSize: 12 },
  notice: { padding: 10, borderRadius: 8, background: '#eef7f6', color: '#075a53', fontSize: 12 },
  card: { background: '#fff', border: '1px solid #dfe7ea', borderRadius: 10 },
  tableWrap: { background: '#fff', border: '1px solid #dfe7ea', borderRadius: 10, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#294955', minWidth: 720 },
  th: { textAlign: 'left', padding: '9px 12px', background: '#f2f7f8', fontSize: 11, fontWeight: 800, color: '#3f5862', letterSpacing: '.04em', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', borderTop: '1px solid #edf1f2', verticalAlign: 'middle' },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  toolbar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  input: { height: 38, border: '1px solid #c9d6da', borderRadius: 8, padding: '0 10px', fontSize: 13, color: '#173441', background: '#fff', minWidth: 0 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#294955' },
  button: { height: 38, padding: '0 14px', border: 0, borderRadius: 8, background: '#0b7f75', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  buttonGhost: { height: 38, padding: '0 14px', border: '1px solid #c9d6da', borderRadius: 8, background: '#fff', color: '#294955', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  buttonSmall: { height: 30, padding: '0 10px', border: '1px solid #c9d6da', borderRadius: 7, background: '#fff', color: '#294955', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  buttonDanger: { height: 38, padding: '0 14px', border: '1px solid #e2b9b9', borderRadius: 8, background: '#fff', color: '#a44343', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  tabs: { display: 'inline-flex', flexWrap: 'wrap', padding: 4, background: '#e6eef0', borderRadius: 9, gap: 4 },
  tab: { height: 34, padding: '0 14px', border: 0, borderRadius: 6, background: 'transparent', color: '#3f5862', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tabOn: { height: 34, padding: '0 14px', border: 0, borderRadius: 6, background: '#fff', color: '#173441', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(23,52,65,.12)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  chip: { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#eef2f3', color: '#3f5862' },
  chipTeal: { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#e3f3f1', color: '#075a53' },
  chipOrange: { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#fff4e8', color: '#8a4413' },
} satisfies Record<string, CSSProperties>

/** Chip style per bid status. */
export const statusStyle: Record<'draft' | 'submitted' | 'won' | 'lost' | 'no_bid', CSSProperties> = {
  draft: ui.chip,
  submitted: { ...ui.chip, background: '#e6eef9', color: '#1f4f8a' },
  won: ui.chipTeal,
  lost: ui.chipOrange,
  no_bid: ui.chip,
}
