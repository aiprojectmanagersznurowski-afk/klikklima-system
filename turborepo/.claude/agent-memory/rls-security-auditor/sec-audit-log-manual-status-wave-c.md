---
name: sec-audit-log-manual-status-wave-c
description: Audit findings for advanceLeadStatus rewrite (SEC-AUDIT-LOG-MANUAL-STATUS Wave C) — verdict NISKIE, no bypass found
metadata:
  type: project
---

Audited 2026-09-04: `advanceLeadStatus` in `apps/b2b-web/src/app/(dashboard)/leads/actions.ts`
(uncommitted at time of audit, working tree diff vs HEAD `301edb8`), plus the new helper
`apps/b2b-web/src/lib/audit/find-transition-by-from-to.ts` and test file
`apps/b2b-web/tests/sec-audit-log-manual-status-wave-c.test.ts`.

Verdict: **NISKIE** (no critical/high findings). `npx tsc --noEmit` clean, `npx vitest run
--no-file-parallelism` → 76 files / 1334 tests passed.

Verified line-by-line:
- Role gate `can(actorRole,'leads','update')==='yes'` is the literal first check, before
  `getCurrentUser()`, before `$transaction`, before `$queryRaw`/`findUnique`. Confirmed no
  Prisma call happens for a denied role (test suite proves `findUnique` never called).
- `actorEmail`/`actorRole` always sourced from `getCurrentActorRole()`/`getCurrentUser()`
  (server session) — never from the `input` param. `deleteJustificationSchema` only exposes
  `justification`/`legalBasis`, no identity fields possible to inject.
- Row lock ordering: `SELECT ... FOR UPDATE` on `leady` runs first inside `tx`, before the
  `findUnique` that feeds `ALLOWED_TRANSITIONS`/`isManualStatusChange` decisions — no TOCTOU.
- Manual-transition audit atomicity: `isManual` is computed from `transition.id` (from
  contract, not from `input`); if `isManual` and `deleteJustificationSchema.safeParse(input)`
  fails, the function `throw`s *before* `tx.leady.update` — so there is no code path where
  `tx.leady.update` commits for a manual transition without a matching `tx.auditLog.create`
  in the same transaction. Checked all 14 (from,to) pairs in `ALLOWED_TRANSITIONS`
  (T01-T14 minus removed AWAITING_AUDIT→NEW_LEAD) including T02 (gap flagged by test-author,
  classified manual via K1 since actor AUDITOR has no `manualEquivalent`) and T10-T13
  (all manual via K3 bucket-edge, actor irrelevant).
- K2 hard-deny: `AWAITING_AUDIT → NEW_LEAD` removed from `ALLOWED_TRANSITIONS`; local-map
  check fires first (before the contract `findTransitionByFromTo` lookup), so K2's
  contract-lookup deny is currently *dead code* for this specific pair — but remains a
  legitimate defense-in-depth net for any future edit that re-adds a pair to the local map
  without a matching contract transition. Order does not leak extra info (both denials are
  generic strings, no distinction observable pre/post role gate since role gate is always
  first).
- Normal-transition input handling: for transitions where `isManualStatusChange` is false,
  `input` is parsed/read nowhere — confirmed no path where a crafted `input` on a
  "normal" transition changes classification or bypasses anything (classification depends
  only on `transition.id` derived from `currentStatus`/`targetStatus`, not from `input`).
- Cross-path consistency (`advanceLeadStatus` vs `bypassLogisticsOrder`/`rollbackLogisticsOrder`
  in `apps/b2b-web/src/app/(dashboard)/logistics/actions.ts`): both paths to
  HARDWARE_IN_WAREHOUSE→AWAITING_INSTALLATION (T07) and to ROLLBACK_RESCHEDULING (T10-T13)
  always write `tx.auditLog.create` — neither is a "weaker sibling" that skips the audit
  requirement. `advanceLeadStatus` actually requires *more* (operator-selected `legalBasis`
  from `AUDIT_REQUIREMENTS.legalBases`) vs. the logistics actions hardcoding `legalBasis:
  'OTHER'` — a stricter, not weaker, requirement.
- Known documented defect confirmed non-worsened: `advanceLeadStatus → ROLLBACK_RESCHEDULING`
  does not call `releaseCrewSlot`/`suspendLogisticsSla` (`logistics/rollback-effects.ts`),
  unlike `rollbackLogisticsOrder`. This leaves `instalacje.status` as `PLANNED` with
  `zespol_id` still set, and `data_rezerwacji`/`logistics_sla_paused_at` untouched — an
  operational data-integrity/scheduling debt (crew slot looks reserved, SLA clock keeps
  running), but does **not** skip the audit-log write and does **not** create any new
  authorization or audit bypass. Purely operational, as already documented in code comments
  and Wave-C test file.

No RLS/Supabase surface touched by this Wave (Prisma-only, B2B panel) — role authorization is
entirely code-enforced per [[rls-security-auditor]] threat model (Prisma bypasses RLS).
