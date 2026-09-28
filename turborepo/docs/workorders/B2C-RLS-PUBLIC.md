# WO: B2C-RLS-PUBLIC — ścieżka publiczna B2C faktycznie działa na RLS

> **Status: GOTOWE DO RED dla AC1–AC3 (same testy + narzędzie CI). AC4–AC5 wymagają okna
> kontraktowego (polityki RLS katalogu) i decyzji D-R1.**
>
> **WO 3 z 3** w pakiecie „B2C: zapis leada". Najlepiej po `B2C-LEAD-ATOMIC` — po nim `saveLead`
> przestaje używać `lib/supabaseClient.ts`, co zmniejsza zakres AC5 do odczytów katalogu.

## Wymagania

- **`B2C-RLS-PUBLIC`** (`contracts/requirements.contract.mjs:598`) — TODO, risk HIGH. Statement:
  „Aplikacja B2C czyta dane kluczem anonimowym z aktywnym RLS, a klucz serwisowy występuje
  wyłącznie w Server Actions." Zamykane w całości (4 kryteria).
- Styczne: **`SEC-SERVICE-KEY-SERVER-ONLY`** (`:385`) ma status **DONE** z kryterium „Skan bundla
  w CI" — a w repozytorium **nie ma żadnego skanu bundla** (`scripts/verify.sh`,
  `.github/workflows/`, `tools/` — zero odwołań do `.next/static`; jedyną ochroną jest reguła
  `service-key` w `tools/kk.config.mjs:62`, skanująca **źródła** `.tsx`). Status DONE jest więc
  fałszywy co do drugiego kryterium. Do korekty przez `contract-steward`; ten WO dostarcza brakujący
  dowód dla obu wymagań naraz.

## Kontekst kodu

### Istnieje

- `apps/b2c-web/lib/supabaseClient.ts:4` —
  `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`: **klucz serwisowy ma
  pierwszeństwo**, komentarz `:6` „omija RLS". Importują go wyłącznie pliki `"use server"`:
  `saveLead.ts`, `getAvailableSizes.ts`, `getSetForConfig.ts`, `getValidConfigurations.ts`,
  `getRecommendation.ts`, `getBestsellers.ts`, `getCatalog.ts`, `getLowestPriceForIndoorUnit.ts`.
  Czyli dziś **każdy odczyt katalogu B2C omija RLS** — statement wymagania jest złamany niezależnie
  od bundla.
- `apps/b2c-web/app/actions/leads.ts:6–10` i `getFomoSlots.ts` — własny `createClient` z kluczem
  serwisowym (Server Actions — dopuszczalne literą wymagania, ale to też jest „omijanie RLS").

### Stan żywej bazy (odczyt `pg_policies`/`pg_class` 2026-09-28)

- RLS włączone na wszystkich tabelach `public`.
- `anon` ma politykę **wyłącznie INSERT** na `klienci`, `adresy`, `leady`; **brak jakiejkolwiek**
  polityki `anon` na `bookings`, `soft_leady`, `legal_document_versions`, `system_config`,
  `visit_duration_baskets`. → Kryt. 2 i część „lejek nieczytelny" kryt. 3 są **prawdopodobnie
  spełnione już dziś** — brakuje testu, nie kodu.
- `anon` ma SELECT (`USING true`) na `indoor_units`, `outdoor_units`, `cennik_uslug`;
  `knowledge_base` tylko `access_level = 'public'`.
- **`single_split_sets`, `multi_split_sets`, `modele_3d` — RLS włączone, ZERO polityk `anon`.**
  Anonimowy odczyt zwraca pusty zbiór. `available_combinations` to **materialized view**
  (RLS nie dotyczy widoków zmaterializowanych — dostęp wyłącznie przez GRANT, niezweryfikowany).
- `anon` ma na wszystkich tabelach domyślne GRANT-y Supabase łącznie z `TRUNCATE` — RLS nie
  obejmuje `TRUNCATE`. PostgREST go nie wystawia, więc to nie jest wektor przez REST — przekazane
  `rls-security-auditor`, poza zakresem.

### Brakuje

- Skanu **zbudowanego** bundla klienckiego (`apps/b2c-web/.next/static/**`).
- Testu realnego odczytu cudzego leada rolą `anon`.
- Polityk odczytu anonimowego dla części tabel katalogu (patrz wyżej) — bez nich przełączenie
  `supabaseClient.ts` na klucz anonimowy **opróżni katalog i konfigurator** na stronie.

## WYMAGA DECYZJI

**D-R1 — Które tabele są „katalogiem produktów i treści" (kryt. 3)?** Kandydaci:
`indoor_units`, `outdoor_units`, `cennik_uslug`, `single_split_sets`, `multi_split_sets`,
`modele_3d`, `available_combinations`, `knowledge_base` (public). Otwarte: czy `cennik_uslug`
(cennik usług montażowych) ma być publiczny (dziś jest), oraz co z `system_config` i
`visit_duration_baskets` czytanymi przez `getFomoSlots.ts`/`getRecommendation.ts`/
`getSetForConfig.ts` — to nie katalog, więc po przełączeniu te odczyty muszą zostać na kluczu
serwisowym w Server Action albo przejść na Prismę. Lista determinuje migrację polityk.

## Zmiana kontraktu

- AC1–AC3: **NIEWYMAGANA** (testy + skrypt w `tools/`/`scripts/` + krok CI).
- AC4–AC5: **WYMAGANA** — migracja z politykami `SELECT TO anon` dla tabel katalogu z D-R1
  (oraz ewentualny `GRANT SELECT` na `available_combinations`). Bez niej AC5 zepsuje stronę.
  Migracja musi być uruchomiona i sprawdzona w `pg_policies` przed przełączeniem klucza.

## Kryteria akceptacji (wykonalne)

- [ ] **AC1** *(kryt. 1)* — „Skan zbudowanego bundla klienckiego apps/b2c-web nie zawiera klucza
  serwisowego — sprawdzenie samego kodu źródłowego nie wystarcza." Build `apps/b2c-web` z
  `SUPABASE_SERVICE_ROLE_KEY` ustawionym na **wartość-wartownika** (unikalny ciąg, nie prawdziwy
  klucz); skan wszystkich plików `.next/static/**` nie znajduje ani wartownika, ani ciągu
  `SUPABASE_SERVICE_ROLE_KEY`, ani JWT z `"role":"service_role"` (zdekodowany payload).
  **Test kontrolny (samosprawdzenie bramki):** zbudowany wariant z celowo wstrzykniętym
  wartownikiem do komponentu klienckiego ma skan **wywrócić** — bez tego skan może być pusty i
  zielony (lekcja `QA-E2E-SUITE-REPAIR` kryt. 2).
- [ ] **AC2** *(kryt. 1, CI)* — Skan uruchamia się w bramce CI (`.github/workflows/kk-gate.yml`)
  po buildzie `b2c-web`; niepowodzenie blokuje merge. Dowód: przebieg CI z logiem wykonania skanu.
- [ ] **AC3** *(kryt. 2 + część kryt. 3)* — „Odczyt cudzego leada klientem anonimowym zwraca pusty
  zbiór — test wykonuje realne zapytanie, nie sprawdza konfiguracji polityk." Test integracyjny na
  żywym Postgresie: utworzony (Prismą) lead+klient+adres+rezerwacja; następnie zapytanie jako rola
  `anon` (`SET LOCAL ROLE anon` w transakcji albo `supabase-js` z kluczem anonimowym na lokalnym
  Supabase) po znanym `id` zwraca **0 wierszy** dla każdej z tabel `leady`, `klienci`, `adresy`,
  `bookings`. Osobny przypadek na tabelę. Sprawdzenie treści `pg_policies` **nie jest** dowodem.
- [ ] **AC4** *(kryt. 3)* — Te same zapytania anonimowe na każdej tabeli katalogu z D-R1 zwracają
  **≥ 1 wiersz** (na zasianych danych testowych).
- [ ] **AC5** *(statement + kryt. 4)* — `lib/supabaseClient.ts` używa wyłącznie
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`; brak klucza anonimowego = błąd konfiguracji, **nie** cichy
  powrót do klucza serwisowego ani do `placeholder_key`. Test statyczny: żaden plik w
  `apps/b2c-web` poza jawną listą Server Actions (z uzasadnieniem przy każdej) nie odwołuje się
  do `SUPABASE_SERVICE_ROLE_KEY`.

## Przypadki brzegowe, które MUSZĄ mieć test

- Lead **własny** też jest nieczytelny anonimowo (anon nie ma tożsamości — „cudzy" i „własny" to
  ten sam przypadek; test ma to pokazać, nie założyć).
- `INSERT` anonimowy do `leady` nadal działa **tylko jeśli** jakakolwiek ścieżka go jeszcze używa —
  po `B2C-LEAD-ATOMIC` żadna nie używa; wtedy polityki INSERT dla `anon` na `klienci`/`adresy`/
  `leady` są martwą powierzchnią ataku (decyzja o ich usunięciu → `rls-security-auditor`, poza
  zakresem).
- Skan bundla obejmuje także chunki ładowane dynamicznie i source mapy, jeśli są publikowane.

## Poza zakresem

- `B2C-PRICE-FROM` i logika `getBestsellers.ts` — ten WO zmienia wyłącznie klucz, którym plik
  czyta; zachowanie cenowe nie jest tu testowane (przez AC4 ma dalej dostawać te same dane).
- `TRUNCATE`/nadmiarowe GRANT-y dla `anon` — `rls-security-auditor`.
- Przejście `leads.ts` (soft lead) i `getFomoSlots.ts` z klucza serwisowego na Prismę.

## Ryzyka i nieznane

- **R-1** Przełączenie klucza bez migracji z D-R1 = pusty katalog na produkcji, a testy jednostkowe
  (z mockiem `supabase.from`) pozostaną zielone. AC4 musi biec na żywej bazie.
- **R-2** `available_combinations` (materialized view) — nie wiadomo, czy `anon` ma `SELECT`
  (`information_schema.role_table_grants` nie pokazuje widoków zmaterializowanych). Do sprawdzenia
  realnym zapytaniem w AC4.
- **R-3** Skan bundla wymaga `next build` w CI — czas joba i zmienne środowiskowe buildu
  (`NEXT_PUBLIC_*`) muszą być dostępne; wartownik zamiast prawdziwego klucza, żeby sekret nie
  trafiał do logów CI.

## Kolejność ról

0. Człowiek: D-R1.
1. `test-author` — AC1, AC3 (od razu); AC4–AC5 po migracji.
2. `implementer-server` — skrypt skanu + krok CI (AC1–AC2).
3. `contract-steward` — okno: polityki katalogu (AC4), korekta statusu/notatki
   `SEC-SERVICE-KEY-SERVER-ONLY`.
4. `implementer-server` — `lib/supabaseClient.ts` (AC5).
5. `rls-security-auditor`, `reviewer`.
