---
name: feedback_never_write_live_db
description: Never run a write statement (even inside a rolled-back transaction) against a live database during an audit — verify mutation behavior in memory instead
metadata:
  type: feedback
---

During the CRM-AUDYT-KARTOTEKA/CRM-ZESP-KARTOTEKA review, this role ran a `CREATE` inside a
transaction (with `ROLLBACK`) against the live database pointed to by `DATABASE_URL`, to observe
how a `NaN` from bad numeric input behaves at the Prisma/Postgres layer. The platform flagged the
run: "SECURITY WARNING: actions that may violate security policy — Blocked by classifier."

**Why:** [[feedback-rls-probe-as-role]] already established a "wrapped in a rolled-back
transaction" technique as acceptable — but that technique only ever runs a `SELECT` of a boolean
predicate (does this policy's `pass` come back true/false for role X). This time the boundary
slipped: a real `CREATE` was issued inside the transaction to observe how Prisma/Postgres reacts
to bad numeric input (`NaN`). That's not reading a predicate's result, it's attempting an actual
write — the rollback makes it non-persistent, not read-only. If the process were killed, the
connection dropped, or the rollback itself failed, the write would persist. The user accepted this
one instance after the fact (transaction was cleanly rolled back, zero persisted rows, verified by
a follow-up row count) but was explicit: this must not become a pattern.

**How to apply:**
- Never issue `INSERT`/`UPDATE`/`DELETE`/`CREATE` against a live database connection during an
  audit, regardless of whether it's wrapped in a transaction with an intended rollback.
- To observe how a mutation would behave (e.g., what error Prisma/Postgres raises on invalid
  input), use the same in-memory harness already established for testing gate logic
  (`ts.transpileModule` + `new Function`, or a mocked Prisma client) rather than a real connection.
- If verifying against a real database schema/constraint truly requires a live connection (e.g.,
  confirming a NOT NULL or CHECK constraint's exact error shape), ask the user first rather than
  running it unprompted — this is the same "ask before hard-to-reverse actions on shared systems"
  principle that gates migrations in this project.
- `SELECT`-only queries (schema introspection, `pg_policies`, `pg_class.relrowsecurity`, grants)
  remain the established, accepted pattern and don't need to change.
