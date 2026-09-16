---
name: fnl-2phase-booking-mechanics-carriers
description: 2026-09-16 nośniki montażu dwuetapowego (installation_phases + instalacje.installation_type) postawione; R7 rozstrzygnięte wariantem (b), RBAC świadomie ODŁOŻONE, status FNL-2PHASE-BOOKING nadal TODO
metadata:
  type: project
---

Okno `FNL-2PHASE-BOOKING-SCHEMA-2`, migracja `20260916060000_fnl_2phase_booking_mechanics.sql`.
Powstały DWA nośniki (z czterech nieistniejących fundamentów): tabela `installation_phases`
i kolumna `instalacje.installation_type`. `quotes` i `leads.declared_property_condition`
świadomie NIE powstały. Status `FNL-2PHASE-BOOKING` pozostaje **TODO** — to nośniki, nie logika.

**Why:** WO był zawężony dwukrotnie decyzją Michała D3 z 2026-09-16 do „wyłącznie mechanika
rezerwacji w panelu B2B". Cztery podsystemy (Field App, upload zdjęć, PDF, płatności) są
odłożone w CAŁOŚCI i wymagają ADR-013 — brak kolumny na zdjęcie czy protokół jest decyzją,
nie przeoczeniem, i najbardziej prawdopodobnym naruszeniem zakresu jest dołożenie „jednej
małej kolumny na zapas" (R8 w WO).

**How to apply — cztery rozstrzygnięcia, które łatwo cofnąć przez nieuwagę:**

1. **R7, wariant (b): `do:issuePhaseOneInvoice` USUNIĘTE z `T17.effects`.** Efekt domenowy jest
   z definicji obowiązkową zmianą stanu sprawdzaną testem kontraktowym, a tabela `invoices`
   nie istnieje — zostawienie go dałoby efekt zadeklarowany i niezrealizowany, czyli trwale
   czerwoną bramkę udającą dług. Efekt WRACA na `T17` razem z `FNL-2PHASE-INVOICE`.
   **Asymetria celowa:** `N8a.attachments: ['invoice_phase_1']` ZOSTAŁO, bo jest jedynym
   nośnikiem kryterium 2 wymagania `FNL-2PHASE-INVOICE` — usunięcie skasowałoby zapis tej
   zależności. Zamiast tego adnotacja: do czasu tamtego wymagania `N8a` idzie BEZ załącznika,
   a jedyny `link` to link do rezerwacji etapu II.
2. **RBAC ODŁOŻONE ŚWIADOMIE — `installation_phases` NIE MA wpisu w `RESOURCES`.** Operacja
   zamknięcia etapu I to `installations:update`, a rezerwacja etapu II to `bookings:create` —
   oba zasoby istnieją i oba mają `admin` + `dyspozytor`. Osobny zasób na podtabelę utworzyłby
   DRUGĄ, konkurencyjną drogę autoryzacji tej samej operacji. **Zależność dla następnej tury:**
   `implementer-server` ma bramkować przez `can(rola,'installations','update')` i
   `can(rola,'bookings','create')`, NIGDY przez `can(rola,'installation_phases',…)` — ten
   ostatni zwróci `'no'` dla każdej roli (pułapka znana z `system_config`). Gdyby jednak
   zapadła decyzja o własnym zasobie, trzeba pamiętać o [[audit-log-resource-check-subset-of-resources]].
3. **Brak `@unique` na `InstallationPhase.bookingId` jest CELOWY.** Unikalność w bazie jest
   CZĘŚCIOWA (`WHERE booking_id IS NOT NULL`), a Prisma nie umie tego wyrazić. Dlatego strona
   `Booking` to LISTA (`installationPhases InstallationPhase[]`), mimo że w bazie rezerwacja
   obsługuje dokładnie jeden etap. Pełne `@unique` zakłamałoby kształt indeksu i dałoby dryf
   przy introspekcji. Wzorzec domu: `bookings_one_active_per_subject` i kolumna generowana
   `subject_id` też żyją wyłącznie w SQL i są w `schema.prisma` tylko OPISANE komentarzem.
   Kto „naprawi" to, dodając `@unique`, zepsuje zgodność schematu z bazą.
4. **Nowe pole na modelu z długu nazewniczego trzyma styl SWOJEGO modelu.** `installation_type`
   na `instalacje` jest snake_case bez `@map` — wzorem `project_number` na `leady` i
   `promien_dzialania_km`. Pełne `camelCase` + `@map` stosują NOWE modele (`InstallationPhase`,
   `AvailabilityDeclaration`, `LegalDocumentVersion`). ADR-002 jest spełnione, bo sama KOLUMNA
   jest po angielsku i snake_case.

**Semantyka, która musi przetrwać do testów:** `installation_type IS NULL` znaczy „tryb
NIEUSTALONY", nigdy „jednoetapowy" — `CHECK` przepuszcza NULL celowo (IN zwraca UNKNOWN,
a CHECK odrzuca wyłącznie FALSE). Guard `installationIsTwoPhase` ma przepuszczać wyłącznie
jawne `'TWO_PHASE'`, więc tryb nieustalony daje ZERO etapów. Potwierdzone na żywej bazie.
D2: **nie ma minimalnej przerwy** między etapami — żadnego progu SLA, CHECK-a ani walidacji;
test oczekujący odmowy za „za wcześnie" jest błędny.

Powiązane: [[naming-baseline-on-migrations]] (ta migracja dała +6 i zatrzymała commit),
[[sql-verify-via-rolled-back-tx]] (jak zweryfikowano cały plik migracji).
