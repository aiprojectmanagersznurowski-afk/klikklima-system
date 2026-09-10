-- ============================================================================
-- CRM-PROJECT-NUMBER — czytelny numer projektu obok UUID
-- WYMAGANIE: CRM-PROJECT-NUMBER (contracts/requirements.contract.mjs)
-- Źródło decyzji: decyzja Michała 2026-09-10 (okno FLD-CALENDAR-FOUNDATION, punkt 7).
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  NIE URUCHOMIONA NA ŻYWEJ BAZIE. Osobny, jawny krok za zgodą człowieka.               ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- OSOBNY PLIK od 20260910100000, mimo tego samego okna: tamten zakłada wyłącznie nowe
-- obiekty, ten ALTERuje istniejącą tabelę z danymi i przepisuje ją. Różne ryzyko i różny
-- czas blokady — sklejenie ich w jeden plik oznaczałoby, że wycofanie jednego wymusza
-- wycofanie drugiego.
--
-- CZEGO TA MIGRACJA NIE ROBI: nie rusza klucza głównego. `leady.id` (UUID) pozostaje PK
-- i pozostaje jedynym identyfikatorem w kluczach obcych. `project_number` jest numerem
-- DLA LUDZI — do podania przez telefon, do wpisania na dokumencie. Zamiana PK na sekwencję
-- przepisałaby każdy klucz obcy w schemacie i nie kupiła nic poza czytelnością, którą
-- osobna kolumna daje za darmo.
--
-- NAZWA KOLUMNY PO ANGIELSKU mimo polskiej nazwy tabeli — ta sama zasada co przy
-- `audytorzy.is_active` i `leady.logistics_sla_paused_at`: dług nazewniczy KK-NAMING-BASELINE
-- jest ZAMROŻONY, obejmuje nazwy istniejące, a nie zwalnia z ADR-002 nowych kolumn.
--
-- FORMAT: 'L-' || sześć cyfr z wiodącymi zerami, np. L-000123. Uzasadnienie:
--   * stała szerokość — sortowanie tekstowe pokrywa się z chronologią do L-999999,
--     inaczej L-1000 stanąłby przed L-999;
--   * prefiks literowy — numer podany przez telefon nie miesza się z numerem faktury
--     ani z kwotą, a wklejony do wyszukiwarki jednoznacznie wskazuje leada;
--   * ŚWIADOMIE BEZ ROCZNIKA. Numer z rokiem (L-2026-000123) wymusza sekwencję zerowaną
--     co roku, czyli zadanie w noc sylwestrową i unikalność złożoną z dwóch pól. Rok jest
--     już w `created_at` i nie musi być drugi raz w identyfikatorze;
--   * sekwencja Postgresa, nie MAX(...)+1 — numeracja liczona zapytaniem daje duplikat
--     przy dwóch równoległych leadach, dokładnie tak jak sprawdzanie wolnego slotu w JS.
--     Dziury po wycofanych transakcjach są ceną zamierzoną: numer ma być unikalny
--     i rosnący, a nie ciągły.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.leads_project_number_seq AS BIGINT START WITH 1;

-- Kolejność wymuszona twardą zasadą „NOT NULL bez wartości domyślnej na istniejącej
-- tabeli jest zabroniony": najpierw kolumna nullowalna z wartością domyślną, potem
-- backfill, dopiero na końcu ograniczenia. DEFAULT jest tu funkcją zmienną (nextval),
-- więc ADD COLUMN przepisuje tabelę i nadaje KAŻDEMU istniejącemu wierszowi własny numer.
ALTER TABLE public.leady
  ADD COLUMN IF NOT EXISTS project_number TEXT
  DEFAULT ('L-' || lpad(nextval('public.leads_project_number_seq')::text, 6, '0'));

-- Backfill obronny. Przy ADD COLUMN z DEFAULT nie powinien znaleźć ani jednego wiersza;
-- istnieje na wypadek ponownego uruchomienia pliku po tym, jak kolumna została dodana
-- inną drogą (IF NOT EXISTS wyżej milcząco pomija ALTER, a nie sprawdza, czy DEFAULT jest).
UPDATE public.leady
   SET project_number = 'L-' || lpad(nextval('public.leads_project_number_seq')::text, 6, '0')
 WHERE project_number IS NULL;

-- Dopiero teraz ograniczenia — na kolumnie, która ma już wartość w każdym wierszu.
ALTER TABLE public.leady
  ALTER COLUMN project_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leady_project_number_key'
  ) THEN
    ALTER TABLE public.leady
      ADD CONSTRAINT leady_project_number_key UNIQUE (project_number);
  END IF;
END
$$;

-- Sekwencja ma tylko jednego użytkownika. OWNED BY sprawia, że nie zostanie sierotą,
-- gdyby kolumna kiedykolwiek zniknęła.
ALTER SEQUENCE public.leads_project_number_seq OWNED BY public.leady.project_number;

COMMENT ON COLUMN public.leady.project_number IS
  'Czytelny numer projektu (CRM-PROJECT-NUMBER), format L-000123. Numer DLA LUDZI — nie jest kluczem głównym, nie występuje w kluczach obcych, nie zastępuje leady.id (UUID). Nadawany z sekwencji leads_project_number_seq; dziury w numeracji po wycofanych transakcjach są zamierzone.';
