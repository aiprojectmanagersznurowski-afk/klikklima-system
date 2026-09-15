# KlikKlima System — Główny Backlog Projektu

> **Data aktualizacji:** 2026-09-12  
> **Synchronizacja Trello:** [KlikKlima - Backlog Produktów](https://trello.com/b/9DCBpyzd/klikklima-backlog-produkt%C3%B3w) | [Tablica Zespołu KK](https://trello.com/b/hFuDBT36/kk)

---

## 📊 Podsumowanie Statusu Projektu

- **Zadania Ukończone (Done):** 20 zadań strategicznych (54 wymagania w `contracts/requirements.contract.mjs` z zaliczonymi testami)
- **Zadania w Backlogu (Do zrobienia):** 25 zadań niezbędnych do pełnego uruchomienia systemu produkcyjnego
- **Zadania Zablokowane / Do decyzji (Blocked):** 2 tematy prawne/biznesowe (Field App GPS & Fotodokumentacja)

---

## ✅ 1. Zadania Ukończone (Done)

Zadania zrealizowane, wdrożone w kodzie, zaimplementowane w migracjach PostgreSQL i pokryte testami automatycznymi (`npm test` — 109 plików, 1662 testy).

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

### 🏢 Panel B2B (CRM & Logistyka)
- [x] **CRM-PROJECT-NUMBER: Sekwencyjna numeracja zleceń (L-000123)**  
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
- [x] **Baza Danych: Aktualizacja modeli urządzeń i czyszczenie leadów**  
  *Zasilenie bazy katalogiem jednostek Fuji/Daikin/Gree oraz wygenerowanie 220 leadów testowych po 20 na każdy etap lejka.*

### 🌐 Landing Page (B2C)
- [x] **B2C-TRIAGE-DISQUALIFY: Mechanizm Dyskwalifikacji**  
  *Automatyczne odrzucanie w kalkulatorze B2C zapytań niespełniających kryteriów technicznych (np. za duża liczba pomieszczeń).*  
  `@REQ: B2C-TRIAGE-DISQUALIFY`, WO: `B2C-TRIAGE-DISQUALIFY.md`.
- [x] **B2C-LEAD-GEO-PERSIST: Współrzędne Geograficzne Adresów**  
  *Persystencja współrzędnych WGS84 (`latitude`, `longitude`) pozyskiwanych z Google Places API podczas rezerwacji klienta.*  
  `@REQ: FLD-GEO-COORDS`, WO: `B2C-LEAD-GEO-PERSIST.md`.

### 📅 Kalendarz & Rezerwacje
- [x] **FLD-BOOKING-ATOMIC-ASSIGN: Atomowe rezerwacje slotów**  
  *Ochrona bazy danych przed double-bookingiem (EXCLUDE USING gist w Postgresie na zasobie i przedziale czasowym).*  
  `@REQ: FLD-BOOKING-ATOMIC-ASSIGN`, `@REQ: CAL-SLOT-ENGINE`, WO: `FLD-BOOKING-ATOMIC-ASSIGN.md`.
- [x] **CAL-VISIT-DURATION-BASKETS: Moduł Koszyków Czasowych**  
  *Obsługa elastycznych koszyków czasu trwania wizyt (90, 120, 240, 480 min) z tabelą `VisitDurationBasket`.*  
  `@REQ: CAL-VISIT-DURATION-BASKETS`.

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

---

## 🚀 2. Zadania Niezbędne do Ukończenia (Backlog TODO)

### 🌐 Kategoria: Landing Page (B2C)
1. **B2C-BOOKING-FLOW: Atomowa rezerwacja terminu audytu na Landing Page**  
   - *Opis:* Klient wybiera wolny termin audytu, podaje dane kontaktowe i wyraża zgody RODO. Zapis w jednej transakcji: lead (`NEW_LEAD`) + klient + adres + rezerwacja slotu w `bookings` (`RESERVED`).  
   - *Wymagania:* `B2C-LEAD-ENTRY`, `B2C-LEAD-ATOMIC`, `B2C-BOOKING-SLOT`, `B2C-CONSENT-RODO`.  
   - *Priorytet:* **WYSOKI (Kluczowy dla konwersji klientów)**
2. **B2C-PRICE-FROM: Dynamiczne wyliczanie cen „od" w katalogu**  
   - *Opis:* Cena klimatyzatora wyliczana w locie: jednostka wewn. + agregat zewn. + montaż standardowy (z `cennik_uslug`) + VAT 8% dla osób prywatnych (lub 23% dla firm).  
   - *Wymaganie:* `B2C-PRICE-FROM`.  
   - *Priorytet:* **ŚREDNI**
3. **B2C-TRIAGE-STEPS: Rozbudowa formularza Triage 7 kroków**  
   - *Opis:* Optymalizacja UX formularza doboru klimatyzacji: 7 kroków pytań z paskiem postępu, walidacja react-hook-form + zod, zapamiętywanie stanu w sessionStorage i płynne cofanie kroków.  
   - *Wymaganie:* `B2C-TRIAGE-STEPS`.  
   - *Priorytet:* **ŚREDNI**
4. **B2C-SOFT-LEAD: Obsługa okna Exit-Intent (kontakt cząstkowy)**  
   - *Opis:* Popup zbierający numer telefonu przy próbie opuszczenia strony bez ukończenia triage; zapis do tabeli `soft_leady`.  
   - *Wymaganie:* `B2C-SOFT-LEAD`.  
   - *Priorytet:* **NISKI**
5. **B2C-DEVICE-COMPARE: Porównywarka klimatyzatorów na stronie**  
   - *Opis:* Narzędzie porównujące do 3 modeli jednocześnie (moc chłodnicza/grzewcza, klasa A+++, głośność dB, WiFi).  
   - *Priorytet:* **NISKI**
6. **B2C-CATALOG-REFRESH: Automatyczne odświeżanie widoku available_combinations**  
   - *Opis:* Odświeżanie zmaterializowanego widoku katalogu po aktualizacji jednostek lub agregatów w bazie.  
   - *Wymaganie:* `B2C-CATALOG-VIEW-TRACKED`.  
   - *Priorytet:* **ŚREDNI**

### 🏢 Kategoria: Admin B2B (CRM, Lejek & Logistyka)
7. **FNL-E2-E3: Auto-transition leada do E3 po wysłaniu wyceny (Quote)**  
   - *Opis:* Automatyczne przejście stanu leada z `AWAITING_AUDIT` do `AUDIT_COMPLETED` po wysłaniu oferty z linkiem akceptacyjnym; uruchomienie zegara ważności wyceny (14 dni).  
   - *Wymagania:* `FNL-E2-E3`, `SLA-QUOTE-14D`.  
   - *Priorytet:* **WYSOKI**
8. **FNL-E3-E4: Akceptacja wyceny online i rezerwacja terminu montażu**  
   - *Opis:* Klient pod dedykowanym linkiem akceptuje regulamin i ofertę oraz wybiera termin montażu z dostępnych slotów (przeniesienie leada do `AWAITING_CREW_ASSIGNMENT`).  
   - *Wymaganie:* `FNL-E3-E4`.  
   - *Priorytet:* **WYSOKI**
9. **FNL-E3-BUCKET: Nocny cron wygaszania ofert (Zimne Leady po 14 dniach)**  
   - *Opis:* Codzienny pg_cron sprawdzający wyceny starsze niż 14 dni i przenoszący je automatycznie do `QUOTE_REJECTED` ze stemplem `bucket_entered_at` i powiadomieniem `N_REJECT`.  
   - *Wymaganie:* `FNL-E3-BUCKET`.  
   - *Priorytet:* **ŚREDNI**
10. **FNL-E4-E5: Przypisanie ekipy i zlecenie wysyłki sprzętu (E5 Hurtownia)**  
    - *Opis:* Administrator wybiera certyfikowaną ekipę z listy i zatwierdza termin montażu. Zapis zlecenia wysyłki, przejście do `HARDWARE_IN_WAREHOUSE` i powiadomienie `I3`.  
    - *Wymaganie:* `FNL-E4-E5`.  
    - *Priorytet:* **WYSOKI**
11. **FNL-E6-E7: Webhook kuriera (DPD/DHL) potwierdzający doręczenie**  
    - *Opis:* Endpoint webhooka kuriera odbierający zdarzenie doręczenia na podstawie tracking_id i automatycznie przełączający zlecenie do `AWAITING_INSTALLATION`.  
    - *Wymaganie:* `FNL-E6-E7`.  
    - *Priorytet:* **ŚREDNI**
12. **FNL-E7-E8: Zamknięcie montażu, protokół odbioru i wyznaczenie serwisu (+1 rok)**  
    - *Opis:* Zakończenie montażu przez ekipę: przejście do `INSTALLATION_COMPLETED`, automatyczne wyliczenie `next_service_date = data_zakonczenia + 1 rok`, powiadomienie `N8` z protokołem.  
    - *Wymagania:* `FNL-E7-E8`, `SRV-NEXT-DATE`.  
    - *Priorytet:* **WYSOKI**
13. **FNL-2PHASE: Obsługa montażu dwuetapowego (stan deweloperski)**  
    - *Opis:* Przejście T17 (etap I: instalacja chłodnicza pod tynk) z fakturą za etap I i linkiem do rezerwacji etapu II (montaż jednostek) po zakończeniu prac wykończeniowych.  
    - *Wymagania:* `FNL-2PHASE`, `FNL-2PHASE-INVOICE`, `FNL-2PHASE-BOOKING`.  
    - *Priorytet:* **ŚREDNI**
14. **CRM-SRV-TRIGGER: Nocny cron przeglądów gwarancyjnych i powiadomienia N10**  
    - *Opis:* Skanowanie instalacji zbliżających się do terminu serwisu rocznego i wysyłanie powiadomienia N10 do klienta na 30 dni przed terminem.  
    - *Wymagania:* `CRM-SRV-TRIGGER`, `SRV-REMINDER-ONCE`.  
    - *Priorytet:* **ŚREDNI**
15. **CRM-UST-AC1: Zgłoszenia usterek i reklamacji z priorytetem Krytyczny (SLA 48h)**  
    - *Opis:* Formularz usterki z załącznikami; zgłoszenie krytyczne natychmiast wysyła push do dyspozytora i uruchamia licznik SLA 48h (czerwone podświetlenie po przekroczeniu).  
    - *Wymagania:* `CRM-UST-AC1`, `CRM-UST-AC2`, `CRM-UST-AC3`, `NTF-I7-SLA`.  
    - *Priorytet:* **WYSOKI**
16. **CRM-KLI-SEARCH: Globalna wyszukiwarka klientów i Karta 360**  
    - *Opis:* Wyszukiwanie klientów po nazwisku, telefonie i mailu z przejściem do Karty 360: historia zleceń, instalacji, dokumentów, historii kontaktów i zgód RODO.  
    - *Wymagania:* `CRM-KLI-AC1`, `CRM-KLI-AC2`, `CRM-KLI-AC3`, `NTF-HISTORY`.  
    - *Priorytet:* **ŚREDNI**
17. **NTF-GATEWAY: Integracja produkcyjna bramki SMS (SMSAPI) i Email**  
    - *Opis:* Consumer odczytujący oczekujące wpisy z `notification_queue`, wysyłający wiadomości przez SMSAPI i dostawcę email w oknie 8:00–18:00 z obsługą retry i dead-letter.  
    - *Wymagania:* `NTF-QUEUE-WINDOW`, `NTF-RETRY`.  
    - *Priorytet:* **WYSOKI**

### 📅 Kategoria: Kalendarz & Rezerwacje
18. **CAL-TRAVEL-BUFFER: Automatyczny Bufor Czasu Dojazdu**  
    - *Opis:* Automatyczne rezerwowanie bufora dojazdowego między dwiema kolejnymi wizytami tej samej ekipy/audytora zależnie od odległości.  
    - *Wymaganie:* `CAL-TRAVEL-BUFFER`.  
    - *Priorytet:* **ŚREDNI**
19. **CAL-POOL-AGGREGATE: Sumaryczny widok wolnych slotów dla klienta**  
    - *Opis:* Klient widzi zagregowane wolne sloty całej puli wykonawców w swoim regionie, a nie grafik pojedynczej osoby.  
    - *Wymaganie:* `CAL-POOL-AGGREGATE`.  
    - *Priorytet:* **WYSOKI**
20. **CRM-REGION-AUTO: Automatyczne dopasowanie audytora/ekipy wg odległości**  
    - *Opis:* Silnik geo-dopasowania przypisujący pracownika na podstawie odległości (Haversine) adresu zlecenia od bazy pracownika i promienia działania.  
    - *Wymaganie:* `CRM-REGION-AUTO`.  
    - *Priorytet:* **ŚREDNI**
21. **INT-GOOGLE-CALENDAR: Dwukierunkowa synchronizacja z Google Calendar**  
    - *Opis:* Synchronizacja wizyt audytowych i montażowych z kalendarzami Google pracowników za pośrednictwem konta serwisowego.  
    - *Priorytet:* **ŚREDNI**

### 🔧 Kategoria: Field App (Aplikacja Terenowa)
22. **FLD-APP-PWA: Responsywna aplikacja terenowa PWA dla wykonawców**  
    - *Opis:* Dedykowany mobilny interfejs PWA dla audytorów i monterów: lista dzisiejszych zleceń, nawigacja do klienta, protokół audytu, checklist montażu i protokół odbioru.  
    - *Priorytet:* **WYSOKI**
23. **FLD-AUTH-BLOCKED: Bramka autoryzacyjna aplikacji terenowej**  
    - *Opis:* Blokada logowania do aplikacji terenowej dla kont wyłączonych administracyjnie (`is_active = false`) lub bez zaakceptowanych aktualnych regulaminów.  
    - *Wymaganie:* `FLD-AUTH-BLOCKED`.  
    - *Priorytet:* **ŚREDNI**
24. **FLD-AUDIT-PHONE-SHORTCUT: Skrócona ścieżka audytu telefonicznego**  
    - *Opis:* Szybki formularz dla audytora/handlowca rozmawiającego z dzwoniącym klientem: natychmiastowe utworzenie leada, uproszczony triage i bezpośrednia rezerwacja slotu.  
    - *Priorytet:* **ŚREDNI**

### 🔒 Kategoria: Security & Tech Debt
25. **SEC-SSO-GUARD: Ostateczne wymuszenie Google SSO w produkcji**  
    - *Opis:* Logowanie do panelu B2B wyłącznie przez Google OAuth, odrzucanie logowań spoza tabeli `authorized_users`, walidacja małych liter w adresach e-mail.  
    - *Wymagania:* `SEC-SSO-GUARD`, `SEC-EMAIL-CASE-NORMALIZE`.  
    - *Priorytet:* **ŚREDNI**

---

## 🚧 3. Zadania Zablokowane / Decyzje Biznesowe (Blocked)

1. **FLD-PHOTO-SET: Dokumentacja zdjęciowa (Field App)**  
   - *Problem:* Decyzja biznesowa, czy wymóg dokładnie 4 zdjęć (jednostka wewn., zewn., budynek, odpływ) dotyczy wyłącznie montażu końcowego, czy również odbioru etapu I w mieszkaniach deweloperskich.  
   - *Wymaganie:* `FLD-PHOTO-SET`.
2. **FLD-GEO-EN-ROUTE / GEO-UNLOCK (Field App)**  
   - *Problem:* Zgodność z RODO i zgoda na śledzenie lokalizacji GPS pracowników w czasie rzeczywistym (zbieranie lokalizacji tylko w oknie zlecenia vs punkty start/stop).  
   - *Wymagania:* `FLD-GEO-UNLOCK`, `FLD-GEO-EN-ROUTE`, `FLD-GPS-RODO`.

---

## 🎯 4. Rekomendowana Kolejność Wdrożenia (Sprint Plan)

1. **Sprint 1 (Domknięcie Lejka B2C & B2B):**
   - `B2C-BOOKING-FLOW` (Klient rezerwuje termin audytu na www)
   - `FNL-E2-E3` (Wysłanie wyceny po audycie)
   - `FNL-E3-E4` (Akceptacja wyceny przez klienta online)
   - `FNL-E4-E5` (Przydzielenie ekipy montażowej i zlecenie sprzętu)
2. **Sprint 2 (Logistyka, Realizacja & Powiadomienia):**
   - `NTF-GATEWAY` (Wysyłka SMS/Email z kolejki powiadomień)
   - `FNL-E6-E7` (Doręczenie kurierskie)
   - `FNL-E7-E8` (Zakończenie montażu i protokół odbioru)
   - `CRM-SRV-TRIGGER` (Gwarancja i przypomnienia o serwisie)
3. **Sprint 3 (Obsługa Zgłoszeń i Aplikacja Mobilna):**
   - `CRM-UST-AC1` (Zgłoszenia awarii i reklamacji SLA 48h)
   - `FLD-APP-PWA` (Interfejs terenowy dla montażystów)
   - `CRM-KLI-SEARCH` (Karta 360 klienta)
