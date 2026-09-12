import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function updateSession(request) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          response = NextResponse.next({ request })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.getClaims()

  const pathname = request.nextUrl.pathname

  const isProtectedAppRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/daily-report')

  if ((error || !data?.claims) && isProtectedAppRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'

    return NextResponse.redirect(loginUrl)
  }

  return response
}
