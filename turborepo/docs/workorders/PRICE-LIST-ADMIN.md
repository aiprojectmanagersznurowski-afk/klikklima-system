# WO: PRICE-LIST-ADMIN — ekran cennika wyceny w ustawieniach panelu B2B (WO-P2)

**Status: gotowy do przekazania test-authorowi po scaleniu WO-P1** (używa funkcji publikacji wersji
ceny z P1). Indeks strumienia: `PRICE-LIST-VAT.md`.

## Wymagania

- `PRICE-LIST-ADMIN` (MEDIUM, `TODO`, domena `crm`).
- Zależy od: `PRICE-LIST-SCHEMA` i funkcji publikacji wersji (WO-P1, AC-S5).
- Nie zamyka: `STD-INSTALL-CONFIG` (drugi ekran ustawień, osobny WO poza tym zleceniem).

## Kontekst kodu

### Istnieje

- Sekcja ustawień w nawigacji: `apps/b2b-web/src/app/(dashboard)/layout.tsx:92-100` — pozycje
  `/settings/exit-intent`, `/settings` (użytkownicy), `/settings/calendar` („Kalendarz i wizyty"),
  `/settings/notifications`. Tabela własności planu: pozycje menu dodaje **wyłącznie B2 i B3** —
  ta gałąź ma prawo dopisać pozycję.
- Wzorzec ekranu ustawień: `apps/b2b-web/src/app/(dashboard)/settings/calendar/` (`page.tsx` jako
  Server Component z bramką `can(..., 'read')`, komponent kliencki, `actions.ts` z Zod, `can()`,
  transakcją i `audit_log` w tej samej transakcji, brak wpisu przy braku zmiany).
- Wzorzec widoczności pozycji menu wg roli: `apps/b2b-web/src/lib/schedule/nav-visibility.ts`,
  `apps/b2b-web/src/lib/docs/nav-visibility.ts`.
- RBAC `price_list_items` (`contracts/rbac.contract.mjs:222`): `read: admin, dyspozytor, audytor`,
  `create: admin`, `update: admin`, `delete: []`. `monter` nie ma odczytu.
- `audit_log.resource` dopuszcza `'price_list_items'` — `supabase/migrations/20260925093000_audit_log_resource_check_field_app.sql`
  (na `supabase start` aplikowana; na żywej bazie NIE — patrz Ryzyka).
- Funkcja publikacji wersji ceny i Server Action importu — z WO-P1.

### Brakuje

- `apps/b2b-web/src/app/(dashboard)/settings/pricing/` — nie istnieje.
- Pozycji menu „Cennik wyceny".

## Zmiana kontraktu

**NIEWYMAGANA.**

## Kryteria akceptacji (wykonalne)

Tag: `// @REQ: PRICE-LIST-ADMIN`.

- [ ] **AC1** `/settings/pricing` jest osiągalny z sekcji ustawień w nawigacji panelu (pozycja obok
  „Kalendarz i wizyty"), widoczną dla `admin`, `dyspozytor`, `audytor`; dla `monter` pozycja jest
  ukryta, a bezpośrednie wejście na adres nie pokazuje danych cennika (odmowa na poziomie Server
  Componentu, nie tylko ukrycie linku).
- [ ] **AC2** Ekran pokazuje każdą pozycję z bieżącą ceną sprzedaży netto, kosztem ekipy (albo jawnym
  „brak danych" dla `NULL` — nigdy `0,00`), jednostką, kategorią, zasięgiem i stanem aktywności.
  Pozycje nieaktywne są odróżnione wizualnie i nie znikają z listy.
- [ ] **AC3** Zmiana ceny przez administratora tworzy nową wersję; poprzednia wersja pozostaje
  w bazie z niezmienionymi kwotami (sprawdzane odczytem obu wierszy po operacji). Żadna Server Action
  tego ekranu nie przyjmuje identyfikatora wersji ceny ani nie wykonuje `update` kolumn
  `sale_price_net`/`crew_cost_net` — test statyczny przeszukuje `settings/pricing/**` i
  `lib/pricing/**` i zgłasza każde `priceListItemVersion.update`/`updateMany`, które dotyka tych
  kolumn (dozwolone wyłącznie przełączenie `isCurrent`). Test statyczny ma próbę żywotności:
  podrzucony plik z takim zapisem jest wykrywany.
- [ ] **AC4** Każda mutacja (dodanie pozycji, zmiana ceny, zmiana opisu/kategorii, wycofanie,
  przywrócenie) dla ról `dyspozytor`, `audytor`, `monter` i dla braku sesji kończy się odmową
  **przed** zapytaniem zapisującym — test sprawdza zero wywołań zapisu, nie tylko komunikat.
  Dotyczy również wywołania Server Action z pominięciem interfejsu.
- [ ] **AC5** Zmiana ceny zostawia w **tej samej transakcji** wpis `audit_log`: `operation='field_update'`,
  `resource='price_list_items'`, `record_id` = id pozycji, `actor_email`/`actor_role` z sesji,
  uzasadnienie zawierające wartość przed i po dla ceny sprzedaży i kosztu ekipy (np.
  `cena sprzedaży netto: 130.00 → 140.00; koszt ekipy netto: (brak) → 20.00`). Zapis tej samej ceny
  drugi raz nie tworzy ani nowej wersji, ani wpisu. Błąd zapisu wpisu audytowego wycofuje nową wersję.
- [ ] **AC6** Dodanie pozycji przez administratora: nazwa unikalna (duplikat nazwy daje błąd domenowy
  po polsku, nie surowy `P2002`), jednostka z `mb`/`szt`/`m`, zasięg `ROOM`/`INSTALLATION` obowiązkowy,
  kategoria opcjonalna z trzech wartości, cena sprzedaży obowiązkowa ≥ 0, koszt ekipy opcjonalny ≥ 0
  (puste pole zapisuje `NULL`, nie `0`). Pozycja powstaje z pierwszą wersją `is_current`.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Przemycone pola:** żądanie zmiany ceny z dodatkowymi polami (`scope`, `name`, `isCurrent`,
  `validFrom`, `id` innej pozycji) — ignorowane; lista zapisywanych pól jest zamknięta schematem Zod.
- **Kwota jako tekst z przecinkiem** (`"140,50"`) z formularza — albo przyjęta jako `140.50`, albo
  odrzucona komunikatem; nigdy zapisana jako `14050` ani `140`.
- **Współbieżna zmiana ceny** z dwóch sesji administratora — zachowanie jak w WO-P1 (jedna wersja
  bieżąca, błąd domenowy dla przegranej, brak pozycji bez wersji bieżącej).
- **Wycofanie pozycji nie usuwa jej z ofert** — pozycja wycofana nadal ma swoje wersje; `DELETE`
  nie istnieje w interfejsie ani w akcjach.
- **Formularz** — `react-hook-form` + `zodResolver` (ADR-001), schemat Zod współdzielony z Server
  Action (wzorzec `lib/schedule/scheduling-config-schema.ts`).

## Poza zakresem

- Zmiana nazwy i zasięgu istniejącej pozycji (wpływa na oferty w toku — osobna decyzja).
- Konfiguracja montażu standardowego (`/settings/standard-installation`, `STD-INSTALL-CONFIG`).
- Ceny z przyszłą datą obowiązywania.
- Podgląd historii wersji ceny w interfejsie (dane są w bazie; ekran historii to nice-to-have).
- Przycisk wgrania pliku CSV — **wchodzi tutaj tylko, jeżeli D-P1 = (A)** i wtedy wyłącznie jako
  formularz wołający Server Action z WO-P1 (bez nowej logiki).

## Ryzyka i nieznane

- **`audit_log_resource_check` na żywej bazie nie zna `price_list_items`**, dopóki migracja
  `20260925093000_…` nie zostanie uruchomiona PO migracji tworzącej `audit_log`. Wtedy pierwsza
  zmiana ceny wywróci całą transakcję (AC5 wymaga jednej transakcji). Kolejność wdrożenia migracji
  musi być sprawdzona w `pg_catalog`, nie w katalogu `supabase/migrations/`.
- Niezmienność wersji ceny jest egzekwowana wyłącznie przez aplikację (AC3). Kod spoza
  `settings/pricing/**` i `lib/pricing/**` nie jest skanowany.
- Czy audytor w ogóle loguje się do panelu B2B, żeby zobaczyć cennik? RBAC mu to daje; w praktyce
  audytor korzysta z Field App (B3). Kryterium AC1 trzyma się RBAC.

## Kolejność ról

`test-author` → `implementer-server` (`settings/pricing/actions.ts`, schemat Zod w `lib/pricing/`) →
`implementer-ui` (`settings/pricing/page.tsx`, komponent kliencki, pozycja menu w `layout.tsx`) →
`/kk-verify`.
