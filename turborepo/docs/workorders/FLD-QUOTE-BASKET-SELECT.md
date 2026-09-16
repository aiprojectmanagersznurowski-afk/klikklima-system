# WO: FLD-QUOTE-BASKET-SELECT — wybór koszyka czasu trwania przy tworzeniu rezerwacji

**Status Work Ordera: WSTRZYMANY — WYMAGA DECYZJI CZŁOWIEKA (patrz sekcja „Sprzeczności").**
Sekcje „Kontekst kodu", „Kryteria akceptacji" i „Przypadki brzegowe" są kompletne i gotowe do
przekazania test-authorowi **natychmiast po** rozstrzygnięciu D-1 i D-2. Dopóki nie ma decyzji,
nie da się wskazać jednej ścieżki pliku komponentu, bo ekran, o którym mówi wymaganie, nie ma
dziś gospodarza w repozytorium.

## Wymagania

- `FLD-QUOTE-BASKET-SELECT` (status `TODO`, 4 kryteria) — wpis WYNIESIONY 2026-09-15 z
  `CAL-VISIT-DURATION-BASKETS` AC2 (okno `CAL-SCHEDULING-CONFIG-CLOSE`).
- Zależności domknięte, których to wymaganie jest konsumentem: `CAL-VISIT-DURATION-BASKETS`
  (`DONE` — słownik, nośnik, wyzwalacz puli), `CAL-TRAVEL-BUFFER` (`DONE`),
  `CAL-SLOT-ENGINE` (`DONE`), `FLD-BOOKING-ATOMIC-ASSIGN` (warstwa domenowa `createBooking`).

## Kontekst kodu (stan sprawdzony 2026-09-15, nie przepisany z rejestru)

### Istnieje

- `packages/database/prisma/schema.prisma:854` — `model VisitDurationBasket`
  (`code`, `labelPl`, `durationMinutes`, `pool`, `isActive`, `sortOrder`). Kolumna
  `bookings.visit_basket_id` (UUID, `onDelete: Restrict`) istnieje, wyzwalacz
  `bookings_pool_matches_basket_trg` żyje na produkcji.
- `supabase/migrations/20260910100000_fld_calendar_foundation.sql:128-136` — 7 wierszy słownika.
  Pula `AUDITOR`: wyłącznie `AUDIT`. Pula `CREW`: `SERVICE`, `INCIDENT`, `INSTALL_SMALL`,
  `INSTALL_STANDARD`, `INSTALL_PHASE_1`, `INSTALL_PHASE_2`.
- `packages/scheduling/src/create-booking.ts` — `createBooking(params)` przyjmuje
  `visitBasketId: string` (linia 39) i **wyprowadza z koszyka wszystko pozostałe**:
  - linia 253: `prisma.visitDurationBasket.findUnique` → 256 `BASKET_NOT_FOUND`,
    259 `BASKET_INACTIVE` (koszyk wycofany jest odrzucany po stronie serwera),
  - linia 271: `resourceKind = basket.pool === "CREW" ? "CREW" : "AUDITOR"` — **pula wizyty
    jest funkcją koszyka**, nie osobnym parametrem wejściowym,
  - linia 294: `scheduledEnd = startAt + basket.durationMinutes` — czas trwania NIE jest
    przepisywany do rezerwacji jako liczba, tylko wyliczany z koszyka,
  - linia 300: zapis `visitBasketId` identyfikatorem,
  - linia 318: odwzorowanie naruszenia wyzwalacza na `POOL_MISMATCH`.
  Wniosek: **backend jest gotowy w 100%, nie wymaga ani jednej linii zmiany.**
- `apps/b2b-web/src/app/(dashboard)/bookings/actions.ts` — `createBookingAction`, bramka
  `can(actorRole, "bookings", "create")`, schemat Zod z `visitBasketId: z.string().min(1)`.
  **Jedyne wystąpienie `visitBasketId` w `apps/b2b-web/src` — i jest to kod serwerowy.**
- `apps/b2c-web/app/actions/saveLead.ts:92-110` — jedyny działający KONSUMENT dziś: rozwiązuje
  koszyk `code: 'AUDIT', isActive: true` → UUID **po stronie serwera**, klient B2C nie przysyła
  ani koszyka, ani `bookedBy` (świadoma decyzja D-3 tamtego WO). To nie jest ekran wyboru
  koszyka i nie ma nim się stać — B2C zawsze rezerwuje audyt.
- `apps/b2b-web/src/app/(dashboard)/settings/calendar/` — ekran KONFIGURACJI słownika
  (poprzednia tura `implementer-ui`): `page.tsx` (odczyt `visitDurationBasket.findMany`,
  bramka `can(..., "visit_duration_baskets", "read")`), `CalendarSettingsClient.tsx`,
  `actions.ts` (`updateVisitDurationBasketAction`).
- `apps/b2b-web/src/lib/schedule/scheduling-config-schema.ts` — schematy Zod współdzielone
  przez klienta i Server Action tamtego ekranu.

### Brakuje

- **Jakiegokolwiek interfejsu tworzenia rezerwacji w panelu B2B.** Katalog
  `apps/b2b-web/src/app/(dashboard)/bookings/` zawiera **wyłącznie `actions.ts`** — zero
  `page.tsx`, zero komponentów. `createBookingAction` **nie ma ani jednego wywołania w kodzie
  produkcyjnym** — woła ją wyłącznie `apps/b2b-web/tests/create-booking.test.ts`. W nawigacji
  (`apps/b2b-web/src/app/(dashboard)/layout.tsx:87`) jest tylko pozycja `/settings/calendar`.
- Ekranu wyceny audytora — w żadnej aplikacji. `apps/` zawiera dokładnie `b2b-web` i `b2c-web`.
  Field App jako aplikacja nie istnieje.
- Dlatego **nie ma formularza do rozszerzenia**: nie ma ani zaszytego literału czasu trwania,
  ani ukrytego pola z wartością domyślną, ani niedokończonego formularza. Jest pusto.
  To zadanie „zbuduj konsumenta", nie „dodaj pole do istniejącego formularza".
- Jedyne dzisiejsze ścieżki przypisania w kontekście leada —
  `apps/b2b-web/src/app/(dashboard)/leads/[id]/assign-auditor.tsx` (ustawia
  `leady.audytor_id` przez `updateLeadAuditor`) i
  `apps/b2b-web/src/app/(dashboard)/leads/assign-crew-dialog.tsx` (`assignCrewToLead`) —
  **nie tworzą rezerwacji** i nie dotykają `bookings`. `leady.data_rezerwacji` jest w panelu
  wyłącznie WYŚWIETLANE (`leads/[id]/page.tsx:148`), zapisywane wyłącznie przez B2C.

## Sprzeczności i decyzje blokujące

### D-1 `[BLOKUJE]` — w której aplikacji powstaje „ekran wyceny"?

Wymaganie mówi o audytorze przy wycenie, a taki ekran należy do Field App:

> `docs/architecture/FIELD-APP-PLAN.md` 6.4: „Koszyk to nie tylko wartość domyślna, ale
> **słownik, z którego audytor wybiera** przy wycenie — nie wpisuje »6,5 godziny« z palca."

Field App nie istnieje jako aplikacja, a jej warstwa zapisu jest nierozstrzygnięta:

> `FIELD-APP-PLAN.md` sekcja A1 („Server Actions nie istnieją w React Native
> `[NAJWAŻNIEJSZA DECYZJA]`"): „**żadna dzisiejsza ścieżka zapisu nie jest osiągalna z Field
> App**. […] **Rekomendacja: (b), z formalnym aneksem ADR-013 do ADR-001.**"

ADR-013 nie został wydany. Do rozstrzygnięcia są trzy warianty:

- **(A)** Ekran powstaje w panelu B2B jako formularz tworzenia rezerwacji dla dyspozytora/admina
  — wymaganie zostaje dostarczone dla ról panelowych, a ścieżka audytora w Field App zostaje
  dodatkowo pokryta później, tym samym słownikiem. Dostarczalne dzisiaj.
- **(B)** Wymaganie czeka na ADR-013 i Field App → status `BLOCKED`, ten WO zamyka się bez
  implementacji.
- **(C)** Podział na dwa wpisy (wzorzec już użyty dwukrotnie w rejestrze): część panelowa teraz,
  część Field App po ADR-013.

**Nie wybieram sam.** Wariant (A) cicho zmienia aktora wymagania z audytora na dyspozytora, a to
jest zmiana treści wymagania, nie szczegół implementacyjny.

### D-2 `[BLOKUJE, jeśli D-1 = (A) lub (C)]` — audytor nie ma prawa tworzyć rezerwacji

> `contracts/rbac.contract.mjs:64`:
> `{ resource: 'bookings', read: ['admin','dyspozytor','audytor:own','monter:own'],`
> `create: ['admin','dyspozytor'], … }`

`createBookingAction` odmawia audytorowi **przed** jakimkolwiek zapytaniem do bazy. Zdanie
wymagania („Audytor przy wycenie WYBIERA koszyk") jest więc dziś **niewykonalne w panelu B2B
bez zmiany kontraktu RBAC** (okno kontraktowe + `contract-steward`). Warianty:

- **(a)** Ekran panelowy jest dla `admin`/`dyspozytor` — RBAC bez zmian, brzmienie wymagania
  wymaga korekty („osoba tworząca rezerwację", nie „audytor").
- **(b)** `audytor` dostaje `bookings.create` (ewentualnie `audytor:own` — tylko dla leada,
  do którego jest przypisany) — zmiana `contracts/rbac.contract.mjs`, osobne okno, osobny
  komplet testów autoryzacyjnych.

Wariant (b) ma nietrywialny skutek uboczny: `audytor:own` na `create` nie jest dziś wyrażalny
tak samo jak na `read` (nie ma jeszcze rekordu, na którym liczy się „own"), więc trzeba by
zdefiniować, co „own" znaczy w momencie tworzenia. To decyzja stewarda, nie analityka.

## Zmiana kontraktu

- **`contracts/` — NIEWYMAGANA dla wariantu D-2(a).** Słownik, kolumna `bookings.visit_basket_id`,
  wyzwalacz puli i `createBooking` istnieją i są domknięte. Nie powstaje żadna nowa tabela,
  kolumna, migracja ani przejście lejka.
- **`contracts/rbac.contract.mjs` — WYMAGANA wyłącznie dla wariantu D-2(b)** (dopisanie
  `audytor` do `bookings.create`). Nie da się bez niej, bo bramka `can()` odmawia audytorowi
  przed zapytaniem do bazy, a Prisma omija RLS — obejście przez UI byłoby podatnością.
- `schema.prisma`, `supabase/migrations/` — **NIEWYMAGANE w żadnym wariancie**.

## Kształt zmiany (dla wariantu D-1 = (A)/(C), D-2 = (a))

Ścieżki plików, które powstaną — **do potwierdzenia po decyzji**, ale to jest jedyny wariant
zgodny z dzisiejszą strukturą:

- `apps/b2b-web/src/app/(dashboard)/leads/[id]/create-booking-dialog.tsx` — **nowy** komponent
  kliencki (`"use client"`), dialog uruchamiany z karty leada, wzorzec `assign-crew-dialog.tsx`
  (`Dialog` z `@/components/ui/dialog`, `useTransition`, ikony wyłącznie `lucide-react`).
  To jest miejsce, w którym pojawia się pole „Koszyk wizyty".
- `apps/b2b-web/src/app/(dashboard)/leads/[id]/page.tsx` — Server Component: odczyt aktywnych
  koszyków (`prisma.visitDurationBasket.findMany`) i przekazanie ich propsem. **Bez
  `useEffect`/SWR** (ADR-001).
- **Server Action: NIE powstaje nowa.** `createBookingAction`
  (`apps/b2b-web/src/app/(dashboard)/bookings/actions.ts`) przyjmuje już `visitBasketId`,
  `startAt`, `subject`, `bookedBy` i ma bramkę RBAC. Komponent ma ją wołać
  z `bookedBy: "DISPATCHER"`. Jedyna dopuszczalna zmiana w `actions.ts` to ewentualne
  `revalidatePath` po sukcesie — nie zmiana schematu Zod.
- **Pula koszyków do pokazania wynika z przedmiotu wizyty, nie z osobnego pola.** Formularz
  zna `subject` (`LEAD` / `SERVICE` / `INCIDENT`) z kontekstu ekranu. Mapowanie na pulę
  wymaga potwierdzenia dla `LEAD` (patrz Ryzyka R-1); `SERVICE` i `INCIDENT` to jednoznacznie
  `CREW` (seed migracji).
- **Współdzielenie z ekranem `/settings/calendar`:** to inny ekran (tam admin KONFIGURUJE
  słownik, tu użytkownik GO UŻYWA) i nie ma między nimi konfliktu edycyjnego. Są jednak dwa
  realne kandydaty do wspólnego kodu, dziś lokalne w
  `settings/calendar/CalendarSettingsClient.tsx`:
  - typ `CalendarSettingsBasket` (linia 31) — ten sam kształt wiersza koszyka,
  - `POOL_LABELS` (linia 47, `AUDITOR: "Audytor"`, `CREW: "Ekipa"`).
  Rekomendacja: przenieść oba do `apps/b2b-web/src/lib/schedule/` (tam już mieszka
  `scheduling-config-schema.ts`) zamiast kopiować. Duplikat `POOL_LABELS` w dwóch ekranach to
  ta sama klasa błędu co literał etykiety, tylko rozproszona.

## Kryteria akceptacji (wykonalne)

- [ ] **AC1** (REQ AC1) — Na ekranie tworzenia rezerwacji użytkownik wybiera koszyk z listy
      i **nie ma żadnej kontrolki pozwalającej podać liczbę godzin ani minut**: test statyczny
      na treści komponentu nie znajduje pola liczbowego czasu trwania (`type="number"` powiązany
      z minutami/godzinami, `durationMinutes` jako pole formularza), a wysyłany payload
      `createBookingAction` zawiera `visitBasketId` i **nie zawiera** klucza czasu trwania.
- [ ] **AC2** (REQ AC1) — Koszyk z `isActive = false` **nie pojawia się** na liście wyboru dla
      nowej rezerwacji, przy niezmienionym zbiorze pozostałych pozycji.
- [ ] **AC3** (REQ AC1) — Rezerwacja historyczna wskazująca koszyk WYCOFANY wyświetla jego
      etykietę poprawnie (nie „—", nie identyfikator, nie pustka). Widok szczegółu czyta
      koszyk po `visit_basket_id`, nie z listy aktywnych.
- [ ] **AC4** (REQ AC2) — Wybór koszyka trafia do akcji jako **identyfikator wiersza**: payload
      zawiera UUID z `visit_duration_baskets.id`, a **nie** `code`, `labelPl` ani liczbę minut.
      Test asertuje, że w payloadzie nie występuje żaden klucz o wartości równej liczbie minut
      wybranego koszyka.
- [ ] **AC5** (REQ AC3) — Etykieta i czas trwania na liście pochodzą ze słownika w chwili
      renderowania: po zmianie `durationMinutes` koszyka w danych wejściowych ekran pokazuje
      NOWĄ wartość bez zmiany kodu. Test używa wartości arbitralnej (np. 137), nie 120/240/480,
      żeby literał nie mógł przypadkiem przejść.
- [ ] **AC6** (REQ AC3) — Żaden literał etykiety ani czasu trwania koszyka nie występuje w
      komponencie: test statyczny na treści pliku nie znajduje `"Audyt"`, `"(2 h)"`, `120`,
      `240`, `480` w kontekście listy koszyków.
- [ ] **AC7** (REQ AC4) — Dla wizyty audytora lista zawiera **wyłącznie** koszyki `pool = AUDITOR`;
      dla wizyty ekipy **wyłącznie** `pool = CREW`. Test dostaje komplet 7 koszyków i sprawdza
      zbiór pozycji renderowanych w obu kontekstach.
- [ ] **AC8** (REQ AC4) — Ekran **nie doprowadza** do `POOL_MISMATCH`: w scenariuszu, w którym
      użytkownik przechodzi przez interfejs bez manipulacji żądaniem, `createBookingAction`
      nigdy nie zwraca `POOL_MISMATCH`. Jednocześnie ręcznie spreparowane wywołanie akcji
      z koszykiem z niewłaściwej puli **nadal jest odrzucane po stronie serwera** — interfejs
      jest wygodą, nie granicą (Prisma omija RLS).
- [ ] **AC9** (bramka RBAC, wariant D-2(a)) — Rola bez `bookings.create` nie dostaje ekranu ani
      przycisku, a wywołanie akcji z pominięciem interfejsu zwraca `FORBIDDEN` **przed**
      jakimkolwiek zapytaniem do bazy (wzorzec `create-booking.test.ts`, AC-A12).

## Przypadki brzegowe, które MUSZĄ mieć test

1. **Koszyk wycofany między renderem a kliknięciem** — lista wyrenderowana z aktywnym koszykiem,
   administrator wycofuje go na `/settings/calendar`, użytkownik klika „Rezerwuj". Oczekiwane:
   `BASKET_INACTIVE` z serwera (`create-booking.ts:259`) i **czytelny komunikat po polsku**,
   nigdy cichy zapis. To jest dokładnie ten sam wyścig, który `assign-crew-dialog.tsx` obsługuje
   dla wygasającego certyfikatu — wzorzec istnieje.
2. **Koszyk skasowany/nieistniejący identyfikator** — `BASKET_NOT_FOUND`, komunikat, brak
   rezerwacji.
3. **Pusta lista koszyków w puli** (wszystkie wycofane) — formularz **nie może** wysłać
   rezerwacji bez koszyka ani podstawić żadnej wartości domyślnej; oczekiwany stan pusty
   z komunikatem. Uwaga: `updateVisitDurationBasketAction` broni ostatniego aktywnego koszyka
   w puli (`LastActiveBasketError`), więc ten stan jest dziś nieosiągalny przez panel — test
   ma to udokumentować, a nie zakładać, że jest niemożliwy.
4. **Podwójne kliknięcie „Rezerwuj"** — jedno wywołanie akcji, jedna rezerwacja. Rezerwacja
   slotu to problem współbieżności (pułapka 4 z CLAUDE.md); ostatecznym strażnikiem jest
   `bookings_no_overlap_per_resource`, ale interfejs nie może generować drugiego żądania.
5. **Slot zajęty między wyborem terminu a potwierdzeniem** — wynik `createBooking` z propozycją
   alternatyw (`alternatives`) musi być pokazany, nie połknięty.
6. **Strefa czasowa** — `startAt` wysyłane jako moment (UTC/ISO), nie jako „ścięta" data lokalna.
   `scheduledEnd` liczy serwer z `durationMinutes` — interfejs **nie może** wyliczać i wysyłać
   godziny końca. Test: wizyta przez granicę zmiany czasu nie przesuwa się o godzinę.
7. **Zmiana `durationMinutes` koszyka po utworzeniu rezerwacji** — rezerwacja już zawarta
   NIE zmienia `scheduled_end` (`CAL-VISIT-DURATION-BASKETS` AC3). Kontrola negatywna: ekran
   rezerwacji nie wykonuje żadnego `booking.update`.
8. **Uprawnienia** — `monter` i `audytor` (przy D-2(a)) nie widzą przycisku ORAZ dostają
   `FORBIDDEN` przy bezpośrednim wywołaniu akcji.
9. **Próba przemycenia dodatkowych pól** — żądanie z `durationMinutes`, `scheduledEnd`,
   `resourceId`, `pool` obok `visitBasketId`: pola są ignorowane (schemat Zod w `actions.ts`
   ich nie zna), rezerwacja powstaje z wartości wyliczonych z koszyka.

## Poza zakresem

- Field App jako aplikacja, ADR-013, warstwa API dla React Native — osobna decyzja (D-1).
- Zmiana `packages/scheduling/src/create-booking.ts` — backend jest gotowy, jego dotknięcie
  w tym zadaniu jest sygnałem, że zakres się rozlał.
- Ekran `/settings/calendar` i `updateVisitDurationBasketAction` — tylko ewentualne wyniesienie
  typu i `POOL_LABELS` do `lib/`, bez zmiany zachowania tamtego ekranu.
- `apps/b2c-web/app/actions/saveLead.ts` — B2C świadomie rozwiązuje koszyk `AUDIT` po stronie
  serwera (D-3 tamtego WO) i **nie dostaje** listy wyboru. Klient nie wybiera koszyka.
- Kreator wielokrokowy, wybór terminu z kalendarza, prezentacja alternatyw jako osobna funkcja
  — tutaj powstaje wyłącznie POLE WYBORU KOSZYKA w ścieżce rezerwacji.
- Zmiana koszyka na rezerwacji już istniejącej (re-wycena) — nie ma jej w żadnym z 4 kryteriów.
- Dopisanie drugiego tagu `@REQ` do `create-booking.test.ts` (dług ewidencyjny odnotowany
  w `CAL-VISIT-DURATION-BASKETS`) — należy do test-authora, nie do tego zadania.

## Ryzyka i nieznane

- **R-1 `[wymaga potwierdzenia]`** — dla `subject.kind = LEAD` pula nie wynika jednoznacznie:
  lead w fazie audytu potrzebuje puli `AUDITOR`, lead w fazie montażu — `CREW`. Dokumenty nie
  podają mapowania statusu lejka na pulę. Do rozstrzygnięcia przed testem AC7: czy ekran
  wyprowadza pulę ze statusu leada, czy użytkownik wybiera „rodzaj wizyty" jako pierwszy krok.
  Zgadnięcie tutaj daje ekran, który proponuje montaż dla leada przed audytem.
- **R-2** — `FIELD-APP-PLAN.md` 6.4 nadal zawiera w tabeli koszyk „Montaż duży = 2 dni", który
  ŚWIADOMIE nie istnieje (korekta Michała 2026-09-10, `CAL-VISIT-DURATION-BASKETS` AC8, komentarz
  w migracji `20260910100000`). **Dokument kłamie, seed i kontrakt mają rację.** Lista koszyków
  MUSI pochodzić z bazy, nigdy z tabeli w dokumencie.
- **R-3** — `bookedBy` ma dwie wartości (`CLIENT`, `DISPATCHER`). Panel B2B powinien wysyłać
  `DISPATCHER`, ale jeśli D-2 rozstrzygnie się na (b) (audytor tworzy rezerwację), żadna z
  istniejących wartości nie opisuje audytora. Nierozstrzygnięte w dokumentach.
- **R-4** — brak Postgresa w CI (`FIELD-APP-PLAN.md` A4): wyzwalacz `bookings_pool_matches_basket_trg`
  jako ostateczny strażnik AC8 nie jest dziś wykonywalny w teście; pokrycie opiera się na
  odwzorowaniu SQLSTATE w `create-booking.ts:318` i na atrapie. To ograniczenie dziedziczone,
  nie wprowadzane przez to zadanie.
- **R-5** — `apps/b2b-web/AGENTS.md` ostrzega, że wersja Next.js w tym repo ma zmiany łamiące
  zgodność wobec wiedzy modelu; implementer ma przeczytać `node_modules/next/dist/docs/` przed
  napisaniem komponentu.

---

**WYMAGA DECYZJI: (D-1) w której aplikacji powstaje ekran wyboru koszyka — panel B2B dla
dyspozytora teraz, czy Field App po ADR-013; oraz (D-2) czy `audytor` otrzymuje uprawnienie
`bookings.create` w `contracts/rbac.contract.mjs`, czy brzmienie wymagania zostaje skorygowane
na „osoba tworząca rezerwację".** Bez tych dwóch rozstrzygnięć nie da się wskazać jednej ścieżki
pliku ani napisać testu AC9 — a zgadnięcie kosztowałoby przepisanie ekranu w całości.
