# KlikKlima System — Główny Backlog Projektu

> **Data aktualizacji:** 2026-09-17  
> **Synchronizacja Trello:** [KlikKlima - Backlog Produktów](https://trello.com/b/9DCBpyzd/klikklima-backlog-produkt%C3%B3w) | [Tablica Zespołu KK](https://trello.com/b/hFuDBT36/kk)  
> **Skrypt synchronizacji:** `scripts/sync-trello-backlog.mjs`

---

## 📊 Podsumowanie Statusu Projektu

- **Zadania Ukończone (Done):** 28 zadań strategicznych (ponad 60 wymagań w `contracts/requirements.contract.mjs` z zaliczonymi testami, 126 plików testowych, 1894+ testy zielone)
- **Zadania w Backlogu (Do zrobienia):** 30 zadań usystematyzowanych według pakietów technologicznych i operacyjnych przed startem komercyjnym
- **Zadania Zablokowane / Do decyzji (Blocked):** 2 tematy prawne/biznesowe (Field App GPS & Fotodokumentacja)

---

## ✅ 1. Zadania Ukończone (Done)

Zadania zrealizowane, wdrożone w kodzie, zaimplementowane w migracjach PostgreSQL i pokryte testami automatycznymi.

### 🔒 Bezpieczeństwo, RBAC i Audyt

- [x] **P0 SEC-READ-GATES: Autoryzacja widoków danych**  
      _Zamknięcie luki nieautoryzowanego odczytu danych osobowych klienta w `getCustomers`, `installations`, `services`, `incidents`, `crews`, `auditors`._  
      `@REQ: SEC-AUTHZ-B2B-READS`, WO: `SEC-READ-GATES.md`.
- [x] **SEC-AUTHZ-USER-MGMT: Zarządzanie w RBAC**  
      _Zabezpieczenie dodawania i edycji ról użytkowników w tabeli `authorized_users`._  
      `@REQ: SEC-AUTHZ-USER-MGMT`, WO: `SEC-AUTHZ-DEFAULT-ROLE.md`.
- [x] **SEC-AUDIT-LOG: Historyzacja (Zapis Audytu Append-Only)**  
      _Niezmienny rejestr audytowy zdarzeń, blokada mutacji i usuwania z poziomu bazy, audytowanie ręcznych zmian statusów i ról._  
      `@REQ: SEC-AUDIT-LOG`, `@REQ: SEC-AUDIT-LOG-APPEND-ONLY`, `@REQ: SEC-AUDIT-LOG-MANUAL-STATUS`, `@REQ: SEC-AUDIT-LOG-ROLE-CHANGE`, `@REQ: SEC-AUDIT-LOG-DELETE`.
- [x] **SEC-ASSIGNMENT-POOL-MINIMIZE: Ochrona przed przeciekiem danych**  
      _Zawężenie zwracanych danych w zapytaniach `getAuditors()` i `getCrews()` (brak wycieku danych finansowych/adresowych na frontend)._  
      `@REQ: SEC-ASSIGNMENT-POOL-MINIMIZE`, `@REQ: SEC-LEADS-LIST-MINIMIZE`, `@REQ: SEC-LEADS-LIST-SCALARS`.
- [x] **Check-types w CI/CD (Dług techniczny P2)**  
      _Dodanie pełnej weryfikacji typowania TypeScript (`turbo run check-types`) do procesu weryfikacji bramki commitowej._

### 🏢 Panel B2B (CRM, Lejek & Logistyka)

- [x] **DOCS-BROWSER: Wewnętrzna przeglądarka dokumentacji w panelu B2B (`/dokumentacja`)**  
      _Bezpieczny moduł przeglądania dokumentacji architektury, prezentacji biznesowych i diagramów Mermaid z poziomu aplikacji z bramką autoryzacyjną._
- [x] **FNL-2PHASE-BOOKING & ROLLBACK-RELEASE: Mechanika rezerwacji montażu dwuetapowego**  
      _Obsługa stanu deweloperskiego (etap I podtynkowy, etap II montażowy) z osobnymi rezerwacjami, koszykami czasowymi, unikalnymi indeksami i zwolnieniem rezerwacji przy rollbacku._  
      `@REQ: FNL-2PHASE-BOOKING`, `@REQ: FNL-2PHASE-ROLLBACK-RELEASE`.
- [x] **CRM-PROJECT-NUMBER: Sekwencyjna numeracja zleceń (`L-000123`)**  
      _Wdrożenie czytelnego dla ludzi identyfikatora projektu opartego o sekwencję bazy danych `leads_project_number_seq`._  
      `@REQ: CRM-PROJECT-NUMBER`.
- [x] **CRM-CLIENT-ANONYMIZE-RODO: Anonimizacja danych RODO**  
      _Bezpieczna, atomowa anonimizacja danych osobowych klientów na żądanie (zastąpienie danych PII z zachowaniem integralności relacji)._  
      `@REQ: CRM-CLIENT-ANONYMIZE-RODO`, WO: `CLIENT-ANONYMIZATION-RODO.md`.
- [x] **CRM-AUDYT-KARTOTEKA & ZESP-KARTOTEKA: Kartoteki Osobiste**  
      _14-polowe formularze tworzenia i edycji audytorów oraz ekip (uprawnienia F-Gaz, SEP, NIP, IBAN, upload zdjęć)._  
      `@REQ: CRM-AUDYT-KARTOTEKA`, `@REQ: CRM-ZESP-KARTOTEKA`, WO: `CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN.md`.
- [x] **LOGISTICS-SHIPPING-EFFECTS (Faza B & C): System Powiadomień**  
      _Wdrożenie kolejki `notification_queue`, obsługa wysyłki kurierem (T06), bypass z ekipą (T07) oraz rollback (T10–T13)._  
      `@REQ: NTF-QUEUE-TABLE`, `@REQ: FNL-E5-E6`, `@REQ: FNL-E5-BYPASS`, `@REQ: FNL-ROLLBACK`.
- [x] **Baza Danych: Wielka Aktualizacja Jesienna i Seedowanie**  
      _Zasilenie bazy katalogiem jednostek Fuji/Daikin/Gree oraz wygenerowanie leadów testowych na każdym etapie lejka._

### 📅 Kalendarz & Rezerwacje

- [x] **CAL-TRAVEL-BUFFER: Automatyczny Bufor Czasu Dojazdu**  
      _Silnik rezerwacji automatycznie uwzględnia bufor dojazdowy między kolejnymi wizytami z tabeli `travel_buffers` (lub domyślnie 30 min)._  
      `@REQ: CAL-TRAVEL-BUFFER`.
- [x] **CAL-POOL-AGGREGATE: Sumaryczny widok wolnych slotów dla klienta**  
      _Klient wybierający termin wizyty widzi sumę wolnych terminów całej puli wykonawców w danym regionie bez ujawniania grafików indywidualnych._  
      `@REQ: CAL-POOL-AGGREGATE`.
- [x] **FLD-BOOKING-ATOMIC-ASSIGN: Atomowe rezerwacje slotów**  
      _Ochrona bazy danych przed double-bookingiem (EXCLUDE USING gist w Postgresie na zasobie i przedziale czasowym)._  
      `@REQ: FLD-BOOKING-ATOMIC-ASSIGN`, `@REQ: CAL-SLOT-ENGINE`, WO: `FLD-BOOKING-ATOMIC-ASSIGN.md`.
- [x] **CAL-VISIT-DURATION-BASKETS: Moduł Koszyków Czasowych**  
      _Obsługa elastycznych koszyków czasu trwania wizyt (90, 120, 240, 480 min) z tabelą `VisitDurationBasket` i powiązaniem z pulami `AUDITOR` / `CREW`._  
      `@REQ: CAL-VISIT-DURATION-BASKETS`.

### 🌐 Landing Page (B2C)

- [x] **B2C-TRIAGE-DISQUALIFY: Mechanizm Dyskwalifikacji**  
      _Automatyczne odrzucanie w kalkulatorze B2C zapytań niespełniających kryteriów technicznych (np. za duża liczba pomieszczeń)._  
      `@REQ: B2C-TRIAGE-DISQUALIFY`, WO: `B2C-TRIAGE-DISQUALIFY.md`.
- [x] **B2C-LEAD-GEO-PERSIST: Współrzędne Geograficzne Adresów**  
      _Persystencja współrzędnych WGS84 (`latitude`, `longitude`) pozyskiwanych z Google Places API podczas rezerwacji klienta._  
      `@REQ: FLD-GEO-COORDS`, WO: `B2C-LEAD-GEO-PERSIST.md`.

### 🔧 Field App (Fundamenty)

- [x] **FLD-AVAIL-SELF: Samodzielna deklaracja niedostępności**  
      _Deklaracja dostępności pracownika w tabeli `availability_declarations`, niezależna od blokady konta._  
      `@REQ: FLD-AVAIL-SELF`, `@REQ: FLD-AVAIL-RESTORE`, WO: `FLD-AVAILABILITY-SPLIT.md`.
- [x] **FLD-AVAIL-WEEKLY-RULES: Dostępność cykliczna**  
      _Grafik tygodniowy pracownika w tabeli `AvailabilityRule` (dni tygodnia i godziny pracy)._  
      `@REQ: FLD-AVAIL-WEEKLY-RULES`, WO: `FLD-AVAIL-WEEKLY-RULES.md`.
- [x] **FLD-BASE-LOCATION-EDIT: Edycja lokalizacji bazowej**  
      _Zmiana kodu pocztowego i promienia działania z audytowaniem w `AuditLog`._  
      `@REQ: FLD-BASE-LOCATION-EDIT`.
- [x] **FLD-CONSENT-ACCEPT & FLD-LEGAL-DOC-VERSION: Zgody i Regulaminy**  
      _Wersjonowanie regulaminów i zgód pracowniczych w `LegalDocumentVersion` oraz rejestracja akceptacji w `EmployeeConsent`._  
      `@REQ: FLD-CONSENT-ACCEPT`, `@REQ: FLD-LEGAL-DOC-VERSION`, WO: `FLD-CONSENT-DOCS.md`.

### 📑 Architektura Biznesowa i Modele Kooperacji

- [x] **Wszystkie scenariusze rozliczeniowe z klientem (`KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE.md`)**  
      _Kompleksowa specyfikacja 7 koszyków, 4-stronnego modelu finansowego, zaliczek JIT i marży._
- [x] **Roadmapa GTM, wymagania i prognoza developmentu (`ROADMAP-GTM-I-PROGNOZA-DEVELOPMENTU.md`)**  
      _5-fazowy harmonogram wdrożenia biznesowego (XI 2026 – VIII 2027), szacunki prac CTO i wkład COO._
- [x] **Warunki współpracy i Model prowizyjny (`model_wspolpracy.md` & `ONE-PAGER.md`)**  
      _Siatka stawek, podział 51/49 ze złotym 1%, licencja wieczysta IP od Michała, podział zysków z akwizycji oraz wymagania UDT._
- [x] **Polityka Dywidend i Dystrybucji Gotówki (`POLITYKA-DYWIDEND-I-DYSTRYBUCJI-GOTOWKI.md`)**  
      _Dedykowany dokument zasad dywidendy: rozdział pracy (OPEX) od kapitału, próg aktywacji IV 2027, poduszka finansowa i podział 51/49._

---

## 👔 2. Zadania Operacyjne COO (Piotr) — Faza 1 (Fundamenty do 30.11.2026 r.)

Lista zadań przypisana bezpośrednio do Piotra w dedykowanej kolumnie Trello `👔 Zadania COO (Piotr) — Faza 1 (do 30.11)`, stanowiąca warunek zaliczenia **Bramki Gate 1**:

1. **[COO-01] Rejestracja spółki KlikKlima Sp. z o.o. w KRS i otwarcie rachunku bankowego** _(Termin: 10.11.2026)_  
   _Umowa spółki (podział 51/49), wpis KRS, NIP/REGON, rachunek bankowy pod PayU i UDT._
2. **[COO-02] UDT Krok 1: Umowa najmu aparatury technicznej i wzorcowanie wagi/wykrywacza** _(Termin: 15.11.2026)_  
   _Umowa najmu sprzętu F-gaz + aktualne świadectwa wzorcowania wagi i wykrywacza nieszczelności._
3. **[COO-03] UDT Krok 2: Personel certyfikowany F-Gaz (Kat. I) i procedury techniczne** _(Termin: 18.11.2026)_  
   _Certyfikat F-gaz Kat. I, oświadczenie o dyspozycyjności, zatwierdzenie Systemu Prowadzenia Dokumentacji._
4. **[COO-04] UDT Krok 3: Złożenie wniosku w portalu eUDT i opłata ewidencyjna (3 885 zł)** _(Termin: 20.11.2026)_  
   _Wniosek online eUDT, komplet załączników i przelew opłaty ewidencyjnej 3 884,93 zł._
5. **[COO-05] Dystrybucja HVAC: Pobrać cenniki i katalogi urządzeń 2027 (Iglotech, Schiessl itp.)** _(Termin: 25.11.2026)_  
   _Pobranie najnowszych cenników hurtowych i kart katalogowych na sezon 2027 do konfiguratora._
6. **[COO-06] Negocjacje umów ramowych z min. 2 hurtowniami HVAC (rabaty B2B >= 35–45%)** _(Termin: 25.11.2026)_  
   _Wynegocjowanie rabatów B2B min. 35–45% i warunków porannych dostaw Just-in-Time._
7. **[COO-07] Baza podwykonawców: Zbudować listę 30–50 firm instalacyjnych z Wrocławia i okolic** _(Termin: 20.11.2026)_  
   _Skompletowanie bazy ekip HVAC (REGON, CEIDG, PKD 43.22.Z) w module CRM-PROSPECTS._
8. **[COO-08] Cold calling: Przeprowadzić pierwsze rozmowy i przetestować prospekt rozliczeniowy** _(Termin: 30.11.2026)_  
   _Obdzwonienie listy kontaktów, wyłonienie 6–8 ekip zainteresowanych lutowym onboardingiem._
9. **[COO-09] Zatwierdzenie taryfikatora koszykowego i wzoru umowy podwykonawczej B2B** _(Termin: 25.11.2026)_  
   _Akceptacja stawek koszykowych i wzoru umowy B2B (wymóg 4 zdjęć, 100% rękojmi, polisa OC 200k)._
10. **[COO-10] Wytypowanie 3–5 realnych klientów do pilotażu Dry Run (grudzień 2026)** _(Termin: 28.11.2026)_  
    _Wytypowanie zleceń testowych do przeprowadzenia pełnego procesu cyfrowego w grudniu._
11. **[COO-11] Przygotowanie bazy dotychczasowych klientów do strumienia MRR (serwisy roczne)** _(Termin: 30.11.2026)_  
    _Uporządkowanie historii klientów do automatycznego generowania powiadomień o serwisach._
12. **[COO-12] Wykupienie polisy ubezpieczeniowej OC działalności gospodarczej KlikKlima** _(Termin: 30.11.2026)_  
    _Wykupienie polisy OC spółki na sumę min. 500 000 – 1 000 000 zł._
13. **[COO-13] Założenie konta spółki w rejestrze CRO (Centralny Rejestr Operatorów)** _(Termin: 30.11.2026)_  
    _Rejestracja w CRO i przygotowanie Kart Urządzeń pod wymogi ustawy F-gazowej._
14. **[COO-14] Metoda wyceny w Triage B2C: Algorytm cen „od” i definicja montażu standardowego** _(Termin: 22.11.2026)_  
    _Zdefiniowanie twardych granic montażu standardowego (do 3m freonu, 1 przewiert, do 2,5m wys., skropliny grawitacyjne) i doboru mocy w Triage._
15. **[COO-15] Metoda wyceny w Field App: Formularz audytorski i katalog prac dodatkowych** _(Termin: 26.11.2026)_  
    _Katalog stawek za prace niestandardowe (freon >3m, bruzdy, żelbet, pompki skroplin, zwyżka) i kalkulator oferty na żywo w Field App._
16. **[COO-16] Polityka wynagradzania podwykonawców: Prowizje z prac dodatkowych i audytów** _(Termin: 27.11.2026)_  
    _Regulamin prowizyjny ekip: split z prac dodatkowych (70–80% ekipa / 20–30% spółka), stawka za audyt, Quality Bonus i potrącenia za usterki._

---

## 🚀 3. Zadania Techniczne w Backlogu (TODO)

### 🏢 Kategoria: Admin B2B (CRM, Lejek & Logistyka)

1. **PAYU-GATEWAY: Integracja produkcyjna płatności PayU (zaliczki 40–50% i transakcje online)**
   - _Opis:_ Pobieranie zaliczek online po akceptacji oferty, BLIK/PBL/Karty/Raty 0%, obsługa webhooków i idempotencji.
   - _Specyfikacja:_ [`docs/funkcjonalnosci_do_wdrozenia/payu-platnosci.md`](funkcjonalnosci_do_wdrozenia/payu-platnosci.md)
   - _Priorytet:_ **KRYTYCZNY (Kluczowy dla modelu JIT i zakupu urządzeń)**
2. **DOC-GEN-PDF: Automatyczny generator umów montażowych, protokołów zdawczo-odbiorczych i DTR (PDF)**
   - _Opis:_ Generowanie gotowych do podpisu dokumentów PDF (@react-pdf/renderer) z danymi urządzeń, kwotami i załącznikami.
   - _Specyfikacja:_ [`docs/funkcjonalnosci_do_wdrozenia/generator-umow-i-protokolow`](funkcjonalnosci_do_wdrozenia/generator-umow-i-protokolow)
   - _Priorytet:_ **WYSOKI**
3. **NTF-TEMPLATES: Responsywne szablony transakcyjne HTML e-mail i standaryzacja SMS (N1–N12, I1–I7)**
   - _Opis:_ Opracowanie profesjonalnych szablonów React Email z brandingiem KlikKlima, logo i przyciskami CTA oraz optymalizacja treści SMS.
   - _Specyfikacja:_ [`docs/funkcjonalnosci_do_wdrozenia/formatowanie-mailii-tresci sms`](funkcjonalnosci_do_wdrozenia/formatowanie-mailii-tresci%20sms)
   - _Priorytet:_ **WYSOKI**
4. **CRM-PROSPECTS: Baza potencjalnych podwykonawców do cold callingu, notatki i automatyczny import**
   - _Opis:_ Dedykowany moduł CRM dla COO do rekrutacji instalatorów: baza firm, notatki z rozmów telefonicznych, masowy import CSV, konwersja na aktywną ekipę.
   - _Specyfikacja:_ [`docs/funkcjonalnosci_do_wdrozenia/crm-lista-podwykonawcow-i-automat-dodajacy-nowe.md`](funkcjonalnosci_do_wdrozenia/crm-lista-podwykonawcow-i-automat-dodajacy-nowe.md)
   - _Priorytet:_ **WYSOKI (Wymagany do akcji rekrutacyjnej w IV kwartale)**
5. **AI-CHAT-SUITE: Ekosystem asystentów AI (B2C Landing, B2B Dyspozytor, Field App DTR)**
   - _Opis:_ Wdrożenie architektury RAG (Postgres pgvector + Gemini Flash): wirtualny doradca klienta, asystent procedur dla dyspozytora oraz mobilne wsparcie techniczne DTR z analizą zdjęć.
   - _Specyfikacja:_ [`docs/funkcjonalnosci_do_wdrozenia/dodanie-chatow`](funkcjonalnosci_do_wdrozenia/dodanie-chatow)
   - _Priorytet:_ **ŚREDNI**
6. **CRM-FILTER-WORKFORCE: Filtrowanie prac i analityka obciążenia per audytor i per zespół monterski**
   - _Opis:_ Widok lejka i profili z możliwością filtrowania zadań zaplanowanych i historii realizacji per konkretny pracownik/zespół.
   - _Priorytet:_ **ŚREDNI**
7. **FNL-E2-E3: Auto-transition leada do E3 po wysłaniu wyceny (Quote)**
   - _Wymagania:_ `FNL-E2-E3`, `SLA-QUOTE-14D`.
   - _Priorytet:_ **WYSOKI**
8. **FNL-E3-E4: Akceptacja wyceny online i rezerwacja terminu montażu**
   - _Wymaganie:_ `FNL-E3-E4`.
   - _Priorytet:_ **WYSOKI**
9. **FNL-E3-BUCKET: Nocny cron wygaszania ofert (Zimne Leady po 14 dniach)**
   - _Wymaganie:_ `FNL-E3-BUCKET`.
   - _Priorytet:_ **ŚREDNI**
10. **FNL-E4-E5: Przypisanie ekipy i zlecenie wysyłki sprzętu (E5 Hurtownia)**
    - _Wymaganie:_ `FNL-E4-E5`.
    - _Priorytet:_ **WYSOKI**
11. **FNL-E6-E7: Webhook kuriera (DPD/DHL) potwierdzający doręczenie**
    - _Wymaganie:_ `FNL-E6-E7`.
    - _Priorytet:_ **ŚREDNI**
12. **FNL-E7-E8: Zamknięcie montażu, protokół odbioru i wyznaczenie serwisu (+1 rok)**
    - _Wymagania:_ `FNL-E7-E8`, `SRV-NEXT-DATE`.
    - _Priorytet:_ **WYSOKI**
13. **CRM-SRV-TRIGGER: Nocny cron przeglądów gwarancyjnych i powiadomienia N10**
    - _Wymagania:_ `CRM-SRV-TRIGGER`, `SRV-REMINDER-ONCE`.
    - _Priorytet:_ **ŚREDNI**
14. **CRM-UST-AC1: Zgłoszenia usterek i reklamacji z priorytetem Krytyczny (SLA 48h)**
    - _Wymagania:_ `CRM-UST-AC1`, `CRM-UST-AC2`, `CRM-UST-AC3`, `NTF-I7-SLA`.
    - _Priorytet:_ **WYSOKI**
15. **CRM-KLI-SEARCH: Globalna wyszukiwarka klientów i Karta 360**
    - _Wymagania:_ `CRM-KLI-AC1`, `CRM-KLI-AC2`, `CRM-KLI-AC3`, `NTF-HISTORY`.
    - _Priorytet:_ **ŚREDNI**
16. **NTF-GATEWAY: Integracja produkcyjna bramki SMS (SMSAPI) i Email**
    - _Wymagania:_ `NTF-QUEUE-WINDOW`, `NTF-RETRY`.
    - _Priorytet:_ **WYSOKI**

### 🔧 Kategoria: Field App (Aplikacja Terenowa)

17. **FLD-APP-PWA & FLD-SPEC-CORE: Dedykowana aplikacja mobilna PWA dla wykonawców**
    - _Opis:_ Responsywny interfejs mobilny dla audytorów i monterów: zlecenia na dziś, checklista montażowa, nawigacja, notatki, protokół odbioru (19 wymagań N1–N19).
    - _Specyfikacja:_ [`docs/funkcjonalnosci_do_wdrozenia/field-app.md`](funkcjonalnosci_do_wdrozenia/field-app.md) & [`docs/architecture/FIELD-APP-PLAN.md`](architecture/FIELD-APP-PLAN.md)
    - _Priorytet:_ **WYSOKI (Kluczowy dla pracy ekip)**
18. **SIGN-ONLINE: Moduł elektronicznego podpisu umów i protokołów (rysik na tablecie / link e-mail)**
    - _Opis:_ Bezpieczny podpis na ekranie dotykowym tabletu/smartfona oraz obsługa podpisu zdalnego z linku w SMS/mailu z kryptograficznym stemplowaniem SHA-256.
    - _Specyfikacja:_ [`docs/funkcjonalnosci_do_wdrozenia/podpis-elektroniczny.md`](funkcjonalnosci_do_wdrozenia/podpis-elektroniczny.md)
    - _Priorytet:_ **WYSOKI**
19. **FLD-PHOTO-OPTIMIZE: Kompresja zdjęć w locie po stronie klienta (WebP) i szybki upload do CDN**
    - _Opis:_ Klient mobilny kompresuje zdjęcia z 12 MB do < 800 KB w formacie WebP oraz generuje miniatury 300px, zapewniając błyskawiczny upload nawet przy słabym zasięgu.
    - _Specyfikacja:_ [`docs/funkcjonalnosci_do_wdrozenia/optymlaizacja-i-przyspieszenie-ladowania-zdjec.md`](funkcjonalnosci_do_wdrozenia/optymlaizacja-i-przyspieszenie-ladowania-zdjec.md)
    - _Priorytet:_ **WYSOKI**
20. **MKT-PHOTO-CONSENT: Zgody marketingowe na publikację zdjęć z realizacji w Social Media**
    - _Opis:_ Zbieranie zgód klienta w protokole odbioru na publikację zdjęć w social media/portfolio z automatycznym filtrowaniem w panelu marketingowym B2B.
    - _Specyfikacja:_ [`docs/funkcjonalnosci_do_wdrozenia/zgody-ladowanie-zdjec-z-mieszkania-i-publikacja-w-social-media.md`](funkcjonalnosci_do_wdrozenia/zgody-ladowanie-zdjec-z-mieszkania-i-publikacja-w-social-media.md)
    - _Priorytet:_ **ŚREDNI**
21. **FLD-AUTH-BLOCKED: Bramka autoryzacyjna aplikacji terenowej**
    - _Wymaganie:_ `FLD-AUTH-BLOCKED`.
    - _Priorytet:_ **ŚREDNI**
22. **FLD-AUDIT-PHONE-SHORTCUT: Skrócona ścieżka audytu telefonicznego**
    - _Opis:_ Błyskawiczny formularz dla audytora/handlowca rozmawiającego z dzwoniącym klientem: utworzenie leada, skrócony triage i rezerwacja slotu.
    - _Priorytet:_ **ŚREDNI**

### 🌐 Kategoria: Landing Page (B2C)

23. **B2C-BOOKING-FLOW: Atomowa rezerwacja terminu audytu na Landing Page**
    - _Wymagania:_ `B2C-LEAD-ENTRY`, `B2C-LEAD-ATOMIC`, `B2C-BOOKING-SLOT`, `B2C-CONSENT-RODO`.
    - _Priorytet:_ **WYSOKI**
24. **B2C-PRICE-FROM: Dynamiczne wyliczanie cen „od" w katalogu**
    - _Wymaganie:_ `B2C-PRICE-FROM`.
    - _Priorytet:_ **ŚREDNI**
25. **B2C-TRIAGE-STEPS: Rozbudowa formularza Triage 7 kroków**
    - _Wymaganie:_ `B2C-TRIAGE-STEPS`.
    - _Priorytet:_ **ŚREDNI**
26. **B2C-SOFT-LEAD: Obsługa okna Exit-Intent (kontakt cząstkowy)**
    - _Wymaganie:_ `B2C-SOFT-LEAD`.
    - _Priorytet:_ **NISKI**
27. **B2C-DEVICE-COMPARE: Porównywarka klimatyzatorów na stronie**
    - _Priorytet:_ **NISKI**
28. **B2C-CATALOG-REFRESH: Automatyczne odświeżanie widoku available_combinations**
    - _Wymaganie:_ `B2C-CATALOG-VIEW-TRACKED`.
    - _Priorytet:_ **ŚREDNI**

### 🔒 Kategoria: Security & Tech Debt

29. **SEC-SSO-GUARD: Ostateczne wymuszenie Google SSO w produkcji**
    - _Wymagania:_ `SEC-SSO-GUARD`, `SEC-EMAIL-CASE-NORMALIZE`.
    - _Priorytet:_ **ŚREDNI**
30. **SEC-AUDIT-LOG-RETENTION: Polityka retencji i archiwizacji logów audytowych**
    - _Priorytet:_ **ŚREDNI**

---

## 🚧 3. Zadania Zablokowane / Decyzje Biznesowe (Blocked)

1. **FLD-PHOTO-SET: Dokumentacja zdjęciowa (Field App)**
   - _Rozstrzygnięcie:_ Ustalone w `docs/architecture/FIELD-APP-PLAN.md` (K6): 1 zdjęcie na każdą zamontowaną jednostkę wewnętrzną + jednostka zewnętrzna + odpływ skroplin + elewacja z oddali.
2. **FLD-GEO-EN-ROUTE / GEO-UNLOCK (Field App)**
   - _Problem:_ Zgodność z RODO i zgoda na śledzenie lokalizacji GPS pracowników (model zdarzeniowy punktowy przy starcie zlecenia vs ciągła geolokalizacja).

---

## 🎯 4. Rekomendowana Kolejność Wdrożenia (Sprint Plan)

1. **Sprint 1 (Domknięcie Lejka B2C & Zaliczki PayU):**
   - `B2C-BOOKING-FLOW` (Rezerwacja audytu na www)
   - `PAYU-GATEWAY` (Pobieranie zaliczek online na zakup sprzętu)
   - `FNL-E2-E3` (Wysłanie wyceny po audycie)
   - `FNL-E3-E4` (Akceptacja wyceny i rezerwacja terminu montażu)
   - `FNL-E4-E5` (Przydzielenie ekipy i zlecenie sprzętu)
2. **Sprint 2 (Dokumenty, Powiadomienia & Prospekty CRM):**
   - `DOC-GEN-PDF` (Generator umów montażowych i protokołów odbioru)
   - `SIGN-ONLINE` (Podpis elektroniczny na tablecie i zdalnie)
   - `NTF-TEMPLATES` & `NTF-GATEWAY` (Profesjonalne szablony e-mail HTML i bramka SMS)
   - `CRM-PROSPECTS` (Moduł rekrutacji ekip i cold callingu dla Piotra)
   - `FNL-E6-E7` & `FNL-E7-E8` (Doręczenie kurierskie i zamknięcie montażu)
3. **Sprint 3 (Aplikacja Terenowa i Obsługa Serwisowa):**
   - `FLD-APP-PWA` & `FLD-SPEC-CORE` (Aplikacja mobilna PWA dla monterów i audytorów)
   - `FLD-PHOTO-OPTIMIZE` (Kompresja WebP i szybki upload zdjęć)
   - `MKT-PHOTO-CONSENT` (Zgody na zdjęcia do social media)
   - `CRM-UST-AC1` (Obsługa usterek i reklamacji SLA 48h)
   - `CRM-SRV-TRIGGER` (Automatyczne przypomnienia o serwisach rocznych)
   - `AI-CHAT-SUITE` (Wdrożenie wirtualnego doradcy i asystenta technicznego)
