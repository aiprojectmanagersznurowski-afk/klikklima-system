# Zakres Odpowiedzialności i Oczekiwany Wkład Operacyjny Wspólnika (COO)

**Spółka:** KlikKlima  
**Rola:** Dyrektor Operacyjny (COO / Managing Partner ds. Operacji i Rozwoju Rynku)  
**Dokumenty powiązane:**  
- [System KPI i Bramki Decyzyjne](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/prezentacje/SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md) (Główne źródło prawdy dla metryk)  
- [Raport Wartości IP i Technologii](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/prezentacje/RAPORT-WARTOSCI-IP-I-TECHNOLOGII.md)  
- [Koszyki Usług i Modele Rozliczeniowe](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE.md)  
- [Roadmapa GTM i Prognoza Developmentu](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/prezentacje/ROADMAP-GTM-I-PROGNOZA-DEVELOPMENTU.md)  
**Cel dokumentu:** Precyzyjne zdefiniowanie wkładu pracy, konkretnych zadań, odpowiedzialności i mierzalnych wyników (KPI), których spółka wymaga od wspólnika operacyjnego, aby zrównoważyć wniesiony przez Michała kapitał technologiczny (własność intelektualna i platforma o rynkowej wycenie 260 000 – 360 000 PLN).

---

## 1. Filozofia Finansowania i Ramy Współpracy

Zgodnie z ustaleniami założycielskimi model biznesowy KlikKlima opiera się na dwóch żelaznych zasadach:

1. **Wspólne koszty akwizycji i marketingu:**
   * Koszty pozycjonowania (SEO), płatnych kampanii reklamowych (Google Ads, Meta Ads) oraz narzędzi marketingowych są **finansowane wspólnie** (50/50 ze środków założycieli lub bezpośrednio z bieżących przychodów spółki).
2. **Finansowanie spółki z bieżących wpływów (Samofinansujący się Cash Flow):**
   * Spółka nie może wymagać ciągłego dopłacania kapitału na zakup urządzeń.
   * **Zadaniem COO jest zaprojektowanie i egzekucja takiego modelu zaliczkowego i marżowego**, w którym wpłata zaliczki od klienta natychmiastowo finansuje zakup klimatyzatora w hurtowni, a pozostała część marży pokrywa montaż i zysk spółki.

---

## 2. Kluczowe Obszary Odpowiedzialności i Oczekiwane Wyniki (KPI)

```
                                  MAPA ODPOWIEDZIALNOŚCI COO
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │ OBSZAR 1: MODEL FINANSOWO-MARŻOWY (Cash-flow positive, zaliczki, prowizje ekip)        │
   ├────────────────────────────────────────────────────────────────────────────────────────┤
   │ OBSZAR 2: ŁAŃCUCH DOSTAW (Dystrybutorzy HVAC, rabaty B2B, dostawy Just-In-Time)        │
   ├────────────────────────────────────────────────────────────────────────────────────────┤
   │ OBSZAR 3: SIEĆ WYKONAWCZA (Rekrutacja, weryfikacja F-gaz/SEP, kontraktowanie ekip)     │
   ├────────────────────────────────────────────────────────────────────────────────────────┤
   │ OBSZAR 4: CODZIENNA DYSPOZYTORNIA (Prowadzenie zleceń w CRM, SLA, eskalacje, odbiory)  │
   ├────────────────────────────────────────────────────────────────────────────────────────┤
   │ OBSZAR 5: FORMALNOŚCI, UDT I GWARANCJE (Certyfikat UDT, CRO, polisy OC, reklamacje)   │
   └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### OBSZAR 1: Model Finansowo-Marżowy i Polityka Płynnościowa

System posiada zintegrowany słownik koszyków wycen ([`FLD-QUOTE-BASKET-SELECT`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/workorders/FLD-QUOTE-BASKET-SELECT.md), pełna specyfikacja: [Koszyki Usług i Modele Rozliczeniowe](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE.md)). Zadaniem COO jest nałożenie na te koszyki twardej matematyki finansowej:

* **Konkretne zadania do wykonania:**
  1. **Zaprojektowanie modelu zaliczkowego:** Ustalenie struktury płatności klientów (40–50% zaliczki online przy rezerwacji terminu montażu / podpisaniu umowy, co w 100% pokrywa koszt zakupu sprzętu w hurtowni; 50–60% płatne po montażu przed podpisaniem protokołu odbioru).
  2. **Konstrukcja siatki marżowej per usługa:** Określenie narzutu na urządzeniach i robociźnie w podziale na instalacje Single-Split i Multi-Split oraz montaże dwufazowe w stanie deweloperskim.
  3. **Model rozliczeń z podwykonawcami:** Sztywny taryfikator stawek za montaż dla ekip partnerskich B2B, powiązany z koszykami technologicznymi w systemie (brak uznaniowości, rozliczenie wyłącznie za zatwierdzone protokoły).
* **Mierzalne wyniki (zgodne z `SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md`):**
  * **OPS-01 (Ujemny cykl konwersji gotówki):** **100% zakupów urządzeń sfinansowane z zaliczek klientów** (zero przestojów i zero finansowania magazynu ze środków własnych).
  * **OPS-02 (Średnia marża brutto na zleceniu):** Utrzymanie marży brutto na poziomie **minimum 28–35%** (próg minimalny: 25%).

---

### OBSZAR 2: Łańcuch Dostaw i Relacje z Dystrybutorami HVAC

COO odpowiada za to, aby sprzęt był kupowany najtaniej jak to możliwe i docierał na budowę bez opóźnień:

* **Konkretne zadania do wykonania:**
  1. **Wynegocjowanie umów partnerskich z głównymi hurtowniami:** Nawiązanie bezpośrednich relacji z czołowymi dystrybutorami klimatyzacji (np. Gree, Daikin, Mitsubishi, Rotenso, AUX, Haier, Viessmann).
  2. **Wywalczenie rabatów instalatorskich i kredytów kupieckich:** Pozyskanie maksymalnych rabatów agencyjnych oraz wynegocjowanie odroczonego terminu płatności (14–30 dni) po zbudowaniu historii zakupowej.
  3. **Logistyka dostaw Just-in-Time:** Ułożenie procesu dostaw tak, aby hurtownia dostarczała sprzęt bezpośrednio na adres klienta w dniu montażu lub do rąk własnych ekipy monterskiej, eliminując koszty wynajmu i utrzymania centralnego magazynu.
* **Mierzalne wyniki (zgodne z `SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md`):**
  * **OPS-08 (Poziom rabatu hurtowego B2B):** Wynegocjowany rabat **minimum 35–45% od cen katalogowych**.
  * **OPS-04 (Terminowość dostaw JIT OTIF):** **Minimum 98% dostaw urządzeń na czas** przed godziną rozpoczęcia slotu montażowego.

---

### OBSZAR 3: Budowa i Weryfikacja Sieci Ekip Monterskich i Audytorów

Cyfrowy silnik slotów ([`packages/scheduling`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/packages/scheduling/src)) wymaga realnych, sprawdzonych wykonawców, aby móc otwierać terminy w miastach:

* **Konkretne zadania do wykonania:**
  1. **Rekrutacja i weryfikacja podwykonawców (B2B):** Pozyskanie i zakontraktowanie na wyłączność lub w modelu partnerskim ekip montażowych oraz audytorów technicznych.
  2. **Rygorystyczny audyt uprawnień:** Weryfikacja certyfikatów F-gazowych (personalnych), uprawnień elektrycznych SEP (grupa G1), aktualnych polis OC instalatorów (min. 200 000 zł) oraz stanu technicznego narzędzi (pompy próżniowe, wagi, stacje odzysku).
  3. **Wdrożenie ekip w standardy KlikKlima:** Przeszkolenie wykonawców z obsługi aplikacji, procedury wgrywania fotodokumentacji, kultury osobistej u klienta oraz dbania o czystość (ochraniacze na buty, odkurzacz przemysłowy przy wierceniu).
* **Mierzalne wyniki (zgodne z `SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md`):**
  * **OPS-07 (Pojemność sieci wykonawczej):** Zbudowanie bazy **minimum 4–6 stałych ekip monterskich** przed publicznym Go-Live (luty 2027 r.) oraz **6–10 ekip** w szczycie sezonu.
  * **OPS-05 (Wskaźnik jakości / reklamacji):** Wskaźnik poprawek montażowych na poziomie **poniżej 1.5%** (próg krytyczny: < 2.5%).

---

### OBSZAR 4: Bieżące Prowadzenie Dyspozytorni w Panelu B2B

Podczas gdy Michał odpowiada za rozwój architektury IT, bezpieczeństwo bazy i nowe moduły, **COO w 100% prowadzi codzienne życie operacyjne w panelu dyspozytorskim** ([`apps/b2b-web`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/apps/b2b-web)):

* **Konkretne zadania do wykonania:**
  1. **Prowadzenie tablicy Kanban i lejków:** Nadzór nad przechodzeniem leadów między etapami (audyt → wycena → zaliczka → montaż → odbiór).
  2. **Egzekucja progów SLA ([`contracts/sla.contract.mjs`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/contracts/sla.contract.mjs)):** Reakcja na nowe zapytania klientów, pilnowanie alertu montażowego o godzinie 16:00, zamykanie zgłoszeń reklamacyjnych w 48h.
  3. **Zarządzanie kryzysowe i eskalacje:** Rozwiązywanie problemów w terenie (trudne warunki na budowie, awaria auta ekipy, choroba instalatora — szybkie przearanżowanie slotu w kalendarzu bez utraty klienta).
  4. **Akceptacja protokołów odbioru:** Weryfikacja 4 zdjęć z montażu i próby szczelności przed zatwierdzeniem wypłaty wynagrodzenia dla podwykonawcy.
* **Mierzalne wyniki (zgodne z `SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md`):**
  * **OPS-03 (SLA pierwszego kontaktu):** Kontakt telefoniczny z leadem w czasie **poniżej 30 minut** w godzinach pracy (bezwzględny maks: 60 minut).
  * **OPS-06 (Dyscyplina protokołów):** **100% zleceń odebranych formalnie z kompletem 4 zdjęć** (zero wypłat bez dowodu).

---

### OBSZAR 5: Kwestie Formalno-Prawne, UDT i Bezpieczeństwo Branżowe

Chłodnictwo i klimatyzacja podlegają ścisłym restrykcjom prawnym. Za błędy w obsłudze czynników chłodniczych grożą kary do 50 000 zł z Wojewódzkiego Inspektoratu Ochrony Środowiska (WIOŚ):

* **Konkretne zadania do wykonania:**
  1. **Certyfikat dla Przedsiębiorstwa w UDT:** Uzyskanie i utrzymanie certyfikatu Urzędu Dozoru Technicznego dla spółki KlikKlima (zgodnie z `PROCES-UZYSKANIA-CERTYFIKATU-UDT.md`).
  2. **Obsługa Centralnego Rejestru Operatorów (CRO):** Obowiązkowe wpisy i ewidencja urządzeń zawierających fluorowane gazy cieplarniane.
  3. **Polisa OC Spółki:** Wykupienie i nadzór nad ubezpieczeniem OC działalności spółki na kwotę minimum **500 000 – 1 000 000 zł**.
* **Mierzalne wyniki (zgodne z `SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md`):**
  * **Zgodność prawna UDT (Gate-3.1):** Certyfikat UDT wpisany do oficjalnego rejestru online przed 28 lutego 2027 r., zero uwag przy kontrolach WIOŚ/UDT.
  * **OPS-09 (Czas likwidacji usterki):** Fizyczna naprawa w czasie **poniżej 24–36 godzin** (maksymalne SLA: 48h).

---

## 3. Oczekiwany Wymiar Czasu Pracy i Zaangażowania

Aby wkład pracy wspólnika odpowiadał wniesionemu wkładowi Michała (ponad 470 godzin udokumentowanej pracy architektoniczno-inżynieryjnej oraz pełny etat):

* **Wymiar czasu pracy COO:** **Pełen etat operacyjny (min. 140–160 godzin miesięcznie)**.
* **Dyspozycyjność:** Stała dostępność w godzinach pracy montażystów i hurtowni (poniedziałek – piątek w godz. 8:00 – 17:00).
* **Profil zaangażowania:** Praca „na ziemi” — spotkania z hurtowniami, rekrutacja ekip w terenie, wizyty na pierwszych montażach referencyjnych, bieżąca dyspozytornia w CRM.

---

## 4. Harmonogram Odbioru Wkładu COO (Zgodny z Bramkami Decyzyjnymi)

| Horyzont | Etap Roadmapy | Oczekiwane Dostarczenie przez COO | Kryterium Zaliczenia Bramki (SSOT) |
| :--- | :--- | :--- | :--- |
| **Listopad 2026 r.** | Faza 1: Przygotowanie | 1. Spółka zarejestrowana w KRS, wniosek w UDT.<br>2. Podpisane umowy z min. 2 hurtowniami HVAC.<br>3. Zatwierdzony taryfikator koszyków i umów B2B. | **Zaliczenie Gate 1 (30.11.2026 r.):** komplet umów handlowych, rejestr KRS i opłacony wniosek UDT. |
| **Grudzień 2026 r. – Styczeń 2027 r.** | Faza 2: Dry Run (2 mies.) | 1. Realizacja 3–5 montaży u klientów Piotra pełną ścieżką cyfrową.<br>2. Asysta w kontroli inspektora UDT.<br>3. Prowadzenie dyspozytorni i logistyki JIT. | **Zaliczenie Gate 2 (31.01.2027 r.):** 100% z zaliczek, 0 błędów P1, marża $\ge 25\%$, pozytywny protokół UDT. |
| **Luty 2027 r.** | Faza 3: Onboarding Ekip | 1. Zakontraktowanie i przeszkolenie min. 4–6 ekip.<br>2. Warsztaty z aplikacji Field App i standardu 4 zdjęć.<br>3. Zabezpieczenie slotów magazynowych na marzec. | **Zaliczenie Gate 3 (28.02.2027 r.):** wpis UDT w rejestrze, 4–6 ekip z F-gaz/SEP/OC po szkoleniu, gotowy budżet Ads. |
| **Marzec 2027 r.+** | Faza 4: Go-Live & Faza 5: Sezon | 1. Płynna obsługa dyspozytorni przy masowym ruchu.<br>2. Obsługa wolumenu 25–40 montaży miesięcznie w szczycie.<br>3. Utrzymanie wskaźnika jakości reklamacji < 1.5%. | **Zaliczenie Gate 4 (Go-Live) oraz Gate 5 (Dywidenda):** poduszka 3 mies. OPEX + $\ge 25$ montaży/mies. |

---

## 5. Podsumowanie do Rozmowy Partnerskiej

> *„Michał dostarczył spółce gotową technologię i proces o wartości rynkowej 260 000 – 360 000 zł, inwestując w to ponad 470 godzin specjalistycznej pracy. Dzięki temu KlikKlima ma przewagę nad 95% firm na rynku.*  
>  
> *Rolą wspólnika jako COO jest wniesienie równie twardego ekwiwalentu operacyjnego: zbudowanie łańcucha dostaw, wynegocjowanie marż gwarantujących samofinansowanie z zaliczek, zakontraktowanie profesjonalnych ekip i codzienne, pełnoetatowe prowadzenie dyspozytorni z zachowaniem standardów zdefiniowanych w [SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/prezentacje/SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md).*  
>  
> *Koszty marketingu i pozycjonowania ponosimy wspólnie, ale to operacja musi przekształcić leady w zysk na koncie spółki bez generowania zatorów płatniczych.”*
