---
name: project-2phase-scope-narrowing
description: Montaż dwuetapowy — D1/D2/D3 rozstrzygnięte 2026-09-16; cztery podsystemy (Field App, zdjęcia, PDF, płatności) odłożone w CAŁOŚCI, nie etapowo
metadata:
  type: project
---

Michał rozstrzygnął 2026-09-16 trzy pytania blokujące WO `FNL-2PHASE-BOOKING-MECHANICS`:

- **D1** — `installation_type` mieszka na **`instalacje.installation_type`**, nie na leadzie. Wariant „obie kolumny, kopiowane" odrzucony. Skutek: kryterium 2 `FNL-2PHASE` (wskazujące nieistniejące `quotes.installation_type`) trzeba przepisać.
- **D2** — **brak** minimalnej przerwy między etapami. Żadnego progu SLA, `CHECK`-a na datach ani walidacji aplikacyjnej. Gotowość mieszkania ocenia dyspozytor.
- **D3** — etap I zamyka **dyspozytor/admin w panelu B2B**. `T17.actor` zostaje `INSTALLER` jako aktor docelowy.

**Why:** Michał najpierw opisał pełny przepływ docelowy (monter w Field App, zdjęcia, protokół, faktura, link do etapu II). Po wyjaśnieniu, że Field App nie istnieje i przepływ wymaga czterech osobnych podsystemów (aplikacja mobilna, upload zdjęć, generowanie PDF, integracja płatności), sam zawęził zakres. To był świadomy wybór po poznaniu kosztu, nie brak wiedzy — argument „to cztery podsystemy, nie jedna funkcja" zadziałał.

**How to apply:** Odłożenie jest **całkowite**, nie etapowe. Formuła Michała: „zrób wyłącznie to, co reprezentowalne w panelu B2B". Żaden z czterech podsystemów nie powstaje nawet w formie zalążkowej — ani kolumna `photo_url`, ani `protocol_pdf`, ani `payment_status` „na przyszłość". Każdy wymaga własnego ADR-013. Gdy w przyszłym WO pojawi się temat montera/zdjęć/dokumentów/płatności, to jest osobny projekt, nie rozszerzenie. Patrz [[docs-that-lie]] (FIELD-APP-PLAN opisuje Field App jako byt istniejący) i [[project_n8a_payment_dependency]].

**Otwarte następstwo D1:** wiersz `instalacje` powstaje dopiero przy przypisaniu ekipy, więc audytor nie ma gdzie zapisać trybu w chwili wyceny. Świadomie poza zakresem — domknie to dopiero UI audytora dla `FNL-2PHASE` kryt. 2.
