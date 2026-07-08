# Proces Lejka Sprzedażowego (B2B Admin Panel)

Poniższy schemat przedstawia sekwencyjny proces przepływu (Funnel Flow) zgłoszenia w systemie Klik Klima. Proces ten oparty jest na 9 etapach zdefiniowanych w wymaganiach biznesowych i obsługiwany za pomocą tablicy Kanban w panelu B2B.

## Schemat Przepływu (State Diagram)

```mermaid
stateDiagram-v2
    direction TB

    [*] --> NowyLead : Zgłoszenie z Triage B2C

    state "Etap 1: Nowy lead" as NowyLead
    state "Etap 2: Przypisanie audytora" as PrzypisanieAudytora
    state "Etap 3: Wykonany audyt" as WykonanyAudyt
    state "Etap 4: Wycena zaakceptowana" as WycenaZaakceptowana
    state "Etap 5: Oczekuje na przydzielenie ekipy" as OczekujeNaEkipe
    state "Etap 6: Wysyłka sprzętu" as WysylkaSprzetu
    state "Etap 7: Sprzęt dostarczony" as SprzetDostarczony
    state "Etap 8: Wykonanie instalacji" as WykonanieInstalacji
    state "Etap 9: Instalacja zakończona" as InstalacjaZakonczona

    %% Triggering and actions
    NowyLead --> PrzypisanieAudytora : Przydziel Inżyniera (Admin)
    
    %% Note to left of PrzypisanieAudytora : Automatyczny SMS "Masz przydzielonego audytora"
    
    PrzypisanieAudytora --> WykonanyAudyt : Mobilna Aplikacja (Audytor wgrywa wycenę)
    
    WykonanyAudyt --> WycenaZaakceptowana : Klient akceptuje i opłaca
    WycenaZaakceptowana --> OczekujeNaEkipe : Wymagane przypisanie terminu
    
    OczekujeNaEkipe --> WysylkaSprzetu : Potwierdzenie z Hurtownią (Admin)
    WysylkaSprzetu --> SprzetDostarczony : Kurier doręcza (Klient / Admin potwierdza)
    
    %% Note to right of SprzetDostarczony : Bramka przed instalacją. Odblokowuje zadanie u Montera.
    
    SprzetDostarczony --> WykonanieInstalacji : Przyjazd ekipy na miejsce
    WykonanieInstalacji --> InstalacjaZakonczona : Zakończenie pracy i podpisanie protokołu (Mobile)
    
    InstalacjaZakonczona --> [*] : Zapis do cyklu posprzedażowego (Serwis co rok)
    
    %% Opcjonalne odgałęzienia i ścieżki awaryjne (Rollback)
    WysylkaSprzetu --> OczekujeNaEkipe : Awaria dostawy (Rollback)
    WycenaZaakceptowana --> [*] : Klient rezygnuje (Zlecenie Utracone)
```

## Opis Akcji Systemowych i Asynchronicznych
W trakcie przechodzenia pomiędzy powyższymi stanami (Drag&Drop na tablicy Kanban lub akcje w aplikacji mobilnej), baza danych (PostgreSQL Triggers) automatycznie nasłuchuje zmian. Na przykład:
1. Zmiana na **Etap 2** generuje w tabeli `notification_queue` powiadomienie SMS dla klienta z numerem telefonu przydzielonego inżyniera.
2. Wejście w **Etap 6** i brak dostawy do **Etapu 7** na 24h przed montażem wywołuje alert SLA u Dyspozytora.
3. Wejście w **Etap 9** generuje powiadomienie (Email) z wirtualną gwarancją i wpisuje klienta w cykliczny proces przypomnień o serwisie za 12 miesięcy.
