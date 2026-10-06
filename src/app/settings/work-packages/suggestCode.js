// Suggests a 3-letter work package code from its description.
// Convention (same as the existing catalog): first 3 letters of the first meaningful word,
// accents removed — "Fundação" → FUN, "Cobertura" → COB. When that code is taken, it tries
// word initials and other letter combinations from the description until one is free.

// Connector words skipped in en-US, es and pt-BR descriptions.
const STOP_WORDS = new Set([
  'A', 'AN', 'AND', 'THE', 'OF', 'FOR', 'TO', 'IN', 'ON', 'WITH', 'OR',
  'E', 'O', 'OS', 'AS', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'EM', 'NA', 'NO', 'NAS', 'NOS', 'COM', 'PARA', 'POR', 'OU', 'AO', 'AOS',
  'Y', 'EL', 'LA', 'LOS', 'LAS', 'DEL', 'AL', 'CON', 'EN', 'U',
])

function wordsOf(description) {
  const words = String(description || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean)
  const meaningful = words.filter((w) => !STOP_WORDS.has(w))
  return meaningful.length ? meaningful : words
}

function* candidates(words) {
  const [first = '', second = '', third = ''] = words
  const letters = words.join('')
  if (letters.length < 3) return
  if (first.length >= 3) yield first.slice(0, 3)
  else yield letters.slice(0, 3)
  if (third) yield first[0] + second[0] + third[0]
  if (second) {
    yield first[0] + second.slice(0, 2)
    if (first.length >= 2) yield first.slice(0, 2) + second[0]
  }
  // First letter kept, then any two later letters in order.
  for (let i = 1; i < letters.length; i += 1) {
    for (let j = i + 1; j < letters.length; j += 1) yield letters[0] + letters[i] + letters[j]
  }
  // Last resort: first letter plus any two letters of the alphabet.
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const x of ABC) for (const y of ABC) yield letters[0] + x + y
}

/**
 * @param {string} description
 * @param {Iterable<string>} takenCodes codes already used in the company catalog
 * @returns {string} a free 3-letter code, or '' while the description has fewer than 3 letters
 */
export function suggestWorkPackageCode(description, takenCodes = []) {
  const taken = new Set(takenCodes)
  for (const code of candidates(wordsOf(description))) {
    if (/^[A-Z]{3}$/.test(code) && !taken.has(code)) return code
  }
  return ''
}
