# WO: SEC-AUTHZ-B2B-MUTATIONS — 14 Server Actions panelu B2B mutuje bazę bez jakiejkolwiek bramki uprawnień

> **Zastępuje** `docs/workorders/CRM-DELETE-ADMIN-ONLY-REMAINING.md` (5 akcji DELETE).
> Tamten WO był poprawny, ale niekompletny: opisywał wyłącznie usuwanie, bo powstał przed
> `tools/kk-authz-gate.mjs`. Skaner AST znalazł te same 5 ścieżek **plus 9 mutacji nie-DELETE**,
> w tym dwie w `leads/actions.ts` — pliku, który po naprawach z 2026-08-25/26 wyglądał na domknięty.
> Poprzedni plik należy uznać za nieaktualny; nie usuwam go, bo zawiera analizę warstwy RLS
> i sprzeczności `ANONYMIZE_OR_SET_NULL`, do której odsyłam niżej.

## Wymagania: <lista ID z rejestru>

- `CRM-DELETE-ADMIN-ONLY` (status TODO, risk HIGH, `contracts/requirements.contract.mjs:69`) — pokrywa
  **5 z 14** znalezisk (wyłącznie zdolność `delete`).
- `CRM-LEAD-UPDATE-ADMIN-DISPATCHER` (status TODO, risk HIGH, `contracts/requirements.contract.mjs:94`) —
  pokrywa zapisy do rekordu leada, ale jego treść ogranicza się jawnie do pliku
  `leads/[id]/actions.ts` i dwóch akcji (`updateLeadAuditor`, `updateLeadData`). Zawiera natomiast
  klauzulę rozszerzającą: *„Granicę wyznacza tabela docelowa zapisu, nie plik, w którym akcja mieszka"* —
  na jej mocy 6 mutacji `leady` z tego WO mieści się w duchu tego wymagania, ale **nie w jego literze**
  (acceptance wymienia dwie konkretne akcje).
- **BRAK ID** dla pozostałych 3 znalezisk: `addCustomerAddress` (`adresy`),
  `updateInstallationStatus`/`assignCrew` (`instalacje`), `shipLogisticsOrder`/`markAsDelivered`
  (`logistyka_zamowienia`). Nie istnieje wymaganie, które by je obejmowało.

**Konsekwencja: rejestr wymagań wymaga uzupełnienia — patrz „Zmiana kontraktu".**

## Kontekst kodu

### Istnieje — wzorzec bramki do skopiowania 1:1

- `leads/actions.ts:490` `deleteLeadAction` — `getCurrentActorRole()` + `can(actorRole,'leads','delete') !== 'yes'`,
  fail-closed przy `!actorRole`, zwraca `{ success, error }`. To jest referencja dla wszystkich 14.
- `leads/actions.ts:159` `assignCrewToLead`, `crews/actions.ts:192` `deleteCrewAction`,
  `auditors/actions.ts:201` `deleteAuditorAction` — ta sama forma.
- `can()` z `packages/contracts/src/generated/rbac.ts:70` zwraca `'no' | 'yes' | 'own'`.
  **Przepuszczamy wyłącznie `'yes'`** (uzasadnienie: `CRM-LEAD-UPDATE-ADMIN-DISPATCHER`, acceptance 3 —
  `!== 'no'` zamienia wariant `:own` w prawo do dowolnego rekordu).
- `tools/kk-authz-gate.mjs` — detektor braku bramki. **Nie dowodzi poprawności** pary zasób/zdolność
  (`tools/kk-authz-gate.mjs:22-24`), więc przejście skanera nie jest kryterium akceptacji tego WO.
- Warstwa UI ma wzorzec przekazywania roli: `auditors/page.tsx:8` → `auditors-client.tsx:39`.
- Warstwa RLS: `supabase/migrations/20260824185845_security_enable_rls_baseline.sql` — RLS włączone na
  `klienci`, `leady`, `instalacje`, `serwisy`, `usterki_incidents`, `logistyka_zamowienia`, brak polityk
  `FOR DELETE`. Migracja nie wymaga zmiany. Prisma i tak ją omija (pułapka 1 z CLAUDE.md).

### Brakuje — pełna lista 14 znalezisk

Żadna z tych funkcji nie wywołuje `getCurrentActorRole()` ani `can()`. Wszystkie są eksportowane
z modułu `"use server"`, czyli każda ma żywy endpoint POST wywoływalny z pominięciem interfejsu.

| # | Plik : linia | Funkcja | Mutacja(-e) | Zasób RBAC | Zdolność | Rola(e) wg `MATRIX` | Zmiana kontraktu? |
|---|---|---|---|---|---|---|---|
| 1 | `customers/actions.ts:48` | `deleteCustomerAction` | `prisma.klienci.delete` | `clients` | `delete` | `['admin']` (`rbac:29`) | nie |
| 2 | `customers/actions.ts:60` | `addCustomerAddress` | `prisma.adresy.create` | **brak zasobu** | `create` | — | **TAK — D1** |
| 3 | `incidents/actions.ts:40` | `deleteIncidentAction` | `prisma.usterki_incidents.delete` | `incidents` | `delete` | `['admin']` (`rbac:34`) | nie |
| 4 | `installations/actions.ts:56` | `updateInstallationStatus` | `prisma.instalacje.update` **+** `prisma.leady.update` | `installations` **oraz** `leads` | `update` **×2** | `['admin','dyspozytor','monter:own']` (`rbac:32`) **i** `['admin','dyspozytor']` (`rbac:30`) | **D2 (rozbieżne zestawy)** |
| 5 | `installations/actions.ts:77` | `assignCrew` | `prisma.instalacje.update` | `installations` | `update` (patrz D3) | `['admin','dyspozytor','monter:own']` | **D3** |
| 6 | `installations/actions.ts:86` | `deleteInstallationAction` | `prisma.instalacje.delete` | `installations` | `delete` | `['admin']` (`rbac:32`) | nie |
| 7 | `leads/actions.ts:378` | `updateLeadStatus` | `prisma.leady.update` ×2 | `leads` | `update` | `['admin','dyspozytor']` (`rbac:30`) | **D4 — martwy kod** |
| 8 | `leads/actions.ts:434` | `advanceLeadStatus` | `prisma.leady.update` | `leads` | `update` | `['admin','dyspozytor']` | nie (Z1) |
| 9 | `logistics/actions.ts:80` | `shipLogisticsOrder` | `tx.leady.update` **+** `tx.logistyka_zamowienia.create` | `leads` **oraz** `shipments` | `update` **+** `create` | `['admin','dyspozytor']` **i** `['admin','dyspozytor']` (`rbac:37`) | nie (Z1) |
| 10 | `logistics/actions.ts:107` | `bypassLogisticsOrder` | `prisma.leady.update` | `leads` | `update` | `['admin','dyspozytor']` | nie (Z1) |
| 11 | `logistics/actions.ts:120` | `markAsDelivered` | `tx.leady.update` **+** `tx.logistyka_zamowienia.update` | `leads` **oraz** `shipments` | `update` **+** `update` | `['admin','dyspozytor']` **i** `['admin','dyspozytor']` | nie (Z1, Z2) |
| 12 | `logistics/actions.ts:147` | `rollbackLogisticsOrder` | `prisma.leady.update` | `leads` | `update` | `['admin','dyspozytor']` | nie (Z1) |
| 13 | `logistics/actions.ts:163` | `deleteLogisticsOrderAction` | `prisma.leady.delete` | `leads` | `delete` | `['admin']` | nie — **konsolidacja, patrz AC13** |
| 14 | `services/actions.ts:49` | `deleteServiceAction` | `prisma.serwisy.delete` | `services` | `delete` | `['admin']` (`rbac:33`) | nie (ale patrz R3) |

Podpięcie do UI (czy dziura jest klikalna, czy tylko wywoływalna przez POST):

| Klikalna dziś z interfejsu | Tylko endpoint (brak wywołań w repo) |
|---|---|
| 1 (`customers-client.tsx:28`), 2 (`customers/[id]/tabs-client.tsx:35`), 3 (`incidents-client.tsx:37`), 4 (`installations-client.tsx:41`), 6 (`installations-client.tsx:28`), 8 (`leads-client.tsx:239`), 9–12 (`logistics-client.tsx:270,290,297,309`), 13 (`logistics-client.tsx:26`), 14 (`services-client.tsx:37`) | 5 `assignCrew`, 7 `updateLeadStatus` |

Weryfikacja martwego kodu (grep całego repo, `--include=*.ts,*.tsx,*.mjs`, bez `node_modules`):
`updateLeadStatus` — jedyne trafienie to jego własna definicja (`leads/actions.ts:378`).
`assignCrew` z `installations/actions.ts:77` — jedyne trafienia to definicja oraz **niepowiązane**
wystąpienia nazwy akcji kontraktowej `assignCrew` w `contracts/funnel.contract.mjs:98` i
`packages/contracts/src/generated/funnel.ts` (to nazwa przejścia T05, realizowana przez
`assignCrewToLead` w `leads/actions.ts:159`, nie przez tę funkcję).
Obie funkcje są martwe. **`assignCrew` z installations to homonim T05, nie jego implementacja** —
implementer, który tego nie zauważy, wpisze tam bramkę `leads.assign` i pogorszy stan.

Warstwa UI — żaden z pięciu widoków (`customers`, `installations`, `services`, `incidents`, `logistics`)
nie zna roli aktora: `customers/page.tsx:9`, `installations/page.tsx:9`, `services/page.tsx:8`,
`incidents/page.tsx:8`, `logistics/page.tsx:9` nie wołają `getCurrentActorRole()` i nie przekazują
propsa `actorRole`.

## Zmiana kontraktu

### WYMAGANA — w dwóch miejscach, niezależnie od siebie

**(A) Rejestr wymagań.** 3 z 14 znalezisk (`addCustomerAddress`, `updateInstallationStatus`, `assignCrew`,
`shipLogisticsOrder`/`markAsDelivered` w części dotyczącej `logistyka_zamowienia`) nie są objęte żadnym ID
w `contracts/requirements.contract.mjs`. Bez nowego ID `kk-trace.mjs` nie policzy ich pokrycia, a test-author
nie ma czego zacytować w nagłówku testu. Potrzebne otwarcie okna kontraktowego i rola `contract-steward`.
Rekomendacja: jedno nowe ID `SEC-AUTHZ-B2B-MUTATIONS` obejmujące **wszystkie mutacje Prismy w
`apps/b2b-web`**, z regułą wyrażoną przez tabelę docelową zapisu (nie przez plik) — bo trzecie z rzędu
wymaganie zawężone do konkretnych nazw funkcji stworzy tę samą dziurę przy czwartej akcji.

**(B) `MATRIX` — brak zasobu `addresses`.** Patrz D1 niżej. Bez tego wpisu `addCustomerAddress` nie ma
czego zapytać.

### NIEWYMAGANA dla pozostałych 11
`MATRIX` ma komplet potrzebnych wierszy, schemat i migracje nie są dotykane, RLS pozostaje deny-by-default.

## WYMAGA DECYZJI

### D1 — `addCustomerAddress`: zasób `adresy` nie istnieje w RBAC
`RESOURCES` (`contracts/rbac.contract.mjs:11-25`) nie zawiera `addresses`. `docs/architecture/NAMING.md:30`
mapuje `ADRESY` → `addresses`, więc nazwa jest ustalona, ale zasobu w macierzy nie ma.
Dwa warianty, oba są zmianą kontraktu:
- **(a)** Traktować adres jako część agregatu klienta → bramka `can(role,'clients','update')`
  (`['admin','dyspozytor']`). Brak zmiany `MATRIX`, ale utrwala regułę „tabela ≠ zasób", sprzeczną
  z CLAUDE.md („Nazwy tabel objętych uprawnieniami są tożsame z `RESOURCES`").
- **(b)** Dodać wiersz `addresses` do `RESOURCES` i `MATRIX`. Spójne z zasadą nazewniczą, ale wymaga
  ustalenia pełnego zestawu ról dla 4 zdolności i przeglądu innych miejsc piszących do `adresy`
  (m.in. `leads/[id]/actions.ts` `updateLeadData` tworzy rekord adresu).
**Nie wybieram.** Wariant (a) jest tańszy, wariant (b) zgodny z zasadą. To decyzja o granicy modelu
uprawnień, nie o jednej funkcji.

### D2 — `updateInstallationStatus` pisze do dwóch zasobów o różnych zestawach ról
Funkcja zmienia `instalacje.status`, a przy `COMPLETED` **dodatkowo** `leady.status = INSTALLATION_COMPLETED`
(`installations/actions.ts:66-71`).
- `installations.update` = `['admin','dyspozytor','monter:own']` → dla montera `can()` zwraca `'own'`.
- `leads.update` = `['admin','dyspozytor']` → dla montera `'no'`.
- `contracts/funnel.contract.mjs:126` T09 `completeInstallation` ma `actor: 'INSTALLER'`.

Czyli: kontrakt lejka mówi, że **monter zamyka instalację**, a macierz RBAC mówi, że monter nie ma prawa
zapisu do `leady` — a zamknięcie instalacji ten zapis pociąga. Przy regule „przepuszczamy tylko `'yes'`"
monter zostanie odcięty od T09. Warianty:
- **(a)** Bramka na `installations.update` z obsługą `'own'` (monter tylko własna instalacja) + zapis do
  `leady` jako **efekt systemowy przejścia T09**, nie jako akcja użytkownika (wtedy nie podlega
  `leads.update`). Wymaga zapisania tej zasady gdzieś jawnie, inaczej jest to furtka „efekt uboczny
  omija RBAC".
- **(b)** Bramka wymaga OBU zdolności → monter traci możliwość zamknięcia instalacji, T09 staje się
  martwe, dopóki `leads.update` nie dostanie `monter:own`.
- **(c)** Rozdzielić na dwie akcje o różnych bramkach.
Dodatkowo: `can()` zwraca `'own'`, a **żadne miejsce w kodzie nie implementuje dziś sprawdzenia
własności** — `monter:own` nie ma realizacji. Wybór (a) wymaga jej napisania od zera.
**Nie wybieram. To rozstrzygnięcie na styku dwóch kontraktów (RBAC × funnel), nie decyzja implementera.**

### D3 — `assignCrew` (installations): martwy kod + brak zdolności `assign` dla `installations`
Funkcja nie ma wywołań. Semantycznie to przypisanie ekipy, ale `MATRIX` ma zdolność `assign` tylko dla
`leads` (`rbac:30`) i `bookings` (`rbac:45`) — dla `installations` jej nie ma. Równolegle istnieje
`assignCrewToLead` (`leads/actions.ts:159`), która **ma** bramkę i realizuje T05 z walidacją certyfikatów.
Warianty: **(a)** usunąć `assignCrew` jako duplikat bez wywołań (rekomendacja — wzorem usuniętego
zduplikowanego `deleteLead`), **(b)** dodać bramkę `installations.update`, **(c)** dodać zdolność
`assign` do `installations` w `MATRIX` (zmiana kontraktu).
**Usunięcie eksportowanej funkcji to decyzja produktowa, nie naprawa bezpieczeństwa — nie wykonuję jej
samodzielnie.**

### D4 — `updateLeadStatus` (leads/actions.ts:378): martwy kod, ale żywy endpoint
Grep całego repozytorium nie znajduje żadnego wywołania. Funkcja robi to samo co `advanceLeadStatus`,
tylko **bez walidacji dozwolonych przejść** (`ALLOWED_TRANSITIONS`, `leads/actions.ts:412`) — pozwala
ustawić dowolny status na dowolnym leadzie, w tym cofnąć `INSTALLATION_COMPLETED` do `NEW_LEAD`
albo pominąć cały lejek. Jako `"use server"` export ma żywy endpoint POST, więc „nikt tego nie woła"
nie jest zabezpieczeniem.
- **Rekomendacja: usunąć funkcję w całości.** Jest ściśle słabsza od `advanceLeadStatus`, a jej
  zabezpieczenie utrwala w kodzie drugą, niekontraktową ścieżkę zmiany statusu leada — dokładnie ten
  wzorzec, który `deleteLogisticsOrderAction` pokazał przy usuwaniu.
- Alternatywa: dodać bramkę `leads.update` i zostawić.
**WYMAGA DECYZJI — usunięcie eksportowanej funkcji to decyzja, nie czysta naprawa.**
Do czasu decyzji: dziura pozostaje otwarta, więc jeśli decyzja się opóźnia, wykonać wariant „bramka
teraz, usunięcie osobno" — nie zostawiać funkcji bez bramki, czekając na rozstrzygnięcie.

## Założenia do potwierdzenia (nie blokują)

### Z1 — akcje logistyczne: `leads.update` (`admin` + `dyspozytor`), nie sam `dyspozytor`
Pytanie brzmiało, czy przejścia logistyczne wymagają węższej roli niż edycja danych klienta.
Co mówią źródła:
- `contracts/funnel.contract.mjs`: T06 `shipByCourier` `actor: 'DISPATCHER'` (`:105`),
  T07 `deliverWithCrew` `actor: 'DISPATCHER'` (`:112`), T10/T11/T12 `rollback` `actor: 'DISPATCHER'`
  (`:133-135`), T08 `markDelivered` `actor: 'SYSTEM'`, `trigger: 'WEBHOOK'` (`:119`).
- `docs/architecture/b2b_app_requirements.md:68`: „*Dyspozytor klika „Wysłano kurierem" i dodaje Tracking ID*";
  `:69`: „*Dyspozytor klika „Dostawa z ekipą w dniu montażu"*"; `:85`: „*Dyspozytor wyzwala akcję
  „Problem z dostawą (Rollback)"*".

Żadne z tych źródeł **nie mówi, że administrator nie może**. Pole `actor` w kontrakcie lejka jest
pojedynczą wartością z `ACTORS` (`funnel.contract.mjs:13`), opisuje typowego wykonawcę przejścia, a **nie
listę uprawnionych ról** — nie istnieje żadne odwzorowanie `ACTORS` → `ROLES` ani w kontraktach, ani
w kodzie (grep: zero użyć pola `.actor` w `apps/`). Zawężenie do samego `dyspozytor` byłoby więc
wnioskiem z pola, które nie służy do autoryzacji, i odebrałoby administratorowi prawa, które ma
wszędzie indziej w macierzy.
**Przyjmuję `can(role,'leads','update')` = `['admin','dyspozytor']` dla pozycji 8–12 — spójnie
z `assignCrewToLead` i `CRM-LEAD-UPDATE-ADMIN-DISPATCHER`. Do potwierdzenia przez człowieka.**

### Z2 — `markAsDelivered` jako akcja ręczna jest legalna
`funnel.contract.mjs:122` (nota T08): „*Webhook kuriera LUB ręczna akcja dyspozytora (ten sam action)*",
`docs/architecture/b2b_funnel_process.md:87` — to samo. Ręczny przycisk w
`logistics-client.tsx:297` nie jest obejściem webhooka. Bramka `leads.update` + `shipments.update`
dotyczy wyłącznie ścieżki ręcznej; ścieżka webhookowa jest publicznym endpointem z własnym
mechanizmem uwierzytelnienia (wyjątek dla webhooków w CLAUDE.md) i **nie należy do tego WO**.

## Podział na etapy (rekomendacja)

14 akcji × 3 warstwy nie zmieści się w limicie 3 iteracji GREEN. Kolejność wymuszona ryzykiem:

- **Etap 1 — 11 pozycji bez otwartych decyzji** (1, 3, 6, 8, 9, 10, 11, 12, 13, 14 + bramka tymczasowa dla 7):
  AC1–AC8, AC13. Zamyka podatność w akcjach klikalnych z UI.
- **Etap 2 — pozycje z decyzjami** (2/D1, 4/D2, 5/D3, 7/D4): dopiero po rozstrzygnięciu; D1 i część D2
  wymagają okna kontraktowego.
- **Etap 3 — UI i RLS**: AC9–AC12.

## Kryteria akceptacji (wykonalne)

### Etap 1 — warstwa Server Action
- [ ] **AC1**: Wywołanie każdej z akcji objętych etapem przez konto o roli, która nie ma odpowiedniej
  zdolności, **nie zmienia żadnego rekordu** — test dowodzi, że odpowiednia metoda klienta Prismy nie
  została wywołana **ani razu**, a nie tylko że wartości w bazie są niezmienione.
- [ ] **AC2**: Odmowa następuje **zanim powstanie pierwsze zapytanie do bazy — także odczytujące**.
  Dotyczy w szczególności `advanceLeadStatus` i `updateLeadStatus`, które dziś zaczynają od `findUnique`:
  po naprawie odrzucone wywołanie nie może wykonać tego odczytu (inaczej akcja jest oraklem istnienia
  i statusu dowolnego leada dla konta bez uprawnień).
- [ ] **AC3**: Kontrola pozytywna dla **każdej** dozwolonej roli osobno. Dla pozycji 8–12 test wykonuje
  osobno przypadek `admin` i osobno `dyspozytor` — bez tego zestaw przechodzi także dla bramki błędnie
  zawężonej do samego admina, czyli dla „naprawy", która odbiera dyspozytorowi narzędzie pracy.
- [ ] **AC4**: Przepuszczany jest wyłącznie wynik `'yes'` z `can()`. Test wykazuje, że warunek
  `!== 'no'` oblewa: zestaw zawiera przypadek roli, dla której `can()` zwraca `'own'`
  (`installations.update` dla `monter`), i wymaga odmowy tam, gdzie akcja nie sprawdza własności rekordu.
- [ ] **AC5**: Fail-closed. Cztery przypadki, wykonane realnie (nie przez inspekcję konfiguracji):
  brak sesji; e-mail spoza `authorized_users`; wartość roli nierozpoznana przez `ROLES`;
  **wyjątek rzucony przez `getCurrentActorRole()`**. We wszystkich czterech: odmowa, nie zapis
  i nie awaria 500. Uwaga dla implementera: ciała `advanceLeadStatus`/`updateLeadStatus` są opakowane
  w `try/catch` zwracający komunikat błędu — bramka umieszczona **wewnątrz** tego `try` zamieni awarię
  odczytu roli w zwykły „nie udało się zmienić statusu" zamiast w twardą odmowę.
- [ ] **AC6**: Rola pochodzi wyłącznie z sesji serwera. Przekazanie roli w argumencie akcji nie zmienia
  decyzji. Test wywołuje Server Action bezpośrednio, z pominięciem interfejsu — interfejs nie jest
  granicą uprawnień, bo Prisma omija RLS.
- [ ] **AC7**: Decyzję podejmuje `can(actorRole, <zasób>, <zdolność>)` z `@klikklima/contracts` dla pary
  z tabeli powyżej — nie literał `'admin'`, nie lista ról wypisana w kodzie akcji, nie inna zdolność.
  Test odróżnia to jawnie: `dyspozytor` ma `update` na `clients`/`installations`/`services`/`incidents`/`leads`,
  ale **nie ma** `delete` — naprawa oparta przez pomyłkę na `update` musi ten zestaw oblać.
- [ ] **AC8**: Akcje mutujące **dwa zasoby** (9 `shipLogisticsOrder`, 11 `markAsDelivered`) sprawdzają
  **obie** pary zasób/zdolność, a sprawdzenie stoi **przed** otwarciem transakcji. Test dla roli mającej
  jedną zdolność, ale nie drugą, wymaga braku jakiegokolwiek zapisu — nie stanu pośredniego, w którym
  status leada się zmienił, a rekord wysyłki nie powstał.
- [ ] **AC13**: `deleteLogisticsOrderAction` **nie zawiera własnej bramki ani własnego
  `prisma.leady.delete`**. Jej ciało deleguje do `deleteLeadAction` zaimportowanej z
  `leads/actions.ts` (decyzja podjęta), przekazuje dalej jej wynik `{ success, error }` i zachowuje
  `revalidatePath('/logistics')`. Test dowodzi, że po zmianie **w całym `apps/b2b-web` istnieje dokładnie
  jedno wywołanie `prisma.leady.delete`** — to w `leads/actions.ts:497`. Druga ścieżka usunięcia leada,
  choćby zabramkowana, jest długiem, który wróci.

### Etap 3 — UI i RLS
- [ ] **AC9**: Rola bez odpowiedniej zdolności nie widzi kontrolki uruchamiającej daną akcję w widokach
  klienci, instalacje, serwisy, usterki i logistyka; rola uprawniona widzi ją.
- [ ] **AC10**: Widoczność liczona jest z `can(actorRole, …)`, a `actorRole` pochodzi z
  `getCurrentActorRole()` w Server Component strony (wzorzec `auditors/page.tsx:8` →
  `auditors-client.tsx:39`), nie z wartości trzymanej w kliencie.
- [ ] **AC11**: Test warstwy RLS dowodzi, że w migracjach nie istnieje polityka `FOR DELETE`/`FOR ALL`
  dla `klienci`, `instalacje`, `serwisy`, `usterki_incidents`, `leady`, `logistyka_zamowienia`, `adresy`.
  Dodanie takiej polityki w przyszłości ma ten test oblać.
- [ ] **AC12**: Trzy warstwy testowane w osobnych plikach/blokach (wymóg acceptance nr 4
  z `CRM-DELETE-ADMIN-ONLY`). Jeden test nie może zaliczać dwóch warstw naraz.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Uprawnienia (rdzeń)**: pełna macierz 4 role × akcje objęte etapem. `dyspozytor` jest najgroźniejszy —
  ma `update` na tych zasobach, więc naiwna naprawa oparta na `update` przepuści go do `delete`.
- **Fail-closed** — cztery warianty z AC5; brak roli nie może trafić do `can()` jako wartość przepuszczająca.
- **Odmowa przed odczytem** (AC2) — inaczej akcje z `findUnique` na wejściu wyciekają istnienie i status
  rekordu roli bez uprawnień.
- **Transakcyjność bramki** (AC8) — sprawdzenie roli przed `$transaction`, nigdy w jej środku.
  Bramka wewnątrz transakcji, która następnie rzuca, zostawia rollback zamiast odmowy — inny kod błędu,
  ten sam skutek dla użytkownika, ale nieodróżnialny w logach od awarii bazy.
- **Idempotencja / rekord nieistniejący**: usunięcie nieistniejącego `id` przez uprawnioną rolę nie może
  kończyć się nieobsłużonym `P2025` wyciekającym do UI; dla roli bez uprawnień odmowa musi zajść
  **niezależnie** od istnienia rekordu.
- **Współbieżność `markAsDelivered`**: akcja odczytuje `findFirst` ostatniego zlecenia i aktualizuje je
  wewnątrz tej samej transakcji — dwa równoległe wywołania (ręczne kliknięcie + webhook kuriera) mogą
  trafić w ten sam rekord. Bramka tego nie naprawia, ale test nie może **zamaskować** tego problemu
  przez mockowanie transakcji jako sekwencji.
- **Klucze obce**: `customers-client.tsx:31` tłumaczy dziś **każdy** wyjątek na „blokują go klucze obce".
  Po naprawie odmowa z powodu roli musi być odróżnialna od odmowy z powodu FK — inaczej pierwszy
  komunikat maskuje drugi i użytkownik nie wie, czy prosić o uprawnienia, czy usuwać zależności.
- **Odmowa odróżnialna od sukcesu**: akcje 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 14 zwracają dziś `void`,
  a UI (`customers-client.tsx:28`, `incidents-client.tsx:37`, `services-client.tsx:37`,
  `installations-client.tsx:28`, `logistics-client.tsx:26`) pokazuje komunikat sukcesu i przeładowuje
  stronę **niezależnie od wyniku**. Po naprawie odmowa nie może się objawiać komunikatem „usunięto".
  Zmiana sygnatury na `{ success, error }` jest tu częścią naprawy, nie kosmetyką.
- **Homonim `assignCrew`** (D3) — test/implementer musi odróżnić `installations/actions.ts:77` od akcji
  kontraktowej T05 realizowanej przez `assignCrewToLead`.

## Poza zakresem

- **Ścieżka webhookowa `markDelivered`** (T08, `trigger: 'WEBHOOK'`) — publiczny endpoint z własnym
  uwierzytelnieniem, wyjątek z CLAUDE.md. Tu bramkujemy wyłącznie ręczne wywołanie z panelu.
- **Walidacja przejść statusu wg kontraktu lejka.** `advanceLeadStatus` używa lokalnej mapy
  `ALLOWED_TRANSITIONS` (`leads/actions.ts:412`) zamiast `canTransition`/`findTransition`
  z `@klikklima/contracts`. To realny dług (dwa źródła prawdy o przejściach), ale **inne pytanie**:
  „co wolno zapisać", nie „kto wywołuje". Osobne WO.
- **Efekty i powiadomienia przejść.** `shipLogisticsOrder` realizuje T06, którego kontrakt wymaga efektu
  `N5`; `rollbackLogisticsOrder` realizuje T10–T12 z efektami `N_ROLLBACK`, `I4`, `do:releaseCrewSlot`,
  `do:suspendLogisticsSla` — kod nie robi żadnego z nich (komentarz `logistics/actions.ts:157`
  sam to przyznaje: „*w przyszłości odpinanie ekipy / terminu*"). To osobne, poważne WO dla
  `notification-architect`. Nie mieszać z bramką ról.
- **Strategia usuwania klienta** `ANONYMIZE_OR_SET_NULL` (`rbac.contract.mjs:103`) vs twardy
  `prisma.klienci.delete` w kodzie — sprzeczność opisana w poprzednim WO
  (`CRM-DELETE-ADMIN-ONLY-REMAINING.md`, sekcja „Ryzyka"). Bramka roli jest potrzebna w obu wariantach,
  więc ten WO nie czeka na tę decyzję.
- **Wpis do `audit_log`** — `AUDIT_REQUIREMENTS.mustLog` zawiera `'delete'` i `'manual_status_change'`,
  czyli 14 z 14 akcji z tego WO powinno logować. Tabela `audit_log` **nie istnieje w schemacie**.
  Zmiana kontraktu + migracja, osobne WO.
- **Implementacja wariantu `:own`** — `can()` zwraca `'own'` dla `monter` na `installations`/`services`/`incidents`,
  a kod nie sprawdza własności rekordu nigdzie. Osobne WO; tu wariant `'own'` **nie przepuszcza** (AC4).
- **Widoki audytorów, zespołów, leadów (delete) i `leads/[id]/actions.ts`** — domknięte wcześniej.
- **Podpięcie `kk-authz-gate.mjs` do `scripts/verify.sh`** — świadomie odłożone
  (`tools/kk-authz-gate.mjs:34-36`), do zrobienia po zamknięciu długu.

## Ryzyka i nieznane

- **RYZYKO HIGH — nieodwracalne mutacje danych klienta i logistyki bez żadnej autoryzacji.**
  Dziś **dowolne zalogowane konto, łącznie z monterem i audytorem**, może przez bezpośrednie wywołanie
  Server Action: skasować rekord klienta wraz z historią (`deleteCustomerAction`), skasować leada
  z pominięciem naprawionej bramki (`deleteLogisticsOrderAction`), przesunąć dowolnego leada na dowolny
  status z pominięciem lejka (`updateLeadStatus` — bez walidacji przejść), oznaczyć nieistniejącą
  przesyłkę jako wysłaną i dostarczoną (`shipLogisticsOrder`, `markAsDelivered`) albo cofnąć gotowy
  montaż do rollbacku (`rollbackLogisticsOrder`). Nie ma `audit_log`, więc **po fakcie nie da się
  ustalić, kto to zrobił**. Osiem z tych ścieżek jest klikalnych wprost z interfejsu przez rolę,
  która nie powinna ich widzieć.
- **Ryzyko wtórne — fałszywy sygnał domknięcia.** `leads/actions.ts` był w tej sesji naprawiany trzy razy
  i po każdej naprawie wyglądał na kompletny. Dwie dziury (7, 8) przetrwały, bo przegląd szedł po
  akcjach wymienionych w wymaganiu, a nie po mutacjach w pliku. Ten sam mechanizm dotyczy
  `kk-trace.mjs`: liczy referencje do ID wymagania w komentarzach testów, więc `CRM-DELETE-ADMIN-ONLY`
  o zakresie „7 widoków" **pokazuje się jako pokryty** po naprawieniu dwóch. Zielony trace nie jest
  tu dowodem niczego. Jedynym narzędziem odpowiadającym na pytanie „czy coś zostało" jest
  `node tools/kk-authz-gate.mjs`, i to tylko w części „czy bramka istnieje" — nie „czy jest poprawna".
- **R3 — `deleteServiceAction` prawdopodobnie kasuje niewłaściwą encję.** `getUpcomingServices`
  (`services/actions.ts:17`) zwraca wiersze z tabeli **`instalacje`** i ustawia `id: inst.id`
  (`services/actions.ts:38`). `services-client.tsx:37` przekazuje to `id` do `deleteServiceAction`,
  która wykonuje `prisma.serwisy.delete({ where: { id } })` — czyli szuka rekordu **`serwisy`**
  po identyfikatorze **instalacji**. Model `serwisy` jest osobną tabelą
  (`schema.prisma:247`, z własnym `instalacja_id`). Wygląda na to, że akcja albo zawsze rzuca `P2025`
  (i UI pokazuje „Wystąpił błąd"), albo — gorzej — trafia w przypadkowy rekord serwisu przy kolizji
  identyfikatorów. **Nie rozstrzygam tego w tym WO**; bramka roli jest potrzebna niezależnie.
  Zgłaszam jako osobne znalezisko do weryfikacji: widok „Serwisy Gwarancyjne" może dziś nie usuwać
  tego, co pokazuje.
- **Nieznane — `faults`**: `apps/b2b-web/src/app/(dashboard)/faults/` ma samo `page.tsx`, bez `actions.ts`,
  więc skaner nic tam nie znalazł. Jeżeli `faults` i `incidents` to ten sam widok domenowy w dwóch
  katalogach, to osobny dług.
- **Nieznane — zakres skanera**: `kk-authz-gate.mjs` przeszukuje wyłącznie pliki o nazwie `actions.ts`
  w `apps/b2b-web/src/app` (`tools/kk-authz-gate.mjs:61`). Mutacja Prismy w Route Handlerze, w `lib/`
  albo w pliku o innej nazwie **nie zostanie wykryta**. „14 znalezisk" to dolna granica, nie liczba
  ostateczna.
