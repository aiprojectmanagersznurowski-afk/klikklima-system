---
name: project_sec_authz_default_role_registered
description: SEC-AUTHZ-DEFAULT-ROLE domknięte 2026-09-07 — DROP DEFAULT + CHECK authorized_user_role_check, migracja NIE uruchomiona
metadata:
  type: project
---

`SEC-AUTHZ-DEFAULT-ROLE` (zarejestrowane 2026-09-07, commit `3217d4f`) zaimplementowane
w tej samej sesji jako WO `docs/workorders/SEC-AUTHZ-DEFAULT-ROLE.md`:

- `packages/database/prisma/schema.prisma`, `model AuthorizedUser.role` — usunięto
  `@default("admin")`. Kolumna była już `NOT NULL` od baseline, samo usunięcie defaultu
  wystarczyło (bez `SET NOT NULL`).
- Nowa migracja `supabase/migrations/20260907173000_security_authorized_user_role_no_default.sql`:
  `ALTER COLUMN role DROP DEFAULT` + `CONSTRAINT authorized_user_role_check CHECK (role IN
  ('admin','dyspozytor','audytor','monter'))`. Decyzja o CHECK podjęta przez człowieka
  (za, nie WO-analityka) — synchronizacja z `ROLES` w `rbac.contract.mjs` jest RĘCZNA,
  nic nie wykrywa dryfu automatycznie (ten sam typ długu co `audit_log_operation_check`).
- Migracja **NIE URUCHOMIONA** na żadnej bazie — plik ma standardową ramkę ostrzegawczą
  (wzorzec z `20260901120000_security_revoke_authorized_user_writes.sql`). Wymaga osobnej
  zgody człowieka przed `supabase db push`/`prisma migrate deploy`.
- `kk-validate`/`kk-selftest`/`kk-codegen --check` zielone bez zmian (schema.prisma i
  migracje nie są wejściem tych narzędzi). `npx prisma generate` + `tsc --noEmit` w
  `apps/b2b-web` i `apps/b2c-web` przeszły bez błędów.

Sąsiaduje z [[project_sec_last_admin_guard_registered]] (ten sam model `AuthorizedUser`,
inny mechanizm awarii: fail-open default vs. usunięcie ostatniego admina) i z
[[project_unapplied_security_migrations]] (kolejna migracja bezpieczeństwa czekająca
na zgodę — trzeba pamiętać o przeliczeniu do listy niezaaplikowanych).

**Why:** fail-open default na kolumnie decydującej o roli w całym panelu B2B = cicha
eskalacja uprawnień przy jakimkolwiek pominięciu kolumny `role` poza jedyną dziś chronioną
ścieżką `addAuthorizedUser`.

**How to apply:** przy przyszłej zmianie `ROLES` w `rbac.contract.mjs` pamiętaj, że
`authorized_user_role_check` (i `audit_log_resource_check`/`audit_log_operation_check`)
wymaga osobnej migracji ALTER — kk-codegen nie zasygnalizuje tego dryfu.
