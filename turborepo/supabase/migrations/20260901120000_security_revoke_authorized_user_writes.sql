-- TICKET: BATCH-MEDIUM-LOW-CLEANUP (punkt 11) — odebranie praw zapisu na public."AuthorizedUser"
-- WYMAGANIA: SEC-AUTHZ-USER-MGMT, SEC-RLS-BASELINE
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  UWAGA: TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE.                           ║
-- ║  Napisana 2026-09-01, zacommitowana jako plik, świadomie NIEZAAPLIKOWANA.             ║
-- ║  Uruchomienie wymaga OSOBNEJ, JAWNEJ zgody człowieka.                                 ║
-- ║  Dopóki jej nie ma, treść poniżej opisuje stan POSTULOWANY, a nie stan bazy.          ║
-- ║  Nie traktuj obecności tego pliku ani zielonego testu statycznego jako dowodu,        ║
-- ║  że produkcja jest zabezpieczona — test zamraża TREŚĆ pliku, nie stan serwera.        ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- Wzorzec ostrzeżenia przejęty z incydentu tej sesji: migracja
-- 20260824185845_security_enable_rls_baseline.sql również leży w repozytorium
-- nieuruchomiona, a jej obecność została raz odczytana jako „RLS jest włączone".
-- Nie było. Stąd ta ramka na górze każdej migracji bezpieczeństwa czekającej na zgodę.
--
-- POWÓD. `AuthorizedUser` jest tabelą rozstrzygającą ROLĘ w całym panelu B2B: każda bramka
-- `can(role, …)` w Server Actions bierze rolę pośrednio z tego wiersza (middleware →
-- getCurrentActorRole → e-mail z sesji → AuthorizedUser.role). Tabela, która decyduje
-- o uprawnieniach, nie może być zapisywalna przez rolę, którą sama nadaje. Prawo INSERT
-- dla `anon` oznacza, że dowolny anonimowy klient z kluczem publicznym dopisuje sobie
-- wiersz z role = 'admin' i przechodzi KAŻDĄ bramkę w systemie — łącznie z tymi, które
-- ta sesja właśnie domknęła. To eskalacja uprawnień w jednym zapytaniu, bez żadnego exploita.
--
-- DLACZEGO REVOKE, A NIE POLITYKA RLS. RLS działa dopiero PO sprawdzeniu uprawnień
-- tabelarycznych (GRANT). Polityka bez odebrania GRANT-u zostawia drugą drogę i wymaga
-- pamiętania o obu. REVOKE jest tu warstwą niższą i mocniejszą: bez prawa do tabeli
-- żadna polityka nie jest potrzebna do odmowy. RLS na tej tabeli zostaje osobnym krokiem.
--
-- CO ZOSTAJE. SELECT NIE jest odbierany. Odczyt jest potrzebny politykom RLS na innych
-- tabelach i na storage.objects, które sprawdzają rolę podzapytaniem
-- `SELECT 1 FROM public."AuthorizedUser" au WHERE au.email = auth.email() AND au.role = 'admin'`
-- (patrz 20260828120000_kartoteki_storage_policies.sql). Odebranie SELECT wywaliłoby
-- polityki Storage i zablokowało wgrywanie zdjęć kartotek. Zawężenie odczytu do
-- własnego wiersza to osobna zmiana, wymagająca polityki RLS, nie GRANT-u.
--
-- CO Z PANELEM. Panel B2B chodzi po Prismie z DATABASE_URL, czyli rolą właściciela bazy,
-- a nie `anon`/`authenticated`. Ten REVOKE go NIE dotyka — dodawanie użytkowników przez
-- admina w panelu działa dalej. Odbieramy prawa wyłącznie dwóm rolom klienckim
-- supabase-js, do których trafia klucz publiczny wysyłany do przeglądarki.
--
-- TRUNCATE jest w wykazie razem z DELETE, bo to osobne uprawnienie: samo odebranie DELETE
-- zostawiłoby drogę do wyczyszczenia całej tabeli jednym poleceniem.
--
-- NAZEWNICTWO. `public."AuthorizedUser"` jest w PascalCase i wymaga cudzysłowów — model
-- Prisma bez `@@map`. To stan zastany, nie nowa nazwa; ADR-002 nie jest tu łamane.
--
-- IDEMPOTENTNOŚĆ. REVOKE na nieposiadanym uprawnieniu jest w Postgresie no-opem, więc
-- powtórne uruchomienie jest bezpieczne. Osłona `to_regclass` chroni przed wywrotką,
-- gdyby migracja poszła na bazę, w której tej tabeli nie ma.

DO $$
BEGIN
  IF to_regclass('public."AuthorizedUser"') IS NULL THEN
    RAISE NOTICE 'Tabela public."AuthorizedUser" nie istnieje — pomijam REVOKE.';
    RETURN;
  END IF;

  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."AuthorizedUser" FROM anon;
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."AuthorizedUser" FROM authenticated;
END
$$;

-- WERYFIKACJA PO URUCHOMIENIU (do wykonania ręcznie, gdy człowiek wyrazi zgodę):
--
--   SELECT grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name = 'AuthorizedUser'
--      AND grantee IN ('anon', 'authenticated')
--    ORDER BY grantee, privilege_type;
--
-- Oczekiwane: dla obu ról wyłącznie SELECT (albo brak wierszy, jeśli i tego nie było).
-- Jakikolwiek INSERT/UPDATE/DELETE/TRUNCATE w wyniku = migracja nie zadziałała.
--
-- Kontrola pozytywna: panel B2B po zalogowaniu jako admin nadal dodaje użytkownika
-- w widoku ustawień (ścieżka przez Prismę, nieobjęta tym REVOKE).
