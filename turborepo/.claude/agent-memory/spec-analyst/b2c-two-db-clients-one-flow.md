---
name: b2c-two-db-clients-one-flow
description: Publiczny przepływ B2C miesza supabase-js (klienci/adresy/leady) z Prismą (bookings) — nie ma między nimi transakcji, co strukturalnie blokuje B2C-LEAD-ATOMIC
metadata:
  type: project
---

Jedno żądanie klienta w `apps/b2c-web/app/actions/saveLead.ts` wykonuje trzy INSERT-y przez
`supabase-js` (`klienci`, `adresy`, `leady`) — a rezerwacja terminu musi iść przez `createBooking`
z `@repo/scheduling`, czyli **Prismą**. To dwa osobne połączenia, bez wspólnej transakcji.
Kolejność jest wymuszona przez schemat: `Booking.subject = {kind:'LEAD', leadId}`, więc lead musi
istnieć pierwszy. `saveLead` nie odczytuje `id` wstawionego leada (brak `.select()`, bo `anon` ma
na tych tabelach wyłącznie politykę INSERT) — identyfikator trzeba generować w kodzie, jak
`klientId`/`adresId`.

`B2C-LEAD-ATOMIC` (`requirements.contract.mjs:538`) wymaga czterech zapisów **w jednej transakcji
bazodanowej, łącznie z `bookings`** — czego `supabase-js` nie potrafi. Spełnienie tego wymagania
oznacza przeniesienie całego `saveLead` na `prisma.$transaction`, czyli pierwsze użycie Prismy
w `apps/b2c-web`.

**Why:** Odkryte przy planowaniu `B2C-BOOKING-SLOT` (2026-09-14). Zapisane jako D-6 „WYMAGA DECYZJI"
w `docs/workorders/B2C-BOOKING-SLOT.md` — od wyboru wariantu zależy, czy nieudana rezerwacja
zostawia osieroconego leada, czy produkuje duplikaty klient+adres+lead przy każdej próbie
(a wtedy `bookings_one_active_per_subject` przestaje chronić przed podwójnym kliknięciem).

**How to apply:** Każdy WO dotykający publicznego zapisu B2C musi jawnie powiedzieć, którym
klientem bazodanowym pisze i co się dzieje przy awarii w połowie. Nie pisz „w jednej transakcji",
dopóki `saveLead` stoi na `supabase-js` — to zdanie byłoby nieprawdą.
Powiązane: [[b2c-google-calendar-shadow-booking]], [[repo-drift-traps]].
