-- TICKET: SEC-RLS-BASELINE — przywrócenie Row Level Security na całym schemacie `public`
--
-- To NIE jest część żadnego Work Ordera. Znalezione podczas REVIEW dla FLD-AVAILABILITY-SPLIT,
-- gdy rls-security-auditor zapytał, czy stan RLS na żywej bazie jest w ogóle znany.
--
-- POWÓD — stan stwierdzony, nie domniemany. Sprawdzony bezpośrednimi zapytaniami na bazie
-- wskazanej przez DATABASE_URL (pg_class.relrowsecurity oraz information_schema.role_table_grants),
-- data ustalenia 2026-08-24:
--
--   * 16 z 18 tabel bazowych ma relrowsecurity = FALSE. RLS jest FIZYCZNIE WYŁĄCZONE,
--     a nie tylko „włączone, ale bez polityk".
--   * Rola `anon` — czyli klucz publiczny, z definicji wyciągalny z bundla przeglądarki —
--     ma na WSZYSTKICH tych tabelach pełne INSERT, SELECT, UPDATE, DELETE, TRUNCATE.
--   * Dwie istniejące polityki („Allow anon insert on klienci", „Allow anon insert on leady")
--     są dziś MARTWE: przy wyłączonym RLS silnik ich nie wykonuje.
--   * `adresy` — środkowy krok jedynego działającego przepływu zakładania leada — nie ma
--     żadnej polityki w ogóle i działa wyłącznie dlatego, że RLS na niej jest wyłączone.
--   * `soft_leady` i `system_config` mają RLS włączone i zero polityk, czyli są już dziś
--     poprawnie zamknięte. Ta migracja ich nie dotyka.
--
-- DLACZEGO TO JEST BEZPIECZNE DO ZROBIENIA TERAZ. Prisma łączy się jako rola `postgres`
-- z rolbypassrls = true (sprawdzone w pg_roles). Włączenie RLS nie wpływa więc na ŻADNĄ
-- ścieżkę opartą na Prisma — a to jest praktycznie cała logika biznesowa obu aplikacji
-- (patrz pułapka 1 w CLAUDE.md: „Prisma omija RLS"). Realnie dotknięte są tylko te nieliczne
-- miejsca, które mówią do Postgresa przez supabase-js. Każde z nich jest niżej wymienione
-- z nazwy pliku — polityka bez wskazanego konsumenta byłaby zgadywanką, nie zabezpieczeniem.
--
-- ZASADA DOMYŚLNA: brak polityki = odmowa. Tak samo jak w 20260821120000 i 20260821130000.
-- Tabela bez konsumenta przez supabase-js dostaje ENABLE i ani jednej polityki. To jest stan
-- pożądany, nie niedokończona robota.
--
-- ZAKRES ŚWIADOMIE POMINIĘTY:
--   * `storage.objects` — RLS włączone, zero polityk; upload awatara ekipy
--     (crews-client.tsx, supabase.storage.from('zespoly')) najprawdopodobniej dziś nie działa.
--     To osobny bug funkcjonalny, nie regresja bezpieczeństwa — poza zakresem tego ticketu.
--   * Czyszczenie nadmiarowych grantów (UPDATE/DELETE/TRUNCATE tam, gdzie potrzebny jest
--     tylko SELECT/INSERT) — RLS wystarcza jako bramka, to utwardzenie „belt and suspenders".
--   * `availability_declarations`, `legal_document_versions`, `employee_consents` — mają
--     ENABLE już z migracji 20260821120000 / 20260821130000. Bez zmian.
--
-- IDEMPOTENTNOŚĆ. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` jest idempotentne z natury.
-- Postgres NIE MA `CREATE POLICY IF NOT EXISTS`, więc każdy CREATE POLICY w tym pliku —
-- także te tworzące politykę, która dziś nie istnieje — jest poprzedzony DROP POLICY IF EXISTS.
-- Dzięki temu ponowne uruchomienie pliku nie przerywa się na „policy already exists".
--
-- KOLEJNOŚĆ MA ZNACZENIE: ENABLE i CREATE POLICY dla tej samej tabeli stoją w jednym bloku,
-- żeby nigdy nie powstało okno, w którym tabela jest już zamknięta, a ścieżka jeszcze nie
-- przywrócona.
--
-- NAZWY TABEL. `klienci`, `leady`, `adresy`, `audytorzy`, `zespoly_monterskie`, `instalacje`,
-- `serwisy`, `cennik_uslug`, `modele_3d`, `usterki_incidents`, `logistyka_zamowienia` to dług
-- KK-NAMING-BASELINE (zamrożony, patrz docs/architecture/NAMING.md). ALTER TABLE musi wskazać
-- nazwę, która ISTNIEJE — nowe obiekty nazywamy po angielsku, do starych trzeba się odwołać
-- tak, jak się nazywają. `"AuthorizedUser"` jest w PascalCase i wymaga cudzysłowów, bo tak
-- została utworzona (model Prisma bez @@map).
--
-- BEZ ZMIAN W schema.prisma: RLS ani GRANT/REVOKE nie są wyrażalne w Prisma. To warstwa
-- czysto SQL-owa, tak samo jak triggery w 20260821130000_fld_consent_docs.sql.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabele bez ŻADNEGO konsumenta przez supabase-js — ENABLE, zero polityk
-- ─────────────────────────────────────────────────────────────────────────────
-- Sprawdzone przeszukaniem apps/b2b-web i apps/b2c-web pod kątem `.from('<tabela>')`:
-- żadna z poniższych tabel nie jest czytana ani zapisywana inaczej niż przez Prisma
-- (rola postgres, rolbypassrls = true). Włączenie RLS bez polityki nie zabiera więc
-- niczego żadnej działającej funkcji, a odbiera roli `anon` pełny dostęp, który ma dziś.

ALTER TABLE public.zespoly_monterskie   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instalacje           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serwisy              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usterki_incidents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modele_3d            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.single_split_sets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multi_split_sets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistyka_zamowienia ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Bramka logowania do panelu B2B — SELECT samoobsługowy dla `authenticated`
-- ─────────────────────────────────────────────────────────────────────────────
-- KONSUMENT: apps/b2b-web/src/utils/supabase/middleware.ts
--   * linia 60: .from('AuthorizedUser').select('email, role').eq('email', user.email).single()
--   * linia 89: .from('audytorzy').select('id').eq('email', user.email).eq('is_active', false)
-- Oba zapytania stoją ZAWSZE za `if (user && ...)`, więc wykonują się jako rola
-- `authenticated` z ważnym JWT — nigdy anonimowo. Polityka odtwarza dokładnie ten warunek:
-- pracownik widzi WYŁĄCZNIE swój własny wiersz, rozstrzygany po adresie e-mail z sesji.
-- `auth.email()` czyta e-mail z tego samego JWT, z którego middleware bierze `user.email`,
-- więc filtr zapytania i warunek polityki mają jedno źródło prawdy i nie mogą się rozjechać.
--
-- UWAGA PRZY WERYFIKACJI: `.single()` w linii 60 zwraca błąd, gdy polityka odetnie wiersz —
-- a middleware traktuje brak wiersza jako „użytkownik nieautoryzowany" i wylogowuje.
-- Błąd w TEJ polityce blokuje wejście do panelu KAŻDEMU. To jest pierwsza rzecz do
-- sprawdzenia po uruchomieniu migracji (patrz weryfikacja funkcjonalna na końcu pliku).
--
-- UWAGA: audytorzy.email jest NULLABLE. Wiersz z NULL nie spełnia `email = auth.email()`
-- i pozostaje niewidoczny — to bez znaczenia dla middleware, które i tak filtruje po e-mailu,
-- ale świadomie odnotowane: pracownik bez e-maila nie ma ścieżki samoobsługi (tak samo jak
-- w FLD-AVAILABILITY-SPLIT).

ALTER TABLE public."AuthorizedUser" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read by email" ON public."AuthorizedUser";
CREATE POLICY "self read by email" ON public."AuthorizedUser"
  FOR SELECT TO authenticated USING (email = auth.email());

ALTER TABLE public.audytorzy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read by email" ON public.audytorzy;
CREATE POLICY "self read by email" ON public.audytorzy
  FOR SELECT TO authenticated USING (email = auth.email());


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Przepływ zakładania leada w B2C — INSERT anonimowy
-- ─────────────────────────────────────────────────────────────────────────────
-- KONSUMENT: apps/b2c-web/app/actions/saveLead.ts
--   * linia 30: .from('klienci').insert(...)
--   * linia 44: .from('adresy').insert(...)
--   * linia 72: .from('leady').insert(...)
-- To jedyny działający przepływ zapisu leada z formularza publicznego. Trzy INSERT-y po
-- kolei — odcięcie któregokolwiek z nich urywa rejestrację klienta w połowie.
--
-- Tylko INSERT, żadnego SELECT/UPDATE/DELETE: formularz publiczny ma prawo DODAĆ zgłoszenie
-- i nie ma żadnego powodu, by mógł czytać cudze albo cokolwiek zmieniać. Dziś rola `anon`
-- może na tych tabelach wszystko, łącznie z TRUNCATE.
--
-- NAZWY „Allow anon insert on klienci" / „Allow anon insert on leady" są zachowane
-- CELOWO — te dwie polityki już istnieją w bazie (choć są martwe przy wyłączonym RLS).
-- Zmiana nazwy zostawiłaby w bazie dwa wpisy robiące to samo. `adresy` nie ma dziś żadnej
-- polityki, więc jej polityka jest nowa — DROP przed nią jest wyłącznie dla idempotentności.
--
-- KONTEKST, KTÓRY WARTO ZNAĆ: apps/b2c-web/lib/supabaseClient.ts wybiera
-- SUPABASE_SERVICE_ROLE_KEY przed NEXT_PUBLIC_SUPABASE_ANON_KEY, jeśli zmienna jest ustawiona.
-- Jeśli produkcja ma ustawiony service_role, cały ruch B2C omija RLS i poniższe polityki
-- są warstwą obronną na przyszłość, a nie tym, co dziś faktycznie przepuszcza ten zapis.
-- Są poprawne i potrzebne w OBU wariantach — klucz `anon` jest publiczny niezależnie od tego,
-- czy aplikacja go akurat używa.

ALTER TABLE public.klienci ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon insert on klienci" ON public.klienci;
CREATE POLICY "Allow anon insert on klienci" ON public.klienci
  FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE public.adresy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon insert on adresy" ON public.adresy;
CREATE POLICY "Allow anon insert on adresy" ON public.adresy
  FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE public.leady ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon insert on leady" ON public.leady;
CREATE POLICY "Allow anon insert on leady" ON public.leady
  FOR INSERT TO anon WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Katalog urządzeń i cennik — SELECT publiczny (celowo)
-- ─────────────────────────────────────────────────────────────────────────────
-- KONSUMENCI (wszystkie w apps/b2c-web/app/actions/):
--   * indoor_units  — getAvailableSizes.ts, getBestsellers.ts, getCatalog.ts, getRecommendation.ts
--   * outdoor_units — jw. oraz getSetForConfig.ts, getLowestPriceForIndoorUnit.ts
--   * cennik_uslug  — getBestsellers.ts, getCatalog.ts, getRecommendation.ts,
--                     getLowestPriceForIndoorUnit.ts
-- To dane, które i tak są pokazywane każdemu odwiedzającemu stronę — publiczny odczyt jest
-- tu decyzją produktową, nie przeoczeniem. Polityka odbiera natomiast roli `anon` prawo
-- ZAPISU do cennika, które ma dziś (INSERT/UPDATE/DELETE/TRUNCATE) i którego nikt nie używa.
--
-- ZAKRES ROLI: `TO anon`, zgodnie z inwentarzem — panel B2B czyta katalog wyłącznie przez
-- Prisma (potwierdzone: jedyne wywołania supabase-js w apps/b2b-web/src to AuthorizedUser
-- i audytorzy w middleware.ts oraz storage.from('zespoly') w crews-client.tsx). Gdyby
-- kiedykolwiek powstał odczyt katalogu przez supabase-js dla zalogowanego użytkownika,
-- rola będzie wtedy `authenticated` i ta polityka go NIE obejmie — wymagane będzie
-- świadome rozszerzenie `TO anon, authenticated`.

ALTER TABLE public.indoor_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public catalog read" ON public.indoor_units;
CREATE POLICY "Public catalog read" ON public.indoor_units
  FOR SELECT TO anon USING (true);

ALTER TABLE public.outdoor_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public catalog read" ON public.outdoor_units;
CREATE POLICY "Public catalog read" ON public.outdoor_units
  FOR SELECT TO anon USING (true);

ALTER TABLE public.cennik_uslug ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public catalog read" ON public.cennik_uslug;
CREATE POLICY "Public catalog read" ON public.cennik_uslug
  FOR SELECT TO anon USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. available_combinations — widok zmaterializowany, RLS NIE ISTNIEJE
-- ─────────────────────────────────────────────────────────────────────────────
-- pg_class.relkind = 'm'. Postgres nie wspiera Row Level Security na widokach
-- zmaterializowanych — ani ALTER TABLE ... ENABLE ROW LEVEL SECURITY, ani CREATE POLICY
-- nie mają tu zastosowania. Jedyną dostępną bramką są uprawnienia obiektowe.
--
-- Rola `anon` ma dziś na tym obiekcie pełen zestaw praw (arwdDxtm). Potrzebny jest wyłącznie
-- odczyt — KONSUMENCI (apps/b2c-web/app/actions/): getSetForConfig.ts, getRecommendation.ts,
-- getLowestPriceForIndoorUnit.ts, getValidConfigurations.ts.
--
-- REVOKE ALL + GRANT SELECT jest idempotentne (obie komendy opisują stan docelowy, nie deltę).
-- Kolejność jest obowiązkowa: najpierw czyścimy wszystko, potem oddajemy sam odczyt.
-- Obiekt nie jest zarządzany przez Prisma (nie ma go w schema.prisma) — to widok
-- utrzymywany po stronie bazy.
--
-- OSŁONA `to_regclass` NIE JEST ZBĘDNA — nie usuwaj jej. Ten widok nie powstaje w ŻADNEJ
-- migracji ani w schema.prisma, więc odtworzenie bazy od zera (`supabase db reset`) przechodzi
-- migracje po kolei i wywaliłoby się tutaj na „relation does not exist", przerywając cały reset.
-- Na żywej bazie, gdzie obiekt istnieje, blok wykonuje dokładnie te same dwie komendy co bez niego.

DO $$
BEGIN
  IF to_regclass('public.available_combinations') IS NOT NULL THEN
    REVOKE ALL ON public.available_combinations FROM anon, authenticated;
    GRANT SELECT ON public.available_combinations TO anon, authenticated;
  END IF;
END $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA PO URUCHOMIENIU (uruchom RĘCZNIE — to NIE jest część migracji)
-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Każda tabela bazowa w `public` ma relrowsecurity = true. Ani jednego `false`.
--
-- SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--  WHERE n.nspname='public' AND relkind='r' ORDER BY 1;
--
-- 2. Lista polityk musi zgadzać się co do sztuki: 8 polityk — 2× "self read by email"
--    (AuthorizedUser, audytorzy), 3× "Allow anon insert on ..." (klienci, adresy, leady),
--    3× "Public catalog read" (indoor_units, outdoor_units, cennik_uslug).
--    Nadmiarowa polityka = duplikat, którego ta migracja nie przewidziała.
--
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname='public' ORDER BY 1;
--
-- 3. available_combinations: `anon` ma wyłącznie SELECT. can_select = t, can_insert = f.
--
-- SELECT has_table_privilege('anon','public.available_combinations','SELECT') as can_select,
--        has_table_privilege('anon','public.available_combinations','INSERT') as can_insert;
--
-- 4. Weryfikacja FUNKCJONALNA — zapytania wyżej pokazują konfigurację, nie działanie.
--    Kolejność od najbardziej dotkliwego w razie błędu:
--      a) logowanie do panelu B2B (błąd polityki z sekcji 2 blokuje wejście KAŻDEMU),
--      b) pełny przepływ B2C Triage → saveLead (musi utworzyć klienci + adresy + leady),
--      c) strona katalogu B2C (musi renderować urządzenia i ceny),
--      d) bash scripts/verify.sh --full (potwierdzenie zera regresji po stronie Prisma).
