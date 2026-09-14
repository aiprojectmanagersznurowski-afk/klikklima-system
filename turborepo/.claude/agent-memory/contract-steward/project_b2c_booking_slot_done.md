---
name: b2c-booking-slot-done
description: B2C-BOOKING-SLOT zamknięte DONE 2026-09-14 (74bd07c) — Google Calendar przestał być źródłem terminów audytu; itest współbieżności nieuruchomiony
metadata:
  type: project
---

`B2C-BOOKING-SLOT` (`contracts/requirements.contract.mjs`) ma `status: 'DONE'` od 2026-09-14
(commit kontraktu `74bd07c`, implementacja `0e9aa1a`, gałąź `feat/crm-suite-complete`).

**Why:** domknięcie D-1 z WO wersja 2 — `bookings` + `absences` zastąpiły Google Calendar jako
źródło listy terminów audytu B2C. Ostatni brakujący element z [[project_cal_pool_aggregate_done]]
(warstwa KLIENCKA `findPoolSlots`) został tu podpięty: `app/actions/auditSlots.ts` -> `Step8Booking.tsx`.
Martwy `app/api/calendar/slots/route.ts` NADAL istnieje i nadal ma zero konsumentów — nie był
przedmiotem zmiany ([[project_b2c_slots_live_source_vs_dead_route]]).

**How to apply:**
- Kryteria K1-K4 (ograniczenie w bazie, 23P01 -> `SLOT_TAKEN`, dwa równoległe żądania, alternatywy)
  stoją na `apps/b2c-web/tests/actions/booking-concurrency.itest.ts` — 5 testów, **nigdy nieuruchomionych**
  (brak Dockera). To ten sam świadomy dług co przy [[project_fld_booking_atomic_assign_blocked]].
  Pierwsze uruchomienie `npm run test:integration` na żywym stacku może wywrócić oba wymagania naraz.
- D-6 wariant (a) jest ROZSTRZYGNIĘTY i celowy: ścieżka jest NIETRANSAKCYJNA. Po błędzie rezerwacji
  osierocone trójki klient+adres+lead ZOSTAJĄ w bazie, `leady.data_rezerwacji` zostaje `NULL`.
  Sprzątanie i pełna atomowość należą do `B2C-LEAD-ATOMIC` — osobne, wciąż OTWARTE wymaganie bez
  ani jednego testu. Nie proponuj zamknięcia `B2C-LEAD-ATOMIC` „przy okazji" B2C-BOOKING-SLOT.
- Reszta długu poza zakresem (potwierdzona w WO, nie do zgłaszania jako defekt): `getFomoSlots`
  filtruje po `'Umówiony Audyt'` — wartości spoza enuma `LeadStatus`, więc licznik zajętości jest
  zawsze 0; `Step8Booking.tsx` waliduje ręcznie na `useState` (`B2C-BOOKING-VALIDATION`);
  `lib/supabaseClient.ts` woli `SUPABASE_SERVICE_ROLE_KEY` nad `anon`.
- Resztka po AC8: `apps/b2c-web/test-busy.ts` (skrypt ad hoc) wciąż woła `freebusy.query` bezpośrednio.
  Osiem skryptów `test-cal*.ts` usunięto, ten jeden został — nie leży na ścieżce odczytu terminów.
