# Memory Index — rls-security-auditor

- [Baseline RLS wszedł do repo](project_rls_state_not_in_vcs.md) — 18/18 tabel od 2026-08-24; caveat: RLS nie chroni ścieżki Prisma (brak FORCE).
- [Weryfikacja wykonaniem — jak i czym](feedback_audit_execution_constraints.md) — zakaz zapisu i mutowania plików repo, `node --eval`, pułapka vacuous pass.
- [Testy mutacyjne bez zapisu do repo](feedback_mutation_testing_in_memory.md) — przepis w pamięci + listy mutantów dla bramki roli i dla minimalizacji danych (`select`/kształt).
- [Wykonanie polityki RLS jako konkretna rola](feedback_rls_probe_as_role.md) — Prisma `$queryRawUnsafe` + `SET LOCAL ROLE` + JWT claims w wycofanej transakcji; SQL JEDNAK jest dostępny.
- [SEC-RLS-AUDITOR-SCOPE — stan po rundzie 2](project_auditor_scope_unimplemented.md) — lista, karta `/leads/[id]`, `is_active` i `/logistics` zamknięte; otwarte tylko AC10.
- [Nigdy nie pisz do żywej bazy](feedback_never_write_live_db.md) — nawet w transakcji z ROLLBACK; "wycofana transakcja" z [[feedback-rls-probe-as-role]] dotyczy wyłącznie SELECT-a predykatu, nie prawdziwego zapisu
