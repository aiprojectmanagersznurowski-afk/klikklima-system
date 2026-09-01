-- ============================================================================
-- CLIENT-ANONYMIZATION-RODO — Faza A (kontrakt i schemat)
-- WYMAGANIA: SEC-AUDIT-LOG-APPEND-ONLY, CRM-CLIENT-ANONYMIZE-RODO
-- Źródło decyzji: docs/workorders/CLIENT-ANONYMIZATION-RODO.md,
--                 sekcje „Projekt tabeli audit_log", „Klasyfikacja kolumn", „Podział na fazy → Faza A"
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  UWAGA: TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE.                           ║
-- ║  Napisana 2026-09-01, zacommitowana jako plik, świadomie NIEZAAPLIKOWANA.             ║
-- ║  Uruchomienie wymaga OSOBNEJ, JAWNEJ zgody człowieka.                                 ║
-- ║  Dopóki jej nie ma, treść poniżej opisuje stan POSTULOWANY, a nie stan bazy.          ║
-- ║  Nie traktuj obecności tego pliku ani zielonego testu statycznego jako dowodu,        ║
-- ║  że audit_log istnieje albo że jest append-only — plik zamraża INTENCJĘ, nie serwer.  ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- Ryzyko 4 z WO („nie wiadomo, czy audit_log istnieje w żywej bazie") zaadresowane nie
-- sprawdzeniem, którego nie da się tu wykonać, tylko kształtem samego SQL-a: CREATE TABLE
-- IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + DROP TRIGGER IF EXISTS. Uruchomienie na bazie,
-- w której tabela już jest, nie kasuje jej i nie kasuje danych. Świadoma cena: jeżeli tabela
-- istnieje o INNYM kształcie, ta migracja przejdzie po cichu, nie naprawiając go — dlatego
-- pierwszym krokiem uruchomienia (przez człowieka) musi być \d public.audit_log, a nie psql -f.
--
-- Zmiana ADDYTYWNA i IDEMPOTENTNA. Zero DROP, zero RENAME, zero backfillu.
-- Zero NOT NULL bez wartości domyślnej na ISTNIEJĄCEJ tabeli: kolumny NOT NULL są wyłącznie
-- w audit_log, która powstaje pusta; klienci dostaje kolumnę NULLABLE.
--
-- Nazewnictwo (ADR-002): tabela i kolumny po angielsku, snake_case, model Prisma AuditLog
-- z @@map. Nazwa `klienci` to odwołanie do ISTNIEJĄCEGO obiektu — zamrożony dług
-- KK-NAMING-BASELINE, nie nowa polska nazwa (docs/architecture/NAMING.md).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. audit_log — rejestr operacji wrażliwych (AUDIT_REQUIREMENTS)
-- ─────────────────────────────────────────────────────────────────────────────
-- Słowniki wartości (operation, resource, legal_basis) egzekwowane CHECK-iem na TEXT,
-- a nie typem ENUM. To odstępstwo od precedensu 20260821120000 (tam enum) jest zamierzone:
-- RESOURCES rośnie (13 → 23 wartości od ADR-012), a ALTER TYPE ... ADD VALUE nie działa
-- w tej samej transakcji, co wymuszałoby osobny plik migracji przy każdym nowym zasobie.
-- CHECK aktualizuje się jednym ALTER ... DROP CONSTRAINT / ADD CONSTRAINT w transakcji.
-- CHECK na `resource` zamrożony do 13 wartości z RESOURCES sprzed ADR-012 — dokładnie tyle,
-- ile wymienia WO. Rozszerzenie na zasoby z ADR-012 wymaga osobnej, jawnej zmiany kontraktu.
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- „Kto". TEXT, nie FK do "AuthorizedUser": usunięcie konta nie może skasować ani osierocić
  -- dowodu (ta sama logika co ON DELETE RESTRICT w employee_consents, tylko mocniejsza).
  -- NOT NULL jest bramką fail-closed — zalogowany bez e-maila nie wykona operacji.
  actor_email   TEXT NOT NULL,

  -- Rola W CHWILI OPERACJI. Konto może później zmienić rolę albo zniknąć.
  actor_role    TEXT NOT NULL,

  operation     TEXT NOT NULL,
  resource      TEXT NOT NULL,

  -- „Na jakim rekordzie". TEXT bez FK — tabela jest wspólna dla wszystkich zasobów,
  -- a "AuthorizedUser".id to cuid(), nie uuid. FK do klienci byłby złamany przy każdej innej
  -- wartości resource, a RESTRICT zablokowałby kiedyś tę samą operację delete, którą ten
  -- rejestr ma dokumentować (ryzyko 5 w WO — świadome).
  record_id     TEXT NOT NULL,

  justification TEXT NOT NULL,
  legal_basis   TEXT NOT NULL,

  -- „Kiedy". UTC, spójnie z resztą schematu. Nigdy nie zmieniane (punkt 3).
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Brak updated_at — nie ma czego aktualizować w tabeli, której nikt nie aktualizuje.

  -- AUDIT_REQUIREMENTS.mustLog — 6 wartości.
  CONSTRAINT audit_log_operation_check CHECK (operation IN (
    'delete', 'anonymize', 'role_change', 'contract_override',
    'manual_status_change', 'notification_resend'
  )),

  -- RESOURCES (rbac.contract.mjs) — 13 wartości.
  CONSTRAINT audit_log_resource_check CHECK (resource IN (
    'clients', 'leads', 'quotes', 'installations', 'services', 'incidents',
    'auditors', 'crews', 'shipments', 'notification_queue', 'message_templates',
    'authorized_users', 'audit_log'
  )),

  -- AUDIT_REQUIREMENTS.requiresJustification: true. Pusty string i same białe znaki nie są
  -- uzasadnieniem — sprawdza to baza, bo walidacja Zod w Server Action jest wygodą dla
  -- użytkownika, a nie gwarancją (Prisma omija RLS, ale CHECK-a nie omija).
  CONSTRAINT audit_log_justification_min_length CHECK (length(btrim(justification)) >= 10),

  -- AUDIT_REQUIREMENTS.legalBases — 5 wartości.
  CONSTRAINT audit_log_legal_basis_check CHECK (legal_basis IN (
    'RODO_ERASURE_REQUEST', 'OPERATIONAL_ERROR', 'DUPLICATE', 'COURT_ORDER', 'OTHER'
  ))
);

-- „Co się działo z tym rekordem" — główne zapytanie rejestru (AC3: liczba wpisów dla
-- record_id po N wywołaniach wynosi 1).
CREATE INDEX IF NOT EXISTS audit_log_resource_record_id_idx
  ON public.audit_log (resource, record_id);

-- Przegląd chronologiczny i przyszła retencja (retentionDays = 1825, poza zakresem WO).
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON public.audit_log (created_at);

COMMENT ON TABLE public.audit_log IS
  'Rejestr operacji wrazliwych (AUDIT_REQUIREMENTS.mustLog): kto, co, na czym, dlaczego, na jakiej podstawie prawnej, kiedy. APPEND-ONLY w trzech warstwach: MATRIX (update/delete puste), RLS (brak polityk UPDATE/DELETE dla KAZDEJ roli, lacznie z admin) oraz wyzwalacz audit_log_append_only_trg — jedyna warstwa dzialajaca przeciw zapisowi Prisma, ktora omija RLS.';
COMMENT ON COLUMN public.audit_log.actor_email IS
  'Kto wykonal operacje. TEXT, nie klucz obcy — usuniecie konta nie moze skasowac dowodu. Zrodlo: auth.getUser().email, bo getCurrentActorRole() zwraca sama role, nigdy tozsamosci.';
COMMENT ON COLUMN public.audit_log.actor_role IS
  'Rola w chwili operacji, utrwalona. Pozniejsza zmiana roli konta nie zmienia tego wpisu.';
COMMENT ON COLUMN public.audit_log.operation IS
  'Os OPERACJI AUDYTOWYCH, nie zdolnosci RBAC. Anonimizacja klienta zapisuje sie jako anonymize, a bramka pyta can(role, clients, delete) — te osie sie nie pokrywaja i nie musza.';
COMMENT ON COLUMN public.audit_log.record_id IS
  'Identyfikator rekordu jako TEXT, bez klucza obcego (ryzyko 5 w WO, swiadome): wpis moze wskazywac rekord, ktory juz nie istnieje — i to jest sens rejestru operacji delete.';
COMMENT ON COLUMN public.audit_log.justification IS
  'Uzasadnienie operacji. CHECK wymaga >= 10 znakow po btrim — pusty string nie jest uzasadnieniem.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS na audit_log — odmowa domyślna dla UPDATE i DELETE
-- ─────────────────────────────────────────────────────────────────────────────
-- WŁĄCZAMY RLS i NIE piszemy ani jednej polityki UPDATE/DELETE. Przy włączonym RLS brak
-- pasującej polityki oznacza odmowę — polityka „zakazująca" (USING false) byłaby zapisem
-- tego samego innymi słowami i dawałaby fałszywe wrażenie, że gdzieś istnieje wyjątek.
-- Polityk SELECT/INSERT ten plik również nie tworzy: dostęp odczytowy i zapisowy do rejestru
-- idzie dziś WYŁĄCZNIE przez Prismę (rola właściciela, omija RLS), a MATRIX mówi
-- read: ['admin'], create: ['admin'] — egzekwowane w Server Action. Dodanie polityk dla
-- anon/authenticated bez ekranu „Rejestr audytowy" otwierałoby dostęp, którego nikt nie używa.
--
-- Warstwa RLS NIE chroni przed Prismą (pułapka 1 w CLAUDE.md). Przed nią chroni punkt 3.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Wyzwalacz append-only (AC9, SEC-AUDIT-LOG-APPEND-ONLY)
-- ─────────────────────────────────────────────────────────────────────────────
-- Wzorzec skopiowany z employee_consents_append_only_trg (20260821130000), rozszerzony
-- o DELETE: tam usunięcie akceptacji było odcięte kluczem obcym RESTRICT, tutaj nie ma
-- żadnego FK, więc DELETE musi odciąć ten sam wyzwalacz.
--
-- Dlaczego wyzwalacz, a nie CHECK / REVOKE / RLS:
--   * CHECK nie widzi OLD, więc nie odróżni UPDATE od INSERT;
--   * REVOKE nie działa na rolę właściciela, którą łączy się Prisma;
--   * RLS Prisma omija.
-- Zostaje wyzwalacz albo obietnica. Rejestr audytowy oparty na obietnicy nie jest dowodem.
CREATE OR REPLACE FUNCTION public.audit_log_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_log: rejestr audytowy jest append-only (SEC-AUDIT-LOG-APPEND-ONLY). Wpisu nie edytuje sie i nie usuwa — takze rola admin. Sprostowanie to NOWY WIERSZ.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_append_only_trg ON public.audit_log;
CREATE TRIGGER audit_log_append_only_trg
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_append_only();

COMMENT ON FUNCTION public.audit_log_append_only() IS
  'AC9: odrzuca UPDATE i DELETE na audit_log takze dla polaczenia omijajacego RLS (Prisma). Uruchomienie zadania retencyjnego (retentionDays = 1825) bedzie wymagalo jawnego wylaczenia tego wyzwalacza przez administratora bazy — to konflikt znany i zapisany, poza zakresem tego WO.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. klienci.anonymized_at — znacznik anonimizacji (Faza A, punkt A2)
-- ─────────────────────────────────────────────────────────────────────────────
-- Kolumna NULLABLE, bez wartości domyślnej, bez backfillu i BEZ planu późniejszego NOT NULL:
-- NULL ma znaczenie domenowe „rekord nietknięty", czyli poprawny stan każdego istniejącego
-- wiersza. Bez tej kolumny idempotencja (AC3) jest niesprawdzalna — „imie_i_nazwisko =
-- 'Klient usunięty'" to porównanie po treści, którą może wpisać człowiek.
--
-- Faza B używa jej jako bramki WSPÓŁBIEŻNOŚCI: updateMany z where { id, anonymized_at IS NULL },
-- gdzie zwrócone count rozstrzyga wyścig w bazie. Wariant „findUnique, potem update" jest
-- niedopuszczalny — to ta sama klasa błędu co sprawdzanie wolnego slotu w JS (pułapka 4).
ALTER TABLE public.klienci
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ(6);

COMMENT ON COLUMN public.klienci.anonymized_at IS
  'CRM-CLIENT-ANONYMIZE-RODO: moment anonimizacji danych osobowych klienta (UTC). NULL = rekord nietkniety. Ustawiany raz; powtorne wywolanie anonimizacji NIE przesuwa znacznika i NIE tworzy drugiego wpisu w audit_log (AC3). Rekord i jego identyfikator ZOSTAJA — historia montazu ma przetrwac usuniecie danych osobowych.';
