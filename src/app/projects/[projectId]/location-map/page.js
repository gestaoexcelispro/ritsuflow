import { redirect } from 'next/navigation'

// The Location Map moved into RitsuScope (Zoning): locations are drawn on RitsuScope sheets, and the
// old maps are brought over with "Bring into RitsuScope". The A4 card framing stays at ./card-view.
export default async function LocationMapPage({ params }) {
  const { projectId } = await params
  redirect(`/ritsuscope/${projectId}`)
}
