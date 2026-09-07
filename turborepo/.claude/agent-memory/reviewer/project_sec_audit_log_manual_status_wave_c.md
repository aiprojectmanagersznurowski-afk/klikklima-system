---
name: project_sec_audit_log_manual_status_wave_c
description: SEC-AUDIT-LOG-MANUAL-STATUS Fala C (advanceLeadStatus, 14 przejść) reviewed clean 2026-09-07 — PRZEPUSZCZAM, no blockers; what was learned from prior waves' feedback
metadata:
  type: project
---

Fala C of `SEC-AUDIT-LOG-MANUAL-STATUS` (`advanceLeadStatus` in
`apps/b2b-web/src/app/(dashboard)/leads/actions.ts`) reviewed 2026-09-07,
PRZEPUSZCZAM, no blockers. This wave visibly incorporated fixes from prior review
feedback (see [[feedback_toctou_mock_sequencing]], [[project_can_gate_untested]]):

- `FOR UPDATE` lock (`tx.$queryRaw`) is correctly placed as the FIRST statement
  inside `$transaction`, before `tx.leady.findUnique`. Unlike the Wave B
  `bypassLogisticsOrder` regression and the still-open `rollbackLogisticsOrder`
  gap ([[project-rollback-read-committed-race]]), this wave's test
  (`sec-audit-log-manual-status-wave-c.test.ts`, "AC8 — blokada wiersza...")
  actually asserts `invocationCallOrder` of the lock call vs. findUnique/update/
  auditLog.create — a real, mutation-resistant proof, not just a
  `Promise.all`+`mockResolvedValueOnce` artifact. There IS also a
  `Promise.all` "two concurrent calls" test, but its own comment explicitly
  disclaims it as evidence of the lock ("NIE dowód istnienia blokady per se") and
  defers to the invocationCallOrder test — exactly the discipline the earlier
  TOCTOU feedback asked for.
- K2 (contract-unknown transition, `AWAITING_AUDIT -> NEW_LEAD`) is a hard denial:
  removed entirely from the local `ALLOWED_TRANSITIONS` map (not special-cased),
  confirmed rejected even with a valid justification/legalBasis input, zero writes.
  `findTransitionByFromTo` (new helper) returns `undefined` on no match (not
  throw) — correctly differing in error semantics from `isManualStatusChange`
  (which throws fail-loud on an unknown transition ID). Because the local map
  already excludes this pair, the `findTransitionByFromTo` check is currently a
  defensive no-op for this specific case (all 14 local pairs do resolve against
  contract `TRANSITIONS`, confirmed by a positive-control test) — it's a
  safety net against future local-map/contract drift, not dead code to flag.
- `can()` and `getCurrentUser()` are both wrapped in try/catch from the top of the
  function (checked the whole function, not just the diff hunk) — the exact
  blindspot flagged in two previous waves did NOT recur here.
- T02 (`AWAITING_AUDIT -> AUDIT_COMPLETED`, actor AUDITOR, trigger AUTO_TRANSITION)
  was missing from the WO's 13-row table; `test-author` found it via mechanical
  classification (K1: actor AUDITOR not in {ADMIN,DISPATCHER}) and treated it
  identically to every other manual transition in `describe.each` — no special
  casing, confirmed correct.
- Known, deliberately-unfixed defect confirmed still true and still just audited
  (not silently fixed nor silently ignored): `advanceLeadStatus -> ROLLBACK_RESCHEDULING`
  does not call `releaseCrewSlot`/`suspendLogisticsSla` (unlike
  `rollbackLogisticsOrder`), but the audit log entry is still created independently
  of those effects — test explicitly documents this as out-of-scope debt.
- Minor observation, not blocking: `actorEmail` (via `getCurrentUser()`) is now
  resolved unconditionally for EVERY transition (even non-manual T01), not only
  when the classified transition turns out to be manual. This is a new fail-closed
  dependency that didn't exist before this diff for normal transitions — a
  conservative choice (extra DB/session round-trip, no security downside), worth
  a MINOR note but not worth blocking.
- `ALLOWED_TRANSITIONS` in this file still duplicates the funnel state machine
  instead of calling `canTransition` from `@klikklima/contracts` — this is
  PRE-EXISTING (not introduced by this diff) and is explicitly documented in a
  code comment as out-of-scope with a dedicated future requirement ID
  (`FNL-ADVANCE-STATUS-CONTRACT-BOUND`). Treat as MAJOR carry-forward across
  future waves touching this file, same pattern as the untested `can()` gate
  linkage issue — don't block a single WO on a documented, ticketed, pre-existing
  architecture debt.

**How to apply:** if a future Fala D/E touches `advanceLeadStatus` again, check
whether `FNL-ADVANCE-STATUS-CONTRACT-BOUND` has been opened/resolved, and whether
the `actorEmail`-always-resolved pattern was intentionally kept or narrowed to
manual-only. Also worth checking: this file (`leads-status-gates.test.ts`) needed
a matching `$transaction` fake in its `vi.mock('@repo/database', ...)` — a good
signal to grep for whenever any Server Action gets wrapped in a new
`$transaction` for audit purposes, since every pre-existing test file mocking
that action's Prisma surface needs the same fake-tx update or it fails with
"$transaction is not a function", not a meaningful assertion failure.

Powiązane: [[project_sec_audit_log_manual_status_wave_a]],
[[feedback_toctou_mock_sequencing]], [[project-rollback-read-committed-race]],
[[project_can_gate_untested]].
