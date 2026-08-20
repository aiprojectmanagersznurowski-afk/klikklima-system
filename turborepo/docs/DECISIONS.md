# Log decyzji projektowych

Ten dokument rejestruje decyzje człowieka podjęte **poza** oknem kontraktowym — zanim trafią do `contracts/*.contract.mjs`. To nie jest to samo co `docs/01-ADR-spec-conflicts.md`: tamten plik rozstrzyga sprzeczności między dokumentami źródłowymi i jest zamknięty (12/12), a każdy jego wpis jest już zastosowany w kontrakcie. Tutaj trafiają decyzje z dokumentów opisowych, które dopiero *będą* materiałem dla `contract-steward`a.

Format wpisu: data, kontekst, decyzja, uzasadnienie, gdzie decyzja jest opisana.

---

## 2026-08-20 — Field App: stos, zakres, kalendarz, GPS/RODO

Kontekst: zastąpienie stubu `docs/architecture/field_app_requirements.md` pełną specyfikacją, na podstawie specyfikacji biznesowej (PDF od klienta) i czterech decyzji podjętych przez Michała podczas tej pętli.

**D1 — stack Field App.** React Native + Expo, jako `apps/field-app` w monorepo. Odrzucone: PWA, wariant hybrydowy. Powód: promień 3 km (alert „w drodze") wymaga geolokalizacji działającej w tle, czego PWA na iOS nie zapewnia w wystarczającym stopniu.

**D2 — zakres wersjonowany.** v1 = odbiór zleceń, profil + certyfikaty, geofencing, dokumentacja zdjęciowa, zamknięcie montażu (E7→E8). v2 = oferta trójwariantowa + kalkulator wycen + generowanie PDF ofert/umów. v3 = płatności, faktury, wypłaty wynagrodzenia. Explicite: **brak płatności i wypłat w v1**.

**D3 — kalendarz i dostępność** (rozszerza PDF). Audytorzy i ekipy monterskie ustawiają w Field App własną dostępność godzinową per dzień tygodnia. Kalendarz widoczny klientowi to suma dostępnych terminów wszystkich audytorów/ekip. **Google Calendar jest domyślnym, obowiązkowym kalendarzem** dla audytorów i ekip — nie opcją integracyjną. Ustawienie się jako niedostępny zapamiętuje wcześniejszą dostępność i reaktywuje ją przy powrocie.

**D4 — GPS i RODO.** GPS zbierany wyłącznie w oknie czasowym aktywnego, przypisanego zlecenia. Zapis jako zdarzenia punktowe (odblokowanie 20 m, przecięcie 3 km, zamknięcie), nie ciągły ślad trasy. Pracownik musi zaakceptować zgody RODO i regulamin przed podjęciem zleceń; **musi istnieć miejsce, w którym administrator wgrywa i wersjonuje treść tych dokumentów** (dziś nie istnieje — patrz otwarte pytanie 6 w `field_app_requirements.md`).

**Gdzie opisane:** `docs/architecture/field_app_requirements.md` (rozdziały 2, 4.1, 6, 7, 13). Ten dokument jest materiałem wejściowym dla `spec-analyst`a (Work Ordery) i `contract-steward`a (nowe wymagania, ewentualny `contracts/field.contract.mjs` dla progów geofencingu, rozszerzenia `notifications.contract.mjs` i `rbac.contract.mjs`) — żadna z tych czterech decyzji nie jest jeszcze w kontrakcie.

**Otwarte przy tej okazji, nierozstrzygnięte:** dziesięć pytań w rozdziale 12 tego samego dokumentu (m.in. model integracji z Google Calendar — dwukierunkowa synchronizacja czy tylko odczyt zajętości; czy weryfikacja zdjęć z panelu to osobny krok decyzyjny administratora między zamknięciem montażu a wysyłką protokołu).
