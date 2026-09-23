# Plan dokończenia systemu KlikKlima

> **Stan na 2026-09-23.** Plan obejmuje **wszystko, co zostało do zrobienia w całym systemie**, nie tylko
> Field App. Powstał na żądanie Michała („zaplanuj teraz wszystkie prace niezbędne do ukończenia całego
> systemu"). Źródła: rejestr wymagań (`contracts/requirements.contract.mjs`, stan sprawdzony tego dnia),
> [zakres Field App i podpisów](FIELD-APP-I-PODPISY-ZAKRES.md), [BACKLOG.md](../BACKLOG.md),
> [roadmapa GTM](../prezentacje/ROADMAP-GTM-I-PROGNOZA-DEVELOPMENTU.md).

## 0. Jak czytać ten dokument

- **MD = jeden dzień pracy.** Roadmapa GTM liczy w godzinach pracy Michała z agentami (ok. 9,3 h/dzień).
  **Tych jednostek nie da się rzetelnie przeliczyć jedna na drugą** i to jest najważniejsze zastrzeżenie
  całego dokumentu — patrz rozdział 5.
- Szacunki są **zgrubne** (rząd wielkości), poza podpisem elektronicznym, który jest rozpisany w planie
  architektury.
- Identyfikatory w `KAPITALIKACH` to wymagania z rejestru kontraktu. Nazwy proponowane (jeszcze
  niezarejestrowane) są oznaczone **(nowe)**.

## 1. Stan faktyczny w liczbach

Rejestr zawiera **127 wymagań**. Zamkniętych jest 37, wycofanych 3, a **87 pozostaje otwartych**:

| Domena | Otwarte | W tym zablokowane | Co to obejmuje |
|---|---|---|---|
| `crm` | 21 | 0 | kartoteki klienta, instalacji, usterek, audytorów, ekip, numeracja, regiony |
| `security` | 15 | 0 | dziennik zdarzeń, RODO, uprawnienia odczytu, SSO, usuwanie danych |
| `b2c` | 14 | 0 | Triage, katalog, ceny „od", treści, zgody |
| `funnel` | 12 | 0 | przejścia lejka T01–T09, montaż dwuetapowy, rollbacki |
| `field` | 10 | 6 | aplikacja terenowa (cała) |
| `notifications` | 7 | 0 | wysyłka, okna czasowe, ponowienia, historia, push |
| `ui` | 6 | 0 | standardy interfejsu, kolory SLA, formularze |
| `service` | 3 | 0 | serwisy roczne, przypomnienia |
| `logistics` | 2 | 0 | doręczenie sprzętu, rollback terminu |

Do tego **31 wymagań proponowanych, jeszcze niezarejestrowanych**, z zakresu Field App, podpisu, wyceny
i faktur.

**Twarda prawda o stanie:** system ma zamknięty kalendarz, rezerwacje, RBAC, mechanikę montażu
dwuetapowego i Triage. Nie ma natomiast **wysyłki ani jednego SMS-a i maila**, aplikacji terenowej,
wyceny kosztorysowej, dokumentów, podpisu, faktur ani płatności. To są cztery z pięciu rzeczy, które
muszą działać, żeby firma obsłużyła pierwszego płacącego klienta.

## 2. Strumienie prac

Kolejność w tabeli to kolejność zależności, nie priorytetu biznesowego.

### P1: Wysyłka powiadomień `[fundament, blokuje prawie wszystko]`

Kolejka `notification_queue` działa i jest idempotentna, ale **nic z niej nie wychodzi**. Bez tego nie
ma linku do podpisu, protokołu, przypomnień ani SMS-a „jesteśmy w drodze".

- Wymagania: `NTF-CATALOG-PARITY`, `NTF-QUEUE-WINDOW`, `NTF-RETRY`, `NTF-POLY`, `NTF-HISTORY`,
  `NTF-I7-SLA`, **(nowe)** `NTF-GATEWAY-SMS` (SMSAPI, pole nadawcy gotowe), **(nowe)** `NTF-GATEWAY-EMAIL`
  (Mailtrap, D13), **(nowe)** `NTF-TEMPLATES` (szablony HTML).
- Szacunek: **8–12 MD**.
- Zależności: brak. **Może ruszyć natychmiast.**

### P2: Bezpieczeństwo, dziennik zdarzeń i RODO

- Wymagania: `SEC-AUDIT-LOG`, `SEC-AUDIT-LOG-APPEND-ONLY`, `SEC-AUDIT-LOG-DELETE`,
  `SEC-AUDIT-LOG-ROLE-CHANGE`, `SEC-AUDIT-LOG-MANUAL-STATUS`, `SEC-AUTHZ-B2B-READS`,
  `SEC-AUTHZ-USER-MGMT`, `SEC-ASSIGNMENT-POOL-MINIMIZE`, `SEC-SSO-GUARD`, `SEC-LAST-ADMIN-GUARD`,
  `SEC-EMAIL-CASE-NORMALIZE`, `CRM-CLIENT-ANONYMIZE-RODO`.
- **Sprostowanie 2026-09-23:** `SEC-RODO-DELETE`, `CRM-DELETE-ADMIN-ONLY` i `CRM-DELETE-ADMIN-ONLY-CLIENTS`
  mają w rejestrze status `SUPERSEDED` — zastąpiło je `CRM-CLIENT-ANONYMIZE-RODO` (usunięcie klienta
  realizowane jako anonimizacja). Nie planujemy ich osobno.
- Szacunek: **10–15 MD**.
- Uwaga: większość to wymagania o wysokim ryzyku. `SEC-RODO-DELETE` i anonimizacja muszą działać, **zanim**
  do systemu trafią dane pierwszych prawdziwych klientów, bo później wniosek o usunięcie danych staje się
  problemem prawnym, a nie zadaniem z backlogu.

### P3: Lejek, dokumenty i logistyka

- Wymagania: `FNL-E1-E2`, `FNL-E2-E3`, `FNL-E3-E4`, `FNL-E3-BUCKET`, `FNL-E4-E5`, `FNL-E6-E7`,
  `FNL-E7-E8`, `FNL-NO-ILLEGAL-TRANSITIONS`, `FNL-2PHASE`, `FNL-ROLLBACK-BOOKING-RELEASE`,
  `FNL-ROLLBACK-EXIT`, `SLA-QUOTE-14D`, `FNL-ADVANCE-STATUS-CONTRACT-BOUND`, **(nowe)** `DOC-PDF-RENDER`.
- Szacunek: **14–20 MD**.
- Zależności: P1 (każde przejście wysyła powiadomienie), tabela `quotes` z P5.

### P4: Wycena, cennik i VAT

Opisane szczegółowo jako moduł M9 w [zakresie Field App](FIELD-APP-I-PODPISY-ZAKRES.md).

- Wymagania **(wszystkie nowe)**: `PRICE-LIST-SCHEMA`, `PRICE-LIST-IMPORT`, `PRICE-LIST-ADMIN`,
  `STD-INSTALL-CONFIG`, `PRICE-VAT-RATE`, `B2C-TRIAGE-PRICE-FROM-PRICE-LIST`, `FLD-QUOTE-CALC`,
  `FLD-QUOTE-MANUAL-ITEM`, `FLD-QUOTE-PRICE-SNAPSHOT`, `FLD-QUOTE-VARIANTS`.
- Szacunek: **18–26 MD** (o 2–3 MD więcej niż w dokumencie zakresu, przez regułę VAT z 2026-09-23).
- Dane wejściowe: [cennik robocizny](../architecture/CENNIK-ROBOCIZNY.md), 39 pozycji, dostarczony.
- Uwaga: `PRICE-VAT-RATE` wymaga jednego nowego pytania w Triage (przedział powierzchni, wybór z listy)
  oraz wyboru rodzaju obiektu w formularzu audytora. To dotyka formularza B2C, czyli strumienia P8.

### P5: Aplikacja terenowa (Field App)

- Wymagania istniejące: `FLD-AUTH-BLOCKED`, `FLD-CONSENT-ACCEPT`, `FLD-LEGAL-DOC-VERSION`,
  `FLD-CONSENT-ENFORCE` (nowe), `FLD-BASE-LOCATION-EDIT`, `FLD-GEO-COORDS`, `FLD-GEO-UNLOCK`,
  `FLD-GEO-EN-ROUTE`, `FLD-GPS-RODO`, `FLD-PHOTO-SET`, `FLD-CONSENT-TRIGGERS-INTEGRATION`.
- Wymagania nowe: `FLD-APP-SHELL`, `FLD-API-LAYER`, `FLD-APP-DISTRIBUTION`, `FLD-MOBILE-TEST-HARNESS`,
  `FLD-JOBS-OWN`, `FLD-CHECKLIST-PREINSTALL`, `FLD-PHOTO-STORAGE`, `FLD-PHOTO-UPLOAD-RESILIENT`,
  `FLD-OFFLINE-OUTBOX`, `FLD-HANDOVER-PROTOCOL`, `FLD-INSTALL-PAYOUT-APPROVAL`, `FLD-AUDIT-FORM`,
  `FLD-AUDIT-INSTALL-TYPE`, `FLD-AUDIT-LEAD-CREATE`, `FLD-QUOTE-BASKET-SELECT-AUDITOR`.
- Szacunek: **45–68 MD** (etapy 1, 2, 4 z dokumentu zakresu).
- Zależności: P1, aneks ADR-013 (warstwa zapisu), konta w sklepach Apple i Google.

### P6: Podpis elektroniczny

- Wymagania **(wszystkie nowe)**: `FLD-SIGN-DOC-FREEZE`, `FLD-SIGN-CAPTURE`, `FLD-SIGN-AUDIT-TRAIL`,
  `FLD-SIGN-TSA`, `FLD-SIGN-REMOTE`, `FLD-SIGN-REMOTE-OTP`, `FLD-SIGN-DELIVERY-PROOF`,
  `FLD-SIGN-ABUSE-GUARD`, `FLD-SIGN-DURABLE-COPY`, `DOC-LEGAL-VERSION-REGISTRY`.
- Szacunek: **27–37 MD** (podpis na miejscu 12–16, zdalny 15–21).
- Zależności: EuroCert (TSA), P1 (dowód doręczenia), opinia prawnika dla części zdalnej.

### P7: Faktury i płatności

- Wymagania **(nowe)**: `INV-PROFORMA`, `INV-ADVANCE-AUTO`, `INV-FINAL`, `FLD-CONTRACT-GENERATE`,
  `PAY-DEPOSIT-LINK`, plus istniejące `FNL-2PHASE-INVOICE`.
- Szacunek: **14–20 MD** (w tym PayU ok. 4–5 MD).
- Zależności: inFakt (konto firmowe), KRS spółki, treści dokumentów od prawnika.

### P8: B2C — Triage, katalog, treści

- Wymagania: `B2C-LEAD-ENTRY`, `B2C-LEAD-ATOMIC`, `B2C-CONSENT-RODO`, `B2C-RLS-PUBLIC`,
  `B2C-TRIAGE-STEPS`, `B2C-TRIAGE-CONDITIONAL`, `B2C-SOFT-LEAD`, `B2C-BOOKING-VALIDATION`,
  `B2C-PRICE-FROM`, `B2C-CATALOG-LIST`, `B2C-DEVICE-MODAL`, `B2C-CATALOG-VIEW-TRACKED`,
  `B2C-CONTENT-PAGES`, `B2C-NAV-STATE`, **(nowe)** `B2C-PROPERTY-AREA-BAND` (warunkowe pytanie
  o przedział powierzchni lokalu, tylko dla `APARTMENT` i `HOUSE`, na potrzeby stawki VAT), **(nowe)** `CATALOG-REFRESH` (odświeżenie katalogu i cen hurtowych,
  Pakiet Dodatkowy B roadmapy).
- Szacunek: **12–18 MD**.

### P9: CRM i serwisy

- Wymagania: 21 wpisów `crm` (kartoteki klienta, instalacji, usterek, audytorów, ekip, numeracja,
  historia rezerwacji, regiony, raporty) + `SRV-SOURCE-OF-TRUTH`, `SRV-REMINDER-ONCE`, `SRV-NEXT-DATE`.
- Szacunek: **20–30 MD**.
- Uwaga: to najliczniejsza grupa, ale też najbardziej podzielna. Do prób od 1.12 wystarczy jej część.

### P10: Jakość, standardy i wdrożenie

- Wymagania: `UI-NO-HARDCODED-COLORS`, `UI-ICONS-LUCIDE-ONLY`, `UI-FORMS-RHF-ZOD`, `UI-SLA-NO-GREEN`,
  `SLA-LOG-COLORS`, `CRM-CONTEXT-MENU`, **(nowe)** `OPS-MONITORING` (Sentry), **(nowe)** `OPS-DOMAINS`
  (domeny produkcyjne, SSL, DKIM/SPF/DMARC), **(nowe)** `QA-E2E-CRITICAL-PATHS`.
- Szacunek: **10–15 MD**.

## 3. Sumy i kamienie milowe

| Strumień | MD |
|---|---|
| P1 Powiadomienia | 8–12 |
| P2 Bezpieczeństwo i RODO | 10–15 |
| P3 Lejek i dokumenty | 14–20 |
| P4 Wycena, cennik, VAT | 18–26 |
| P5 Field App | 45–68 |
| P6 Podpis elektroniczny | 27–37 |
| P7 Faktury i płatności | 14–20 |
| P8 B2C | 12–18 |
| P9 CRM i serwisy | 20–30 |
| P10 Jakość i wdrożenie | 10–15 |
| **Razem** | **178–261 MD** |

Kamienie milowe z roadmapy GTM i to, co realnie musi w nich być:

| Termin | Kamień | Minimum, żeby miało sens |
|---|---|---|
| 30.11.2026 | koniec developmentu przed próbami | P1 w całości, P2 w części RODO, P3 przejścia lejka, P4 wycena, P5 ścieżka montera, P6 podpis na miejscu |
| 01.12.2026–31.01.2027 | próby bojowe, 3–5 montaży | to, co wyżej, plus ręczne obejścia dla faktur (P7 może być niegotowe) |
| koniec 01.2027 | brama decyzyjna | dane z prób: czas protokołu, liczba poprawek, konwersja |
| 02.2027 | onboarding ekip | P5 w całości (obie ścieżki), P6 zdalny, P9 w części operacyjnej |
| 03.2027 | go-live | P7, P8, P10 |

**Minimum na 30.11 to ok. 95–140 MD.** Do 30 listopada jest ok. 10 tygodni.

## 4. Co proponuję wyciąć z zakresu do 30.11

Żeby próby mogły ruszyć 1 grudnia, a nie żeby wszystko było gotowe:

- **P7 (faktury i płatności)** — przy 3–5 montażach dokumenty można wystawić ręcznie w inFakcie.
  Automat wchodzi przed go-live, nie przed próbami.
- **Podpis zdalny z P6** — na próbach klient jest przy montażu, więc podpis na miejscu wystarcza.
  Zdalny wymaga opinii prawnika, która i tak nie przyjdzie wcześniej.
- **Większość P9** — kartoteki i raporty CRM nie blokują obsługi pięciu montaży.
- **`NTF-PUSH-TOKEN`, `NTF-HISTORY`** — miłe, nie krytyczne.
- **Synchronizacja z Google Calendar** z roadmapy — sprzeczna z decyzją z 2026-09-14 (źródłem prawdy
  jest baza). Do wykreślenia z roadmapy, nie do zbudowania.

Po tych cięciach minimum na 30.11 spada do **ok. 75–110 MD**.

## 5. Zastrzeżenie o szacunkach, którego nie da się obejść

Roadmapa GTM wycenia **cały pozostały ekosystem na 163 godziny** i uznaje to za osiągalne do 30.11.
Ten dokument mówi o **178–261 dniach pracy**. To nie jest różnica w ocenie tempa, tylko w jednostkach
i w zakresie: roadmapa liczy godziny Michała pracującego z agentami i zakłada węższy zakres (Field App
jako PWA, bez wyceny kosztorysowej, bez znacznika czasu, bez reguły VAT).

Nie twierdzę, że roadmapa jest zła, ani że moje liczby są prawdziwe. Twierdzę, że **dopóki nie zrobimy
kalibracji, żaden termin w żadnym z tych dokumentów nie jest wiążący.**

Proponowana kalibracja, do wykonania raz, przed pierwszym Work Orderem: wziąć trzy zamknięte zadania
(`CAL-SLOT-ENGINE`, `FNL-2PHASE-BOOKING-MECHANICS`, przeglądarka dokumentacji), sprawdzić, ile godzin
zajęły naprawdę, i zestawić z tym, ile MD dałby dla nich ten sam sposób szacowania. Dopiero wtedy
przeliczamy 178–261 MD na godziny i mówimy o datach.

## 6. Ryzyka programu (poza ryzykami Field App)

| # | Ryzyko | Skutek | Co proponuję |
|---|---|---|---|
| PR1 | Zakres rośnie szybciej, niż spada | 21.09: 70–110 MD → 23.09: 178–261 MD (cały system) | zamrożenie zakresu po rejestracji wymagań; każda nowa rzecz wypiera inną |
| PR2 | Brak wysyłki powiadomień (P1) blokuje sześć innych strumieni | wszystko czeka | P1 jako pierwsze zadanie, przed Field App |
| PR3 | RODO wchodzi po pierwszych klientach | wniosek o usunięcie danych staje się problemem prawnym | `SEC-RODO-DELETE` i anonimizacja przed 1.12 |
| PR4 | Rejestracja spółki opóźnia PayU, inFakt i EuroCert | trzy strumienie czekają na jedną sprawę formalną | sprawdzić, co da się zawrzeć przed KRS; EuroCert pilnie |
| PR5 | Jedna osoba na dziesięć strumieni | każde przełączenie kontekstu kosztuje | praca po jednym strumieniu, nie równolegle |
| PR6 | Dokumenty biznesowe opisują stan inny niż kod | wspólnik i inwestor planują na nieprawdziwych danych | po rejestracji wymagań: przegląd prezentacji przez `doc-scribe` |

## 7. Co robimy najpierw

1. **Kalibracja szacunków** (rozdział 5) — pół dnia, zdejmuje spór o terminy.
2. **Okno kontraktowe i rejestracja wymagań** — 31 nowych wpisów, zmiany statusów, aneks ADR-013,
   zmiany w `FLD-PHOTO-SET`, `FNL-2PHASE-INVOICE`, `N8a`, macierzy uprawnień (`leads:create` dla
   audytora) i progach (granica 300 m² dla VAT).
3. **P1: wysyłka powiadomień** — pierwszy realny kod, odblokowuje resztę.
4. **P2 w części RODO** — zanim pojawią się prawdziwe dane klientów.
5. **P5 etap 1** (fundament aplikacji i warstwa API) równolegle z P4 (cennik), bo to różne warstwy.

## 8. Dokumenty powstałe razem z tym planem

| Dokument | Zawartość |
|---|---|
| [FIELD-APP-I-PODPISY-ZAKRES.md](FIELD-APP-I-PODPISY-ZAKRES.md) | zakres Field App i podpisu, decyzje D1–D16 |
| [CENNIK-ROBOCIZNY.md](../architecture/CENNIK-ROBOCIZNY.md) + [`cennik-robocizny.csv`](../architecture/cennik-robocizny.csv) | 39 pozycji cennika, braki, wyliczenie montażu standardowego |
| [ADR-013](../architecture/ADR-013-warstwa-zapisu-field-app.md) | szkic aneksu do ADR-001: jak aplikacja terenowa zapisuje dane |
| [`docs/legal/`](../legal/) | 7 wzorów dokumentów prawnych (treść zastępcza) + zasady wersjonowania |
| [`trello-backlog.csv`](trello-backlog.csv) | backlog do importu na tablicę Trello |

**Czego jeszcze nie ma i powstanie dopiero po rejestracji wymagań:** Work Ordery. Piszemy je po jednym
na artefakt i rolę, w kolejności strumieni, a nie wszystkie naraz — Work Order napisany trzy miesiące
przed realizacją i tak trzeba przepisać.
