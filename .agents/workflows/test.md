# Workflow: /test — Generowanie i Uruchamianie Testów (Playwright)

## Wyzwalacz
Użytkownik wywołuje: `/test [ścieżka do komponentu/strony lub opis]`

## Kontekst
Testy w projekcie KlikKlima opierają się na **Playwright** (E2E + regresja).
Centralny rejestr scenariuszy testowych znajduje się w: `turborepo/docs/testing/test_scenarios.md`.

## Kroki

### 1. Przeczytaj scenariusze
- Przeczytaj `turborepo/docs/testing/test_scenarios.md` — centralny rejestr wszystkich scenariuszy testowych BDD.
- Zidentyfikuj, które scenariusze dotyczą wskazanego komponentu/strony.

### 2. Generuj lub aktualizuj testy Playwright
- Na podstawie scenariuszy BDD z `test_scenarios.md`, wygeneruj plik testowy `*.spec.ts` w katalogu `turborepo/tests/` (lub `turborepo/apps/<app>/tests/`).
- Każdy scenariusz BDD powinien mieć odpowiadający mu blok `test()` w Playwright:
  ```typescript
  test('Scenariusz: Ścieżka A (Single Split)', async ({ page }) => {
    // Given ...
    // When ...
    // Then ...
  });
  ```

### 3. Uruchom testy
- Uruchom: `npx playwright test` w katalogu z testami.
- Zbierz wyniki (passed, failed, skipped).

### 4. Testy regresji
- **ZAWSZE** po wygenerowaniu nowych testów uruchom PEŁNY zestaw testów regresji:
  `npx playwright test --reporter=list`
- Upewnij się, że nowe testy nie łamią istniejących scenariuszy.

### 5. Aktualizacja rejestru scenariuszy
- Jeśli wygenerowałeś nowy scenariusz testowy, dodaj go do `turborepo/docs/testing/test_scenarios.md`.
- Format BDD: Given / When / Then z jasnym opisem oczekiwanego rezultatu.

### 6. Raport
- Zaktualizuj `walkthrough.md` o wyniki testów:
  - Ile testów przeszło / nie przeszło.
  - Opis ewentualnych failów i propozycja naprawy.
