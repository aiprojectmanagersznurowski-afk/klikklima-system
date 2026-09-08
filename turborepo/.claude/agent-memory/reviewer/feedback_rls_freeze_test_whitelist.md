---
name: rls-freeze-test-whitelist
description: przy recenzji statycznych testów "RLS deny-by-default" na migracji SQL wymagaj asercji whitelist (każda polityka na tabeli musi być dokładnie dozwolona), nie blacklist na FOR DELETE/FOR ALL
metadata:
  type: feedback
---

Statyczny test zamrażający RLS (`readFileSync` na
`supabase/migrations/20260824185845_security_enable_rls_baseline.sql`) musi asertować
**whitelist**: każda `CREATE POLICY` dotykająca tabeli X jest dokładnie tą jedną
oczekiwaną (np. `FOR INSERT TO anon`). Asercja typu „zero wystąpień `FOR DELETE` /
`FOR ALL`" jest niewystarczająca.

**Why:** zweryfikowane mutacją w recenzji 2026-09-08 (`leads-rls-deny-by-default.test.ts`)
— dwa mutanty przeżyły test na zielono, mimo że realnie dają DELETE na `public.leady`:
1. `CREATE POLICY "x" ON public.leady TO authenticated USING (true);` — brak klauzuli
   `FOR` oznacza w Postgresie **domyślnie `FOR ALL`**, więc blacklist na literał
   `FOR DELETE`/`FOR ALL` tego nie łapie.
2. `CREATE POLICY "x" ON leady FOR DELETE ...` — bez kwalifikatora `public.`, więc
   regex `ON public\.leady\b` nie dopasowuje.
Wariant dla `zespoly_monterskie` tej dziury nie ma, bo asertuje zero polityk w ogóle —
to działa tylko dla tabel bez żadnej legalnej polityki.

**How to apply:** dotyczy pozostałych `CRM-DELETE-ADMIN-ONLY-*` (installations,
services, incidents, auditors). Jeśli tabela ma jakąkolwiek legalną politykę, żądaj
formy: zbierz wszystkie chunki `CREATE POLICY` wskazujące tabelę (regex tolerujący brak
`public.`) i porównaj zbiór do listy oczekiwanych — brak `FOR` traktuj jak `FOR ALL`.
Zawsze weryfikuj takie testy własną mutacją, nie raportem implementera.
