---
name: rbac-capability-spy-when-roles-identical
description: How to prove a Server Action gates on a specific RBAC capability (e.g. `assign`) when that capability's role set is currently identical to another (e.g. `update`), so role-only tests can't distinguish them.
metadata:
  type: feedback
---

When a WO explicitly says "use capability X, not Y — verify in the contract file, don't guess"
(e.g. `contracts/rbac.contract.mjs`'s `bookings` resource has both `update: ['admin','dyspozytor']`
and `assign: ['admin','dyspozytor']` — identical role sets today), a test that only checks
allow/deny outcomes per role cannot prove which capability string the action actually passed to
`can()`. Both would produce the same pass/fail pattern.

**Pattern**: partially mock `@klikklima/contracts` with `importOriginal`, wrap `can` in a `vi.fn`
that records `{ role, resource, capability }` into an array before delegating to the real `can()`,
then assert `capability === 'assign'` (and NOT `'update'`) for calls where `resource === 'bookings'`.
This keeps the real permission semantics (so allow/deny still reflects the actual matrix) while
adding an independent assertion that would catch a future implementer typo'ing `'update'` for
`'assign'` — which today would otherwise be an invisible bug since the role sets match.

```ts
const canCalls: Array<{ role: unknown; resource: unknown; capability: unknown }> = [];
vi.mock('@klikklima/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klikklima/contracts')>();
  return {
    ...actual,
    can: vi.fn((role, resource, capability) => {
      canCalls.push({ role, resource, capability });
      return actual.can(role, resource, capability);
    }),
  };
});
```

**Why:** Used in `apps/b2b-web/tests/reassign-booking.test.ts` (FLD-BOOKING-ATOMIC-ASSIGN Faza B) —
the WO flagged this exact ambiguity and asked the test-author to verify rather than assume.
See [[feedback_conditional_audit_transaction_gate]] for a related "gate correctness beyond
allow/deny outcome" pattern.

**How to apply:** Reach for this whenever a WO calls out that two RBAC capabilities currently
resolve to the same role set for a resource, and insists the *correct* one is used — role-outcome
assertions alone are a weak RED/GREEN signal in that specific situation.
