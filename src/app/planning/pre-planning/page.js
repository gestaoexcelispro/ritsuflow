import {
  cloneElement,
  isValidElement,
} from 'react'

import DashboardPrePlanningPage from '../../dashboard/planning/pre-planning/page'


export default async function StandalonePrePlanningPage({
  searchParams,
}) {
  const content =
    await DashboardPrePlanningPage({
      searchParams,
    })

  if (
    !isValidElement(
      content
    )
  ) {
    return content
  }

  return cloneElement(
    content,
    {
      standalone: true,
      changeProjectHref:
        '/planning/pre-planning',
    }
  )
}
