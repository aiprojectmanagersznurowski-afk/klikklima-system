Prompt dla Projektanta UI/UX (Figma) – Aplikacja B2B (Panel Dyspozytora)
Cel projektu: Zaprojektowanie kompletnego, nowoczesnego i użytecznego panelu administracyjnego B2B (Web SPA) dla firmy z branży HVAC (Klimatyzacje). Panel służy do kompleksowego zarządzania procesem end-to-end: od pozyskania leada, przez wycenę, logistykę, aż po montaż i serwisy gwarancyjne/pogwarancyjne.
Kontekst technologiczny (BARDZO WAŻNE DLA DESIGNERA): Projekt będzie implementowany przez programistów używających stosu: React, Next.js, Tailwind CSS oraz biblioteki komponentów shadcn/ui.
* Proszę o bazowanie na popularnych wzorcach z biblioteki shadcn/ui (np. Tabele, Modale, Karty, Badges, Buttony, Dropdowny).
* Pozwoli to na błyskawiczne wdrożenie Twojego designu (pixel-perfect) bez konieczności tworzenia niestandardowych, trudnych w utrzymaniu elementów od zera.
* Motyw przewodni (Theme): Bazowy kolor to Blue (niebieski) połączony z czystym, minimalistycznym stylem (dużo bieli, jasnoszare tła, wyraźne kontrasty). Wsparcie dla Dark Mode jest mile widziane.

🗺️ Mapa Ekranów do Zaprojektowania
1. Ekran Logowania i Odmowy Dostępu (Guard)
* Login: Minimalistyczny ekran z brandingiem firmy i pojedynczym przyciskiem "Zaloguj się przez Google (SSO)". Brak tradycyjnego formularza email/hasło.
* Odmowa (Access Denied): Ekran błędu (np. z ilustracją), który pojawia się, gdy e-mail użytkownika nie widnieje na białej liście (RBAC). Komunikat: "Brak uprawnień. Skontaktuj się z administratorem."
2. Główna Nawigacja (Layout / Shell)
* Sidebar (Lewe menu):
    * Główne zakładki: Kanban (Leady), Logistyka, Klienci, Instalacje, Serwisy, Ustawienia.
    * Informacje o zalogowanym użytkowniku (Awatar, Imię, Rola - np. "Dyspozytor") z dropdownem do wylogowania.
* Top bar (opcjonalnie): Wyszukiwarka globalna (Szukaj klienta/zamówienia), dzwonek powiadomień.
3. Tablica Kanban (Leady i Proces)
Interaktywna tablica (drag-and-drop) odzwierciedlająca cykl życia zgłoszenia.
* Kolumny (9 etapów):
    1. Nowy lead, 2. Przypisanie audytora, 3. Wykonany audyt, 4. Wycena zaakceptowana, 5. Oczekuje na przydzielenie ekipy, 6. Wysyłka sprzętu, 7. Sprzęt dostarczony, 8. Wykonanie instalacji, 9. Instalacja zakończona.
* Karta Leada (na tablicy): Musi zawierać: Imię i Nazwisko klienta, miejscowość, przypisanego audytora/ekipę (awatary) oraz tag/etykietę priorytetu lub statusu płatności.
4. Moduł Logistyki i Wysyłek
Widok tabelaryczny (Supply Chain).
* Tabela: Kolumny: Nazwa klienta, Adres dostawy, Specyfikacja sprzętu (model), Status, Planowana data montażu.
* Kodowanie Kolorami (SLA - bardzo ważne!): Wiersze (lub wyraźne badge w wierszu) muszą być oznaczane kolorem zależnie od pilności:
    * 🔴 Czerwony: < 3 dni do montażu
    * 🟠 Pomarańczowy: 3-7 dni do montażu
    * 🟢 Zielony: > 7 dni do montażu
* Akcje w wierszu (Dropdown/Przyciski): "Oznacz jako wysłane", "Potwierdź odbiór z klientem" (zmienia status na Etap 7). Oraz opcja błędu/rollbacku: "Zmień termin instalacji".
5. Moduł CRM – Klienci i Serwisy (Listy)
* Klienci: Tabela z listą wszystkich klientów. Wyszukiwarka, filtry, paginacja.
* Instalacje: Tabela przedstawiająca status każdej realizacji (Nadchodzące, Zrealizowane, Gwarancja). Filtry po "Ekipie Monterskiej" i "Dacie".
* Serwisy: Tabela posortowana po dacie next_service_date. Wskazuje historyczne instalacje wymagające przeglądu. Posiada wskaźniki statusu powiadomień (np. "Wysłano przypomnienie SMS") oraz przycisk "Przydziel montera".
6. Moduł CRM – Widoki Szczegółowe (Karty)
* Karta Klienta (Widok 360):
    * Profil klienta (dane kontaktowe, adresy).
    * Sekcja "Historia instalacji" i "Dokumenty/Faktury".
* Karta Instalacji:
    * Szczegółowe dane dotyczące pojedynczego zlecenia.
    * Wyraźne przypisanie encji: Przypisana Ekipa Monterska, Przypisany Inżynier/Audytor.
    * Sekcja historii komunikacji (Kiedy wysłano SMS/Email, co wygenerowało przypomnienie o serwisie).
    * Zastosowanie głębokiego linkowania (Deep links) - np. możliwość płynnego kliknięcia w nazwisko klienta, aby przejść do Karty Klienta.
7. Ustawienia – Zarządzanie Użytkownikami (RBAC)
* Prosty widok listy pracowników z możliwością:
    * Zaproszenia nowego pracownika (wpisanie e-maila).
    * Przypisania roli z dropdowna: "Dyspozytor", "Audytor", "Administrator", "Ekipa Monterska".
    * Edycji i usunięcia dostępu.

🎨 Wskazówki Projektowe (UX/UI Best Practices)
1. Wizualna Hierarchia: Panel będzie obsługiwany przez dyspozytorów przez wiele godzin dziennie. Postaw na czytelność, unikaj zmęczenia wzroku (dobry kontrast tekstów, dużo światła/whitespace).
2. Optymistyczny interfejs: Zaprojektuj szkielety ładowania (Skeleton Loaders) dla tabel i Kanbana.
3. Design System: Proszę dostarczyć ujednolicony plik "Design Tokens" (Kolory podstawowe, typografia bazująca na Inter/Roboto, zaokrąglenia rogów, style cieni), aby programiści mogli łatwo skonfigurować plik tailwind.config.js.
4. Zarządzanie szerokością: Tablica Kanban z 9 kolumnami będzie wymagała horyzontalnego scrollowania. Zaprojektuj wygodny pasek przewijania lub ściśnięty widok kolumn z możliwością ich rozwijania/zwijania.
Format dostarczenia: Link do pliku Figma z włączoną opcją "Dev Mode" do inspekcji. Plik powinien zawierać oddzielną stronę na bibliotekę komponentów (UI Kit) i osobną na ułożone ekrany (Flows).
