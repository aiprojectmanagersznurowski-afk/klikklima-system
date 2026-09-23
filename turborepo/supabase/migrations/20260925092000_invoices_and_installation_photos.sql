-- ============================================================================
-- ETAP 0 FIELD APP — dokumenty rozliczeniowe i dokumentacja zdjęciowa
--
-- WYMAGANIA (contracts/requirements.contract.mjs):
--   INV-PROFORMA              — proforma / wezwanie do zapłaty przed wpłatą (D9 krok 1)
--   INV-ADVANCE-AUTO          — faktura zaliczkowa automatycznie po wpłacie, DOKŁADNIE RAZ
--   INV-FINAL                 — faktura rozliczeniowa przy T09, nigdy przy T17
--   FNL-2PHASE-INVOICE        — po etapie I NIE POWSTAJE żaden dokument rozliczeniowy
--   PRICE-VAT-RATE            — stawka z rodzaju obiektu (8% albo 23%)
--   FLD-PHOTO-SET             — komplet 4 + 2n przy zamknięciu montażu
--   FLD-PHOTO-SET-PHASE-ONE   — osobny komplet przy zamknięciu etapu I
--   FLD-PHOTO-UPLOAD-RESILIENT— ponowiona wysyłka nie tworzy duplikatu
--
-- ŹRÓDŁO DECYZJI: decyzje Michała D7, D8, D9 z 2026-09-23,
-- docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 0 i 3.
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  STAN: TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE.                            ║
-- ║  Plik napisany 2026-09-23, zacommitowany świadomie jako NIEZAAPLIKOWANY.              ║
-- ║  Uruchomienie wymaga osobnej, jawnej zgody człowieka.                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- KOLEJNOŚĆ: wymaga 20260925090000 (tabela `quotes`).
-- Zmiana ADDYTYWNA: nowe tabele. Zero DROP, zero RENAME.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.quotes') IS NULL THEN
    RAISE EXCEPTION 'Brak tabeli public.quotes — uruchom najpierw 20260925090000_price_list_and_quotes.sql.';
  END IF;
END $$;


-- ============================================================================
-- A. Dokumenty rozliczeniowe (łańcuch trzech, D9)
-- ============================================================================
--
-- D9 rozstrzyga łańcuch: proforma (przed wpłatą) -> faktura zaliczkowa (automatycznie
-- po zaksięgowaniu wpłaty) -> faktura rozliczeniowa (po montażu, przejście T09).
-- PRZY MONTAŻU DWUETAPOWYM ROZLICZENIE JEST PO ETAPIE II: etap I kończy T17, które jest
-- pętlą na AWAITING_INSTALLATION, a T09 wychodzi dopiero po zamontowaniu urządzeń.
-- Po etapie I klient NIE dostaje żadnego dokumentu (to jest odwrócenie wcześniejszej
-- treści FNL-2PHASE-INVOICE i powód, dla którego N8a straciło załącznik z fakturą).
-- Baza nie zna przejść lejka, więc tej reguły NIE da się tu wyrazić ograniczeniem —
-- jej nośnikiem jest kryterium akceptacji i test, a nie CHECK. Zapisane wprost, żeby
-- nikt nie szukał w schemacie gwarancji, której schemat nie daje.

CREATE TABLE IF NOT EXISTS public.invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              TEXT NOT NULL,
  lead_id           UUID NOT NULL REFERENCES public.leady(id) ON DELETE CASCADE,
  quote_id          UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  installation_id   UUID,
  amount_net        NUMERIC(12,2) NOT NULL,
  -- Stawka z OBIEKTU (PRICE-VAT-RATE), zapisana w chwili wystawienia. Nie wyliczana przy
  -- odczycie: zmiana tabeli stawek nie może zmienić dokumentu już wystawionego.
  vat_rate_percent  INTEGER NOT NULL,
  amount_gross      NUMERIC(12,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'ISSUED',
  -- ══════════════════════════════════════════════════════════════════════════════
  -- KLUCZ IDEMPOTENCJI — najważniejsza kolumna tej tabeli (ryzyko R15).
  -- Identyfikator zdarzenia płatności u dostawcy. UNIQUE jest JEDYNYM nośnikiem
  -- gwarancji „ponowiony webhook nie wystawi drugiej faktury zaliczkowej".
  -- Sprawdzenie „czy już istnieje" w kodzie przegrywa wyścig dwóch równoległych
  -- wywołań zwrotnych, a skutkiem jest podwójna faktura u klienta i korekta,
  -- czyli praca księgowej — nie kliknięcie.
  -- NULLOWALNE, bo proforma i faktura rozliczeniowa nie powstają z płatności;
  -- UNIQUE w Postgresie dopuszcza wiele NULL-i, więc to nie koliduje.
  -- ══════════════════════════════════════════════════════════════════════════════
  payment_event_id  TEXT UNIQUE,
  -- Identyfikator dokumentu w inFakt (KSeF po stronie dostawcy, bez własnej integracji).
  external_id       TEXT,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF to_regclass('public.instalacje') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_installation_id_fkey') THEN
    -- SET NULL, nie CASCADE: dokument księgowy PRZEŻYWA usunięcie rekordu montażu.
    -- Faktura skasowana razem z instalacją to brakujący dokument w księgach.
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_installation_id_fkey
      FOREIGN KEY (installation_id) REFERENCES public.instalacje(id) ON DELETE SET NULL;
  ELSIF to_regclass('public.instalacje') IS NULL THEN
    RAISE WARNING 'Brak tabeli instalacje — invoices.installation_id zostaje BEZ klucza obcego.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_kind_check') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_kind_check CHECK (kind IN ('PROFORMA', 'ADVANCE', 'FINAL'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_status_check') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_status_check CHECK (status IN ('ISSUED', 'PAID', 'CANCELLED'));
  END IF;

  -- Dwie dopuszczalne stawki (D16). Wartość spoza zbioru na dokumencie rozliczeniowym
  -- to błąd podatkowy, nie literówka.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_vat_rate_check') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_vat_rate_check CHECK (vat_rate_percent IN (8, 23));
  END IF;

  -- Faktura zaliczkowa MUSI wskazywać zdarzenie płatności — bez tego nie ma czego
  -- odróżnić przy ponowieniu webhooka i klucz idempotencji przestaje cokolwiek dawać.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_advance_requires_payment_event_check') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_advance_requires_payment_event_check
      CHECK (kind <> 'ADVANCE' OR payment_event_id IS NOT NULL);
  END IF;

  -- Spójność kwot: brutto = netto + VAT, z tolerancją jednego grosza na zaokrąglenie.
  -- FLD-QUOTE-CALC wymaga tych samych zaokrągleń w Triage, ofercie i na fakturze —
  -- rozjazd o grosz między dokumentami jest błędem księgowym, nie kosmetyką.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_amount_consistency_check') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_amount_consistency_check
      CHECK (abs(amount_gross - round(amount_net * (1 + vat_rate_percent::numeric / 100), 2)) <= 0.01);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS invoices_lead_idx ON public.invoices (lead_id);
CREATE INDEX IF NOT EXISTS invoices_kind_idx ON public.invoices (kind);

COMMENT ON COLUMN public.invoices.payment_event_id IS
  'INV-ADVANCE-AUTO / ryzyko R15: klucz idempotencji zdarzenia płatności. UNIQUE to JEDYNA gwarancja, że ponowiony webhook PayU nie wystawi drugiej faktury zaliczkowej.';
COMMENT ON TABLE public.invoices IS
  'D9: proforma -> faktura zaliczkowa (po wpłacie) -> faktura rozliczeniowa (przy T09). Przy montażu dwuetapowym rozliczenie następuje PO ETAPIE II — po etapie I (T17) nie powstaje żaden dokument. Tej reguły baza nie egzekwuje (nie zna przejść lejka); jej nośnikiem są FNL-2PHASE-INVOICE i INV-FINAL.';


-- ============================================================================
-- B. Dokumentacja zdjęciowa montażu
-- ============================================================================
--
-- D7: komplet ZMIENNY 4 + 2n. Część stała (jedn. zewnętrzna, jej tabliczka, odpływ skroplin,
-- manometr próby próżni) plus dwa zdjęcia na KAŻDĄ jednostkę wewnętrzną (montaż i tabliczka).
-- Etap I montażu dwuetapowego ma komplet osobny: trasy przed zakryciem + manometr próby azotem.
--
-- Czego ta tabela CELOWO nie egzekwuje: samej kompletności. „Cztery plus dwa na jednostkę"
-- zależy od liczby jednostek w projekcie, której schemat nie zna, a warunek zależny od
-- zawartości innej tabeli nie da się wyrazić CHECK-iem. Kompletność sprawdza serwer przy
-- zamknięciu montażu (FLD-PHOTO-SET) — baza dowozi tu rozróżnialność rodzaju, przypisanie
-- do jednostki i ochronę przed duplikatem z ponowionej wysyłki.

DO $$
BEGIN
  IF to_regclass('public.instalacje') IS NULL THEN
    RAISE EXCEPTION 'Brak tabeli public.instalacje — zdjęcia montażowe bez wskazania montażu byłyby plikami bez właściciela.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.installation_photos (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id         UUID NOT NULL REFERENCES public.instalacje(id) ON DELETE CASCADE,
  kind                    TEXT NOT NULL,
  -- Bez tego pola dwa zdjęcia TEJ SAMEJ jednostki spełniałyby wymóg „dwa na każdą
  -- jednostkę" przy multi-splicie — czyli komplet byłby formalnie pełny, a dokumentacja
  -- drugiej jednostki nie istniałaby wcale.
  indoor_unit_index       INTEGER,
  -- Rozdziela komplet etapu I od kompletu zamknięcia montażu. NULL dla montażu
  -- jednoetapowego i dla zdjęć z audytu.
  phase_number            INTEGER,
  storage_path            TEXT NOT NULL,
  -- FLD-PHOTO-UPLOAD-RESILIENT + FLD-OFFLINE-OUTBOX: klucz nadawany NA URZĄDZENIU.
  -- Kolejka offline ponawia wysyłkę z definicji, więc ochrona przed duplikatem musi
  -- siedzieć w bazie, a nie w porównywaniu nazw plików.
  upload_idempotency_key  TEXT NOT NULL UNIQUE,
  taken_at                TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'installation_photos_kind_check') THEN
    ALTER TABLE public.installation_photos
      ADD CONSTRAINT installation_photos_kind_check
      CHECK (kind IN (
        -- część stała zamknięcia montażu (D7)
        'OUTDOOR_UNIT', 'OUTDOOR_UNIT_NAMEPLATE', 'CONDENSATE_DRAIN', 'VACUUM_TEST_GAUGE',
        -- dwa na każdą jednostkę wewnętrzną (D7)
        'INDOOR_UNIT_MOUNTED', 'INDOOR_UNIT_NAMEPLATE',
        -- komplet etapu I (FLD-PHOTO-SET-PHASE-ONE)
        'PIPE_ROUTE_BEFORE_COVER', 'NITROGEN_TEST_GAUGE',
        -- zdjęcia z audytu (FLD-AUDIT-FORM)
        'AUDIT'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'installation_photos_phase_number_check') THEN
    ALTER TABLE public.installation_photos
      ADD CONSTRAINT installation_photos_phase_number_check
      CHECK (phase_number IS NULL OR phase_number IN (1, 2));
  END IF;

  -- Zdjęcia jednostki wewnętrznej MUSZĄ wskazywać, której jednostki dotyczą; pozostałe
  -- rodzaje dotyczą całego układu i numeru jednostki mieć nie mogą. Bez tej rozłączności
  -- „2 zdjęcia na jednostkę" nie da się policzyć zapytaniem.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'installation_photos_indoor_index_consistency_check') THEN
    ALTER TABLE public.installation_photos
      ADD CONSTRAINT installation_photos_indoor_index_consistency_check
      CHECK (
        (kind IN ('INDOOR_UNIT_MOUNTED', 'INDOOR_UNIT_NAMEPLATE') AND indoor_unit_index IS NOT NULL)
        OR
        (kind NOT IN ('INDOOR_UNIT_MOUNTED', 'INDOOR_UNIT_NAMEPLATE') AND indoor_unit_index IS NULL)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'installation_photos_indoor_index_positive_check') THEN
    ALTER TABLE public.installation_photos
      ADD CONSTRAINT installation_photos_indoor_index_positive_check
      CHECK (indoor_unit_index IS NULL OR indoor_unit_index >= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS installation_photos_installation_kind_idx
  ON public.installation_photos (installation_id, kind);

COMMENT ON TABLE public.installation_photos IS
  'FLD-PHOTO-SET (4 + 2n, D7) i FLD-PHOTO-SET-PHASE-ONE. Kompletności kompletu baza NIE egzekwuje — zależy od liczby jednostek w projekcie i sprawdza ją serwer przy zamknięciu montażu.';


-- ============================================================================
-- C. RLS — deny-by-default
-- ============================================================================
ALTER TABLE public.invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_photos  ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- D. Sekcja diagnostyczna — do ręcznego uruchomienia PO migracji
-- ============================================================================
--
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.invoices'::regclass ORDER BY conname;
-- Oczekiwane m.in.: invoices_advance_requires_payment_event_check,
-- invoices_amount_consistency_check, invoices_kind_check, invoices_vat_rate_check
-- oraz UNIQUE na payment_event_id.
--
-- DOWÓD DZIAŁANIA KLUCZA IDEMPOTENCJI (uruchom w transakcji i wycofaj):
-- BEGIN;
--   INSERT INTO public.invoices (kind, lead_id, amount_net, vat_rate_percent, amount_gross, payment_event_id)
--   VALUES ('ADVANCE', '<istniejący lead_id>', 1000.00, 8, 1080.00, 'evt_test_1');
--   -- MUSI się nie udać (ponowiony webhook z tym samym zdarzeniem):
--   -- INSERT ... VALUES ('ADVANCE', '<ten sam lead_id>', 1000.00, 8, 1080.00, 'evt_test_1');
--   -- MUSI się nie udać (zaliczkowa bez zdarzenia płatności):
--   -- INSERT ... VALUES ('ADVANCE', '<lead_id>', 1000.00, 8, 1080.00, NULL);
--   -- MUSI się nie udać (brutto niezgodne ze stawką):
--   -- INSERT ... VALUES ('FINAL', '<lead_id>', 1000.00, 23, 1080.00, NULL);
-- ROLLBACK;
--
-- DOWÓD ROZŁĄCZNOŚCI ZDJĘĆ:
-- BEGIN;
--   -- MUSI się nie udać (zdjęcie jednostki wewnętrznej bez numeru jednostki):
--   -- INSERT INTO public.installation_photos (installation_id, kind, storage_path, upload_idempotency_key)
--   -- VALUES ('<id>', 'INDOOR_UNIT_MOUNTED', 'a/b.jpg', 'k1');
--   -- MUSI się nie udać (numer jednostki przy zdjęciu jednostki zewnętrznej):
--   -- INSERT ... (kind, indoor_unit_index) VALUES ('OUTDOOR_UNIT', 1);
-- ROLLBACK;
--
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('invoices','installation_photos');
-- Oczekiwane: relrowsecurity = true dla obu.
-- ============================================================================
