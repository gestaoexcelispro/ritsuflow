'use client'

import { useEffect } from 'react'
import './ritsuscope-base.css'

/** Applies the ExcelisPro base styles (see ritsuscope-base.css) while a RitsuScope page is mounted. */
export function useRitsuScopeBody() {
  useEffect(() => {
    document.body.classList.add('ritsuscope-body')
    return () => document.body.classList.remove('ritsuscope-body')
  }, [])
}
