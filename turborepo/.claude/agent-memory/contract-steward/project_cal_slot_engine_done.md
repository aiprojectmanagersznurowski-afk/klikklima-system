---
name: cal-slot-engine-done
description: 2026-09-10 CAL-SLOT-ENGINE zamknięte na DONE; silnik to czysta funkcja BEZ wywołań produkcyjnych, liczba AC w rejestrze (6) != liczba AC w WO (40)
metadata:
  type: project
---

`CAL-SLOT-ENGINE` zamknięte na `DONE` 2026-09-10 (commit `d6b9993`, implementacja `8a5e421`). Wszystkie **6** kryteriów rejestru pokryte 55 zielonymi testami.

**Why:** wymaganie powstało 2026-09-10 przez wyniesienie z `FLD-AVAIL-WEEKLY-RULES` (patrz [[project_fld_avail_weekly_rules_ac_wider_than_wo]]) i było ostatnim brakującym ogniwem warstwy 2 kalendarza.

**How to apply:**
- **Liczba kryteriów w rejestrze to 6, nie 40.** Grupy P/D/A/B/T/C/S/E z 40 pozycjami to podział WO-owy (obowiązki testowe), nie zawartość `acceptance:` w rejestrze. Zlecenie mówiące „40 kryteriów w rejestrze" jest nieścisłe — licz sam, zgodnie z [[feedback_verify_premise_before_baseline]].
- **`findAvailableSlots` nie ma ANI JEDNEGO wywołania produkcyjnego** (`apps/b2b-web/src/lib/schedule/available-slots.ts`). To świadomie czysta funkcja, jak `getEffectiveAvailability`; warstwę wywołującą dostarczą `FLD-BOOKING-ATOMIC-ASSIGN` i `CAL-POOL-AGGREGATE`. Nie traktuj braku wywołań jako luki.
- Testy statyczne „brak literału" (120/90/240/480, 60, 5) czytają ŹRÓDŁO silnika po ścieżce i najpierw asertują `existsSync` — rename pliku je wywali, nie przemilczy. Ten wzorzec warto powtarzać.
- Nadal `TODO` w tej rodzinie: `CAL-POOL-AGGREGATE`, `FLD-BOOKING-ATOMIC-ASSIGN`, `CAL-TRAVEL-BUFFER`, `CAL-VISIT-DURATION-BASKETS`.
