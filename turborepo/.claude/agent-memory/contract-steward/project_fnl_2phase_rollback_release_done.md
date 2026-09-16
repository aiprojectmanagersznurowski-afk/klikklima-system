---
name: project-fnl-2phase-rollback-release-done
description: FNL-2PHASE-ROLLBACK-RELEASE zamknięte 2026-09-16 (ea9b390) mimo nieuruchomionego itestu — bo predykat indeksu dało się sprawdzić read-only; zarejestrowano FNL-ROLLBACK-BOOKING-RELEASE
metadata:
  type: project
---

`FNL-2PHASE-ROLLBACK-RELEASE` DONE 2026-09-16 (commit `ea9b390`, gałąź `feat/crm-suite-complete`, niewypchnięte). Zakres wąski: D1 wariant (a) — zwalniana WYŁĄCZNIE rezerwacja `installation_phases(2).booking_id`. Zmiana kontraktu NIEWYMAGANA i niewykonana (T13 ma `guards: []`, nośniki istniały).

Przy tej samej turze zarejestrowano `FNL-ROLLBACK-BOOKING-RELEASE` (TODO, MEDIUM, 4 kryteria) — wariant (b): zwalnianie KAŻDEJ aktywnej rezerwacji podmiotu przy rollbacku. Jego kryterium 4 (czy zwalniać rezerwację o koszyku audytowym wiszącą na leadzie) jest nierozstrzygnięte i blokuje gotowość do realizacji.

**Why:** WO wprost ostrzegał, żeby nie domykać, jeżeli AC3 da się dowieść tylko integracyjnie, a itest nie zostanie uruchomiony (precedens: odmowa `CAL-SLOT-ENGINE`). Rozstrzygnięcie: AC3 rozkłada się na trzy ogniwa — (a) rollback ustawia `RELEASED` (uruchomione testy na dublu), (b) `RELEASED` wypada z zasięgu `bookings_one_active_per_subject` (SPRAWDZONE READ-ONLY NA ŻYWEJ BAZIE: `WHERE status = ANY(ARRAY['RESERVED','CONFIRMED'])`), (c) `23505 -> SUBJECT_ALREADY_BOOKED` (uruchomione testy pod rodzeństwem `FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT`). Żadne ogniwo nie zależało wyłącznie od nieuruchomionego przebiegu — inaczej niż przy CAL-SLOT-ENGINE, gdzie istotą było zachowanie runtime.

**How to apply:** Zanim odmówisz domknięcia z powodu nieuruchomionego `*.itest.ts`, ROZŁÓŻ kryterium na ogniwa i sprawdź, które z nich są własnością STATYCZNEGO obiektu bazy (predykat indeksu, CHECK, UNIQUE) — te obserwujesz wprost przez `pg_indexes`/`pg_constraint` i nie potrzebują przebiegu. Odmowa należy się wtedy, gdy istotą jest ZACHOWANIE w czasie (jak odrzucanie terminów w przeszłości). Patrz [[feedback_mock_cannot_prove_db_constraint]], [[project_cal_slot_engine_done]], [[feedback_coverage_may_sit_under_sibling_req_tag]].

Odczyt żywej bazy w tej sesji: `node --env-file=<repo>/.env --input-type=module -e "..."` uruchomione z `packages/database` (tam rozwiązuje się `@prisma/client`). `source .env` jest zablokowane deny-rule, a zapis pliku skryptowego do scratchpada blokuje guard-paths — patrz [[feedback_sql_verify_via_rolled_back_tx]].
