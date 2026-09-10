---
name: feedback-react-ui-test-infra-limits
description: repo has no live React render infra (jsdom/RTL wiring); established, repeated static-source-text convention substitutes for it — use it instead of stopping
metadata:
  type: feedback
---

Root `vitest.config.mts` (`turborepo/vitest.config.mts`) has `include: ['**/*.test.ts']` (excludes
`.test.tsx`), no `environment: 'jsdom'`, no `setupFiles` for `@testing-library/jest-dom`, and no
`@/*` path alias (only `@klikklima/contracts` and `server-only` are aliased). `apps/b2b-web`
depends on `@testing-library/react`/`jsdom` in package.json, but they are not wired into the
vitest config actually used to run tests (`npm run test` at root = `vitest run`).

**Why:** confirmed by reading the config directly (2026-09-10) plus three independent prior
`test-author` sessions hitting the same wall (`customers-anonymize-ui.test.ts`,
`role-change-dialog-ui.test.ts`, `services-source-of-truth.test.ts` AC9) — all documented the same
root cause in their header comments and converged on the same workaround, independently reinvented
each time. This is not a one-off improvisation; it is the de facto repo convention for testing
`.tsx` UI when the component imports `@/*` (button/dropdown/etc).

**How to apply:** when a Work Order asks for component tests and the component under test imports
`@/*` (or otherwise can't be rendered), do NOT stop and escalate "no test infra" as blocking — that
bar is for genuinely *no prior art*. Instead follow the established pattern used across this repo:
1. Push pure logic (visibility gates, schemas, label tables) into files with **zero UI imports**
   (e.g. `menu-visibility.ts`, `nav-visibility.ts`, `*-schema.ts`) — these ARE unit-testable via
   plain `import`, and a missing module gives a legitimate RED (`Cannot find module`).
2. For the actual `.tsx` file, write **static tests**: `readFileSync` the source and assert with
   regex / brace-balancing extraction (`extractBalancedBlock` helper, copied across
   `sec-audit-log-role-change.test.ts` → `role-change-dialog-ui.test.ts` → reused here) instead of
   rendering. A missing planned `.tsx` file gives `ENOENT`, which is an acceptable RED (same status
   as `Cannot find module`) as long as the file was named/contracted by the test's header comment
   ("planned but doesn't exist yet" is fine; an accidental typo/unplanned path is not).
3. Document the exact file/export contract for `implementer-ui` in a large header comment (file
   paths, export names, exact literal strings expected like `role="alert"`, `disabled={!isValid`)
   — this repo's convention accepts prescriptive contracts in test comments precisely because there
   is no render to fall back on for looser behavioral assertions.

Only escalate as blocking if no prior art like this exists for the situation at hand, or if the
component genuinely cannot be statically analyzed (e.g. requires runtime-computed JSX that no
regex could ever pin down).

Related: [[feedback_mutation_verification_pattern]], [[feedback_three_layer_coverage_closure]].
