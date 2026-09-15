# WO: CAL-SCHEDULING-CONFIG-UI — ekran administracyjny „Kalendarz": koszyki czasu wizyty i bufor dojazdu

## Wymagania

- `CAL-VISIT-DURATION-BASKETS` (status `TODO`, risk **MEDIUM**, domain `crm`) — 8 kryteriów,
  `contracts/requirements.contract.mjs` linie 699-708.
- `CAL-TRAVEL-BUFFER` (status `TODO`, risk **MEDIUM**, domain `crm`) — 6 kryteriów,
  `contracts/requirements.contract.mjs` linie 710-717.
- Wejścia (DONE, nie są przedmiotem tego WO): `CAL-SLOT-ENGINE` (silnik już CZYTA obie wartości),
  `FLD-AVAIL-WEEKLY-RULES`, `FLD-BOOKING-ATOMIC-ASSIGN`.
- Źródło opisowe: `docs/architecture/FIELD-APP-PLAN.md` §6.4 R1 i R2.

Oba wymagania trafiają do jednego WO świadomie: to jedna rodzina — **parametry operacyjne
kalendarza**, ustawiane przez tę samą rolę (`admin`), w tym samym ekranie, i obie mają
bliźniacze kryterium „zmiana nie rusza rezerwacji już zawartych" (koszyki AC3, bufor AC5).
Rozdzielenie ich dałoby dwa ekrany na dwa pola jednego formularza.

To **NIE** są progi SLA. `contracts/sla.contract.mjs` jest tu zakazanym miejscem — wprost
w AC1 koszyków. Wartości mieszkają w bazie, bo są parametrem firmy, nie kontraktem.

---

## Kontekst kodu (zweryfikowany 2026-09-15 przez odczyt plików, nie z opisu)

### Istnieje

**Dane i schemat — komplet, nic nie trzeba dodawać:**
- `packages/database/prisma/schema.prisma:849-880` — model `VisitDurationBasket`
  (`@@map("visit_duration_baskets")`): `id`, `code` (unique), `labelPl`, `durationMinutes` (**Int**,
  `@map("duration_minutes")`), `pool` (`AUDITOR`|`CREW`), `isActive` (default `true`),
  `sortOrder`, `createdAt`, `updatedAt`, relacja `bookings Booking[]`.
- `packages/database/prisma/schema.prisma:1007-1008` — `Booking.visitBasketId` jako klucz obcy
  z `onDelete: Restrict`. Baza fizycznie nie pozwoli skasować koszyka użytego w rezerwacji.
- `supabase/migrations/20260910100000_fld_calendar_foundation.sql:128-136` — **seed siedmiu
  koszyków** (`AUDIT` 120, `SERVICE` 90, `INCIDENT` 120, `INSTALL_SMALL` 240,
  `INSTALL_STANDARD` 480, `INSTALL_PHASE_1` 480, `INSTALL_PHASE_2` 240), `ON CONFLICT DO NOTHING`.
  Koszyka „montaż duży = 2 dni" nie ma i ma nie być (AC8).
- Tamże, linie 112-114 — ograniczenia bazy: `UNIQUE (code)`, `CHECK (pool IN ('AUDITOR','CREW'))`,
  **`CHECK (duration_minutes > 0)`**. Ostatnie jest twardą dolną granicą dla walidacji Zod.
- Tamże, linie 398-425 — trigger `bookings_pool_matches_basket_trg`: porównuje
  `visit_duration_baskets.pool` z `bookings.resource_kind`, **na INSERT/UPDATE rezerwacji**.
  Uwaga na skutek uboczny opisany w „Ryzykach": trigger NIE pilnuje zmiany `pool` na samym koszyku.
- `supabase/migrations/20260910100000_fld_calendar_foundation.sql:482-492` — seed wiersza
  `system_config.typ_konfiguracji = 'scheduling_config'`. **Wartość `konfiguracja` to jeden
  obiekt JSONB z czterema kluczami**:
  `travel_buffer_minutes: 60`, `default_workday_start: "08:00"`, `default_workday_end: "16:00"`,
  `default_weekdays: [1,2,3,4,5]`. `ON CONFLICT DO NOTHING` — komentarz w migracji mówi wprost:
  „wartość zmieniona przez administratora w panelu B2B jest ważniejsza niż wartość początkowa".
- `packages/database/prisma/schema.prisma:214-219` — model `system_config`
  (`typ_konfiguracji` `@unique`, `konfiguracja Json`). Brak kolumny `updated_at`.

**Silnik — już czyta obie wartości, nie wymaga zmian:**
- `packages/scheduling/src/available-slots.ts:191` — `prisma.visitDurationBasket.findUnique`
  (długość wizyty ze słownika), `:207-215` — odczyt `scheduling_config` i
  `parseTravelBufferMinutes` (linie 68-80), **fail-CLOSED**: brak wartości, wartość nieliczbowa
  albo ujemna → `error`, nie fallback do 0.
- `packages/scheduling/src/create-booking.ts:253-274` — ta sama para odczytów przed rezerwacją;
  `scheduled_end` wyliczany i **utrwalany** w chwili rezerwacji
  (`migracja …:463` — „Zmiana czasu trwania koszyka nie przesuwa rezerwacji już zawartych").
- `packages/scheduling/src/effective-availability.ts:128-144` — **drugi konsument tego samego
  wiersza JSONB**, czytający `default_workday_*` / `default_weekdays`. To jest źródło
  najpoważniejszego ryzyka tego WO (patrz D-1).

**RBAC:**
- `contracts/rbac.contract.mjs:33` — `visit_duration_baskets` jest w `RESOURCES`.
- `contracts/rbac.contract.mjs:128` — `{ resource: 'visit_duration_baskets',
  read: ['admin','dyspozytor','audytor','monter'], create: ['admin'], update: ['admin'],
  delete: ['admin'] }`. Dla koszyków bramka jest gotowa.

**UI i wzorzec Server Action:**
- `apps/b2b-web/src/app/(dashboard)/settings/page.tsx` — Server Component: `getCurrentActorRole()`
  → `can(actorRole,'authorized_users','read')` → `notFound()` przy braku → `prisma.findMany`
  → render klienta. Bramka PRZED zapytaniem (wymóg `tools/kk-authz-gate.mjs`).
- `apps/b2b-web/src/app/(dashboard)/settings/actions.ts` — pięć akcji, jednolity wzorzec:
  `getCurrentActorRole()` → `can(...) !== 'yes'` → `{ success: false, error: '…' }` → walidacja →
  Prisma → `revalidatePath('/settings')`. Zwracają obiekt wyniku, nie rzucają.
- `apps/b2b-web/src/app/(dashboard)/settings/SettingsClient.tsx:94-103` — **lewa kolumna to trzy
  przyciski bez żadnego stanu**: `["Ogólne","Zarządzanie Dostępem","Integracje (Stripe)"]`,
  podświetlenie przez `i === 1`. To nie są zakładki, to atrapa wizualna.
- `apps/b2b-web/src/app/(dashboard)/layout.tsx:80-89` — **prawdziwa nawigacja**: grupa „Ustawienia"
  z pod-pozycjami jako osobne trasy: `/settings/exit-intent`, `/settings`,
  `/settings/notifications` (ta ostatnia `comingSoon: true`).
- `apps/b2b-web/src/app/(dashboard)/settings/notifications/page.tsx` — istniejący wzorzec
  pod-strony ustawień (dziś zaślepka „Moduł w przygotowaniu").

### Brakuje

- **Zero** Server Action dotykających `visitDurationBasket` (grep po `apps/b2b-web/src`: model
  nie występuje w ani jednym pliku aplikacji).
- **Zero** komponentów `.tsx` wspominających koszyk — `grep -rn "basket" apps/b2b-web/src --include=*.tsx`
  zwraca pustkę.
- **Zero** Server Action zapisujących `system_config`. Dziś zmiana bufora wymaga ręcznego SQL.
- Trasy `/settings/calendar` (albo równoważnej) nie ma.

---

## Decyzja: gdzie to mieszka w UI

**Nowa trasa `/settings/calendar`, plus pozycja w grupie „Ustawienia" w
`apps/b2b-web/src/app/(dashboard)/layout.tsx`.** Etykieta: `Kalendarz i wizyty`.

Uzasadnienie — zaproponowana w rozmowie „nowa zakładka w `SettingsClient.tsx`" jest w tym repo
**myląca**: te „zakładki" nie mają stanu, nie mają routingu i nie da się do nich podlinkować.
Dopisanie do tablicy w linii 95 czwartego napisu nie stworzy ekranu, tylko czwarty martwy
przycisk. Realny wzorzec zakładek ustawień w tym repo to **pod-trasy** (`/settings/exit-intent`,
`/settings/notifications`), spięte przez `subItems` w nawigacji layoutu. Idziemy tym wzorcem.

Skutki uboczne, świadome:
- `/settings` zostaje tym, czym jest — ekranem kont pracowników (w nawigacji nazywa się już
  „Użytkownicy i Uprawnienia", nie „Ogólne").
- Atrapy „Ogólne" / „Integracje (Stripe)" w `SettingsClient.tsx` zostają nietknięte. Ich sprzątanie
  to osobne zadanie, poza zakresem.

---

## Zmiana kontraktu

**Koszyki (`CAL-VISIT-DURATION-BASKETS`): NIEWYMAGANA.** Model, tabela, dane i wiersz RBAC
(`visit_duration_baskets`, `update: ['admin']`) już istnieją. Całość zmiany mieści się w
`apps/b2b-web/src` — Server Action + UI. Bez okna kontraktowego, bez migracji, bez `schema.prisma`.

**Bufor (`CAL-TRAVEL-BUFFER`): WYMAGANA, wąsko — i to jest ustalenie, którego założenie zlecenia
nie przewidywało. ROZSTRZYGNIĘTE 2026-09-15 (P-1): TAK, zasób `system_config` zostaje dopisany
do RBAC z `update: ['admin']`.** Wykonuje `contract-steward` w oknie kontraktowym
`CAL-SCHEDULING-CONFIG-RBAC` — prace trwają równolegle do tego WO.
Powód jest konkretny, nie formalny:

1. `system_config` **nie występuje** w `RESOURCES` (`contracts/rbac.contract.mjs:11-34`) ani
   w `MATRIX`. Nie ma też żadnego zasobu-zamiennika o tej semantyce.
2. `can()` (`packages/contracts/src/generated/rbac.ts:102-107`) dla nieznanego zasobu zwraca
   `'no'` **dla każdej roli**. `can(role,'system_config','update')` odmówi także administratorowi
   — akcja byłaby martwa od pierwszego uruchomienia.
3. Ominięcie bramki nie wchodzi w grę: `tools/kk-authz-gate.mjs` (skaner AST w `scripts/verify.sh`,
   z testem żywotności `apps/b2b-web/tests/authz-gate-scanner-liveness.test.ts`) zgłasza jako
   `suspect` każdą funkcję w `app/`, która woła Prismę bez `can()` przed zapytaniem — łącznie
   z `$executeRaw`. Akcja bez `can()` zatrzyma bramkę CI.

Zakres zmiany kontraktu, minimalny:
- dopisać `'system_config'` do `RESOURCES`;
- dopisać wiersz do `MATRIX`:
  `{ resource: 'system_config', read: ['admin'], create: [], update: ['admin'], delete: [] }`
  — `create`/`delete` puste, bo wiersz `scheduling_config` powstaje migracją i nie ma być
  usuwany ani duplikowany przez UI (`typ_konfiguracji` jest `@unique`).

To zmiana wyłącznie w `contracts/rbac.contract.mjs` + regeneracja
(`node tools/kk-codegen.mjs`). **Bez migracji, bez `schema.prisma`** — tabela `system_config`
istnieje od dawna. Wykonuje `contract-steward` w oknie kontraktowym, PRZED wejściem implementera.

> Alternatywa odrzucona: przepięcie bramki bufora pod `visit_duration_baskets:update`. Działałoby
> technicznie i nie wymagałoby okna, ale zakłamuje macierz — nazwy zasobów w tym repo są tożsame
> z nazwami tabel (CLAUDE.md, ADR-002), a audyt RBAC czytałby „admin edytuje słownik koszyków"
> tam, gdzie faktycznie edytuje konfigurację harmonogramu. Koszt: jedna linia kontraktu.
> **Odrzucona ostatecznie decyzją człowieka 2026-09-15.**

**Druga zmiana kontraktu: WYMAGANA, wymuszona rozstrzygnięciem P-3 (wpisy w `audit_log`).**
Ustalono 2026-09-15: zmiany koszyków i bufora mają być logowane jako `field_update`. To NIE jest
możliwe bez migracji — sprawdzone na **żywej bazie** 2026-09-15 (`pg_constraint`), nie z pliku:

```
audit_log_operation_check  -> 7 wartości, 'field_update' JEST  (migracja 20260910103000)
audit_log_resource_check   -> 13 wartości: clients, leads, quotes, installations, services,
                              incidents, auditors, crews, shipments, notification_queue,
                              message_templates, authorized_users, audit_log
```

`visit_duration_baskets` ani `system_config` **nie są w tym CHECK-u**, mimo że oba są już
w `RESOURCES` w `contracts/rbac.contract.mjs` (koszyki od 2026-09-10, `system_config` od okna
`CAL-SCHEDULING-CONFIG-RBAC`). Każdy `auditLog.create` z takim `resource` poleci wyjątkiem CHECK —
a ponieważ wpis ma być **w tej samej transakcji** co zapis, wywróci się cała akcja. Zakres:

- migracja rozszerzająca `audit_log_resource_check` o `'visit_duration_baskets'` i `'system_config'`
  (wzorzec `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`, dokładnie jak
  `supabase/migrations/20260910103000_audit_log_field_update_operation.sql`);
- bez zmian w `schema.prisma` (`resource` to zwykły `String`), bez zmian w modelu danych.

Wykonuje `contract-steward` w oknie kontraktowym. **Bez tej migracji punkt „Wpisy audytowe"
poniżej jest niewykonalny** — implementer dostanie błąd bazy przy pierwszym zapisie.

---

## Kształt ekranu

Trasa: `apps/b2b-web/src/app/(dashboard)/settings/calendar/page.tsx` (Server Component)
+ `CalendarSettingsClient.tsx` (klient).

**Strona (Server Component):**
- `getCurrentActorRole()` → `can(actorRole,'visit_duration_baskets','read') !== 'yes'` → `notFound()`.
  Bramka PRZED jakimkolwiek zapytaniem Prismy.
- `prisma.visitDurationBasket.findMany({ orderBy: [{ pool: 'asc' }, { sortOrder: 'asc' }] })`
  — pełna lista, także `isActive: false` (administrator musi móc przywrócić wycofany koszyk).
- `prisma.system_config.findUnique({ where: { typ_konfiguracji: 'scheduling_config' } })`
  → `travel_buffer_minutes`.
- Przekazuje `actorRole` do klienta (wzorzec `SettingsClient`) — tylko po to, żeby wyszarzyć
  kontrolki dla nie-admina. Bramką wiążącą jest serwer.

**Sekcja 1 — „Czas trwania wizyty"** (tabela, wiersze pogrupowane po `pool`):

| Kolumna | Zachowanie |
|---|---|
| Kod (`code`) | tylko do odczytu, mono |
| Nazwa (`labelPl`) | tylko do odczytu w tym WO |
| Pula (`pool`) | tylko do odczytu, `StatusPill` (Audytor / Ekipa) |
| Czas trwania | pole liczbowe, **w minutach**, edytowalne |
| Aktywny | przełącznik `isActive` |
| — | **BRAK akcji „Usuń". BRAK przycisku „Dodaj koszyk".** |

- Pod polem minut podpowiedź wyliczana z wpisanej wartości („= 4 h", „= pół dnia"), liczona
  z `durationMinutes`, nigdy ze słownika etykiet zaszytego w kodzie.
- Wycofany koszyk (`isActive: false`) zostaje w tabeli, wizualnie wygaszony, z możliwością
  włączenia z powrotem.
- Odmowa wyłączenia ostatniego aktywnego koszyka w puli (P-6) musi być **widoczna**: komunikat
  błędu przy wierszu albo w pasku sekcji, a przełącznik wraca do stanu `włączony`. Przełącznik,
  który cicho wraca bez wyjaśnienia, wygląda jak zepsuty interfejs.

**Sekcja 2 — „Bufor dojazdu"**: jedno pole liczbowe (minuty) + tekst wyjaśniający, że bufor
dotyczy dwóch wizyt **tej samej osoby** i wpływa wyłącznie na wyliczanie nowych terminów.

Zapis: przycisk per sekcja albo per wiersz (decyzja implementera-UI), zawsze z komunikatem
zwrotnym w istniejącym wzorcu `successMessage` z `SettingsClient.tsx:114-126`.

---

## Server Actions

Plik: `apps/b2b-web/src/app/(dashboard)/settings/calendar/actions.ts`.
Schematy Zod: `apps/b2b-web/src/lib/schedule/scheduling-config-schema.ts`.

### 1. `updateVisitDurationBasketAction(id: string, input: { durationMinutes?: number; isActive?: boolean })`

- Bramka: `can(actorRole,'visit_duration_baskets','update') !== 'yes'` → odmowa, **przed** Prismą.
- Zod: `durationMinutes` — `z.number().int().positive()` (odpowiednik `CHECK (duration_minutes > 0)`),
  górna granica sanity `.max(960)` (dwie zmiany ośmiogodzinne; P-2 — **wartość zostaje**,
  świadomie nierozstrzygana dalej);
  `isActive` — `z.boolean()`. Co najmniej jedno z pól obecne.
- **Lista pól jest zamknięta i jawna** (ten sam wzorzec rozdzielności co w `FLD-BASE-LOCATION-EDIT`):
  `code`, `pool`, `labelPl`, `sortOrder`, `id` przemycone w tym samym żądaniu są **ignorowane albo
  żądanie odrzucone — nigdy zapisane**. `pool` jest tu krytyczny (patrz R-2).
- **Ochrona ostatniego aktywnego koszyka w puli (ROZSTRZYGNIĘTE 2026-09-15, P-6: blokować).**
  Zanim akcja zapisze `isActive: false`, musi policzyć aktywne koszyki w **puli tego koszyka**
  (`pool` odczytany z bazy, nie z wejścia). Jeżeli wyłączany koszyk jest ostatnim aktywnym w swojej
  puli (`AUDITOR` albo `CREW`) → **odmowa**, `{ success: false, error: … }` z komunikatem
  jednoznacznie wskazującym przyczynę i pulę (np. „Nie można wyłączyć ostatniego aktywnego koszyka
  w puli Audytor — kalendarz przestałby proponować jakiekolwiek terminy."). **Cichy zapis albo
  ciche pominięcie flagi jest naruszeniem kryterium** — użytkownik ma zobaczyć błąd, nie zastanawiać
  się, czemu przełącznik wrócił. Powód merytoryczny: R-3 — pusta pula to kalendarz bez żadnych
  ofert terminu, bez jednego komunikatu w całym systemie.
  Liczenie i zapis muszą być w **jednej transakcji** (`count` + `update`), inaczej dwóch
  administratorów wyłączających równolegle dwa ostatnie koszyki obejdzie blokadę (patrz przypadek
  brzegowy 8).
  Ograniczenie działa wyłącznie w kierunku `true → false`. Włączanie koszyka jest zawsze dozwolone.
- `prisma.visitDurationBasket.update({ where: { id }, data: <tylko dozwolone pola> })`.
- **Wpis audytowy (ROZSTRZYGNIĘTE 2026-09-15, P-3: logować).** Każda faktyczna zmiana
  `durationMinutes` albo `isActive` tworzy wpis w `audit_log`, **w tej samej transakcji** co
  `visitDurationBasket.update` (rekord zmieniony bez wpisu znosi warunek, pod którym edycja została
  dopuszczona — dokładnie ten sam argument co w `FLD-BASE-LOCATION-EDIT`).
  Konwencja identyczna jak w `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts:552-584`
  (i bliźniaczo w `crews/actions.ts:543-570`) — **ta sama, nie „podobna"**:
  - `operation: 'field_update'`
  - `resource: 'visit_duration_baskets'`
  - `recordId: id` (id koszyka)
  - `actorEmail` — z `createClient()` → `supabase.auth.getUser()` → `user.email`. **Fail-closed:**
    brak e-maila albo błąd odczytu → akcja zwraca `{ success: false, error: … }` i NIE zapisuje nic.
  - `actorRole` — rola z `getCurrentActorRole()`, utrwalona jako tekst
  - `justification` — **wyliczana przez serwer**, nigdy nie pobierana od użytkownika; format
    `formatFieldChange` z `auditors/actions.ts:39-42`: `"<etykieta>: <przed> → <po>"`,
    wiele pól w jednym żądaniu łączone `"; "` w **jeden** wpis. Etykiety po polsku, np.
    `"Zmiana czasu trwania wizyty (AUDIT): 120 → 150"`, `"Zmiana aktywności koszyka: true → false"`.
    Uwaga na `CHECK (length(btrim(justification)) >= 10)` — powyższy format zawsze go spełnia,
    ale „skrócenie" komunikatu przez implementera wywróci zapis.
  - `legalBasis: 'OTHER'` — to nie jest operacja na danych osobowych.
  - **Brak zmiany = brak wpisu.** Zapis tej samej wartości drugi raz nie tworzy drugiego wpisu
    (wzorzec `buildBaseLocationJustification` zwracający `null`).
  - Dialogu uzasadnienia w UI nadal **nie budujemy** — użytkownik nie wpisuje nic.
  - `createdAt` ustawia baza (`default now()` w UTC) — akcja nie podaje czasu.
- `revalidatePath('/settings/calendar')`.
- **NIE dotyka `bookings` ani jednym zapytaniem.** Żadnego `updateMany`, żadnego przeliczania
  `scheduled_end`, żadnego kasowania rezerwacji.

Bez `create` i bez `delete` w tym WO — uzasadnienie w „Poza zakresem".

### 2. `updateTravelBufferAction(input: { travelBufferMinutes: number })`

- Bramka: `can(actorRole,'system_config','update') !== 'yes'` (po zmianie kontraktu; **zależność
  twarda** — bez niej akcja odmawia wszystkim).
- Zod: `z.number().int().min(0).max(240)` — `min(0)` bo `parseTravelBufferMinutes` odrzuca ujemne,
  a 0 jest wartością legalną („bez bufora"); górna granica `240` — P-2, **wartość zostaje**.
- **Zapis musi być scaleniem (merge), nie podmianą całego JSONB.** Wiersz `scheduling_config`
  niesie także `default_workday_start`, `default_workday_end`, `default_weekdays`, czytane przez
  `packages/scheduling/src/effective-availability.ts:128-144`. Nadpisanie `konfiguracja`
  obiektem `{ travel_buffer_minutes: X }` skasowałoby domyślne okno pracy i wywróciłoby grafik
  każdemu pracownikowi bez własnych reguł. Rekomendowana realizacja: `jsonb_set` w `$executeRaw`
  (atomowo w bazie) albo odczyt+zapis w jednej transakcji `Serializable`. Wybór należy do
  implementera-server, ale **zachowanie pozostałych kluczy jest kryterium akceptacji, nie detalem**.
- **Wpis audytowy (ROZSTRZYGNIĘTE 2026-09-15, P-3: logować).** Każda faktyczna zmiana
  `travel_buffer_minutes` tworzy wpis w `audit_log`, **w tej samej transakcji** co zapis JSONB.
  Ta sama konwencja pól co wyżej, z dwiema różnicami wynikającymi z kształtu danych:
  - `resource: 'system_config'`
  - `recordId` — `id` wiersza `system_config` o `typ_konfiguracji = 'scheduling_config'`
    (kolumna `record_id` jest `TEXT`, więc `typ_konfiguracji` też by się zmieścił; **wybieramy `id`**,
    bo indeks `audit_log_resource_record_id_idx` ma wtedy tę samą semantykę co dla pozostałych
    zasobów: „co się działo z tym rekordem").
  - `justification`: `"Zmiana bufora dojazdu: 60 → 45"` (minuty, wartość stara i nowa; stara
    odczytana z JSONB **w tej samej transakcji**, nie z formularza — wartość z klienta może być
    nieaktualna po równoległym zapisie).
  - `operation: 'field_update'`, `legalBasis: 'OTHER'`, `actorEmail` fail-closed, `actorRole` z sesji.
  - Zapis tej samej wartości → brak zmiany → **brak wpisu**, ale też nie błąd.
  - Ten wpis jest jedyną odpowiedzią na „kto i kiedy zmienił bufor" — `system_config` nie ma
    kolumny `updated_at` (R-4).
  - **Ograniczenie zakresu:** logujemy wyłącznie `travel_buffer_minutes`. Klucze
    `default_workday_*` / `default_weekdays` ta akcja zachowuje bez zmian, więc nie ma dla nich
    czego logować.
- `revalidatePath('/settings/calendar')`.
- **NIE dotyka `bookings`.**

### Uzasadnienie pobierane od użytkownika (dialog) — NIE

Sprawdzone w `contracts/rbac.contract.mjs:144-156`: `AUDIT_REQUIREMENTS.mustLog` obejmuje
`delete`, `anonymize`, `role_change`, `contract_override`, `manual_status_change`,
`notification_resend`, `field_update`. Wzorzec „uzasadnienie + podstawa prawna" z
`deleteJustificationSchema` / `roleChangeSchema` dotyczy operacji na **danych osobowych i rolach**.
Tu zmieniamy parametr operacyjny słownika — żadne z 14 kryteriów akceptacji nie wspomina
o uzasadnieniu. **Dialogu uzasadnienia nie budujemy: użytkownik nie wpisuje ani słowa.**

Samego **wpisu** audytowego to nie dotyczy — P-3 rozstrzygnięte 2026-09-15 na TAK. `justification`
jest wyliczana przez serwer z wartości przed i po (wzorzec `FLD-BASE-LOCATION-EDIT`), a nie
pobierana z formularza. To dwie różne rzeczy i nie należy ich mylić.

---

## Ograniczenie nadrzędne (AC3 koszyków + AC5 bufora)

**Żadna z tych dwóch akcji nie ma prawa dotknąć tabeli `bookings`.**

Rezerwacja utrwala `scheduled_end` w chwili zawarcia
(`supabase/migrations/20260910100000_…sql:463`) i to jest cała odpowiedź na pytanie
„co z rezerwacjami po zmianie parametru": **nic**. Zmiana koszyka i zmiana bufora wpływają
wyłącznie na **wyliczanie nowych terminów**. Rezerwacja umówiona wczoraj na 120 minut zostaje
na 120 minut, nawet jeśli dziś koszyk ma 90.

To ograniczenie jest testowalne mechanicznie: patrz TC-B3 i TC-T5.

---

## Kryteria akceptacji przełożone na przypadki testowe

Testy trafiają do `apps/b2b-web/tests/`, nazewnictwo zgodne z istniejącym
(`scheduling-config-*.test.ts`), każdy przypadek tagowany `// @REQ: CAL-VISIT-DURATION-BASKETS`
albo `// @REQ: CAL-TRAVEL-BUFFER` — inaczej `node tools/kk-trace.mjs` nie zobaczy pokrycia.

### CAL-VISIT-DURATION-BASKETS

- [ ] **TC-B1 (AC1 — wartości edytowalne przez admina, żadnego literału)**
  `updateVisitDurationBasketAction` z rolą `admin` i `durationMinutes: 150` odczytuje po zapisie
  150 z bazy. Druga część: skan nowych plików (`settings/calendar/**`) nie zawiera literałów
  `120`, `90`, `240`, `480` jako wartości czasu trwania — wszystkie wartości pochodzą z `findMany`.
- [ ] **TC-B2 (AC2 — wybór z listy, nie wpisywanie godzin)**
  W tym WO weryfikowane **negatywnie**: ekran administracyjny nie jest ekranem wyceny, więc test
  sprawdza jedynie, że akcja nie przyjmuje czasu trwania per-rezerwacja (brak parametru
  `bookingId`). Pełne AC2 realizuje osobne wymaganie — patrz „Poza zakresem" i P-4.
- [ ] **TC-B3 (AC3 — zmiana nie przesuwa rezerwacji) — najważniejszy test tego WO**
  Atrapa Prismy: zarezerwuj koszyk 120 min, zmień koszyk na 240, sprawdź że
  (a) `booking.scheduledEnd` jest niezmienione, (b) w atrapie **nie padło ani jedno wywołanie**
  `booking.update` / `booking.updateMany` / `$executeRaw` dotykające `bookings` w trakcie akcji.
  Punkt (b) jest istotniejszy od (a): asercja na samym wyniku przeszłaby także przy implementacji,
  która próbuje przesuwać rezerwacje, ale akurat nie ma czego przesunąć.
- [ ] **TC-B4 (AC4 — wycofanie flagą, nigdy usunięciem)**
  (a) Akcja z `isActive: false` przełącza flagę i wiersz dalej jest zwracany przez `findMany`;
  (b) moduł akcji **nie eksportuje** żadnej funkcji usuwającej koszyk, a atrapa nie notuje
  wywołania `visitDurationBasket.delete`; (c) rezerwacja historyczna dalej rozwiązuje relację
  `visitBasket` po dezaktywacji.
- [ ] **TC-B5 (AC5 — pula spójna z przypisaniem)**
  Próba zmiany `pool` przez akcję (pole przemycone w wejściu) kończy się odmową albo
  zignorowaniem — `pool` w bazie niezmieniony. Uzasadnienie w R-2: trigger
  `bookings_pool_matches_basket_trg` pilnuje rezerwacji, nie koszyka, więc jedyną obroną jest
  zamknięta lista pól w Server Action.
- [ ] **TC-B6 (AC6 — wartości początkowe są DANYMI)**
  Test **nie zakłada**, że audyt trwa 120 min: czyta wartość ze słownika (atrapa zwraca 137),
  a UI/akcja operują na tej wartości. Test, który wpisuje `120` jako oczekiwanie, jest naruszeniem
  kryterium, nie jego sprawdzeniem.
- [ ] **TC-B7 (AC7 — minuty, liczba całkowita)**
  Zod odrzuca `90.5`, `"90"`, `0`, `-30`. Przelicznik „pół dnia / cały dzień" w UI wyliczany
  z wartości, nie porównywany do zaszytych `240`/`480`.
- [ ] **TC-B8 (AC8 — brak koszyka „montaż duży = 2 dni")**
  Moduł akcji nie eksportuje ścieżki tworzenia koszyka, a UI nie ma przycisku „Dodaj".
  Dodatkowo: test danych stwierdza, że w `visit_duration_baskets` nie ma wiersza o
  `durationMinutes > 480`. Powód jest architektoniczny (dwuetapowość `FNL-2PHASE-BOOKING`),
  nie kosmetyczny: taki koszyk zmusiłby silnik do szukania dwóch sąsiadujących wolnych dni.
- [ ] **TC-B9 (P-6 — ostatni aktywny koszyk w puli jest chroniony)**
  Pula `AUDITOR` ma **dokładnie jeden** aktywny koszyk. `updateVisitDurationBasketAction` z rolą
  `admin` i `isActive: false` na tym koszyku: (a) zwraca `{ success: false }` z niepustym `error`;
  (b) koszyk po akcji dalej ma `isActive: true`; (c) atrapa Prismy **nie notuje** wywołania
  `visitDurationBasket.update`. Cichy sukces bez zapisu jest tak samo błędny jak zapis — asercja
  na (a) jest obowiązkowa.
- [ ] **TC-B10 (P-6 — blokada nie jest szersza, niż trzeba)**
  Pula `CREW` ma dwa (lub więcej) aktywne koszyki. Wyłączenie jednego: `{ success: true }`,
  koszyk ma `isActive: false`, drugi nietknięty. Wariant dodatkowy: koszyk wyłączony ponownie
  **włączony** (`isActive: true`) przechodzi zawsze, także gdy pula była pusta — ograniczenie
  działa wyłącznie w kierunku `true → false`.
  Trzeci wariant: ostatni aktywny koszyk puli `AUDITOR` nie blokuje wyłączenia koszyka w puli
  `CREW` — pule liczone są osobno.
- [ ] **TC-B11 (P-3 — wpis audytowy dla koszyka)**
  Zmiana `durationMinutes` ze 120 na 150 przez `admin` tworzy **dokładnie jeden** wpis w `audit_log`
  z `operation: 'field_update'`, `resource: 'visit_duration_baskets'`, `recordId` = id koszyka,
  `actorEmail` = e-mail z sesji, `actorRole` = rola z sesji, `legalBasis: 'OTHER'`,
  `justification` zawierające **starą i nową wartość** (`120` i `150`), `createdAt` ustawione.
  Wariant: zmiana `durationMinutes` i `isActive` w jednym żądaniu daje **jeden** wpis z obiema
  zmianami rozdzielonymi `"; "` (nie dwa wpisy).
  Wariant transakcyjny: gdy `auditLog.create` rzuci, `visitDurationBasket.update` **nie jest
  utrwalony** — obie operacje w jednej transakcji.
- [ ] **TC-B12 (P-3 — brak zmiany to brak wpisu, i fail-closed na e-mailu)**
  (a) Zapis tej samej wartości (`durationMinutes` już równe 150) → `{ success: true }`, liczba
  wpisów w `audit_log` dla tego `recordId` **niezmieniona**;
  (b) brak e-maila w sesji (`auth.getUser()` zwraca `user: null`) → akcja zwraca błąd i **nie zapisuje
  ani koszyka, ani wpisu**.

### CAL-TRAVEL-BUFFER

- [ ] **TC-T1 (AC1 — wartość z `system_config`, edytowalna, bez literału 60)**
  Akcja zapisuje 45, silnik (`findAvailableSlots`) po odczycie zwraca `travel_buffer_minutes: 45`.
  Skan nowych plików: `60` nie występuje jako wartość domyślna ani zapasowa.
- [ ] **TC-T2 (AC2 — bufor między wizytami TEJ SAMEJ osoby)**
  Test silnika, już częściowo pokryty (`available-slots-engine-*`): wizyta innego pracownika
  w tym samym oknie nie zabiera slotu. W tym WO wystarczy potwierdzić brak regresji po zmianie
  wartości przez akcję.
- [ ] **TC-T3 (AC3 — bufor stosuje silnik, nie ograniczenie bazy)**
  Odmowa przychodzi z akcji rezerwującej (`createBooking` → `SLOT_NOT_OFFERED`), a nie jako
  wyjątek `bookings_no_overlap_per_resource`. Test asertuje **kod błędu**, nie sam fakt porażki.
- [ ] **TC-T4 (AC4 — wartość graniczna z konfiguracji, nie z testu)**
  Ustaw bufor akcją na wartość X, zarezerwuj wizytę, poproś o slot w odstępie `X - 1` minut →
  slot nieproponowany; w odstępie `X` → proponowany. Oczekiwanie liczone z X odczytanego
  z konfiguracji, nie z liczby wpisanej w teście.
- [ ] **TC-T5 (AC5 — zmiana bufora nie unieważnia rezerwacji) — bliźniak TC-B3**
  Po `updateTravelBufferAction` atrapa nie notuje ani jednego zapisu do `bookings`; istniejąca
  rezerwacja, która po nowym buforze „nachodziłaby" na sąsiada, **zostaje nietknięta**.
- [ ] **TC-T6 (AC6 — bufor per region świadomie poza zakresem)**
  Akcja i schemat Zod nie przyjmują parametru regionu; w `system_config` nie powstaje klucz
  `travel_buffer_by_region`. Test negatywny, chroniący przed rozlaniem zakresu.
- [ ] **TC-T7 (poza AC, wymuszone kształtem danych — patrz D-1)**
  Po `updateTravelBufferAction` klucze `default_workday_start`, `default_workday_end`,
  `default_weekdays` w `scheduling_config` **mają niezmienione wartości**. Bez tego testu pierwsza
  implementacja przez `update({ data: { konfiguracja: {...} } })` przejdzie wszystkie pozostałe
  kryteria i wywróci grafik.
- [ ] **TC-T8 (fail-closed nie zostaje osłabiony)**
  Zapisanie wartości przechodzącej przez Zod nie może obejść `parseTravelBufferMinutes`:
  po zapisie `0` silnik działa (0 to legalny brak bufora), a wiersz uszkodzony ręcznie
  (`travel_buffer_minutes: "abc"`) dalej daje `error`, nie fallback do 0.
- [ ] **TC-T9 (P-3 — wpis audytowy dla bufora)**
  Zmiana bufora z 60 na 45 tworzy dokładnie jeden wpis: `operation: 'field_update'`,
  `resource: 'system_config'`, `recordId` = id wiersza `scheduling_config`, `actorEmail`,
  `actorRole`, `legalBasis: 'OTHER'`, `justification` ze starą (`60`) i nową (`45`) wartością,
  `createdAt` ustawione. Wpis powstaje **w tej samej transakcji** co zapis JSONB: gdy
  `auditLog.create` rzuci, `travel_buffer_minutes` w bazie pozostaje `60`.
  Wariant odwrotny i równie ważny: gdy zapis JSONB rzuci, wpis audytowy **nie powstaje**
  (nie logujemy zmian, które nie zaszły — patrz pułapka 2 z CLAUDE.md, ta sama klasa błędu).
- [ ] **TC-T10 (P-3 — stara wartość czytana z bazy, nie z formularza; brak zmiany bez wpisu)**
  (a) Zapis wartości równej bieżącej → `{ success: true }`, liczba wpisów niezmieniona;
  (b) formularz przysyła „starą" wartość 60, a w bazie jest już 30 (ktoś zapisał równolegle) —
  `justification` mówi `30 → <nowa>`, nie `60 → <nowa>`. Wpis audytowy, który kłamie o stanie
  wyjściowym, jest gorszy niż jego brak.
- [ ] **TC-T11 (zależność migracyjna — CHECK bazy przyjmuje nowe zasoby)**
  Test integracyjny na bazie: `INSERT` do `audit_log` z `resource = 'system_config'`
  i z `resource = 'visit_duration_baskets'` **przechodzi**. Przed migracją rozszerzającą
  `audit_log_resource_check` ten test jest czerwony — i to jest jego cel: ma spaść wcześniej niż
  pierwszy prawdziwy zapis użytkownika.

### Bramki RBAC (wspólne)

- [ ] **TC-G1** Każda z dwóch akcji wywołana z rolą `dyspozytor`, `audytor`, `monter` i z **brakiem
  sesji** zwraca odmowę, a atrapa Prismy nie notuje **żadnego** wywołania. Kolejność ma znaczenie:
  bramka przed zapytaniem (wymóg `tools/kk-authz-gate.mjs`, kategoria `ordering`).
- [ ] **TC-G2** `/settings/calendar` dla nie-admina zwraca `notFound()`, nie pusty ekran.
- [ ] **TC-G3** `node tools/kk-authz-gate.mjs` przechodzi na nowym katalogu (obie akcje i strona
  mają `can()` przed pierwszym zapytaniem).

---

## Przypadki brzegowe, które MUSZĄ mieć test

1. **Scalanie JSONB (D-1)** — TC-T7. Największe ryzyko regresji w całym WO.
2. **Współbieżność zapisu bufora** — dwóch administratorów zapisuje jednocześnie. Przy read-modify-write
   w JS jeden zapis ginie wraz z resztą kluczy. Test: dwa równoległe wywołania, po obu wiersz ma
   komplet czterech kluczy, a `travel_buffer_minutes` równa się jednej z dwóch podanych wartości
   (nie wartości sprzed obu).
3. **Idempotencja** — zapis tej samej wartości drugi raz nie zmienia niczego i nie jest błędem
   (wzorzec „no-op bez zapisu" z `updateAuthorizedUserRoleAction:347-349`).
4. **Przemycone pola** — TC-B5: `pool`, `code`, `id` w tym samym żądaniu co `durationMinutes`.
5. **Dezaktywacja koszyka używanego przez przyszłą rezerwację** — rezerwacja zostaje, ale nowe
   terminy dla tego koszyka nie są proponowane (silnik już to robi). Test potwierdza jedno i drugie.
6. **Wartości graniczne** — `0`, `-1`, `90.5`, `"90"`, `null`, wartość ekstremalna (100000).
   Dla koszyków `0` jest niedozwolone (`CHECK > 0`), dla bufora `0` jest dozwolone. Ta asymetria
   jest łatwa do przeoczenia i musi mieć osobne asercje.
7. **Strefa czasowa** — żadna z akcji nie zapisuje czasu wywołania **jako parametru domeny**, więc
   DST i `Europe/Warsaw` są dla samych wartości bez znaczenia. Jedyny czas, jaki powstaje, to
   `audit_log.created_at` ustawiane przez bazę w **UTC** (`timezone('utc', now())`) — akcja nie
   podaje go z JS i nie konwertuje. Zapisano jawnie, żeby nikt nie dopisywał stref „na wszelki wypadek".
8. **Współbieżność blokady ostatniego koszyka (P-6)** — dwóch administratorów jednocześnie wyłącza
   dwa ostatnie aktywne koszyki tej samej puli. Przy sprawdzeniu `count` poza transakcją oba
   przejdą i pula zostanie pusta — czyli dokładnie to, przed czym blokada ma bronić. Test:
   dwa równoległe wywołania, po obu **co najmniej jeden** koszyk w puli ma `isActive: true`.
9. **Wpis audytowy a transakcja** — TC-B11 / TC-T9, oba kierunki: zapis bez wpisu i wpis bez zapisu
   są tak samo błędne.
10. **Odmowa nie loguje** — akcja odrzucona przez bramkę RBAC albo przez blokadę ostatniego koszyka
    **nie tworzy wpisu w `audit_log`**. Rejestr dokumentuje zmiany, nie próby.

---

## Poza zakresem

- **Tworzenie nowych koszyków (`create`) i usuwanie (`delete`).** RBAC daje adminowi oba
  uprawnienia, więc to nie jest blokada kontraktowa — to decyzja o zakresie. AC4 opisuje wyłącznie
  wycofywanie flagą, a AC8 nie zakazuje tworzenia w ogóle, tylko jednego konkretnego koszyka
  (2 dni) i to z powodu architektury silnika. Powód wyłączenia jest inny i prostszy: **`code` jest
  konsumowany przez kod** (silnik i przyszła wycena rozpoznają `AUDIT`, `INSTALL_PHASE_1`…),
  więc koszyk utworzony z UI z dowolnym `code` byłby martwym wierszem, którego nic nie wybierze.
  Sensowne `create` wymaga najpierw odpowiedzi, kto i jak przypisuje koszyk do rodzaju zlecenia.
  Do rozstrzygnięcia osobno (P-5).
- **Edycja `labelPl` i `sortOrder`** — technicznie trywialna, ale żadne AC jej nie wymaga.
  Dołożenie na życzenie, bez zmiany kontraktu.
- **Ekran wyceny audytora z wyborem koszyka (AC2 koszyków, pełne brzmienie)** i **oszacowanie
  w Triage** — to konsumenci słownika, nie jego administracja. Osobne wymaganie, osobny WO (P-4).
- **Edycja `default_workday_*` i `default_weekdays`** w tym samym ekranie. Kuszące (ten sam wiersz
  JSONB), ale to jest `FLD-AVAIL-*`, nie te dwa wymagania. Ten WO ma je wyłącznie **zachować**.
- **Bufor zależny od regionu** — wykluczony wprost przez AC6 bufora (model promieniowy,
  `CRM-REGION-AUTO`).
- **Sprzątanie atrap „Ogólne" / „Integracje (Stripe)"** w `SettingsClient.tsx`.
- **Zmiany w `packages/scheduling`** — silnik czyta obie wartości poprawnie i fail-closed.
  Jeśli implementer uzna, że musi go dotknąć, to sygnał, że coś poszło nie tak.

---

## Ryzyka i nieznane

- **R-1 (wysokie): jeden wiersz JSONB, dwóch konsumentów.** `scheduling_config` niesie bufor
  (`available-slots.ts`) i domyślne okno pracy (`effective-availability.ts`). Naiwny zapis kasuje
  połowę. Zaadresowane przez TC-T7, ale ryzyko wraca przy każdej kolejnej zmianie tego wiersza.
  Docelowo warto rozważyć rozbicie na kolumny albo osobne klucze `typ_konfiguracji` — **osobne
  zadanie, nie tutaj**.
- **R-2 (średnie): trigger pilnuje rezerwacji, nie koszyka.** `bookings_pool_matches_basket_trg`
  odpala się na INSERT/UPDATE `bookings`. Zmiana `pool` na istniejącym koszyku **nie jest
  blokowana przez bazę** i po cichu rozjeżdża rezerwacje już zawarte z ich pulą. Jedyną obroną
  jest brak `pool` na liście pól edytowalnych (TC-B5). Czy baza powinna to domykać ograniczeniem —
  osobna decyzja, poza tym WO.
- **R-3 (ZAADRESOWANE 2026-09-15): dezaktywacja wszystkich koszyków jednej puli.** Rozstrzygnięcie
  P-6: twarda blokada w Server Action (nie ostrzeżenie w UI), opis w „Server Actions" pkt 1,
  testy TC-B9 / TC-B10 i przypadek brzegowy 8. Pozostałość ryzyka: blokada żyje wyłącznie
  w kodzie aplikacji — baza nadal pozwoli opróżnić pulę zapytaniem SQL. Ograniczenie bazodanowe
  (np. trigger) to osobna decyzja, poza tym WO.
- **R-4 (ZAADRESOWANE 2026-09-15): brak `updated_at` w `system_config`.** Po rozstrzygnięciu P-3
  odpowiedź „kto i kiedy zmienił bufor" daje wpis `audit_log` (TC-T9). Kolumny `updated_at`
  nadal nie dodajemy — byłaby drugim, słabszym źródłem tej samej prawdy.
- **R-6 (nowe, wysokie do czasu migracji): `audit_log_resource_check` odrzuca oba nowe zasoby.**
  Zweryfikowane na żywej bazie 2026-09-15. Dopóki `contract-steward` nie rozszerzy ograniczenia,
  **każda** zmiana koszyka i bufora kończy się wyjątkiem bazy — nie cichym pominięciem wpisu,
  tylko wywróceniem całej akcji (wpis jest w tej samej transakcji). To zależność blokująca dla
  obu Server Actions, nie tylko dla testów audytowych.
- **R-5 (niskie): odczyt konfiguracji przy każdym wyliczaniu slotów.** Zmiana bufora działa
  natychmiast dla nowych zapytań, ale strony renderowane w cache Next.js mogą pokazywać stare
  sloty do `revalidatePath`. Do potwierdzenia przy implementacji UI.

---

## Pytania otwarte — stan po decyzji człowieka z 2026-09-15

### Rozstrzygnięte (nie wracamy do nich)

- **P-1 — ROZSTRZYGNIĘTE 2026-09-15: TAK, dopisać zasób.** `contract-steward` dopisuje
  `system_config` do `RESOURCES` i do `MATRIX` z `update: ['admin']` (`read: ['admin']`,
  `create`/`delete` puste) w oknie kontraktowym `CAL-SCHEDULING-CONFIG-RBAC`. Alternatywa
  z przepięciem pod `visit_duration_baskets:update` **odrzucona**. Skutek dla WO: bramka
  `updateTravelBufferAction` to `can(actorRole,'system_config','update')` i nic innego.
- **P-3 — ROZSTRZYGNIĘTE 2026-09-15: TAK, logować.** Zmiany `durationMinutes` / `isActive`
  na koszyku i zmiany `travel_buffer_minutes` tworzą wpisy `field_update` w `audit_log`,
  w konwencji pól z `auditors/actions.ts` (patrz „Server Actions"). Wyciągnięta konsekwencja,
  której pytanie nie obejmowało: **wymagana migracja rozszerzająca `audit_log_resource_check`**
  (R-6) — bez niej akcje w ogóle nie zadziałają.
- **P-6 — ROZSTRZYGNIĘTE 2026-09-15: TAK, blokować (twardo, nie ostrzeżeniem).** Wyłączenie
  ostatniego aktywnego koszyka w puli kończy się odmową z komunikatem. Opis w „Server Actions"
  pkt 1, testy TC-B9 / TC-B10, współbieżność w przypadku brzegowym 8.

### Świadomie NIEROZSTRZYGNIĘTE — to nie jest przeoczenie

- **P-2 — zostaje bez decyzji, bo nie blokuje.** Górne granice `durationMinutes.max(960)`
  i `travelBufferMinutes.max(240)` **zostają** jako moja propozycja (sanity, nie kontrakt).
  Baza wymusza jedynie `duration_minutes > 0`. Jeżeli kiedyś okaże się, że firma potrzebuje
  koszyka dłuższego niż 960 minut, to zmiana jednej liczby w Zod, a nie przeprojektowanie.
- **P-4 — POZA ZAKRESEM tego WO, gap znany i dziś nierozwiązany.** Ekran wyceny z wyborem koszyka
  (pełne brzmienie AC2 koszyków) nie powstaje tutaj. Dziś `visitBasketId` przyjmuje wyłącznie
  `bookings/actions.ts:31`, a żaden komponent go nie ustawia. **AC2 koszyków pozostanie po tym WO
  spełnione tylko częściowo** (TC-B2 weryfikuje je negatywnie) — to jest stan zamierzony i przyjęty,
  nie niedoróbka do wykrycia w przeglądzie. Domknięcie wymaga osobnego wymagania i osobnego WO.
- **P-5 — POZA ZAKRESEM tego WO.** Tworzenie nowych koszyków przez UI nie powstaje; ten ekran
  edytuje **wyłącznie istniejące** koszyki (`durationMinutes`, `isActive`). Powód w „Poza zakresem":
  `code` jest konsumowany przez kod, więc koszyk utworzony z UI byłby martwym wierszem. Decyzja
  „czy kiedykolwiek" pozostaje otwarta i nie jest warunkiem startu GREEN.

---

## Kolejność wykonania

1. `contract-steward` — P-1: zasób `system_config` w RBAC + `node tools/kk-codegen.mjs`
   (okno kontraktowe `CAL-SCHEDULING-CONFIG-RBAC`; **bez migracji i bez `schema.prisma`**).
   W toku równolegle do tego WO.
2. `contract-steward` — P-3/R-6: migracja rozszerzająca `audit_log_resource_check`
   o `'visit_duration_baskets'` i `'system_config'` (okno kontraktowe; **bez `schema.prisma`**).
3. `test-author` — testy z sekcji „Kryteria akceptacji", tagowane `// @REQ:`.
4. `implementer-server` — `actions.ts` + schematy Zod.
5. `implementer-ui` — `page.tsx`, `CalendarSettingsClient.tsx`, pozycja w `layout.tsx`.
6. `bash scripts/verify.sh --full` + `node tools/kk-trace.mjs`.

Punkt 1 jest twardą zależnością wyłącznie dla `CAL-TRAVEL-BUFFER`.
**Punkt 2 jest twardą zależnością dla OBU wymagań** — po rozstrzygnięciu P-3 obie akcje piszą
do `audit_log` w tej samej transakcji, więc przed tą migracją żadna z nich nie zapisze niczego.
To zmienia wcześniejsze ustalenie, że koszyki można prowadzić równolegle od razu: implementacja
serwerowa koszyków startuje dopiero po punkcie 2. UI i testy mogą powstawać wcześniej.
