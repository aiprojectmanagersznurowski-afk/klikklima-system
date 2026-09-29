-- ============================================================================
-- B2C-RLS-PUBLIC (AC4) — polityki odczytu anonimowego dla katalogu wg decyzji D-R1
-- WYMAGANIE: B2C-RLS-PUBLIC (contracts/requirements.contract.mjs)
-- Work Order: docs/workorders/B2C-RLS-PUBLIC.md
--
-- ── DECYZJA D-R1 (człowiek, 2026-09-29) ──
-- Publiczny katalog (anon SELECT):
--   indoor_units, outdoor_units              — polityka istnieje (20260824185845), bez zmian
--   single_split_sets, multi_split_sets,
--   modele_3d                                — DODAWANA tutaj
--   available_combinations                   — widok zmaterializowany, RLS nie dotyczy;
--                                              GRANT SELECT TO anon jest w 20260910090000,
--                                              bez zmian
--   knowledge_base                           — polityka access_level = 'public', bez zmian
-- NIEPUBLICZNE:
--   cennik_uslug (cennik usług montażowych)  — polityka "Public catalog read" COFANA tutaj.
--                                              RLS zostaje włączone, zero polityk anon
--                                              = domyślna odmowa.
--   system_config, visit_duration_baskets    — nie są katalogiem; bez polityk anon, odczyt
--                                              wyłącznie kluczem serwisowym w Server Action.
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  URUCHOMIONA na żywej bazie 2026-09-29 (jedna transakcja, 11 poleceń).               ║
-- ║  Weryfikacja realnym SELECT count(*) pod SET LOCAL ROLE anon: single_split_sets 46,  ║
-- ║  multi_split_sets 62, modele_3d 0 (tabela pusta także dla właściciela),              ║
-- ║  cennik_uslug 0 (właściciel widzi 6). pg_policies: cennik_uslug bez polityk.         ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- ── STAN ZASTANY PRZED MIGRACJĄ (żywa baza, pg_class/pg_policies, 2026-09-29) ──
-- single_split_sets, multi_split_sets, modele_3d: relrowsecurity = true, ZERO polityk
-- (anonimowy odczyt zwracał pusty zbiór). cennik_uslug: relrowsecurity = true, jedna
-- polityka "Public catalog read" FOR SELECT TO anon USING (true).
--
-- ── SKUTEK DLA APLIKACJI — PRZECZYTAJ PRZED WDROŻENIEM ──
-- Po DROP POLICY klient z kluczem ANONIMOWYM dostaje z cennik_uslug pusty zbiór (bez błędu).
-- Czytają tę tabelę: apps/b2c-web/app/actions/getLowestPriceForIndoorUnit.ts,
-- getSetForConfig.ts, getRecommendation.ts, getCatalog.ts, getBestsellers.ts.
-- DZIŚ wszystkie używają lib/supabaseClient.ts, który daje pierwszeństwo kluczowi
-- serwisowemu (omija RLS) — więc na produkcji z ustawionym SUPABASE_SERVICE_ROLE_KEY
-- ta migracja niczego nie psuje. Zepsuje ceny montażu w chwili przełączenia
-- supabaseClient.ts na klucz anonimowy (AC5), jeżeli te pięć plików nie przejdzie
-- wcześniej na osobny klient serwisowy w Server Action. To robota implementer-server.
--
-- Zmiana ADDYTYWNA dla trzech tabel, zawężająca dla cennik_uslug (świadomie, wg D-R1).
-- Idempotentna: DROP POLICY IF EXISTS przed każdym CREATE; ENABLE RLS jest no-opem
-- na tabelach, które już je mają, i chroni przed polityką martwą przy wyłączonym RLS.
-- ============================================================================

-- ── 1. Katalog zestawów i modeli 3D: publiczny odczyt ──
ALTER TABLE public.single_split_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public catalog read" ON public.single_split_sets;
CREATE POLICY "Public catalog read" ON public.single_split_sets
  FOR SELECT TO anon USING (true);

ALTER TABLE public.multi_split_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public catalog read" ON public.multi_split_sets;
CREATE POLICY "Public catalog read" ON public.multi_split_sets
  FOR SELECT TO anon USING (true);

ALTER TABLE public.modele_3d ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public catalog read" ON public.modele_3d;
CREATE POLICY "Public catalog read" ON public.modele_3d
  FOR SELECT TO anon USING (true);

-- ── 2. Cennik usług montażowych: cofnięcie publicznego odczytu (D-R1) ──
ALTER TABLE public.cennik_uslug ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public catalog read" ON public.cennik_uslug;
