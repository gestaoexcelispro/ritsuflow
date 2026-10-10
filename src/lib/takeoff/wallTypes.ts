// Wall-type library: company-wide or per-project wall build-ups, filtered by country.
// Lengths are stored in metres; imperial is a display concern.
import type { FramingConfig } from './geometry'

export type WallCategory = 'non_rated' | 'rated' | 'shaft' | 'furring' | 'chase' | 'exterior' | 'other'
export const WALL_CATEGORIES: WallCategory[] = ['non_rated', 'rated', 'shaft', 'furring', 'chase', 'exterior', 'other']
export type WallTypeStatus = 'draft' | 'review' | 'approved'

/** One side's board build-up (side A or B). */
export type BoardSpec = { side: 'A' | 'B'; product: string; thickness_m: number | null; count: number }

export type WallTypeRow = {
  id: string
  project_id: string | null
  country_code: string
  region: string | null
  code: string | null
  name: string
  category: WallCategory
  fire_rating_hr: number | null
  stc_min: number | null
  stc_max: number | null
  rated_design: string | null
  thickness_m: number | null
  framing: Partial<FramingConfig>
  boards: BoardSpec[]
  recipe_id: string | null
  source_id: string | null
  source_ref: string | null
  status: WallTypeStatus
  notes: string | null
  /** Catalog products by slot (stud, track, boardA, boardB, insulation), used by system recipes. */
  materials?: Partial<Record<'stud' | 'track' | 'boardA' | 'boardB' | 'insulation', string | null>> | null
}

export type ReferenceSourceRow = {
  id: string
  name: string
  publisher: string | null
  edition: string | null
  country_code: string | null
  url: string | null
  license_note: string | null
}

export const WALL_TYPE_COLUMNS =
  'id, project_id, country_code, region, code, name, category, fire_rating_hr, stc_min, stc_max, rated_design, thickness_m, framing, boards, recipe_id, source_id, source_ref, status, notes, materials'

/** Countries offered in the filters. Codes are ISO 3166-1 alpha-2. */
export const COUNTRIES: { code: string; name: { 'pt-BR': string; 'en-US': string } }[] = [
  { code: 'BR', name: { 'pt-BR': 'Brasil', 'en-US': 'Brazil' } },
  { code: 'US', name: { 'pt-BR': 'Estados Unidos', 'en-US': 'United States' } },
  { code: 'IN', name: { 'pt-BR': 'Índia', 'en-US': 'India' } },
]

const TEXT_TO_CODE: Record<string, string> = {
  brasil: 'BR', brazil: 'BR', br: 'BR',
  'united states': 'US', 'united states of america': 'US', usa: 'US', us: 'US', eua: 'US', 'estados unidos': 'US',
  india: 'IN', 'índia': 'IN', in: 'IN',
}

/** Maps the project's free-text country to a code (same mapping as the database backfill). */
export function countryCodeFromText(text: string | null | undefined): string | null {
  if (!text) return null
  return TEXT_TO_CODE[text.trim().toLowerCase()] ?? null
}

/** The project's country: the stored code, or one derived from the text if the code is empty. */
export function projectCountry(p: { country_code?: string | null; country?: string | null } | null | undefined): string | null {
  if (!p) return null
  return p.country_code || countryCodeFromText(p.country)
}

export function wallTypeLabel(wt: Pick<WallTypeRow, 'code' | 'name'>): string {
  return wt.code ? `${wt.code} – ${wt.name}` : wt.name
}

export type WallTypeFilter = {
  country: string | 'all'
  region?: string
  category?: WallCategory | 'all'
  search?: string
  /** Show library types plus this project's own types. */
  projectId?: string
}

export function filterWallTypes(list: WallTypeRow[], f: WallTypeFilter): WallTypeRow[] {
  const q = (f.search || '').trim().toLowerCase()
  const region = (f.region || '').trim().toLowerCase()
  return list
    .filter(wt => wt.project_id == null || wt.project_id === f.projectId)
    .filter(wt => f.country === 'all' || wt.country_code === f.country)
    .filter(wt => !region || !wt.region || wt.region.toLowerCase() === region)
    .filter(wt => !f.category || f.category === 'all' || wt.category === f.category)
    .filter(wt => {
      if (!q) return true
      const hay = [wt.code, wt.name, wt.rated_design, wt.notes, ...wt.boards.map(b => b.product)].filter(Boolean).join(' ').toLowerCase()
      return q.split(/\s+/).every(word => hay.includes(word))
    })
    .sort((a, b) => {
      // Project types first, then by code/name.
      if ((a.project_id == null) !== (b.project_id == null)) return a.project_id == null ? 1 : -1
      return wallTypeLabel(a).localeCompare(wallTypeLabel(b), undefined, { numeric: true })
    })
}

/** Framing settings for a layer created from a wall type: base defaults, then the type's own values. */
export function wallTypeFraming(wt: Pick<WallTypeRow, 'framing' | 'boards'>, base: FramingConfig): FramingConfig {
  const out: FramingConfig = { ...base, ...(wt.framing || {}), on: true }
  const a = wt.boards.find(b => b.side === 'A')
  const b = wt.boards.find(x => x.side === 'B')
  if (a) { out.boardA = a.product || out.boardA; out.layersA = Math.max(0, Math.round(a.count)) }
  if (b) { out.boardB = b.product || out.boardB; out.layersB = Math.max(0, Math.round(b.count)) }
  return out
}

/** Row to insert into takeoff_layers when the user picks a wall type. */
export function layerFromWallType(
  wt: WallTypeRow,
  base: FramingConfig,
  opts: { projectId: string; color: string; sortOrder: number; heightM: number | null },
) {
  return {
    project_id: opts.projectId,
    kind: 'linear' as const,
    name: wallTypeLabel(wt),
    system: wt.rated_design || null,
    // A wall type can carry its own colour (e.g. from the company's typology sheet).
    color: typeof (wt.framing as { color?: unknown })?.color === 'string' && /^#[0-9a-f]{6}$/i.test(String((wt.framing as { color?: unknown }).color)) ? String((wt.framing as { color?: unknown }).color) : opts.color,
    height_m: opts.heightM && opts.heightM > 0 ? opts.heightM : null,
    thickness_m: wt.thickness_m && wt.thickness_m > 0 ? wt.thickness_m : null,
    framing: wallTypeFraming(wt, base),
    recipe_id: wt.recipe_id,
    wall_type_id: wt.id,
    sort_order: opts.sortOrder,
  }
}
