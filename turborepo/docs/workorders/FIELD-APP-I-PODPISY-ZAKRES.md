# Zakres projektu: Field App + podpis elektroniczny

> **Status: ZATWIERDZONY (2026-09-23).** D1–D14 rozstrzygnięte przez Michała. Otwarte pozostają wyłącznie
> treści dokumentów prawnych i odpowiedzi na pytania prawne z D5 — nie blokują etapów 1–4. To nie jest Work Order i nie jest kontrakt. Nic z tego dokumentu nie
> trafiło jeszcze do `contracts/`. Z zatwierdzonych punktów powstaną wpisy w rejestrze wymagań (okno
> kontraktowe, `contract-steward`), a dopiero potem Work Ordery.
>
> Przygotował: `spec-analyst`, 2026-09-21. Stan repozytorium sprawdzony tego samego dnia.
> Rozdziały 1, 5–11 przeliczone po decyzjach z 2026-09-21 (wariant React Native, obie ścieżki)
> i uzupełnione po decyzjach D5–D9 z 2026-09-23.

**Jak czytać:** idziesz od góry do dołu i zaznaczasz `[x]` przy opcji, którą wybierasz, albo przy punkcie
zakresu, który potwierdzasz. Pola bez zaznaczenia uznaję za **niezatwierdzone**, a nie za zgodę.
Identyfikatory techniczne są w nawiasach, żeby dało się je później odnaleźć w kodzie.

---

## 0. Rozstrzygnięcia z 2026-09-21 i 2026-09-23

| Decyzja | Wybór | Skutek dla zakresu |
|---|---|---|
| **D1** Platforma | **C: React Native + Expo** (`apps/field-app`). Decyzja D1 z 2026-08-20 **zostaje w mocy** | Wracają: automatyczny SMS „w drodze” przy 3 km (geolokalizacja w tle), Skia do podpisu, `expo-sqlite` do pracy bez zasięgu. Dochodzą: warstwa API (D2), dystrybucja przez sklepy (EAS, TestFlight, Play Console), drugi zestaw testów (Jest + RNTL, E2E Maestro). Dokumenty mówiące o PWA (S1) są **dryfem** do sprostowania |
| **D2** Warstwa zapisu | **Route Handlery współdzielące `can()` i Prismę** — rekomendacja (b) dla wariantu React Native, jako aneks ADR-013 do ADR-001. **Potwierdzone 2026-09-23** | Odrzucone: `supabase-js` + RLS z urządzenia (druga implementacja uprawnień w SQL). Jedna funkcja domenowa obsługuje panel i aplikację. Nowe wymaganie `FLD-API-LAYER` |
| **D3** Kolejność | **Obie ścieżki (audytor i monter) w pełnym zakresie**. Harmonogram może się przesunąć | Nowa kolejność etapów w rozdziale 7. Termin 30.11 nie jest już celem dla całości |
| **D4** Podpis | **Wszystkie rekomendacje:** TSA obowiązkowy (D4.1); OTP SMS obowiązkowy w podpisie zdalnym, na miejscu nie (D4.2); klient podpisuje protokół odbioru i umowę montażu; protokół serwisowy i zgoda na zdjęcia w social media poza zakresem (D4.3) | Rodzina `FLD-SIGN-*` w całości, łącznie z `FLD-SIGN-REMOTE-OTP` |
| **D5** Dokumenty prawne (2026-09-23) | **Jeden pakiet:** umowa montażu, pouczenie o odstąpieniu, formularz odstąpienia, oświadczenie o żądaniu wcześniejszego montażu, karta podpisu, klauzule RODO, zgoda na doręczenie mailem. **Treści zaparkowane** — Michał je wypracuje i podmieni | Katalog `docs/legal/` utworzony, w nim 7 wzorów PDF z treścią zastępczą (lorem ipsum) i `README.md` z zasadami wersjonowania. Development nie czeka na treści: `DOC-PDF-RENDER` i podpis pracują na wzorach roboczych. **Nadal otwarte pytania prawne** (nie treści, tylko zasady): trwały nośnik przy „mailu z samym linkiem”, wartość dowodowa podpisu na telefonie, RODO lokalizacji w tle |
| **D6** Dostawca TSA (2026-09-23) | **EuroCert** | `FLD-SIGN-TSA` odblokowane. Do sprawdzenia przed etapem 3: czy EuroCert zawrze umowę przed wpisem spółki do KRS |
| **D7** Zdjęcia (2026-09-23) | **Zestaw zmienny.** Część stała: jednostka zewnętrzna, tabliczka znamionowa jednostki zewnętrznej, odpływ skroplin, manometr próby próżni. Do tego **2 zdjęcia na każdą jednostkę wewnętrzną**: montaż i tabliczka znamionowa. **Etap I** montażu dwuetapowego: zdjęcia tras przed zakryciem + manometr próby azotem. Parametry prób wpisywane **liczbowo**, niezależnie od zdjęcia | `FLD-PHOTO-SET` przechodzi ze stałych 4 zdjęć na wzór `4 + 2n` (zmiana kontraktu). Etap I dostaje własny, osobny komplet. Tabliczki znamionowe są źródłem numerów seryjnych do protokołu (K5), co zmniejsza ryzyko R9 |
| **D8** Zaliczka (2026-09-23) | **`zaliczka = cena_netto_zestawu × 1,23 × 1,1`**, czyli 110% ceny brutto zestawu urządzeń. Wzór **potwierdzony 2026-09-23** | Odrzucone: stałe 40–50% z prezentacji i wariant „pozycje `FZ` + urządzenia” z planu §4.3 — oba dokumenty do sprostowania. Kwota zależy od wybranego wariantu oferty, więc wyliczenie należy do `FLD-QUOTE-VARIANTS`, a nie do faktury |
| **D9** Dokumenty rozliczeniowe (2026-09-23) | **Łańcuch trzech dokumentów:** proforma lub wezwanie do zapłaty przed wpłatą → faktura zaliczkowa **automatycznie po wpłacie** → faktura rozliczeniowa po montażu. Narzędzie: **inFakt** (KSeF po stronie dostawcy) | `INV-ADVANCE` rozpada się na trzy wymagania. Automat po wpłacie wymaga idempotentnej obsługi powrotu z płatności (webhook PayU), inaczej podwójna faktura. Przy montażu dwuetapowym faktura rozliczeniowa wychodzi **po etapie II** (po zamontowaniu urządzeń), a nie po etapie I — to zmienia dzisiejsze `FNL-2PHASE-INVOICE` |
| **D10** Zamknięcie montażu | **A**: monter zamyka, `N8` od razu, dyspozytor zatwierdza tylko wypłatę ekipy | Bez zmiany maszyny stanów. Nowe `FLD-INSTALL-PAYOUT-APPROVAL` |
| **D11** Brak zasięgu | **Wersja wąska**: szkic lokalny + kolejka wysyłki | `FLD-OFFLINE-OUTBOX` na `expo-sqlite`. Bez przeglądania danych offline |
| **D12** Sprzęt | **Telefon dla obu ról**, rysik niepotrzebny | Jeden układ ekranu (bez tabletu). Podpis palcem. Umowa czytana na małym ekranie, co trzeba uwzględnić w pytaniach do prawnika |
| **D13** E-mail | **Mailtrap** | S11 rozstrzygnięte. Wzmianki o Resend w prezentacjach do sprostowania |
| **D14** Lead od audytora | **W zakresie** | Zmiana kontraktu: drugie wejście do lejka (dziś `B2C-LEAD-ENTRY` mówi „jedyne legalne wejście”) + prawo `leads:create` dla audytora. Nowe `FLD-AUDIT-LEAD-CREATE` |
| SMSAPI | **Pole nadawcy złożone i przetestowane** | Zależność zamknięta |
| **D15** Kalkulator audytora (2026-09-23) | **A: pełny kalkulator.** Do tego: **jeden cennik robocizny** dla audytora i dla Triage (Triage bierze ilości z parametrów montażu standardowego), **konfiguracja cennika** i **konfiguracja montażu standardowego** w ustawieniach panelu B2B | Nowy moduł **M9**, największy pojedynczy przyrost zakresu od 21.09: ok. 16–23 MD. Znika ryzyko dwóch cenników, ale zmienia się sposób liczenia ceny widocznej publicznie w Triage (R18). Potrzebny plik z cennikiem robocizny od Michała (zależność Z2) |

---

## 1. Streszczenie (jedna strona)

**Co budujemy.** Narzędzie pracy w terenie dla dwóch ról: **audytora** (wizyta u klienta, wycena, umowa)
i **montera, czyli lidera ekipy** (zlecenie, checklista, zdjęcia, protokół odbioru). Do tego **podpis
elektroniczny klienta**: na miejscu, na ekranie urządzenia pracownika, albo zdalnie z linku w mailu. Klient
na końcu dostaje dokumenty odbioru, fakturę i link do umówienia kolejnego etapu (przepływ, który opisałeś
2026-09-16 przy montażu dwuetapowym).

**Dla kogo.** Audytorzy i liderzy ekip (role `audytor`, `monter`), klienci końcowi (podpis, dokumenty)
i dyspozytor (zatwierdzanie odbioru w panelu B2B).

**Co już jest (nie budujemy od zera):** kalendarz, dostępność, rezerwacje terminów i koszyki czasu wizyt;
rejestr zgód pracowniczych i wersji regulaminów; nieusuwalny dziennik zdarzeń (`audit_log`); kolejka
powiadomień z ochroną przed podwójną wysyłką (`notification_queue`); mechanika montażu dwuetapowego
w panelu; współrzędne adresów klientów. Szczegóły w rozdziale 4.

**Czego nie ma w ogóle:** samej aplikacji terenowej, zdjęć montażowych, protokołu odbioru, generowania
PDF, podpisu, ofert i umów (tabela `quotes` nie istnieje), faktur, płatności oraz **wysyłki** powiadomień:
kolejka zapisuje wiadomości, ale dziś żaden mail ani SMS nie wychodzi.

**Jak (po decyzjach z 2026-09-21 i 2026-09-23).** Natywna aplikacja **React Native + Expo** (`apps/field-app`)
na **telefony** obu ról. Zapisuje dane przez nową warstwę API w panelu B2B (Route Handlery z tym samym
`can()` i Prismą, ADR-013). Działa bez zasięgu w wersji wąskiej (szkic + kolejka). Audytor może sam założyć leada.

**Ile to jest.** Dokumenty rozjeżdżały się **od pięciu do dziesięciu razy** (rozdział 2, sprzeczność S2).
Roadmapa GTM daje na całe Field App 28 h (Pakiet 4), a na podpis 16–20 h. `FIELD-APP-PLAN.md` szacuje
sam podpis na 19–26 MD, a fazy 1–7 łącznie na 117–163 MD. Mój zgrubny szacunek pełnego zakresu
w wariancie **React Native, obie ścieżki**, to **ok. 98–147 MD** (z pełnym modułem wyceny M9). Obie ścieżki z podpisem na miejscu i pełną
wyceną, bez podpisu zdalnego i bez faktur, to **ok. 73–111 MD**, a sama ścieżka montera **ok. 43–66 MD**. Rozbicie jest w rozdziale 6. Rzetelnie
rozpisany jest wyłącznie podpis. Reszta to rząd wielkości, do kalibracji (D3).

**Co blokuje start:** nic z decyzji Michała poza jednym potwierdzeniem przy D2 (rozdział 0). Etapy 1–4
(fundament, montaż, podpis na miejscu bez TSA, audytor) mogą ruszyć od razu po rejestracji wymagań.

**Co zostało otwarte po 2026-09-23** (żadne z tego nie blokuje etapów 1–4):

- **Treści dokumentów prawnych** (D5). Wzory robocze z treścią zastępczą leżą w `docs/legal/`, więc kod
  powstaje na nich, a prawdziwe treści podmienią pliki. Blokują tylko wysyłkę do prawdziwego klienta.
- **Odpowiedzi na pytania prawne 1–8** (D5): trwały nośnik, podpis na telefonie, RODO lokalizacji w tle.
  Blokują etap 5 (podpis zdalny, SMS „w drodze") i etap 6 (umowa).
- **D16: braki w dostarczonym cenniku** — 13 pozycji bez kosztu ekipy, 5 bez kategorii, brak stawki VAT.
  Nie blokuje startu, blokuje marżę na pozycji i rozliczenia ekip.
- Poza tym nic. Wzór zaliczki (D8) i moment rozliczenia przy montażu dwuetapowym (D9) potwierdzone
  2026-09-23.

---

## 2. Sprzeczności między dokumentami

Wypisuję je przed decyzjami, bo większość decyzji wynika wprost z nich. Kolumna „kto ma rację" mówi,
co jest dziś wiążące według zasady zerowej (kontrakt > decyzje człowieka zapisane w repo > dokumenty opisowe).

| # | Temat | Źródło A | Źródło B | Co jest dziś wiążące |
|---|---|---|---|---|
| **S1** | **Platforma** | `ROADMAP-GTM…md` Pakiet 4: „Wersja **PWA** dla montażystów"; `SYSTEM-KPI…md`: „Niezawodność Field App offline **PWA**"; `docs/funkcjonalnosci_do_wdrozenia/field-app.md`: PWA, `apps/field-pwa` albo `/field`; `BACKLOG.md` poz. 17 `FLD-APP-PWA` | `field_app_requirements.md` §2 (D1, 2026-08-20): **React Native + Expo, PWA odrzucone** z powodu geolokalizacji w tle na iOS; `FIELD-APP-PLAN.md` §5.1: Expo, Skia, EAS | **Rozstrzygnięte 2026-09-21: React Native + Expo (D1 = C).** Dokumenty PWA do sprostowania. |
| **S2** | **Wielkość prac** | Roadmapa: Field App **28 h**; `podpis-elektroniczny.md`: **16–20 h**; `generator-umow…`: 18–22 h | `FIELD-APP-PLAN.md` §5.4: sam podpis **19–26 MD**; §7: fazy 1–7 razem ok. 117–163 MD | Nic nie jest wiążące. Obie strony liczą co innego: roadmapa zakłada PWA bez znacznika czasu, bez offline'u i bez ścieżki audytora, a plan zakłada RN, offline i pełen zakres. |
| **S3** | **Znacznik czasu przy podpisie** | `podpis-elektroniczny.md`, `BACKLOG.md` poz. 18: „stemplowanie SHA-256" (skrót liczony przez nas) | `FIELD-APP-PLAN.md` §5.4, decyzja 2026-09-09: **kwalifikowany znacznik czasu obowiązkowy**, „jedyny niezależny od nas dowód" | **Rozstrzygnięte 2026-09-21: TSA obowiązkowy (D4.1).** Skrót SHA-256 nie zastępuje kwalifikowanego znacznika czasu. |
| **S4** | **SMS/OTP** | `RAPORT-WARTOSCI-IP…md` §2: podpis „przez akceptację **SMS/OTP** lub odręczny"; `ZESTAWIENIE-CZASU-PRACY.md`: „podpis SMS w 60 sekund"; `podpis-elektroniczny.md`: OTP „opcjonalnie" w trybie zdalnym | `FIELD-APP-PLAN.md` §5.4 (opcja B): rysik na miejscu + link mailem, **bez OTP** | **Rozstrzygnięte 2026-09-21 (D4.2):** OTP SMS to dodatkowy dowód tożsamości, obowiązkowy w podpisie zdalnym, na miejscu nie. Nie zastępuje podpisu odręcznego. |
| **S5** | **Skład „4 zdjęć"** (trzy różne wersje) | `FLD-PHOTO-SET` (rejestr, BLOCKED) i `ONE-PAGER.md`: jedn. wewn., jedn. zewn., **budynek z oddali**, odpływ skroplin | `DEFINICJA-MONTAZU-STANDARDOWEGO.md` §6: jedn. wewn., jedn. zewn., odpływ, **manometry z próby próżni**; `KOSZYKI…md` §3: jedn. wewn. z korytkiem, jedn. zewn. z podkładkami, manometry, **uporządkowane stanowisko** | **Rozstrzygnięte 2026-09-23 (D7): zestaw zmienny `4 + 2n`** — część stała (jedn. zewn., tabliczka zewn., odpływ skroplin, manometr próżni) + 2 zdjęcia na każdą jedn. wewn. (montaż i tabliczka). Etap I: trasy przed zakryciem + manometr próby azotem. Żadna z trzech wersji z dokumentów nie obowiązuje. |
| **S6** | **Wysokość zaliczki** | Wszystkie prezentacje (`KOSZYKI`, `PROGNOZA`, `COO`, `DEFINICJA`), `payu-platnosci.md`, `generator-umow…`: **stałe 40–50%** | `FIELD-APP-PLAN.md` §4.3 (z transkrypcji): **suma pozycji `FZ` + cena urządzeń**; stały procent „odrzucono" wprost | **Rozstrzygnięte 2026-09-23 (D8): 110% ceny brutto zestawu urządzeń** (netto + 23% VAT, plus 10% wartości brutto). Odrzucone oba warianty z dokumentów. |
| **S7** | **Faktura przy montażu dwuetapowym** | Prezentacje: zaliczka przy każdej rezerwacji | `FIELD-APP-PLAN.md` K9: przy dwuetapowym **bez faktury zaliczkowej**; `FNL-2PHASE-INVOICE`: faktura po etapie I | **Rozstrzygnięte 2026-09-23 (D9):** łańcuch proforma → faktura zaliczkowa po wpłacie → faktura rozliczeniowa **po etapie II**, przez inFakt z KSeF. Po etapie I nie ma faktury — `FNL-2PHASE-INVOICE` i K9 do przepisania. |
| **S8** | **Co zamyka montaż** | `podpis-elektroniczny.md` AC4: podpis protokołu **sam** wywołuje `INSTALLATION_COMPLETED` i `N8` | `KOSZYKI…md`, `DEFINICJA…md`, `COO…md`: dyspozytor **zatwierdza** zdjęcia i protokół w panelu, dopiero potem wypłata; `field_app_requirements.md` §12 pyt. 2: nierozstrzygnięte, czy między `T09` a `N8` jest krok człowieka | **Rozstrzygnięte 2026-09-21 (D10 = A):** monter zamyka (`T09`, `N8` od razu), dyspozytor zatwierdza tylko wypłatę ekipy. `podpis-elektroniczny.md` AC4 do sprostowania. |
| **S9** | **Moduł podpisu w raporcie IP** | `RAPORT-WARTOSCI-IP…md` §2 przypisuje „Moduł Cyfrowego Podpisywania Umów" do `FLD-CONSENT-DOCS` i opisuje „mechanizmy podpisu w `apps/b2c-web` i `apps/b2b-web`" | `FLD-CONSENT-DOCS` to **zgody pracownicze**, nie podpis klienta. W kodzie nie ma żadnej implementacji podpisu (`signStoragePaths` to podpisane adresy plików w Storage, a nie podpis dokumentu) | Kod. Raport opisuje jako istniejące coś, czego nie ma. Ważne, jeśli raport trafia do inwestora albo do wyceny IP. |
| **S10** | **Status zgód i edycji bazy pracownika** | `BACKLOG.md` §1: `FLD-CONSENT-ACCEPT`, `FLD-LEGAL-DOC-VERSION`, `FLD-BASE-LOCATION-EDIT` jako **Done** | Rejestr: wszystkie trzy **TODO** (mają testy, ale brakuje ścieżki pracownika w aplikacji terenowej) | Rejestr. Część panelowa i Server Actions istnieją, a ścieżki „z Field App" nie ma, bo nie ma aplikacji. |
| **S11** | **Dostawca e-mail** | `SYSTEM-KPI…md` TECH-06, `PROGNOZA…md`: **Resend** | `FIELD-APP-PLAN.md` §5.2/§5.7: **Mailtrap** (konto i token gotowe, zdarzenie `delivery` jako dowód doręczenia linku do podpisu) | **Rozstrzygnięte 2026-09-21 (D13): Mailtrap.** Resend w prezentacjach do sprostowania. |
| **S12** | **Google Calendar** | Roadmapa, Pakiet 3: „**dwukierunkowa** synchronizacja z Google Calendar floty" | Twoja decyzja 2026-09-14: źródłem prawdy terminów jest baza (`bookings`), nie Google; `FIELD-APP-PLAN.md` R4 odradza synchronizację dwukierunkową | Decyzja 2026-09-14. Poza zakresem tego projektu, ale roadmapa obiecuje tu coś, czego nie planujemy. |
| **S13** | **Urządzenie** | Prezentacje i `ONE-PAGER.md`: podpis „na **smartfonie**" | `FIELD-APP-PLAN.md` §5.6: rysik, czyli w praktyce **iPad + Apple Pencil**; telefon **i** tablet jako dwa układy ekranu | **Rozstrzygnięte 2026-09-21 (D12): telefon dla obu ról**, podpis palcem, bez tabletu i rysika. Plan §5.6 do sprostowania. |
| **S14** | **Numeracja faz** | `FIELD-APP-PLAN.md` §7: fazy **0–9** (dwie ścieżki) | `field_app_requirements.md` §13: wersje **v1/v2/v3**; roadmapa: **Pakiety 1–6**; `field-app.md`: **Etapy 1–3** | Plan §7 (świadomie zastąpił v1/v2/v3). W rozdziale 7 proponuję nową kolejność, bo część faz planu jest już zrobiona. |
| **S15** | **Blokada testów zgód na bazie** | `FLD-CONSENT-TRIGGERS-INTEGRATION` (BLOCKED): „brak środowiska Postgres w CI" | `.github/workflows/ci.yml` uruchamia `supabase start` od 2026-09-09/10; `CAL-SLOT-ENGINE` zamknięto na realnym przebiegu na Postgresie w CI | CI. **Powód blokady jest nieaktualny.** Wymaganie da się dziś odblokować (osobna, mała sprawa, niezależna od Field App). |

---

## 3. Decyzje do podjęcia PRZED startem

> **Stan na 2026-09-21:** zaznaczenia `[x]` poniżej to wybory Michała (podsumowanie w rozdziale 0).
> Treść opcji i rekomendacji zostaje bez zmian jako zapis, z czego wybierano.

Każda decyzja ma: opcje, moją rekomendację z uzasadnieniem, skutek dla zakresu i kosztu oraz pole wyboru.
Rekomendacja to moja propozycja, a nie przesądzenie sprawy. Decyzje **D1–D4 blokują start**, pozostałe
blokują pojedyncze moduły (kolumna „Blokuje" w rozdziale 5).

### D1: Platforma: PWA czy React Native `[BLOKUJE START]`

Sprzeczność S1. To pierwsza decyzja, bo przesądza o ADR-013 (D2), o sposobie przechwytywania podpisu
(Skia działa tylko w React Native), o geolokalizacji, o testach i o koszcie.

| | **A. PWA w panelu B2B** (osobna sekcja, np. `/teren`, w `apps/b2b-web`) | **B. PWA jako osobna aplikacja Next.js** (`apps/field-web`) | **C. React Native + Expo** (`apps/field-app`, plan i D1) |
|---|---|---|---|
| Zapis danych | **Server Actions + `can()` + Prisma, tak jak dziś.** ADR-013 w dużej mierze znika | Server Actions, ale osobne wdrożenie, osobny middleware i powtórzona bramka logowania | Server Actions nie istnieją. Potrzebna nowa warstwa API (ADR-013) |
| Co już działa „za darmo" | `setSelfAvailabilityAction`, `setAvailabilityRuleAction`, `acceptLegalDocumentVersionAction` (już istnieją, pisane dla ról terenowych); bramka `is_active` w `middleware.ts`; `@repo/ui`; Vitest | to samo, ale do przepięcia | nic z UI (`@repo/ui` jest oparte na `react-dom`); `packages/contracts` prawdopodobnie tak (czysty TS, do sprawdzenia) |
| Podpis na miejscu | canvas HTML5 (np. `signature_pad`); Apple Pencil działa w Safari | jak A | React Native Skia (plan) |
| GPS „w drodze" (3 km, SMS do klienta) | **iOS nie daje PWA lokalizacji w tle.** Automatyczny alert przy przecięciu 3 km nie zadziała, gdy aplikacja jest zamknięta. Działa przycisk „Wyruszam" (N12), co kontrakt już przewiduje (`bind.kind: 'GEO' — „Wyruszam" / wejście w promień`) | jak A | działa w tle (główny powód decyzji D1) |
| Odblokowanie w promieniu 20 m | działa, bo aplikacja jest wtedy otwarta | jak A | działa |
| Praca bez zasięgu | możliwa (service worker + IndexedDB + kolejka), ale sama Server Action offline nie zadziała, więc potrzebna jest kolejka po stronie klienta | jak A | możliwa (`expo-sqlite` + outbox, plan §5.3) |
| Dystrybucja | link + „dodaj do ekranu głównego"; zero sklepów | jak A | TestFlight / Play Console, konta deweloperskie, przegląd Apple (lokalizacja w tle to ryzyko odrzucenia, plan §5.5) |
| Testy | Vitest, jedna dyscyplina | jak A | drugi runner (Jest + RNTL, E2E Maestro), plan §5.5 |
| Aktualizacja | natychmiast po wdrożeniu | jak A | EAS Update (JS) albo nowy build |
| Koszt względem C | **najniższy**; szacuję o 30–40% mniej niż C | o ok. 10–15% więcej niż A | bazowy |

**Rekomendacja: A (PWA w panelu B2B).** Uzasadnienie:

1. Termin. Do zamrożenia developmentu (30.11.2026) zostało ok. 10 tygodni na **wszystkie** pakiety roadmapy.
   Wariant C dokłada trzy duże prace, których A nie ma: warstwę API (D2), drugi system testów i dystrybucję
   przez sklepy.
2. Bezpieczeństwo. W A jest **jedna** implementacja uprawnień (`can()` w Server Action). Wariant C oznacza
   albo drugą implementację w RLS, albo nowe endpointy. Plan §3 A1 sam nazywa to „dokładnie tą klasą
   rozjazdu, którą cała dyscyplina kontraktowa ma eliminować".
3. Serwerowe akcje dla ról terenowych już istnieją i czekają na interfejs (patrz tabela).
4. Koszt A jest realny i trzeba go przyjąć świadomie: **automatyczny SMS przy 3 km w tle nie powstanie.**
   Zastępuje go przycisk „Wyruszam" (to i tak jest N12 z transkrypcji) i ewentualnie wykrycie promienia,
   gdy aplikacja jest otwarta. Przy okazji maleje ryzyko RODO (K4), bo nie śledzimy nikogo w tle.

**Skutek dla zakresu:** zmiana brzmienia `FLD-GEO-EN-ROUTE` („przecięcie promienia" zamieniamy na „przycisk
Wyruszam albo przecięcie przy otwartej aplikacji") i formalne odwołanie D1 z 2026-08-20 wpisem do
`docs/01-ADR-spec-conflicts.md`. Bez tego dokumenty dalej będą mówić dwiema wersjami.

- [ ] **A**: PWA jako sekcja panelu B2B (rekomendacja)
- [ ] **B**: PWA jako osobna aplikacja Next.js
- [x] **C**: React Native + Expo (zostaje D1 z 2026-08-20) — **wybrane 2026-09-21**
- [ ] Wybieram PWA i **akceptuję**, że SMS „w drodze" wymaga przycisku „Wyruszam" (brak automatu w tle na iOS)

### D2: Warstwa zapisu z aplikacji terenowej (ADR-013) `[BLOKUJE START]`

Zależy od D1. ADR-013 nigdy nie został wydany i był wskazywany jako bloker `FNL-2PHASE-INVOICE`,
`FLD-PHOTO-SET` i całej domeny `field`.

| Jeśli w D1 wybrano | Opcje | Rekomendacja |
|---|---|---|
| **A lub B (PWA)** | (a) zwykłe Server Actions + krótki ADR-013 regulujący wyłącznie **kolejkę offline**: klucz idempotencji w każdym zapisie z urządzenia, ponowienie bez duplikatu, rozstrzyganie konfliktów po stronie serwera | **(a).** ADR-013 kurczy się do jednej strony i nie łamie ADR-001 |
| **C (React Native)** | (a) `supabase-js` z urządzenia pod RLS (druga implementacja uprawnień w SQL); (b) Route Handlery współdzielące `can()` i Prismę, jako formalny aneks do ADR-001 | **(b)**, jak w planie §3 A1 |

- [ ] PWA: Server Actions + ADR-013 tylko o kolejce offline i idempotencji
- [x] RN: Route Handlery + `can()` (aneks do ADR-001) — **potwierdzone 2026-09-23** (rekomendacja wiersza „C (React Native)”)
- [ ] RN: `supabase-js` + RLS

### D3: Co musi działać 1 grudnia, a co w lutym `[BLOKUJE START]`

Roadmapa zakłada, że od 1.12 trwają testy na żywo (3–5 montaży u klientów Piotra, wprowadzanych
ręcznie) po ścieżce „audyt z aplikacją → wycena z koszyka → zaliczka online → … → checklista + 4 zdjęcia →
protokół cyfrowy", a w lutym szkolimy ekipy „na stabilnym oprogramowaniu". Pełny zakres (rozdział 6)
**nie zmieści się** do 30.11 razem z Pakietami 1–3, 5 i 6.

| Opcja | Na 1.12 | Na luty (przed onboardingiem) | Szacunek do 30.11 |
|---|---|---|---|
| **A. Najpierw ścieżka montera** | aplikacja, zgody, zlecenia dnia, checklista, zdjęcia, protokół, podpis **na miejscu** ze znacznikiem czasu, zamknięcie montażu, zatwierdzenie w panelu | podpis zdalny, ścieżka audytora (formularz, oferta, umowa), faktury | ok. 30–42 MD |
| **B. Najpierw ścieżka audytora** | formularz audytu, koszyk, oferta, umowa, podpis na miejscu i zdalnie | ścieżka montera | ok. 40–60 MD |
| **C. Obie ścieżki w minimum** | zdjęcia + protokół + podpis na miejscu u montera **oraz** oferta z koszyka w panelu B2B (bez aplikacji audytora) | aplikacja audytora, podpis zdalny | ok. 35–48 MD |

**Rekomendacja: A.** Plan §7 („ścieżka krytyczna") mówi to samo: ścieżka montera jest krótsza i nie
zależy od cennika, kalkulatora ani płatności. Przy 3–5 montażach testowych ofertę może przygotować
dyspozytor w panelu, tak jak koszyk (`FLD-QUOTE-BASKET-SELECT`, zrobione w panelu 2026-09-16). Trudne
rzeczy prawne (umowa konsumencka, podpis zdalny) zostają na styczeń, kiedy będzie już opinia prawnika.

**Zastrzeżenie o szacunkach:** MD w tym dokumencie to klasyczne dni pracy. Roadmapa liczy godziny Twojej
pracy z agentami AI (ok. 9,3 h/dzień, wrzesień). Nie umiem rzetelnie przeliczyć jednego na drugie.
Proponuję kalibrację na zamkniętym zadaniu: ile godzin faktycznie zajęło `FNL-2PHASE-BOOKING-MECHANICS`
albo `CAL-SLOT-ENGINE` i ile MD dałby dla nich ten sam sposób szacowania. Bez tego każdy termin w rozdziale 7
jest życzeniem.

- [ ] **A**: najpierw monter (rekomendacja)
- [ ] **B**: najpierw audytor
- [ ] **C**: minimum obu ścieżek
- [x] **D (2026-09-21): obie ścieżki, audytora i montera, w pełnym zakresie; harmonogram może się przesunąć**
- [ ] Zgadzam się na kalibrację szacunków na zamkniętym zadaniu (nierozstrzygnięte; dalej rekomenduję przed podaniem dat), zanim padnie jakikolwiek termin

### D4: Kształt podpisu elektronicznego `[BLOKUJE START modułu podpisu]`

Twoja decyzja z 2026-09-09 (opcja B, budujemy sami) **zostaje**. Do rozstrzygnięcia są trzy rzeczy,
które później dopisano w innych dokumentach (S3, S4).

**D4.1: kwalifikowany znacznik czasu (TSA).**
Plan §5.4 nazywa go warunkiem, bez którego opcja B „nie jest solidna": to jedyny element niezależny od nas,
koszt ok. 15 zł/mies. Backlog i `podpis-elektroniczny.md` opisują zamiast niego sam skrót SHA-256, który
liczymy my, więc w sporze nic nie dowodzi.

- [x] TSA **obowiązkowy**, jak w decyzji 2026-09-09 (rekomendacja)
- [ ] Rezygnuję z TSA (świadomie osłabiam dowód; wymaga opinii prawnika)

**D4.2: SMS/OTP.** Kod SMS nie jest **innym rodzajem podpisu**, tylko dodatkowym dowodem, **kto**
podpisał: wiąże kliknięcie z numerem telefonu klienta. Na miejscu nic nie wnosi, bo pracownik widzi klienta.
W trybie zdalnym wnosi dużo, bo sam link w mailu może kliknąć każdy, kto ma dostęp do skrzynki.
Konto SMSAPI już istnieje, koszt to 1–2 MD plus kilkanaście groszy za SMS.

- [x] OTP SMS **obowiązkowy w podpisie zdalnym**, na miejscu nie (rekomendacja)
- [ ] OTP SMS opcjonalny (klient wybiera)
- [ ] Bez OTP, jak w opcji B z 2026-09-09
- [ ] Samo potwierdzenie kodem SMS **zamiast** podpisu odręcznego (wersja z raportu IP; nie rekomenduję
      bez opinii prawnika)

**D4.3: które dokumenty podpisuje klient.**

- [x] Protokół zdawczo-odbiorczy (monter)
- [x] Umowa montażu (audytor albo zdalnie)
- [ ] Protokół przeglądu serwisowego (`podpis-elektroniczny.md` go wymienia, plan nie; proponuję **poza zakresem**)
- [ ] Zgoda na publikację zdjęć w social media (`MKT-PHOTO-CONSENT`; proponuję **poza zakresem**, osobny temat RODO)

### D5: Konsultacja prawna `[BLOKUJE moduł umowy i podpisu zdalnego]`

Plan §5.4 sam tego wymaga: w opcji B „nie ma dostawcy, który wziąłby jakąkolwiek część odpowiedzialności".
Pytania do prawnika. Nie rozstrzygam ich i nie cytuję przepisów jako pewnych, to ma zrobić prawnik:

1. Umowa podpisywana u klienta w domu to prawdopodobnie **umowa zawarta poza lokalem przedsiębiorstwa**.
   Jakie są skutki dla prawa odstąpienia i dla rozpoczęcia montażu przed upływem terminu? Czy potrzebne
   jest wyraźne żądanie konsumenta i jak ma wyglądać w interfejsie? (Raport IP powołuje się na „art. 27
   ustawy o prawach konsumenta", do weryfikacji.)
2. **Trwały nośnik:** czy wystarczy PDF wysłany mailem z linkiem, skoro zasada projektowa z planu mówi
   „mail zawiera tylko link, nie treść"? To może być konflikt: link do pobrania to nie zawsze trwały nośnik.
3. Treść **pouczenia o odstąpieniu** i **karty podpisu** (co zawiera ślad dowodowy).
4. Czy zwykły podpis elektroniczny (SES) + TSA + ślad + OTP wystarcza dla umowy i dla protokołu odbioru.
5. **GPS pracowników (K4):** model zdarzeniowy („Wyruszam", odblokowanie, zamknięcie) a podstawa
   przetwarzania i informacja dla pracownika. Przy PWA problem jest mniejszy, ale nie znika.
6. Przetwarzanie danych w Mailtrap (USA, Data Privacy Framework), plan §5.4.

- [x] Pakiet dokumentów ustalony (2026-09-23), treści w opracowaniu; katalog `docs/legal/` założony
- [ ] Odpowiedzi na pytania 1–8 (zasady): termin ____________ (proponuję przed startem etapu 5)

> **2026-09-23: pakiet dokumentów ustalony, treści zaparkowane.** Prawnik ma opracować **jeden pakiet**:
> umowa montażu, pouczenie o odstąpieniu, formularz odstąpienia, oświadczenie o żądaniu wcześniejszego
> montażu, karta podpisu, klauzule RODO, zgoda na doręczenie mailem. Wzory robocze (lorem ipsum) leżą
> w **`docs/legal/`** wraz z `README.md` opisującym nazewnictwo, wersjonowanie i pola podstawiane przez
> system. Michał podmieni je, gdy wypracuje treści; numer wersji `1.0` to pierwsza treść od prawnika.
>
> Pytania 1–8 niżej **zostają otwarte** — dotyczą zasad, nie brzmienia dokumentów, i część z nich może
> zmienić działanie systemu, a nie tylko tekst PDF.
>
> Po D1 = React Native dochodzi pytanie 7:
> lokalizacja w tle (automatyczny SMS przy 3 km) to przetwarzanie danych pracownika poza samymi
> zdarzeniami punktowymi, więc K4 jest trudniejsze niż przy PWA. Po D12 = telefon dochodzi pytanie 8:
> czy czytanie i podpisywanie umowy na ekranie telefonu wystarcza, czy klient musi dostać treść wcześniej.

### D6: Dostawca kwalifikowanego znacznika czasu `[BLOKUJE moduł TSA]`

Kandydaci z planu: Certum, KIR (Szafir), EuroCert, CenCert. **Pytanie otwarte, którego nie umiem
rozstrzygnąć:** czy umowę na usługę TSA można zawrzeć przed rejestracją spółki (KRS w listopadzie)?
Jeśli nie, podpis ze znacznikiem na próbnych montażach od 1.12 zależy od terminu rejestracji.

> **2026-09-23: EuroCert.**

- [x] Wybieram dostawcę: **EuroCert** (2026-09-23)
- [ ] Sprawdzić przed etapem 3: czy EuroCert zawrze umowę przed wpisem spółki do KRS (R5)
- [x] ~~Porównanie API u 2–3 dostawców~~ niepotrzebne, dostawca wybrany

### D7: Standard zdjęć montażowych `[ROZSTRZYGNIĘTE 2026-09-23]`

> **2026-09-23: zestaw zmienny.** Żadna z trzech wersji z dokumentów nie obowiązuje — obowiązuje wzór niżej.

Sprzeczność S5, trzy wersje „4 zdjęć". Do tego pytanie o liczbę stałą czy zmienną (K6) i o etap I
montażu dwuetapowego (`FLD-PHOTO-SET` kryt. 5).

- [ ] Wersja rejestru: jedn. wewn., jedn. zewn., budynek z oddali, odpływ skroplin
- [ ] Wersja standardu montażu (prezentacje): jedn. wewn., jedn. zewn., odpływ, **manometry z próby próżni**
- [x] **Zestaw zmienny (2026-09-23):**

| Etap | Część stała | Na każdą jednostkę wewnętrzną | Razem |
|---|---|---|---|
| Zamknięcie montażu (`T09`) | jednostka zewnętrzna, tabliczka znamionowa jedn. zewn., odpływ skroplin, manometr próby próżni | montaż jednostki + tabliczka znamionowa | **4 + 2n** (split: 6, multi 3×: 10) |
| Zamknięcie etapu I (`T17`) | manometr próby azotem | zdjęcia tras przed zakryciem (liczba zależna od instalacji) | **osobny komplet, minimum do ustalenia w WO** |

- [x] Parametry prób (próżnia, ciśnienie, azot) wpisywane **liczbowo** do protokołu, niezależnie od zdjęcia
- Skutek uboczny: tabliczki znamionowe wszystkich jednostek są fotografowane, więc numery seryjne i modele
  do protokołu (K5) mają pokrycie w dowodzie. Zmniejsza to ryzyko R9 (błędy przy ręcznym wpisywaniu).
- Do rozstrzygnięcia w Work Orderze (nie blokuje startu): minimalna liczba zdjęć tras przy etapie I —
  „co najmniej jedno na trasę” czy jedna liczba dla całej instalacji.

### D8: Model zaliczki `[ROZSTRZYGNIĘTE 2026-09-23]`

> **2026-09-23 (potwierdzone):** `zaliczka = cena_netto_zestawu × 1,23 × 1,1`, czyli 110% ceny brutto
> zestawu urządzeń.
>
> Przykład dla zestawu 8 000 zł netto: brutto 9 840 zł, zaliczka **10 824 zł**. Zaliczka jest więc
> wyższa niż cena urządzeń: pokrywa sprzęt i bufor na robociznę. To celowe i różni się od obu wariantów
> z dokumentów, więc prezentacje (`KOSZYKI`, `PROGNOZA`, `COO`, `DEFINICJA`, `payu-platnosci.md`)
> i `FIELD-APP-PLAN.md` §4.3 wymagają sprostowania.

Sprzeczność S6: stałe 40–50% (prezentacje, PayU) czy „pozycje `FZ` + urządzenia" (transkrypcja, plan §4.3,
stały procent wprost odrzucony).

- [ ] Stały procent: ____ %
- [ ] Pozycje `FZ` + cena urządzeń (plan §4.3)
- [x] **110% ceny brutto zestawu urządzeń (2026-09-23)**
- [x] Potwierdzam odczyt wzoru: `zaliczka = cena_netto_zestawu × 1,23 × 1,1` (2026-09-23)

### D9: Dokumenty rozliczeniowe `[ROZSTRZYGNIĘTE 2026-09-23]`

> **2026-09-23: łańcuch trzech dokumentów** zamiast wyboru „proforma albo zaliczkowa":

| Krok | Dokument | Wyzwalacz | Uwagi |
|---|---|---|---|
| 1 | proforma / wezwanie do zapłaty | wysłanie umowy albo akceptacja oferty | nie jest fakturą w rozumieniu VAT, nie trafia do KSeF |
| 2 | faktura zaliczkowa | **automatycznie po zaksięgowaniu wpłaty** | wystawiana bez udziału człowieka, więc obsługa powrotu z płatności musi być idempotentna, inaczej podwójna faktura przy ponowionym webhooku |
| 3 | faktura rozliczeniowa | zamknięcie montażu, czyli `T09` — także w wariancie dwuetapowym, bo etap I kończy `T17` (pętla na `AWAITING_INSTALLATION`), a `T09` wychodzi dopiero po zamontowaniu urządzeń | domyka VAT od pozostałej kwoty; po etapie I (`T17`) klient nie dostaje żadnej faktury |

> Narzędzie: **inFakt** (2026-09-23), z KSeF po stronie dostawcy, bez własnej integracji z KSeF.
>
> **Montaż dwuetapowy (potwierdzone 2026-09-23):** rozliczenie następuje po etapie II, czyli po montażu
> urządzeń — a to jest dokładnie to samo przejście `T09`, które zamyka montaż jednoetapowy. Reguła jest
> więc jedna: **faktura rozliczeniowa przy `T09`, nigdy przy `T17`.** Między etapem I a II klient nie dostaje faktury, a firma pracuje na zaliczce (110% ceny brutto
> urządzeń), która pokrywa sprzęt i bufor. Dzisiejsze `FNL-2PHASE-INVOICE` mówi o fakturze po etapie I,
> więc wymaga przepisania, a `N8a` (powiadomienie po etapie I) traci załącznik z fakturą.

Otwarte od 2026-09-10 (`FIELD-APP-PLAN.md` 6.4a, notatka w `FNL-2PHASE-INVOICE`). Jedno rozstrzygnięcie
obsłuży zaliczkę w montażu jednoetapowym i dokument etapu I. Do tego pytanie o K9 (brak zaliczki przy
dwuetapowym, S7) i o wybór narzędzia do faktur (plan §5.2: Fakturownia albo inFakt zamiast bezpośrednio KSeF).

- [x] Łańcuch: proforma → faktura zaliczkowa po wpłacie → faktura rozliczeniowa po montażu (2026-09-23)
- [x] Faktury przez gotowe API z KSeF, bez własnej integracji z KSeF
- [x] Wybieram narzędzie: **inFakt** (2026-09-23)
- [x] Moment faktury rozliczeniowej przy montażu dwuetapowym: **po etapie II** (2026-09-23)

### D10: Kto zamyka montaż `[BLOKUJE moduł odbioru]`

Sprzeczność S8. Kontrakt dziś: monter zamyka (`T09`), klient natychmiast dostaje `N8`.

| Opcja | Jak działa | Konsekwencja |
|---|---|---|
| **A** | Monter zamyka (zdjęcia + podpis klienta), `N8` wychodzi od razu; dyspozytor zatwierdza później **tylko wypłatę ekipy** | bez zmiany maszyny stanów; zatwierdzenie to osobny znacznik na instalacji |
| **B** | Monter „zgłasza do odbioru", dyspozytor zatwierdza, dopiero wtedy `T09` i `N8` | nowy stan pośredni w lejku (zmiana kontraktu, testy maszyny stanów); klient czeka na dokumenty |
| **C** | Podpis protokołu sam zamyka montaż (`podpis-elektroniczny.md`) | jak A, ale bez zatwierdzenia wypłaty; niezgodne z KPI OPS-06 („zero wypłat bez kompletu") |

**Rekomendacja: A.** Klient dostaje dokumenty od razu, a kontrola jakości dotyczy tego, co naprawdę jest
ryzykiem firmy, czyli wypłaty dla ekipy.

- [x] A (rekomendacja) — **wybrane 2026-09-21**
- [ ] B
- [ ] C

### D11: Praca bez zasięgu `[wpływa na koszt ścieżki audytora]`

Plan A2 rekomenduje pełny offline dla audytu. Przy PWA proponuję wersję węższą: **szkic lokalny + kolejka
wysyłki** dla zdjęć, protokołu i formularza. Nic nie ginie przy zaniku sieci, a wysyłka ponawia się sama.
Przeglądania danych bez sieci nie przewiduję.

- [x] Wersja wąska: szkic + kolejka (rekomendacja) — **wybrane 2026-09-21** (przy React Native: `expo-sqlite` + outbox)
- [ ] Pełny offline
- [ ] Tylko online

### D12: Sprzęt

- [ ] Tablet z rysikiem dla audytora (umowa, rysunki), telefon dla montera (protokół podpisywany palcem)
- [x] Telefon dla obu ról (rysik niepotrzebny) — **wybrane 2026-09-21**
- [ ] iPad + Apple Pencil dla obu (plan §5.6)

### D13: Dostawca e-mail (S11)

- [x] Mailtrap (plan, konto gotowe, zdarzenie `delivery`) (rekomendacja) — **wybrane 2026-09-21**
- [ ] Resend (prezentacje)

### D14: Szybkie zakładanie leada przez audytora (K1, `FLD-AUDIT-PHONE-SHORTCUT` w backlogu)

Kontrakt mówi, że Triage to „jedyne legalne wejście do maszyny stanów" (`B2C-LEAD-ENTRY`), a audytor nie
ma dziś prawa `leads:create`. Na próbne montaże klientów wprowadza się ręcznie z panelu B2B, co już działa.

- [ ] Poza zakresem tego projektu; leady zakłada dyspozytor w panelu (rekomendacja)
- [x] W zakresie (wymaga zmiany kontraktu: drugie wejście do lejka + prawo `leads:create` dla audytora) — **wybrane 2026-09-21**

### D15: Kalkulator kosztorysowy audytora (moduł M9) `[NOWA DECYZJA, 2026-09-23]`

Pytanie Michała z 2026-09-23: „a co z modułem wyceny dla audytora?". Wcześniej ten dokument traktował
kalkulator jako opcję przy M7 i wymieniał go w rozdziale „poza zakresem". Skoro ścieżka audytora jest
w zakresie (D3), to audytor musi mieć z czego policzyć cenę montażu — dziś w systemie nie ma ani cennika
kosztorysowego, ani tabel oferty.

| | **A. Pełny kalkulator od razu** | **B. Bez cennika: tylko pozycje ręczne** | **C. Etapowo (rekomendacja)** |
|---|---|---|---|
| Co dostaje audytor | cennik 35 pozycji w telefonie, pozycje × ilości per pomieszczenie, automatyczna suma i marża | puste pozycje: nazwa, ilość, cena wpisywane z ręki (albo z arkusza obok) | najpierw pozycje ręczne + ceny urządzeń z katalogu i zamrożenie cen w ofercie, potem cennik i automat |
| Ryzyko błędu | najniższe | wysokie: ceny przepisywane z arkusza, brak kontroli marży | średnie na starcie, spada po dowiezieniu cennika |
| Co zostaje w Google Sheets | nic | cały cennik | cennik do czasu drugiego kroku |
| Szacunek | 10–15 MD w etapie 4 | 3–5 MD | 3–5 MD w etapie 4, potem 7–10 MD jako etap 4b |

**Rekomendacja: C.** Uzasadnienie: na 3–5 montaży próbnych pozycje ręczne wystarczą, a zamrożenie cen
w ofercie (`FLD-QUOTE-PRICE-SNAPSHOT`) trzeba mieć od pierwszej wysłanej oferty, bo bez niego oferta
sprzed miesiąca przestaje się odtwarzać. Cennik i automat wchodzą, gdy ścieżka audytora już działa
u realnych klientów — wtedy też widać, które z 35 pozycji faktycznie się powtarzają. Wszystkie
wymagania rejestrujemy od razu, żeby nic nie wypadło z pola widzenia.

- [x] **A**: pełny kalkulator w etapie 4 — **wybrane 2026-09-23**
- [ ] **B**: bez cennika, tylko pozycje ręczne
- [ ] **C**: etapowo — pozycje ręczne w etapie 4, cennik jako etap 4b (rekomendacja, odrzucona)

**Rozszerzenie zakresu z 2026-09-23 (decyzja Michała), ważniejsze niż sam wybór wariantu:**

1. **Jeden cennik robocizny dla audytora i dla Triage.** Audytor wpisuje ilości pozycji w formularzu.
   Triage liczy z **tego samego** cennika, tylko ilości bierze z **parametrów montażu standardowego**
   (pozycje w `m`, `mb`, `szt.`), a nie od użytkownika.
2. **Konfiguracja cennika wyceny w ustawieniach panelu B2B** — pozycje i ceny prowadzi administrator,
   nie programista.
3. **Konfiguracja montażu standardowego w ustawieniach panelu B2B**, zbudowana **na pozycjach z cennika**:
   które pozycje i w jakich ilościach składają się na standard.

To rozstrzyga przy okazji ryzyko dwóch równoległych cenników, które opisywałem w M9: **jest jeden cennik,
a `cennik_uslug` z dzisiejszą pozycją „Montaż wzorcowy" i literałem 1200 zł przestaje być źródłem ceny
w Triage.** Cena „od" na stronie i cena od audytora zaczynają wychodzić z tego samego miejsca, co jest
dokładnie tym, co `DEFINICJA-MONTAZU-STANDARDOWEGO.md` obiecuje klientowi.

- [ ] Potwierdzam, że po wdrożeniu **Triage przestaje liczyć z `cennik_uslug`** i liczy z nowego cennika
      oraz konfiguracji montażu standardowego (zmiana ceny widocznej publicznie — patrz ryzyko R18)

### D16: Braki w dostarczonym cenniku `[NOWE, 2026-09-23 — nie blokuje startu]`

Cennik dotarł i jest w repozytorium ([`CENNIK-ROBOCIZNY.md`](../architecture/CENNIK-ROBOCIZNY.md)).
Po odczytaniu widać trzy braki, które trzeba uzupełnić, zanim kalkulator policzy coś więcej niż samą
cenę dla klienta:

1. **13 pozycji nie ma kosztu ekipy**, w tym wszystkie czysto robociznowe (`podłączenie ściennej`,
   `podłączenie kanałówki/kasety`, `uruchomienie`, `przewiert`, `przewiert w żelbecie`, całe
   `bruzdowanie`). Bez nich nie da się policzyć marży ani rozliczenia z ekipą, a `KOSZYKI…md` opiera
   na tym wypłaty.
2. **5 pozycji nie ma kategorii ani opisu** — grupa montażu jednostki zewnętrznej (`stojak`,
   `stelaż z profili`, `wisi do 3m`, `wisi na kominie`, `wysokość jedn zew`). Opis jest tym, co widzi
   klient w ofercie.
3. **Brak stawki VAT.** Wszystkie kwoty są netto.

- [ ] Uzupełnię koszty ekipy dla pozycji robociznowych
- [ ] Uzupełnię kategorie i opisy dla 5 pozycji jednostki zewnętrznej
- [x] **VAT: stawka wynika z obiektu, nie z pozycji cennika (2026-09-23):**

| Obiekt | Stawka |
|---|---|
| Lokal mieszkalny do 300 m² | **8%** |
| Lokal mieszkalny powyżej 300 m² | **23%** |
| Lokal usługowy | **23%** |

  Skutki, które to za sobą ciągnie (nowe wymaganie `PRICE-VAT-RATE`):
  - **Powierzchnia lokalu i jego przeznaczenie stają się danymi wymaganymi do wyceny.** Dziś Triage pyta
    o metraż **pomieszczeń**, a nie o powierzchnię całego lokalu, i nie zapisuje typu obiektu jako pola.
    Bez tego nie da się wybrać stawki.
  - Stawka jest atrybutem **wyceny i faktury**, a nie pozycji cennika: ta sama pozycja idzie raz na 8%,
    raz na 23%.
  - Granica 300 m² to reguła progowa — jak progi SLA, należy do kontraktu, nie do kodu.
  - **Rozstrzygnięte 2026-09-23 (D17): zaliczka liczy się po stawce obiektu**, a nie zawsze po 23%.
    Wzór z D8 przyjmuje więc postać ogólną: `zaliczka = cena_netto_zestawu × (1 + stawka_vat_obiektu) × 1,1`.
    Dla lokalu usługowego i mieszkalnego powyżej 300 m² wychodzi to samo co wcześniej
    (`× 1,23 × 1,1`), dla mieszkalnego do 300 m² — `× 1,08 × 1,1`.
- [ ] Potwierdzam mapowanie montażu standardowego z `CENNIK-ROBOCIZNY.md` (ok. 2 483 zł netto
      za pierwsze pomieszczenie) albo podaję własne: ____________

### D17: Skąd bierze się stawka VAT i jak wygląda formularz wyceny `[ROZSTRZYGNIĘTE 2026-09-23]`

**Stawka VAT wynika z obiektu**, więc system musi wiedzieć, jaki to obiekt. Dwa źródła tej wiedzy:

| Kto wycenia | Skąd rodzaj obiektu | Uwaga |
|---|---|---|
| **Audytor (Field App)** | zaznacza rodzaj obiektu w formularzu wyceny | dane z pierwszej ręki, audytor widzi lokal |
| **Klient (Triage)** | z tego, co sam uzupełnił: rodzaj lokalu oraz pomieszczenia i ich powierzchnie; sumę powierzchni porównujemy z progiem 300 m² | dane deklarowane, obarczone błędem (patrz R20) |

Wycena audytora ma pierwszeństwo: jeśli audytor zastanie inny obiekt, niż zadeklarował klient, to jego
zaznaczenie nadpisuje stawkę w ofercie i na fakturze. Cena z Triage pozostaje ceną orientacyjną.

**Formularz wyceny audytora — struktura potwierdzona 2026-09-23.** Dwie części:

1. **Pozycje pomieszczenia.** Audytor dodaje pomieszczenie (nazwa, moc jednostki — wpisywana, nie
   wyliczana, K7), uzupełnia przy nim ilości pozycji cennika, po czym dodaje kolejne pomieszczenie
   i robi to samo. Pozycje o zasięgu `ROOM`: trasa freonowa, koryta, przewiert, skropliny, syfon,
   pompka, bruzdowanie tras, podłączenie jednostki wewnętrznej.
2. **Pozycje ogólne całej instalacji**, niededykowane żadnemu pomieszczeniu. Pozycje o zasięgu
   `INSTALLATION`: montaż jednostki zewnętrznej (pięć wariantów), wysokość jedn. zewnętrznej, przewód
   zasilający i jego bruzdowanie, wpięcie zasilania, uruchomienie, przejście dachowe, zabezpieczenie
   mieszkania, zwyżka.

Podział wszystkich 39 pozycji cennika na te dwa zasięgi jest w
[CENNIK-ROBOCIZNY.md](../architecture/CENNIK-ROBOCIZNY.md): **23 pozycje `ROOM`, 16 pozycji
`INSTALLATION`**. Ten sam podział działa już w wyliczeniu montażu standardowego (1 828 zł netto na każdą
jednostkę wewnętrzną + 655 zł na układ), więc jedna reguła obsługuje Triage i formularz audytora.

**Uczciwie o stanie dokumentów:** część „po pomieszczeniach" faktycznie była zapisana — `FIELD-APP-PLAN.md`
§4.2 przewiduje tabele `quote_rooms` i `quote_items` (pozycja cennika × ilość, per pomieszczenie).
**Pozycji ogólnych nie było nigdzie**, ani w planie, ani w wymaganiach. To realna luka, którą ta decyzja
zamyka. Skutek dla schematu: `quote_items.room_id` musi być **opcjonalne** (brak pomieszczenia = pozycja
ogólna), a `price_list_items` dostaje atrybut `scope` sterujący tym, w której części formularza pozycja
się pojawia.

- [x] Stawka VAT z obiektu; w Field App z zaznaczenia audytora, w Triage z danych klienta (2026-09-23)
- [x] Zaliczka liczona po stawce obiektu: `netto × (1 + stawka_vat) × 1,1` (2026-09-23)
- [x] Formularz wyceny: pozycje per pomieszczenie + osobna sekcja pozycji ogólnych (2026-09-23)
- [ ] Potwierdzam podział 23/16 z `CENNIK-ROBOCIZNY.md` (uwaga na `Lutowanie` — dziś `ROOM`)
- [ ] Do sprawdzenia u księgowego: czy próg 300 m² dotyczy także **lokali** mieszkalnych (patrz R21)

---

## 4. Co już istnieje i będzie użyte ponownie

Sprawdzone w kodzie, migracjach i rejestrze 2026-09-21.

| Element | Gdzie | Stan | Do czego się przyda |
|---|---|---|---|
| Rejestr zgód pracowniczych i wersji regulaminów | `legal_document_versions`, `employee_consents` (migracja `20260821130000`, na produkcji od 2026-08-27); `acceptLegalDocumentVersionAction` w `auditors/actions.ts`; zarządzanie wersjami w `settings/actions.ts` | działa, testy są | ekran akceptacji w aplikacji + blokada pracy bez zgód |
| Dostępność pracownika | `setSelfAvailabilityAction`, `setAvailabilityRuleAction`, `getAvailabilityAction` | działa (Server Actions dla ról terenowych) | ekran „moja dostępność" w aplikacji. Przy React Native logika zostaje, ale trzeba ją wystawić przez warstwę API (`FLD-API-LAYER`) |
| Kalendarz, rezerwacje, koszyki | `@repo/scheduling` (`createBooking`, `findPoolSlots`), `bookings`, `absences`, `availability_rules`, `visit_duration_baskets` (7 koszyków) | DONE | lista zleceń dnia, rezerwacja etapu II |
| Montaż dwuetapowy | `installation_phases`, `completePhaseOneAction`, `bookPhaseTwoAction` (`installations/two-phase-actions.ts`); `T17` ma `manualEquivalent` | DONE w panelu | zamknięcie etapu I z aplikacji wywoła **tę samą** funkcję domenową |
| Tryb montażu | `instalacje.installation_type` (migracja `20260916060000`) | kolumna jest, **brak ścieżki zapisu przez audytora** | moduł audytu (patrz „luki w uprawnieniach" niżej) |
| Nieusuwalny dziennik | `audit_log` + wyzwalacz `audit_log_append_only_trg` | na produkcji | wzorzec dla śladu podpisu. Uwaga: każdy nowy `resource` w dzienniku wymaga migracji rozszerzającej CHECK |
| Kolejka powiadomień | `notification_queue`, `enqueueNotification()` (idempotentna, jeden wiersz na kanał) | DONE | powiadomienia `N8`, `N8a`, link do podpisu. **Ale nic z niej nie jest wysyłane**, patrz zależność Z1 |
| Współrzędne adresów | `adresy.latitude/longitude`; `saveLead.ts` je zapisuje | testy są, status TODO | odblokowanie w promieniu 20 m |
| Progi geolokalizacji | `SLA.GEOFENCE_UNLOCK_RADIUS` (20 m), `SLA.GEOFENCE_EN_ROUTE_RADIUS` (3000 m) | w kontrakcie | bez literałów w kodzie aplikacji |
| Czytelne numery | `leady.project_number` (`L-000123`), `instalacje.installation_number` (`I-…`) | w bazie | numer na protokole, umowie i fakturze |
| Bramka zablokowanego konta | `middleware.ts` (audytor, `is_active`, fail-closed) | działa dla panelu | wzorzec reguły (fail-closed, `is_active`). Przy React Native ta sama kontrola musi działać w warstwie API przy **każdym** żądaniu, dla audytora i montera (`crews.is_active`), czyli `FLD-AUTH-BLOCKED` |
| Podpisane adresy plików | `signStoragePaths` (`lib/storage/signed-urls.ts`) | działa (awatary) | podgląd zdjęć montażowych w panelu. **To nie jest podpis dokumentu** |
| Postgres w CI | `ci.yml`: `supabase start` | działa | testy wyzwalaczy śladu podpisu i blokad na prawdziwej bazie |
| Kontrakty jako TypeScript | `packages/contracts/src/generated` | działa | import w aplikacji Expo (czysty TS; do sprawdzenia konfiguracja Metro w monorepo w `FLD-APP-SHELL`) |

**Luki w uprawnieniach i kontrakcie, które ten projekt wymusi** (każda to zmiana kontraktu, okno i `contract-steward`):

1. **Audytor nie może zapisać trybu montażu.** `installations.update` = `admin, dyspozytor, monter:own`
   i nie ma tam audytora, a `FNL-2PHASE` kryt. 2 mówi „audytor na miejscu ustawia `instalacje.installation_type`".
   Do tego wiersz instalacji powstaje dopiero przy przypisaniu ekipy. Trzeba rozstrzygnąć przy module audytu.
2. **Brak zasobu na podpisy, zdjęcia i dokumenty.** `documents` i `invoices` istnieją w macierzy uprawnień,
   ale nie mają tabel. Podpis i ślad podpisu potrzebują nowych zasobów albo rozszerzenia `documents`.
3. **Publiczna strona podpisu zdalnego** działa bez logowania, więc jest poza macierzą ról. Potrzebna jest
   decyzja, gdzie ma działać (domena `apps/b2c-web`?) i czy to „wyjątek webhookowy" z ADR-001.
4. **Maszyna stanów nie zna „podpisania umowy".** `T03 acceptQuoteAndBook` (aktor `CLIENT`, guard
   `termsAccepted`) to najbliższe miejsce. Podpis na tablecie audytora to czynność klienta wykonana na
   cudzym urządzeniu. Przy zalogowanym audytorze klasyfikator zapisze to jako `manual_status_change`,
   chyba że dostanie `manualEquivalent`.
5. **`N8` ma załącznik `warranty_card`,** a według transkrypcji (K5) karta gwarancyjna jest papierowa.
6. **Drugie wejście do lejka (D14, 2026-09-21).** `B2C-LEAD-ENTRY` nazywa Triage „jedynym legalnym
   wejściem” do maszyny stanów, a audytor nie ma `leads:create`. Trzeba: nowe przejście wejściowe (aktor
   `AUDITOR`) albo `manualEquivalent`, prawo `leads:create` dla roli `audytor` w macierzy, rozstrzygnięcie,
   w jakim stanie lead startuje (proponuję od razu z przypisanym audytem, bez etapu Triage), oraz zgody RODO
   klienta zbierane na telefonie audytora (dziś zbiera je formularz B2C).
7. **Uwierzytelnienie aplikacji (D2, 2026-09-21).** Panel B2B opiera się na sesji w ciasteczkach
   (`middleware.ts`). Aplikacja natywna potrzebuje tokenu (JWT Supabase Auth w nagłówku) weryfikowanego
   w każdym Route Handlerze przed `can()`. To nowy wyjątek od ADR-001 („Route Handlery tylko dla publicznych
   webhooków”), stąd aneks ADR-013.

---

## 5. Zakres funkcjonalny: moduły

Każdy moduł: co może zrobić użytkownik, które istniejące ID pokrywa, jakie **nowe** ID proponuję (nazwy
do Twojej akceptacji) i pole do potwierdzenia. Przy „Blokuje" podaję decyzję, bez której moduł nie ruszy.

### M1: Fundament aplikacji i logowanie

- **Audytor / monter:** instaluje aplikację na telefonie (TestFlight / Google Play), loguje się tym samym
  kontem co do panelu i widzi **tylko swoje** zlecenia na dziś i najbliższe dni.
- **Administrator:** blokada konta (`is_active`) natychmiast odcina dostęp, także w trwającej sesji.
- Istniejące ID: `FLD-AUTH-BLOCKED` (BLOCKED → do odblokowania po D1).
- Nowe ID: `FLD-APP-SHELL` (`apps/field-app`: Expo, nawigacja, układ na telefon, logowanie, konfiguracja
  monorepo), `FLD-API-LAYER` (Route Handlery z weryfikacją tokenu, `can()` i Prismą, klucz idempotencji
  w każdym zapisie; aneks ADR-013), `FLD-APP-DISTRIBUTION` (EAS Build/Update, TestFlight, Play Console),
  `FLD-MOBILE-TEST-HARNESS` (Jest + RNTL, E2E Maestro, wpięcie w bramkę CI), `FLD-JOBS-OWN` (lista zleceń
  zawężona do pracownika, fail-closed).
- Blokuje: nic (D1 i D2 rozstrzygnięte). Ryzyko: konto Apple Developer dla organizacji
  wymaga numeru D-U-N-S spółki (R11).
- [ ] Potwierdzam moduł M1

### M2: Zgody pracownika

- **Pracownik:** przy pierwszym logowaniu i po każdej nowej wersji regulaminu akceptuje dokumenty. Dopóki
  tego nie zrobi, nie może rozpocząć zlecenia (decyzja D-D z 2026-08-21: blokada w aplikacji, nie w panelu).
- Istniejące ID: `FLD-CONSENT-ACCEPT`, `FLD-LEGAL-DOC-VERSION` (TODO, serwer gotowy),
  `FLD-CONSENT-TRIGGERS-INTEGRATION` (BLOCKED z nieaktualnego powodu, S15).
- Nowe ID: `FLD-CONSENT-ENFORCE`. To wymaganie zapowiadane w `FLD-CONSENT-ACCEPT` kryt. 9 („będzie miało
  własne ID").
- Blokuje: nic (D1 rozstrzygnięte).
- [ ] Potwierdzam moduł M2

### M3: Montaż: zlecenie, checklista, zdjęcia

- **Monter:** otwiera zlecenie (adres, projekt z audytu, urządzenia), odhacza checklistę przedmontażową
  (N15), robi zdjęcia ze słownika rodzajów. Aplikacja **sama wie, ile zdjęć jest wymaganych**: część stała
  plus 2 na każdą jednostkę wewnętrzną z projektu (D7), a przy etapie I osobny komplet (trasy, azot). Zdjęcia są kompresowane na urządzeniu i wysyłają się ponownie
  po powrocie zasięgu.
- **Dyspozytor:** widzi zdjęcia w panelu.
- Istniejące ID: `FLD-PHOTO-SET` (BLOCKED; zmiana kryteriów wg D7).
- Nowe ID: `FLD-CHECKLIST-PREINSTALL`, `FLD-PHOTO-STORAGE` (osobny bucket i polityki, nie awatarowe),
  `FLD-PHOTO-UPLOAD-RESILIENT` (kompresja + ponawianie bez duplikatów; odpowiada backlogowemu `FLD-PHOTO-OPTIMIZE`).
- Blokuje: nic (D1, D7, D11 rozstrzygnięte). Do ustalenia w WO: minimalna liczba zdjęć tras przy etapie I.
- [ ] Potwierdzam moduł M3

### M4: Protokół odbioru i zamknięcie montażu

- **Monter:** wypełnia protokół: numery seryjne i modele (K5, z tabliczek znamionowych fotografowanych
  w M3), parametry próby ciśnienia, próżni i azotu **liczbowo** (D7), potwierdzenie instruktażu. Klient podpisuje na ekranie (M5), monter zamyka montaż (`T09`) albo etap I
  (`T17`). Bez kompletu zdjęć i podpisu serwer odmawia.
- **Klient:** dostaje mailem protokół (PDF), a przy etapie I także link do rezerwacji etapu II (`N8a`
  już to robi).
- **Dyspozytor:** zatwierdza odbiór do wypłaty (D10 = A, rozstrzygnięte 2026-09-21). Zatwierdzenie nie
  wstrzymuje `N8` ani dokumentów dla klienta.
- Istniejące ID: `FNL-E7-E8` (TODO: rozszerzyć kryteria o zamknięcie z aplikacji i warunek kompletu),
  `FNL-2PHASE` (kryt. 1 i 2 otwarte).
- Nowe ID: `FLD-HANDOVER-PROTOCOL` (dane protokołu), `DOC-PDF-RENDER` (wspólny silnik PDF po stronie
  serwera dla protokołu, umowy i oferty), `FLD-INSTALL-PAYOUT-APPROVAL` (zatwierdzenie do wypłaty).
- Zmiana kontraktu: usunięcie `warranty_card` z `N8` (K5), jeśli potwierdzisz kartę papierową.
- Blokuje: nic (D1, D7, D10 rozstrzygnięte).
- [ ] Potwierdzam moduł M4
- [ ] Karta gwarancyjna jest papierowa; do systemu trafiają tylko numer seryjny, model i adres (K5)

### M5: Podpis elektroniczny (rodzina `FLD-SIGN-*`)

- **Klient na miejscu:** czyta dokument na ekranie **telefonu** pracownika i podpisuje palcem (D12).
- **Klient zdalnie:** dostaje mail z linkiem (bez treści umowy, tylko link), otwiera stronę podpisu,
  wpisuje kod SMS (**obowiązkowy**, D4.2), podpisuje, dostaje kopię.
- **Dokumenty podpisywane przez klienta (D4.3):** protokół odbioru i umowa montażu.
- **Firma:** ma nieusuwalny ślad zdarzeń (wysłano, doręczono, otwarto, podpisano), dokument zamrożony przed
  podpisem, kwalifikowany znacznik czasu i kartę podpisu dołączoną do PDF.
- Istniejące ID: brak (w rejestrze nie ma żadnego wpisu o podpisie).
- Nowe ID:

| Proponowane ID | Co gwarantuje |
|---|---|
| `FLD-SIGN-DOC-FREEZE` | podpisuje się dokładnie tę wersję PDF, którą klient widział; skrót dokumentu przed i po |
| `FLD-SIGN-CAPTURE` | przechwycenie podpisu palcem na telefonie (React Native Skia), cofanie, eksport |
| `FLD-SIGN-REMOTE` | publiczna strona podpisu: token o wysokiej entropii, jednorazowy, wygasający |
| `FLD-SIGN-REMOTE-OTP` | obowiązkowy kod SMS w podpisie zdalnym (D4.2); SMSAPI, pole nadawcy gotowe |
| `FLD-SIGN-AUDIT-TRAIL` | ślad append-only z łańcuchem skrótów między wpisami, karta podpisu w PDF |
| `FLD-SIGN-TSA` | kwalifikowany znacznik czasu (RFC 3161) z **EuroCert** (D6), osadzenie i weryfikacja |
| `FLD-SIGN-DELIVERY-PROOF` | zdarzenie `delivery` z Mailtrap (D13) zapisane jako dowód, idempotentny callback |
| `FLD-SIGN-ABUSE-GUARD` | limit prób, ochrona przed enumeracją tokenów, osobny przegląd bezpieczeństwa przed wdrożeniem |
| `FLD-SIGN-DURABLE-COPY` | kopia podpisanego dokumentu dla klienta na trwałym nośniku (forma wg D5) |

- Wzory dokumentów: `docs/legal/` (D5). Dziś leżą tam wzory robocze z treścią zastępczą, co **wystarcza**
  do zbudowania zamrażania dokumentu, podpisu i karty podpisu. Prawdziwe treści podmienią pliki bez
  zmiany kodu, o ile zachowają listę pól `{{…}}` (zasady w `docs/legal/README.md`).
- Blokuje: pytania prawne z D5 (część zdalna, `FLD-SIGN-DURABLE-COPY`). D1, D4 i D6 rozstrzygnięte.
  Podpis na miejscu (`-DOC-FREEZE`, `-CAPTURE`, `-AUDIT-TRAIL`, `-TSA`) może ruszyć od razu.
- Uwaga techniczna (pytanie, nie decyzja): przy podpisie na miejscu **bez zasięgu** znacznik czasu da się
  nadać dopiero po synchronizacji, więc będzie późniejszy niż sam podpis. Trzeba zapytać prawnika, czy to
  problem.
- [ ] Potwierdzam moduł M5 i rodzinę `FLD-SIGN-*` (nazwy do korekty: ____________)

### M6: Geolokalizacja

- **Monter / audytor:** po wyruszeniu aplikacja w tle wykrywa wejście w promień 3 km i wysyła klientowi SMS
  (`N3` audyt, `N7` montaż, `N13` serwis, `N17` usterka). Przycisk „Wyruszam" (N12) zostaje jako ścieżka
  ręczna. Na miejscu przyciski „Rozpocznij" i „Zakończ" odblokowują się w promieniu 20 m. Zapisywane są
  tylko zdarzenia punktowe, nigdy trasa, także przy lokalizacji w tle (geofencing systemowy, nie śledzenie).
- Istniejące ID: `FLD-GEO-UNLOCK`, `FLD-GEO-EN-ROUTE` (brzmienie **bez zmian**, D1 = React Native),
  `FLD-GPS-RODO`, `FLD-GEO-COORDS` (do zamknięcia; kryt. 5 dotyczy teraz realnie drugiej ścieżki tworzenia
  leada z D14, która też musi zapisać współrzędne).
- Nowe ID: brak (`FLD-GEO-DEPART` niepotrzebne przy React Native).
- Ryzyko: przegląd Apple dla lokalizacji w tle (uzasadnienie w opisie aplikacji, plan §5.5).
- Ryzyko: GPS telefonu w budynku ma często dokładność gorszą niż 20 m. Potrzebna jest ścieżka awaryjna
  (np. odblokowanie przez dyspozytora z wpisem do `audit_log`), inaczej monter utknie pod drzwiami klienta.
- Blokuje: D5 pkt 5 i 7 (K4, lokalizacja w tle) dla `FLD-GEO-EN-ROUTE`. `FLD-GEO-UNLOCK` (aplikacja otwarta)
  może ruszyć wcześniej.
- [ ] Potwierdzam moduł M6
- [ ] Potrzebna ścieżka awaryjna odblokowania przez dyspozytora

### M7: Audyt i wycena na miejscu (ścieżka audytora)

- **Audytor:** formularz pomieszczenie po pomieszczeniu (moc wpisywana, nie wyliczana, K7), notatki
  tekstowe, zdjęcia, wybór koszyka czasu (ta sama logika co `FLD-QUOTE-BASKET-SELECT` w panelu), tryb
  montażu (jedno- czy dwuetapowy), oferta z 1–3 wariantami, wysłanie oferty (`T02`).
- **Klient:** dostaje ofertę mailem i wybiera wariant.
- Istniejące ID: `FNL-E2-E3`, `FNL-2PHASE` kryt. 2, `FLD-QUOTE-BASKET-SELECT` (ścieżka audytora „na później").
- **Audytor (D14, w zakresie):** zakłada leada w aplikacji dla klienta, który nie przeszedł przez Triage
  (dane kontaktowe, adres ze współrzędnymi, zgody RODO klienta), i od razu przechodzi do audytu.
- Nowe ID: `FLD-AUDIT-LEAD-CREATE` (D14; zmiana kontraktu, luka nr 6 z rozdziału 4), `FLD-AUDIT-FORM`,
  `FLD-AUDIT-INSTALL-TYPE`, `FLD-QUOTE-BASKET-SELECT-AUDITOR`, `FLD-QUOTE-VARIANTS` (K2).
- Później (osobna decyzja): rysowane adnotacje na zdjęciach (N4, `FLD-PHOTO-ANNOTATE`), katalog urządzeń
  na tablecie (N5), kalkulator na 35-pozycyjnym cenniku (`price_list_items`).
- Blokuje: luki nr 1 i 6 z rozdziału 4 (zmiany kontraktu). D1, D3, D11, D14 rozstrzygnięte. Podpis umowy
  na miejscu czeka na D5 (treść umowy konsumenckiej) i jest w M8.
- **Skąd bierze się cena:** patrz **M9**. M7 odpowiada za to, co audytor widzi i wysyła (formularz,
  warianty, oferta), a M9 za to, z czego liczy się kwota (cennik kosztorysowy i silnik wyceny).
- [ ] Potwierdzam moduł M7

### M8: Umowa, faktura, płatność

- **Klient:** podpisuje umowę (M5), dostaje **proformę albo wezwanie do zapłaty**, płaci (link), po
  zaksięgowaniu wpłaty dostaje **automatycznie fakturę zaliczkową**, a po montażu **fakturę rozliczeniową**
  (D9). Przy montażu dwuetapowym faktura rozliczeniowa wychodzi dopiero po etapie II. Kwota zaliczki to
  110% ceny brutto zestawu urządzeń, czyli `cena_netto_zestawu × 1,23 × 1,1` (D8).
- **Księgowość:** wszystko przez **inFakt**, KSeF po stronie dostawcy.
- Istniejące ID: `FNL-E3-E4`, `FNL-2PHASE-INVOICE`, `B2C-CONSENT-RODO` (wersja regulaminu przy akceptacji).
- Nowe ID: `FLD-CONTRACT-GENERATE` (umowa z oferty na wzorze z `docs/legal/`), `INV-PROFORMA`,
  `INV-ADVANCE-AUTO` (faktura zaliczkowa wystawiana automatycznie po wpłacie, idempotentnie),
  `INV-FINAL` (faktura rozliczeniowa po montażu), `DOC-LEGAL-VERSION-REGISTRY` (rejestr wersji dokumentów
  klienta w bazie — luka opisana w `docs/legal/README.md`), `PAY-DEPOSIT-LINK` (link do płatności;
  styk z Pakietem Dodatkowym A: PayU).
- Wyliczenie zaliczki (D8) należy do `FLD-QUOTE-VARIANTS` w M7, bo zależy od wybranego wariantu oferty,
  a nie do faktury.
- Blokuje: treści dokumentów i pytania prawne (D5), rejestracja spółki (PayU, konto inFakt).
- [ ] Potwierdzam moduł M8 w zakresie **tego** projektu
- [ ] M8 to osobny projekt (faktury + PayU); tutaj tylko umowa i podpis

### M9: Wycena kosztorysowa i cennik (kalkulator audytora)

Moduł **dopisany 2026-09-23** na pytanie „a co z modułem wyceny dla audytora?". Wcześniej był w tym
dokumencie tylko jako pole wyboru przy M7 („kalkulator 35 pozycji w zakresie czy nie") i jako pozycja
w rozdziale „poza zakresem". To była luka: bez niego audytor ma z czego **złożyć** ofertę, ale nie ma
z czego **policzyć** ceny.

**Stan faktyczny (sprawdzony w kodzie 2026-09-23):**

| Element | Stan |
|---|---|
| `cennik_uslug` (tabela w bazie) | istnieje, ale ma tylko `nazwa_uslugi`, `jm`, `koszt_b2c_netto`, `koszt_b2b_netto` |
| Kto ją czyta | **wyłącznie B2C**, zawsze jednym zapytaniem o `'Montaż wzorcowy'`, z zapasowym literałem 1200 zł |
| `koszt_b2b_netto` | martwa kolumna, zero konsumentów |
| Ceny urządzeń | są: `indoor_units`, `outdoor_units`, `available_combinations` (B2C już z nich liczy ceny zestawów) |
| Cennik kosztorysowy (35 pozycji z arkusza „Formularz wyceny") | **nie istnieje w systemie**, żyje w Google Sheets |
| `quotes`, `quote_variants`, `quote_items` | nie istnieją; wycena to dziś dwa pola tekstowe na `leady` |

Czyli: cena urządzeń jest policzalna od dziś, a cena montażu nie. Plan (§4.2, §4.3) opisuje to jako
„w 100% greenfield".

**Co robi użytkownik (po decyzji D15 z 2026-09-23):**

- **Audytor (aplikacja):** w formularzu wpisuje **ilości pozycji** z cennika (per pomieszczenie), widzi
  sumę netto i brutto oraz kwotę zaliczki wg D8. Pozycje indywidualne („zwyżka", montaż na stelażu)
  dodaje ręcznie — plan wprost wyklucza je z automatu, bo nie da się ich wycenić z formularza.
- **Klient w Triage (B2C):** nic nie wpisuje. System sam podstawia **ilości z parametrów montażu
  standardowego** (pozycje w `m`, `mb`, `szt.`) i liczy cenę z **tego samego** cennika co audytor.
- **Administrator (panel B2B, ustawienia):** prowadzi **cennik wyceny** (pozycja, opis dla klienta, JM,
  koszt zakupu netto, cena sprzedaży netto, VAT, kategoria) oraz **konfigurację montażu standardowego**:
  które pozycje cennika i w jakich ilościach składają się na standard. Zmiana ceny jest wersjonowana
  w czasie, bo oferta sprzed miesiąca musi dać się odtworzyć w cenach z dnia wystawienia.

**Gdzie w panelu.** Dwa nowe ekrany w istniejącej sekcji `Ustawienia` (tam, gdzie dziś są „Kalendarz
i wizyty" oraz „Użytkownicy i uprawnienia"): `/settings/pricing` (cennik) i `/settings/standard-installation`
(montaż standardowy). Drugi ekran czyta pozycje z pierwszego, więc kolejność budowy jest wymuszona.

**Montaż standardowy jako dane, nie jako tekst.** Dziś standard żyje w `DEFINICJA-MONTAZU-STANDARDOWEGO.md`
jako tabela dla 1, 2 i 3 pomieszczeń (np. instalacja chłodnicza do 3 mb na jednostkę, koryta do 3 mb,
1 przewiert na jednostkę). Po tej zmianie ta tabela staje się konfiguracją w bazie. Do rozstrzygnięcia
w Work Orderze: czy ilości opisujemy wzorem „na każdą jednostkę wewnętrzną" (wtedy 1, 2 i 3 pomieszczenia
wychodzą z jednej reguły), czy trzema osobnymi zestawami. Rekomenduję wzór na jednostkę, bo dokument
i tak mnoży te same liczby przez liczbę pomieszczeń.

**Co upraszcza decyzja D8.** Plan projektował cennik pod regułę „zaliczka = pozycje z flagą `FZ` +
urządzenia", więc flaga `FZ` (9 z 35 pozycji) była elementem obowiązkowym. Po D8 zaliczka to `1,1 ×
cena brutto zestawu urządzeń`, czyli **flaga `FZ` przestaje być potrzebna do liczenia zaliczki.**
Zostaje ewentualnie jako informacja księgowa, ale nie jako mechanizm.

**Nowe ID:**

| Proponowane ID | Co gwarantuje |
|---|---|
| `PRICE-LIST-SCHEMA` | tabela `price_list_items`: koszt zakupu osobno od ceny sprzedaży, kategoria, wersjonowanie cen w czasie |
| `PRICE-LIST-IMPORT` | import cennika robocizny z arkusza, z ujednoliceniem kategorii `MR`/`RM` (plan §4.3 pkt 2) |
| `PRICE-LIST-ADMIN` | ekran `/settings/pricing`: prowadzenie cennika przez administratora, zmiana ceny jako nowa wersja, nigdy nadpisanie |
| `STD-INSTALL-CONFIG` | ekran `/settings/standard-installation`: montaż standardowy jako zestaw pozycji cennika z ilościami; jedno źródło dla Triage i dla oferty |
| `B2C-TRIAGE-PRICE-FROM-PRICE-LIST` | Triage liczy cenę montażu z cennika i konfiguracji standardu, zamiast z pozycji `'Montaż wzorcowy'` w `cennik_uslug` i literału 1200 zł |
| `FLD-QUOTE-CALC` | silnik wyceny: pozycje × ilości per pomieszczenie, suma netto/brutto, marża na pozycji, kwota zaliczki wg D8 |
| `FLD-QUOTE-ROOMS` | wycena pomieszczeniami: dodaj pomieszczenie, uzupełnij ilości pozycji `ROOM`, dodaj kolejne (D17) |
| `FLD-QUOTE-GENERAL-ITEMS` | osobna sekcja pozycji ogólnych całej instalacji, `scope = INSTALLATION` (D17) |
| `PRICE-VAT-RATE` | stawka z obiektu: zaznaczenie audytora w Field App, dane klienta w Triage; próg 300 m² z kontraktu SLA |
| `FLD-QUOTE-MANUAL-ITEM` | pozycja indywidualna poza cennikiem (stelaż, zwyżka), zawsze z opisem i ceną wpisaną ręcznie |
| `FLD-QUOTE-PRICE-SNAPSHOT` | oferta i wycena z Triage pamiętają ceny z dnia wystawienia; późniejsza zmiana cennika nie zmienia tego, co klient dostał |

- **Cennik dostarczony 2026-09-23** i zapisany w repozytorium: [`cennik-robocizny.csv`](../architecture/cennik-robocizny.csv)
  (dane do importu) oraz [`CENNIK-ROBOCIZNY.md`](../architecture/CENNIK-ROBOCIZNY.md) (opis, braki, wyliczenie
  montażu standardowego). **39 pozycji**, jednostki `mb`, `szt`, `m`, kategorie `Materiał` / `Robocizna` /
  `Robocizno-materiał`, kolumny: koszt ekipy netto i cena sprzedaży netto.
- Blokuje: **D16** (braki w cenniku, niżej) — ale tylko marżę, rozliczenia ekip i pełny automat; schemat,
  ekrany i wycena po cenach sprzedaży da się zrobić od razu.
- Zależy od `FLD-QUOTE-VARIANTS` z M7 (tabele `quotes`).
- Uwaga na kolejność: zmiana sposobu liczenia ceny w Triage dotyka **działającej, publicznej** ścieżki
  sprzedaży. Powinna wejść dopiero, gdy cennik i konfiguracja standardu są kompletne, i wymaga
  porównania cen przed i po na kilku typowych konfiguracjach (R18).
- [ ] Potwierdzam moduł M9


---

## 6. Tabela wszystkich wymagań

Legenda szacunku: **R** = rozpisany (z planu §5.4, dopasowany do wariantu), **Z** = zgrubny, rząd wielkości.
MD = klasyczne dni pracy (patrz zastrzeżenie w D3). Szacunki dla wariantu **React Native + Expo (D1 = C,
2026-09-21), telefon dla obu ról, obie ścieżki**.

### 6.1 Istniejące wpisy domeny `field` (17)

| ID | Status | Powód blokady / uwaga | Co odblokowuje | Moduł | Szacunek pozostałej pracy |
|---|---|---|---|---|---|
| `FLD-AVAIL-SELF` | DONE | — | ekran dostępności w aplikacji | M1 | 0 (tylko UI w M1) |
| `FLD-AVAIL-RESTORE` | DONE | — | jw. | M1 | 0 |
| `FLD-AVAIL-WEEKLY-RULES` | DONE | — | jw. | M1 | 0 |
| `CAL-SLOT-ENGINE` | DONE | — | lista zleceń, rezerwacja etapu II | M1, M4 | 0 |
| `FLD-BOOKING-ATOMIC-ASSIGN` | DONE | — | jw. | M4 | 0 |
| `FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT` | DONE | — | jw. | M4 | 0 |
| `FLD-QUOTE-BASKET-SELECT` | DONE | zrobione dla dyspozytora; audytor „na później" | M7 | M7 | patrz nowe ID |
| `FLD-GEO-COORDS` | TODO | testy istnieją, `saveLead.ts` zapisuje współrzędne; kryt. 5 (druga ścieżka tworzenia leada) staje się realne przez D14 | M6 | M6, M7 | Z: 0,5 MD (zamknięcie) + w `FLD-AUDIT-LEAD-CREATE` |
| `FLD-CONSENT-ACCEPT` | TODO | serwer i testy są; brak aplikacji, w której pracownik akceptuje | `FLD-CONSENT-ENFORCE`, `FLD-GPS-RODO` kryt. 5 | M2 | Z: 0,5 MD (zamknięcie po M2) |
| `FLD-LEGAL-DOC-VERSION` | TODO | jw. | jw. | M2 | Z: 0,5 MD |
| `FLD-BASE-LOCATION-EDIT` | TODO | ścieżka administratora z testami; brak ścieżki pracownika („w Field App") | przydział promieniowy | M1 | Z: 1 MD |
| `FLD-GEO-UNLOCK` | BLOCKED | brak aplikacji | start/koniec zlecenia na miejscu | M6 | Z: 2–3 MD |
| `FLD-GEO-EN-ROUTE` | BLOCKED | brak aplikacji; brzmienie bez zmian (D1 = RN); lokalizacja w tle czeka na D5 | SMS „w drodze" N3/N7/N13/N17 | M6 | Z: 3–5 MD (geofencing w tle + przegląd Apple) |
| `FLD-GPS-RODO` | BLOCKED | brak aplikacji; K4 u prawnika | M6 w ogóle | M6 | Z: 1 MD |
| `FLD-AUTH-BLOCKED` | BLOCKED | brak aplikacji | M1 w ogóle | M1 | Z: 1–2 MD (kontrola w warstwie API, wzorzec z `middleware.ts`) |
| `FLD-CONSENT-TRIGGERS-INTEGRATION` | BLOCKED | **nieaktualny powód** (brak Postgresa w CI, S15) | pewność mechanizmów zgód | M2 | Z: 1 MD, niezależne od Field App |
| `FLD-PHOTO-SET` | BLOCKED | brak aplikacji; skład zdjęć (D7); etap I | M4 (zamknięcie montażu) | M3 | patrz M3 |

### 6.2 Istniejące wpisy spoza domeny, od których zależy projekt

| ID | Status | Uwaga | Moduł |
|---|---|---|---|
| `FNL-2PHASE` | TODO | kryt. 2: brak ścieżki zapisu trybu przez audytora; kryt. 1 należy do B2C | M7 |
| `FNL-2PHASE-INVOICE` | TODO | **do przepisania:** dziś mówi o fakturze po etapie I, a D9 przesuwa rozliczenie za etap II | M8 |
| `FNL-E2-E3` | TODO | wycena z Field App; tabela `quotes` nie istnieje | M7 |
| `FNL-E3-E4` | TODO | akceptacja + rezerwacja; tu wpada podpis umowy | M8 |
| `FNL-E7-E8` | TODO | zamknięcie montażu przez montera; `N8` z 3 załącznikami (K5) | M4 |
| `NTF-PUSH-TOKEN` | TODO | przy React Native push jest naturalny (`expo-notifications`), ale **poza zakresem** tego projektu | — |
| `NTF-RETRY`, `NTF-QUEUE-WINDOW` | TODO | wysyłka z kolejki; **zależność Z1** | M4, M5 |
| `SEC-AUDIT-LOG-APPEND-ONLY` | TODO | wzorzec dla śladu podpisu | M5 |
| `B2C-CONSENT-RODO` | TODO | wersja regulaminu przy akceptacji klienta; przy D14 także zgody zbierane przez audytora | M7, M8 |
| `B2C-LEAD-ENTRY` | — | „jedyne legalne wejście” do lejka; do zmiany przez D14 | M7 |

### 6.3 Proponowane nowe wpisy

| Proponowane ID | Moduł | Etap | Co odblokowuje | Szacunek |
|---|---|---|---|---|
| `FLD-APP-SHELL` | M1 | 1 | wszystko w aplikacji (Expo, nawigacja, logowanie, Metro w monorepo) | Z: 4–6 MD |
| `FLD-API-LAYER` | M1 | 1 | każdy zapis z aplikacji (Route Handlery + token + `can()` + idempotencja; aneks ADR-013) | Z: 5–8 MD |
| `FLD-APP-DISTRIBUTION` | M1 | 1 | instalacja u pracowników (EAS Build/Update, TestFlight, Play Console) | Z: 2–3 MD |
| `FLD-MOBILE-TEST-HARNESS` | M1 | 1 | pętla RED→GREEN dla aplikacji (Jest + RNTL, Maestro, CI) | Z: 2–3 MD |
| `FLD-JOBS-OWN` | M1 | 1 | M3, M4, M6, M7 | Z: 1–2 MD |
| `FLD-CONSENT-ENFORCE` | M2 | 1 | zamknięcie `FLD-CONSENT-ACCEPT`, `FLD-GPS-RODO` kryt. 5 | Z: 1–2 MD |
| `FLD-CHECKLIST-PREINSTALL` | M3 | 2 | KPI jakości | Z: 1–2 MD |
| `FLD-PHOTO-STORAGE` | M3 | 2 | `FLD-PHOTO-SET` | Z: 1–2 MD |
| `FLD-PHOTO-UPLOAD-RESILIENT` | M3 | 2 | praca przy słabym zasięgu | Z: 2–3 MD |
| `FLD-OFFLINE-OUTBOX` | M3, M7 | 2 | D11 wersja wąska (`expo-sqlite` + kolejka) | Z: 4–6 MD |
| `FLD-HANDOVER-PROTOCOL` | M4 | 2 | `FNL-E7-E8`, `N8`, `N8a` | Z: 2–3 MD |
| `DOC-PDF-RENDER` | M4, M5, M7, M8 | 2 | protokół, umowa, oferta | Z: 2–3 MD |
| `FLD-INSTALL-PAYOUT-APPROVAL` | M4 | 2 | OPS-06, wypłaty ekip (D10 = A) | Z: 1–2 MD |
| `FLD-SIGN-DOC-FREEZE` | M5 | 3 | każdy podpis | R: 1–1,5 MD |
| `FLD-SIGN-CAPTURE` | M5 | 3 | podpis palcem na telefonie (Skia) | R: 1,5–2 MD |
| `FLD-SIGN-AUDIT-TRAIL` | M5 | 3 | dowód | R: 2–3 MD |
| `FLD-SIGN-TSA` | M5 | 3 | dowód niezależny od nas (EuroCert, D6) | R: 2–3 MD |
| (testy i bufor podpisu na miejscu wg planu §5.4) | M5 | 3 | — | R: 3 MD |
| `FLD-AUDIT-LEAD-CREATE` | M7 | 4 | D14: lead zakładany przez audytora (zmiana kontraktu) | Z: 3–5 MD |
| `FLD-AUDIT-FORM` | M7 | 4 | `FNL-E2-E3` | Z: 5–8 MD |
| `FLD-AUDIT-INSTALL-TYPE` | M7 | 4 | `FNL-2PHASE` kryt. 2 | Z: 1–2 MD + zmiana uprawnień |
| `FLD-QUOTE-BASKET-SELECT-AUDITOR` | M7 | 4 | spójny słownik koszyków | Z: 1 MD |
| `FLD-QUOTE-VARIANTS` | M7 | 4 | K2, `N4`, wyliczenie zaliczki wg D8 | Z: 4–6 MD (z tabelą `quotes`) |
| `PRICE-LIST-SCHEMA` | M9 | 4 | cennik w bazie (koszt zakupu ≠ cena sprzedaży, wersje cen) | Z: 1–2 MD |
| `PRICE-LIST-IMPORT` | M9 | 4 | import cennika robocizny z arkusza (Z2) | Z: 1 MD |
| `PRICE-LIST-ADMIN` | M9 | 4 | ekran `/settings/pricing` w panelu B2B | Z: 3–4 MD |
| `STD-INSTALL-CONFIG` | M9 | 4 | ekran `/settings/standard-installation`; wspólne źródło ilości dla Triage | Z: 3–4 MD |
| `B2C-TRIAGE-PRICE-FROM-PRICE-LIST` | M9 | 4 | Triage liczy z tego samego cennika; koniec z literałem 1200 zł | Z: 2–3 MD |
| `FLD-QUOTE-CALC` | M9 | 4 | automatyczna wycena z cennika, marża, kwota zaliczki wg D8 | Z: 4–6 MD |
| `FLD-QUOTE-MANUAL-ITEM` | M9 | 4 | pozycja indywidualna poza cennikiem (stelaż, zwyżka) | Z: 1 MD |
| `FLD-QUOTE-PRICE-SNAPSHOT` | M9 | 4 | odtworzenie wysłanej oferty i wyceny z Triage w cenach z dnia wystawienia | Z: 1–2 MD |
| `FLD-SIGN-REMOTE` | M5 | 5 (po D5) | podpis zdalny | R: 5–7 MD |
| `FLD-SIGN-REMOTE-OTP` | M5 | 5 | D4.2 (obowiązkowy) | Z: 1–2 MD |
| `FLD-SIGN-DELIVERY-PROOF` | M5 | 5 | dowód doręczenia linku (Mailtrap) | Z: 1 MD (po Z1) |
| `FLD-SIGN-ABUSE-GUARD` | M5 | 5 | wdrożenie strony publicznej | R: 1,5–2 MD |
| `FLD-SIGN-DURABLE-COPY` | M5 | 5 | wg opinii prawnika | Z: 1 MD |
| (testy i bufor podpisu zdalnego wg planu §5.4) | M5 | 5 | — | R: 1,5–2,5 MD |
| `FLD-CONTRACT-GENERATE` | M8 | 6 | umowa z oferty na wzorze z `docs/legal/`; `FNL-E3-E4` | Z: 2–3 MD |
| `DOC-LEGAL-VERSION-REGISTRY` | M8 | 6 | wersjonowanie dokumentów klienta w bazie (luka z `docs/legal/README.md`) | Z: 1–2 MD |
| `INV-PROFORMA` | M8 | 6 | proforma / wezwanie do zapłaty przed wpłatą (D9 krok 1) | Z: 2–3 MD |
| `INV-ADVANCE-AUTO` | M8 | 6 | faktura zaliczkowa automatycznie po wpłacie, idempotentnie (D9 krok 2, inFakt) | Z: 3–4 MD |
| `INV-FINAL` | M8 | 6 | faktura rozliczeniowa po montażu, przy dwuetapowym po etapie II (D9 krok 3) | Z: 2–3 MD |
| `PAY-DEPOSIT-LINK` | M8 | 6 | model zaliczkowy | styk z Pakietem A (PayU), liczony tam |

Usunięte po decyzjach z 2026-09-21: `FLD-GEO-DEPART` (potrzebne tylko przy PWA).

### 6.4 Sumy (zgrubne, wariant React Native, obie ścieżki)

| Etap | Zakres | MD |
|---|---|---|
| 1 | Fundament: aplikacja, warstwa API, dystrybucja, testy mobilne, zgody, blokada konta (M1, M2) | ok. 17–27 |
| 2 | Montaż: zlecenie, checklista, zdjęcia, kolejka offline, protokół, PDF, zatwierdzenie wypłaty (M3, M4) | ok. 14–23 |
| 3 | Podpis na miejscu + odblokowanie w promieniu 20 m (M5 bez części zdalnej, `FLD-GEO-UNLOCK`) | ok. 12–16 |
| | **Ścieżka montera razem (etapy 1–3)** | **ok. 43–66** |
| 4 | Ścieżka audytora z zakładaniem leada (M7) | ok. 14–22 |
| 4b | Cennik, konfiguracja montażu standardowego, silnik wyceny, przepięcie Triage (M9, D15 = A) | ok. 16–23 |
| | **Obie ścieżki z podpisem na miejscu i pełną wyceną (etapy 1–4b)** | **ok. 73–111** |
| 5 | Podpis zdalny + SMS „w drodze” w tle + RODO lokalizacji (po D5) | ok. 15–21 |
| 6 | Umowa, rejestr wersji dokumentów i trzy dokumenty rozliczeniowe (M8 bez PayU) | ok. 10–15 |
| | **Razem pełny zakres** | **ok. 98–147** |

Poza sumą: zależność Z1 (wysyłka powiadomień, Pakiet 3 roadmapy, `NTF-GATEWAY`, ok. 4–6 MD) oraz drobne
zamknięcia niezależne od aplikacji (`FLD-CONSENT-TRIGGERS-INTEGRATION` ok. 1 MD, `FLD-GEO-COORDS` ok. 0,5 MD).

Dla porównania: przed decyzjami ten sam zakres w wariancie PWA szacowałem na 70–110 MD. Różnica to głównie
warstwa API, dystrybucja, drugi zestaw testów i geolokalizacja w tle.

---

## 7. Fazy wdrożenia i kolejność

### 7.1 Czy fazy z `FIELD-APP-PLAN.md` §7 mają jeszcze sens?

Częściowo. Od 2026-09-08 w panelu B2B powstała znaczna część „fundamentu":

| Faza planu | Stan dziś |
|---|---|
| 0: rozstrzygnięcia | rozstrzygnięte 2026-09-21: platforma (RN), A1/ADR-013 (Route Handlery), A2 (offline wąski), K1 (lead od audytora w zakresie), zamknięcie montażu, sprzęt, e-mail, kształt podpisu. **Otwarte:** prawnik (w tym K4), TSA, zdjęcia (K6), zaliczka (D-PAY), księgowy |
| 1: fundament danych | **w większości zrobione**: Postgres w CI, `bookings`, `absences`, reguły dostępności, współrzędne, numer projektu. **Brak:** `documents`, `invoices`, cennik kosztorysowy |
| 2: szkielet aplikacji + powiadomienia | **nic**: ani aplikacji, ani wysyłki |
| 3–6: ścieżka audytora | nic poza koszykiem w panelu |
| 7: ścieżka montera | mechanika dwuetapowa w panelu; reszta nie istnieje |
| 8–9: komunikacja, KSeF | poza zakresem |

Numeracja faz planu miesza się z Pakietami roadmapy i wersjami v1/v2/v3 (S14). Proponuję **nową**,
krótszą kolejność etapów, które odpowiadają rozdziałowi 6, przy D3 = obie ścieżki.

### 7.2 Proponowana kolejność

```
Etap 0  Rejestracja wymagań + aneks ADR-013 (zero kodu)    ── ok. 1 tydzień od potwierdzenia D2
   │
Etap 1  Fundament: M1 (Expo, API, dystrybucja, testy), M2  ┐
   │    (równolegle, poza projektem: Z1 wysyłka)            │  ścieżka montera
Etap 2  Montaż: M3, M4 + DOC-PDF-RENDER + outbox           │  ok. 43–66 MD
   │                                                        │
Etap 3  Podpis na miejscu: -DOC-FREEZE/-CAPTURE/            │
   │    -AUDIT-TRAIL/-TSA (EuroCert) + FLD-GEO-UNLOCK       ┘
   │
Etap 4  Ścieżka audytora: M7 + FLD-AUDIT-LEAD-CREATE        ── ok. 14–22 MD; może iść równolegle
   │                                                           z etapami 2–3 po zakończeniu etapu 1
   │
Etap 4b Cennik, montaż standardowy, silnik wyceny (M9)      ── ok. 16–23 MD; wymaga cennika (Z2);
   │    + przepięcie Triage na wspólny cennik                     przepięcie Triage na końcu etapu
   │
Etap 5  Podpis zdalny (+OTP) + SMS „w drodze" w tle         ── po opinii prawnika (D5)
   │
Etap 6  Umowa, faktury, płatność: M8                        ── po treściach z D5 i KRS spółki
```

| Etap | Zależy od | Rodzaj szacunku | MD |
|---|---|---|---|
| 0 | potwierdzenie D2, okno kontraktowe | — | 1–2 |
| 1 | etap 0 | Z | 17–27 |
| 2 | etap 1 | Z | 14–23 |
| 3 | etap 2; umowa z EuroCert podpisana | R (z planu §5.4, bez części zdalnej) | 12–16 |
| 4 | etap 1, luki nr 1 i 6 (zmiany kontraktu) | Z | 14–22 |
| 4b | etap 4, plik z cennikiem robocizny (Z2) | Z | 16–23 |
| 5 | etap 3, D5, Z1 | R + Z | 15–21 |
| 6 | etapy 4–5, treści z D5, konto inFakt, spółka | Z | 10–15 + PayU |

**Uczciwie o terminie (D3 dopuszcza przesunięcie):** obie ścieżki z podpisem na miejscu to ok. 57–88 MD
w jednostkach tego dokumentu, czyli więcej niż 10 tygodni do 30.11. W jednostkach roadmapy (godziny pracy
z agentami) może być inaczej. Dlatego nadal rekomenduję kalibrację na zamkniętym zadaniu (D3), zanim
padnie data. Proponowany punkt kontrolny: po zamknięciu etapu 1 porównać rzeczywisty czas z szacunkiem
17–27 MD i dopiero wtedy ustalić daty etapów 2–4. Jeśli próby od 1.12 mają się odbyć, to pierwszy
kandydat na „wystarczająco dużo" to etapy 1–3 (ścieżka montera), a oferty dalej przygotowuje dyspozytor
w panelu, dopóki etap 4 nie jest gotowy.

- [ ] Akceptuję kolejność etapów 0–6
- [ ] Zmieniam kolejność: ____________

---

## 8. Poza zakresem (jawnie)

- Wersja na tablet i obsługa rysika (D12 = telefon).
- Ciągłe śledzenie trasy pracownika, zawsze (wymóg `FLD-GPS-RODO`, nie wybór).
- Rysowane adnotacje na zdjęciach (N4) i katalog urządzeń na tablecie (N5).
- **Kalkulator kosztorysowy przestał być „poza zakresem" 2026-09-23** — jest modułem M9, patrz D15.
- Komunikacja ekipa ↔ audytor (N13), uwagi w trzech kategoriach (N14), faza 8 planu.
- Rozliczenia ekip i KSeF (N18, faza 9 planu).
- Powiadomienia push (`NTF-PUSH-TOKEN`).
- Protokół przeglądu serwisowego i zgoda na zdjęcia w social media (D4.3, rozstrzygnięte 2026-09-21).
- Przeglądanie danych bez zasięgu (D11 = wersja wąska).
- Integracja PayU (Pakiet Dodatkowy A roadmapy), wysyłka powiadomień (Pakiet 3), liczone tam, a tu tylko
  jako zależności.
- Synchronizacja z Google Calendar (S12).
- Wirtualny asystent „Field App DTR" z backlogu (`AI-CHAT-SUITE`).

---

## 9. Ryzyka

| # | Ryzyko | Skutek | Co proponuję |
|---|---|---|---|
| R1 | Obie ścieżki (D3) nie mieszczą się do 30.11 (S2) | przesunięcie prób albo pośpiech przy podpisie, czyli w miejscu o skutkach prawnych | przesunięcie harmonogramu dopuszczone (D3); punkt kontrolny po etapie 1; kalibracja szacunków |
| R2 | Opinia prawna przyjdzie późno (D5 zaparkowane) | podpis zdalny, umowa i SMS „w drodze” w tle bez podstawy | etapy 1–4 nie czekają na prawnika; etapy 5–6 tak |
| R3 | Strona podpisu zdalnego jest publiczna | błąd bezpieczeństwa ma bezpośredni skutek prawny | `FLD-SIGN-ABUSE-GUARD` + przegląd `rls-security-auditor` przed wdrożeniem |
| R4 | Dokładność GPS w budynku gorsza niż 20 m | monter nie może zacząć ani skończyć pracy | ścieżka awaryjna przez dyspozytora (M6) |
| R11 | Konto Apple Developer dla organizacji wymaga numeru D-U-N-S, a spółka powstaje w listopadzie | brak dystrybucji na iOS przez TestFlight w etapie 1 | sprawdzić teraz; na start Android (Play, testy wewnętrzne) albo konto indywidualne i przeniesienie aplikacji po rejestracji spółki |
| R12 | Przegląd Apple dla lokalizacji w tle | opóźnienie publikacji albo odrzucenie | geofencing systemowy zamiast ciągłego śledzenia, uzasadnienie w opisie; lokalizacja w tle dopiero w etapie 5 |
| R13 | Druga ścieżka zapisu (Route Handlery obok Server Actions) | rozjazd uprawnień między panelem a aplikacją | jedna funkcja domenowa + `can()` wołana z obu ścieżek; test kontraktowy macierzy dla każdego Route Handlera; przegląd `rls-security-auditor` |
| R14 | Umowa czytana i podpisywana na ekranie telefonu (D12) | zarzut, że klient nie mógł zapoznać się z treścią | pytanie 8 do prawnika; możliwość wysłania treści mailem przed podpisem |
| R15 | Faktura zaliczkowa wystawiana automatycznie po wpłacie (D9 krok 2) | podwójna faktura przy ponowionym webhooku płatności; korekta to praca księgowej, nie kliknięcie | klucz idempotencji na płatności i na dokumencie, test ponowionego webhooka jako kryterium `INV-ADVANCE-AUTO` |
| R16 | Zaliczka to 110% ceny brutto urządzeń (D8) | przy tanim montażu zaliczka może przekroczyć wartość całej oferty, a przy drogim — wyglądać na niespójną z „40–50%” z prezentacji | reguła kontrolna w `FLD-QUOTE-VARIANTS`: zaliczka nigdy większa niż wartość oferty; sprostowanie prezentacji |
| R18 | Przepięcie Triage na wspólny cennik **podnosi cenę widoczną publicznie mniej więcej dwukrotnie** | dziś montaż to `'Montaż wzorcowy'` × liczba pomieszczeń (zapasowo 1200 zł/pom.), a z dostarczonego cennika standard wychodzi ok. **2 483 zł netto** za pierwsze pomieszczenie i ok. 1 828 zł za każde następne. To zmiana oferty, nie refaktoryzacja | porównanie cen przed i po na typowych konfiguracjach (1, 2, 3 pomieszczenia) jako kryterium `B2C-TRIAGE-PRICE-FROM-PRICE-LIST`; wdrożenie dopiero po skompletowaniu cennika i konfiguracji standardu |
| R19 | Konfiguracja montażu standardowego rozjedzie się z `DEFINICJA-MONTAZU-STANDARDOWEGO.md` | klient dostanie ofertę niezgodną z tym, co firma obiecuje publicznie | dokument staje się opisem konfiguracji, a nie drugim źródłem prawdy; po wdrożeniu `doc-scribe` przepisuje go na odwołanie do ustawień |
| R20 | W Triage stawkę VAT wyliczamy z **sumy powierzchni pomieszczeń**, a nie z powierzchni lokalu | klient podaje tylko pomieszczenia klimatyzowane, więc suma zaniża metraż i może dać 8% tam, gdzie należy się 23%; błąd w stawce to korekta faktury, nie poprawka w kodzie | osobne pole „łączna powierzchnia lokalu" w Triage albo jawne oświadczenie klienta; stawkę ostatecznie ustala zaznaczenie audytora, a cena z Triage jest orientacyjna (D17) |
| R21 | Próg 300 m² może nie dotyczyć **lokali** mieszkalnych | przepisy o stawce 8% wymieniają 300 m² dla domów jednorodzinnych, a dla lokali mieszkalnych mówi się o niższym progu; jeśli tak jest, część wycen wyjdzie z błędną stawką | **pytanie do księgowego przed wdrożeniem `PRICE-VAT-RATE`**; próg trzymamy w kontrakcie SLA, więc zmiana to jedna wartość, nie przegląd kodu |
| R17 | Wzory w `docs/legal/` to dziś lorem ipsum | ryzyko wysłania klientowi dokumentu z treścią zastępczą podczas prób | przyrostek `-lorem` w nazwie pliku + bramka przed wysyłką: dokument oznaczony jako roboczy nie może wyjść do klienta (kryterium w `FLD-CONTRACT-GENERATE`) |
| R5 | EuroCert może wymagać zarejestrowanej spółki | podpis bez znacznika czasu na próbach grudniowych | sprawdzić warunki EuroCert **przed etapem 3**; awaryjnie: podpisy bez TSA i dostemplowanie po zawarciu umowy (wtedy R8) |
| R6 | Brak wysyłki powiadomień (Z1) | protokół, `N8a` i link do podpisu nie dojdą do klienta | Z1 jako twarda zależność etapu 2 |
| R7 | Prezentacje i backlog opisują stan inny niż kod (S5, S9, S10) | złe oczekiwania wspólnika i inwestora; raport IP opisuje nieistniejący podpis | po Twoich decyzjach poprawić dokumenty (`doc-scribe`) |
| R8 | Podpis offline dostaje znacznik czasu dopiero po synchronizacji | pytanie o wartość dowodową | pytanie do prawnika (D5) |
| R9 | Numery seryjne i parametry prób wpisywane ręcznie | błędy w protokole i w gwarancji | walidacja formatu; skan kodu kreskowego jako późniejsze rozszerzenie |
| R10 | Dokumenty z 17.09 dalej mówią o PWA (S1) mimo D1 = RN | wspólnik i inwestor widzą inną aplikację niż budujemy | sprostowanie roadmapy, KPI, `field-app.md` i `BACKLOG.md` (`doc-scribe`) + wpis w `docs/01-ADR-spec-conflicts.md` |

---

## 10. Zależności zewnętrzne i terminy

Terminy z `ROADMAP-GTM-I-PROGNOZA-DEVELOPMENTU.md`: koniec developmentu **30.11.2026**, próby na żywo
**1.12.2026–31.01.2027**, onboarding ekip **luty 2027**, publiczny start **marzec 2027**.

| Zależność | Kto | Blokuje | Najpóźniejszy sensowny termin | Uwagi |
|---|---|---|---|---|
| Decyzje D1–D4 | Michał | start całości | — | **rozstrzygnięte** (D1, D3, D4 — 2026-09-21; D2 — 2026-09-23) |
| Treści dokumentów prawnych (D5) | Michał + prawnik | wysyłkę czegokolwiek do klienta na produkcji; **nie blokuje** etapów 1–4 | przed pierwszym prawdziwym klientem |
| Odpowiedzi na pytania prawne 1–8 (D5) | prawnik | etap 5 (podpis zdalny, lokalizacja w tle), etap 6 (umowa) | przed startem etapu 5 | budżet prawny w `PROGNOZA…md` (~1 000 zł na regulamin i RODO) nie obejmuje podpisu ani umowy konsumenckiej; do weryfikacji |
| Konto i klucz API inFakt (D9) | Michał | etap 6 (`INV-*`) | przed etapem 6 | narzędzie wybrane 2026-09-23; konto firmowe zapewne po wpisie spółki do KRS |
| Przepisanie `FNL-2PHASE-INVOICE` (D9) | `contract-steward` | etap 6 | etap 0 (rejestracja wymagań) | rozliczenie po etapie II, bez faktury po etapie I |
| Umowa z EuroCert (D6) | Michał | `FLD-SIGN-TSA` w etapie 3 | przed etapem 3 | sprawdzić, czy da się zawrzeć przed wpisem spółki do KRS (R5) |
| Rejestracja spółki (KRS) | Michał, Piotr | PayU produkcyjne, być może TSA | listopad 2026 (roadmapa) | — |
| Pole nadawcy SMS w SMSAPI | Michał | każdy SMS do klienta (N3/N7, OTP) | — | **złożone i przetestowane** (2026-09-21) |
| Domena i DKIM/SPF/DMARC dla Mailtrap | Michał | dowód doręczenia linku | 31.10.2026 | — |
| Wysyłka powiadomień (Z1, Pakiet 3) | development | etap 2 i 4 | przed etapem 2 | poza tym projektem, ale twarda zależność |
| ~~Z2: plik z cennikiem robocizny~~ (D15) | Michał | — | — | **dostarczone 2026-09-23** (arkusz Google), zapisane w repozytorium: [`cennik-robocizny.csv`](../architecture/cennik-robocizny.csv) i [`CENNIK-ROBOCIZNY.md`](../architecture/CENNIK-ROBOCIZNY.md). **39 pozycji**, nie 35 |
| Uzupełnienie braków w cenniku (D16) | Michał, Piotr | marża na pozycji, rozliczenia ekip, pełny automat wyceny | przed etapem 4b | 13 pozycji bez kosztu ekipy, 5 bez kategorii i opisu, brak stawki VAT |
| Telefony testowe (D12) | Michał, Piotr | testy UX podpisu | przed etapem 3 | co najmniej jeden iPhone i jeden Android (dwie platformy React Native) |
| Konta w sklepach (D1 = C) | Michał | dystrybucja (`FLD-APP-DISTRIBUTION`) | **przed końcem etapu 1** | Apple Developer: weryfikacja organizacji wymaga numeru D-U-N-S spółki (R11); Google Play Console |
| Certyfikat UDT | Piotr | onboarding ekip, nie aplikację | wpis w styczniu 2027 | nie blokuje developmentu; blokuje użycie aplikacji przez ekipy na komercyjnych zleceniach |
| Wzory umowy i pozostałych dokumentów | prawnik + Piotr | produkcyjne użycie `FLD-CONTRACT-GENERATE` | przed pierwszym prawdziwym klientem | wzory robocze leżą w `docs/legal/`; development na nich nie stoi |

---

## 11. Co się stanie po Twoim zatwierdzeniu

1. ~~Wpisuję Twoje wybory do tego pliku~~ **zrobione 2026-09-21** (rozdział 0 i zaznaczenia w rozdziale 3).
   Czekam na jedno słowo przy D2 oraz na potwierdzenie modułów M1–M8 i kolejności etapów.
2. `contract-steward` w oknie kontraktowym: rejestracja zatwierdzonych ID, zmiany statusów (np.
   `FLD-AUTH-BLOCKED` z BLOCKED na TODO), zmiana `FLD-PHOTO-SET` po D7, ewentualnie `N8` (K5), a z D14:
   drugie wejście do lejka (`B2C-LEAD-ENTRY`) i `leads:create` dla audytora. Z D7: `FLD-PHOTO-SET` ze
   stałych 4 zdjęć na wzór `4 + 2n` plus osobny komplet dla etapu I. Z D9: przepisanie `FNL-2PHASE-INVOICE`
   (rozliczenie po etapie II) i zdjęcie załącznika z fakturą z `N8a`. Równolegle aneks ADR-013
   w `docs/01-ADR-spec-conflicts.md`.
3. Work Ordery w kolejności etapów, **po jednym na artefakt i rolę**, a nie jeden na moduł.
4. Osobno, niezależnie od Field App: odblokowanie `FLD-CONSENT-TRIGGERS-INTEGRATION` (S15) i sprostowanie
   dokumentów z S1 (PWA), S5 (zdjęcia), S6 (zaliczka 40–50%), S9, S10, S11 (Resend) i S13 (tablet).
