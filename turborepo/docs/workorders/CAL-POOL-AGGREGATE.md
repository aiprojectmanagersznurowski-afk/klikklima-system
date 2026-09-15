# WO: CAL-POOL-AGGREGATE — zagregowany, zanonimizowany widok wolnych terminów całej puli

## Wymagania
- `CAL-POOL-AGGREGATE` (status `TODO`, risk **MEDIUM**, domain `b2c`) — wyodrębnione 2026-09-10
  z `FLD-AVAIL-WEEKLY-RULES` (dawne AC8) w oknie kontraktowym, commit `ec79ead`.
- Wejścia (DONE, nie są przedmiotem tego WO): `CAL-SLOT-ENGINE`, `FLD-AVAIL-WEEKLY-RULES`,
  `FLD-BOOKING-ATOMIC-ASSIGN`.
- Sąsiad, z którym ten WO **nie** może się zlać: `B2C-BOOKING-SLOT` (status `TODO`, risk HIGH).
- Źródło opisowe: `docs/architecture/FIELD-APP-PLAN.md` §6.3 („Dwie rozłączne pule").

---

## Kontekst kodu (zweryfikowany 2026-09-14, nie z opisu)

### Istnieje

- `apps/b2b-web/src/lib/schedule/available-slots.ts` — `findAvailableSlots(visitBasketId, dateRange)`.
  Zwraca `AvailableSlotsResult { resources: ResourceSlots[]; duration_minutes; travel_buffer_minutes; error }`,
  gdzie `ResourceSlots = { resource_id, resource_kind: 'AUDITOR' | 'CREW', slots: AvailableSlot[] }`.
  **Wynik jest per-pracownik i jawnie niesie `resource_id`** — to dokładnie ta informacja, której
  CAL-POOL-AGGREGATE ma nie wypuścić do klienta.
  Istotne dla tego WO właściwości silnika, które trzeba zachować, a nie odtwarzać:
  - pula wynika z `visit_duration_baskets.pool` dla podanego koszyka, a `resourceKind`
    **nie jest parametrem wejściowym** (komentarz w pliku, linie 19-21) — AC4 wymagania jest
    więc realizowane już na poziomie sygnatury silnika;
  - `error` jest polem wyniku, nie wyjątkiem: koszyk nieistniejący, koszyk `isActive = false`,
    odwrócony zakres dat i brak `scheduling_config.travel_buffer_minutes` (fail-CLOSED)
    zwracają `resources: []` z komunikatem po polsku;
  - błąd materializacji dostępności JEDNEGO pracownika (AC-E2) ustawia `error` na szczycie
    wyniku, ale pozostali pracownicy **dalej wnoszą sloty** — wynik jest wtedy częściowy.
- `apps/b2b-web/src/lib/schedule/create-booking.ts`, funkcja prywatna `findAlternatives`
  (linie 201-225) — **istniejący precedens i minimalna wersja tego, czego dotyczy ten WO**:
  spłaszcza `result.resources[*].slots`, sortuje po `start_at`, deduplikuje po
  `start_at.getTime()`, przepisuje slot bez `resource_id` i obcina do `MAX_ALTERNATIVES = 5`.
  Stałe `DEFAULT_ALTERNATIVES_HORIZON_DAYS = 14` i `MAX_ALTERNATIVES = 5` są literałami lokalnymi
  tego pliku.
- Testy silnika: `apps/b2b-web/tests/available-slots-engine-p-d.test.ts` oraz
  `apps/b2b-web/tests/available-slots-engine-a-b-t-c-s-e.test.ts` (atrapa Prismy, tag `// @REQ:`).
- Po stronie B2C **realnym** źródłem terminów jest dziś `apps/b2c-web/app/actions/calendar.ts`
  → `getAvailableSlots()`: Server Action odpytująca **Google Calendar** (`freebusy.query`),
  z zahardkodowaną siatką `TIME_SLOTS = ["08:00 - 10:00", …]`, horyzontem 60 dni i własną
  regułą weekendu. Konsumenci: `apps/b2c-web/components/triage/steps/Step8Booking.tsx`
  (ekran 8 Triage) oraz `apps/b2c-web/app/actions/getFomoSlots.ts`.
- `apps/b2c-web/app/api/calendar/slots/route.ts` istnieje i faktycznie zwraca tablicę mockową —
  ale **nie ma ani jednego konsumenta w repo** (grep: zero trafień na `api/calendar/slots`).
  To martwy plik, nie „bezpośredni konsument tego wymagania".
- `apps/b2c-web` ma `@repo/database` w `dependencies`, ale **nie importuje go nigdzie** —
  zero trafień na `@repo/database` w kodzie aplikacji.
- `apps/b2c-web` ma własny katalog testów Vitest: `apps/b2c-web/tests/actions/*.test.ts`.

### Brakuje

- Funkcji agregującej wynik `findAvailableSlots` do jednej, zanonimizowanej listy slotów puli.
  W repo istnieje wyłącznie prywatna, przyciasna wersja (`findAlternatives`, cap 5, horyzont 14 dni),
  niedostępna spoza `create-booking.ts`.
- Jakiejkolwiek drogi, którą `apps/b2c-web` mógłby tej logiki użyć — patrz D-1 poniżej.
- Testu, który dowodziłby, że `resource_id` nie wycieka do warstwy klienckiej.

---

## Zmiana kontraktu: **NIEWYMAGANA**

Uzasadnienie, a nie deklaracja:

- Agregacja nie dotyka `contracts/`: nie wprowadza nowego przejścia lejka, powiadomienia,
  progu SLA ani roli. Pula i tak pochodzi z `visit_duration_baskets.pool` (dane, nie kontrakt).
- `RESOURCES` w `contracts/rbac.contract.mjs` opisuje **tabele**. Funkcja czyta wyłącznie zasoby
  już zarejestrowane: `bookings`, `absences`, `availability_rules`, `visit_duration_baskets`,
  `availability_declarations`, `auditors`, `crews`. Nowy zasób nie powstaje.
- Macierz RBAC opisuje role panelu B2B. Odczyt publiczny (klient bez sesji) **nie jest** wierszem
  tej macierzy i nie ma być — dodanie pseudo-roli „anon" do MATRIX byłoby zmianą kontraktu
  wprowadzoną po to, żeby opisać coś, czego kontrakt świadomie nie modeluje.

Zmiana kontraktu STAŁABY SIĘ wymagana **tylko** przy jednym wariancie realizacji: gdyby odczyt
miał iść z `apps/b2c-web` klientem anonimowym `supabase-js`. Wymagałoby to polityki RLS dającej
roli `anon` `SELECT` na `bookings` — a to jest **wprost sprzeczne** z `B2C-RLS-PUBLIC` AC3:
„Tabele katalogu produktów i treści są czytelne anonimowo, **tabele lejka (leads, clients,
addresses, bookings) nie**". Ten wariant jest więc odrzucony na poziomie rejestru, nie preferencji.
Skutek praktyczny: agregacja **musi** być wykonana po stronie serwera, na połączeniu
uprzywilejowanym, a klient dostaje wyłącznie gotową listę anonimowych slotów.

---

## Zakres tego WO (i jego twarda granica)

**W zakresie:** wyłącznie funkcja agregująca — czysty, deterministyczny przekład
`AvailableSlotsResult` (per-pracownik) na `PoolSlotsResult` (per-pula, anonimowy),
plus przepięcie istniejącego `findAlternatives` na tę funkcję.

**Poza zakresem (należy do `B2C-BOOKING-SLOT`, risk HIGH):** podłączenie wyniku do
`Step8Booking.tsx`, wycofanie Google Calendar jako źródła prawdy, los martwego
`apps/b2c-web/app/api/calendar/slots/route.ts`, format `"08:00 - 10:00"` w UI, zapis rezerwacji.

Rozstrzygnięcie granicy (pkt 4 zlecenia): **CAL-POOL-AGGREGATE dostarcza WYŁĄCZNIE funkcję
agregującą.** Powody:
1. `B2C-BOOKING-SLOT` ma w swoich kryteriach wprost zapisane, że „lista wolnych slotów jest
   wyliczana z bookings i absences — dzisiejsze `route.ts` zwraca zahardkodowaną tablicę mockową".
   Podpięcie B2C jest więc już cudzym kryterium akceptacji; wciągnięcie go tutaj dałoby dwa
   wymagania konkurujące o ten sam test.
2. Podpięcie B2C to nie podmiana jednej funkcji, tylko **wymiana źródła prawdy terminów**
   z Google Calendar na bazę, wraz z siatką godzin, horyzontem, weekendami i `getFomoSlots`.
   To praca na ryzyku HIGH, a to wymaganie ma MEDIUM — sklejenie ich podniosłoby ryzyko całości
   i zużyło limit 3 iteracji GREEN na cudzy zakres.
3. Funkcja agregująca jest testowalna w całości bez ani jednej linii B2C.

---

## Proponowana sygnatura

```
// apps/b2b-web/src/lib/schedule/pool-slots.ts
export type PoolSlotsResult = {
  slots: AvailableSlot[]          // BEZ resource_id, bez resource_kind
  duration_minutes: number
  travel_buffer_minutes: number
  error: string | null
}

export async function findPoolSlots(
  visitBasketId: string,
  dateRange: { from: Date; to: Date },
  options?: { limit?: number },
): Promise<PoolSlotsResult>
```

`AvailableSlot` (`{ start_at, end_at, date }`) jest reużywany bez zmian — jest już strukturą
bezosobową i `findAlternatives` już go w tej roli używa.

---

## Kryteria akceptacji (obserwowalne)

### Anonimizacja i kształt wyniku

- [ ] **AC1** — Dla puli, w której `findAvailableSlots` zwraca co najmniej dwóch pracowników
      z niepustymi slotami, wynik `findPoolSlots` jest **płaską tablicą slotów**: żaden element
      nie niesie `resource_id` ani `resource_kind`, a test sprawdza to strukturalnie
      (`Object.keys(slot)` = dokładnie `start_at`, `end_at`, `date`), nie przez `toEqual`
      na ręcznie przepisanym obiekcie. `toEqual` przepuściłoby dodatkowe pole tylko wtedy,
      gdy autor testu je pominie — a to jest dokładnie ten błąd, który tu kosztuje wyciek.
- [ ] **AC2** — Identyfikator pracownika nie pojawia się w wyniku **w żadnej postaci pochodnej**:
      test przepuszcza `JSON.stringify(result)` i oczekuje, że nie zawiera żadnego `resource_id`
      z odpowiedzi silnika. To broni przed obejściem w rodzaju „schowam id w kluczu slotu".

### Unia zbiorów, nie suma liczb

- [ ] **AC3** — Slot oferowany przez **dokładnie jednego** pracownika z puli pojawia się na liście
      (unia, nie przecięcie).
- [ ] **AC4** — Slot oferowany przez **trzech** pracowników o identycznym `start_at` pojawia się
      na liście **dokładnie raz**. Test liczy wystąpienia tego `start_at`, a nie długość listy.
- [ ] **AC5** — Liczność listy jest **niezależna od liczby pracowników oferujących dany slot**:
      dwa przebiegi różniące się wyłącznie liczbą pracowników z tym samym kompletem slotów
      dają **identyczny** wynik. To jest wykonalna forma zakazu „nie ujawniaj obłożenia" —
      jeśli wynik zmienia się z liczbą osób, obłożenie da się z niego odczytać.
- [ ] **AC6** — Slot znika z listy dopiero wtedy, gdy przestaje być wolny u **ostatniego**
      pracownika. Test: slot wolny u dwóch osób, rezerwacja u jednej → slot nadal na liście;
      rezerwacja u obu → slotu nie ma.
- [ ] **AC7** — Lista jest posortowana rosnąco po `start_at`. Kolejność jest obserwowalna dla
      klienta i nie może zależeć od kolejności, w jakiej silnik zwrócił pracowników — test
      podaje pracowników w kolejności odwrotnej do chronologicznej ich slotów.
- [ ] **AC8** — Deduplikacja odbywa się po `start_at`, i **wyłącznie** po nim. Dwa sloty o tym
      samym `start_at`, ale różnym `end_at`, nie mogą jednocześnie trafić na listę (to by
      ujawniało, że w puli są dwa różne koszyki/konfiguracje). Przy kolizji wygrywa slot
      pierwszy w porządku z AC7 — zachowanie ma być deterministyczne, nie „jakiekolwiek".
      *Uwaga dla test-authora: w obecnym silniku `duration_minutes` jest jedno na cały wynik,
      więc ten przypadek jest dziś nieosiągalny z realnych danych — test konstruuje go na atrapie.
      Celem jest zamknięcie zachowania na przyszłość, nie opis dzisiejszego stanu.*

### Pula wynika z typu wizyty

- [ ] **AC9** — Funkcja **nie przyjmuje** parametru wskazującego pulę, pracownika ani
      `resource_kind`. Test wywołuje ją dla koszyka o puli `AUDITOR` i koszyka o puli `CREW`
      i oczekuje rozłącznych zbiorów slotów pochodzących z rozłącznych zbiorów pracowników.
- [ ] **AC10** — Nadmiarowe pole w obiekcie żądania (np. `{ pool: 'CREW' }` albo
      `{ resource_id: '…' }`) **nie ma wpływu na wynik**: przebieg z nim i bez niego daje wynik
      identyczny dla tego samego koszyka. Kryterium wymagania mówi wprost „żądanie wskazujące
      pulę wprost jest ignorowane po stronie serwera".

### Przeniesienie błędów silnika, bez ich tłumienia

- [ ] **AC11** — Gdy `findAvailableSlots` zwraca `error` i `resources: []` (koszyk nieistniejący,
      koszyk wycofany, odwrócony zakres, brak bufora dojazdu), `findPoolSlots` zwraca
      `slots: []` i **ten sam** komunikat błędu. Zamiana błędu na pustą listę bez komunikatu
      kryterium nie spełnia: klient zobaczyłby „brak terminów" tam, gdzie zaszła awaria
      konfiguracji, i firma straciłaby rezerwację nie wiedząc o tym.
- [ ] **AC12** — Wynik **częściowy** (silnik ustawił `error`, ale część pracowników wniosła
      sloty — AC-E2 z CAL-SLOT-ENGINE) przechodzi przez agregację jako sloty **oraz** `error`,
      nie jako jedno albo drugie. Test konstruuje dokładnie ten przypadek.
- [ ] **AC13** — `duration_minutes` i `travel_buffer_minutes` są przepisane z wyniku silnika
      bez zmiany. Klient musi wiedzieć, ile trwa wizyta; to nie jest informacja o obłożeniu.

### Limit i brak nowych literałów

- [ ] **AC14** — Bez podanego `limit` funkcja **nie obcina** listy. Obcięcie jest decyzją
      prezentacyjną wywołującego, nie właściwością puli; wbudowanie cap w agregator
      uniemożliwiłoby B2C pokazanie pełnego kalendarza.
- [ ] **AC15** — `limit: 5` zwraca pięć **pierwszych chronologicznie** slotów, nie pięć dowolnych.
- [ ] **AC16** — `limit: 0` zwraca pustą listę i `error: null` (jawny wybór wywołującego),
      a `limit` ujemny albo nie-całkowity jest błędem walidacji, nie cichym `slice`.

### Przepięcie istniejącego wywołania

- [ ] **AC17** — `findAlternatives` w `create-booking.ts` **woła** `findPoolSlots` zamiast
      powtarzać spłaszczanie i deduplikację. Obserwowalnie: istniejące testy
      `apps/b2b-web/tests/create-booking.test.ts` dotyczące alternatyw przechodzą **bez zmian**
      (implementer nie ma prawa ich dotknąć — TEST-DEFECT, jeśli uzna je za błędne),
      a w `create-booking.ts` nie pozostaje drugiej pętli deduplikującej po `start_at`.
- [ ] **AC18** — Zachowanie `createBooking` przy kolizji nie zmienia się: kod błędu
      `SLOT_NOT_OFFERED` / `23P01` nadal niesie **co najwyżej 5** alternatyw z horyzontu 14 dni.
      Wartości 5 i 14 pozostają literałami `create-booking.ts` i **nie wędrują** do agregatora
      ani do `contracts/sla.contract.mjs`. Zbieżność `MAX_ALTERNATIVES = 5` z
      `SLA.AUDITOR_DAILY_CAP.count = 5` jest **przypadkowa** — powiązanie ich byłoby błędem,
      który ujawniłby się dopiero przy zmianie limitu audytów.

---

## Przypadki brzegowe, które MUSZĄ mieć test

- **Pula pusta** (zero aktywnych pracowników po odfiltrowaniu `leave_status` i deklaracji):
  `slots: []`, `error: null`. „Brak terminów" i „awaria" muszą być rozróżnialne — AC11 vs ten.
- **Jeden pracownik w puli**: wynik identyczny z jego slotami, ale bez `resource_id`.
  Przypadek degeneracyjny, w którym anonimizacja jest najsłabsza i najłatwiej ją przeoczyć
  (przy jednej osobie „unia" wygląda jak zwykłe przepisanie).
- **Zmiana czasu na letni i z powrotem (obie doby)**: `date` slotu jest etykietą doby
  **lokalnej** (Europe/Warsaw) i po agregacji nadal jest. Dwa sloty o tym samym `start_at`
  nie mogą po deduplikacji dostać różnych `date`. Silnik już to testuje per-pracownik;
  tutaj pytanie brzmi, czy deduplikacja tego nie psuje.
- **Sloty z różnych dni o tej samej godzinie lokalnej** nie są duplikatami — klucz
  deduplikacji to `start_at` w milisekundach (moment), nie godzina.
- **Współbieżność / świeżość**: agregacja jest odczytem i **nie daje żadnej gwarancji**, że
  zwrócony slot da się zarezerwować. Test musi to utrwalić jako zachowanie zamierzone:
  nośnikiem gwarancji pozostaje `bookings_no_overlap_per_resource`
  (`FLD-BOOKING-ATOMIC-ASSIGN`). Zakaz dla implementera: żadnej blokady, rezerwacji wstępnej
  ani „miękkiego holdu" w tej funkcji.
- **Idempotencja odczytu**: dwa wywołania na niezmienionych danych dają identyczny wynik
  (ta sama treść i ta sama kolejność).
- **Uprawnienia**: `findPoolSlots` — tak jak `findAvailableSlots` i `getEffectiveAvailability` —
  jest **czystą funkcją domenową bez sprawdzania roli**. Bramka autoryzacyjna należy do
  wywołującego (Server Action / Route Handler). Test ma to potwierdzać przez brak zależności
  od sesji, a nie przez atrapę bramki.

---

## Poza zakresem (jawnie)

- Podmiana źródła terminów w `apps/b2c-web` (Google Calendar → baza), `Step8Booking.tsx`,
  `getFomoSlots.ts`, martwy `app/api/calendar/slots/route.ts` — `B2C-BOOKING-SLOT`.
- Jakikolwiek Route Handler, Server Action, endpoint HTTP czy transport między aplikacjami —
  patrz D-1, decyzja przed implementacją.
- Zmiany w `findAvailableSlots` i w silniku — wejście jest DONE i nie jest tu ruszane.
  Jeśli agregacja wymaga zmiany silnika, to jest sygnał, że WO jest źle pocięty: zgłoś, nie łataj.
- Prezentacja: format godzin, paginacja, „najbliższy wolny termin", grupowanie po dniach.
- Limity antyabuse'owe / rate limiting publicznego odczytu — należą do warstwy transportu (D-1).
- `getFomoSlots.ts` i jego komunikat „N wolnych terminów w tym tygodniu" — patrz R-2.

---

## Decyzje wymagane przed implementacją

### D-1 (BLOKUJĄCA dla dostarczenia do B2C, NIEBLOKUJĄCA dla tego WO) — gdzie mieszka kod i jak dociera do B2C

Stan faktyczny, nie domysł:
- `findAvailableSlots` importuje `@repo/database` (Prisma) i `@klikklima/contracts`, żyje
  w `apps/b2b-web/src/lib/schedule/`.
- `apps/b2b-web` nazywa się `@apps/b2b-web`, jest `private`, **nie ma pola `exports`** —
  nie jest importowalny jako pakiet.
- `apps/b2c-web/tsconfig.json` ma tylko `paths: { "@/*": ["./*"] }` — brak ścieżki do b2b-web.
- **W repo nie istnieje ani jeden przykład wywołania HTTP z `apps/b2c-web` do `apps/b2b-web`**
  (grep na `B2B_URL`, `NEXT_PUBLIC_B2B`, `localhost:3001`: zero trafień). Jedyne Route Handlery
  w b2b-web to publiczne webhooki (`api/webhooks/shipping`, `api/webhooks/services-cron`) —
  czyli wejścia od zewnętrznych dostawców, nie kanał między własnymi aplikacjami.
- `apps/b2c-web` **ma** `@repo/database` w zależnościach, ale go nie używa.

Wariant nie ma precedensu do naśladowania, więc jest to decyzja, nie wybór techniczny agenta:

| | Wariant | Za | Przeciw |
|---|---|---|---|
| a | Wyniesienie `src/lib/schedule/*` do nowego pakietu workspace (np. `@repo/scheduling`), importowanego przez obie aplikacje | jedna implementacja silnika; zero nowego transportu; zero nowej powierzchni ataku | ruch ~5 plików + ich testów; b2c-web zaczyna realnie używać Prismy, co jest napięciem z ADR-001 („B2C: `supabase-js`, RLS aktywne") |
| b | Publiczny Route Handler w `apps/b2b-web` (`/api/public/slots`), wołany z b2c-web | kod zostaje na miejscu; jawna granica zaufania | tworzy **nowy wzorzec** komunikacji między aplikacjami: sprzężenie wdrożeniowe, sekret/rate limit, dwa środowiska muszą się widzieć |
| c | Reimplementacja agregacji w `apps/b2c-web` na `supabase-js` | zgodne z literą ADR-001 | **druga implementacja silnika terminów** (CAL-SLOT-ENGINE, risk HIGH) — dokładnie ta klasa rozjazdu, przed którą ostrzega zasada zerowa. Dodatkowo klient anonimowy nie ma prawa czytać `bookings` (B2C-RLS-PUBLIC AC3), więc i tak wymagałoby service_role albo zmiany RLS |

**Rekomendacja analityka: (a).** (c) jest odrzucane merytorycznie — duplikacja silnika o ryzyku
HIGH. (b) kupuje zgodność z literą ADR-001 ceną nowego, nieistniejącego dziś wzorca operacyjnego.

**Dlaczego to nie blokuje tego WO:** `findPoolSlots` jest czystym przekładem wyniku silnika i jej
treść oraz wszystkie AC1–AC18 są identyczne w każdym z wariantów. Dlatego implementacja startuje
w `apps/b2b-web/src/lib/schedule/pool-slots.ts`, a test w
`apps/b2b-web/tests/pool-slots-aggregate.test.ts` (konwencja: atrapa Prismy jak w
`available-slots-engine-p-d.test.ts`, tag `// @REQ: CAL-POOL-AGGREGATE` przy każdym `it`).
Późniejsze przeniesienie pliku do pakietu jest zmianą ścieżki importu, nie zmianą zachowania.

**WYMAGA DECYZJI:** wariant dostarczenia do B2C (a / b / c). Decyzja jest potrzebna
przed `B2C-BOOKING-SLOT`, nie przed tym WO.

### D-2 — czy `duration_minutes` w ogóle ma trafiać do klienta B2C

`PoolSlotsResult` przenosi `duration_minutes` i `travel_buffer_minutes` (AC13). Czas trwania
wizyty klient i tak widzi jako `end_at − start_at`. **`travel_buffer_minutes` to natomiast
parametr operacyjny firmy** — nie jest tożsamością ani obłożeniem pracownika, ale też nie jest
informacją, której klient potrzebuje. AC13 wymaga jego obecności w wyniku **funkcji**; czy warstwa
transportu (D-1) ma go odciąć przed wysyłką do przeglądarki — to pytanie do `B2C-BOOKING-SLOT`.
Domyślnie: funkcja go zwraca, transport decyduje. Odnotowane, żeby nie wyciekł przez przypadek.

---

## Ryzyka i nieznane

- **R-1 — dokumenty nie rozstrzygają, czy „nie ujawnia obłożenia" znaczy też „nie ujawnia liczby
  wolnych slotów puli".** `FIELD-APP-PLAN` §6.3 mówi wyłącznie o „sumie wolnych terminów całej
  puli". Kryterium wymagania zabrania ujawniania „tożsamości ani obłożenia **pracownika**" —
  liczba pozycji na liście ujawnia obłożenie **puli**, nie osoby. Przyjęta w tym WO wykładnia
  (AC5): zakaz dotyczy informacji **per-pracownik**; sama długość listy jest nieunikniona, bo
  klient musi te terminy zobaczyć. Jeśli intencją było coś silniejszego, AC5 trzeba zaostrzyć —
  i wtedy dotyka to R-2.
- **R-2 — `getFomoSlots.ts` już dziś publikuje liczbę wolnych terminów** („N wolnych terminów
  w tym tygodniu") na stronie głównej, mieszając ją z limitem z `system_config.fomo_config`
  i fallbackiem `{ slots: 3 }` przy błędzie. Jeżeli R-1 rozstrzygnie się „silniej", ten
  komponent jest naruszeniem **istniejącym**, niezależnym od tego WO. Nie naprawiać przy okazji:
  osobne ID.
- **R-3 — `getFomoSlots.ts` odpytuje tabelę `leady`**, czyli nazwę porzuconą przez ADR-002,
  którą hook `guard-forbidden` blokuje przy zapisie pliku. Implementer, który z jakiegokolwiek
  powodu dotknie tego pliku, **nie zapisze go**. Kolejny powód, żeby B2C zostało poza zakresem.
- **R-4 — `apps/b2c-web/lib/supabaseClient.ts` preferuje `SUPABASE_SERVICE_ROLE_KEY`** przed
  kluczem anonimowym i jest importowany z modułów bez `"use server"`. To osobna sprawa
  (`B2C-RLS-PUBLIC`, `SEC-SERVICE-KEY-SERVER-ONLY`), ale ma bezpośredni wpływ na D-1: argument
  „ADR-001 mówi, że B2C używa RLS" opisuje intencję, a kod tej intencji dziś nie realizuje.
  Decydujący o D-1 powinien to wiedzieć.
- **R-5 — testy silnika działają na atrapie Prismy.** Test agregacji odziedziczy tę własność
  i będzie dowodził wyłącznie przekładu wyniku, nie poprawności danych. To jest tu akceptowalne:
  przedmiotem wymagania jest **transformacja**, a nie odczyt z bazy. Odnotowane, żeby nikt nie
  odczytał zielonego testu jako dowodu, że klient B2C zobaczy prawdziwe terminy.
- **R-6 — martwy `apps/b2c-web/app/api/calendar/slots/route.ts`.** Kryterium `B2C-BOOKING-SLOT`
  nazywa go źródłem listy slotów, podczas gdy realnym źródłem jest Server Action
  `app/actions/calendar.ts` (Google Calendar), a route nie ma konsumentów. Rejestr opisuje tu
  stan sprzed rozbudowy Triage. **To nie jest sprzeczność do rozstrzygnięcia w tym WO** —
  do poprawienia przy `B2C-BOOKING-SLOT`, żeby test-author nie celował w martwy plik.
