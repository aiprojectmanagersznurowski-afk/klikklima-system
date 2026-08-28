-- TICKET: CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN (część A) — polityki Storage dla zdjęć kartotek
-- WYMAGANIA: CRM-AUDYT-KARTOTEKA, CRM-ZESP-KARTOTEKA
--
-- POWÓD — stan stwierdzony, nie domniemany. Sprawdzony bezpośrednimi zapytaniami na bazie
-- wskazanej przez DATABASE_URL, data ustalenia 2026-08-28:
--
--   * SELECT * FROM storage.buckets → buckety `audytorzy` ORAZ `zespoly` ISTNIEJĄ. To domyka
--     R-A1 z Work Ordera („bucket audytorzy niepotwierdzony"): jest, nie trzeba go zakładać.
--   * storage.objects ma RLS WŁĄCZONE i ZERO polityk. Zasada domyślna „brak polityki = odmowa"
--     oznacza, że dziś upload z przeglądarki nie działa dla NIKOGO poza service_role.
--     Dotyczy to również wzorca uchodzącego w repozytorium za działający —
--     crews-client.tsx, supabase.storage.from('zespoly').upload(...). To domyka R-A2.
--   * Odczyt zdjęć działa i będzie działał niezależnie od tych polityk, bo signStoragePaths
--     (src/lib/storage/signed-urls.ts) idzie przez createAdminClient (service role) i omija RLS.
--     Ta migracja NIE dodaje polityki SELECT — nie ma dziś konsumenta, który by jej potrzebował,
--     a polityka bez wskazanego konsumenta jest zgadywanką, nie zabezpieczeniem.
--
-- Migracja 20260824185845_security_enable_rls_baseline.sql wymieniła storage.objects w sekcji
-- „ZAKRES ŚWIADOMIE POMINIĘTY" jako osobny bug funkcjonalny. To jest ta osobna poprawka.
--
-- DLACZEGO ADMIN-ONLY. Macierz uprawnień (contracts/rbac.contract.mjs) daje
-- auditors.create/update i crews.create/update WYŁĄCZNIE roli `admin` — dyspozytor ma sam
-- odczyt. Zdjęcie jest polem tej samej kartoteki, więc prawo jego podmiany nie może być
-- szersze niż prawo edycji rekordu; inaczej bramka Server Action broniłaby 11 pól, a dwunaste
-- (zdjecie_url) dałoby się podmienić obok niej, wprost przez Storage. Rola jest rozstrzygana
-- po adresie e-mail z JWT — dokładnie tym samym mechanizmem co polityki „self read by email"
-- z migracji 20260824185845, żeby oba miejsca miały jedno źródło prawdy.
--
-- ZAKRES ŚWIADOMIE POMINIĘTY:
--   * SAMOOBSŁUGA PRACOWNIKA. Człowiek zadeklarował 2026-08-28, że w fazie Field App audytor
--     i monter będą wgrywać WŁASNE zdjęcie do TEGO SAMEGO bucketu. To jest kontekst na
--     przyszłość, a NIE ta migracja: taka polityka musi rozstrzygać „czyj to plik", czyli
--     wiązać nazwę obiektu z identyfikatorem pracownika (dziś nazwa to `${id}-${Date.now()}`
--     dla ekipy, a dla audytora nie istnieje żadna konwencja), i wymaga własnego wymagania,
--     własnego ID oraz decyzji o konwencji ścieżki. Rozszerzanie tej polityki „przy okazji"
--     dałoby każdemu zalogowanemu pracownikowi prawo nadpisania zdjęcia dowolnego kolegi.
--   * DELETE na storage.objects — kasowanie osieroconych obiektów po podmianie zdjęcia jest
--     świadomym długiem (retencja + RODO, osobne zgłoszenie). Bez polityki DELETE nikt poza
--     service_role nic nie skasuje, i tak ma zostać.
--   * Pozostałe buckety — polityka jest ściśle zawężona do dwóch nazwanych bucketów.
--     Bucket bez wymienionej nazwy pozostaje zamknięty, tak jak dziś.
--
-- DLACZEGO INSERT *I* UPDATE. supabase-js `.upload()` wykonuje INSERT; `.upload(..., { upsert:
-- true })` oraz `.update()` wykonują UPDATE na istniejącym wierszu storage.objects. Sama
-- polityka INSERT wystarczyłaby dla dzisiejszej konwencji nazw z Date.now() (nowy obiekt przy
-- każdym uploadzie), ale podmiana zdjęcia pod tą samą nazwą urwałaby się bez ostrzeżenia.
-- Polityka UPDATE ma USING i WITH CHECK z identycznym warunkiem — bez WITH CHECK dałoby się
-- przenieść obiekt Z tych bucketów do dowolnego innego jednym UPDATE bucket_id.
--
-- IDEMPOTENTNOŚĆ. Postgres nie ma CREATE POLICY IF NOT EXISTS, więc każdy CREATE jest
-- poprzedzony DROP POLICY IF EXISTS — tak samo jak w 20260824185845.
--
-- BEZ ZMIAN W schema.prisma: storage.objects nie jest zarządzane przez Prisma, a RLS nie jest
-- w Prisma wyrażalne. Warstwa czysto SQL-owa.
--
-- NAZWY. Nazwy bucketów `audytorzy` i `zespoly` są polskie i NIE podlegają ADR-002: to nie są
-- identyfikatory schematu, tylko istniejące wartości danych w storage.buckets, na które wprost
-- wskazuje działający kod odczytu (leads/[id]/page.tsx → signStoragePaths("audytorzy", …),
-- crews/page.tsx → signStoragePaths("zespoly", …)). Zmiana nazwy zepsułaby stronę leada.
-- `public."AuthorizedUser"` jest w PascalCase i wymaga cudzysłowów (model Prisma bez @@map).


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Wgranie zdjęcia kartoteki — INSERT dla `authenticated` o roli `admin`
-- ─────────────────────────────────────────────────────────────────────────────
-- KONSUMENCI (dzisiejszy i planowany):
--   * apps/b2b-web/src/app/(dashboard)/crews/crews-client.tsx — storage.from('zespoly').upload()
--   * modal kartoteki audytora (D-A2) — storage.from('audytorzy').upload()
-- Oba wykonują się w przeglądarce zalogowanego użytkownika panelu, czyli jako rola
-- `authenticated` z ważnym JWT. auth.email() czyta e-mail z tego samego JWT, z którego
-- middleware bierze user.email przy rozstrzyganiu roli.

DROP POLICY IF EXISTS "admin insert kartoteki photos" ON storage.objects;
CREATE POLICY "admin insert kartoteki photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('audytorzy', 'zespoly')
    AND EXISTS (
      SELECT 1 FROM public."AuthorizedUser" au
      WHERE au.email = auth.email() AND au.role = 'admin'
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Podmiana zdjęcia kartoteki — UPDATE dla `authenticated` o roli `admin`
-- ─────────────────────────────────────────────────────────────────────────────
-- USING rozstrzyga, który WIERSZ wolno zmienić; WITH CHECK rozstrzyga, jak może wyglądać
-- po zmianie. Oba warunki są identyczne celowo: admin nie może wyprowadzić obiektu poza
-- te dwa buckety ani wprowadzić do nich obiektu z bucketu, do którego nie ma praw.

DROP POLICY IF EXISTS "admin update kartoteki photos" ON storage.objects;
CREATE POLICY "admin update kartoteki photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('audytorzy', 'zespoly')
    AND EXISTS (
      SELECT 1 FROM public."AuthorizedUser" au
      WHERE au.email = auth.email() AND au.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id IN ('audytorzy', 'zespoly')
    AND EXISTS (
      SELECT 1 FROM public."AuthorizedUser" au
      WHERE au.email = auth.email() AND au.role = 'admin'
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA PO URUCHOMIENIU (uruchom RĘCZNIE — to NIE jest część migracji)
-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Dokładnie dwie polityki na storage.objects, obie na `authenticated`:
--
-- SELECT policyname, cmd, roles FROM pg_policies
--  WHERE schemaname='storage' AND tablename='objects' ORDER BY 1;
--
-- 2. Buckety nadal istnieją i nie są publiczne:
--
-- SELECT id, name, public FROM storage.buckets WHERE id IN ('audytorzy','zespoly');
--
-- 3. Weryfikacja FUNKCJONALNA — zapytania wyżej pokazują konfigurację, nie działanie:
--      a) zalogowany jako admin: wgranie zdjęcia ekipy z /crews MUSI się udać
--         (dziś nie udaje się nikomu — to jest ta naprawa),
--      b) zalogowany jako dyspozytor: wgranie tego samego pliku MUSI zostać odrzucone
--         przez RLS, mimo że dyspozytor widzi listę ekip,
--      c) odczyt zdjęć na /crews i na stronie leada nadal działa (idzie przez service role,
--         te polityki go nie dotyczą — jeśli przestał, przyczyna jest gdzie indziej).
