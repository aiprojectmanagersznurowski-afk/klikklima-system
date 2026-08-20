---
name: feedback-workorder-sizing
description: Dziel Work Order, gdy nie domknie się w trzech iteracjach GREEN — i powiedz to wprost zamiast pisać jeden wielki WO
metadata:
  type: feedback
---

Kiedy zlecony zakres nie mieści się w jednej pętli, **nie pisz jednego Work Ordera** — powiedz to
wprost i zaproponuj podział z kolejnością i uzasadnieniem.

**Why:** limit iteracji GREEN wynosi 3. WO `CRM-SAFE-RECORD-ACTIONS` (4 wymagania, 28 kryteriów
akceptacji) zużył wszystkie trzy iteracje i trzy rundy REVIEW. Michal sam wskazał ten precedens
jako to, czego ma nie być. WO, którego nie da się domknąć, kosztuje więcej niż drugie okno kontraktowe.

**How to apply:** granica przebiega po **artefakcie i roli**, nie po temacie. Kontrakt tekstowy,
schemat + migracja, narzędzia bramki, kod aplikacji — to cztery różne profile ryzyka i cztery różne
zestawy testów. Trzymaj ~10 kryteriów akceptacji na WO. Jeżeli wymuszona kolejność (np.
`R12-req-refs` + `R21-sla-shape`) nie zostawia legalnego stanu pośredniego, ten fragment musi zostać
razem — to jedyny argument za łączeniem. WO zablokowany decyzją człowieka opisuj do końca, ale
oznacz nagłówkiem „nie startować", zamiast zgadywać brakującą decyzję.

Powiązane: [[repo-drift-traps]], [[contract-sources-of-truth]]
