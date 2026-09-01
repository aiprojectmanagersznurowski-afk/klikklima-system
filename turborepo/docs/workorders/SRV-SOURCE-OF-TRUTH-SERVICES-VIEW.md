# WO: SRV-SOURCE-OF-TRUTH-SERVICES-VIEW — widok „Serwisy Gwarancyjne" czyta z rekordu serwisu, a nie z pola pochodnego

## Wymagania
- `SRV-SOURCE-OF-TRUTH` (ADR-010, HIGH) — w szczególności ostatnie kryterium: „Widok CRM czyta termin z `services`, gdy rekord istnieje, i z `next_service_date`, gdy nie istnieje".
- Pośrednio dotyka: `SRV-NEXT-DATE` (żadna ścieżka aplikacji nie zapisuje `next_service_date`) — tu jako ograniczenie, nie jako zakres.
- Nie dotyka: `SRV-REMINDER-ONCE` (cron/N10 — poza zakresem).

## Kontekst kodu

Istnieje:
- `apps/b2b-web/src/app/(dashboard)/services/actions.ts` — `getUpcomingServices()` czyta wyłącznie `prisma.instalacje` po `next_service_date != null`, mapuje `id: inst.id` (ID instalacji!).
- `deleteServiceAction(id)` — sprawdza `can(role, 'services', 'delete')` (poprawnie, `delete: ['admin']` w `contracts/rbac.contract.mjs:33`), po czym woła `prisma.serwisy.delete({ where: { id } })` na ID pochodzącym z `instalacje`. **Zawsze P2025.** Gorzej: gdyby kiedykolwiek UUID instalacji zbiegł się z UUID serwisu, skasowałby cudzy rekord.
- `services-client.tsx` — pozycja „Usuń (Tylko Admin)" renderowana bezwarunkowo dla każdego wiersza; `handleDelete` łapie błąd i pokazuje generyczny alert, więc awaria jest niewidoczna w logach produktowych.
- `packages/database/prisma/schema.prisma:247` — model `serwisy` z relacją `instalacja_id -> instalacje` (`instalacje.serwisy[]`), polami `data_zgloszenia`, `data_realizacji`, `status ServiceStatus`, `opis_usterki`, `zespol_id`.
- `enum ServiceStatus { PLANNED SCHEDULED COMPLETED CANCELLED }` (schema.prisma:300).

Brakuje — i to jest istotna rozbieżność wobec treści zlecenia:
- **Tabela `services` nie istnieje.** Fizyczną realizacją bytu „serwis" z ADR-010 jest legacy `serwisy`. Zmiana nazwy to osobna praca (ADR-002), nie ta.
- **Tabela `bookings` nie istnieje.** Brak `booking_id`, `scheduled_date`, `reminder_sent_at` w `serwisy`. Brak migracji dodającej cokolwiek z tabeli w `CHANGES-ADR-010.md` §database_model (`ls supabase/migrations` — ostatnia dotycząca serwisu: brak).
- **Statusy `AWAITING_CONTACT` i `IGNORED` nie istnieją w enumie.** Odpowiednikami dostępnymi dziś są `PLANNED` (rekord jest, terminu nie ustalono) i `CANCELLED`.

Wniosek: `CHANGES-ADR-010.md` opisuje stan docelowy jako dokonany („`services` + `booking_id`", „Sprawdzone w obie strony"), a schemat go nie ma. To rozjazd dokument↔kod, nie sprzeczność między dokumentami — dlatego nie zatrzymuję tury, tylko przycinam zakres do tego, co da się zrealizować na istniejącym schemacie, i wypisuję resztę jako zależności.

## Zmiana kontraktu
**NIEWYMAGANA.**
- Nowe ID wymagania jest zbędne: `SRV-SOURCE-OF-TRUTH` zawiera dokładnie to kryterium akceptacji, o które chodzi w tym WO. Dodanie drugiego ID na tę samą regułę rozjechałoby `kk-trace` (dwa ID, jedno zachowanie) — patrz komentarz przy pozycji 22 `BATCH-MEDIUM-LOW-CLEANUP` w rejestrze.
- `contracts/rbac.contract.mjs` już daje `services.delete = ['admin']`. Bez zmian.
- **Migracja schematu NIEWYMAGANA w tym WO** — świadomie. Widok i naprawa usuwania działają na `serwisy` w obecnym kształcie. Rozszerzenie enuma o `AWAITING_CONTACT`/`IGNORED` oraz dodanie `booking_id`/`reminder_sent_at`/`bookings` to osobny WO dla `contract-steward` (patrz „Zależności"), bo wymaga otwartego okna kontraktowego i pociąga za sobą cron/N10.

## Decyzje rozstrzygnięte (nie pytamy)

**D1. Model wiersza w widoku ma dwa rodzaje.**
`ServiceSummary` dostaje pola rozróżniające pochodzenie:
- `source: 'service' | 'forecast'`
- `service_id: string | null` — UUID z `serwisy`, `null` dla prognozy
- `installation_id: string` — zawsze wypełnione (do nawigacji do kartoteki)

Pole `id` przestaje być dwuznaczne: nie używamy go jako klucza akcji. Klucz Reacta = `service_id ?? 'forecast:' + installation_id`.

**D2. Które rekordy trafiają do widoku.**
- Dla każdej instalacji z co najmniej jednym rekordem `serwisy`: wiersz(e) z `serwisy`, **niezależnie od statusu** (`PLANNED`, `SCHEDULED`, `COMPLETED`, `CANCELLED`). Data wiersza = `data_realizacji`, a gdy `null` — `instalacje.next_service_date` z widocznym oznaczeniem „termin nieustalony".
- Dla instalacji z `next_service_date != null` i **bez** żadnego rekordu `serwisy`: jeden wiersz `forecast` z `next_service_date`.
- Instalacja bez `next_service_date` i bez `serwisy` nie pojawia się wcale.
Uzasadnienie: rekord serwisu wypiera prognozę dla tej instalacji — dokładnie treść `SRV-SOURCE-OF-TRUTH`. Prognoza nie może współistnieć obok rekordu, bo dyspozytor zobaczyłby dwie „daty serwisu" tej samej instalacji.

**D3. „Usuń" dla wiersza `source: 'service'` — twarde usunięcie rekordu `serwisy`, admin only.**
Zachowujemy dotychczasową semantykę UI (komunikat „nieodwracalne, RODO"). Rekord serwisu nie jest polem pochodnym, więc `adr010-derived-write` go nie dotyczy. Nie wprowadzamy tu soft-delete przez status `IGNORED`, bo tej wartości nie ma w enumie — dorobienie jej to zmiana kontraktu, a mieszanie jej z naprawą buga rozlałoby WO.

**D4. „Usuń" dla wiersza `source: 'forecast'` — akcja NIEDOSTĘPNA.**
Pozycja menu nie jest renderowana (nie „disabled", nie „szara"). Nie ma czego kasować: jedyną rzeczą do skasowania byłoby `next_service_date`, czego hook `adr010-derived-write` zabrania i słusznie — pole zostanie przeliczone przy najbliższym `do:computeNextServiceDate` i „usunięcie" byłoby kłamstwem wobec użytkownika.

**D5. `deleteServiceAction` broni się także serwerowo.**
Sygnatura pozostaje `(id: string)`, ale `id` jest odtąd kontraktowo `services.id`. Walidacja Zod (UUID) → sprawdzenie roli → `findUnique` → jeśli brak rekordu, zwróć `{ success: false, error: 'Rekord serwisu nie istnieje…' }` zamiast rzucać P2025 w catch. Kolejność `can()` przed jakimkolwiek zapytaniem Prisma (wymóg `kk-authz-gate`).

**D6. Pozostałe pozycje menu bez zmian.** „Wyślij przypomnienie", „Przydziel brygadę", „Oznacz jako wykonany" zostają atrapami — poza zakresem.

## Kryteria akceptacji

- [ ] AC1: Instalacja mająca rekord `serwisy` pojawia się w widoku z `service_id` równym `serwisy.id`; `service_id` nigdy nie równa się `instalacje.id`.
- [ ] AC2: Rekord `serwisy` w każdym z czterech statusów (`PLANNED`, `SCHEDULED`, `COMPLETED`, `CANCELLED`) jest widoczny w widoku — żaden status nie jest filtrowany.
- [ ] AC3: Instalacja z `next_service_date` i **bez** rekordu `serwisy` pojawia się jako wiersz z `source: 'forecast'`, `service_id === null`, datą równą `next_service_date`.
- [ ] AC4: Instalacja, która ma rekord `serwisy`, **nie** generuje dodatkowego wiersza prognozy — mimo niepustego `next_service_date`.
- [ ] AC5: Wywołanie `deleteServiceAction(serwisy.id)` przez `admin` usuwa ten i tylko ten rekord `serwisy`; wiersz znika z wyniku `getUpcomingServices()` po ponownym wywołaniu.
- [ ] AC6: Po AC5 `instalacje.next_service_date` tej instalacji ma **niezmienioną** wartość, a instalacja wraca do widoku jako wiersz `forecast`.
- [ ] AC7: Wywołanie `deleteServiceAction(instalacje.id)` (ID nieistniejące w `serwisy`) zwraca `{ success: false }` z komunikatem o nieistniejącym rekordzie i **nie usuwa niczego** — liczność `serwisy` i `instalacje` bez zmian.
- [ ] AC8: `deleteServiceAction` wywołane przez `dyspozytor`, `monter`, `audytor` oraz przy braku roli zwraca `{ success: false, error: 'Brak uprawnień…' }`, a licznik rekordów `serwisy` się nie zmienia.
- [ ] AC9: W renderze wiersza `source: 'forecast'` nie występuje pozycja „Usuń"; w wierszu `source: 'service'` występuje.
- [ ] AC10: W całym katalogu `apps/b2b-web/src/app/(dashboard)/services/` nie ma zapisu do `next_service_date` (weryfikowalne statycznie; hook `adr010-derived-write` musi przejść).
- [ ] AC11: `deleteServiceAction` nie wykonuje żadnego zapytania Prisma przed sprawdzeniem `can()`.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Idempotencja usuwania:** dwukrotne `deleteServiceAction` z tym samym ID — drugie zwraca kontrolowany błąd, nie wyjątek, i nie kaskaduje na `instalacje`.
- **Kaskada:** `serwisy.instalacja_id` ma `onDelete: SetNull`. Rekord serwisu z `instalacja_id = null` (osierocony) — decyzja: pokazujemy go z adresem/klientem z własnych pól `serwisy` (`klient_id`, `adres_id`), datą `data_realizacji`; jeśli i ona jest `null`, wiersz jest pomijany. Musi mieć test, bo dziś kod zakłada istnienie `lead.klient`.
- **Wiele rekordów `serwisy` na jednej instalacji** (historia lat) — każdy jest osobnym wierszem, żaden nie jest cichy.
- **Uprawnienia:** komplet ról z `rbac.contract.mjs` + brak sesji (AC8).
- **Strefa czasowa:** `next_service_date` to `@db.Date`, `data_realizacji` to `Timestamptz(6)`. Sortowanie i licznik „dni do serwisu" muszą dawać ten sam wynik dla obu typów; test na dacie granicznej (dziś o 23:30 czasu lokalnego / Europe/Warsaw) — dziś `differenceInDays` w `services-client.tsx:94` liczy na `new Date()` bez normalizacji do północy.
- **Brak klienta / brak adresu** — fallbacki „Nieznany Klient" / „Brak adresu" zostają.

## Poza zakresem

- Tworzenie tabeli `services` i `bookings`, zmiana nazwy `serwisy` → `services`.
- Dodanie `AWAITING_CONTACT` / `IGNORED` do `ServiceStatus`, `booking_id`, `scheduled_date`, `reminder_sent_at`.
- Cron przypominający, `N10`, `SRV-REMINDER-ONCE`.
- Rezerwacja terminu przez klienta, przekładanie wizyty.
- Działające „Oznacz jako wykonany", „Przydziel brygadę", „Wyślij przypomnienie".
- Zapis/przeliczanie `next_service_date` w jakiejkolwiek postaci.
- Serwis pogwarancyjny (otwarte w ADR-010).

## Zależności (osobne WO, nie blokują tego)

1. **WO dla `contract-steward`:** migracja ADR-010 na `serwisy` — enum `+AWAITING_CONTACT +IGNORED`, kolumny `booking_id`, `scheduled_date`, `reminder_sent_at`, tabela `bookings`. Dopóki jej nie ma, `CHANGES-ADR-010.md` §database_model opisuje stan nieistniejący.
2. **Po (1):** zamiana D3 (twarde usunięcie) na `status = IGNORED` jako domyślną akcję dyspozytora, z twardym usunięciem zostawionym adminowi.

## Ryzyka i nieznane

- **Dokument kłamie o stanie schematu.** `CHANGES-ADR-010.md:52` twierdzi „sprawdzone w obie strony", a `services`/`bookings` nie istnieją. Ktokolwiek czyta ten ADR bez zajrzenia do `schema.prisma` zaplanuje pracę na nieistniejących tabelach. Warto, żeby `doc-scribe` dopisał tam adnotację o stanie faktycznym.
- **`serwisy` miesza dwa byty.** Ma `opis_usterki` i `data_zgloszenia`, czyli wygląda jak zgłoszenie usterki, mimo że istnieje osobne `usterki_incidents`. Nie wiadomo, czy przegląd roczny i naprawa usterki mają dzielić tę tabelę. Nie rozstrzygam tego tutaj — widok pokazuje wszystko, co wisi na instalacji, i to jest bezpieczniejsze niż filtr oparty na zgadywaniu.
- Kto ustawia `IGNORED` — otwarte w ADR-010, dlatego D3 nie opiera się na tym statusie.

## Rozmiar

**Mały/średni. Jeden przebieg GREEN wystarczy.** Zmiana obejmuje jeden plik server actions, jeden komponent klienta i jeden plik testowy; brak migracji, brak zmian kontraktu, brak powiadomień. Ryzyko przekroczenia limitu 3 iteracji leży wyłącznie w przypadku osieroconego serwisu (`instalacja_id = null`) — jeśli implementacja się tam potknie, to jest to miejsce do diagnozy, nie do czwartej próby.
