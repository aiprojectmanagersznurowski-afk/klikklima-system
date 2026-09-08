---
name: project_fnl_advance_status_contract_bound_registered
description: FNL-ADVANCE-STATUS-CONTRACT-BOUND registered 2026-09-07, status IMPLEMENTING since 2026-09-08 (Phase 1 closed, Phases 2/3 open) — advanceLeadStatus's local ALLOWED_TRANSITIONS map bypasses all funnel guards/effects; risk MEDIUM
metadata:
  type: project
---

**UPDATE 2026-09-08**: status raised TODO → IMPLEMENTING (not DONE). Phase 1 landed (commit `242e117`, WO `docs/workorders/FNL-ADVANCE-STATUS-CONTRACT-BOUND.md`): removed T10-T13 from the local `ALLOWED_TRANSITIONS` map in `advanceLeadStatus` and redirected the leads Kanban UI to `rollbackLogisticsOrder` instead — closed a real bug (two live, diverging rollback code paths, one with `releaseCrewSlot`/`suspendLogisticsSla` effects, one without). Verified: review PRZEPUSZCZAM, security audit NISKIE. Still open, unimplemented: `slotAvailable` guard on T03/T14, and `do:createQuote`/`do:startQuoteValidityClock` effect on T02 — this is the actual core of the original statement/acceptance (advanceLeadStatus reading ALL guards/effects from the contract, not just rollback). Phases 2 (T03/T14 guard) and 3 (T02 effect) are recommended by the WO as separate, future, still-unregistered requirements — deliberately not registered now because zero implementation exists in code to model against; would be guessing. Do not close this requirement to DONE until Phases 2/3 have their own IDs and are closed, or until a human deliberately narrows this requirement's acceptance to Phase 1 only.

Registered `FNL-ADVANCE-STATUS-CONTRACT-BOUND` in `contracts/requirements.contract.mjs`, status TODO, domain funnel, risk MEDIUM. This closes the "osobne, jeszcze niezarejestrowane ID" debt promised in [[project_crews_admin_gates_closed]]'s sibling wave — the SEC-AUDIT-LOG-MANUAL-STATUS entry (2026-09-04) explicitly deferred fixing `advanceLeadStatus`'s state-machine structure, only auditing its existing behavior.

**The actual bug** (confirmed in code 2026-09-07): `apps/b2b-web/src/app/(dashboard)/leads/actions.ts` `advanceLeadStatus` (lines 648-765) has a hand-maintained `ALLOWED_TRANSITIONS` map (lines 606-627) that is the SOLE gate deciding whether a transition is written (line 697-703). It calls `findTransitionByFromTo` (line 711) against `contracts/funnel.contract.mjs`, but ONLY to classify the transition for audit logging (`isManualStatusChange`, line 718) — it never reads or executes `guards` or `effects` from the contract transition object. Concretely: T03/T14 `slotAvailable` guard never checked; T10-T13 rollback `effects` (`do:releaseCrewSlot`, `do:suspendLogisticsSla`, `N_ROLLBACK`) never invoked from this function (they only exist wired up in `logistics/actions.ts`); T02 `do:createQuote`/`do:startQuoteValidityClock` never invoked.

**Why MEDIUM not HIGH**: rls-security-auditor already evaluated the analogous rollback-effects gap (in SEC-AUDIT-LOG-MANUAL-STATUS Wave B) as "operational debt, not a security hole" — no RBAC bypass, no data leak, just process-state inconsistency (stale crew slot, unpaused SLA, possibly missing client SMS). Kept that precedent for consistency.

**Left explicitly undecided for the future Work Order** (do not resolve these yourself if you pick this up again):
(a) one big change vs. splitting into sub-requirements per transition/guard-category (mirroring the SEC-AUDIT-LOG DELETE/ROLE-CHANGE/MANUAL-STATUS split)
(b) whether guards touching external systems (slotAvailable today) can be checked synchronously inside the same Prisma transaction, or need a reservation/compensation pattern instead

Codegen ran clean, no schema/migration/RBAC changes needed (pure requirements-registry addition). See [[project_sec_audit_log_manual_status]] if that memory exists, otherwise cross-reference commit history around 2026-09-04 to 2026-09-07 for the SEC-AUDIT-LOG-MANUAL-STATUS wave context.
