# WO: FLD-AVAIL-WEEKLY-RULES — własny grafik tygodniowy pracownika terenowego

Data: 2026-09-10
Status wymagania w rejestrze: TODO, domain `field`, risk MEDIUM

## Cel

Pracownik terenowy (audytor, monter) definiuje i edytuje **własne** reguły dostępności cyklicznej
(jeden przedział `start_time`–`end_time` na dzień tygodnia ISO). Do tego powstaje funkcja odczytu
**efektywnej dostępności** na dzień/zakres, która przy braku reguł spada na wartości domyślne
z `system_config.scheduling_config`.

Fundament bazodanowy jest gotowy i **nie jest przedmiotem tego WO**.

## Wymagania

- Główne: `FLD-AVAIL-WEEKLY-RULES`
- Styka się (nie realizuje): `FLD-AVAIL-RESTORE` (przesłonięcie, nie edycja źródła),
  `FLD-BOOKING-ATOMIC-ASSIGN`, `CAL-TRAVEL-BUFFER`, `CAL-VISIT-DURATION-BASKETS`

## Kontekst kodu (stan zweryfikowany 2026-09-10)

### Istnieje

- Tabela `public.availability_rules` (migracja `20260910100000_fld_calendar_foundation.sql`, sekcja 2),
  na żywej bazie. Ograniczenia w bazie:
  - `availability_rules_one_owner` — `num_nonnulls(auditor_id, crew_id) = 1`
  - `availability_rules_weekday_check` — `weekday BETWEEN 1 AND 7`
  - `availability_rules_time_order_check` — `end_time > start_time`
  - `availability_rules_resource_weekday_key` — UNIQUE na `(resource_id, weekday)`,
    gdzie `resource_id` to kolumna **GENEROWANA** `COALESCE(auditor_id, crew_id)`
  - RLS włączone
- Model Prisma `AvailabilityRule` (`packages/database/prisma/schema.prisma`, ok. linia 877):
  pola `auditorId`, `crewId`, `weekday`, `startTime`, `endTime`, `isActive`, `createdAt`, `updatedAt`,
  indeksy `@@index([auditorId])`, `@@index([crewId])`.
- `system_config` z wierszem `typ_konfiguracji = 'scheduling_config'` i wartością początkową
  `{ travel_buffer_minutes: 60, default_workday_start: "08:00", default_workday_end: "16:00", default_weekdays: [1,2,3,4,5] }`
  (migracja jw., sekcja 5). Model Prisma: `system_config { typ_konfiguracji @unique, konfiguracja Json }`.
- RBAC: `contracts/rbac.contract.mjs` linia 120 —
  `availability_rules: read ['admin','dyspozytor','audytor:own','monter:own'], create ['admin','audytor:own','monter:own'], update ['admin','audytor:own','monter:own'], delete ['admin']`.
- Wzorzec „edycja własnego rekordu" do skopiowania 1:1:
  `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts` → `setSelfAvailabilityAction` (linie 147–202)
  oraz bliźniacza funkcja w `crews/actions.ts` (linia 151). Wzorzec obejmuje:
  rola wyłącznie z `getCurrentActorRole()`, jawne związanie roli z encją (`actorRole !== 'audytor'`),
  identyfikacja właściciela po e-mailu z sesji przez `findMany({ where: { email }, take: 2 })`
  i odrzucenie, gdy `matches.length !== 1`, porównanie `own.id !== id`.
- Testy: `apps/b2b-web/tests/availability-self-declaration.test.ts`, `availability-restore.test.ts`
  (konwencja: kebab-case `*.test.ts`, znacznik `// @REQ: <ID>` nad każdym `it`).

### Brakuje

- Jakiejkolwiek Server Action dotykającej `availabilityRule` — zero wystąpień w `apps/`.
- Jakiegokolwiek odczytu `system_config` w `apps/b2b-web/src` — zero wystąpień. Funkcja czytająca
  `scheduling_config` powstaje tu po raz pierwszy i będzie potem używana przez `CAL-TRAVEL-BUFFER`.
- UI: `setSelfAvailabilityAction` **nie jest dziś podpięta do żadnego komponentu**
  (grep po `.tsx` nie znajduje wywołania). Nie ma więc gotowego ekranu „moje dane" do rozszerzenia.
- `apps/field-app` **nie istnieje** — w `apps/` są wyłącznie `b2b-web` i `b2c-web`.
- W modelu Prisma `AvailabilityRule` **nie ma pola `resourceId` ani `@@unique`** — patrz sekcja
  „Zmiana kontraktu".

## Zmiana kontraktu

**NIEWYMAGANA.**

- `contracts/requirements.contract.mjs` ma już komplet kryteriów dla tego ID (9 pozycji, linie 638–648).
- `contracts/rbac.contract.mjs` ma już zasób `availability_rules` z wariantami `:own`.
- Wartości domyślne okna pracy są **danymi** (`system_config`), nie progiem SLA — nie należą do
  `contracts/sla.contract.mjs` (ta sama zasada, co przy koszykach czasu trwania).
- Audytu **nie ma**: `operation` z `AUDIT_REQUIREMENTS.mustLog` nie obejmuje edycji własnego grafiku,
  a `field_update` jest zarezerwowany dla kolumn bazowych z `FLD-BASE-LOCATION-EDIT` (kod pocztowy,
  promień), gdzie wpis audytowy był **warunkiem dopuszczenia edycji**. Grafik nie steruje doborem
  zleceń w sposób ukryty — nieobecność w kalendarzu jest widoczna wprost dla dyspozytora.
  Nie dokładamy tu wpisów audytowych.

**Konsekwencja braku zmiany kontraktu, którą implementer musi obsłużyć:** `prisma.availabilityRule.upsert`
**nie jest dostępny**, bo model nie ma unikalnego celu `(resourceId, weekday)` (kolumna generowana nie
jest w modelu). Dopuszczalne drogi — obie bez dotykania `schema.prisma`:

1. `prisma.$executeRaw` z `INSERT INTO public.availability_rules (auditor_id, crew_id, weekday, start_time, end_time, is_active) VALUES (...) ON CONFLICT (resource_id, weekday) DO UPDATE SET ...` — jedno zapytanie, unikalność rozstrzyga baza;
2. `findFirst` + `create`/`update` w `prisma.$transaction`, z **obowiązkową** obsługą `P2002` jako
   powtórzenia (retry na update), nigdy jako błędu 500.

Wariant 1 jest preferowany. Wariant „sprawdź, potem zapisz" bez obsługi `P2002` jest odrzucony wprost.

## Kryteria akceptacji

### A. Zapis własnych reguł

- [ ] **AC-A1** Audytor zapisuje regułę na własny identyfikator i po zapisie odczyt zwraca dokładnie
      zapisane `weekday`, `start_time`, `end_time`, `is_active`.
- [ ] **AC-A2** Wywołanie z **cudzym** identyfikatorem kończy się odmową po stronie serwera,
      bez ani jednego zapytania zapisującego. Test wywołuje akcję bezpośrednio, z pominięciem UI
      (Prisma omija RLS, więc UI nie jest granicą uprawnień).
- [ ] **AC-A3** Rola `monter` nie może zapisać reguły audytora, a `audytor` reguły ekipy — związanie
      roli z encją żyje w kodzie akcji, bo `can()` widzi jeden zasób `availability_rules` dla dwóch tabel.
- [ ] **AC-A4** `dyspozytor` dostaje odmowę zapisu cudzej reguły (`update` ma tylko `admin` i warianty
      `:own`), mimo że ma prawo `read`.
- [ ] **AC-A5** `weekday` spoza 1–7 (0, 8, `-1`, `1.5`, `"pon"`) jest odrzucone przez walidację Zod
      **przed** dotknięciem bazy — komunikat błędu dla użytkownika po polsku.
- [ ] **AC-A6** `end_time <= start_time` (w tym równość) jest odrzucone przez walidację Zod przed
      zapytaniem; niezależnie od tego test przechodzi ścieżką raw i potwierdza, że baza odrzuca
      taki wiersz przez `availability_rules_time_order_check` (walidacja aplikacyjna to wygoda,
      nie gwarancja).
- [ ] **AC-A7** Drugi zapis dla tej samej pary (pracownik, `weekday`) **aktualizuje** istniejący wiersz,
      nie tworzy drugiego: po dwóch wywołaniach liczba wierszy dla tej pary wynosi 1, a wartości
      pochodzą z drugiego wywołania. Test sprawdza liczbę wierszy, nie tylko odpowiedź akcji.
- [ ] **AC-A8** Idempotencja: zapis tej samej wartości dwa razy zwraca sukces oba razy i nie rzuca
      surowego `P2002`/23505 na zewnątrz.
- [ ] **AC-A9** Zwolnienie sobie dnia odbywa się przez `is_active = false`, a wiersz **pozostaje**
      w bazie. Nie istnieje ścieżka kodu, w której akcja dostępna pracownikowi wywołuje
      `availabilityRule.delete`/`deleteMany` (test statyczny nad `apps/`).
- [ ] **AC-A10** Zapis grafiku nie zmienia ani jednego pola poza `availability_rules`: test podaje
      w tym samym żądaniu `is_active`/`aktywny`/`leave_status` pracownika i sprawdza, że rekord
      `audytorzy`/`zespoly_monterskie` jest bajt w bajt niezmieniony (ta sama rozdzielność,
      co w `setSelfAvailabilityAction`).
- [ ] **AC-A11** Zapis grafiku nie modyfikuje `availability_declarations` — przełącznik „jestem teraz
      niedostępny" i grafik to dwa rozłączne mechanizmy. Symetrycznie: przełączenie deklaracji
      nie zmienia ani jednego wiersza `availability_rules` (kryterium należy do `FLD-AVAIL-RESTORE`,
      tu odnotowane jako granica).
- [ ] **AC-A12** Zapis siedmiu reguł (weekday 1..7) w jednym przejściu ekranu daje 7 wierszy;
      brak reguły dla dnia oznacza brak wiersza, a nie wiersz `00:00–00:00`.

### B. Odczyt efektywnej dostępności (osobne, nietrywialne kryterium)

- [ ] **AC-B1** Dla pracownika mającego regułę na dany `weekday` funkcja zwraca okno z reguły,
      a **nie** wartość domyślną — nawet gdy okno reguły jest węższe albo szersze niż domyślne.
- [ ] **AC-B2** Dla pracownika **bez ani jednej reguły** funkcja zwraca okno z
      `system_config.scheduling_config` (`default_workday_start`, `default_workday_end`) dla każdego dnia
      wymienionego w `default_weekdays`, a dla dni spoza tej listy zwraca „brak dostępności".
      To jest zasada fail-open: brak reguł **nie** znaczy „niedostępny".
- [ ] **AC-B3** Wartości domyślne są **czytane z bazy**, nie zaszyte w kodzie. Test podmienia zawartość
      `scheduling_config` (np. na `07:00`–`15:00`, `[1,2,3,4,5,6]`) i oczekuje, że wynik się zmieni.
      Literał `"08:00"`, `"16:00"`, `60` ani `[1,2,3,4,5]` nie występuje w kodzie silnika (test statyczny).
- [ ] **AC-B4** Fallback jest **per-pracownik, nie per-dzień**: pracownik, który ma choćby jedną regułę
      (np. tylko na poniedziałek), **nie** dostaje wartości domyślnych na pozostałe dni — pozostałe dni
      są dla niego wolne od pracy. Inaczej dodanie jednej reguły cicho rozszerzałoby grafik na cały
      tydzień. To rozstrzygnięcie musi mieć własny test, bo obie interpretacje wyglądają rozsądnie.
- [ ] **AC-B5** Reguła z `is_active = false` jest traktowana jak brak dostępności w tym dniu, a **nie**
      jak brak reguły — nie uruchamia fallbacku (inaczej zwolnienie sobie środy dawałoby środę domyślną).
- [ ] **AC-B6** Brak wiersza `scheduling_config` w `system_config` nie wywraca odczytu: funkcja zwraca
      jawny, kontrolowany wynik (brak dostępności + błąd domenowy), nigdy `undefined.default_workday_start`.
- [ ] **AC-B7** Mapowanie daty na `weekday` idzie przez ISO-8601 (poniedziałek = 1, niedziela = 7),
      zgodnie z `EXTRACT(ISODOW)`. Test sprawdza **granice tygodnia**: konkretną niedzielę (→ 7)
      i następujący po niej poniedziałek (→ 1). `Date.getDay()` daje niedzielę = 0 i jest tu błędem
      przesuwającym cały grafik bez zgłoszenia.
- [ ] **AC-B8** Materializacja reguły na konkretną datę odbywa się w strefie `Europe/Warsaw`
      (`QUEUE_POLICY.timezone`), a wynik dla dalszych warstw jest w UTC. Test obejmuje **obie** doby
      zmiany czasu: 2026-03-29 (23 h) i 2026-10-25 (25 h) — reguła „8–16" ma dać lokalne 08:00–16:00
      w obu przypadkach, czyli różną liczbę godzin UTC.
- [ ] **AC-B9** Odczyt cudzej dostępności: `admin` i `dyspozytor` mogą; `audytor`/`monter` mogą
      wyłącznie własną (`:own`), a próba odczytu cudzej kończy się odmową po stronie serwera.
- [ ] **AC-B10** Funkcja przyjmuje zakres dat i zwraca wynik dla każdego dnia zakresu w jednym
      wywołaniu, bez zapytania do bazy per dzień (N+1 na kalendarzu miesięcznym jest defektem).

### C. UI w panelu B2B

- [ ] **AC-C1** Zalogowany audytor/monter widzi ekran własnego grafiku tygodniowego z siedmioma
      dniami w kolejności poniedziałek → niedziela i może ustawić godziny od–do oraz przełącznik
      „dzień wolny" dla każdego z nich.
- [ ] **AC-C2** Formularz używa `react-hook-form` + `zodResolver` na wspólnym schemacie Zod
      (ten sam, którego używa Server Action), a nie `useState` na pojedynczych polach.
- [ ] **AC-C3** Pracownik bez ani jednej reguły widzi wartości domyślne z `scheduling_config`
      **oznaczone jako domyślne**, a nie jako zapisany grafik — dopóki nie zapisze, w bazie nie
      powstaje żaden wiersz.
- [ ] **AC-C4** Ekran nie zawiera żadnego pola sterującego `is_active`/`aktywny`/`leave_status`
      pracownika (test na obecność w drzewie komponentu).
- [ ] **AC-C5** Pozycja nawigacji do tego ekranu nie pokazuje się rolom, które nie mają
      `availability_rules:update` dla siebie — brak elementu w UI nie zastępuje bramki serwerowej
      (AC-A2), lecz jest jej wymaganym uzupełnieniem.
- [ ] **AC-C6** Odmowa z Server Action jest pokazywana użytkownikowi jako komunikat po polsku,
      a nie jako pusty ekran ani zrzut wyjątku.
- [ ] **AC-C7** Zero hardkodowanych kolorów hex; ikony wyłącznie z `lucide-react`.

## Przypadki brzegowe, które MUSZĄ mieć test

- Zmiana czasu, obie doby (AC-B8) — po fakcie ten błąd jest drogi, z góry jest tani.
- Granica tygodnia niedziela/poniedziałek w konwersji ISODOW (AC-B7).
- Dwa zapisy tej samej pary (pracownik, weekday) — również **równolegle**: dwa jednoczesne wywołania
  kończą się jednym wierszem i dwiema odpowiedziami sukcesu (albo jedną odmową domenową, nigdy 500
  z SQLSTATE 23505).
- Pracownik z jedną regułą kontra pracownik z zerem reguł (AC-B4 kontra AC-B2) — to jest sedno
  tego wymagania i najłatwiejsze miejsce na cichy błąd.
- Pracownik bez e-maila w kartotece (`email` jest nullable w obu tabelach): nie ma ścieżki
  samoobsługi — odmowa, nie wybór pierwszego pasującego rekordu.
- Dwa rekordy z tym samym e-mailem (`audytorzy.email` nie ma dziś UNIQUE na żywej bazie,
  patrz `SEC-EMAIL-UNIQUE`): `findMany({ take: 2 })` i odmowa przy `length !== 1`.
- Reguła `is_active = false` w odczycie (AC-B5).
- `weekday` przekazany jako string z `FormData` — konwersja przez Zod `coerce`, nigdy `parseInt`
  bez sprawdzenia `NaN`.

## Poza zakresem (jawnie, dla review)

- **Silnik wolnych slotów.** Wyliczanie terminów z odjęciem nieobecności (`absences`), istniejących
  rezerwacji (`bookings`), bufora dojazdu i dziennego limitu wizyt należy do
  `FLD-BOOKING-ATOMIC-ASSIGN` i `CAL-TRAVEL-BUFFER`. To WO dostarcza wyłącznie **warstwę 1**
  (reguły cykliczne + odczyt efektywnego okna) jako wejście dla tamtego silnika.
- Bufor dojazdu i odczyt `travel_buffer_minutes` — `CAL-TRAVEL-BUFFER`.
- Czas trwania wizyty i koszyki — `CAL-VISIT-DURATION-BASKETS`.
- Widok klienta z sumą wolnych terminów całej puli (FIELD-APP-PLAN 6.3).
- Nieobecności (`absences`) — wpisuje je `admin`/`dyspozytor`, osobne wymaganie.
- **Wiele przedziałów na dzień** (przerwa w środku dnia) — świadomie odrzucone przez unikalny indeks.
  Nie obchodzić go przez „drugi wiersz z innym `is_active`" ani przez kodowanie przerwy w polu tekstowym.
- **Field App.** `apps/field-app` nie istnieje w monorepo. UI powstaje wyłącznie w `apps/b2b-web`.
  Server Actions są pisane tak, by dały się wywołać z przyszłej aplikacji terenowej (logika
  właścicielstwa w akcji, nie w komponencie), ale samej aplikacji to WO nie tworzy.
- Zmiany w `schema.prisma`, `contracts/`, `supabase/migrations/` — fundament jest gotowy;
  gdyby okazały się potrzebne, to jest sygnał, że coś w tym WO jest źle rozpoznane, a nie zadanie
  dla implementera.
- Wpisy w `audit_log` dla edycji grafiku — patrz uzasadnienie w sekcji „Zmiana kontraktu".

## Sugerowany podział na iteracje GREEN

Limit iteracji to 3, więc nie wchodzić w to jednym przebiegiem:

1. **A** — Server Actions zapisu (`audytorzy` + `zespoly_monterskie`) + schemat Zod.
2. **B** — odczyt efektywnej dostępności z fallbackiem do `scheduling_config`.
3. **C** — UI w panelu B2B.

Blok B da się w całości przetestować bez UI, tak samo jak przy `FLD-AVAIL-SELF`.

## Ryzyka i nieznane

1. **Brak żywego Postgresa w vitest.** Kryteria opierające się o ograniczenia bazy
   (AC-A6 druga część, AC-A7 przez `ON CONFLICT`, współbieżność) będą dowodzone statycznie nad
   tekstem migracji albo na atrapie. To ta sama, znana granica co przy `SEC-AUDIT-LOG-APPEND-ONLY`.
   Testu przechodzącego przez `it.skip` ani warunkowy `return` nie wolno uznać za dowód.
2. **Gdzie w panelu B2B ma mieszkać ekran własnego grafiku.** Nie ma dziś sekcji „moje dane" —
   `setSelfAvailabilityAction` nie ma podpiętego UI, a `(dashboard)` ma trasy per-encja
   (`auditors`, `crews`). Umieszczenie grafiku pod `/auditors/[id]` sprawia, że pracownik dostaje
   ekran listy kartotek; osobna trasa `/me/schedule` wymaga nowej pozycji nawigacji.
   **Rekomendacja: osobna trasa samoobsługowa**, bo w Field App i tak nie będzie listy kartotek.
   Do potwierdzenia przy review UI — nie blokuje bloków A i B.
3. **`resource_id` jest kolumną generowaną, niewidoczną dla Prismy.** Stąd brak `upsert`
   (patrz sekcja „Zmiana kontraktu"). Jeśli implementer uzna, że raw SQL jest nie do przyjęcia,
   to jest moment na osobne okno kontraktowe, a nie na obejście w kodzie.
4. **Sens `is_active` przy braku wiersza.** Kontrakt rozstrzyga „brak reguł = domyślne okno",
   ale nie rozstrzyga wprost, czy pracownik z regułami tylko na 1–5 jest niedostępny w soboty.
   AC-B4 przyjmuje interpretację „tak, niedostępny" i uzasadnia ją. Jeżeli człowiek widzi to inaczej,
   to jest jedyne miejsce w tym WO, które trzeba zmienić przed testami.
