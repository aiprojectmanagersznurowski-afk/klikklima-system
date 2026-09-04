---
name: t08-classifier-vs-d1-tension
description: Kryterium K1 klasyfikuje T08 (markDelivered) jako ręczną zmianę statusu, ale decyzja D1 człowieka wyklucza markAsDelivered z audytu — sprzeczność nierozstrzygnięta, wybuchnie w fali C
metadata:
  type: project
---

W wymaganiu `SEC-AUDIT-LOG-MANUAL-STATUS` (zarejestrowanym 2026-09-04) klasyfikator „ręcznej zmiany statusu" liczy cztery kryteria z `contracts/funnel.contract.mjs`: K1 (aktor spoza operatorów panelu), K2 (brak pary from-to), K3 (krawędź bucketu), K4 (`override: true`).

**Sprzeczność, której nie da się rozwiązać w kodzie klasyfikatora:** T08 `markDelivered` ma `actor: 'SYSTEM'`, więc **K1 klasyfikuje je jako ręczne**. Tymczasem decyzja D1 człowieka wprost **wyklucza** funkcję `markAsDelivered` z audytu (uzasadnienie: to potwierdzenie faktu fizycznego — paczka przyszła — a nie obejście reguły). WO samo to odnotowuje jako „sporne, wymaga świadomej zgody, bo łamie K1".

Pole `override` tego nie rozwiązuje: **dodaje** klasyfikację, nigdy nie odejmuje. Nie ma dziś pola odwrotnego.

**Why:** `note` przy T08 mówi „Webhook kuriera LUB ręczna akcja dyspozytora (ten sam action)" — kontrakt sam sobie przeczy, bo `actor: 'SYSTEM'` opisuje tu „kto zwykle", a nie „kto ma prawo". To jest dokładnie ryzyko wypisane w sekcji „Ryzyka i nieznane" WO: jeżeli `actor` jest tylko poglądowe, K1 upada jako kryterium.

**How to apply:** problem jest uśpiony w falach A i B (dotyczą archiveLost/returnToFunnel oraz logistyki). Wybuchnie w **fali C** (`advanceLeadStatus`), bo tam klasyfikator liczy K1 per przejście i przejście `HARDWARE_IN_TRANSIT → AWAITING_INSTALLATION` wykonane z panelu wygeneruje wpis, mimo że ta sama zmiana zrobiona przyciskiem „Paczka dostarczona" go nie wygeneruje — czyli audyt z obejściem w sąsiedniej zakładce (wprost sprzeczne z AC12). Przed falą C zażądaj decyzji człowieka: albo T08 dostaje właściwego aktora w kontrakcie, albo powstaje jawne pole wyłączające, albo `markAsDelivered` wraca do zakresu. Nie rozstrzygaj tego sam — to zmiana zakresu wymagania, nie detal implementacji. Powiązane: [[requirement-status-drift]].
