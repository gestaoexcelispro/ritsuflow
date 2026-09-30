import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

function safeNextPath(value) {
  if (!value || typeof value !== 'string') return '/workspaces'
  if (!value.startsWith('/') || value.startsWith('//')) return '/workspaces'
  return value
}

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const nextPath = safeNextPath(requestUrl.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=oauth_callback', requestUrl.origin)
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=oauth_callback', requestUrl.origin)
    )
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin))
}
