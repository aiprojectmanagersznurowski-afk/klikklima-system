# Specyfikacja i Wymagania Widoków CRM (Panel B2B)

Ten dokument zawiera szczegółowe wymagania funkcjonalne, modele danych, reguły automatyzacji, akcje oraz kryteria akceptacji dla wszystkich 7 widoków modułu CRM w Panelu Administracyjnym B2B (KlikKlima).

> [!IMPORTANT]
> **Globalne Uprawnienie Usuwania:** W każdym z poniższych widoków zaimplementowana jest globalna akcja **🚨 „Usuń”**, która jest zarezerwowana **wyłącznie dla roli Administratora**. Jest to kluczowe z punktu widzenia utrzymania higieny bazy danych oraz zgodności z przepisami RODO.

---

## 1. Widok: Klienci (Karta 360)

### Cel biznesowy
Zapewnienie Dyspozytorowi i Administratorowi pełnego, scentralizowanego widoku (Single Source of Truth) o relacji z danym klientem. Karta 360 agreguje dane z całego cyklu życia: od leadu, przez audyt i instalację, aż po historię serwisową i usterki.

### Model danych (Informacje wyświetlane)
- **Dane podstawowe:** Imię, Nazwisko, Telefon, E-mail, Adresy (domyślny i adresy inwestycji).
- **Powiązane obiekty (Zakładki/Sekcje):**
  - **Historia Leadów:** Statusy obecnych i historycznych leadów (np. "Instalacja zakończona", "Wycena odrzucona").
  - **Dokumenty:** Wygenerowane wyceny (PDF), umowy, protokoły po-montażowe, zdjęcia z audytu.
  - **Urządzenia:** Lista zainstalowanych urządzeń (Model, SN, data montażu, data ważności gwarancji).
  - **Zgłoszenia:** Powiązane tickety serwisowe i usterki.
  - **Komunikacja:** Historia wysłanych automatycznych e-maili i SMS-ów.

### Akcje (Call to Action)
- `Edytuj dane klienta`
- `Dodaj nową inwestycję / adres`
- `Wygeneruj link do płatności / rezerwacji` (ręczne wywołanie dla opornych klientów)
- `Zgłoś usterkę` (bezpośrednie przejście do formularza usterki z pre-wypełnionymi danymi)
- 🚨 `Usuń klienta` (Tylko dla roli Administrator – twarde usunięcie / usunięcie zgodne z RODO)

### Kryteria Akceptacji
1. Użytkownik może wyszukać klienta po imieniu, nazwisku, telefonie lub adresie e-mail z globalnej wyszukiwarki.
2. Zmiana danych kontaktowych na Karcie 360 propaguje się do aktywnych leadów.
3. Karta 360 ładuje dane asynchronicznie, aby uniknąć opóźnień przy dużej historii klienta (Lazy loading dla historii i plików).

---

## 2. Widok: Instalacje (Tabela / Kanban)

### Cel biznesowy
Zarządzanie aktywnymi instalacjami. Obejmuje leady, które pomyślnie przeszły proces sprzedażowy i logistyczny, a obecnie oczekują na montaż lub są w jego trakcie (Etapy 7 i 8 z głównego lejka).

### Model danych (Kolumny tabeli)
- **ID Instalacji / Klient:** Link do Karty 360.
- **Data i czas:** Zarezerwowany termin montażu.
- **Ekipa monterska:** ID/Nazwa przypisanej brygady.
- **Status:** Oczekuje instalacji / W trakcie / Instalacja zakończona (do rozliczenia).
- **Sprzęt:** Główne urządzenie / Model.

### Filtrowanie i Sortowanie
- **Domyślne sortowanie:** Chronologicznie według daty instalacji (najbliższe na górze).
- **Filtry:** Zakres dat, Przypisana ekipa, Status, Lokalizacja (miasto/kod pocztowy).

### Akcje
- `Podgląd detali instalacji` (sprzęt, uwagi od audytora).
- `Zmień ekipę / Re-przydziel` (Wyzwala sprawdzenie kalendarza i ewentualnie przenosi z powrotem do Etapu 4).
- `Generuj protokół zdawczo-odbiorczy` (PDF na podstawie danych z instalacji).
- 🚨 `Usuń instalację` (Tylko Administrator – np. w przypadku błędnego wpisu systemowego).

### Kryteria Akceptacji
1. Widok automatycznie odświeża statusy, gdy Ekipa (w aplikacji mobilnej) oznaczy instalację jako zakończoną.
2. Wiersze z instalacjami zaplanowanymi na dzisiaj, które nie mają jeszcze statusu "Zakończona" do godziny 16:00, podświetlają się na pomarańczowo (Alert dla dyspozytora).

---

## 3. Widok: Serwisy (Przeglądy okresowe)

### Cel biznesowy
Proaktywne zarządzanie cyklicznymi przeglądami gwarancyjnymi i pogwarancyjnymi. Moduł pilnuje, aby urządzenia były serwisowane na czas, generując powtarzalny przychód.

### Model danych (Kolumny tabeli)
- **Klient / Adres:** Link do Karty 360.
- **Urządzenie:** Typ i numer seryjny.
- **Data instalacji:** Baza do wyliczenia przeglądów.
- **Termin najbliższego serwisu:** Data wyliczona automatycznie (np. Instalacja + 1 rok).
- **Status serwisu:** Oczekuje na kontakt / Zaplanowany / Wykonany / Zignorowany przez klienta.

### Reguły automatyzacji (Triggery)
- Na 30 dni przed upływem terminu serwisu, system wysyła automatycznego e-maila do klienta z przypomnieniem i linkiem do kalendarza serwisowego.
- Zmiana statusu na "Zaplanowany" następuje automatycznie, gdy klient wybierze termin.

### Akcje
- `Zadzwoń do klienta` (logowanie próby kontaktu).
- `Zarezerwuj termin ręcznie`.
- `Oznacz sprzęt jako wyrejestrowany / bez opieki`.
- 🚨 `Usuń wpis serwisowy` (Tylko Administrator).

### Kryteria Akceptacji
1. System musi posiadać job (np. cron), który codziennie w nocy aktualizuje statusy zbliżających się serwisów i generuje powiadomienia.
2. Widok domyślnie wyświetla serwisy zaległe na czerwono, a nadchodzące w ciągu 30 dni na żółto/pomarańczowo.

---

## 4. Widok: Usterki (Incident Management)

### Cel biznesowy
Szybkie i priorytetowe zarządzanie awariami zgłoszonymi przez klientów. Proces odizolowany od lejka sprzedażowego, oparty o SLA naprawy.

### Model danych (Kolumny tabeli)
- **ID Usterki:** Unikalny numer (np. UST-2026-001).
- **Zgłaszający:** Klient (Link do Karty 360).
- **Priorytet:** Niski / Średni / Krytyczny (np. wyciek wody, brak chłodzenia serwerowni).
- **Status:** Nowe zgłoszenie / Ekipa w drodze / Oczekuje na części / Naprawione / Gwarancja Odrzucona.
- **Przypisana Ekipa:** Brygada ratunkowa / serwisowa.

### Akcje
- `Zmień priorytet`
- `Przypisz do zespołu serwisowego`
- `Zawieś usterkę (oczekiwanie na części)` - wstrzymuje licznik SLA.
- `Zamknij usterkę` (Wymaga notatki służbowej).
- 🚨 `Usuń usterkę` (Tylko Administrator - usunięcie duplikatu zgłoszenia).

### Kryteria Akceptacji
1. Priorytet "Krytyczny" natychmiast wysyła notyfikację PUSH do Dyspozytora.
2. Formularz zgłoszenia usterki musi wymuszać podanie opisu problemu i umożliwiać dodanie zdjęć/wideo przez klienta (B2C) lub dyspozytora (B2B).
3. Wizualny wskaźnik SLA: przekroczenie 48h od zgłoszenia (dla priorytetu wysokiego) bez akcji powoduje zmianę koloru wiersza na czerwony.

---

## 5. Widok: Audytorzy (Konsultanci Techniczno-Handlowi)

### Cel biznesowy
Zarządzanie zasobami ludzkimi na początku lejka (Etap 2). Dyspozytor widzi, kto ma ile leadów, z jaką skutecznością zamyka wyceny oraz czy posiada aktualne uprawnienia do pracy w terenie.

### Model danych
- **Wizytówka:** Zdjęcie profilowe (avatar).
- **Imię i Nazwisko / Region:** Obszar działania.
- **Uprawnienia i Certyfikaty:** 
  - Certyfikat F-gazowy (numer wpisu i data ważności).
  - Uprawnienia elektryczne SEP (kategoria i data ważności).
- **Aktywne leady:** Liczba przypisanych leadów na Etapie 2 i 3.
- **Skuteczność (Konwersja):** % wycen zaakceptowanych z ostatnich 30 dni.
- **Status dostępności:** Aktywny / Urlop / Zwolnienie.

### Akcje
- `Dodaj / Edytuj audytora` (Tworzy profil użytkownika i przydziela dostęp).
- `Wgraj zdjęcie profilowe` (Tylko Administrator).
- `Zarządzaj regionem` (Definiowanie kodów pocztowych dla auto-przypisywania).
- `Podgląd kalendarza audytora` (Wizyty lokalne).
- 🚨 `Usuń audytora` (Tylko Administrator - wymusza wcześniejsze przepięcie "wiszących" leadów na inną osobę).

### Kryteria Akceptacji
1. Administrator może zablokować konto audytora lub usunąć je, co uniemożliwia logowanie do aplikacji mobilnej i wymaga rozwiązania konfliktów przypisanych leadów.
2. System pozwala na definicję maksymalnej liczby dziennych audytów (np. cap = 5), co blokuje możliwość przypisania kolejnych w tym samym dniu.
3. Uprawnienia F-gaz i SEP muszą posiadać przypomnienia o wygasającej ważności (alert dla Administratora).

---

## 6. Widok: Zespoły (Zarządzanie Brygadami)

### Cel biznesowy
Planowanie i kontrola zasobów instalacyjnych. Zarządzanie uprawnieniami, certyfikatami technicznymi oraz kalendarzami ekip realizujących zlecenia (Etapy 5-8).

### Model danych
- **Wizytówka:** Zdjęcie reprezentatywne ekipy (np. zdjęcie brygady przy aucie).
- **ID Zespołu / Nazwa:** np. "Ekipa Alpha - Wrocław".
- **Skład osobowy:** Lista pracowników w zespole (Kierownik ekipy, pomocnik).
- **Uprawnienia i Certyfikaty zespołu:** 
  - Certyfikat F-gazowy (numer wpisu, posiadacz, data ważności).
  - Uprawnienia elektryczne SEP (kategoria, posiadacz, data ważności).
  - *Opcjonalnie: UDT.*
- **Pojazd / Wyposażenie:** Przypisane auto służbowe.
- **Obciążenie:** Ilość zaplanowanych instalacji na dany tydzień.

### Akcje
- `Edytuj profil zespołu` (Aktualizacja dat ważności certyfikatów, składu ekipy).
- `Wgraj zdjęcie reprezentatywne` (Tylko Administrator).
- `Zablokuj kalendarz` (Wprowadzenie urlopu, awarii auta).
- `Widok harmonogramu` (Przejście do siatki kalendarza/Gantta).
- 🚨 `Usuń zespół` (Tylko Administrator - dezaktywacja brygady z systemu).

### Kryteria Akceptacji
1. System musi wysyłać powiadomienie do Administratora na 30 dni przed wygaśnięciem certyfikatu F-Gaz lub SEP któregokolwiek członka zespołu.
2. Zespół z nieważnym certyfikatem jest automatycznie ukrywany z puli dostępnych brygad przy przypisywaniu na Etapie 4 (Oczekuje na przydzielenie ekipy).
3. Integracja profilu z kalendarzem rezerwacyjnym (terminy w kalendarzu klienta zależą od dostępności przypisanego zespołu).

---

## 7. Widok: Zimne Leady (Bucket Re-angażowania)

### Cel biznesowy
Zarządzanie "cmentarzem leadów", które utknęły na Etapie 3 (Wykonany audyt) i nie zaakceptowały wyceny w ciągu > 14 dni. Proces zapobiega gubieniu potencjału sprzedażowego.

### Przepływ i Logika (State Machine)
- Zgodnie z głównym procesem, brak akceptacji po 14 dniach wyzwala automatyczne przeniesienie leada z Etapu 3 do tego bucketa.
- Zwalniane są "lekkie" przypisania kalendarzowe (jeśli były takie wstępnie rezerwowane).

### Model danych (Kolumny tabeli)
- **Klient / Kontakt:** Link do Karty 360.
- **Wartość wyceny:** Kwota PLN.
- **Audytor:** Osoba, która robiła wycenę.
- **Data wejścia do Bucketu:** Kiedy minęło 14 dni.
- **Ostatni kontakt:** Kiedy system wysłał ostatni automatyczny follow-up.

### Akcje
- `Wyślij przypomnienie / Rabaty` (Wysłanie dedykowanego e-maila np. z kodem zniżkowym 5%).
- `Zadzwoń (Telefon wsparcia)` - Logowanie ręcznego kontaktu z zapytaniem o powody braku decyzji.
- `Zwróć do obiegu` - Przesuwa leada z powrotem na Etap 3 z zaktualizowaną datą wyceny.
- `Archiwizuj trwale (Lost)` - Zamyka leada definitywnie (wymaga wybrania powodu: np. "Konkurencja", "Za drogo").
- 🚨 `Usuń leada` (Tylko Administrator - całkowite usunięcie rekordu z bazy).

### Kryteria Akceptacji
1. Tabela domyślnie sortuje od "najświeższych" zimnych leadów (największa szansa na reanimację) do najstarszych.
2. Próba wykonania akcji "Zwróć do obiegu" wymaga potwierdzenia lub odświeżenia ceny, jeśli upłynęło ponad 30 dni od wejścia do bucketa (zapobieganie akceptacji nieaktualnych cen materiałów).
3. Podanie powodu przy trwałej archiwizacji musi zasilać moduł analityczny (powody utraty).
