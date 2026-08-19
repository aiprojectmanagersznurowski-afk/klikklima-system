# Słownik Definicji Powiadomień (Notification Definitions)

Ten dokument stanowi **centralny rejestr** wszystkich powiadomień SMS i Email w systemie KlikKlima. Skill `notification-template` odwołuje się do tego pliku przy tworzeniu nowych szablonów. Każda zmiana w procesach biznesowych (`b2b_funnel_process.md`) musi być odzwierciedlona poniżej.

## Legenda kanałów
- 📱 SMS
- 📧 Email
- 📱📧 Oba kanały

## Legenda adresatów
- 👤 Klient
- 🔧 Audytor / Serwisant
- 📋 Dyspozytor

---

## Lejek Sprzedażowy (B2B Funnel — 8 etapów + 2 buckety)

| # | Zdarzenie Wyzwalające | Typ Wyzwalacza | Kanał | Adresat | Szablon Treści | Zmienne |
|---|---|---|---|---|---|---|
| N1 | Przypisanie audytora (E1 → E2) | Status | 📱📧 | 👤 | „Przydzielono inżyniera do Twojego zgłoszenia. Będzie kontakt w celu umówienia terminu!" | `{{first_name}}`, `{{order_number}}` |
| N2 | 24h przed audytem | Czasowy (CRON) | 📱📧 | 👤 | „Jutro o {{time}} zaplanowany jest audyt pod adresem {{address}}. Chcesz zmienić termin? {{link}}" | `{{first_name}}`, `{{time}}`, `{{address}}`, `{{link}}` |
| N3 | Audytor wyrusza (GPS) | Geolokalizacja | 📱 | 👤 | „Audytor jest już w drodze do Ciebie! Szacowany czas dojazdu: ~{{eta}} min." | `{{first_name}}`, `{{eta}}` |
| N4 | Wycena gotowa (E2 → E3, auto-transition) | Status | 📧 | 👤 | „Twoja wycena jest gotowa. Kliknij, aby przejrzeć, zaakceptować i zarezerwować termin: {{link}}" | `{{first_name}}`, `{{link}}`, `{{total_price}}` |
| N5 | Wysyłka kurierem (E5 → E6) | Status | 📱📧 | 👤 | „Sprzęt został wysłany kurierem. Numer przesyłki: {{tracking_id}}" | `{{first_name}}`, `{{tracking_id}}` |
| N6 | 24h przed montażem | Czasowy (CRON) | 📱📧 | 👤 | „Jutro o {{time}} zaplanowany jest montaż. Chcesz zmienić termin? {{link}}" | `{{first_name}}`, `{{time}}`, `{{address}}`, `{{link}}` |
| N7 | Ekipa wyrusza (GPS) | Geolokalizacja | 📱 | 👤 | „Ekipa monterska jest już w drodze! Szacowany czas dojazdu: ~{{eta}} min." | `{{first_name}}`, `{{eta}}` |
| N8 | Instalacja zakończona (E7 → E8) | Status | 📧 | 👤 | „Montaż zakończony! W załączeniu: Karta Gwarancyjna, Protokół Zdawczo-Odbiorczy, Faktura." | `{{first_name}}`, `{{order_number}}` |
| N8a | Instalacja zakończona — II etap (opcjonalnie) | Status | 📧 | 👤 | „Pierwszy etap montażu zakończony. Zarezerwuj termin na II etap: {{link}}" | `{{first_name}}`, `{{link}}` |

### Powiadomienia bucketowe

| # | Zdarzenie Wyzwalające | Typ Wyzwalacza | Kanał | Adresat | Szablon Treści | Zmienne |
|---|---|---|---|---|---|---|
| N_REJECT | Wycena wygasła (E3 → Bucket: Odrzucone) | Automat (CRON 14 dni) | 📧 | 👤 | „Twoja wycena wygasła po 14 dniach. Jeśli nadal jesteś zainteresowany, skontaktuj się z nami: {{link}}" | `{{first_name}}`, `{{link}}`, `{{order_number}}` |
| N_ROLLBACK | Lead przeniesiony do Rollback (E4–E7 → Bucket) | Status | 📧 | 👤 | „Twoje zlecenie wymaga zmiany terminu. Zarezerwuj nowy termin montażu: {{link}}" | `{{first_name}}`, `{{link}}`, `{{order_number}}` |

---

## Serwisy Gwarancyjne (Cykl Posprzedażowy)

> **Uwaga:** Proces serwisów i usterek zostanie zdefiniowany w osobnym wątku. Poniższe definicje powiadomień zachowane jako draft.

| # | Zdarzenie Wyzwalające | Typ Wyzwalacza | Kanał | Adresat | Szablon Treści | Zmienne |
|---|---|---|---|---|---|---|
| N10 | X dni przed serwisem | Czasowy (CRON) | 📱📧 | 👤 | „Zbliża się termin corocznego przeglądu Twojej klimatyzacji. Zarezerwuj termin: {{link}}" | `{{first_name}}`, `{{link}}`, `{{date}}` |
| N11 | Przydzielenie serwisanta | Status | 📱📧 | 👤 | „Przydzielono serwisanta do przeglądu Twojej instalacji." | `{{first_name}}`, `{{order_number}}` |
| N12 | 24h przed serwisem | Czasowy (CRON) | 📱📧 | 👤 | „Jutro o {{time}} zaplanowany jest przegląd. Potwierdź termin lub zmień: {{link}}" | `{{first_name}}`, `{{time}}`, `{{link}}` |
| N13 | Serwisant wyrusza (GPS) | Geolokalizacja | 📱 | 👤 | „Serwisant jest już w drodze!" | `{{first_name}}`, `{{eta}}` |
| N14 | Serwis wykonany | Status | 📧 | 👤 | „Przegląd zakończony. W załączeniu: Protokół Zdawczo-Odbiorczy po serwisie + Faktura." | `{{first_name}}`, `{{order_number}}` |

---

## Reklamacje i Usterki



| # | Zdarzenie Wyzwalające | Typ Wyzwalacza | Kanał | Adresat | Szablon Treści | Zmienne |
|---|---|---|---|---|---|---|
| N15 | Zgłoszenie usterki przyjęte | Status | 📱📧 | 👤 | „Twoje zgłoszenie zostało przyjęte. Zarezerwuj termin wizyty serwisowej: {{link}}" | `{{first_name}}`, `{{link}}`, `{{order_number}}` |
| N16 | Przydzielenie serwisanta (usterka) | Status | 📱📧 | 👤 | „Przydzielono serwisanta do Twojego zgłoszenia." | `{{first_name}}`, `{{order_number}}` |
| N17 | Serwisant w drodze (usterka) | Geolokalizacja | 📱 | 👤 | „Serwisant jest już w drodze!" | `{{first_name}}`, `{{eta}}` |
| N18 | Naprawa zakończona | Status | 📧 | 👤 | „Naprawa zakończona. W załączeniu Protokół. [Faktura dołączona jeśli naprawa pogwarancyjna]" | `{{first_name}}`, `{{order_number}}` |

---

## Powiadomienia Wewnętrzne (Pracownicy)

| # | Zdarzenie Wyzwalające | Typ Wyzwalacza | Kanał | Adresat | Szablon Treści | Zmienne |
|---|---|---|---|---|---|---|
| I1 | Nowy lead w systemie | Status | 📧 | 📋 | „Nowe zgłoszenie #{{order_number}} od {{first_name}} w lokalizacji {{address}}" | `{{order_number}}`, `{{first_name}}`, `{{address}}` |
| I2 | Klient zaakceptował wycenę i zarezerwował termin (E3 → E4) | Status | 📱📧 | 📋 | „Klient {{first_name}} zaakceptował wycenę #{{order_number}} i zarezerwował termin. Przypisz ekipę." | `{{first_name}}`, `{{order_number}}`, `{{total_price}}` |
| I3 | Przypisanie zadania do ekipy | Status | 📱 | 🔧 | „Nowe zadanie: montaż pod {{address}} w dniu {{date}} o {{time}}." | `{{address}}`, `{{date}}`, `{{time}}` |
| I4 | Lead przeniesiony do Rollback | Status | 📧 | 📋 | „Lead #{{order_number}} przeniesiony do bucketu Rollback. Kalendarz ekipy zwolniony." | `{{order_number}}`, `{{first_name}}` |
