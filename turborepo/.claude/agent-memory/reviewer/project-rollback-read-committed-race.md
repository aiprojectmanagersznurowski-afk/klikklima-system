---
name: project-rollback-read-committed-race
description: Blokada FOR UPDATE na leady w rollbackLogisticsOrder istnieje w kodzie, ale ŻADEN test jej nie pilnuje — mutanty M1/M4 przeżywają cały zestaw 633 testów
metadata:
  type: project
---

`rollbackLogisticsOrder` (`apps/b2b-web/src/app/(dashboard)/logistics/actions.ts`) otwiera
`$transaction` i jako PIERWSZĄ instrukcję wykonuje
`tx.$queryRaw\`SELECT id, status FROM leady WHERE id = ${leadId}::uuid FOR UPDATE\``,
dopiero potem `tx.leady.findUnique` i decyzję o przejściu. Kolejność jest poprawna —
pod READ COMMITTED sam ponowny odczyt nic nie daje, blokada musi go poprzedzać.

**Ale ta naprawa jest nieotestowana.** Zweryfikowane mutacyjnie 2026-09-02 na pełnym
zestawie (633 testy, 52 pliki):
- M1 = usunięcie tego `$queryRaw` → **633/633 zielone** (mutant przeżywa),
- M4 = przeniesienie blokady ZA `findUnique` → **633/633 zielone** (mutant przeżywa).

Dla kontrastu w tym samym przebiegu ginęły: M2 (throw w gałęzi idempotentnej),
M3 (usunięcie filtru `'PLANNED'`), M5 (nadpisanie `logistics_sla_paused_at`).
`AC-A6` po poluzowaniu sprawdza już tylko `calls.some(FOR UPDATE + instalacje)` —
o blokadzie na `leady` nie mówi nic.

**Why:** stawką jest faza C — `bucket_entered_at` staje się `bucketKey` w
`idempotency_key` powiadomienia, więc rozjazd = dwa SMS-y do klienta za jedno
zdarzenie (pułapka 3 z CLAUDE.md). Kod, którego żaden test nie pilnuje, wróci do
starej postaci przy pierwszym refaktorze, a CI zostanie zielone.

**How to apply:** brakująca asercja jest tania i wykonalna na istniejących mockach —
`txQueryRawMock.mock.calls[0]` musi zawierać `leady` + `FOR UPDATE`, a
`txQueryRawMock.mock.invocationCallOrder[0] < txLeadFindUniqueMock.mock.invocationCallOrder[0]`.
Dopóki jej nie ma, traktuj naprawę wyścigu jako deklaratywną.

Powiązane: [[review-mutation-testing-checklist]], [[feedback_mutation_proof_required]],
[[reviewer-mutation-harness-scratchpad]].
