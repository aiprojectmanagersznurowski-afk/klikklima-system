# Pamięć agenta: contract-steward

- [Blokada zapisu do contracts/](project_contract_write_blocker.md) — NAPRAWIONA 2026-08-19; zapis przyczyny i naprawy na wypadek regresji guard-paths.
- [Dług na regułach absolutnych w pre-commit](project_precommit_absolute_debt.md) — po naprawie baseline zostały as-any i green-sla; jedyny powód --no-verify.
- [Semantyka statusu SUPERSEDED](project_superseded_status_semantics.md) — forma wpisu zastąpionego i dwie pułapki: kk-trace zielony, ale ostrzeżenie HIGH RISK zostaje na stałe.
- [Semantyka statusu BLOCKED](project_blocked_status_semantics.md) — co znaczy BLOCKED w rejestrze wymagań i dlaczego walidator ma stałe ostrzeżenia R16 (dziś 5).
- [Żywotność reguł bramki](feedback_gate_rule_liveness.md) — nowa reguła walidatora zawsze ze stałą mutacją w kk-selftest, zakres szeroki, dowodem jest komunikat.
- [Baseline nazewnictwa przy migracjach](project_naming_baseline_on_migrations.md) — każda migracja na polskich tabelach blokuje pre-commit; baseline aktualizuje człowiek.
- [Incydent: RLS wyłączone na żywej bazie](project_rls_disabled_incident.md) — 16/18 tabel bez RLS, anon z pełnymi prawami; migracja SEC-RLS-BASELINE napisana, nieuruchomiona.
- [Luka w pokryciu bramki uprawnień](project_authz_gate_coverage_gap.md) — poprawna macierz RBAC przy kodzie, który jej nie czyta; luka wchodzi tam, gdzie kończy się definicja skanera.
- [Dryf pola status w rejestrze wymagań](project_requirement_status_drift.md) — żadna bramka nie pilnuje `status`; obecność testu przy ID nie dowodzi każdego kryterium acceptance.
- [Brak kont innych niż admin](project_no_nonadmin_accounts.md) — potwierdzone 2026-08-26; luki RBAC audytor/monter są prewencyjne, ale risk zostaje HIGH.
- [Obiekty bazy poza migracjami](project_live_db_objects_outside_migrations.md) — available_combinations i buckety Storage żyją tylko na produkcji; SQL na nich wymaga osłony to_regclass.
- [Migracje bezpieczeństwa: plik vs stan serwera](project_unapplied_security_migrations.md) — wszystkie 6 uruchomione (2026-09-03); wzorzec: po zastosowaniu przepisz nagłówek, bo mylił w obie strony.
- [Domykanie wymagania z resztkowym długiem](feedback_closing_requirement_with_residual_debt.md) — kryterium NIEPOKRYTE przy DONE: wynieś do osobnego ID, nigdy nie kasuj.
- [Weryfikacja premisy przed baseline](feedback_verify_premise_before_baseline.md) — „wszystko w testach" bywa nieścisłe; rozbijam deltę per plik przed --update-baseline.
- [Retroaktywne ID zapala kk-trace](project_retroactive_req_trace_red.md) — rejestracja po testach = czerwona bramka, bo tagi @REQ może dopisać tylko test-author.
- [Steward nie ma prawa zapisu do tests/](project_steward_cannot_write_tests.md) — statyczny test zamrażający migrację to zadanie test-author, mimo mylącego precedensu w historii.
- [Sprzeczność T08: klasyfikator K1 vs decyzja D1](project_t08_classifier_vs_d1_tension.md) — markDelivered ma actor SYSTEM, więc K1 je łapie, a człowiek je wykluczył; wybuchnie w fali C.
- [Ziarnistość ID wymagań](feedback_requirement_id_granularity.md) — jedno ID na encję obejmujące create i update, podział po encji, nie po operacji.
