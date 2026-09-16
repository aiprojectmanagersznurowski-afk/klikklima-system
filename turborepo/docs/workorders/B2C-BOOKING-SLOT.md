# WO: B2C-BOOKING-SLOT — atomowa rezerwacja terminu audytu przez klienta (B2C)

> **Wersja 2 — przepisany w całości 2026-09-14.** Zastępuje szkic z tej samej daty (wersja 1),
> który był zablokowany na D-1/D-2 i celował w martwy `app/api/calendar/slots/route.ts`.
>
> **Rozstrzygnięte przez Michała 2026-09-14 — nie otwierać ponownie:**
> - **D-1 = TAK.** `bookings` + `absences` stają się źródłem prawdy dla terminów audytu B2C.
>   Google Calendar przestaje być źródłem listy terminów. To jest zakres TEGO WO.
> - **D-2 = TAK, WYKONANE.** Warstwa harmonogramu żyje w `packages/scheduling` (`@repo/scheduling`),
>   commit `51f3cd5`. Nie ma już wariantów (A)/(B)/(C) — jest jedna implementacja, importowalna z obu aplikacji.
> - **D-3 = FINALNE.** Publiczny punkt wejścia B2C **nie przechodzi przez `can()`**, nie dodajemy roli
>   `klient` do `ROLES`/`MATRIX`. Obrona przenosi się na walidację parametrów (AC5, AC7).
> - **D-4 zdjęte.** `CAL-POOL-AGGREGATE` jest `DONE` (`16a5f18`, `c6b6fae`), `findPoolSlots` istnieje.
>
> **D-5 rozstrzygnięte 2026-09-14 (sprawdzone na żywej bazie, nie na słowo):** koszyk `AUDIT`
> aktywny (120 min), 3 aktywnych audytorów, `scheduling_config` istnieje. `availability_rules`
> ma **0 wierszy** — wszyscy trzej audytorzy trafiają w fail-open domyślne okno 08:00–16:00 Pn–Pt
> z `getEffectiveAvailability`. Klient zobaczy realne terminy, nie pustą listę. **Nie blokuje
> wdrożenia. Bez feature flagu, bez fallbacku do Google.**
>
> **D-6 rozstrzygnięte przez Michała 2026-09-14: wariant (a).** Ten WO zostaje NIETRANSAKCYJNY.
> Ponowienie po `SLOT_TAKEN` tworzy NOWY komplet klient+adres+lead — nie wraca na tego samego
> leada (co i tak było wykluczone przez AC7). Osierocone trójki klient+adres+lead bez rezerwacji
> po nieudanej próbie są zaakceptowanym, tymczasowym skutkiem — sprzątanie (cron/raport) i pełna
> atomowość zostają przy `B2C-LEAD-ATOMIC`, osobnym, wciąż otwartym wymaganiu. AC9/AC10 poniżej
> są już przepisane pod ten wariant.
>
> **STATUS: gotowe do RED w całości.**

## Wymagania

- **`B2C-BOOKING-SLOT`** (`contracts/requirements.contract.mjs:539`) — `TODO`, **risk `HIGH`**, domain `b2c`.
  Statement: „Rezerwacja terminu audytu przez klienta jest atomowa — ten sam slot może zostać zajęty tylko raz."
  **Siedem kryteriów akceptacji** w rejestrze; mapowanie 1:1 na AC poniżej w sekcji „Kryteria akceptacji".
- Konsumowane, już `DONE`, **nie powtarzane tutaj**:
  - `FLD-BOOKING-ATOMIC-ASSIGN` (`:673`) — `createBooking`, `bookings_no_overlap_per_resource`,
    `bookings_one_active_per_subject`, mapowanie `23P01`/`23505` → błąd domenowy, lista alternatyw.
  - `CAL-POOL-AGGREGATE` (`:666`) — `findPoolSlots`, anonimizacja puli.
  - `CAL-SLOT-ENGINE`, `FLD-AVAIL-WEEKLY-RULES` — silnik i reguły dostępności.
- Styczne, **celowo NIE zamykane tutaj**: `B2C-LEAD-ATOMIC` (`:538`, WO nie istnieje),
  `B2C-CONSENT-RODO` (`:540`), `B2C-BOOKING-VALIDATION`, `FNL-E3-E4` (rezerwacja montażu).

## Kontekst kodu (zweryfikowany w kodzie 2026-09-14, nie z rejestru)

### Istnieje i jest gotowe jako wejście

- **`packages/scheduling` istnieje** (`packages/scheduling/package.json`, nazwa `@repo/scheduling`,
  `main: src/index.ts`). Eksportuje (`src/index.ts`): `findAvailableSlots`, `findPoolSlots`,
  `createBooking`, `extractSqlState`, `reassignBooking`, `getEffectiveAvailability`,
  `writeAvailabilityRuleRaw` + typy. Zależności pakietu: `@repo/database`, `@klikklima/contracts`,
  `date-fns-tz`, `zod`.
- `findPoolSlots(visitBasketId: string, dateRange: {from: Date; to: Date}, options?: {limit?: number})`
  → `PoolSlotsResult { slots: AvailableSlot[]; duration_minutes: number; travel_buffer_minutes: number; error: string | null }`,
  gdzie `AvailableSlot = { start_at: Date; end_at: Date; date: string }` — **bez `resource_id`,
  bez `resource_kind`, bez liczby wolnych osób** (`packages/scheduling/src/pool-slots.ts:42`).
  Deduplikacja po `start_at`, sortowanie rosnąco.
- `createBooking(params: CreateBookingParams)` (`packages/scheduling/src/create-booking.ts`):
  `{ visitBasketId, startAt: Date, subject: BookingSubject, bookedBy: 'CLIENT' | 'DISPATCHER', alternativesRange? }`.
  **Czysta funkcja domenowa: bez `can()`, bez sesji, bez `revalidatePath`.**
  Kody błędów: `BASKET_NOT_FOUND | BASKET_INACTIVE | CONFIG_MISSING | SLOT_NOT_OFFERED | SLOT_TAKEN |
  POOL_MISMATCH | SUBJECT_ALREADY_BOOKED`; wynik błędu niesie `alternatives: AvailableSlot[]`.
  Komentarz w pliku (D-4 z FLD-BOOKING-ATOMIC-ASSIGN): **`createBooking` NIE dotyka `leady.data_rezerwacji`.**
- `apps/b2b-web/src/app/(dashboard)/bookings/actions.ts:44` — `createBookingAction`: kolejność
  `getCurrentActorRole()` → `can(role,'bookings','create')` → Zod → `createBooking`. Importuje
  z `@repo/scheduling` (już przepięte). Schemat Zod przyjmuje `bookedBy: 'CLIENT'`, ale bramka roli
  nie wpuści nikogo bez wiersza w `authorized_users` — dlatego B2C nie idzie tędy (D-3).
- `visitBasketId` to **UUID** (`Booking.visitBasketId @db.Uuid`, FK do `visit_duration_baskets.id`),
  a nie kod. Koszyk `AUDIT` ma stabilny `code` (`VisitDurationBasket.code @unique`,
  `schema.prisma:854`) i `pool` (`AUDITOR`), `durationMinutes`, `isActive`.
  **W repo nie istnieje żaden helper „code → id"** — `createBookingAction` przyjmuje gotowy UUID
  od wywołującego (grep: jedyne wystąpienie `visitBasketId` poza `packages/scheduling` to
  `actions.ts:31`). Rozwiązanie koszyka po kodzie jest nowym, małym elementem tego WO.
- Infrastruktura testów: `vitest.config.mts` (`include: ['**/*.test.ts']`, alias `@klikklima/contracts`
  i stub `server-only`, `passWithNoTests`), `vitest.integration.config.mts`
  (`include: ['**/*.itest.ts']`, `fileParallelism: false`, `globalSetup: tools/vitest-integration-db-guard.mjs`,
  brak `passWithNoTests`). Testy B2C żyją w `apps/b2c-web/tests/actions/*.test.ts`
  (m.in. `saveLead.test.ts`) — wzorzec dla nowych testów jednostkowych.

### Stan faktyczny `apps/b2c-web` (to jest to, co przepisujemy)

- **`apps/b2c-web/package.json` NIE MA `@repo/scheduling`.** Ma `@repo/database` (`"*"`)
  i `@klikklima/contracts` (`"*"`), ale **żaden plik aplikacji nie importuje Prismy** —
  cały dostęp do danych idzie przez `@supabase/supabase-js`. Dodanie zależności workspace
  `@repo/scheduling` do `apps/b2c-web/package.json` jest **w zakresie tego WO**.
- **`apps/b2c-web/app/actions/calendar.ts` — żywe źródło terminów, Google Calendar.**
  - `getAvailableSlots(): Promise<AvailableSlot[]>` (`:33`), bez argumentów.
  - `AvailableSlot = { dateStr: string /* yyyy-MM-dd */, slots: string[], isWeekend?: boolean }` (`:27`),
    gdzie `slots` to **napisy-zakresy**: `TIME_SLOTS = ["08:00 - 10:00","10:00 - 12:00","12:00 - 14:00","13:00 - 15:00"]` (`:25`)
    — sztywna siatka, bloki 2 h, **nakładające się** (12:00–14:00 i 13:00–15:00).
  - `HORIZON_DAYS = 60` (`:24`), pętla `i = 0..60` od dziś w `Europe/Warsaw`.
  - Weekend: dzień jest dopisywany z `slots: []` i `isWeekend: true` (`:69-76`) — NIE pomijany.
  - Dzień roboczy bez wolnych slotów **nie trafia do wyniku wcale** (`:107`).
  - Bufor: slot odrzucany, jeśli `slotStart <= now + 2h` (`:87`).
  - Awaria Google → `catch` → **pusta tablica** (`:119`), czyli „brak terminów", bez komunikatu błędu.
  - `createCalendarEvent(leadName, phone, address, bookingDateStr, bookingSlotStr)` (`:123`) —
    wpis do kalendarza, zwraca `{success, eventLink}` / `{success:false, error}`, **nie rzuca**.
- **`apps/b2c-web/components/triage/steps/Step8Booking.tsx` — jedyny konsument w UI.**
  - `import { getAvailableSlots, type AvailableSlot } from '@/app/actions/calendar'` (`:9`).
  - Pobranie w `useEffect` (`:88-93`) → `availableDays` w `useState`, `isLoadingSlots`.
  - Dzień jest klikalny gdy `availableDay && !availableDay.isWeekend && !isPastDay && availableDay.slots.length > 0` (`:284`).
  - Godzina: przyciski renderują **surowy napis** `slot` (`:325-338`), wybór trzymany w `selectedSlot: string`.
  - Zakres miesięcy nawigacji liczony z ostatniego `dateStr` w `availableDays` (`:66-71`).
  - Submit (`:181-200`): `parseISO(selectedDateStr).toISOString()` → `bookingDate`,
    `selectedSlot` (napis) → `bookingSlot`, wywołanie `saveLead(leadData)`; przy błędzie `alert(...)`.
  - Walidacja formularza: ręczna, `useState` na pola — **niezgodne z ADR-001 (RHF+Zod)**,
    ale to zakres `B2C-BOOKING-VALIDATION`, nie ten WO.
- **`apps/b2c-web/app/actions/saveLead.ts` — żywa ścieżka zapisu, `supabase-js`, BEZ transakcji.**
  Cztery niezależne operacje w `try`: INSERT `klienci` (id generowane w kodzie `randomUUID()`,
  bez `.select()`), INSERT `adresy` (j.w.), INSERT `leady` z `status: 'NEW_LEAD'` i
  `data_rezerwacji` sklejonym z `bookingDate` + pierwszej godziny napisu `bookingSlot` (`:62-65, :84`),
  następnie `createCalendarEvent` (`:90`), którego awaria **nie przerywa** przepływu (`:98-101`).
  **Krytyczne dla tego WO: INSERT do `leady` NIE zwraca `id`** (`id` ma default w bazie,
  brak `.select()`), więc w dzisiejszym kodzie **nie ma czym zaadresować `subject: {kind:'LEAD', leadId}`**.
  `leady.id` ma `@default(dbgenerated("gen_random_uuid()"))` → identyfikator można wygenerować
  po stronie serwera tak samo jak `klientId`/`adresId`.
  Uwaga: łączenie daty (`dateObj.setHours(...)`) działa w strefie **procesu**, nie w `Europe/Warsaw`
  — na serwerze w UTC daje przesunięcie o 1–2 h. To znika razem z napisami-zakresami.
- **`apps/b2c-web/app/actions/getFomoSlots.ts` — drugi konsument `getAvailableSlots` (`:48`).**
  Liczy limit z `system_config.fomo_config.weekly_audit_limit` (domyślnie 10), odejmuje
  `count(leady WHERE status = 'Umówiony Audyt' AND data_rezerwacji w tygodniu)`, po czym bierze
  `min(limit - booked, liczba slotów z Google w tym tygodniu)`; fallback w `catch`: `{slots: 3}`.
  **`'Umówiony Audyt'` nie istnieje w enumie `LeadStatus`** (`schema.prisma:359-372`:
  `NEW_LEAD, AWAITING_AUDIT, …`), a `saveLead` zapisuje `NEW_LEAD` — czyli licznik zajętości
  z bazy jest **zawsze 0** i cały wynik FOMO sprowadza się dziś do liczby slotów z Google Calendar.
- **`apps/b2c-web/app/api/calendar/slots/route.ts` — MARTWY KOD.** Zero konsumentów w repo
  (grep po `/api/calendar/slots`). Rejestr sam to już odnotowuje w kryterium dopisanym 2026-09-14.
- **`apps/b2c-web/lib/supabaseClient.ts`** tworzy klienta z
  `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` (omija RLS). Używane wyłącznie
  w plikach `"use server"`, więc zakaz z `CLAUDE.md` nie jest naruszony — ale dzisiejszy model
  autoryzacji publicznych zapisów B2C to **granica Server Action, nie RBAC**. To jest precedens,
  na którym stoi D-3.
- `apps/b2c-web/AGENTS.md`: „This is NOT the Next.js you know" (Next 16.2.9) — implementer czyta
  `node_modules/next/dist/docs/` przed pisaniem Server Action, nie polega na pamięci.
- `docs/architecture/generated/CONTRACTS.md`: **zero wystąpień „booking"/„rezerwac"** — kolejka
  powiadomień nie zna zdarzenia „rezerwacja audytu potwierdzona". Ten WO powiadomień nie dodaje.

### Brakuje (to jest produkt tego WO)

1. Zależności workspace `@repo/scheduling` w `apps/b2c-web/package.json`.
2. Publicznej Server Action zwracającej **zagregowaną, anonimową** listę terminów audytu z bazy.
3. Publicznej ścieżki, która przy zapisie leada tworzy wiersz `bookings` przez `createBooking`.
4. Rozwiązania koszyka `AUDIT` (kod → UUID) po stronie serwera.
5. Przepięcia `Step8Booking.tsx` i `getFomoSlots.ts` na nowe źródło (Google Calendar znika z odczytu).

## Architektura docelowa

### Odczyt terminów

Nowa Server Action w `apps/b2c-web/app/actions/` (proponowana nazwa pliku `auditSlots.ts`,
`"use server"`), zastępująca `getAvailableSlots` jako źródło dla UI:

```
getAuditSlots(): Promise<AuditSlotsResult>
```

- Bez parametrów przyjmowanych od klienta (D-3: publiczne wejście nie parametryzuje zapytania).
- Serwerowo: `visitBasketId` = `id` wiersza `visit_duration_baskets` o `code = 'AUDIT'`;
  zakres dat = od „teraz" do `+HORIZON_DAYS` (stała nazwana w pliku, wartość **60** — jak dziś).
- Wywołuje `findPoolSlots(auditBasketId, { from, to })` z `@repo/scheduling`.
- Zwraca kształt pogrupowany po dniach, ale z **identyfikowalnym maszynowo** terminem, nie napisem:

```
type AuditSlot = { startAtIso: string; endAtIso: string; label: string } // label = "08:00 - 10:00" w Europe/Warsaw
type AuditDay  = { dateStr: string; slots: AuditSlot[] }
type AuditSlotsResult = { days: AuditDay[]; error: string | null }
```

- `label` jest **wyliczany** z `start_at`/`end_at` w `Europe/Warsaw` — nigdy z `TIME_SLOTS`.
  Długość slotu pochodzi z `duration_minutes` koszyka `AUDIT`, więc etykieta zawsze zgadza się
  z tym, co zostanie zapisane w `bookings.scheduled_end`.
- `error` z `findPoolSlots` (np. brak `scheduling_config`) jest **przekazywany dalej jako komunikat**,
  nie zamieniany w cichą pustą listę (dzisiejsze `catch → []` jest wyciszaniem awarii).
- `TIME_SLOTS`, `HORIZON_DAYS`, `freebusy.query` i cała funkcja `getAvailableSlots`
  **znikają z `calendar.ts`**.

### Zapis rezerwacji

`saveLead.ts` (`"use server"`) zostaje jedynym publicznym punktem wejścia. Zmiany:

- `SaveLeadData.bookingSlot: string` + `bookingDate: string` → **`startAtIso: string`** (jedno pole).
  Klient nie przysyła ani koszyka, ani `bookedBy`, ani `leadId`, ani `resource_id`.
- `leadId` jest **generowany serwerowo** (`randomUUID()`) i użyty jawnie w INSERT `leady` —
  tak samo jak dziś `klientId` i `adresId`. To jedyny sposób, żeby zaadresować
  `subject: { kind: 'LEAD', leadId }` bez `.select()` (którego `anon` nie może wykonać, patrz
  komentarz SEC-RLS-BASELINE w `saveLead.ts:30-32`).
- Po zapisie leada: `createBooking({ visitBasketId: <AUDIT>, startAt: new Date(startAtIso),
  subject: { kind: 'LEAD', leadId }, bookedBy: 'CLIENT' })` z `@repo/scheduling`.
  `visitBasketId` i `bookedBy` pochodzą **wyłącznie z serwera**.
- `leady.data_rezerwacji` zapisuje **tylko `saveLead`** (`createBooking` go nie dotyka — D-4
  z `FLD-BOOKING-ATOMIC-ASSIGN`). Jedno miejsce zapisu, nie dwa.
- Wynik `createBooking` jest tłumaczony na odpowiedź dla UI: `{ success: false, code, message, alternatives }`.
  **`extractSqlState`/SQLSTATE nie wycieka** — `createBooking` już to opakowuje, `saveLead` tylko przekazuje `code`.

### Google Calendar

- **Odczyt (`freebusy.query`, `getAvailableSlots`) — USUNIĘTY.** To jest treść D-1.
- **Zapis (`createCalendarEvent`) — ZOSTAJE** jako jednokierunkowa, best-effort kopia informacyjna
  dla ludzi w terenie, wywoływana **po** udanym `createBooking`, z zachowaniem dzisiejszego
  zachowania „awaria nie przerywa przepływu". Podstawa: kryterium akceptacji `B2C-LEAD-ATOMIC`
  (`:538`) — „Awaria integracji zewnętrznej z kalendarzem nie wycofuje transakcji ani nie zostawia
  rezerwacji bez leada — wpis do kalendarza jest kolejkowany po zatwierdzeniu, nie wykonywany
  w transakcji". Google Calendar przestaje być źródłem prawdy, nie przestaje być kalendarzem
  pracownika. Pełne usunięcie integracji = osobne wymaganie (patrz „Ryzyka" #3).
- `createCalendarEvent` dostaje dziś `bookingDateStr` + `bookingSlotStr` (napis). Po zmianie
  podpisu wejściowego musi przyjmować `startAt`/`endAt` (obiekty `Date`) — inaczej trzeba
  odtwarzać napis, którego już nie ma.

### FOMO

`getFomoSlots.ts` importuje `getAvailableSlots`, która znika — **nie da się go zostawić bez zmian**
(nie skompiluje się). R-2 z wersji 1 („osobne ID, nie naprawiać przy okazji") jest w tym punkcie
**unieważnione przez D-1**, ale tylko co do podmiany źródła. Zakres minimalny i wyłączny:
`getFomoSlots` liczy dostępne terminy z `findPoolSlots(AUDIT, <zakres tygodnia>)` zamiast z Google.
**Poza zakresem:** naprawa filtra `status = 'Umówiony Audyt'`, limit `weekly_audit_limit`,
fallback `{slots: 3}`, teksty okresów.

### UI

`Step8Booking.tsx` **wymaga zmiany — minimalnej, ale realnej**, bo zmienia się kształt danych:
- import `getAuditSlots` zamiast `getAvailableSlots`;
- `availableDays` → `days`, klikalność dnia z `day.slots.length > 0` (pole `isWeekend` znika —
  weekend jest już liczony lokalnie przez `getDay(dayDate)` w `:282`, a nowe źródło po prostu
  nie zwraca dni bez terminów);
- przyciski godzin renderują `slot.label`, a stan trzyma `slot.startAtIso`;
- submit wysyła `startAtIso` zamiast pary `bookingDate` + `bookingSlot`;
- błąd `SLOT_TAKEN` pokazuje komunikat domenowy i alternatywy zamiast `alert(...)`.

**Bez zmian wizualnych**: layout, kalendarz, animacje, teksty nagłówków, kolory, ikony
zostają dokładnie takie jak dziś.

## Zmiana kontraktu

- **`contracts/rbac.contract.mjs` — NIEWYMAGANA.** D-3: brak nowej roli, brak zmiany `MATRIX`.
  (Opcjonalny komentarz przy `bookings` odnotowujący istnienie ścieżki publicznej — jeśli ktoś go
  chce, to okno kontraktowe i `contract-steward`, nigdy `implementer-server`.)
- **`schema.prisma` / `supabase/migrations/` — NIEWYMAGANA.** `bookings_no_overlap_per_resource`
  i `bookings_one_active_per_subject` pochodzą z `FLD-BOOKING-ATOMIC-ASSIGN`. Ten WO nic do bazy
  nie dokłada. **Uwaga:** ten WO zakłada obecność **danych** (koszyk `AUDIT`, audytorzy, reguły
  dostępności, `scheduling_config`) — to nie jest zmiana schematu, to gotowość danych (D-5).
- **`contracts/notifications` — NIEWYMAGANA.** Brak zdarzenia „rezerwacja audytu potwierdzona"
  w `CONTRACTS.md`; dodanie go = osobne wymaganie (`notification-architect` + `contract-steward`).
- **`contracts/requirements.contract.mjs` — WYMAGANA, drobna.** Piąte kryterium `B2C-BOOKING-SLOT`
  wskazuje `apps/b2c-web/app/api/calendar/slots/route.ts` jako „dzisiejszy stan"; rejestr sam
  w siódmym kryterium mówi, że ten plik ma zero konsumentów. Do doprecyzowania w tym samym oknie
  kontraktowym (`contract-steward`), żeby kryterium nie kierowało wykonawcy do martwego pliku.

## Kryteria akceptacji (wykonalne)

Mapowanie na siedem kryteriów rejestru (`contracts/requirements.contract.mjs:539`):
K1 (ograniczenie w bazie) → AC1; K2 (23P01 → błąd domenowy) → AC4; K3 (dwa równoległe żądania) → AC1;
K4 (błąd domenowy z alternatywami) → AC4; K5 (lista z `bookings`+`absences`) → AC2, AC3;
K6 (jedna implementacja rezerwacji) → AC6; K7 (zagregowana anonimowa lista z `findPoolSlots`,
test w żywej ścieżce) → AC2, AC3, AC11.

- [ ] **AC1** — Dwa równoległe żądania klienta na ten sam termin audytu kończą się **dokładnie jednym**
      wierszem `bookings`. Przegrane żądanie nie tworzy wiersza `bookings` i nie modyfikuje istniejącego.
      Dowód musi pochodzić z żywego Postgresa (`*.itest.ts`), nie z atrapy Prismy.
- [ ] **AC2** — Lista terminów pokazywana klientowi odzwierciedla stan `bookings` i `absences`:
      termin zarezerwowany dowolną ścieżką (klient B2C albo dyspozytor w panelu) znika z listy
      zwracanej klientowi przy kolejnym wywołaniu, bez restartu aplikacji i bez zmiany kodu.
      Nieobecność audytora (`absences`) usuwa jego terminy z puli w ten sam sposób.
- [ ] **AC3** — Odpowiedź z listą terminów **nie zawiera** identyfikatora ani nazwy pracownika,
      liczby wolnych osób, ani żadnego pola pozwalającego wywnioskować obłożenie konkretnej osoby.
      Test: serializacja odpowiedzi nie zawiera kluczy `resource_id`, `resource_kind`, `resources`,
      `auditor_id`, `auditorId`, `crew_id`, `crewId`, ani żadnej tablicy per zasób. Dwa wolne terminy
      o tym samym `start_at` u dwóch audytorów są widoczne dla klienta jako **jeden** termin.
- [ ] **AC4** — Żądanie przegrywające wyścig otrzymuje **błąd domenowy `SLOT_TAKEN` wraz z niepustą
      listą alternatywnych terminów**, a nie odpowiedź 500. Ani `23P01`, ani `23505`, ani żaden
      fragment komunikatu Postgresa (`EXCLUDE`, `constraint`, nazwa ograniczenia) nie pojawia się
      w odpowiedzi ani w treści widzianej przez klienta.
- [ ] **AC5** — Rezerwacja klienta powstaje z `booked_by = 'CLIENT'` i koszykiem o kodzie `AUDIT`
      (pula `AUDITOR`), przy czym obie wartości pochodzą z serwera. Żądanie zawierające własne
      `visitBasketId` (np. koszyk `INSTALL_STANDARD`), własne `bookedBy: 'DISPATCHER'`,
      `resource_id`/`auditorId` albo `status` **nie honoruje żadnej z tych wartości** — rezerwacja
      powstaje z wartościami serwerowymi albo żądanie jest odrzucane. Test wysyła żądanie
      z pominięciem UI, z doklejonymi polami.
- [ ] **AC6** — Rezerwacja klienta (B2C) i rezerwacja dyspozytora (panel) powstają tą **samą funkcją
      domenową** `createBooking` z `@repo/scheduling`, nie dwiema kopiami logiki. Test: w repo nie
      istnieje drugi `INSERT`/`$queryRaw` do tabeli `bookings` poza `packages/scheduling`
      (`apps/b2c-web` nie zawiera własnego zapisu do `bookings`).
- [ ] **AC7** — Żądanie podające `leadId` (cudzy albo jakikolwiek) nie tworzy rezerwacji na tym
      leadzie. Publiczny punkt wejścia wiąże rezerwację wyłącznie z leadem utworzonym w tym samym
      żądaniu, którego identyfikator wygenerował serwer.
- [ ] **AC8** — Żaden kod w `apps/b2c-web` nie odpytuje Google Calendar o dostępność:
      po zmianie `googleapis`/`freebusy` nie występuje na ścieżce odczytu terminów, a lista terminów
      jest poprawna przy **całkowicie niedostępnym** Google Calendar (brak
      `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY` nie skutkuje pustą listą terminów).
- [ ] **AC9** — *(D-6 wariant (a), rozstrzygnięte)* Po `SLOT_TAKEN` (albo `SUBJECT_ALREADY_BOOKED`,
      `SLOT_NOT_OFFERED`, `POOL_MISMATCH`, `BASKET_NOT_FOUND`, `BASKET_INACTIVE`, `CONFIG_MISSING`)
      klient+adres+lead **pozostają zapisane** (`supabase-js` już je utrwalił, zanim doszło do
      `createBooking`) — żaden z trzech rekordów nie jest kasowany ani wycofywany. Ponowna próba
      klienta tworzy **NOWY, niezależny komplet** klient+adres+lead z nowym `leadId` wygenerowanym
      serwerowo — nie wraca na leada z nieudanej próby (AC7 tego i tak zabrania). Test: dwie
      kolejne nieudane próby dają dwóch różnych klientów, dwa adresy, dwóch leadów w bazie —
      to jest ZAMIERZONE, nie defekt do naprawienia w tym WO (sprzątanie osieroconych rekordów
      i pełna atomowość → `B2C-LEAD-ATOMIC`).
- [ ] **AC10** — *(D-6 wariant (a), rozstrzygnięte)* Lead bez rezerwacji nie jest widoczny w panelu
      jako wizyta umówiona: `leady.data_rezerwacji` jest ustawiane w `saveLead` **wyłącznie gdy**
      `createBooking` zwróciło `ok: true` — nie przed próbą rezerwacji i nie niezależnie od jej
      wyniku. Test: lead z nieudaną rezerwacją (`SLOT_TAKEN` i inne kody błędu) ma
      `data_rezerwacji IS NULL`.
- [ ] **AC11** — Etykieta terminu pokazana klientowi odpowiada temu, co zapisano:
      dla wybranego terminu `label` odpowiada `bookings.scheduled_start`/`scheduled_end`
      w `Europe/Warsaw`, a długość wizyty równa się `visit_duration_baskets.duration_minutes`
      koszyka `AUDIT` — nie 120 minut z nieistniejącej już stałej `TIME_SLOTS`.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Współbieżność, żywy Postgres (`*.itest.ts`).** Dwa równoległe żądania na ten sam termin i tę samą
  pulę. Wzorzec: `apps/b2b-web/tests/create-booking-concurrency.itest.ts`; konfiguracja
  `vitest.integration.config.mts`; uruchomienie `supabase start` + `npm run test:integration`.
  **Nie wolno dowodzić tego atrapą Prismy** — atrapa dowodzi wyłącznie tego, jak ją zaprogramowano.
- **Współbieżność między ścieżkami:** klient B2C i dyspozytor w panelu rezerwują ten sam termin
  jednocześnie. To inna para ścieżek niż dwóch klientów i realny scenariusz produkcyjny.
- **Idempotencja / podwójne kliknięcie:** dwukrotne wysłanie tego samego formularza tworzy DWA
  niezależne leady (D-6 wariant (a) — `saveLead` generuje nowy `leadId` przy każdym wywołaniu),
  więc `bookings_one_active_per_subject` (23505) nie ma tu czego złapać — to jest zamierzone,
  nie luka. Test potwierdza: dwa żądania, dwa leady, obie rezerwacje na TEN SAM slot i TĄ SAMĄ
  pulę nadal przechodzą przez zwykłą ścieżkę współbieżności `bookings_no_overlap_per_resource`
  (23P01) — jedna wygrywa, druga dostaje `SLOT_TAKEN` **ALBO** `SLOT_NOT_OFFERED`, nigdy
  `SUBJECT_ALREADY_BOOKED` (bo to dwa różne podmioty — to rozróżnienie jest istotą tego
  kryterium i zostaje). DOPRECYZOWANIE 2026-09-16 (realny przebieg CI, `integracja`): który
  z dwóch pierwszych kodów dostanie przegrany zależy od etapu, na którym odkrył porażkę —
  `findAvailableSlots` (SELECT bez blokady) w `createBooking` biegnie PRZED
  `prisma.booking.create()` (INSERT, gdzie dopiero rywalizuje ograniczenie bazy). `Promise.all`
  w teście gwarantuje wyłącznie wspólny start w JS, nie synchronizację zapytań SQL — jeśli
  zwycięzca zdąży w pełni zacommitować `INSERT` przed tym, jak przegrany wykona swój
  `findAvailableSlots`, przegrany zobaczy slot jako już niewolny i dostanie `SLOT_NOT_OFFERED`,
  nie `SLOT_TAKEN`. Oba są poprawną odpowiedzią domenową na „ten termin już nie jest wolny" —
  test asercjonuje zbiór dwóch dopuszczalnych kodów, nie jeden.
- **Parametry zamiast uprawnień (bo `can()` tu nie ma):** żądanie z `visitBasketId`, `bookedBy`,
  `leadId`, `resource_id`, `status`, `scheduledEnd` doklejonymi do payloadu. Każde ignorowane
  albo odrzucane (AC5, AC7).
- **Strefa czasowa.** Cała warstwa harmonogramu liczy w `Europe/Warsaw`
  (`available-slots.ts:24`, `create-booking.ts:30`), `scheduled_start/end` to `timestamptz`.
  Test na dniu zmiany czasu (ostatnia niedziela marca i października): termin pokazany jako „10:00"
  ma być 10:00 lokalnie, nie 09:00 ani 11:00. Dotyczy również `label` (AC11) i `data_rezerwacji`
  (dzisiejszy `dateObj.setHours` w `saveLead.ts:65` liczy w strefie procesu — ta wada ma zniknąć).
- **Termin spoza zaproponowanej listy:** klient wysyła `startAtIso` nieobecny w wyniku
  `findPoolSlots` → `SLOT_NOT_OFFERED`, komunikat domenowy z alternatywami.
- **Termin w przeszłości / w oknie bufora dojazdu:** odrzucony przez warstwę domenową, nie przez UI.
- **Koszyk `AUDIT` wycofany (`is_active = false`), brak koszyka o kodzie `AUDIT`, brak
  `scheduling_config`:** klient dostaje zrozumiały komunikat („brak dostępnych terminów" /
  „chwilowo nie można zarezerwować"), nie 500, nie pustą białą stronę i **nie cichą pustą listę
  udającą pełny kalendarz**.
- **Google Calendar niedostępny:** lista terminów działa (AC8), rezerwacja się zapisuje,
  brak wpisu w kalendarzu jest logowany, nie wysypuje przepływu.
- **Granica przedziału `[start, end)`:** termin zaczynający się dokładnie po końcu poprzedniego
  (plus bufor dojazdu z `scheduling_config`, fail-closed — brak konfiguracji to brak terminów,
  nie bufor 0) jest dozwolony.

## Poza zakresem

- **Przeprojektowanie ekranu rezerwacji** — layout, kalendarz, animacje, teksty, kolory
  `Step8Booking.tsx`. W zakresie jest wyłącznie podmiana źródła danych i kształtu payloadu
  (sekcja „Architektura docelowa → UI"), bez zmian wizualnych.
- **Walidacja formularza (RHF + `zodResolver`, komunikaty pól)** → `B2C-BOOKING-VALIDATION`.
  Dzisiejsza ręczna walidacja na `useState` zostaje nietknięta, mimo że łamie ADR-001.
- **Atomowość klient + adres + lead + rezerwacja w jednej transakcji** → `B2C-LEAD-ATOMIC`
  (WO nie istnieje). Ten WO **nie zszywa** dwóch klientów bazodanowych — patrz D-6.
- **Zgoda RODO zapisywana z leadem** → `B2C-CONSENT-RODO`.
- **Naprawa licznika FOMO** poza podmianą źródła slotów: filtr `status = 'Umówiony Audyt'`
  (wartość spoza enuma `LeadStatus`), `weekly_audit_limit`, fallback `{slots: 3}`.
- **Rezerwacja montażu (`FNL-E3-E4`)** — ta sama funkcja `createBooking`, inny koszyk, inna tura.
- **Powiadomienie do klienta o potwierdzonej rezerwacji** — brak zdarzenia w `CONTRACTS.md`.
- **Naprawa `SUPABASE_SERVICE_ROLE_KEY` jako domyślnego klienta w `b2c-web`** (rozjazd z ADR-001
  „B2C: RLS aktywne") — realny dług, osobna klasa problemu.
- **Usunięcie martwego `apps/b2c-web/app/api/calendar/slots/route.ts`** i ośmiu skryptów ad hoc
  `apps/b2c-web/test-cal*.ts` — sprzątanie. Uwaga: skrypty `test-cal*.ts` importują
  `getAvailableSlots`, więc po jej usunięciu przestaną się kompilować; jeśli `check-types`
  je obejmuje, ich usunięcie wchodzi do tego WO **wyłącznie** jako konsekwencja techniczna.
- **Całkowite wycięcie integracji z Google Calendar** (również zapisu) — patrz „Ryzyka" #3.

## WYMAGA DECYZJI

### D-5 (blokuje wdrożenie, nie RED) — gotowość danych do przełączenia źródła

Po przełączeniu klient widzi **wyłącznie** to, co wyliczy `findPoolSlots`, a ta funkcja jest
fail-closed na każdym kroku: brak koszyka `AUDIT`, brak `scheduling_config`
(`travel_buffer_minutes`), brak aktywnych audytorów albo brak reguł w `availability_declarations`
daje **zero terminów**. Dziś Google Calendar zawsze oferuje cztery bloki dziennie przez 60 dni,
niezależnie od tego, czy ktokolwiek jest dostępny. Różnica między „mało terminów" a „lejek Triage
umiera cicho" zależy od stanu danych produkcyjnych.

**Nie zweryfikowałem tego na żywej bazie** — rola `spec-analyst` nie ma prawa zapisu do
`packages/database/`, a tamtejszy skrypt sondujący jest jedyną działającą drogą odpytania bazy
(sam plik migracji niczego nie dowodzi). Pytania:

(a) Czy na produkcji istnieją: wiersz `visit_duration_baskets` z `code='AUDIT'`, `is_active=true`;
    co najmniej jeden aktywny audytor; reguły tygodniowe w `availability_declarations`;
    `scheduling_config` z `travel_buffer_minutes`?
(b) Jeżeli nie — czy przełączenie ma być **za przełącznikiem** (feature flag), z Google Calendar
    jako tymczasowym źródłem awaryjnym, czy wdrażamy dopiero po uzupełnieniu danych?

Wariant „fallback do Google przy pustym wyniku" **odrzucam z góry jako propozycję**: nie da się
odróżnić „nikt nie pracuje w piątek" od „konfiguracja zniknęła", więc automatyczny powrót do
kalendarza bez pokrycia w bazie sprzedawałby terminy, których nikt nie obsłuży. Jeśli ma być
fallback, to świadomie włączany, nie wyzwalany pustą listą.

### D-6 (blokuje AC9/AC10 i kształt testów) — dwa klienty bazodanowe w jednej operacji biznesowej

Po tej zmianie jedno żądanie klienta wykonuje: trzy INSERT-y przez `supabase-js`
(`klienci`, `adresy`, `leady`) i jeden zapis przez Prismę (`bookings`, wewnątrz `createBooking`).
**To są dwa różne połączenia i nie ma między nimi transakcji.** Kolejność jest wymuszona:
`createBooking` wymaga `subject: { kind: 'LEAD', leadId }`, a `Booking.lead` to FK do `leady`
z `onDelete: Cascade` — lead musi istnieć wcześniej.

Rejestr mówi wprost, że docelowo tak być nie może: `B2C-LEAD-ATOMIC` (`:538`) wymaga
„Zapisy do leads, clients, addresses i **bookings** wykonują się w jednej transakcji bazodanowej"
i testu wstrzykującego błąd na **każdym z czterech kroków**. Tego nie da się spełnić bez
przeniesienia zapisu leada na Prismę (`prisma.$transaction`), bo `supabase-js` nie ma transakcji
obejmujących wiele zapytań. Wcześniejszy szkic tego WO deklarował „ten WO tego nie zszywa" —
i to nadal może być poprawne, ale konsekwencje trzeba wybrać teraz, bo przesądzają testy:

(a) **Ten WO zostaje nietransakcyjny.** `SLOT_TAKEN` zostawia w bazie klienta + adres + leada bez
    rezerwacji. Pytanie uzupełniające: czy przy ponowieniu klient wraca **na tego samego leada**
    (trzeba wtedy przenieść `leadId` przez odpowiedź do UI i z powrotem — co otwiera dokładnie ten
    parametr, którego AC7 zabrania przyjmować od klienta), czy powstaje **drugi komplet
    klient+adres+lead** przy każdej nieudanej próbie (cicha produkcja duplikatów w CRM,
    i `bookings_one_active_per_subject` przestaje chronić przed podwójnym kliknięciem, bo podmiot
    za każdym razem jest inny).
(b) **Ten WO przenosi `saveLead` na Prismę i `$transaction`**, realizując przy okazji rdzeń
    `B2C-LEAD-ATOMIC`. Znacznie większy zakres (pierwsze użycie Prismy w `apps/b2c-web`,
    przepisanie `saveLead.test.ts`, kolizja z komentarzami SEC-RLS-BASELINE o braku `SELECT`
    dla `anon`, ryzyko dla ADR-001 „B2C: RLS aktywne"), ale jeden spójny przepływ zamiast dwóch
    połączeń — i `B2C-LEAD-ATOMIC` przestaje być otwarty.
(c) **Kompensacja zamiast transakcji:** przy `SLOT_TAKEN` `saveLead` kasuje utworzone rekordy
    (`leady` → `adresy` → `klienci`). Tańsze niż (b), ale kompensacja bez transakcji sama może
    zawieść w połowie i zostawia kasowanie danych osobowych w ścieżce publicznej.

To nie jest pytanie stylistyczne: od odpowiedzi zależy treść AC9, AC10 oraz to, czy test
podwójnego kliknięcia ma oczekiwać `SUBJECT_ALREADY_BOOKED`, czy drugiego kompletu rekordów.

## Ryzyka i nieznane

1. **Testy `*.itest.ts` prawdopodobnie nie wykonają się w tym środowisku** (brak Dockera,
   `DATABASE_URL` wskazujący nie-lokalną bazę, `tools/vitest-integration-db-guard.mjs` słusznie
   blokuje cały przebieg). AC1 i AC4 będą wtedy spełnione **co do formy testu, nie co do przebiegu**
   — ten sam dług co przy `FLD-BOOKING-ATOMIC-ASSIGN`. Do świadomej akceptacji albo do uruchomienia
   w jobie `integracja` (`.github/workflows/kk-gate.yml`).
2. **Koszt zapytań.** `findPoolSlots` przechodzi przez `findAvailableSlots`, które odpytuje
   `visitDurationBasket`, `system_config`, `audytorzy`/`zespoly_monterskie`,
   `availabilityDeclaration`, `booking`, `absence`. Dziś ta funkcja jest wołana dla wąskich zakresów
   w panelu; tutaj poleci na **60 dni przy każdym wejściu na ostatni krok Triage** (dodatkowo
   z `useEffect`, czyli przy każdym zamontowaniu komponentu). Nie zmierzyłem czasu odpowiedzi.
   Jeśli okaże się wolne, właściwą odpowiedzią jest skrócenie horyzontu albo pobieranie
   przyrostowe per miesiąc — nie cache, który sprzedałby zajęty termin.
3. **Los Google Calendar po stronie zapisu.** WO zostawia `createCalendarEvent` jako kopię
   informacyjną (uzasadnienie: kryterium `B2C-LEAD-ATOMIC` o kolejkowaniu wpisu po zatwierdzeniu).
   Nierozstrzygnięte, ale **nieblokujące**: czy audytorzy faktycznie korzystają z tego kalendarza,
   skoro przypisanie wykonawcy robi teraz `createBooking`, a wpis idzie do jednego wspólnego
   `GOOGLE_CALENDAR_ID`, nie do kalendarza przypisanej osoby. Jeśli nikt z niego nie korzysta,
   to martwa integracja do usunięcia osobnym wymaganiem. Jeśli korzysta — wpis powinien trafiać
   do kalendarza przypisanego audytora, czego dzisiejszy kod nie potrafi.
4. **`duration_minutes` koszyka `AUDIT` a dzisiejsze bloki 2 h.** Nie zweryfikowane na żywej bazie
   (patrz D-5). Jeśli `AUDIT` ma np. 60 albo 240 minut, klient po zmianie zobaczy inną siatkę godzin
   niż dotąd — to jest zamierzone (AC11), ale warto, żeby nikt nie zgłosił tego jako regresji.
5. **Nakładające się `TIME_SLOTS`** (`12:00 - 14:00` i `13:00 - 15:00`) pokazują, że dzisiejsza
   siatka nie ma nic wspólnego z rzeczywistą dostępnością. Po zmianie liczba terminów widocznych
   dla klienta prawie na pewno spadnie. To poprawa, ale ma skutek biznesowy (konwersja Triage)
   i warto, żeby Michał o tym wiedział przed wdrożeniem, nie po.
6. **Licznik FOMO zmieni wartość.** Dziś jego wynik to w praktyce liczba slotów z Google
   (człon bazodanowy jest martwy przez nieistniejący status `'Umówiony Audyt'`). Po podmianie
   źródła pokaże realną dostępność puli — najpewniej mniejszą.
7. **Next 16.2.9** (`apps/b2c-web/AGENTS.md`). Implementer musi sprawdzić w
   `node_modules/next/dist/docs/`, jak wygląda dziś Server Action wywoływana z komponentu
   klienckiego, zamiast opierać się na pamięci.

## Kolejność ról

1. **człowiek (Michał)** — D-5 i D-6, OBA rozstrzygnięte 2026-09-14 (patrz nagłówek pliku).
2. **contract-steward** — okno kontraktowe: doprecyzowanie piątego kryterium `B2C-BOOKING-SLOT:539`
   (wskazuje martwy `route.ts`).
3. **test-author** — `apps/b2c-web/tests/actions/*.test.ts` (AC2, AC3, AC5, AC7, AC8, AC9, AC10,
   AC11, strefy czasowe, przypadki fail-closed) + `*.itest.ts` (AC1, AC4, idempotencja,
   współbieżność między ścieżkami).
4. **implementer-server** — `@repo/scheduling` w `apps/b2c-web/package.json`, nowa akcja odczytu
   terminów, przepisany `saveLead.ts`, przepięty `getFomoSlots.ts`, usunięty odczyt z Google.
5. **implementer-ui** — `Step8Booking.tsx`: podmiana wywołania i payloadu, obsługa `SLOT_TAKEN`
   z alternatywami. Bez zmian wizualnych.
6. **reviewer** + **rls-security-auditor** — publiczny punkt wejścia bez `can()` wymaga osobnego
   przejrzenia pod kątem tego, co przyjmuje od klienta (AC5, AC7).
