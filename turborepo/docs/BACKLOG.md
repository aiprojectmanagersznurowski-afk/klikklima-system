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
  *Zamknięcie luki nieautoryzowanego odczytu danych osobowych klienta w `getCustomers`, `installations`, `services`, `incidents`, `crews`, `auditors`.*  
  `@REQ: SEC-AUTHZ-B2B-READS`, WO: `SEC-READ-GATES.md`.
- [x] **SEC-AUTHZ-USER-MGMT: Zarządzanie w RBAC**  
  *Zabezpieczenie dodawania i edycji ról użytkowników w tabeli `authorized_users`.*  
  `@REQ: SEC-AUTHZ-USER-MGMT`, WO: `SEC-AUTHZ-DEFAULT-ROLE.md`.
- [x] **SEC-AUDIT-LOG: Historyzacja (Zapis Audytu Append-Only)**  
  *Niezmienny rejestr audytowy zdarzeń, blokada mutacji i usuwania z poziomu bazy, audytowanie ręcznych zmian statusów i ról.*  
  `@REQ: SEC-AUDIT-LOG`, `@REQ: SEC-AUDIT-LOG-APPEND-ONLY`, `@REQ: SEC-AUDIT-LOG-MANUAL-STATUS`, `@REQ: SEC-AUDIT-LOG-ROLE-CHANGE`, `@REQ: SEC-AUDIT-LOG-DELETE`.
- [x] **SEC-ASSIGNMENT-POOL-MINIMIZE: Ochrona przed przeciekiem danych**  
  *Zawężenie zwracanych danych w zapytaniach `getAuditors()` i `getCrews()` (brak wycieku danych finansowych/adresowych na frontend).*  
  `@REQ: SEC-ASSIGNMENT-POOL-MINIMIZE`, `@REQ: SEC-LEADS-LIST-MINIMIZE`, `@REQ: SEC-LEADS-LIST-SCALARS`.
- [x] **Check-types w CI/CD (Dług techniczny P2)**  
  *Dodanie pełnej weryfikacji typowania TypeScript (`turbo run check-types`) do procesu weryfikacji bramki commitowej.*

### 🏢 Panel B2B (CRM, Lejek & Logistyka)
- [x] **DOCS-BROWSER: Wewnętrzna przeglądarka dokumentacji w panelu B2B (`/dokumentacja`)**  
  *Bezpieczny moduł przeglądania dokumentacji architektury, prezentacji biznesowych i diagramów Mermaid z poziomu aplikacji z bramką autoryzacyjną.*
- [x] **FNL-2PHASE-BOOKING & ROLLBACK-RELEASE: Mechanika rezerwacji montażu dwuetapowego**  
  *Obsługa stanu deweloperskiego (etap I podtynkowy, etap II montażowy) z osobnymi rezerwacjami, koszykami czasowymi, unikalnymi indeksami i zwolnieniem rezerwacji przy rollbacku.*  
  `@REQ: FNL-2PHASE-BOOKING`, `@REQ: FNL-2PHASE-ROLLBACK-RELEASE`.
- [x] **CRM-PROJECT-NUMBER: Sekwencyjna numeracja zleceń (`L-000123`)**  
  *Wdrożenie czytelnego dla ludzi identyfikatora projektu opartego o sekwencję bazy danych `leads_project_number_seq`.*  
  `@REQ: CRM-PROJECT-NUMBER`.
- [x] **CRM-CLIENT-ANONYMIZE-RODO: Anonimizacja danych RODO**  
  *Bezpieczna, atomowa anonimizacja danych osobowych klientów na żądanie (zastąpienie danych PII z zachowaniem integralności relacji).*  
  `@REQ: CRM-CLIENT-ANONYMIZE-RODO`, WO: `CLIENT-ANONYMIZATION-RODO.md`.
- [x] **CRM-AUDYT-KARTOTEKA & ZESP-KARTOTEKA: Kartoteki Osobiste**  
  *14-polowe formularze tworzenia i edycji audytorów oraz ekip (uprawnienia F-Gaz, SEP, NIP, IBAN, upload zdjęć).*  
  `@REQ: CRM-AUDYT-KARTOTEKA`, `@REQ: CRM-ZESP-KARTOTEKA`, WO: `CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN.md`.
- [x] **LOGISTICS-SHIPPING-EFFECTS (Faza B & C): System Powiadomień**  
  *Wdrożenie kolejki `notification_queue`, obsługa wysyłki kurierem (T06), bypass z ekipą (T07) oraz rollback (T10–T13).*  
  `@REQ: NTF-QUEUE-TABLE`, `@REQ: FNL-E5-E6`, `@REQ: FNL-E5-BYPASS`, `@REQ: FNL-ROLLBACK`.
- [x] **Baza Danych: Wielka Aktualizacja Jesienna i Seedowanie**  
  *Zasilenie bazy katalogiem jednostek Fuji/Daikin/Gree oraz wygenerowanie leadów testowych na każdym etapie lejka.*

### 📅 Kalendarz & Rezerwacje
- [x] **CAL-TRAVEL-BUFFER: Automatyczny Bufor Czasu Dojazdu**  
  *Silnik rezerwacji automatycznie uwzględnia bufor dojazdowy między kolejnymi wizytami z tabeli `travel_buffers` (lub domyślnie 30 min).*  
  `@REQ: CAL-TRAVEL-BUFFER`.
- [x] **CAL-POOL-AGGREGATE: Sumaryczny widok wolnych slotów dla klienta**  
  *Klient wybierający termin wizyty widzi sumę wolnych terminów całej puli wykonawców w danym regionie bez ujawniania grafików indywidualnych.*  
  `@REQ: CAL-POOL-AGGREGATE`.
- [x] **FLD-BOOKING-ATOMIC-ASSIGN: Atomowe rezerwacje slotów**  
  *Ochrona bazy danych przed double-bookingiem (EXCLUDE USING gist w Postgresie na zasobie i przedziale czasowym).*  
  `@REQ: FLD-BOOKING-ATOMIC-ASSIGN`, `@REQ: CAL-SLOT-ENGINE`, WO: `FLD-BOOKING-ATOMIC-ASSIGN.md`.
- [x] **CAL-VISIT-DURATION-BASKETS: Moduł Koszyków Czasowych**  
  *Obsługa elastycznych koszyków czasu trwania wizyt (90, 120, 240, 480 min) z tabelą `VisitDurationBasket` i powiązaniem z pulami `AUDITOR` / `CREW`.*  
  `@REQ: CAL-VISIT-DURATION-BASKETS`.

### 🌐 Landing Page (B2C)
- [x] **B2C-TRIAGE-DISQUALIFY: Mechanizm Dyskwalifikacji**  
  *Automatyczne odrzucanie w kalkulatorze B2C zapytań niespełniających kryteriów technicznych (np. za duża liczba pomieszczeń).*  
  `@REQ: B2C-TRIAGE-DISQUALIFY`, WO: `B2C-TRIAGE-DISQUALIFY.md`.
- [x] **B2C-LEAD-GEO-PERSIST: Współrzędne Geograficzne Adresów**  
  *Persystencja współrzędnych WGS84 (`latitude`, `longitude`) pozyskiwanych z Google Places API podczas rezerwacji klienta.*  
  `@REQ: FLD-GEO-COORDS`, WO: `B2C-LEAD-GEO-PERSIST.md`.

### 🔧 Field App (Fundamenty)
- [x] **FLD-AVAIL-SELF: Samodzielna deklaracja niedostępności**  
  *Deklaracja dostępności pracownika w tabeli `availability_declarations`, niezależna od blokady konta.*  
  `@REQ: FLD-AVAIL-SELF`, `@REQ: FLD-AVAIL-RESTORE`, WO: `FLD-AVAILABILITY-SPLIT.md`.
- [x] **FLD-AVAIL-WEEKLY-RULES: Dostępność cykliczna**  
  *Grafik tygodniowy pracownika w tabeli `AvailabilityRule` (dni tygodnia i godziny pracy).*  
  `@REQ: FLD-AVAIL-WEEKLY-RULES`, WO: `FLD-AVAIL-WEEKLY-RULES.md`.
- [x] **FLD-BASE-LOCATION-EDIT: Edycja lokalizacji bazowej**  
  *Zmiana kodu pocztowego i promienia działania z audytowaniem w `AuditLog`.*  
  `@REQ: FLD-BASE-LOCATION-EDIT`.
- [x] **FLD-CONSENT-ACCEPT & FLD-LEGAL-DOC-VERSION: Zgody i Regulaminy**  
  *Wersjonowanie regulaminów i zgód pracowniczych w `LegalDocumentVersion` oraz rejestracja akceptacji w `EmployeeConsent`.*  
  `@REQ: FLD-CONSENT-ACCEPT`, `@REQ: FLD-LEGAL-DOC-VERSION`, WO: `FLD-CONSENT-DOCS.md`.

### 📑 Architektura Biznesowa i Modele Kooperacji
- [x] **Wszystkie scenariusze rozliczeniowe z klientem (`KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE.md`)**  
  *Kompleksowa specyfikacja 7 koszyków, 4-stronnego modelu finansowego, zaliczek JIT i marży.*
- [x] **Roadmapa GTM, wymagania i prognoza developmentu (`ROADMAP-GTM-I-PROGNOZA-DEVELOPMENTU.md`)**  
  *5-fazowy harmonogram wdrożenia biznesowego (XI 2026 – VIII 2027), szacunki prac CTO i wkład COO.*
- [x] **Warunki współpracy i Model prowizyjny (`model_wspolpracy.md` & `ONE-PAGER.md`)**  
  *Siatka stawek, taryfikator robocizny, zasady wypłat i wymagania certyfikacji UDT/F-Gaz.*

---

## 🚀 2. Zadania w Backlogu (TODO)

### 🏢 Kategoria: Admin B2B (CRM, Lejek & Logistyka)
1. **PAYU-GATEWAY: Integracja produkcyjna płatności PayU (zaliczki 40–50% i transakcje online)**  
   - *Opis:* Pobieranie zaliczek online po akceptacji oferty, BLIK/PBL/Karty/Raty 0%, obsługa webhooków i idempotencji.  
   - *Specyfikacja:* [`docs/funkcjonalnosci_do_wdrozenia/payu-platnosci.md`](funkcjonalnosci_do_wdrozenia/payu-platnosci.md)  
   - *Priorytet:* **KRYTYCZNY (Kluczowy dla modelu JIT i zakupu urządzeń)**
2. **DOC-GEN-PDF: Automatyczny generator umów montażowych, protokołów zdawczo-odbiorczych i DTR (PDF)**  
   - *Opis:* Generowanie gotowych do podpisu dokumentów PDF (@react-pdf/renderer) z danymi urządzeń, kwotami i załącznikami.  
   - *Specyfikacja:* [`docs/funkcjonalnosci_do_wdrozenia/generator-umow-i-protokolow`](funkcjonalnosci_do_wdrozenia/generator-umow-i-protokolow)  
   - *Priorytet:* **WYSOKI**
3. **NTF-TEMPLATES: Responsywne szablony transakcyjne HTML e-mail i standaryzacja SMS (N1–N12, I1–I7)**  
   - *Opis:* Opracowanie profesjonalnych szablonów React Email z brandingiem KlikKlima, logo i przyciskami CTA oraz optymalizacja treści SMS.  
   - *Specyfikacja:* [`docs/funkcjonalnosci_do_wdrozenia/formatowanie-mailii-tresci sms`](funkcjonalnosci_do_wdrozenia/formatowanie-mailii-tresci%20sms)  
   - *Priorytet:* **WYSOKI**
4. **CRM-PROSPECTS: Baza potencjalnych podwykonawców do cold callingu, notatki i automatyczny import**  
   - *Opis:* Dedykowany moduł CRM dla COO do rekrutacji instalatorów: baza firm, notatki z rozmów telefonicznych, masowy import CSV, konwersja na aktywną ekipę.  
   - *Specyfikacja:* [`docs/funkcjonalnosci_do_wdrozenia/crm-lista-podwykonawcow-i-automat-dodajacy-nowe.md`](funkcjonalnosci_do_wdrozenia/crm-lista-podwykonawcow-i-automat-dodajacy-nowe.md)  
   - *Priorytet:* **WYSOKI (Wymagany do akcji rekrutacyjnej w IV kwartale)**
5. **AI-CHAT-SUITE: Ekosystem asystentów AI (B2C Landing, B2B Dyspozytor, Field App DTR)**  
   - *Opis:* Wdrożenie architektury RAG (Postgres pgvector + Gemini Flash): wirtualny doradca klienta, asystent procedur dla dyspozytora oraz mobilne wsparcie techniczne DTR z analizą zdjęć.  
   - *Specyfikacja:* [`docs/funkcjonalnosci_do_wdrozenia/dodanie-chatow`](funkcjonalnosci_do_wdrozenia/dodanie-chatow)  
   - *Priorytet:* **ŚREDNI**
6. **CRM-FILTER-WORKFORCE: Filtrowanie prac i analityka obciążenia per audytor i per zespół monterski**  
   - *Opis:* Widok lejka i profili z możliwością filtrowania zadań zaplanowanych i historii realizacji per konkretny pracownik/zespół.  
   - *Priorytet:* **ŚREDNI**
7. **FNL-E2-E3: Auto-transition leada do E3 po wysłaniu wyceny (Quote)**  
   - *Wymagania:* `FNL-E2-E3`, `SLA-QUOTE-14D`.  
   - *Priorytet:* **WYSOKI**
8. **FNL-E3-E4: Akceptacja wyceny online i rezerwacja terminu montażu**  
   - *Wymaganie:* `FNL-E3-E4`.  
   - *Priorytet:* **WYSOKI**
9. **FNL-E3-BUCKET: Nocny cron wygaszania ofert (Zimne Leady po 14 dniach)**  
   - *Wymaganie:* `FNL-E3-BUCKET`.  
   - *Priorytet:* **ŚREDNI**
10. **FNL-E4-E5: Przypisanie ekipy i zlecenie wysyłki sprzętu (E5 Hurtownia)**  
    - *Wymaganie:* `FNL-E4-E5`.  
    - *Priorytet:* **WYSOKI**
11. **FNL-E6-E7: Webhook kuriera (DPD/DHL) potwierdzający doręczenie**  
    - *Wymaganie:* `FNL-E6-E7`.  
    - *Priorytet:* **ŚREDNI**
12. **FNL-E7-E8: Zamknięcie montażu, protokół odbioru i wyznaczenie serwisu (+1 rok)**  
    - *Wymagania:* `FNL-E7-E8`, `SRV-NEXT-DATE`.  
    - *Priorytet:* **WYSOKI**
13. **CRM-SRV-TRIGGER: Nocny cron przeglądów gwarancyjnych i powiadomienia N10**  
    - *Wymagania:* `CRM-SRV-TRIGGER`, `SRV-REMINDER-ONCE`.  
    - *Priorytet:* **ŚREDNI**
14. **CRM-UST-AC1: Zgłoszenia usterek i reklamacji z priorytetem Krytyczny (SLA 48h)**  
    - *Wymagania:* `CRM-UST-AC1`, `CRM-UST-AC2`, `CRM-UST-AC3`, `NTF-I7-SLA`.  
    - *Priorytet:* **WYSOKI**
15. **CRM-KLI-SEARCH: Globalna wyszukiwarka klientów i Karta 360**  
    - *Wymagania:* `CRM-KLI-AC1`, `CRM-KLI-AC2`, `CRM-KLI-AC3`, `NTF-HISTORY`.  
    - *Priorytet:* **ŚREDNI**
16. **NTF-GATEWAY: Integracja produkcyjna bramki SMS (SMSAPI) i Email**  
    - *Wymagania:* `NTF-QUEUE-WINDOW`, `NTF-RETRY`.  
    - *Priorytet:* **WYSOKI**

### 🔧 Kategoria: Field App (Aplikacja Terenowa)
17. **FLD-APP-PWA & FLD-SPEC-CORE: Dedykowana aplikacja mobilna PWA dla wykonawców**  
    - *Opis:* Responsywny interfejs mobilny dla audytorów i monterów: zlecenia na dziś, checklista montażowa, nawigacja, notatki, protokół odbioru (19 wymagań N1–N19).  
    - *Specyfikacja:* [`docs/funkcjonalnosci_do_wdrozenia/field-app.md`](funkcjonalnosci_do_wdrozenia/field-app.md) & [`docs/architecture/FIELD-APP-PLAN.md`](architecture/FIELD-APP-PLAN.md)  
    - *Priorytet:* **WYSOKI (Kluczowy dla pracy ekip)**
18. **SIGN-ONLINE: Moduł elektronicznego podpisu umów i protokołów (rysik na tablecie / link e-mail)**  
    - *Opis:* Bezpieczny podpis na ekranie dotykowym tabletu/smartfona oraz obsługa podpisu zdalnego z linku w SMS/mailu z kryptograficznym stemplowaniem SHA-256.  
    - *Specyfikacja:* [`docs/funkcjonalnosci_do_wdrozenia/podpis-elektroniczny.md`](funkcjonalnosci_do_wdrozenia/podpis-elektroniczny.md)  
    - *Priorytet:* **WYSOKI**
19. **FLD-PHOTO-OPTIMIZE: Kompresja zdjęć w locie po stronie klienta (WebP) i szybki upload do CDN**  
    - *Opis:* Klient mobilny kompresuje zdjęcia z 12 MB do < 800 KB w formacie WebP oraz generuje miniatury 300px, zapewniając błyskawiczny upload nawet przy słabym zasięgu.  
    - *Specyfikacja:* [`docs/funkcjonalnosci_do_wdrozenia/optymlaizacja-i-przyspieszenie-ladowania-zdjec.md`](funkcjonalnosci_do_wdrozenia/optymlaizacja-i-przyspieszenie-ladowania-zdjec.md)  
    - *Priorytet:* **WYSOKI**
20. **MKT-PHOTO-CONSENT: Zgody marketingowe na publikację zdjęć z realizacji w Social Media**  
    - *Opis:* Zbieranie zgód klienta w protokole odbioru na publikację zdjęć w social media/portfolio z automatycznym filtrowaniem w panelu marketingowym B2B.  
    - *Specyfikacja:* [`docs/funkcjonalnosci_do_wdrozenia/zgody-ladowanie-zdjec-z-mieszkania-i-publikacja-w-social-media.md`](funkcjonalnosci_do_wdrozenia/zgody-ladowanie-zdjec-z-mieszkania-i-publikacja-w-social-media.md)  
    - *Priorytet:* **ŚREDNI**
21. **FLD-AUTH-BLOCKED: Bramka autoryzacyjna aplikacji terenowej**  
    - *Wymaganie:* `FLD-AUTH-BLOCKED`.  
    - *Priorytet:* **ŚREDNI**
22. **FLD-AUDIT-PHONE-SHORTCUT: Skrócona ścieżka audytu telefonicznego**  
    - *Opis:* Błyskawiczny formularz dla audytora/handlowca rozmawiającego z dzwoniącym klientem: utworzenie leada, skrócony triage i rezerwacja slotu.  
    - *Priorytet:* **ŚREDNI**

### 🌐 Kategoria: Landing Page (B2C)
23. **B2C-BOOKING-FLOW: Atomowa rezerwacja terminu audytu na Landing Page**  
    - *Wymagania:* `B2C-LEAD-ENTRY`, `B2C-LEAD-ATOMIC`, `B2C-BOOKING-SLOT`, `B2C-CONSENT-RODO`.  
    - *Priorytet:* **WYSOKI**
24. **B2C-PRICE-FROM: Dynamiczne wyliczanie cen „od" w katalogu**  
    - *Wymaganie:* `B2C-PRICE-FROM`.  
    - *Priorytet:* **ŚREDNI**
25. **B2C-TRIAGE-STEPS: Rozbudowa formularza Triage 7 kroków**  
    - *Wymaganie:* `B2C-TRIAGE-STEPS`.  
    - *Priorytet:* **ŚREDNI**
26. **B2C-SOFT-LEAD: Obsługa okna Exit-Intent (kontakt cząstkowy)**  
    - *Wymaganie:* `B2C-SOFT-LEAD`.  
    - *Priorytet:* **NISKI**
27. **B2C-DEVICE-COMPARE: Porównywarka klimatyzatorów na stronie**  
    - *Priorytet:* **NISKI**
28. **B2C-CATALOG-REFRESH: Automatyczne odświeżanie widoku available_combinations**  
    - *Wymaganie:* `B2C-CATALOG-VIEW-TRACKED`.  
    - *Priorytet:* **ŚREDNI**

### 🔒 Kategoria: Security & Tech Debt
29. **SEC-SSO-GUARD: Ostateczne wymuszenie Google SSO w produkcji**  
    - *Wymagania:* `SEC-SSO-GUARD`, `SEC-EMAIL-CASE-NORMALIZE`.  
    - *Priorytet:* **ŚREDNI**
30. **SEC-AUDIT-LOG-RETENTION: Polityka retencji i archiwizacji logów audytowych**  
    - *Priorytet:* **ŚREDNI**

---

## 🚧 3. Zadania Zablokowane / Decyzje Biznesowe (Blocked)

1. **FLD-PHOTO-SET: Dokumentacja zdjęciowa (Field App)**  
   - *Rozstrzygnięcie:* Ustalone w `docs/architecture/FIELD-APP-PLAN.md` (K6): 1 zdjęcie na każdą zamontowaną jednostkę wewnętrzną + jednostka zewnętrzna + odpływ skroplin + elewacja z oddali.
2. **FLD-GEO-EN-ROUTE / GEO-UNLOCK (Field App)**  
   - *Problem:* Zgodność z RODO i zgoda na śledzenie lokalizacji GPS pracowników (model zdarzeniowy punktowy przy starcie zlecenia vs ciągła geolokalizacja).

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
