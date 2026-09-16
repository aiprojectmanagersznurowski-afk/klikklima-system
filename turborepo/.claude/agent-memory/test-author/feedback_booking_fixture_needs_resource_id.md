---
name: feedback-booking-fixture-needs-resource-id
description: When writing an itest fixture that inserts into `bookings` directly with resourceKind CREW/AUDITOR, you must also set crewId/auditorId — resourceKind alone does not satisfy the DB constraints.
metadata:
  type: feedback
---

`bookings_one_assignee` (`CHECK (num_nonnulls(auditor_id, crew_id) = 1)`) and `bookings_resource_kind_check`
(`(resource_kind = 'AUDITOR' AND auditor_id IS NOT NULL) OR (resource_kind = 'CREW' AND crew_id IS NOT NULL)`),
both defined in `supabase/migrations/20260910100000_fld_calendar_foundation.sql`, mean a `prisma.booking.create()`
with `resourceKind: 'CREW'` but no `crewId` fails on Postgres `23514` at fixture-creation time, before the
test's own assertion ever runs — this is a bad-RED (fails on fixture setup, not on the tested behavior).

**Why:** Found via the first real CI run (GH Actions, live Postgres) of `fnl-2phase-db-constraints.itest.ts`
— the fixture only set `resourceKind: 'CREW'` and forgot `crewId`, because the domain layer usually fills
these in together and it's easy to write the raw-insert fixture as if `resourceKind` alone were enough
(see [[feedback-db-constraint-itest-bypass-domain]] for why raw inserts bypass the domain layer at all).
The sibling itest `create-booking-concurrency.itest.ts` had it right: it always creates a
`prisma.zespoly_monterskie.create()` row first and passes `crewId: crew.id` alongside `resourceKind: 'CREW'`
(and analogously `prisma.audytorzy.create()` + `auditorId` for `resourceKind: 'AUDITOR'`).

**How to apply:** Any time a test fixture does a raw `prisma.booking.create()` with `resourceKind: 'CREW'`,
first create a `zespoly_monterskie` row (helper pattern: `createTestCrew()` pushing into a
`createdCrewIds` array, cleaned up in `afterEach` via `booking.deleteMany` then `zespoly_monterskie.deleteMany`
— RESTRICT FK, must delete bookings first) and pass `crewId: crew.id`. Symmetrically for `resourceKind: 'AUDITOR'`,
create via `prisma.audytorzy.create()` and pass `auditorId`. Before shipping any new `.itest.ts` with a raw
booking insert, diff it against `create-booking-concurrency.itest.ts`'s fixture helpers rather than writing
the booking payload from memory — see [[project-itest-no-docker-sandbox]] for why this only surfaces on
real CI, not locally.
