-- ============================================================================
-- ETAP 0 FIELD APP — cennik kosztorysowy i oferty
--
-- WYMAGANIA (contracts/requirements.contract.mjs):
--   PRICE-LIST-SCHEMA          — cennik w bazie, koszt zakupu osobno od ceny sprzedaży
--   PRICE-LIST-IMPORT          — import 39 pozycji z docs/architecture/cennik-robocizny.csv
--   FLD-QUOTE-VARIANTS         — 1-3 warianty na ofertę
--   FLD-QUOTE-ROOMS            — pozycje przypisane do pomieszczeń (zasięg ROOM)
--   FLD-QUOTE-GENERAL-ITEMS    — pozycje ogólne całej instalacji (zasięg INSTALLATION)
--   FLD-QUOTE-PRICE-SNAPSHOT   — oferta odtwarza się w cenach z dnia wystawienia
--   FLD-QUOTE-MANUAL-ITEM      — pozycja indywidualna spoza cennika
--   PRICE-VAT-RATE             — stawka VAT z rodzaju obiektu
--
-- ŹRÓDŁO DECYZJI: docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md, decyzje Michała
-- D8, D15, D16, D17 z 2026-09-23; docs/architecture/CENNIK-ROBOCIZNY.md.
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  STAN: TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE.                            ║
-- ║  Plik napisany 2026-09-23 i zacommitowany świadomie jako NIEZAAPLIKOWANY.             ║
-- ║  Uruchomienie wymaga osobnej, jawnej zgody człowieka (nie db push, nie migrate reset).║
-- ║  Po uruchomieniu: przepisać ten nagłówek na stan faktyczny i dopisać wynik weryfikacji║
-- ║  z sekcji diagnostycznej na końcu pliku — nagłówek mylący w którąkolwiek stronę jest  ║
-- ║  gorszy niż jego brak (precedens: migracje bezpieczeństwa z 2026-09-03).              ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- KOLEJNOŚĆ: ten plik jest PIERWSZY z czterech (20260925090000 -> 093000). Pliki 091000
-- i 092000 zakładają istnienie tabel `quotes` i `price_list_items` i sprawdzają to wprost,
-- przerywając z czytelnym komunikatem zamiast tworzyć tabelę bez klucza obcego.
--
-- Zmiana ADDYTYWNA: same nowe tabele, zero DROP, zero RENAME, zero zmian w istniejących
-- kolumnach. Odwołania do `leady` wskazują nazwę FAKTYCZNĄ (dług KK-NAMING-BASELINE jest
-- zamrożony) — nowe obiekty są po angielsku i snake_case (ADR-002).
--
-- ZBIORY WARTOŚCI: text + CHECK zamiast typów enum. Ten sam wybór co przy
-- instalacje.installation_type (20260916060000): rozszerzenie zbioru jest wtedy zwykłym
-- DROP/ADD CONSTRAINT w migracji addytywnej, a nie ALTER TYPE, którego nie da się wycofać
-- w transakcji ani łatwo zawęzić.
-- ============================================================================


-- ============================================================================
-- A. Cennik kosztorysowy
-- ============================================================================
--
-- Cena NIE JEST kolumną pozycji. Pozycja to „co robimy", wersja to „ile to kosztowało
-- w danym okresie". Wariant z kolumnami `crew_cost_net`/`sale_price_net` wprost na pozycji
-- odrzucony: FLD-QUOTE-PRICE-SNAPSHOT wymaga, żeby oferta sprzed miesiąca odtwarzała się
-- w cenach z dnia wystawienia, a przy nadpisywanej cenie nie ma z czego jej odtworzyć.
-- Wzorzec przeniesiony z legal_document_versions (migracja 20260821130000).

CREATE TABLE IF NOT EXISTS public.price_list_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE, bo nazwa jest kluczem idempotencji importu (PRICE-LIST-IMPORT): ponowne
  -- wczytanie arkusza ma aktualizować pozycję, nie tworzyć jej drugi raz.
  name         TEXT NOT NULL UNIQUE,
  -- NULL dopuszczalny: 5 pozycji arkusza nie ma opisu (D16 pkt 2). Opis jest tym,
  -- co klient widzi w ofercie, więc jego brak jest informacją, nie wartością pustą.
  description  TEXT,
  unit         TEXT NOT NULL,
  -- NULL dopuszczalny z tego samego powodu (5 pozycji bez kategorii).
  category     TEXT,
  scope        TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_list_items_unit_check') THEN
    ALTER TABLE public.price_list_items
      ADD CONSTRAINT price_list_items_unit_check CHECK (unit IN ('mb', 'szt', 'm'));
  END IF;

  -- Kategorie ANGIELSKIE mimo polskiego arkusza źródłowego (ADR-002). Przekład
  -- 'Materiał'/'Robocizna'/'Robocizno-materiał' -> MATERIAL/LABOR/MATERIAL_LABOR należy
  -- do importu (PRICE-LIST-IMPORT), nie do schematu. NULL przechodzi celowo.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_list_items_category_check') THEN
    ALTER TABLE public.price_list_items
      ADD CONSTRAINT price_list_items_category_check
      CHECK (category IS NULL OR category IN ('MATERIAL', 'LABOR', 'MATERIAL_LABOR'));
  END IF;

  -- D17: zasięg jest OBOWIĄZKOWY. Pozycja bez zasięgu nie wie, w której części formularza
  -- wyceny się pojawić, a jej pozycja w ofercie nie wie, czy wymaga pomieszczenia.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_list_items_scope_check') THEN
    ALTER TABLE public.price_list_items
      ADD CONSTRAINT price_list_items_scope_check CHECK (scope IN ('ROOM', 'INSTALLATION'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS price_list_items_scope_idx ON public.price_list_items (scope);

COMMENT ON TABLE public.price_list_items IS
  'PRICE-LIST-SCHEMA: cennik kosztorysowy (39 pozycji, docs/architecture/cennik-robocizny.csv). Ceny w price_list_item_versions — zmiana ceny NIGDY nie nadpisuje poprzedniej.';
COMMENT ON COLUMN public.price_list_items.scope IS
  'D17: ROOM (23 pozycje, wymagają pomieszczenia w ofercie) albo INSTALLATION (16 pozycji, ogólne dla całej instalacji).';
COMMENT ON COLUMN public.price_list_items.is_active IS
  'Wycofanie pozycji = przełączenie flagi. DELETE nie jest przyznane nikomu (macierz RBAC), bo kasowanie pozycji rozspójnia oferty historyczne.';


CREATE TABLE IF NOT EXISTS public.price_list_item_versions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_item_id  UUID NOT NULL REFERENCES public.price_list_items(id) ON DELETE CASCADE,
  -- NULL = KOSZT NIEZNANY, nie zero. 13 pozycji arkusza nie ma kosztu ekipy (D16 pkt 1),
  -- a zero znaczyłoby „ekipa pracuje za darmo" i dałoby marżę równą całej cenie sprzedaży.
  crew_cost_net       NUMERIC(12,2),
  sale_price_net      NUMERIC(12,2) NOT NULL,
  valid_from          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_current          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Dokładnie JEDNA obowiązująca cena na pozycję. Indeks CZĘŚCIOWY, bo wersji historycznych
-- ma być wiele — dokładnie ten sam wzorzec co legal_document_versions_current_per_kind_key.
-- To baza wygrywa wyścig dwóch równoległych publikacji cennika, nie sprawdzenie w aplikacji.
CREATE UNIQUE INDEX IF NOT EXISTS price_list_item_versions_current_per_item_key
  ON public.price_list_item_versions (price_list_item_id)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS price_list_item_versions_item_idx
  ON public.price_list_item_versions (price_list_item_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_list_item_versions_sale_price_nonneg_check') THEN
    ALTER TABLE public.price_list_item_versions
      ADD CONSTRAINT price_list_item_versions_sale_price_nonneg_check CHECK (sale_price_net >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_list_item_versions_crew_cost_nonneg_check') THEN
    ALTER TABLE public.price_list_item_versions
      ADD CONSTRAINT price_list_item_versions_crew_cost_nonneg_check
      CHECK (crew_cost_net IS NULL OR crew_cost_net >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.price_list_item_versions.crew_cost_net IS
  'NULL = koszt ekipy NIEZNANY (13 pozycji arkusza, D16 pkt 1). Nie mylić z zerem — marża przy NULL jest nieznana, a nie równa cenie sprzedaży.';


-- ============================================================================
-- B. Oferta, warianty, pomieszczenia, pozycje
-- ============================================================================
--
-- Do 2026-09-23 wycena żyła jako DWA POLA TEKSTOWE na leadzie (estymowana_wycena,
-- finalna_wycena_pln). Te pola NIE są tą migracją usuwane — ich wycofanie to zmiana
-- odejmująca, wymaga osobnej decyzji i migracji danych, a dopóki panel B2B z nich czyta,
-- usunięcie wywróciłoby działającą ścieżkę.

DO $$
BEGIN
  IF to_regclass('public.leady') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.leady nie istnieje — przerywam. Oferta bez klucza obcego do leada byłaby tabelą-sierotą.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quotes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID NOT NULL REFERENCES public.leady(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'DRAFT',
  -- PRICE-VAT-RATE: rodzaj obiektu ustalony przez AUDYTORA — ma pierwszeństwo przed
  -- deklaracją klienta z Triage (D17). NULL = jeszcze nieustalony.
  property_kind         TEXT,
  -- Stawka ZAMROŻONA w chwili wystawienia. Zapisana, a nie wyliczana przy odczycie:
  -- zmiana tabeli stawek nie może zmienić dokumentu, który klient już dostał.
  vat_rate_percent      INTEGER,
  selected_variant_id   UUID,
  -- D8: netto zestawu x (1 + stawka VAT obiektu) x 1,1. Liczone z WYBRANEGO wariantu.
  deposit_amount_gross  NUMERIC(12,2),
  sent_at               TIMESTAMPTZ,
  -- Wyliczane z SLA.QUOTE_VALIDITY (14 dni) w chwili wysłania. Literał 14 w kodzie
  -- byłby naruszeniem ADR-011 — próg ma jedno miejsce w kontrakcie SLA.
  valid_until           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_status_check') THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_status_check
      CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'));
  END IF;

  -- Próg powierzchni NIE występuje tutaj jako liczba. Nazwy pasm mówią „do progu"
  -- i „powyżej progu", a sam próg mieszka w SLA.PROPERTY_AREA_VAT_THRESHOLD (300 m²).
  -- Gdyby księgowy zmienił próg, ta migracja nie wymaga zmiany.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_property_kind_check') THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_property_kind_check
      CHECK (property_kind IS NULL OR property_kind IN ('RESIDENTIAL_UP_TO_THRESHOLD', 'RESIDENTIAL_ABOVE_THRESHOLD', 'COMMERCIAL'));
  END IF;

  -- Dwie dopuszczalne stawki (D16). Wartość spoza tego zbioru na dokumencie
  -- rozliczeniowym to błąd podatkowy, nie literówka — dlatego pilnuje tego baza.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_vat_rate_check') THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_vat_rate_check
      CHECK (vat_rate_percent IS NULL OR vat_rate_percent IN (8, 23));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quotes_lead_id_idx ON public.quotes (lead_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx  ON public.quotes (status);

COMMENT ON TABLE public.quotes IS
  'FLD-QUOTE-VARIANTS / FNL-E2-E3: oferta. Zastępuje dwa pola tekstowe na leadzie. Stawka VAT i kwota zaliczki są ZAMROŻONE w chwili wystawienia.';


CREATE TABLE IF NOT EXISTS public.quote_variants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id              UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  variant_number        INTEGER NOT NULL,
  name                  TEXT,
  total_net_amount      NUMERIC(12,2),
  -- Podstawa wzoru zaliczki z D8 — cena samego zestawu urządzeń, bez robocizny.
  equipment_net_amount  NUMERIC(12,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT quote_variants_quote_id_variant_number_key UNIQUE (quote_id, variant_number)
);

DO $$
BEGIN
  -- K2: od jednego do trzech wariantów. Ograniczenie w bazie, nie w formularzu —
  -- formularz da się ominąć zapisem przez warstwę API.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_variants_variant_number_check') THEN
    ALTER TABLE public.quote_variants
      ADD CONSTRAINT quote_variants_variant_number_check CHECK (variant_number IN (1, 2, 3));
  END IF;
END $$;

-- Wybrany wariant. FK dodawany PO utworzeniu quote_variants, bo wskazanie jest zwrotne.
-- ON DELETE SET NULL: usunięcie wariantu nie może kasować całej oferty.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_selected_variant_id_fkey') THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_selected_variant_id_fkey
      FOREIGN KEY (selected_variant_id) REFERENCES public.quote_variants(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS quotes_selected_variant_id_key
  ON public.quotes (selected_variant_id)
  WHERE selected_variant_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS public.quote_rooms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_variant_id  UUID NOT NULL REFERENCES public.quote_variants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  -- K7: moc WPISYWANA przez audytora, nie wyliczana z metrażu.
  power_kw          NUMERIC(6,2),
  position          INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS quote_rooms_variant_idx ON public.quote_rooms (quote_variant_id);


-- ── Pozycja oferty: TU MIESZKA NAJWAŻNIEJSZE OGRANICZENIE TEJ MIGRACJI ──
CREATE TABLE IF NOT EXISTS public.quote_items (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_variant_id            UUID NOT NULL REFERENCES public.quote_variants(id) ON DELETE CASCADE,
  -- NULL ZNACZY „pozycja ogólna całej instalacji", a nie „jeszcze nieuzupełnione" (D17).
  quote_room_id               UUID REFERENCES public.quote_rooms(id) ON DELETE CASCADE,
  scope                       TEXT NOT NULL,
  -- NULL dla pozycji indywidualnej spoza cennika (FLD-QUOTE-MANUAL-ITEM).
  -- ON DELETE RESTRICT: pozycji cennika użytej w ofercie nie wolno skasować — oferta
  -- historyczna musi się odtworzyć (macierz RBAC i tak nie daje nikomu prawa delete).
  price_list_item_id          UUID REFERENCES public.price_list_items(id) ON DELETE RESTRICT,
  price_list_item_version_id  UUID REFERENCES public.price_list_item_versions(id) ON DELETE RESTRICT,
  manual_name                 TEXT,
  manual_description          TEXT,
  quantity                    NUMERIC(12,3) NOT NULL,
  -- FLD-QUOTE-PRICE-SNAPSHOT: cena ZAMROŻONA, zapisana wprost. Bez tego zmiana cennika
  -- zmieniałaby sumę oferty, którą klient dostał mailem miesiąc wcześniej.
  unit_price_net              NUMERIC(12,2) NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_scope_check') THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT quote_items_scope_check CHECK (scope IN ('ROOM', 'INSTALLATION'));
  END IF;

  -- ════════════════════════════════════════════════════════════════════════════════
  -- D17, SEDNO PODZIAŁU FORMULARZA WYCENY NA DWIE CZĘŚCI.
  -- Pozycja o zasięgu ROOM MUSI wskazywać pomieszczenie; pozycja INSTALLATION MUSI
  -- mieć je puste. To jest miejsce na ograniczenie integralności, a nie na zaufanie
  -- aplikacji: bez tego CHECK-a nullowalna kolumna `quote_room_id` stałaby się furtką
  -- na pozycje-sieroty (trasa freonowa nieprzypisana do żadnego pomieszczenia) oraz na
  -- policzenie montażu jednostki zewnętrznej po jednym razie NA KAŻDE pomieszczenie.
  -- Oba błędy są ciche i widać je dopiero na fakturze.
  -- `scope` jest zdenormalizowany z price_list_items świadomie — CHECK nie sięga do innej
  -- tabeli, a wyzwalacz czytający cennik byłby droższy i dałby się ominąć przy ALTER TABLE
  -- ... DISABLE TRIGGER. Spójność zdenormalizowanej wartości z cennikiem pilnuje test.
  -- ════════════════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_scope_room_consistency_check') THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT quote_items_scope_room_consistency_check
      CHECK (
        (scope = 'ROOM'         AND quote_room_id IS NOT NULL) OR
        (scope = 'INSTALLATION' AND quote_room_id IS NULL)
      );
  END IF;

  -- Pozycja jest ALBO cennikowa, ALBO indywidualna — nigdy obie naraz i nigdy żadna.
  -- Pozycja indywidualna bez nazwy byłaby wierszem bez treści w ofercie dla klienta.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_catalog_xor_manual_check') THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT quote_items_catalog_xor_manual_check
      CHECK (num_nonnulls(price_list_item_id, manual_name) = 1);
  END IF;

  -- FLD-QUOTE-MANUAL-ITEM: opis jest OBOWIĄZKOWY dla pozycji indywidualnej (to tekst,
  -- który klient zobaczy w ofercie); dla pozycji cennikowej opis bierze się z cennika.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_manual_requires_description_check') THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT quote_items_manual_requires_description_check
      CHECK (manual_name IS NULL OR manual_description IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_quantity_positive_check') THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT quote_items_quantity_positive_check CHECK (quantity > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quote_items_variant_idx ON public.quote_items (quote_variant_id);
CREATE INDEX IF NOT EXISTS quote_items_room_idx    ON public.quote_items (quote_room_id);

COMMENT ON CONSTRAINT quote_items_scope_room_consistency_check ON public.quote_items IS
  'D17: pozycja ROOM wymaga pomieszczenia, pozycja INSTALLATION wymaga jego braku. Nullowalność quote_room_id jest domenowa (brak = pozycja ogólna), nie techniczna.';


-- ============================================================================
-- C. RLS — deny-by-default
-- ============================================================================
--
-- Włączamy RLS BEZ polityk, tak samo jak przy installation_phases (20260916060000).
-- Skutek: dostęp z klucza anonimowego i zalogowanego użytkownika jest ZABRONIONY,
-- a panel B2B i warstwa API Field App i tak idą przez Prismę, która RLS omija
-- (pułapka nr 1 z CLAUDE.md). Autoryzację niesie `can()` w warstwie serwerowej.
-- Polityki dopisze migracja tego modułu, gdy pojawi się ścieżka czytająca te dane
-- bezpośrednio z klienta — dziś taka nie istnieje i deny-by-default jest właściwą wartością.

ALTER TABLE public.price_list_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_item_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_variants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_rooms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items               ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- D. Sekcja diagnostyczna — do ręcznego uruchomienia PO migracji
-- ============================================================================
--
-- SELECT table_name, column_name, is_nullable, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name IN ('price_list_items','price_list_item_versions','quotes',
--                       'quote_variants','quote_rooms','quote_items')
--  ORDER BY table_name, ordinal_position;
--
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'public.quote_items'::regclass
--  ORDER BY conname;
--
-- Oczekiwane: quote_items_scope_room_consistency_check, quote_items_catalog_xor_manual_check,
-- quote_items_manual_requires_description_check, quote_items_quantity_positive_check,
-- quote_items_scope_check + PK i cztery FK.
--
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname = 'public' AND tablename = 'price_list_item_versions';
-- Oczekiwane: price_list_item_versions_current_per_item_key jako UNIQUE ... WHERE is_current.
--
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('price_list_items','price_list_item_versions','quotes',
--                    'quote_variants','quote_rooms','quote_items');
-- Oczekiwane: relrowsecurity = true dla wszystkich sześciu.
--
-- DOWÓD DZIAŁANIA GŁÓWNEGO OGRANICZENIA (uruchom w transakcji i wycofaj):
-- BEGIN;
--   -- oba zapisy MUSZĄ zakończyć się błędem CHECK:
--   -- INSERT ... (scope, quote_room_id) VALUES ('ROOM', NULL);
--   -- INSERT ... (scope, quote_room_id) VALUES ('INSTALLATION', '<id pomieszczenia>');
-- ROLLBACK;
-- ============================================================================
