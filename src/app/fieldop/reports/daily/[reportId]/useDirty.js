'use client'

import { useEffect, useRef } from 'react'

/**
 * Tells the report page whether this section has changes that are not saved yet,
 * so it can warn before the user leaves the section or the page.
 */
export function useDirty(onDirty, dirty) {
  const latest = useRef(onDirty)
  latest.current = onDirty
  useEffect(() => { latest.current?.(Boolean(dirty)) }, [dirty])
  useEffect(() => () => latest.current?.(false), [])
}
