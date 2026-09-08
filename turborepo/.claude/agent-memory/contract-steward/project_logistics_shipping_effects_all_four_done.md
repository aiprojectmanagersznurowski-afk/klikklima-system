---
name: project-logistics-shipping-effects-all-four-done
description: FNL-ROLLBACK, FNL-E5-E6, FNL-E5-BYPASS, NTF-QUEUE-TABLE all closed to DONE 2026-09-08 after independent AC-by-AC verification
metadata:
  type: project
---

WO LOGISTICS-SHIPPING-EFFECTS (all 3 phases, commits a32433c/14433cf/922882e) closed out four requirements to `DONE` in `contracts/requirements.contract.mjs` on 2026-09-08, each independently re-verified against code + tests (not trusting the implementer's summary):

- `FNL-ROLLBACK`: was `IMPLEMENTING` because AC3 (N_ROLLBACK/I4 queued) was previously uncovered. Verified `rollbackLogisticsOrder` (apps/b2b-web/src/app/(dashboard)/logistics/actions.ts:305) reads `transition.effects` for T10-T13 and calls `enqueueNotification` inside the same tx as `releaseCrewSlot`/`suspendLogisticsSla`. Test AC-C6 in `apps/b2b-web/tests/logistics-notification-integration.test.ts` proves exactly two events (client + dispatcher).
- `FNL-E5-E6` / `FNL-E5-BYPASS`: both had implicit `status: 'TODO'` (no override — default from the `R()` helper). All AC now covered by the same test file (AC-C1/C2/C8 for ship, AC-C4/C5/C8 for bypass).
- `NTF-QUEUE-TABLE`: Phase B (`enqueueNotification` helper + `NotificationQueue` model) fully covered by `apps/b2b-web/tests/enqueue-notification.test.ts` (AC-B1..B5), and has real Phase C consumers (ship + rollback), so it's not dead code.

Important caveat kept in the DONE notes: migration `supabase/migrations/20260908065000_notification_queue.sql` is **still not applied** to the live database. `DONE` here means code+tests prove behavior, not "works in production" — see [[project_unapplied_security_migrations]] for the established pattern of distinguishing file-state from server-state in this repo.

Verification commands all green: `kk-validate.mjs`, `kk-selftest.mjs` (43/43), `kk-codegen.mjs` + `--check` (no drift), `kk-trace.mjs` (all four show `DONE` with test coverage). `npx vitest run` on both relevant test files: 26/26 passed.

**Why:** requirement status must reflect actual AC coverage, not implementer self-report — this session's instruction was explicit about re-deriving each AC-by-AC decision independently.
**How to apply:** if asked about the state of logistics shipping/rollback/notification-queue work, this is the closing record. If the migration gets applied later, update this memory and remove the caveat.
