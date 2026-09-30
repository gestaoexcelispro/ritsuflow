import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SCAN_ROOTS = ['src/app', 'src/components'].map(p => path.join(ROOT, p)).filter(fs.existsSync)
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build'])
const IGNORE_TEXT = [
  /^RitsuFlow$/i, /^RitsuCAD$/i, /^PreCon$/i, /^FieldOp$/i,
  /^https?:\/\//i, /^\/[^ ]*$/, /^[A-Z0-9_-]{1,6}$/,
  /^[-–—→←×+✓●○•]+$/,
]

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full)
  }
  return out
}

function clean(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function shouldReport(text) {
  if (!text || text.length < 2 || !/[A-Za-zÀ-ÿ]/.test(text)) return false
  if (IGNORE_TEXT.some(rx => rx.test(text))) return false
  if (/^(className|href|src|type|id|key|name|value|role|status|method|POST|GET|PATCH|DELETE)$/i.test(text)) return false
  return true
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

const findings = []
for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, 'utf8')
    const relative = path.relative(ROOT, file).replaceAll('\\', '/')
    const patterns = [
      { kind: 'jsx-text', rx: />\s*([^<>{}\n][^<>{}]*)\s*</g },
      { kind: 'ui-attribute', rx: /\b(?:placeholder|title|aria-label|alt)\s*=\s*["']([^"']+)["']/g },
      { kind: 'dialog', rx: /\b(?:alert|confirm|prompt)\(\s*["'`]([^"'`]+)["'`]\s*\)/g },
      { kind: 'error', rx: /new\s+Error\(\s*["'`]([^"'`]+)["'`]\s*\)/g },
    ]
    for (const { kind, rx } of patterns) {
      for (const match of source.matchAll(rx)) {
        const text = clean(match[1] || '')
        if (!shouldReport(text)) continue
        findings.push({ file: relative, line: lineNumber(source, match.index ?? 0), kind, text })
      }
    }
  }
}

const byModule = new Map()
for (const item of findings) {
  const parts = item.file.split('/')
  const module = parts[0] === 'src' && parts[1] === 'app' ? (parts[2] || 'app') : 'components'
  byModule.set(module, (byModule.get(module) || 0) + 1)
}

console.log('\nRitsuFlow Internationalization Audit')
console.log('====================================')
console.log(`Files scanned: ${new Set(findings.map(x => x.file)).size}`)
console.log(`Potential hard-coded UI strings: ${findings.length}\n`)
console.log('By area:')
for (const [module, count] of [...byModule.entries()].sort((a,b) => b[1]-a[1])) console.log(`  ${module.padEnd(24)} ${count}`)

console.log('\nFindings:')
for (const item of findings) console.log(`${item.file}:${item.line} [${item.kind}] ${item.text}`)

if (process.argv.includes('--strict') && findings.length) process.exitCode = 1
