---
name: n8a-payment-dependency
description: Zależność N8a (protokół + proforma + link płatności) czeka na decyzję księgową i nie jest jeszcze zaplanowana w żadnym Work Orderze
metadata:
  type: project
---

Rozszerzenie powiadomienia `N8a` (`handover_protocol`, `amount`, rozdzielenie `link` na `booking_link`/`payment_link`) wymaga najpierw **decyzji zewnętrznej — księgowego**: czy dokument etapu I to faktura proforma (wezwanie do zapłaty), czy faktura zaliczkowa. Ta sama otwarta kwestia dotyczy zaliczki w przepływie jednoetapowym (FIELD-APP-PLAN 6.4a, akapit „Pytanie księgowe").

**Why:** dokumenty (`FIELD-APP-PLAN.md` 6.4a, `database_model.md` „Montaż dwuetapowy") opisują przepływ dokumentów i płatności, ale żaden Work Order ani ADR go nie planuje; wybór rodzaju dokumentu przesądza o modelu danych faktur, więc zgadnięcie kosztuje migrację.

**How to apply:** nie planuj implementacji dokumentów/płatności etapu I bez tej decyzji; w Work Orderach traktuj ją jako blokadę i wypisz jako `WYMAGA DECYZJI`. Wymagania dotknięte: `FNL-2PHASE-BOOKING` (kryterium 7), `FNL-2PHASE-INVOICE`. Powiązane: [[docs-that-lie]].

**Rozstrzygnięcie zakresowe 2026-09-16 (Michał):** `FNL-2PHASE-BOOKING` podzielone na mechanikę
rezerwacji (WO `docs/workorders/FNL-2PHASE-BOOKING-MECHANICS.md`, robione teraz) i dokumenty/płatności
(odłożone). UWAGA: wpis `FNL-2PHASE-INVOICE` JUŻ ISTNIEJE w rejestrze (`contracts/requirements.contract.mjs:161`)
— kryterium 7 się do niego DOPISUJE, nie tworzy drugiego wpisu.
