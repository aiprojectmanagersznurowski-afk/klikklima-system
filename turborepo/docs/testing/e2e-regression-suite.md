# B2C Web - E2E Regression Test Suite

Poniżej znajduje się szczegółowa lista testów regresyjnych dla Landing Page oraz ścieżki Triage. Zestawienie to zostało przygotowane z myślą o późniejszej automatyzacji (np. za pomocą Playwright) i stanowi pełną listę scenariuszy, które powinny być zawsze sprawdzane przed wdrożeniem na środowisko produkcyjne (PROD).

## 1. Landing Page (Strona Główna)

### 1.1. Pasek Nawigacji (Navbar) i Stopka (Footer)
- Weryfikacja zmiany stylu paska nawigacji (przezroczysty -> solidny) po przeskrolowaniu strony w dół.
- Sprawdzenie poprawności przekierowań (kotwic) dla linków w nawigacji: "Oferta", "Proces", "Bestsellery" (płynne przewijanie do odpowiedniej sekcji).
- Weryfikacja działania linków kierujących na podstrony: "O nas" oraz "Baza wiedzy".
- Sprawdzenie spójności stopki (linki prawne, dane kontaktowe, odnośniki do social mediów).
- Weryfikacja działania przycisku powrotu do góry lub kliknięcia w logo odświeżającego widok strony głównej.
- Testowanie poprawności zwijania i działania menu typu "Hamburger" na urządzeniach mobilnych.

### 1.2. Sekcja Hero i Licznik FOMO
- Weryfikacja renderowania się głównego nagłówka i widoczności tła (hero image).
- Sprawdzenie obecności plakietki FOMO (licznika wolnych terminów).
- Testowanie zachowania licznika FOMO dla małej liczby terminów (odpowiednia odmiana gramatyczna: 1 termin, 2-4 terminy, 5+ terminów).
- Weryfikacja poprawnego wyświetlania okresu w liczniku FOMO (np. "w tym tygodniu", "w przyszłym tygodniu").
- Sprawdzenie zachowania głównego przycisku CTA ("Wstępna wycena i termin") – poprawne przekierowanie do lejka `/triage`.
- Sprawdzenie drugorzędnego przycisku CTA ("Urządzenia") – przewijanie do sekcji Bestsellerów.

### 1.3. Sekcje "Oferta" i "Proces"
- Weryfikacja renderowania się kart "Nasze standardy" (ikony, tytuły, odpowiednie odstępy).
- Weryfikacja widoczności sekcji "Jak działamy" oraz osi czasu prezentującej kroki procesu montażu.
- Sprawdzenie poprawnego działania responsywności (grid zmieniający się w kolumnę na urządzeniach mobilnych).

### 1.4. Katalog Urządzeń (Bestsellery)
- Weryfikacja ładowania i wyświetlania listy produktów z bazy danych.
- Sprawdzenie formatowania cen (poprawne przeliczenie ceny netto urządzenia + netto montażu na wartość brutto z uwzględnieniem 8% VAT).
- Sprawdzenie zachowania dla pustej bazy danych (poprawny stan ładowania lub komunikat "Ładowanie urządzeń...").
- Weryfikacja klikalności karty urządzenia.
- Sprawdzenie otwierania się Globalnego Modala Urządzenia (Device Modal) po kliknięciu.
- Przetestowanie działania galerii zdjęć w Modalu (strzałki, przewijanie obrazków, zaślepka przy braku zdjęć).
- Weryfikacja wyświetlania kluczowych cech (chips) wewnątrz Modala.
- Sprawdzenie przycisku "Zarezerwuj" w Modalu – poprawne przekierowanie do `/triage`.
- Poprawne zamykanie Modala przyciskiem "X" lub kliknięciem w tło.

### 1.5. Exit Intent Modal (Wychwytywanie opuszczających stronę)
- Weryfikacja wywołania Modala w momencie, gdy kursor myszy opuszcza górną krawędź okna przeglądarki (tylko desktop).
- Weryfikacja blokady wielokrotnego wyświetlania: Modal ma się nie pojawić ponownie dla tej samej sesji (zapis w localStorage).
- Sprawdzenie przycisku zamykającego ("Nie, dziękuję") i jego wpływu na ustawienie flagi blokującej.
- Sprawdzenie głównego przycisku wewnątrz Modala (czy poprawnie kieruje do `/triage`).

---

## 2. Lejek "Triage" (Kalkulator i rezerwacja)

### 2.1. Inicjalizacja i Odtwarzanie sesji
- Weryfikacja czystego startu lejka dla nowego użytkownika.
- Sprawdzenie odtwarzania postępu, gdy użytkownik odświeży stronę (stan zapisany w systemie lub localStorage).

### 2.2. Krok 1: Wstępne pytania (Lokalizacja / Typ Budynku)
- Walidacja zablokowania przycisku "Dalej" bez dokonania wyboru.
- Poprawne przechodzenie do następnego kroku po wybraniu odpowiedniej opcji kafelkowej.
- Zmiana zawartości na pasku postępu (Progress Bar).

### 2.3. Kroki 2-5: Parametry techniczne (Pokoje, Powierzchnia, Stan, Dodatki)
- Weryfikacja walidacji inputów liczbowych lub złożonych opcji wyboru (m2, liczba jednostek).
- Weryfikacja przeliczania wartości w oparciu o wybrane kafelki.
- Sprawdzenie działania przycisku "Wstecz" (odpowiednie cofanie bez utraty wprowadzonych danych).
- Odpowiednie zachowanie się komponentu Sticky Mobile Bar (np. pływającego dolnego przycisku na małych ekranach).

### 2.4. Krok 6: Ekran Ładowania (Loader)
- Weryfikacja wymuszonego czasu oczekiwania dla efektu poszukiwania urządzenia (tzw. "Labor Illusion").
- Sprawdzenie renderowania animacji i tekstu uspokajającego.
- Płynne i automatyczne przejście do kroku sukcesu po zakończeniu loadera.

### 2.5. Krok 7: Sukces (Wyniki i estymacje)
- Weryfikacja poprawnego obliczenia i renderowania zakresu cenowego instalacji (Opcja Minimum i Premium).
- Sprawdzenie wyświetlania rekomendowanych urządzeń (w oparciu o zebrane parametry z kroków 2-5).
- Testowanie przycisku "Wybieram to urządzenie" (przejście do konfiguratora rezerwacji z zapamiętanym modelem).
- Wyświetlanie alternatywnej prośby o kontakt telefoniczny w przypadku bardzo skomplikowanych opcji (tzw. Soft-Fail).

### 2.6. Krok 8: Rezerwacja Terminu (Kalendarz i Booking)
- Weryfikacja ładowania dostępnych terminów audytu poprzez integrację z Google Calendar / zewnętrznym API.
- Walidacja braku możliwości wyboru dat wstecznych i terminów już zarezerwowanych.
- Obsługa błędów połączenia podczas ładowania kalendarza (fallback lub komunikat o błędzie).
- Weryfikacja formularza danych kontaktowych (walidacja maski na telefon, poprawnego e-maila, niezbędnych zgód).
- Próba wysłania rezerwacji bez wypełnionych obowiązkowych zgód (wymagany błąd).

### 2.7. Integracje Po-Rezerwacyjne (Webhook / Supabase)
- Weryfikacja przesłania leadu do bazy danych (Supabase table: `leady`) i stworzenia rekordu z poprawnym stanem rezerwacji.
- Weryfikacja wyzwolenia eventu do Make.com / zaplanowanego w kalendarzu.
- Wyświetlenie widoku końcowego (Thank You Page) z podsumowaniem umówionego spotkania i informacją o dalszych krokach.

### 2.8. Przypadki Brzegowe (Edge Cases) Lejka
- Działanie na urządzeniach mobilnych (rozmiary przycisków, pływający przycisk "Dalej").
- Próba wpisania niestandardowych (złośliwych lub za dużych) wartości w inputach metrażu.
- Opuszczenie procesu na kroku płatności/rezerwacji kalendarza (tzw. Abandoned Cart) – czy stan jest w pełni zapamiętywany?
- Ręczna nawigacja przez pasek URL do poszczególnych kroków z pominięciem poprzednich (oczekiwane zachowanie to powrót do Kroku 1 lub kontynuacja dozwolonego postępu).
