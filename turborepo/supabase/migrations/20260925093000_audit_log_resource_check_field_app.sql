-- ============================================================================
-- ETAP 0 FIELD APP — rozszerzenie słownika audit_log.resource o nowe zasoby
--
-- WYMAGANIA (contracts/requirements.contract.mjs):
--   PRICE-LIST-ADMIN       — zmiana ceny w cenniku zostawia ślad (kto, kiedy, z czego na co)
--   STD-INSTALL-CONFIG     — zmiana konfiguracji montażu standardowego zostawia ślad
--   FLD-SIGN-AUDIT-TRAIL   — zasób podpisów musi dać się zapisać w dzienniku
--   INV-ADVANCE-AUTO       — wystawienie faktury przez automat zostawia ślad z aktorem systemowym
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  STAN: TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE.                            ║
-- ║  Plik napisany 2026-09-23, zacommitowany świadomie jako NIEZAAPLIKOWANY.              ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- ── DLACZEGO TO JEST OSOBNA MIGRACJA, A NIE DODATEK DO POPRZEDNICH ──
-- `audit_log_resource_check` jest PODZBIOREM listy RESOURCES z contracts/rbac.contract.mjs
-- i nie rośnie razem z nią automatycznie. Żadna bramka tego nie sprawdza: walidator pilnuje
-- kontraktu, a nie stanu ograniczenia w bazie. Skutek pominięcia jest cichy aż do pierwszego
-- użycia — wtedy `auditLog.create` z nowym `resource` leci wyjątkiem CHECK i WYWRACA CAŁĄ
-- AKCJĘ, w której ten zapis siedział (audyt i operacja są w jednej transakcji). Przy zmianie
-- ceny w cenniku znaczyłoby to, że administrator nie może zapisać ceny, a komunikat mówi
-- o naruszeniu ograniczenia audytu. Precedens i to samo uzasadnienie: migracja 20260915120000.
--
-- Zmiana ADDYTYWNA: ograniczenie WYŁĄCZNIE dopuszcza nowe wartości. Żadna dotychczasowa
-- wartość nie znika — zawężenie zbioru byłoby zmianą łamiącą kompatybilność i wymagałoby
-- osobnej decyzji. DROP dotyczy samego ograniczenia, nigdy kolumny (DROP kolumny kasuje dane).
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE WARNING 'audit_log nie istnieje — POMIJAM rozszerzenie audit_log_resource_check. Wpisy audytowe dla cennika, podpisów i faktur pozostaną odrzucane przez CHECK. Uruchom ten plik PONOWNIE po migracji 20260901220000.';
    RETURN;
  END IF;

  -- IF EXISTS: idempotentność (pułapka 3 z CLAUDE.md w wariancie migracyjnym).
  ALTER TABLE public.audit_log
    DROP CONSTRAINT IF EXISTS audit_log_resource_check;

  -- 15 wartości PRZEPISANYCH DOSŁOWNIE z migracji 20260915120000 (nie z pamięci i nie
  -- z bieżącego RESOURCES — lista w kontrakcie jest nadzbiorem i zawiera zasoby bez tabel,
  -- np. `regions`, którego tabela świadomie nie powstanie) — plus cztery nowe na końcu.
  --
  -- 'price_list_items'      — cennik kosztorysowy (PRICE-LIST-ADMIN). Logowane: zmiana ceny
  --   (przez nową wersję), zmiana is_active. record_id = id pozycji cennika, nie wersji ceny:
  --   „co się działo z tą pozycją" jest pytaniem, które zadaje audytor.
  -- 'installation_contracts'— umowa montażu (FLD-CONTRACT-GENERATE). Logowane: wysłanie,
  --   podpisanie, ewentualne unieważnienie.
  -- 'signatures'            — podpisy klienta (FLD-SIGN-AUDIT-TRAIL).
  -- 'installation_photos'   — dokumentacja zdjęciowa (FLD-PHOTO-SET); usunięcie zdjęcia to
  --   operacja wyłącznie administratora i musi zostawić ślad, bo zdjęcie jest podstawą
  --   wypłaty dla ekipy (KPI OPS-06).
  --
  -- ŚWIADOMIE NIE DOPISUJĘ: 'quote_variants', 'quote_rooms', 'quote_items' — to podtabele
  -- oferty, a audyt prowadzi się na `quotes` (już dozwolone od 2026-09-01). Ten sam podział
  -- co w macierzy RBAC, gdzie te trzy tabele też nie są osobnymi zasobami.
  ALTER TABLE public.audit_log
    ADD CONSTRAINT audit_log_resource_check CHECK (resource IN (
      'clients', 'leads', 'quotes', 'installations', 'services', 'incidents',
      'auditors', 'crews', 'shipments', 'notification_queue', 'message_templates',
      'authorized_users', 'audit_log',
      'visit_duration_baskets', 'system_config',
      'price_list_items', 'installation_contracts', 'signatures', 'installation_photos'
    ));
END
$$;

-- UWAGA dla implementacji (nie egzekwowane tą migracją): rozszerzenie dotyczy WYŁĄCZNIE
-- dopuszczalnych wartości `resource`. Pozostałe ograniczenia audit_log obowiązują te wpisy
-- tak samo jak wszystkie inne:
--   audit_log_operation_check           -> dozwolone operacje bez zmian
--   audit_log_justification_min_length  -> length(btrim(justification)) >= 10
--   audit_log_legal_basis_check         -> dla tych zasobów właściwa podstawa to 'OTHER'
--   audit_log_append_only_trg           -> wpisu nie da się później poprawić ani skasować


-- ============================================================================
-- Sekcja diagnostyczna — do ręcznego uruchomienia PO migracji
-- ============================================================================
--
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'audit_log_resource_check';
-- Oczekiwane: 19 wartości (15 dotychczasowych + 4 nowe).
--
-- Kontrola spójności z kontraktem — lista zasobów RBAC, których NIE MA w CHECK:
-- (uruchom po stronie agenta, porównując z RESOURCES w contracts/rbac.contract.mjs;
--  różnica jest DOPUSZCZALNA i oczekiwana dla zasobów bez tabel, np. `regions`,
--  `documents`, `bookings`, `absences` — nie każdy zasób jest audytowany)
--
-- DOWÓD (uruchom w transakcji i wycofaj):
-- BEGIN;
--   -- MUSI się udać:
--   -- INSERT INTO public.audit_log (resource, record_id, operation, justification, legal_basis, ...)
--   -- VALUES ('price_list_items', gen_random_uuid(), 'field_update', 'zmiana ceny pozycji cennika', 'OTHER', ...);
--   -- MUSI się nie udać:
--   -- INSERT ... VALUES ('quote_items', ...);
-- ROLLBACK;
-- ============================================================================
