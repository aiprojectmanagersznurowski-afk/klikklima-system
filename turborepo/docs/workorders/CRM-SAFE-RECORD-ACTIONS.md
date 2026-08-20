# WO: CRM-SAFE-RECORD-ACTIONS — bezpieczne akcje na rekordach CRM (blokada audytora, ukrycie zespołu bez certyfikatu, wyjścia z bucketu zimnych leadów)

**Cel:** żadna destrukcyjna ani „cofająca" akcja w CRM nie może przejść po cichu. Usunięcie audytora ma być zablokowane, dopóki wiszą przy nim leady. Zespół z nieważnym certyfikatem ma zniknąć z puli w E4 — w UI i na serwerze. Powrót zimnego leada do obiegu ma być świadomą decyzją z aktualną ceną. Trwała archiwizacja ma zostawić powód utraty ze słownika zamkniętego.

## Wymagania

| ID | Status w rejestrze | Ryzyko | Źródło |
|---|---|---|---|
| `CRM-AUDYT-AC1` | TODO | HIGH | `b2b_crm_specifications.md#5` |
| `CRM-ZESP-AC2` | TODO | HIGH | `b2b_crm_specifications.md#6` |
| `CRM-ZIMNE-AC2` | TODO | HIGH | `b2b_crm_specifications.md#7` |
| `CRM-ZIMNE-AC3` | TODO | HIGH | `b2b_crm_specifications.md#7` |

Pokrycie wg `node tools/kk-trace.mjs`: domena `crm` ma **0/21 pokrytych**. Wszystkie cztery wymagania startują od zera.

**Świadomie poza zakresem (decyzja człowieka):** `CRM-ZESP-AC3` (kalendarz i silnik dostępności ekip), `CRM-AUDYT-AC2` (dzienny cap audytów).

---

## Kontekst kodu (zweryfikowany 2026-08-20)

### Istnieje

| Plik / miejsce | Stan faktyczny |
|---|---|
| `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts` | `deleteAuditorAction(id)` — twardy `prisma.audytorzy.delete`, bez sprawdzenia roli, bez sprawdzenia wiszących leadów, bez zwracanego wyniku (`void`, więc UI nie ma jak pokazać błędu). `getAuditors()` liczy już `leadsCount` z `include: { leady: true }` — dane do blokady są pod ręką |
| `apps/b2b-web/src/app/(dashboard)/leads/actions.ts` | `getCrews()` = `where: { aktywny: true }`, nic o certyfikatach. `deleteLeadAction(id)` — twardy DELETE, `void`. `advanceLeadStatus` waliduje przejścia z lokalnej mapy `ALLOWED_TRANSITIONS`, nie z kontraktu |
| `apps/b2b-web/src/app/(dashboard)/leads/leads-client.tsx` | linia 68: akcja `„Reaktywuj → Nowy lead"` → `advanceLeadStatus(leadId, "NEW_LEAD")`, bez dialogu, bez sprawdzania wieku ceny. Linia 97: `deleteLeadAction(id)` po ogólnym potwierdzeniu RODO — bez przechwycenia powodu utraty |
| `contracts/funnel.contract.mjs` | **T15** `QUOTE_REJECTED → AUDIT_COMPLETED`, guard `quoteRefreshedIfStale`, efekt `do:refreshQuoteValidity`. **T16** `QUOTE_REJECTED → ARCHIVED_LOST`, guard `lostReasonProvided`, efekt `do:recordLostReasonForAnalytics`. Stan `ARCHIVED_LOST` (n=103) jest terminalny. `LOST_REASONS` = 6 pozycji (`COMPETITOR`, `PRICE_TOO_HIGH`, `POSTPONED`, `NO_CONTACT`, `TECHNICAL_BLOCKER`, `OTHER`) — z komentarzem, że lista jest **propozycją do potwierdzenia przez człowieka** |
| `contracts/sla.contract.mjs` | `COLD_LEAD_REPRICE` = 30 dni, `req: ['CRM-ZIMNE-AC2']`. Próg **istnieje**, żadnego literału `30` w kodzie |
| `contracts/rbac.contract.mjs` | `DELETE_POLICIES`: `auditors` → `BLOCK_UNTIL_REASSIGNED` („Wymusza przepięcie wiszących leadów"). `PERMISSIONS`: `auditors.delete = ['admin']`, `leads.delete = ['admin']`. `AUDIT_REQUIREMENTS.mustLog` zawiera `delete` i `manual_status_change` |
| `packages/contracts/src/generated/funnel.ts` | T15, T16, `GUARD_IDS` z `quoteRefreshedIfStale` i `lostReasonProvided` — **wygenerowane, gotowe do importu**. Żadnego konsumenta w `apps/b2b-web` |
| `packages/database/prisma/schema.prisma` | `zespoly_monterskie` ma `fgaz_valid_until @db.Date`, `sep_valid_until @db.Date`, `uprawnienia_sep Boolean`, `aktywny Boolean`. `audytorzy` ma te same daty certyfikatów. `leady` ma `lost_reason String?` i `bucket_entered_at` |
| `apps/b2b-web/src/utils/supabase/middleware.ts` | jedyna bramka dostępu: obecność e-maila w `AuthorizedUser`. **Nie czyta roli**, nie sprawdza żadnej flagi blokady |

### Brakuje

1. **Pola blokady audytora.** `audytorzy` nie ma ani `is_active`, ani `blocked_at`, ani `availability_status`. Wymagania AC mówią „Zablokowane konto nie loguje się do Field App" — dziś nie ma czego sprawdzić.
2. **Aplikacji Field App w tym repo.** `apps/` zawiera wyłącznie `b2b-web` i `b2c-web`. Kryterium „nie loguje się do Field App" nie jest dziś testowalne end-to-end — patrz Ryzyka R1.
3. **`ARCHIVED_LOST` w enumie `LeadStatus` w Prismie.** Kontrakt ma ten stan, schemat nie. Bez tego T16 nie ma dokąd prowadzić.
4. **Znacznika czasu wyceny.** Nie ma tabeli `quotes`; cena to `leady.finalna_wycena_pln` bez własnej daty. „Cena starsza niż 30 dni" jest dziś **niemierzalna** — jedyny dostępny czas to `updated_at` całego rekordu (zmienia się przy każdym dotknięciu) i `bucket_entered_at`.
5. **Ograniczenia słownikowego na `lost_reason`.** Pole to wolny `String?`. **Co gorsza, jest już zajęte innym znaczeniem**: `getLeads()` filtruje bucket `rejected_auto` po `lost_reason: "AUTO_REJECT_14_DAYS"` — wartość spoza `LOST_REASONS`. Jedno pole niesie dziś dwie różne semantyki.
6. **Sprawdzenia roli w Server Actions.** Prisma omija RLS; `deleteAuditorAction` i `deleteLeadAction` wykonują DELETE dla każdego zalogowanego. To realizacja `CRM-DELETE-ADMIN-ONLY`, tu potrzebna jako warunek wstępny.
7. **Tabeli `audit_log`.** Kontrakt jej wymaga (`mustLog: delete, manual_status_change`), schemat jej nie ma.

---

## Sprzeczności do rozstrzygnięcia — WYMAGA DECYZJI

Poniższe punkty **blokują start implementacji**. Nie wybieram za człowieka.

### D1 — Blokada kontra usunięcie audytora (`CRM-AUDYT-AC1`)

Wymaganie i `b2b_crm_specifications.md` §5 kryterium 1 mówią o **dwóch** ścieżkach: „Administrator może zablokować konto audytora **lub** usunąć je". `contracts/rbac.contract.mjs` rozstrzyga tylko drugą (`auditors → BLOCK_UNTIL_REASSIGNED`).

Do decyzji: czy realizujemy obie ścieżki w tym WO (blokada = odcięcie logowania, leady zostają przypisane; usunięcie = twardy blocker, dopóki wiszą leady), czy tylko twardy blocker na DELETE, a blokadę odkładamy?

Pytanie zależne: **czym jest „wiszący lead"?** §5 mówi o leadach na Etapie 2 i 3 (`AWAITING_AUDIT`, `AUDIT_COMPLETED`). Czy leady w `QUOTE_REJECTED` (zimne) i `ARCHIVED_LOST` też blokują usunięcie, czy relacja ma dla nich przejść na `SET NULL`? Dziś `leady.audytor_id` ma `onDelete: SetNull` — czyli baza **milcząco odpina wszystko**, co jest wprost sprzeczne z `BLOCK_UNTIL_REASSIGNED`.

### D2 — „potwierdzenie **lub** odświeżenie ceny" (`CRM-ZIMNE-AC2`)

Rejestr wymagań jest tu ostrzejszy niż dokument źródłowy:

- `b2b_crm_specifications.md` §7 kryterium 2: „wymaga potwierdzenia **lub** odświeżenia ceny, jeśli upłynęło ponad 30 dni".
- `contracts/requirements.contract.mjs` `CRM-ZIMNE-AC2.acceptance`: „Guard `quoteRefreshedIfStale` **blokuje** powrót leada z ceną starszą niż `SLA.COLD_LEAD_REPRICE_DAYS`" oraz „cena przeterminowana **odrzucona**".

To nie jest ta sama rzecz: dokument dopuszcza klik „rozumiem, wracam", kontrakt każe odrzucić. Do decyzji: dialog potwierdzenia wystarcza, czy wymagamy przejścia przez ponowną wycenę (i wtedy `quoteRefreshedIfStale` odrzuca do skutku)?

### D3 — Od czego liczymy 30 dni (`CRM-ZIMNE-AC2`)

Trzy źródła, dwa różne zegary:

- `contracts/sla.contract.mjs`: „**Po tylu dniach w bucketcie** «Zwróć do obiegu» wymaga odświeżenia ceny" → licz od `bucket_entered_at`.
- `contracts/requirements.contract.mjs`: „lead **z ceną starszą** niż `COLD_LEAD_REPRICE_DAYS`" → licz od momentu wystawienia wyceny.
- `b2b_crm_specifications.md` §7: „upłynęło ponad 30 dni **od wejścia do bucketa**" → `bucket_entered_at`.

Różnica jest realna: do bucketu lead trafia po 14 dniach od wyceny (`SLA-QUOTE-14D`), więc oba zegary rozjeżdżają się o dwa tygodnie. Wariant „wiek ceny" dodatkowo **wymaga nowej kolumny** (patrz Zmiana kontraktu Z3), wariant „wiek bucketu" nie wymaga niczego.

### D4 — `lost_reason` niesie dziś dwie semantyki (`CRM-ZIMNE-AC3`)

`apps/b2b-web/src/app/(dashboard)/leads/actions.ts:55` filtruje bucket po `lost_reason: "AUTO_REJECT_14_DAYS"` — to techniczny znacznik automatycznego odrzucenia, nie powód utraty. Kontrakt wymaga słownika zamkniętego (`LOST_REASONS`, 6 wartości, `AUTO_REJECT_14_DAYS` nie należy do listy).

Do decyzji: (a) rozdzielamy pola — `lost_reason` zostaje wyłącznie powodem utraty ze słownika, a automat dostaje osobny znacznik (np. `rejected_automatically` / `cold_reason`), czy (b) dopisujemy `AUTO_REJECT_14_DAYS` do `LOST_REASONS`, godząc się, że analityka powodów utraty będzie zdominowana przez wpisy automatu?

### D5 — Zatwierdzenie słownika `LOST_REASONS` (`CRM-ZIMNE-AC3`)

Komentarz w `contracts/funnel.contract.mjs` mówi wprost: lista 6 wartości to **propozycja do potwierdzenia przez człowieka**; dokument źródłowy podaje tylko dwa przykłady („Konkurencja", „Za drogo"). Do decyzji: czy zatwierdzamy listę bez zmian? Czy `OTHER` wymaga obowiązkowej notatki tekstowej (dziś opis mówi „Inny (wymaga notatki)", ale pola na notatkę nie ma)?

### D6 — Co znaczy „nieważny certyfikat" zespołu (`CRM-ZESP-AC2`)

`zespoly_monterskie` trzyma równolegle `uprawnienia_sep Boolean` i `sep_valid_until Date?` oraz `certyfikat_fgaz String?` i `fgaz_valid_until Date?`. Do decyzji:

1. Czy zespół z `sep_valid_until = NULL` (data nieuzupełniona) jest ważny czy nieważny? Wariant bezpieczny — nieważny — natychmiast wyczyści pulę w E4, także z ekip realnie pracujących.
2. Czy `crewCertsValid` sprawdza **datę montażu** (opis guardu: „ważne w dniu montażu") czy **dzisiejszą datę**? Przy rezerwacji terminu za 3 tygodnie te odpowiedzi się różnią.
3. `CRM-ZESP-REP` (poza zakresem) mówi, że guard sprawdza certyfikaty **przedstawiciela** (`crews.representative_user_id`) — pola tego nie ma w schemacie. Potwierdzam, że w tym WO sprawdzamy certyfikaty **zespołu** (kolumny na `zespoly_monterskie`), czy czekamy na `CRM-ZESP-REP`?

### D7 — Rozjazd kodu z kontraktem przy „Reaktywuj" (`CRM-ZIMNE-AC2`)

`leads-client.tsx:68` oferuje `„Reaktywuj → Nowy lead"` (`QUOTE_REJECTED → NEW_LEAD`), a lokalna mapa `ALLOWED_TRANSITIONS` to dopuszcza. Kontrakt (T15) prowadzi `QUOTE_REJECTED → AUDIT_COMPLETED`. Zgodnie z zasadą zerową wygrywa kontrakt — ale to zmienia **zachowanie biznesowe**, nie tylko etykietę: lead wraca do wyceny, a nie na początek lejka, i nie traci audytora. Proszę o potwierdzenie, że tak ma być, zanim `implementer-server` skasuje istniejącą ścieżkę.

---

## Zmiana kontraktu / schematu — WYMAGANA

Zakres zależy od D1–D6, ale w każdym wariancie potrzebne jest okno kontraktowe (`node tools/kk-contract-window.mjs open <TICKET>`) i rola `contract-steward`. Nic z poniższych nie jest do ruszenia przez implementerów.

| # | Zmiana | Bezwarunkowa? | Uzasadnienie |
|---|---|---|---|
| Z1 | `enum LeadStatus` w `schema.prisma` + migracja: dodać `ARCHIVED_LOST` | **TAK** | Kontrakt ma stan i przejście T16; bez wartości w enumie archiwizacji nie da się zapisać |
| Z2 | `audytorzy`: nowa kolumna blokady, nazwana po ADR-002 (`is_active BOOLEAN NOT NULL DEFAULT true` albo `blocked_at TIMESTAMPTZ` — do wyboru przy D1) | **TAK** (jeśli D1 = obie ścieżki) | Nie ma dziś czego sprawdzić przy logowaniu |
| Z3 | `leady`: kolumna z datą wystawienia wyceny (`quoted_at TIMESTAMPTZ`) | tylko przy D3 = „wiek ceny" | Bez niej wieku ceny nie da się policzyć; `updated_at` się nie nadaje, zmienia się przy każdej edycji |
| Z4 | Rozdzielenie semantyki `lost_reason` (nowa kolumna albo rozszerzenie `LOST_REASONS`) | tylko przy D4 = (a) | Patrz D4 |
| Z5 | `contracts/funnel.contract.mjs` — potwierdzenie/edycja `LOST_REASONS` | tylko przy D5 z uwagami | Lista jest oznaczona jako propozycja |
| Z6 | `leady.audytor_id`: `onDelete: SetNull` → `Restrict` | tylko przy D1 z twardym blockerem na poziomie bazy | Dziś baza po cichu odpina leady, co jest sprzeczne z `BLOCK_UNTIL_REASSIGNED` |

Kolumny **nowe dostają nazwy angielskie, snake_case** (ADR-002), mimo że tabele pozostają na polskich nazwach — dług `KK-NAMING-BASELINE` (decyzja 2026-08-19) jest zamrożony i **ten WO go nie rusza**. Zmiana nazw `leady`/`audytorzy`/`zespoly_monterskie` jest poza zakresem.

---

## Kryteria akceptacji

### `CRM-AUDYT-AC1` — blokada i usunięcie audytora

- [ ] **AC1.1** Próba usunięcia audytora, do którego przypisany jest choć jeden lead w statusie kwalifikującym (zakres wg D1), kończy się odmową i **listą blokujących rekordów** (identyfikator leada + klient), a audytor po odświeżeniu strony nadal istnieje.
- [ ] **AC1.2** Po ręcznym przepięciu wszystkich blokujących leadów na innego audytora ta sama akcja usunięcia kończy się powodzeniem.
- [ ] **AC1.3** Usunięcie audytora nigdy nie odpina leadów po cichu — po odrzuconej próbie liczba leadów przypisanych do tego audytora jest niezmieniona.
- [ ] **AC1.4** Akcja usunięcia wywołana przez konto z rolą inną niż `admin` jest odrzucona po stronie serwera, nawet gdy żądanie ominie UI.
- [ ] **AC1.5** (przy D1 = obie ścieżki) Zablokowane konto audytora nie przechodzi bramki autoryzacyjnej — próba dostępu kończy się odmową, mimo poprawnych danych logowania.
- [ ] **AC1.6** (przy D1 = obie ścieżki) Zablokowany audytor znika z listy wyboru przy przypisywaniu audytora do leada, a próba wymuszenia przypisania po stronie serwera jest odrzucona.
- [ ] **AC1.7** Blokada jest odwracalna: odblokowane konto wraca do puli wyboru i przechodzi autoryzację.

### `CRM-ZESP-AC2` — zespół bez ważnego certyfikatu poza pulą E4

- [ ] **AC2.1** Zespół, którego certyfikat wygasł względem daty odniesienia (wg D6), **nie pojawia się** na liście brygad w kroku przypisania ekipy (E4).
- [ ] **AC2.2** Żądanie przypisania takiego zespołu wysłane bezpośrednio do Server Action (z pominięciem UI) jest odrzucone z komunikatem wskazującym, który certyfikat jest nieważny, a status leada pozostaje `AWAITING_CREW_ASSIGNMENT`.
- [ ] **AC2.3** Zespół z certyfikatem ważnym jeszcze jeden dzień przechodzi; ten sam zespół dzień po wygaśnięciu — nie. (Test na granicy, nie „gdzieś w okolicy".)
- [ ] **AC2.4** Nieaktywny zespół (`aktywny = false`) nadal jest ukryty — nowy warunek certyfikatów **dokłada się** do istniejącego filtra, nie zastępuje go.
- [ ] **AC2.5** Ukrycie zespołu z nieważnym certyfikatem nie usuwa i nie modyfikuje jego istniejących przypisań — zmienia się wyłącznie pula do nowych przypisań.
- [ ] **AC2.6** Próg ostrzegawczy i logika ważności nie zawierają literałów dat/dni w kodzie — pochodzą z `@klikklima/contracts`.

### `CRM-ZIMNE-AC2` — „Zwróć do obiegu"

- [ ] **AC3.1** Lead z ceną/bucketem świeższym niż `SLA.COLD_LEAD_REPRICE_DAYS` (30) wraca do obiegu i ląduje w stanie zgodnym z T15.
- [ ] **AC3.2** Lead przekraczający próg **nie zmienia statusu** przy próbie powrotu bez spełnienia warunku z D2 — po odrzuceniu jego status to nadal `QUOTE_REJECTED`.
- [ ] **AC3.3** Ta sama próba wysłana bezpośrednio do Server Action z pominięciem UI jest odrzucona identycznie (guard żyje na serwerze, nie w dialogu).
- [ ] **AC3.4** Test pokrywa obie ścieżki granicznie: dokładnie 30 dni i 31 dni dają przeciwne wyniki.
- [ ] **AC3.5** Dwukrotne kliknięcie „Zwróć do obiegu" na tym samym leadzie nie tworzy drugiego przejścia ani drugiego wpisu w historii — druga próba jest odrzucona, bo lead nie jest już w `QUOTE_REJECTED`.
- [ ] **AC3.6** Wyliczenie progu jest odporne na strefę czasową: lead, który przekroczył próg o godzinę, jest odrzucany niezależnie od tego, czy serwer liczy w UTC czy w `Europe/Warsaw`.
- [ ] **AC3.7** Zmiana statusu i skutki uboczne (odświeżenie ważności wyceny) dzieją się w jednej transakcji — przerwanie w połowie nie zostawia leada w obiegu ze starą ceną.

### `CRM-ZIMNE-AC3` — trwała archiwizacja z powodem utraty

- [ ] **AC4.1** Archiwizacja bez wybranego powodu jest odrzucona — lead pozostaje w `QUOTE_REJECTED`.
- [ ] **AC4.2** Powód spoza słownika (dowolny tekst, literówka, wartość wymyślona przez klienta HTTP) jest odrzucony po stronie serwera.
- [ ] **AC4.3** Archiwizacja z poprawnym powodem ustawia status `ARCHIVED_LOST` i zapisuje powód w formie nadającej się do agregacji (grupowanie po powodzie zwraca sensowne liczby).
- [ ] **AC4.4** `ARCHIVED_LOST` jest terminalny: żadna akcja w UI ani żadne przejście w maszynie stanów nie wyprowadza z niego leada.
- [ ] **AC4.5** Zarchiwizowany lead znika z domyślnego widoku zimnych leadów i nie jest liczony do statystyk bucketu.
- [ ] **AC4.6** Archiwizacja to **nie** usunięcie rekordu — dane klienta i historia pozostają w bazie i są widoczne na Karcie 360.
- [ ] **AC4.7** Zapisanie statusu i powodu odbywa się w jednej transakcji; nie istnieje stan `ARCHIVED_LOST` bez powodu.
- [ ] **AC4.8** (przy D4 = (a)) Leady odrzucone automatycznie po 14 dniach nie pojawiają się w statystyce powodów utraty.

---

## Decyzje człowieka — ROZSTRZYGNIĘTE (2026-08-20)

- **D1**: obie ścieżki (blokada logowania + twardy blocker na DELETE). „Wisząca" = lead w `AWAITING_AUDIT`/`AUDIT_COMPLETED`. Zimne/zarchiwizowane leady NIE blokują usunięcia — `onDelete: SetNull` zostaje dla nich, `Restrict` (Z6) dotyczy tylko aktywnych statusów (realizacja: guard w Server Action przed DELETE, nie sam constraint bazy, bo baza nie rozróżnia statusu).
- **D2**: **ODSTĘPSTWO od pierwotnego tekstu rejestru wymagań.** Zwykły dialog potwierdzenia „Cena może być nieaktualna, kontynuować?" z jednym kliknięciem, ALE z dodatkową opcją „zaktualizuj cenę" w tym samym dialogu, która pozwala przejść przez ponowną wycenę i dalej przypisać audytora bez wychodzenia z przepływu. To miększe niż `CRM-ZIMNE-AC2.acceptance` w `contracts/requirements.contract.mjs` („guard blokuje… odrzucona") — **`contract-steward` ma zaktualizować to `acceptance`, żeby rejestr nie kłamał o zachowaniu.** Guard `quoteRefreshedIfStale` zostaje, ale jako brama do jednej z dwóch legalnych ścieżek (potwierdź-ze-starą-ceną / zaktualizuj-cenę), nie jako twardy blocker bez wyjścia.
- **D3**: liczymy od daty wystawienia wyceny → **wymaga Z3** (`quoted_at` na `leady`).
- **D4**: rozdzielamy pola — `lost_reason` wyłącznie ze słownika `LOST_REASONS`; automat 14-dniowy dostaje osobną kolumnę (nazwa robocza `auto_rejected_reason`, do potwierdzenia przez `contract-steward` przy migracji, zgodnie z ADR-002).
- **D5**: `LOST_REASONS` zatwierdzone bez zmian merytorycznych (6 wartości). `OTHER` wymaga obowiązkowej notatki tekstowej — nowe pole (np. `lost_reason_note`).
- **D6**: `NULL` w dacie ważności certyfikatu = nieważny (bezpieczny wariant). Guard sprawdza względem **daty montażu**, nie dzisiejszej daty. Sprawdzamy certyfikaty na poziomie **zespołu** (`zespoly_monterskie`), nie przedstawiciela — `CRM-ZESP-REP` zostaje poza zakresem, zgodnie z pierwotnym planem.
- **D7**: potwierdzone zgodnie z kontraktem. „Reaktywuj" zamienia się na przejście T15 (`QUOTE_REJECTED → AUDIT_COMPLETED`) — lead zachowuje audytora i dane audytu, `implementer-server` usuwa starą ścieżkę do `NEW_LEAD` z lokalnej `ALLOWED_TRANSITIONS`.
- **R2**: budujemy odczyt roli w `middleware.ts` w RAMACH tego WO — twardy warunek wstępny dla AC1.4/AC2.2 i pozostałych „odrzucone dla roli nie-admin", nie osobny WO.
- **`allowInWriteHook` — zakres REPO-WIDE, nie tylko `supabase/migrations/`.** Decyzja człowieka 2026-08-20, podjęta świadomie przez `AskUserQuestion` po tym, jak `contract-steward` trzykrotnie utknął na tej samej blokadzie (migracja, potem test-author na plikach testowych). Reguły `adr002-pl-tables`/`adr002-pl-columns` w hooku zapisu (`guard-forbidden.mjs`) są wyłączone dla CAŁEGO repo, nie tylko dla katalogu migracji — bo tabele `apps/b2b-web` naprawdę są nazwane po polsku i blokowanie każdego zapisu do tego kodu nie dawało żadnego sygnału. Jedyną faktyczną bramką ADR-002 jest teraz `node tools/kk-naming.mjs --check-baseline` (empirycznie zweryfikowane dwukrotnie, że `allowInWriteHook` NIE przecieka do skanu ani do `--check-baseline`). To nie jest błąd konfiguracji — to zamierzony efekt jawnej decyzji.
- **R3** (nierozstrzygnięte formalnie, przyjęta rekomendacja `spec-analyst`): `audit_log` zostaje **osobnym, przyszłym WO** — ten WO NIE blokuje się na jego budowie, ale nic z tych destrukcyjnych/archiwizujących akcji nie idzie na produkcję bez niego. Odnotowane jako twardy warunek przed release, nie przed GREEN.

### Dodatkowa decyzja (2026-08-20, po pierwszym przebiegu contract-steward)

- **`quoted_at IS NULL`** (wszystkie istniejące rekordy sprzed tej kolumny): traktowane jako **przeterminowane** (fail-closed) — lead bez znanej daty wyceny musi przejść przez jedną z dwóch ścieżek D2 (potwierdź / zaktualizuj cenę), tak samo jak lead z realnie starą wyceną. Spójne z fail-closed już stosowanym w projekcie (`roomCount`, `buildingType`).
- **`guard-forbidden` blokował migrację** dotykającą istniejących tabel z zamrożonego długu (`audytorzy`, `leady`) mimo że zmiana jest wyłącznie addytywna i nowe kolumny mają poprawne nazwy. **Pierwsza propozycja naprawy (zwykły `allowIn: ['supabase/migrations/']` na regułach `adr002-*`) była błędna — `contract-steward` to zweryfikował empirycznie i zatrzymał się, zamiast wdrożyć: `allowIn` jest polem współdzielonym przez `guard-forbidden.mjs`, `tools/kk-naming.mjs` (a więc i `--check-baseline`) oraz `tools/guard-core.mjs`. Ta sama zmiana, która miała złagodzić tylko hook zapisu, po cichu wyłączyłaby też bramkę commitową dla całego katalogu migracji — nowy dług przestałby być wykrywalny, nie tylko stary.** Poprawny kierunek: osobne pole (np. `allowInWriteHook`) czytane WYŁĄCZNIE przez `guard-forbidden.mjs`, bez dotykania `kk-naming.mjs`. Zobacz dalszy przebieg WO dla ostatecznego rozstrzygnięcia.

### Zaktualizowany zakres zmiany kontraktu/schematu (Z1–Z7)

| # | Zmiana | Powód |
|---|---|---|
| Z1 | `enum LeadStatus`: dodać `ARCHIVED_LOST` | bezwarunkowe |
| Z2 | `audytorzy`: kolumna blokady (`is_active BOOLEAN NOT NULL DEFAULT true`) | D1 |
| Z3 | `leady`: `quoted_at TIMESTAMPTZ` | D3 |
| Z4 | `leady`: nowa kolumna na znacznik automatu (np. `auto_rejected_reason`), `lost_reason` zostaje wyłącznie słownikiem | D4 |
| Z5 | `leady`: `lost_reason_note TEXT?` dla `OTHER` | D5 |
| Z6 | `leady.audytor_id`: logika `Restrict` w Server Action dla leadów aktywnych (nie zmiana samego `onDelete` w Prismie, żeby nie zablokować SetNull dla zimnych/zarchiwizowanych) | D1 |
| Z7 | `contracts/requirements.contract.mjs`: `CRM-ZIMNE-AC2.acceptance` — zmienić opis z „blokuje/odrzucona" na dwuścieżkowy (potwierdź-ze-starą-ceną / zaktualizuj-cenę) | D2 |

Kolumny nowe: angielskie, snake_case (ADR-002). `audit_log` (R3) świadomie odłożone do osobnego WO.

---

## Przypadki brzegowe, które MUSZĄ mieć test

1. **Współbieżność, usunięcie audytora:** przepięcie ostatniego leada i usunięcie audytora zlecone równolegle — nie może skończyć się usunięciem audytora z leadem przypisanym w międzyczasie. Sprawdzenie w JS przed `delete` nie wystarcza.
2. **Współbieżność, przypisanie ekipy:** certyfikat wygasa między wyświetleniem listy a kliknięciem „Przypisz". Serwer musi odrzucić, mimo że UI pokazywało zespół jako dostępny.
3. **Idempotencja:** podwójny klik / podwójne żądanie na „Zwróć do obiegu" i „Archiwizuj" — jeden skutek, nie dwa.
4. **Uprawnienia, trzy warstwy osobno:** ukrycie w UI, odrzucenie w Server Action, odrzucenie w RLS. Test na każdą warstwę z osobna (`CRM-DELETE-ADMIN-ONLY` wymaga tego wprost).
5. **Granice czasowe:** dokładnie 30 dni, 30 dni minus godzina, 30 dni plus godzina. Data ważności certyfikatu = dzisiaj (czy dziś jest jeszcze ważny?).
6. **Strefa czasowa:** `fgaz_valid_until` to `@db.Date` (bez czasu), `bucket_entered_at` to `@db.Timestamptz`. Porównanie tych dwóch typów w `Europe/Warsaw` przy zmianie czasu letniego/zimowego to klasyczne miejsce na błąd o jeden dzień.
7. **NULL-e:** audytor bez leadów, zespół bez uzupełnionych dat certyfikatów, lead bez `bucket_entered_at` (wszedł do bucketu przed wprowadzeniem kolumny), lead bez wyceny.
8. **Transakcyjność:** przerwanie zapisu w połowie nie zostawia statusu bez powodu utraty ani powodu bez statusu.

---

## Podział pracy na role

| Rola | Pliki | Zakres |
|---|---|---|
| `contract-steward` (najpierw, w oknie kontraktowym) | `packages/database/prisma/schema.prisma`, `supabase/migrations/`, ewentualnie `contracts/funnel.contract.mjs` | Z1–Z6 wg decyzji D1–D6, potem `node tools/kk-codegen.mjs` |
| `test-author` | `apps/b2b-web/tests/` (wzorzec: `apps/b2b-web/tests/clients.spec.ts`), testy jednostkowe wg `vitest.config.mts` (`**/*.test.ts`) | Wszystkie AC powyżej. Testy guardów kontraktowych osobno od testów Server Actions. Każdy test oznaczony ID wymagania, żeby `kk-trace` je zobaczył |
| `implementer-server` | `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts`, `apps/b2b-web/src/app/(dashboard)/leads/actions.ts`, `apps/b2b-web/src/app/(dashboard)/crews/actions.ts`, `apps/b2b-web/src/utils/supabase/middleware.ts` | Sprawdzenie roli w każdej akcji destrukcyjnej; blocker na usunięcie audytora ze zwróconą listą blokad; filtr certyfikatów w `getCrews()` + walidacja serwerowa przy przypisaniu; akcje `returnToFunnel` i `archiveLost` oparte na T15/T16 z `@klikklima/contracts`; zamiana lokalnej `ALLOWED_TRANSITIONS` na źródło kontraktowe (po D7) |
| `implementer-ui` | `apps/b2b-web/src/app/(dashboard)/auditors/auditors-client.tsx`, `.../auditors/components/AuditorsTable.tsx`, `apps/b2b-web/src/app/(dashboard)/leads/leads-client.tsx` | Dialog potwierdzenia „Zwróć do obiegu" z informacją o wieku ceny; dialog archiwizacji z wyborem powodu ze słownika (bez wolnego tekstu); komunikat blokady usunięcia audytora z listą leadów; ukrycie akcji destrukcyjnych dla ról nie-admin. Ikony wyłącznie `lucide-react`, zero literałów hex, zero zielonych alertów SLA |
| `notification-architect` | — | Poza zakresem tego WO (I6 należy do `CRM-ZESP-AC1` / `CRM-AUDYT-AC3`) |

**Kolejność:** decyzje człowieka (D1–D7) → okno kontraktowe i schemat → testy → implementacja serwerowa → UI. Bez Z1 nie ma sensu pisać testów `ARCHIVED_LOST`.

---

## Poza zakresem

- `CRM-ZESP-AC3` — kalendarz zespołów, `absences`, `bookings`, dostępność ekip. Osobny silnik, świadomie odłożony.
- `CRM-AUDYT-AC2` — dzienny cap audytów i współbieżność przy przypisywaniu.
- `CRM-AUDYT-AC3`, `CRM-ZESP-AC1` — alerty I6 o wygasających certyfikatach (ten WO **czyta** daty ważności, nie powiadamia o nich).
- `CRM-ZESP-REP` — `representative_user_id` i certyfikaty przedstawiciela.
- `CRM-REGION-AUTO` — auto-przypisywanie po kodzie pocztowym.
- Migracja nazw `leady` / `audytorzy` / `zespoly_monterskie` na ADR-002 — dług zamrożony (`KK-NAMING-BASELINE`).
- Budowa tabeli `audit_log` i modułu analitycznego. Ten WO ma **zapisać powód utraty w formie nadającej się do agregacji**; budowa raportów to osobne zadanie.
- Sama aplikacja Field App.

---

## Ryzyka i nieznane

- **R1 — „nie loguje się do Field App" jest dziś nieweryfikowalne.** W repo nie ma `apps/field-app`. Kryterium z rejestru można w tej iteracji spełnić najwyżej na poziomie serwerowej bramki autoryzacyjnej. Do potwierdzenia z człowiekiem, czy to wystarcza do oznaczenia `CRM-AUDYT-AC1` jako DONE.
- **R2 — bramka autoryzacyjna nie czyta roli.** `middleware.ts` sprawdza wyłącznie obecność e-maila w `AuthorizedUser`. Każde AC mówiące „odrzucone dla roli nie-admin" wymaga najpierw źródła prawdy o roli w żądaniu. To zależność, której ten WO nie tworzy — jeśli jej nie ma, `CRM-DELETE-ADMIN-ONLY` staje się blokerem, nie sąsiadem.
- **R3 — brak `audit_log`.** `AUDIT_REQUIREMENTS.mustLog` wymaga logowania `delete` i `manual_status_change`, a tabeli nie ma. Archiwizacja i usunięcie audytora to dokładnie te zdarzenia. Do rozstrzygnięcia, czy `audit_log` wchodzi tutaj, czy jest osobnym WO — moja rekomendacja: osobny, ale **przed** wypuszczeniem tych akcji na produkcję.
- **R4 — brak tabeli `quotes`.** Kontrakt mówi o `quotes` (`DELETE_POLICIES.leads.cascades`, `quotes.installation_type` w `FNL-2PHASE`), schemat ma tylko `leady.finalna_wycena_pln` i enum `QuoteStatus` bez modelu. Wariant D3 = „wiek ceny" opiera się na strukturze, której nie ma.
- **R5 — istniejące dane.** Nie wiadomo, ile leadów ma dziś `lost_reason = "AUTO_REJECT_14_DAYS"` ani ile ma `bucket_entered_at = NULL`. Migracja przy D4 = (a) wymaga backfillu; bez znajomości wolumenu nie oszacuję ryzyka.
- **R7 (REVIEW #3, 2026-08-20) — stan RLS na `audytorzy` — ROZSTRZYGNIĘTE.** Człowiek potwierdził: RLS jest WYŁĄCZONE na tabeli `audytorzy`. Zapytanie w `middleware.ts` działa więc dokładnie tak, jak napisano — AC1.5 (blokada logowania) realnie egzekwowane, fail-closed na `error` jest wystarczający. `CRM-AUDYT-AC1` może przejść na `status: 'DONE'`.
- **R8 (REVIEW #3, decyzja człowieka 2026-08-20) — `advanceLeadStatus`/`updateLeadStatus` (`leads/actions.ts`) i `updateLeadAuditor` (`leads/[id]/actions.ts`) nadal bez sprawdzenia roli.** Pre-existing, nie regresja tego WO, ale po tej zmianie widoczna asymetria wobec sąsiednich, już zagatowanych akcji. **Decyzja: osobny, przyszły WO, kandydat razem z `audit_log` (R3).** Nie blokuje commita tego WO.
- **R6 — `ALLOWED_TRANSITIONS` żyje w kodzie równolegle do kontraktu.** Dopóki istnieją dwie maszyny stanów, każda poprawka w kontrakcie ma szansę nie dotrzeć do UI. Ten WO dotyka dwóch przejść z dziesięciu — reszta rozjazdu zostaje.
