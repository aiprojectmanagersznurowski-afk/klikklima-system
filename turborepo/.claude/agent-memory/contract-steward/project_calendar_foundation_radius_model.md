---
name: calendar-foundation-radius-model
description: FLD-CALENDAR-FOUNDATION (2026-09-10) — model promieniowy zastąpił regionowy z ADR-012; audytorzy MAJĄ już kolumnę promienia pod inną nazwą
metadata:
  type: project
---

Okno `FLD-CALENDAR-FOUNDATION` zamknięte 2026-09-10, commit `3c41430` na gałęzi
`contract/FLD-CALENDAR-FOUNDATION`. Powstały `availability_rules`, `bookings`, `absences`,
`visit_duration_baskets` oraz `leady.project_number`. Migracje **nie zostały uruchomione**
na żywej bazie — to osobny krok za zgodą człowieka.

**Why:** dwie rzeczy z tego okna nie wynikają z kodu i będą myliły przy następnym czytaniu:

1. **Model przydzielania jest PROMIENIOWY, nie regionowy.** Decyzja Michała, świadoma
   rozbieżność z ADR-012: `regions` i `region_postal_codes` **nigdy nie powstaną**.
   `CRM-REGION-AUTO` zachowało ID, ale ma przepisane `statement` i `acceptance`.
   Zasób `'regions'` **zostaje** w RESOURCES/MATRIX — usunięcie to zmiana łamiąca
   kompatybilność i wymaga osobnego ADR. Zasób bez nośnika jest tu stanem zamierzonym.
2. **`audytorzy` MA promień działania — nazywa się `max_promien_dojazdu_km`.** Work Order
   twierdził, że audytorzy tego pola nie mają i kazał dodać `promien_dzialania_km`
   symetrycznie do ekip. Nieprawda: kolumna istnieje od `baseline.sql:292`, czytają ją
   Server Actions i pięć plików testowych. Nowej kolumny NIE dodano (dwa źródła prawdy),
   zmiany nazwy NIE zrobiono (zmiana łamiąca + testów nie wolno mi ruszać). Asymetria
   `audytorzy.max_promien_dojazdu_km` / `zespoly_monterskie.promien_dzialania_km` jest
   zamrożona, jak `is_active` / `aktywny`.

**How to apply:** przy każdym następnym zadaniu dotyczącym przydzielania zleceń albo
geografii pracownika — nie twórz `regions` i nie dodawaj drugiej kolumny promienia.
Zanim dodasz kolumnę „której nie ma", sprawdź `baseline.sql` pod inną nazwą; premisa
w Work Orderze bywa nieścisła (patrz [[feedback_verify_premise_before_baseline]]).
Atomowość rezerwacji to `EXCLUDE USING gist`, nie `UNIQUE` — czasy trwania pochodzą
z koszyków i terminy nie leżą na jednej siatce godzin.
