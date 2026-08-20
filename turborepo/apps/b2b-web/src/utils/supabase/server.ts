import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from '@repo/database'
import { ROLES, type Role } from '@klikklima/contracts'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * R2 (WO CRM-SAFE-RECORD-ACTIONS): jedyne dziś źródło roli dostępne dla Server Actions,
 * które muszą sprawdzić uprawnienia (PERMISSIONS.*.delete = ['admin']). `middleware.ts`
 * dziś sprawdza wyłącznie obecność e-maila w `AuthorizedUser` — nie czyta roli. Ten
 * odczyt jest jawny (Prisma omija RLS), więc każda akcja destrukcyjna musi wywołać
 * `can(actorRole, resource, capability)` z `@klikklima/contracts`, nie ufać samej
 * obecności roli. Zwraca `null`, gdy nie ma sesji albo e-mail nie jest w `AuthorizedUser`
 * (a wtedy `can()` i tak odrzuci — brak roli traktujemy fail-closed).
 */
export async function getCurrentActorRole(): Promise<Role | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const authorizedUser = await prisma.authorizedUser.findUnique({
    where: { email: user.email },
    select: { role: true },
  })

  if (!authorizedUser) return null

  return (ROLES as readonly string[]).includes(authorizedUser.role)
    ? (authorizedUser.role as Role)
    : null
}
