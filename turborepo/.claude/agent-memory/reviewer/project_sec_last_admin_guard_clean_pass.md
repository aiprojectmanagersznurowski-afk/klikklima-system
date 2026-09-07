---
name: project_sec_last_admin_guard_clean_pass
description: SEC-LAST-ADMIN-GUARD (2026-09-07) — deleteAuthorizedUser admin-guard passed review clean; what was verified.
metadata:
  type: project
---

`deleteAuthorizedUser` (`apps/b2b-web/src/app/(dashboard)/settings/actions.ts:205-283`) got the last-admin
guard copied 1:1 from `updateAuthorizedUserRoleAction` (findUnique → conditional count → throw
`LastAdminError` → delete → auditLog.create, all inside one `$transaction(..., { isolationLevel:
'Serializable' })`). Reviewed 2026-09-07, no blockers.

**Why this one was clean:** implementer followed the WO's literal "wzorzec do skopiowania" instead of
inventing a new shape — same sentinel class reused (not duplicated), same message style, same
ordering. The 15 new tests in `sec-last-admin-guard.test.ts` use `invocationCallOrder` to prove
find→count→delete→auditLog ordering and prove `count` isn't called for non-admin targets (AC3 edge
case), not just "doesn't throw" checks. Fixture patches in the two pre-existing test files
(`sec-audit-log-delete-wave-a.test.ts`, `settings-authorized-users.test.ts`) default the mocked target
role to non-admin with `count` resolving to 2, which keeps those files' original assertions
(RBAC-gate "never queries the db" checks) intact rather than papering over them.

**How to apply:** if this pattern needs a third copy (e.g., some future bulk-delete), check that the
sentinel class stays singular (defined once, reused) — the WO explicitly flagged "nie tworzyć drugiej
[klasy] o tej samej semantyce" as a risk. The DB-trigger question was explicitly deferred to a human
decision and is out of scope for this WO — don't flag its absence as a gap in future reviews of this
same commit family, see [[project_last_admin_guard_deferred]] context in spec-analyst memory.
