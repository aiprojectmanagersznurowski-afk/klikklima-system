# Plan kolejnych zadań i status wdrożeń — stan na 2026-09-12

> **Główny rejestr backlogu i synchronizacja Trello:** zobacz [docs/BACKLOG.md](../BACKLOG.md)  
> **Tablica Trello:** [KlikKlima - Backlog Produktów](https://trello.com/b/9DCBpyzd/klikklima-backlog-produkt%C3%B3w)

---

## 🟢 Zrealizowane z poprzednich wydań (DONE)

Wszystkie pozycje poniżej zostały zaimplementowane, wdrożone w bazie i zweryfikowane testami:

1. **`SEC-READ-GATES` (byłe P0):** Autoryzacja odczytów we wszystkich akcjach (`getCustomers`, `installations`, `services`, `incidents`, `crews`, `auditors`). Przeniesione do Zrobione na Trello.
2. **`check-types` w CI/CD (byłe P2.1):** Dodano skrypt `check-types` w monorepo i pakietach, bramka sprawdza kompilację TypeScript.
3. **`LOGISTICS-SHIPPING-EFFECTS` Faza B i C (byłe P1):** Kolejka powiadomień `notification_queue`, obsługa wysyłki, bypass i rollback zintegrowane w logistyce.
4. **`SEC-AUDIT-LOG`: Historyzacja:** Niezmienne wpisy `AuditLog`, audytowanie ról, usunięć i ręcznych zmian statusu.
5. **`CRM-PROJECT-NUMBER`:** Sekwencyjny numer projektu (`L-000123`).
6. **`CRM-CLIENT-ANONYMIZE-RODO`:** Anonimizacja klientów z zachowaniem integralności bazy.
7. **`CRM-KARTOTEKI`:** Kartoteki audytorów i ekip z obsługą certyfikatów F-Gaz i SEP.
8. **`FLD-CALENDAR-FOUNDATION`:** Podstawy kalendarza, koszyki czasu wizyt, deklaracje dostępności i atomowe rezerwacje slotów.

---

## 🚀 Zadania Aktywne w Najbliższych Sprintach

1. **Sprint 1 (Domknięcie Lejka B2C & B2B):**
   - `B2C-BOOKING-FLOW` — Atomowa rezerwacja terminu audytu przez klienta na Landing Page.
   - `FNL-E2-E3` — Auto-transition leada po wysłaniu wyceny przez audytora.
   - `FNL-E3-E4` — Akceptacja wyceny online i rezerwacja terminu montażu.
   - `FNL-E4-E5` — Przypisanie ekipy i zlecenie wysyłki sprzętu (E5 Hurtownia).

2. **Sprint 2 (Logistyka, Realizacja & Powiadomienia):**
   - `NTF-GATEWAY` — Integracja SMSAPI i e-mail z obsługą okna 8:00–18:00.
   - `FNL-E6-E7` — Webhook kuriera doręczającego sprzęt.
   - `FNL-E7-E8` — Zamknięcie montażu i automatyczny termin serwisu (+1 rok).
   - `CRM-SRV-TRIGGER` — Nocny cron przypomnień o serwisach gwarancyjnych (N10).

3. **Sprint 3 (Obsługa Zgłoszeń i Aplikacja Mobilna):**
   - `CRM-UST-AC1` — Zgłoszenia awarii i usterki z priorytetem Krytyczny (SLA 48h).
   - `FLD-APP-PWA` — Dedykowana aplikacja terenowa PWA dla wykonawców.
   - `CRM-KLI-SEARCH` — Globalna wyszukiwarka klientów i Karta 360.
