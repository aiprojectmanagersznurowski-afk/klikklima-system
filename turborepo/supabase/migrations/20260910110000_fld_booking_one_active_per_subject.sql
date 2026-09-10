-- ============================================================================
-- FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT (2026-09-10)
-- Rozstrzygnięcie D-3 z docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md,
-- decyzja Michała: wariant (b) — OGRANICZENIE W BAZIE, nie sprawdzenie w kodzie.
-- ============================================================================
-- PROBLEM. `bookings_one_subject` (CHECK num_nonnulls(lead_id, service_id,
-- incident_id) = 1) pilnuje wyłącznie tego, że WIERSZ dotyczy jednej rzeczy —
-- nie tego, że RZECZ ma jeden wiersz. `bookings_no_overlap_per_resource` pilnuje
-- z kolei kalendarza PRACOWNIKA, więc dwa równoległe żądania na ten sam slot przy
-- puli DWUOSOBOWEJ kończą się dwiema poprawnymi rezerwacjami jednego leada
-- u dwóch różnych osób. Podwójne kliknięcie klienta = dwa wyjazdy. Sprawdzenie
-- „czy ten lead ma już rezerwację" w kodzie akcji jest nieszczelne dokładnie tak
-- samo jak sprawdzenie „czy slot wolny" — między odczytem a zapisem mieści się
-- drugie żądanie. To ta sama klasa błędu, którą zwalcza FLD-BOOKING-ATOMIC-ASSIGN,
-- więc odpowiedź musi być tej samej klasy: ograniczenie w bazie.
--
-- DLACZEGO CZĘŚCIOWY. CRM-BOOK-HISTORY WYMAGA wielu wierszy na jeden podmiot:
-- przełożenie terminu tworzy nowy wiersz z `reschedule_of`, a poprzedni dostaje
-- status RELEASED. „Jeden wiersz per lead" jest więc wykluczone. Unikalność
-- obejmuje WYŁĄCZNIE statusy aktywne (RESERVED, CONFIRMED) — ta sama filozofia
-- i ten sam zestaw statusów co w `bookings_no_overlap_per_resource`. RELEASED
-- i COMPLETED nie liczą się do niczego; historia rośnie bez ograniczeń.
--
-- DLACZEGO KOLUMNA GENEROWANA, a nie UNIQUE na trzech kolumnach. Trzy kolumny FK
-- są nullowalne, a NULL-e w indeksie unikalnym są sobie nawzajem RÓŻNE — indeks na
-- (lead_id, service_id, incident_id) nie zabroniłby niczego. Alternatywą byłyby trzy
-- osobne indeksy częściowe (po jednym na kolumnę), ale wtedy naruszenie wraca pod
-- trzema różnymi nazwami i kod odwzorowujący błąd bazy na komunikat domenowy musi
-- znać całą trójkę. Wybrano wzorzec JUŻ UŻYTY w tej tabeli dla dokładnie tego samego
-- problemu „dokładnie jedno z kilku FK, unikalność po tym jednym":
-- `resource_id = COALESCE(auditor_id, crew_id)` (migracja 20260910100000, ten sam
-- wzorzec w availability_rules i absences). Kolizja identyfikatorów między dziedzinami
-- jest niemożliwa — to UUID-y, a nie klucze sekwencyjne.
--
-- OGRANICZENIE NIE JEST ODROCZONE (i być nie może: indeksy częściowe nie dają się
-- wyrazić jako UNIQUE CONSTRAINT, więc nie ma DEFERRABLE). SKUTEK DLA
-- CRM-BOOK-HISTORY, do uwzględnienia przez implementera przekładania terminu:
-- w jednej transakcji NAJPIERW UPDATE starego wiersza na RELEASED, DOPIERO POTEM
-- INSERT nowego. Odwrotna kolejność kończy się 23505 — poprawnie, bo w chwili
-- wstawienia podmiot miałby dwie aktywne rezerwacje.
--
-- NARUSZENIE: SQLSTATE 23505 (unique_violation) — INNY kod niż 23P01
-- (exclusion_violation) z bookings_no_overlap_per_resource. Warstwa domenowa musi
-- je rozróżniać: 23P01 = „ten pracownik jest w tym oknie zajęty" (sensowne jest
-- ponowienie na innym kandydacie z puli), 23505 = „ten podmiot już ma rezerwację"
-- (ponowienie na innym kandydacie NIE MA sensu, bo skończy się tak samo).
-- Żaden z nich nie ma prawa wydostać się na zewnątrz jako 500.
-- ============================================================================

-- Idempotentnie. ADD COLUMN IF NOT EXISTS działa również dla GENERATED ALWAYS AS.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS subject_id UUID
    GENERATED ALWAYS AS (COALESCE(lead_id, service_id, incident_id)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_per_subject
  ON public.bookings (subject_id)
  WHERE (status IN ('RESERVED', 'CONFIRMED'));

COMMENT ON COLUMN public.bookings.subject_id IS
  'Kolumna GENEROWANA = COALESCE(lead_id, service_id, incident_id). Nośnik unikalności „jedna aktywna rezerwacja na podmiot" (FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT). Ten sam wzorzec co resource_id = COALESCE(auditor_id, crew_id). Prisma kolumn generowanych nie wyraża — NIE dodawać jej jako zwykłego pola do modelu Booking.';

COMMENT ON INDEX public.bookings_one_active_per_subject IS
  'Jeden podmiot (lead, serwis albo usterka) ma NAJWYŻEJ JEDNĄ rezerwację w statusie RESERVED lub CONFIRMED. Częściowy, bo CRM-BOOK-HISTORY wymaga wielu wierszy na podmiot w historii przekładań (reschedule_of); RELEASED i COMPLETED nie blokują. Naruszenie: SQLSTATE 23505, do zamiany na błąd domenowy „ten podmiot ma już rezerwację", nigdy na 500. NIE jest odroczony: przełożenie terminu musi ustawić stary wiersz na RELEASED PRZED wstawieniem nowego.';
