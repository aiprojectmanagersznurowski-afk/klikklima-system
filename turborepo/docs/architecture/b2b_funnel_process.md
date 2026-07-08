# Proces Lejka Sprzedażowego (B2B Admin Panel)

Poniższy schemat przedstawia sekwencyjny proces przepływu (Funnel Flow) zgłoszenia w systemie Klik Klima. Proces ten oparty jest na 9 etapach zdefiniowanych w wymaganiach biznesowych i obsługiwany za pomocą tablicy Kanban w panelu B2B.

## Schemat Przepływu z Systemem Powiadomień (Flowchart)

Poniższy diagram obrazuje przepływ leada oraz zintegrowany, zautomatyzowany system komunikacji z klientem (SMS/E-mail).
Węzły w kolorze **niebieskim** reprezentują automatyczną komunikację wychodzącą.

```mermaid
flowchart TD
    %% Definicja stylów
    classDef status fill:#f2f2f2,stroke:#333,stroke-width:2px;
    classDef notif fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#155724;
    classDef timeNotif fill:#cce5ff,stroke:#004085,stroke-width:2px,color:#004085;
    classDef geoNotif fill:#fff3cd,stroke:#856404,stroke-width:2px,color:#856404;

    %% Rozpoczęcie
    Start((Zgłoszenie B2C)) --> E1
    
    %% Etapy główne
    E1[Etap 1: Nowy lead]:::status --> E2
    
    E2[Etap 2: Przypisanie audytora]:::status
    E2 --> N1{{"SMS/Email: Przydzielono audytora. Będzie kontakt!"}}:::notif
    
    %% Czasowe przed audytem
    N2{{"SMS/Email (24h przed audytem): Jutro audyt! Zmiana terminu?"}}:::timeNotif -.-> E3
    N3{{"SMS (Geolokalizacja): Audytor jest w drodze!"}}:::geoNotif -.-> E3

    E3[Etap 3: Wykonany audyt]:::status --> E4
    E4[Etap 4: Wycena zaakceptowana]:::status --> E5
    E5[Etap 5: Oczekuje na przydzielenie ekipy]:::status --> E6
    
    E6[Etap 6: Wysyłka sprzętu]:::status
    E6 --> N4{{"SMS/Email: Sprzęt wysłany kurierem."}}:::notif
    E6 --> E7
    
    E7[Etap 7: Sprzęt dostarczony]:::status
    E7 --> N5{{"SMS/Email: Sprzęt dostarczony. Oczekuj na ekipę."}}:::notif
    
    %% Czasowe przed montażem
    N6{{"SMS/Email (24h przed montażem): Jutro montaż! Zmiana terminu?"}}:::timeNotif -.-> E8
    
    E8[Etap 8: Wykonanie instalacji]:::status --> E9
    
    E9[Etap 9: Instalacja zakończona]:::status
    E9 --> N7{{"SMS/Email: Wirtualna Gwarancja + Dziękujemy!"}}:::notif
    
    %% Serwisy (Cykl Posprzedażowy)
    S1[(Baza: next_service_date)] -.-> N8
    N8{{"SMS/Email (X dni przed serwisem): Zbliża się termin przeglądu! Zarezerwuj termin."}}:::timeNotif
    
    %% Przepływy
    E2 --> E3
    E7 --> E8
    E9 --> S1
```

## Rodzaje Powiadomień i Parametryzacja

Wysyłka wiadomości opiera się na tabeli `NOTIFICATION_QUEUE` i Edge Functions, co pozwala na pełną parametryzację (np. kolejkowanie wysyłki tylko w godzinach 8:00-18:00).

Wyróżniamy 3 główne typy wyzwalaczy (oznaczone kolorami na diagramie):

1. **Wyzwalacze na zmianę statusu (Zielone):** 
   - Generowane natychmiast po zmianie kolumny na Kanbanie (np. wejście w Etap 2, 6, 7 i 9).
2. **Wyzwalacze Czasowe (Niebieskie):**
   - Wymagają harmonogramu (`pg_cron`). Obliczane na podstawie zaplanowanej daty w kalendarzu.
   - Przypomnienie dzień przed audytem, dzień przed montażem oraz przypomnienie o corocznym serwisie z linkiem do zmiany terminu.
3. **Wyzwalacze Zewnętrzne / GPS (Żółte):**
   - Wyzwalane akcją z poziomu Field App. Audytor klika "Wyruszam" lub wkracza w promień np. 5 km od adresu leada, co wyzwala SMS "Audytor jest w drodze".

## Role i Odpowiedzialność (Sequence Diagram)

Aby jeszcze lepiej zrozumieć, kto jest aktorem (wykonawcą) w poszczególnym kroku, poniższy diagram sekwencji ukazuje interakcje pomiędzy klientem, dyspozytorem (panel B2B), inżynierami terenowymi (Field App) oraz samym systemem automatyzującym.

```mermaid
sequenceDiagram
    autonumber
    
    actor K as Klient (B2C)
    actor D as Dyspozytor (B2B Admin)
    actor A as Audytor (Field App)
    actor M as Monter (Field App)
    participant S as System (Baza & Edge)

    K->>S: Wypełnia formularz Triage (Etap 1)
    S-->>D: Lead pojawia się w Kolumnie 1 na Kanbanie
    
    D->>S: Przesuwa na Etap 2 i wybiera Audytora
    S-->>K: [Automatyczny SMS] Przydzielono inżyniera
    
    A->>K: Przyjazd na miejsce i audyt
    A->>S: Wystawia wycenę i klika "Wyślij" (Etap 3)
    S-->>K: [Automatyczny E-mail] Link do opłacenia oferty
    
    K->>S: Klient opłaca wycenę przez bramkę (Etap 4)
    S-->>D: [Auto-Aktualizacja] Przesuwa leada na Etap 5
    
    D->>S: Zamawia sprzęt w hurtowni i oznacza wysyłkę (Etap 6)
    S-->>K: [Automatyczny SMS] Sprzęt w drodze
    
    K->>S: Kurier przyjeżdża / Klient potwierdza odbiór (Etap 7)
    S-->>M: Zlecenie w Field App odblokowuje się dla Montera
    
    M->>K: Przyjazd na adres i wykonanie montażu (Etap 8)
    M->>S: Dodaje protokół i klika "Zakończ" w Field App (Etap 9)
    
    S-->>K: [Automatyczny E-mail] Gwarancja i powitanie w rodzinie
    S-->>S: Generowanie daty przyszłorocznego Serwisu
```
