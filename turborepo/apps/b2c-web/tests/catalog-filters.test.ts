import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * BLOCKER 5 (recenzja 2026-09-24): test poniżej ('filtry marki i koloru...') definiował
 * WŁASNĄ kopię logiki filtrowania (`matchBrand && matchColor` na lokalnej tablicy
 * `mockProducts`) i asertował wynik swojej pętli — nigdy nie importował ani nie
 * wywoływał kodu z `katalog/page.tsx`. Taki test przechodzi niezależnie od tego, czy
 * implementacja filtrowania w aplikacji jest poprawna, błędna, czy usunięta — testuje
 * sam siebie.
 *
 * DWIE PRZYCZYNY, DLA KTÓRYCH NIE NAPRAWIONO TEGO WPROST importem prawdziwej funkcji:
 *   1. `katalog/page.tsx` NIE eksportuje czystej funkcji filtrującej — logika żyje
 *      wyłącznie jako `useMemo(...)` wewnątrz komponentu `CatalogPage` (zweryfikowane
 *      2026-09-24: brak `export function filterProducts` / podobnego w tym pliku).
 *      Wydzielenie takiej funkcji jest zmianą kodu produkcyjnego — poza zakresem roli
 *      `test-author` (CLAUDE.md: „Edycja kodu produkcyjnego przez test-author" jest
 *      zakazana hookiem). To jest zgłoszenie do `implementer-server`/`implementer-ui`,
 *      nie coś do naprawienia w tej turze.
 *   2. Bez wydzielonej funkcji jedyna alternatywa to renderowanie `CatalogPage` i
 *      symulacja kliknięć filtrów — a `apps/b2c-web` nie ma w tym pakiecie testowym
 *      żadnej paczki do renderowania komponentów w teście ani emulacji DOM (sprawdzone:
 *      `package.json` nie deklaruje takiej zależności), a korzeniowy `vitest.config.mts`
 *      nie ustawia środowiska z DOM. Nie da się więc napisać testu integracyjnego na
 *      poziomie jednostkowym bez zmiany infrastruktury.
 *
 * Test złożenia filtrów (marka AND kolor) jest więc DZIŚ NIEPOKRYTY na tym poziomie —
 * jawnie udokumentowane ograniczenie, zgodnie z zasadą „nie fabrykuj słabszego testu,
 * żeby było coś". Trzy pozostałe testy w tym pliku (struktura sekcji, komunikat pustego
 * wyniku, otwieranie modala z karty) są utrzymane, bo sprawdzają REALNĄ treść
 * `katalog/page.tsx` przez `readFileSync` — nie kopiują logiki aplikacji, więc
 * odróżniają usunięcie/zmianę tej treści od jej obecności.
 */

describe('B2C-CATALOG-LIST — struktura katalogu i filtrowanie', () => {
  const catalogPagePath = join(process.cwd(), 'apps/b2c-web/app/katalog/page.tsx');

  // @REQ: B2C-CATALOG-LIST
  it('katalog jest jedną sekcją: dawne sekcje Multi Split i Agregaty nie istnieją', () => {
    expect(existsSync(catalogPagePath)).toBe(true);
    const content = readFileSync(catalogPagePath, 'utf8');

    // Jedna sekcja dla urządzeń
    expect(content).toContain('Klimatyzatory Ścienne');

    // Zakaz dawnych sekcji jako osobnych nagłówków sekcji
    expect(content).not.toMatch(/<h2[^>]*>.*Agregaty.*<\/h2>/i);
    expect(content).not.toMatch(/<h2[^>]*>.*Multi\s+Split.*<\/h2>/i);
  });

  // @REQ: B2C-CATALOG-LIST
  it.todo(
    'filtry marki i koloru dają się złożyć w koniunkcji — brak funkcji filtrującej wydzielonej z katalog/page.tsx i brak infrastruktury do renderowania komponentu w tym pakiecie testowym (zgłoszenie do implementer-server/implementer-ui, patrz komentarz na górze pliku); dawna wersja tego testu kopiowała logikę filtrowania do siebie i testowała samą siebie (BLOCKER 5, usunięte)',
  );

  // @REQ: B2C-CATALOG-LIST
  it('pusty wynik filtrowania prezentuje komunikat o braku wyników, a nie pustą siatkę', () => {
    const content = readFileSync(catalogPagePath, 'utf8');

    // Weryfikacja obecności komunikatu pustego stanu i przycisku resetu filtrów
    expect(content).toMatch(/Brak wyników/i);
    expect(content).toMatch(/Nie znaleźliśmy urządzeń spełniających Twoje kryteria/i);
    expect(content).toMatch(/Wyczyść filtry/i);
  });

  // @REQ: B2C-CATALOG-LIST
  it('karta produktu otwiera modal urządzenia (DeviceModal)', () => {
    const content = readFileSync(catalogPagePath, 'utf8');

    expect(content).toContain('DeviceModal');
    expect(content).toContain('onOpenModal={setSelectedProduct}');
  });
});
