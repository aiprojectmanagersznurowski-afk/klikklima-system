import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Klient serwisowy Supabase. Wyłącznie do użytku w modułach `server-only`
 * (np. `lib/storage/signed-urls.ts`) — nigdy w komponentach klienckich.
 *
 * Bez cichego fallbacku na klucz anonimowy (WO SERVICE-ROLE-LEADS-PAGE):
 * brak `SUPABASE_SERVICE_ROLE_KEY` w środowisku to błąd konfiguracji, nie
 * powód do degradacji uprawnień. Zły wzorzec do NIE naśladowania:
 * `apps/b2c-web/lib/supabaseClient.ts` (`SERVICE_ROLE || ANON || 'placeholder_key'`).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('createAdminClient: brak NEXT_PUBLIC_SUPABASE_URL w środowisku')
  }

  if (!serviceRoleKey) {
    throw new Error('createAdminClient: brak SUPABASE_SERVICE_ROLE_KEY w środowisku')
  }

  return createClient(url, serviceRoleKey)
}
