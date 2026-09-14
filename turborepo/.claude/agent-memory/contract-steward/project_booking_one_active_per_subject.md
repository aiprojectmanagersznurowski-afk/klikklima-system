---
name: booking-one-active-per-subject
description: 2026-09-14 migracja ZAAPLIKOWANA i zweryfikowana na żywo, ale wymaganie ZOSTAJE TODO — 6 z 8 kryteriów bez ani jednego testu; kod istnieje, dowodu nie ma
metadata:
  type: project
---

`FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT` (risk HIGH, zarejestrowane `14fd8f5`) ma **status TODO i tak zostaje**
po oknie `FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT-DONE` z 2026-09-14. Zmieniło się tylko AC8.

**Stan bazy (zweryfikowany read-only 2026-09-14):** migracja
`supabase/migrations/20260910110000_fld_booking_one_active_per_subject.sql` URUCHOMIONA na produkcji.
`bookings.subject_id` (uuid) istnieje, `bookings_one_active_per_subject` istnieje jako częściowy indeks
unikalny na `(subject_id) WHERE status IN ('RESERVED','CONFIRMED')`, definicja zgodna z plikiem.
AC1 i AC8 są spełnione. **Wcześniejsza notatka „nie zaaplikowana" jest nieaktualna.**

**Why nie DONE:** `kk-trace` wykazuje to ID w sekcji „Wymagania HIGH RISK bez żadnego testu".
Jedyne wystąpienie identyfikatora w całym repo to `packages/contracts/src/generated/requirements.ts`
(plik generowany z kontraktu) — zero tagów `@REQ` w `tests/`. Niepokryte AC2, AC3, AC4, AC5, AC6, AC7.

**Pułapka, która się tu potwierdziła:** kod produkcyjny `packages/scheduling/src/create-booking.ts`
rozróżnia `23505` (`SUBJECT_ALREADY_BOOKED`, przerwij pętlę) od `23P01` (`continue` na kolejnego
kandydata) — poprawnie i z komentarzem D-3. Ale ŻADEN test nie podaje `23505`: wszystkie atrapy błędów
w `create-booking.test.ts` produkują `23P01`, a itesty jawnie deklarują w komentarzach, że celują
wyłącznie w `bookings_no_overlap_per_resource`. To ta sama klasa pomyłki co
[[feedback_mock_cannot_prove_db_constraint]], tylko odwrotnie: istnienie poprawnego KODU wzięte za
pokrycie kryterium. Dla AC5/AC6 wystarczyłby test jednostkowy z atrapą (podmiotem jest zachowanie kodu),
dla AC2/AC3/AC4/AC7 potrzebny jest żywy Postgres (podmiotem jest zachowanie indeksu).

**How to apply:**
- AC6 ma dodatkowo lukę IMPLEMENTACYJNĄ, nie tylko testową: kryterium żąda błędu „z odesłaniem do
  rezerwacji istniejącej", a `fail("SUBJECT_ALREADY_BOOKED", …)` zwraca tylko `{code, message,
  alternatives}` — identyfikatora kolidującej rezerwacji nie ma w kształcie `CreateBookingResult`.
  Zamknięcie AC6 wymaga zmiany w `packages/scheduling/`, czyli WO dla implementer-server, nie testu.
- AC3 nie ma się o co oprzeć: `reschedule_of` / `rescheduleOf` nie występuje w ŻADNYM teście w repo.
- D-2 (Postgres w CI) nadal blokuje — `vitest.integration.config.mts` istnieje i itesty są napisane,
  ale wg [[project_fld_booking_atomic_assign_blocked]] nie były uruchamiane (brak Dockera).
