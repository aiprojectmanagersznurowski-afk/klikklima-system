/**
 * Jedyny docelowy format skróconego ID w panelu B2B — zastępuje dzisiejsze warianty
 * (`#abc12345`, `abc12345...`, `ID: abc12345`, `LOG-abc12345`, pełny UUID w tabelach).
 */
export function shortId(id: string): string {
  return `#${id.substring(0, 8)}`
}
