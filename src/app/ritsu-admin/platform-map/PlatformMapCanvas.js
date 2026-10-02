'use client'

import { useEffect, useRef } from 'react'
import { createPlatformMapEditor } from './createPlatformMapEditor'

export default function PlatformMapCanvas() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    let dispose
    let cancelled = false

    createPlatformMapEditor(containerRef.current).then((cleanup) => {
      if (cancelled) cleanup?.()
      else dispose = cleanup
    })

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 620 }} />
}
