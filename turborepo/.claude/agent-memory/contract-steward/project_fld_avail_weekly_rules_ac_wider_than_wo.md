---
name: fld-avail-weekly-rules-ac-wider-than-wo
description: FLD-AVAIL-WEEKLY-RULES miało 9 kryteriów przy WO pokrywającym 6 — AC7/AC8 wyniesione 2026-09-10 do CAL-SLOT-ENGINE i CAL-POOL-AGGREGATE, wpis zostaje TODO do domknięcia AC9
metadata:
  type: project
---

Wymaganie `FLD-AVAIL-WEEKLY-RULES` miało w rejestrze 9 kryteriów, a jego Work Order (`docs/workorders/FLD-AVAIL-WEEKLY-RULES.md`, sekcja „Poza zakresem") jawnie oddawał trzy z nich innym wymaganiom. Trzy zielone bloki (A/B/C, 64 testy, commity 1234fad/46c688f/69834b2) pokryły AC1–AC6.

Rozstrzygnięcie 2026-09-10 (zgoda Michała, okno `FLD-AVAIL-WEEKLY-RULES-DONE`): dwa kryteria wyniesione do nowych ID zamiast domykania na siłę:
- `CAL-SLOT-ENGINE` (domain `field`, risk HIGH) — silnik odjęć: reguła dnia − absences − bookings − bufor dojazdu − `SLA.AUDITOR_DAILY_CAP`. Jawnie zapisano, że silnik NIE jest nośnikiem atomowości (to `bookings_no_overlap_per_resource` z `FLD-BOOKING-ATOMIC-ASSIGN`) i że bufor egzekwuje wyłącznie silnik, nigdy baza.
- `CAL-POOL-AGGREGATE` (domain `b2c`, risk MEDIUM) — klient widzi sumę wolnych terminów całej puli (FIELD-APP-PLAN 6.3), pule rozłączne, tożsamość wykonawcy nieujawniana przed rezerwacją.

Zwężono też `statement` samego `FLD-AVAIL-WEEKLY-RULES` (warstwa 1: reguły cykliczne + odczyt efektywnego okna jako wejście dla silnika). Wpis nadal `TODO` — zostało AC9 (nienaruszalność reguł przy przełączniku `is_available`), które ma domknąć `test-author`; dopiero potem `DONE`.

**Why:** Zamknięcie na `DONE` z kryteriami, których kod nie realizuje (`getEffectiveAvailability` nie czyta ani `absences`, ani `bookings`, ani `travel_buffer_minutes`), wpisałoby do rejestru nieprawdę i ukryło brakującą pracę.

**How to apply:** Zakres Work Orderu nie jest definicją zakresu wymagania — porównuj testy z listą `acceptance` w rejestrze, nie z checklistą WO. Gdy rozjazd jest strukturalny, wynoś nadmiarowe kryteria do osobnych ID z `source` wskazującym poprzednika, nigdy nie kasuj treści ([[feedback_closing_requirement_with_residual_debt]], [[feedback_requirement_id_granularity]]).
