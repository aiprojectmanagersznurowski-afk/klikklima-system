---
name: contract-sources-of-truth
description: Gdzie w KlikKlima szukać progów, guardów i słowników zanim zaproponujesz nowe — i które wpisy są tylko propozycją do zatwierdzenia
metadata:
  type: reference
---

Przed zaproponowaniem jakiegokolwiek progu, guardu czy słownika sprawdź, czy już nie istnieje:

- `contracts/sla.contract.mjs` — wszystkie progi czasowe (`COLD_LEAD_REPRICE` 30 d, `CERT_EXPIRY_WARNING` 30 d, ...). Literał liczbowy w kodzie to zawsze błąd.
- `contracts/funnel.contract.mjs` — stany, przejścia `T##`, `GUARD_IDS`, `LOST_REASONS`.
- `contracts/rbac.contract.mjs` — `RESOURCES`, `PERMISSIONS`, `DELETE_POLICIES` (np. `auditors → BLOCK_UNTIL_REASSIGNED`), `AUDIT_REQUIREMENTS`.
- `contracts/requirements.contract.mjs` — pole `acceptance` bywa **ostrzejsze niż dokument źródłowy** w `docs/architecture/`. To najczęstsze źródło sprzeczności w tym repo; cytuj oba i zgłaszaj `WYMAGA DECYZJI` zamiast wybierać.
- `packages/contracts/src/generated/` — gotowe do importu, nigdy nie edytować.

Niektóre wpisy kontraktu są **jawnie oznaczone jako propozycja do potwierdzenia przez człowieka** (np. `LOST_REASONS` w `contracts/funnel.contract.mjs` — dokument źródłowy podaje tylko dwa przykłady). Komentarz nad wpisem mówi to wprost — czytaj komentarze, nie tylko dane.

Pokrycie testami sprawdzasz przez `node tools/kk-trace.mjs` (domena `crm` miała 0/21 na 2026-08-20). Zamrożony dług nazewniczy: `tools/kk-naming-baseline.json`, ticket `KK-NAMING-BASELINE`.

Powiązane: [[repo-drift-traps]]
