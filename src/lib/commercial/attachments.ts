// PDFs that go out with a proposal: RitsuScope takeoff exports of the bid and files uploaded by hand.
// They live in the bid's takeoff-files folder (the bucket's access rules follow the project).
import type { createClient } from '@/lib/supabase/client'
import { loadPdfLib } from '@/app/ritsuscope/[projectId]/printPdf'

type Supabase = ReturnType<typeof createClient>

export const ATTACH_BUCKET = 'takeoff-files'

export type AttachmentFile = { path: string; name: string; kind: 'export' | 'upload'; updatedAt: string | null; size: number | null }

/** RitsuScope saves `<project>/exports/<what>.pdf`; uploads go to `<project>/attachments/`. */
export async function listAttachments(supabase: Supabase, projectId: string): Promise<AttachmentFile[]> {
  const out: AttachmentFile[] = []
  for (const [folder, kind] of [['exports', 'export'], ['attachments', 'upload']] as const) {
    const { data, error } = await supabase.storage.from(ATTACH_BUCKET).list(`${projectId}/${folder}`, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(error.message)
    for (const f of data || []) {
      if (!f.name.toLowerCase().endsWith('.pdf')) continue
      const meta = (f.metadata || {}) as { size?: number }
      out.push({ path: `${projectId}/${folder}/${f.name}`, name: f.name, kind, updatedAt: f.updated_at ?? null, size: typeof meta.size === 'number' ? meta.size : null })
    }
  }
  return out
}

/** A storage-safe file name that keeps the original's look. */
export function safeFileName(name: string): string {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._ -]+/g, '_').replace(/\s+/g, ' ').trim()
  return (base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`).slice(-120)
}

export async function uploadAttachment(supabase: Supabase, projectId: string, file: File): Promise<string> {
  const path = `${projectId}/attachments/${Date.now().toString(36)}-${safeFileName(file.name)}`
  const { error } = await supabase.storage.from(ATTACH_BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (error) throw new Error(error.message)
  return path
}

/** Appends every page of the given PDFs to the proposal. Files that no longer exist are reported, not fatal. */
export async function appendPdfs(supabase: Supabase, proposal: Blob, paths: string[]): Promise<{ blob: Blob; missing: string[] }> {
  if (!paths.length) return { blob: proposal, missing: [] }
  const PDFLib = await loadPdfLib()
  const out = await PDFLib.PDFDocument.load(await proposal.arrayBuffer())
  const missing: string[] = []
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(ATTACH_BUCKET).download(path)
    if (error || !data) { missing.push(path.split('/').pop() || path); continue }
    const doc = await PDFLib.PDFDocument.load(await data.arrayBuffer(), { ignoreEncryption: true })
    const pages = await out.copyPages(doc, doc.getPageIndices())
    for (const p of pages) out.addPage(p)
  }
  const bytes: Uint8Array = await out.save()
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), missing }
}
