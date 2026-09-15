---
name: audit-log-resource-check-lags-rbac
description: CHECK audit_log_resource_check na żywej bazie zna tylko 13 pierwotnych zasobów — każde nowe wymaganie „loguj do audit_log" wymaga własnej migracji
metadata:
  type: project
---

`audit_log_resource_check` na **żywej bazie** (sprawdzone 2026-09-15) dopuszcza wyłącznie
13 pierwotnych zasobów: `clients, leads, quotes, installations, services, incidents, auditors,
crews, shipments, notification_queue, message_templates, authorized_users, audit_log`.
Tymczasem `RESOURCES` w `contracts/rbac.contract.mjs` urosło do ponad 25 pozycji
(`bookings`, `absences`, `visit_duration_baskets`, `availability_rules`, `system_config`, …).
`audit_log_operation_check` ma już 7 wartości, w tym `field_update` (migracja 20260910103000) —
rozjazd dotyczy **tylko kolumny `resource`**.

**Why:** ograniczenie powstało raz, przy RODO (migracja 20260901220000), i nie jest aktualizowane
razem z kontraktem RBAC. Nikt tego nie zauważył, bo dotąd logowaliśmy wyłącznie na starych zasobach.

**How to apply:** planując dowolne wymaganie, które ma pisać do `audit_log` na zasobie spoza tej
trzynastki, wpisz do WO osobny krok `contract-steward`: migracja `DROP CONSTRAINT IF EXISTS` +
`ADD CONSTRAINT` na wzór `supabase/migrations/20260910103000_audit_log_field_update_operation.sql`.
To zależność **blokująca całą Server Action**, nie tylko sam wpis — wpis audytowy idzie w tej samej
transakcji co zapis domenowy, więc wyjątek CHECK wywraca też zmianę biznesową.
Weryfikuj w `pg_constraint`, nie w plikach migracji (patrz [[migration-ledger-unreliable]],
[[db-probe-recipe]], [[audit-log-live-state]]).

Wzorzec zapisu `field_update` do naśladowania:
`apps/b2b-web/src/app/(dashboard)/auditors/actions.ts:552-584` — `justification` wyliczana przez
serwer funkcją `formatFieldChange` („etykieta: przed → po", wiele pól łączone `"; "` w JEDEN wpis),
`legalBasis: 'OTHER'`, `actorEmail` z `auth.getUser()` fail-closed, brak zmiany = brak wpisu.
