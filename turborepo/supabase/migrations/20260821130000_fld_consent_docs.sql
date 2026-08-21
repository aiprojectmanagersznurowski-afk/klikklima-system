-- WO: FLD-CONSENT-DOCS — wersjonowane zgody RODO i regulamin pracowniczy (model danych)
-- Decyzje D-C i D-D (człowiek, 2026-08-21):
--
--   D-C: dokumenty prawne to NOWY zasób RBAC, nie rozszerzenie `documents`. Powód: documents.create
--        mają dziś audytor i monter, więc rozszerzenie zlałoby „tworzę dokument" z „akceptuję
--        dokument" w jednym zasobie, a macierz RBAC nie rozróżnia rodzajów w obrębie zasobu.
--        Skutek: zero kolizji z migracją fazy 1 (ADR-012, R4 w WO).
--   D-D: brak akceptacji blokuje pracę DOPIERO w Field App (faza 3). Ta migracja NIE dokłada
--        guarda na T01/T05 ani filtra puli przypisania — funnel.contract.mjs pozostaje nietknięty.
--        Ten plik dowozi wyłącznie nośnik: treść, wersje, rejestr akceptacji.
--
-- Zmiana ADDYTYWNA i IDEMPOTENTNA. Zero NOT NULL bez wartości domyślnej na istniejącej tabeli,
-- zero RENAME, zero DROP, zero backfillu (nie ma czego backfillować — obie tabele są nowe i puste;
-- brak akceptacji ma znaczyć „nie zaakceptował", więc wstawianie czegokolwiek na starcie
-- fałszowałoby dowód, który ten rejestr ma nieść). NIE URUCHAMIANA na żadnej bazie w tym tickecie.
--
-- Nazwy audytorzy / zespoly_monterskie są długiem KK-NAMING-BASELINE (zamrożonym) — nowe obiekty
-- nazywają się po angielsku, stare zostają. Patrz docs/architecture/NAMING.md.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rodzaj dokumentu prawnego — ENUM, nie tabela słownikowa (R3/D-C, decyzja projektowa)
-- ─────────────────────────────────────────────────────────────────────────────
-- WO opisywał wariant C1 jako trzy tabele (legal_documents + legal_document_versions +
-- employee_consents). Rodzaj dokumentu jest tu enumem, a nie tabelą, świadomie:
--
--   * dodanie nowego rodzaju dokumentu prawnego NIE jest wprowadzeniem danych przez administratora,
--     tylko zmianą kontraktu — faza 3 musi wiedzieć, KTÓRYCH rodzajów wymaga przed wpuszczeniem
--     pracownika do zlecenia. Gdyby rodzaje były wierszami, ten warunek nie miałby stabilnego
--     identyfikatora i „komplet zgód" zależałby od tego, co ktoś wpisał w CRUD-zie;
--   * tabela (id, kind, title) nie niosłaby ani jednego atrybutu, którego nie niesie sam enum;
--   * precedens w tym repozytorium: 20260821120000 wybrało prawdziwy typ enum zamiast TEXT + CHECK,
--     bo wartość spoza słownika ma odrzucać baza, także dla zapisu z pominięciem Server Action.
--
-- Konsekwencja, którą trzeba znać: rozszerzenie słownika wymaga migracji z ALTER TYPE ... ADD VALUE
-- (osobny plik — nowej wartości nie da się użyć w tej samej transakcji, patrz
-- 20260820120000_crm_safe_record_actions_enum.sql). To jest cena zamierzona, nie przeoczenie.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typname = 'LegalDocumentKind' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public."LegalDocumentKind" AS ENUM ('RODO_CONSENT', 'EMPLOYEE_TERMS');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Wersje dokumentów prawnych (AC1, AC2, AC7)
-- ─────────────────────────────────────────────────────────────────────────────
-- R3 (treść: plik czy tekst) — rozstrzygnięte przez contract-steward na TEKST W BAZIE:
--
--   * AC1 żąda porównania starej wersji „bajt w bajt" po opublikowaniu nowej. Obiekt w Storage
--     jest MUTOWALNY w miejscu — nadpisanie pliku pod tym samym kluczem po cichu zmienia treść
--     wersji już opublikowanej i łamie AC1 dokładnie w tym punkcie, w którym AC1 ma znaczenie
--     (dowód wobec organu, co pracownik wtedy widział). W bazie tę niezmienność da się wymusić
--     wyzwalaczem, na buckecie nie da się jej wymusić wcale;
--   * dziś nie ma bucketu na dokumenty prawne (istnieją tylko `audytorzy` i `zespoly`, oba na
--     awatary), więc wariant plikowy dokłada bucket + polityki + drugi punkt kontroli dostępu
--     obok RLS-a tej tabeli;
--   * Field App i tak musi wyrenderować treść w oknie akceptacji, a nie podać link do pobrania:
--     akceptacja pliku, którego nikt nie otworzył, jest bezwartościowa dowodowo.
--
-- Cena: potrzebny edytor treści w panelu administratora (poza zakresem tego WO) i limit rozmiaru
-- rzędu pojedynczych megabajtów — dla regulaminu i klauzuli RODO to zapas o rzędy wielkości.

CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_kind public."LegalDocumentKind" NOT NULL,

  -- Numer wersji rosnący w obrębie rodzaju dokumentu. Jawny identyfikator, a nie data modyfikacji
  -- pliku (kryterium FLD-LEGAL-DOC-VERSION). Nadawany przez Server Action, nie przez sekwencję:
  -- sekwencja globalna dawałaby regulaminowi numery z dziurami po wersjach klauzuli RODO.
  version_no    INTEGER NOT NULL,

  content       TEXT NOT NULL,

  -- published_at IS NULL = szkic. Szkic wolno edytować i usunąć; wersja opublikowana jest
  -- niezmienna (wyzwalacz w punkcie 4) i nieusuwalna, gdy ktokolwiek ją zaakceptował (FK w punkcie 3).
  published_at  TIMESTAMPTZ(6),

  -- „Obowiązująca w tej chwili". Osobna flaga, a nie „najwyższy version_no", bo publikacja bywa
  -- planowana i bo wycofanie się do poprzedniej treści musi być możliwe bez podmiany numeracji.
  is_current    BOOLEAN NOT NULL DEFAULT false,

  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT legal_document_versions_version_no_positive CHECK (version_no > 0),

  -- Szkic nie może być wersją obowiązującą. Bez tego dałoby się wskazać pracownikom treść,
  -- której administrator nigdy nie opublikował.
  CONSTRAINT legal_document_versions_current_is_published
    CHECK (is_current = false OR published_at IS NOT NULL)
);

-- AC2: DOKŁADNIE JEDNA wersja danego rodzaju jest obowiązująca w danym momencie.
-- Częściowy indeks unikalny, czyli sprawdzenie w bazie — nie w kodzie. Dwa równoległe żądania
-- publikacji nie mogą zostawić dwóch obowiązujących wersji, bo drugie odbije się od indeksu.
-- (Kod „sprawdź, czy jest inna obowiązująca, potem ustaw" przegrywa ten wyścig — ta sama klasa
-- problemu co rezerwacja slotu, pułapka 4 w CLAUDE.md.)
CREATE UNIQUE INDEX IF NOT EXISTS legal_document_versions_current_per_kind_key
  ON public.legal_document_versions (document_kind)
  WHERE is_current;

-- Numeracja bez duplikatów w obrębie rodzaju dokumentu.
CREATE UNIQUE INDEX IF NOT EXISTS legal_document_versions_document_kind_version_no_key
  ON public.legal_document_versions (document_kind, version_no);

COMMENT ON TABLE public.legal_document_versions IS
  'Wersjonowana tresc zgod RODO i regulaminu pracowniczego (FLD-LEGAL-DOC-VERSION). WLASCICIEL: ADMIN. Wersja opublikowana jest niezmienna (wyzwalacz) i nieusuwalna, gdy ma akceptacje (FK RESTRICT z employee_consents).';
COMMENT ON COLUMN public.legal_document_versions.is_current IS
  'Wersja obowiazujaca teraz. Czesciowy indeks unikalny dopuszcza dokladnie jedna taka wersje na rodzaj dokumentu (AC2).';
COMMENT ON COLUMN public.legal_document_versions.published_at IS
  'NULL = szkic. Moment publikacji, timestamptz — porownanie „zaakceptowal przed przypisaniem" liczy sie na znacznikach, nie na datach kalendarzowych.';
COMMENT ON COLUMN public.legal_document_versions.content IS
  'Tresc dokumentu jako tekst w bazie (decyzja R3). Po publikacji NIEZMIENNA — proba UPDATE konczy sie wyjatkiem z wyzwalacza, nie cichym nadpisaniem.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Rejestr akceptacji pracowniczych (AC3, AC4, AC5, AC6, AC9)
-- ─────────────────────────────────────────────────────────────────────────────
-- R1 — „pracownik" nie jest dziś encją. Ten sam wzorzec co availability_declarations
-- (20260821120000): dwie nullowalne kolumny + CHECK num_nonnulls(...) = 1, bo `audytorzy`
-- i `zespoly_monterskie` nie mają wspólnego rekordu osoby. Wada znana i zapisana w WO: przy
-- trzeciej roli (serwisant) ten kształt trzeba będzie zamienić na encję „osoba". Nie robimy tego
-- teraz, żeby nie przepisywać przy okazji dwóch istniejących tabel pracowniczych.
--
-- Konsekwencja, którą trzeba wypowiedzieć wprost: ta sama osoba występująca jako audytor
-- i jako ekipa akceptuje DWA RAZY (dwa wiersze, dwa różne klucze obce). Odpowiedź „raz" wymaga
-- encji osoby, której nie ma — a fałszywe sklejenie po adresie e-mail dawałoby dowód wskazujący
-- na rekord, którego pracownik nigdy nie widział.
--
-- Tabela jest APPEND-ONLY (profil audit_log): jeden wpis to jedno zdarzenie „zaakceptowano",
-- a zdarzenia się nie edytuje. Odpowiada temu update: [] w macierzy RBAC oraz wyzwalacz w punkcie 4.
CREATE TABLE IF NOT EXISTS public.employee_consents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- AC9 / R2: FK BEZ CASCADE i BEZ SET NULL. Usunięcie konta pracownika nie może skasować dowodu,
  -- że zgoda była udzielona w chwili wykonywania pracy, a osierocony wpis („ktoś zaakceptował")
  -- nie jest dowodem niczego. RESTRICT wzmacnia w bazie politykę BLOCK_UNTIL_REASSIGNED, którą
  -- rbac.contract.mjs deklaruje dla `auditors` i `crews` — dotąd żyła wyłącznie w Server Action.
  -- To jest inny wybór niż w availability_declarations (tam CASCADE) i różnica jest zamierzona:
  -- deklaracja dostępności bez pracownika nie znaczy nic, akceptacja bez pracownika to skasowany dowód.
  auditor_id UUID REFERENCES public.audytorzy(id) ON DELETE RESTRICT,
  crew_id    UUID REFERENCES public.zespoly_monterskie(id) ON DELETE RESTRICT,

  -- AC3: wskazanie wersji kluczem obcym, nie tekstem ani numerem. Wskazanie nieistniejącej wersji
  -- odrzuca baza.
  -- AC6: RESTRICT — wersji z akceptacjami nie da się usunąć. Odmowa, nie kaskada i nie osierocenie
  -- (SET NULL byłby tu tak samo zły jak CASCADE: AC3 wymaga, żeby wskazanie wersji dawało się
  -- rozstrzygnąć zawsze, a nie „o ile nikt nie sprzątał").
  version_id UUID NOT NULL REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,

  -- timestamptz, nie date: „zaakceptował przed przypisaniem" liczy się na znacznikach.
  accepted_at TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Brak updated_at — nie ma czego aktualizować w tabeli, której nikt nie aktualizuje.
  CONSTRAINT employee_consents_one_owner CHECK (num_nonnulls(auditor_id, crew_id) = 1)
);

-- AC4: unikalność (pracownik, wersja) jako OGRANICZENIE BAZY. Dwa równoległe żądania akceptacji
-- tej samej wersji dają dokładnie jeden wiersz — drugie odbija się od indeksu. Wzorzec „sprawdź,
-- czy istnieje, potem wstaw" przegrywa ten wyścig i dlatego go tu nie ma.
-- Dwa indeksy zamiast jednego, bo właściciel jest w jednej z dwóch kolumn: w indeksie
-- wielokolumnowym NULL-e są rozróżnialne, więc wiersze ekipowe nie kolidują z audytorskimi.
CREATE UNIQUE INDEX IF NOT EXISTS employee_consents_auditor_id_version_id_key
  ON public.employee_consents (auditor_id, version_id);
CREATE UNIQUE INDEX IF NOT EXISTS employee_consents_crew_id_version_id_key
  ON public.employee_consents (crew_id, version_id);

-- Odpytywalność „czy pracownik ma aktualną akceptację" (potrzebna fazie 3): JOIN po version_id
-- do wersji z is_current = true. Ten indeks obsługuje tę stronę zapytania.
CREATE INDEX IF NOT EXISTS employee_consents_version_id_idx
  ON public.employee_consents (version_id);

COMMENT ON TABLE public.employee_consents IS
  'Rejestr akceptacji dokumentow prawnych przez pracownika terenowego (FLD-CONSENT-ACCEPT): kto, ktora wersje, kiedy. APPEND-ONLY jak audit_log — brak UPDATE (wyzwalacz + update: [] w macierzy RBAC). Egzekwowanie „brak zgod = brak zlecenia" NIE zyje tutaj: decyzja D-D umiescila je w Field App (faza 3).';
COMMENT ON COLUMN public.employee_consents.version_id IS
  'Wersja FAKTYCZNIE zaakceptowana przez pracownika. Server Action MUSI przyjac ten identyfikator jawnie z frontendu — „zapisz akceptacje najnowszej wersji" po cichu zapisaloby cos innego niz to, co pracownik czytal.';
COMMENT ON COLUMN public.employee_consents.accepted_at IS
  'Moment akceptacji (timestamptz). Nigdy nie zmieniany: publikacja nowej wersji nie dotyka istniejacych wpisow (AC5).';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Niezmienność wymuszona w bazie, nie w Server Action (AC1, AC5, append-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- ŚWIADOME ODSTĘPSTWO od dotychczasowej praktyki repozytorium: to pierwsze wyzwalacze w tych
-- migracjach. Powód jest ten sam, który migracja 20260821120000 wypowiedziała o enumach: Prisma
-- omija RLS (pułapka 1 w CLAUDE.md), więc baza jest OSTATNIĄ warstwą, która cokolwiek gwarantuje.
-- AC1 brzmi „to własność modelu, nie tylko dyscyplina Server Action" — a UPDATE-u nie da się
-- zablokować ani CHECK-iem (nie widzi OLD), ani indeksem, ani odebraniem uprawnień (Prisma łączy
-- się rolą właściciela). Zostaje wyzwalacz albo obietnica. Obietnica już raz w tym repozytorium
-- nie wystarczyła.

-- 4a. Wersja opublikowana: wolno przestawić WYŁĄCZNIE is_current (publikacja/wycofanie) i updated_at.
--     Treść, rodzaj, numer i moment publikacji są zamrożone w chwili publikacji.
--     Szkic (published_at IS NULL) pozostaje w pełni edytowalny — wersjonowanie zaczyna się
--     od publikacji, a nie od pierwszego zapisu roboczego.
CREATE OR REPLACE FUNCTION public.legal_document_versions_freeze_published()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.published_at IS NULL THEN
    RETURN NEW;  -- szkic: edycja dozwolona
  END IF;

  IF NEW.content       IS DISTINCT FROM OLD.content
  OR NEW.document_kind IS DISTINCT FROM OLD.document_kind
  OR NEW.version_no    IS DISTINCT FROM OLD.version_no
  OR NEW.published_at  IS DISTINCT FROM OLD.published_at
  OR NEW.created_at    IS DISTINCT FROM OLD.created_at
  OR NEW.id            IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION
      'legal_document_versions: wersja opublikowana jest niezmienna (AC1). Wolno zmienic wylacznie is_current. Nowa tresc = NOWA WERSJA.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS legal_document_versions_freeze_published_trg ON public.legal_document_versions;
CREATE TRIGGER legal_document_versions_freeze_published_trg
  BEFORE UPDATE ON public.legal_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.legal_document_versions_freeze_published();

-- 4b. Rejestr akceptacji: append-only. Żaden UPDATE, dla nikogo, łącznie z adminem — tak samo jak
--     audit_log (AUDIT_REQUIREMENTS.appendOnly). Rejestr, który administrator może poprawić, nie
--     jest dowodem niczego. To jest zarazem AC5 wymuszone strukturalnie: publikacja nowej wersji
--     NIE MOŻE unieważnić istniejących akceptacji, bo nie ma ścieżki, którą mogłaby je zmienić.
--
--     DELETE świadomie NIE jest blokowany wyzwalaczem, choć macierz RBAC nie daje go nikomu:
--     rejestr podlega retencji (AUDIT_REQUIREMENTS.retentionDays = 1825, a dla dowodu wobec organu
--     być może dłuższej), a purge po upływie okresu musi być wykonalny bez zmiany schematu.
--     Blokadą na usunięcie POJEDYNCZEGO dowodu jest delete: [] w macierzy plus FK RESTRICT
--     w obie strony — nie ma ścieżki aplikacyjnej, która skasowałaby wpis przy okazji czegoś innego.
CREATE OR REPLACE FUNCTION public.employee_consents_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'employee_consents: rejestr akceptacji jest append-only (AC5). Wpisu nie edytuje sie — nowa akceptacja to NOWY WIERSZ.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS employee_consents_append_only_trg ON public.employee_consents;
CREATE TRIGGER employee_consents_append_only_trg
  BEFORE UPDATE ON public.employee_consents
  FOR EACH ROW EXECUTE FUNCTION public.employee_consents_append_only();

-- 4c. Akceptować wolno WYŁĄCZNIE wersję obowiązującą w chwili zapisu.
--     To jest odpowiedź na przypadek brzegowy z WO („publikacja nowej wersji w trakcie akceptowania
--     starej"): pracownik czyta treść, administrator publikuje nową wersję, pracownik klika
--     „akceptuję" ułamek sekundy później. Stara wersja nie jest już is_current, więc spóźniona
--     akceptacja zostaje ODRZUCONA przez bazę — zgodnie z WO („zapisana wersja musi być tą, którą
--     pracownik widział, albo operacja ma zostać odrzucona"). Rozstrzyga to również dwa inne
--     przypadki jednym warunkiem: nie da się zaakceptować szkicu (is_current wymaga published_at)
--     ani wersji dawno nieaktualnej, np. z podrzuconym identyfikatorem.
--
--     Świadoma konsekwencja: rejestru NIE DA SIĘ zasilić wstecz (import historycznych akceptacji
--     wymagałby wyłączenia wyzwalacza jawną komendą administratora bazy). Uznane za zaletę:
--     dopisanie dowodu zgody wstecz jest dokładnie tym, przed czym ten rejestr ma chronić.
CREATE OR REPLACE FUNCTION public.employee_consents_version_must_be_current()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.legal_document_versions v
     WHERE v.id = NEW.version_id AND v.is_current
  ) THEN
    RAISE EXCEPTION
      'employee_consents: mozna zaakceptowac wylacznie wersje obowiazujaca w chwili zapisu (AC3). Wskazana wersja jest szkicem albo zostala zastapiona w trakcie akceptowania.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_consents_version_must_be_current_trg ON public.employee_consents;
CREATE TRIGGER employee_consents_version_must_be_current_trg
  BEFORE INSERT ON public.employee_consents
  FOR EACH ROW EXECUTE FUNCTION public.employee_consents_version_must_be_current();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS: domyślna odmowa (fail-closed) — jak w 20260821120000
-- ─────────────────────────────────────────────────────────────────────────────
-- Nowa tabela bez RLS jest po prostu otwarta dla roli anon przez PostgREST. Tutaj znaczyłoby to,
-- że treść zgód i cudze akceptacje czyta każdy, a rejestr dowodowy jest zapisywalny z zewnątrz.
-- Włączenie RLS bez polityk = nikt poza właścicielem połączenia. Panel B2B tego nie odczuje
-- (Prisma omija RLS), Field App (faza 3, supabase-js) nie ruszy tych tabel, dopóki nie powstaną
-- polityki wyrażające „:own" — i to jest stan pożądany: brak polityki ma znaczyć odmowę.
-- Autor polityk: osobna pętla z rls-security-auditor, po decyzji o mapowaniu auth.users na rekord
-- audytorzy / zespoly_monterskie (dziś panel B2B robi to po adresie e-mail).

ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_consents       ENABLE ROW LEVEL SECURITY;
