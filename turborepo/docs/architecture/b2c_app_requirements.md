# B2C App (Aplikacja Kliencka) - Zrealizowane Wymagania i Status

Dokument podsumowuje dotychczasowy zakres funkcjonalności wdrożonych w klienckiej aplikacji webowej B2C (Next.js) w systemie Klik Klima.

## 1. Inteligentny Formularz Triage (Generowanie Leadów)
- **Kreator wieloetapowy (Multi-step form)**: Przeprowadza użytkownika przez 7 kroków, zbierając kluczowe informacje (typ budynku, wielkość pomieszczeń, docieplenie, adres montażu, dane kontaktowe, termin).
- **Animacje i UX**: Płynne przejścia między krokami (Framer Motion), estetyczny pasek postępu.
- **Formularze i Walidacja**: Oparte na `react-hook-form` z bezpieczną walidacją.
- **Exit Intent Modal (Soft Lead)**: Wyskakujące okienko "Zgarnij zniżkę / Zostaw kontakt" przy próbie opuszczenia strony. Okienko inteligentnie pauzuje się, jeśli użytkownik w danej chwili korzysta z konfiguratora (DeviceModal), aby nie przerywać ścieżki.

## 2. Konfigurator Sprzętu (Device Modal)
- **Dynamiczne pomieszczenia**: Użytkownik może dodawać/usuwać pokoje, wybierając ich wielkość (S, M, L, XL).
- **Inteligentne moce (kW)**: Moduł na żywo odpytuje bazę (`getAvailableSizes`) o faktyczne minimalne moce najsłabszej jednostki z danej serii sprzętu pasującej do metrażu.
- **Wizualizacja cech (Features)**: Modal wyświetla kluczowe parametry wewnętrzne w postaci kafelków (ikon) – np. Wi-Fi, Czujnik Ruchu, Jonizator.
- **Odznaki kompatybilności**: Jasne komunikaty graficzne pokazujące, czy dany sprzęt nadaje się do systemu "Single Split", "Multi Split" czy obu (estetyczne pill-badges z ikonami).

## 3. Baza Produktów i Kalkulacje Cenowe
- **Integracja z Supabase**: Wszystkie produkty (jednostki wewnętrzne, agregaty, zestawy, montaż) trzymane w relacyjnej bazie PostgreSQL.
- **Inteligentna "Cena Od..."**: Aplikacja nie pokazuje na sztywno cen, ale wylicza najtańszy wariant zestawu w locie (`getLowestPriceForIndoorUnit`), sumując cenę jednostki wewnętrznej, dedykowanego agregatu oraz usługi montażowej.
- **Frugo Marketing**: Estetyczne, pogodne, angażujące opisy marketingowe generowane dla każdej z jednostek, bez technicznego, niezrozumiałego żargonu (kodów modeli).

---

## Do dodania do Trello (Backlog i Zadania Techniczne)

Poniższe elementy należy skopiować na tablicę Trello jako zadania do uzupełnienia/wykonania w najbliższym czasie:

1. **[Integracja] API Google Maps**
   - Podpięcie prawdziwego klucza API Google Maps do autouzupełniania adresów w kroku Triage "Lokalizacja".
   - Testy geokodowania (zwracanie odpowiednich kodów pocztowych dla regionów).

2. **[Integracja] Kalendarz Google**
   - Implementacja SSR (Server-Side Rendering) odpytującego Google Calendar API o wolne sloty na audyt.
   - Spięcie wybranego terminu przez użytkownika w Triage z logiką backendową.

3. **[Integracja] Webhook Make.com**
   - Wdrożenie wysyłki ładunku (JSON payload) z podsumowaniem Triage (tzw. Post-Booking workflow) do Make.com na koniec kroku 7.
   - Skonfigurowanie w Make.com akcji SMSAPI (potwierdzenie SMS dla klienta).

4. **[Content] Zdjęcia i Warianty w Bazie**
   - Uzupełnienie Supabase Storage o wszystkie brakujące rendery/zdjęcia (Hi-Res) jednostek wewnętrznych i agregatów.
   - Sprawdzenie bazy `available_combinations` pod kątem brakujących kompatybilności nowo wprowadzonych urządzeń Fuji/GENERAL.

5. **[DevOps] Środowisko Produkcyjne Vercel**
   - Zabezpieczenie zmiennych środowiskowych `.env` na produkcji Vercel (klucze Supabase, klucze Map).
   - Opięcie bazy produkcyjnej RLS (Row Level Security).
