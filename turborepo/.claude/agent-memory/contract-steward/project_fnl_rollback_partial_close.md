---
name: fnl-rollback-partial-close
description: FNL-ROLLBACK moved TODO to IMPLEMENTING 2026-09-08 (not DONE) — 2/3 acceptance criteria proven, notification queueing awaits Faza C
metadata:
  type: project
---

`FNL-ROLLBACK` (`contracts/requirements.contract.mjs`) has three acceptance criteria. On 2026-09-08,
after verifying `apps/b2b-web/tests/logistics-rollback-effects.test.ts` (24 tests) against
WO LOGISTICS-SHIPPING-EFFECTS AC-A1..AC-A7, two of the three original criteria were confirmed covered
(slot release via `releaseCrewSlot`, SLA suspension via `suspendLogisticsSla` — both wired into
`rollbackLogisticsOrder` inside one `$transaction`). The third — "Kolejkowane są N_ROLLBACK i I4" —
is NOT covered: notification queue infrastructure didn't even exist as a table until this same turn
([[ntf-queue-table-schema-only]]), and the integration (`enqueueNotification` wired into
`rollbackLogisticsOrder`) is WO Faza C, not started.

Status was set to `IMPLEMENTING` (not `DONE`, not left at `TODO`) with per-criterion annotations in
the `acceptance` array itself — two marked `POKRYTE 2026-09-08` with evidence, the third marked
`NIEPOKRYTE` with an explicit statement of why it doesn't block/isn't hidden.

**Why:** applied [[closing-requirement-with-residual-debt]] literally — the uncovered criterion is
not "another layer, another risk" that could be carved into a separate ID; it's the same requirement's
own stated acceptance bullet, so rule 1 (leave not-DONE, document why) applies, not rule 3 (spin off
new ID). The human's task instruction said "if AC-A1..AC-A7 covered, mark DONE" but AC-A1..A7 (WO's
own Faza A criteria) are narrower than the requirement's stored `acceptance` array — the latter is
the actual contract obligation, so it governs the status field.
**How to apply:** don't move `FNL-ROLLBACK` to `DONE` until Faza C (`enqueueNotification` +
integration into `rollbackLogisticsOrder`, `shipLogisticsOrder`, `bypassLogisticsOrder`, per AC-C1..C8)
lands with tests. Related: [[ntf-queue-table-schema-only]].
