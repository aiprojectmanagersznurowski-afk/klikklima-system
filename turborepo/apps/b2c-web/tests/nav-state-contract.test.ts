import { describe, it } from 'vitest';

/**
 * BLOCKER 1-2 (recenzja 2026-09-24): wersja poprzednia tego pliku szukała w treści
 * `HomePageClient.tsx` ciągów `selectedProduct` / `setSelectedProduct(null)` — obu
 * ISTNIEJĄCYCH na `main` PRZED jakąkolwiek implementacją B2C-NAV-STATE. Taki test jest
 * zielony niezależnie od tego, czy zachowanie (przywrócenie scrolla, przywrócenie
 * adresu przy zamknięciu modala) jest poprawne — mierzy istnienie zmiennej, nie
 * zachowania z kryteriów akceptacji.
 *
 * OGRANICZENIE INFRASTRUKTURY (do zaraportowania, nie do obejścia fałszywym testem):
 * B2C-NAV-STATE dotyczy WYŁĄCZNIE zachowań przeglądarki w czasie działania — pozycji
 * scrolla po nawigacji wstecz i stanu adresu URL po zamknięciu modala.
 * Sprawdzone przed napisaniem tego pliku:
 *   - `apps/b2c-web` NIE ma `vitest.config.mts` własnego; korzysta z korzeniowego
 *     `vitest.config.mts`, które nie ustawia `test.environment` na środowisko z DOM
 *     (domyślne środowisko Vitest to `node` — bez `window`, `document`, `scrollY`,
 *     `history`).
 *   - `apps/b2c-web/package.json` (`dependencies` + `devDependencies`) NIE ma paczki
 *     do renderowania komponentów w teście ani paczki emulującej DOM — nie da się
 *     renderować `HomePageClient` i wywołać na nim rzeczywistej interakcji w tym
 *     pakiecie testowym.
 * Nie istnieje też wydzielona, czysta funkcja (np. `restoreScrollPosition(prevY)`)
 * możliwa do zaimportowania i przetestowania bez renderowania DOM — cała logika jest
 * wpleciona w JSX/hooki komponentu klienckiego.
 *
 * Statyczny test na treści pliku (grep po `pushState`/`useSearchParams` itp.) NIE
 * odróżniłby poprawnej implementacji od błędnej — dokładnie ten defekt, który ta
 * naprawa usuwa. Świadoma decyzja: NIE pisać kolejnej wersji takiego testu.
 *
 * Jedyne realne pokrycie obu kryteriów akceptacji B2C-NAV-STATE w tym repozytorium to
 * `apps/b2c-web/e2e/navigation.spec.ts` (Playwright, prawdziwy DOM/przeglądarka):
 *   - `should restore scroll position when going back from Catalog` (kryt. 1)
 *   - `should restore scroll position when going back from Knowledge Base` (kryt. 1)
 *   - `zamknięcie modala urządzenia przywraca adres sprzed otwarcia i nie przewija
 *     strony na górę` (kryt. 2)
 *
 * Poniższy wpis jest jawnym, udokumentowanym ograniczeniem tej warstwy testów — NIE
 * jest testem wyłączonym/pominiętym (ten wariant metody `it` oznacza „do zrobienia /
 * niewykonywalne tutaj", nie „wyłączone", i nie ukrywa istniejącego pokrycia: dowód
 * pozostaje w pliku E2E wymienionym powyżej).
 */
describe('B2C-NAV-STATE — pokrycie wyłącznie przez E2E (Playwright), patrz apps/b2c-web/e2e/navigation.spec.ts', () => {
  // @REQ: B2C-NAV-STATE
  it.todo(
    'brak infrastruktury do renderowania komponentów z DOM w tym pakiecie testowym — nie da się zweryfikować scrolla/adresu URL na poziomie jednostkowym; dowód w e2e/navigation.spec.ts',
  );
});
