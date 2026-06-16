# Model Danych (Supabase / PostgreSQL)

Poniższy dokument obrazuje relacyjny model danych dla pierwszej fazy systemu Klik Klima.
Uwzględnia on kluczowe tabele niezbędne do obsłużenia całego procesu inteligentnego formularza (Triage), włączając w to geolokalizację (wielokrotne adresy dla jednego klienta) oraz rezerwację terminów.

## Diagram Relacji Encji (ERD)

```mermaid
erDiagram
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
        jsonb odpowiedzi_triage "Struktura JSON (pokoje, metraż)"
        string estymowana_wycena
        string status_leada "Enum: Nowy, Weryfikacja..."
        uuid audytor_id FK "Z tabeli auth.users"
        timestamp data_rezerwacji
        timestamp created_at
    }

    SYSTEM_CONFIG {
        uuid id PK
        string typ_konfiguracji "np. booking_rules"
        jsonb konfiguracja
    }

    KLIENCI ||--o{ ADRESY : "posiada"
    KLIENCI ||--o{ LEADY : "składa"
    ADRESY ||--o{ LEADY : "jest miejscem dla"
```

## Opis Głównych Tabel

1. **`klienci`**: Centralny punkt prawdy o fizycznej osobie. Jeśli klient złoży drugi wniosek po roku (np. na pompę ciepła), będziemy bazować na tym samym rekordzie.
2. **`adresy`**: Zgodnie z architekturą, jeden klient może posiadać wiele adresów montażu (np. mieszkanie i dom pod miastem). Pola `lat` i `lng` są wypełniane automatycznie przez Google Places API.
3. **`leady`**: Reprezentacja pojedynczego zlecenia/wniosku (pochodzącego z Triage). Posiada ogromną elastyczność dzięki kolumnie `odpowiedzi_triage` typu `JSONB` – możemy tam wrzucić dowolną ilość pokoi bez zmiany schematu tabeli.
4. **`system_config`**: Bezstanowa tabela do przechowywania globalnych ustawień systemu, z których korzystają usługi zewnętrzne (np. długość okna czasowego Bookingu).

## Wizualizacja Diagramu
![Diagram Modelu Danych](./database_model.png)
