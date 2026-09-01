# WO: BATCH-MEDIUM-LOW-CLEANUP — zamknięcie otwartych znalezisk MEDIUM i LOW

Data: 2026-08-31. Źródło: `.claude/state/current-workorder.json` → `openFindings` (pominięte wpisy `RESOLVED`).
Wszystkie decyzje projektowe rozstrzygnięte w tym dokumencie zgodnie z instrukcją człowieka („wybierz rekomendowaną opcję, nie pytaj").
Jedyny punkt świadomie NIEROZSTRZYGANY: #9 (wymaga ręcznej akcji człowieka poza kodem).

## Wymagania (rejestr)
- `SEC-RLS-AUDITOR-SCOPE` (AC10 bez testu — punkt 13)
- `SEC-LEADS-LIST-SCALARS` (status księgowy — punkt 15)
- `CRM-DELETE-ADMIN-ONLY` (rozbicie per zasób — punkt 22)
- `SEC-RODO-DELETE` / `DELETE_POLICIES.clients` (punkt 21 — grupa C)
- `FLD-CONSENT-DOCS` (punkt 23)
- Nowe wymagania do rejestracji: patrz Grupa B, sekcja „Zmiana kontraktu".

---

## PODZIAŁ NA GRUPY WYKONAWCZE

| Grupa | Charakter | Punkty | Okno kontraktowe |
|---|---|---|---|
| **A** | czysty kod produkcyjny + testy, zero dotknięcia `contracts/`, `schema.prisma`, `supabase/migrations/` | 2, 3, 4, 5, 6, 7, 8, 18, 19(część), 1 | NIE |
| **B** | jedno wspólne okno kontraktowe (`contract-steward`): rejestr wymagań, `tools/`, migracja SQL | 10, 11, 12, 13, 14, 15, 17, 19(część), 20, 22, 23, 24 | TAK — **jedno okno, na końcu grupy A** |
| **C** | osobne, większe Work Ordery — poza zakresem tej tury | 16, 21 | TAK, własne |
| **H** | ręczna akcja człowieka | 9 | — |

**Kolejność iteracji GREEN** (limit 3 na przebieg pętli — nie łączyć więcej niż 3 punktów „średnich" w jednym przebiegu):

1. Przebieg 1 (A-1): punkty **4, 3, 18** — poprawki bezpieczeństwa/poprawności zachowania, najwyższa wartość, każdy mały.
2. Przebieg 2 (A-2): punkt **2** (hydration w 4 plikach) + punkt **19a** (green-sla, as-any, adr010).
3. Przebieg 3 (A-3): punkty **1, 5, 6, 7, 8** — jeden wspólny refaktor zod (jeden pakiet schematów), pozostałe wypadają z niego jako skutek uboczny.
4. Przebieg 4 (B): jedno okno kontraktowe, wszystkie punkty grupy B razem.
5. Później, osobno: C (#16, #21).

---

# GRUPA A — bez okna kontraktowego

## Punkt 4 (MEDIUM) — `deleteServiceAction` kasuje niewłaściwą encję
**STATUS: PRZENIESIONE DO GRUPY C — konflikt z ADR-010, wykryty w fazie RED 2026-08-31.**

`adr010-derived-write` blokuje (celowo, per `docs/architecture/CHANGES-ADR-010.md`) każdy zapis do `installations.next_service_date` z kodu aplikacji — pole jest wyliczane wyłącznie przez efekt `do:computeNextServiceDate`. Rekomendowana niżej naprawa (`next_service_date: null`) jest więc kontraktowo niedozwolona, nie tylko stylistycznie niepożądana. Co więcej, `getUpcomingServices()` w ogóle nie czyta tabeli `services` — całe źródło tego widoku jest sprzed ADR-010 i wymaga migracji do modelu `SRV-SOURCE-OF-TRUTH` (widok czyta `services`, gdy rekord istnieje, inaczej `next_service_date`), nie punktowej łatki. To zadanie tej samej wielkości co punkty #16/#21 (Grupa C) — własny WO, prawdopodobnie rola `contract-steward`+`implementer-server` wspólnie, bez zmiany kontraktu (SRV-SOURCE-OF-TRUTH i SRV-NEXT-DATE już istnieją, brakuje tylko implementacji).
Odpowiadająca część Punktu 18 (fail-closed w `services/actions.ts`) jest tym samym objęta tym przeniesieniem — naprawimy porządek `try`/`getCurrentActorRole()` przy okazji właściwego WO dla tej funkcji, nie osobno teraz (uniknięcie dwukrotnej zmiany tej samej funkcji w krótkim odstępie).

Oryginalny opis (nieaktualny w świetle ADR-010, zachowany dla historii):

**Rozmiar: mały. AKTUALNE — potwierdzone w kodzie.**

### Kontekst kodu
- `apps/b2b-web/src/app/(dashboard)/services/actions.ts:19-48` — `getUpcomingServices()` czyta `prisma.instalacje.findMany`, zwraca `id: inst.id` (**id instalacji**).
- Tamże `:51-66` — `deleteServiceAction(id)` robi `prisma.serwisy.delete({ where: { id } })` — **inna tabela, niezależne UUID**.
- Bramka `can(actorRole, "services", "delete")` istnieje i jest przed zapytaniem — autoryzacja OK, kasowanie nie.

### Decyzja (rozstrzygnięta)
Widok „Serwisy Gwarancyjne" jest projekcją `instalacje.next_service_date` — nie ma w nim żadnego wiersza `serwisy`. „Usunięcie serwisu" w tym widoku znaczy **wyzerowanie terminu przeglądu**, nie skasowanie encji.
**REKOMENDOWANE i przyjęte:** zamienić `delete` na `prisma.instalacje.update({ where: { id }, data: { next_service_date: null } })` i przemianować akcję na `clearServiceScheduleAction` (etykieta UI: „Usuń termin przeglądu"). Twarde kasowanie instalacji z tego widoku byłoby destrukcyjne i nie jest tym, czego użytkownik oczekuje po kliknięciu w wierszu przeglądu.
Odrzucone: (a) zmiana `getUpcomingServices` na czytanie `serwisy` — zmienia cały widok, to inne zadanie; (b) pozostawienie `serwisy.delete` — akcja jest dziś martwa (zawsze `P2025`).

### Kryteria akceptacji
- [ ] AC4.1: Wywołanie akcji z `id` istniejącej instalacji mającej `next_service_date` zwraca `{success:true}`, a wiersz `instalacje` **nadal istnieje** z `next_service_date === null`.
- [ ] AC4.2: Żadne wywołanie tej akcji nie dotyka `prisma.serwisy` (asercja: mock `prisma.serwisy.delete` nie został wywołany).
- [ ] AC4.3: Rola nie-admin (`monter`, `audytor`) dostaje odmowę **przed** jakimkolwiek zapytaniem Prisma (mock update nie wywołany).
- [ ] AC4.4: `id` nieistniejące → `{success:false, error}` bez rzucenia wyjątku poza akcję.
- [ ] AC4.5: Idempotencja — drugie wywołanie na tym samym `id` (już `null`) zwraca `{success:true}`, nie błąd.

### Poza zakresem
Sens biznesowy tabeli `serwisy` i to, czy powinna zasilać ten widok.

---

## Punkt 3 (MEDIUM) — `assignCrewToLead`: `can()` po dwóch zapytaniach Prisma
**Rozmiar: mały. AKTUALNE — potwierdzone.**

### Kontekst kodu
`apps/b2b-web/src/app/(dashboard)/leads/actions.ts`: `assignCrewToLead` zaczyna od `prisma.leady.findUnique` (~:164), potem `prisma.zespoly_monterskie.findMany` (~:183), a `getCurrentActorRole()` + `can(role,'leads','update')` dopiero ~:202 — po pięciu możliwych, różniących się komunikatach (`lead nie znaleziony` / `zły status` / `brak daty rezerwacji` / `zespół nie znaleziony` / `nieaktywny` / `nieważny certyfikat`).
Wzorzec poprawny do skopiowania: `leads/[id]/actions.ts` `updateLeadAuditor` (bramka jako pierwsza instrukcja w `try`).

### Zmiana
Przenieść blok `const actorRole = await getCurrentActorRole(); if (!actorRole || can(...) !== 'yes') return …` na **pierwszą instrukcję w `try`**, przed `prisma.leady.findUnique`. Komentarz MAJOR zostaje przy przeniesionym bloku.

### Kryteria akceptacji
- [ ] AC3.1: Dla roli bez `leads.update` odpowiedź jest **bajt-identyczna** dla: nieistniejącego leada, leada w złym statusie, leada bez `data_rezerwacji`, nieistniejącej ekipy, ekipy z wygasłym certyfikatem.
- [ ] AC3.2: Dla roli bez uprawnień `prisma.leady.findUnique` i `prisma.zespoly_monterskie.findMany` **nie są wywołane ani razu** (asercja na mockach).
- [ ] AC3.3: Ścieżka pozytywna (admin/dyspozytor) zachowuje wszystkie dotychczasowe komunikaty i tworzy/aktualizuje `instalacje` w tej samej transakcji — brak regresji istniejących testów.

### Przypadki brzegowe z testem
- `getCurrentActorRole()` rzuca wyjątek → odmowa (fail-closed), nie ogólny błąd.
- Współbieżność: certyfikat wygasł między `getCrews()` a kliknięciem — druga walidacja w akcji zostaje (nie usuwać jej „bo już jest w getCrews").

---

## Punkt 18 (LOW) — niespójny fail-closed: `getCurrentActorRole()` wewnątrz `try`
**Rozmiar: mały. AKTUALNE** — `customers/actions.ts:52,75`, `installations/actions.ts:60,92`, `incidents/actions.ts:44`, `services/actions.ts:53`.

### Zmiana
We wszystkich czterech plikach wyciągnąć `getCurrentActorRole()` + `can()` **przed** `try { }` obejmujący mutację, wzorem `leads/actions.ts` i `logistics/actions.ts` (tam bramka jest przed `try`).

### Kryteria akceptacji
- [ ] AC18.1: Gdy `getCurrentActorRole()` rzuca, każda z tych akcji zwraca komunikat odmowy uprawnień (nie „Nie udało się zapisać…").
- [ ] AC18.2: Mutacja Prisma nie zostaje wywołana ani razu w tym scenariuszu.
- [ ] AC18.3: `tools/kk-authz-gate.mjs` nadal raportuje 0 naruszeń.

---

## Punkt 2 (MEDIUM) — hydration mismatch: `format()` bez strefy w 4 client components
**Rozmiar: mały-średni. AKTUALNE** — potwierdzone wystąpienia:
- `incidents/incidents-client.tsx:140`
- `services/services-client.tsx:120, 125`
- `installations/installations-client.tsx:151`
- `customers/customers-client.tsx:132`

Wzorzec docelowy istnieje: `leads/leads-client.tsx:7,17` (`formatInTimeZone(date, APP_TIMEZONE, pattern, {locale: pl})`).

### Zmiana
Wyciągnąć `APP_TIMEZONE = 'Europe/Warsaw'` i helper `formatDate(date, pattern)` do **jednego współdzielonego modułu** (np. `apps/b2b-web/src/lib/format-date.ts`), przepiąć `leads-client.tsx` na import z niego (usunięcie lokalnej kopii), a następnie zamienić wszystkie 5 wystąpień w 4 plikach. Zachować dokładnie te same wzorce formatu (`"dd.MM.yyyy HH:mm"`, `"dd MMM yyyy"`, `"dd MMMM yyyy"`, `"dd.MM.yyyy"`) i `locale: pl` tam, gdzie dziś jest.

### Kryteria akceptacji
- [ ] AC2.1: Ten sam znacznik czasu renderowany przy `TZ=UTC` i `TZ=Europe/Warsaw` daje **identyczny tekst** dla każdego z 5 miejsc (test na helperze, nie na komponencie).
- [ ] AC2.2: `grep -rn "format(new Date(" apps/b2b-web/src` zwraca zero trafień w `(dashboard)` client components.
- [ ] AC2.3: Data graniczna: `2026-01-01T23:30:00Z` renderuje `02.01.2026` (dzień następny w Warszawie), nie `01.01.2026`.

### Przypadki brzegowe z testem
- Przejście czasu letni/zimowy (`2026-03-29`, `2026-10-25`).
- `null`/`undefined` w polu daty — `installations.plannedDate`, `services.installation_date` są nullable; helper musi mieć zdefiniowane zachowanie (zwrot `"—"`), a nie `Invalid Date`.

---

## Punkty 1, 5, 6, 7, 8 — jeden refaktor: walidacja Zod po stronie serwera
**Rozmiar łączny: średni-duży (jeden przebieg GREEN, nie łączyć z niczym innym).**

### Kontekst kodu — zweryfikowany
- Zod jest w monorepo, ale **wyłącznie po stronie klienta**: `crews/components/AddCrewModal.tsx`, `auditors/components/AddAuditorModal.tsx`. **Zero z 10 plików `actions.ts`** w `apps/b2b-web/src/app/(dashboard)` importuje `zod` — narusza ADR-001 („Mutacje: Server Actions + walidacja Zod").
- `auditors/actions.ts:204-215` — `preferowane_marki`: `JSON.parse` + `Array.isArray`, **bez sprawdzenia typu elementów** (punkt 6, aktualne).
- Pola liczbowe konwertowane przez `Number(...)` → `NaN` przechodzi do Prismy (punkt 7, aktualne).
- `auditors/actions.ts:367` i `crews/actions.ts:340` — `const data: Record<string, unknown>` (punkt 8, aktualne).
- Rozjazd konwencji kluczy `FormData` (punkt 5): `auditors` używa nazw kolumn (`imie_i_nazwisko`, `doswiadczenie_hvac_lata`), `crews` krótkich angielskich (`name`, `phone`, `coordinator`, `fgazCert`).

### Decyzje (rozstrzygnięte)
**D1 — jeden współdzielony schemat.** Utworzyć `apps/b2b-web/src/app/(dashboard)/auditors/schema.ts` i `.../crews/schema.ts` (moduły bez `"use server"`), eksportujące schematy Zod importowane **zarówno przez modal (`zodResolver`), jak i przez Server Action**. Dziś schematy żyją tylko w modalach i muszą stamtąd zostać przeniesione, nie zduplikowane.
**D2 — konwencja kluczy `FormData`: nazwy kolumn Prisma (`snake_case`), jak w `auditors`.** Uzasadnienie: ADR-002 nakazuje `snake_case` dla identyfikatorów technicznych; `crews` odbiega, bo test RED założył krótkie klucze zanim zauważono niespójność. Zmiana dotyczy `crews/actions.ts` + `AddCrewModal.tsx` + `crews-kartoteka.test.ts`. **Uwaga o roli:** zmiana istniejącego testu należy do `test-author`, nie do implementera — zaplanuj jako osobny krok RED przed implementacją, inaczej implementer utknie na zakazie edycji testów.
**D3 — typ payloadu.** `Record<string, unknown>` → `Prisma.audytorzyUpdateInput` / `Prisma.zespoly_monterskieUpdateInput`. Bez `as any`, bez `@ts-ignore` (zakaz twardy).
**D4 — liczby.** `z.coerce.number().int().nonnegative()` z komunikatem wskazującym pole; `''` → `null` dla pól opcjonalnych.
**D5 — `preferowane_marki`.** `z.array(z.string().min(1))` po `JSON.parse` (zamyka punkt 6 bez osobnej poprawki `every`).
**Errata do D2/przypadków brzegowych (2026-08-31, po review reviewera):** literalne `.strict()` NIE zostało użyte — domyślne zachowanie `z.object()` (ciche odrzucenie nieznanych kluczy przy budowie `parsed.data`, bez `.passthrough()` nigdzie w łańcuchu) daje identyczny efekt bezpieczeństwa (pole wstrzyknięte jak `is_active` nigdy nie trafia do Prismy), zweryfikowane empirycznie przez reviewera. Różnica jest wyłącznie w tym, czy cały payload jest odrzucany, czy oczyszczany — testy wymagają tego drugiego (sukces akcji mimo wstrzykniętego pola), więc `.strict()` byłby z nimi sprzeczny. Zaakceptowane jako poprawna realizacja intencji D2, litera „strict" w opisie była nieścisła.
**D6 — daty.** Zachować ustalony w erracie A-2 wzorzec `'' → null`, inaczej północ **UTC** (`new Date('YYYY-MM-DD')`). Nie zmieniać go „przy okazji" — `dateOnlyIso` porównuje w UTC.

### Kryteria akceptacji
- [ ] AC1.1: Wywołanie `createAuditorAction` z pominięciem UI, z e-mailem `"nie-email"`, zwraca odmowę wskazującą **pole `email`** i nie wywołuje `prisma.audytorzy.create`.
- [ ] AC1.2: To samo dla `doswiadczenie_hvac_lata: "abc"` — komunikat wskazuje pole, nie ogólne „Nie udało się utworzyć…" (punkt 7).
- [ ] AC1.3: `preferowane_marki = "[1,2]"` → odmowa wskazująca pole, zanim payload trafi do Prismy (punkt 6).
- [ ] AC1.4: `preferowane_marki = "{}"` (nie tablica) → ta sama klasa odmowy.
- [ ] AC1.5: Modal i Server Action odrzucają **ten sam** komplet wejść (test importuje jeden schemat, sprawdza obie ścieżki).
- [ ] AC5.1: `createCrewAction`/`updateCrewAction` przyjmują klucze `snake_case` zgodne z kolumnami; klucz w starej konwencji (`fgazCert`) daje odmowę „brak wymaganego pola", nie ciche pominięcie.
- [ ] AC8.1: Dopisanie `is_active`/`leave_status` do obiektu `data` w akcji **nie kompiluje się** (dowód: typ jest bramką) — weryfikowane przeglądem sygnatury, nie testem runtime.
- [ ] AC-E: Komplet 14 pól kartoteki (z `fgaz_valid_until`/`sep_valid_until`) przechodzi bez regresji; edycja bez podania pola daty nie zeruje jej po cichu (`formData.has()` zostaje).

### Przypadki brzegowe z testem
- Puste `FormData` → jedna odmowa z listą brakujących pól, zero zapytań do bazy.
- `is_active` przekazane w `FormData` przez atakującego → **ignorowane** (schemat go nie zna, `strict`), nie przepisywane do payloadu.
- Data w przeszłości nadal dozwolona (errata A-2), brak górnego ograniczenia roku.

### Poza zakresem
Zod w pozostałych 8 plikach `actions.ts` (te akcje przyjmują dziś głównie `id: string`, nie `FormData`) — osobne, późniejsze zadanie. **Ale**: udokumentować to jako świadomą granicę, żeby punkt „0/10 plików" nie wrócił jako to samo znalezisko.

---

## Punkt 19a (LOW) — trzy przedistniejące naruszenia bramki pre-commit (część kodowa)
**Rozmiar: mały. Do potwierdzenia w kodzie przed startem** (numery linii z findingu są sprzed kilku commitów).

### Decyzja (rozstrzygnięta)
**REKOMENDOWANE: naprawić trzy miejsca, nie rozszerzać baseline.** Baseline jest usprawiedliwiony dla ~1045 naruszeń ADR-002 sprzed decyzji; dla trzech miejsc jest tańszą wymówką niż naprawa i już dwukrotnie wymusił `--no-verify` (commity `e4aaf98`, `f84db4d`), co jest gorsze niż sam dług.
- `as-any` (`installations/actions.ts`, `logistics/actions.ts`, pole `odpowiedzi_triage`) → jawny typ `Prisma.JsonValue` / zawężenie przez `unknown` + walidacja kształtu. **Zakaz `as any` jest twardy — nie ma tu wariantu „zostawiamy".**
- `green-sla` (`installations-client.tsx`, `logistics-client.tsx`, `bg-green-500`/`text-green-600`) → token statusu z systemu designu; zieleń w alertach SLA jest zakazana, ale te miejsca trzeba **sprawdzić, czy to alert SLA czy neutralny status** — jeśli neutralny status, właściwą naprawą jest zawężenie reguły skanera (to punkt grupy B, `tools/`).
- `adr010-derived-write` — **fałszywy alarm** na odczycie `next_service_date` w `services/actions.ts`. Naprawa należy do `tools/` → grupa B, punkt 19b.

### Kryteria akceptacji
- [ ] AC19.1: `node tools/kk-precommit-scan.mjs` na pełnym zestawie plików → exit 0 bez `--no-verify` i bez nowych wpisów w baseline.
- [ ] AC19.2: Commit tych zmian przechodzi hook bez flagi omijającej (dowód: brak `--no-verify` w historii tego WO).
- [ ] AC19.3: Skaner przeskanowany **ponownie po każdej naprawie** — raportuje pierwsze dopasowanie na plik, więc naprawa `as-any` może odsłonić kolejną regułę (znany wzorzec tego repo).

---

# GRUPA B — jedno wspólne okno kontraktowe (`contract-steward`)

Wszystkie poniższe punkty dotykają `contracts/`, `tools/`, `supabase/migrations/` lub statusów w rejestrze. **Zaplanować jedno okno**, wykonać w kolejności: rejestr → tools → migracja → testy.

## Punkt 15 — `SEC-LEADS-LIST-SCALARS` status `TODO` mimo zamkniętej implementacji
**Rozmiar: trywialny. AKTUALNE** — `contracts/requirements.contract.mjs:180` ma `status: 'TODO'`, podczas gdy `SEC-LEADS-LIST-MINIMIZE:175` jest już `DONE`.
- [ ] AC15.1: `status: 'DONE'`, `node tools/kk-validate.mjs` i `kk-codegen.mjs --check` czyste, `kk-trace.mjs --enforce` nie zgłasza „DONE bez testu".

## Punkt 13 — AC10 `SEC-RLS-AUDITOR-SCOPE`: deny-by-default RLS na `leady` bez testu
**Rozmiar: mały.**
Cel: `supabase/migrations/20260824185845_security_enable_rls_baseline.sql:148-150` — RLS ON, jedyna polityka to INSERT dla `anon`, brak SELECT.
**Decyzja:** w tym środowisku brak dockera/psql/supabase CLI, więc **asercja statyczna nad treścią pliku migracji** jest jedynym wykonalnym testem — przyjęta.
- [ ] AC13.1: Test czyta plik migracji i asercjonuje: `ALTER TABLE ... leady ENABLE ROW LEVEL SECURITY` obecne ORAZ **zero** wystąpień `CREATE POLICY ... ON ... leady ... FOR SELECT`.
- [ ] AC13.2: Test analogicznie zamraża `klienci` i `adresy` (ta sama migracja, ten sam stan).
- [ ] AC13.3: Dopisanie permisywnej polityki SELECT do dowolnej z tych trzech tabel **wywala test** (dowód żywotności — sprawdzić lokalnie, nie commitować).
- [ ] AC13.4: Po dodaniu testu `SEC-RLS-AUDITOR-SCOPE` może przejść na `DONE` (zależność: to była jedyna blokada).

## Punkt 14 — MINOR: `select:{id,is_active}` przy dociąganiu audytora niezamrożony
**Rozmiar: trywialny.**
- [ ] AC14.1: `leads-auditor-scope.test.ts` asercjonuje `callArgs.select` przekazany do `audytorzy.findUnique` — dokładnie `{id:true, is_active:true}`, nic więcej.
- [ ] AC14.2: To samo w `leads-detail-scope.test.ts`.
- [ ] AC14.3: Usunięcie `select` z kodu wywala oba testy (dowód: mock zwraca to, co mu wpisano — asercja MUSI dotyczyć argumentu, nie wyniku).

## Punkt 12 — `kk-authz-gate.mjs` nie sprawdza kolejności `can()` vs. pierwsze zapytanie Prismy
**Rozmiar: średni.** Plik `tools/kk-authz-gate.mjs` (untracked, gotowy).
- [ ] AC12.1: Narzędzie raportuje naruszenie, gdy pierwsze `prisma.`/`tx.` w ciele eksportowanej funkcji występuje **przed** `can(`.
- [ ] AC12.2: Uruchomione na stanie sprzed punktu 3 wykrywa `assignCrewToLead`; po naprawie punktu 3 raportuje 0.
- [ ] AC12.3: Funkcje wyłącznie odczytowe bez mutacji nie generują fałszywych alarmów (albo są jawnie na liście wyjątków z komentarzem).
- [ ] AC12.4: Ograniczenie narzędzia jest udokumentowane w nagłówku pliku: skanuje wyłącznie `actions.ts` pod `apps/b2b-web/src/app`, więc mutacja w `lib/` lub Route Handlerze **nie jest wykrywana** — liczba znalezisk to dolna granica.

## Punkt 20 — podpięcie `kk-authz-gate.mjs` do `scripts/verify.sh`
**Rozmiar: trywialny. Zależność: punkty 3, 12, 18 muszą być zielone PRZED podpięciem.**
- [ ] AC20.1: Nowy `step` w `scripts/verify.sh` (obok `kk-naming --check-baseline`, przed `kk-trace --enforce`).
- [ ] AC20.2: `bash scripts/verify.sh --full` przechodzi.
- [ ] AC20.3: Sztuczne usunięcie `can()` z dowolnej akcji wywala `verify.sh` (dowód żywotności bramki, nie commitować).

## Punkt 19b — `adr010-derived-write`: fałszywy alarm na odczycie
**Rozmiar: mały.** `tools/kk-precommit-scan.mjs` — reguła traktuje odczyt `next_service_date` w `services/actions.ts` jak zapis.
- [ ] AC19b.1: Reguła dopasowuje wyłącznie kontekst zapisu (pole po lewej stronie w literale `data: {}`), nie samą nazwę kolumny.
- [ ] AC19b.2: Prawdziwy zapis do pola pochodnego nadal jest blokowany (test skanera na sztucznym wejściu).

## Punkt 24 — baseline naming zamraża liczniki wyższe niż stan faktyczny
**Rozmiar: mały.** `node tools/kk-naming.mjs --check-baseline` przechodzi dziś czysto, więc bufor faktycznie istnieje.
- [ ] AC24.1: Liczniki w `tools/kk-naming-baseline.json` obniżone do stanu faktycznego (przeliczyć narzędziem, nie ręcznie).
- [ ] AC24.2: Dodanie jednego nowego naruszenia w dowolnym z obniżonych plików wywala bramkę (dowód, że bufor zniknął).
- [ ] AC24.3: `bash scripts/verify.sh --full` zielone.

## Punkt 22 — rozbicie `CRM-DELETE-ADMIN-ONLY` na ID per zasób
**Rozmiar: średni.** `contracts/requirements.contract.mjs:151` — zakres „WSZYSTKICH 7 widokach", a `kk-trace.mjs` dopasowuje ID po komentarzu w teście, nie po zasobie → wymaganie pokazuje się jako pokryte przy dwóch widokach z siedmiu.
**Decyzja:** rozbić na `CRM-DELETE-ADMIN-ONLY-<RESOURCE>` (7 wpisów: `LEADS`, `CUSTOMERS`, `INSTALLATIONS`, `LOGISTICS`, `SERVICES`, `INCIDENTS`, `AUDITORS`/`CREWS` — **policzyć widoki ręcznie w kodzie**, liczba 7 z wymagania jest podejrzana). Wpis zbiorczy zostaje jako `SUPERSEDED` z odesłaniem, żeby nie zerwać historii.
- [ ] AC22.1: Każdy wpis ma osobne acceptance dla trzech warstw (UI / Server Action / RLS) i osobny status.
- [ ] AC22.2: `kk-trace.mjs` pokazuje realne pokrycie per zasób — wpisy bez testu warstwy UI i RLS są `TODO`, nie `DONE`.
- [ ] AC22.3: Istniejący WO `docs/workorders/CRM-DELETE-ADMIN-ONLY-REMAINING.md` (untracked) zaktualizowany o nowe ID.

## Punkt 17 — `shipLogisticsOrder`/`markAsDelivered` sprawdzają `leads.update`, nie `shipments`
**Rozmiar: mały. AKTUALNE** — `logistics/actions.ts:109, 173` (a także `bypassLogisticsOrder:148`, `rollbackLogisticsOrder:212`).
`shipments` **istnieje** w `RESOURCES` i `MATRIX` (`rbac.contract.mjs:13, 37`: read/create/update `admin+dyspozytor`, delete `admin`) — zestawy ról są dziś identyczne z `leads`, więc to dług utajony, nie dziura.
**Decyzja:** dodać sprawdzenie **koniunkcyjne** — akcja pisze do obu domen, więc wymaga obu zdolności: `can(role,'leads','update')==='yes' && can(role,'shipments','update')==='yes'`.
- [ ] AC17.1: Rola z `leads.update`, ale bez `shipments.update` (scenariusz testowy z podmienioną macierzą) dostaje odmowę.
- [ ] AC17.2: Zachowanie dla admin/dyspozytor bez zmian.
- [ ] AC17.3: Analogicznie w `rollbackLogisticsOrder` i `bypassLogisticsOrder`.

## Punkt 10 — buckety Storage `bazawiedzy` i `urzadzenia` publiczne, zero polityki SELECT
**Rozmiar: średni. UWAGA: stan nie jest odtwarzalny z repo** — `grep` po `supabase/migrations/*.sql` nie znajduje ani jednej wzmianki o tych bucketach. Ich konfiguracja żyje wyłącznie w żywej bazie, poza kontrolą wersji.
**Decyzja:** migracja zrównująca je z wzorcem `audytorzy`/`zespoly` (prywatne + polityka SELECT dla `authenticated`) — **ALE** wymaga uprzedniego ustalenia, co tam faktycznie leży.
- [ ] AC10.1: Migracja ustawia `public = false` dla obu bucketów i dodaje politykę SELECT ograniczoną do `authenticated`.
- [ ] AC10.2: Test statyczny zamraża stan (jak AC13.1): brak `public = true` dla tych bucketów w migracjach.
- [ ] AC10.3: Migracja jest idempotentna (`IF NOT EXISTS` / `ON CONFLICT`) — wzorzec obowiązujący w tym repo po incydencie 1/4.
- **RYZYKO:** jeśli publiczne URL-e tych bucketów są już osadzone w B2C lub w treściach marketingowych, zamknięcie ich **zepsuje działające obrazki**. Przed migracją sprawdzić `apps/b2c-web` pod kątem `bazawiedzy`/`urzadzenia` w URL-ach.

## Punkt 11 — GRANT dla `anon`/`authenticated` na `public.AuthorizedUser`
**Rozmiar: mały. Stan również spoza repo** (brak GRANT/REVOKE dla tej tabeli w `supabase/migrations/*.sql`).
**Decyzja:** dodać migrację z `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."AuthorizedUser" FROM anon, authenticated` — druga warstwa obok RLS, praktycznie za darmo.
- [ ] AC11.1: Po migracji `anon` i `authenticated` mają wyłącznie `SELECT` (jeśli w ogóle jest potrzebny) na tej tabeli.
- [ ] AC11.2: Ścieżka `addAuthorizedUser` (Server Action, Prisma, omija RLS i te GRANT-y) **nadal działa** — to jest ryzyko do sprawdzenia, nie założenie.
- [ ] AC11.3: Migracja idempotentna, z nagłówkiem mówiącym wprost, czy została uruchomiona na żywej bazie (wzorzec wymuszony przez incydent 1/4 — dwie migracje były zacommitowane i nigdy nie uruchomione).

## Punkt 23 — triggery `FLD-CONSENT-DOCS` bez testu integracyjnego
**Rozmiar: średni.** Migracja jest już uruchomiona na produkcji (2026-08-27). Brakuje testu na żywym Postgresie dla: freeze, append-only, version-must-be-current, częściowy indeks unikalny.
**Decyzja:** w tym środowisku **nie ma docker/psql/supabase CLI**, więc test integracyjny jest dziś **niewykonalny**. Zamiast udawać pokrycie: (a) dodać asercję statyczną nad treścią migracji (obecność każdego z 4 mechanizmów), (b) zarejestrować jawny dług.
- [ ] AC23.1: Test statyczny zamraża obecność wszystkich czterech mechanizmów w pliku migracji.
- [ ] AC23.2: Wymaganie `FLD-CONSENT-DOCS` **nie** dostaje statusu `DONE` na podstawie tego testu — dopisany komentarz „pokrycie statyczne, brak integracyjnego".
- [ ] AC23.3: Nowy wpis w rejestrze na test integracyjny, status `BLOCKED`, powód: brak środowiska Postgres w CI/lokalnie. **To jest realne wąskie gardło całego projektu**, nie drobiazg tego WO.

---

# GRUPA C — poza zakresem tej tury (osobne, większe Work Ordery)

## Punkt 16 — `shipLogisticsOrder`/`rollbackLogisticsOrder` nie wykonują efektów z `funnel.contract.mjs`
**Rozmiar: DUŻY. Rekomendacja: osobny WO, rola `notification-architect`.**

Kontrakt wymaga przy tych przejściach efektów `N5`, `N_ROLLBACK`, `I4` oraz `do: releaseCrewSlot`, `do: suspendLogisticsSla`. W `logistics/actions.ts` nie ma **żadnej** z tych rzeczy — akcje robią gołe `prisma.leady.update` / `$transaction`.

**Dlaczego nie mieści się w tej turze:**
1. `apps/b2b-web` **nie importuje `@klikklima/contracts` dla efektów** — nie istnieje żaden konsument `effects` po stronie B2B. Trzeba zbudować mechanizm, nie dopisać wywołanie.
2. `releaseCrewSlot` i `suspendLogisticsSla` **nie istnieją nigdzie w kodzie** — to nowe funkcje domenowe z własnymi regułami współbieżności (zwolnienie slotu to ten sam problem co rezerwacja: potrzebna blokada w bazie, nie sprawdzenie w JS).
3. Powiadomienie i zmiana statusu **muszą być jedną transakcją** (pułapka #2 z CLAUDE.md) — to przeprojektowanie tych czterech akcji, nie łatka.
4. Idempotencja: rollback wywołany dwa razy nie może wysłać dwóch SMS-ów.

**Do zrobienia w osobnym WO:** ustalić, czy kolejka powiadomień (`notification_queue`) ma już producenta po stronie B2B, czy trzeba go zbudować od zera. **To pytanie rozstrzyga rozmiar całego zadania** i musi być odpowiedziane przed planowaniem.

## Punkt 21 — sprzeczność polityki usuwania klienta
**Rozmiar: DUŻY. Rekomendacja: osobny WO.**

Trzy źródła:
- `contracts/rbac.contract.mjs:103` — `{ entity: 'clients', strategy: 'ANONYMIZE_OR_SET_NULL', rationale: 'RODO bez utraty historii finansowej montażu.' }`
- kod — `prisma.klienci.delete()` (twarde usunięcie)
- `docs/architecture/b2b_crm_specifications.md:32` — „twarde usunięcie / usunięcie zgodne z RODO", **sam nie rozstrzyga**

**Decyzja (rozstrzygnięta zgodnie z instrukcją, nie odsyłana do człowieka):** **kontrakt ma rację, kod jest zły.** Zasada zerowa tego repo mówi wprost: kontrakt jest źródłem prawdy, dokument opisuje intencję. Dokument architektury jest niejednoznaczny, więc nie może obalić kontraktu; `rationale` w kontrakcie podaje konkretny, prawnie umocowany powód (RODO + zachowanie historii finansowej), a kod nie podaje żadnego. **Kierunek naprawy: kod dostosowuje się do kontraktu — anonimizacja zamiast `delete`.**

**Dlaczego mimo rozstrzygnięcia to NIE mieści się w tej turze:**
1. To realna zmiana zachowania produkcyjnego usuwania danych osobowych, nie kosmetyka.
2. Anonimizacja wymaga zdefiniowania, **które kolumny `klienci` są PII** i czym je zastąpić — takiego wykazu nie ma dziś nigdzie.
3. `AUDIT_REQUIREMENTS.mustLog` zawiera `'anonymize'` i wymaga `requiresJustification` + `legalBases` — a **tabela `audit_log` nie istnieje** (znana pułapka repo). Anonimizacja bez wpisu audytowego łamie kontrakt w innym miejscu, więc to zadanie ciągnie za sobą utworzenie `audit_log`.
4. Ścieżek kasowania klienta może być więcej niż jedna — w tym repo ta sama encja bywa kasowana z dwóch widoków (precedens: `deleteLogisticsOrderAction` robi `prisma.leady.delete`, omijając bramkę w `deleteLeadAction`). Przed planowaniem: `grep -rn "prisma.klienci.delete"` po całym `apps/`.

**Zakres osobnego WO:** wykaz kolumn PII → `audit_log` (migracja + kontrakt) → `anonymizeClientAction` → aktualizacja UI („Usuń" → „Anonimizuj (RODO)") → test na nieodwracalność i idempotencję.

---

# PUNKT 9 — WYMAGA RĘCZNEJ AKCJI CZŁOWIEKA

**Brak kont testowych non-admin (`dyspozytor`, `audytor`, `monter`) w `public.AuthorizedUser` na produkcji.**

`AuthorizedUser` ma dziś wyłącznie 3 konta `admin`. W konsekwencji cała różnicowa część macierzy RBAC jest sprawdzona **wyłącznie testami jednostkowymi** — weryfikacja end-to-end typu „dyspozytor nie może wgrać zdjęcia" (krok 3b migracji `20260828120000`) jest dziś fizycznie niewykonalna.

**Dlaczego nie automatyzuję:** założenie kont wymaga utworzenia prawdziwych tożsamości w Supabase Auth i wpisów w produkcyjnej tabeli `AuthorizedUser`. To dane produkcyjne i decyzja o tym, jakie adresy/hasła istnieją w systemie — nie zgaduję tego i nie tworzę migracji, która by to robiła.

**Co człowiek musi zrobić ręcznie:** założyć po jednym koncie dla ról `dyspozytor`, `audytor`, `monter` (Supabase Auth + wpis w `AuthorizedUser`) i przekazać ich adresy, żeby dało się napisać scenariusze e2e.
**Uwaga praktyczna:** `SettingsClient.tsx:31` woła `addAuthorizedUser(email, "admin")` **na sztywno** — przez UI nie da się dziś założyć konta innej roli, choć sama Server Action przyjmuje dowolną rolę z `ROLES`. Odblokowanie tego w UI to osobne, małe zadanie kodowe (grupa A w przyszłej turze), niezależne od samej decyzji o kontach.

---

# RYZYKA I NIEZNANE (całość WO)

1. **Stan żywej bazy ≠ repo.** Punkty 10 i 11 opisują konfigurację, której **nie ma w `supabase/migrations/`**. Każdą migrację z tej grupy trzeba jawnie oznaczyć w nagłówku, czy została uruchomiona — precedens incydentu 1/4 (dwie zacommitowane, nigdy nieuruchomione migracje wywaliły produkcję).
2. **Punkt 5 wymaga zmiany istniejącego testu** (`crews-kartoteka.test.ts`). Implementer ma zakaz edycji testów. Zaplanować krok `test-author` PRZED implementacją, inaczej pętla stanie na `TEST-DEFECT`.
3. **Skaner pre-commit raportuje pierwsze dopasowanie na plik** — po naprawie `as-any` może odsłonić kolejną regułę. „Zielono po jednej naprawie" nic nie znaczy; skanować ponownie.
4. **Punkt 22 zakłada 7 widoków CRM za treścią wymagania.** Liczby z acceptance w tym repo bywają artefaktem — policzyć ścieżki `prisma.<tabela>.delete` ręcznie, greppując po TABELI, nie po nazwie widoku.
5. **Brak środowiska Postgres** blokuje punkt 23 i wszystkie przyszłe testy triggerów/RLS. To dług przekraczający ten WO — warto go zaadresować, zanim urośnie lista `BLOCKED`.
6. **Punkt 17** zmienia bramkę na koniunkcję; jeśli w przyszłości `MATRIX` da `shipments` szerszy zestaw ról niż `leads`, koniunkcja będzie bardziej restrykcyjna niż zamierzano. To świadomy wybór fail-closed.
