# WO: B2C-TRIAGE-DISQUALIFY — obie reguły dyskwalifikacji kierują na ekran Eksperta, a stamtąd do rezerwacji audytu bez ceny

**Cel:** konfiguracja spełniająca którąkolwiek z dwóch reguł `DISQUALIFICATION_RULES` (lokal komercyjny albo liczba pomieszczeń ≥ `ROOM_COUNT_EXPERT_THRESHOLD`) nie dostaje automatycznej wyceny — ani w kreatorze Triage, ani w modalu urządzenia, ani w Server Actions przy ominięciu UI — ale nadal może zarezerwować termin audytu.

## Wymagania

- `B2C-TRIAGE-DISQUALIFY` (status `TODO`, risk `MEDIUM`, źródło `contracts/triage.contract.mjs`)
- Pokrycie wg `kk-trace`: **BRAK TESTU**, 0 testów. Zaczynamy od zera.
- Styczne, celowo NIE realizowane tutaj: `B2C-TRIAGE-CONDITIONAL`, `B2C-TRIAGE-STEPS`, `B2C-LEAD-ENTRY`, `B2C-LEAD-ATOMIC`, `B2C-PRICE-FROM`, `B2C-BOOKING-SLOT`, `B2C-BOOKING-VALIDATION`.

## Decyzje człowieka z 2026-08-19 (wiążące dla tego WO)

| # | Decyzja | Skutek |
|---|---|---|
| D1 | **`DeviceModal` wchodzi w zakres.** Konfiguracja ≥ progu nie pokazuje w modalu ceny. | AC13, AC15 |
| D2 | **`apps/b2c-web/app/api/test-rec/route.ts` do usunięcia.** | AC16 |
| D3 | **Ekran Eksperta pojawia się dopiero po zebraniu wszystkich odpowiedzi kreatora**, rozstrzygnięcie zapada w kroku 6. | „Mechanika D3" |
| D6 | **Ekran Eksperta nie jest końcem ścieżki — prowadzi do rezerwacji audytu.** Klient dostaje komunikat, że wycena wymaga ekspertyzy na miejscu, i **nadal może wypełnić formularz i wybrać termin audytu**. | „Mechanika D6", AC6, AC18–AC21 |
| D4 | **Krok 3 (metraż) pokazuje się także przy `roomCount >= próg`.** Nie jest pomijany — metraże 4–5 pomieszczeń to kontekst dla inżyniera jadącego na audyt. | Zero zmian w zakresie pomijania kroków; AC2, AC3, AC10, AC19 opisane zgodnie z tym |
| D5 | **`packages/contracts/package.json` dostaje `"./triage"` w `exports`**, dla symetrii z pozostałymi pięcioma podścieżkami. | Jednolinijkowa zmiana poza `contractProtectedPaths`, bez okna kontraktowego. Wykonuje `contract-steward` przy najbliższym dotknięciu `packages/contracts/` albo `implementer-server` w ramach tego WO — pierwsza okazja wygrywa |
| D7 | **CTA w `DeviceModal` prowadzi normalnie do `/triage`.** Klient przechodzi kreator i ląduje na ekranie Eksperta, skąd rezerwuje audyt. Jedno miejsce rezerwacji w aplikacji, jedna kopia tekstu. | AC14 |
| D8 | **Wycena po audycie jest wiążąca** (decyzja biznesowa). | Uzasadnia mocne sformułowanie w treści komunikatu — patrz „Treść ekranu Eksperta". Nie łagodzić przy późniejszych zmianach copy. |

D3 jest świadomie droższym wariantem i nie podlega tu kwestionowaniu. Odnotowuję, że `docs/prompts/figma_triage_ui_prompt.md` (pkt 1 i 2) opisuje wariant natychmiastowy i po D3 oraz D6 jest nieaktualny w dwóch punktach — do poprawy przez `doc-scribe` osobno.

## Kontekst kodu

### Istnieje

| Plik | Co tam jest |
|---|---|
| `contracts/triage.contract.mjs` | `DISQUALIFICATION_RULES` (2 reguły), `ROOM_COUNT_EXPERT_THRESHOLD = 4`, `BUILDING_TYPES`, `TRIAGE_FIELDS`, `DISQUALIFICATION_OUTCOMES = ['EXPERT_SCREEN']` |
| `packages/contracts/src/generated/triage.ts` | gotowe predykaty: `disqualifyingRules(answers)`, `isExpertScreen(answers)`, `BUILDING_TYPE_PL`, `ROOM_COUNT_EXPERT_THRESHOLD`, typ `TriageAnswers` |
| `packages/contracts/src/generated/index.ts` | `export * from './triage'` — `import { … } from '@klikklima/contracts'` jest legalną drogą |
| `apps/b2c-web/store/triageStore.ts` | getter `isExpertScreen` (linie 81–84) — **destrukturyzuje `roomCount` i nigdzie go nie używa**, zwraca `location === 'Lokal komercyjny'` |
| `apps/b2c-web/components/triage/TriageFunnel.tsx` | `renderStep()` — `if (isExpertScreen) return <StepExpert/>` **przed** `switch (step)`, więc ekran Eksperta przykrywa każdy krok. To odwraca D3 |
| `apps/b2c-web/components/triage/ProgressBar.tsx` | `progress = isExpertScreen ? 100 : (step/8)*100` oraz `isHidden = isExpertScreen || step === 6` — oba warunki należą do wariantu natychmiastowego |
| `apps/b2c-web/components/triage/steps/Step3Sizes.tsx` | renderuje pola metrażu generycznie (`Array.from({length: state.roomCount})`) — obsługuje 4 i 5 pokojów bez zmian |
| `apps/b2c-web/components/triage/steps/Step5Conditions.tsx` | dla `location !== 'Mieszkanie'` sam wywołuje `nextStep()` w `useEffect` — krok 5 realnie istnieje tylko dla mieszkania |
| `apps/b2c-web/components/triage/steps/Step6Loader.tsx` | „AI Loader": 4,8 s animacji, potem `nextStep()`. Nie wywołuje niczego serwerowego — czysta atrapa czasu |
| `apps/b2c-web/components/triage/steps/Step7Success.tsx` | jedyny konsument wyceny w kreatorze — `getRecommendation` w `useEffect` przy montowaniu; „Cena z montażem (brutto)", „Szacunkowy koszt inwestycji", „Rezerwuj termin audytu" |
| `apps/b2c-web/components/triage/steps/StepExpert.tsx` | ekran Eksperta — dziś bez ceny, ale z literałem progu w treści („obejmujących **4 i więcej** pomieszczeń"), z ramą „Dział Komercyjny / ekspert B2B / Zadzwoń do nas" i jedynym wyjściem przez `prevStep()` |
| `apps/b2c-web/components/triage/steps/Step8Booking.tsx` | formularz rezerwacji: **bez propsów** (linia 51: `export const Step8Booking = () => {`), czyta wyłącznie ze store'a. **Nie renderuje żadnej kwoty ani nazwy wybranego urządzenia** — zweryfikowane, brak wystąpień „zł", „brutto", `priceDevices`, `selectedInternalUnits`. **Ale wywołuje `saveLead(leadData)` (linia 195)** — patrz „Mechanika D6", pkt 4 |
| `apps/b2c-web/app/actions/saveLead.ts` | zapisuje klienta, adres i leada; `estimatedQuote` składane wyłącznie z `triageData.priceDevices/priceInstallation` (linie 48–55) — przy zerach zostaje `null`. Plik operuje na porzuconych nazwach (`klienci`, `adresy`, `leady`, `estymowana_wycena`) — patrz „Ryzyka" |
| `apps/b2c-web/app/actions/getRecommendation.ts` | Server Action, sygnatura `(roomCount, roomSizes, seriesLine?)` — **zero walidacji dyskwalifikacji** |
| `apps/b2c-web/app/actions/getSetForConfig.ts` | Server Action modalu, `(seriesName, rooms[])` → `priceNetto`, `installPrice`, `totalPrice`; **zero walidacji**; przy braku dopasowania zwraca `null` |
| `apps/b2c-web/app/api/test-rec/route.ts` | publiczny route handler `GET /api/test-rec` wołający `getRecommendation(5, …)` i zwracający ceny — **do usunięcia (D2)** |
| `apps/b2c-web/components/ui/DeviceModal.tsx` | konfiguracja do `maxSupportedRooms = 5` (`addRoom`, linia 314; przycisk linia 439). `getSetForConfig` (linia 297). `total` (linia 343) z fallbackiem na `basePrice`. Blok ceny „Cena całkowita zestawu" / „Cena zaczyna się od" + `fmt(total)` (linie 538–553). CTA `handleAuditClick` (linia 326) → `/triage?series=…&roomsCount=N&area_i=…`; przycisk linia 637 |
| `apps/b2c-web/e2e/triage.spec.ts` | 4 kombinacje, w tym `{ location: 'Lokal komercyjny', rooms: 1 }` prowadzona do ekranu ceny — **TEST-DEFECT** |
| `apps/b2c-web/playwright.config.ts` | `testDir: './e2e'` — katalog `apps/b2c-web/tests/` nie jest uruchamiany przez żaden runner |
| `vitest.config.mts` | alias `@klikklima/contracts` → `packages/contracts/src/generated/index.ts`; include `**/*.test.ts`, e2e wykluczone |

### Brakuje

1. **Reguły `ROOM_COUNT_AT_OR_ABOVE_THRESHOLD` nigdzie w aplikacji.** 4 lub 5 pomieszczeń prowadzi dziś prosto do wyceny — i w kreatorze, i w modalu.
2. **Jakiegokolwiek połączenia B2C z `@klikklima/contracts`.** Żaden plik w `apps/` nie importuje dziś tego pakietu. Ten WO będzie pierwszym konsumentem.
3. **Mostu etykieta PL → identyfikator kontraktu.** Store trzyma `location: 'Lokal komercyjny'`, kontrakt operuje na `BUILDING_TYPE = 'COMMERCIAL'`. `BUILDING_TYPE_PL` daje `id → pl`; brakuje odwrotnego.
4. **Walidacji serwerowej w obu Server Actions wyceny.**
5. **Rozróżnialnego wyniku „dyskwalifikacja" w `getSetForConfig`.** Jedyna ścieżka negatywna to `null`, którą modal czyta jako „brak dopasowania" i **spada na `basePrice`, czyli i tak pokazuje cenę „od"**.
6. **Wyjścia naprzód z ekranu Eksperta.** Dziś jedyne wyjścia to telefon i `prevStep()`. D6 wymaga trzeciego: rezerwacji audytu.
7. **Testu.** Zero plików z tagiem `@REQ: B2C-TRIAGE-DISQUALIFY`.

## Zmiana kontraktu

**NIEWYMAGANA** — również po D6.

Uzasadnienie, bo to jest najczęstsze miejsce na pomyłkę przy czytaniu tego WO:

- Kryterium z rejestru brzmi: „Ekran Eksperta nie prezentuje ceny, ceny szacunkowej ani przycisku rezerwacji **z wyceną**".
- Komentarz w `contracts/triage.contract.mjs`: „Reguła spełniona ⇒ kreator nie pokazuje **ceny**".

Zakazana jest **cena**, nie **rezerwacja**. Rezerwacja bez ceny mieści się w kontrakcie. **Poprzednia wersja tego WO miała AC6 ostrzejsze niż kontrakt** — zakazywała przycisku rezerwacji jako takiego. To był nadmiar analityka, nie wymaganie; poprawiony w tej wersji.

Argument systemowy, wart zapamiętania przy kolejnych zmianach: lead w stanie `NEW_LEAD` **z definicji nie ma wyceny**. Wycena powstaje dopiero przy przejściu E2→E3 z Field App (`FNL-E2-E3`: „Utworzenie quote ustawia status_akceptacji=SENT…"). Ścieżka „bez automatycznej wyceny, od razu audyt" jest więc **normalną** drogą w lejku, a automatyczna wycena w Triage to skrót dla prostych konfiguracji. Dotychczasowy ekran Eksperta wyrzucał leada z systemu do numeru telefonu — to była strata leada, nie realizacja kontraktu.

Jedyna luka poza plikami kontraktu: `packages/contracts/package.json` nie ma `"./triage"` w mapie `exports`. Obejście: import z korzenia `@klikklima/contracts`. Pytanie otwarte nr 2.

## Mechanika D3 — gdzie zapada rozstrzygnięcie

1. **Kroki 1–5 przebiegają identycznie jak przy ścieżce kwalifikującej.** Żaden z nich nie sprawdza dyskwalifikacji i żaden nie skraca kreatora.
2. **Krok 6 (`Step6Loader`) jest miejscem rozstrzygnięcia.** Loader wyświetla się tak samo dla obu ścieżek. Po nim klient trafia albo na `Step7Success` (wycena), albo na `StepExpert`.
3. **W `TriageFunnel.renderStep()` warunek `isExpertScreen` przestaje przykrywać `switch (step)` i dotyczy WYŁĄCZNIE kroku 7 — nie „kroków ≥ 7".** Krok 8 musi renderować `Step8Booking` również na ścieżce Eksperta, inaczej D6 jest nie do zrealizowania. (Poprzednia wersja WO mówiła tu „≥ 7" — błąd, poprawiony.) Konsekwencja do pokrycia testem: `Step7Success` **nigdy się nie montuje** dla konfiguracji dyskwalifikującej, więc `getRecommendation` nie jest w ogóle wołane. Brak żądania jest twardszym dowodem niż brak ceny na ekranie.
4. **`ProgressBar.tsx` wymaga poprawki.** Dziś `progress = isExpertScreen ? 100 : …` skoczyłby na 100% już w kroku 2 (lokal komercyjny) albo 3 (4 pokoje), a `isHidden = isExpertScreen || step === 6` ukryłby „Wstecz" na całej długości kreatora dla klienta dyskwalifikowanego. Docelowo: pasek liczy się z numeru kroku przez kroki 1–5 tak samo na obu ścieżkach, a „Wstecz" jest ukryty wyłącznie w kroku 6.
5. **Ekran Eksperta zastępuje krok 7, nie kasuje historii kreatora.** Powrót wraca do ostatniego wypełnionego kroku (5 dla mieszkania, 4 dla domu i lokalu komercyjnego), z zachowanymi odpowiedziami.
6. **Wejście z karty produktu nie ma własnej mechaniki.** `TriageFunnel` ustawia `roomCount` z URL, `nextStep()` przeskakuje z kroku 1 na 4, ścieżka schodzi się w kroku 6 z każdą inną.

Otwarte pozostaje jedno: co z krokiem 3 (metraż) przy `roomCount >= próg` — pytanie otwarte nr 1. Do czasu rozstrzygnięcia obowiązuje pkt 1 (krok 3 się pokazuje).

## Mechanika D6 — ekran Eksperta jako wejście do rezerwacji

1. **Przejście `StepExpert` → `Step8Booking` jest architektonicznie trywialne i zweryfikowane.** `Step8Booking` nie przyjmuje żadnych propsów (linia 51) i czyta wyłącznie ze store'a: dane kontaktowe, adres, wybrany dzień i slot. **Nie odwołuje się do `priceDevices`, `priceInstallation`, `selectedInternalUnits`, `selectedExternalUnit` ani do żadnej kwoty** — w całym pliku nie ma wystąpienia „zł", „brutto" ani `toLocaleString`. Implementer nie ma tu czego przerabiać ani warunkować: wystarczy, że `StepExpert` przenosi na krok 8.
2. **Nawigacja wstecz działa sama.** `prevStep()` z kroku 8 daje krok 7, a `renderStep()` przy `isExpertScreen` renderuje na kroku 7 `StepExpert`. Klient wraca więc na ekran Eksperta, a nie na ekran wyceny — bez dodatkowego kodu, ale **z wymaganym testem** (AC20), bo to zachowanie wynika ze złożenia dwóch warunków i łatwo je zepsuć.
3. **Krok 8 jest wspólny dla obu ścieżek.** Nie powstaje żaden wariant formularza „dla Eksperta". Jedno miejsce rezerwacji, jedna kopia tekstu (to samo, co D7 wymusza po stronie modalu).
4. **UWAGA — korekta założenia o zakresie.** `Step8Booking` **wbrew wcześniejszemu ustaleniu nie jest dziś bezstanowy**: w linii 195 wywołuje `saveLead(leadData)`, a `saveLead` tworzy klienta, adres i leada w stanie `NEW_LEAD`. Skierowanie klienta dyskwalifikowanego na krok 8 **spowoduje więc realny zapis leada**, i to jest właśnie pożądany efekt D6 (odzyskany lead zamiast numeru telefonu). Nie zmienia to jednak granicy zakresu: **ten WO nie przerabia zapisu ani niczego w `saveLead.ts`**. Skutek uboczny wart jednego taniego testu: `estimatedQuote` w `saveLead` (linie 48–55) składa się wyłącznie z `priceDevices`/`priceInstallation`, które na ścieżce Eksperta pozostają zerami z `initialState`, więc wycena zapisana przy leadzie musi być pusta — AC21. To asercja bez zmiany kodu produkcyjnego.

### Treść ekranu Eksperta (zatwierdzona przez człowieka — wstawić dosłownie)

> **Nagłówek:** Twoja instalacja zasługuje na dokładną wycenę
>
> **Podtytuł:** Przy tej skali wolimy podać kwotę, której będziemy się trzymać.
>
> Przy instalacjach obejmujących **{próg} i więcej pomieszczeń** oraz w lokalach komercyjnych o koszcie decydują szczegóły, których nie widać przez formularz — rozmieszczenie jednostek, długość instalacji chłodniczej, przebicia przez ściany, sposób odprowadzenia skroplin.
>
> Moglibyśmy pokazać tu orientacyjną kwotę, ale wolimy tego nie robić. Zamiast tego przyjedzie inżynier, obejrzy miejsce montażu i przygotuje wycenę opartą na tym, co faktycznie zastanie.
>
> **CTA główne:** Umów bezpłatny audyt → prowadzi do `Step8Booking`
> **Pod CTA:** Audyt jest bezpłatny i niezobowiązujący.
> **Drugorzędne:** telefon (zostaje, ale przestaje być jedynym wyjściem) oraz „Wróć i zmień odpowiedzi".

- `{próg}` **musi** być interpolowane z `ROOM_COUNT_EXPERT_THRESHOLD`. Wpisanie „4" łamie AC5.
- Sformułowanie „kwotę, której będziemy się trzymać" jest świadomie mocne, bo D8 przesądza, że wycena po audycie jest wiążąca. **Nie łagodzić przy późniejszych zmianach copy.**
- Cała dzisiejsza rama znika: „Dział Komercyjny i Rozbudowane Instalacje", „Skontaktuj się z naszym ekspertem B2B", „Zadzwoń do nas, aby umówić się na bezpłatną wizję lokalną". To nie jest kosmetyka — zmienia się charakter ekranu z odprawy na alternatywną ścieżkę w lejku.

## Kryteria akceptacji (wykonalne)

AC1–AC5 odpowiadają punktom z rejestru; AC6–AC12 je uszczegóławiają; AC13–AC15 realizują D1 i D7; AC16 realizuje D2; AC18–AC21 realizują D6.

### Kreator Triage

- [ ] **AC1 (reguła `COMMERCIAL_PROPERTY`).** Przejście kreatora z wyborem „Lokal komercyjny" kończy się ekranem Eksperta i nigdy nie dociera do ekranu z rekomendacjami — niezależnie od liczby pomieszczeń (test sprawdza 1 i 3).
- [ ] **AC2 (reguła `ROOM_COUNT_AT_OR_ABOVE_THRESHOLD`).** Przejście z „Mieszkanie" oraz z „Dom" i liczbą pomieszczeń równą `ROOM_COUNT_EXPERT_THRESHOLD` kończy się ekranem Eksperta. Ta sama ścieżka z `ROOM_COUNT_EXPERT_THRESHOLD - 1` dociera do ekranu z ceną. Obie wartości test wylicza z importowanej stałej.
- [ ] **AC3 (koniunkcja).** „Lokal komercyjny" + liczba pomieszczeń ≥ progu prowadzi przez pełny kreator do **jednego** ekranu Eksperta, a `disqualifyingRules` zwraca **oba** identyfikatory reguł — test asertuje zbiór dwuelementowy, nie wartość logiczną. Dwie spełnione reguły nie dają dwóch ekranów, dwóch komunikatów ani wcześniejszego zakończenia kreatora niż jedna.
- [ ] **AC4 (kontrola negatywna).** „Mieszkanie"/„Dom" z liczbą pomieszczeń poniżej progu dociera do ekranu z rekomendacjami i widzi cenę.
- [ ] **AC5 (brak literału progu).** W `apps/b2c-web/store/**`, `apps/b2c-web/components/**`, `apps/b2c-web/app/actions/**` i w plikach testowych tego wymagania nie występuje literał `4` w roli progu — ani w warunku, ani w treści PL. Obejmuje to **nowy komunikat ekranu Eksperta**: fragment „{próg} i więcej pomieszczeń" ma być interpolowany z `ROOM_COUNT_EXPERT_THRESHOLD`. Test statyczny sprawdza pliki; test funkcjonalny sprawdza, że wyrenderowany komunikat zawiera liczbę równą wartości stałej.
- [ ] **AC6 (na ekranie Eksperta nie ma pieniędzy — ale jest rezerwacja).** Ekran Eksperta nie zawiera żadnej kwoty (wzorzec cyfry + „zł"), ani ciągów „Szacunkowy koszt", „Cena", „brutto", „Wybieram ten zestaw", „Rezerwuj termin audytu". **Zakaz dotyczy treści cenowych, nie rezerwacji** — obecność i działanie CTA rezerwacyjnego opisuje AC18 i jest wymagane, nie zakazane.
- [ ] **AC7 (odrzucenie serwerowe — liczba pomieszczeń).** Wywołanie `getRecommendation` z `roomCount >= ROOM_COUNT_EXPERT_THRESHOLD`, z pominięciem UI, zwraca odmowę wskazującą `EXPERT_SCREEN` i **nie zwraca żadnej ceny ani listy rekomendacji**. Test sprawdza brak pól cenowych, nie tylko `success === false`.
- [ ] **AC8 (odrzucenie serwerowe — typ budynku).** To samo dla `BUILDING_TYPE = 'COMMERCIAL'`. Wymaga przekazania typu budynku do warstwy serwerowej — dziś go tam nie ma. Bez tego reguła `COMMERCIAL_PROPERTY` jest egzekwowana wyłącznie w przeglądarce, czyli nie jest egzekwowana.
- [ ] **AC9 (odporność na typ z sieci).** Żądanie z `roomCount` jako łańcuch (`"5"`) jest odrzucone tak samo jak liczbowe. `disqualifyingRules` dla `GTE` wymaga `typeof v === 'number'` i dla `"5"` zwraca pustą tablicę — bez koercji Zod to gotowa furtka.
- [ ] **AC10 (wejście z karty produktu).** Wejście bezpośrednio pod `/triage?series=<seria>&roomsCount=<próg>&area_1=…` prowadzi przez pozostałe kroki kreatora (1 → 4 → 6) na ekran Eksperta, a nie na ekran wyceny.
- [ ] **AC11 (powrót z ekranu Eksperta).** „Wróć i zmień odpowiedzi" wraca do **ostatniego wypełnionego kroku kreatora** (5 dla mieszkania, 4 dla domu i lokalu komercyjnego), a nie do kroku 1, z zachowanymi odpowiedziami. Zmiana odpowiedzi dyskwalifikującej na kwalifikującą i ponowne przejście naprzód kończy się ekranem wyceny. Ekran Eksperta ma po D6 **dwa wyjścia naprzód** (rezerwacja) **i jedno wstecz** (korekta) — test sprawdza, że korekta nie prowadzi na krok 8, a rezerwacja nie prowadzi na krok 5.
- [ ] **AC12 (pasek postępu).** W krokach 1–5 pasek postępu i licznik „Krok N / 8" zachowują się identycznie dla konfiguracji dyskwalifikującej i kwalifikującej (test porównuje wskazanie w tym samym kroku na obu ścieżkach). „Wstecz" jest dostępny w krokach 2–5 również dla konfiguracji dyskwalifikującej. Na ekranie Eksperta pasek pokazuje 100%.

### Ścieżka Eksperta do rezerwacji (D6)

- [ ] **AC18 (CTA rezerwacyjne istnieje i działa).** Na ekranie Eksperta widoczny jest przycisk „Umów bezpłatny audyt", a pod nim informacja „Audyt jest bezpłatny i niezobowiązujący.". Kliknięcie przenosi na ten sam formularz rezerwacji (`Step8Booking`), co ścieżka kwalifikująca — z kalendarzem, wyborem slotu i polami kontaktowymi. Telefon pozostaje na ekranie jako wyjście drugorzędne, ale nie jest jedynym.
- [ ] **AC19 (główny scenariusz E2E — na całej drodze nie pada żadna kwota).** Konfiguracja dyskwalifikująca → pełny kreator → ekran Eksperta → „Umów bezpłatny audyt" → formularz rezerwacji z wyborem terminu. Test przechodzi tę ścieżkę w całości i **na żadnym z ekranów nie występuje kwota** (wzorzec cyfry + „zł"). To jest teraz główny scenariusz E2E tego wymagania.
- [ ] **AC20 (powrót z formularza rezerwacji).** Cofnięcie się z formularza rezerwacji na ścieżce Eksperta wraca **na ekran Eksperta**, a nie na ekran wyceny. Zachowanie wynika ze złożenia dwóch warunków (`prevStep()` z 8 na 7 plus gałąź `isExpertScreen` na kroku 7), więc wymaga jawnego testu.
- [ ] **AC21 (rezerwacja ze ścieżki Eksperta nie niesie wyceny).** Rezerwacja wykonana ze ścieżki Eksperta zbiera ten sam komplet danych co ze ścieżki kwalifikującej (imię i nazwisko, telefon, e-mail, adres, dzień, slot, zgoda), a przekazywane dalej odpowiedzi Triage **nie zawierają wyceny szacunkowej** — `priceDevices` i `priceInstallation` pozostają zerami, więc `estimatedQuote` w `saveLead` (linie 48–55) wychodzi puste. **To jest asercja, nie zmiana kodu produkcyjnego** — dzisiejsza implementacja spełnia ją z konstrukcji, a test pilnuje, żeby ktoś tego nie zepsuł, dokładając ekranowi Eksperta jakikolwiek szacunek.

### Modal urządzenia (D1, D7)

- [ ] **AC13 (brak ceny w modalu przy przekroczonym progu).** Po dodaniu `ROOM_COUNT_EXPERT_THRESHOLD` pokojów blok ceny znika w całości: nie występuje ani „Cena całkowita zestawu", ani **„Cena zaczyna się od"**, ani żadna kwota. Drugi człon jest istotny — dziś `total` spada na `basePrice` (linia 343), więc samo wyzerowanie dopasowania nadal pokazywałoby kwotę. Test sprawdza brak wzorca „zł" w modalu przy 4 i 5 pokojach oraz jego obecność przy `próg - 1` (kontrola negatywna).
- [ ] **AC14 (CTA modalu prowadzi do `/triage` — bez zmian względem dziś).** Przy liczbie pokojów ≥ progu przycisk `handleAuditClick` nadal buduje `/triage?series=…&roomsCount=N&area_i=…` i tam nawiguje. Klient przechodzi kreator i ląduje na ekranie Eksperta, skąd rezerwuje audyt (AC18). Test sprawdza, że po kliknięciu następuje nawigacja do `/triage`, a nie do żadnego osobnego ekranu kontaktowego, i że w modalu do momentu kliknięcia nie padła kwota.
- [ ] **AC15 (odrzucenie serwerowe w `getSetForConfig`).** Wywołanie z listą pokojów o długości ≥ progu, z pominięciem UI, **nie zwraca `priceNetto`, `installPrice` ani `totalPrice`** i zwraca wynik **odróżnialny od „brak dopasowania"** (dzisiejsze `null`). Odróżnialność jest wymagana, bo `null` prowadzi w modalu do fallbacku cenowego. Obowiązuje AC9: długość listy pochodzi z wejścia i musi być zwalidowana. Reguła `COMMERCIAL_PROPERTY` **nie** ma tu zastosowania — modal nie pyta o typ budynku i nie ma jak jej ocenić; to świadome ograniczenie, nie przeoczenie.

### Higiena

- [ ] **AC16 (usunięty endpoint debugowy).** `apps/b2c-web/app/api/test-rec/route.ts` nie istnieje. Test statyczny sprawdza brak pliku; `GET /api/test-rec` zwraca 404, a nie wycenę dla pięciu pomieszczeń.
- [ ] **AC17 (identyfikowalność).** Każdy plik testowy niesie znacznik `@REQ: B2C-TRIAGE-DISQUALIFY`, a `node tools/kk-trace.mjs` przestaje raportować „BRAK TESTU".

## Przypadki brzegowe, które MUSZĄ mieć test

- **Granica progu, trzy punkty:** `próg - 1` → wycena, `próg` → Ekspert, `5` → Ekspert. Operator w kontrakcie to `GTE`; najczęstsza pomyłka to `>` zamiast `>=`.
- **Wartości puste:** `roomCount === null` przy `location === 'Lokal komercyjny'` — predykat nie może rzucać wyjątkiem ani odpalać reguły `GTE`. Symetrycznie `location === null` przy `roomCount = 5`.
- **Idempotencja nawigacji:** wielokrotne „Wstecz"/„Dalej" wokół kroków 5–6–Ekspert–8 nie duplikuje ekranu, nie zeruje odpowiedzi i nie doprowadza bocznym wejściem do `Step7Success`.
- **Przejście przez krok 6 bez montowania `Step7Success`:** dla konfiguracji dyskwalifikującej nie leci żadne żądanie do Server Action wyceny. To się nie zmienia po D6 i pozostaje twardym dowodem.
- **Rezerwacja ze ścieżki Eksperta zbiera ten sam komplet danych** co ze ścieżki kwalifikującej — test porównuje zestaw wymaganych pól na obu ścieżkach, nie sprawdza tylko, że formularz się wyświetlił.
- **Cofnięcie z formularza rezerwacji na ścieżce Eksperta** wraca na ekran Eksperta, nie na ekran wyceny.
- **Ominięcie UI:** bezpośrednie wywołanie Server Action — osobny przypadek dla każdej z dwóch reguł i dla koniunkcji (`getRecommendation`); reguła liczby pomieszczeń (`getSetForConfig`).
- **Typ danych z sieci:** `roomCount` jako string, `null`, liczba ujemna, `999`; dla `getSetForConfig` — lista długości 4 i 5 oraz lista z elementami bez `size`.
- **Deep link:** `?roomsCount=4` i `?roomsCount=5` wpisane wprost w adres.
- **Kontrola negatywna dla progu:** 2 i 3 pokoje — główny przypadek biznesowy — nadal dochodzą do wyceny i w kreatorze, i w modalu.
- **Modal, kolejność zdarzeń:** dodanie czwartego pokoju **po** tym, jak cena dla trzech była już widoczna — kwota musi zniknąć, a nie zostać z poprzedniego renderu.

## Podział plików wg ról

### `test-author`

| Plik | Działanie |
|---|---|
| `apps/b2c-web/e2e/triage-disqualify.spec.ts` | **nowy** — E2E kreatora: AC1–AC4, AC6, AC10, AC11, AC12 oraz **główny scenariusz AC19** wraz z AC18, AC20, AC21. Tag `@REQ`. Próg importowany z `@klikklima/contracts`. |
| `apps/b2c-web/e2e/device-modal-disqualify.spec.ts` | **nowy** — AC13, AC14 z kontrolą negatywną dla `próg - 1`. |
| `apps/b2c-web/e2e/triage.spec.ts` | **przepisanie** — usunięcie wadliwej kombinacji (patrz TEST-DEFECT). Zostaje testem ścieżki kwalifikującej. |
| `apps/b2c-web/store/triageStore.test.ts` | **nowy** — selektor dyskwalifikacji: obie reguły osobno, koniunkcja (zbiór dwóch identyfikatorów), wartości puste, granica progu. |
| `apps/b2c-web/app/actions/getRecommendation.test.ts` | **nowy** — AC7, AC8, AC9. |
| `apps/b2c-web/app/actions/getSetForConfig.test.ts` | **nowy** — AC15, w tym odróżnialność od „brak dopasowania". |
| — | AC5 (brak literału progu, łącznie z nowym komunikatem) i AC16 (brak `app/api/test-rec/route.ts`) jako testy statyczne — dołącz do najbliższego `*.test.ts`, nie twórz osobnego pliku. |

Zakaz literału progu obowiązuje także testy (AC5).

### `implementer-ui`

| Plik | Działanie |
|---|---|
| `apps/b2c-web/store/triageStore.ts` | `isExpertScreen` liczone przez `isExpertScreen(answers)` z `@klikklima/contracts` (import z aliasem — kolizja nazw). Mapowanie etykiety PL → `BuildingTypeId` z `BUILDING_TYPE_PL`, nie przez porównanie z literałem. Wystaw też listę spełnionych reguł. |
| `apps/b2c-web/components/triage/TriageFunnel.tsx` | Warunek `isExpertScreen` dotyczy **wyłącznie kroku 7**. Krok 8 renderuje `Step8Booking` na obu ścieżkach (Mechanika D3 pkt 3, Mechanika D6 pkt 2). |
| `apps/b2c-web/components/triage/ProgressBar.tsx` | `progress` i `isHidden` odcięte od `isExpertScreen` na krokach 1–5 (AC12). |
| `apps/b2c-web/components/triage/steps/StepExpert.tsx` | **Przepisanie ekranu.** Nowa treść dosłownie wg sekcji „Treść ekranu Eksperta", z `{próg}` interpolowanym z `ROOM_COUNT_EXPERT_THRESHOLD` (AC5). Dodane CTA „Umów bezpłatny audyt" prowadzące na krok 8 (AC18) i podpis „Audyt jest bezpłatny i niezobowiązujący.". Telefon zostaje jako wyjście drugorzędne. Powrót do ostatniego wypełnionego kroku, nie do kroku 1 (AC11). Usunięta cała rama „Dział Komercyjny / ekspert B2B / Zadzwoń do nas". Zero treści cenowych (AC6). |
| `apps/b2c-web/components/ui/DeviceModal.tsx` | **D1 bez zmian:** przy `rooms.length >= ROOM_COUNT_EXPERT_THRESHOLD` blok ceny z linii 538–553 znika w całości, łącznie z gałęzią „Cena zaczyna się od" i fallbackiem `total → basePrice` (linia 343); `getSetForConfig` (linia 297) nie jest wołane dla takiej konfiguracji. **D7: `handleAuditClick` (linia 326) i przycisk z linii 637 zostają bez zmian** — nadal budują `/triage?series=…&roomsCount=N` i tam nawigują. Warunek liczony predykatem kontraktu na `{ ROOM_COUNT: rooms.length }`, nie porównaniem z literałem. |
| `apps/b2c-web/components/triage/steps/Step8Booking.tsx` | **Bez zmian.** Komponent nie przyjmuje propsów, nie renderuje kwot i nie zależy od wybranego urządzenia — działa na ścieżce Eksperta bez modyfikacji. Wpisany tu wyłącznie po to, żeby nikt go „na wszelki wypadek" nie warunkował. |

Nie ruszamy: migracji store'a na identyfikatory kontraktu (→ `B2C-LEAD-ENTRY`) ani `maxSupportedRooms` w modalu.

### `implementer-server`

| Plik | Działanie |
|---|---|
| `apps/b2c-web/app/actions/getRecommendation.ts` | Walidacja wejścia schematem Zod (koercja `roomCount`, enum `BUILDING_TYPE`), następnie `isExpertScreen(answers)`; przy trafieniu odmowa domenowa wskazująca `EXPERT_SCREEN`, **przed** jakimkolwiek zapytaniem do bazy i bez pól cenowych (AC7, AC8, AC9). Sygnatura rozszerzona o typ budynku. |
| `apps/b2c-web/app/actions/getSetForConfig.ts` | Ta sama walidacja dla `rooms.length` (AC15). Wynik dyskwalifikacji **odróżnialny od `null`**. Reguła `COMMERCIAL_PROPERTY` nieoceniana — brak typu budynku na wejściu. |
| `apps/b2c-web/components/triage/steps/Step7Success.tsx` | Wywołanie dostosowane do nowej sygnatury `getRecommendation`. Jedyna zmiana w tym pliku. |
| `apps/b2c-web/app/api/test-rec/route.ts` | **Usunąć plik** (D2, AC16). |
| `apps/b2c-web/app/actions/saveLead.ts` | **NIE DOTYKAĆ.** Należy do `B2C-LEAD-ENTRY`; dodatkowo operuje na porzuconych nazwach, które zablokuje `guard-forbidden` — patrz „Ryzyka". |

**Nowy route handler nie jest potrzebny.** ADR-001 dopuszcza Route Handlery wyłącznie dla publicznych webhooków, a obie istniejące Server Actions wystarczają jako punkty egzekucji.

### Kolejność

Najpierw `implementer-server` (sygnatury i odróżnialny wynik dyskwalifikacji), potem `implementer-ui` — inaczej UI będzie wołać funkcje o nieustalonym kontrakcie wywołania.

## TEST-DEFECT: `apps/b2c-web/e2e/triage.spec.ts`

**Wadliwa dana wejściowa — linia 7:**

```ts
{ location: 'Lokal komercyjny', rooms: 1, sizes: ['Powyżej 35 m²'], state: 'W trakcie remontu' }
```

**Wadliwe asercje — linie 59, 64, 65**, wykonywane dla tej kombinacji:

```ts
await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).toBeVisible(…);
await expect(page.locator('text=Szacunkowy koszt inwestycji')).toBeVisible();
await expect(page.locator('text="Rezerwuj termin audytu"')).toBeVisible();
```

**Dlaczego to defekt, a nie wymaganie:** `DISQUALIFICATION_RULES[0]` (`COMMERCIAL_PROPERTY`, `outcome: EXPERT_SCREEN`, `status: STABLE`) i komentarz kontraktu („Reguła spełniona ⇒ kreator nie pokazuje ceny") zabraniają pokazania ceny dla lokalu komercyjnego. Test oczekuje szacunkowego kosztu i przycisku rezerwacji **z wyceną** dla konfiguracji, której kontrakt zabrania wyceniać.

Uwaga na niuans po D6: defektem jest oczekiwanie **ceny**, nie oczekiwanie **rezerwacji**. Rezerwacja na tej ścieżce jest po D6 wymagana — tyle że pod inną nazwą („Umów bezpłatny audyt") i bez żadnej kwoty obok.

**Dodatkowo:** przypadek jest dziś czerwony (`test-results/.last-run.json`: `"status": "failed"`). Po kliknięciu „Lokal komercyjny" pojawia się `StepExpert`, więc kliknięcie „1 pomieszczenie" nie ma czego znaleźć. Zielona wersja tego testu nigdy nie istniała.

**Rozstrzygnięcie:** kombinacja z linii 7 przenosi się do `triage-disqualify.spec.ts` z asercjami wg AC19. W `triage.spec.ts` zostają wyłącznie kombinacje kwalifikujące. **Kod nie jest naginany do oczekiwań tego testu.**

## Poza zakresem

- **Utrwalanie leada w bazie.** `Step8Booking` wywołuje `saveLead` i po D6 zrobi to również na ścieżce Eksperta, ale **ten WO nie przerabia zapisu, nie zmienia `saveLead.ts` i nie odpowiada za komplet danych ani atomowość** → `B2C-LEAD-ENTRY`, `B2C-LEAD-ATOMIC`. Tutaj chodzi wyłącznie o to, że ekran Eksperta prowadzi do tego samego formularza rezerwacji co ścieżka kwalifikująca. Jedyny wyjątek: AC21 jest asercją bez zmiany kodu produkcyjnego.
- Walidacja formularza rezerwacji, RHF + Zod → `B2C-BOOKING-VALIDATION`. Atomowość slotu → `B2C-BOOKING-SLOT`.
- Migracja store'a i `leads.triage_answers` na identyfikatory kontraktu → `B2C-LEAD-ENTRY`.
- Renderowanie kafelków kroku 1 i 4 ze słowników zamiast z literałów JSX → `B2C-TRIAGE-STEPS`.
- Pomijanie pytań warunkowych i cofanie z kroku 4 do 1 → `B2C-TRIAGE-CONDITIONAL`.
- Sposób wyliczania ceny, VAT, „cena od" → `B2C-PRICE-FROM`.
- Dług migracyjny wartości `RENOVATION` w enumie bazy — osobne okno kontraktowe.
- Martwy katalog `apps/b2c-web/tests/` — sprzątanie osobno.
- Aktualizacja `docs/prompts/figma_triage_ui_prompt.md` (pkt 1 i 2 nieaktualne po D3 i D6) → `doc-scribe`.
- `maxSupportedRooms` w modalu — D1 mówi, czego modal nie pokazuje po przekroczeniu progu, nie że odbieramy klientowi możliwość skonfigurowania większej instalacji.
- **Kandydat na regułę walidatora przy najbliższym oknie kontraktowym:** `DISQUALIFICATION_RULES[1].pl` ma wpisane słownie „Od **czterech** pomieszczeń…", obok osobnej stałej `ROOM_COUNT_EXPERT_THRESHOLD = 4`. Zmiana progu zostawi w kontrakcie zdanie, które kłamie, a walidator tego nie łapie. Ten sam mechanizm co AC5, tylko wycelowany w sam kontrakt.

## Ryzyka i nieznane

1. **`transpilePackages`.** `apps/b2c-web/next.config.ts` jest pusty, a `@klikklima/contracts` eksportuje surowy TypeScript (`main: ./src/generated/index.ts`). Żadna aplikacja nie importuje go jeszcze, więc nie wiadomo, czy build Next.js zniesie to bez `transpilePackages: ['@klikklima/contracts']`. Vitest ma własny alias i zadziała, więc **test jednostkowy może przejść, a `next build` paść**. Sprawdzić budowaniem przed pierwszą iteracją.
2. **Kolizja nazw.** Store eksportuje własne `isExpertScreen`, kontrakt eksportuje funkcję o tej samej nazwie.
3. **Fallback cenowy w modalu.** `total = isFullyConfigured && matchedSet ? … : (basePrice || 0)` (linia 343) sprawia, że każda ścieżka negatywna w `getSetForConfig` kończy się pokazaniem ceny „od". Pułapka przy implementacji AC15 przez `return null`.
4. **Krok 6 jako atrapa.** `Step6Loader` odlicza 4,8 s i nic więcej. Przeniesienie rozstrzygnięcia „do kroku 6" nie oznacza dodania tam wywołania serwerowego — decyzja zapada na danych, które store ma już w komplecie. Dołożenie tam żądania złamie AC o braku wywołania `getRecommendation`.
5. **`Step5Conditions` sam wywołuje `nextStep()`** w `useEffect`, gdy `location !== 'Mieszkanie'`. Krok 5 realnie nie istnieje dla domu i lokalu komercyjnego — ma to znaczenie dla AC11 i AC12.
6. **`saveLead.ts` jest zaminowany dla edycji.** Operuje na porzuconych nazwach (`klienci`, `adresy`, `leady`, `estymowana_wycena`), które hook `guard-forbidden` blokuje przy zapisie pliku. Ktokolwiek spróbuje „przy okazji" poprawić tam cokolwiek, dostanie `exit 2` i spali iterację. W tym WO ten plik jest tylko czytany.
7. **D6 zwiększa liczbę leadów wchodzących do lejka.** Konfiguracje dziś kończące się numerem telefonu zaczną tworzyć rekordy z rezerwacją terminu. To zamierzony efekt, ale wpływa na obłożenie kalendarza audytów — warto, żeby ktoś po stronie operacji o tym wiedział, zanim zmiana trafi na produkcję.
8. **Brak sprzeczności między dokumentami źródłowymi.** Kontrakt, `CONTRACTS.md` (wiersze 118–119) i rejestr mówią to samo. `figma_triage_ui_prompt.md` rozjeżdża się z D3 i D6, ale to skutek świadomych decyzji człowieka, nie sprzeczność do rozstrzygnięcia.

## Pytania otwarte

**Brak.** Oba wcześniejsze pytania zostały rozstrzygnięte przez człowieka jako D4 (krok 3 pokazuje się przy przekroczonym progu) i D5 (`exports` uzupełnione o `"./triage"`) — patrz tabela decyzji. Uzasadnienie D4 wzmocniło się po D6: metraże 4–5 pomieszczeń to teraz realny kontekst dla inżyniera jadącego na audyt, a nie dane wyrzucane do kosza.
