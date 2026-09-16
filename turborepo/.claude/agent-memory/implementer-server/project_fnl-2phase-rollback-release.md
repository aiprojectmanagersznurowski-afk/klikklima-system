---
name: fnl-2phase-rollback-release
description: FNL-2PHASE-ROLLBACK-RELEASE WO — releasePhaseTwoBooking implemented, narrow scope (D1 variant a), FNL-ROLLBACK-BOOKING-RELEASE left open for phase-1/single-phase booking release
metadata:
  type: project
---

Implemented 2026-09-16: `releasePhaseTwoBooking(tx, leadId)` in
`apps/b2b-web/src/app/(dashboard)/logistics/rollback-effects.ts`, wired into
`rollbackLogisticsOrder` (`logistics/actions.ts`) right after `releaseCrewSlot`
in both branches (main transition and idempotent `ROLLBACK_RESCHEDULING`
branch). Went GREEN on the first attempt for the new 21-test RED file; two
follow-up defensive fixes were needed to avoid regressing the pre-existing
suite (see [[legacy-fixture-regressions]]) — no test files were touched.

**Why**: kryterium 2 z `contracts/requirements.contract.mjs:169` — rollback
musi zwalniać rezerwację etapu II (`bookings.status: RESERVED/CONFIRMED ->
RELEASED`), inaczej `bookings_one_active_per_subject` blokuje ponowną
rezerwację po rollbacku.

**Scope decision (D1 variant a, human-confirmed via WO)**: only phase-2
booking of `TWO_PHASE` installations is released. Phase-1 booking and
single-phase installation bookings are explicitly OUT of scope — tracked
under a not-yet-registered requirement ID `FNL-ROLLBACK-BOOKING-RELEASE`
(variant b, "release every active booking of the subject"). If a future WO
references that ID, it's the wider-scope sibling of this one — don't conflate
them.

**How to apply**: when picking up `FNL-ROLLBACK-BOOKING-RELEASE`, expect the
same defensive-read patterns to be needed again (this module is imported by
several older test files with incomplete mocks).
