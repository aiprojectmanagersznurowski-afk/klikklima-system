# WO: SEC-AUDIT-LOG-ROLE-CHANGE — zmiana roli istniejącego konta z wpisem audytowym

Status: gotowy do fazy kontraktowej, **z trzema punktami decyzyjnymi do potwierdzenia przez człowieka przed fazą RED** (sekcja „Punkty decyzyjne”). Data: 2026-09-04.
Część 2 z 4 rozbicia `SEC-AUDIT-LOG` (część 1 — `SEC-AUDIT-LOG-DELETE` — wykonana i scommitowana; pozostają: MANUAL-STATUS, NOTIFICATION-RESEND/CONTRACT-OVERRIDE).

**To NIE jest dopisanie audytu do istniejącej akcji.** W panelu B2B nie istnieje dziś żadna ścieżka zmiany roli istniejącego konta — trzeba zbudować całą operację (bramka, walidacja, transakcja, wpis, UI), a audyt jest jej częścią od pierwszej linii, nie doklejką.

## Wymagania

- `SEC-AUDIT-LOG` (rodzic, `TODO`, HIGH) — `contracts/requirements.contract.mjs:319`. **Zostaje `TODO`** do czasu zarejestrowania wszystkich czterech dzieci.
- Nowe dziecko do zarejestrowania: **`SEC-AUDIT-LOG-ROLE-CHANGE`** (patrz „Zmiana kontraktu”).
- Sąsiaduje z: `SEC-AUDIT-LOG-DELETE` (`requirements.contract.mjs:331` — wzorzec zapisu, schemat, dialog, testy statyczne), `SEC-AUTHZ-USER-MGMT` (`:209` — bramka roli i słownik `ROLES`; to wymaganie **wprost obejmuje** „przypisanie roli”, ale jego testy świadomie odroczyły kryterium `role_change`), `SEC-AUDIT-LOG-APPEND-ONLY` (`:181` — nienaruszalność wpisu).

## Kontekst kodu (zweryfikowane 2026-09-04, odczyt z repozytorium, nie z podsumowania)

### Istnieje

- `apps/b2b-web/src/app/(dashboard)/settings/actions.ts` — trzy akcje na `authorized_users`: `addAuthorizedUser(email, role)` (`:18`), `deleteAuthorizedUser(id, input)` (`:204`, już z audytem, wzorzec do skopiowania 1:1) oraz akcje dokumentów prawnych (bez związku).
- `apps/b2b-web/src/app/(dashboard)/settings/page.tsx` — Server Component, bramka `can(actorRole, 'authorized_users', 'read')`, `prisma.authorizedUser.findMany` zwraca **pełny obiekt razem z `role`** i przekazuje do `SettingsClient`.
- Macierz RBAC: `contracts/rbac.contract.mjs:40` — `{ resource: 'authorized_users', read: ['admin'], create: ['admin'], update: ['admin'], delete: ['admin'] }`. **Zdolność `update` istnieje i należy wyłącznie do `admin`.** Nowa akcja nie wymaga zmiany macierzy.
- `AUDIT_REQUIREMENTS` (`rbac.contract.mjs:114-121`): `mustLog` zawiera `'role_change'`; `requiresJustification: true` **globalnie, bez wariantu per operacja**; `legalBases` — pięć wartości; `status: 'STABLE'`.
- Baza (migracja `20260901220000`, ZASTOSOWANA — potwierdzone przy `SEC-AUDIT-LOG-DELETE`): `audit_log_operation_check` **dopuszcza `'role_change'`**, `audit_log_resource_check` dopuszcza `'authorized_users'`, `legal_basis` i `justification` są `NOT NULL`, `audit_log_justification_min_length` wymaga ≥10 znaków po `btrim`, wyzwalacz `audit_log_append_only_trg` działa.
- Schemat współdzielony: `apps/b2b-web/src/lib/audit/delete-justification-schema.ts` — `justification: z.string().trim().min(10)`, `legalBasis: z.enum(AUDIT_REQUIREMENTS.legalBases)`, plus alias `DeleteActionResult`.
- Dialog: `apps/b2b-web/src/components/delete-justification-dialog.tsx` — `react-hook-form` + `zodResolver`, `mode: "onChange"`, brak preselekcji `legalBasis`, parametryzowany (`title`, `description`, `confirmLabel`, `pendingLabel`).
- `getCurrentUser()` i `getCurrentActorRole()` w `apps/b2b-web/src/utils/supabase/server.ts:42,56` — oba `cache()`, oba już importowane przez `settings/actions.ts`.
- `AuthorizedUser` (`packages/database/prisma/schema.prisma:86-92`): `id` = `cuid()`, `email` `@unique`, `role String @default("admin")`, `updatedAt`. **Brak jakiejkolwiek relacji z innych modeli** — zmiana roli nie kaskaduje.

### Brakuje (potwierdzone: `grep` na `authorizedUser.update|upsert` w `apps/` i `packages/` — zero trafień poza generowanym klientem Prismy)

- **Nie istnieje żadna akcja, endpoint, skrypt ani surowy SQL zmieniający `authorized_users.role`.** Rola jest przypisywana wyłącznie przy tworzeniu konta i po tym jest niezmienna z poziomu produktu. Zmiana wymaga dziś ręcznego `UPDATE` na bazie — czyli operacji całkowicie poza audytem.
- **UI nie pokazuje prawdziwej roli.** `SettingsClient.tsx:98-102` renderuje stały `Badge` z napisem „Administrator” dla **każdego** wiersza, ignorując `user.role`, mimo że pole jest przekazywane z `page.tsx`. Analogicznie `SettingsClient.tsx:34` wysyła zahardkodowane `"admin"` do `addAuthorizedUser`, a `:154` pokazuje wyłączony `<select>` z jedną opcją. Dropdown zmiany roli nad ekranem, który kłamie o roli bieżącej, byłby pułapką — naprawa wyświetlania jest **warunkiem wstępnym**, nie kosmetyką.
- Brak ochrony „ostatniego admina” w jakiejkolwiek warstwie: zero trafień w `apps/`, `packages/`, `supabase/migrations/`. Jedyne wystąpienie frazy to komentarz odraczający w `apps/b2b-web/tests/settings-authorized-users.test.ts:55`.
- `apps/b2b-web/tests/settings-authorized-users.test.ts:52-53` — potwierdzone, komentarz nadal tam jest: „Kryterium »audit_log / role_change« […] świadomie pominięte, pokrywa je SEC-AUDIT-LOG, osobny wymóg”. **Ten WO zamyka ten dług.**

### Ograniczenie narzucone przez istniejące testy statyczne (przeczytać przed pisaniem czegokolwiek)

`apps/b2b-web/tests/sec-audit-log-delete-static.test.ts:253` wymusza: **co najwyżej jeden plik w `apps/b2b-web/src`** (poza `customers/anonymize-client-schema.ts`) zawiera wyrażenie `z.string().trim().min(10)`. Utworzenie drugiego, samodzielnego schematu Zod dla zmiany roli **złamie zielony test cudzego wymagania**. Obowiązkowe rozwiązanie: rozszerzenie istniejącego schematu przez `.extend()`, nie jego kopia (patrz „Wzorzec zapisu”).

Ten sam plik (`:230`) zabrania powielania pełnego słownika `legalBases` jako literałów — `<select>` w nowym dialogu musi iterować po `AUDIT_REQUIREMENTS.legalBases`.

## Zmiana kontraktu

**WYMAGANA — jeden krok, wąski. Musi wydarzyć się PRZED fazą RED, w osobnym oknie kontraktowym z rolą `contract-steward`.**

1. **Rejestracja `SEC-AUDIT-LOG-ROLE-CHANGE`** jako dziecka `SEC-AUDIT-LOG`, dokładnie wzorem wpisu `SEC-AUDIT-LOG-DELETE` (`requirements.contract.mjs:331`): `status: 'TODO'`, `domain: 'security'`, `risk: 'HIGH'`. Bez tego `kk-trace` nie ma czego liczyć, a testy nie mają czym się otagować.
   - `source` musi odnotować: ścieżkę `apps/b2b-web/src/app/(dashboard)/settings/actions.ts` (jedyny punkt zapisu), ten WO, fakt że macierz RBAC **już** ma `authorized_users.update = ['admin']` (bez zmian), fakt że `audit_log_operation_check` **już** dopuszcza `'role_change'` (bez migracji) oraz że dziś nie istnieje żadna ścieżka zmiany roli — wymaganie tworzy funkcjonalność, a nie tylko audytuje istniejącą.
   - `acceptance`: sekcja „Kryteria akceptacji” poniżej, przepisana jeden do jednego, po rozstrzygnięciu punktów decyzyjnych.
2. **`AUDIT_REQUIREMENTS` — BEZ ZMIAN** (rekomendacja, punkt decyzyjny D1). `legalBases` zostaje pięcioelementowe; rozszerzenie pociągnęłoby migrację CHECK-a `audit_log_legal_basis_check`.
3. **Macierz RBAC — BEZ ZMIAN.** `update` dla `authorized_users` jest już `['admin']`.
4. **Schemat Prismy i migracje — ŻADNE.** Tabela, CHECK-i i wyzwalacz są na bazie; `operation = 'role_change'` przechodzi.

## Punkty decyzyjne (do potwierdzenia przez człowieka przed RED)

Żaden z nich nie wynika ze sprzeczności dokumentów — dokumenty po prostu milczą. Rekomendacje są podane, ale nie należą do analityka.

**D1 — podstawa prawna dla zmiany roli.** `legal_basis` jest `NOT NULL` w bazie, a słownik jest ukształtowany pod RODO: `RODO_ERASURE_REQUEST`, `OPERATIONAL_ERROR`, `DUPLICATE`, `COURT_ORDER`, `OTHER`. Dla awansu montera na dyspozytora sensowne są realnie dwie wartości (`OPERATIONAL_ERROR` — rola nadana błędnie, `OTHER` — zmiana zakresu obowiązków), pozostałe trzy są bezsensowne, ale dozwolone przez CHECK.
*Rekomendacja:* **nie zawężać listy w formularzu** (zawężenie = druga lista obok kontraktu, wprost zakazane przez test `sec-audit-log-delete-static.test.ts:230`) i **nie rozszerzać słownika** o wartość kadrową w tym WO. Cena: rejestr dopuści `COURT_ORDER` przy awansie. Alternatywa (osobne okno kontraktowe + migracja CHECK-a) jest droższa niż problem.

**D2 — czy wpis ma zawierać starą i nową rolę.** Tabela `audit_log` **nie ma** kolumn na wartość przed/po (`before_snapshot` świadomie nie istnieje — rozstrzygnięcie człowieka z okna `SEC-RODO-DELETE-RECONCILE`). Wpis powie zatem „admin zmienił rolę konta X”, ale nie **na jaką**. Trzy warianty:
   - (a) zaakceptować — informacja o nowej roli jest odczytywalna z bieżącego stanu `authorized_users`, a intencja z `justification`;
   - (b) serwer komponuje `justification` deterministycznym prefiksem, np. `audytor → admin | <tekst operatora>`, dzięki czemu wpis jest samoopisujący się także po kolejnej zmianie roli;
   - (c) dodać kolumny `previous_value` / `new_value` — zmiana schematu + migracja, wykracza poza „bez migracji”.
*Rekomendacja:* **(b)**, z jawnym zastrzeżeniem w AC, że tekst operatora jest zachowany w całości i nienaruszony, a prefiks jest doklejany, nie zastępuje. Wariant (a) sprawia, że po dwóch kolejnych zmianach roli rejestr nie pozwala odtworzyć ścieżki — a to jest dokładnie pytanie, które padnie przy kontroli. Wariant (b) trzeba zatwierdzić świadomie, bo modyfikuje treść pola wypełnianego przez człowieka.

**D3 — ochrona „ostatniego admina”.** WO `SEC-AUDIT-LOG-DELETE` odłożył ją jako „znana luka, osobne ID”. Zmiana roli otwiera **drugą** drogę do tej samej awarii, cichszą od usunięcia: degradacja jedynego admina do `monter` nie kasuje niczego, więc nie wygląda na operację destrukcyjną, a odbiera dostęp do `/settings` (`authorized_users.read = ['admin']`) i tym samym możliwość naprawy z poziomu produktu. Odzyskanie wymaga ręcznego `UPDATE` na bazie — czyli dokładnie operacji poza audytem, którą to wymaganie eliminuje.
*Rekomendacja:* **zamknąć teraz, ale wąsko** — inwariant „w `authorized_users` musi zostać co najmniej jedno konto o roli `admin`” egzekwowany **wyłącznie na ścieżce zmiany roli**, wewnątrz tej samej transakcji, z izolacją `Serializable` (wzorzec `deleteAuditorAction`). Ścieżka `delete` pozostaje niezabezpieczona i **nadal wymaga osobnego ID** (proponowana nazwa: `SEC-LAST-ADMIN-GUARD`), tak samo jak twarda gwarancja na poziomie bazy. Połowiczna ochrona jest tu lepsza od żadnej, ale musi być **jawnie** opisana jako połowiczna — inaczej ktoś uzna temat za zamknięty.
*Wariant odrzucenia:* jeżeli człowiek woli odłożyć całość do `SEC-LAST-ADMIN-GUARD`, AC7 i AC8 wypadają z tego WO, a w „Poza zakresem” ląduje zdanie o świadomym pozostawieniu drogi do samozablokowania.

## Wzorzec zapisu (obowiązujący, bez odchyleń)

Nowa akcja w `apps/b2b-web/src/app/(dashboard)/settings/actions.ts`, nazwa proponowana `updateAuthorizedUserRoleAction`. Kolejność kroków jest identyczna jak w `deleteAuthorizedUser` (`:204-263`) i nie podlega przestawieniu:

1. `actorRole` z `getCurrentActorRole()` w `try/catch`; wyjątek → odmowa uprawnień (nie błąd zapisu).
2. `can(actorRole, 'authorized_users', 'update') !== 'yes'` → odmowa. **Zero zapytań do bazy przed tym punktem** (bramka `kk-authz-gate` wykrywa `can()` po Prismie).
3. `actorEmail` z `getCurrentUser()`; brak e-maila → odmowa (kolumna `actor_email` jest `NOT NULL`, fail-closed).
4. Walidacja wejścia schematem Zod (niżej); niepowodzenie → odmowa **bez żadnego zapisu**. Nowa rola musi być wartością z `ROLES` — walidacja rozstrzyga o **danych**, niezależnie od uprawnień wywołującego (ten sam podział co w komentarzu `actions.ts:10-17`).
5. Dopiero teraz `prisma.$transaction(async (tx) => { … }, { isolationLevel: 'Serializable' })`, a w nim po kolei: odczyt bieżącego rekordu, sprawdzenie no-op, sprawdzenie inwariantu ostatniego admina (D3), `tx.authorizedUser.update`, `tx.auditLog.create`. Wpis **wewnątrz** tej samej transakcji co `update`, nigdy po niej i nigdy w drugim `$transaction`.

Kształt wpisu:

```
operation:   'role_change'          // literał z AUDIT_REQUIREMENTS.mustLog
resource:    'authorized_users'     // literał z RESOURCES
recordId:    id                     // cuid() konta, którego rola się zmienia
actorEmail:  <z sesji, nigdy z parametru akcji>
actorRole:   <z getCurrentActorRole(), rola W CHWILI operacji>
justification, legalBasis           // z wejścia (kształt wg D2)
```

Schemat wejścia — **rozszerzenie istniejącego pliku, nie nowy schemat**. Proponowany plik `apps/b2b-web/src/lib/audit/role-change-schema.ts`:

```
import { deleteJustificationSchema } from "./delete-justification-schema";
export const roleChangeSchema = deleteJustificationSchema.extend({
  role: z.enum(ROLES),
});
```

`.extend()` nie powiela wyrażenia `z.string().trim().min(10)`, więc test `sec-audit-log-delete-static.test.ts:253` pozostaje zielony. Kopia schematu jest naruszeniem AC10 tamtego wymagania, a nie tylko brzydkim kodem.
Dopuszczalna alternatywa dla `contract-steward`/`implementer-server`: uogólnić nazwę pliku bazowego na `audit-justification-schema.ts` z aliasem wstecznym — decyzja implementacyjna, ale **jedno źródło progu i słownika musi zostać jedno**.

Sygnatura: `updateAuthorizedUserRoleAction(id: string, input: { role: string; justification: string; legalBasis: string })`. Parametr `input` jest **obowiązkowy** — wartość domyślna albo `input?` przywróciłaby zmianę roli bez śladu.

## Kryteria akceptacji

- [ ] AC1 — **Ścieżka istnieje i jest jedyna.** Zmiana roli istniejącego konta jest możliwa z panelu B2B dokładnie jednym wywołaniem serwerowym. Test statyczny: w `apps/b2b-web/src` nie istnieje drugie miejsce zapisujące `authorizedUser.role` (`update`, `updateMany`, `upsert`, surowy `UPDATE ... SET role`).
- [ ] AC2 — **Transakcyjność.** Gdy zapis do `audit_log` zawiedzie, rola **nie jest zmieniona** (rollback całej transakcji). Nie istnieje ścieżka kodu wywołująca `update` na `authorizedUser` poza transakcją zawierającą `auditLog.create`. Odwrotnie: gdy `update` zawiedzie, w `audit_log` nie przybywa wiersz.
- [ ] AC3 — **Kompletność wpisu.** `operation = 'role_change'`, `resource = 'authorized_users'`, `record_id` = identyfikator konta, którego rola się zmienia (**nie** konta wywołującego), `actor_email` zalogowanego użytkownika (nie `null`, nie stała), `actor_role` **z chwili operacji** — utrwalona wartość z `getCurrentActorRole()`, nie odczyt przez relację. Test przechodzi mimo tego, że `record_id` to `cuid()`, a nie UUID, i mimo braku FK.
- [ ] AC4 — **Bramka roli.** Wywołanie przez `dyspozytor`, `audytor` i `monter` jest odrzucone po stronie serwera; test wywołuje Server Action bezpośrednio, z pominięciem UI. Zero zapytań `update`, zero `auditLog.create`. Decyzję podejmuje `can(actorRole, 'authorized_users', 'update')`, nigdy literał `role === 'admin'` w kodzie akcji.
- [ ] AC5 — **Fail-closed.** Brak sesji, e-mail spoza `authorized_users`, rola nierozpoznana przez `ROLES` oraz **wyjątek samego zapytania o rolę** dają odmowę uprawnień (błąd domenowy w wyniku, nie nieobsłużony reject i nie 500). Sesja bez adresu e-mail daje odmowę **przed jakimkolwiek zapytaniem**.
- [ ] AC6 — **Walidacja wejścia.** Rola spoza `ROLES` (`"superadmin"`, `""`, `"ADMIN"` — wielkość liter ma znaczenie, `null`), `justification` krótsze niż 10 znaków po `trim` oraz `legalBasis` spoza `AUDIT_REQUIREMENTS.legalBases` są odrzucane **bez zapisu i bez wpisu**, także dla wywołującego z rolą `admin`. Słownik ról ma dokładnie jedno źródło: `ROLES` z `@klikklima/contracts`.
- [ ] AC7 — **Ostatni admin nie może się zdegradować** *(zależne od D3)*. Zmiana roli jedynego konta o roli `admin` na cokolwiek innego jest odrzucona błędem domenowym; rola nie zmienia się i wpis audytowy **nie powstaje** (operacja się nie wydarzyła). Przy dwóch kontach `admin` degradacja jednego z nich przechodzi.
- [ ] AC8 — **Ostatni admin pod współbieżnością** *(zależne od D3)*. Dwa równoległe żądania degradujące dwa różne (i jedyne) konta `admin` kończą się dokładnie jednym sukcesem i jednym wpisem — o wyniku rozstrzyga baza (`Serializable` / blokada), nie odczyt poprzedzający zapis w JS. Po obu żądaniach w `authorized_users` pozostaje co najmniej jedno konto `admin`.
- [ ] AC9 — **No-op nie tworzy wpisu.** Ustawienie roli identycznej z bieżącą nie wykonuje `update` i nie tworzy wiersza w `audit_log`; operator dostaje jawny komunikat, że nic nie zmieniono. Rejestr nie zawiera wpisów o operacjach, które niczego nie zmieniły.
- [ ] AC10 — **Idempotencja.** N-krotne wywołanie z tą samą docelową rolą daje dokładnie **jeden** wiersz `operation='role_change'` dla danego `record_id` (pierwsze wywołanie zmienia, kolejne są no-op wg AC9).
- [ ] AC11 — **Nieistniejące konto.** Wywołanie z `id` konta, którego nie ma, kończy się błędem domenowym bez wpisu w `audit_log` i bez ujawnienia, czy konto kiedykolwiek istniało.
- [ ] AC12 — **UI pokazuje prawdziwą rolę.** Lista kont w `SettingsClient.tsx` prezentuje faktyczną wartość `user.role` (etykieta PL dla każdej z czterech ról), a nie stały napis „Administrator”. Konto o roli `monter` nie jest opisane jako administrator.
- [ ] AC13 — **UI wymusza uzasadnienie.** Zmiana roli z panelu odbywa się przez dialog, którego nie da się zatwierdzić bez wyboru nowej roli, wpisania uzasadnienia (≥10 znaków po `trim`) i wybrania podstawy prawnej. `window.confirm` nie jest ścieżką zmiany roli. Lista ról i lista podstaw prawnych pochodzą z kontraktu — w komponencie nie ma literałów słownikowych.
- [ ] AC14 — **Brak ścieżki bez audytu (test statyczny).** Każde wystąpienie `.update(`/`.updateMany(`/`.upsert(` na modelu `authorizedUser` w `apps/b2b-web/src`, którego dane zawierają pole `role`, znajduje się wewnątrz `$transaction` zawierającego `auditLog.create`. Akcja dodana jutro bez wpisu jest wykrywana przez ten test, nie przez czyjąś czujność.
- [ ] AC15 — **Jedno źródło progu i słownika.** Test statyczny: nie przybywa drugiego pliku definiującego `z.string().trim().min(10)` (istniejący limit z `SEC-AUDIT-LOG-DELETE` pozostaje spełniony), a pełny słownik `legalBases` ani lista `ROLES` nie występują jako literały w `apps/b2b-web/src` poza importem z kontraktu.
- [ ] AC16 — **Wpisu nie da się poprawić.** `UPDATE` i `DELETE` na wierszu utworzonym przez zmianę roli są odrzucone przez `audit_log_append_only_trg` również przez Prismę (która omija RLS). Kryterium dzielone z `SEC-AUDIT-LOG-APPEND-ONLY`; obowiązuje ten sam poziom dowodu co tam (dziś statyczny nad tekstem migracji, bo suite nie ma połączenia z żywym Postgresem).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Zmiana własnej roli przez admina (samodegradacja).** Nie jest zakazana sama w sobie — zakazuje jej dopiero inwariant ostatniego admina (AC7). Przy dwóch kontach `admin` degradacja własnego konta **przechodzi**, wpis powstaje z `actor_email` równym e-mailowi konta, którego rola się zmienia, i z `actor_role = 'admin'` (rola sprzed zmiany). To jest poprawne i musi przejść: dowód zostaje, mimo że wykonawca właśnie stracił uprawnienia.
- **Skutek samodegradacji jest natychmiastowy.** `getCurrentActorRole()` czyta bazę przy każdym żądaniu (`cache()` żyje jeden render), więc kolejna nawigacja do `/settings` kończy się `notFound()`. Test dowodzi, że nie ma warstwy sesyjnej pamiętającej starą rolę — nie ma czego unieważniać.
- **Współbieżność dwóch adminów degradujących się nawzajem** (AC8) — klasyczna pułapka nr 4 z CLAUDE.md: sprawdzenie liczby adminów w JS przed transakcją nie wystarcza.
- **Współbieżność na jednym koncie:** dwa równoległe żądania zmieniające rolę tego samego konta na dwie różne wartości — końcowy stan odpowiada dokładnie jednemu z nich, a liczba wpisów w `audit_log` odpowiada liczbie faktycznych zmian (nie ma wpisu bez zmiany ani zmiany bez wpisu).
- **No-op pod współbieżnością:** dwa równoległe żądania z tą samą docelową rolą — jeden wpis, nie dwa.
- **`justification` = dokładnie 10 znaków po `trim`** przechodzi; `"  abcdefghi  "` (9 po trim) nie przechodzi — **na serwerze**, nie tylko w formularzu.
- **Tożsamość po e-mailu:** `actor_email` bierze się z sesji Supabase, nigdy z parametru akcji ani z jakiejkolwiek wartości od klienta. Konto docelowe wskazuje `id`, nie e-mail — akcja nie może przyjmować e-maila jako identyfikatora celu (podatność z klasy „tożsamość po wartości e-maila”).
- **Rola docelowa `admin` też jest zmianą roli** — awans (`monter` → `admin`) podlega dokładnie tym samym wymogom co degradacja; test nie może pokrywać wyłącznie degradacji.
- **CHECK bazy jako druga linia:** próba zapisu `operation` innego niż sześć wartości `mustLog` albo `resource` spoza 13 wartości jest odrzucana przez bazę (test dowodzi, że kod używa `'role_change'` i `'authorized_users'`).

## Poza zakresem

- **Rola nadawana przy tworzeniu konta.** `addAuthorizedUser` przypisuje rolę raz, a `create` nie jest operacją z `mustLog` — audyt tworzenia konta nie należy do tego WO. Odblokowanie wyłączonego `<select>` w modalu zaproszenia (`SettingsClient.tsx:154`) i przestanie wysyłać zahardkodowane `"admin"` (`:34`) — **osobne zadanie**; ten WO tylko nie może tego pogorszyć.
- **Ochrona ostatniego admina na ścieżce `delete`** oraz twarda gwarancja na poziomie bazy (constraint/trigger). Nawet po przyjęciu D3 luka zostaje otwarta w `deleteAuthorizedUser` — osobne ID (`SEC-LAST-ADMIN-GUARD`), wymaga migracji.
- Pozostałe operacje z `mustLog`: `manual_status_change`, `notification_resend`, `contract_override` — kolejne części rozbicia `SEC-AUDIT-LOG`.
- `before_snapshot` / kolumny „przed–po” — kolumny nie ma na bazie i **nie jest** kryterium akceptacji (rozstrzygnięcie człowieka, okno `SEC-RODO-DELETE-RECONCILE`). Patrz D2.
- Rozszerzenie `AUDIT_REQUIREMENTS.legalBases` o wartość kadrową — patrz D1, osobne okno kontraktowe i migracja CHECK-a.
- Widok przeglądania `audit_log` w panelu, eksport, retencja `retentionDays = 1825`.
- Powiadomienie do pracownika o zmianie jego roli — katalog powiadomień nie przewiduje takiego zdarzenia; dołożenie go to zmiana kontraktu powiadomień, nie tego WO.
- Zaproszenia, resetowanie haseł, dezaktywacja konta bez usuwania — nie istnieją i nie powstają tutaj.
- `apps/b2c-web` i Field App — inny model ochrony.

## Ryzyka i nieznane

- **D2 jest realną luką dowodową, nie kosmetyką.** Bez zapisu „z jakiej na jaką” rejestr po dwóch kolejnych zmianach roli nie pozwala odtworzyć ścieżki uprawnień — a to jest pierwsze pytanie przy kontroli. Wariant (b) rozwiązuje to kosztem doklejania tekstu do pola wypełnianego przez człowieka; wariant (c) rozwiązuje czysto, ale kosztem migracji, której to WO świadomie unika. **Decyzja należy do człowieka.**
- **Słownik `legalBases` jest ukształtowany pod RODO i nie pasuje do operacji kadrowej** (D1). Skutek uboczny akceptacji: statystyka po `legal_basis` zmiesza usunięcia z awansami, bo jedno i drugie będzie miało `OTHER`.
- **`role String @default("admin")` w schemacie Prismy** (`schema.prisma:89`). Konto utworzone bez jawnej roli dostaje pełne uprawnienia. To nie jest przedmiotem tego WO, ale jest w tej samej tabeli i w tym samym pliku, do którego zajrzy implementer — warto, żeby ktoś to odnotował jako osobny dług, zamiast „poprawiać przy okazji” bez okna kontraktowego.
- **`Serializable` podnosi liczbę błędów serializacji** przy współbieżnych zmianach ról. Jeżeli w fazie GREEN pojawią się losowe niepowodzenia AC8, to jest pierwsze podejrzenie, a nie „flaky test” — dokładnie ta sama uwaga co przy `deleteAuditorAction` w fali B `SEC-AUDIT-LOG-DELETE`.
- **AC16 nie jest weryfikowalne zachowaniowo** w dzisiejszym środowisku testowym (brak połączenia z żywym Postgresem — zastrzeżenie odziedziczone po `SEC-AUDIT-LOG-APPEND-ONLY`). Jeżeli tak zostaje, kryterium ma być **jawnie** testem statycznym nad tekstem migracji, a nie kryterium przechodzącym przez pominięcie.
- **Zmiana ról może unieważnić założenia innych modułów, których dziś nie widać w Prismie.** `database_model.md` (ADR-009) opisuje `crews.representative_user_id` jako klucz obcy do `authorized_users` z przedstawicielem w roli `monter`; w `schema.prisma` **tego pola nie ma** (model `AuthorizedUser` nie ma żadnej relacji). Gdy pole powstanie, degradacja przedstawiciela ekipy zacznie mieć skutki dla puli montażowej — dziś nie ma, i ten WO tego nie modeluje. Odnotowane, żeby przyszła implementacja `crews` nie założyła, że zmiana roli jest bez konsekwencji.
- **Rozmiar:** jedna akcja serwerowa + jeden schemat + jeden dialog + naprawa wyświetlania roli. Mieści się w jednej fali (bez podziału), pod warunkiem że D1–D3 są rozstrzygnięte **przed** RED — inaczej AC7/AC8 i kształt `justification` zmienią się w trakcie i spalą iteracje GREEN.

Kolejność ról: człowiek (D1–D3) → `contract-steward` (rejestracja wymagania) → `test-author` (RED) → `implementer-server` → `implementer-ui` → `reviewer`.
