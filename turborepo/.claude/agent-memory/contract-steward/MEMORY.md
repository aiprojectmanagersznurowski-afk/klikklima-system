# Pamięć agenta: contract-steward

- [Blokada zapisu do contracts/](project_contract_write_blocker.md) — NAPRAWIONA 2026-08-19; zapis przyczyny i naprawy na wypadek regresji guard-paths.
- [Dług na regułach absolutnych w pre-commit](project_precommit_absolute_debt.md) — po naprawie baseline zostały as-any i green-sla; jedyny powód --no-verify.
- [Semantyka statusu BLOCKED](project_blocked_status_semantics.md) — co znaczy BLOCKED w rejestrze wymagań i dlaczego walidator ma stałe ostrzeżenia R16 (dziś 5).
- [Żywotność reguł bramki](feedback_gate_rule_liveness.md) — nowa reguła walidatora zawsze ze stałą mutacją w kk-selftest, zakres szeroki, dowodem jest komunikat.
- [Baseline nazewnictwa przy migracjach](project_naming_baseline_on_migrations.md) — każda migracja na polskich tabelach blokuje pre-commit; baseline aktualizuje człowiek.
- [Incydent: RLS wyłączone na żywej bazie](project_rls_disabled_incident.md) — 16/18 tabel bez RLS, anon z pełnymi prawami; migracja SEC-RLS-BASELINE napisana, nieuruchomiona.
- [Luka w pokryciu bramki uprawnień](project_authz_gate_coverage_gap.md) — poprawna macierz RBAC przy kodzie, który jej nie czyta; luka wchodzi tam, gdzie kończy się definicja skanera.
- [Dryf pola status w rejestrze wymagań](project_requirement_status_drift.md) — żadna bramka nie pilnuje `status`; obecność testu przy ID nie dowodzi każdego kryterium acceptance.
- [Brak kont innych niż admin](project_no_nonadmin_accounts.md) — potwierdzone 2026-08-26; luki RBAC audytor/monter są prewencyjne, ale risk zostaje HIGH.
- [Obiekty bazy poza migracjami](project_live_db_objects_outside_migrations.md) — available_combinations i buckety Storage żyją tylko na produkcji; SQL na nich wymaga osłony to_regclass.
- [Nieuruchomione migracje bezpieczeństwa](project_unapplied_security_migrations.md) — trzy pliki w repo, zero z nich na żywej bazie; plik dowodzi intencji, nie stanu serwera.
- [Weryfikacja premisy przed baseline](feedback_verify_premise_before_baseline.md) — „wszystko w testach" bywa nieścisłe; rozbijam deltę per plik przed --update-baseline.
- [Ziarnistość ID wymagań](feedback_requirement_id_granularity.md) — jedno ID na encję obejmujące create i update, podział po encji, nie po operacji.
