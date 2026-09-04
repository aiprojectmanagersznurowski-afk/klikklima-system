# WO: SEC-AUDIT-LOG-MANUAL-STATUS — ręczna zmiana statusu z wpisem audytowym

Status: **NIE gotowy do fazy kontraktowej.** Mapowanie kodu zamknięte, ale zakres zależy od pięciu decyzji człowieka (D1–D5), z których **D1, D2 i D3 rozstrzygają, co w ogóle jest przedmiotem tego wymagania**. Data: 2026-09-04.
Część 3 z 4 rozbicia `SEC-AUDIT-LOG` (część 1 `SEC-AUDIT-LOG-DELETE` — wykonana i scommitowana; część 2 `SEC-AUDIT-LOG-ROLE-CHANGE` — wykonana i scommitowana; pozostaje `NOTIFICATION-RESEND/CONTRACT-OVERRIDE`).

**To wymaganie różni się od dwóch poprzednich.** `delete` i `role_change` są rozpoznawalne po nazwie operacji — nie ma „normalnego usuwania”, które nie podlegałoby audytowi. `manual_status_change` takiej granicy nie ma: w tym repozytorium **jedenaście** ścieżek zapisu zmienia status, a większość to zwykła praca dyspozytora. Bez decyzji, gdzie leży granica, wymaganie albo zaleje rejestr szumem, albo pominie dokładnie te operacje, dla których powstało.

## Wymagania

- `SEC-AUDIT-LOG` (rodzic, `TODO`, HIGH) — `contracts/requirements.contract.mjs:319`. **Zostaje `TODO`** do czasu zarejestrowania wszystkich czterech dzieci.
- Nowe dziecko do zarejestrowania: **`SEC-AUDIT-LOG-MANUAL-STATUS`** (patrz „Zmiana kontraktu”).
- Sąsiaduje z: `SEC-AUDIT-LOG-DELETE` (`:331` — wzorzec zapisu, schemat `justification`, testy statyczne, które **ograniczają** to WO), `SEC-AUDIT-LOG-ROLE-CHANGE` (`:364` — wzorzec `.extend()` schematu), `SEC-AUDIT-LOG-APPEND-ONLY` (`:181`), `SEC-AUTHZ-B2B-MUTATIONS` (bramki `can()` w tych samych akcjach), `CRM-SAFE-RECORD-ACTIONS` (D7: to stamtąd pochodzi obecny kształt `returnToFunnel`/`archiveLost`), `LOGISTICS-SHIPPING-EFFECTS`.

## Kontekst kodu — pełna mapa zapisów statusu (zweryfikowane 2026-09-04 odczytem plików, nie z podsumowania)

Wyszukanie objęło `leady.update`/`updateMany`, `instalacje.update`, surowy SQL oraz każdy plik `actions.ts` w `apps/b2b-web/src/app/(dashboard)`. `apps/b2c-web` **nie ma katalogu `src`** — nie istnieje tam żadna ścieżka zapisu statusu. Nie ma też Field App w tym monorepo (`apps/` = `b2b-web`, `b2c-web`).

### Tabela: wszystkie ścieżki zmieniające status

| # | Funkcja (plik:linia) | Co zapisuje | Przejście wg kontraktu | Aktor wg kontraktu | Transakcja dziś | Wejście od operatora |
|---|---|---|---|---|---|---|
| 1 | `advanceLeadStatus` — `leads/actions.ts:626` | `leady.status` (dowolny cel z lokalnej mapy) | **13 różnych**, patrz niżej | mieszane: ADMIN, DISPATCHER, **CLIENT, SYSTEM, INSTALLER**, oraz **brak przejścia** | NIE (jedno `update`) | tylko `targetStatus` |
| 2 | `assignCrewToLead` — `leads/actions.ts:182` | `leady.status` → `HARDWARE_IN_WAREHOUSE` + `instalacje.zespol_id` | T05 `assignCrew` | ADMIN / MANUAL | TAK | `crewId` |
| 3 | `updateLeadAuditor` — `leads/[id]/actions.ts:81` | `leady.audytor_id` **oraz status** `NEW_LEAD`↔`AWAITING_AUDIT` | w przód T01; **w tył: brak przejścia w kontrakcie** | ADMIN / MANUAL | NIE | `audytorId` albo `null` |
| 4 | `returnToFunnel` — `leads/actions.ts:763` | `leady.status` → `AUDIT_COMPLETED` (+ `quoted_at`, `finalna_wycena_pln`) | T15 `returnToFunnel` | DISPATCHER / MANUAL | TAK | `resolution`, `newPrice` |
| 5 | `archiveLost` — `leads/actions.ts:841` | `leady.status` → `ARCHIVED_LOST` (+ `lost_reason`, `lost_reason_note`) | T16 `archiveLost` | DISPATCHER / MANUAL | TAK | `reason` z `LOST_REASONS`, `note` |
| 6 | `shipLogisticsOrder` — `logistics/actions.ts:105` | `leady.status` → `HARDWARE_IN_TRANSIT` + `logistyka_zamowienia.create` | T06 `shipByCourier` | DISPATCHER / MANUAL | TAK | `trackingNumber?` (opcjonalny!) |
| 7 | `bypassLogisticsOrder` — `logistics/actions.ts:144` | `leady.status` → `AWAITING_INSTALLATION` | T07 `deliverWithCrew` (`note`: „State Bypass — pomija E6”) | DISPATCHER / MANUAL | **NIE** | **tylko `leadId`** |
| 8 | `markAsDelivered` — `logistics/actions.ts:169` | `leady.status` → `AWAITING_INSTALLATION` + `logistyka_zamowienia.status_wysylki` | T08 `markDelivered` (`note`: „Webhook kuriera **LUB ręczna akcja dyspozytora**”) | **SYSTEM / WEBHOOK** | TAK | tylko `leadId` |
| 9 | `rollbackLogisticsOrder` — `logistics/actions.ts:217` | `leady.status` → `ROLLBACK_RESCHEDULING`, `bucket_entered_at`, `notatki_wewnetrzne` + efekty | T10/T11/T12 (`findTransition` po `action='rollback'`) | DISPATCHER / MANUAL | TAK, z `SELECT … FOR UPDATE` | `reason?` (opcjonalny, wolny tekst) |
| 10 | `updateInstallationStatus` — `installations/actions.ts:99` | `instalacje.status` (`PLANNED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`) **oraz przy `COMPLETED` literał `leady.status = "INSTALLATION_COMPLETED"`** | częściowo T09 `completeInstallation` | **INSTALLER** / MANUAL | **NIE — dwa osobne `prisma.*.update` poza transakcją** | `newStatus` |
| 11 | `releaseCrewSlot` / `suspendLogisticsSla` — `logistics/rollback-effects.ts:27,47` | `instalacje.status = CANCELLED`, `leady.logistics_sla_paused_at` | efekty `do:` przejść T10–T13 | — | wołane wewnątrz `tx` wywołującego | brak (funkcje pomocnicze, nie Server Action) |

**Nie istnieje żadna Server Action zmieniająca status serwisu ani usterki.** `services/actions.ts` i `incidents/actions.ts` mają wyłącznie odczyty i `delete…Action`. Pole `status` w tych modułach jest tylko czytane (`services/actions.ts:121,163`, `incidents/actions.ts:82`). Wymaganie **nie może** dziś pokryć „serwisu i usterki” — nie ma czego audytować.

**Nie istnieje żaden cron ani webhook zmieniający status.** `auto_rejected_reason = 'AUTO_REJECT_14_DAYS'` jest wyłącznie **czytany** w filtrze `getLeads` (`leads/actions.ts:378`); nic go nie zapisuje. T04 (`expireQuote`, SYSTEM/CRON) nie jest zaimplementowane.

### `advanceLeadStatus` — dlaczego to jest sedno tego WO

Funkcja ma **własną, równoległą maszynę stanów** (`ALLOWED_TRANSITIONS`, `leads/actions.ts:604-621`) i nie woła ani `canTransition`, ani `findTransition`. Zestawienie jej celów z `contracts/funnel.contract.mjs`:

| from → to (mapa lokalna) | Przejście w kontrakcie | Aktor kontraktowy | Guardy kontraktowe | Sprawdzane w kodzie |
|---|---|---|---|---|
| `NEW_LEAD → AWAITING_AUDIT` | T01 | ADMIN | 3 guardy audytora | tylko `audytor_id != null` |
| `AWAITING_AUDIT → NEW_LEAD` | **BRAK** | — | — | — |
| `AUDIT_COMPLETED → AWAITING_CREW_ASSIGNMENT` | T03 | **CLIENT** | `quoteNotExpired`, `termsAccepted`, `slotAvailable` | **żaden** |
| `AUDIT_COMPLETED → QUOTE_REJECTED` | T04 | **SYSTEM/CRON** | — | — (ustawia `bucket_entered_at`) |
| `AWAITING_CREW_ASSIGNMENT → HARDWARE_IN_WAREHOUSE` | T05 | ADMIN | `crewCertsValid`, `crewCalendarFree` | **żaden** (ekipa nie jest wybierana) |
| `HARDWARE_IN_WAREHOUSE → HARDWARE_IN_TRANSIT` | T06 | DISPATCHER | `trackingIdPresent` | **żaden — wysyłka bez listu przewozowego** |
| `HARDWARE_IN_WAREHOUSE → AWAITING_INSTALLATION` | T07 (bypass) | DISPATCHER | — | — |
| `HARDWARE_IN_TRANSIT → AWAITING_INSTALLATION` | T08 | **SYSTEM/WEBHOOK** | — | — |
| `AWAITING_INSTALLATION → INSTALLATION_COMPLETED` | T09 | **INSTALLER** | `allPhasesCompleted` | **żaden** |
| `* → ROLLBACK_RESCHEDULING` (4 źródła) | T10–T13 (T13 aktor **CLIENT**) | DISPATCHER ×3, CLIENT ×1 | — | — (**efekty `do:releaseCrewSlot`, `do:suspendLogisticsSla` NIE są wykonywane**) |
| `ROLLBACK_RESCHEDULING → AWAITING_CREW_ASSIGNMENT` | T14 | **CLIENT** | `slotAvailable` | **żaden** |

To jest jedna Server Action, przez którą operator może wykonać **sześć** przejść przypisanych w kontrakcie komuś innemu (klientowi, systemowi, monterowi) oraz **jedno, którego kontrakt w ogóle nie zna**, w każdym przypadku z pominięciem wszystkich guardów i wszystkich efektów. Jeżeli `manual_status_change` ma cokolwiek znaczyć, to znaczy **to**.
Skutek uboczny jest już udokumentowany w kodzie: komentarz w `rollbackLogisticsOrder` (`logistics/actions.ts:267-272`) opisuje leada „osieroconego przez inną ścieżkę zmiany statusu” — czyli przez `advanceLeadStatus`, który wprowadza leada do bucketu bez zwolnienia slotu ekipy i bez wstrzymania SLA.

### Czy kontrakt już koduje rozróżnienie „normalne” / „wyjątkowe”? — NIE, ale koduje dwa lepsze kryteria

Przeszukane atrybuty `TRANSITIONS` (`contracts/funnel.contract.mjs:67-171`): `id`, `from`, `to`, `action`, `actor`, `trigger`, `guards`, `effects`, `req`, `status`, `note`. Do tego `STATES[].kind` (`STAGE`|`BUCKET`) i `terminal`.

- **`trigger: 'MANUAL'` jest bezużyteczny jako kryterium.** Mają go T01 (przypisanie audytora) i T05 (przypisanie ekipy) — czyli codzienna praca dyspozytora. Użycie go daje dokładnie ten scenariusz, przed którym ostrzegał człowiek: rejestr utonie w szumie.
- **Nie ma flagi „wyjątkowe”.** Wyjątkowość T07 zapisana jest **wyłącznie w polu `note`** jako polski tekst „State Bypass — pomija E6.” — dla maszyny to komentarz. Tak samo T08: „Webhook kuriera LUB ręczna akcja dyspozytora (ten sam action)” — kontrakt **wie**, że to przejście bywa ręczne, ale wie to tylko prozą.
- **`bind.transition` z `notifications.contract.mjs` NIE nadaje się na źródło listy.** Sprawdzone: to obiekt `{ kind: 'TRANSITION', transition: 'T01' }`, a w `N_ROLLBACK` (`notifications.contract.mjs:37`) wartością jest string `'T10|T11|T12|T13'` — pipe'y bez parsera, jak odnotowano w WO logistyki. Ta lista grupuje przejścia po tym, że **wysyłają to samo powiadomienie**, a nie po tym, że są wyjątkowe; przypięcie do niej audytu związałoby dwie niezależne osie i przy pierwszej zmianie katalogu powiadomień rozjechałoby zakres audytu. **Nie używać.**

Dwa kryteria **dają się policzyć z dzisiejszego kontraktu, bez nowych pól**:

- **K1 — niezgodność aktora.** Operacja jest wykonana przez operatora panelu B2B (`admin`/`dyspozytor`), a `TRANSITIONS[].actor` dla tego przejścia to `CLIENT`, `SYSTEM`, `INSTALLER` lub `AUDITOR`. Człowiek przejmuje krok, który należy do kogoś innego albo do automatu. Wyliczalne wprost z `TRANSITIONS`.
- **K2 — brak przejścia.** Para (`from`, `to`) nie ma odpowiednika w `TRANSITIONS`. Maszyna stanów nie zna tego ruchu (dziś: `AWAITING_AUDIT → NEW_LEAD`). Wyliczalne wprost.
- **K3 — krawędź bucketu** (`STATE_META[from].kind === 'BUCKET'` lub `STATE_META[to].kind === 'BUCKET'`): wyjście z lejka albo powrót do niego. Wyliczalne, ale obejmuje rollback dyspozytora, który wg K1 jest „normalny” — patrz D2.

Czego **żadne** z tych kryteriów nie łapie: **T07 `bypassLogisticsOrder`** (aktor DISPATCHER, przejście istnieje, `STAGE → STAGE`) — czyli dokładnie przycisk „Dostawa z ekipą (Bypass)”, od którego wyszła cała dyskusja. Domknięcie tego bez listy literałów wymaga **nowego pola w kontrakcie** — patrz D3.

### Wejście od operatora — dzisiejszy, niejednolity kształt

Hipoteza z zadania („`bypassLogisticsOrder` ma już pole na powód pominięcia kuriera”) **jest nieprawdziwa**. Sprawdzone: `bypassLogisticsOrder(leadId)` — jeden argument, zero uzasadnienia, jeden `prisma.leady.update` poza transakcją, wywoływany z `DropdownMenuItem` bez potwierdzenia (`logistics-client.tsx:293`). Faktyczny stan pól „powodu”:

| Funkcja | Pole powodu | Charakter |
|---|---|---|
| `archiveLost` | `reason` **obowiązkowy**, ze słownika `LOST_REASONS`; `note` obowiązkowa przy `requiresNote` | słownik analityczny, cel biznesowy ≠ audytowy |
| `rollbackLogisticsOrder` | `reason?` **opcjonalny**, wolny tekst, doklejany do `notatki_wewnetrzne` | notatka operacyjna, nie dowód |
| `returnToFunnel` | `resolution` + `newPrice` | decyzja cenowa, nie uzasadnienie |
| `advanceLeadStatus`, `bypassLogisticsOrder`, `markAsDelivered`, `updateInstallationStatus`, `updateLeadAuditor` | **brak** | — |

Żadne z tych pól nie spełnia wymogu bazy: `justification` `NOT NULL` + CHECK `btrim(justification) >= 10`, `legal_basis` `NOT NULL` z pięcioelementowego słownika.

### Stan bazy i kontraktu (bez migracji)

- `audit_log` **jest na żywej bazie** (potwierdzone przy `SEC-AUDIT-LOG-DELETE`): `audit_log_operation_check` dopuszcza `'manual_status_change'`, `audit_log_resource_check` dopuszcza `'leads'` i `'installations'`. `legalBases` zawiera już neutralne `OPERATIONAL_ERROR` i `OTHER`. **Migracja nie jest potrzebna.**
- Macierz RBAC: `leads.update = ['admin','dyspozytor']`, `installations.update = ['admin','dyspozytor','monter:own']`, `shipments.update = ['admin','dyspozytor']`. **Bez zmian** — wszystkie audytowane akcje już mają właściwe bramki (domknięte przez `SEC-AUTHZ-B2B-MUTATIONS` i commit `6a43a21`).
- `RESOURCES` **nie zawiera** `logistics` — zapisy z `logistics/actions.ts` idą do tabeli `leady`, więc `resource = 'leads'`, `record_id` = id leada. Ta sama pułapka co przy `deleteLogisticsOrderAction`.

### Ograniczenia narzucone przez istniejące testy statyczne (przeczytać przed pisaniem czegokolwiek)

`apps/b2b-web/tests/sec-audit-log-delete-static.test.ts:253` — **co najwyżej jeden plik** w `apps/b2b-web/src` (poza `customers/anonymize-client-schema.ts`) zawiera `z.string().trim().min(10)`. Schemat wejścia dla tego WO **musi** powstać przez `.extend()` na `lib/audit/delete-justification-schema.ts`, wzorem `role-change-schema.ts`. `:230` — pełny słownik `legalBases` nie może wystąpić jako literały; `<select>` iteruje po `AUDIT_REQUIREMENTS.legalBases`.

Testy, które dotykają audytowanych funkcji i mogą zzielenieć/sczerwienieć przy zmianie sygnatur: `leads-status-gates.test.ts`, `logistics-authz-gates.test.ts`, `installations-authz-gates.test.ts`, `leads-return-to-funnel.test.ts`, `leads-auditor-scope.test.ts`, `logistics-rollback-effects.test.ts`.

## Zmiana kontraktu

**WYMAGANA. Zakres zależy od D3.**

1. **Rejestracja `SEC-AUDIT-LOG-MANUAL-STATUS`** jako dziecka `SEC-AUDIT-LOG`, wzorem `SEC-AUDIT-LOG-DELETE` (`:331`) i `SEC-AUDIT-LOG-ROLE-CHANGE` (`:364`): `status: 'TODO'`, `domain: 'security'`, `risk: 'HIGH'`. Bez tego `kk-trace` nie ma czego liczyć. `source` musi odnotować: pełną listę objętych funkcji po rozstrzygnięciu D1, fakt braku migracji (CHECK dopuszcza `manual_status_change`), brak zmian w macierzy RBAC, oraz że `resource` dla logistyki to `'leads'`.
2. **`funnel.contract.mjs` — pole klasyfikujące (TYLKO jeśli D3 = tak).** Dodanie do `TRANSITIONS` jawnego atrybutu, np. `override: true`, dla przejść uznanych za wyjątkowe (kandydat pewny: **T07**; do rozważenia T08, T15, T16, T10–T13). Pociąga `node tools/kk-codegen.mjs` i regenerację `packages/contracts/src/generated/funnel.ts`. To jest **jedyny** sposób, żeby ósme przejście dodane za pół roku nie wypadło z audytu przez przeoczenie — alternatywą jest lista literałów nazw funkcji w kodzie aplikacji, której nikt nie zaktualizuje.
3. **`AUDIT_REQUIREMENTS` — BEZ ZMIAN** (rekomendacja, patrz D4). `legalBases` zostaje pięcioelementowe.
4. **Macierz RBAC — BEZ ZMIAN.**
5. **Schemat Prismy i migracje — ŻADNE.**

## Punkty decyzyjne (do rozstrzygnięcia przez człowieka PRZED RED)

### D1 — zamknięta lista funkcji objętych audytem

To jest decyzja właściwa dla całego WO. Poniżej rekomendacja z uzasadnieniem **każdej** pozycji; kolumna „głos” jest propozycją analityka, nie rozstrzygnięciem.

**Rekomendowane WŁĄCZENIE:**

| Funkcja | Dlaczego |
|---|---|
| `advanceLeadStatus` (**warunkowo, wg K1/K2**) | Jedyny generyczny setter statusu; przez niego przechodzi 6 przejść przypisanych CLIENT/SYSTEM/INSTALLER i 1 nieistniejące w kontrakcie, wszystkie z pominięciem guardów i efektów. Audyt **tylko dla wywołań spełniających K1 lub K2** — przejścia zgodne z aktorem (T01, T05, T06, T10–T12) zostają bez wpisu, żeby nie zalać rejestru. |
| `bypassLogisticsOrder` | Jawne pominięcie etapu E6 lejka („Pomiń kuriera”). Wyjątek z definicji, nazwany tak w kontrakcie (`note` T07) i w UI („Dostawa z ekipą (Bypass)”). Nie łapie go żadne kryterium wyliczalne → wymaga D3. |
| `rollbackLogisticsOrder` | Przerwanie opłaconego, zaplanowanego procesu; zwalnia slot ekipy i wstrzymuje SLA. Ma już opcjonalny `reason`, który dziś ginie w `notatki_wewnetrzne` — audyt zamienia notatkę w dowód. |
| `archiveLost` | Przejście terminalne (`ARCHIVED_LOST.terminal = true`) — po nim nie ma wyjścia w maszynie stanów, więc jest to operacja nieodwracalna z poziomu produktu, w tym samym rzędzie ryzyka co `delete`. |
| `returnToFunnel` | Ręczne przywrócenie leada z bucketu, z możliwością **zmiany ceny** (`newPrice`) i restartu zegara ważności wyceny. Nadużycie zmienia kwotę na dokumencie handlowym. |
| `updateInstallationStatus` — **tylko gałąź `COMPLETED`** | Ustawia `leady.status = "INSTALLATION_COMPLETED"` literałem, z pominięciem T09 (aktor INSTALLER, guard `allPhasesCompleted`) i wszystkich trzech efektów (`N8`, `do:computeNextServiceDate`, `do:generateHandoverProtocol`). Zamyka lead finansowo. Patrz D5 — wymaga refaktoru do transakcji. |

**Rekomendowane WYKLUCZENIE:**

| Funkcja | Dlaczego wykluczona |
|---|---|
| `assignCrewToLead` | T05, aktor ADMIN, guardy certyfikatów i kalendarza **są sprawdzane**, efekt `do:createShipmentOrder` realizowany. Wzorcowy, normalny krok procesu. |
| `shipLogisticsOrder` | T06, aktor DISPATCHER, normalny bieg. **Zastrzeżenie:** guard `trackingIdPresent` nie jest egzekwowany (`trackingNumber?` opcjonalny) — to defekt, ale defekt **guardu**, do domknięcia w `LOGISTICS-SHIPPING-EFFECTS`, nie audytem. |
| `markAsDelivered` | Sporne — kontrakt przypisuje T08 aktorowi SYSTEM/WEBHOOK, więc wg K1 **kwalifikuje się**, ale `note` T08 wprost dopuszcza ręczne wykonanie przez dyspozytora jako równoprawne. Rekomendacja: **wykluczyć**, bo to potwierdzenie faktu fizycznego (paczka przyszła), a nie obejście reguły. Wymaga świadomej zgody, bo łamie K1. |
| `updateLeadAuditor` | Zmiana statusu jest tu **skutkiem ubocznym** przypisania audytora, a nie intencją operatora. Gałąź w tył (`AWAITING_AUDIT → NEW_LEAD`, odpięcie audytora) formalnie spełnia K2 (przejścia nie ma w kontrakcie) — ale poprawną odpowiedzią jest **uzupełnienie kontraktu o to przejście**, nie audytowanie dziury w nim. Osobne ID. |
| `updateInstallationStatus` — gałęzie `PLANNED`/`IN_PROGRESS`/`CANCELLED` | `instalacje.status` to enum wykonawczy poza maszyną lejka; te trzy wartości nie ruszają `leady.status`. **Zastrzeżenie:** ręczne `CANCELLED` bez rollbacku leada tworzy niespójność, ale to defekt spójności, nie audytu. |
| `releaseCrewSlot` / `suspendLogisticsSla` | Nie są Server Actions, wołane wewnątrz `tx` wołającego. Audytowanie ich dałoby drugi wpis o tej samej operacji. |
| akcje serwisów i usterek | **Nie istnieją.** Nie ma czego audytować (patrz mapa). |
| ścieżki cron/webhook (T04, T08-webhook) | Niezaimplementowane. Gdy powstaną, `manual_status_change` będzie dla nich niewłaściwą operacją z definicji. |

### D2 — czy rollback dyspozytora (T10–T12) jest „ręczny”

Kryterium K1 mówi **nie** (aktor DISPATCHER, przejście przewidziane). Kryterium K3 (krawędź bucketu) mówi **tak**. Rekomendacja: **tak, audytować** — rollback zwalnia slot ekipy, wstrzymuje SLA i wysyła klientowi `N_ROLLBACK`; jest to przerwanie umówionego montażu, a nie krok naprzód. Konsekwencja przyjęcia: K3 wchodzi do kryterium obok K1/K2, a `advanceLeadStatus` audytuje również swoje cztery ścieżki do `ROLLBACK_RESCHEDULING` i wyjście `ROLLBACK_RESCHEDULING → AWAITING_CREW_ASSIGNMENT`. Konsekwencja odrzucenia: rollback z panelu logistyki zostaje bez śladu, a `rollbackLogisticsOrder` wypada z D1.

### D3 — pole `override` w `funnel.contract.mjs` kontra lista literałów w kodzie

Bez nowego pola `bypassLogisticsOrder` (T07) można objąć audytem **wyłącznie** przez wymienienie nazwy funkcji w kodzie aplikacji. Rekomendacja: **dodać pole**, bo wtedy bramka kontraktu (`kk-validate`, `kk-codegen --check`) pilnuje kompletności, a test statyczny może brzmieć „każde przejście z `override: true` ma ścieżkę zapisu z wpisem audytowym” zamiast „te cztery funkcje mają wpis”. Koszt: osobne okno kontraktowe, regeneracja `packages/contracts/src/generated/funnel.ts`, przegląd wszystkich 17 przejść przez człowieka (bo trzeba je zaklasyfikować jednorazowo). Wariant odrzucenia: T07 obejmuje literalna lista w kodzie i **jawny** zapis w „Ryzykach”, że ósme przejście trzeba będzie dopisać ręcznie.

### D4 — kształt wejścia: `justification` + `legalBasis` dla każdej z funkcji?

Baza wymaga obu, `NOT NULL`. Warianty:
- **(a) Jednolicie** — każda audytowana akcja dostaje `input: { justification, legalBasis }` przez `.extend()` schematu bazowego. Spójne z DELETE i ROLE-CHANGE, ale dokłada dialog do operacji wykonywanych dziesiątki razy dziennie (rollback, bypass) i zmienia sygnatury pięciu funkcji → dotyka sześciu istniejących plików testowych.
- **(b) Pogodzenie z istniejącymi polami** — `archiveLost` ma już obowiązkowy `reason` ze słownika i `note`; `rollbackLogisticsOrder` ma `reason`. Serwer składa `justification` z tych pól (np. `PRICE_TOO_HIGH | <note>`) i przypisuje `legalBasis = 'OTHER'` bez pytania operatora. Zero nowych dialogów, ale operator nigdy nie widzi, że jego notatka staje się dowodem — a przy `rollbackLogisticsOrder` `reason` jest **opcjonalny**, więc trzeba go uczynić obowiązkowym (i tak zmiana UI) albo dopuścić wypełniacz, co złamie CHECK ≥10 znaków.
- **(c) Mieszanie** — `justification` obowiązkowy tam, gdzie operacja jest rzadka i nieodwracalna (`archiveLost`, `returnToFunnel`, `advanceLeadStatus` wg K1/K2, `updateInstallationStatus`→COMPLETED), a składany automatycznie tam, gdzie jest częsta (`bypassLogisticsOrder`, `rollbackLogisticsOrder`).

*Rekomendacja:* **(a) dla przejść wyłapanych przez K1/K2 + `archiveLost` + `returnToFunnel`**, **(b) dla rollbacku i bypassu** — z tym, że `reason` w obu staje się **obowiązkowy** i przechodzi walidację ≥10 znaków po `trim`. Uzasadnienie: dowód, który operator wpisał nieświadomie, jest nadal dowodem, ale pole, którego można nie wypełnić, nie jest. `legalBasis` w wariancie (b) ustalany przez serwer na `'OTHER'`, bez wyboru — słownik RODO nie ma sensownej wartości dla „pominąłem kuriera”. **To wymaga świadomej zgody**, bo psuje statystykę po `legal_basis` (ta sama uwaga co D1 w ROLE-CHANGE).

### D5 — transakcyjność: gdzie audyt jest doklejką, a gdzie refaktorem

Sprawdzone dla każdej kandydatki:

| Funkcja | Dziś | Koszt dodania wpisu |
|---|---|---|
| `archiveLost`, `returnToFunnel`, `rollbackLogisticsOrder` | `prisma.$transaction` już jest (rollback dodatkowo z `FOR UPDATE`) | **Niski** — jedno `tx.auditLog.create` w istniejącym bloku |
| `advanceLeadStatus` | jedno `prisma.leady.update`, **brak transakcji** | **Średni** — trzeba opakować w `$transaction`; przy tej okazji ujawni się, że funkcja nie blokuje wiersza (dwa równoległe przejścia mogą oba przejść walidację `ALLOWED_TRANSITIONS`) |
| `bypassLogisticsOrder` | jedno `prisma.leady.update`, **brak transakcji, brak sprawdzenia stanu wyjściowego** | **Średni** — jw.; dziś bypass przechodzi z **dowolnego** statusu, bo nie ma żadnego odczytu przed zapisem |
| `updateInstallationStatus` | **dwa osobne `prisma.*.update` poza transakcją** — `instalacje` i `leady` | **Wysoki.** To już dziś jest defekt: awaria drugiego zapisu zostawia instalację `COMPLETED` przy leadzie w `AWAITING_INSTALLATION`. Dodanie audytu wymaga naprawy tej niespójności **najpierw** — inaczej wpis audytowy dowodziłby stanu, który nie zaszedł w całości |

Decyzja: czy `updateInstallationStatus` wchodzi do tego WO razem z refaktorem, czy zostaje odłożone do osobnego ID (proponowana nazwa `INST-STATUS-TRANSACTIONAL`) i wraca do audytu dopiero po nim. *Rekomendacja:* **odłożyć** — naprawa spójności międzytabelowej to zmiana logiki domenowej, nie audytu, i nie mieści się w limicie 3 iteracji GREEN razem z resztą.

## Kryteria akceptacji (szkic — do przepisania po D1–D5)

Kryteria poniżej są napisane dla rekomendowanego wariantu (D1 wg rekomendacji, D2 = tak, D3 = tak, D4 = mieszany, D5 = bez `updateInstallationStatus`). **Zmiana którejkolwiek decyzji zmienia tę listę** — dlatego WO nie jest gotowy do RED.

- [ ] AC1 — **Wpis powstaje dla ręcznej zmiany statusu.** Wykonanie każdej z objętych operacji tworzy dokładnie jeden wiersz `audit_log` z `operation = 'manual_status_change'`, `resource = 'leads'`, `record_id` = identyfikator leada (nie zamówienia logistycznego — `RESOURCES` nie ma wartości `logistics`).
- [ ] AC2 — **Transakcyjność.** Nie istnieje ścieżka kodu zmieniająca `leady.status` w objętych akcjach poza transakcją zawierającą `auditLog.create`. Gdy wpis zawiedzie, status **nie jest zmieniony**; gdy zmiana statusu zawiedzie, wpis nie powstaje. Dotyczy również akcji, które dziś nie mają `$transaction` (`advanceLeadStatus`, `bypassLogisticsOrder`).
- [ ] AC3 — **Zwykła praca nie generuje wpisów.** Przypisanie ekipy (`assignCrewToLead`), wysyłka kurierem z numerem listu (`shipLogisticsOrder`), przypisanie audytora oraz przejścia przez `advanceLeadStatus` zgodne z aktorem kontraktowym **nie tworzą** żadnego wiersza w `audit_log`. Test wykonuje pełną, poprawną ścieżkę lejka E1→E8 i dowodzi, że liczba wpisów `manual_status_change` wynosi tyle, ile wykonano operacji wyjątkowych — nie tyle, ile było zmian statusu.
- [ ] AC4 — **Klasyfikacja pochodzi z kontraktu, nie z listy nazw funkcji.** Rozstrzygnięcie „ta zmiana jest ręczna” liczone jest z `TRANSITIONS` (aktor / brak przejścia / krawędź bucketu / pole `override`), a nie z literałowej listy nazw. Test statyczny: dopisanie do `TRANSITIONS` przejścia spełniającego kryterium, bez ścieżki zapisu z audytem, powoduje **czerwony** test.
- [ ] AC5 — **Kompletność wpisu.** `actor_email` z sesji (nigdy z parametru akcji), `actor_role` utrwalona z chwili operacji, `justification` ≥10 znaków po `trim`, `legal_basis` ze słownika kontraktu.
- [ ] AC6 — **Bramka roli przed jakimkolwiek zapytaniem.** Role bez `can(role,'leads','update') === 'yes'` (`audytor`, `monter`) są odrzucane po stronie serwera, bez `leady.update` i bez `auditLog.create`; `kk-authz-gate` nie wykrywa `can()` po Prismie.
- [ ] AC7 — **Brak uzasadnienia = brak zmiany statusu.** Wywołanie objętej akcji bez `justification`/`legalBasis` (albo z `reason` krótszym niż 10 znaków po `trim`, wg D4) jest odrzucone **bez zmiany statusu**. Nie istnieje sygnatura z domyślnym uzasadnieniem ani z parametrem opcjonalnym.
- [ ] AC8 — **Współbieżność.** Dwa równoległe wywołania zmieniające status tego samego leada kończą się jednym sukcesem; liczba wpisów `manual_status_change` równa się liczbie faktycznych zmian statusu. O wyniku rozstrzyga baza (blokada wiersza), nie odczyt poprzedzający zapis w JS.
- [ ] AC9 — **Idempotencja / no-op.** Ustawienie statusu identycznego z bieżącym nie zmienia rekordu i nie tworzy wpisu. Wielokrotne wywołanie tej samej operacji daje jeden wpis na jedną faktyczną zmianę.
- [ ] AC10 — **Jedno źródło progu i słownika.** Nie przybywa drugiego pliku z `z.string().trim().min(10)` (limit z `SEC-AUDIT-LOG-DELETE` pozostaje spełniony); słownik `legalBases` nie występuje jako literały w `apps/b2b-web/src`.
- [ ] AC11 — **Wpisu nie da się poprawić.** `UPDATE`/`DELETE` na wierszu odrzucone przez `audit_log_append_only_trg` również przez Prismę. Dzielone z `SEC-AUDIT-LOG-APPEND-ONLY`; ten sam poziom dowodu (statyczny nad tekstem migracji — suite nie ma połączenia z żywym Postgresem).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Przejście, którego kontrakt nie zna** (`AWAITING_AUDIT → NEW_LEAD` przez `advanceLeadStatus`): albo wpis audytowy, albo odmowa — nigdy cicha zmiana. Test musi rozstrzygać, które z dwóch, na podstawie D1.
- **Ta sama zmiana statusu dwiema drogami:** `HARDWARE_IN_WAREHOUSE → AWAITING_INSTALLATION` da się wykonać przez `bypassLogisticsOrder` **i** przez `advanceLeadStatus` (pozycja „Dostawa z ekipą (Bypass) → E7” w `leads-client.tsx`). Obie muszą kończyć się wpisem — inaczej audyt ma obejście dostępne z sąsiedniej zakładki.
- **Rollback dwiema drogami:** `rollbackLogisticsOrder` (z efektami `releaseCrewSlot`/`suspendLogisticsSla`) i `advanceLeadStatus → ROLLBACK_RESCHEDULING` (bez efektów). Test musi pokryć obie i utrwalić fakt, że druga zostawia leada osieroconego (patrz komentarz `logistics/actions.ts:267-272`).
- **Współbieżność bypass ↔ rollback** na tym samym leadzie: dwa wykluczające się przejścia z `HARDWARE_IN_WAREHOUSE`. Jeden sukces, jeden wpis, stan końcowy odpowiada dokładnie jednemu z nich.
- **Ponowne uruchomienie tej samej operacji** (idempotencja): drugi klik „Paczka dostarczona” / „Bypass” nie tworzy drugiego wiersza.
- **`justification` dokładnie 10 znaków po `trim`** przechodzi; `"  abcdefghi  "` (9 po `trim`) nie — **na serwerze**, nie tylko w formularzu.
- **Tożsamość po e-mailu:** `actor_email` wyłącznie z sesji Supabase; `record_id` z parametru, nigdy e-mail (klasa podatności „tożsamość po wartości e-maila”).
- **Lead nieistniejący / status zmieniony pod operatorem** między renderem listy a kliknięciem: odmowa domenowa, brak wpisu.
- **Rola `monter` z `installations.update = 'monter:own'`** — jeśli `updateInstallationStatus` wejdzie do zakresu (D5), zakres `:own` musi być egzekwowany przed zapisem i przed wpisem.
- **CHECK bazy jako druga linia:** `operation` spoza sześciu wartości `mustLog` albo `resource` spoza `RESOURCES` odrzucone przez bazę — dowód, że kod używa `'manual_status_change'` i `'leads'`.

## Poza zakresem

- **Naprawa `advanceLeadStatus` jako maszyny stanów.** Fakt, że lokalna mapa `ALLOWED_TRANSITIONS` jest równoległa do kontraktu i pomija wszystkie guardy oraz efekty (`N5`, `N8`, `do:releaseCrewSlot`, `do:computeNextServiceDate`, …), jest **poważniejszym** defektem niż brak audytu. To wymaganie go **dokumentuje i audytuje, ale nie naprawia**. Osobne ID, propozycja: `FNL-ADVANCE-STATUS-CONTRACT-BOUND`.
- **Egzekwowanie guardu `trackingIdPresent`** w `shipLogisticsOrder` (`trackingNumber?` jest opcjonalny → wysyłka bez listu przewozowego i bez `N5`) — należy do `LOGISTICS-SHIPPING-EFFECTS`.
- **Transakcyjność `updateInstallationStatus`** (dwa `update` poza transakcją) — osobne ID (D5).
- **Uzupełnienie kontraktu o przejście `AWAITING_AUDIT → NEW_LEAD`** (odpięcie audytora) — brakująca krawędź maszyny stanów, nie temat audytowy.
- **Powiadomienia.** Żadna z audytowanych operacji nie zaczyna ani nie przestaje wysyłać SMS/e-mail w ramach tego WO. Kolejka i katalog powiadomień bez zmian.
- **Audyt statusów serwisów i usterek** — nie istnieją ścieżki zapisu; wymaganie wróci, gdy powstaną.
- **Ścieżki cron/webhook** (T04 `expireQuote`, webhook kuriera do T08) — niezaimplementowane, a gdy powstaną, będą operacją automatyczną, nie `manual_status_change`.
- **Widok przeglądania `audit_log` w panelu, eksport, retencja** (`retentionDays = 1825`).
- `before_snapshot` / kolumny „przed–po” — kolumny nie ma na bazie (rozstrzygnięcie człowieka, okno `SEC-RODO-DELETE-RECONCILE`). „Z jakiego statusu na jaki” trzeba więc zmieścić w `justification` albo pogodzić się z jego brakiem — ta sama decyzja co D2 w `SEC-AUDIT-LOG-ROLE-CHANGE`, i **jeśli tam przyjęto wariant (b) z prefiksem, tu należy zrobić tak samo**, żeby nie powstały dwa wzorce.
- **Ochrona ostatniego admina** (`SEC-LAST-ADMIN-GUARD`) — bez związku, odnotowane tylko dla ciągłości rozbicia.

## Ryzyka i nieznane

- **Największe ryzyko tego WO to rozmiar, nie trudność.** Pięć do sześciu funkcji w czterech plikach, z których dwie wymagają wprowadzenia transakcji, a wszystkie mają istniejące, zielone testy autoryzacji (`logistics-authz-gates`, `leads-status-gates`, `installations-authz-gates`, `leads-return-to-funnel`, `logistics-rollback-effects`). Zmiana sygnatur o obowiązkowy `input` przestawi te testy — to jest praca `test-author`, ale trzeba ją zaplanować, a nie odkryć w GREEN 2/3.
- **Bez D3 wymaganie ma wbudowaną datę wygaśnięcia.** Lista nazw funkcji w kodzie aplikacji nie ma żadnego mechanizmu, który zmusi autora ósmego przejścia do jej aktualizacji. Dokładnie ten sam wzorzec, który doprowadził do powstania `ALLOWED_TRANSITIONS` równoległego do kontraktu.
- **Kontrakt nie odróżnia „ręcznego” od „normalnego” i nie jest jasne, czy powinien.** K1 (niezgodność aktora) jest eleganckie, ale opiera się na założeniu, że pole `actor` w `TRANSITIONS` opisuje **kto ma prawo**, a nie **kto zwykle**. Dla T08 kontrakt sam sobie przeczy: `actor: 'SYSTEM'` plus `note` dopuszczająca dyspozytora. Jeżeli człowiek uzna, że `actor` jest tylko poglądowe, K1 upada i zostaje wyłącznie lista literałów albo nowe pole (D3).
- **`legalBases` jest słownikiem RODO** i nie pasuje do operacji lejkowej. Przy wariancie D4(b) wszystkie wpisy bypassu i rollbacku będą miały `OTHER`, co zmiesza je z usunięciami w statystyce. Ta sama cena co przy `ROLLBACK-CHANGE`, przyjęta świadomie albo nie przyjęta wcale.
- **Obowiązkowe uzasadnienie przy rollbacku może zostać obejściem samo w sobie.** Operacja wykonywana kilka razy dziennie z wymuszonym polem 10 znaków wygeneruje „aaaaaaaaaa”. Rejestr będzie formalnie kompletny i dowodowo pusty. Nie ma na to rozwiązania technicznego — jest to argument za D4 wariantem mieszanym i za tym, żeby lista objętych operacji była **krótka**.
- **Nie wiadomo, ile z tych operacji zostanie po naprawie `advanceLeadStatus`.** Jeżeli ta funkcja zostanie związana z kontraktem (osobne ID), część przejść po prostu zniknie z panelu zamiast być audytowana. Kolejność tych dwóch prac jest istotna i nie jest oczywista — patrz „Fale”.

## Propozycja podziału na fale (zakres jest za szeroki na jeden WO)

Rekomendowana kolejność. Fale A–D powstają jako **osobne wpisy w rejestrze** albo jako jedno wymaganie z fazowanym `acceptance` — do decyzji `contract-steward`, ale **nie jako jeden przebieg RED→GREEN**.

- **Fala 0 — kontrakt (blokująca).** Rejestracja `SEC-AUDIT-LOG-MANUAL-STATUS` + (jeśli D3) pole `override` w `TRANSITIONS` i regeneracja. Rola: `contract-steward`. Bez tego nie ma czego tagować i nie ma z czego liczyć klasyfikacji.
- **Fala A — mechanizm klasyfikujący + `archiveLost` i `returnToFunnel`.** Najtańsza (obie mają już `$transaction`), a wymusza powstanie wspólnego helpera „czy to ręczna zmiana” i schematu przez `.extend()`. Dwie funkcje = kontrolowany zakres, wzorzec do skopiowania w kolejnych falach.
- **Fala B — logistyka:** `bypassLogisticsOrder` (dochodzi transakcja + sprawdzenie stanu wyjściowego, którego dziś nie ma) i `rollbackLogisticsOrder` (transakcja z `FOR UPDATE` już jest; `reason` staje się obowiązkowy). Zależna od D2 i D4.
- **Fala C — `advanceLeadStatus`.** Najszersza i najbardziej ryzykowna: transakcja, blokada wiersza, klasyfikacja per przejście, przebudowa `leads-status-gates.test.ts`. **Wykonać dopiero po A i B**, żeby wzorzec był ustalony.
- **Fala D — `updateInstallationStatus`.** Tylko po wcześniejszej naprawie transakcyjności (D5). Jeżeli człowiek nie zdecyduje inaczej, ta fala **wypada z tego WO** i wraca jako osobne wymaganie.

Kolejność ról w każdej fali: człowiek (D1–D5, jednorazowo przed Falą 0) → `contract-steward` → `test-author` (RED) → `implementer-server` → `implementer-ui` → `reviewer`.
