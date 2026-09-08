---
name: project-logistics-shipping-effects-all-four-done
description: WO LOGISTICS-SHIPPING-EFFECTS (Phases A+B+C) fully live in production as of 2026-09-08 — code, tests, and both migrations applied and verified
metadata:
  type: project
---

WO LOGISTICS-SHIPPING-EFFECTS (all 3 phases, commits a32433c/14433cf/922882e/fd273a3) is now **fully deployed to production** as of 2026-09-08. Both underlying migrations are applied and verified by direct query against the live database:
- `logistics_sla_paused_at` column (Phase A) — live.
- `notification_queue` table (Phase B, file `supabase/migrations/20260908065000_notification_queue.sql`) — live, verified: all 18 columns present with correct types/nullability; all 4 constraints present (`notification_queue_pkey`, `notification_queue_idempotency_key_key` UNIQUE, `notification_queue_one_owner` CHECK num_nonnulls, `notification_queue_status_check` CHECK); `pg_class.relrowsecurity = true` with 0 policies (deny-by-default RLS, as intended).

This closed out four requirements to `DONE` in `contracts/requirements.contract.mjs`, each independently re-verified against code + tests (not trusting the implementer's summary):

- `FNL-ROLLBACK`: was `IMPLEMENTING` because AC3 (N_ROLLBACK/I4 queued) was previously uncovered. Verified `rollbackLogisticsOrder` (apps/b2b-web/src/app/(dashboard)/logistics/actions.ts:305) reads `transition.effects` for T10-T13 and calls `enqueueNotification` inside the same tx as `releaseCrewSlot`/`suspendLogisticsSla`. Test AC-C6 in `apps/b2b-web/tests/logistics-notification-integration.test.ts` proves exactly two events (client + dispatcher).
- `FNL-E5-E6` / `FNL-E5-BYPASS`: both had implicit `status: 'TODO'` (no override — default from the `R()` helper). All AC now covered by the same test file (AC-C1/C2/C8 for ship, AC-C4/C5/C8 for bypass).
- `NTF-QUEUE-TABLE`: Phase B (`enqueueNotification` helper + `NotificationQueue` model) fully covered by `apps/b2b-web/tests/enqueue-notification.test.ts` (AC-B1..B5), and has real Phase C consumers (ship + rollback), so it's not dead code.

RESOLVED 2026-09-08: migration `supabase/migrations/20260908065000_notification_queue.sql` was applied to production (explicit human approval) and verified as above. Both the migration file banner and the `NTF-QUEUE-TABLE` closing note in `contracts/requirements.contract.mjs` were updated to confirm deployment (previously both said "NOT applied"). See [[project_unapplied_security_migrations]] for the established pattern of distinguishing file-state from server-state in this repo — that memory's list of unresolved items should no longer include this migration.

Verification commands all green: `kk-validate.mjs`, `kk-selftest.mjs` (43/43), `kk-codegen.mjs` + `--check` (no drift), `kk-trace.mjs` (all four show `DONE` with test coverage). `npx vitest run` on both relevant test files: 26/26 passed.

**Why:** requirement status must reflect actual AC coverage, not implementer self-report — this session's instruction was explicit about re-deriving each AC-by-AC decision independently.
**How to apply:** if asked about the state of logistics shipping/rollback/notification-queue work, this is the closing record — everything (code, tests, both migrations) is live in production, no residual caveat.
