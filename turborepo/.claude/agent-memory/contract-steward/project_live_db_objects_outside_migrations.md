---
name: live-db-objects-outside-migrations
description: Widok zmaterializowany available_combinations istnieje na żywej bazie, ale w żadnej migracji ani w schema.prisma — historia migracji NIE odtwarza żywej bazy, więc SQL dotykający takich obiektów wymaga osłony to_regclass
metadata:
  type: project
---

Ustalone 2026-08-24 przy `SEC-RLS-BASELINE`. `public.available_combinations` (`pg_class.relkind = 'm'`,
widok zmaterializowany) **istnieje na żywej bazie i ma czterech konsumentów** przez `supabase-js`
(`apps/b2c-web/app/actions/`: `getSetForConfig.ts`, `getRecommendation.ts`,
`getLowestPriceForIndoorUnit.ts`, `getValidConfigurations.ts`), ale **nie tworzy go żadna migracja
i nie ma go w `schema.prisma`**. Utrzymywany jest ręcznie po stronie bazy.

Skutek: mimo migracji bazowej „reconstructing the current schema from empty" (commit ff3cbe8)
historia migracji **nie odtwarza żywej bazy w całości**. `supabase db reset` da bazę, w której
tego obiektu nie ma, a kod B2C go szuka.

**Why:** zwykły `REVOKE ... ON public.available_combinations` przechodzi na produkcji, ale przy
odtwarzaniu od pustej bazy wywala się na „relation does not exist" i przerywa CAŁY reset — jedna
linia blokuje wszystkie późniejsze migracje. Michal wyłapał to w review, zanim plik poszedł dalej.

**How to apply:** zanim napiszesz w migracji `ALTER`/`REVOKE`/`GRANT` na obiekcie, sprawdź, czy
tworzy go którakolwiek migracja albo `schema.prisma`. Jeśli nie — owiń w
`DO $$ BEGIN IF to_regclass('public.<obiekt>') IS NOT NULL THEN ... END IF; END $$;`.
Nie zakładaj też, że RLS da się włączyć na takim obiekcie: Postgres nie wspiera Row Level Security
na widokach zmaterializowanych, jedyną bramką są uprawnienia obiektowe.
Powiązane: [[rls-disabled-incident]].
