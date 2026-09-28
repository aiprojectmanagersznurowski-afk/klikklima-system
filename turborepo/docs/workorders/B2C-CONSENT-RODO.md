# WO: B2C-CONSENT-RODO — zgoda klienta zapisywana z wersją dokumentu, w transakcji leada

> **Status: NIE STARTOWAĆ — WYMAGA DECYZJI (D-C1, D-C2, D-C3 niżej).**
> Wymaga okna kontraktowego i roli `contract-steward` (nowe kolumny w `leady`).
>
> **WO 2 z 3** w pakiecie „B2C: zapis leada". Zależy od **`B2C-LEAD-ATOMIC`**
> (`docs/workorders/B2C-LEAD-ATOMIC.md`) — zgoda jest dopisywana do transakcji zbudowanej tam.
> Realizacja przed WO 1 = zapis zgody do nietransakcyjnej ścieżki, czyli sprzeczność z kryt. 3.

## Wymagania

- **`B2C-CONSENT-RODO`** (`contracts/requirements.contract.mjs:597`) — TODO, risk HIGH.
  Statement: „Zgoda na regulamin i politykę prywatności jest zapisywana razem z leadem."
  Zamykane w całości (4 kryteria).
- Styczne, **nie zamykane**:
  - `B2C-SOFT-LEAD-CONSENT` (`:1066`) — ten sam wzorzec dla soft leadów, już zaimplementowany w
    kodzie (`leads.ts:33–89, 140–147`). Precedens do skopiowania.
  - `DOC-LEGAL-VERSION-REGISTRY` (`:923`, TODO, MEDIUM) — rejestr wersji dokumentów **klienta**.
    Od niego zależy D-C1.
  - `B2C-CONTENT-PAGES` (`:633`) kryt. 4 — „wersja prezentowana na stronie jest tą samą wartością,
    którą zapisuje zgoda".
  - `FLD-AUDIT-LEAD-CREATE` (`:902`) kryt. 5 — ta sama zgoda na ścieżce audytora. Kształt kolumn
    wybrany tutaj będzie jej nośnikiem — nie projektować dwóch.

## Kontekst kodu

### Istnieje

- UI: `apps/b2c-web/components/triage/steps/Step8Booking.tsx:61` (`acceptedTerms`, `useState`),
  `:174` (blokada wysyłki bez zaznaczenia — **wyłącznie w UI**), `:496` — etykieta
  „Akceptuję **Regulamin** (`/regulamin`) oraz **Politykę Prywatności** (`/polityka-prywatnosci`)".
  **Jedno pole wyboru na DWA dokumenty.**
- `saveLead.ts`: `SaveLeadData` (`:20–29`) nie ma pola zgody; `leadData` w `Step8Booking.tsx:182–191`
  go nie przekazuje. Stan zgody nie opuszcza przeglądarki.
- Rejestr wersji: model `LegalDocumentVersion` → `legal_document_versions`
  (`schema.prisma:656–689`), enum `LegalDocumentKind { RODO_CONSENT, EMPLOYEE_TERMS }`
  (`:634–637`). Częściowy UNIQUE „jedna obowiązująca na rodzaj", wyzwalacz zamrażający
  opublikowaną treść. Tabela **nie jest wyłącznie pracownicza**: `soft_leady.consent_version_id`
  (`:233–241`) wskazuje na nią od 2026-09-24 (FK `onDelete: Restrict`).
- Precedens kodu: `leads.ts` — `consentDocumentVersionId: z.string().uuid()` w schemacie
  `.strict()` (`:53–56`), wersja przysyłana jawnie z frontendu (wzorzec `FLD-CONSENT-ACCEPT`,
  kryt. 3: „Server Action musi przyjmować identyfikator wersji jawnie z frontendu, zamiast doklejać
  najnowszą"), `getCurrentSoftLeadConsentVersionId()` (`:72–89`) czyta `RODO_CONSENT`
  `is_current` i zwraca `null`, gdy brak — z komentarzem, że to **tymczasowe przybliżenie** do
  czasu `DOC-LEGAL-VERSION-REGISTRY`.

### Stan żywej bazy (odczyt 2026-09-28)

- `legal_document_versions`: **0 wierszy**. Nie ma żadnej wersji, na którą zgoda mogłaby wskazać.
- `leady`: **brak** kolumn zgody (pełna lista kolumn sprawdzona w `information_schema`).
- `soft_leady`: **brak** kolumn `consent_version_id`/`consent_granted_at` mimo `schema.prisma` i
  migracji `20260926094000` — migracja **nie jest uruchomiona**. (Poza zakresem tego WO, ale
  oznacza, że `saveSoftLead` na produkcji dziś wywraca każdy zapis — zgłoszone w podsumowaniu.)
- `leady`: 221 wierszy historycznych — wszystkie bez zgody.

### Brakuje

- Kolumn zgody na leadzie (moment + wskazanie wersji).
- Pola zgody w wejściu `saveLead` i jego walidacji po stronie serwera.
- Rodzaju dokumentu dla **regulaminu klienta B2C** (enum ma tylko `RODO_CONSENT` i pracownicze
  `EMPLOYEE_TERMS`).
- Choćby jednej opublikowanej, obowiązującej wersji dokumentu w bazie.

## WYMAGA DECYZJI

**D-C1 — Na które dokumenty wskazuje zgoda i jakim rodzajem?** Pole wyboru obejmuje *Regulamin* i
*Politykę Prywatności*. Kontrakt: „wersja zaakceptowanego dokumentu" (l. poj.), statement:
„zgoda na regulamin **i** politykę prywatności". W słowniku `LegalDocumentKind` nie ma regulaminu
klienta, a rejestr dokumentów klienta to `DOC-LEGAL-VERSION-REGISTRY` (TODO), którego lista siedmiu
wzorów D5 **nie obejmuje ani regulaminu serwisu, ani polityki prywatności** (są tam „klauzule RODO").
Warianty:
- (a) jedna zgoda → `RODO_CONSENT`, tak jak soft lead dziś („tymczasowe przybliżenie"); regulamin
  bez wersji. Najtańsze, ale kryt. 1 spełnione tylko co do polityki prywatności.
- (b) dwie pary kolumn (polityka + regulamin), nowe wartości enuma (np. `B2C_PRIVACY_POLICY`,
  `B2C_TERMS`) — migracja `ALTER TYPE … ADD VALUE` w osobnym pliku (komentarz `:631`).
- (c) jedno pole wyboru rozbić w UI na dwa — zmiana UX, dwie zgody, dwie wersje.
Decyzja należy do człowieka (treść prawna, nie technika). Od niej zależy liczba kolumn.

**D-C2 — Kolejność wdrożenia wobec pustego rejestru.** Po wdrożeniu kryt. 2 („brak zgody powoduje
odrzucenie żądania") i przy **0 wersjach w bazie** każdy lead z B2C zostanie odrzucony — Triage
przestaje przyjmować klientów. Warunek wstępny wdrożenia: administrator publikuje obowiązującą
wersję dokumentu(ów) z D-C1 (`apps/b2b-web/src/app/(dashboard)/settings/actions.ts` ma ścieżkę
wersji). Kto i z jaką treścią — decyzja człowieka; ten WO może najwyżej wymagać, żeby UI przy braku
wersji pokazało komunikat zamiast cichej porażki.

**D-C3 — 221 istniejących leadów bez zgody.** Kolumny muszą wejść jako NULLABLE (NOT NULL bez
wartości domyślnej na tabeli z danymi — zabronione). Backfill fałszywą zgodą — odrzucony wprost w
`B2C-SOFT-LEAD-CONSENT` kryt. 8 i nie wolno go tu powtórzyć. Kryt. 3 („nie istnieje lead bez
zgody") jest więc dla historii nieprawdziwe. Warianty: (a) inwariant obowiązuje od daty wdrożenia,
egzekwowany w Server Action + ewentualnie `CHECK (consent_granted_at IS NOT NULL OR created_at <
<data wdrożenia>)`; (b) oznaczenie historycznych leadów jako „bez podstawy" (wymaga osobnej decyzji
RODO). Pytanie dotyczy tej samej klasy co `B2C-SOFT-LEAD-CONSENT` kryt. 8.

## Zmiana kontraktu

**WYMAGANA** — okno kontraktowe, `contract-steward`:
- `schema.prisma` + migracja addytywna: w `leady` kolumny wskazania wersji (UUID, FK do
  `legal_document_versions.id`, `ON DELETE RESTRICT`, indeks) i momentu (`timestamptz`), obie
  NULLABLE. Nazwy wzorem `soft_leady`: `consent_version_id`, `consent_granted_at` — ×2, jeżeli
  D-C1 = (b)/(c). Nazwy angielskie mimo polskiej tabeli (dług `KK-NAMING-BASELINE` zamrożony,
  precedens `project_number`).
- Jeżeli D-C1 = (b)/(c): `ALTER TYPE "LegalDocumentKind" ADD VALUE …` w osobnym pliku migracji.
- Jeżeli D-C3 = (a) z CHECK: ograniczenie w tej samej migracji.
- Dlaczego nie da się bez: kryt. 1 wymaga zapisu wersji i momentu przy leadzie, a `leady` nie ma
  żadnej kolumny, która mogłaby to przenieść; `odpowiedzi_triage` (jsonb) odpada — FK wymagany
  przez wzorzec („wskazanie nieistniejącej wersji odrzuca BAZA").
- Migracja musi zostać **uruchomiona i sprawdzona w `pg_catalog`** przed RED na żywej bazie —
  obecność pliku nie jest dowodem (patrz `soft_leady` wyżej).

## Kryteria akceptacji (wykonalne)

- [ ] **AC1** *(kryt. 1)* — „Zapisywany jest moment udzielenia zgody oraz wersja zaakceptowanego
  dokumentu — sama flaga logiczna nie wystarcza." Po udanym `saveLead` lead ma niepusty moment
  zgody (`timestamptz`, ustawiony przez serwer, nie z żądania) i wskazanie wersji równe
  identyfikatorowi przysłanemu w żądaniu. Żądanie z flagą logiczną (`consent: true`) albo numerem
  wersji jako tekstem zamiast UUID → błąd walidacji, zero zapisów.
- [ ] **AC2** *(kryt. 2)* — „Brak zgody powoduje odrzucenie żądania w Server Action — test wysyła
  żądanie z pominięciem UI, bez znacznika zgody, i oczekuje błędu walidacji zamiast zapisu."
  Zero nowych wierszy w `klienci`, `adresy`, `leady`, `bookings`; `createBooking`/część
  przygotowawcza rezerwacji **niewołana** (walidacja przed transakcją).
- [ ] **AC3** *(kryt. 3)* — „Zgoda zapisuje się w tej samej transakcji co lead." Test: błąd
  wstrzyknięty na zapisie rezerwacji (krok 4 z WO 1) → lead nie istnieje i zgoda nie istnieje.
  Wskazanie **nieistniejącej** wersji → odrzucenie przez **bazę** (FK), cała transakcja
  wycofana, zero wierszy.
- [ ] **AC4** *(kryt. 4)* — „Późniejsza zmiana treści regulaminu nie modyfikuje wersji zapisanej
  przy istniejących leadach." Test: lead ze zgodą na wersję N → publikacja wersji N+1 → lead
  nadal wskazuje N, moment zgody niezmieniony.
- [ ] **AC5** *(kryt. 1, doprecyzowanie wzorem `FLD-CONSENT-ACCEPT` kryt. 3)* — Wskazanie wersji
  **szkicu** albo wersji **nieobowiązującej** (zastąpionej) → odrzucenie po stronie serwera, zero
  zapisów. Serwer nie dokleja „najnowszej" wersji — przyjmuje tę, którą UI pokazał.
- [ ] **AC6** *(`B2C-CONTENT-PAGES` kryt. 4, strona UI)* — `Step8Booking` przekazuje do `saveLead`
  identyfikator wersji tego samego dokumentu, do którego prowadzi odnośnik; przy braku
  obowiązującej wersji wysyłka jest zablokowana z komunikatem, a nie wysłana z pustą zgodą.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Współbieżność z publikacją:** wersja przestaje być obowiązująca między renderem formularza a
  wysyłką → odrzucenie (AC5), nie cicha zgoda na nową treść, której klient nie widział.
- **Usunięcie wersji wskazanej przez lead** → odrzucone przez FK `RESTRICT` (nie kaskada,
  nie `SET NULL`).
- **Anonimizacja RODO klienta** (`CRM-CLIENT-ANONYMIZE-RODO`) nie może usuwać ani zerować dowodu
  zgody na leadzie bez świadomej decyzji — sprawdzić, czy `anonymizeClient()` dotyka `leady`.
- **Pole zgody z nadmiarowymi kluczami** → `.strict()` odrzuca.
- **Strefa czasowa:** moment zgody to `timestamptz` serwera (UTC), nie czas przeglądarki.

## Poza zakresem

- Uruchomienie migracji `soft_leady` (`20260926094000`) — osobny dług, zgłoszony.
- `DOC-LEGAL-VERSION-REGISTRY` w całości (siedem wzorów D5).
- Treść regulaminu i polityki prywatności; strony `/regulamin`, `/polityka-prywatnosci`
  (`B2C-CONTENT-PAGES`).
- Zgoda na ścieżce audytora (`FLD-AUDIT-LEAD-CREATE`).

## Ryzyka i nieznane

- **R-1** D-C2 jest ryzykiem produkcyjnym, nie testowym: wdrożenie w złej kolejności zatrzymuje
  cały lejek B2C, a testy (z własnymi fixture'ami wersji) będą zielone.
- **R-2** `RODO_CONSENT` jest dziś semantycznie „zgodą RODO pracownika" (FLD-CONSENT-DOCS). Użycie
  go dla klienta (wariant (a) D-C1, i obecny soft lead) miesza dwa rejestry — `FLD-CONSENT-ACCEPT`
  sprawdza „komplet zgód pracownika" po rodzaju dokumentu i mógłby zacząć widzieć dokument
  kliencki jako obowiązujący dla pracownika.
- **R-3** `Step8Booking.tsx:61` trzyma zgodę w `useState` (CLAUDE.md: formularze przez
  `react-hook-form`). Poprawa formy formularza — poza zakresem, chyba że UI i tak jest przepisywany.

## Kolejność ról

0. Człowiek: D-C1, D-C2, D-C3.
1. `contract-steward` — okno kontraktowe: kolumny, ewentualnie enum i CHECK; uruchomienie i
   weryfikacja migracji na bazie.
2. `test-author` — AC1–AC6.
3. `implementer-server` (`saveLead`) + `implementer-ui` (`Step8Booking`).
4. `reviewer`, `rls-security-auditor`.
