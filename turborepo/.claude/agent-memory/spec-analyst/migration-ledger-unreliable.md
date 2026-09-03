---
name: migration-ledger-unreliable
description: Ewidencja migracji w KlikKlima jest niewiarygodna — nie ufaj obecności pliku w supabase/migrations jako dowodowi, że zmiana jest na bazie
metadata:
  type: project
---

Obecność pliku w `supabase/migrations/` **nie dowodzi**, że migracja została uruchomiona.
Jedynym źródłem prawdy o schemacie żywej bazy jest odpytanie `pg_catalog`
(`pg_constraint`, `pg_indexes`, `information_schema`).

Stan zmierzony 2026-09-03:
- `supabase_migrations.schema_migrations` zawiera **2** wpisy (`20260820120000`, `20260820120100`)
- repozytorium zawiera **14** plików migracji
- tabela `_prisma_migrations` **nie istnieje**

**Why:** tak powstał dryf `SEC-EMAIL-UNIQUE`. Migracja
`20260822120000_fld_availability_split_employee_email_unique.sql` tworzy `UNIQUE` na
`audytorzy.email` i `zespoly_monterskie.email`, `schema.prisma` deklaruje `@unique`,
a na bazie nie ma ani jednego z tych indeksów. Nikt tego nie cofnął — to nigdy nie zostało
uruchomione. Ten sam dryf może dotyczyć pozostałych ~11 nieodnotowanych plików.

Dodatkowo w tej sesji obowiązuje wzorzec: migracje bezpieczeństwa są commitowane
z nagłówkiem „TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA" i czekają na osobną, jawną zgodę
człowieka. Kolejka takich plików rośnie.

**How to apply:** w każdym WO dotykającym schematu zweryfikuj stan bazy zapytaniem,
zanim zaplanujesz zmianę, i wpisz zmierzony wynik do WO. Nigdy nie planuj zabezpieczenia,
które opiera się wyłącznie na gwarancji z `schema.prisma` — zakładaj, że migracja
nie zostanie uruchomiona w horyzoncie zamknięcia WO, i wymagaj warstwy w kodzie.
Patrz też [[db-probe-recipe]], [[identity-by-email-fragility]].
