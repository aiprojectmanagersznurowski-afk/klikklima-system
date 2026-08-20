# WO: FLD-CONTRACT-BASE — fundament kontraktowy Field App (rejestr wymagań, progi geofencingu, kształt pomiaru odległości)

**Cel:** dać fazie 0 stały grunt. Po tym WO każdy próg przestrzenny Field App ma nazwę w kontrakcie,
każde wymaganie `FLD-*` ma ID, na które można otagować test, a bramka kontraktowa potrafi zablokować
próg bez kształtu pomiaru — również po tym, jak listę kształtów rozszerzyliśmy.

**Rola wiodąca:** `contract-steward`. **Okno kontraktowe: WYMAGANE** (`contracts/`, `tools/`).
**Zakres zapisu:** `contracts/requirements.contract.mjs`, `contracts/sla.contract.mjs`,
`tools/kk-validate.mjs`, `tools/kk-codegen.mjs`, `tools/kk-selftest.mjs`,
`packages/contracts/src/generated/**` i `docs/architecture/generated/**` (wyłącznie przez `kk-codegen`).

## Wymagania

| ID | Stan w rejestrze | Co robi ten WO |
|---|---|---|
| `CRM-AUDYT-AC1` | `DONE`, HIGH, 8 testów | zwęża kryteria do tego, co realnie działa (panel B2B) |
| `FLD-GEO-COORDS` | **nowe** | anchor dla WO-D i dla migracji z `75da8c5` |
| `FLD-GEO-UNLOCK` | **nowe** | anchor dla progu 20 m |
| `FLD-GEO-EN-ROUTE` | **nowe** | anchor dla progu 3 km i dla `N3`/`N7`/`N13`/`N17` |
| `FLD-GPS-RODO` | **nowe** | model zbierania GPS z D4 |
| `FLD-AUTH-BLOCKED` | **nowe** | to, co wyjmujemy z `CRM-AUDYT-AC1` |
| `FLD-PHOTO-SET` | **nowe** | cztery zdjęcia z rozdziału 8 — bez własnego pliku kontraktu |
| `FLD-CONSENT-ACCEPT` | **nowe** | akceptacja zgód przed zleceniem (D4) |
| `FLD-LEGAL-DOC-VERSION` | **nowe** | wersjonowanie treści przez administratora (D4) |

Proponowana domena dla wszystkich nowych: `field` (nowa grupa w `kk-trace`; walidator nie ogranicza
listy domen wymagań, więc to nie jest zmiana reguły).

Proponowane statusy: `FLD-GEO-COORDS` = `TODO` (WO-D realizuje je od razu). Pozostałe = `BLOCKED`.
Uzasadnienie `BLOCKED`, nie `TODO`: `apps/field-app` nie istnieje (faza 3), a `kk-trace` wyłącza
`BLOCKED` z ostrzeżenia „HIGH RISK bez żadnego testu" — inaczej dorzucamy siedem stałych alarmów do
raportu, który dziś ma ich 25 i jest przez to coraz mniej czytany.

## Kontekst kodu (zweryfikowany 2026-08-20/21)

### Istnieje

| Miejsce | Stan faktyczny |
|---|---|
| `contracts/sla.contract.mjs` | 8 polityk, wyłącznie czasowe i ilościowe (`bands`, `days`, `count`, `hourOfDay`). **Ani jednej stałej przestrzennej.** |
| `tools/kk-validate.mjs:225` | `const MEASURES = ['bands', 'days', 'count', 'hourOfDay'];` — R21 żąda dokładnie jednego zadeklarowanego kształtu, niepustego `scope` i niepustego `req` |
| `tools/kk-validate.mjs:151-159` | R12 — każde `req: [...]` w `TRANSITIONS`, `SLA_POLICIES`, `DISQUALIFICATION_RULES` musi wskazywać istniejące ID wymagania |
| `tools/kk-codegen.mjs:151` | `const scalar = ['days', 'count', 'hourOfDay'].find((k) => p[k] !== undefined);` — gdy nic nie pasuje, emituje `{ scope, metric, bands }`, a `JSON.stringify` wycina `undefined`. Efekt: **próg trafia do wygenerowanego pliku jako sam opis, bez liczby i bez błędu** |
| `tools/kk-selftest.mjs` | 38 mutacji, w tym `R21-sla-shape` (polski priorytet w `appliesToPriorities`) — żadna nie dowodzi dziś, że R21 łapie próg **bez** kształtu pomiaru |
| `contracts/notifications.contract.mjs` | `N3`, `N7`, `N13`, `N17` — wszystkie `STABLE`, `bind.kind: 'GEO'`, kanał `SMS`, odbiorca `CLIENT`. **Żaden wpis powiadomienia nie ma pola `req`** — walidator nie widzi związku z wymaganiem, więc związek musi być nazwany w kryteriach akceptacji |
| `contracts/requirements.contract.mjs:43` | `CRM-AUDYT-AC1`, `DONE`, dwa kryteria; pierwsze: „Zablokowane konto nie loguje się do Field App" |
| `apps/b2b-web/tests/middleware-auditor-blocked.test.ts`, `auditors-toggle-active.test.ts`, `auditors-delete.test.ts` | 8 testów otagowanych `@REQ: CRM-AUDYT-AC1`. Sprawdzają bramkę **panelu B2B** (`updateSession`), zawężenie sprawdzenia do roli `audytor`, fail-closed przy błędzie zapytania, odwracalność blokady i blocker usunięcia z wiszącymi leadami |
| `packages/database/prisma/schema.prisma:53-69` | `adresy.latitude` / `adresy.longitude` (`Float? @db.DoublePrecision`) — commit `75da8c5`, migracja `20260820130000`, **nieuruchomiona na żadnej bazie** |

### Brakuje

1. Kształtu pomiaru odległości w `MEASURES` — bez niego R21 odrzuca każdy próg geofencingu.
2. Tego samego kształtu na liście skalarów w `kk-codegen.mjs` — bez niego kontrakt jest zielony,
   a wygenerowany `sla.ts` nie zawiera liczby.
3. Jakiegokolwiek wymagania `FLD-*` — bez nich R12 odrzuca `req: ['FLD-…']` przy progu.
4. Mutacji w `kk-selftest.mjs` dowodzącej, że R21 nadal łapie próg bez kształtu.

### Wymuszona kolejność wewnątrz WO (zweryfikowana empirycznie przez `contract-steward`)

1. wymagania `FLD-*` → 2. `MEASURES` w `kk-validate.mjs` **i** lista skalarów w `kk-codegen.mjs` (razem)
→ 3. progi w `sla.contract.mjs` → 4. mutacja w `kk-selftest.mjs` → 5. `kk-codegen`.
Kroki 2 i 3 **nie mają legalnego stanu pośredniego** — muszą wejść jednym zapisem.

## Zmiana kontraktu

**WYMAGANA.** Bez niej nie da się zrobić niczego innego w fazie 0: każdy próg geofencingu byłby
literałem w kodzie (dokładnie ten błąd, który `SLA-QUOTE-14D` już raz rozwiązał dla 14 dni), a testy
Field App nie miałyby ID do otagowania, więc `kk-trace` nie widziałby ich nigdy.

Proponowana treść progów (nazwy bez sufiksu jednostki — jednostkę niesie klucz kształtu):

```js
{ id: 'GEOFENCE_UNLOCK_RADIUS',   scope: 'Promień od punktu docelowego, w którym Field App odblokowuje rozpoczęcie i zakończenie zlecenia', meters: 20,   req: ['FLD-GEO-UNLOCK'] },
{ id: 'GEOFENCE_EN_ROUTE_RADIUS', scope: 'Promień, którego przecięcie w dniu wizyty wyzwala klientowi SMS „w drodze" (N3/N7/N13/N17)',      meters: 3000, req: ['FLD-GEO-EN-ROUTE'] },
```

`field_app_requirements.md#6.5` rekomenduje nazwy `GEOFENCE_UNLOCK_RADIUS_M` i
`GEOFENCE_EN_ROUTE_RADIUS_KM` — świadomie odchodzę od sufiksów: przy dwóch różnych sufiksach ta sama
wielkość fizyczna ma dwie jednostki w jednym kontrakcie, a to jest zalążek przeliczania w kodzie.

**Zwężenie `CRM-AUDYT-AC1`** (decyzja człowieka, 2026-08-20) — proponowana treść kryteriów:

1. Zablokowane konto audytora nie przechodzi bramki autoryzacyjnej **panelu B2B** — odmowa mimo poprawnych danych logowania.
2. Sprawdzenie blokady dotyczy wyłącznie kont o roli `audytor`; konto administratora lub dyspozytora o e-mailu pasującym do zablokowanego rekordu audytora przechodzi bramkę.
3. Błąd zapytania o blokadę kończy się odmową dostępu (fail-closed), nie cichym przepuszczeniem.
4. Zablokowane konto nie występuje w puli wyboru przy przypisywaniu audytora do leada.
5. Usunięcie audytora z wiszącymi leadami jest odrzucone z listą blokujących rekordów.
6. Blokada jest odwracalna: odblokowanie przywraca dostęp i obecność w puli.
7. Bramka logowania do aplikacji terenowej **nie należy do tego wymagania** — realizuje ją `FLD-AUTH-BLOCKED`.

Wszystkie siedem opisuje zachowanie, dla którego istnieje dziś przechodzący test. Żaden istniejący
test nie traci ważności — zmiana **usuwa** kryterium bez pokrycia, nie dodaje nowych.

## Kryteria akceptacji

- [ ] **AC1** `node tools/kk-validate.mjs` kończy się zielono po zmianie; `node tools/kk-selftest.mjs` przechodzi wszystkie mutacje, łącznie z nową.
- [ ] **AC2** Usunięcie kształtu pomiaru z progu `GEOFENCE_UNLOCK_RADIUS` (tzn. wpis z samym `scope` i `req`) powoduje **błąd `R21-sla-shape`**. Dowodzi tego mutacja w `kk-selftest.mjs`, nie ręczne sprawdzenie — po rozszerzeniu listy `MEASURES` reguła, która jej pilnowała, musi zostać udowodniona ponownie.
- [ ] **AC3** Zadeklarowanie dwóch kształtów jednocześnie (np. `meters` **i** `days`) w tym samym progu jest odrzucane przez `R21-sla-shape` — próg mierzy dokładnie jedną rzecz.
- [ ] **AC4** Próg odwołujący się do nieistniejącego wymagania (`req: ['FLD-NIE-ISTNIEJE']`) jest odrzucany przez `R12-req-refs`.
- [ ] **AC5** Wygenerowany `packages/contracts/src/generated/sla.ts` zawiera **liczbę** dla obu progów (`20` i `3000`), a nie sam opis. Test regresji: usunięcie kształtu odległości z listy skalarów w `kk-codegen.mjs` przy pozostawieniu go w `kk-validate.mjs` powoduje, że `node tools/kk-codegen.mjs --check` **wykrywa dryf** — dziś ta sama sytuacja przechodzi bez śladu.
- [ ] **AC6** `node tools/kk-codegen.mjs --check` jest zielony na zacommitowanym stanie (brak dryfu), a `docs/architecture/generated/CONTRACTS.md` wymienia oba nowe progi.
- [ ] **AC7** `node tools/kk-trace.mjs` po zmianie: nowe wymagania są widoczne w domenie `field`, sekcja „HIGH RISK bez żadnego testu" **nie rośnie** o wymagania oznaczone `BLOCKED`, a lista `violations` (status `DONE`/`IMPLEMENTING` bez testu) pozostaje pusta.
- [ ] **AC8** Osiem istniejących testów otagowanych `@REQ: CRM-AUDYT-AC1` przechodzi bez zmian w plikach testowych. Jeżeli którykolwiek wymagałby edycji, to znaczy, że zwężenie poszło za daleko — zgłoś `TEST-DEFECT`, nie poprawiaj testu.
- [ ] **AC9** Kryteria `FLD-GEO-EN-ROUTE` wymieniają **wszystkie cztery** identyfikatory: `N3`, `N7`, `N13`, `N17`. Powiadomienia nie mają pola `req`, więc walidator tego związku nie sprawdzi — jedynym miejscem, w którym zostaje zapisany, jest treść wymagania.
- [ ] **AC10** Po zmianie w całym repozytorium (poza `docs/`) nie istnieje literał `3000`, `3 km` ani `20 m` opisujący promień geofencingu — jedynym źródłem jest kontrakt. Weryfikacja: `grep`, nie deklaracja.
- [ ] **AC11** `CRM-AUDYT-AC1` po zmianie nie zawiera żadnego kryterium odwołującego się do Field App, a `FLD-AUTH-BLOCKED` zawiera dokładnie to, co zostało wyjęte, plus warunki, których panel B2B nauczył się po incydencie z 2026-08-20 (zawężenie do roli, fail-closed).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Reguła, która przestaje być bramką.** AC2 i AC3 to jedyna ochrona przed sytuacją, w której
  rozszerzenie `MEASURES` cicho osłabia R21. Bez mutacji w `kk-selftest.mjs` nikt się nie dowie.
- **Cicha strata wartości w codegen.** AC5. Dziś nieznane pole progu nie powoduje błędu na żadnym
  etapie — kontrakt zielony, dokumentacja zielona, wygenerowany plik bez liczby.
- **Wymaganie `BLOCKED` a raport pokrycia.** AC7. `kk-trace` traktuje `BLOCKED` inaczej niż `TODO`
  wyłącznie w ostrzeżeniu HIGH-risk; w `violations` decyduje status `DONE`/`IMPLEMENTING`. Zły status
  przy nowym wymaganiu albo zaszumia raport, albo (przy `DONE`) natychmiast go łamie.
- **Zwężenie wymagania `DONE` bez utraty pokrycia.** AC8. `CRM-AUDYT-AC1` ma dziś 8 testów; zwężenie,
  po którym któryś z nich przestaje odpowiadać jakiemukolwiek kryterium, jest błędem zwężenia.

## Poza zakresem

- Jakakolwiek zmiana w `packages/database/prisma/schema.prisma` i `supabase/migrations/` — WO-B i WO-C.
- `contracts/fieldapp.contract.mjs` — patrz uzasadnienie w `FLD-FOUNDATION.md`.
- Rozszerzenie `N1` o zdjęcie pracownika, rozstrzygnięcie kanału `I3` (SMS vs PUSH), warianty `N4` —
  to `notification-architect`, faza 2.
- Wymagania dla statusu dostępności (`FLD-AVAIL-*`) — WO-B, bo ich treść zależy od decyzji D-A.
- Uruchomienie migracji `20260820130000` na jakiejkolwiek bazie.
- Poprawienie `docs/architecture/b2b_funnel_process.md:187` („promień np. 5 km" wobec 3 km w
  specyfikacji i D4). Przeniesienie progu do kontraktu **likwiduje tę rozbieżność u źródła** — od tej
  chwili istnieje jedna liczba i jedno miejsce. Sama poprawka w dokumencie opisowym należy do
  `doc-scribe` i nie blokuje niczego tutaj.

## Decyzje wymagające człowieka

### D-B — jedna jednostka odległości czy dwie (rekomendacja, nie blokada)

`MEASURES` można rozszerzyć o **jeden** klucz `meters` (20 i 3000) albo o dwa: `meters` i `kilometers`
(20 i 3). Rekomenduję jeden. Dwa klucze oznaczają, że kod porównujący dwie polityki musi wiedzieć,
w czym jest która, i przeliczyć — czyli dokładnie ten rodzaj przeliczania, przed którym `ADR-011`
i reguła `magic-sla-days` mają chronić. Koszt rekomendacji: `3000` czyta się gorzej niż `3 km`;
kompensuje to `scope`, który mówi to słowami.

Jeżeli człowiek wybierze dwa klucze, AC3 (dwa kształty w jednym progu = błąd) obowiązuje bez zmian.

## Ryzyka i nieznane

- **R1 — `MEASURES` jest listą płaską, bez walidacji wartości.** Po rozszerzeniu nic nie sprawdza, czy
  `meters: -20` albo `meters: 0` ma sens. R14 kontroluje monotoniczność wyłącznie dla `bands`. Progi
  przestrzenne wchodzą bez żadnej kontroli zakresu. Nie rozszerzam zakresu tego WO o nową regułę
  walidatora, ale odnotowuję: to jest luka, którą warto zamknąć, zanim progów przestrzennych będzie więcej.
- **R2 — powiadomienia nie mają pola `req`.** Związek `GEOFENCE_EN_ROUTE_RADIUS` ↔ `N3`/`N7`/`N13`/`N17`
  jest dziś wyłącznie tekstem w kryteriach akceptacji (AC9). Zmiana `bind.kind: 'GEO'` w którymkolwiek
  z tych czterech wpisów nie zapali żadnej lampki przy progu. Dodanie `req` do katalogu powiadomień to
  zmiana kształtu kontraktu i osobna decyzja — nie wchodzi w ten WO.
- **R3 — status `BLOCKED` nie ma w tym repozytorium ustalonej semantyki.** Walidator akceptuje go
  w R11, `kk-trace` wyłącza go z jednego ostrzeżenia — i to wszystko. Rozumiem go tu jako „wymaganie
  poprawne, ale niewykonalne przed powstaniem `apps/field-app` (faza 3) albo przed decyzją". Jeśli
  człowiek rozumie `BLOCKED` inaczej (np. wyłącznie „czeka na ADR"), statusy siedmiu wymagań trzeba
  zmienić na `TODO` i przyjąć wzrost szumu w raporcie pokrycia.
- **R4 — `FLD-PHOTO-SET` wchodzi z nierozstrzygniętym pytaniem 7** (`field_app_requirements.md#12`):
  czy komplet czterech zdjęć obowiązuje przy `T17` (etap I), czy tylko przy `T09`. Wymaganie da się
  zapisać bez tej odpowiedzi (cztery zdjęcia jako warunek zamknięcia montażu), ale jego kryteria
  będą musiały zostać uzupełnione, gdy pytanie zostanie rozstrzygnięte. Alternatywa — nie rejestrować
  go teraz — kosztuje drugie okno kontraktowe w fazie 1.
