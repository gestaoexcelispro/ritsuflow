// Small, safe arithmetic formulas for system recipes, e.g. "area * (layers_a + layers_b) * 1.05".
// No eval: a recursive-descent parser builds a function over named variables.
//
// Grammar: expr = term (('+'|'-') term)* ; term = power (('*'|'/') power)* ;
//          power = unary ('^' power)? ; unary = '-' unary | primary ;
//          primary = number | name | name '(' args ')' | '(' expr ')'
// Numbers use '.' or ',' as the decimal mark ("1,05" = 1.05). Function arguments are
// separated by ';' (as in a pt-BR spreadsheet) or by ', ' (comma followed by a space).
// Functions: min, max, ceil, floor, round, abs, if(cond; a; b) — cond counts as true when > 0.

export type Formula = { vars: string[]; run: (v: Record<string, number>) => number }
export type FormulaError = { message: string; at: number }

type Tok = { t: 'num' | 'name' | 'op' | 'sep' | '(' | ')'; v: string; at: number }

const FUNCS: Record<string, { min: number; max: number; fn: (...a: number[]) => number }> = {
  min: { min: 1, max: 99, fn: (...a) => Math.min(...a) },
  max: { min: 1, max: 99, fn: (...a) => Math.max(...a) },
  ceil: { min: 1, max: 1, fn: a => Math.ceil(a - 1e-9) },
  floor: { min: 1, max: 1, fn: a => Math.floor(a + 1e-9) },
  round: { min: 1, max: 2, fn: (a, d = 0) => { const f = 10 ** d; return Math.round(a * f) / f } },
  abs: { min: 1, max: 1, fn: a => Math.abs(a) },
  if: { min: 3, max: 3, fn: (c, a, b) => (c > 0 ? a : b) },
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue }
    if (/[0-9.]/.test(c) || (c === ',' && /[0-9]/.test(src[i + 1] || '') && /[0-9]/.test(src[i - 1] || ''))) {
      const start = i
      let s = ''
      while (i < src.length && (/[0-9.]/.test(src[i]) || (src[i] === ',' && /[0-9]/.test(src[i + 1] || '') && /[0-9]/.test(src[i - 1] || '')))) { s += src[i] === ',' ? '.' : src[i]; i++ }
      if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) throw { message: `Invalid number "${src.slice(start, i)}"`, at: start } as FormulaError
      out.push({ t: 'num', v: s, at: start })
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      const start = i
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++
      out.push({ t: 'name', v: src.slice(start, i).toLowerCase(), at: start })
      continue
    }
    if ('+-*/^'.includes(c)) { out.push({ t: 'op', v: c, at: i }); i++; continue }
    if (c === ';' || c === ',') { out.push({ t: 'sep', v: c, at: i }); i++; continue }
    if (c === '(' || c === ')') { out.push({ t: c, v: c, at: i }); i++; continue }
    throw { message: `Unexpected "${c}"`, at: i } as FormulaError
  }
  return out
}

type Node = (v: Record<string, number>) => number

/** Compiles a formula. Throws a FormulaError with the position of the problem. */
export function compileFormula(src: string, known?: Set<string>): Formula {
  const toks = tokenize(src)
  if (!toks.length) throw { message: 'Empty formula', at: 0 } as FormulaError
  let p = 0
  const vars = new Set<string>()
  const peek = () => toks[p]
  const fail = (message: string): never => { throw { message, at: peek()?.at ?? src.length } as FormulaError }

  const expr = (): Node => {
    let left = term()
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = toks[p++].v
      const a = left, b = term()
      left = op === '+' ? v => a(v) + b(v) : v => a(v) - b(v)
    }
    return left
  }
  const term = (): Node => {
    let left = power()
    while (peek()?.t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = toks[p++].v
      const a = left, b = power()
      left = op === '*' ? v => a(v) * b(v) : v => { const d = b(v); return d === 0 ? 0 : a(v) / d }
    }
    return left
  }
  const power = (): Node => {
    const base = unary()
    if (peek()?.t === 'op' && peek().v === '^') { p++; const e = power(); return v => base(v) ** e(v) }
    return base
  }
  const unary = (): Node => {
    if (peek()?.t === 'op' && peek().v === '-') { p++; const a = unary(); return v => -a(v) }
    if (peek()?.t === 'op' && peek().v === '+') { p++; return unary() }
    return primary()
  }
  const primary = (): Node => {
    const tk = peek()
    if (!tk) return fail('Formula ends too early')
    if (tk.t === 'num') { p++; const n = Number(tk.v); return () => n }
    if (tk.t === '(') {
      p++
      const inner = expr()
      if (peek()?.t !== ')') fail('Missing ")"')
      p++
      return inner
    }
    if (tk.t === 'name') {
      p++
      if (peek()?.t === '(') {
        const f = FUNCS[tk.v]
        if (!f) { p--; return fail(`Unknown function "${tk.v}"`) }
        p++
        const args: Node[] = []
        if (peek()?.t !== ')') {
          args.push(expr())
          while (peek()?.t === 'sep') { p++; args.push(expr()) }
        }
        if (peek()?.t !== ')') fail('Missing ")"')
        p++
        if (args.length < f.min || args.length > f.max) { p--; fail(`"${tk.v}" takes ${f.min === f.max ? f.min : `${f.min}–${f.max}`} value(s)`) }
        return v => f.fn(...args.map(a => a(v)))
      }
      if (known && !known.has(tk.v)) { p--; return fail(`Unknown value "${tk.v}"`) }
      vars.add(tk.v)
      const name = tk.v
      return v => v[name] ?? 0
    }
    return fail(`Unexpected "${tk.v}"`)
  }

  const root = expr()
  if (p < toks.length) fail(`Unexpected "${toks[p].v}"`)
  return { vars: [...vars], run: v => { const r = root(v); return Number.isFinite(r) ? r : 0 } }
}

/** Compiles and reports the problem instead of throwing. */
export function checkFormula(src: string, known?: Set<string>): FormulaError | null {
  try { compileFormula(src, known); return null } catch (e) { return e as FormulaError }
}
