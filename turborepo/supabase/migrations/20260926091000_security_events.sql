-- ============================================================================
-- SEC-ACCESS-DENIED-LOG — dziennik odmów dostępu (OSOBNY nośnik, nie audit_log)
-- WYMAGANIE: SEC-ACCESS-DENIED-LOG (contracts/requirements.contract.mjs)
-- Źródło decyzji: D-API-2 rozstrzygnięte 2026-09-24 (docs/workorders/FLD-API-LAYER.md,
--                 sekcja WYMAGA DECYZJI); kryterium 3 z FLD-API-LAYER („odmowa can()
--                 zostawia ślad w rejestrze, a nie cichy brak zmiany").
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  NIE URUCHAMIANA na żadnej bazie. Napisana w oknie KK-IMPL-2026Q4 (2026-09-24).       ║
-- ║  Po uruchomieniu PRZEPISZ TEN NAGŁÓWEK na stan faktyczny (wzorzec: 20260915120000).   ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- Zmiana ADDYTYWNA i IDEMPOTENTNA: nowa tabela + funkcja + wyzwalacz. Zero DROP na danych,
-- zero RENAME, zero ALTER na istniejącej tabeli, zero backfillu.
--
-- ════════════════════════════════════════════════════════════════════════════════════════
-- DLACZEGO TO NIE JEST audit_log — UZASADNIENIE ZAPISANE TUTAJ NA ŻĄDANIE, BO TO PYTANIE WRÓCI
-- ════════════════════════════════════════════════════════════════════════════════════════
-- Kuszące jest dopisanie wartości `access_denied` do AUDIT_REQUIREMENTS.mustLog i wrzucenie
-- odmów do istniejącej tabeli. Świadomie tego NIE robimy, z dwóch niezależnych powodów.
--
-- POWÓD 1 — TE TABELE ODPOWIADAJĄ NA RÓŻNE PYTANIA, A KSZTAŁT WYNIKA Z PYTANIA.
--   `audit_log` odpowiada na: „co się działo z danymi TEJ OSOBY". Stąd jego kolumny:
--     * record_id NOT NULL      -> wpis MUSI wskazywać rekord, którego dotyczy;
--     * justification >= 10 zn. -> człowiek tłumaczy, dlaczego to zrobił;
--     * legal_basis             -> podstawa prawna ze słownika RODO.
--   Odmowa dostępu odpowiada na inne pytanie: „kto i czego próbował, i czego mu odmówiono".
--   Nie ma rekordu, którego dotyczy (bywa, że WŁAŚNIE DLATEGO jest odmową — rekord nie istnieje
--   albo należy do kogoś innego), nie ma uzasadnienia od człowieka (nikt niczego nie uzasadnia,
--   bo nic nie zaszło) i nie ma podstawy prawnej. Zapisanie odmowy w audit_log wymagałoby więc
--   ATRAP w trzech kolumnach NARAZ — a atrapa w rejestrze dowodowym psuje ten rejestr dla jego
--   własnego zastosowania: od tej chwili „record_id" nie znaczy już „rekord, którego dotyczy".
--
-- POWÓD 2 — PROFIL RUCHU.
--   `audit_log` to pojedyncze wpisy przy operacjach wrażliwych (usunięcie, anonimizacja, zmiana
--   roli). Odmowy przychodzą SERIAMI: jeden skan katalogu to setki wierszy w kilka sekund.
--   Wspólna tabela znaczy, że skanowanie zasypuje dowody RODO i unieważnia retencję 1825 dni,
--   policzoną dla zupełnie innego wolumenu.
--
-- SKUTEK: `access_denied` NIE JEST wartością w AUDIT_REQUIREMENTS.mustLog i NIE jest dopisywane
-- do CHECK-a audit_log_operation_check. Ten plik nie dotyka audit_log w ogóle.
--
-- ════════════════════════════════════════════════════════════════════════════════════════
-- GRANICA: TYLKO AKTOR UWIERZYTELNIONY
-- ════════════════════════════════════════════════════════════════════════════════════════
-- Logujemy odmowy wobec aktora UWIERZYTELNIONEGO — dlatego actor_email jest NOT NULL i nie ma
-- tu kolumny na „anonim". Ruch anonimowy NIE tworzy wierszy. To nie jest oszczędność miejsca,
-- tylko warunek sensowności: dziennik zapisujący każde odrzucone żądanie z internetu sam staje
-- się wektorem zapełnienia dysku, czyli zamienia się w podatność, którą miał wykrywać.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.security_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NOT NULL wymusza granicę opisaną w nagłówku: nie ma wiersza bez znanego aktora.
  actor_email          TEXT NOT NULL,

  -- Rola W CHWILI ZDARZENIA, jako tekst — nie klucz obcy do authorized_users. Dziennik ma
  -- pamiętać stan z momentu odmowy, a rola bywa później zmieniana; wskazanie na konto
  -- pokazywałoby rolę DZISIEJSZĄ i zacierało dokładnie to, co dziennik ma utrwalić.
  actor_role           TEXT NOT NULL,

  -- Słownictwo z RESOURCES i z capability w MATRIX (contracts/rbac.contract.mjs), żeby
  -- dziennik dał się zestawić z macierzą. Bez CHECK-a na wartości: lista zasobów rośnie
  -- z każdym oknem kontraktowym, a dziennik odmów NIE MOŻE odrzucić wpisu dlatego, że ktoś
  -- próbował sięgnąć po zasób spoza słownika — to jest akurat przypadek najciekawszy.
  resource             TEXT NOT NULL,
  attempted_capability TEXT NOT NULL,

  -- Rozstrzygnięcie. Kolumna istnieje, mimo że dziś wartość jest w praktyce jedna, bo bez niej
  -- wiersz mówi tylko „coś się stało", a nie „co się stało".
  decision             TEXT NOT NULL,

  -- NULL dopuszczalne: odmowa może paść poza kontekstem HTTP (zadanie w tle, Server Action).
  endpoint             TEXT,

  occurred_at          TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS security_events_occurred_at_idx
  ON public.security_events (occurred_at);
-- „Pokaż wszystko, czego próbował ten aktor" — pytanie zadawane przy analizie incydentu.
CREATE INDEX IF NOT EXISTS security_events_actor_email_idx
  ON public.security_events (actor_email);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
-- Brak CREATE POLICY: deny-by-default (wzorzec z 20260824185845). Odczyt idzie przez Prismę
-- z bramką can() na security_events:read (wyłącznie admin), nie przez supabase-js.

-- ─────────────────────────────────────────────────────────────────────────────
-- APPEND-ONLY — wyzwalacz, nie obietnica
-- ─────────────────────────────────────────────────────────────────────────────
-- Wzorzec 1:1 z audit_log_append_only_trg (20260901220000) i employee_consents_append_only_trg
-- (20260821130000), razem z tamtym uzasadnieniem wyboru warstwy:
--   * CHECK nie widzi OLD, więc nie odróżni UPDATE od INSERT;
--   * REVOKE nie działa na rolę właściciela, którą łączy się Prisma;
--   * RLS Prisma omija.
-- Zostaje wyzwalacz albo obietnica. Tutaj argument jest MOCNIEJSZY niż gdziekolwiek indziej:
-- to właśnie konto administratora jest najciekawszym kontem dla kogoś, kto te odmowy generuje,
-- więc dziennik, który administrator może poprawić, nie jest dowodem niczego.
CREATE OR REPLACE FUNCTION public.security_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'security_events: dziennik odmow dostepu jest append-only (SEC-ACCESS-DENIED-LOG). Wpisu nie edytuje sie i nie usuwa — takze rola admin. Sprostowanie to NOWY WIERSZ.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS security_events_append_only_trg ON public.security_events;
CREATE TRIGGER security_events_append_only_trg
  BEFORE UPDATE OR DELETE ON public.security_events
  FOR EACH ROW EXECUTE FUNCTION public.security_events_append_only();

COMMENT ON TABLE public.security_events IS
  'SEC-ACCESS-DENIED-LOG (D-API-2): dziennik odmow dostepu wobec aktora UWIERZYTELNIONEGO. OSOBNY nosnik, NIE audit_log — tamta tabela odpowiada na pytanie „co sie dzialo z danymi tej osoby" (stad record_id NOT NULL, justification >= 10 znakow, legal_basis), a odmowa nie ma ani rekordu, ani uzasadnienia, ani podstawy prawnej; ma tez inny profil ruchu (serie przy skanowaniu). Ruch anonimowy NIE tworzy wierszy. APPEND-ONLY (security_events_append_only_trg).';
COMMENT ON COLUMN public.security_events.actor_email IS
  'NOT NULL celowo: logujemy wylacznie odmowy aktora UWIERZYTELNIONEGO. Dziennik zapisujacy ruch anonimowy sam stalby sie wektorem zapelnienia dysku.';
COMMENT ON COLUMN public.security_events.actor_role IS
  'Rola W CHWILI ZDARZENIA, jako tekst — nie FK do authorized_users. Rola bywa pozniej zmieniana, a dziennik ma utrwalic stan z momentu odmowy.';
COMMENT ON COLUMN public.security_events.resource IS
  'Slownictwo z RESOURCES (rbac.contract.mjs), ale BEZ CHECK-a: proba siegniecia po zasob spoza slownika jest przypadkiem najciekawszym i nie moze zostac odrzucona przez baze.';
COMMENT ON FUNCTION public.security_events_append_only() IS
  'Odrzuca UPDATE i DELETE na security_events takze dla polaczenia omijajacego RLS (Prisma). Ten sam wzorzec co audit_log_append_only().';
