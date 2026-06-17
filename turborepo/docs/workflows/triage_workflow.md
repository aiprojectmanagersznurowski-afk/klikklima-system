# Workflow Formularza Triage (Kalkulator B2C)

Ten diagram definiuje dokładną logikę działania inteligentnego formularza wyceny dla klientów B2C. Odseparowaliśmy drzewa decyzyjne dla instalacji Single Split i Multisplit, aby wyraźnie widzieć ostateczne ścieżki i powiązane z nimi warianty urządzeń na końcu.

```mermaid
flowchart TD
    Start["Start: Formularz Triage"] --> Q1{"Rodzaj budynku?"}
    
    Q1 -- "Lokal komercyjny" --> Path_Expert["Ścieżka Ekspercka (Tylko Konsultacja)"]
    Q1 -- "Dom / Mieszkanie" --> Q2{"Ile pomieszczeń?"}
    
    Q2 -- "4 i więcej" --> Path_Expert
    Q2 -- "1 (Single Split)" --> Q3_Single{"Metraż pomieszczenia?"}
    Q2 -- "2 lub 3 (Multisplit)" --> Q3_Multi{"Metraż dla KAŻDEGO pokoju?"}
    
    %% ================= Opcje Metrażu =================
    Q3_Single -- "Do 25m²" --> Q4_Single{"Stan lokalu?"}
    Q3_Single -- "26-35m²" --> Q4_Single
    Q3_Single -- "36-50m²" --> Q4_Single
    Q3_Single -- "Powyżej 50m²" --> Path_Expert
    
    Q3_Multi -- "Do 25m²" --> Q4_Multi{"Stan lokalu?"}
    Q3_Multi -- "26-35m²" --> Q4_Multi
    Q3_Multi -- "36-50m²" --> Q4_Multi
    Q3_Multi -- "Przynajmniej 1 > 50m²" --> Path_Expert

    %% ================= DRZEWO: SINGLE SPLIT =================
    Q4_Single -- "Dom: Deweloperski / Remont" --> Path_C_Single["Ścieżka C: Dwuetapowa (Single Split)"]
    Q4_Single -- "Dom: Wykończony" --> Path_A_Single["Ścieżka A: Standard (Single Split)"]
    Q4_Single -- "Mieszkanie: Deweloperski" --> Q5a_S{"Balkon?"}
    Q4_Single -- "Mieszkanie: Wykończone" --> Q5b_S{"Balkon?"}

    Q5a_S -- "Tak" --> Path_C_Single
    Q5a_S -- "Nie" --> Q6a_S{"Piętro?"}
    Q6a_S -- "Parter, 1, 2" --> Path_C_Single
    Q6a_S -- "Powyżej 2" --> Path_D["Ścieżka D: Podwyższone Ryzyko"]

    Q5b_S -- "Tak" --> Path_A_Single
    Q5b_S -- "Nie" --> Q6b_S{"Piętro?"}
    Q6b_S -- "Parter, 1, 2" --> Path_A_Single
    Q6b_S -- "Powyżej 2" --> Path_D

    %% ================= DRZEWO: MULTISPLIT =================
    Q4_Multi -- "Dom: Deweloperski / Remont" --> Path_C_Multi["Ścieżka C: Dwuetapowa (Multisplit)"]
    Q4_Multi -- "Dom: Wykończony" --> Path_A_Multi["Ścieżka A: Standard (Multisplit)"]
    Q4_Multi -- "Mieszkanie: Deweloperski" --> Q5a_M{"Balkon?"}
    Q4_Multi -- "Mieszkanie: Wykończone" --> Q5b_M{"Balkon?"}

    Q5a_M -- "Tak" --> Path_C_Multi
    Q5a_M -- "Nie" --> Q6a_M{"Piętro?"}
    Q6a_M -- "Parter, 1, 2" --> Path_C_Multi
    Q6a_M -- "Powyżej 2" --> Path_D

    Q5b_M -- "Tak" --> Path_A_Multi
    Q5b_M -- "Nie" --> Q6b_M{"Piętro?"}
    Q6b_M -- "Parter, 1, 2" --> Path_A_Multi
    Q6b_M -- "Powyżej 2" --> Path_D

    %% ================= WYNIKI I CTA =================
    Path_A_Single -.-> CTA_Wycena
    Path_C_Single -.-> CTA_Wycena
    Path_A_Multi -.-> CTA_Wycena
    Path_C_Multi -.-> CTA_Wycena
    
    Path_Expert -.-> CTA_Booking
    Path_D -.-> CTA_Booking

    style CTA_Wycena fill:#10b981,stroke:#047857,color:white
    style CTA_Booking fill:#f59e0b,stroke:#b45309,color:white

    CTA_Wycena["✅ WYCENA ONLINE<br>1. Katalog dobrany do mocy kW (Single lub Multi)<br>2. Orientacyjna cena instalacji<br>3. Booking miejsca w kalendarzu"]
    CTA_Booking["⚠️ TYLKO BOOKING<br>1. Informacja o konieczności audytu / podnośnika<br>2. Rezerwacja wizyty bez wyceny"]
```

## Implikacje dla Bazy Danych
Struktura JSON dla `odpowiedzi_triage` w tabeli `leady` powinna obsłużyć dynamiczną listę pomieszczeń i jasną ścieżkę końcową.

Przykładowy rekord Leada z wyceną:
```json
{
  "rodzaj_budynku": "Mieszkanie",
  "stan_lokalu": "Wykończone",
  "sciezka_koncowa": "Path_A_Multi",
  "pokoje": [
    { "id": 1, "metraz": "Do 25m2" },
    { "id": 2, "metraz": "26-35m2" }
  ],
  "balkon": false,
  "pietro": "1",
  "estymowana_wycena": "4500 PLN",
  "dane_kontaktowe": {
    "imie_i_nazwisko": "Jan Kowalski",
    "email": "jan.kowalski@example.com",
    "telefon": "+48 123 456 789"
  },
  "adres": "Złota 44, Warszawa",
  "wspolrzedne": {
    "lat": 52.231123,
    "lng": 21.006234
  }
}
```
*Uwaga: Adres w formularzu Triage jest walidowany i geokodowany "w locie" przy użyciu Google Maps Places API (Autocomplete). Po wyborze adresu z listy, natychmiast zapisujemy zwalidowany tekst oraz jego współrzędne (lat/lng).*

## Scenariusze Testowe (Playwright)

Poniższe scenariusze BDD mogą zostać bezpośrednio wykorzystane przy budowie testów E2E dla kalkulatora.

**Scenariusz 1: Ścieżka A - Standardowy Montaż (Happy Path, Single Split)**
- **Given** użytkownik wchodzi na formularz Triage
- **When** wpisuje adres korzystając z podpowiedzi (Google Places Autocomplete)
- **And** wybiera "Mieszkanie" -> "1 pokój" -> "Do 25m²" -> "Wykończone" -> "Masz balkon: Tak"
- **Then** użytkownik dociera do końca formularza na Ścieżkę A (Wycena Online + Booking)

**Scenariusz 2: Ścieżka C - Instalacja Dwuetapowa (Multisplit)**
- **Given** użytkownik wchodzi na formularz Triage
- **When** wybiera "Dom" -> "2 lub 3 pokoje" -> oba pokoje "Do 25m²" -> "Deweloperski / Remont"
- **Then** użytkownik dociera do końca formularza na Ścieżkę C (Wycena Dwuetapowa + Booking)

**Scenariusz 3: Ścieżka D - Podwyższone Ryzyko (Wysokościowe)**
- **Given** użytkownik wchodzi na formularz Triage
- **When** wybiera "Mieszkanie" -> "1 pokój" -> "26-35m²" -> "Wykończone" -> "Masz balkon: Nie" -> "Piętro: Powyżej 2"
- **Then** użytkownik dociera do końca formularza na Ścieżkę D (Tylko Booking, komunikat o audycie i podnośniku)

**Scenariusz 4: Ścieżka Ekspercka (Za dużo pokoi)**
- **Given** użytkownik wchodzi na formularz Triage
- **When** wybiera "Dom" -> "4 i więcej pomieszczeń"
- **Then** system natychmiast wyrzuca użytkownika na Ścieżkę Ekspercką (Tylko Booking bez wyceny)

**Scenariusz 5: Ścieżka Ekspercka (Duży metraż pojedynczego pokoju w Multisplicie)**
- **Given** użytkownik wchodzi na formularz Triage
- **When** wybiera "Mieszkanie" -> "2 lub 3 pokoje" -> Pokój 1: "Do 25m²", Pokój 2: "Przynajmniej 1 > 50m²"
- **Then** system wyrzuca użytkownika na Ścieżkę Ekspercką z powodu nietypowego metrażu

**Scenariusz 6: Moduł Rezerwacji (Dostępność i Sloty)**
- **Given** użytkownik dociera do ekranu końcowego (dowolna ścieżka) i widzi kalendarz
- **When** system pobiera dostępne terminy ze zintegrowanego kalendarza doradców (np. Google Calendar)
- **Then** użytkownik widzi wyłącznie sloty trwające dokładnie 1h (z uwzględnieniem 45 minut bufora między spotkaniami)
- **And** sloty mieszczą się w zdefiniowanym oknie godzinowym (np. 08:00 - 15:00)

## Moduł Kalkulatora Wyceny (Netto / Brutto)

Kluczowym elementem formularza jest kalkulator, który po przejściu ścieżki B2C i wybraniu "Mieszkanie" lub "Dom", musi zaprezentować klientowi ostateczną wycenę Brutto.

1. **Baza Danych (Wartości Netto)**: Wszystkie ceny katalogowe urządzeń (`cena_katalogowa_netto`) oraz koszty usług montażu (`koszt_b2c_netto`) przechowywane są w bazie danych jako wartości **NETTO**. 
2. **Stawka VAT w Triage B2C**: Ponieważ formularz B2C obsługuje klientów indywidualnych w domach i mieszkaniach (ścieżka "Lokal Komercyjny" jest odrzucana do ręcznej wyceny eksperckiej), do obliczeń zautomatyzowanych aplikowany jest zawsze **podatek VAT 8%**.
   - (Uwaga: Usługa montażu połączona z dostawą sprzętu dla celów mieszkaniowych w Polsce podlega preferencyjnej stawce VAT 8%).
3. **Wzorcowy Montaż**: Do bazowej ceny instalacji doliczane są standardowe wartości z cennika (np. montaż jednostki, 3 mb instalacji chłodniczej, 3 mb odpływu itp.). Suma tych usług netto tworzy `łączny_koszt_montażu_netto`.
4. **Prezentacja UI**: Klient na końcu formularza widzi wartość **Brutto** obliczoną jako `(Cena_Urządzeń_Netto + Koszt_Montażu_Netto) * 1.08`.

## Moduł Rezerwacji Terminu (Booking Module)

Na samym końcu procesu, niezależnie od wybranej ścieżki (Wycena vs Tylko Konsultacja), użytkownik przechodzi do kalendarza rezerwacji. Główne wymagania i reguły biznesowe dla tego modułu to:

1. **Integracja z Kalendarzem (Custom Next.js API)**: System musi czytać bieżącą dostępność inżyniera ze współdzielonego kalendarza (Google Calendar API). Autoryzacja przez Service Account. Zapytania o `freebusy` będą realizowane po stronie serwera (SSR) w celu zapewnienia maksymalnej szybkości i płynności UI bez ładowania zewnętrznych widgetów (iframe).
2. **Parametryzacja**: Główne wartości są pobierane z bazy danych (np. tabela `booking_config`), by administrator mógł je łatwo zmienić:
   - `duration_minutes`: Czas trwania jednego spotkania (Domyślnie: **60 minut** / 1h).
   - `buffer_minutes`: Minimalny odstęp czasowy między jednym a drugim spotkaniem na dojazd/odpoczynek (Domyślnie: **45 minut**).
   - `hours_start`: Godzina otwarcia okna rezerwacyjnego (Domyślnie: **08:00**).
   - `hours_end`: Godzina zamknięcia okna rezerwacyjnego (Domyślnie: **15:00**).
3. **Dane Klienta**: Tuż obok wyboru slotu czasowego, system musi wymusić od klienta podanie kluczowych danych kontaktowych niezbędnych do obsługi Leada: **Imię i Nazwisko, E-mail, Numer Telefonu** oraz **Zwalidowany Adres (geokodowany)**.

System przy generowaniu wolnych slotów w UI dla klienta, najpierw filtruje dostępne ramy czasowe z konfiguracji bazy danych, potem sprawdza Google Calendar API dla danego dnia odrzucając blokady, a następnie na wolny czas nakłada sloty uwzględniające czas trwania (`duration_minutes`) oraz przerwę na dojazd (`buffer_minutes`).
Wszystko dzieje się natychmiastowo na zapleczu aplikacji Next.js, aby zapewnić płynne przejście.


## Wizualizacja Diagramu
![Diagram Triage B2C](./triage_workflow.png)
