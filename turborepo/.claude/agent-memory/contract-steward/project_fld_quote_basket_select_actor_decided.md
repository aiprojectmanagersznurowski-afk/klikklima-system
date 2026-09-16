---
name: fld-quote-basket-select-actor-decided
description: FLD-QUOTE-BASKET-SELECT — D-1=(A)/D-2=(a) z 2026-09-16 zmieniły aktora z audytora na admin/dyspozytor w panelu B2B; status nadal TODO, RBAC bez zmian
metadata:
  type: project
---

`FLD-QUOTE-BASKET-SELECT` ma od 2026-09-16 aktora „osoba tworząca rezerwację (admin/dyspozytor
w panelu B2B)", nie „audytor". Decyzje Michała D-1 = (A) i D-2 = (a), zapisane w nagłówku
`docs/workorders/FLD-QUOTE-BASKET-SELECT.md` (WO: ROZSTRZYGNIĘTY). Steward poprawił wyłącznie
`statement` i `note` (commit f88e3f1, okno FLD-QUOTE-BASKET-WORDING). Status ZOSTAJE `TODO`,
cztery kryteria akceptacji NIETKNIĘTE, `rbac.contract.mjs` bez zmian — `bookings.create` to
nadal `[admin, dyspozytor]`, audytor go NIE dostaje.

**Why:** poprzednie brzmienie zakładało ekran w Field App, która jako aplikacja nie istnieje
(`apps/` = tylko `b2b-web`, `b2c-web`), więc opisywało aktora, któremu `createBookingAction`
odmawia przed jakimkolwiek zapytaniem do bazy. Test-author zacząłby od nieprawdziwej premisy.
Ścieżka audytora w Field App czeka na ADR-013 i użyje tego samego słownika.

**How to apply:** dwie pułapki przy tym wpisie.
(1) „Wizyta audytora" w CZWARTYM kryterium akceptacji dotyczy PRZEDMIOTU wizyty i puli `AUDITOR`,
nie operatora ekranu — wygląda jak przeoczona korekta, a jest poprawna. Nie przepisuj jej
decyzją D-1/D-2. Statement zawiera teraz jawne ostrzeżenie o tym.
(2) Nie proponuj dopisania `audytor` do `bookings.create` — to był odrzucony wariant D-2(b),
a `audytor:own` na `create` nie jest dziś wyrażalne (nie ma jeszcze rekordu, na którym liczy
się „own"). Wymagałoby osobnego ADR i jawnej zgody.

Zobacz też [[project_cal_scheduling_config_closed]] — to stamtąd ten wpis został wyniesiony
(AC2 `CAL-VISIT-DURATION-BASKETS`, połowa „konsument słownika"), oraz
[[feedback_verify_source_notes_before_blocking]] — `note` tego wpisu twierdziła, że decyzja
„w której aplikacji" jest niepodjęta; to był stan z dnia pisania, przy korekcie usunięty.
