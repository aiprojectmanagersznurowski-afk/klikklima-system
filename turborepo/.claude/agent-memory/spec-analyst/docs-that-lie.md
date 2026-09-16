---
name: docs-that-lie
description: Miejsca w docs/architecture, które są nieaktualne wobec kontraktu/migracji — nie planuj z nich bez weryfikacji
metadata:
  type: project
---

Dokumenty w `docs/architecture/` bywają nieaktualne wobec kontraktu i migracji. Znane rozbieżności:

- `FIELD-APP-PLAN.md` 6.4, tabela koszyków — nadal wymienia „Montaż duży = 2 dni". Ten koszyk
  ŚWIADOMIE nie istnieje (korekta Michała 2026-09-10). Prawdę mówi seed w migracji
  `20260910100000_fld_calendar_foundation.sql` (7 koszyków) i `CAL-VISIT-DURATION-BASKETS` AC8.
- `FIELD-APP-PLAN.md` A1/A3 — Field App opisana jako byt istniejący/planowany, ale ADR-013
  (warstwa zapisu dla React Native) NIE został wydany, a `apps/` zawiera tylko `b2b-web`
  i `b2c-web`. Każde wymaganie z domeną `field`, które mówi o „ekranie w Field App", jest
  dziś bezdomne.

**Why:** planowanie z tabeli w dokumencie zamiast z migracji/kontraktu produkuje Work Ordery
opisujące byty, których nie ma — a kontrakt jest źródłem prawdy (zasada zerowa CLAUDE.md).

**How to apply:** przy każdym WO opartym o `FIELD-APP-PLAN.md` potwierdź fakt w
`supabase/migrations/`, `schema.prisma` albo `contracts/` zanim wpiszesz go do kontekstu kodu.
Patrz też [[rbac-blokuje-role-w-wymaganiach]].
