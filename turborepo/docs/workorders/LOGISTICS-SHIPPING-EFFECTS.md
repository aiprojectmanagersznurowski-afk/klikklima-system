# WO: LOGISTICS-SHIPPING-EFFECTS — efekty przejść E5→E6, bypass i rollback w panelu logistyki

## Wymagania
- `FNL-E5-E6` (wysyłka, efekt `N5`)
- `FNL-E5-BYPASS` (pominięcie E6, jawny brak `N5`)
- `FNL-ROLLBACK` (HIGH — `N_ROLLBACK`, `I4`, `do:releaseCrewSlot`, `do:suspendLogisticsSla`)
- pośrednio dotknięte, NIE realizowane tutaj: `NTF-QUEUE-WINDOW`, `NTF-RETRY`, `NTF-POLY`, `NTF-HISTORY`, `NTF-CATALOG-PARITY`

Kontrakt (`contracts/funnel.contract.mjs`):
- T06 `HARDWARE_IN_WAREHOUSE → HARDWARE_IN_TRANSIT`, `effects: ['N5']`
- T07 (bypass) `HARDWARE_IN_WAREHOUSE → AWAITING_INSTALLATION`, `effects: []`
- T10–T13 → `ROLLBACK_RESCHEDULING`, `effects: ['N_ROLLBACK','I4','do:releaseCrewSlot','do:suspendLogisticsSla']`

## Kontekst kodu — stan faktyczny na 2026-09-01 (zbadany, nie założony)

### Rozstrzygnięcie pytania „co decyduje o rozmiarze"
**`notification_queue` NIE ISTNIEJE — ani jako tabela, ani jako producent, ani jako konsument.**
- `grep -rn "notification_queue|notificationQueue|NotificationQueue"` po całym repo (bez `node_modules`) daje **4 trafienia i wszystkie są w kontraktach**: `contracts/notifications.contract.mjs`, `contracts/rbac.contract.mjs` i ich odpowiedniki w `packages/contracts/src/generated/`. Zero w `packages/database/prisma/schema.prisma`, zero w `supabase/migrations/`, zero w `apps/`.
- **Nie ma żadnego producenta.** B2C przy tworzeniu leada (`apps/b2c-web/app/actions/saveLead.ts`, `leads.ts`) nie wstawia nic do kolejki — `I1 lead_created` też nie jest realizowane. Nie ma wzorca do skopiowania; ten WO go ustanawia.
- **Nie ma żadnego konsumenta pola `effects`.** `grep -rn "effects" apps/` = 0 trafień. Pole istnieje wyłącznie w typie i danych `packages/contracts/src/generated/funnel.ts`.
- **Nie ma żadnego nadawcy.** Zero zależności/importów `twilio | resend | nodemailer | sendSms | sendEmail` w całym monorepo.

Wniosek: „wysyłka SMS" jest poza zasięgiem tego WO w każdym wariancie. Maksimum, jakie da się dowieźć i przetestować, to **wiersz w kolejce zapisany w tej samej transakcji co zmiana statusu**.

### Errata do pamięci projektowej
Nieaktualna teza „żaden plik w `apps/b2b-web` nie importuje `@klikklima/contracts`" — dziś importuje 17 plików (przez `can()`), w tym `logistics/actions.ts`. Nadal prawdziwe jest jednak węższe zdanie: **importowana jest wyłącznie warstwa RBAC; ani `TRANSITIONS.effects`, ani `NOTIFICATIONS`, ani `QUEUE_POLICY` nie mają w B2B ani jednego konsumenta.**

### Istnieje
- `apps/b2b-web/src/app/(dashboard)/logistics/actions.ts`: `shipLogisticsOrder` (L102), `bypassLogisticsOrder` (L141), `markAsDelivered` (L166), `rollbackLogisticsOrder` (L205). Wszystkie mają poprawną bramkę `can(leads.update) && can(shipments.update)` (poza `markAsDelivered` — tylko `leads.update`).
- `rollbackLogisticsOrder` stempluje `bucket_entered_at` i dopisuje notatkę. Komentarz w L226 mówi wprost: `// Zwalnianie zasobów - w przyszłości odpinanie ekipy / terminu`.
- Slot ekipy fizycznie żyje na `instalacje.zespol_id` + `instalacje.data_planowana`; data montażu leada na `leady.data_rezerwacji`. Wzorzec zapisu: `assignCrewToLead` (`leads/actions.ts:222-243`) — `$transaction` + `findFirst`/`update`/`create` na `instalacje`.
- Jedyny przypadek kontroli izolacji w repo: `auditors/actions.ts:432` — `prisma.$transaction(..., { isolationLevel: 'Serializable' })`. To jedyny istniejący precedens; `FOR UPDATE`, `$queryRaw`, advisory locks — zero wystąpień.

### Brakuje
- tabeli `notification_queue` i modelu Prisma dla niej,
- funkcji `releaseCrewSlot` i `suspendLogisticsSla` (zero wystąpień nazw w repo),
- jakiejkolwiek reprezentacji „SLA wstrzymane" w schemacie — patrz niżej,
- jakiejkolwiek blokady bazodanowej przy zwalnianiu/rezerwacji slotu. **Ostrzeżenie: wzorzec rezerwacji z B2C nie istnieje w formie, którą można naśladować.** `getFomoSlots.ts` liczy `count(*)` przez `supabase-js` i porównuje z limitem z `system_config`, a `saveLead.ts` zapisuje `data_rezerwacji` bez żadnego sprawdzenia pojemności. To jest dokładnie ten „check w JS", przed którym ostrzega CLAUDE.md #4 — nie kopiuj go.

### Kluczowe ustalenie o SLA
`SLA_POLICIES.LOGISTICS_INSTALL` (`contracts/sla.contract.mjs:11`) to metryka **wyliczana**: `metric: 'daysUntilInstallation'`, pasma liczone przez `differenceInDays` od `leady.data_rezerwacji` (`SLA-LOG-COLORS`). Nie istnieje żaden zapisany zegar, który dałoby się „zatrzymać". „Wstrzymanie SLA" musi więc zostać **zdefiniowane**, a nie odnalezione.

## Zmiana kontraktu / schematu — WYMAGANA (rola `contract-steward`, okno kontraktowe)

1. **Model `notification_queue`** (nowa tabela). Minimalny kształt zgodny z ADR-007 (`QUEUE_POLICY`, `notifications.contract.mjs:70-79`) i `NTF-POLY`/`NTF-HISTORY`:
   `id`, `notification_id` (np. `N5`), `template_key`, `channel`, `recipient_type`, `recipient_address`, `payload Json`, `status` (enum: `PENDING|SENT|ERROR|DEAD_LETTER`), `attempts Int @default(0)`, `last_error`, `next_attempt_at`, `dead_lettered_at`, `idempotency_key String @unique`, `lead_id`/`installation_id`/`service_id`/`incident_id` (nullable, dokładnie jedno niepuste — `NTF-POLY`), `created_at`.
   Nazewnictwo wg ADR-002: tabela `notification_queue` (nazwa z kontraktu, zostaje w l. poj. — to nazwa własna z `RESOURCES`), kolumny `snake_case`.
2. **`leady.logistics_sla_paused_at DateTime? @db.Timestamptz(6)`** — nowa kolumna, jedyna reprezentacja „zegar wstrzymany". Bez niej `suspendLogisticsSla` nie ma żadnego obserwowalnego skutku, a AC `FNL-ROLLBACK` „SLA logistyczne zostaje wstrzymane" jest nietestowalne.
3. **`RESOURCES`/`MATRIX`**: sprawdzić, czy `notification_queue` ma wpis (jest w `rbac.contract.mjs`) i czy pokrywa zapis z Server Action dyspozytora.
4. **Rejestr wymagań**: dodać `NTF-QUEUE-TABLE` (domain `notifications`, status `TODO`, risk `HIGH`) — istniejące `NTF-*` zakładają istnienie kolejki, żadne nie odpowiada za jej powstanie. Bez tego `kk-trace` nie pokaże luki.

Nowych ID przejść ani nowych powiadomień **nie trzeba** — T06/T07/T10–T13, `N5`, `N_ROLLBACK`, `I4` już istnieją i są `STABLE`.

## Decyzje projektowe (rozstrzygnięte, nie do dyskusji przez implementera)

### D1 — `releaseCrewSlot(tx, leadId)`, nie `(crewId, tx)`
Sygnatura z opisu zadania (`crewId`) jest nierozstrzygalna: ekipa ma wiele slotów, a rollback zwalnia **konkretny** slot tego leada. Slot jest identyfikowany przez wiersz `instalacje` o `lead_id = leadId`.
Semantyka: dla wszystkich wierszy `instalacje` danego leada o statusie `PLANNED` ustaw `zespol_id = null`, `data_planowana = null`, `status = CANCELLED` (jeśli enum `InstallationStatus` ma taką wartość; jeśli nie — zostaw `PLANNED` z pustym `zespol_id` i wpisz to jako ograniczenie, NIE dodawaj wartości enum w tym WO).
Blokada: `tx.$queryRaw` z `SELECT id FROM instalacje WHERE lead_id = $1 FOR UPDATE` **przed** jakimkolwiek `update`, wewnątrz tej samej `$transaction`. Uzasadnienie wyboru nad optymistyczną wersją: `instalacje` nie ma kolumny `version` ani `updated_at`, więc optymistyczna blokada wymagałaby kolejnej migracji; `FOR UPDATE` nie wymaga zmiany schematu. Wariant `isolationLevel: 'Serializable'` (precedens `auditors/actions.ts:432`) jest dopuszczalny jako dodatek, ale nie zastępuje `FOR UPDATE` — sam retry na 40001 musiałby zostać obsłużony, a nie jest nigdzie w repo.
Idempotencja: druga próba zwolnienia już zwolnionego slotu kończy się `success: true` bez zmiany wiersza.

### D2 — `suspendLogisticsSla(tx, leadId)`
Ustawia w jednym `update`: `logistics_sla_paused_at = now()` (tylko jeśli było `null` — powtórny rollback nie przesuwa stempla) oraz `data_rezerwacji = null`.
Wyzerowanie `data_rezerwacji` jest istotą wstrzymania: `daysUntilInstallation` jest metryką wyliczaną z tego pola, więc dopóki data zostaje, wiersz w bucketcie rollbacku dalej czerwienieje na SLA montażu, który nie obowiązuje. Utrata poprzedniej daty jest akceptowana świadomie — `FNL-ROLLBACK-EXIT` i tak wymaga wyboru nowego terminu; historia idzie do `notatki_wewnetrzne` (już dopisywane) i do `payload` powiadomienia.
Wznowienie (`logistics_sla_paused_at = null`) należy do `FNL-ROLLBACK-EXIT` — **poza zakresem**.

### D3 — kolejkowanie w tej samej transakcji, klucz idempotencji
Wstawienie do `notification_queue` odbywa się `tx.notification_queue.create` **wewnątrz tej samej `prisma.$transaction`**, co `leady.update`. Żadnego `after()`, żadnego `Promise.all` obok transakcji (CLAUDE.md #2).
`idempotency_key` = `` `${notification_id}:${leadId}:${transitionId}:${bucketKey}` ``, gdzie `bucketKey` to znacznik zdarzenia stabilny przy retry: dla T06 — `tracking_id`; dla T10–T13 — `bucket_entered_at` w ISO ustawiane w tej samej transakcji. Kolizja `@unique` przy retry ma być łapana (`P2002`) i traktowana jako sukces, nie jako błąd — retry nie tworzy drugiego wiersza i nie wywraca akcji.
Efekty do zakolejkowania czytane z kontraktu: `findTransition(from, action).effects`, filtrowane przez `NOTIFICATIONS` po `id`. Zero literałów `'N5'` w kodzie akcji — inaczej powtórzymy dług z `ALLOWED_TRANSITIONS`.

### D4 — bypass kolejkuje ZERO powiadomień
T07 ma `effects: []`, a `FNL-E5-BYPASS` mówi wprost „Nie wysyła się N5". To jest AC negatywne i musi mieć test.

### D5 — brak `tracking_id` blokuje wysyłkę
`FNL-E5-E6` AC1. Dziś `trackingNumber` jest opcjonalne, a rekord `logistyka_zamowienia` powstaje warunkowo — to naruszenie wymagania, które ten WO domyka przy okazji, bo bez `tracking_id` nie ma `bucketKey` ani zmiennej `tracking_id` dla szablonu `funnel.shipped`.

## Podział na fazy (całość jest za duża na jeden przebieg GREEN — limit 3 iteracji)

| Faza | Zakres | Role | Zależności |
|---|---|---|---|
| **A** | Migracja: `leady.logistics_sla_paused_at`; `releaseCrewSlot` + `suspendLogisticsSla` wpięte w `rollbackLogisticsOrder`; jedna transakcja; `FOR UPDATE` | `contract-steward` → `test-author` → `implementer-server` | brak |
| **B** | Migracja + model `notification_queue`, rejestracja `NTF-QUEUE-TABLE`, helper `enqueueNotification(tx, {...})` czytający `effects` z kontraktu — bez integracji z akcjami | `contract-steward` → `test-author` → `notification-architect` | brak (równoległa do A) |
| **C** | Wpięcie kolejki w `shipLogisticsOrder` (N5, wymóg tracking_id), `bypassLogisticsOrder` (zero wpisów), `rollbackLogisticsOrder` (N_ROLLBACK + I4) | `test-author` → `implementer-server` | A i B |

Fazy A i B nie mogą trafić do jednego przebiegu: dotykają dwóch różnych migracji i dwóch różnych ról piszących.

## Kryteria akceptacji

### Faza A — zwolnienie slotu i wstrzymanie SLA
- [ ] AC-A1: Po `rollbackLogisticsOrder(leadId)` żaden wiersz `instalacje` tego leada nie ma przypisanej ekipy ani daty planowanej; lead ma status `ROLLBACK_RESCHEDULING`.
- [ ] AC-A2: Ta sama ekipa może po rollbacku zostać przypisana do innego leada na tę samą datę — slot jest realnie wolny, nie tylko „oznaczony".
- [ ] AC-A3: Jeżeli `update` na `instalacje` rzuci wyjątek, status leada **pozostaje** sprzed rollbacku (jedna transakcja, brak stanu pośredniego „lead w rollbacku, ekipa nadal zajęta").
- [ ] AC-A4: Po rollbacku lead nie pojawia się w żadnym paśmie SLA `CRITICAL`/`URGENT` na liście logistyki, mimo że przed rollbackiem był 1 dzień do montażu.
- [ ] AC-A5: Dwukrotne wywołanie `rollbackLogisticsOrder` dla tego samego leada nie przesuwa `logistics_sla_paused_at` i nie zmienia wyniku (`success: true`).
- [ ] AC-A6: Dwa równoległe rollbacki tego samego leada dają dokładnie jeden efekt; drugi czeka na blokadę i nie nadpisuje stempla.
- [ ] AC-A7: Rollback wywołany przez rolę bez `shipments.update` zwraca `{ success: false }` i **nie wykonuje żadnego zapisu** — ani statusu, ani zwolnienia slotu.

### Faza B — kolejka
- [ ] AC-B1: `enqueueNotification` wywołane dwa razy z tym samym `idempotency_key` skutkuje jednym wierszem; drugie wywołanie nie rzuca.
- [ ] AC-B2: Wiersz powstały poza transakcją-rodzicem nie istnieje — rollback transakcji rodzica usuwa wpis w kolejce (test na wymuszonym błędzie po `enqueue`).
- [ ] AC-B3: Wpis ma dokładnie jedno niepuste z `lead_id/installation_id/service_id/incident_id` (`NTF-POLY`).
- [ ] AC-B4: `channel`, `template_key` i `recipient` pochodzą z `NOTIFICATIONS` w kontrakcie; podmiana wpisu w kontrakcie zmienia wynik bez zmiany kodu akcji.
- [ ] AC-B5: Wpis startuje ze `status = PENDING`, `attempts = 0`. (Okno wysyłki 8:00–18:00 rozstrzyga worker — `NTF-QUEUE-WINDOW`, poza zakresem.)

### Faza C — integracja z trzema akcjami
- [ ] AC-C1: `shipLogisticsOrder` bez `trackingNumber` zwraca błąd, nie zmienia statusu leada i nie tworzy wpisu w kolejce.
- [ ] AC-C2: `shipLogisticsOrder` z trackingiem: lead w `HARDWARE_IN_TRANSIT`, jeden wiersz `logistyka_zamowienia`, dokładnie jeden wpis `N5` z `tracking_id` w payloadzie — wszystko po jednym `$transaction`.
- [ ] AC-C3: Powtórzone `shipLogisticsOrder` z tym samym trackingiem nie tworzy drugiego wpisu `N5` (klient nie dostaje drugiego SMS-a).
- [ ] AC-C4: `bypassLogisticsOrder` przenosi lead do `AWAITING_INSTALLATION` i **nie tworzy ani jednego wpisu w `notification_queue`** — w szczególności nie `N5`.
- [ ] AC-C5: `bypassLogisticsOrder` nie tworzy rekordu `logistyka_zamowienia`.
- [ ] AC-C6: `rollbackLogisticsOrder` tworzy dokładnie dwa wpisy: `N_ROLLBACK` (odbiorca `CLIENT`, kanał `EMAIL`) i `I4` (odbiorca `DISPATCHER`).
- [ ] AC-C7: Awaria wstawienia do kolejki cofa zmianę statusu leada — nie istnieje stan „lead w transicie, brak powiadomienia" ani odwrotnie.
- [ ] AC-C8: Zbiór kolejkowanych ID dla każdej z trzech akcji jest równy `effects` odpowiedniego przejścia z `funnel.contract.mjs` po odfiltrowaniu `do:` — test porównuje z kontraktem, nie z listą literałów.

## Przypadki brzegowe, które MUSZĄ mieć test
- Współbieżność: dwa rollbacki tego samego leada; rollback równolegle z `assignCrewToLead` na tę samą ekipę i datę.
- Idempotencja: powtórzony `ship` z tym samym trackingiem; powtórzony rollback; `P2002` na `idempotency_key` traktowane jako sukces.
- Atomowość: wymuszony błąd po `leady.update`, a przed `enqueue`, i odwrotnie.
- Uprawnienia: `audytor`/`monter` na każdej z trzech akcji — odmowa **przed** pierwszym zapytaniem Prisma.
- Lead bez wiersza `instalacje` (rollback z `HARDWARE_IN_WAREHOUSE`, gdzie ekipy nigdy nie przypisano) — `releaseCrewSlot` nie może rzucić.
- Lead z `data_rezerwacji = null` przy `suspendLogisticsSla`.
- Strefa czasowa: `logistics_sla_paused_at` zapisywane jako `timestamptz`; porównania dni montażu liczone w `Europe/Warsaw` (`QUEUE_POLICY.timezone`), nie w UTC.
- `recipient_address`: klient bez e-maila/telefonu — wpis musi powstać czy zostać odrzucony? Patrz ryzyka.

## Poza zakresem
- Faktyczna **wysyłka** SMS/e-mail, worker kolejki, integracja z dostawcą, backoff, dead-letter (`NTF-RETRY`).
- Okno wysyłki 8:00–18:00 (`NTF-QUEUE-WINDOW`) — to logika workera.
- Centrum Powiadomień w UI, historia na karcie 360 (`NTF-HISTORY`).
- Szablony w bazie i parytet katalogu (`NTF-CATALOG-PARITY`).
- `markAsDelivered` / T08 i webhook kuriera (`FNL-E6-E7`) — osobny WO, mimo że dotyka tego samego pliku. Zauważ tylko: `markAsDelivered` sprawdza wyłącznie `leads.update`, brakuje `shipments.update` — zgłoszone, nie naprawiane tutaj.
- Powrót z rollbacku (`FNL-ROLLBACK-EXIT`), w tym wznowienie SLA i rezerwacja nowego slotu.
- Retroaktywne kolejkowanie `I1`/`N1` z pozostałych przejść — ten WO ustanawia wzorzec tylko dla logistyki.
- Naprawa braku blokady przy **rezerwacji** slotu w B2C (`saveLead.ts`) — realny dług, osobne wymaganie.

## Ryzyka i nieznane
- **R1.** `logistyka_zamowienia` nie ma `@unique` na `tracking_id`; idempotencja `ship` opiera się dziś wyłącznie na `notification_queue.idempotency_key`. Sam rekord przesyłki może się zduplikować przy retry. Rozważyć w fazie C dodatkowy `@@unique([lead_id, tracking_id])` — to kolejna zmiana schematu, więc nie wciągam jej do zakresu bez decyzji.
- **R2.** `InstallationStatus` — nie potwierdziłem, czy zawiera wartość typu `CANCELLED`. `contract-steward` musi to sprawdzić przed fazą A; brak wartości NIE upoważnia do rozszerzania enuma w tym WO.
- **R3.** `recipient_address` przy kliencie bez e-maila: `NTF-HISTORY` wymaga zapisu adresu z chwili wysyłki, ale nie mówi, co zrobić, gdy adresu nie ma. Rekomendacja robocza: wpis powstaje ze `status = ERROR` i `last_error`, żeby brak kontaktu był widoczny, a nie cichy. Do potwierdzenia przy `NTF-RETRY`.
- **R4.** `N_ROLLBACK` i `I4` mają w kontrakcie `bind.transition: 'T10|T11|T12|T13'` — string z pipe'ami, nie tablica. Każdy kod dopasowujący powiadomienia do przejścia musi ten format sparsować; nie ma dziś w repo helpera, który by to robił. To dodatkowa praca w fazie B, łatwa do przeoczenia w wycenie.
- **R5.** `rollbackLogisticsOrder` obsługuje dziś jedną akcję dla czterech przejść (T10–T13) i nie sprawdza stanu źródłowego. Po zmianie musi wyznaczyć konkretne przejście z `findTransition(currentStatus, 'rollback')` — inaczej `effects` nie da się odczytać z kontraktu. Lead w stanie spoza E4–E7 ma być odrzucony, czego dziś nie jest.
- **R6.** Rollback z `HARDWARE_IN_TRANSIT` (T12) zostawia fizyczną przesyłkę w drodze, a rekord `logistyka_zamowienia` w `SHIPPED`. Kontrakt nie mówi, czy zamówienie ma być anulowane. Nie rozstrzygam — nie ma źródła.
