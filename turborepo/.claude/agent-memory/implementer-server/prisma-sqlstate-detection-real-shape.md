---
name: prisma-sqlstate-detection-real-shape
description: real (non-mocked) Prisma errors from prisma.<model>.create() on constraint/trigger violations embed SQLSTATE as `code: "XXXXX"` inside PostgresError text, not meta.code
metadata:
  type: project
---

For `FLD-BOOKING-ATOMIC-ASSIGN` (`apps/b2b-web/src/lib/schedule/create-booking.ts`), catching a
Postgres `EXCLUDE`/trigger constraint violation thrown by a **plain** `prisma.booking.create()`
(not `$queryRaw`) against a **live** Postgres produces a
`PrismaClientUnknownRequestError` with `code: undefined`, `meta: undefined` — the real SQLSTATE
only appears buried in `err.message` as part of the nested Rust error text:
`ConnectorError({ ... kind: QueryError(PostgresError { code: "23P01", message: "...", ... }) ... })`.

**Why:** the unit test file (`create-booking.test.ts`, mocked Prisma) only exercises two
plausible *mocked* shapes (`meta.code` on a `PrismaClientKnownRequestError`-like object, or
`(SQLSTATE 23P01)`/`` Code: `23P01` `` text) — neither matches what a real, live-Postgres
`.create()` call actually throws. Discovered by running
`apps/b2b-web/tests/create-booking-concurrency.itest.ts` against a real local Postgres
(reachable via `npm run test:integration` from repo root) and inspecting the raw error.

**How to apply:** `extractSqlState()` in `create-booking.ts` (and any future code parsing
Postgres error codes off Prisma exceptions from a non-`$queryRaw` call) must also match
`code:\s*"([0-9A-Z]{5})"` in `err.message`, in addition to `meta.code` and the
`` Code: `XXXXX` `` / `SQLSTATE XXXXX` text patterns. Don't assume the mocked test shapes are
exhaustive — verify against a live DB when one is reachable. See also
[[vitest-mock-results-type-return]] for another mismatch between mocked-test assumptions and
real runtime behavior found in the same WO.
