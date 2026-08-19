# spec-analyst — notatki o repo (wzorce odkryte przy pracy nad Work Orderami)

> Hook `guard-paths` blokuje spec-analyście zapis do `.claude/agent-memory/`.
> Zakres zapisu roli: `.claude/state/`, `docs/workorders/`. Notatki trwałe trzymam więc tutaj.

## Decyzje człowieka utrwalone w Work Orderach (nie w kontraktach)

Część rozstrzygnięć nie trafia do `contracts/` ani do ADR — żyje wyłącznie w Work Orderze.
Przy pisaniu kolejnych WO dla B2C sprawdź `docs/workorders/`, zanim powołasz się na `docs/prompts/`.

- **2026-08-19, B2C-TRIAGE-DISQUALIFY:** ekran Eksperta pojawia się DOPIERO po zebraniu wszystkich
  odpowiedzi kreatora (rozstrzygnięcie w kroku 6), a nie natychmiast po kroku dyskwalifikującym.
  To odwrotność stanu kodu i odwrotność `docs/prompts/figma_triage_ui_prompt.md` pkt 1–2 —
  **ten prompt jest w tym punkcie nieaktualny.**
- **2026-08-19:** blokada dyskwalifikacji obejmuje też `DeviceModal` (`getSetForConfig`), nie tylko Triage.
  Uwaga: modal nie pyta o typ budynku, więc ocenialna jest tam wyłącznie reguła liczby pomieszczeń.
- **2026-08-19:** ekran Eksperta NIE jest końcem ścieżki — prowadzi do tego samego formularza rezerwacji
  audytu co ścieżka kwalifikująca. Kontrakt zakazuje CENY, nie REZERWACJI („przycisku rezerwacji **z wyceną**").
  Uzasadnienie systemowe: lead w `NEW_LEAD` z definicji nie ma wyceny (powstaje dopiero przy `FNL-E2-E3`),
  więc „bez wyceny, od razu audyt" to normalna droga w lejku, a wycena w Triage to skrót dla prostych konfiguracji.
- **2026-08-19:** wycena po audycie jest wiążąca (decyzja biznesowa) — uzasadnia mocne copy na ekranie Eksperta.

## Pułapka: czytanie kryteriów akceptacji ostrzej niż kontrakt

Przy B2C-TRIAGE-DISQUALIFY napisałem AC zakazujące „przycisku rezerwacji", podczas gdy rejestr zakazywał
„przycisku rezerwacji **z wyceną**". Człowiek to wyłapał. Kwalifikator w kryterium akceptacji jest treścią,
nie ozdobnikiem — cytuj kryterium dosłownie i sprawdzaj, na co dokładnie pada zakaz, zanim przełożysz je na AC.

## Miny w kodzie B2C

- `apps/b2c-web/app/actions/saveLead.ts` operuje na porzuconych nazwach (`klienci`, `adresy`, `leady`,
  `estymowana_wycena`). `guard-forbidden` zablokuje każdy zapis do tego pliku (`exit 2`). Plik należy
  do zakresu `B2C-LEAD-ENTRY`; w innych WO oznaczaj go jawnie jako „tylko do odczytu".
- `Step8Booking.tsx` mimo pozorów NIE jest bezstanowy — woła `saveLead` (linia 195). Nie zakładaj,
  że skierowanie tam użytkownika nie ma skutków w bazie.
- `DeviceModal.tsx` ma fallback `total → basePrice` (linia 343): każda ścieżka negatywna kończy się
  pokazaniem ceny „od". Zwrócenie `null` z akcji NIE ukrywa ceny.

## Testy, które nic nie chronią (stan 2026-08-19, WO B2C-TRIAGE-DISQUALIFY)

- `apps/b2c-web/tests/` leży poza `testDir` Playwrighta (`./e2e`) i poza `include` vitesta (`**/*.test.ts`).
  Nic stamtąd nie jest uruchamiane; `tests/e2e/scenarios/triage.spec.ts` to zakomentowane placeholdery.
- Pliki `test-*.ts` / `test_*.js` w korzeniu `apps/b2c-web` to skrypty diagnostyczne, nie testy.
- `apps/b2c-web/app/api/test-rec/route.ts` — publiczny route handler debugowy wołający Server Action wyceny
  z twardą konfiguracją 5 pokojów. Gotowa ścieżka obejścia UI.
- `kk-trace` liczy wyłącznie pliki ze znacznikiem `@REQ:`. Obecność `.spec.ts` nie znaczy nic.
- Rejestr wymagań sam wskazuje testy sprzeczne z kontraktem — takie zgłaszam jako `TEST-DEFECT`
  z cytatem reguły kontraktu, nigdy jako wymaganie do zaimplementowania.

## Konsumpcja `@klikklima/contracts` przez aplikacje (stan 2026-08-19)

Pakiet jest w `dependencies` obu aplikacji, ale **żaden plik w `apps/` go nie importuje**.
Pierwszy Work Order, który tego wymaga, płaci koszt uruchomienia ścieżki importu. Pułapki:

1. Pakiet eksportuje surowy TypeScript (`main: ./src/generated/index.ts`), a `apps/b2c-web/next.config.ts`
   jest pusty — prawdopodobnie potrzebne `transpilePackages`. Vitest ma własny alias, więc
   **test jednostkowy potrafi przejść, gdy `next build` pada**. To zjada iterację GREEN.
2. Mapa `exports` w `packages/contracts/package.json` nie zawiera wszystkich podścieżek (brak `./triage`).
   Import z korzenia `@klikklima/contracts` działa, bo `index.ts` re-eksportuje wszystko.
3. Nazwy funkcji z kontraktu kolidują z lokalnymi selektorami (np. `isExpertScreen` w kontrakcie
   i w `apps/b2c-web/store/triageStore.ts`).

`packages/contracts/package.json` NIE jest plikiem chronionym (chronione: `contracts/`,
`packages/contracts/src/generated/`), więc jego poprawka nie wymaga okna kontraktowego.

## Gdzie mieszka logika B2C

- Server Actions B2C: `apps/b2c-web/app/actions/*.ts` (`'use server'` na górze pliku, bez katalogu per-domena).
- Kreator Triage: `apps/b2c-web/components/triage/` — `TriageFunnel.tsx` renderuje krok przez `switch (step)`,
  stan w zustandzie `apps/b2c-web/store/triageStore.ts`.
- Store trzyma odpowiedzi jako **polskie etykiety** (`location: 'Lokal komercyjny'`), a nie identyfikatory
  kontraktu. Most PL → ID buduje się z `BUILDING_TYPE_PL` w `packages/contracts/src/generated/triage.ts`.
  Pełna migracja store'a na identyfikatory należy do `B2C-LEAD-ENTRY`.
