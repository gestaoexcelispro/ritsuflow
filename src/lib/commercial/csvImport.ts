// Price book import: a CSV saved from Excel or Google Sheets (comma or semicolon, Portuguese,
// English or Spanish headers). Pure functions, tested in scripts/commercial-pricing.test.mjs.

export type ImportRow = {
  line: number
  name: string
  unit: string
  unitCost: number
  code: string | null
  supplier: string | null
  kind: 'material' | 'equipment' | 'subcontract' | 'other'
  currency: string | null
  validFrom: string | null
}

export type ImportResult = { rows: ImportRow[]; errors: { line: number; reason: 'name' | 'unit' | 'cost' | 'date' }[]; missingColumns: string[] }

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Header spellings accepted for each column. */
const HEADERS: Record<keyof Omit<ImportRow, 'line'>, string[]> = {
  name: ['name', 'nome', 'descricao', 'description', 'insumo', 'item', 'material', 'nombre', 'descripcion'],
  unit: ['unit', 'unidade', 'un', 'und', 'unidad', 'uom'],
  unitCost: ['unit cost', 'cost', 'price', 'unit price', 'custo', 'custo unitario', 'preco', 'preco unitario', 'valor', 'valor unitario', 'costo', 'costo unitario', 'precio', 'precio unitario'],
  code: ['code', 'codigo', 'cod', 'sku', 'ref', 'referencia'],
  supplier: ['supplier', 'fornecedor', 'vendor', 'proveedor', 'fabricante', 'manufacturer'],
  kind: ['kind', 'type', 'tipo', 'category', 'categoria'],
  currency: ['currency', 'moeda', 'moneda'],
  validFrom: ['valid from', 'valid', 'date', 'data', 'vigencia', 'valido a partir de', 'fecha'],
}

/** Splits CSV text into rows of cells: quotes, doubled quotes and line breaks inside quotes handled. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] || ''
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(x => x.trim() !== ''))
}

/** "1.234,56", "1,234.56", "R$ 12,50", "$12.50" → number. */
export function parseMoney(input: string): number {
  const s = input.replace(/[^\d,.-]/g, '')
  if (!s) return NaN
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return parseFloat(s.replace(/,/g, ''))
}

/** "2026-10-06", "06/10/2026" (pt/es) or "10/06/2026" (en, when `dayFirst` is false) → YYYY-MM-DD. */
export function parseDate(input: string, dayFirst: boolean): string | null {
  const s = input.trim()
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!m) return null
  const [d, mo] = dayFirst ? [m[1], m[2]] : [m[2], m[1]]
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null
  return `${m[3]}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

const KIND_WORDS: Record<ImportRow['kind'], string[]> = {
  material: ['material', 'materiais', 'materiales', 'insumo'],
  equipment: ['equipment', 'equipamento', 'equipo', 'equipamentos'],
  subcontract: ['subcontract', 'empreitada', 'subcontrato', 'servico terceirizado', 'terceirizado'],
  other: ['other', 'outro', 'otro', 'outros'],
}

export function readPriceCsv(text: string, dayFirst: boolean): ImportResult {
  const table = parseCsv(text)
  const header = (table[0] || []).map(strip)
  const col = {} as Record<keyof typeof HEADERS, number>
  for (const key of Object.keys(HEADERS) as (keyof typeof HEADERS)[]) col[key] = header.findIndex(h => HEADERS[key].includes(h))
  const missingColumns = (['name', 'unit', 'unitCost'] as const).filter(k => col[k] < 0)
  if (missingColumns.length) return { rows: [], errors: [], missingColumns }

  const rows: ImportRow[] = []
  const errors: ImportResult['errors'] = []
  table.slice(1).forEach((cells, i) => {
    const line = i + 2
    const get = (k: keyof typeof HEADERS) => (col[k] >= 0 ? (cells[col[k]] ?? '').trim() : '')
    const name = get('name'), unit = get('unit'), cost = parseMoney(get('unitCost'))
    if (!name) { errors.push({ line, reason: 'name' }); return }
    if (!unit) { errors.push({ line, reason: 'unit' }); return }
    if (!(cost >= 0)) { errors.push({ line, reason: 'cost' }); return }
    const rawDate = get('validFrom')
    const validFrom = rawDate ? parseDate(rawDate, dayFirst) : null
    if (rawDate && !validFrom) { errors.push({ line, reason: 'date' }); return }
    const k = strip(get('kind'))
    const kind = (Object.keys(KIND_WORDS) as ImportRow['kind'][]).find(x => KIND_WORDS[x].includes(k)) || 'material'
    const currency = get('currency').toUpperCase()
    rows.push({
      line, name, unit, unitCost: cost, code: get('code') || null, supplier: get('supplier') || null, kind,
      currency: /^[A-Z]{3}$/.test(currency) ? currency : null, validFrom,
    })
  })
  return { rows, errors, missingColumns }
}

/** Template the user can open in Excel and fill in. */
export function priceTemplateCsv(language: string): string {
  const pt = language === 'pt-BR', es = language === 'es'
  const head = pt ? 'Código;Nome;Unidade;Custo unitário;Fornecedor;Tipo;Válido a partir de'
    : es ? 'Código;Nombre;Unidad;Costo unitario;Proveedor;Tipo;Válido desde'
    : 'Code,Name,Unit,Unit cost,Supplier,Type,Valid from'
  const rows = pt
    ? ['CH-ST-125;Chapa ST 12,5 mm;m2;22,90;Fornecedor A;Material;01/10/2026', 'MO-48;Montante 48 mm;m;6,10;Fornecedor A;Material;01/10/2026']
    : es
      ? ['PL-ST-125;Placa ST 12,5 mm;m2;22,90;Proveedor A;Material;01/10/2026', 'MO-48;Montante 48 mm;m;6,10;Proveedor A;Material;01/10/2026']
      : ['GB-58X,"Gypsum board 5/8"" Type X",sf,0.62,Supplier A,Material,10/01/2026', 'ST-362,"Steel stud 3-5/8"" 20ga",lf,0.95,Supplier A,Material,10/01/2026']
  return `﻿${head}\n${rows.join('\n')}\n`
}
