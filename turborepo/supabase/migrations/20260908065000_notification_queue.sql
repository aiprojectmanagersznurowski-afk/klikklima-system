-- ============================================================================
-- NTF-QUEUE-TABLE — WO LOGISTICS-SHIPPING-EFFECTS, Faza B (schemat, bez integracji)
-- WYMAGANIE: NTF-QUEUE-TABLE (contracts/requirements.contract.mjs)
-- Źródło decyzji: docs/workorders/LOGISTICS-SHIPPING-EFFECTS.md,
--                 sekcja "Zmiana kontraktu / schematu — WYMAGANA", punkty 1, 3, 4;
--                 contracts/notifications.contract.mjs QUEUE_POLICY (ADR-007).
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  UWAGA: TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE.                           ║
-- ║  Napisana 2026-09-08, zacommitowana jako plik, świadomie NIEZAAPLIKOWANA.             ║
-- ║  Uruchomienie wymaga OSOBNEJ, JAWNEJ zgody człowieka.                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- ZAKRES: tabela `notification_queue` istnieje w schemacie PRZED jakimkolwiek producentem
-- (`enqueueNotification()`) i konsumentem (worker). To jest Faza B WO LOGISTICS-SHIPPING-EFFECTS
-- w wersji "schemat + rejestracja", NIE "schemat + helper" — `enqueueNotification()` i wpięcie
-- go w Server Actions logistyki to Faza C tego samego WO, poza zakresem tego pliku.
--
-- Zmiana ADDYTYWNA: nowa tabela, zero DROP, zero RENAME, zero ALTER na istniejącej tabeli.
--
-- Nazewnictwo (ADR-002): tabela i kolumny po angielsku, snake_case, model Prisma
-- NotificationQueue z @@map("notification_queue"). Zgodnie z RESOURCES (rbac.contract.mjs),
-- gdzie 'notification_queue' już istnieje jako zasób objęty uprawnieniami.
--
-- `status` jako TEXT + CHECK, nie natywny ENUM Postgresa — ten sam wybór i to samo
-- uzasadnienie co przy `audit_log.operation`/`.resource`/`.legal_basis`
-- (20260901220000_rodo_audit_log_and_client_anonymization.sql): słownik statusów kolejki
-- może się rozszerzyć (np. `NTF-RETRY` wprowadza doprecyzowanie zachowania DEAD_LETTER),
-- a ALTER TYPE ... ADD VALUE nie działa w tej samej transakcji co reszta migracji.
--
-- CHECK "dokładnie jedno powiązanie" (NTF-POLY) — ten sam wzorzec `num_nonnulls(...) = 1`
-- co `availability_declarations_one_owner` (20260821120000) i `employee_consents_one_owner`
-- (20260821130000).
--
-- RLS: `notification_queue` nie ma dziś ŻADNEGO konsumenta przez supabase-js — jest
-- Prisma-only, jak reszta panelu B2B (Prisma łączy się jako `postgres` z rolbypassrls = true,
-- patrz 20260824185845_security_enable_rls_baseline.sql). ENABLE bez żadnej polityki:
-- brak polityki = odmowa, ten sam wzorzec deny-by-default co reszta tabel Prisma-only
-- w tamtej migracji.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id                 TEXT PRIMARY KEY,

  -- ID z katalogu powiadomień (contracts/notifications.contract.mjs NOTIFICATIONS), np. "N5".
  notification_id    TEXT NOT NULL,

  template_key       TEXT NOT NULL,
  channel            TEXT NOT NULL,

  recipient_type     TEXT NOT NULL,
  recipient_address  TEXT,

  payload            JSONB NOT NULL,

  status             TEXT NOT NULL DEFAULT 'PENDING',

  attempts           INTEGER NOT NULL DEFAULT 0,

  last_error         TEXT,
  next_attempt_at    TIMESTAMPTZ(6),
  dead_lettered_at   TIMESTAMPTZ(6),

  -- QUEUE_POLICY.requiresIdempotencyKey: true. Kolizja przy retry łapana jako P2002
  -- po stronie Prisma i traktowana jako sukces, nie jako błąd.
  idempotency_key    TEXT NOT NULL,

  -- NTF-POLY: dokładnie jedno z czterech poniżej jest niepuste. Bez FK do tabel docelowych
  -- na tym etapie (Faza B nie integruje z żadną Server Action) — dodanie FK ON DELETE
  -- to decyzja Fazy C, gdy będzie wiadomo, jak kolejka ma się zachować przy usunięciu
  -- rekordu nadrzędnego.
  lead_id            UUID,
  installation_id    UUID,
  service_id         UUID,
  incident_id        UUID,

  created_at         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT notification_queue_status_check CHECK (status IN (
    'PENDING', 'SENT', 'ERROR', 'DEAD_LETTER'
  )),

  CONSTRAINT notification_queue_one_owner CHECK (
    num_nonnulls(lead_id, installation_id, service_id, incident_id) = 1
  ),

  CONSTRAINT notification_queue_idempotency_key_key UNIQUE (idempotency_key)
);

-- Przyszły worker odpytujący `WHERE status = 'PENDING'` (poza zakresem tej fazy, ale
-- indeks jest tani do założenia teraz i tani do utrzymania na pustej/małej tabeli).
CREATE INDEX IF NOT EXISTS notification_queue_status_idx
  ON public.notification_queue (status);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
-- Brak CREATE POLICY: deny-by-default. Jedyny pisarz to Prisma (rolbypassrls = true),
-- która i tak omija RLS — polityka bez wskazanego konsumenta supabase-js byłaby
-- zgadywanką, nie zabezpieczeniem (ten sam argument co w 20260824185845).

COMMENT ON TABLE public.notification_queue IS
  'Kolejka powiadomień (NTF-QUEUE-TABLE, ADR-007/QUEUE_POLICY). Faza B WO LOGISTICS-SHIPPING-EFFECTS: tabela istnieje, producent (enqueueNotification) i konsument (worker) NIE istnieją jeszcze — Faza C.';
COMMENT ON COLUMN public.notification_queue.notification_id IS
  'ID z katalogu powiadomień, contracts/notifications.contract.mjs NOTIFICATIONS (np. "N5", "N_ROLLBACK", "I4"). Zero literałów w kodzie akcji — czytane z kontraktu.';
COMMENT ON COLUMN public.notification_queue.idempotency_key IS
  'Format: `${notification_id}:${leadId}:${transitionId}:${bucketKey}` (D3, WO LOGISTICS-SHIPPING-EFFECTS). Unikalny — kolizja przy retry to sukces, nie błąd.';
