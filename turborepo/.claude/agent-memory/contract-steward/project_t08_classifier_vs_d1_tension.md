---
name: t08-classifier-vs-d1-tension
description: ROZSTRZYGNIĘTE 2026-09-04 polem manualEquivalent na T08 — kontrakt ma teraz dwie flagi klasyfikacyjne o przeciwnych znakach (override dodaje, manualEquivalent odejmuje K1)
metadata:
  type: project
---

Sprzeczność K1 vs D1 na T08 (`markDelivered`, `actor: 'SYSTEM'`, ale legalna ścieżka ręczna dyspozytora) została **rozstrzygnięta 2026-09-04** decyzją człowieka D4 (WO `SEC-AUDIT-LOG-MANUAL-STATUS-T08-FIX`): wąskie pole `manualEquivalent: true` TYLKO na T08, zamiast przebudowy `actor` na tablicę dla wszystkich 17 przejść.

**Why:** `actor` w tym kontrakcie opisuje „kto zwykle", nie „kto ma prawo". Zamiast naprawiać semantykę `actor` (17 przejść, złamanie kompatybilności), człowiek wybrał adnotację punktową.

**How to apply:** kontrakt ma teraz **dwie flagi klasyfikacyjne o przeciwnych znakach** i łatwo je pomylić:
- `override: true` — DODAJE klasyfikację (K4). Zabroniona tam, gdzie łapie K1/K3 (R29).
- `manualEquivalent: true` — ODEJMUJE wyłącznie K1. Dozwolona WYŁĄCZNIE tam, gdzie K1 łapie (R30).
Zbiory są rozłączne z konstrukcji, więc nigdy nie występują razem — jeśli kiedyś wystąpią, jedna z reguł została osłabiona.

Pułapka do zapamiętania: pole w kontrakcie samo nie zmienia zachowania. `manualEquivalent` żyje w `contracts/funnel.contract.mjs` + `packages/contracts/src/generated/funnel.ts`, ale **anulowanie K1 musi zaimplementować `implementer-server`** w `apps/b2b-web/src/lib/audit/manual-status-classifier.ts` — `contract-steward` nie ma zakresu zapisu do `apps/` (`tools/kk.config.mjs`). Do czasu tej zmiany flaga jest deklaratywna, a T08 nadal generuje wpis audytowy. Powiązane: [[requirement-status-drift]], [[steward-cannot-write-tests]].
