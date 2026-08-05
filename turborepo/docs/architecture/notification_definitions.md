# Słownik Definicji Powiadomień (Notification Definitions)

Ten dokument stanowi **centralny rejestr** wszystkich powiadomień SMS i Email w systemie KlikKlima. Skill `notification-template` odwołuje się do tego pliku przy tworzeniu nowych szablonów. Każda zmiana w procesach biznesowych (`b2b_funnel_process.md`, `complaints_process.md`) musi być odzwierciedlona poniżej.

## Legenda kanałów
- 📱 SMS
- 📧 Email
- 📱📧 Oba kanały

## Legenda adresatów
- 👤 Klient
- 🔧 Audytor / Serwisant
- 📋 Dyspozytor

---

## Lejek Sprzedażowy (B2B Funnel)

| # | Zdarzenie Wyzwalające | Typ Wyzwalacza | Kanał | Adresat | Szablon Treści | Zmienne |
|---|---|---|---|---|---|---|
| N1 | Przypisanie audytora (Etap 2) | Status | 📱📧 | 👤 | „Przydzielono inżyniera do Twojego zgłoszenia. Będzie kontakt w celu umówienia terminu!" | `{{imie}}`, `{{numer_zlecenia}}` |
| N2 | 24h przed audytem | Czasowy (CRON) | 📱📧 | 👤 | „Jutro o {{godzina}} zaplanowany jest audyt pod adresem {{adres}}. Chcesz zmienić termin? {{link}}" | `{{imie}}`, `{{godzina}}`, `{{adres}}`, `{{link}}` |
| N3 | Audytor wyrusza (GPS) | Geolokalizacja | 📱 | 👤 | „Audytor jest już w drodze do Ciebie! Szacowany czas dojazdu: ~{{eta}} min." | `{{imie}}`, `{{eta}}` |
| N4 | Wycena gotowa (Etap 3) | Status | 📧 | 👤 | „Twoja wycena jest gotowa. Kliknij, aby przejrzeć i opłacić: {{link}}" | `{{imie}}`, `{{link}}`, `{{total_price}}` |
| N5 | Wysyłka sprzętu (Etap 6) | Status | 📱📧 | 👤 | „Sprzęt został wysłany kurierem. Numer przesyłki: {{numer_przesylki}}" | `{{imie}}`, `{{numer_przesylki}}` |
| N6 | Sprzęt dostarczony (Etap 7) | Status | 📱📧 | 👤 | „Sprzęt dostarczony pod {{adres}}. Oczekuj na ekipę monterską." | `{{imie}}`, `{{adres}}` |
| N7 | 24h przed montażem | Czasowy (CRON) | 📱📧 | 👤 | „Jutro o {{godzina}} zaplanowany jest montaż. Chcesz zmienić termin? {{link}}" | `{{imie}}`, `{{godzina}}`, `{{adres}}`, `{{link}}` |
| N8 | Ekipa wyrusza (GPS) | Geolokalizacja | 📱 | 👤 | „Ekipa monterska jest już w drodze! Szacowany czas dojazdu: ~{{eta}} min." | `{{imie}}`, `{{eta}}` |
| N9 | Instalacja zakończona (Etap 9) | Status | 📧 | 👤 | „Montaż zakończony! W załączeniu: Karta Gwarancyjna, Protokół Zdawczo-Odbiorczy, Faktura." | `{{imie}}`, `{{numer_zlecenia}}` |
| N9a | Instalacja zakończona — II etap (opcjonalnie) | Status | 📧 | 👤 | „Pierwszy etap montażu zakończony. Zarezerwuj termin na II etap: {{link}}" | `{{imie}}`, `{{link}}` |

---

## Serwisy Gwarancyjne (Cykl Posprzedażowy)

| # | Zdarzenie Wyzwalające | Typ Wyzwalacza | Kanał | Adresat | Szablon Treści | Zmienne |
|---|---|---|---|---|---|---|
| N10 | X dni przed serwisem | Czasowy (CRON) | 📱📧 | 👤 | „Zbliża się termin corocznego przeglądu Twojej klimatyzacji. Zarezerwuj termin: {{link}}" | `{{imie}}`, `{{link}}`, `{{data}}` |
| N11 | Przydzielenie serwisanta | Status | 📱📧 | 👤 | „Przydzielono serwisanta do przeglądu Twojej instalacji." | `{{imie}}`, `{{numer_zlecenia}}` |
| N12 | 24h przed serwisem | Czasowy (CRON) | 📱📧 | 👤 | „Jutro o {{godzina}} zaplanowany jest przegląd. Potwierdź termin lub zmień: {{link}}" | `{{imie}}`, `{{godzina}}`, `{{link}}` |
| N13 | Serwisant wyrusza (GPS) | Geolokalizacja | 📱 | 👤 | „Serwisant jest już w drodze!" | `{{imie}}`, `{{eta}}` |
| N14 | Serwis wykonany | Status | 📧 | 👤 | „Przegląd zakończony. W załączeniu: Protokół Zdawczo-Odbiorczy po serwisie + Faktura." | `{{imie}}`, `{{numer_zlecenia}}` |

---

## Reklamacje i Usterki

| # | Zdarzenie Wyzwalające | Typ Wyzwalacza | Kanał | Adresat | Szablon Treści | Zmienne |
|---|---|---|---|---|---|---|
| N15 | Zgłoszenie usterki przyjęte | Status | 📱📧 | 👤 | „Twoje zgłoszenie zostało przyjęte. Zarezerwuj termin wizyty serwisowej: {{link}}" | `{{imie}}`, `{{link}}`, `{{numer_zlecenia}}` |
| N16 | Przydzielenie serwisanta (usterka) | Status | 📱📧 | 👤 | „Przydzielono serwisanta do Twojego zgłoszenia." | `{{imie}}`, `{{numer_zlecenia}}` |
| N17 | Serwisant w drodze (usterka) | Geolokalizacja | 📱 | 👤 | „Serwisant jest już w drodze!" | `{{imie}}`, `{{eta}}` |
| N18 | Naprawa zakończona | Status | 📧 | 👤 | „Naprawa zakończona. W załączeniu Protokół. [Faktura dołączona jeśli naprawa pogwarancyjna]" | `{{imie}}`, `{{numer_zlecenia}}` |

---

## Powiadomienia Wewnętrzne (Pracownicy)

| # | Zdarzenie Wyzwalające | Typ Wyzwalacza | Kanał | Adresat | Szablon Treści | Zmienne |
|---|---|---|---|---|---|---|
| I1 | Nowy lead w systemie | Status | 📧 | 📋 | „Nowe zgłoszenie #{{numer_zlecenia}} od {{imie}} w lokalizacji {{adres}}" | `{{numer_zlecenia}}`, `{{imie}}`, `{{adres}}` |
| I2 | Klient opłacił wycenę | Status | 📱📧 | 📋 | „Klient {{imie}} opłacił wycenę #{{numer_zlecenia}}. Zamów sprzęt." | `{{imie}}`, `{{numer_zlecenia}}`, `{{total_price}}` |
| I3 | Przypisanie zadania do ekipy | Status | 📱 | 🔧 | „Nowe zadanie: montaż pod {{adres}} w dniu {{data}} o {{godzina}}." | `{{adres}}`, `{{data}}`, `{{godzina}}` |
