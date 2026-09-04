---
name: funnel-contract-lacks-manual-flag
description: funnel.contract.mjs nie odróżnia przejść wyjątkowych od normalnych — trigger MANUAL jest bezużyteczny, wyjątkowość siedzi tylko w polu note; advanceLeadStatus to równoległa maszyna stanów
metadata:
  type: project
---

`contracts/funnel.contract.mjs` **nie ma** żadnego pola klasyfikującego przejście jako wyjątkowe/override. Atrybuty `TRANSITIONS`: `id, from, to, action, actor, trigger, guards, effects, req, status, note`.

- `trigger: 'MANUAL'` **nie nadaje się** na kryterium „ręcznej zmiany statusu” — mają go T01 (przypisanie audytora) i T05 (przypisanie ekipy), czyli codzienna praca dyspozytora.
- Wyjątkowość T07 („State Bypass — pomija E6”) i dwuznaczność T08 („webhook kuriera LUB ręczna akcja dyspozytora”) są zapisane **wyłącznie prozą w polu `note`** — dla maszyny to komentarz.
- `bind.transition` z `notifications.contract.mjs` to obiekt `{kind:'TRANSITION', transition:'T01'}`, a w `N_ROLLBACK` string `'T10|T11|T12|T13'` bez parsera. Grupuje przejścia po **wspólnym powiadomieniu**, nie po wyjątkowości — nie używać jako listy zamkniętej.
- Wyliczalne bez nowych pól: K1 niezgodność aktora (operator B2B wykonuje przejście przypisane CLIENT/SYSTEM/INSTALLER), K2 brak przejścia w `TRANSITIONS`, K3 krawędź bucketu (`STATE_META[x].kind === 'BUCKET'`). K1–K3 **nie łapią T07** — bypass wymaga nowego pola w kontrakcie albo listy literałów.

**Why:** Przy `SEC-AUDIT-LOG-MANUAL-STATUS` (2026-09-04) trzeba było ustalić obiektywne kryterium „ręcznej” zmiany statusu; intuicja („to przycisk-wyjątek”) nie da się przetestować, a kontrakt milczy.

**How to apply:** Planując cokolwiek, co ma odróżniać przejścia wyjątkowe od normalnych, zaproponuj **nowe pole w `TRANSITIONS`** jako punkt decyzyjny, nie listę nazw funkcji w `apps/`. Lista literałów w kodzie aplikacji nie ma mechanizmu, który zmusi autora kolejnego przejścia do jej aktualizacji — patrz [[repo-drift-traps]].

**`advanceLeadStatus` (`apps/b2b-web/src/app/(dashboard)/leads/actions.ts:626`) to druga, równoległa maszyna stanów.** Ma własną mapę `ALLOWED_TRANSITIONS`, nie woła `canTransition`/`findTransition`, pomija WSZYSTKIE guardy i WSZYSTKIE `effects`, i pozwala operatorowi wykonać sześć przejść przypisanych w kontrakcie klientowi/systemowi/monterowi oraz jedno (`AWAITING_AUDIT → NEW_LEAD`), którego kontrakt w ogóle nie zna. Skutek jest już udokumentowany w kodzie: komentarz w `rollbackLogisticsOrder` o leadzie „osieroconym przez inną ścieżkę zmiany statusu” (slot ekipy niezwolniony, SLA niewstrzymane).
