import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

/*
 * Reads a supplier invoice (photo or PDF) with Claude and returns its items as structured data
 * for the Daily Report Materials section. Nothing is saved here: the user reviews the items
 * in the app before they are added. Requires ANTHROPIC_API_KEY (server-only) in the environment.
 */

// The app reduces photos before sending; requests must stay under the hosting body limit (~4.5 MB).
const MAX_BYTES = 3 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const PDF_TYPE = 'application/pdf'

const TOOL = {
  name: 'record_invoice',
  description: 'Record the supplier invoice header and every line item exactly as printed.',
  input_schema: {
    type: 'object',
    properties: {
      supplier_name: { type: ['string', 'null'], description: 'Seller / issuer company name (in Brazilian NF-e/DANFE: EMITENTE).' },
      supplier_tax_id: { type: ['string', 'null'], description: 'Seller tax ID (CNPJ, EIN, etc.) as printed.' },
      invoice_number: { type: ['string', 'null'], description: 'Invoice number (NF-e: Nº).' },
      invoice_series: { type: ['string', 'null'] },
      invoice_date: { type: ['string', 'null'], description: 'Issue date in ISO format YYYY-MM-DD.' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Product description as printed.' },
            code: { type: ['string', 'null'], description: 'Product code / SKU (NF-e: código do produto).' },
            quantity: { type: ['number', 'null'], description: 'Quantity as a number (use a dot for decimals).' },
            unit: { type: ['string', 'null'], description: 'Unit as printed (UN, PC, M, M2, KG, CX…).' },
            unit_price: { type: ['number', 'null'] },
            total: { type: ['number', 'null'] },
          },
          required: ['description'],
        },
      },
      warnings: { type: 'array', items: { type: 'string' }, description: 'Anything unreadable or uncertain, in short sentences.' },
    },
    required: ['items'],
  },
}

const PROMPT = `This is a photo or scan of a supplier invoice delivered to a construction site (it may be a Brazilian DANFE / NF-e, a US/Canadian invoice, a packing slip or a delivery note).
Extract the header and every product line with the record_invoice tool.
Rules:
- Copy descriptions, codes and units exactly as printed; do not translate.
- Quantities are numbers: "1.250,50" (Brazilian format) is 1250.5; "1,250.50" (US format) is 1250.5.
- Do not invent values. If a field is unreadable, use null and add a short warning.
- Ignore taxes, freight and totals rows that are not products.`

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 501 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }) }
  const { reportId, mediaType, data } = body || {}
  if (!reportId || !mediaType || !data) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  if (![...IMAGE_TYPES, PDF_TYPE].includes(mediaType)) return NextResponse.json({ error: 'unsupported_type' }, { status: 415 })
  if (Math.floor((data.length * 3) / 4) > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })

  // The user must be able to see this report (row-level security decides).
  const { data: report } = await supabase.from('daily_reports').select('id,status').eq('id', reportId).maybeSingle()
  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (report.status === 'approved') return NextResponse.json({ error: 'locked' }, { status: 409 })

  const source = mediaType === PDF_TYPE
    ? { type: 'document', source: { type: 'base64', media_type: PDF_TYPE, data } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data } }

  let response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_INVOICE_MODEL || 'claude-sonnet-5-5',
        max_tokens: 4096,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{ role: 'user', content: [source, { type: 'text', text: PROMPT }] }],
      }),
    })
  } catch {
    return NextResponse.json({ error: 'ai_unreachable' }, { status: 502 })
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('Invoice import: AI request failed', response.status, detail.slice(0, 500))
    return NextResponse.json({ error: 'ai_failed' }, { status: 502 })
  }
  const result = await response.json()
  const call = (result.content || []).find((block) => block.type === 'tool_use' && block.name === TOOL.name)
  if (!call) return NextResponse.json({ error: 'ai_failed' }, { status: 502 })

  const invoice = call.input || {}
  const items = (Array.isArray(invoice.items) ? invoice.items : [])
    .map((item) => ({
      description: String(item.description || '').trim(),
      code: item.code ? String(item.code).trim() : null,
      quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null,
      unit: item.unit ? String(item.unit).trim() : null,
    }))
    .filter((item) => item.description)

  return NextResponse.json({
    source: 'ai',
    supplier_name: invoice.supplier_name || null,
    supplier_tax_id: invoice.supplier_tax_id || null,
    invoice_number: [invoice.invoice_number, invoice.invoice_series ? `/${invoice.invoice_series}` : ''].filter(Boolean).join('') || null,
    invoice_date: invoice.invoice_date || null,
    items,
    warnings: Array.isArray(invoice.warnings) ? invoice.warnings.slice(0, 10) : [],
  })
}
