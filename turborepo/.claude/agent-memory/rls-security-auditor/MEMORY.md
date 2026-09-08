# Memory Index — rls-security-auditor

- [Baseline RLS wszedł do repo](project_rls_state_not_in_vcs.md) — 18/18 tabel od 2026-08-24; caveat: RLS nie chroni ścieżki Prisma (brak FORCE).
- [Weryfikacja wykonaniem — jak i czym](feedback_audit_execution_constraints.md) — zakaz zapisu i mutowania plików repo, `node --eval`, pułapka vacuous pass.
- [Testy mutacyjne bez zapisu do repo](feedback_mutation_testing_in_memory.md) — przepis w pamięci + listy mutantów dla bramki roli i dla minimalizacji danych (`select`/kształt).
- [Wykonanie polityki RLS jako konkretna rola](feedback_rls_probe_as_role.md) — Prisma `$queryRawUnsafe` + `SET LOCAL ROLE` + JWT claims w wycofanej transakcji; SQL JEDNAK jest dostępny.
- [SEC-RLS-AUDITOR-SCOPE — stan po rundzie 2](project_auditor_scope_unimplemented.md) — lista, karta `/leads/[id]`, `is_active` i `/logistics` zamknięte; otwarte tylko AC10.
- [Brak UNIQUE na email pracowników w żywej bazie](project_email_unique_drift.md) — findUnique po e-mailu = LIMIT 1 i dowolny wiersz; używaj findMany+take:2.
- [Karta klienta /customers/[id] bez bramki](project_customer_card_ungated.md) — pełne PII dla każdej roli, łańcuch: audytor → getLeadDetail → klient.id → karta.
- [Nigdy nie pisz do żywej bazy](feedback_never_write_live_db.md) — nawet w transakcji z ROLLBACK; "wycofana transakcja" z [[feedback-rls-probe-as-role]] dotyczy wyłącznie SELECT-a predykatu, nie prawdziwego zapisu
- [Styl raportu z audytu](feedback_audit_reporting_style.md) — dowód wykonania zamiast lektury, zero naciąganych „ryzyk"
- [Stan audit_log na żywej bazie](project_audit_log_live_state.md) — tabela/CHECK-i/trigger istnieją; rejestr wymagań był nieaktualny, już poprawiony
- [SEC-AUDIT-LOG-MANUAL-STATUS Wave C audit](sec-audit-log-manual-status-wave-c.md) — advanceLeadStatus reviewed clean, K2/audit-atomicity/TOCTOU all hold, known rollback-slot debt confirmed non-security.
- [Project conventions for this audit family](project-sec-audit-log-manual-status.md) — how contract-driven manual-status classification (K1-K4) works across advanceLeadStatus/bypassLogisticsOrder/rollbackLogisticsOrder.
- [SEC-AUTHZ-DEFAULT-ROLE audit](project_sec_authz_default_role_audit.md) — werdykt NISKIE, DROP DEFAULT+CHECK poprawne, addAuthorizedUser waliduje niezależnie od stanu migracji, niezaaplikowanie na prod nie jest nowym ryzykiem.
- [notification_queue bez anonimizacji RODO](project_notification_queue_rodo_gap.md) — Faza C LOGISTICS-SHIPPING-EFFECTS musi zamknąć retencję PII w payload/recipient_address zanim popłynie tam realny e-mail/telefon klienta.
