---
name: vitest-mock-results-type-return
description: vi.fn().mock.results[i].type is ALWAYS 'return' for a mock configured with mockRejectedValue — never 'throw', regardless of caller's try/catch
metadata:
  type: feedback
---

`fn.mock.results[i].type` is only `'throw'` when the mock's implementation itself throws
**synchronously**. A mock built with `mockRejectedValue(err)`/`mockImplementation(() =>
Promise.reject(err))` always synchronously **returns** a Promise — so `type` is `'return'`
even though that promise later rejects. Verified by reading
`node_modules/@vitest/spy/dist/index.js` (`registerResult`/`registerSettledResult`) and by a
throwaway repro test in this repo (2026-09-10, WO `FLD-BOOKING-ATOMIC-ASSIGN`).

The async rejection is tracked separately in `fn.mock.settledResults[i]` (`type: 'rejected'`),
not in `fn.mock.results`.

**Why:** hit this while implementing `create-booking.ts` — a test asserted
`expect(call.type).not.toBe('return')` on `bookingCreateMock.mock.results` after the mock was
configured with `mockRejectedValue(...)` and every call was awaited inside a try/catch. This
assertion is **structurally unsatisfiable** for any implementation, since the mock always
synchronously returns a promise. Confirmed as `TEST-DEFECT`
(`apps/b2b-web/tests/create-booking.test.ts:546`), fixed by test-author, not an implementation bug.

**How to apply:** if a test asserts something about `mock.results[i].type` for an async/promise-
based mock, check whether it should instead be asserting on `mock.settledResults[i].type`
(`'fulfilled'`/`'rejected'`). If a test insists on `results[i].type !== 'return'` for a
promise-rejecting mock, that is almost certainly a test defect — flag it, don't chase it with
implementation changes.
