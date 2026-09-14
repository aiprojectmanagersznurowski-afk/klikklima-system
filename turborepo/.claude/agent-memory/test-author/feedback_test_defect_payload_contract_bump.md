---
name: feedback-test-defect-payload-contract-bump
description: pattern for fixing a TEST-DEFECT test broken by an unrelated WO changing a Server Action's input contract (field rename) plus a new side-effect call in its success path
metadata:
  type: feedback
---

When a wave changes a Server Action's input shape (e.g. `bookingDate`+`bookingSlot` ->
`startAtIso`) and adds a new downstream call on the success path (e.g. `createBooking`
from a domain package, followed by an UPDATE on the same table already used for INSERT),
an older test file for an unrelated, completed requirement on the *same* action can break
purely because its payloads use the old field names and its success path never gets a
booking mock — not because its own assertions are wrong.

Fix pattern (confirmed working, `apps/b2c-web/tests/actions/saveLead.test.ts` vs new
`saveLead.ts` under B2C-BOOKING-SLOT v2, 2026-09-14):
1. Update only the payload builder (e.g. `basePayload()`) to the new field name — don't
   touch assertions belonging to the other requirement's `@REQ:` tag.
2. Add a `vi.mock('@repo/<domain-package>', ...)` with a default `ok:true` resolved value,
   mirroring 1:1 the sibling test file written in the same RED turn for the new WO (it is
   the canonical mocking convention — check for it before inventing your own).
3. If the success path now does a second write to a table already mocked for INSERT
   (e.g. `.update()` on the same table), add the `update` key to that table's mock
   returned by the `from()` switch — a missing key throws a raw TypeError inside the
   action's try/catch and silently flips `result.success` to `false`, which looks like
   the wrong assertion failing when it's actually a missing mock method.
4. Any assertion elsewhere in the file that lists the exact sequence of `from()` calls
   (e.g. `['klienci','adresy','leady']`) must be updated to include the new call for the
   same table (e.g. trailing extra `'leady'` for the update) — this is a forced, factual
   consequence of the new architecture, not a weakening of the original assertion; keep
   the more precise per-spy call-count assertions right below it unchanged as the real
   proof.

Why: the goal (WO instruction) was "don't change geocoding assertions' content, only
what's needed to reach them" — table-call-order assertions that aren't literally about
the tested requirement still need to track real call sequence, otherwise the test goes
RED again for an unrelated, uninteresting reason (missing mock plumbing) instead of
either passing or failing on the actual criterion.

How to apply: whenever an implementer's WO note says "this broke an unrelated test,
TEST-DEFECT, don't touch prod code" — first read the *new* production file in full, then
the sibling test file written in the same RED turn for the new WO (it shows the exact
mock shape expected), then patch only inputs/mocks in the old file, never its assertions
for the requirement it's actually about.
