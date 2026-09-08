import PrePlanningPage from '../../dashboard/planning/pre-planning/page'


export default async function StandalonePrePlanningPage({
  searchParams,
}) {
  return PrePlanningPage({
    searchParams,
    standalone: true,
    changeProjectHref:
      '/planning/pre-planning',
  })
}
