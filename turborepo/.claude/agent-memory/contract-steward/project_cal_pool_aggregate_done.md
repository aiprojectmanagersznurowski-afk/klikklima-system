---
name: cal-pool-aggregate-done
description: 2026-09-14 CAL-POOL-AGGREGATE zamknięte na DONE; kryteria rejestru mówią "Klient widzi", a dostarczono czystą funkcję bez konsumenta B2C — warstwę kliencką przejęło B2C-BOOKING-SLOT nowym kryterium
metadata:
  type: project
---

`CAL-POOL-AGGREGATE` zamknięte na `DONE` 2026-09-14 (okno `CAL-POOL-AGGREGATE-DONE`, commit kontraktu `c6b6fae`, implementacja `16a5f18`). 4 kryteria rejestru, 31 zielonych testów (uruchomionych, nie przepisanych z raportu).

**Why:** trzecie z rzędu domknięcie rodziny kalendarza po [[cal-slot-engine-done]] i [[project_fld_booking_atomic_assign_blocked]]. Zlecenie kazało sprawdzić, czy rejestr nie wymaga czegoś spoza WO — i wymagał.

**How to apply:**
- **Rozjazd, który realnie tu wystąpił:** kryteria 1 i 3 rejestru są sformułowane od strony klienta („Klient widzi", „Widok NIE ujawnia klientowi"), a dostarczono `findPoolSlots` — czystą funkcję **bez ani jednego konsumenta w `apps/b2c-web`**. Żywym źródłem terminów B2C jest nadal Google Calendar (`apps/b2c-web/app/actions/calendar.ts` → `Step8Booking.tsx`), a `app/api/calendar/slots/route.ts` to **martwy plik bez konsumentów** — mimo że kryterium `B2C-BOOKING-SLOT` wskazuje go jako źródło listy slotów.
- **Rozstrzygnięcie:** to NIE luka (ta sama własność co przy `CAL-SLOT-ENGINE`), ale nie wolno jej domknąć milcząco. Zgodnie z [[feedback_closing_requirement_with_residual_debt]] dopisałem `B2C-BOOKING-SLOT` (OTWARTE, risk HIGH) jawne kryterium przejmujące warstwę dostarczenia i nazywające `findPoolSlots` jako wymagane źródło. Dopisanie AC do cudzego OTWARTEGO wpisu jest addytywne i nie wymaga ADR.
- **Uwaga na ścieżki w notatce:** w chwili commitu inny agent miał w indeksie NIEZACOMMITOWANE przeniesienie `apps/b2b-web/src/lib/schedule/*` oraz testów do `packages/scheduling/` (wariant (a) z D-1 WO `B2C-BOOKING-SLOT`). Ścieżki `apps/b2b-web/...` w `note` obu wpisów zdezaktualizują się, gdy ten ruch wyląduje — do poprawienia w najbliższym oknie kontraktowym.
- Nadal `TODO` w rodzinie kalendarza: `B2C-BOOKING-SLOT`, `FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT`, `CAL-TRAVEL-BUFFER`, `CAL-VISIT-DURATION-BASKETS`.
