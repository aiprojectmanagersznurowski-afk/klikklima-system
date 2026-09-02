---
name: unapplied-security-migrations
description: Wzorzec pracy dla migracji, których obecność w repo nie dowodzi zastosowania — historia pięciu migracji tej sesji, wszystkie już zweryfikowane jako URUCHOMIONE na żywo (stan na 2026-09-02)
metadata:
  type: project
---

**AKTUALIZACJA 2026-09-02: wszystkie pięć migracji z tej notatki zostało uruchomionych na żywej
bazie i zweryfikowanych bezpośrednim zapytaniem (nie tylko lekturą pliku).** Ta notatka opisuje
teraz WZORZEC do stosowania przy KOLEJNYCH migracjach bezpieczeństwa/schematu, nie aktualny stan
zaległości — nie zakładaj, że którakolwiek z wymienionych niżej wciąż czeka.

Historia (wszystkie potwierdzone jako zastosowane):

- `20260824185845_security_enable_rls_baseline.sql` — RLS włączone (potwierdzone `pg_class.relrowsecurity`)
- `20260901120000_security_revoke_authorized_user_writes.sql` — REVOKE zastosowany (potwierdzone `information_schema.role_table_grants`)
- `20260901120100_security_knowledge_base_buckets_private.sql` — buckety `public=false` (potwierdzone `storage.buckets`, curl na trzech podpisanych URL-ach z `apps/b2c-web/lib/articles.ts` → 200)
- `20260901210000_logistics_sla_paused_at.sql` — kolumna `leady.logistics_sla_paused_at` istnieje (potwierdzone `information_schema.columns`)
- `20260901220000_rodo_audit_log_and_client_anonymization.sql` — tabela `audit_log` istnieje z poprawnymi CHECK-ami, wyzwalaczem `audit_log_append_only_trg` (zweryfikowany transakcją z wymuszonym rollbackiem — UPDATE poprawnie odrzucony, zero wiersza testowego pozostałego), RLS włączone, `klienci.anonymized_at` istnieje

**Why:** obecność pliku migracji w repo dowodzi INTENCJI, nie STANU SERWERA. Raz pomylono te dwie
rzeczy (RLS baseline), stąd wymóg jawnej ramki `NIE ZOSTAŁA URUCHOMIONA` w nagłówku każdej nowej
migracji dopóki człowiek nie da zgody, i zawsze osobnej listy w podsumowaniu tury: „wymaga zgody na
żywe uruchomienie" z pełnymi ścieżkami — nigdy nie raportuj migracji jako „naprawione" na podstawie
samego commita.

**How to apply przy kolejnej migracji:** (1) nagłówek z ramką ostrzegawczą + sekcja weryfikacji
manualnej na dole pliku; (2) po uzyskaniu zgody człowieka — uruchomienie przez skrypt z rozbiorem
instrukcji SQL (dollar-quoting, komentarze, cudzysłowy), zawsze `--dry-run` najpierw; (3) weryfikacja
bezpośrednim zapytaniem do bazy, NIE tylko `exit 0` skryptu; (4) dla append-only tabel — test triggera
przez `$transaction` z wymuszonym rzuceniem błędu na końcu (rollback), nigdy przez INSERT+DELETE
(DELETE zostanie odrzucony przez sam trigger, zostawiając trwały wiersz-śmieć w tabeli, której z
definicji nie da się już wyczyścić); (5) skrypty pomocnicze (`run-migration.mjs`, `verify-*.mjs`)
zawsze usuwane po użyciu, nigdy nie commitowane.

Powiązane: [[live-db-objects-outside-migrations]], [[naming-baseline-on-migrations]].
