---
name: project_sec_authz_default_role_registered
description: SEC-AUTHZ-DEFAULT-ROLE zamknięte 2026-09-07 — migracja uruchomiona i zweryfikowana na żywej bazie
metadata:
  type: project
---

SEC-AUTHZ-DEFAULT-ROLE (AuthorizedUser.role bez `@default("admin")` fail-open) przeszło TODO → DONE 2026-09-07.
Migracja `20260907173000_security_authorized_user_role_no_default.sql` (commit `02738c3`) URUCHOMIONA na żywej bazie
produkcyjnej za jawną zgodą człowieka i zweryfikowana bezpośrednim zapytaniem (nie tylko treścią pliku):
`information_schema.columns` → `is_nullable='NO'`, `column_default=NULL`; `pg_constraint` →
`authorized_user_role_check` obecny z `CHECK (role IN ('admin','dyspozytor','audytor','monter'))`; 4 istniejące konta
niezmienione.

**Why:** AC3 w rejestrze wymagań pozostawiało otwartą decyzję "CHECK w tej samej migracji czy osobne zadanie" —
rozstrzygnięto: CHECK dodany w tej samej migracji, wzorem `audit_log_operation_check`/`audit_log_resource_check`.
Banner ostrzegawczy w pliku migracji zmieniony z "NIE URUCHOMIONA" na potwierdzenie uruchomienia + wynik weryfikacji.

**How to apply:** Wzorzec analogiczny do [[project_unapplied_security_migrations]] — po realnym zastosowaniu migracji
na produkcji ZAWSZE przepisz banner w pliku SQL (nie tylko `status` w kontrakcie), bo mylący banner szkodzi w obie
strony (fałszywe bezpieczeństwo albo fałszywy alarm). Ryzyko manualnej synchronizacji CHECK z `rbac.contract.mjs`
`ROLES` zaakceptowane świadomie i nie jest nowym typem długu (ten sam wzorzec co audit_log).
