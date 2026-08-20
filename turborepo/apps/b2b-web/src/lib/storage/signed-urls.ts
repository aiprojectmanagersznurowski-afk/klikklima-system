import 'server-only'
import { createAdminClient } from '../../utils/supabase/admin'

/**
 * Generuje zbiorczo podpisane URL-e dla ścieżek w danym buckecie storage.
 * Jedno wywołanie `createSignedUrls` niezależnie od liczby ścieżek (brak N+1).
 *
 * - `paths: []` → `{}` bez żadnego zapytania sieciowego.
 * - Duplikaty w `paths` są bezpieczne — deduplikowane przed wywołaniem, mapa
 *   wynikowa i tak zawiera wpis dla każdej unikalnej ścieżki.
 * - Częściowa/całkowita awaria storage (wpisy z `error`, `data === null`)
 *   nie rzuca — pomijane wpisy po prostu nie trafiają do mapy wynikowej.
 */
export async function signStoragePaths(
  bucket: string,
  paths: string[],
  expiresInSeconds: number,
): Promise<Record<string, string>> {
  if (paths.length === 0) {
    return {}
  }

  const uniquePaths = Array.from(new Set(paths))

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(uniquePaths, expiresInSeconds)

  if (!data && error) {
    console.error(
      `[signStoragePaths] Nie udalo sie wygenerowac podpisanych URL-i dla bucketu "${bucket}":`,
      error,
    )
  }

  const result: Record<string, string> = {}

  if (data) {
    for (const item of data) {
      if (!item.error && item.signedUrl && item.path) {
        result[item.path] = item.signedUrl
      }
    }
  }

  return result
}
