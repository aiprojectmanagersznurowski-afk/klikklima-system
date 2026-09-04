---
name: feedback_toctou_mock_sequencing
description: How to spot a fake concurrency/TOCTOU test in vitest-mocked Prisma actions (seen in SEC-AUDIT-LOG-MANUAL-STATUS Wave B review, 2026-09-04)
metadata:
  type: feedback
---

When a Server Action claims to be safe against TOCTOU/race conditions on a Prisma
row (e.g. two concurrent calls both reading `HARDWARE_IN_WAREHOUSE` before either
writes), the ONLY thing that actually prevents the race on Postgres READ COMMITTED
(the default) is an explicit lock inside the transaction — `tx.$queryRaw`SELECT ...
FOR UPDATE`` (or a conditional `UPDATE ... WHERE status = $expected` with a
rowcount check). A plain `tx.leady.findUnique()` followed by `tx.leady.update()` by
id gives **no** protection: two real concurrent transactions can both read the old
status before either commits, and both writes will eventually apply (the second
blocks on the row lock only during the `UPDATE` itself, then proceeds since the
`WHERE` clause doesn't re-check the value it read).

A test that "proves" this is safe by using
`mockFn.mockResolvedValueOnce(A).mockResolvedValueOnce(B)` and then firing two
calls via `Promise.all` is **not evidence of anything** — JS mock resolution order
under `Promise.all` is deterministic based on call/microtask order, not real
database contention. Such a test will pass identically whether or not the
production code has a real `FOR UPDATE` lock. Comments like "symulując blokadę
wiersza na żywej bazie" (simulating a live-DB row lock) in the test are misleading
if the implementation has no lock at all.

**Why:** Found in a Wave B review of `SEC-AUDIT-LOG-MANUAL-STATUS`
(`apps/b2b-web/src/app/(dashboard)/logistics/actions.ts`). `rollbackLogisticsOrder`
correctly uses `SELECT ... FOR UPDATE` before its status check (and the WO's own
AC8 says explicitly: "O wyniku rozstrzyga baza (blokada wiersza), nie odczyt
poprzedzający zapis w JS"). `bypassLogisticsOrder` was extended with a
`$transaction` and a `tx.leady.findUnique` status guard in the same wave, but
**without** the equivalent `FOR UPDATE` lock — a real regression relative to the
sibling function and a violation of the WO's own AC8, masked by a test
(`sec-audit-log-manual-status-wave-b.test.ts`, "AC8" case) that only exercises
mock sequencing, not real Postgres semantics. Fixed same day: `implementer-server`
added the matching `FOR UPDATE` lock, and `test-author` rewrote the AC8 test to
assert on mock call order/arguments (`invocationCallOrder`) instead of
`Promise.all` sequencing, mutation-verified to fail without the lock.

**How to apply:** Whenever a diff adds a "concurrency-safe" claim backed by a
`Promise.all([...])` test over mocked Prisma, check for one of: (a) a `FOR UPDATE`
`$queryRaw` inside the transaction, or (b) a conditional `UPDATE ... WHERE
<precondition>` whose affected-row-count is checked. If neither exists in the
reviewed code, treat any accompanying "two concurrent calls → one success" test as
non-evidence — call it out explicitly, and check the sibling/reference
implementation in the same file (there's often one, e.g. `rollbackLogisticsOrder`)
to see what the correct pattern looks like.
