# WO: SEC-EMAIL-UNIQUE — brakujące ograniczenie UNIQUE na `email` w `audytorzy` i `zespoly_monterskie`

Źródła: `docs/workorders/PLAN-KOLEJNYCH-ZADAN.md` (P3, wiersz „Dryf `schema.prisma` vs żywa baza"),
raport `contract-steward` po zamknięciu `SEC-READ-GATES` (Ryzyko 1 przestało być nieznane),
`contracts/requirements.contract.mjs` → `SEC-AUTHZ-B2B-READS`, kryterium 8 (opisuje ten brak wprost).

## Wymagania

- Nowe ID do rejestracji: **`SEC-EMAIL-UNIQUE`**, domain `security`, risk `HIGH`, status wyjściowy `PLANNED`.
- Powiązane istniejące: `SEC-AUTHZ-B2B-READS` (kryterium 8 — obrona `take: 2` dla `zespoly_monterskie` już zamknięta),
  `SEC-RLS-AUDITOR-SCOPE` (`getLeads`/`getLeadDetail`, zakres `audytor:own`),
  `FLD-AVAILABILITY-SPLIT` (pierwotny powód powstania nieuruchomionej migracji).
- Kontrakt uprawnień bez zmian: `contracts/rbac.contract.mjs` → `leads.read = ['admin','dyspozytor','audytor:own']`.
  To WO **nie rusza macierzy** — domaga się tylko, żeby wyznaczenie „kto to `own`" było rozstrzygalne.

---

## Ustalony stan faktyczny

Wszystko poniżej zweryfikowane **bezpośrednim zapytaniem do żywej bazy 2026-09-03**
oraz odczytem kodu. Nie zgaduj ponownie, nie powtarzaj audytu.

### Baza — brak ograniczenia

`pg_indexes` + `pg_constraint` dla obu tabel zwracają **wyłącznie klucz główny**:

| Tabela | Indeksy | Ograniczenia |
|---|---|---|
| `audytorzy` | `audytorzy_pkey (id)` | `audytorzy_pkey` (typ `p`) |
| `zespoly_monterskie` | `zespoly_monterskie_pkey (id)` | `zespoly_monterskie_pkey` (typ `p`) |

Nie ma `audytorzy_email_key`. Nie ma `zespoly_monterskie_email_key`.

### Baza — stan danych (kolizje z migracją)

| Tabela | Wierszy | `email` niepustych | `email = ''` | `DISTINCT email` | Duplikaty | Duplikaty `lower(email)` |
|---|---|---|---|---|---|---|
| `audytorzy` | 3 | 3 | **0** | 3 | **0** | **0** |
| `zespoly_monterskie` | 2 | 2 | **0** | 2 | **0** | **0** |

**Punkt 4 z zamówienia rozstrzygnięty: żadnych kolizji nie ma.** Zero pustych stringów,
zero `NULL`, zero duplikatów — także bez rozróżniania wielkości liter. Migracja przejdzie
na dzisiejszym stanie danych.

Rozkład e-maili (istotny dla testów, bo to konta testowe z `AuthorizedUser`):

```
audytorzy:           ai.projectmanager.sznurowski@gmail.com (admin)      is_active=true
                     michal.sznurowski@gmail.com            (dyspozytor) is_active=true
                     sznu.michal@gmail.com                  (audytor)    is_active=true
zespoly_monterskie:  ai.projectmanager.sznurowski@gmail.com (admin)      aktywny=true
                     projektbanan@gmail.com                 (monter)     aktywny=true
```

Uwaga do zapamiętania: `ai.projectmanager.sznurowski@gmail.com` występuje **w obu tabelach**.
To nie jest duplikat w rozumieniu `UNIQUE` (ograniczenie działa per tabela) i nie blokuje migracji.
Rozstrzyganie tego przypadku jest już zamknięte przez `SEC-AUTHZ-B2B-READS` kryterium 10:
decyduje rola z `AuthorizedUser`, nie tabela pracownika. **Poza zakresem tego WO.**

Rozkład `leady.audytor_id` (materiał na test zakresu): `michal.sznurowski` = 9 leadów,
`ai.projectmanager` = 5 leadów, `NULL` = 8001 leadów.

### Migracja, która istnieje, ale nie została uruchomiona

`supabase/migrations/20260822120000_fld_availability_split_employee_email_unique.sql`
**już zawiera** dokładnie te dwa `CREATE UNIQUE INDEX IF NOT EXISTS`, wraz z uzasadnieniem
i sekcją diagnostyczną. Plik jest poprawny merytorycznie — po prostu **nigdy nie został wykonany**.

Dowód: `supabase_migrations.schema_migrations` zawiera **dwie** pozycje (`20260820120000`,
`20260820120100`). Tabela `_prisma_migrations` **nie istnieje**. Repozytorium ma 14 plików migracji.
Ewidencja migracji w tym projekcie jest zatem **niewiarygodna** — nie da się z niej odczytać,
co jest zaaplikowane. Jedynym źródłem prawdy o schemacie jest `pg_constraint` / `pg_indexes`.

**To jest właściwa diagnoza dryfu P3.** Dryf nie powstał przez cofnięcie zmiany na bazie ani
przez „zniknięcie" indeksu. Indeks nigdy nie zaistniał: `schema.prisma` dostał `@unique`,
plik migracji powstał, i na tym się skończyło.

### Kod — `schema.prisma`

Deklaruje `@unique` w obu miejscach (linie 218 i 454), z komentarzem tłumaczącym powód.
**`schema.prisma` opisuje stan DOCELOWY i jest poprawny — to WO go NIE zmienia.**
Odrzucamy jawnie wariant „zaktualizować schemat do rzeczywistości" z wiersza P3 planu:
usunięcie `@unique` zalegalizowałoby podatność zamiast ją zamknąć.

### Kod — sześć wywołań `findUnique({ where: { email } })`

Zamówienie wskazywało jedno miejsce (`getLeads`). Jest ich **sześć**:

| # | Plik | Linia | Funkcja | Tabela | Skutek trafienia w cudzy wiersz |
|---|---|---|---|---|---|
| 1 | `leads/actions.ts` | 353 | `getLeads` | `audytorzy` | **Odczyt cudzych leadów** — audytor A widzi listę audytora B |
| 2 | `leads/[id]/actions.ts` | ~42 | `getLeadDetail` | `audytorzy` | **Odczyt cudzego leada** po samym URL, z pełnym PII klienta |
| 3 | `auditors/actions.ts` | 143 | `setSelfAvailabilityAction` | `audytorzy` | **Zapis** dostępności za cudzą osobę |
| 4 | `auditors/actions.ts` | 191 | `acceptLegalDocumentVersionAction` | `audytorzy` | **Zapis zgody prawnej pod cudzym nazwiskiem** |
| 5 | `crews/actions.ts` | 133 | `setSelfAvailabilityAction` | `zespoly_monterskie` | **Zapis** dostępności za cudzą ekipę |
| 6 | `crews/actions.ts` | 177 | `acceptLegalDocumentVersionAction` | `zespoly_monterskie` | **Zapis zgody prawnej pod cudzą ekipą** |

Gradacja, która ma znaczenie przy priorytetyzacji faz:

- #3 i #5 mają **częściową** osłonę: porównują `own.id !== id` i odmawiają przy niezgodności.
  Przy duplikacie w obrębie jednej osoby daje to fałszywą odmowę (uciążliwość).
  Przy duplikacie między **dwiema różnymi osobami** o tym samym adresie osłona nie działa:
  A podaje `id` = B, `findUnique` zwraca wiersz B, `own.id === id` przechodzi.
- #4 i #6 **nie porównują niczego** — zapisują `EmployeeConsent` dla wiersza, który akurat wrócił.
  To najgorszy przypadek pod względem skutku: akceptacja dokumentu prawnego zapisana na
  niewłaściwą osobę jest nieodwracalna i ma konsekwencje poza systemem.
- #1 i #2 to ekspozycja PII i dokładnie ta klasa, którą zamykały `SEC-RLS-AUDITOR-SCOPE`
  i `SEC-AUTHZ-B2B-READS`.

### Kod — wzorzec docelowy jest już w repozytorium

`SEC-READ-GATES` zamknął ten sam problem dla `zespoly_monterskie` w trzech funkcjach
odczytowych. Wzorzec (`installations/actions.ts:49-56`, `services/actions.ts:58-65`,
`incidents/actions.ts:48-55`): `findMany({ where: { email }, take: 2 })`, następnie odmowa
gdy `matches.length !== 1` **lub** gdy rekord jest nieaktywny; dopiero potem zbudowanie
`scopeWhere`. `take: 2` jest celowe — wystarcza do stwierdzenia „więcej niż jeden", nie ciągnie
całej tabeli. **Nie wymyślaj nowego wzorca. Skopiuj ten.**

Asymetria nazw kolumn jest realna i celowa: `audytorzy.is_active`, `zespoly_monterskie.aktywny`.

### Kod — obsługa P2002 już istnieje i jest martwa

Wszystkie cztery akcje tworzące/edytujące mają **już** gałąź `P2002` z czytelnym komunikatem po polsku:

- `auditors/actions.ts:252` (`createAuditorAction`) i `:386` (`updateAuditorAction`)
  → `"Ten adres e-mail jest już przypisany do innego audytora."`
- `crews/actions.ts:250` (`createCrewAction`) i `:386` (`updateCrewAction`) → analogicznie.

**Ta obsługa jest dziś kodem nieosiągalnym.** Prisma rzuca `P2002` wyłącznie przy naruszeniu
ograniczenia unikalności w bazie — a ograniczenia nie ma. Punkt 3 z zamówienia („czy potrzebny
jest czytelny komunikat") jest więc już zrobiony w kodzie i czeka wyłącznie na migrację.
Zostaje jedna realna luka: **normalizacja wielkości liter** (niżej, D3).

### Kod — pusty string jest już odcięty w Zod

`auditors/schema.ts:64` i `crews/schema.ts:42` mają identyczne:
`z.union([z.literal(""), z.string().trim().email(...)]).transform(v => v === "" ? null : v)`.
Pusty string nigdy nie dociera do bazy jako `''` — jest zamieniany na `NULL`, a `NULL`
w PostgreSQL nie podlega `UNIQUE`. Ryzyko „wiele wierszy z `email=''`" jest zamknięte
**po stronie zapisu** (Zod) **i po stronie danych** (0 wierszy). Nie wymaga zmiany.

---

## Zmiana kontraktu

**WYMAGANA — i tylko w Fazie C.**

| Artefakt | Zmiana | Okno kontraktowe |
|---|---|---|
| `contracts/requirements.contract.mjs` | dopisanie `SEC-EMAIL-UNIQUE` | TAK |
| `supabase/migrations/<nowa>.sql` | nowy plik | TAK |
| `supabase/migrations/20260822120000_…email_unique.sql` | nagłówek „NIE URUCHOMIONA" (tylko komentarz) | TAK |
| `packages/database/prisma/schema.prisma` | **BRAK ZMIAN** | — |

`schema.prisma` już deklaruje stan docelowy. Dryf jest jednokierunkowy (schemat wyprzedza bazę),
więc naprawa jest wyłącznie migracyjna. To jest powód, dla którego Fazy A i B da się przeprowadzić
RED→GREEN **bez okna kontraktowego** — patrz „Kolejność".

---

## Decyzje rozstrzygnięte

### D1 — nowa migracja, nie edycja istniejącej. Z blokiem strażniczym.

**Decyzja:** napisać **nowy** plik `supabase/migrations/20260903HHMMSS_security_employee_email_unique_reassert.sql`.
Nie modyfikować ciała `20260822120000_…` — dopisać do niego wyłącznie komentarz nagłówkowy
stwierdzający, że plik nie został uruchomiony i że zastępuje go nowa migracja.

**Dlaczego nie edycja w miejscu:** ewidencja migracji w tym repo jest niewiarygodna
(2 wpisy w `schema_migrations` na 14 plików). Nie da się wykluczyć, że plik z sierpnia
jest gdzieś odnotowany jako wykonany. Edycja ciała pliku, który mógł zostać zaewidencjonowany,
to dokładnie ten rodzaj cichej rozbieżności, który wyprodukował obecny dryf.
Nowy, idempotentny plik jest bezpieczny w każdym scenariuszu i zostawia historię uczciwą.

**Blok strażniczy `DO $$ … RAISE EXCEPTION` — TAK, dodać.** Zamówienie pytało, czy to
nadmiarowe. Nie jest, ale **nie z powodu czytelności komunikatu** — komunikat PostgreSQL
(`could not create unique index … Key (email)=(…) is duplicated`) jest sam w sobie zrozumiały.
Powód jest inny i mocniejszy: plik zawiera **dwa** `CREATE UNIQUE INDEX`. Bez gwarancji
transakcji (patrz D2) duplikat w `zespoly_monterskie` przerwie migrację **po** utworzeniu
indeksu na `audytorzy`, zostawiając bazę w stanie połowicznym, a operatora z pytaniem
„co się właściwie udało". Blok strażniczy sprawdzający **obie** tabele **przed** pierwszym
`CREATE` zamienia to w jedno rozstrzygnięcie „wszystko albo nic" na poziomie intencji,
niezależnie od tego, czy runner opakowuje plik w transakcję.

Blok ma sprawdzać duplikaty **dokładne** (`GROUP BY email HAVING count(*) > 1`), bo tylko
takie łamią zaprojektowane ograniczenie. Duplikaty różniące się wielkością liter **nie**
powodują awarii migracji i nie mogą jej blokować — są osobnym problemem, adresowanym przez D3.

Komunikat wyjątku musi nazywać tabelę i podać zapytanie diagnostyczne. Rozstrzygnięcie,
który z dwóch wierszy jest prawdziwym pracownikiem, należy do **człowieka** — migracja nie ma
prawa niczego czyścić automatycznie, bo skasowanie e-maila odcina komuś dostęp do systemu.

Plik musi mieć nagłówek **„TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA"** wg wzorca ustalonego
w `20260901220000_rodo_audit_log_and_client_anonymization.sql` i `20260902170500_perf_foreign_key_indexes.sql`.

### D2 — bez `CONCURRENTLY`, spójnie z decyzją z 2026-09-02

**Decyzja:** zwykłe `CREATE UNIQUE INDEX IF NOT EXISTS`, bez `CONCURRENTLY`.

Zamówienie kazało sprawdzić, co postanowiono w `20260902170500_perf_foreign_key_indexes.sql`.
Postanowiono tam wprost: *„`CREATE INDEX CONCURRENTLY` nie może działać wewnątrz bloku
transakcyjnego, a mechanizm uruchamiania migracji w tym repozytorium nie daje gwarancji,
że plik nie zostanie owinięty w transakcję"*. Ta sama niepewność obowiązuje tutaj — pozostajemy
spójni. Przy 3 i 2 wierszach blokada `ACCESS EXCLUSIVE` trwa milisekundy.
Nagłówek nowej migracji ma tę decyzję powtórzyć wraz z warunkiem jej unieważnienia:
gdyby tabele urosły do rozmiarów produkcyjnych, plik należy najpierw rozbić na osobne
polecenia `CONCURRENTLY` uruchamiane poza transakcją.

Nazwy indeksów **muszą** brzmieć `audytorzy_email_key` i `zespoly_monterskie_email_key` —
to konwencja Prisma dla `@unique`, dzięki której introspekcja nie zobaczy dryfu po uruchomieniu.

### D3 — `UNIQUE (email)`, nie `UNIQUE (lower(email))`; wielkość liter normalizowana w Zod

**Decyzja:** ograniczenie na surowej kolumnie. Wielkość liter domykamy **w warstwie zapisu**,
dopisując `.toLowerCase()` do transformacji e-maila w `auditors/schema.ts` i `crews/schema.ts`.

`CREATE UNIQUE INDEX ON audytorzy (lower(email))` byłoby szczelniejsze, ale Prisma nie potrafi
wyrazić funkcyjnego indeksu unikalnego jako `@unique`, więc `schema.prisma` rozjechałby się
z bazą **w drugą stronę** — czyli wyprodukowalibyśmy nowy dryf, lecząc stary. Odrzucone.

Konsekwencja bez normalizacji: `Jan@X.pl` i `jan@x.pl` współistnieją mimo ograniczenia,
a `findMany({ where: { email } })` z adresem z sesji Supabase (zawsze małe litery) trafiłby
w jeden z nich. `.toLowerCase()` w Zod kosztuje jeden łańcuch metody i domyka to dla
wszystkich przyszłych zapisów. Dane istniejące już są w całości małymi literami
(0 duplikatów `lower(email)`), więc backfill nie jest potrzebny.

### D4 — `findUnique` → `findMany({ take: 2 })` we wszystkich sześciu miejscach. TAK, mimo migracji.

Zamówienie pytało, czy po Fazie C bramka w kodzie nie staje się zbędna. **Nie staje się.** Trzy powody:

1. **Migracja nie będzie uruchomiona przy zamknięciu tego WO.** Wzorzec ustalony w tej sesji
   (`20260901120000`, `20260901120100`, `20260902170500`) to plik zacommitowany i świadomie
   niezaaplikowany, czekający na osobną zgodę człowieka. Przez cały ten czas bramka w kodzie
   jest **jedyną** ochroną. To nie są pasy-i-szelki — to na razie same pasy.
2. **Bramka przeżywa cofnięcie migracji.** Sekcja ROLLBACK pliku z sierpnia to dwa
   `DROP INDEX`. Ochrona, która znika razem z indeksem, nie jest ochroną.
3. **`findUnique` po e-mailu kompiluje się wyłącznie dzięki `@unique` w `schema.prisma`** —
   czyli dzięki deklaracji, o której właśnie ustaliliśmy, że nie odpowiada bazie.
   `findMany` zrywa tę zależność: kod przestaje polegać na obietnicy schematu,
   a zaczyna weryfikować fakt. To jest sedno naprawy, nie dodatek do niej.

Poprzedni audyt bezpieczeństwa tej sesji preferował podwójne zabezpieczenie i tutaj
argument jest mocniejszy niż zwykle, bo obie warstwy chronią w **rozłącznych** oknach czasowych.

### D5 — brak pre-checku `findFirst` jako mechanizmu autorytatywnego; interim guard TAK

**Decyzja:** ograniczeniem autorytatywnym jest `UNIQUE` w bazie plus **istniejąca** gałąź
`P2002`. Dodatkowo w czterech akcjach create/update wstawiamy **nieautorytatywny** pre-check
`findFirst({ where: { email } })` → odmowa z tym samym komunikatem.

Uzasadnienie asymetrii: pre-check **nie jest** wyścigoodporny (dwa równoległe `create`
przechodzą oba sprawdzenia i oba zapisują), więc nie może zastąpić ograniczenia — i tak
ma być udokumentowany w kodzie. Ale w oknie między zamknięciem tego WO a uruchomieniem
migracji jest to jedyna rzecz, która powstrzymuje ścieżkę **produkującą** duplikat,
o który całe WO chodzi. Po uruchomieniu migracji degraduje się elegancko do „ładniejszego
komunikatu bez round-tripa do wyjątku", a `P2002` pozostaje siecią bezpieczeństwa.

**Pułapka do sprawdzenia przy implementacji:** w `updateAuditorAction` i `updateCrewAction`
pre-check musi wykluczyć edytowany rekord (`where: { email, id: { not: id } }`).
Bez tego zapisanie audytora bez zmiany e-maila zaczyna zwracać „ten e-mail jest już przypisany".
To najbardziej prawdopodobny sposób, w jaki ta zmiana zepsuje działającą funkcję.

---

## Kryteria akceptacji

Numeracja wg faz. Każde AC jest obserwowalne — mówi, co system robi, nie jak jest zbudowany.

### Faza A — bramka tożsamości w kodzie (bez okna kontraktowego)

- [ ] **AC-A1** Gdy w `audytorzy` istnieją **dwa** wiersze o adresie e-mail zalogowanego audytora,
      `getLeads()` **odmawia** (`{ success: false, error }`) zamiast zwrócić leady któregokolwiek
      z nich. Dowodem jest **brak wywołania** `prisma.leady.findMany` — nie pusta lista.
- [ ] **AC-A2** To samo dla `getLeadDetail(id)`: przy duplikacie odmowa, i to odmowa
      **nieodróżnialna** od odpowiedzi na lead nieistniejący (utrzymanie AC4 z `SEC-RLS-AUDITOR-SCOPE`
      — audytor nie może przez duplikat wywnioskować, że rekord istnieje).
- [ ] **AC-A3** `setSelfAvailabilityAction` (audytorzy i crews, osobno) przy duplikacie odmawia
      i **nie wywołuje** `availabilityDeclaration.upsert`. W szczególności: gdy dwie **różne osoby**
      mają ten sam adres, wywołujący A podający `id` osoby B dostaje odmowę — dziś przechodzi,
      bo `own.id === id` po trafieniu w wiersz B.
- [ ] **AC-A4** `acceptLegalDocumentVersionAction` (audytorzy i crews, osobno) przy duplikacie
      odmawia i **nie wywołuje** `employeeConsent.create`. Zgoda prawna nie zostaje zapisana
      na żaden z dwóch wierszy.
- [ ] **AC-A5** Ścieżka pozytywna nietknięta: dla dokładnie jednego dopasowania każda z sześciu
      funkcji działa jak przed zmianą. Konkretnie na żywych danych — audytor `sznu.michal@gmail.com`
      widzi swój zakres, `michal.sznurowski@gmail.com` widzi swoich 9 leadów.
      Bez tego AC cały zestaw przechodzi dla „naprawy", która odmawia wszystkim.
- [ ] **AC-A6** Rekord nieaktywny nadal daje odmowę we wszystkich sześciu miejscach,
      z zachowaniem asymetrii nazw (`audytorzy.is_active`, `zespoly_monterskie.aktywny`).
- [ ] **AC-A7** W `apps/b2b-web/src` **nie istnieje** żadne `findUnique` z kluczem `email`.
      Egzekwowalne testem statycznym (wzorem `rls-deny-by-default-freeze.test.ts`) — bez tego
      siódme wywołanie dopisane za miesiąc wraca do punktu wyjścia.
- [ ] **AC-A8** Fail-closed bez zmian względem `SEC-READ-GATES`: brak sesji, brak `email` w sesji,
      wyjątek z `getCurrentActorRole()` — odmowa, nigdy `where` zbudowane z `undefined`.

### Faza B — normalizacja i walidacja przy zapisie (bez okna kontraktowego)

- [ ] **AC-B1** E-mail podany w formularzu audytora lub ekipy jako `Jan.Kowalski@Example.PL`
      trafia do bazy jako `jan.kowalski@example.pl`. Dotyczy tworzenia **i** edycji.
- [ ] **AC-B2** Pusty e-mail nadal zapisuje się jako `NULL`, nie jako `''`
      (regresja istniejącego zachowania Zod — dwóch pracowników bez e-maila musi dać się zapisać).
- [ ] **AC-B3** Utworzenie audytora z adresem należącym do innego audytora zwraca
      `{ success: false, error: "Ten adres e-mail jest już przypisany do innego audytora." }`
      i **nie wywołuje** `prisma.audytorzy.create`. Analogicznie dla ekipy.
- [ ] **AC-B4** Kolizja rozpoznawana jest **bez względu na wielkość liter**:
      istniejący `jan@x.pl` blokuje utworzenie `JAN@X.PL`.
- [ ] **AC-B5** **Zapis audytora bez zmiany e-maila przechodzi.** Pre-check wyklucza edytowany
      rekord. To jest AC chroniące przed najbardziej prawdopodobną regresją tego WO.
- [ ] **AC-B6** Gałąź `P2002` nadal zwraca ten sam komunikat i jest osiągalna testem
      (Prisma rzuca `P2002` mimo przejścia pre-checku — symulacja wyścigu).
      Bez tego AC gałąź pozostaje kodem, o którym nikt nie wie, czy działa.
- [ ] **AC-B7** Adres używany przez audytora **nie** blokuje utworzenia ekipy o tym samym
      adresie. Ograniczenie działa per tabela; `ai.projectmanager.sznurowski@gmail.com`
      istnieje dziś w obu i ta konfiguracja musi pozostać legalna.

### Faza C — migracja (okno kontraktowe, `contract-steward`)

- [ ] **AC-C1** Plik migracji uruchomiony na bazie z duplikatem e-maila w `zespoly_monterskie`
      przerywa się **przed** utworzeniem jakiegokolwiek indeksu, komunikatem nazywającym tabelę
      i podającym zapytanie diagnostyczne. Baza zostaje bez zmian — nie w stanie połowicznym.
- [ ] **AC-C2** Uruchomienie migracji **dwa razy** pod rząd kończy się sukcesem i daje
      dokładnie po jednym indeksie na tabelę (idempotencja).
- [ ] **AC-C3** Po uruchomieniu `pg_indexes` zawiera `audytorzy_email_key`
      i `zespoly_monterskie_email_key`, oba `UNIQUE`, na kolumnie `email`.
- [ ] **AC-C4** Po uruchomieniu `INSERT` drugiego wiersza z istniejącym e-mailem zostaje
      odrzucony przez bazę, a `INSERT` **wielu** wierszy z `email IS NULL` przechodzi.
- [ ] **AC-C5** Plik ma nagłówek „TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA" wg wzorca sesji,
      zawiera sekcję ROLLBACK i jawnie odnotowuje decyzję o rezygnacji z `CONCURRENTLY`
      wraz z warunkiem jej unieważnienia.
- [ ] **AC-C6** Plik `20260822120000_…email_unique.sql` ma dopisany komentarz stwierdzający,
      że nigdy nie został uruchomiony i wskazujący plik zastępujący. Ciało pliku nietknięte.
- [ ] **AC-C7** `bash scripts/verify.sh --full` zielone. `schema.prisma` bez zmian w diffie.

---

## Przypadki brzegowe, które MUSZĄ mieć test

1. **Dwa wiersze, ta sama osoba** (ktoś zdublował rekord audytora) — odmowa, nie wybór pierwszego.
2. **Dwa wiersze, dwie różne osoby, ten sam adres** — to jest wektor eskalacji uprawnień.
   Osobny test od (1), bo w #3/#5 istniejące `own.id !== id` maskuje różnicę.
3. **Ten sam adres w `audytorzy` i `zespoly_monterskie`** — stan faktyczny na żywej bazie.
   Musi nadal działać: rozstrzyga rola z `AuthorizedUser` (`SEC-AUTHZ-B2B-READS` kryterium 10).
4. **Zero dopasowań** — pracownik bez rekordu, e-mail z sesji nie pasuje do niczego. Odmowa.
5. **Wielkość liter:** sesja Supabase podaje `jan@x.pl`, w bazie leży historyczny `Jan@X.pl`.
   Po Fazie B dla nowych zapisów to nie wystąpi; test ma udokumentować zachowanie
   dla danych sprzed normalizacji (spodziewane: brak dopasowania → odmowa, fail-closed).
6. **Idempotencja migracji** — dwa uruchomienia, jeden indeks.
7. **Współbieżność zapisu:** dwa równoległe `createAuditorAction` z tym samym e-mailem.
   Przed migracją: powstają dwa wiersze (znane, udokumentowane ograniczenie pre-checku — D5).
   Po migracji: jeden sukces, jeden `P2002` przetłumaczony na komunikat po polsku.
   Test ma **utrwalić tę różnicę**, żeby nikt nie uznał pre-checku za wyścigoodporny.
8. **`NULL` nie podlega ograniczeniu** — wielu pracowników bez e-maila zapisuje się nadal.
9. **Odmowa nieodróżnialna od braku danych** w `getLeadDetail` (punkt 2 wyżej + AC4
   z `SEC-RLS-AUDITOR-SCOPE`) — duplikat nie może stać się oraklem istnienia leada.
10. **Regresja `/leads` dla audytora** — strona renderuje się przy odmowie z bramki tożsamości,
    nie wywala się (zachowanie zamknięte przez `SEC-AUTHZ-B2B-READS`).

Zestawy ról w testach **wyliczane** z `ROLES` i `can()` z wygenerowanego kontraktu,
nie wpisane jako literały — konwencja utrzymana z `SEC-AUTHZ-B2B-MUTATIONS`.
Nazewnictwo plików: `apps/b2b-web/tests/<kebab-case>.test.ts`. Tagi `@REQ SEC-EMAIL-UNIQUE`
obowiązkowe, inaczej `kk-trace` nie zobaczy pokrycia (dokładnie ten dług zatrzymał
`SEC-AUTHZ-B2B-READS` na statusie `IMPLEMENTING`).

---

## Kolejność wykonania

Ułożona tak, żeby okno kontraktowe było potrzebne **możliwie późno**, zgodnie z zamówieniem.
Kluczem jest ustalenie, że `schema.prisma` **nie wymaga zmiany** — to zdejmuje z Faz A i B
całą zależność od okna.

| Faza | Rola | Zakres zapisu | Okno kontraktowe |
|---|---|---|---|
| **A1** | `test-author` | `apps/b2b-web/tests/` | **NIE** |
| **A2** | `implementer-server` | 4 pliki `actions.ts` | **NIE** |
| **B1** | `test-author` | `apps/b2b-web/tests/` | **NIE** |
| **B2** | `implementer-server` | `*/schema.ts`, 2 pliki `actions.ts` | **NIE** |
| **C1** | `contract-steward` | `supabase/migrations/`, `contracts/requirements.contract.mjs` | **TAK** |
| **C2** | **człowiek** | uruchomienie migracji na żywej bazie | zgoda jawna |
| **C3** | `reviewer` + `rls-security-auditor` | — | — |

Fazy A i B są niezależne od siebie i obie idą RED→GREEN bez dotykania kontraktu.
Faza C nie może wyprzedzić A — uruchomienie migracji bez bramki w kodzie nie jest szkodliwe,
ale zostawia system bez ochrony na wypadek rollbacku indeksu (D4 punkt 2).

Wariant awaryjny, gdyby zgody na migrację nie było: **A i B same w sobie zamykają wektor
eskalacji**. Faza C podnosi gwarancję z „kod sprawdza" do „baza nie pozwala" i dopiero ona
zdejmuje wiersz z P3 planu.

---

## Poza zakresem

- Zmiana `contracts/rbac.contract.mjs`. Macierz jest poprawna; problem jest w wyznaczaniu `own`.
- Usunięcie `@unique` ze `schema.prisma` (wariant „zaktualizować schemat do rzeczywistości"
  z wiersza P3 planu) — odrzucone jawnie w D0/„Kod — `schema.prisma`".
- `NOT NULL` na `email`. Odrzucone już przy `FLD-AVAILABILITY-SPLIT` z uzasadnieniem, które
  nadal obowiązuje: nie da się zbackfillować adresu, a zawężenie typu łamie CRM i wymaga ADR.
  Konsekwencja do zapamiętania: pracownik bez e-maila nie ma ścieżki samoobsługi.
- Powiązanie `audytorzy`/`zespoly_monterskie` z `AuthorizedUser` kluczem obcym zamiast po
  wartości e-maila. To właściwa docelowa naprawa całej klasy problemu i **osobne ADR** — patrz Ryzyka.
- Tworzenie brakujących rekordów `audytorzy`/`zespoly_monterskie` dla kont testowych.
  Równoległy wątek, nie blokuje tego WO.
- Naprawa ewidencji migracji (`schema_migrations` rozjechane z repozytorium). Patrz Ryzyka.
- `UNIQUE` na e-mailu w innych tabelach (`klienci`, `AuthorizedUser` — ta ostatnia
  ma już `@unique` w `schema.prisma`, linia 88; **nie sprawdzono jej na żywej bazie**).
- Polityki RLS. Prisma je omija; granicą jest kod akcji.
- E2E Playwright (przedistniejąco czerwone, P3).

---

## Ryzyka i nieznane

1. **Ewidencja migracji jest niewiarygodna i to jest problem większy niż to WO.**
   `supabase_migrations.schema_migrations` ma 2 wpisy, repozytorium 14 plików,
   `_prisma_migrations` nie istnieje. Nie da się dziś odpowiedzieć na pytanie
   „które migracje są zaaplikowane" inaczej niż odpytując `pg_catalog` per zmiana.
   **To WO naprawia jeden objaw, nie przyczynę.** Ta sama klasa dryfu może dotyczyć
   pozostałych 11 nieodnotowanych plików. **Rekomendacja: osobne WO na audyt
   `prisma migrate diff` całego schematu + dopięcie `--check` do `scripts/verify.sh`.**
   Bez tego następny dryf zostanie znaleziony tak samo przypadkowo jak ten.

2. **`AuthorizedUser.email` deklaruje `@unique` w `schema.prisma` (linia 88), ale nie
   sprawdziłem tego na żywej bazie.** Jeśli tam też go nie ma, `getCurrentActorRole()`
   jest podatne na tę samą klasę błędu — a to jest funkcja wyznaczająca **rolę**,
   czyli warstwa jeszcze niżej niż wszystko, co naprawia to WO. **Do sprawdzenia w Fazie A,
   jednym zapytaniem.** Jeśli brakuje — rozszerzyć to WO, nie zakładać osobnego.

3. **Wiązanie tożsamości po wartości e-maila jest architektonicznie kruche** i to jest
   źródło całego problemu. Zmiana adresu w `AuthorizedUser` bez zmiany w `audytorzy`
   cicho odcina dostęp; ten sam adres w dwóch tabelach wymaga reguły rozstrzygającej
   (`SEC-AUTHZ-B2B-READS` kryterium 10). Klucz obcy rozwiązałby to strukturalnie.
   **Nie rozstrzygam tego sam — wymaga ADR i migracji danych.** Odnotowane jako dług.

4. **Termin uruchomienia migracji jest nieznany** i zależy od decyzji człowieka.
   Trzy migracje bezpieczeństwa z tej sesji już czekają niezaaplikowane.
   Jeżeli kolejka rośnie, wartość Fazy C jest odroczona na nieokreślony czas —
   co jest dokładnie tym argumentem, który stoi za D4 (bramka w kodzie jako warstwa niezależna).

5. **Rozmiar tabel przy uruchomieniu.** Decyzja o braku `CONCURRENTLY` (D2) jest ważna
   dla 3 i 2 wierszy. Gdyby migracja czekała na zgodę na tyle długo, że tabele urosną,
   decyzję trzeba przeliczyć. Warunek unieważnienia ma być zapisany w nagłówku pliku, nie tylko tutaj.

---

## Oszacowanie rozmiaru

| Faza | Pliki | Charakter | Rozmiar |
|---|---|---|---|
| A1 testy | 2–3 nowe pliki w `tests/` | ~10 przypadków × 6 miejsc | **M** |
| A2 kod | 4 pliki `actions.ts`, 6 miejsc | mechaniczne, wzorzec gotowy do skopiowania | **S** |
| B1 testy | 1–2 nowe pliki | ~8 przypadków | **S** |
| B2 kod | 2× `schema.ts` (`.toLowerCase()`), 4 akcje (pre-check) | drobne, jedna pułapka (AC-B5) | **S** |
| C migracja | 1 nowy plik + komentarz w starym + wpis w rejestrze | ~80 linii, głównie uzasadnienie | **S** |

**Łącznie: M.** Ryzyko implementacyjne niskie — wzorzec kodu istnieje w repozytorium,
migracja jest addytywna i idempotentna, stan danych zweryfikowany jako bezkolizyjny.
Ryzyko **regresji** skupione w jednym punkcie: AC-B5 (edycja bez zmiany e-maila).
Główna niewiadoma leży poza tym WO i jest opisana w Ryzyku 1.
