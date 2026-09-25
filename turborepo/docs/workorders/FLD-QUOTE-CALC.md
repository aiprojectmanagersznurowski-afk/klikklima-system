# WO: FLD-QUOTE-CALC — silnik wyceny i stawka VAT z obiektu (WO-P3)

**Status: WYMAGA DECYZJI D-P2 — nie startować RED przed rozstrzygnięciem** (ścieżka modułu
przesądza o ścieżkach importu w testach). D-P3 blokuje wyłącznie AC5. Po rozstrzygnięciu D-P2
może iść równolegle z WO-P1 — to czyste funkcje, bez bazy (poza AC-V4). Indeks: `PRICE-LIST-VAT.md`.

## Wymagania

- `FLD-QUOTE-CALC` (**HIGH**, `TODO`).
- `PRICE-VAT-RATE` (**HIGH**, `TODO`).
- Połączone świadomie: CALC AC1 i VAT AC2 to to samo zdanie („ta sama pozycja idzie raz na 8%,
  raz na 23%") — jeden test niesie oba tagi.
- Konsumenci: WO-P4 (sumy szkicu), WO-P5 (zamrożenie przy wysyłce, zaliczka wybranego wariantu),
  później `B2C-TRIAGE-PRICE-FROM-PRICE-LIST` (te same zaokrąglenia) i `INV-FINAL` (stawka z obiektu).
- Domykane tu **częściowo**: CALC AC3 (wybór wariantu — P5), CALC AC5 (Triage i faktura — inne WO),
  VAT AC5 (faktura — `INV-FINAL`). Po tym WO oba wymagania NIE są jeszcze `DONE`.

## Kontekst kodu

### Istnieje

- Próg: `contracts/sla.contract.mjs:61` —
  `{ id: 'PROPERTY_AREA_VAT_THRESHOLD', scope: '…do której (włącznie) obowiązuje obniżona stawka…', sqm: 300, req: ['PRICE-VAT-RATE', 'B2C-PROPERTY-AREA-BAND'] }`;
  w TS: `SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm` (`packages/contracts/src/generated/sla.ts:17`).
  **Granica włącznie:** 300 m² to jeszcze stawka obniżona.
- `quotes.property_kind` z CHECK `quotes_property_kind_check`:
  `'RESIDENTIAL_UP_TO_THRESHOLD' | 'RESIDENTIAL_ABOVE_THRESHOLD' | 'COMMERCIAL'` (albo `NULL`);
  `quotes.vat_rate_percent` z CHECK `IN (8, 23)` — `supabase/migrations/20260925090000_price_list_and_quotes.sql`.
- `quote_variants.equipment_net_amount` — podstawa zaliczki (D8); `quote_items.unit_price_net`,
  `quantity NUMERIC(12,3) > 0`; wersja ceny z `crew_cost_net` (może być `NULL`).
- Odpowiedzi Triage na leadzie: `leady.odpowiedzi_triage` (`Json?`), zapisywane **surowym stanem
  kreatora** (`apps/b2c-web/app/actions/saveLead.ts:82`), typ opisany w
  `apps/b2b-web/src/lib/triage-answers.ts` (`location` = **polska etykieta** „Mieszkanie"/„Dom"/
  „Lokal komercyjny", nie identyfikator). Odwrócenie etykiety na identyfikator jest już w
  `apps/b2c-web/store/triageStore.ts:15` (`BUILDING_TYPE_ID_BY_PL` z `BUILDING_TYPE_PL`).
- Klucz przedziału powierzchni w `odpowiedzi_triage`: **`propertyAreaBand`** z wartością
  `'UP_TO_300' | 'ABOVE_300'` — ustalony w WO-P6 (`B2C-PROPERTY-AREA-BAND.md`); dziś nie istnieje
  w żadnym leadzie.
- Istniejące literały `300` w aplikacjach, **niezwiązane z progiem i poza zakresem skanu AC-V1**:
  `auditors/components/AddAuditorModal.tsx:121` (debounce), `components/ui/ai-chat-input.tsx:417`,
  `b2c-web/components/triage/StepWrapper.tsx:37` (sztywność animacji),
  `b2c-web/components/ui/DeviceModal.tsx:328`, `b2c-web/components/triage/steps/Step8Booking.tsx:115`.
  Nie „naprawiać" ich przy okazji.

### Brakuje

- Jakiegokolwiek kodu liczącego wycenę z pozycji. Dzisiejsza cena w Triage to
  `getSetForConfig.ts` (literał 1200 zł) — poza tym WO.
- Stałych stawek VAT i mnożnika zaliczki w kontrakcie (patrz Ryzyka).

## Zmiana kontraktu

**NIEWYMAGANA** dla kryteriów tego WO. Rekomendowana do najbliższego okna (nie blokuje):
`VAT_RATES` (8/23) i mnożnik zaliczki (1,1) w kontrakcie, z tego samego powodu co próg.

## WYMAGA DECYZJI

### D-P2 — gdzie mieszka silnik (blokuje cały WO)

- **(a) Nowy pakiet `packages/pricing`** (precedens: `@repo/scheduling` używany przez b2c-web
  i b2b-web). Czyste funkcje: stawka z obiektu, sumy, marża, zaliczka, zaokrąglenia. Persystencja
  zostaje w `apps/b2b-web/src/lib/pricing`.
  Koszt: katalog spoza tabeli własności B2 i wpis workspace w lockfile (plan: zależności w etapie 0,
  w przeciwnym razie regeneracja lockfile po rebase).
- **(b) `apps/b2b-web/src/lib/pricing`** zgodnie z tabelą własności. Koszt: CALC AC5 („zaokrąglenia
  takie same w Triage, w ofercie i na fakturze") jest wtedy nieosiągalne bez przeniesienia modułu
  przy `B2C-TRIAGE-PRICE-FROM-PRICE-LIST` — aplikacje nie importują z siebie nawzajem, a kopia
  w b2c-web to druga implementacja reguły.

**Rekomendacja: (a).** Uwaga praktyczna: czysty pakiet bez zależności liczy kwoty w **groszach
jako liczbach całkowitych** (ilość w tysięcznych × cena w groszach), więc nie potrzebuje
`decimal.js`; konwersja z/do `Prisma.Decimal` na granicy persystencji.

### D-P3 — reguła zaokrągleń (blokuje wyłącznie AC5)

Dokumenty nie definiują reguły, a CALC AC5 każe ją zdefiniować jednoznacznie. Przepisy dopuszczają
VAT liczony od sumy albo od pozycji, a faktura powstaje w inFakt, który liczy po swojemu.
**Rekomendacja:** wartość pozycji netto = ilość × cena jednostkowa, zaokrąglona do grosza;
suma netto wariantu = suma pozycji + cena netto zestawu urządzeń; VAT = suma netto × stawka,
zaokrąglony **raz, od sumy**, do grosza, połówki w górę; brutto = netto + VAT; zaliczka =
cena netto zestawu × (1 + stawka) × 1,1, zaokrąglona raz na końcu. **Do potwierdzenia z księgowym,
jak liczy inFakt** — jeśli od pozycji, reguła zmienia się w jednym miejscu, a AC5 zmienia przykład.

## Kryteria akceptacji (wykonalne)

Tagi: `// @REQ: FLD-QUOTE-CALC`, `// @REQ: PRICE-VAT-RATE`.

- [ ] **AC-C1 / AC-V2** Ten sam koszyk (np. `podłączenie ściennej` 1 szt. × 1000.00, `instalacja
  freonowa 1/4 i 3/8` 3 mb × 130.00, `uruchomienie` 1 × 400.00; urządzenia netto 0) dla
  `RESIDENTIAL_UP_TO_THRESHOLD` daje netto 1790.00, brutto **1933.20**, a dla `COMMERCIAL`
  i `RESIDENTIAL_ABOVE_THRESHOLD` netto 1790.00, brutto **2201.70**. Silnik nie przyjmuje stawki
  z pozycji — typ wejścia pozycji nie ma pola stawki.
- [ ] **AC-C2** Marża pozycji = (cena sprzedaży − koszt ekipy) × ilość, dla `instalacja freonowa
  1/4 i 3/8` 3 mb: (130.00 − 18.72) × 3 = **333.84**. Dla pozycji z kosztem ekipy `NULL`
  (`podłączenie ściennej`) marża jest jawnie nieznana (wartość odróżnialna od liczby, np. `null`
  w polu typu `number | null` albo znacznik) — **nie** 1000.00 i nie 0. Pozycja indywidualna
  (bez pozycji cennika) ma marżę nieznaną. Podsumowanie marży wariantu zwraca sumę znanych marż
  i liczbę pozycji z marżą nieznaną — nigdy samą sumę udającą kompletną.
- [ ] **AC-C3** Zaliczka = cena netto zestawu × (1 + stawka obiektu) × 1,1. Dla zestawu 10 000.00
  netto: `RESIDENTIAL_UP_TO_THRESHOLD` → **11 880.00**, `COMMERCIAL` → **13 530.00**. Test przechodzi
  obie stawki i oczekuje różnych kwot. Pozycje montażowe nie wpływają na zaliczkę.
- [ ] **AC-C4** Silnik liczy wszystkie kwoty wynikowe (netto, VAT, brutto, marża, zaliczka) z danych
  źródłowych: ilości, cen jednostkowych, kosztów ekipy, ceny zestawu, rodzaju obiektu. Schemat Zod
  wejścia operacji wyceny (używany przez P4/P5 i przyszły Route Handler z B3) nie zawiera pól
  kwot wynikowych; żądanie z dołączonymi `totalNet`, `totalGross`, `vatAmount`, `depositAmountGross`
  daje wynik identyczny jak bez nich.
- [ ] **AC-C5** *(zależy od D-P3; przykłady dla rekomendacji)* Jedna funkcja zaokrąglająca, jedna
  implementacja reguły:
  - dwie pozycje po 1.50 netto przy 23% → VAT **0.69** (od sumy 3.00), nie 0.70 (od pozycji);
  - 1.50 netto przy 23% → VAT **0.35** (połówki w górę; 0.345 → 0.35, nie 0.34);
  - 3 × 40.10 → **120.30** (brak błędu zmiennoprzecinkowego: 120.30000000000001 to porażka testu);
  - ilość 0.333 mb × 130.00 → **43.29**.
  Test statyczny: w module silnika i w `lib/pricing/**` nie ma drugiego wywołania `toFixed`,
  `Math.round` ani `Number(...)` na kwocie poza funkcją zaokrąglającą.
- [ ] **AC-V1** Test statyczny: w plikach `.ts`/`.tsx` (bez testów, `node_modules`, `.next`,
  `generated`) z zakresu: `apps/b2b-web/src/lib/pricing/**`, `apps/b2b-web/src/app/(dashboard)/settings/pricing/**`,
  katalog silnika z D-P2 oraz **każdy plik w `apps/**`, który zawiera `PROPERTY_AREA`,
  `propertyKind`, `property_kind`, `propertyAreaBand` albo `PropertyAreaBand`** — nie występuje
  samodzielny literał `300` (wzorzec: `300` niepoprzedzone i nienastępowane znakiem słowa ani kropką;
  łapie `300`, `'do 300 m²'`, nie łapie `UP_TO_300`). Test ma próbę żywotności: podrzucony plik
  z `if (area <= 300)` i `propertyKind` w treści jest wykrywany. Próg silnik bierze wyłącznie
  z `SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm`.
- [ ] **AC-V3** Rodzaj obiektu → stawka: `RESIDENTIAL_UP_TO_THRESHOLD` → 8, `RESIDENTIAL_ABOVE_THRESHOLD`
  → 23, `COMMERCIAL` → 23. Wartość spoza trzech (np. `'RESIDENTIAL'`) i brak wartości kończą się
  błędem domenowym („wymagany rodzaj obiektu") — **nigdy stawką domyślną**. Test `*.itest.ts`: zapis
  `quotes.property_kind = 'RESIDENTIAL'` odrzuca baza (charakteryzujący, zielony od początku).
- [ ] **AC-V4** Pierwszeństwo audytora: funkcja podpowiadająca rodzaj obiektu z `odpowiedzi_triage`
  mapuje `location` Mieszkanie/Dom + `propertyAreaBand: 'UP_TO_300'` → `RESIDENTIAL_UP_TO_THRESHOLD`,
  + `'ABOVE_300'` → `RESIDENTIAL_ABOVE_THRESHOLD`, Lokal komercyjny → `COMMERCIAL`, mieszkalny bez
  `propertyAreaBand` (leady sprzed P6) → brak podpowiedzi. Stawka oferty liczy się **wyłącznie**
  z `quotes.property_kind`: lead z Triage `UP_TO_300` i oferta z `COMMERCIAL` → 23%. Zapis rodzaju
  obiektu na ofercie (`*.itest.ts`) nadpisuje podpowiedź i nie zmienia `odpowiedzi_triage` leada.
- [ ] **AC-V5** *(część ofertowa)* Zmiana `property_kind` oferty w statusie innym niż `DRAFT` jest
  odrzucana błędem domenowym, a wiersz pozostaje bez zmian. Część „po wystawieniu faktury" należy
  do `INV-FINAL`.
- [ ] **AC-V6** Zmiana progu bez zmiany kodu: z progiem podmienionym w teście na 250 etykieta rodzaju
  obiektu dla audytora brzmi „Lokal mieszkalny do 250 m²" / „…powyżej 250 m²", a stawki trzech rodzajów
  się nie zmieniają. **Uwaga:** audytor wybiera rodzaj, nie wpisuje metrażu, więc w ścieżce oferty próg
  wpływa wyłącznie na etykiety — nie ma porównania liczbowego do przetestowania. Etykiety kafelków
  w Triage są objęte D-P4 (WO-P6).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Granica włącznie** — etykieta i opis kontraktu mówią „do (włącznie)". Jeżeli gdziekolwiek
  powstanie porównanie z metrażem, 300 m² daje 8%. (Dziś brak takiej ścieżki — test pilnuje, że
  pomocnicza funkcja, jeśli powstanie, używa `<=`.)
- **Wariant bez pozycji montażowych** (same urządzenia) i **wariant bez urządzeń** (sam montaż,
  `equipment_net_amount = 0` albo `NULL`) — oba liczą się bez błędu; zaliczka przy braku urządzeń
  wynosi 0.00.
- **Ilość ułamkowa przy `szt`** (1.5 szt.) — silnik liczy, nie odrzuca (reguła nie jest w dokumentach;
  patrz Ryzyka).
- **Duże kwoty** — 999 999 999.99 netto (granica `NUMERIC(12,2)`) × 1,23 nie traci grosza.
- **Pozycja z kosztem ekipy 0.00** — marża = cena sprzedaży × ilość (zero to znana wartość).

## Poza zakresem

- Zapis pozycji, pomieszczeń i wariantów (P4), wysyłka i zamrożenie (P5).
- Wybór urządzeń z katalogu i skąd bierze się cena zestawu (D-P5, P5).
- Cena w Triage z cennika (`B2C-TRIAGE-PRICE-FROM-PRICE-LIST`), faktury (`INV-*`).
- Kto widzi marżę i koszt ekipy (klient nie może — odpowiedzialność warstwy prezentacji w B3/PDF).

## Ryzyka i nieznane

- **Stawki 8/23 i mnożnik 1,1 nie są w kontrakcie.** Mieszkają w jednym module silnika; baza ma
  `CHECK (vat_rate_percent IN (8, 23))`, więc zmiana stawki i tak wymaga migracji.
- Ilości ułamkowe dla `szt` — nieokreślone w dokumentach; do ewentualnej reguły formularza w B3.
- Zakres skanu AC-V1 jest interpretacją kryterium „NIGDZIE w kodzie nie występuje literał 300".
  Dosłowne brzmienie wywróciłoby test na pięciu niezwiązanych miejscach (debounce, animacja) poza
  własnością B2. Interpretacja do potwierdzenia przy akceptacji planu.
- Klucz `propertyAreaBand` w `odpowiedzi_triage` to umowa między P3 a P6 — nazwa w stylu pozostałych
  kluczy stanu kreatora (camelCase), wartość identyfikatorem słownika.

## Kolejność ról

`test-author` (jednostkowe AC-C1…C5, AC-V1…V3, V6; itest AC-V3 część bazowa, AC-V4 zapis, AC-V5) →
`implementer-server` → `/kk-verify`. Przegląd człowieka przed merge (dwa wymagania HIGH).
