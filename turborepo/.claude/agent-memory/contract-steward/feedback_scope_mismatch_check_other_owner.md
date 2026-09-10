---
name: scope-mismatch-check-other-owner
description: Zanim zablokujesz DONE z powodu kryterium spoza zakresu WO, sprawdź czy ten obowiązek nie jest już zapisany przy innym OTWARTYM wymaganiu
metadata:
  type: feedback
---

Kryterium akceptacji, które opisuje pracę jawnie wyłączoną przez sekcję „Poza zakresem" WO, **nie zawsze** blokuje `DONE`. Rozstrzyga jedno pytanie: czy ten obowiązek ma inne, wciąż otwarte miejsce w rejestrze?

- **Ma inne miejsce → można zamknąć.** Nic nie wypada z rejestru.
- **Nie ma innego miejsca → ZATRZYMAJ SIĘ i wynieś do osobnego ID** (patrz [[feedback_closing_requirement_with_residual_debt]]).

**Why:** przy `FLD-AVAIL-WEEKLY-RULES` (2026-09-10) kryteria silnika odjęć i sumy puli nie miały żadnego innego właściciela — zamknięcie ukryłoby w rejestrze pracę, której kod nie wykonuje, więc powstały `CAL-SLOT-ENGINE` i `CAL-POOL-AGGREGATE`. Przy `CAL-SLOT-ENGINE` (ten sam dzień) sytuacja wyglądała identycznie z zewnątrz — AC6 kazał testowi bufora celować w „akcję rezerwującą", której to WO świadomie nie dostarcza — ale ten sam obowiązek był już zapisany DOSŁOWNIE w `CAL-TRAVEL-BUFFER` AC3 i `FLD-BOOKING-ATOMIC-ASSIGN` AC7, oba `TODO`. Blokada byłaby fałszywym alarmem i wymusiłaby duplikat.

**How to apply:** przy każdym zamykaniu na `DONE` zestaw sekcję „Poza zakresem" WO z listą AC rejestru. Dla każdej kolizji zrób `grep` frazy po `contracts/requirements.contract.mjs` i sprawdź `status` znalezionego właściciela. Dopiero brak właściciela (albo właściciel już `DONE`) jest powodem zatrzymania. Uzasadnienie tej analizy zapisz w commicie — inaczej następny czytelnik zobaczy tylko niespełnione kryterium przy `DONE`.
