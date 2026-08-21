-- WO: FLD-AVAILABILITY-SPLIT — rozdzielenie blokady administracyjnej od deklaracji pracownika
-- Decyzja D-A (człowiek, 2026-08-21): trzy pojęcia, trzy pola, trzej właściciele.
--
--   1. is_active (audytorzy) / aktywny (zespoly_monterskie)  — ADMIN, bezpieczeństwo. BEZ ZMIAN.
--   2. leave_status                                          — ADMIN, kadry. Nowa kolumna, enum.
--   3. availability_declarations.is_available                — PRACOWNIK. Nowa tabela.
--
-- Punkt 3 jest OSOBNĄ TABELĄ, a nie kolumną, i to jest sedno zmiany: macierz RBAC oraz RLS
-- operują na tabelach, nie na kolumnach. Gdyby deklaracja pracownika była kolumną na audytorzy,
-- nadanie mu prawa `update` na tym zasobie nadałoby przy okazji prawo zapisu is_active — czyli
-- pozwoliłoby zdjąć sobie blokadę nałożoną przez administratora (R2 w WO).
--
-- Zmiana ADDYTYWNA i IDEMPOTENTNA (AC7). Zero NOT NULL bez wartości domyślnej na istniejącej
-- tabeli. Zero RENAME, zero DROP. NIE URUCHAMIANA na żadnej bazie w ramach tego ticketu.
--
-- Nazwy tabel audytorzy / zespoly_monterskie są długiem KK-NAMING-BASELINE (zamrożonym),
-- dlatego nowe obiekty nazywają się po angielsku, a stare zostają — patrz docs/architecture/NAMING.md.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Słownik statusu kadrowego (AC6)
-- ─────────────────────────────────────────────────────────────────────────────
-- Prawdziwy typ enum, nie TEXT + CHECK: wartość spoza słownika ma odrzucać baza, także dla
-- zapisu wykonanego z pominięciem Server Action (Prisma i tak omija RLS, więc baza jest
-- ostatnią warstwą, która cokolwiek gwarantuje).
--
-- CREATE TYPE nie ma IF NOT EXISTS, stąd blok DO. Nowy typ MOŻNA użyć w tej samej transakcji,
-- w której powstał — ograniczenie dotyczy wyłącznie ALTER TYPE ... ADD VALUE, dlatego ten plik
-- nie musi być dzielony na dwa (inaczej niż 20260820120000_crm_safe_record_actions_enum.sql).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typname = 'LeaveStatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public."LeaveStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SICK_LEAVE');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Status kadrowy na obu encjach pracowniczych (własność administratora)
-- ─────────────────────────────────────────────────────────────────────────────
-- NOT NULL jest dopuszczalne, bo kolumna ma wartość domyślną: istniejące rekordy dostają ACTIVE
-- i żaden pracownik nie znika z puli w chwili wdrożenia (AC7).
--
-- Obie encje symetrycznie, mimo że dziś nic nie czyta zespoly_monterskie.aktywny w celach
-- autoryzacyjnych (R3 w WO). Brak konsumenta po stronie ekip jest luką do domknięcia w warstwie
-- serwerowej, a nie powodem, żeby ekipy zostały bez tego pojęcia w schemacie.

ALTER TABLE public.audytorzy
  ADD COLUMN IF NOT EXISTS leave_status public."LeaveStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.zespoly_monterskie
  ADD COLUMN IF NOT EXISTS leave_status public."LeaveStatus" NOT NULL DEFAULT 'ACTIVE';

COMMENT ON COLUMN public.audytorzy.leave_status IS
  'Status kadrowy wpisywany przez ADMINISTRATORA: ACTIVE / ON_LEAVE / SICK_LEAVE (CRM par. 5). To NIE jest deklaracja pracownika (availability_declarations.is_available) ani blokada konta (is_active). Docelowo przenosi sie do datowanej tabeli absences (ADR-012, faza 4).';
COMMENT ON COLUMN public.zespoly_monterskie.leave_status IS
  'Status kadrowy ekipy wpisywany przez ADMINISTRATORA: ACTIVE / ON_LEAVE / SICK_LEAVE. Symetryczny do audytorzy.leave_status.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Deklaracja dostępności pracownika (własność pracownika) — OSOBNA TABELA
-- ─────────────────────────────────────────────────────────────────────────────
-- Jeden wiersz na pracownika, wskazywany DOKŁADNIE jednym z dwóch kluczy obcych.
-- num_nonnulls(...) = 1 wyklucza zarówno wiersz osierocony (oba NULL), jak i wiersz opisujący
-- naraz audytora i ekipę. Bez tego CHECK-a tabela dopuszczałaby rekord, do którego nie da się
-- sensownie zastosować reguły „:own" z macierzy RBAC.
--
-- Klucze obce z ON DELETE CASCADE: deklaracja bez pracownika nie znaczy nic. To NIE osłabia
-- polityki BLOCK_UNTIL_REASSIGNED z rbac.contract.mjs — tamta blokuje usunięcie audytora
-- z wiszącymi leadami i żyje w Server Action; kaskada dotyczy wyłącznie tego wiersza.

CREATE TABLE IF NOT EXISTS public.availability_declarations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditor_id   UUID REFERENCES public.audytorzy(id) ON DELETE CASCADE,
  crew_id      UUID REFERENCES public.zespoly_monterskie(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at   TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT availability_declarations_one_owner CHECK (num_nonnulls(auditor_id, crew_id) = 1)
);

-- UNIQUE na kolumnie nullable: PostgreSQL dopuszcza wiele NULL-i, więc jeden indeks obsługuje
-- „co najwyżej jedna deklaracja na audytora" i nie przeszkadza wierszom opisującym ekipy.
-- Nazwy indeksów zgodne z konwencją Prisma dla @unique (<tabela>_<kolumna>_key), żeby introspekcja
-- nie zobaczyła dryfu.
CREATE UNIQUE INDEX IF NOT EXISTS availability_declarations_auditor_id_key
  ON public.availability_declarations (auditor_id);
CREATE UNIQUE INDEX IF NOT EXISTS availability_declarations_crew_id_key
  ON public.availability_declarations (crew_id);

COMMENT ON TABLE public.availability_declarations IS
  'Deklaracja dostepnosci pracownika terenowego (D3). WLASCICIEL: PRACOWNIK. Jedyna tabela, na ktorej role audytor/monter maja update w wariancie :own. Brak wiersza = pracownik dostepny.';
COMMENT ON COLUMN public.availability_declarations.is_available IS
  'false = pracownik zadeklarowal wlasna niedostepnosc. NIE zmienia audytorzy.is_active ani leave_status i nie moze byc do tego uzyte.';
COMMENT ON COLUMN public.availability_declarations.updated_at IS
  'Moment ostatniej zmiany deklaracji (timestamptz). Znacznik techniczny; NIE wyznacza granicy doby roboczej pracownika.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS: domyślna odmowa (fail-closed)
-- ─────────────────────────────────────────────────────────────────────────────
-- ŚWIADOME ODSTĘPSTWO od dotychczasowej praktyki repozytorium: żadna wcześniejsza migracja nie
-- dotyka RLS (polityki są konfigurowane poza migracjami). Tutaj jest inaczej, bo nowa tabela bez
-- RLS byłaby po prostu otwarta dla roli anon przez PostgREST — czyli ta migracja sama otworzyłaby
-- dziurę, którą to WO ma zamknąć.
--
-- Włączenie RLS bez polityk = nikt poza właścicielem połączenia nie czyta i nie pisze.
-- Panel B2B tego nie odczuje (Prisma łączy się z pominięciem RLS — patrz pułapka 1 w CLAUDE.md).
-- Field App (faza 3, supabase-js) nie zadziała na tej tabeli, dopóki nie powstaną polityki
-- wyrażające „:own" — i to jest stan pożądany, a nie usterka: brak polityki ma znaczyć odmowę.
-- Autor polityk: osobna pętla z udziałem rls-security-auditor, po decyzji o mapowaniu
-- konta auth.users na rekord audytorzy/zespoly_monterskie (dziś panel B2B robi to po e-mailu).

ALTER TABLE public.availability_declarations ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill (AC7) — żaden istniejący pracownik nie znika z puli
-- ─────────────────────────────────────────────────────────────────────────────
-- Idempotentne: po przebiegu warunek NOT EXISTS nie łapie już żadnego wiersza.
-- Konsument (getAuditors / getCrews) i tak MUSI traktować brak wiersza jako „dostępny", bo
-- pracownik dodany po tej migracji nie dostanie deklaracji automatycznie — backfill zabezpiecza
-- moment wdrożenia, a nie przyszłe wstawki.

INSERT INTO public.availability_declarations (auditor_id, is_available)
SELECT a.id, true
  FROM public.audytorzy a
 WHERE NOT EXISTS (
   SELECT 1 FROM public.availability_declarations d WHERE d.auditor_id = a.id
 );

INSERT INTO public.availability_declarations (crew_id, is_available)
SELECT z.id, true
  FROM public.zespoly_monterskie z
 WHERE NOT EXISTS (
   SELECT 1 FROM public.availability_declarations d WHERE d.crew_id = z.id
 );
