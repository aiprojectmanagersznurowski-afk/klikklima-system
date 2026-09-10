# Field App — plan developmentu i wdrożenia

## Status dokumentu

Dokument **opisowy** (plan pracy), nie kontrakt. Powstał 2026-09-08 po spotkaniu wymagań
(transkrypcja) i przeglądzie arkusza „Formularz wyceny". Nie generuje kodu, nie jest czytany
przez `kk-codegen`.

Uzupełnia i **miejscami koryguje** `docs/architecture/field_app_requirements.md` (2026-08-20).
Tam, gdzie transkrypcja przeczy tamtemu dokumentowi albo kontraktowi, rozbieżność jest
odnotowana w rozdziale 2 jako konflikt wymagający decyzji — nie rozstrzygam jej sam.

Źródła:
- transkrypcja spotkania (Google Docs, 2026-09-07/08) — wymagania funkcjonalne obu ról,
- arkusz „Formularz wyceny" (Google Sheets) — 35 pozycji cennika, flagi `FZ`, podział `Mat`/`Rob`/`MR`,
- `docs/architecture/field_app_requirements.md` — decyzje D1–D4 z 2026-08-20,
- stan faktyczny repo na commit `116518e`.

---

## 1. Co transkrypcja dodaje ponad dotychczasowy dokument

`field_app_requirements.md` opisywał Field App z perspektywy specyfikacji biznesowej (PDF)
i decyzji D1–D4. Transkrypcja wnosi **19 wymagań, których tam nie ma**. Poniżej tylko nowe rzeczy
— reszta (geofencing, certyfikaty, zgody RODO, dostępność) pozostaje jak opisano tamże.

### 1.1 Rola audytor

| # | Wymaganie | Uwaga |
|---|---|---|
| N1 | **Skrócona ścieżka tworzenia leada** przez audytora („stary klient dzwoni, nie zna strony") | → konflikt **K1** |
| N2 | **Zgłoszenie usterki za klienta** | nowa zdolność, brak w RBAC dla roli audytor |
| N3 | **Notatki tekstowe** w tym samym oknie co formularz i zdjęcia | pisane, **nie** nagrywane — decyzja świadoma, uzasadniona sprzedażowo |
| N4 | **Adnotacje rysowane na zdjęciach**: strzałki palcem/rysikiem + **pola tekstowe** („kwadracik, w którym piszesz") | wymóg twardy: „jak mam palcem pisać, to nie ma sensu" |
| N5 | **Katalog urządzeń w aplikacji** — pokazywany klientowi na tablecie | papierowy katalog odrzucony |
| N6 | **Oferta 1–3 wariantów**, elastycznie | → konflikt **K2** |
| N7 | **Wybór wariantu przez klienta z maila** generuje umowę | brak takiego kroku w maszynie stanów |
| N8 | **Podpis umowy dwiema ścieżkami**: rysikiem na tablecie u audytora ALBO zdalnie z maila | |
| N9 | **Faktura zaliczkowa liczona z pozycji `FZ` + urządzenia**, nie ze stałego procentu | → konflikt **K3**, szczegóły w 4.3 |
| N10 | **BLIK (must-have) + raty 0%** online zamiast obsługi telefonicznej | → decyzja **D-PAY** |

### 1.2 Rola monter

| # | Wymaganie | Uwaga |
|---|---|---|
| N11 | **Tylko reprezentant ekipy** ma aplikację | świadome uproszczenie, upraszcza model kont |
| N12 | **Przycisk „start pracy"** rozpoczynający zbieranie koordynatów | → konflikt **K4** (RODO) |
| N13 | **Komunikacja ekipa ↔ audytor**: pytania do projektu | brak w katalogu powiadomień |
| N14 | **Uwagi w trzech kategoriach**: do projektu, do instalacji, do klienta | |
| N15 | **Checklista przedmontażowa** generowana automatycznie do każdej instalacji (narzędzia, pokrowce na buty, koszulki) | uzasadnienie: percepcja jakości, „nikt nas nie podrobi" |
| N16 | **Protokół zdawczo-odbiorczy podpisywany przez klienta** — na tablecie montera lub z maila | |
| N17 | **Karta gwarancyjna fizyczna**, do systemu tylko numer seryjny / model / adres | → konflikt **K5** |

### 1.3 Rozliczenia i administracja

| # | Wymaganie | Uwaga |
|---|---|---|
| N18 | **Rozliczenia per ekipa per miesiąc** + zestawienie z fakturami, pobieranymi **z KSeF** | nowa domena, duży zakres |
| N19 | **Czytelne ID projektu** (dziś UUID), podawane przez ekipę w pozycji faktury; ID leada = ID projektu 1:1 | → konflikt **K8** |

---

## 2. Konflikty do rozstrzygnięcia

To jest najważniejszy rozdział tego dokumentu. **Żadnego z tych punktów nie rozstrzygam sam** —
każdy wymaga decyzji człowieka, a część z nich zmienia kontrakt, więc wymaga okna kontraktowego
i roli `contract-steward`.

### K1 — Drugie wejście do maszyny stanów lejka `[BLOKUJE FAZĘ 3]`

**Sprzeczność wprost.** `contracts/requirements.contract.mjs:533`, `B2C-LEAD-ENTRY`:

> „Ukończony Triage tworzy leada w stanie `NEW_LEAD` — **to jedyne legalne wejście do maszyny
> stanów lejka**."

Transkrypcja (N1) wymaga, żeby audytor mógł utworzyć leada z Field App, pomijając Triage.

To nie jest niedopatrzenie w kontrakcie — to była świadoma reguła chroniąca przed tym, co już raz
się zdarzyło (dwie równoległe ścieżki zapisu w B2C, `saveLead.ts` i `leads.ts`, zapisujące leada
w niezgodnych kształtach).

**Do rozstrzygnięcia:** czy dopisujemy drugie legalne wejście (nowe wymaganie
`FLD-LEAD-QUICK-ENTRY`, ten sam stan startowy `NEW_LEAD`, ta sama atomowość klient+adres+lead,
ten sam zakaz pól spoza maszyny stanów), czy audytor tworzy leada przez panel B2B (dziś istnieje).

**Rekomendacja:** dopisać drugie wejście, ale **wymusić kontraktowo, że obie ścieżki wołają
tę samą funkcję domenową** — inaczej odtworzymy dokładnie ten problem, przed którym reguła chroniła.

### K2 — Oferta: liczba wariantów i moment wyboru `[BLOKUJE FAZĘ 5]`

Trzy źródła mówią trzy różne rzeczy:

| Źródło | Co mówi |
|---|---|
| `contracts/notifications.contract.mjs`, `N4` | `vars: ['first_name','link','total_price']` — **jedna** cena |
| `field_app_requirements.md` §5.1 | oferta w **trzech** wariantach (budżetowy/konserwatywny/premium) |
| Transkrypcja (N6, N7) | **1, 2 albo 3** warianty wg decyzji audytora; jeśli klient niezdecydowany — dostaje kilka i **wybiera w mailu**, i dopiero ten wybór generuje umowę |

Maszyna stanów nie zna kroku „klient wybiera wariant". Dziś `T02 sendQuote` przenosi leada do
`AUDIT_COMPLETED`, a `T03 acceptQuoteAndBook` (aktor `CLIENT`) od razu rezerwuje termin.
Wybór wariantu musi się zmieścić albo w `T03` jako część akceptacji, albo jako nowy stan pośredni.

**Rekomendacja:** wariant wybierany jako część `T03` (bez nowego stanu) — akceptacja oferty
i wybór wariantu to z perspektywy klienta jedno kliknięcie. Wymaga rozszerzenia `N4` o listę
wariantów i dodania tabel `quotes` + `quote_variants`.

### K3 — Faktura zaliczkowa: wersja v3 czy rdzeń v1/v2? `[ZMIENIA CAŁE WERSJONOWANIE]`

`field_app_requirements.md` §13 (decyzja D2) umieszcza **wszystkie płatności i faktury w v3**,
a v1 opisuje jako „explicite bez żadnej formy płatności".

Transkrypcja czyni fakturę zaliczkową **integralną częścią przepływu audytu**: podpisanie umowy
u klienta generuje fakturę zaliczkową, klient dostaje ją z linkiem do płatności jeszcze tego dnia.
Bez tego przepływ sprzedażowy opisany w transkrypcji nie działa wcale.

**Do rozstrzygnięcia:** czy przesuwamy fakturę zaliczkową do wcześniejszej wersji (i co wtedy
wypada z v1), czy v1 Field App świadomie nie obsługuje sprzedaży i służy tylko montażowi.

**Rekomendacja:** przedefiniować wersjonowanie wokół **dwóch niezależnych ścieżek** zamiast
trzech wersji: ścieżka montera (geofencing, zdjęcia, protokół) i ścieżka audytora (wycena, oferta,
umowa, zaliczka). Są rozłączne funkcjonalnie i mogą powstawać równolegle. Szczegóły w rozdziale 7.

### K4 — GPS: okno zlecenia czy sesja pracy? `[RYZYKO PRAWNE]`

| Źródło | Model |
|---|---|
| D4 / `FLD-GPS-RODO` | GPS **wyłącznie w oknie aktywnego, przypisanego zlecenia**, zapisywany jako zdarzenia punktowe, nigdy ślad trasy |
| Transkrypcja (N12) | „jak zaczynają pracę, dają start — **bo wtedy możemy pobierać jego koordynaty**" |

„Start pracy" to sesja obejmująca dojazdy, przerwy i czas między zleceniami — istotnie szersza niż
okno zlecenia. To jest różnica prawna, nie techniczna: śledzenie pracownika poza konkretnym
zadaniem wymaga innej podstawy przetwarzania i innej informacji dla pracownika.

**Do rozstrzygnięcia z prawnikiem, nie samodzielnie.**

**Rekomendacja:** utrzymać model zdarzeniowy z D4 (start pracy = zdarzenie punktowe otwierające
sesję; kolejne punkty tylko przy przecięciu geofence'ów i przy zamknięciu zlecenia). Daje to
funkcję opisaną w transkrypcji (wiadomo, że ekipa ruszyła i kiedy dotarła) bez ciągłego śladu.

### K5 — Karta gwarancyjna: cyfrowa czy fizyczna?

`contracts/notifications.contract.mjs`, `N8` (`funnel.install_completed`) ma dziś załącznik
`warranty_card`. Transkrypcja (N17): karta jest **fizyczna**, przychodzi z urządzeniem, wydawana
klientowi do ręki, podbita pieczątką; do systemu trafiają tylko numer seryjny, model i adres.

**Rekomendacja:** usunąć `warranty_card` z załączników `N8`, dodać do protokołu pola na numer
seryjny i model. Zmiana kontraktu powiadomień.

### K6 — Zestaw zdjęć montażowych: stała liczba czy zmienna?

`FLD-PHOTO-SET` i `field_app_requirements.md` §8 mówią **dokładnie cztery** zdjęcia:
jednostka wewnętrzna, jednostka zewnętrzna, **budynek z oddali**, odpływ skroplin.

Transkrypcja (N16 kontekst): „jednostka zewnętrzna, jednostki wewnętrzne (**liczba mnoga**),
ujście skroplin", bez budynku z oddali, i wprost „cztery czy tam ileś zdjęć".

Przy multi-splicie z czterema jednostkami wewnętrznymi stała liczba 4 nie ma sensu.

**Rekomendacja:** zestaw wymagany = 1 zdjęcie na **każdą** zamontowaną jednostkę wewnętrzną
+ 1 jednostka zewnętrzna + 1 odpływ skroplin + 1 budynek z oddali. Liczba wynika z wyceny,
nie jest stałą.

### K7 — Kalkulator: moc wyliczana czy wprowadzana?

`field_app_requirements.md` §11 opisuje kalkulator jako „wprowadzenie parametrów technicznych
→ **wyliczenie zapotrzebowania na moc chłodniczą** → dobór jednostek".

Transkrypcja (D1) opisuje realny proces: audytor **nie mierzy metrażu**, ocenia pomieszczenie
wzrokiem i od razu dobiera moc jednostki („patrzę sobie na pomieszczenie i interesuje mnie moc
jednostki wewnętrznej").

**Rekomendacja:** moc to pole wprowadzane przez audytora. Automatyczne wyliczenie może istnieć
jako **podpowiedź**, nigdy jako wartość wymuszona — inaczej narzędzie walczy z ekspertem
zamiast mu służyć.

### K8 — Czytelne ID projektu `[DOTYKA B2B, B2C I FAKTUR]`

Transkrypcja (N19): ekipa podaje numer projektu w pozycji faktury, więc ID musi być czytelne
i przepisywalne. Dziś `leady.id` to UUID (`gen_random_uuid()`).

Ustalenia z transkrypcji: **ID leada = ID projektu, relacja 1:1**; klient powracający generuje
nowego leada, a więc nowy projekt; ID leada ma być widoczne też w widoku instalacji.

**Do rozstrzygnięcia:** format (przykład z rozmowy sugerował coś w rodzaju `S26-...`).

**Rekomendacja:** **nie zmieniać klucza głównego** — dodać osobną kolumnę `numer_projektu`
(sekwencyjną, unikalną, czytelną) obok UUID. Zmiana PK na tym etapie dotknęłaby każdego klucza
obcego w systemie; korzyść zerowa, ryzyko duże.

### K9 — Montaż dwuetapowy bez faktury zaliczkowej

Transkrypcja (D4): przy montażu dwuetapowym (stan deweloperski: etap I bruzdowanie, etap II
podłączenie) **nie wystawia się faktury zaliczkowej** — „żeby tego nie mnożyć, nie troić".

To nowa reguła biznesowa, niesprzeczna z niczym w kontrakcie, ale nigdzie nieodnotowana.
`FNL-2PHASE` istnieje w rejestrze (HIGH, bez testu). Do dopisania jako warunek.

---

## 3. Konflikty architektoniczne

### A1 — Server Actions nie istnieją w React Native `[NAJWAŻNIEJSZA DECYZJA]`

ADR-001 rozstrzyga: **mutacje = Server Actions + Zod**, Route Handlery odrzucone
(wyjątek: publiczne webhooki). Cała autoryzacja B2B stoi na `can(actorRole, resource, capability)`
wywoływanym wewnątrz Server Action, bo **Prisma omija RLS**.

W React Native Server Actions nie istnieją. To nie jest szczegół implementacyjny — to znaczy,
że **żadna dzisiejsza ścieżka zapisu nie jest osiągalna z Field App**. Dokument
`field_app_requirements.md` odnotowuje to jako otwarte pytanie nr 1 i nie rozstrzyga.

Dwie drogi:

**(a) `supabase-js` bezpośrednio z urządzenia, pod RLS** — jak B2C.
Wymaga zbudowania kompletnych polityk RLS dla każdej tabeli, której dotyka Field App.
Konsekwencja: macierz uprawnień istnieje wtedy w **dwóch niezależnych implementacjach** —
w `contracts/rbac.contract.mjs` (TypeScript, dla B2B) i w politykach SQL (dla Field App) —
utrzymywanych ręcznie. To jest dokładnie ta klasa rozjazdu, którą cała dyscyplina kontraktowa
tego projektu ma eliminować. Dodatkowo: **w CI nie ma Postgresa**, więc tych polityk nie da się
dziś przetestować (blokada odnotowana przy `FLD-CONSENT-TRIGGERS-INTEGRATION` jako „wąskie gardło
całego projektu").

**(b) Warstwa API (Route Handlers) współdzieląca `can()` i Prismę.**
Łamie literę ADR-001, ale zachowuje jego cel: jedno źródło prawdy o uprawnieniach. Field App woła
endpointy, endpointy wołają dokładnie te same funkcje domenowe co Server Actions panelu B2B.

**Rekomendacja: (b), z formalnym aneksem ADR-013 do ADR-001.** Uzasadnienie: koszt (a) to nie
„napisanie polityk", tylko trwałe utrzymywanie dwóch synchronizowanych ręcznie systemów uprawnień,
z których jednego nie można dziś przetestować.

### A2 — Praca offline

`field_app_requirements.md` odnotowuje, że poprzedni stub opisywał „PWA i offline-first" i uznaje
to za nieaktualne **po decyzji o React Native** — ale D1 dotyczyła platformy, nie trybu pracy.
Offline zostało przy tej okazji porzucone bez osobnej decyzji.

Transkrypcja opisuje pracę, która offline'u wymaga: audytor w mieszkaniu robi zdjęcia, rysuje po
nich, wypełnia wielopozycyjny formularz i pisze notatki. Utrata zasięgu w połowie wizyty oznacza
utratę całej pracy i kompromitację przed klientem.

**Rekomendacja:** moduł audytu **offline-first** (lokalna baza + kolejka synchronizacji,
rozstrzyganie konfliktów po stronie serwera). Reszta aplikacji online-only. To istotnie zwiększa
złożoność fazy 3 i musi być zaplanowane od początku — dopisanie offline'u później do gotowego
modułu to przepisanie go.

### A3 — Nieaktualne założenie „Field App poza zakresem repo"

`apps/b2b-web/src/utils/supabase/middleware.ts:76-79` niesie komentarz *„Field App poza zakresem
repo (R1)"*, podczas gdy D1 i mapa faz planują `apps/field-app` w tym monorepo. Do usunięcia przy
tworzeniu aplikacji, żeby nie mylił kolejnych czytelników.

### A4 — Brak Postgresa w CI

Odnotowane w rejestrze jako blokada `FLD-CONSENT-TRIGGERS-INTEGRATION` i nazwane wprost „wąskim
gardłem całego projektu". Field App zwielokrotnia ten problem: triggery zgód, polityki RLS (jeśli
wariant (a)), atomowość rezerwacji slotów. **Do zamknięcia przed fazą 1**, niezależnie od Field App.

### A5 — Płatności: BLIK + raty 0% `[DECYZJA D-PAY]`

Panel B2B ma dziś w ustawieniach martwą zakładkę „Integracje (Stripe)". Transkrypcja wymaga BLIK-a
jako must-have i rat 0% przez program afiliacyjny (świadomie zamiast własnej integracji
z bankiem, która wymagałaby wpisu na listę KNF).

**Do rozstrzygnięcia biznesowo:** operator płatności (BLIK + raty w jednym: PayU, Przelewy24;
albo Stripe + osobny partner ratalny).

### A6 — KSeF

Transkrypcja porzuca pomysł skrzynki mailowej na faktury od ekip na rzecz pobierania z KSeF.
To osobna, duża integracja z API Ministerstwa Finansów (uwierzytelnianie tokenem, środowisko
testowe, obsługa struktur FA(2)). **Osobny epik, nie część Field App** — Field App tylko dostarcza
dane o wykonanych instalacjach, z którymi faktury są zestawiane.

---

## 4. Model danych — czego brakuje

Stan faktyczny: **wycena, oferta, umowa, faktura i cennik kosztorysowy to w 100% greenfield.**
Nie istnieje ani jedna tabela, na której kalkulator mógłby stanąć.

### 4.1 Byty, do których kontrakt się już odwołuje, a których nie ma

To jest dług zastany, nie skutek nowych wymagań:

| Byt | Kto się odwołuje | Stan |
|---|---|---|
| `quotes` | `rbac.contract.mjs:31` (pełna macierz), enumy `QuoteStatus`/`PaymentStatus`, `T02` (`STABLE`) | **nie istnieje**; wycena to dwa pola tekstowe na `leady` |
| `bookings` | `T03` (`STABLE`), guard `slotAvailable`, `FNL-E3-E4` | **nie istnieje** |
| `absences`, `regions`, `documents`, `invoices`, `contact_log`, `notes`, `vehicles`, `device_tokens` | ADR-012 | **niezmigrowane** |

Przejścia `T02` i `T03` mają w kontrakcie status `STABLE`, mimo że opierają się na nieistniejących
tabelach. To osobne znalezisko, warte zgłoszenia niezależnie od Field App.

### 4.2 Nowe tabele wymuszone przez transkrypcję

- `price_list_items` — cennik kosztorysowy: pozycja, opis, JM, **koszt zakupu netto**,
  **cena sprzedaży netto**, VAT, kategoria (`MATERIAL`/`LABOR`/`MATERIAL_LABOR`),
  **flaga `advance_invoice`** (odpowiednik `FZ` z arkusza), wersjonowanie cen w czasie.
- `quotes`, `quote_variants` (1–3 warianty), `quote_rooms` (pomieszczenie: nazwa + moc jednostki),
  `quote_items` (pozycja cennika × ilość, per pomieszczenie).
- `audit_notes`, `audit_photos`, `photo_annotations` (strzałki i pola tekstowe jako dane, nie jako
  wypalony obraz — inaczej nie da się ich później edytować).
- `contracts` + `signatures` (podpis rysikiem lub zdalny).
- `invoices` (zaliczkowa i końcowa) — ADR-012 przewiduje, brak migracji.
- `installation_checklists` — checklista przedmontażowa.
- `crew_questions` — pytania ekipy do projektu i odpowiedzi audytora.
- `crew_settlements` — rozliczenia per ekipa per miesiąc.
- `weekly_availability_rules` — **D3 wymaga godzin per dzień tygodnia**, a istniejące
  `availability_declarations` to jednowierszowy boolean „dostępny/niedostępny". To jest realna
  luka: `FLD-AVAIL-RESTORE` („powrót przywraca zapamiętaną dostępność") nie ma dziś czego pamiętać.

### 4.3 Cennik — co arkusz mówi, a czego schemat nie umie

`cennik_uslug` ma dziś **wyłącznie**: `nazwa_uslugi`, `jm`, `koszt_b2c_netto`, `koszt_b2b_netto`.
Czyta ją tylko B2C, zawsze jednym zapytaniem po `'Montaż wzorcowy'`, z hardkodowanym fallbackiem
1200 zł. `koszt_b2b_netto` nie ma ani jednego konsumenta.

Arkusz wymaga czterech rzeczy, których ta tabela nie ma:

1. **Koszt zakupu ≠ cena sprzedaży.** Dziś obie kolumny to ceny dla dwóch segmentów, nie
   koszt własny i cena. Faktura zaliczkowa liczona wg N9 wymaga znajomości **kosztu**.
2. **Kategoria** `Mat` / `Rob` / `MR` — decyduje, co trafia na fakturę zaliczkową.
   Uwaga: w arkuszu ta sama kategoria występuje raz jako `MR`, raz jako `RM` — **do ujednolicenia**.
3. **Flaga `FZ`** — 9 z 35 pozycji wchodzi do faktury zaliczkowej.
4. **Opis pełny** — arkusz ma osobną kolumnę z opisem dla klienta (np. czym dokładnie jest
   „przejście dachowe"), dziś nie ma gdzie go trzymać.

**Reguła kwoty zaliczki** (z transkrypcji, do zapisania w kontrakcie zamiast w kodzie):

> Kwota zaliczki = suma pozycji z flagą `FZ` + cena urządzeń.
> Robocizna trafia na fakturę końcową po montażu.

Odrzucono stały procent (30%): przy montażu materiałochłonnym to za mało, przy robociznochłonnym
oznaczałoby wypłacenie sobie ~80% zysku z góry. Cel: zysk rozłożony mniej więcej po połowie.

**Pozycje do usunięcia z automatycznego kalkulatora** (ustalenie z transkrypcji): „zwyżka"
i pozycje zależne od wysokości jednostki zewnętrznej — montaż na stelażu wycenia się indywidualnie
(„nie wiesz, jakich długości materiału potrzebujesz"), nie nadaje się do formularza.

---

## 5. Stos technologiczny i komponenty z rynku

### 5.1 Rdzeń

| Warstwa | Wybór | Uzasadnienie |
|---|---|---|
| Platforma | **Expo + React Native + TypeScript**, jako `apps/field-app` | decyzja D1, bez zmian |
| Nawigacja | Expo Router | |
| Buildy i dystrybucja | **EAS Build / Submit / Update** | EAS Update pozwala wypchnąć poprawkę JS bez review sklepu — przy aplikacji dla kilku osób w terenie to różnica między naprawą w godzinę a w trzy dni |
| Style | **NativeWind** | zespół pisze Tailwind w obu aplikacjach webowych; ten sam model myślenia, zerowa nauka. Tamagui mocniejszy, ale to większe zobowiązanie i cięższy build |
| Stan serwera | TanStack Query | |
| Stan lokalny | Zustand | już używany w `apps/b2c-web` |
| Formularze | react-hook-form + Zod | jak w panelu B2B; schematy Zod współdzielone z backendem zamiast pisane drugi raz |
| Uwierzytelnianie | Supabase Auth + `expo-auth-session` | wspólne konto z panelem, ścieżka przetarta |

**Do zweryfikowania przed fazą 2:** czy `packages/contracts` (czysty TypeScript) importuje się w RN bez
zmian. Od tego zależy, czy `can()`, katalog powiadomień i maszyna stanów są **współdzielone**, czy
duplikowane — a duplikacja kontraktu jest dokładnie tym, przed czym cała dyscyplina tego repo chroni.

`@repo/ui` **nie nadaje się do ponownego użycia** — jest oparte na `react-dom`. Komponenty Field App
powstają od zera.

### 5.2 Co bierzemy z rynku zamiast budować

| Obszar | Propozycja | Co oszczędza |
|---|---|---|
| Płatności | **PayU** | BLIK i raty 0% w jednej integracji. Stripe obsługuje BLIK, ale nie polskie raty — a raty są w wymaganiach wprost (N10) |
| Faktury + KSeF | **Fakturownia** albo **inFakt** (API) | nie dotykamy API Ministerstwa Finansów, struktur FA(2) ani uwierzytelniania tokenem — to sam w sobie byłby wielotygodniowy projekt |
| Podpis umowy | **budujemy sami** (Skia + własna strona podpisu) + **kwalifikowany TSA** | ROZSTRZYGNIĘTE 2026-09-09, opcja B — zero kosztu zewnętrznego, podpis na miejscu działa offline, jedna spójna ścieżka dowodowa; szczegóły i warunki w 5.4 |
| Push | **Expo Push** | zero plumbingu FCM/APNs na start |
| E-mail transakcyjny | **Mailtrap Email Sending** — konto i token gotowe (`EMAIL_PROVIDER_KEY`) | webhooki ze zdarzeniem `delivery` (dowód doręczenia linku do podpisu), własna domena, sandbox do testów E2E; zastrzeżenie o danych w USA — patrz 5.4 |
| SMS | **SMSAPI** — konto i token gotowe (`SMS_API_TOKEN`) | polski dostawca, callbacki DLR z ponawianiem; szczegóły i blokada operacyjna w 5.7 |
| Rysowanie i podpis | **React Native Skia** | jeden silnik obsługuje adnotacje na zdjęciach (N4) i podpis rysikiem (N8, N16) |
| Aparat | `expo-camera` + `expo-image-manipulator` | kompresja przed wysyłką jest obowiązkowa — pełna rozdzielczość zabija upload przez LTE |
| Geofencing | `expo-location` + `expo-task-manager` | natywne API geofencingu jest **zdarzeniowe** — dokładnie model wymagany przez D4/RODO |
| Błędy | **Sentry** | aplikacji w terenie nie zdebugujesz przez ramię użytkownika |
| Nawigacja do klienta | deep-link do Google/Apple Maps | zero kosztu, lepszy UX niż osadzony SDK map |
| PDF | `@react-pdf/renderer` **po stronie serwera** | dokumenty muszą być identyczne niezależnie od urządzenia i archiwizowalne; bez headless browsera w deploymencie |

### 5.3 Offline — świadomie bez gotowca

Istnieją silniki synchronizacji zrobione pod nasz przypadek (Postgres + Supabase): **PowerSync**,
**ElectricSQL**, **WatermelonDB**. Mimo to odradzam je na tym etapie.

Nasza potrzeba offline jest wąska: **audytor prowadzi jedną wizytę naraz**. Nie potrzebuje
przeglądać całego CRM-u bez zasięgu — potrzebuje, żeby *ta* wycena, *te* zdjęcia i *te* notatki
przetrwały zanik sieci i wysłały się po powrocie. To jest lokalny szkic plus kolejka wysyłkowa
(`expo-sqlite` + outbox), a nie dwukierunkowa replikacja bazy.

Koszt gotowca jest realny: reguły replikacji PowerSync stają się **drugą implementacją macierzy
uprawnień do odczytu** — czyli dokładnie tym problemem, przed którym uciekamy w rekomendacji A1.

**Rekomendacja:** outbox teraz, PowerSync dopiero gdyby zakres offline'u urósł.

### 5.4 Podpis elektroniczny — porównanie i decyzja

Sprawdzone 2026-09-09. Wymagania twarde, wobec których oceniam każdego dostawcę:

1. **API** — umowę generuje aplikacja, nie człowiek; bez API nie ma automatyzacji, dla której
   budujemy Field App.
2. **Embedded signing** — osadzenie ceremonii podpisu we własnej aplikacji, żeby audytor podał
   tablet i klient podpisał na miejscu (N8a).
3. **Ścieżka zdalna** mailem (N8b).
4. **eIDAS SES** — wystarczający poziom dla umowy o świadczenie usług.
5. **Polski w ceremonii podpisu** — umowy zawieramy z konsumentami.
6. **Dane w UE** — RODO, dane osobowe konsumentów.

| Dostawca | API | Embedded | Dane w UE | Polski | Koszt przy ~50 umowach/mies. |
|---|---|---|---|---|---|
| **DocuSeal Pro on-premises** | tak | tak | **tak — u nas** | **tak** (formularz podpisu) | **$20/mies. za 1 licencję + $0,20/dokument** |
| DocuSeal OSS self-hosted (Community) | **nie — zablokowane** | **nie — Pro** | tak | tak | 0 |
| podpiszmy.pl | **nie** | **nie** | tak | tak | 49 zł stałe |
| SignWell | tak | tak | **nie — USA** | niepotwierdzony | ~$36 + pay-as-you-go powyżej 25 dok. |
| Documenso Teams | tak | tak | niepotwierdzone | niepotwierdzony | $40/mies. |
| Documenso self-hosted | tak | niepotwierdzone | tak | niepotwierdzony | 0 |
| Yousign | tak | tak (iframe) | tak | tak | **od ~$122/mies.** za plan API |
| Signature Pad | — | to biblioteka, nie usługa | tak | tak | 0 + budowa całej reszty |

### ROZSTRZYGNIĘTE 2026-09-09: budujemy podpis w całości sami (opcja B)

**Decyzja człowieka.** Rekomendowałem wariant hybrydowy (podpis na miejscu własny, zdalny kupiony
w DocuSeal). Michał wybrał **pełną budowę własną, zerowy koszt zewnętrzny za podpis**.
Decyzja jest wiążąca; poniżej jej konsekwencje i warunki, w których jest solidna.

#### Dlaczego ta decyzja się broni

Rachunek nakładów wyglądał następująco (szacunki, nie wyceny):

| Opcja | Nakład | Koszt bieżący przy 50 projektach |
|---|---|---|
| A — DocuSeal Pro + TSA | 12–16 MD | ~160 zł/mies. |
| C — hybryda (na miejscu własny, zdalny kupiony) | 13,5–17 MD | kilkadziesiąt zł/mies. |
| **B — wszystko własne** | **19–26 MD** | **~15 zł/mies. (same znaczniki czasu)** |

Różnica nakładu między B a A to około 8 MD, czyli 6–12 tys. zł. Przy 50 projektach zwrot
następuje po 4–6 latach, przy 200 projektach po 1,5–2,5 roku.

Argumenty za B, które w tym rachunku nie występują, a są realne:

- **Jedna spójna ścieżka dowodowa.** Wariant hybrydowy oznaczałby dwa różne mechanizmy podpisu,
  dwa formaty śladu audytowego i dwie prawne „paczki" dla umów tej samej firmy. W sporze to jest
  bałagan. B daje jedną, jednolitą historię dowodową dla każdej umowy.
- **Zero zależności od dostawcy.** Brak telemetrii, licencji, usługi do self-hostowania i łatania,
  brak pytania o AGPL, brak ryzyka zmiany cennika lub warunków.
- **Pełna kontrola nad językiem, wyglądem i przepływem** — istotne przy sprzedaży, gdzie ceremonia
  podpisu jest częścią doświadczenia klienta, a nie formalnością.
- **Podpis na miejscu działa offline** — argument, który przesądził o odrzuceniu wariantu A.

#### Warunki, w których opcja B jest solidna

W opcji B **nie ma żadnej trzeciej strony** w całym przepływie. To znaczy, że cała wiarygodność
dowodowa opiera się na rzeczach, które kontrolujemy — i dlatego cztery poniższe punkty przestają
być opcjonalne.

**1. Kwalifikowany znacznik czasu jest obowiązkowy, nie opcjonalny.**
To jedyny element niezależny od nas w całym rozwiązaniu. Bez niego druga strona może podnieść,
że każdy element dowodu — PDF, logi, ślad audytowy — powstał na naszym serwerze i mógł zostać
zmieniony. Z kwalifikowanym znacznikiem mamy domniemanie prawne co do czasu i nienaruszalności
dokumentu, wystawione przez podmiot z listy zaufania UE.
Koszt: kilkanaście groszy za dokument, ~15 zł miesięcznie. **To jest cena, przy której rezygnacja
byłaby oszczędnością pozorną** — odjęłaby jedyny niezależny dowód, jaki w tym wariancie mamy.
Dostawcy: Certum, KIR/Szafir, EuroCert, CenCert.

**2. Dowód doręczenia maila staje się naszym problemem — dostawca: Mailtrap (sprawdzony 2026-09-09).**
Przy ścieżce zdalnej musimy wykazać, że link do podpisu faktycznie dotarł. Wymaga to dostawcy
poczty transakcyjnej z webhookami zdarzeń zasilającymi ślad audytowy oraz poprawnie
skonfigurowanych SPF, DKIM i DMARC. Infrastruktury pocztowej potrzebujemy i tak dla
`notification_queue`, więc to nakład wspólny — ale zdarzenia doręczenia trzeba świadomie zapisywać
jako materiał dowodowy, nie tylko jako telemetrię.

**Mailtrap Email Sending spełnia wymagania funkcjonalne:**

- **Webhooki obejmują zdarzenie `delivery`** — obok `open`, `click`, `bounce`, `soft bounce`,
  `spam`, `unsubscribe`, `reject`, `suspension` i `sending`. Zdarzenie doręczenia jest dokładnie
  tym, czego potrzebujemy jako dowodu, i nie każdy dostawca je udostępnia.
- Własna domena z DKIM, SPF i DMARC — pełne wsparcie.
- API REST i SMTP.
- To **pełnoprawna usługa produkcyjna**, nie sama piaskownica, z którą Mailtrap jest kojarzony
  historycznie.
- **Bonus istotny dla dyscypliny testowej tego repozytorium:** Mailtrap ma też sandbox, więc pełny
  przepływ podpisu zdalnego da się testować end-to-end bez wysyłania prawdziwych maili do
  prawdziwych klientów. Przy ścieżce, w której mail niesie link do czynności prawnej, to realna
  wartość, nie wygoda.

**Zastrzeżenie prawne do świadomego przyjęcia: dane w USA.**
Mailtrap hostuje dane na AWS `us-east-1` i serwerach Google w USA. Podstawą transferu jest
**Data Privacy Framework** — operator (Railsware Products Studio LLC), Amazon i Google figurują
w rejestrze DPF, a Komisja Europejska uznała adekwatność w 2023. Dostawca ma też ISO 27001
i deklaruje zgodność z RODO. Formalnie transfer jest więc legalny.

Ryzyko, którego nie należy przemilczeć: **DPF jest trzecim z kolei mechanizmem transferu UE–USA,
a dwa poprzednie (Safe Harbor i Privacy Shield) zostały unieważnione przez TSUE.** Podstawa jest
ważna dziś, ale ma udokumentowaną historię upadania. Przy odrzucaniu SignWell rezydencja danych
w USA była argumentem dyskwalifikującym — dla spójności odnotowuję ten sam problem tutaj.

**Dlaczego mimo to jest to akceptowalne, inaczej niż przy SignWell.** SignWell przechowywałby
**same podpisane umowy** — pełną treść, długoterminowo. Mailtrap przenosi wyłącznie **wiadomość
i jej metadane**. Różnicę można dodatkowo pogłębić architektonicznie:

> **Zasada projektowa: mail nie zawiera treści umowy ani oferty, tylko link.**
> Do dostawcy poczty trafiają wtedy imię, adres e-mail i token — nie adres montażu, nie kwoty,
> nie PDF. PDF-y żyją w naszej infrastrukturze w UE i są pobierane po kliknięciu linku.
> To minimalizuje zakres danych osobowych opuszczających UE do niezbędnego minimum i jest zgodne
> z zasadą minimalizacji z RODO.

**Do dopytania u dostawcy:** Mailtrap zapowiadał uruchomienie przechowywania danych w UE
„w 2026 roku". Mamy wrzesień 2026 — warto zapytać wprost, czy region UE jest już dostępny.
Jeśli tak, powyższe zastrzeżenie znika w całości.

**Uwaga zakresowa: Mailtrap obsługuje wyłącznie e-mail.** Katalog powiadomień
(`contracts/notifications.contract.mjs`) przewiduje także kanał SMS (m.in. `N3`, `N7`, `I3`),
więc dostawcę SMS trzeba wybrać osobno. To nie jest wada Mailtrapa, tylko fakt do uwzględnienia
w planie fazy 2.

**3. Ślad audytowy musi być append-only i odporny na manipulację.**
Repozytorium ma już tę dyscyplinę: wymaganie `SEC-AUDIT-LOG-APPEND-ONLY` i tabelę `audit_log`
z wymuszoną niezmiennością. Ślad podpisu powinien pójść tym samym wzorcem, z rozważeniem
łańcucha skrótów między wpisami (każdy wpis zawiera skrót poprzedniego), co czyni wykrywalną
każdą późniejszą ingerencję w historię.

**4. Publiczna strona podpisu to powierzchnia ataku o wysokiej stawce.**
Link do podpisu jest dostępny bez logowania i prowadzi do czynności prawnej. Wymaga: tokenów
o wysokiej entropii, jednorazowości, wygasania, ograniczenia liczby prób, ochrony przed
enumeracją i osobnego przeglądu bezpieczeństwa przed wdrożeniem. To jedyny fragment Field App,
w którym błąd bezpieczeństwa ma bezpośrednie skutki prawne, a nie tylko operacyjne.

#### Zakres prac (19–26 MD)

| Zadanie | MD |
|---|---|
| Przechwycenie podpisu na Skia (gesty, undo, eksport) — współdzielone z adnotacjami | 1,5–2 |
| Generowanie PDF umowy i osadzenie podpisu — silnik wspólny z ofertą i protokołem | 2 |
| Publiczna strona podpisu zdalnego: tokeny, wygasanie, canvas, maile, przypomnienia | 5–7 |
| Ślad audytowy: model append-only, zdarzenia, karta podpisu jako załącznik do PDF | 2–3 |
| Kwalifikowany znacznik czasu (RFC 3161, osadzenie, weryfikacja) | 2–3 |
| Bezpieczeństwo: rate limiting, ochrona przed enumeracją, przegląd | 1,5–2 |
| Testy wg dyscypliny repo | 3–4 |
| Bufor | 1,5 |
| **Razem** | **19–26 MD** |

Praca wchodzi do **fazy 5** (oferta, umowa, podpis) i istotnie ją powiększa — to trzeba
uwzględnić w harmonogramie, bo wcześniejsze oszacowanie tej fazy zakładało kupionego dostawcę.

#### Co trzeba zrobić przed pisaniem kodu

1. **Zarejestrować wymagania w kontrakcie** (`contracts/requirements.contract.mjs`) — nowe wpisy
   `FLD-SIGN-*` na: przechwycenie podpisu, ścieżkę zdalną, ślad audytowy, znacznik czasu.
   Zgodnie z zasadą zerową repozytorium kod realizuje kontrakt, nie odwrotnie.
2. **Przedstawić prawnikowi całość rozwiązania**, nie tylko technikę podpisu: umowa
   z konsumentem, potwierdzenie na trwałym nośniku, pouczenie o odstąpieniu, treść karty podpisu,
   sposób przechowywania. W opcji B nie ma dostawcy, który wziąłby jakąkolwiek część tej
   odpowiedzialności — spoczywa w całości na nas.
3. **Wybrać dostawcę kwalifikowanego znacznika czasu** i sprawdzić jego API oraz format tokenu.

### 5.5 Trzy rzeczy wymagające świadomej decyzji

1. **tRPC.** ADR-001 go odrzucił — ale w kontekście panelu B2B, gdzie Server Actions dają
   typowanie end-to-end za darmo. W React Native tego argumentu nie ma, a warstwa API i tak
   powstaje. Trzeba świadomie rozstrzygnąć REST kontra tRPC, zamiast dziedziczyć odrzucenie
   wydane z innego powodu.
2. **Drugi test runner.** Całe repo stoi na Vitest i to on napędza bramki. Testy RN to w praktyce
   Jest + React Native Testing Library (wsparcie Vitest dla RN jest niedojrzałe), E2E mobilne to
   Maestro. To wprowadza drugi runner do repozytorium o jednorodnej dyscyplinie testowej —
   do zaakceptowania, ale świadomie.
3. **Background location a review App Store.** Apple ostro weryfikuje aplikacje proszące
   o lokalizację w tle. Potrzebne będzie jasne uzasadnienie i ekran wyjaśniający, a jeśli decyzja
   prawna (K4) pójdzie w stronę zbierania GPS przez całą sesję pracy, ryzyko odrzucenia rośnie.
   Kolejny argument za modelem zdarzeniowym.

### 5.6 Sprzęt

Wymóg rysika (N4, N8) oznacza w praktyce **iPada z Apple Pencil**. Na Androidzie obsługa rysika
jest niespójna — sensownie działa właściwie tylko S Pen w Samsungach. To decyzja zakupowa, która
wpływa na projekt ekranów podpisu i adnotacji, więc powinna zapaść przed fazą 3.

---


### 5.7 Warstwa powiadomień — dostawcy potwierdzeni, stan wdrożenia

**Stan na 2026-09-09:** oba konta istnieją, tokeny są wygenerowane i osadzone w środowisku
(`EMAIL_PROVIDER_KEY`, `SMS_API_TOKEN`). **W kodzie nie ma jeszcze żadnej integracji** — jedyna
wzmianka o SMSAPI w repozytorium to `docs/architecture/system_architecture.md:136`, gdzie figuruje
jako zakładany dostawca. Wybór jest więc zgodny z wcześniejszą architekturą, nie zmienia jej.

Skala kanału SMS jest istotna: w `contracts/notifications.contract.mjs` **15 z 27 powiadomień**
używa SMS-a (5 wyłącznie SMS, 10 SMS razem z e-mailem). To nie jest kanał poboczny.

#### 5.7.1 SMSAPI — walidacja

**Spełnia wymagania:**

- **REST API** z bibliotekami klienckimi i dokumentacją.
- **Callbacki z raportami doręczeń (DLR)** — po zmianie statusu u operatora SMSAPI woła nasz
  endpoint (adres z panelu albo parametr `notify_url` przy wysyłce). Obsługuje też SMS przychodzące
  i kliknięcia w skrócone linki.
- **Ponawianie callbacków** — żądania są powtarzane cyklicznie aż do odebrania albo archiwizacji
  wiadomości. To dobra własność dla naszego śladu zdarzeń, ale **wymusza idempotentność endpointu**
  (patrz 5.7.3).
- **Polski dostawca** (grupa LINK Mobility), ISO 27001, deklarowana pełna zgodność z RODO.
  W przeciwieństwie do Mailtrapa nie ma tu problemu transferu do USA. Sama lokalizacja serwerów
  nie jest podana wprost na stronie — **do potwierdzenia w umowie powierzenia**, ale ryzyko jest
  nieporównanie mniejsze niż przy dostawcy amerykańskim.

#### 5.7.2 Blokada operacyjna: pole nadawcy `[URUCHOMIĆ TERAZ]`

Żeby SMS-y wychodziły z nazwą firmy zamiast numeru, trzeba zarejestrować **pole nadawcy**:

- maksymalnie **11 znaków**, dozwolone `a-z A-Z 0-9 . & @ - + _ ! % # spacja *`
  (numer telefonu jest niedozwolony),
- **weryfikacja ręczna przez pracowników dostawcy**, wyłącznie w godzinach pracy
  (pon.–pt., 8:00–17:00),
- przy nazwie firmy, znaku towarowym lub marce może być wymagane **przedłożenie dokumentów
  i oświadczeń**.

To jest **proces z człowiekiem w pętli i realnym czasem oczekiwania**, a nie ustawienie w panelu.
Nie blokuje pisania kodu, ale zablokuje pierwszą wysyłkę produkcyjną, jeśli zostanie ruszony
dopiero wtedy, gdy kod będzie gotowy. **Rekomendacja: złożyć wniosek natychmiast**, niezależnie
od postępu prac — to koszt zerowy, a zdejmuje ryzyko z harmonogramu fazy 2.

Do decyzji przy wniosku: jaka dokładnie nazwa (11 znaków to mało — `KlikKlima` mieści się
w sam raz, ma 9).

#### 5.7.3 Spięcie z istniejącą infrastrukturą

Warstwa kolejkowa **już istnieje i jest przetestowana** — nie budujemy jej od zera:

- Tabela `notification_queue` (migracja `20260908065000`, uruchomiona na żywej bazie) z kolumnami
  `channel`, `template_key`, `recipient_type`, `recipient_address`, `payload`, `status`, `attempts`,
  `next_attempt_at`, `dead_lettered_at`.
- **`idempotency_key` z ograniczeniem UNIQUE** — to jest mechanizm chroniący przed drugim SMS-em
  do klienta przy powtórnym uruchomieniu joba (pułapka nr 3 z `CLAUDE.md`).
- Helper `enqueueNotification()` (`logistics/rollback-effects.ts`) tworzy **jeden wiersz na kanał**,
  z kluczem idempotencji rozszerzonym o nazwę kanału — czyli SMS i e-mail tego samego powiadomienia
  są niezależnymi wierszami i niezależnie się ponawiają.

**Do zbudowania pozostaje worker**: pobiera wiersze `PENDING`, rozdziela po `channel`
(`EMAIL` → Mailtrap, `SMS` → SMSAPI), wysyła, zapisuje status i obsługuje `next_attempt_at`
oraz `dead_lettered_at`. Do tego dwa endpointy callbacków (Mailtrap i SMSAPI) aktualizujące
ślad zdarzeń.

**Oba endpointy callbacków muszą być idempotentne** — SMSAPI ponawia cyklicznie aż do odebrania,
więc ten sam raport doręczenia przyjdzie wielokrotnie. To ta sama zasada, która obowiązuje już
przy webhookach kuriera.

#### 5.7.4 Luka, która staje się aktywna przy wdrożeniu workera

Audyt bezpieczeństwa odnotował wcześniej, że `notification_queue` zapisuje dziś w `payload`
i `recipient_address` **wyłącznie identyfikatory, nie dane osobowe** — luka RODO była więc
strukturalna, ale niezmaterializowana.

Worker to zmienia: żeby wysłać SMS-a albo e-mail, musi rozwiązać identyfikator na **numer telefonu
lub adres e-mail klienta**. Od tego momentu kolejka zacznie realnie przechowywać dane osobowe
i podlegać zasadom retencji oraz anonimizacji. **To trzeba rozstrzygnąć przy projektowaniu workera**,
a nie po fakcie: czy adres odbiorcy jest zapisywany w kolejce, czy rozwiązywany dopiero w momencie
wysyłki i nigdy nie utrwalany.

**Rekomendacja:** rozwiązywać adres w momencie wysyłki i **nie zapisywać go w kolejce**.
Kolejka trzyma wtedy tylko identyfikator odbiorcy, a dane osobowe żyją wyłącznie w tabelach
źródłowych, objętych już mechanizmem anonimizacji RODO (`CRM-CLIENT-ANONYMIZE-RODO`).
Inaczej anonimizacja klienta zostawiałaby jego numer telefonu w kolejce powiadomień.

---

## 6. Kalendarz i dostępność

Podsystem przekrojowy: dotyka Field App (ustawienia dostępności), B2C (wybór terminu przez
klienta), panelu B2B (przypisania) i maszyny stanów lejka (guard `slotAvailable`).
**Jest na ścieżce krytycznej lejka** — bez niego nie działa ani rezerwacja audytu, ani przejście
E3→E4.

### 6.1 Stan dzisiejszy — inny, niż zakładał plan

Sprawdzone 2026-09-09 w `apps/b2c-web/app/actions/calendar.ts`:

- **Jest jeden wspólny kalendarz Google firmy**, odpytywany kontem serwisowym (JWT,
  `GOOGLE_CALENDAR_ID`, domyślnie `primary`). Nie ma pojęcia audytora, ekipy ani puli.
- **Okna są zahardkodowane**: `["08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00", "13:00 - 15:00"]`.
  **Dwa ostatnie nachodzą na siebie** — rezerwacja obu okien podwójnie zajmuje godzinę 13–14.
  To wygląda na błąd, nie na zamiar.
- Horyzont 60 dni, weekendy wykluczone na sztywno.
- **Rezerwacja to pojedyncza kolumna `leady.data_rezerwacji`** — nie ma tabeli `bookings`
  (ADR-012 przewiduje, że ją zastąpi).
- `getFomoSlots()` **nie jest silnikiem dostępności** — to licznik niedoboru („zostało X miejsc
  w tym tygodniu") z limitem `weekly_audit_limit` z `system_config`.

**Znalezisko poboczne:** `getFomoSlots()` liczy zajęte terminy zapytaniem
`status = 'Umówiony Audyt'` — a taka wartość **nie występuje w maszynie stanów** (stany są
po angielsku, `SCREAMING_SNAKE_CASE`). Zapytanie prawdopodobnie nigdy niczego nie zlicza,
więc licznik zawsze pokazuje pełny limit. Do zweryfikowania na żywej bazie i zgłoszenia osobno.

**Wniosek:** to, co dziś działa, to jeden kalendarz firmowy z czterema stałymi oknami. Cała
funkcjonalność opisana w D3 i w Twoim wymaganiu — indywidualna dostępność, dwie pule, suma
terminów — jest **niezbudowana**.

### 6.2 Model docelowy — trzy warstwy

Dostępność nie jest jedną tabelą. To trzy niezależne warstwy, które składają się na wynik:

| Warstwa | Co opisuje | Kto ustawia | Stan dziś |
|---|---|---|---|
| **Reguły cykliczne** | „poniedziałki 8–16, wtorki 10–14, środy wolne" | pracownik w Field App | **nie istnieje** |
| **Wyjątki / nieobecności** | urlop, chorobowe, awaria auta | pracownik lub administrator | `absences` w ADR-012, niezmigrowane |
| **Rezerwacje** | konkretne zajęte terminy | klient / dyspozytor | `leady.data_rezerwacji`, bez tabeli |

```
dostępny termin = reguła dnia tygodnia
                − nieobecność
                − istniejąca rezerwacja
                − bufor dojazdu
                − dzienny limit wizyt
```

Istniejąca tabela `availability_declarations` to **jednowierszowy boolean „dostępny/niedostępny"**
— nie niesie godzin ani dni tygodnia. Wymaganie `FLD-AVAIL-RESTORE` („powrót przywraca zapamiętaną
dostępność") **nie ma dziś czego pamiętać**. Reguły cykliczne to nowa struktura, nie rozszerzenie
istniejącej.

### 6.3 Dwie rozłączne pule

- **Pula audytorów** — obsługuje wizyty audytowe (E1→E2).
- **Pula ekip montażowych** — obsługuje montaże, serwisy i usterki.

Klient widzi **sumę wolnych terminów całej puli**, nie kalendarz konkretnej osoby. Ten sam
mechanizm obsługuje cztery typy wizyt; różnicą jest pula i czas trwania.

### 6.4 Rozstrzygnięcia potrzebne przed implementacją

### ROZSTRZYGNIĘTE 2026-09-09 (decyzje Michała)

**Czas trwania — słownik koszyków, konfigurowalny w panelu B2B.** Koszyk to nie tylko wartość
domyślna, ale **słownik, z którego audytor wybiera** przy wycenie — nie wpisuje „6,5 godziny"
z palca. Ten sam słownik zasila Triage jako wstępne oszacowanie, zanim audytor cokolwiek oceni.

| Koszyk | Kiedy | Propozycja |
|---|---|---|
| Audyt | wizyta u klienta | 2 h |
| Serwis (przegląd) | okresowy | 1,5 h |
| Usterka | naprawa | 2 h |
| Montaż mały | 1 jednostka, single split | pół dnia |
| Montaż standardowy | 2–3 jednostki, multi-split | cały dzień |
| Montaż duży | 4+ jednostek lub kanałowa/kasetonowa | 2 dni |
| Etap I | stan deweloperski: bruzdowanie i rozłożenie instalacji | cały dzień |
| Etap II | podłączenie i uruchomienie | pół dnia |

**Bufor dojazdu: 1 h, konfigurowalny w panelu B2B.** Liczony **między wizytami tej samej osoby**,
nie globalnie. Przy montażach całodniowych działa na poziomie dnia, więc realnie chroni audyty
i serwisy — czyli tam, gdzie jest potrzebny.

**Przydzielanie: automatyczne przy rezerwacji, z nadpisaniem przez dyspozytora.** Wybór między
pulą bezosobową a przypisaniem rozstrzygnięty na korzyść przypisania — patrz R3 poniżej.

**Kod pocztowy bazowy edytowalny w dwóch miejscach:** przez samego pracownika w Field App
i przez administratora w panelu B2B.

### 6.4a Montaż dwuetapowy — korekta

W pierwszej wersji tego rozdziału pomyliłem **montaż duży** (2 dni pod rząd) z **dwuetapowym**.
To dwie różne rzeczy:

- **Montaż duży** — jedna wizyta trwająca dwa następujące po sobie dni. Silnik musi znaleźć dwa
  sąsiadujące wolne dni u tej samej ekipy, nie rozbijając ich na wtorek i piątek. To realna
  komplikacja wyszukiwania.
- **Montaż dwuetapowy** — **nie są to dni pod rząd.** Po etapie I klient dostaje maila
  z wykonaną usługą, fakturą proforma, linkiem do płatności, protokołem zdawczo-odbiorczym
  i **linkiem do rezerwacji etapu II**. Etap II wraca wtedy do lejka jako ścieżka standardowa,
  a przerwa między etapami może wynosić tygodnie (mieszkanie musi zostać wykończone).

**Kontrakt już to modeluje poprawnie.** `N8a` (`funnel.install_phase1_completed`, przejście `T17`)
ma w nocie wprost: „etap I zamknięty, załącznik z fakturą za etap I, **link do rezerwacji etapu II**".
To jeden z niewielu obszarów, w których kontrakt wyprzedza implementację, a nie odwrotnie.

**Czego `N8a` brakuje wobec opisu przepływu:**

| Element | Stan | Potrzebne |
|---|---|---|
| Protokół zdawczo-odbiorczy etapu I | brak w `attachments` | dodać `handover_protocol` |
| Kwota do zapłaty | brak w `vars` | dodać `amount` |
| Dwa różne linki (rezerwacja etapu II **oraz** płatność) | jeden `link` | rozdzielić na `booking_link` i `payment_link` |

**Pytanie księgowe, które tu wraca:** czy dokument etapu I to **faktura proforma** (nie jest
dokumentem księgowym, to wezwanie do zapłaty), czy faktura zaliczkowa. To ta sama otwarta kwestia,
co przy zaliczce w przepływie jednoetapowym — jedno rozstrzygnięcie księgowego obsłuży oba.

### 6.4b Kod pocztowy i model przydzielania — konflikt do rozstrzygnięcia

**Dobra wiadomość: pola już istnieją.** Wymaganie „kod pocztowy ekipy edytowalny z Field App
i panelu B2B" to **wystawienie istniejącego pola w dwóch interfejsach, nie zmiana schematu**:

- `audytorzy.kod_pocztowy_bazowy`
- `zespoly_monterskie.kod_pocztowy_bazowy` **oraz `promien_dzialania_km`**

**Zła wiadomość: schemat i kontrakt implementują dwa różne modele przydzielania.**

| Model | Gdzie | Jak działa |
|---|---|---|
| **Regionowy** | `CRM-REGION-AUTO` (kontrakt) | kod pocztowy adresu → region (`regions`, `region_postal_codes`, UNIQUE) → pracownik przypisany do regionu |
| **Promieniowy** | schemat (istnieje) | baza pracownika + `promien_dzialania_km` → obsługuje wszystko w promieniu |

To nie są warianty tej samej rzeczy — dają różne odpowiedzi i wymagają różnych danych. Regionowy
potrzebuje tabeli mapującej kody pocztowe (dla Polski to tysiące wierszy, które się zmieniają).
Promieniowy potrzebuje współrzędnych bazy pracownika i liczenia odległości.

**Rekomendacja: model promieniowy dla obu ról.** Powody: pola już są w schemacie dla audytorów
i ekip, a `regions` nie istnieje; mamy już `latitude`/`longitude` na adresach po `FLD-GEO-COORDS`;
nie trzeba utrzymywać słownika kodów pocztowych; a nakładające się promienie **naturalnie wspierają
cel sprawiedliwości** — kilka ekip pokrywa ten sam adres, więc jest z czego wybierać przy remisie.

Koszt: kryteria akceptacji `CRM-REGION-AUTO` trzeba przepisać z regionu na promień, plus jednorazowe
geokodowanie kodów pocztowych baz pracowników.

**Uwaga o gamifikacji.** Skoro pracownik sam edytuje swój kod pocztowy i promień w Field App, może
tym sterować, jakie zlecenia dostaje — na przykład zawężając promień do zamożniejszych dzielnic.
To nie jest powód, żeby odbierać mu edycję, ale **zmiana powinna trafiać do `audit_log`**
(mechanizm już istnieje i jest wymuszony jako append-only). Wtedy wzorzec jest widoczny, a nie
domniemany.

**R1 — czas trwania wizyty.** Termin nie jest punktem. Audyt to może godzina, montaż potrafi zająć
cały dzień lub dwa, serwis godzinę, usterka zależnie od zgłoszenia. Skąd system bierze długość?
Dla audytu i serwisu wystarczy stała per typ (do kontraktu, nie do kodu). **Dla montażu długość
wynika z wyceny** — liczby jednostek i tego, czy montaż jest dwuetapowy. To realna zależność
fazy kalendarza od fazy kalkulatora.

**R2 — bufor dojazdu.** Dwa audyty 40 km od siebie, jeden po drugim, są fizycznie niewykonalne.
Bez bufora kalendarz będzie obiecywał terminy, których nie da się zrealizować. Minimum: stały
bufor między wizytami. Docelowo: bufor zależny od regionu (`regions` z ADR-012,
`CRM-REGION-AUTO`). **Rekomendacja: zacząć od stałego bufora**, region dołożyć później — ale
zaplanować go w modelu od razu.

**R3 — rezerwacja bezosobowa czy z natychmiastowym przypisaniem?** `[KLUCZOWE]`

To determinuje sposób gwarantowania atomowości.

| Wariant | Jak działa | Konsekwencja |
|---|---|---|
| Bezosobowa | klient rezerwuje „wtorek 10:00" z puli, przypisanie osoby później | unikalność dotyczy **pojemności puli**, nie wiersza — trudne do wymuszenia indeksem |
| **Z przypisaniem** | system atomowo wybiera wolną osobę i tworzy rezerwację na nią | unikalność to `(pracownik, termin)` — **zwykły indeks unikalny** |

**Rekomendacja: wariant z przypisaniem, niewidocznym dla klienta.** Klient nadal widzi pulę,
ale rezerwacja od razu wiąże konkretną osobę. Powody: `FNL-E3-E4` wymaga wprost „unikalnego
indeksu częściowego w bazie, nie sprawdzenia w kodzie" — co działa naturalnie tylko przy
przypisaniu; nie powstają rezerwacje-sieroty bez wykonawcy; a dyspozytor zachowuje możliwość
zmiany przypisania (przejście `T01` istnieje i zostaje).

**R4 — model integracji z Google Calendar.** Dziś: jedno konto serwisowe, jeden kalendarz firmowy.
D3 wymaga kalendarza **każdego pracownika**, co oznacza inny model uwierzytelniania — OAuth per
pracownik zamiast konta serwisowego. Do rozstrzygnięcia (otwarte pytanie nr 3 z dokumentu
architektury): pełna synchronizacja dwukierunkowa czy tylko odczyt zajętości?

**Rekomendacja: odczyt zajętości plus jednokierunkowy zapis naszych wizyt.** Prywatna wizyta
u dentysty w kalendarzu montera odejmuje się od dostępności, a nasze zlecenia pojawiają się w jego
kalendarzu. Prawdziwa synchronizacja dwukierunkowa (edycja po stronie Google zmienia rezerwację
u nas) to nieproporcjonalnie trudny problem konfliktów.

**R5 — granulacja i horyzont.** Co ile minut generujemy terminy i jak daleko w przód klient może
rezerwować? Dziś: 2-godzinne okna, 60 dni. Do potwierdzenia jako świadoma decyzja, nie zastana.

**R6 — czas letni.** Reguły są w czasie lokalnym, zapis w UTC, a `QUEUE_POLICY.timezone` to
`Europe/Warsaw`. Dzień zmiany czasu ma 23 albo 25 godzin — reguła „8–16" tego dnia wymaga jawnej
decyzji. Klasyczne źródło błędów, tanie do obsłużenia z góry, drogie do naprawy po fakcie.

### 6.5 Konflikty z istniejącym kontraktem

1. **`FNL-E3-E4` przesądza implementację przed decyzją.** Kryterium „atomowość gwarantuje unikalny
   indeks częściowy w bazie" zakłada model z przypisaniem (R3). Jeśli wybierzemy pulę bezosobową,
   tego kryterium **nie da się spełnić w zapisanej formie** i trzeba je zmienić.
2. **`B2C-BOOKING-SLOT`** (HIGH, bez testu) wymaga atomowości rezerwacji audytu — dziś nie ma ani
   tabeli, ani ograniczenia, ani testu.
3. **Guard `slotAvailable`** na `T03` istnieje w kontrakcie i **nie ma nośnika** — nie ma czego
   sprawdzać.
4. **`availability_declarations` nie realizuje D3** — boolean zamiast reguł godzinowych.
5. **`CRM-REGION-AUTO`** odwołuje się do `availability_status` i `daily_audit_cap`, których nie ma
   w schemacie.
6. **Postgres w CI jest warunkiem koniecznym.** Kontrakt wymaga testu uruchamiającego dwa
   równoległe żądania na ten sam slot. Bez bazy w CI tego się nie da napisać — a to jest jedyny
   test, który cokolwiek dowodzi w tym obszarze.

### 6.6 Zakres · ~27–41 MD

| Składowa | MD |
|---|---|
| Model danych i migracje: reguły cykliczne, `absences`, `bookings`, indeksy, ograniczenie unikalności | 4–6 |
| Silnik wyliczania puli (reguły − nieobecności − rezerwacje − bufor − limit dzienny) | 5–7 |
| Atomowa rezerwacja z przypisaniem + testy współbieżności | 3–5 |
| Ustawienia dostępności w Field App (siatka tygodniowa, wyjątki) | 4–6 |
| Wybór terminu w B2C (zastąpienie dzisiejszych stałych okien) | 3–5 |
| Google Calendar: OAuth per pracownik, odczyt zajętości, zapis wizyt | 5–8 |
| Testy | 3–4 |

**Umiejscowienie w planie faz:** model danych i silnik należą do **fazy 1** (fundament), ustawienia
dostępności do **fazy 2/3** (Field App), wybór terminu przez klienta jest zmianą w **B2C**, a więc
poza Field App. To nie jest jedna faza — to podsystem przecinający kilka.

---

## 7. Plan faz

Odchodzę od wersjonowania v1/v2/v3 z D2 — transkrypcja przesunęła fakturę zaliczkową do rdzenia
przepływu audytu (K3), więc tamten podział przestał odpowiadać rzeczywistości. Zamiast tego:
**wspólny fundament, a na nim dwie rozłączne ścieżki funkcjonalne** — audytora i montera —
które mogą powstawać równolegle.

```
FUNDAMENT (blokuje wszystko)        Faza 0 → Faza 1 → Faza 2
                                                        │
                    ┌───────────────────────────────────┴───────────────┐
ŚCIEŻKA AUDYTORA    Faza 3 → Faza 4 → Faza 5 → Faza 6                   │
ŚCIEŻKA MONTERA     Faza 7 ──────────────────────────────────────────────┘
                                                        │
PÓŹNIEJ                                          Faza 8 → Faza 9
```

**O oszacowaniach.** Rzetelnie zdekomponowana jest wyłącznie część podpisowa fazy 5 (19–26 MD,
rozdział 5.4) — bo tam liczyliśmy warianty przed decyzją. Pozostałe widełki to szacunki rzędu
wielkości do zaplanowania kolejności, **nie wyceny**. Każda faza wymaga własnej dekompozycji
przy Work Orderze, zanim ktokolwiek na niej oprze termin.

---

### Faza 0 — Rozstrzygnięcia `[decyzje człowieka, zero kodu]`

**Rozstrzygnięte w tej sesji:**

| Decyzja | Wynik |
|---|---|
| Podpis elektroniczny | **opcja B — budujemy sami** + kwalifikowany znacznik czasu (5.4) |
| Dostawca e-mail | **Mailtrap**, konto i token gotowe |
| Dostawca SMS | **SMSAPI**, konto i token gotowe |
| Struktura zakresu (K3) | dwie ścieżki zamiast v1/v2/v3 — przyjęte przez ten plan |

**Nadal otwarte — blokują start:**

| Decyzja | Kto rozstrzyga | Blokuje |
|---|---|---|
| **A1** — warstwa mutacji: API czy RLS (rekomendacja: API + ADR-013) | Michał, architektonicznie | fazę 2 i wszystko dalej |
| **A2** — offline-first modułu audytu (rekomendacja: tak) | Michał | fazę 3 |
| **K1** — drugie wejście do maszyny stanów | Michał + `contract-steward` | fazę 3 |
| **K4** — model GPS: okno zlecenia vs sesja pracy | **prawnik** | fazę 7 |
| **D-PAY** — operator płatności (BLIK + raty) | biznes | fazę 6 |
| Faktura zaliczkowa: przed płatnością czy po | **księgowy** | fazę 6 |
| Umowa: termin płatności, prawo odstąpienia, trwały nośnik | **prawnik** | fazę 5 |

Pozostałe (K2, K5–K9) są mniejsze i mogą być rozstrzygane w oknach kontraktowych przy
odpowiednich fazach.

**Do uruchomienia natychmiast, niezależnie od wszystkiego** (5.7.2): wniosek o rejestrację
**pola nadawcy SMS** w SMSAPI. Weryfikacja jest ręczna, w godzinach pracy dostawcy, z możliwym
żądaniem dokumentów. Koszt zerowy, a nieuruchomiona w porę zablokuje pierwszą wysyłkę produkcyjną.

---

### Faza 1 — Fundament danych `[blokuje wszystko]` · ~10–15 MD

1. **Postgres w CI** (A4) — bez tego nie przetestujemy triggerów, RLS ani atomowości rezerwacji.
   To dług całego projektu, nie tylko Field App.
2. Migracje ADR-012 w zakresie potrzebnym Field App: `bookings`, `documents`, `invoices`,
   `device_tokens`, `absences`.
3. `weekly_availability_rules` — luka względem decyzji D3 (dzisiejsza tabela to jednowierszowy
   boolean, a D3 wymaga godzin per dzień tygodnia).
4. `FLD-GEO-COORDS` — kolumny `latitude`/`longitude` **już są**, ale `saveLead.ts` nadal gubi
   współrzędne. Bez tego geofencing nie ma z czego czytać.
5. Cennik kosztorysowy (4.3) + import 35 pozycji z arkusza, z ujednoliceniem `MR`/`RM`
   i pominięciem pozycji wycenianych indywidualnie.
6. `numer_projektu` (K8) — kolumna sekwencyjna obok UUID, bez ruszania klucza głównego.

---

### Faza 2 — Szkielet aplikacji i warstwa powiadomień · ~15–20 MD

**Aplikacja:** `apps/field-app` (Expo), uwierzytelnianie współdzielone z panelem, bramka
`is_active` powtarzająca wzorzec z `middleware.ts` (ograniczona do właściwej roli, fail-closed),
nawigacja, warstwa API z decyzji A1, CI/CD na obie platformy, TestFlight i Play Console.

**Warstwa powiadomień** (5.7) — potrzebna obu ścieżkom, więc należy do fundamentu:
worker konsumujący `notification_queue` z rozdziałem po kanale, integracja Mailtrap i SMSAPI,
dwa **idempotentne** endpointy callbacków, rozstrzygnięcie kwestii adresu odbiorcy (5.7.4).

Zamyka `FLD-AUTH-BLOCKED`. Odblokowuje pięć wymagań `FLD-*`, których blokada brzmi dziś wprost
„brak `apps/field-app`".

---

### ŚCIEŻKA AUDYTORA

#### Faza 3 — Moduł audytu `[offline-first]` · ~20–28 MD

Formularz pomieszczenie po pomieszczeniu, notatki tekstowe, zdjęcia, **adnotacje rysowane**
(strzałki i pola tekstowe, edytowalne, przechowywane jako dane), kolejka synchronizacji.

Najbardziej złożona pojedyncza faza — offline i edytor adnotacji to dwa niezależne, trudne
podproblemy. Silnik Skia powstaje tutaj i **jest potem współdzielony z podpisem w fazie 5**.

#### Faza 4 — Kalkulator i katalog · ~10–14 MD

Silnik wyceny na cenniku z fazy 1 (koszt zakupu kontra cena sprzedaży, flaga zaliczkowa,
kategorie), katalog urządzeń pokazywany klientowi na tablecie, rabaty, warianty 1–3 (K2).
Moc jednostki jako pole wprowadzane, nie wyliczane (K7).

#### Faza 5 — Oferta, umowa, podpis · ~30–40 MD `[powiększona przez decyzję o własnym podpisie]`

To jest faza, która najbardziej urosła względem pierwotnego planu — wcześniejsze oszacowanie
zakładało kupionego dostawcę podpisu.

| Składowa | MD |
|---|---|
| Generowanie PDF (oferta, umowa) i wysyłka | 5–7 |
| Wybór wariantu przez klienta z maila (N7) | 3–4 |
| **Podpis własny — pełen zakres z 5.4** | **19–26** |
| Rozszerzenie `N4` o warianty | 1–2 |

**Warunek wstępny:** zarejestrowanie wymagań `FLD-SIGN-*` w kontrakcie **przed pisaniem kodu**
(zasada zerowa) i przedstawienie prawnikowi całości rozwiązania, nie samej techniki podpisu.

#### Faza 6 — Zaliczka i płatności · ~12–18 MD

Reguła kwoty z 4.3 (suma pozycji `FZ` plus urządzenia, robocizna na fakturę końcową),
faktura zaliczkowa, link do płatności, BLIK, raty (D-PAY), faktura końcowa po montażu.
Reguła braku zaliczki przy montażu dwuetapowym (K9).

---

### ŚCIEŻKA MONTERA

#### Faza 7 — Moduł montera · ~20–28 MD `[równolegle, od końca fazy 2]`

Harmonogram, podgląd projektu audytora, checklista przedmontażowa (N15), start pracy
i geofencing (K4, `FLD-GEO-UNLOCK`, `FLD-GEO-EN-ROUTE`, `FLD-GPS-RODO`), zdjęcia montażowe (K6,
`FLD-PHOTO-SET`), protokół zdawczo-odbiorczy z podpisem klienta (N16), dane z karty
gwarancyjnej (K5).

**Nie dzieli z fazami 3–6 ani modelu danych, ani ekranów** — poza jednym wyjątkiem: protokół
podpisywany przez klienta korzysta z tego samego mechanizmu podpisu co faza 5. Jeśli obie ścieżki
mają iść naprawdę równolegle, komponent podpisu trzeba wyciągnąć wcześniej albo zaakceptować,
że faza 7 czeka na tę część fazy 5.

---

### PÓŹNIEJ

#### Faza 8 — Komunikacja i uwagi · ~8–12 MD

Pytania ekipy do projektu z odpowiedzią audytora (N13), uwagi w trzech kategoriach (N14).
Wymaga rozstrzygnięcia, czy to nowy typ powiadomienia w katalogu, czy komunikacja wewnątrz aplikacji.

#### Faza 9 — Rozliczenia ekip i KSeF · ~20–30 MD `[osobny epik]`

Rozliczenia per ekipa per miesiąc, zestawienie instalacji z fakturami, integracja z KSeF (A6).
Najsłabiej powiązane z Field App — realizowalne najpóźniej, bez blokowania reszty.

---

### ROZSTRZYGNIĘTE 2026-09-10: seed danych katalogowych — zaparkowane

CI ma już realny stack Supabase (Postgres + PostgREST + Auth, `supabase start`, migracje
aplikują się automatycznie — zamknięte 2026-09-09/10, patrz commity CI oraz migracja
`20260910090000_b2c_catalog_view_tracked.sql`, która odtworzyła w repo widok zmaterializowany
`available_combinations` i jego triggery odświeżania, wcześniej istniejące wyłącznie na
produkcji). Brakuje już tylko **danych** w tabelach źródłowych (`indoor_units`, `outdoor_units`,
`single_split_sets`, `multi_split_sets`) — stąd 12 testów E2E katalogu/rekomendacji nadal
czerwonych na świeżym stacku (widok istnieje, ale jest pusty).

**Decyzja Michała: seed świadomie odłożony do ok. października 2026.** Nowy katalog urządzeń
na 2027 rok może wpłynąć na strukturę tabel (parametry jednostek, sposób łączenia w zestawy,
ewentualnie logikę cenową) — pisanie danych seedowych pod dzisiejszy kształt tabel oznaczałoby
przerabianie ich razem ze schematem miesiąc później. Taniej poczekać.

**Nie blokuje żadnej innej pracy** — RLS, atomowość rezerwacji slotów i reszta modułu kalendarza
(rozdział 6) nie zależy od danych katalogowych, tylko od tabel `bookings`/`absences`/reguł
dostępności, które są osobnym zakresem.
Rozważyć gotowe API księgowe (Fakturownia, inFakt) zamiast integracji z API Ministerstwa Finansów.

---

### Ścieżka krytyczna

Fundament (fazy 0–2) blokuje wszystko i **musi być zrobiony jako pierwszy** — w tym Postgres w CI,
który jest długiem całego projektu, nie tylko Field App.

Po fundamencie **ścieżka montera jest krótsza i szybciej daje wartość produkcyjną**: jedna faza
zamiast czterech, bez zależności od kalkulatora, cennika i płatności. Jeśli priorytetem jest
najszybsze wyjście na produkcję z czymkolwiek działającym, kolejność to fazy 0–2, potem 7.

Jeśli priorytetem jest sprzedaż (a transkrypcja sugeruje, że tak — cały nacisk jest na domykanie
umowy u klienta), kolejność to fazy 0–2, potem 3–6, przy czym **faza 5 jest najdłuższa i zawiera
najwięcej niewiadomych prawnych**.

## 8. Wdrożenie

- **Dystrybucja:** TestFlight (iOS) i Play Console internal testing (Android) od fazy 2, żeby
  audytor mógł dotykać aplikacji od początku, a nie na końcu.
- **Urządzenia:** transkrypcja zakłada telefon **i** tablet (rysik do podpisu i adnotacji).
  Interfejs musi obsłużyć oba formaty — to nie jest „skalowanie", to dwa różne układy ekranu
  dla tych samych funkcji.
- **Uwaga do rozmowy:** padło stwierdzenie „trzeba będzie dwie napisać" (osobno iOS, osobno
  Android). To nieaktualne — React Native + Expo (D1) daje jedną bazę kodu na obie platformy.
- **Wersje produkcyjne:** dopiero po zamknięciu fazy prawnej (umowa, RODO) — aplikacja zbiera
  dane osobowe klientów i lokalizację pracowników.

---

## 9. Znaleziska poboczne (poza Field App)

Wyszły przy tym przeglądzie, warte osobnego zgłoszenia:

1. **`T02` i `T03` mają status `STABLE`, opierając się na nieistniejących tabelach**
   (`quotes`, `bookings`). Status kontraktowy nie odpowiada wykonalności.
2. **Nagłówki `FLD-AVAILABILITY-SPLIT.md` i `FLD-CONSENT-DOCS.md` mówią „WYMAGA DECYZJI,
   nie startować"**, podczas gdy decyzje są rozstrzygnięte w tych samych plikach, a oba WO są
   zrealizowane. Dryf dokumentacyjny mylący kolejnego czytelnika.
3. **`cennik_uslug.koszt_b2b_netto` nie ma ani jednego konsumenta** — martwa kolumna.
4. **Status `BLOCKED` nie ma w repo ustalonej semantyki** (odnotowane w `FLD-CONTRACT-BASE.md`),
   a używa go 6 wymagań — wszystkie `FLD-*`.
