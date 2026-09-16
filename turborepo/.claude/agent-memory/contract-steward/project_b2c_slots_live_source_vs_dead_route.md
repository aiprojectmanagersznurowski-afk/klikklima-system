---
name: b2c-slots-live-source-vs-dead-route
description: Źródło slotów w B2C — route.ts wygląda na źródło, ale jest martwy; żywa ścieżka to actions/calendar.ts -> Step8Booking.tsx (sprostowanie kryterium 2026-09-14)
metadata:
  type: project
---

Kryterium 5 przy `B2C-BOOKING-SLOT` przez cztery dni wskazywało `apps/b2c-web/app/api/calendar/slots/route.ts` jako „dzisiejszy stan" listy slotów. To była nieprawda: ten Route Handler ma ZERO konsumentów w repozytorium. Żywym źródłem terminów B2C jest `app/actions/calendar.ts` -> `getAvailableSlots()` (Google Calendar), konsumowane przez `components/triage/steps/Step8Booking.tsx` i `app/actions/getFomoSlots.ts`. Sprostowane w oknie `B2C-BOOKING-SLOT-CRITERION-FIX`, commit 900e151.

**Why:** plik o „oczywistej" nazwie (`api/calendar/slots`) został wzięty za stan faktyczny bez grepu po konsumentach. Martwy kod, który wygląda jak implementacja, trafia do kontraktu jako fałszywy opis rzeczywistości i kieruje testy w nieistniejącą ścieżkę.

**How to apply:** zanim wpiszesz do kryterium „dzisiaj robi to plik X", sprawdź, czy X ma konsumenta (grep po imporcie / po trasie). W tym repo żywa warstwa danych B2C idzie przez Server Actions i `supabase-js`, nie przez Route Handlery — Route Handler w `app/api/` jest tu podejrzany z definicji. Pokrewne: [[project_cal_pool_aggregate_done]] (ta sama granica: funkcja `findPoolSlots` istnieje, konsumenta klienckiego brak).

Uwaga na resztkowy dryf: kryterium 7 tego samego wymagania zawiera wtrącenie „kryterium wyżej opisuje stan sprzed rozbudowy Triage" — po sprostowaniu jest ono bezprzedmiotowe, ale zostało nietknięte (zakres okna obejmował dokładnie jedno kryterium).

Poboczny fakt operacyjny: treści `acceptance` NIE trafiają do `packages/contracts/src/generated/` ani do `docs/architecture/generated/` — po edycji samego `acceptance` `kk-codegen --check` jest zielony bez regeneracji.
