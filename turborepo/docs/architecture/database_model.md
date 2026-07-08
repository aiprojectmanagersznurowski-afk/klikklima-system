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

    LEADY {
        uuid id PK
        uuid klient_id FK
        uuid adres_id FK
        jsonb odpowiedzi_triage "JSON z B2C"
        string status_leada "Etapy 1-9"
        uuid auditor_id FK "FK do AUDITORS"
        uuid crew_id FK "FK do CREWS"
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

    USERS ||--o| AUDITORS : "może być"
    USERS ||--o{ CREW_MEMBERS : "należy do"
    CREWS ||--o{ CREW_MEMBERS : "składa się z"
    
    KLIENCI ||--o{ ADRESY : "posiada"
    KLIENCI ||--o{ LEADY : "składa"
    ADRESY ||--o{ LEADY : "lokalizacja dla"
    
    AUDITORS ||--o{ LEADY : "wycenia"
    CREWS ||--o{ LEADY : "realizuje"
    
    LEADY ||--o| INSTALLATIONS : "posiada szczegóły montażu"
    LEADY ||--o{ SHIPMENTS : "generuje"
    LEADY ||--o{ NOTIFICATION_QUEUE : "wyzwala"
```

## Opis Nowych Tabel B2B / Field App

1. **`users` (RBAC)**: Centralna tabela kont powiązana z Auth Supabase, zawierająca rolę pracownika (Audytor, Monter, Admin).
2. **`auditors`**: Dedykowana tabela rozszerzająca użytkownika (`1:1` z `users`). Ponieważ aplikacja Field App będzie używana przez zewnętrznych lub wewnętrznych inżynierów robiących wyceny zdalne, tu trzymamy specyficzne dane (nazwa firmy, prowizje).
3. **`crews` & `crew_members`**: Ekipy monterskie. Jeden monter (`user_id`) może należeć do ekipy. Ekipa jako całość jest przypisywana do realizacji zadania na `leady`.
4. **`installations`**: Ewidencja i repozytorium wykonanych prac. Oddzielone od "leada" (który jest nośnikiem statusu i zlecenia). To tutaj ekipa w Field App wrzuca podpisane protokoły, numery seryjne użytego sprzętu oraz zdjęcia ze ściany po robocie.
5. **`shipments`**: Zarządzanie kurierami i materiałami, ścisłe powiązanie z leadem.
