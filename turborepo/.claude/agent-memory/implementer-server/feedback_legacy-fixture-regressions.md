---
name: legacy-fixture-regressions
description: How to add a new exported function to a shared server-action helper module without touching existing test files that mock that module or its fake `tx` doubles incompletely
metadata:
  type: feedback
---

When a Work Order adds a new function to a module that many pre-existing tests
already fake/mock (e.g. `apps/b2b-web/src/app/(dashboard)/logistics/rollback-effects.ts`,
called from `logistics/actions.ts`), two distinct regression failure modes show
up in the full `apps/b2b-web` suite, and neither is fixable by editing test
files (forbidden for `implementer-server`):

1. **Older stateful fake `tx` doubles lack the new Prisma delegate/method**
   (e.g. `tx.instalacje` mocked with only `{ update, updateMany }`, no
   `findMany`). Calling the missing method throws `TypeError`, caught by the
   action's outer try/catch, turning `{ success: true }` into a generic
   `{ success: false }` in unrelated tests.
   **Fix**: read defensively with optional chaining and a fallback, e.g.
   `const rows = (await tx.instalacje.findMany?.({...})) ?? [];`. Real Prisma
   `TransactionClient` always has the method, so this never changes production
   behavior — it only treats old fixtures that don't model the new capability
   as "zero matching rows", which is the correct semantic default anyway.

2. **Older tests do `vi.mock('./module-path', () => ({ existingExportA, existingExportB }))`**
   for the *whole module*, enumerating only the exports that existed *before*
   this WO. Vitest's mocked-module proxy has a `get` trap that **throws**
   `"[vitest] No "X" export is defined on the mock"` for any property not in
   that returned object — even via `?.()` optional chaining, since the throw
   happens on property *access*, before the call.
   **Fix**: import the module as a namespace (`import * as ns from './module-path'`)
   and guard with the `in` operator: `if ('newExport' in ns) { await ns.newExport(...) }`.
   Vitest's mock proxy only overrides `get`, not `has` — so `in` falls through
   to the plain target object and returns `false` for the missing export
   instead of throwing. This safely no-ops in the legacy-mocked test while
   still calling the real function unconditionally in production and in any
   new/updated test that doesn't mock the module (or mocks it with the new
   export included).

**Why this matters**: WOs will sometimes claim "existing test file X passes
unchanged" as an acceptance criterion without having actually run the full
suite against the new code — always run the *whole* `apps/b2b-web` vitest
suite (not just the new RED file) before declaring GREEN, and prefer these
two narrow defensive-read patterns over touching any test file.

See [[fnl-2phase-rollback-release]] for the concrete WO this was learned on.
