import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = request.nextUrl.searchParams.get('next') ?? '/kanban'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = next
      redirectUrl.searchParams.delete('code')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // return the user to an error page with instructions
  const errorUrl = request.nextUrl.clone()
  errorUrl.pathname = '/login'
  errorUrl.searchParams.set('error', 'true')
  return NextResponse.redirect(errorUrl)
}
