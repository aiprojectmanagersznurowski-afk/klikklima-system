# WO: PRICE-LIST-VAT — strumień B2 „cennik robocizny i VAT" (indeks, nie zadanie)

**Ten plik nie jest Work Orderem do wykonania.** To indeks sześciu Work Orderów gałęzi
`feat/price-list-vat` (B2 w `PLAN-ROWNOLEGLY-BRANCHE.md`, strumień P4, moduł M9 w
`FIELD-APP-I-PODPISY-ZAKRES.md`). Stan sprawdzony 2026-09-25 na `1c6bf0d`.

Zakres zlecenia: 11 wymagań, **59 kryteriów akceptacji**, cztery z ryzykiem HIGH
(`FLD-QUOTE-CALC`, `PRICE-VAT-RATE`, `FLD-QUOTE-VARIANTS`, `FLD-QUOTE-PRICE-SNAPSHOT`). Przy
limicie trzech iteracji GREEN i precedensie `CRM-SAFE-RECORD-ACTIONS` (28 kryteriów zużyło cały
limit) cztery WO po około 15 kryteriów to za dużo. Sześć WO po 6–12 kryteriów, dzielonych po
artefakcie i roli.

## Kolejność i zależności

```
WO-P1  PRICE-LIST-IMPORT      (SCHEMA + IMPORT)          ← START; dane w bazie dla reszty
  │
  ├── WO-P2  PRICE-LIST-ADMIN                             (ekran /settings/pricing)
  │
  │   WO-P3  FLD-QUOTE-CALC   (CALC + VAT-RATE)          ← może iść RÓWNOLEGLE z P1 (czyste funkcje)
  │     │                                                  WYMAGA DECYZJI D-P2 (gdzie mieszka silnik)
  │     │
  └─────┴── WO-P4  FLD-QUOTE-ROOMS (ROOMS + GENERAL-ITEMS + MANUAL-ITEM)
                │
                └── WO-P5  FLD-QUOTE-VARIANTS (VARIANTS + PRICE-SNAPSHOT)

WO-P6  B2C-PROPERTY-AREA-BAND   ← niezależny (b2c-web); WYMAGA DECYZJI D-P4 dla AC5
```

| WO | Plik | Wymagania | Liczba AC | Role | Okno kontraktowe | Blokada |
|---|---|---|---|---|---|---|
| P1 | `PRICE-LIST-IMPORT.md` | `PRICE-LIST-SCHEMA`, `PRICE-LIST-IMPORT` | 12 (6 charakteryzujących schemat) | `test-author` → `implementer-server` | NIE | D-P1 (tylko punkt wejścia) |
| P2 | `PRICE-LIST-ADMIN.md` | `PRICE-LIST-ADMIN` | 6 | `test-author` → `implementer-server` → `implementer-ui` | NIE | P1 |
| P3 | `FLD-QUOTE-CALC.md` | `FLD-QUOTE-CALC`, `PRICE-VAT-RATE` | 10 | `test-author` → `implementer-server` | NIE | **D-P2**, D-P3 (tylko AC zaokrągleń) |
| P4 | `FLD-QUOTE-ROOMS.md` | `FLD-QUOTE-ROOMS`, `FLD-QUOTE-GENERAL-ITEMS`, `FLD-QUOTE-MANUAL-ITEM` | 12 | `test-author` → `implementer-server` | NIE | P1, P3 |
| P5 | `FLD-QUOTE-VARIANTS.md` | `FLD-QUOTE-VARIANTS`, `FLD-QUOTE-PRICE-SNAPSHOT` (+ MANUAL-ITEM AC4) | 10 | `test-author` → `implementer-server` | NIE | P3, P4, D-P5 |
| P6 | `B2C-PROPERTY-AREA-BAND.md` | `B2C-PROPERTY-AREA-BAND` | 7 | `test-author` → `implementer-server` → `implementer-ui` | NIE | **D-P4** (tylko AC5), własność katalogu |

## Dlaczego taki podział

1. **P1 osobno od P2** — P1 to warstwa danych i funkcja domenowa publikacji wersji ceny
   (współdzielona przez import i ekran), testowana głównie na żywym Postgresie (`*.itest.ts`).
   P2 to ekran, uprawnienia i `audit_log` — inny zestaw testów, inna rola (`implementer-ui`).
2. **P3 to czyste funkcje** (liczenie, stawka, zaliczka, zaokrąglenia) — testy jednostkowe bez bazy,
   więc może iść równolegle z P1. Połączenie z `PRICE-VAT-RATE` jest wymuszone: CALC AC1
   i VAT AC2 to to samo zdanie z dwóch stron, rozdzielenie dałoby dwa WO testujące tę samą funkcję.
3. **P4 i P5 dzielą się na „składanie szkicu" i „wysyłka/wybór/zamrożenie"**. P4 to operacje na
   wersji roboczej (DRAFT), P5 to przejście DRAFT → SENT i wybór wariantu. P5 ma ryzyko HIGH
   w obu wymaganiach i jest styk z B4 (`FNL-E2-E3`), więc nie może dzielić limitu iteracji z P4.
4. **P6 dotyczy innej aplikacji** (b2c-web, `supabase-js` z RLS) i nie ma kodu wspólnego z resztą
   poza kluczem w `odpowiedzi_triage`, który P3 czyta. Ten klucz jest ustalony w obu WO.

## Czego ten strumień NIE dowozi (świadomie)

- **Interfejsu formularza wyceny audytora.** `apps/` zawiera tylko `b2b-web` i `b2c-web`; Field App
  powstaje na gałęzi B3 (`apps/field-app/**`, `apps/b2b-web/src/app/api/field/**`). B2 dowozi
  **funkcje domenowe**, które zgodnie z ADR-013 wariant (b) i `FLD-API-LAYER` AC4 („panel
  i aplikacja wołają JEDNĄ funkcję domenową na operację") zawoła Route Handler z B3. Kryteria
  „w tej części formularza pojawiają się WYŁĄCZNIE…" są realizowane jako zapytanie domenowe
  zwracające pozycje danego zasięgu — sam formularz należy do B3/B8.
- **`STD-INSTALL-CONFIG` i `B2C-TRIAGE-PRICE-FROM-PRICE-LIST`** — należą do strumienia P4 i do
  własności gałęzi B2 (`settings/standard-installation/**`, `apps/b2c-web/app/actions/get*.ts`),
  ale nie było ich w tym zleceniu. Wymagają osobnych WO. Skutek: `FLD-QUOTE-PRICE-SNAPSHOT` AC5
  (zamrożenie wyceny z Triage) i `FLD-QUOTE-CALC` AC5 w części „Triage" nie domkną się w tym
  strumieniu — patrz P3 i P5.
- **Przejście T02 i powiadomienie N4 przy wysłaniu oferty** — `FNL-E2-E3`, gałąź B4. P5 dostarcza
  funkcję zamrożenia działającą wewnątrz transakcji przekazanej przez wołającego; B4 składa ją
  z T02 i N4 w jednej transakcji (pułapka nr 2 z `CLAUDE.md`).
- **Faktura, proforma, umowa** (`INV-*`, `FLD-CONTRACT-GENERATE`). `PRICE-VAT-RATE` AC5 i
  `FLD-QUOTE-VARIANTS` AC5 domykają się tu tylko w części dotyczącej oferty.
- **Zmiana statusów w rejestrze wymagań** (`TODO` → `DONE`) — to zapis w `contracts/`, zbierany do
  najbliższego okna kontraktowego.

## Decyzje wymagające człowieka (zebrane)

| ID | Czego dotyczy | Blokuje | Rekomendacja | Opisane w |
|---|---|---|---|---|
| **D-P1** | Punkt wejścia importu cennika: (A) Server Action z wgraniem pliku CSV w `/settings/pricing`, (B) skrypt CLI, (C) migracja danych w zarezerwowanym slocie `20260929090000_` | tylko test punktu wejścia w P1 | **(A)** — jedyny wariant z prawdziwym aktorem w `audit_log`; `SYSTEM_GRANTS` nie obejmuje `price_list_items`, (C) wymaga okna kontraktowego | `PRICE-LIST-IMPORT.md` |
| **D-P2** | Gdzie mieszka czysty silnik wyceny: (a) nowy pakiet `packages/pricing` (precedens `@repo/scheduling`), (b) `apps/b2b-web/src/lib/pricing` zgodnie z tabelą własności B2 | **P3 w całości** (ścieżki importu w testach) | **(a)** — CALC AC5 wymaga tych samych zaokrągleń w Triage, a b2c-web nie może importować z b2b-web. Koszt: zmiana tabeli własności i dotknięcie lockfile | `FLD-QUOTE-CALC.md` |
| **D-P3** | Reguła zaokrągleń kwot (od sumy czy od pozycji; do grosza, połówki w górę) — dokumenty milczą, a CALC AC5 każe ją zdefiniować jednoznacznie i zgodnie z fakturą z inFakt | tylko AC zaokrągleń w P3 | VAT liczony od sumy netto wariantu, zaokrąglenie do grosza, połówki w górę; **potwierdzić z księgowym, jak liczy inFakt** | `FLD-QUOTE-CALC.md` |
| **D-P4** | **Sprzeczność w kontrakcie**: `PROPERTY_AREA_BANDS` ma etykiety `'Do 300 m²'` / `'Powyżej 300 m²'` i identyfikatory `UP_TO_300` / `ABOVE_300`, a `B2C-PROPERTY-AREA-BAND` AC5 i `PRICE-VAT-RATE` AC6 wymagają, by próg żył wyłącznie w SLA | AC5 w P6, AC6 w P3 (etykiety) | nie wybieram — patrz opis | `B2C-PROPERTY-AREA-BAND.md` |
| **D-P5** | Źródło ceny netto zestawu urządzeń (podstawa zaliczki): wpisywana przez audytora czy wyliczana z katalogu (`indoor_units`/`outdoor_units`). Schemat nie ma powiązania wariantu z urządzeniami | kształt wejścia w P5 | wpisywana, jawnie jako dana wejściowa — jedyny wariant zgodny z dzisiejszym schematem; katalog na tablecie (N5) jest odłożony | `FLD-QUOTE-VARIANTS.md` |

## Uwagi przekrojowe dla wszystkich WO strumienia

- **Próg 300 m²:** `contracts/sla.contract.mjs:61` —
  `{ id: 'PROPERTY_AREA_VAT_THRESHOLD', …, sqm: 300, req: ['PRICE-VAT-RATE', 'B2C-PROPERTY-AREA-BAND'] }`,
  w TypeScript `SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm` (`packages/contracts/src/generated/sla.ts:17`).
  Literał `300` w kodzie aplikacji tego strumienia jest zakazany — test statyczny zdefiniowany w P3.
- **Stawki 8/23 i mnożnik zaliczki 1,1 NIE są w kontrakcie.** Próg jest, stawki nie. Muszą żyć
  w jednym module silnika (P3); propozycja do najbliższego okna kontraktowego: `VAT_RATES`
  i mnożnik zaliczki w kontrakcie, z tego samego powodu, dla którego próg tam trafił.
- **Migracje `20260925090000_price_list_and_quotes.sql` i `20260925093000_audit_log_resource_check_field_app.sql`
  nie są zaaplikowane na żadnej żywej bazie.** Testy `*.itest.ts` działają na `supabase start`
  (aplikuje wszystkie migracje). Druga migracja przy braku `audit_log` wypisuje `WARNING` i niczego
  nie zmienia — przy wdrożeniu kolejność ma znaczenie (pierwszy wpis audytowy cennika wywróci zapis).
- **Autoryzacja.** Funkcje domenowe wyceny nie mają wołającego w B2 (Field App to B3). Bramka
  `can()` stoi w wołającym (Server Action w `src/app` albo Route Handler w `src/app/api/field`),
  zgodnie z ADR-013 (b). `tools/kk-authz-gate.mjs:97` skanuje wyłącznie `apps/b2b-web/src/app`,
  więc funkcje w `src/lib/pricing` są dla bramki niewidoczne — to akceptowane, bo wymóg `can()`
  spoczywa na wołającym, który jest w zakresie skanu. Sprawdzenie `audytor:own` (oferta na leadzie,
  do którego audytor jest przypisany) musi powstać RAZ, w B3, nie w każdym handlerze.
