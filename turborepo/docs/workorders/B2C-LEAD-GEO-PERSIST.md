# WO: B2C-LEAD-GEO-PERSIST — B2C przestaje gubić współrzędne adresu

**Cel:** współrzędne, które Google Places już dziś zwraca i za które już dziś płacimy, mają trafiać
do bazy. Bez nich geofencing Field App (20 m, 3 km) nie ma z czego liczyć, a każdy adres wymaga
ponownego, odpłatnego geokodowania.

**Rola:** `test-author` (RED) → `implementer-server` (GREEN). **Okno kontraktowe: NIEWYMAGANE** —
kolumny już istnieją (commit `75da8c5`), kontrakt się nie zmienia. To jedyna pozycja fazy 0
dotykająca kodu aplikacyjnego.

## Wymagania

| ID | Stan | Uwaga |
|---|---|---|
| `FLD-GEO-COORDS` | powstaje w WO-A, status `TODO` | ID do tagu `// @REQ:` — **ten WO nie startuje przed merge WO-A**, inaczej `kk-trace` zgłosi nieznany tag |
| `B2C-LEAD-ENTRY` | `TODO`, HIGH, 0 testów | jego kryterium „istnieje dokładnie jedna Server Action tworząca leada" **nie jest realizowane w tym WO** |
| `B2C-LEAD-ATOMIC` | `TODO`, HIGH, 0 testów | zapis współrzędnych nie może wprowadzić nowego, osobnego kroku zapisu |

## Kontekst kodu (zweryfikowany 2026-08-21)

### Istnieje

| Miejsce | Stan faktyczny |
|---|---|
| `apps/b2c-web/components/triage/steps/Step8Booking.tsx:184-193` | `leadData` zawiera `lat: coordinates?.lat`, `lng: coordinates?.lng` i trafia do `saveLead(leadData)` (linia 195) |
| `apps/b2c-web/app/actions/saveLead.ts:6-14` | `interface SaveLeadData` — **nie deklaruje `lat` ani `lng`**. TypeScript przepuszcza, bo `leadData` nie jest literałem adnotowanym tym typem (brak sprawdzania nadmiarowych właściwości poza literałem) |
| `apps/b2c-web/app/actions/saveLead.ts:32-39` | insert do `adresy` zapisuje wyłącznie `klient_id` i `ulica_miasto`. Współrzędne są odrzucane **dla każdego leada** |
| `packages/database/prisma/schema.prisma:63-64` | `latitude Float? @db.DoublePrecision`, `longitude Float? @db.DoublePrecision` |
| `supabase/migrations/20260820130000_fld_geo_coords_address_coordinates.sql` | `ADD COLUMN IF NOT EXISTS latitude/longitude DOUBLE PRECISION` — **nieuruchomiona na żadnej bazie** |
| `apps/b2c-web/tests/actions/*.test.ts` | wzorzec testu Server Action w tym repo: `vi.hoisted` + `vi.mock('@/lib/supabaseClient')`, asercje na argumentach przekazanych do `from()/insert()`. Bez żywej bazy |
| `tools/kk-naming-baseline.json:69-70` | `saveLead.ts` ma zamrożone 6 naruszeń `adr002-pl-columns` i 3 `adr002-pl-tables`. Liczby **nie mogą wzrosnąć** |

### Brakuje

1. `lat`/`lng` w `SaveLeadData` i w insercie do `adresy`.
2. Jakiegokolwiek testu na `saveLead.ts` — ta ścieżka nie ma dziś pokrycia w ogóle.

### Znalezisko, które zmienia treść zadania

`apps/b2c-web/app/actions/leads.ts:73-82` (`submitFinalTriage`) wstawia do `adresy` pola **`lat` i `lng`**:

```js
.from("adresy").insert([{ klient_id: clientId, ulica_miasto: addressData.fullAddress, lat: addressData.lat, lng: addressData.lng }])
```

Kolumn o nazwach `lat`/`lng` **nie ma ani w `schema.prisma`, ani w żadnej migracji w repozytorium** —
migracja z `75da8c5` dodała `latitude`/`longitude`. Wniosek: albo ta ścieżka wywala się na
`addressError` przy każdym wywołaniu, albo baza produkcyjna ma kolumny nieujęte w schemacie. Jedno
i drugie trzeba sprawdzić przed pisaniem kodu.

To koryguje `field_app_requirements.md#6.3`, który podaje `leads.ts` jako ścieżkę „która **zapisuje**
`lat`/`lng`" — dokument opisuje intencję kodu, nie jego skutek. `submitFinalTriage` nie ma dziś
żadnego wywołania w `apps/b2c-web` (jedyne wywołanie zapisu leada z UI to `saveLead` w `Step8Booking.tsx:195`).

## Zmiana kontraktu

**NIEWYMAGANA.** Kolumny istnieją, `FLD-GEO-COORDS` powstaje w WO-A. Ten WO nie dotyka `contracts/`,
`schema.prisma` ani `supabase/migrations/`.

## Kryteria akceptacji

- [ ] **AC1** Ukończona rezerwacja z geokodowanym adresem tworzy wiersz adresu, w którym `latitude`
      i `longitude` mają wartości przekazane przez formularz. Test sprawdza **argumenty przekazane do
      `insert()`**, nie sam brak wyjątku.
- [ ] **AC2** Wartość zapisana jest identyczna z otrzymaną, bez zaokrąglenia i bez konwersji na tekst —
      test używa współrzędnej z co najmniej sześcioma miejscami po przecinku i porównuje dokładnie.
- [ ] **AC3** Adres bez geokodowania (`coordinates === undefined`) zapisuje się z `null` w obu polach,
      a lead **powstaje normalnie**. Brak współrzędnych nie jest błędem walidacji.
- [ ] **AC4** Współrzędna o wartości `0` zapisuje się jako `0`, nie jako `null`. To jest test na
      `??` kontra `||` — jedyna różnica między poprawną a niepoprawną implementacją jest niewidoczna
      dopóki ktoś nie sprawdzi tego wprost.
- [ ] **AC5** Zapis współrzędnych odbywa się w **tym samym** wywołaniu insertu do `adresy`, co dziś —
      nie powstaje drugi zapis ani `update` po fakcie (`B2C-LEAD-ATOMIC` żąda niepodzielności,
      a każdy dodatkowy krok to kolejne miejsce, w którym lead zostaje bez adresu).
- [ ] **AC6** `SaveLeadData` deklaruje oba pola jako opcjonalne liczby. Wywołanie `saveLead` z obiektem
      zawierającym współrzędne kompiluje się bez `as any` i bez `@ts-ignore` (oba zabronione hookiem).
- [ ] **AC7** `node tools/kk-naming.mjs --check-baseline` nie wykazuje wzrostu liczby naruszeń dla
      `apps/b2c-web/app/actions/saveLead.ts` (`latitude`/`longitude` są angielskie — wzrost oznaczałby,
      że przy okazji wjechała polska nazwa).
- [ ] **AC8** `node tools/kk-trace.mjs` pokazuje `FLD-GEO-COORDS` z co najmniej jednym testem
      i bez nieznanych tagów `@REQ`.

## Przypadki brzegowe, które MUSZĄ mieć test

- **`lat === 0`** (AC4). Polska nigdy nie leży na zerowym południku, więc ten błąd nigdy nie ujawni
  się na danych produkcyjnych — i dlatego zostanie w kodzie na lata, aż ktoś użyje tej funkcji gdzie indziej.
- **Brak współrzędnych** (AC3). Adres wpisany ręcznie, odmowa geokodowania, awaria Google Places —
  lead musi powstać. Kolumny są nullowalne właśnie po to.
- **Współrzędne jako tekst.** Jeżeli formularz poda `"52.2297"` zamiast `52.2297`, do kolumny
  `double precision` trafi wartość skonwertowana przez PostgREST albo błąd — test musi rozstrzygnąć,
  które z tych dwóch zachowań jest oczekiwane, a nie zostawiać tego przypadkowi.
- **Kolejność wdrożenia.** Kod zapisujący do kolumny, której nie ma w bazie, przewraca **całe**
  tworzenie leada (`addressError` jest rzucany, nie logowany) — czyli awaria całego wejścia do lejka,
  nie utrata jednego pola. Patrz Ryzyka R1.

## Poza zakresem

- **Likwidacja duplikatu ścieżek** (`saveLead.ts` vs `leads.ts`). To `B2C-LEAD-ENTRY`, wymaganie HIGH
  z własnym, obszernym zestawem kryteriów (status leada spoza maszyny stanów, komplet danych,
  dwuwarstwowa walidacja). Doklejenie go tutaj zamienia dwugodzinne zadanie w trzecią pętlę GREEN.
  **Ale:** ten WO nie może pogorszyć sytuacji — jeżeli implementacja dotyka `leads.ts`, to wyłącznie
  po to, żeby nazwy kolumn przestały być fikcyjne, bez zmiany zachowania.
- Walidacja zakresu współrzędnych (`-90..90`, `-180..180`). Migracja świadomie nie ma `CHECK`
  (uzasadnienie w nagłówku `20260820130000`), a walidacja aplikacyjna to zakres `B2C-BOOKING-VALIDATION`.
- Cokolwiek związanego z liczeniem odległości. To `FLD-GEO-UNLOCK` / `FLD-GEO-EN-ROUTE`, faza 3.
- Uruchomienie migracji na bazie — krok człowieka.

## Ryzyka i nieznane

- **R1 — migracja nie została uruchomiona na żadnej bazie.** Wdrożenie kodu przed migracją oznacza,
  że **każda** rezerwacja w B2C kończy się błędem (`addressError` przerywa `saveLead`). Kolejność jest
  odwrotna niż zwykle: najpierw migracja, potem kod. To musi być zapisane w opisie PR-a, bo test
  jednostkowy z mockowanym klientem Supabase nigdy tego nie wykryje.
- **R2 — rozbieżność `lat`/`lng` kontra `latitude`/`longitude` w `leads.ts`** (patrz „Znalezisko").
  Do sprawdzenia na żywej bazie **przed** implementacją: jeżeli kolumny `lat`/`lng` tam istnieją,
  mamy dryf schematu wobec repozytorium i osobny problem do zgłoszenia; jeżeli nie istnieją,
  `submitFinalTriage` jest martwym kodem, który wywala się przy pierwszym wywołaniu.
- **R3 — brak testów na `saveLead.ts` w ogóle.** Test pisany w tym WO będzie pierwszym. Kuszące
  będzie dopisanie przy okazji asercji na status leada (`'NEW_LEAD'`) czy na komplet danych —
  to należy do `B2C-LEAD-ENTRY` i rozlewa zakres.
- **R4 — dokładność.** `double precision` daje ~15 cyfr znaczących; Google Places zwraca zwykle 7-8
  miejsc po przecinku. Zaokrąglenie w drodze (np. przez `toFixed`) obniżyłoby dokładność poniżej
  progu istotnego dla promienia 20 m — stąd AC2 porównuje wartości dokładnie.
