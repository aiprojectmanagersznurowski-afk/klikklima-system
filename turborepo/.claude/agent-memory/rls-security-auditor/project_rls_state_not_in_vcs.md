---
name: project-rls-state-not-in-vcs
description: RLS w KlikKlima nie jest w repozytorium — polityki konfigurowane poza migracjami; co z tego wynika dla każdego audytu
metadata:
  type: project
---

Stan RLS dla tabel z danymi osobowymi (`audytorzy`, `zespoly_monterskie`, `klienci`, `leady`,
`AuthorizedUser`) **nie istnieje w repozytorium**. Baseline (`supabase/migrations/00000000000000_baseline.sql`,
18 tabel) nie zawiera ani jednego `ENABLE ROW LEVEL SECURITY` ani `CREATE POLICY`. Jedyne
`ENABLE ROW LEVEL SECURITY` w całym `supabase/` dotyczą trzech nowych tabel z sierpnia 2026
(`availability_declarations`, `legal_document_versions`, `employee_consents`) i żadna z nich nie ma polityki
(fail-closed, świadome). Migracja `20260821120000` mówi to wprost w komentarzu: „polityki są
konfigurowane poza migracjami".

**Why:** to znaczy, że werdykt „tabela X ma/nie ma RLS" jest z repozytorium **niedowodliwy**.
Dodatkowo `apps/b2b-web/src/utils/supabase/middleware.ts` czyta `AuthorizedUser` i `audytorzy`
klientem z kluczem **anon** — skoro bramka logowania działa, te tabele muszą być czytelne dla
roli anon/authenticated przez PostgREST. Klucz anon jest publiczny (jest w bundlu przeglądarki).
`audytorzy` i `zespoly_monterskie` mają kolumny `iban`, `nip`, `adres`.

**How to apply:** przy każdym audycie nie pisz „RLS jest OK/nie ma RLS" na podstawie lektury.
Napisz wprost, że stan jest poza kontrolą wersji, i podaj zapytanie do wykonania na żywej
instancji:
`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r';`
oraz `SELECT * FROM pg_policies WHERE schemaname='public';`
Dopóki nikt tego nie uruchomi, to jest otwarte ryzyko, a nie „brak zastrzeżeń".
Patrz też [[feedback-audit-execution-constraints]].
