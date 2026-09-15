---
name: sql-verify-via-rolled-back-tx
description: Bez Dockera składnię PL/pgSQL weryfikuj blokiem w transakcji z celowym ROLLBACK przez `node -e` w packages/database — guard-paths blokuje pisanie plików skryptowych, także w scratchpadzie
metadata:
  type: feedback
---

Nie ma lokalnego Dockera ani `psql`, więc `supabase start` nie odtworzy świeżego replay. Prawdziwy parser PostgreSQL dostajesz mimo to: wykonaj testowany blok na ŻYWEJ bazie w transakcji, którą kończysz celowym wyjątkiem → ROLLBACK.

**Why:** analiza statyczna nie wyłapie błędu składni PL/pgSQL, zagnieżdżonego dollar-quotingu (`$txt$` w `$$`) ani złego `%I`/`%L` w `format()`. Rolled-back transakcja daje pełny parse + wykonanie przy zerowym trwałym skutku (DDL w Postgresie jest transakcyjne). Tak zweryfikowano 2026-09-15 blok z [[migration-both-run-orders]]: gałąź produkcyjną na prawdziwej kolumnie, gałąź „przed rename" na tabeli-atrapie tworzonej i wycofywanej w tej samej transakcji, gałąź ELSE po skasowaniu kolumn. Zero DDL na tabeli produkcyjnej.

**How to apply:**
- Rola `contract-steward` ma zapis tylko do contracts/, packages/contracts/, packages/database/prisma/, supabase/migrations/, docs/architecture/generated/, .claude/state/, tools/, .claude/agent-memory/. `guard-paths` blokuje plik skryptowy w `packages/database/` ORAZ w katalogu scratchpad — nie obchodź hooka, użyj `node -e`.
- Wzorzec: `cd packages/database && node --env-file=.env -e '...'`, klient przez `require("@prisma/client")`, `prisma.$transaction(async tx => { ...; throw new Error("ROLLBACK_CELOWY") })`.
- Pułapka cytowania: JS owinięty w POJEDYNCZE cudzysłowy basha — każdy `'` w SQL-u urywa łańcuch i dostajesz mylące `42P01 missing FROM-clause entry for table "public"`. Literały SQL pisz dollar-quotingiem (`$q$public.tabela$q$::regclass`).
- Po rollbacku dołóż kontrolę: atrapa `to_regclass(...)` ma być `null`, a komentarz/stan produkcji bajtowo bez zmian.
