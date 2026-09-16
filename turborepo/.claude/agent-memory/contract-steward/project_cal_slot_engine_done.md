---
name: cal-slot-engine-done
description: CAL-SLOT-ENGINE — cykl DONE -> TODO -> DONE 2026-09-15; domknięte dopiero na przebiegu itestu w CI (run 34939998108); silnik bez wywołań produkcyjnych, 7 AC w rejestrze vs 40 w WO
metadata:
  type: project
---

`CAL-SLOT-ENGINE` zamknięte na `DONE` 2026-09-10 (commit `d6b9993`, implementacja `8a5e421`), a następnie **COFNIĘTE NA `TODO` 2026-09-15** (commit `a8fcc1e`, okno `CAL-SLOT-ENGINE-PAST-REJECTION`) po dopisaniu siódmego kryterium: silnik nie może oferować ani przyjmować terminu, którego start jest wcześniejszy niż moment bieżący (`SLOT_NOT_OFFERED`).

**Why:** pierwszy PRAWDZIWY przebieg itestów na żywym Postgresie w CI (GitHub Actions run `34937766843`, PR #1) pokazał, że w całym łańcuchu `getEffectiveAvailability` -> `findAvailableSlots` -> `createBooking` **nie ma ani jednego porównania z czasem bieżącym** — `createBooking` na `startAt` sprzed „teraz" zwracał `ok: true`. `findPoolSlots` dziedziczy wadę, bo jest czystą transformacją wyniku silnika. Kryterium istniało w `docs/workorders/B2C-BOOKING-SLOT.md` („Przypadki brzegowe") i zgubiło się między planowaniem a rejestracją — ani `B2C-BOOKING-SLOT`, ani `FLD-BOOKING-ATOMIC-ASSIGN`, ani ten wpis nie miały go w `acceptance`.

**How to apply:**
- **Wybór właściciela „przeszłości" to SILNIK, nie warstwa zapisu** — dwa powody, oba trwałe: `CHECK` z funkcją czasu bieżącego jest w Postgresie niedozwolony (wyrażenie nie jest `IMMUTABLE`), więc wzorzec „gwarancją jest ograniczenie w bazie" z `FLD-BOOKING-ATOMIC-ASSIGN` tu nie zadziała NIGDY; a naprawa tylko w `createBooking` przeniosłaby lukę z zapisu do widoku klienta. Patrz [[feedback_mock_cannot_prove_db_constraint]] — to jest jej odwrotność: bywa kryterium, którego baza z zasady nie udźwignie.
- **Nie wymyślaj progu wyprzedzenia.** `contracts/sla.contract.mjs` sprawdzone 2026-09-15: zna 14 dni, 30 dni, 48 h, 3/7 dni, cap 5 i dwa promienie — ŻADNEGO minimalnego wyprzedzenia rezerwacji. Kryterium celowo mówi wyłącznie „nie w przeszłości".
- **Liczba kryteriów w rejestrze to dziś 7, nie 40.** Grupy P/D/A/B/T/C/S/E z 40 pozycjami to podział WO-owy, nie zawartość `acceptance:`. Licz sam ([[feedback_verify_premise_before_baseline]]).
- **`findAvailableSlots` nie ma ANI JEDNEGO wywołania produkcyjnego.** Świadomie czysta funkcja, jak `getEffectiveAvailability`. Nie traktuj tego jako luki.
- Kod silnika żyje dziś w `packages/scheduling/src/` (`available-slots.ts`, `create-booking.ts`, `pool-slots.ts`), nie w `apps/b2b-web/src/lib/schedule/` — ścieżka zmieniła się po pierwszym zamknięciu.
- Powrót na `DONE` dopiero po ZIELONYM przebiegu `apps/b2c-web/tests/actions/booking-concurrency.itest.ts` w CI, nie po samym `tsc`.
- **Druga próba domknięcia 2026-09-15 (okno `CAL-SLOT-ENGINE-PAST-REJECTION-DONE`, commit `98b3758`) ODMÓWIONA, status dalej `TODO`.** Część (a) kryterium (silnik sam nie zwraca przeszłych slotów) jest po `bee9261` spełniona i URUCHOMIONA — `start < nowMs` w `computeDaySlots`, blok „grupa N" w `available-slots-engine-a-b-t-c-s-e.test.ts`, 111/111 zielonych przy osobistym przebiegu stewarda. Brakuje WYŁĄCZNIE części (b): jedyne pokrycie „`createBooking` ze `startAt` sprzed teraz -> `SLOT_NOT_OFFERED`" to wspomniany itest, nieuruchomiony (brak Dockera) i bez przebiegu CI na commicie z poprawką — gałąź była o 2 commity przed `origin`.
- **TRZECIA próba domknięcia 2026-09-15 (okno `...-DONE-2`, commit `915b0c5`) PRZYJĘTA — status `DONE`.** Dowód: run `34939998108`, `headSha 0dc54dc0881ee46db197c3555e3e628f2fae8be8`, 4/4 joby `success`, log joba `integracja` pokazuje `booking-concurrency.itest.ts ✓ 5 tests` i `Tests 14 passed (14)` — zero `skipped`. To pierwsze zamknięcie w tej sesji oparte na WYKONANIU kodu na żywym Postgresie, nie na `tsc`/atrapie/przeglądzie. Wzorzec weryfikacji: [[feedback_ci_run_as_proof_verify_sha_and_execution]].
- Dwie nieaktualności usunięte przy domknięciu: pokrycie części (b) ma od `0dc54dc` drugi tag `@REQ: CAL-SLOT-ENGINE` (`kk-trace` liczy dziś przy tym wpisie także itest B2C), a gałąź nie jest już za `origin`.
