---
name: db-probe-recipe
description: Jak odpytać żywą bazę KlikKlima z poziomu agenta — skrypt musi leżeć w packages/database, bo tam jest @prisma/client
metadata:
  type: reference
---

Odpytanie żywej bazy (dostęp SELECT) działa tak:

1. Zapisz skrypt ESM **w katalogu `packages/database/`** (np. `probe-tmp.mjs`) —
   uruchomienie ze scratchpada kończy się `ERR_MODULE_NOT_FOUND: '@prisma/client'`,
   bo rozwiązywanie modułów idzie po drzewie katalogów.
2. Uruchom `node -r dotenv/config probe-tmp.mjs` z `packages/database`.
3. Usuń plik po użyciu.

Szkielet: `new PrismaClient()` + `p.$queryRawUnsafe(sql)`.
`JSON.stringify` wymaga replacera na `bigint` (`count(*)` wraca jako BigInt).

Grep na plikach `.env` / `.env.local` jest **zablokowany regułą deny** — nie próbuj
odczytywać connection stringa, `dotenv/config` załatwia to bez oglądania sekretu.

Przydatne zapytania diagnostyczne:
- ograniczenia: `SELECT conrelid::regclass::text, conname, contype FROM pg_constraint WHERE conrelid IN ('public.X'::regclass)`
- indeksy: `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN (...)`
- ewidencja migracji: `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version` (patrz [[migration-ledger-unreliable]])
