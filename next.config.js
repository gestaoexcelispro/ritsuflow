/** @type {import('next').NextConfig} */
const nextConfig = {

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
