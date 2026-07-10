import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicRoute = request.nextUrl.pathname === '/login' || request.nextUrl.pathname.startsWith('/auth') || request.nextUrl.pathname.startsWith('/api')

  // Fallback: If Supabase redirects to /?code=... instead of /auth/callback?code=...
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return NextResponse.redirect(url)
  }

  if (
    !user &&
    !isPublicRoute
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Check if user is in AuthorizedUser table
  if (user && !isPublicRoute) {
    const { data: authorizedUser } = await supabase
      .from('AuthorizedUser')
      .select('email')
      .eq('email', user.email)
      .single()

    if (!authorizedUser) {
      // User is logged in but not authorized.
      // We will clear the session and redirect them to login with a denied flag.
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('denied', 'true')
      url.searchParams.set('email', user.email || '')
      return NextResponse.redirect(url)
    }
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/kanban'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
