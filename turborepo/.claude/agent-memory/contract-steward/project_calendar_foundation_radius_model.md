---
name: calendar-foundation-radius-model
description: FLD-CALENDAR-FOUNDATION (2026-09-10) — model promieniowy zastąpił regionowy z ADR-012; audytorzy MAJĄ już kolumnę promienia pod inną nazwą
metadata:
  type: project
---

Okno `FLD-CALENDAR-FOUNDATION` zamknięte 2026-09-10, commit `3c41430` na gałęzi
`contract/FLD-CALENDAR-FOUNDATION`. Powstały `availability_rules`, `bookings`, `absences`,
`visit_duration_baskets` oraz `leady.project_number`. **Migracje URUCHOMIONE na żywej bazie
2026-09-10** (za zgodą Michała, po naprawie `CAL-FOUNDATION-STALE-COLREF-FIX`), statement-po-
statement przez Prisma `$executeRawUnsafe`. Zweryfikowane: 4/4 tabele istnieją, 7 koszyków
czasu trwania zasiane, 8014/8014 leadów ma unikalny `project_number` (backfill zadziałał),
`scheduling_config` obecny, `bookings_no_overlap_per_resource` (EXCLUDE USING gist) żywy.

**Why:** dwie rzeczy z tego okna nie wynikają z kodu i będą myliły przy następnym czytaniu:

1. **Model przydzielania jest PROMIENIOWY, nie regionowy.** Decyzja Michała, świadoma
   rozbieżność z ADR-012: `regions` i `region_postal_codes` **nigdy nie powstaną**.
   `CRM-REGION-AUTO` zachowało ID, ale ma przepisane `statement` i `acceptance`.
   Zasób `'regions'` **zostaje** w RESOURCES/MATRIX — usunięcie to zmiana łamiąca
   kompatybilność i wymaga osobnego ADR. Zasób bez nośnika jest tu stanem zamierzonym.
2. **`audytorzy` MA promień działania.** Work Order twierdził, że audytorzy tego pola
   nie mają i kazał dodać `promien_dzialania_km` symetrycznie do ekip. Nieprawda: kolumna
   istniała od `baseline.sql:292` pod nazwą `max_promien_dojazdu_km`. Nowej kolumny NIE
   dodano (byłyby dwa źródła prawdy). **NIEAKTUALNE od 2026-09-10:** asymetria nazw NIE
   jest już zamrożona — okno `FLD-AUDITOR-RADIUS-RENAME` zrobiło RENAME na
   `promien_dzialania_km`, patrz [[project_auditor_radius_rename]].
3. **Kolejność timestampów ≠ kolejność uruchomienia.** `20260910101000` (rename) poszedł
   na żywą bazę PRZED `20260910100000` (fundament), mimo późniejszego timestampu. Fundament
   odwoływał się przez `COMMENT ON COLUMN` do `max_promien_dojazdu_km` — kolumny, która
   w chwili jego uruchomienia już nie istniała; uruchomienie wywaliłoby się na błędzie.
   Naprawione 2026-09-10 w oknie `CAL-FOUNDATION-STALE-COLREF-FIX` (commit `5f540fb`).

**How to apply:** przy każdym następnym zadaniu dotyczącym przydzielania zleceń albo
geografii pracownika — nie twórz `regions` i nie dodawaj drugiej kolumny promienia.
Zanim dodasz kolumnę „której nie ma", sprawdź `baseline.sql` pod inną nazwą; premisa
w Work Orderze bywa nieścisła (patrz [[feedback_verify_premise_before_baseline]]).
Atomowość rezerwacji to `EXCLUDE USING gist`, nie `UNIQUE` — czasy trwania pochodzą
z koszyków i terminy nie leżą na jednej siatce godzin.
