// Canonical Location QR payload for the FieldOp workflow.
// The QR identifies context only. It does not perform attendance or execution writes.

export const LOCATION_QR_VERSION = 1;
export const LOCATION_QR_KIND = 'ritsuflow_location';

export function createLocationQrPayload({ projectId, locationId }) {
  if (!projectId || !locationId) {
    throw new Error('Project and Location are required to create a Location QR payload.');
  }

  return JSON.stringify({
    kind: LOCATION_QR_KIND,
    version: LOCATION_QR_VERSION,
    project_id: projectId,
    location_id: locationId,
  });
}

export function parseLocationQrPayload(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: 'QR payload is empty.', context: {} };
  }

  try {
    const payload = JSON.parse(value);

    if (payload?.kind !== LOCATION_QR_KIND) {
      return { valid: false, error: 'This QR is not a RitsuFlow Location QR.', context: {} };
    }

    if (payload?.version !== LOCATION_QR_VERSION) {
      return { valid: false, error: 'Unsupported Location QR version.', context: {} };
    }

    if (!payload?.project_id || !payload?.location_id) {
      return { valid: false, error: 'Location QR is missing Project or Location identity.', context: {} };
    }

    return {
      valid: true,
      error: '',
      context: {
        project_id: payload.project_id,
        location_id: payload.location_id,
      },
    };
  } catch {
    return { valid: false, error: 'Location QR payload is invalid.', context: {} };
  }
}
