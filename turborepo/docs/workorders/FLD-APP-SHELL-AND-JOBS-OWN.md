# Work Order: FLD-APP-SHELL, FLD-JOBS-OWN, FLD-CONSENT-ENFORCE, FLD-MOBILE-TEST-HARNESS

**Status: ZAAKCEPTOWANY (Etap 1: Fundament aplikacji terenowej i zlecenia własne)**  
**Właściciel:** B3 `feat/field-app-foundation`  
**Wymagania:** `FLD-APP-SHELL`, `FLD-JOBS-OWN`, `FLD-CONSENT-ENFORCE`, `FLD-MOBILE-TEST-HARNESS` (oraz powiązane `CRM-KLI-AC2`)  
**Data:** 2026-09-26  

---

## 1. Cel biznesowy i architektoniczny

Dostarczenie fundamentu aplikacji terenowej (`apps/field-app`) dla ról pracowniczych `audytor` oraz `monter` w architekturze React Native + Expo, zgodnie z decyzjami D1, D2 (ADR-013), D11 i D12:
1. **Aplikacja Expo (`apps/field-app`)**:
   - Działa na telefonach obu ról (D12 — jeden układ ekranu, brak gałęzi tabletowej i rysika).
   - Współdzieli tożsamość z panelem B2B przez Supabase Auth (`authorized_users`), bez własnej tabeli użytkowników ani sesji.
   - Konfiguracja Metro poprawnie rozwiązuje pakiety monorepo (`@klikklima/contracts`), bez duplikowania stałych, progów ani słowników.
2. **Warstwa zapisu i odczytu Route Handlerów (`apps/b2b-web/src/app/api/field/`)**:
   - `GET /api/field/jobs/own`: Zwraca wyłącznie zlecenia przypisane zalogowanemu pracownikowi (`audytor` widzi swoje leady z audytem, `monter` widzi swoje instalacje).
   - `GET /api/field/jobs/own/[id]`: Bezpieczny odczyt szczegółów zlecenia fail-closed (dla cudzego zlecenia zwraca odmowę nieodróżnialną od braku rekordu, chroniąc przed enumeracją identyfikatorów).
   - Zawężenie kontaktów klienta (`CRM-KLI-AC2`): Pracownik terenowy widzi wyłącznie `{ imie_i_nazwisko, telefon, adres }`, bez e-maila, notatek, historii ani danych finansowych.
   - `GET /api/field/consents`: Sprawdzenie statusu akceptacji obowiązujących wersji dokumentów prawnych (`legal_document_versions.is_current`).
   - `POST /api/field/consents/accept`: Zapis akceptacji regulaminu/RODO w `employee_consents` (append-only) z kluczem idempotencji.
   - `POST /api/field/jobs/own/[id]/start`: Serwerowa bramka rozpoczęcia zlecenia — odrzuca rozpoczęcie prac, jeśli pracownik nie zaakceptował wszystkich aktualnych dokumentów prawnych (`FLD-CONSENT-ENFORCE`).
3. **Pętla testowa (`FLD-MOBILE-TEST-HARNESS`)**:
   - Wpięta w `vitest` i CI monorepo.
   - Testy statyczne architektury mobilnej (brak gałęzi tabletowej, brak zapisu do `authorized_users`, import kontraktów przez Metro).
   - Testy integracyjne i E2E symulujące przejście: logowanie -> lista zleceń -> szczegóły -> bramka zgód.

---

## 2. Kryteria akceptacji per wymaganie

### 2.1 FLD-APP-SHELL
- `apps/field-app` jest aplikacją Expo budowaną w bramce CI — nie szkicem katalogu.
- Konfiguracja Metro rozwiązuje pakiety monorepo (`@klikklima/contracts`) bez kopiowania plików.
- Logowanie korzysta z tego samego rejestru kont co panel (`authorized_users`) — brak zapisu do `authorized_users` z aplikacji.
- Brak ważnego tokenu nie renderuje listy zleceń: ekran chroniony jest fail-closed.
- Jeden układ ekranu, telefonowy (D12) — brak gałęzi układu tabletowego i brak ścieżki rysika.

### 2.2 FLD-JOBS-OWN (oraz CRM-KLI-AC2)
- Zapytanie o listę zleceń zwraca wyłącznie rekordy przypisane zalogowanemu pracownikowi; dla cudzego zlecenia zwraca pusty wynik.
- Próba otwarcia cudzego zlecenia po znanym ID kończy się odmową fail-closed (zakaz enumeracji identyfikatorów).
- Zawężenie wynika z wariantu `:own` w macierzy RBAC (`leads.read: audytor:own`, `installations.read: monter:own`).
- Rola bez prawa odczytu zasobu nie dostaje listy w ogóle (403 Forbidden).
- Odczyt danych klienta ogranicza się do imienia i nazwiska, telefonu i adresu.

### 2.3 FLD-CONSENT-ENFORCE
- Blokada działa po stronie serwera: rozpoczęcie zlecenia przez pracownika bez aktualnej akceptacji obowiązującej wersji dokumentu jest odrzucane z błędem domenowym.
- Sprawdzana jest akceptacja wersji oznaczonej jako `is_current = true`. Publikacja nowej wersji natychmiast blokuje start kolejnych zleceń do czasu ponownej akceptacji.
- Błąd sprawdzenia zgód kończy się odmową (fail-closed).
- Akceptacja wykonana w aplikacji tworzy wiersz w `employee_consents` (append-only).
- Blokada dotyczy rozpoczęcia zlecenia, a nie logowania.

### 2.4 FLD-MOBILE-TEST-HARNESS
- Testy aplikacji uruchamiają się w tym samym przebiegu CI co testy panelu (`vitest run`).
- Zakaz `it.skip` / `test.only` obowiązuje w testach mobilnych.
- Pokryty pełny flow logowanie -> lista zleceń -> otwarcie zlecenia.

---

## 3. Plan wdrożenia w cyklu RED -> GREEN -> VERIFY

1. **RED:** Utworzenie testów:
   - `apps/b2b-web/tests/field-api-jobs-own.test.ts`
   - `apps/b2b-web/tests/field-api-consent-enforce.test.ts`
   - `apps/b2b-web/tests/field-app-shell.test.ts`
2. **GREEN:**
   - Implementacja domenowa w `apps/b2b-web/src/lib/domain/jobs.ts` i `apps/b2b-web/src/lib/domain/consents.ts`.
   - Implementacja Route Handlerów w `apps/b2b-web/src/app/api/field/jobs/` i `apps/b2b-web/src/app/api/field/consents/`.
   - Implementacja aplikacji `apps/field-app/` (Expo, Metro, Auth, ekrany).
3. **VERIFY:**
   - `bash scripts/verify.sh --fast`
   - `node tools/kk-trace.mjs`
