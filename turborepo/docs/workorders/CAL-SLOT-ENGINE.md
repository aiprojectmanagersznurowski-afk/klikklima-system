# WO: CAL-SLOT-ENGINE — silnik wolnych terminów (odejmowanie)

Data: 2026-09-10
Status wymagania w rejestrze: TODO, domain `field`, risk **HIGH**
Pochodzenie: wyodrębnione 2026-09-10 z `FLD-AVAIL-WEEKLY-RULES` (dawne AC7) w oknie kontraktowym, commit `ec79ead`.

## Cel

Powstaje czysta funkcja serwerowa, która dla **zadanej puli** (`AUDITOR` albo `CREW`), **zadanego koszyka
wizyty** (`visit_basket_id`) i **zadanego zakresu dat** zwraca listę konkretnych, wykonalnych terminów
— osobno dla każdego pracownika puli.

```
wolny termin = reguła dnia (FLD-AVAIL-WEEKLY-RULES)
             − nieobecność (absences)
             − istniejąca rezerwacja (bookings RESERVED/CONFIRMED)
             − bufor dojazdu (system_config.scheduling_config.travel_buffer_minutes)
             − dzienny limit wizyt (SLA.AUDITOR_DAILY_CAP)
```

Warstwa 1 (reguły cykliczne + materializacja okna dnia) **istnieje i nie jest przedmiotem tego WO** —
to wejście silnika. Silnik **niczego nie zapisuje**: nie tworzy rezerwacji, nie blokuje slotów,
nie rezerwuje wstępnie.

## Wymagania

- Główne: `CAL-SLOT-ENGINE`
- Wejście (gotowe, DONE): `FLD-AVAIL-WEEKLY-RULES`
- Konsumenci (NIE realizowane tutaj): `CAL-POOL-AGGREGATE` (suma puli dla klienta),
  `FLD-BOOKING-ATOMIC-ASSIGN` (zapis wiersza i atomowość), `B2C-BOOKING-SLOT`, guard `slotAvailable` (`T03`)
- Wartości źródłowe (NIE realizowane tutaj): `CAL-TRAVEL-BUFFER`, `CAL-VISIT-DURATION-BASKETS`

## Kontekst kodu (zweryfikowany 2026-09-10)

### Istnieje

- `apps/b2b-web/src/lib/schedule/effective-availability.ts` — `getEffectiveAvailability(resourceId, resourceKind, dateRange)`.
  Zwraca `days[]` z `date`, `weekday` (ISO), `available`, `start_time`/`end_time` (lokalne HH:MM),
  `start_at`/`end_at` (**już UTC**, przez `fromZonedTime`, `Europe/Warsaw`), `source` (`RULE` | `RULE_INACTIVE` | `DEFAULT` | `NONE`).
  Konwencja do naśladowania: czysta funkcja bez sprawdzania uprawnień, wynik `{ …, error: string | null }`.
  **Uwaga wydajnościowa:** ta funkcja wykonuje 2 zapytania na wywołanie, w tym `system_config.findUnique`
  na `scheduling_config` — wywołanie jej w pętli po 8 pracownikach to 16 zapytań, z czego 8 zbędnych
  (patrz AC-P4).
- `apps/b2b-web/src/lib/schedule/availability-rule.ts`, `availability-rule-schema.ts` — blok A poprzedniego WO.
- Tabela `public.bookings` (migracja `20260910100000_fld_calendar_foundation.sql`):
  `scheduled_start`/`scheduled_end` (`timestamptz`, UTC, `scheduled_end` **utrwalone**), `status`
  (`RESERVED` domyślnie, dalej `CONFIRMED`/`RELEASED`/`COMPLETED`/…), `auditor_id`/`crew_id`
  (CHECK `bookings_one_assignee`), `resource_kind`, `visit_basket_id`.
  Ograniczenie `bookings_no_overlap_per_resource` — `EXCLUDE USING gist (resource_id WITH =,
  tstzrange(scheduled_start, scheduled_end, '[)') WITH &&) WHERE (status IN ('RESERVED','CONFIRMED'))`.
  **Przedział domknięty z lewej, otwarty z prawej — styk godzinowy nie jest kolizją.**
- Tabela `public.absences` — `starts_at`/`ends_at` (`timestamptz`), `reason`
  (`VACATION`/`SICK_LEAVE`/`VEHICLE_FAILURE`/`OTHER`), `auditor_id`/`crew_id`.
  **Brak ograniczenia wykluczającego** — nakładające się nieobecności są legalne (suma mnogościowa blokad).
- Tabela `public.visit_duration_baskets` — `code` (UNIQUE), `duration_minutes` (**minuty, Int**),
  `pool` (`AUDITOR`/`CREW`), `is_active`, `sort_order`.
- `system_config`, wiersz `typ_konfiguracji = 'scheduling_config'`:
  `{ travel_buffer_minutes: 60, default_workday_start: "08:00", default_workday_end: "16:00", default_weekdays: [1,2,3,4,5] }`.
- `SLA.AUDITOR_DAILY_CAP = { count: 5 }` w `contracts/sla.contract.mjs` (linia 35) oraz w wygenerowanym
  `packages/contracts/src/generated/sla.ts`. **Istnieje — nowej stałej dodawać nie trzeba.**
- Modele Prisma: `Booking`, `Absence`, `VisitDurationBasket`, `AvailabilityRule`, `AvailabilityDeclaration`.
- Pola kwalifikujące pracownika do puli: `audytorzy.is_active` + `audytorzy.leave_status`,
  `zespoly_monterskie.aktywny` + `zespoly_monterskie.leave_status` (**dwie różne nazwy flagi aktywności
  w dwóch tabelach** — jedno pojęcie, dwie kolumny), oraz `availability_declarations.is_available`
  (brak wiersza = dostępny).

### Brakuje

- Jakiegokolwiek kodu czytającego `bookings`, `absences` albo `visit_duration_baskets` w `apps/`
  (poza `getFomoSlots()`, który **nie jest silnikiem dostępności** — to licznik marketingowy,
  FIELD-APP-PLAN 6.1; nie rozbudowywać go i nie mylić z tym silnikiem).
- Odczytu `travel_buffer_minutes` — `effective-availability.ts` czyta `scheduling_config`,
  ale ignoruje ten klucz.
- Jakiegokolwiek odczytu `SLA` w `apps/b2b-web/src/lib/schedule/`.
- **Parametru granulacji siatki slotów** — nie ma go ani w kontrakcie, ani w `scheduling_config`
  (patrz „WYMAGA DECYZJI D1”).

## Zmiana kontraktu

**Odpowiedź wprost: NIE — pod warunkiem rozstrzygnięcia D1 wariantem (a) i D2 wariantem (a).**

- `SLA.AUDITOR_DAILY_CAP` **już istnieje** (`count: 5`). Nowa stała SLA **nie jest potrzebna**.
- `travel_buffer_minutes` i długości koszyków są **danymi operacyjnymi**, nie progami SLA —
  z definicji nie należą do `contracts/sla.contract.mjs` (`CAL-VISIT-DURATION-BASKETS`, AC1).
- Kryteria akceptacji dla `CAL-SLOT-ENGINE` są w rejestrze kompletne (6 pozycji, linie 657–664).
- RBAC: silnik jest czystą funkcją bez sprawdzania uprawnień (jak `getEffectiveAvailability`);
  bramkę stawia warstwa wywołująca. Nowy zasób w `rbac.contract.mjs` nie powstaje.

**Zmiana kontraktu STAJE SIĘ wymagana, jeżeli człowiek rozstrzygnie:**

- D1 wariantem (b) — nowy klucz `slot_granularity_minutes` w `scheduling_config` to **migracja**
  (`supabase/migrations/`), czyli okno kontraktowe i rola `contract-steward`, nie implementer.
- D2 wariantem (b) — dzienny limit dla ekip montażowych wymagałby **nowej stałej SLA**
  (`CREW_DAILY_CAP`) w `contracts/sla.contract.mjs`. To jest zmiana kontraktu i osobne okno.

## Proponowana sygnatura

Zgodna z konwencją `effective-availability.ts` (czysta funkcja, wynik z polem `error`):

```ts
// apps/b2b-web/src/lib/schedule/available-slots.ts
export type AvailableSlot = {
  start_at: Date          // UTC
  end_at: Date            // UTC, = start_at + basket.duration_minutes
  date: string            // data LOKALNA (Europe/Warsaw), YYYY-MM-DD — nie data UTC
}

export type ResourceSlots = {
  resource_id: string
  resource_kind: 'AUDITOR' | 'CREW'
  slots: AvailableSlot[]
}

export type AvailableSlotsResult = {
  resources: ResourceSlots[]
  duration_minutes: number       // z koszyka, dla weryfikowalności wyniku
  travel_buffer_minutes: number  // z konfiguracji, dla weryfikowalności wyniku
  error: string | null
}

export async function findAvailableSlots(
  visitBasketId: string,
  dateRange: { from: Date; to: Date },
): Promise<AvailableSlotsResult>
```

**`resourceKind` NIE jest parametrem wejściowym** — pula wynika z `visit_duration_baskets.pool`
dla podanego koszyka. To ta sama zasada, którą `CAL-POOL-AGGREGATE` stawia dla warstwy klienta
(„żądanie wskazujące pulę wprost jest ignorowane po stronie serwera”), i tańsza do utrzymania,
gdy egzekwuje ją już silnik. Parametr `resourceKind` sprzeczny z koszykiem byłby trzecim miejscem,
w którym ta sama informacja może się rozjechać (obok `bookings.resource_kind` i triggera
`bookings_pool_matches_basket_trg`).

## Kryteria akceptacji

### P. Pula i kształt wyniku

- [ ] **AC-P1** Wynik jest **per-pracownik**: `resources[]` zawiera osobny wpis dla każdego
      kwalifikującego się pracownika puli, z jego identyfikatorem. Scalanie, deduplikacja
      i ukrycie tożsamości należą do `CAL-POOL-AGGREGATE` i **tutaj nie powstają**.
      Test sprawdza, że przy dwóch pracownikach z tym samym wolnym oknem wynik ma **dwa** wpisy,
      a nie jeden.
- [ ] **AC-P2** Pula dobierana jest z `visit_duration_baskets.pool` dla podanego koszyka:
      koszyk `AUDIT` daje wyłącznie audytorów, koszyk `INSTALL_STANDARD` wyłącznie ekipy.
      Test wywołuje silnik dla obu koszyków i sprawdza rozłączność zbiorów zwróconych identyfikatorów.
- [ ] **AC-P3** Z puli wypadają, z **trzech rozłącznych powodów sprawdzanych osobno**
      (te same, co w `CRM-REGION-AUTO`): flaga aktywności `false` (`audytorzy.is_active`
      albo `zespoly_monterskie.aktywny` — nazwa kolumny różni się między tabelami),
      `leave_status` inny niż `ACTIVE`, `availability_declarations.is_available = false`.
      Brak wiersza w `availability_declarations` znaczy **dostępny** (fail-open) — test
      obejmuje pracownika bez ani jednego wiersza deklaracji.
- [ ] **AC-P4** Liczba zapytań do bazy **nie rośnie z liczbą dni zakresu ani z liczbą slotów**,
      a `absences`, `bookings` i `visit_duration_baskets` ładowane są **jednym zapytaniem
      na całą pulę i cały zakres**. `scheduling_config` czytany jest **raz na wywołanie**,
      nie raz na pracownika. Test na kalendarzu 30-dniowym i puli 5 pracowników liczy zapytania
      (licznik na kliencie Prisma) i porównuje z tym samym testem dla 60 dni i 10 pracowników:
      wzrost liczby zapytań z liczbą DNI jest defektem.
- [ ] **AC-P5** Pusty wynik jest **poprawnym wynikiem**, nie błędem: pula bez ani jednego wolnego
      terminu zwraca `resources` z pustymi listami `slots` i `error === null`.
      `error` rezerwujemy dla stanów niemożliwych do wyliczenia (AC-E1, AC-E2).

### D. Długość wizyty i siatka

- [ ] **AC-D1** Długość slotu pochodzi wyłącznie z `visit_duration_baskets.duration_minutes`
      dla podanego `visitBasketId`. Test **podmienia** wartość w słowniku (np. 120 → 180)
      i oczekuje, że `end_at - start_at` się zmieni. Wartości 120/90/240/480 nie występują
      jako literały w kodzie silnika (test statyczny na plikach `src/lib/schedule/`).
- [ ] **AC-D2** Slot mieści się **w całości** w oknie dnia z reguły: przy oknie 08:00–16:00
      i koszyku 480 min istnieje dokładnie jeden slot (08:00–16:00), a przy koszyku 481 min — zero.
      Slot nigdy nie przekracza końca okna ani nie przechodzi na następny dzień.
- [ ] **AC-D3** Dzień z `available === false` w `getEffectiveAvailability` (`RULE_INACTIVE` albo
      `NONE`) nie generuje ani jednego slotu — silnik nie „domyśla się” okna dla dnia bez reguły.
- [ ] **AC-D4** Nieaktywny koszyk (`is_active = false`) jest odrzucany kontrolowanym błędem
      domenowym (`error`), nie wyjątkiem i nie cichą listą slotów: rezerwacja koszyka wycofanego
      ze słownika jest błędem wywołania, a nie brakiem terminów.
- [ ] **AC-D5** Nieistniejący `visitBasketId` daje kontrolowany `error`, nigdy
      `undefined.duration_minutes`.

### A. Odjęcie nieobecności (`absences`)

- [ ] **AC-A1** Nieobecność nakładająca się na slot **usuwa go**: pracownik z regułą 8–16
      i nieobecnością 10:00–12:00 nie dostaje slotu 10:00–12:00 ani żadnego innego
      przecinającego to okno.
- [ ] **AC-A2** Nieobecność całodniowa (albo wielodniowa) usuwa **wszystkie** sloty objętych dni,
      a dni poza jej zakresem zostawia nietknięte. Test obejmuje nieobecność przechodzącą
      przez granicę doby.
- [ ] **AC-A3** **Styk nie jest kolizją**, tak samo jak w bazie: nieobecność kończąca się
      dokładnie o 10:00 nie usuwa slotu 10:00–12:00, a zaczynająca się dokładnie o 12:00
      nie usuwa slotu 10:00–12:00. Przedział domknięty z lewej, otwarty z prawej.
- [ ] **AC-A4** **Nakładające się nieobecności** (dwa wiersze na to samo okno — legalne, baza
      ich nie zabrania) dają ten sam wynik, co jedna: brak podwójnego odejmowania,
      brak wyjątku, brak zduplikowanego slotu.
- [ ] **AC-A5** Bufor dojazdu **NIE jest** doliczany wokół nieobecności: nieobecność nie jest
      wizytą pod adresem, więc dojazd od niej nie ma sensu. Test: nieobecność 08:00–10:00
      przy buforze 60 min zostawia slot zaczynający się o 10:00.

### B. Odjęcie rezerwacji (`bookings`)

- [ ] **AC-B1** Rezerwacja w statusie `RESERVED` albo `CONFIRMED` usuwa nakładające się sloty
      tego pracownika. Test sprawdza oba statusy osobno.
- [ ] **AC-B2** Rezerwacja w statusie `RELEASED` albo `COMPLETED` **nie blokuje** slotu —
      dokładnie ten sam zbiór statusów, co w `bookings_no_overlap_per_resource`. Silnik
      proponujący mniej niż baza dopuszcza to utrata terminów; proponujący więcej — obietnica
      bez pokrycia.
- [ ] **AC-B3** Rezerwacja u **innego** pracownika nie usuwa slotu temu pracownikowi:
      odejmowanie jest per-osoba, nigdy globalne.
- [ ] **AC-B4** Porównanie prowadzone jest w UTC na `scheduled_start`/`scheduled_end`
      (utrwalone wartości z bazy), a nie na przeliczonych na nowo z koszyka — zmiana
      `duration_minutes` w słowniku po fakcie **nie przesuwa** blokady istniejącej rezerwacji.
- [ ] **AC-B5** Styk godzinowy: rezerwacja 08:00–10:00 zostawia slot 10:00–12:00 wolnym
      (z zastrzeżeniem bufora, AC-T1) — silnik nie może być ostrzejszy od bazy w tym punkcie
      z innego powodu niż bufor.

### T. Bufor dojazdu

- [ ] **AC-T1** Slot **nie jest proponowany**, jeżeli zaczyna się mniej niż
      `travel_buffer_minutes` po zakończeniu poprzedniej wizyty tej samej osoby.
      Przy buforze 60 min i rezerwacji 08:00–10:00 slot 10:00–12:00 **nie** jest proponowany,
      a slot 11:00–13:00 **jest** (wartość graniczna liczona z konfiguracji, nie z liczby w teście).
- [ ] **AC-T2** Symetrycznie „od tyłu”: slot kończący się mniej niż `travel_buffer_minutes`
      przed początkiem następnej wizyty tej samej osoby nie jest proponowany.
      Test ustawia rezerwację 14:00–16:00 i sprawdza, że slot 12:30–14:00 znika, a 11:00–13:00 zostaje.
- [ ] **AC-T3** Bufor **nie jest** wymagany na krawędziach okna pracy: pierwszy slot dnia może
      zaczynać się dokładnie o godzinie startu reguły, a ostatni kończyć dokładnie o jej końcu.
      Bufor jest odległością między dwiema wizytami, nie marginesem doby.
- [ ] **AC-T4** Bufor liczony jest **wyłącznie między wizytami TEJ SAMEJ osoby**: rezerwacja
      innego pracownika o 09:00 nie odsuwa slotu 10:00 temu pracownikowi.
- [ ] **AC-T5** Wartość bufora czytana jest z `system_config.scheduling_config.travel_buffer_minutes`.
      Test podmienia ją (60 → 30) i oczekuje, że slot wcześniej odrzucony zostanie zaproponowany.
      Literał `60` nie występuje w kodzie silnika.
- [ ] **AC-T6** Bufor stosuje **wyłącznie silnik**. Test bufora celuje w wynik silnika
      (albo w akcję rezerwującą), nigdy w wyjątek z bazy — `bookings_no_overlap_per_resource`
      bufora nie zna i nigdy nie będzie znać.

### C. Dzienny limit wizyt

- [ ] **AC-C1** Wartość limitu pochodzi z `SLA.AUDITOR_DAILY_CAP.count` (`@repo/contracts`).
      Literał `5` nie występuje w kodzie silnika (test statyczny).
- [ ] **AC-C2** Dzień, w którym pracownik ma już `AUDITOR_DAILY_CAP` wizyt w statusach
      `RESERVED`/`CONFIRMED`, **nie generuje ani jednego slotu**, nawet jeżeli w oknie
      pracy zostaje wolne miejsce. Test: 5 krótkich rezerwacji w oknie 8–16 → zero slotów tego dnia.
- [ ] **AC-C3** Dzień z `cap − 1` wizytami generuje sloty normalnie (z zachowaniem A/B/T):
      limit odcina dopiero po osiągnięciu, nie przed.
- [ ] **AC-C4** Limit liczony jest na **dobę LOKALNĄ (Europe/Warsaw)**, nie na dobę UTC.
      Test w czasie letnim (UTC+2) ustawia rezerwację o 23:30 czasu lokalnego i sprawdza,
      że wlicza się do dnia lokalnego, a nie do następnego dnia UTC.
- [ ] **AC-C5** Limit liczony jest **per pracownik i per doba**, nie narastająco po zakresie:
      wyczerpanie limitu w poniedziałek nie odcina wtorku.
- [ ] **AC-C6** Do limitu liczą się rezerwacje w statusach `RESERVED`/`CONFIRMED`;
      `RELEASED`/`COMPLETED` nie (spójnie z AC-B2). `COMPLETED` liczone do capa odcinałoby
      terminy w przeszłych dniach bez powodu.
- [ ] **AC-C7** Limit stosuje się do puli, dla której stała istnieje. Rozstrzygnięcie zakresu
      dla puli `CREW` — patrz „WYMAGA DECYZJI D2”; do czasu decyzji kryterium testuje wyłącznie
      pulę `AUDITOR`.

### S. Strefa czasowa i granice

- [ ] **AC-S1** Okno dnia bierze się z `getEffectiveAvailability` (już zmaterializowane do UTC
      przez `fromZonedTime`), a porównania z `bookings`/`absences` prowadzone są w UTC.
      Silnik **nie robi własnej arytmetyki offsetów**.
- [ ] **AC-S2** Obie doby zmiany czasu są w zakresie testu: **2026-03-29** (23 h) i **2026-10-25**
      (25 h). Reguła 8–16 daje w obie doby sloty o lokalnym starcie 08:00, mimo różnej liczby
      godzin UTC. Test sprawdza godzinę **lokalną** startu pierwszego slotu, nie UTC.
- [ ] **AC-S3** Pole `date` w wyniku to data **lokalna** (Europe/Warsaw), nie `toISOString().slice(0,10)`
      na `start_at` — dla wizyty o 01:00 czasu lokalnego te dwie wartości się różnią i pomyłka
      przesuwa slot o dzień w interfejsie klienta.

### E. Stany błędne

- [ ] **AC-E1** Brak wiersza `scheduling_config` (albo brak/niepoprawny `travel_buffer_minutes`)
      daje kontrolowany `error` i **pustą** listę slotów. Silnik **nie przyjmuje bufora 0**
      jako wartości domyślnej: bufor 0 oznaczałby propozycję terminów fizycznie niewykonalnych,
      czyli dokładnie skutek, przed którym `CAL-TRAVEL-BUFFER` ma chronić. Tu obowiązuje
      fail-closed — odwrotnie niż fail-open przy braku reguł dostępności (AC-B2 poprzedniego WO).
      Ta asymetria jest świadoma i musi mieć własny test.
- [ ] **AC-E2** `error` z `getEffectiveAvailability` dla któregokolwiek pracownika jest
      **propagowany**, a ten pracownik nie wnosi slotów — nie jest cicho pomijany jako
      „bez terminów”.
- [ ] **AC-E3** Zakres dat odwrócony (`to < from`) daje pustą listę i `error`, nigdy pętli
      nieskończonej ani wyniku dla zera dni udającego sukces.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Każdy składnik odejmowania osobno** (wprost z kryterium rejestru): pracownik z regułą 8–16
  i kolejno — samą nieobecnością, samą rezerwacją, samą sąsiadującą wizytą w odstępie mniejszym
  niż bufor, samym wyczerpanym limitem dnia. Zielony wynik na jednym składniku nie dowodzi pozostałych.
- **Wszystkie składniki naraz** na jednym dniu — kolejność odejmowania nie może zmieniać wyniku.
- Obie doby zmiany czasu (AC-S2) i doba lokalna kontra doba UTC przy limicie (AC-C4).
- Styk godzinowy w trzech miejscach: nieobecność/slot (AC-A3), rezerwacja/slot (AC-B5),
  bufor dokładnie równy `travel_buffer_minutes` (wartość graniczna: równo bufor = dopuszczone,
  bufor minus minuta = odrzucone).
- Nakładające się nieobecności (AC-A4) — baza ich nie zabrania, więc silnik musi je znieść.
- Pracownik bez ani jednej reguły (fallback `DEFAULT` z `scheduling_config`) obok pracownika
  z regułami — oba muszą trafić do wyniku z właściwym oknem.
- Koszyk całodniowy (480 min) w oknie 08:00–16:00: dokładnie jeden slot, a jakakolwiek rezerwacja
  tego dnia zeruje ten dzień (bufor sprawia, że nic się już nie zmieści).
- Pusta pula (zero aktywnych pracowników): `resources: []`, `error === null`, bez wyjątku.
- **Idempotencja odczytu:** dwa wywołania z tymi samymi danymi dają identyczny wynik w identycznej
  kolejności (sloty posortowane rosnąco po `start_at`, pracownicy w deterministycznej kolejności).
  Kolejność zwrócona przez bazę bez `ORDER BY` nie jest deterministyczna, a niestabilna kolejność
  slotów daje klientowi przeskakującą listę terminów.

## Poza zakresem (jawnie, dla review)

- **Atomowość rezerwacji.** Między wyliczeniem slotu a zapisem mieści się drugie żądanie.
  Nośnikiem gwarancji jest `bookings_no_overlap_per_resource` (`EXCLUDE USING gist`) i wymaganie
  `FLD-BOOKING-ATOMIC-ASSIGN`. **Review nie może oczekiwać od tego WO testu dwóch równoległych
  żądań ani żadnej blokady.** Silnik ma nie proponować slotów, które baza i tak odrzuci —
  i nic ponadto. Zaufanie samemu silnikowi jest błędem.
- **Scalanie i anonimizacja wyniku puli** — `CAL-POOL-AGGREGATE`. Tutaj wynik jest per-pracownik,
  z jawnymi identyfikatorami. Widok klienta, ukrycie tożsamości i obłożenia oraz deduplikacja
  identycznych okien powstają tam.
- **Zapis rezerwacji, wybór osoby z puli, `assignment_mode`, błąd domenowy „slot zajęty”
  z listą alternatyw** — `FLD-BOOKING-ATOMIC-ASSIGN`.
- **Dobór po odległości / promieniu działania** (`CRM-REGION-AUTO`) — silnik nie filtruje puli
  po adresie zlecenia. Ten wymiar dojdzie osobno; sygnatura go dziś nie przyjmuje.
- **Horyzont rezerwacji** (dziś 60 dni, R5 w FIELD-APP-PLAN) — zakres dat jest **parametrem
  wywołania**, silnik nie zna ani nie egzekwuje horyzontu.
- **Edycja słownika koszyków i wartości bufora w panelu B2B** — `CAL-VISIT-DURATION-BASKETS`,
  `CAL-TRAVEL-BUFFER`.
- **Wpisywanie nieobecności** (formularz, uprawnienia) — osobne wymaganie; silnik tylko czyta.
- **Integracja z Google Calendar** (R4) — zajętość z kalendarza pracownika nie jest tu składnikiem.
- **UI, Server Action, bramka uprawnień** — silnik jest czystą funkcją, dokładnie jak
  `getEffectiveAvailability`. Kto może go wywołać, rozstrzyga warstwa wywołująca.
- **`getFomoSlots()`** — licznik marketingowy, nie silnik. Nie podmieniamy go w tym WO
  (FIELD-APP-PLAN 6.1 odnotowuje, że prawdopodobnie nigdy niczego nie zlicza — osobne zgłoszenie).
- **Montaż dwudniowy / dwa sąsiadujące wolne dni u tej samej ekipy.** Koszyk „montaż duży = 2 dni”
  świadomie NIE ISTNIEJE (korekta Michała 2026-09-10, `CAL-VISIT-DURATION-BASKETS` AC8).
  Silnik **nie ma** przypadku „znajdź dwa dni pod rząd” i nie wolno go tu wprowadzać.

## WYMAGA DECYZJI

### D1 — granulacja siatki slotów (blokuje test, nie blokuje projektu)

`FIELD-APP-PLAN.md` R5 (linia 856) zostawia to jawnie otwarte: *„Co ile minut generujemy terminy
i jak daleko w przód klient może rezerwować? Dziś: 2-godzinne okna, 60 dni. **Do potwierdzenia
jako świadoma decyzja, nie zastana.**”* Ani kontrakt, ani `scheduling_config` nie niosą dziś tej wartości.
Bez niej nie da się napisać testu na liczbę zwróconych slotów — a to jest pierwsza rzecz, którą
test-author sprawdzi.

| Wariant | Zachowanie w oknie 08:00–16:00, koszyk 120 min, bufor 60 min | Koszt |
|---|---|---|
| **(a) Siatka wyprowadzona** — sloty startują o godzinie startu okna i co `duration + buffer`, oraz bezpośrednio po `koniec rezerwacji + buffer` | 08:00, 11:00, 14:00 (+ sloty domykające po istniejących wizytach) | **zero zmian kontraktu**, brak nowego parametru, wynik zawsze wykonalny |
| (b) Stała siatka z konfiguracji (`slot_granularity_minutes`, np. 30) | 08:00, 08:30, 09:00, … | **migracja** `system_config` → okno kontraktowe, rola `contract-steward`; więcej slotów do pokazania klientowi, ale i większa szansa na fragmentację dnia |

**Rekomendacja: (a)** — mieści się w istniejącym kontrakcie, nie wprowadza nowego parametru
konfiguracyjnego przed pierwszym uruchomieniem i z definicji nie generuje slotów, które łamią bufor.
Wariant (b) da się dołożyć później bez wyrzucania (a): to zmiana generatora kandydatów, nie odejmowania.
**Decyzja należy do człowieka — implementacja nie może wybrać sama, bo od tego zależy, ile terminów
zobaczy klient.**

### D2 — czy dzienny limit dotyczy puli `CREW`?

`SLA` ma **wyłącznie** `AUDITOR_DAILY_CAP` (`count: 5`, scope: „Maksymalna liczba **audytów**
przypisanych jednemu **audytorowi** na dzień”). Odpowiednika dla ekip montażowych nie ma.

- **(a) Limit dotyczy wyłącznie puli `AUDITOR`.** Dla ekip ogranicznikiem jest okno pracy i długość
  koszyka (montaż standardowy = 480 min = cały dzień, więc limit dzienny byłby i tak nieosiągalny).
  **Zero zmian kontraktu.** Rekomendowane.
- (b) Limit dotyczy obu pul. Wymaga **nowej stałej SLA** `CREW_DAILY_CAP` — zmiana
  `contracts/sla.contract.mjs`, okno kontraktowe, `contract-steward`, regeneracja
  `packages/contracts/src/generated/sla.ts`. Użycie `AUDITOR_DAILY_CAP` dla ekip jest **odrzucone
  wprost**: scope stałej mówi „audytów / audytorowi”, więc byłaby to cicha zmiana znaczenia progu SLA.

Do czasu decyzji AC-C2/AC-C3 testują wyłącznie pulę `AUDITOR`, a dla `CREW` obowiązuje wariant (a).

## Ryzyka i nieznane

1. **`getEffectiveAvailability` czyta `scheduling_config` przy każdym wywołaniu.** Naiwne użycie
   go w pętli po puli daje N zbędnych zapytań i N miejsc, w których konfiguracja mogłaby się różnić
   w obrębie jednego wyliczenia. AC-P4 tego zabrania; rozwiązaniem jest wyniesienie odczytu
   konfiguracji wyżej albo przekazanie jej do funkcji. **To dotyka istniejącego pliku** — jeżeli
   zmiana sygnatury `getEffectiveAvailability` okaże się konieczna, musi zostać zrobiona zachowawczo
   (parametr opcjonalny), bo tamten kod ma własne, zdane testy (`availability-rules-weekly.test.ts`).
2. **`bookings` nie ma dziś ani jednego wiersza produkcyjnego i żadnego kodu piszącego.**
   Testy silnika muszą same wstawiać rezerwacje — a wstawienie wiersza podlega CHECK-om
   (`bookings_one_subject`, `bookings_one_assignee`, `bookings_resource_kind_check`) i triggerowi
   `bookings_pool_matches_basket_trg`. Przygotowanie danych testowych jest tu **większą pracą
   niż sam silnik** i trzeba to uwzględnić w wycenie tury.
3. **Test wymaga prawdziwego Postgresa** — `EXCLUDE USING gist` i `timestamptz` nie mają atrapy,
   a AC-C4 (doba lokalna) i AC-S2 (zmiana czasu) zależą od zachowania bazy przy zapisie.
4. **`audytorzy.is_active` kontra `zespoly_monterskie.aktywny`** — jedno pojęcie, dwie nazwy kolumn
   w dwóch tabelach (stan zastany, ADR-002 nie został tu jeszcze doprowadzony do końca). Silnik
   musi to obsłużyć rozgałęzieniem, a nie wspólnym polem; łatwe miejsce na cichy błąd
   „ekipa nieaktywna dalej dostaje terminy”.
5. **Kolejność deduplikacji względem `CAL-POOL-AGGREGATE`** — jeżeli wariant D1(a) zostanie przyjęty,
   dwaj pracownicy o różnym obłożeniu wygenerują sloty na **różnych** godzinach startu, więc suma
   puli będzie bardziej postrzępiona niż przy stałej siatce. To nie jest defekt tego WO, ale jest
   wejściem do decyzji projektowej w `CAL-POOL-AGGREGATE` i warto to tam odnotować.
