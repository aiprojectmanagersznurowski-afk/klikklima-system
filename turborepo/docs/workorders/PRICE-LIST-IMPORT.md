# WO: PRICE-LIST-IMPORT — cennik w bazie i import 39 pozycji z arkusza (WO-P1)

**Status: gotowy do przekazania test-authorowi.** Punkt wejścia importu zależy od decyzji
**D-P1** (niżej) — dotyczy wyłącznie AC-I6. Pozostałe kryteria testują funkcję domenową,
niezależną od punktu wejścia. Indeks strumienia: `PRICE-LIST-VAT.md`.

## Wymagania

- `PRICE-LIST-SCHEMA` (MEDIUM, `TODO` w rejestrze — schemat i migracja istnieją od etapu 0, ale
  żadne kryterium nie ma testu; `kk-trace` nie pokaże go jako pokrytego, dopóki ten WO nie dowiezie
  testów).
- `PRICE-LIST-IMPORT` (MEDIUM, `TODO`).
- Konsumenci wyniku (nie zamyka ich): `PRICE-LIST-ADMIN` (P2 używa tej samej funkcji publikacji
  wersji), `FLD-QUOTE-ROOMS`/`GENERAL-ITEMS` (P4 czyta pozycje wg zasięgu), `STD-INSTALL-CONFIG`
  (poza tym strumieniem).

## Kontekst kodu

### Istnieje

- `packages/database/prisma/schema.prisma:1239` `model PriceListItem` (`name @unique`, `description?`,
  `unit`, `category?`, `scope`, `isActive`) i `:1277` `model PriceListItemVersion` (`crewCostNet?`,
  `salePriceNet`, `validFrom`, `isCurrent`).
- `supabase/migrations/20260925090000_price_list_and_quotes.sql`:
  - `price_list_items_unit_check` — `unit IN ('mb','szt','m')`,
  - `price_list_items_category_check` — `category IS NULL OR IN ('MATERIAL','LABOR','MATERIAL_LABOR')`,
  - `price_list_items_scope_check` — `scope IN ('ROOM','INSTALLATION')`,
  - `price_list_item_versions_current_per_item_key` — częściowy UNIQUE `(price_list_item_id) WHERE is_current`,
  - `…_sale_price_nonneg_check`, `…_crew_cost_nonneg_check`,
  - `quote_items.price_list_item_id … ON DELETE RESTRICT` (pozycja użyta w ofercie nie da się skasować).
- `contracts/rbac.contract.mjs:222` — `price_list_items`: `read: admin, dyspozytor, audytor`,
  `create: admin`, `update: admin`, **`delete: []`** (nikt, łącznie z adminem).
- `docs/architecture/cennik-robocizny.csv` — 39 wierszy, kolumny `category,item_name,description,unit,crew_cost_net,sale_price_net,scope`.
  Sprawdzone 2026-09-25: 39 unikalnych nazw, 23 `ROOM` / 16 `INSTALLATION`, 13 pustych `crew_cost_net`,
  5 pustych `category` (i te same 5 bez `description`), jednostki `m`/`mb`/`szt`, kategorie
  `Materiał`/`Robocizna`/`Robocizno-materiał`. Separator dziesiętny: kropka. Pola z przecinkami
  w cudzysłowach (np. opis `instalacja freonowa 1/4 i 3/8`).
- Precedens transakcji z `audit_log`: `apps/b2b-web/src/app/(dashboard)/settings/calendar/actions.ts:125-146`
  (`operation: "field_update"`, `legalBasis: "OTHER"`, wpis w tej samej transakcji co zapis,
  brak wpisu przy braku zmiany).

### Brakuje

- Katalogu `apps/b2b-web/src/lib/pricing/` (własność B2) — nie istnieje.
- Jakiejkolwiek funkcji czytającej lub piszącej `price_list_items` — `grep` po `priceListItem`
  w `apps/` zwraca zero wyników.
- Parsera CSV — żadna paczka CSV nie jest w zależnościach (`package.json` korzenia i aplikacji,
  sprawdzone). **Nie dodawać paczki**: plan (§4 tabeli kolizji) zakazuje nowych zależności poza
  etapem 0. Arkusz jest mały i ma jeden znany kształt; parser ze wsparciem cudzysłowów mieści się
  w module importu.

## Zmiana kontraktu

**NIEWYMAGANA.** Schemat, ograniczenia i RBAC istnieją. Jeżeli D-P1 = (C) (migracja danych),
zmiana przechodzi do okna kontraktowego i roli `contract-steward` — wtedy ten WO wraca do planowania.

## WYMAGA DECYZJI

### D-P1 — punkt wejścia importu (blokuje wyłącznie AC-I6)

- **(A) Server Action w `/settings/pricing`** przyjmująca plik CSV od zalogowanego administratora.
  Aktor jest prawdziwy, `can(role, 'price_list_items', 'create')` stoi w `src/app` (widoczne dla
  `kk-authz-gate`), ślad w `audit_log` ma autora. Ten sam mechanizm posłuży później do masowej
  aktualizacji cen.
- **(B) Skrypt CLI** uruchamiany przez człowieka. Problem: ponowny import zmieniający cenę to zmiana
  ceny, a `SYSTEM_GRANTS` (`packages/contracts/src/generated/rbac.ts:129`) nie przyznaje aktorowi
  systemowemu niczego na `price_list_items` — wpis audytowy nie miałby legalnego autora.
- **(C) Migracja danych** w slocie `20260929090000_` (zarezerwowanym dla B2). Wymaga okna
  kontraktowego; dane w SQL i w CSV to dwa źródła prawdy.

**Rekomendacja: (A).** Przy (A) sam przycisk/formularz wgrania dokłada P2; ten WO dowozi Server
Action (bez UI) i funkcję domenową.

## Kryteria akceptacji (wykonalne)

Tag testów: `// @REQ: PRICE-LIST-SCHEMA` albo `// @REQ: PRICE-LIST-IMPORT`.

### PRICE-LIST-SCHEMA (testy charakteryzujące istniejący schemat — `*.itest.ts` na `supabase start`)

Te kryteria są już spełnione przez migrację etapu 0. Testy mogą być zielone od pierwszego
uruchomienia — to jest świadome: pinują zachowanie bazy, żeby zmiana migracji go nie zgubiła.
Test-author zaznacza to w nagłówku pliku; reviewer nie traktuje braku fazy RED jako błędu.

- [ ] **AC-S1** Wersja ceny z `crew_cost_net = NULL` i `sale_price_net = 100` zapisuje się, a odczyt
  zwraca `NULL`, nie `0`. Wersja z `crew_cost_net = 0` zwraca `0`. (Odróżnienie braku od zera.)
- [ ] **AC-S2** Wstawienie pozycji ze `scope = 'ROOM_X'` (albo `NULL`) jest odrzucone przez bazę.
- [ ] **AC-S3** Wstawienie pozycji z `category = 'Materiał'` (polska wartość) jest odrzucone przez
  bazę; `NULL` i trzy angielskie wartości są przyjmowane.
- [ ] **AC-S4** Druga wersja z `is_current = true` dla tej samej pozycji jest odrzucona przez bazę
  (naruszenie `price_list_item_versions_current_per_item_key`), niezależnie od kolejności zapisów.
- [ ] **AC-S5** Opublikowanie nowej ceny funkcją domenową (`publishPriceVersion` albo równoważna nazwa,
  wspólna dla importu i P2) zostawia poprzednią wersję w bazie z niezmienionymi kwotami
  i `is_current = false`, a nowa ma `is_current = true` i `valid_from` ≥ chwili wywołania.
- [ ] **AC-S6** Wycofanie pozycji ustawia `is_active = false` i nie usuwa wiersza ani jej wersji;
  `DELETE` pozycji użytej w `quote_items` jest odrzucany przez bazę (`ON DELETE RESTRICT`); `can(r,
  'price_list_items','delete')` zwraca `'no'` dla każdej z czterech ról.

### PRICE-LIST-IMPORT

- [ ] **AC-I1** Import pliku `docs/architecture/cennik-robocizny.csv` do pustej bazy daje **dokładnie
  39** pozycji, każdą z dokładnie jedną wersją `is_current = true`. Test czyta plik z repozytorium,
  nie jego kopię w fiksturze — liczba 35 z planu jest nieaktualna.
- [ ] **AC-I2** Mapowanie kategorii: `Materiał` → `MATERIAL`, `Robocizna` → `LABOR`,
  `Robocizno-materiał`, `Robocizno-Materiał`, `MR` i `RM` → `MATERIAL_LABOR`. Test podaje każdą
  z tych form w osobnym wierszu i oczekuje wskazanej wartości (wielkość liter i spacje brzegowe
  nie mają znaczenia).
- [ ] **AC-I3** Po imporcie arkusza: 13 pozycji ma `crew_cost_net IS NULL` (żadna nie ma `0`),
  5 pozycji ma `category IS NULL` i `description IS NULL`. Test sprawdza z nazwy co najmniej
  `podłączenie ściennej` (brak kosztu) i `jedn zew stoi na stojaku` (brak kategorii).
- [ ] **AC-I4** Po imporcie arkusza: 23 pozycje `ROOM`, 16 `INSTALLATION`. Wiersz fikstury bez
  wartości `scope` **nie tworzy pozycji** i jest zwrócony w raporcie importu jako pominięty
  z przyczyną; pozostałe wiersze tego samego pliku importują się.
- [ ] **AC-I5** Idempotencja: drugi import tego samego pliku nie tworzy żadnej pozycji ani wersji
  (liczby wierszy w obu tabelach bez zmian). Import pliku, w którym jedna pozycja ma inną
  `sale_price_net` (albo `crew_cost_net` zmienione z pustego na liczbę), tworzy **jedną** nową
  wersję tej pozycji, poprzednia zostaje nietknięta (AC-S5), pozostałe 38 pozycji bez nowych wersji.
- [ ] **AC-I6** *(zależy od D-P1; przy (A))* Server Action importu: rola `dyspozytor`, `audytor`,
  `monter` i brak sesji dostają odmowę **przed** jakimkolwiek zapisem (zero wierszy, test sprawdza
  liczność, nie tylko kod odpowiedzi). Admin: import działa, a każda **zmiana ceny istniejącej
  pozycji** (AC-I5) zostawia wpis `audit_log` `operation='field_update'`, `resource='price_list_items'`,
  `record_id` = id pozycji, uzasadnienie z wartością przed i po. Utworzenie pozycji w pustej bazie
  zostawia jeden wpis zbiorczy (nie 39) — liczba wpisów jest częścią testu.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Współbieżność publikacji ceny** (`*.itest.ts`): dwie równoległe publikacje nowej ceny tej samej
  pozycji → po zakończeniu dokładnie jedna wersja `is_current`, przegrana transakcja kończy się
  błędem domenowym (nie surowym `P2002`/`23505`), a pozycja **nigdy** nie zostaje bez wersji bieżącej.
  Kolejność w transakcji: najpierw zdjęcie `is_current` ze starej, potem wstawienie nowej.
- **Import atomowy względem pozycji:** błąd zapisu pozycji N (np. wstrzyknięty) nie zostawia pozycji
  z wersją, ale bez `is_current`, ani pozycji bez żadnej wersji.
- **Wiersz z nieznaną jednostką** (`kg`) albo nieznaną niepustą kategorią (`Usługa`) — pominięty
  i zgłoszony w raporcie, a nie przepuszczony do bazy (CHECK wywróciłby cały import).
- **Kwota nieparsowalna lub ujemna** (`12,50`, `-5`, `abc`) w `sale_price_net` — wiersz pominięty
  i zgłoszony. Pusta `sale_price_net` — wiersz pominięty (kolumna NOT NULL).
- **Pole z przecinkiem w cudzysłowie** — opis `"Rura miedziana w otulinie 1/4', …"` wczytany w całości.
- **Ponowny import nie nadpisuje metadanych** (`description`, `category`, `unit`, `scope`) pozycji
  już istniejącej — po wdrożeniu P2 źródłem tych pól jest administrator. Różnica metadanych trafia
  do raportu jako ostrzeżenie. Pozycja nieaktywna nie jest reaktywowana importem.
- **Kwoty nie przechodzą przez `number`** — `130.00` zapisuje się jako `130.00` w `NUMERIC(12,2)`,
  a nie jako wynik arytmetyki zmiennoprzecinkowej.

## Poza zakresem

- Ekran listy i edycji cennika — P2 (`PRICE-LIST-ADMIN.md`).
- Uzupełnienie 13 brakujących kosztów i 5 opisów (D16) — dane od Michała, wpisywane w P2.
- Zmiana nazwy pozycji i zmiana `scope` istniejącej pozycji.
- Polityki RLS dla `price_list_*` (dziś RLS włączone bez polityk = odmowa dla `anon`/`authenticated`,
  Prisma omija RLS). Potrzebne dopiero, gdy Triage zacznie czytać cennik przez `supabase-js`
  (`B2C-TRIAGE-PRICE-FROM-PRICE-LIST`).
- Ceny z przyszłą datą obowiązywania (`valid_from` w przyszłości).

## Ryzyka i nieznane

- **Podział 23/16 czeka na potwierdzenie** (`FIELD-APP-I-PODPISY-ZAKRES.md` D17, pole
  „[ ] Potwierdzam podział 23/16 … uwaga na `Lutowanie`"). Import bierze arkusz jak jest.
  Jeżeli Michał przeniesie `Lutowanie` do `INSTALLATION`, a zmiana `scope` jest poza zakresem P2,
  trzeba to zrobić **przed** pierwszym importem na produkcję.
- Idempotencja po nazwie: zmiana nazwy w arkuszu tworzy nową pozycję, stara zostaje. Zgodne
  z AC, ale warto, żeby raport importu wypisywał pozycje z bazy nieobecne w pliku.
- `PriceListItemVersion` nie ma w bazie blokady `UPDATE` kwot — niezmienność wersji pilnuje wyłącznie
  aplikacja (patrz P2). Wyzwalacz blokujący to kandydat do okna kontraktowego.

## Kolejność ról

`test-author` (itesty AC-S*, AC-I1…I5 na funkcji domenowej; AC-I6 po D-P1) → `implementer-server`
(`apps/b2b-web/src/lib/pricing/` + Server Action w `settings/pricing/actions.ts`) → `/kk-verify`.
