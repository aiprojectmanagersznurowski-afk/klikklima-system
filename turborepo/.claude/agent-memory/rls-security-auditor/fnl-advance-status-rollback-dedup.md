---
name: fnl-advance-status-rollback-dedup
description: Audit of FNL-ADVANCE-STATUS-CONTRACT-BOUND Phase 1 — removal of T10-T13 duplicate rollback path from advanceLeadStatus, UI redirect to rollbackLogisticsOrder
metadata:
  type: project
---

Audited 2026-09-08 (uncommitted working tree vs HEAD `301edb8`): `apps/b2b-web/src/app/(dashboard)/leads/actions.ts`,
`leads-client.tsx`, new test `apps/b2b-web/tests/fnl-advance-status-rollback-dedup.test.ts`.

Verdict: **NISKIE**, one ŚREDNIE UX/audit-trail finding (not an authz bypass).

Confirmed:
- `ALLOWED_TRANSITIONS` in `leads/actions.ts` no longer lists `ROLLBACK_RESCHEDULING` as a
  target from any of the four source states (AWAITING_CREW_ASSIGNMENT, HARDWARE_IN_WAREHOUSE,
  HARDWARE_IN_TRANSIT, AWAITING_INSTALLATION). Local-map check (`!allowed.includes(targetStatus)`)
  fires *before* the K2 contract-lookup check, same pattern as the earlier
  AWAITING_AUDIT→NEW_LEAD hard-deny from Wave C — throw happens inside `$transaction` before
  `tx.leady.update`, so zero write / zero audit entry for any attempt.
- `ROLLBACK_RESCHEDULING: ["AWAITING_CREW_ASSIGNMENT"]` (T14, the *outgoing* edge) correctly
  retained — only the four *incoming* edges (T10-T13) were removed.
- `grep -rn "advanceLeadStatus.*ROLLBACK_RESCHEDULING"` across `apps/` (excluding tests/):
  zero production call sites remain; only a code comment references it.
- `leads-client.tsx`: the dropdown handler now branches on `action.target === "ROLLBACK_RESCHEDULING"`
  → opens `DeleteJustificationDialog` wired to `rollbackLogisticsOrder(leadId, values.justification)`
  imported directly from `../logistics/actions`, not re-implemented. This is the single branch
  point covering all four CONTEXT_ACTIONS entries that expose a Rollback menu item.
- `rollbackLogisticsOrder` itself (`logistics/actions.ts`) is untouched by this diff (confirmed
  via `git diff --stat`) — role gate (`leads.update` AND `shipments.update`), `FOR UPDATE` row
  lock, `legalBasis: 'OTHER'` hardcoded server-side (line ~409, comment at line ~175 confirms
  D4 variant (b): operator does not choose legalBasis) all match what was already audited
  earlier in session (see [[sec-audit-log-manual-status-wave-c]]).
- `deleteJustificationSchema.shape.justification` (trim + min 10) is what `rollbackLogisticsOrder`
  validates server-side — same schema object as client, no drift possible by construction.

Finding (ŚREDNIE, audit-trail fidelity, not authz):
`DeleteJustificationDialog` is a *shared* component that always renders a required "Podstawa
prawna" `<select>` bound to the full `deleteJustificationSchema` (including `legalBasis` enum),
and the submit button stays disabled until the operator picks one. But the new rollback wiring
in `leads-client.tsx` calls `onConfirm={(values) => rollbackLogisticsOrder(leadId, values.justification)}`
— `values.legalBasis` is silently dropped; the server always writes `legalBasis: 'OTHER'`
regardless of what the operator selected. Not exploitable (server-side hardcoding is the safe
direction), but the UI misleads the operator into believing their legal-basis choice is recorded
when it never reaches `audit_log`. Fix: either (a) make `DeleteJustificationDialog` accept a
`showLegalBasis?: boolean` prop and hide the select for rollback-only callers, or (b) thread
`values.legalBasis` through to a `rollbackLogisticsOrder` param and stop hardcoding `'OTHER'`
server-side. No test in `fnl-advance-status-rollback-dedup.test.ts` covers this mismatch.

Verified by execution, not just reading: `npx vitest run tests/fnl-advance-status-rollback-dedup.test.ts
tests/sec-audit-log-manual-status-wave-c.test.ts --no-file-parallelism` → 2 files / 61 tests passed.
