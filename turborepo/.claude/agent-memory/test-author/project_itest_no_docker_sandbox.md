---
name: project-itest-no-docker-sandbox
description: This sandbox has no Docker/Podman, so *.itest.ts (vitest.integration.config.mts, real Postgres via `supabase start`) cannot be executed here, and DATABASE_URL in .env points at production, blocked by tools/vitest-integration-db-guard.mjs.
metadata:
  type: project
---

`apps/b2b-web/tests/*.itest.ts` files run against `vitest.integration.config.mts`, which requires a real local Postgres via `supabase start`. This sandbox has no Docker/Podman, so that command cannot run. The repo's `.env` `DATABASE_URL` points at production, and `tools/vitest-integration-db-guard.mjs` correctly refuses to run integration tests against it — do not attempt to bypass this guard, and never point tests at the production URL even temporarily.

**Why:** `FLD-BOOKING-ATOMIC-ASSIGN` follow-up work order (2026-09-14) explicitly instructed: write/extend the `.itest.ts` carefully, verify only via close code review against the already-passing AC-A4/AC-A5 pattern in the same file, run only `npx tsc --noEmit` and plain `npx vitest run` (unit config, which excludes `*.itest.ts` via `vitest.config.mts` exclude list) to confirm syntax/type correctness — and report that real execution must happen in CI (has Docker) or on a dev machine with local `supabase start`.

**How to apply:** For any task touching `*.itest.ts`: (1) read the existing file fully for the established fixture/cleanup/basket-lookup pattern before adding tests, (2) run `tsc --noEmit` and `vitest run` (non-integration) as the only available verification, (3) explicitly state in the summary that RED/GREEN execution was not possible in this environment and why, rather than silently claiming it passed. See [[feedback-db-constraint-itest-bypass-domain]] for what to write when the criteria are about a raw DB constraint's exact boundary.
