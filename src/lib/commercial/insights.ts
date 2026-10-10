// Bid insights: win rate by client and how the markup of won bids compares with lost ones.
// Pure functions over the bids list and the latest revision of each bid.
import type { BidRow, EstimateSummary } from './bids'

export type ClientStats = {
  client: string
  bids: number
  open: number
  won: number
  lost: number
  /** won ÷ (won + lost), in percent; null when nothing was decided. */
  winRate: number | null
  /** Selling price of won bids, by currency. */
  wonValue: Map<string, number>
}

export type MarkupStats = { won: number | null; lost: number | null; wonCount: number; lostCount: number }

const markupOf = (e: EstimateSummary | undefined) => (e && e.direct_total > 0 ? (e.price_total / e.direct_total - 1) * 100 : null)

/** Bids grouped by a key (client, project type…), with win rate and won value. */
function statsBy(bids: BidRow[], latest: Map<string, EstimateSummary>, keyOf: (b: BidRow) => [string, string]): ClientStats[] {
  const by = new Map<string, ClientStats>()
  for (const b of bids) {
    const [key, name] = keyOf(b)
    const s = by.get(key) || { client: name, bids: 0, open: 0, won: 0, lost: 0, winRate: null, wonValue: new Map() }
    s.bids++
    if (b.status === 'draft' || b.status === 'submitted') s.open++
    if (b.status === 'won') {
      s.won++
      const e = latest.get(b.project_id)
      if (e) s.wonValue.set(e.currency_code, (s.wonValue.get(e.currency_code) || 0) + Number(e.price_total || 0))
    }
    if (b.status === 'lost') s.lost++
    by.set(key, s)
  }
  return [...by.values()]
    .map(s => ({ ...s, winRate: s.won + s.lost ? (s.won / (s.won + s.lost)) * 100 : null }))
    .sort((a, b) => b.bids - a.bids || a.client.localeCompare(b.client))
}

export function clientStats(bids: BidRow[], latest: Map<string, EstimateSummary>, noClient: string): ClientStats[] {
  return statsBy(bids, latest, b => {
    const name = b.projects?.client_name?.trim() || noClient
    return [name.toLowerCase(), name]
  })
}

/** Same figures by project type; `labelOf` translates the type key ('none' when the bid has no type). */
export function typeStats(bids: BidRow[], latest: Map<string, EstimateSummary>, labelOf: (type: string) => string): (ClientStats & { type: string })[] {
  const rows = statsBy(bids, latest, b => { const k = b.project_type || 'none'; return [k, k] })
  return rows.map(r => ({ ...r, type: r.client, client: labelOf(r.client) }))
    .sort((a, b) => Number(a.type === 'none') - Number(b.type === 'none') || b.bids - a.bids)
}

/** Average BDI / markup of won and of lost bids (latest revision of each). */
export function markupStats(bids: BidRow[], latest: Map<string, EstimateSummary>): MarkupStats {
  const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)
  const won = bids.filter(b => b.status === 'won').map(b => markupOf(latest.get(b.project_id))).filter((x): x is number => x != null)
  const lost = bids.filter(b => b.status === 'lost').map(b => markupOf(latest.get(b.project_id))).filter((x): x is number => x != null)
  return { won: avg(won), lost: avg(lost), wonCount: won.length, lostCount: lost.length }
}

/** Calendar weeks (Monday first) covering a month: each day as YYYY-MM-DD, or null outside the month. */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month0, 1))
  const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** A due timestamp as the local calendar day (YYYY-MM-DD). */
export function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Lost and declined bids by reason, most frequent first (bids without a reason are counted apart). */
export function lossReasons(bids: BidRow[]): { reason: string; count: number; share: number }[] {
  const lost = bids.filter(b => b.status === 'lost' || b.status === 'no_bid')
  const counts = new Map<string, number>()
  for (const b of lost) { const r = b.outcome_reason || 'unknown'; counts.set(r, (counts.get(r) || 0) + 1) }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count, share: lost.length ? (count / lost.length) * 100 : 0 }))
    .sort((a, b) => Number(a.reason === 'unknown') - Number(b.reason === 'unknown') || b.count - a.count)
}
