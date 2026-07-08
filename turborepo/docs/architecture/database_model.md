# Model Danych (Supabase / PostgreSQL) - Wersja B2B/B2C

Poniższy dokument obrazuje pełny, zaktualizowany relacyjny model danych dla systemu Klik Klima, uwzględniający zarówno obsługę Triage (B2C), jak i panel zarządzania dla dyspozytora i monterów (B2B/CRM).

## Diagram Relacji Encji (ERD)

```mermaid
erDiagram
    USERS {
        uuid id PK "auth.users"
        string email
        timestamp created_at
    }

    USER_ROLES {
        uuid id PK
        uuid user_id FK
        string role "Enum: Admin, Dyspozytor, Audytor, Monter"
    }

    CREWS {
        uuid id PK
        string nazwa_ekipy
        string kolor
    }

    KLIENCI {
        uuid id PK
        string imie_i_nazwisko
        string email
        string telefon
        timestamp created_at
    }

    ADRESY {
        uuid id PK
        uuid klient_id FK
        string ulica_miasto
        float lat "Szerokość geog."
        float lng "Długość geog."
        timestamp created_at
    }

    LEADY {
        uuid id PK
        uuid klient_id FK
        uuid adres_id FK
        jsonb odpowiedzi_triage "JSON z konfiguratora"
        string estymowana_wycena
        string status_leada "Enum (1-9): Nowy, Audyt, Wycena..."
        uuid auditor_id FK "Users (Auditor)"
        uuid crew_id FK "Crews"
        timestamp installation_date
        timestamp data_rezerwacji_audytu
        timestamp created_at
    }

    SHIPMENTS {
        uuid id PK
        uuid lead_id FK
        string status "Enum: Oczekująca, Wysłana, Doręczona"
        timestamp expected_delivery_date
        timestamp actual_delivery_date
    }

    NOTIFICATION_QUEUE {
        uuid id PK
        uuid lead_id FK
        string type "Enum: SMS, EMAIL"
        string status "Enum: PENDING, SENT, FAILED"
        jsonb payload
        timestamp scheduled_for
        timestamp created_at
    }

    SYSTEM_CONFIG {
        uuid id PK
        string typ_konfiguracji "np. booking_rules"
        jsonb konfiguracja
    }

    USERS ||--o{ USER_ROLES : "posiada"
    KLIENCI ||--o{ ADRESY : "posiada"
    KLIENCI ||--o{ LEADY : "składa"
    ADRESY ||--o{ LEADY : "jest miejscem dla"
    LEADY }o--|| USERS : "obsługiwany przez (Audytor)"
    LEADY }o--|| CREWS : "realizowany przez"
    LEADY ||--o{ SHIPMENTS : "generuje"
    LEADY ||--o{ NOTIFICATION_QUEUE : "wyzwala"
```

## Opis Nowych Tabel B2B

1. **`users` i `user_roles`**: Rozszerzenie wbudowanej w Supabase tabeli `auth.users` o własną tabelę ról (RBAC). Dzięki temu możemy przypisać osobie uprawnienia (Dyspozytor, Monter) i włączać polityki bezpieczeństwa (RLS).
2. **`crews`**: Ekipy monterskie. Do jednej ekipy może należeć kilku użytkowników (monterów), a sama ekipa jest przypisywana do Leada na etapie instalacji.
3. **`shipments`**: Moduł logistyczny. Śledzi status wysyłki sprzętu dla danego Zlecenia (Leada). Powiązany ściśle z datą planowanej instalacji (by wyświetlać kolorowe SLA).
4. **`notification_queue`**: Tabela buforowa dla powiadomień. Triggery na tabeli `leady` wrzucają tu rekord, a Supabase Edge Functions / pg_cron go pobierają i wysyłają w świat (SMS/Email).
