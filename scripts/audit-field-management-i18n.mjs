import fs from 'node:fs'

const files = [
  'src/app/dashboard/field-management/workforce/page.js',
  'src/app/dashboard/field-management/workforce/assignments/page.js',
  'src/app/dashboard/field-management/workforce/attendance/page.js',
  'src/app/dashboard/field-management/workforce/attendance/layout.js',
  'src/app/dashboard/field-management/workforce/attendance/history/page.js',
  'src/app/dashboard/field-management/workforce/attendance/exceptions/page.js',
  'src/app/dashboard/field-management/workforce/attendance/audit/page.js',
]

const forbidden = [
  ['raw US assignment date formatter', /return `\$\{month\}\/\$\{day\}\/\$\{year\}`/],
  ['raw status capitalization', /status\.charAt\(0\)\.toUpperCase\(\)/],
  ['Workforce Registry literal', />\s*Workforce Registry\s*</],
  ['Project Assignments literal', />\s*Project Assignments\s*</],
  ['Add Worker literal', />\s*\+ Add Worker\s*</],
  ['New Assignment literal', />\s*\+ New Assignment\s*</],
  ['Close accessibility literal', /aria-label="Close"/],
  ['Cancel button literal', />\s*Cancel\s*</],
  ['Loading workforce literal', />\s*Loading workforce\.\.\.\s*</],
  ['Loading assignments literal', />\s*Loading project assignments\.\.\.\s*</],
  ['No workers literal', />\s*No workers registered\s*</],
  ['No assignments literal', />\s*No project assignments found\.\s*</],
]

let failures = []
for (const file of files) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing runtime surface`)
    continue
  }
  const source = fs.readFileSync(file, 'utf8')
  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) failures.push(`${file}: ${label}`)
  }
}

const required = [
  ['src/app/dashboard/field-management/workforce/page.js', /locale|workforce/i],
  ['src/app/dashboard/field-management/workforce/assignments/page.js', /locale|assignment/i],
  ['src/app/dashboard/field-management/workforce/attendance/audit/page.js', /getAttendanceAuditCopy/],
]
for (const [file, pattern] of required) {
  if (!fs.existsSync(file) || !pattern.test(fs.readFileSync(file, 'utf8'))) {
    failures.push(`${file}: expected localization wiring not found`)
  }
}

if (failures.length) {
  console.error('\nFIELD MANAGEMENT I18N AUDIT: FAIL\n')
  for (const failure of failures) console.error(`- ${failure}`)
  console.error('\nAudit runs after migration scripts, so these findings represent post-migration runtime residue.\n')
  process.exit(1)
}

console.log(`FIELD MANAGEMENT I18N AUDIT: PASS (${files.length} runtime surfaces checked)`)
