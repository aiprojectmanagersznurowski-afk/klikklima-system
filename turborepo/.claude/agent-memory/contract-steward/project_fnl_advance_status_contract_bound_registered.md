---
name: project_fnl_advance_status_contract_bound_registered
description: FNL-ADVANCE-STATUS-CONTRACT-BOUND registered 2026-09-07 — advanceLeadStatus's local ALLOWED_TRANSITIONS map bypasses all funnel guards/effects; risk MEDIUM, decisions deferred to WO
metadata:
  type: project
---

Registered `FNL-ADVANCE-STATUS-CONTRACT-BOUND` in `contracts/requirements.contract.mjs`, status TODO, domain funnel, risk MEDIUM. This closes the "osobne, jeszcze niezarejestrowane ID" debt promised in [[project_crews_admin_gates_closed]]'s sibling wave — the SEC-AUDIT-LOG-MANUAL-STATUS entry (2026-09-04) explicitly deferred fixing `advanceLeadStatus`'s state-machine structure, only auditing its existing behavior.

**The actual bug** (confirmed in code 2026-09-07): `apps/b2b-web/src/app/(dashboard)/leads/actions.ts` `advanceLeadStatus` (lines 648-765) has a hand-maintained `ALLOWED_TRANSITIONS` map (lines 606-627) that is the SOLE gate deciding whether a transition is written (line 697-703). It calls `findTransitionByFromTo` (line 711) against `contracts/funnel.contract.mjs`, but ONLY to classify the transition for audit logging (`isManualStatusChange`, line 718) — it never reads or executes `guards` or `effects` from the contract transition object. Concretely: T03/T14 `slotAvailable` guard never checked; T10-T13 rollback `effects` (`do:releaseCrewSlot`, `do:suspendLogisticsSla`, `N_ROLLBACK`) never invoked from this function (they only exist wired up in `logistics/actions.ts`); T02 `do:createQuote`/`do:startQuoteValidityClock` never invoked.

**Why MEDIUM not HIGH**: rls-security-auditor already evaluated the analogous rollback-effects gap (in SEC-AUDIT-LOG-MANUAL-STATUS Wave B) as "operational debt, not a security hole" — no RBAC bypass, no data leak, just process-state inconsistency (stale crew slot, unpaused SLA, possibly missing client SMS). Kept that precedent for consistency.

**Left explicitly undecided for the future Work Order** (do not resolve these yourself if you pick this up again):
(a) one big change vs. splitting into sub-requirements per transition/guard-category (mirroring the SEC-AUDIT-LOG DELETE/ROLE-CHANGE/MANUAL-STATUS split)
(b) whether guards touching external systems (slotAvailable today) can be checked synchronously inside the same Prisma transaction, or need a reservation/compensation pattern instead

Codegen ran clean, no schema/migration/RBAC changes needed (pure requirements-registry addition). See [[project_sec_audit_log_manual_status]] if that memory exists, otherwise cross-reference commit history around 2026-09-04 to 2026-09-07 for the SEC-AUDIT-LOG-MANUAL-STATUS wave context.
