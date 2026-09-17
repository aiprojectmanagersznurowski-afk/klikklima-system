# Field App — Dedykowana Aplikacja Mobilna (PWA) dla Wykonawców

> **Identyfikator zadania Trello:** `FLD-APP-PWA` & `FLD-SPEC-CORE`  
> **Kategoria:** Field App (Aplikacja Terenowa)  
> **Status:** DO WDROŻENIA (Pakiet 4 Roadmapy GTM)  
> **Szacowany czas prac:** 28–34 roboczogodziny  
> **Główna specyfikacja architektoniczna:** [`docs/architecture/FIELD-APP-PLAN.md`](../architecture/FIELD-APP-PLAN.md)

---

## 1. Koncepcja i Stos Technologiczny

Field App powstaje jako lekka, responsywna aplikacja **Progressive Web App (PWA)** zoptymalizowana pod urządzenia mobilne (smartfony i tablety z Androidem i iOS), współdzieląca domenę i komponenty w monorepo Next.js (`apps/field-pwa` lub sekcja `/field` w aplikacji webowej):
- **Role użytkowników:**
  1. `AUDITOR` — Audytor techniczno-handlowy (wizyta przed sprzedażą, pomiary, wycena, umowa, zaliczka),
  2. `INSTALLER` — Reprezentant certyfikowanej ekipy monterskiej (realizacja zlecenia, checklista, zdjęcia, protokół odbioru).

---

## 2. Kluczowe Wymagania Funkcjonalne (zgodne z ustaleniami terenowymi N1–N19)

### 2.1 Moduł Audytora
1. **Skrócona ścieżka wprowadzania leada (N1):** dla klientów dzwoniących bezpośrednio, natychmiastowe utworzenie zgłoszenia i rezerwacja slotu,
2. **Notatki i szkice (N3, N4):** możliwość pisania notatek oraz rysowania adnotacji na zdjęciach (strzałki, kwadraty z wymiarami, trasa rur),
3. **Katalog urządzeń na tablecie (N5):** cyfrowe karty produktów pokazywane klientowi podczas rozmowy,
4. **Wariantowość oferty (N6, N7):** przygotowanie 1 do 3 wariantów (np. budżetowy, standardowy, premium),
5. **Elektroniczny podpis umowy (N8) i płatność zaliczki (N9, N10):** podpisanie rysikiem na tablecie lub wysyłka linku na e-mail klienta.

### 2.2 Moduł Montera
1. **Jedno konto per ekipa (N11):** tylko wyznaczony lider ekipy loguje się do systemu,
2. **Przycisk „Start pracy / W drodze” (N12):** punktowe zdarzenie rejestrujące rozpoczęcie realizacji i powiadamiające klienta smsem o zbliżającym się dojeździe,
3. **Checklista przedmontażowa (N15):** weryfikacja narzędzi, pokrowców na buty, odkurzacza z filtrem HEPA i identyfikatorów,
4. **Wymóg dokumentacji zdjęciowej (K6):** 1 zdjęcie na każdą jednostkę wewnętrzną + jednostka zewnętrzna + odpływ skroplin + elewacja,
5. **Cyfrowy protokół odbioru (N16):** wpisanie parametrów próżni i próby azotowej, podbicie pieczęci i podpis klienta na ekranie.

---

## 3. Kolejność Realizacji
1. **Etap 1:** Fundamenty UI/PWA, autoryzacja kont i widok listy dzisiejszych zleceń,
2. **Etap 2:** Ścieżka montera (checklista, aparat z kompresją zdjęć, protokół odbioru),
3. **Etap 3:** Ścieżka audytora (kalkulator doboru mocy, generator wyceny, umowa i zaliczka).
