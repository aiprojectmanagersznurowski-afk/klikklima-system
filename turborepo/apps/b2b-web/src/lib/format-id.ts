/**
 * Jedyny docelowy format skróconego ID w panelu B2B — fallback dla rekordów bez numeru biznesowego.
 */
export function shortId(id: string): string {
  return `#${id.substring(0, 8)}`
}

/**
 * Zwraca czytelny identyfikator biznesowy (np. K-000123, L-000123, I-000123, U-000123),
 * a w przypadku jego braku — skrócony UUID.
 */
export function formatDisplayId(businessNumber?: string | null, fallbackUuid?: string | null): string {
  if (businessNumber) return businessNumber
  if (fallbackUuid) return shortId(fallbackUuid)
  return '-'
}

