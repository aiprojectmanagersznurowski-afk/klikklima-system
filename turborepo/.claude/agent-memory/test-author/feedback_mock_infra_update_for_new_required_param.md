---
name: feedback-mock-infra-update-for-new-required-param
description: How to mechanically update pre-existing test files' mocks when a GREEN wave adds a mandatory reason/actor-identity param to a Server Action, without touching test intent
metadata:
  type: feedback
---

When a GREEN wave (e.g. `SEC-AUDIT-LOG-MANUAL-STATUS`) changes an existing Server Action's
signature to add a mandatory `reason: string` param and a `getCurrentUser()` actor-email check
(fail-closed) plus a `tx.auditLog.create` inside the existing `$transaction`, two categories of
pre-existing tests break for two *different* reasons — fix only what's actually broken:

**Denial-path tests (role gate, fail-closed-on-role, fail-closed-on-role-query-error)** — these
return *before* reaching the email check or reason parsing. They only need the call site updated
to pass a second string argument (any string, since it's never validated on this path) — no mock
setup changes. Do not add `getCurrentUserMock` overrides or `auditLog` expectations to these
tests; that would blur what they actually prove ([[feedback_delete_action_wave_pattern]] — same
principle of not duplicating audit assertions into role-gate test files, which already exists as
`sec-audit-log-manual-status-wave-b.test.ts` and must stay the only place asserting audit-log
content).

**Positive-path tests (role allowed, full successful action)** — these actually reach the new
checks and need three additions: (1) call site gets a real reason string >=10 chars trimmed
(`deleteJustificationSchema.shape.justification`, min length is a literal duplicating a DB CHECK
constraint, not exposed via the contract yet), (2) `getCurrentUserMock.mockResolvedValue({ data:
{ user: { email: '...' } } })` set locally in that test/beforeEach (keep the file's existing
fail-closed default of `{ data: { user: null } }` everywhere else), (3) the fake `tx` object
built by the test's own `makeTx()`/`makeTxImplementation()` helper needs an `auditLog: { create:
auditLogMock }` key added — its absence throws `tx.auditLog.create is not a function` inside the
mocked `$transaction` callback, which manifests as `{ success: false }` from the action's own
try/catch, i.e. a real (if slightly indirect) RED, not a broken-test RED.

**How to apply:** grep the target action file's new implementation for `getCurrentUser` and
`tx.auditLog.create` to find exactly which functions changed shape, then check each existing test
file's `beforeEach` blocks per-`describe` (not just the top of the file) — signature changes
often land in a `describe`-scoped `beforeEach` that a different `describe` block for a sibling
function reset separately and therefore needs the same fix duplicated, not shared.
