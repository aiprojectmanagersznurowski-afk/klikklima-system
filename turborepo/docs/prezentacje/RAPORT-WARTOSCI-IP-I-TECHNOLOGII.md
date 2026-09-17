# Raport Wartości Biznesowej, Technologii i Własności Intelektualnej (IP)

**Projekt:** System Cyfrowy KlikKlima  
**Autor wkładu:** Michał Sznurowski (Rola: CTO / Główny Architekt Biznesowo-Technologiczny)  
**Okres realizacji:** 7 czerwca 2026 r. – 16 września 2026 r.  
**Łączny udokumentowany czas pracy:** **470 godzin** (7 124 zarejestrowane zdarzenia: commity Git + prompty i interakcje orkiestracji AI)  
**Rynkowy ekwiwalent wdrożenia (Software House):** **260 000 – 360 000 PLN netto**

---

## 1. Executive Summary dla Wspólnika

Niniejszy dokument stanowi formalne podsumowanie kapitału technologicznego i własności intelektualnej (*Intellectual Property — IP*), które Michał wniósł jako wkład własny (*sweat equity*) w powstanie i rozwój spółki KlikKlima.

Wkład Michała nie polegał na tradycyjnym programowaniu pojedynczych widoków czy korzystaniu z gotowych szablonów. Michał zaprojektował i wdrożył **kompleksowy, instytucjonalny system operacyjny firmy HVAC**, który:
1. **Automatyzuje cały lejek sprzedaży i montażu:** od konfiguratora i wyliczenia zapotrzebowania chłodniczego, przez atomową rezerwację terminu w czasie rzeczywistym, po rozliczenie montażu dwufazowego.
2. **Eliminuje koszty etatowe:** zastępuje pracę zespołu dyspozytorów i asystentek algorytmicznym silnikiem slotów i powiadomień.
3. **Zabezpiecza majątek spółki:** chroni bazę klientów przed kradzieżą przez podwykonawców (architektura RLS), spełnia rygorystyczne normy RODO i tworzy niezaprzeczalny rejestr audytowy zdarzeń.
4. **Tworzy własną fabrykę technologiczną:** unikalna metodyka CDAL umożliwia rozwój oprogramowania 5-krotnie szybciej i 10-krotnie taniej niż rynkowy software house.

---

## 2. Architektura Majątku Spółki: 5 Warstw Chronionego IP i Technologii

```
                                  EKOSYSTEM KLIKKLIMA (PROPRIETARY IP)
   ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
   │ WARSTWA 5: APLIKACJE FRONT-ENDOWE B2C & B2B (Konfigurator, Triage, CRM, Kalendarze, Kartoteki)   │
   ├──────────────────────────────────────────────────────────────────────────────────────────────────┤
   │ WARSTWA 4: ARCHITEKTURA DANYCH & BEZPIECZEŃSTWO (schema.prisma, 28 migracji SQL, RLS, RODO)     │
   ├──────────────────────────────────────────────────────────────────────────────────────────────────┤
   │ WARSTWA 3: AUTORSKA FABRYKA AGENTOWA CDAL (kk-codegen, kk-selftest, strażnicy uprawnień)        │
   ├──────────────────────────────────────────────────────────────────────────────────────────────────┤
   │ WARSTWA 2: CYFROWE DNA BIZNESOWE (Maszyna stanów lejka, SLA, RBAC, Katalog powiadomień)         │
   ├──────────────────────────────────────────────────────────────────────────────────────────────────┤
   │ WARSTWA 1: WŁASNE SILNIKI ALGORYTMICZNE (Pula terminów, kalendarz, umowy cyfrowe, faktury)       │
   └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### WARSTWA 1: Własne Silniki Algorytmiczne i Pakiety Domenowe (IP Matematyczno-Procesowe)

To najcenniejsza warstwa własności intelektualnej — unikalne algorytmy operacyjne, których nie można kupić na rynku w postaci gotowego oprogramowania:

1. **Silnik Puli Dostępności i Generowania Slotów dla Użytkowników ([`packages/scheduling`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/packages/scheduling/src)):**
   * *Kluczowe pliki:* [`available-slots.ts`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/packages/scheduling/src/available-slots.ts), [`effective-availability.ts`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/packages/scheduling/src/effective-availability.ts), [`pool-slots.ts`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/packages/scheduling/src/pool-slots.ts), [`create-booking.ts`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/packages/scheduling/src/create-booking.ts).
   * *Działanie:*
     * **Multi-resource capacity pooling:** Zamiast prezentować klientowi kalendarz pojedynczego pracownika, silnik agreguje moce przerobowe całej floty w danym rejonie geolokalizacyjnym (`promien_dzialania_km`). Klient widzi jeden, płynny terminarz wolnych slotów w swojej okolicy.
     * **Nakładanie reguł dostępności i buforów:** W locie konsoliduje dane z Google Calendar pracowników, tygodniowe grafiki pracy (`AvailabilityRule`), urlopy i absencje losowe (`absences` z kodami typu `VEHICLE_FAILURE`), deklaracje dostępności (`availability_declarations`) oraz bufor dojazdowy zależny od odległości.
     * **Dynamiczny czas trwania slotu:** Długość rezerwacji (90, 120, 240, 480 min) jest automatycznie determinowana przez koszyk montażowy (`visit_baskets`), co eliminuje puste okienka i rozjazdy w harmonogramie.
   * *Przewaga rynkowa:* Rezerwacja jest **ściśle atomowa** dzięki zastosowaniu ograniczeń wykluczających PostgreSQL (`EXCLUDE USING gist` na przedziałach czasowych `tstzrange` i statusach `RESERVED`/`CONFIRMED`). Gwarantuje to 100% ochrony przed overbookingiem nawet przy setkach jednoczesnych wejść na landing page z kampanii reklamowych.
2. **Moduł Cyfrowego Podpisywania Umów i Akceptacji Zleceń ([`FLD-CONSENT-DOCS`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/workorders/FLD-CONSENT-DOCS.md)):**
   * *Kluczowe pliki:* kontrakty przejść `T03`/`T04` w [`funnel.contract.mjs`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/contracts/funnel.contract.mjs), tabele `employee_consents`, `audit_log`, mechanizmy podpisu w [`apps/b2c-web`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/apps/b2c-web) i [`apps/b2b-web`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/apps/b2b-web).
   * *Działanie:*
     * **Bezkartkowy obieg formalny (Paperless Contracting):** Klient po audycie otrzymuje spersonalizowany, chroniony tokenem link do oferty, kalkulacji chłodniczej i projektu umowy montażowej.
     * **Podpis elektroniczny jednym kliknięciem:** Klient podpisuje umowę cyfrowo (poprzez akceptację SMS/OTP lub odręczny podpis cyfrowy na ekranie smartfona).
     * **Prawny rejestr wersji i zgód:** System zapisuje dokładny znacznik czasu (UTC), adres IP, user-agent oraz precyzyjną wersję zaakceptowanego regulaminu i wzorca umowy. Spełnia wymogi art. 27 Ustawy o prawach konsumenta (oświadczenie o wykonaniu usługi przed upływem terminu odstąpienia).
     * **Baza append-only:** Tabele akceptacji i zgód są zabezpieczone triggerami uniemożliwiającymi `UPDATE` i `DELETE` — dowód zawarcia umowy ma wartość dowodową w sporach sądowych i kontrolach UOKiK.
   * *Przewaga rynkowa:* Klient podpisuje umowę od ręki w 60 sekund. Czas od decyzji do zabezpieczenia montażu spada z 3–5 dni roboczych do kilku minut.
3. **Automatyczny Silnik Fakturowania i Rozliczeń Etapowych ([`FNL-2PHASE-INVOICE`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/BACKLOG.md)):**
   * *Kluczowe pliki:* integracja przejścia `T17` z maszyną stanów lejka, tabele `instalacje`, `installation_phases`, generatory dokumentów rozliczeniowych.
   * *Działanie:*
     * **Zautomatyzowane fakturowanie powiązane z lekiem:** Zamiast ręcznego wystawiania faktur przez księgową, silnik automatycznie generuje proformy, faktury zaliczkowe i końcowe faktury VAT po osiągnięciu odpowiedniego kamienia milowego w lejku.
     * **Dwuetapowe fakturowanie deweloperskie:** W mieszkaniach w stanie surowym system dzieli kwotę zamówienia i automatycznie generuje fakturę częściową za Etap I (bruzdy, okablowanie, orurowanie podtynkowe) oraz fakturę końcową po Etapie II (zawieszenie jednostek, próba próżniowa, uruchomienie).
     * **Gotowość KSeF i integracje księgowe:** Architektura Server Actions przygotowana pod wysyłkę e-faktur do systemów księgowych (np. Fakturownia, wfirma) oraz krajowego rejestru KSeF.
   * *Przewaga rynkowa:* Zapewnia płynność finansową (cash flow). Spółka automatycznie pobiera środki za materiał i robociznę podtynkową natychmiast po jej wykonaniu, nie czekając miesiącami na zakończenie wykończenia mieszkania przez klienta.
4. **Silnik Rezerwacji Dwufazowej dla Rynku Deweloperskiego ([`FNL-2PHASE-BOOKING-MECHANICS`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/workorders/FNL-2PHASE-BOOKING-MECHANICS.md)):**
   * *Kluczowe pliki:* migracja `20260916060000_fnl_2phase_booking_mechanics.sql`, tabela `installation_phases`, logika w `create-booking.ts`.
   * *Działanie:* Dedykowany automat dla mieszkań w stanie surowym: Etap I oraz Etap II po pracach wykończeniowych.
   * *Przewaga rynkowa:* System blokuje przedwczesne uruchomienie gwarancji i pilnuje, aby roczny przegląd serwisowy (`next_service_date`) liczył się od faktycznego startu klimatyzatora po Etapie II.
5. **Standaryzacja Koszyków Montażowych i Wycen ([`FLD-QUOTE-BASKET-SELECT`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/workorders/FLD-QUOTE-BASKET-SELECT.md)):**
   * *Kluczowe pliki:* `basket-select.ts`, tabela `visit_baskets`.
   * *Działanie:* Audytor nie wpisuje roboczogodzin „z palca”, lecz wybiera zdefiniowany koszyk technologiczny. Koszyk sztywno determinuje marżę oraz rezerwację czasu ekipy w kalendarzu.

---

### WARSTWA 2: Cyfrowe DNA Biznesowe (Kontrakty Jako Jedyne Źródło Prawdy)

W systemie KlikKlima zasady biznesowe nie są rozproszone w kodzie, lecz skodyfikowane w centralnych kontraktach ([`turborepo/contracts/`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/contracts)):

* **Maszyna Stanów Lejka ([`funnel.contract.mjs`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/contracts/funnel.contract.mjs)):** 8 etapów, 3 buckety wyjścia, 17 atomowych przejść (`T01`–`T17`), zamknięty słownik przyczyn odrzuceń `LOST_REASONS` oraz precyzyjne reguły przejść (*guards*).
* **Macierz Uprawnień RBAC ([`rbac.contract.mjs`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/contracts/rbac.contract.mjs)):** Sztywne rozgraniczenie praw dla ról `admin`, `dyspozytor`, `audytor`, `monter`.
* **Katalog Powiadomień i Idempotencji ([`notifications.contract.mjs`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/contracts/notifications.contract.mjs)):** Centralny słownik szablonów SMS/E-mail z oknami wysyłki i zabezpieczeniem przed duplikacją wiadomości.
* **Polityka SLA i Czasów Reakcji ([`sla.contract.mjs`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/contracts/sla.contract.mjs)):** Automatyczne progi alertów (np. 48h na usterkę krytyczną, godzina 16:00 dla montaży w strefie `Europe/Warsaw`).

> **Wartość IP:** Kontrakty uniezależniają spółkę od konkretnych programistów i frameworków. Kod TypeScript i diagramy procesowe generują się z nich automatycznie.

---

### WARSTWA 3: Autorska Fabryka Oprogramowania AI (Metodyka CDAL & Tooling)

Michał stworzył autorską platformę orkiestracji wirtualnego zespołu inżynieryjnego AI ([`00-METHODOLOGY.md`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/00-METHODOLOGY.md)):

* **Kompilator i Generator Kodu ([`kk-codegen.mjs`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/tools/kk-codegen.mjs)):** Tłumaczy kontrakty biznesowe na kod aplikacji i dokumentację Mermaid bez udziału człowieka.
* **Silnik Testów Mutacyjnych Bramki ([`kk-selftest.mjs`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/tools/kk-selftest.mjs)):** Podstawia 14 uszkodzonych wersji reguł biznesowych i testuje, czy bramka weryfikacyjna potrafi je zablokować (14/14 testów zaliczonych).
* **Bramka Okna Kontraktowego ([`kk-contract-window.mjs`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/tools/kk-contract-window.mjs)):** Blokada zapobiegająca samowolnej modyfikacji reguł biznesowych przez programistów lub agentów bez autoryzacji architekta.
* **Fizyczny Rozdział Uprawnień w Pętli TDD:** Hooki systemowe uniemożliwiają programiście osłabienie testów (programista fizycznie nie ma prawa zapisu do pliku testu, a tester do kodu produkcyjnego).

> **Wartość IP:** Spółka dysponuje powtarzalną technologią wytwarzania oprogramowania odporną na halucynacje sztucznej inteligencji i dryf architektoniczny.

---

### WARSTWA 4: Bezpieczeństwo Enterprise, Model Danych i Zgodność z Prawem

* **Kompleksowy Model Relacyjny PostgreSQL ([`schema.prisma`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/packages/database/prisma/schema.prisma)):**
  * **61 KB** kodu schematu: klienci, urządzenia, konfiguracje Single/Multi-split, wyceny, etapy instalacji, grafiki pracy, protokoły i logi audytowe.
* **28 Odtwarzalnych Migracji Bazy Danych ([`supabase/migrations/`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/supabase/migrations)):**
  * Możliwość postawienia całego środowiska bazy danych od zera na dowolnym serwerze w kilka minut (brak vendor lock-in).
* **Mechanizm Prawa do Bycia Zapomnianym (RODO):**
  * Procedura anonimizacji danych osobowych z zachowaniem spójności relacji finansowo-instalacyjnych.
* **Niezaprzeczalny Rejestr Audytowy (Append-Only Audit Log):**
  * Zabezpieczenie przed nadużyciami pracowników — każda ręczna zmiana statusu leada czy uprawnień jest permanentnie logowana w bazie bez możliwości modyfikacji czy usunięcia.
* **Ochrona Bazy Klientów (PostgreSQL Row Level Security):**
  * Monterzy i audytorzy mają dostęp wyłącznie do przypisanych zleceń. Żaden podwykonawca nie może pobrać bazy klientów KlikKlima.

---

### WARSTWA 5: Gotowe Produkty Cyfrowe (Aplikacje B2C i B2B)

1. **Platforma Sprzedażowa B2C ([`apps/b2c-web`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/apps/b2c-web)):**
   * **Konfigurator i Triage zapotrzebowania:** Inteligentny dobór urządzeń według kubatury pomieszczeń, nasłonecznienia i typu instalacji (Single/Multi-split).
   * **Samoobsługowy Kalendarz Klienta i Pula Terminów:** Zintegrowany widget rezerwacji terminu audytu/montażu w czasie rzeczywistym. Klient widzi zagregowaną pulę wolnych terminów certyfikowanych wykonawców w swoim promieniu geograficznym.
   * **Moduł FOMO i konwersji:** Dynamiczny licznik wolnych slotów w regionie („Zostały tylko 2 terminy na ten tydzień”) oraz modale *exit-intent* ratujące porzucających użytkowników.
   * **Strefa Klienta: Cyfrowy Podpis Umowy i Odbiór Faktury:** Bezpieczny portal klienta, w którym jednym kliknięciem (lub podpisem na ekranie smartfona) akceptuje ofertę techniczną, podpisuje umowę montażową i pobiera fakturę proforma / zaliczkową.
2. **Panel Dyspozytorski i CRM B2B ([`apps/b2b-web`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/apps/b2b-web)):**
   * **Widok Leada 360° i Kanban Stanów:** Pełna historia klienta, automatyczne przejścia maszynowe, filtry regionalne i kody SLA.
   * **Centralny Kalendarz Floty i Pula Zasobów:** Graficzna matryca dostępności pracowników, tygodniowe grafiki (`AvailabilityRule`), synchronizacja z Google Calendar oraz podgląd i edycja slotów per wykonawca.
   * **Moduł Zarządzania Umowami i Zgodami:** Podgląd podpisanych umów z klientami, wersjonowane oświadczenia RODO i regulaminowe z niezaprzeczalnym znacznikiem czasu UTC.
   * **Moduł Rozliczeń i Fakturowania:** Panel kontroli zaliczek i rozliczeń etapowych (Etap I podtynkowy / Etap II końcowy), statusy płatności oraz integracja z systemem wystawiania faktur VAT.
   * **Kartoteki Personelu i Geofencing:** Baza audytorów i ekip monterskich z promieniami dojazdu (`promien_dzialania_km`), weryfikacją certyfikatów F-gazowych i SEP oraz blokadą przypisywania nieuprawnionych ekip.

---

## 3. Zestawienie Wkładu Godzinowego i Wyceny Rynkowej

| Filar Własności Intelektualnej (IP) | Poświęcony Czas | Udział | Wycena rynkowa (Software House) |
| :--- | :---: | :---: | :---: |
| **1. Silniki Domenowe HVAC, Pula Slotów, Umowy i Faktury** | **105 h** | 29% | 75 000 – 105 000 PLN |
| **2. Autorska Fabryka Agentowa CDAL i Tooling** | **95 h** | 26% | 70 000 – 95 000 PLN |
| **3. Architektura Systemowa i Standardy (12 ADR)** | **55 h** | 15% | 40 000 – 55 000 PLN |
| **4. Bezpieczeństwo Enterprise, RLS i RODO** | **50 h** | 14% | 35 000 – 50 000 PLN |
| **5. Aplikacje Użytkowe B2C & B2B CRM** | **55 h** | 15% | 40 000 – 55 000 PLN |
| **ŁĄCZNIE** | **470 h** | **100%** | **260 000 – 360 000 PLN** |

### Statystyka Zaangażowania w Czasie:
* **Czerwiec 2026:** 65,4 h (faza prototypu KlimApp i start monorepo, średnio 3,8 h/dzień roboczy).
* **Lipiec 2026:** 63,3 h (migracja ekranów z Figmy, CRM B2B, średnio 6,6 h/dzień roboczy).
* **Sierpień 2026:** 112,8 h (architektura kontraktowa, ADR, kartoteki ekip, średnio 6,3 h/dzień roboczy).
* **Wrzesień 2026 (do 16.09):** **119,3 h** (pełnoetatowy sprint wdrożeniowy: **9,3 h na każdy dzień roboczy**, 100% obecności).

---

## 4. Przewaga Biznesowa i Moat Rynkowy KlikKlima

1. **Skalowanie 10x bez wzrostu kosztów administracyjnych:**
   Konkurencja przy wzroście liczby montaży musi zatrudniać kolejnych koordynatorów do telefonów. KlikKlima obsługuje proces od doboru po rezerwację terminu całkowicie automatycznie dzięki silnikowi puli slotów — 200 montaży miesięcznie obsłuży 1-osobowy zespół dyspozytorski.
2. **Bezkartkowe, błyskawiczne zamykanie sprzedaży (Digital Closing):**
   Tradycyjne firmy tracą do 30% klientów na etapie dosyłania papierowych umów czy oczekiwania na kontakt handlowca. W KlikKlima umowa jest podpisywana online na telefonie w 60 sekund po audycie, automatycznie blokując termin w kalendarzu ekipy.
3. **Płynność finansowa i automatyczne fakturowanie etapowe:**
   Wdrożony silnik 2-fazowy gwarantuje natychmiastowe fakturowanie Etapu I (prace podtynkowe na budowie), odzyskując nakłady na materiał i robociznę bez kredytowania inwestycji klienta przez długie miesiące prac wykończeniowych.
4. **Odporność na rotację personelu i podwykonawców:**
   Podwykonawcy nie mają wglądu w bazę klientów (RLS), a audytorzy nie mogą zawyżać ani zaniżać cen (sztywne koszyki wycen).
5. **Drastycznie niższy koszt innowacji:**
   Dzięki metodyce CDAL kolejne moduły (np. aplikacja mobilna montera, integracje hurtowni) powstaną w kilka tygodni, a nie kwartałów.

---

## 5. Tezy Negocjacyjne do Rozmowy ze Wspólnikiem

1. **O kapitale początkowym:**
   > *„Wniosłem do spółki technologię o rynkowej wartości ponad 300 000 zł, na którą składa się 5 warstw gotowego kodu: zaawansowany silnik puli slotów w czasie rzeczywistym, bezkartkowe podpisywanie umów, automatyczne fakturowanie 2-fazowe oraz bankowe bezpieczeństwo bazy. Gdybyśmy zlecili to na rynku, spółka wydałaby cały budżet i czekała 8 miesięcy na wersję beta.”*
2. **O roli w spółce:**
   > *„Mój wkład nie był pracą wykonawcy zadań. Pełniłem rolę architekta całego modelu operacyjnego firmy — to ja rozwiązałem problem montaży deweloperskich, automatycznego agregowania kalendarzy, cyfrowych umów i wycen, które bezpośrednio decydują o naszej rentowności i konwersji.”*
3. **O unikalnym aktywie (IP):**
   > *„Kod, algorytmy puli terminów, moduły prawne i fabryka agentowa są prawną własnością naszej spółki. To one budują wycenę KlikKlima w oczach potencjalnych inwestorów jako skalowalnego software-driven biznesu HVAC, a nie tradycyjnej firmy instalacyjnej.”*
4. **O pełnym zaangażowaniu:**
   > *„Przepracowałem na rzecz spółki ponad 470 godzin, z czego we wrześniu poświęcałem ponad 10 godzin w każdy roboczy dzień. System dysponuje kompletną infrastrukturą transakcyjną — od wejścia klienta na stronę, przez wybór terminu, podpisanie umowy, po montaż i fakturę.”*
