---
name: feedback-conditional-audit-transaction-gate
description: How to diagnose/fix pre-existing test files when a Server Action starts conditionally wrapping update+auditLog.create in prisma.$transaction based on an existing-vs-submitted field diff (not a signature change)
metadata:
  type: feedback
---

Distinct from [[feedback_mock_infra_update_for_new_required_param]] (that one covers a
mandatory new *parameter*). This pattern covers a GREEN wave (e.g.
`FLD-AUDITOR-RADIUS-RENAME`, sibling `FLD-BASE-LOCATION-EDIT`) that adds a
`buildBaseLocationJustification(existing, values)` helper inside an existing
`updateXAction(id, formData)` — no signature change — which *conditionally* branches:
if two specific fields (e.g. `kod_pocztowy_bazowy`/`promien_dzialania_km`) differ between
the pre-fetched `existing` record and the parsed `values`, the action calls
`createClient().auth.getUser()` then `prisma.$transaction(tx => { tx.<model>.update(...);
tx.auditLog.create(...) })`; otherwise it calls `prisma.<model>.update(...)` directly, no
transaction, no createClient.

This silently breaks pre-existing test files for **two independent reasons**, and both
must be checked, not just the one implementer-server reports:

1. **Missing `createClient` export in the `../src/utils/supabase/server` mock.** If the
   test file's `vi.mock` only exports `getCurrentActorRole`/`getCurrentUser`, any test that
   accidentally triggers the audit branch throws (`createClient is not a function`) or gets
   `undefined` user, which manifests as an unrelated-looking assertion failure or thrown
   error, not a naming typo — still a legitimate RED, but diagnose it by grep-ing the
   production file for `createClient` before touching the mock.

2. **Stale fixture records missing the two gated fields entirely.** If a test file's
   `EXISTING_RECORD` fixture predates the two fields (e.g. omits
   `kod_pocztowy_bazowy`/`promien_dzialania_km` altogether) while the shared
   `buildFullFormData()` helper always sends concrete values for them, `undefined !==
   '02-100'` is `true` — so *every* test in that `describe` block (even ones about
   unrelated fields like email or checkboxes) now takes the transaction branch. The fix is
   to add the two fields to the fixture with values IDENTICAL to `buildFullFormData()`'s
   defaults, restoring "no diff, no transaction" for tests not about that field. Do this
   for EVERY sibling fixture in the file (e.g. a second `EXISTING_RECORD_WITH_DATES` used
   by a different `describe` block) — grep for all object literals matching the shape, not
   just the one named in the bug report.

**What NOT to do:** do not special-case the one test that legitimately changes the gated
field on purpose (e.g. `promien_dzialania_km: '' ` mapping to `null`, differing from
existing `50`) — that test *should* now take the transaction branch, and it will pass
automatically once the shared-mock design below is in place, because the assertion targets
the same mock fn regardless of path.

**Mechanical fix, mirrors `fld-base-location-edit-audit-log.test.ts`'s `sharedPrisma`
pattern:** build one plain object (e.g. `sharedCrewPrisma`) holding
`{ <model>: { create, update, findUnique }, auditLog: { create: auditLogCreateMock },
$transaction: transactionMock }`, return that SAME object reference from both the
`vi.mock('@repo/database', ...)` factory AND from `transactionMock.mockImplementation(cb =>
cb(sharedXPrisma))` (set once, at module scope, not reset per-test) — this makes
`<model>Update` assertions pass whether the action took the direct or transactional path,
without knowing which one ahead of time. Add `createClient: createClientMock` to the
supabase mock, with a stable module-scope default (`createClientMock.mockResolvedValue({
auth: { getUser: getUserMock } })`, `getUserMock.mockResolvedValue({ data: { user: {
email: 'admin@klikklima.pl' } } })`) — since no test in these *mapping/collision* files
asserts on audit-log *content*, a single stable default suffices; the dedicated audit-log
content test file (e.g. `fld-base-location-edit-audit-log.test.ts`) is the only place that
should assert `actorEmail`/`operation`/`justification` shape — don't duplicate that there.

**How to apply:** before touching either file, run the two allegedly-broken test files
together and read every failure message — count them against what the bug report claims,
and independently verify by reading the production action's diff-then-branch logic
(`grep -n "buildBaseLocationJustification\|\\$transaction\|createClient" actions.ts`)
rather than trusting the reported line numbers, which drift as the file changes.
