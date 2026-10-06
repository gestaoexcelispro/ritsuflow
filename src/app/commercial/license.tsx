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
  /** May change the price book, labor rates, templates and clauses (role or Commercial editor switch). */
  canEditLibrary: boolean
  /** May create bids (projects.create permission or Commercial editor switch). */
  canCreateBids: boolean
}

/** Fired by the header's "New bid" button; the bids page opens its dialog. */
export const NEW_BID_EVENT = 'commercial:new-bid'

const AccessContext = createContext<CommercialAccess>({ licensed: false, isPlatformOwner: false, organizationId: null, canEditLibrary: false, canCreateBids: false })

export function CommercialAccessProvider({ value, children }: { value: CommercialAccess; children: ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useCommercialAccess(): CommercialAccess {
  return useContext(AccessContext)
}
