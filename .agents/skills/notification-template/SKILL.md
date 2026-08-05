---
name: notification-template
description: >-
  Standaryzuje tworzenie nowych szablonów powiadomień SMS/Email w systemie 
  KlikKlima. Zapewnia spójność z centralnym słownikiem powiadomień 
  i procesami biznesowymi (lejek sprzedażowy, serwisy, reklamacje).
---

# Notification Template (Tworzenie Szablonów Powiadomień)

## Kiedy używać
Aktywuj ten skill za każdym razem, gdy zadanie wymaga dodania nowego typu powiadomienia SMS lub Email do systemu.

## Procedura

### 1. Przeczytaj źródła prawdy
- `turborepo/docs/architecture/notification_definitions.md` — centralny słownik wszystkich powiadomień z wyzwalaczami, kanałami i adresatami.
- `turborepo/docs/architecture/b2b_funnel_process.md` — przepływ lejka sprzedażowego.
- `turborepo/docs/architecture/complaints_process.md` — przepływ reklamacji/usterek.

### 2. Zdefiniuj szablon
Każdy nowy szablon wymaga określenia:
- **`trigger_event`**: Nazwa zdarzenia wyzwalającego (np. `STATUS_2_AUDITOR`, `CREW_EN_ROUTE`).
- **`channel`**: Kanał dostarczenia (`SMS`, `EMAIL` lub oba).
- **`adresat`**: Kto otrzymuje powiadomienie (`Klient`, `Audytor`, `Monter`, `Dyspozytor`).
- **`subject`**: Temat (tylko dla Email).
- **`body_template`**: Treść z dynamicznymi zmiennymi.

### 3. Zmienne dynamiczne
Używaj następujących zmiennych w treści szablonu:
- `{{imie}}` — imię adresata
- `{{data}}` — data zdarzenia (np. data audytu, data montażu)
- `{{godzina}}` — godzina zdarzenia
- `{{link}}` — link do akcji (np. zmiana terminu, opłacenie oferty, rezerwacja)
- `{{adres}}` — adres instalacji/serwisu
- `{{numer_zlecenia}}` — numer referencyjny leadu/zlecenia

### 4. Zaktualizuj słownik
Po zdefiniowaniu nowego szablonu, dodaj wpis do tabeli w `turborepo/docs/architecture/notification_definitions.md` z numerem porządkowym, zdarzeniem, kanałem, adresatem, skrótem treści i źródłem (lejek/serwis/reklamacja).

### 5. Implementacja w bazie
Dodaj rekord do tabeli `message_templates` w Prisma zgodnie z modelem w `schema.prisma`.
