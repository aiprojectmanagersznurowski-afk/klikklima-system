# Prognoza Ukończenia Ekosystemu, Roadmapa Go-To-Market i Podział Ról
## Strategia Wdrożenia Biznesowego KlikKlima (Listopad 2026 r. – Sierpień 2027 r.)

**Projekt:** KlikKlima  
**Autorzy:** Michał Sznurowski (CTO / Head of Product) & Piotr (COO / Head of Operations)  
**Data opracowania:** 17 września 2026 r. · **Wersja zaktualizowana:** 5 faz wdrożenia z dedykowanym miesiącem na onboarding ekip  
**Dokumenty powiązane:**  
- Raport Wartości IP i Technologii (`RAPORT-WARTOSCI-IP-I-TECHNOLOGII.md`)  
- Zakres Odpowiedzialności i Wkład Operacyjny COO (`OCZEKIWANY-WKLAD-OPERACYJNY-COO.md`)  
- Przewodnik Uzyskania Certyfikatu UDT (`PROCES-UZYSKANIA-CERTYFIKATU-UDT.md`)  
- Główny Backlog Projektu (`docs/BACKLOG.md`)

---

## 0. Główne Założenia Harmonogramu

1. **Formalne powołanie spółki (Sp. z o.o.) w listopadzie 2026 r.:** Spółka jest bezwzględnie wymagana do podpisania umowy i uruchomienia produkcyjnego konta merchanta w bramce płatności **PayU** (weryfikacja KRS i rachunku bankowego). Operacyjny start współpracy i testów bojowych wyznaczono na **1 grudnia 2026 r.**
2. **Zakończenie prac technologicznych do 30 listopada 2026 r.:** Cały development systemu zostaje domknięty w listopadzie. Od 1 grudnia nie dopisujemy nowych funkcji — wchodzimy w fazę testów na żywym organizmie. W grudniu i styczniu realizowane są wyłącznie hotfiksy i stabilizacja.
3. **Komplet fundamentów operacyjnych do 30 listopada 2026 r.:** Do końca listopada gotowe są: wzory umów podwykonawczych, **wszystkie modele rozliczeniowe** (zaliczki 40–50%, siatka marż, taryfikator stawek montażowych) wdrożone w kodzie, oraz **odświeżony katalog produktów i cennik**.
4. **Faza Testów Bojowych (Dry Run) przez 2 miesiące (grudzień 2026 r. – styczeń 2027 r.):** Realizacja zleceń na realnych klientach Piotra — **całkowicie BEZ publicznego landing page i BEZ zbierania leadów**. Klienci są wprowadzani do systemu ręcznie i przechodzą pełną ścieżkę operacyjną. To ciche testy bojowe procedur, a nie publiczny start rynkowy.
5. **Brama Decyzyjna po testach (koniec stycznia 2027 r.):** Szczegółowa weryfikacja 10 twardych wskaźników KPI (brak błędów krytycznych, pełne finansowanie sprzętu z zaliczek, terminowość JIT, protokoły).
6. **Dedykowana Faza Onboardingu Ekip (luty 2027 r., 1 miesiąc):** Po pomyślnym zaliczeniu testów bojowych przeznaczamy **cały luty na profesjonalne przygotowanie sieci wykonawczej przed sezonem**. To czas na rekrutację, szkolenia stacjonarne i terenowe z aplikacji mobilnej (Field App), wdrożenie standardu 4 zdjęć i checklist oraz podpisanie umów z ekipami.
7. **Publiczne Uruchomienie Rynku (Go-Live w marcu 2027 r.):** Start publicznego landing page, włączenie kampanii reklamowych (Google Ads, Meta Ads) oraz obsługa masowego napływu leadów przez wdrożoną w lutym sieć instalatorów.
8. **Certyfikat UDT jako zależność krytyczna:** Złożenie wniosku następuje w listopadzie 2026 r., kontrola stacjonarna w grudniu, a wpis do rejestru UDT w styczniu 2027 r. — przed rozpoczęciem onboardingu ekip i startem komercyjnym.
9. **Polityka gotówkowa i kapitał obrotowy (runway):** Zasada samofinansowania dotyczy bezpośrednich kosztów zakupu urządzeń (COGS — w 100% z zaliczek klientów). Koszty stałe (OPEX: opłata UDT, polisy OC, hosting, rejestracja spółki, budżet reklamowy) wymagają zabezpieczenia **kapitału obrotowego na okres przedstartowy (listopad 2026 r. – luty 2027 r.)**.
10. **Niezależne tory odpowiedzialności:** Tor technologiczny Michała i tor operacyjno-rynkowy Piotra biegną równolegle według ustalonej macierzy odpowiedzialności.

> **Dlaczego ta sekwencja gwarantuje sukces rynkowy:**  
> Wchodzimy w testy z gotowym systemem, testujemy go po cichu na realnych zleceniach przez 2 miesiące (grudzień–styczeń), w lutym bez pośpiechu i bez ryzyka wpadki szkolimy instalatorów na stabilnym oprogramowaniu, a publiczny Go-Live odpalamy w **marcu** — **idealnie na progu wiosennego szczytu popytu (kwiecień–sierpień).** Wchodzimy w sezon z naoliwioną maszyną, sprawdzonym personelem i najwyższymi ocenami klientów.

---

## 1. Prognoza Czasowa Ukończenia Ekosystemu (Michał / CTO)
### Termin graniczny: 30 listopada 2026 r.

Development technologiczny musi zostać ukończony przed startem testów bojowych (01.12.2026 r.). Poniżej przedstawiono podział prac z uwzględnieniem bezpiecznego narzutu buforowego (+20%). Zakres obejmuje również produkcyjną integrację bramki **PayU** oraz **odświeżenie katalogu urządzeń i cenników**.

### Zestawienie Pakietów Prac Inżynieryjnych:

| Pakiet Prac Technologicznych | Zakres i Zadania z Backlogu | Szacunek Bazowy | **Z Narzutem +20%** |
| :--- | :--- | :---: | :---: |
| **Pakiet 1: B2C Booking Flow** | Atomowa rezerwacja slotów (`B2C-BOOKING-FLOW`), prezentacja cen „od" (`B2C-PRICE-FROM`), mechanizm triage oraz exit-intent modal. | 20 h | **24,0 h** |
| **Pakiet 2: Lejek + Zaliczki PayU** | Przejścia T02–T05, akceptacja wyceny online z **bramką zaliczkową PayU**, generowanie protokołu montażowego T07–T08. | 26 h | **31,2 h** |
| **Pakiet 3: Powiadomienia i Kalendarze** | Bramka SMSAPI, transakcyjne szablony e-mail (`NTF-GATEWAY`), dwukierunkowa synchronizacja z Google Calendar floty. | 18 h | **21,6 h** |
| **Pakiet 4: Aplikacja Terenowa (Field App)** | Wersja PWA dla montażystów: lista zleceń, nawigacja geolokalizacyjna, checklista montażowa, wymóg 4 zdjęć, podpis klienta na ekranie. | 28 h | **33,6 h** |
| **Pakiet 5: Reklamacje, SLA i Karta 360** | Obsługa usterek z twardym SLA 48h, globalna wyszukiwarka klientów 360°, automatyczny cron powiadomień o serwisach rocznych. | 16 h | **19,2 h** |
| **Pakiet 6: Hardening, E2E i Wdrożenie** | Testy integracyjne Playwright E2E, logowanie Google SSO, monitoring Sentry, konfiguracja domen produkcyjnych i certyfikatów SSL. | 12 h | **14,4 h** |
| **Pakiet Dodatkowy A: Produkcyjne PayU** | Podpięcie produkcyjnego konta merchanta spółki, obsługa webhooków płatności, automatyczne zwroty, zabezpieczenie idempotencji. | ~10 h | **~12,0 h** |
| **Pakiet Dodatkowy B: Katalog Produktów** | Aktualizacja bazy klimatyzatorów, import cenników hurtowych, konfiguracja kompatybilności jednostek Single i Multi-split. | ~6 h | **~7,0 h** |
| **ŁĄCZNIE DO 30.11.2026 r.** | **Kompletny, przetestowany ekosystem gotowy do testów bojowych** | **136 h** | **~163 h** |

### Realność Harmonogramu Technologicznego:
* Przy udokumentowanym tempie pracy Michała z września (~119 h w 16 dni roboczych, średnio 9,3 h/dzień) budżet **~163 godzin jest w pełni osiągalny do 30 listopada z bezpiecznym zapasem**.
* **Zależność formalna:** Pełne testy produkcyjne PayU wymagają zarejestrowanej spółki z numerem KRS i kontem bankowym (druga połowa listopada). Kod bramki powstaje na środowisku testowym (sandbox), dzięki czemu testy bojowe 1 grudnia mogą wystartować w 100% zgodnie z planem.

---

## 2. Strategia Marketingowa (Ads Strategy)
### Przygotowanie w okresie testów, uruchomienie w fazie Go-Live

Kanały pozyskiwania ruchu (Google Ads, Meta Ads, SearchGPT / AEO) wymagają precyzyjnej hierarchii budżetowej. **Wszystkie kampanie, kreacje graficzne, frazy i grupy docelowe konfigurujemy podczas testów bojowych i przygotowania ekip (grudzień–luty), a budżety odpalamy w dniu publicznego Go-Live (marzec 2027 r.).**

```
                     STRUKTURA LEJKA POZYSKIWANIA KLIENTA KLIKKLIMA
   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
   │ GORĄCY POPYT (Najwyższa intencja): Google Ads (Search) + Wizytówka Google (Mapy) ➔ 60% Budżetu   │
   ├─────────────────────────────────────────────────────────────────────────────────────────────────┤
   │ POPYT ŚWIADOMY / RETARGETING: Meta Ads (Facebook + Instagram – domy / deweloperka) ➔ 35% Budżetu│
   ├─────────────────────────────────────────────────────────────────────────────────────────────────┤
   │ INNOWACJA I WYSZUKIWARKI AI: ChatGPT Ads / AEO (Odpowiedzi w modelach LLM)       ➔ 5% Budżetu   │
   └─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Google Ads (Search & Performance Max) — 60% Budżetu (Główny Filar Sprzedaży)
* **Mechanizm:** Przechwytywanie użytkowników wpisujących zapytania o natychmiastowej intencji zakupu (np. *„montaż klimatyzacji Warszawa”*, *„klimatyzator do mieszkania z montażem cennik”*).
* **Konwersja:** Ruch kierowany bezpośrednio do kalkulatora Triage z prezentacją ceny „od” oraz możliwością natychmiastowej rezerwacji terminu online.
* **Wizytówka Google Moja Firma:** Kluczowy bezpłatny kanał lokalny (30–40% zapytań z map). Zbieranie potwierdzonych recenzji ze zdjęciami po każdym montażu.

### 2. Meta Ads (Facebook & Instagram) — 35% Budżetu (Popyt Dedykowany & Retargeting)
* **Klienci deweloperscy i remontowi:** Targetowanie geolokalizacyjne na nowe osiedla mieszkaniowe. Przekaz edukacyjny: *„Zrób instalację podtynkową przed tynkami i wylewkami — uniknij kucia ścian w gotowym mieszkaniu”*.
* **Funkcja grzania jesienią i zimą:** Promocja klimatyzacji jako wysoce efektywnej pompy ciepła powietrze-powietrze (*„Ogrzewaj mieszkanie taniej niż prądem”*).
* **Dynamiczny retargeting:** Reklamy przypominające dla użytkowników, którzy porzucili konfigurator bez rezerwacji terminu.

### 3. ChatGPT Ads & AEO (Answer Engine Optimization) — 5% Budżetu (Innowacja)
* **Organiczne pozycjonowanie w modelach AI:** Wdrożenie mikrodanych Schema.org (JSON-LD), ustrukturyzowanych tabel cennikowych i baz wiedzy, dzięki którym asystenci AI (ChatGPT, Gemini, Perplexity) rekomendują KlikKlima jako zaufanego instalatora HVAC.
* **Płatne kampanie w botach AI:** Pilotażowe testy formatów reklamowych w wyszukiwarkach nowej generacji.

---

## 3. Szczegółowa Roadmapa Faza po Fazie (5 Faz Wdrożenia)

---

### FAZA 1: PRZYGOTOWANIE I FUNDAMENTY (do 30 listopada 2026 r.)
*Cel strategiczny:* Wejść w dzień 1 grudnia z gotowym systemem, zarejestrowaną spółką, zgłoszonym UDT, wzorami umów i podpisanymi rabatami hurtowymi.

| Obszar Działań | Zadania Michała (CTO) | Zadania Piotra (COO) |
| :--- | :--- | :--- |
| **Spółka i Prawo** | 1. Przygotowanie umowy spółki (51/49) oraz umowy wspólników.<br>2. Przygotowanie umowy licencyjnej IP i kodu na rzecz spółki. | 1. **Rejestracja spółki z o.o. w KRS w listopadzie** (wymóg formalny dla konta PayU).<br>2. Otwarcie rachunku bankowego spółki, wybór biura księgowego.<br>3. **Złożenie wniosku o certyfikat przedsiębiorstwa do UDT** (zgodnie z `PROCES-UZYSKANIA-CERTYFIKATU-UDT.md`). |
| **Technologia** | 1. **Dopięcie 100% developmentu (Pakiety 1–6) do 30.11.**<br>2. Produkcyjna integracja bramki PayU po rejestracji spółki.<br>3. Odświeżenie i wdrożenie katalogu urządzeń i cenników. | 1. Testy akceptacyjne formularzy wyceny i kalkulatora mocy.<br>2. Przekazanie specyfikacji technicznych preferowanych marek (np. Gree, Daikin, Rotenso). |
| **Operacje i Rynek** | — | 1. **Przygotowanie wzorów umów podwykonawczych** dla ekip montażowych.<br>2. Podpisanie umów handlowych z minimum 2 hurtowniami HVAC (rabaty B2B min. 35–45%).<br>3. Wstępna weryfikacja certyfikatów F-gaz, SEP i polis OC pierwszych ekip. |
| **Finanse i Cenniki** | 1. Wdrożenie algorytmicznych koszyków wycen i marż w systemie CRM. | 1. **Zatwierdzenie kompletnego modelu rozliczeniowego:** zaliczki 40–50%, siatka marżowa, taryfikator wynagrodzeń ekip.<br>2. Ostateczne zatwierdzenie cennika detalicznego na start. |
| **FINANSE** | — | **Zabezpieczenie kapitału obrotowego na okres przedstartowy (pokrycie OPEX, opłaty UDT i narzędzi).** |

---

### FAZA 2: TESTY BOJOWE / DRY RUN (1 grudnia 2026 r. – 31 stycznia 2027 r., 2 miesiące)
*Cel strategiczny:* Przetestować pełną maszynę operacyjną **na realnych klientach Piotra, po cichu — bez publicznego landing page i bez zewnętrznego marketingu**.

> [!IMPORTANT]
> **Zasada Testów Bojowych:** W tej fazie nie prowadzimy publicznej reklamy ani otwartego zbierania leadów. Do systemu wprowadzani są **wyłącznie realni klienci z bieżącej działalności Piotra**, którzy przechodzą 100% cyfrowej ścieżki:  
> `Wprowadzenie leada` ➔ `Audyt z aplikacją` ➔ `Wycena z koszyka` ➔ `Zaliczka online` ➔ `Zamówienie w hurtowni JIT` ➔ `Montaż` ➔ `Checklista + 4 zdjęcia` ➔ `Protokół cyfrowy`.

| Obszar Działań | Zadania Michała (CTO) | Zadania Piotra (COO) |
| :--- | :--- | :--- |
| **Testy Operacyjne** | 1. Bieżący monitoring spójności danych (geolokalizacja, zdjęcia, statusy w bazie).<br>2. **Natychmiastowe usuwanie błędów (hotfiksy) i stabilizacja platformy.** | 1. **Realizacja montaży u realnych klientów** z wykorzystaniem pełnej ścieżki systemu.<br>2. Praktyczna weryfikacja dostaw urządzeń w modelu Just-in-Time (JIT). |
| **Obsługa Klienta** | 1. Wdrożenie i konfiguracja modułu zgłoszeń i linii wsparcia. | 1. **Prowadzenie dyspozytorni i bieżący kontakt z klientami** (pomiar czasów reakcji). |
| **Przygotowanie GTM** | 1. Konfiguracja narzędzi analitycznych: GA4, Meta Pixel, Google Tag Manager.<br>2. Techniczne wdrożenie znaczników AEO / Schema.org pod wyszukiwarki AI. | 1. **Szczegółowe przygotowanie kampanii reklamowych:** dobór słów kluczowych, przygotowanie grafik, tekstów i budżetów. |
| **Formalności UDT** | — | 1. **Osobisty udział w kontroli inspektora UDT w grudniu.**<br>2. Uzyskanie protokołu pozytywnego i monitorowanie wpisu do rejestru UDT. |
| **FINANSE** | — | **0% dywidendy; kapitał obrotowy chroni płynność; przychody z montaży Piotra zasilają bieżące zakupy sprzętu.** |

---

### 🚦 BRAMA DECYZYJNA — WERYFIKACJA WYNIKÓW DRY RUN (koniec stycznia 2027 r.)

Przejście do etapu przygotowania sieci i publicznego startu następuje **wyłącznie po spełnieniu 10 twardych kryteriów akceptacyjnych**:

| # | Wskaźnik Sukcesu (KPI) | Wymagany Próg Zaliczenia |
| :---: | :--- | :--- |
| **1** | Montaże testowe zrealizowane pełną ścieżką w systemie | **Minimum 3–5 zakończonych instalacji** |
| **2** | Otwarte błędy krytyczne (P1/Blocker) w platformie | **Bezwzględne 0 błędów** (system w 100% stabilny) |
| **3** | Model zaliczkowy potwierdzony w praktyce | **100% zakupu urządzeń sfinansowane z zaliczek klientów** |
| **4** | Realna marża brutto na zleceniach pilotażowych | **Osiągnięty poziom ≥25–35% marży** |
| **5** | Terminowość logistyki i dostaw hurtowych JIT | **Minimum 95% dostaw na czas** |
| **6** | Generowanie protokołów montażowych i 4 zdjęć | **100% zleceń posiada kompletne protokoły i fotodokumentację** |
| **7** | Działanie linii wsparcia klienta i dyspozytorni | **Średni czas kontaktu z klientem <30–60 minut** |
| **8** | Certyfikat Przedsiębiorstwa UDT | **Certyfikat wpisany do oficjalnego rejestru online** |
| **9** | Baza produktów, cenniki i matryca uprawnień | **Zablokowane i wdrożone bez rozbieżności w systemie** |
| **10**| Gotowość materiałów reklamowych i landing page | **Wszystkie kampanie skonfigurowane, gotowe do włączenia** |

---

### FAZA 3: PRZYGOTOWANIE DO STARTU I ONBOARDING EKIP (luty 2027 r., 1 miesiąc)
*Cel strategiczny:* Wykorzystać w 100% ustabilizowany system do **zbudowania, przeszkolenia i zakontraktowania profesjonalnej sieci certyfikowanych instalatorów** przed otwarciem publicznego rynku.

> [!NOTE]
> **Dlaczego ta faza jest kluczowa:**  
> Sukces w branży HVAC zależy od jakości montażu. W lutym — mając w ręku działającą aplikację mobilną i certyfikat UDT — Piotr przeprowadza kompleksowy onboarding wykonawców. Nie wpuszczamy niesprawdzonych ekip na zlecenia z płatnych reklam. Każdy monter musi opanować aplikację terenową i standardy estetyczne KlikKlima.

| Obszar Działań | Zadania Michała (CTO) | Zadania Piotra (COO) |
| :--- | :--- | :--- |
| **Narzędzia Terenowe (Field App)** | 1. Asysta techniczna i bezpośrednie wsparcie aplikacji mobilnej podczas szkoleń ekip.<br>2. Szlifowanie ergonomii interfejsu (UX) na podstawie uwag instalatorów.<br>3. Przygotowanie interaktywnych wideoporadników i instrukcji PDF dla montażystów. | 1. **Rekrutacja i selekcja min. 4–6 profesjonalnych ekip monterskich** w rejonach startowych.<br>2. Weryfikacja jakości narzędzi, busów i referencji wykonawców. |
| **Szkolenia i Standardy Montażu** | — | 1. **Przeprowadzenie warsztatów szkoleniowych dla instalatorów:**<br>   • Obsługa aplikacji Field App (odbiór zlecenia, nawigacja, podpis klienta),<br>   • Rygorystyczny standard 4 zdjęć z montażu (estetyka korytek, próba ciśnieniowa, jednostka zewnętrzna, porządek po montażu),<br>   • Standardy kultury obsługi klienta KlikKlima (ochraniacze na buty, czystość). |
| **Umowy i Certyfikacja Floty** | — | 1. **Podpisanie kompletnych umów podwykonawczych** z ekipami (kary umowne za spóźnienia, standardy SLA).<br>2. Weryfikacja i rejestracja w systemie certyfikatów F-gaz, SEP i polis OC wykonawców.<br>3. Konfiguracja promieni dojazdu ekip (`promien_dzialania_km`) w CRM. |
| **Logistyka i Magazyn** | — | 1. Potwierdzenie z hurtowniami dedykowanych slotów odbioru urządzeń na marzec.<br>2. Zabezpieczenie stanów magazynowych najpopularniejszych modeli (Single/Multi-split). |
| **Ostatnie Szlify Przed Startem** | 1. Końcowe testy obciążeniowe serwera i bazy danych przed masowym ruchem.<br>2. Sprawdzenie poprawności zdarzeń konwersji w Google Analytics 4 i Meta Pixel. | 1. Ostateczna akceptacja kreacji reklamowych i harmonogramu budżetowego na marzec. |
| **FINANSE** | — | **Przygotowanie funduszu marketingowego na start kampanii (model 50/50); zero dywidendy.** |

---

### FAZA 4: PUBLICZNE URUCHOMIENIE RYNKU (GO-LIVE) (marzec 2027 r.)
*Cel strategiczny:* Wejść publicznie na rynek z pełną mocą marketingową, przetestowaną platformą i wdrożoną siecią instalatorów tuż przed nadejściem szczytu sezonu.

| Obszar Działań | Zadania Michała (CTO) | Zadania Piotra (COO) |
| :--- | :--- | :--- |
| **Start Techniczny** | 1. **Publiczne uruchomienie landing page i kalkulatora online.**<br>2. Ciągły monitoring wydajności (Core Web Vitals) i analiza zachowań (Hotjar/Clarity).<br>3. Zabezpieczenie bezawaryjności procesów rezerwacji i płatności PayU. | 1. **Dyspozytornia w pełnym reżimie operacyjnym:** kontakt telefoniczny z leadem w czasie <30 minut.<br>2. Codzienny nadzór nad płynnością przydziału zleceń do przeszkolonych ekip. |
| **Płatne Kampanie Ads** | 1. **Uruchomienie kampanii Google Ads i Meta Ads** na pełnych budżetach.<br>2. Codzienna analiza wskaźników efektywności: CAC (koszt pozyskania), CVR (konwersja). | 1. Bieżąca ocena jakości napływających leadów i feedback dla optymalizacji marketingu.<br>2. Finansowanie budżetu reklamowego we wspólnym parytecie 50/50. |
| **Realizacja i Jakość** | — | 1. Nadzór nad pierwszymi publicznymi montażami realizowanymi przez wdrożone ekipy.<br>2. Kontrola jakości 100% protokołów i fotodokumentacji spływającej do CRM. |
| **Budowa Reputacji** | — | 1. **Agresywne pozyskiwanie opinii w Google Moja Firma** po każdym udanym montażu (cel: minimum 15–20 nieskazitelnych opinii 5.0 w pierwszym miesiącu). |
| **FINANSE** | — | **100% wygenerowanej marży przeznaczane na reinwestycję i budowę poduszki płynnościowej.** |

---

### FAZA 5: SKALOWANIE SEZONOWE (kwiecień – sierpień 2027 r., szczyt popytu) + PUNKT DECYZYJNY
*Cel strategiczny:* Maksymalizacja zysków i udziału w rynku w okresie najwyższego zapotrzebowania na klimatyzację, z wykorzystaniem sprawdzonych kampanii i zaufanej sieci montażystów.

| Obszar Działań | Zadania Michała (CTO) | Zadania Piotra (COO) |
| :--- | :--- | :--- |
| **Rozwój Technologii** | 1. Uruchomienie automatycznego modułu przypomnień o serwisach rocznych.<br>2. Ciągłe testy A/B stron docelowych podnoszące konwersję.<br>3. Integracje API z systemami magazynowymi hurtowni HVAC. | 1. Zgłaszanie zapotrzebowania na nowe funkcje automatyzujące pracę dyspozytorni.<br>2. Wdrożenie procedur obsługi zgłoszeń gwarancyjnych w standardzie SLA 48h. |
| **Zarządzanie Flotą** | — | 1. Rozbudowa bazy wykonawców do **6–10 stałych, certyfikowanych ekip**.<br>2. Renegocjacja progów rabatowych w hurtowniach przy rosnącym wolumenie zakupowym. |
| **Skalowanie Sprzedaży** | 1. Zwiększanie budżetów na najlepiej konwertujące słowa kluczowe i grupy odbiorców.<br>2. Skalowanie ruchu z wyszukiwarek AI (AEO / SearchGPT). | 1. Utrzymanie płynności dostaw i montaży na poziomie **25–40 instalacji miesięcznie**.<br>2. Rygorystyczne egzekwowanie wskaźnika 100% terminowości wizyt. |
| **PUNKT DECYZYJNY** | — | **GŁÓWNY GO/NO-GO NA DALSZĄ EKSPANSJĘ REGIONALNĄ. Po osiągnięciu progu aktywacji finansowej następuje uruchomienie wypłat dywidendy wspólników.** |

---

## 4. Warstwa Finansowa: Kapitał Obrotowy i Polityka Gotówki

W strukturze spółki ściśle rozdzielamy **wynagrodzenie za bieżącą pracę operacyjną** (pensja / kontrakt menedżerski COO i CTO — stanowiący koszt uzyskania przychodu spółki) od **dywidendy ze zysku** (nagroda za wniesiony kapitał, wypłacana proporcjonalnie do posiadanych udziałów 51/49).

### Kapitał Obrotowy (Runway Przedstartowy)
Zaliczki od klientów finansują **w 100% zakup urządzeń i materiałów instalacyjnych (COGS)**, ale nie pokrywają kosztów stałych przed uruchomieniem sprzedaży.  
W okresie przedstartowym (**listopad 2026 r. – luty 2027 r.**) spółka musi sfinansować:
* Opłatę rejestracyjną i urzędową UDT (3 885,01 zł),
* Koszty rejestracji spółki z o.o., opłaty notarialne i sądowe,
* Polisy ubezpieczeniowe OC działalności instalatorskiej,
* Koszty infrastruktury serwerowej, domen i narzędzi programistycznych,
* Fundusz na start pierwszych kampanii marketingowych.

> **Wymóg finansowy:** Założyciele zabezpieczają uzgodniony kapitał obrotowy w listopadzie 2026 r. w celu zapewnienia płynności do momentu wejścia w fazę komercyjną.

### Polityka Dystrybucji Gotówki w Fazach Projektu:

| Faza Projektu | Ramy Czasowe | Zasady Zarządzania Gotówką i Zyskiem |
| :--- | :--- | :--- |
| **Faza 1: Przygotowanie i Fundamenty** | Listopad 2026 r. | **0% dywidendy.** Finansowanie formalności, UDT i narzędzi z kapitału obrotowego. |
| **Faza 2: Testy Bojowe (Dry Run)** | Grudzień 2026 r. – Styczeń 2027 r. | **0% dywidendy.** Przychody generowane z montaży u klientów Piotra zasilają zakupy sprzętu. |
| **Faza 3: Przygotowanie i Onboarding Ekip**| Luty 2027 r. | **0% dywidendy.** Przygotowanie funduszu reklamowego na start publiczny (parytet 50/50). |
| **Faza 4: Publiczny Start (Go-Live)** | Marzec 2027 r. | **0% dywidendy · 100% reinwestycji.** Budowa bezpiecznej poduszki płynnościowej (rezerwa na 2–3 miesiące kosztów stałych). |
| **PRÓG AKTYWACJI DYWIDENDY** | Kwiecień 2027 r. (start sezonu) | Wypłaty zysku startują po spełnieniu dwóch warunków łącznie:<br>1. Zabezpieczona nienaruszalna poduszka finansowa na koncie,<br>2. Stabilny wolumen sprzedaży na poziomie min. 20–25 montaży miesięcznie. |
| **Faza 5: Skalowanie Sezonowe** | Kwiecień – Sierpień 2027 r. | **60–70% reinwestycji w kapitał obrotowy / 30–40% wypłaty dywidendy** w transzach kwartalnych. |

---

## 5. Matryca Ryzyk i Mitygacji

| Zidentyfikowane Ryzyko | Potencjalny Wpływ | Plan Mitygacji i Działania Zapobiegawcze |
| :--- | :--- | :--- |
| **Napięty harmonogram developmentu do 30.11** | Opóźnienie startu testów bojowych | Priorytet absolutny dla prac programistycznych; tempo z września daje bezpieczny margines; wdrożenie planu awaryjnego (zakres MVP do Dry Run). |
| **Wymóg spółki do rejestracji PayU** | Późne testy produkcyjne bramki | Kod płatności powstaje wcześniej na środowisku sandbox; w razie opóźnienia weryfikacji bankowej testy bojowe ruszają z przelewem tradycyjnym, a PayU wdrażamy w trakcie grudnia. |
| **Czas trwania procedury UDT (3–6 tygodni)** | Blokada zakupu czynnika w hurtowniach | Złożenie wniosku w pierwszej połowie listopada; cotygodniowe monitorowanie w urzędzie; pełny bufor czasowy na kontrolę w grudniu i wpis w styczniu. |
| **Brak kapitału obrotowego na start** | Paraliż formalności i marketingu | Precyzyjne zdefiniowanie i wniesienie wkładów założycielskich na pokrycie OPEX w listopadzie. |
| **Zaangażowanie Piotra w pełnym wymiarze** | Zagrożenie realizacji testów i szkoleń | Formalna umowa wspólników; rozliczenie kamieni milowych 30/60/90; przejrzyste kryteria bramy decyzyjnej. |
| **Onboarding ekip monterskich w lutym** | Ryzyko błędów montażowych w sezonie | Dedykowany, 1-miesięczny bufor w lutym; praktyczne warsztaty ze standardu 4 zdjęć; dopuszczenie do zleceń tylko ekip ze zweryfikowanym F-gaz i polisą OC. |
| **Sezonowość branży klimatyzacji** | Spadek popytu poza sezonem letnim | Harmonogram idealnie celuje w start publiczny w marcu, dzięki czemu spółka wchodzi w szczyt popytu (kwiecień–sierpień) z przeszkoloną siecią i dojrzałą technologią. |

---

## 6. Podsumowanie Zobowiązań Wzajemnych

```
   PARYTET PARTNERSKI KLIKKLIMA — SPÓŁKA LISTOPAD 2026, START BOJOWY 01.12.2026
   ┌────────────────────────────────────────────────────────────────────────────┐
   │ MICHAŁ (Wkład technologiczny: ~460–500 h łącznie):                         │
   │  • Ponad 360 h pracy już zrealizowanej (kapitał IP wyceniony na >300 tys.) │
   │  • ~163 h na domknięcie całego ekosystemu + PayU + katalog do 30.11.2026 r.│
   │  • Rola: CTO, stabilność platformy, analityka, narzędzia dla ekip          │
   ├────────────────────────────────────────────────────────────────────────────┤
   │ PIOTR (Wkład operacyjny: pełny etat 140–160 h/miesiąc od 01.12.2026 r.):    │
   │  • Listopad: rejestracja spółki, wniosek UDT, umowy podwykonawcze, cenniki │
   │  • Grudzień–Styczeń: testy bojowe na realnych klientach, asysta kontroli UDT│
   │  • Luty: pełny onboarding, warsztaty i zakontraktowanie sieci 4–6 ekip     │
   │  • Marzec+: 100% odpowiedzialności za dyspozytornię, logistykę i montaże   │
   ├────────────────────────────────────────────────────────────────────────────┤
   │ WSPÓLNE DECYZJE I FINANSE:                                                 │
   │  • Kapitał obrotowy zabezpieczony (listopad 2026 – luty 2027 r.)           │
   │  • Budżet reklamowy (Google/Meta) finansowany w parytecie 50/50            │
   │  • Brama decyzyjna weryfikująca 10 KPI przed startem publicznym            │
   └────────────────────────────────────────────────────────────────────────────┘
```

---

*Dokument stanowi wewnętrzny materiał strategiczny do ustaleń partnerskich założycieli spółki KlikKlima Sp. z o.o.*
