-- ============================================================================
-- SECURITY — cofnięcie anonimowego INSERT do leady / klienci / adresy
-- Okno kontraktowe: ticket B2C-CONSENT-RODO-RLS-FIX
-- Znalezisko: rls-security-auditor, 2026-09-30 (po scaleniu B2C-CONSENT-RODO, PR #40)
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  URUCHOMIONA na żywej bazie 2026-09-30 (jedna transakcja, 6 poleceń, COMMIT).        ║
-- ║  Po: pg_policies na trzech tabelach = 0 wierszy; has_table_privilege(anon, INSERT)   ║
-- ║  = false x3; realny INSERT pod SET LOCAL ROLE anon -> 42501 permission denied.       ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- ── KONTEKST ──
-- Migracja 20260824185845_security_enable_rls_baseline.sql założyła trzy polityki
-- FOR INSERT TO anon WITH CHECK (true), bo wtedy apps/b2c-web/app/actions/saveLead.ts
-- zapisywał lead przez supabase-js z kluczem ANONIMOWYM.
-- Od B2C-LEAD-ATOMIC (commit 441aeeb) saveLead.ts zapisuje WYŁĄCZNIE przez Prismę
-- (połączenie serwerowe, omija RLS) w jednej transakcji. Polityki zostały martwe.
--
-- ── DLACZEGO TO LUKA ──
-- NEXT_PUBLIC_SUPABASE_ANON_KEY jest z założenia publiczny (bundel przeglądarki).
-- Z tymi politykami każdy mógł przez PostgREST wstawić bezpośrednio dowolny wiersz
-- do leady / klienci / adresy — z pominięciem Server Action, a więc z pominięciem
-- walidacji Zod, walidacji zgód RODO (B2C-CONSENT-RODO), blokady slotu i transakcji.
--
-- ── DOWÓD, ŻE APLIKACJA NIE POTRZEBUJE TEJ ŚCIEŻKI (2026-09-30) ──
-- grep po apps/ i packages/ (ts, tsx, js, mjs): zero wywołań supabase-js
-- .from(<ta tabela>).insert/.upsert w kodzie aplikacji. Jedyne trafienia to luźne skrypty
-- diagnostyczne w apps/b2c-web/ (test-insert.js, test-insert.mjs, test-error.js) — nie są
-- częścią aplikacji i po tej migracji przestaną działać, co jest skutkiem zamierzonym.
-- getFomoSlots.ts tylko CZYTA leady (klient serwisowy) — bez zmian.
--
-- ── STAN ZASTANY PRZED MIGRACJĄ (żywa baza, 2026-09-30) ──
-- pg_policies na tych trzech tabelach: WYŁĄCZNIE trzy polityki poniżej (cmd INSERT, {anon}).
-- has_table_privilege(anon, INSERT) = true dla wszystkich trzech; relrowsecurity = true.
--
-- ── ZAKRES ──
-- Tylko INSERT dla anon. Pozostałe granty domyślne Supabase (SELECT/UPDATE/DELETE/...)
-- zostają; RLS jest włączone i bez polityk dla anon, więc są domyślną odmową.
-- Rola authenticated nie jest tu ruszana (brak polityk = odmowa pod RLS).
--
-- Idempotentna: DROP POLICY IF EXISTS; REVOKE nieistniejącego uprawnienia jest no-opem.
-- Zawężająca świadomie — usuwa wyłącznie martwą ścieżkę zapisu.
-- ============================================================================

DROP POLICY IF EXISTS "Allow anon insert on klienci" ON public.klienci;
DROP POLICY IF EXISTS "Allow anon insert on adresy" ON public.adresy;
DROP POLICY IF EXISTS "Allow anon insert on leady" ON public.leady;

REVOKE INSERT ON public.klienci FROM anon;
REVOKE INSERT ON public.adresy FROM anon;
REVOKE INSERT ON public.leady FROM anon;
