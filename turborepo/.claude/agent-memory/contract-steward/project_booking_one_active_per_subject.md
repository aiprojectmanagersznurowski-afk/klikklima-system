---
name: booking-one-active-per-subject
description: 2026-09-14 ZAMKNIĘTE na DONE (dd69d56) po dwóch turach; wzorzec podziału 8 kryteriów na „przedmiot = kod" (atrapa) vs „przedmiot = indeks" (żywy Postgres)
metadata:
  type: project
---

`FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT` (risk HIGH) zamknięte **DONE 2026-09-14**, commit `dd69d56`,
okno `FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT-DONE`, druga tura. Pierwsza tura słusznie się zatrzymała:
6 z 8 kryteriów nie miało ani jednego testu, a AC6 miało dodatkowo lukę IMPLEMENTACYJNĄ
(`fail("SUBJECT_ALREADY_BOOKED", …)` nie zwracał identyfikatora kolidującej rezerwacji).
Lukę zamknął `d4c82b6` w `packages/scheduling/src/create-booking.ts` (pole `error.existingBooking`).

**Why zatrzymanie było trafne:** notatka poprzedniej tury mówiła „kod poprawny, dowodu nie ma" —
i to zadziałało jako specyfikacja dla implementera i test-authora. Blokada nie była formalna:
AC6 naprawdę wymagało zmiany kodu, nie testu.

**Wzorzec do powtórzenia przy każdym wymaganiu o ograniczeniu w bazie:** podziel kryteria wg
PRZEDMIOTU, zanim ocenisz pokrycie.
- Przedmiot = zachowanie KODU (rozróżnianie SQLSTATE, kształt błędu domenowego) -> wystarczy atrapa
  Prismy, błąd podawany jako `P2010` + `meta.code: '23505'`.
- Przedmiot = zachowanie INDEKSU (częściowość po statusie, brak DEFERRABLE, wyścig) -> żywy Postgres,
  i wtedy itest MUSI omijać warstwę domenową (`prisma.booking.create` wprost), bo silnik odfiltrowałby
  zajęty zasób przed próbą zapisu. Patrz [[feedback_mock_cannot_prove_db_constraint]].
- Kryterium „test wymaga prawdziwego Postgresa" jest META: spełnia je sam fakt, że tamte testy są
  `*.itest.ts`.

**Czego szukać, czytając test dla takiego kryterium (nie wystarczy, że test istnieje):**
- Wyścig o podmiot musi iść na RÓŻNE, NIENAKŁADAJĄCE SIĘ sloty — inaczej odmowę wyprodukowałoby
  `bookings_no_overlap_per_resource` (23P01) i dowód jest pozorny. Asercja na KOD błędu
  (`SUBJECT_ALREADY_BOOKED`, nie `SLOT_TAKEN`) jest tu rozstrzygająca.
- Test rollbacku musi PONOWNIE ODCZYTAĆ stary wiersz po wyjątku i sprawdzić, że nie przeszedł na
  RELEASED. Sam wyjątek 23505 dowodzi odmowy INSERT-u, nie wycofania całej transakcji.

**Dług przeniesiony (świadomy, ten sam co [[project_fld_booking_atomic_assign_blocked]]):** itesty
AC2/AC3/AC4 NIE ZOSTAŁY URUCHOMIONE — brak Dockera, `DATABASE_URL` wskazuje produkcję,
`tools/vitest-integration-db-guard.mjs` blokuje. Podstawa domknięcia: `tsc --noEmit` czysty
+ wzorzec identyczny z AC-A4/AC-A5, zweryfikowanymi kiedyś na żywo. Wykonanie należy do CI.

**How to apply:** przy kolejnym wymaganiu opartym o ograniczenie w bazie zrób ten podział jawnie
w notatce rejestru — implementer i test-author czytają ją jak WO.
