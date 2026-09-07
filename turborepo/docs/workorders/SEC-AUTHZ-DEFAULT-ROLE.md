# WO: SEC-AUTHZ-DEFAULT-ROLE — usunięcie fail-open defaultu roli admina

Status: gotowy do fazy RED **z jednym punktem WYMAGAJĄCYM DECYZJI CZŁOWIEKA przed migracją** (czy dodać `CHECK (role IN (...))` — patrz sekcja poniżej). Wymaganie zarejestrowane w `contracts/requirements.contract.mjs:480-492` (`status: 'TODO'`, `domain: 'security'`, `risk: 'HIGH'`), commit `3217d4f`. Data WO: 2026-09-07.

## Wymagania

- `SEC-AUTHZ-DEFAULT-ROLE` (`contracts/requirements.contract.mjs:480-492`) — przedmiot tego WO, AC1-AC4 przeniesione i rozwinięte poniżej.
- Sąsiaduje (ten sam model `AuthorizedUser`, ten sam plik `settings/actions.ts`) z `SEC-LAST-ADMIN-GUARD` (`:445-459`) i `SEC-AUDIT-LOG-ROLE-CHANGE` (`:364-459`), ale **nie zależy** od żadnego z nich i nie jest przez nie zamykane — inny mechanizm awarii (fail-open default kolumny vs. usunięcie/zmiana roli ostatniego admina).

## Kontekst kodu (zweryfikowane 2026-09-07, odczyt z repozytorium)

### Istnieje

- `packages/database/prisma/schema.prisma:86-92`, `model AuthorizedUser`:
  ```
  model AuthorizedUser {
    id        String   @id @default(cuid())
    email     String   @unique
    role      String   @default("admin")
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
  }
  ```
  Linia 89 jest przedmiotem tego WO.
- Jedyny dzisiejszy punkt zapisu tego modelu poza migracjami: `apps/b2b-web/src/app/(dashboard)/settings/actions.ts`, `addAuthorizedUser(email, role)` (`:19-40`). Sygnatura wymaga `role: string` jako parametr obowiązkowy, bramka `can(actorRole, 'authorized_users', 'create')` wykonuje się przed jakimkolwiek zapytaniem, `role` jest walidowane względem `ROLES` z `@klikklima/contracts` (`:29-31`: `if (!(ROLES as readonly string[]).includes(role)) return { success: false, error: "Nieprawidłowa rola." }`), a `prisma.authorizedUser.create({ data: { email, role } })` (`:34-39`) przekazuje `role` explicite. Default na kolumnie nigdy nie jest dziś wykorzystywany przez tę ścieżkę.
  - Ochrona ostatniego admina (`updateAuthorizedUserRoleAction`) i usunięcie konta (`deleteAuthorizedUser`) nie tworzą nowych wierszy — nie dotyczą tego WO.
- `contracts/rbac.contract.mjs:9` — aktualna lista `ROLES`: `['admin', 'dyspozytor', 'audytor', 'monter']`.
- Precedens składni CHECK w tym repo, `supabase/migrations/20260901220000_rodo_audit_log_and_client_anonymization.sql:72-92`:
  ```sql
  CONSTRAINT audit_log_operation_check CHECK (operation IN (
    'delete', 'anonymize', 'role_change', 'contract_override',
    'manual_status_change', 'notification_resend'
  )),
  CONSTRAINT audit_log_resource_check CHECK (resource IN (
    'clients', 'leads', 'quotes', 'installations', 'services', 'incidents',
    'auditors', 'crews', 'shipments', 'notification_queue', 'message_templates',
    'authorized_users', 'audit_log'
  )),
  ```
  Ten wzorzec — nazwana `CONSTRAINT ... CHECK (kolumna IN (...))` licząca wartości z odpowiadającego kontraktu — jest tym, co AC3 rozważa dla `authorized_users.role`, gdyby decyzja wypadła na TAK.
- **AC4 już wykonane** (2026-09-07, ta sesja, przed napisaniem tego WO): zapytanie `SELECT * FROM "AuthorizedUser"` na żywej bazie zwróciło 4 wiersze, każdy z sensowną, zamierzoną rolą (`admin`, `dyspozytor`, `audytor`, `monter` — po jednym z każdej), żaden nie wygląda na przypadkowo przypisany przez default. Weryfikacja jest zamknięta — kolejna faza (implementacja) nie musi jej powtarzać.

### Brakuje

- Usunięcia `@default("admin")` w `schema.prisma:89` — kolumna ma dziś default, wbrew statement wymagania.
- Migracji Postgres `ALTER TABLE "AuthorizedUser" ALTER COLUMN role DROP DEFAULT` w `supabase/migrations/` — nie istnieje.
- Decyzji o `CHECK (role IN (...))` — patrz „WYMAGA DECYZJI” poniżej.

## Zmiana kontraktu

**NIEWYMAGANA w `contracts/rbac.contract.mjs` ani `contracts/requirements.contract.mjs`** — `ROLES` i samo wymaganie zostają bez zmian, to WO tylko domyka wpis już zarejestrowany.

**WYMAGANA w `schema.prisma` i `supabase/migrations/`** — to jest zmiana kontraktu w rozumieniu CLAUDE.md (schemat + migracje są w zakresie roli `contract-steward`, poza `implementer-server`). Konkretnie:
1. `schema.prisma:89`: `role String @default("admin")` → `role String` (bez `@default`, kolumna zostaje `NOT NULL` bez wartości domyślnej — Prisma `String` bez `?` jest już `NOT NULL`, nic więcej nie trzeba zmieniać w tej linii).
2. Nowa migracja SQL w `supabase/migrations/` z `ALTER TABLE "AuthorizedUser" ALTER COLUMN role DROP DEFAULT;` — i, warunkowo, `CHECK` (patrz AC3/decyzja).

Nie da się zamknąć tego WO bez tych dwóch zmian — to jest jego cała treść, nie efekt uboczny.

**WAŻNE dla kolejnego kroku planowania**: implementacja tego WO wymaga **osobnego okna kontraktowego** i roli **`contract-steward`**, NIE `implementer-server` — dotyka `schema.prisma` i `supabase/migrations/`, obu zablokowanych przez hook poza tym oknem. `implementer-server` nie ma tu żadnej pracy do wykonania (jedyny punkt zapisu, `addAuthorizedUser`, już przekazuje `role` explicite i nie wymaga zmiany kodu — patrz AC2).

## Kryteria akceptacji (przeniesione z kontraktu, rozwinięte do poziomu testowalnego/weryfikowalnego)

- [ ] AC1 — **Brak defaultu w schemacie i w bazie.** `schema.prisma` dla `AuthorizedUser.role` nie zawiera klauzuli `@default`. Na żywej bazie `information_schema.columns` dla `authorized_users.role` zwraca `column_default IS NULL` i `is_nullable = 'NO'`. Próba `INSERT INTO authorized_users (id, email, created_at, updated_at) VALUES (...)` **bez** kolumny `role` jest odrzucona przez bazę (naruszenie `NOT NULL`) — test integracyjny/migracyjny wykonuje taki INSERT wprost (SQL, z pominięciem Prismy i Server Action) i oczekuje błędu.
- [ ] AC2 — **Nieregresja `addAuthorizedUser`.** Testy istniejące dla `addAuthorizedUser` (tworzenie konta z podaną rolą, odmowa dla nieznanej wartości `role`, odmowa bez uprawnień) przechodzą **bez zmiany treści testu i bez zmiany kodu akcji** po zastosowaniu migracji — dowód, że usunięcie defaultu nie jest dla tej ścieżki zmianą łamiącą. Jeśli test wymaga modyfikacji, to jest sygnał, że coś poza tym WO się zmieniło, nie oczekiwany efekt.
- [ ] AC3 — **Decyzja o CHECK jest podjęta i udokumentowana PRZED napisaniem migracji przez `contract-steward`.** Migracja `DROP DEFAULT` jest wymagana niezależnie od wyniku tej decyzji. Jeśli decyzja to „dodać CHECK”: migracja zawiera `CONSTRAINT authorized_user_role_check CHECK (role IN ('admin', 'dyspozytor', 'audytor', 'monter'))` (albo nazwę zgodną z konwencją `<tabela>_<kolumna>_check` z precedensu `audit_log_operation_check`), a test migracyjny dowodzi, że `INSERT`/`UPDATE` z `role` spoza czterech wartości jest odrzucony przez bazę. Jeśli decyzja to „nie teraz”: WO jest zamykane z samym `DROP DEFAULT`, a ta część jest jawnie odłożona jako osobne, przyszłe ID w rejestrze (nie „zapomniana”, tylko odłożona z nazwą).
- [ ] AC4 — **Weryfikacja żywej bazy — WYKONANA, nie do powtórzenia.** Potwierdzone 2026-09-07 (patrz „Kontekst kodu” wyżej): 4 wiersze w `AuthorizedUser`, każdy z sensowną rolą. Migracja `DROP DEFAULT` nie modyfikuje istniejących wartości i nie wymaga danych naprawczych. Kryterium jest już spełnione — dołączone tu wyłącznie dla kompletności rejestru, kolejna faza nie musi wykonywać tego zapytania powtórnie, chyba że między 2026-09-07 a wdrożeniem migracji ktoś dopisał nowe konto inną ścieżką niż `addAuthorizedUser` (do sprawdzenia przez `contract-steward` tuż przed uruchomieniem migracji na produkcji, jednym `SELECT COUNT(*)` porównanym z liczbą z tego WO — 4).

## WYMAGA DECYZJI: czy migracja dodaje `CHECK (role IN (...))` egzekwujący `ROLES` z `rbac.contract.mjs`

`ROLES` dzisiejsze (`contracts/rbac.contract.mjs:9`): `['admin', 'dyspozytor', 'audytor', 'monter']`.

**Za dodaniem CHECK:**
- Druga, bazodanowa linia obrony — nawet ręczny `INSERT`/`UPDATE` z `psql`, bug w przyszłej migracji z seedem, albo potencjalny trigger Supabase Auth przy rejestracji, nie mógłby wpisać wartości `role` nieznanej systemowi RBAC. Bez CHECK, usunięcie samego `DEFAULT` zamyka fail-open na brak wartości, ale nie na wartość nieprawidłową (np. literówkę `"admim"` wpisaną ręcznie) — Prisma waliduje to w `addAuthorizedUser` (`ROLES.includes(role)`), ale to jest walidacja aplikacyjna, omijalna każdą ścieżką poza tą jedną Server Action, tak jak przy `SEC-AUDIT-LOG-DELETE`/`justification`.
- Precedens składniowy i wzorcowy już istnieje i jest zaakceptowany w tym repo: `audit_log_operation_check`, `audit_log_resource_check` (`supabase/migrations/20260901220000_...sql:72-82`) — nie jest to nowy typ mechanizmu, tylko powtórzenie znanego wzorca na nowej kolumnie.

**Przeciw dodaniem CHECK:**
- `ROLES` może się zmienić (nowa rola w przyszłości — system ma już historię dodawania zasobów/ról przez ADR, np. `ADR-012`). CHECK trzeba by wtedy migrować **razem** z każdą zmianą `rbac.contract.mjs`, czyli kontrakt JS i schema SQL muszą być ręcznie synchronizowane przy każdej zmianie — to jest dokładnie ten typ dryfu, który `kk-codegen.mjs --check` wykrywa dla wygenerowanego TypeScript, ale nic w tym repo nie wykrywa automatycznie dryfu między `ROLES` w `rbac.contract.mjs` i treścią `CHECK` w SQL. Zapomniana aktualizacja CHECK przy dodaniu nowej roli objawi się jako `23514` (`check_violation`) na produkcji przy pierwszej próbie przypisania nowej roli — awaria dopiero w runtime, nie przy `kk-validate.mjs`.
- Usunięcie samego `DEFAULT` już zamyka realny, opisany w treści wymagania problem (fail-open na brak wartości / cichy privilege escalation do `admin`). CHECK jest dodatkowym utwardzeniem przeciw **innemu** zagrożeniu (wartość nieprawidłowa, nie wartość brakująca) — nie jest tym samym problemem, i nie jest wymagany do zamknięcia `SEC-AUTHZ-DEFAULT-ROLE` w jego dosłownym `statement`.

**Rekomendacja analityka (nie decyzja):** dodać CHECK w tej samej migracji. Koszt synchronizacji jest niski — role w tym systemie zmieniają się rzadko (4 wartości od dawna, ostatnia duża zmiana macierzy to `ADR-012` dotycząca `RESOURCES`, nie `ROLES`) i wzorzec `audit_log_*_check` już wymaga tej samej ręcznej dyscypliny synchronizacji z kontraktem, zaakceptowanej wcześniej dla `operation`/`resource`/`legal_basis` — nie jest to nowy rodzaj ryzyka, tylko ten sam, już oswojony. Koszt braku CHECK (cichy zapis nieprawidłowej roli, wykryty dopiero przy audycie albo incydencie) jest wyższy niż koszt jednej dodatkowej linii w przyszłej migracji dodającej rolę. Ale to jest pytanie, które ma paść do człowieka — nie rozstrzygam.

## Przypadki brzegowe, które MUSZĄ mieć test

- **INSERT z pominięciem `role`, z pominięciem Prismy i Server Action (SQL wprost)** — jedyny sposób udowodnienia, że gwarancja jest w bazie, nie w kodzie aplikacji (AC1).
- **Jeśli CHECK jest dodany: INSERT/UPDATE z `role` spoza `ROLES`, wprost SQL** — dowód drugiej linii obrony (AC3, wariant „tak”).
- **`addAuthorizedUser` z poprawną rolą po migracji zwraca identyczny kształt sukcesu jak przed migracją** — nieregresja (AC2).
- **`addAuthorizedUser` z rolą spoza `ROLES` po migracji zwraca ten sam błąd walidacji aplikacyjnej `"Nieprawidłowa rola."`** co dziś, niezależnie od tego, czy CHECK istnieje — warstwa aplikacyjna odrzuca to szybciej niż baza i to musi zostać niezmienione (test nie powinien pokazać nagle błędu bazy `23514` tam, gdzie dotąd był czysty komunikat domenowy).

## Poza zakresem

- Zmiana `addAuthorizedUser` i innych Server Actions w `settings/actions.ts` — kod nie wymaga zmiany (AC2), to WO dotyczy wyłącznie `schema.prisma` i migracji.
- Ochrona ostatniego admina przy usunięciu/zmianie roli — `SEC-LAST-ADMIN-GUARD`, `SEC-AUDIT-LOG-ROLE-CHANGE`, osobne wymagania.
- Dodanie nowych ról do `ROLES` — nie jest treścią tego WO, tylko przesłanką w argumentacji „przeciw CHECK”.
- Naprawa hipotetycznych przyszłych punktów zapisu (trigger Supabase Auth, seedy) — nie istnieją dziś w kodzie, wymieniane wyłącznie jako motywacja dla samego wymagania, nie jako zadanie do wykonania.

## Ryzyka i nieznane

- **Kolejność migracji na środowiskach, gdzie istnieją wiersze zapisane z defaultem `admin` bez świadomej decyzji** — na dzisiejszej bazie (2026-09-07) nie ma takiego przypadku (AC4 potwierdzone), ale `contract-steward` powinien powtórzyć `SELECT COUNT(*)` tuż przed wdrożeniem na produkcji, jeśli między napisaniem tego WO a wdrożeniem minie zauważalny czas (patrz AC4).
- **Nazwa constraintu CHECK** (jeśli decyzja wypadnie na „tak”) nie jest ustalona w tym WO — `contract-steward` dobiera nazwę zgodną z konwencją repo (`<tabela>_<kolumna>_check`), analogicznie do `audit_log_operation_check`.
- **Decyzja o CHECK ma konsekwencję proceduralną**: jeśli „tak”, każda przyszła zmiana `ROLES` w `rbac.contract.mjs` musi automatycznie rodzić zadanie migracyjne dla `contract-steward` — nie ma dziś mechanizmu (analogicznego do `kk-codegen.mjs --check`), który by to wykrył automatycznie; to ryzyko trzeba przyjąć świadomie razem z decyzją, nie odkryć je po fakcie.

Kolejność ról: człowiek (decyzja CHECK: tak/nie) → `contract-steward` (schema.prisma + migracja) → `test-author` (RED, AC1-AC3 — AC4 już zamknięte) → `reviewer`. `implementer-server` nie ma zadania w tym WO.
