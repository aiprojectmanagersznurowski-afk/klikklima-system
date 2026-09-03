-- ============================================================================
-- SEC-EMAIL-UNIQUE — przywrócenie ograniczenia UNIQUE na e-mailu pracownika
-- WYMAGANIA: SEC-EMAIL-UNIQUE (powiązane: SEC-AUTHZ-B2B-READS kryt. 8,
--            SEC-RLS-AUDITOR-SCOPE, FLD-AVAILABILITY-SPLIT)
-- Źródło decyzji: docs/workorders/SEC-EMAIL-UNIQUE.md, decyzje D1, D2, D3
--                 oraz kryteria akceptacji AC-C1 … AC-C6
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  STATUS: TA MIGRACJA ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE 2026-09-03 i ZWERYFIKOWANA.   ║
-- ║  Napisana 2026-09-03, uruchomiona tego samego dnia po jawnej zgodzie człowieka        ║
-- ║  (Faza C2 z Work Ordera). Oba indeksy ISTNIEJĄ.                                       ║
-- ║                                                                                       ║
-- ║  DOWÓD (nie „plik jest w repo" i nie „test statyczny jest zielony" — odczyt z bazy):  ║
-- ║   1. pg_indexes, schemaname='public', 2026-09-03:                                     ║
-- ║        audytorzy_email_key          CREATE UNIQUE INDEX … audytorzy USING btree (email)        ║
-- ║        zespoly_monterskie_email_key CREATE UNIQUE INDEX … zespoly_monterskie USING btree (email) ║
-- ║   2. Próba wstawienia duplikatu e-maila jest realnie odrzucana przez bazę:            ║
-- ║        SQLSTATE 23505, unique_violation. Test wykonany i posprzątany — zero           ║
-- ║        pozostałości w danych.                                                         ║
-- ║   3. prisma migrate diff (schema.prisma ↔ żywa baza) nie zgłasza już RÓŻNICY na       ║
-- ║        kolumnie email w żadnej z tych dwóch tabel. Dryf opisany niżej JEST ZAMKNIĘTY. ║
-- ║                                                                                       ║
-- ║  Uwaga na przyszłość, w obie strony: ewidencja migracji w tym projekcie pozostaje     ║
-- ║  niewiarygodna (2 wpisy w supabase_migrations.schema_migrations przy 15 plikach),     ║
-- ║  więc jedynym źródłem prawdy o schemacie są nadal pg_indexes / pg_constraint.         ║
-- ║  Ten nagłówek jest zapisem odczytu z 2026-09-03, nie gwarancją na zawsze.             ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- POWÓD ISTNIENIA (stan sprzed uruchomienia, zachowany jako uzasadnienie — NIE jest to opis
-- stanu dzisiejszego). packages/database/prisma/schema.prisma deklaruje `email String? @unique`
-- dla modeli Audytorzy i ZespolyMonterskie, a ŻYWA BAZA tego ograniczenia NIE MIAŁA:
-- pg_indexes i pg_constraint dla obu tabel zwracały wyłącznie klucz główny (zweryfikowane
-- bezpośrednim zapytaniem 2026-09-03, przed uruchomieniem tego pliku). Dryf był
-- JEDNOKIERUNKOWY — schemat wyprzedzał bazę — więc naprawa była wyłącznie migracyjna
-- i schema.prisma NIE jest tą zmianą dotykany.
-- Odrzucony jawnie wariant „zaktualizować schemat do rzeczywistości" (usunięcie @unique):
-- zalegalizowałby podatność zamiast ją zamknąć.
--
-- CZEGO TA MIGRACJA NIE ZAŁATWIA. Wektor eskalacji uprawnień (sześć wywołań findUnique po
-- e-mailu, przez które audytor A mógł trafić w wiersz audytora B) jest już zamknięty
-- w KODZIE przez Fazę A tego WO — findMany({ take: 2 }) plus odmowa przy matches.length !== 1.
-- Ta migracja podnosi gwarancję z „kod sprawdza" do „baza nie pozwala". Bramka w kodzie
-- ZOSTAJE i po uruchomieniu tego pliku: przeżywa rollback indeksu (sekcja ROLLBACK to dwa
-- DROP INDEX). Plik jest już uruchomiony, więc ochrona jest dziś dwuwarstwowa — to NIE jest
-- powód, by warstwę kodową usunąć.
--
-- STAN DANYCH w chwili pisania, czyli tuż przed uruchomieniem (2026-09-03, żywa baza).
-- To dzięki tym liczbom blok strażniczy z sekcji 1 przeszedł bez wyjątku:
--   audytorzy          — 3 wiersze, 3 e-maile niepuste, 0 NULL, 0 pustych stringów,
--                        0 duplikatów, 0 duplikatów po lower(email)
--   zespoly_monterskie — 2 wiersze, 2 e-maile niepuste, 0 NULL, 0 pustych stringów,
--                        0 duplikatów, 0 duplikatów po lower(email)
-- Adres ai.projectmanager.sznurowski@gmail.com występuje w OBU tabelach. To NIE jest
-- duplikat w rozumieniu UNIQUE (ograniczenie działa per tabela) i nie blokuje migracji.
--
-- Zmiana ADDYTYWNA i IDEMPOTENTNA: dokładana jest wyłącznie GWARANCJA do istniejącej,
-- wypełnionej kolumny. Zero DROP, zero RENAME, zero NOT NULL, zero backfillu, żadna
-- wartość nie jest nadpisywana.
--
-- Nazewnictwo (ADR-002): nazwy `audytorzy` i `zespoly_monterskie` to ZAMROŻONY dług
-- KK-NAMING-BASELINE (docs/architecture/NAMING.md), a nie nowe polskie nazwy — CREATE INDEX
-- musi wskazać obiekt, który istnieje. Nazwy indeksów `<tabela>_<kolumna>_key` są konwencją
-- Prisma dla @unique, dzięki czemu introspekcja po uruchomieniu nie zobaczy dryfu.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Stosunek do migracji 20260822120000_fld_availability_split_employee_email_unique.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Tamten plik zawiera DOKŁADNIE te same dwa CREATE UNIQUE INDEX i jest merytorycznie
-- poprawny. Nigdy nie został uruchomiony — dowodem był brak indeksów w pg_indexes
-- stwierdzony 2026-09-03, ZANIM uruchomiono ten plik. Uwaga dla czytającego dziś:
-- indeksy już istnieją, ale postawił je TEN plik, nie tamten.
--
-- Ten plik go NIE poprawia i NIE zastępuje przez edycję w miejscu, tylko powtarza jego
-- intencję jako nowe, idempotentne zdarzenie w historii. Powód: ewidencja migracji w tym
-- repozytorium jest niewiarygodna, więc nie da się WYKLUCZYĆ, że plik z sierpnia figuruje
-- gdzieś (na innym środowisku) jako wykonany. Edycja ciała pliku, który mógł zostać
-- zaewidencjonowany, to dokładnie ten rodzaj cichej rozbieżności, który wyprodukował
-- obecny dryf. Ciało tamtego pliku pozostaje NIETKNIĘTE — dopisany został wyłącznie
-- komentarz nagłówkowy odsyłający tutaj.
--
-- Skutek uruchomienia obu plików po kolei, w dowolnej kolejności: jeden indeks na tabelę.
-- IF NOT EXISTS czyni drugi przebieg operacją pustą (AC-C2).


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BLOK STRAŻNICZY — sprawdza OBIE tabele PRZED pierwszym CREATE (AC-C1)
-- ─────────────────────────────────────────────────────────────────────────────
-- Powód nie jest kosmetyczny. Komunikat PostgreSQL o duplikacie jest sam w sobie zrozumiały,
-- ale ten plik zawiera DWA CREATE UNIQUE INDEX. Bez gwarancji transakcji (a runner migracji
-- w tym repo takiej gwarancji nie daje) duplikat w zespoly_monterskie przerwałby migrację
-- PO utworzeniu indeksu na audytorzy — zostawiając bazę w stanie połowicznym, a operatora
-- z pytaniem „co się właściwie udało". Sprawdzenie obu tabel przed pierwszym CREATE zamienia
-- to w jedno rozstrzygnięcie „wszystko albo nic" na poziomie intencji.
--
-- Sprawdzamy duplikaty DOKŁADNE (GROUP BY email HAVING count(*) > 1) — tylko takie łamią
-- projektowane ograniczenie. Duplikaty różniące się wielkością liter NIE powodują awarii
-- CREATE UNIQUE INDEX i dlatego świadomie NIE blokują migracji; są osobnym problemem,
-- zamkniętym w warstwie zapisu (decyzja D3: .toLowerCase() w schematach Zod audytorów i ekip).
--
-- Migracja NIE czyści niczego automatycznie. Rozstrzygnięcie, który z dwóch wierszy jest
-- prawdziwym pracownikiem, należy do CZŁOWIEKA — skasowanie e-maila odcina komuś dostęp
-- do systemu. Dlatego jedyną reakcją na duplikat jest RAISE EXCEPTION z nazwą tabeli
-- i gotowym zapytaniem diagnostycznym.
--
-- Osłona to_regclass: obie tabele istnieją na produkcji, ale ewidencja migracji jest
-- niewiarygodna, więc plik ma przejść bez wywrotki także na środowisku, gdzie któraś
-- z tabel jeszcze nie powstała (wzorzec z 20260901120000_security_revoke_authorized_user_writes.sql).

DO $$
DECLARE
  dup_count integer;
BEGIN
  IF to_regclass('public.audytorzy') IS NULL THEN
    RAISE NOTICE 'SEC-EMAIL-UNIQUE: tabela public.audytorzy nie istnieje — pomijam sprawdzenie duplikatów.';
  ELSE
    SELECT count(*) INTO dup_count
      FROM (
        SELECT email
          FROM public.audytorzy
         WHERE email IS NOT NULL
         GROUP BY email
        HAVING count(*) > 1
      ) AS d;

    IF dup_count > 0 THEN
      RAISE EXCEPTION
        'SEC-EMAIL-UNIQUE: tabela public.audytorzy zawiera % zduplikowanych adresow e-mail. Zaden indeks NIE zostal utworzony, baza jest nietknieta. Diagnostyka: SELECT email, count(*) FROM public.audytorzy WHERE email IS NOT NULL GROUP BY email HAVING count(*) > 1; Rozstrzygniecie, ktory wiersz jest prawdziwym pracownikiem, nalezy do czlowieka — migracja nie czysci danych, bo skasowanie e-maila odcina komus dostep do systemu.',
        dup_count;
    END IF;
  END IF;

  IF to_regclass('public.zespoly_monterskie') IS NULL THEN
    RAISE NOTICE 'SEC-EMAIL-UNIQUE: tabela public.zespoly_monterskie nie istnieje — pomijam sprawdzenie duplikatów.';
  ELSE
    SELECT count(*) INTO dup_count
      FROM (
        SELECT email
          FROM public.zespoly_monterskie
         WHERE email IS NOT NULL
         GROUP BY email
        HAVING count(*) > 1
      ) AS d;

    IF dup_count > 0 THEN
      RAISE EXCEPTION
        'SEC-EMAIL-UNIQUE: tabela public.zespoly_monterskie zawiera % zduplikowanych adresow e-mail. Zaden indeks NIE zostal utworzony, baza jest nietknieta. Diagnostyka: SELECT email, count(*) FROM public.zespoly_monterskie WHERE email IS NOT NULL GROUP BY email HAVING count(*) > 1; Rozstrzygniecie, ktory wiersz jest prawdziwym pracownikiem, nalezy do czlowieka — migracja nie czysci danych, bo skasowanie e-maila odcina komus dostep do systemu.',
        dup_count;
    END IF;
  END IF;
END
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Ograniczenie unikalności na obu encjach pracowniczych (AC-C3, AC-C4)
-- ─────────────────────────────────────────────────────────────────────────────
-- BEZ CONCURRENTLY — świadomie, spójnie z decyzją zapisaną w
-- 20260902170500_perf_foreign_key_indexes.sql: CREATE INDEX CONCURRENTLY nie może działać
-- wewnątrz bloku transakcyjnego, a mechanizm uruchamiania migracji w tym repozytorium nie
-- daje gwarancji, że plik nie zostanie owinięty w transakcję. Przy 3 i 2 wierszach blokada
-- ACCESS EXCLUSIVE trwa milisekundy.
-- WARUNEK UNIEWAŻNIENIA TEJ DECYZJI: gdyby którakolwiek z tabel urosła do rozmiarów
-- produkcyjnych (rzędu dziesiątek tysięcy wierszy), tego pliku NIE wolno uruchomić w tej
-- postaci — należy go najpierw rozbić na osobne polecenia CREATE UNIQUE INDEX CONCURRENTLY
-- wykonywane poza transakcją, każde z osobnym sprawdzeniem stanu po niepowodzeniu
-- (nieudany CONCURRENTLY zostawia indeks INVALID, który trzeba ręcznie usunąć).
--
-- UNIQUE na kolumnie NULLABLE: PostgreSQL traktuje każdy NULL jako różny od pozostałych,
-- więc wielu pracowników bez e-maila nadal się zapisze (AC-C4, druga połowa). Kolumna
-- ZOSTAJE nullable świadomie — NOT NULL na istniejącej, wypełnionej kolumnie bez wartości
-- domyślnej jest zabronione, a adresu e-mail nie da się sensownie zbackfillować.
-- Znana i zaakceptowana konsekwencja: pracownik bez e-maila nie ma ścieżki samoobsługi.
--
-- Forma UNIQUE INDEX, nie ADD CONSTRAINT — tak wyglądają wszystkie pozostałe ograniczenia
-- unikalności w tym repozytorium (00000000000000_baseline.sql, 20260821120000_fld_availability_split.sql).
--
-- Ograniczenie na SUROWEJ kolumnie, nie na lower(email) (decyzja D3): Prisma nie potrafi
-- wyrazić funkcyjnego indeksu unikalnego jako @unique, więc UNIQUE(lower(email)) rozjechałby
-- schema.prisma z bazą W DRUGĄ STRONĘ — wyprodukowalibyśmy nowy dryf, lecząc stary.
-- Wielkość liter domknięta jest w warstwie zapisu (Zod), nie tutaj.

CREATE UNIQUE INDEX IF NOT EXISTS audytorzy_email_key
  ON public.audytorzy (email);

CREATE UNIQUE INDEX IF NOT EXISTS zespoly_monterskie_email_key
  ON public.zespoly_monterskie (email);

COMMENT ON INDEX public.audytorzy_email_key IS
  'SEC-EMAIL-UNIQUE. Nosnik tozsamosci "czyj to rekord z sesji" — pozwala rozstrzygnac, ktory wiersz nalezy do zalogowanego audytora. NIE jest to klucz obcy do AuthorizedUser: powiazanie jest wylacznie po wartosci e-maila, a o roli decyduje AuthorizedUser (SEC-AUTHZ-B2B-READS kryt. 10).';

COMMENT ON INDEX public.zespoly_monterskie_email_key IS
  'SEC-EMAIL-UNIQUE. Symetrycznie do audytorzy_email_key. Ten sam adres moze wystepowac w audytorzy i w zespoly_monterskie — UNIQUE dziala per tabela i ta konfiguracja jest legalna (AC-B7).';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. WERYFIKACJA PO URUCHOMIENIU — WYKONANA 2026-09-03, WYNIK POZYTYWNY
-- ─────────────────────────────────────────────────────────────────────────────
-- Zielony przebieg pliku nie jest dowodem — dowodem jest odczyt z katalogu systemowego.
-- Poniższe zapytanie zostało uruchomione i zwróciło oba oczekiwane wiersze:
--
--   SELECT tablename, indexname, indexdef
--     FROM pg_indexes
--    WHERE schemaname = 'public'
--      AND tablename IN ('audytorzy', 'zespoly_monterskie')
--    ORDER BY tablename, indexname;
--
-- Oczekiwane: po jednym wierszu audytorzy_email_key i zespoly_monterskie_email_key,
-- oba z UNIQUE INDEX na (email). OTRZYMANE 2026-09-03: dokładnie to.
--
-- Dodatkowo wykonano próbę zapisu duplikatu (test zachowania, nie samego katalogu):
-- baza odrzuciła INSERT błędem 23505 unique_violation. Ograniczenie DZIAŁA, nie tylko
-- istnieje. Dane testowe usunięte, zero pozostałości.
--
-- Ramka „NIE ZOSTAŁA URUCHOMIONA" została z góry tego pliku USUNIĘTA i zastąpiona
-- potwierdzeniem — nieaktualny komentarz czyta się jako dowód, a w tym projekcie
-- pomylił już czytelnika w obie strony.


-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (ręcznie, gdyby zaszła potrzeba)
-- ─────────────────────────────────────────────────────────────────────────────
--   DROP INDEX IF EXISTS public.audytorzy_email_key;
--   DROP INDEX IF EXISTS public.zespoly_monterskie_email_key;
--
-- Usunięcie indeksu nie kasuje żadnych danych, ale przywraca dryf względem schema.prisma
-- (który deklaruje @unique) i cofa system do stanu, w którym jedyną ochroną jest bramka
-- tożsamości w kodzie z Fazy A. Nie usuwaj przy tej okazji bramki z kodu — to ona ma
-- przeżyć rollback indeksu (decyzja D4 punkt 2).
