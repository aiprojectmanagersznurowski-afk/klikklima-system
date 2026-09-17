# Zakres Odpowiedzialności i Oczekiwany Wkład Operacyjny Wspólnika (COO)

**Spółka:** KlikKlima  
**Rola:** Dyrektor Operacyjny (COO / Managing Partner ds. Operacji i Rozwoju Rynku)  
**Dokument powiązany:** [Raport Wartości IP i Technologii](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/RAPORT-WARTOSCI-IP-I-TECHNOLOGII.md)  
**Cel dokumentu:** Precyzyjne zdefiniowanie wkładu pracy, konkretnych zadań, odpowiedzialności i mierzalnych wyników (KPI), których spółka wymaga od wspólnika operacyjnego, aby zrównoważyć wniesiony przez Michała kapitał technologiczny (własność intelektualna i platforma o wartości ponad 300 000 zł).

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

System posiada zintegrowany słownik koszyków wycen ([`FLD-QUOTE-BASKET-SELECT`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/docs/workorders/FLD-QUOTE-BASKET-SELECT.md)). Zadaniem COO jest nałożenie na te koszyki twardej matematyki finansowej:

* **Konkretne zadania do wykonania:**
  1. **Zaprojektowanie modelu zaliczkowego:** Ustalenie struktury płatności klientów (np. 40–50% zaliczki przy rezerwacji terminu montażu / podpisaniu umowy, co w 100% pokrywa koszt zakupu sprzętu w hurtowni; 50–60% płatne w dniu zakończenia montażu przed podpisaniem protokołu odbioru).
  2. **Konstrukcja siatki marżowej per usługa:** Określenie narzutu na urządzeniach i robociźnie w podziale na instalacje Single-Split i Multi-Split oraz montaże dwufazowe w stanie deweloperskim.
  3. **Model rozliczeń z podwykonawcami:** Sztywny taryfikator stawek za montaż dla ekip partnerskich B2B, powiązany z koszykami technologicznymi w systemie (brak uznaniowości, rozliczenie wyłącznie za zatwierdzone protokoły).
* **Mierzalne wyniki (KPI):**
  * **Ujemny cykl konwersji gotówki:** 100% zakupów urządzeń sfinansowane z zaliczek klientów (zero przestojów z powodu braku gotówki na magazyn).
  * **Minimalna marża brutto:** Utrzymanie średniej marży brutto na montażu na poziomie **minimum 25–35%**.

---

### OBSZAR 2: Łańcuch Dostaw i Relacje z Dystrybutorami HVAC

COO odpowiada za to, aby sprzęt był kupowany najtaniej jak to możliwe i docierał na budowę bez opóźnień:

* **Konkretne zadania do wykonania:**
  1. **Wynegocjowanie umów partnerskich z głównymi hurtowniami:** Nawiązanie bezpośrednich relacji z czołowymi dystrybutorami klimatyzacji (np. Gree, Daikin, Mitsubishi, Rotenso, AUX, Haier, Viessmann).
  2. **Wywalczenie rabatów instalatorskich i kredytów kupieckich:** Pozyskanie maksymalnych rabatów agencyjnych oraz wynegocjowanie odroczonego terminu płatności (14–30 dni) po zbudowaniu historii zakupowej.
  3. **Logistyka dostaw Just-in-Time:** Ułożenie procesu dostaw tak, aby hurtownia dostarczała sprzęt bezpośrednio na adres klienta w dniu montażu lub do rąk własnych ekipy monterskiej, eliminując koszty wynajmu i utrzymania centralnego magazynu.
* **Mierzalne wyniki (KPI):**
  * Poziom rabatu zakupowego: **minimum 35–45% od cen katalogowych**.
  * Terminowość dostaw: **98% dostaw urządzeń** na czas przed godziną rozpoczęcia slotu montażowego.

---

### OBSZAR 3: Budowa i Weryfikacja Sieci Ekip Monterskich i Audytorów

Cyfrowy silnik slotów ([`packages/scheduling`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/packages/scheduling/src)) wymaga realnych, sprawdzonych wykonawców, aby móc otwierać terminy w miastach:

* **Konkretne zadania do wykonania:**
  1. **Rekrutacja i weryfikacja podwykonawców (B2B):** Pozyskanie i zakontraktowanie na wyłączność lub w modelu partnerskim ekip montażowych oraz audytorów technicznych.
  2. **Rygorystyczny audyt uprawnień:** Weryfikacja certyfikatów F-gazowych (personalnych), uprawnień elektrycznych SEP (grupa G1), aktualnych polis OC instalatorów (min. 200 000 zł) oraz stanu technicznego narzędzi (pompy próżniowe, wagi, stacje odzysku).
  3. **Wdrożenie ekip w standardy KlikKlima:** Przeszkolenie wykonawców z obsługi aplikacji, procedury wgrywania fotodokumentacji, kultury osobistej u klienta oraz dbania o czystość (ochraniacze na buty, odkurzacz przemysłowy przy wierceniu).
* **Mierzalne wyniki (KPI):**
  * Zbudowanie bazy **minimum 4–6 stałych ekip monterskich** w pierwszym regionie operacyjnym w ciągu 45 dni od startu.
  * Wskaźnik poprawek montażowych / reklamacji jakościowych na poziomie **poniżej 2%**.

---

### OBSZAR 4: Bieżące Prowadzenie Dyspozytorni w Panelu B2B

Podczas gdy Michał odpowiada za rozwój architektury IT, bezpieczeństwo bazy i nowe moduły, **COO w 100% prowadzi codzienne życie operacyjne w panelu dyspozytorskim** ([`apps/b2b-web`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/apps/b2b-web)):

* **Konkretne zadania do wykonania:**
  1. **Prowadzenie tablicy Kanban i lejków:** Nadzór nad przechodzeniem leadów między etapami (audyt → wycena → zaliczka → montaż → odbiór).
  2. **Egzekucja progów SLA ([`contracts/sla.contract.mjs`](file:///Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/contracts/sla.contract.mjs)):** Reakcja na nowe zapytania klientów, pilnowanie alertu montażowego o godzinie 16:00, zamykanie zgłoszeń reklamacyjnych w 48h.
  3. **Zarządzanie kryzysowe i eskalacje:** Rozwiązywanie problemów w terenie (trudne warunki na budowie, awaria auta ekipy, choroba instalatora — szybkie przearanżowanie slotu w kalendarzu bez utraty klienta).
  4. **Akceptacja protokołów odbioru:** Weryfikacja zdjęć z montażu i próby szczelności przed zatwierdzeniem wypłaty wynagrodzenia dla podwykonawcy.
* **Mierzalne wyniki (KPI):**
  * **SLA pierwszego kontaktu:** Kontakt z leadem wymagającym doprecyzowania w czasie **poniżej 60 minut** w godzinach pracy.
  * **100% zleceń odebranych formalnie:** Zero wypłat dla ekip bez zatwierdzonego protokołu i zdjęć w systemie.

---

### OBSZAR 5: Kwestie Formalno-Prawne, UDT i Bezpieczeństwo Branżowe

Chłodnictwo i klimatyzacja podlegają ścisłym restrykcjom prawnym. Za błędy w obsłudze czynników chłodniczych grożą kary do 50 000 zł z Wojewódzkiego Inspektoratu Ochrony Środowiska (WIOŚ):

* **Konkretne zadania do wykonania:**
  1. **Certyfikat dla Przedsiębiorstwa w UDT:** Uzyskanie i utrzymanie certyfikatu Urzędu Dozoru Technicznego dla spółki KlikKlima (przygotowanie procedur, dokumentacji aparatury kontrolno-pomiarowej).
  2. **Obsługa Centralnego Rejestru Operatorów (CRO):** Obowiązkowe wpisy i ewidencja urządzeń zawierających fluorowane gazy cieplarniane.
  3. **Polisa OC Spółki:** Wykupienie i nadzór nad ubezpieczeniem OC działalności spółki na kwotę minimum **500 000 – 1 000 000 zł**.
* **Mierzalne wyniki (KPI):**
  * **100% zgodności prawnej:** Certyfikat UDT uzyskany bez opóźnień, zero uwag przy kontrolach WIOŚ/UDT.

---

## 3. Oczekiwany Wymiar Czasu Pracy i Zaangażowania

Aby wkład pracy wspólnika odpowiadał wniesionemu wkładowi Michała (ponad 360 godzin pracy architektonicznej oraz pełny etat we wrześniu):

* **Wymiar czasu pracy COO:** **Pełen etat operacyjny (min. 140–160 godzin miesięcznie)**.
* **Dyspozycyjność:** Stała dostępność w godzinach pracy montażystów i hurtowni (poniedziałek – piątek w godz. 8:00 – 17:00).
* **Profil zaangażowania:** Praca „na ziemi” — spotkania z hurtowniami, rekrutacja ekip w terenie, wizyty na pierwszych montażach referencyjnych, bieżąca dyspozytornia w CRM.

---

## 4. Harmonogram Odbioru Wkładu COO (Kamienie Milowe 30 / 60 / 90 Dni)

| Horyzont | Oczekiwane Dostarczenie przez COO | Kryterium Zaliczenia |
| :--- | :--- | :--- |
| **Pierwsze 30 dni** | 1. Podpisane umowy z min. 2 hurtowniami HVAC (rabaty B2B).<br>2. Gotowy model zaliczkowy i siatka stawek podwykonawców.<br>3. Zgłoszenie certyfikatu przedsiębiorstwa do UDT. | Komplet podpisanych umów i cenników gotowych do wdrożenia do systemu. |
| **Dni 31 – 60** | 1. Zakontraktowanie min. 3 certyfikowanych ekip monterskich.<br>2. Pełne wdrożenie procesu dostaw Just-in-Time bez magazynu.<br>3. Uruchomienie obsługi pierwszych 15–20 zleceń w CRM. | Ekipy z kompletem zweryfikowanych uprawnień F-gaz w systemie CRM. |
| **Dni 61 – 90** | 1. Samofinansowanie: 100% montaży realizowanych z bieżącego cash flow.<br>2. Płynna obsługa minimum 30 montaży miesięcznie.<br>3. Wskaźnik reklamacji < 2%, SLA kontaktu < 1h. | Spółka generuje dodatni przepływ pieniężny, system operacyjny działa bez udziału Michała w dyspozytorni. |

---

## 5. Podsumowanie do Rozmowy Partnerskiej

> *„Michał dostarczył spółce gotową technologię i proces o wartości rynkowej 300 000 zł, inwestując w to 360 godzin specjalistycznej pracy. Dzięki temu KlikKlima ma przewagę nad 95% firm na rynku.*  
>  
> *Rolą wspólnika jako COO jest wniesienie równie twardego ekwiwalentu operacyjnego: zbudowanie łańcucha dostaw, wynegocjowanie marż gwarantujących samofinansowanie z zaliczek, zakontraktowanie profesjonalnych ekip i codzienne, pełnoetatowe prowadzenie dyspozytorni.*  
>  
> *Koszty marketingu i pozycjonowania ponosimy wspólnie, ale to operacja musi przekształcić leady w zysk na koncie spółki bez generowania zatorów płatniczych.”*
