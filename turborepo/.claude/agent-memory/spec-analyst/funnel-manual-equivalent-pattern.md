---
name: funnel-manual-equivalent-pattern
description: Gdy WO każe operatorowi panelu wykonać przejście o aktorze CLIENT/SYSTEM/INSTALLER/AUDITOR — potrzebny jest manualEquivalent, inaczej audit_log zapełnia się fałszywymi manual_status_change
metadata:
  type: project
---

Kryterium **K1** klasyfikatora w `contracts/funnel.contract.mjs` klasyfikuje jako `manual_status_change` każde przejście, którego `actor` to CLIENT / SYSTEM / INSTALLER / AUDITOR, a wykonuje je operator panelu B2B. Flaga `manualEquivalent: true` anuluje **wyłącznie K1** (nie K2/K3/K4) i znaczy: „istnieje w pełni legalna, równoważna ścieżka ręczna operatora panelu".

**Why:** To odruchowo wygląda na potrzebę zmiany `actor` albo dopisania drugiego aktora — a `actor` jest polem POJEDYNCZYM i lista zmieniłaby kształt kontraktu oraz każdą regułę czytającą `t.actor`. Kontrakt ma już mechanizm na dokładnie ten przypadek. Precedens działający: `T08` (webhook kuriera LUB ręczna akcja dyspozytora).

**How to apply:** Za każdym razem, gdy WO planuje wykonanie przejścia z panelu B2B, a `actor` tego przejścia nie jest operatorem panelu — dopisz `manualEquivalent: true` do listy zmian kontraktu ORAZ kryterium akceptacji „ta akcja NIE tworzy wpisu `manual_status_change`". Bez tego normalna praca jest stale logowana jako obejście reguły i audyt przestaje wykrywać prawdziwe nadużycia. Walidator R30 dopuszcza flagę tylko tam, gdzie K1 faktycznie działa, więc na przejściu z aktorem-operatorem nie przejdzie.

**Pułapka towarzysząca:** przejście może nieść efekt `do:`, którego zawężony WO nie realizuje (np. `T17` niesie `do:issuePhaseOneInvoice`, a faktury są odłożone). Efekty domenowe są sprawdzane przez test kontraktowy — zawsze sprawdź `effects` przejścia wobec zakresu WO i zgłoś kolizję jako punkt do rozstrzygnięcia przez `contract-steward`. Patrz [[project-2phase-scope-narrowing]].
