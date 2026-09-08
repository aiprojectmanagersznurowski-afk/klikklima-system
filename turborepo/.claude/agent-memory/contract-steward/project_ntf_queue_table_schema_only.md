---
name: ntf-queue-table-schema-only
description: NTF-QUEUE-TABLE registered 2026-09-08 — model + migration only, no enqueueNotification helper, not applied to live DB
metadata:
  type: project
---

`NTF-QUEUE-TABLE` (status TODO, risk HIGH) covers WO LOGISTICS-SHIPPING-EFFECTS Faza B in
full (table + `enqueueNotification()` helper), but the 2026-09-08 contract-steward turn only
delivered the schema half: Prisma model `NotificationQueue` (`packages/database/prisma/schema.prisma`,
`@@map("notification_queue")`) and migration `supabase/migrations/20260908065000_notification_queue.sql`
(NOT applied to the live database — file only, per the same "write intent, don't run" convention as
`20260901220000_rodo_audit_log_and_client_anonymization.sql`).

Key facts for whoever picks up Faza B/C:
- `status` is `String` + CHECK (`PENDING|SENT|ERROR|DEAD_LETTER`), not a Prisma enum — deliberately
  matching the `AuditLog.operation`/`.resource`/`.legalBasis` precedent, not `LeadStatus`.
- `id` is `String @default(cuid())`, NOT `@db.Uuid` — this table doesn't follow the `leady`/`instalacje`
  UUID convention because it's a new Prisma-native table (like `AuditLog`, `AvailabilityDeclaration`),
  not a legacy Supabase table.
- FK columns (`lead_id`/`installation_id`/`service_id`/`incident_id`) are plain `UUID`, no `REFERENCES` —
  intentionally no FK constraint yet; Faza C should decide ON DELETE semantics before adding one.
- CHECK `notification_queue_one_owner` uses `num_nonnulls(...) = 1`, same pattern as
  `availability_declarations_one_owner` / `employee_consents_one_owner`.
- RLS: `ENABLE ROW LEVEL SECURITY` with zero policies (deny-by-default), same as
  `20260824185845_security_enable_rls_baseline.sql` — table is Prisma-only, no supabase-js consumer.

**Why:** WO explicitly separates Faza B (schema + helper) from Faza C (wiring into the three logistics
actions); this turn was scoped even narrower (schema + registration only, no helper) per explicit
task instructions.
**How to apply:** before closing `NTF-QUEUE-TABLE` to DONE, confirm AC-B1..AC-B5 all have tests AND
`enqueueNotification()` exists — table alone is not enough, per [[closing-requirement-with-residual-debt]].
Related: [[fnl_rollback_partial_close]] (if written), [[requirement-id-granularity]].
