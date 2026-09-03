---
name: feedback-delete-action-wave-pattern
description: How to write RED tests for new SEC-AUDIT-LOG-DELETE-style delete actions (mock only prisma.$transaction, not per-model prisma.<model>), and how to write the AC11 static-scan rule itself without blind spots
metadata:
  type: feedback
---

When writing tests for a Server Action delete path that the WO says must move from a bare
`prisma.<model>.delete()` call into `prisma.$transaction(async (tx) => { tx.<model>.delete();
tx.auditLog.create(); })`, mock `@repo/database` with ONLY `prisma.$transaction` (a single
`transactionMock`), never add a top-level `prisma.<model>` accessor.

**Why:** today's production code calls `prisma.<model>.delete()` directly (no transaction). If
the mock doesn't provide that top-level model, calling it throws a `TypeError`, which the
action's own `try/catch` turns into `{ success: false }`. That's a legitimate, well-diagnosed
RED (assertion failure on `result.success`), not a broken test — it's the same pattern
`customers-anonymize-rodo.test.ts` already used for `anonymizeClientAction`.

**How to apply:** when a WO's Wave A covers multiple resources with the same shape (delete →
wrap in transaction + add audit log), build one shared `tx` object with every model's mocked
`delete`/`create` methods and a config-driven `it.each`-style loop per resource, rather than
duplicating the whole suite per file. Reuse `AUDIT_REQUIREMENTS.legalBases` and `ROLES`/`can()`
from `@klikklima/contracts` for role/legal-basis parametrization — zero literals.

## AC11-style static scan rule (the meta-test that checks *other tests/code* for the pattern)

Requirement: "every delete-of-a-record call site in a function must have a corresponding
`auditLog.create` in the same function." Building the detector for this is deceptively easy to
get wrong in four specific ways (found by `rls-security-auditor` reviewing the test itself, not
the production code, 2026-09-03):

1. **Literal needle `.delete({` misses `.deleteMany(`, whitespace variants (`.delete( {`), and
   any call whose argument isn't an object literal.** Use a regex,
   `/\.(delete|deleteMany)\s*\(/`, not `.indexOf('.delete({')`.
2. **But a bare `.delete(`/`.deleteMany(` regex is now TOO broad** — it also matches
   non-Prisma calls like `Map.delete()` / `URLSearchParams.delete()` (real false positives
   found in this repo: `createCrewInFlight.delete(formData)` in `crews/actions.ts`,
   `redirectUrl.searchParams.delete('code')` in `auth/callback/route.ts`). Anchor the regex to
   the Prisma call shape actually used in this codebase: `tx.<model>.delete(` /
   `prisma.<model>.delete(` — i.e. `/\b(?:tx|prisma)\.\w+\.(delete|deleteMany)\s*\(/`. Grep the
   real call sites first (`grep -rn '\.delete(\|\.deleteMany(' src`) before picking the anchor;
   don't guess.
3. **Raw SQL escapes the model layer entirely**: `tx.$executeRaw`/`$executeRawUnsafe` with a
   `DELETE FROM` string bypasses any regex keyed on `.delete(`. Detect it as a second, separate
   candidate type: match `$executeRaw(Unsafe)?\s*\(`, then check a small window after the match
   (~500 chars) for `/delete\s+from/i`.
4. **Function-boundary detection that silently `continue`s when it can't find a boundary is
   itself a blind spot** — a delete call sitting in a shape the boundary-finder doesn't
   recognize (e.g. `export const x = async () => {...}`, or no enclosing export at all) just
   vanishes from the report instead of failing loud. Fix: (a) extend the marker list beyond
   `export async function`/`export function` to include `export const`, `export default async
   function`, `export default function`, picking the *closest preceding* marker via
   `lastIndexOf` per marker and taking the max; (b) when no marker is found at all
   (`fnStart === -1`), push an offender with an explicit "could not determine function boundary
   — check manually" message instead of `continue`.
5. **Scope limited to files named `actions.ts` is a false sense of security** — nothing stops a
   delete-with-side-effects from landing in a differently-named file. Scan all `.ts` files under
   the app's `src` (excluding `tests/` and `*.test.ts`), not just files matching one filename
   convention.

Verification method for all of the above (no vitest transform harness needed here — this is
pure string-matching logic, not production code under mutation): write small fixture files in
the scratchpad (`good/actions.ts` compliant, `bad_deletemany/actions.ts`,
`bad_rawsql/actions.ts` with `$executeRawUnsafe('DELETE FROM ...')`, `bad_arrow/actions.ts` with
`export const x = async () => {}`, `bad_otherfile/helpers.ts`, `bad_noboundary/actions.ts` with
a delete inside an IIFE with no export marker at all), then a standalone `node scan.mjs <dir>`
script implementing the same logic, run against each fixture dir, and confirm each produces
exactly the expected offender(s) and the `good` fixture produces `[]`. Then apply the same logic
to the real test file and re-run the real suite — the offender COUNT AND IDENTITY must be
unchanged from before the rule was strengthened (the point is closing blind spots, not
discovering — or hiding — new findings by accident). If the strengthened rule turns up something
genuinely new on real repo code, stop and report it as a possible real finding; don't tune the
regex to make it disappear.

For AC11-style "every `.delete({` on a Prisma model inside `actions.ts` must sit inside a
`$transaction` block that also contains `auditLog.create`" static checks: don't use a single
greedy regex — extract the enclosing function via brace-balancing from the nearest preceding
function-boundary marker, then regex-test only that slice. A file-wide regex risks false
negatives when a file has multiple functions, some already compliant and some not.

Related: [[feedback_mutation_verification_pattern]] for verifying new assertions with a mutation
harness before treating a RED test as trustworthy (used here in spirit via fixture+scan.mjs
rather than the vitest transform harness, since the thing under test is the detector logic
itself, not production code).
