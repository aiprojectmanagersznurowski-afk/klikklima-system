---
name: sprzecznosc-before-snapshot-rodo
description: SEC-RODO-DELETE kontra CRM-CLIENT-ANONYMIZE-RODO — sprzeczność ROZSTRZYGNIĘTA przez człowieka 2026-09-03, czeka na wykonanie przez contract-steward w oknie kontraktowym
metadata:
  type: project
---

Zidentyfikowana 2026-09-03. Dwa wymagania w `contracts/requirements.contract.mjs` nie mogły być spełnione jednocześnie:

- `SEC-RODO-DELETE` (źródło `database_model.md#4`), AC3: migawka `before_snapshot` ma dane kontaktowe już zanonimizowane. AC2: `legal_basis` ma być zawsze stałą `RODO_ERASURE_REQUEST`.
- `CRM-CLIENT-ANONYMIZE-RODO` (źródło `docs/workorders/CLIENT-ANONYMIZATION-RODO.md`), AC10: żadna funkcja w repozytorium nie przechowuje kopii danych osobowych klienta sprzed anonimizacji. Kod pozwala operatorowi wybrać dowolną z pięciu podstaw prawnych.

**DECYZJA CZŁOWIEKA (2026-09-03):**
1. `SEC-RODO-DELETE` → `status: 'SUPERSEDED'` na rzecz `CRM-CLIENT-ANONYMIZE-RODO`, wzorem `CRM-DELETE-ADMIN-ONLY`. Kryterium `before_snapshot` znika z egzekwowanego rejestru — nie zostanie zaimplementowane.
2. `legal_basis` swobodnie wybierany przez operatora — rekomendacja przyjęta. `SEC-RODO-DELETE` AC2 uznane za nieaktualne, nie wymaga zmiany kodu (stan faktyczny jest zgodny z decyzją).
3. Pochodna: `CRM-DELETE-ADMIN-ONLY-CLIENTS` — po tym, jak `test-author` dopisał brakującą warstwę RLS (`rls-deny-by-default-freeze.test.ts`, AC-A3), wszystkie trzy warstwy są dziś dowiedzione. `contract-steward` powinien rozważyć `SUPERSEDED` też dla tego wpisu przy tej samej turze kontraktowej — WO `SEC-AUDIT-COVERAGE-RETAG.md` wcześniej odradzał to tylko z powodu brakującego dowodu RLS, którego już nie brakuje.

**Wykonanie:** wymaga otwartego okna kontraktowego i roli `contract-steward` — sama decyzja zapadła, ale `contracts/requirements.contract.mjs` jeszcze jej nie odzwierciedla (stan na koniec tej tury). Nie planuj implementacji `SEC-RODO-DELETE` do czasu wykonania tego kroku.

**Uzupełnienie 2026-09-03 (druga tura):** `before_snapshot` występuje NIE TYLKO w `SEC-RODO-DELETE`. To samo kryterium siedzi w AC `SEC-AUDIT-LOG` („before_snapshot nie zawiera danych osobowych w postaci jawnej"), a kolumny `before_snapshot` nie ma ani w migracji `20260901220000`, ani w modelu `AuditLog`. `contract-steward` musi usunąć to AC z `SEC-AUDIT-LOG` w tym samym oknie, inaczej wymaganie zostanie na zawsze niespełnialne.

**Why:** To jest przykład sprzeczności, której nie wolno rozstrzygać zgadywaniem — `audit_log` jest append-only, błędnego wpisu nie da się poprawić.

Powiązana: [[kk-trace-coverage-gaps-are-often-tagging]]. Szczegóły z cytatami: `docs/workorders/SEC-AUDIT-COVERAGE-RETAG.md`.
