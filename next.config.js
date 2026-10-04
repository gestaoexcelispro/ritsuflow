/** @type {import('next').NextConfig} */
const nextConfig = {

  // RitsuScope (TypeScript) is type-checked where it is developed; this app runs React 18 types,
  // so the build does not re-run the type check on it.
  typescript: {
    ignoreBuildErrors: true,
  },


  experimental: {

    outputFileTracingIncludes: {

      '/api/projects/*/setup-report': [
        './node_modules/pdfkit/**/*',
      ],

    },

  },


  async redirects() {

    return [

      {
        source:
          '/dashboard/projetos/lista',

        destination:
          '/dashboard/projects',

        permanent:
          false,
      },


      {
        source:
          '/dashboard/projetos/coleta',

        destination:
          '/dashboard/projects/setup?mode=new',

        permanent:
          false,
      },

    ]

  },

}


module.exports =
  nextConfig
