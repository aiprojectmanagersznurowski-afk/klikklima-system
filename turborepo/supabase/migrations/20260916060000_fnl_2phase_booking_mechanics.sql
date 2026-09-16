-- ============================================================================
-- FNL-2PHASE-BOOKING-MECHANICS — nośniki mechaniki montażu dwuetapowego
--
-- WYMAGANIA (contracts/requirements.contract.mjs):
--   FNL-2PHASE          — kryt. 2 (nośnik trybu), kryt. 3 (dwa rekordy etapów)
--   FNL-2PHASE-BOOKING  — kryt. 1 (booking_id per etap), kryt. 3 (blokada etapu II)
--
-- ŹRÓDŁO DECYZJI: docs/workorders/FNL-2PHASE-BOOKING-MECHANICS.md,
-- decyzje Michała D1/D2/D3 z 2026-09-16, ADR-005.
--
-- ZAKRES ZAWĘŻONY (D3, decyzja Michała 2026-09-16): wyłącznie mechanika rezerwacji
-- w panelu B2B. Field App, upload zdjęć, generowanie PDF i integracja płatności są
-- odłożone W CAŁOŚCI i wymagają własnego ADR-013. Dlatego w tej tabeli NIE MA i nie
-- ma się pojawić kolumny na zdjęcie, protokół ani status płatności — ich brak jest
-- decyzją, nie przeoczeniem (R8 w WO).
--
-- Zmiana ADDYTYWNA: jedna nowa tabela, jedna nowa kolumna NULLABLE na istniejącej
-- tabeli, zero DROP, zero RENAME. Kolumna `installation_type` jest dodawana bez
-- NOT NULL i bez wartości domyślnej innej niż NULL — backfill nie jest potrzebny,
-- bo NULL ma tu własne znaczenie domenowe („tryb nieustalony"), a nie „brak danych
-- do uzupełnienia".
--
-- ── NAZWA TABELY `instalacje` (ADR-002, świadome odwołanie do zamrożonego długu) ──
-- `instalacje` figuruje w docs/architecture/NAMING.md jako nazwa PORZUCONA (docelowo
-- `installations`). Rename jest osobną, łamiącą kompatybilność zmianą (dług
-- KK-NAMING-BASELINE, zamrożony). Ta migracja NIE tworzy obiektu o porzuconej nazwie —
-- ona ROZSZERZA tabelę, która już istnieje pod tą nazwą, więc `ALTER TABLE` i FK muszą
-- wskazać nazwę FAKTYCZNĄ. Użycie nazwy docelowej dałoby migrację, która się nie wykona.
-- Wszystkie NOWE obiekty tej migracji są po angielsku, snake_case.
-- ============================================================================


-- ============================================================================
-- A. Tabela etapów montażu
-- ============================================================================
--
-- Etapy są PODTABELĄ instalacji, a nie bytem od zera. Wariant „jedna encja z
-- phase_1_booking_id i phase_2_booking_id" odrzucony: FNL-2PHASE kryt. 3 mówi wprost
-- o DWÓCH rekordach, a `installation_phases.booking_id` (l. poj.) jest już utrwalone
-- w komentarzu przy public.bookings (migracja 20260910100000).

CREATE TABLE IF NOT EXISTS public.installation_phases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Powiązanie z leadem jest POŚREDNIE, przez instalacje.lead_id. Zdublowanie tu
  -- `lead_id` utworzyłoby drugą drogę do tej samej prawdy — dokładnie ten błąd,
  -- przed którym ostrzega komentarz przy bookings.lead_id.
  installation_id  UUID NOT NULL REFERENCES public.instalacje(id) ON DELETE CASCADE,

  phase_number     SMALLINT NOT NULL,

  -- NULL do czasu rezerwacji etapu. Dla etapu II NULL jest stanem NORMALNYM aż do
  -- chwili, w której klient zarezerwuje termin — nie jest brakiem danych.
  -- SET NULL, nie CASCADE: skasowanie rezerwacji nie może skasować faktu istnienia
  -- etapu ani jego `completed_at`.
  booking_id       UUID REFERENCES public.bookings(id) ON DELETE SET NULL,

  -- Moment zamknięcia etapu (ADR-002: `_at` = moment). Nośnik guardu
  -- `phaseOneNotCompleted` w postaci jednego IS NULL — bez interpretowania statusu
  -- rezerwacji.
  completed_at     TIMESTAMPTZ(6),

  created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at       TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT installation_phases_phase_number_check CHECK (phase_number IN (1, 2)),

  -- Nośnik IDEMPOTENCJI tworzenia etapów. Bez tego dwa równoległe wywołania robią
  -- cztery wiersze — sprawdzenie w JS nie wystarcza (pułapka 4 z CLAUDE.md).
  CONSTRAINT installation_phases_unique_phase UNIQUE (installation_id, phase_number)
);

-- Jedna rezerwacja obsługuje dokładnie jeden etap. Częściowy, bo NULL-e muszą się
-- powtarzać: etap bez terminu to stan normalny, a zwykłe UNIQUE i tak przepuszcza
-- wiele NULL-i — częściowość zapisuje tę intencję jawnie, zamiast liczyć na semantykę.
CREATE UNIQUE INDEX IF NOT EXISTS installation_phases_booking_id_key
  ON public.installation_phases (booking_id)
  WHERE booking_id IS NOT NULL;

-- PERF-B2B-AUDIT: Postgres nie zakłada indeksu na kolumnie FK sam, a to jest ścieżka
-- odczytu każdego etapu instalacji oraz kaskady leady -> instalacje -> etapy.
CREATE INDEX IF NOT EXISTS installation_phases_installation_id_idx
  ON public.installation_phases (installation_id);

ALTER TABLE public.installation_phases ENABLE ROW LEVEL SECURITY;
-- Brak polityki = odmowa. Jedynym czytelnikiem jest Prisma (rola `postgres`,
-- rolbypassrls = true) — ten sam wzorzec deny-by-default co w 20260824185845
-- i w tabelach kalendarza z 20260910100000. Panel B2B autoryzuje JAWNIE w Server
-- Action, bo Prisma omija RLS (pułapka 1 z CLAUDE.md).

COMMENT ON TABLE public.installation_phases IS
  'Etapy montażu dwuetapowego (FNL-2PHASE kryt. 3, FNL-2PHASE-BOOKING). Dokładnie dwa wiersze na instalację w trybie TWO_PHASE, zero w trybie SINGLE_PHASE i zero przy trybie nieustalonym (NULL). Rezerwacja etapu wisi tutaj (booking_id), a NIE w bookings.installation_id — ta kolumna świadomie nie istnieje.';
COMMENT ON COLUMN public.installation_phases.phase_number IS
  'Numer etapu: 1 (przygotowanie instalacji przed wykończeniem) albo 2 (montaż jednostek po wykończeniu). Etapy NIE SĄ dwoma dniami pod rząd — przerwa liczona jest w tygodniach i NIE MA progu minimalnego (D2, decyzja Michała 2026-09-16).';
COMMENT ON COLUMN public.installation_phases.booking_id IS
  'Osobna rezerwacja dla każdego etapu. Etap I używa koszyka INSTALL_PHASE_1 (480 min), etap II INSTALL_PHASE_2 (240 min) — czas trwania czytany ze słownika visit_duration_baskets, nigdy z literału.';
COMMENT ON COLUMN public.installation_phases.completed_at IS
  'Moment zamknięcia etapu. NULL = etap otwarty. Rezerwacja etapu II nie jest możliwa, dopóki etap 1 ma tu NULL (FNL-2PHASE-BOOKING kryt. 3).';


-- ============================================================================
-- B. Tryb montażu — instalacje.installation_type (D1, wariant (a))
-- ============================================================================
--
-- Decyzja Michała 2026-09-16: pole mieszka na INSTALACJI, nie na leadzie i nie na
-- nieistniejącej tabeli `quotes`. Wariant „obie kolumny, kopiowane" odrzucony —
-- dwie drogi do tej samej prawdy.

ALTER TABLE public.instalacje
  ADD COLUMN IF NOT EXISTS installation_type TEXT DEFAULT NULL;

-- CHECK dodawany osobno i idempotentnie: ADD CONSTRAINT nie ma wariantu IF NOT EXISTS,
-- a ta migracja musi znieść powtórne uruchomienie (wymóg idempotencji z CLAUDE.md).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.instalacje'::regclass
      AND conname  = 'instalacje_installation_type_check'
  ) THEN
    ALTER TABLE public.instalacje
      ADD CONSTRAINT instalacje_installation_type_check
      CHECK (installation_type IN ('SINGLE_PHASE', 'TWO_PHASE'));
  END IF;
END
$$;

-- NULL przechodzi przez ten CHECK celowo (IN zwraca UNKNOWN dla NULL, a CHECK odrzuca
-- wyłącznie FALSE). To jest wymagane: NULL znaczy „tryb nieustalony", nigdy
-- „jednoetapowy" — ten sam wzorzec, co „NULL w promieniu znaczy nieustalony"
-- z CRM-REGION-AUTO. Guard installationIsTwoPhase przepuszcza WYŁĄCZNIE jawne
-- 'TWO_PHASE', więc tryb nieustalony nie tworzy żadnego etapu.
COMMENT ON COLUMN public.instalacje.installation_type IS
  'Tryb montażu ustalony przez audytora na miejscu — wartość WIĄŻĄCA (FNL-2PHASE kryt. 2). SINGLE_PHASE albo TWO_PHASE; NULL = tryb nieustalony, nigdy „jednoetapowy". Deklaracja klienta z Triage jest przesłanką, nie tą wartością.';
