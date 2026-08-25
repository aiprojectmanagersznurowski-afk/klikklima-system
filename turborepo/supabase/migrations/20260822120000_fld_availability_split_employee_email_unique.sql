-- WO: FLD-AVAILABILITY-SPLIT (uzupelnienie) — unikalnosc e-maila pracownika terenowego
--
-- POWOD. setSelfAvailabilityAction musi rozstrzygnac, czy `id` przekazane do akcji faktycznie
-- nalezy do wywolujacego. Bez tego audytor A poda w formularzu `id` audytora B i zadeklaruje
-- za niego niedostepnosc — to nie jest usterka kosmetyczna, tylko sedno bezpieczenstwa tej
-- funkcji. Jedyny istniejacy w repo nosnik tozsamosci "czyj to rekord z sesji" to e-mail
-- (tak samo dziala bramka logowania w apps/b2b-web/src/utils/supabase/middleware.ts).
-- Prisma dopuszcza findUnique wylacznie po kolumnie z ograniczeniem unikalnosci, wiec bez
-- tego indeksu zapytanie nie przechodzi ani typowania, ani runtime'u.
--
-- Zmiana ADDYTYWNA i IDEMPOTENTNA: dokladana jest wylacznie GWARANCJA do istniejacej kolumny.
-- Zero DROP, zero RENAME, zero NOT NULL, zadna wartosc nie jest nadpisywana.
--
-- Nazwy tabel audytorzy / zespoly_monterskie sa dlugiem KK-NAMING-BASELINE (zamrozonym) —
-- ALTER musi wskazac nazwe, ktora istnieje. Nowe obiekty nazywane po angielsku, patrz
-- docs/architecture/NAMING.md.


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. DIAGNOSTYKA PRZED URUCHOMIENIEM (uruchom RECZNIE, to nie jest czesc migracji)
-- ─────────────────────────────────────────────────────────────────────────────
-- Stan danych potwierdzony 2026-08-22: audytorzy = 2 wiersze, 0 NULL, 0 duplikatow (takze
-- bez rozroznienia wielkosci liter); zespoly_monterskie = 0 wierszy. Migracja moze jednak
-- zostac uruchomiona pozniej, na innym srodowisku i w innym stanie danych — CREATE UNIQUE
-- INDEX przerwie sie wtedy z bledem i zostawi baze bez indeksu (nic nie zepsuje, ale nic
-- nie zalatwi). Przed wdrozeniem na produkcji:
--
--   SELECT email, count(*) FROM public.audytorzy
--    WHERE email IS NOT NULL GROUP BY email HAVING count(*) > 1;
--
--   SELECT email, count(*) FROM public.zespoly_monterskie
--    WHERE email IS NOT NULL GROUP BY email HAVING count(*) > 1;
--
-- Oba zapytania musza zwrocic zero wierszy. Duplikat rozstrzyga CZLOWIEK (ktory rekord jest
-- prawdziwym pracownikiem), a nie skrypt — automatyczne czyszczenie e-maili odcieloby komus
-- dostep do systemu.
--
-- Wariant ostrozniejszy dla duzej, zywej tabeli: CREATE UNIQUE INDEX CONCURRENTLY (bez
-- blokady zapisu), ale nie moze on dzialac w transakcji, wiec nie nadaje sie do tego pliku.
-- Przy dzisiejszej liczbie wierszy (2 i 0) jest to nieistotne.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Unikalnosc e-maila na obu encjach pracowniczych
-- ─────────────────────────────────────────────────────────────────────────────
-- UNIQUE na kolumnie NULLABLE: PostgreSQL traktuje kazdy NULL jako rozny od pozostalych,
-- wiec wielu pracownikow bez e-maila nadal sie zapisze. Kolumna ZOSTAJE nullable swiadomie:
--   * NOT NULL na istniejacej, zapelnionej kolumnie bez wartosci domyslnej jest zabronione,
--     a e-maila nie da sie sensownie zbackfillowac (nie wymysla sie adresu czlowiekowi);
--   * findUnique wymaga wylacznie unikalnosci, NOT NULL nic tu nie dokłada;
--   * interfejs CRM juz dzis renderuje e-mail warunkowo, wiec zawezenie typu byloby zmiana
--     lamiaca kompatybilnosc i wymagaloby osobnego ADR.
-- Konsekwencja do zapamietania: pracownik bez e-maila nie ma sciezki samoobslugi. To znane
-- ograniczenie, nie luka tego WO.
--
-- Forma: UNIQUE INDEX, nie ADD CONSTRAINT — tak wygladaja wszystkie pozostale ograniczenia
-- unikalnosci w tym repo (00000000000000_baseline.sql, 20260821120000_fld_availability_split.sql).
-- Nazwy zgodne z konwencja Prisma dla @unique (<tabela>_<kolumna>_key), zeby introspekcja
-- nie zobaczyla dryfu.

CREATE UNIQUE INDEX IF NOT EXISTS audytorzy_email_key
  ON public.audytorzy (email);

CREATE UNIQUE INDEX IF NOT EXISTS zespoly_monterskie_email_key
  ON public.zespoly_monterskie (email);

COMMENT ON INDEX public.audytorzy_email_key IS
  'Nosnik tozsamosci "czyj to rekord z sesji" (FLD-AVAILABILITY-SPLIT). Pozwala na findUnique po e-mailu z sesji Supabase Auth. NIE jest to klucz obcy do AuthorizedUser — powiazanie jest wylacznie po wartosci e-maila.';

COMMENT ON INDEX public.zespoly_monterskie_email_key IS
  'Nosnik tozsamosci "czyj to rekord z sesji" (FLD-AVAILABILITY-SPLIT). Symetrycznie do audytorzy_email_key, mimo ze tabela jest dzis pusta.';


-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (recznie, gdyby zaszla potrzeba)
-- ─────────────────────────────────────────────────────────────────────────────
--   DROP INDEX IF EXISTS public.audytorzy_email_key;
--   DROP INDEX IF EXISTS public.zespoly_monterskie_email_key;
-- Usuniecie indeksu nie kasuje zadnych danych, ale rozjezdza schemat z Prisma — trzeba wtedy
-- cofnac takze @unique w packages/database/prisma/schema.prisma i zregenerowac klienta.
