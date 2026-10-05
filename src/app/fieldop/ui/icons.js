// Small line-icon set for FieldOp (24×24, stroke = currentColor).
const paths = {
  portfolio: 'M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  projects: 'M4 6h6l2 2h8v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z',
  reports: 'M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6',
  workforce: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c1.8.7 3 2.6 3.5 5.2',
  back: 'M15 18l-6-6 6-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  down: 'M6 9l6 6 6-6',
  right: 'M9 6l6 6-6 6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
}

export default function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}><path d={paths[name]} /></svg>
}
