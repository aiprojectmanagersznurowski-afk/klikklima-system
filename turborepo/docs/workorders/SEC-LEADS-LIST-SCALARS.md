# WO: SEC-LEADS-LIST-SCALARS — zawężenie SKALARÓW leada w `getLeads()` do zestawu zużywanego przez listę

## Wymagania: SEC-LEADS-LIST-SCALARS (status TODO, risk MEDIUM, 11 AC)

Sąsiedztwo (zamknięte, NIE cofać): `SEC-LEADS-LIST-MINIMIZE` (relacje w tym samym zapytaniu),
`SEC-ASSIGNMENT-POOL-MINIMIZE` (pula audytorów/ekip), `SEC-RLS-AUDITOR-SCOPE` (dostęp do listy).

## Kontekst kodu

### Istnieje

- `apps/b2b-web/src/app/(dashboard)/leads/actions.ts` — `getLeads()` (linie 256–376).
  `prisma.leady.findMany()` z `select`, w którym **relacje są już zawężone** (`klient`, `adres`,
  `instalacje.zespol`, `audytor`), ale **skalary leada są wypisane wszystkie** (linie 303–322),
  z komentarzem, który wprost mówi: „Pola samego leada NIE są zawężane (wymaganie dotyczy
  wyłącznie relacji)". To jest dokładnie ten komentarz, który to WO ma unieważnić.
  Wynik budowany jest `map((lead) => ({ ...lead, <relacje> }))` (linie 356–364) — **spread
  kopiuje każde pobrane pole**, więc dziś „pobrane == wysłane".
- `apps/b2b-web/src/app/(dashboard)/leads/leads-client.tsx` — typ `Lead` (linie 34–54)
  wyprowadzony z `Prisma.leadyGetPayload<{ include: {...} }>` przez `Omit` czterech relacji
  i doklejenie ich wąskich kształtów. Czyli: **relacje wąskie, skalary szerokie** (komplet
  kolumn modelu `leady`).
- `apps/b2b-web/src/app/(dashboard)/leads/page.tsx` — jedyny konsument `getLeads()`
  (`initialLeads={result.leads}`). Poza nim `getLeads()` nie jest wołane nigdzie w `apps/`.
- `apps/b2b-web/tests/leads-list-minimize.test.ts` — istniejący wzorzec dowodowy
  (`new Set(Object.keys(...))` vs stała lista kluczy, fixture „pełny rekord" jako mutant,
  osobne asercje na argumenty `findMany`). Te testy MUSZĄ dalej przechodzić.
- `apps/b2b-web/src/app/(dashboard)/leads/[id]/page.tsx` — **zweryfikowane ponownie
  2026-08-26**: nadal własne, osobne `prisma.leady.findUnique({ where, include: {...} })`
  (linia 55–57). Nie importuje `getLeads()`. Ta zmiana go nie dotyka.

### Zweryfikowany zestaw skalarów faktycznie zużywanych przez `leads-client.tsx`

Odczyt całego pliku (638 linii), nie tylko tabeli:

| Pole | Gdzie zużywane |
|---|---|
| `id` | `key` wiersza (345), skrót `#8` (348), wyszukiwarka (183), argument akcji (394, 421, 472, 498, 512, 519), `href` szczegółów (446), dopasowanie leada dla dialogów (592, 622) |
| `status` | filtr etapu (177), aktualizacje optymistyczne (202–211, 234), znacznik etapu (362), `CONTEXT_ACTIONS` (342), flagi `isNewLead`/`isColdLead`/`isE4` (338, 453, 455) |
| `created_at` | data wpłynięcia (332), próg opóźnienia >24 h (339–340), sortowanie zapasowe (194) |
| `data_rezerwacji` | kolumna terminu audytu (333), sortowanie główne (187–192), **prop `installationDate` dla `AssignCrewDialog`** (621–625) |
| `estymowana_wycena` | kolumna kwoty (334, 367) |
| `quoted_at` | **prop `quotedAt` dla `ReturnToFunnelDialog`** (592) |

Propsy dialogów sprawdzone jawnie: `ReturnToFunnelDialog` bierze z leada wyłącznie
`id` + `quoted_at`; `AssignCrewDialog` — `id` + `data_rezerwacji`; `ArchiveLostDialog` — samo
`id` (`archiveDialogLeadId`, żadnego pola z rekordu). **Potwierdzam zestaw sześciu pól
podany przy rejestracji wymagania.**

### Brakuje

- Zawężenia skalarów w `select` (AC4).
- Wąskiego typu `Lead` wyprowadzonego z rzeczywistego wyniku `getLeads()` (AC9).
- Jakiegokolwiek testu na to ID: `node tools/kk-trace.mjs` nie zna `SEC-LEADS-LIST-SCALARS`
  (brak wpisu; dla porównania `SEC-LEADS-LIST-MINIMIZE` ma 8 trafień i status DONE).
  To jest **nowa implementacja — RED dopiero nastąpi**.

### Ustalenia faktograficzne korygujące treść kontraktu (nie zmieniają wymagania)

1. **AC9 mówi o trzech wystąpieniach `as Lead` — w kodzie są DWA.**
   `grep -n "as Lead"` w `leads-client.tsx` zwraca trzy linie: 213 (`} as Lead;`),
   234 (`return { ...l, status: targetStatus } as Lead;`) i 342
   (`CONTEXT_ACTIONS[lead.status as LeadStatus]`). Trzecie trafienie to **substring
   `as LeadStatus`**, zupełnie inne rzutowanie (zawężenie unii statusów do klucza mapy),
   które ma **zostać nietknięte**. Do usunięcia są wyłącznie linie 213 i 234.
   Implementer nie ma szukać trzeciego `as Lead` — nie istnieje.
2. `audytor_id` — potwierdzone: występuje w `leads-client.tsx` **wyłącznie raz**, w zapisie
   do stanu w aktualizacji optymistycznej (linia 210). Żadne miejsce w pliku ani w trzech
   dialogach tej wartości **nie czyta** (nazwę audytora widok bierze z relacji `lead.audytor`,
   linie 335, 377–379, 398). Rozstrzygnięcie AC8 stosuje się w wariancie domyślnym: pole
   **odpada z zestawu**, a zapis `audytor_id: auditorId` znika z linii 210.
3. `klient_id`, `adres_id`, `updated_at`, `bucket_entered_at` — potwierdzone `grep`em:
   **zero wystąpień** w `leads-client.tsx` i w trzech plikach dialogów. Nie są używane do
   filtrowania ani sortowania po stronie klienta (filtr = `status` + nazwa klienta + `id`,
   sortowanie = `data_rezerwacji` + `created_at`). Odpadają.
4. `auto_rejected_reason` jest potrzebny **w `where`** (kubełek `rejected_auto`, linia 275),
   ale nie jest renderowany → zgodnie z AC6 zdanie drugie: wolno użyć w zapytaniu,
   nie wolno wysłać do klienta. Zostaje w `where`, znika z `select`.

## Zmiana kontraktu

**NIEWYMAGANA.** Wymaganie jest już zarejestrowane w `contracts/requirements.contract.mjs`
(status TODO). Zmiana dotyczy wyłącznie kodu aplikacji: `select` w jednej funkcji, mapowanie
wyniku i typ w jednym komponencie klienckim. Nie rusza `schema.prisma`, migracji, maszyny
stanów, katalogu powiadomień, progów SLA ani macierzy uprawnień. Po zamknięciu
`contract-steward` przestawia status na DONE — to jedyna przyszła zmiana kontraktu.

## Docelowy kształt

### `select` skalarów w `getLeads()` (relacje BEZ ZMIAN)

```
id, status, created_at, data_rezerwacji, estymowana_wycena, quoted_at
+ klient / adres / instalacje.zespol / audytor — dokładnie jak dziś
```

Usuwane ze `select` (13 pól): `klient_id`, `adres_id`, `odpowiedzi_triage`,
`wybrana_konfiguracja`, `audytor_id`, `finalna_wycena_pln`, `przewidywany_czas_montazu`,
`notatki_wewnetrzne`, `bucket_entered_at`, `lost_reason`, `lost_reason_note`,
`auto_rejected_reason`, `last_followup_date`, `updated_at`.

Komentarz przy `select` (linie 296–301) wymaga **przepisania** — zdanie „Pola samego leada
NIE są zawężane" staje się nieprawdą i po zmianie wprowadzałoby w błąd następnego czytelnika.

### Mapowanie wyniku

`...lead` (spread, linia 357) **musi zniknąć**. Każde pole wypisane jawnie — spread jest
mechanizmem, przez który przyszłe rozszerzenie `select` wycieknie do klienta bez niczyjej
decyzji, i jest jedyną warstwą widoczną dla testów mockujących `findMany` (mock zwraca to,
co mu każą, niezależnie od `select`). AC4: `select` to warstwa pierwsza, mapowanie druga —
**wymagane obie**.

### Typ `Lead` w `leads-client.tsx`

Przestaje pochodzić z `Prisma.leadyGetPayload` przez `Omit`; staje się wąskim typem
wyprowadzonym z rzeczywistego wyniku serwera, wzorem `AuditorPoolEntry` z tego samego pliku
(linia 62): `Awaited<ReturnType<typeof getLeads>>["leads"][number]`. Import `Prisma` z
`@repo/database` staje się wtedy prawdopodobnie nieużywany (linia 6) — `LeadStatus` zostaje.
Rzutowania z linii 213 i 234 znikają razem z szerokim typem; **nie wolno ich zastąpić
`satisfies`, `as unknown as`, `any` ani lokalnym `Partial<Lead>`** — po zawężeniu obiekt
`{ ...l, status: newStatus, audytor: ... }` jest już poprawnego typu bez pomocy.

### BEZ ZMIAN (lista zamknięta)

`where` (w tym `bucket === "rejected_auto"` po `auto_rejected_reason` i `bucketToStatus`),
`orderBy: [{ data_rezerwacji: "asc" }, { created_at: "desc" }]`, `skip`/`take`,
`prisma.leady.count({ where })`, `prisma.leady.groupBy({ by: ['status'] })` i wyliczanie
`stageCounts`/`allCount`, kształt zwracanego obiektu (`leads`/`totalCount`/`totalPages`/
`stageCounts`), gałąź `catch`, cztery zawężone relacje, `leads/[id]/page.tsx`, `page.tsx`.

## Kryteria akceptacji (wykonalne)

- [ ] **AC1 (kształt, nie obecność).** Dla rekordu wejściowego zawierającego komplet kolumn
      tabeli `leady`, `Object.keys(leads[0])` jest **równe jako zbiór** dokładnie
      `{id, status, created_at, data_rezerwacji, estymowana_wycena, quoted_at, klient, adres,
      instalacje, audytor}`. Dowód przez równość zbiorów; `toContain`, `toMatchObject`
      i `expect(...).toBeUndefined()` na pojedynczym polu nie są dowodem.
- [ ] **AC2 (pola wrażliwe, niezależnie od nazwy kolumny).** Test iteruje po kluczach leada
      i sprawdza, że **żaden** nie należy do zbioru wrażliwych (dziś: notatka wewnętrzna,
      surowe odpowiedzi triage). Sformułowanie musi przetrwać przemianowanie kolumn wg
      ADR-002 — po przemianowaniu test nadal ma łapać przeciek, a nie przechodzić na zielono
      dlatego, że stara nazwa zniknęła.
- [ ] **AC3 (zawężenie w zapytaniu).** Argument przekazany do `prisma.leady.findMany`
      zawiera `select`, którego zbiór **skalarnych** kluczy jest równy zestawowi sześciu pól;
      żadne z 13 usuwanych pól nie występuje w `select` (na żadnym poziomie).
- [ ] **AC4 (relacje nietknięte).** W tym samym argumencie `findMany`
      `select.klient`/`adres`/`instalacje.zespol`/`audytor` mają dokładnie te same zbiory
      kluczy co przed zmianą, a testy `leads-list-minimize.test.ts` przechodzą bez edycji.
- [ ] **AC5 (zapytanie poza `select` bez zmian).** Wywołanie `getLeads({ status, page, limit })`
      i wariant kubełkowy `rejected_auto` przekazują do `findMany` te same `where`, `orderBy`,
      `skip`, `take` co dziś; `count` i `groupBy` wołane jak dziś; `stageCounts` (z `ALL`)
      i `totalPages` liczone tak samo. Istniejące testy filtrów/sortowania/liczników zostają
      i przechodzą.
- [ ] **AC6 (kontrola pozytywna — lista nadal działa).** Po zmianie lista renderuje: skrót
      `#8` identyfikatora, datę wpłynięcia, znacznik „Opóźniony (>24h)" dla `NEW_LEAD`
      starszego niż 24 h, znacznik etapu w widoku „Wszystkie", kwotę estymowaną, termin audytu.
      Zestaw testów nie może przechodzić dla funkcji zwracającej same `id` ani pustą listę.
- [ ] **AC7 (dialogi dostają swoje daty).** `ReturnToFunnelDialog` nadal otrzymuje
      `quotedAt` z `quoted_at` wybranego leada, `AssignCrewDialog` nadal otrzymuje
      `installationDate` z `data_rezerwacji`. Regresja tutaj jest cicha — dialog otwiera się
      i wygląda poprawnie z `null`.
- [ ] **AC8 (`audytor_id` odpada wraz z zapisem do stanu).** `audytor_id` nie występuje
      w zwróconym obiekcie ani w stanie komponentu; przypisanie/odznaczenie audytora nadal
      natychmiast zmienia widoczną nazwę audytora i status (`NEW_LEAD` ⇄ `AWAITING_AUDIT`),
      a przy błędzie serwera przywraca poprzedni stan listy.
- [ ] **AC9 (brak rzutowań).** W `leads-client.tsx` nie ma `as Lead` (dwa wystąpienia
      usunięte); `as LeadStatus` w linii `CONTEXT_ACTIONS[...]` zostaje. Brak `as any`,
      `@ts-ignore`, `as unknown as`. `tsc` przechodzi.
- [ ] **AC10 (zamknięcie dla przyszłych konsumentów).** Zobacz „Rozstrzygnięcie AC10" niżej —
      dowodem jest test kształtu oparty o **stałą listę kluczy zadeklarowaną w teście**
      (nie o `Object.keys` wyniku), tak że dopisanie pola do `select` psuje test.
- [ ] **AC11 (widok szczegółów nietknięty).** `leads/[id]/page.tsx` nadal wykonuje własne
      `findUnique` i nadal pokazuje notatkę wewnętrzną oraz dane triage. Żadna linia tego
      pliku nie jest zmieniona przez tę naprawę.

## Rozstrzygnięcie AC10 — czy potrzebny mechanizm poza testem

**Sam typ nie wystarczy i nie da się tego naprawić typem.** Typ wyprowadzony
(`Awaited<ReturnType<typeof getLeads>>`) jest z definicji **podatny na ciche rozszerzenie**:
dopisanie pola do `select` propaguje się do typu bez błędu kompilacji — to jest jego zaleta
(brak dryfu) i jednocześnie powód, dla którego nie jest bramką. Odwrotny kierunek (typ
zadeklarowany ręcznie, żeby „się złamał") wprowadziłby drugą, ręcznie utrzymywaną kopię
kształtu — dokładnie ten antywzorzec, który `AuditorPoolEntry` w tym pliku już raz usunął
(komentarz przy linii 57), i tak czy owak nie złamałby się przy **rozszerzeniu** (obiekt
z nadmiarowym polem spełnia węższy typ przy przypisaniu przez zmienną).

**Wniosek: bramką jest test kształtu + zapis w kontrakcie, nie mechanizm typów.** Warunek
konieczny, żeby test faktycznie był bramką: lista dozwolonych kluczy musi być **stałą
zadeklarowaną w pliku testu** i porównywaną przez równość zbiorów w obie strony. Test
w postaci „każdy klucz wyniku należy do zbioru z produkcji" nie zamyka niczego. Dodatkowo
wymagane: komentarz `SEC-LEADS-LIST-SCALARS` przy `select` i przy mapowaniu, mówiący wprost,
że dopisanie pola wymaga zmiany wymagania, a przy polu wrażliwym — osobnego ID i decyzji
człowieka.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Mock zwraca komplet kolumn (mutant).** Fixture „pełny rekord leada" w stylu
  `fullLeadRecord`/`fullAuditorRecord` z `leads-list-minimize.test.ts`, z wypełnioną notatką
  wewnętrzną i odpowiedziami triage. Bez tego test przechodzi także dla implementacji,
  która nie zawęża niczego — mock i tak zwraca tylko to, co mu wpisano.
- **Wartość pusta ≠ pole nieobecne.** Rekord, w którym notatka wewnętrzna jest `null`/`""`,
  nie może być dowodem zawężenia. Fixture musi mieć te pola **niepuste**.
- **`select` vs `map` — dwie osobne asercje.** Jedna na argument `findMany` (AC3), druga na
  zwrócony obiekt (AC1). Przy mockowanym Prisma pierwsza jest jedynym dowodem, że dane nie
  weszły do pamięci serwera; druga — że nie wyszły do klienta. Żadna nie zastępuje drugiej.
- **Kubełek `rejected_auto`.** `auto_rejected_reason` znika ze `select`, ale musi zostać
  w `where`. Test: `getLeads({ bucket: "rejected_auto" })` nadal przekazuje
  `{ status: "QUOTE_REJECTED", auto_rejected_reason: "AUTO_REJECT_14_DAYS" }`. To jest
  najbardziej prawdopodobna cicha regresja tej zmiany.
- **Sortowanie.** `orderBy` po `data_rezerwacji` i `created_at` musi przetrwać — oba pola
  zostają w zestawie, ale klient dodatkowo sortuje w `.sort()` (linie 186–195) i test
  sortowania klienckiego (lead bez `data_rezerwacji` na końcu) powinien zostać zielony.
- **Próg 24 h liczony po stronie klienta.** `created_at` należy do zestawu **mimo że nie jest
  wyświetlany surowo w jednej z komórek** — to przykład z AC2 kontraktu: „zużywane do
  wyliczenia" ≠ „niepotrzebne". Test na znacznik „Opóźniony (>24h)".
- **Strefa czasowa.** `data_rezerwacji` to `@db.Timestamptz`, formatowanie i `new Date(...)`
  w dialogu przechodzą przez granicę serwer/klient jako `Date` (serializacja Server
  Component → props). Zawężenie `select` nie może zmienić typu tej wartości — test ma
  sprawdzić, że do `AssignCrewDialog` trafia `Date`, nie `string`.
- **Pusta lista i `catch`.** `getLeads()` przy błędzie zwraca `{ leads: [], ... }` — test
  kształtu musi to znieść bez wyjątku (`leads[0]` nie istnieje), a `stageCounts` pozostaje `{}`.
- **Uprawnienia/zakres audytora — bez zmian.** `SEC-RLS-AUDITOR-SCOPE` nie jest przez to WO
  ruszany; jeśli w `getLeads()` istnieje zawężenie zakresu audytora w `where`, musi zostać
  co do znaku. To nie jest naprawa RBAC.

## Poza zakresem

- `leads/[id]/page.tsx` — **jawnie i celowo** (AC11). Nie zawężać „przy okazji".
- Przemianowanie kolumn tabeli `leady` wg ADR-002 / `docs/architecture/NAMING.md`.
  To WO nie zmienia ani jednej nazwy kolumny; ma tylko nie przeszkodzić przyszłej migracji.
- Inne zapytania w `actions.ts` (`getAuditors`, `getCrews`, `assignCrewToLead`,
  `returnToFunnel`, `advanceLeadStatus`, `deleteLeadAction`) — mają własne `select`
  i własne wymagania.
- Dashboard, kalendarz, pula przypisania, eksporty — jeśli mają analogiczny przeciek,
  to osobne ID, nie rozszerzenie tego.
- Refaktor `where: any` (linia 268) na typ Prismy — kuszące przy okazji, ale to inna zmiana
  i inne ryzyko; zostawić.
- Zmiana statusu wymagania w kontrakcie na DONE — robi `contract-steward` po zamknięciu.

## Ryzyka i nieznane

- **Ryzyko potwierdzam jako MEDIUM.** Argumenty za: pola wrażliwe (notatka wewnętrzna,
  surowe dane triage z adresem i kontaktem) jadą do przeglądarki każdego dyspozytora
  i audytora, do 50 rekordów naraz, bez żądania — i są dostępne w devtools/HTML źródłowym.
  Argumenty przeciw HIGH: dostęp do samego widoku jest już poprawnie ograniczony rolą
  i zakresem audytora (`SEC-RLS-AUDITOR-SCOPE`), więc odbiorcą jest osoba **uprawniona do
  danych tego leada** na sąsiednim ekranie — to nadmiarowość wobec zasady minimalizacji,
  a nie eskalacja uprawnień. Argumenty przeciw LOW: `notatki_wewnetrzne` to pole swobodnego
  tekstu, którego zawartości nikt nie kontroluje, a `odpowiedzi_triage` to surowy zrzut
  formularza B2C — treść może wykroczyć poza to, co ekran szczegółów pokazuje świadomie.
  MEDIUM stoi.
- **Ryzyko wykonawcze (główne): cicha utrata `where`/`orderBy`.** Zawężenie kolumn to klasa
  zmiany, przy której zniknięcie warunku filtrującego nie psuje kompilacji ani typów.
  Stąd AC5 i osobny przypadek brzegowy na kubełek `rejected_auto`.
- **Nieznane: czy `updated_at` nie jest używane przez `router.refresh()`/dedupe React.**
  Sprawdzone `grep`em — nie jest odczytywane w komponencie ani w dialogach; kluczem listy
  jest `lead.id`. Uznaję za rozstrzygnięte, ale to jedyne pole, którego usunięcie mogłoby
  teoretycznie wpłynąć na rekoncyliację stanu.
- **Nieznane: `estymowana_wycena` jako typ.** Kod robi `lead.estymowana_wycena || "Brak"`
  i renderuje bez formatowania — jeśli to `Decimal` Prismy, przechodzi przez granicę
  serwer/klient już dziś i to WO tego nie zmienia. Nie naprawiać tutaj; jeśli test to
  odsłoni, zgłosić jako osobne znalezisko.
- **Brak źródła w dokumentach architektury.** Wymaganie pochodzi z przeglądu i decyzji
  człowieka z 2026-08-26, nie z `docs/architecture/`. Nie ma tu sprzeczności między
  dokumentami do rozstrzygnięcia — nie ma dokumentu.

## Pytania otwarte

Brak pytań blokujących. Trzy punkty, które przy rejestracji były otwarte, rozstrzygam
dowodem z kodu i zapisuję powyżej: `audytor_id` odpada wraz z zapisem do stanu (AC8,
wariant domyślny, nikt nie czyta), `klient_id`/`adres_id` odpadają (zero wystąpień
w konsumencie i w dialogach, filtrowanie/sortowanie klienckie ich nie używa),
AC10 domyka test kształtu ze stałą listą kluczy, nie mechanizm typów.
