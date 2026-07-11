Kompleksowy Prompt dla Projektanta UX/UI (Figma) - Panel Administracyjny B2B KlikKlima
Wstęp i Kontekst Biznesowy: KlikKlima tworzy autorski system klasy CRM/ERP (B2B) do zarządzania procesem sprzedaży i instalacji klimatyzacji. Mimo, że jest to narzędzie wewnętrzne (B2B), stawiamy na nowoczesną stylistykę B2C – aplikacja ma być wizualnie lekka, intuicyjna, przestrzenna (dużo "white space"), o jasnej kolorystyce i z naciskiem na typografię oraz czytelność danych. Użytkownikami są managerowie sprzedaży, koordynatorzy instalacji oraz audytorzy.

Oczekujemy dostarczenia kompletnego Design Systemu oraz widoków kluczowych podstron.

1. Globalna Architektura i Layout (Szkielet Aplikacji)
A. Nawigacja Główna (Top Bar / Sidebar)
Układ: Rekomendujemy wąski, elegancki pasek boczny (Sidebar) z możliwością zwinięcia do samych ikon, co maksymalizuje przestrzeń roboczą dla tabel z danymi.
Elementy stałe:
Logo KlikKlima.
Linki nawigacyjne (ikona + etykieta): Pulpit, Leady, Klienci, Audytorzy, Ekipy Montażowe, Centrum Powiadomień.
Sekcja użytkownika na dole (Awatar, Imię i Nazwisko, Wyloguj).
Górny Pasek (Top Bar):
Globalna wyszukiwarka (szukająca po klientach, numerach telefonów, ID leadów).
Ikona "dzwonka" powiadomień.
B. Mechanika Pracy Użytkownika
Wielozadaniowość: System musi wspierać pracę na wielu kartach przeglądarki jednocześnie. Główne listy (tabele) służą jako "bazy wypadowe", natomiast szczegóły obiektów otwierają się w osobnych oknach/kartach (aby nie tracić filtrów i kontekstu tabeli).
Szybkie Akcje: Drobne operacje (np. szybkie przypisanie audytora do leada z poziomu tabeli) powinny otwierać się w minimalistycznych modalach (pop-upach) lub panelach wysuwanych z boku (Slide-over/Drawer).
2. Architektura Podstron (Drzewo Widoków)
Podstrona 1: Dashboard (Pulpit Główny)
Cel: Zrozumienie stanu firmy na pierwszy rzut oka.
Kluczowe elementy:
Karty statystyk (Widgets): "Nowe zapytania dzisiaj", "Leady bez przypisanego audytora (Zaległe!)", "Suma wycen oczekujących na akceptację", "Zaplanowane instalacje w tym tygodniu".
Wykres konwersji lub lejek wizualny pokazujący przepływ klientów.
Krótka lista "Wymaga Twojej akcji" (np. leady tkwiące w jednym statusie powyżej 48h).
Podstrona 2: Lista Leadów (Główne narzędzie pracy)
Mechanika i Układ:
Brak bocznych zakładek etapów: Filtrowanie etapów lejka odbywa się za pomocą wyraźnego komponentu Dropdown/Select zlokalizowanego w górnym pasku narzędzi (nad tabelą). Przykładowe opcje: "1. Nowy lead", "2. Oczekuje na audyt", "3. Wycena", "4. Do instalacji", "5. Zakończone".
Tabela Full-Width: Tabela z leadami zajmuje 100% dostępnej szerokości ekranu roboczego.
Kolumny tabeli: ID, Data wpłynięcia, Klient (Imię, Nazwisko, Telefon), Miasto, Audytor (awatar + nazwisko), Kwota Estymowana, Szybkie Akcje.
Szybkie Akcje w tabeli: Zamiast skomplikowanych menu, widoczne ikony (np. przypisz audytora).
Akcja Główna "Zarządzaj": Przycisk lub link na numerze ID, który musi mieć wyraźny znak graficzny "otwórz w nowej karcie" (external link icon).
Paginacja: Klasyczna nawigacja po stronach ("1, 2, 3... Następna") umieszczona centralnie na samym dole pod tabelą (Sticky Bottom).
Podstrona 3: Szczegóły Leada (Karta Leada)
Mechanika: Otwiera się w nowej karcie przeglądarki. Służy do pogłębionej pracy z danym klientem.
Układ: Podział na 2-3 kolumny lub wyraźne sekcje ("Kafelki" / Cards):
Header: Duże ID, Status lejka (jako graficzny "stepper" lub kolorowa odznaka z przyciskiem do zmiany statusu), Imię i Nazwisko klienta.
Sekcja Informacyjna: Wyniki z formularza (Triage), estymowana wycena, wybrany sprzęt.
Sekcja Zarządzania (Akcje): Wybór audytora (select ze zdjęciami), harmonogram (wybór ekipy montażowej i daty), finalna kwota PLN.
Sekcja Historii/Notatek: Oś czasu (Timeline) pokazująca zmianę statusów oraz pole do wpisywania notatek wewnętrznych.
Podstrona 4: Baza Klientów (CRM)
Cel: Płaska lista wszystkich kontaktów firmy niezależnie od tego, czy kupili, czy zrezygnowali.
Układ: Prosta tabela: Klient, Dane kontaktowe (Mail/Telefon), Liczba powiązanych leadów, Całkowita wartość (LTV). Opcja edycji danych klienta.
Podstrona 5: Audytorzy i Ekipy Montażowe (Zasoby ludzkie)
Cel: Zarządzanie pracownikami terenowymi.
Układ: Widok w formie siatki kart (Grid of Cards) lub tabeli z awatarami.
Informacje na karcie: Imię i Nazwisko, Rola (Audytor / Monter), Aktywnych przypisań, Ostatnie logowanie, przycisk edycji harmonogramu/przypisań.
Podstrona 6: Centrum Powiadomień (Automatyzacje SMS/Email)
Cel: Podgląd logów z wysłanych wiadomości do klientów.
Układ: Lista logów: Data wysyłki, Kanał (SMS / Email), Odbiorca, Treść wiadomości, Status (Wysłano, Błąd, Oczekuje).
Aspekt UX: Wymagany bardzo przejrzysty sposób oznaczania ewentualnych błędów wysyłki, aby administrator mógł szybko zainterweniować.
3. Wytyczne Estetyczne i Wskazówki Projektowe (UI)
Paleta kolorów:
Tło główne: Jasne, złamane biele (np. #F9FAFB lub #F3F4F6).
Kolor główny (Primary): Nowoczesny odcień niebieskiego / błękitu pasujący do branży HVAC.
Statusy (Semantyka): Stwórz paletę pastelowych "Badge'y" (Odznak) dla statusów - np. miękki zielony dla sukcesu, pomarańczowy dla ostrzeżeń / oczekiwania, szary dla archiwum, czerwony dla alarmów.
Typografia: Krój bezszeryfowy, nowoczesny (np. Inter, Roboto, Plus Jakarta Sans). Zadbaj o doskonałą hierarchię – nagłówki H1/H2 mają stanowić mocny punkt orientacyjny.
Interakcje (Stany hover/focus): Użytkownik przeglądający tabelę powinien widzieć delikatne podświetlenie wiersza (row hover). Przełączniki i przyciski muszą wyraźnie komunikować swój stan klikalności.
Spójność (Design System): Wymagane jest ujednolicenie paddingów, promieni zaokrągleń (border-radius - preferowane lekko zaokrąglone rogi 8px lub 12px nadające lekkości), oraz użycie wspólnych komponentów we wszystkich podstronach.
Podsumowanie zadań dla projektanta:

Stworzyć Design System (kolory, typografia, komponenty bazowe - buttons, inputs, dropdowns, table cells).
Przygotować makietę "Szkieletu" z nawigacją i górnym paskiem.
Wygenerować finalne makiety (High-Fidelity) dla podstron: Pulpit, Leady (Z dropdownem i tabelą full-width), Karta Leada (nowa zakładka) oraz Centrum Powiadomień.