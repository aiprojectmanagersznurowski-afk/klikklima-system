---
name: rls-disabled-incident
description: Na żywej bazie RLS było FIZYCZNIE wyłączone na 16 z 18 tabel — migracja SEC-RLS-BASELINE napisana 2026-08-24, uruchomiona 2026-09-03, stan potwierdzony ponownie 2026-09-10 (23/23 tabele RLS ON, 8 polityk); ZAMKNIĘTE, zlecenie napisania jej wracało już dwa razy, nie pisz duplikatu
metadata:
  type: project
---

2026-08-24, ticket `SEC-RLS-BASELINE` (nie część żadnego WO — znalezione podczas REVIEW dla
`FLD-AVAILABILITY-SPLIT`). Michal sprawdził bezpośrednimi zapytaniami na bazie z `DATABASE_URL`:
**16 z 18 tabel bazowych miało `pg_class.relrowsecurity = false`**, a rola `anon` miała na nich
pełne `INSERT/SELECT/UPDATE/DELETE/TRUNCATE`. Dwie istniejące polityki (`Allow anon insert on
klienci`, `Allow anon insert on leady`) były MARTWE — przy wyłączonym RLS silnik ich nie wykonuje.
Poprawnie zamknięte były tylko `soft_leady` i `system_config` (przypadkiem).

Napisałem `supabase/migrations/20260824185845_security_enable_rls_baseline.sql` (commit `c9f8c9a`).
Na dzień zapisu notatki plik NIE był jeszcze uruchomiony. **AKTUALIZACJA: uruchomiony i
zweryfikowany odczytem `pg_class.relrowsecurity` — patrz [[unapplied-security-migrations]],
stan na 2026-09-03.** Zanim cokolwiek na tym zbudujesz, sprawdź `pg_policies` / `relrowsecurity`
albo zapytaj: stan repo i stan bazy mogą się tu rozjeżdżać dłużej niż zwykle.

**STAN ZWERYFIKOWANY 2026-09-10** (odczyt `pg_class` na bazie z `DATABASE_URL`): 23 tabele bazowe,
**zero z `relrowsecurity=false`**, dokładnie 8 polityk — komplet z tego pliku, co do nazwy.
`available_combinations` (relkind `m`): anon SELECT=true, INSERT=false. Cel migracji osiągnięty
i utrzymany. Tabele dodane później (`notification_queue`, `audit_log`, `visit_duration_baskets`,
`availability_rules`, `absences`, `bookings`) mają `ENABLE` we własnych migracjach — inwentarz
NIE urósł o nic nieobsłużonego.

**ŻYWA BROŃ W REPO:** `packages/database/disable-rls.js` — 4 linijki, `DISABLE ROW LEVEL SECURITY`
na `klienci`, `adresy`, `leady`, bez żadnego zabezpieczenia, uruchamialne jednym `node`. To
najbardziej prawdopodobne wytłumaczenie, gdyby RLS kiedykolwiek „samo się" wyłączyło. Poza
zakresem zapisu contract-steward (guard-paths blokuje `packages/database/` poza `prisma/`) —
do usunięcia przez człowieka albo agenta z tym zakresem.

**PUŁAPKA POWTÓRZENIA (2026-09-07, powtórzona 2026-09-10).** Otwarto okno `SEC-RLS-BASELINE` i zlecono mi napisanie
„nowego" pliku `<timestamp>_security_enable_rls_baseline.sql` z inwentarzem identycznym co do
tabeli i nazwy polityki z tym, co już leży w `20260824185845`. Nie napisałem — duplikat migracji
o tej samej treści zostaje w repo na zawsze i przy `supabase db reset` wykonuje się dwa razy.
Trzy sygnały, że zlecenie jest powtórką, a nie nową pracą: (1) plik o tej nazwie już jest w
`supabase/migrations/`; (2) zlecenie podaje nieaktualną diagnozę („16 z 18", w powtórce z
2026-09-10 „15 z 18") — na bazie jest 23/23 z RLS ON, a inwentarz zlecenia jest identyczny
z istniejącym plikiem; (3) zlecona sekcja 5 to gołe `REVOKE`/`GRANT`
bez osłony `to_regclass`, czyli REGRES wobec tego, co w pliku już jest
(patrz [[live-db-objects-outside-migrations]] — bez osłony `supabase db reset` wywala się na
nieistniejącym widoku). **Właściwa reakcja na „RLS znowu wyłączone": nie nowy plik, tylko ponowne
uruchomienie istniejącego — jest w pełni idempotentny (ENABLE, DROP+CREATE POLICY, REVOKE+GRANT
opisują stan docelowy, nie deltę).** Nowy plik jest uzasadniony wyłącznie wtedy, gdy zmienia się
INWENTARZ (nowa tabela, nowy konsument supabase-js), i wtedy dostaje własny ticket i własną nazwę.

**Why:** decydujące dla oceny ryzyka było ustalenie, że Prisma łączy się jako `postgres`
z `rolbypassrls = true`. Dlatego włączenie RLS nie dotyka praktycznie żadnej logiki biznesowej
obu aplikacji — realnych konsumentów przez `supabase-js` jest garść i każdy jest wymieniony
z nazwy pliku w komentarzach migracji.

**How to apply:** nie zakładaj, że „tabela ma RLS, więc jest chroniona" — w tym projekcie to było
nieprawdą dla większości schematu. Przy każdej nowej tabelie trzymaj się zasady z migracji
20260821120000: `ENABLE` bez polityki = świadoma odmowa, a polityka powstaje tylko wtedy, gdy da się
wskazać PLIK, który jej potrzebuje. Osobno zarejestrowane, poza zakresem tamtej naprawy:
`storage.objects` ma RLS włączone i zero polityk, więc upload awatara ekipy
(`crews-client.tsx`, bucket `zespoly`) prawdopodobnie nie działa.
Powiązane: [[naming-baseline-on-migrations]].
