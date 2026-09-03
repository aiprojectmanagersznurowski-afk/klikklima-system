# WO: SEC-AUDIT-LOG-DELETE — wpis audytowy dla ośmiu akcji `delete` w panelu B2B

Status: gotowy do fazy kontraktowej. Data: 2026-09-03.
Część 1 z 4 rozbicia `SEC-AUDIT-LOG` (pozostałe: ROLE-CHANGE, MANUAL-STATUS, UI-JUSTIFICATION).

## Wymagania

- `SEC-AUDIT-LOG` (rodzic, `TODO`, HIGH) — `contracts/requirements.contract.mjs:319`.
- Nowe dziecko do zarejestrowania: **`SEC-AUDIT-LOG-DELETE`** (patrz „Zmiana kontraktu”).
- Sąsiaduje z: `CRM-CLIENT-ANONYMIZE-RODO` (wzorzec zapisu), `SEC-AUDIT-LOG-APPEND-ONLY` (nienaruszalność wpisu), `CRM-DELETE-ADMIN-ONLY-*` (bramka roli — **już pokryta**, ten WO jej nie dubluje).

## Kontekst kodu

### Istnieje (zweryfikowane na żywej bazie 2026-09-03, nie z ewidencji migracji)

- Tabela `audit_log` **istnieje w bazie**: kolumny `id, actor_email, actor_role, operation, resource, record_id, justification, legal_basis, created_at`. Kolumny `before_snapshot` **nie ma** — zgodnie z rozstrzygnięciem człowieka. Wpis w rejestrze wymagań twierdzący „migracja 20260901220000 NIE uruchomiona na żywej bazie” jest **nieaktualny**.
- CHECK-i na bazie działają i są zgodne z kontraktem:
  - `audit_log_operation_check` — dopuszcza `'delete'`,
  - `audit_log_resource_check` — 13 wartości `RESOURCES` (**nie ma wartości `logistics`**),
  - `audit_log_legal_basis_check` — `RODO_ERASURE_REQUEST, OPERATIONAL_ERROR, DUPLICATE, COURT_ORDER, OTHER`,
  - `audit_log_justification_min_length` — `length(btrim(justification)) >= 10`.
- Wyzwalacz `audit_log_append_only_trg` istnieje. Tabela ma 0 wierszy.
- Wzorzec referencyjny: `anonymizeClientAction` w `apps/b2b-web/src/app/(dashboard)/customers/actions.ts:89-162` (rola → e-mail → Zod → `$transaction` z `tx.auditLog.create`).
- Schemat Zod do skopiowania jako wzór: `apps/b2b-web/src/app/(dashboard)/customers/anonymize-client-schema.ts` — próg 10 i słownik biorą się **wyłącznie** z `AUDIT_REQUIREMENTS`, zero literałów.
- Formularz z `justification` + `legalBasis` na `react-hook-form` + `zodResolver`: `customers-client.tsx:42-131` — wzorzec dla ośmiu dialogów.
- Wszystkie 8 akcji **mają już poprawną bramkę roli** przez `can(actorRole, <resource>, 'delete')`.

### Brakuje

- Żadna z 8 akcji nie zapisuje niczego do `audit_log`.
- Żadna nie przyjmuje `justification`. Żadna (poza customers) nie pobiera `actorEmail` — trzeba dołożyć `createClient()` + `auth.getUser()` (kolumna jest `NOT NULL`, brak e-maila = odmowa, fail-closed).
- Trzy akcje usuwają **poza jakąkolwiek transakcją**: `deleteLeadAction` (`leads/actions.ts:572`), `deleteInstallationAction` (`installations/actions.ts:136`), `deleteIncidentAction` (`incidents/actions.ts:87`), `deleteAuthorizedUser` (`settings/actions.ts:203`), `deleteServiceAction` (`services/actions.ts:172`, ma jeszcze `findUnique` przed `delete`, też poza transakcją).
- `deleteAuditorAction` (`auditors/actions.ts:420`, `Serializable`) i `deleteCrewAction` (`crews/actions.ts:424`) mają transakcję, ale z **wczesnymi wyjściami** (`BLOCK_UNTIL_REASSIGNED`) — wpis nie może powstać na ścieżce odmowy.
- `deleteLogisticsOrderAction` (`logistics/actions.ts:307`) **deleguje do `deleteLeadAction`** — to nie jest ósmy punkt zapisu, tylko drugi wywołujący ten sam. Punktów zapisu jest **siedem**.
- UI: wszystkie osiem ścieżek to dziś przeglądarkowy `confirm()` / `window.confirm` (np. `services-client.tsx:36`, `SettingsClient.tsx:44`) — nie da się w nim wpisać uzasadnienia.

## Zmiana kontraktu

**WYMAGANA — jeden krok, wąski. Musi się wydarzyć PRZED fazą RED, w osobnym oknie kontraktowym z rolą `contract-steward`.**

1. **Rejestracja `SEC-AUDIT-LOG-DELETE`** jako dziecka `SEC-AUDIT-LOG`, dokładnie wzorem rozbicia `CRM-DELETE-ADMIN-ONLY` → `CRM-DELETE-ADMIN-ONLY-<RESOURCE>` (`requirements.contract.mjs:162-173`). Bez tego `kk-trace` nie ma czego liczyć, a testy nie mają czym się otagować. Rodzic `SEC-AUDIT-LOG` **zostaje `TODO`** — pokrywają go dopiero cztery dzieci razem; nie oznaczaj go `SUPERSEDED` w tym oknie, bo trzy pozostałe części jeszcze nie istnieją.
   - `source` musi odnotować: ścieżki 7 plików `actions.ts`, ten WO, oraz fakt, że migracja `20260901220000` **jest** zastosowana (sprostowanie nieaktualnego zdania w `CRM-CLIENT-ANONYMIZE-RODO` i `SEC-AUDIT-LOG-APPEND-ONLY`).
   - Kryteria akceptacji: sekcja „Kryteria akceptacji” poniżej, przepisana jeden do jednego.

2. **`AUDIT_REQUIREMENTS.legalBases` — BEZ ZMIAN.** Sprawdzone: lista **już zawiera** neutralne `OPERATIONAL_ERROR` i `OTHER`. Rozszerzanie słownika jest zbędne, a rozszerzenie pociągnęłoby migrację CHECK-a. Decyzja dla tego WO: podstawą domyślną dla usunięcia spoza RODO jest **`OPERATIONAL_ERROR`**, ale operator wybiera z **pełnej pięcioelementowej listy** (usunięcie leada może realnie być `RODO_ERASURE_REQUEST` albo `DUPLICATE`) — nie zawężaj słownika w formularzu, bo powstałaby druga lista obok kontraktu.

3. Zmiany schematu / migracji: **żadne.** Tabela, CHECK-i i wyzwalacz są na bazie.

## Wzorzec zapisu (obowiązujący, bez odchyleń)

Dla każdej z siedmiu funkcji, w tej kolejności:

1. `actorRole` z `getCurrentActorRole()` w `try/catch`; wyjątek → odmowa uprawnień (nie błąd zapisu).
2. `can(actorRole, <resource>, 'delete') !== 'yes'` → odmowa. **Zero zapytań do bazy przed tym punktem.**
3. `actorEmail` z `createClient()` + `auth.getUser()`; brak e-maila → odmowa.
4. Walidacja wejścia schematem Zod współdzielonym (patrz niżej); niepowodzenie → odmowa **bez żadnego zapisu**.
5. Dopiero teraz `prisma.$transaction(async (tx) => { … })`, a w nim **samo usunięcie i wpis audytowy razem**:

```
await tx.<model>.delete({ where: { id } });
await tx.auditLog.create({
  data: {
    operation: 'delete',
    resource: <literał z RESOURCES>,
    recordId: id,
    actorEmail,
    actorRole,
    justification,
    legalBasis,
  },
});
```

Wpis **wewnątrz** tej samej transakcji co `delete`, nigdy po niej i nigdy w drugim `$transaction`.

Mapowanie `resource` (musi przejść `audit_log_resource_check`):

| Akcja | plik | model Prismy | `resource` |
|---|---|---|---|
| `deleteLeadAction` | `leads/actions.ts` | `leady` | `leads` |
| `deleteLogisticsOrderAction` | `logistics/actions.ts` | (deleguje) | `leads` |
| `deleteInstallationAction` | `installations/actions.ts` | `instalacje` | `installations` |
| `deleteIncidentAction` | `incidents/actions.ts` | `usterki_incidents` | `incidents` |
| `deleteServiceAction` | `services/actions.ts` | `serwisy` | `services` |
| `deleteAuthorizedUser` | `settings/actions.ts` | `authorizedUser` | `authorized_users` |
| `deleteAuditorAction` | `auditors/actions.ts` | `audytorzy` | `auditors` |
| `deleteCrewAction` | `crews/actions.ts` | `zespoly_monterskie` | `crews` |

`resource = 'logistics'` **nie istnieje** i baza je odrzuci — logistyka zapisuje `leads`.

Schemat wejścia: nowy plik współdzielony, np. `apps/b2b-web/src/lib/audit/delete-justification-schema.ts`:

```
justification: z.string().trim().min(10),
legalBasis: z.enum(AUDIT_REQUIREMENTS.legalBases),
```

— jeden plik dla wszystkich ośmiu ścieżek i dla ośmiu formularzy. Kopia schematu per moduł jest naruszeniem (ten sam powód co przy `anonymize-client-schema.ts`).

Sygnatura każdej z 8 funkcji zyskuje drugi parametr:
`(id: string, input: { justification: string; legalBasis: string })`. Parametr jest **obowiązkowy** — wartość domyślna albo `input?` przywróciłaby ścieżkę usunięcia bez śladu.

## Podział na fale — ocena rozmiaru

**Nie da się w jednej turze GREEN.** 7 punktów zapisu + 8 dialogów UI + nowy schemat współdzielony to zbyt szeroki front na limit 3 iteracji. Zmiana sygnatury łamie kompilację wywołań w UI natychmiast, więc **serwer i UI muszą iść w tej samej fali** — dzielimy po zasobach, nie po warstwach.

**Fala A — siedem prostych usunięć (5 akcji serwerowych + 6 wywołań w UI).**
`leads` (+ delegujące `logistics`), `installations`, `incidents`, `services`, `authorized_users`.
Jednolity wzorzec: dziś `delete` bez transakcji → owinąć w `$transaction` z wpisem. Plus nowy schemat współdzielony.
Uwaga do `deleteServiceAction`: `findUnique` sprawdzający istnienie ma wejść **do tej samej transakcji** albo zniknąć — dziś jest poza nią i tworzy okno wyścigu.
Uwaga do `deleteLogisticsOrderAction`: przekazuje `input` w dół do `deleteLeadAction`, nie tworzy własnego wpisu; podwójny wpis dla jednego usunięcia byłby defektem.

**Fala B — dwa usunięcia z blokadą (2 akcje + 2 wywołania w UI).**
`auditors` (`BLOCK_UNTIL_REASSIGNED`, `Serializable`), `crews` (`BLOCK_UNTIL_REASSIGNED`).
Osobno, bo mają wczesne wyjścia w transakcji i wpis nie może powstać, gdy usunięcie zostało zablokowane.

**Krok UI wewnątrz każdej fali (rola `implementer-ui`, nie osobny WO):** zamiana `confirm()` na dialog z polem `justification` (textarea) i `<select>` `legalBasis`, na `react-hook-form` + `zodResolver` ze wspólnym schematem, wzorem `customers-client.tsx`. Bez tego pola serwer i tak odrzuci każde wywołanie — UI i serwer są nierozdzielne.

Kolejność ról w fali: `contract-steward` (raz, przed falą A) → `test-author` (RED) → `implementer-server` → `implementer-ui` → `reviewer`.

## Kryteria akceptacji

- [ ] AC1 — **Transakcyjność.** Gdy zapis do `audit_log` zawiedzie, rekord **nie jest usunięty** (rollback całej transakcji). Dla każdego z ośmiu wejść nie istnieje ścieżka kodu wywołująca `delete` poza transakcją zawierającą `auditLog.create`.
- [ ] AC2 — **Odwrotny kierunek.** Gdy `delete` zawiedzie (np. FK `BLOCK`), w `audit_log` nie przybywa wiersz — brak wpisów o operacjach, które się nie wydarzyły.
- [ ] AC3 — **Kompletność wpisu.** Wpis ma `operation = 'delete'`, `resource` zgodne z tabelą mapowania powyżej, `record_id` równe identyfikatorowi usuwanego rekordu, `actor_email` zalogowanego użytkownika (nie `null`, nie stała), `actor_role` **z chwili operacji** (wartość z `getCurrentActorRole()` utrwalona jako tekst, nie odczytana później przez relację).
- [ ] AC4 — **Fail-closed przy braku roli.** Brak sesji, e-mail spoza `authorized_users`, rola nierozpoznana przez `ROLES` oraz wyjątek samego zapytania o rolę dają odmowę uprawnień — a nie generyczny błąd zapisu i nie usunięcie. Test dowodzi, że **zero** zapytań `delete` i zero `auditLog.create` powstało.
- [ ] AC5 — **Fail-closed przy braku e-maila.** Sesja bez adresu e-mail daje odmowę przed jakimkolwiek zapytaniem — `actor_email` jest `NOT NULL` i nie wolno go obejść pustym stringiem ani wartością zastępczą.
- [ ] AC6 — **Uzasadnienie obowiązkowe.** `justification` krótsze niż 10 znaków po `trim` albo `legalBasis` spoza `AUDIT_REQUIREMENTS.legalBases` jest odrzucone **bez żadnego zapisu i bez usunięcia**. Sprawdzone dla wartości `""`, `"   "`, `"krótkie"` (9 znaków) i `"NIEISTNIEJACA_PODSTAWA"`.
- [ ] AC7 — **Jedno usunięcie = jeden wpis.** Udane usunięcie przez `deleteLogisticsOrderAction` tworzy dokładnie **jeden** wiersz w `audit_log` z `resource = 'leads'`, nie dwa.
- [ ] AC8 — **Blokada nie loguje.** Odmowa z `BLOCK_UNTIL_REASSIGNED` (audytor z wiszącymi leadami, ekipa z aktywnymi instalacjami) nie tworzy wpisu w `audit_log` — nic nie usunięto.
- [ ] AC9 — **Powtórzenie na nieistniejącym rekordzie.** Drugie wywołanie z tym samym `id` (rekord już usunięty) nie tworzy drugiego wpisu; liczba wpisów `operation='delete'` dla danego `record_id` po N wywołaniach wynosi 1.
- [ ] AC10 — **Jedno źródło progu i słownika.** Test statyczny: literał `10` jako próg długości uzasadnienia oraz jakakolwiek lista podstaw prawnych nie występują w `apps/b2b-web/src` poza importem z `AUDIT_REQUIREMENTS`; druga kopia schematu Zod obok współdzielonego pliku jest naruszeniem.
- [ ] AC11 — **Brak ścieżki bez audytu.** Test statyczny nad `apps/b2b-web/src`: każde wystąpienie `.delete({` na modelu Prismy w pliku `actions.ts` znajduje się w bloku `$transaction`, w którym występuje też `auditLog.create`. Nowa akcja `delete` dodana jutro bez wpisu jest wykrywana przez ten test, nie przez czyjąś czujność.
- [ ] AC12 — **UI wymusza uzasadnienie.** W każdym z ośmiu miejsc usuwania nie da się zatwierdzić operacji bez wpisania uzasadnienia i wybrania podstawy prawnej; `window.confirm` nie jest już ścieżką usunięcia w żadnym z ośmiu komponentów.
- [ ] AC13 — **Wpisu nie da się poprawić.** `UPDATE` i `DELETE` na wierszu utworzonym przez usunięcie są odrzucone przez `audit_log_append_only_trg` również przez Prismę (która omija RLS). (Kryterium dzielone z `SEC-AUDIT-LOG-APPEND-ONLY` — tu potwierdza, że nowe wpisy podlegają tej samej ochronie.)

## Przypadki brzegowe, które MUSZĄ mieć test

- **Współbieżność:** dwa równoległe usunięcia tego samego `id` — jedno kończy się sukcesem z jednym wpisem, drugie odmową bez wpisu. Rozstrzygnięcie należy do bazy (wynik `delete`/`deleteMany`), nie do odczytu poprzedzającego zapis.
- **Kaskada leada:** usunięcie leada kaskaduje `quotes` i `shipments` (`DELETE_POLICIES.leads`). Powstaje **jeden** wpis `resource='leads'`, nie wpis per encja kaskadowana. Wpisy dla encji kaskadowanych są **poza zakresem** (patrz niżej).
- **Uprawnienia per rola:** dla każdego z ośmiu zasobów wywołanie przez rolę bez `delete` w `PERMISSIONS` — odmowa, zero zapytań, zero wpisów. Test wywołuje Server Action bezpośrednio, z pominięciem UI: UI nie jest granicą uprawnień.
- **`justification` = 10 znaków po trim** (dokładnie na progu) przechodzi; `"  abcdefghi  "` (9 po trim) nie przechodzi — na serwerze, nie tylko w formularzu.
- **CHECK bazy jako druga linia:** próba zapisu `resource='logistics'` jest odrzucona przez bazę (test dowodzi, że kod tej wartości nie używa).
- **Tożsamość po e-mailu:** `actor_email` bierze się z sesji Supabase, nigdy z parametru akcji ani z jakiejkolwiek wartości od klienta.
- **`deleteAuthorizedUser`:** `record_id` to `cuid()`, nie UUID — wpis musi przejść mimo braku FK i mimo tego, że konto po operacji nie istnieje.
- **Usunięcie własnego konta admina** — wpis powstaje z `actor_email` równym e-mailowi usuwanego konta; to poprawne i musi przejść (konto zniknęło, dowód zostaje).

## Poza zakresem

- Pozostałe trzy operacje z `mustLog`: `role_change`, `manual_status_change`, `notification_resend`, `contract_override` — osobne WO tego rozbicia.
- `before_snapshot` — kolumny nie ma na bazie i **nie jest** kryterium akceptacji (rozstrzygnięcie człowieka, okno `SEC-RODO-DELETE-RECONCILE`).
- `anonymizeClientAction` — już zaimplementowane pod `CRM-CLIENT-ANONYMIZE-RODO`, nie ruszać.
- Wpisy audytowe dla encji usuwanych kaskadowo (`quotes`, `shipments`) — świadomie jeden wpis na operację operatora.
- Bramka roli sama w sobie (`CRM-DELETE-ADMIN-ONLY-*`, `SEC-AUTHZ-USER-MGMT`) — tu tylko nie wolno jej zepsuć.
- Widok przeglądania `audit_log` w panelu, eksport, retencja `retentionDays = 1825`.
- `apps/b2c-web` i Field App — inny model ochrony.
- Ochrona przed usunięciem ostatniego admina — znana luka, osobne ID.

## Ryzyka i nieznane

- **Rejestr wymagań kłamie o stanie bazy.** `CRM-CLIENT-ANONYMIZE-RODO` i `SEC-AUDIT-LOG-APPEND-ONLY` twierdzą, że migracja `20260901220000` nie jest uruchomiona — sonda na żywej bazie (2026-09-03) pokazuje tabelę, trzy CHECK-i i wyzwalacz. `contract-steward` powinien sprostować `source` obu wpisów przy okazji tego samego okna.
- **`SEC-AUDIT-LOG-APPEND-ONLY` ma kryterium „nieweryfikowalne w tym środowisku — brak Postgresa”.** To zastrzeżenie też jest do sprostowania; jeżeli testy AC13 mają być wykonywalne, trzeba potwierdzić, że suite ma dostęp do bazy. **Jeżeli nie ma** — AC13 zostaje testem statycznym nad migracją, a nie zachowaniowym, i trzeba to zapisać wprost, zamiast zostawiać kryterium, które przechodzi przez pominięcie.
- `deleteAuditorAction` działa na `Serializable`. Dołożenie wpisu może podnieść liczbę błędów serializacji przy współbieżnym usuwaniu; jeżeli w fali B pojawią się losowe niepowodzenia, to jest pierwsze podejrzenie, a nie „flaky test”.
- Nie rozstrzygnięto, czy `legalBasis` ma mieć wartość wstępnie wybraną w formularzu. Rekomendacja: **brak preselekcji** (pole puste, wybór świadomy) — preselekcja `OPERATIONAL_ERROR` sprawi, że każdy wpis będzie miał tę wartość i pole przestanie cokolwiek znaczyć. Do potwierdzenia przez człowieka przed falą A.
