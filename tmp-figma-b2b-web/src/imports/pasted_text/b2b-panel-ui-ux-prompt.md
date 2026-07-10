Szczegółowy Prompt dla Projektanta UI/UX – Deep Dive w Kluczowe Ekrany (B2B Panel)
Ten dokument jest rozszerzeniem specyfikacji dla głównego projektanta UI w narzędziu Figma. Skupiamy się tutaj na najdrobniejszych szczegółach interfejsu (na poziomie konkretnych komponentów) dla 5 kluczowych widoków aplikacji B2B (Panel Dyspozytora).

Wymaganie Technologiczne: Zaprojektuj poniższe widoki, posługując się komponentami znanymi z biblioteki shadcn/ui (np. Card, Badge, DataTable, Tabs, Dialog/Modal, Avatar). Konsekwentnie stosuj motyw Blue (chłodne odcienie niebieskiego jako akcenty, np. #2563eb).

1. Ekran Logowania (oraz Guard)
Aplikacja jest zamkniętym systemem wewnętrznym. Nie ma tu rejestracji ani klasycznego hasła.

Layout: Centrowany, minimalistyczny (tzw. Card auth layout na pełnym ekranie z rozmytym, subtelnym zdjęciem urządzeń HVAC w tle lub jednolitym białym/szarym tłem).
Elementy UI w głównej karcie (Card):
Logo firmy (KlikKlima) na górze.
Nagłówek (Heading): "Panel Dyspozytora B2B".
Paragraf (Muted text): "Zaloguj się za pomocą konta służbowego Google, aby kontynuować."
Główny przycisk (Button): Duży, wyrazisty przycisk z ikoną Google. Treść: "Zaloguj się przez Google".
Ekran Odmowy (Access Denied State):
Taka sama karta, ale zamiast przycisku logowania wyświetl Alert (odmiana Destructive z shadcn/ui w kolorze czerwonym).
Treść Alertu: "Brak autoryzacji. Twój adres email (
jan.kowalski@gmail.com
) nie posiada uprawnień do tego panelu. Skontaktuj się z Administratorem."
Przycisk powrotu: "Wróć do logowania".
2. Ekran Klienta (Karta Klienta 360)
Widok detaliczny danego klienta, agregujący wszystkie informacje o nim z bazy danych.

Layout (Header):
Avatar z inicjałami klienta (np. "JK").
Duży nagłówek z Imieniem i Nazwiskiem.
Badges pod nazwiskiem informujące o typie klienta (np. "B2C", "B2B").
Przyciski akcji (Top Right): "Edytuj dane", "Dodaj notatkę".
Główny obszar – podzielony na Tabs (Zakładki):
Zakładka 1: "Informacje Ogólne" (Overview)
Karta "Dane kontaktowe" (Card): E-mail, Telefon, Preferowany kanał kontaktu.
Karta "Adresy" (Card): Adres główny, Adres korespondencyjny (z małą ikonką mapy/pinu).
Zakładka 2: "Instalacje i Leady"
Tabela (DataTable): Lista wszystkich powiązanych leadów i instalacji klienta.
Kolumny tabeli: Data utworzenia, Typ sprzętu (model), Status (np. "Wycena zaakceptowana"), Przypisany Audytor. Pamiętaj o klikalności wierszy (Deep Linking do ekranu Instalacji).
Zakładka 3: "Dokumenty i Faktury"
Prosta lista plików (ikona PDF + nazwa) do pobrania.
3. Ekran Instalacji (Szczegóły Instalacji / Leada)
To serce operacyjne systemu. Ten widok przedstawia pojedyncze zlecenie montażu od momentu akceptacji wyceny, aż do zakończenia instalacji.

Header z paskiem postępu (Stepper):
Wizualny wskaźnik pokazujący obecny Etap (od Etapu 4 do 9). Użyj kropek (Dots) z linią łączącą. Aktualny etap wyróżniony kolorem Primary (Blue).
Główny Grid (np. 2 kolumny):
Lewa kolumna (Szczegóły operacyjne):
Card: "Zestawienie Sprzętu" (Co dokładnie jest montowane).
Card: "Przypisani pracownicy" – 2 wyraźne awatary:
Inżynier / Audytor (kto robił wycenę).
Ekipa Monterska (kto montuje). Opcja zmiany ekipy z Dropdown/Select (shadcn/ui).
Card: "Data Instalacji" – wybrana data (lub "Brak" – wstaw wtedy przycisk otwierający Modal z Kalendarzem do przydzielenia terminu).
Prawa kolumna (Aktywności i Komunikacja):
Komponent typu "Timeline" / "Activity Feed". Lista zdarzeń w układzie chronologicznym (od najnowszych).
Przykłady wierszy na osi czasu: "Wysłano SMS z przypomnieniem o płatności", "Płatność za pośrednictwem Stripe zakończona sukcesem", "Zmieniono status na: Sprzęt w drodze".
4. Ekran Serwisu (Zarządzanie Utrzymaniem)
Moduł odpowiedzialny za cykl posprzedażowy i przypomnienia (Epic 4).

Header widoku: "Przeglądy i Serwisy". Krótkie statystyki na górze w komponentach typu "Metric Card" (np. "Serwisy w tym miesiącu: 24", "Przeterminowane: 3").
Główny element – DataTable (Tabela Serwisów):
Kolumny:
Klient (link do Karty Klienta).
Model sprzętu.
Ostatni serwis (Data).
Następny planowany serwis (next_service_date) – Ta kolumna jest kluczowa. Zastosuj pogrubienie.
Status komunikacji (Badge): Np. [Oczekuje na wysyłkę SMS], [Wysłano przypomnienie], [Termin umówiony].
Akcje na końcu wiersza (3 kropki - Dropdown menu): "Przydziel serwisanta", "Wymuś wysłanie SMS teraz", "Odłóż o miesiąc".
Drawer / Slide-over (Panel boczny wysuwany):
Po kliknięciu w "Przydziel serwisanta", zaprojektuj wysuwany panel boczny z szybkim formularzem (Select z listą serwisantów, DatePicker dla wyboru nowej daty).
5. Ekran Ustawień (Role i Dostęp - RBAC)
Widok dostępny tylko dla głównego Administratora.

Nawigacja w ustawieniach (Sidebar po lewej stronie): Zakładki: "Ogólne", "Zarządzanie Dostępem", "Integracje (Stripe)". Wybrana zakładka: "Zarządzanie Dostępem".
Header: "Konta Pracowników". Przycisk w prawym górnym rogu (Primary Button): "+ Zaproś pracownika".
Lista Pracowników (Table/List):
Kolumny: Awatar + Email pracownika, Rola (Badge), Ostatnie logowanie, Akcje.
Badge z rolami powinny mieć różne kolory dla odróżnienia (np. Dyspozytor - Niebieski, Administrator - Fioletowy, Audytor - Szary).
Modal (Dialog) - "Zaproś pracownika":
Wyskakujące okienko.
Pole Input (Email pracownika).
Pole Select (Rola). Opcje: Dyspozytor, Audytor, Administrator, Monter.
Przyciski: "Anuluj" (Outline), "Wyślij zaproszenie" (Primary).