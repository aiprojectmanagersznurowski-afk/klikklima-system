---
name: rls-disabled-incident
description: Na żywej bazie RLS było FIZYCZNIE wyłączone na 16 z 18 tabel, a anon miał pełne prawa — migracja SEC-RLS-BASELINE napisana 2026-08-24, uruchomiona i potwierdzona 2026-09-03; ZAMKNIĘTE, nie pisz jej drugi raz
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

**PUŁAPKA POWTÓRZENIA (2026-09-07).** Otwarto okno `SEC-RLS-BASELINE` i zlecono mi napisanie
„nowego" pliku `<timestamp>_security_enable_rls_baseline.sql` z inwentarzem identycznym co do
tabeli i nazwy polityki z tym, co już leży w `20260824185845`. Nie napisałem — duplikat migracji
o tej samej treści zostaje w repo na zawsze i przy `supabase db reset` wykonuje się dwa razy.
Trzy sygnały, że zlecenie jest powtórką, a nie nową pracą: (1) plik o tej nazwie już jest w
`supabase/migrations/`; (2) zlecenie mówiło „15 tabel", a jego własny inwentarz sumuje się do 16
(8+2+3+3) — dokładnie tyle, co w istniejącym pliku; (3) zlecona sekcja 5 to gołe `REVOKE`/`GRANT`
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
