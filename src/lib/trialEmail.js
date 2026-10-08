// Trial application emails through Resend (https://resend.com). Dormant until RESEND_API_KEY is set
// in Vercel; the application is saved either way and a failed email never fails the request.
//   RESEND_API_KEY     — API key from Resend (required to send)
//   TRIAL_EMAIL_FROM   — verified sender, default "RitsuFlow <contact@excelispro.com>"
//   TRIAL_NOTIFY_TO    — who is told about new applications, default "contact@excelispro.com"

const COUNTRIES = { BR: 'Brazil', US: 'United States', other: 'Other' }
const ROLES = { estimator: 'Estimator', planner: 'Planner / PM', site_manager: 'Site manager', owner: 'Owner / director', other: 'Other' }
const INTERESTS = { estimating: 'Takeoff & estimating', planning: 'Lean planning', field: 'Field control' }

const CONFIRM = {
  'en-US': {
    subject: 'We received your RitsuFlow trial application',
    body: (name) => `Hi ${name},\n\nThank you for applying for the RitsuFlow V1 trial. We'll review your application and reply by email.\n\nQuestions? Just answer this message.\n\nExcelisPro · RitsuFlow™\nhttps://ritsuflow.com`,
  },
  'pt-BR': {
    subject: 'Recebemos sua inscrição no teste do RitsuFlow',
    body: (name) => `Olá, ${name},\n\nObrigado por se inscrever no teste da V1 do RitsuFlow. Vamos analisar sua inscrição e responder por e-mail.\n\nDúvidas? É só responder esta mensagem.\n\nExcelisPro · RitsuFlow™\nhttps://ritsuflow.com`,
  },
  es: {
    subject: 'Recibimos tu solicitud para la prueba de RitsuFlow',
    body: (name) => `Hola, ${name}:\n\nGracias por solicitar la prueba de la V1 de RitsuFlow. Revisaremos tu solicitud y te responderemos por correo.\n\n¿Preguntas? Solo responde este mensaje.\n\nExcelisPro · RitsuFlow™\nhttps://ritsuflow.com`,
  },
}

async function send(key, payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`)
}

/** Notifies ExcelisPro and confirms to the applicant. Returns without doing anything when not configured. */
export async function sendTrialEmails(row) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, reason: 'not configured' }
  const from = process.env.TRIAL_EMAIL_FROM || 'RitsuFlow <contact@excelispro.com>'
  const to = process.env.TRIAL_NOTIFY_TO || 'contact@excelispro.com'
  const lines = [
    `Name: ${row.name}`, `Email: ${row.email}`, `Company: ${row.company}`,
    `Country: ${COUNTRIES[row.country] || row.country}`, `Role: ${ROLES[row.role] || row.role}`,
    `Active projects: ${row.active_projects}`,
    `Wants to try: ${(row.interests || []).map((k) => INTERESTS[k] || k).join(', ') || '—'}`,
    `Page language: ${row.language}`, '', 'Manage applications: https://ritsuflow.com/platform-admin',
  ]
  const confirm = CONFIRM[row.language] || CONFIRM['en-US']
  const results = await Promise.allSettled([
    send(key, { from, to: [to], reply_to: row.email, subject: `New trial application: ${row.company} (${row.name})`, text: lines.join('\n') }),
    send(key, { from, to: [row.email], reply_to: to, subject: confirm.subject, text: confirm.body(row.name.split(' ')[0]) }),
  ])
  const failed = results.filter((x) => x.status === 'rejected')
  if (failed.length) console.error('Trial emails failed:', failed.map((x) => x.reason?.message || x.reason))
  return { sent: failed.length === 0 }
}
