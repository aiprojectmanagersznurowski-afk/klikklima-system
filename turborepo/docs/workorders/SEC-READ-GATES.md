# WO: SEC-READ-GATES — bramka `can(role, <zasób>, 'read')` w odczytach panelu B2B

Data: 2026-09-02 · Autor: `spec-analyst` · Źródło: `docs/workorders/PLAN-KOLEJNYCH-ZADAN.md` § „P0 — SEC-READ-GATES"

## Wymagania

- Nowe, do zarejestrowania przez `contract-steward`: **`SEC-AUTHZ-B2B-READS`** (treść w § Faza 4).
- Powiązane istniejące: `SEC-AUTHZ-B2B-MUTATIONS` (DONE, jawnie zawężone do mutacji — nie obejmuje odczytów),
  `SEC-RLS-AUDITOR-SCOPE` (DONE, objęło **jeden** odczyt: `getLeads`), `SEC-LEADS-LIST-MINIMIZE`,
  `SEC-RODO-DELETE` / `CLIENT-ANONYMIZATION-RODO` (kontekst: `/customers` wystawia PII).
- Kontrakt uprawnień: `contracts/rbac.contract.mjs` `MATRIX` (linie 29–36). **Ten WO nie zmienia macierzy.**

---

## Kontekst kodu (zweryfikowany 2026-09-02)

### Istnieje

- Wzorzec bramki odczytu z wariantem `:own`: `getLeads()` — `apps/b2b-web/src/app/(dashboard)/leads/actions.ts:316-350`
  (`getCurrentActorRole()` → `can(role,'leads','read')` → `access === 'own'` → `prisma.audytorzy.findUnique({where:{email}})`
  → `scopeWhere = { audytor_id: own.id }`, fail-closed na czterech ścieżkach).
- Wzorzec bramki odczytu bez `:own`, zwracający `[]`: `getAuditors()` — `leads/actions.ts:78-88`.
- Dalsze zabramkowane odczyty: `getLogisticsLeads()`, `getLeadDetail()`, `getAuditorForEdit()`, `getCrewForEdit()`.
- Wzorzec bramki na poziomie strony: `settings/page.tsx` (`try/catch` wokół `getCurrentActorRole()` → `can(...,'read') !== 'yes'` → `notFound()`)
  oraz `leads/page.tsx` (narrowing wyniku `getLeads()` → `notFound()`).
- `getCurrentActorRole()` (`apps/b2b-web/src/utils/supabase/server.ts:56`) — `cache()`, zwraca `Role | null`, fail-closed.
- `can()` (`packages/contracts/src/generated/rbac.ts:99`) — zwraca `'no' | 'yes' | 'own'`.
- Kolumna `zespoly_monterskie.email String? @unique` (`schema.prisma:218`) + migracja
  `20260822120000_fld_availability_split_employee_email_unique.sql` — **ścieżka „kto to jest zalogowany monter" ISTNIEJE.**
- Kolumna `zespol_id` na `instalacje` (`schema.prisma:267`, indeks), `serwisy` (`:294`, indeks), `usterki_incidents` (`:521`, indeks).
- `tools/kk-authz-gate.mjs` — skanuje wyłącznie MUTACJE (`MUTATING`, linia 66); wpięty do `scripts/verify.sh:67`.
- Testy uprawnień: `apps/b2b-web/tests/*-authz-gates.test.ts`, `leads-auditor-scope.test.ts`, `settings-page-authz.test.ts`.

### Brakuje

Siedem eksportowanych funkcji odczytowych bez `can()` (skan AST, potwierdzony 2026-09-02 — patrz § Decyzja D4):

| # | Funkcja | Plik | Zasób RBAC | `read` wg `MATRIX` | Dziś |
|---|---|---|---|---|---|
| 1 | `getCustomers` | `customers/actions.ts:26` | `clients` | `admin`, `dyspozytor` | każdy zalogowany, PII |
| 2 | `getCrews` | `crews/actions.ts:33` | `crews` | `admin`, `dyspozytor` | każdy zalogowany |
| 3 | `getCrews(installationDate)` | `leads/actions.ts:122` | `crews` | `admin`, `dyspozytor` | każdy zalogowany |
| 4 | `getAuditors` | `auditors/actions.ts:46` | `auditors` | `admin`, `dyspozytor` | każdy zalogowany |
| 5 | `getInstallations` | `installations/actions.ts:20` | `installations` | `admin`, `dyspozytor`, `monter:own` | każdy widzi wszystkie |
| 6 | `getUpcomingServices` | `services/actions.ts:28` | `services` | `admin`, `dyspozytor`, `monter:own` | każdy widzi wszystkie |
| 7 | `getIncidents` | `incidents/actions.ts:19` | `incidents` | `admin`, `dyspozytor`, `monter:own` | każdy widzi wszystkie |

Sześć stron bez jakiejkolwiek bramki: `customers/page.tsx`, `crews/page.tsx`, `auditors/page.tsx`,
`installations/page.tsx`, `services/page.tsx`, `incidents/page.tsx`.
`middleware.ts` sprawdza wyłącznie OBECNOŚĆ e-maila w `AuthorizedUser` (+ osobna gałąź `audytorzy.is_active` dla roli `audytor`);
roli nie porównuje z niczym i nie ogranicza tras.

## Zmiana kontraktu

**WYMAGANA — wyłącznie rejestracja nowego wymagania `SEC-AUTHZ-B2B-READS` w `contracts/requirements.contract.mjs`** (+ `node tools/kk-codegen.mjs`).
Macierz `MATRIX` zostaje bez zmian: wszystkie potrzebne wiersze i warianty `:own` już w niej są.

`tools/kk-authz-gate.mjs` **NIE** jest ścieżką chronioną (`contractProtectedPaths` w `tools/kk.config.mjs:14-19` to
`contracts/`, `packages/contracts/src/generated/`, `schema.prisma`, `supabase/migrations/`) — okna nie wymaga,
ale zakres zapisu do `tools/` ma wyłącznie rola `contract-steward` (`agentWriteScopes`, `kk.config.mjs:24`).

**Zmiana schematu bazy: NIEWYMAGANA** (patrz D1).

---

## Rozstrzygnięte decyzje

### D1 — co znaczy `monter:own` (decyzja pierwszej wagi)

**Rozstrzygnięcie: `monter:own` = „rekord jest przypisany do ekipy, do której należy zalogowany monter",
identyfikacja przez `zespoly_monterskie.email = <e-mail z sesji>`. Dzisiejszy schemat to UMOŻLIWIA — zmiana schematu nie jest potrzebna.**

Ustalenia, które to rozstrzygają:

- `zespoly_monterskie.email String? @unique` **istnieje** (`schema.prisma:218`), z migracją `20260822120000`.
  Przesłanka z briefu („być może nie ma kolumny `email`, więc `monter:own` jest niewykonalne") jest **nieprawdziwa** — sprawdzone.
- Wzorzec `prisma.zespoly_monterskie.findUnique({ where: { email: user.email } })` już działa w repo:
  `crews/actions.ts:122` (`setSelfAvailabilityAction`) i `crews/actions.ts:166` (`acceptLegalDocumentVersionAction`).
- Wiązanie „rekord → ekipa": `instalacje.zespol_id`, `serwisy.zespol_id`, `usterki_incidents.zespol_id` (wszystkie nullable, wszystkie z indeksem).

**Kształt `scopeWhere` per zasób:**

| Zasób | `scopeWhere` dla `access === 'own'` |
|---|---|
| `installations` (`prisma.instalacje`) | `{ zespol_id: own.id }` |
| `services` — zapytanie po `prisma.serwisy` | `{ OR: [ { zespol_id: own.id }, { AND: [ { zespol_id: null }, { instalacja: { zespol_id: own.id } } ] } ] }` |
| `services` — zapytanie po `prisma.instalacje` (wiersze `forecast`) | `{ zespol_id: own.id }` (dokłada się do istniejącego `next_service_date: { not: null }`) |
| `incidents` (`prisma.usterki_incidents`) | `{ OR: [ { zespol_id: own.id }, { AND: [ { zespol_id: null }, { instalacja: { zespol_id: own.id } } ] } ] }` |

Uzasadnienie wariantu `OR` dla `serwisy`/`usterki_incidents`: obie kolumny `zespol_id` są nullable i w praktyce
puste (przypisanie ekipy żyje na `instalacje.zespol_id` — patrz `assignCrewToLead`). Sam filtr `zespol_id = own.id`
pokazałby monterowi listę pustą także dla jego własnych montaży, czyli „naprawa", po której funkcja przestaje działać.
Dziedziczenie z instalacji jest zawężone do rekordów **bez własnego** przypisania — rekord jawnie przypisany innej
ekipie nigdy nie wpada do zakresu montera. To jest reguła węższa niż zwykły `OR` i taka ma zostać.

**Fail-closed (kopiuje `getLeads`):** brak sesji / brak `user.email` / brak wiersza w `zespoly_monterskie` /
`aktywny === false` → **odmowa**, nigdy `where` zbudowane z `undefined` i nigdy `findMany` bez filtra.
(Uwaga na asymetrię nazw: audytor ma `is_active`, ekipa ma `aktywny`.)

**Odrzucona alternatywa:** fail-closed „monter dostaje odmowę na te trzy zasoby do czasu osobnego WO".
Odrzucona, bo jest niezgodna z kontraktem (`MATRIX` przyznaje `monter:own` na `installations`/`services`/`incidents`),
a jedyny argument za nią — brak ścieżki identyfikacji — okazał się nieprawdziwy. Utrwalałaby też stan, w którym
żadne miejsce w repo nie implementuje `:own` poza `getLeads`.

### D2 — kształt odmowy per funkcja

**Zasada: rozróżnienie „brak uprawnień" ⟂ „brak danych" niesie STRONA (`notFound()`), a nie typ zwracany akcji.
Server Action jest drugą linią obrony przed bezpośrednim POST-em, gdzie nie ma komu wyświetlić komunikatu.**

| Funkcja | Kształt odmowy | Uzasadnienie |
|---|---|---|
| `getCustomers` | `{ customers: [], totalPages: 0 }` | typ obiektowy zostaje bez zmian; strona i tak nie wyrenderuje się dla nieuprawnionej roli (D3) |
| `getCrews` (×2), `getAuditors` | `[]` | dokładnie wzorzec `getAuditors()` z `leads/actions.ts:78-88`, zaakceptowany w poprzedniej turze |
| `getInstallations`, `getUpcomingServices`, `getIncidents` | `[]` | j.w.; dla `monter` `[]` to nie odmowa, tylko pusty zakres — i tak jest nieodróżnialne z definicji |

**Odrzucona alternatywa:** unia `{ success:false, error }` wzorem `getLeads`. Kosztuje zmianę sygnatury sześciu
funkcji, sześciu `page.tsx` i pięciu komponentów klienckich (`customers-client`, `crews-client`, `auditors-client`,
`installations-client`, `services-client`, `incidents-client`), a jedyną wartość — komunikat dla użytkownika —
i tak przykrywa `notFound()` ze strony. Uwaga: memoria projektu słusznie mówi, że „akcja zwracająca `void`
maskuje odmowę" — to dotyczyło **mutacji**, gdzie UI pokazywało sukces mimo odrzucenia. Tu odmowa nie jest
mylona z sukcesem, bo strona zwraca 404.

Warunek konieczny tej decyzji: **bramka strony jest obowiązkowa dla wszystkich sześciu widoków** (AC7–AC9).
Bez niej `[]` faktycznie gubiłoby odmowę i decyzja D2 traci uzasadnienie.

### D3 — bramka na poziomie strony: `notFound()`

**Rozstrzygnięcie: `notFound()`.** Spójne z jedynymi dwoma precedensami w repo (`leads/page.tsx:37`,
`settings/page.tsx:18`). `redirect('/leads')` odpada dodatkowo dlatego, że `/leads` jest zamknięte dla montera
(`SEC-RLS-AUDITOR-SCOPE` → `notFound()`), więc przekierowanie prowadziłoby montera z 404 na 404, tylko dłuższą drogą.

Kształt bramki (kopia `settings/page.tsx`, `getCurrentActorRole()` w `try/catch`, przed wywołaniem akcji odczytu):

- `customers`, `crews`, `auditors`: `can(role, <zasób>, 'read') !== 'yes'` → `notFound()`.
- `installations`, `services`, `incidents`: `access === 'no'` (czyli `audytor`, brak roli, wyjątek) → `notFound()`;
  `'yes'` i `'own'` renderują (monter widzi swój zakres).

Poza zakresem (do osobnego ID): ukrycie pozycji menu w `layout.tsx` — `navItems` jest dziś statyczne.

### D4 — rozszerzenie `tools/kk-authz-gate.mjs` o odczyty: OD RAZU BLOKUJĄCE, bez etapowania

Kryterium: **eksportowana deklaracja `function` w pliku `actions.ts` pod `apps/b2b-web/src/app`, która w ciele
wywołuje `<klient>.<model>.<metoda>(` z metodą ∈ {`findMany`, `findUnique`, `findFirst`, `findUniqueOrThrow`,
`findFirstOrThrow`, `count`, `groupBy`, `aggregate`}, a nie wywołuje `can(`** (dokładnie ta sama maszyneria AST,
tylko drugi zbiór metod; `getCurrentActorRole` NIE jest tu warunkiem — `can()` wystarcza, bo bez roli nie ma czego podać).

**Pomiar na dzisiejszym repo (nie oszacowanie — wykonany skan AST 2026-09-02):**

- 34 eksportowane funkcje w `actions.ts` czytają Prismę; 27 ma `can()`, **7 nie ma**.
- Tych 7 to dokładnie lista z tabeli powyżej. **Zero fałszywych trafień.**
- Kontrola kolejności (pierwsze dotknięcie bazy przed pierwszym `can()`) na 27 zabramkowanych funkcjach odczytowych:
  **zero naruszeń** — rozszerzenie nie wywoła też lawiny w kategorii `ordering`.
- Funkcje pomocnicze (`bucketToStatus`, `invalidCrewCerts`, `isCertValidForDate`) nie są eksportowane albo nie dotykają
  Prismy — heurystyka „eksport + `actions.ts` + wywołanie klienta Prismy" sama je odsiewa, bez listy wyjątków.
- Blind spot: `export const x = async () => …` nie jest analizowany. Sprawdzone: w `apps/b2b-web/src/app/**/actions.ts`
  **nie ma dziś ani jednego takiego eksportu**, więc dziura jest realna, ale pusta. Do udokumentowania w nagłówku narzędzia.

Skoro po Fazie 2 skaner świeci zielono, **etapowanie (najpierw raport ostrzegawczy, potem bramka) jest zbędne i szkodliwe** —
tryb ostrzegawczy w `verify.sh:67` uczy ignorować własny wynik. Warunek: rozszerzenie ląduje **po** naprawie
(kolejność faz niżej), inaczej `verify.sh` jest czerwone od momentu commita.

Wymagane przy okazji: aktualizacja komentarza nagłówkowego narzędzia (dziś linia 19-20 mówi wprost
„Odczyty (findMany/findUnique/count/groupBy) nie liczą się") i tekstu raportu.

---

## Kryteria akceptacji

Wspólne dla AC1–AC7: zestawy ról dozwolonych i odrzuconych **wyliczane z `ROLES` i `can()`** z wygenerowanego
kontraktu, nie wpisane w test jako literały (wzorzec z `SEC-AUTHZ-B2B-MUTATIONS`).

- [ ] **AC1 `getCustomers`** — dla roli, dla której `can(role,'clients','read') !== 'yes'` (`audytor`, `monter`),
      wywołanie zwraca `{ customers: [], totalPages: 0 }` **oraz `prisma.klienci.findMany` i `prisma.klienci.count`
      nie zostały wywołane ani razu**. Dla `admin` i `dyspozytor` (osobno) lista wraca niepusta.
- [ ] **AC2 `getCrews` (`crews/actions.ts`)** — j.w. dla `crews.read`; przy odmowie `prisma.zespoly_monterskie.findMany` nie wołane.
- [ ] **AC3 `getCrews(installationDate)` (`leads/actions.ts`)** — j.w.; przy odmowie zwraca `[]`, a istniejący filtr
      certyfikatów i dostępności dla ról uprawnionych działa bez zmian (regresja: `crews-cert-availability`, `availability-pool-filter`).
- [ ] **AC4 `getAuditors` (`auditors/actions.ts`)** — j.w. dla `auditors.read`. Panel administracyjny nadal
      pokazuje audytorów `is_active: false` uprawnionej roli (celowa różnica wobec puli w `leads/actions.ts`).
- [ ] **AC5 `getInstallations`** — `admin`/`dyspozytor`: `findMany` bez klucza `zespol_id` w `where`.
      `monter` z rekordem w `zespoly_monterskie`: `findMany` wywołane z `where.zespol_id === <id ekipy z sesji>`.
      `audytor`: `[]` i **zero wywołań `prisma.instalacje.findMany`**.
- [ ] **AC6 `getUpcomingServices`** — `monter`: **oba** zapytania (`prisma.serwisy.findMany`, `prisma.instalacje.findMany`)
      dostają filtr ekipy wg tabeli z D1; `admin`/`dyspozytor`: żadne z nich nie dostaje filtra ekipy;
      `audytor`: `[]` i zero wywołań obu. Kryterium jest dowodzone **na argumencie przekazanym do `findMany`**,
      nie na kształcie zwróconych wierszy (mock zwraca to, co mu wpisano).
- [ ] **AC7 `getIncidents`** — j.w. dla `usterki_incidents`.
- [ ] **AC8 fail-closed montera (5 wariantów, każdy osobno, dla wszystkich trzech funkcji `:own`)**:
      brak sesji, brak `user.email`, `getCurrentActorRole()` rzuca wyjątek, brak wiersza w `zespoly_monterskie`
      o tym e-mailu, `zespoly_monterskie.aktywny === false` → wynik pusty **i żadne `findMany` nie zostało wywołane**.
      Żaden wariant nie może skończyć się `where: { zespol_id: undefined }` (Prisma zignorowałaby klucz i zwróciła WSZYSTKO).
- [ ] **AC9 strony `customers`, `crews`, `auditors`** — render dla roli bez `read` wywołuje `notFound()`
      i **nie wywołuje odpowiadającej funkcji odczytu**; dla `admin` i `dyspozytor` render przechodzi.
- [ ] **AC10 strony `installations`, `services`, `incidents`** — `audytor` (i brak roli, i wyjątek z `getCurrentActorRole`)
      → `notFound()` bez wywołania akcji; `monter` → strona renderuje się i dostaje zakres własnej ekipy.
- [ ] **AC11 rola wyłącznie z sesji** — testy wołają Server Action bezpośrednio, z pominięciem UI; żadna z siedmiu
      funkcji nie przyjmuje roli ani identyfikatora ekipy w argumencie.
- [ ] **AC12 `kk-authz-gate` po rozszerzeniu** — `node tools/kk-authz-gate.mjs` kończy się kodem 0 na naprawionym repo;
      test narzędziowy (na katalogu-fikstrze przez `KK_AUTHZ_SCAN_DIR`) dowodzi, że **usunięcie `can()` z funkcji
      czysto odczytowej daje exit 1** oraz że funkcja z `can()` po pierwszym `findMany` trafia do kategorii `ordering`.
      To jest jedyne AC, w którym zielony skaner cokolwiek znaczy — dla AC1–AC11 skaner NIE jest dowodem
      (nie ocenia poprawności pary zasób/zdolność).
- [ ] **AC13** — `bash scripts/verify.sh --full` zielone, w tym `node tools/kk-trace.mjs` wiążący
      `SEC-AUTHZ-B2B-READS` z testami (komentarz `@REQ` w plikach testowych).

## Przypadki brzegowe, które MUSZĄ mieć test

1. **`where` z `undefined`** — najgroźniejszy: `{ zespol_id: undefined }` w Prismie znaczy „bez filtra", czyli
   monter bez powiązanego rekordu zobaczyłby WSZYSTKO. AC8 wymaga dowodu przez BRAK wywołania, nie przez pusty wynik.
2. **Monter z `aktywny === false`** — konto ekipy wyłączone administracyjnie. `middleware.ts` tego nie sprawdza
   (gałąź `is_active` istnieje wyłącznie dla roli `audytor`), więc jedyną barierą jest ta bramka.
3. **Duplikat e-maila w `zespoly_monterskie`** — `findUnique` po `email` opiera się na indeksie unikalnym,
   który wg `docs/workorders/PLAN-KOLEJNYCH-ZADAN.md` § P3 mógł zniknąć w żywej bazie. Test na duplikacie nie jest
   wykonalny przez `findUnique`; do WERYFIKACJI NA ŻYWEJ BAZIE (patrz Ryzyka).
4. **Ten sam e-mail w `audytorzy` i w `zespoly_monterskie`** — rozstrzyga rola z `AuthorizedUser`, nie tabela
   pracownika. Test: konto `monter`, którego e-mail pasuje też do wiersza w `audytorzy` → zakres liczony z ekipy.
5. **Serwis osierocony** (`instalacja_id = null`, `zespol_id = null`) — nie może trafić do zakresu montera.
6. **Serwis przypisany innej ekipie na instalacji montera** — nie wpada do zakresu (`zespol_id` jawne wygrywa z dziedziczeniem).
7. **Deduplikacja w `getUpcomingServices`** — zbiór `installationIdsWithService` (`services/actions.ts:47`) jest budowany
   z JUŻ ZAWĘŻONEJ listy serwisów. Jeżeli instalacja montera ma serwis przypisany innej ekipie, wiersz `forecast`
   przestaje być wypierany i pojawia się duplikat. Test musi ustalić oczekiwane zachowanie (rekomendacja: wiersz
   `forecast` zostaje — monter widzi termin przeglądu swojej instalacji, nie widzi cudzego serwisu).
8. **Paginacja `getCustomers`** — `findMany` i `count` muszą być odcięte tą samą decyzją; odmowa nie może zwracać
   `totalPages` policzonego z pełnej tabeli (wyciek liczności zbioru PII).
9. **Regresja `/leads` dla audytora** — `leads/page.tsx` woła `getAuditors()` z `leads/actions.ts` obok `getLeads()`;
   audytor nie ma `auditors.read`, więc pula wraca `[]`. Test zamrażający: strona audytora nadal się renderuje
   (nie wywala się na pustej puli) i nie pokazuje selektora audytora z cudzymi nazwiskami.
10. **Bezpośrednie wywołanie POST z pominięciem UI** — dla każdej z siedmiu funkcji, rola `monter`/`audytor`.
11. **Wyjątek z `getCurrentActorRole()`** (np. baza niedostępna) → odmowa, nie nieobsłużony wyjątek i nie pełna lista.
12. **Idempotencja bramki wobec `cache()`** — `getCurrentActorRole` jest memoizowane na render; test nie może
    zakładać jednego wywołania na akcję (mock musi znieść N wywołań).

## Podział na fazy, role i kolejność

Kolejność jest tak dobrana, żeby **okno kontraktowe było potrzebne dopiero w Fazie 4** (okna wygasają po 30 min).

| Faza | Rola | Zakres zapisu | Okno |
|---|---|---|---|
| 1 | `test-author` | `apps/b2b-web/tests/*.test.ts` — RED dla AC1–AC11 (proponowane pliki: `customers-read-authz.test.ts`, `crews-read-authz.test.ts`, `auditors-read-authz.test.ts`, `installations-read-scope.test.ts`, `services-read-scope.test.ts`, `incidents-read-scope.test.ts`, `read-pages-authz.test.ts`) | nie |
| 2 | `implementer-server` | 7 funkcji w `*/actions.ts` + 6 plików `page.tsx` (bramka i, dla `customers`, kolejność wywołań) | nie |
| 3 | `reviewer` + `rls-security-auditor` | przegląd (tylko odczyt) | nie |
| 4 | `contract-steward` | rejestracja `SEC-AUTHZ-B2B-READS` w `contracts/requirements.contract.mjs`, `node tools/kk-codegen.mjs`, rozszerzenie `tools/kk-authz-gate.mjs` (D4) + test narzędzia (AC12 — pisze `test-author`, jeśli hook zablokuje `contract-steward` w `tests/`) | **tak** (tylko `contracts/`) |
| 5 | człowiek | `scripts/verify.sh --full`, commit, PR | — |

Uwaga proceduralna: Faza 4 łączy dwie ścieżki uprawnień — `contracts/` (okno + `contract-steward`) i `tools/`
(sam `contract-steward`, bez okna). Jeżeli okno wygaśnie, zmianę w `tools/` da się dokończyć bez niego.

### Treść wymagania do rejestracji (Faza 4)

```
R('SEC-AUTHZ-B2B-READS', {
  status: 'IMPLEMENTING',
  domain: 'security',
  risk: 'HIGH',
  source: 'docs/workorders/SEC-READ-GATES.md (skan AST tools/kk-authz-gate.mjs rozszerzony o odczyty,
    2026-09-02). Brak źródła w dokumentach architektury — regułę niesie wyłącznie MATRIX w
    contracts/rbac.contract.mjs. Dopełnia SEC-AUTHZ-B2B-MUTATIONS, które jest jawnie zawężone do
    mutacji, i SEC-RLS-AUDITOR-SCOPE, które objęło jeden odczyt (getLeads).',
  statement: 'Każda Server Action w apps/b2b-web, która ODCZYTUJE dane przez Prismę, rozstrzyga
    uprawnienie przez can(actorRole, <zasób>, "read") zanim powstanie pierwsze zapytanie do bazy.
    Wynik "own" zawęża zapytanie po właścicielu wyznaczonym z sesji, nigdy nie jest traktowany jak
    "yes". Strona (page.tsx) każdego widoku odmawia renderu przez notFound() roli, dla której
    can() zwraca "no". Granicę wyznacza tabela czytana, nie plik ani nazwa funkcji.',
  acceptance: [ … AC1-AC12 z tego WO, przepisane jako zdania obserwowalne … ],
})
```

## Poza zakresem (jawnie)

- **Zmiana `contracts/rbac.contract.mjs`** — macierz jest wystarczająca, ten WO jej nie dotyka.
- **Zmiana `schema.prisma` i migracje** — `zespoly_monterskie.email` i `zespol_id` już istnieją (D1).
- **`middleware.ts`** — ograniczenie tras po roli. Osobne ID; tu bramkujemy stronę i akcję, nie routing.
- **`layout.tsx` / `navItems`** — ukrycie pozycji menu dla ról bez `read`. Osobne ID (UI, nie granica uprawnień).
- **`apps/b2c-web`** — inny model ochrony (RLS + `supabase-js`).
- **Route Handlery, `lib/`, pliki akcji o innej nazwie niż `actions.ts`** — poza zasięgiem skanera i tego WO.
- **`:own` dla mutacji** (`updateInstallationStatus` z rolą `monter`) — świadomie odcięte przez
  `SEC-AUTHZ-B2B-MUTATIONS`; ten WO otwiera `:own` **wyłącznie dla odczytu** i tego rozstrzygnięcia nie zmienia.
- **Martwa `deleteServiceAction`** (kasuje `serwisy` po id z `instalacje`) — znany dług, osobna pozycja P2.
- **`audit_log` dla odczytów** — tabela nie istnieje; `AUDIT_REQUIREMENTS.mustLog` nie zawiera `read`.
- **Minimalizacja `select`** w naprawianych funkcjach (`getInstallations` i `getIncidents` robią `include: {…: true}`
  na pełnych rekordach) — realny dług PII, ale to inna klasa niż bramka. Osobne ID.
- **Cache/`force-dynamic`** — świadomie odłożone w planie.

## Ryzyka i nieznane

1. **Indeks unikalny na `zespoly_monterskie.email` w ŻYWEJ bazie.** Migracja `20260822120000` go tworzy,
   `schema.prisma:218` go deklaruje, ale P3 planu odnotowuje podejrzenie dryfu („zniknięty unique index").
   Jeżeli w bazie są duplikaty e-maili, `findUnique` zwróci wiersz nieokreślony, a zakres montera może wskazać
   cudzą ekipę. **Do sprawdzenia poza repo przed wdrożeniem** — greperem nie da się tego rozstrzygnąć.
2. **Konta nie-admin w `authorized_users`.** `SEC-RLS-AUDITOR-SCOPE` (2026-08-26) odnotowuje, że nie istniało wtedy
   ANI JEDNO konto inne niż `admin`; plan z 2026-09-01 twierdzi, że konta testowe `dyspozytor`/`audytor`/`monter`
   już istnieją. **Rozbieżność nierozstrzygalna z repo** — wpływa tylko na to, czy naprawa jest pożarowa,
   czy prewencyjna; nie zmienia zakresu prac.
3. **Semantyka `monter:own` nie ma źródła w dokumentach architektury.** `MATRIX` mówi `monter:own`, ale żaden
   dokument nie definiuje, czym jest „własne" dla montera. D1 to **decyzja tego WO** wywiedziona ze schematu
   (jedyna kolumna wiążąca to `zespol_id`), a nie cytat. Jeżeli biznes rozumie „własne" jako „przypisane
   imiennie monterowi", to dzisiejszy schemat tego nie wyraża (ekipa to `zespoly_monterskie`, nie osoba)
   i wymagałoby osobnego WO na model danych.
4. **Duplikat wiersza `forecast`** w `getUpcomingServices` pod zawężeniem (przypadek brzegowy 7) — rekomendacja
   podana, ale to zachowanie widoku, nie bezpieczeństwo; jeżeli człowiek zdecyduje inaczej, zmienia się jedno AC.
5. **`apps/b2b-web` nie ma skryptu `check-types`** (P2.1 planu), więc `verify.sh` nie zapali się na błędzie `tsc`
   w zmienionych `page.tsx`. Fazę 2 należy domknąć ręcznym `tsc --noEmit` albo najpierw zrobić P2.1.
6. **Blind spot skanera** `export const … = async () => …` — dziś pusty, ale nic nie broni przed dopisaniem takiej
   akcji jutro. Świadomie zostawiony jako udokumentowany brak, nie naprawiany w tym WO.
