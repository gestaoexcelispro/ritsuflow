// Technical checks for drywall walls against manufacturer performance tables.
// Data: Catálogo Técnico Gypsum Drywall (2014), "Tabela de Desempenho", read from
// the page images (the PDF text of these tables is scrambled).
//   Parede Simples: PDF page 37, printed page 35 (1 board BR 12.5 mm per face).
//   Parede Separativa: PDF page 41, printed page 39 (2 boards BR 12.5 mm per face).
// Footnote in the catalog: the height limit is floor to slab, and can be exceeded
// with BR 12.5 mm and DUR boards after consulting the manufacturer.

export type WallType = 'simples' | 'separativa'

type PerformanceRow = {
  stud: 48 | 70 | 90
  thicknessMm: number
  /** Height limits (m) by stud spacing (mm): single and double studs. */
  limits: Record<600 | 400, { single: number; double: number }>
  weightKgM2: number
  fireMin: { st: number; rf: number }
  /** Acoustic index ranges as printed (dB): without and with glass wool. */
  acoustic: { withoutWool: [number, number]; withWool: [number, number] }
}

export const GYPSUM_2014_SOURCE = {
  catalog: 'Catálogo Técnico Gypsum Drywall 2014',
  simples: { pdfPage: 37, printedPage: 35 },
  separativa: { pdfPage: 41, printedPage: 39 },
} as const

export const GYPSUM_2014_PERFORMANCE: Record<WallType, PerformanceRow[]> = {
  simples: [
    { stud: 48, thicknessMm: 73, limits: { 600: { single: 2.5, double: 2.9 }, 400: { single: 2.7, double: 3.25 } }, weightKgM2: 20, fireMin: { st: 30, rf: 30 }, acoustic: { withoutWool: [34, 36], withWool: [42, 44] } },
    { stud: 70, thicknessMm: 95, limits: { 600: { single: 3.0, double: 3.6 }, 400: { single: 3.3, double: 4.05 } }, weightKgM2: 20, fireMin: { st: 30, rf: 30 }, acoustic: { withoutWool: [38, 40], withWool: [44, 46] } },
    { stud: 90, thicknessMm: 115, limits: { 600: { single: 3.5, double: 4.15 }, 400: { single: 3.85, double: 4.6 } }, weightKgM2: 20, fireMin: { st: 30, rf: 30 }, acoustic: { withoutWool: [39, 42], withWool: [45, 47] } },
  ],
  separativa: [
    { stud: 48, thicknessMm: 98, limits: { 600: { single: 2.9, double: 3.5 }, 400: { single: 3.2, double: 3.8 } }, weightKgM2: 40, fireMin: { st: 60, rf: 90 }, acoustic: { withoutWool: [42, 44], withWool: [42, 44] } },
    { stud: 70, thicknessMm: 120, limits: { 600: { single: 3.7, double: 4.4 }, 400: { single: 4.1, double: 4.8 } }, weightKgM2: 40, fireMin: { st: 60, rf: 90 }, acoustic: { withoutWool: [44, 46], withWool: [50, 52] } },
    { stud: 90, thicknessMm: 140, limits: { 600: { single: 4.2, double: 5.0 }, 400: { single: 4.6, double: 5.5 } }, weightKgM2: 40, fireMin: { st: 60, rf: 90 }, acoustic: { withoutWool: [45, 47], withWool: [53, 55] } },
  ],
}

export type WallCheckInput = {
  studMm: number
  spacingMm: number
  doubleStuds: boolean
  /** Boards per face: 1 = Parede Simples, 2 = Parede Separativa. */
  boardsPerFace: number
  heightM: number
  board: 'ST' | 'RU' | 'RF'
  glassWool: boolean
  /** Requirements entered by the user (optional). */
  requiredFireMin?: number | null
  requiredAcousticDb?: number | null
}

export type CheckStatus = 'ok' | 'fail' | 'unknown'

export type WallCheck = {
  height: { status: CheckStatus; limitM: number | null; heightM: number }
  fire: { status: CheckStatus; ratingMin: number | null; requiredMin: number | null }
  acoustic: { status: CheckStatus; range: [number, number] | null; requiredDb: number | null }
  wallType: WallType | null
  /** Reason when a value can't be read from the table (e.g. stud size not listed). */
  note: string | null
}

export function checkWall(input: WallCheckInput): WallCheck {
  const wallType: WallType | null = input.boardsPerFace === 1 ? 'simples' : input.boardsPerFace === 2 ? 'separativa' : null
  const row = wallType ? GYPSUM_2014_PERFORMANCE[wallType].find(r => r.stud === input.studMm) : undefined
  const spacing = input.spacingMm === 600 || input.spacingMm === 400 ? input.spacingMm : null
  const unknown = (note: string): WallCheck => ({
    height: { status: 'unknown', limitM: null, heightM: input.heightM },
    fire: { status: 'unknown', ratingMin: null, requiredMin: input.requiredFireMin ?? null },
    acoustic: { status: 'unknown', range: null, requiredDb: input.requiredAcousticDb ?? null },
    wallType,
    note,
  })
  if (!wallType) return unknown('boards_per_face_not_in_table')
  if (!row) return unknown('stud_not_in_table')

  const limitM = spacing ? row.limits[spacing][input.doubleStuds ? 'double' : 'single'] : null
  // RU board has the same performance as ST per the catalog; RF uses the C/RF column.
  const ratingMin = input.board === 'RF' ? row.fireMin.rf : row.fireMin.st
  const range = input.glassWool ? row.acoustic.withWool : row.acoustic.withoutWool
  const reqFire = input.requiredFireMin ?? null
  const reqDb = input.requiredAcousticDb ?? null
  return {
    height: { status: limitM == null ? 'unknown' : input.heightM <= limitM + 1e-9 ? 'ok' : 'fail', limitM, heightM: input.heightM },
    fire: { status: reqFire == null ? 'unknown' : ratingMin >= reqFire ? 'ok' : 'fail', ratingMin, requiredMin: reqFire },
    // Uses the lower value of the printed range (conservative). What the two values mean is not confirmed.
    acoustic: { status: reqDb == null ? 'unknown' : range[0] >= reqDb ? 'ok' : 'fail', range, requiredDb: reqDb },
    wallType,
    note: spacing ? null : 'spacing_not_in_table',
  }
}
