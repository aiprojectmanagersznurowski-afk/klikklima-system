# Wymagania i Architektura Aplikacji B2B (Panel Dyspozytora)

## Kontekst Architektoniczny
- **Cel:** Budowa panelu administracyjnego B2B (Web SPA) w architekturze monorepo (Turborepo).
- **Stos technologiczny:** React/Next.js (SPA/SSR), Supabase PostgreSQL (baza danych i autoryzacja), tRPC/React Query (komunikacja), Prisma/Drizzle (ORM w paczce `@packages/database`).
- **Biznes:** Zarządzanie procesem end-to-end w branży HVAC (Klimatyzacje) – od pozyskania leada (B2C), przez wycenę i montaż (Mobile App), po serwis.

---

## Epic 1: Zarządzanie Lejkami Sprzedażowymi (Tablica Kanban)
Zaimplementuj interaktywną tablicę Kanban w panelu administracyjnym. Lejek składa się z 9 sekwencyjnych etapów (statusów) definiujących cykl życia zgłoszenia:

- **Etap 1: Nowy lead** – zgłoszenia wpadające automatycznie z kalendarza (np. Calendly) lub formularza Triage (aplikacja B2C).
- **Etap 2: Przypisanie audytora** – inżynier otrzymuje lead wraz z podpowiedziami zestawów.
- **Etap 3: Wykonany audyt** – w systemie widnieje gotowa wycena dla klienta wprowadzona z poziomu aplikacji mobilnej.
- **Etap 4: Wycena zaakceptowana** – klient zaakceptował kosztorys (oczekiwanie na płatność i termin).
- **Etap 5: Oczekuje na przydzielenie ekipy** – zlecenie opłacone, termin w kalendarzu zarezerwowany.
- **Etap 6: Wysyłka sprzętu** – urządzenia w drodze do klienta (kurier/transport).
- **Etap 7: Sprzęt dostarczony** – potwierdzony fizyczny odbiór paczki przez klienta (Bramka jakościowa dla ekipy monterskiej).
- **Etap 8: Wykonanie instalacji** – ekipa monterska u klienta realizuje zlecenie.
- **Etap 9: Instalacja zakończona** – proces montażu pomyślnie zamknięty.

---

## Epic 2: Moduł Logistyki i Wysyłek (Rollback Engine)
Zbuduj dedykowany widok tabelaryczny do zarządzania łańcuchem dostaw (Supply Chain).

- **Tabela wysyłek:** Prezentuje skolejkowane wysyłki. Kolumny: Nazwa klienta, Adres dostawy, Specyfikacja/Model sprzętu, Status.
- **Sortowanie i SLA:** Tabela domyślnie sortowana po pilności dostawy (względem daty montażu). Wprowadź kolorowanie wierszy:
  - 🔴 **Czerwony:** < 3 dni do montażu.
  - 🟠 **Pomarańczowy:** 3-7 dni do montażu.
  - 🟢 **Zielony:** > 7 dni do montażu.

### Akcje logistyczne:
1. Po potwierdzeniu z hurtownią dodaj akcję **"Oznacz jako wysłane"** -> automatycznie zmienia status leada w Kanbanie na **Etap 6**.
2. Dodaj akcję administracyjną **"Potwierdź odbiór z klientem"** -> po użyciu zmienia status leada na **Etap 7** (odblokowuje to zadanie w aplikacji mobilnej dla Montera).
3. **Obsługa wyjątków (Rollback):** W przypadku braku doręczenia, system musi pozwalać na szybkie wywołanie akcji zmiany terminu instalacji i re-kalkulację SLA w tabeli.

---

## Epic 3: Moduł CRM i Relacje Encji
Zaprojektuj klasyczny CRM w panelu B2B, zoptymalizowany pod łatwość nawigacji i strukturę relacyjną.

- **Główne widoki:** Wyraźny podział zakładek w nawigacji głównej – obok "Klientów", dodaj osobne zakładki: "Instalacje", "Serwisy", "Audytorzy" oraz "Zespoły".
- **Widok Lista Instalacji:** Osobna, rozbudowana tabela ze statusem realizacji każdego montażu (nadchodzące, zrealizowane, gwarancja), z szybkimi filtrami po ekipie monterskiej lub dacie.
- **Widok Serwisów (Tab: Serwisy):** Lista historycznych instalacji zbliżających się do terminu serwisu rocznego. Sortowana od najbliższego serwisu (bazując na kolumnie `next_service_date` z tabeli `installations`). Umożliwia wgląd w to, komu wysłano już zaproszenia i pozwala ręcznie przydzielić montera do wizyty serwisowej.
- **Karta Klienta (Widok szczegółowy 360):** Agreguje dane kontaktowe, jego szczegóły, powiązane leady, instalacje, serwisy, dokumenty i faktury, notatki, usterki, ostatnie kontakty, powiązane adresy, faktury.
- **Karta Instalacji:** Szczegóły montażu uwzględniające jednoznaczne relacje bazodanowe: przypisana Ekipa Monterska (Crew) oraz przypisany Inżynier (Auditor).
- **Nawigacja:** Zapewnij bezpośrednie linkowanie (Deep links) pomiędzy Kartą Instalacji a Kartą Klienta.

---

## Epic 4: Cykl Posprzedażowy i Retencja (Automatyzacje)
Zaprojektuj architekturę pod automatyzację procesów utrzymaniowych po zamknięciu zlecenia (Etap 9).

- **Kalkulacja dat:** Po zmianie statusu na "Instalacja zakończona" (Etap 9), baza danych generuje timestampy dla przyszłych interwałów serwisowych (`next_service_date`) dla danej instalacji.
- **Integracja Outbound & Serwisy:** System cyklicznie przegląda tabelę `installations` i na określoną liczbę dni przed `next_service_date` wyzwala przypomnienia SMS/E-mail z linkiem do zabookowania terminu serwisu.
- **Parametryzacja wysyłki wiadomości:** Architektura kolejkowania (`notification_queue`) musi pozwalać na definiowanie i egzekwowanie parametrów wysyłki, takich jak opóźnienie (np. wyślij jutro rano o 09:00 zamiast o 23:00 w nocy) oraz typ kanału (SMS vs Email). Dotyczy to całej komunikacji lejkowej (wyceny, logistyka, serwisy).
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
- Stwórz enum `LeadStatus` zawierający 9 wartości zdefiniowanych w Epicu 1.
- Zadbaj o poprawne klucze obce pomiędzy tabelami: `Clients`, `Leads`, `Quotes` (Wyceny), `Installations` (Szczegóły montażu), `Shipments`, `Crews` i `Auditors`.
- Zapewnij integrację statusu płatności (webhooki od Stripe/P24) z tabelą `Quotes`, automatycznie zmieniając status przypisanego `Leada`.

### State Management (UI Layer)
- Do obsługi drag-and-drop na tablicy Kanban użyj `@hello-pangea/dnd`.
- Zaimplementuj Optimistic UI za pomocą React Query (lub tRPC), aby tablica reagowała natychmiast, a zapytanie do Supabase działo się w tle.

### Logika Biznesowa (SLA)
- Do wyliczania różnicy dat (dni) na potrzeby kolorowania wierszy w module logistyki użyj funkcji z biblioteki `date-fns` (np. `differenceInDays`). Zwracaj odpowiednie flagi w warstwie prezentacji.
