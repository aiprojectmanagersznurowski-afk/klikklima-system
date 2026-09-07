---
name: project-sec-audit-log-manual-status
description: How the SEC-AUDIT-LOG-MANUAL-STATUS classification (K1-K4) and its three waves fit together across leads/logistics actions
metadata:
  type: project
---

`SEC-AUDIT-LOG-MANUAL-STATUS` requirement rolled out in three waves across the B2B panel,
splitting audited manual status changes from normal contract-driven ones:

- Wave A: `archiveLost`, `returnToFunnel` in `apps/b2b-web/src/app/(dashboard)/leads/actions.ts`.
- Wave B: `bypassLogisticsOrder`, `rollbackLogisticsOrder` in
  `apps/b2b-web/src/app/(dashboard)/logistics/actions.ts`.
- Wave C: `advanceLeadStatus` (same leads/actions.ts) — rewritten from a single
  `prisma.leady.update` (no transaction, no audit) into `$transaction` + row lock (`SELECT
  ... FOR UPDATE`) + per-transition classification.

Classification lives in `apps/b2b-web/src/lib/audit/manual-status-classifier.ts`
(`isManualStatusChange`), driven *only* by `@klikklima/contracts` `TRANSITIONS`/`STATE_META`
(never a hand-maintained action-name list). Four independent criteria, any one true → manual:
- K1: transition actor is not ADMIN/DISPATCHER, unless `transition.manualEquivalent === true`
  (e.g. T08 `markDelivered`, actor SYSTEM/webhook, has a legit manual-confirm path that isn't
  meant to require justification).
- K2: (lives in the calling action, not the classifier) — transition not found in contract at
  all → hard deny, zero write, zero audit row. Decision 2026-09-04: this is a contract gap,
  not a legal manual exception.
- K3: either endpoint's `STATE_META.kind === 'BUCKET'` (any move into/out of QUOTE_REJECTED /
  ROLLBACK_RESCHEDULING / ARCHIVED_LOST is always manual, regardless of actor).
- K4: `transition.override === true` (currently only T07 `deliverWithCrew`).

`advanceLeadStatus` doesn't know the contract `action` name, only `targetStatus`, so it uses
a from/to lookup helper (`find-transition-by-from-to.ts`) instead of the contract's own
`findTransition(from, action)`.

Known, explicitly out-of-scope defect: `advanceLeadStatus` is not a full state machine — it
doesn't run contract guards (e.g. `slotAvailable` on T14) or effects
(`releaseCrewSlot`/`suspendLogisticsSla` on rollback transitions). Tracked separately as
`FNL-ADVANCE-STATUS-CONTRACT-BOUND`. See [[sec-audit-log-manual-status-wave-c]] for the audit
confirming this doesn't create a security bypass, only operational debt.
