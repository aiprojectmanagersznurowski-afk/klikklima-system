# WO: FLD-API-LAYER — warstwa zapisu aplikacji terenowej (Route Handlery + `can()`)

**Status:** gotowy do RED **częściowo**. Kryteria 1, 2, 4, 6 są w pełni testowalne dziś.
Kryterium 3 (ślad odmowy w `audit_log`) i kryterium 5 (klucz idempotencji) czekają na
**D-API-1** i **D-API-2** — obie wymagają migracji, czyli okna kontraktowego i roli
`contract-steward`, a nie rozstrzygnięcia przez analityka. Nie startować RED dla AC3 i AC5
przed decyzją.

**Gałąź:** `feat/field-app-foundation` (worktree `kk-field/turborepo`).
**Etap:** 1 (fundament, moduł M1) wg `FIELD-APP-I-PODPISY-ZAKRES.md` rozdz. 7.2.

---

## Cel

Zbudować **jedną, wąską warstwę wejścia** dla aplikacji terenowej: token → aktor → `can()` →
**istniejąca** funkcja domenowa → odpowiedź, plus mechanizm idempotencji. Warstwa nie zawiera
logiki biznesowej. Wszystko, co przyjdzie potem (`FLD-JOBS-OWN`, checklisty, zdjęcia, protokół,
podpis) wchodzi przez tę samą rurę i nie powtarza sprawdzania uprawnień.

To jest odpowiedź na ryzyko **R13** (`FIELD-APP-I-PODPISY-ZAKRES.md` rozdz. 9): druga ścieżka
zapisu obok Server Actions oznacza drugą implementację macierzy uprawnień, a więc rozjazd,
którego żaden dzisiejszy test nie zobaczy — `tools/kk-authz-gate.mjs` wykrywa *brak* bramki,
nie *dwie różne* bramki dla tej samej reguły.

---

## Wymagania

| ID | Status | Rola w tym WO |
|---|---|---|
| `FLD-API-LAYER` | TODO, risk HIGH | **realizowane tutaj** |
| `FLD-AUTH-BLOCKED` | BLOCKED | kryterium „sprawdzenie blokady przy KAŻDYM żądaniu" jest fizycznie realizowane przez tę warstwę, ale **nie jest tu zamykane** — osobne WO |
| `FLD-APP-SHELL` | TODO | konsument warstwy; `apps/field-app` nie istnieje i **nie powstaje w tym WO** |
| `FLD-JOBS-OWN` | TODO | pierwszy realny odczyt przez tę warstwę; osobne WO |
| `FLD-OFFLINE-OUTBOX` | TODO | producent powtórzonych żądań — powód, dla którego AC5 w ogóle istnieje |
| `FLD-AVAIL-SELF`, `FLD-AVAIL-RESTORE`, `FLD-AVAIL-WEEKLY-RULES` | DONE | dostarczają **funkcję domenową**, na której warstwa zostanie zweryfikowana end-to-end |

---

## Kontekst kodu (sprawdzone 2026-09-24 w worktree `kk-field/turborepo`)

### Istnieje

- **Bramka ról:** `can()` z `packages/contracts/src/generated/rbac.ts` (import przez
  `@klikklima/contracts`), macierz w `contracts/rbac.contract.mjs`.
  `ROLES = ['admin', 'dyspozytor', 'audytor', 'monter']` (linia 9).
- **Ustalanie aktora dla panelu:** `getCurrentActorRole()` —
  `apps/b2b-web/src/utils/supabase/server.ts:56`. Fail-closed (`null` przy braku sesji albo
  braku wpisu w `AuthorizedUser`). **Czyta ciasteczka** (`cookies()` + `cache()`), więc
  **nie jest wywoływalna z żądania z nagłówkiem `Authorization`**. To jest sedno pracy w tym WO.
- **Bramka konta zablokowanego (panel):** `apps/b2b-web/src/utils/supabase/middleware.ts`,
  linie 60–105: obecność w `AuthorizedUser` → dla roli `audytor` sprawdzenie
  `audytorzy.is_active = false` → fail-closed przy błędzie zapytania.
- **Wzorcowa funkcja domenowa z `can()`** (kandydat na endpoint referencyjny):
  `setSelfAvailabilityAction` — `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts:167`
  (bliźniak dla ekip: `crews/actions.ts:157`). Kształt:
  1. `getCurrentActorRole()`,
  2. `actorRole !== 'audytor' || can(actorRole, 'availability_declarations', 'update') !== 'own'` → odmowa,
  3. e-mail z sesji → `prisma.audytorzy.findMany({ where: { email }, take: 2 })`,
     `matches.length !== 1` → odmowa (ochrona z `SEC-EMAIL-UNIQUE`),
  4. porównanie `own.id !== id` → odmowa (bez tego audytor A podaje `id` audytora B),
  5. `prisma.availabilityDeclaration.upsert({ where: { auditorId } })`,
  6. `revalidatePath('/auditors')`.
- **Odczyt tej samej domeny:** `getAvailabilityAction` — `auditors/actions.ts:294`, deleguje do
  czystej funkcji `getEffectiveAvailability` z `packages/scheduling/src/effective-availability.ts:115`
  (bez uprawnień, bez zapisu — to jedyna dziś warstwa naprawdę „domenowa").
- **Wzorzec insertu append-only chronionego wyłącznie przez UNIQUE:**
  `acceptLegalDocumentVersionAction` — `auditors/actions.ts:344`; nośnik:
  `employee_consents_auditor_id_version_id_key` /
  `employee_consents_crew_id_version_id_key`
  (`supabase/migrations/20260821130000_fld_consent_docs.sql:170-172`).
- **Skaner bramek:** `tools/kk-authz-gate.mjs` — skanuje **cały** `apps/b2b-web/src/app`,
  w tym `route.ts` (linie 53–57 nagłówka), heurystyka: funkcja mutująca bez
  `getCurrentActorRole(` **i** `can(` = podejrzana; `can()` po pierwszym dotknięciu Prismy =
  naruszenie kolejności. Wyjątek: `// AUTHZ-EXEMPT: <powód>`. Test żywotności:
  `apps/b2b-web/tests/authz-gate-scanner-liveness.test.ts`.
- **Istniejące Route Handlery:** `apps/b2b-web/src/app/api/webhooks/services-cron/route.ts`,
  `apps/b2b-web/src/app/api/webhooks/shipping/route.ts` (publiczne webhooki — jedyny dziś
  wyjątek ADR-001) oraz `apps/b2c-web/app/api/calendar/slots/route.ts` (patrz „Ryzyka", R-API-3).
- **`audit_log`:** tabela + wyzwalacz append-only
  (`supabase/migrations/20260901220000_rodo_audit_log_and_client_anonymization.sql:43`).
  Kolumny **NOT NULL**: `actor_email`, `actor_role`, `operation`, `resource`, `record_id`,
  `justification` (CHECK: ≥ 10 znaków po `btrim`), `legal_basis` (CHECK: 5 wartości).
  `AUDIT_REQUIREMENTS.mustLog` (`contracts/rbac.contract.mjs:303`) ma **7** wartości:
  `delete, anonymize, role_change, contract_override, manual_status_change,
  notification_resend, field_update`. **Nie ma wartości opisującej odmowę dostępu.**
- **Precedensy idempotencji w schemacie:**
  `installation_photos.upload_idempotency_key TEXT NOT NULL UNIQUE`
  (`supabase/migrations/20260925092000_invoices_and_installation_photos.sql:171`) oraz klucz
  zdarzenia płatności tamże (linie 109–130). Oba to **kolumna na tabeli zapisu**, nie rejestr centralny.

### Brakuje

- Katalogu `apps/b2b-web/src/app/api/field/` — **nie istnieje ani jeden endpoint Field App**.
- Ustalania aktora z tokenu Bearer (odpowiednika `getCurrentActorRole()` dla żądania HTTP).
- **Warstwy domenowej w ogóle.** Dziś „funkcja domenowa" i „Server Action" to ten sam byt:
  `setSelfAvailabilityAction` sama czyta ciasteczka (`createClient()`), sama pyta `can()`,
  sama pisze Prismą i sama woła `revalidatePath`. Route Handler **nie może jej wywołać**, bo
  poleci po ciasteczka, których w żądaniu z aplikacji natywnej nie ma. Bez wydzielenia funkcji
  przyjmującej aktora jako argument kryterium 4 jest niewykonalne — nie przez niedbalstwo,
  tylko przez dzisiejszy kształt kodu.
- Jakiegokolwiek nośnika klucza idempotencji dla zapisów innych niż zdjęcia i płatności (D-API-1).
- Wartości słownikowej `audit_log` opisującej odmowę (D-API-2).
- Testu statycznego pilnującego prefiksu Route Handlerów (AC6).
- **`middleware.ts` nie chroni `/api`**: `apps/b2b-web/src/utils/supabase/middleware.ts:38` —
  `isPublicRoute` obejmuje `pathname.startsWith('/api')`. Każdy endpoint pod `/api/field/**`
  jest więc gołym wejściem do serwera i **cała autoryzacja musi być w handlerze**. To nie jest
  regresja do naprawienia — to warunek brzegowy, z którym ta warstwa musi żyć, i powód, dla
  którego testy AC1/AC2 mają sens.

---

## Zmiana kontraktu

**WYMAGANA — w trzech osobnych porcjach, wykonuje `contract-steward` w oknie kontraktowym.
`implementer-server` nie dotyka żadnej z nich.**

1. **Wydanie ADR-013.** `docs/architecture/ADR-013-warstwa-zapisu-field-app.md` ma nagłówek
   „**Status: SZKIC DO ZATWIERDZENIA. To nie jest jeszcze obowiązujący ADR**". Dopóki tak jest,
   Route Handler w `apps/b2b-web` jest formalnie naruszeniem ADR-001 („Route Handlery — wyjątek:
   publiczne webhooki", CLAUDE.md). Wydanie = zdjęcie nagłówka szkicu + wpis w
   `docs/01-ADR-spec-conflicts.md` z jawnym zapisem wyjątku i jego granicy (prefiks
   `apps/b2b-web/src/app/api/field/**`). **Bez tego kroku nie zaczynać implementacji** — recenzja
   i `guard-forbidden` będą miały rację, zgłaszając handler jako naruszenie.
2. **D-API-1** (idempotencja) — najpewniej migracja. Patrz „WYMAGA DECYZJI".
3. **D-API-2** (ślad odmowy w `audit_log`) — zmiana `AUDIT_REQUIREMENTS.mustLog` w
   `contracts/rbac.contract.mjs` + migracja rozszerzająca `audit_log_operation_check`
   (wzorzec: `20260910103000_audit_log_field_update_operation.sql`). Patrz „WYMAGA DECYZJI".

**NIEWYMAGANA:** macierz RBAC. Endpoint referencyjny korzysta z wierszy, które już istnieją
(`availability_declarations`, `availability_rules`). Żaden nowy zasób ani żadne nowe prawo roli
nie jest tu potrzebne — i to jest cecha, nie przypadek: warstwa ma być sprawdzona na uprawnieniu,
które już działa w panelu, żeby test mierzył warstwę, a nie nową regułę.

---

## Endpoint referencyjny

`FLD-API-LAYER` sam nie ma żadnej operacji biznesowej. Kryteria 1, 2, 3, 5 opisują zachowanie
warstwy **na jakimś zapisie**, więc trzeba wskazać ten zapis, inaczej testy sprowadzą się do
atrapy testującej samą siebie.

**Propozycja: para endpointów nad dostępnością własną pracownika.**

| Metoda i ścieżka | Woła funkcję domenową | Po co |
|---|---|---|
| `GET /api/field/availability/self?from=&to=` | `getEffectiveAvailability()` (`packages/scheduling`) przez wspólną funkcję domenową odczytu | ścieżka token → aktor → `can(..., 'availability_rules', 'read') === 'own'` → odczyt. Dowodzi AC1, AC2 bez ryzyka zapisu |
| `POST /api/field/availability/self` (body: `{ isAvailable: boolean }`) | ta sama funkcja, którą po refaktorze woła `setSelfAvailabilityAction` | **zapis**. Dowodzi AC1 (zero zapisów przy braku tokenu), AC2, AC3, AC4, AC5 |

**Dlaczego właśnie to:**

1. Dokument zakresu wskazuje ten przypadek wprost (`FIELD-APP-I-PODPISY-ZAKRES.md` rozdz. 4,
   wiersz „Dostępność pracownika"): *„Przy React Native logika zostaje, ale trzeba ją wystawić
   przez warstwę API (`FLD-API-LAYER`)"*. To nie jest endpoint wymyślony pod test — to pierwszy
   endpoint, którego aplikacja i tak będzie potrzebowała.
2. `FLD-AVAIL-SELF` i `FLD-AVAIL-RESTORE` mają status **DONE** i komplet testów
   (`availability-self-declaration.test.ts`, `availability-restore.test.ts`). Jeżeli po
   wydzieleniu funkcji domenowej te testy nadal przechodzą, mamy dowód, że wydzielenie nie
   zmieniło zachowania panelu — a to jest dokładnie ryzyko R13 w wersji odwrotnej.
3. Uprawnienie ma wariant **`:own`** (`availability_declarations.update =
   ['admin','audytor:own','monter:own']`), czyli jest najtrudniejszym wariantem dla AC2:
   podszycie się nagłówkiem musi być bezskuteczne **i** przy roli, i przy właścicielstwie rekordu.
4. `availabilityDeclaration.auditorId` jest `@unique`
   (`packages/database/prisma/schema.prisma:471`) i operacja to `upsert`, więc powtórzenie
   żądania fizycznie **nie może** utworzyć drugiego wiersza — AC5 da się częściowo dowieść
   **bez żadnej migracji** (patrz T5.1), a pełny dowód czeka na D-API-1.
5. Zapis jest odwracalny i nie dotyka danych klienta — błąd w pierwszej wersji warstwy nie
   psuje niczego, co ma skutek wobec klienta.

**Odrzucone alternatywy:**

- `acceptLegalDocumentVersionAction` (`employee_consents`) — kusi, bo to insert append-only
  z gotowym UNIQUE `(auditor_id, version_id)`, który **jest** naturalnym kluczem idempotencji.
  Odrzucone jako *główny*, bo wyzwalacz „wersja musi być bieżąca" robi z fikstury osobny problem,
  a sam endpoint należy do modułu M2 (`FLD-CONSENT-ENFORCE`) i wciągnąłby jego zakres.
  **Zostaje jako zapasowy dowód AC5**, gdyby D-API-1 utknęła (patrz T5.1b).
- Cokolwiek z `installations` / `leads` — wymaga rozstrzygnięcia luk uprawnieniowych nr 1 i 6
  z rozdz. 4 dokumentu zakresu (audytor nie ma `installations.update` ani `leads.create`).
  Budowanie warstwy na uprawnieniu, którego jeszcze nie ma, miesza dwie niezależne decyzje.
- Endpoint sztuczny (`/api/field/ping`) — odrzucony: nie dotyka bazy, więc AC1 („zero zapisów")
  i AC4 („ta sama funkcja domenowa") nie mają na czym się zweryfikować.

---

## Kryteria akceptacji rozpisane na przypadki testowe

Oznaczenia: **[S]** test statyczny (da się napisać, zanim powstanie jakikolwiek endpoint),
**[U]** test jednostkowy warstwy z zamockowaną Prismą/Supabase (wzór:
`apps/b2b-web/tests/availability-self-declaration.test.ts`), **[I]** test integracyjny na
prawdziwym Postgresie (wzór: `*.itest.ts`, `vitest.integration.config.mts`, `supabase start` w CI).

### AC1 — żądanie bez tokenu albo z tokenem wygasłym kończy się odmową PRZED dotknięciem bazy

- **T1.1 [U]** `POST /api/field/availability/self` **bez** nagłówka `Authorization` → odpowiedź
  odmowna; **szpieg na `prisma` nie zanotował ani jednego wywołania** (żadnego `findMany`,
  `upsert`, `$queryRaw`). Asercja na braku wywołań jest obowiązkowa — sam kod odpowiedzi
  nie odróżnia „odmówiono przed zapytaniem" od „zapytano, potem odmówiono".
- **T1.2 [U]** Nagłówek `Authorization: Bearer <token wygasły/niepoprawnie podpisany>`
  (weryfikator zwraca brak użytkownika) → odmowa, zero wywołań Prismy.
- **T1.3 [U]** Nagłówek w złym kształcie (`Authorization: <token>` bez `Bearer`,
  `Bearer` bez wartości, pusty string) → odmowa, zero wywołań Prismy. Trzy osobne przypadki.
- **T1.4 [U]** Błąd weryfikatora tokenu (wyjątek sieciowy z `auth.getUser`) → **odmowa**,
  nie przepuszczenie. Fail-closed, wzorem `middleware.ts:96` (`blockedAuditorError || blockedAuditor`).
- **T1.5 [U]** Token poprawny, ale e-mail **nie występuje** w `AuthorizedUser` → odmowa
  (to jest ten sam warunek, co `getCurrentActorRole()` zwracające `null`).
- **T1.6 [U]** Token poprawny, rola w `AuthorizedUser` spoza `ROLES` (np. `'ksiegowa'`) → odmowa.
- **T1.7 [U]** To samo dla `GET` — odczyt bez tokenu nie może zwrócić danych i nie odpytuje bazy.

### AC2 — rola wyłącznie ze zweryfikowanego tokenu, nigdy z treści żądania ani z nagłówka klienta

- **T2.1 [U]** Token audytora + nagłówek `X-Role: admin` → decyzja identyczna jak bez tego
  nagłówka (dla zasobu, na którym `admin` i `audytor` różnią się skutkiem). Test dowodzi, że
  podszycie nie ma **żadnego** wpływu, a nie tylko że odpowiedź jest odmowna.
- **T2.2 [U]** Token audytora + `role: 'admin'` w **ciele** żądania → jak wyżej.
- **T2.3 [U]** Token audytora + `actorEmail` / `userId` w ciele wskazujące innego pracownika →
  zapis idzie na **własny** rekord z tokenu albo jest odmawiany; nigdy na wskazany.
- **T2.4 [U]** Token audytora A, w ścieżce/ciele `id` audytora B → odmowa
  (`matches[0].id !== id`), zero zapisu. To jest przeniesienie ochrony z
  `auditors/actions.ts:190-197` na ścieżkę HTTP — bez niej `can()` z wariantem `own`
  przepuszcza wszystko, bo `can()` nie zna właścicielstwa rekordu.
- **T2.5 [U]** Token roli `monter` na endpoincie audytorskim → odmowa mimo że
  `can('monter','availability_declarations','update') === 'own'`. Powód identyczny jak w
  komentarzu MAJOR nad `setSelfAvailabilityAction`: jeden zasób RBAC obsługuje dwie encje,
  więc wiązanie roli z encją żyje w kodzie, nie w macierzy.
- **T2.6 [U]** Dwa wiersze `audytorzy` z tym samym e-mailem (`findMany … take: 2` zwraca 2) →
  odmowa. Obrona `SEC-EMAIL-UNIQUE` musi obowiązywać także na ścieżce API.

### AC3 — odmowa `can()` zwraca błąd domenowy i zostawia ślad w `audit_log`

> **Zablokowane przez D-API-2.** Poniższe przypadki opisują cel; RED dla nich dopiero po decyzji.

- **T3.1 [U]** Odmowa `can()` zwraca **błąd domenowy** (kształt `{ success: false, error }`
  odwzorowany na odpowiedź HTTP), a nie `200` z pustym wynikiem i nie milczące `204`.
- **T3.2 [I]** Po odmowie w `audit_log` przybywa dokładnie **jeden** wiersz z: e-mailem aktora
  z tokenu, rolą z chwili odmowy, zasobem, którego dotyczyła próba, i znacznikiem czasu.
- **T3.3 [I]** Ten sam wiersz **nie** powstaje przy żądaniu zakończonym powodzeniem
  (inaczej dziennik odmów utonie w ruchu i przestanie być czytelny).
- **T3.4 [I]** Odmowa z AC1 (brak tokenu) **nie** tworzy wiersza — nie ma aktora, a
  `audit_log.actor_email` jest `NOT NULL`. Granicę „co logujemy" wyznacza dostępność aktora:
  logujemy odmowy **uwierzytelnionego** aktora, nie ruch anonimowy. To jest jednocześnie ochrona
  przed zapełnieniem dziennika przez skaner z internetu.
- **T3.5 [I]** Zapis śladu nie wywraca odpowiedzi: awaria wstawienia do `audit_log` nie zamienia
  odmowy w błąd 500 o innej treści — odmowa pozostaje odmową. (Odwrotnie niż przy operacjach
  udanych, gdzie audyt i operacja są w jednej transakcji.)

### AC4 — panel i aplikacja wołają JEDNĄ funkcję domenową na operację

- **T4.1 [S]** Skaner (nowe narzędzie albo rozszerzenie `tools/kk-authz-gate.mjs`) przechodzi po
  plikach `apps/b2b-web/src/app/api/field/**/route.ts` i zgłasza **każde** bezpośrednie
  odwołanie do Prismy (`prisma.<model>.<metoda>`, `$queryRaw`, `$executeRaw`) w ciele handlera.
  Route Handler ma wołać funkcję domenową, nie bazę. **Ten test da się napisać i uruchomić na
  fikstrach, zanim powstanie pierwszy endpoint** — wzorzec: `__fixtures__/authz-gate/` +
  `KK_AUTHZ_SCAN_DIR`, `authz-gate-scanner-liveness.test.ts`.
- **T4.2 [S]** Ten sam skaner zgłasza wywołanie `can(` **wewnątrz** pliku `route.ts` przy
  jednoczesnym wywołaniu funkcji domenowej — czyli podwójną bramkę. *Uwaga dla test-authora:*
  ten przypadek wymaga rozstrzygnięcia, gdzie stoi `can()` (patrz D-API-3); jeśli zapadnie
  wariant „`can()` w funkcji domenowej", T4.2 obowiązuje w tym brzmieniu; jeśli „`can()`
  w handlerze", T4.2 odwraca się w „funkcja domenowa nie pyta `can()` drugi raz".
- **T4.3 [S]** Dla każdej operacji wystawionej pod `/api/field/**` istnieje **dokładnie jeden**
  moduł domenowy importowany zarówno przez `route.ts`, jak i przez odpowiadający `actions.ts`
  panelu. Test buduje mapę `operacja → importowany moduł` i wykrywa rozdwojenie (dwa różne
  moduły implementujące tę samą operację). Wzorzec testu statycznego „jedna ścieżka zapisu”:
  kryterium 2 w `B2C-LEAD-ENTRY` (`contracts/requirements.contract.mjs:550`) — tam wykrywana
  jest druga Server Action tworząca leada.
- **T4.4 [U]** Fikstura regresyjna R13: test podmienia w module domenowym decyzję `can()` na
  odmowę i sprawdza, że **obie** ścieżki (Server Action panelu i Route Handler) odmawiają.
  Jeżeli jedna z nich przechodzi, istnieje druga implementacja reguły — a to jest dokładnie
  rozjazd, którego to wymaganie zakazuje.
- **T4.5 [U]** Testy `FLD-AVAIL-SELF` / `FLD-AVAIL-RESTORE` / `FLD-AVAIL-WEEKLY-RULES`
  przechodzą **bez zmian w treści** po wydzieleniu funkcji domenowej. Zmiana tych plików przez
  implementera to `TEST-DEFECT`, nie naprawa.

### AC5 — klucz idempotencji, a nośnikiem gwarancji jest UNIQUE w bazie

> **Częściowo zablokowane przez D-API-1.** T5.1 i T5.1b są wykonalne dziś.

- **T5.1 [I]** Dwa identyczne `POST /api/field/availability/self` (ten sam aktor, to samo ciało,
  ten sam klucz) → w `availability_declarations` jest **jeden** wiersz dla tego audytora,
  a druga odpowiedź nie jest błędem technicznym. Nośnik: `auditorId @unique` + `upsert`.
- **T5.1b [I]** (dowód zapasowy, jeżeli D-API-1 utknie) Dwa identyczne żądania akceptacji
  dokumentu → jeden wiersz w `employee_consents`; drugie odbija się od
  `employee_consents_auditor_id_version_id_key`, **nie** od sprawdzenia „czy już istnieje" w JS.
  Test dowodzi tego przez równoległe wysłanie obu żądań (`Promise.all`), bez `await` między nimi.
- **T5.2 [I]** *(po D-API-1)* Dwa żądania z **tym samym** kluczem idempotencji i **różną**
  treścią → drugie nie tworzy drugiego rekordu i nie nadpisuje pierwszego po cichu.
- **T5.3 [I]** *(po D-API-1)* Dwa żądania z **różnymi** kluczami i tą samą treścią → zachowanie
  zgodne z semantyką operacji (dla `upsert` jeden wiersz; dla operacji append-only dwa) —
  klucz idempotencji nie jest zamiennikiem reguły biznesowej.
- **T5.4 [I]** *(po D-API-1)* **Współbieżność:** dwa żądania z tym samym kluczem wysłane
  równolegle, bez `await` między nimi → jeden rekord, druga odpowiedź nie jest 500.
  Sprawdzenie w JS przed zapisem tego nie da — dowód musi pochodzić z ograniczenia bazy
  (wzorzec: `create-booking-concurrency.itest.ts`).
- **T5.5 [U]** *(po D-API-1)* Żądanie zapisu **bez** klucza idempotencji → odrzucenie na wejściu
  (walidacja Zod), nie „przepuść i licz na szczęście". Kolejka offline zawsze klucz niesie
  (`FLD-OFFLINE-OUTBOX`), więc jego brak oznacza klienta spoza kontraktu.
- **T5.6 [S]** *(po D-API-1)* Test statyczny: schemat Zod każdego zapisu pod `/api/field/**`
  zawiera pole klucza idempotencji. Bez tego AC5 obowiązuje tylko tam, gdzie ktoś pamiętał.

### AC6 — Route Handlery wyłącznie pod zarezerwowanym prefiksem

- **T6.1 [S]** Skan `apps/b2b-web/src/app/**/route.ts`: dopuszczone wyłącznie ścieżki pasujące do
  `api/field/**` (ADR-013) oraz `api/webhooks/**` (publiczne webhooki — wyjątek ADR-001).
  Każdy inny `route.ts` = błąd z nazwą pliku w komunikacie. **Test da się napisać dziś**:
  dziś w zakresie są dwa pliki (`api/webhooks/services-cron`, `api/webhooks/shipping`) i oba
  mieszczą się w allowliście, więc test startuje na zielono i czerwienieje dopiero przy
  naruszeniu — tak jak `rls-deny-by-default-freeze.test.ts`.
- **T6.2 [S]** Test **żywotności** skanera: na fiksturze z handlerem pod ścieżką spoza
  allowlisty (np. `__fixtures__/field-api/app/api/leads/route.ts`) skaner zwraca kod wyjścia
  ≠ 0 i wskazuje ten plik. Bez tego przypadku zielony wynik T6.1 nie dowodzi niczego
  (dokładnie ta luka, którą zamyka `authz-gate-scanner-liveness.test.ts`).
- **T6.3 [S]** Allowlista jest **jawną listą wzorców w jednym miejscu**, a jej rozszerzenie musi
  być widoczne w diffie. Test sprawdza, że wzorzec nie da się obejść przez podkatalog
  (`api/field-x/**`, `api/xfield/**` → naruszenie).
- **T6.4 [S]** Zakres skanu obejmuje `apps/b2b-web`. Rozszerzenie na `apps/b2c-web` — patrz R-API-3,
  **nie w tym WO**.

---

## Pliki do stworzenia / zmiany

| Plik | Rola | Co |
|---|---|---|
| `docs/architecture/ADR-013-warstwa-zapisu-field-app.md` | `contract-steward` | wydanie (zdjęcie statusu SZKIC) |
| `docs/01-ADR-spec-conflicts.md` | `contract-steward` | wpis o wyjątku od ADR-001 i jego granicy |
| `contracts/rbac.contract.mjs` | `contract-steward` | **tylko po D-API-2**: `AUDIT_REQUIREMENTS.mustLog` |
| `supabase/migrations/<ts>_fld_api_idempotency.sql` | `contract-steward` | **tylko po D-API-1** |
| `supabase/migrations/<ts>_audit_log_operation_access_denied.sql` | `contract-steward` | **tylko po D-API-2** |
| `apps/b2b-web/tests/field-api-*.test.ts`, `*.itest.ts` | `test-author` | wszystkie przypadki wyżej |
| `apps/b2b-web/tests/__fixtures__/field-api/**` | `test-author` | fikstury dla T4.1, T6.2 |
| `tools/kk-field-api-gate.mjs` **albo** rozszerzenie `tools/kk-authz-gate.mjs` | patrz D-API-4 | skaner AC4/AC6 |
| `scripts/verify.sh` | wg D-API-4 | wpięcie skanera do bramki |
| `apps/b2b-web/src/lib/field-api/actor.ts` | `implementer-server` | token → aktor (rola + własny rekord + `is_active`), fail-closed |
| `apps/b2b-web/src/lib/field-api/handler.ts` | `implementer-server` | wspólne opakowanie: token → aktor → walidacja Zod → funkcja domenowa → odpowiedź |
| `apps/b2b-web/src/lib/domain/availability.ts` (nazwa do ustalenia) | `implementer-server` | **wydzielona** funkcja domenowa przyjmująca aktora jako argument |
| `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts`, `crews/actions.ts` | `implementer-server` | Server Action staje się cienkim wywołaniem wydzielonej funkcji; `revalidatePath` **zostaje w akcji**, nie wchodzi do domeny |
| `apps/b2b-web/src/app/api/field/availability/self/route.ts` | `implementer-server` | endpoint referencyjny (`GET` + `POST`) |

---

## Przypadki brzegowe, które MUSZĄ mieć test

- **Konto zablokowane w trakcie sesji.** Token ważny 60 minut, administrator ustawia
  `is_active = false` w minucie 5. Następne żądanie musi zostać odrzucone — sprawdzenie idzie
  przy **każdym** żądaniu, nie przy wydaniu tokenu. (Realizacja `FLD-AUTH-BLOCKED` AC2;
  zamknięcie tamtego wymagania to osobne WO, ale ten test należy napisać tutaj, bo bez niego
  warstwa powstanie w kształcie, który tego nie umie.)
- **Rozdzielność blokady i deklaracji.** Zablokowany audytor **nadal** może zadeklarować własną
  niedostępność przez panel (`setSelfAvailabilityAction` świadomie nie sprawdza `is_active` —
  komentarz w `auditors/actions.ts:186-190`), ale przez warstwę API blokada odcina wszystko.
  Jeśli obie ścieżki mają wołać jedną funkcję domenową, to **gdzie stoi sprawdzenie
  `is_active`** przestaje być szczegółem → **D-API-3**.
- **Zmiana roli między wydaniem tokenu a żądaniem.** Rola czytana z `AuthorizedUser` przy każdym
  żądaniu, nie z `app_metadata` w tokenie; degradacja roli działa natychmiast.
- **Współbieżność** — T5.4 (równoległe żądania z jednym kluczem), plus: dwa równoległe żądania
  z różnych urządzeń tego samego pracownika.
- **Idempotencja a ponowienie po timeoucie.** Telefon traci zasięg **po** tym, jak serwer zapisał,
  ale **przed** odebraniem odpowiedzi. Ponowienie musi zwrócić wynik pierwszego żądania, a nie
  błąd konfliktu — inaczej kolejka offline zatnie się na pozycji, która faktycznie przeszła.
  (Objęte D-API-1: „co zwraca powtórka".)
- **Strefa czasowa.** Parametry `from`/`to` przychodzą z urządzenia, które może mieć inną strefę
  niż serwer. Zakres dat na granicy doby (`23:59` lokalnie) nie może przesuwać dnia dostępności.
  Reszta systemu trzyma czas w UTC (`_at` = moment) — warstwa nie wolno, żeby wprowadzała drugi
  zwyczaj.
- **Godziny wysyłki / powiadomienia** — **nie dotyczy tego WO**: endpoint referencyjny nie kolejkuje
  powiadomień. Pierwszy endpoint dotykający `notification_queue` (protokół, `N8`) przyniesie ten
  przypadek ze sobą i wtedy trzeba będzie rozstrzygnąć, czy klucz idempotencji zapisu jest tym
  samym kluczem, co idempotencja `enqueueNotification()`.
- **Rozmiar ciała żądania i nieznane pola.** Zod z `.strict()` — nieznane pole w ciele odrzuca
  żądanie, zamiast przechodzić dalej (zamknięcie drogi do przemycenia `is_active`, wzorem
  `FLD-BASE-LOCATION-EDIT`: granicę wyznacza jawna lista pól).

---

## WYMAGA DECYZJI

### D-API-1: gdzie mieszka klucz idempotencji — rejestr centralny czy kolumna na tabeli zapisu?

Kryterium 5 mówi: *„nośnikiem tej gwarancji jest ograniczenie UNIQUE w bazie, nie sprawdzenie
w JS"*. Nie rozstrzyga **gdzie** ten UNIQUE stoi. Dwie drogi, obie wymagają migracji:

| Wariant | Za | Przeciw |
|---|---|---|
| **(a) Rejestr centralny** — nowa tabela `field_request_idempotency` (`idempotency_key` UNIQUE, `actor_email`, `endpoint`, `request_hash`, odpowiedź, `created_at`) | jedno miejsce dla wszystkich endpointów, w tym tych, które **nie mają** własnego naturalnego klucza; pozwala **zwrócić pierwotną odpowiedź** przy powtórce; nowy endpoint nie wymaga nowej migracji | nowa tabela = nowy zasób w `RESOURCES`? nowy wpis w `audit_log_resource_check`? retencja (kiedy czyścimy wpisy)? sprzęg z transakcją operacji (wpis i operacja muszą być atomowe) |
| **(b) Kolumna na tabeli zapisu** — wzorem `installation_photos.upload_idempotency_key` (`20260925092000:171`) | zgodne z jedynym istniejącym w repo precedensem; zero nowych bytów; klucz umiera razem z rekordem | **każda** nowa tabela zapisu = nowa migracja i nowa kolumna; operacje `update`/`upsert` (jak endpoint referencyjny) nie mają rekordu, na którym klucz mógłby usiąść; nie da się zwrócić pierwotnej odpowiedzi |

Pytania pomocnicze do tej samej decyzji:
1. **Co zwraca powtórka?** Wynik pierwszego żądania (wariant (a) to umożliwia) czy odpowiedź
   „już wykonane" bez treści? Dla kolejki offline to różnica między „pozycja zamknięta" a
   „pozycja wymagająca uwagi".
2. **Czy klucz obowiązuje też odczyty?** Rekomendacja: nie — AC5 mówi „każdy **zapis**".
3. **Retencja.** Rejestr centralny rośnie w nieskończoność; 30 dni? 90? Wartość do
   `contracts/sla.contract.mjs`, nie literał w kodzie (pułapka 5 z CLAUDE.md).

**Rekomendacja analityka (do potwierdzenia, nie do przyjęcia milczeniem):** wariant (a),
bo wariant (b) nie obsługuje `upsert` i wymusza migrację przy każdym nowym endpoincie, czyli
przenosi koszt decyzji na wszystkie przyszłe WO Field App. Ale to jest nowa tabela w schemacie —
**decyzja człowieka, okno kontraktowe, `contract-steward`.**

### D-API-2: jak wygląda ślad odmowy w `audit_log`?

Kryterium 3 wymaga śladu. Dzisiejszy `audit_log` **nie przyjmie** takiego wiersza:

- `operation` musi należeć do 7 wartości z `AUDIT_REQUIREMENTS.mustLog`
  (`contracts/rbac.contract.mjs:303`) — **nie ma wartości dla odmowy**;
- `record_id` jest `NOT NULL`, a odmowa często dotyczy operacji **bez rekordu**
  (próba utworzenia, próba odczytu listy);
- `justification` jest `NOT NULL` z CHECK-iem ≥ 10 znaków — przy odmowie uzasadnienie
  nie pochodzi od użytkownika, tylko musi je wyliczyć serwer (precedens istnieje:
  `field_update`, gdzie uzasadnienie wylicza serwer, a `legal_basis` to stała `'OTHER'`).

Do rozstrzygnięcia: **(i)** nowa wartość `access_denied` w `mustLog` + migracja rozszerzająca
`audit_log_operation_check`, czy **(ii)** osobny nośnik (odmowy nie są „operacją na rekordzie"
i mieszanie ich z dziennikiem RODO psuje zapytanie „co się działo z tym rekordem"); oraz
**(iii)** co wpisać w `record_id`, gdy rekordu nie ma (stała `'-'`? nazwa endpointu?).

Uwaga z pamięci projektowej, potwierdzona w migracji `20260925093000` (linie 16–23): pominięcie
rozszerzenia CHECK jest **ciche aż do pierwszego użycia**, a wtedy `auditLog.create` wywraca
**całą** akcję, w której siedział. Przy odmowie znaczyłoby to, że odmowa zamienia się w błąd 500.

**Bez tej decyzji AC3 nie ma jak przejść do RED.**

### D-API-3: gdzie stoi `can()` i gdzie stoi sprawdzenie `is_active` — w handlerze czy w funkcji domenowej?

Kryterium 4 mówi „jedna funkcja domenowa na operację", kryterium 2 mówi „rola z tokenu”. Z tego
wynika, że funkcja domenowa musi przyjmować **aktora** jako argument. Otwarte zostaje:

- **`can()` w funkcji domenowej** (aktor wchodzi jako argument) — bramka niemożliwa do pominięcia
  z żadnej ścieżki, ale `tools/kk-authz-gate.mjs` **przestanie widzieć** bramkę w `actions.ts`
  (skaner nie zagląda poza `apps/b2b-web/src/app`, nagłówek narzędzia, linie 56–60) i zgłosi
  fałszywe alarmy albo wymusi `AUTHZ-EXEMPT` na wszystkich akcjach — czyli wyłączy bramkę,
  która dziś działa.
- **`can()` w każdej ścieżce osobno** (handler i akcja) — skaner dalej działa bez zmian, ale to
  jest **dokładnie ta druga implementacja reguły**, której zakazuje AC4 i ryzyko R13.

To nie jest wybór stylistyczny: jedna droga psuje istniejącą bramkę CI, druga psuje wymaganie.
Trzecia możliwość — rozszerzyć zakres skanu `kk-authz-gate` o katalog funkcji domenowych —
zmienia narzędzie objęte własnym testem żywotności. **Decyzja techniczna, ale ze skutkiem dla
bramki — do rozstrzygnięcia przez człowieka przed RED, bo przesądza kształt testów T4.1–T4.4.**

### D-API-4: nowy skaner czy rozszerzenie `kk-authz-gate`?

Powiązane z D-API-3. Rozszerzenie istniejącego narzędzia jest tańsze, ale `kk-authz-gate` ma
własny test żywotności i własny kontrakt zachowania; dołożenie mu dwóch niezwiązanych reguł
(prefiks ścieżek, jedna funkcja domenowa) robi z niego narzędzie o trzech celach. Rekomendacja:
**osobny `tools/kk-field-api-gate.mjs`** z własnym testem żywotności, wpięty do `scripts/verify.sh`.
Do potwierdzenia przy okazji D-API-3.

---

## Poza zakresem (jawnie)

- **`apps/field-app`** — aplikacja Expo, nawigacja, ekran logowania, przechowywanie tokenu na
  urządzeniu. To `FLD-APP-SHELL`. Tutaj powstaje **wyłącznie** strona serwerowa; klientem
  w testach jest `fetch`/`Request`, nie aplikacja.
- **Kolejka offline, ponowienia, szkic lokalny** — `FLD-OFFLINE-OUTBOX`. Tutaj tylko serwerowa
  strona umowy: przyjęcie klucza i gwarancja braku duplikatu.
- **Zamknięcie `FLD-AUTH-BLOCKED`** — warstwa musi umieć sprawdzić `is_active` przy każdym
  żądaniu i ma na to test, ale odblokowanie i zamknięcie tamtego wymagania (pula przypisania,
  odwracalność, obie encje) to osobne WO.
- **Jakakolwiek operacja biznesowa Field App**: checklista, zdjęcia, protokół, podpis, umowa,
  tworzenie leada przez audytora, wycena. Każda ma własne ID i własne WO. Endpoint referencyjny
  jest **jedynym** endpointem powstającym w tym WO.
- **Luki uprawnieniowe nr 1 i 6** z rozdz. 4 dokumentu zakresu (audytor bez `installations.update`,
  audytor bez `leads:create`) — osobne decyzje i osobne okna kontraktowe.
- **Publiczna strona podpisu zdalnego** — działa poza macierzą ról, ma własne zabezpieczenia
  (`FLD-SIGN-ABUSE-GUARD`) i własny wyjątek. ADR-013 wymienia ją obok, ale to nie ta warstwa.
- **Limitowanie tempa żądań (rate limiting), CORS, rotacja tokenu** — realne, nienazwane dziś
  w żadnym wymaganiu. Patrz „Ryzyka", R-API-2.
- **Migracja `apps/b2c-web/app/api/calendar/slots/route.ts`** — patrz R-API-3.

---

## Ryzyka i nieznane

- **R-API-1 (wysokie): wydzielenie funkcji domenowej dotyka kodu, który jest DONE i ma testy.**
  `setSelfAvailabilityAction` i `getAvailabilityAction` istnieją w **dwóch** plikach
  (`auditors/actions.ts`, `crews/actions.ts`) pod tymi samymi nazwami, z różną encją w środku.
  Wydzielenie „jednej funkcji domenowej" wymaga rozstrzygnięcia, czy domena jest jedna
  z parametrem `resourceKind: 'AUDITOR' | 'CREW'` (tak robi `getEffectiveAvailability`), czy dwie.
  Jeżeli jedna — znika dzisiejsze wiązanie roli z encją zapisane w kodzie akcji (komentarz MAJOR
  z przeglądu `rls-security-auditor`) i trzeba je odtworzyć **w domenie**, nie zgubić.
- **R-API-2 (średnie): nienazwana powierzchnia ataku.** `middleware.ts:38` wypuszcza `/api`
  z bramki panelu, więc `/api/field/**` jest dostępne z internetu bez żadnego ograniczenia tempa.
  Żadne dzisiejsze wymaganie nie mówi o rate limitingu dla tej warstwy. Nie blokuje tego WO,
  ale **powinno zostać zgłoszone jako kandydat na nowe ID** przed pierwszym wdrożeniem na produkcję.
- **R-API-3 (niskie, ale mylące): `apps/b2c-web/app/api/calendar/slots/route.ts` istnieje**
  i nie jest webhookiem (to `GET` zwracający dziś dane atrapowe — „Zwracamy mockowe dane dopóki
  nie wprowadzisz kluczy API"). Gdyby test AC6 objął `apps/b2c-web`, zapaliłby się na czerwono
  od pierwszego dnia — a bramka czerwona od startu uczy ignorować własny wynik (uzasadnienie
  wprost w nagłówku `kk-authz-gate.mjs`). Dlatego T6.4 zawęża zakres do `apps/b2b-web`.
  **Nieznane:** czy ten plik ma zostać usunięty (B2C rezerwuje dziś przez Google Calendar, a
  decyzja z 2026-09-14 zastępuje to tabelą `bookings`) — to pytanie do osobnego WO, nie tutaj.
- **R-API-4: weryfikacja tokenu to roundtrip HTTP.** `supabase.auth.getUser(token)` przy każdym
  żądaniu plus odczyt `AuthorizedUser` plus odczyt `is_active` = trzy zapytania przed jakąkolwiek
  pracą. Panel rozwiązał to `cache()` w obrębie renderu (`server.ts:42`, komentarz P0-1), ale
  `cache()` działa na render Next, nie na żądanie HTTP. Alternatywa (lokalna weryfikacja podpisu
  JWT przez JWKS) usuwa jeden roundtrip, ale **nie** usuwa odczytu roli i `is_active` — te muszą
  być świeże, inaczej degradacja roli i blokada konta działają dopiero po wygaśnięciu tokenu.
  Nieznane: budżet czasu odpowiedzi dla aplikacji w terenie przy słabym zasięgu.
- **R-API-5: ADR-013 wygasa, jeżeli Field App wróci do PWA** (sekcja „Konsekwencje" ADR-013).
  Nie jest to dziś rozważane (D1 = React Native, potwierdzone 2026-09-21), ale warstwa nie
  powinna wsiąkać w kod tak, żeby jej usunięcie było niemożliwe — funkcje domenowe zostają,
  znika tylko cienka rura.
- **Nierozstrzygnięte w dokumentach:** kształt odpowiedzi błędnej (kod HTTP kontra
  `{ success: false, error }` znane z Server Actions). Dokumenty nie mówią nic. Rekomendacja:
  funkcja domenowa zwraca dotychczasowy kształt domenowy, a handler mapuje go na kod HTTP w
  **jednym** miejscu (`handler.ts`) — inaczej każdy endpoint wymyśli własne kody. Do potwierdzenia
  w recenzji, nie blokuje RED.

---

## Kolejność ról

1. **człowiek** — D-API-1, D-API-2, D-API-3 (+ D-API-4 przy okazji). Bez D-API-3 nie ma sensu
   pisać T4.x, bo przesądza ona ich brzmienie.
2. **`contract-steward`** — okno kontraktowe: wydanie ADR-013, wpis w `01-ADR-spec-conflicts.md`,
   migracje wynikające z D-API-1 i D-API-2, ewentualna zmiana `AUDIT_REQUIREMENTS.mustLog`.
   Po oknie: `node tools/kk-validate.mjs`, `node tools/kk-codegen.mjs`.
3. **`test-author`** — RED. Kolejność pisania: najpierw testy statyczne **[S]** (T4.1–T4.3,
   T6.1–T6.3 — nie potrzebują żadnego endpointu), potem **[U]** (T1.x, T2.x), na końcu **[I]**
   (T3.x, T5.x). Każdy test znakowany `@REQ: FLD-API-LAYER`.
4. **`implementer-server`** — GREEN. Wydzielenie funkcji domenowej, `lib/field-api/*`, endpoint
   referencyjny. **Nie dotyka** testów ani `contracts/`. Przy trzeciej nieudanej iteracji —
   zatrzymanie i diagnoza.
5. **`rls-security-auditor`** — przegląd obowiązkowy (R13 i R3 z rozdz. 9 dokumentu zakresu;
   ADR-013 warunek 5: *„Każdy endpoint ma test kontraktowy uprawnień"*).
6. **`reviewer`** → commit i PR po zgodzie człowieka.
