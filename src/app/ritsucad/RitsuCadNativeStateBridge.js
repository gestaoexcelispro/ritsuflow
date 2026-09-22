'use client'

import { useEffect } from 'react'

/**
 * Small event contract used by the RitsuCAD engine and the persisted
 * Drawing Views UI. Keeping the transport here prevents Supabase/view
 * concerns from leaking into the CAD geometry engine.
 */
export const RITSUCAD_STATE_EVENTS = {
  request: 'ritsucad:drawing-state-request',
  response: 'ritsucad:drawing-state-response',
  apply: 'ritsucad:drawing-state-apply',
  changed: 'ritsucad:drawing-state-changed',
}

export function requestRitsuCadDrawingState(requestId) {
  window.dispatchEvent(
    new CustomEvent(RITSUCAD_STATE_EVENTS.request, {
      detail: { requestId },
    })
  )
}

export function applyRitsuCadDrawingState(state) {
  window.dispatchEvent(
    new CustomEvent(RITSUCAD_STATE_EVENTS.apply, {
      detail: state || {},
    })
  )
}

export default function RitsuCadNativeStateBridge() {
  useEffect(() => undefined, [])
  return null
}
