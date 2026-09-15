---
name: guard-forbidden-text-scan-and-audit-log-itest
description: guard-forbidden.mjs does naive substring scanning (matches comments, not just code); audit_log itest files must never write a delete call literal for that table.
metadata:
  type: feedback
---

`guard-forbidden.mjs` (ADR-008 append-only rule for `audit_log`) does a plain substring scan
for `auditLog.delete` across the whole file, including inside comments/docstrings — it is not
AST-aware. Writing an explanatory comment like "auditLog.delete is blocked" is enough to trip
the hook and block the Write, even though it's prose, not code.

**Why:** discovered while writing `apps/b2b-web/tests/scheduling-config-audit-log-check.itest.ts`
(CAL-SCHEDULING-CONFIG-UI WO) — an itest inserting rows into `audit_log` for TC-T11 initially
had an `afterEach` cleanup calling `prisma.auditLog.delete(...)`, which is correctly forbidden
(the table really is append-only, [[project_rls_disable_debt_family]]-adjacent ADR-008 rule).
After removing the delete call, a *comment* mentioning the literal string `auditLog.delete`
still tripped the same hook.

**How to apply:** for any `*.itest.ts` file that writes to `audit_log`, never add cleanup via
delete — leave rows in place (local `supabase start` stack is ephemeral per test run anyway,
per repo convention in `create-booking-concurrency.itest.ts`). When writing explanatory
comments about this constraint, avoid the literal substring `<model>.delete` for `auditLog`
even in prose — paraphrase ("usuwanie wierszy tej tabeli jest zablokowane") instead of writing
the method-call-shaped string.
