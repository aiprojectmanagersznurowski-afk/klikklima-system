---
name: project-sec-last-admin-guard-registered
description: SEC-LAST-ADMIN-GUARD registered 2026-09-07 to close the delete-path gap left by SEC-AUDIT-LOG-ROLE-CHANGE's narrow D3 protection
metadata:
  type: project
---

Registered new requirement `SEC-LAST-ADMIN-GUARD` in `contracts/requirements.contract.mjs` (status `TODO`, risk `HIGH`) during contract window 2026-09-07. It closes the gap explicitly flagged in SEC-AUDIT-LOG-ROLE-CHANGE's AC7: last-admin protection today exists only in `updateAuthorizedUserRoleAction` (apps/b2b-web/src/app/(dashboard)/settings/actions.ts:286, via `LastAdminError` sentinel + count-inside-Serializable-transaction). `deleteAuthorizedUser` (same file, :205) has zero such protection today — the sole admin account can be deleted, which locks the whole system out of role/settings management (both `authorized_users.update` and `.delete` are admin-only in `rbac.contract.mjs`).

**Why:** [[project_no_nonadmin_accounts]] context still applies (only admin accounts exist as of 2026-08-26) — this makes the delete-path gap a live risk, not theoretical.

**Open decision (deliberately left unresolved, for the human to decide in a Work Order):** whether the Server Action layer (count-before-delete inside the same Serializable transaction, mirroring the update path) is sufficient, or whether a hard Postgres-level guarantee (constraint/trigger blocking a DELETE that would reduce `COUNT(*) WHERE role='admin'` to zero) is also required. The 2026-09-04 note at SEC-AUDIT-LOG-ROLE-CHANGE said "requires migration" but that was written before the double-layer code protection existed, so it may no longer hold. I did not touch `schema.prisma` or `supabase/migrations/` — deliberately, per instructions.

**How to apply:** When a future contract window touches this ID, do not silently decide the migration question — it must stay an explicit human decision. If `deleteAuthorizedUser` gets a code fix, expect it to mirror `updateAuthorizedUserRoleAction`'s pattern almost exactly (count admins inside `$transaction({ isolationLevel: 'Serializable' })`, throw a sentinel error, catch only in that action's own catch block).
