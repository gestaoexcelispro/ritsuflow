// Uploads an IFC file and stores its storeys, layers and elements in Supabase.
import type { createClient } from '@/lib/supabase/client'
import { readIfc } from '@/lib/takeoff/ifc/readIfc'
import { importIfcModel, importLabelsEnUS, importLabelsPtBR } from '@/lib/takeoff/ifc/importIfcModel'
import { ifcImportToRows } from '@/lib/takeoff/rows'
import { applyFramingDefaults, type FramingDefaults } from '@/lib/takeoff/framing/framing'
import type { AppLanguage } from '@/lib/i18n/settings'

const BUCKET = 'takeoff-files'
const BATCH = 500

export type IfcImportOutcome = {
  walls: number
  layers: number
  elements: number
  warnings: number
}

export class IfcEmptyError extends Error {}

function safeFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_')
}

export async function importIfcFile(
  supabase: ReturnType<typeof createClient>,
  file: File,
  projectId: string,
  language: AppLanguage,
  sortStart: number,
  onSaving?: (elements: number) => void,
  defaults: FramingDefaults = {},
): Promise<IfcImportOutcome> {
  // STEP files are ASCII with escape sequences; Latin-1 decoding matches the prototype.
  const text = new TextDecoder('iso-8859-1').decode(await file.arrayBuffer())
  const read = readIfc(text)
  if (!read.walls.length && !read.ceilings.length) throw new IfcEmptyError()
  const model = importIfcModel(read, language !== 'pt-BR' ? importLabelsEnUS : importLabelsPtBR)
  for (const item of model.items) if (item.framing) item.framing = applyFramingDefaults(item.framing, defaults)

  const path = `${projectId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
  const upload = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/octet-stream', upsert: false })
  if (upload.error) throw upload.error

  const rows = ifcImportToRows(model, { projectId, filePath: path, fileName: file.name, schema: read.schema, app: read.app, sortStart })
  onSaving?.(rows.elements.length)

  const createdSources: string[] = []
  const createdLayers: string[] = []
  try {
    const sources = await supabase.from('takeoff_sources').insert(rows.sources).select('id, metadata')
    if (sources.error) throw sources.error
    const sourceByIndex = new Map<number, string>()
    for (const s of sources.data || []) {
      createdSources.push(s.id)
      sourceByIndex.set(Number((s.metadata as Record<string, unknown>).storey_index), s.id)
    }

    const layerInsert = rows.layers.map(layer => {
      const { key, ...row } = layer
      void key
      return row
    })
    const layers = await supabase.from('takeoff_layers').insert(layerInsert).select('id')
    if (layers.error) throw layers.error
    // PostgREST returns inserted rows in request order.
    const layerByKey = new Map<string, string>()
    ;(layers.data || []).forEach((l, i) => {
      createdLayers.push(l.id)
      layerByKey.set(rows.layers[i].key, l.id)
    })

    const elements = rows.elements.map(({ layerKey, storeyIndex, ...e }) => ({
      ...e,
      layer_id: layerByKey.get(layerKey)!,
      source_id: sourceByIndex.get(storeyIndex)!,
    }))
    for (let i = 0; i < elements.length; i += BATCH) {
      const insert = await supabase.from('takeoff_elements').insert(elements.slice(i, i + BATCH))
      if (insert.error) throw insert.error
    }

    return { walls: read.walls.length, layers: rows.layers.length, elements: rows.elements.length, warnings: read.warnings.length }
  } catch (error) {
    // Best effort cleanup. Deleting needs the admin role, so non-admins may leave partial rows.
    if (createdSources.length) await supabase.from('takeoff_sources').delete().in('id', createdSources)
    if (createdLayers.length) await supabase.from('takeoff_layers').delete().in('id', createdLayers)
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
}
