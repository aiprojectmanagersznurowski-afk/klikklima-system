---
name: review-mutation-testing-checklist
description: Jak weryfikować uczciwość testów w tym repo — mutować kod produkcyjny tymczasowo i przywracać; testy statyczne na treści pliku źródłowego są typowym false-green
metadata:
  type: project
---

Ocena testów w tym repo opiera się na tymczasowej mutacji kodu produkcyjnego (`cp` do kopii,
mutacja, `npx vitest run <plik>`, przywrócenie). Bez tego nie da się odróżnić testu, który sprawdza
zachowanie, od testu, który sprawdza, że funkcja nie rzuca.

**Why:** Powtarzalny wzorzec w tym repo: gdy alias `@/*` nie jest skonfigurowany w root
`vitest.config.mts` (są tam tylko `@klikklima/contracts` i `server-only`), test-author zastępuje test
renderu **testem statycznym na treści pliku `.tsx`** — np. „czy w 600 znakach poprzedzających etykietę
przycisku występuje regex warunku". Taki test przechodzi także dla implementacji, w której przycisk jest
renderowany bezwarunkowo (zweryfikowane mutacją w recenzji SRV-SOURCE-OF-TRUTH-SERVICES-VIEW, AC9).
Testy jednostkowe na czystych funkcjach (`daysUntilService`, bramki `can()`, dedup) są w tym repo
zwykle mocne — mutacje je wywracają.

**How to apply:** Priorytetowo mutuj: (1) warunki dedup/filtrowania, (2) walidację Zod, (3) bramkę
`can()` na `if (false)`, (4) normalizację dat na naiwne odejmowanie ms. Testy „statyczne" na
`readFileSync` komponentu traktuj z założenia jako niewystarczające dowody kryteriów UI i żądaj albo
testu renderu (alias `@/` da się dodać do `vitest.config.mts`), albo wydzielenia logiki do czystej
funkcji zwracającej deskryptory pozycji menu. Testy TZ uruchamiaj pod kilkoma `TZ=` (UTC,
America/New_York, Asia/Tokyo, Pacific/Kiritimati).

**Wariant hybrydowy (zaakceptowany w rundzie 2 SRV-SOURCE-OF-TRUTH-SERVICES-VIEW):** czysta funkcja
widoczności w osobnym module (`menu-visibility.ts`) + test jednostkowy na niej + test statyczny
sprawdzający, że komponent ją *woła* w warunku renderowania. Mutacje „funkcja zwraca zawsze `true`"
i „warunek usunięty z komponentu" są łapane; pozostaje luka na `isDeleteMenuItemVisible(x) || true`
(regex nadal pasuje). Uznaję to za MINOR, nie BLOCKER — do zamknięcia dopiero testem renderu.

Powiązane: [[gate-blindspot-next-build]]
