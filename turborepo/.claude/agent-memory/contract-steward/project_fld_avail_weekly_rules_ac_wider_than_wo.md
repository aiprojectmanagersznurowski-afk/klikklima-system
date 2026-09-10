---
name: fld-avail-weekly-rules-ac-wider-than-wo
description: FLD-AVAIL-WEEKLY-RULES miało 9 kryteriów przy WO pokrywającym 6 — AC7/AC8 wyniesione 2026-09-10 do CAL-SLOT-ENGINE i CAL-POOL-AGGREGATE; wpis DOMKNIĘTY na DONE 2026-09-10 (commit 4075fdd)
metadata:
  type: project
---

Wymaganie `FLD-AVAIL-WEEKLY-RULES` miało w rejestrze 9 kryteriów, a jego Work Order (`docs/workorders/FLD-AVAIL-WEEKLY-RULES.md`, sekcja „Poza zakresem") jawnie oddawał trzy z nich innym wymaganiom. Trzy zielone bloki (A/B/C, commity 1234fad/46c688f/69834b2) pokryły AC1–AC6.

Rozstrzygnięcie 2026-09-10 (zgoda Michała, okno `FLD-AVAIL-WEEKLY-RULES-DONE`): dwa kryteria wyniesione do nowych ID zamiast domykania na siłę:
- `CAL-SLOT-ENGINE` (domain `field`, risk HIGH) — silnik odjęć: reguła dnia − absences − bookings − bufor dojazdu − `SLA.AUDITOR_DAILY_CAP`. Jawnie zapisano, że silnik NIE jest nośnikiem atomowości (to `bookings_no_overlap_per_resource` z `FLD-BOOKING-ATOMIC-ASSIGN`) i że bufor egzekwuje wyłącznie silnik, nigdy baza.
- `CAL-POOL-AGGREGATE` (domain `b2c`, risk MEDIUM) — klient widzi sumę wolnych terminów całej puli (FIELD-APP-PLAN 6.3), pule rozłączne, tożsamość wykonawcy nieujawniana przed rezerwacją.

**ZAMKNIĘTE 2026-09-10, commit `4075fdd`:** ostatnie kryterium (nienaruszalność reguł przy przełączniku `is_available`) domknął `test-author` commitem `af7069e` — dwa testy w `apps/b2b-web/tests/availability-restore.test.ts`. Status `DONE`, 7/7 kryteriów, 70/70 testów zielonych w czterech plikach, `kk-trace` pokazuje DONE z referencjami, ostrzeżenia bez zmian (6 × R16-proposed).

Trzy tury na jedno wymaganie i to był właściwy koszt: (1) zatrzymanie, bo AC wykraczały poza WO, (2) wyniesienie do nowych ID, (3) domknięcie po dowodzie. Żadna z tych tur nie dałaby się skrócić bez wpisania nieprawdy do rejestru.

**Why:** Zamknięcie na `DONE` z kryteriami, których kod nie realizuje (`getEffectiveAvailability` nie czyta ani `absences`, ani `bookings`, ani `travel_buffer_minutes`), wpisałoby do rejestru nieprawdę i ukryło brakującą pracę.

**How to apply:** Zakres Work Orderu nie jest definicją zakresu wymagania — porównuj testy z listą `acceptance` w rejestrze, nie z checklistą WO. Gdy rozjazd jest strukturalny, wynoś nadmiarowe kryteria do osobnych ID z `source` wskazującym poprzednika, nigdy nie kasuj treści ([[feedback_closing_requirement_with_residual_debt]], [[feedback_requirement_id_granularity]]). Przy zamykaniu sprawdzaj, czy asercja celuje w CAŁĄ powierzchnię zapisu — tu dowód był wiarygodny dlatego, że objął obie ścieżki raw SQL, a nie tylko metody modelu Prisma ([[project_crm_lead_update_admin_dispatcher_closed]]).
