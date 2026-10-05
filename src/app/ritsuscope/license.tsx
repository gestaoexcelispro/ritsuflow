'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * RitsuScope feature licensing. Every company can open RitsuScope and use sheets, levels and
 * zoning (the Location Breakdown tools); takeoff, estimating, 3D, reports, share links and IFC
 * need the RitsuScope license. The database enforces the same split (row level security).
 */
const LicenseContext = createContext<boolean>(false)

export function RitsuScopeLicenseProvider({ licensed, children }: { licensed: boolean; children: ReactNode }) {
  return <LicenseContext.Provider value={licensed}>{children}</LicenseContext.Provider>
}

/** True when the signed-in user's company license includes RitsuScope (the platform owner always). */
export function useRitsuScopeLicensed(): boolean {
  return useContext(LicenseContext)
}
