---
name: project-email-unique-drift
description: Żywa baza NIE ma UNIQUE na zespoly_monterskie.email ani audytorzy.email mimo @unique w schema.prisma — findUnique po e-mailu daje LIMIT 1 i dowolny wiersz; bezpieczny wzorzec to findMany + take:2
metadata:
  type: project
---

Zmierzone 2026-09-02 (`pg_indexes` / `pg_constraint`, SELECT na żywej bazie): na `zespoly_monterskie`
i `audytorzy` istnieje **wyłącznie** indeks PK. Kolumny `email` nie mają UNIQUE, mimo że
`schema.prisma` deklaruje `@unique` i mimo migracji `20260822120000`. Prisma i tak wygeneruje dla
`findUnique({ where: { email } })` zapytanie `... WHERE email = $1 LIMIT 1` (zmierzone przez log
zapytań) — przy duplikacie zwróci **dowolny** wiersz, bez błędu.

**Why:** identyfikacja „kto to jest zalogowany pracownik" dla wariantów `:own` (audytor w `getLeads`,
monter w `getInstallations`/`getUpcomingServices`/`getIncidents`, samoobsługa dostępności i zgód)
opiera się wyłącznie na e-mailu. Bez ograniczenia w bazie duplikat e-maila (nic w akcjach
create/update go nie blokuje) daje przejęcie zakresu cudzej ekipy/audytora — fail-open, nie
fail-closed.

**How to apply:**
- Wzorzec uznany za bezpieczny (SEC-READ-GATES, 2026-09-02): `findMany({ where: { email }, take: 2 })`
  + odmowa gdy `length !== 1`. Każde `findUnique` po `email` traktuj jako znalezisko.
- Przed rekomendacją sprawdź ponownie `pg_indexes` — ktoś mógł w międzyczasie dołożyć indeks.
- Powiązane: [[project-auditor-scope-unimplemented]], [[feedback-rls-probe-as-role]] (technika
  odczytu konfiguracji bazy).
