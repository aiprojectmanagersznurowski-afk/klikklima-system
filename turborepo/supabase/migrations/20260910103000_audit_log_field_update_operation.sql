-- ============================================================================
-- AUDIT-LOG-FIELD-UPDATE-OP — rozszerzenie słownika operacji audytowych
-- WYMAGANIA: FLD-BASE-LOCATION-EDIT (risk HIGH)
-- Źródło decyzji: decyzja Michała 2026-09-10 (okno kontraktowe AUDIT-LOG-FIELD-UPDATE-OP)
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  UWAGA: TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE.                           ║
-- ║  Napisana 2026-09-10, zacommitowana jako plik, świadomie NIEZAAPLIKOWANA.             ║
-- ║  Uruchomienie wymaga OSOBNEJ, JAWNEJ zgody człowieka.                                 ║
-- ║  Dopóki jej nie ma, treść poniżej opisuje stan POSTULOWANY, a nie stan bazy.          ║
-- ║  Dopóki nie zostanie uruchomiona, KAŻDY zapis z operation = 'field_update' zostanie   ║
-- ║  odrzucony przez audit_log_operation_check — a ponieważ wpis audytowy i zmiana pól    ║
-- ║  dzielą jedną transakcję, odrzucenie cofnie także samą edycję. Implementacja          ║
-- ║  FLD-BASE-LOCATION-EDIT jest więc zablokowana na tej migracji, nie tylko zależna.     ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- CO SIĘ ZMIENIA
-- Słownik dozwolonych wartości audit_log.operation rośnie z 6 do 7 wartości. Zmiana jest
-- ROZSZERZAJĄCA: zbiór nowy jest nadzbiorem starego, więc żaden istniejący wiersz nie może
-- naruszyć nowego warunku i nie jest potrzebny ani backfill, ani okno serwisowe.
--
-- DLACZEGO DROP + ADD, A NIE „ALTER CONSTRAINT"
-- Postgres nie pozwala zmienić wyrażenia istniejącego CHECK-a w miejscu. To NIE jest przypadek
-- objęty zakazem „DROP + ADD zamiast RENAME" z zasad nazewnictwa — tamten zakaz chroni KOLUMNY
-- (DROP kolumny kasuje dane). Tutaj usuwane jest wyłącznie ograniczenie: kolumna, jej typ
-- i wszystkie wiersze zostają nietknięte.
--
-- DLACZEGO NIE TYP ENUM
-- Zgodnie z pierwotnym projektem tabeli operation pozostaje TEXT + CHECK. Zmiana na typ ENUM
-- byłaby przepisaniem kształtu kolumny przy okazji dopisania jednej wartości.
--
-- OSŁONA to_regclass: jeżeli audit_log jeszcze nie istnieje (migracja RODO niezaaplikowana),
-- ten plik nie może wywrócić całego przebiegu migracji. Świadoma cena jak w migracji źródłowej:
-- przy braku tabeli migracja przechodzi po cichu, NIE tworząc jej.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE NOTICE 'audit_log nie istnieje — pomijam rozszerzenie audit_log_operation_check.';
    RETURN;
  END IF;

  -- IF EXISTS: migracja ma być idempotentna (pułapka 3 z CLAUDE.md w wariancie migracyjnym).
  -- Powtórne uruchomienie nie może wywrócić się na braku już usuniętego ograniczenia.
  ALTER TABLE public.audit_log
    DROP CONSTRAINT IF EXISTS audit_log_operation_check;

  -- AUDIT_REQUIREMENTS.mustLog (contracts/rbac.contract.mjs) — 7 wartości.
  -- Cytat źródła, stan na 2026-09-10:
  --   mustLog: ['delete', 'anonymize', 'role_change', 'contract_override',
  --             'manual_status_change', 'notification_resend', 'field_update']
  -- 'field_update' — operacja ogólna dla edycji pojedynczych pól rekordu, gdzie wpis audytowy
  -- jest WARUNKIEM dopuszczenia edycji, a nie następstwem incydentu. Pierwszy konsument:
  -- FLD-BASE-LOCATION-EDIT (kod_pocztowy_bazowy / promien_dzialania_km w auditors i crews).
  -- Nazwa celowo nie brzmi 'radius_update' — wartość jest do wielokrotnego użytku.
  -- Odrębna od 'manual_status_change', która dotyczy wyłącznie przejść maszyny stanów lejka.
  ALTER TABLE public.audit_log
    ADD CONSTRAINT audit_log_operation_check CHECK (operation IN (
      'delete', 'anonymize', 'role_change', 'contract_override',
      'manual_status_change', 'notification_resend', 'field_update'
    ));
END
$$;

-- UWAGA dla implementacji (nie egzekwowane tą migracją, patrz acceptance FLD-BASE-LOCATION-EDIT):
-- przy operation = 'field_update' kolumna justification jest wyliczana PRZEZ SERWER z wartości
-- przed/po i nie pochodzi od klienta, a legal_basis jest stałą 'OTHER' — ten sam wariant, co
-- w bypassLogisticsOrder. Istniejące audit_log_justification_min_length (>= 10 znaków po btrim)
-- i audit_log_legal_basis_check pozostają BEZ ZMIAN i obowiązują także tę operację.
