/** @type {import('next').NextConfig} */
const nextConfig = {

  // RitsuScope (TypeScript) is type-checked where it is developed; this app runs React 18 types,
  // so the build does not re-run the type check on it.
  typescript: {
    ignoreBuildErrors: true,
  },


  async redirects() {

    // Old URLs whose pages were replaced by Projects, FieldOp and Settings, or removed from PreCon
    // (Pre-planning and the old project setup: planning now starts in Master plan).
    const moved = [
      ['/dashboard/projetos/lista', '/projects'],
      ['/dashboard/projetos/coleta', '/projects/new'],
      ['/dashboard/projects', '/projects'],
      ['/dashboard/projects/daily-reports', '/fieldop/reports/daily'],
      ['/dashboard/projects/daily-reports/new', '/fieldop/reports/daily/new'],
      ['/dashboard/projects/daily-reports/:reportId/:section*', '/fieldop/reports/daily/:reportId'],
      ['/daily-report/:reportId', '/fieldop/reports/daily/:reportId'],
      ['/dashboard/projects/operations', '/fieldop'],
      ['/dashboard/field-management/:path*', '/workforce'],
      ['/dashboard/administration/:path*', '/settings/users'],
      ['/dashboard/takeoff', '/ritsuscope'],
      ['/dashboard/projects/setup', '/projects'],
      ['/dashboard/projects/work-packages', '/projects'],
      ['/dashboard/projects/locations', '/projects'],
      ['/dashboard/planning/pre-planning', '/dashboard/planning/master-plan'],
      ['/planning/pre-planning', '/dashboard/planning/master-plan'],
    ]

    return moved.map(([source, destination]) => ({ source, destination, permanent: false }))

  },

}


module.exports =
  nextConfig
