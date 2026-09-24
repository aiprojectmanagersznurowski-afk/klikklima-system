-- ============================================================================
-- B2C-SOFT-LEAD-CONSENT — zgoda RODO przy porzuconym leadzie (luka, nie decyzja)
-- WYMAGANIE: B2C-SOFT-LEAD-CONSENT (contracts/requirements.contract.mjs)
-- Źródło: potwierdzenie Michała 2026-09-24, że to LUKA. Gałąź feat/b2c-triage włącza
--         zbieranie numeru telefonu na stronie lądowania.
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  NIE URUCHAMIANA na żadnej bazie. Napisana w oknie KK-IMPL-2026Q4 (2026-09-24).       ║
-- ║  Po uruchomieniu PRZEPISZ TEN NAGŁÓWEK na stan faktyczny (wzorzec: 20260915120000).   ║
-- ║                                                                                        ║
-- ║  STAN ZASTANY POTWIERDZONY NA ŻYWEJ BAZIE 2026-09-24 (information_schema.columns):    ║
-- ║  soft_leady ma DOKŁADNIE PIĘĆ kolumn — id, dane_kontaktowe, dane_cząstkowe, status,   ║
-- ║  created_at. Ani pola zgody, ani odwołania do wersji dokumentu prawnego.              ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- Zmiana ADDYTYWNA: dwie nowe kolumny NULLOWALNE + FK + indeks. Zero DROP, zero RENAME,
-- zero NOT NULL na istniejącej tabeli, zero backfillu.
--
-- ── DLACZEGO OBIE KOLUMNY SĄ NULLOWALNE (to jest decyzja, nie niedokończona robota) ──
-- Tabela ma DANE PRODUKCYJNE. Kolumna NOT NULL bez wartości domyślnej na istniejącej tabeli
-- jest w tym repozytorium zabroniona, a wartości domyślnej tu wymyślić NIE WOLNO: domyślna
-- zgoda jest zgodą, której nikt nie udzielił.
--
-- BACKFILL FAŁSZYWĄ ZGODĄ JEST ODRZUCONY WPROST. Wpisanie istniejącym wierszom wskazania na
-- jakąkolwiek wersję dokumentu wytworzyłoby DOWÓD PO FAKCIE — dokładnie ta sama wada, przed
-- którą broni append-only w employee_consents i w audit_log. Rejestr zgody, który można sobie
-- dopisać wstecz, nie jest dowodem niczego, a wobec organu jest gorszy niż jego brak.
--
-- CO ZROBIĆ Z WIERSZAMI SPRZED ZMIANY, jest pytaniem do Work Ordera, nie do tej migracji.
-- Realne warianty: usunięcie albo oznaczenie jako niekontaktowalne. Do czasu rozstrzygnięcia
-- egzekwowanie „nie ma soft leada bez zgody" żyje w Server Action (schemat Zod), a zaostrzenie
-- do NOT NULL jest OSOBNĄ migracją po backfillu — kolejność nullable -> backfill -> ograniczenie,
-- nigdy odwrotnie.
--
-- ── NAZEWNICTWO ──
-- Tabela `soft_leady` ma nazwę polską i jest zamrożonym długiem KK-NAMING-BASELINE; NOWE
-- kolumny nazywają się po angielsku w snake_case (ADR-002): consent_version_id,
-- consent_granted_at. Nazwa tabeli w ALTER TABLE musi wskazać obiekt, który ISTNIEJE.
-- ============================================================================

ALTER TABLE public.soft_leady
  ADD COLUMN IF NOT EXISTS consent_version_id UUID,
  ADD COLUMN IF NOT EXISTS consent_granted_at TIMESTAMPTZ(6);

-- Wskazanie wersji KLUCZEM OBCYM, nie numerem i nie flagą — wzorzec B2C-CONSENT-RODO
-- i employee_consents.version_id. Sama flaga „zgodził się" nie odpowiada na pytanie „na co",
-- a to jest jedyne pytanie, które pada przy kontroli. Numer wersji jako tekst też nie
-- wystarcza: wskazanie nieistniejącej wersji ma odrzucać BAZA, nie walidacja aplikacyjna.
--
-- RESTRICT, nie CASCADE i nie SET NULL: wersji dokumentu, na którą ktoś się powołał, nie wolno
-- usunąć, a zgoda wskazująca „coś, czego już nie ma" jest skasowanym dowodem. SET NULL byłby
-- tu tak samo zły jak CASCADE — cicho zamieniłby zgodę udzieloną w zgodę nieudokumentowaną.
--
-- Blok osłonięty, bo legal_document_versions powstaje migracją 20260821130000: przy ręcznym
-- uruchomieniu poza kolejnością na produkcji tabela mogła jeszcze nie istnieć. Świeży replay
-- wg nazw plików ma ją na pewno. W obu porządkach stan końcowy jest identyczny, a migracja
-- nie wywraca się — zostawia NOTICE.
DO $$
BEGIN
  IF to_regclass('public.legal_document_versions') IS NULL THEN
    RAISE NOTICE 'legal_document_versions jeszcze nie istnieje — FK soft_leady.consent_version_id NIE zalozony. Uruchom 20260821130000, a potem ponownie ten plik.';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'soft_leady_consent_version_id_fkey'
       AND conrelid = to_regclass('public.soft_leady')
  ) THEN
    ALTER TABLE public.soft_leady
      ADD CONSTRAINT soft_leady_consent_version_id_fkey
      FOREIGN KEY (consent_version_id)
      REFERENCES public.legal_document_versions(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS soft_leady_consent_version_id_idx
  ON public.soft_leady (consent_version_id);

COMMENT ON COLUMN public.soft_leady.consent_version_id IS
  'B2C-SOFT-LEAD-CONSENT: WERSJA dokumentu prawnego, na ktora klient wyrazil zgode — klucz obcy (RESTRICT) do legal_document_versions, nigdy flaga logiczna i nigdy numer jako tekst. NULLOWALNA, bo tabela ma dane produkcyjne; backfill falszywa zgoda jest ODRZUCONY (byly dowod wytworzony po fakcie). Zaostrzenie do NOT NULL to osobna migracja po rozstrzygnieciu, co zrobic z wierszami sprzed zmiany.';
COMMENT ON COLUMN public.soft_leady.consent_granted_at IS
  'Moment udzielenia zgody (timestamptz). Razem z consent_version_id tworzy komplet wymagany przez B2C-CONSENT-RODO: kiedy i NA CO.';
