import { spawnSync } from 'node:child_process'

const stages = [
  ['01 Master Plan i18n', 'node', ['scripts/wire-master-plan-i18n.mjs']],
  ['02 Lookahead i18n', 'node', ['scripts/wire-lookahead-i18n.mjs']],
  ['03 Weekly Planning i18n', 'node', ['scripts/wire-weekly-planning-i18n.mjs']],
  ['04 Workforce Core i18n', 'node', ['scripts/wire-workforce-i18n.mjs']],
  ['05 Workforce Assignments i18n', 'node', ['scripts/wire-workforce-assignments-i18n.mjs']],
  ['06 Attendance Core i18n', 'node', ['scripts/wire-workforce-attendance-i18n.mjs']],
  ['07 Attendance Exceptions i18n', 'node', ['scripts/wire-workforce-attendance-exceptions-i18n.mjs']],
  ['08 Attendance History i18n', 'node', ['scripts/wire-workforce-attendance-history-i18n.mjs']],
  ['09 Attendance Audit Trail i18n', 'node', ['scripts/wire-workforce-attendance-audit-i18n.mjs']],
  ['10 Field Management residual audit', 'node', ['scripts/audit-field-management-i18n.mjs']],
  ['11 Next.js production build', process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'build']],
]

console.log('\n=== RITSUFLOW I18N BUILD DIAGNOSTICS ===')
console.log(`Node: ${process.version}`)
console.log(`Platform: ${process.platform}`)
console.log(`Stages: ${stages.length}\n`)

for (const [label, command, args] of stages) {
  const startedAt = Date.now()
  console.log(`\n>>> STAGE START: ${label}`)

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2)

  if (result.error) {
    console.error(`<<< STAGE ERROR: ${label} (${elapsed}s)`)
    console.error(result.error)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`<<< STAGE FAIL: ${label} (${elapsed}s, exit ${result.status})`)
    process.exit(result.status ?? 1)
  }

  console.log(`<<< STAGE PASS: ${label} (${elapsed}s)`)
}

console.log('\n=== RITSUFLOW I18N BUILD: PASS ===\n')
