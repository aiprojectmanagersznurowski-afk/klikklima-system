# Zintegrowane Zestawienie Czasu Pracy i Wkładu Kapitałowego (Sweat Equity)
## Projekt Systemu Cyfrowego KlikKlima (Maj – Wrzesień 2026 r.)

**Autor wkładu:** Michał Sznurowski (Rola: CTO / Główny Architekt Biznesowo-Technologiczny)  
**Okres objęty audytem:** Maj 2026 r. – 16 września 2026 r.  
**Data generacji raportu:** 17 września 2026 r.  
**Dokumenty źródłowe:**  
1. *Zestawienie Czasu Pracy w Narzędziach Agentowych i Repozytorium* (`ZESTAWIENIE-CZASU-PRACY- agenci.md`)  
2. *Raport Estymacyjny: Zaangażowanie Koncepcyjne R&D* (`zestawienie czasu nad analiza.md`)

---

## 1. Executive Summary — Łączny Wymiar Wkładu

Niniejszy raport stanowi całościowe, zintegrowane podsumowanie nakładu pracy wniesionego przez Michała Sznurowskiego w rozwój technologii, architektury oraz procesów biznesowych spółki KlikKlima. Praca ta obejmowała dwa nierozłączne, wzajemnie uzupełniające się wymiary:

1. **Zaangażowanie Koncepcyjne i R&D (Maj – Wrzesień 2026):**
   * Badania nad architekturą systemową, analizy specyfiki branży HVAC, projektowanie schematów integracji AI (LLM, RAG), mapowanie procesów dyspozytorskich i instalatorskich oraz dobór stosu technologicznego.
   * **Łączny czas R&D:** **95 – 117 godzin** (wartość środkowa: **~106 godzin**).
2. **Bezpośrednia Realizacja Inżynieryjna i Orkiestracja Agentowa (Czerwiec – Wrzesień 2026):**
   * Praca w repozytoriach kodu (`KlimApp`, `klikklima-system`, `turborepo`), orkiestracja wirtualnego zespołu inżynieryjnego AI (Claude Code, Antigravity IDE) w metodyce CDAL, budowa kontraktów, silników rezerwacji, bezpieczeństwa bazy danych PostgreSQL oraz aplikacji B2C i B2B.
   * **Łączny czas inżynierii (Standard gap 90m):** **360,7 godzin** (wariant konserwatywny: **336,5 h**, wariant elastyczny: **388,2 h**).

```
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                    ŁĄCZNY WKŁAD PRACY MICHAŁA (MAJ – WRZESIEŃ 2026)                    │
   ├────────────────────────────────────────────────────────────────────────────────────────┤
   │  Realizacja Inżynieryjna & Orkiestracja AI (Git, Claude, Antigravity):      360,7 h    │
   │  Zaangażowanie Koncepcyjne, Architektoniczne & Badania R&D (HVAC/AI):     + 106,0 h    │
   ├────────────────────────────────────────────────────────────────────────────────────────┤
   │  ŁĄCZNY UDOKUMENTOWANY CZAS PRACY:                                          466,7 h    │
   │  (Przedział szacunkowy: 432 h – 505 h w zależności od wariantu bezczynności)           │
   ├────────────────────────────────────────────────────────────────────────────────────────┤
   │  Równowartość etatowa:   ~58–60 pełnych 8-godzinnych dni roboczych (~3 miesiące etatu)│
   │  Ekwiwalent rynkowy:     330 000 – 450 000 PLN netto (stawki Senior Architect / CTO)   │
   └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Zbadane Źródła Danych i Baza Dowodowa

Wycena wkładu opiera się na twardych, weryfikowalnych rejestrach cyfrowych obejmujących wszystkie środowiska deweloperskie i analityczne:

1. **Repozytorium prototypu i fazy inicjalnej (`Documents/KlimApp`)**:
   * Okres: od 07.06.2026 r.
   * Zakres: Analiza biznesowa, design system z Figmy (`figma_KlikKlima.json`), konfiguracja bazy Supabase, pierwsze testy Playwright E2E.
2. **Główne repozytorium systemu (`klikklima-system`)**:
   * Okres: od 14.06.2026 r. do 16.09.2026 r.
   * Zakres: Monorepo `turborepo` (`apps/b2b-web`, `apps/b2c-web`, `packages/*`, `contracts/`), narzędzia `tmp-figma*`, `kk-agentic-os`.
   * **Rejestr Git:** **495 commitów**.
3. **Logi sesji interaktywnych Claude Code**:
   * 3 zbadane projekty: poziom nadrzędny, katalog główny `klikklima-system` oraz monorepo `turborepo`.
   * **Baza promptów:** **5 437 bezpośrednich interakcji** i decyzji architektonicznych wprowadzonych przez użytkownika.
4. **Logi sesji Antigravity IDE**:
   * Ścieżka: `~/.gemini/antigravity-ide/brain/`
   * **Baza sesji:** **34 dedykowane sesje projektowe KlikKlima / KlimApp**, obejmujące **1 192 bezpośrednie prompty użytkownika**.
5. **Sesje Analityczno-Koncepcyjne R&D**:
   * Narzędzia: Cursor AI, Claude Pro, Antigravity, Gemini, dokumentacja techniczna i branżowa HVAC.
   * **Baza cykli badawczych:** **66 – 84 udokumentowane sesje analityczne**.

> **Łączna baza zarejestrowanych zdarzeń roboczych w projekcie wynosi ponad 7 200 zdarzeń** (495 commitów Git + 6 629 promptów i interakcji z agentami AI + sesje R&D).

---

## 3. Metodologia Pomiaru Czasu Pracy

### Dlaczego same commity Git zaniżają czas pracy o ponad 55%?
W pracy w nowoczesnym paradygmacie inżynierii wspomaganej sztuczną inteligencją (CDAL — *Contract-Driven Agentic Loop*) programista nie spędza godzin na ręcznym wstukiwaniu boilerplate'u. Jego rola polega na:
* Precyzyjnym formułowaniu kontekstu biznesowego i reguł brzegowych,
* Analizie kontraktów i zależności domenowych,
* Pisaniu rygorystycznych testów akceptacyjnych (faza RED),
* Weryfikacji generowanego diffu, bezpieczeństwa i odporności na regresję,
* Ręcznym testowaniu zachowania interfejsu w przeglądarce i weryfikacji bazy danych.

Czas liczony wyłącznie z odstępów między commitami Git wynosi w projekcie zaledwie **162,7 godziny**. Pomija on całkowicie czas spędzony na analizie, weryfikacji architektury i orkiestracji agentów.

### Zastosowane Modele Pomiaru:

1. **Zunifikowany Model Sesji Roboczych (dla Inżynierii i Kodu):**
   * Wszystkie zdarzenia (commit w Git, prompt w Claude, akcja w Antigravity) ułożono na jednej osi czasu.
   * Zdarzenia w odstępie mniejszym niż próg bezczynności (*inactivity gap*) tworzą jedną ciągłą sesję.
   * Każda sesja zawiera 30-minutowy bufor wejściowy na analizę problemu i uruchomienie kontekstu.
   * Sesje są twardo rozdzielane o północy, zapobiegając sztucznemu łączeniu dni.
   * **Wariant Standardowy (gap 90 min):** **360,7 h** — rekomendowany rynkowo standard pracy badawczo-rozwojowej z AI.
   * **Wariant Konserwatywny (gap 60 min):** **336,5 h** — minimalny wariant bezwzględny.
   * **Wariant Elastyczny (gap 120 min):** **388,2 h** — uwzględniający długie cykle testów E2E i analizy manualnej.

2. **Dekompozycja Cyklu Koncepcyjnego R&D:**
   * Każdy złożony wątek architektoniczno-biznesowy to cykl trwający od **1,0 do 1,5 godziny**:
     * *Formułowanie zapytania i modelowanie problemu:* 10–15 min,
     * *Czytanie dokumentacji, przyswajanie materiału i weryfikacja promptu:* 15–20 min,
     * *Weryfikacja założeń, symulacja i decyzja architektoniczna:* 30–45 min.

---

## 4. Zintegrowane Zestawienie Zbiorcze Miesiąc po Miesiącu

Poniższa tabela łączy zaangażowanie inżynieryjne w kodzie z czasem poświęconym na analizę koncepcyjną i badania R&D w całym okresie powstawania systemu (Maj – Wrzesień 2026 r.):

| Miesiąc (2026) | Zakres dat | Dni z aktywnością w kodzie (pn-pt / weekend) | Dni robocze w miesiącu | Realizacja Inżynieryjna (Standard gap 90m) | Zaangażowanie Koncepcyjne R&D (Wartość środkowa) | ŁĄCZNY CZAS PRACY (Miesiąc) | Średnia na przepracowany dzień roboczy (pn–pt)* | Ekwiwalent wymiaru etatu |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Maj** | 01.05 – 31.05 | *faza przedkodowa* | 20 dni | — | 25 – 30 h *(śr. 27,5 h)* | **~27,5 h** | *1,4 h / dzień* | ~0,2 etatu |
| **Czerwiec** | 01.06 – 30.06 | **18 dni** (15 pn-pt + 3 wknd) | 21 dni | **65,4 h** *(konserw. 61,6 h)* | 25 – 30 h *(śr. 27,5 h)* | **92,9 h** | **5,6 h / dzień** | ~0,55 etatu |
| **Lipiec** | 01.07 – 31.07 | **11 dni** (9 pn-pt + 2 wknd) | 23 dni | **63,3 h** *(konserw. 55,5 h)* | 20 – 25 h *(śr. 22,5 h)* | **85,8 h** | **8,9 h / dzień** | ~0,47 etatu |
| **Sierpień** | 01.08 – 31.08 | **21 dni** (17 pn-pt + 4 wknd) | 21 dni | **112,8 h** *(konserw. 107,6 h)*| 15 – 20 h *(śr. 17,5 h)* | **130,3 h** | **7,3 h / dzień** | ~0,78 etatu |
| **Wrzesień** *(do 16.09)*| 01.09 – 16.09 | **15 dni** (12 pn-pt + 3 wknd) | 12 dni | **119,3 h** *(konserw. 111,7 h)*| 10 – 12 h *(śr. 11,0 h)* | **130,3 h** | **10,2 h / dzień** | **1,35 etatu** |
| **ŁĄCZNIE** | **Maj – 16.09** | **65 dni** (53 pn-pt + 12 wknd) | **97 dni** | **360,7 h** *(min. 336,5 h)* | **95 – 117 h** *(śr. 106,0 h)*| **466,7 h** | **7,8 h / dzień** | **~0,6 etatu** |

*\*Średnia dzienna dla dni roboczych pn-pt liczona w oparciu o sumę czasu inżynierii i proporcjonalnego czasu R&D w aktywnych dniach roboczych.*

---

## 5. Szczegółowa Analiza i Kamienie Milowe Miesiąc po Miesiącu

### 1. Maj 2026 r. — Inkubacja, Architektura i Wybór Stosu
* **Czas pracy:** **25 – 30 godzin** (18 – 22 złożone sesje badawczo-analityczne).
* **Profil miesiąca:** Czysta praca koncepcyjna i architektoniczna przed utworzeniem repozytoriów.
* **Główne osiągnięcia i kamienie milowe:**
  * Projektowanie architektury platformy KlikKlima, mapowanie obiegów pracy i procesów w branży HVAC.
  * Selekcja stosu technologicznego: Next.js (App Router, Server Actions), Supabase (PostgreSQL), Turborepo jako monorepo, Prisma ORM, Tailwind CSS v4.
  * Konfiguracja narzędzi inżynieryjnych: środowiska agentowe Cursor AI, Claude Code i Antigravity.
  * Analiza wymogów prawno-biznesowych (F-gazy, SEP, procedury montażowe i serwisowe).

### 2. Czerwiec 2026 r. — Faza Prototypowa (`KlimApp`) i Start Monorepo
* **Czas pracy:** **92,9 godziny** (65,4 h inżynierii w kodzie + 27,5 h analizy R&D).
* **Zaangażowanie dniowe:** 18 aktywnych dni w kodzie (15 dni roboczych pn-pt, 3 dni weekendowe; 8,9 h w weekendy).
* **Średnia intensywność:** **5,6 godziny na aktywny dzień roboczy**.
* **Główne osiągnięcia i kamienie milowe:**
  * **Faza 1 (`Documents/KlimApp`):** Inicjalizacja projektu, parsowanie design tokenów z Figmy (`figma_KlikKlima.json`), konfiguracja pierwszej bazy Supabase, wstępne testy Playwright E2E (07.06 – 12.06).
  * **Faza 2 (`klikklima-system`):** Utworzenie architektury Turborepo, budowa interaktywnego kalkulatora i konfiguratora zapotrzebowania chłodniczego (Single/Multi split), wdrożenie komponentów `RoomRow` i badge kompatybilności.
  * **R&D i AI:** Badania nad architekturą multi-agentową, eksploracja systemów RAG dla bazy wiedzy HVAC, pierwsze rurociągi integracji modeli LLM z logiką biznesową.

### 3. Lipiec 2026 r. — Realia HVAC, Ekrany Figmy i Panel CRM B2B
* **Czas pracy:** **85,8 godziny** (63,3 h inżynierii w kodzie + 22,5 h analizy R&D).
* **Zaangażowanie dniowe:** 11 aktywnych dni w kodzie (9 dni roboczych pn-pt, 2 weekendowe; 3,8 h w weekendy).
* **Średnia intensywność:** **8,9 godziny na aktywny dzień roboczy** (skoncentrowane, wielogodzinne bloki głębokiej pracy).
* **Główne osiągnięcia i kamienie milowe:**
  * **Migracja UI:** Przeniesienie kompleksowych makiet z Figmy do Next.js App Router (`tmp-figma-b2b-web`, `tmp-figma-auditors`).
  * **Panel B2B CRM:** Wdrożenie tabeli leadów, widoków Kanban, wstępnego przypisywania audytorów do zleceń, paginacji i zaawansowanych filtrów.
  * **Zderzenie z rynkiem HVAC:** Pogłębione wywiady i analiza procesów instalatorskich, specyfika pracy ekip terenowych, projektowanie dyspozytorni w oparciu o praktyczną wiedzę instalatorską.

### 4. Sierpień 2026 r. — Architektura Kontraktowa, Bezpieczeństwo i Metodyka CDAL
* **Czas pracy:** **130,3 godziny** (112,8 h inżynierii w kodzie + 17,5 h analizy R&D).
* **Zaangażowanie dniowe:** 21 aktywnych dni w kodzie (17 dni roboczych pn-pt, 4 weekendowe; 6,2 h w weekendy).
* **Średnia intensywność:** **7,3 godziny na aktywny dzień roboczy** (systematyczna praca na poziomie ok. 0,8 etatu).
* **Główne osiągnięcia i kamienie milowe:**
  * **Architektura Kontraktowa:** Wprowadzenie zasady Single Source of Truth w `@klikklima/contracts` (ADR-001, ADR-002, `kk-contract-window`). Skodyfikowanie reguł biznesowych poza kodem aplikacji.
  * **Kartoteki Personelu i Floty:** Wdrożenie pełnych kartotek audytorów i ekip monterskich w CRM (`CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN`).
  * **Bezpieczeństwo Enterprise:** Autoryzacja mutacji B2B (`SEC-AUTHZ-B2B-MUTATIONS`), twarde reguły PostgreSQL Row Level Security dla audytorów (`SEC-RLS-AUDITOR-SCOPE`) chroniące bazę klientów.
  * **Grafiki Dostępności:** Reguły tygodniowej dostępności godzinowej ekip (`FLD-AVAILABILITY-SPLIT`).
  * **Optymalizacja AI & DB:** Strojenie promptów orkiestracji, testy API (Groq, Gemini), optymalizacja zapytań relacyjnych.

### 5. Wrzesień 2026 r. (do 16.09) — Pełnoetatowy Sprint Wdrożeniowy
* **Czas pracy:** **130,3 godziny w 16 dni** (119,3 h inżynierii w kodzie + 11,0 h analizy R&D).
* **Zaangażowanie dniowe:** 15 aktywnych dni na 16 możliwych (**12 dni roboczych pn-pt — 100% obecności** + 3 weekendy; 7,6 h w weekendy).
* **Średnia intensywność:** **10,2 godziny na każdy roboczy dzień** (pełny etat z regularnymi nadgodzinami, wymiar 1,35 nominalnego etatu).
* **Główne osiągnięcia i kamienie milowe:**
  * **Silnik Puli Slotów i Kalendarza:** Zaawansowana agregacja dostępności floty w czasie rzeczywistym, atomowe blokady `EXCLUDE USING gist` w PostgreSQL, panel konfiguracyjny harmonogramów (`CAL-SLOT-ENGINE`, `CAL-POOL-AGGREGATE`, `CAL-SCHEDULING-CONFIG-UI`).
  * **Cyfrowe Umowy i Zgody:** Bezkartkowy obieg formalny, podpis SMS w 60 sekund, rejestr wersji regulaminów i zgód (`FLD-CONSENT-DOCS`).
  * **Fakturowanie i Mechanika 2-Fazowa:** Koszyki technologiczne wycen (`FLD-QUOTE-BASKET-SELECT`), automat montażu dwufazowego na budowach deweloperskich (`FNL-2PHASE-BOOKING-MECHANICS`) oraz zautomatyzowane fakturowanie etapowe chroniące cash flow (`FNL-2PHASE-INVOICE`).
  * **RODO i Audit Log:** Anonimizacja klientów z zachowaniem spójności finansowej oraz niezaprzeczalny append-only audit log (`CLIENT-ANONYMIZATION-RODO`, seria `SEC-AUDIT-LOG-*`).

---

## 6. Struktura Wartości Kapitałowej (Sweat Equity) i Wycena Rynkowa

Poniższa dekompozycja łączy wypracowane godziny z rynkową wyceną prac architektonicznych i inżynieryjnych, jaką spółka musiałaby zapłacić na wolnym rynku (software house klasy premium lub wyspecjalizowana agencja consultingowa):

| Filar Własności Intelektualnej (IP) i Realizacji | Udokumentowany Czas | Udział w Projekcie | Rynkowy Ekwiwalent Wdrożenia (Software House) |
| :--- | :---: | :---: | :---: |
| **1. Architektura Koncepcyjna R&D i Procesy HVAC** *(Maj–Wrz)* | **106,0 h** | 23% | **70 000 – 100 000 PLN** |
| **2. Silniki Domenowe HVAC, Pula Slotów, Umowy i Faktury** | **105,0 h** | 22% | **75 000 – 105 000 PLN** |
| **3. Autorska Fabryka Agentowa CDAL i Tooling Inżynieryjny** | **95,0 h** | 20% | **70 000 – 95 000 PLN** |
| **4. Architektura Systemowa, Standardy i Kontrakty (12 ADR)** | **55,0 h** | 12% | **40 000 – 55 000 PLN** |
| **5. Bezpieczeństwo Enterprise, Baza Danych, RLS i RODO** | **50,0 h** | 11% | **35 000 – 50 000 PLN** |
| **6. Aplikacje Użytkowe B2C Portal & B2B CRM** | **55,7 h** | 12% | **40 000 – 55 000 PLN** |
| **ŁĄCZNIE (CAŁY SYSTEM)** | **466,7 h** | **100%** | **330 000 – 450 000 PLN netto** |

---

## 7. Kluczowe Wnioski dla Wspólnika (Podsumowanie Negocjacyjne)

1. **Rzeczywisty Wkład Kapitałowy (Sweat Equity):**
   * Michał wniósł do spółki **466,7 godziny udokumentowanej pracy** na poziomie Głównego Architekta i CTO.
   * Rynkowa wartość wytworzonego oprogramowania, autorskich silników, bazy danych i procedur prawnych to **od 330 000 do 450 000 zł netto**. Spółka nie poniosła z tego tytułu żadnych kosztów gotówkowych.
2. **Dynamika i Zaangażowanie Osobiste:**
   * Projekt nie był pobocznym hobby — zaangażowanie rosło systematycznie z miesiąca na miesiąc: od fazy badań w maju (~28 h), przez prototyp w czerwcu (~93 h), budowę CRM w lipcu (~86 h), architekturę kontraktową w sierpniu (~130 h), po **pełnoetatowy sprint we wrześniu (~130 h w 16 dni, średnio ponad 10 h dziennie)**.
3. **Majątek Trwały Spółki (Moat):**
   * Wytworzona technologia nie jest „stroną internetową”, lecz instytucjonalnym systemem operacyjnym. Zapewnia skalowanie 10x bez konieczności powiększania biura, bezkartkowe zamykanie sprzedaży w 60 sekund, ochronę płynności finansowej (fakturowanie 2-fazowe) oraz bankowe bezpieczeństwo bazy klientów.
4. **Podstawa do Ustaleń Partnerskich:**
   * Aby zachować partnerską równowagę w spółce, wkład operacyjny wspólnika (COO) powinien równoważyć wniesiony kapitał technologiczny o wartości ponad 350 tys. zł poprzez wdrożenie procesów rynkowych, pozyskanie sieci montażystów, zarządzanie bieżącą logistyką i realizację założonych celów sprzedażowych (zgodnie z dokumentem `OCZEKIWANY-WKLAD-OPERACYJNY-COO.md`).
