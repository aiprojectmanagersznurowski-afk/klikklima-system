---
name: fld-booking-atomic-assign-blocked
description: FLD-BOOKING-ATOMIC-ASSIGN — blokada zdjęta 2026-09-14, status DONE po dopisaniu testów ograniczenia, których w tym sandboxie NIE DA SIĘ uruchomić (decyzja Michała)
metadata:
  type: project
---

`FLD-BOOKING-ATOMIC-ASSIGN` jest **DONE** (2026-09-14). Trzy tury:

1. Tura 1–2: status został `TODO`, bo kryteria 3 (nakładanie się ≠ identyczny start), 4 (styk `[)`) i 5 (częściowość `WHERE status IN ('RESERVED','CONFIRMED')`) opisują zachowanie `bookings_no_overlap_per_resource`, a dowodziła ich wyłącznie atrapa Prismy — patrz [[feedback_mock_cannot_prove_db_constraint]]. Jedyny `*.itest.ts` pokrywał AC-A4/AC-A5, czyli identyczny start: przypadek, który przepuściłby także zwykły `UNIQUE (pracownik, start)`.
2. Tura 3: `test-author` dopisał 4 przypadki (`fd1c1c8`) wstawiające wiersze bezpośrednio przez `prisma.booking.create()`, z pominięciem `createBooking` — silnik odfiltrowałby zajęty zasób przed próbą zapisu, więc przez warstwę domenową udowodniłby dobór kandydata, nie ograniczenie. Zweryfikowane przeciw treści migracji: testy faktycznie celują w kryteria 3/4/5.

**Pułapka przy weryfikacji kryterium 3:** rejestr mówi literalnie „montaż całodniowy od 08:00, a następnie **audyt** od 10:00 u tego samego pracownika". Wzięte dosłownie jest to niewykonalne i sprzeczne z kryterium 10: koszyk `AUDIT` ma pulę `AUDITOR`, więc na ekipie wyzwalacz `bookings_pool_matches_basket` odrzuciłby wiersz kodem `check_violation`, a nie `23P01`. Test słusznie podstawia `INCIDENT` (120 min, pula CREW). Odstępstwo od litery kryterium nie zawsze jest usterką testu — sprawdź, czy litera jest w ogóle spójna z resztą rejestru.

**Podstawa domknięcia mimo braku przebiegu testów (decyzja Michała 2026-09-14):** testy NIE zostały uruchomione. Brak Dockera/Podmana (`supabase start` niedostępny), `DATABASE_URL` z `.env` wskazuje produkcję, a `tools/vitest-integration-db-guard.mjs` (dodany po incydencie przypadkowego przebiegu AC-A4/AC-A5 na produkcji, `337793a`) słusznie to blokuje. Michal zaakceptował DONE na podstawie: `tsc --noEmit` czysty, identyczny wzorzec strukturalny jak zweryfikowane NA ŻYWO AC-A4/AC-A5 (przed dodaniem blokady), a realna weryfikacja i tak zawsze należała do CI (ma Dockera) albo maszyny deweloperskiej.

**Why:** ten sandbox nigdy nie był bezpiecznym miejscem na testy współbieżności — jedyna osiągalna z niego baza to produkcja. Trzymanie `TODO` do czasu przebiegu oznaczałoby, że wymaganie nie da się zamknąć NIGDY z tego środowiska, a nie że jest niedokończone.

**How to apply:** dług jest zapisany w polu `note` wymagania („spełnione co do FORMY testu, nie co do jego przebiegu") — nie kasuj go przy następnej edycji wpisu, zgodnie z [[feedback_closing_requirement_with_residual_debt]]. Jeżeli CI kiedyś zgłosi czerwony przebieg tego pliku, to NIE jest regresja implementacji, tylko pierwsze faktyczne wykonanie kryteriów 3/4/5. Nie mylić z [[project_booking_one_active_per_subject]] — tamto ID blokuje niezaaplikowana migracja (fakt o bazie), nie brak testu.
