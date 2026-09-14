---
name: fld-booking-atomic-assign-blocked
description: FLD-BOOKING-ATOMIC-ASSIGN pozostał TODO 2026-09-14 — trzy kryteria opisujące zachowanie ograniczenia w bazie mają wyłącznie pokrycie atrapą Prismy
metadata:
  type: project
---

`FLD-BOOKING-ATOMIC-ASSIGN` NIE został zamknięty w oknie `FLD-BOOKING-ATOMIC-ASSIGN-DONE` (2026-09-14). Faza A (`1bd6cb4`) i Faza B (`c89c217`) są zaimplementowane, `kk-trace` jest zielony, ale trzy z 11 kryteriów rejestru mówią o zachowaniu `bookings_no_overlap_per_resource`, a dowodzi ich tylko atrapa:

- kryterium 3 (nakładanie się ≠ identyczny start): test AC-A6 kończy się `SLOT_NOT_OFFERED` z silnika i `bookingCreateMock` NIE jest wołany — brak drugiej połowy AC-A6 z WO („przy wymuszeniu INSERT wynikiem jest SLOT_TAKEN").
- kryterium 4 (styk `[)` nie jest kolizją): AC-A7 mierzy silnik przy buforze 0, nie semantykę `tstzrange(...,'[)')`.
- kryterium 5 (częściowość `WHERE status IN ('RESERVED','CONFIRMED')`): AC-A8 to fixture odczytu, nie wstawienie wiersza obok RELEASED/COMPLETED.

Jedyny `*.itest.ts` w repo (`apps/b2b-web/tests/create-booking-concurrency.itest.ts`) pokrywa AC-A4/AC-A5, czyli identyczny start — przypadek, który przepuściłby także zwykły `UNIQUE (pracownik, start)`, a kryterium 3 istnieje właśnie po to, żeby te dwa odróżnić.

Zakres jest zgodny: kryterium 8 (`assignment_mode = MANUAL`) JEST w rejestrze, więc Faza B nie żyje wyłącznie w WO — to nie jest rozjazd zakresu w rozumieniu [[feedback_scope_mismatch_check_other_owner]].

**Why:** brak osobnego ID `FLD-CALENDAR-FOUNDATION` w rejestrze — to nazwa okna i WO, nie wymaganie. Semantyka ograniczenia nie ma żadnego innego właściciela, więc ta luka nie jest niczyja.

**How to apply:** do zamknięcia potrzebne są trzy przypadki w istniejącym pliku `*.itest.ts` (infrastruktura już jest, więc to tania praca — pisze je `test-author`, nie steward). Do tego czasu status zostaje `TODO`. Nie mylić z [[project_booking_one_active_per_subject]] — tamto ID blokuje niezaaplikowana migracja, to ID blokuje brak testu.
