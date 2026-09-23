-- ============================================================================
-- ETAP 0 FIELD APP — dokumenty, umowy montażu, podpisy klienta
--
-- WYMAGANIA (contracts/requirements.contract.mjs):
--   DOC-PDF-RENDER            — wspólny silnik PDF, wiersz w documents ze wskazaniem źródła
--   FLD-CONTRACT-GENERATE     — umowa montażu z oferty, wersja wzorca jako jawny łańcuch
--   FLD-SIGN-DOC-FREEZE       — podpisuje się dokładnie tę wersję, którą klient zobaczył
--   FLD-SIGN-CAPTURE          — przechwycenie podpisu palcem + dane zdarzenia
--   FLD-SIGN-AUDIT-TRAIL      — ślad append-only, nieusuwalny także dla administratora
--   FLD-SIGN-TSA              — kwalifikowany znacznik czasu (EuroCert), NULLOWALNY z założenia
--   FLD-SIGN-REMOTE-OTP       — kod SMS obowiązkowy w trybie zdalnym, na miejscu nie
--
-- ŹRÓDŁO DECYZJI: docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md, decyzje D4, D5, D6, D12
-- z 2026-09-21 i 2026-09-23; rozstrzygnięcie nazwy `installation_contracts` przez Michała 2026-09-23.
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  STAN: TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE.                            ║
-- ║  Plik napisany 2026-09-23, zacommitowany świadomie jako NIEZAAPLIKOWANY.              ║
-- ║  Uruchomienie wymaga osobnej, jawnej zgody człowieka. Po uruchomieniu przepisać ten   ║
-- ║  nagłówek na stan faktyczny razem z wynikiem sekcji diagnostycznej.                   ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- KOLEJNOŚĆ: wymaga 20260925090000 (tabela `quotes`). Sprawdzenie jest jawne i przerywa
-- z komunikatem — wariant „utwórz bez klucza obcego, dołożymy później" odrzucony, bo
-- umowa bez wskazania oferty jest umową, której nie da się odtworzyć.
--
-- Zmiana ADDYTYWNA: nowe tabele, nowe wyzwalacze. Zero DROP, zero RENAME.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.quotes') IS NULL THEN
    RAISE EXCEPTION 'Brak tabeli public.quotes — uruchom najpierw 20260925090000_price_list_and_quotes.sql.';
  END IF;
  IF to_regclass('public.leady') IS NULL THEN
    RAISE EXCEPTION 'Brak tabeli public.leady — przerywam.';
  END IF;
END $$;


-- ============================================================================
-- A. Wygenerowane dokumenty PDF
-- ============================================================================
--
-- WSKAZANIE ŹRÓDŁA JEST POLIMORFICZNE (source_type + source_id), bez klucza obcego.
-- Ten sam wybór i to samo uzasadnienie co przy `signatures` niżej. Tutaj dochodzi argument
-- praktyczny: dokument może opisywać protokół, umowę, ofertę albo fakturę — cztery różne
-- tabele, więc wariant „cztery nullowalne klucze obce + CHECK num_nonnulls = 1" (wzorzec
-- z employee_consents) dałby tabelę, w której każde nowe źródło dokumentu to zmiana schematu.

CREATE TABLE IF NOT EXISTS public.documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              TEXT NOT NULL,
  source_type       TEXT NOT NULL,
  source_id         UUID NOT NULL,
  storage_path      TEXT NOT NULL,
  -- Podstawa zamrożenia dokumentu przed podpisem (FLD-SIGN-DOC-FREEZE). Bez skrótu treści
  -- podmiana pliku pod tą samą ścieżką w Storage jest niewykrywalna.
  content_hash      TEXT,
  -- Jawny numer wersji wzorca z docs/legal/ (np. 'v0.1-lorem'), NIE flaga „roboczy/gotowy".
  -- Przyrostek -lorem jest bramką przed wysyłką do klienta (ryzyko R17).
  template_version  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_kind_check') THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_kind_check
      CHECK (kind IN ('HANDOVER_PROTOCOL', 'INSTALLATION_CONTRACT', 'QUOTE', 'INVOICE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_source_type_check') THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_source_type_check
      CHECK (source_type IN ('installations', 'installation_contracts', 'quotes', 'invoices'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS documents_source_idx ON public.documents (source_type, source_id);


-- ============================================================================
-- B. Umowa montażu
-- ============================================================================
--
-- NAZWA `installation_contracts`, nie `contracts` — rozstrzygnięcie Michała 2026-09-23 na
-- rekomendację contract-steward. `contracts` jest poprawne wg ADR-002 (snake_case, l. mnoga,
-- angielski), ale w tym repozytorium katalog `contracts/` to źródło prawdy systemu, a zasób
-- RBAC o tej nazwie czytałby się w audycie jako uprawnienie do kontraktów systemowych.

CREATE TABLE IF NOT EXISTS public.installation_contracts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES public.leady(id) ON DELETE CASCADE,
  quote_id          UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  installation_id   UUID,
  -- NOT NULL: umowa bez wskazania wersji treści, którą podpisano, jest bezwartościowa dowodowo.
  document_version  TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'DRAFT',
  content_hash      TEXT,
  document_id       UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  sent_at           TIMESTAMPTZ,
  signed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- FK do instalacji dodawany warunkowo: `instalacje` istnieje na produkcji, ale gdyby ten plik
-- był odtwarzany na bazie zbudowanej od zera w innej kolejności, brak tabeli nie może wywrócić
-- całej migracji umów — umowa wisi przede wszystkim na leadzie.
DO $$
BEGIN
  IF to_regclass('public.instalacje') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'installation_contracts_installation_id_fkey') THEN
    ALTER TABLE public.installation_contracts
      ADD CONSTRAINT installation_contracts_installation_id_fkey
      FOREIGN KEY (installation_id) REFERENCES public.instalacje(id) ON DELETE SET NULL;
  ELSIF to_regclass('public.instalacje') IS NULL THEN
    RAISE WARNING 'Brak tabeli instalacje — installation_contracts.installation_id zostaje BEZ klucza obcego. Uruchom ten plik ponownie po utworzeniu tabeli.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'installation_contracts_status_check') THEN
    ALTER TABLE public.installation_contracts
      ADD CONSTRAINT installation_contracts_status_check
      CHECK (status IN ('DRAFT', 'SENT', 'SIGNED'));
  END IF;

  -- Umowa podpisana MUSI mieć moment podpisu i zamrożony skrót treści. Bez tego status
  -- 'SIGNED' byłby samą etykietą, a etykieta nie jest dowodem zawarcia umowy.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'installation_contracts_signed_shape_check') THEN
    ALTER TABLE public.installation_contracts
      ADD CONSTRAINT installation_contracts_signed_shape_check
      CHECK (status <> 'SIGNED' OR (signed_at IS NOT NULL AND content_hash IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS installation_contracts_lead_idx ON public.installation_contracts (lead_id);


-- ── Zamrożenie umowy podpisanej ──
-- Wzorzec przeniesiony z legal_document_versions_freeze_published_trg: po podpisaniu treść
-- i wskazanie wersji są niezmienne. Macierz RBAC daje audytorowi `update:own` — to dotyczy
-- WYŁĄCZNIE szkicu, a rozróżnienia stanu wiersza macierz nie wyraża, więc robi to baza.
CREATE OR REPLACE FUNCTION public.installation_contracts_freeze_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'SIGNED' THEN
    IF NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.document_version IS DISTINCT FROM OLD.document_version
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.quote_id IS DISTINCT FROM OLD.quote_id THEN
      RAISE EXCEPTION 'Umowa podpisana jest niezmienna (FLD-SIGN-DOC-FREEZE). Zmiana treści po podpisie to dowód wytworzony po fakcie — wystaw aneks jako NOWY dokument.';
    END IF;
    IF NEW.status <> 'SIGNED' THEN
      RAISE EXCEPTION 'Nie wolno cofnąć statusu umowy podpisanej. Odstąpienie i rozwiązanie umowy to osobne zdarzenia, nie edycja wiersza.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS installation_contracts_freeze_signed_trg ON public.installation_contracts;
CREATE TRIGGER installation_contracts_freeze_signed_trg
  BEFORE UPDATE ON public.installation_contracts
  FOR EACH ROW EXECUTE FUNCTION public.installation_contracts_freeze_signed();


-- ============================================================================
-- C. Podpisy klienta
-- ============================================================================
--
-- ── POLIMORFIZM DOKUMENTU: decyzja projektowa contract-steward, 2026-09-23 ──
-- Wybrany wariant: `document_type` + `document_id` + CHECK na dozwolone typy.
-- Odrzucony wariant: osobna tabela „dokument podpisywalny" jako encja nadrzędna.
-- Powód: D4.3 wymienia DOKŁADNIE DWA dokumenty podpisywane przez klienta — protokół odbioru
-- i umowę montażu. Protokół przeglądu serwisowego i zgoda na publikację zdjęć są jawnie poza
-- zakresem (decyzja 2026-09-21). Encja nadrzędna dla dwóch znanych typów to warstwa pośrednia,
-- która nie zarabia na siebie: każdy odczyt podpisu wymagałby jednego złączenia więcej, a jedyną
-- korzyścią byłby klucz obcy, którego dziś nie ma czym naruszyć poza błędem w kodzie.
-- KOSZT PRZYJĘTY ŚWIADOMIE I WYPOWIEDZIANY: baza NIE MA klucza obcego na document_id, więc
-- NIE zatrzyma podpisu wskazującego nieistniejący wiersz ani podpisu osieroconego po usunięciu
-- dokumentu. Zabezpieczeniem jest CHECK na document_type plus kryterium testowe
-- w FLD-SIGN-AUDIT-TRAIL. Jeżeli kiedykolwiek dojdzie trzeci typ dokumentu podpisywanego,
-- to jest moment na ponowne rozważenie encji nadrzędnej — nie wcześniej.

CREATE TABLE IF NOT EXISTS public.signatures (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type         TEXT NOT NULL,
  document_id           UUID NOT NULL,
  mode                  TEXT NOT NULL,
  signed_at             TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  -- Skrót dokumentu w chwili podpisu; musi zgadzać się ze skrótem sprzed prezentacji.
  document_hash         TEXT NOT NULL,
  signature_image_path  TEXT NOT NULL,
  -- Urządzenie, adres IP, czas lokalny klienta. Sam obraz podpisu bez kontekstu
  -- nie jest śladem dowodowym (FLD-SIGN-CAPTURE).
  capture_metadata      JSONB,
  -- KWALIFIKOWANY ZNACZNIK CZASU (EuroCert, D6). NULLOWALNY Z ZAŁOŻENIA, nie z niedopatrzenia:
  -- podpis złożony bez zasięgu dostaje znacznik dopiero po synchronizacji (ryzyko R8),
  -- więc stan „podpisany, jeszcze nieostemplowany" MUSI być reprezentowalny.
  tsa_timestamp_at      TIMESTAMPTZ,
  tsa_token             TEXT,
  -- Tylko tryb zdalny (D4.2). Numer pochodzi z danych leada, nie z formularza podpisu.
  otp_phone             TEXT,
  otp_verified_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signatures_document_type_check') THEN
    ALTER TABLE public.signatures
      ADD CONSTRAINT signatures_document_type_check
      CHECK (document_type IN ('HANDOVER_PROTOCOL', 'INSTALLATION_CONTRACT'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signatures_mode_check') THEN
    ALTER TABLE public.signatures
      ADD CONSTRAINT signatures_mode_check CHECK (mode IN ('ON_SITE', 'REMOTE'));
  END IF;

  -- D4.2 wyrażone jako ograniczenie, a nie jako reguła w kodzie: podpis ZDALNY bez
  -- potwierdzonego kodu SMS nie ma prawa powstać. Podpis NA MIEJSCU odwrotnie — kodu
  -- nie wymaga, bo pracownik widzi klienta. Rozłączność obu trybów jest tu wymuszona.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signatures_remote_requires_otp_check') THEN
    ALTER TABLE public.signatures
      ADD CONSTRAINT signatures_remote_requires_otp_check
      CHECK (mode <> 'REMOTE' OR (otp_phone IS NOT NULL AND otp_verified_at IS NOT NULL));
  END IF;

  -- Znacznik czasu bez tokenu (i odwrotnie) byłby stanem, którego nie da się zweryfikować
  -- u dostawcy — a cała wartość TSA polega na weryfikowalności niezależnej od nas.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signatures_tsa_pair_check') THEN
    ALTER TABLE public.signatures
      ADD CONSTRAINT signatures_tsa_pair_check
      CHECK (num_nonnulls(tsa_timestamp_at, tsa_token) IN (0, 2));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS signatures_document_idx ON public.signatures (document_type, document_id);


-- ── APPEND-ONLY: wzorzec audit_log_append_only_trg i employee_consents_append_only_trg ──
-- Macierz RBAC ma dla tego zasobu update: [] i delete: [] — NIKT, łącznie z administratorem.
-- Ale macierz działa w warstwie aplikacji, a Prisma omija RLS (pułapka nr 1 z CLAUDE.md),
-- więc ostatnią warstwą, która cokolwiek gwarantuje, jest baza. Podpis, który administrator
-- może poprawić, nie jest dowodem — poprawiony ślad to dowód wytworzony po fakcie.
--
-- JEDEN WYJĄTEK, ŚWIADOMY: dostemplowanie kwalifikowanego znacznika czasu po synchronizacji
-- podpisu złożonego bez zasięgu (ryzyko R8). Bez tego wyjątku podpis offline nigdy nie
-- dostałby TSA, bo wiersz byłby zamknięty w chwili powstania. Wyjątek jest WĄSKI: wolno
-- wypełnić tsa_timestamp_at i tsa_token, gdy były puste. Nie wolno ich zmienić ani wyczyścić.
CREATE OR REPLACE FUNCTION public.signatures_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'signatures jest append-only (FLD-SIGN-AUDIT-TRAIL). Podpisu nie usuwa się — unieważnienie zapisuje się jako NOWE zdarzenie.';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.document_type IS DISTINCT FROM OLD.document_type
     OR NEW.document_id IS DISTINCT FROM OLD.document_id
     OR NEW.mode IS DISTINCT FROM OLD.mode
     OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
     OR NEW.document_hash IS DISTINCT FROM OLD.document_hash
     OR NEW.signature_image_path IS DISTINCT FROM OLD.signature_image_path
     OR NEW.capture_metadata IS DISTINCT FROM OLD.capture_metadata
     OR NEW.otp_phone IS DISTINCT FROM OLD.otp_phone
     OR NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'signatures jest append-only (FLD-SIGN-AUDIT-TRAIL). Jedyna dozwolona zmiana to uzupełnienie pustego znacznika czasu TSA po synchronizacji podpisu offline.';
  END IF;

  IF OLD.tsa_timestamp_at IS NOT NULL AND NEW.tsa_timestamp_at IS DISTINCT FROM OLD.tsa_timestamp_at THEN
    RAISE EXCEPTION 'Kwalifikowany znacznik czasu jest niezmienny po nadaniu — to jedyny dowód niezależny od nas.';
  END IF;
  IF OLD.tsa_token IS NOT NULL AND NEW.tsa_token IS DISTINCT FROM OLD.tsa_token THEN
    RAISE EXCEPTION 'Token znacznika czasu jest niezmienny po nadaniu.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS signatures_append_only_trg ON public.signatures;
CREATE TRIGGER signatures_append_only_trg
  BEFORE UPDATE OR DELETE ON public.signatures
  FOR EACH ROW EXECUTE FUNCTION public.signatures_append_only();

COMMENT ON TABLE public.signatures IS
  'FLD-SIGN-*: podpisy klienta. APPEND-ONLY (signatures_append_only_trg) z jednym wąskim wyjątkiem: dostemplowanie TSA po synchronizacji podpisu offline (R8). Wskazanie dokumentu polimorficzne — uzasadnienie w nagłówku migracji 20260925091000.';


-- ============================================================================
-- D. RLS — deny-by-default
-- ============================================================================
ALTER TABLE public.documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures             ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- E. Sekcja diagnostyczna — do ręcznego uruchomienia PO migracji
-- ============================================================================
--
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.signatures'::regclass ORDER BY conname;
-- Oczekiwane: signatures_document_type_check, signatures_mode_check,
-- signatures_remote_requires_otp_check, signatures_tsa_pair_check + PK.
--
-- SELECT tgname, tgenabled FROM pg_trigger
--  WHERE tgrelid IN ('public.signatures'::regclass, 'public.installation_contracts'::regclass)
--    AND NOT tgisinternal;
-- Oczekiwane: signatures_append_only_trg (O), installation_contracts_freeze_signed_trg (O).
--
-- DOWÓD DZIAŁANIA APPEND-ONLY (uruchom w transakcji i wycofaj):
-- BEGIN;
--   INSERT INTO public.signatures (document_type, document_id, mode, document_hash, signature_image_path)
--   VALUES ('HANDOVER_PROTOCOL', gen_random_uuid(), 'ON_SITE', 'abc', 'x/y.png');
--   -- MUSI się nie udać:
--   -- UPDATE public.signatures SET document_hash = 'zmienione';
--   -- DELETE FROM public.signatures;
--   -- MUSI się udać (dostemplowanie TSA po synchronizacji):
--   -- UPDATE public.signatures SET tsa_timestamp_at = now(), tsa_token = 'token';
--   -- MUSI się nie udać (podmiana nadanego znacznika):
--   -- UPDATE public.signatures SET tsa_token = 'inny';
--   -- MUSI się nie udać (podpis zdalny bez OTP):
--   -- INSERT ... VALUES ('INSTALLATION_CONTRACT', gen_random_uuid(), 'REMOTE', 'abc', 'x/y.png');
-- ROLLBACK;
--
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('documents','installation_contracts','signatures');
-- Oczekiwane: relrowsecurity = true dla wszystkich trzech.
-- ============================================================================
