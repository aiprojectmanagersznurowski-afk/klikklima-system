# Wymagania i Architektura Aplikacji B2B (Panel Dyspozytora)

## Kontekst Architektoniczny
- **Cel:** Budowa panelu administracyjnego B2B (Web SPA) w architekturze monorepo (Turborepo).
- **Stos technologiczny:** React/Next.js (SPA/SSR), Supabase PostgreSQL (baza danych i autoryzacja), tRPC/React Query (komunikacja), Prisma/Drizzle (ORM w paczce `@packages/database`).
- **Biznes:** Zarządzanie procesem end-to-end w branży HVAC (Klimatyzacje) – od pozyskania leada (B2C), przez wycenę i montaż (Mobile App), po serwis.

---

## Epic 0: Architektura Nawigacji Głównej (Sidebar)
Zaimplementuj stały pasek boczny (Sidebar) z następującą strukturą nawigacji:

- **Pulpit (Dashboard)** — strona główna panelu ze statystykami biznesowym:
  - Mapa lejka: liczba leadów na każdym z 8 etapów.
  - Alerty SLA: lista leadów z logistyki oznaczonych 🔴 (< 3 dni) lub 🟠 (3–7 dni).
  - Nadchodzące instalacje (najbliższe 7 dni).
  - Liczba leadów w bucketach (Zimne leady, Rollback / Do przełożenia).

- **Leady** — widok tabeli ze zmianą i filtrowaniem etapów (Etapy 1–8) oraz bucketami.

- **CRM** *(menu wysuwane)* — sekcja zarządzania relacjami i encjami B2B:
  - Klienci (Karta 360)
  - Instalacje
  - Serwisy
  - Usterki
  - Audytorzy
  - Zespoły
  - **Zimne leady** *(Bucket)* — lista leadów z bucketu „Wyceny odrzucone" (brak akceptacji > 14 dni). Umożliwia dyspozytorowi podjęcie akcji re-angażujących lub trwałej archiwizacji.

  

- **Logistyka** *(menu wysuwane)* — sekcja zarządzania łańcuchem dostaw (Supply Chain):
  - **Do wysłania** — lista leadów na Etapie 5 (Wysyłka sprzętu – W hurtowni).
  - **Wysyłka w drodze** — lista leadów na Etapie 6 (Wysyłka w drodze – Kurier).
  - **Rollback / Do przełożenia** *(Bucket)* — lista leadów w buckecie „Anulowane / Do przełożenia", oczekujących na ponowną rezerwację terminu montażu.

- **Centrum Powiadomień** — pełna historia wysłanych i zakolejkowanych powiadomień SMS/Email z tabeli `notification_queue` z opcją ponowienia wysyłki w razie błędów.

- **Ustawienia** *(menu rozwijane)* — konfiguracja systemu:
  - **Exit Intent** (checkbox): włączenie/wyłączenie pop-upu ratunkowego z formularzem zapisu na stronie B2C.
  - Użytkownicy i Uprawnienia (RBAC) — zarządzanie rolami i uprawnieniami pracowników.
  - Parametry powiadomień — konfiguracja godzin i harmonogramów wysyłki (np. SMS tylko w godzinach 8:00–18:00).

---

## Epic 1: Zarządzanie Lejkiem Sprzedażowym (Tabela z Wyborem Etapu)
Rezygnujemy z tradycyjnej tablicy Kanban – w panelu administracyjnym zaimplementuj rozbudowaną tabelę wyświetlającą leady na poszczególnych etapach. Nad tabelką umieść rozwijaną listę (Dropdown / Select ze Shadcn UI) pozwalającą na szybkie filtrowanie i wybieranie aktualnie przeglądanego etapu, bucketu lub wyświetlenie wszystkich.

Cykl życia zgłoszenia sprzedażowo-montażowego składa się z **8 sekwencyjnych etapów** i **2 stanów pobocznych (bucketów)**:

### Etapy główne

- **Etap 1: Nowy lead** – wpada nowy lead z kalendarza (np. Calendly) lub formularza Triage (aplikacja B2C).
  - *Wyzwalacz do E2:* Administrator dokonuje ręcznego przypisania audytora do leada w systemie.

- **Etap 2: Oczekiwanie na audyt** – audytor ma przypisany lead i realizuje wizję lokalną.
  - *Wyzwalacz do E3:* Audytor wysyła wycenę z aplikacji mobilnej do klienta. Po jej wysłaniu lead przechodzi automatycznie (auto-transition) do kolejnego etapu.

- **Etap 3: Wykonany audyt** – w systemie widnieje gotowa wycena. Klient otrzymał ofertę i decyduje o jej akceptacji.
  - *Wyzwalacz do E4 (Sukces):* Klient akceptuje wycenę poprzez rezerwację konkretnego terminu montażu.
  - *Wyzwalacz do Bucketu „Wyceny odrzucone" (Automat):* Jeśli klient nie zaakceptuje wyceny w ciągu 14 dni, lead automatycznie spada do bucketu.

- **Etap 4: Oczekuje na przydzielenie ekipy** – zlecenie posiada zarezerwowany termin instalacji. System oczekuje na ostateczne dobranie brygady monterskiej.
  - *Wyzwalacz do E5:* Administrator przypisuje konkretną ekipę monterską (`Crew_ID`) do zlecenia. Status przechodzi do działu logistyki.

- **Etap 5: Wysyłka sprzętu (W hurtowni)** – przygotowanie zlecenia wysyłki, kompletowanie urządzeń w magazynie.
  - *Wyzwalacz do E6 (Ścieżka Kurierska):* Dyspozytor klika „Wysłano kurierem" i dodaje Tracking ID.
  - *Wyzwalacz do E7 (State Bypass – Ścieżka Bezpośrednia):* Dyspozytor klika „Dostawa z ekipą w dniu montażu" — pomija etap wysyłki kurierem.

- **Etap 6: Wysyłka w drodze (Kurier)** – paczka nadana kurierem jest w drodze do klienta.
  - *Wyzwalacz do E7:* Webhook od firmy kurierskiej zwraca status „Doręczono" LUB dyspozytor ręcznie klika „Paczka dostarczona".

- **Etap 7: Oczekuje instalacji** – warunki logistyczne spełnione. Ekipa monterska jest gotowa, sprzęt jest u klienta lub jedzie z monterami.
  - *Wyzwalacz do E8:* Instalator za pomocą aplikacji mobilnej zmienia status zlecenia na „Zakończone" po udanym montażu.

- **Etap 8: Instalacja zakończona** – proces montażu pomyślnie zamknięty.

### Stany poboczne (Buckety)

- **Bucket: Wyceny odrzucone** – miejsce na leady, które nie skonwertowały.
  - *Wyzwalacz WEJŚCIA:* Brak akceptacji wyceny na Etapie 3 przez ponad 14 dni (automat `pg_cron`).

- **Bucket: Anulowane / Do przełożenia (Rollback Engine)** – worek na leady wyjęte z głównego przepływu. Zwalnia zasoby (kalendarz ekipy) i blokuje SLA logistyczne.
  - *Wyzwalacze WEJŚCIA:* Klient klika „Zmień termin / Anuluj" w e-mailu LUB Dyspozytor wyzwala akcję „Problem z dostawą (Rollback)" z etapów 4–7.
  - *Wyzwalacz WYJŚCIA (Powrót do lejka):* Klient wybiera nowy termin z linku w e-mailu ratunkowym → lead wraca do Etapu 4.


---

## Epic 2: Moduł Logistyki i Wysyłek (Rollback Engine)
Zbuduj dedykowany widok tabelaryczny do zarządzania łańcuchem dostaw (Supply Chain).

- **Tabela wysyłek:** Prezentuje skolejkowane wysyłki. Kolumny: Nazwa klienta, Adres dostawy, Specyfikacja/Model sprzętu, Status, Tracking ID.
- **Sortowanie i SLA:** Tabela domyślnie sortowana po pilności dostawy (względem daty montażu). Wprowadź kolorowanie wierszy:
  - 🔴 **Czerwony:** < 3 dni do montażu.
  - 🟠 **Pomarańczowy:** 3-7 dni do montażu.

### Akcje logistyczne:
1. Po potwierdzeniu nadania z hurtownią/kurierem dodaj akcję **„Wysłano kurierem"** → automatycznie zmienia status leada na **Etap 6: Wysyłka w drodze** i zapisuje Tracking ID.
2. Dodaj akcję **„Dostawa z ekipą (Bypass)"** → pomija Etap 6 i przenosi lead bezpośrednio na **Etap 7: Oczekuje instalacji**.
3. Dodaj akcję **„Paczka dostarczona"** → zmienia status leada z Etapu 6 na **Etap 7: Oczekuje instalacji** (alternatywa dla webhooka kurierskiego).
4. **Obsługa wyjątków (Rollback):** W przypadku zagubionej paczki, problemu magazynowego lub zmiany terminu, system przenosi lead do **Bucketu „Anulowane / Do przełożenia"**, zwalnia kalendarz ekipy i wysyła klientowi e-mail z linkiem do ponownej rezerwacji terminu.

---

## Epic 3: Moduł CRM i Relacje Encji
Zaprojektuj klasyczny CRM w panelu B2B, zoptymalizowany pod łatwość nawigacji i strukturę relacyjną.

> 📖 **Pełna specyfikacja biznesowa, modele danych, akcje (w tym globalna akcja 🚨 „Usuń" dla Administratora), obsługa certyfikatów (F-Gaz/SEP) oraz kryteria akceptacji dla wszystkich 7 widoków CRM (Klienci, Instalacje, Serwisy, Usterki, Audytorzy, Zespoły, Zimne leady) znajdują się w pliku: [b2b_crm_specifications.md](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/architecture/b2b_crm_specifications.md).**

- **Główne widoki:** Wyraźny podział w sekcji CRM nawigacji bocznej na: Klientów, Instalacje, Serwisy, Usterki, Audytorów, Zespoły oraz Zimne leady.
- **Widok Lista Instalacji:** Osobna, rozbudowana tabela ze statusem realizacji każdego montażu (nadchodzące, zrealizowane, gwarancja), z szybkimi filtrami po ekipie monterskiej lub dacie.
- **Widok Serwisów (Tab: Serwisy):** Lista historycznych instalacji zbliżających się do terminu serwisu rocznego. Sortowana od najbliższego serwisu (bazując na kolumnie `next_service_date` z tabeli `installations`). Umożliwia wgląd w to, komu wysłano już zaproszenia i pozwala ręcznie przydzielić montera do wizyty serwisowej.
- **Karta Klienta (Widok szczegółowy 360):** Agreguje dane kontaktowe, jego szczegóły, powiązane leady, instalacje, serwisy, dokumenty i faktury, notatki, usterki, ostatnie kontakty, powiązane adresy, faktury.
- **Karta Instalacji:** Szczegóły montażu uwzględniające jednoznaczne relacje bazodanowe: przypisana Ekipa Monterska (Crew) oraz przypisany Inżynier (Auditor).
- **Nawigacja:** Zapewnij bezpośrednie linkowanie (Deep links) pomiędzy Kartą Instalacji a Kartą Klienta.

---

## Epic 4: Cykl Posprzedażowy i Retencja (Automatyzacje)
Zaprojektuj architekturę pod automatyzację procesów utrzymaniowych po zamknięciu zlecenia (Etap 8: Instalacja zakończona).

- **Kalkulacja dat:** Po zmianie statusu na „Instalacja zakończona" (Etap 8), baza danych generuje timestampy dla przyszłych interwałów serwisowych (`next_service_date`) dla danej instalacji.
- **Integracja Outbound & Serwisy:** System cyklicznie przegląda tabelę `installations` i na określoną liczbę dni przed `next_service_date` wyzwala przypomnienia SMS/E-mail z linkiem do zabookowania terminu serwisu.
- **Parametryzacja wysyłki wiadomości:** Architektura kolejkowania (`notification_queue`) musi pozwalać na definiowanie i egzekwowanie parametrów wysyłki, takich jak opóźnienie (np. wyślij jutro rano o 09:00 zamiast o 23:00 w nocy) oraz typ kanału (SMS vs Email). Dotyczy to całej komunikacji lejkowej (wyceny, logistyka, serwisy).

> **Uwaga:** Szczegółowy proces serwisów i usterek zostanie zdefiniowany w osobnym wątku.

---

## Epic 5: Autoryzacja i Zarządzanie Dostępem (RBAC)
Zaimplementuj system logowania i ścisłą kontrolę dostępu do panelu B2B, opartą o Supabase Auth.

- **Logowanie (SSO):** Wdrożenie logowania wyłącznie za pomocą konta Google (OAuth2).
- **Zarządzanie Dostępem (Admin):** Moduł w ustawieniach ("Użytkownicy i Uprawnienia") pozwalający głównemu administratorowi na zapraszanie nowych pracowników (przypisywanie im ról, np. Dyspozytor, Audytor, Administrator).
- **Bramka Dostępu (Guard):** Osoba próbująca zalogować się przez Google, której adres e-mail nie widnieje na liście dozwolonych użytkowników w bazie (lub nie ma przypisanej roli), musi zostać zablokowana i otrzymać komunikat o braku uprawnień.
- **Row Level Security (RLS):** Zabezpieczenie danych na poziomie bazy danych Supabase – np. Audytor widzi tylko zlecenia przypisane do siebie, a Dyspozytor widzi wszystko.

---

## Dyrektywy Implementacyjne dla Agenta AI

### Baza Danych (Data Layer)
- Zaktualizuj schemat bazy w `@packages/database`.
- Stwórz enum `LeadStatus` zawierający **8 wartości głównych** (`NEW_LEAD`, `AWAITING_AUDIT`, `AUDIT_COMPLETED`, `AWAITING_CREW_ASSIGNMENT`, `HARDWARE_IN_WAREHOUSE`, `HARDWARE_IN_TRANSIT`, `AWAITING_INSTALLATION`, `INSTALLATION_COMPLETED`) oraz **2 stany bucket** (`QUOTE_REJECTED`, `ROLLBACK_RESCHEDULING`) zdefiniowane w Epicu 1.
- Zadbaj o poprawne klucze obce pomiędzy tabelami: `Clients`, `Leads`, `Quotes` (Wyceny), `Installations` (Szczegóły montażu), `Shipments`, `Crews` i `Auditors`.
- Zapewnij integrację statusu płatności (webhooki od Stripe/P24) z tabelą `Quotes`, automatycznie zmieniając status przypisanego `Leada`.
- Zaimplementuj automatyczny trigger lub `pg_cron` job przenoszący leady z Etapu 3 do bucketu `QUOTE_REJECTED` po upływie 14 dni bez akceptacji.
- Przygotuj kolumnę `tracking_id` w tabeli `Shipments` na potrzeby integracji z webhookiem kurierskim.

### State Management (UI Layer)
- Zastosuj tabelę (Shadcn `Table`) wraz z rozwijaną listą filtrów (`Select` ze Shadcn UI) umieszczoną nad tabelą do przełączania etapów 1–8 oraz bucketów.
- Zaimplementuj Optimistic UI za pomocą React Query / Server Actions, aby zmiana statusu leada reagowała w tabeli natychmiastowo, a aktualizacja w bazie Supabase działa się w tle.
- Obsłuż **State Bypass** (E5 → E7) jako osobną akcję w interfejsie logistycznym.

### Logika Biznesowa (SLA)
- Do wyliczania różnicy dat (dni) na potrzeby kolorowania wierszy w module logistyki użyj funkcji z biblioteki `date-fns` (np. `differenceInDays`). Zwracaj odpowiednie flagi w warstwie prezentacji.
- Kolorowanie SLA: 🔴 Czerwony (< 3 dni do montażu), 🟠 Pomarańczowy (3–7 dni do montażu).

### Rollback Engine
- Zaimplementuj mechanizm przenoszenia leadów z etapów 4–7 do bucketu `ROLLBACK_RESCHEDULING`.
- Po wejściu leada do bucketu: zwolnij slot kalendarza ekipy i wyślij klientowi e-mail ratunkowy z linkiem do ponownej rezerwacji.
- Po wybraniu nowego terminu przez klienta: lead wraca do Etapu 4 (`AWAITING_CREW_ASSIGNMENT`).
