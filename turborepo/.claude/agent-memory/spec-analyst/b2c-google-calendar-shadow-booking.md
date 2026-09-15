---
name: b2c-google-calendar-shadow-booking
description: Żywa ścieżka rezerwacji w apps/b2c-web stoi na Google Calendar; Michał rozstrzygnął 2026-09-14, że zastępuje ją baza bookings (WO B2C-BOOKING-SLOT) — opis stanu sprzed przełączenia
metadata:
  type: project
---

**ROZSTRZYGNIĘTE 2026-09-14 (Michał):** Google Calendar przestaje być źródłem prawdy dla terminów
audytu B2C — zastępuje go `bookings` + `absences` przez `findPoolSlots`/`createBooking`
z `@repo/scheduling` (pakiet ISTNIEJE od `51f3cd5`). Zakres wykonawczy: `docs/workorders/B2C-BOOKING-SLOT.md`
(wersja 2). Poniższy opis to stan PRZED przełączeniem — po wdrożeniu WO sprawdź kod, zanim go zacytujesz.

W `apps/b2c-web` istnieje druga, nieskontraktowana implementacja rezerwacji terminów, równoległa do
tabeli `bookings` z `FLD-CALENDAR-FOUNDATION`:

- `app/actions/calendar.ts` — `getAvailableSlots()` woła `calendar.freebusy.query` (Google, konto
  serwisowe), sztywna siatka `TIME_SLOTS` bloków 2 h; `createCalendarEvent()` pisze wydarzenie do
  Google. Konsumenci: `components/triage/steps/Step8Booking.tsx`, `app/actions/getFomoSlots.ts`
  (licznik FOMO na stronie głównej liczy wolne sloty z Google, nie z bazy).
- `app/api/calendar/slots/route.ts` (mock, na który wskazuje kryterium akceptacji
  `B2C-BOOKING-SLOT`) **nie ma żadnego konsumenta** — jest martwy. Naprawa tego pliku nie zmienia
  zachowania widocznego dla klienta.
- `app/actions/saveLead.ts` tworzy `klienci` + `adresy` + `leady.data_rezerwacji` i wydarzenie
  Google. **Nie tworzy wiersza `bookings`.**
- `lib/supabaseClient.ts` oraz `leads.ts`/`getFomoSlots.ts` używają `SUPABASE_SERVICE_ROLE_KEY`
  (komentarz w kodzie: „omija RLS"). ADR-001 „B2C: Next.js + supabase-js, RLS aktywne" opisuje
  intencję, nie stan. Zapis jest w plikach `"use server"`, więc zakaz z CLAUDE.md nie jest złamany.
- `apps/b2c-web` **nie importuje Prismy nigdzie** mimo `@repo/database` w `package.json`.
  `apps/b2b-web` (`@apps/b2b-web`) nie jest jego zależnością, nie ma `packages/scheduling` —
  nie istnieje żaden wzorzec wołania logiki Prisma z B2C.

**Why:** Kryteria akceptacji w `requirements.contract.mjs` dla domeny `b2c` opisują stan docelowy
i wskazują pliki, które nie są na ścieżce użytkownika. Zamknięcie takiego wymagania „literalnie"
daje zielony `kk-trace` przy zerowej zmianie produkcyjnej.

**How to apply:** Planując cokolwiek dotyczącego terminów/rezerwacji w B2C, najpierw ustal
grepem, KTO woła dany plik. Każdy WO ruszający terminy B2C musi zawierać decyzję człowieka
„Google Calendar czy `bookings`" — dotyka też licznika FOMO i kalendarzy ludzi w terenie.
Powiązane: [[repo-drift-traps]], [[project_klikklima_wo_conventions]], [[b2c-two-db-clients-one-flow]].
