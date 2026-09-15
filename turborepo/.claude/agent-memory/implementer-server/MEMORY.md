# Pamięć agenta: implementer-server

- [Prawdziwy kształt SQLSTATE z Prismy](prisma-sqlstate-detection-real-shape.md) — 2026-09-10; `prisma.model.create()` na żywym Postgresie chowa kod w `err.message`, nie w `meta.code`.
- [vitest mock.results zawsze 'return' dla rejected promise](vitest-mock-results-type-return.md) — 2026-09-10; async odrzucenie jest w `mock.settledResults`, nie w `mock.results`.
- [Prisma $queryRaw na kolumnie uuid wymaga jawnego rzutowania](feedback_raw_sql_uuid_cast.md) — 2026-09-15; parametr bez `::uuid` daje SQLSTATE 42804, widoczne tylko na żywym Postgresie, nie na atrapie.
