-- ============================================================================
-- B2C-CATALOG-VIEW-TRACKED — odtworzenie w repo obiektów silnika doboru urządzeń
-- WYMAGANIE: B2C-CATALOG-VIEW-TRACKED (contracts/requirements.contract.mjs)
-- Ticket okna kontraktowego: B2C-CATALOG-VIEW-UNTRACKED
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  TA MIGRACJA NIE BYŁA I NIE MA BYĆ URUCHAMIANA NA ŻYWEJ BAZIE.                        ║
-- ║  Wszystkie opisane tu obiekty JUŻ ISTNIEJĄ na produkcji — powstały poza repozytorium. ║
-- ║  Plik jest wierną transkrypcją stanu faktycznego odczytanego 2026-09-10 przez         ║
-- ║  pg_get_viewdef / pg_get_functiondef / pg_get_triggerdef / pg_indexes, po to, żeby     ║
-- ║  `supabase db reset` i lokalny stack w CI odtworzyły ten sam stan od zera.            ║
-- ║  Wdrożenie na produkcję jest z założenia NO-OP (patrz "Idempotencja" niżej).          ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- ── DLACZEGO ─────────────────────────────────────────────────────────────────────────────
-- `public.available_combinations` (pg_class.relkind = 'm', czyli widok ZMATERIALIZOWANY)
-- jest jedynym źródłem danych silnika doboru i cen w Triage B2C. KONSUMENCI
-- (apps/b2c-web/app/actions/): getRecommendation.ts, getCatalog.ts, getBestsellers.ts,
-- getSetForConfig.ts, getLowestPriceForIndoorUnit.ts, getValidConfigurations.ts.
-- Do dziś obiekt nie miał definicji w ŻADNEJ migracji ani w schema.prisma — istniał wyłącznie
-- na serwerze produkcyjnym. Skutki, które to zamyka:
--   1. `supabase db reset` / lokalny stack CI dawał bazę BEZ tego widoku, więc 12 testów E2E
--      katalogu i rekomendacji (catalog.spec.ts, triage.spec.ts, device-modal-disqualify.spec.ts,
--      triage-disqualify.spec.ts) było czerwonych z powodu braku obiektu, a nie z powodu regresu.
--   2. Migracja 20260824185845_security_enable_rls_baseline.sql (sekcja 5) musiała osłonić swój
--      REVOKE/GRANT blokiem `IF to_regclass('public.available_combinations') IS NOT NULL`,
--      bo „ten widok nie powstaje w ŻADNEJ migracji ani w schema.prisma" (cytat z tamtego pliku).
--      Osłona ZOSTAJE — patrz "Kolejność wobec RLS baseline" niżej.
--   3. Wymaganie B2C-PRICE-FROM (risk HIGH) zależy semantycznie od kolumny total_devices_price
--      tego widoku, a jej definicja nie podlegała review ani bramce kontraktu.
--
-- Ten sam wzorzec obiektu żyjącego wyłącznie na produkcji opisuje pamięć projektu
-- „Obiekty bazy poza migracjami" — available_combinations i buckety Storage. Ten plik zamyka
-- pierwszą połowę tego długu.
--
-- ── ZAKRES ───────────────────────────────────────────────────────────────────────────────
-- Zmiana ADDYTYWNA i wyłącznie ODTWARZAJĄCA: zero DROP, zero RENAME, zero ALTER na istniejącej
-- tabeli, zero nowej logiki. Ani jedna definicja nie została „poprawiona" przy przepisywaniu —
-- także tam, gdzie stan faktyczny budzi wątpliwości (patrz "Znane zastrzeżenia").
--
-- ── IDEMPOTENCJA I ŚWIADOMA GRANICA `IF NOT EXISTS` ──────────────────────────────────────
-- CREATE OR REPLACE FUNCTION — idempotentne z natury (opisuje stan docelowy).
-- CREATE MATERIALIZED VIEW IF NOT EXISTS + CREATE INDEX IF NOT EXISTS — świadomie NIE
-- nadpisują istniejącego obiektu. Konsekwencja, którą przyjmujemy z otwartymi oczami:
-- jeżeli produkcyjna definicja kiedykolwiek rozjedzie się z zapisaną tutaj, wdrożenie tego
-- pliku NICZEGO nie naprawi i nie zgłosi błędu. To jest cena za bezpieczeństwo — alternatywa
-- (DROP MATERIALIZED VIEW + CREATE) kasowałaby obiekt, od którego zależy działający katalog
-- B2C, i wymagałaby pełnego REFRESH pod ruchem. Wykrywanie rozjazdu jest zadaniem TESTU
-- STATYCZNEGO z acceptance wymagania B2C-CATALOG-VIEW-TRACKED, nie tej migracji.
-- DROP TRIGGER IF EXISTS + CREATE TRIGGER — to jedyne miejsce z faktycznym nadpisaniem;
-- CREATE TRIGGER nie ma wariantu IF NOT EXISTS, a definicja odtwarzana jest 1:1.
--
-- ── KOLEJNOŚĆ WOBEC RLS BASELINE ─────────────────────────────────────────────────────────
-- 20260824185845 (RLS baseline) ma timestamp WCZEŚNIEJSZY niż ten plik, więc przy odtwarzaniu
-- bazy od zera jego blok `to_regclass` trafia na jeszcze nieistniejący widok i słusznie nic nie
-- robi. Dlatego uprawnienia obiektowe (REVOKE ALL + GRANT SELECT) są POWTÓRZONE na końcu tego
-- pliku — inaczej świeży lokalny stack miałby widok bez GRANT-u dla `anon`, a b2c-web czyta go
-- przez supabase-js kluczem anon. Osłony `to_regclass` w tamtym pliku NIE USUWAMY: ona chroni
-- odtworzenie bazy od zera na wypadek, gdyby ten plik kiedyś został wycofany, i na żywej bazie
-- wykonuje dokładnie te same dwie komendy.
-- RLS na widoku zmaterializowanym NIE ISTNIEJE (Postgres go nie wspiera) — jedyną bramką są
-- uprawnienia obiektowe. Pełne uzasadnienie: 20260824185845, sekcja 5.
--
-- ── DECYZJA: ODŚWIEŻANIE WIDOKU (rozstrzygnięte 2026-09-10, żeby nie zgubić tego po raz drugi) ─
-- Pytanie postawione w zadaniu brzmiało: czy brak odświeżania jest świadomy, czy zapomniany.
-- ODPOWIEDŹ Z PRODUKCJI, nie z domysłu: odświeżanie ISTNIEJE i jest AUTOMATYCZNE. Odczyt
-- pg_trigger 2026-09-10 pokazał CZTERY aktywne triggery FOR EACH STATEMENT (refresh_combinations_
-- on_single / _on_multi / _on_indoor / _on_outdoor), wszystkie wołające refresh_available_
-- combinations(), która robi pełne `REFRESH MATERIALIZED VIEW public.available_combinations`.
-- One także nie miały definicji w repo — są odtworzone niżej. Nie dokładamy triggera, bo jest;
-- nie dokładamy pg_cron, bo schemat `cron` na tej bazie nie istnieje (to_regclass('cron.job') = NULL)
-- i nie jest potrzebny.
--
-- ── ZNANE ZASTRZEŻENIA (odtworzone bez zmian, ŚWIADOMIE POZA ZAKRESEM tego pliku) ─────────
-- Zapisane tu, żeby przy następnym czytaniu nie wyglądały na przeoczenie:
--   A. REFRESH jest pełny i BLOKUJĄCY (bez CONCURRENTLY): każdy INSERT/UPDATE/DELETE na
--      indoor_units / outdoor_units / single_split_sets / multi_split_sets przelicza cały widok
--      i na czas przeliczenia blokuje odczyty katalogu B2C. CONCURRENTLY wymaga UNIKALNEGO
--      indeksu, a żaden z trzech istniejących nim nie jest — i przy obecnej definicji widoku
--      (UNION ALL + GROUP BY) nie ma oczywistego klucza kandydującego. Zmiana na CONCURRENTLY
--      to nowy indeks unikalny + dowód unikalności = osobne wymaganie, nie transkrypcja.
--   B. Drugie ramię UNION (MULTI) łączy indoor_units z outdoor_units WYŁĄCZNIE po marce
--      (iu.brand = ou.brand AND iu.is_multi_compatible), bez powiązania z mss.indoor_units_json,
--      i używa GROUP BY zamiast DISTINCT przy braku funkcji agregującej w SELECT. To może
--      produkować kombinacje szersze, niż wynika z definicji zestawu multi-split.
--   C. Kolumna is_available jest stałą `true` — nie odzwierciedla żadnego stanu magazynowego.
-- Żadne z powyższych NIE jest naprawiane w tym pliku. Naprawa = zmiana zachowania silnika cen
-- B2C (B2C-PRICE-FROM, risk HIGH), więc wymaga własnego WO, własnego wymagania i własnego ADR.
-- Ten plik ma jeden cel: repo przestaje kłamać o tym, co stoi na produkcji.
--
-- Nazewnictwo (ADR-002): wszystkie odtwarzane identyfikatory są po angielsku i w snake_case.
-- Wystąpienia `price_netto` / `set_price_netto` to referencje do ISTNIEJĄCYCH kolumn
-- (dług KK-NAMING-BASELINE, docs/architecture/NAMING.md → docelowo net_price / set_net_price).
-- Migracja odtwórcza NIE MOŻE użyć nazwy docelowej, bo taka kolumna dziś nie istnieje.
-- Przemianowanie kolumn cenowych to osobna migracja RENAME, poza zakresem.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Funkcje pomocnicze, od których zależy definicja widoku
-- ─────────────────────────────────────────────────────────────────────────────
-- Muszą powstać PRZED widokiem: obie są wywołane w drugim ramieniu UNION ALL.
-- Transkrypcja 1:1 z pg_get_functiondef (2026-09-10), łącznie z volatility
-- (IMMUTABLE / STABLE) i językiem (plpgsql).

CREATE OR REPLACE FUNCTION public.get_codes_hash(indoor_json jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    hash TEXT;
BEGIN
    SELECT string_agg(elem->>'code', '-' ORDER BY elem->>'code')
    INTO hash
    FROM jsonb_array_elements(indoor_json) AS elem;

    RETURN hash;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_multi_indoor_price(series_param text, indoor_json jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    total NUMERIC := 0;
    elem JSONB;
    min_price NUMERIC;
BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(indoor_json)
    LOOP
        SELECT MIN(price_netto) INTO min_price
        FROM public.indoor_units
        WHERE series_name = series_param
          AND model_code LIKE '%' || (elem->>'code') || '%';

        total := total + COALESCE(min_price, 0);
    END LOOP;
    RETURN total;
END;
$function$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Widok zmaterializowany available_combinations
-- ─────────────────────────────────────────────────────────────────────────────
-- Transkrypcja 1:1 z pg_get_viewdef (2026-09-10). Kolumny i ich kolejność muszą
-- pozostać zgodne z pg_attribute na produkcji:
--   1 type text | 2 series_name text | 3 brand text | 4 room_count integer
--   5 sizes_hash text | 6 outdoor_unit_id uuid | 7 outdoor_model text
--   8 indoor_model text | 9 outdoor_capacity numeric | 10 total_devices_price numeric
--   11 is_available boolean
-- Kolejność ma znaczenie, bo konsumenci w apps/b2c-web adresują kolumny po nazwie,
-- ale test statyczny porównuje ją pozycyjnie ze stanem bazy.

CREATE MATERIALIZED VIEW IF NOT EXISTS public.available_combinations AS
 SELECT 'SINGLE'::text AS type,
    iu.series_name,
    ou.brand,
    1 AS room_count,
    "substring"(iu.model_code, '[0-9]{2}'::text) AS sizes_hash,
    ou.id AS outdoor_unit_id,
    ou.model_code AS outdoor_model,
    iu.model_code AS indoor_model,
    ou.cooling_capacity_kw AS outdoor_capacity,
        CASE
            WHEN sss.set_price_netto > 0::numeric THEN sss.set_price_netto
            ELSE COALESCE(iu.price_netto, 0::numeric) + COALESCE(ou.price_netto, 0::numeric)
        END AS total_devices_price,
    true AS is_available
   FROM single_split_sets sss
     JOIN indoor_units iu ON iu.id = sss.indoor_unit_id
     JOIN outdoor_units ou ON ou.id = sss.outdoor_unit_id
  WHERE iu.is_single_compatible = true
UNION ALL
 SELECT 'MULTI'::text AS type,
    iu.series_name,
    ou.brand,
    mss.supported_rooms_count AS room_count,
    get_codes_hash(mss.indoor_units_json) AS sizes_hash,
    ou.id AS outdoor_unit_id,
    ou.model_code AS outdoor_model,
    iu.model_code AS indoor_model,
    ou.cooling_capacity_kw AS outdoor_capacity,
        CASE
            WHEN mss.set_price_netto > 0::numeric THEN mss.set_price_netto
            ELSE get_multi_indoor_price(iu.series_name, mss.indoor_units_json) + COALESCE(ou.price_netto, 0::numeric)
        END AS total_devices_price,
    true AS is_available
   FROM multi_split_sets mss
     JOIN outdoor_units ou ON ou.id = mss.outdoor_unit_id
     JOIN indoor_units iu ON iu.brand = ou.brand AND iu.is_multi_compatible = true
  GROUP BY iu.series_name, ou.brand, mss.supported_rooms_count, mss.indoor_units_json, ou.id, ou.model_code, iu.model_code, ou.cooling_capacity_kw, mss.set_price_netto, ou.price_netto;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Indeksy
-- ─────────────────────────────────────────────────────────────────────────────
-- Trzy indeksy btree, dokładnie takie jak na produkcji (pg_indexes, 2026-09-10).
-- ŻADEN nie jest unikalny — to właśnie dlatego REFRESH ... CONCURRENTLY jest dziś
-- niemożliwy (zastrzeżenie A w nagłówku).

CREATE INDEX IF NOT EXISTS idx_available_combinations_hash
  ON public.available_combinations USING btree (sizes_hash);

CREATE INDEX IF NOT EXISTS idx_available_combinations_series
  ON public.available_combinations USING btree (series_name);

CREATE INDEX IF NOT EXISTS idx_available_combinations_rooms
  ON public.available_combinations USING btree (room_count);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Automatyczne odświeżanie — funkcja triggera i cztery triggery
-- ─────────────────────────────────────────────────────────────────────────────
-- To jest odpowiedź na pytanie „czy widok w ogóle jest odświeżany": TAK, przez
-- triggery, które również żyły wyłącznie na produkcji. Transkrypcja 1:1
-- z pg_get_functiondef / pg_get_triggerdef (2026-09-10).
--
-- FOR EACH STATEMENT, nie FOR EACH ROW — jedno przeliczenie na instrukcję, a nie na
-- wiersz. Przy imporcie cennika jednym INSERT ... SELECT to jeden REFRESH; przy imporcie
-- pętlą po wierszach to jeden REFRESH NA WIERSZ. Kto ładuje katalog masowo, powinien
-- rozważyć ALTER TABLE ... DISABLE TRIGGER na czas ładowania i jeden ręczny
-- REFRESH MATERIALIZED VIEW public.available_combinations na końcu.
--
-- DROP TRIGGER IF EXISTS przed CREATE TRIGGER: CREATE TRIGGER nie ma wariantu
-- IF NOT EXISTS, a odtwarzana definicja jest identyczna ze stanem produkcji,
-- więc para DROP+CREATE jest tu bezpieczna i idempotentna.

CREATE OR REPLACE FUNCTION public.refresh_available_combinations()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    REFRESH MATERIALIZED VIEW public.available_combinations;
    RETURN NULL;
END;
$function$;


DROP TRIGGER IF EXISTS refresh_combinations_on_single ON public.single_split_sets;
CREATE TRIGGER refresh_combinations_on_single
  AFTER INSERT OR DELETE OR UPDATE ON public.single_split_sets
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_available_combinations();

DROP TRIGGER IF EXISTS refresh_combinations_on_multi ON public.multi_split_sets;
CREATE TRIGGER refresh_combinations_on_multi
  AFTER INSERT OR DELETE OR UPDATE ON public.multi_split_sets
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_available_combinations();

DROP TRIGGER IF EXISTS refresh_combinations_on_indoor ON public.indoor_units;
CREATE TRIGGER refresh_combinations_on_indoor
  AFTER INSERT OR DELETE OR UPDATE ON public.indoor_units
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_available_combinations();

DROP TRIGGER IF EXISTS refresh_combinations_on_outdoor ON public.outdoor_units;
CREATE TRIGGER refresh_combinations_on_outdoor
  AFTER INSERT OR DELETE OR UPDATE ON public.outdoor_units
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_available_combinations();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Uprawnienia obiektowe (stan docelowy identyczny z produkcją)
-- ─────────────────────────────────────────────────────────────────────────────
-- Powtórzenie bloku z 20260824185845 sekcja 5 — patrz "Kolejność wobec RLS baseline"
-- w nagłówku. REVOKE ALL + GRANT SELECT jest idempotentne (obie komendy opisują stan
-- docelowy, nie deltę), a kolejność jest obowiązkowa: najpierw czyścimy wszystko,
-- potem oddajemy sam odczyt.
-- Stan produkcyjny na 2026-09-10 (pg_class.relacl): anon=r, authenticated=r,
-- service_role=arwdDxtm, właściciel postgres. Ten blok go odtwarza.

REVOKE ALL ON public.available_combinations FROM anon, authenticated;
GRANT SELECT ON public.available_combinations TO anon, authenticated;


-- ═════════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA PO ODTWORZENIU BAZY OD ZERA (uruchom RĘCZNIE — to NIE jest część migracji)
-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Obiekt istnieje i jest widokiem ZMATERIALIZOWANYM (relkind = 'm'), nie zwykłym ('v'):
--    SELECT relkind, relispopulated FROM pg_class WHERE oid = 'public.available_combinations'::regclass;
--
-- 2. Definicja lokalna jest identyczna z produkcyjną (to samo porównanie robi test statyczny):
--    SELECT pg_get_viewdef('public.available_combinations'::regclass, true);
--
-- 3. Cztery triggery odświeżające są aktywne:
--    SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
--     WHERE NOT t.tgisinternal AND t.tgfoid = 'public.refresh_available_combinations'::regproc;
--
-- 4. `anon` ma wyłącznie odczyt:
--    SELECT relacl FROM pg_class WHERE oid = 'public.available_combinations'::regclass;
-- ═════════════════════════════════════════════════════════════════════════════
