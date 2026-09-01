---
name: unapplied-security-migrations
description: Trzy migracje bezpieczeństwa leżą w repo NIEURUCHOMIONE na żywej bazie — obecność pliku bywała mylona z faktem zastosowania
metadata:
  type: project
---

Stan na 2026-09-01. W `supabase/migrations/` leżą migracje bezpieczeństwa, których NIKT nie uruchomił
na bazie produkcyjnej — każda czeka na osobną, jawną zgodę człowieka:

- `20260824185845_security_enable_rls_baseline.sql` — włączenie RLS (patrz [[rls-disabled-incident]])
- `20260901120000_security_revoke_authorized_user_writes.sql` — REVOKE zapisów na `public."AuthorizedUser"`
  od `anon`/`authenticated`; SELECT ZOSTAJE, bo czytają go polityki RLS Storage z `20260828120000`
- `20260901120100_security_knowledge_base_buckets_private.sql` — `bazawiedzy`/`urzadzenia` → `public = false`

**Why:** obecność pierwszej z nich została raz odczytana jako dowód, że „RLS jest włączone". Nie było.
Plik migracji dowodzi INTENCJI, nie STANU SERWERA — a test statyczny zamrażający treść SQL dowodzi
jeszcze mniej, bo czyta plik z repozytorium, nie bazę. Dlatego każda nowa migracja bezpieczeństwa
dostaje w nagłówku ramkę `NIE ZOSTAŁA URUCHOMIONA` plus sekcję ręcznej weryfikacji po uruchomieniu.

Do listy dołączyła 2026-09-01 migracja NIEBEZPIECZEŃSTWOWA, ale objęta tą samą regułą:
`20260901210000_logistics_sla_paused_at.sql` (kolumna `leady.logistics_sla_paused_at`, Faza A
WO LOGISTICS-SHIPPING-EFFECTS). Wzorzec „nagłówek mówi NIE URUCHOMIONA" objął już każdą migrację,
nie tylko te z domeny bezpieczeństwa.

**How to apply:** nigdy nie raportuj takiej migracji jako „naprawione" ani nie przestawiaj wymagania
na `DONE` na jej podstawie. W podsumowaniu zawsze osobna lista „wymaga zgody na żywe uruchomienie"
z pełnymi ścieżkami. Przy `20260901120100` istnieje twardy warunek wstępny: po uruchomieniu sprawdzić
curl-em trzy długoterminowe podpisane URL-e do `bazawiedzy` wpisane na sztywno w
`apps/b2c-web/lib/articles.ts` (linie 16, 40, 72) — B2C czyta ten bucket przez nie, a nie publicznie.
Powiązane: [[live-db-objects-outside-migrations]], [[naming-baseline-on-migrations]].
