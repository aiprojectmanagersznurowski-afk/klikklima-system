---
name: project_installation_status_enum_has_cancelled
description: InstallationStatus enum on live DB already contains CANCELLED — confirmed 2026-09-08 for WO LOGISTICS-SHIPPING-EFFECTS Faza A, D1 branch resolved
metadata:
  type: project
---

Live database query (2026-09-08) confirmed the `InstallationStatus` enum values, in order:
`PLANNED, IN_PROGRESS, COMPLETED, CANCELLED`.

Query used: `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'InstallationStatus' ORDER BY enumsortorder;` — matches `schema.prisma` local definition exactly.

**Why:** WO `LOGISTICS-SHIPPING-EFFECTS` Faza A, decision D1, branches on whether this enum has `CANCELLED`. It does — so `releaseCrewSlot` should set `status = CANCELLED` on the installation row, NOT leave it `PLANNED` with a cleared `zespol_id`. No enum value needs to be added.

**How to apply:** `implementer-server` implementing `releaseCrewSlot` per D1 should use `status: 'CANCELLED'` directly — do not re-query the enum or guess. If this memory is read for a different WO, re-verify against live DB since enums can change (see [[project_unapplied_security_migrations]] for the pattern of file-vs-server drift).

Related: schema field `logisticsSlaPausedAt` (`@map("logistics_sla_paused_at")`) already added to `model leady` in `packages/database/prisma/schema.prisma`, and migration `supabase/migrations/20260901210000_logistics_sla_pause.sql` was already written (both committed prior to this session, found already in place when this task began) — migration marked NOT applied to live DB, per header comment. `npx prisma generate`, `kk-validate`, `kk-selftest`, `kk-codegen --check`, and `tsc --noEmit` (apps/b2b-web) all pass with the field in place.
