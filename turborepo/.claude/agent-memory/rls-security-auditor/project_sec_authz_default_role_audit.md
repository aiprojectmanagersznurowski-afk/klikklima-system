---
name: project_sec_authz_default_role_audit
description: Audit wyniku SEC-AUTHZ-DEFAULT-ROLE (schema.prisma DROP @default("admin") + migracja DROP DEFAULT + CHECK, niescommitowana/niezaaplikowana na żywej bazie) — werdykt NISKIE, brak luk.
metadata:
  type: project
---

Audyt 2026-09-07, working tree niescommitowany. Zakres: usunięcie `@default("admin")` z `AuthorizedUser.role` w `packages/database/prisma/schema.prisma`, nowa migracja `supabase/migrations/20260907173000_security_authorized_user_role_no_default.sql` (DROP DEFAULT + CHECK `authorized_user_role_check` zgodny z `ROLES` z `contracts/rbac.contract.mjs`), nowy test statyczny `apps/b2b-web/tests/sec-authz-default-role-migration-static.test.ts`.

Werdykt: NISKIE. Jedyny punkt zapisu do `AuthorizedUser` poza migracjami to `addAuthorizedUser` (`apps/b2b-web/src/app/(dashboard)/settings/actions.ts:19-50`) — waliduje `role` przeciw `ROLES` PRZED `prisma.authorizedUser.create`, bramka RBAC przed zapytaniem. `updateAuthorizedUserRoleAction` waliduje `nextRole` przez `roleChangeSchema` (`z.enum(ROLES)`) — również niezależnie od stanu migracji. Żaden kod nie zakłada nowego zachowania bazy przed wdrożeniem migracji — brak fałszywego poczucia bezpieczeństwa.

Migracja jest poprawna technicznie: `ALTER COLUMN role DROP DEFAULT` (idempotentne, no-op bez defaultu) + `CONSTRAINT ... CHECK (role IN (...))` — Postgres CHECK obowiązuje na INSERT i UPDATE domyślnie, nie ma tu żadnej sztuczki ograniczającej do INSERT. Wzorzec zgodny z precedensem `audit_log_operation_check`/`audit_log_resource_check`.

Migracja `20260901120000_security_revoke_authorized_user_writes.sql` już wcześniej odebrała `INSERT/UPDATE/DELETE/TRUNCATE` na `AuthorizedUser` dla `anon`/`authenticated` — potwierdza, że jedyna żywa ścieżka zapisu to `service_role` (Prisma), czyli teoretyczny trigger Supabase Auth z WO faktycznie nie istnieje dziś — to pozytywne uzasadnienie migracji jako obrony na przyszłość, nie łatanie istniejącej dziury.

Fakt niezaaplikowania migracji na produkcji NIE jest nowym ryzykiem — `DEFAULT 'admin'` istniał od `baseline.sql`, stan produkcji się nie pogorszył przez samo napisanie plików. Plik migracji ma jawny, wielokrotnie powtórzony nagłówek ostrzegawczy (nie traktować jako dowodu wdrożenia) i test statyczny explicite dokumentuje w komentarzu, że sprawdza TREŚĆ pliku, nie stan serwera — brak pułapki vacuous pass, patrz [[feedback_audit_execution_constraints]].

Sprawdzone i zamknięte: AC1 (brak `@default` w schema.prisma), AC2 (addAuthorizedUser niezmieniony, walidacja aplikacyjna przed migracją i po — nieregresja), AC3 (CHECK zgodny z ROLES, DROP DEFAULT obejmuje NOT NULL bez zmiany), AC4 (weryfikacja żywej bazy już wykonana wcześniej w tej samej sesji WO, 4 wiersze z sensownymi rolami — nie do powtórzenia przez ten audyt).
