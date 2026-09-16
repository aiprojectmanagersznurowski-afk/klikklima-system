---
name: fnl-2phase-booking-done
description: FNL-2PHASE-BOOKING zamknięte 2026-09-16 (3c1e306) — dwa kryteria dowiedzione danymi z produkcji, nie fixture; efekt do:openPhaseTwoBooking bez wykonawcy
metadata:
  type: project
---

`FNL-2PHASE-BOOKING` DONE 2026-09-16, commit `3c1e306`, 6/6 kryteriów + AC4b, 69 testów zielonych.
Migracja `20260916060000` zweryfikowana przeze mnie read-only na żywej bazie (7 kolumn, 5 ograniczeń,
CZĘŚCIOWY unique na `booking_id`, RLS ON bez polityk, `instalacje.installation_type` text NULL).

**Why:** trzy rzeczy z tej tury są nieoczywiste przy następnym czytaniu.

1. **Kryterium 5 (koszyki) nie miało pokrycia w żadnym teście — fixture'y to nie dowód.**
   `booking-basket-select-logic.test.ts` i `scheduling-config-*.test.ts` używają
   `INSTALL_PHASE_1`/`INSTALL_PHASE_2` jako danych wejściowych mocka, więc grep po nazwie
   koszyka daje złudzenie pokrycia. Dowodem okazał się dopiero SELECT na `visit_duration_baskets`
   na produkcji: 7 wierszy, 480 i 240 min, maksimum w całym słowniku 480 — czyli koszyka
   dwudniowego naprawdę nie ma. To wariant reguły z [[feedback_mock_cannot_prove_db_constraint]]
   rozszerzony na DANE SŁOWNIKOWE, nie tylko na obiekty schematu.

2. **`do:openPhaseTwoBooking` nie ma w repo wykonawcy o tej nazwie.** Link do etapu II powstaje
   wprost w payloadzie N8a, a KAŻDE miejsce wykonujące efekty (`logistics/actions.ts` ×2,
   `two-phase-actions.ts`) filtruje prefiks `do:`. Żaden efekt `do:` nie ma dziś dispatchera.
   Skutek: usunięcie tego efektu z `T17.effects` nie zapali ŻADNEGO testu. Istota kryterium 2
   (link nie istnieje przed zamknięciem etapu I, istnieje po) jest pokryta — nazwa efektu nie.
   To ten sam mechanizm, który przy R7 kazał usunąć `do:issuePhaseOneInvoice` z T17 (wariant b).

3. **`FNL-2PHASE` NIE domykać.** 3/5 (kryt. 3, 4, 5 — guardy i dwa rekordy etapów).
   Kryt. 1 (`leads.declared_property_condition`) nadal nie istnieje. Kryt. 2 ma od 2026-09-16
   NOŚNIK, ale ZERO ścieżki zapisu: wiersz instalacji powstaje dopiero przy przypisaniu ekipy,
   więc audytor nie ma gdzie zapisać trybu w chwili wyceny (R4 w WO).

**How to apply:** wracając do montażu dwuetapowego — nie planuj pracy nad `FNL-2PHASE` bez
rozstrzygnięcia, kiedy powstaje wiersz instalacji. Gdyby ktoś zgłaszał, że koszyki „nie mają
testu" — mają dowód, tylko w bazie, nie w pliku testowym.

Powiązane: [[project_fnl_2phase_booking_mechanics_carriers]] (nośniki, R7 wariant (b)),
[[feedback_coverage_may_sit_under_sibling_req_tag]], [[feedback_closing_requirement_with_residual_debt]].
