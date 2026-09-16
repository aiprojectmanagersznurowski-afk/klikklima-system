---
name: feedback-db-constraint-itest-bypass-domain
description: When an .itest.ts must prove a raw Postgres constraint's exact boundary (not the domain function's candidate-selection logic), bypass the domain function and call prisma.<model>.create() directly on both rows.
metadata:
  type: feedback
---

When a requirement's acceptance criteria are about the **database constraint itself** (e.g. `EXCLUDE USING gist`, partial index scope, `[)` interval semantics) rather than about the domain function that calls into it, calling the domain function (e.g. `createBooking`) for both rows is often wrong: an earlier filtering layer (`findAvailableSlots`) will pre-filter out the busy resource before the second write is even attempted, so the domain-level test never actually reaches the constraint. Instead, insert both rows with a direct `prisma.<model>.create()`, deliberately skipping the domain layer, so the assertion targets the constraint's SQLSTATE (e.g. `23P01`) directly. Use the exported low-level helper (e.g. `extractSqlState`) if the production module exports one, rather than re-deriving error-shape parsing in the test.

**Why:** Confirmed in `docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md` follow-up — contract-steward found 3 of 11 acceptance criteria for `FLD-BOOKING-ATOMIC-ASSIGN` proved only the mock's own behavior because the existing itest (AC-A4/AC-A5) only covered identical-start collisions, which even a plain `UNIQUE(resource, start)` would catch — it didn't prove overlap semantics, boundary-touch non-collision, or that RELEASED/COMPLETED rows don't block the partial exclusion constraint.

**How to apply:** For DB-constraint-boundary criteria (overlap vs. identical-start, inclusive/exclusive interval edges, partial-index status scope), write raw `prisma.<model>.create()` pairs instead of exercising the full domain action. Reserve the domain-function path (e.g. `createBooking`) for criteria about candidate selection, retry-on-conflict, or ordering — see [[project-itest-no-docker-sandbox]].
