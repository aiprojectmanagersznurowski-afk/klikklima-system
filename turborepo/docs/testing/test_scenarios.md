# Rejestr Scenariuszy Testowych (Playwright)

Ten dokument stanowi **centralny rejestr** wszystkich scenariuszy testowych E2E w systemie KlikKlima. Workflow `/test` odwołuje się do tego pliku przy generowaniu i uruchamianiu testów regresji. 
Wszystkie scenariusze testowe z różnych procesów (Triage, Post-Booking, Exit-Intent) zostały przeniesione do tego pliku (One Source of Truth).

## Konwencje
- Każdy scenariusz opisany w formacie **BDD**: Given / When / Then, lub jako punkty kontrolne.
- Grupowanie wg modułu/aplikacji.
- Status: ⬜ Do zaimplementowania | ✅ Zaimplementowany | 🔴 Failing

---

## 1. B2C — Triage (Kalkulator)

### ⬜ Scenariusz: Ścieżka A - Standardowy Montaż (Happy Path, Single Split)
- **Given** użytkownik wchodzi na formularz Triage
- **When** wpisuje adres korzystając z podpowiedzi (Google Places Autocomplete)
- **And** wybiera "Mieszkanie" -> "1 pokój" -> "Do 25m²" -> "Wykończone" -> "Masz balkon: Tak"
- **Then** użytkownik dociera do końca formularza na Ścieżkę A (Wycena Online + Booking)
- **And** system proponuje zestawy Single Split z katalogu `single_split_sets`
- **And** wyświetla szacunkowe widełki cenowe

### ⬜ Scenariusz: Ścieżka C - Instalacja Dwuetapowa (Multisplit)
- **Given** użytkownik wchodzi na formularz Triage
- **When** wybiera "Dom" -> "2 lub 3 pokoje" -> oba pokoje "Do 25m²" -> "Deweloperski / Remont"
- **Then** użytkownik dociera do końca formularza na Ścieżkę C (Wycena Dwuetapowa + Booking)
- **And** system proponuje zestawy Multi Split z katalogu `multi_split_sets`
- **And** wyświetla szacunkowe widełki cenowe z uwzględnieniem wielu jednostek

### ⬜ Scenariusz: Ścieżka D - Podwyższone Ryzyko (Wysokościowe)
- **Given** użytkownik wchodzi na formularz Triage
- **When** wybiera "Mieszkanie" -> "1 pokój" -> "26-35m²" -> "Wykończone" -> "Masz balkon: Nie" -> "Piętro: Powyżej 2"
- **Then** użytkownik dociera do końca formularza na Ścieżkę D (Tylko Booking, komunikat o audycie i podnośniku)

### ⬜ Scenariusz: Ścieżka Ekspercka (Za dużo pokoi)
- **Given** użytkownik wchodzi na formularz Triage
- **When** wybiera "Dom" -> "4 i więcej pomieszczeń"
- **Then** system natychmiast wyrzuca użytkownika na Ścieżkę Ekspercką (Tylko Booking bez wyceny)

### ⬜ Scenariusz: Ścieżka Ekspercka (Duży metraż pojedynczego pokoju w Multisplicie)
- **Given** użytkownik wchodzi na formularz Triage
- **When** wybiera "Mieszkanie" -> "2 lub 3 pokoje" -> Pokój 1: "Do 25m²", Pokój 2: "Przynajmniej 1 > 50m²"
- **Then** system wyrzuca użytkownika na Ścieżkę Ekspercką z powodu nietypowego metrażu

### ⬜ Scenariusz: Moduł Rezerwacji (Dostępność i Sloty)
- **Given** użytkownik dociera do ekranu końcowego (dowolna ścieżka) i widzi kalendarz
- **When** system pobiera dostępne terminy ze zintegrowanego kalendarza doradców (np. Google Calendar)
- **Then** użytkownik widzi wyłącznie sloty trwające dokładnie 1h (z uwzględnieniem 45 minut bufora między spotkaniami)
- **And** sloty mieszczą się w zdefiniowanym oknie godzinowym (np. 08:00 - 15:00)

### ⬜ Scenariusz: Zapis leadu po zakończeniu Triage
- **Given** użytkownik przeszedł wszystkie kroki formularza
- **When** podaje dane kontaktowe (imię, email, telefon) i zatwierdza
- **Then** system tworzy rekord w tabeli `klienci`, `adresy` i `leady`
- **And** lead pojawia się w tabeli zgłoszeń B2B pod statusem „Etap 1: Nowy lead"

---

## 2. B2C — Post-Booking (Po rezerwacji)

### ⬜ Scenariusz: Ekran Sukcesu i integracja z kalendarzem klienta
- **Given** użytkownik prawidłowo wypełnił formularz Triage i kliknął "Zarezerwuj"
- **When** system wyświetla widok podziękowania ("Sukces")
- **Then** na ekranie widoczne są dwa przyciski: "Dodaj do Google Calendar" oraz "Dodaj do Apple Calendar"
- **And** kliknięcie w przycisk generuje poprawny plik `.ics` lub link do kalendarza z danymi spotkania

### ⬜ Scenariusz: Parametryzacja asynchronicznych powiadomień
- **Given** aplikacja wysłała Webhook do Make.com o nowym Leadzie
- **When** skrypt Make.com dochodzi do węzła "Sleep/Delay"
- **Then** odczytuje wartości `delay_min_minutes` i `delay_max_minutes` z bazy danych
- **And** wznawia działanie dopiero po losowym czasie z tego przedziału, po czym triggeruje e-mail i SMS API

---

## 3. B2C — Exit-Intent (Odzyskiwanie Leadów)

### ⬜ Scenariusz: Triggerowanie pop-upu Exit-Intent
- **Given** użytkownik jest na kroku podawania danych adresowych w Triage
- **When** symuluje ruch kursora poza obszar okna przeglądarki (zdarzenie `mouseleave` na `document`)
- **Then** na ekranie pojawia się pop-up "Zostaw numer, oddzwonimy"
- **And** pop-up pojawia się tylko raz na sesję (aby nie irytować użytkownika)

### ⬜ Scenariusz: Zapisanie Soft Leada
- **Given** użytkownik widzi pop-up Exit-Intent
- **When** wpisuje numer telefonu i klika "Wyślij"
- **Then** pop-up wyświetla podziękowanie
- **And** w bazie danych Supabase tworzy się nowy rekord w tabeli `leady` ze statusem `Soft Lead` oraz częściowo wypełnionym JSONem `odpowiedzi_triage`.

---

## 4. B2B — Panel Dyspozytora

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

## 5. B2B — System Powiadomień

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

## 6. Field App — Instalacja

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

## 7. Serwisy i Reklamacje

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

---

## Zestawienie Testów Regresyjnych (Checklista)

Poniżej znajduje się szczegółowa lista testów regresyjnych dla poszczególnych komponentów systemu, przygotowana z myślą o późniejszej automatyzacji E2E w Playwright.

### 1. Landing Page (Strona Główna)

#### 1.1. Pasek Nawigacji (Navbar) i Stopka (Footer)
- [ ] Weryfikacja zmiany stylu paska nawigacji (przezroczysty -> solidny) po przeskrolowaniu strony w dół.
- [ ] Sprawdzenie poprawności przekierowań (kotwic) dla linków w nawigacji: "Oferta", "Proces", "Bestsellery" (płynne przewijanie do odpowiedniej sekcji).
- [ ] Weryfikacja działania linków kierujących na podstrony: "O nas" oraz "Baza wiedzy".
- [ ] Sprawdzenie spójności stopki (linki prawne, dane kontaktowe, odnośniki do social mediów).
- [ ] Weryfikacja działania przycisku powrotu do góry lub kliknięcia w logo odświeżającego widok strony głównej.
- [ ] Testowanie poprawności zwijania i działania menu typu "Hamburger" na urządzeniach mobilnych.

#### 1.2. Sekcja Hero i Licznik FOMO
- [ ] Weryfikacja renderowania się głównego nagłówka i widoczności tła (hero image).
- [ ] Sprawdzenie obecności plakietki FOMO (licznika wolnych terminów).
- [ ] Testowanie zachowania licznika FOMO dla małej liczby terminów (odpowiednia odmiana gramatyczna: 1 termin, 2-4 terminy, 5+ terminów).
- [ ] Weryfikacja poprawnego wyświetlania okresu w liczniku FOMO (np. "w tym tygodniu", "w przyszłym tygodniu").
- [ ] Sprawdzenie zachowania głównego przycisku CTA ("Wstępna wycena i termin") – poprawne przekierowanie do lejka `/triage`.
- [ ] Sprawdzenie drugorzędnego przycisku CTA ("Urządzenia") – przewijanie do sekcji Bestsellerów.

#### 1.3. Sekcje "Oferta" i "Proces"
- [ ] Weryfikacja renderowania się kart "Nasze standardy" (ikony, tytuły, odpowiednie odstępy).
- [ ] Weryfikacja widoczności sekcji "Jak działamy" oraz osi czasu prezentującej kroki procesu montażu.
- [ ] Sprawdzenie poprawnego działania responsywności (grid zmieniający się w kolumnę na urządzeniach mobilnych).

#### 1.4. Katalog Urządzeń (Bestsellery)
- [ ] Weryfikacja ładowania i wyświetlania listy produktów z bazy danych.
- [ ] Sprawdzenie formatowania cen (poprawne przeliczenie ceny netto urządzenia + netto montażu na wartość brutto z uwzględnieniem 8% VAT).
- [ ] Sprawdzenie zachowania dla pustej bazy danych (poprawny stan ładowania lub komunikat "Ładowanie urządzeń...").
- [ ] Weryfikacja klikalności karty urządzenia.
- [ ] Sprawdzenie otwierania się Globalnego Modala Urządzenia (Device Modal) po kliknięciu.
- [ ] Przetestowanie działania galerii zdjęć w Modalu (strzałki, przewijanie obrazków, zaślepka przy braku zdjęć).
- [ ] Weryfikacja wyświetlania kluczowych cech (chips) wewnątrz Modala.
- [ ] Sprawdzenie przycisku "Zarezerwuj" w Modalu – poprawne przekierowanie do `/triage`.
- [ ] Poprawne zamykanie Modala przyciskiem "X" lub kliknięciem w tło.

#### 1.5. Exit Intent Modal (Wychwytywanie opuszczających stronę)
- [ ] Weryfikacja wywołania Modala w momencie, gdy kursor myszy opuszcza górną krawędź okna przeglądarki (tylko desktop).
- [ ] Weryfikacja blokady wielokrotnego wyświetlania: Modal ma się nie pojawić ponownie dla tej samej sesji (zapis w localStorage).
- [ ] Sprawdzenie przycisku zamykającego ("Nie, dziękuję") i jego wpływu na ustawienie flagi blokującej.
- [ ] Sprawdzenie głównego przycisku wewnątrz Modala (czy poprawnie kieruje do `/triage`).

### 2. Lejek "Triage" (Kalkulator i rezerwacja)

#### 2.1. Inicjalizacja i Odtwarzanie sesji
- [ ] Weryfikacja czystego startu lejka dla nowego użytkownika.
- [ ] Sprawdzenie odtwarzania postępu, gdy użytkownik odświeży stronę (stan zapisany w systemie lub localStorage).

#### 2.2. Krok 1: Wstępne pytania (Lokalizacja / Typ Budynku)
- [ ] Walidacja zablokowania przycisku "Dalej" bez dokonania wyboru.
- [ ] Poprawne przechodzenie do następnego kroku po wybraniu odpowiedniej opcji kafelkowej.
- [ ] Zmiana zawartości na pasku postępu (Progress Bar).

#### 2.3. Kroki 2-5: Parametry techniczne (Pokoje, Powierzchnia, Stan, Dodatki)
- [ ] Weryfikacja walidacji inputów liczbowych lub złożonych opcji wyboru (m2, liczba jednostek).
- [ ] Weryfikacja przeliczania wartości w oparciu o wybrane kafelki.
- [ ] Sprawdzenie działania przycisku "Wstecz" (odpowiednie cofanie bez utraty wprowadzonych danych).
- [ ] Odpowiednie zachowanie się komponentu Sticky Mobile Bar (np. pływającego dolnego przycisku na małych ekranach).

#### 2.4. Krok 6: Ekran Ładowania (Loader)
- [ ] Weryfikacja wymuszonego czasu oczekiwania dla efektu poszukiwania urządzenia (tzw. "Labor Illusion").
- [ ] Sprawdzenie renderowania animacji i tekstu uspokajającego.
- [ ] Płynne i automatyczne przejście do kroku sukcesu po zakończeniu loadera.

#### 2.5. Krok 7: Sukces (Wyniki i estymacje)
- [ ] Weryfikacja poprawnego obliczenia i renderowania zakresu cenowego instalacji (Opcja Minimum i Premium).
- [ ] Sprawdzenie wyświetlania rekomendowanych urządzeń (w oparciu o zebrane parametry z kroków 2-5).
- [ ] Testowanie przycisku "Wybieram to urządzenie" (przejście do konfiguratora rezerwacji z zapamiętanym modelem).
- [ ] Wyświetlanie alternatywnej prośby o kontakt telefoniczny w przypadku bardzo skomplikowanych opcji (tzw. Soft-Fail).

#### 2.6. Krok 8: Rezerwacja Terminu (Kalendarz i Booking)
- [ ] Weryfikacja ładowania dostępnych terminów audytu poprzez integrację z Google Calendar / zewnętrznym API.
- [ ] Walidacja braku możliwości wyboru dat wstecznych i terminów już zarezerwowanych.
- [ ] Obsługa błędów połączenia podczas ładowania kalendarza (fallback lub komunikat o błędzie).
- [ ] Weryfikacja formularza danych kontaktowych (walidacja maski na telefon, poprawnego e-maila, niezbędnych zgód).
- [ ] Próba wysłania rezerwacji bez wypełnionych obowiązkowych zgód (wymagany błąd).

#### 2.7. Integracje Po-Rezerwacyjne (Webhook / Supabase)
- [ ] Weryfikacja przesłania leadu do bazy danych (Supabase table: `leady`) i stworzenia rekordu z poprawnym stanem rezerwacji.
- [ ] Weryfikacja wyzwolenia eventu do Make.com / zaplanowanego w kalendarzu.
- [ ] Wyświetlenie widoku końcowego (Thank You Page) z podsumowaniem umówionego spotkania i informacją o dalszych krokach.

#### 2.8. Przypadki Brzegowe (Edge Cases) Lejka
- [ ] Działanie na urządzeniach mobilnych (rozmiary przycisków, pływający przycisk "Dalej").
- [ ] Próba wpisania niestandardowych (złośliwych lub za dużych) wartości w inputach metrażu.
- [ ] Opuszczenie procesu na kroku płatności/rezerwacji kalendarza (tzw. Abandoned Cart) – czy stan jest w pełni zapamiętywany?
- [ ] Ręczna nawigacja przez pasek URL do poszczególnych kroków z pominięciem poprzednich (oczekiwane zachowanie to powrót do Kroku 1 lub kontynuacja dozwolonego postępu).
