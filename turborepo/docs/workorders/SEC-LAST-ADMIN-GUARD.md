# WO: SEC-LAST-ADMIN-GUARD — ochrona ostatniego admina na ścieżce usunięcia konta

Status: gotowy do fazy RED, **z jednym punktem WYMAGAJĄCYM DECYZJI CZŁOWIEKA przed RED** (constraint/trigger bazodanowy — patrz sekcja poniżej). Wymaganie zarejestrowane w `contracts/requirements.contract.mjs:445` (`status: 'TODO'`, `domain: 'security'`, `risk: 'HIGH'`), commit `d5b89e3`. Data WO: 2026-09-07.

## Wymagania

- `SEC-LAST-ADMIN-GUARD` (`contracts/requirements.contract.mjs:445-459`) — przedmiot tego WO, AC1-AC6 przeniesione i rozwinięte poniżej.
- Sąsiaduje z `SEC-AUDIT-LOG-ROLE-CHANGE` (`:364-459`, `status: TODO`) — źródło wzorca `LastAdminError` i transakcji `Serializable`, już zaimplementowane w `updateAuthorizedUserRoleAction` (patrz commit `301edb8` i wcześniejsze `5c56bf2`, `1ddbb92`, `15df270` — Fale A/B `SEC-AUDIT-LOG-MANUAL-STATUS` już scommitowane, ten WO jest kolejnym, niezależnym zadaniem na tej samej rodzinie plików).
- Sąsiaduje z `SEC-AUDIT-LOG-DELETE` (`:331` — wzorzec zapisu `audit_log` przy usunięciu, siedem punktów zapisu, `deleteAuthorizedUser` jest siódmym).
- **Nie jest** dziecko-rodzic żadnego z powyższych w rejestrze — to osobne, samodzielne ID, celowo (patrz komentarz `requirements.contract.mjs:361-363`: „Nie zwijać tych dwóch w jedno ID”).

## Kontekst kodu (zweryfikowane 2026-09-07, odczyt z repozytorium)

### Istnieje

- `apps/b2b-web/src/app/(dashboard)/settings/actions.ts`:
  - `deleteAuthorizedUser(id, input)` (`:205-264`) — bramka RBAC (`can(actorRole, 'authorized_users', 'delete')`), tożsamość wywołującego z sesji, walidacja `deleteJustificationSchema`, następnie **jedna** `prisma.$transaction` (bez opcji izolacji) zawierająca `tx.authorizedUser.delete({ where: { id } })` i `tx.auditLog.create(...)`, w tej kolejności. **Nie ma żadnego `findUnique` przed `delete`** — w przeciwieństwie do ścieżki roli.
  - `updateAuthorizedUserRoleAction(id, input)` (`:286-370`) — **wzorzec do skopiowania 1:1**. Kolejność wewnątrz `$transaction({ isolationLevel: 'Serializable' })` (`:322-357`): `tx.authorizedUser.findUnique({ where: { id } })` → early return gdy `!target` → early return no-op gdy rola się nie zmienia → `if (target.role === 'admin') { const adminCount = await tx.authorizedUser.count({ where: { role: 'admin' } }); if (adminCount <= 1) throw new LastAdminError(...) }` → `tx.authorizedUser.update` → `tx.auditLog.create`. Sentinel `class LastAdminError extends Error {}` (`:274`) zdefiniowany w tym samym pliku, złapany **wyłącznie** w zewnętrznym `catch` tej samej akcji (`:363-366`), nigdy nie ucieka jako 500.
- `contracts/rbac.contract.mjs:40` — `authorized_users.delete = ['admin']`. Bez zmian, nie dotyczy tego WO.
- Testy istniejące jako wzorzec dowodowy dla współbieżności/transakcji: `apps/b2b-web/tests/sec-audit-log-role-change.test.ts:414-514` (bloki AC7/AC8/AC17 — `LastAdminError` na mocku, dowód pośredni współbieżności: `count` liczone WEWNĄTRZ callbacku `$transaction`, nie przed jego wywołaniem) oraz `apps/b2b-web/tests/sec-audit-log-delete-wave-a.test.ts:416-444` (wzorzec testu współbieżności na `deleteAuthorizedUser`/analogicznych: dwa równoległe wywołania na tym samym `id`, jeden sukces + wpis, drugi odmowa + brak wpisu — ten sam kształt testu trzeba odtworzyć dla dwóch **różnych** `id` obu admin).
- `apps/b2b-web/tests/settings-authorized-users.test.ts:278-288` — dowodzi, że dla wywołania bez uprawnień `deleteAuthorizedUser` **nigdy nie odpytuje bazy** (`findUnique`/`delete` nie są wołane) — ta gwarancja musi przetrwać dołożenie inwariantu, bo bramka RBAC nadal wykonuje się przed jakimkolwiek zapytaniem.

### Brakuje

- **Żadna ochrona ostatniego admina na ścieżce `delete`.** Zero trafień na `LastAdminError`, `adminCount`, `count({ where: { role: 'admin' } })` w kontekście `deleteAuthorizedUser`. Usunięcie jedynego konta `admin` dziś przechodzi bez przeszkód — po operacji `authorized_users` może zawierać zero kont `admin`, co blokuje dostęp do `/settings` (`authorized_users.read = ['admin']`) i wymaga ręcznego `INSERT`/`UPDATE` na bazie do naprawy.
- **Odczyt roli usuwanego konta przed usunięciem.** `deleteAuthorizedUser` nie wykonuje dziś żadnego `findUnique` — decyzja „czy to jest admin” nie ma z czego czytać. Dołożenie inwariantu **wymaga** dodania odczytu (patrz „Wzorzec do skopiowania”, punkt 1) — to nie jest opcjonalna refaktoryzacja, to warunek wstępny AC1/AC3.
- Test statyczny/behawioralny wiążący `deleteAuthorizedUser` z `LastAdminError` (albo analogicznym sentinelem) — nie istnieje.

## Zmiana kontraktu

**NIEWYMAGANA dla warstwy Server Action.** Macierz RBAC (`authorized_users.delete = ['admin']`) i schemat wejścia (`deleteJustificationSchema`) zostają bez zmian — inwariant jest logiką wewnątrz akcji, nie nowym zasobem czy zdolnością.

**WARUNKOWO WYMAGANA dla warstwy bazodanowej** — wyłącznie jeśli człowiek zdecyduje o constraint/trigger Postgres (patrz „WYMAGA DECYZJI” poniżej). W takim przypadku: nowe okno kontraktowe, rola `contract-steward`, migracja w `supabase/migrations/` dodająca trigger `BEFORE DELETE` (albo `CONSTRAINT TRIGGER`) na `authorized_users`, który odrzuca `DELETE` redukujący `COUNT(*) WHERE role = 'admin'` do zera. Ten WO **nie** planuje treści migracji — to zadanie `contract-steward` po decyzji.

## WYMAGA DECYZJI: warstwa Server Action kontra twarda gwarancja bazodanowa

Kontrakt (`requirements.contract.mjs:449-450`) jawnie odkłada tę decyzję do tego WO. Nie rozstrzygam sam — argumenty:

**Za constraint/trigger (druga linia obrony na poziomie Postgresa):**
- `deleteAuthorizedUser` jest dziś **jedynym** punktem zapisu (potwierdzone grepem), ale to samo było prawdą o ścieżce `role_change` przed tym WO — jeden punkt zapisu dziś nie gwarantuje, że będzie jedynym za miesiąc.
- Zgodnie z CLAUDE.md („Prisma omija RLS”) — Prisma **nie** omija natywnych `CHECK`/triggerów samego Postgresa. Ręczny `DELETE FROM authorized_users` z `psql` (operacja poza produktem, którą sama Prisma ani RBAC nie widzą) byłby zatrzymany przez trigger, ale nie przez żadną warstwę Server Action.
- Analogiczne triggery już istnieją w systemie i są zaakceptowanym wzorcem: `audit_log_append_only_trg`, `legal_document_versions_freeze_published_trg` — infrastruktura i wzorzec migracji już są sprawdzone.

**Przeciw (za samą warstwą Server Action, tak jak dziś zaakceptowano dla `role_change`):**
- Wymaga nowego okna kontraktowego + migracji + roli `contract-steward` — koszt czasowy i proceduralny, podczas gdy warstwa Server Action rozwiązuje 100% dzisiejszych, znanych ścieżek zapisu.
- Precedens z `SEC-AUDIT-LOG-ROLE-CHANGE` (D3, `docs/workorders/SEC-AUDIT-LOG-ROLE-CHANGE.md:65-67`) zaakceptował ochronę **wyłącznie** na poziomie Server Action dla ścieżki `role_change`, z jawnym zastrzeżeniem, że jest to „połowiczna ochrona”, nie kompletna. Rozstrzygnięcie inne dla ścieżki `delete` (silniejsza gwarancja) niż dla `role_change` (słabsza) byłoby niespójne bez uzasadnienia — albo obie ścieżki dostają trigger, albo żadna, albo trzeba wypisać, czym `delete` różni się na tyle, że zasługuje na wyższy próg dowodu.
- Trigger na `DELETE ... COUNT(*) WHERE role='admin' = 0` musi poprawnie obsłużyć przypadek usunięcia w ramach transakcji wielowierszowej (np. przyszły bulk-delete) i test na żywym Postgresie — dzisiejsza suita testów **nie ma połączenia z żywą bazą** (ograniczenie odziedziczone po `SEC-AUDIT-LOG-APPEND-ONLY`/`AC16` z `SEC-AUDIT-LOG-ROLE-CHANGE`), więc kryterium akceptacji dla triggera byłoby dowodzone tylko statycznie (nad tekstem migracji), tak jak `audit_log_append_only_trg` dziś.

Rekomendacja analityka (nie decyzja): **na razie tylko warstwa Server Action** (AC1-AC5 poniżej), spójnie z precedensem `role_change`; trigger jako osobne, przyszłe ID (`SEC-LAST-ADMIN-GUARD-DB-TRIGGER` albo rozszerzenie AC tego wymagania w kolejnym oknie kontraktowym), żeby nie blokować tego WO na migracji. Ale to jest właśnie pytanie, które ma paść do człowieka — poniżej.

## Kryteria akceptacji (przeniesione z kontraktu, rozwinięte do poziomu testowalnego)

- [ ] AC1 — **Ostatni admin nie może zostać usunięty.** Wywołanie `deleteAuthorizedUser(id, input)` dla `id` wskazującego jedyne konto o `role = 'admin'` w `authorized_users` zwraca `{ success: false, error: <komunikat domenowy> }`. Konto **nie jest** usunięte (`tx.authorizedUser.delete` nie jest wywołane albo transakcja jest wycofana) i w `audit_log` **nie przybywa** wiersz — operacja się nie wydarzyła, zero skutków ubocznych.
- [ ] AC2 — **Przy ≥2 kontach admin przechodzi normalnie, bez regresji.** Usunięcie jednego z co najmniej dwóch kont `admin` (albo usunięcie konta o innej roli) kończy się `{ success: true }`, `tx.authorizedUser.delete` wywołane raz z poprawnym `id`, `tx.auditLog.create` wywołane raz z `operation: 'delete'`, `resource: 'authorized_users'`, `recordId: id` — identycznie jak dziś. Test dowodzi braku regresji istniejących testów `sec-audit-log-delete-wave-a.test.ts` dotyczących `deleteAuthorizedUser`.
- [ ] AC3 — **Liczenie wewnątrz tej samej transakcji, przed `delete`.** `tx.authorizedUser.count({ where: { role: 'admin' } })` jest wywołane wyłącznie **wewnątrz** callbacku `$transaction` obejmującego też `delete` i `auditLog.create`, i wywołane **przed** `delete` — nie jako odczyt w JS poprzedzający otwarcie transakcji. Test wzorem `sec-audit-log-role-change.test.ts:496-513` (mock na `transactionMock.mockImplementation`, sprawdzenie, że `count` nie było wołane przed wejściem do callbacku).
- [ ] AC4 — **Współbieżność.** Dwa równoległe wywołania `deleteAuthorizedUser` na **dwóch różnych, jedynych** kontach `admin` (scenariusz: system ma dokładnie dwa konta `admin`, każde żądanie usuwa jedno z nich) kończą się **co najwyżej jednym** sukcesem; po zakończeniu obu operacji w `authorized_users` zostaje **co najmniej jedno** konto `admin`. O wyniku rozstrzyga baza (`Serializable`), nie odczyt liczby adminów w JS poprzedzający zapis (pułapka nr 4, CLAUDE.md). Test wzorem `sec-audit-log-delete-wave-a.test.ts:416-444` (dwa równoległe wywołania, `Promise.all`), zaadaptowany na dwa różne `id` obu jedynych admin, nie jedno `id`.
- [ ] AC5 — **Sentinel błędu odróżnialny od innych awarii.** Błąd ochrony ostatniego admina (np. `LastAdminError` albo analogiczny sentinel zdefiniowany w `actions.ts`) jest złapany **wyłącznie** w zewnętrznym `catch` tej samej akcji i zwraca komunikat domenowy (`{ success: false, error: "..." }`), **nie** generyczny `"Wystąpił błąd podczas usuwania konta."` używany dziś dla nieznanych awarii, i nie ucieka jako nieobsłużony wyjątek/500. Test rozróżnia dwa scenariusze w mocku: `LastAdminError` kontra inny błąd rzucony wewnątrz tej samej transakcji (np. błąd zapisu `auditLog.create`) — komunikaty muszą się różnić.
- [ ] AC6 — **Poza zakresem: konta nieistniejące i konta niebędące adminem.** Zachowanie dla `id` nieistniejącego konta oraz dla usunięcia konta o roli innej niż `admin` pozostaje **jak dziś** — ten WO **nie zmienia** kształtu odpowiedzi ani liczby zapytań dla tych dwóch przypadków, poza technicznie nieuniknionym dodaniem `findUnique` przed `delete` (patrz „Wzorzec do skopiowania”, punkt 1). Test dowodzi, że `settings-authorized-users.test.ts:278-288` (odmowa nie ujawnia istnienia konta dla wywołania **bez uprawnień**) pozostaje zielony bez zmian — ten test dotyczy bramki RBAC, wykonywanej przed jakimkolwiek zapytaniem, i inwariant admina go nie dotyka.

## Wzorzec do skopiowania (obowiązujący, bez odchyleń)

Zmiana wyłącznie w `deleteAuthorizedUser` (`apps/b2b-web/src/app/(dashboard)/settings/actions.ts:205-264`). Kolejność kroków 1-3 (bramka RBAC, tożsamość, walidacja Zod) **zostaje bez zmian** (`:210-238`). Zmienia się wyłącznie treść transakcji (`:241-256`):

1. Dodać `tx.authorizedUser.findUnique({ where: { id } })` jako **pierwszy** krok wewnątrz `$transaction` — dokładnie jak `updateAuthorizedUserRoleAction:323`. Gdy `!target`, zachowanie „jak dziś” (AC6) — sprawdzić, czy dzisiejszy generyczny błąd Prisma `P2025` (rekord nie znaleziony przy `delete`) daje ten sam obserwowalny wynik (`{ success: false, error: "Wystąpił błąd..." }`) jak wczesny `return` po `!target`; jeśli tak, wybór formy jest szczegółem implementacyjnym, nie kryterium.
2. Dodać opcję `{ isolationLevel: 'Serializable' }` jako drugi argument `$transaction` — dziś jej nie ma (`:241` w obecnym kodzie), różnica względem ścieżki `role_change`, którą to WO **musi** naprawić, żeby AC4 miało szansę przejść.
3. Wewnątrz callbacku, PRZED `tx.authorizedUser.delete`: `if (target.role === 'admin') { const adminCount = await tx.authorizedUser.count({ where: { role: 'admin' } }); if (adminCount <= 1) throw new LastAdminError(...) }` — literalna kopia `updateAuthorizedUserRoleAction:332-337`. Sentinel `LastAdminError` — reużyć klasę już zdefiniowaną w tym pliku (`:274`), nie tworzyć drugiej o tej samej semantyce.
4. Zewnętrzny `catch` (`:260-263`) dostaje dodatkową gałąź `if (error instanceof LastAdminError) { return { success: false, error: "Nie można usunąć jedynego konta administratora." } }` PRZED istniejącym generycznym `console.error`/`return`, wzorem `updateAuthorizedUserRoleAction:364-366`.
5. `tx.authorizedUser.delete` i `tx.auditLog.create` zostają w niezmienionej kolejności względem siebie (`delete` przed wpisem, jak dziś).

Sygnatura `deleteAuthorizedUser(id: string, input: DeleteJustificationInput)` **nie zmienia się**.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Współbieżność dwóch adminów usuwających się nawzajem** (AC4) — pułapka nr 4 CLAUDE.md, ten sam klasa problemu co AC8 w `SEC-AUDIT-LOG-ROLE-CHANGE`. Prawdziwej współbieżności nie da się odtworzyć na mocku Prismy (ten sam zastrzeżenie co przy `role_change`) — dowód pośredni: `count` wewnątrz callbacku, `Serializable` jako opcja transakcji.
- **Usunięcie konta niebędące adminem nigdy nie liczy adminów** — inwariant sprawdzany wyłącznie gdy `target.role === 'admin'`; test dowodzi, że `tx.authorizedUser.count` nie jest wołane dla usunięcia `monter`/`dyspozytor`/`audytor`, choćby w systemie był akurat jeden admin (nie ma się czego bać — analogiczny test istnieje dla `role_change`, `sec-audit-log-role-change.test.ts:455-466`).
- **Kolejność `findUnique` → `count` → `delete` → `auditLog.create`** wewnątrz jednej transakcji — test na `invocationCallOrder`, wzorem `sec-audit-log-role-change.test.ts:386-397`.
- **Błąd `auditLog.create` po przejściu inwariantu → cała transakcja wycofana, `delete` też nie ma skutku** (rollback transakcji) — analogicznie do `AC1` z `SEC-AUDIT-LOG-DELETE` (`sec-audit-log-delete-wave-a.test.ts:368-378`), zaadaptowane na scenariusz z dwoma+ adminami (inwariant nie blokuje, ale zapis audytu i tak zawodzi).
- **Odmowa dla wywołania bez uprawnień wciąż nie odpytuje bazy** — `settings-authorized-users.test.ts:278-288` musi zostać zielony bez modyfikacji; nowy kod inwariantu jest wewnątrz `$transaction`, do której bramka RBAC nie dopuszcza nieuprawnionego wywołania.
- **Sentinel `LastAdminError` nie ucieka poza akcję** — test wywołuje `deleteAuthorizedUser` ze scenariuszem wyzwalającym `LastAdminError` i sprawdza kształt zwróconego obiektu (`success: false`, konkretny `error`), nie `reject`/wyjątek nieobsłużony na poziomie testu.

## Poza zakresem

- **Twarda gwarancja bazodatowa (constraint/trigger)** — patrz „WYMAGA DECYZJI”. Jeśli człowiek zdecyduje na trigger, to osobne okno kontraktowe + migracja + `contract-steward`, nie część tego WO w obecnym kształcie.
- **Ochrona przy zmianie roli** — już zaimplementowana w `SEC-AUDIT-LOG-ROLE-CHANGE` (`updateAuthorizedUserRoleAction`), ten WO jej nie dotyka i nie duplikuje.
- **Naprawa UI wyświetlania roli, dropdown zmiany roli** — poza tym WO, dotyczy innych wymagań (`SEC-AUDIT-LOG-ROLE-CHANGE` AC12/AC13).
- **`before_snapshot`/kolumny „przed–po” w `audit_log`** — nie istnieją, nie są przedmiotem tego WO.
- **Ochrona ostatniego admina na innych ścieżkach niż `authorized_users.delete`** — np. hipotetyczny bulk-delete, import/eksport kont — nie istnieją dziś w kodzie, nie są modelowane.
- **Powiadomienie/alert do zespołu o próbie usunięcia ostatniego admina** — katalog powiadomień nie przewiduje takiego zdarzenia; dołożenie go jest zmianą kontraktu powiadomień, nie tego WO.

## Ryzyka i nieznane

- **Dodanie `findUnique` przed `delete` zmienia liczbę zapytań do bazy dla ścieżki, która dziś ma jedno zapytanie (`delete`) a będzie miała dwa-trzy (`findUnique` + ewentualny `count` + `delete`).** Jeśli istnieje test statyczny/behawioralny liczący dokładną liczbę zapytań dla `deleteAuthorizedUser` (do zweryfikowania przez `test-author` przy czytaniu `sec-audit-log-delete-wave-a.test.ts` w całości, nie tylko fragmentów odczytanych w tym WO), może wymagać aktualizacji — nie jako `TEST-DEFECT`, ale jako oczekiwana konsekwencja tego WO, analogicznie do tego, jak `role_change` zawsze miało `findUnique`.
- **`Serializable` podnosi liczbę błędów serializacji przy współbieżnych usunięciach** — ta sama uwaga co przy `role_change` (patrz `docs/workorders/SEC-AUDIT-LOG-ROLE-CHANGE.md:152`). Jeśli w fazie GREEN AC4 zacznie migać, to jest podejrzenie o retry/backoff przy konflikcie serializacji, nie „flaky test”.
- **Rozstrzygnięcie „Server Action kontra trigger” dla `delete` powinno być spójne z już zaakceptowanym rozstrzygnięciem dla `role_change` (D3 w `SEC-AUDIT-LOG-ROLE-CHANGE`), inaczej dwie ścieżki tej samej awarii mają dwa różne poziomy dowodu bez wyjaśnienia dlaczego.** To jest właśnie treść pytania do człowieka.
- **AC5 zależy od tego, że `deleteAuthorizedUser` faktycznie odróżnia dwa rodzaje błędów w `catch`** — dziś jest tam jeden generyczny `catch` (`:260-263`). Rozszerzenie o `instanceof LastAdminError` jest proste, ale test musi dowieść, że gałąź faktycznie się wykonuje, a nie że generyczny fallback przypadkiem zwraca podobny tekst.

Kolejność ról: człowiek (decyzja Server Action vs trigger) → `test-author` (RED, AC1-AC6) → `implementer-server` → `reviewer`. Jeśli decyzja wybierze trigger jako dodatkowe AC, wraca do `contract-steward` PRZED RED tej dodatkowej części.
