-- ============================================================================
-- CAL-SCHEDULING-CONFIG-AUDIT-CHECK — rozszerzenie słownika ZASOBÓW audytowych
-- WO: docs/workorders/CAL-SCHEDULING-CONFIG-UI.md (ryzyko R-6, rozstrzygnięcie P-3)
-- WYMAGANIA: CAL-VISIT-DURATION-BASKETS (MEDIUM), CAL-TRAVEL-BUFFER (MEDIUM)
-- Źródło decyzji: decyzja Michała 2026-09-15 (P-3: zmiany koszyków i bufora MAJĄ być logowane)
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  STAN: TA MIGRACJA ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE 2026-09-15.                     ║
-- ║  Napisana 2026-09-15, zacommitowana najpierw jako plik świadomie NIEZAAPLIKOWANY.     ║
-- ║  Uruchomiona po osobnej, jawnej zgodzie Michała, w tym samym trybie co 20260910103000 ║
-- ║  (nie db push, nie migrate reset).                                                    ║
-- ║  Weryfikacja po fakcie, read-only: pg_get_constraintdef dla                           ║
-- ║  audit_log_resource_check zwraca 15 wartości, w tym 'visit_duration_baskets'          ║
-- ║  i 'system_config' — lista i jej kolejność zgodne co do znaku z blokiem poniżej.      ║
-- ║  Treść poniżej opisuje więc stan FAKTYCZNY bazy, a nie stan postulowany.              ║
-- ║  R-6 z WO jest tym samym ZAMKNIĘTE: updateVisitDurationBasketAction                   ║
-- ║  i updateTravelBufferAction mają w produkcji nośnik dla swojego wpisu audytowego.     ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- CO SIĘ ZMIENIA
-- Słownik dozwolonych wartości audit_log.resource rośnie z 13 do 15 wartości: dochodzą
-- 'visit_duration_baskets' i 'system_config'. Zmiana jest ROZSZERZAJĄCA — zbiór nowy jest
-- nadzbiorem starego, więc żaden istniejący wiersz nie może naruszyć nowego warunku.
-- Nie jest potrzebny ani backfill, ani okno serwisowe. ADD CONSTRAINT przeskanuje istniejące
-- wiersze (audit_log jest mała), a nie znajdzie wśród nich ani jednego naruszenia z definicji.
--
-- DLACZEGO
-- P-3 rozstrzygnięte 2026-09-15: zmiana czasu trwania koszyka wizyty i zmiana bufora dojazdu
-- tworzą wpis `field_update` w audit_log — w TEJ SAMEJ TRANSAKCJI co sam zapis (rekord zmieniony
-- bez wpisu znosi warunek, pod którym edycja została dopuszczona). Stan ograniczenia PRZED
-- uruchomieniem tego pliku, sprawdzony na ŻYWEJ bazie 2026-09-15 przez pg_get_constraintdef,
-- nie odczytany z pliku (zapis historyczny — uzasadnienie, po co ta migracja powstała):
--   audit_log_operation_check -> 7 wartości, 'field_update' JEST (migracja 20260910103000)
--   audit_log_resource_check  -> 13 wartości, NIE MA ani 'visit_duration_baskets',
--                                ani 'system_config'
-- Stan PO uruchomieniu: audit_log_resource_check -> 15 wartości (patrz ramka STAN wyżej).
-- Oba są natomiast od dawna zasobami w contracts/rbac.contract.mjs ('visit_duration_baskets'
-- od 2026-09-10, 'system_config' od okna CAL-SCHEDULING-CONFIG-RBAC z 2026-09-15). Bez tej
-- migracji pierwszy auditLog.create z takim `resource` leci wyjątkiem CHECK i wywraca całą akcję.
--
-- ZAKRES ŚWIADOMIE MINIMALNY — DOPISUJEMY DWIE WARTOŚCI, NIE SYNCHRONIZUJEMY CAŁEJ LISTY
-- RESOURCES w rbac.contract.mjs urosło od 2026-09-01 do ~28 pozycji (bookings, absences,
-- documents, availability_rules, legal_document_versions, …), a ten CHECK wciąż zna 13.
-- Ta rozbieżność ZOSTAJE i jest znana: domknięcie jej w całości znaczyłoby dopuścić do rejestru
-- także zasoby BEZ NOŚNIKA w bazie (np. 'regions' — zasób istnieje w macierzy, tabela nigdy
-- nie powstała, model promieniowy zastąpił regionowy). To osobna decyzja i osobne okno,
-- nie skutek uboczny WO o koszykach. Każdy kolejny zasób, który ma trafić do audit_log,
-- wymaga świadomego dopisania tutaj — walidator tego nie zgadnie.
--
-- DLACZEGO DROP + ADD, A NIE „ALTER CONSTRAINT"
-- Postgres nie pozwala zmienić wyrażenia istniejącego CHECK-a w miejscu. To NIE jest przypadek
-- objęty zakazem „DROP + ADD zamiast RENAME" z zasad nazewnictwa — tamten zakaz chroni KOLUMNY
-- (DROP kolumny kasuje dane). Tutaj usuwane jest wyłącznie ograniczenie: kolumna `resource`,
-- jej typ i wszystkie wiersze zostają nietknięte.
--
-- DLACZEGO NIE TYP ENUM
-- Zgodnie z pierwotnym projektem tabeli `resource` pozostaje TEXT + CHECK. Zmiana na ENUM byłaby
-- przepisaniem kształtu kolumny przy okazji dopisania dwóch wartości.
--
-- OBA PORZĄDKI URUCHOMIENIA
-- (A) świeży replay wg nazw plików (CI, nowa instalacja): 20260901220000 tworzy audit_log wraz
--     z 13-wartościowym CHECK-iem, ten plik jest chronologicznie PÓŹNIEJSZY i podmienia go
--     na 15-wartościowy. Stan końcowy poprawny.
-- (B) uruchomienie ręczne poza kolejnością, PRZED migracją RODO: tabeli jeszcze nie ma, osłona
--     to_regclass przerywa blok, a późniejsze CREATE TABLE odtworzy CHECK 13-wartościowy —
--     rozszerzenie PRZEPADNIE po cichu. Świadoma cena, ta sama co w 20260910103000, przyjęta
--     z dwóch powodów: audit_log ISTNIEJE na produkcji (zweryfikowane 2026-09-15), a przy
--     świeżym replayu porządek (A) jest jedynym możliwym. Dlatego pominięcie krzyczy
--     RAISE WARNING, nie NOTICE — ma być widoczne w logu przebiegu migracji.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE WARNING 'audit_log nie istnieje — POMIJAM rozszerzenie audit_log_resource_check. Wpisy audytowe dla visit_duration_baskets i system_config pozostana odrzucane przez CHECK. Uruchom ten plik PONOWNIE po migracji 20260901220000.';
    RETURN;
  END IF;

  -- IF EXISTS: migracja ma być idempotentna (pułapka 3 z CLAUDE.md w wariancie migracyjnym).
  -- Powtórne uruchomienie nie może wywrócić się na braku już usuniętego ograniczenia.
  ALTER TABLE public.audit_log
    DROP CONSTRAINT IF EXISTS audit_log_resource_check;

  -- 13 wartości PRZEPISANYCH DOSŁOWNIE z migracji źródłowej
  -- (20260901220000_rodo_audit_log_and_client_anonymization.sql, linie 78-82), nie z pamięci
  -- ani z bieżącego RESOURCES — plus dwie nowe na końcu.
  --
  -- 'visit_duration_baskets' — słownik czasu trwania wizyty (CAL-VISIT-DURATION-BASKETS).
  --   Logowane pola: duration_minutes, is_active. record_id = id koszyka.
  -- 'system_config'          — parametry operacyjne firmy (CAL-TRAVEL-BUFFER).
  --   Logowany wyłącznie klucz travel_buffer_minutes z wiersza scheduling_config.
  --   record_id = id WIERSZA system_config, żeby indeks audit_log_resource_record_id_idx
  --   miał tę samą semantykę („co się działo z tym rekordem") co dla pozostałych zasobów.
  ALTER TABLE public.audit_log
    ADD CONSTRAINT audit_log_resource_check CHECK (resource IN (
      'clients', 'leads', 'quotes', 'installations', 'services', 'incidents',
      'auditors', 'crews', 'shipments', 'notification_queue', 'message_templates',
      'authorized_users', 'audit_log',
      'visit_duration_baskets', 'system_config'
    ));
END
$$;

-- UWAGA dla implementacji (nie egzekwowane tą migracją, patrz WO „Server Actions"):
-- ta migracja WYŁĄCZNIE dopuszcza nowe wartości `resource`. Nie zmienia i nie osłabia
-- pozostałych ograniczeń audit_log, które obowiązują te wpisy tak samo jak wszystkie inne:
--   audit_log_operation_check           -> operation = 'field_update' (JUŻ dozwolone)
--   audit_log_justification_min_length  -> length(btrim(justification)) >= 10; uzasadnienie
--                                          wylicza SERWER z wartości przed/po, nie użytkownik
--   audit_log_legal_basis_check         -> legal_basis = 'OTHER' dla obu tych zasobów
--   audit_log_append_only_trg           -> wpisu nie da się później poprawić ani skasować
