---
name: feedback-raw-sql-uuid-cast
description: Prisma $queryRaw/$executeRaw tagged templates need explicit ::uuid casts for uuid-typed columns/params
metadata:
  type: feedback
---

When writing raw SQL through `prisma.$queryRaw`/`$executeRaw` tagged templates against a
`uuid` column (Postgres), always cast the interpolated parameter explicitly: `${someId}::uuid`.
Without the cast, Postgres raises SQLSTATE `42804` ("column is of type uuid but expression is
of type text") because the bound parameter arrives untyped/text and Postgres does not perform
an implicit or assignment cast from text to uuid in `INSERT ... VALUES` / `WHERE` position.

This is NOT needed for `int`/`smallint` (numbers) or `time`/`text` columns in the same
statement — only uuid params showed the failure in the one real occurrence seen so far
(`packages/scheduling/src/availability-rule.ts`, `writeAvailabilityRuleRaw`, INSERT into
`availability_rules(auditor_id, crew_id, ...)`, both uuid columns).

**Why:** This exact bug surfaced only on live Postgres on Vercel Preview — the Prisma mock used
in vitest unit tests does not execute real SQL, so no test caught it. Confirmed the fix by
finding the codebase's own established convention: `apps/b2b-web/src/app/(dashboard)/leads/actions.ts`,
`logistics/actions.ts`, and `logistics/rollback-effects.ts` already write `${leadId}::uuid` in
their raw `SELECT ... FOR UPDATE` queries — this repo's own precedent, not a guess.

**How to apply:** Whenever adding or reviewing a `$queryRaw`/`$executeRaw` tagged template that
touches a `uuid` column, grep the repo first for the existing `::uuid` pattern and match it.
Do not assume other Postgres types need the same treatment — verify column type from the
migration SQL before casting; don't cast defensively where it isn't needed.
