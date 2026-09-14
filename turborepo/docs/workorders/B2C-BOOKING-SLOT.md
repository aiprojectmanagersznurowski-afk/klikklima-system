# WO: B2C-BOOKING-SLOT — atomowa rezerwacja terminu audytu przez klienta (B2C)

> **STATUS: WYMAGA DECYZJI — nie przechodzić do RED.**
> Trzy punkty (D-1, D-2, D-3 poniżej) są nierozstrzygalne bez człowieka, bo rejestr wymagań opisuje
> inny stan kodu niż stan faktyczny, a jedna z odpowiedzi zmienia zakres z „jeden adapter" na
> „wyniesienie warstwy harmonogramu do wspólnego pakietu". D-4 (zależność od `CAL-POOL-AGGREGATE`)
> to blocker kolejnościowy, nie decyzyjny.
> Zakres, kryteria akceptacji i odcięcia poniżej są kompletne i gotowe do wykonania **po** D-1–D-3.

## Wymagania

- **`B2C-BOOKING-SLOT`** (`contracts/requirements.contract.mjs:539`) — status `TODO`, **risk `HIGH`
  (potwierdzone z rejestru)**, domain `b2c`, source `docs/prompts/figma_triage_ui_prompt.md#ekran-rezerwacji`.
  Statement: „Rezerwacja terminu audytu przez klienta jest atomowa — ten sam slot może zostać zajęty tylko raz."
- **`FLD-BOOKING-ATOMIC-ASSIGN`** (`:673`, `DONE`) — **nośnik atomowości**. Dostarczył
  `createBooking` + ograniczenie `bookings_no_overlap_per_resource`. Ten WO go **konsumuje**, nie powtarza.
- **`CAL-POOL-AGGREGATE`** (`:666`, `TODO`, domain `b2c`) — „Klient wybierający termin widzi sumę
  wolnych terminów całej puli wykonawców, a nie kalendarz konkretnej osoby." **Wejście dla tego WO.**
  Work Order dla niego **nie istnieje** w `docs/workorders/` w chwili pisania (sprawdzone).
- **Styczne, celowo NIE zamykane tutaj:** `B2C-LEAD-ATOMIC` (`:538`), `B2C-BOOKING-VALIDATION`,
  `FNL-E3-E4` (rezerwacja montażu — ta sama funkcja `createBooking`, inny koszyk, inna tura).

## Kontekst kodu (stan zweryfikowany 2026-09-14)

### Istnieje i jest gotowe jako wejście (strona Prisma, `apps/b2b-web`)

- `apps/b2b-web/src/lib/schedule/available-slots.ts:174` — `findAvailableSlots(visitBasketId, dateRange)`
  → `AvailableSlotsResult { resources: ResourceSlots[], duration_minutes, travel_buffer_minutes, error }`.
  Wynik jest **per zasób** (`resource_id`, `resource_kind`) — czyli dokładnie to, czego klientowi
  pokazać NIE wolno; agregacja to zadanie `CAL-POOL-AGGREGATE`.
- `apps/b2b-web/src/lib/schedule/create-booking.ts` — `createBooking(params)`,
  `CreateBookingParams { visitBasketId, startAt, subject: BookingSubject, bookedBy: 'CLIENT' | 'DISPATCHER',
  alternativesRange? }`. Funkcja **czysta domenowo: bez `can()`, bez sesji, bez `revalidatePath`**
  (komentarz w pliku, linie 5–9). Zwraca
  `{ ok: false, error: { code: 'SLOT_TAKEN', message, alternatives: AvailableSlot[] } }` —
  **lista alternatyw i mapowanie `23P01` → błąd domenowy JUŻ ISTNIEJĄ**; ten WO ich nie buduje.
  Kody błędów: `BASKET_NOT_FOUND | BASKET_INACTIVE | CONFIG_MISSING | SLOT_NOT_OFFERED | SLOT_TAKEN |
  POOL_MISMATCH | SUBJECT_ALREADY_BOOKED`.
- `apps/b2b-web/src/app/(dashboard)/bookings/actions.ts:47` — `createBookingAction`, kolejność
  rola → `can(role,'bookings','create')` → Zod → warstwa domenowa. Schemat Zod **już przyjmuje
  `bookedBy: 'CLIENT'`**, ale bramka nie wpuści klienta (patrz niżej).
- Koszyk `AUDIT` istnieje w słowniku `visit_duration_baskets`
  (`packages/database/prisma/schema.prisma:849-869`, kody: `AUDIT, SERVICE, INCIDENT, INSTALL_*`),
  pula `AUDITOR`, wymuszana wyzwalaczem `bookings_pool_matches_basket`.
- Infrastruktura testów integracyjnych: `vitest.integration.config.mts` (`include: ['**/*.itest.ts']`,
  `fileParallelism: false`, `globalSetup: tools/vitest-integration-db-guard.mjs` blokujący
  nie-lokalny `DATABASE_URL`), wzorzec: `apps/b2b-web/tests/create-booking-concurrency.itest.ts`.
  Uruchomienie: `npm run test:integration`.

### Brakuje / stan faktyczny `apps/b2c-web` odbiega od opisu w rejestrze

- **`apps/b2c-web` nie zna Prismy. W ogóle.** `@repo/database` jest w `package.json` jako zależność,
  ale **żaden plik aplikacji jej nie importuje** (sprawdzone grepem: trafienia wyłącznie w komentarzach
  `saveLead.test.ts:175`, `leads.ts:80`). Cały dostęp do danych idzie przez `supabase-js`.
- **ADR-001 „B2C: RLS aktywne" jest dziś nieprawdziwe.** `apps/b2c-web/lib/supabaseClient.ts` tworzy
  klienta z `process.env.SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` — z komentarzem
  wprost: „Klient Supabase z uprawnieniami administratora (Service Role) omija RLS". To samo w
  `app/actions/leads.ts:5-9` i `app/actions/getFomoSlots.ts:14-18`. Klucz jest używany wyłącznie
  w plikach `"use server"`, więc zakaz z `CLAUDE.md` („service_role w kodzie klienckim") nie jest
  naruszony — ale **dzisiejszy model autoryzacji publicznych zapisów B2C to: brak autoryzacji,
  zaufanie do granicy Server Action.** To jest precedens, na którym stoi decyzja D-3.
- **`apps/b2c-web/app/api/calendar/slots/route.ts` to MARTWY KOD.** Zwraca zahardkodowaną tablicę
  `["08:00 - 10:00","10:00 - 12:00","12:00 - 14:00","13:00 - 15:00"]` — zgadza się z kryterium
  akceptacji. Ale **nikt tego endpointu nie woła**: grep po `'/api/calendar/slots'` w całym
  `apps/b2c-web` nie zwraca żadnego konsumenta. Kryterium akceptacji rejestru wskazuje więc
  na plik, którego naprawa **nie zmienia zachowania widocznego dla klienta**.
- **Żywa ścieżka terminów B2C to Google Calendar, nie baza.** `apps/b2c-web/app/actions/calendar.ts:33`
  `getAvailableSlots()` woła `calendar.freebusy.query` (konto serwisowe, `GOOGLE_CALENDAR_ID`),
  horyzont 60 dni, sztywna siatka `TIME_SLOTS` (`calendar.ts:25`), pomijanie weekendów, bufor 2 h.
  Konsumenci: `components/triage/steps/Step8Booking.tsx:9` (wybór terminu przez klienta) oraz
  `app/actions/getFomoSlots.ts:48` (licznik FOMO na stronie głównej).
- **Żywa ścieżka rezerwacji B2C nie tworzy wiersza `bookings`.** `app/actions/saveLead.ts:27-103`:
  INSERT `klienci` → INSERT `adresy` → INSERT `leady` z `data_rezerwacji` (`:84`) →
  `createCalendarEvent(...)` (`:90`, wpis do Google Calendar, awaria **nie przerywa** przepływu, `:98-101`).
  Rezerwacja jest więc dziś „atomowa" wyłącznie w sensie: nikt nie sprawdza kolizji.
- Brak jakiegokolwiek wzorca komunikacji `b2c-web` → `b2b-web`: `apps/b2b-web` nazywa się
  `@apps/b2b-web` i **nie jest zależnością** `b2c-web`; nie ma wewnętrznego API, aliasu tsconfig
  ani wspólnego pakietu z logiką harmonogramu. `packages/` to `contracts, database, eslint-config,
  typescript-config, ui` — **nie ma `packages/scheduling`**.
- RBAC: `contracts/rbac.contract.mjs:9` `ROLES = ['admin','dyspozytor','audytor','monter']`;
  `:54` `{ resource: 'bookings', read: [...], create: ['admin','dyspozytor'], ... }`.
  **Brak jakiejkolwiek roli reprezentującej klienta B2C** — klient nie ma wiersza w `authorized_users`,
  więc `getCurrentActorRole()` zwróci `null` i `createBookingAction` odmówi (`actions.ts:49-51`).
- `docs/architecture/generated/CONTRACTS.md`: **zero wystąpień „booking"/„rezerwac"** — kolejka
  powiadomień nie zna dziś zdarzenia „rezerwacja audytu potwierdzona". Ten WO powiadomień nie dodaje.

## WYMAGA DECYZJI

### D-1 (blokujące zakres) — dwa równoległe źródła prawdy o terminach audytu

Rejestr (`:539`) mówi: „Lista wolnych slotów jest wyliczana z `bookings` i `absences` — dzisiejsze
`apps/b2c-web/app/api/calendar/slots/route.ts` zwraca zahardkodowaną tablicę mockową i wymaganie
opisuje stan docelowy, nie obecny".

Kod mówi co innego: mock z `route.ts` jest martwy, a klient dostaje terminy z **Google Calendar
freebusy** (`app/actions/calendar.ts:33`) i jego rezerwacja ląduje jako **wydarzenie w Google
Calendar** (`calendar.ts:123 createCalendarEvent`), a nie w `bookings`.

Zamknięcie tego wymagania przez podmianę treści `route.ts` **spełniłoby literę kryterium i nie
zmieniłoby nic dla klienta**. Rzeczywiste zamknięcie oznacza wyłączenie Google Calendar jako źródła
prawdy dla audytów B2C, co dotyka trzech miejsc: `Step8Booking.tsx`, `getFomoSlots.ts` (licznik FOMO
na stronie głównej liczy sloty z Google) i `createCalendarEvent` (czy nadal pisać do Google jako
kopię dla ludzi w terenie?).

**Pytanie do człowieka:**
(a) `bookings` + `absences` stają się jedynym źródłem, Google Calendar znika z B2C (wtedy: czy
`createCalendarEvent` zostaje jako jednokierunkowa kopia informacyjna, czy jest usuwany?), czy
(b) Google Calendar zostaje, a `bookings` jest zapisywane równolegle (wtedy: mamy dwa kalendarze,
które się rozjadą — i wymaganie o atomowości jest spełnione tylko po stronie bazy), czy
(c) martwy `route.ts` jest usuwany, a właściwa podmiana źródła jest osobnym wymaganiem?

Nie wybieram sam — to decyzja produktowa, która przesądza o widoczności terminów dla klientów
i o tym, co widzą ludzie w terenie w swoich kalendarzach Google.

### D-2 (blokujące zakres) — gdzie ma mieszkać warstwa rezerwacji

Kryterium akceptacji: „Rezerwacja audytu tworzy rekord `bookings` tą samą ścieżką co rezerwacja
montażu z `FNL-E3-E4` — **jedna implementacja rezerwacji, dwa typy wizyty**". To wprost zakazuje
skopiowania `createBooking` do `b2c-web`. Ale `createBooking` i `findAvailableSlots` leżą
w `apps/b2b-web/src/lib/schedule/`, a `b2c-web` nie ma do nich żadnej drogi importu.

Warianty:
- **(A) Wyniesienie do `packages/scheduling`** — `available-slots.ts`, `create-booking.ts`,
  `reassign-booking.ts` przenoszone do nowego pakietu workspace, `b2b-web` i `b2c-web` importują to
  samo. Jedna implementacja zgodnie z kryterium, ale: nowy pakiet, przepięcie wszystkich importów
  w `b2b-web`, przepięcie `vitest.config.mts`/`vitest.integration.config.mts` i sprawdzenie, czy
  istniejące testy (`create-booking.test.ts`, `create-booking-concurrency.itest.ts`,
  `available-slots-engine-*.test.ts`) nadal je widzą. **Rekomendacja WO**, jeśli D-1 = (a).
- **(B) Wewnętrzne API `b2c-web` → `b2b-web`** (fetch z sekretem współdzielonym). Nie wymaga ruszania
  `b2b-web`, ale wprowadza nowy tryb awarii (b2b niedostępny = klient nie zarezerwuje), nowy sekret,
  nowy publiczny-ish punkt wejścia do panelu i opóźnienie sieciowe w ścieżce, która musi być atomowa.
- **(C) `b2c-web` importuje Prismę bezpośrednio i dostaje własną kopię logiki** — **odrzucone**,
  sprzeczne z cytowanym kryterium akceptacji.

Wariant (A) to praca dotykająca kodu produkcyjnego `b2b-web`, którego ten WO poza tym nie planuje
ruszać. Potrzebna zgoda na taki refaktor, bo to zmiana o innej skali niż „adapter w B2C".

### D-3 (rozstrzygnięte w tym WO, do potwierdzenia) — autoryzacja rezerwacji przez klienta

`FLD-BOOKING-ATOMIC-ASSIGN.md:111-114` zostawił to jako otwarte: „rezerwacja przez klienta
(`booked_by = 'CLIENT'`) nie ma w `MATRIX` żadnej roli, która by ją autoryzowała. `B2C-BOOKING-SLOT`
będzie musiał albo rozszerzyć kontrakt RBAC, albo jawnie zapisać, że ścieżka publiczna działa na
token i nie przechodzi przez `can()`."

**Rozstrzygnięcie WO: nie rozszerzamy `ROLES` ani `MATRIX`. Ścieżka publiczna nie przechodzi przez
`can()` — i to musi być zapisane jawnie, nie domyślne.** Uzasadnienie:

1. `ROLES` to wartości kolumny `role` w `authorized_users` (ADR-002, wyjątek świadomy). Klient B2C
   nie ma tam wiersza i nie powinien mieć — dopisanie roli `klient` wprowadziłoby do macierzy
   uprawnień podmiot, który nigdy nie jest uwierzytelniony, i osłabiło znaczenie całej macierzy.
2. Precedens już istnieje i jest jedyną działającą formą publicznego zapisu w tym repo:
   `saveLead.ts` pisze do `klienci`, `adresy`, `leady` przez Server Action bez sesji i bez `can()`.
   Nowa rezerwacja idzie **tym samym mechanizmem, w tym samym przepływie**, nie wymyśla drugiego.
3. `createBookingAction` (`b2b-web`) **nie jest** właściwym miejscem: jest bramkowana rolą z sesji
   panelu i osłabienie tej bramki otworzyłoby dziurę w ścieżce dyspozytora, żeby obsłużyć klienta.

Konsekwencja, która MUSI być pokryta testem (bo brak `can()` przesuwa całą obronę na walidację
wejścia): publiczny punkt wejścia **nie przyjmuje od klienta ani `visitBasketId`, ani `leadId`,
ani `resource_id`**. Koszyk jest wymuszony serwerowo na `AUDIT`, podmiot rezerwacji jest wiązany
z leadem utworzonym w TYM SAMYM żądaniu. Inaczej dostajemy publiczny endpoint pozwalający
rezerwować na cudzy `leadId` i zapełnić kalendarz montażowy (`INSTALL_*`) — czyli zamienić lukę
w uprawnieniach na lukę w parametrach.

Zmiana kontraktu: **NIEWYMAGANA** dla `MATRIX`. Opcjonalnie (nie blokuje) — komentarz przy
`bookings` w `contracts/rbac.contract.mjs:54` odnotowujący istnienie ścieżki publicznej omijającej
`can()`; to zmiana w `contracts/`, więc **okno kontraktowe + rola `contract-steward`**, nigdy
`implementer-server`.

### D-4 (blocker kolejnościowy, nie decyzyjny) — `CAL-POOL-AGGREGATE`

Ten WO **konsumuje** wynik `CAL-POOL-AGGREGATE` i go nie realizuje. Wymagany kontrakt wejścia:
funkcja/endpoint zwracający listę wolnych terminów dla koszyka `AUDIT` w zadanym zakresie dat,
**bez `resource_id`, bez `resource_kind`, bez liczby wolnych osób** — anonimowa suma puli.
Dopóki `CAL-POOL-AGGREGATE` nie ma Work Orderu ani implementacji, AC2 i AC3 tego WO są nietestowalne.

Kolejność: `CAL-POOL-AGGREGATE` → D-1/D-2 → ten WO.

## Zmiana kontraktu

- **`contracts/rbac.contract.mjs` — NIEWYMAGANA** (D-3: brak nowej roli, brak zmiany `MATRIX`).
- **`schema.prisma` / `supabase/migrations/` — NIEWYMAGANA.** Ograniczenie
  `bookings_no_overlap_per_resource` (`EXCLUDE USING gist`) i `bookings_one_active_per_subject`
  są już na żywej bazie (migracje `20260910100000`, `20260910110000` — potwierdzone w rejestrze
  przy `FLD-BOOKING-ATOMIC-ASSIGN`). Ten WO nic do bazy nie dokłada.
- **`contracts/notifications` — NIEWYMAGANA** w tym zakresie (brak powiadomienia o rezerwacji audytu
  w `CONTRACTS.md`; jeżeli klient ma dostać SMS/e-mail potwierdzenia, to osobne wymaganie).
- **`contracts/requirements.contract.mjs` — WYMAGANA, ale dopiero po D-1:** kryterium akceptacji
  wskazujące `route.ts` jako „dzisiejszy stan" opisuje martwy plik i pomija żywą ścieżkę Google
  Calendar. Po decyzji D-1 wpis trzeba doprecyzować (okno kontraktowe, `contract-steward`).

## Kryteria akceptacji (wykonalne)

Rozwinięte 1:1 z `acceptance` w rejestrze; numeracja AC odpowiada kolejności kryteriów.

- [ ] **AC1** — Dwa równoległe żądania rezerwacji klienta na ten sam termin kończą się **dokładnie
      jednym** utworzonym wierszem `bookings`. Przegrane żądanie nie tworzy wiersza i nie zmienia
      istniejącego. (Realizowane ograniczeniem bazy, nie sprawdzeniem w JS — patrz „Przypadki brzegowe".)
- [ ] **AC2** — Lista terminów pokazywana klientowi odzwierciedla stan `bookings` i `absences`:
      po zarezerwowaniu terminu przez dowolną ścieżkę (klient, dyspozytor) ten sam termin znika
      z listy przy kolejnym odpytaniu, bez restartu aplikacji i bez zmian w kodzie.
- [ ] **AC3** — Odpowiedź z listą terminów **nie zawiera** identyfikatora ani nazwy pracownika,
      liczby wolnych osób, ani żadnego pola pozwalającego wywnioskować obłożenie konkretnej osoby.
      (Test: serializacja odpowiedzi nie zawiera kluczy `resource_id`, `resource_kind`, `auditor_id`,
      `crew_id` ani tablicy per zasób.)
- [ ] **AC4** — Przegrane żądanie otrzymuje **błąd domenowy „slot zajęty" wraz z listą alternatywnych
      terminów**, a nie odpowiedź 500 i nie surowy komunikat Postgresa. SQLSTATE `23P01` nie wycieka
      do odpowiedzi ani do treści widzianej przez klienta.
- [ ] **AC5** — Rezerwacja klienta jest zapisana z `booked_by = 'CLIENT'` i koszykiem `AUDIT`
      (pula `AUDITOR`), przy czym `booked_by` i koszyk pochodzą z serwera, nie z żądania klienta.
      Żądanie próbujące podać własny koszyk (np. `INSTALL_STANDARD`) lub własne `booked_by`
      jest odrzucane albo te wartości są ignorowane — nigdy honorowane.
- [ ] **AC6** — Rezerwacja klienta i rezerwacja dyspozytora tworzą wiersz `bookings`
      **tą samą funkcją domenową** (`createBooking`), nie dwiema kopiami logiki. Test: usunięcie
      gałęzi w `createBooking` psuje obie ścieżki.
- [ ] **AC7** — Żądanie podające cudzy `leadId` (albo jakikolwiek `leadId` spoza bieżącego przepływu)
      nie tworzy rezerwacji. Publiczny punkt wejścia wiąże rezerwację z leadem utworzonym w tym
      samym żądaniu (D-3).
- [ ] **AC8** — `createBooking` nie zapisuje `leady.data_rezerwacji` (D-4 z `FLD-BOOKING-ATOMIC-ASSIGN`:
      „nie pisz podwójnie"). Jeżeli D-1 rozstrzygnie, że `data_rezerwacji` zostaje jako pole
      pomocnicze (FOMO, filtry), pisze je wyłącznie `saveLead.ts` — jedno miejsce zapisu, nie dwa.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Współbieżność (`*.itest.ts`, żywy Postgres).** Dwa równoległe żądania na ten sam termin i tę samą
  pulę. Wzorzec: `apps/b2b-web/tests/create-booking-concurrency.itest.ts`, konfiguracja
  `vitest.integration.config.mts`, uruchomienie `npm run test:integration` po `supabase start`.
  **Nie wolno dowodzić tego atrapą Prismy** — atrapa dowodzi wyłącznie tego, jak ją zaprogramowano.
  Uwaga z rejestru (`:673`): testy `*.itest.ts` z poprzedniej tury **nie zostały uruchomione**
  (brak Dockera, `DATABASE_URL` na produkcji, guard słusznie blokuje). Ten sam dług dotknie ten WO —
  wykonanie należy do CI albo maszyny z lokalnym stackiem.
- **Współbieżność przez dwie różne ścieżki:** klient (B2C) i dyspozytor (panel) rezerwują ten sam
  termin jednocześnie. To jest realny scenariusz po wdrożeniu i inna para ścieżek niż dwa żądania klienta.
- **Idempotencja/podwójne kliknięcie:** dwukrotne wysłanie tego samego formularza przez tego samego
  klienta. Oczekiwanie: `SUBJECT_ALREADY_BOOKED` (23505 z `bookings_one_active_per_subject`),
  obsłużone jako komunikat domenowy, nie 500 i nie druga rezerwacja.
- **Uprawnienia / parametry (bo `can()` tu nie ma):** żądanie z podanym `visitBasketId` innym niż
  `AUDIT`; żądanie z `bookedBy: 'DISPATCHER'`; żądanie z obcym `leadId`; żądanie z `resource_id`.
  Każde musi być odrzucone lub wartość zignorowana.
- **Strefa czasowa.** Cała warstwa harmonogramu liczy w `Europe/Warsaw`
  (`available-slots.ts:23`, `create-booking.ts:25`), `bookings.scheduled_start/end` to
  `timestamptz`. Test na dniu zmiany czasu (ostatnia niedziela marca i października) — termin
  wybrany przez klienta jako „10:00" ma być 10:00 lokalnie, nie 09:00 ani 11:00.
- **Granica przedziału `[start, end)`:** rezerwacja zaczynająca się dokładnie w chwili końca
  poprzedniej jest dozwolona (z uwzględnieniem bufora dojazdu z `scheduling_config` — bufor jest
  fail-closed, `available-slots.ts:200+`, brak konfiguracji = brak terminów, nie bufor 0).
- **Termin, którego nie było na liście:** klient wysyła `startAt` spoza zaproponowanej siatki →
  `SLOT_NOT_OFFERED`, komunikat domenowy z alternatywami.
- **Koszyk `AUDIT` wycofany (`is_active = false`) lub brak `scheduling_config`:** klient dostaje
  zrozumiały komunikat, nie 500 i nie pustą białą stronę.
- **Awaria po stronie zapisu leada:** rezerwacja nie powstaje bez leada; lead bez rezerwacji
  (bo termin zajęty) nie zostaje w stanie udającym potwierdzoną wizytę — zachowanie do ustalenia
  wraz z D-1, patrz „Ryzyka".

## Poza zakresem

- **UI wyboru terminu w `apps/b2c-web`** — komponent `Step8Booking.tsx`, kalendarz, animacje, teksty.
  Ten WO jest **backendowy**: źródło listy terminów + publiczna ścieżka złożenia rezerwacji.
  Minimalne przepięcie wywołania w `Step8Booking.tsx` na nowe źródło jest dopuszczalne **tylko**
  jeśli D-1 = (a) i tylko jako podmiana wywołania, bez zmian wizualnych. Przeprojektowanie ekranu
  rezerwacji → osobne wymaganie.
- **Walidacja formularza rezerwacji (RHF + Zod, komunikaty pól)** → `B2C-BOOKING-VALIDATION`.
- **Atomowość klient + adres + lead + rezerwacja w jednej transakcji** → `B2C-LEAD-ATOMIC`.
  Tutaj zapis leada idzie `supabase-js`, a rezerwacja Prismą — **to dwa połączenia i nie ma między
  nimi transakcji**. Ten WO tego nie zszywa; odnotowuje w Ryzykach.
- **Rezerwacja montażu (`FNL-E3-E4`)** — ta sama funkcja, inny koszyk, inna tura.
- **Agregacja puli** → `CAL-POOL-AGGREGATE` (wejście, nie produkt tego WO).
- **Powiadomienie do klienta o potwierdzonej rezerwacji** — brak takiego wpisu w
  `docs/architecture/generated/CONTRACTS.md`; dopisanie go to zmiana kontraktu powiadomień
  (`notification-architect` + `contract-steward`), nie ten WO.
- **Naprawa `SUPABASE_SERVICE_ROLE_KEY` jako domyślnego klienta w `b2c-web`** (rozjazd z ADR-001
  „B2C: RLS aktywne"). Realny dług, ale osobna klasa problemu — nie rozlewać tutaj.
- **Usunięcie plików `apps/b2c-web/test-cal*.ts`** (osiem skryptów ad hoc w katalogu aplikacji,
  importujących `getAvailableSlots`) — sprzątanie, nie to wymaganie.

## Ryzyka i nieznane

1. **Rejestr opisuje inny kod niż istniejący** (D-1). To nie jest literówka: kryterium akceptacji
   kieruje wykonawcę do martwego pliku, a żywa ścieżka klienta stoi na Google Calendar.
   Zamknięcie wymagania bez D-1 da zielony `kk-trace` i niezmienione zachowanie produkcyjne.
2. **Brak transakcji między leadem a rezerwacją.** `saveLead.ts` pisze przez `supabase-js`,
   `createBooking` przez Prismę. Kolejność jest wymuszona (rezerwacja potrzebuje `leadId`), więc
   `SLOT_TAKEN` zostawia leada bez rezerwacji. Nierozstrzygnięte: czy klient ponawia na tym samym
   leadzie (i wtedy trzeba go przenieść przez żądanie), czy powstaje drugi lead + drugi klient
   + drugi adres przy każdej nieudanej próbie. Druga opcja to cicha produkcja duplikatów w CRM.
   Dokumenty tego nie rozstrzygają; styka się z `B2C-LEAD-ATOMIC`.
3. **`getFomoSlots` liczy „wolne terminy" z Google Calendar.** Po przepięciu źródła licznik na
   stronie głównej albo pokaże inną liczbę, albo przestanie działać. Dokumenty nie mówią, która
   liczba jest „prawdziwa".
4. **Sztywna siatka `TIME_SLOTS` (bloki 2 h) vs `duration_minutes` z koszyka `AUDIT`.** To dwie
   różne definicje długości wizyty. Jeżeli koszyk `AUDIT` ma inną długość niż 120 minut, terminy
   pokazywane klientowi i terminy zapisywane w `bookings` będą różnej długości. Nie sprawdziłem
   wartości `duration_minutes` dla `AUDIT` na żywej bazie — plik migracji nie dowodzi stanu bazy.
5. **Testy `*.itest.ts` prawdopodobnie nie wykonają się w tym środowisku** (brak Dockera,
   `DATABASE_URL` wskazuje produkcję, `tools/vitest-integration-db-guard.mjs` blokuje). Kryterium
   AC1 będzie spełnione co do FORMY testu, nie co do jego przebiegu — dokładnie ten sam dług
   co przy `FLD-BOOKING-ATOMIC-ASSIGN`. To trzeba świadomie zaakceptować albo uruchomić w CI.
6. **`apps/b2c-web/AGENTS.md`: „This is NOT the Next.js you know"** — Next 16.2.9, konwencje mogły
   się zmienić. Implementer musi przeczytać `node_modules/next/dist/docs/` przed pisaniem
   Route Handlera/Server Action, zamiast opierać się na pamięci.

## Kolejność ról

1. **człowiek** — D-1, D-2, potwierdzenie D-3. Bez tego nie ruszamy.
2. **spec-analyst** — Work Order dla `CAL-POOL-AGGREGATE` (nie istnieje), aktualizacja tego WO
   datowaną sekcją po decyzjach.
3. **contract-steward** — doprecyzowanie kryterium akceptacji `B2C-BOOKING-SLOT:539` po D-1
   (okno kontraktowe); opcjonalny komentarz przy `bookings` w `rbac.contract.mjs`.
4. **test-author** — `*.test.ts` (AC3, AC5, AC7, granice) + `*.itest.ts` (AC1, AC4, idempotencja).
5. **implementer-server** — wyniesienie warstwy (D-2 wariant A) i publiczny punkt wejścia w `b2c-web`.
6. **reviewer** + **rls-security-auditor** — punkt wejścia bez `can()` wymaga osobnego przejrzenia
   pod kątem parametrów przyjmowanych od klienta (AC5, AC7).
