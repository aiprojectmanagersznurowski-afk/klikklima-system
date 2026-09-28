# WO: B2C-LEAD-ATOMIC — jedna ścieżka, jedna transakcja: klient + adres + lead + rezerwacja

> **Status: GOTOWE DO RED.** Okno kontraktowe NIE jest potrzebne (zero zmian w `contracts/`,
> `schema.prisma`, `supabase/migrations/`). Wymaga jednak zmiany w pakiecie współdzielonym
> `packages/scheduling` (patrz „Decyzja projektowa P-2") — to jest kod produkcyjny
> `implementer-server`, nie kontrakt.
>
> To jest **WO 1 z 3** w pakiecie „B2C: zapis leada". Kolejność wiążąca:
> 1. **`B2C-LEAD-ATOMIC`** (ten plik) — transakcja i likwidacja drugiej ścieżki.
> 2. `B2C-CONSENT-RODO` (`docs/workorders/B2C-CONSENT-RODO.md`) — zgoda dopisywana DO transakcji
>    z tego WO. **Nie startować** przed rozstrzygnięciem decyzji w tamtym pliku.
> 3. `B2C-RLS-PUBLIC` (`docs/workorders/B2C-RLS-PUBLIC.md`) — skan bundla, odczyt anonimowy,
>    przełączenie `lib/supabaseClient.ts` na klucz anonimowy.
>
> Podział wynika z limitu 3 iteracji GREEN i z tego, że te trzy części mają różne artefakty:
> kod aplikacji (1), schemat + migracja + decyzja prawna (2), polityki RLS + narzędzie CI (3).
> Część 1 jest jedyną, która nie czeka na nic.

## Wymagania

- **`B2C-LEAD-ATOMIC`** (`contracts/requirements.contract.mjs:595`) — TODO, risk HIGH, domain `b2c`.
  Statement: „Lead, klient, adres i rezerwacja terminu audytu powstają w jednej transakcji albo nie
  powstaje żaden z tych rekordów." **Zamykane w całości** (5 kryteriów).
- **`B2C-LEAD-ENTRY`** (`:594`) — TODO, risk HIGH. **Zamykane CZĘŚCIOWO**: kryterium 2 (jedna
  Server Action), kryterium 1 (status z `START_STATE`), kryterium 12 (odrzucenie stanu innego niż
  `START_STATE`) oraz **warstwa Zod** kryteriów 3–4. Status wymagania zostaje `TODO` —
  patrz „Poza zakresem".
- Styczne, **dotknięte skutkiem ubocznym, nie zamykane**:
  - `FLD-GEO-COORDS` (`:644`) kryt. 5 („obie równoległe ścieżki… albo jedna z nich zostaje jawnie
    zlikwidowana") — likwidacja `submitFinalTriage` spełnia jego drugą gałąź.
  - `B2C-BOOKING-SLOT` (`:596`, **DONE**) — kryteria rejestru pozostają spełnione, ale **AC9 z WO
    `docs/workorders/B2C-BOOKING-SLOT.md`** (osierocone klient+adres+lead po nieudanej rezerwacji,
    „D-6 wariant (a)") przestaje obowiązywać. To jest zamierzone: Michał 2026-09-14 określił
    wariant (a) jako „zaakceptowany, **tymczasowy** skutek — pełna atomowość zostaje przy
    `B2C-LEAD-ATOMIC`". AC9 nie jest kryterium rejestru, więc zmiana nie wymaga okna
    kontraktowego, ale **test AC9 w `saveLead.booking.test.ts` musi zostać przepisany przez
    `test-author`**, bo będzie czerwony z właściwego powodu.

## Kontekst kodu

### Istnieje

- `apps/b2c-web/app/actions/saveLead.ts` — **żywa** ścieżka, wołana z
  `components/triage/steps/Step8Booking.tsx:194`. Sekwencja dziś (każdy krok osobno zatwierdzony):
  1. `supabase.from('klienci').insert` (`:71`)
  2. `supabase.from('adresy').insert` (`:86`)
  3. `supabase.from('leady').insert` ze `status: 'NEW_LEAD'` jako **literał** (`:112–122`)
  4. `prisma.visitDurationBasket.findFirst` (`:128`) — odczyt koszyka AUDIT
  5. `createBooking(...)` z `@repo/scheduling` (`:144`) — **własne** połączenie Prismy
  6. `supabase.from('leady').update({ data_rezerwacji })` (`:165`) — błąd tylko `console.warn`
  7. `createCalendarEvent(...)` (`:176`) — Google, best-effort, po rezerwacji
  - Brak kroku 4 (`BASKET_NOT_FOUND`, `:132`) i każdy błąd `createBooking` (`:151`) zwracają
    `success:false`, **zostawiając** klient+adres+lead w bazie.
  - `SaveLeadData` (`:20–29`): `triageData: any`, zero walidacji Zod poza ręczną kontrolą
    `PROPERTY_AREA_BAND` (`:51–64`).
  - `import { supabase } from "@/lib/supabaseClient"` — ten klient **preferuje
    `SUPABASE_SERVICE_ROLE_KEY`** (`lib/supabaseClient.ts:4`), więc komentarze
    „SEC-RLS-BASELINE: anon ma wyłącznie INSERT" w `saveLead.ts:67–69, 84, 98` opisują politykę,
    której ta ścieżka i tak nie podlega (dotyczy WO 3).
- `apps/b2c-web/app/actions/leads.ts` — plik **mieszany**, NIE martwy w całości:
  - `getCurrentSoftLeadConsentVersionId` (`:72`) i `saveSoftLead` (`:109`) — **żywe**, używane
    przez `components/triage/ExitIntentModal.tsx` (`B2C-SOFT-LEAD`, `B2C-SOFT-LEAD-CONSENT`).
    **Nie usuwać.**
  - `submitFinalTriage` (`:160–229`) — **martwa**: zero importów produkcyjnych
    (potwierdzone: jedyne wystąpienia to definicja i `tests/actions/submitFinalTriage.test.ts`).
    Dodatkowo **zepsuta względem żywej bazy** (sprawdzone 2026-09-28 w `information_schema`):
    wstawia kolumny `typ_klienta`, `status_triage`, `sciezka_koncowa` do `leady` i
    `imie_nazwisko` do `klienci` — **żadna z nich nie istnieje** (`klienci` ma
    `imie_i_nazwisko`). Każde wywołanie kończyłoby się błędem na pierwszym insercie.
- `apps/b2c-web/tests/actions/submitFinalTriage.test.ts` — jeden test `@REQ: FLD-GEO-COORDS`
  (`:85–86`), sformułowany już jako „albo funkcja jest usunięta, albo…".
- `packages/scheduling/src/create-booking.ts` — `createBooking` używa **globalnego** `prisma`
  (`:1`), **nie przyjmuje klienta transakcyjnego** i robi to celowo (komentarz `:10–13`,
  ryzyko **R-4** w `docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md:373`): pętla po kandydatach
  (`:316–384`) łapie `23P01`/`40P01` i próbuje następnego; w otwartej transakcji Postgresa pierwszy
  nieudany `INSERT` przełącza transakcję w stan aborted (`25P02`), a Prisma nie daje savepointów.
  R-4 przewidział dokładnie ten WO: „tamten WO będzie musiał albo ustalić kandydata przed otwarciem
  transakcji, albo zejść do `$executeRaw` z jawnymi savepointami".
- Modele Prisma: `klienci`, `adresy`, `leady`, `Booking`, `VisitDurationBasket`
  (`packages/database/prisma/schema.prisma:39, 65, 97, …`). Prisma `^6.19.3`.
- `START_STATE` eksportowane z `packages/contracts/src/generated/funnel.ts:14` (`"NEW_LEAD"`).

### Stan żywej bazy (odczyt 2026-09-28, nie z pliku migracji)

- `leady` 221, `klienci` 221, `adresy` 221, `bookings` **1**. Nie da się z tego odróżnić leadów
  historycznych sprzed `B2C-BOOKING-SLOT` od osieroconych po nieudanej rezerwacji — ale skala
  pokazuje, że skutek „lead bez rezerwacji" nie jest teoretyczny.
- `leady` **nie ma** kolumn `status_triage`, `triage_answers`, `declared_property_condition`,
  ani żadnej kolumny zgody. Odpowiedzi Triage żyją w `odpowiedzi_triage` (jsonb).

### Brakuje

- Jednej transakcji obejmującej cztery zapisy (i `data_rezerwacji`).
- Operacji w `@repo/scheduling`, którą da się wykonać **wewnątrz** cudzej transakcji.
- Walidacji Zod wejścia `saveLead` (dziś `triageData: any`).
- Testu statycznego „dokładnie jedna Server Action tworząca leada w `apps/b2c-web`".

## Zmiana kontraktu

**NIEWYMAGANA.** Uzasadnienie:
- Schemat już ma wszystkie kolumny i klucze obce potrzebne do czterech zapisów.
- Przejście z `supabase-js` na Prismę w Server Action jest zmianą kodu; `saveLead.ts` już dziś
  importuje `@repo/database` (`:13`), więc to nie jest pierwsze użycie Prismy w `apps/b2c-web`.
- AC9 z WO `B2C-BOOKING-SLOT` nie jest kryterium rejestru (rejestr `:596` go nie zawiera).

**Uwaga dla `contract-steward` przy najbliższym oknie (nie blokuje tego WO):** notatka przy
`B2C-BOOKING-SLOT` (`:596`) „B2C-LEAD-ATOMIC pozostaje OTWARTE" stanie się nieaktualna po
domknięciu tego WO — do zaktualizowania razem ze zmianą statusu.

## Decyzje projektowe (rozstrzygnięte w tym WO — nie do ponownego wyboru przez implementera)

**P-1. Jedna Server Action.** `saveLead` pozostaje jedyną Server Action tworzącą leada w
`apps/b2c-web`. Funkcja `submitFinalTriage` **zostaje usunięta** z `leads.ts` (nie
zdeprecjonowana, nie zakomentowana, nie przemianowana). Plik `leads.ts` zostaje — zawiera żywą
ścieżkę soft leadów. Plik testowy `tests/actions/submitFinalTriage.test.ts` usuwa **`test-author`**
(implementer nie dotyka testów).

**P-2. Transakcja ponawiana per kandydat („ustal kandydatów przed transakcją").**
Wybrany wariant z R-4. `@repo/scheduling` zostaje rozbity na dwie części o wspólnej logice:
- część **przygotowawcza** (poza transakcją, tylko odczyty): walidacja koszyka
  (`BASKET_NOT_FOUND`/`BASKET_INACTIVE`), konfiguracja (`CONFIG_MISSING`), kandydaci z
  `findAvailableSlots` (`SLOT_NOT_OFFERED` + alternatywy), kolejność D-1;
- część **zapisująca** jednego kandydata, przyjmująca klienta transakcyjnego (`tx`), która
  wykonuje DOKŁADNIE jeden `INSERT` do `bookings` i **nie łapie** `23P01`/`40P01` — oddaje błąd
  wołającemu, bo po nim transakcja i tak jest martwa.

`saveLead` iteruje po uporządkowanych kandydatach; **każda iteracja to osobna, pełna
`prisma.$transaction`**: klient → adres → lead (z `data_rezerwacji`) → rezerwacja dla kandydata *i*.
`23P01`/`40P01` → cała transakcja wycofana → następny kandydat. Wyczerpanie → `SLOT_TAKEN` z
alternatywami liczonymi **po** wycofaniu, poza transakcją.
`createBooking` (używany przez panel B2B) **zachowuje obecny kontrakt zachowania** — ma zostać
złożony z tych samych dwóch części, żeby nie powstała druga implementacja rezerwacji
(`B2C-BOOKING-SLOT` kryt. 7: „jedna implementacja rezerwacji"). Zapis do `bookings` nadal
wyłącznie w `packages/scheduling` (test statyczny AC6 z `saveLead.booking.test.ts:199` ma
pozostać zielony bez zmian).

Wariant odrzucony: jawne `SAVEPOINT` przez `$executeRaw` wewnątrz interaktywnej transakcji Prismy —
pierwsze takie użycie w repo, zależne od szczegółów implementacji silnika Prismy, bez precedensu i
bez testu na żywej bazie. Wariant odrzucony: kompensacja (kasowanie po błędzie) — sama może zawieść
w połowie i wprowadza kasowanie danych osobowych do ścieżki publicznej (to samo uzasadnienie co
wariant (c) w D-6 WO `B2C-BOOKING-SLOT`).

**P-3. Klient bazodanowy.** Cały zapis w `saveLead` idzie przez Prismę (`@repo/database`).
`saveLead.ts` przestaje importować `@/lib/supabaseClient`. Identyfikatory `klientId`, `adresId`,
`leadId` nadal generowane serwerowo (`randomUUID`) — żadne z nich nie przychodzi z żądania
(`B2C-BOOKING-SLOT` AC7 nadal obowiązuje).

**P-4. `data_rezerwacji`** zapisywane w tym samym `INSERT` leada (wartość = żądany `startAt`,
który jest dokładnie `scheduled_start` rezerwacji) albo `UPDATE` wewnątrz tej samej transakcji —
do wyboru implementera, obserwowalny skutek jest jeden (AC5). Osobny zapis po zatwierdzeniu —
zabroniony.

**P-5. Google Calendar** wołany **wyłącznie po zatwierdzeniu** transakcji, poza nią, best-effort
(jak dziś `:176–186`). Kolejkowanie przez `notification_queue` — poza zakresem (patrz Ryzyka R-3).

## Kryteria akceptacji (wykonalne)

Mapowanie: `B2C-LEAD-ATOMIC` kryt. 1–5 → AC1–AC5; `B2C-LEAD-ENTRY` → AC6–AC9.

- [ ] **AC1** *(LEAD-ATOMIC kryt. 1)* — „Zapisy do leads, clients, addresses i bookings wykonują
  się w jednej transakcji bazodanowej." Obserwowalnie: po udanym `saveLead` w bazie istnieje
  dokładnie jeden klient, jeden adres, jeden lead i jedna rezerwacja powiązane ze sobą
  (`adresy.klient_id`, `leady.klient_id`, `leady.adres_id`, `bookings.lead_id`), a
  `leady.data_rezerwacji` równa się `bookings.scheduled_start`.
- [ ] **AC2** *(LEAD-ATOMIC kryt. 2)* — „Test wstrzykuje błąd osobno na każdym z czterech
  kroków — po każdym z nich sprawdza, że nie powstał ani lead, ani klient, ani adres, ani
  rezerwacja." **Cztery osobne przypadki** (klient, adres, lead, rezerwacja), nie jeden
  zbiorczy. Dla każdego: liczba wierszy w `klienci`, `adresy`, `leady`, `bookings` po wywołaniu
  równa się liczbie sprzed wywołania, a `saveLead` zwraca `success:false` (nie rzuca wyjątku
  do UI).
- [ ] **AC3** *(LEAD-ATOMIC kryt. 3)* — „Powiązanie klienta z leadem powstaje wewnątrz tej
  samej transakcji, a nie osobnym UPDATE po zatwierdzeniu." Obserwowalnie: nie istnieje moment,
  w którym lead jest widoczny w bazie bez `klient_id`/`adres_id` — test statyczny: w
  `apps/b2c-web` nie ma zapisu `klient_id` do `leady` poza tym samym zapisem, który tworzy leada.
- [ ] **AC4** *(LEAD-ATOMIC kryt. 4)* — „Awaria integracji zewnętrznej z kalendarzem nie wycofuje
  transakcji ani nie zostawia rezerwacji bez leada." Obserwowalnie: `createCalendarEvent` zwraca
  błąd **albo rzuca wyjątek** → `saveLead` zwraca `success:true`, a klient+adres+lead+rezerwacja
  istnieją. Oraz: `createCalendarEvent` **nie jest wywoływany**, gdy transakcja się nie udała
  (żaden z czterech błędów z AC2 ani `SLOT_TAKEN`).
- [ ] **AC5** *(LEAD-ATOMIC kryt. 3 + WO B2C-BOOKING-SLOT AC10 w nowej postaci)* — Po każdym
  kodzie błędu rezerwacji (`SLOT_TAKEN`, `SLOT_NOT_OFFERED`, `SUBJECT_ALREADY_BOOKED`,
  `POOL_MISMATCH`, `BASKET_NOT_FOUND`, `BASKET_INACTIVE`, `CONFIG_MISSING`) w bazie **nie ma**
  nowego klienta, adresu ani leada. **Zastępuje AC9 z WO `B2C-BOOKING-SLOT`** (tam: „pozostają
  zapisane"). Klient nadal dostaje kod domenowy i listę alternatyw (bez `resource_id`), nie 500.
- [ ] **AC6** *(LEAD-ENTRY kryt. 2)* — „Istnieje dokładnie jedna Server Action tworząca leada z
  B2C — test statyczny wykrywa drugą ścieżkę zapisu." Test statyczny przechodzi po `apps/b2c-web`
  (bez `tests/`, `node_modules`, `.next`) i znajduje **dokładnie jeden** plik z zapisem do
  `leady` (Prisma `leady.create`/`createMany` albo `from('leady').insert`/`upsert`). Wstrzyknięcie
  drugiego takiego zapisu w dowolnym pliku musi test wywrócić. `submitFinalTriage` nie istnieje
  jako eksport `leads.ts`.
- [ ] **AC7** *(LEAD-ENTRY kryt. 1)* — Utworzony lead ma `leady.status` równe `START_STATE` z
  kontraktu lejka; wartość pochodzi z importu `START_STATE`, nie z literału `'NEW_LEAD'` w
  `saveLead.ts` (test statyczny na brak literału + test zachowania na wartość w bazie).
- [ ] **AC8** *(LEAD-ENTRY kryt. 12)* — Żądanie zawierające pole `status` (dowolna wartość, np.
  `QUOTED`) tworzy leada w `START_STATE` albo jest odrzucane — nigdy w stanie z żądania.
  Rozstrzygnięcie dla implementera: schemat Zod jest `.strict()`, więc nadmiarowe pole
  `status` → błąd walidacji, zero zapisów.
- [ ] **AC9** *(LEAD-ENTRY kryt. 3–4, WYŁĄCZNIE warstwa Zod)* — Brak któregokolwiek z pięciu
  elementów — imię i nazwisko, adres, telefon, e-mail, odpowiedzi Triage — odrzuca żądanie
  wywołane **z pominięciem UI** błędem walidacji, bez żadnego zapisu. **Pięć osobnych
  przypadków**, nie jeden zbiorczy. Pusty string i sam biały znak liczą się jako brak.
- [ ] **AC10** — Istniejące zachowania `saveLead` pozostają zielone: `FLD-GEO-COORDS`
  (`tests/actions/saveLead.test.ts`: `lat === 0` zapisuje 0, string → number, brak → `null`),
  `B2C-PROPERTY-AREA-BAND` (walidacja przedziału **przed** otwarciem transakcji, wartość wycięta
  dla `COMMERCIAL`), `B2C-BOOKING-SLOT` AC5/AC7/AC6-statyczny. Testy tych plików przepisuje
  `test-author` z mocka `supabase.from` na Prismę — **asercje merytoryczne bez zmian**.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Transakcja na żywym Postgresie (`*.itest.ts`), nie na atrapie.** AC2 dla kroku „rezerwacja"
  i AC5 dla `SLOT_TAKEN` wymagają realnego `23P01` — atrapa Prismy dowodzi wyłącznie tego, jak ją
  zaprogramowano. Wzorzec: `apps/b2c-web/tests/actions/booking-concurrency.itest.ts` i
  `vitest.integration.config.mts`. Błąd na krokach klient/adres/lead wolno wstrzyknąć naruszeniem
  ograniczenia (np. zduplikowany `id`), nie mockiem.
- **Wyścig dwóch klientów o ten sam slot przy puli 1 audytora:** dokładnie jeden sukces; przegrany
  ma w bazie **zero** nowych wierszy klient/adres/lead (dziś zostają trzy).
- **Wyścig przy puli ≥ 2:** przegrany pierwszego kandydata dostaje rezerwację u drugiego; w bazie
  jest dokładnie **jeden** komplet klient+adres+lead dla tego żądania (a nie jeden za każdą
  wycofaną iterację).
- **`40P01` (deadlock)** traktowany jak `23P01` — następny kandydat, nie 500
  (precedens: `create-booking.ts:360–376`).
- **Błąd nierozpoznany** z części zapisującej → transakcja wycofana, `success:false`, zero wierszy,
  kalendarz niewołany.
- **Regresja B2B:** `apps/b2b-web/tests/create-booking-concurrency.itest.ts` (9 przypadków) i
  testy jednostkowe `createBooking` przechodzą bez zmian asercji po rozbiciu funkcji (P-2).
- **Podwójne kliknięcie „Umów":** dwa żądania z tymi samymi danymi. Zachowanie się NIE zmienia
  względem dziś (dwa niezależne leady, bo `leadId` jest nowy przy każdym wywołaniu) — test
  dokumentuje, że każde z nich jest atomowe osobno. Idempotencja formularza — poza zakresem (R-2).
- **Strefa czasowa:** `data_rezerwacji` = `startAtIso` bez przeliczenia w strefie procesu, dzień
  zmiany czasu na letni (istniejący test `saveLead.booking.test.ts:310` — przenieść, nie usuwać).
- **Timeout transakcji:** Prisma domyślnie 5 s na interaktywną transakcję. Transakcja NIE może
  zawierać `findAvailableSlots`/alternatyw (to część przygotowawcza) — test statyczny albo przegląd.

## Poza zakresem

- **`B2C-PRICE-FROM`** i cały katalog produktów (`getBestsellers.ts` i sąsiedzi) — osobne zadanie.
- **Zgoda RODO** — WO 2 (`B2C-CONSENT-RODO.md`). Ten WO **nie** dodaje pola zgody do
  `SaveLeadData`; zostawia transakcję w kształcie, do którego WO 2 dopisze jeden zapis.
- **Przełączenie `lib/supabaseClient.ts` na klucz anonimowy, skan bundla, polityki RLS** — WO 3.
- **Reszta `B2C-LEAD-ENTRY`**: NOT NULL w bazie na danych kontaktowych (kryt. 5, warstwa bazy —
  schemat, 221 istniejących wierszy z kolumnami nullable), struktura `triage_answers` ze
  słownikowymi identyfikatorami (kryt. 6), `declared_property_condition` (kryt. 7–11 — kolumna nie
  istnieje), widoczność deklaracji dla audytora. Wymagają okna kontraktowego i osobnego WO.
- Sprzątanie historycznych osieroconych leadów (221 vs 1) — decyzja biznesowa, nie kod.
- Kolejkowanie wpisu do Google Calendar przez `notification_queue`.

## Ryzyka i nieznane

- **R-1 Zmiana w pakiecie współdzielonym.** Rozbicie `createBooking` dotyka panelu B2B
  (FNL-E3-E4, FLD-BOOKING-ATOMIC-ASSIGN, FNL-2PHASE-BOOKING `preferredResourceId`). Jedyną
  gwarancją braku regresji są istniejące testy `packages/scheduling` i `apps/b2b-web` — zielone
  bez zmiany asercji.
- **R-2 Brak idempotencji żądania.** Podwójne kliknięcie nadal tworzy dwa leady; atomowość tego
  nie zmienia. Klucz idempotencji formularza wymagałby kolumny/UNIQUE — osobne wymaganie.
- **R-3 „Kolejkowany po zatwierdzeniu" (kryt. 4) czytany dosłownie** wymagałby wpisu do kolejki.
  Ten WO realizuje obserwowalny skutek (awaria kalendarza nie wycofuje i nie osieraca) wywołaniem
  po zatwierdzeniu. Jeżeli recenzent uzna, że kryterium wymaga kolejki, to jest zadanie dla
  `notification-architect` — do rozstrzygnięcia w review, nie w pętli GREEN.
- **R-4 Testy `*.itest.ts` lokalnie się nie wykonają** bez `supabase start`/Dockera
  (`tools/vitest-integration-db-guard.mjs`). Dowód domknięcia AC2 (krok rezerwacji) i AC5 to
  przebieg joba `integracja` w CI z liczbą wykonanych testów > 0 — ten sam reżim co
  `B2C-BOOKING-SLOT`.
- **R-5 Numery `K-`/`A-`/`L-` z sekwencji** (`client_number`, `address_number`,
  `project_number`) są zużywane przez wycofane iteracje P-2 — sekwencje Postgresa nie cofają się
  przy ROLLBACK. Skutek: dziury w numeracji. Nie jest to błąd, ale ktoś to zauważy w panelu.

## Kolejność ról

1. `test-author` — RED: nowe testy AC1–AC9; przepisanie `saveLead.test.ts` i
   `saveLead.booking.test.ts` z mocka `supabase` na Prismę (AC10), zastąpienie testu AC9 z
   `B2C-BOOKING-SLOT` testem AC5; **usunięcie** `tests/actions/submitFinalTriage.test.ts`.
2. `implementer-server` — `packages/scheduling` (P-2), `saveLead.ts` (P-1, P-3, P-4, P-5),
   usunięcie `submitFinalTriage` z `leads.ts`.
3. `reviewer` + `rls-security-auditor` (nowa ścieżka Prismy w publicznej Server Action = zero
   `can()`, bo nie ma sesji — to jest świadome, ale ma zostać przejrzane).
