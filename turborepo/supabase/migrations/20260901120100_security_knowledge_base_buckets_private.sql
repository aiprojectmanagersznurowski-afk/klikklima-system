-- TICKET: BATCH-MEDIUM-LOW-CLEANUP (punkt 10) — zamknięcie bucketów `bazawiedzy` i `urzadzenia`
-- WYMAGANIA: SEC-RLS-BASELINE
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  UWAGA: TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE.                           ║
-- ║  Napisana 2026-09-01, zacommitowana jako plik, świadomie NIEZAAPLIKOWANA.             ║
-- ║  Uruchomienie wymaga OSOBNEJ, JAWNEJ zgody człowieka.                                 ║
-- ║  Test statyczny zamraża TREŚĆ tego pliku, a nie stan serwera — zielony test           ║
-- ║  NIE dowodzi, że buckety na produkcji są prywatne.                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  WARUNEK KONIECZNY PRZED URUCHOMIENIEM — TRZY PODPISANE URL-e W B2C                   ║
-- ║                                                                                        ║
-- ║  apps/b2c-web/lib/articles.ts zawiera TRZY długoterminowe podpisane URL-e do bucketu  ║
-- ║  `bazawiedzy` (wpisane na sztywno w kod, ważne do 2036 r.):                            ║
-- ║      bazawiedzy/ogrzewanie.png   (articles.ts:16)                                      ║
-- ║      bazawiedzy/serwis.png       (articles.ts:40)                                      ║
-- ║      bazawiedzy/fuji.jpg         (articles.ts:72)                                      ║
-- ║                                                                                        ║
-- ║  `bazawiedzy` NIE jest konsumowany jako bucket publiczny — B2C czyta go przez te       ║
-- ║  podpisane URL-e. Podpis (`/object/sign/…?token=`) jest weryfikowany niezależnie od    ║
-- ║  flagi `public` i od RLS, więc TEORETYCZNIE przełączenie na `public = false` ich nie   ║
-- ║  zepsuje. TEORETYCZNIE — i dlatego to trzeba SPRAWDZIĆ, a nie założyć.                 ║
-- ║                                                                                        ║
-- ║  BEZPOŚREDNIO PO uruchomieniu migracji wykonaj (oczekiwane: trzy razy HTTP 200):       ║
-- ║      curl -s -o /dev/null -w '%{http_code}\n' '<pełny URL z articles.ts:16>'           ║
-- ║      curl -s -o /dev/null -w '%{http_code}\n' '<pełny URL z articles.ts:40>'           ║
-- ║      curl -s -o /dev/null -w '%{http_code}\n' '<pełny URL z articles.ts:72>'           ║
-- ║                                                                                        ║
-- ║  Jakikolwiek 400/403/404 = strona Bazy Wiedzy w B2C traci obrazki dla anonimowych      ║
-- ║  odwiedzających. Wtedy NATYCHMIAST cofnij (sekcja ROLLBACK na dole) i zgłoś —          ║
-- ║  nie „napraw przy okazji" przez powrót do public = true.                               ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- POWÓD. Bucket z `public = true` jest czytelny dla KAŻDEGO, kto zna albo zgadnie ścieżkę
-- obiektu, bez tokenu i bez sesji — a przy publicznym buckecie działa też listowanie
-- zawartości. Oznacza to, że cały materiał w `bazawiedzy` i `urzadzenia` jest dziś
-- dostępny w internecie, w tym pliki, których nikt świadomie nie publikował (robocze
-- wersje, materiały dostawców, cokolwiek wgrano „na chwilę"). Flaga `public` to nie jest
-- ustawienie wygody — to wyłącznik kontroli dostępu dla całego bucketu.
--
-- DLACZEGO POLITYKA SELECT DLA `authenticated`. Po zamknięciu bucketu panel B2B i przyszły
-- Field App muszą dalej czytać te materiały jako zalogowani pracownicy. Bez tej polityki
-- storage.objects odmawia wszystkim poza service_role (zasada „brak polityki = odmowa",
-- storage.objects ma RLS włączone i domyślnie zero polityk — patrz
-- 20260828120000_kartoteki_storage_policies.sql). Polityka jest READ-ONLY i świadomie
-- NIE zawęża się do roli: baza wiedzy i katalog urządzeń to materiał referencyjny dla
-- każdego pracownika, a nie dane osobowe klienta.
--
-- ANONIM NIE DOSTAJE NIC. Rola `anon` NIE dostaje polityki SELECT. Dostęp B2C zostaje
-- wyłącznie przez podpisane URL-e — czyli przez wskazane, policzalne trzy pliki,
-- zamiast przez cały bucket. O to w tej zmianie chodzi.
--
-- ZAKRES ŚWIADOMIE POMINIĘTY:
--   * INSERT/UPDATE/DELETE na tych bucketach — zostają wyłącznie dla service_role, tak jak
--     dziś. Wgrywanie materiałów odbywa się przez panel Supabase albo backend, nie z przeglądarki.
--   * Rotacja trzech podpisanych URL-i z articles.ts na generowane w locie — to osobny dług
--     (token w repozytorium, ważny do 2036 r., nieodwoływalny inaczej niż zmianą klucza).
--     Wymaga własnego ID i nie należy do tej migracji.
--   * Pozostałe buckety — zmiana dotyczy WYŁĄCZNIE dwóch nazwanych.
--
-- NAZEWNICTWO. `bazawiedzy` i `urzadzenia` to istniejące WARTOŚCI DANYCH w storage.buckets,
-- na które wskazuje działający kod, a nie identyfikatory schematu — ADR-002 ich nie obejmuje,
-- tak samo jak `audytorzy`/`zespoly` w migracji 20260828120000. Zmiana nazwy zepsułaby B2C.
--
-- IDEMPOTENTNOŚĆ. UPDATE po nazwie bucketu jest bezpiecznie powtarzalny; każdy CREATE POLICY
-- poprzedza DROP POLICY IF EXISTS (Postgres nie ma CREATE POLICY IF NOT EXISTS). Migracja
-- nie zakłada istnienia bucketów — jeśli ich nie ma, UPDATE po prostu nie ruszy żadnego wiersza.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Zdjęcie flagi `public` z obu bucketów
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE storage.buckets
   SET public = false
 WHERE name IN ('bazawiedzy', 'urzadzenia');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Odczyt materiałów referencyjnych — SELECT dla `authenticated`
-- ─────────────────────────────────────────────────────────────────────────────
-- KONSUMENCI: panel B2B (widoki bazy wiedzy i katalogu urządzeń) oraz przyszły Field App.
-- Świadomie bez warunku na rolę: to materiał referencyjny dla każdego pracownika.
-- `anon` celowo pominięty — B2C korzysta z podpisanych URL-i, patrz ramka na górze.

DROP POLICY IF EXISTS "authenticated read reference buckets" ON storage.objects;
CREATE POLICY "authenticated read reference buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('bazawiedzy', 'urzadzenia'));


-- WERYFIKACJA PO URUCHOMIENIU (ręcznie, po zgodzie człowieka):
--
--   SELECT name, public FROM storage.buckets WHERE name IN ('bazawiedzy', 'urzadzenia');
--     Oczekiwane: public = false dla obu.
--
--   Anonimowy odczyt bez tokenu MUSI odmówić:
--     curl -s -o /dev/null -w '%{http_code}\n' \
--       'https://<projekt>.supabase.co/storage/v1/object/public/bazawiedzy/ogrzewanie.png'
--     Oczekiwane: 400 albo 404, NIE 200.
--
--   Trzy podpisane URL-e z articles.ts: 200. Patrz ramka na górze pliku.
--
-- ROLLBACK (tylko jeśli weryfikacja podpisanych URL-i zawiedzie):
--   UPDATE storage.buckets SET public = true WHERE name IN ('bazawiedzy', 'urzadzenia');
--   DROP POLICY IF EXISTS "authenticated read reference buckets" ON storage.objects;
