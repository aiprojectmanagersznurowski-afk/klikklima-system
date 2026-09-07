-- TICKET: SEC-AUTHZ-DEFAULT-ROLE — usunięcie fail-open defaultu roli admina
-- WYMAGANIA: SEC-AUTHZ-DEFAULT-ROLE (contracts/requirements.contract.mjs)
-- WORK ORDER: docs/workorders/SEC-AUTHZ-DEFAULT-ROLE.md
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  URUCHOMIONA NA ŻYWEJ BAZIE 2026-09-07 (za jawną zgodą człowieka).                    ║
-- ║  Weryfikacja bezpośrednim zapytaniem po uruchomieniu:                                ║
-- ║  information_schema.columns → role: is_nullable='NO', column_default=NULL.           ║
-- ║  pg_constraint → authorized_user_role_check obecny, definicja:                       ║
-- ║  CHECK ((role = ANY (ARRAY['admin','dyspozytor','audytor','monter']))).              ║
-- ║  Wszystkie 4 istniejące konta AuthorizedUser mają niezmienione, poprawne role.        ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- POWÓD. `public."AuthorizedUser".role` miała `DEFAULT 'admin'` od `baseline.sql`. Jedyny
-- dzisiejszy punkt zapisu (`addAuthorizedUser` w apps/b2b-web/src/app/(dashboard)/settings/
-- actions.ts) przekazuje `role` explicite i waliduje je względem `ROLES`, więc default nigdy
-- nie jest dziś użyty przez tę ścieżkę. Ale jest to fail-open: KAŻDY inny, przyszły punkt
-- zapisu (ręczny INSERT, seed, hipotetyczny trigger Supabase Auth), który pominie kolumnę
-- `role`, dostałby cicho `'admin'` — cichą eskalację uprawnień, nie błąd. Usunięcie DEFAULT
-- (kolumna zostaje `NOT NULL` bez zmiany, tak jak od baseline) zmienia to w odrzucony INSERT.
--
-- DECYZJA CZŁOWIEKA (2026-09-07, patrz docs/workorders/SEC-AUTHZ-DEFAULT-ROLE.md, sekcja
-- „WYMAGA DECYZJI"): w tej samej migracji dodajemy też `CHECK (role IN (...))` egzekwujący
-- `ROLES` z `contracts/rbac.contract.mjs` — druga, bazodanowa linia obrony przeciw wartości
-- NIEPRAWIDŁOWEJ (literówka wpisana ręcznie z psql), nie tylko przeciw wartości BRAKUJĄCEJ.
-- Wzorzec składniowy i nazewniczy przejęty z `audit_log_operation_check` /
-- `audit_log_resource_check` (20260901220000_rodo_audit_log_and_client_anonymization.sql).
--
-- RYZYKO PRZYJĘTE ŚWIADOMIE (patrz WO, sekcja „Ryzyka i nieznane"). `ROLES` w
-- `contracts/rbac.contract.mjs` i ten CHECK muszą być synchronizowane RĘCZNIE przy każdej
-- przyszłej zmianie ról — nic w tym repo nie wykrywa tego dryfu automatycznie (w odróżnieniu
-- od `kk-codegen.mjs --check` dla wygenerowanego TypeScript). Zapomniana aktualizacja objawi
-- się jako `23514 check_violation` na produkcji przy pierwszej próbie przypisania nowej roli,
-- nie przy `kk-validate.mjs`. Ten sam rodzaj ryzyka już istnieje i jest zaakceptowany dla
-- `audit_log_operation_check` / `audit_log_resource_check` — nie jest to nowy typ długu.
--
-- WERYFIKACJA ŻYWEJ BAZY PRZED URUCHOMIENIEM (AC4 w WO — potwierdzone 2026-09-07, 4 wiersze,
-- każdy z sensowną rolą; jeśli między napisaniem tego pliku a wdrożeniem minie zauważalny
-- czas, powtórzyć `SELECT COUNT(*) FROM "AuthorizedUser"` i porównać z 4 przed uruchomieniem —
-- migracja nie modyfikuje istniejących wartości, ale CHECK odrzuciłby wiersz z nieprawidłową
-- rolą, gdyby taki się między czasem pojawił).
--
-- NAZEWNICTWO. `public."AuthorizedUser"` jest w PascalCase i wymaga cudzysłowów — model
-- Prisma bez `@@map`. To stan zastany, nie nowa nazwa; ADR-002 nie jest tu łamane (ten sam
-- precedens co w 20260901120000_security_revoke_authorized_user_writes.sql).
--
-- IDEMPOTENTNOŚĆ. `DROP DEFAULT` na kolumnie bez defaultu jest no-opem. `DROP CONSTRAINT
-- IF EXISTS` przed `ADD CONSTRAINT` pozwala bezpiecznie powtórzyć uruchomienie. Osłona
-- `to_regclass` chroni przed wywrotką, gdyby migracja poszła na bazę bez tej tabeli.

DO $$
BEGIN
  IF to_regclass('public."AuthorizedUser"') IS NULL THEN
    RAISE NOTICE 'Tabela public."AuthorizedUser" nie istnieje — pomijam zmianę.';
    RETURN;
  END IF;

  ALTER TABLE public."AuthorizedUser" ALTER COLUMN role DROP DEFAULT;

  ALTER TABLE public."AuthorizedUser" DROP CONSTRAINT IF EXISTS authorized_user_role_check;

  -- ROLES (contracts/rbac.contract.mjs) — 4 wartości.
  ALTER TABLE public."AuthorizedUser" ADD CONSTRAINT authorized_user_role_check
    CHECK (role IN ('admin', 'dyspozytor', 'audytor', 'monter'));
END
$$;

-- WERYFIKACJA PO URUCHOMIENIU (do wykonania ręcznie, gdy człowiek wyrazi zgodę):
--
--   SELECT column_name, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'AuthorizedUser' AND column_name = 'role';
--   -- Oczekiwane: is_nullable = 'NO', column_default IS NULL.
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = '"AuthorizedUser"'::regclass;
--   -- Oczekiwane: wśród wyników nowy CHECK authorized_user_role_check
--   -- z definicją CHECK ((role = ANY (ARRAY['admin', 'dyspozytor', 'audytor', 'monter']))).
--
-- Kontrola negatywna (dowód AC1/AC3, do wykonania w teście migracyjnym, nie ręcznie na
-- produkcji): INSERT bez kolumny `role` odrzucony (NOT NULL); INSERT/UPDATE z `role`
-- spoza czterech wartości odrzucony (`23514 check_violation`).
