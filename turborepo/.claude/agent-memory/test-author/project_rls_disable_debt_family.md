---
name: project-rls-disable-debt-family
description: crews/leads/installations RLS-deny-by-default tests still lack a DISABLE ROW LEVEL SECURITY global-scan assertion, unlike auditors
metadata:
  type: project
---

`crews-rls-deny-by-default.test.ts`, `leads-rls-deny-by-default.test.ts`, and
`installations-rls-deny-by-default.test.ts` have the same gap that
`auditors-rls-deny-by-default.test.ts` had before 2026-09-08: no assertion across ALL
migration files ruling out `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` for their
respective tables. A later migration could inject this line and leave every existing
test in these three files green while fully opening the table to `authenticated`.

**Why:** pre-existing debt, already committed on `main` before this fix — out of scope
for the CRM-DELETE-ADMIN-ONLY-AUDITORS wave that fixed `auditors-*` (reviewer flagged
it explicitly as "not a regression, don't fix now, separate scope/decision").

**How to apply:** next time any of `crews-rls-deny-by-default.test.ts`,
`leads-rls-deny-by-default.test.ts`, `installations-rls-deny-by-default.test.ts` is
touched (or a CRM-DELETE-ADMIN-ONLY-* wave for those resources opens), add the same
fourth test as in `auditors-rls-deny-by-default.test.ts` AC-AUDITORS-RLS.4:
`expect(readAllMigrations()).not.toMatch(/ALTER TABLE\s+(public\.)?<table>\s+DISABLE ROW LEVEL SECURITY/i)`.
See [[feedback_three_layer_coverage_closure]] for the underlying pattern.
