'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// One selected project for all PreCon tabs. The URL (?projectId=…) wins; the last choice is kept
// in this browser so opening another tab, or coming back later, starts on the same project.
const STORAGE_KEY = 'ritsuflow.precon.projectId'
const CHANGE_EVENT = 'precon:project'

function stored() {
  try { return window.localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
}

function store(projectId) {
  try {
    if (projectId) window.localStorage.setItem(STORAGE_KEY, projectId)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch { /* private mode or blocked storage: the URL still carries the project */ }
}

/** The project a PreCon page should open with: ?projectId=… first, then the last one chosen here. */
export function readPreconProjectId() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('projectId') || stored()
}

/** Call when the user picks a project on a PreCon page: updates the URL, this browser and the tabs. */
export function rememberPreconProjectId(projectId) {
  if (typeof window === 'undefined') return
  const id = projectId || ''
  store(id)
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('projectId', id)
  else url.searchParams.delete('projectId')
  window.history.replaceState(window.history.state, '', url)
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { projectId: id } }))
}

/** Selected project for the PreCon header tabs; follows the URL and rememberPreconProjectId(). */
export function usePreconProjectId() {
  const pathname = usePathname()
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('projectId')
    if (fromUrl) store(fromUrl)
    setProjectId(fromUrl || stored())
  }, [pathname])

  useEffect(() => {
    const onChange = (event) => setProjectId(event.detail?.projectId || '')
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [])

  return projectId
}
