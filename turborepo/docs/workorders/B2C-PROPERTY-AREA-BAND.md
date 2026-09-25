# WO: B2C-PROPERTY-AREA-BAND — pytanie o przedział powierzchni lokalu w Triage (WO-P6)

**Status: WYMAGA DECYZJI D-P4 dla AC5 (etykiety kafelków). AC1–AC4, AC6, AC7 można startować.**
Uwaga na własność katalogów — niżej. Indeks strumienia: `PRICE-LIST-VAT.md`.

## Wymagania

- `B2C-PROPERTY-AREA-BAND` (MEDIUM, `TODO`, domena `b2c`).
- Konsument: `PRICE-VAT-RATE` AC4 (podpowiedź rodzaju obiektu dla audytora — WO-P3 czyta klucz
  `propertyAreaBand` z `leady.odpowiedzi_triage`).

## Kontekst kodu

### Istnieje

- Kontrakt: `contracts/triage.contract.mjs:48-51` — `PROPERTY_AREA_BANDS`:
  `{ id: 'UP_TO_300', pl: 'Do 300 m²', boundary: 'BELOW_OR_EQUAL' }`,
  `{ id: 'ABOVE_300', pl: 'Powyżej 300 m²', boundary: 'ABOVE' }`;
  `:118` — pole `PROPERTY_AREA_BAND` z `visibleWhen: { field: 'BUILDING_TYPE', in: ['APARTMENT', 'HOUSE'] }`.
- Wygenerowane: `packages/contracts/src/generated/triage.ts` — `PROPERTY_AREA_BAND_IDS`,
  `PROPERTY_AREA_BAND_PL`, `PROPERTY_AREA_BAND_BOUNDARY`, `TRIAGE_FIELD_VISIBILITY`,
  **`isTriageFieldVisible(field, answers)`** (`:103`) — gotowa funkcja warunku widoczności.
- Kreator: `apps/b2c-web/store/triageStore.ts` — `toTriageAnswers()` (`:71`) buduje `TriageAnswers`
  z `location` (polska etykieta → id przez `BUILDING_TYPE_ID_BY_PL`, `:15`); przejścia kroków
  zaszyte numerami (`nextStep`/`prevStep`, `:124-165`), skrót `selectedDeviceLine`: krok 1 → 4
  (krok 1 jest więc pokazywany zawsze). Typ nieruchomości wybierany w
  `components/triage/steps/Step1Location.tsx`.
- Zapis: `apps/b2c-web/app/actions/saveLead.ts` — `triageData: any` (`:15`), **bez walidacji**,
  zapisywany w całości do `leady.odpowiedzi_triage` (`:82`) **po** wstawieniu klienta i adresu
  (`:35-60`). `supabase-js` z RLS aktywnym (ADR-001, B2C).
- Istniejące testy kroków kreatora: `apps/b2c-web/tests/store/triage-steps.test.ts`,
  `tests/triage-step4-state-contract.test.ts`, `tests/nav-state-contract.test.ts` — pinują numerację kroków.

### Brakuje

- Pytania o przedział powierzchni w kreatorze, pola w stanie, klucza w `odpowiedzi_triage`,
  walidacji po stronie serwera.
- Kolumny na leadzie — `FIELD-APP-I-PODPISY-ZAKRES.md` D17 zapowiadał „kolumna na leadzie" w etapie 0,
  ale `schema.prisma` jej nie ma. Kryterium AC4 („trafia do odpowiedzi Triage zapisywanych przy leadzie")
  jest spełnialne przez `odpowiedzi_triage` — **kolumna nie jest potrzebna** do tego WO.

### Własność katalogów (plan równoległy)

Tabela `PLAN-ROWNOLEGLY-BRANCHE.md` §3 daje B2 w b2c-web wyłącznie `apps/b2c-web/app/actions/get*.ts`;
reszta `apps/b2c-web/**` była własnością B7 (`feat/b2c-triage`, scalone jako #7). Ten WO dotyka
`store/triageStore.ts`, `components/triage/steps/Step1Location.tsx`, `app/actions/saveLead.ts`.
**Rekomendacja:** osobny PR (i gałąź) dla tego WO; B7 jest scalone, więc kolizji nie ma, ale zmianę
własności trzeba odnotować w planie.

## Zmiana kontraktu

**NIEWYMAGANA** dla AC1–AC4, AC6, AC7. Dla AC5 — zależy od D-P4.

## WYMAGA DECYZJI

### D-P4 — sprzeczność: liczba 300 w słowniku, który „nie może jej powtarzać"

Cytaty:
- `contracts/triage.contract.mjs:44-46`: „Granica pochodzi z progu SLA.PROPERTY_AREA_VAT_THRESHOLD
  (300 m²) i **NIE WOLNO jej tu powtórzyć jako literału** — gdyby księgowy zmienił próg, słownik
  i stawka muszą zmienić się jednym ruchem."
- `tools/kk-validate.mjs:517-518`: „Liczba 300 NIE MOŻE występować w słowniku".
- Ten sam słownik, `contracts/triage.contract.mjs:49-50`: `id: 'UP_TO_300', pl: 'Do 300 m²'`,
  `id: 'ABOVE_300', pl: 'Powyżej 300 m²'`. Walidator sprawdza tylko `minSqm`/`maxSqm`, więc tego
  nie widzi.
- `B2C-PROPERTY-AREA-BAND` AC5: „słownik i próg nie mogą rozjechać się na dwie różne liczby";
  `PRICE-VAT-RATE` AC6: „zmiana progu w kontrakcie SLA zmienia zachowanie systemu bez zmiany kodu".
- Jednocześnie `B2C-PROPERTY-AREA-BAND` AC4 **nazywa** identyfikatory `UP_TO_300` / `ABOVE_300` —
  identyfikatory z liczbą są częścią wymagania.

Po zmianie progu na 250 kafelki w Triage nadal mówiłyby „Do 300 m²", a identyfikator `UP_TO_300`
zapisany w starych leadach znaczyłby co innego niż w nowych. Warianty (nie wybieram):

- **(a)** `contract-steward` w oknie kontraktowym: etykiety bez liczby w słowniku (np. szablon
  z miejscem na próg, renderowany z SLA) + reguła `kk-validate` wykrywająca cyfry progu w `pl`.
  Identyfikatory zostają (wymaganie je nazywa).
- **(b)** Bez zmiany kontraktu: b2c-web **nie używa** `PROPERTY_AREA_BAND_PL`, tylko składa etykietę
  z `SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm` i `PROPERTY_AREA_BAND_BOUNDARY`. Koszt: `pl` w kontrakcie
  zostaje martwą drugą kopią liczby.
- **(c)** Zaakceptować powtórzenie w etykietach i dopisać do AC5 wyjątek — zmiana treści wymagania.

## Kryteria akceptacji (wykonalne)

Tag: `// @REQ: B2C-PROPERTY-AREA-BAND`.

- [ ] **AC1** Po wyborze „Mieszkanie" albo „Dom" kreator zadaje pytanie o powierzchnię lokalu,
  zanim klient przejdzie dalej; po wyborze „Lokal komercyjny" pytanie nie pojawia się. Dotyczy
  również ścieżki z modala urządzenia (`selectedDeviceLine`, skok 1 → 4). Zmiana typu z „Mieszkanie"
  na „Lokal komercyjny" po udzieleniu odpowiedzi usuwa odpowiedź ze stanu.
- [ ] **AC2** Warunek widoczności pochodzi z kontraktu: kreator woła `isTriageFieldVisible('PROPERTY_AREA_BAND', …)`.
  Test podmienia `TRIAGE_FIELD_VISIBILITY` tak, by pole było widoczne także dla `COMMERCIAL`,
  i oczekuje pytania dla lokalu komercyjnego. Test statyczny: w plikach kreatora dotyczących tego
  pytania nie ma porównania z `'APARTMENT'`/`'HOUSE'`/`BUILDING_TYPE_PL.APARTMENT` w celu ustalenia
  widoczności.
- [ ] **AC3** Odpowiedź to wybór jednego z dwóch kafelków; w kroku nie ma pola wpisywania liczby.
  Przedział nigdy nie jest wyliczany z `roomSizes` — test ustawia pomieszczenia sumujące się do
  ponad progu, nie wybiera kafelka i oczekuje braku wartości, a nie `ABOVE_300`.
- [ ] **AC4** Zapis leada zawiera w `odpowiedzi_triage` klucz `propertyAreaBand` z wartością
  `'UP_TO_300'` albo `'ABOVE_300'` — nigdy etykietą („Do 300 m²"). Wartość spoza
  `PROPERTY_AREA_BAND_IDS` przysłana do serwera jest odrzucana.
- [ ] **AC5** *(zależy od D-P4)* Etykiety kafelków i próg nie mogą się rozjechać: z progiem podmienionym
  w teście na 250 kafelki mówią o 250 m² (przy wariancie (a) lub (b)).
- [ ] **AC6** Serwer (`saveLead`): dla `location` Mieszkanie/Dom bez `propertyAreaBand` zwraca błąd
  walidacji **przed** jakimkolwiek zapisem — zero wywołań `insert` na `klienci`, `adresy`, `leady`
  i zero rezerwacji (test liczy wywołania, nie tylko komunikat). Dla „Lokal komercyjny" brak wartości
  jest poprawny; wartość przysłana dla lokalu komercyjnego nie jest zapisywana.
- [ ] **AC7** Deklaracja jest orientacyjna: zapis leada z `propertyAreaBand` nie tworzy oferty ani nie
  zapisuje stawki VAT; jedynym konsumentem jest podpowiedź dla audytora (WO-P3, AC-V4), którą audytor
  może nadpisać.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Powrót wstecz i zmiana typu** (Dom → Lokal komercyjny → Dom): pytanie wraca bez odpowiedzi.
- **Ekran Eksperta**: `COMMERCIAL` nadal trafia na ekran eksperta (reguła `COMMERCIAL_PROPERTY`),
  nowe pytanie nie zmienia wyniku `isExpertScreen`.
- **Żądanie spreparowane**: `location` „Mieszkanie" z `propertyAreaBand: 'Do 300 m²'` albo `300` —
  odrzucone (AC4/AC6).
- **Numeracja kroków**: istniejące testy numeracji (`triage-steps.test.ts` i in.) zostają zielone.
  Rekomendacja: pytanie w kroku 1, pod wyborem typu, bez nowego numeru kroku. Jeżeli implementacja
  wymaga nowego kroku — `test-author` aktualizuje testy numeracji w fazie RED (implementer ich nie dotyka).
- **Kolory i ikony kafelków** — tokeny motywu, ikony wyłącznie z `lucide-react` (hook `guard-forbidden`).

## Poza zakresem

- Pokazywanie w Triage ceny brutto albo stawki VAT.
- `submitFinalTriage` w `apps/b2c-web/app/actions/leads.ts:160` — brak wywołania w kodzie produkcyjnym;
  nie dostaje walidacji w tym WO (ryzyko niżej).
- Kolumna na leadzie dla przedziału powierzchni (zmiana schematu — okno kontraktowe).
- Cena montażu w Triage z nowego cennika (`B2C-TRIAGE-PRICE-FROM-PRICE-LIST`).

## Ryzyka i nieznane

- `submitFinalTriage` zapisuje `odpowiedzi_triage` bez walidacji. Martwy dziś, ale jeśli ktoś go
  podłączy, ominie AC6.
- `odpowiedzi_triage` to surowy stan kreatora (polska etykieta w `location`), a nie `TriageAnswers`
  z kontraktu (`generated/triage.ts:90` mówi o `leads.triage_answers`). Klucz `propertyAreaBand` trzyma
  się faktycznego kształtu; rozjazd z komentarzem kontraktu jest starszy niż ten WO.
- Leady sprzed wdrożenia nie mają `propertyAreaBand` — audytor zawsze wybiera rodzaj obiektu (WO-P3).

## Kolejność ról

`test-author` → `implementer-server` (`saveLead.ts`, stan w `triageStore.ts`) → `implementer-ui`
(`Step1Location.tsx`) → `/kk-verify`.
