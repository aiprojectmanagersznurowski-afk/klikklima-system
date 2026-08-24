---
name: rls-disabled-incident
description: Na żywej bazie RLS było FIZYCZNIE wyłączone na 16 z 18 tabel, a anon miał pełne prawa — migracja SEC-RLS-BASELINE napisana 2026-08-24, wymaga osobnej zgody na uruchomienie
metadata:
  type: project
---

2026-08-24, ticket `SEC-RLS-BASELINE` (nie część żadnego WO — znalezione podczas REVIEW dla
`FLD-AVAILABILITY-SPLIT`). Michal sprawdził bezpośrednimi zapytaniami na bazie z `DATABASE_URL`:
**16 z 18 tabel bazowych miało `pg_class.relrowsecurity = false`**, a rola `anon` miała na nich
pełne `INSERT/SELECT/UPDATE/DELETE/TRUNCATE`. Dwie istniejące polityki (`Allow anon insert on
klienci`, `Allow anon insert on leady`) były MARTWE — przy wyłączonym RLS silnik ich nie wykonuje.
Poprawnie zamknięte były tylko `soft_leady` i `system_config` (przypadkiem).

Napisałem `supabase/migrations/20260824185845_security_enable_rls_baseline.sql`. Na dzień zapisu
tej notatki **plik istnieje, ale NIE został uruchomiony na żywej bazie** — to osobny, jawny krok
wymagający zgody Michala. Zanim cokolwiek na tym zbudujesz, sprawdź `pg_policies` / `relrowsecurity`
albo zapytaj: stan repo i stan bazy mogą się tu rozjeżdżać dłużej niż zwykle.

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
