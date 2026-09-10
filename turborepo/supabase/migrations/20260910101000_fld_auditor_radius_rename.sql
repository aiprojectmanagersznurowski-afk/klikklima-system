-- ══════════════════════════════════════════════════════════════════════════════════════
-- FLD-AUDITOR-RADIUS-RENAME — ujednolicenie nazwy promienia działania
-- Okno kontraktowe: FLD-AUDITOR-RADIUS-RENAME (2026-09-10)
-- ══════════════════════════════════════════════════════════════════════════════════════
--
-- Decyzja Michała z 2026-09-10: jedno pojęcie ma mieć jedną nazwę. Promień działania
-- pracownika terenowego nazywa się `promien_dzialania_km` — nazwa już przyjęta u ekip.
-- Audytor dostosowuje się do istniejącego wzorca; NIE wymyślamy trzeciej nazwy.
--
--   audytorzy.max_promien_dojazdu_km  →  audytorzy.promien_dzialania_km
--
-- ── CO TA MIGRACJA ZAMYKA ─────────────────────────────────────────────────────────────
-- Migracja 20260910100000_fld_calendar_foundation.sql (nagłówek „CZEGO TU NIE MA
-- I DLACZEGO" oraz COMMENT ON COLUMN na audytorzy.max_promien_dojazdu_km) opisywała
-- asymetrię nazw jako stan ZAMIERZONY i ZAMROŻONY („zmiana nazwy wymaga osobnej zgody
-- oraz ADR"). Zgoda padła, okno zostało otwarte — tamten opis jest od tej migracji
-- NIEAKTUALNY i nie należy się nim kierować przy czytaniu historii. Komentarz na kolumnie
-- jest tu nadpisywany, bo RENAME COLUMN przenosi stary COMMENT na nową nazwę i bez tego
-- baza twierdziłaby, że „asymetria jest zamrożonym długiem" — o asymetrii, której już nie ma.
--
-- ── DLACZEGO RENAME, A NIE DROP + ADD ─────────────────────────────────────────────────
-- RENAME zachowuje dane, typ (INTEGER), nullability i wszystkie zależne obiekty.
-- DROP + ADD skasowałby wartości promienia dla wszystkich audytorów. Zakaz bezwzględny.
--
-- ── ZMIANA ŁAMIĄCA KOMPATYBILNOŚĆ ─────────────────────────────────────────────────────
-- Każdy kod czytający starą nazwę przestaje działać w momencie zastosowania tej migracji.
-- Ten commit zawiera WYŁĄCZNIE warstwę kontraktową: migrację, schema.prisma i rejestr
-- wymagań. Poza zakresem roli `contract-steward` (blokada guard-paths) i wymagające
-- osobnych tur PRZED uruchomieniem migracji na żywej bazie:
--   * implementer-server / implementer-ui — apps/b2b-web/src/app/(dashboard)/auditors/:
--     actions.ts (7), schema.ts (1), auditors-client.tsx (1), components/AddAuditorModal.tsx (5)
--   * test-author — 7 plików w apps/b2b-web/tests/ (lista w podsumowaniu okna)
-- Do czasu obu tur `npx tsc --noEmit` w apps/b2b-web jest czerwony na tych plikach.
-- To znany, jawny stan pośredni, a nie regresja.
--
-- ── UWAGA NAZEWNICZA (ADR-002) ────────────────────────────────────────────────────────
-- `promien_dzialania_km` jest nazwą POLSKĄ, więc formalnie niezgodną z ADR-002 tak samo
-- jak nazwa poprzednia. Ta migracja NIE naprawia zgodności z ADR-002 — usuwa wyłącznie
-- rozdwojenie nazw jednego pojęcia. Docelowe `action_radius_km` na tabeli `auditors`
-- należy do szerszej migracji nazewniczej całego schematu (audytorzy → auditors,
-- zespoly_monterskie → crews wg docs/architecture/NAMING.md) i jest osobną decyzją.
-- ══════════════════════════════════════════════════════════════════════════════════════

-- Idempotentnie: migracja może być bezpiecznie uruchomiona ponownie na bazie,
-- na której rename już zaszedł (kolumna docelowa istnieje, źródłowa nie).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audytorzy'
      AND column_name = 'max_promien_dojazdu_km'
  ) THEN
    ALTER TABLE public.audytorzy
      RENAME COLUMN max_promien_dojazdu_km TO promien_dzialania_km;
  END IF;
END
$$;

-- Nadpisanie komentarza odziedziczonego po starej nazwie: asymetria nazw już nie istnieje.
COMMENT ON COLUMN public.audytorzy.promien_dzialania_km IS
  'Promień działania audytora w km (CRM-REGION-AUTO, model promieniowy). Nazwa ujednolicona z zespoly_monterskie.promien_dzialania_km w oknie FLD-AUDITOR-RADIUS-RENAME (2026-09-10) — wcześniej max_promien_dojazdu_km. Jedno pojęcie, jedna nazwa, dwa miejsca odczytu. NULL = promień nieustalony, co znaczy „brak danych", NIE „0 km" i NIE „nieograniczony".';
