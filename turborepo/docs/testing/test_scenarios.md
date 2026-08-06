# Rejestr Scenariuszy Testowych (Playwright BDD)

Ten dokument stanowi **centralny rejestr** wszystkich scenariuszy testowych E2E w systemie KlikKlima. Workflow `/test` odwołuje się do tego pliku przy generowaniu i uruchamianiu testów regresji.

## Konwencje
- Każdy scenariusz opisany w formacie **BDD**: Given / When / Then.
- Grupowanie wg modułu/aplikacji.
- Status: ⬜ Do zaimplementowania | ✅ Zaimplementowany | 🔴 Failing

---

## B2C — Triage (Kalkulator)

### ⬜ Scenariusz: Ścieżka Single Split (1 pokój)
- **Given** użytkownik otwiera formularz Triage na stronie B2C
- **When** wybiera typ budynku „Mieszkanie", 1 pokój, metraż 25m²
- **Then** system proponuje zestawy Single Split z katalogu `single_split_sets`
- **And** wyświetla szacunkowe widełki cenowe

### ⬜ Scenariusz: Ścieżka Multi Split (2+ pokoje)
- **Given** użytkownik otwiera formularz Triage
- **When** wybiera typ budynku „Dom", 3 pokoje z różnymi metrażami
- **Then** system proponuje zestawy Multi Split z katalogu `multi_split_sets`
- **And** wyświetla szacunkowe widełki cenowe z uwzględnieniem wielu jednostek

### ⬜ Scenariusz: Walidacja adresu (Google Places)
- **Given** użytkownik dotarł do kroku z adresem
- **When** wpisuje częściowy adres
- **Then** system podpowiada pełne adresy z Google Places API
- **And** zapisuje współrzędne `lat`/`lng` do leadu

### ⬜ Scenariusz: Zapis leadu po zakończeniu Triage
- **Given** użytkownik przeszedł wszystkie kroki formularza
- **When** podaje dane kontaktowe (imię, email, telefon) i zatwierdza
- **Then** system tworzy rekord w tabeli `klienci`, `adresy` i `leady`
- **And** lead pojawia się w tabeli zgłoszeń B2B pod statusem „Etap 1: Nowy lead"

---

## B2B — Panel Dyspozytora

### ✅ Scenariusz: Lista Klientów B2B i otwieranie Karty 360 w nowej karcie
- **Given** dyspozytor znajduje się na stronie `/clients`
- **When** przegląda tabelę zarejestrowanych klientów i klika przycisk "Karta 360"
- **Then** system otwiera w nowej karcie (`target="_blank"`) dedykowany widok szczegółów `/clients/[id]`
- **And** na karcie widoczne są kompletne dane z relacjami: leady, instalacje, serwisy, usterki, dokumenty, notatki oraz historia powiadomień

### ⬜ Scenariusz: Tabela zgłoszeń — przypisanie audytora (E1 → E2)
- **Given** dyspozytor jest zalogowany i widzi tabelę zgłoszeń (wybrany filtr: Etap 1 lub Wszystkie)
- **When** przypisuje audytora do leada na Etapie 1
- **Then** lead zmienia status na „Etap 2: Oczekiwanie na audyt" w bazie danych
- **And** system wysyła SMS/Email do klienta z informacją o przydzieleniu audytora

### ⬜ Scenariusz: Auto-odrzucenie wyceny po 14 dniach (E3 → Bucket)
- **Given** lead jest na Etapie 3 z wygenerowaną wyceną
- **When** mija 14 dni bez akceptacji ze strony klienta
- **Then** system automatycznie (pg_cron) przenosi lead do bucketu „Wyceny odrzucone"
- **And** klient otrzymuje Email informujący o wygaśnięciu wyceny

### ⬜ Scenariusz: Akceptacja wyceny przez klienta (E3 → E4)
- **Given** klient otrzymał email z linkiem do wyceny
- **When** akceptuje wycenę i rezerwuje termin montażu
- **Then** lead przechodzi na Etap 4: Oczekuje na przydzielenie ekipy
- **And** dyspozytor otrzymuje powiadomienie o nowym zleceniu do przypisania ekipy

### ⬜ Scenariusz: State Bypass — dostawa z ekipą (E5 → E7)
- **Given** lead jest na Etapie 5 (sprzęt w hurtowni), ekipa przypisana
- **When** dyspozytor klika „Dostawa z ekipą w dniu montażu"
- **Then** lead pomija Etap 6 i przechodzi bezpośrednio na Etap 7: Oczekuje instalacji
- **And** Etap 6 (Wysyłka w drodze) jest pominięty w historii statusów

### ⬜ Scenariusz: Wysyłka kurierem z Tracking ID (E5 → E6)
- **Given** lead jest na Etapie 5
- **When** dyspozytor klika „Wysłano kurierem" i podaje Tracking ID
- **Then** lead przechodzi na Etap 6: Wysyłka w drodze
- **And** klient otrzymuje SMS z numerem przesyłki

### ⬜ Scenariusz: Rollback Engine — zmiana terminu (E4–E7 → Bucket → E4)
- **Given** lead jest na jednym z etapów 4–7
- **When** klient klika „Zmień termin" w e-mailu LUB dyspozytor wyzwala akcję „Rollback"
- **Then** lead trafia do bucketu „Anulowane / Do przełożenia"
- **And** system zwalnia slot kalendarza ekipy
- **And** klient otrzymuje email ratunkowy z linkiem do ponownej rezerwacji
- **When** klient rezerwuje nowy termin z linku
- **Then** lead wraca do Etapu 4: Oczekuje na przydzielenie ekipy

### ⬜ Scenariusz: Dodawanie nowego audytora
- **Given** dyspozytor jest na stronie `/auditors`
- **When** klika „Dodaj audytora", wypełnia formularz (nazwa firmy, telefon, prowizja)
- **Then** system tworzy nowy rekord w tabeli `audytorzy`
- **And** audytor pojawia się w tabeli na stronie

### ⬜ Scenariusz: Dodawanie nowej ekipy monterskiej
- **Given** dyspozytor jest na stronie `/auditors`
- **When** przełącza się na zakładkę „Ekipy", klika „Dodaj ekipę" i wypełnia formularz
- **Then** system tworzy nowy rekord w tabeli `zespoly_monterskie`
- **And** ekipa pojawia się w tabeli

### ⬜ Scenariusz: Tworzenie wyceny (Quote)
- **Given** audytor wykonał audyt i lead jest na Etapie 3
- **When** dyspozytor (lub audytor) tworzy wycenę z pozycjami (urządzenia, montaż, rabaty)
- **Then** system tworzy rekord w tabeli `quotes` ze statusem „Oczekująca"
- **And** klient otrzymuje Email z linkiem do akceptacji i rezerwacji terminu

---

## B2B — System Powiadomień

### ⬜ Scenariusz: Automatyczny SMS po przypisaniu audytora
- **Given** lead jest na Etapie 1
- **When** dyspozytor przypisuje audytora (E1 → E2)
- **Then** system dodaje wpis do `notification_queue` z typem SMS
- **And** SMS jest wysyłany do klienta w godzinach 8:00-18:00

### ⬜ Scenariusz: Przypomnienie 24h przed audytem
- **Given** lead ma zarezerwowany termin audytu na jutro
- **When** CRON uruchamia się o godz. 17:00 (dzień przed)
- **Then** system wysyła SMS/Email z przypomnieniem i opcją zmiany terminu

### ⬜ Scenariusz: SMS geolokalizacyjny (audytor w drodze)
- **Given** audytor jest w Field App i ma zaplanowaną wizytę
- **When** klika „Wyruszam" lub GPS wykrywa wjazd w promień 5km od adresu
- **Then** system wysyła SMS do klienta „Audytor jest w drodze!"

### ⬜ Scenariusz: Email ratunkowy po Rollback
- **Given** lead został przeniesiony do bucketu „Anulowane / Do przełożenia"
- **When** system zwalnia kalendarz ekipy
- **Then** klient otrzymuje Email z linkiem do rezerwacji nowego terminu

---

## Field App — Instalacja

### ⬜ Scenariusz: Monter widzi przypisane zadanie
- **Given** monter jest zalogowany do Field App
- **When** otwiera listę zadań na dziś
- **Then** widzi przypisane instalacje z adresem, kontaktem klienta i szczegółami

### ⬜ Scenariusz: Zakończenie instalacji z protokołem
- **Given** monter jest na miejscu i wykonał montaż
- **When** wypełnia protokół zdawczo-odbiorczy, dodaje zdjęcia i klika „Zakończ"
- **Then** system tworzy rekord w tabeli `installations`
- **And** lead przechodzi na Etap 8 (Instalacja zakończona)
- **And** klient otrzymuje Email z kartą gwarancyjną + protokołem + fakturą

---

## Serwisy i Reklamacje

> **Uwaga:** Proces serwisów i usterek zostanie zdefiniowany w osobnym wątku. Poniższe scenariusze zachowane jako placeholder.

### ⬜ Scenariusz: Przypomnienie o przeglądzie
- **Given** instalacja ma ustawiony `next_service_date` za X dni
- **When** CRON wykrywa zbliżający się termin
- **Then** system wysyła SMS/Email do klienta z linkiem do rezerwacji terminu

### ⬜ Scenariusz: Zgłoszenie usterki przez formularz B2C
- **Given** klient otwiera formularz reklamacyjny na stronie
- **When** opisuje usterkę i zatwierdza zgłoszenie
- **Then** system tworzy rekord serwisowy
- **And** klient otrzymuje SMS/Email z linkiem do rezerwacji terminu wizyty
