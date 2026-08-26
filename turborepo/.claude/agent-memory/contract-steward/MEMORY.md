# Pamięć agenta: contract-steward

- [Blokada zapisu do contracts/](project_contract_write_blocker.md) — NAPRAWIONA 2026-08-19; zapis przyczyny i naprawy na wypadek regresji guard-paths.
- [Dług na regułach absolutnych w pre-commit](project_precommit_absolute_debt.md) — po naprawie baseline zostały as-any i green-sla; jedyny powód --no-verify.
- [Semantyka statusu BLOCKED](project_blocked_status_semantics.md) — co znaczy BLOCKED w rejestrze wymagań i dlaczego walidator ma stałe ostrzeżenia R16 (dziś 5).
- [Żywotność reguł bramki](feedback_gate_rule_liveness.md) — nowa reguła walidatora zawsze ze stałą mutacją w kk-selftest, zakres szeroki, dowodem jest komunikat.
- [Baseline nazewnictwa przy migracjach](project_naming_baseline_on_migrations.md) — każda migracja na polskich tabelach blokuje pre-commit; baseline aktualizuje człowiek.
- [Incydent: RLS wyłączone na żywej bazie](project_rls_disabled_incident.md) — 16/18 tabel bez RLS, anon z pełnymi prawami; migracja SEC-RLS-BASELINE napisana, nieuruchomiona.
- [Luka w pokryciu bramki uprawnień](project_authz_gate_coverage_gap.md) — poprawna macierz RBAC przy kodzie, który jej nie czyta; od 2026-08-26 wykrywa to kk-authz-gate.mjs.
- [Obiekty bazy poza migracjami](project_live_db_objects_outside_migrations.md) — available_combinations żyje tylko na produkcji; SQL na takich obiektach wymaga osłony to_regclass.
