# Pamięć agenta: contract-steward

- [Blokada zapisu do contracts/](project_contract_write_blocker.md) — NAPRAWIONA 2026-08-19; zapis przyczyny i naprawy na wypadek regresji guard-paths.
- [Dług na regułach absolutnych w pre-commit](project_precommit_absolute_debt.md) — po naprawie baseline zostały as-any i green-sla; jedyny powód --no-verify.
- [Semantyka statusu BLOCKED](project_blocked_status_semantics.md) — co znaczy BLOCKED w rejestrze wymagań i dlaczego walidator ma odtąd 7 stałych ostrzeżeń R16.
- [Żywotność reguł bramki](feedback_gate_rule_liveness.md) — nowa reguła walidatora zawsze ze stałą mutacją w kk-selftest, zakres szeroki, dowodem jest komunikat.
