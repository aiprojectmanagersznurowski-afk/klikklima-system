# Proces Lejka Sprzedażowego (B2B Admin Panel)

Poniższy schemat przedstawia sekwencyjny proces przepływu (Funnel Flow) zgłoszenia w systemie Klik Klima. Proces ten oparty jest na **8 etapach** i **3 bucketach** (stanach pobocznych) zdefiniowanych w wymaganiach biznesowych i obsługiwany za pomocą rozbudowanej tabeli z filtrem etapu (dropdown) w panelu B2B.

> **Uwaga:** Proces serwisów gwarancyjnych i obsługi usterek zostanie zdefiniowany w osobnym wątku i osobnym dokumencie procesowym.

## Maszyna Stanów Lejka (State Diagram)

Poniższy diagram przedstawia pełną maszynę stanów leada — w tym ścieżki alternatywne (State Bypass, Rollback Engine) i buckety.

```mermaid
stateDiagram-v2
    direction TB

    E1: 1. Nowy lead
    E2: 2. Oczekiwanie na audyt
    E3: 3. Wykonany audyt
    E4: 4. Oczekuje na przydzielenie ekipy
    E5: 5. Wysyłka sprzętu (Hurtownia)
    E6: 6. Wysyłka w drodze (Kurier)
    E7: 7. Oczekuje instalacji
    E8: 8. Instalacja zakończona
    
    Bucket_Odrzucone: BUCKET - Wyceny odrzucone
    Bucket_Rollback: BUCKET - Anulowane / Do przełożenia
    Bucket_Lost: BUCKET - Zarchiwizowany (Lost)

    %% Przepływ początkowy
    E1 --> E2 : Administrator przypisuje audytora
    E2 --> E3 : Audytor wysyła wycenę z app (Auto)
    
    %% Decyzja klienta
    E3 --> E4 : Klient akceptuje wycenę i regulamin i rezerwuje termin
    E3 --> Bucket_Odrzucone : Brak akceptacji powyżej 14 dni (Auto)

    %% Wyjścia z bucketu Zimnych leadów (ADR-004)
    Bucket_Odrzucone --> E3 : Zwróć do obiegu (wymaga odświeżenia ceny po 30 dniach)
    Bucket_Odrzucone --> Bucket_Lost : Archiwizuj trwale (wymaga powodu utraty)
    Bucket_Lost --> [*] : Stan terminalny

    %% Logistyka i montaż
    E4 --> E5 : Administrator przypisuje ekipę (Crew_ID)

    note right of E5: Decyzja Dyspozytora
    E5 --> E6 : Wysłano kurierem
    E5 --> E7 : Dostawa z ekipą (Bypass)
    E6 --> E7 : Dostarczono paczkę
    
    E7 --> E8 : Ekipa kończy montaż w Aplikacji

    %% Rollback Engine (Wyjątki logistyczne)
    E4 --> Bucket_Rollback : Zmiana terminu
    E5 --> Bucket_Rollback : Problem magazynowy / Zmiana
    E6 --> Bucket_Rollback : Zagubiona paczka / Zmiana
    E7 --> Bucket_Rollback : Zmiana terminu przez klienta

    note left of Bucket_Rollback: Zwalnia kalendarz. Wysyła maila z linkiem do rezerwacji do klienta.
    Bucket_Rollback --> E4 : Klient rezerwuje nowy termin
```

## Szczegółowy opis etapów i wyzwalaczy

### Etap 1: Nowy lead
- **Opis:** Wpada nowy lead.
- **Wyzwalacz do Etapu 2:** Administrator dokonuje ręcznego przypisania audytora do leada w systemie.

### Etap 2: Oczekiwanie na audyt
- **Opis:** Audytor ma przypisany lead i realizuje wizję lokalną.
- **Wyzwalacz do Etapu 3:** Audytor wysyła wycenę z aplikacji do klienta. Po jej wysłaniu z automatu (auto-transition) lead przechodzi do kolejnego etapu.

### Etap 3: Wykonany audyt
- **Opis:** W systemie widnieje gotowa wycena. Klient otrzymał ofertę i decyduje o jej akceptacji.
- **Wyzwalacz do Etapu 4 (Sukces):** Klient akceptuje daną wycenę poprzez rezerwację konkretnego terminu montażu.
- **Wyzwalacz do Bucketu (Odrzucenie):** Jeśli klient nie zaakceptuje wyceny w czasie powyżej 14 dni, lead automatycznie spada do bucketu „Wyceny odrzucone".

### Etap 4: Oczekuje na przydzielenie ekipy
- **Opis:** Zlecenie posiada już zarezerwowany termin instalacji. System oczekuje na ostateczne dobranie brygady monterskiej.
- **Wyzwalacz do Etapu 5:** Administrator przypisuje konkretną ekipę monterską (`Crew_ID`) do zlecenia. Status przechodzi do działu logistyki.

### Etap 5: Wysyłka sprzętu (W hurtowni)
- **Opis:** Przygotowanie zlecenia wysyłki, kompletowanie urządzeń w magazynie.
- **Wyzwalacz do Etapu 6 (Ścieżka Kurierska):** Dyspozytor klika „Wysłano kurierem" (dodaje Tracking ID).
- **Wyzwalacz do Etapu 7 (State Bypass — Ścieżka Bezpośrednia):** Dyspozytor klika „Dostawa z ekipą w dniu montażu".

### Etap 6: Wysyłka w drodze
- **Opis:** Paczka nadana kurierem jest w drodze do klienta.
- **Wyzwalacz do Etapu 7:** Webhook od firmy kurierskiej zwraca status „Doręczono" LUB dyspozytor ręcznie klika „Paczka dostarczona".

### Etap 7: Oczekuje instalacji
- **Opis:** Warunki logistyczne spełnione. Ekipa monterska jest gotowa, sprzęt jest u klienta lub jedzie z monterami.
- **Wyzwalacz do Etapu 8:** Instalator za pomocą aplikacji mobilnej zmienia status zlecenia na „Zakończone" po udanym montażu.

### Etap 8: Instalacja zakończona
- **Opis:** Proces montażu pomyślnie zamknięty.

### Bucket: Wyceny odrzucone
- **Opis:** Miejsce na leady, które nie skonwertowały.
- **Wyzwalacz WEJŚCIA:** Brak akceptacji wyceny na Etapie 3 przez ponad 14 dni (automat).
- **Wyjście „Zwróć do obiegu" (T15):** Dyspozytor przesuwa leada z powrotem na Etap 3. Jeżeli od wejścia do bucketu minęło ponad 30 dni, guard `quoteRefreshedIfStale` blokuje przejście do czasu odświeżenia ceny — chodzi o to, żeby klient nie zaakceptował wyceny opartej na nieaktualnych cenach materiałów.
- **Wyjście „Archiwizuj trwale" (T16):** przejście do bucketu Lost, wymaga podania powodu utraty.

### Bucket: Zarchiwizowany (Lost)
- **Opis:** Stan terminalny. Lead zamknięty definitywnie, powód utraty zasila moduł analityczny.
- **Wyzwalacz WEJŚCIA:** wyłącznie ręczna akcja Dyspozytora z bucketu „Wyceny odrzucone" (T16), zawsze z powodem utraty (guard `lostReasonProvided`).
- **Wyjście:** brak w maszynie stanów. Przywrócenie leada wymaga ręcznej interwencji administratora w bazie — to celowe, bo archiwizacja ma być decyzją nieodwracalną w normalnym trybie pracy.

### Bucket: Anulowane / Do przełożenia (Rollback Engine)
- **Opis:** Worek na leady wyjęte z głównego przepływu. Zwalnia zasoby (kalendarz ekipy) i blokuje SLA logistyczne.
- **Wyzwalacze WEJŚCIA:** Klient klika „Zmień termin/Anuluj" w e-mailu LUB Dyspozytor wyzwala akcję „Problem z dostawą (Rollback)".
- **Wyzwalacz WYJŚCIA (Powrót do lejka):** Klient wybiera nowy termin z linku w e-mailu ratunkowym → lead wraca do Etapu 4.

---

## Schemat Przepływu z Systemem Powiadomień (Flowchart)

Poniższy diagram obrazuje przepływ leada oraz zintegrowany, zautomatyzowany system komunikacji z klientem (SMS/E-mail).
Węzły w kolorze **zielonym** reprezentują automatyczną komunikację wychodzącą, **niebieskim** wyzwalacze czasowe, **żółtym** wyzwalacze GPS.

```mermaid
flowchart TD
    %% Definicja stylów
    classDef status fill:#f2f2f2,stroke:#333,stroke-width:2px;
    classDef notif fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#155724;
    classDef timeNotif fill:#cce5ff,stroke:#004085,stroke-width:2px,color:#004085;
    classDef geoNotif fill:#fff3cd,stroke:#856404,stroke-width:2px,color:#856404;
    classDef bucket fill:#f8d7da,stroke:#721c24,stroke-width:2px,color:#721c24;
    classDef autoNotif fill:#e2d5f1,stroke:#6f42c1,stroke-width:2px,color:#6f42c1;

    %% Rozpoczęcie
    Start((Zgłoszenie B2C)) --> E1

    %% Etapy główne
    E1[Etap 1: Nowy lead]:::status --> E2

    E2[Etap 2: Oczekiwanie na audyt]:::status
    E2 --> N1{{"SMS/Email: Przydzielono audytora. Będzie kontakt!"}}:::notif

    %% Czasowe przed audytem
    N2{{"SMS/Email (24h przed audytem): Jutro audyt! Zmiana terminu?"}}:::timeNotif -.-> E3
    N3{{"SMS (Geolokalizacja): Audytor jest w drodze!"}}:::geoNotif -.-> E3

    E2 --> E3[Etap 3: Wykonany audyt]:::status
    E3 --> N4{{"Email: Wycena gotowa — link do akceptacji i rezerwacji terminu"}}:::notif
    
    %% Decyzja klienta
    E3 --> E4[Etap 4: Oczekuje na przydzielenie ekipy]:::status
    E3 --> BK1[BUCKET: Wyceny odrzucone]:::bucket
    AUTO_14{{"Automat: Brak akceptacji > 14 dni"}}:::autoNotif -.-> BK1
    BK1 --> N_REJECT{{"Email: Wycena wygasła. Chcesz ponownie?"}}:::notif

    E4 --> E5[Etap 5: Wysyłka sprzętu]:::status

    %% Logistyka — ścieżki
    E5 -->|Wysłano kurierem| E6[Etap 6: Wysyłka w drodze]:::status
    E5 -->|Dostawa z ekipą — Bypass| E7
    E6 --> N5{{"SMS/Email: Sprzęt w drodze. Tracking: {{tracking_id}}"}}:::notif
    E6 -->|Webhook lub ręczne potwierdzenie| E7[Etap 7: Oczekuje instalacji]:::status

    %% Czasowe przed montażem
    N6{{"SMS/Email (24h przed montażem): Jutro montaż! Zmiana terminu?"}}:::timeNotif -.-> E7
    N9{{"SMS (Geolokalizacja): Ekipa jest w drodze!"}}:::geoNotif -.-> E7

    E7 --> E8[Etap 8: Instalacja zakończona]:::status
    E8 --> N7{{"Email: Karta gwarancyjna + Protokół + Faktura"}}:::notif

    %% Rollback Engine
    E4 --> BK2[BUCKET: Anulowane / Do przełożenia]:::bucket
    E5 --> BK2
    E6 --> BK2
    E7 --> BK2
    BK2 --> N_ROLLBACK{{"Email ratunkowy: Link do rezerwacji nowego terminu"}}:::notif
    BK2 --> E4
```

## Rodzaje Powiadomień i Parametryzacja

Wysyłka wiadomości opiera się na tabeli `NOTIFICATION_QUEUE` i Edge Functions, co pozwala na pełną parametryzację (np. kolejkowanie wysyłki tylko w godzinach 8:00-18:00).

Wyróżniamy 4 typy wyzwalaczy (oznaczone kolorami na diagramie):

1. **Wyzwalacze na zmianę statusu (Zielone):**
   - Generowane natychmiast po zmianie etapu z poziomu tabeli lub karty klienta w panelu B2B (np. wejście w Etap 2, 3, 6, 8).
2. **Wyzwalacze Czasowe (Niebieskie):**
   - Wymagają harmonogramu (`pg_cron`). Obliczane na podstawie zaplanowanej daty w kalendarzu.
   - Przypomnienie dzień przed audytem, dzień przed montażem.
3. **Wyzwalacze Zewnętrzne / GPS (Żółte):**
   - Wyzwalane akcją z poziomu Field App. Audytor klika "Wyruszam" lub wkracza w promień np. 5 km od adresu leada, co wyzwala SMS "Audytor jest w drodze".
4. **Wyzwalacze Automatyczne (Fioletowe):**
   - Automat 14-dniowy: `pg_cron` sprawdza leady na Etapie 3 bez akceptacji > 14 dni → przenosi do bucketu.
   - Webhook kurierski: zewnętrzny callback od firmy kurierskiej ze statusem „Doręczono" → E6 → E7.
   - Rollback: zwolnienie kalendarza i wysyłka maila ratunkowego po wejściu do bucketu.

## Role i Odpowiedzialność (Sequence Diagram)

Poniższy diagram sekwencji ukazuje interakcje pomiędzy klientem, dyspozytorem (panel B2B), inżynierami terenowymi (Field App) oraz samym systemem automatyzującym.

```mermaid
sequenceDiagram
    autonumber
    
    actor K as Klient (B2C)
    actor D as Dyspozytor (B2B Admin)
    actor A as Audytor (Field App)
    actor M as Monter (Field App)
    participant S as System (Baza & Edge)
    participant KUR as Kurier (Webhook)

    K->>S: Wypełnia formularz Triage (Etap 1: Nowy lead)
    S-->>D: Lead widoczny w tabeli — filtr „Etap 1"

    D->>S: Przypisuje audytora → Etap 2: Oczekiwanie na audyt
    S-->>K: [SMS/Email] Przydzielono inżyniera
    S-->>A: [Push] Nowe zlecenie audytu

    A->>K: Przyjazd na miejsce i audyt
    A->>S: Wysyła wycenę z app → Etap 3: Wykonany audyt (auto-transition)
    S-->>K: [Email] Wycena gotowa — link do akceptacji i rezerwacji terminu

    alt Klient akceptuje w < 14 dni
        K->>S: Akceptuje wycenę i rezerwuje termin → Etap 4
        S-->>D: Lead na Etapie 4 — przypisz ekipę
    else Brak akceptacji > 14 dni
        S->>S: [Automat pg_cron] → Bucket: Wyceny odrzucone
        S-->>K: [Email] Wycena wygasła
    end

    D->>S: Przypisuje ekipę (Crew_ID) → Etap 5: Wysyłka sprzętu

    alt Ścieżka Kurierska
        D->>S: Klika "Wysłano kurierem" + Tracking ID → Etap 6
        S-->>K: [SMS] Sprzęt w drodze (tracking)
        KUR-->>S: Webhook "Doręczono" → Etap 7
    else Dostawa z ekipą (Bypass)
        D->>S: Klika "Dostawa z ekipą" → Etap 7 (pominięcie E6)
    end

    Note over E7,M: Etap 7: Oczekuje instalacji

    M->>K: Przyjazd na adres i montaż
    M->>S: Klika "Zakończ" w Field App → Etap 8: Instalacja zakończona

    S-->>K: [Email] Karta gwarancyjna + Protokół + Faktura
    S-->>S: Generowanie daty przyszłorocznego serwisu
```
