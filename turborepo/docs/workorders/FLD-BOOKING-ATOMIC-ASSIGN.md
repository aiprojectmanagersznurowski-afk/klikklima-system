# WO: FLD-BOOKING-ATOMIC-ASSIGN — atomowa rezerwacja z natychmiastowym przypisaniem wykonawcy

**Status: NIE STARTOWAĆ RED — pięć punktów WYMAGA DECYZJI, z czego D-1 i D-2 blokują napisanie testu.**
D-1 przesądza, którego wykonawcę test ma zobaczyć na wierszu; D-2 przesądza, czy kryterium
współbieżności (jedyne, które cokolwiek tu dowodzi) da się w ogóle zaliczyć. Reszta WO jest
kompletna i po rozstrzygnięciach nadaje się do `test-author` bez dopytywania.

`risk: 'HIGH'` — potwierdzone w rejestrze (`contracts/requirements.contract.mjs:685`).

## Wymagania

- **FLD-BOOKING-ATOMIC-ASSIGN** (`contracts/requirements.contract.mjs:673-685`, `status: 'TODO'`,
  `domain: 'field'`, `risk: 'HIGH'`) — całe, 11 kryteriów akceptacji.
- Nośnik atomowości dla **FNL-E3-E4** (`:22`) i **B2C-BOOKING-SLOT** (`:539`) — ten WO ich **nie
  zamyka**. Zamyka mechanizm, na którym oba się oprą.
- **CAL-SLOT-ENGINE** (`:657-664`, `status: 'DONE'`) — wejście: `findAvailableSlots`. Jego kryterium
  „silnik NIE jest gwarancją atomowości" (`:662`) jawnie wskazuje na ten WO jako miejsce, gdzie
  gwarancja powstaje.
- **CAL-TRAVEL-BUFFER** (`:698`) — bufor stosuje silnik przed wstawieniem wiersza. Tu tylko
  konsumowany, nie implementowany.
- **CRM-BOOK-HISTORY** (`:149`) — przełożenie terminu (`reschedule_of`, `RELEASED`). **Poza zakresem.**
- **B2C-LEAD-ATOMIC** (`:538`) i **CAL-POOL-AGGREGATE** (`:666`) — **poza zakresem**, patrz „Poza
  zakresem" i ryzyko R-4 (złożenie z transakcją zewnętrzną nie jest darmowe).

## Kontekst kodu

### Istnieje (stan zmierzony 2026-09-10)

**Żywa baza — odpytana bezpośrednio przez `pg_constraint`/`pg_trigger`, nie z pliku migracji**
(ewidencja migracji w tym repo jest niewiarygodna):

- `bookings_no_overlap_per_resource` **ISTNIEJE NA ŻYWEJ BAZIE**:
  `EXCLUDE USING gist (resource_id WITH =, tstzrange(scheduled_start, scheduled_end, '[)') WITH &&)
  WHERE (status = ANY (ARRAY['RESERVED','CONFIRMED']))`. Rozszerzenie `btree_gist` zainstalowane.
- Pozostałe ograniczenia `bookings` na żywo: `bookings_one_subject`, `bookings_one_assignee`,
  `bookings_resource_kind_check`, `bookings_status_check` (`RESERVED|CONFIRMED|RELEASED|COMPLETED`),
  `bookings_booked_by_check` (`CLIENT|DISPATCHER`), `bookings_assignment_mode_check` (`AUTO|MANUAL`),
  `bookings_time_order_check`, `bookings_reschedule_not_self`, FK `auditor_id`/`crew_id` **ON DELETE
  RESTRICT**, FK `visit_basket_id` RESTRICT, FK `lead_id`/`service_id`/`incident_id` CASCADE.
- Wyzwalacz `bookings_pool_matches_basket_trg` **ISTNIEJE** (BEFORE INSERT OR UPDATE OF
  visit_basket_id, resource_kind, auditor_id, crew_id), rzuca `ERRCODE = 'check_violation'` (23514).
- `public.bookings` ma dziś **0 wierszy**. RLS włączone, **zero polityk** (Prisma i tak omija RLS).
- `visit_duration_baskets` na żywo, 7 aktywnych wierszy: `AUDIT`/AUDITOR/120, `SERVICE`/CREW/90,
  `INCIDENT`/CREW/120, `INSTALL_SMALL`/CREW/240, `INSTALL_STANDARD`/CREW/480,
  `INSTALL_PHASE_1`/CREW/480, `INSTALL_PHASE_2`/CREW/240. **Nie ma koszyka montażu dużego (2 dni)** —
  to luka `CAL-VISIT-DURATION-BASKETS`, nie tego WO.
- `system_config.scheduling_config` na żywo: `travel_buffer_minutes: 60`, `default_workday_start
  08:00`, `default_workday_end 16:00`, `default_weekdays [1,2,3,4,5]`.

**Kod:**

- `apps/b2b-web/src/lib/schedule/available-slots.ts` — `findAvailableSlots(visitBasketId, dateRange)`
  → `AvailableSlotsResult { resources: ResourceSlots[], duration_minutes, travel_buffer_minutes,
  error }`. Czysta funkcja domenowa, bez `can()`, bez zapisu, bez `revalidatePath`. `resourceKind`
  wynika z `visit_duration_baskets.pool` (`:195`), nie z argumentu. Pula filtrowana po
  `is_active`/`aktywny` + `leave_status === 'ACTIVE'` (`:215-225`) i po
  `availability_declarations.is_available === false` (`:228-235`).
- `apps/b2b-web/src/lib/schedule/effective-availability.ts` — wzorzec przekazywania `configRow`
  z góry, żeby uniknąć N+1 (`available-slots.ts:278`).
- `apps/b2b-web/src/lib/schedule/availability-rule.ts:33` — `writeAvailabilityRuleRaw`: precedens
  **zapisu przez `$queryRaw`, gdy Prisma nie widzi kolumny `resource_id` (GENERATED)**. Tu ten sam
  problem wraca po stronie odczytu, nie zapisu (model `Booking` nie ma `resourceId`).
- Model Prisma `Booking` — `packages/database/prisma/schema.prisma:959`.
- RBAC: `contracts/rbac.contract.mjs:54` — `{ resource: 'bookings', read: ['admin','dyspozytor',
  'audytor:own','monter:own'], create: ['admin','dyspozytor'], update: ['admin','dyspozytor'],
  delete: ['admin'], assign: ['admin','dyspozytor'] }`. **Nie ma roli klienta** — `ROLES` to
  `['admin','dyspozytor','audytor','monter']`.
- Precedens transakcji: `prisma.$transaction(async (tx) => ...)` w 10 miejscach `apps/b2b-web`,
  `isolationLevel: 'Serializable'` w `settings/actions.ts:270,376` i `auditors/actions.ts:686`.
- Testy silnika: `apps/b2b-web/tests/available-slots-engine-*.test.ts` — Prisma **zamockowana**,
  mocki ignorują `where`. Konwencja: `*.test.ts` = vitest, `*.spec.ts` = Playwright
  (`vitest.config.ts`).

### Brakuje

- **Zerowy kod czytający lub piszący `bookings` w `apps/`** — potwierdzone ponownie 2026-09-10.
  Jedyne trafienia `prisma.booking.*` to odczyt w `available-slots.ts:243`. Stan z poprzedniego WO
  się nie zmienił: nie ma ani jednego producenta wierszy.
- Nie ma katalogu ani trasy `bookings` w `apps/b2b-web/src/app/(dashboard)/` — Server Action powstaje
  od zera.
- **Nie ma w repo żadnego mechanizmu testu z żywym Postgresem.** Zmierzone: jedyny workflow to
  `.github/workflows/playwright.yml` (build i Playwright dla `apps/b2c-web`, **bez `services:
  postgres`**, bez migracji, bez `supabase start`). `vitest.config.ts` nie ma setupu bazy.
  `supabase/config.toml` istnieje, więc lokalny stack CLI jest możliwy, ale **nic go nie uruchamia
  ani w `scripts/verify.sh`, ani w CI**. `verify.sh:80-82` sprawdza `DATABASE_URL` tylko po to, by
  **pominąć** porównanie schematu, gdy sekretu brak. Patrz D-2.
- Ścieżka B2C nadal nie zna `bookings`: `apps/b2c-web/app/actions/saveLead.ts:76-85` wstawia leada
  z `data_rezerwacji: dateObj.toISOString()` przez `supabase-js`, **bez jakiegokolwiek sprawdzenia
  zajętości i bez wyboru wykonawcy**; `dateObj.setHours(...)` (`:63-65`) interpretuje godzinę
  w strefie **serwera**, nie w `Europe/Warsaw`. `getFomoSlots.ts` liczy `count(*)` po
  `leady.data_rezerwacji`. To jest dokładnie antywzorzec z CLAUDE.md #4 i on tym WO **nie znika** —
  patrz D-4.
- `leady.data_rezerwacji` **nie jest usuwane** przez migrację kalendarza (komentarz na tabeli
  `bookings`: „przeniesienie danych i DROP COLUMN to osobna zmiana, po powstaniu konsumenta").
  Dziś czytają je: `getFomoSlots.ts`, `assignCrewToLead` (wymaga niepustej wartości do T05),
  `suspendLogisticsSla` (zeruje), metryka `SLA_POLICIES.LOGISTICS_INSTALL`.

## Zmiana kontraktu

**NIEWYMAGANA** dla zakresu opisanego niżej, pod trzema warunkami:

1. Rezerwacja idzie wyłącznie ścieżką B2B (`bookings.create = ['admin','dyspozytor']` już to pokrywa).
2. WO nie dotyka `schema.prisma`, `supabase/migrations/` ani `contracts/` — ograniczenie, wyzwalacz
   i kolumny **są już na żywej bazie** (zmierzone wyżej).
3. Rozstrzygnięcie D-3 nie pójdzie w stronę „ograniczenie w bazie na jedną aktywną rezerwację
   per podmiot". Gdyby poszło — potrzebny jest częściowy indeks unikalny na
   `(lead_id) WHERE status IN ('RESERVED','CONFIRMED')` i wtedy: **okno kontraktowe + rola
   `contract-steward`, nie `implementer-server`**.

Uwaga na przyszłość, poza tym WO: rezerwacja przez **klienta** (`booked_by = 'CLIENT'`) nie ma
w `MATRIX` żadnej roli, która by ją autoryzowała. `B2C-BOOKING-SLOT` będzie musiał albo rozszerzyć
kontrakt RBAC, albo jawnie zapisać, że ścieżka publiczna działa na token i nie przechodzi przez
`can()`. Nie rozstrzygam tego tutaj i nie zakładam w AC.

## Proponowana sygnatura

Ten sam podział co w `CAL-SLOT-ENGINE`: czysta warstwa domenowa + cienka Server Action z bramką.

**Warstwa domenowa** — `apps/b2b-web/src/lib/schedule/create-booking.ts` (nowy plik):

```ts
export type BookingSubject =
  | { kind: 'LEAD';     leadId: string }
  | { kind: 'SERVICE';  serviceId: string }
  | { kind: 'INCIDENT'; incidentId: string }

export type CreateBookingParams = {
  visitBasketId: string
  startAt: Date                       // UTC, moment startu wizyty
  subject: BookingSubject
  bookedBy: 'CLIENT' | 'DISPATCHER'
  alternativesRange?: { from: Date; to: Date }   // domyślnie [startAt, startAt + 14 dni]
}

export type CreateBookingErrorCode =
  | 'BASKET_NOT_FOUND' | 'BASKET_INACTIVE' | 'CONFIG_MISSING'
  | 'SLOT_NOT_OFFERED'      // startAt nie jest slotem, który silnik proponuje komukolwiek
  | 'SLOT_TAKEN'            // kandydaci byli, wszyscy przegrali wyścig (23P01)
  | 'POOL_MISMATCH'         // 23514 z bookings_pool_matches_basket_trg

export type CreateBookingResult =
  | { ok: true;  booking: BookingRow; error: null }
  | { ok: false; booking: null; error: { code: CreateBookingErrorCode; message: string; alternatives: AvailableSlot[] } }

export async function createBooking(params: CreateBookingParams): Promise<CreateBookingResult>
```

Bez `can()`, bez `revalidatePath`, bez sesji — dokładnie jak `findAvailableSlots`.
**Nie przyjmuje klienta transakcyjnego** (uzasadnienie: R-4).

**Server Action** — `apps/b2b-web/src/app/(dashboard)/bookings/actions.ts` (nowy plik; nazwa pliku
musi brzmieć `actions.ts`, inaczej `tools/kk-authz-gate.mjs` jej nie zobaczy):

```ts
export async function createBookingAction(input: unknown): Promise<CreateBookingResult>
```

Kolejność: `getCurrentActorRole()` → `can(role, 'bookings', 'create') !== 'no'` → walidacja Zod
wejścia → `createBooking(...)`. Odmowa **przed** jakimkolwiek zapytaniem do bazy. Zwraca obiekt
wyniku, nigdy `void` (odmowa musi być odróżnialna od sukcesu).

**Algorytm wyboru wykonawcy (Faza A):**

1. `findAvailableSlots(visitBasketId, { from: startAt, to: startAt })` — pula i długość wizyty
   wynikają z koszyka, bufor dojazdu, nieobecności, limit dnia są już odjęte.
2. Kandydaci = te `ResourceSlots`, których `slots[]` zawiera slot o `start_at.getTime() ===
   startAt.getTime()`. Porównanie po epoch ms, nie po stringu.
3. Brak kandydatów → `SLOT_NOT_OFFERED` + alternatywy. **Zero zapisu.**
4. Kandydaci uporządkowani regułą z **D-1**.
5. Pętla po kandydatach: pojedynczy `INSERT` na kandydata, **każdy jako osobne polecenie, poza
   transakcją**. `23P01` → następny kandydat. Sukces → zwrot.
6. Wyczerpanie listy → `SLOT_TAKEN` + alternatywy z ponownego `findAvailableSlots` po
   `alternativesRange`, obcięte do 5 pozycji, **bez ujawniania tożsamości pracownika**
   (`AvailableSlot`, nie `ResourceSlots` — CAL-POOL-AGGREGATE).

`scheduled_end = startAt + basket.duration_minutes` liczone w warstwie domenowej i utrwalone.
`resource_kind` z `basket.pool`; `auditor_id` albo `crew_id` — dokładnie jedno.

## Kryteria akceptacji (Faza A — automat, `assignment_mode = 'AUTO'`)

- [ ] **AC-A1** Udana rezerwacja tworzy **dokładnie jeden** wiersz `bookings`, który od początku
      wskazuje jednego pracownika: dokładnie jedno z `auditor_id`/`crew_id` jest niepuste,
      `status = 'RESERVED'`, `assignment_mode = 'AUTO'`, `booked_by` równe wartości z wejścia.
      Nie powstaje rezerwacja bez wykonawcy w żadnej ścieżce.
- [ ] **AC-A2** `scheduled_end` jest utrwalone i równe `scheduled_start + duration_minutes` koszyka
      **z chwili rezerwacji**. Test po zapisie zmienia `duration_minutes` koszyka i ponownie czyta
      wiersz: `scheduled_end` się **nie przesuwa**.
- [ ] **AC-A3** Pula zgadza się z typem wizyty: rezerwacja koszyka `AUDIT` ląduje na audytorze,
      koszyka `SERVICE`/`INCIDENT`/`INSTALL_*` na ekipie. Próba zapisu niezgodnej pary (wymuszona
      w teście z pominięciem wyboru automatu) kończy się `POOL_MISMATCH` — błędem domenowym
      z wyzwalacza, nie wyjątkiem 500.
- [ ] **AC-A4** **Dwa RÓWNOLEGŁE żądania na ten sam slot przy puli jednoosobowej: dokładnie jedno
      kończy się `ok: true`, drugie `ok: false, code: 'SLOT_TAKEN'`.** W bazie zostaje dokładnie
      jeden wiersz. Wywołanie sekwencyjne tego kryterium **nie zalicza** i nie może go zastąpić.
- [ ] **AC-A5** Dwa równoległe żądania na ten sam slot przy puli **dwuosobowej**: obie rezerwacje się
      udają i lądują na **różnych** pracownikach. To jest dowód, że przegrany wyścig o jednego
      kandydata nie kończy rezerwacji, dopóki pula nie jest wyczerpana.
- [ ] **AC-A6** Ograniczenie zabrania **nakładania się**, nie tylko identycznego startu: po
      rezerwacji montażu całodniowego (`INSTALL_STANDARD`, 480 min) od 08:00 na danej ekipie próba
      rezerwacji `INCIDENT` od 10:00 na **tej samej** ekipie nie kończy się zapisem — ta ekipa nie
      jest kandydatem, a przy wymuszeniu `INSERT` wynikiem jest `SLOT_TAKEN`, nigdy 500.
- [ ] **AC-A7** Styk godzinowy nie jest kolizją: wizyta 08:00–10:00 i wizyta 10:00–12:00 u tej samej
      osoby **obie** kończą się sukcesem (przedział `[)`).
- [ ] **AC-A8** `RELEASED` i `COMPLETED` nie blokują slotu: po przestawieniu istniejącej rezerwacji
      na `RELEASED` ten sam slot u tego samego pracownika daje się zarezerwować ponownie. Zwolnienie
      idzie przez zmianę statusu — **żadna ścieżka tego WO nie kasuje wiersza `bookings`**.
- [ ] **AC-A9** `startAt`, którego silnik nie proponuje, nie tworzy wiersza i zwraca
      `SLOT_NOT_OFFERED`. Test pokrywa osobno cztery powody: (a) godzina poza oknem reguły
      tygodniowej, (b) kolizja z nieobecnością, (c) naruszenie samego **bufora dojazdu** przy wolnym
      formalnie oknie, (d) wyczerpany `SLA.AUDITOR_DAILY_CAP` dla puli AUDITOR. Przypadek (c) jest
      krytyczny: **baza bufora nie egzekwuje i nigdy nie będzie** — jeżeli akcja go nie sprawdzi
      przed zapisem, wiersz powstanie i nikt tego nie zgłosi.
- [ ] **AC-A10** `SQLSTATE 23P01` nie wydostaje się z warstwy domenowej jako wyjątek. Wynik to
      obiekt `{ ok: false, code: 'SLOT_TAKEN', alternatives }`, a `alternatives` zawiera co najmniej
      jeden inny wolny termin, jeżeli taki istnieje w `alternativesRange`. Alternatywy to
      `AvailableSlot[]` — **bez `resource_id`**, klient nie poznaje tożsamości ani obłożenia
      pracownika.
- [ ] **AC-A11** Nieudana próba nie zostawia śladu: po `SLOT_TAKEN` liczba wierszy `bookings` dla
      danego podmiotu jest taka sama jak przed wywołaniem (dowód, że retry po `23P01` nie zapisuje
      częściowego stanu i nie działa w zatrutej transakcji — R-4).
- [ ] **AC-A12** `createBookingAction` wywołana z rolą `audytor` albo `monter` zwraca
      `{ ok: false }` z komunikatem o braku uprawnień i **nie wykonuje żadnego zapytania zapisującego**
      (`can(role, 'bookings', 'create') === 'no'`). Odmowa jest odróżnialna od sukcesu w typie wyniku.

## Faza B — nadpisanie przypisania przez dyspozytora (`MANUAL`)

**Osobna tura pętli, nie ta sama.** Faza A to już 12 kryteriów, z czego dwa wymagają
infrastruktury, której w repo nie ma; doklejenie Fazy B przekroczy limit trzech iteracji GREEN.
Wymaganie pozostaje `TODO` do czasu zamknięcia obu faz — to jest świadome, nie przeoczenie.

- [ ] **AC-B1** Przepięcie rezerwacji na innego pracownika ustawia `assignment_mode = 'MANUAL'`,
      więc po fakcie da się odróżnić wybór automatu od decyzji człowieka.
- [ ] **AC-B2** Przepięcie na osobę **już zajętą** w tym oknie jest odrzucane przez bazę
      (`23P01` z `UPDATE`), zamieniane na błąd domenowy — nie przez samą walidację formularza.
- [ ] **AC-B3** Przepięcie na pracownika z **niewłaściwej puli** jest odrzucane przez
      `bookings_pool_matches_basket_trg` (wyzwalacz obejmuje `UPDATE OF ... auditor_id, crew_id`).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Prawdziwa współbieżność** (AC-A4/AC-A5) — dwa żądania startujące równolegle, nie po kolei.
- **Podwójne kliknięcie / brak idempotencji** — dwa żądania na ten sam podmiot i ten sam slot przy
  puli dwuosobowej dadzą **dwie** rezerwacje dla jednego leada. Baza tego nie zabrania. Zachowanie
  do rozstrzygnięcia w D-3, ale test tego scenariusza musi istnieć niezależnie od wyniku decyzji.
- **Strefa czasowa i zmiana czasu** — `startAt` w UTC, doba limitu dziennego liczona w
  `Europe/Warsaw` (`available-slots.ts:82-84`). Obie doby zmiany czasu w zakresie testu; wizyta
  480-minutowa w dobie 23-godzinnej i 25-godzinnej.
- **Uprawnienia** — AC-A12; dodatkowo `dyspozytor` przechodzi, `admin` przechodzi.
- **Koszyk wycofany** (`is_active = false`) i koszyk nieistniejący → błąd domenowy, zero zapisu
  (silnik już to zwraca, akcja nie może tego przykryć).
- **Brak `travel_buffer_minutes`** w `scheduling_config` → fail-**closed** (`CONFIG_MISSING`),
  spójnie z `available-slots.ts:204-210`. Bufor 0 nie jest wartością domyślną.
- **Pusta pula** (wszyscy nieaktywni / na urlopie / z deklaracją niedostępności) →
  `SLOT_NOT_OFFERED`, nie wyjątek.
- **FK `ON DELETE RESTRICT`** na `auditor_id`/`crew_id`: pracownik z rezerwacją przestaje być
  usuwalny. Test kartotek tego dziś nie wie — wypisane jako skutek uboczny, nie jako AC.

## Poza zakresem

- **UI.** Żaden ekran, żaden przycisk. Ten WO produkuje funkcję i akcję, nie widok.
- **Przejścia lejka i powiadomienia.** `T03`/`T14` (`do:reserveInstallationSlot`, efekt `I2`),
  zmiana `status` leada, kolejka `notification_queue` — to `FNL-E3-E4` i `FNL-ROLLBACK-EXIT`.
  `createBooking` **nie zmienia statusu leada i nie kolejkuje niczego.**
- **Przełożenie terminu** (`reschedule_of`, przejście na `RELEASED`) — `CRM-BOOK-HISTORY`.
- **Ścieżka B2C** (klient rezerwujący, `booked_by = 'CLIENT'` z publicznego linku, agregat puli,
  atomowość lead+klient+adres+rezerwacja) — `B2C-BOOKING-SLOT`, `CAL-POOL-AGGREGATE`,
  `B2C-LEAD-ATOMIC`. `saveLead.ts` zostaje nietknięty.
- **Migracja `leady.data_rezerwacji` → `bookings`** i `DROP COLUMN` — osobna zmiana, osobne okno
  kontraktowe (patrz D-4).
- **Montaż dwudniowy** (dwa sąsiadujące dni u tej samej ekipy) — koszyka `INSTALL_LARGE` nie ma na
  żywej bazie, a wyszukiwanie dni pod rząd to inny algorytm. `CAL-VISIT-DURATION-BASKETS`.
- **Geografia** (promień działania / regiony) przy wyborze kandydata — patrz D-5.
- **Google Calendar** — faza 4 mapy Field App.

## WYMAGA DECYZJI

### D-1 (BLOKUJE RED) — reguła wyboru, gdy wolnych kandydatów jest więcej niż jeden

Dokumenty nie rozstrzygają. `FIELD-APP-PLAN.md` 6.4 R3 mówi tylko: *„system atomowo wybiera wolną
osobę i tworzy rezerwację na nią"* — **kto** jest tą osobą, nie pada. Rejestr wymagań też milczy.
Jedyna wzmianka o kryterium to 6.4b: *„nakładające się promienie naturalnie wspierają cel
sprawiedliwości"* — ale „sprawiedliwość" nie jest tam nigdzie zdefiniowana miarą.

Bez rozstrzygnięcia test-author nie ma czego zaasertować w AC-A1/AC-A5: „jakiś wolny pracownik"
nie jest obserwowalnym zachowaniem.

Warianty:
- (a) **najmniej rezerwacji w danej dobie lokalnej**, remis rozstrzygany po `id` rosnąco — równoważy
  obciążenie dnia, deterministyczny, testowalny bez dodatkowych danych;
- (b) round-robin po dacie ostatniej rezerwacji pracownika — równoważy w skali tygodnia, wymaga
  dodatkowego odczytu i jest wrażliwy na urlopy;
- (c) deterministycznie po `id` — najprostszy i najłatwiejszy do testu, ale systematycznie obciąża
  jedną osobę;
- (d) losowo — nietestowalny bez wstrzykiwania ziarna.

Rekomendacja analityka: **(a)**. Nie wybieram za człowieka — decyzja wpływa na obciążenie realnych
ludzi, a nie tylko na kształt kodu.

### D-2 (BLOKUJE RED) — czym uruchomić test współbieżności

Kryterium rejestru mówi wprost: *„Test wymaga PRAWDZIWEGO Postgresa (…). Bez bazy w CI tego
kryterium nie da się zaliczyć, a atrapa dowodzi wyłącznie tego, jak została zaprogramowana"*
(`requirements.contract.mjs:684`). `FIELD-APP-PLAN.md` 6.5 pkt 6 powtarza: *„Postgres w CI jest
warunkiem koniecznym"*.

**Stan zmierzony: takiego mechanizmu w repo nie ma.** Jedyny workflow (`playwright.yml`) nie ma
usługi bazy; `vitest.config.ts` nie ma setupu; `supabase/config.toml` istnieje, ale nikt nie
uruchamia lokalnego stacku ani w `verify.sh`, ani w CI.

Warianty:
- (a) dodać do CI job z `services: postgres` (obraz z `btree_gist`), zaaplikować
  `supabase/migrations/*.sql`, wydzielić osobny projekt vitest dla testów integracyjnych
  (np. `*.itest.ts`) — **to jest osobna praca infrastrukturalna, prawdopodobnie osobny WO i inna
  rola**, i trwa dłużej niż samo wymaganie;
- (b) test uruchamiany wyłącznie lokalnie na `supabase start`, w CI pomijany — wtedy AC-A4/AC-A5
  nie są pilnowane przez bramkę i wymaganie zamyka się na słowo, czego to konkretne kryterium
  jawnie zabrania;
- (c) test na żywej bazie deweloperskiej — **odradzam stanowczo**: `bookings` ma dziś 0 wierszy, ale
  `audytorzy`/`zespoly_monterskie` zawierają prawdziwe kartoteki, a FK są `RESTRICT`; test
  zostawiłby po sobie wiersze wiążące realnych ludzi.

Bez tej decyzji Faza A da się napisać najwyżej w części niewspółbieżnej — czyli bez jedynego
kryterium, które w tym obszarze cokolwiek dowodzi.

### D-3 — czy jeden podmiot może mieć więcej niż jedną aktywną rezerwację

Nic w kontrakcie ani w dokumentach tego nie rozstrzyga, a `bookings_one_subject` pilnuje wyłącznie
tego, że wiersz dotyczy jednej rzeczy — nie tego, że rzecz ma jeden wiersz. Skutek: podwójne
kliknięcie przy puli dwuosobowej tworzy dwie rezerwacje jednego leada u dwóch pracowników i żadna
warstwa tego nie zauważy. Jednocześnie `CRM-BOOK-HISTORY` **wymaga** wielu wierszy na jeden podmiot
(łańcuch przekładań), więc „jeden wiersz per lead" jest wykluczone — pytanie brzmi wyłącznie
o wiersze w statusach `RESERVED`/`CONFIRMED`.

Warianty: (a) sprawdzenie w kodzie akcji (tanie, nieszczelne przy współbieżności — dokładnie ta
klasa błędu, którą to wymaganie zwalcza); (b) częściowy indeks unikalny w bazie → **okno kontraktowe
i `contract-steward`**; (c) świadomie dopuścić i obsłużyć po stronie UI.

### D-4 — czy `createBooking` zapisuje również `leady.data_rezerwacji`

Migracja mówi, że `bookings` jest *„docelowo JEDYNYM źródłem prawdy o terminach"*, ale kolumny nie
usuwa i odsyła do *„osobnej zmiany, po powstaniu konsumenta"*. Dziś na `data_rezerwacji` wisi:
FOMO w B2C, warunek wejścia do T05 w `assignCrewToLead`, zerowanie w `suspendLogisticsSla`, metryka
`SLA_POLICIES.LOGISTICS_INSTALL`.

Konsekwencja braku decyzji: rezerwacja utworzona nową ścieżką **nie odblokuje przypisania ekipy
i nie pojawi się w liczniku FOMO** — funkcja będzie poprawna i bezużyteczna. Podwójny zapis z kolei
wprowadza dwa źródła prawdy o tym samym terminie, czyli dokładnie to, co migracja chciała zlikwidować.
Rekomendacja: **nie pisać podwójnie w tym WO**, a przeniesienie konsumentów zarejestrować jako osobne
wymaganie — ale to jest decyzja o kolejności prac, nie o kodzie, i należy do człowieka.

### D-5 — filtr geograficzny przy wyborze kandydata (sprzeczność modeli, nierozstrzygnięta)

`FIELD-APP-PLAN.md` 6.4b nazywa to wprost konfliktem: *„schemat i kontrakt implementują dwa różne
modele przydzielania"* — regionowy (`CRM-REGION-AUTO`: `regions`, `region_postal_codes`) kontra
promieniowy (schemat: `kod_pocztowy_bazowy` + `promien_dzialania_km`). Dokument **rekomenduje**
promieniowy, ale zaznacza, że koszt to przepisanie kryteriów `CRM-REGION-AUTO`. Tabela `regions`
nie istnieje.

W tym WO przyjmuję, że **wybór kandydata nie filtruje geograficznie** — bo `findAvailableSlots` też
nie filtruje, więc nic się nie rozjedzie. Ale jeżeli D-1 miałoby brzmieć „najbliższy pracownik",
to D-5 trzeba rozstrzygnąć **przed** D-1. Nie wybieram modelu.

## Ryzyka i nieznane

- **R-1 `ON CONFLICT` nie działa z ograniczeniem wykluczającym.** Postgres wspiera `ON CONFLICT`
  wyłącznie dla indeksów unikalnych. Jedyną drogą jest przechwycenie `23P01` — implementer, który
  odruchowo napisze `ON CONFLICT DO NOTHING`, dostanie błąd składni, a nie ciche przejście.
- **R-2 Prisma nie widzi `resource_id`** (kolumna `GENERATED ALWAYS AS`). Model `Booking` nie ma
  tego pola, więc filtrowanie „czym zajęty jest zasób" idzie po `auditorId`/`crewId` albo przez
  `$queryRaw`. Precedens zapisu raw: `availability-rule.ts:33`.
- **R-3 Kod błędu z Prismy.** `23P01` przychodzi jako `PrismaClientKnownRequestError` z `code:
  'P2010'` (raw) albo jako błąd bez mapowania — rozpoznanie musi iść po `meta.code`/`23P01`
  w treści, nie po `P2002`. To jest pierwszy taki przypadek w repo; nie ma wzorca do skopiowania.
- **R-4 Nieudany `INSERT` zatruwa transakcję.** Po błędzie polecenie w otwartej transakcji Postgres
  przechodzi w stan aborted i każde kolejne polecenie kończy się `25P02`, dopóki nie ma
  `SAVEPOINT`. Prisma w `$transaction(async tx => …)` nie udostępnia savepointów. **Dlatego pętla
  po kandydatach musi działać POZA transakcją** i dlatego `createBooking` **nie przyjmuje `tx`**.
  To bezpośrednio uderza w `B2C-LEAD-ATOMIC`, które chce wszystkie cztery zapisy w jednej
  transakcji — tamten WO będzie musiał albo ustalić kandydata przed otwarciem transakcji, albo
  zejść do `$executeRaw` z jawnymi savepointami. Wypisane, żeby nie odkryć tego w środku tamtej
  tury.
- **R-5 Podwójny odczyt `system_config` i N+1.** `findAvailableSlots` czyta `scheduling_config` przy
  każdym wywołaniu, a `createBooking` woła je dwukrotnie (kandydaci + alternatywy) i wewnątrz
  `getEffectiveAvailability` jest pętla po puli. Przy 20 pracownikach i 14-dniowym horyzoncie
  alternatyw jedno nieudane żądanie to kilkadziesiąt zapytań. Do zmierzenia, nie do zgadywania.
- **R-6 Horyzont alternatyw jest zgadywany.** `FIELD-APP-PLAN.md` R5 (granulacja i horyzont) jest do
  dziś **NIEROZSTRZYGNIĘTY** („Dziś: 2-godzinne okna, 60 dni. Do potwierdzenia jako świadoma
  decyzja, nie zastana"). Domyślne 14 dni w `alternativesRange` to wartość robocza tego WO, nie
  decyzja — nie utrwalać jej w kontrakcie ani w SLA.
- **R-7 Ewidencja migracji.** Ograniczenie i wyzwalacz potwierdzone **na żywo** 2026-09-10, nie
  z pliku. Jeżeli test integracyjny stawia bazę od zera (D-2 wariant a), musi zaaplikować migracje
  z repo — i wtedy zaczyna zależeć od tego, czy `supabase/migrations/*.sql` jest kompletne,
  co w tym repo nie jest oczywiste.
- **R-8 Brak konsumenta.** Po zamknięciu Fazy A w systemie nie będzie ani jednego miejsca
  wywołującego `createBookingAction` (patrz D-4). Funkcja poprawna i nieużywana to stan przejściowy
  do zaakceptowania świadomie, nie efekt uboczny do odkrycia w REVIEW.

## Kolejność ról

1. **Człowiek** — D-1 i D-2 (blokujące), D-3/D-4/D-5 (kierunkowe).
2. **(opcjonalnie) osobny WO infrastrukturalny** — Postgres dla testów integracyjnych, jeżeli D-2
   pójdzie wariantem (a).
3. `test-author` — testy Fazy A. Sygnatura z sekcji „Proponowana sygnatura" jest **kontraktem
   między testem a implementerem**: inny kształt wybrany przez implementera to `TEST-DEFECT`
   do zgłoszenia, nie powód do cichej zmiany testu.
4. `implementer-server` — `create-booking.ts` + `bookings/actions.ts`. **Bez dotykania**
   `contracts/`, `schema.prisma`, `supabase/migrations/` (nic tam nie brakuje).
5. `reviewer` + `rls-security-auditor` — bramka `bookings.create`, brak wycieku `resource_id`
   w alternatywach.
6. Faza B (`MANUAL`) — osobna tura.
