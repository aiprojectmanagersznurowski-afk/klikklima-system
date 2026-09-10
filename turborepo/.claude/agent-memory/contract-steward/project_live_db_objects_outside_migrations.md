---
name: live-db-objects-outside-migrations
description: Widok available_combinations i buckety Storage (audytorzy, zespoly) istnieją na żywej bazie, ale w żadnej migracji ani w schema.prisma — historia migracji NIE odtwarza żywej bazy, więc SQL dotykający takich obiektów wymaga osłony to_regclass
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

**POŁOWA DŁUGU ZAMKNIĘTA 2026-09-10** (okno `B2C-CATALOG-VIEW-UNTRACKED`, wymaganie
`B2C-CATALOG-VIEW-TRACKED`): `supabase/migrations/20260910090000_b2c_catalog_view_tracked.sql`
odtwarza w repo widok, obie funkcje (`get_codes_hash`, `get_multi_indoor_price`), trzy indeksy,
GRANT-y ORAZ — czego nikt wcześniej nie odnotował — **cztery triggery `FOR EACH STATEMENT`
odświeżające widok** (`refresh_combinations_on_single/_multi/_indoor/_outdoor` →
`refresh_available_combinations()` → pełny `REFRESH MATERIALIZED VIEW`). Osłona `to_regclass`
w `20260824185845` ZOSTAJE (ma wcześniejszy timestamp, więc przy odtwarzaniu od zera i tak trafia
na nieistniejący obiekt) — dlatego nowa migracja powtarza `REVOKE ALL` + `GRANT SELECT`.
Lekcja ogólniejsza: **odczyt „czy obiekt jest w repo" to za mało — sprawdź też `pg_trigger`,
`pg_proc` i `pg_indexes`**. Obiekt spoza migracji zwykle ciągnie za sobą satelity, o których
nikt nie pamięta; premisa zadania brzmiała „nie ma żadnego odświeżania", a produkcja miała
cztery triggery. Zostają dwa nierozwiązane zastrzeżenia zapisane w nagłówku migracji: brak
`REFRESH CONCURRENTLY` (nie ma indeksu unikalnego) i ramię MULTI łączące jednostki po samej marce.

**Ta sama klasa: buckety Storage.** Ustalone 2026-08-28 przy `CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN`.
Buckety `audytorzy` i `zespoly` **istnieją** (potwierdzone `SELECT * FROM storage.buckets`), ale
zakłada je człowiek ręcznie w panelu Supabase — żadna migracja nie tworzy bucketu (`grep` po
`supabase/` na `storage.buckets`/`createBucket`: zero trafień). Z kodu nie da się rozstrzygnąć,
czy bucket istnieje: literał `signStoragePaths("audytorzy", …)` dowodzi tylko intencji autora.
**Pytanie „czy bucket istnieje" rozstrzyga się zapytaniem do bazy, nie greppem.**
