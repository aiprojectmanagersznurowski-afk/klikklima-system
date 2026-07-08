# Model Danych (Supabase / PostgreSQL) - Wersja B2B/B2C

Poniższy dokument obrazuje pełny, zaktualizowany relacyjny model danych dla systemu Klik Klima, uwzględniający zarówno obsługę Triage (B2C), jak i panel zarządzania dla dyspozytora i monterów (B2B/CRM).

## Diagram Relacji Encji (ERD)

```mermaid
erDiagram
    USERS {
        uuid id PK "auth.users"
        string email
        string role "Enum: Admin, Dyspozytor, Audytor, Monter"
        timestamp created_at
    }

    AUDITORS {
        uuid user_id PK "FK do USERS"
        string nazwa_firmy
        string nr_telefonu
        float prowizja
    }

    CREWS {
        uuid id PK
        string nazwa_ekipy
        string kolor
    }

    CREW_MEMBERS {
        uuid crew_id FK
        uuid user_id FK "FK do USERS"
    }

    KLIENCI {
        uuid id PK
        string imie_i_nazwisko
        string email
        string telefon
    }

    ADRESY {
        uuid id PK
        uuid klient_id FK
        string ulica_miasto
        float lat 
        float lng 
    }

    INDOOR_UNITS {
        uuid id PK
        string model_code
        string brand
        float cooling_capacity_kw
        float price_netto
    }

    OUTDOOR_UNITS {
        uuid id PK
        string model_code
        string type
        float max_total_indoor_capacity_kw
    }

    SINGLE_SPLIT_SETS {
        uuid id PK
        uuid indoor_unit_id FK
        uuid outdoor_unit_id FK
        float set_price_netto
    }

    MULTI_SPLIT_SETS {
        uuid id PK
        uuid outdoor_unit_id FK
        jsonb indoor_units_json
        float set_price_netto
    }

    CENNIK_USLUG {
        uuid id PK
        string nazwa_uslugi
        float koszt_b2c_netto
        float koszt_b2b_netto
    }

    LEADY {
        uuid id PK
        uuid klient_id FK
        uuid adres_id FK
        jsonb odpowiedzi_triage "JSON z B2C"
        string status_leada "Etapy 1-9"
        uuid auditor_id FK "FK do AUDITORS"
        uuid crew_id FK "FK do CREWS"
    }

    QUOTES {
        uuid id PK
        uuid lead_id FK
        uuid auditor_id FK
        jsonb wycena_items "Pozycje wyceny (Klima, Montaż, Rabaty)"
        float total_price
        string status_akceptacji "Enum: Oczekująca, Zaakceptowana, Odrzucona"
        string status_platnosci "Enum: Nieopłacona, Opłacona"
        string payment_session_id "ID sesji płatności (Stripe/P24)"
        timestamp wazna_do
        timestamp created_at
    }

    INSTALLATIONS {
        uuid id PK
        uuid lead_id FK "Zlecenie nadrzędne"
        jsonb zainstalowany_sprzet "Szczegóły urządzeń, numery seryjne"
        string protokol_odbioru_url
        jsonb zdjecia_z_montazu
        text uwagi_monterskie
        timestamp data_rozpoczecia
        timestamp data_zakonczenia
    }

    SERVICES {
        uuid id PK
        uuid installation_id FK
        uuid crew_id FK "Zewnętrzna/Wewnętrzna ekipa serwisowa"
        string status "Enum: Planowany, Umówiony, Zakończony, Anulowany"
        timestamp scheduled_date "Kiedy przypada serwis"
        timestamp completed_date "Kiedy został wykonany"
        text uwagi_serwisanta
        string protokol_url
    }

    SHIPMENTS {
        uuid id PK
        uuid lead_id FK
        string numer_przesylki
        string status "Enum: Oczekująca, Wysłana, Doręczona"
    }

    NOTIFICATION_QUEUE {
        uuid id PK
        uuid lead_id FK
        string type "SMS, EMAIL"
        string status "PENDING, SENT"
    }

    MESSAGE_TEMPLATES {
        uuid id PK
        string trigger_event "np. STATUS_2_AUDITOR"
        string channel "Enum: SMS, EMAIL"
        string subject "Opcjonalny temat e-mail"
        text body_template "Treść z tagami np. {{imie}}"
    }

    SYSTEM_CONFIG {
        uuid id PK
        string typ_konfiguracji "np. booking_rules"
        jsonb konfiguracja
    }

    USERS ||--o| AUDITORS : "może być"
    USERS ||--o{ CREW_MEMBERS : "należy do"
    CREWS ||--o{ CREW_MEMBERS : "składa się z"
    
    KLIENCI ||--o{ ADRESY : "posiada"
    KLIENCI ||--o{ LEADY : "składa"
    ADRESY ||--o{ LEADY : "lokalizacja dla"
    
    INDOOR_UNITS ||--o{ SINGLE_SPLIT_SETS : "zawiera"
    OUTDOOR_UNITS ||--o{ SINGLE_SPLIT_SETS : "zawiera"
    OUTDOOR_UNITS ||--o{ MULTI_SPLIT_SETS : "zawiera"

    AUDITORS ||--o{ LEADY : "weryfikuje"
    AUDITORS ||--o{ QUOTES : "tworzy"
    LEADY ||--o{ QUOTES : "otrzymuje"
    CREWS ||--o{ LEADY : "realizuje"
    CREWS ||--o{ SERVICES : "wykonuje"
    
    LEADY ||--o| INSTALLATIONS : "posiada szczegóły montażu"
    INSTALLATIONS ||--o{ SERVICES : "posiada historię przeglądów"
    LEADY ||--o{ SHIPMENTS : "generuje"
    LEADY ||--o{ NOTIFICATION_QUEUE : "wyzwala"
```

## Opis Tabel (Katalog Produktów)
- **`indoor_units` & `outdoor_units`**: Baza sprzętowa, definiuje parametry klimatyzatorów.
- **`single_split_sets` & `multi_split_sets`**: Gotowe zestawy sprzedażowe wykorzystywane w kalkulatorze (Triage) oraz przez Audytorów.
- **`cennik_uslug`**: Standardowe koszty materiałów i robocizny (B2C i B2B).

## Opis Nowych Tabel B2B / Field App

1. **`users` (RBAC)**: Centralna tabela kont powiązana z Auth Supabase, zawierająca rolę pracownika (Audytor, Monter, Admin).
2. **`auditors`**: Dedykowana tabela rozszerzająca użytkownika (`1:1` z `users`). Ponieważ aplikacja Field App będzie używana przez zewnętrznych lub wewnętrznych inżynierów robiących wyceny zdalne, tu trzymamy specyficzne dane (nazwa firmy, prowizje).
3. **`quotes` (Wyceny)**: Rozwiązuje problem ewidencjonowania ofert. Audytor z poziomu aplikacji terenowej / B2B generuje tu konkretną wycenę dla `leada`. Tabela posiada statusy akceptacji oraz płatności (`Nieopłacona`, `Opłacona`), jak i klucz integrujący np. bramkę płatności (`payment_session_id`). Na jej podstawie system wie, czy odblokować klientowi wybór terminu w kalendarzu.
4. **`crews` & `crew_members`**: Ekipy monterskie. Jeden monter (`user_id`) może należeć do ekipy. Ekipa jako całość jest przypisywana do realizacji zadania na `leady`.
5. **`installations`**: Ewidencja wykonanych prac. To tutaj ekipa w Field App wrzuca podpisane protokoły po pierwszej instalacji, numery seryjne użytego sprzętu oraz zdjęcia ze ściany.
6. **`services`**: Historia cyklicznych przeglądów. Zamiast trzymać tylko jedną datę w instalacji, generujemy nowy rekord dla każdego serwisu (np. za rok, za dwa lata). Klient powiadamiany jest na podstawie rekordu ze statusem "Planowany". Po realizacji (Field App) status zmienia się na "Zakończony" i generowany jest kolejny rekord na następny rok.
7. **`shipments`**: Zarządzanie kurierami i materiałami, ścisłe powiązanie z leadem.
8. **`message_templates`**: Słownik dynamicznych szablonów wiadomości e-mail oraz SMS. Administrator (B2B) może edytować treści z poziomu interfejsu (bez grzebania w kodzie). Zmienne takie jak `{{imie}}` są dynamicznie podmieniane przez Edge Functions przed wysyłką.
