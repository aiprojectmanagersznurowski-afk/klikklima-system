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
      .select('email, role')
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

    // BLOCKER 4 / AC1.5 (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1): zablokowane konto
    // audytora (audytorzy.is_active = false) nie przechodzi bramki, mimo poprawnych
    // danych logowania i obecności w AuthorizedUser. Field App poza zakresem repo (R1)
    // — bramka jest ta sama, co dziś sprawdza samą obecność w AuthorizedUser.
    //
    // NAPRAWA (zgłoszenie użytkownika, 2026-08-20): sprawdzenie musi dotyczyć
    // WYŁĄCZNIE kont z rolą 'audytor' w AuthorizedUser. Bez tego warunku każdy
    // authorized_user (admin/dyspozytor/monter), którego e-mail przypadkiem pasuje
    // do JAKIEGOKOLWIEK wiersza w audytorzy z is_active=false (stary/testowy rekord,
    // niezwiązany z jego faktyczną rolą), dostawał fałszywą blokadę logowania —
    // dokładnie to się stało administratorowi, mimo poprawnego wpisu w AuthorizedUser.
    if (authorizedUser.role === 'audytor') {
      const { data: blockedAuditor, error: blockedAuditorError } = await supabase
        .from('audytorzy')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', false)
        .maybeSingle()

      // BLOCKER (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #2): fail-closed. Jeśli zapytanie
      // padnie, nie wiemy, czy konto jest zablokowane — traktujemy to jak potwierdzoną
      // blokadę, spójnie z getCurrentActorRole() (który też jest fail-closed na `null`).
      if (blockedAuditorError || blockedAuditor) {
        await supabase.auth.signOut()
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('denied', 'true')
        url.searchParams.set('blocked', 'true')
        url.searchParams.set('email', user.email || '')
        return NextResponse.redirect(url)
      }
    }
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/leads'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
