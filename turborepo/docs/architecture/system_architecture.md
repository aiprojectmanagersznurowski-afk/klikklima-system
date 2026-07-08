# Architektura Systemu Klik Klima (v2)

Ten dokument opisuje globalną architekturę systemu, podział na poszczególne aplikacje oraz wybrany stos technologiczny. Projekt prowadzony jest w architekturze **Monorepo** zarządzanej przez narzędzie **Turborepo**.

## 1. Diagram Architektury i Relacji

Poniższy diagram obrazuje przepływ danych i zależności pomiędzy czterema głównymi filarami naszego systemu: Warstwą Fundamentów (Core), aplikacją kliencką B2C, panelem administracyjnym B2B oraz aplikacją terenową.

```mermaid
flowchart TB
    subgraph Monorepo["📦 Monorepo (Turborepo)"]
        direction TB

        subgraph Core["⚙️ 1. Warstwa Fundamentów (Współdzielone / Core)"]
            direction LR
            DB[("🗄️ Baza Danych\n(Supabase PostgreSQL)")]
            E2E["🔗 Pakiety Współdzielone\n(np. packages/database)"]
            DB --- E2E
        end

        subgraph B2C["🌐 2. Aplikacja Kliencka B2C (Web)"]
            Triage["📝 Inteligentny Formularz Triage\n(Generowanie Leadów)"]
        end

        subgraph B2B["💻 3. Panel Administracyjny B2B (Web SPA)"]
            Kanban["📋 Tablica Kanban Dyspozytora\n(Zarządzanie zleceniami)"]
            Crew["👥 Zarządzanie Brygadami\n(Grafiki, dostępność)"]
            Rollback["📦 Logistyka i Rollback Engine\n(Magazyn, sytuacje awaryjne)"]
        end

        subgraph Mobile["📱 4. Aplikacja Terenowa (Mobile)"]
            FieldApp{"Klik Klima Field App\n(Jedna aplikacja, dwie role)"}
            Eng["📐 Widok Inżyniera\n(Wycena, pomiary, warianty)"]
            Inst["🛠️ Widok Montera\n(Check-listy, protokoły, zdjęcia)"]
            
            FieldApp --> Eng
            FieldApp --> Inst
        end

        %% Relacje dostępu do bazy
        B2C == Odczyt / Zapis ==> Core
        B2B == Pełne Zarządzanie ==> Core
        Mobile == Synchronizacja (Offline/Online) ==> Core

        %% Przykładowy przepływ biznesowy (przerywane linie)
        Triage -. "1. Przekazuje Leada z estymacją" .-> Kanban
        Kanban -. "2. Przypisuje audyt / montaż" .-> FieldApp
    end

    subgraph External["🌍 Usługi Zewnętrzne (APIs)"]
        GoogleMaps["🗺️ Google Maps API\n(Autouzupełnianie i Geokodowanie)"]
        GoogleCal["🗓️ Google Calendar API\n(Synchronizacja Dostępności)"]
        SMSApi["📩 SMS API\n(Powiadomienia SMS)"]
    end

    %% Relacje z zewnątrz
    B2C -. "Pobiera podpowiedzi adresów" .-> GoogleMaps
    B2C -. "Odpytuje o wolne terminy (SSR)" .-> GoogleCal
    Core -. "Trigger DB / Edge Function" .-> SMSApi

    classDef core fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,color:#000;
    classDef web fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#000;
    classDef admin fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#000;
    classDef mobile fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#000;

    class Core core;
    class B2C web;
    class B2B admin;
    class Mobile mobile;
```

---

## 2. Architektura Przepływu Danych i Powiadomień (Data Architecture)

Zrezygnowaliśmy z zewnętrznych narzędzi no-code na rzecz "Grubej Bazy Danych" (Thick DB Pattern). Poniższy schemat pokazuje architekturę kolejkowania i logiki danych.

```mermaid
flowchart TD
    ClientB2C([Klienci B2C / Triage])
    AdminB2B([Dyspozytorzy B2B])
    MobileApp([Aplikacja Mobilna])

    subgraph SupabaseCloud["☁️ Supabase Cloud (Data Layer)"]
        direction TB
        
        subgraph PostgreSQL["🗄️ Baza Danych PostgreSQL"]
            Tables[(Główne Tabele\nLeady, Users, itp.)]
            RLS[🔒 Row Level Security\n(Filtrowanie dostępu wg ról)]
            Queue[(Kolejka Powiadomień\n'notification_queue')]
            Triggers[⚡ DB Triggers\n(Reagują na zmianę statusu)]
            PgCron[🕰️ pg_cron\n(Harmonogram zadań)]
            
            Tables -->|UPDATE status=2| Triggers
            Triggers -->|INSERT INTO| Queue
        end
        
        subgraph EdgeLayer["🚀 Edge Computing"]
            EdgeFunc[[Edge Functions\nnp. send-notifications]]
            Auth[🔑 Supabase Auth\n(Logowanie Google)]
        end
        
        PgCron -.->|Co 1 minutę wyzwala HTTP| EdgeFunc
        EdgeFunc -->|Czyta rekordy 'PENDING'| Queue
        EdgeFunc -->|Aktualizuje status na 'SENT'| Queue
    end

    subgraph ExternalServices["🌍 Serwisy Zewnętrzne"]
        SMS[📩 SMS API]
        Email[📧 Email / SMTP]
    end

    %% Połączenia zewnętrzne
    ClientB2C -->|Odczyt/Zapis (Public)| Tables
    AdminB2B -->|Auth (OAuth)| Auth
    AdminB2B -->|Odczyt/Zapis (Role RLS)| RLS
    MobileApp -->|Odczyt/Zapis (Role RLS)| RLS
    RLS --> Tables

    EdgeFunc -->|Wysyłka (Payload JSON)| SMS
    EdgeFunc -->|Wysyłka (Payload JSON)| Email
```

---

## 3. Stos Technologiczny i Hosting

Wybór technologii podyktowany jest szybkością tworzenia (Time-to-Market), łatwością utrzymania z perspektywy jednego zespołu oraz niezawodnością gotowych usług chmurowych (BaaS - Backend as a Service).

| Aplikacja / Moduł | Stos Technologiczny (Frontend & Logika) | Baza Danych, Autoryzacja i Backend | Hosting / Deployment | Dlaczego to najlepszy wybór? |
| :--- | :--- | :--- | :--- | :--- |
| **1. Warstwa Fundamentów (Core)** | **Turborepo**, TypeScript, **Prisma ORM** | **Supabase** (PostgreSQL, Auth, Storage) | **Supabase Cloud** | Supabase to gotowy backend (BaaS). Przyjęto **Model Hybrydowy**: Prisma ORM służy jako Single Source of Truth dla schematu bazy i jest używana na serwerze (np. Panel B2B Admin) omijając RLS dla pełnej kontroli i typowania. Aplikacje klienckie (B2C) używają bezpośrednio klienta `supabase-js`, aby zachować wbudowane bezpieczeństwo RLS i logowanie z przeglądarki. |
| **2. Kliencka B2C (Formularz Triage)** | **Next.js (React)** + Tailwind CSS + React Hook Form | Łączy się bezpośrednio z Supabase / API (`supabase-js`) | **Vercel** | Next.js jest natywną technologią Vercel. Daje świetne SEO (Server-Side Rendering) i błyskawiczne ładowanie. Zastosowanie natywnego klienta Supabase gwarantuje, że dane chronione są przez reguły RLS bazy danych. |
| **3. Panel B2B (Dyspozytor)** | **Vite + React** (lub Next.js) + Tailwind CSS + shadcn/ui | Łączy się bezpośrednio z Supabase | **Vercel** | Dla zamkniętego panelu administracyjnego (Single Page Application bez SEO) Vite jest najszybszym i najlżejszym wyborem. Zestaw gotowych komponentów `shadcn/ui` pozwoli błyskawicznie budować tabele i formularze. |
| **4. Aplikacja Terenowa (Mobile)** | **React Native + Expo** | Łączy się z Supabase z poziomu telefonu | **EAS** (Expo Application Services) | Expo ułatwia tworzenie aplikacji cross-platform (iOS + Android) bez dotykania natywnego kodu (np. Android Studio). EAS drastycznie ułatwia publikację apki do App Store i Google Play. |
| **Integracje Zewnętrzne (APIs)** | **Google Maps** (Places Autocomplete) <br/> **Google Calendar API** (Custom SSR) <br/> **SMS API** | Zwracają JSON (Współrzędne geograficzne / Wolne sloty) | N/A | **Google Maps** gwarantuje absolutnie najwyższą jakość bazy adresowej w Polsce i natychmiastowe geokodowanie. **Google Calendar API** poprzez własne rozwiązanie serwerowe eliminuje ciężkie widgety na froncie. **SMS API** (np. SMSAPI) uwiarygadnia rezerwację dla klienta. |
| **Post-Booking / Automatyzacje** | **Supabase Database Triggers / Functions** | Logika wbudowana w strukturę bazy danych | **Supabase Cloud** | Zamiast polegać na zewnętrznym Make.com, automatyzacje (powiadomienia, SMS, e-mail) są rozwiązywane przez dedykowaną strukturę bazy danych, triggery PostgreSQL i Supabase Edge Functions, co gwarantuje pełną kontrolę i mniejsze koszty. |

---

## 3. Proces CI/CD (Continuous Integration)

Wszystkie aplikacje w monorepo poddawane są automatycznemu procesowi testowania i budowania przed wdrożeniem. Poniżej przedstawiono proces działania **GitHub Actions** w połączeniu z Vercel Preview i testami End-to-End w **Playwright**.

```mermaid
sequenceDiagram
    participant Dev as Programista
    participant Git as GitHub
    participant Vercel as Vercel (Hosting)
    participant GHA as GitHub Actions
    participant Turbo as Turborepo
    participant Playwright as Playwright (E2E)

    Dev->>Git: 1. Tworzy nowy Pull Request
    Git->>Vercel: 2. Vercel nasłuchuje zmian
    Vercel-->>Git: 3. Zwraca tymczasowy link (Preview URL)
    
    Git->>GHA: 4. Uruchamia workflow ci.yml
    GHA->>Turbo: 5. Wykonuje komendę testów
    
    Note over Turbo: Turborepo analizuje kod.<br/>Testuje i buduje TYLKO aplikacje,<br/>które zostały zmienione w danym PR!
    
    Turbo->>Playwright: 6. "Uruchom testy np. tylko dla B2C"
    Playwright->>Vercel: 7. Odpytuje środowisko Vercel Preview
    Playwright-->>Turbo: 8. Zwraca wyniki testów
    
    Turbo-->>GHA: 9. Raportuje gotowość
    GHA-->>Git: 10. Zwraca wynik (✅ Sukces / ❌ Błąd)
    
    Note over Dev,Git: Dopiero po zapaleniu się ✅ (Sukces),<br/>Programista wykonuje "Merge" do produkcji.
```
