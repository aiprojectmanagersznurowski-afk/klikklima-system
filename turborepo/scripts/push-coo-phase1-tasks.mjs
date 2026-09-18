/**
 * Skrypt tworzący i przypisujący wszystkie zadania COO (Piotr) dla Fazy 1 (do 30.11.2026 r.)
 * Tablica: KlikKlima - Backlog Produktów (6aa2a798d6da4287d0cba862)
 * Lista: 👔 Zadania COO (Piotr) — Faza 1 (do 30.11) [6aac2b032c20c2c5e9fb31b9]
 */

const apiKey = "6c97357d3659db40dfc1674beb00fa1d";
const token =
  "ATTAb2d94c6bb94c24e4f00c2520c259b927540da2fe972a464c189be6f1177edb9dA1E30578";
const PIOTR_MEMBER_ID = "6aaa484e9e96d7531e228b40"; // piosznu
const COO_LIST_ID = "6aac2b032c20c2c5e9fb31b9";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 1. Istniejące karty do przeniesienia do listy COO i zaktualizowania
const EXISTING_CARDS_TO_UPDATE = [
  {
    id: "6aa7b685a235f264a85f9c44",
    name: "[COO-07] Baza podwykonawców: Zbudować listę 30–50 firm instalacyjnych z Wrocławia i okolic",
    desc: `Cel: Zbudowanie bazy kontaktowej instalatorów HVAC (Wrocław, Trzebnica, Oleśnica, Oława, Dzierżoniów, Legnica) do akcji rekrutacyjnej.

Zakres działań:
- Wykorzystanie bazy CEIDG/REGON po kodzie PKD 43.22.Z, Panoramy Firm oraz kontaktów branżowych,
- Zgromadzenie min. 30–50 firm z danymi: Nazwa, NIP, Osoba kontaktowa, Telefon, Miasto/Powiat,
- Wprowadzenie kontaktów do nowego modułu prospektów w CRM (CRM-PROSPECTS).

Termin: 20 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Dokument źródłowy: OCZEKIWANY-WKLAD-OPERACYJNY-COO.md (Obszar O3) oraz ROADMAP-GTM-I-PROGNOZA-DEVELOPMENTU.md.`,
  },
  {
    id: "6aa7b6b38047613691a026c6",
    name: "[COO-08] Cold calling: Przeprowadzić pierwsze rozmowy i przetestować prospekt rozliczeniowy",
    desc: `Cel: Bezpośredni kontakt telefoniczny z zebraną bazą instalatorów i zbadanie gotowości do współpracy na sezon 2027.

Zakres działań:
- Wykonanie telefonów do zebranej listy kontaktów,
- Zaprezentowanie modelu współpracy KlikKlima (taryfikator stawek, zlecenia z dostawą sprzętu JIT na budowę, aplikacja Field App z 4 zdjęciami),
- Zanotowanie uwag wykonawców i zapisanie statusów w CRM,
- Wyłonienie wstępnej grupy min. 6–8 ekip zainteresowanych lutowym onboardingiem i szkoleniem.

Termin: 30 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Kryterium sukcesu: Min. 6 ekip zainteresowanych spotkaniem/szkoleniem przed sezonem.`,
  },
  {
    id: "6aa7b6e872677ed92be751d3",
    name: "[COO-05] Dystrybucja HVAC: Pobrać cenniki i katalogi urządzeń 2027 (Iglotech, Schiessl itp.)",
    desc: `Cel: Pozyskanie najnowszych cenników hurtowych i kart katalogowych urządzeń na sezon 2027 do zasilenia bazy danych.

Zakres działań:
- Kontakt z oddziałem Iglotech Wrocław (https://iglotech.com/kontakt/wroclaw/) oraz Schiessl Polska,
- Pobranie cenników hurtowych dla marek: Gree, Daikin, Rotenso, AUX, Fuji,
- Przekazanie plików do Michała w celu aktualizacji bazy produktów i wyliczenia cen „od” w konfiguratorze.

Termin: 25 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Kryterium sukcesu: Przekazanie kompletnych cenników hurtowych w formacie Excel/PDF.`,
  },
];

// 2. Nowe karty zadań COO dla Fazy 1 do utworzenia w Trello
const NEW_COO_TASKS = [
  {
    name: "[COO-01] Rejestracja spółki KlikKlima Sp. z o.o. w KRS i otwarcie rachunku bankowego",
    desc: `Cel formalny: Powołanie podmiotu prawnego wymaganego do Certyfikatu UDT, konta produkcyjnego PayU oraz umów hurtowych.

Zakres działań (we współpracy z Michałem):
1. Podpisanie umowy spółki z o.o. (wariant S24 lub notarialny, podział 51% Michał / 49% Piotr — bezpiecznik decyzyjny "Złoty 1%"),
2. Złożenie wniosku o wpis do Krajowego Rejestru Sądowego (KRS),
3. Uzyskanie numerów NIP i REGON,
4. Wpłata kapitału zakładowego (5 000 zł),
5. Otwarcie rachunku bankowego spółki (niezbędne do opłaty UDT i aktywacji merchanta PayU).

Termin realizacji: 10 listopada 2026 r.
Odpowiedzialny: Piotr (COO) & Michał (CEO)
Brama decyzyjna: GATE-1.2 w SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md.`,
  },
  {
    name: "[COO-02] UDT Krok 1: Umowa najmu aparatury technicznej i wzorcowanie wagi/wykrywacza",
    desc: `Cel: Zabezpieczenie legalnego tytułu prawnego do aparatury F-gaz zgodnie z Ustawą z dnia 15 maja 2015 r. (wariant ekonomiczny bez kupowania nowego sprzętu).

Zakres działań:
1. Podpisanie umowy najmu wyposażenia technicznego od podwykonawcy lub firmy Piotra (za symboliczny czynsz 100–300 zł/mc) z wpisaniem modeli i numerów seryjnych:
   - Stacja do odzysku czynnika chłodniczego,
   - Dwustopniowa pompa próżniowa z wakuometrem (< 270 Pa),
   - Zestaw manometrów z wężami ciśnieniowymi,
   - Butla dwuzaworowa do odzysku z legalizacją UDT (data wybita na kołnierzu),
   - Zestaw do lutowania twardego / zaciskarka, kielicharka, obcinarka, gradownik,
   - Butla z suchym azotem z reduktorem do min. 35–40 bar.
2. BEZWZGLĘDNIE WYMAGANE: Zlecenie i odebranie aktualnych świadectw wzorcowania (kalibracji) z akredytowanego laboratorium:
   - Elektroniczna waga chłodnicza (dokładność min. 5 g) — ważne 1 rok,
   - Elektroniczny wykrywacz nieszczelności (czułość min. 5 g/rok) — ważne 1 rok.

Termin realizacji: 15 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Dokument źródłowy: Krok 1.1 w PROCES-UZYSKANIA-CERTYFIKATU-UDT.md.`,
  },
  {
    name: "[COO-03] UDT Krok 2: Personel certyfikowany F-Gaz (Kat. I) i procedury techniczne",
    desc: `Cel: Zabezpieczenie personelu technicznego oraz dokumentacji Systemu Prowadzenia Dokumentacji F-Gaz.

Zakres działań:
1. Umowa z certyfikowanym instalatorem posiadającym bezterminowy Certyfikat Personalny F-gaz Kat. I (Piotr lub wyznaczony instalator),
2. Podpisanie oświadczenia instalatora o dyspozycyjności technicznej i zatrudnieniu w KlikKlima Sp. z o.o.,
3. Wdrożenie i zatwierdzenie Systemu Prowadzenia Dokumentacji:
   - Instrukcja postępowania z fluorowanymi gazami cieplarnianymi,
   - Procedury prób ciśnieniowych azotem (min. 35 bar) i próżni (< 270 Pa),
   - Zasady ewidencji odzyskanego i dopełnionego czynnika chłodniczego (R32).

Termin realizacji: 18 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Dokument źródłowy: Krok 1.2 i 1.3 w PROCES-UZYSKANIA-CERTYFIKATU-UDT.md.`,
  },
  {
    name: "[COO-04] UDT Krok 3: Złożenie wniosku w portalu eUDT i opłata ewidencyjna (3 885 zł)",
    desc: `Cel: Formalne wszczęcie postępowania administracyjnego w Urzędzie Dozoru Technicznego.

Zakres działań:
1. Rejestracja konta firmowego KlikKlima Sp. z o.o. w portalu eUDT (https://eudt.gov.pl),
2. Wypełnienie formularza wniosku o Certyfikat dla Przedsiębiorstwa (zakres: instalowanie oraz konserwacja lub serwisowanie stacjonarnych urządzeń chłodniczych, klimatyzacyjnych i pomp ciepła),
3. Załączenie kompletu dokumentów:
   - Umowa najmu aparatury + świadectwa wzorcowania wagi i wykrywacza,
   - Kopia certyfikatu F-gaz Kat. I personelu + oświadczenie o zatrudnieniu,
   - Procedury Systemu Prowadzenia Dokumentacji.
4. Wykonanie przelewu opłaty ewidencyjnej w kwocie 3 884,93 zł na konto właściwego Oddziału UDT (Wrocław) i załączenie potwierdzenia,
5. Podpisanie wniosku Profilem Zaufanym / podpisem kwalifikowanym.

Termin realizacji: 20 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Brama decyzyjna: GATE-1.3 w SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md.`,
  },
  {
    name: "[COO-06] Negocjacje umów ramowych z min. 2 hurtowniami HVAC (rabaty B2B >= 35–45%)",
    desc: `Cel: Zagwarantowanie łańcucha dostaw klimatyzatorów z rabatem zapewniającym marżę spółki >= 28–35% oraz dostawami Just-in-Time.

Zakres działań:
1. Spotkania handlowe z dyrektorami oddziałów min. 2 wiodących hurtowni (np. Iglotech Wrocław, Schiessl, Berner / Klima-Therm),
2. Negocjacja warunków handlowych:
   - Rabat handlowy minimum 35–45% od cen katalogowych na urządzenia (Gree, Daikin, Rotenso, AUX),
   - Ceny hurtowe na materiały montażowe (rury miedziane, wsporniki, pompki skroplin, korytka, przewody),
3. Wynegocjowanie logistyki Just-in-Time (JIT):
   - Poranny odbiór przez ekipę w dniu montażu lub dostawa na budowę w oknie 7:00–8:30,
   - Zerowy kapitał zamrożony w magazynie po stronie KlikKlima.
4. Podpisanie umów ramowych i założenie kont B2B.

Termin realizacji: 25 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Brama decyzyjna: GATE-1.4 w SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md.`,
  },
  {
    name: "[COO-09] Zatwierdzenie taryfikatora koszykowego i wzoru umowy podwykonawczej B2B",
    desc: `Cel: Ostateczna akceptacja modelu finansowego rozliczeń podwykonawców oraz wzorców prawnych umów B2B.

Zakres działań:
1. Weryfikacja i akceptacja stawek montażowych zdefiniowanych w KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE.md:
   - INSTALL_SMALL: 1 200 – 1 300 zł brutto,
   - INSTALL_STANDARD: 1 400 – 1 600 zł brutto,
   - INSTALL_PHASE_1: 1 000 – 1 200 zł brutto,
   - INSTALL_PHASE_2: 600 – 700 zł brutto,
   - SERVICE: 130 zł brutto,
   - INCIDENT: 150 – 200 zł brutto.
2. Zatwierdzenie wzoru umowy o współpracy B2B z kluczowymi klauzulami:
   - Wypłata wynagrodzenia wyłącznie po akceptacji protokołu i 4 poprawnych zdjęć w Field App,
   - 100% rękojmi ekipy za wady montażowe (bezpłatne usuwanie usterek w SLA 24–48h bez kosztów dla KlikKlima),
   - Obowiązkowa polisa OC ekipy na min. 200 000 zł,
   - Zakaz konkurencji i podbierania klientów KlikKlima.

Termin realizacji: 25 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Brama decyzyjna: GATE-1.5 w SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md.`,
  },
  {
    name: "[COO-10] Wytypowanie 3–5 realnych klientów do pilotażu Dry Run (grudzień 2026)",
    desc: `Cel: Przygotowanie testów bojowych na żywym organizmie (Faza 2: Dry Run, grudzień 2026 – styczeń 2027).

Zakres działań:
1. Wytypowanie 3–5 realnych klientów z bieżących zapytań Piotra planujących montaż w grudniu/styczniu,
2. Wprowadzenie ich do systemu KlikKlima i przeprowadzenie pełnej ścieżki cyfrowej:
   - Złożenie zlecenia i rezerwacja slotu,
   - Wybór oferty z koszyka wycen,
   - Pobranie zaliczki 40–50% na zakup sprzętu,
   - Zakup JIT w hurtowni,
   - Realizacja montażu z użyciem aplikacji Field App,
   - Zamknięcie protokołu z kompletem 4 zdjęć i podpisem klienta.
3. Cel testów: Weryfikacja procedur w praktyce przed startem komercyjnym.

Termin realizacji: 28 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Brama decyzyjna: Kryterium 1 Bramki Gate 2 w SYSTEM-KPI-I-BRAMKI-DECYZYJNE.md.`,
  },
  {
    name: "[COO-11] Przygotowanie bazy dotychczasowych klientów do strumienia MRR (serwisy roczne)",
    desc: `Cel: Przygotowanie fundamentu pod powtarzalny strumień przychodów z corocznych serwisów gwarancyjnych (MRR).

Zakres działań:
1. Zebranie i uporządkowanie bazy dotychczasowych klientów z historii działalności instalatorskiej Piotra (imię, nazwisko, telefon, adres, model klimatyzatora, data montażu),
2. Przygotowanie danych do importu do bazy CRM KlikKlima,
3. Przygotowanie planu pozyskania zgód RODO i uruchomienia automatycznych powiadomień SMS o zbliżającym się przeglądzie rocznym (koszyk SERVICE: 280 zł B2C / 130 zł montażysta / 130 zł czystej marży spółki na 1 serwisie).

Termin realizacji: 30 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Dokument źródłowy: OCZEKIWANY-WKLAD-OPERACYJNY-COO.md (Filar 3 i MKT-04).`,
  },
  {
    name: "[COO-12] Wykupienie polisy ubezpieczeniowej OC działalności gospodarczej KlikKlima",
    desc: `Cel: Zabezpieczenie majątku i działalności operacyjnej spółki przed roszczeniami i szkodami instalacyjnymi.

Zakres działań:
1. Porównanie ofert brokerskich dla spółki z o.o. wykonującej prace instalacyjne HVAC,
2. Wykupienie polisy OC z zakresem:
   - Prace montażowe klimatyzacji i pomp ciepła,
   - Odpowiedzialność za podwykonawców (klauzula podwykonawców),
   - Szkody spowodowane zalaniem / wyciekiem skroplin,
   - Prace niebezpieczne pożarowo (lutowanie palnikiem),
   - Suma gwarancyjna: minimum 500 000 – 1 000 000 zł.
3. Opłacenie pierwszej raty składki polisy.

Termin realizacji: 30 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Dokument źródłowy: OCZEKIWANY-WKLAD-OPERACYJNY-COO.md (Obszar O5).`,
  },
  {
    name: "[COO-13] Założenie konta spółki w rejestrze CRO (Centralny Rejestr Operatorów)",
    desc: `Cel: Zapewnienie 100% zgodności z wymogami ustawy F-gazowej w zakresie ewidencji urządzeń i substancji kontrolowanych.

Zakres działań:
1. Rejestracja profilu KlikKlima Sp. z o.o. w systemie CRO (Instytut Chemii Przemysłowej / www.cro.ichp.pl),
2. Przygotowanie szablonów Kart Urządzeń dla instalacji o napełnieniu >= 5 ton ekwiwalentu CO2 (lub hermetycznych >= 10 ton),
3. Przygotowanie rejestru ewidencji ilości czynnika zakupionego, zużytego i odzyskanego (obowiązkowe coroczne sprawozdanie do BDS do 28 lutego).

Termin realizacji: 30 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Dokument źródłowy: OCZEKIWANY-WKLAD-OPERACYJNY-COO.md (Obszar O5).`,
  },
  {
    name: "[COO-14] Metoda wyceny w Triage B2C: Algorytm cen „od” i definicja montażu standardowego",
    desc: `Cel: Precyzyjne zdefiniowanie parametrów kalkulatora B2C Triage oraz twardej granicy montażu standardowego, na bazie której system prezentuje klientowi cenę „od”.

Zakres działań:
1. Potwierdzenie definicji „Montażu Standardowego” zawartego w cenie bazowej konfiguratora:
   - Długość instalacji chłodniczej freonowej: do 3 metrów bieżących,
   - Przewiert przez ścianę: 1 otwór w ścianie murowanej do 40 cm (bez żelbetu),
   - Montaż jednostki zewnętrznej: do wysokości 2,5 m na standardowym wsporniku ściennym lub stopach podłogowych z wibroizolacją,
   - Odprowadzenie skroplin: grawitacyjne do 5 metrów,
   - Zasilanie elektryczne: doprowadzenie do istniejącego gniazda/punktu elektrycznego do 3 metrów,
   - Próba szczelności azotem (min. 35 bar), próżnia (< 270 Pa) i uruchomienie.
2. Opracowanie i zatwierdzenie metody wyceny w Triage:
   - Zasady doboru mocy w konfiguratorze (powierzchnia/kubatura m3, stopień nasłonecznienia południe/zachód, piętro/poddasze, przeszklenia),
   - Ustalenie narzutu buforowego dla cen prezentowanych w internecie (ochrona marży spółki przed wizją lokalną).

Termin realizacji: 22 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Dokument powiązany: KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE.md oraz B2C-PRICE-FROM.`,
  },
  {
    name: "[COO-15] Metoda wyceny w Field App: Formularz audytorski i katalog prac dodatkowych",
    desc: `Cel: Standaryzacja pracy audytora technicznego na wizji lokalnej i wdrożenie w Field App sztywnego cennika pozycji niestandardowych.

Zakres działań:
1. Opracowanie checklisty audytorskiej w Field App:
   - Pomiary kubatury, dobór trasy chłodniczej, weryfikacja podłoża i nośności ścian,
   - Weryfikacja instalacji elektrycznej (obciążalność bezpieczników, uziemienie).
2. Zdefiniowanie katalogu i stawek za prace dodatkowe wykraczające poza montaż standardowy:
   - Dopłata za każdy dodatkowy metr instalacji freonowej powyżej 3m (rura miedziana w otulinie + przewód sterujący + korytko),
   - Kucie bruzd podtynkowych pod instalację (w cegle, porothermie oraz w betonie/żelbecie),
   - Zastosowanie pompki skroplin (pompka ścienna / podtynkowa + zasilanie),
   - Przewierty przez stropy lub ściany żelbetowe,
   - Montaż jednostki zewnętrznej na wysokości pow. 2,5 m (konieczność rusztowania lub zwyżki/podnośnika koszowego),
   - Specjalne wsporniki dachowe, klatki antykradzieżowe, przedłużanie kabli zasilających.
3. Zatwierdzenie procedury natychmiastowego generowania wiążącej oferty handlowej w Field App do cyfrowego podpisu przez klienta.

Termin realizacji: 26 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Dokument powiązany: OCZEKIWANY-WKLAD-OPERACYJNY-COO.md (Obszar O1) oraz FLD-QUOTE-BASKET-SELECT.md.`,
  },
  {
    name: "[COO-16] Polityka wynagradzania podwykonawców: Prowizje z prac dodatkowych i audytów",
    desc: `Cel: Wdrożenie przejrzystego regulaminu finansowego dla ekip montażowych i audytorów, eliminującego konflikty i spory rozliczeniowe.

Zakres działań:
1. Ustalenie podziału przychodów z prac dodatkowych (powyżej montażu standardowego):
   - Procentowy split między ekipą a KlikKlima z dopłat za dodatkowe metry instalacji, bruzdowanie i pompki (np. 70–80% dla ekipy za robociznę / 20–30% marży handlowej spółki na materiałach),
2. Zasady wynagradzania audytorów za wizję lokalną:
   - Wynagrodzenie ryczałtowe za audyt (np. 150 zł brutto),
   - Mechanizm rozliczenia, gdy klient podpisuje umowę (wliczenie audytu w cenę) vs gdy rezygnuje,
3. System premiowo-motywacyjny dla ekip (Quality Bonus):
   - Premia kwartalna za brak usterek montażowych, wzorowe 4 zdjęcia i wysoki NPS,
4. Twarde zasady potrąceń i kar umownych:
   - Koszt ponownego dojazdu do usterki z winy montażysty (bezpłatna naprawa w 24–48h na koszt ekipy).

Termin realizacji: 27 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Dokument powiązany: KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE.md i OCZEKIWANY-WKLAD-OPERACYJNY-COO.md.`,
  },
  {
    name: "[COO-17] Uzupełnienie cen dla elementów cennika (kluczowy element wycen w Field App i Triage)",
    desc: `Cel: Dokończenie uzupełnienia stawek kosztów zakupu netto oraz cen sprzedaży brutto/netto dla wszystkich pozycji cennika kosztorysowego (35 pozycji materiałów, robocizny i prac dodatkowych), stanowiącego fundament silnika wycen w Field App (audyt na żywo) oraz konfiguratorze Triage B2C (wycena „od” i pozycje ponadstandardowe).

Kontekst biznesowo-techniczny:
Zgodnie ze specyfikacją FIELD-APP-PLAN.md (sekcja 4.3) oraz DEFINICJA-MONTAZU-STANDARDOWEGO.md, zaliczki i umowy w KlikKlima opierają się na precyzyjnym koszcie zakupu i cenie sprzedaży, a nie na sztywnym procencie. Zaliczka pobierana przed montażem = Urządzenia + Pozycje z flagą FZ (materiały zamawiane JIT), a robocizna rozliczana jest na fakturze końcowej. Brak kompletnego cennika blokuje automatyczną wycenę na audycie i kalkulator Triage.

Zakres działań Piotra (COO):
1. Uzupełnienie stawek w arkuszu „Formularz wyceny” / katalogu 35 pozycji:
   - Koszt zakupu netto dla spółki (ceny hurtowe materiałów po rabatach),
   - Cena sprzedaży netto i brutto dla klienta B2C (gwarantująca marżę brutto spółki min. 28–35%),
   - Jednostka miary (JM: szt., mb, kpl., ryczałt).
2. Podział na kategorie i oznaczenie flagi zaliczkowej (FZ):
   - Kategoria: Mat (Materiał), Rob (Robocizna), MR (Materiał + Robocizna),
   - Flaga FZ (Faktura Zaliczkowa): oznaczenie pozycji wymagających wcześniejszego zakupu materiałów (np. 9 z 35 pozycji: pompki, przejścia dachowe, rury powyżej standardu, nietypowe wsporniki).
3. Wycena kluczowych pozycji niestandardowych (zgodnie z DEFINICJA-MONTAZU-STANDARDOWEGO.md):
   - Instalacja chłodnicza pow. 3 mb (stawka za mb dla 1/4"-3/8" oraz 1/4"-1/2"),
   - Pompka skroplin (cicha pompka ścienna / podtynkowa + montaż i zasilanie),
   - Kucie bruzd podtynkowych w ścianie (stawka za mb w cegle/gazobetonie vs w zbrojonym żelbecie),
   - Przewiert w zbrojonym żelbecie wiertnicą diamentową,
   - Dedykowana linia zasilająca z rozdzielnicy (przewód 3x2.5 mm² + montaż bezpiecznika B16/RCBO),
   - Wsporniki dachowe na dach skośny oraz klatki zabezpieczające agregat.
4. Przekazanie kompletnego cennika do Michała:
   - Gotowy arkusz trafia do zasilenia tabeli price_list_items / cennik_uslug w PostgreSQL i spięcia z kodem kalkulatorów.

Termin realizacji: 24 listopada 2026 r.
Odpowiedzialny: Piotr (COO)
Dokumenty źródłowe: DEFINICJA-MONTAZU-STANDARDOWEGO.md, FIELD-APP-PLAN.md (sekcja 4.3), KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE.md.`,
  },
];

async function run() {
  console.log(
    "=== 1. Aktualizacja i przenoszenie istniejących zadań do listy COO ===",
  );
  for (const card of EXISTING_CARDS_TO_UPDATE) {
    console.log(
      `Przenoszenie i przypisywanie karty: "${card.name}" (${card.id})...`,
    );
    const url = `https://api.trello.com/1/cards/${card.id}?idList=${COO_LIST_ID}&name=${encodeURIComponent(card.name)}&desc=${encodeURIComponent(card.desc)}&idMembers=${PIOTR_MEMBER_ID}&key=${apiKey}&token=${token}`;
    const res = await fetch(url, { method: "PUT" });
    if (!res.ok) {
      console.error(` -> Błąd [${res.status}]:`, await res.text());
    } else {
      console.log(` -> Sukces! Przypisano do Piotra.`);
    }
    await sleep(250);
  }

  console.log(
    "\n=== 2. Tworzenie nowych zadań COO dla Fazy 1 (do 30.11.2026) ===",
  );
  for (const task of NEW_COO_TASKS) {
    console.log(`Tworzenie zadania: "${task.name}"...`);
    const url = `https://api.trello.com/1/cards?idList=${COO_LIST_ID}&name=${encodeURIComponent(task.name)}&desc=${encodeURIComponent(task.desc)}&idMembers=${PIOTR_MEMBER_ID}&key=${apiKey}&token=${token}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      console.error(` -> Błąd tworzenia [${res.status}]:`, await res.text());
    } else {
      const created = await res.json();
      console.log(
        ` -> Utworzono kartę ID: ${created.id}, przypisano do: ${created.idMembers.join(", ")}`,
      );
    }
    await sleep(250);
  }

  console.log(
    "\n✅ Wszystkie zadania COO dla Fazy 1 zostały pomyślnie utworzone i przypisane do Piotra!",
  );
}

run().catch((err) => {
  console.error("Błąd krytyczny:", err);
  process.exit(1);
});
