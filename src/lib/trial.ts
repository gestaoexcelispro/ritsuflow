// Trial applications from the landing page (public.trial_applications). Pure validation, shared by
// the form and the /api/trial route; tested in scripts/commercial-pricing.test.mjs.
export const TRIAL_COUNTRIES = ['BR', 'US', 'other'] as const
export const TRIAL_ROLES = ['estimator', 'planner', 'site_manager', 'owner', 'other'] as const
export const TRIAL_PROJECTS = ['1-3', '4-10', '10+'] as const
export const TRIAL_INTERESTS = ['estimating', 'planning', 'field'] as const
export const TRIAL_LANGUAGES = ['en-US', 'pt-BR', 'es'] as const

export type TrialInterest = (typeof TRIAL_INTERESTS)[number]

export type TrialRow = {
  name: string
  email: string
  company: string
  country: (typeof TRIAL_COUNTRIES)[number]
  role: (typeof TRIAL_ROLES)[number]
  active_projects: (typeof TRIAL_PROJECTS)[number]
  interests: TrialInterest[]
  language: (typeof TRIAL_LANGUAGES)[number]
  consent_at: string
}

const pick = <T extends readonly string[]>(list: T, value: unknown, fallback: T[number]): T[number] =>
  (list as readonly string[]).includes(String(value)) ? (value as T[number]) : fallback

const text = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/**
 * Turns a posted body into a row, or the reason it is refused. `spam` = the hidden "website" field
 * was filled (bots); the route answers 200 to those without storing anything.
 */
export function readTrialApplication(body: unknown, now: Date): { row: TrialRow } | { error: 'invalid' | 'consent' | 'spam' } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (text(b.website, 200)) return { error: 'spam' }
  const name = text(b.name, 200), company = text(b.company, 200), email = text(b.email, 320).toLowerCase()
  if (!name || !company || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'invalid' }
  if (b.consent !== true) return { error: 'consent' }
  const interests = Array.isArray(b.interests)
    ? [...new Set(b.interests.map(String).filter((x): x is TrialInterest => (TRIAL_INTERESTS as readonly string[]).includes(x)))]
    : []
  return {
    row: {
      name, email, company,
      country: pick(TRIAL_COUNTRIES, b.country, 'other'),
      role: pick(TRIAL_ROLES, b.role, 'other'),
      active_projects: pick(TRIAL_PROJECTS, b.activeProjects, '1-3'),
      interests,
      language: pick(TRIAL_LANGUAGES, b.language, 'en-US'),
      consent_at: now.toISOString(),
    },
  }
}
