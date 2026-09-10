---
name: booking-one-active-per-subject
description: 2026-09-10 D-3 rozstrzygnięte wariantem (b); migracja subject_id + indeks częściowy NAPISANA, NIE ZAAPLIKOWANA na żywej bazie
metadata:
  type: project
---

`FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT` zarejestrowane (TODO, risk HIGH) i zamknięte commitem `14fd8f5`.
Migracja `supabase/migrations/20260910110000_fld_booking_one_active_per_subject.sql`: kolumna generowana
`bookings.subject_id = COALESCE(lead_id, service_id, incident_id)` + częściowy indeks unikalny
`bookings_one_active_per_subject` WHERE status IN ('RESERVED','CONFIRMED').
**Nie uruchomiona na produkcji** — Michał wymaga osobnej, jawnej zgody na każde uruchomienie migracji.

**Why:** D-3 z `docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md` — podwójne kliknięcie przy puli dwuosobowej
tworzyło dwie poprawne rezerwacje jednego leada u dwóch osób; `bookings_one_subject` pilnuje wiersza,
nie podmiotu. Michał wybrał wariant (b): ograniczenie w bazie, bo sprawdzenie w kodzie jest nieszczelne
dokładnie tą samą klasą błędu, którą zwalcza [[project_cal_slot_engine_done]].

**How to apply:**
- Trzy pułapki, które muszą przetrwać do implementacji: (1) 23505 ≠ 23P01 — przy 23P01 ponawia się na
  kolejnym kandydacie z puli, przy 23505 pętla musi się przerwać; (2) indeks częściowy NIE MOŻE być
  DEFERRABLE (nie da się wyrazić jako UNIQUE CONSTRAINT), więc przekładanie terminu musi ustawić stary
  wiersz na RELEASED PRZED wstawieniem nowego; (3) test dowodzący czegokolwiek to dwa równoległe żądania
  na ten sam podmiot, ale RÓŻNE sloty i różnych pracowników — inaczej odmowę produkuje
  `bookings_no_overlap_per_resource`, czyli inne ograniczenie.
- Wzorzec kolumny generowanej dla „dokładnie jedno z kilku FK, unikalność po tym jednym" jest w tym repo
  ustalony: `resource_id = COALESCE(auditor_id, crew_id)` (migracja 20260910100000). Prisma kolumn
  generowanych nie wyraża — dopisuje się je do bloku komentarza nad sekcją FLD-CALENDAR-FOUNDATION
  w `schema.prisma`, NIE do modelu.
- D-2 (Postgres w CI) nadal nierozstrzygnięte, więc kryteriów współbieżnych nie da się dziś zaliczyć.
  Uwaga: 2026-09-10 ktoś równolegle dodał `vitest.integration.config.mts` — sprawdź, czy D-2 nie zostało
  w międzyczasie zamknięte.
