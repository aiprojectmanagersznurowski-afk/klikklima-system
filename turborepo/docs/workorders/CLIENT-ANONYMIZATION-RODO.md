# WO: CLIENT-ANONYMIZATION-RODO — usunięcie klienta zastąpione anonimizacją z wpisem audytowym

Data: 2026-09-01. Autor: `spec-analyst`.
**Rozmiar: DUŻY. Podzielony na trzy fazy A/B/C — patrz sekcja „Podział na fazy". Nie startować jako jeden przebieg GREEN.**

## Wymagania

- `CRM-DELETE-ADMIN-ONLY-CLIENTS` (status `TODO`, risk `HIGH`) — `contracts/requirements.contract.mjs:169`.
  Uwaga: jego kryteria mówią dosłownie „test dowodzi, że `prisma.klienci.delete` **nie zostało wywołane**”.
  Po tym WO ta metoda nie będzie wywoływana **nigdy**, więc kryterium przestaje być dyskryminujące
  (przechodzi trywialnie). Wymaga przeredagowania w rejestrze — patrz Faza A, punkt A5.
- `CRM-DELETE-ADMIN-ONLY` (`SUPERSEDED`) — kontekst historyczny, nie egzekwowalny.
- Nowe wymaganie do zarejestrowania: `CRM-CLIENT-ANONYMIZE-RODO` (Faza A).
- Nowe wymaganie do zarejestrowania: `SEC-AUDIT-LOG-APPEND-ONLY` (Faza A).

## Kontekst kodu (zweryfikowany greperem 2026-09-01)

### Istnieje

- `apps/b2b-web/src/app/(dashboard)/customers/actions.ts`
  - `getCustomers()` (l. 18) — brak bramki odczytu (norma w tym repo, poza zakresem).
  - `deleteCustomerAction(id)` (l. 50) — bramka `can(actorRole, 'clients', 'delete') === 'yes'` **jest**
    i jest poprawna (fail-closed przy rzucie `getCurrentActorRole`). Po niej `prisma.klienci.delete({ where: { id } })` (l. 67).
    Komentarz w kodzie (l. 63–66) sam przyznaje, że autor nie wiedział, co się stanie z encjami zależnymi.
  - `addCustomerAddress()` (l. 79) — bramka `clients.update`.
- `apps/b2b-web/src/app/(dashboard)/customers/customers-client.tsx`
  - `handleDelete` (l. 23) — `confirm()` z tekstem „trwale usunąć… nieodwracalna… (RODO)”, pozycja menu
    „Usuń (Tylko Admin)” (l. 176–179). **Komponent nie przyjmuje `actorRole`** — pozycja jest widoczna
    dla każdej roli, serwer odrzuca. `page.tsx` przekazuje tylko `initialCustomers`.
- `apps/b2b-web/tests/customers-authz-gates.test.ts` — pokrywa warstwę Server Action dla `deleteCustomerAction`
  (6 przypadków). Testy będą wymagały przepisania przez `test-author` (Faza B), bo znika nazwa akcji.
- Precedens modelu append-only w schemacie: `EmployeeConsent` (`schema.prisma:567`) —
  wyzwalacz `employee_consents_append_only_trg` odrzuca UPDATE także dla zapisu Prismą.
  **To jest wzorzec do skopiowania dla `audit_log`**, nie wymyślaj nowego.

### Brakuje

- **Tabela `audit_log` nie istnieje.** Zweryfikowane: `grep "^model" packages/database/prisma/schema.prisma`
  daje 21 modeli, żadnego `audit_log`. Zasób figuruje wyłącznie w `contracts/rbac.contract.mjs:13`
  (`RESOURCES`) i `:41` (`MATRIX`: `read: ['admin'], create: ['admin'], update: [], delete: []`).
- Brak kolumny znacznikowej na `klienci`, po której da się odróżnić rekord zanonimizowany od rekordu
  z pustymi danymi kontaktowymi (dziś `imie_i_nazwisko`, `email`, `telefon` są wszystkie nullowalne).
- Brak jakiejkolwiek akcji anonimizującej.
- `getCurrentActorRole()` (`apps/b2b-web/src/utils/supabase/server.ts:42`) zwraca **samą rolę, nigdy tożsamości**.
  Wpis audytowy „kto” wymaga osobnego odczytu `createClient().auth.getUser()` → `user.email` / `user.id`.
  To nie jest detal implementacyjny — bez tego `audit_log` nie ma aktora i cała tabela jest bezwartościowa.

### Alternatywne ścieżki kasowania klienta — WYNIK

`grep -rn "klienci.delete\|deleteMany" apps/ packages/` (pliki `.ts`/`.tsx`):
**jedyne wywołanie to `customers/actions.ts:67`.** Podejrzenie z wcześniejszego WO (analogia do
`deleteLogisticsOrderAction` → `prisma.leady.delete`, które omija `deleteLeadAction`) **NIE potwierdza się dla `klienci`**.
Punkt 4 zlecenia redukuje się więc do jednej zmiany, ale AC4 poniżej zamraża ten stan testem statycznym,
żeby druga ścieżka nie odrosła.

Skutki uboczne dzisiejszego twardego DELETE (do wypisania w uzasadnieniu zmiany, wszystkie FK są `onDelete: SetNull`):
`adresy.klient_id`, `leady.klient_id`, `serwisy.klient_id`, `usterki_incidents.klient_id` zostają wyzerowane —
historia montażu **osierocona, nie usunięta**. To jest dokładnie to, czemu `ANONYMIZE_OR_SET_NULL` ma zapobiec.

## Zmiana kontraktu

### WYMAGANA — schemat i migracja (`contract-steward`, okno kontraktowe)

1. **Nowy model `audit_log`** w `packages/database/prisma/schema.prisma` + migracja w `supabase/migrations/`.
2. **Nowa kolumna `klienci.anonymized_at`** (`DateTime? @db.Timestamptz(6)`) + migracja.
   Bez niej idempotencja (AC3) jest niesprawdzalna: „imię = `Klient usunięty`” to porównanie po treści,
   a treść może wpisać człowiek.
3. **Wpisy w `contracts/requirements.contract.mjs`** (dwa nowe + errata do `CRM-DELETE-ADMIN-ONLY-CLIENTS`).
4. Regeneracja `packages/contracts/src/generated/` przez `node tools/kk-codegen.mjs` (nigdy ręcznie).

### NIEWYMAGANA — `rbac.contract.mjs` (decyzja rozstrzygnięta, nie pytanie)

**Zdolność `delete` na zasobie `clients` ZOSTAJE bez zmiany nazwy, z nową semantyką.** Uzasadnienie:

- `PERMISSIONS` to zamknięty słownik zdolności wspólny dla wszystkich 13 zasobów. Dodanie `anonymize`
  wyłącznie dla `clients` wymusiłoby albo `anonymize: []` w dwunastu pozostałych wierszach `MATRIX`,
  albo warunkową walidację w `kk-validate.mjs`. Koszt bez zysku bezpieczeństwa: zestaw ról jest identyczny.
- `DELETE_POLICIES.clients = ANONYMIZE_OR_SET_NULL` **już dziś** definiuje, czym jest „delete” dla tego
  zasobu. Kontrakt jest spójny; niespójny jest kod. Zmiana kontraktu przesunęłaby winę w złą stronę.
- `AUDIT_REQUIREMENTS.mustLog` zawiera **osobno** `'delete'` i `'anonymize'`. To słownik **operacji audytowych**,
  nie zdolności RBAC. Wartość `operation` we wpisie audytowym dla klienta ma być `'anonymize'`,
  a bramka RBAC ma dalej pytać o `can(role, 'clients', 'delete')`. Te dwie osie się nie pokrywają i nie muszą.
- Zestaw ról bez zmian: `delete: ['admin']` (`rbac.contract.mjs:29`). Anonimizacja to nadal operacja wyłącznie admina.

**`audit_log` jako RESOURCE nie wymaga przeglądu ról.** Wiersz `:41` jest już poprawny i mocniejszy niż to,
czego potrzebujemy: `update: []`, `delete: []` — nikt, łącznie z adminem. `create: ['admin']` jest zgodne
z tym, że jedynym producentem wpisu jest akcja dostępna adminowi. Jedyne, czego brakuje, to **egzekwowanie**
tego w bazie (wyzwalacz), nie zmiana macierzy.

## Klasyfikacja kolumn

### `klienci` (`schema.prisma:39–50`) — komplet 4 kolumn skalarnych + 4 relacje

| Kolumna | Typ | PII? | Działanie przy anonimizacji |
|---|---|---|---|
| `id` | `String @id uuid` | nie (identyfikator techniczny) | **NIETKNIĘTE** — utrata id zrywa całą historię finansową |
| `imie_i_nazwisko` | `String?` | **TAK** | → `'Klient usunięty'` (literał, nie `null`) |
| `email` | `String?` | **TAK** | → `null` |
| `telefon` | `String?` | **TAK** | → `null` |
| `created_at` | `Timestamptz` | nie | **NIETKNIĘTE** — data założenia rekordu nie identyfikuje osoby |
| *(nowa)* `anonymized_at` | `Timestamptz?` | nie | ← `now()` |
| relacja `adresy[]` | — | patrz niżej | anonimizacja wierszy, **bez kasowania** |
| relacja `leady[]` | — | pośrednio | FK **NIETKNIĘTE**, patrz „Poza zakresem” |
| relacja `serwisy[]` | — | pośrednio | FK **NIETKNIĘTE** |
| relacja `usterki_incidents[]` | — | pośrednio | FK **NIETKNIĘTE** |

Dlaczego `imie_i_nazwisko` dostaje literał, a nie `null`: `getCustomers()` mapuje `c.imie_i_nazwisko || "Nieznany"`
(`actions.ts:40`). `null` udawałby brak danych, a nie świadomą anonimizację — operator zobaczyłby „Nieznany”
i uznał, że rekord wymaga uzupełnienia.

### `adresy` (`schema.prisma:53–69`) — relacja 1:N od klienta, **objęta tym WO**

FK `adresy.klient_id → klienci.id`, `onDelete: SetNull`. Adres jest PII (dane lokalizacyjne osoby fizycznej).

| Kolumna | Typ | PII? | Działanie |
|---|---|---|---|
| `id` | uuid | nie | **NIETKNIĘTE** (wskazują na nie `leady.adres_id`, `serwisy.adres_id`) |
| `klient_id` | uuid? | nie | **NIETKNIĘTE** — powiązanie z rekordem-cieniem ma zostać |
| `ulica_miasto` | `String?` | **TAK** | → `'Adres usunięty'` |
| `latitude` | `Float?` | **TAK** (geolokalizacja punktu wizyty) | → `null` |
| `longitude` | `Float?` | **TAK** | → `null` |
| `created_at` | `Timestamptz` | nie | **NIETKNIĘTE** |

Zakres: **wszystkie** wiersze `adresy` z `klient_id = <id>`. Nie tylko pierwszy.

### Nietykane, mimo że mogą zawierać PII w tekście swobodnym — patrz „Ryzyka”

`leady.odpowiedzi_triage` (Json), `leady.notatki_wewnetrzne`, `leady.lost_reason_note`,
`serwisy.opis_usterki`, `usterki_incidents.opis_usterki`, `usterki_incidents.zdjecia_url`,
`soft_leady.dane_kontaktowe` (tabela bez FK do `klienci` — nie da się jej powiązać zapytaniem).

## Projekt tabeli `audit_log` (Faza A, `contract-steward`)

Model Prisma `AuditLog` z `@@map("audit_log")`, kolumny `snake_case` (ADR-002):

| Kolumna | Typ | Null? | Uzasadnienie |
|---|---|---|---|
| `id` | uuid, `gen_random_uuid()` | NOT NULL | PK |
| `actor_email` | text | NOT NULL | „kto”. Tekst, nie FK do `AuthorizedUser` — usunięcie konta nie może skasować dowodu (ta sama logika co `onDelete: Restrict` w `EmployeeConsent`) |
| `actor_role` | text | NOT NULL | rola w chwili operacji; rola konta może się później zmienić |
| `operation` | text | NOT NULL | CHECK ograniczony do `AUDIT_REQUIREMENTS.mustLog` (6 wartości: `delete`, `anonymize`, `role_change`, `contract_override`, `manual_status_change`, `notification_resend`) |
| `resource` | text | NOT NULL | CHECK ograniczony do `RESOURCES` (13 wartości) |
| `record_id` | text | NOT NULL | „na jakim rekordzie”. Text, nie uuid — `AuthorizedUser.id` to `cuid()`, a ta tabela jest wspólna dla wszystkich zasobów |
| `justification` | text | NOT NULL, CHECK `length(btrim(justification)) >= 10` | `AUDIT_REQUIREMENTS.requiresJustification: true`. Pusty string nie jest uzasadnieniem |
| `legal_basis` | text | NOT NULL | CHECK ograniczony do `AUDIT_REQUIREMENTS.legalBases` (5 wartości) |
| `created_at` | timestamptz, `now()` w UTC | NOT NULL | „kiedy”. Nigdy nie zmieniane |

Bez `updated_at` — nie ma czego aktualizować w tabeli, której nikt nie aktualizuje.

Egzekwowanie append-only (`AUDIT_REQUIREMENTS.appendOnly: true`) — **trzy warstwy, bo Prisma omija RLS**:

1. `MATRIX` (`update: []`, `delete: []`) — już jest.
2. RLS: brak polityk UPDATE/DELETE dla którejkolwiek roli, łącznie z `admin`.
3. **Wyzwalacz** `audit_log_append_only_trg` (`BEFORE UPDATE OR DELETE … RAISE EXCEPTION`) — jedyna warstwa
   działająca przeciw zapisowi Prismą. Wzorzec skopiować z `employee_consents_append_only_trg`.

Indeksy: `@@index([resource, record_id])`, `@@index([created_at])`.
Retencja (`retentionDays: 1825`) — **poza zakresem tego WO**, patrz „Poza zakresem”.

## Projekt akcji (Faza B, `implementer-server`)

`anonymizeClientAction(id: string, input: { justification: string; legalBasis: LegalBasis })`
→ `Promise<{ success: boolean; error?: string }>`, w `customers/actions.ts`. Zastępuje `deleteCustomerAction`
(stara nazwa **usunięta**, nie zostawiona jako alias — alias to druga ścieżka).

Kolejność, która jest wiążąca:
1. `getCurrentActorRole()` w `try/catch` → wyjątek = odmowa (nie generyczny błąd zapisu).
2. `can(actorRole, 'clients', 'delete') !== 'yes'` → odmowa **zanim** powstanie jakiekolwiek zapytanie.
3. Odczyt tożsamości aktora (`auth.getUser()`); brak e-maila = odmowa fail-closed.
4. Walidacja Zod wejścia (`justification` min. 10 znaków po `trim`, `legalBasis` z `AUDIT_REQUIREMENTS.legalBases`).
   Uwaga: `zod` **nie jest dziś zależnością `apps/b2b-web` po stronie serwera** (0 z 10 plików `actions.ts` go importuje) —
   dodanie zależności jest częścią tej fazy, nie osobnym zadaniem.
5. **Jedna `prisma.$transaction`**, w niej i tylko w niej:
   a. `updateMany` na `klienci` z `where: { id, anonymized_at: null }` — zwrócone `count` jest bramką idempotencji;
   b. jeżeli `count === 0` → transakcja kończy się **bez** wpisu audytowego, akcja zwraca `{ success: true }`
      (rekord nie istnieje albo jest już zanonimizowany — obie sytuacje są stanem docelowym);
   c. `updateMany` na `adresy` gdzie `klient_id = id`;
   d. `audit_log.create` z `operation: 'anonymize'`, `resource: 'clients'`, `record_id: id`.
6. `revalidatePath('/customers')` i `revalidatePath('/customers/' + id)` **poza** transakcją.

`where: { anonymized_at: null }` w kroku 5a jest jednocześnie odpowiedzią na współbieżność: dwa równoległe
wywołania konkurują o ten sam wiersz, drugie widzi `count = 0`. Sprawdzenie „najpierw `findUnique`, potem `update`”
jest **niedopuszczalne** — to jest ten sam błąd, co sprawdzanie slotu w JS.

## Kryteria akceptacji (Faza B, o ile nie zaznaczono inaczej)

- [ ] **AC1 (nieodwracalność).** Po udanym wywołaniu odczyt klienta zwraca `imie_i_nazwisko = 'Klient usunięty'`,
      `email = null`, `telefon = null`, a wszystkie powiązane `adresy` mają `ulica_miasto = 'Adres usunięty'`,
      `latitude = null`, `longitude = null`. Żadna eksportowana funkcja w `apps/b2b-web` nie przyjmuje
      poprzednich wartości ani ich nie przechowuje — test statyczny: w repo nie istnieje akcja zapisująca
      kopię PII klienta przed anonimizacją.
- [ ] **AC2 (zachowanie wartości).** Po anonimizacji: `klienci.id` niezmienione; liczba wierszy w `leady`,
      `serwisy`, `usterki_incidents`, `adresy` wskazujących na tego klienta jest **identyczna** jak przed
      operacją; żadne `klient_id` nie zostało ustawione na `null`; `leady.finalna_wycena_pln` niezmienione.
- [ ] **AC3 (idempotencja).** Drugie wywołanie na tym samym `id` zwraca `{ success: true }`, nie rzuca,
      **nie tworzy drugiego wiersza w `audit_log`** i nie zmienia `anonymized_at` (znacznik z pierwszego wywołania).
      Liczba wierszy `audit_log` dla `record_id = id` po N wywołaniach wynosi 1.
- [ ] **AC4 (jedyna ścieżka).** Test statyczny nad całym `apps/`: literał `klienci.delete` nie występuje
      w żadnym pliku `.ts`/`.tsx` poza testami. Nazwa `deleteCustomerAction` nie jest eksportowana ani importowana nigdzie.
- [ ] **AC5 (atomowość audytu).** Gdy `audit_log.create` zawiedzie, klient **nie jest** zanonimizowany
      (rollback całej transakcji) — test wymusza błąd na wstawieniu wpisu i sprawdza, że `imie_i_nazwisko`
      ma wartość sprzed operacji. Symetrycznie: nie istnieje ścieżka kodu wykonująca `update` na `klienci`
      poza transakcją zawierającą `audit_log.create`.
- [ ] **AC6 (bramka roli, warstwa Server Action).** Wywołanie przez `dyspozytor`, `audytor`, `monter`
      jest odrzucone **zanim** powstanie zapytanie: mocki `prisma.klienci.updateMany`, `prisma.adresy.updateMany`
      i `prisma.audit_log.create` mają zero wywołań. Rzut z `getCurrentActorRole()` daje odmowę uprawnień,
      nie generyczny błąd zapisu.
- [ ] **AC7 (uzasadnienie obowiązkowe).** Wywołanie z `justification` pustym, samymi białymi znakami
      lub krótszym niż 10 znaków po `trim` jest odrzucone bez żadnego zapisu. `legalBasis` spoza
      `AUDIT_REQUIREMENTS.legalBases` jest odrzucone bez żadnego zapisu.
- [ ] **AC8 (treść wpisu audytowego).** Wpis powstały przy udanej operacji ma `operation = 'anonymize'`,
      `resource = 'clients'`, `record_id` równe anonimizowanemu `id`, `actor_email` równy e-mailowi
      zalogowanego użytkownika (nie `null`, nie stała), `actor_role = 'admin'`, `justification` i `legal_basis`
      dokładnie takie, jak przekazane.
- [ ] **AC9 (append-only, Faza A).** UPDATE i DELETE na `audit_log` wykonane z uprawnieniami omijającymi RLS
      (ścieżka Prismy) są odrzucone przez wyzwalacz. Test analogiczny do istniejącego dla `employee_consents`.
- [ ] **AC10 (UI, Faza C).** W widoku Klientów pozycja menu ma etykietę „Anonimizuj (RODO)”, jest widoczna
      **wyłącznie** dla roli `admin` (pozostałe role nie widzą jej w DOM), a jej wybór otwiera formularz
      z polem uzasadnienia i wyborem podstawy prawnej; przycisk zatwierdzenia jest nieaktywny, dopóki
      uzasadnienie ma mniej niż 10 znaków. Po sukcesie wiersz **zostaje** na liście z nazwą „Klient usunięty”
      (nie znika — dziś `setCustomers(prev => prev.filter(...))` go usuwa, to zachowanie musi zniknąć).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Współbieżność:** dwa równoległe wywołania na tym samym `id` → jeden wpis w `audit_log`, jedna zmiana danych.
- **Idempotencja:** wywołanie na kliencie już zanonimizowanym; wywołanie na `id`, którego nie ma w bazie
  (dziś Prisma rzuca `P2025` — `updateMany` nie rzuca, i to jest zamierzone).
- **Uprawnienia:** cztery role × ścieżka z pominięciem UI; `getCurrentActorRole()` rzucający wyjątek;
  zalogowany użytkownik bez adresu e-mail (fail-closed, `audit_log.actor_email` jest NOT NULL).
- **Atomowość:** błąd przy `audit_log.create` → brak anonimizacji; błąd przy `adresy.updateMany` → brak
  anonimizacji klienta **i** brak wpisu audytowego.
- **Klient bez adresów:** `adresy.updateMany` zwraca `count = 0`; operacja nadal kończy się sukcesem i wpisem audytowym.
- **Klient z wieloma adresami:** anonimizowane są wszystkie, nie pierwszy.
- **Strefa czasowa:** `anonymized_at` i `audit_log.created_at` zapisywane w UTC (`timezone('utc', now())`,
  spójnie z resztą schematu). Test nie może zakładać `Europe/Warsaw`.
- **Zmiana roli po operacji:** wpis audytowy zachowuje `actor_role` z chwili operacji, nawet gdy konto
  zostało później przemianowane lub usunięte z `AuthorizedUser`.

## Podział na fazy

Granica biegnie po **artefakcie i roli**, nie po temacie — trzy różne profile ryzyka, trzy zestawy testów.

**Faza A — kontrakt i schemat (`contract-steward`, okno kontraktowe). ~4 AC.**
A1. Model `AuditLog` + migracja + RLS + wyzwalacz append-only (AC9).
A2. Kolumna `klienci.anonymized_at` + migracja.
A3. Nowe wymaganie `CRM-CLIENT-ANONYMIZE-RODO` w rejestrze.
A4. Nowe wymaganie `SEC-AUDIT-LOG-APPEND-ONLY` w rejestrze.
A5. Errata do `CRM-DELETE-ADMIN-ONLY-CLIENTS`: kryterium „`prisma.klienci.delete` nie zostało wywołane”
    zastąpić „`prisma.klienci.updateMany` nie zostało wywołane”, bo po Fazie B stare przechodzi trywialnie.
A6. `node tools/kk-codegen.mjs` + `bash scripts/verify.sh --full`.
*Brak zależności. Startuje pierwsza. Bez niej Faza B nie ma się o co oprzeć.*

**Faza B — serwer (`test-author` → `implementer-server`). AC1–AC8, ~8 AC.**
Wymaga ukończonej Fazy A. Obejmuje przepisanie `apps/b2b-web/tests/customers-authz-gates.test.ts`
(znika `deleteCustomerAction`) — to praca `test-author`, nie implementera.

**Faza C — interfejs (`implementer-ui`). AC10, ~2 AC.**
Wymaga ukończonej Fazy B (sygnatura akcji). Obejmuje przekazanie `actorRole` z `page.tsx` do `CustomersClient`
(dziś nie jest przekazywana wcale) i formularz uzasadnienia zgodny z ADR-001
(`react-hook-form` + `zodResolver` — żaden formularz w B2B tego dziś nie robi, dwa istniejące modale łamią ADR-001;
ten formularz ustanawia wzorzec).

Łącznie ~14 AC. Jako jeden WO nie domknie się w trzech iteracjach GREEN.

## Poza zakresem

- **Retencja `audit_log` (1825 dni).** `AUDIT_REQUIREMENTS.retentionDays` nie ma dziś żadnego konsumenta,
  a zadanie kasujące stare wpisy stoi w sprzeczności z wyzwalaczem append-only — wymaga osobnej decyzji
  (wyjątek dla roli systemowej? partycjonowanie?). Osobne WO.
- **Anonimizacja pozostałych sześciu zasobów** (`leads`, `installations`, `services`, `incidents`,
  `auditors`, `crews`). `DELETE_POLICIES` daje im inne strategie (`CASCADE`, `BLOCK_UNTIL_REASSIGNED`) —
  kopiowanie tego wzorca byłoby sprzeczne z kontraktem.
- **Podpięcie `audit_log` do pozostałych pięciu operacji z `mustLog`** (`role_change`, `contract_override`,
  `manual_status_change`, `notification_resend`, `delete`). Tabela powstaje uniwersalna, ale konsument
  w tym WO jest jeden.
- **Widok „Rejestr audytowy” w panelu.** `MATRIX` daje `audit_log.read: ['admin']`, ale ekranu nie ma i nie powstaje tutaj.
- **Czyszczenie PII z tekstów swobodnych** (`notatki_wewnetrzne`, `odpowiedzi_triage`, `opis_usterki`, `zdjecia_url`).
- **Bramka odczytu na `getCustomers()`** — dziś jej nie ma, tak jak w 20 z 21 widoków. Osobny dług.
- **Warstwa RLS wymagania `CRM-DELETE-ADMIN-ONLY-CLIENTS`** — w tym środowisku nie ma Postgresa,
  więc test warstwy bazy jest niewykonalny (dotyczy wszystkich siedmiu wpisów potomnych).
- **`soft_leady.dane_kontaktowe`** — brak FK do `klienci`, nie da się powiązać zapytaniem.

## Ryzyka i nieznane

1. **Anonimizacja może nie wystarczyć dla `RODO_ERASURE_REQUEST`.** Żądanie usunięcia danych z art. 17 RODO
   bywa realizowane przez faktyczne usunięcie, a nie podstawienie. Kontrakt (`ANONYMIZE_OR_SET_NULL`)
   rozstrzyga technikę, ale nie odpowiada, czy dział prawny to zaakceptuje. **Nie blokuje tego WO**
   (kontrakt jest źródłem prawdy), ale wymaga potwierdzenia przez człowieka przed produkcją.
2. **Sprzeczność w dokumencie źródłowym — rozstrzygnięta zasadą zerową, nie moją preferencją.**
   `docs/architecture/b2b_crm_specifications.md:32` mówi „twarde usunięcie / usunięcie zgodne z RODO”
   (obie rzeczy naraz, dokument sam nie wybiera). `contracts/rbac.contract.mjs:103` mówi
   `ANONYMIZE_OR_SET_NULL`. Kontrakt wygrywa. **Dokument wymaga poprawienia przez `doc-scribe`** —
   dopóki tego nie zrobi, następny agent trafi na tę samą sprzeczność. To jest zadanie zależne, nie kosmetyka.
3. **PII w tekstach swobodnych zostaje w bazie po anonimizacji.** `leady.odpowiedzi_triage` pochodzi
   z formularza B2C i nikt nie zweryfikował, czy nie zawiera nazwiska lub telefonu wpisanego przez klienta
   w polu opisowym. Zanim ktoś nazwie tę operację „zgodną z RODO”, ktoś musi obejrzeć zawartość tego JSON-a na produkcji.
4. **Nie wiadomo, czy `audit_log` istnieje w żywej bazie Supabase.** W repo nie ma jej ani w schemacie,
   ani w migracjach — ale to samo dotyczyło bucketów Storage, które na produkcji istniały.
   Faza A musi zacząć od sprawdzenia stanu faktycznego, zanim wygeneruje `CREATE TABLE`.
5. **`record_id` jako `text` bez FK** — wpis może wskazywać nieistniejący rekord. To jest świadome:
   FK do `klienci` byłby złamany przy każdej innej wartości `resource`, a `Restrict` na FK zablokowałby
   kiedyś operację `delete`, którą ten sam rejestr ma dokumentować.
