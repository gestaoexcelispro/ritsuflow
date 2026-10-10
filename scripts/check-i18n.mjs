// Fails the build when a translation is missing.
// Every module has one JSON file per language in src/lib/i18n/messages (<namespace>.<language>.json).
// English (US) is the source: every other language must have exactly the same keys, none empty.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const LANGUAGES = ['en-US', 'es', 'pt-BR']
const SOURCE = 'en-US'
const dir = new URL('../src/lib/i18n/messages/', import.meta.url)

const files = readdirSync(dir).filter((name) => name.endsWith('.json'))
const namespaces = [...new Set(files.map((name) => name.split('.')[0]))]
const problems = []

function load(namespace, language) {
  const file = `${namespace}.${language}.json`
  if (!files.includes(file)) {
    problems.push(`${file}: file is missing`)
    return null
  }
  try {
    return JSON.parse(readFileSync(join(dir.pathname, file), 'utf8'))
  } catch (error) {
    problems.push(`${file}: invalid JSON (${error.message})`)
    return null
  }
}

for (const namespace of namespaces) {
  const source = load(namespace, SOURCE)
  if (!source) continue
  const sourceKeys = Object.keys(source)
  for (const language of LANGUAGES) {
    const messages = language === SOURCE ? source : load(namespace, language)
    if (!messages) continue
    for (const key of sourceKeys) {
      if (!(key in messages)) problems.push(`${namespace}.${language}: missing "${key}"`)
      else if (typeof messages[key] !== 'string' || !messages[key].trim()) problems.push(`${namespace}.${language}: empty "${key}"`)
    }
    for (const key of Object.keys(messages)) {
      if (!(key in source)) problems.push(`${namespace}.${language}: "${key}" is not in ${SOURCE}`)
    }
  }
}

if (problems.length) {
  console.error(`Translation check failed (${problems.length}):\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`Translations OK: ${namespaces.length} modules × ${LANGUAGES.length} languages.`)
