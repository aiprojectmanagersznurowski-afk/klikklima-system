# WO: SEC-RLS-AUDITOR-SCOPE — Audytor widzi wyłącznie leady przypisane do siebie

## Wymagania: SEC-RLS-AUDITOR-SCOPE (status `TODO`, risk `HIGH`, domain `security`)

Treść z rejestru (`contracts/requirements.contract.mjs:91`):
- `statement`: „Audytor widzi wyłącznie zlecenia przypisane do siebie; dyspozytor widzi wszystko."
- `acceptance[0]`: „Test wykonuje realne zapytanie jako audytor i sprawdza brak cudzych rekordów"
- `acceptance[1]`: „Test próbuje eskalacji przez bezpośrednie zapytanie supabase-js"
- `source`: `b2b_app_requirements.md#epic-5` → linia 139: „**Row Level Security (RLS):** Zabezpieczenie danych na poziomie bazy danych Supabase – np. Audytor widzi tylko zlecenia przypisane do siebie, a Dyspozytor widzi wszystko."

Powiązane, zamknięte w sesji 2026-08-25/26: `SEC-ASSIGNMENT-POOL-MINIMIZE`, `SEC-LEADS-LIST-MINIMIZE`, `SEC-LEADS-LIST-SCALARS` — ich pole `source` powołuje się na to wymaganie jako uzasadnienie obniżonego ryzyka. Patrz sekcja „Ryzyka" — ta przesłanka jest dziś nieprawdziwa.

## Kontekst kodu

### Istnieje
- `apps/b2b-web/src/app/(dashboard)/leads/actions.ts:256` — `getLeads()`. Buduje `where` wyłącznie z filtra statusu/bucketu (linie 268–285). Ma domknięty `select` (SEC-LEADS-LIST-MINIMIZE/SCALARS, linie 303–318) i jawny reshape (345–358). **Nie wywołuje `getCurrentActorRole()` ani `can()` — ani razu.**
- `apps/b2b-web/src/app/(dashboard)/leads/page.tsx` — czyta `getCurrentActorRole()`, ale wyłącznie po to, żeby przekazać rolę do `LeadsClient` (ukrywanie przycisków). Nie warunkuje odczytu.
- `apps/b2b-web/src/app/(dashboard)/leads/[id]/page.tsx:53` — `prisma.leady.findUnique({ where: { id }, include: { klient: true, adres: true } })` **bez żadnej bramki roli i bez sprawdzenia właścicielstwa**. Pełny rekord klienta i adresu.
- `apps/b2b-web/src/app/(dashboard)/logistics/actions.ts` — `getLogisticsLeads()` czyta tę samą tabelę `leady`, też bez bramki odczytu.
- `packages/contracts/src/generated/rbac.ts:70` — `can(role, resource, capability): 'no' | 'yes' | 'own'`. Wariant `'own'` **istnieje w sygnaturze i jest zwracany**, ale nie niesie żadnej informacji, PO CZYM filtrować — to wyłącznie etykieta.
- `contracts/rbac.contract.mjs:30` — `leads.read = ['admin', 'dyspozytor', 'audytor:own']`. Semantyka wymagana przez statement JEST już w kontrakcie.
- Mapowanie „e-mail z sesji → konkretny audytor" istnieje w schemacie: `audytorzy.email String? @unique` (`packages/database/prisma/schema.prisma:402`) oraz `leady.audytor_id` + relacja `audytor` (`schema.prisma:90-91`).
- Wzorzec rozwiązania „kto to jest" jest już użyty dwukrotnie: `auditors/actions.ts:121` i `crews/actions.ts:111` — `prisma.audytorzy.findUnique({ where: { email: user.email } })`.
- `supabase/migrations/20260824185845_security_enable_rls_baseline.sql:148-150` — `leady` ma RLS włączone, a jedyna polityka to `"Allow anon insert on leady"` (INSERT). **Brak polityki SELECT ⇒ odczyt przez `supabase-js` jest dziś odmawiany deny-by-default dla każdej roli.**
- `apps/b2b-web/src/utils/supabase/middleware.ts:87-107` — jawna gałąź `if (authorizedUser.role === 'audytor')` (blokada konta `is_active = false`). Ten kod istnieje, więc konta z rolą `audytor` w `AuthorizedUser` są przewidziane i mogą już być w bazie.
- `middleware.ts:110-113` — po zalogowaniu **każdy** authorized user jest przekierowany na `/leads`.

### Brakuje
- Jakiegokolwiek sprawdzenia `can(actorRole, 'leads', 'read')` w ścieżce odczytu. W całym panelu `can(..., 'read')` występuje **dokładnie raz**: `settings/page.tsx:16` (`authorized_users`). Wszystkie pozostałe 20 widoków `(dashboard)/**/page.tsx` czytają bez bramki.
- Filtra własności — nigdzie w `apps/b2b-web` nie ma `where` z `audytor_id` ograniczającym do zalogowanego użytkownika.
- Helpera zwracającego **tożsamość** aktora, nie tylko rolę. `getCurrentActorRole()` (`utils/supabase/server.ts:42`) zwraca `Role | null` i to jedyne wejście do autoryzacji. Bez `auditorId` nie da się zbudować `where: { audytor_id: … }`.
- Filtrowania nawigacji po roli — `layout.tsx:22` `navItems` jest statyczne, brak jakiegokolwiek warunku roli. Audytor widzi w menu wszystkie moduły.

### Czy luka jest realna czy teoretyczna — rozstrzygnięcie
**Realna, ale dziś prawdopodobnie nieaktywowana.** Argumenty po obu stronach, oba sprawdzone w kodzie:

- Za „teoretyczna": jedyna ścieżka UI tworzenia kont (`settings/SettingsClient.tsx:153-155`) ma `<select disabled>` z jedyną opcją „Administrator", a wywołanie w linii 31 to `addAuthorizedUser(email, "admin")` — na sztywno. Żadne konto z rolą `audytor` nie powstanie przez interfejs.
- Za „realna": (1) `addAuthorizedUser(email, role)` to Server Action przyjmująca **dowolną** wartość z `ROLES` (`settings/actions.ts:17, 28`) — sztywna wartość jest w kliencie, nie w kontrakcie akcji; (2) middleware ma dedykowaną gałąź dla roli `audytor`, co jest martwym kodem, jeśli takich kont nigdy nie ma; (3) w razie pojawienia się takiego konta **nic** go nie zatrzymuje — trafia po zalogowaniu prosto na `/leads` i widzi komplet leadów wszystkich audytorów; (4) Field App nie istnieje w repo (`apps/` = `b2b-web`, `b2c-web`), więc teza „audytor pracuje w osobnej aplikacji, panel go nie dotyczy" nie ma dziś oparcia w kodzie — dziś jedyną aplikacją, do której audytor może się zalogować, jest panel B2B.

**Wniosek dla oceny ryzyka:** ryzyko `HIGH` zostaje, ale jego aktywacja jest warunkowa: luka jest eksploatowalna wtedy i tylko wtedy, gdy w produkcyjnej tabeli `AuthorizedUser` istnieje choć jeden wiersz z rolą inną niż `admin`. To pytanie do człowieka (patrz D6) — repo na nie nie odpowiada.

### Luka szersza niż statement (do wiadomości, poza zakresem)
Brak bramki `read` nie dotyczy tylko audytora. `monter` **nie ma** `leads.read` w macierzy w ogóle, a dziś widzi całą listę leadów i kartę szczegółów. Analogicznie `auditors.read = ['admin','dyspozytor']`, a `getAuditors()` (`leads/actions.ts:78`) nie sprawdza roli. To osobny dług — patrz „Poza zakresem".

## Zmiana kontraktu
**NIEWYMAGANA.**

Uzasadnienie: `leads.read` już zawiera `audytor:own`, a `can()` już zwraca `'own'`. Do naprawy potrzebny jest filtr danych w warstwie serwerowej, nie nowa zdolność w macierzy. Dopisywanie do `rbac.contract.mjs` czegokolwiek (np. kolumny właścicielskiej) byłoby rozszerzeniem modelu kontraktu, którego to wymaganie nie potrzebuje — macierz świadomie nie zna kolumn.

Zastrzeżenie: **nie zmieniaj statusu `SEC-RLS-AUDITOR-SCOPE` na `DONE`, dopóki nie zamknięto D1** (zakres widoczności leadów nieprzypisanych) — inaczej „DONE" udokumentuje przypadkowy wybór implementera jako decyzję biznesową.

## Kryteria akceptacji (wykonalne)

- [ ] **AC1** — Audytor otwierający `/leads` dostaje na liście wyłącznie leady, w których `audytor_id` wskazuje na jego własny rekord w `audytorzy` (dopasowanie po e-mailu z sesji). Lead przypisany do innego audytora nie pojawia się w wyniku ani w `totalPages`.
- [ ] **AC2** — Dyspozytor i admin na `/leads` widzą komplet leadów, identycznie jak dziś. Test regresyjny: dla tych ról zbiór zwróconych `id` przed zmianą i po zmianie jest identyczny.
- [ ] **AC3** — Liczniki `stageCounts` i paginacja (`totalCount`) widziane przez audytora liczą **tylko** jego leady. Licznik „NEW_LEAD: 47", gdy audytor ma dostęp do trzech rekordów, jest wyciekiem informacji o wolumenie i musi być traktowany jak naruszenie AC1. (Uwaga dla implementera: `groupBy` w `getLeads()` linia 321 nie przyjmuje dziś `where` — to osobne miejsce do poprawy niż `findMany`.)
- [ ] **AC4** — Audytor wchodzący bezpośrednio pod URL `/leads/<id>` cudzego leada nie zobaczy treści: dostaje `notFound()` albo jawną odmowę. Kluczowe: **odpowiedź jest nieodróżnialna od nieistniejącego id**, żeby nie potwierdzać istnienia rekordu.
- [ ] **AC5** — Audytor otwierający własny lead pod `/leads/<id>` widzi go bez zmian względem dzisiejszego zachowania.
- [ ] **AC6** — Rola bez `leads.read` w macierzy (`monter`) nie otrzymuje żadnych leadów z `getLeads()` ani z karty szczegółów. Zachowanie: odmowa, nie cicha pusta lista (patrz D2, jeśli decyzja padnie inaczej — AC do korekty).
- [ ] **AC7** — Użytkownik zalogowany, którego e-maila nie ma w `audytorzy` (albo `audytorzy.email IS NULL`), a którego rola to `audytor`, **nie** dostaje wszystkich leadów. Zachowanie fail-closed: pusty wynik/odmowa, nigdy `where` bez warunku. To najgroźniejszy przypadek: `audytorzy.email` jest nullowalny, więc „nie znaleziono rekordu" jest realnym stanem produkcyjnym.
- [ ] **AC8** — Bezpośrednie zapytanie `supabase-js` (klucz `anon`, sesja audytora) `from('leady').select('*')` nie zwraca żadnych wierszy. Test ma zamrozić dzisiejszy stan deny-by-default z migracji `20260824185845`, tak żeby przyszłe dodanie permisywnej polityki SELECT na `leady` wywaliło bramkę.
- [ ] **AC9** — Test ma dowieść **argumentu przekazanego do `findMany`**, a nie tylko kształtu wyniku. Przy mockowanej Prismie mock zwraca to, co mu wpisano, niezależnie od `where` — więc asercja „wynik nie zawiera cudzych leadów" niczego nie dowodzi. Wymagane dwie asercje: (a) `where` przekazane do `prisma.leady.findMany` zawiera warunek własności dla roli `audytor`, (b) nie zawiera go dla `admin`/`dyspozytor`.
- [ ] **AC10** — `/logistics` (`getLogisticsLeads()`, ta sama tabela `leady`) podlega tej samej regule co `/leads`, albo jest jawnie zamknięte dla roli `audytor`. Zostawienie tego widoku otwartego czyni AC1 fikcją — to obejście jednym kliknięciem w menu (patrz D4).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Lead bez audytora (`audytor_id IS NULL`, typowo status `NEW_LEAD`).** Prisma `where: { audytor_id: X }` odrzuca `NULL` — więc domyślnie audytor go nie zobaczy. To skutek uboczny implementacji, a nie decyzja: patrz D1.
- **Brak rekordu w `audytorzy` dla zalogowanego e-maila** oraz `email IS NULL` w `audytorzy` — musi skończyć się odmową, nie `where: undefined`. Klasyczny błąd: `where: { audytor_id: auditorId }` z `auditorId === undefined` w Prisma **ignoruje warunek** i zwraca wszystko. Test na to jest obowiązkowy.
- **Konto audytora z `is_active = false`** — middleware wylogowuje je (`middleware.ts:87-107`), ale Server Action może zostać wywołana bez przejścia przez middleware. Sprawdzenie w akcji nie może zakładać, że middleware już zadziałał.
- **Przepięcie leada na innego audytora** — poprzedni audytor traci widoczność natychmiast przy następnym odczycie (konsekwencja D3).
- **Rola spoza `ROLES` w `AuthorizedUser`** — `getCurrentActorRole()` zwraca wtedy `null` (`server.ts:57-59`); ścieżka odczytu musi to potraktować jako odmowę, nie jako „brak filtra".
- **Paginacja przy filtrze własności** — `skip`/`take` liczone na przefiltrowanym zbiorze; strona 2 dla audytora z 3 leadami ma być pusta, nie ma „przeciekać" na cudze rekordy.
- **Idempotencja/spójność licznika** — `stageCounts["ALL"]` (linia 337–338) jest sumą po `groupBy`; po zawężeniu musi zgadzać się z `totalCount`.

## Poza zakresem

- **Polityki RLS SELECT na `leady` w Postgresie.** Panel B2B chodzi po Prismie, która RLS omija — dodanie polityki niczego tu nie naprawi, a odczyt przez `supabase-js` jest już domyślnie odmawiany. Naprawa należy do warstwy Server Action.
- **Zakres `monter:own` dla `installations` / `services` / `incidents`.** Statement mówi o audytorze i leadach. Analogiczna dziura istnieje (`getInstallations`, `getIncidents`, `getUpcomingServices` — zero bramek), ale wymaga własnego ID w rejestrze i własnego WO.
- **Systemowy brak bramki `read` we wszystkich widokach CRM** (`customers`, `auditors`, `crews`, `notifications`, `shop`) — patrz D5. To większy dług niż to wymaganie; nie doklejaj go tutaj, bo zje limit iteracji GREEN.
- **Filtrowanie `navItems` po roli w `layout.tsx`.** Ukrycie linku nie jest kontrolą dostępu; naprawa serwerowa jest warunkiem koniecznym, UI to osobna, późniejsza kosmetyka.
- **Twardnienie `addAuthorizedUser`** (sztywne `"admin"` w kliencie, dowolna rola w akcji) — dotyczy `SEC-AUTHZ-USER-MGMT`, nie tego wymagania.
- **Field App.** Nie istnieje w repo; żadne AC nie może się na niego powoływać.

## Ryzyka i nieznane

1. **Przesłanka trzech zamkniętych wymagań jest dziś nieprawdziwa.** `SEC-ASSIGNMENT-POOL-MINIMIZE`, `SEC-LEADS-LIST-MINIMIZE` i `SEC-LEADS-LIST-SCALARS` uzasadniają obniżone ryzyko zdaniem „dostęp jest już poprawnie ograniczony rolą i zakresem audytora". Weryfikacja: **ani rolą, ani zakresem** — `getLeads()`, `getAuditors()` i `getCrews()` nie wywołują `can()` dla `read` ani razu. Sama praca (zawężenie kolumn) była słuszna i nie wymaga cofnięcia; unieważniony jest wyłącznie argument „i tak widzi to tylko dyspozytor". Po zamknięciu tego WO warto poprawić te uzasadnienia w rejestrze (rola `contract-steward`).
2. `can()` nie potrafi powiedzieć, PO CZYM filtrować — zwraca `'own'` i nic więcej. Każda implementacja `:own` będzie więc miała mapowanie „zasób → kolumna właścicielska" zaszyte w kodzie akcji. To trzecie takie miejsce w repo (po `auditors/actions.ts` i `crews/actions.ts`) i pierwsze dotyczące **odczytu**. Jeżeli ma powstać wspólny helper (`getCurrentActor()` zwracające `{ role, auditorId, crewId }`), to jest właściwy moment — inaczej wzorzec rozejdzie się na cztery kopie.
3. Nie wiadomo, czy w produkcyjnym `AuthorizedUser` istnieją konta o roli innej niż `admin`. Od tego zależy, czy to incydent bezpieczeństwa, czy dług prewencyjny.

---

## WYMAGA DECYZJI

- **D1 — Czy audytor widzi leady nieprzypisane do nikogo (`audytor_id IS NULL`, typowo `NEW_LEAD`)?** Dokument mówi „widzi tylko zlecenia przypisane do siebie", co sugeruje NIE, ale nie wypowiada się o puli nieprzypisanej. Konsekwencja praktyczna: jeżeli NIE, audytor po wejściu na `/leads` zobaczy **pustą stronę** (domyślny filtr strony to `status = "NEW_LEAD"`, `leads/page.tsx`), co wygląda jak awaria. Jeżeli TAK — audytor widzi cały napływ leadów, w tym dane kontaktowe klientów, których nigdy nie będzie obsługiwał. Nie wybieram.
- **D2 — Rola `monter` na `/leads`: odmowa czy pusta lista?** Macierz nie daje mu `leads.read` w żadnym wariancie, więc obie opcje są zgodne z kontraktem; różnią się tym, co widzi użytkownik.
- **D3 — Czy audytor traci dostęp do leada po przepięciu na innego audytora?** Filtr po bieżącym `audytor_id` odbiera dostęp natychmiast, także do leadów, które ten audytor faktycznie obsłużył. Brak w schemacie historii przypisań, więc „widzi to, co kiedykolwiek audytował" nie jest dziś w ogóle wykonalne bez zmiany modelu danych.
- **D4 — Czy audytor ma dostęp do widoku `/logistics`?** Dziś ma pełny, a widok czyta tę samą tabelę `leady`. W `RESOURCES` nie ma zasobu „logistics" — akcje tego modułu autoryzują się przez `leads.update`. Bez rozstrzygnięcia AC1 jest fikcją.
- **D5 — Czy rejestrujemy osobne wymaganie na systemowy brak bramki `read` w panelu B2B?** Stan faktyczny: na 21 plików `page.tsx` pod `(dashboard)` dokładnie jeden (`settings/page.tsx`) sprawdza uprawnienie do odczytu. To jest większa dziura niż `audytor:own` i doklejenie jej tutaj rozwali zakres.
- **D6 — Czy w produkcyjnym `AuthorizedUser` istnieją dziś wiersze z rolą inną niż `admin`?** Odpowiedź decyduje, czy to incydent (natychmiastowa naprawa) czy dług prewencyjny (normalna kolejka). Repo tego nie rozstrzyga.
