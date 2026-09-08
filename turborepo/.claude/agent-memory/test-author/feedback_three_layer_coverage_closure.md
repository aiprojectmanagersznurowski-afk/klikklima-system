---
name: three-layer-coverage-closure
description: pattern for closing the missing RLS/UI test layer when Server Action + one layer already exist for a CRM-DELETE-ADMIN-ONLY-* requirement
metadata:
  type: feedback
---

When a `CRM-DELETE-ADMIN-ONLY-*` requirement is TODO only because RLS/UI test layers
are missing (Server Action + its test already exist), reuse the exact static-assertion
shape from `crews-rls-deny-by-default.test.ts` (dedicated RLS file) and
`leads-detail-edit-ui-gate.test.ts` (UI static-source pattern), not the inline `AC-A3`
block style in `rls-deny-by-default-freeze.test.ts` — the dedicated-file style is the
more recent convention and reads cleaner per-requirement.

**Why:** root `vitest.config.mts` has no `@/*` alias, so full component render is not
executable — every UI-gate test in this repo is a `readFileSync` + regex test against
source text, and every RLS-gate test is a `readFileSync` + regex test against the
`20260824185845_security_enable_rls_baseline.sql` migration text (no docker/psql in
this environment, confirmed repeatedly). Do not attempt live-render or live-DB tests
here — they're a wrong-RED trap, not a stronger test.

**How to apply:**
1. RLS layer: use a WHITELIST, not a blacklist. A blacklist on `FOR DELETE`/`FOR ALL`
   literals misses two real cases (verified by mutation on `leads-rls-deny-by-default
   .test.ts`, 2026-09-08): a policy with no `FOR` clause at all defaults to `FOR ALL` in
   Postgres, so it never matches the literal; and a policy written without the `public.`
   qualifier (`ON leady` instead of `ON public.leady`) slips past a `public\.<table>\b`
   regex. Instead: collect every `CREATE POLICY ... ON (public\.)?<table>\b ...;` chunk
   in the WHOLE migration file (regex tolerant of a missing `public.` prefix), and
   assert that set has exactly the expected number of elements, each matching the exact
   expected clause (e.g. `FOR INSERT TO anon WITH CHECK (true)`). If the table has zero
   legal policies (like `zespoly_monterskie`), asserting count == 0 is fine and simpler.
   If it has any legal policy (like `leady`'s INSERT), blacklisting what's forbidden is
   not enough — whitelist what's allowed, so any future policy — legal or not — forces a
   deliberate test update instead of silently passing.
2. UI layer: before writing any assertion, `grep -n` the button text/label across the
   whole client file to get the true occurrence count. Assert that count explicitly,
   then loop over every occurrence and check each is wrapped by the gate — checking
   only the first occurrence is the exact bug this repo has hit twice already (see
   [[feedback_ternary_gate_no_brace_wrap]] and the leads-detail-edit-ui-gate history).
3. Always mutation-verify in scratchpad before reporting RED/GREEN as trustworthy: for
   RLS, test BOTH mutant shapes — `CREATE POLICY ... FOR DELETE ...` AND a policy with
   no `FOR` clause at all (defaults to `FOR ALL`) — plus a variant missing the `public.`
   qualifier, and confirm the assertion flips for all of them; for UI, strip the gate
   from only the *second* occurrence in a scratch copy and confirm the loop-based
   assertion (not just the first-occurrence one) flips too.
