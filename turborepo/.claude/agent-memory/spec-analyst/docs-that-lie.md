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
- `docs/01-ADR-spec-conflicts.md:86` (ADR-005, montaż dwuetapowy) — akapit „**Wykonane:**" wymienia
  tabelę `installation_phases` oraz pola `leads.declared_property_condition`,
  `quotes.installation_type`, `installations.installation_type` jako zrobione. Sprawdzone
  2026-09-16: ŻADNE z nich nie istnieje w `schema.prisma` ani w migracjach. „Wykonane" w ADR-ach
  znaczy „rozstrzygnięte na papierze i wpisane do kontraktu", NIE „wdrożone w bazie" — część
  o `T17`/guardach/`N8a` jest prawdziwa, część o schemacie nie.

**Why:** planowanie z tabeli w dokumencie zamiast z migracji/kontraktu produkuje Work Ordery
opisujące byty, których nie ma — a kontrakt jest źródłem prawdy (zasada zerowa CLAUDE.md).

**How to apply:** przy każdym WO opartym o `FIELD-APP-PLAN.md` potwierdź fakt w
`supabase/migrations/`, `schema.prisma` albo `contracts/` zanim wpiszesz go do kontekstu kodu.
Patrz też [[rbac-blokuje-role-w-wymaganiach]].
