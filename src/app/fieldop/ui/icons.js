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
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9s1.2-6.4 3.7-9z',
  shield: 'M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6z',
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  right: 'M9 6l6 6-6 6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  // PreCon
  masterPlan: 'M4 5h16v15H4zM8 3v4M16 3v4M4 10h16M7 14h5M10 17h6',
  lookahead: 'M4 6h7M4 12h11M4 18h15M11 6l3 3-3 3M15 12l3 3-3 3',
  constraint: 'M12 3.5 2.5 20h19zM12 10v4.5M12 17.5v.01',
  weekly: 'M4 5h16v15H4zM8 3v4M16 3v4M4 10h16M7.5 14h1M11.5 14h1M15.5 14h1M7.5 17h1M11.5 17h1',
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
}

export default function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}><path d={paths[name]} /></svg>
}
