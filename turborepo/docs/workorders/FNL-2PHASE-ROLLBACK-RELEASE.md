# WO: FNL-2PHASE-ROLLBACK-RELEASE — rollback po zamkniętym etapie I zwalnia rezerwację etapu II

## Wymagania: FNL-2PHASE-ROLLBACK-RELEASE (TODO, risk MEDIUM)

Kryteria z rejestru (`contracts/requirements.contract.mjs:169`), dosłownie:

1. „T13 (AWAITING_INSTALLATION -> ROLLBACK_RESCHEDULING) jest legalne również wtedy, gdy etap I jest już zamknięty"
2. „Rollback przełącza rezerwację etapu II na RELEASED — dziś `releaseCrewSlot` nie wie o `installation_phases` i rezerwacja etapu II zostaje aktywna, blokując podmiot przez `bookings_one_active_per_subject`"
3. „Rollback NIE kasuje `completed_at` etapu I: praca wykonana nie odwraca się przez przełożenie terminu"

Kontekst pochodzenia: brzeg 7 WO `FNL-2PHASE-BOOKING-MECHANICS`, wyniesiony 2026-09-16 przy zamykaniu `FNL-2PHASE-BOOKING` (FNL-ROLLBACK jest DONE od 2026-09-08 i luka nie miała gdzie zamieszkać).

---

## Kontekst kodu (stan zmierzony 2026-09-16)

### Istnieje

- `apps/b2b-web/src/app/(dashboard)/logistics/rollback-effects.ts`
  - `releaseCrewSlot(tx, leadId)` — **jedyna** funkcja zwalniania zasobów przy rollbacku. Robi dokładnie dwie rzeczy:
    `SELECT id FROM instalacje WHERE lead_id = $1 AND status = 'PLANNED' FOR UPDATE`, a następnie per wiersz
    `zespol_id = null`, `data_planowana = null`, `status = CANCELLED`.
    **Nie dotyka tabeli `bookings` w ogóle** i nie zna `installation_phases`. Blokada `FOR UPDATE` poprzedza mutację (pułapka 4 z CLAUDE.md), filtr `status = 'PLANNED'` jest częścią zapytania blokującego (BLOCKER 1 z review LOGISTICS-SHIPPING-EFFECTS — nie wolno go zdjąć).
  - `suspendLogisticsSla(tx, leadId)` — `logistics_sla_paused_at` ustawiany tylko gdy `null` (idempotencja), `data_rezerwacji` zerowana zawsze.
  - `enqueueNotification(tx, params)` — kolejka w tej samej transakcji, identyfikator powiadomienia z katalogu, nigdy literał.
  - Moduł świadomie **nie ma** `"use server"` — brak wpisu w `server-reference-manifest.json`, więc żadnej z tych funkcji nie da się wywołać z przeglądarki. Nowy kod MUSI zostać w tym module (albo w innym module bez `"use server"`), inaczej ta właściwość zniknie.
- `apps/b2b-web/src/app/(dashboard)/logistics/actions.ts`
  - `rollbackLogisticsOrder(leadId, reason)` — jedyny wywołujący. Kolejność: `can(role,'leads','update')` **i** `can(role,'shipments','update')` → e-mail aktora → walidacja uzasadnienia (`deleteJustificationSchema`) → fail-fast na statusie → `$transaction`: `SELECT ... FOR UPDATE` na `leady` → ponowny odczyt statusu → gałąź idempotencji (lead już w `ROLLBACK_RESCHEDULING`: **same efekty, bez zmiany statusu i bez wpisu audytowego**) → `leady.update` → `audit_log` (`manual_status_change`) → `releaseCrewSlot` → `suspendLogisticsSla` → kolejkowanie efektów z `transition.effects` z filtrem prefiksu `do:`.
  - Wywołujący UI: `logistics/logistics-client.tsx:380` i `leads/leads-client.tsx:660` — obie ścieżki trafiają w tę samą Server Action.
- `apps/b2b-web/src/app/(dashboard)/installations/two-phase-actions.ts` — wzorzec stylu do naśladowania: rola przed jakimkolwiek zapytaniem, `FOR UPDATE` na `instalacje` przed odczytem `installation_type`, `ACTIVE_BOOKING_STATUSES = ["RESERVED","CONFIRMED"]`, `tx.booking.update({ data: { status: ... } })` w tej samej transakcji, `installationPhase` adresowany przez klucz złożony `installationId_phaseNumber`.
- Schemat (istnieje, migracja `20260916060000` uruchomiona i zweryfikowana na żywej bazie):
  `instalacje.installation_type` (`SINGLE_PHASE` | `TWO_PHASE` | NULL, CHECK), `installation_phases(installation_id, phase_number, booking_id, completed_at)` z `UNIQUE(installation_id, phase_number)` i częściowym `UNIQUE(booking_id) WHERE booking_id IS NOT NULL`, `bookings.status` CHECK `RESERVED|CONFIRMED|RELEASED|COMPLETED`, częściowy indeks `bookings_one_active_per_subject`.
- Konwencja zwalniania rezerwacji w repo: **nie ma funkcji `releaseBooking`**. Zwalnianie to wprost `status = 'RELEASED'` na wierszu `bookings` (`create-booking-concurrency.itest.ts:622` — stary wiersz na `RELEASED` **przed** wstawieniem nowego; `reassign-booking.ts:24` traktuje `RELEASED`/`COMPLETED` jako nieaktywne). Nie ma kolumny `released_at` i nie wolno jej wymyślać.

### Brakuje

- Jakiegokolwiek powiązania rollbacku z `bookings` — po rollbacku aktywna rezerwacja etapu II (`RESERVED`/`CONFIRMED`) zostaje i przez `bookings_one_active_per_subject` uniemożliwia zarezerwowanie nowego terminu dla tego samego leada (`SQLSTATE 23505` → `SUBJECT_ALREADY_BOOKED`).
- Testu wymuszającego to zachowanie. `apps/b2b-web/tests/logistics-rollback-effects.test.ts` nie modeluje ani `booking`, ani `installationPhase` w swoim stanowym dublu — dziś nic nie zapaliłoby się po naprawie ani po jej cofnięciu.

### Ustalone, a nie zakładane

- **T13 nie ma dziś żadnego guardu.** `contracts/funnel.contract.mjs:171`: `{ id: 'T13', from: 'AWAITING_INSTALLATION', to: 'ROLLBACK_RESCHEDULING', action: 'rollback', actor: 'CLIENT', trigger: 'CLIENT_ACTION', guards: [], effects: ['N_ROLLBACK','I4','do:releaseCrewSlot','do:suspendLogisticsSla'], req: ['FNL-ROLLBACK'], status: 'STABLE' }`. Zamknięcie etapu I nie zmienia statusu leada (T17 to pętla własna `AWAITING_INSTALLATION -> AWAITING_INSTALLATION`), więc `findTransition('AWAITING_INSTALLATION','rollback')` trafia w T13 niezależnie od stanu etapów. **Kryterium 1 jest już spełnione w kontrakcie i w kodzie — wymaga testu regresyjnego, nie zmiany.**
- Druga maszyna stanów **nie jest** tu ścieżką: `advanceLeadStatus` ma T10–T13 usunięte z `ALLOWED_TRANSITIONS` (decyzja człowieka 2026-09-07, FNL-ADVANCE-STATUS-CONTRACT-BOUND) — `ROLLBACK_RESCHEDULING` przez tamtą funkcję kończy się twardą odmową. Jedynym wejściem w rollback jest `rollbackLogisticsOrder`.

---

## Zmiana kontraktu

**NIEWYMAGANA.**

- Kryterium 1: T13 ma `guards: []` — nie ma czego odblokowywać.
- Efekt `do:releaseCrewSlot` już jest na T13; rozszerzenie zakresu tego efektu jest zmianą implementacji efektu, nie jego deklaracji.
- `installation_phases`, `instalacje.installation_type` i `bookings.status = 'RELEASED'` istnieją w schemacie i w CHECK-ach. Nie ma nowej kolumny, nowego enuma ani nowej migracji.

**Zależność dla `contract-steward`: brak.** Jeżeli podczas realizacji okaże się, że potrzebna jest nowa kolumna albo nowy status rezerwacji — to sygnał, że projekt zjechał z tego WO; zatrzymać i wrócić po decyzję.

Uwaga do domknięcia wymagania (dla tego, kto będzie aktualizował rejestr): `note` przy ID powinien odnotować, że kryterium 1 zostało domknięte **testem regresyjnym na już istniejącym zachowaniu**, a nie zmianą — inaczej przy następnym czytaniu wygląda jak praca, której nie było.

---

## Kryteria akceptacji (wykonalne)

Odwzorowanie: AC1 ← kryterium 1, AC2–AC5 ← kryterium 2, AC6–AC7 ← kryterium 3, AC8–AC9 ← poprawność transakcyjna.

- [ ] **AC1** (kryt. 1): dla leada w `AWAITING_INSTALLATION`, którego instalacja ma `installation_type = 'TWO_PHASE'` i `installation_phases(phase_number=1).completed_at` **niepuste**, `rollbackLogisticsOrder` kończy się `{ success: true }`, a lead jest w `ROLLBACK_RESCHEDULING`. Zamknięty etap I niczego nie blokuje.
- [ ] **AC2** (kryt. 2, sedno): w tym samym przebiegu rezerwacja wskazana przez `installation_phases(phase_number=2).booking_id`, będąca przed rollbackiem w `RESERVED` albo `CONFIRMED`, po rollbacku ma `status = 'RELEASED'`.
- [ ] **AC3** (kryt. 2, skutek praktyczny): po rollbacku lead **nie ma żadnej rezerwacji w `RESERVED`/`CONFIRMED`** wynikającej z etapu II, więc `createBooking` dla tego samego podmiotu nie zwraca już `SUBJECT_ALREADY_BOOKED`. To jest obserwowalna istota kryterium — asercja wyłącznie na kolumnie `status` bez tego przebiegu zostawia otwartą furtkę.
- [ ] **AC4** (zawężenie): rollback **nie** zwalnia rezerwacji, która nie należy do etapu II tej instalacji — rezerwacja innego leada w tym samym oknie czasowym pozostaje nietknięta.
- [ ] **AC5** (idempotencja): drugie wywołanie `rollbackLogisticsOrder` dla tego samego leada (gałąź „lead już w `ROLLBACK_RESCHEDULING`") wykonuje zwolnienie ponownie **bez błędu** i nie zmienia już niczego — rezerwacja etapu II pozostaje `RELEASED`, `logistics_sla_paused_at` nie przesuwa się, nie powstaje drugi wpis `audit_log`, nie powstaje drugi komplet wierszy kolejki (klucz idempotencji `rollback:<leadId>:<notificationId>:<kanał>`).
- [ ] **AC6** (kryt. 3): po rollbacku `installation_phases(phase_number=1).completed_at` ma **tę samą wartość** co przed rollbackiem, a `booking_id` etapu I wskazuje wciąż tę samą rezerwację ze statusem `COMPLETED`. Praca wykonana nie cofa się.
- [ ] **AC7** (kryt. 3): po rollbacku **oba** wiersze `installation_phases` nadal istnieją (rollback nie kasuje etapów i nie tworzy ich od nowa).
- [ ] **AC8** (transakcyjność): zwolnienie rezerwacji etapu II dzieje się na tym samym obiekcie `tx`, co zmiana statusu leada i wpis audytowy (wzorzec `lastTx`/`__txId` z `logistics-rollback-effects.test.ts`). Wyjątek w dowolnym kroku pozostawia stan sprzed rollbacku w całości: lead w `AWAITING_INSTALLATION` **i** rezerwacja etapu II wciąż aktywna.
- [ ] **AC9** (współbieżność): `SELECT ... FOR UPDATE` na wierszu rezerwacji etapu II poprzedza jej mutację, tak jak dziś dla `instalacje`. Dwa równoległe rollbacki tego samego leada dają dokładnie jedno przejście `RESERVED -> RELEASED`, drugi kończy się sukcesem bez drugiej mutacji.
- [ ] **AC10** (montaż jednoetapowy bez regresji): dla leada, którego instalacja ma `installation_type = 'SINGLE_PHASE'` albo `NULL`, rollback zachowuje się **dokładnie tak jak dziś** — zero zapytań o `installation_phases`, zero mutacji `bookings`. Cały istniejący zestaw `logistics-rollback-effects.test.ts` przechodzi bez zmian w asercjach.

### Szkic projektu (do zweryfikowania przez implementera, nie do przepisania bezmyślnie)

Rozszerzyć `releaseCrewSlot` **albo** dodać obok niej `releasePhaseTwoBooking(tx, leadId)` wołaną z `rollbackLogisticsOrder` bezpośrednio po `releaseCrewSlot`, w tym samym `tx`. Drugi wariant jest preferowany: zachowuje jednoznaczność istniejącej funkcji i jej testów, a nowe zachowanie ma własną, nazwaną jednostkę. Kroki:

1. znaleźć instalacje leada z `installation_type = 'TWO_PHASE'` (uwaga: **nie** filtrować po `instalacje.status` — patrz D2 poniżej i kolejność wywołań),
2. odczytać `installation_phases` z `phase_number = 2` i `booking_id IS NOT NULL`,
3. `SELECT ... FOR UPDATE` na tym wierszu `bookings`, sprawdzić `status IN ('RESERVED','CONFIRMED')`,
4. `status = 'RELEASED'`. `installation_phases.booking_id` **zostaje** (ślad historyczny; `bookPhaseTwoAction` nadpisze go przy ponownej rezerwacji i częściowy `UNIQUE` się wtedy zwolni),
5. niczego nie robić z etapem I.

Pułapka kolejności: `releaseCrewSlot` ustawia `instalacje.status = CANCELLED`, więc jeżeli nowa logika miałaby filtrować instalacje po `status = 'PLANNED'`, kolejność wywołań decydowałaby o wyniku. Nie filtrować po statusie instalacji.

Dług nazewniczy (KK-NAMING-BASELINE): `instalacje` eksponuje `lead_id`, `Booking` — `leadId`. Czytać defensywnie, tak jak `two-phase-actions.ts`.

---

## Przypadki brzegowe, które MUSZĄ mieć test

1. **Etap II nigdy nie zarezerwowany** — `installation_phases(2).booking_id IS NULL`. Rollback kończy się sukcesem, zero mutacji `bookings`.
2. **Rezerwacja etapu II już `RELEASED`** (poprzedni rollback albo przełożenie) — rollback nie rzuca, nie ustawia `RELEASED` po raz drugi, nie tworzy szumu.
3. **Rezerwacja etapu II w `COMPLETED`** — etap II faktycznie się odbył. **Nie ruszać.** `COMPLETED -> RELEASED` byłoby skasowaniem faktu wykonanej pracy, czyli tym samym błędem co kasowanie `completed_at`.
4. **Rollback PRZED zamknięciem etapu I** (`completed_at IS NULL`, rezerwacja etapu I aktywna, rezerwacja etapu II nie istnieje) — patrz D1. Test musi utrwalić wybraną odpowiedź, bo dziś ten przebieg zostawia aktywną rezerwację etapu I i blokuje podmiot tak samo.
5. **Podwójny rollback (idempotencja)** — AC5, gałąź „lead już w `ROLLBACK_RESCHEDULING`".
6. **Dwa równoległe rollbacki** — AC9, serializacja przez `FOR UPDATE`, nie przez sprawdzenie w JS.
7. **Uprawnienia** — rola bez `leads:update` lub bez `shipments:update` dostaje odmowę i **żadna** rezerwacja nie zmienia statusu. Monter i audytor są poza `/logistics` całkowicie (SEC-RLS-AUDITOR-SCOPE D4).
8. **Brak wiersza instalacji dla leada** — rollback kończy się sukcesem, nowa ścieżka nie rzuca na `undefined`.
9. **Lead z dwiema instalacjami**, jedną `TWO_PHASE` i jedną `SINGLE_PHASE` — zwalniany jest wyłącznie etap II tej pierwszej.
10. **Wyjątek w trakcie** (np. kolizja na kolejce powiadomień) — AC8, rollback całej transakcji, rezerwacja etapu II wraca do stanu aktywnego.
11. **Strefa czasowa / godziny wysyłki** — nie dotyczy: nowa ścieżka nie czyta ani nie zapisuje żadnego znacznika czasu. Brak asercji na czas jest tu decyzją, nie przeoczeniem.

---

## Poza zakresem

- **Faktura, protokół odbioru, płatności, Field App, upload zdjęć** — `FNL-2PHASE-INVOICE`, odłożone do ADR-013.
- **Zwalnianie rezerwacji przy rollbacku dla montażu jednoetapowego i dla etapu I** — patrz D1; dopóki nie ma decyzji, zakres tego WO kończy się na etapie II.
- **Naprawa `advanceLeadStatus` jako maszyny stanów** — `FNL-ADVANCE-STATUS-CONTRACT-BOUND`.
- **Ścieżka klienta do T13.** Kontrakt mówi `actor: 'CLIENT'`, `trigger: 'CLIENT_ACTION'`, a w repozytorium jedyną drogą jest Server Action dyspozytora (`can(role,'leads','update')`). Rozjazd jest STARSZY niż to WO i nie powstał tutaj — nie zamykać go przy okazji, ale też nie udawać, że go nie ma (patrz Ryzyka).
- **Powrót z bucketu (T14) i ponowna rezerwacja etapu II** — osobny przebieg; to WO kończy się na tym, że nowa rezerwacja jest **możliwa** (AC3), nie na jej wykonaniu.
- **Zmiana `installation_type` po zamknięciu etapu I** — otwarte przy `FNL-2PHASE` kryt. 2.
- **Rozstrzyganie statusu `instalacje` dla instalacji dwuetapowej po rollbacku** — patrz D2.

---

## Ryzyka i nieznane

- **D1 — WYMAGA DECYZJI CZŁOWIEKA (nie blokuje startu, blokuje domknięcie brzegu 4).** Kryterium 2 mówi wyłącznie o etapie II, ale ten sam mechanizm (`bookings_one_active_per_subject`) blokuje podmiot także wtedy, gdy przy rollbacku aktywna zostaje rezerwacja etapu I albo jedyna rezerwacja montażu jednoetapowego. Dziś **rollback nie zwalnia żadnej rezerwacji `bookings`** — ta sama klasa błędu jest szersza niż to wymaganie. Dwa warianty:
  (a) **wąski** — zwalniamy wyłącznie rezerwację wskazaną przez `installation_phases(2).booking_id`. Zgodny z literalnym brzmieniem kryterium, mały zakres testów, zostawia znaną dziurę dla montażu jednoetapowego;
  (b) **ogólny** — rollback zwalnia **każdą** aktywną (`RESERVED`/`CONFIRMED`) rezerwację podmiotu `LEAD`. Domyka całą klasę, ale dotyka przebiegów, których to wymaganie nie opisuje (np. rezerwacja o koszyku audytowym wisząca na leadzie), i bez osobnego ID nie ma gdzie zapisać pokrycia.
  Rekomendacja analityka: (a) w tym WO, (b) jako nowe ID `FNL-ROLLBACK-BOOKING-RELEASE`. Decyzja należy do człowieka — WO jest wykonalny w wariancie (a) od razu.
- **D2 — do potwierdzenia.** `releaseCrewSlot` ustawia `instalacje.status = CANCELLED` dla wierszy `PLANNED`. Dla instalacji `TWO_PHASE` z zamkniętym etapem I oznacza to instalację „anulowaną", która ma za sobą wykonaną pracę. `completed_at` i wiersze etapów przeżywają (AC6/AC7 to gwarantują), więc kryterium 3 jest formalnie spełnione, ale semantyka statusu jest wątpliwa. Dodatkowo `assignCrewToLead` przy powrocie z bucketu **reużywa** ten sam wiersz (`findFirst({ where: { lead_id } })`, bez filtra statusu) i ustawia tylko `zespol_id` — instalacja zostaje `CANCELLED` na stałe. Czy dwuetapowa instalacja z zamkniętym etapem I ma przy rollbacku wracać do `PLANNED` (zerowanie `zespol_id`/`data_planowana` bez `CANCELLED`)? Nie rozstrzygam — to zmiana zachowania chronionego testem „BLOCKER-1" z LOGISTICS-SHIPPING-EFFECTS.
- **Rozjazd aktora T13.** Kontrakt: `actor: 'CLIENT'`, `trigger: 'CLIENT_ACTION'`. Kod: wyłącznie dyspozytor/admin przez `rollbackLogisticsOrder`, z wymaganym uzasadnieniem i wpisem `manual_status_change` (T13 ma `trigger: 'MANUAL'`? — **nie ma**, ma `CLIENT_ACTION`, a mimo to `rollbackLogisticsOrder` bezwarunkowo tworzy wpis `manual_status_change`). Jeżeli klasyfikator wpisów audytowych zostanie kiedyś związany z `trigger`/`manualEquivalent`, ten przebieg się zmieni. Zgłoszone, nie naprawiane tutaj.
- **Efekt `do:releaseCrewSlot` nie jest sprawdzany co do treści.** Wszystkie miejsca wykonujące efekty filtrują prefiks `do:` — usunięcie `do:releaseCrewSlot` z T13 nie zapali dziś żadnego testu (ten sam dług, co `do:openPhaseTwoBooking` przy FNL-2PHASE-BOOKING). Testy tego WO muszą więc celować w **obserwowalny skutek na danych**, nigdy w obecność napisu w `effects`.
- **Testy integracyjne na żywym Postgresie (`*.itest.ts`) mogą nie dać się uruchomić** — przy zamykaniu FNL-2PHASE-BOOKING brakowało Dockera. Jeżeli AC3 (brak `SUBJECT_ALREADY_BOOKED` po rollbacku) da się dowieść tylko integracyjnie, a przebieg nie zostanie wykonany, **nie domykać wymagania** — odnotować to jak przy `fnl-2phase-db-constraints.itest.ts`, zamiast uznawać za pokryte. Precedens: odmowa domknięcia `CAL-SLOT-ENGINE` z 2026-09-16.
