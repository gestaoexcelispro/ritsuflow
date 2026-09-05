import React from 'react'
import fs from 'node:fs/promises'
import path from 'node:path'

import { renderToBuffer } from '@react-pdf/renderer'

import { createClient } from '../../../../../lib/supabase/server'

import ProjectSetupReportDocument from '../../../../dashboard/projects/setup/report/ProjectSetupReportDocument'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROJECT_COVER_BUCKET = 'project-covers'
const COVER_SIGNED_URL_SECONDS = 60 * 10

const VALID_SECTION_KEYS = new Set([
  'cover',
  'basicInformation',
  'scopeSummary',
  'locationStructure',
  'quantityReconciliation',
  'scopeAllocationMatrix',
  'quantificationByLocation',
  'productionParameters',
])

function normalizeFileName(value) {
  return String(value || 'Project')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90)
}

function normalizeSections(input) {
  const sections = {}

  for (const key of VALID_SECTION_KEYS) {
    sections[key] = input?.[key] === true
  }

  return sections
}

function hasSelectedSection(sections) {
  return Object.values(sections).some(Boolean)
}

function mimeFromPath(filePath) {
  const extension = path.extname(filePath || '').toLowerCase()

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg'
  }

  if (extension === '.webp') {
    return 'image/webp'
  }

  return 'image/png'
}

async function readPublicImageDataUri(fileName) {
  try {
    const absolutePath = path.join(
      process.cwd(),
      'public',
      fileName
    )

    const data = await fs.readFile(absolutePath)

    return `data:${mimeFromPath(fileName)};base64,${data.toString(
      'base64'
    )}`
  } catch (error) {
    console.warn(
      `Project Setup report asset ${fileName} could not be read.`,
      error
    )

    return ''
  }
}

async function fetchImageAsDataUri(url) {
  if (!url) {
    return ''
  }

  try {
    const response = await fetch(url)

    if (!response.ok) {
      return ''
    }

    const contentType =
      response.headers.get('content-type') || 'image/jpeg'

    const buffer = Buffer.from(await response.arrayBuffer())

    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch (error) {
    console.warn(
      'Project Setup report image could not be downloaded.',
      error
    )

    return ''
  }
}

export async function POST(request, context) {
  try {
    const { projectId } = await context.params

    if (!projectId) {
      return Response.json(
        {
          error: 'Project ID is required.',
        },
        {
          status: 400,
        }
      )
    }

    let body = {}

    try {
      body = await request.json()
    } catch {
      return Response.json(
        {
          error: 'Invalid report request.',
        },
        {
          status: 400,
        }
      )
    }

    const sections = normalizeSections(body?.sections)

    if (!hasSelectedSection(sections)) {
      return Response.json(
        {
          error: 'Select at least one report section.',
        },
        {
          status: 400,
        }
      )
    }

    const reportTitle =
      String(body?.reportTitle || 'Project Setup Report')
        .trim()
        .slice(0, 120) || 'Project Setup Report'

    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return Response.json(
        {
          error: 'Authentication is required.',
        },
        {
          status: 401,
        }
      )
    }

    const {
      data: project,
      error: projectError,
    } = await supabase
      .from('projects')
      .select(`
        id,
        organization_id,
        code,
        name,
        client_name,
        status,
        proposal_number,
        contract_number,
        contract_value,
        currency_code,
        planned_start_date,
        planned_finish_date,
        address_line,
        neighborhood,
        city,
        state_region,
        postal_code,
        country_code,
        latitude,
        longitude,
        geofence_radius_m,
        geofence_enabled,
        max_gps_accuracy_m,
        cover_image_path
      `)
      .eq('id', projectId)
      .maybeSingle()

    if (projectError) {
      console.error(
        'Project Setup report project could not be loaded.',
        projectError
      )

      return Response.json(
        {
          error: 'The project could not be loaded.',
        },
        {
          status: 500,
        }
      )
    }

    if (!project) {
      return Response.json(
        {
          error:
            'The project does not exist or your account cannot access it.',
        },
        {
          status: 404,
        }
      )
    }

    const [
      organizationResult,
      workPackagesResult,
      scopeItemsResult,
      locationsResult,
      allocationsResult,
      productionParametersResult,
    ] = await Promise.all([
      supabase
        .from('organizations')
        .select('id, name')
        .eq('id', project.organization_id)
        .maybeSingle(),

      supabase
        .from('project_work_packages')
        .select(`
          id,
          project_id,
          code,
          description,
          color,
          is_active
        `)
        .eq('project_id', projectId)
        .order('code', { ascending: true }),

      supabase
        .from('project_services')
        .select(`
          id,
          project_id,
          project_work_package_id,
          service_code,
          service_name,
          unit,
          scope_quantity,
          unit_cost,
          sequence_number,
          is_active
        `)
        .eq('project_id', projectId)
        .order('sequence_number', { ascending: true }),

      supabase
        .from('locations')
        .select(`
          id,
          project_id,
          parent_id,
          name,
          location_type,
          environment_type,
          sequence_number,
          created_at,
          updated_at
        `)
        .eq('project_id', projectId)
        .order('sequence_number', { ascending: true }),

      supabase
        .from('location_service_quantities')
        .select(`
          id,
          project_id,
          location_id,
          service_id,
          quantity,
          source_scope_item_id,
          created_at,
          updated_at
        `)
        .eq('project_id', projectId),

      supabase
        .from('project_service_production_parameters')
        .select(`
          id,
          project_id,
          service_id,
          productivity_rate,
          quantity_unit,
          productivity_basis,
          effective_workforce,
          created_at,
          updated_at
        `)
        .eq('project_id', projectId),
    ])

    const queryErrors = [
      organizationResult.error,
      workPackagesResult.error,
      scopeItemsResult.error,
      locationsResult.error,
      allocationsResult.error,
      productionParametersResult.error,
    ].filter(Boolean)

    if (queryErrors.length > 0) {
      console.error(
        'Project Setup report data could not be loaded.',
        queryErrors
      )

      return Response.json(
        {
          error:
            'One or more Project Setup report sections could not be loaded.',
        },
        {
          status: 500,
        }
      )
    }

    let coverDataUri = ''

    if (
      project.cover_image_path &&
      (sections.cover || sections.basicInformation)
    ) {
      const {
        data: signedData,
        error: signedError,
      } = await supabase.storage
        .from(PROJECT_COVER_BUCKET)
        .createSignedUrl(
          project.cover_image_path,
          COVER_SIGNED_URL_SECONDS
        )

      if (signedError) {
        console.warn(
          'Project Setup report cover signed URL could not be created.',
          signedError
        )
      } else {
        coverDataUri = await fetchImageAsDataUri(
          signedData?.signedUrl
        )
      }
    }

    const logoDataUri = await readPublicImageDataUri('logo.png')
    const generatedAt = new Date().toISOString()

    const document = React.createElement(
      ProjectSetupReportDocument,
      {
        reportTitle,
        sections,
        project,
        organization: organizationResult.data || null,
        workPackages: workPackagesResult.data || [],
        scopeItems: scopeItemsResult.data || [],
        locations: locationsResult.data || [],
        allocations: allocationsResult.data || [],
        productionParameters:
          productionParametersResult.data || [],
        logoDataUri,
        coverDataUri,
        generatedAt,
      }
    )

    const pdfBuffer = await renderToBuffer(document)

    const projectToken = normalizeFileName(
      project.code || project.name || project.id
    )

    const reportToken = normalizeFileName(reportTitle)

    const fileName =
      `RitsuFlow-${projectToken}-${reportToken}.pdf`

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error(
      'Project Setup PDF generation failed.',
      error
    )

    return Response.json(
      {
        error:
          error?.message ||
          'The Project Setup report could not be generated.',
      },
      {
        status: 500,
      }
    )
  }
}
