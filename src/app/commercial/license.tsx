'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Commercial access, read once in the layout. A company without the Commercial license (or whose
 * license ended) can still open and read its bids and library; the screens and the database
 * (row level security) both block changes.
 */
export type CommercialAccess = {
  /** The company's license includes Commercial (the platform owner always). */
  licensed: boolean
  isPlatformOwner: boolean
  organizationId: string | null
}

const AccessContext = createContext<CommercialAccess>({ licensed: false, isPlatformOwner: false, organizationId: null })

export function CommercialAccessProvider({ value, children }: { value: CommercialAccess; children: ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useCommercialAccess(): CommercialAccess {
  return useContext(AccessContext)
}
