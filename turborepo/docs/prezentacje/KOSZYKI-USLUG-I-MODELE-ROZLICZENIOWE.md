# KlikKlima — Koszyki Usług, Architektura Harmonogramu i Modele Rozliczeniowe

> **Status:** Dokumentacja referencyjna architektury biznesowo-technologicznej  
> **Projekt:** System Cyfrowy KlikKlima  
> **Autorzy:** Michał Sznurowski (CTO / Head of Product) & Piotr (COO / Head of Operations)  
> **Data opracowania:** 17 września 2026 r.  
> **Kluczowe moduły w kodzie:**  
> - Baza danych: `packages/database/prisma/schema.prisma` (`model VisitDurationBasket`)  
> - Migracja bazowa: `supabase/migrations/20260910100000_fld_calendar_foundation.sql`  
> - Silnik rezerwacji i slotów: `packages/scheduling/src/create-booking.ts`  
> - Logika wyboru w B2B CRM: `apps/b2b-web/src/lib/schedule/basket-select.ts`  
> - Wymaganie domenowe: `FLD-QUOTE-BASKET-SELECT` (Work Order: `docs/workorders/FLD-QUOTE-BASKET-SELECT.md`)

---

## 1. Wprowadzenie i Geneza Biznesowa

W tradycyjnej branży instalacji klimatyzacji (HVAC) wyceny i rozliczenia wykonawców cechuje skrajna uznaniowość i chaos organizacyjny:
* Monterzy po fakcie deklarują: *„zeszło nam 7 godzin zamiast 4, bo ściana była twarda, więc poprosimy o 600 zł dopłaty”*,
* Klienci słyszą ogólnikowe: *„wycena na miejscu, ostateczny koszt zależy od czasu prac”*, co obniża zaufanie i konwersję,
* Firma instalacyjna mrozi własny kapitał obrotowy w magazynie urządzeń, a marża na zleceniu staje się loterią.

W ekosystemie KlikKlima ten problem został wyeliminowany poprzez wprowadzenie **słownika koszyków usług (`VisitDurationBasket`)**. 

**Koszyk w KlikKlima to nierozerwalna jednostka technologiczno-rozliczeniowa**, która w jednym obiekcie systemowym wiąże:
1. **Czas trwania w harmonogramie** (precyzyjnie w minutach: 90, 120, 240, 480 min),
2. **Przypisaną pulę wykonawców** (Audytorzy `AUDITOR` vs Ekipy monterskie `CREW`),
3. **Specyfikację technologiczną instalacji** (Single-Split, Multi-Split, stan surowy etap I / etap II, serwis, naprawa usterki),
4. **Czterostronny model finansowy** (cena dla klienta B2C, zaliczka na sprzęt JIT, taryfikator podwykonawcy B2B, gwarantowana marża spółki).

---

## 2. Oficjalny Słownik Koszyków w Systemie (`visit_duration_baskets`)

Baza danych zawiera 7 ściśle zdefiniowanych, stałych koszyków. Etykiety prezentowane użytkownikom mogą być modyfikowane w panelu konfiguracyjnym B2B (`/settings/calendar`), jednak **kody techniczne (`code`) są niezmienne i stabilne architektonicznie**:

| Kod koszyka (`code`) | Etykieta Biznesowa (`label_pl`) | Czas trwania (`duration_minutes`) | Pula zasobów (`pool`) | Rola i Zakres Technologiczny |
| :--- | :--- | :---: | :---: | :--- |
| `AUDIT` | **Audyt techniczny** | **120 min** (2 h) | `AUDITOR` | Wizyta u klienta przed zawarciem umowy: pomiary pomieszczeń, weryfikacja nośności ścian, zaplanowanie trasy freonowej i odpływu skroplin. |
| `INSTALL_SMALL` | **Montaż mały (1 jednostka)** | **240 min** (4 h / pół dnia) | `CREW` | Standardowa instalacja typu Single-Split w mieszkaniu lub biurze (1 jednostka wewnętrzna + 1 jednostka zewnętrzna). |
| `INSTALL_STANDARD` | **Montaż standardowy (2–3 jedn.)** | **480 min** (8 h / cały dzień) | `CREW` | Złożona instalacja typu Multi-Split (2 do 3 jednostek wewnętrznych na jeden agregat zewnętrzny w domu lub dużym apartamencie). |
| `INSTALL_PHASE_1` | **Montaż dwuetapowy — etap I** | **480 min** (8 h / cały dzień) | `CREW` | Stan deweloperski / surowy: kucie bruzd, ułożenie instalacji chłodniczej, zasilania, odpływów grawitacyjnych/pompek przed tynkami i wylewkami. |
| `INSTALL_PHASE_2` | **Montaż dwuetapowy — etap II** | **240 min** (4 h / pół dnia) | `CREW` | Po zakończeniu prac wykończeniowych (ściany pomalowane): powieszenie jednostek, próba ciśnieniowa azotem, próżnia, rozruch i przeszkolenie klienta. |
| `SERVICE` | **Serwis (przegląd okresowy)** | **90 min** (1,5 h) | `CREW` | Coroczny przegląd gwarancyjny: odgrzybianie parownika, czyszczenie filtrów, pomiar ciśnień, test szczelności (główne źródło powtarzalnego MRR). |
| `INCIDENT` | **Usterka (naprawa awaryjna)** | **120 min** (2 h) | `CREW` | Zgłoszenie reklamacyjne lub awaria w standardzie SLA 48h: diagnoza elektroniki, wymiana podzespołów, uzupełnienie czynnika chłodniczego. |

---

### Świadoma Decyzja Architektoniczna: Brak Koszyka „Montaż Duży = 2 Dni z Rzędu”

W pierwotnej koncepcji rozważano koszyk *„Montaż duży = 2 dni”*. Został on **świadomie i definitywnie odrzucony** na poziomie fundamentów kalendarza (`supabase/migrations/20260910100000_fld_calendar_foundation.sql`):
* Wymuszenie znalezienia dwóch sąsiadujących dni roboczych (np. wtorek i środa) u tej samej ekipy drastycznie komplikuje algorytm wyszukiwania wolnych slotów i paraliżuje elastyczność kalendarza,
* W praktyce rynkowej duży montaż (4+ jednostki) to niemal zawsze inwestycja deweloperska lub generalny remont. Realizuje się go jako **montaż dwuetapowy** (`INSTALL_PHASE_1` + `INSTALL_PHASE_2`), gdzie odstęp między etapami wynosi od kilkunastu dni do kilku miesięcy,
* Dzięki temu silnik slotów operuje wyłącznie na blokach **maksymalnie jednodniowych (480 min)**, co gwarantuje 100% determinizm i brak konfliktów terminowych.

---

## 3. Czterostronny Model Rozliczeniowy wokół Koszyka

Koszyk w systemie KlikKlima jest zwornikiem łączącym cztery strony transakcji gospodarczej:

```
                                ANATOMIA KOSZYKA ROZLICZENIOWEGO
   ┌─────────────────────────────────────────────────────────────────────────────────────────┐
   │                                   KOSZYK TECHNOLOGICZNY                                 │
   │                        (np. INSTALL_STANDARD: 480 min / Pula CREW)                      │
   └────────────────────────────────────────────┬────────────────────────────────────────────┘
                                                │
             ┌──────────────────────────────────┼──────────────────────────────────┐
             ▼                                  ▼                                  ▼
   1. DLA KLIENTA (B2C)              2. DLA HURTOWNI (COGS)            3. DLA PODWYKONAWCY (B2B)
   • Transparentna cena ryczałtowa   • Zakup klimatyzatorów z rabatem  • Sztywny taryfikator za koszyk
   • Zaliczka online 40–50% (PayU)     B2B min. 35–45% katalogu        • Płatność TYLKO za protokół
   • Płatność reszty po odbiorze     • W 100% finansowany z zaliczki     i 4 zdjęcia w Field App
             │                                  │                                  │
             └──────────────────────────────────┼──────────────────────────────────┘
                                                │
                                                ▼
                                  4. DLA SPÓŁKI KLIKKLIMA (ZYSK)
                                  • Zablokowana marża brutto: 25–35%
                                  • Ujemny cykl konwersji gotówki (zero magazynu)
                                  • Brak ryzyka dopłat za „dodatkowe godziny”
```

### 1. Strona Klienta (Cennik B2C i Doświadczenie Zakupowe)
* Klient wybiera konfigurację w portalu webowym lub otrzymuje ofertę po audycie. 
* Cena za usługę montażu jest powiązana ze zdefiniowanym koszykiem i prezentowana jako **kwota ryczałtowa (All-Inclusive)**.
* Klient ma gwarancję, że cena nie wzrośnie z powodu przedłużających się prac monterskich.

### 2. Strona Łańcucha Dostaw (Model Zaliczkowy i Ujemny Cykl Konwersji)
* W momencie akceptacji oferty opartej o dany koszyk, system generuje żądanie wpłaty **zaliczki w wysokości 40–50%**.
* Wpłacona zaliczka natychmiastowo pokrywa w 100% koszt zakupu urządzeń w hurtowni HVAC (model dostaw Just-in-Time).
* **Zasada samofinansowania:** Spółka nie mrozi ani złotówki kapitału własnego w zakup urządzeń, a sprzęt trafia z hurtowni bezpośrednio do rąk montażystów w dniu instalacji.

### 3. Strona Podwykonawców B2B (Sztywny Taryfikator Wynagrodzeń)
* Zewnętrzne ekipy montażowe **nie są rozliczane według uznaniowych stawek godzinowych**.
* W umowie podwykonawczej obowiązuje **sztywny taryfikator stawek powiązany z kodami koszyków**:
  * Za realizację koszyka `INSTALL_SMALL` ekipa otrzymuje stałą kwotę ryczałtową (np. *X PLN*),
  * Za `INSTALL_STANDARD` otrzymuje *Y PLN*,
  * Za etapy deweloperskie `INSTALL_PHASE_1` i `INSTALL_PHASE_2` odpowiednio *Z1 PLN* i *Z2 PLN*.
* **Warunek konieczny wypłaty wynagrodzenia:** Środki dla ekipy są zwalniane w panelu B2B wyłącznie po wygenerowaniu cyfrowego protokołu odbioru podpisanego przez klienta oraz wgraniu do systemu **4 obowiązkowych zdjęć standardu KlikKlima** (jednostka wewnętrzna z korytkiem, jednostka zewnętrzna z podkładkami wibroizolacyjnymi, manometry z próby próżniowej/szczelności, uporządkowane stanowisko pracy).

### 4. Strona Spółki KlikKlima (Gwarancja Matematyczna Marży)
Równanie marży na każdym zleceniu ma postać deterministyczną:

$$\text{Marża Brutto Spółki} = \text{Cena Koszyka B2C} - \text{Koszt Zakupu w Hurtowni (rabat B2B)} - \text{Stawka Ekipy z Taryfikatora}$$

Ponieważ wszystkie trzy składniki wynikają z zablokowanych reguł koszyka, **ryzyko spadku marży poniżej progu rentowności (25–35%) wynosi zero**.

---

## 4. Architektura Technologiczna w Kodzie Systemu

### A. Model Danych w Bazie (`schema.prisma`)

```prisma
model VisitDurationBasket {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  code            String    @unique            // np. 'INSTALL_STANDARD'
  labelPl         String    @map("label_pl")   // 'Montaż standardowy (2–3 jednostki)'
  durationMinutes Int       @map("duration_minutes") // 480 (zawsze minuty, nigdy float)
  pool            String                       // 'AUDITOR' | 'CREW'
  isActive        Boolean   @default(true) @map("is_active")
  sortOrder       Int       @default(0)    @map("sort_order")
  createdAt       DateTime  @default(dbgenerated("timezone('utc'::text, now())")) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime  @default(dbgenerated("timezone('utc'::text, now())")) @updatedAt @map("updated_at") @db.Timestamptz(6)

  bookings        Booking[]

  @@map("visit_duration_baskets")
}
```

### B. Kluczowe Reguły Architektoniczne w Kodzie:
1. **Brak literałów czasu trwania w kodzie aplikacji:**  
   Zabrania się zaszywania na sztywno czasów trwania wizyt (np. `const DURATION = 240`) w logice TypeScript. Czas trwania jest zawsze pobierany relacją z rekordu `VisitDurationBasket`.
2. **Wyliczanie końca wizyty w silniku slotów:**  
   W `packages/scheduling/src/create-booking.ts`:
   $$\text{scheduledEnd} = \text{startAt} + \text{basket.durationMinutes}$$
   Data końcowa wizyty jest utrwalana w tabeli `bookings` w momencie rezerwacji i nie ulega zmianie, nawet jeśli administrator zmieni konfigurację koszyka w przyszłości.
3. **Pula wykonawców wynika bezpośrednio z koszyka:**  
   Parametr `resourceKind` (`AUDITOR` vs `CREW`) nie jest wprowadzany ręcznie przez użytkownika — silnik rezerwacji automatycznie wymusza pulę na podstawie pola `basket.pool`.
4. **Wycofanie koszyka bez niszczenia historii:**  
   Flaga `isActive = false` uniemożliwia tworzenie nowych rezerwacji na dany koszyk, ale zachowuje pełną spójność historycznych zleceń i audytów finansowych.

---

## 5. Podział Odpowiedzialności Wspólników (CTO vs COO)

| Obszar | Michał Sznurowski (CTO / Technologia) | Piotr (COO / Operacje i Rynek) |
| :--- | :--- | :--- |
| **Definicja i Silnik** | Architektura tabeli w Prisma, trigger integralności puli w SQL, silnik slotów, API tworzenia rezerwacji i obsługa w panelu B2B. | Weryfikacja operacyjna czasów trwania (czy 4h na Single-Split i 8h na Multi-Split sprawdzają się w warunkach drogowych i montażowych). |
| **Matematyka Finansowa** | Implementacja algorytmu kalkulatora wycen, podziału transz płatności i integracja webhooków bramki PayU. | **Dostarczenie twardych wartości taryfikatora:** wynegocjowanie stawek z ekipami za każdy koszyk, wywalczenie rabatów w hurtowniach (35–45%) i ustalenie cennika detalicznego. |
| **Egzekucja w Terenie** | Zabezpieczenie aplikacji Field App: wymóg wgrania 4 zdjęć i podpisu klienta przed możliwością zamknięcia protokołu. | **Nadzór nad dyspozytornią i odbiorami:** weryfikacja jakości zdjęć w CRM, pilnowanie standardów montażowych, rozliczanie podwykonawców wyłącznie w oparciu o zatwierdzone koszyki. |

---

*Dokument stanowi integralną część dokumentacji systemowej KlikKlima i stanowi załącznik referencyjny do modeli współpracy partnerskiej i umów podwykonawczych.*
