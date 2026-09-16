# WO: FNL-2PHASE-BOOKING-MECHANICS — mechanika rezerwacji montażu dwuetapowego (bez dokumentów i płatności)

**Status:** GOTOWY DO OKNA KONTRAKTOWEGO. **D1, D2, D3 rozstrzygnięte przez Michała 2026-09-16** — patrz sekcja „Decyzje rozstrzygnięte”. Nic już nie blokuje RED.

**Zakres zawężony decyzją Michała z 2026-09-16 (dwie warstwy zawężenia):**

1. `FNL-2PHASE-BOOKING` dzieli się na *mechanikę rezerwacji* (ten WO) i *dokumenty/płatności* (odłożone, `FNL-2PHASE-INVOICE`). Kryterium 7 z rejestru NIE jest realizowane tutaj.
2. **D3 zawęża ten WO drugi raz i mocniej:** budujemy **wyłącznie mechanikę rezerwacji w panelu B2B**. Dyspozytor lub administrator zamyka etap I i otwiera rezerwację etapu II tam, gdzie panel **już istnieje**.

> **Granica zakresu, która nie podlega interpretacji.**
> Docelowy przepływ opisany przez Michała (monter kończy montaż w Field App, dokumentuje zdjęciami, klient dostaje protokół odbioru, fakturę i link do etapu II) jest **w pełni odłożony**. Wymagałby czterech osobnych, dużych podsystemów, z których **żaden nie istnieje**: aplikacji mobilnej Field App, uploadu zdjęć, generowania PDF, integracji płatności.
> **Nie budujemy dziś żadnego z tych czterech — nawet w formie zalążkowej, nawet „na zapas”, nawet jako pustego pola w tabeli.** To nie jest „zrób mechanikę, UI dołóż potem”. To jest: **zrób wyłącznie to, co jest reprezentowalne w panelu B2B**. Cała reszta to osobny, przyszły projekt, wymagający własnego ADR-013 i własnej serii decyzji.
> Jeżeli podczas implementacji pojawi się pokusa dodania kolumny `photo_url`, `protocol_pdf`, `payment_status` albo ekranu dla montera — **to jest sygnał wyjścia poza zakres, nie usprawnienie**.

---

## Wymagania

| ID | Rola w tym WO |
|---|---|
| `FNL-2PHASE-BOOKING` | **wymaganie wiodące**, kryteria 1–6 (`contracts/requirements.contract.mjs:160`) |
| `FNL-2PHASE` | **nadrzędne, ZERO pokrycia** (`contracts/requirements.contract.mjs:159`). Ten WO realizuje jego kryterium 3 („TWO_PHASE tworzy dwa rekordy installation_phases”), dostarcza nośnik danych dla kryteriów 4–5 (guardy) i **przepisuje jego kryterium 2** na istniejący nośnik (D1 → `instalacje.installation_type`, patrz „Zmiana kontraktu” C.1). Kryterium 1 (`leads.declared_property_condition`) zostaje otwarte — patrz „Poza zakresem” |
| `FNL-2PHASE-INVOICE` | **ISTNIEJE JUŻ W REJESTRZE** (`contracts/requirements.contract.mjs:161`, status `TODO`, `MEDIUM`). Nie tworzymy nowego wpisu — dopisujemy do niego kryterium 7 z `FNL-2PHASE-BOOKING`. Odłożone |
| `FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT` | **zależność twarda**, nie kosmetyczna — indeks `bookings_one_active_per_subject` rozstrzyga, czy etap II w ogóle da się zarezerwować (patrz AC3) |
| `CAL-SLOT-ENGINE`, `FLD-BOOKING-ATOMIC-ASSIGN` | fundament rezerwacji, gotowy — nie zmieniamy go |
| `SRV-NEXT-DATE` | **nie zamyka się tym WO.** `next_service_date` liczy się od etapu II (ADR-005, `docs/01-ADR-spec-conflicts.md:92`). Tu tylko nie psujemy: zamknięcie etapu I NIE ustawia `next_service_date` |

---

## Kontekst kodu

### Istnieje (zweryfikowane, nie z pamięci)

**Kontrakt lejka — nazwy JUŻ SĄ, nic nie trzeba wymyślać:**
- `contracts/funnel.contract.mjs:181-188` — przejście `T17`, pętla własna `AWAITING_INSTALLATION → AWAITING_INSTALLATION`, `action: 'completePhaseOne'`, `actor: 'INSTALLER'`, `trigger: 'MANUAL'`, `guards: ['installationIsTwoPhase', 'phaseOneNotCompleted']`, `effects: ['N8a', 'do:issuePhaseOneInvoice', 'do:openPhaseTwoBooking']`, `req: ['FNL-2PHASE']`, `status: 'STABLE'`.
- `contracts/funnel.contract.mjs:58-59` — oba guardy zdefiniowane w słowniku guardów.
- **Efekt `do:openPhaseTwoBooking` ISTNIEJE jako nazwa w kontrakcie.** Zmiana `funnel.contract.mjs` NIE jest potrzebna po to, żeby ten efekt zaistniał. Potrzebna jest po to, żeby `T17.req` wskazywało też `FNL-2PHASE-BOOKING` — dziś wskazuje wyłącznie `FNL-2PHASE`, więc `kk-trace` nigdy nie policzy testu `T17` na poczet wymagania o rezerwacjach.
- `contracts/funnel.contract.mjs:188` — `note` na `T17`: *„Ekipa zamyka etap I w mieszkaniu deweloperskim. Klient dostaje fakturę za etap I i link do rezerwacji etapu II.”* To opis **docelowego** przepływu (Field App + faktura), nie tego WO. Nota zostaje bez zmian jako opis celu.

**Mechanizm, który rozstrzyga D3 bez wymyślania niczego nowego — `manualEquivalent`:**
- `contracts/funnel.contract.mjs:63-90` — klasyfikator „ręcznej zmiany statusu”. **Kryterium K1:** *„aktor przejścia to CLIENT / SYSTEM / INSTALLER / AUDITOR, a wykonuje je operator panelu B2B”* → wpis `manual_status_change` w `audit_log`. `T17.actor` to `INSTALLER`, więc **wykonanie `T17` z panelu B2B wpada dziś w K1** i każde zamknięcie etapu I byłoby logowane jako obejście reguły procesu.
- `contracts/funnel.contract.mjs:80-90` — flaga `manualEquivalent: true` istnieje dokładnie na tę sytuację: *„`actor` opisuje tu tylko ścieżkę typową (automat), a nie jedynego uprawnionego — istnieje w pełni legalna, równoważna ścieżka ręczna operatora panelu, więc wykonanie tego przejścia z panelu NIE jest obejściem reguły”*. Anuluje wyłącznie K1.
- Precedens działający: `T08` (`funnel.contract.mjs:148,157`) — webhook kuriera **LUB** ręczna akcja dyspozytora, ten sam `action`, `manualEquivalent: true`.
- Walidator `R30` (`tools/kk-validate.mjs:129-142`) dopuszcza tę flagę **wyłącznie** na przejściu, którego aktor nie jest operatorem panelu. `INSTALLER` ten warunek spełnia, więc flaga na `T17` jest legalna i nie jest martwa.
- **Wniosek: nie dopisujemy `admin`/`dyspozytor` jako drugiego aktora.** Kontrakt lejka ma jedno pole `actor` i nie zna listy aktorów; dopisanie drugiego wymagałoby zmiany kształtu kontraktu i uderzyłoby w każdą regułę czytającą `t.actor`. `manualEquivalent` jest mechanizmem przewidzianym przez ten kontrakt na dokładnie ten przypadek.
- `contracts/notifications.contract.mjs:34` — `N8a`, `bind: { kind: 'TRANSITION', transition: 'T17' }`, `vars: ['first_name','order_number','link']`, `attachments: ['invoice_phase_1']`. **Jeden `link`, nie dwa.**

**Rezerwacje — fundament gotowy:**
- `packages/database/prisma/schema.prisma:982-1047` — model `Booking`. Komentarz na `leadId` (linie 986-989) wprost: *„Montaż NIE MA własnej kolumny: rezerwacja montażu wisi na leadzie, a ADR-012 wiąże etapy montażu z rezerwacją od drugiej strony (`installation_phases.booking_id`). Dodanie tu `installation_id` utworzyłoby drugą, konkurencyjną drogę tego samego powiązania.”* — kierunek klucza obcego jest więc **przesądzony i nie podlega projektowaniu w tym WO**.
- `supabase/migrations/20260910110000_fld_booking_one_active_per_subject.sql:52-63` — kolumna generowana `subject_id = COALESCE(lead_id, service_id, incident_id)` + UNIQUE częściowy `bookings_one_active_per_subject` na `subject_id WHERE status IN ('RESERVED','CONFIRMED')`.
- `supabase/migrations/20260910100000_fld_calendar_foundation.sql:134-135` — koszyki **zaseedowane, potwierdzone**: `('INSTALL_PHASE_1', 'Montaż dwuetapowy — etap I', 480, 'CREW', 60)` i `('INSTALL_PHASE_2', 'Montaż dwuetapowy — etap II', 240, 'CREW', 70)`.
- `packages/scheduling/src/create-booking.ts` — `BookingSubject` (linie 33-36) to `LEAD | SERVICE | INCIDENT`; `orderCandidates` (linie 217-235) porządkuje kandydatów regułą D-1 (najmniej rezerwacji w dobie lokalnej, remis po `resource_id`). `EXCLUDE gist` + kody błędów (`SLOT_TAKEN`, `SUBJECT_ALREADY_BOOKED`) działają.

**Model instalacji — ISTNIEJE, wbrew założeniu „nic nie ma”:**
- `packages/database/prisma/schema.prisma:280-303` — model `instalacje` (tabela nazywa się dosłownie `instalacje`, `supabase/migrations/00000000000000_baseline.sql:222`, bez `@@map`; dług `KK-NAMING-BASELINE` zamrożony). Pola: `id`, `installation_number`, `lead_id`, `zespol_id`, `data_planowana`, `data_zakonczenia`, `protokol_url`, `next_service_date`, `status InstallationStatus @default(PLANNED)`.
- **Wiersz instalacji powstaje wcześnie:** `apps/b2b-web/src/app/(dashboard)/leads/actions.ts:257-268` — przypisanie ekipy tworzy albo aktualizuje wiersz instalacji w tej samej transakcji co zmiana statusu leada. Czyli w chwili `T17` wiersz instalacji dla leada **na pewno istnieje**.
- `contracts/rbac.contract.mjs:51` — `installations`: `update: ['admin','dyspozytor','monter:own']`. **Admin i dyspozytor mają komplet uprawnień potrzebnych temu WO** — zamknięcie etapu I to `installations:update`, więc po D3 nie trzeba zmieniać RBAC.
- `contracts/rbac.contract.mjs:64` — `bookings`: `create: ['admin','dyspozytor']`. **Monter NIE MOŻE tworzyć rezerwacji** — to niezależnie od D3 przesądza, że rezerwacji etapu II nie inicjuje ekipa.

### Brakuje (potwierdzone grepem, nie domysłem)

1. **Tabela `installation_phases` nie istnieje.** Jedyne wzmianki w repo to komentarze wykluczające: `supabase/migrations/20260910100000_fld_calendar_foundation.sql:60-61` („*nie powstaje tutaj*”) i `:330`, oraz komentarz w `schema.prisma:988`.
2. **Tabela `quotes` nie istnieje.** Wycena żyje dziś jako **pola na leadzie**: `estymowana_wycena`, `finalna_wycena_pln`, `quoted_at`, `przewidywany_czas_montazu`, `wybrana_konfiguracja` (`schema.prisma:105-116`) plus enum `QuoteStatus` (`schema.prisma:381`). Nazwa `quotes` figuruje wyłącznie w `RESOURCES` (`contracts/rbac.contract.mjs:12`).
3. **Pole `installation_type` nie istnieje nigdzie** — ani na leadzie, ani na instalacji, ani w migracjach.
4. **Pole `leads.declared_property_condition` nie istnieje** — mimo że `B2C-LEAD-ENTRY` i `FNL-2PHASE` je zakładają. To **czwarty** nieistniejący fundament.
5. **Brak jakiejkolwiek Server Action realizującej `T17`.** Grep po `completePhaseOne`/`T17`/`INSTALLER` w `apps/b2b-web/src` zwraca zero trafień.

### Dokument, który kłamie (do odnotowania, nie do naprawy tutaj)

`docs/01-ADR-spec-conflicts.md:86` twierdzi: *„**Wykonane:** … tabela `installation_phases`, pola `leads.declared_property_condition`, `quotes.installation_type`, `installations.installation_type`.”*
**Żadna z tych czterech rzeczy nie istnieje w schemacie ani w migracjach.** „Wykonane” w tym ADR znaczy „rozstrzygnięte na papierze”, nie „wdrożone w bazie”. Kto planuje na podstawie tego akapitu, zaplanuje pracę na fundamencie, którego nie ma. Poprawkę tego akapitu zleca się `doc-scribe` osobno.

---

## Zmiana kontraktu

**WYMAGANA.** Realizacja wymaga **osobnego okna kontraktowego i roli `contract-steward`**, wykonanego **przed** `test-author`. `implementer-server` nie może dotknąć żadnej z poniższych ścieżek — są zablokowane hookiem.

**Lista ostateczna, po zawężeniu D1–D3 (2026-09-16). Nic poza tym:**

| # | Zmiana | Plik |
|---|---|---|
| A | Nowa tabela `installation_phases` | migracja + `schema.prisma` |
| B | Nowe pole `instalacje.installation_type` (**D1 wariant (a)**) | migracja + `schema.prisma` |
| C.1 | `FNL-2PHASE` kryterium 2: `quotes.installation_type` → `instalacje.installation_type` | `requirements.contract.mjs` |
| C.2 | `FNL-2PHASE-BOOKING` kryterium 7 → przeniesione do `FNL-2PHASE-INVOICE` | `requirements.contract.mjs` |
| C.3 | `T17.req` += `FNL-2PHASE-BOOKING` | `funnel.contract.mjs` |
| C.4 | `T17` += `manualEquivalent: true` (**NOWE, konsekwencja D3**) | `funnel.contract.mjs` |

**Czego na liście NIE MA i nie ma się pojawić:** żadnej kolumny na zdjęcia, żadnej na protokół, żadnej na płatność, żadnej tabeli `invoices`, żadnej zmiany `rbac.contract.mjs`, żadnego nowego progu w `sla.contract.mjs` (D2), żadnego nowego aktora w `ACTORS`.

### A. Nowa tabela `installation_phases` (migracja + `schema.prisma`)

Projekt oparty na tym, co istnieje: **etapy są podtabelą instalacji**, nie bytem od zera i nie dwoma FK do `bookings` z jednej encji.

Uzasadnienie wyboru „jeden wiersz na etap” zamiast „jedna encja z `phase_1_booking_id` i `phase_2_booking_id`”:
- kontrakt mówi wprost o dwóch rekordach (`FNL-2PHASE`, kryterium 3: *„TWO_PHASE tworzy dwa rekordy installation_phases (1 i 2)”*) — dwie kolumny na jednym wierszu naruszyłyby brzmienie kryterium,
- `installation_phases.booking_id` (l. poj.) jest utrwalone w komentarzu schematu (`schema.prisma:988`) i w migracji kalendarza — wariant dwukolumnowy zmusiłby do zmiany obu komentarzy,
- `completed_at` na wierszu etapu daje guard `phaseOneNotCompleted` w postaci jednego `IS NULL`, bez interpretowania statusu rezerwacji.

Kształt minimalny:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()`, wzorem pozostałych tabel |
| `installation_id` | UUID NOT NULL | FK → `instalacje(id)`, `ON DELETE CASCADE`. **Nośnik powiązania z leadem jest pośredni** — `instalacje.lead_id` już istnieje, dublowanie `lead_id` tutaj tworzyłoby drugą drogę do tej samej prawdy (dokładnie ten błąd, przed którym ostrzega komentarz przy `Booking.leadId`) |
| `phase_number` | SMALLINT NOT NULL | `CONSTRAINT installation_phases_phase_number_check CHECK (phase_number IN (1, 2))` |
| `booking_id` | UUID NULL | FK → `bookings(id)`, `ON DELETE SET NULL`. NULL do czasu rezerwacji etapu; dla etapu II NULL jest stanem normalnym aż do kliknięcia linku |
| `completed_at` | TIMESTAMPTZ NULL | moment zamknięcia etapu (ADR-002: `_at`) |
| `created_at` | TIMESTAMPTZ NOT NULL | `timezone('utc', now())` |

Ograniczenia, bez których mechanika nie działa:
- `CONSTRAINT installation_phases_unique_phase UNIQUE (installation_id, phase_number)` — nośnik idempotencji tworzenia etapów; bez tego dwa równoległe wywołania robią cztery wiersze.
- `UNIQUE (booking_id)` (częściowe, `WHERE booking_id IS NOT NULL`) — jedna rezerwacja obsługuje dokładnie jeden etap.
- Indeks na `installation_id`, zgodnie z regułą `PERF-B2B-AUDIT` (Postgres nie tworzy indeksów FK sam).
- Nazewnictwo ograniczeń wzorem `audit_log_operation_check` z `20260901220000_rodo_audit_log_and_client_anonymization.sql:72-92`.

Model Prisma: `InstallationPhase` + `@@map("installation_phases")`, pola `camelCase` + `@map` (ADR-002), relacja zwrotna na `instalacje` i na `Booking`.

### B. Flaga trybu dwuetapowego — `instalacje.installation_type` (D1 ROZSTRZYGNIĘTE)

**Decyzja Michała 2026-09-16: wariant (a).** Pole mieszka na **`instalacje.installation_type`**, **nie na leadzie**.

- Typ: `TEXT NULL`, `CONSTRAINT instalacje_installation_type_check CHECK (installation_type IN ('SINGLE_PHASE','TWO_PHASE'))`.
- `NULL` znaczy **„tryb nieustalony”**, nigdy „jednoetapowy”. Guard `installationIsTwoPhase` przepuszcza wyłącznie jawne `'TWO_PHASE'` — ten sam wzorzec, co „NULL w promieniu znaczy nieustalony” z `CRM-REGION-AUTO`.
- Tabeli `quotes` w tym WO **nie projektujemy**, pola `leady.installation_type` **nie tworzymy**. Wariant (c) (obie kolumny, kopiowane) jest odrzucony — dwie drogi do tej samej prawdy.
- Konsekwencja, którą trzeba przyjąć świadomie: wiersz instalacji powstaje przy przypisaniu ekipy (`leads/actions.ts:257-268`), więc audytor **nie ma dziś gdzie zapisać trybu w chwili wyceny**. To **nie jest zadanie tego WO** — ten WO zakłada, że tryb jest już ustawiony na instalacji, i testuje mechanikę od tego miejsca w górę. Ścieżka „audytor ustawia tryb przy wycenie” to `FNL-2PHASE` kryterium 2 od strony UI audytora i idzie osobno (patrz R4).

### C. Rejestr wymagań i kontrakt lejka

1. **`FNL-2PHASE` kryterium 2 — PRZEPISAĆ (konsekwencja D1).** Dziś brzmi: *„Audytor na miejscu ustawia `quotes.installation_type` — to jest wartość wiążąca”* (`requirements.contract.mjs:159`). Wskazuje nośnik, który **nie istnieje i nie powstanie**. Nowe brzmienie ma wskazywać `instalacje.installation_type` i zachować zdanie o wartości wiążącej (deklaracja klienta z Triage nie decyduje). Historia dopisana w `source` z datą 2026-09-16 i nazwiskiem decydenta, nie skasowana (wzorzec `CRM-REGION-AUTO:155-158`).
2. `FNL-2PHASE-BOOKING`: kryterium 7 (zależność N8a) **usunąć z listy `acceptance` i przenieść treść do `FNL-2PHASE-INVOICE`**, zostawiając w `source`/`note` datowany ślad przeniesienia.
3. `FNL-2PHASE-INVOICE` (**wpis już istnieje, linia 161** — nie tworzyć drugiego): dopisać do `acceptance` rozszerzenie `N8a` (`handover_protocol`, `amount`, rozdzielenie `link` → `booking_link` + `payment_link`) oraz `note`: „ODŁOŻONE 2026-09-16. Blokady: (a) pytanie księgowe proforma vs faktura zaliczkowa, `docs/architecture/FIELD-APP-PLAN.md:782-784`; (b) decyzja Michała 2026-09-16 — Field App, upload zdjęć, generowanie PDF i integracja płatności to cztery osobne podsystemy, żaden nie powstaje w `FNL-2PHASE-BOOKING-MECHANICS`, wymagają ADR-013”.
4. `funnel.contract.mjs:187` — `T17.req` rozszerzyć z `['FNL-2PHASE']` na `['FNL-2PHASE','FNL-2PHASE-BOOKING']`, inaczej `kk-trace` nie policzy pokrycia.

### C.4 — `T17` + `manualEquivalent: true` (NOWY PUNKT, konsekwencja D3)

**Poprzednia tura tego nie przewidziała.** Po D3 `T17` wykonuje **operator panelu B2B** (dyspozytor/administrator), a `T17.actor` pozostaje `INSTALLER`. Bez flagi kryterium **K1** klasyfikatora (`funnel.contract.mjs:70`) uzna **każde** zamknięcie etapu I za `manual_status_change` w `audit_log` — czyli normalna, docelowa ścieżka procesu byłaby stale logowana jako obejście reguły. To zaszumia audyt dokładnie w miejscu, w którym ma on wykrywać nadużycia.

- Dopisać `manualEquivalent: true` do `T17` (wartość zawsze literał `true`; nigdy `false` — R30).
- **`actor: 'INSTALLER'` zostaje bez zmian** i jest opisem **aktora docelowego** (monter w Field App, faza 3+). `manualEquivalent` znaczy dokładnie „istnieje równoważna, legalna ścieżka operatora panelu” — a po D3 to właśnie ta ścieżka jest implementowana i testowana.
- **Nie dopisujemy** `admin`/`dyspozytor` jako drugiego aktora: `actor` jest polem pojedynczym, a lista aktorów zmieniłaby kształt kontraktu i każdą regułę czytającą `t.actor`.
- **Nie zmieniamy** `rbac.contract.mjs` — `installations:update` obejmuje już `admin` i `dyspozytor`.
- Po zmianie: `node tools/kk-validate.mjs --strict` (R30 sprawdza legalność flagi) i `node tools/kk-selftest.mjs`.

**Czego NIE zmieniamy:** nazw `T17`, `completePhaseOne`, `installationIsTwoPhase`, `phaseOneNotCompleted`, `do:openPhaseTwoBooking`, `N8a`, noty `T17`, listy `ACTORS`, `rbac.contract.mjs`, `sla.contract.mjs`. Wszystkie istnieją i są `STABLE`.

---

## Decyzje rozstrzygnięte (Michał, 2026-09-16)

### D1 — Gdzie mieszka `installation_type`? → **ROZSTRZYGNIĘTE: wariant (a), `instalacje.installation_type`**

**Decyzja:** pole mieszka na instalacji. **Nie na leadzie.** Warianty (b) i (c) odrzucone.
**Skutek dla kontraktu:** punkt B i C.1 powyżej — nowa kolumna z `CHECK`, oraz przepisanie kryterium 2 `FNL-2PHASE` z nieistniejącego `quotes.installation_type` na `instalacje.installation_type`.
**Skutek dla testów:** guard `installationIsTwoPhase` czyta jedno pole z `instalacje`, bez złączenia przez leada. `NULL` = tryb nieustalony = brak etapów (AC1).
**Otwarte następstwo, świadomie poza tym WO:** moment zapisu trybu przez audytora — patrz R4.

<details>
<summary>Materiał, na którym zapadła decyzja (zachowany)</summary>

### D1 — Gdzie mieszka `installation_type`?

`FNL-2PHASE`, kryterium 2, brzmi: *„Audytor na miejscu ustawia `quotes.installation_type` — to jest wartość wiążąca”*. Tabeli `quotes` nie ma i nie powstanie w tym WO.

Trzy warianty, wszystkie wykonalne:

| Wariant | Za | Przeciw |
|---|---|---|
| **(a) `instalacje.installation_type`** *(rekomendacja)* | etapy wiszą na instalacji, więc guard `installationIsTwoPhase` czyta jedno złączenie mniej; ADR-005 wymienia `installations.installation_type` jako jedno z pól | wiersz instalacji powstaje dopiero przy przypisaniu ekipy (`leads/actions.ts:257-268`), a audytor decyduje **wcześniej**, przy wycenie → potrzebne utworzenie wiersza instalacji w chwili wyceny albo przeniesienie wartości później |
| **(b) `leady.installation_type`** | wycena fizycznie żyje dziś na leadzie (`finalna_wycena_pln`, `quoted_at`, `QuoteStatus`), więc audytor ma gdzie zapisać od razu | „wartość wiążąca wyceny” na tabeli leada pogłębia dług, który tabela `quotes` ma kiedyś spłacić |
| **(c) obie, kopiowane** | zgodne z literą ADR-005 | dwie drogi do tej samej prawdy — dokładnie ten błąd, przed którym ostrzega komentarz przy `Booking.leadId` |

*(Pytanie zamknięte — odpowiedź (a). Kryterium 2 `FNL-2PHASE` przepisywane w tym samym oknie kontraktowym, bo dziś wskazuje nieistniejący nośnik.)*

</details>

### D2 — Minimalna przerwa między etapami? → **ROZSTRZYGNIĘTE: BRAK twardego ograniczenia**

**Decyzja Michała 2026-09-16: brak twardego ograniczenia.** Dyspozytor sam ocenia gotowość mieszkania. Silnik i tak sprawdza dostępność terminu, ale **nie ma minimalnej liczby dni ani tygodni wymuszonej w bazie ani w kodzie**.

**Skutek — to jest zakaz, nie brak zadania:**
- **Nie powstaje** wpis `TWO_PHASE_MIN_GAP` ani żaden inny próg w `sla.contract.mjs`.
- **Nie powstaje** `CHECK` porównujący daty etapów, trigger bazodanowy ani walidacja w Server Action.
- Jedyną regułą wiążącą dla etapu II jest **„etap I zamknięty”** (AC3). Etap II zarezerwowany dzień po etapie I jest **poprawny** i test ma to potwierdzać, a nie odrzucać.
- Test „przerwy międzyetapowej” **nie istnieje** i nie ma być pisany. Zastępuje go AC5 (etap II jest zwykłą ścieżką lejka) — czyli test, że **żadne** ograniczenie odstępu nie jest nakładane.

<details>
<summary>Materiał, na którym zapadła decyzja (zachowany)</summary>

### D2 — Czy istnieje minimalna przerwa między etapami?

Sprawdzone: `contracts/sla.contract.mjs` **nie zawiera żadnego progu** dla przerwy międzyetapowej (są tylko `QUOTE_VALIDITY` 14 d, `COLD_LEAD_REPRICE` 30 d, `SERVICE_REMINDER_LEAD` 30 d, `CERT_EXPIRY_WARNING` 30 d, `AUDITOR_DAILY_CAP` 5, `INSTALL_DAY_ALERT` 16:00, promienie geofence).
`FIELD-APP-PLAN.md:768` mówi wyłącznie opisowo: *„przerwa między etapami może wynosić tygodnie (mieszkanie musi zostać wykończone)”* — **„może” to nie „musi”**, więc z dokumentu nie wynika żadna liczba.

**Rekomendacja: BRAK twardego ograniczenia**, ani w bazie, ani w aplikacji. Jedyną regułą wiążącą jest „etap I zamknięty” (AC3). Uzasadnienie: mieszkanie może być wykończone szybciej, niż ktokolwiek zakłada, a odmowa rezerwacji terminu, który klientowi pasuje, jest szkodą realną wobec ryzyka hipotetycznego.

*(Pytanie zamknięte — brak progu, rekomendacja przyjęta.)*

</details>

### D3 — Kto zamyka etap I? → **ROZSTRZYGNIĘTE: dyspozytor/administrator w panelu B2B. Najważniejsza decyzja tego WO.**

**Przebieg decyzji (istotny, bo tłumaczy granicę zakresu):** Michał najpierw opisał **pełny przepływ docelowy** — monter kończy montaż w Field App, dokumentuje zdjęciami, klient otrzymuje dokumenty odbioru, fakturę i link do etapu II. Po wyjaśnieniu, że **Field App nie istnieje jako aplikacja** i że ten przepływ wymaga **czterech osobnych, dużych podsystemów** (aplikacja mobilna, upload zdjęć, generowanie PDF, integracja płatności), Michał **zawęził zakres na teraz**.

**Decyzja:**
> Budujemy **wyłącznie mechanikę rezerwacji w panelu B2B**. Dyspozytor lub administrator zamyka etap I i rezerwuje etap II tam, gdzie panel **już istnieje**.

**Co z tego wynika — zakazy, nie preferencje:**

| Rzecz | Status w tym WO |
|---|---|
| Aplikacja Field App | **NIE budujemy.** Ani zalążka, ani stuba, ani routingu |
| Upload / przechowywanie zdjęć montażu | **NIE budujemy.** Żadnej kolumny, żadnego bucketu |
| Generowanie PDF (protokół odbioru, dokumenty) | **NIE budujemy** |
| Integracja płatności, faktura, proforma, `do:issuePhaseOneInvoice` | **NIE budujemy** → `FNL-2PHASE-INVOICE` |
| Ekran lub uprawnienie dla montera | **NIE budujemy.** Monter nie jest aktorem żadnej ścieżki implementowanej w tym WO |
| Zamknięcie etapu I przez dyspozytora/admina w panelu B2B | **TAK — to jest cały zakres UI tego WO** |

To **nie jest** „zrób mechanikę, UI dołóż potem”. To jest **„zrób wyłącznie to, co reprezentowalne w panelu B2B”**. Wszystko pozostałe to osobny, przyszły projekt, wymagający **własnego ADR-013** i własnej serii decyzji.

**Skutki techniczne:**
1. `T17.actor` **zostaje `INSTALLER`** — jako opis aktora **docelowego**. Kontraktu w tym punkcie nie przepisujemy.
2. **NOWY punkt zmiany kontraktu: `T17` + `manualEquivalent: true`** (C.4). Bez tego każde zamknięcie etapu I z panelu wpada w K1 i ląduje w `audit_log` jako `manual_status_change` — normalna praca oznaczana jako obejście reguły. Poprzednia tura tego nie przewidziała.
3. `test-author` pisze testy uprawnień **dla `dyspozytor` i `admin` jako ścieżki dozwolonej**, a dla `monter` — jako **odmowy** (monter nie ma `bookings:create`, `rbac.contract.mjs:64`, i nie ma ekranu).
4. `implementer-ui` **ma zadanie**: akcja zamknięcia etapu I w panelu B2B. Zakres wyłącznie ten — bez galerii zdjęć, bez podglądu dokumentów.
5. Ślad „kto zamknął” zapisujemy wzorem istniejącego `bookedBy` — **to jest identyfikator operatora panelu, nie montera**. Nie modelujemy „w imieniu ekipy”, bo to wymagałoby tożsamości ekipy w akcji, której ten WO nie buduje.

### D-księgowe (dziedziczone, NIE blokuje tego WO)

Proforma czy faktura zaliczkowa dla etapu I — `docs/architecture/FIELD-APP-PLAN.md:782-784`, pamięć `project_n8a_payment_dependency.md`. Blokuje `FNL-2PHASE-INVOICE`, nie mechanikę. Odnotowane, żeby nie wróciło jako niespodzianka.

---

## Kryteria akceptacji (wykonalne)

Rozwinięcie 1:1 z kryteriów 1–6 `FNL-2PHASE-BOOKING`. Kryterium 7 celowo nieobecne (przeniesione do `FNL-2PHASE-INVOICE`, patrz C.2 i „Poza zakresem”).

**Każde AC poniżej jest obserwowalne w panelu B2B albo wprost w bazie.** Żadne nie zakłada Field App, zdjęcia, dokumentu ani płatności (D3).

- [ ] **AC1 — dwa etapy powstają, gdy tryb jest dwuetapowy** *(kryt. 1; `FNL-2PHASE` kryt. 3)*
  Instalacja z `instalacje.installation_type = 'TWO_PHASE'` (D1) ma dokładnie dwa wiersze etapów o `phase_number` 1 i 2. Instalacja `SINGLE_PHASE` **albo z `installation_type IS NULL`** (tryb nieustalony) **nie ma żadnego**. Test sprawdza obie strony — samo „powstają dwa” przepuściłoby implementację tworzącą etapy zawsze.

- [ ] **AC2 — rezerwacja etapu I zapina się na etapie 1, nie na etapie 2**
  Po zarezerwowaniu terminu etapu I wiersz `phase_number = 1` wskazuje tę rezerwację, a wiersz `phase_number = 2` ma `booking_id IS NULL`. Rezerwacja ma koszyk `INSTALL_PHASE_1` (480 min) i `resource_kind = 'CREW'`.

- [ ] **AC3 — etap II nie jest możliwy przed zamknięciem etapu I** *(kryt. 3 — sedno WO)*
  Próba rezerwacji etapu II **wykonana akcją w panelu B2B** (D3), gdy `phase_number = 1` ma `completed_at IS NULL`, kończy się **odmową domenową** (czytelny kod błędu, nie 500, nie cichy sukces). Test sprawdza dodatkowo, że po odmowie `phase_number = 2` nadal ma `booking_id IS NULL` — odmowa bez skutku ubocznego.
  **Druga warstwa obrony, którą baza daje za darmo:** dopóki rezerwacja etapu I jest `RESERVED`/`CONFIRMED`, indeks `bookings_one_active_per_subject` **fizycznie zabrania** drugiej aktywnej rezerwacji na tym samym leadzie (23505 → `SUBJECT_ALREADY_BOOKED`). Test musi pokazać, że **obie** warstwy działają: walidacja aplikacyjna odmawia z własnym komunikatem, a próba ominięcia Server Action i wstawienia wiersza wprost odbija się od indeksu. To ten sam dwuwarstwowy wzorzec, co w `B2C-LEAD-ENTRY` i `CRM-DELETE-ADMIN-ONLY`.

- [ ] **AC4 — zamknięcie etapu I otwiera etap II i tylko to** *(kryt. 2)*
  Zamknięcie etapu I **przez dyspozytora lub administratora w panelu B2B** (D3) ustawia `completed_at` na etapie 1, przełącza rezerwację etapu I na `COMPLETED` i kolejkuje `N8a` **w tej samej transakcji** (pułapka 2 z CLAUDE.md). Link do rezerwacji etapu II nie istnieje wcześniej: test wykonany **przed** zamknięciem nie znajduje żadnego takiego odnośnika, a po zamknięciu znajduje dokładnie jeden. Lista kolejkowanych powiadomień czytana jest z `transition.effects`, nie z literału `'N8a'` (zakaz `adr003-notif-literal`).
  **Zakres zawężony:** `N8a` niesie **jeden `link`** — do rezerwacji etapu II. Załącznik `invoice_phase_1` i efekt `do:issuePhaseOneInvoice` **nie są realizowane w tym WO** (patrz R7 — to najostrzejsza kolizja zawężenia z kontraktem i wymaga uzgodnienia w oknie kontraktowym).

- [ ] **AC4b — zamknięcie etapu I z panelu NIE jest obejściem reguły** *(konsekwencja D3 i C.4)*
  Zamknięcie etapu I przez dyspozytora/administratora **nie tworzy wpisu `manual_status_change` w `audit_log`**. To normalna ścieżka procesu, nie odstępstwo. Nośnikiem jest `manualEquivalent: true` na `T17` (C.4), anulujące kryterium K1. Test musi to sprawdzać wprost — inaczej audyt zapełni się fałszywymi alarmami i przestanie służyć wykrywaniu prawdziwych obejść.

- [ ] **AC5 — etap II jest zwykłą ścieżką lejka, nie drugim dniem** *(kryt. 4 — kryterium wpisane, bo pierwsza wersja planu myliła montaż dwuetapowy z dużym)*
  Silnik dostępności **nie szuka dwóch sąsiadujących dni**. Test rezerwuje etap II w terminie odległym o kilka tygodni od etapu I i oczekuje sukcesu; drugi test pokazuje, że wyszukiwanie terminów dla etapu II nie odwołuje się w żaden sposób do daty etapu I. Test **statyczny** dodatkowo: w `packages/scheduling` nie istnieje ścieżka szukająca par sąsiadujących dni ani koszyk montażu dwudniowego.
  **D2 (brak progu) dokłada tu trzeci przebieg, w drugą stronę:** etap II zarezerwowany **nazajutrz** po zamknięciu etapu I **kończy się sukcesem**. Nie ma minimalnej przerwy — ani w bazie, ani w kodzie. Test, który oczekiwałby odmowy za „za wcześnie”, jest błędny; test, który oczekuje sukcesu, dowodzi braku progu. To jedyne miejsce, w którym decyzja D2 jest obserwowalna, więc bez tego przebiegu ktoś dopisze walidację przerwy w dobrej wierze.

- [ ] **AC6 — koszyki etapów są osobne i pochodzą ze słownika** *(kryt. 5)*
  Etap I używa `INSTALL_PHASE_1` (480 min), etap II `INSTALL_PHASE_2` (240 min); czas trwania czytany jest z `visit_duration_baskets`, nie z literału. Test sprawdza też, że **nie istnieje** koszyk „montaż duży = 2 dni” — jego brak jest świadomy i ma zostać brakiem.

- [ ] **AC7 — ta sama ekipa to preselekcja, nie warunek** *(kryt. 6)*
  Gdy ekipa etapu I jest dostępna w wybranym terminie, zostaje zaproponowana jako pierwsza. Gdy jest niedostępna (nieaktywna, na urlopie, zajęta), rezerwacja etapu II **i tak się udaje** z inną ekipą. Test musi pokazać oba przebiegi.
  **Rozstrzygnięcie zakresowe:** preferencja nie modyfikuje `packages/scheduling`. Reguła D-1 w `orderCandidates` (`create-booking.ts:217-235`) zostaje nietknięta, a preferencja realizuje się jako **preselekcja po stronie wołającego** — nigdy jako filtr zawężający pulę. Uzasadnienie: pula ofertowana klientowi jest zagregowana i bez tożsamości pracownika (`CAL-POOL-AGGREGATE`), więc twarde związanie musiałoby tę agregację rozbić, a kryterium 6 mówi wprost, że kilkutygodniowa przerwa czyni takie związanie obietnicą bez pokrycia.

- [ ] **AC8 — zamknięcie etapu I nie jest zamknięciem montażu**
  Po `T17` status leada pozostaje `AWAITING_INSTALLATION` (pętla własna, ADR-005), `instalacje.status` nie przechodzi na zakończony, a `next_service_date` pozostaje niezmienione. Ten ostatni punkt jest twardy: `ADR-010` liczy przegląd od uruchomienia sprzętu, czyli od etapu II.

---

## Przypadki brzegowe, które MUSZĄ mieć test

1. **Idempotencja `T17` (pętla własna).** Dwukrotne zamknięcie etapu I odrzuca guard `phaseOneNotCompleted`; drugie wywołanie **nie kolejkuje drugiego `N8a`** i nie przesuwa `completed_at`. To jest dosłownie powód, dla którego powstała reguła `R19-self-loop-guard` (`docs/01-ADR-spec-conflicts.md:94`).
2. **Współbieżność tworzenia etapów.** Dwa równoległe wywołania tworzące etapy dla tej samej instalacji dają **dwa wiersze, nie cztery** — nośnikiem jest `UNIQUE (installation_id, phase_number)`, nie sprawdzenie w JS (pułapka 4 z CLAUDE.md).
3. **Współbieżność `T17`.** Dwa równoległe zamknięcia etapu I: dokładnie jedno kończy się sukcesem. Wzorzec blokady wiersza `SELECT … FOR UPDATE` jak w `advanceLeadStatus` (`leads/actions.ts:686-691`).
4. **Obejście przez `advanceLeadStatus` — pułapka realna, nie teoretyczna.** `findTransitionByFromTo('AWAITING_INSTALLATION','AWAITING_INSTALLATION')` **dopasuje `T17`**, bo to jedyna pętla własna z tego stanu, a `advanceLeadStatus` **nie sprawdza guardów** (komentarz `leads/actions.ts:649-651`). Test musi pokazać, że wywołanie `advanceLeadStatus(leadId, 'AWAITING_INSTALLATION')` **nie** zamyka etapu I, **nie** tworzy rezerwacji etapu II i **nie** wysyła `N8a`. Bez tego testu istnieje druga, cicha droga do zamknięcia etapu — a pamięć projektu zna już jeden taki przypadek (dwie ścieżki UI do T10–T13).
5. **Uprawnienia (przeformułowane po D3).** Ścieżką dozwoloną jest **`dyspozytor` i `admin` w panelu B2B** — oba konta zamykają etap I i rezerwują etap II. Odmowy do sprawdzenia: **monter** (brak `bookings:create`, `rbac.contract.mjs:64` — i brak ekranu, którego ten WO nie buduje) oraz **audytor** (nie ma nic do roboty przy montażu). Sprawdzenie roli musi być jawne w Server Action, bo Prisma omija RLS (pułapka 1).
6. **Strefa czasowa.** `scheduled_start`/`scheduled_end` są UTC (`schema.prisma:1013-1016`), a „doba lokalna” z reguły D-1 (`orderCandidates`) liczy się lokalnie. Test z terminem etapu II przecinającym zmianę czasu (koniec października) — żeby rozstrzygnięcie remisu między ekipami nie zmieniło się o granicę doby. **Uwaga po D2:** to **nie jest** test długości przerwy międzyetapowej — żadnej przerwy nie mierzymy. To test poprawności doby lokalnej w wyborze kandydata.
7. **Rollback po etapie I.** `T13` (`AWAITING_INSTALLATION → ROLLBACK_RESCHEDULING`, `actor: CLIENT`) jest legalny również wtedy, gdy etap I jest już zamknięty. Test: rollback zwalnia rezerwację etapu II (`RELEASED`), ale **nie kasuje `completed_at` etapu I** — praca wykonana nie odwraca się przez przełożenie terminu.
8. **Usunięcie leada.** Kaskada `leady → instalacje → installation_phases` nie zostawia sierot ani nie wywraca się na `RESTRICT`.
9. **Tryb zmieniony po fakcie.** Przełączenie instalacji z `TWO_PHASE` na `SINGLE_PHASE`, gdy etap I jest już zamknięty — odmowa albo jawnie zdefiniowane zachowanie. Nie może być cichym `UPDATE`, po którym zostają dwa osierocone etapy.

---

## Zawężona lista przypadków testowych (po D1–D3)

To jest **zamknięta** lista obszarów, których dotykają testy tego WO. `test-author` nie wychodzi poza nią.

| # | Obszar | Czego dotyczy |
|---|---|---|
| 1 | **Tabela `installation_phases`** | powstawanie dwóch wierszy (AC1), powiązanie `booking_id` z właściwym etapem (AC2), `completed_at` (AC4), unikalność i idempotencja (brzegi 1–2), kaskada usunięcia (brzeg 8) |
| 2 | **Pole `instalacje.installation_type`** (D1) | `TWO_PHASE` → dwa etapy; `SINGLE_PHASE` → zero; **`NULL` → zero** (AC1); zmiana trybu po zamknięciu etapu I (brzeg 9) |
| 3 | **Blokada etapu II przed zamknięciem etapu I** — **przez akcję w panelu B2B** (D3) | AC3: odmowa domenowa z czytelnym kodem, bez skutku ubocznego; ścieżka dozwolona `dyspozytor`/`admin`, odmowa `monter`/`audytor` (brzeg 5) |
| 4 | **Koszyki `INSTALL_PHASE_1` / `INSTALL_PHASE_2`** | AC6: 480 vs 240 min czytane z `visit_duration_baskets`, nie z literału; brak koszyka „montaż duży = 2 dni”; AC5: brak wiązania dat etapów i **brak minimalnej przerwy** (D2) |
| 5 | **`bookings_one_active_per_subject` jako druga warstwa obrony** | AC3: ominięcie Server Action i `INSERT` wprost odbija się od indeksu (23505 → `SUBJECT_ALREADY_BOOKED`); R3: rezerwacja etapu I musi zejść z `RESERVED`/`CONFIRMED`, inaczej etap II jest nierezerwowalny |
| 6 | **Zamknięcie etapu I z panelu nie jest obejściem** | AC4b: brak wpisu `manual_status_change` w `audit_log` (nośnik: `manualEquivalent` na `T17`, C.4) |
| 7 | **Obrona przed drugą ścieżką** | brzeg 4: `advanceLeadStatus(leadId,'AWAITING_INSTALLATION')` nie zamyka etapu, nie rezerwuje, nie wysyła `N8a` |

**Czego testy tego WO NIE dotykają (usunięte po D3):** aplikacji Field App, ekranu montera, uploadu i walidacji zdjęć, generowania protokołu odbioru, generowania i treści PDF, faktury/proformy/płatności, efektu `do:issuePhaseOneInvoice`, załącznika `invoice_phase_1`, rozdzielenia `link` na `booking_link`/`payment_link`. **Test dotykający któregokolwiek z tych obszarów jest poza zakresem WO i należy go odrzucić, a nie „przy okazji” zaimplementować.**

---

## Poza zakresem

**Cztery podsystemy odłożone w całości decyzją Michała 2026-09-16 (D3).** Żaden nie powstaje w tym WO — nawet w formie zalążkowej, pustego pola, stuba czy „przygotowania pod przyszłość”. Każdy wymaga **własnego ADR-013** i własnej serii decyzji:

1. **Aplikacja Field App** — `apps/` zawiera dziś wyłącznie `b2b-web` i `b2c-web`. Field App to faza 3+ mapy drogowej.
2. **Upload i przechowywanie zdjęć montażu** — brak tabeli, brak bucketu, brak decyzji o retencji (a zdjęcia z mieszkania klienta to też pytanie RODO, nierozstrzygnięte).
3. **Generowanie dokumentów PDF** (protokół zdawczo-odbiorczy, dokumenty odbioru) — brak biblioteki, brak szablonów, brak decyzji o miejscu składowania.
4. **Integracja płatności i fakturowanie** — dodatkowo zablokowane pytaniem księgowym (proforma vs faktura zaliczkowa).

Pozostałe wyłączenia:

- **Kryterium 7 `FNL-2PHASE-BOOKING`** — rozszerzenie `N8a` o `handover_protocol`, `amount` i rozdzielenie `link` na `booking_link`/`payment_link`. Przeniesione do `FNL-2PHASE-INVOICE`. **Konsekwencja przyjęta świadomie:** dopóki `N8a` niesie jeden `link`, jest to link do rezerwacji etapu II — wystarczający dla AC4 i niewystarczający dla przepływu płatności.
- **Faktury, proformy, płatności, protokół zdawczo-odbiorczy, efekt `do:issuePhaseOneInvoice`, tabela `invoices`** — `FNL-2PHASE-INVOICE`, zablokowane pytaniem księgowym.
- **Tabela `quotes`** — nie powstaje. Wycena zostaje polami na leadzie. Migracja do osobnej tabeli to własne wymaganie.
- **`leads.declared_property_condition`** — deklaracja klienta z Triage należy do `B2C-LEAD-ENTRY` / `FNL-2PHASE` kryt. 1. Ten WO zakłada, że tryb jest już ustawiony na `instalacje.installation_type` (D1); deklaracja klienta jest przesłanką, nie wejściem tej mechaniki.
- **Ekran audytora ustawiający tryb przy wycenie** — moment zapisu `installation_type` przez audytora to `FNL-2PHASE` kryt. 2 od strony UI. Ten WO tworzy **pole** i mechanikę, która je czyta; nie tworzy ścieżki, którą audytor je wypełnia. Patrz R4.
- **Minimalna przerwa między etapami** — **brak twardego ograniczenia, decyzja Michała 2026-09-16 (D2).** Nie projektujemy progu SLA, `CHECK`-a na datach, triggera ani walidacji aplikacyjnej. Gotowość mieszkania ocenia dyspozytor.
- **Naprawa `advanceLeadStatus` jako maszyny stanów** — `FNL-ADVANCE-STATUS-CONTRACT-BOUND`. Tutaj jedynie **test obronny** (brzeg 4), nie naprawa.
- **`next_service_date` liczone od etapu II** — `SRV-NEXT-DATE`. Tutaj tylko „nie psujemy” (AC8).
- **Montaż duży (dwa dni pod rząd)** — świadomie nie istnieje. Montaż 4+ jednostek idzie ścieżką dwuetapową.
- **Poprawka `docs/01-ADR-spec-conflicts.md:86`** — zadanie dla `doc-scribe`.

---

## Ryzyka i nieznane

- **R1 — cztery nieistniejące fundamenty, stawiamy dwa.** `installation_phases`, `quotes`, `installation_type`, `declared_property_condition`. Po D1 (wariant (a), nie (c)) ten WO stawia **dokładnie dwa**: tabelę etapów i pole `instalacje.installation_type`. `quotes` i `declared_property_condition` zostają nietknięte. Liczba nie rośnie i WO nie wymaga kolejnego cięcia.
- **R2 — `bookings` nie ma `installation_id`, i to jest decyzja, nie luka.** Rezerwacja etapu wisi na leadzie; powiązanie z etapem idzie wyłącznie przez `installation_phases.booking_id`. Implementer szukający `booking.installationId` niczego nie znajdzie i może „naprawić” to, co jest celowe.
- **R3 — `bookings_one_active_per_subject` jest sprzymierzeńcem i pułapką zarazem.** Chroni AC3 za darmo, ale oznacza, że **rezerwacja etapu I musi zmienić status na `COMPLETED` (albo `RELEASED`) zanim etap II da się zarezerwować**. Jeżeli `T17` nie domknie rezerwacji etapu I, klient kliknie link z `N8a` i dostanie `SUBJECT_ALREADY_BOOKED` — niezrozumiały komunikat po poprawnie wykonanej pracy. To najbardziej prawdopodobny sposób, w jaki to wymaganie zepsuje się w produkcji, i dlatego zmiana statusu rezerwacji etapu I jest wpisana wprost w AC4.
- **R4 — tryb ustalany po przypisaniu ekipy (otwarte następstwo D1).** D1 wybrało wariant (a), a wiersz instalacji powstaje dopiero przy przypisaniu ekipy (`leads/actions.ts:257-268`). **Audytor nie ma więc gdzie zapisać decyzji w chwili, w której ją podejmuje.** To nie jest wada implementacji, tylko konsekwencja D1 i jedyne realne następstwo tej decyzji, które zostaje otwarte. Ten WO świadomie startuje **za** tym momentem: zakłada instalację z ustawionym trybem. Kto będzie zamykał `FNL-2PHASE` kryt. 2 od strony UI audytora, musi rozstrzygnąć, czy wiersz instalacji powstaje wcześniej (np. przy `T03`), czy tryb wędruje z innego nośnika. **Nie rozstrzygamy tego tutaj** — rozstrzygnięcie na siłę dołożyłoby temu WO piąty fundament.
- **R5 — `FNL-2PHASE` ma zero pokrycia i pozostanie niedomknięte.** Ten WO daje jego kryterium 3, nośnik dla 4–5 i **przepisuje kryterium 2 na istniejące pole** (C.1) — ale samo kryterium 2 domyka się dopiero, gdy audytor ma ścieżkę zapisu (R4). Kryterium 1 zostaje otwarte. Nikt nie powinien po tym WO oznaczyć `FNL-2PHASE` jako `DONE`.
- **R6 — `kk-trace` nie zobaczy pokrycia bez zmiany C.3.** Dopóki `T17.req` nie wymieni `FNL-2PHASE-BOOKING`, testy mogą przejść, a raport pokrycia pokaże zero — i ktoś zaplanuje tę pracę drugi raz.
- **R7 — `T17` niesie efekt, którego ten WO świadomie nie realizuje. Najostrzejsza kolizja zawężenia z kontraktem.** `T17.effects` to `['N8a','do:issuePhaseOneInvoice','do:openPhaseTwoBooking']`, a komentarz w `funnel.contract.mjs:63-65` mówi wprost: *„Efekt domenowy = obowiązkowa zmiana stanu poza tabelą leads; test kontraktowy sprawdza jego wystąpienie”*. Po D3 **`do:issuePhaseOneInvoice` nie powstaje** (faktury odłożone), więc implementacja `T17` będzie miała efekt zadeklarowany i niezrealizowany. Trzy wyjścia, **wszystkie wymagają decyzji `contract-steward` w oknie kontraktowym, żadnego nie wybiera implementer samodzielnie**: (a) zostawić efekt w kontrakcie i przyjąć czerwony test kontraktowy jako znany, udokumentowany dług; (b) przenieść `do:issuePhaseOneInvoice` z `T17` do zakresu `FNL-2PHASE-INVOICE` wraz z jawnym śladem daty; (c) oznaczyć `T17` jako częściowo zrealizowane. **To jedyny punkt, w którym zawężenie D3 zderza się z literą kontraktu lejka** — i jeżeli ma wysadzić bramkę, to tutaj. `N8a` podlega temu samemu pytaniu w części „załącznik `invoice_phase_1`”.
- **R8 — pokusa „przy okazji”.** Cztery odłożone podsystemy są odłożone **w całości**. Najbardziej prawdopodobne naruszenie zakresu to dodanie „jednej małej kolumny” na URL zdjęcia albo protokołu, bo *„i tak będzie potrzebna”*. Taka kolumna to migracja, która przejdzie przez okno kontraktowe niezauważona, a potem uzasadni kolejną. **Brak tych kolumn jest decyzją, nie przeoczeniem** — dokładnie jak brak koszyka „montaż duży = 2 dni”.

---

## Kolejność ról

1. ~~**Człowiek** — rozstrzyga D1, D2, D3.~~ **WYKONANE 2026-09-16.**
2. **`contract-steward`** (okno kontraktowe) — sześć pozycji z tabeli „Lista ostateczna”: migracja `installation_phases` (A), pole `instalacje.installation_type` (B), `schema.prisma`, przepisanie kryterium 2 `FNL-2PHASE` (C.1), przeniesienie kryterium 7 do `FNL-2PHASE-INVOICE` (C.2), `T17.req` (C.3), `manualEquivalent: true` na `T17` (C.4). **Dodatkowo rozstrzyga R7** (efekt `do:issuePhaseOneInvoice`). Potem `node tools/kk-codegen.mjs` i `node tools/kk-validate.mjs --strict`.
3. **`test-author`** — AC1–AC8 + AC4b + dziewięć przypadków brzegowych (RED), w granicach tabeli „Zawężona lista przypadków testowych”.
4. **`implementer-server`** — Server Action zamknięcia etapu I (wykonywana przez `dyspozytor`/`admin`), otwarcie rezerwacji etapu II, preselekcja ekipy po stronie wołającego.
5. **`notification-architect`** — `N8a` na `T17` w tej samej transakcji, bez literałów ID, z **jednym** `link` (do rezerwacji etapu II).
6. **`implementer-ui`** — **ma zadanie** (D3): akcja zamknięcia etapu I w panelu B2B. **Wyłącznie ona** — bez galerii zdjęć, bez podglądu dokumentów, bez ekranu montera.
7. **`reviewer`** + **`rls-security-auditor`** — jawność sprawdzenia roli (Prisma omija RLS).
