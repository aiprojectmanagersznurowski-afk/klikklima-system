-- ============================================================================
-- B2C-CONSENT-RODO — Z2: zgoda klienta zapisywana z leadem (dwie zgody, dwie wersje)
-- WYMAGANIE: B2C-CONSENT-RODO (contracts/requirements.contract.mjs)
-- WO: docs/workorders/B2C-CONSENT-RODO.md — D-C1 = (b), D-C3 = (a) (Michał, 2026-09-28).
--
-- STAN: URUCHOMIONA na żywej bazie 2026-09-29 w oknie KK-B2C-CONSENT-RODO, PO 20260929090000.
--       Sprawdzona w information_schema.columns, pg_constraint (confdeltype = 'r') i pg_indexes.
--       Stan zastany przed uruchomieniem: leady = 221 wierszy, zero kolumn zgody;
--       legal_document_versions = 0 wierszy.
--
-- Zmiana ADDYTYWNA: cztery nowe kolumny NULLOWALNE + dwa FK + dwa indeksy. Zero DROP, zero
-- RENAME, zero NOT NULL, zero CHECK, zero backfillu.
--
-- ── DLACZEGO NULLOWALNE I BEZ CHECK (D-C3 = (a)) ──
-- 221 leadów historycznych nie ma zgody. Backfill fałszywą zgodą jest ODRZUCONY (wytworzony po
-- fakcie dowód; B2C-SOFT-LEAD-CONSENT kryt. 8). Inwariant „nie ma leada bez zgody" obowiązuje od
-- daty wdrożenia i żyje WYŁĄCZNIE w Server Action saveLead (schemat Zod). Zaostrzenie w bazie —
-- jeśli kiedykolwiek — to osobna migracja i osobna decyzja.
--
-- ── ZGODNOŚĆ RODZAJU NIE JEST PILNOWANA PRZEZ BAZĘ ──
-- FK nie widzi document_kind: privacy_policy_consent_version_id MOŻE technicznie wskazać wersję
-- B2C_TERMS. Rodzaj, status „obowiązująca" i „nie szkic" sprawdza Server Action (AC5 WO).
--
-- ── NAZEWNICTWO ──
-- Tabela `leady` to zamrożony dług KK-NAMING-BASELINE; nowe kolumny po angielsku, snake_case
-- (ADR-002), wzorem soft_leady.consent_version_id / consent_granted_at, z prefiksem dokumentu.
-- Nazwy FK i indeksów = domyślne nazwy Prismy, żeby `prisma migrate diff` nie widział dryfu.
-- ============================================================================

ALTER TABLE public.leady
  ADD COLUMN IF NOT EXISTS privacy_policy_consent_version_id UUID,
  ADD COLUMN IF NOT EXISTS privacy_policy_consent_granted_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS terms_consent_version_id UUID,
  ADD COLUMN IF NOT EXISTS terms_consent_granted_at TIMESTAMPTZ(6);

-- RESTRICT, nie CASCADE i nie SET NULL: wersji dokumentu, na którą klient się powołał, nie wolno
-- usunąć; SET NULL cicho zamieniłby zgodę udzieloną w nieudokumentowaną.
-- Osłona to_regclass: legal_document_versions powstaje w 20260821130000 — przy ręcznym
-- uruchomieniu poza kolejnością migracja nie wywraca się, zostawia NOTICE; w obu porządkach
-- stan końcowy po ponownym przebiegu jest identyczny.
DO $$
BEGIN
  IF to_regclass('public.legal_document_versions') IS NULL THEN
    RAISE NOTICE 'legal_document_versions jeszcze nie istnieje — FK zgod na leady NIE zalozone. Uruchom 20260821130000, a potem ponownie ten plik.';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'leady_privacy_policy_consent_version_id_fkey'
         AND conrelid = to_regclass('public.leady')
    ) THEN
      ALTER TABLE public.leady
        ADD CONSTRAINT leady_privacy_policy_consent_version_id_fkey
        FOREIGN KEY (privacy_policy_consent_version_id)
        REFERENCES public.legal_document_versions(id)
        ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'leady_terms_consent_version_id_fkey'
         AND conrelid = to_regclass('public.leady')
    ) THEN
      ALTER TABLE public.leady
        ADD CONSTRAINT leady_terms_consent_version_id_fkey
        FOREIGN KEY (terms_consent_version_id)
        REFERENCES public.legal_document_versions(id)
        ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

-- Postgres nie indeksuje FK sam, a RESTRICT przy DELETE wersji skanuje leady po tej kolumnie.
CREATE INDEX IF NOT EXISTS leady_privacy_policy_consent_version_id_idx
  ON public.leady (privacy_policy_consent_version_id);
CREATE INDEX IF NOT EXISTS leady_terms_consent_version_id_idx
  ON public.leady (terms_consent_version_id);

COMMENT ON COLUMN public.leady.privacy_policy_consent_version_id IS
  'B2C-CONSENT-RODO: WERSJA polityki prywatnosci (B2C_PRIVACY_POLICY), na ktora klient wyrazil zgode — FK RESTRICT do legal_document_versions, nigdy flaga. NULLOWALNA: 221 leadow historycznych bez zgody, backfill falszywa zgoda ODRZUCONY (D-C3 = a). Rodzaj dokumentu sprawdza Server Action, nie baza.';
COMMENT ON COLUMN public.leady.privacy_policy_consent_granted_at IS
  'B2C-CONSENT-RODO: moment udzielenia zgody na polityke prywatnosci (timestamptz serwera, nie przegladarki).';
COMMENT ON COLUMN public.leady.terms_consent_version_id IS
  'B2C-CONSENT-RODO: WERSJA regulaminu serwisu (B2C_TERMS), na ktora klient wyrazil zgode — FK RESTRICT do legal_document_versions, nigdy flaga. NULLOWALNA: 221 leadow historycznych bez zgody, backfill falszywa zgoda ODRZUCONY (D-C3 = a). Rodzaj dokumentu sprawdza Server Action, nie baza.';
COMMENT ON COLUMN public.leady.terms_consent_granted_at IS
  'B2C-CONSENT-RODO: moment udzielenia zgody na regulamin (timestamptz serwera, nie przegladarki).';
